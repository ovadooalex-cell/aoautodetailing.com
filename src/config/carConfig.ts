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
 * Distances are NOT monotonic anymore. For most of this rebuild the rule was
 * "never zoom out, only in" (the single most repeated requirement at the
 * time), which is what pushed paint/front-end/wheels down to 0.6/0.58/0.4
 * and the reveal to 0.28 — and once the whole thing was actually scrolled
 * through at desktop size, that turned out to be too tight: the close-ups
 * showed slivers of panel instead of the car, and the finale was an abstract
 * wall of blue paint. The user then explicitly asked for those stages to
 * pull back and for the ending to show the entire car, so that rule is
 * retired on purpose: paint/front-end/wheels sit at a "see the car, not
 * just a panel" distance, and the reveal is the widest shot of all.
 *
 * Story order is still paint → hood → wheel (not the wheel → hood order
 * the original brief listed). That was originally forced by the grille
 * needing more room than a wheel shot; the user has since seen and
 * approved this order, so it stays.
 *
 * `azimuthDeg`, front-end's especially, was tuned against real renders
 * with an interactive free-fly tool (since removed), not picked
 * analytically — a near-dead-on angle at 0° turned out to be aimed at the
 * wheel arch, not the grille; the actual dead-on-front angle is close to
 * -14°/346°.
 */
export const STAGE_POSE: Record<Exclude<StageId, 'exterior'>, OrbitPoseParams> = {
  hero: { azimuthDeg: 35, elevationFrac: 0.32, distanceFrac: 1.5, targetHeightFrac: 0.4 },
  'side-body': { azimuthDeg: 90, elevationFrac: 0.24, distanceFrac: 1.5, targetHeightFrac: 0.3, targetOffsetFrac: 0.05 },
  'front-end': { azimuthDeg: -18, elevationFrac: 0.3, distanceFrac: 1.25, targetHeightFrac: 0.2, targetOffsetFrac: 0.18 },
  wheels: { azimuthDeg: 130, elevationFrac: 0.14, distanceFrac: 1.05, targetHeightFrac: 0.15, targetOffsetFrac: -0.25 },
  reveal: { azimuthDeg: 35, elevationFrac: 0.42, distanceFrac: 1.6, targetHeightFrac: 0.28 },
};

/**
 * Where the car sits in the frame, as fractions of the canvas, desktop only
 * (on mobile the layout stacks the scene above the text, so there's nothing
 * to dodge). `x`: positive = car slides LEFT. `y`: positive = car slides DOWN.
 *   - hero: car slides right, clear of the big left-aligned headline (before
 *     this, the headline was printed straight across the car).
 *   - panel: while an info card is on the right, the car sits in the left
 *     part of the frame instead of underneath the card — the original
 *     brief's "truck on the left, service card on the right".
 *   - reveal: centered horizontally and dropped below the finale headline,
 *     so the whole car is visible instead of hidden behind the text.
 */
export const VIEW_SHIFT = {
  hero: { x: -0.2, y: 0 },
  panel: { x: 0.17, y: 0 },
  reveal: { x: -0.04, y: 0.31 },
};

/** The "exterior" stage sweeps continuously from one azimuth to another, at a held elevation/distance — a real orbit, not a jump between two shots. Distance (1.3) sits between hero's 1.5 and side-body's 1.5 — a touch closer than both, so the orbit reads as a slow push-in that then settles back out slightly to frame the whole flank next to the info card. */
export const ORBIT_STAGE = {
  azimuthStartDeg: 35,
  azimuthEndDeg: 90,
  elevationFrac: 0.3,
  distanceFrac: 1.3,
  targetHeightFrac: 0.35,
};
