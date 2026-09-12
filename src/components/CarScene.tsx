import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import type { Box3, Object3D, PerspectiveCamera } from 'three';
import CarSceneErrorBoundary from './CarSceneErrorBoundary';
import './CarScene.css';

// Lazy-loaded: 'three' + @react-three/fiber + drei are by far the heaviest
// dependency on this page, so the whole Canvas subtree is split into its own
// chunk — the same reason the old Spline version lazy-loaded
// @splinetool/react-spline.
const CarSceneCanvas = lazy(() => import('./CarSceneCanvas'));

// Generous on purpose — the hero glb is ~8MB and GLTFLoader has to parse
// 222k triangles of it client-side, which can genuinely take longer than a
// typical "did the request hang" timeout on a slow connection/device. This
// used to be 15s and that turned out to be too tight — it fired even on a
// successful, still-in-progress load and tore the whole Canvas down.
const LOAD_TIMEOUT_MS = 45000;

export interface CarSceneHandle {
  camera: PerspectiveCamera;
  model: Object3D;
  /** Car's own bounding box in world space, computed once after load — the
   * basis for every camera waypoint (see ScrollExperience.tsx). */
  box: Box3;
}

interface CarSceneProps {
  /** Called once with the live camera + loaded model after the glb is in the scene. */
  onReady: (handle: CarSceneHandle) => void;
}

export default function CarScene({ onReady }: CarSceneProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => setLoadFailed(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeoutRef.current);
  }, []);

  const handleReady = (handle: CarSceneHandle) => {
    clearTimeout(timeoutRef.current);
    setLoaded(true);
    onReady(handle);
  };

  const handleError = () => {
    clearTimeout(timeoutRef.current);
    setLoadFailed(true);
  };

  return (
    <div className="car-scene" aria-hidden="true">
      {!loadFailed && (
        <CarSceneErrorBoundary fallback={null} onError={handleError}>
          <Suspense fallback={null}>
            <CarSceneCanvas onReady={handleReady} />
          </Suspense>
        </CarSceneErrorBoundary>
      )}

      {!loaded && (
        <div className={`car-scene__placeholder ${loadFailed ? 'is-fallback' : ''}`}>
          {loadFailed ? (
            <p className="car-scene__error">Couldn't load the 3D preview — try refreshing the page.</p>
          ) : (
            <div className="car-scene__spinner" />
          )}
        </div>
      )}
    </div>
  );
}
