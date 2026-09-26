import * as THREE from 'three';
import { DDSLoader } from 'three/examples/jsm/loaders/DDSLoader.js';
import { getCamoTexture } from './camoTexture';

/**
 * Turns the Tacoma glb's ~120 original .mtl material names into real
 * three.js materials at runtime — the truck's counterpart to the Porsche's
 * mesh-index table, but keyed by name instead of traversal position, because
 * this source file (unlike the Porsche's) actually names its materials
 * meaningfully. See CarSceneCanvas.tsx's Model() for how this gets applied;
 * see the source .mtl (not shipped — only used during the one-time asset
 * conversion) for where these numbers came from.
 *
 * About half this pack's materials DO have real diffuse textures (the other
 * half — paint, tires, glass, the headlight/taillight lenses, the grille
 * shell — are genuinely flat Kd-only in the source, nothing to load), and
 * the user asked to use them rather than keep guessing flat colors. Those
 * textures are real GPU-compressed .dds files (S3TC/DXT — made for a game
 * engine, not authored for the web), copied as-is into
 * public/models/tacoma/textures/ and loaded directly via three's DDSLoader
 * (no re-encoding — there's no image tool on this machine that can decode
 * DXT blocks to re-save them as PNG). Most desktop browsers support the
 * WEBGL_compressed_texture_s3tc extension this needs; a meaningful slice of
 * mobile GPUs don't. `supportsCompressedTextures` (computed once from the
 * live renderer in CarSceneCanvas.tsx) gates this: where it's false, or a
 * given material has no texture in the source, this falls back to the same
 * flat physically-plausible color it always used.
 */

/**
 * Real Kd (diffuse base color) values read directly out of the source .mtl
 * for every material name that has one. Materials that are texture-only in
 * the source (no Kd line at all) are absent here and fall through to
 * `colorFromName` below.
 */
const KD: Record<string, [number, number, number]> = {
  Material: [0.8, 0.8, 0.8],
  'Material.001': [0.8, 0.8, 0.8],
  'Material.002': [0.8, 0.8, 0.8],
  'Material.003': [0.8, 0.262029, 0.06102],
  'Material.004': [0.005604, 0.005604, 0.005604],
  'Material.005': [0.007193, 0.007193, 0.007193],
  'Material.007': [0.77427, 0.77427, 0.77427],
  'Material.009': [0.8, 0.8, 0.8],
  'Material.065': [0.72304, 0.72304, 0.72304],
  'Material.067': [0.007193, 0.007193, 0.007193],
  glass: [0.8, 0.8, 0.8],
  glass_light: [0.8, 0.8, 0.8],
  'glass_light.001': [0.8, 0.8, 0.8],
  kieng_den_1: [0.8, 0.8, 0.8],
  kieng_den_sau: [0.27383, 0.00227, 0.002799],
  kieng_xe: [0.073235, 0.073235, 0.073235],
  kienggg: [0.233013, 0.233013, 0.233013],
  nhua_bong_: [0.020379, 0.020379, 0.020379],
  nhuaa: [0.011087, 0.011087, 0.011087],
  oc: [0.517332, 0.517332, 0.517332],
  'oc.001': [0.517332, 0.517332, 0.517332],
  reflector_bump: [0.8, 0.8, 0.8],
  'rgba1717gray.001': [0.8, 0.8, 0.8],
  son_xe: [1, 1, 1],
  'son_xe.001': [1, 1, 1],
  vang: [0.8, 0.335502, 0],
};
// Material.013 – Material.063 (the tire family, see TIRE_RANGE below) are
// all a near-black 0.01–0.03 in the source and are handled by that range
// check instead of individual entries here.

/**
 * Original material name → its diffuse texture's filename in
 * public/models/tacoma/textures/, for every material that actually has one
 * (read straight out of the .mtl's `map_Kd` lines). Several different names
 * share the same file (e.g. every `black1717171.*` variant is the same
 * `black1717171.dds`) — that's the source pack's own doing, not a mistake
 * here, and it's *why* the loader below caches by filename rather than by
 * material name: those variants can safely share one loaded texture.
 *
 * Excludes materials that only exist on cut content (the light bar, the
 * interior, badge decals — see carConfig.ts) and `black1717171.002`'s
 * spec map, `dinghyblack_spec.dds`, which wasn't in the file set the user
 * provided; that one material still gets its (shared) diffuse texture, just
 * no spec map — spec maps aren't used by this loader anyway (see below).
 */
const DIFFUSE_TEXTURE_FILES: Record<string, string> = {
  amber_plastic: 'amber_plastic.dds',
  'black1717171.001': 'black1717171.dds',
  'black1717171.002': 'black1717171.dds',
  'black1717171.003': 'black1717171.dds',
  'black1717171_[SECONDARY]': 'black1717171.dds',
  'black1717171_[SECONDARY].001': 'black1717171.dds',
  'black1717171_[SECONDARY].002': 'black1717171.dds',
  'black_dark.001': 'black_dark.dds',
  'black_dark.002': 'black_dark.dds',
  'black_dark.003': 'black_dark.dds',
  'black_dark.004': 'black_dark.dds',
  'black_dark.005': 'black_dark.dds',
  carbon: 'carbon.dds',
  chrome: 'chrome.dds',
  engi_tac: 'engi_tac.dds',
  grille3_diff: 'Grille3_diff.dds',
  'rgba171717ff': 'rgba171717ff.dds',
  'rgba171717ff.001': 'rgba171717ff.dds',
  'rgba1717dark.001': 'rgba1717dark.dds',
  'rgba1717dark.002': 'rgba1717dark.dds',
  'rgba1717dark.003': 'rgba1717dark.dds',
  'rgba1717dark.004': 'rgba1717dark.dds',
  'rgba1717dark.005': 'rgba1717dark.dds',
  rgbab60000ff_drk: 'rgbab60000ff_drk.dds',
  'rgbab60000ff_drk.002': 'rgbab60000ff_drk.dds',
  'rgbab60000ff_drk.003': 'rgbab60000ff_drk.dds',
  'rgbab60000ff_drk.004': 'rgbab60000ff_drk.dds',
  'rgbab60000ff_drk.005': 'rgbab60000ff_drk.dds',
  'rgbab60000ff_drk.006': 'rgbab60000ff_drk.dds',
  'rgbab60000ff_drk.007': 'rgbab60000ff_drk.dds',
  'rgbab60000ff_drk.008': 'rgbab60000ff_drk.dds',
  'rgbab60000ff_drk.009': 'rgbab60000ff_drk.dds',
  rgbab6b6b6ff_dark: 'rgbab6b6b6ff_DARK.dds',
  // veh_lits.dds is deliberately NOT listed here — see the note on `litLens`
  // below: 5.6MB of the site's ~14MB of textures for a couple of small
  // reverse-light/plate-light lenses was a bad trade even on desktop.
  vehicle_generic_detail2: 'vehicle_generic_detail2.dds',
  'vehicle_generic_doorshut_[PRIMARY]': 'vehicle_generic_doorshut.dds',
  'vehicle_generic_smallspecmap_[INTERIOR_TRIM]': 'vehicle_generic_smallspecmap.dds',
  wheel2a_diff: 'Wheel2A_diff.dds',
  'wheel2a_diff.001': 'Wheel2A_diff.dds',
  'wheel2a_diff.004': 'Wheel2A_diff.dds',
  'wheel2a_diff.005': 'Wheel2A_diff.dds',
  'wheel2a_diff.006': 'Wheel2A_diff.dds',
  'wheel2a_diff.007': 'Wheel2A_diff.dds',
  'wheel2a_diff.008': 'Wheel2A_diff.dds',
  'wheel2a_diff.009': 'Wheel2A_diff.dds',
  'wheel2a_diff.010': 'Wheel2A_diff.dds',
  'wheel2a_diff.011': 'Wheel2A_diff.dds',
  'wheel2a_diff.012': 'Wheel2A_diff.dds',
  'wheel2a_diff.013': 'Wheel2A_diff.dds',
};

const rgbToHex = ([r, g, b]: [number, number, number]) =>
  '#' +
  [r, g, b]
    .map((c) => Math.round(THREE.MathUtils.clamp(c, 0, 1) * 255).toString(16).padStart(2, '0'))
    .join('');

/**
 * A good few dozen of this pack's texture-only materials are literally named
 * after their own hex color (an in-game "paintable slot" convention) —
 * `rgbab60000ff_drk` decodes to `#b60000`, `rgba171717ff` to `#171717`, and
 * so on. Extracting that beats guessing: "rgba" + 6 hex digits + optional
 * alpha, followed by a real boundary (so `rgba1717dark` — 4 hex digits then
 * the literal word "dark" — does NOT get misread as 6 hex digits "1717da").
 * Still used as the fallback tint for a material's flat color when its
 * texture isn't loaded (unsupported hardware, or one with none at all).
 */
function hexFromName(name: string): string | null {
  const m = /^rgba?([0-9a-f]{6})(?:ff)?(?=[_.]|$)/i.exec(name);
  return m ? `#${m[1].toLowerCase()}` : null;
}

/** Last-resort color when a name has neither a real Kd nor an encoded hex —
 * goes by keywords the source names actually use. */
function colorFromName(name: string): string {
  const hex = hexFromName(name);
  if (hex) return hex;
  const lower = name.toLowerCase();
  if (lower.includes('dark') || lower.includes('black')) return '#161616';
  if (lower.includes('gray') || lower.includes('grey')) return '#7d7d7d';
  const kd = KD[name];
  if (kd) return rgbToHex(kd);
  return '#2a2a2a';
}

const TIRE_RANGE_START = 13;
const TIRE_RANGE_END = 63;
/** True for `Material.013`…`Material.063` — every numbered material actually
 * used on a wheel, all a near-black 0.01–0.03 Kd in the source (confirmed by
 * reading the .mtl, not by the range alone — the numbered materials outside
 * this span belong to unrelated parts like mirror caps and grille plastic). */
function isTireMaterial(name: string): boolean {
  const m = /^Material\.0(\d\d)$/.exec(name);
  if (!m) return false;
  const n = Number(m[1]);
  return n >= TIRE_RANGE_START && n <= TIRE_RANGE_END;
}

/** Wheel-family instances of the "#b60000 dark red" material — the brake
 * calipers, one set per wheel copy. The SAME hex family also shows up on the
 * bonnet, the grille surround, and the suspension arms (`.002`), and on a
 * strip near the tailgate (`.003`) — those are large, mundane body/trim
 * panels where a bright red would look like a paint defect, not styling, so
 * they're deliberately excluded here and fall through to the neutral-trim
 * default (now textured — see DIFFUSE_TEXTURE_FILES — rather than the red
 * a blind hex decode would give them). */
const CALIPER_MATERIAL_NAMES = new Set([
  'rgbab60000ff_drk',
  'rgbab60000ff_drk.004',
  'rgbab60000ff_drk.005',
  'rgbab60000ff_drk.006',
  'rgbab60000ff_drk.007',
  'rgbab60000ff_drk.008',
  'rgbab60000ff_drk.009',
]);

export interface MaterialResolverOptions {
  /** Where the copied .dds files live, e.g. '/models/tacoma/textures/'. */
  texturesBaseUrl: string;
  /** From `gl.extensions.has('WEBGL_compressed_texture_s3tc')` — false skips
   * all texture loading and keeps every material on its flat fallback color. */
  supportsCompressedTextures: boolean;
  /** Phones/tablets (see useLightweightScene). `transmission` (real glass
   * refraction — windshield, side glass, headlight/taillight lenses) makes
   * three.js render an extra full-scene pass into an offscreen buffer every
   * frame so it can sample what's behind the surface — one of the most
   * expensive single features a WebGL renderer can be asked for, and paid
   * every frame regardless of triangle count. When true, those materials
   * fall back to ordinary alpha-blended transparency instead — cheaper by a
   * whole render pass, and visually close enough for small window/lens
   * panels that were never the focal point of any camera stage. */
  cheapTransmission: boolean;
}

interface FlatParams {
  color: string;
  metalness?: number;
  roughness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  transmission?: number;
  thickness?: number;
  ior?: number;
  envMapIntensity?: number;
  transparent?: boolean;
  opacity?: number;
}

/**
 * Builds a `(materialName) => THREE.Material` lookup, backed by one shared
 * instance per resolved appearance (not per name) so, e.g., every black-trim
 * variant reuses the same material instead of allocating ~30 near-identical
 * ones — and, where a real texture exists, every name that shares one file
 * shares one textured material too.
 */
export function createVehicleMaterialResolver({
  texturesBaseUrl,
  supportsCompressedTextures,
  cheapTransmission,
}: MaterialResolverOptions) {
  const cache = new Map<string, THREE.Material>();
  const shared = (key: string, build: () => THREE.Material) => {
    let mat = cache.get(key);
    if (!mat) {
      mat = build();
      cache.set(key, mat);
    }
    return mat;
  };

  // Same "why" as `glassLike` below — any FlatParams that carries
  // `transmission` (the amber/red indicator lenses, routed through `build()`
  // or built directly rather than through `glassLike`) gets the same cheap
  // swap on mobile.
  const cheapenTransmission = (params: FlatParams): FlatParams => {
    if (!cheapTransmission || params.transmission === undefined) return params;
    const { transmission, thickness: _thickness, ior: _ior, ...rest } = params;
    return { ...rest, transparent: true, opacity: 1 - transmission * 0.75 };
  };

  const ddsLoader = new DDSLoader();
  const textureCache = new Map<string, THREE.CompressedTexture>();
  const loadDiffuseTexture = (file: string) => {
    let tex = textureCache.get(file);
    if (!tex) {
      // DDSLoader.load() (no callback) returns the Texture synchronously and
      // fills it in once the (async) request resolves — the standard
      // three.js loader pattern also used for this scene's HDRI.
      tex = ddsLoader.load(texturesBaseUrl + file);
      tex.colorSpace = THREE.SRGBColorSpace;
      textureCache.set(file, tex);
    }
    return tex;
  };

  /**
   * The shared building block every category below goes through: build a
   * MeshPhysicalMaterial from `params`, and — when this material name has a
   * real texture and the hardware can display it — swap `params.color` for
   * the loaded diffuse map instead. Caches by texture file when textured
   * (so every name sharing that file shares the material) or by the flat
   * color otherwise (so, e.g., two different near-black fallbacks collapse
   * into one material too).
   */
  const build = (categoryKey: string, name: string, rawParams: FlatParams): THREE.Material => {
    const params = cheapenTransmission(rawParams);
    const file = DIFFUSE_TEXTURE_FILES[name];
    if (file && supportsCompressedTextures) {
      return shared(`tex:${file}`, () => new THREE.MeshPhysicalMaterial({ ...params, map: loadDiffuseTexture(file) }));
    }
    return shared(`${categoryKey}:${params.color}`, () => new THREE.MeshPhysicalMaterial(params));
  };

  // Same physical parameters as the Porsche build, tuned against the same
  // reference photos — kept identical on purpose so a paint-color change in
  // carConfig.ts still looks the same way it always has. Paint has no
  // texture in the source (the game applied color separately), so this
  // never goes through `build()`.
  // Camo (see camoTexture.ts) replaces the old flat `paintColor` — kept as a
  // parameter on MaterialResolverOptions rather than removed, in case a solid
  // color is ever wanted again. `color: '#ffffff'` lets the texture's own
  // colors show unmodified (a tinted base would muddy them); every panel
  // sharing this one texture/material instance is why a camo repaint doesn't
  // cost anything extra per additional body panel.
  const paint = () =>
    shared('__paint', () => new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      map: getCamoTexture(),
      metalness: 0.45,
      roughness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.5,
    }));
  // Real `transmission` params vs. the `cheapTransmission` (mobile) fallback
  // for the same visual role — see the option's doc comment on why this
  // split exists. The fallback keeps color/metalness/roughness/envMapIntensity
  // and swaps refraction for plain alpha blending; `transmission` maps to a
  // roughly comparable opacity (glass at 0.8 transmission ~ 92% see-through,
  // so opacity 0.35 rather than a literal `1 - transmission`, which would
  // read as far too solid).
  const glassLike = (
    key: string,
    { transmission, thickness, ior, ...rest }: { color: string; metalness: number; roughness: number; transmission: number; thickness: number; ior: number; envMapIntensity: number },
  ) =>
    shared(key, () =>
      cheapTransmission
        ? new THREE.MeshPhysicalMaterial({ ...rest, transparent: true, opacity: 1 - transmission * 0.75 })
        : new THREE.MeshPhysicalMaterial({ ...rest, transmission, thickness, ior }),
    );
  const glass = () =>
    glassLike('__glass', {
      color: '#141b21',
      metalness: 0,
      roughness: 0.03,
      transmission: 0.8,
      thickness: 0.15,
      ior: 1.5,
      envMapIntensity: 1.3,
    });
  // Clear plastic lens (headlight housings) — distinct from the tinted cabin
  // glass above; these should read bright, not dark. No texture in the
  // source for this one (`kieng_den_1`).
  const lens = () =>
    glassLike('__lens', {
      color: '#f0f0ee',
      metalness: 0,
      roughness: 0.08,
      transmission: 0.4,
      thickness: 0.05,
      ior: 1.45,
      envMapIntensity: 1.2,
    });
  // Reverse-light / plate-light lens — same look as the headlight lens
  // above. `veh_lits` did have a real texture in the source, but at 5.6MB
  // for a couple of small lenses it wasn't worth shipping (see
  // DIFFUSE_TEXTURE_FILES); still routed through `build()` rather than
  // folded into `lens()` in case that math changes for some other name.
  const litLens = (name: string) => build('litLens', name, { color: '#f0f0ee', metalness: 0, roughness: 0.12 });
  const chrome = (name: string) => build('chrome', name, { color: '#d8d8da', metalness: 1, roughness: 0.06 });
  const rim = (name: string) => build('rim', name, { color: '#2b2b30', metalness: 0.6, roughness: 0.5 });
  const tire = () =>
    shared('__tire', () => new THREE.MeshPhysicalMaterial({
      color: '#181818',
      metalness: 0,
      roughness: 0.55,
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
      envMapIntensity: 0.8,
    }));
  const caliper = () =>
    shared('__caliper', () => new THREE.MeshPhysicalMaterial({
      color: '#b3161c',
      metalness: 0.25,
      roughness: 0.35,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    }));
  // `vang` (no texture) and `amber_plastic` (has one) are the same visual
  // role — an amber indicator lens — so they share this one builder too.
  const amberLens = (name: string) =>
    build('amberLens', name, { color: '#ffb020', metalness: 0, roughness: 0.15, transmission: 0.35, ior: 1.45 });
  const redLens = () =>
    shared('__redLens', () => new THREE.MeshPhysicalMaterial(cheapenTransmission({
      color: '#8a0f10',
      metalness: 0,
      roughness: 0.15,
      transmission: 0.35,
      ior: 1.45,
    })));
  const trim = (name: string) => build('trim', name, { color: colorFromName(name), metalness: 0.15, roughness: 0.6 });

  return function resolve(name: string): THREE.Material {
    if (name === 'son_xe' || name === 'son_xe.001') return paint();
    if (name === 'chrome') return chrome(name);
    if (name === 'glass' || name.startsWith('glass_light') || name === 'kieng_xe') return glass();
    if (name === 'kieng_den_1') return lens();
    if (name === 'veh_lits') return litLens(name);
    if (name === 'vang' || name === 'amber_plastic') return amberLens(name);
    if (name === 'kieng_den_sau') return redLens();
    if (name.startsWith('wheel2a_diff')) return rim(name);
    if (isTireMaterial(name)) return tire();
    if (CALIPER_MATERIAL_NAMES.has(name)) return caliper();
    return trim(name);
  };
}
