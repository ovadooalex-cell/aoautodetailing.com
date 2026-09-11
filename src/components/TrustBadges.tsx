import { TRUST_BADGES } from '../config/siteConfig';
import './TrustBadges.css';

export default function TrustBadges() {
  return (
    <section className="trust-badges" aria-label="Why AO Auto Detailing">
      {TRUST_BADGES.map((badge) => (
        <div key={badge.title} className="trust-badge">
          <span className="trust-badge__title">{badge.title}</span>
          <span className="trust-badge__desc">{badge.desc}</span>
        </div>
      ))}
    </section>
  );
}
