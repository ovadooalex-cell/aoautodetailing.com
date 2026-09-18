import { ADD_ONS, MAINTENANCE_NOTE, MAINTENANCE_PLANS, PACKAGES, PRICING_DISCLAIMER } from '../data/packages';
import './Pricing.css';

export default function Pricing({ onBookPackage }: { onBookPackage?: (packageId: string) => void }) {
  return (
    <section className="pricing" id="pricing">
      <div className="pricing__header">
        <span className="eyebrow">Detailing Packages</span>
        <h2 className="pricing__title">Choose Your Detail</h2>
      </div>

      <div className="pricing__grid">
        {PACKAGES.map((pkg) => (
          <article key={pkg.id} className={`pricing-card ${pkg.mostPopular ? 'is-popular' : ''}`}>
            {pkg.mostPopular && <span className="pricing-card__badge">Most Popular</span>}
            <h3 className="pricing-card__name">{pkg.name}</h3>
            <p className="pricing-card__desc">{pkg.description}</p>

            <div className="pricing-card__prices">
              <div>
                <span className="pricing-card__price-label">Sedan</span>
                <span className="pricing-card__price-value">${pkg.sedanPrice}</span>
              </div>
              <div>
                <span className="pricing-card__price-label">SUV / Truck</span>
                <span className="pricing-card__price-value">${pkg.suvPrice}</span>
              </div>
            </div>

            <ul className="pricing-card__features">
              {pkg.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>

            <button type="button" className="btn btn--ghost pricing-card__cta" onClick={() => onBookPackage?.(pkg.id)}>
              Book this package
            </button>
          </article>
        ))}
      </div>

      <div className="pricing__secondary">
        <div className="pricing__maintenance">
          <span className="eyebrow">Maintenance Plans</span>
          {MAINTENANCE_PLANS.map((plan) => (
            <div key={plan.name} className="maintenance-row">
              <div>
                <span className="maintenance-row__name">{plan.name}</span>
                <span className="maintenance-row__desc">{plan.description}</span>
              </div>
              <div className="maintenance-row__price">
                <span className="maintenance-row__price-value">${plan.price}</span>
                <span className="maintenance-row__price-note">{plan.priceNote}</span>
              </div>
            </div>
          ))}
          <p className="pricing__note">{MAINTENANCE_NOTE}</p>
        </div>

        <div className="pricing__addons">
          <span className="eyebrow">Add-Ons</span>
          <div className="addon-grid">
            {ADD_ONS.map((addon) => (
              <div key={addon.name} className="addon-chip">
                <span className="addon-chip__name">{addon.name}</span>
                <span className="addon-chip__price">{addon.priceLabel}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="pricing__disclaimer">{PRICING_DISCLAIMER}</p>
    </section>
  );
}
