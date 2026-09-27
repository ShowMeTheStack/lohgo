// Running programs: the Run, Pause and Stop buttons and keys, the state pill, fresh starts,
// the status line, runaway programs, errors, BYE, THROW "TOPLEVEL and LOAD.
import { resetWorld, totalInk, inkNear, show } from './30-world-lib.mjs';

const pill = (p) => p.ev("document.getElementById('state').textContent");
const disabled = (p, id) => p.ev(`document.getElementById(${JSON.stringify(id)}).disabled`);
const runLabel = (p) => p.text('#tbRun .lbl');
const errLine = (p) => p.ev("(LG.app.active.editor.inner.querySelector('.ed-gl.err') || {}).innerText || ''");
const LOOP = 'forever [fd 1 rt 1]\n';

export default function (t) {
  t.beforeEach(async (p) => {
    if (await p.state() !== 'idle') await p.stopProgram();
    await resetWorld(p);
    await p.ev('LG.app.settings.freshRun = true');
  });

  // ---- buttons and the state pill ------------------------------------------------------------
  t.test('at rest the pill says Ready and only Run is enabled', async (p) => {
    p.assert.equal(await pill(p), 'Ready');
    p.assert.equal(await runLabel(p), 'Run');
    p.assert.equal(await disabled(p, 'tbRun'), false);
    p.assert.equal(await disabled(p, 'tbPause'), true);
    p.assert.equal(await disabled(p, 'tbStop'), true);
  });
  t.test('the Run button runs the program in the editor', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'print "clicked\nfd 50\n');
    await p.click('#tbRun');
    await p.waitOutput(/^clicked$/m);
    await p.waitState('idle');
    p.assert.ok((await inkNear(p, 0, 25))[3] > 150);
  });
  t.test('F5 runs the program', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'print "keyed\n');
    await p.key('F5');
    await p.waitOutput(/^keyed$/m);
  });
  t.test('F5 works while typing in the editor', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'print "from-editor\n');
    await p.click('#editors .ed-ta');
    await p.key('F5');
    await p.waitOutput(/^from-editor$/m);
  });
  t.test('a run says which file it runs', async (p) => {
    await p.runProgram('print 1\n', { path: '/projects/e2e-named.lgo' });
    await p.waitOutput(/▶ Running e2e-named\.lgo/);
  });
  t.test('while running the pill says Running and Pause and Stop are enabled', async (p) => {
    await p.runProgram(LOOP, { wait: false });
    await p.waitState('running');
    await p.wait("document.getElementById('state').textContent === 'Running'");
    p.assert.match(await p.attr('#state', 'class'), /running/);
    p.assert.equal(await disabled(p, 'tbRun'), true);
    p.assert.equal(await disabled(p, 'tbPause'), false);
    p.assert.equal(await disabled(p, 'tbStop'), false);
    await p.click('#tbStop');
    await p.waitState('idle');
  });
  t.test('the Stop button stops a running program', async (p) => {
    await p.runProgram(LOOP, { wait: false });
    await p.waitState('running');
    await p.click('#tbStop');
    await p.waitState('idle');
    await p.waitOutput(/Stopped\./);
    p.assert.equal(await pill(p), 'Ready');
    p.assert.equal(await disabled(p, 'tbStop'), true);
  });
  t.test('Shift+F5 stops a running program', async (p) => {
    await p.runProgram(LOOP, { wait: false });
    await p.waitState('running');
    await p.key('F5', { shift: true });
    await p.waitState('idle');
  });
  t.test('a stopped program leaves the turtle where it was', async (p) => {
    await p.runProgram('forever [fd 1 wait 1]\n', { wait: false });
    await p.sleep(200);
    await p.click('#tbStop');
    const y = (await p.turtle()).y;
    await p.sleep(200);
    p.assert.ok(y > 0);
    p.assert.equal((await p.turtle()).y, y, 'nothing moves after Stop');
  });
  t.test('the Pause button pauses and Run becomes Continue', async (p) => {
    await p.runProgram(LOOP, { wait: false });
    await p.waitState('running');
    await p.click('#tbPause');
    await p.waitState('paused');
    p.assert.equal(await pill(p), 'Paused');
    p.assert.match(await p.attr('#state', 'class'), /paused/);
    p.assert.equal(await runLabel(p), 'Continue');
    p.assert.equal(await disabled(p, 'tbRun'), false);
    p.assert.equal(await disabled(p, 'tbPause'), true);
    p.assert.equal(await disabled(p, 'tbStop'), false);
    p.assert.equal(await disabled(p, 'tbOut'), false);
    await p.click('#tbStop');
    await p.waitState('idle');
    p.assert.equal(await runLabel(p), 'Run');
  });
  t.test('Continue carries on from where it paused', async (p) => {
    await p.runProgram('make "n 0\nforever [make "n :n + 1]\n', { wait: false });
    await p.waitState('running');
    await p.click('#tbPause');
    await p.waitState('paused');
    const n1 = await p.ev("LG.app.interp.globals.get('n')");
    await p.click('#tbRun');
    await p.waitState('running');
    await p.sleep(100);
    await p.click('#tbPause');
    await p.waitState('paused');
    const n2 = await p.ev("LG.app.interp.globals.get('n')");
    p.assert.ok(n2 > n1, `${n1} then ${n2}`);
    await p.stopProgram();
  });
  t.test('F5 continues a paused program', async (p) => {
    await p.runProgram(LOOP, { wait: false });
    await p.waitState('running');
    await p.click('#tbPause');
    await p.waitState('paused');
    await p.key('F5');
    await p.waitState('running');
    await p.stopProgram();
  });
  t.test('the Pause key pauses', async (p) => {
    await p.runProgram(LOOP, { wait: false });
    await p.waitState('running');
    await p.key('Pause');
    await p.waitState('paused');
    await p.stopProgram();
  });
  t.test('Pause works while the program is in a WAIT', async (p) => {
    await p.runProgram('wait 600\nprint "late\n', { wait: false });
    await p.waitState('waiting');
    await p.click('#tbPause');
    await p.waitState('paused', 1500);
    await p.stopProgram();
    p.assert.doesNotMatch(await p.output(), /^late$/m);
  });
  t.test('a paused program shows where it is and says so in the status line', async (p) => {
    await p.runProgram('make "n 0\nforever [make "n :n + 1]\n', { wait: false });
    await p.waitState('running');
    await p.click('#tbPause');
    await p.waitState('paused');
    p.assert.match(await p.status(), /^Paused/);
    p.assert.ok(await p.exists('#editors .ed-gl.exec'));
    await p.stopProgram();
    p.assert.equal(await p.exists('#editors .ed-gl.exec'), false);
  });
  t.test('the menu offers Run, Pause and Stop by state', async (p) => {
    await p.click('#menuBtn');
    let items = await p.menuItems();
    const get = (l) => items.find((i) => i.label === l);
    p.assert.equal(get('Run').disabled, false);
    p.assert.equal(get('Pause').disabled, true);
    p.assert.equal(get('Stop').disabled, true);
    await p.closeMenus();
    await p.runProgram(LOOP, { wait: false });
    await p.waitState('running');
    await p.click('#menuBtn');
    items = await p.menuItems();
    p.assert.equal(get('Run').disabled, true);
    p.assert.equal(get('Pause').disabled, false);
    p.assert.equal(get('Stop').disabled, false);
    await p.click('.menu-pop .menu-item', 'Pause');
    await p.waitState('paused');
    await p.click('#menuBtn');
    items = await p.menuItems();
    p.assert.ok(get('Continue'), 'Run is now Continue');
    p.assert.equal(get('Continue').sc, 'F5');
    await p.click('.menu-pop .menu-item', 'Stop');
    await p.waitState('idle');
  });
  t.test('Stop when nothing runs does nothing', async (p) => {
    const before = await p.output();
    await p.key('F5', { shift: true });
    p.assert.equal(await p.state(), 'idle');
    p.assert.equal((await p.output()).length, before.length);
  });
  t.test('a command typed while a program runs is turned away', async (p) => {
    await p.runProgram(LOOP, { wait: false });
    await p.waitState('running');
    await p.command('print "sneaky', { wait: false });
    await p.waitOutput(/still running/);
    p.assert.doesNotMatch(await p.output(), /^sneaky$/m);
    await p.stopProgram();
  });
  t.test('a command in the command center shows Running while it waits', async (p) => {
    await p.command('wait 30', { wait: false });
    await p.wait("document.getElementById('state').textContent === 'Running'", 2000);
    await p.waitState('idle', 3000);
    p.assert.equal(await pill(p), 'Ready');
  });
  t.test('a program waiting for a line says Waiting', async (p) => {
    await p.runProgram('print readword\n', { wait: false });
    await p.waitState('input');
    p.assert.equal(await pill(p), 'Waiting');
    await p.click('#cmdInput');
    await p.type('hello\n');
    await p.waitOutput(/^hello$/m);
    await p.waitState('idle');
  });
  t.test('running saves the file first', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'print 1\n');
    await p.setCode('print "saved-by-run\n');
    await p.key('F5');
    await p.waitOutput(/saved-by-run/);
    p.assert.equal(await p.ev("LG.app.vfs.readText('/projects/e2e.lgo')"), 'print "saved-by-run\n');
    p.assert.equal(await p.ev('LG.app.active.dirty'), false);
  });
  t.test('F5 with no program open asks for one', async (p) => {
    await p.fresh();
    await p.ev("LG.app.active.dirty = false");
    await p.click('#editorTabs .etab .x');
    await p.wait('LG.app.docs.length === 0');
    await p.key('F5');
    await p.waitToast(/open or create a program first/i);
    p.assert.equal(await p.state(), 'idle');
  }, { timeout: 40000 });
  t.test('the window title shows the program name', async (p) => {
    await p.newFile('/projects/e2e-title.lgo', 'print 1\n');
    p.assert.equal(await p.ev('document.title'), 'e2e-title.lgo · Lohgo');
    p.assert.equal(await p.text('#proj'), '/projects/e2e-title.lgo');
  });

  // ---- fresh start -------------------------------------------------------------------------------
  t.test('a run forgets procedures from the last run', async (p) => {
    await p.runProgram('to e2efoo\nprint 1\nend\n');
    p.assert.equal(await show(p, 'procedurep "e2efoo'), 'true');
    await p.runProgram('print procedurep "e2efoo\n');
    await p.waitOutput(/^false$/m);
  });
  t.test('a run forgets variables from the last run', async (p) => {
    await p.runProgram('make "e2evar 5\n');
    await p.runProgram('print namep "e2evar\n');
    await p.waitOutput(/^false$/m);
  });
  t.test('a run forgets procedures typed at the prompt', async (p) => {
    await p.command('to e2etyped\nprint 2\nend');
    await p.runProgram('print definedp "e2etyped\n');
    await p.waitOutput(/^false$/m);
  });
  t.test('a run clears the drawing and sends the turtle home', async (p) => {
    await p.command('fd 100 rt 90 setpc 4');
    await p.runProgram('print "x\n');
    p.assert.equal(await totalInk(p), 0);
    const tt = await p.turtle();
    p.assert.deepEqual([tt.x, tt.y, tt.heading, tt.color], [0, 0, 0, '0,0,0']);
  });
  t.test('a run resets the turtle mode and background', async (p) => {
    await p.command('wrap setbg 4');
    await p.runProgram('print turtlemode print background\n');
    await p.waitOutput(/^WINDOW\n7$/m);
  });
  t.test('a run keeps buried procedures', async (p) => {
    await p.command('to e2ekeep\nprint 3\nend');
    await p.command('bury "e2ekeep');
    await p.runProgram('e2ekeep\n');
    await p.waitOutput(/^3$/m);
    await p.command('erase "e2ekeep');
  });
  t.test('with fresh start off a run keeps procedures, variables and the drawing', async (p) => {
    await p.menu('Fresh start on every run');
    p.assert.equal(await p.ev('LG.app.settings.freshRun'), false);
    await p.command('to e2eold\nprint "old\nend');
    await p.command('make "e2ev 9 fd 80');
    await p.runProgram('e2eold\nprint :e2ev\nrt 90 fd 10\n');
    await p.waitOutput(/^old\n9$/m);
    p.assert.ok((await inkNear(p, 0, 40))[3] > 150, 'the old drawing is kept');
    const tt = await p.turtle();
    p.assert.deepEqual([tt.x, tt.y], [10, 80]);
    await p.menu('Fresh start on every run');
    p.assert.equal(await p.ev('LG.app.settings.freshRun'), true);
  });
  t.test('the menu shows a tick for fresh start', async (p) => {
    await p.click('#menuBtn');
    p.assert.equal((await p.menuItems()).find((i) => i.label === 'Fresh start on every run').checked, true);
    await p.closeMenus();
  });
  t.test('the fresh start setting is remembered after a reload', async (p) => {
    await p.menu('Fresh start on every run');
    await p.reload();
    p.assert.equal(await p.ev('LG.app.settings.freshRun'), false);
    await p.menu('Fresh start on every run');
    p.assert.equal(await p.ev("JSON.parse(localStorage.getItem('lohgo.settings')).freshRun"), true);
  });
  t.test('the settings dialog has the fresh start checkbox', async (p) => {
    await p.click('#railSettings');
    await p.waitModal();
    p.assert.equal(await p.ev("document.getElementById('set-freshRun').checked"), true);
    await p.click('#set-freshRun');
    p.assert.equal(await p.ev('LG.app.settings.freshRun'), false);
    await p.click('#set-freshRun');
    p.assert.equal(await p.ev('LG.app.settings.freshRun'), true);
    await p.modalButton('Done');
  });

  // ---- the status line ---------------------------------------------------------------------------
  t.test('the status line says how long the run took', async (p) => {
    await p.runProgram('print 1\n');
    await p.wait("/^Finished in \\d+ ms/.test(document.getElementById('statusMsg').innerText)");
  });
  t.test('one instruction is counted as one', async (p) => {
    await p.runProgram('print 1\n');
    await p.wait("/· 1 instruction$/.test(document.getElementById('statusMsg').innerText)");
  });
  t.test('two instructions are counted as two', async (p) => {
    await p.runProgram('print 1\nprint 2\n');
    await p.wait("/· 2 instructions$/.test(document.getElementById('statusMsg').innerText)");
  });
  t.test('a loop counts every instruction it runs', async (p) => {
    await p.runProgram('repeat 3 [print 1]\n');
    await p.wait("/· 4 instructions$/.test(document.getElementById('statusMsg').innerText)");
  });
  t.test('a long run shows seconds and a big count with separators', async (p) => {
    await p.runProgram('repeat 2000 [make "x 1]\nwait 70\n', { timeout: 15000 });
    const s = await p.status();
    p.assert.match(s, /^Finished in 1\.\d s · 2,002 instructions$/);
  });
  t.test('an error replaces the status with the message', async (p) => {
    await p.runProgram('print 1\nfd "x\n');
    p.assert.equal(await p.status(), "Error: fd doesn't like x as input");
  });

  // ---- runaway programs --------------------------------------------------------------------------
  t.test('an endless loop keeps the page responsive', async (p) => {
    await p.runProgram('forever [make "x 1]\n', { wait: false });
    await p.waitState('running');
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      await p.ev('new Promise((r) => requestAnimationFrame(() => r(1)))');
      p.assert.ok(Date.now() - t0 < 500, 'a frame came in ' + (Date.now() - t0) + ' ms');
    }
    p.assert.equal(await p.state(), 'running');
    await p.click('#tbStop');
    await p.waitState('idle', 2000);
  });
  t.test('an endless recursion can be stopped', async (p) => {
    await p.runProgram('to spin :n\nwait 1\nspin :n + 1\nend\nspin 1\n', { wait: false });
    await p.sleep(300);
    p.assert.ok(['running', 'waiting'].includes(await p.state()));
    p.assert.ok(await p.ev('LG.app.interp.stack.length') > 3, 'the recursion is under way');
    await p.key('F5', { shift: true });
    await p.waitState('idle', 2000);
  });
  t.test('a runaway program that prints a lot can be stopped', async (p) => {
    await p.runProgram('forever [print "spam]\n', { wait: false });
    await p.sleep(400);
    await p.click('#tbStop');
    await p.waitState('idle', 3000);
    await p.command('clearscreen');
  });
  t.test('a drawing loop shows progress on the screen while it runs', async (p) => {
    await p.runProgram('forever [fd 0.01]\n', { wait: false });
    await p.sleep(200);
    const a = await p.text('#turtleChip');
    await p.sleep(200);
    const b = await p.text('#turtleChip');
    p.assert.notEqual(a, b);
    await p.stopProgram();
  });
  t.test('the mouse still works on the page during a runaway loop', async (p) => {
    await p.runProgram('forever [make "x 1]\n', { wait: false });
    await p.waitState('running');
    await p.click('#menuBtn');
    await p.wait("!!document.querySelector('.menu-pop')", 2000);
    await p.click('.menu-pop .menu-item', 'Stop');
    await p.waitState('idle');
  });

  // ---- errors ----------------------------------------------------------------------------------------
  t.test('an error stops the program and marks its line', async (p) => {
    await p.runProgram('print "one\nprint "two\nfd "x\nprint "three\n');
    p.assert.equal(await p.state(), 'error');
    p.assert.equal(await pill(p), 'Error');
    p.assert.match(await p.attr('#state', 'class'), /error/);
    p.assert.equal(await errLine(p), '3');
    const out = await p.output();
    p.assert.match(out, /^two$/m);
    p.assert.doesNotMatch(out, /^three$/m);
  });
  t.test('an error shows in the Problems tab', async (p) => {
    await p.runProgram('print 1\nbogus 5\n');
    await p.wait("document.querySelector('#tabProblems .badge').innerText === '1'");
    await p.click('#tabProblems');
    p.assert.match(await p.text('#problems'), /I don't know how to bogus/);
    p.assert.match(await p.text('#problems'), /e2e\.lgo:2/);
    await p.click('#tabCommands');
  });
  t.test('an error inside a procedure names the procedure', async (p) => {
    await p.runProgram('to inner\nfd "q\nend\nto outer\ninner\nend\nouter\n');
    p.assert.equal(await p.status(), "Error: fd doesn't like q as input (in inner)");
    p.assert.equal(await errLine(p), '2');
  });
  t.test('running again clears the error mark', async (p) => {
    await p.runProgram('fd "x\n');
    p.assert.equal(await errLine(p), '1');
    await p.setCode('print 1\n');
    await p.runProgram(await p.code());
    p.assert.equal(await errLine(p), '');
    p.assert.equal(await p.state(), 'idle');
  });
  t.test('editing the line takes the error mark away', async (p) => {
    await p.runProgram('fd "x\n');
    await p.setCode('fd 10\n');
    await p.wait("!LG.app.active.editor.inner.querySelector('.ed-gl.err')");
  });
  t.test('a value nobody uses is an error', async (p) => {
    await p.runProgram('sum 2 3\n');
    await p.waitOutput(/You don't say what to do with 5/);
  });
  t.test('STOP outside a procedure is an error', async (p) => {
    await p.runProgram('print 1\nstop\nprint 2\n');
    await p.waitOutput(/Can only use STOP or OUTPUT inside a procedure/);
    p.assert.doesNotMatch(await p.output(), /^2$/m);
  });
  t.test('after an error a new run works', async (p) => {
    await p.runProgram('fd "x\n');
    await p.runProgram('print "recovered\n');
    await p.waitOutput(/^recovered$/m);
    p.assert.equal(await p.state(), 'idle');
    p.assert.equal(await pill(p), 'Ready');
  });
  t.test('a command after an error runs in the error context and keeps the error state', async (p) => {
    await p.runProgram('make "z 4\nfd "x\n');
    await p.command('print :z * 2');
    await p.waitOutput(/^8$/m);
  });

  // ---- BYE and THROW "TOPLEVEL -----------------------------------------------------------------------
  t.test('BYE ends the program but the page stays', async (p) => {
    await p.runProgram('print "before\nbye\nprint "after\n');
    p.assert.equal(await p.state(), 'idle');
    await p.waitOutput(/Bye!/);
    p.assert.doesNotMatch(await p.output(), /^after$/m);
    p.assert.ok(await p.visible('#worldCard'));
  });
  t.test('BYE inside a procedure ends everything', async (p) => {
    await p.runProgram('to quit\nbye\nprint "no\nend\nquit\nprint "nope\n');
    p.assert.equal(await p.state(), 'idle');
    p.assert.doesNotMatch(await p.output(), /^nope$/m);
  });
  t.test('THROW "TOPLEVEL ends the program quietly', async (p) => {
    await p.runProgram('print "start\nthrow "toplevel\nprint "after\n');
    p.assert.equal(await p.state(), 'idle');
    p.assert.doesNotMatch(await p.output(), /^after$/m);
    p.assert.equal(await p.ev('LG.app.problems.length'), 0);
  });
  t.test('THROW "TOPLEVEL deep in procedures ends the program', async (p) => {
    await p.runProgram('to a\nb\nprint "a-end\nend\nto b\nthrow "toplevel\nend\na\nprint "after\n');
    p.assert.equal(await p.state(), 'idle');
    const out = await p.output();
    p.assert.doesNotMatch(out, /a-end/);
    p.assert.doesNotMatch(out, /^after$/m);
  });
  t.test('CATCH "TRUE does not catch TOPLEVEL', async (p) => {
    await p.runProgram('catch "true [throw "toplevel]\nprint "after\n');
    p.assert.doesNotMatch(await p.output(), /^after$/m);
  });
  t.test('a THROW nobody catches is an error', async (p) => {
    await p.runProgram('throw "nowhere\n');
    await p.waitOutput(/Can't find catch tag for nowhere/);
    p.assert.equal(await p.state(), 'error');
  });
  t.test('CATCH and THROW pass a value', async (p) => {
    await p.runProgram('print catch "found [(throw "found 42)]\n');
    await p.waitOutput(/^42$/m);
  });
  t.test('THROW "ERROR with a message reports it', async (p) => {
    await p.runProgram('(throw "error [custom trouble])\n');
    await p.waitOutput(/custom trouble/);
    p.assert.equal(await p.state(), 'error');
  });

  // ---- LOAD from a program ------------------------------------------------------------------------
  t.test('a program can LOAD another file and use its procedures', async (p) => {
    await p.ev("LG.app.vfs.writeText('/projects/e2e-helper.lgo', 'to helper\\nprint \"helped\\nend\\n', {trusted: true})");
    await p.runProgram('load "/projects/e2e-helper.lgo\nhelper\n');
    await p.waitOutput(/^helped$/m);
    p.assert.equal(await p.state(), 'idle');
  });
  t.test('a loaded file runs its own top-level lines', async (p) => {
    await p.ev("LG.app.vfs.writeText('/projects/e2e-helper.lgo', 'make \"loaded 7\\nprint \"loading\\n', {trusted: true})");
    await p.runProgram('load "/projects/e2e-helper.lgo\nprint :loaded\n');
    await p.waitOutput(/^loading\n7$/m);
  });
  t.test('an error in a loaded file marks the line in that file', async (p) => {
    await p.ev("LG.app.vfs.writeText('/projects/e2e-bad.lgo', 'print 1\\nfd \"oops\\n', {trusted: true})");
    await p.runProgram('load "/projects/e2e-bad.lgo\n');
    p.assert.equal(await p.state(), 'error');
    await p.wait("LG.app.active.path === '/projects/e2e-bad.lgo'");
    p.assert.equal(await errLine(p), '2');
  });
  t.test('LOAD of a missing file is an error', async (p) => {
    await p.runProgram('load "/projects/no-such-file.lgo\n');
    await p.waitOutput(/File system error/);
  });
  t.test('a loaded procedure can be called from the command center', async (p) => {
    await p.ev("LG.app.vfs.writeText('/projects/e2e-helper.lgo', 'to helper2\\nprint \"helped2\\nend\\n', {trusted: true})");
    await p.runProgram('load "/projects/e2e-helper.lgo\n');
    await p.command('helper2');
    await p.waitOutput(/^helped2$/m);
  });

  // ---- procedures stay for the command center ---------------------------------------------------
  t.test('procedures from a run work in the command center', async (p) => {
    await p.runProgram('to square :s\nrepeat 4 [fd :s rt 90]\nend\n');
    await p.command('square 60');
    p.assert.ok((await inkNear(p, 0, 30))[3] > 150);
    p.assert.ok((await inkNear(p, 30, 60))[3] > 150);
  });
  t.test('variables from a run work in the command center', async (p) => {
    await p.runProgram('make "size 42\n');
    await p.command('print :size');
    await p.waitOutput(/^42$/m);
  });
  t.test('procedures from a run show in the Procedures panel', async (p) => {
    await p.runProgram('to e2eshown\nprint 1\nend\n');
    await p.click('#railProcs');
    await p.wait("/to e2eshown/.test(document.getElementById('sideBody').innerText)");
    p.assert.match(await p.text('#sideBody'), /e2e\.lgo:1/);
    await p.click('#railProcs');
  });
  t.test('a procedure name from a run completes with Tab', async (p) => {
    await p.runProgram('to e2ecomplete\nprint "done-complete\nend\n');
    await p.click('#cmdInput');
    await p.type('e2ecomp');
    await p.key('Tab');
    p.assert.equal(await p.ev("document.getElementById('cmdInput').value"), 'e2ecomplete ');
    await p.key('Enter');
    await p.waitOutput(/^done-complete$/m);
  });
}
