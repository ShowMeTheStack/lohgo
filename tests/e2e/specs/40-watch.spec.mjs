// The Watch panel: adding and removing watches, their values in the selected frame, errors for
// expressions a watch may not run, and watches that stop the program.
import { PATH, reset, load, gutterClick, untilPaused, f5, stackRows, watchRows, charPoint, colOf, seen } from './40-dbg-lib.mjs';

async function addByEnter(p, expr) {
  await p.click('#itab-watch');
  await p.click('#watchInput');
  await p.insertText(expr);
  await p.key('Enter');
  await p.sleep(40);
}
async function addByButton(p, expr) {
  await p.click('#itab-watch');
  await p.click('#watchInput');
  await p.insertText(expr);
  await p.click('#watchAdd');
  await p.sleep(40);
}
async function setMode(p, i, value) {
  await p.ev(`(() => { const s = document.querySelector('#watch${i} select'); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await p.sleep(40);
}
const REC = 'to r :n\n  if :n = 0 [stop]\n  print :n\n  r :n - 1\nend\nr 3\n';

export default function (t) {
  t.beforeEach(reset);

  t.test('the Watch tab explains itself when empty', async (p) => {
    await p.click('#itab-watch');
    p.assert.match(await p.paneText('watch'), /Type an expression above/);
    p.assert.equal(await p.ev("document.querySelector('#itab-watch .badge').classList.contains('hidden')"), true);
  });
  t.test('Enter in the watch box adds a watch and clears the box', async (p) => {
    await addByEnter(p, ':size');
    p.assert.deepEqual((await watchRows(p)).map((w) => w.expr), [':size']);
    p.assert.equal(await p.ev("document.getElementById('watchInput').value"), '');
  });
  t.test('the Add button adds a watch', async (p) => {
    await addByButton(p, '3 + 4');
    const w = await watchRows(p);
    p.assert.deepEqual(w.map((x) => [x.expr, x.value]), [['3 + 4', '7']]);
  });
  t.test('an empty watch box adds nothing', async (p) => {
    await p.click('#itab-watch');
    await p.click('#watchInput');
    await p.insertText('   ');
    await p.click('#watchAdd');
    p.assert.equal((await watchRows(p)).length, 0);
  });
  t.test('the badge counts the watches', async (p) => {
    await addByEnter(p, '1');
    await addByEnter(p, '2');
    p.assert.equal(await p.text('#itab-watch .badge'), '2');
  });
  t.test('watches are listed in the order they were added', async (p) => {
    await addByEnter(p, '"b');
    await addByEnter(p, '"a');
    await addByEnter(p, '"c');
    p.assert.deepEqual((await watchRows(p)).map((w) => w.expr), ['"b', '"a', '"c']);
  });
  t.test('a watch on a global shows its value when idle', async (p) => {
    await p.command('make "wg [1 2]');
    await addByEnter(p, ':wg');
    p.assert.equal((await watchRows(p))[0].value, '[1 2]');
  });
  t.test('a watch updates after a command changes the global', async (p) => {
    await p.command('make "wg2 1');
    await addByEnter(p, ':wg2 * 10');
    await p.command('make "wg2 5');
    await p.click('#itab-watch');
    p.assert.equal((await watchRows(p))[0].value, '50');
  });
  t.test('a watch on an input shows the value in the paused frame', async (p) => {
    await load(p, REC);
    await gutterClick(p, 2);
    await addByEnter(p, ':n');
    await f5(p);
    await untilPaused(p);
    await p.click('#itab-watch');
    p.assert.equal((await watchRows(p))[0].value, '3');
    await p.key('F5');
    await untilPaused(p);
    await p.click('#itab-watch');
    p.assert.equal((await watchRows(p))[0].value, '2');
  });
  t.test('a watch follows the frame chosen in the Call Stack', async (p) => {
    await load(p, REC);
    await gutterClick(p, 2);
    await p.ev(`LG.app.breakpoints.get('${PATH}').get(2).cond = ':n = 1'; LG.app.breakpointsChanged('${PATH}')`);
    await addByEnter(p, ':n * 2');
    await f5(p);
    await untilPaused(p);
    await stackRows(p);
    await p.click('#frame1');
    await p.click('#itab-watch');
    p.assert.equal((await watchRows(p))[0].value, '6');
    await stackRows(p);
    await p.click('#frame3');
    await p.click('#itab-watch');
    p.assert.equal((await watchRows(p))[0].value, '2');
  });
  t.test('a watch on a word shows it with a quote', async (p) => {
    await addByEnter(p, 'word "ab "cd');
    p.assert.equal((await watchRows(p))[0].value, '"abcd');
  });
  t.test('a watch on a list operation shows the list', async (p) => {
    await addByEnter(p, 'butfirst [a b c]');
    p.assert.equal((await watchRows(p))[0].value, '[b c]');
  });
  t.test('a watch on an unknown variable shows the error', async (p) => {
    await addByEnter(p, ':nosuch40');
    const w = (await watchRows(p))[0];
    p.assert.match(w.value, /nosuch40 has no value/i);
  });
  t.test('a watch that calls a procedure is refused with a reason', async (p) => {
    await load(p, 'to dbl :x\n  output :x * 2\nend\n');
    await f5(p);
    await p.waitState('idle');
    await addByEnter(p, 'dbl 3');
    p.assert.match((await watchRows(p))[0].value, /only use variables and simple operations/);
  });
  t.test('a watch with MAKE is refused and does not change anything', async (p) => {
    await p.command('make "safe 1');
    await addByEnter(p, 'make "safe 2');
    p.assert.match((await watchRows(p))[0].value, /only use variables and simple operations/);
    p.assert.equal(await p.ev("LG.Data.showText(LG.app.interp.globals.get('safe'))"), '1');
  });
  t.test('a watch with PRINT is refused and prints nothing', async (p) => {
    await addByEnter(p, 'print "leak');
    p.assert.match((await watchRows(p))[0].value, /only use variables|not procedures or commands/);
    p.assert.ok(!/leak/.test(await p.output()));
  });
  t.test('a watch with two expressions asks for one at a time', async (p) => {
    await addByEnter(p, '1 2');
    p.assert.match((await watchRows(p))[0].value, /one expression at a time/);
  });
  t.test('a watch that divides by zero shows the error', async (p) => {
    await addByEnter(p, '1 / 0');
    p.assert.match((await watchRows(p))[0].value, /doesn't like 0/);
  });
  t.test('the remove button removes that watch only', async (p) => {
    await addByEnter(p, '1');
    await addByEnter(p, '2');
    await addByEnter(p, '3');
    await p.click('#watch1 button[aria-label="Remove watch 2"]');
    p.assert.deepEqual((await watchRows(p)).map((w) => w.expr), ['1', '3']);
    p.assert.equal(await p.text('#itab-watch .badge'), '2');
  });
  t.test('removing the last watch shows the empty text and hides the badge', async (p) => {
    await addByEnter(p, '1');
    await p.click('#watch0 button');
    p.assert.match(await p.paneText('watch'), /Type an expression above/);
    p.assert.equal(await p.ev("document.querySelector('#itab-watch .badge').classList.contains('hidden')"), true);
  });
  t.test('the mode select offers just watch, stop when it changes and stop when true', async (p) => {
    await addByEnter(p, '1');
    const opts = await p.ev("[...document.querySelectorAll('#watch0 select option')].map(o => o.textContent)");
    p.assert.deepEqual(opts, ['just watch', 'stop when it changes', 'stop when true']);
    p.assert.equal((await watchRows(p))[0].mode, '');
  });
  t.test('"stop when it changes" pauses the program when the value changes', async (p) => {
    await load(p, 'make "cnt 0\nrepeat 5 [\n  make "cnt :cnt + 1\n]\nprint "done\n');
    await addByEnter(p, ':cnt');
    await setMode(p, 0, 'change');
    await f5(p);
    await untilPaused(p);
    p.assert.equal(await seen(p, 'cnt'), '1');
    p.assert.match(await p.status(), /A watch changed/);
    p.assert.equal(await p.ev('LG.app.inspector.tab'), 'watch');
    p.assert.equal((await watchRows(p))[0].value, '1');
    await p.key('F5');
    await untilPaused(p);
    p.assert.equal(await seen(p, 'cnt'), '2');
    await p.stopProgram();
  });
  t.test('"stop when true" pauses the program when the expression becomes true', async (p) => {
    await load(p, 'make "cnt 0\nrepeat 10 [\n  make "cnt :cnt + 1\n]\nprint "done\n');
    await addByEnter(p, ':cnt = 4');
    await setMode(p, 0, 'true');
    await f5(p);
    await untilPaused(p);
    p.assert.equal(await seen(p, 'cnt'), '4');
    p.assert.equal((await watchRows(p))[0].value, '"true');
    await p.key('F5');
    await p.waitState('idle');
    await p.waitOutput(/done/);
  });
  t.test('"stop when true" stops each time it turns true again', async (p) => {
    await load(p, 'make "cnt 0\nrepeat 10 [\n  make "cnt :cnt + 1\n]\n');
    await addByEnter(p, '(remainder :cnt 3) = 0');
    await setMode(p, 0, 'true');
    await f5(p);
    const seenVals = [];
    for (;;) {
      await p.waitState(['paused', 'idle']);
      if ((await p.state()) !== 'paused') break;
      seenVals.push(await seen(p, 'cnt'));
      await p.key('F5');
    }
    p.assert.deepEqual(seenVals, ['0', '3', '6', '9'], JSON.stringify(seenVals));
  });
  t.test('a watch on an input stops when it changes in the procedure', async (p) => {
    await load(p, 'to grow :x\n  make "x :x * 2\n  make "x :x * 2\n  print :x\nend\ngrow 1\n');
    await addByEnter(p, ':x');
    await setMode(p, 0, 'change');
    await f5(p);
    await untilPaused(p);
    p.assert.equal(await seen(p, 'x'), '2');
    await p.stopProgram();
  });
  t.test('"just watch" never stops the program', async (p) => {
    await load(p, 'make "cnt 0\nrepeat 5 [make "cnt :cnt + 1]\nprint "done\n');
    await addByEnter(p, ':cnt');
    await setMode(p, 0, 'change');
    await setMode(p, 0, '');
    await f5(p);
    await p.waitState('idle');
    await p.waitOutput(/done/);
  });
  t.test('a removed stopping watch no longer stops the program', async (p) => {
    await load(p, 'make "cnt 0\nrepeat 5 [make "cnt :cnt + 1]\nprint "done\n');
    await addByEnter(p, ':cnt');
    await setMode(p, 0, 'change');
    await p.click('#watch0 button');
    await f5(p);
    await p.waitState('idle');
    await p.waitOutput(/done/);
  });
  t.test('watches and their modes survive a reload', async (p) => {
    await addByEnter(p, ':a');
    await addByEnter(p, ':b + 1');
    await setMode(p, 1, 'true');
    await p.reload();
    await p.click('#itab-watch');
    const w = await watchRows(p);
    p.assert.deepEqual(w.map((x) => [x.expr, x.mode]), [[':a', ''], [':b + 1', 'true']]);
    p.assert.equal(await p.text('#itab-watch .badge'), '2');
  });
  t.test('a stopping watch still stops after a reload', async (p) => {
    await addByEnter(p, ':cnt');
    await setMode(p, 0, 'change');
    await p.reload();
    await load(p, 'make "cnt 0\nrepeat 3 [make "cnt :cnt + 1]\n');
    await f5(p);
    await untilPaused(p);
    p.assert.equal(await seen(p, 'cnt'), '1');
    await p.stopProgram();
  });
  t.test('Watch :name in the code context menu adds a watch', async (p) => {
    await load(p, 'to sq :side\n  repeat 4 [fd :side rt 90]\nend\n');
    const col = await colOf(p, 1, ':side');
    const [x, y] = await charPoint(p, 1, col + 2);
    await p.clickAt(x, y, { button: 'right' });
    await p.wait("!!document.querySelector('.menu-pop')");
    p.assert.ok(await p.exists('.menu-pop .menu-item'));
    await p.click('.menu-pop .menu-item', 'Watch :side');
    await p.wait("LG.app.inspector.tab === 'watch'");
    p.assert.deepEqual((await watchRows(p)).map((w) => w.expr), [':side']);
  });
  t.test('Watch in the context menu works on a quoted name too', async (p) => {
    await load(p, 'make "total 0\n');
    const col = await colOf(p, 0, '"total');
    const [x, y] = await charPoint(p, 0, col + 2);
    await p.clickAt(x, y, { button: 'right' });
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.click('.menu-pop .menu-item', 'Watch :total');
    p.assert.deepEqual((await watchRows(p)).map((w) => w.expr), [':total']);
  });
  t.test('the code context menu on a primitive offers help, not a watch', async (p) => {
    await load(p, 'forward 10\n');
    const [x, y] = await charPoint(p, 0, 2);
    await p.clickAt(x, y, { button: 'right' });
    await p.wait("!!document.querySelector('.menu-pop')");
    const items = await p.ev("[...document.querySelectorAll('.menu-pop .menu-item')].map(e => e.children[0].innerText)");
    p.assert.ok(items.some((i) => /^Help on forward/i.test(i)));
    p.assert.ok(!items.some((i) => /^Watch/.test(i)));
    await p.closeMenus();
  });
  t.test('typing in the watch box does not trigger shortcuts', async (p) => {
    await p.click('#itab-watch');
    await p.click('#watchInput');
    await p.type(':a b');
    p.assert.equal(await p.ev("document.getElementById('watchInput').value"), ':a b');
  });
}
