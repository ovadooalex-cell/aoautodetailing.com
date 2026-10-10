import { useCallback, useEffect, useRef, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import Navbar from './components/Navbar';
import ScrollExperience from './components/ScrollExperience';
import TrustBadges from './components/TrustBadges';
import Pricing from './components/Pricing';
import Footer from './components/Footer';
import type { ServicePreselect } from './components/BookingForm';
import { useReducedMotion } from './hooks/useReducedMotion';
import './App.css';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

export default function App() {
  const smootherRef = useRef<ScrollSmoother | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;

    smootherRef.current = ScrollSmoother.create({
      wrapper: '#smooth-wrapper',
      content: '#smooth-content',
      smooth: 1.2,
      effects: false,
      normalizeScroll: true,
    });

    return () => {
      smootherRef.current?.kill();
      smootherRef.current = null;
    };
  }, [reducedMotion]);

  const scrollToId = useCallback(
    (id: string) => {
      const target = document.getElementById(id);
      if (!target) return;
      if (smootherRef.current) {
        smootherRef.current.scrollTo(target, true, 'top top');
      } else {
        target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
      }
    },
    [reducedMotion],
  );

  const scrollToBooking = useCallback(() => scrollToId('book'), [scrollToId]);
  const scrollToServices = useCallback(() => scrollToId('pricing'), [scrollToId]);

  // "Book this package" on a pricing card: preselect it in the form, then scroll there.
  const [preselect, setPreselect] = useState<ServicePreselect>();
  const bookPackage = useCallback(
    (service: string) => {
      setPreselect((prev) => ({ service, nonce: (prev?.nonce ?? 0) + 1 }));
      scrollToId('book');
    },
    [scrollToId],
  );

  return (
    <>
      <Navbar onBook={scrollToBooking} onNavigate={scrollToId} />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <a id="top" className="visually-hidden" href="#top" tabIndex={-1} aria-hidden="true" />
          <ScrollExperience onBook={scrollToBooking} onViewServices={scrollToServices} onNavigateStage={scrollToId} />
          <TrustBadges />
          <Pricing onBookPackage={bookPackage} />
          <Footer preselect={preselect} />
        </div>
      </div>
      <Analytics />
    </>
  );
}
