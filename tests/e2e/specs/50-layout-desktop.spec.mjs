// The desktop layout: the three splitters (mouse and keyboard, limits, remembered sizes), the
// top bar (brand, project path, state pill, speed slider, buttons) and the status bar.
import { drag, cssVar, rects, textOf } from './50-ui-lib.mjs';

const pct = (v) => parseFloat(v);

export default function (t) {
  // ---- splitters with the mouse ---------------------------------------------------------------
  t.test('dragging the editor splitter to the left widens the editor', async (p) => {
    const before = await rects(p, ['#rightCol', '#leftCol']);
    await drag(p, '#splitRight', -150, 0);
    const after = await rects(p, ['#rightCol', '#leftCol']);
    p.assert.ok(Math.abs(after['#rightCol'].w - before['#rightCol'].w - 150) < 6, `right column ${before['#rightCol'].w} -> ${after['#rightCol'].w}`);
    p.assert.ok(after['#leftCol'].w < before['#leftCol'].w - 140);
    p.assert.match(await p.ev("document.documentElement.style.getPropertyValue('--right-w')"), /^\d+(\.\d)?%$/);
  }, { fresh: true });

  t.test('dragging the editor splitter to the right narrows the editor', async (p) => {
    const before = await p.rect('#rightCol');
    await drag(p, '#splitRight', 120, 0);
    const after = await p.rect('#rightCol');
    p.assert.ok(Math.abs(before.w - after.w - 120) < 6, `${before.w} -> ${after.w}`);
  }, { fresh: true });

  t.test('the editor splitter keeps both columns at least 300 pixels wide', async (p) => {
    await drag(p, '#splitRight', -2000, 0);
    let r = await rects(p, ['#leftCol', '#rightCol', '#stage']);
    p.assert.ok(r['#leftCol'].w >= 299, 'left column ' + r['#leftCol'].w);
    await drag(p, '#splitRight', 3000, 0);
    r = await rects(p, ['#leftCol', '#rightCol']);
    p.assert.ok(r['#rightCol'].w >= 299 && r['#rightCol'].w < 320, 'right column ' + r['#rightCol'].w);
  }, { fresh: true });

  t.test('dragging the command center splitter up makes the command center taller', async (p) => {
    const before = await rects(p, ['#cmdCard', '#worldCard']);
    await drag(p, '#splitCmd', 0, -100);
    const after = await rects(p, ['#cmdCard', '#worldCard']);
    p.assert.ok(Math.abs(after['#cmdCard'].h - before['#cmdCard'].h - 100) < 6, `${before['#cmdCard'].h} -> ${after['#cmdCard'].h}`);
    p.assert.ok(after['#worldCard'].h < before['#worldCard'].h - 90);
  }, { fresh: true });

  t.test('the command center splitter stops at its limits', async (p) => {
    await drag(p, '#splitCmd', 0, 2000);
    let r = await p.rect('#cmdCard');
    p.assert.ok(r.h >= 89 && r.h < 100, 'smallest command center ' + r.h);
    await drag(p, '#splitCmd', 0, -2000);
    r = await rects(p, ['#cmdCard', '#worldCard', '#leftCol']);
    p.assert.ok(r['#worldCard'].h >= 119, 'world keeps some room ' + r['#worldCard'].h);
    p.assert.ok(r['#cmdCard'].h <= r['#leftCol'].h - 159, 'command center ' + r['#cmdCard'].h);
  }, { fresh: true });

  t.test('dragging the inspector splitter changes the editor and debugger heights', async (p) => {
    const before = await rects(p, ['#inspCard', '#editorCard']);
    await drag(p, '#splitInsp', 0, 80);
    const after = await rects(p, ['#inspCard', '#editorCard']);
    p.assert.ok(Math.abs(before['#inspCard'].h - after['#inspCard'].h - 80) < 6, `${before['#inspCard'].h} -> ${after['#inspCard'].h}`);
    p.assert.ok(after['#editorCard'].h > before['#editorCard'].h + 70);
  }, { fresh: true });

  t.test('the inspector splitter stops at its limits', async (p) => {
    await drag(p, '#splitInsp', 0, 3000);
    let r = await p.rect('#inspCard');
    p.assert.ok(r.h >= 79 && r.h < 90, 'smallest inspector ' + r.h);
    await drag(p, '#splitInsp', 0, -3000);
    r = await rects(p, ['#inspCard', '#editorCard', '#rightCol']);
    p.assert.ok(r['#inspCard'].h <= r['#rightCol'].h - 139, 'inspector ' + r['#inspCard'].h);
    p.assert.ok(r['#editorCard'].h >= 119, 'editor ' + r['#editorCard'].h);
  }, { fresh: true });

  t.test('a splitter shows it is being dragged and the page does not select text', async (p) => {
    const [x, y] = await p.center('#splitRight');
    await p.mouse('mouseMoved', x, y);
    await p.b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await p.b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x - 20, y, button: 'left', buttons: 1 });
    await p.sleep(40);
    p.assert.ok(await p.ev("document.getElementById('splitRight').classList.contains('dragging')"));
    p.assert.ok(await p.ev("document.body.classList.contains('resizing')"));
    await p.b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x - 20, y, button: 'left', buttons: 0, clickCount: 1 });
    await p.sleep(40);
    p.assert.ok(!(await p.ev("document.getElementById('splitRight').classList.contains('dragging')")));
    p.assert.ok(!(await p.ev("document.body.classList.contains('resizing')")));
  }, { fresh: true });

  t.test('splitters have the right resize cursors', async (p) => {
    p.assert.equal(await p.ev("getComputedStyle(document.getElementById('splitRight')).cursor"), 'col-resize');
    p.assert.equal(await p.ev("getComputedStyle(document.getElementById('splitCmd')).cursor"), 'row-resize');
    p.assert.equal(await p.ev("getComputedStyle(document.getElementById('splitInsp')).cursor"), 'row-resize');
  });

  t.test('splitter sizes are remembered after a reload', async (p) => {
    await drag(p, '#splitRight', -100, 0);
    await drag(p, '#splitCmd', 0, -60);
    await drag(p, '#splitInsp', 0, 50);
    const before = await rects(p, ['#rightCol', '#cmdCard', '#inspCard']);
    const vars = [await cssVar(p, '--right-w'), await cssVar(p, '--cmd-h'), await cssVar(p, '--insp-h')];
    await p.reload();
    const after = await rects(p, ['#rightCol', '#cmdCard', '#inspCard']);
    p.assert.deepEqual([await cssVar(p, '--right-w'), await cssVar(p, '--cmd-h'), await cssVar(p, '--insp-h')], vars);
    for (const k of Object.keys(before)) p.assert.ok(Math.abs(before[k].w - after[k].w) < 3 && Math.abs(before[k].h - after[k].h) < 3, k);
  }, { fresh: true });

  // ---- splitters with the keyboard -------------------------------------------------------------
  t.test('splitters can be focused with Tab', async (p) => {
    for (const id of ['splitRight', 'splitCmd', 'splitInsp']) p.assert.equal(await p.ev(`document.getElementById('${id}').tabIndex`), 0);
  });

  t.test('ArrowLeft on the editor splitter widens the editor, ArrowRight narrows it', async (p) => {
    const start = pct(await cssVar(p, '--right-w'));
    const w0 = (await p.rect('#rightCol')).w;
    await p.ev("document.getElementById('splitRight').focus()");
    await p.key('ArrowLeft');
    p.assert.equal(pct(await cssVar(p, '--right-w')), start + 2);
    p.assert.ok((await p.rect('#rightCol')).w > w0, 'editor column wider');
    await p.key('ArrowRight');
    await p.key('ArrowRight');
    p.assert.equal(pct(await cssVar(p, '--right-w')), start - 2);
  }, { fresh: true });

  t.test('ArrowUp on the command center splitter makes the command center taller', async (p) => {
    const start = pct(await cssVar(p, '--cmd-h'));
    const h0 = (await p.rect('#cmdCard')).h;
    await p.ev("document.getElementById('splitCmd').focus()");
    await p.key('ArrowUp');
    p.assert.equal(pct(await cssVar(p, '--cmd-h')), start + 2);
    p.assert.ok((await p.rect('#cmdCard')).h > h0);
    await p.key('ArrowDown');
    await p.key('ArrowDown');
    p.assert.equal(pct(await cssVar(p, '--cmd-h')), start - 2);
  }, { fresh: true });

  t.test('ArrowUp on the inspector splitter makes the debugger taller', async (p) => {
    const start = pct(await cssVar(p, '--insp-h'));
    const h0 = (await p.rect('#inspCard')).h;
    await p.ev("document.getElementById('splitInsp').focus()");
    await p.key('ArrowUp');
    p.assert.equal(pct(await cssVar(p, '--insp-h')), start + 2);
    p.assert.ok((await p.rect('#inspCard')).h > h0);
  }, { fresh: true });

  t.test('keyboard resizing stops at 18% and 75%', async (p) => {
    await p.ev("document.getElementById('splitCmd').focus()");
    for (let i = 0; i < 30; i++) await p.key('ArrowUp', { after: 0 });
    p.assert.equal(await cssVar(p, '--cmd-h'), '75.0%');
    for (let i = 0; i < 40; i++) await p.key('ArrowDown', { after: 0 });
    p.assert.equal(await cssVar(p, '--cmd-h'), '18.0%');
  }, { fresh: true });

  t.test('the wrong arrows do nothing on a splitter', async (p) => {
    const a = await cssVar(p, '--right-w');
    await p.ev("document.getElementById('splitRight').focus()");
    await p.key('ArrowUp');
    await p.key('ArrowDown');
    p.assert.equal(await cssVar(p, '--right-w'), a);
    const b = await cssVar(p, '--cmd-h');
    await p.ev("document.getElementById('splitCmd').focus()");
    await p.key('ArrowLeft');
    p.assert.equal(await cssVar(p, '--cmd-h'), b);
  }, { fresh: true });

  t.test('keyboard splitter sizes are remembered after a reload', async (p) => {
    await p.ev("document.getElementById('splitInsp').focus()");
    await p.key('ArrowDown');
    await p.key('ArrowDown');
    const v = await cssVar(p, '--insp-h');
    await p.reload();
    p.assert.equal(await cssVar(p, '--insp-h'), v);
  }, { fresh: true });

  // ---- the top bar ---------------------------------------------------------------------------
  t.test('the brand button opens About', async (p) => {
    await p.click('#brand');
    p.assert.equal(await p.waitModal(), 'About Lohgo');
    await p.key('Escape');
  }, { fresh: true });

  t.test('the project label shows the path of the program in the editor', async (p) => {
    p.assert.equal(await p.text('#proj'), '/projects/start.lgo');
    await p.newFile('/projects/art/one.lgo', 'fd 10\n');
    p.assert.equal(await p.text('#proj'), '/projects/art/one.lgo');
    await p.click('#editorTabs .etab', 'start.lgo');
    p.assert.equal(await p.text('#proj'), '/projects/start.lgo');
  }, { fresh: true });

  t.test('the window title names the program', async (p) => {
    p.assert.equal(await p.ev('document.title'), 'start.lgo · Lohgo');
    await p.newFile('/projects/zz.lgo', '');
    p.assert.equal(await p.ev('document.title'), 'zz.lgo · Lohgo');
  }, { fresh: true });

  t.test('the project label is empty when every program is closed', async (p) => {
    await p.ev('LG.app.closeDoc(LG.app.active)');
    await p.wait('LG.app.docs.length === 0');
    p.assert.equal(await p.text('#proj'), '');
    p.assert.equal(await p.ev('document.title'), 'Lohgo');
  }, { fresh: true });

  t.test('the state pill says Ready when nothing runs', async (p) => {
    p.assert.equal(await textOf(p, '#state'), 'Ready');
    p.assert.equal(await p.ev("document.getElementById('state').className.trim()"), 'state');
  }, { fresh: true });

  t.test('the state pill says Running while a program runs and Ready after Stop', async (p) => {
    await p.runProgram('forever [fd 1 rt 1]\n', { wait: false });
    await p.wait("document.getElementById('state').textContent === 'Running'");
    p.assert.ok(await p.ev("document.getElementById('state').classList.contains('running')"));
    await p.click('#tbStop');
    await p.wait("document.getElementById('state').textContent === 'Ready'");
  }, { fresh: true });

  t.test('the state pill says Paused at a breakpoint', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'print 1\nprint 2\n');
    await p.ev("LG.app.toggleBreakpoint('/projects/e2e.lgo', 1)");
    await p.click('#tbRun');
    await p.waitState('paused');
    p.assert.equal(await textOf(p, '#state'), 'Paused');
    p.assert.ok(await p.ev("document.getElementById('state').classList.contains('paused')"));
    await p.stopProgram();
  }, { fresh: true });

  t.test('the state pill says Error after a program fails', async (p) => {
    await p.runProgram('print 1\nfoo123\n');
    p.assert.equal(await p.state(), 'error');
    p.assert.equal(await textOf(p, '#state'), 'Error');
    p.assert.ok(await p.ev("document.getElementById('state').classList.contains('error')"));
  }, { fresh: true });

  t.test('the state pill says Waiting while the program reads a line', async (p) => {
    await p.runProgram('make "x readword\nprint :x\n', { until: ['input'] });
    p.assert.equal(await textOf(p, '#state'), 'Waiting');
    await p.stopProgram();
  }, { fresh: true });

  t.test('Run, Pause and Stop enable and disable with the program state', async (p) => {
    const dis = () => p.ev("['tbRun','tbPause','tbStop','tbInto','tbOver','tbOut'].map(i => document.getElementById(i).disabled)");
    p.assert.deepEqual(await dis(), [false, true, true, false, false, true]);
    await p.runProgram('forever [fd 1]\n', { wait: false });
    await p.waitState('running');
    p.assert.deepEqual(await dis(), [true, false, false, true, true, true]);
    await p.click('#tbPause');
    await p.waitState('paused');
    p.assert.deepEqual(await dis(), [false, true, false, false, false, false]);
    p.assert.equal(await p.ev("document.querySelector('#tbRun .lbl').textContent"), 'Continue');
    await p.click('#tbStop');
    await p.waitState('idle');
    p.assert.deepEqual(await dis(), [false, true, true, false, false, true]);
    p.assert.equal(await p.ev("document.querySelector('#tbRun .lbl').textContent"), 'Run');
  }, { fresh: true });

  t.test('the speed slider starts at Instant', async (p) => {
    p.assert.equal(await p.ev("document.getElementById('speed').value"), '10');
    p.assert.equal(await p.ev("document.querySelector('#speedBox .lbl').textContent"), 'Instant');
    p.assert.equal(await p.attr('#speed', 'aria-label'), 'Turtle speed');
  }, { fresh: true });

  t.test('arrow keys on the speed slider change the speed and its label', async (p) => {
    await p.ev("document.getElementById('speed').focus()");
    await p.key('ArrowLeft');
    p.assert.equal(await p.ev("document.querySelector('#speedBox .lbl').textContent"), 'Zooming');
    p.assert.equal(await p.ev('LG.app.interp.anim'), 400);
    await p.key('Home');
    p.assert.equal(await p.ev("document.querySelector('#speedBox .lbl').textContent"), 'Step by step');
    p.assert.equal(await p.ev('LG.app.interp.speedDelay'), 600);
  }, { fresh: true });

  t.test('clicking the left end of the speed slider slows the turtle right down', async (p) => {
    const r = await p.rect('#speed');
    await p.clickAt(r.x + 3, r.y + r.h / 2);
    p.assert.equal(await p.ev('LG.app.settings.speed'), 0);
    p.assert.equal(await p.ev("document.querySelector('#speedBox .lbl').textContent"), 'Step by step');
  }, { fresh: true });

  t.test('dragging the speed slider to the middle picks a middle speed', async (p) => {
    const r = await p.rect('#speed');
    await p.clickAt(r.x + 3, r.y + r.h / 2);
    const x0 = r.x + 3;
    await p.mouse('mouseMoved', x0, r.y + r.h / 2);
    await p.b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: r.y + r.h / 2, button: 'left', buttons: 1, clickCount: 1 });
    await p.b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x + r.w / 2, y: r.y + r.h / 2, button: 'left', buttons: 1 });
    await p.b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x + r.w / 2, y: r.y + r.h / 2, button: 'left', buttons: 0, clickCount: 1 });
    await p.sleep(60);
    const v = await p.ev('LG.app.settings.speed');
    p.assert.ok(v >= 4 && v <= 6, 'speed ' + v);
  }, { fresh: true });

  t.test('the chosen speed is remembered after a reload', async (p) => {
    await p.ev("document.getElementById('speed').focus()");
    await p.key('ArrowLeft');
    await p.key('ArrowLeft');
    await p.key('ArrowLeft');
    await p.reload();
    p.assert.equal(await p.ev("document.getElementById('speed').value"), '7');
    p.assert.equal(await p.ev("document.querySelector('#speedBox .lbl').textContent"), 'Racing');
    p.assert.equal(await p.ev('LG.app.interp.anim'), 40);
  }, { fresh: true });

  t.test('a slow speed makes a program take visibly longer', async (p) => {
    await p.ev("document.getElementById('speed').focus()");
    await p.key('Home');
    await p.key('ArrowRight');
    await p.key('ArrowRight');   // Slow: 90 ms between instructions
    const t0 = Date.now();
    await p.runProgram('fd 10\nfd 10\nfd 10\nfd 10\n');
    p.assert.ok(Date.now() - t0 > 250, 'took ' + (Date.now() - t0));
    p.assert.equal((await p.turtle()).y, 40);
  }, { fresh: true });

  t.test('the menu button opens the main menu inside the window, scrolling if it must', async (p) => {
    await p.click('#menuBtn');
    await p.wait("!!document.querySelector('.menu-pop')");
    const m = await p.rect('.menu-pop');
    p.assert.ok(m.y >= 0 && m.bottom <= 900 && m.x >= 0 && m.right <= 1400, 'menu inside the window ' + JSON.stringify(m));
    const b = await p.rect('#menuBtn');
    p.assert.ok(Math.abs(m.right - b.right) < 80, 'menu opens near the button ' + m.right + ' vs ' + b.right);
    p.assert.equal(await p.attr('#menuBtn', 'aria-haspopup'), 'menu');
    // the last item can be reached
    await p.click('.menu-pop .menu-item', 'About Lohgo');
    p.assert.equal(await p.waitModal(), 'About Lohgo');
    await p.key('Escape');
  }, { fresh: true });

  t.test('step labels are shown on a wide screen', async (p) => {
    for (const id of ['tbInto', 'tbOver', 'tbOut', 'tbRun', 'tbPause', 'tbStop']) p.assert.ok(await p.visible(`#${id} .lbl`), id);
    p.assert.ok(await p.visible('#speedBox .lbl'));
  }, { fresh: true });

  // ---- the status bar ---------------------------------------------------------------------------
  t.test('the status bar reports how long a run took', async (p) => {
    await p.runProgram('repeat 4 [fd 10 rt 90]\n');
    p.assert.match(await p.status(), /^Finished in \d+ ms · [\d,]+ instructions$/);
  }, { fresh: true });

  t.test('the status bar reports an error', async (p) => {
    await p.runProgram('nosuchthing 3\n');
    p.assert.match(await p.status(), /^Error: .*nosuchthing/i);
  }, { fresh: true });

  t.test('the status bar says where a program paused', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'to f\nprint 1\nend\nf\n');
    await p.ev("LG.app.toggleBreakpoint('/projects/e2e.lgo', 1)");
    await p.key('F5');
    await p.waitState('paused');
    p.assert.match(await p.status(), /Stopped at a breakpoint in f\. F5 continues/);
    await p.stopProgram();
  }, { fresh: true });

  t.test('the status bar shows where the turtle is', async (p) => {
    await p.command('fd 100 rt 90');
    await p.wait("/x 0\\s+y 100\\s+90°/.test(document.getElementById('sbTurtle').textContent)");
    await p.command('pu');
    await p.wait("/pen up/.test(document.getElementById('sbTurtle').textContent)");
  }, { fresh: true });

  t.test('the status bar shows the mouse position over the turtle world', async (p) => {
    await p.ev('LG.app.hideWelcome()');
    const v = await p.ev('(() => { const tv = LG.app.turtleView; const r = tv.canvas.getBoundingClientRect(); return { x: r.left + (tv.view.x + tv.view.w / 2) / tv.dpr, y: r.top + (tv.view.y + tv.view.h / 2) / tv.dpr, k: tv.view.k / tv.dpr }; })()');
    await p.mouse('mouseMoved', v.x + 50 * v.k, v.y - 20 * v.k);
    await p.sleep(50);
    const s = await p.text('#sbPos');
    const m = /mouse (-?[\d.]+), (-?[\d.]+)/.exec(s);
    p.assert.ok(m, s);
    p.assert.ok(Math.abs(+m[1] - 50) < 2 && Math.abs(+m[2] - 20) < 2, s);
  }, { fresh: true });

  t.test('the status bar sits at the bottom across the window', async (p) => {
    const r = await p.rect('#status');
    p.assert.ok(Math.abs(r.bottom - 900) < 1);
    p.assert.ok(r.w >= 1399);
    p.assert.match(await p.text('#status'), /Logo$/);
  }, { fresh: true });
}
