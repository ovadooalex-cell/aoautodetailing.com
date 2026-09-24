import { useEffect, useState } from 'react';

/** The site's own mobile-layout breakpoint (900px, used throughout the CSS)
 * plus a touch/coarse-pointer check — catches tablets that are wider than
 * that (an iPad in landscape is ~1024px) but still have phone-class GPUs. */
const QUERY = '(max-width: 900px), (pointer: coarse)';

/**
 * True on phones/tablets. Drives a stripped-down render path for the 3D
 * scene (see CarSceneCanvas.tsx) — no HDRI download/reflections, no
 * shadows, capped device pixel ratio, flat paint instead of the real
 * per-part textures. The full experience was genuinely heavy (~14MB of
 * glb + textures, another 5.6MB HDRI, real-time shadow maps, up to 1.75x
 * device pixel ratio) — fine on a desktop GPU, a slow first load and a
 * choppy scroll on an actual phone. Traded for speed on purpose, live by
 * live here rather than guessed once and left: this is a live media query,
 * so rotating a tablet or resizing past 900px switches it immediately.
 */
export function useLightweightScene(): boolean {
  const [lightweight, setLightweight] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setLightweight(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return lightweight;
}
