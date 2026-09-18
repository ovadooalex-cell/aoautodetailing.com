/**
 * Brand + contact details shown in the navbar, footer, and booking CTA.
 * Real business info, from the AO Auto Detailing Instagram flyer.
 */
export const SITE_NAME = 'AO Auto Detailing';
export const SITE_SHORT_NAME = 'AO';
export const TAGLINE = 'Professional Care. Premium Results.';
export const SERVICE_AREA = 'Newnan, GA & Surrounding Areas';
export const IS_VETERAN_OWNED = true;
export const CONTACT_PHONE = '470-347-6168';
export const CONTACT_PHONE_TEL = 'tel:+14703476168';
export const CONTACT_EMAIL = 'ao.autodetailing26@outlook.com';
export const INSTAGRAM_HANDLE = '@ao.auto.detailing';
export const INSTAGRAM_URL = 'https://instagram.com/ao.auto.detailing';
export const BOOKING_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  'AO Auto Detailing — booking request',
)}`;

/** Short trust badges shown under the hero, mirroring the flyer. */
export const TRUST_BADGES = [
  { title: 'Quality Work', desc: 'Attention to detail every time.' },
  { title: 'On Time', desc: 'Reliable service you can count on.' },
  { title: 'Local & Reliable', desc: 'Proudly serving our local community.' },
  { title: 'Army Veteran', desc: 'Proudly serving. Proudly serving you.' },
];

/**
 * In-page navigation shared by the header and footer. Every id must be a real
 * anchor: the scroll stages (see ScrollExperience.tsx) or the pricing section.
 * The list used to include an "Interior" link — a leftover from a 9-stage
 * version of the scroll story — that pointed at nothing.
 */
export const NAV_LINKS: { id: string; label: string }[] = [
  { id: 'exterior', label: 'Exterior' },
  { id: 'side-body', label: 'Paint' },
  { id: 'front-end', label: 'Front End' },
  { id: 'wheels', label: 'Wheels' },
  { id: 'pricing', label: 'Pricing' },
];
