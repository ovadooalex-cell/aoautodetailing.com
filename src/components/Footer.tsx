import {
  BOOKING_MAILTO,
  CONTACT_EMAIL,
  CONTACT_PHONE,
  CONTACT_PHONE_TEL,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  SERVICE_AREA,
  SITE_NAME,
} from '../config/siteConfig';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="site-footer" id="book">
      <div className="site-footer__cta">
        <span className="eyebrow">Ready when you are</span>
        <h2 className="site-footer__title">BOOK YOUR DETAIL</h2>
        <a className="btn cta-btn" href={BOOKING_MAILTO}>
          Book Your Detail
        </a>
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
          <a href="#exterior">Exterior</a>
          <a href="#wheels">Wheels</a>
          <a href="#interior">Interior</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <span className="site-footer__copy">© {new Date().getFullYear()} {SITE_NAME}</span>
      </div>
    </footer>
  );
}
