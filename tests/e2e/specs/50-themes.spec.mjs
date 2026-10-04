// Themes and the code size, chosen in the Looks dialog: each theme applies and is remembered,
// "Match my device" follows the light or dark setting, and the code size slider works.
import { media, cssVar, savedSettings } from './50-ui-lib.mjs';

const THEMES = [['auto', 'Match my device'], ['paper', 'Paper'], ['chalk', 'Chalkboard'], ['blueprint', 'Blueprint'], ['midnight', 'Midnight'], ['retro', 'Green screen']];
const DESK = { paper: '#efe7d8' };
const theme = (p) => p.ev('document.documentElement.dataset.theme');
const openLooks = async (p) => { await p.click('#railSettings'); await p.waitModal(); };

export default function (t) {
  t.afterEach(async (p) => { await media(p, []); });

  t.test('the Looks dialog offers the six themes with the current one marked', async (p) => {
    await openLooks(p);
    const sw = await p.ev("[...document.querySelectorAll('.modal .swatch')].map(b => [b.id, b.textContent.trim(), b.getAttribute('aria-pressed'), b.classList.contains('on')])");
    p.assert.deepEqual(sw, THEMES.map(([k, l]) => ['theme-' + k, l, String(k === 'auto'), k === 'auto']));
    await p.key('Escape');
  }, { fresh: true });

  for (const [k, label] of THEMES.filter(([k]) => k !== 'auto')) {
    t.test(`picking ${label} applies the ${k} theme`, async (p) => {
      await media(p, [{ name: 'prefers-color-scheme', value: 'light' }]);
      await openLooks(p);
      await p.click('#theme-' + k);
      p.assert.equal(await theme(p), k);
      p.assert.equal(await p.attr('#theme-' + k, 'aria-pressed'), 'true');
      p.assert.equal(await p.ev("document.querySelectorAll('.modal .swatch.on').length"), 1);
      p.assert.equal((await savedSettings(p)).theme, k);
      await p.key('Escape');
    }, { fresh: true });

    t.test(`the ${k} theme is remembered after a reload`, async (p) => {
      await openLooks(p);
      await p.click('#theme-' + k);
      await p.key('Escape');
      await p.reload();
      p.assert.equal(await theme(p), k);
      await openLooks(p);
      p.assert.equal(await p.attr('#theme-' + k, 'aria-pressed'), 'true');
      await p.key('Escape');
    }, { fresh: true });

    t.test(`the ${k} theme changes the page colours`, async (p) => {
      await media(p, [{ name: 'prefers-color-scheme', value: 'light' }]);
      await p.ev("LG.app.setTheme('paper')");
      const before = [await cssVar(p, '--desk'), await cssVar(p, '--paper'), await p.ev('getComputedStyle(document.body).backgroundColor')];
      await openLooks(p);
      await p.click('#theme-' + k);
      await p.key('Escape');
      const after = [await cssVar(p, '--desk'), await cssVar(p, '--paper'), await p.ev('getComputedStyle(document.body).backgroundColor')];
      if (k === 'paper') p.assert.deepEqual(after, before);
      else p.assert.notDeepEqual(after, before);
      // the browser colour bar follows the desk colour
      p.assert.equal(await p.ev("document.querySelector('meta[name=theme-color]').content"), after[0]);
    }, { fresh: true });
  }

  t.test('every theme has its own desk colour', async (p) => {
    const seen = new Set();
    for (const [k] of THEMES.filter(([k]) => k !== 'auto')) {
      await p.ev(`LG.app.setTheme('${k}')`);
      seen.add(await cssVar(p, '--desk'));
    }
    p.assert.equal(seen.size, 5);
  }, { fresh: true });

  t.test('Match my device uses Paper on a light device', async (p) => {
    await media(p, [{ name: 'prefers-color-scheme', value: 'light' }]);
    await p.reload();
    p.assert.equal(await theme(p), 'paper');
    p.assert.equal(await cssVar(p, '--desk'), DESK.paper);
  }, { fresh: true });

  t.test('Match my device uses Midnight on a dark device', async (p) => {
    await media(p, [{ name: 'prefers-color-scheme', value: 'dark' }]);
    await p.reload();
    p.assert.equal(await theme(p), 'midnight');
  }, { fresh: true });

  t.test('Match my device follows the device when it switches while open', async (p) => {
    await media(p, [{ name: 'prefers-color-scheme', value: 'light' }]);
    await p.reload();
    p.assert.equal(await theme(p), 'paper');
    await media(p, [{ name: 'prefers-color-scheme', value: 'dark' }]);
    await p.wait("document.documentElement.dataset.theme === 'midnight'", 2000);
    await media(p, [{ name: 'prefers-color-scheme', value: 'light' }]);
    await p.wait("document.documentElement.dataset.theme === 'paper'", 2000);
  }, { fresh: true });

  t.test('a chosen theme ignores the device switching between light and dark', async (p) => {
    await p.ev("LG.app.setTheme('chalk')");
    await media(p, [{ name: 'prefers-color-scheme', value: 'dark' }]);
    await media(p, [{ name: 'prefers-color-scheme', value: 'light' }]);
    p.assert.equal(await theme(p), 'chalk');
  }, { fresh: true });

  t.test('going back to Match my device from a picked theme', async (p) => {
    await media(p, [{ name: 'prefers-color-scheme', value: 'dark' }]);
    await openLooks(p);
    await p.click('#theme-retro');
    p.assert.equal(await theme(p), 'retro');
    await p.click('#theme-auto');
    p.assert.equal(await theme(p), 'midnight');
    p.assert.equal((await savedSettings(p)).theme, 'auto');
    await p.key('Escape');
  }, { fresh: true });

  t.test('the turtle world is redrawn when the theme changes', async (p) => {
    await p.command('fd 100');
    const n0 = await p.ev('LG.app.turtleView.hudText');
    await p.ev("LG.app.turtleView._draws = 0; const d = LG.app.turtleView.draw.bind(LG.app.turtleView); LG.app.turtleView.draw = () => { LG.app.turtleView._draws++; d(); }");
    await openLooks(p);
    await p.click('#theme-blueprint');
    p.assert.ok(await p.ev('LG.app.turtleView._draws') > 0);
    p.assert.equal(await p.ev('LG.app.turtleView.hudText'), n0);
    await p.key('Escape');
  }, { fresh: true });

  // ---- code size ---------------------------------------------------------------------------------
  t.test('the code size slider starts at 14', async (p) => {
    await openLooks(p);
    p.assert.equal(await p.ev("document.getElementById('setFont').value"), '14');
    p.assert.equal(await cssVar(p, '--code-size'), '14px');
    await p.key('Escape');
  }, { fresh: true });

  t.test('moving the code size slider changes the code size everywhere', async (p) => {
    await openLooks(p);
    await p.ev("document.getElementById('setFont').focus()");
    for (let i = 0; i < 4; i++) await p.key('ArrowRight');
    p.assert.equal(await cssVar(p, '--code-size'), '18px');
    p.assert.equal(await p.ev("getComputedStyle(document.getElementById('cmdInput')).fontSize"), '18px');
    p.assert.equal(await p.ev("getComputedStyle(document.querySelector('#editors .ed')).fontSize"), '18px');
    await p.key('Escape');
  }, { fresh: true });

  t.test('a bigger code size makes the editor lines taller', async (p) => {
    const lh0 = await p.ev('LG.app.active.editor.lineHeight');
    await openLooks(p);
    await p.ev("document.getElementById('setFont').focus()");
    await p.key('End');
    await p.key('Escape');
    const lh1 = await p.ev('LG.app.active.editor.lineHeight');
    p.assert.ok(lh1 > lh0 * 1.5, `${lh0} -> ${lh1}`);
  }, { fresh: true });

  t.test('the code size is remembered after a reload', async (p) => {
    await openLooks(p);
    await p.ev("document.getElementById('setFont').focus()");
    await p.key('ArrowLeft');
    await p.key('ArrowLeft');
    await p.key('Escape');
    await p.reload();
    p.assert.equal(await cssVar(p, '--code-size'), '12px');
    await openLooks(p);
    p.assert.equal(await p.ev("document.getElementById('setFont').value"), '12');
    await p.key('Escape');
  }, { fresh: true });

  t.test('Ctrl+= and Ctrl+- change the code size and the slider follows', async (p) => {
    await p.click('#cmdInput');
    await p.key('=', { ctrl: true });
    await p.key('=', { ctrl: true });
    p.assert.equal(await cssVar(p, '--code-size'), '16px');
    await p.key('-', { ctrl: true });
    p.assert.equal(await cssVar(p, '--code-size'), '15px');
    await openLooks(p);
    p.assert.equal(await p.ev("document.getElementById('setFont').value"), '15');
    await p.key('Escape');
  }, { fresh: true });

  t.test('the code size stops at 10 and 26 by keys and slider alike', async (p) => {
    await p.click('#cmdInput');
    for (let i = 0; i < 15; i++) await p.key('=', { ctrl: true, after: 0 });
    p.assert.equal(await cssVar(p, '--code-size'), '26px');
    await openLooks(p);
    p.assert.equal(await p.ev("document.getElementById('setFont').value"), '26');
    await p.ev("document.getElementById('setFont').focus()");
    await p.key('Home');
    p.assert.equal(await cssVar(p, '--code-size'), '10px');
    await p.key('Escape');
    await p.click('#cmdInput');
    await p.key('-', { ctrl: true });
    p.assert.equal(await cssVar(p, '--code-size'), '10px');
  }, { fresh: true });
}
