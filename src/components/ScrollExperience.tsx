import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';
import CarScene from './CarScene';
import type { CarSceneHandle } from './CarScene';
import Hero from './Hero';
import InfoPanel from './InfoPanel';
import FinalReveal from './FinalReveal';
import { getStage, DETAIL_STAGES } from '../data/services';
import type { ServiceStage } from '../data/services';
import { STAGE_POSE, ORBIT_STAGE, VIEW_SHIFT, MOBILE_DISTANCE_SCALE } from '../config/carConfig';
import type { StageId, OrbitPoseParams } from '../config/carConfig';
import { STAGE_BOUNDARIES, NO_PANEL_STAGE_IDS, EXPERIENCE_HEIGHT_VH, getActiveStageId } from '../config/scrollStages';
import { clamp, degToRad, lookAtEuler, radToDeg, unwrapAngleTowards } from '../lib/math';
import type { Pose, Vec3 } from '../lib/math';
import { useReducedMotion } from '../hooks/useReducedMotion';
import './ScrollExperience.css';

gsap.registerPlugin(ScrollTrigger);

const startOf = (id: StageId) => STAGE_BOUNDARIES.find((b) => b.id === id)!.start;

/**
 * CSS `top` for a stage's nav anchor: just inside the stage, where the camera
 * has arrived at that stage's shot. The hard-coded percentages this replaces
 * were measured against the experience's full height, but the scroll timeline
 * only spans (height - one viewport) — so they drifted later and later, and
 * the "Wheels" link landed mid-way through the pull-back to the finale.
 */
const anchorTop = (id: StageId) => {
  const scrollableVh = EXPERIENCE_HEIGHT_VH - 100;
  return `${((startOf(id) + 0.006) * scrollableVh) / EXPERIENCE_HEIGHT_VH * 100}%`;
};

const isNoPanelStage = (id: StageId) => (NO_PANEL_STAGE_IDS as StageId[]).includes(id);

/** Camera pitch is clamped to this range for every computed pose — a
 * defensive net so no waypoint (however it was authored) can ever end up
 * looking up from underneath the car. */
const PITCH_CLAMP_DEG = { min: -60, max: 20 };
/** Minimum camera height above the car's own ground plane, as a fraction of
 * the car's height — guarantees the camera can never clip through the floor. */
const MIN_HEIGHT_FRACTION = 0.03;

interface ScrollExperienceProps {
  onBook?: () => void;
  onViewServices?: () => void;
  /** Jumps the scroll position to a stage's anchor id — same mechanism the
   * navbar links already use (App.tsx's scrollToId), wired through to the
   * clickable stage rail in InfoPanel. */
  onNavigateStage?: (id: string) => void;
}

export default function ScrollExperience({ onBook, onViewServices, onNavigateStage }: ScrollExperienceProps) {
  const experienceRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const gsapCtxRef = useRef<ReturnType<typeof gsap.context> | null>(null);
  const reducedMotion = useReducedMotion();

  const [activeStageId, setActiveStageId] = useState<StageId>('hero');
  const [activeSubHighlight, setActiveSubHighlight] = useState(-1);
  // Drives the 3D canvas's render loop — see CarScene.tsx's `active` prop.
  // Starts true: the experience is the first section on the page, so it's
  // on screen before the observer below has run its first check.
  const [sceneActive, setSceneActive] = useState(true);

  useEffect(() => {
    const el = experienceRef.current;
    if (!el) return;
    // rootMargin gives the canvas a head start so rendering resumes just
    // before the pinned section scrolls back into view, not exactly on the
    // pixel edge — avoids a visible one-frame-stale pop.
    const observer = new IntersectionObserver(([entry]) => setSceneActive(entry.isIntersecting), {
      rootMargin: '200px 0px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ---- Wire the real Three.js camera into the master scroll timeline ----
  const handleSceneReady = useCallback(({ camera, box, viewShift, compactLayout }: CarSceneHandle) => {
    // ---- Facts about the car, measured from its real bounding box — the
    // same "compute from geometry, never guess/trust an opaque source"
    // discipline that fixed every camera bug in the old Spline version of
    // this scene, just simpler here: R3F hands us a real box synchronously,
    // no retry-polling for an async scene graph needed. ----
    const boxSize = box.getSize(new THREE.Vector3());
    const boxCenter = box.getCenter(new THREE.Vector3());
    const groundY = box.min.y;
    const maxHorizontal = Math.max(boxSize.x, boxSize.z);

    const buildPose = (params: OrbitPoseParams): Pose => {
      const azimuthRad = degToRad(params.azimuthDeg);
      const distance = params.distanceFrac * maxHorizontal * (compactLayout ? MOBILE_DISTANCE_SCALE : 1);
      const position: Vec3 = {
        x: boxCenter.x + Math.sin(azimuthRad) * distance,
        y: groundY + params.elevationFrac * boxSize.y,
        z: boxCenter.z + Math.cos(azimuthRad) * distance,
      };
      const target: Vec3 = {
        x: boxCenter.x,
        y: groundY + params.targetHeightFrac * boxSize.y,
        z: boxCenter.z + (params.targetOffsetFrac ?? 0) * boxSize.z,
      };
      return { position, rotation: lookAtEuler(position, target) };
    };

    const applySafety = (pose: Pose): Pose => ({
      position: { ...pose.position, y: Math.max(pose.position.y, groundY + MIN_HEIGHT_FRACTION * boxSize.y) },
      rotation: {
        ...pose.rotation,
        x: degToRad(clamp(radToDeg(pose.rotation.x), PITCH_CLAMP_DEG.min, PITCH_CLAMP_DEG.max)),
      },
    });

    gsapCtxRef.current?.add(() => {
      const tl = timelineRef.current;
      if (!tl) return;

      const heroPose = applySafety(buildPose(STAGE_POSE.hero));
      const orbitStartPose = applySafety(
        buildPose({
          azimuthDeg: ORBIT_STAGE.azimuthStartDeg,
          elevationFrac: ORBIT_STAGE.elevationFrac,
          distanceFrac: ORBIT_STAGE.distanceFrac,
          targetHeightFrac: ORBIT_STAGE.targetHeightFrac,
        }),
      );
      const sideBodyPose = applySafety(buildPose(STAGE_POSE['side-body']));
      const wheelsPose = applySafety(buildPose(STAGE_POSE.wheels));
      const frontEndPose = applySafety(buildPose(STAGE_POSE['front-end']));
      const revealPose = applySafety(buildPose(STAGE_POSE.reveal));

      // Set the hero framing immediately — without this the camera sits at
      // whatever R3F's default camera pose is until the first scroll tick.
      gsap.set(camera.position, heroPose.position);
      gsap.set(camera.rotation, heroPose.rotation);

      // GSAP tweens raw numbers linearly, so feeding it a sequence of
      // absolute target rotations needs each one unwrapped relative to the
      // last, or crossing the ±π boundary spins the camera the long way
      // round instead of the short way (this exact bug — "camera does a
      // wild spin mid-scroll" — is why unwrapAngleTowards exists at all).
      const running = { rotation: { ...heroPose.rotation } };
      const unwrap = (target: Vec3): Vec3 => {
        const r = {
          x: unwrapAngleTowards(running.rotation.x, target.x),
          y: unwrapAngleTowards(running.rotation.y, target.y),
          z: unwrapAngleTowards(running.rotation.z, target.z),
        };
        running.rotation = r;
        return r;
      };

      const heroStart = startOf('hero');
      const exteriorStart = startOf('exterior');
      const sideBodyStart = startOf('side-body');
      const frontEndStart = startOf('front-end');
      const wheelsStart = startOf('wheels');
      const revealStart = startOf('reveal');

      // hero → orbit start (a short settle into the orbit's own framing)
      tl.to(camera.position, { ...orbitStartPose.position, duration: exteriorStart - heroStart, ease: 'power2.inOut' }, heroStart);
      tl.to(camera.rotation, { ...unwrap(orbitStartPose.rotation), duration: exteriorStart - heroStart, ease: 'power2.inOut' }, heroStart);

      // exterior stage — split into two phases inside its own window:
      // (a) an actual orbit sweep around the car (continuous rotation, not
      //     a jump between shots — "camera smoothly begins to orbit as the
      //     user scrolls" from the brief), then
      // (b) a dolly-in from the orbit's ending framing to the paint/body
      //     close-up, at the same angle it just arrived at, so there's no
      //     snap between "orbiting" and "zooming into the paint".
      const exteriorSpan = sideBodyStart - exteriorStart;
      const orbitPhaseSpan = exteriorSpan * 0.66;
      const dollyPhaseStart = exteriorStart + orbitPhaseSpan;
      const dollyPhaseSpan = exteriorSpan - orbitPhaseSpan;

      const orbitProxy = { angle: ORBIT_STAGE.azimuthStartDeg };
      tl.to(
        orbitProxy,
        {
          angle: ORBIT_STAGE.azimuthEndDeg,
          duration: orbitPhaseSpan,
          ease: 'none',
          onUpdate: () => {
            const pose = applySafety(
              buildPose({
                azimuthDeg: orbitProxy.angle,
                elevationFrac: ORBIT_STAGE.elevationFrac,
                distanceFrac: ORBIT_STAGE.distanceFrac,
                targetHeightFrac: ORBIT_STAGE.targetHeightFrac,
              }),
            );
            camera.position.set(pose.position.x, pose.position.y, pose.position.z);
            camera.rotation.set(pose.rotation.x, pose.rotation.y, pose.rotation.z);
            running.rotation = pose.rotation;
          },
        },
        exteriorStart,
      );

      // GSAP tweens `camera.position`/`camera.rotation` from whatever value
      // they currently hold, which is wherever the orbit's onUpdate loop
      // above just left them — no explicit "from" needed here.
      tl.to(camera.position, { ...sideBodyPose.position, duration: dollyPhaseSpan, ease: 'power2.inOut' }, dollyPhaseStart);
      tl.to(camera.rotation, { ...unwrap(sideBodyPose.rotation), duration: dollyPhaseSpan, ease: 'power2.inOut' }, dollyPhaseStart);

      // side-body → front-end (hood/grille)
      tl.to(camera.position, { ...frontEndPose.position, duration: frontEndStart - sideBodyStart, ease: 'power2.inOut' }, sideBodyStart);
      tl.to(camera.rotation, { ...unwrap(frontEndPose.rotation), duration: frontEndStart - sideBodyStart, ease: 'power2.inOut' }, sideBodyStart);

      // Subtle tan glow over the headlight/grille area during the
      // front-end stage — this is the stage it belongs to now (story order
      // is paint → hood → wheel; see carConfig.ts for why).
      if (glowRef.current) {
        const frontSpan = wheelsStart - frontEndStart;
        tl.fromTo(glowRef.current, { opacity: 0 }, { opacity: 0.8, duration: frontSpan * 0.4, ease: 'power1.out' }, frontEndStart);
        tl.to(glowRef.current, { opacity: 0, duration: frontSpan * 0.4, ease: 'power1.in' }, frontEndStart + frontSpan * 0.55);
      }

      // front-end → wheels
      tl.to(camera.position, { ...wheelsPose.position, duration: wheelsStart - frontEndStart, ease: 'power2.inOut' }, frontEndStart);
      tl.to(camera.rotation, { ...unwrap(wheelsPose.rotation), duration: wheelsStart - frontEndStart, ease: 'power2.inOut' }, frontEndStart);

      // wheels → reveal
      tl.to(camera.position, { ...revealPose.position, duration: revealStart - wheelsStart, ease: 'power2.inOut' }, wheelsStart);
      tl.to(camera.rotation, { ...unwrap(revealPose.rotation), duration: revealStart - wheelsStart, ease: 'power2.inOut' }, wheelsStart);

      // Where the car sits in the frame, sideways (desktop only — the rig
      // ignores this below the stacking breakpoint):
      //   hero (car slid right of the headline) → panel stages (car on the
      //   left, info card on the right) → reveal (centered, dropped below
      //   the finale text, full car).
      // The last ease is deliberately late in the wheels window so the car
      // doesn't drift under the info card while it's still on screen.
      viewShift.x = VIEW_SHIFT.hero.x;
      viewShift.y = VIEW_SHIFT.hero.y;
      tl.to(viewShift, { ...VIEW_SHIFT.panel, duration: exteriorStart - heroStart, ease: 'power2.inOut' }, heroStart);
      const wheelsSpan = revealStart - wheelsStart;
      tl.to(viewShift, { ...VIEW_SHIFT.reveal, duration: wheelsSpan * 0.5, ease: 'power2.inOut' }, wheelsStart + wheelsSpan * 0.5);

      ScrollTrigger.refresh();
    });
  }, []);

  useLayoutEffect(() => {
    if (reducedMotion) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: experienceRef.current,
          pin: pinRef.current,
          start: 'top top',
          end: 'bottom bottom',
          // A short lag (not `true`/instant) is what gives the camera its
          // slow, continuous, cinematic follow rather than tracking the
          // scrollbar 1:1.
          scrub: 1,
          anticipatePin: 1,
          onUpdate: (self) => {
            const id = getActiveStageId(self.progress);
            setActiveStageId((prev) => (prev === id ? prev : id));
            // No stage in the current 6-stage set defines subHighlights
            // (that was 'interior', which this asset doesn't have a camera
            // move for — see carConfig.ts) — always -1 for now. Left as a
            // real state slot rather than deleted so a future stage that
            // does define subHighlights doesn't need this re-added.
            setActiveSubHighlight(-1);
          },
        },
      });
      timelineRef.current = tl;
    }, experienceRef);

    gsapCtxRef.current = ctx;

    return () => {
      ctx.revert();
      timelineRef.current = null;
      gsapCtxRef.current = null;
    };
  }, [reducedMotion]);

  const contentId = activeStageId as ServiceStage['id'];
  const detailIndex = DETAIL_STAGES.findIndex((s) => s.id === contentId);
  const noPanel = isNoPanelStage(activeStageId);

  if (reducedMotion) {
    return <StaticExperience onBook={onBook} onViewServices={onViewServices} onNavigateStage={onNavigateStage} />;
  }

  return (
    <div className="experience" ref={experienceRef} style={{ height: `${EXPERIENCE_HEIGHT_VH}vh` }}>
      {/* Invisible deep-link targets for the navbar — GSAP ScrollSmoother
          auto-intercepts anchor clicks and animates to these positions. */}
      <span id="exterior" className="experience__anchor" style={{ top: anchorTop('exterior') }} />
      <span id="side-body" className="experience__anchor" style={{ top: anchorTop('side-body') }} />
      <span id="front-end" className="experience__anchor" style={{ top: anchorTop('front-end') }} />
      <span id="wheels" className="experience__anchor" style={{ top: anchorTop('wheels') }} />

      <div className="experience__pin" ref={pinRef}>
        <div className="car-scene-transform">
          <CarScene onReady={handleSceneReady} active={sceneActive} />
          <div className="car-scene__glow" ref={glowRef} aria-hidden="true" />
        </div>

        <Hero visible={activeStageId === 'hero'} onCtaClick={onBook} />

        <InfoPanel
          stage={getStage(contentId)}
          activeDetailIndex={detailIndex}
          activeSubHighlight={activeSubHighlight}
          visible={!noPanel}
          onViewPricing={onViewServices}
          onNavigateStage={onNavigateStage}
        />

        <FinalReveal
          visible={activeStageId === 'reveal'}
          onBook={onBook}
          onViewServices={onViewServices}
        />
      </div>
    </div>
  );
}

/** Non-pinned, non-scrubbed fallback for `prefers-reduced-motion: reduce`. */
function StaticExperience({
  onBook,
  onViewServices,
  onNavigateStage,
}: {
  onBook?: () => void;
  onViewServices?: () => void;
  onNavigateStage?: (id: string) => void;
}) {
  return (
    <div className="experience experience--static">
      <section className="experience__static-block">
        <Hero visible onCtaClick={onBook} />
      </section>
      {DETAIL_STAGES.map((stage, i) => (
        <section key={stage.id} className="experience__static-block" id={stage.id}>
          <div className="experience__static-scene">
            {i === 0 && <CarScene onReady={() => {}} />}
          </div>
          <InfoPanel
            stage={stage}
            activeDetailIndex={i}
            activeSubHighlight={-1}
            visible
            onViewPricing={onViewServices}
            onNavigateStage={onNavigateStage}
          />
        </section>
      ))}
      <section className="experience__static-block">
        <FinalReveal visible onBook={onBook} onViewServices={onViewServices} />
      </section>
    </div>
  );
}
