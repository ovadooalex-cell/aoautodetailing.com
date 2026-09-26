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
 * Layered like a real printed camo, not one pass of flat shapes: big soft
 * "macro" blotches for the base pattern, smaller soft blotches on top for
 * mid-level detail, then a fine grain pass so no single blotch reads as a
 * flat, obviously-computer-generated fill.
 *
 * Cost: one 1024x1024 canvas draw at first use, cached — not a per-frame or
 * per-material cost, and no network download (unlike the real .dds textures
 * this replaces), so it's cheap enough to use on both the mobile and desktop
 * render paths rather than being gated behind useLightweightScene.
 */
const CAMO_COLORS = ['#232a17', '#3f4a2b', '#6b6144', '#171a12'];
const CAMO_SIZE = 1024;

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * A soft-edged organic blotch: `ctx.filter = 'blur(...)'` feathers the edge
 * (real camo, even printed/laminated onto vinyl, doesn't have knife-sharp
 * color boundaries), and quadratic curves through the midpoints between
 * randomized-radius vertices round the silhouette instead of the faceted,
 * gem-like outline straight `lineTo` segments give.
 */
function drawBlob(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, rand: () => number, blur: number) {
  const points = 16;
  const verts: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const radius = r * (0.65 + rand() * 0.7);
    verts.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }

  ctx.save();
  ctx.filter = blur > 0 ? `blur(${blur}px)` : 'none';
  ctx.fillStyle = color;
  ctx.beginPath();
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(verts[points - 1], verts[0]);
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < points; i++) {
    const next = verts[(i + 1) % points];
    const m = mid(verts[i], next);
    ctx.quadraticCurveTo(verts[i][0], verts[i][1], m[0], m[1]);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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

  // Macro pass: the big blotches that read from a distance.
  for (let i = 0; i < 22; i++) {
    const color = CAMO_COLORS[1 + Math.floor(rand() * (CAMO_COLORS.length - 1))];
    drawBlob(ctx, rand() * CAMO_SIZE, rand() * CAMO_SIZE, 90 + rand() * 150, color, rand, 6);
  }
  // Mid pass: smaller blotches breaking up the macro shapes' interiors and
  // seams, the way a real multi-color pattern layers instead of leaving
  // each big blotch a single flat field.
  for (let i = 0; i < 55; i++) {
    const color = CAMO_COLORS[Math.floor(rand() * CAMO_COLORS.length)];
    drawBlob(ctx, rand() * CAMO_SIZE, rand() * CAMO_SIZE, 25 + rand() * 55, color, rand, 3);
  }
  // Fine grain: hundreds of tiny low-alpha specks so no patch of color reads
  // as a perfectly flat computer-generated fill up close.
  for (let i = 0; i < 4000; i++) {
    const color = CAMO_COLORS[Math.floor(rand() * CAMO_COLORS.length)];
    ctx.globalAlpha = 0.05 + rand() * 0.12;
    ctx.fillStyle = color;
    const s = 1 + rand() * 2.5;
    ctx.fillRect(rand() * CAMO_SIZE, rand() * CAMO_SIZE, s, s);
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  cached = texture;
  return texture;
}
