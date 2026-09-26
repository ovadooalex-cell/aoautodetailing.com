import * as THREE from 'three';

/**
 * Generic disruptive-blotch camo, drawn procedurally on an offscreen canvas —
 * deliberately NOT a copy of any specific named/trademarked pattern (Realtree,
 * Mossy Oak, Kryptek, Multicam, etc. are all commercial IP), same "no
 * copyrightable content" rule already applied to badges/emblems elsewhere on
 * this truck (see EMBOSSED_LETTERING_TARGETS in CarSceneCanvas.tsx). A
 * seeded PRNG keeps the pattern stable across re-renders (a fresh Math.random
 * pattern on every resize/remount would look like the paint was flickering).
 *
 * Cost: one 512x512 canvas draw at first use, cached — not a per-frame or
 * per-material cost, and no network download (unlike the real .dds textures
 * this replaces), so it's cheap enough to use on both the mobile and desktop
 * render paths rather than being gated behind useLightweightScene.
 */
const CAMO_COLORS = ['#232a17', '#3f4a2b', '#6b6144', '#171a12'];
const CAMO_SIZE = 512;

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function drawBlob(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, rand: () => number) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const points = 10;
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const radius = r * (0.7 + rand() * 0.6);
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

let cached: THREE.CanvasTexture | null = null;

/** Shared instance — every panel using the camo paint reuses one texture/canvas. */
export function getCamoTexture(): THREE.CanvasTexture {
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = CAMO_SIZE;
  canvas.height = CAMO_SIZE;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(42);

  ctx.fillStyle = CAMO_COLORS[0];
  ctx.fillRect(0, 0, CAMO_SIZE, CAMO_SIZE);
  for (let i = 0; i < 26; i++) {
    const color = CAMO_COLORS[1 + Math.floor(rand() * (CAMO_COLORS.length - 1))];
    drawBlob(ctx, rand() * CAMO_SIZE, rand() * CAMO_SIZE, 40 + rand() * 70, color, rand);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  cached = texture;
  return texture;
}
