import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useThree, useLoader, useFrame } from '@react-three/fiber';
import { ContactShadows, useGLTF } from '@react-three/drei';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import * as THREE from 'three';
import { MODEL_URL, HDRI_URL, PAINT_COLOR, TEXTURES_URL } from '../config/carConfig';
import { createVehicleMaterialResolver } from '../lib/vehicleMaterial';
import { removeSmallIslandTrianglesInBox } from '../lib/geometry';
import { useLightweightScene } from '../hooks/useLightweightScene';
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
];

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
}: {
  onReady: (handle: CarSceneHandle) => void;
  viewShift: CarSceneHandle['viewShift'];
  lightweight: boolean;
}) {
  const { scene } = useGLTF(MODEL_URL);
  const { camera, gl } = useThree();
  const readyRef = useRef(false);

  useEffect(() => {
    if (readyRef.current) return;
    readyRef.current = true;

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
    // The light-bar/siren package this file originally came with, its badge
    // decals, and its interior (unused by any camera shot in this site) were
    // already cut out of the source geometry during that same conversion —
    // see the no-emblems note in carConfig.ts.
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

    scene.traverse((obj) => {
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
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => resolveMaterial(m.name))
        : resolveMaterial(mesh.material.name);
    });

    const box = new THREE.Box3().setFromObject(scene);
    onReady({ camera: camera as THREE.PerspectiveCamera, model: scene, box, viewShift });
  }, [scene, camera, gl, onReady, viewShift, lightweight]);

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

export default function CarSceneCanvas({ onReady }: { onReady: (handle: CarSceneHandle) => void }) {
  // Stable object identity for the life of the canvas — GSAP mutates it, the
  // rig reads it; deliberately not React state (it changes every scrub tick).
  const [viewShift] = useState(() => ({ x: 0, y: 0 }));
  const lightweight = useLightweightScene();

  return (
    <Canvas
      className="car-scene__canvas"
      // R3F's plain `shadows` boolean requests THREE.PCFSoftShadowMap, which
      // this three.js version no longer implements — it logs a "removed,
      // using PCFShadowMap instead" warning on every single frame it
      // renders. Asking for PCFShadowMap directly gets the same result
      // (three.js was silently substituting it anyway) with no warning.
      // `lightweight`: a real-time shadow map is one of the more expensive
      // things a mobile GPU can be asked to do every frame — off entirely
      // there (ContactShadows below gives up a soft blob under the car
      // regardless, which reads as "grounded" well enough without it).
      shadows={lightweight ? false : { type: THREE.PCFShadowMap }}
      camera={{ fov: 32, near: 0.1, far: 100 }}
      // Capped at native resolution (no 1.75x supersample) on phones —
      // rendering every fragment shader twice-plus for a retina display
      // that's also usually the weakest GPU in the room isn't worth it.
      dpr={lightweight ? 1 : [1, 1.75]}
      gl={{ antialias: !lightweight }}
      onCreated={({ gl }) => {
        // Filmic tone mapping — the same curve real product-photography
        // renderers use — so the HDRI's highlights roll off naturally
        // instead of clipping to flat white. R3F's default is neutral/flat.
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
      }}
    >
      <Suspense fallback={null}>
        <Model onReady={onReady} viewShift={viewShift} lightweight={lightweight} />
        <CameraRig viewShift={viewShift} />
        {/* HDRI reflections are the biggest single line item here (5.6MB, plus
            the CPU cost of decoding + convolving it into a reflection map) for
            a purely cosmetic upgrade over plain directional/ambient light —
            skipped on phones, where that download and that CPU work both cost
            more and matter more. Lights below are boosted a step on
            `lightweight` to make up some of the lost fill. */}
        {!lightweight && <HdriEnvironment url={HDRI_URL} />}
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
        {!lightweight && <ContactShadows position={[0, 0, 0]} opacity={0.65} scale={12} blur={2} far={3} />}
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
