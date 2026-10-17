import { useEffect, useState } from 'react';

/** The site's own mobile-layout breakpoint (900px, used throughout the CSS)
 * plus a touch/coarse-pointer check — catches tablets that are wider than
 * that (an iPad in landscape is ~1024px) but still have phone-class GPUs. */
export const COMPACT_LAYOUT_QUERY = '(max-width: 900px), (pointer: coarse)';

/**
 * True when the viewport is phone/tablet-shaped. Drives both the camera
 * framing (see MOBILE_DISTANCE_SCALE in carConfig.ts) and the stripped-down
 * render path (see useLightweightScene). Live: rotating a tablet or resizing
 * past 900px switches it immediately.
 */
export function useCompactLayout(): boolean {
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(COMPACT_LAYOUT_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_LAYOUT_QUERY);
    const onChange = () => setCompact(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return compact;
}

/** Non-hook form of the render-path decision, for module-level code (the
 * model preload in CarSceneCanvas.tsx runs outside React). */
export function shouldUseLightweightScene(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(COMPACT_LAYOUT_QUERY).matches;
}

/**
 * True on phones/tablets. Drives a stripped-down render path for the 3D
 * scene (see CarSceneCanvas.tsx) — no HDRI download/reflections, no shadow
 * maps, the reduced-poly model, flat paint instead of the real per-part
 * textures. The full path is ~17MB of glb + textures + HDRI: fine over
 * desktop broadband, a slow first load on a phone connection.
 */
export function useLightweightScene(): boolean {
  return useCompactLayout();
}

/**
 * Hardware that keeps the full-quality scene but needs a cheaper way to draw
 * it. School Chromebooks are the motivating case: a wide 1366px screen with a
 * trackpad (so the layout check above rightly treats it as a desktop, and it
 * gets the desktop look), but a 2-core Celeron or MediaTek chip, 4GB of RAM
 * shared with the GPU, and an integrated GPU several times slower than a
 * typical laptop's. Only the expensive-but-invisible plumbing changes there —
 * FXAA instead of 4x MSAA, a lower resolution cap (see CarSceneCanvas.tsx) —
 * not the model, textures, reflections or shadows.
 *
 *  - ChromeOS: treated as weak outright. Managed school fleets are
 *    overwhelmingly entry-level hardware.
 *  - `deviceMemory` (Chromium only, rounded to a power of two, capped at 8):
 *    4GB or less is entry-level on any OS.
 *  - `hardwareConcurrency` of 2 or less: same story.
 *
 * `?quality=low` / `?quality=high` in the URL overrides detection — for
 * previewing the Chromebook path on a fast machine, or the reverse.
 */
function isWeakDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const override = new URLSearchParams(window.location.search).get('quality');
  if (override === 'low') return true;
  if (override === 'high') return false;
  if (/\bCrOS\b/.test(navigator.userAgent)) return true;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (memory !== undefined && memory <= 4) return true;
  if (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 2) return true;
  return false;
}

/** Evaluated once — hardware doesn't change mid-session. */
export const IS_WEAK_DEVICE = isWeakDevice();
