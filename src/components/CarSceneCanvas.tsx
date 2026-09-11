import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, ContactShadows, useGLTF } from '@react-three/drei';
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
      }
    });
    const box = new THREE.Box3().setFromObject(scene);
    onReady({ camera: camera as THREE.PerspectiveCamera, model: scene, box });
  }, [scene, camera, onReady]);

  return <primitive object={scene} />;
}

export default function CarSceneCanvas({ onReady }: { onReady: (handle: CarSceneHandle) => void }) {
  return (
    <Canvas
      className="car-scene__canvas"
      shadows
      camera={{ fov: 32, near: 0.1, far: 100 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        <Model onReady={onReady} />
        <Environment files={HDRI_URL} environmentIntensity={1} />
        <directionalLight position={[4, 6, 3]} intensity={2} castShadow shadow-mapSize={[2048, 2048]} />
        <ambientLight intensity={0.3} />
        <ContactShadows position={[0, 0, 0]} opacity={0.55} scale={12} blur={2.2} far={3} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
