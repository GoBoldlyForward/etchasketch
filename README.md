# etchasketch

The classic Etch-A-Sketch toy as a drop-in web plugin. Arrow keys move the pen — and the two knobs spin in real time to match, exactly like the toy. Click either knob or shake your phone to clear.

## Demo

[goboldlyforward.github.io/etchasketch](https://goboldlyforward.github.io/etchasketch/) — try the pen color, size, speed, screen color, and cursor controls.

## What it does

Drops a faithful Etch-A-Sketch into any container: a red plastic bezel with four corner screws, a recessed aluminum-gray drawing surface, and two grooved white knobs at the bottom. The left knob is the horizontal axis, the right knob is the vertical axis — pressing arrow keys (or WASD) draws on the screen *and* spins the corresponding knob in the right direction. Click either knob — or, on a phone, shake it — to clear.

## Install

For now, download `etchasketch.css` and `etchasketch.js` from this repo. (npm publication pending.)

```html
<link rel="stylesheet" href="path/to/etchasketch.css">
<script src="path/to/etchasketch.js"></script>
```

## Usage

```html
<div id="toy"></div>

<script>
  const sketch = new EtchASketch('#toy', {
    penColor: '#1f1f1f',
    penWidth: 2,
    stepPx: 1.8,
  });

  // Live-tune anything, anytime.
  sketch.setOptions({
    penColor:    '#d8231c',   // any CSS color
    penWidth:    3,
    stepPx:      2.5,         // pixels per frame per held arrow
    screenColor: '#cfd8e6',   // aluminum, mint, sky, sand, slate, cream, or any color
    cursor:      true,        // also allow mouse/touch drag drawing
  });
</script>
```

`new EtchASketch(target, options?)` mounts the chrome + canvas into `target` (selector or element) and starts listening for keys.

## Controls

| Input                             | Effect                                                |
| --------------------------------- | ----------------------------------------------------- |
| <kbd>→</kbd> / <kbd>D</kbd>       | Pen right; **left knob spins clockwise**              |
| <kbd>←</kbd> / <kbd>A</kbd>       | Pen left; **left knob spins counterclockwise**        |
| <kbd>↓</kbd> / <kbd>S</kbd>       | Pen down; **right knob spins clockwise**              |
| <kbd>↑</kbd> / <kbd>W</kbd>       | Pen up; **right knob spins counterclockwise**         |
| Hold two arrows                   | Diagonal (normalized — same speed as a single arrow)  |
| Click either knob                 | Clear the screen (with shake animation)               |
| Shake the phone (devicemotion)    | Clear the screen                                      |
| Mouse / touch drag                | Draw — only if `{ cursor: true }`                     |

## Options

```js
new EtchASketch('#toy', {
  penColor:          '#1f1f1f',  // CSS color of the line
  penWidth:          2,          // stroke width, px
  stepPx:            1.8,        // pen pixels per frame per held arrow
  screenColor:       '#b8b8a9',  // background fill (defaults to aluminum gray)
  chrome:            true,       // render the red bezel + knobs (false = headless canvas)
  cursor:            false,      // allow mouse/touch drag to draw (off = classic mode)
  shakeToErase:      true,       // listen for devicemotion and clear on a hard shake
  shakeThreshold:    22,         // accelerometer magnitude required (m/s²)
  knobsClickToClear: true,       // click either knob to clear
  knobDegPerPx:      2.2,        // how fast each knob spins per pen pixel
});
```

Any of these can be passed at construction time or later via `setOptions()` — the relevant CSS / canvas state is updated live.

## Methods

```js
sketch.clear();                        // wipe the screen + run the shake animation
sketch.setOptions({ ... });            // merge + apply (hot-swap any option)
sketch.getDataURL('image/png');        // PNG data URL of the current drawing
sketch.enableShake();                  // call from a user gesture on iOS to grant motion access
sketch.resetPenTo(x, y);               // move the pen without drawing a line
sketch.destroy();                      // tear down DOM + listeners
```

## Cursor mode

By default, only the keyboard (and the real-toy knobs) move the pen. That keeps the experience faithful to the original 1960s Magic Screen — and means mouse/touch input on the canvas does nothing.

To allow mouse and touch drag drawing:

```js
sketch.setOptions({ cursor: true });
```

When `cursor: true`, the canvas shows a crosshair cursor, the pen jumps to wherever the user presses (mouse or finger), and dragging strokes a line that the knobs also follow.

## Headless mode

Skip the red bezel + knobs entirely:

```js
new EtchASketch('#raw', { chrome: false });
```

You get just the canvas inside your host element. Useful when you want to paint the Etch-A-Sketch interaction model onto your own design.

## How the knob spin works

Each call to the internal `_strokeTo(x, y)` computes the (dx, dy) of the pen step and applies `dx * knobDegPerPx` to the left knob's cumulative rotation, `dy * knobDegPerPx` to the right knob's. The rotation is then written straight to the dial's `transform` (no CSS transition), so the spin is perfectly synchronous with the line. Knob rotation accumulates across the whole session — clearing does not reset it, just like the real toy.

## Requirements

HTML, CSS, and ~6KB of JavaScript. No framework, no build step. Uses `<canvas>`, `PointerEvent`, and `ResizeObserver`.

## Roadmap

- [x] Canvas-based drawing with crisp DPR rendering
- [x] Arrow key + WASD input with diagonal normalization
- [x] Live-tunable pen color / size / speed / screen color
- [x] Knob rotation synced to pen motion
- [x] Cursor mode (mouse/touch drag) as an opt-in
- [x] Shake-to-clear via `DeviceMotionEvent` (iOS permission flow included)
- [x] Headless `chrome: false` mode
- [x] Demo with full controls panel
- [ ] Publish to npm (as `@goboldlyforward/etchasketch`)
- [ ] Optional `etchasketch-rails` gem wrapper
- [ ] Save/load drawings to localStorage
- [ ] Multi-color undo (Magic Screen with layers)
- [ ] Drag the knobs themselves to rotate (mobile-first knob control)
- [ ] Theme presets (Pocket, Classic, Travel)

## License

MIT — see [LICENSE](LICENSE).
