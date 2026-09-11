import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import type { ServiceStage } from '../data/services';
import { DETAIL_STAGES } from '../data/services';
import DetailStage from './DetailStage';
import './InfoPanel.css';

interface InfoPanelProps {
  stage: ServiceStage;
  /** 0-based index into DETAIL_STAGES, or -1 while on hero/reveal. */
  activeDetailIndex: number;
  /** Index into `stage.subHighlights` currently in focus, or -1. */
  activeSubHighlight: number;
  /** Visible (fades in during exterior stage, fades out into reveal). */
  visible: boolean;
  /** Jumps to the Pricing section. */
  onViewPricing?: () => void;
}

export default function InfoPanel({
  stage,
  activeDetailIndex,
  activeSubHighlight,
  visible,
  onViewPricing,
}: InfoPanelProps) {
  const activeSubLabel = stage.subHighlights?.[activeSubHighlight]?.label;
  const bodyRef = useRef<HTMLDivElement>(null);
  const prevStageId = useRef(stage.id);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    if (prevStageId.current === stage.id) return;
    prevStageId.current = stage.id;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power3.out' },
      );
    });
    return () => ctx.revert();
  }, [stage.id]);

  return (
    <aside
      className={`info-panel glass-panel ${visible ? 'is-visible' : ''}`}
      aria-live="polite"
    >
      <div className="info-panel__body" ref={bodyRef}>
        {stage.index && <span className="info-panel__index">{stage.index}</span>}
        <span className="eyebrow">{stage.eyebrow}</span>
        <h3 className="info-panel__title">
          {stage.title.split('\n').map((line, i) => (
            <span key={i} className="info-panel__title-line">
              {line}
            </span>
          ))}
        </h3>
        <p className="info-panel__desc">{stage.description}</p>

        {stage.bullets && (
          <ul className="info-panel__bullets">
            {stage.bullets.map((b) => (
              <li key={b} className={b === activeSubLabel ? 'is-active' : ''}>
                {b}
              </li>
            ))}
          </ul>
        )}

        {activeDetailIndex >= 0 && (
          <a
            href="#pricing"
            className="info-panel__pricing-link"
            onClick={(e) => {
              e.preventDefault();
              onViewPricing?.();
            }}
          >
            See full pricing ↓
          </a>
        )}
      </div>

      {activeDetailIndex >= 0 && (
        <nav className="info-panel__rail" aria-label="Detailing stages">
          {DETAIL_STAGES.map((s, i) => (
            <DetailStage
              key={s.id}
              stage={s}
              active={i === activeDetailIndex}
              complete={i < activeDetailIndex}
            />
          ))}
        </nav>
      )}
    </aside>
  );
}
