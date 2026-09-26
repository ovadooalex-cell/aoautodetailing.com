import {
  CONTACT_EMAIL,
  CONTACT_PHONE,
  CONTACT_PHONE_SMS,
  CONTACT_PHONE_TEL,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  NAV_LINKS,
  SERVICE_AREA,
  SITE_NAME,
} from '../config/siteConfig';
import BookingForm from './BookingForm';
import type { ServicePreselect } from './BookingForm';
import './Footer.css';

export default function Footer({ preselect }: { preselect?: ServicePreselect }) {
  return (
    <footer className="site-footer camo-texture-bg" id="book">
      <div className="site-footer__cta">
        <span className="eyebrow">Ready when you are</span>
        <h2 className="site-footer__title">BOOK YOUR DETAIL</h2>
        <p className="site-footer__lead">
          Tell us about your vehicle and when works for you — we come to you in {SERVICE_AREA}.
        </p>
      </div>

      <div className="site-footer__booking">
        <BookingForm preselect={preselect} />
        <aside className="site-footer__quick" aria-label="Other ways to book">
          <span className="eyebrow">Prefer to talk?</span>
          <a className="btn cta-btn" href={CONTACT_PHONE_TEL}>
            Call {CONTACT_PHONE}
          </a>
          <a className="btn btn--ghost" href={CONTACT_PHONE_SMS}>
            Text us
          </a>
          <a className="btn btn--ghost" href={`mailto:${CONTACT_EMAIL}`}>
            Email us
          </a>
          <ol className="site-footer__steps">
            <li>
              <strong>Request</strong> your day and time above.
            </li>
            <li>
              <strong>We confirm</strong> the time and final price with you.
            </li>
            <li>
              <strong>We come to you</strong> — no drop-off, no waiting room.
            </li>
          </ol>
        </aside>
      </div>

      <div className="site-footer__contact">
        <a href={CONTACT_PHONE_TEL}>{CONTACT_PHONE}</a>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
          {INSTAGRAM_HANDLE}
        </a>
        <span>{SERVICE_AREA}</span>
      </div>

      <div className="site-footer__meta">
        <span className="navbar__mark">{SITE_NAME}</span>
        <nav className="site-footer__links">
          {NAV_LINKS.map((link) => (
            <a key={link.id} href={`#${link.id}`}>
              {link.label}
            </a>
          ))}
        </nav>
        <span className="site-footer__copy">© {new Date().getFullYear()} {SITE_NAME}</span>
      </div>
    </footer>
  );
}
