import type { ServiceStage } from '../data/services';
import './DetailStage.css';

interface DetailStageProps {
  stage: ServiceStage;
  active: boolean;
  complete: boolean;
  onSelect?: () => void;
}

/**
 * One entry in the vertical stage rail next to the info panel — shows the
 * "01 / 02 / 03 / 04" index and lights up as the matching scroll segment
 * becomes active. Purely presentational; ScrollExperience owns progress.
 */
export default function DetailStage({ stage, active, complete, onSelect }: DetailStageProps) {
  return (
    <button
      type="button"
      className={`detail-stage ${active ? 'is-active' : ''} ${complete ? 'is-complete' : ''}`}
      onClick={onSelect}
      tabIndex={onSelect ? 0 : -1}
      aria-current={active}
    >
      <span className="detail-stage__index">{stage.index}</span>
      <span className="detail-stage__label">{stage.eyebrow}</span>
      <span className="detail-stage__bar" />
    </button>
  );
}
