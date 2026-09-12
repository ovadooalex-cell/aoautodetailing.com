import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree, useLoader } from '@react-three/fiber';
import { ContactShadows, useGLTF } from '@react-three/drei';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import * as THREE from 'three';
import { MODEL_URL, HDRI_URL } from '../config/carConfig';
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
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // Push the baked clearcoat paint material as close to real
        // automotive paint as this asset allows: tighter, glossier
        // clearcoat and a stronger reaction to the HDRI so reflections
        // read as sharp highlights rather than a flat sheen. This is the
        // ceiling for "realistic" here — there's no separate tire/glass/
        // trim geometry in this mesh (confirmed earlier by dumping every
        // mesh's bounding box: each one spans the car's full width, so
        // there's no isolated part to give its own material), so the paint
        // material is genuinely the only lever available.
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        if (mat?.isMeshPhysicalMaterial) {
          mat.roughness = 0.18;
          mat.clearcoat = 1;
          mat.clearcoatRoughness = 0.03;
          mat.envMapIntensity = 1.4;
        }
      }
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
      shadows
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
