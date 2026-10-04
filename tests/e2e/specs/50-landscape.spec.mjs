// Phones on their side: no tab bar, a small Turtle / Code / Debug switcher in the top bar, and
// the world and the command center side by side.
import { rects, assertReachable, assertWorldShape } from './50-ui-lib.mjs';

const SIZES = [
  { width: 844, height: 390, mobile: true, touch: true },
  { width: 900, height: 412, mobile: true, touch: true },
  { width: 667, height: 375, mobile: true, touch: true },
  { width: 720, height: 360, mobile: true, touch: true },
];
const seg = (p) => p.ev("[...document.querySelectorAll('.mviews .seg button')].map(b => [b.dataset.v, b.textContent, b.classList.contains('on')])");
const shown = (p) => p.ev("['worldCard','cmdCard','editorCard','inspCard','side','mbar','rail','status'].filter(id => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none'; })");

export default function (t) {
  for (const S of SIZES) {
    const tag = `${S.width}x${S.height}`;

    t.test(`${tag}: the view switcher sits in the top bar`, async (p) => {
      p.assert.deepEqual(await seg(p), [['turtle', 'Turtle', true], ['code', 'Code', false], ['debug', 'Debug', false]]);
      const r = await rects(p, ['.mviews', '#top']);
      p.assert.ok(r['.mviews'].y >= r['#top'].y && r['.mviews'].bottom <= r['#top'].bottom, 'inside the top bar');
      await assertReachable(p, ['.mviews [data-v=turtle]', '.mviews [data-v=code]', '.mviews [data-v=debug]', '#menuBtn', '#tbRun', '#tbStop']);
    }, { fresh: S });

    t.test(`${tag}: no tab bar, rail or status bar`, async (p) => {
      p.assert.deepEqual(await shown(p), ['worldCard', 'cmdCard']);
    }, { fresh: S });

    t.test(`${tag}: the world and the command center sit side by side`, async (p) => {
      const r = await rects(p, ['#worldCard', '#cmdCard', '#top']);
      p.assert.ok(r['#cmdCard'].x >= r['#worldCard'].right - 0.5, 'command center to the right');
      p.assert.ok(Math.abs(r['#cmdCard'].y - r['#worldCard'].y) < 1, 'same top');
      p.assert.ok(Math.abs(r['#cmdCard'].h - r['#worldCard'].h) < 1, 'same height');
      p.assert.ok(r['#worldCard'].w > r['#cmdCard'].w, 'the world is wider');
      p.assert.ok(r['#worldCard'].bottom <= S.height + 0.5);
      await assertWorldShape(p);
    }, { fresh: S });

    t.test(`${tag}: Code shows the editor across the screen`, async (p) => {
      await p.tap('.mviews [data-v=code]');
      p.assert.deepEqual(await shown(p), ['editorCard']);
      p.assert.equal((await seg(p)).find((x) => x[2])[0], 'code');
      const r = await p.rect('#editorCard');
      p.assert.ok(r.w > S.width - 20 && r.bottom <= S.height + 0.5, JSON.stringify(r));
      await assertReachable(p, ['#editors .ed-ta', '#editorTabs .etab']);
    }, { fresh: S });

    t.test(`${tag}: Debug shows the debugger panels`, async (p) => {
      await p.tap('.mviews [data-v=debug]');
      p.assert.deepEqual(await shown(p), ['inspCard']);
      await assertReachable(p, ['#itab-vars', '#itab-stack']);
      await p.tap('.mviews [data-v=turtle]');
      p.assert.deepEqual(await shown(p), ['worldCard', 'cmdCard']);
    }, { fresh: S });

    t.test(`${tag}: a command typed beside the world draws in it`, async (p) => {
      await p.command('repeat 4 [fd 60 rt 90]');
      p.assert.equal(await p.segments(), 4);
      p.assert.ok(await p.noHScroll());
    }, { fresh: S });
  }

  t.test('turning a phone sideways swaps the tab bar for the switcher', async (p) => {
    p.assert.ok(await p.visible('#mbar'));
    p.assert.equal(await p.visible('.mviews'), false);
    await p.tap('#mtab-code');
    await p.viewport(844, 390, { mobile: true, touch: true });
    p.assert.equal(await p.visible('#mbar'), false);
    p.assert.ok(await p.visible('.mviews'));
    p.assert.deepEqual((await seg(p)).map((x) => x[2]), [false, true, false], 'the Code view carries over');
    p.assert.ok(await p.visible('#editorCard'));
    await p.viewport(390, 844, { mobile: true, touch: true });
    p.assert.ok(await p.visible('#mbar'));
    p.assert.ok(await p.ev("document.getElementById('mtab-code').classList.contains('active')"));
  }, { fresh: { width: 390, height: 844, mobile: true, touch: true } });

  t.test('the step buttons show on a wide landscape phone', async (p) => {
    await assertReachable(p, ['#tbInto', '#tbOver', '#tbOut']);
  }, { fresh: SIZES[0] });

  t.test('a breakpoint on a landscape phone switches to the Code view', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'to f\nprint 1\nend\nf\n');
    await p.ev("LG.app.toggleBreakpoint('/projects/e2e.lgo', 1)");
    await p.tap('.mviews [data-v=turtle]');
    await p.tap('#tbRun');
    await p.waitState('paused');
    await p.wait("document.body.dataset.view === 'code'");
    p.assert.equal((await seg(p)).find((x) => x[2])[0], 'code');
    await p.stopProgram();
  }, { fresh: SIZES[0] });

  t.test('the menu on a landscape phone fits the short screen', async (p) => {
    await p.tap('#menuBtn');
    await p.wait("!!document.querySelector('.menu-pop')");
    const r = await p.rect('.menu-pop');
    p.assert.ok(r.y >= 0 && r.bottom <= 390 && r.right <= 844, JSON.stringify(r));
    p.assert.ok(await p.ev("(() => { const m = document.querySelector('.menu-pop'); return m.scrollHeight > m.clientHeight; })()"), 'the long menu scrolls');
    await p.closeMenus();
  }, { fresh: SIZES[0] });

  t.test('the Open dialog is reachable from the menu on a landscape phone', async (p) => {
    await p.tap('#menuBtn');
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.tap('.menu-pop .menu-item', 'Open…');
    p.assert.match(await p.waitModal(), /Open/);
    await p.key('Escape');
  }, { fresh: SIZES[0] });
}
