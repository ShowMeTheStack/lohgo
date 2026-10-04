// Live resizing without a reload: shrinking and growing the window moves between the desktop,
// tablet and phone layouts and everything keeps working.
import { assertWorldShape, assertReachable, rects, modeFor } from './50-ui-lib.mjs';

const STEPS_DOWN = [[1400, 900], [1180, 820], [1024, 768], [820, 1180], [768, 1024], [600, 960], [414, 896], [390, 844], [360, 640], [320, 568]];
const cardsShown = (p) => p.ev("['worldCard','cmdCard','editorCard','inspCard'].filter(id => document.getElementById(id).getBoundingClientRect().width > 0)");
const resize = async (p, w, h) => { const small = w <= 920; await p.viewport(w, h, { mobile: small, touch: small }); await p.sleep(60); };

export default function (t) {
  t.test('shrinking step by step keeps every layout tidy', async (p) => {
    await p.command('repeat 4 [fd 80 rt 90]');
    for (const [w, h] of STEPS_DOWN) {
      await resize(p, w, h);
      const mode = modeFor(w, h);
      p.assert.ok(await p.noHScroll(), `no sideways scroll at ${w}x${h}`);
      p.assert.equal(await p.ev('LG.app.isPhone()'), mode === 'phone', `${w}x${h}`);
      p.assert.equal(await p.visible('#mbar'), mode === 'phone', `tab bar at ${w}x${h}`);
      p.assert.equal(await p.visible('#rail'), mode !== 'phone', `rail at ${w}x${h}`);
      await assertWorldShape(p);
    }
    p.assert.equal(await p.segments(), 4, 'the drawing survives');
  }, { fresh: true, timeout: 40000 });

  t.test('growing step by step brings the desktop back', async (p) => {
    await resize(p, 320, 568);
    for (const [w, h] of STEPS_DOWN.slice().reverse()) {
      await resize(p, w, h);
      p.assert.ok(await p.noHScroll(), `no sideways scroll at ${w}x${h}`);
      await assertWorldShape(p);
    }
    p.assert.deepEqual(await cardsShown(p), ['worldCard', 'cmdCard', 'editorCard', 'inspCard']);
    p.assert.equal(await p.visible('#mbar'), false);
    await assertReachable(p, ['#railFiles', '#tbInto', '#speed', '#cmdInput', '#editorTabs .etab']);
  }, { fresh: { width: 320, height: 568, mobile: true, touch: true }, timeout: 40000 });

  t.test('the canvas resolution follows the card when the window changes', async (p) => {
    const a = await p.ev('[LG.app.turtleView.canvas.width, LG.app.turtleView.canvas.height]');
    await resize(p, 1000, 700);
    await assertWorldShape(p);
    const b = await p.ev('[LG.app.turtleView.canvas.width, LG.app.turtleView.canvas.height]');
    p.assert.notDeepEqual(a, b);
    await resize(p, 1400, 900);
    await assertWorldShape(p);
    p.assert.deepEqual(await p.ev('[LG.app.turtleView.canvas.width, LG.app.turtleView.canvas.height]'), a);
  }, { fresh: true });

  t.test('the turtle and its drawing survive a trip to phone size and back', async (p) => {
    await p.command('setpc "red rt 45 fd 70 pu');
    const before = await p.turtle();
    await resize(p, 390, 844);
    await resize(p, 1400, 900);
    p.assert.deepEqual(await p.turtle(), before);
    p.assert.equal(await p.segments(), 1);
  }, { fresh: true });

  t.test('a phone left on the Code view shows all cards again on a desktop', async (p) => {
    await p.tap('#mtab-code');
    await resize(p, 1400, 900);
    p.assert.deepEqual(await cardsShown(p), ['worldCard', 'cmdCard', 'editorCard', 'inspCard']);
    await resize(p, 390, 844);
    p.assert.deepEqual(await cardsShown(p), ['editorCard'], 'and the Code view again on the phone');
  }, { fresh: { width: 390, height: 844, mobile: true, touch: true } });

  t.test('a phone left on the Files view shows the stage again on a desktop', async (p) => {
    await p.tap('#mtab-files');
    await resize(p, 1400, 900);
    p.assert.deepEqual(await cardsShown(p), ['worldCard', 'cmdCard', 'editorCard', 'inspCard']);
    p.assert.ok(await p.visible('#side'));
    const r = await rects(p, ['#side', '#stage']);
    p.assert.ok(r['#stage'].x >= r['#side'].right - 0.5);
  }, { fresh: { width: 390, height: 844, mobile: true, touch: true } });

  t.test('an open side panel floats on a tablet and hides on a phone', async (p) => {
    p.assert.equal(await p.ev("getComputedStyle(document.getElementById('side')).position"), 'static');
    await resize(p, 1024, 768);
    p.assert.equal(await p.ev("getComputedStyle(document.getElementById('side')).position"), 'fixed');
    p.assert.ok(await p.visible('#side'));
    await resize(p, 390, 844);
    p.assert.equal(await p.visible('#side'), false);
    await p.tap('#mtab-files');
    p.assert.ok(await p.visible('#side'));
  }, { fresh: true });

  t.test('custom splitter sizes do not upset the phone layout', async (p) => {
    await p.ev("document.getElementById('splitRight').focus()");
    for (let i = 0; i < 10; i++) await p.key('ArrowLeft', { after: 0 });
    await p.ev("document.getElementById('splitCmd').focus()");
    for (let i = 0; i < 10; i++) await p.key('ArrowUp', { after: 0 });
    await resize(p, 390, 844);
    const r = await rects(p, ['#worldCard', '#cmdCard']);
    p.assert.ok(r['#worldCard'].w > 360 && r['#cmdCard'].w > 360);
    p.assert.ok(r['#worldCard'].h > r['#cmdCard'].h);
    await p.tap('#mtab-code');
    p.assert.ok((await p.rect('#editorCard')).w > 360);
  }, { fresh: true });

  t.test('the big turtle world stays inside the window when it shrinks', async (p) => {
    await p.key('F4');
    await resize(p, 600, 400);
    const r = await p.rect('#worldCard');
    p.assert.ok(r.x >= 0 && r.y >= 0 && r.right <= 600 && r.bottom <= 400, JSON.stringify(r));
    await assertWorldShape(p);
    await p.key('Escape');
  }, { fresh: true });

  t.test('the big turtle world fills a phone screen', async (p) => {
    await p.click('#tbBig');
    const r = await p.rect('#worldCard');
    p.assert.ok(r.x >= 0 && r.y >= 0 && r.right <= 390 && r.bottom <= 844, JSON.stringify(r));
    p.assert.ok(r.h > 800, 'uses the height ' + r.h);
    await assertWorldShape(p);
    await p.click('#tbBig');
    p.assert.ok((await p.rect('#worldCard')).h < 600);
  }, { fresh: { width: 390, height: 844, mobile: true, touch: false } });

  t.test('an open dialog stays inside the window when it shrinks', async (p) => {
    await p.click('#railLibrary');
    await p.waitModal();
    await resize(p, 390, 844);
    const r = await p.rect('.modal');
    p.assert.ok(r.x >= 0 && r.right <= 390.5 && r.bottom <= 844.5, JSON.stringify(r));
    await p.key('Escape');
  }, { fresh: true });

  t.test('a tour moves its bubble when the window changes', async (p) => {
    await p.ev("LG.Tours.start(LG.app, 'welcome')");
    await p.ev('LG.Tours.next()');
    await p.sleep(300);
    const a = await p.rect('.tour-spot');
    await resize(p, 1000, 700);
    await p.sleep(100);
    const b = await p.rect('.tour-spot');
    const w = await p.rect('#worldCard');
    p.assert.notDeepEqual(a, b);
    p.assert.ok(Math.abs(b.x - (w.x - 5)) < 2 && Math.abs(b.w - (w.w + 10)) < 2, 'spotlight follows the turtle world');
    await p.ev('LG.Tours.stop()');
  }, { fresh: true });

  t.test('only the height shrinking keeps the world 4:3 and the input usable', async (p) => {
    for (const h of [900, 700, 560, 480]) {
      await resize(p, 1400, h);
      await assertWorldShape(p);
      await assertReachable(p, ['#cmdInput', '#tbRun']);
    }
  }, { fresh: true });

  t.test('a program keeps running while the window is resized', async (p) => {
    await p.runProgram('repeat 200 [fd 1 rt 2 wait 1]\nprint "finished\n', { wait: false });
    for (const [w, h] of [[900, 700], [390, 844], [1400, 900]]) await resize(p, w, h);
    await p.waitState('idle', 15000);
    await p.waitOutput(/finished/);
  }, { fresh: true, timeout: 30000 });

  t.test('turning a tablet between portrait and landscape keeps the stage tidy', async (p) => {
    for (const [w, h] of [[768, 1024], [1024, 768], [768, 1024], [1024, 768]]) {
      await resize(p, w, h);
      p.assert.ok(await p.noHScroll());
      p.assert.deepEqual(await cardsShown(p), ['worldCard', 'cmdCard', 'editorCard', 'inspCard']);
      await assertWorldShape(p);
    }
  }, { fresh: { width: 768, height: 1024, mobile: true, touch: true } });
}
