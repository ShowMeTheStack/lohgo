// The Berkeley Logo debugging commands (TRACE, UNTRACE, STEP, UNSTEP, PAUSE, CONTINUE) and the
// guided tour of the debugger.
import { reset, load, gutterClick, untilPaused, f5, stackRows, pausedLine, seen, varRow, cellSel, editCell } from './40-dbg-lib.mjs';

const FACT = 'to fact :n\nif :n < 2 [output 1]\noutput :n * fact :n - 1\nend';

/** Run one command on a clean transcript and return what it printed (without the echoed command) */
async function printed(p, cmd) {
  await p.ev('LG.app.commander.clear()');
  await p.command(cmd);
  const out = await p.output();
  return out.slice(out.indexOf('\n') + 1).replace(/^\n/, '');
}

export default function (t) {
  t.beforeEach(reset);

  // ---- TRACE -----------------------------------------------------------------------------------------
  t.test('TRACE shows each call and its output, indented by depth', async (p) => {
    await p.command(FACT);
    await p.command('trace "fact');
    p.assert.equal(await printed(p, 'print fact 3'), '( fact 3 )\n ( fact 2 )\n  ( fact 1 )\n  fact outputs 1\n fact outputs 2\nfact outputs 6\n6\n');
  });
  t.test('UNTRACE stops the trace', async (p) => {
    await p.command(FACT);
    await p.command('trace "fact');
    await p.command('untrace "fact');
    p.assert.equal(await printed(p, 'print fact 4'), '24\n');
  });
  t.test('a traced command procedure says it stops', async (p) => {
    await p.command('to hi :x\nprint :x\nend');
    await p.command('trace "hi');
    p.assert.equal(await printed(p, 'hi 5'), '( hi 5 )\n5\nhi stops\n');
  });
  for (const [arg, shown] of [['"abc', '"abc'], ['[a [b] c]', '[a [b] c]'], ['{1 2}', '{1 2}'], ['-2.5', '-2.5'], ['"', '"'], ['[]', '[]']]) {
    t.test(`TRACE shows an input of ${arg} as ${shown}`, async (p) => {
      await p.command('to tr1 :x\nend');
      await p.command('trace "tr1');
      p.assert.equal(await printed(p, 'tr1 ' + arg), `( tr1 ${shown} )\ntr1 stops\n`);
    });
  }
  t.test('TRACE quotes a word that a procedure outputs', async (p) => {
    await p.command('to w1\noutput "hello\nend');
    await p.command('trace "w1');
    p.assert.equal(await printed(p, 'show w1'), '( w1 )\nw1 outputs "hello\nhello\n');
  });
  t.test('TRACE shows a list output with brackets', async (p) => {
    await p.command('to l1\noutput [x y]\nend');
    await p.command('trace "l1');
    p.assert.equal(await printed(p, 'show l1'), '( l1 )\nl1 outputs [x y]\n[x y]\n');
  });
  t.test('TRACE with several inputs lists them all', async (p) => {
    await p.command('to three :a :b :c\nend');
    await p.command('trace "three');
    p.assert.equal(await printed(p, 'three 1 "b [c]'), '( three 1 "b [c] )\nthree stops\n');
  });
  t.test('TRACE takes a list of procedures', async (p) => {
    await p.command('to ta\ntb\nend');
    await p.command('to tb\nend');
    await p.command('trace [ta tb]');
    p.assert.equal(await printed(p, 'ta'), '( ta )\n ( tb )\n tb stops\nta stops\n');
  });
  t.test('only traced procedures are shown', async (p) => {
    await p.command('to ta\ntb\nend');
    await p.command('to tb\nend');
    await p.command('trace "tb');
    p.assert.equal(await printed(p, 'ta'), ' ( tb )\n tb stops\n');
  });
  t.test('TRACE inside a program traces the rest of the run', async (p) => {
    await load(p, 'to sq :x\noutput :x * :x\nend\ntrace "sq\nprint sq 4\n');
    await f5(p);
    await p.waitState('idle');
    p.assert.match(await p.output(), /\( sq 4 \)\nsq outputs 16\n16/);
  });
  t.test('trace lines and printed lines come out in order', async (p) => {
    await p.command('to tpr :x\nprint :x * 10\nend');
    await p.command('trace "tpr');
    p.assert.equal(await printed(p, 'tpr 1 tpr 2'), '( tpr 1 )\n10\ntpr stops\n( tpr 2 )\n20\ntpr stops\n');
  });
  t.test('a STOP inside a traced procedure still says it stops', async (p) => {
    await p.command('to tst :x\nif :x > 0 [stop]\nprint "never\nend');
    await p.command('trace "tst');
    p.assert.equal(await printed(p, 'tst 1'), '( tst 1 )\ntst stops\n');
  });

  // ---- STEP --------------------------------------------------------------------------------------------
  t.test('STEP pauses at each instruction of the procedure', async (p) => {
    await load(p, 'to walk1\n  print 1\n  print 2\nend\nstep "walk1\nprint "before\nwalk1\nprint "after\n');
    await f5(p);
    const lines = [];
    for (;;) {
      await p.waitState(['paused', 'idle', 'error']);
      if ((await p.state()) !== 'paused') break;
      lines.push(await pausedLine(p));
      await p.key('F5');
    }
    p.assert.deepEqual(lines, [2, 3]);
    p.assert.match(await p.output(), /before\n1\n2\nafter/);
  });
  t.test('the status bar says it is stepping through the procedure', async (p) => {
    await load(p, 'to walk2\n  print 1\nend\nstep "walk2\nwalk2\n');
    await f5(p);
    await untilPaused(p);
    p.assert.match(await p.status(), /Stepping through walk2/);
    p.assert.deepEqual((await stackRows(p)).map((r) => r.title), ['walk2', 'top level']);
    await p.stopProgram();
  });
  t.test('UNSTEP stops the pausing', async (p) => {
    await load(p, 'to walk3\n  print 1\nend\nstep "walk3\nunstep "walk3\nwalk3\n');
    await f5(p);
    await p.waitState('idle');
    p.assert.match(await p.output(), /^1$/m);
  });
  t.test('STEP typed in the command center applies to later commands', async (p) => {
    await p.command('to walk4 :n\nprint :n\nend');
    await p.command('step "walk4');
    await p.command('walk4 3', { until: ['paused'] });
    p.assert.equal(await seen(p, 'n'), '3');
    await p.key('F5');
    await p.waitState('idle');
    await p.waitOutput(/^3$/m);
  });
  t.test('a stepped procedure pauses on each recursive call', async (p) => {
    await load(p, 'to down :n\n  if :n = 0 [stop]\n  down :n - 1\nend\nstep "down\ndown 2\n');
    await f5(p);
    const ns = [];
    for (;;) {
      await p.waitState(['paused', 'idle', 'error']);
      if ((await p.state()) !== 'paused') break;
      ns.push(await seen(p, 'n'));
      await p.key('F5');
    }
    p.assert.deepEqual(ns, ['2', '2', '1', '1', '0', '0']);
  });
  t.test('STEP and F11 work together', async (p) => {
    await load(p, 'to walk5\n  print 1\n  print 2\nend\nstep "walk5\nwalk5\n');
    await f5(p);
    await untilPaused(p);
    await p.key('F11');
    await untilPaused(p);
    p.assert.equal(await pausedLine(p), 3);
    await p.stopProgram();
  });

  // ---- PAUSE and CONTINUE ---------------------------------------------------------------------------------
  t.test('PAUSE in a procedure pauses the program there', async (p) => {
    await load(p, 'to hold :x\n  pause\n  print :x\nend\nhold 5\n');
    await f5(p);
    await untilPaused(p);
    p.assert.deepEqual((await stackRows(p)).map((r) => r.title), ['hold 5', 'top level']);
    p.assert.match(await p.status(), /Paused in hold/);
    await p.stopProgram();
  });
  t.test('CONTINUE typed in the command center goes on', async (p) => {
    await load(p, 'to hold :x\n  pause\n  print :x * 2\nend\nhold 5\nprint "end\n');
    await f5(p);
    await untilPaused(p);
    await p.command('continue', { until: ['idle'] });
    await p.waitOutput(/10\nend/);
  });
  t.test('CO is short for CONTINUE', async (p) => {
    await load(p, 'pause\nprint "goes\n');
    await f5(p);
    await untilPaused(p);
    await p.command('co', { until: ['idle'] });
    await p.waitOutput(/goes/);
  });
  t.test('commands typed while paused see the procedure variables', async (p) => {
    await load(p, 'to hold :x\n  localmake "y :x + 1\n  pause\nend\nhold 5\n');
    await f5(p);
    await untilPaused(p);
    await p.command('print :x + :y', { until: ['paused'] });
    await p.waitOutput(/^11$/m);
    await p.stopProgram();
  });
  t.test('MAKE typed while paused changes the variable the program uses', async (p) => {
    await load(p, 'to hold :x\n  pause\n  print :x\nend\nhold 5\n');
    await f5(p);
    await untilPaused(p);
    await p.command('make "x 42', { until: ['paused'] });
    await p.command('continue', { until: ['idle'] });
    await p.waitOutput(/^42$/m);
  });
  t.test('a command with an error while paused leaves the program paused', async (p) => {
    await load(p, 'pause\nprint "ok\n');
    await f5(p);
    await untilPaused(p);
    await p.command('print :nosuchthing', { until: ['paused'] });
    await p.waitOutput(/nosuchthing has no value/);
    p.assert.equal(await p.state(), 'paused');
    await p.key('F5');
    await p.waitState('idle');
    await p.waitOutput(/ok/);
  });
  t.test('F5 also continues after PAUSE', async (p) => {
    await load(p, 'pause\nprint "after\n');
    await f5(p);
    await untilPaused(p);
    await p.key('F5');
    await p.waitState('idle');
    await p.waitOutput(/after/);
  });
  t.test('PAUSE and CONTINUE inside one program run', async (p) => {
    await load(p, 'make "k 0\nrepeat 3 [make "k :k + 1 pause]\nprint :k\n');
    await f5(p);
    for (let i = 1; i <= 3; i++) {
      await untilPaused(p);
      p.assert.equal(await seen(p, 'k'), String(i));
      await p.command('continue', { until: ['paused', 'idle'] });
    }
    await p.waitState('idle');
    await p.waitOutput(/^3$/m);
  });

  // ---- the debugger tour ----------------------------------------------------------------------------------
  const tourStep = () => p0.ev("document.querySelector('.tour-pop .step').textContent");
  let p0 = null;
  const startTour = async (p, at) => {
    p0 = p;
    await p.ev(`LG.Tours.start(LG.app, 'debug'${at ? ', { at: ' + at + ' }' : ''})`);
    await p.wait("!!document.querySelector('.tour-pop h3')");
    await p.sleep(100);
  };
  const stopTour = (p) => p.ev('LG.Tours.stop()');

  t.test('the debugger tour starts from the Guided tours menu', async (p) => {
    await p.menu('Guided tours');
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.click('.menu-pop .menu-item', 'The debugger');
    await p.wait("!!document.querySelector('.tour-pop h3')");
    p0 = p;
    p.assert.equal(await tourStep(), 'The debugger · 1 of 7');
    p.assert.equal(await p.text('.tour-pop h3'), 'Watching a program think');
    p.assert.equal(await p.activePath(), '/projects/tour/countdown.lgo');
    p.assert.match(await p.code(), /to countdown :n/);
    await stopTour(p);
  });
  t.test('tour step 2 waits for a breakpoint and moves on by itself', async (p) => {
    await startTour(p);
    await p.click('#tourNext');
    p.assert.equal(await p.text('.tour-pop h3'), 'Set a breakpoint');
    p.assert.match(await p.text('.tour-pop .wait'), /Waiting for a breakpoint/);
    p.assert.match(await p.text('#tourNext'), /Skip/);
    await gutterClick(p, 2);
    await p.wait("document.querySelector('.tour-pop .wait') && /Done/.test(document.querySelector('.tour-pop .wait').innerText)", 3000);
    await p.wait("document.querySelector('.tour-pop h3').innerText === 'Run to the breakpoint'", 4000);
    await stopTour(p);
  });
  t.test('tour step 3 moves on when F5 stops at the breakpoint', async (p) => {
    await startTour(p);
    await p.click('#tourNext');
    await gutterClick(p, 2);
    await p.wait("document.querySelector('.tour-pop h3').innerText === 'Run to the breakpoint'", 4000);
    await f5(p);
    await untilPaused(p);
    p.assert.equal(await pausedLine(p), 3);
    await p.wait("document.querySelector('.tour-pop h3').innerText === 'Variables'", 4000);
    await stopTour(p);
  });
  t.test('tour step 4: changing :n in Variables changes the countdown', async (p) => {
    await startTour(p);
    await p.click('#tourNext');
    await gutterClick(p, 2);
    await p.wait("document.querySelector('.tour-pop h3').innerText === 'Run to the breakpoint'", 4000);
    await f5(p);
    await untilPaused(p);
    await p.wait("document.querySelector('.tour-pop h3').innerText === 'Variables'", 4000);
    await p.click('#itab-vars');
    p.assert.equal((await varRow(p, 'n', 'frame')).value, '5');
    await editCell(p, cellSel('frame1/n'), '2');
    await p.click('#tourNext');
    p.assert.equal(await p.text('.tour-pop h3'), 'Continue');
    await p.key('F5');
    await untilPaused(p);
    p.assert.equal(await seen(p, 'n'), '1');
    await p.wait("document.querySelector('.tour-pop h3').innerText === 'The call stack'", 4000);
    p.assert.match(await p.output(), /^2$/m);
    await stopTour(p);
  });
  t.test('tour step 6 points at the Call Stack tab', async (p) => {
    await startTour(p, 5);
    p.assert.equal(await p.text('.tour-pop h3'), 'The call stack');
    const spot = await p.rect('.tour-spot');
    const tab = await p.rect('#itab-stack');
    p.assert.ok(Math.abs(spot.x - (tab.x - 5)) < 2 && Math.abs(spot.w - (tab.w + 10)) < 2);
    await stopTour(p);
  });
  t.test('tour step 7 points at the step buttons and Finish closes the tour', async (p) => {
    await startTour(p, 6);
    p.assert.equal(await p.text('.tour-pop h3'), 'Step by step');
    p.assert.equal(await tourStep(), 'The debugger · 7 of 7');
    const spot = await p.rect('.tour-spot');
    const grp = await p.rect('#debugGroup');
    p.assert.ok(Math.abs(spot.y - (grp.y - 5)) < 2);
    p.assert.equal(await p.text('#tourNext'), 'Finish');
    await p.click('#tourNext');
    p.assert.equal(await p.exists('.tour-pop'), false);
    p.assert.equal(await p.exists('.tour-spot'), false);
  });
  t.test('Back returns to the previous tour step and is disabled on the first', async (p) => {
    await startTour(p);
    p.assert.equal(await p.ev("document.getElementById('tourBack').disabled"), true);
    await p.click('#tourNext');
    await p.click('#tourBack');
    p.assert.equal(await p.text('.tour-pop h3'), 'Watching a program think');
    await stopTour(p);
  });
  t.test('Close ends the tour', async (p) => {
    await startTour(p, 3);
    await p.click('#tourClose');
    p.assert.equal(await p.exists('.tour-pop'), false);
  });
  t.test('Skip moves past a step that is waiting', async (p) => {
    await startTour(p, 1);
    await p.click('#tourNext');
    p.assert.equal(await p.text('.tour-pop h3'), 'Run to the breakpoint');
    await stopTour(p);
  });
}
