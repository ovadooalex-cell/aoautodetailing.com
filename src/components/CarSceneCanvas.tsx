import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useThree, useLoader, useFrame } from '@react-three/fiber';
import { ContactShadows, PerformanceMonitor, useGLTF } from '@react-three/drei';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as THREE from 'three';
import { MODEL_URL, MODEL_URL_MOBILE, MODEL_URL_INTERIOR, HDRI_URL, PAINT_COLOR, TEXTURES_URL, BRAND_LOGO_URL } from '../config/carConfig';
import { createVehicleMaterialResolver } from '../lib/vehicleMaterial';
import { removeSmallIslandTrianglesInBox } from '../lib/geometry';
import { addLogoDecal } from '../lib/vehicleAddons';
import { useLightweightScene, useCompactLayout, shouldUseLightweightScene, IS_WEAK_DEVICE } from '../hooks/useLightweightScene';
import FxaaOutput from './FxaaOutput';
import type { CarSceneHandle } from './CarScene';

// Two spots turned out to have raised lettering molded into the geometry
// itself, per the standing "no emblems" rule — a material swap can't hide
// either one, and recoloring them flat wouldn't fully help (embossed edges
// still catch a bright specular highlight under the key light — confirmed by
// rendering both close-up). Both were found the same way: raycasting a grid
// of screen points across the visible letters and grouping hits by
// connected-triangle island — the letters are always a handful of small
// islands (tens to a couple hundred triangles) sitting apart from one much
// bigger island that's the part's actual body, which is what the size
// threshold below protects in each case.
//
// A world-space box (rather than "the whole mesh") targets just the letters
// and not the rest of a shared material's geometry, needed for the two
// grille entries — their materials are also used elsewhere on the truck
// (window trim, tire tread). The four caliper meshes don't need that: each
// one *is* the lettering-plus-body, nothing else, so their box is just big
// enough to cover the whole mesh and the size threshold alone does the work.
const WHOLE_MESH_BOX = new THREE.Box3(new THREE.Vector3(-10, -10, -10), new THREE.Vector3(10, 10, 10));
const EMBOSSED_LETTERING_TARGETS: { meshName: string; box: THREE.Box3; maxIslandTriangles: number }[] = [
  // A "TOYOTA" wordmark on the front grille — turned out to span two
  // entirely different meshes:
  {
    // "grill.001" (exported as "grill001" — glTF node names can't carry
    // dots), material "nhuaa": the grille shell itself. Nine small islands
    // (32–216 triangles) here sit right behind where the letters read, most
    // likely the recessed channel/bevel edge they mount into — removing
    // them was the first pass and, on its own, didn't remove the text.
    meshName: 'grill001',
    box: new THREE.Box3(new THREE.Vector3(-0.22, 1.02, 2.46), new THREE.Vector3(0.22, 1.11, 2.5)),
    maxIslandTriangles: 250,
  },
  {
    // "grill.012" ("grill012"), material "Material.065": a separate light-
    // grey insert — a real TOYOTA grille badge is usually its own molded
    // piece bolted to the black grille bar, not sculpted into it, which
    // matches. This is the one actually carrying the letters: 147 small
    // islands (≤144 triangles each) cluster in the same region, with no
    // large connected surface competing there worth protecting.
    meshName: 'grill012',
    box: new THREE.Box3(new THREE.Vector3(-0.25, 1.0, 2.3), new THREE.Vector3(0.25, 1.15, 2.55)),
    maxIslandTriangles: 300,
  },
  // "TRD" embossed into the brake calipers (a real styling detail on this
  // truck's trim — the model just also replicated the lettering). One mesh
  // per wheel, all identical copies of the same geometry: a single 320-
  // triangle caliper body plus a consistent set of smaller islands (18–80
  // triangles) that are the lettering and a couple of bolt-head details.
  // Surfaced once real per-part textures went in — the flat red placeholder
  // this had before didn't carry enough shading definition to read as text.
  ...['mesh_27', 'wheel_lfchild011', 'mesh_66', 'mesh_67', 'mesh_68', 'mesh_69', 'mesh_70'].map((meshName) => ({
    meshName,
    box: WHOLE_MESH_BOX,
    maxIslandTriangles: 200,
  })),
  // "TRD PRO" embossed across the tailgate, plus a smaller badge near the
  // right tail light — found *after* the mobile LOD shipped, when its
  // flatter lighting made both noticeably more legible than they'd been on
  // desktop (same lesson as the caliper text: a flat placeholder color can
  // hide embossed detail that a different light or material later exposes,
  // so a "no emblems" pass done once isn't necessarily done for good). One
  // mesh, "mesh_2" (the tailgate panel): a single 908-triangle body plus ~70
  // small islands (4–148 triangles each, 1002 triangles combined) that are
  // the lettering, the badge, and a few incidental details (a handle
  // recess, hinge lines) — no clean way to separate those from the lettering
  // by position (they're intermixed across the same panel), so all of them
  // go, matching the caliper precedent of accepting a little collateral
  // detail loss in exchange for a guaranteed clean read. Confirmed this one
  // fix covers both the mobile LOD and the desktop model — the removal runs
  // at runtime against whichever glb loaded, not baked into either file, and
  // simplification doesn't fuse originally-disconnected islands together.
  { meshName: 'mesh_2', box: WHOLE_MESH_BOX, maxIslandTriangles: 300 },
  // "TRD" stamped into the outer face of each red rear recovery hook
  // ("grill013"), legible at the wheels stage. The letters stand ~2mm proud
  // of the hook's side face (|x| = 0.6784), so each box starts just outside
  // that face: the hook body never has a triangle centroid in it, which is
  // what lets the island limit go as high as the desktop model's biggest
  // letter island (426 triangles) safely. Simulated on both glbs before
  // shipping — only letter islands are touched, no hook-body triangles.
  {
    meshName: 'grill013',
    box: new THREE.Box3(new THREE.Vector3(0.6786, 0.535, -2.75), new THREE.Vector3(0.69, 0.578, -2.665)),
    maxIslandTriangles: 500,
  },
  {
    meshName: 'grill013',
    box: new THREE.Box3(new THREE.Vector3(-0.69, 0.535, -2.75), new THREE.Vector3(-0.6786, 0.578, -2.665)),
    maxIslandTriangles: 500,
  },
];

// A "TRD PRO" badge on each side of the hood scoop — light "TRD" letters
// (bonnet006) and red "PRO" letters (bonnet) raised on a small black plate.
// Unlike the embossed targets above, each of these two meshes is nothing BUT
// the lettering for both badges (thin, badge-sized, sitting only at the two
// scoop sides — confirmed by bounding box and a raycast grid over the
// badge), so they're hidden whole. The black plate underneath belongs to the
// larger scoop-trim mesh (bonnet003) and stays, reading as plain trim — same
// trade as the caliper lettering. Found on the third "no emblems" sweep,
// after the glass went see-through; present in both the desktop and mobile
// glb under the same names.
const LETTERING_ONLY_MESHES = new Set(['bonnet', 'bonnet006']);

/**
 * The actual Three.js/R3F subtree — split into its own lazy-loaded chunk
 * (see the `lazy(() => import(...))` in CarScene.tsx) because 'three' +
 * @react-three/fiber + drei are by far the heaviest dependency on this page;
 * this mirrors the old Spline setup, which lazy-loaded
 * @splinetool/react-spline for the same reason.
 */

function Model({
  onReady,
  viewShift,
  lightweight,
  compactLayout,
}: {
  onReady: (handle: CarSceneHandle) => void;
  viewShift: CarSceneHandle['viewShift'];
  lightweight: boolean;
  compactLayout: boolean;
}) {
  const { scene } = useGLTF(lightweight ? MODEL_URL_MOBILE : MODEL_URL);
  // Separate small glb (~16.8k triangles total) rather than folded into the
  // body model — see MODEL_URL_INTERIOR's doc comment. One file covers both
  // desktop and mobile, so this load doesn't depend on `lightweight`.
  const { scene: interiorScene } = useGLTF(MODEL_URL_INTERIOR);
  const { camera, gl } = useThree();
  // Guards against StrictMode's double-effect-invoke re-processing the SAME
  // scene twice — but keyed by scene identity, not a plain boolean, so it
  // does NOT block a genuinely new scene from being processed (crossing the
  // useLightweightScene breakpoint mid-session, e.g. rotating a tablet,
  // swaps in the other glb, which drei's useGLTF surfaces as a new object).
  const processedSceneRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    if (processedSceneRef.current === scene) return;
    processedSceneRef.current = scene;

    // Unlike the old Porsche asset (31 anonymous meshes, matched by fragile
    // traversal index), this truck's ~120 original .mtl materials are
    // genuinely named ("son_xe" = body paint, "wheel2a_diff" = rim,
    // "kieng_xe" = windshield, etc. — this source's modeler was Vietnamese;
    // see vehicleMaterial.ts). Every mesh here carries a placeholder material
    // whose `name` is that original string (baked in during the one-time
    // OBJ→glb conversion). Real materials — including, where the source has
    // one, the real texture — get resolved here, by name; see
    // vehicleMaterial.ts for the texture story (real .dds files, GPU-side
    // compressed, gated behind a hardware capability check).
    //
    // The light-bar/siren package this file originally came with and its
    // badge decals were cut out of the source geometry during that same
    // conversion — see the no-emblems note in carConfig.ts. The interior was
    // cut then too (unused by any camera shot at the time) but later
    // re-extracted from the same source file once real window transparency
    // made an empty cabin visible — see `interiorScene` below and
    // MODEL_URL_INTERIOR's doc comment in carConfig.ts.
    //
    // `lightweight` (phones/tablets — see useLightweightScene) skips the
    // real textures even on hardware that could technically display them:
    // the point isn't just decode support, it's the ~8MB of downloads they
    // cost, which matters far more on a phone connection than on desktop.
    // Flat colors are the same fallback already used for hardware that
    // lacks compressed-texture support outright.
    const resolveMaterial = createVehicleMaterialResolver({
      paintColor: PAINT_COLOR,
      texturesBaseUrl: TEXTURES_URL,
      supportsCompressedTextures: !lightweight && gl.extensions.has('WEBGL_compressed_texture_s3tc'),
    });

    // Shared between the body scene and the interior scene below — same
    // by-name material resolution and badge sweep either way.
    const processMesh = (obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      // Shadow casting/receiving is moot when lightweight also turns off the
      // Canvas's own shadow maps below, but skipping the flags too avoids
      // even the bookkeeping cost across 95 meshes.
      mesh.castShadow = !lightweight;
      mesh.receiveShadow = !lightweight;
      const originalNames = Array.isArray(mesh.material) ? mesh.material.map((m) => m.name) : [mesh.material.name];
      // Kept after the swap below (harmless) — lets a raycast diagnostic
      // recover which *original* .mtl material a triangle came from, since
      // the runtime materials assigned here don't carry that name. Combine
      // with intersection.face.materialIndex for an array-material mesh.
      mesh.userData.originalMaterialNames = originalNames;
      for (const target of EMBOSSED_LETTERING_TARGETS) {
        if (mesh.name === target.meshName) removeSmallIslandTrianglesInBox(mesh, target.box, target.maxIslandTriangles);
      }
      if (LETTERING_ONLY_MESHES.has(mesh.name)) mesh.visible = false;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => resolveMaterial(m.name))
        : resolveMaterial(mesh.material.name);
    };

    scene.traverse(processMesh);

    const box = new THREE.Box3().setFromObject(scene);

    // Added after the box above is computed so neither skews the
    // camera-framing math, which measures the truck's own body — see
    // buildPose in ScrollExperience.tsx. Both are cheap: ~16.8k triangles of
    // interior, and (once it loads) one small decal texture.
    if (interiorScene.parent !== scene) {
      interiorScene.traverse(processMesh);
      scene.add(interiorScene);
    }
    // The shadow map is baked, not live (autoUpdate is off — see the Canvas's
    // `shadows` prop): render it once now that every mesh has its final
    // castShadow flag and geometry. A no-op on the lightweight path, where
    // shadow maps are disabled outright.
    // oxlint-disable-next-line react/immutability
    gl.shadowMap.needsUpdate = true;
    // Loaded directly rather than via useLoader/Suspense — same reasoning as
    // vehicleMaterial.ts's DDS textures (direct `.load()` calls, not
    // useLoader): useLoader's suspend-react cache hung indefinitely for this
    // asset in testing (traced to its Suspense/cache wrapper, not the loader
    // or the file itself — a raw `new THREE.TextureLoader().load(...)` call
    // resolved fine every time). Fire-and-forget: the decal pops in a moment
    // after the truck itself rather than blocking the whole scene on it.
    new THREE.TextureLoader().load(BRAND_LOGO_URL, (texture) => addLogoDecal(scene, texture, gl));

    onReady({ camera: camera as THREE.PerspectiveCamera, model: scene, box, viewShift, compactLayout });
  }, [scene, interiorScene, camera, gl, onReady, viewShift, lightweight, compactLayout]);

  return <primitive object={scene} />;
}

/**
 * HDRI environment lighting/reflections, loaded by hand with three's own
 * EXRLoader + PMREMGenerator instead of drei's <Environment>.
 *
 * drei's <Environment> pulls EXRLoader from the separate 'three-stdlib'
 * package rather than this project's own 'three' install, and against
 * three@0.186 (a very recent release) that combination hung indefinitely —
 * the glb loaded and parsed fine, but nothing ever committed because the
 * whole subtree shares one Suspense boundary, and the EXR load inside
 * <Environment> never resolved (no error, no console output — the network
 * request never even fired, confirmed by watching the request log). Using
 * this project's own three@0.186 EXRLoader end-to-end avoids whatever
 * three-stdlib/three version mismatch caused that.
 */
function HdriEnvironment({ url }: { url: string }) {
  const texture = useLoader(EXRLoader, url);
  const { gl, scene } = useThree();

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envMap = pmrem.fromEquirectangular(texture).texture;
    // Imperative Three.js escape hatch — the standard way to set
    // environment lighting in R3F (drei's own <Environment> does the same
    // internally); `scene` is a live Three.js object, not React state.
    // oxlint-disable-next-line react/immutability
    scene.environment = envMap;
    pmrem.dispose();
    return () => {
      envMap.dispose();
      // oxlint-disable-next-line react/immutability
      if (scene.environment === envMap) scene.environment = null;
    };
  }, [texture, gl, scene]);

  return null;
}

/**
 * Mobile's counterpart to HdriEnvironment above — same job (give the paint's
 * clearcoat/metalness something to reflect, which is most of what makes it
 * read as glossy "hero shot" paint instead of flat/matte), without the
 * desktop HDRI's cost. `RoomEnvironment` is three.js's own stock env-map
 * source for exactly this: a tiny procedural scene (a handful of boxes and
 * emissive "light" panels, no textures) baked into a PMREM once at mount —
 * zero network download, one small one-time GPU cost instead of a per-frame
 * one. This is the documented, standard way to give PBR materials believable
 * reflections when a real photographic HDRI is too heavy — not a
 * lower-quality substitute so much as the appropriately-scaled one here.
 */
function ProceduralEnvironment() {
  const { gl, scene } = useThree();

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    // sigma (2nd arg) pre-blurs the equirect before baking the PMREM.
    // RoomEnvironment's "lights" are small, very bright emissive panels
    // (intensity up to 100) — without this they bake into hard, hot
    // reflection hotspots on any glossy clearcoat surface (showed up as an
    // unnaturally bright white patch on the tire sidewall/fender). This is
    // the standard pairing for this exact utility (matches three.js's own
    // published usage of RoomEnvironment) — softens the highlight into a
    // normal-looking reflection instead of removing reflections altogether.
    const envMap = pmrem.fromScene(room, 0.04).texture;
    // oxlint-disable-next-line react/immutability
    scene.environment = envMap;
    room.dispose();
    pmrem.dispose();
    return () => {
      envMap.dispose();
      // oxlint-disable-next-line react/immutability
      if (scene.environment === envMap) scene.environment = null;
    };
  }, [gl, scene]);

  return null;
}

/**
 * Per-frame camera adjustments that depend on the canvas, not on the scroll
 * story (the scroll timeline owns position/rotation; this owns the lens):
 *
 *  - Aspect-aware FOV. three's fov is vertical, so a fixed value that frames
 *    the car nicely at desktop widescreen crops its nose and tail on anything
 *    narrower (phones, portrait tablets, a squeezed window). Below the
 *    reference aspect the vertical FOV widens to hold the same *horizontal*
 *    field of view, capped so a very tall canvas doesn't fisheye.
 *  - View shift (setViewOffset) — slides the car around the frame without
 *    touching the camera's pose, so it can sit beside the info card / clear
 *    of the hero headline / below the finale text instead of underneath them. Desktop
 *    only: below the layout's stacking breakpoint the scene already gets its
 *    own region above the text.
 */
const BASE_FOV = 32;
const REFERENCE_ASPECT = 1.6;
const MAX_FOV = 62;
const SHIFT_MIN_WIDTH = 901;

function CameraRig({ viewShift }: { viewShift: CarSceneHandle['viewShift'] }) {
  useFrame(({ camera, size }) => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const halfBase = Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2));
    cam.fov =
      aspect >= REFERENCE_ASPECT
        ? BASE_FOV
        : Math.min(MAX_FOV, THREE.MathUtils.radToDeg(2 * Math.atan((halfBase * REFERENCE_ASPECT) / aspect)));
    const shifted = size.width >= SHIFT_MIN_WIDTH;
    const shiftX = shifted ? viewShift.x * size.width : 0;
    // The view window moves opposite to the content: window right = car left,
    // window up = car down (hence the minus).
    const shiftY = shifted ? -viewShift.y * size.height : 0;
    // Also re-runs updateProjectionMatrix, which picks up the fov above.
    cam.setViewOffset(size.width, size.height, shiftX, shiftY, size.width, size.height);
  });
  return null;
}

/**
 * Render resolution (device pixel ratio) for the canvas.
 *
 * Upper cap by path: 1.75 on the full desktop path; 1.5 on phones/tablets — a
 * flat `1` there (a real iPhone's devicePixelRatio is 2-3x) read as
 * soft/pixelated on an actual Retina screen, and 1.5 is the documented sweet
 * spot for mobile three.js scenes; 1.25 on weak laptop-class hardware like a
 * school Chromebook (see IS_WEAK_DEVICE — usually a ~1x screen anyway, and
 * the weakest GPU this site is likely to meet). Never above the screen's own
 * ratio — rendering pixels the display can't show is pure waste.
 *
 * `perfFactor` (1 = full quality) slides that down toward MIN_DPR when
 * PerformanceMonitor sees the frame rate sag: a slightly softer image is a far
 * better trade than a stuttering scroll.
 */
const MIN_DPR = 0.75;
function adaptiveDpr(compactLayout: boolean, perfFactor: number): number {
  const cap = compactLayout ? 1.5 : IS_WEAK_DEVICE ? 1.25 : 1.75;
  const max = Math.max(MIN_DPR, Math.min(window.devicePixelRatio || 1, cap));
  return Math.round((MIN_DPR + (max - MIN_DPR) * perfFactor) * 20) / 20;
}

export default function CarSceneCanvas({
  onReady,
  active = true,
}: {
  onReady: (handle: CarSceneHandle) => void;
  /** false stops R3F's internal render loop entirely — see CarScene.tsx. */
  active?: boolean;
}) {
  // Stable object identity for the life of the canvas — GSAP mutates it, the
  // rig reads it; deliberately not React state (it changes every scrub tick).
  const [viewShift] = useState(() => ({ x: 0, y: 0 }));
  const lightweight = useLightweightScene();
  const compactLayout = useCompactLayout();
  // 0..1, driven down by PerformanceMonitor below when the GPU can't hold a
  // smooth frame rate — see adaptiveDpr.
  const [perfFactor, setPerfFactor] = useState(1);
  // Decided once: hardware antialiasing is a context-creation setting, so it
  // can't follow a later resize across the layout breakpoint anyway. Phones
  // and tablets keep MSAA — their tile-based GPUs resolve it nearly for free.
  const [fxaa] = useState(() => IS_WEAK_DEVICE && !shouldUseLightweightScene());

  return (
    <Canvas
      className="car-scene__canvas"
      // 'never': zero rendering, not even a stopped/idle frame, while the
      // pinned scroll section is off-screen (see CarScene.tsx's `active`).
      // Toggling this prop is R3F's documented way to start/stop its
      // internal requestAnimationFrame loop on demand.
      frameloop={active ? 'always' : 'never'}
      // R3F's plain `shadows` boolean requests THREE.PCFSoftShadowMap, which
      // this three.js version no longer implements — it logs a "removed,
      // using PCFShadowMap instead" warning on every single frame it
      // renders. Asking for PCFShadowMap directly gets the same result
      // (three.js was silently substituting it anyway) with no warning.
      // `autoUpdate: false`: the truck never moves relative to the key light
      // (only the camera does), so the shadow map never changes — but by
      // default three re-renders the whole ~300k-triangle truck into it every
      // single frame anyway. Model re-renders it exactly once, after the
      // truck's meshes are set up (see the needsUpdate there). R3F copies
      // this object's fields straight onto renderer.shadowMap.
      // `lightweight`: off entirely there (ContactShadows below gives a soft
      // blob under the car regardless, which reads as "grounded" well
      // enough without it).
      shadows={lightweight ? false : { type: THREE.PCFShadowMap, autoUpdate: false }}
      camera={{ fov: 32, near: 0.1, far: 100 }}
      dpr={adaptiveDpr(compactLayout, perfFactor)}
      // Was off on mobile entirely — between that and the dpr cap above, model
      // edges (the truck's silhouette, panel lines, wheel rims) read as
      // jagged/"pixelated" on a real phone screen. Modern phone GPUs handle
      // MSAA cheaply. Weak laptop-class GPUs don't: 4x MSAA measured at about
      // half of the whole frame's GPU time there, so they get FxaaOutput
      // below instead.
      gl={{ antialias: !fxaa }}
      onCreated={({ gl }) => {
        // Filmic tone mapping — the same curve real product-photography
        // renderers use — so the HDRI's highlights roll off naturally
        // instead of clipping to flat white. R3F's default is neutral/flat.
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
      }}
    >
      {fxaa && <FxaaOutput />}
      <Suspense fallback={null}>
        <Model onReady={onReady} viewShift={viewShift} lightweight={lightweight} compactLayout={compactLayout} />
        <CameraRig viewShift={viewShift} />
        {/* Dynamic resolution: if the frame rate sags (a school Chromebook, a
            laptop on battery, a busy integrated GPU), step the render
            resolution down until it recovers — and back up once there's
            headroom again. Resolution is the one quality lever that can move
            at runtime without recompiling shaders or reloading the model, and
            fill rate is what a weak GPU runs out of first. Inside the
            Suspense boundary on purpose: it only starts measuring once the
            truck has loaded, so the parse/decode stalls of loading don't read
            as a slow GPU. `flipflops` (drei counts every step, up or down)
            leaves room for a full descent plus some recovery, but stops it
            oscillating forever on a machine that sits right at a boundary.
            `bounds` are fixed rather than relative to the fastest rate seen:
            a GPU that can only ever manage 26fps would otherwise set its own
            bar at 26fps and never step down (tried and measured). Known
            trade-off: a browser that deliberately caps itself at 30fps
            (Chrome's Energy Saver, by default only at 20% battery or less)
            gets the softer resolution too. */}
        <PerformanceMonitor
          factor={1}
          step={0.25}
          ms={200}
          flipflops={8}
          bounds={(refreshrate) => (refreshrate > 100 ? [60, 100] : [45, 58])}
          onChange={({ factor }) => setPerfFactor(factor)}
        />
        {/* The real photographic HDRI is the biggest single line item here
            (5.6MB, plus the CPU cost of decoding + convolving it into a
            reflection map) — skipped on phones, where that download costs
            more and matters more. Its job (giving the paint's clearcoat
            something to reflect, without which it reads flat instead of
            glossy) still matters on mobile, so ProceduralEnvironment covers
            it there for effectively free instead of going without. Lights
            below are boosted a step on `lightweight` to make up the rest of
            the difference from the real HDRI's own fill light. */}
        {lightweight ? <ProceduralEnvironment /> : <HdriEnvironment url={HDRI_URL} />}
        <directionalLight
          position={[4, 6, 3]}
          intensity={lightweight ? 2.4 : 2}
          castShadow={!lightweight}
          shadow-mapSize={[2048, 2048]}
        />
        {/* Rim/kicker light from the opposite side — a single key light was
            enough to read a dark blue body (it always had a strong shadow
            side), but white paint doesn't: without a second light catching
            its far edge, the hero shot (the car small, far from camera, and
            sitting in the lightest part of the studio backdrop) nearly
            disappears into the background. This is the standard product-
            photography fix for exactly that — a real studio wouldn't shoot a
            white car with one light either. Kept on `lightweight` too (it's
            just one more light, not a real cost) since there's no HDRI fill
            there to lean on instead. */}
        <directionalLight position={[-5, 3, -4]} intensity={lightweight ? 1.1 : 0.9} />
        <ambientLight intensity={lightweight ? 0.45 : 0.3} />
        {/* The car's geometry never moves relative to the ground (only the
            camera does), so the shadow itself never changes — `frames={1}`
            bakes it exactly once at mount instead of re-rendering the whole
            truck into it every frame. Same visual result at a small fraction
            of the cost, on every device. */}
        <ContactShadows position={[0, 0, 0]} opacity={0.65} scale={12} blur={2} far={3} frames={1} />
      </Suspense>
    </Canvas>
  );
}

// Preload only the model this device will actually use — preloading both
// would download both. Same decision as useLightweightScene, just read once
// here since preload runs at module init, outside React (a resize across the
// breakpoint after this doesn't need a second preload — Model's own useGLTF
// call below still fetches the other one, just without the head start).
if (shouldUseLightweightScene()) {
  useGLTF.preload(MODEL_URL_MOBILE);
} else {
  useGLTF.preload(MODEL_URL);
}
useGLTF.preload(MODEL_URL_INTERIOR);
