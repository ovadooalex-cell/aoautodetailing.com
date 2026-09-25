/**
 * ============================================================================
 * CAR SCENE CONFIGURATION — Three.js / React Three Fiber, replacing the old
 * Spline-based setup (splineConfig.ts, removed). See ScrollExperience.tsx for
 * how these are consumed.
 * ============================================================================
 *
 * WHY THIS EXISTS
 * ----------------
 * The hero vehicle is `public/models/tacoma/tacoma.glb` — the second real
 * asset here (the first was a Porsche-style sports car; the user replaced it
 * outright with this truck, same site otherwise). Converted from a
 * user-supplied OBJ + MTL (a modified 2024 Tacoma TRD Pro, user-owned) via a
 * one-time Node pipeline (three's OBJLoader + mergeVertices + GLTFExporter,
 * run outside the app and not kept in the repo — only its output, the glb,
 * ships). The source file came bundled
 * with a full emergency light-bar/siren rig and a handful of badge decals;
 * per the standing "no emblems/anything copyrightable" rule, all of that —
 * the light bar, its mounts and wiring, the badge decals, the front grille
 * lettering, and the license-plate blanks — was cut at conversion time,
 * matched by material name and object name, not left in and hidden. The
 * interior was cut too (not used by any camera shot in this site, and it's
 * the one part of the source that still had an unremoved badge baked into
 * its geometry). None of that is recoverable from the shipped glb.
 *
 * PART NAMES
 * -----------
 * Unlike the old asset (31 meshes with no per-part semantics, matched by
 * traversal index), this source's ~120 original materials are genuinely
 * named (`son_xe` = body paint, `wheel2a_diff` = rim, `kieng_xe` =
 * windshield — the modeler was Vietnamese). CarSceneCanvas.tsx's Model()
 * resolves real materials by that name at runtime (see lib/vehicleMaterial.ts)
 * instead of by index — much less fragile than the old scheme, since a name
 * doesn't shift if the mesh order in the file ever changes.
 *   - Camera waypoints are still computed purely from the truck's overall
 *     bounding box (see `buildPose` in ScrollExperience.tsx), as fractions of
 *     its size — the same "measure, don't guess" approach as before.
 *   - There IS isolated wheel geometry in this asset (unlike the old one),
 *     so wheel-spin animation could be added later; not done in this pass.
 *
 * AZIMUTH CONVENTION
 * -------------------
 * `azimuthDeg` orbits around the truck's vertical (Y) axis. TODO: the
 * "~-14°/346° is dead-on front" figure below was measured against the old
 * asset's own forward axis — OBJ exports don't share a universal front-axis
 * convention, so this needs re-verifying against the truck before trusting
 * it (not yet done as of this asset swap).
 */

export type StageId = 'hero' | 'exterior' | 'side-body' | 'front-end' | 'wheels' | 'reveal';

export const MODEL_URL = '/models/tacoma/tacoma.glb';
/**
 * A decimated copy for phones/tablets (see useLightweightScene), built by a
 * one-time Node pass (GLTFLoader -> tiered SimplifyModifier -> GLTFExporter,
 * not kept in the repo — see reference-vehicle-asset-pipeline memory): big,
 * simplify-friendly meshes (the 3D tire tread, repeated per wheel; large
 * smooth body panels like the grille frame) cut to ~25% of their triangles,
 * mid-size meshes to ~45%, small detail meshes (trim, lights, mirrors) left
 * untouched. 303k triangles -> 165k (46% fewer) at roughly the same file
 * size. Built in response to the truck reading as "choppy" on a real phone
 * even after the texture/HDRI/shadow cuts below — the geometry itself was
 * still the same on mobile as desktop.
 */
export const MODEL_URL_MOBILE = '/models/tacoma/tacoma-mobile.glb';

/**
 * Every camera waypoint's `distanceFrac` (see OrbitPoseParams/STAGE_POSE
 * below) is multiplied by this on phones/tablets (see useLightweightScene).
 *
 * Why: CameraRig (CarSceneCanvas.tsx) widens the vertical FOV as the canvas
 * aspect narrows, to hold the same *horizontal* field of view across
 * desktop/mobile — but that widening is capped (MAX_FOV, 62°) to avoid a
 * fisheye look. A portrait phone's aspect is narrow enough to hit that cap
 * well before the horizontal FOV catches up to desktop's, so at the
 * distances tuned for desktop the truck read as cropped/oversized on a real
 * iPhone screenshot — "the car takes up too much space". Pulling the camera
 * back compensates directly (real product-photography technique: back up
 * instead of fisheye-ing the lens), rather than fighting it with more FOV.
 * Safe re: showing the underside — elevation is a fixed fraction of the
 * car's own height, so backing away only makes the look-down angle
 * shallower, never negative.
 *
 * 1.45 initially (matched the "too much space" complaint); brought in to
 * 1.25 after the user liked the overall look but asked to zoom in a bit more.
 */
export const MOBILE_DISTANCE_SCALE = 1.25;
export const HDRI_URL = '/models/hdri/studio.exr';
/** The truck's real per-part textures (copied straight from the source pack
 * — see lib/vehicleMaterial.ts for how and why). Not bundled into the glb
 * itself since they're loaded conditionally (compressed-texture hardware
 * support permitting). */
export const TEXTURES_URL = '/models/tacoma/textures/';

/**
 * The truck's paint color, applied at runtime in CarSceneCanvas.tsx (via
 * lib/vehicleMaterial.ts) to the `son_xe` material — real single source of
 * truth, not baked into the glb. Not something the asset itself defines: the
 * source .obj/.mtl and even the original .blend leave this material at an
 * untouched default (checked directly, down to the binary level — see
 * project memory), so there's no "real" color to inherit from the file.
 *
 * A clean off-white ("Super White"-style Toyota showroom color), matched by
 * eye against reference renders of a real white Tacoma TRD Pro the user
 * supplied — not pure #ffffff, which reads flat/plastic under the HDRI; a
 * touch of warmth keeps the clearcoat looking like real paint.
 *
 * Previously a vivid mid blue (kept as a comment in case of a future
 * revert): '#2f97d4'. Before that, AO's brand brass/tan (index.css
 * --color-accent, '#c9973f').
 */
export const PAINT_COLOR = '#f6f5f0';

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
