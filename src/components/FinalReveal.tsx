import { getStage } from '../data/services';
import CTA from './CTA';
import './FinalReveal.css';

interface FinalRevealProps {
  visible: boolean;
  onBook?: () => void;
  onViewServices?: () => void;
}

const stage = getStage('reveal');

export default function FinalReveal({ visible, onBook, onViewServices }: FinalRevealProps) {
  return (
    <div className={`final-reveal ${visible ? 'is-visible' : ''}`}>
      <div className="final-reveal__scrim" aria-hidden="true" />
      <span className="eyebrow">{stage.eyebrow}</span>
      <h2 className="final-reveal__title">{stage.title}</h2>
      <p className="final-reveal__desc">{stage.description}</p>
      <div className="final-reveal__ctas">
        <CTA onBook={onBook} />
        <button type="button" className="btn btn--ghost" onClick={onViewServices}>
          View Services
        </button>
      </div>
    </div>
  );
}
