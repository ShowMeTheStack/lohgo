// The turtle world: turtles, pens, the drawing, colours, fills and labels.
// World coordinates have (0,0) in the middle, y up, heading 0 = north, turning clockwise.
// The drawing lives on its own transparent canvas at SCALE times the world size; the
// background colour and the turtles are painted when the world is rendered, so changing
// the background never touches the drawing.
(function (LG) {
  'use strict';

  const W = 800, H = 600, SCALE = 2;
  const DEG = Math.PI / 180;

  // Berkeley Logo's standard colours 0-15
  const PALETTE = [
    [0, 0, 0], [0, 0, 255], [0, 255, 0], [0, 255, 255], [255, 0, 0], [255, 0, 255], [255, 255, 0], [255, 255, 255],
    [155, 96, 59], [197, 136, 18], [100, 162, 64], [120, 187, 187], [255, 149, 119], [144, 113, 208], [255, 163, 0], [183, 183, 183],
  ];
  const NAMES = ['black', 'blue', 'green', 'cyan', 'red', 'magenta', 'yellow', 'white', 'brown', 'tan', 'forest', 'aqua', 'salmon', 'purple', 'orange', 'grey'];

  // CSS colour names (beyond the 16 Logo ones), so names work the same everywhere
  const CSS_NAMES = { aliceblue: 0xf0f8ff, antiquewhite: 0xfaebd7, aqua: 0x00ffff, aquamarine: 0x7fffd4, azure: 0xf0ffff, beige: 0xf5f5dc, bisque: 0xffe4c4, black: 0x000000, blanchedalmond: 0xffebcd, blue: 0x0000ff, blueviolet: 0x8a2be2, brown: 0xa52a2a, burlywood: 0xdeb887, cadetblue: 0x5f9ea0, chartreuse: 0x7fff00, chocolate: 0xd2691e, coral: 0xff7f50, cornflowerblue: 0x6495ed, cornsilk: 0xfff8dc, crimson: 0xdc143c, cyan: 0x00ffff, darkblue: 0x00008b, darkcyan: 0x008b8b, darkgoldenrod: 0xb8860b, darkgray: 0xa9a9a9, darkgreen: 0x006400, darkgrey: 0xa9a9a9, darkkhaki: 0xbdb76b, darkmagenta: 0x8b008b, darkolivegreen: 0x556b2f, darkorange: 0xff8c00, darkorchid: 0x9932cc, darkred: 0x8b0000, darksalmon: 0xe9967a, darkseagreen: 0x8fbc8f, darkslateblue: 0x483d8b, darkslategray: 0x2f4f4f, darkturquoise: 0x00ced1, darkviolet: 0x9400d3, deeppink: 0xff1493, deepskyblue: 0x00bfff, dimgray: 0x696969, dodgerblue: 0x1e90ff, firebrick: 0xb22222, floralwhite: 0xfffaf0, forestgreen: 0x228b22, fuchsia: 0xff00ff, gainsboro: 0xdcdcdc, ghostwhite: 0xf8f8ff, gold: 0xffd700, goldenrod: 0xdaa520, gray: 0x808080, green: 0x008000, greenyellow: 0xadff2f, honeydew: 0xf0fff0, hotpink: 0xff69b4, indianred: 0xcd5c5c, indigo: 0x4b0082, ivory: 0xfffff0, khaki: 0xf0e68c, lavender: 0xe6e6fa, lavenderblush: 0xfff0f5, lawngreen: 0x7cfc00, lemonchiffon: 0xfffacd, lightblue: 0xadd8e6, lightcoral: 0xf08080, lightcyan: 0xe0ffff, lightgoldenrodyellow: 0xfafad2, lightgray: 0xd3d3d3, lightgreen: 0x90ee90, lightgrey: 0xd3d3d3, lightpink: 0xffb6c1, lightsalmon: 0xffa07a, lightseagreen: 0x20b2aa, lightskyblue: 0x87cefa, lightslategray: 0x778899, lightsteelblue: 0xb0c4de, lightyellow: 0xffffe0, lime: 0x00ff00, limegreen: 0x32cd32, linen: 0xfaf0e6, maroon: 0x800000, mediumaquamarine: 0x66cdaa, mediumblue: 0x0000cd, mediumorchid: 0xba55d3, mediumpurple: 0x9370db, mediumseagreen: 0x3cb371, mediumslateblue: 0x7b68ee, mediumspringgreen: 0x00fa9a, mediumturquoise: 0x48d1cc, mediumvioletred: 0xc71585, midnightblue: 0x191970, mintcream: 0xf5fffa, mistyrose: 0xffe4e1, moccasin: 0xffe4b5, navajowhite: 0xffdead, navy: 0x000080, oldlace: 0xfdf5e6, olive: 0x808000, olivedrab: 0x6b8e23, orangered: 0xff4500, orchid: 0xda70d6, palegoldenrod: 0xeee8aa, palegreen: 0x98fb98, paleturquoise: 0xafeeee, palevioletred: 0xdb7093, papayawhip: 0xffefd5, peachpuff: 0xffdab9, peru: 0xcd853f, pink: 0xffc0cb, plum: 0xdda0dd, powderblue: 0xb0e0e6, rebeccapurple: 0x663399, rosybrown: 0xbc8f8f, royalblue: 0x4169e1, saddlebrown: 0x8b4513, sandybrown: 0xf4a460, seagreen: 0x2e8b57, seashell: 0xfff5ee, sienna: 0xa0522d, silver: 0xc0c0c0, skyblue: 0x87ceeb, slateblue: 0x6a5acd, slategray: 0x708090, snow: 0xfffafa, springgreen: 0x00ff7f, steelblue: 0x4682b4, teal: 0x008080, thistle: 0xd8bfd8, tomato: 0xff6347, turquoise: 0x40e0d0, violet: 0xee82ee, wheat: 0xf5deb3, whitesmoke: 0xf5f5f5, yellowgreen: 0x9acd32 };

  const SHAPES = ['turtle', 'triangle', 'arrow', 'circle', 'square', 'star', 'none'];

  function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    return null;
  }

  class Turtle {
    constructor(id) {
      this.id = id;
      this.x = 0; this.y = 0; this.heading = 0;
      this.penDown = true; this.penMode = 'paint';
      this.color = { v: 0, rgb: PALETTE[0] };
      this.size = 1;
      this.shown = true;
      this.shape = 'turtle';
      this.labelHeight = 14;
      this.pattern = null;
    }
  }

  class TurtleWorld extends LG.Emitter {
    constructor(opts) {
      super();
      opts = opts || {};
      this.W = W; this.H = H; this.S = SCALE;
      this.canvas = opts.headless ? null : makeCanvas(W * SCALE, H * SCALE);
      this.ctx = this.canvas ? this.canvas.getContext('2d', { willReadFrequently: true }) : null;
      this.palette = PALETTE.map((c) => c.slice());
      this.reset();
    }
    reset() {
      this.turtles = [new Turtle(0)];
      this.cur = 0;            // SETTURTLE
      this.active = [0];       // TELL
      this.mode = 'window';
      this.bg = { v: 7, rgb: this.palette[7] };
      this.flood = null;
      this.scrunch = [1, 1];
      this.screenMode = 'split';
      this.segments = 0;
      this.paths = null;       // recording for FILLED
      this.log = [];           // headless record of drawing
      this.clean();
    }

    // ---- turtles ---------------------------------------------------------------------------
    t(i) {
      let t = this.turtles[i];
      if (!t) { for (let k = this.turtles.length; k <= i; k++) { this.turtles[k] = new Turtle(k); this.turtles[k].shown = k === i; } t = this.turtles[i]; }
      return t;
    }
    get current() { return this.t(this.active[0]); }
    each(fn) { let r; for (const i of this.active) r = fn(this.t(i)); this.changed(); return r; }
    setTurtle(i) { this.t(i); this.cur = i; this.active = [i]; this.changed(); }
    tell(list) { this.active = list.slice(); list.forEach((i) => this.t(i)); this.changed(); }

    // ---- colours ----------------------------------------------------------------------------
    /** Turn a colour input (index, [r g b], a name or #rrggbb) into {v, rgb} */
    color(v, D) {
      if (typeof v === 'number' || (typeof v === 'string' && D.isNumberWord(v))) {
        const i = Math.trunc(D.num(v));
        if (i < 0) return null;
        const rgb = this.palette[i] || (i < 256 ? [0, 0, 0] : null);
        return rgb ? { v: i, rgb } : null;
      }
      if (D.isList(v)) {
        const a = D.toArray(v).map((x) => D.num(x));
        if (a.length !== 3 || a.some((x) => Number.isNaN(x))) return null;
        return { v, rgb: a.map((x) => Math.max(0, Math.min(255, Math.round(x)))) };
      }
      if (typeof v === 'string') {
        const s = v.toLowerCase();
        const k = NAMES.indexOf(s === 'gray' ? 'grey' : s);
        if (k >= 0) return { v: s, rgb: this.palette[k] };
        const rgb = TurtleWorld.cssColor(s);
        if (rgb) return { v: s, rgb };
      }
      return null;
    }
    static cssColor(s) {
      if (/^#[0-9a-f]{6}$/.test(s)) return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
      if (/^#[0-9a-f]{3}$/.test(s)) return [1, 2, 3].map((i) => parseInt(s[i] + s[i], 16));
      if (CSS_NAMES[s]) { const v = CSS_NAMES[s]; return [v >> 16, (v >> 8) & 255, v & 255]; }
      if (!TurtleWorld.probe) TurtleWorld.probe = makeCanvas(1, 1);
      const p = TurtleWorld.probe;
      if (!p || !/^[a-z]+$/.test(s)) return null;
      const c = p.getContext('2d');
      c.fillStyle = '#010203';
      c.fillStyle = s;
      if (c.fillStyle === '#010203') return null;
      c.clearRect(0, 0, 1, 1); c.fillRect(0, 0, 1, 1);
      const d = c.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    }
    css(c) { return 'rgb(' + c.rgb[0] + ',' + c.rgb[1] + ',' + c.rgb[2] + ')'; }
    setPalette(i, rgb) { this.palette[i] = rgb; this.changed(); }

    // ---- drawing -----------------------------------------------------------------------------
    clean() {
      if (this.ctx) { this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.clearRect(0, 0, W * SCALE, H * SCALE); }
      this.log = [];
      this.segments = 0;
      this.changed();
    }
    clearScreen() { this.clean(); for (const t of this.turtles) { t.x = 0; t.y = 0; t.heading = 0; } this.changed(); }
    worldTransform() { this.ctx.setTransform(SCALE, 0, 0, -SCALE, W * SCALE / 2, H * SCALE / 2); }
    /** Stroke a segment with a turtle's pen */
    line(t, x1, y1, x2, y2) {
      if (this.paths) { this.paths.push([x2, y2]); if (t.penDown) this.strokes.push([t, x1, y1, x2, y2, t.color, t.size, t.penMode]); }
      if (!t.penDown) return;
      this.segments++; this.drawnTotal = (this.drawnTotal || 0) + 1;   // never reset: lessons count lines drawn across CLEARSCREEN
      if (!this.ctx) { if (this.log.length < 200000) this.log.push(['line', t.id, x1, y1, x2, y2, t.penMode, t.color.rgb.join(','), t.size]); return; }
      const c = this.ctx;
      this.worldTransform();
      c.globalCompositeOperation = t.penMode === 'erase' ? 'destination-out' : t.penMode === 'reverse' ? 'xor' : 'source-over';
      c.strokeStyle = this.css(t.color);
      c.lineWidth = Math.max(t.size, 0.5);
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(x1, y1);
      if (x1 === x2 && y1 === y2) c.lineTo(x2 + 0.001, y2); else c.lineTo(x2, y2);
      c.stroke();
      c.globalCompositeOperation = 'source-over';
      this.changed();
    }
    inBounds(x, y) { return x >= -W / 2 && x <= W / 2 && y >= -H / 2 && y <= H / 2; }

    /** Move a turtle to (x, y) obeying WRAP / WINDOW / FENCE. Throws 'fence' if it would leave. */
    moveTo(t, x, y) {
      if (this.mode === 'fence' && !this.inBounds(x, y)) throw new Error('fence');
      if (this.mode !== 'wrap') { this.line(t, t.x, t.y, x, y); t.x = x; t.y = y; return; }
      // wrap: cut the segment where it crosses an edge and continue from the opposite edge
      let x0 = t.x, y0 = t.y;
      let dx = x - x0, dy = y - y0;
      let guard = 0;
      while (guard++ < 10000) {
        const tx = dx > 0 ? (W / 2 - x0) / dx : dx < 0 ? (-W / 2 - x0) / dx : Infinity;
        const ty = dy > 0 ? (H / 2 - y0) / dy : dy < 0 ? (-H / 2 - y0) / dy : Infinity;
        const k = Math.min(tx, ty);
        if (k >= 1) { this.line(t, x0, y0, x0 + dx, y0 + dy); x0 += dx; y0 += dy; break; }
        const ex = x0 + dx * k, ey = y0 + dy * k;
        this.line(t, x0, y0, ex, ey);
        dx -= ex - x0; dy -= ey - y0;
        x0 = ex; y0 = ey;
        if (tx <= ty) x0 = -x0; else y0 = -y0;
        if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) break;
      }
      t.x = x0; t.y = y0;
    }
    forward(t, d) {
      const a = t.heading * DEG;
      const x = t.x + d * Math.sin(a) * this.scrunch[0];
      const y = t.y + d * Math.cos(a) * this.scrunch[1];
      this.moveTo(t, tidy(x), tidy(y));
    }
    setHeading(t, h) { t.heading = ((h % 360) + 360) % 360; if (Math.abs(t.heading - 360) < 1e-9) t.heading = 0; }
    towards(t, x, y) {
      const dx = x - t.x, dy = y - t.y;
      if (dx === 0 && dy === 0) return 0;
      let h = Math.atan2(dx, dy) / DEG;
      if (h < 0) h += 360;
      return tidy(h);
    }
    /** While FILLED is recording, curves add their points to the shape being filled */
    recordCurve(t, rx, ry, rot, a0, sweep) {
      if (!this.paths) return;
      const n = Math.max(8, Math.ceil(Math.abs(sweep) / (5 * DEG)));
      for (let i = 0; i <= n; i++) {
        const a = a0 + sweep * i / n;
        const ex = rx * Math.cos(a), ey = ry * Math.sin(a);
        this.paths.push([t.x + ex * Math.cos(rot) - ey * Math.sin(rot), t.y + ex * Math.sin(rot) + ey * Math.cos(rot)]);
      }
    }
    arc(t, angle, r) {
      if (angle === 0) return;
      this.recordCurve(t, Math.abs(r) * this.scrunch[0], Math.abs(r) * this.scrunch[1], 0, (90 - t.heading) * DEG, -Math.max(-360, Math.min(360, angle)) * DEG);
      if (!t.penDown) return;
      this.segments++; this.drawnTotal = (this.drawnTotal || 0) + 1;
      if (!this.ctx) { this.log.push(['arc', t.id, t.x, t.y, angle, r]); return; }
      const c = this.ctx;
      this.worldTransform();
      c.globalCompositeOperation = t.penMode === 'erase' ? 'destination-out' : t.penMode === 'reverse' ? 'xor' : 'source-over';
      c.strokeStyle = this.css(t.color);
      c.lineWidth = Math.max(t.size, 0.5);
      c.lineCap = 'round';
      // the arc starts at the turtle's heading and sweeps clockwise for positive angles
      const start = (90 - t.heading) * DEG;
      const a = Math.max(-360, Math.min(360, angle)) * DEG;
      c.beginPath();
      c.save();
      c.translate(t.x, t.y);
      c.scale(this.scrunch[0], this.scrunch[1]);
      c.arc(0, 0, Math.abs(r), start, start - a, a > 0);
      c.restore();
      c.stroke();
      c.globalCompositeOperation = 'source-over';
      this.changed();
    }
    ellipse(t, w, h, angle, filled, startAngle) {
      this.recordCurve(t, Math.abs(w) / 2, Math.abs(h) / 2, -t.heading * DEG, startAngle ? -startAngle * DEG : 0, angle === undefined ? Math.PI * 2 : -angle * DEG);
      this.segments++; this.drawnTotal = (this.drawnTotal || 0) + 1;
      if (!this.ctx) { this.log.push(['ellipse', t.id, t.x, t.y, w, h]); return; }
      const c = this.ctx;
      this.worldTransform();
      c.globalCompositeOperation = t.penMode === 'erase' ? 'destination-out' : t.penMode === 'reverse' ? 'xor' : 'source-over';
      c.strokeStyle = this.css(t.color);
      c.fillStyle = this.css(t.color);
      c.lineWidth = Math.max(t.size, 0.5);
      c.beginPath();
      const start = (90 - t.heading) * DEG;
      const a0 = startAngle ? -startAngle * DEG : 0;
      c.ellipse(t.x, t.y, Math.abs(w) / 2, Math.abs(h) / 2, -t.heading * DEG, a0, angle === undefined ? a0 + Math.PI * 2 : a0 - angle * DEG, true);
      void start;
      if (filled) c.fill(); else if (t.penDown) c.stroke();
      c.globalCompositeOperation = 'source-over';
      this.changed();
    }
    dot(t, x, y) {
      this.segments++; this.drawnTotal = (this.drawnTotal || 0) + 1;
      if (!this.ctx) { this.log.push(['dot', t.id, x, y]); return; }
      const c = this.ctx;
      this.worldTransform();
      c.globalCompositeOperation = t.penMode === 'erase' ? 'destination-out' : t.penMode === 'reverse' ? 'xor' : 'source-over';
      c.fillStyle = this.css(t.color);
      c.beginPath();
      c.arc(x, y, Math.max(t.size, 1) / 2 + (t.penMode === 'erase' ? 0.75 : 0.25), 0, Math.PI * 2);
      c.fill();
      c.globalCompositeOperation = 'source-over';
      this.changed();
    }
    label(t, text) {
      if (!this.ctx) { this.log.push(['label', t.id, t.x, t.y, text]); return; }
      const c = this.ctx;
      c.setTransform(SCALE, 0, 0, SCALE, W * SCALE / 2, H * SCALE / 2);
      c.globalCompositeOperation = t.penMode === 'erase' ? 'destination-out' : 'source-over';
      c.fillStyle = this.css(t.color);
      c.font = t.labelHeight + 'px ' + (this.labelFont || 'system-ui, sans-serif');
      c.textBaseline = 'alphabetic';
      c.fillText(text, t.x, -t.y);
      // erasing a label also strokes the edges, so no faint outline is left behind
      if (t.penMode === 'erase') { c.lineWidth = 1.5; c.strokeStyle = '#000'; c.strokeText(text, t.x, -t.y); }
      c.globalCompositeOperation = 'source-over';
      this.changed();
    }
    labelSize(t, text) {
      if (!this.ctx) return [text.length * t.labelHeight * 0.6, t.labelHeight];
      const c = this.ctx;
      c.font = t.labelHeight + 'px ' + (this.labelFont || 'system-ui, sans-serif');
      return [Math.round(c.measureText(text).width), t.labelHeight];
    }
    /** Flood fill the area under the turtle with a colour */
    fill(t, color, fillToPen) {
      if (!this.ctx) { this.log.push(['fill', t.id, t.x, t.y]); return; }
      const c = this.ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      const w = W * SCALE, h = H * SCALE;
      const px = Math.round((t.x + W / 2) * SCALE), py = Math.round((H / 2 - t.y) * SCALE);
      if (px < 0 || py < 0 || px >= w || py >= h) return;
      const img = c.getImageData(0, 0, w, h);
      const d = new Uint32Array(img.data.buffer);
      const seed = d[py * w + px];
      const sr = seed & 255, sg = (seed >> 8) & 255, sb = (seed >> 16) & 255, sa = (seed >>> 24) & 255;
      const fc = color.rgb;
      const fillV = (255 << 24 | fc[2] << 16 | fc[1] << 8 | fc[0]) >>> 0;
      if (seed >>> 0 === fillV) return;
      const tol = 70;
      const pen = fillToPen ? t.color.rgb : null;
      const same = (v) => {
        const a = (v >>> 24) & 255;
        if (pen) {
          // FILL with a boundary colour: stop at pixels close to the pen colour
          if (a < 40) return true;
          return Math.abs((v & 255) - pen[0]) + Math.abs(((v >> 8) & 255) - pen[1]) + Math.abs(((v >> 16) & 255) - pen[2]) > tol;
        }
        if (sa < 40) return a < 110;
        return Math.abs(a - sa) < 90 && Math.abs((v & 255) - sr) + Math.abs(((v >> 8) & 255) - sg) + Math.abs(((v >> 16) & 255) - sb) < tol;
      };
      const seen = new Uint8Array(w * h);
      const stack = [px, py];
      while (stack.length) {
        const y = stack.pop(), x0 = stack.pop();
        let x = x0;
        while (x >= 0 && !seen[y * w + x] && same(d[y * w + x])) x--;
        x++;
        let up = false, down = false;
        while (x < w && !seen[y * w + x] && same(d[y * w + x])) {
          const i = y * w + x;
          seen[i] = 1;
          d[i] = fillV;
          if (y > 0) { const s = !seen[i - w] && same(d[i - w]); if (s && !up) { stack.push(x, y - 1); up = true; } else if (!s) up = false; }
          if (y < h - 1) { const s = !seen[i + w] && same(d[i + w]); if (s && !down) { stack.push(x, y + 1); down = true; } else if (!s) down = false; }
          x++;
        }
      }
      // soften the seam: pixels next to the fill that are partly transparent get the fill colour behind them
      c.putImageData(img, 0, 0);
      this.changed();
    }
    /** FILLED: record the path while instructions run, then fill the polygon */
    beginPath(t) { this.paths = [[t.x, t.y]]; this.strokes = []; }
    endPath(t, color) {
      const pts = this.paths || [];
      const strokes = this.strokes || [];
      this.paths = null; this.strokes = [];
      if (pts.length < 3) return;
      if (!this.ctx) { this.log.push(['polygon', t.id, pts.length]); return; }
      const c = this.ctx;
      this.worldTransform();
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = this.css(color);
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) c.lineTo(p[0], p[1]);
      c.closePath();
      c.fill();
      // the outline goes back on top of the fill
      for (const [tt, x1, y1, x2, y2, col, size, mode] of strokes) {
        const keep = { color: tt.color, size: tt.size, penMode: tt.penMode, penDown: true };
        tt.color = col; tt.size = size; tt.penMode = mode;
        this.line(tt, x1, y1, x2, y2);
        this.segments--;
        Object.assign(tt, keep);
      }
      this.changed();
    }
    stamp(t) {
      if (t.shape === 'none') return;
      if (!this.ctx) { this.log.push(['stamp', t.id, t.x, t.y]); return; }
      this.ctx.setTransform(SCALE, 0, 0, SCALE, W * SCALE / 2, H * SCALE / 2);
      TurtleWorld.drawTurtle(this.ctx, t, this, 1, true);
      this.changed();
    }

    // ---- pictures ------------------------------------------------------------------------------
    async toPNG() {
      if (!this.canvas) return new Uint8Array(0);
      const out = makeCanvas(W * SCALE, H * SCALE);
      const c = out.getContext('2d');
      c.fillStyle = this.css(this.bg); c.fillRect(0, 0, W * SCALE, H * SCALE);
      c.drawImage(this.canvas, 0, 0);
      const blob = out.convertToBlob ? await out.convertToBlob({ type: 'image/png' }) : await new Promise((r) => out.toBlob(r, 'image/png'));
      return new Uint8Array(await blob.arrayBuffer());
    }
    async loadPNG(bytes) {
      if (!this.ctx || typeof createImageBitmap === 'undefined') return;
      const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.drawImage(bmp, 0, 0, W * SCALE, H * SCALE);
      this.changed();
    }

    // ---- rendering ------------------------------------------------------------------------------
    changed() { if (!this.dirty) { this.dirty = true; this.emit('dirty'); } }
    /**
     * Paint the world into a 2D context. view: {x, y, w, h} in device pixels where the world
     * rectangle should appear (the caller keeps the aspect ratio).
     */
    render(ctx, view, opts) {
      opts = opts || {};
      this.dirty = false;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = this.css(this.bg);
      ctx.fillRect(view.x, view.y, view.w, view.h);
      if (opts.grid) TurtleWorld.drawGrid(ctx, view, this);
      if (this.canvas) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(this.canvas, view.x, view.y, view.w, view.h);
      }
      const k = view.w / W;
      ctx.setTransform(k, 0, 0, k, view.x + view.w / 2, view.y + view.h / 2);
      for (const t of this.turtles) if (t.shown && t.shape !== 'none') TurtleWorld.drawTurtle(ctx, t, this, 1 / k, false, opts.turtleStyle);
      ctx.restore();
    }
    static drawGrid(ctx, view, world) {
      const k = view.w / W;
      const lum = (world.bg.rgb[0] * 299 + world.bg.rgb[1] * 587 + world.bg.rgb[2] * 114) / 1000;
      const ink = lum > 128 ? '0,0,0' : '255,255,255';
      ctx.save();
      ctx.beginPath();
      ctx.rect(view.x, view.y, view.w, view.h);
      ctx.clip();
      for (let gx = -W / 2; gx <= W / 2; gx += 25) {
        const x = Math.round(view.x + (gx + W / 2) * k) + 0.5;
        ctx.strokeStyle = 'rgba(' + ink + ',' + (gx === 0 ? 0.22 : gx % 100 === 0 ? 0.11 : 0.05) + ')';
        ctx.beginPath(); ctx.moveTo(x, view.y); ctx.lineTo(x, view.y + view.h); ctx.stroke();
      }
      for (let gy = -H / 2; gy <= H / 2; gy += 25) {
        const y = Math.round(view.y + (H / 2 - gy) * k) + 0.5;
        ctx.strokeStyle = 'rgba(' + ink + ',' + (gy === 0 ? 0.22 : gy % 100 === 0 ? 0.11 : 0.05) + ')';
        ctx.beginPath(); ctx.moveTo(view.x, y); ctx.lineTo(view.x + view.w, y); ctx.stroke();
      }
      ctx.restore();
    }
    /** Draw a turtle centred at its position in a context whose units are world steps (y down) */
    static drawTurtle(ctx, t, world, px, stamp, style) {
      ctx.save();
      ctx.translate(t.x, -t.y);
      ctx.rotate(t.heading * DEG);
      const col = 'rgb(' + t.color.rgb.join(',') + ')';
      const lum = (t.color.rgb[0] * 299 + t.color.rgb[1] * 587 + t.color.rgb[2] * 114) / 1000;
      const edge = lum > 150 ? 'rgba(0,0,0,.65)' : 'rgba(255,255,255,.85)';
      ctx.lineWidth = Math.max(1.2 * px, 0.6);
      ctx.lineJoin = 'round';
      const shape = t.shape;
      if (shape === 'turtle' && style !== 'classic') {
        // a small friendly turtle: shell, head and four flippers, pointing up the screen
        const shell = '#3f8f5a', skin = '#8fcf7a', dark = '#24563a';
        ctx.fillStyle = skin; ctx.strokeStyle = dark;
        for (const [fx, fy, r] of [[-7, -5, 0.5], [7, -5, -0.5], [-6, 7, -0.6], [6, 7, 0.6]]) {
          ctx.save(); ctx.translate(fx, fy); ctx.rotate(r);
          ctx.beginPath(); ctx.ellipse(0, 0, 2.6, 4.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
        }
        ctx.beginPath(); ctx.ellipse(0, -12, 3.2, 3.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 9.5); ctx.lineTo(-1.6, 12.5); ctx.lineTo(1.6, 12.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shell;
        ctx.beginPath(); ctx.ellipse(0, 0, 7.4, 9.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.ellipse(0, 0, 3.6, 4.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,.35)';
        ctx.beginPath(); ctx.moveTo(-6.6, 0); ctx.lineTo(-3.6, 0); ctx.moveTo(3.6, 0); ctx.lineTo(6.6, 0); ctx.moveTo(0, -9.4); ctx.lineTo(0, -4.8); ctx.moveTo(0, 4.8); ctx.lineTo(0, 9.4); ctx.stroke();
        ctx.fillStyle = '#123';
        ctx.beginPath(); ctx.arc(-1.3, -13.3, 0.7, 0, Math.PI * 2); ctx.arc(1.3, -13.3, 0.7, 0, Math.PI * 2); ctx.fill();
      } else if (shape === 'circle') {
        ctx.fillStyle = col; ctx.strokeStyle = edge;
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -7); ctx.stroke();
      } else if (shape === 'square') {
        ctx.fillStyle = col; ctx.strokeStyle = edge;
        ctx.fillRect(-6, -6, 12, 12); ctx.strokeRect(-6, -6, 12, 12);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -6); ctx.stroke();
      } else if (shape === 'star') {
        ctx.fillStyle = col; ctx.strokeStyle = edge;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? 3.6 : 9; const a = i * Math.PI / 5; ctx.lineTo(r * Math.sin(a), -r * Math.cos(a)); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (shape === 'arrow') {
        ctx.fillStyle = col; ctx.strokeStyle = edge;
        ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7, 0); ctx.lineTo(2.5, 0); ctx.lineTo(2.5, 9); ctx.lineTo(-2.5, 9); ctx.lineTo(-2.5, 0); ctx.lineTo(-7, 0); ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else {
        // the classic Logo triangle
        ctx.fillStyle = stamp ? col : 'rgba(0,0,0,0)';
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(1.6 * px, 1);
        ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(7, 6); ctx.lineTo(-7, 6); ctx.closePath();
        if (stamp) ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
      void world;
    }
  }
  function tidy(v) { const r = Math.round(v); return Math.abs(v - r) < 1e-9 ? r : Math.round(v * 1e10) / 1e10; }

  TurtleWorld.W = W; TurtleWorld.H = H; TurtleWorld.SCALE = SCALE;
  TurtleWorld.PALETTE = PALETTE; TurtleWorld.NAMES = NAMES; TurtleWorld.SHAPES = SHAPES;
  LG.TurtleWorld = TurtleWorld;
  LG.Turtle = Turtle;
})(LG);
