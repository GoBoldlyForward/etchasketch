/*!
 * etchasketch.js
 * The classic Etch-A-Sketch toy as a drop-in web plugin.
 *
 * Arrow keys (or WASD) draw — and the two knobs spin in real time to match
 * the pen's motion, exactly like the toy. Click either knob, or shake your
 * phone, to clear. Pointer/touch drawing is opt-in via { cursor: true }.
 *
 * Version: 1.0.0
 * Author: Go Boldly Forward (https://goboldlyforward.com/)
 * Homepage: https://goboldlyforward.github.io/etchasketch/
 * License: MIT
 *
 * Pairs with etchasketch.css. Mount on an empty element:
 *
 *   const sketch = new EtchASketch('#toy', { penColor: '#1f1f1f' });
 *   sketch.clear();
 *   sketch.setOptions({ cursor: true });   // enable mouse/touch drag
 *
 * Options (all optional):
 *   penColor          CSS color of the line                      default '#1f1f1f'
 *   penWidth          Stroke width in CSS px                     default 2
 *   stepPx            Pixels per frame per held arrow key        default 1.8
 *   screenColor       Drawing-surface fill                       default '#b8b8a9'
 *   chrome            Render the red bezel + knobs               default true
 *   cursor            Allow pointer/touch drag to draw           default false
 *   shakeToErase      Listen for devicemotion + clear            default true
 *   shakeThreshold    Accel magnitude that counts as a shake     default 22
 *   knobsClickToClear Click either knob to clear                 default true
 *   knobDegPerPx      How fast knobs spin per pen pixel          default 2.2
 */

(function (global, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    global.EtchASketch = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULTS = {
    penColor: '#1f1f1f',
    penWidth: 2,
    stepPx: 1.8,
    screenColor: '#b8b8a9',
    chrome: true,
    cursor: false,
    shakeToErase: true,
    shakeThreshold: 22,
    knobsClickToClear: true,
    knobDegPerPx: 2.2,
  };

  // Per-frame (dx, dy) for each held key. Arrow keys are the headline
  // control; WASD is included so the toy is reachable on laptops where the
  // arrow cluster is awkward.
  const KEY_VECTORS = {
    ArrowLeft:  [-1,  0],
    ArrowRight: [ 1,  0],
    ArrowUp:    [ 0, -1],
    ArrowDown:  [ 0,  1],
    a: [-1, 0], A: [-1, 0],
    d: [ 1, 0], D: [ 1, 0],
    w: [ 0,-1], W: [ 0,-1],
    s: [ 0, 1], S: [ 0, 1],
  };

  class EtchASketch {
    constructor(target, options) {
      const host = typeof target === 'string' ? document.querySelector(target) : target;
      if (!host) throw new Error('EtchASketch: target element not found');

      this.host = host;
      this.options = Object.assign({}, DEFAULTS, options || {});

      this._keys = new Set();
      this._rafId = null;
      this._lastShakeAt = 0;
      this._pointerActive = false;
      this._pointerId = null;
      this._leftKnobDeg = 0;
      this._rightKnobDeg = 0;

      this._build();
      this._bindEvents();
      this._resize();
      this._resetPen();
      this._applyCursorMode();
    }

    clear() {
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = this.options.screenColor;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();
      this._resetPen();
      this._animateShake();
    }

    /** Move the pen to (x, y) in CSS pixels without drawing a line to it. */
    resetPenTo(x, y) {
      this.penX = x;
      this.penY = y;
    }

    setOptions(patch) {
      if (!patch) return;
      const prevScreen = this.options.screenColor;
      Object.assign(this.options, patch);
      if (patch.penColor != null || patch.penWidth != null) {
        this._applyStrokeStyle();
      }
      if (patch.screenColor != null && patch.screenColor !== prevScreen) {
        this._repaintScreen();
      }
      if (patch.cursor != null) {
        this._applyCursorMode();
      }
    }

    /** Returns a PNG data URL of the current drawing. */
    getDataURL(type) {
      return this.canvas.toDataURL(type || 'image/png');
    }

    /** Call from a user gesture on iOS to enable shake-to-clear. */
    enableShake() {
      if (!('DeviceMotionEvent' in window)) return Promise.resolve(false);
      if (typeof DeviceMotionEvent.requestPermission !== 'function') {
        return Promise.resolve(true);
      }
      return DeviceMotionEvent.requestPermission().then(state => {
        if (state === 'granted') {
          window.addEventListener('devicemotion', this._onMotion);
          return true;
        }
        return false;
      });
    }

    destroy() {
      this._unbindEvents();
      if (this._rafId) cancelAnimationFrame(this._rafId);
      if (this._ro) this._ro.disconnect();
      if (this._ownedNodes) this._ownedNodes.forEach(n => n.remove());
      this.host.classList.remove('etchasketch');
      this.host.classList.remove('etchasketch--bare');
      this.host.classList.remove('etchasketch--cursor');
    }

    _build() {
      const host = this.host;
      host.classList.add('etchasketch');
      this._ownedNodes = [];

      if (this.options.chrome) {
        const frame = document.createElement('div');
        frame.className = 'etchasketch__frame';

        for (const corner of ['tl', 'tr', 'bl', 'br']) {
          const screw = document.createElement('span');
          screw.className = `etchasketch__screw etchasketch__screw--${corner}`;
          screw.setAttribute('aria-hidden', 'true');
          frame.appendChild(screw);
        }

        const screen = document.createElement('div');
        screen.className = 'etchasketch__screen';

        const canvas = document.createElement('canvas');
        canvas.className = 'etchasketch__canvas';
        canvas.tabIndex = 0;
        canvas.setAttribute('role', 'application');
        canvas.setAttribute('aria-label', 'Etch-A-Sketch drawing surface. Use arrow keys to draw.');
        screen.appendChild(canvas);
        frame.appendChild(screen);

        const stamp = document.createElement('span');
        stamp.className = 'etchasketch__stamp';
        stamp.textContent = 'Magic Screen';
        stamp.setAttribute('aria-hidden', 'true');
        frame.appendChild(stamp);

        const leftKnob  = this._makeKnob('left');
        const rightKnob = this._makeKnob('right');
        frame.appendChild(leftKnob);
        frame.appendChild(rightKnob);

        host.appendChild(frame);
        this._ownedNodes.push(frame);

        this.frame = frame;
        this.screen = screen;
        this.canvas = canvas;
        this.leftKnob = leftKnob;
        this.rightKnob = rightKnob;
      } else {
        host.classList.add('etchasketch--bare');
        const canvas = document.createElement('canvas');
        canvas.className = 'etchasketch__canvas';
        canvas.tabIndex = 0;
        host.appendChild(canvas);
        this._ownedNodes.push(canvas);
        this.canvas = canvas;
        this.screen = host;
      }

      this.ctx = this.canvas.getContext('2d');
      this._applyStrokeStyle();
    }

    _makeKnob(side) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `etchasketch__knob etchasketch__knob--${side}`;
      btn.setAttribute('aria-label', side === 'left'
        ? 'Left knob — horizontal pen (click to clear)'
        : 'Right knob — vertical pen (click to clear)');
      // Rotate just the dial; outer mount stays static.
      const face = document.createElement('span');
      face.className = 'etchasketch__knob-face';
      btn.appendChild(face);
      return btn;
    }

    _applyStrokeStyle() {
      const ctx = this.ctx;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = this.options.penColor;
      ctx.lineWidth = this.options.penWidth;
    }

    _applyCursorMode() {
      const on = !!this.options.cursor;
      this.host.classList.toggle('etchasketch--cursor', on);
    }

    _resize() {
      const box = this.screen.getBoundingClientRect();
      const cssW = Math.max(1, Math.floor(box.width));
      const cssH = Math.max(1, Math.floor(box.height));
      const dpr = window.devicePixelRatio || 1;

      // Snapshot existing pixels so a resize doesn't wipe the drawing.
      let snap = null;
      if (this.canvas.width > 0 && this.canvas.height > 0 && this._initialized) {
        try {
          snap = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        } catch (e) { /* tainted or zero-size */ }
      }

      this.canvas.style.width = cssW + 'px';
      this.canvas.style.height = cssH + 'px';
      this.canvas.width = Math.floor(cssW * dpr);
      this.canvas.height = Math.floor(cssH * dpr);

      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.fillStyle = this.options.screenColor;
      this.ctx.fillRect(0, 0, cssW, cssH);
      this._applyStrokeStyle();

      if (snap) {
        const tmp = document.createElement('canvas');
        tmp.width = snap.width;
        tmp.height = snap.height;
        tmp.getContext('2d').putImageData(snap, 0, 0);
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.drawImage(tmp, 0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
      }

      this._cssWidth = cssW;
      this._cssHeight = cssH;
      this._initialized = true;

      if (this.penX == null || this.penX > cssW) this.penX = Math.floor(cssW / 2);
      if (this.penY == null || this.penY > cssH) this.penY = Math.floor(cssH / 2);
    }

    _repaintScreen() {
      // Canvas drawing is destructive — wipe + refill loses existing strokes.
      const ctx = this.ctx;
      const w = this._cssWidth;
      const h = this._cssHeight;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = this.options.screenColor;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();
      this._resetPen();
    }

    _resetPen() {
      this.penX = Math.floor(this._cssWidth / 2);
      this.penY = Math.floor(this._cssHeight / 2);
    }

    _bindEvents() {
      this._onKeyDown    = this._onKeyDown.bind(this);
      this._onKeyUp      = this._onKeyUp.bind(this);
      this._onBlur       = this._onBlur.bind(this);
      this._onPointerDown = this._onPointerDown.bind(this);
      this._onPointerMove = this._onPointerMove.bind(this);
      this._onPointerUp   = this._onPointerUp.bind(this);
      this._onKnobClick   = this._onKnobClick.bind(this);
      this._onMotion      = this._onMotion.bind(this);
      this._onResize      = this._onResize.bind(this);

      this.canvas.addEventListener('pointerdown', this._onPointerDown);
      this.canvas.addEventListener('pointermove', this._onPointerMove);
      window.addEventListener('pointerup', this._onPointerUp);
      this.canvas.addEventListener('keydown', this._onKeyDown);
      this.canvas.addEventListener('keyup',   this._onKeyUp);
      this.canvas.addEventListener('blur',    this._onBlur);

      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup',   this._onKeyUp);

      if (this.leftKnob)  this.leftKnob.addEventListener('click', this._onKnobClick);
      if (this.rightKnob) this.rightKnob.addEventListener('click', this._onKnobClick);

      if (typeof ResizeObserver !== 'undefined') {
        this._ro = new ResizeObserver(this._onResize);
        this._ro.observe(this.screen);
      } else {
        window.addEventListener('resize', this._onResize);
      }

      if (this.options.shakeToErase && 'DeviceMotionEvent' in window) {
        // iOS 13+ requires a separate enableShake() call after a user gesture.
        if (typeof DeviceMotionEvent.requestPermission !== 'function') {
          window.addEventListener('devicemotion', this._onMotion);
        }
      }
    }

    _unbindEvents() {
      this.canvas.removeEventListener('pointerdown', this._onPointerDown);
      this.canvas.removeEventListener('pointermove', this._onPointerMove);
      window.removeEventListener('pointerup', this._onPointerUp);
      this.canvas.removeEventListener('keydown', this._onKeyDown);
      this.canvas.removeEventListener('keyup',   this._onKeyUp);
      this.canvas.removeEventListener('blur',    this._onBlur);
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup',   this._onKeyUp);
      if (this.leftKnob)  this.leftKnob.removeEventListener('click', this._onKnobClick);
      if (this.rightKnob) this.rightKnob.removeEventListener('click', this._onKnobClick);
      window.removeEventListener('devicemotion', this._onMotion);
      window.removeEventListener('resize', this._onResize);
    }

    _onResize() { this._resize(); }

    _onKeyDown(e) {
      const v = KEY_VECTORS[e.key];
      if (!v) return;
      if (this._shouldClaimKey(e)) e.preventDefault();
      this._keys.add(e.key);
      this._startLoop();
    }

    _onKeyUp(e) {
      if (KEY_VECTORS[e.key]) this._keys.delete(e.key);
    }

    _onBlur() {
      this._keys.clear();
    }

    _shouldClaimKey(e) {
      const t = e.target;
      if (!t || t === document.body) return true;
      if (t === this.canvas) return true;
      const tag = (t.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return false;
      if (t.isContentEditable) return false;
      return true;
    }

    _onPointerDown(e) {
      if (!this.options.cursor) return;
      this.canvas.focus({ preventScroll: true });
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
      const { x, y } = this._pointerXY(e);
      // Snap pen to press — people expect their finger to *be* the pen tip.
      this.penX = x;
      this.penY = y;
      this._pointerActive = true;
      this._pointerId = e.pointerId;
      e.preventDefault();
    }

    _onPointerMove(e) {
      if (!this._pointerActive) return;
      const { x, y } = this._pointerXY(e);
      const cx = Math.max(0, Math.min(this._cssWidth,  x));
      const cy = Math.max(0, Math.min(this._cssHeight, y));
      this._strokeTo(cx, cy);
      e.preventDefault();
    }

    _onPointerUp(e) {
      if (!this._pointerActive) return;
      this._pointerActive = false;
      try { this.canvas.releasePointerCapture(this._pointerId); } catch (_) {}
      this._pointerId = null;
    }

    _pointerXY(e) {
      const rect = this.canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    _onKnobClick() {
      if (!this.options.knobsClickToClear) return;
      this.clear();
    }

    _onMotion(e) {
      const acc = e.accelerationIncludingGravity || e.acceleration;
      if (!acc) return;
      const mag = Math.hypot(acc.x || 0, acc.y || 0, acc.z || 0);
      if (mag < this.options.shakeThreshold) return;
      const now = Date.now();
      if (now - this._lastShakeAt < 800) return;
      this._lastShakeAt = now;
      this.clear();
    }

    _startLoop() {
      if (this._rafId) return;
      const tick = () => {
        this._rafId = null;
        this._step();
        if (this._keys.size > 0) this._startLoop();
      };
      this._rafId = requestAnimationFrame(tick);
    }

    _step() {
      let dx = 0, dy = 0;
      this._keys.forEach(k => {
        const v = KEY_VECTORS[k];
        if (v) { dx += v[0]; dy += v[1]; }
      });
      if (dx === 0 && dy === 0) return;
      // Normalize diagonals so two keys aren't ~1.41× the single-key speed.
      const len = Math.hypot(dx, dy) || 1;
      const step = this.options.stepPx;
      const nx = this.penX + (dx / len) * step;
      const ny = this.penY + (dy / len) * step;
      const cx = Math.max(0, Math.min(this._cssWidth,  nx));
      const cy = Math.max(0, Math.min(this._cssHeight, ny));
      this._strokeTo(cx, cy);
    }

    _strokeTo(x, y) {
      const ctx = this.ctx;
      const dx = x - this.penX;
      const dy = y - this.penY;
      ctx.beginPath();
      ctx.moveTo(this.penX, this.penY);
      ctx.lineTo(x, y);
      ctx.stroke();
      this.penX = x;
      this.penY = y;
      this._spinKnobs(dx, dy);
    }

    // Left knob mirrors horizontal axis, right knob mirrors vertical — like the real toy.
    _spinKnobs(dx, dy) {
      if (!this.leftKnob && !this.rightKnob) return;
      const per = this.options.knobDegPerPx;
      if (dx && this.leftKnob) {
        this._leftKnobDeg += dx * per;
        this.leftKnob.firstElementChild.style.transform = `rotate(${this._leftKnobDeg}deg)`;
      }
      if (dy && this.rightKnob) {
        this._rightKnobDeg += dy * per;
        this.rightKnob.firstElementChild.style.transform = `rotate(${this._rightKnobDeg}deg)`;
      }
    }

    _animateShake() {
      if (!this.frame) return;
      this.frame.classList.remove('etchasketch--shaking');
      // Force reflow so the animation restarts on rapid repeat-clears
      void this.frame.offsetWidth;
      this.frame.classList.add('etchasketch--shaking');
    }
  }

  return EtchASketch;
});
