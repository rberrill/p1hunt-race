# P1 Hunt Race — Design Brief & Best-Practices Analysis

## Product Overview
**P1 Hunt Race** is a single-page, front-end-only race visualizer intended for giveaways or live-stream moments. Hosts paste a list of entrants, configure race duration, and run a stylized F1-inspired “camera-follow” sprint that culminates in a deterministic winner reveal on-screen.

The app has no backend dependency and runs entirely in-browser using:
- `index.html` for structure/UI controls
- `styles.css` for visual identity and animation styling
- `script.js` for game state, race simulation, and rendering orchestration

## Primary Users & Use Cases
### Users
- Streamers/hosts running audience giveaways.
- Event moderators needing a quick random visual winner picker.

### Core use cases
1. Paste entrant names (one per line) and load a grid.
2. Set race duration (10–120 seconds).
3. Start/pause/resume/reset race.
4. Display leader and winner in a polished “broadcast” style.

## Functional Design Summary
### Input & validation
- Names are sanitized by trimming empty lines and capping to 100 participants.
- Minimum participant threshold is 2 before race start is enabled.

### Race model
- Each racer is represented by a lane element + runtime properties (velocity, offsets, finish targets, seeds).
- Winner/order profile is generated on race start through shuffled order and offset curves.
- Motion is simulated per animation frame with easing, drift, and pace dynamics.

### Rendering approach
- Uses `requestAnimationFrame` loop (`tick`) to update racer positions, track motion, finish-line sweep, and status labels.
- Uses CSS transforms for movement, supporting smoother visual animation than layout-based repositioning.

### UX state machine (implicit)
States: `idle → ready → running ↔ paused → finished` (with `stopped` label available).

## Strengths
- **Zero-dependency architecture**: easy to deploy and run.
- **Clear separation by file role**: HTML/CSS/JS each serve a focused purpose.
- **Good baseline safety**: participant names are HTML-escaped before insertion.
- **Engaging polish**: dynamic palette generation, finish-line timing, and leader/winner badges make the result stream-ready.
- **Scalable participant count**: support up to 100 racers with adaptive lane sizing.

## Risks / Gaps
- **Monolithic JS module**: `script.js` combines domain logic, state transitions, rendering, and event wiring; maintainability risk as features grow.
- **Randomness/auditability**: outcome is random and not externally auditable, which may be sensitive for public giveaways.
- **Accessibility**: limited keyboard-first flow, no ARIA live region strategy for race updates, and high-motion visuals without reduced-motion path.
- **Persistence**: no localStorage/session support for saving entrant lists or presets.
- **Test coverage**: no unit/integration tests for deterministic core functions (sanitization, ranking, timing).

## Best-Practices Analysis & Recommendations

### 1) Architecture & Code Organization (High priority)
**Current:** One large script file.

**Recommended:**
- Split into modules:
  - `state.js` (state + transitions)
  - `simulation.js` (pack offsets, finish sequencing)
  - `render.js` (DOM updates/transforms)
  - `controls.js` (event bindings/input parsing)
- Keep pure math/logic functions side-effect free for easy testing.

**Benefit:** easier onboarding, safer refactors, smaller cognitive load.

### 2) Deterministic Fairness & Transparency (High priority)
**Current:** Uses `Math.random()` for winner profile and dynamics.

**Recommended:**
- Add optional “seed mode” in UI (`event code` input), and drive all randomness through one seeded PRNG.
- Log or display the seed + entrant hash before race start.

**Benefit:** reproducibility and credibility for public contests.

### 3) Accessibility & Inclusive UX (High priority)
**Recommended:**
- Add `aria-live="polite"` for leader/winner announcements.
- Provide keyboard shortcuts for Start/Pause/Resume/Reset.
- Respect `prefers-reduced-motion` to lower animation intensity or switch to simplified progression.
- Increase color-contrast checks for badges and muted text.

### 4) Resilience & Performance (Medium priority)
**Recommended:**
- Debounce `resizeTrack` listener.
- Guard against hidden-tab animation drift (consider Page Visibility API).
- Extract frequently updated DOM references once (already mostly done) and avoid unnecessary class toggles where unchanged.
- Consider a hard cap warning around 80+ participants for older machines.

### 5) Product Quality & Delivery Hygiene (Medium priority)
**Recommended:**
- Add lightweight test setup (Vitest/Jest + jsdom):
  - `sanitizeNames`
  - seeded PRNG determinism
  - state transition constraints
- Add CI checks: lint + format + tests.
- Expand README with usage, fairness note, and troubleshooting.

## Suggested Next Milestone (v1.1)
1. Introduce deterministic seed mode + race manifest (seed, entrants count, timestamp).
2. Refactor simulation/render/state into separate modules.
3. Add reduced-motion mode and ARIA live updates.
4. Add automated tests for core race logic.

These changes preserve the app’s visual charm while making it more trustworthy, maintainable, and production-ready for recurring events.
