import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree, useLoader } from '@react-three/fiber';
import { ContactShadows, useGLTF } from '@react-three/drei';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import * as THREE from 'three';
import { MODEL_URL, HDRI_URL, PAINT_COLOR } from '../config/carConfig';
import type { CarSceneHandle } from './CarScene';

/**
 * The actual Three.js/R3F subtree — split into its own lazy-loaded chunk
 * (see the `lazy(() => import(...))` in CarScene.tsx) because 'three' +
 * @react-three/fiber + drei are by far the heaviest dependency on this page;
 * this mirrors the old Spline setup, which lazy-loaded
 * @splinetool/react-spline for the same reason.
 */

function Model({ onReady }: { onReady: (handle: CarSceneHandle) => void }) {
  const { scene } = useGLTF(MODEL_URL);
  const { camera } = useThree();
  const readyRef = useRef(false);

  useEffect(() => {
    if (readyRef.current) return;
    readyRef.current = true;

    // The car's 31 meshes have no part names, but they're NOT all one
    // undifferentiated shell either — confirmed by rendering each mesh in
    // its own color (a throwaway diagnostic, since removed each time) and
    // looking at the actual result, not by guessing from bounding boxes
    // (which had wrongly suggested no part was isolated, since a mirrored/
    // symmetric mesh's bounding box spans the full car width even when it's
    // disconnected geometry at all four corners).
    //
    // An earlier pass here mislabeled #10 as "the rim" — a closer isolation
    // check (once the wheel was actually zoomed in on, not viewed from
    // across the car) showed #10 is really the brake rotor/disc, and the
    // visible spoke arms are a completely separate mesh, #25. That's why
    // the rim looked "wrong" (picking up the body's blue reflection) even
    // after retuning what I thought was its material — it was never being
    // touched at all. Also found in the same pass: #21/#22/#23 are a small
    // shield emblem on the hub cap, which gets folded into the plain
    // spoke/rim material below rather than kept as its own distinct color,
    // per "no emblems" — it still exists as a shape, just not colored to
    // stand out as a badge. Traversal order is deterministic for a given
    // file, so these indices are stable as long as porsche.glb itself
    // doesn't change.
    const ROTOR_MESH_INDEX = 10;
    const TIRE_MESH_INDEX = 16;
    const EMBLEM_MESH_INDICES = new Set([21, 22, 23]);
    const RIM_MESH_INDEX = 25;
    const GLASS_MESH_INDEX = 30;

    // Duller, less reflective than the rim — a cast/drilled brake rotor is
    // a much more matte, worn metal than a polished wheel face.
    const rotorMaterial = new THREE.MeshStandardMaterial({
      color: '#4a4a4d',
      metalness: 0.7,
      roughness: 0.6,
    });
    // metalness/roughness kept modest rather than mirror-like — an earlier
    // attempt at 0.9/0.35 (on the wrong mesh, see above) picked up such a
    // strong tint from the surrounding body paint that it read as the
    // body's color instead of its own. This still looks metallic without
    // fully mirroring whatever's nearby.
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: '#2b2b30',
      metalness: 0.6,
      roughness: 0.5,
    });
    // The reference photos' tires read as glossy/wet, not flat matte
    // rubber — which also happens to match AO's own "tire dressing"
    // service (their bullet list literally sells this exact look). A
    // MeshPhysicalMaterial with a modest clearcoat gets that sheen without
    // needing an actual tread texture (there isn't one on this asset —
    // whatever tread-block shape shows is baked into the geometry itself).
    const tireMaterial = new THREE.MeshPhysicalMaterial({
      color: '#181818',
      metalness: 0,
      roughness: 0.55,
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
      envMapIntensity: 0.8,
    });
    // Tinted but genuinely see-through glass — this mesh also covers the
    // headlight lenses, which reads fine since real lenses are glass-like
    // too. There's no modeled interior behind it (this asset never had
    // one), so pushing transmission any higher than this starts looking
    // like an empty shell rather than glass with something behind it —
    // this is the balance point between "looks like solid tinted plastic"
    // (the old value) and "looks hollow".
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: '#141b21',
      metalness: 0,
      roughness: 0.03,
      transmission: 0.8,
      thickness: 0.15,
      ior: 1.5,
      envMapIntensity: 1.3,
    });

    let meshIndex = 0;
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      if (meshIndex === RIM_MESH_INDEX || EMBLEM_MESH_INDICES.has(meshIndex)) {
        mesh.material = rimMaterial;
      } else if (meshIndex === ROTOR_MESH_INDEX) {
        mesh.material = rotorMaterial;
      } else if (meshIndex === TIRE_MESH_INDEX) {
        mesh.material = tireMaterial;
      } else if (meshIndex === GLASS_MESH_INDEX) {
        mesh.material = glassMaterial;
      } else {
        // Everything else is the body — color comes from PAINT_COLOR (see
        // carConfig.ts for the reasoning), and the rest of these values push
        // the baked clearcoat material as close to real automotive paint as
        // this asset allows, tuned against the reference photos: a lower
        // base metalness (real metallic car paint is embedded flake under a
        // clear base, not bare metal, which reads as too "raw" at high
        // metalness), low roughness, and a tight, glossy clearcoat on top
        // with a strong HDRI response so reflections read as sharp
        // highlights rather than a flat sheen.
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        if (mat?.isMeshPhysicalMaterial) {
          mat.color.set(PAINT_COLOR);
          mat.metalness = 0.45;
          mat.roughness = 0.12;
          mat.clearcoat = 1;
          mat.clearcoatRoughness = 0.02;
          mat.envMapIntensity = 1.5;
        }
      }
      meshIndex++;
    });

    const box = new THREE.Box3().setFromObject(scene);
    onReady({ camera: camera as THREE.PerspectiveCamera, model: scene, box });
  }, [scene, camera, onReady]);

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

export default function CarSceneCanvas({ onReady }: { onReady: (handle: CarSceneHandle) => void }) {
  return (
    <Canvas
      className="car-scene__canvas"
      // R3F's plain `shadows` boolean requests THREE.PCFSoftShadowMap, which
      // this three.js version no longer implements — it logs a "removed,
      // using PCFShadowMap instead" warning on every single frame it
      // renders. Asking for PCFShadowMap directly gets the same result
      // (three.js was silently substituting it anyway) with no warning.
      shadows={{ type: THREE.PCFShadowMap }}
      camera={{ fov: 32, near: 0.1, far: 100 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        // Filmic tone mapping — the same curve real product-photography
        // renderers use — so the HDRI's highlights roll off naturally
        // instead of clipping to flat white. R3F's default is neutral/flat.
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
      }}
    >
      <Suspense fallback={null}>
        <Model onReady={onReady} />
        <HdriEnvironment url={HDRI_URL} />
        <directionalLight position={[4, 6, 3]} intensity={2} castShadow shadow-mapSize={[2048, 2048]} />
        <ambientLight intensity={0.3} />
        <ContactShadows position={[0, 0, 0]} opacity={0.55} scale={12} blur={2.2} far={3} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
