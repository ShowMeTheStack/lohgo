// The turtle world on screen: scaling, zoom, the grid, the turtle readout, and the mouse and
// keyboard as a running program sees them.
(function (LG) {
  'use strict';
  const { h, icon } = LG.UI;

  // key codes as FMSLogo's KEYBOARDVALUE reports them
  const VK = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Enter: 13, Escape: 27, Backspace: 8, Tab: 9, ' ': 32, Delete: 46, Home: 36, End: 35, PageUp: 33, PageDown: 34 };
  const ARROW_WORD = { ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN' };

  class TurtleView extends LG.Emitter {
    constructor(app, world) {
      super();
      this.app = app;
      this.world = world;
      this.wrap = document.getElementById('worldWrap');
      this.canvas = document.getElementById('worldCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.zoomK = 1;
      this.pan = [0, 0];
      this.keys = [];
      this.mouse = [0, 0];
      this.click = [0, 0];
      this.btn = 0;
      this.grid = !!app.settings.grid;
      this.view = { x: 0, y: 0, w: 1, h: 1 };
      world.on('dirty', () => this.schedule());
      new ResizeObserver(() => this.resize()).observe(this.wrap);
      this.bind();
      this.buildTools();
      this.buildKeys();
      this.resize();
    }

    // ---- layout ---------------------------------------------------------------------------
    resize() {
      const r = this.wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      this.dpr = dpr;
      const w = Math.max(1, Math.round(r.width * dpr)), hh = Math.max(1, Math.round(r.height * dpr));
      if (this.canvas.width !== w || this.canvas.height !== hh) { this.canvas.width = w; this.canvas.height = hh; }
      this.layout();
      this.draw();
    }
    layout() {
      const W = this.world.W, H = this.world.H;
      const cw = this.canvas.width, ch = this.canvas.height;
      const pad = Math.round(12 * this.dpr);
      const fit = Math.min((cw - 2 * pad) / W, (ch - 2 * pad) / H);
      const k = Math.max(0.05, fit * this.zoomK);
      const vw = W * k, vh = H * k;
      this.view = { x: Math.round((cw - vw) / 2 + this.pan[0] * this.dpr), y: Math.round((ch - vh) / 2 + this.pan[1] * this.dpr), w: vw, h: vh, k };
    }
    setZoom(z, keepPan) {
      this.zoomK = LG.clamp(z, 0.25, 12);
      if (!keepPan && this.zoomK <= 1) this.pan = [0, 0];
      this.layout();
      this.draw();
      this.updateZoomChip();
    }
    schedule() {
      if (this.pending) return;
      this.pending = true;
      requestAnimationFrame(() => { this.pending = false; this.draw(); });
    }
    draw() {
      const c = this.ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, this.canvas.width, this.canvas.height);
      const v = this.view;
      // the world sits on the desk like a sheet of paper
      c.save();
      c.shadowColor = 'rgba(40,30,10,.28)';
      c.shadowBlur = 18 * this.dpr;
      c.shadowOffsetY = 4 * this.dpr;
      c.fillStyle = this.world.css(this.world.bg);
      c.fillRect(v.x, v.y, v.w, v.h);
      c.restore();
      this.world.render(c, v, { grid: this.grid, turtleStyle: this.app.settings.turtleStyle });
      this.updateHud();
    }
    updateHud() {
      const t = this.world.current;
      const f = (x) => (Math.abs(x - Math.round(x)) < 0.05 ? Math.round(x) : x.toFixed(1));
      const s = 'x ' + f(t.x) + '   y ' + f(t.y) + '   ' + f(t.heading) + '°' + (t.penDown ? '' : '   pen up');
      if (s !== this.hudText) {
        this.hudText = s;
        this.posChip.textContent = s;
        const sb = document.getElementById('sbTurtle');
        if (sb) sb.textContent = s;
      }
    }

    // ---- toolbar ----------------------------------------------------------------------------
    buildTools() {
      const tools = document.getElementById('worldTools');
      const b = (ic, title, fn, id) => { const x = h('button.ibtn', { type: 'button', title, 'aria-label': title, id }, icon(ic)); x.addEventListener('click', fn); tools.appendChild(x); return x; };
      this.gridBtn = b('grid', 'Graph paper grid', () => this.toggleGrid(), 'tbGrid');
      this.gridBtn.classList.toggle('on', this.grid);
      b('zoomOut', 'Zoom out', () => this.setZoom(this.zoomK / 1.25), 'tbZoomOut');
      b('target', 'Fit the whole world', () => { this.pan = [0, 0]; this.setZoom(1); }, 'tbZoomFit');
      b('zoomIn', 'Zoom in', () => this.setZoom(this.zoomK * 1.25), 'tbZoomIn');
      b('camera', 'Save the drawing as a picture', () => this.app.savePicture(), 'tbSnap');
      b('full', 'Big turtle world (F4)', () => this.app.toggleBigWorld(), 'tbBig');
      const hud = document.getElementById('worldHud');
      this.posChip = h('span.chip', { id: 'turtleChip' });
      this.zoomChip = h('span.chip.hidden', { id: 'zoomChip' });
      hud.appendChild(this.posChip);
      hud.appendChild(this.zoomChip);
    }
    updateZoomChip() {
      this.zoomChip.textContent = Math.round(this.zoomK * 100) + '%';
      this.zoomChip.classList.toggle('hidden', Math.abs(this.zoomK - 1) < 1e-6);
    }
    toggleGrid(on) {
      this.grid = on === undefined ? !this.grid : !!on;
      this.app.settings.grid = this.grid;
      this.app.saveSettings();
      this.gridBtn.classList.toggle('on', this.grid);
      this.draw();
    }
    buildKeys() {
      const box = document.getElementById('worldKeys');
      const key = (label, k, cls) => {
        const b = h('button.key' + (cls ? '.' + cls : ''), { type: 'button', 'aria-label': k }, label);
        const fire = (e) => { e.preventDefault(); this.keyDown({ key: k, code: k, preventDefault() {} }, true); };
        b.addEventListener('pointerdown', fire);
        return b;
      };
      const pad = h('div.keypad', key('▲', 'ArrowUp', 'k-up'), key('◀', 'ArrowLeft', 'k-left'), key('▼', 'ArrowDown', 'k-down'), key('▶', 'ArrowRight', 'k-right'));
      const col = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'flex-end' } }, key('Space', ' '), key('Enter', 'Enter'));
      const kb = h('button.key', { type: 'button', title: 'Keyboard', 'aria-label': 'Show keyboard' }, icon('keyboard'));
      kb.querySelector('svg').style.width = '20px';
      kb.addEventListener('click', () => this.app.commander.focusForKeys());
      box.appendChild(h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'flex-end' } }, kb, key('Esc', 'Escape')));
      box.appendChild(col);
      box.appendChild(pad);
    }

    // ---- input ------------------------------------------------------------------------------
    toWorld(e) {
      const r = this.canvas.getBoundingClientRect();
      const px = (e.clientX - r.left) * this.dpr, py = (e.clientY - r.top) * this.dpr;
      const v = this.view;
      const x = (px - v.x) / v.k - this.world.W / 2;
      const y = this.world.H / 2 - (py - v.y) / v.k;
      return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
    }
    bind() {
      const c = this.canvas;
      const I = () => this.app.interp;
      let dragging = null;
      c.addEventListener('pointermove', (e) => {
        this.mouse = this.toWorld(e);
        const sb = document.getElementById('sbPos');
        if (sb) sb.textContent = 'mouse ' + this.mouse[0] + ', ' + this.mouse[1];
        if (dragging) {
          this.pan = [dragging.px + (e.clientX - dragging.x), dragging.py + (e.clientY - dragging.y)];
          this.layout(); this.draw();
          return;
        }
        const hd = I().handlers && I().handlers.mouse;
        if (hd && hd.move !== LG.Data.NIL && I().events.length < 4) I().queueEvent(hd.move);
      });
      c.addEventListener('pointerdown', (e) => {
        c.focus({ preventScroll: true });
        this.mouse = this.toWorld(e);
        this.click = this.mouse.slice();
        this.btn = e.button === 2 ? 2 : e.button === 1 ? 3 : 1;
        const hd = I().handlers && I().handlers.mouse;
        if (hd) { I().queueEvent(this.btn === 2 ? hd.rdown : hd.ldown); return; }
        if (this.zoomK > 1 && !this.app.isBusy()) {
          dragging = { x: e.clientX, y: e.clientY, px: this.pan[0], py: this.pan[1] };
          c.setPointerCapture(e.pointerId);
        }
        this.emit('click', this.click);
      });
      const up = (e) => {
        const b = this.btn;
        this.btn = 0;
        if (dragging) { dragging = null; return; }
        const hd = I().handlers && I().handlers.mouse;
        if (hd && b) I().queueEvent(b === 2 ? hd.rup : hd.lup);
        void e;
      };
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', up);
      c.addEventListener('contextmenu', (e) => { if (I().handlers && I().handlers.mouse) e.preventDefault(); });
      c.addEventListener('wheel', (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        this.setZoom(this.zoomK * (e.deltaY < 0 ? 1.12 : 1 / 1.12), true);
      }, { passive: false });
      c.addEventListener('keydown', (e) => this.keyDown(e));
      c.addEventListener('keyup', (e) => {
        const hd = I().handlers && I().handlers.key;
        if (hd && hd.up !== LG.Data.NIL) { I().lastKeyValue = this.vk(e); I().queueEvent(hd.up); }
      });
    }
    vk(e) {
      if (VK[e.key] !== undefined) return VK[e.key];
      if (e.key && e.key.length === 1) { const c = e.key.toUpperCase().charCodeAt(0); return c; }
      return 0;
    }
    /** A key pressed while the turtle world has focus goes to the running program */
    keyDown(e, synthetic) {
      const I = this.app.interp;
      if (!synthetic && (e.ctrlKey || e.metaKey || e.altKey)) return;
      if (!synthetic && /^F\d+$/.test(e.key)) return;
      if (e.key === 'Escape' && !synthetic && !this.app.isBusy() && !(I.handlers && I.handlers.key)) return;
      const busy = this.app.isBusy() || (I.handlers && (I.handlers.key || I.handlers.mouse));
      if (!busy) return;
      e.preventDefault();
      if (I.handlers && I.handlers.key) {
        I.lastKeyValue = this.vk(e);
        I.queueEvent(I.handlers.key.down);
      }
      let ch = null;
      if (ARROW_WORD[e.key]) ch = ARROW_WORD[e.key];
      else if (e.key === 'Enter') ch = '\n';
      else if (e.key === 'Escape') ch = String.fromCharCode(27);
      else if (e.key === 'Backspace') ch = String.fromCharCode(8);
      else if (e.key === 'Tab') ch = '\t';
      else if (e.key && e.key.length === 1) ch = e.key;
      if (ch === null) return;
      this.pushKey(ch);
    }
    pushKey(ch) {
      const I = this.app.interp;
      const top = I.stack[I.stack.length - 1];
      if (top && top.wantInput === 'char' && !I.reader) { I.provideInput(ch); return; }
      if (this.keys.length < 64) this.keys.push(ch);
    }
    /** The program's view of the keyboard and mouse */
    io() {
      return {
        keyp: () => this.keys.length > 0,
        readKey: () => (this.keys.length ? this.keys.shift() : null),
        mousePos: () => this.mouse,
        clickPos: () => this.click,
        button: () => this.btn,
        zoom: (k) => this.setZoom(k),
      };
    }
    reset() { this.keys = []; }
    snapshotDataURL() {
      const out = document.createElement('canvas');
      out.width = this.world.W * 2; out.height = this.world.H * 2;
      const c = out.getContext('2d');
      this.world.render(c, { x: 0, y: 0, w: out.width, h: out.height }, { turtleStyle: this.app.settings.turtleStyle });
      return out.toDataURL('image/png');
    }
  }

  LG.TurtleView = TurtleView;
})(LG);
