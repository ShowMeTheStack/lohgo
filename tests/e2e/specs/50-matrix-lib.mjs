// The layout at many screen sizes: no sideways scrolling, the main controls are on screen and
// usable, nothing pokes into the top bar, and the turtle world keeps its 4:3 shape.
import { assertReachable, assertWorldShape, rects, overlap, modeFor } from './50-ui-lib.mjs';
export { SIZES };

const SIZES = [
  [320, 568], [320, 640], [360, 640], [360, 800], [390, 844], [414, 896], [600, 960], [600, 360],
  [720, 1280], [720, 360], [768, 1024], [768, 432], [820, 1180], [820, 400], [900, 1200], [900, 412],
  [1024, 768], [1024, 1366], [1024, 600], [1180, 820], [1280, 800], [1280, 720], [1440, 900], [1440, 600],
  [1920, 1080], [1920, 1200],
];

const TOP = ['#brand', '#tbRun', '#tbPause', '#tbStop', '#state', '#menuBtn'];
const CONTROLS = {
  desktop: [...TOP, '#proj', '#tbInto', '#tbOver', '#tbOut', '#speed', '#railFiles', '#railProcs', '#railLibrary', '#railLearn', '#railTours', '#railHelp', '#railSettings',
    '#worldCanvas', '#cmdInput', '#editorTabs .etab', '#itab-vars', '#itab-stack', '#tbGrid', '#tbBig', '#tbNew', '#tbSave', '#splitRight', '#splitCmd', '#splitInsp'],
  tablet: [...TOP, '#tbInto', '#tbOver', '#tbOut', '#speed', '#railFiles', '#railProcs', '#railLibrary', '#railLearn', '#railTours', '#railHelp', '#railSettings',
    '#worldCanvas', '#cmdInput', '#editorTabs .etab', '#itab-vars', '#tbGrid', '#tbBig', '#tbNew'],
  phone: [...TOP, '#mtab-turtle', '#mtab-code', '#mtab-debug', '#mtab-files', '#mtab-more', '#worldCanvas', '#cmdInput', '#tbGrid', '#tbBig'],
  landscape: [...TOP, '.mviews [data-v=turtle]', '.mviews [data-v=code]', '.mviews [data-v=debug]', '#worldCanvas', '#cmdInput', '#tbBig'],
};
const HIDDEN = {
  desktop: ['#mbar', '.mviews'],
  tablet: ['#mbar', '.mviews', '#proj'],
  phone: ['#rail', '#status', '.mviews', '#speedBox', '#debugGroup', '#editorCard', '#inspCard'],
  landscape: ['#rail', '#status', '#mbar', '#speedBox', '#editorCard', '#inspCard'],
};

export function registerMatrix(t, sizes) {
  for (const [w, h] of sizes) {
    const mode = modeFor(w, h);
    const small = w <= 920;
    const opts = { width: w, height: h, mobile: small, touch: small };
    const tag = `${w}x${h} (${mode})`;

    t.test(`${tag}: no sideways scrolling`, async (p) => {
      p.assert.equal(await p.noHScroll(), true);
      // and the app frame itself is no wider than the window
      p.assert.ok(await p.ev('document.getElementById("app").scrollWidth <= innerWidth + 1'));
      p.assert.ok(await p.ev('document.getElementById("top").scrollWidth <= innerWidth + 1'), 'top bar content fits');
    }, { fresh: opts });

    t.test(`${tag}: the app takes the layout for its size`, async (p) => {
      p.assert.equal(await p.ev('LG.app.isPhone()'), mode === 'phone' || mode === 'landscape');
      for (const s of HIDDEN[mode]) p.assert.equal(await p.visible(s), false, s + ' should be hidden');
      if (mode === 'desktop') p.assert.equal(await p.visible('#side'), true, 'side panel open by default on a wide screen');
      if (mode === 'tablet') p.assert.equal(await p.visible('#side'), false, 'side panel starts closed on a tablet');
    }, { fresh: opts });

    t.test(`${tag}: the main controls are on screen and usable`, async (p) => {
      await p.ev('LG.app.hideWelcome()');
      await assertReachable(p, CONTROLS[mode]);
    }, { fresh: opts });

    t.test(`${tag}: nothing overlaps the top bar`, async (p) => {
      const r = await rects(p, ['#top', '#main', '#worldCard', '#cmdCard', '#editorCard', '#inspCard', '#rail']);
      for (const k of ['#main', '#worldCard', '#cmdCard', '#editorCard', '#inspCard', '#rail']) {
        if (!r[k] || !r[k].w) continue;
        p.assert.ok(r[k].y >= r['#top'].bottom - 0.5, k + ' starts below the top bar ' + JSON.stringify(r[k]));
      }
      // the top bar's own controls sit inside it and do not overlap each other
      const kids = await p.ev("[...document.querySelectorAll('#top > *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.classList.contains('top-gap'); }).map(e => { const r = e.getBoundingClientRect(); return { id: e.id || e.className, x: r.left, y: r.top, right: r.right, bottom: r.bottom }; })");
      for (const k of kids) {
        p.assert.ok(k.x >= -0.5 && k.right <= w + 0.5, k.id + ' inside the window horizontally');
        p.assert.ok(k.y >= r['#top'].y - 0.5 && k.bottom <= r['#top'].bottom + 0.5, k.id + ' inside the top bar vertically');
      }
      for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) p.assert.ok(!overlap(kids[i], kids[j]), kids[i].id + ' overlaps ' + kids[j].id);
    }, { fresh: opts });

    t.test(`${tag}: the turtle world keeps 4:3 inside its card`, async (p) => {
      await assertWorldShape(p);
      const r = await rects(p, ['#worldCard', '#worldCanvas']);
      p.assert.ok(r['#worldCanvas'].x >= r['#worldCard'].x - 0.5 && r['#worldCanvas'].right <= r['#worldCard'].right + 0.5, 'canvas inside the card');
      p.assert.ok(r['#worldCanvas'].bottom <= r['#worldCard'].bottom + 0.5, 'canvas inside the card vertically');
      p.assert.ok(r['#worldCanvas'].h >= 80, 'the world is big enough to see: ' + r['#worldCanvas'].h);
    }, { fresh: opts });

    t.test(`${tag}: the cards stay inside the window`, async (p) => {
      const r = await rects(p, ['#worldCard', '#cmdCard', '#editorCard', '#inspCard', '#mbar', '#status']);
      for (const [k, v] of Object.entries(r)) {
        if (!v || !v.w) continue;
        p.assert.ok(v.x >= -0.5 && v.right <= w + 0.5 && v.bottom <= h + 0.5, k + ' fits ' + JSON.stringify(v));
      }
      // visible cards do not overlap one another
      const shown = Object.entries(r).filter(([, v]) => v && v.w > 0 && v.h > 0);
      for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) {
        p.assert.ok(!overlap(shown[i][1], shown[j][1]), shown[i][0] + ' overlaps ' + shown[j][0]);
      }
    }, { fresh: opts });

    t.test(`${tag}: card heads keep their buttons on one row`, async (p) => {
      const bad = await p.ev(`[...document.querySelectorAll('.card-head')].filter(hd => hd.getBoundingClientRect().width > 0).flatMap(hd => { const r = hd.getBoundingClientRect(); return [...hd.querySelectorAll('button')].filter(b => { const q = b.getBoundingClientRect(); if (!(q.width > 0)) return false; if (q.top < r.top - 0.5 || q.bottom > r.bottom + 0.5) return true; const sc = b.closest('.cmd-tabs'); if (sc && sc.scrollWidth > sc.clientWidth) return false; return q.right > r.right + 0.5 || q.left < r.left - 0.5; }).map(b => b.id || b.getAttribute('aria-label') || b.innerText); })`);
      p.assert.equal(bad.join(', '), '');
      // the last inspector tab can still be reached and picked
      if (await p.visible('#inspCard')) {
        await p.click('#itab-hist');
        p.assert.equal(await p.attr('#itab-hist', 'aria-selected'), 'true');
        p.assert.equal(await p.visible('#itab-hist'), true);
      }
    }, { fresh: opts });
  }
}
