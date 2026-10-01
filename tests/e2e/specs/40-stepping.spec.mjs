// Stepping: Step, Over, Out, Continue, Stop and Pause, and the marks they leave in the editor.
import { PATH, reset, load, gutterClick, gutterClasses, markedLine, waitMarked, pausedLine, untilPaused, f5, stepKey, seen, topTitle } from './40-dbg-lib.mjs';

// 1 to inner / 2 print "in1 / 3 print "in2 / 4 end / 5 to outer / 6 inner / 7 print "after / 8 end / 9 outer / 10 print "top
const NEST = 'to inner\n  print "in1\n  print "in2\nend\nto outer\n  inner\n  print "after\nend\nouter\nprint "top\n';
// 1 to f :n / 2 if :n = 0 [stop] / 3 print :n / 4 f :n - 1 / 5 end / 6 f 2 / 7 print "end
const REC = 'to f :n\n  if :n = 0 [stop]\n  print :n\n  f :n - 1\nend\nf 2\nprint "end\n';

async function frameTitles(p) { return p.ev('LG.Debug.frames(LG.app.interp).map(f => f.title).reverse()'); }

export default function (t) {
  t.beforeEach(reset);

  // ---- starting with a step ------------------------------------------------------------------------
  for (const [how, go] of [
    ['F11', (p) => p.key('F11')],
    ['F8', (p) => p.key('F8')],
    ['the Step button', (p) => p.click('#tbInto')],
    ['Step into in the menu', (p) => p.menu('Step into')],
  ]) {
    t.test(`${how} on an idle program stops at its first instruction`, async (p) => {
      await load(p, NEST);
      await go(p);
      p.assert.equal(await untilPaused(p), 9);
      p.assert.deepEqual(await frameTitles(p), ['top level']);
      await waitMarked(p, 'exec', 8);
      p.assert.equal(await p.output().then((o) => /in1/.test(o)), false, 'nothing ran yet');
    });
  }
  t.test('F10 on an idle program also starts it stepping', async (p) => {
    await load(p, NEST);
    await p.key('F10');
    p.assert.equal(await untilPaused(p), 9);
  });
  t.test('a program that starts with an instruction stops on line 1', async (p) => {
    await load(p, 'print 1\nprint 2\n');
    await p.key('F11');
    p.assert.equal(await untilPaused(p), 1);
  });
  t.test('blank lines and comments before the first instruction are skipped', async (p) => {
    await load(p, '; a comment\n\n\nprint 1\n');
    await p.key('F11');
    p.assert.equal(await untilPaused(p), 4);
  });
  t.test('stepping starts a fresh run with a "Running" note', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    p.assert.match(await p.output(), /Running e2e\.lgo/);
  });
  t.test('the status bar says the program is paused and how to go on', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    p.assert.match(await p.status(), /Paused.*F5 continues/);
  });
  t.test('the state pill reads Paused', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    p.assert.match(await p.ev("document.querySelector('.state') ? document.querySelector('.state').innerText : ''"), /paused/i);
  });

  // ---- Step into -------------------------------------------------------------------------------------
  t.test('F11 walks into procedures one instruction at a time', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    const seq = [];
    for (let i = 0; i < 6; i++) seq.push(await stepKey(p, 'F11'));
    p.assert.deepEqual(seq, [6, 2, 3, 7, 10, null]);
    await p.waitOutput(/in1\nin2\nafter\ntop/);
  });
  t.test('F8 steps exactly like F11', async (p) => {
    await load(p, NEST);
    await p.key('F8');
    await untilPaused(p);
    const seq = [];
    for (let i = 0; i < 3; i++) seq.push(await stepKey(p, 'F8'));
    p.assert.deepEqual(seq, [6, 2, 3]);
  });
  t.test('the Step button steps one instruction', async (p) => {
    await load(p, NEST);
    await p.click('#tbInto');
    await untilPaused(p);
    await p.click('#tbInto');
    p.assert.equal(await untilPaused(p), 6);
    await p.click('#tbInto');
    p.assert.equal(await untilPaused(p), 2);
  });
  t.test('stepping into a call adds a frame to the stack', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    await stepKey(p, 'F11');
    p.assert.deepEqual(await frameTitles(p), ['outer', 'top level']);
    await stepKey(p, 'F11');
    p.assert.deepEqual(await frameTitles(p), ['inner', 'outer', 'top level']);
  });
  t.test('F11 stops at each instruction on a line', async (p) => {
    await load(p, 'print 1 print 2 print 3\nprint 4\n');
    await p.key('F11');
    await untilPaused(p);
    p.assert.equal(await stepKey(p, 'F11'), 1);
    p.assert.match(await p.output(), /^1$/m);
    p.assert.equal(await stepKey(p, 'F11'), 1);
    p.assert.equal(await stepKey(p, 'F11'), 2);
    p.assert.match(await p.output(), /1\n2\n3/);
  });
  t.test('stepping into a recursive procedure goes one level deeper each call', async (p) => {
    await load(p, REC);
    await p.key('F11');
    await untilPaused(p);
    const depths = [];
    for (let i = 0; i < 10 && (await p.state()) === 'paused'; i++) {
      await stepKey(p, 'F11');
      if ((await p.state()) === 'paused') depths.push((await frameTitles(p))[0]);
    }
    p.assert.deepEqual(depths.slice(0, 9), ['f 2', 'f 2', 'f 2', 'f 1', 'f 1', 'f 1', 'f 0', 'f 0', 'top level']);
  });
  t.test('each step shows the input of the newest call', async (p) => {
    await load(p, REC);
    await p.key('F11');
    await untilPaused(p);
    await stepKey(p, 'F11');
    p.assert.equal(await seen(p, 'n'), '2');
    for (let i = 0; i < 3; i++) await stepKey(p, 'F11');
    p.assert.equal(await seen(p, 'n'), '1');
  });
  t.test('stepping into a FOR loop stops on every pass of its body', async (p) => {
    await load(p, 'for [i 1 3] [\n  print :i\n]\nprint "done\n');
    await p.key('F11');
    await untilPaused(p);
    const vals = [];
    for (let i = 0; i < 3; i++) { await stepKey(p, 'F11'); vals.push(await seen(p, 'i')); }
    p.assert.deepEqual(vals, ['1', '2', '3']);
  });
  t.test('stepping into a procedure from another file opens that file', async (p) => {
    await load(p, 'to other40\n  print "o\nend\n', '/projects/other40.lgo');
    await load(p, 'load "/projects/other40.lgo\nother40\n');
    await p.key('F11');
    await untilPaused(p);
    await stepKey(p, 'F11');
    await stepKey(p, 'F11');
    await p.wait("LG.app.active.path === '/projects/other40.lgo'");
    await waitMarked(p, 'exec', 1);
  });

  // ---- the exec marks --------------------------------------------------------------------------------
  t.test('the exec highlight follows each step', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    for (const want of [6, 2, 3, 7]) {
      p.assert.equal(await stepKey(p, 'F11'), want);
      await waitMarked(p, 'exec', want - 1);
    }
  });
  t.test('the gutter arrow sits on the exec line only', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    await stepKey(p, 'F11');
    await p.sleep(60);
    const g = await gutterClasses(p);
    p.assert.deepEqual(g.map((c, i) => (/\bexec\b/.test(c) ? i : -1)).filter((i) => i >= 0), [5]);
    const arrow = await p.ev("getComputedStyle(LG.app.active.editor.inner.querySelectorAll('.ed-gl')[5], '::after').content");
    p.assert.match(arrow, /▶/);
    const none = await p.ev("getComputedStyle(LG.app.active.editor.inner.querySelectorAll('.ed-gl')[4], '::after').content");
    p.assert.ok(!/▶/.test(none));
  });
  t.test('the exec line is scrolled into view in a long program', async (p) => {
    const lines = []; for (let i = 0; i < 150; i++) lines.push('make "v' + i + ' ' + i);
    lines.push('print "last');
    await load(p, lines.join('\n'));
    await gutterClick(p, 150);
    await p.ev('LG.app.active.editor.ta.scrollTop = 0');
    await f5(p);
    await untilPaused(p);
    await waitMarked(p, 'exec', 150);
    const vis = await p.ev("(() => { const e = LG.app.active.editor; const el = e.hl.querySelectorAll('.ed-line')[150]; const r = el.getBoundingClientRect(); const m = e.ta.getBoundingClientRect(); return r.top >= m.top - 1 && r.bottom <= m.bottom + 1; })()");
    p.assert.ok(vis);
  });
  t.test('finishing the program clears the exec highlight', async (p) => {
    await load(p, 'print 1\n');
    await p.key('F11');
    await untilPaused(p);
    await stepKey(p, 'F11');
    p.assert.equal(await p.state(), 'idle');
    p.assert.equal(await markedLine(p, 'exec'), -1);
  });
  t.test('typing in the editor while paused keeps the exec mark', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    await p.ev('LG.app.active.editor.setCursor(9, 0)');
    p.assert.equal(await markedLine(p, 'exec'), 8);
  });

  // ---- Step over ---------------------------------------------------------------------------------------
  t.test('F10 steps over a call at the top level', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    p.assert.equal(await stepKey(p, 'F10'), 10);
    p.assert.match(await p.output(), /in1\nin2\nafter/);
    p.assert.deepEqual(await frameTitles(p), ['top level']);
  });
  t.test('F10 inside a procedure steps over a call it makes', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    await stepKey(p, 'F11');
    p.assert.equal(await stepKey(p, 'F10'), 7);
    p.assert.deepEqual(await frameTitles(p), ['outer', 'top level']);
    p.assert.match(await p.output(), /in1\nin2/);
  });
  t.test('the Over button steps over', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    await p.click('#tbOver');
    p.assert.equal(await untilPaused(p), 10);
  });
  t.test('Step over in the menu steps over', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    await p.menu('Step over');
    p.assert.equal(await untilPaused(p), 10);
  });
  t.test('F10 runs the whole line, even with several instructions on it', async (p) => {
    await load(p, 'print 1 print 2 print 3\nprint 4\n');
    await p.key('F11');
    await untilPaused(p);
    p.assert.equal(await stepKey(p, 'F10'), 2);
    p.assert.match(await p.output(), /1\n2\n3/);
  });
  t.test('F10 over a line that calls a procedure twice runs both calls', async (p) => {
    await load(p, NEST.replace('outer\nprint "top', 'outer outer\nprint "top'));
    await p.key('F11');
    await untilPaused(p);
    p.assert.equal(await stepKey(p, 'F10'), 10);
    p.assert.equal((await p.output()).match(/after/g).length, 2);
  });
  t.test('F10 at the last line of a procedure returns to the caller', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    await stepKey(p, 'F11');
    await stepKey(p, 'F11');
    await stepKey(p, 'F10');
    p.assert.equal(await stepKey(p, 'F10'), 7);
    p.assert.deepEqual(await frameTitles(p), ['outer', 'top level']);
  });
  t.test('F10 over a call stops at a breakpoint inside it', async (p) => {
    await load(p, NEST);
    await gutterClick(p, 2);
    await p.key('F11');
    await untilPaused(p);
    p.assert.equal(await stepKey(p, 'F10'), 3);
    p.assert.deepEqual(await frameTitles(p), ['inner', 'outer', 'top level']);
    p.assert.match(await p.status(), /breakpoint/i);
  });
  t.test('F10 over a recursive call that hits a breakpoint stops in the deeper call', async (p) => {
    await load(p, REC);
    await p.key('F11');
    await untilPaused(p);
    await stepKey(p, 'F11');
    await stepKey(p, 'F10');
    await stepKey(p, 'F10');
    p.assert.equal(await pausedLine(p), 4);
    await gutterClick(p, 2);
    p.assert.equal(await stepKey(p, 'F10'), 3);
    p.assert.equal((await frameTitles(p))[0], 'f 1');
  });
  t.test('F10 on a one-line loop stops on each pass', async (p) => {
    await load(p, 'repeat 3 [print "x]\nprint "y\n');
    await p.key('F11');
    await untilPaused(p);
    const seq = [];
    for (let i = 0; i < 4; i++) seq.push(await stepKey(p, 'F10'));
    p.assert.deepEqual(seq, [1, 1, 2, null]);
  });

  // ---- Step out ------------------------------------------------------------------------------------------
  t.test('Shift+F11 finishes the procedure and stops in the caller', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    await stepKey(p, 'F11');
    await stepKey(p, 'F11');
    p.assert.equal(await stepKey(p, 'F11', { shift: true }), 7);
    p.assert.match(await p.output(), /in1\nin2/);
    p.assert.deepEqual(await frameTitles(p), ['outer', 'top level']);
  });
  t.test('stepping out twice returns to the top level', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    await stepKey(p, 'F11');
    await stepKey(p, 'F11');
    await stepKey(p, 'F11', { shift: true });
    p.assert.equal(await stepKey(p, 'F11', { shift: true }), 10);
    p.assert.deepEqual(await frameTitles(p), ['top level']);
  });
  t.test('Shift+F8 also steps out', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    await stepKey(p, 'F11');
    await stepKey(p, 'F11');
    p.assert.equal(await stepKey(p, 'F8', { shift: true }), 7);
  });
  t.test('the Out button steps out', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    await stepKey(p, 'F11');
    await stepKey(p, 'F11');
    await p.click('#tbOut');
    p.assert.equal(await untilPaused(p), 7);
  });
  t.test('stepping out at the top level runs to the end', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    p.assert.equal(await stepKey(p, 'F11', { shift: true }), null);
    await p.waitOutput(/top/);
  });
  t.test('stepping out stops at a breakpoint on the way', async (p) => {
    await load(p, NEST);
    await gutterClick(p, 2);
    await p.key('F11');
    await untilPaused(p);
    await stepKey(p, 'F11');
    await stepKey(p, 'F11');
    await gutterClick(p, 2);
    await gutterClick(p, 6);
    p.assert.equal(await stepKey(p, 'F11', { shift: true }), 7);
    p.assert.match(await p.status(), /breakpoint|Paused/);
  });
  t.test('stepping out of a recursive call stops in its caller', async (p) => {
    await load(p, 'to d :n\n  if :n = 0 [stop]\n  d :n - 1\n  print :n\nend\nd 3\n');
    await gutterClick(p, 1);
    await p.ev(`LG.app.breakpoints.get('${PATH}').get(1).cond = ':n = 1'; LG.app.breakpointsChanged('${PATH}')`);
    await f5(p);
    await untilPaused(p);
    p.assert.equal((await frameTitles(p))[0], 'd 1');
    await p.click('#itab-bps');
    await p.click('#bpClearAll');
    p.assert.equal(await stepKey(p, 'F11', { shift: true }), 4);
    p.assert.equal((await frameTitles(p))[0], 'd 2');
    p.assert.equal(await seen(p, 'n'), '2');
  });
  t.test('the Out button is disabled when nothing is paused', async (p) => {
    await load(p, NEST);
    p.assert.equal(await p.ev("document.getElementById('tbOut').disabled"), true);
    p.assert.equal(await p.ev("document.getElementById('tbInto').disabled"), false);
    p.assert.equal(await p.ev("document.getElementById('tbOver').disabled"), false);
  });
  t.test('Shift+F11 when idle does nothing', async (p) => {
    await load(p, NEST);
    await p.key('F11', { shift: true });
    await p.sleep(100);
    p.assert.equal(await p.state(), 'idle');
  });

  // ---- Continue ---------------------------------------------------------------------------------------------
  t.test('F5 continues a stepped program to the end', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    await stepKey(p, 'F11');
    await p.key('F5');
    await p.waitState('idle');
    await p.waitOutput(/top/);
    p.assert.match(await p.status(), /Finished/);
  });
  t.test('the Run button reads Continue while paused and continues', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    p.assert.match(await p.text('#tbRun'), /Continue/);
    p.assert.match(await p.attr('#tbRun', 'title'), /Continue/);
    await p.click('#tbRun');
    await p.waitState('idle');
    p.assert.match(await p.text('#tbRun'), /Run/);
  });
  t.test('the menu offers Continue while paused', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    await p.click('#menuBtn');
    await p.wait("!!document.querySelector('.menu-pop')");
    const items = await p.menuItems();
    p.assert.ok(items.some((i) => i.label === 'Continue' && !i.disabled));
    p.assert.ok(items.some((i) => i.label === 'Step out' && !i.disabled));
    await p.click('.menu-pop .menu-item', 'Continue');
    await p.waitState('idle');
  });
  t.test('continuing stops again at the next breakpoint', async (p) => {
    await load(p, NEST);
    await gutterClick(p, 6);
    await p.key('F11');
    await untilPaused(p);
    await p.key('F5');
    p.assert.equal(await untilPaused(p), 7);
  });
  t.test('continuing clears the exec highlight while running', async (p) => {
    await load(p, 'print 1\nwait 30\nprint 2\n');
    await p.key('F11');
    await untilPaused(p);
    await p.key('F5');
    await p.sleep(80);
    p.assert.equal(await markedLine(p, 'exec'), -1);
    await p.waitState('idle');
  });

  // ---- Stop -------------------------------------------------------------------------------------------------
  t.test('Shift+F5 stops a paused program', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    await stepKey(p, 'F11');
    await p.key('F5', { shift: true });
    await p.waitState('idle');
    await p.waitOutput(/Stopped\./);
    p.assert.equal(await markedLine(p, 'exec'), -1);
    p.assert.ok(!/in1/.test(await p.output()));
  });
  t.test('the Stop button stops a paused program', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    await p.click('#tbStop');
    await p.waitState('idle');
    p.assert.match(await p.text('#tbRun'), /Run/);
    await p.inspector('stack');
    p.assert.match(await p.paneText('stack'), /Nothing is running/);
  });
  t.test('Stop in the menu stops a paused program', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    await p.menu('Stop');
    await p.waitState('idle');
  });
  t.test('after stopping, F11 starts stepping from the beginning again', async (p) => {
    await load(p, NEST);
    await p.key('F11');
    await untilPaused(p);
    await stepKey(p, 'F11');
    await stepKey(p, 'F11');
    await p.key('F5', { shift: true });
    await p.waitState('idle');
    await p.key('F11');
    p.assert.equal(await untilPaused(p), 9);
  });

  // ---- Pause --------------------------------------------------------------------------------------------------
  const LOOP = 'make "i 0\nto spin\n  forever [make "i :i + 1]\nend\nspin\n';
  for (const [how, go] of [
    ['the Pause button', (p) => p.click('#tbPause')],
    ['the Pause key', (p) => p.key('Pause')],
    ['Pause in the menu', (p) => p.menu('Pause')],
  ]) {
    t.test(`${how} pauses a running program where it is`, async (p) => {
      await load(p, LOOP);
      await f5(p);
      await p.sleep(150);
      p.assert.equal(await p.state(), 'running');
      await go(p);
      p.assert.equal(await untilPaused(p), 3);
      p.assert.equal(await topTitle(p), 'spin');
      await waitMarked(p, 'exec', 2);
      p.assert.match(await p.status(), /Paused in spin/);
      await p.stopProgram();
    });
  }
  t.test('a paused loop keeps its value while paused and goes on after Continue', async (p) => {
    await load(p, LOOP);
    await f5(p);
    await p.sleep(100);
    await p.click('#tbPause');
    await untilPaused(p);
    const a = +(await seen(p, 'i'));
    await p.sleep(200);
    p.assert.equal(+(await seen(p, 'i')), a);
    await p.key('F5');
    await p.sleep(150);
    await p.click('#tbPause');
    await untilPaused(p);
    p.assert.ok(+(await seen(p, 'i')) > a);
    await p.stopProgram();
  });
  t.test('Pause during a WAIT pauses straight away', async (p) => {
    await load(p, 'print "a\nwait 600\nprint "b\n');
    await f5(p);
    await p.waitState('waiting');
    const t0 = Date.now();
    await p.click('#tbPause');
    await untilPaused(p);
    p.assert.ok(Date.now() - t0 < 2000);
    await p.stopProgram();
  });
  t.test('the Pause button is disabled unless something runs', async (p) => {
    await load(p, NEST);
    p.assert.equal(await p.ev("document.getElementById('tbPause').disabled"), true);
    await load(p, LOOP);
    await f5(p);
    await p.sleep(80);
    p.assert.equal(await p.ev("document.getElementById('tbPause').disabled"), false);
    p.assert.equal(await p.ev("document.getElementById('tbInto').disabled"), true);
    await p.click('#tbStop');
    await p.waitState('idle');
  });
  t.test('after a Pause, F11 steps on from where it stopped', async (p) => {
    await load(p, LOOP);
    await f5(p);
    await p.sleep(80);
    await p.click('#tbPause');
    await untilPaused(p);
    const a = +(await seen(p, 'i'));
    await stepKey(p, 'F11');
    await stepKey(p, 'F11');
    p.assert.equal(await pausedLine(p), 3);
    p.assert.ok(+(await seen(p, 'i')) >= a);
    await p.stopProgram();
  });
  t.test('F5 while running does not start a second run', async (p) => {
    await load(p, LOOP);
    await f5(p);
    await p.sleep(80);
    const runs = await p.ev('LG.app.runCount');
    await p.key('F5');
    p.assert.equal(await p.ev('LG.app.runCount'), runs);
    await p.stopProgram();
  });

  // ---- errors and stepping ----------------------------------------------------------------------------------------
  t.test('F11 after an error starts a fresh stepped run', async (p) => {
    await load(p, 'print 1\nprint nosuch\n');
    await f5(p);
    await p.waitState('error');
    await p.key('F11');
    p.assert.equal(await untilPaused(p), 1);
  });
  t.test('stepping into an error shows the error and keeps the frames', async (p) => {
    await load(p, 'to bad\n  print 1 / 0\nend\nbad\n');
    await p.key('F11');
    await untilPaused(p);
    await stepKey(p, 'F11');
    await stepKey(p, 'F11');
    await p.waitState('error');
    p.assert.deepEqual(await frameTitles(p), ['bad', 'top level']);
  });
}
