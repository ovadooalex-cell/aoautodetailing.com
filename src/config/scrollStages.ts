/**
 * Scroll-progress boundaries (0..1) for the single pinned master timeline.
 * Tweak these to change how much scroll distance each stage/transition gets —
 * camera tweens, info-panel swaps, and the stage rail all derive from this
 * one list.
 *
 * Simplified from an earlier 9-stage version (which included an interior
 * walkthrough) to the 6 stages the current car asset actually supports —
 * see carConfig.ts for why there's no separate interior camera move. The
 * interior detailing service itself isn't lost, it's just sold via the
 * Pricing section rather than its own 3D camera stage.
 */
export interface StageBoundary {
  id: 'hero' | 'exterior' | 'side-body' | 'front-end' | 'wheels' | 'reveal';
  /** Progress (0-1) at which this stage begins. */
  start: number;
}

/**
 * Order is paint → hood → wheel (not the wheel → hood order the brief
 * originally listed) — swapped deliberately, see carConfig.ts's doc comment
 * for why: the grille needs noticeably more breathing room to read clearly
 * than a wheel close-up does, and "never zoom out" (the single most
 * repeated requirement in this rebuild) wins over matching the original
 * step order exactly.
 */
export const STAGE_BOUNDARIES: StageBoundary[] = [
  { id: 'hero', start: 0 },
  { id: 'exterior', start: 0.14 },
  { id: 'side-body', start: 0.4 },
  { id: 'front-end', start: 0.62 },
  { id: 'wheels', start: 0.8 },
  { id: 'reveal', start: 0.94 },
];

/** Stage ids that intentionally show no info panel — pure camera moves. */
export const NO_PANEL_STAGE_IDS: ReadonlyArray<StageBoundary['id']> = ['hero', 'reveal'];

/**
 * Total scrollable distance the pinned experience reserves, in viewport
 * heights. This directly controls how much scrolling each stage takes —
 * continuous, scrubbed camera movement (see ScrollExperience.tsx), not a
 * per-gesture snap.
 */
export const EXPERIENCE_HEIGHT_VH = 1400;

export function getActiveStageId(progress: number): StageBoundary['id'] {
  let current = STAGE_BOUNDARIES[0].id;
  for (const b of STAGE_BOUNDARIES) {
    if (progress >= b.start) current = b.id;
  }
  return current;
}

/** Progress (0-1) *within the current stage's own window*, clamped. Used for
 * sub-highlights and finer in-stage camera moves. */
export function getStageLocalProgress(progress: number): number {
  const idx = STAGE_BOUNDARIES.findLastIndex((b) => progress >= b.start);
  const start = STAGE_BOUNDARIES[idx]?.start ?? 0;
  const end = STAGE_BOUNDARIES[idx + 1]?.start ?? 1;
  const span = end - start || 1;
  return Math.min(1, Math.max(0, (progress - start) / span));
}
