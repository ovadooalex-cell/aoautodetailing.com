import { BOOKING_ENDPOINT, CONTACT_EMAIL, SITE_NAME } from '../config/siteConfig';
import { ADD_ONS, MAINTENANCE_PLANS, PACKAGES } from '../data/packages';

/**
 * Booking-request model, validation and delivery. UI lives in
 * components/BookingForm.tsx.
 */

export type ContactPreference = 'call' | 'text' | 'email';
export type VehicleSize = 'sedan' | 'suv';

export interface BookingRequest {
  name: string;
  phone: string;
  email: string;
  contactPreference: ContactPreference;
  vehicle: string;
  vehicleSize: VehicleSize;
  /** A package id, a maintenance-plan id, or NOT_SURE_ID. */
  service: string;
  addOns: string[];
  /** YYYY-MM-DD, from a native date input. */
  date: string;
  timeWindow: string;
  address: string;
  notes: string;
}

export type BookingErrors = Partial<Record<keyof BookingRequest, string>>;

export const NOT_SURE_ID = 'not-sure';

export const TIME_WINDOWS = [
  'Morning (8am – 12pm)',
  'Afternoon (12pm – 4pm)',
  'Evening (4pm – 7pm)',
  'Flexible — any time works',
] as const;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export interface ServiceOption {
  id: string;
  label: string;
  group: 'Detail packages' | 'Maintenance plans' | 'Not sure';
}

/** Everything the "service" dropdown offers, built from the pricing data so
 * the two can never drift apart. */
export const SERVICE_OPTIONS: ServiceOption[] = [
  ...PACKAGES.map((p) => ({ id: p.id, label: p.name, group: 'Detail packages' as const })),
  ...MAINTENANCE_PLANS.map((p) => ({ id: slug(p.name), label: p.name, group: 'Maintenance plans' as const })),
  { id: NOT_SURE_ID, label: "Not sure yet — help me choose", group: 'Not sure' },
];

export const serviceLabel = (id: string) => SERVICE_OPTIONS.find((o) => o.id === id)?.label ?? id;

/** Starting price for the chosen service + vehicle size, or null when there
 * isn't one to quote (still choosing, or a per-visit maintenance plan is
 * shown by its own label instead). */
export function estimatePrice(service: string, size: VehicleSize): number | null {
  const pkg = PACKAGES.find((p) => p.id === service);
  if (pkg) return size === 'suv' ? pkg.suvPrice : pkg.sedanPrice;
  const plan = MAINTENANCE_PLANS.find((p) => slug(p.name) === service);
  return plan ? plan.price : null;
}

export const EMPTY_BOOKING: BookingRequest = {
  name: '',
  phone: '',
  email: '',
  contactPreference: 'text',
  vehicle: '',
  vehicleSize: 'sedan',
  service: '',
  addOns: [],
  date: '',
  timeWindow: '',
  address: '',
  notes: '',
};

export const phoneDigits = (raw: string) => {
  const d = raw.replace(/\D/g, '');
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
};

export function formatPhone(raw: string) {
  const d = phoneDigits(raw);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw;
}

const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Earliest bookable date is tomorrow — same-day jobs go through a phone call. */
export function dateBounds() {
  const min = new Date();
  min.setDate(min.getDate() + 1);
  const max = new Date();
  max.setDate(max.getDate() + 90);
  return { min: toISODate(min), max: toISODate(max) };
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function validateBooking(data: BookingRequest): BookingErrors {
  const errors: BookingErrors = {};
  if (data.name.trim().length < 2) errors.name = 'Please enter your name.';
  if (phoneDigits(data.phone).length !== 10) errors.phone = 'Enter a 10-digit phone number.';
  if (data.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim())) {
    errors.email = 'That email address doesn’t look right.';
  }
  if (data.contactPreference === 'email' && !data.email.trim()) {
    errors.email = 'Add your email, or pick call or text.';
  }
  if (data.vehicle.trim().length < 3) errors.vehicle = 'Tell us the year, make and model.';
  if (!data.service) errors.service = 'Pick a service, or “Not sure yet”.';
  const { min, max } = dateBounds();
  if (!data.date) errors.date = 'Pick the day you’d like.';
  else if (data.date < min) errors.date = 'Please pick tomorrow or later — call us for same-day.';
  else if (data.date > max) errors.date = 'We book up to 90 days out.';
  if (!data.timeWindow) errors.timeWindow = 'Pick a time window.';
  if (data.address.trim().length < 6) errors.address = 'We come to you — enter the address (street and city).';
  return errors;
}

/** Short human-friendly id (no look-alike characters) so the customer and
 * the business can refer to the same request. */
export function makeReference() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return 'AO-' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/** The request as ordered, labelled lines — used for the email body, the
 * on-screen summary and (if configured) the POST payload. */
export function summarize(data: BookingRequest, reference: string): [string, string][] {
  const price = estimatePrice(data.service, data.vehicleSize);
  const isPlan = MAINTENANCE_PLANS.some((p) => slug(p.name) === data.service);
  const rows: [string, string][] = [
    ['Reference', reference],
    ['Name', data.name.trim()],
    ['Phone', formatPhone(data.phone)],
    ['Email', data.email.trim() || '—'],
    ['Best way to reach me', { call: 'Call', text: 'Text', email: 'Email' }[data.contactPreference]],
    ['Vehicle', data.vehicle.trim()],
    ['Vehicle size', data.vehicleSize === 'suv' ? 'SUV / Truck' : 'Sedan / Coupe'],
    ['Service', serviceLabel(data.service)],
    ['Starting price', price === null ? '—' : `$${price}${isPlan ? ' per visit' : ''}`],
    ['Add-ons', data.addOns.length ? data.addOns.join(', ') : 'None'],
    ['Preferred date', formatDate(data.date)],
    ['Preferred time', data.timeWindow],
    ['Service address', data.address.trim()],
    ['Notes', data.notes.trim() || '—'],
  ];
  return rows;
}

export function buildMailto(data: BookingRequest, reference: string) {
  const subject = `${SITE_NAME} — booking request ${reference} — ${data.name.trim()}`;
  const body =
    `Hi ${SITE_NAME},\n\nI'd like to book a detail:\n\n` +
    summarize(data, reference)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n') +
    `\n\nThank you!`;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export type DeliveryResult = 'sent' | 'email-app';

/**
 * Delivers a request. With BOOKING_ENDPOINT configured (it is — FormSubmit),
 * POSTs it as JSON and resolves 'sent' only when the service confirms it
 * (throws otherwise, so the UI shows its email/text/call fallback with the
 * request intact). With no endpoint configured it opens the visitor's email
 * app with the request pre-filled and resolves 'email-app'; the customer
 * still has to press Send there, and the UI says so honestly.
 */
export async function deliverBooking(data: BookingRequest, reference: string): Promise<DeliveryResult> {
  if (!BOOKING_ENDPOINT) {
    window.location.href = buildMailto(data, reference);
    return 'email-app';
  }
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(BOOKING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        ...Object.fromEntries(summarize(data, reference)),
        // FormSubmit options (underscore-prefixed fields aren't shown in the email).
        _subject: `${SITE_NAME} — booking request ${reference} — ${data.name.trim()}`,
        _template: 'table',
        _captcha: 'false',
        // Hitting Reply in the inbox goes straight to the customer, when they gave an email.
        ...(data.email.trim() ? { _replyto: data.email.trim() } : {}),
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Booking service responded ${response.status}`);
    // FormSubmit answers 200 even for some refusals (e.g. a not-yet-activated
    // form) and says so in the body — treat that as a failure so the customer
    // gets the email fallback instead of a false "received".
    const result: unknown = await response.json().catch(() => null);
    const ok = result && typeof result === 'object' && 'success' in result ? String((result as { success: unknown }).success) === 'true' : false;
    if (!ok) throw new Error('Booking service did not accept the request');
    return 'sent';
  } finally {
    window.clearTimeout(timeout);
  }
}

export const ADD_ON_NAMES = ADD_ONS.map((a) => a.name);
