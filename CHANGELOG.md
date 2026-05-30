# Changelog

## 1.0.0 — 2026

Initial release. The classic Etch-A-Sketch toy as a drop-in web plugin —
no framework, no build step, ~6KB of JS.

### Features
- `new EtchASketch(target, options?)` mounts a red plastic bezel,
  recessed aluminum-gray screen, and two white grooved knobs into any
  host element.
- Arrow keys (and WASD) move the pen; the **left knob spins clockwise
  on right arrow / counterclockwise on left arrow**, and the **right
  knob spins clockwise on down arrow / counterclockwise on up arrow** —
  exactly like the real toy.
- Hold two arrows for diagonals (normalized so diagonals don't move
  ~1.41× faster than the cardinal directions).
- Click either knob — or shake your phone (devicemotion) — to clear.
  iOS 13+ requires a user-gesture grant via `enableShake()`.
- `cursor` option (default `false`) gates click-drag / touch-drag
  drawing. Off = the classic knob-only experience; on = also draw with
  the mouse or your finger.
- Six built-in screen colors via demo swatches: aluminum, mint, sky,
  sand, slate, cream. Any CSS color works via `setOptions({
  screenColor })`.
- Live-tune `penColor`, `penWidth`, `stepPx`, `screenColor`, and
  `cursor` at any time.
- DPR-aware canvas rendering (sharp on Retina/HiDPI).
- `ResizeObserver`-driven auto-resize that preserves the drawing
  across resizes.
- Decorative chrome: four corner screws with Phillips-head slots, a
  subtly embossed "Magic Screen" stamp between the knobs, and a
  60-frame shake keyframe that runs on every `clear()`.
- Methods: `clear`, `setOptions`, `getDataURL`, `enableShake`,
  `resetPenTo`, `destroy`.
- `chrome: false` headless mode for raw drawing on your own surface.

### Package
- Name: `@goboldlyforward/etchasketch` (scoped, `publishConfig.access:
  public`).
- License: MIT.
- Files: `etchasketch.js`, `etchasketch.css`, `README.md`, `LICENSE`,
  `CHANGELOG.md`.
