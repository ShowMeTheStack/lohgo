// Shared helpers for the layout, responsive and accessibility specs (prefix 50-).

/** Rectangles of several elements at once: {sel: {x, y, w, h, right, bottom} | null} */
export async function rects(p, sels) {
  return p.fn((list) => {
    const out = {};
    for (const s of list) {
      const e = document.querySelector(s);
      if (!e) { out[s] = null; continue; }
      const r = e.getBoundingClientRect();
      out[s] = { x: r.left, y: r.top, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
    }
    return out;
  }, sels);
}

/**
 * A control a person can actually use: shown, whole inside the viewport, at least 16px each way,
 * and not covered by something else at its centre. Returns a reason string, or '' when fine.
 */
export async function unreachable(p, sel) {
  return p.fn((s) => {
    const e = [...document.querySelectorAll(s)].find((x) => x.getBoundingClientRect().width > 0) || document.querySelector(s);
    if (!e) return s + ': missing';
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0 || r.height === 0) return s + ': hidden';
    if (r.width < 8 || r.height < 8 || (r.width < 16 && r.height < 16)) return s + ': too small ' + Math.round(r.width) + 'x' + Math.round(r.height);
    if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) return s + ': off screen ' + JSON.stringify([r.left, r.top, r.right, r.bottom].map(Math.round));
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit || !(e === hit || e.contains(hit) || hit.contains(e))) return s + ': covered by ' + (hit ? (hit.id || hit.className || hit.tagName) : 'nothing');
    return '';
  }, sel);
}

/** Assert every selector is reachable */
export async function assertReachable(p, sels) {
  const bad = [];
  for (const s of sels) { const why = await unreachable(p, s); if (why) bad.push(why); }
  p.assert.deepEqual(bad, [], 'not reachable: ' + bad.join('; '));
}

/** The turtle world's drawing area keeps the world's 4:3 shape and sits inside the canvas */
export async function worldShape(p) {
  return p.ev(`(() => { const tv = LG.app.turtleView; const v = tv.view; return { ratio: v.w / v.h, inside: v.x >= 0 && v.y >= 0 && v.x + v.w <= tv.canvas.width + 1 && v.y + v.h <= tv.canvas.height + 1, cw: tv.canvas.width, ch: tv.canvas.height, wrapW: Math.round(tv.wrap.getBoundingClientRect().width), wrapH: Math.round(tv.wrap.getBoundingClientRect().height), W: LG.app.world.W, H: LG.app.world.H, fill: Math.max(v.w / tv.canvas.width, v.h / tv.canvas.height) }; })()`);
}
export async function assertWorldShape(p) {
  // wait until the canvas has caught up with its box (ResizeObserver runs a frame later)
  await p.wait(`(() => { const tv = LG.app.turtleView; const r = tv.wrap.getBoundingClientRect(); return Math.abs(tv.canvas.width - Math.round(r.width * tv.dpr)) <= 1 && Math.abs(tv.canvas.height - Math.round(r.height * tv.dpr)) <= 1; })()`, 3000);
  const s = await worldShape(p);
  p.assert.ok(Math.abs(s.ratio - 4 / 3) < 0.01, 'world ratio ' + s.ratio);
  p.assert.ok(s.inside, 'world drawing inside the canvas ' + JSON.stringify(s));
  // it fills the card in one direction (fit, not a tiny stamp)
  p.assert.ok(s.fill > 0.85, 'world fills its card ' + JSON.stringify(s));
  return s;
}

/** True when two rectangles overlap by more than a pixel */
export function overlap(a, b) {
  if (!a || !b) return false;
  return Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1;
}

/** Drag with the real mouse from the centre of an element by (dx, dy) in a few steps */
export async function drag(p, sel, dx, dy, steps = 6) {
  const [x, y] = await p.center(sel);
  await p.mouse('mouseMoved', x, y);
  await p.b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= steps; i++) {
    await p.b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + (dx * i) / steps, y: y + (dy * i) / steps, button: 'left', buttons: 1 });
    await p.sleep(10);
  }
  await p.b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + dx, y: y + dy, button: 'left', buttons: 0, clickCount: 1 });
  await p.sleep(80);
}

/** Read a CSS custom property from the root */
export const cssVar = (p, name) => p.ev(`getComputedStyle(document.documentElement).getPropertyValue(${JSON.stringify(name)}).trim()`);

/** Saved settings object from localStorage */
export const savedSettings = (p) => p.ev("JSON.parse(localStorage.getItem('lohgo.settings') || '{}')");

/** Emulate CSS media features, e.g. [{name: 'prefers-color-scheme', value: 'dark'}] */
export async function media(p, features) {
  await p.b.send('Emulation.setEmulatedMedia', { media: '', features });
  await p.sleep(80);
}

/** Tab forward (or back) n times and return the focused element's description each time */
export async function tabWalk(p, n, shift = false) {
  const seen = [];
  for (let i = 0; i < n; i++) {
    await p.key('Tab', { shift });
    seen.push(await p.ev("(() => { const a = document.activeElement; if (!a) return ''; return a.id || (a.getAttribute('aria-label')) || (a.innerText || '').trim().slice(0, 30) || a.tagName; })()"));
  }
  return seen;
}

/** Is the focused element inside the selector? */
export const focusInside = (p, sel) => p.ev(`(() => { const c = document.querySelector(${JSON.stringify(sel)}); return !!c && c.contains(document.activeElement); })()`);

/** Layout modes, as the app decides them */
export function modeFor(w, h) {
  if (w <= 920 && h <= 500 && w > h) return 'landscape';
  if (w <= 720) return 'phone';
  if (w <= 1180) return 'tablet';
  return 'desktop';
}

/** Text as written in the page (innerText would follow CSS uppercase) */
export const textOf = (p, sel) => p.ev(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);
