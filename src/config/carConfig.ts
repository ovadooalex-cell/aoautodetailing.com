/**
 * ============================================================================
 * CAR SCENE CONFIGURATION — Three.js / React Three Fiber, replacing the old
 * Spline-based setup (splineConfig.ts, removed). See ScrollExperience.tsx for
 * how these are consumed.
 * ============================================================================
 *
 * WHY THIS EXISTS
 * ----------------
 * The hero vehicle is `public/models/porsche/porsche.glb` — a decimated
 * (1.68M → ~222k triangles, via three.js's meshoptimizer-based
 * SimplifyModifier) export of a user-supplied high-detail FBX, repainted in
 * AO's brand color (no usable paint/texture data existed in any of the
 * source files — confirmed directly, not assumed). Full history: the site
 * originally used a Spline-hosted scene of a Dodge Charger; the user then
 * asked for a truck; several free/CC0 and user-supplied assets were dead
 * ends (wrong vehicle, no textures, 3ds Max viewport wire colors mistaken
 * for paint) before landing on this one, explicitly approved by the user.
 *
 * NO NAMED SUB-PARTS
 * -------------------
 * Unlike the old Spline scene (which had real `Wheel_FL`/`Wheel_FR`/etc.
 * objects and hand-placed `CamAnchor_*` waypoints), this FBX's 31 meshes are
 * all generically named (`Obj3d66-19917843-N-count`) with no per-part
 * semantics — confirmed by dumping each mesh's bounding box: there's no
 * isolated wheel geometry to target or spin independently. So:
 *   - Camera waypoints here are computed purely from the car's overall
 *     bounding box (computed at runtime after load — see `orbitPose` in
 *     ScrollExperience.tsx), as fractions of its size, the same
 *     "measure, don't guess" approach that fixed the old Spline camera bugs.
 *   - There is no wheel-spin animation in this rebuild — there's no wheel
 *     object to spin. If a future asset has isolated wheel meshes, that
 *     capability can come back.
 *
 * AZIMUTH CONVENTION
 * -------------------
 * `azimuthDeg` orbits around the car's vertical (Y) axis: ~-14°/346° is
 * dead-on front (grille facing the camera — not exactly 0°; verified with
 * an interactive free-fly tool against the real loaded model, not assumed),
 * 90°/-90° are the left/right flanks, 180° is the rear.
 */

export type StageId = 'hero' | 'exterior' | 'side-body' | 'front-end' | 'wheels' | 'reveal';

export const MODEL_URL = '/models/porsche/porsche.glb';
export const HDRI_URL = '/models/hdri/studio.exr';

/**
 * The car's paint color, applied at runtime in CarSceneCanvas.tsx (this
 * constant used to just sit here unused — the color actually came from
 * whatever was baked into porsche.glb at export time; fixed so there's one
 * real source of truth).
 *
 * A vivid mid blue, matched by eye against the reference photos the user
 * supplied of a real Porsche 911 — approximating their car's paint color,
 * not copying anything about the reference itself (no badges, plates, or
 * other identifying marks exist on this asset to begin with). AO's brand
 * brass/tan (index.css --color-accent, '#c9973f') was the color here for
 * most of this project; kept as a comment in case of a future revert.
 */
export const PAINT_COLOR = '#2f97d4';

export interface OrbitPoseParams {
  /** Degrees around the car's Y axis — 0 = dead-on front, 90 = right flank, 180 = rear. */
  azimuthDeg: number;
  /** Camera height as a fraction of the car's own height. */
  elevationFrac: number;
  /** Camera distance from the car's center, as a fraction of its longest horizontal extent. */
  distanceFrac: number;
  /** Look-at target height, as a fraction of the car's height. */
  targetHeightFrac: number;
  /** Look-at target's lateral/depth offset from center, as a fraction of the car's length — 0 = centered. Used to aim at a specific panel (a door, the hood) rather than the car's geometric middle. */
  targetOffsetFrac?: number;
}

/**
 * Fixed-waypoint stages — camera holds one computed pose. `exterior` isn't
 * here: it's a continuous orbit sweep (see ORBIT_STAGE below), matching the
 * brief ("camera smoothly begins to orbit/rotate as the user scrolls").
 *
 * `distanceFrac` is non-increasing down this list — hero(1.3) → orbit(1.15,
 * below) → side-body(0.6) → front-end(0.58) → wheels(0.4) → reveal(0.28) —
 * on purpose: "never zoom out, only in" was the single most repeated
 * requirement across this whole rebuild, so it's enforced directly in these
 * numbers rather than left to hope.
 *
 * Story order here is paint → hood → wheel, not the wheel → hood order the
 * brief originally listed — swapped deliberately. The grille needs
 * noticeably more room to read as a grille (an almost-flat, near-dead-on
 * shot goes abstract below ~0.55) than a wheel close-up does (reads great
 * even at 0.4); keeping wheel → hood in the original order would have meant
 * either a real zoom-out on that transition, or an unreadable grille. This
 * way both constraints hold.
 *
 * `azimuthDeg`, front-end's especially, was tuned against real renders
 * with an interactive free-fly tool (FrontEndFinder.tsx, since removed),
 * not picked analytically — a near-dead-on angle at 0° turned out to be
 * aimed at the wheel arch, not the grille, at this distance; the actual
 * dead-on-front angle is close to -14°/346°. `azimuthDeg` also keeps each
 * transition rotating rather than snapping back where practical: hero(35)
 * → orbit sweeps 35→90 → side-body(90, exactly where the orbit ends — no
 * jump) → front-end(-14, a repositioning cut, not a sweep) → wheels(130,
 * another cut) → reveal(35, echoing hero for a clean bookend).
 */
export const STAGE_POSE: Record<Exclude<StageId, 'exterior'>, OrbitPoseParams> = {
  hero: { azimuthDeg: 35, elevationFrac: 0.32, distanceFrac: 1.3, targetHeightFrac: 0.4 },
  'side-body': { azimuthDeg: 90, elevationFrac: 0.22, distanceFrac: 0.6, targetHeightFrac: 0.28, targetOffsetFrac: 0.08 },
  'front-end': { azimuthDeg: -14, elevationFrac: 0.32, distanceFrac: 0.58, targetHeightFrac: 0.14 },
  wheels: { azimuthDeg: 130, elevationFrac: 0.1, distanceFrac: 0.4, targetHeightFrac: 0.12, targetOffsetFrac: -0.28 },
  reveal: { azimuthDeg: 35, elevationFrac: 0.3, distanceFrac: 0.28, targetHeightFrac: 0.36 },
};

/** The "exterior" stage sweeps continuously from one azimuth to another, at a held elevation/distance — a real orbit, not a jump between two shots. Distance (1.15) sits strictly between hero's 1.3 and side-body's 0.6. */
export const ORBIT_STAGE = {
  azimuthStartDeg: 35,
  azimuthEndDeg: 90,
  elevationFrac: 0.3,
  distanceFrac: 1.15,
  targetHeightFrac: 0.35,
};
