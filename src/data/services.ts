/**
 * ============================================================================
 * SCROLL STORY CONTENT — the cinematic walkthrough copy
 * ============================================================================
 * Edit this file to change any copy or sub-highlight shown in the info panel
 * as the user scrolls through the vehicle. Actual pricing lives in
 * `data/packages.ts` and is shown in the Pricing section, not here — the
 * real business sells tiered packages (Exterior Refresh / Interior Reset /
 * Complete Detail / Premium Detail), not a price per body area, so these
 * per-stage panels are narrative ("what we pay attention to here"), not a
 * price list.
 */

export interface SubHighlight {
  /** Shown as a highlighted bullet while this range of the stage is active. */
  label: string;
  /** Local progress range (0-1) *within this stage* where this is highlighted. */
  start: number;
  end: number;
}

export interface ServiceStage {
  /** Stable key used by the scroll timeline + InfoPanel to look up this stage. */
  id: 'hero' | 'exterior' | 'front-end' | 'wheels' | 'side-body' | 'interior' | 'reveal';
  /** "01", "02", ... shown as the panel index. Empty for hero/reveal. */
  index: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets?: string[];
  /**
   * Optional finer-grained breakdown within a long stage (currently used by
   * "interior") — each bullet lights up as the user scrolls through that
   * portion of the stage instead of all bullets being static.
   */
  subHighlights?: SubHighlight[];
}

export const SERVICE_STAGES: ServiceStage[] = [
  {
    id: 'hero',
    index: '',
    eyebrow: 'Veteran Owned · Mobile Detailing',
    title: 'YOUR CAR.\nDETAILED TO PERFECTION.',
    description:
      'Professional interior and exterior detailing — we come to you, anywhere in Newnan, GA & surrounding areas.',
  },
  {
    id: 'exterior',
    index: '01',
    eyebrow: 'Exterior',
    title: 'EXTERIOR REFRESH',
    description:
      'A thorough hand wash to keep your vehicle looking its best — the foundation every AO detail is built on.',
    bullets: ['Hand wash', 'Wheels & tires cleaned', 'Tire shine', 'Exterior windows', 'Hand dry'],
  },
  {
    id: 'side-body',
    index: '02',
    eyebrow: 'Paint & Body',
    title: 'SPRAY WAX & SEALANT',
    description:
      'A protective spray wax / sealant finish, panel by panel — cleaner cars, better vibes.',
    bullets: ['Hand washing', 'Spray wax / sealant', 'Interior & exterior windows', 'Gloss finish'],
  },
  {
    id: 'front-end',
    index: '03',
    eyebrow: 'Front End',
    title: 'EVERY GAP, BY HAND',
    description:
      'The face of the vehicle gets the closest attention — every vent, badge, and gap cleaned by hand.',
    bullets: [
      'Grille detailing',
      'Headlight cleaning',
      'Front bumper',
      'Emblems',
      'Hard-to-reach areas',
    ],
  },
  {
    id: 'wheels',
    index: '04',
    eyebrow: 'Wheels & Tires',
    title: 'DETAILED WHEEL FACES',
    description:
      'Wheels see the worst of it. We strip brake dust from every face and dress tires for a factory-fresh finish.',
    bullets: ['Wheel cleaning', 'Brake dust removal', 'Tire cleaning', 'Tire dressing', 'Wheel wells'],
  },
  {
    id: 'interior',
    index: '05',
    eyebrow: 'Interior',
    title: 'INTERIOR RESET',
    description:
      'A deep interior clean to remove dirt, dust, and everyday buildup — every surface reset.',
    bullets: [
      'Full vacuum',
      'Dashboard & console cleaned',
      'Door panels cleaned',
      'Cup holders cleaned',
      'Floor mats cleaned',
      'Interior windows',
      'Interior wipe down',
    ],
    subHighlights: [
      { label: 'Dashboard & console cleaned', start: 0, end: 0.3 },
      { label: 'Door panels cleaned', start: 0.3, end: 0.6 },
      { label: 'Floor mats cleaned', start: 0.6, end: 1 },
    ],
  },
  {
    id: 'reveal',
    index: '',
    eyebrow: 'The Finished Result',
    title: 'CLEANER CARS.\nBETTER VIBES.',
    description: 'From the smallest detail to the full finish, we treat every vehicle with precision.',
  },
];

export const getStage = (id: ServiceStage['id']): ServiceStage =>
  SERVICE_STAGES.find((s) => s.id === id) ?? SERVICE_STAGES[0];

/**
 * Stages that get their own pinned scroll segment + InfoPanel entry (excludes
 * hero/reveal bookends). Also excludes 'interior' — the current car asset
 * has no separate interior geometry to camera-move into (see carConfig.ts),
 * so that stage isn't part of the 3D scroll sequence. The interior
 * detailing service itself is still sold, just via the Pricing section.
 */
export const DETAIL_STAGES = SERVICE_STAGES.filter(
  (s) => s.id !== 'hero' && s.id !== 'reveal' && s.id !== 'interior',
);
