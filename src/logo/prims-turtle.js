// Turtle graphics primitives (Berkeley Logo, with FMSLogo and LCSI-style extras for several
// turtles, flood colours, shapes and stamping).
(function (LG) {
  'use strict';
  const D = LG.Data;
  const { NIL, isList, isWord } = D;
  const LogoError = LG.LogoError;
  const T = (b) => (b ? 'true' : 'false');

  LG.Prims.add('turtle', (I) => {
    const g = { group: 'turtle' };
    const def = (n, a, b, c, fn, o) => I.def(n, a, b, c, fn, Object.assign({}, g, o));
    const gdef = (n, a, b, c, fn, o) => def(n, a, b, c, fn, Object.assign({ gen: true }, o));
    const W = () => {
      if (!I.turtle) I.turtle = new LG.TurtleWorld({ headless: !LG.isBrowser });
      return I.turtle;
    };
    I.anim = 0;          // 0 = instant, otherwise turtle steps per animation frame
    const fence = (fn) => {
      try { return fn(); } catch (e) { if (e && e.message === 'fence') throw new LogoError(3); throw e; }
    };
    const num = (v, n) => I.num(v, n);
    const xy = (v, n) => {
      const a = D.toArray(I.list(v, n));
      if (a.length !== 2) throw I.bad(n, v);
      return a.map((x) => num(x, n));
    };
    const out = (x) => (Math.abs(x - Math.round(x)) < 1e-9 ? Math.round(x) : x);

    // ---- motion -----------------------------------------------------------------------------
    function* move(dist) {
      const w = W();
      if (!I.anim || dist === 0) { fence(() => w.each((t) => w.forward(t, dist))); return; }
      let left = Math.abs(dist);
      const s = Math.sign(dist);
      while (left > 1e-9) {
        // the speed can change to Instant part way: then finish the move at once
        const d = I.anim ? Math.min(I.anim, left) : left;
        fence(() => w.each((t) => w.forward(t, s * d)));
        left -= d;
        if (left > 1e-9) yield { t: 'wait', ms: 16 };
      }
      yield { t: 'wait', ms: 16 };
    }
    function* turn(angle) {
      const w = W();
      if (!I.anim || angle === 0) { w.each((t) => w.setHeading(t, t.heading + angle)); return; }
      const step = Math.max(6, I.anim * 1.5);
      let left = Math.abs(angle);
      const s = Math.sign(angle);
      while (left > 1e-9) {
        const a = Math.min(step, left);
        w.each((t) => w.setHeading(t, t.heading + s * a));
        left -= a;
        if (left > 1e-9) yield { t: 'wait', ms: 16 };
      }
    }
    gdef('forward fd', 1, 1, 1, function* ([d], n) { yield* move(num(d, n)); });
    gdef('back bk', 1, 1, 1, function* ([d], n) { yield* move(-num(d, n)); });
    gdef('right rt', 1, 1, 1, function* ([a], n) { yield* turn(num(a, n)); });
    gdef('left lt', 1, 1, 1, function* ([a], n) { yield* turn(-num(a, n)); });
    def('setpos', 1, 1, 1, function ([p], n) { const [x, y] = xy(p, n); const w = W(); fence(() => w.each((t) => w.moveTo(t, x, y))); });
    def('setxy', 2, 2, 2, function ([a, b], n) { const x = num(a, n), y = num(b, n); const w = W(); fence(() => w.each((t) => w.moveTo(t, x, y))); });
    def('setx', 1, 1, 1, function ([a], n) { const x = num(a, n); const w = W(); fence(() => w.each((t) => w.moveTo(t, x, t.y))); });
    def('sety', 1, 1, 1, function ([a], n) { const y = num(a, n); const w = W(); fence(() => w.each((t) => w.moveTo(t, t.x, y))); });
    def('setheading seth', 1, 1, 1, function ([a], n) { const h = num(a, n); const w = W(); w.each((t) => w.setHeading(t, h)); });
    def('home', 0, 0, 0, function () { const w = W(); fence(() => w.each((t) => { w.moveTo(t, 0, 0); t.heading = 0; })); });
    def('arc', 2, 2, 2, function ([a, r], n) { const ang = num(a, n), rad = num(r, n); const w = W(); w.each((t) => w.arc(t, ang, rad)); });
    def('ellipse', 2, 2, 2, function ([a, b], n) { const x = num(a, n), y = num(b, n); const w = W(); w.each((t) => w.ellipse(t, x, y)); });
    def('ellipsearc', 4, 4, 4, function ([ang, a, b, st], n) { const an = num(ang, n), x = num(a, n), y = num(b, n), s0 = num(st, n); const w = W(); w.each((t) => w.ellipse(t, x, y, an, false, s0)); });
    def('dot', 1, 1, 1, function ([p], n) { const [x, y] = xy(p, n); const w = W(); w.each((t) => w.dot(t, x, y)); });

    // ---- queries ----------------------------------------------------------------------------
    def('pos', 0, 0, 0, function () { const t = W().current; return D.list(out(t.x), out(t.y)); });
    def('xcor', 0, 0, 0, function () { return out(W().current.x); });
    def('ycor', 0, 0, 0, function () { return out(W().current.y); });
    def('heading', 0, 0, 0, function () { return out(W().current.heading); });
    def('towards', 1, 1, 1, function ([p], n) { const [x, y] = xy(p, n); const w = W(); return w.towards(w.current, x, y); });
    def('distance', 1, 1, 1, function ([p], n) { const [x, y] = xy(p, n); const t = W().current; return out(Math.hypot(x - t.x, y - t.y)); });
    def('scrunch', 0, 0, 0, function () { const s = W().scrunch; return D.list(s[0], s[1]); });
    def('setscrunch', 2, 2, 2, function ([a, b], n) { const x = num(a, n), y = num(b, n); if (x === 0 || y === 0) throw I.bad(n, x === 0 ? a : b); W().scrunch = [x, y]; });

    // ---- the turtle and the screen ------------------------------------------------------------
    def('showturtle st', 0, 0, 0, function () { W().each((t) => { t.shown = true; }); });
    def('hideturtle ht', 0, 0, 0, function () { W().each((t) => { t.shown = false; }); });
    def('shownp shown?', 0, 0, 0, function () { return T(W().current.shown); });
    def('clean', 0, 0, 0, function () { W().clean(); });
    def('clearscreen cs', 0, 0, 0, function () { W().clearScreen(); });
    def('wrap', 0, 0, 0, function () { W().mode = 'wrap'; });
    def('window', 0, 0, 0, function () { W().mode = 'window'; });
    def('fence', 0, 0, 0, function () {
      const w = W();
      if (w.turtles.some((t) => !w.inBounds(t.x, t.y))) throw new LogoError(3);
      w.mode = 'fence';
    });
    def('turtlemode', 0, 0, 0, function () { return W().mode.toUpperCase(); });
    def('screenmode', 0, 0, 0, function () { return (I.io && I.io.screenMode ? I.io.screenMode() : 'split').toUpperCase() + 'SCREEN'; });
    def('refresh norefresh', 0, 0, 0, function () { });
    def('zoom', 1, 1, 1, function ([z], n) { const k = num(z, n); if (k <= 0) throw I.bad(n, z); if (I.io && I.io.zoom) I.io.zoom(k); });
    const fillColor = (t) => W().flood || t.color;
    def('fill', 0, 0, 1, function (args, n) {
      const w = W();
      // (FILL "true) fills up to lines of the pen colour, FMSLogo-style
      const toPen = args.length && I.bool(args[0], n);
      w.each((t) => w.fill(t, fillColor(t), toPen));
    });
    gdef('filled', 2, 2, 2, function* ([c, body], n) {
      const w = W();
      const col = w.color(c, D);
      if (!col) throw I.bad(n, c);
      const t = w.current;
      w.beginPath(t);
      try { yield* I.runList(I.list(body, n), false); } finally { w.endPath(t, col); }
    });
    def('label', 1, 1, 1, function ([x]) { const w = W(); const s = D.printText(x); w.each((t) => w.label(t, s)); });
    def('setlabelheight', 1, 1, 1, function ([h], n) { const k = num(h, n); if (k <= 0) throw I.bad(n, h); W().each((t) => { t.labelHeight = k; }); });
    def('labelsize', 0, 0, 0, function () { const t = W().current; return D.list(t.labelHeight, t.labelHeight); });
    def('setlabelfont', 1, 1, 1, function ([f], n) { const a = isList(f) ? D.toArray(f) : [f]; W().labelFont = D.wordText(a[0]); if (a[1] !== undefined) { const k = num(a[1], n); W().each((t) => { t.labelHeight = k; }); } });
    def('stamp', 0, 0, 0, function () { const w = W(); w.each((t) => w.stamp(t)); });
    def('setshape', 1, 1, 1, function ([s], n) {
      const k = I.word(s, n).toLowerCase();
      if (!LG.TurtleWorld.SHAPES.includes(k)) throw I.bad(n, s);
      W().each((t) => { t.shape = k; });
    });
    def('shape', 0, 0, 0, function () { return W().current.shape; });

    // ---- pens and colours ---------------------------------------------------------------------
    def('pendown pd', 0, 0, 0, function () { W().each((t) => { t.penDown = true; t.penMode = t.penMode === 'erase' || t.penMode === 'reverse' ? t.penMode : 'paint'; }); });
    def('penup pu', 0, 0, 0, function () { W().each((t) => { t.penDown = false; }); });
    def('penpaint ppt', 0, 0, 0, function () { W().each((t) => { t.penDown = true; t.penMode = 'paint'; }); });
    def('penerase pe', 0, 0, 0, function () { W().each((t) => { t.penDown = true; t.penMode = 'erase'; }); });
    def('penreverse px', 0, 0, 0, function () { W().each((t) => { t.penDown = true; t.penMode = 'reverse'; }); });
    def('pendownp pendown?', 0, 0, 0, function () { return T(W().current.penDown); });
    def('penmode', 0, 0, 0, function () { return W().current.penMode.toUpperCase(); });
    const colorIn = (c, n) => { const col = W().color(c, D); if (!col) throw I.bad(n, c); return col; };
    const colorOut = (col) => (isList(col.v) ? D.fromArray(col.rgb.slice()) : col.v);
    def('setpencolor setpc setcolor', 1, 1, 1, function ([c], n) { const col = colorIn(c, n); W().each((t) => { t.color = col; }); });
    def('pencolor pc', 0, 0, 0, function () { return colorOut(W().current.color); });
    def('setbackground setbg setscreencolor setsc', 1, 1, 1, function ([c], n) { const w = W(); w.bg = colorIn(c, n); w.changed(); });
    def('background bg screencolor', 0, 0, 0, function () { return colorOut(W().bg); });
    def('setfloodcolor setfc', 1, 1, 1, function ([c], n) { W().flood = colorIn(c, n); });
    def('floodcolor fc', 0, 0, 0, function () { const w = W(); return colorOut(w.flood || w.current.color); });
    def('setpalette', 2, 2, 2, function ([i, c], n) {
      const k = I.int(i, n);
      if (k < 8 || k > 255) throw I.bad(n, i);
      const a = D.toArray(I.list(c, n)).map((x) => num(x, n));
      if (a.length !== 3) throw I.bad(n, c);
      W().setPalette(k, a.map((x) => Math.max(0, Math.min(255, Math.round(x)))));
    });
    def('palette', 1, 1, 1, function ([i], n) {
      const k = I.int(i, n);
      if (k < 0 || k > 255) throw I.bad(n, i);
      return D.fromArray((W().palette[k] || [0, 0, 0]).slice());
    });
    def('setpensize setwidth', 1, 1, 1, function ([s], n) {
      const v = isList(s) ? D.toArray(s).map((x) => num(x, n))[0] : num(s, n);
      if (!(v > 0)) throw I.bad(n, s);
      W().each((t) => { t.size = v; });
    });
    def('pensize', 0, 0, 0, function () { const s = W().current.size; return D.list(s, s); });
    def('setpenpattern', 1, 1, 1, function ([p]) { W().each((t) => { t.pattern = p; }); });
    def('penpattern', 0, 0, 0, function () { return W().current.pattern || NIL; });
    def('pen', 0, 0, 0, function () {
      const t = W().current;
      return D.list(t.penDown ? 'pendown' : 'penup', t.penMode === 'paint' ? 'paint' : t.penMode, colorOut(t.color), D.list(t.size, t.size), t.pattern || NIL);
    });
    def('setpen', 1, 1, 1, function ([l], n) {
      const a = D.toArray(I.list(l, n));
      const w = W();
      w.each((t) => {
        if (a[0] !== undefined) t.penDown = D.wordText(a[0]).toLowerCase() !== 'penup';
        if (a[1] !== undefined) { const m = D.wordText(a[1]).toLowerCase(); t.penMode = m === 'erase' ? 'erase' : m === 'reverse' ? 'reverse' : 'paint'; }
        if (a[2] !== undefined) t.color = colorIn(a[2], n);
        if (a[3] !== undefined) { const s = isList(a[3]) ? D.toArray(a[3])[0] : a[3]; t.size = num(s, n); }
      });
    });

    // ---- several turtles ----------------------------------------------------------------------
    def('setturtle', 1, 1, 1, function ([i], n) { const k = I.int(i, n); if (k < 0 || k > 1023) throw I.bad(n, i); W().setTurtle(k); });
    def('turtle', 0, 0, 0, function () { return W().active[0]; });
    def('turtles', 0, 0, 0, function () { return W().turtles.length - 1; });
    const ids = (v, n) => {
      const a = isList(v) ? D.toArray(v) : [v];
      return a.map((x) => { const k = I.int(x, n); if (k < 0 || k > 1023) throw I.bad(n, v); return k; });
    };
    def('tell', 1, 1, 1, function ([v], n) { W().tell(ids(v, n)); });
    def('who', 0, 0, 0, function () { const a = W().active; return a.length === 1 ? a[0] : D.fromArray(a.slice()); });
    gdef('ask', 2, 2, 2, function* ([v, body], n) {
      const w = W();
      const saved = w.active.slice();
      w.tell(ids(v, n));
      try { return yield* I.runList(I.list(body, n), true); } finally { w.active = saved; }
    });
    gdef('each', 1, 1, 1, function* ([body], n) {
      const w = W();
      const saved = w.active.slice();
      try {
        for (const k of saved) { w.active = [k]; yield* I.runList(I.list(body, n), false); }
      } finally { w.active = saved; }
    });

    // ---- pictures ------------------------------------------------------------------------------
    gdef('savepict', 1, 1, 1, function* ([f], n) {
      const path = I.resolvePath(I.word(f, n));
      const r = yield { t: 'async', promise: W().toPNG() };
      if (r.err) throw new LogoError(18, { datum: String(r.err.message || r.err) });
      try { I.vfs.writeFile(path, r.ok); } catch (e) { throw new LogoError(18, { datum: e.message }); }
    });
    gdef('loadpict', 1, 1, 1, function* ([f], n) {
      const path = I.resolvePath(I.word(f, n));
      let bytes;
      try { bytes = I.vfs.readFile(path); } catch (e) { throw new LogoError(18, { datum: e.message }); }
      const r = yield { t: 'async', promise: W().loadPNG(bytes) };
      if (r.err) throw new LogoError(18, { datum: 'Not a picture: ' + path });
    });
    def('epspict', 1, 1, 1, function () { throw new LogoError(35, { message: 'EPSPICT is not available; use SAVEPICT to save a PNG picture' }); });
  });
})(LG);
