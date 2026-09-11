/**
 * ============================================================================
 * REAL PRICING — from the AO Auto Detailing Instagram flyer.
 * ============================================================================
 * This is the actual, current pricing. Edit here to update it anywhere it's
 * shown (the Pricing section, maintenance plans, add-ons).
 */

export interface Package {
  id: string;
  name: string;
  description: string;
  mostPopular?: boolean;
  sedanPrice: number;
  suvPrice: number;
  features: string[];
}

export const PACKAGES: Package[] = [
  {
    id: 'exterior-refresh',
    name: 'AO Exterior Refresh',
    description: 'A thorough exterior clean to keep your vehicle looking its best.',
    sedanPrice: 50,
    suvPrice: 60,
    features: ['Hand wash', 'Wheels & tires cleaned', 'Tire shine', 'Exterior windows', 'Hand dry'],
  },
  {
    id: 'interior-reset',
    name: 'AO Interior Reset',
    description: 'A deep interior clean to remove dirt, dust, and everyday buildup.',
    sedanPrice: 80,
    suvPrice: 100,
    features: [
      'Full vacuum',
      'Dash & console cleaned',
      'Door panels cleaned',
      'Cup holders cleaned',
      'Interior windows',
      'Floor mats cleaned',
      'Interior wipe down',
    ],
  },
  {
    id: 'complete-detail',
    name: 'AO Complete Detail',
    description: 'The perfect combo of a deep clean inside and out.',
    mostPopular: true,
    sedanPrice: 120,
    suvPrice: 140,
    features: ['Everything in Exterior Refresh', 'Everything in Interior Reset'],
  },
  {
    id: 'premium-detail',
    name: 'AO Premium Detail',
    description: 'Our most thorough detail for a like-new finish, inside and out.',
    sedanPrice: 175,
    suvPrice: 200,
    features: [
      'Everything in Complete Detail',
      'Deep clean floor mats',
      'Detailed wheels & tires',
      'Spray wax / sealant',
      'Interior protectant',
      'Interior & exterior windows',
    ],
  },
];

export interface MaintenancePlan {
  name: string;
  description: string;
  price: number;
  priceNote: string;
}

export const MAINTENANCE_PLANS: MaintenancePlan[] = [
  {
    name: 'Bi-Weekly Shine',
    description: 'Every two weeks — the tightest upkeep schedule we offer.',
    price: 65,
    priceNote: 'per visit (~$130/mo, recurring)',
  },
  {
    name: 'Monthly Refresh',
    description: 'A monthly reset to hold the finish between full details.',
    price: 75,
    priceNote: 'per visit (recurring)',
  },
];

export const MAINTENANCE_NOTE = 'Maintenance plans are for existing clients after an initial full detail.';

export interface AddOn {
  name: string;
  priceLabel: string;
}

export const ADD_ONS: AddOn[] = [
  { name: 'Pet Hair Removal', priceLabel: 'starting at $30' },
  { name: 'Carpet / Seat Extraction', priceLabel: 'starting at $40' },
  { name: 'Spray Wax / Sealant', priceLabel: '$25' },
  { name: 'Wheel Deep Clean', priceLabel: '$25' },
];

export const PRICING_DISCLAIMER =
  'Prices reflect standard vehicle condition. Excessive dirt, pet hair, stains, or oversized vehicles may require an additional charge.';
