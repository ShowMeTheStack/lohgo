// Helpers shared by the 30- specs: reading pixels back from the turtle world and resetting it.
// World coordinates: (0,0) in the middle, y up. The drawing canvas is 1600x1200 (2 pixels per step).

/** Put the turtle world back to how a fresh page has it (state setup only) */
export async function resetWorld(p) {
  await p.ev(`(() => {
    const a = LG.app;
    if (a.interp.state !== 'idle') a.stop();
    a.interp.clearHandlers();
    a.world.reset();
    a.world.palette = LG.TurtleWorld.PALETTE.map((c) => c.slice());
    a.world.labelFont = undefined;
    a.turtleView.keys = [];
    a.turtleView.pan = [0, 0];
    a.turtleView.setZoom(1);
    a.setSpeed(10, true);
    a.interp.prefix = '';
    a.vfs.cwd = '/';
    a.hideWelcome();
    a.commander.clear();
  })()`);
  await nextFrame(p);
}

export const nextFrame = (p) => p.ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))');

/** The pixel [r, g, b, a] of the drawing canvas at a world position */
export function px(p, x, y) {
  return p.fn((x, y) => {
    const d = LG.app.world.ctx.getImageData(Math.round((x + 400) * 2), Math.round((300 - y) * 2), 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  }, x, y);
}

/** The most opaque pixel of the drawing canvas within r world steps of a point */
export function inkNear(p, x, y, r = 1.5) {
  return p.fn((x, y, r) => {
    const cx = Math.round((x + 400) * 2), cy = Math.round((300 - y) * 2), R = Math.ceil(r * 2);
    const d = LG.app.world.ctx.getImageData(cx - R, cy - R, 2 * R + 1, 2 * R + 1).data;
    let best = [0, 0, 0, 0];
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > best[3]) best = [d[i], d[i + 1], d[i + 2], d[i + 3]];
    return best;
  }, x, y, r);
}

/** Number of drawing pixels with some ink in a world rectangle (x1,y1)-(x2,y2) */
export function inkCount(p, x1, y1, x2, y2, minAlpha = 100) {
  return p.fn((x1, y1, x2, y2, m) => {
    const ax = Math.round((Math.min(x1, x2) + 400) * 2), ay = Math.round((300 - Math.max(y1, y2)) * 2);
    const w = Math.max(1, Math.round(Math.abs(x2 - x1) * 2)), h = Math.max(1, Math.round(Math.abs(y2 - y1) * 2));
    const d = LG.app.world.ctx.getImageData(ax, ay, w, h).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] >= m) n++;
    return n;
  }, x1, y1, x2, y2, minAlpha);
}

/** Count drawing pixels close to a colour in a world rectangle */
export function colorCount(p, rgb, x1, y1, x2, y2, tol = 60) {
  return p.fn((rgb, x1, y1, x2, y2, tol) => {
    const ax = Math.round((Math.min(x1, x2) + 400) * 2), ay = Math.round((300 - Math.max(y1, y2)) * 2);
    const w = Math.max(1, Math.round(Math.abs(x2 - x1) * 2)), h = Math.max(1, Math.round(Math.abs(y2 - y1) * 2));
    const d = LG.app.world.ctx.getImageData(ax, ay, w, h).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && Math.abs(d[i] - rgb[0]) + Math.abs(d[i + 1] - rgb[1]) + Math.abs(d[i + 2] - rgb[2]) < tol) n++;
    return n;
  }, rgb, x1, y1, x2, y2, tol);
}

/** Total inked pixels on the whole drawing */
export function totalInk(p) {
  return p.fn(() => {
    const d = LG.app.world.ctx.getImageData(0, 0, 1600, 1200).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 100) n++;
    return n;
  });
}

/** The pixel [r, g, b] of the visible #worldCanvas at a world position (after the next paint) */
export async function screenPx(p, x, y) {
  await nextFrame(p);
  return p.fn((x, y) => {
    const tv = LG.app.turtleView, v = tv.view;
    const sx = Math.round(v.x + (x + 400) * v.k), sy = Math.round(v.y + (300 - y) * v.k);
    const d = tv.ctx.getImageData(sx, sy, 1, 1).data;
    return [d[0], d[1], d[2]];
  }, x, y);
}

/** Visible canvas: count pixels near a colour in a world rectangle */
export async function screenColorCount(p, rgb, x1, y1, x2, y2, tol = 60) {
  await nextFrame(p);
  return p.fn((rgb, x1, y1, x2, y2, tol) => {
    const tv = LG.app.turtleView, v = tv.view;
    const ax = Math.round(v.x + (Math.min(x1, x2) + 400) * v.k), ay = Math.round(v.y + (300 - Math.max(y1, y2)) * v.k);
    const w = Math.max(1, Math.round(Math.abs(x2 - x1) * v.k)), h = Math.max(1, Math.round(Math.abs(y2 - y1) * v.k));
    const d = tv.ctx.getImageData(ax, ay, w, h).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - rgb[0]) + Math.abs(d[i + 1] - rgb[1]) + Math.abs(d[i + 2] - rgb[2]) < tol) n++;
    return n;
  }, rgb, x1, y1, x2, y2, tol);
}

/** Page coordinates (CSS pixels) of a world position on the visible canvas */
export function worldToPage(p, x, y) {
  return p.fn((x, y) => {
    const tv = LG.app.turtleView, v = tv.view, r = tv.canvas.getBoundingClientRect();
    return [r.left + (v.x + (x + 400) * v.k) / tv.dpr, r.top + (v.y + (300 - y) * v.k) / tv.dpr];
  }, x, y);
}

export const near = (a, b, tol = 40) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) <= tol;

/** SHOW the value of an expression in the command center and read it back from the transcript */
export async function show(p, expr) {
  const tag = 'q' + Math.random().toString(36).slice(2, 8);
  await p.command(`type word "${tag} "Q show ${expr}`);
  const out = await p.output();
  const m = new RegExp(tag + 'Q(.*)$', 'm').exec(out);
  return m ? m[1].trim() : null;
}
