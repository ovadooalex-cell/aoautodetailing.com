import { useEffect, useState } from 'react';
import { NAV_LINKS, SITE_NAME } from '../config/siteConfig';
import './Navbar.css';

interface NavbarProps {
  onBook?: () => void;
  onNavigate?: (id: string) => void;
}

export default function Navbar({ onBook, onNavigate }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`navbar ${scrolled ? 'is-scrolled' : ''}`}>
      <a
        href="#top"
        className="navbar__mark"
        onClick={(e) => {
          e.preventDefault();
          onNavigate?.('top');
        }}
      >
        {SITE_NAME.toUpperCase()}
      </a>
      <nav className="navbar__links">
        {NAV_LINKS.map((link) => (
          <a
            key={link.id}
            href={`#${link.id}`}
            onClick={(e) => {
              e.preventDefault();
              onNavigate?.(link.id);
            }}
          >
            {link.label}
          </a>
        ))}
      </nav>
      <button type="button" className="btn btn--ghost navbar__cta" onClick={onBook}>
        Book Now
      </button>
    </header>
  );
}
