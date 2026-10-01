// The Call Stack panel: frames newest first, choosing a frame, the frame mark in the editor,
// deep recursion and event handlers.
import { PATH, reset, load, gutterClick, markedLine, waitMarked, untilPaused, f5, stackRows, varRow, seen } from './40-dbg-lib.mjs';

// 1 to fact :n / 2 if :n < 2 [output 1] / 3 output :n * fact :n - 1 / 4 end / 5 print fact 3
const FACT = 'to fact :n\n  if :n < 2 [output 1]\n  output :n * fact :n - 1\nend\nprint fact 3\n';

async function pauseAtBottom(p) {
  await load(p, FACT);
  await gutterClick(p, 1);
  await p.ev(`LG.app.breakpoints.get('${PATH}').get(1).cond = ':n = 1'; LG.app.breakpointsChanged('${PATH}')`);
  await f5(p);
  await untilPaused(p);
}

export default function (t) {
  t.beforeEach(reset);

  t.test('the Call Stack explains itself when nothing runs', async (p) => {
    await load(p, FACT);
    await p.click('#itab-stack');
    p.assert.match(await p.paneText('stack'), /Nothing is running/);
    p.assert.equal(await p.count('#ipane-stack .frame-row'), 0);
  });
  t.test('the Call Stack says to pause while a program runs', async (p) => {
    await load(p, 'forever [make "z 1]\n');
    await f5(p);
    await p.sleep(80);
    await p.click('#itab-stack');
    p.assert.match(await p.paneText('stack'), /running\. Pause it/);
    await p.stopProgram();
  });
  t.test('frames are listed newest first with their inputs', async (p) => {
    await pauseAtBottom(p);
    const rows = await stackRows(p);
    p.assert.deepEqual(rows.map((r) => r.title), ['fact 1', 'fact 2', 'fact 3', 'top level']);
    p.assert.deepEqual(rows.map((r) => r.lvl), ['#3', '#2', '#1', '#0']);
  });
  t.test('the heading counts the levels and says newest first', async (p) => {
    await pauseAtBottom(p);
    await stackRows(p);
    p.assert.match(await p.text('#ipane-stack .vsec'), /4 levels · newest first/i);
  });
  t.test('a single top level frame says "1 level"', async (p) => {
    await load(p, 'print 1\nprint 2\n');
    await p.key('F11');
    await untilPaused(p);
    const rows = await stackRows(p);
    p.assert.deepEqual(rows.map((r) => r.title), ['top level']);
    p.assert.equal(await p.ev("document.querySelector('#ipane-stack .vsec').textContent"), '1 level');
  });
  t.test('each frame shows the file and line it is at', async (p) => {
    await pauseAtBottom(p);
    const rows = await stackRows(p);
    p.assert.deepEqual(rows.map((r) => r.where), ['e2e.lgo:2', 'e2e.lgo:3', 'e2e.lgo:3', 'e2e.lgo:5']);
  });
  t.test('the newest frame is selected at first', async (p) => {
    await pauseAtBottom(p);
    const rows = await stackRows(p);
    p.assert.deepEqual(rows.map((r) => r.sel), [true, false, false, false]);
    p.assert.equal(await p.attr('#frame3', 'aria-current'), 'true');
  });
  t.test('words and lists in inputs are shown the Logo way', async (p) => {
    await load(p, 'to g :a :b :c\n  print :a\nend\ng [1 [2 3]] "abc 4.5\n');
    await gutterClick(p, 1);
    await f5(p);
    await untilPaused(p);
    const rows = await stackRows(p);
    p.assert.equal(rows[0].title, 'g [1 [2 3]] "abc 4.5');
  });
  t.test('a procedure with no inputs shows just its name', async (p) => {
    await load(p, 'to noargs\n  print 1\nend\nnoargs\n');
    await gutterClick(p, 1);
    await f5(p);
    await untilPaused(p);
    p.assert.equal((await stackRows(p))[0].title, 'noargs');
  });
  t.test('clicking an older frame selects it', async (p) => {
    await pauseAtBottom(p);
    await stackRows(p);
    await p.click('#frame1');
    const rows = await stackRows(p);
    p.assert.deepEqual(rows.map((r) => r.sel), [false, false, true, false]);
  });
  t.test('selecting an older frame marks its line in the editor', async (p) => {
    await pauseAtBottom(p);
    await stackRows(p);
    await p.click('#frame0');
    await waitMarked(p, 'frame', 4);
    p.assert.equal(await markedLine(p, 'exec'), 1, 'the exec line stays');
    p.assert.match((await p.ev("[...LG.app.active.editor.inner.querySelectorAll('.ed-gl')].map(e => e.className)"))[4], /frame/);
  });
  t.test('the frame mark is drawn differently from the exec line', async (p) => {
    await load(p, 'to a1\n  b1\nend\nto b1\n  print 1\nend\na1\n');
    await gutterClick(p, 4);
    await f5(p);
    await untilPaused(p);
    await stackRows(p);
    await p.click('#frame1');
    await waitMarked(p, 'frame', 1);
    const bg = await p.ev("(() => { const l = LG.app.active.editor.hl.querySelectorAll('.ed-line'); return [getComputedStyle(l[1]).backgroundColor, getComputedStyle(l[4]).backgroundColor]; })()");
    p.assert.notEqual(bg[0], 'rgba(0, 0, 0, 0)');
    p.assert.notEqual(bg[0], bg[1]);
  });
  t.test('selecting a frame changes the Variables panel to that frame', async (p) => {
    await pauseAtBottom(p);
    await stackRows(p);
    await p.click('#frame1');
    await p.click('#itab-vars');
    p.assert.equal((await varRow(p, 'n', 'frame')).value, '3');
    p.assert.match(await p.text('#ipane-vars .insp-tools span'), /In fact 3\s+· line 3/);
  });
  for (const [i, n] of [[3, '1'], [2, '2'], [1, '3']]) {
    t.test(`frame #${i} shows n = ${n} in Variables`, async (p) => {
      await pauseAtBottom(p);
      await stackRows(p);
      await p.click('#frame' + i);
      await p.click('#itab-vars');
      p.assert.equal((await varRow(p, 'n', 'frame')).value, n);
      p.assert.match(await p.paneText('vars'), /Inputs and locals of fact/i);
    });
  }
  t.test('selecting the top level frame shows only globals', async (p) => {
    await load(p, 'make "g1 7\n' + FACT);
    await gutterClick(p, 2);
    await f5(p);
    await untilPaused(p);
    await stackRows(p);
    await p.click('#frame0');
    await p.click('#itab-vars');
    p.assert.match(await p.text('#ipane-vars .insp-tools span'), /^Top level/);
    p.assert.ok(!/Inputs and locals/i.test(await p.paneText('vars')));
    p.assert.equal((await varRow(p, 'g1', 'g')).value, '7');
  });
  t.test('Enter on a focused frame row selects it', async (p) => {
    await pauseAtBottom(p);
    await stackRows(p);
    await p.ev("document.getElementById('frame2').focus()");
    await p.key('Enter');
    p.assert.ok(await p.ev("document.getElementById('frame2').classList.contains('sel')"));
    await waitMarked(p, 'frame', 2);
  });
  t.test('Space on a focused frame row selects it', async (p) => {
    await pauseAtBottom(p);
    await stackRows(p);
    await p.ev("document.getElementById('frame1').focus()");
    await p.key(' ');
    p.assert.ok(await p.ev("document.getElementById('frame1').classList.contains('sel')"));
  });
  t.test('Tab moves between frame rows', async (p) => {
    await pauseAtBottom(p);
    await stackRows(p);
    await p.ev("document.getElementById('frame3').focus()");
    await p.key('Tab');
    p.assert.equal(await p.ev('document.activeElement.id'), 'frame2');
  });
  t.test('selecting the newest frame again removes the frame mark', async (p) => {
    await pauseAtBottom(p);
    await stackRows(p);
    await p.click('#frame1');
    await waitMarked(p, 'frame', 2);
    await p.click('#frame3');
    await p.sleep(60);
    p.assert.equal(await markedLine(p, 'frame'), -1);
    p.assert.equal(await markedLine(p, 'exec'), 1);
  });
  t.test('continuing resets the selection to the newest frame', async (p) => {
    await load(p, 'to c :n\n  if :n = 0 [stop]\n  print :n\n  c :n - 1\nend\nc 3\n');
    await gutterClick(p, 2);
    await f5(p);
    await untilPaused(p);
    await p.key('F5');
    await untilPaused(p);
    await stackRows(p);
    await p.click('#frame0');
    await p.key('F5');
    await untilPaused(p);
    const rows = await stackRows(p);
    p.assert.equal(rows[0].sel, true);
    p.assert.equal(rows[0].title, 'c 1');
    p.assert.equal(await markedLine(p, 'frame'), -1);
  });
  t.test('selecting a frame in another file opens that file with the mark', async (p) => {
    await load(p, 'to lib40 :x\n  print :x\nend\n', '/projects/lib40.lgo');
    await load(p, 'to caller40\n  lib40 5\nend\nload "/projects/lib40.lgo\ncaller40\n');
    await f5(p);
    await p.waitState('idle');
    await p.ev("LG.app.openFile('/projects/lib40.lgo')");
    await gutterClick(p, 1);
    await p.ev(`LG.app.openFile('${PATH}')`);
    await f5(p);
    await untilPaused(p);
    p.assert.equal(await p.activePath(), '/projects/lib40.lgo');
    await stackRows(p);
    await p.click('#frame1');
    await p.wait(`LG.app.active.path === '${PATH}'`);
    await waitMarked(p, 'frame', 1);
  });
  t.test('commands typed in the command center run in the selected frame', async (p) => {
    await pauseAtBottom(p);
    await stackRows(p);
    await p.click('#frame1');
    await p.command('print :n * 100', { until: ['paused'] });
    await p.waitOutput(/^300$/m);
    await p.click('#frame3');
    await p.command('print :n * 100', { until: ['paused'] });
    await p.waitOutput(/^100$/m);
  });
  t.test('a deep recursion is summarised in the middle', async (p) => {
    await load(p, 'to deep :n\n  if :n = 0 [print "bottom stop]\n  deep :n - 1\nend\ndeep 500\n');
    await gutterClick(p, 1);
    await p.ev(`LG.app.breakpoints.get('${PATH}').get(1).cond = ':n = 0'; LG.app.breakpointsChanged('${PATH}')`);
    await f5(p);
    await untilPaused(p, 20000);
    const rows = await stackRows(p);
    p.assert.equal(rows.length, 400);
    p.assert.equal(rows[0].title, 'deep 0');
    p.assert.equal(rows[rows.length - 1].title, 'top level');
    p.assert.match(await p.paneText('stack'), /… 102 more levels …/);
    p.assert.match(await p.text('#ipane-stack .vsec'), /502 levels/i);
  });
  t.test('a recursion of exactly 400 levels is not summarised', async (p) => {
    await load(p, 'to deep :n\n  if :n = 0 [print "bottom stop]\n  deep :n - 1\nend\ndeep 398\n');
    await gutterClick(p, 1);
    await p.ev(`LG.app.breakpoints.get('${PATH}').get(1).cond = ':n = 0'; LG.app.breakpointsChanged('${PATH}')`);
    await f5(p);
    await untilPaused(p, 20000);
    const rows = await stackRows(p);
    p.assert.equal(rows.length, 400);
    p.assert.ok(!/more levels/.test(await p.paneText('stack')));
  });
  t.test('the oldest frames are still there after the summary and can be chosen', async (p) => {
    await load(p, 'to deep :n\n  if :n = 0 [stop]\n  deep :n - 1\nend\ndeep 450\n');
    await gutterClick(p, 1);
    await p.ev(`LG.app.breakpoints.get('${PATH}').get(1).cond = ':n = 0'; LG.app.breakpointsChanged('${PATH}')`);
    await f5(p);
    await untilPaused(p, 20000);
    await stackRows(p);
    await p.click('#frame1');
    await p.click('#itab-vars');
    p.assert.equal((await varRow(p, 'n', 'frame')).value, '450');
  });
  t.test('a procedure run by an event handler shows an event handler frame', async (p) => {
    await load(p, 'to onk\n  print "key\n  fd 10\nend\nkeyboardon [onk]\n');
    await gutterClick(p, 2);
    await f5(p);
    await p.waitState('idle');
    await p.click('#worldCanvas');
    await p.key('a');
    await untilPaused(p);
    const rows = await stackRows(p);
    p.assert.deepEqual(rows.map((r) => r.title), ['onk', 'event handler']);
    await p.key('F5');
    await p.waitState('idle');
    p.assert.equal(await p.turtle().then((x) => x.y), 10);
  });
  t.test('a timer handler pauses at a breakpoint in its procedure', async (p) => {
    await load(p, 'make "ticks 0\nto tick\n  make "ticks :ticks + 1\nend\nsettimer 1 30 [tick]\n');
    await gutterClick(p, 2);
    await f5(p);
    await untilPaused(p);
    const rows = await stackRows(p);
    p.assert.deepEqual(rows.map((r) => r.title), ['tick', 'event handler']);
    p.assert.equal(await seen(p, 'ticks'), '0');
    await p.stopProgram();
  });
  t.test('the stack is empty again once the program finishes', async (p) => {
    await load(p, 'print 1\nprint 2\n');
    await p.key('F11');
    await untilPaused(p);
    p.assert.equal((await stackRows(p)).length, 1);
    await p.key('F5');
    await p.waitState('idle');
    p.assert.equal((await stackRows(p)).length, 0);
  });
  t.test('a template inside a procedure stays in that procedure frame', async (p) => {
    await load(p, 'to walk :l\n  foreach :l [\n    print ?\n  ]\nend\nwalk [a b]\n');
    await gutterClick(p, 2);
    await f5(p);
    await untilPaused(p);
    const rows = await stackRows(p);
    p.assert.deepEqual(rows.map((r) => r.title), ['walk [a b]', 'top level']);
    await p.stopProgram();
  });
}
