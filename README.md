# Detail Co. — Premium Automotive Detailing Site

A dark, cinematic, scroll-driven detailing site built with **React + TypeScript + Vite**,
**GSAP (ScrollTrigger + ScrollSmoother)**, and a **Spline** 3D car scene. One master
scroll timeline drives the camera through the vehicle — exterior → wheels → interior →
deep clean → final reveal — while a synced info panel narrates each stage.

## Run it

```bash
npm install   # already done
npm run dev   # http://localhost:5173
npm run build # production build (tsc + vite)
```

## ⚠️ Three things you need to fill in before this is "your" site

Everything below lives in `src/config/` and `src/data/` — nothing else in the codebase
hardcodes scene names, camera positions, copy, or prices.

### 1. Your real Spline scene — [`src/config/splineConfig.ts`](src/config/splineConfig.ts)

You shared a **public viewer link** (`my.spline.design/...`), but that's the hosted page,
not the raw scene asset `<Spline scene="...">` needs. Get the real one from:

> Spline editor → **File → Export → Code Export → React** → copy the
> `https://prod.spline.design/XXXX/scene.splinecode` URL

Paste it into `SPLINE_SCENE_URL`. The current value is a best-guess placeholder derived
from your share link and will 403 until replaced (the site handles this gracefully —
see "Resilience" below).

Then open your scene's **Layers panel** and copy the exact names of:
- your active **Camera**
- the **car body/root** group
- each **wheel** (or just one, if that's all you want to focus on)
- optionally a **light** to brighten for the final reveal

into `OBJECT_NAMES`. Any name that doesn't match your scene is just skipped at runtime
(with a console warning) — it won't break anything.

### 2. Camera choreography — same file, `CAMERA_KEYFRAMES`

One position/rotation keyframe per stage (hero, exterior, wheels, interior, deep-clean,
reveal), in the same units as Spline's own Transform panel. GSAP tweens the live camera
between them as the user scrolls. These are placeholder numbers — load your real scene,
scrub the page, and nudge the numbers until the camera lands where you want for each
stage. `CAR_IDLE_ROTATION_DEG` is the slow total rotation applied to the car root across
the whole experience.

Stage scroll-distance boundaries (how much scroll each stage gets) live in
[`src/config/scrollStages.ts`](src/config/scrollStages.ts).

### 3. Copy & pricing — [`src/data/services.ts`](src/data/services.ts)

Every headline, description, bullet list, and **price is a placeholder** (no pricing
sheet was supplied). Edit the `SERVICE_STAGES` array — the layout doesn't need to change.

Contact details (used by the footer's booking button, currently a `mailto:` link) are in
[`src/config/siteConfig.ts`](src/config/siteConfig.ts).

### Optional: fallback poster

Drop a still render/screenshot of your car at `public/car-fallback.jpg` — it's shown if
the live scene ever fails to load (see below), instead of a blank area.

## How the scroll experience is wired

- `ScrollExperience.tsx` creates **one** `gsap.timeline` on a `ScrollTrigger` that pins
  the 3D scene + info panel for `EXPERIENCE_HEIGHT_VH` (650vh) of scroll and scrubs
  through it 1:1.
- The camera/car tweens are added to that timeline once the Spline scene finishes
  loading (`CarScene`'s `onReady`), so the pin/panel/stage-rail all work immediately —
  the 3D camera control layers in on top once available.
- Which stage is "active" (drives the info panel + stage rail) is derived from the
  timeline's scroll progress, not tracked separately — they can't drift out of sync.
- `App.tsx` wraps the page in GSAP **ScrollSmoother** for the inertia/easing feel, and
  the navbar's links call `smoother.scrollTo(...)` to jump between stages.

## Resilience

- **Bad/placeholder scene URL, network failure, or an incompatible export**: the Spline
  runtime auto-selects WebGPU where available and transparently falls back to WebGL
  everywhere else, so there's no hard "unsupported browser" gate in this codebase. If
  the scene still fails to load (as the placeholder URL currently will), `CarScene` is
  wrapped in an error boundary and falls back to the static poster / a plain dark
  background — the rest of the page (nav, hero, info panels, pricing, footer) keeps
  working normally.
- **`prefers-reduced-motion: reduce`**: the pinned/scrubbed experience is skipped
  entirely in favor of a plain stacked-sections layout with native scrolling
  (see `StaticExperience` in `ScrollExperience.tsx`).
- **Mobile**: the same pinned scroll mechanic is used (so the 3D stays interactive
  while scrolling), but the layout switches from an absolute-positioned side panel to a
  stacked flex column — 3D on top, one text panel below, whichever stage is active.

## Structure

```
src/
  config/
    splineConfig.ts   — scene URL, object names, camera keyframes  ⚠️ edit me
    scrollStages.ts   — per-stage scroll-progress boundaries
    siteConfig.ts     — brand name + contact email               ⚠️ edit me
  data/
    services.ts       — all copy + pricing per stage              ⚠️ edit me
  components/
    Navbar, Hero, CarScene, ScrollExperience, InfoPanel,
    DetailStage, FinalReveal, CTA, Footer
  hooks/
    useReducedMotion.ts
  lib/
    math.ts
```
