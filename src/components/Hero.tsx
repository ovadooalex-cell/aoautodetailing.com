import { getStage } from '../data/services';
import './Hero.css';

interface HeroProps {
  visible: boolean;
  onCtaClick?: () => void;
}

const stage = getStage('hero');

export default function Hero({ visible, onCtaClick }: HeroProps) {
  return (
    <div className={`hero-overlay ${visible ? 'is-visible' : ''}`}>
      <div className="hero-overlay__scrim" aria-hidden="true" />
      <span className="eyebrow">{stage.eyebrow}</span>
      <h1 className="hero-overlay__title">
        {stage.title.split('\n').map((line, i) => (
          <span key={i} className="hero-overlay__title-line">
            {line}
          </span>
        ))}
      </h1>
      <p className="hero-overlay__desc">{stage.description}</p>
      <button type="button" className="btn" onClick={onCtaClick}>
        Book Your Detail
      </button>
      <span className="hero-overlay__hint">Scroll to explore</span>
    </div>
  );
}
