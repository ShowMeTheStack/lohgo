// The History panel: the last instructions, newest first, with where they came from.
import { reset, load, gutterClick, untilPaused, f5, stepKey } from './40-dbg-lib.mjs';

async function histRows(p) {
  await p.inspector('hist');
  return p.ev("[...document.querySelectorAll('#ipane-hist .list-row')].map(r => ({ who: r.children[0].innerText, code: r.children[1].innerText, where: r.children[2].innerText, click: r.classList.contains('clickable') }))");
}

export default function (t) {
  t.beforeEach(reset);

  t.test('History explains itself before anything has run', async (p) => {
    await p.click('#itab-hist');
    p.assert.match(await p.paneText('hist'), /The last instructions your program ran show up here/);
  }, { fresh: true });
  t.test('the newest instruction is listed first', async (p) => {
    await load(p, 'print 1\nprint 2\nprint 3\n');
    await gutterClick(p, 2);
    await f5(p);
    await untilPaused(p);
    const rows = await histRows(p);
    p.assert.deepEqual(rows.map((r) => r.code), ['print 3', 'print 2', 'print 1']);
    p.assert.deepEqual(rows.map((r) => r.where), ['e2e.lgo:3', 'e2e.lgo:2', 'e2e.lgo:1']);
  });
  t.test('instructions at the top level say "top level"', async (p) => {
    await load(p, 'print 1\nprint 2\n');
    await gutterClick(p, 1);
    await f5(p);
    await untilPaused(p);
    p.assert.ok((await histRows(p)).every((r) => r.who === 'top level'));
  });
  t.test('instructions inside procedures name the procedure', async (p) => {
    await load(p, 'to inner\n  print "i\nend\nto outer\n  inner\n  print "o\nend\nouter\nprint "t\n');
    await gutterClick(p, 8);
    await f5(p);
    await untilPaused(p);
    const rows = await histRows(p);
    p.assert.deepEqual(rows.map((r) => [r.who, r.code]), [
      ['top level', 'print "t'], ['outer', 'print "o'], ['inner', 'print "i'], ['outer', 'inner'], ['top level', 'outer'],
    ]);
  });
  t.test('each instruction on a line has its own row', async (p) => {
    await load(p, 'print 1 print 2\nprint 3\n');
    await gutterClick(p, 1);
    await f5(p);
    await untilPaused(p);
    const rows = await histRows(p);
    p.assert.equal(rows.length, 3);
    p.assert.deepEqual(rows.map((r) => r.where), ['e2e.lgo:2', 'e2e.lgo:1', 'e2e.lgo:1']);
  });
  t.test('recursive calls show up once per call', async (p) => {
    await load(p, 'to c :n\n  if :n = 0 [stop]\n  c :n - 1\nend\nc 2\nprint "x\n');
    await gutterClick(p, 5);
    await f5(p);
    await untilPaused(p);
    const rows = await histRows(p);
    p.assert.equal(rows.filter((r) => r.who === 'c' && r.code === 'c :n - 1').length, 2);
    // three IFs, plus the STOP inside the last one, which is on the same line
    p.assert.equal(rows.filter((r) => r.who === 'c' && /^if/.test(r.code)).length, 4);
  });
  t.test('the history grows with each step', async (p) => {
    await load(p, 'print 1\nprint 2\nprint 3\n');
    await p.key('F11');
    await untilPaused(p);
    const n1 = (await histRows(p)).length;
    await stepKey(p, 'F11');
    const rows = await histRows(p);
    p.assert.equal(rows.length, n1 + 1);
    p.assert.equal(rows[0].code, 'print 2');
  });
  t.test('clicking a row goes to that line', async (p) => {
    await load(p, 'print 1\nprint 2\nprint 3\n');
    await gutterClick(p, 2);
    await f5(p);
    await untilPaused(p);
    await histRows(p);
    await p.click('#ipane-hist .list-row', 'print 1');
    await p.wait('LG.app.active.editor.cursor().line === 0');
    await p.wait("LG.app.active.editor.hl.querySelectorAll('.ed-line')[0].classList.contains('flash')", 2000);
  });
  t.test('clicking a row from another file opens it at the line', async (p) => {
    await load(p, 'to libh\n  print "lib\n  print "lib2\nend\n', '/projects/libh40.lgo');
    await load(p, 'load "/projects/libh40.lgo\nlibh\nprint "done\n');
    await gutterClick(p, 2);
    await f5(p);
    await untilPaused(p);
    await histRows(p);
    await p.click('#ipane-hist .list-row', 'print "lib2');
    await p.wait("LG.app.active.path === '/projects/libh40.lgo' && LG.app.active.editor.cursor().line === 2");
  });
  t.test('the history is still there after the program ends', async (p) => {
    await load(p, 'print 1\nprint 2\n');
    await f5(p);
    await p.waitState('idle');
    const rows = await histRows(p);
    p.assert.ok(rows.length >= 2);
    p.assert.equal(rows[0].code, 'print 2');
  });
  t.test('a new run starts a new history', async (p) => {
    await load(p, 'print "first\n');
    await f5(p);
    await p.waitState('idle');
    await load(p, 'print "second\nprint "third\n');
    await gutterClick(p, 1);
    await f5(p);
    await untilPaused(p);
    const rows = await histRows(p);
    p.assert.ok(!rows.some((r) => /first/.test(r.code)));
    p.assert.equal(rows.length, 2);
  });
  t.test('a long run keeps only the last 120 rows', async (p) => {
    await load(p, 'make "k 0\nrepeat 300 [\n  make "k :k + 1\n]\nprint :k\n');
    await gutterClick(p, 4);
    await f5(p);
    await untilPaused(p);
    const rows = await histRows(p);
    p.assert.equal(rows.length, 120);
    p.assert.equal(rows[0].code, 'print :k');
  });
  t.test('rows from the command center are not links', async (p) => {
    await load(p, 'to hc\n  print "hc\nend\n');
    await f5(p);
    await p.waitState('idle');
    await gutterClick(p, 1);
    await p.command('hc', { until: ['paused'] });
    const rows = await histRows(p);
    p.assert.equal(rows[0].click, true);
    p.assert.equal(rows[0].who, 'hc');
    const cmd = rows.find((r) => r.who === 'top level');
    p.assert.ok(cmd);
    p.assert.equal(cmd.click, false);
    p.assert.equal(cmd.where, '');
    await p.stopProgram();
  });
  t.test('the History tab can be chosen by clicking it', async (p) => {
    await p.click('#itab-hist');
    p.assert.equal(await p.attr('#itab-hist', 'aria-selected'), 'true');
    p.assert.ok(await p.visible('#ipane-hist'));
    p.assert.equal(await p.attr('#itab-vars', 'aria-selected'), 'false');
  });
}
