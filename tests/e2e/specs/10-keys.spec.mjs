// Keyboard shortcuts: running and debugging keys, files, zoom, focus, Escape, and how keys
// behave while a dialog is open.
import { transcript, resetPrompt } from './10-lang-lib.mjs';

const fullscreen = (p) => p.ev("document.getElementById('worldCard').classList.contains('fullscreen')");
const execLine = (p) => p.ev('LG.app.active.editor.marks.exec');
const bps = (p, path) => p.ev(`[...(LG.app.breakpoints.get(${JSON.stringify(path)}) || new Map()).keys()]`);
async function focusEditor(p, line = 0) {
  await p.click('#editors .ed-ta');
  await p.ev(`LG.app.active.editor.setCursor(${line}, 0)`);
  await p.sleep(30);
}
async function idle(p) {
  await resetPrompt(p);
  await p.ev("LG.app.clearBreakpoints(); LG.app.toggleBigWorld(false); LG.app.settings.fontSize = 14; LG.app.applyTheme()");
  await p.sleep(30);
}
async function startRunning(p) {
  await p.runProgram('forever [wait 5]\n', { path: '/projects/keysrun.lgo', wait: false });
  await p.waitState(['running', 'waiting']);
}

export default function (t) {
  t.beforeEach(idle);

  // ---- running ------------------------------------------------------------------------------------------
  t.test('F5 runs the program in the editor', async (p) => {
    await p.newFile('/projects/k1.lgo', 'print "f5ran\n');
    await focusEditor(p);
    await p.key('F5');
    await p.waitState('idle');
    p.assert.match(await transcript(p), /▶ Running k1\.lgo\nf5ran\n$/);
  });
  t.test('F5 works while typing in the command center', async (p) => {
    await p.newFile('/projects/k2.lgo', 'print "fromcmd\n');
    await p.click('#cmdInput');
    await p.key('F5');
    await p.waitState('idle');
    p.assert.match(await transcript(p), /fromcmd\n$/);
  });
  t.test('F5 does not add text to the editor or the prompt', async (p) => {
    await p.newFile('/projects/k3.lgo', 'print 1\n');
    await focusEditor(p);
    await p.key('F5');
    await p.waitState('idle');
    p.assert.equal(await p.code(), 'print 1\n');
  });
  t.test('F5 continues a paused program', async (p) => {
    await p.newFile('/projects/k4.lgo', 'print 1\nprint 2\nprint 3\n');
    await p.ev("LG.app.toggleBreakpoint('/projects/k4.lgo', 1)");
    await p.key('F5');
    await p.waitState('paused');
    p.assert.match(await transcript(p), /1\n$/);
    await p.key('F5');
    await p.waitState('idle');
    p.assert.match(await transcript(p), /1\n2\n3\n$/);
  });
  t.test('F5 while a program runs does not start it again', async (p) => {
    await startRunning(p);
    const runs = await p.ev('LG.app.runCount');
    await p.key('F5');
    p.assert.equal(await p.ev('LG.app.runCount'), runs);
    await p.stopProgram();
  });
  t.test('Shift+F5 stops a running program', async (p) => {
    await startRunning(p);
    await p.key('F5', { shift: true });
    await p.waitState('idle');
    p.assert.match(await transcript(p), /Stopped\.\n$/);
  });
  t.test('Shift+F5 stops a paused program', async (p) => {
    await p.newFile('/projects/k5.lgo', 'print 1\nprint 2\n');
    await p.ev("LG.app.toggleBreakpoint('/projects/k5.lgo', 1)");
    await p.key('F5');
    await p.waitState('paused');
    await p.key('F5', { shift: true });
    await p.waitState('idle');
    p.assert.equal(await execLine(p), null);
  });
  t.test('Shift+F5 when idle does nothing', async (p) => {
    await p.key('F5', { shift: true });
    p.assert.equal(await transcript(p), '');
    p.assert.equal(await p.state(), 'idle');
  });
  t.test('Ctrl+Pause pauses a running program', async (p) => {
    await startRunning(p);
    await p.key('Pause', { ctrl: true });
    await p.waitState('paused');
    await p.stopProgram();
  });
  t.test('Pause on its own also pauses', async (p) => {
    await startRunning(p);
    await p.key('Pause');
    await p.waitState('paused');
    await p.stopProgram();
  });

  // ---- stepping ---------------------------------------------------------------------------------------------
  t.test('F11 starts stepping at the first instruction', async (p) => {
    await p.newFile('/projects/k6.lgo', 'print 1\nprint 2\n');
    await p.key('F11');
    await p.waitState('paused');
    p.assert.equal(await execLine(p), 0);
    p.assert.equal(await transcript(p), '▶ Running k6.lgo\n');
    await p.stopProgram();
  });
  t.test('F8 steps into like F11', async (p) => {
    await p.newFile('/projects/k7.lgo', 'to f\nprint "in\nend\nf\n');
    await p.key('F8');
    await p.waitState('paused');
    p.assert.equal(await execLine(p), 3);
    await p.key('F8');
    await p.waitState('paused');
    p.assert.equal(await execLine(p), 1);
    await p.stopProgram();
  });
  t.test('F11 goes into a procedure call', async (p) => {
    await p.newFile('/projects/k8.lgo', 'to f\nprint "in\nend\nf\nprint "out\n');
    await p.key('F11');
    await p.waitState('paused');
    await p.key('F11');
    await p.waitState('paused');
    p.assert.equal(await execLine(p), 1);
    await p.stopProgram();
  });
  t.test('F10 steps over a procedure call', async (p) => {
    await p.newFile('/projects/k9.lgo', 'to f\nprint "in\nend\nf\nprint "out\n');
    await p.key('F10');
    await p.waitState('paused');
    p.assert.equal(await execLine(p), 3);
    await p.key('F10');
    await p.waitState('paused');
    p.assert.equal(await execLine(p), 4);
    p.assert.match(await transcript(p), /in\n$/);
    await p.stopProgram();
  });
  t.test('Shift+F11 steps out of a procedure', async (p) => {
    await p.newFile('/projects/k10.lgo', 'to f\nprint "a\nprint "b\nend\nf\nprint "c\n');
    await p.ev("LG.app.toggleBreakpoint('/projects/k10.lgo', 1)");
    await p.key('F5');
    await p.waitState('paused');
    await p.ev('LG.app.clearBreakpoints()');
    await p.key('F11', { shift: true });
    await p.waitState('paused');
    p.assert.equal(await execLine(p), 5);
    p.assert.match(await transcript(p), /a\nb\n$/);
    await p.stopProgram();
  });
  t.test('Shift+F8 steps out like Shift+F11', async (p) => {
    await p.newFile('/projects/k11.lgo', 'to f\nprint "a\nprint "b\nend\nf\nprint "c\n');
    await p.ev("LG.app.toggleBreakpoint('/projects/k11.lgo', 1)");
    await p.key('F5');
    await p.waitState('paused');
    await p.ev('LG.app.clearBreakpoints()');
    await p.key('F8', { shift: true });
    await p.waitState('paused');
    p.assert.equal(await execLine(p), 5);
    await p.stopProgram();
  });
  t.test('Shift+F11 when idle does nothing', async (p) => {
    await p.newFile('/projects/k12.lgo', 'print 1\n');
    await p.key('F11', { shift: true });
    p.assert.equal(await p.state(), 'idle');
    p.assert.equal(await transcript(p), '');
  });
  t.test('stepping keys are ignored while the program runs', async (p) => {
    await startRunning(p);
    await p.key('F10');
    await p.key('F11');
    p.assert.ok(['running', 'waiting'].includes(await p.state()));
    await p.stopProgram();
  });
  t.test('F9 sets a breakpoint on the cursor line and F9 again removes it', async (p) => {
    await p.newFile('/projects/k13.lgo', 'print 1\nprint 2\nprint 3\n');
    await focusEditor(p, 2);
    await p.key('F9');
    p.assert.deepEqual(await bps(p, '/projects/k13.lgo'), [2]);
    p.assert.equal(await p.code(), 'print 1\nprint 2\nprint 3\n');
    await p.key('F9');
    p.assert.deepEqual(await bps(p, '/projects/k13.lgo'), []);
  });
  t.test('a breakpoint set with F9 stops the run there', async (p) => {
    await p.newFile('/projects/k14.lgo', 'print 1\nprint 2\nprint 3\n');
    await focusEditor(p, 1);
    await p.key('F9');
    await p.key('F5');
    await p.waitState('paused');
    p.assert.equal(await execLine(p), 1);
    p.assert.match(await transcript(p), /1\n$/);
    await p.stopProgram();
  });

  // ---- the world --------------------------------------------------------------------------------------------
  t.test('F4 makes the turtle world big and F4 again puts it back', async (p) => {
    await p.key('F4');
    p.assert.equal(await fullscreen(p), true);
    const r = await p.rect('#worldCard');
    p.assert.ok(r.w > 1300 && r.h > 800, JSON.stringify(r));
    await p.key('F4');
    p.assert.equal(await fullscreen(p), false);
  });
  t.test('Escape leaves the big world when nothing runs', async (p) => {
    await p.key('F4');
    await p.key('Escape');
    p.assert.equal(await fullscreen(p), false);
  });
  t.test('Escape keeps the big world while a program runs', async (p) => {
    await startRunning(p);
    await p.key('F4');
    await p.key('Escape');
    p.assert.equal(await fullscreen(p), true);
    await p.stopProgram();
    await p.key('F4');
    p.assert.equal(await fullscreen(p), false);
  });

  // ---- help ---------------------------------------------------------------------------------------------------
  t.test('F1 opens the language reference', async (p) => {
    await p.click('#cmdInput');
    await p.key('F1');
    p.assert.equal(await p.waitModal(), 'Logo reference');
    p.assert.equal(await p.focusedId(), 'helpSearch');
  });
  t.test('F1 in the editor opens help on the word under the cursor', async (p) => {
    await p.newFile('/projects/k15.lgo', 'forward 10\n');
    await focusEditor(p, 0);
    await p.ev('LG.app.active.editor.setCursor(0, 3)');
    await p.key('F1');
    p.assert.equal(await p.waitModal(), 'Logo reference');
    p.assert.match(await p.text('#helpMain'), /forward/i);
    p.assert.equal(await p.code(), 'forward 10\n');
  });

  // ---- files ----------------------------------------------------------------------------------------------------
  t.test('Ctrl+S saves the program', async (p) => {
    await p.newFile('/projects/k16.lgo', 'print 1\n');
    await p.setCode('print "ctrls\n');
    await p.key('s', { ctrl: true });
    p.assert.equal(await p.ev("LG.app.vfs.readText('/projects/k16.lgo')"), 'print "ctrls\n');
    p.assert.equal(await p.status(), 'Saved /projects/k16.lgo');
    p.assert.equal(await p.code(), 'print "ctrls\n');
  });
  t.test('Cmd+S also saves on a Mac', async (p) => {
    await p.newFile('/projects/k17.lgo', 'print 1\n');
    await p.setCode('print "cmds\n');
    await p.key('s', { meta: true });
    p.assert.equal(await p.ev("LG.app.vfs.readText('/projects/k17.lgo')"), 'print "cmds\n');
  });
  t.test('Ctrl+S on an example asks for a copy of your own', async (p) => {
    const ex = await p.ev("LG.app.vfs.walk('/examples').filter((x) => x.entry.type === 'file')[0].path");
    await p.ev(`LG.app.openFile(${JSON.stringify(ex)})`);
    await p.key('s', { ctrl: true });
    p.assert.equal(await p.waitModal(), 'Save your own copy');
  });
  t.test('Ctrl+Shift+S asks for a new name', async (p) => {
    await p.newFile('/projects/k18.lgo', 'print 1\n');
    await p.key('S', { ctrl: true, shift: true });
    p.assert.equal(await p.waitModal(), 'Save as');
    await p.modalInput('k18b');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.equal(await p.activePath(), '/projects/k18b.lgo');
  });
  t.test('Ctrl+O opens the open dialog with the cursor in the filter', async (p) => {
    await p.key('o', { ctrl: true });
    p.assert.equal(await p.waitModal(), 'Open a program');
    await p.sleep(60);
    p.assert.equal(await p.ev("document.activeElement.placeholder"), 'Type to find a program');
  });
  t.test('typing in the open dialog filters and Enter opens the first match', async (p) => {
    await p.ev("LG.app.vfs.writeText('/projects/keyopen.lgo', 'print 1\\n', { trusted: true })");
    await p.key('o', { ctrl: true });
    await p.waitModal();
    await p.sleep(60);
    await p.type('keyopen');
    p.assert.equal(await p.count('.modal .list-row'), 1);
    await p.key('Enter');
    await p.sleep(120);
    p.assert.equal(await p.activePath(), '/projects/keyopen.lgo');
    p.assert.equal(await p.modalOpen(), false);
  });
  t.test('Alt+N asks for the name of a new program', async (p) => {
    await p.key('n', { alt: true });
    p.assert.equal(await p.waitModal(), 'New program');
    await p.modalInput('keynew');
    await p.key('Enter');
    await p.sleep(120);
    p.assert.equal(await p.activePath(), '/projects/keynew.lgo');
  });
  t.test('Alt+W closes the program', async (p) => {
    await p.newFile('/projects/k19.lgo', 'print 1\n');
    await p.key('w', { alt: true });
    await p.sleep(80);
    p.assert.equal(await p.ev("!!LG.app.docByPath('/projects/k19.lgo')"), false);
  });

  // ---- zoom and focus ------------------------------------------------------------------------------------------
  t.test('Ctrl+= makes the code bigger and Ctrl+- smaller', async (p) => {
    await p.key('=', { ctrl: true });
    p.assert.equal(await p.ev('LG.app.settings.fontSize'), 15);
    p.assert.equal(await p.ev("document.documentElement.style.getPropertyValue('--code-size')"), '15px');
    await p.key('-', { ctrl: true });
    await p.key('-', { ctrl: true });
    p.assert.equal(await p.ev('LG.app.settings.fontSize'), 13);
  });
  t.test('the code size is remembered', async (p) => {
    await p.key('=', { ctrl: true });
    p.assert.equal(await p.ev("JSON.parse(localStorage.getItem('lohgo.settings')).fontSize"), 15);
  });
  t.test('the code size stops at its limits', async (p) => {
    for (let i = 0; i < 20; i++) await p.key('=', { ctrl: true, after: 5 });
    p.assert.equal(await p.ev('LG.app.settings.fontSize'), 26);
    for (let i = 0; i < 30; i++) await p.key('-', { ctrl: true, after: 5 });
    p.assert.equal(await p.ev('LG.app.settings.fontSize'), 10);
  });
  t.test('Ctrl+` puts the cursor in the command center', async (p) => {
    await focusEditor(p);
    await p.key('`', { ctrl: true });
    p.assert.equal(await p.focusedId(), 'cmdInput');
    p.assert.doesNotMatch(await p.code(), /`/);
  });

  // ---- Escape ------------------------------------------------------------------------------------------------------
  t.test('Escape closes a dialog and gives focus back', async (p) => {
    await p.click('#cmdInput');
    await p.key('o', { ctrl: true });
    await p.waitModal();
    await p.key('Escape');
    p.assert.equal(await p.modalOpen(), false);
    p.assert.equal(await p.focusedId(), 'cmdInput');
  });
  t.test('Escape closes only the top dialog', async (p) => {
    await p.ev('LG.app.aboutDialog()');
    await p.waitModal();
    await p.ev('LG.app.shortcutsDialog()');
    await p.sleep(80);
    p.assert.equal(await p.count('.modal-back'), 2);
    await p.key('Escape');
    p.assert.equal(await p.count('.modal-back'), 1);
    p.assert.equal(await p.modalTitle(), 'About Lohgo');
    await p.key('Escape');
    p.assert.equal(await p.modalOpen(), false);
  });
  t.test('Escape closes the menu without running anything', async (p) => {
    await p.click('#menuBtn');
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.key('Escape');
    p.assert.equal(await p.exists('.menu-pop'), false);
    p.assert.equal(await p.modalOpen(), false);
  });
  t.test('Escape in the command center empties the input', async (p) => {
    await p.click('#cmdInput');
    await p.type('fd 100');
    await p.key('Escape');
    p.assert.equal(await p.ev("document.getElementById('cmdInput').value"), '');
    p.assert.equal(await transcript(p), '');
  });

  // ---- dialogs and keys --------------------------------------------------------------------------------------------
  t.test('F5 does nothing while a dialog is open', async (p) => {
    await p.newFile('/projects/k20.lgo', 'print "shouldnotrun\n');
    await p.ev('LG.app.aboutDialog()');
    await p.waitModal();
    await p.key('F5');
    await p.sleep(80);
    p.assert.equal(await transcript(p), '');
    p.assert.equal(await p.state(), 'idle');
  });
  t.test('Ctrl+S does not save while a dialog is open', async (p) => {
    await p.newFile('/projects/k21.lgo', 'print 1\n');
    await p.ev('LG.app.settings.autosave = false');
    await p.setCode('print 2\n');
    await p.ev('LG.app.aboutDialog()');
    await p.waitModal();
    await p.key('s', { ctrl: true });
    p.assert.equal(await p.ev("LG.app.vfs.readText('/projects/k21.lgo')"), 'print 1\n');
    p.assert.equal(await p.modalTitle(), 'About Lohgo');
    await p.key('Escape');
    await p.ev('LG.app.settings.autosave = true');
  });
  t.test('F4 and Alt+N are ignored while a dialog is open', async (p) => {
    await p.ev('LG.app.aboutDialog()');
    await p.waitModal();
    await p.key('F4');
    await p.key('n', { alt: true });
    p.assert.equal(await fullscreen(p), false);
    p.assert.equal(await p.count('.modal-back'), 1);
  });
  t.test('keys typed in a dialog reach its input and not the editor', async (p) => {
    await p.newFile('/projects/k22.lgo', 'print 1\n');
    await focusEditor(p);
    await p.key('n', { alt: true });
    await p.waitModal();
    await p.sleep(40);
    await p.ev("document.querySelector('.modal input').select()");
    await p.type('typed');
    p.assert.equal(await p.ev("document.querySelector('.modal input').value"), 'typed');
    p.assert.equal(await p.code(), 'print 1\n');
    await p.key('Escape');
  });
  t.test('Tab keeps focus inside a dialog', async (p) => {
    await p.key('n', { alt: true });
    await p.waitModal();
    await p.sleep(40);
    for (let i = 0; i < 6; i++) {
      await p.key('Tab');
      p.assert.equal(await p.ev("!!document.activeElement.closest('.modal')"), true, 'after Tab ' + (i + 1));
    }
    await p.key('Tab', { shift: true });
    p.assert.equal(await p.ev("!!document.activeElement.closest('.modal')"), true);
  });
  t.test('Enter in a dialog presses its main button', async (p) => {
    await p.ev('LG.app.aboutDialog()');
    await p.waitModal();
    await p.key('Enter');
    p.assert.equal(await p.modalOpen(), false);
  });
  t.test('clicking outside a dialog closes it', async (p) => {
    await p.ev('LG.app.shortcutsDialog()');
    await p.waitModal();
    await p.clickAt(5, 450);
    p.assert.equal(await p.modalOpen(), false);
  });
  t.test('shortcuts work again after a dialog closes', async (p) => {
    await p.newFile('/projects/k23.lgo', 'print "afterdialog\n');
    await p.ev('LG.app.aboutDialog()');
    await p.waitModal();
    await p.key('Escape');
    await p.key('F5');
    await p.waitState('idle');
    p.assert.match(await transcript(p), /afterdialog\n$/);
  });
  t.test('the keyboard shortcuts dialog lists every shortcut', async (p) => {
    await p.ev('LG.app.shortcutsDialog()');
    await p.waitModal();
    const keys = await p.ev("[...document.querySelectorAll('.modal kbd')].map((k) => k.textContent)");
    for (const k of ['F5', 'Shift+F5', 'Ctrl+Break', 'F11 or F8', 'F10', 'Shift+F11', 'F9', 'F4', 'F1', 'Ctrl+S', 'Ctrl+Shift+S', 'Ctrl+O', 'Alt+N', 'Alt+W', 'Ctrl+ =/-', 'Ctrl+`']) {
      p.assert.ok(keys.includes(k), k);
    }
  });
}
