import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_SMS, CONTACT_PHONE_TEL, SERVICE_AREA } from '../config/siteConfig';
import { ADD_ONS } from '../data/packages';
import {
  EMPTY_BOOKING,
  SERVICE_OPTIONS,
  TIME_WINDOWS,
  buildMailto,
  dateBounds,
  deliverBooking,
  estimatePrice,
  formatPhone,
  makeReference,
  summarize,
  validateBooking,
} from '../lib/booking';
import type { BookingErrors, BookingRequest, ContactPreference, VehicleSize } from '../lib/booking';
import './BookingForm.css';

export interface ServicePreselect {
  service: string;
  /** Bumped on every "Book this package" click so picking the same one twice still applies. */
  nonce: number;
}

type Status = 'idle' | 'sending' | 'sent' | 'email-app' | 'error';

const CONTACT_CHOICES: { value: ContactPreference; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
];

const SIZE_CHOICES: { value: VehicleSize; label: string; hint: string }[] = [
  { value: 'sedan', label: 'Sedan / Coupe', hint: 'Cars, coupes, small hatchbacks' },
  { value: 'suv', label: 'SUV / Truck', hint: 'SUVs, trucks, vans, larger vehicles' },
];

export default function BookingForm({ preselect }: { preselect?: ServicePreselect }) {
  const [data, setData] = useState<BookingRequest>(EMPTY_BOOKING);
  const [errors, setErrors] = useState<BookingErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const [reference, setReference] = useState('');
  // The submitted request is kept separately so the confirmation and the
  // fallback links keep describing what was sent even if the form is edited.
  const [submitted, setSubmitted] = useState<BookingRequest | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { min: minDate, max: maxDate } = dateBounds();

  // "Book this package" on a pricing card: apply the pick when it arrives.
  // Done while rendering (React's documented pattern for state derived from a
  // changing prop) rather than in an effect, so there's no extra render pass.
  const [appliedNonce, setAppliedNonce] = useState(0);
  if (preselect && preselect.nonce !== appliedNonce) {
    setAppliedNonce(preselect.nonce);
    setData((d) => ({ ...d, service: preselect.service }));
    setErrors((e) => ({ ...e, service: undefined }));
  }

  const set = <K extends keyof BookingRequest>(key: K, value: BookingRequest[K]) => {
    setData((d) => ({ ...d, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const toggleAddOn = (name: string) =>
    set('addOns', data.addOns.includes(name) ? data.addOns.filter((n) => n !== name) : [...data.addOns, name]);

  const price = estimatePrice(data.service, data.vehicleSize);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (status === 'sending') return;

    // Honeypot: real visitors never see or fill this field; bots that
    // auto-fill every input do. Pretend success and drop the request.
    const honey = formRef.current?.elements.namedItem('company') as HTMLInputElement | null;
    if (honey?.value) {
      setStatus('sent');
      setReference('AO-000000');
      setSubmitted(data);
      return;
    }

    const found = validateBooking(data);
    setErrors(found);
    const firstBad = Object.keys(found)[0];
    if (firstBad) {
      formRef.current?.querySelector<HTMLElement>(`[data-field="${firstBad}"] input, [data-field="${firstBad}"] select, [data-field="${firstBad}"] textarea`)?.focus();
      return;
    }

    const ref = makeReference();
    setReference(ref);
    setSubmitted(data);
    setStatus('sending');
    try {
      setStatus(await deliverBooking(data, ref));
    } catch {
      setStatus('error');
    }
  };

  const reset = () => {
    setData(EMPTY_BOOKING);
    setErrors({});
    setStatus('idle');
    setSubmitted(null);
  };

  if (submitted && (status === 'sent' || status === 'email-app' || status === 'error')) {
    return (
      <Outcome
        status={status}
        reference={reference}
        request={submitted}
        onRetry={() => setStatus('idle')}
        onReset={reset}
      />
    );
  }

  const fieldError = (key: keyof BookingRequest) =>
    errors[key] ? (
      <span className="booking__error" id={`err-${key}`} role="alert">
        {errors[key]}
      </span>
    ) : null;
  const a11y = (key: keyof BookingRequest) => ({
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `err-${key}` : undefined,
  });

  return (
    <form className="booking" ref={formRef} onSubmit={onSubmit} noValidate>
      {/* Honeypot — hidden from people and assistive tech, see onSubmit. */}
      <div className="booking__honey" aria-hidden="true">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset className="booking__group">
        <legend>About you</legend>
        <div className="booking__row">
          <div className="booking__field" data-field="name">
            <label htmlFor="bk-name">Full name</label>
            <input
              id="bk-name"
              name="name"
              type="text"
              autoComplete="name"
              value={data.name}
              onChange={(e) => set('name', e.target.value)}
              {...a11y('name')}
            />
            {fieldError('name')}
          </div>
          <div className="booking__field" data-field="phone">
            <label htmlFor="bk-phone">Phone</label>
            <input
              id="bk-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(470) 555-0123"
              value={data.phone}
              onChange={(e) => set('phone', e.target.value)}
              onBlur={() => set('phone', formatPhone(data.phone))}
              {...a11y('phone')}
            />
            {fieldError('phone')}
          </div>
        </div>
        <div className="booking__row">
          <div className="booking__field" data-field="email">
            <label htmlFor="bk-email">
              Email <span className="booking__optional">(optional)</span>
            </label>
            <input
              id="bk-email"
              name="email"
              type="email"
              autoComplete="email"
              value={data.email}
              onChange={(e) => set('email', e.target.value)}
              {...a11y('email')}
            />
            {fieldError('email')}
          </div>
          <div className="booking__field">
            <span className="booking__label" id="bk-contact-label">
              Best way to reach you
            </span>
            <div className="booking__chips" role="radiogroup" aria-labelledby="bk-contact-label">
              {CONTACT_CHOICES.map((c) => (
                <label key={c.value} className="booking__chip">
                  <input
                    type="radio"
                    name="contactPreference"
                    value={c.value}
                    checked={data.contactPreference === c.value}
                    onChange={() => set('contactPreference', c.value)}
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset className="booking__group">
        <legend>Your vehicle &amp; service</legend>
        <div className="booking__field" data-field="vehicle">
          <label htmlFor="bk-vehicle">Year, make &amp; model</label>
          <input
            id="bk-vehicle"
            name="vehicle"
            type="text"
            placeholder="e.g. 2021 Ford F-150"
            value={data.vehicle}
            onChange={(e) => set('vehicle', e.target.value)}
            {...a11y('vehicle')}
          />
          {fieldError('vehicle')}
        </div>

        <div className="booking__field">
          <span className="booking__label" id="bk-size-label">
            Vehicle size
          </span>
          <div className="booking__chips booking__chips--wide" role="radiogroup" aria-labelledby="bk-size-label">
            {SIZE_CHOICES.map((c) => (
              <label key={c.value} className="booking__chip">
                <input
                  type="radio"
                  name="vehicleSize"
                  value={c.value}
                  checked={data.vehicleSize === c.value}
                  onChange={() => set('vehicleSize', c.value)}
                />
                <span>
                  {c.label}
                  <small>{c.hint}</small>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="booking__field" data-field="service">
          <label htmlFor="bk-service">Service</label>
          <select
            id="bk-service"
            name="service"
            value={data.service}
            onChange={(e) => set('service', e.target.value)}
            {...a11y('service')}
          >
            <option value="" disabled>
              Choose a service…
            </option>
            {(['Detail packages', 'Maintenance plans', 'Not sure'] as const).map((group) => (
              <optgroup key={group} label={group === 'Not sure' ? 'Not sure?' : group}>
                {SERVICE_OPTIONS.filter((o) => o.group === group).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {fieldError('service')}
          {price !== null && (
            <span className="booking__price" aria-live="polite">
              Starting at <strong>${price}</strong>
              {SERVICE_OPTIONS.find((o) => o.id === data.service)?.group === 'Maintenance plans' ? ' per visit' : ''}
              <em> — final price depends on condition, confirmed before we start.</em>
            </span>
          )}
        </div>

        <div className="booking__field">
          <span className="booking__label" id="bk-addons-label">
            Add-ons <span className="booking__optional">(optional)</span>
          </span>
          <div className="booking__chips booking__chips--wrap" role="group" aria-labelledby="bk-addons-label">
            {ADD_ONS.map((addon) => (
              <label key={addon.name} className="booking__chip">
                <input
                  type="checkbox"
                  name="addOns"
                  value={addon.name}
                  checked={data.addOns.includes(addon.name)}
                  onChange={() => toggleAddOn(addon.name)}
                />
                <span>
                  {addon.name}
                  <small>{addon.priceLabel}</small>
                </span>
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="booking__group">
        <legend>When &amp; where</legend>
        <div className="booking__row">
          <div className="booking__field" data-field="date">
            <label htmlFor="bk-date">Preferred date</label>
            <input
              id="bk-date"
              name="date"
              type="date"
              min={minDate}
              max={maxDate}
              value={data.date}
              onChange={(e) => set('date', e.target.value)}
              {...a11y('date')}
            />
            {fieldError('date')}
          </div>
          <div className="booking__field" data-field="timeWindow">
            <label htmlFor="bk-time">Preferred time</label>
            <select
              id="bk-time"
              name="timeWindow"
              value={data.timeWindow}
              onChange={(e) => set('timeWindow', e.target.value)}
              {...a11y('timeWindow')}
            >
              <option value="" disabled>
                Choose a window…
              </option>
              {TIME_WINDOWS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {fieldError('timeWindow')}
          </div>
        </div>
        <div className="booking__field" data-field="address">
          <label htmlFor="bk-address">Where should we meet you?</label>
          <input
            id="bk-address"
            name="address"
            type="text"
            autoComplete="street-address"
            placeholder={`Street address, city — we serve ${SERVICE_AREA}`}
            value={data.address}
            onChange={(e) => set('address', e.target.value)}
            {...a11y('address')}
          />
          {fieldError('address')}
        </div>
        <div className="booking__field" data-field="notes">
          <label htmlFor="bk-notes">
            Anything we should know? <span className="booking__optional">(optional)</span>
          </label>
          <textarea
            id="bk-notes"
            name="notes"
            rows={3}
            placeholder="Pet hair, stains, water/power access, gate codes, parking notes…"
            value={data.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </div>
      </fieldset>

      <div className="booking__submit">
        <button type="submit" className="btn cta-btn" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Request my booking'}
        </button>
        <p className="booking__fineprint">
          This is a request, not a confirmed appointment — we’ll reach out by {data.contactPreference} to confirm the
          time and price. Need it sooner? Call or text{' '}
          <a href={CONTACT_PHONE_TEL}>{CONTACT_PHONE}</a>.
        </p>
      </div>
    </form>
  );
}

function Outcome({
  status,
  reference,
  request,
  onRetry,
  onReset,
}: {
  status: 'sent' | 'email-app' | 'error';
  reference: string;
  request: BookingRequest;
  onRetry: () => void;
  onReset: () => void;
}) {
  const headline =
    status === 'sent'
      ? 'Request received'
      : status === 'email-app'
        ? 'One more step — send the email'
        : 'We couldn’t send that automatically';
  const lead =
    status === 'sent'
      ? `Thanks, ${request.name.trim().split(' ')[0]}! We’ll ${request.contactPreference === 'call' ? 'call' : request.contactPreference === 'text' ? 'text' : 'email'} you to confirm your appointment.`
      : status === 'email-app'
        ? `Your email app should have opened with your request filled in and addressed to ${CONTACT_EMAIL}. Press Send there to finish. Nothing is booked until we hear from you and confirm.`
        : 'Your details are safe below — nothing was lost. Send them by email, or text or call us instead.';

  return (
    <div className="booking booking--outcome" role="status" aria-live="polite">
      <span className="eyebrow">Reference {reference}</span>
      <h3 className="booking__outcome-title">{headline}</h3>
      <p className="booking__outcome-lead">{lead}</p>

      <dl className="booking__summary">
        {summarize(request, reference)
          .filter(([k]) => k !== 'Reference')
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>

      <div className="booking__outcome-actions">
        {status !== 'sent' && (
          <a className="btn cta-btn" href={buildMailto(request, reference)}>
            {status === 'email-app' ? 'Open the email again' : 'Send by email instead'}
          </a>
        )}
        <a className="btn btn--ghost" href={CONTACT_PHONE_SMS}>
          Text us
        </a>
        <a className="btn btn--ghost" href={CONTACT_PHONE_TEL}>
          Call {CONTACT_PHONE}
        </a>
      </div>
      <div className="booking__outcome-links">
        {status !== 'sent' && (
          <button type="button" className="booking__link" onClick={onRetry}>
            ← Edit my request
          </button>
        )}
        <button type="button" className="booking__link" onClick={onReset}>
          Start a new request
        </button>
      </div>
    </div>
  );
}
