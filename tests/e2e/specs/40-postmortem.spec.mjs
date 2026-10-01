// After an error: the message, Problems, the marked line, and looking at the frames as they were
// when it happened. Commands typed then run in the chosen frame; the next run clears it all.
import { reset, load, f5, stackRows, varRow, varRows, markedLine, waitMarked, gutterClasses, cellSel, editCell } from './40-dbg-lib.mjs';

// 1 to fact :n / 2 if :n = 0 [output 1 / :n] / 3 output :n * fact :n - 1 / 4 end / 5 make "g 9 / 6 print fact 3
const BAD = 'to fact :n\n  if :n = 0 [output 1 / :n]\n  output :n * fact :n - 1\nend\nmake "g 9\nprint fact 3\n';

async function crash(p, src = BAD) {
  await load(p, src);
  await f5(p);
  await p.waitState('error');
  await p.sleep(60);
}

export default function (t) {
  t.beforeEach(reset);

  t.test('the error is shown in the command center with the procedure and line', async (p) => {
    await crash(p);
    const out = await p.output();
    p.assert.match(out, /\/ doesn't like 0 as input/);
    p.assert.match(out, /in fact/);
    p.assert.match(out, /if :n = 0 \[output 1 \/ :n\]/);
    p.assert.match(out, /e2e\.lgo, line 2/);
  });
  t.test('the error is listed in Problems with a count', async (p) => {
    await crash(p);
    p.assert.equal(await p.text('#tabProblems .badge'), '1');
    await p.click('#tabProblems');
    p.assert.match(await p.text('#problem0'), /doesn't like 0 as input/);
    p.assert.match(await p.text('#problem0'), /e2e\.lgo:2/);
    await p.click('#tabCommands');
  });
  t.test('double-clicking the problem goes to the line', async (p) => {
    await crash(p);
    await p.ev('LG.app.active.editor.setCursor(5, 0)');
    await p.click('#tabProblems');
    await p.dblclick('#problem0');
    await p.wait('LG.app.active.editor.cursor().line === 1');
    await p.click('#tabCommands');
  });
  t.test('Enter on a focused problem goes to the line', async (p) => {
    await crash(p);
    await p.ev('LG.app.active.editor.setCursor(5, 0)');
    await p.click('#tabProblems');
    await p.ev("document.getElementById('problem0').focus()");
    await p.key('Enter');
    await p.wait('LG.app.active.editor.cursor().line === 1');
    await p.click('#tabCommands');
  });
  t.test('the line of the error is marked in the code and the gutter', async (p) => {
    await crash(p);
    await waitMarked(p, 'errline', 1);
    p.assert.match((await gutterClasses(p))[1], /\berr\b/);
  });
  t.test('the status bar shows the error and the procedure', async (p) => {
    await crash(p);
    p.assert.match(await p.status(), /^Error: .*doesn't like 0.*\(in fact\)/);
  });
  t.test('the state pill shows the error', async (p) => {
    await crash(p);
    p.assert.match(await p.ev("document.querySelector('.state').textContent"), /error/i);
    p.assert.match(await p.text('#tbRun'), /Run/);
  });
  t.test('the Call Stack still shows the frames at the time of the error', async (p) => {
    await crash(p);
    const rows = await stackRows(p);
    p.assert.deepEqual(rows.map((r) => r.title), ['fact 0', 'fact 1', 'fact 2', 'fact 3', 'top level']);
    p.assert.equal(rows[0].where, 'e2e.lgo:2');
    p.assert.equal(rows[0].sel, true);
  });
  t.test('the Variables panel shows the inputs of the failing call', async (p) => {
    await crash(p);
    await p.click('#itab-vars');
    p.assert.equal((await varRow(p, 'n', 'frame')).value, '0');
    p.assert.equal((await varRow(p, 'g', 'g')).value, '9');
  });
  t.test('an older frame can be chosen after the error', async (p) => {
    await crash(p);
    await stackRows(p);
    await p.click('#frame2');
    await p.click('#itab-vars');
    p.assert.equal((await varRow(p, 'n', 'frame')).value, '2');
    await waitMarked(p, 'frame', 2);
  });
  t.test('a command typed after the error runs in the failing frame', async (p) => {
    await crash(p);
    await p.command('print :n + 100', { until: ['error'] });
    await p.waitOutput(/^100$/m);
    p.assert.equal(await p.state(), 'error');
  });
  t.test('a command typed after choosing a frame runs in that frame', async (p) => {
    await crash(p);
    await stackRows(p);
    await p.click('#frame1');
    await p.command('print :n * 11', { until: ['error'] });
    await p.waitOutput(/^33$/m);
    await p.click('#frame3');
    await p.command('print :n * 12', { until: ['error'] });
    await p.waitOutput(/^12$/m);
  });
  t.test('a command can call procedures after the error', async (p) => {
    await crash(p, 'to half :x\n  output :x / 2\nend\nto bad :n\n  print half :n\n  print :n / 0\nend\nbad 8\n');
    await p.command('print half :n + 2', { until: ['error'] });
    await p.waitOutput(/^5$/m);
    p.assert.equal(await p.state(), 'error');
    p.assert.equal((await stackRows(p))[0].title, 'bad 8', 'the frames are the same');
  });
  t.test('a command that fails after the error keeps the frames', async (p) => {
    await crash(p);
    await p.command('print :nosuch', { until: ['error'] });
    await p.waitOutput(/nosuch has no value/);
    p.assert.equal((await stackRows(p)).length, 5);
  });
  t.test('values can be changed after the error and commands see them', async (p) => {
    await crash(p);
    await p.click('#itab-vars');
    p.assert.equal((await varRow(p, 'n', 'frame')).editable, true);
    await editCell(p, cellSel('frame4/n'), '5');
    await p.command('print :n', { until: ['error'] });
    await p.waitOutput(/^5$/m);
  });
  t.test('the next Run clears the error, the marks and the frames', async (p) => {
    await crash(p);
    await load(p, BAD.replace('1 / :n', '1'));
    await f5(p);
    await p.waitState('idle');
    p.assert.equal(await markedLine(p, 'errline'), -1);
    p.assert.equal(await p.ev("document.querySelector('#tabProblems .badge').classList.contains('hidden')"), true);
    p.assert.equal((await stackRows(p)).length, 0);
    p.assert.match(await p.output(), /^6$/m);
  });
  t.test('running the same program again shows the error again', async (p) => {
    await crash(p);
    await f5(p);
    await p.waitState('error');
    p.assert.equal(await p.text('#tabProblems .badge'), '1');
    p.assert.equal((await stackRows(p)).length, 5);
  });
  t.test('Stop after an error clears the frames', async (p) => {
    await crash(p);
    await p.click('#tbStop');
    await p.waitState('idle');
    p.assert.equal((await stackRows(p)).length, 0);
  });
  t.test('typing in the editor clears the error mark', async (p) => {
    await crash(p);
    await waitMarked(p, 'errline', 1);
    await p.ev('LG.app.active.editor.setCursor(5, 0)');
    await p.type(' ');
    p.assert.equal(await markedLine(p, 'errline'), -1);
  });
  t.test('an error at the top level shows the top level frame only', async (p) => {
    await crash(p, 'print 1\nprint nosuchproc40\n');
    const rows = await stackRows(p);
    p.assert.deepEqual(rows.map((r) => r.title), ['top level']);
    p.assert.equal(rows[0].where, 'e2e.lgo:2');
    await waitMarked(p, 'errline', 1);
  });
  t.test('an error in another file marks the line there', async (p) => {
    await load(p, 'to oops40\n  print first []\nend\n', '/projects/oops40.lgo');
    await crash(p, 'load "/projects/oops40.lgo\noops40\n');
    await p.wait("LG.app.active.path === '/projects/oops40.lgo'");
    await waitMarked(p, 'errline', 1);
    p.assert.match((await p.output()), /oops40\.lgo, line 2/);
  });
  t.test('the error in a FOR loop keeps the loop variable', async (p) => {
    await crash(p, 'for [i 3 0 -1] [\n  print 6 / :i\n]\n');
    await p.click('#itab-vars');
    const r = await varRow(p, 'i', 'frame');
    p.assert.equal(r.value, '0');
    p.assert.equal(r.loop, true);
  });
  t.test('the History shows what ran up to the error', async (p) => {
    await crash(p);
    await p.inspector('hist');
    const first = await p.ev("document.querySelector('#ipane-hist .list-row').innerText");
    p.assert.match(first, /fact/);
    p.assert.match(first, /e2e\.lgo:2/);
  });
  t.test('watches show values from the failing frame', async (p) => {
    await crash(p);
    await p.click('#itab-watch');
    await p.click('#watchInput');
    await p.insertText(':n + :g');
    await p.key('Enter');
    p.assert.match(await p.text('#watch0'), /\b9\b/);
  });
  t.test('Step after an error starts the program again from the top', async (p) => {
    await crash(p);
    await p.key('F11');
    await p.waitState('paused');
    p.assert.equal(await p.ev('LG.Debug.frames(LG.app.interp).length'), 1);
    p.assert.equal(await markedLine(p, 'errline'), -1);
    await p.stopProgram();
  });
  t.test('a THROW "ERROR is reported like an error', async (p) => {
    await crash(p, 'to t40\n  (throw "error [custom trouble])\nend\nt40\n');
    p.assert.match(await p.output(), /custom trouble/);
    p.assert.deepEqual((await stackRows(p)).map((r) => r.title), ['t40', 'top level']);
  });
  t.test('the frame list lists every variable section for the chosen frame only', async (p) => {
    await crash(p);
    await p.click('#itab-vars');
    const frameRows = (await varRows(p)).filter((r) => r.key.startsWith('frame'));
    p.assert.deepEqual(frameRows.map((r) => r.name), ['n']);
  });
}
