import './CTA.css';

interface CTAProps {
  onBook?: () => void;
}

/** Standalone booking CTA — reused in the final reveal and the footer. */
export default function CTA({ onBook }: CTAProps) {
  return (
    <button type="button" className="btn cta-btn" onClick={onBook}>
      Book Your Detail
    </button>
  );
}
