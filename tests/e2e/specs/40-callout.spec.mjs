// The hover callout in the editor: values while paused (sticky, unfoldable, editable) and
// short help for primitives while idle.
import { PATH, reset, load, gutterClick, untilPaused, f5, hoverWord, charPoint, colOf, stackRows, varRow, seen } from './40-dbg-lib.mjs';

// 1 to f :n :l / 2 print :n / 3 print :l / 4 end / 5 make "g [a b c] / 6 f 7 [1 [2 3] 4]
const SRC = 'to f :n :l\n  print :n\n  print :l\nend\nmake "g [a b c]\nf 7 [1 [2 3] 4]\n';

async function pauseInF(p) {
  await load(p, SRC);
  await gutterClick(p, 1);
  await f5(p);
  await untilPaused(p);
}
const calloutRows = (p) => p.ev("[...document.querySelectorAll('.callout .vrow:not(.pager)')].map(r => ({ name: r.querySelector('.vn span:not(.twisty)').innerText, value: r.querySelector('.vv').innerText, key: r.dataset.key }))");
const isOpen = (p) => p.ev("!!document.querySelector('.callout')");
async function away(p) { await p.mouse('mouseMoved', 5, 5); }

export default function (t) {
  t.beforeEach(async (p) => { await away(p); await reset(p); });

  t.test('hovering :n while paused shows its value', async (p) => {
    await pauseInF(p);
    await hoverWord(p, 1, ':n');
    p.assert.deepEqual((await calloutRows(p)).map((r) => [r.name, r.value]), [['n', '7']]);
  });
  t.test('hovering the input name on the TO line shows it too', async (p) => {
    await pauseInF(p);
    await hoverWord(p, 0, ':l');
    p.assert.equal((await calloutRows(p))[0].value, '[1 [2 3] 4]');
  });
  t.test('hovering a quoted name shows the variable', async (p) => {
    await pauseInF(p);
    await hoverWord(p, 4, '"g');
    p.assert.deepEqual((await calloutRows(p)).map((r) => [r.name, r.value]), [['g', '[a b c]']]);
  });
  t.test('the callout says it shows the newest frame and how to change it', async (p) => {
    await pauseInF(p);
    await hoverWord(p, 1, ':n');
    p.assert.match(await p.text('.callout-foot'), /Value in f \(the newest frame\)\. Click it to change it\. Use the Call Stack for older frames\./);
  });
  t.test('at the top level the footer just says how to change the value', async (p) => {
    await load(p, 'make "top 5\nprint :top\n');
    await gutterClick(p, 1);
    await f5(p);
    await untilPaused(p);
    await hoverWord(p, 1, ':top');
    p.assert.equal(await p.text('.callout-foot'), 'Click the value to change it.');
  });
  t.test('the callout opens next to the mouse and inside the window', async (p) => {
    await pauseInF(p);
    const [x, y] = await hoverWord(p, 1, ':n');
    await p.sleep(200); // let the opening animation finish
    const r = await p.rect('.callout');
    const info = JSON.stringify([x, y, r]);
    // it starts just right of the mouse unless that would run off the window; then it keeps an 8px margin
    p.assert.ok(r.x <= x + 6.5, 'not right of the mouse ' + info);
    p.assert.ok(r.right <= 1400 - 7.5, 'inside the window with a margin ' + info);
    p.assert.ok(r.x === x + 6 || Math.abs(r.right - (1400 - 8)) < 1, 'at the mouse or against the margin ' + info);
    p.assert.ok(r.y > y && r.y < y + 60, 'just below the mouse');
    p.assert.ok(r.bottom <= 900);
  });
  t.test('a word with no value shows no callout', async (p) => {
    await load(p, 'to f :n\n  print :nothere\nend\nf 1\n');
    await gutterClick(p, 1);
    await f5(p);
    await untilPaused(p);
    await hoverWord(p, 1, ':nothere', { expect: false });
    p.assert.equal(await isOpen(p), false);
  });
  t.test('a primitive while paused shows no callout', async (p) => {
    await pauseInF(p);
    await hoverWord(p, 1, 'print', { expect: false });
    p.assert.equal(await isOpen(p), false);
  });
  t.test('a number shows no callout', async (p) => {
    await pauseInF(p);
    await hoverWord(p, 5, '7', { expect: false, offset: 0 });
    p.assert.equal(await isOpen(p), false);
  });
  t.test('a list value unfolds inside the callout', async (p) => {
    await pauseInF(p);
    await hoverWord(p, 2, ':l');
    await p.click('.callout .twisty');
    const rows = await calloutRows(p);
    p.assert.deepEqual(rows.map((r) => [r.name, r.value]), [['l', '[1 [2 3] 4]'], ['1', '1'], ['2', '[2 3]'], ['3', '4']]);
    p.assert.ok(await isOpen(p), 'still open after clicking inside it');
  });
  t.test('a nested list unfolds two levels in the callout', async (p) => {
    await pauseInF(p);
    await hoverWord(p, 2, ':l');
    await p.click('.callout .twisty');
    await p.click('.callout .vrow[data-key="callout/l/2"] .twisty');
    const rows = await calloutRows(p);
    p.assert.deepEqual(rows.filter((r) => r.key.startsWith('callout/l/2/')).map((r) => r.value), ['2', '3']);
  });
  t.test('changing the value in the callout changes the newest frame', async (p) => {
    await pauseInF(p);
    await hoverWord(p, 1, ':n');
    await p.click('.callout .vv');
    await p.wait("!!document.querySelector('.callout .vv input')");
    await p.ev("document.querySelector('.callout .vv input').select()");
    await p.insertText('99');
    await p.key('Enter');
    await p.sleep(80);
    p.assert.equal(await seen(p, 'n'), '99');
    p.assert.equal((await calloutRows(p))[0].value, '99');
    await p.key('F5');
    await p.waitState('idle');
    p.assert.match(await p.output(), /^99$/m);
  });
  t.test('a change in the callout shows up in the Variables panel', async (p) => {
    await pauseInF(p);
    await p.click('#itab-vars');
    await hoverWord(p, 1, ':n');
    await p.click('.callout .vv');
    await p.ev("document.querySelector('.callout .vv input').select()");
    await p.insertText('"seven');
    await p.key('Enter');
    p.assert.equal((await varRow(p, 'n', 'frame')).value, '"seven');
  });
  t.test('an item of a list can be changed in the callout', async (p) => {
    await pauseInF(p);
    await gutterClick(p, 1);
    await gutterClick(p, 2);
    await p.key('F5');
    await untilPaused(p);
    await hoverWord(p, 2, ':l');
    await p.click('.callout .twisty');
    await p.click('.callout .vrow[data-key="callout/l/3"] .vv');
    await p.ev("document.querySelector('.callout .vv input').select()");
    await p.insertText('40');
    await p.key('Enter');
    await p.sleep(60);
    p.assert.equal(await seen(p, 'l'), '[1 [2 3] 40]');
    await p.key('F5');
    await p.waitState('idle');
    p.assert.match(await p.output(), /^1 \[2 3\] 40$/m);
  });
  t.test('Escape while editing in the callout keeps the old value', async (p) => {
    await pauseInF(p);
    await hoverWord(p, 1, ':n');
    await p.click('.callout .vv');
    await p.insertText('5');
    await p.key('Escape');
    p.assert.equal(await seen(p, 'n'), '7');
    p.assert.equal(await isOpen(p), true, 'the first Escape only cancels the edit');
    p.assert.equal((await calloutRows(p))[0].value, '7');
    await p.key('Escape');
    p.assert.equal(await isOpen(p), false);
  });
  t.test('the callout edits the newest frame even when an older one is selected', async (p) => {
    await load(p, 'to r :n\n  if :n = 0 [stop]\n  r :n - 1\nend\nr 2\n');
    await gutterClick(p, 1);
    await p.ev(`LG.app.breakpoints.get('${PATH}').get(1).cond = ':n = 0'; LG.app.breakpointsChanged('${PATH}')`);
    await f5(p);
    await untilPaused(p);
    await stackRows(p);
    await p.click('#frame1');
    await hoverWord(p, 1, ':n');
    p.assert.equal((await calloutRows(p))[0].value, '0');
  });
  t.test('the callout stays open while the mouse is inside it', async (p) => {
    await pauseInF(p);
    await hoverWord(p, 2, ':l');
    const r = await p.rect('.callout');
    await p.mouse('mouseMoved', r.x + r.w / 2, r.y + 4);
    await p.mouse('mouseMoved', r.x + r.w / 2, r.y + r.h / 2);
    await p.sleep(1000);
    p.assert.equal(await isOpen(p), true);
  });
  t.test('leaving the callout closes it after a short delay', async (p) => {
    await pauseInF(p);
    await hoverWord(p, 2, ':l');
    const r = await p.rect('.callout');
    await p.mouse('mouseMoved', r.x + r.w / 2, r.y + r.h / 2);
    await p.sleep(100);
    await p.mouse('mouseMoved', r.right + 200, r.bottom + 100);
    await p.sleep(120);
    p.assert.equal(await isOpen(p), true, 'not straight away');
    await p.wait("!document.querySelector('.callout')", 2000);
  });
  t.test('moving off the word closes the callout after a delay', async (p) => {
    await pauseInF(p);
    const [x, y] = await hoverWord(p, 1, ':n');
    await p.mouse('mouseMoved', x, y - 200);
    await p.sleep(100);
    p.assert.equal(await isOpen(p), true);
    await p.wait("!document.querySelector('.callout')", 2000);
  });
  t.test('hovering another variable replaces the callout', async (p) => {
    await pauseInF(p);
    // the callout opens below the mouse, so go upwards to a word it does not cover
    await hoverWord(p, 2, ':l');
    await hoverWord(p, 1, ':n');
    await p.wait("document.querySelectorAll('.callout').length === 1 && document.querySelector('.callout .vrow').dataset.key === 'callout/n'");
  });
  t.test('Escape closes the callout', async (p) => {
    await pauseInF(p);
    await hoverWord(p, 1, ':n');
    await p.key('Escape');
    p.assert.equal(await isOpen(p), false);
    p.assert.equal(await p.state(), 'paused');
  });
  t.test('continuing the program closes the callout', async (p) => {
    await pauseInF(p);
    await hoverWord(p, 1, ':n');
    await p.key('F5');
    await p.waitState('idle');
    p.assert.equal(await isOpen(p), false);
  });
  t.test('hovering a primitive when idle shows its reference summary', async (p) => {
    await load(p, 'forward 100\nrepeat 4 [rt 90]\n');
    await hoverWord(p, 0, 'forward');
    const txt = await p.text('.callout');
    p.assert.match(txt, /forward/i);
    p.assert.match(txt, /F1 for more/);
  });
  for (const w of ['repeat', 'rt']) {
    t.test(`hovering ${w} when idle shows help for it`, async (p) => {
      await load(p, 'forward 100\nrepeat 4 [rt 90]\n');
      await hoverWord(p, 1, w);
      p.assert.match(await p.text('.callout'), new RegExp(w === 'rt' ? 'right|rt' : 'repeat', 'i'));
    });
  }
  t.test('hovering a procedure of your own when idle shows nothing', async (p) => {
    await load(p, 'to mine40\nend\nmine40\n');
    await hoverWord(p, 2, 'mine40', { expect: false });
    p.assert.equal(await isOpen(p), false);
  });
  t.test('hovering a variable when idle shows nothing', async (p) => {
    await load(p, 'make "v 1\nprint :v\n');
    await f5(p);
    await p.waitState('idle');
    await hoverWord(p, 1, ':v', { expect: false });
    p.assert.equal(await isOpen(p), false);
  });
  t.test('values are shown after an error too', async (p) => {
    await load(p, 'to bad :n\n  print :n / 0\nend\nbad 4\n');
    await f5(p);
    await p.waitState('error');
    await hoverWord(p, 1, ':n');
    p.assert.equal((await calloutRows(p))[0].value, '4');
  });
  t.test('a tap on a variable shows the callout on a touch screen', async (p) => {
    await load(p, SRC);
    await gutterClick(p, 1);
    await f5(p);
    await untilPaused(p);
    const col = await colOf(p, 1, ':n');
    const [x, y] = await charPoint(p, 1, col + 1);
    await p.b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await p.b.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.wait("!!document.querySelector('.callout')", 3000);
    p.assert.equal((await calloutRows(p))[0].value, '7');
  }, { fresh: { touch: true, width: 1200, height: 900 } });
  t.test('a tap on a primitive shows its help on a touch screen', async (p) => {
    await load(p, 'forward 100\n');
    const [x, y] = await charPoint(p, 0, 2);
    await p.b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await p.b.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.wait("!!document.querySelector('.callout')", 3000);
    p.assert.match(await p.text('.callout'), /F1 for more/);
  }, { fresh: { touch: true, width: 1200, height: 900 } });
}
