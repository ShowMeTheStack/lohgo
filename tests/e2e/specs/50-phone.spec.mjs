// Phones in portrait (720 wide or less): one view at a time with a tab bar at the bottom, the
// touch keypad for programs that read keys, tapping words in the editor, dialogs that fit, and
// tours that move to the right view.
import { assertReachable, assertWorldShape, textOf } from './50-ui-lib.mjs';

const PHONE = { width: 390, height: 844, mobile: true, touch: true };
const shown = (p) => p.ev("['worldCard','cmdCard','editorCard','inspCard','side'].filter(id => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none'; })");
const activeTab = (p) => p.ev("[...document.querySelectorAll('#mbar .mtab.active')].map(b => b.id)");

/** Screen point of a character in the active editor */
const charPoint = (p, line, col) => p.fn((ln, c) => {
  const ed = LG.app.active.editor;
  const r = ed.ta.getBoundingClientRect();
  const cs = getComputedStyle(ed.ta);
  return [r.left + (parseFloat(cs.paddingLeft) || 0) - ed.ta.scrollLeft + (c + 0.5) * ed.charWidth, r.top + ed.padTop - ed.ta.scrollTop + (ln + 0.5) * ed.lineHeight];
}, line, col);
async function tapAt(p, x, y) {
  await p.b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await p.b.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.sleep(100);
}

export default function (t) {
  t.test('the tab bar has Turtle, Code, Debug, Files and More', async (p) => {
    const tabs = await p.ev("[...document.querySelectorAll('#mbar .mtab')].map(b => [b.id, b.getAttribute('aria-label'), b.textContent.trim()])");
    p.assert.deepEqual(tabs, [['mtab-turtle', 'Turtle', 'Turtle'], ['mtab-code', 'Code', 'Code'], ['mtab-debug', 'Debug', 'Debug'], ['mtab-files', 'Files', 'Files'], ['mtab-more', 'More', 'More']]);
    p.assert.equal(await p.attr('#mbar', 'aria-label'), 'Views');
    const r = await p.rect('#mbar');
    p.assert.ok(Math.abs(r.bottom - 844) < 1 && r.w >= 389, 'tab bar along the bottom');
  }, { fresh: PHONE });

  t.test('the phone starts on the Turtle view with the world and the command center', async (p) => {
    p.assert.equal(await p.ev('document.body.dataset.view'), 'turtle');
    p.assert.deepEqual(await activeTab(p), ['mtab-turtle']);
    p.assert.deepEqual(await shown(p), ['worldCard', 'cmdCard']);
    const r = await p.rect('#worldCard');
    const c = await p.rect('#cmdCard');
    p.assert.ok(c.y >= r.bottom, 'command center below the world');
    p.assert.ok(r.h > c.h, 'the world gets more room');
  }, { fresh: PHONE });

  t.test('tapping Code shows only the editor', async (p) => {
    await p.tap('#mtab-code');
    p.assert.equal(await p.ev('document.body.dataset.view'), 'code');
    p.assert.deepEqual(await activeTab(p), ['mtab-code']);
    p.assert.deepEqual(await shown(p), ['editorCard']);
    await assertReachable(p, ['#editorTabs .etab', '#tbNew', '#tbSave', '#tbShare', '#editors .ed-ta']);
  }, { fresh: PHONE });

  t.test('tapping Debug shows only the debugger panels', async (p) => {
    await p.tap('#mtab-debug');
    p.assert.deepEqual(await activeTab(p), ['mtab-debug']);
    p.assert.deepEqual(await shown(p), ['inspCard']);
    await assertReachable(p, ['#itab-vars', '#itab-stack', '#itab-watch']);
  }, { fresh: PHONE });

  t.test('tapping Files shows the file tree in place of the stage', async (p) => {
    await p.tap('#mtab-files');
    p.assert.deepEqual(await activeTab(p), ['mtab-files']);
    p.assert.deepEqual(await shown(p), ['side']);
    p.assert.equal(await textOf(p, '#sideTitle'), 'Files');
    p.assert.ok(await p.exists('#sideBody [role=tree]'));
    await assertReachable(p, ['#fNew', '#fNewFolder', '#sideBody .trow']);
  }, { fresh: PHONE });

  t.test('tapping a program in Files opens it in the Code view', async (p) => {
    await p.tap('#mtab-files');
    await p.wait("[...document.querySelectorAll('#sideBody .trow')].some(r => /spiral\\.lgo/.test(r.textContent))");
    await p.tap('#sideBody .trow', 'spiral.lgo');
    await p.wait("document.body.dataset.view === 'code'");
    p.assert.equal(await p.activePath(), '/examples/spiral.lgo');
    p.assert.deepEqual(await shown(p), ['editorCard']);
  }, { fresh: PHONE });

  t.test('tapping More opens the main menu on screen', async (p) => {
    await p.tap('#mtab-more');
    await p.wait("!!document.querySelector('.menu-pop')");
    const m = await p.rect('.menu-pop');
    p.assert.ok(m.x >= 0 && m.right <= 390 && m.y >= 0 && m.bottom <= 844, JSON.stringify(m));
    p.assert.equal(await p.ev('document.body.dataset.view'), 'turtle', 'More does not change the view');
    await p.closeMenus();
  }, { fresh: PHONE });

  t.test('a menu item far down the More menu can be reached', async (p) => {
    await p.tap('#mtab-more');
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.tap('.menu-pop .menu-item', 'Keyboard shortcuts');
    p.assert.equal(await p.waitModal(), 'Keyboard shortcuts');
    await p.modalButton('OK');
  }, { fresh: PHONE });

  t.test('the Procedures rail item becomes the Files view on a phone', async (p) => {
    await p.ev("LG.app.toggleSide('procs')");
    p.assert.equal(await p.ev('document.body.dataset.view'), 'files');
    p.assert.equal(await textOf(p, '#sideTitle'), 'Procedures');
  }, { fresh: PHONE });

  t.test('views keep their content when switching back and forth', async (p) => {
    await p.tap('#mtab-code');
    await p.setCode('print "kept\n');
    await p.tap('#mtab-turtle');
    await p.tap('#mtab-debug');
    await p.tap('#mtab-code');
    p.assert.equal(await p.code(), 'print "kept\n');
  }, { fresh: PHONE });

  t.test('the Code view fills the space between the top bar and the tab bar', async (p) => {
    await p.tap('#mtab-code');
    const e = await p.rect('#editorCard');
    const top = await p.rect('#top');
    const bar = await p.rect('#mbar');
    p.assert.ok(e.y >= top.bottom - 0.5 && e.bottom <= bar.y + 0.5, JSON.stringify(e));
    p.assert.ok(e.h > (bar.y - top.bottom) * 0.85, 'editor uses the room ' + e.h);
  }, { fresh: PHONE });

  t.test('running from the Code view runs the program in the editor', async (p) => {
    await p.tap('#mtab-code');
    await p.setCode('repeat 3 [fd 50 rt 120]\nprint "ran\n');
    await p.tap('#tbRun');
    await p.waitState('idle');
    await p.waitOutput(/ran/);
    p.assert.equal(await p.segments(), 3);
    await p.tap('#mtab-turtle');
    await assertWorldShape(p);
    p.assert.match(await p.output(), /ran/);
  }, { fresh: PHONE });

  t.test('an error while on the Code view leaves the editor showing the bad line', async (p) => {
    await p.tap('#mtab-code');
    await p.setCode('print 1\nnosuchword\n');
    await p.tap('#tbRun');
    await p.waitState('error');
    p.assert.equal(await p.ev('document.body.dataset.view'), 'code');
    p.assert.ok(await p.exists('#editors .ed-err, #editors .err-line, #editors [class*=err]'));
  }, { fresh: PHONE });

  t.test('a breakpoint hit while on the Turtle view switches to the Code view', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'to f :n\nprint :n\nend\nf 7\n');
    await p.ev("LG.app.toggleBreakpoint('/projects/e2e.lgo', 1)");
    await p.tap('#mtab-turtle');
    await p.tap('#tbRun');
    await p.waitState('paused');
    await p.wait("document.body.dataset.view === 'code'");
    p.assert.deepEqual(await shown(p), ['editorCard']);
    p.assert.ok(await p.exists('#editors .exec, #editors [class*=exec]'));
    await p.stopProgram();
  }, { fresh: PHONE });

  t.test('pausing by hand stays on the Turtle view', async (p) => {
    await p.runProgram('forever [fd 1 rt 1]\n', { wait: false });
    await p.tap('#mtab-turtle');
    await p.waitState('running');
    await p.tap('#tbPause');
    await p.waitState('paused');
    p.assert.equal(await p.ev('document.body.dataset.view'), 'turtle');
    await p.stopProgram();
  }, { fresh: PHONE });

  t.test('the Debug view shows the paused procedure and its inputs', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'to f :n\nprint :n\nend\nf 7\n');
    await p.ev("LG.app.toggleBreakpoint('/projects/e2e.lgo', 1)");
    await p.tap('#tbRun');
    await p.waitState('paused');
    await p.tap('#mtab-debug');
    await p.tap('#itab-vars');
    await p.wait("/n/.test(document.getElementById('ipane-vars').textContent) && /7/.test(document.getElementById('ipane-vars').textContent)");
    await p.tap('#itab-stack');
    p.assert.match(await p.paneText('stack'), /f 7/);
    await p.stopProgram();
  }, { fresh: PHONE });

  t.test('the step buttons are hidden on a phone and stepping works from the menu', async (p) => {
    p.assert.equal(await p.visible('#debugGroup'), false);
    await p.newFile('/projects/e2e.lgo', 'print 1\nprint 2\nprint 3\n');
    await p.ev("LG.app.toggleBreakpoint('/projects/e2e.lgo', 0)");
    await p.tap('#tbRun');
    await p.waitState('paused');
    await p.tap('#mtab-more');
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.tap('.menu-pop .menu-item', 'Step over');
    await p.waitState('paused');
    await p.waitOutput(/^1$/m);
    p.assert.doesNotMatch(await p.output(), /^2$/m);
    await p.stopProgram();
  }, { fresh: PHONE });

  t.test('the turtle speed can be changed from the More menu on a phone', async (p) => {
    p.assert.equal(await p.visible('#speed'), false);
    await p.tap('#mtab-more');
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.tap('.menu-pop .menu-item', 'Turtle speed');
    await p.wait("document.querySelectorAll('.menu-pop').length === 2");
    const sub = await p.ev("[...document.querySelectorAll('.menu-pop')[1].querySelectorAll('.menu-item')].map(e => [e.textContent, e.classList.contains('checked')])");
    p.assert.equal(sub.length, 11);
    p.assert.deepEqual(sub[10], ['Instant', true]);
    const r = await p.rect('.menu-pop:last-child');
    p.assert.ok(r.x >= 0 && r.right <= 390.5, 'submenu on screen ' + JSON.stringify(r));
    await p.tap('.menu-pop .menu-item', 'Slow');
    p.assert.equal(await p.ev('LG.app.settings.speed'), 2);
    p.assert.equal(await p.ev('LG.app.interp.speedDelay'), 90);
  }, { fresh: PHONE });

  // ---- the touch keypad ---------------------------------------------------------------------------
  t.test('the touch keypad shows on a touch phone', async (p) => {
    p.assert.ok(await p.ev("document.body.classList.contains('touch')"));
    await p.ev('LG.app.hideWelcome()');
    await assertReachable(p, ['#worldKeys .k-up', '#worldKeys .k-down', '#worldKeys .k-left', '#worldKeys .k-right', '#worldKeys [aria-label=" "]', '#worldKeys [aria-label=Enter]', '#worldKeys [aria-label=Escape]', '#worldKeys [aria-label="Show keyboard"]']);
    const k = await p.rect('#worldKeys');
    const w = await p.rect('#worldWrap');
    p.assert.ok(k.x >= w.x && k.right <= w.right + 0.5 && k.bottom <= w.bottom + 0.5, 'keypad inside the world');
  }, { fresh: PHONE });

  t.test('the keypad is not shown without a touch screen', async (p) => {
    p.assert.ok(!(await p.ev("document.body.classList.contains('touch')")));
    p.assert.equal(await p.visible('#worldKeys'), false);
  }, { fresh: { width: 390, height: 844, mobile: true, touch: false } });

  for (const [cls, word] of [['k-up', 'UP'], ['k-down', 'DOWN'], ['k-left', 'LEFT'], ['k-right', 'RIGHT']]) {
    t.test(`the ${word} key on the keypad reaches READCHAR`, async (p) => {
      await p.runProgram('make "k readchar\nprint word "got: :k\n', { until: ['running', 'waiting', 'input'] });
      await p.sleep(100);
      await p.tap('#worldKeys .' + cls);
      await p.waitState('idle');
      await p.waitOutput(new RegExp('^got:' + word + '$', 'm'));
    }, { fresh: PHONE });
  }

  for (const [label, code] of [[' ', 32], ['Enter', 10], ['Escape', 27]]) {
    t.test(`the ${label === ' ' ? 'Space' : label} key on the keypad reaches READCHAR`, async (p) => {
      await p.runProgram('make "k readchar\nprint ascii :k\n', { until: ['running', 'waiting', 'input'] });
      await p.sleep(100);
      await p.tap(`#worldKeys [aria-label="${label}"]`);
      await p.waitState('idle');
      await p.waitOutput(new RegExp('^' + code + '$', 'm'));
    }, { fresh: PHONE });
  }

  t.test('keypad keys queue up for a program that checks KEYP', async (p) => {
    await p.runProgram('wait 30\nprint keyp\nprint readchar\nprint readchar\n', { until: ['running', 'waiting'] });
    await p.tap('#worldKeys .k-left');
    await p.tap('#worldKeys .k-right');
    await p.waitState('idle', 5000);
    await p.waitOutput(/true\s+LEFT\s+RIGHT/);
  }, { fresh: PHONE });

  t.test('keypad taps when nothing runs do nothing', async (p) => {
    await p.tap('#worldKeys .k-up');
    await p.tap('#worldKeys [aria-label=Enter]');
    p.assert.equal(await p.state(), 'idle');
    p.assert.equal(await p.ev('LG.app.turtleView.keys.length'), 0);
  }, { fresh: PHONE });

  t.test('the keyboard key brings up the typing keyboard for the program', async (p) => {
    await p.ev('LG.app.hideWelcome()');
    await p.tap('#worldKeys [aria-label="Show keyboard"]');
    await p.wait("document.activeElement && document.activeElement.id === 'cmdInput'", 2000);
    p.assert.ok(await p.ev('LG.app.commander.keyMode'));
    await p.waitToast(/keys go to your program/);
  }, { fresh: PHONE });

  // ---- tapping words in the editor -------------------------------------------------------------
  t.test('tapping a command in the editor shows how to use it', async (p) => {
    await p.tap('#mtab-code');
    await p.setCode('forward 10\n');
    const [x, y] = await charPoint(p, 0, 2);
    await tapAt(p, x, y);
    await p.wait("!!document.querySelector('.callout')");
    p.assert.match(await p.text('.callout'), /forward/i);
    const r = await p.rect('.callout');
    p.assert.ok(r.x >= 0 && r.right <= 390 && r.bottom <= 844, 'callout fits ' + JSON.stringify(r));
  }, { fresh: PHONE });

  t.test('tapping a variable while paused shows its value', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'to f :size\nprint :size\nend\nf 42\n');
    await p.ev("LG.app.toggleBreakpoint('/projects/e2e.lgo', 1)");
    await p.tap('#tbRun');
    await p.waitState('paused');
    await p.wait("document.body.dataset.view === 'code'");
    const [x, y] = await charPoint(p, 1, 8);
    await tapAt(p, x, y);
    await p.wait("!!document.querySelector('.callout')");
    p.assert.match(await p.text('.callout'), /42/);
    await p.stopProgram();
  }, { fresh: PHONE });

  t.test('tapping blank space in the editor shows no callout', async (p) => {
    await p.tap('#mtab-code');
    await p.setCode('fd 10\n\n\n');
    const [x, y] = await charPoint(p, 2, 3);
    await tapAt(p, x, y);
    await p.sleep(200);
    p.assert.equal(await p.exists('.callout'), false);
  }, { fresh: PHONE });

  // ---- dialogs and sheets fit -------------------------------------------------------------------
  const DIALOGS = [
    ['About', "LG.app.aboutDialog()"], ['Keyboard shortcuts', "LG.app.shortcutsDialog()"], ['Looks', "LG.app.settingsDialog()"],
    ['Library', "LG.Library.browse(LG.app)"], ['Learn', "LG.Lessons.browse(LG.app)"], ['Help', "LG.Help.open(LG.app)"],
    ['Save as', "LG.app.saveAs()"], ['Open', "LG.Files.openDialog(LG.app)"],
  ];
  for (const [name, js] of DIALOGS) {
    t.test(`the ${name} dialog fits a phone screen and its buttons can be tapped`, async (p) => {
      await p.ev('void ' + js);
      await p.waitModal();
      const r = await p.rect('.modal-back:last-child .modal');
      p.assert.ok(r.x >= 0 && r.y >= 0 && r.right <= 390 + 0.5 && r.bottom <= 844 + 0.5, JSON.stringify(r));
      p.assert.equal(await p.ev("(() => { const m = document.querySelector('.modal-back:last-child .modal'); return m.scrollWidth <= m.clientWidth + 1; })()"), true, 'no sideways scroll inside');
      await assertReachable(p, ['.modal-back:last-child .modal-foot button']);
      await p.tap('.modal-back:last-child .modal-foot button');
      await p.waitGone('.modal-back');
    }, { fresh: PHONE });
  }

  t.test('the dialogs also fit the smallest phone', async (p) => {
    for (const [name, js] of DIALOGS) {
      await p.ev('void ' + js);
      await p.waitModal();
      const r = await p.rect('.modal-back:last-child .modal');
      p.assert.ok(r.x >= 0 && r.right <= 320.5 && r.bottom <= 568.5, name + ' ' + JSON.stringify(r));
      await p.key('Escape');
      await p.waitGone('.modal-back');
    }
  }, { fresh: { width: 320, height: 568, mobile: true, touch: true }, timeout: 40000 });

  // ---- tours move between views -----------------------------------------------------------------
  t.test('the welcome tour moves to the view of each step', async (p) => {
    await p.ev("LG.Tours.start(LG.app, 'welcome')");
    await p.wait("!!document.querySelector('.tour-pop')");
    const seen = [];
    for (let i = 0; i < 9; i++) {
      await p.ev('LG.Tours.next()');
      await p.sleep(60);
      seen.push(await p.ev('document.body.dataset.view'));
    }
    // world, command center, input, editor, run, speed, inspector, rail, end
    p.assert.deepEqual(seen.slice(0, 4), ['turtle', 'turtle', 'turtle', 'code']);
    p.assert.equal(seen[6], 'debug');
    await p.ev('LG.Tours.stop()');
  }, { fresh: PHONE });

  t.test('each tour step on a phone has its target on screen or sits in the middle', async (p) => {
    await p.ev("LG.Tours.start(LG.app, 'turtle')");
    for (let i = 0; i < 6; i++) {
      await p.sleep(300);
      const r = await p.rect('.tour-pop');
      p.assert.ok(r.x >= 0 && r.right <= 390.5 && r.y >= 0 && r.bottom <= 844.5, 'step ' + i + ' ' + JSON.stringify(r));
      const sel = await p.ev('LG.Tours.active.tour.steps[LG.Tours.active.i].sel || ""');
      const target = sel ? await p.fn((s) => [...document.querySelectorAll(s)].some((x) => x.getBoundingClientRect().width > 0), sel) : false;
      if (!target) p.assert.ok(Math.abs(r.x + r.w / 2 - 195) < 2, 'with nothing to point at, step ' + i + ' sits in the middle');
      await p.ev('LG.Tours.next()');
    }
    await p.ev('LG.Tours.stop()');
  }, { fresh: PHONE });

  t.test('the files tour opens the Files view', async (p) => {
    await p.ev("LG.Tours.start(LG.app, 'files')");
    await p.wait("document.body.dataset.view === 'files'");
    p.assert.ok(await p.visible('#side'));
    await p.ev('LG.Tours.stop()');
  }, { fresh: PHONE });

  t.test('the debugger tour shows the Code view for the margin step', async (p) => {
    await p.ev("LG.Tours.start(LG.app, 'debug')");
    await p.wait("!!document.querySelector('.tour-pop')");
    await p.ev('LG.Tours.next()');
    await p.wait("document.body.dataset.view === 'code'");
    p.assert.ok(await p.ev("[...document.querySelectorAll('#editors .ed-gutter')].some(g => g.getBoundingClientRect().width > 0)"));
    await p.ev('LG.Tours.stop()');
  }, { fresh: PHONE });

  t.test('the tour buttons can be tapped on a phone', async (p) => {
    await p.ev("LG.Tours.start(LG.app, 'welcome')");
    await p.wait("!!document.querySelector('.tour-pop')");
    await assertReachable(p, ['#tourNext', '#tourClose']);
    await p.tap('#tourNext');
    await p.wait("/2 of/.test(document.querySelector('.tour-pop .step').textContent)");
    await p.tap('#tourClose');
    p.assert.equal(await p.exists('.tour-pop'), false);
  }, { fresh: PHONE });

  t.test('the first visit tour starts on a phone too', async (p) => {
    await p.wait("!!document.querySelector('.tour-pop')", 4000);
    const r = await p.rect('.tour-pop');
    p.assert.ok(r.right <= 390.5 && r.bottom <= 844.5);
    await p.tap('#tourClose');
  }, { fresh: Object.assign({ firstRun: true }, PHONE) });
}
