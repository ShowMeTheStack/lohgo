// The ☰ menu: every item with its shortcut, which items are enabled when idle, running or
// paused, the checkbox items, and what each item does.
import { transcript, resetPrompt } from './10-lang-lib.mjs';

const EXPECTED = [
  ['Program', [
    ['New program', 'Alt+N'], ['Open…', 'Ctrl+O'], ['Save', 'Ctrl+S'], ['Save as…', 'Ctrl+Shift+S'],
    ['Share as a link…', ''], ['Open a shared program…', ''], ['Download this file', ''], ['Close', 'Alt+W'],
  ]],
  ['Run', [
    ['Run', 'F5'], ['Pause', 'Ctrl+Break'], ['Stop', 'Shift+F5'], ['Step into', 'F11'], ['Step over', 'F10'],
    ['Step out', 'Shift+F11'], ['Toggle breakpoint', 'F9'], ['Remove all breakpoints', ''], ['Fresh start on every run', ''],
  ]],
  ['Turtle', [
    ['Clear the drawing (CS)', ''], ['Graph paper grid', ''], ['Big turtle world', 'F4'], ['Turtle speed', ''],
    ['Save the drawing as a picture', ''], ['Classic triangle turtle', ''],
  ]],
  ['Help', [
    ['Learn Logo (lessons)', ''], ['Program library', ''], ['Guided tours', ''], ['Language reference', 'F1'],
    ['Keyboard shortcuts', ''], ['Colours and themes…', ''], ['About Lohgo', ''],
  ]],
];

async function openMenu(p) {
  await p.click('#menuBtn');
  await p.wait("!!document.querySelector('.menu-pop')", 3000);
}
/** The open menu as [{label, sc, disabled, checked}] by its visible text */
const items = (p) => p.ev("[...document.querySelectorAll('.menu-pop .menu-item')].map((e) => ({ label: e.children[0].textContent, sc: e.querySelector('.sc') ? e.querySelector('.sc').textContent : '', disabled: e.classList.contains('disabled'), checked: e.classList.contains('checked') }))");
async function item(p, label) {
  await openMenu(p);
  const all = await items(p);
  await p.closeMenus();
  const it = all.find((x) => x.label === label);
  if (!it) throw new Error('no menu item ' + label);
  return it;
}
/** Click a menu item by its exact label */
async function pick(p, label) {
  await openMenu(p);
  const ok = await p.fn((l) => { const e = [...document.querySelectorAll('.menu-pop .menu-item')].find((x) => x.children[0].textContent === l); if (!e) return false; e.setAttribute('data-pick', '1'); return true; }, label);
  if (!ok) throw new Error('no menu item ' + label);
  await p.click('.menu-pop .menu-item[data-pick]');
  await p.sleep(150);
}
const fullscreen = (p) => p.ev("document.getElementById('worldCard').classList.contains('fullscreen')");
async function idle(p) {
  await resetPrompt(p);
  await p.ev("LG.Tours && LG.Tours.stop && LG.Tours.stop(); LG.app.clearBreakpoints(); LG.app.toggleBigWorld(false)");
  await p.sleep(30);
}
async function startRunning(p) {
  await p.runProgram('forever [wait 5]\n', { path: '/projects/menurun.lgo', wait: false });
  await p.waitState(['running', 'waiting']);
}
async function startPaused(p) {
  await p.newFile('/projects/menupause.lgo', 'to f :n\nif :n = 0 [stop]\nprint :n\nf :n - 1\nend\nf 2\n');
  await p.ev("LG.app.toggleBreakpoint('/projects/menupause.lgo', 2)");
  await p.ev('LG.app.runActive()');
  await p.waitState('paused');
}

export default function (t) {
  t.beforeEach(idle);

  // ---- what is in the menu ------------------------------------------------------------------------
  t.test('the menu button opens the menu and has a label', async (p) => {
    p.assert.equal(await p.attr('#menuBtn', 'aria-label'), 'Menu');
    await openMenu(p);
    p.assert.equal(await p.visible('.menu-pop'), true);
    await p.closeMenus();
  });
  t.test('the menu has the four section headings in order', async (p) => {
    await openMenu(p);
    const heads = await p.ev("[...document.querySelectorAll('.menu-pop .menu-head')].map((e) => e.textContent)");
    p.assert.deepEqual(heads, EXPECTED.map((x) => x[0]));
    await p.closeMenus();
  });
  t.test('the menu lists every item in order', async (p) => {
    await openMenu(p);
    p.assert.deepEqual((await items(p)).map((x) => x.label), EXPECTED.flatMap((x) => x[1].map((y) => y[0])));
    await p.closeMenus();
  });
  for (const [, list] of EXPECTED) {
    for (const [label, sc] of list) {
      t.test(`menu item "${label}" shows ${sc ? 'the shortcut ' + sc : 'no shortcut'}`, async (p) => {
        p.assert.equal((await item(p, label)).sc, sc);
      });
    }
  }
  t.test('the shortcuts in the menu match the keyboard shortcuts dialog', async (p) => {
    await pick(p, 'Keyboard shortcuts');
    const text = await p.modalText();
    for (const sc of ['F5', 'Shift+F5', 'Ctrl+Break', 'F10', 'Shift+F11', 'F9', 'F4', 'F1', 'Ctrl+S', 'Ctrl+Shift+S', 'Ctrl+O', 'Alt+N', 'Alt+W']) p.assert.ok(text.includes(sc), sc);
  });
  t.test('the menu stays inside the window', async (p) => {
    await openMenu(p);
    const r = await p.rect('.menu-pop');
    p.assert.ok(r.x >= 0 && r.right <= 1400 && r.y >= 0 && r.bottom <= 900, JSON.stringify(r));
    await p.closeMenus();
  });

  // ---- enabled and disabled ---------------------------------------------------------------------------
  t.test('when idle: Run and stepping are on, Pause, Stop and Step out are off', async (p) => {
    await openMenu(p);
    const all = await items(p);
    await p.closeMenus();
    const dis = Object.fromEntries(all.map((x) => [x.label, x.disabled]));
    p.assert.deepEqual([dis.Run, dis.Pause, dis.Stop, dis['Step into'], dis['Step over'], dis['Step out']], [false, true, true, false, false, true]);
  });
  t.test('when idle with a program open, the file items are on', async (p) => {
    await openMenu(p);
    const all = await items(p);
    await p.closeMenus();
    for (const l of ['New program', 'Open…', 'Save', 'Save as…', 'Share as a link…', 'Download this file', 'Close', 'Toggle breakpoint']) {
      p.assert.equal(all.find((x) => x.label === l).disabled, false, l);
    }
  });
  t.test('while running: Pause and Stop are on, Run and stepping are off', async (p) => {
    await startRunning(p);
    await openMenu(p);
    const all = await items(p);
    await p.closeMenus();
    const dis = Object.fromEntries(all.map((x) => [x.label, x.disabled]));
    p.assert.deepEqual([dis.Run, dis.Pause, dis.Stop, dis['Step into'], dis['Step over'], dis['Step out']], [true, false, false, true, true, true]);
    await p.stopProgram();
  });
  t.test('while paused: Run becomes Continue and every step item is on', async (p) => {
    await startPaused(p);
    await openMenu(p);
    const all = await items(p);
    await p.closeMenus();
    const dis = Object.fromEntries(all.map((x) => [x.label, x.disabled]));
    p.assert.equal(dis.Run, undefined);
    p.assert.deepEqual([dis.Continue, dis.Pause, dis.Stop, dis['Step into'], dis['Step over'], dis['Step out']], [false, true, false, false, false, false]);
    await p.stopProgram();
  });
  t.test('after an error: Stop is on and Step out is off', async (p) => {
    await p.runProgram('foo\n', { path: '/projects/menuerr.lgo' });
    const st = await item(p, 'Stop');
    p.assert.equal(st.disabled, false);
    p.assert.equal((await item(p, 'Step out')).disabled, true);
    p.assert.equal((await item(p, 'Run')).disabled, false);
  });
  t.test('with no program open the file items are off', async (p) => {
    await p.ev('(async () => { for (const d of LG.app.docs.slice()) { d.dirty = false; await LG.app.closeDoc(d); } })()');
    await p.sleep(100);
    await openMenu(p);
    const all = await items(p);
    await p.closeMenus();
    for (const l of ['Save', 'Save as…', 'Share as a link…', 'Download this file', 'Close', 'Toggle breakpoint']) {
      p.assert.equal(all.find((x) => x.label === l).disabled, true, l);
    }
    for (const l of ['New program', 'Open…', 'Open a shared program…', 'Run']) p.assert.equal(all.find((x) => x.label === l).disabled, false, l);
    await p.newFile('/projects/back.lgo', 'print 1\n');
  });
  t.test('clicking a disabled item does nothing', async (p) => {
    await openMenu(p);
    await p.click('.menu-pop .menu-item.disabled', 'Pause');
    await p.sleep(100);
    p.assert.equal(await p.state(), 'idle');
    p.assert.equal(await p.exists('.menu-pop'), true);
    await p.closeMenus();
  });

  // ---- keyboard in the menu ----------------------------------------------------------------------------
  t.test('Escape closes the menu', async (p) => {
    await openMenu(p);
    await p.key('Escape');
    p.assert.equal(await p.exists('.menu-pop'), false);
  });
  t.test('clicking outside closes the menu', async (p) => {
    await openMenu(p);
    await p.sleep(30);
    await p.click('#transcript');
    p.assert.equal(await p.exists('.menu-pop'), false);
  });
  t.test('arrow keys move through enabled items and Enter picks one', async (p) => {
    await openMenu(p);
    await p.key('ArrowUp');
    p.assert.equal(await p.ev("document.querySelector('.menu-pop .menu-item.active').children[0].textContent"), 'About Lohgo');
    await p.key('Enter');
    await p.waitModal();
    p.assert.equal(await p.modalTitle(), 'About Lohgo');
  });
  t.test('ArrowDown skips disabled items', async (p) => {
    await openMenu(p);
    const labels = [];
    for (let i = 0; i < 11; i++) { await p.key('ArrowDown'); labels.push(await p.ev("document.querySelector('.menu-pop .menu-item.active').children[0].textContent")); }
    await p.closeMenus();
    p.assert.ok(!labels.includes('Pause') && !labels.includes('Stop') && !labels.includes('Step out'), labels.join(','));
    p.assert.equal(labels[0], 'New program');
  });

  // ---- checkbox items -------------------------------------------------------------------------------------
  t.test('Fresh start on every run is checked by default', async (p) => {
    p.assert.equal((await item(p, 'Fresh start on every run')).checked, true);
  });
  t.test('Fresh start on every run toggles, persists and changes what a run keeps', async (p) => {
    await pick(p, 'Fresh start on every run');
    p.assert.equal((await item(p, 'Fresh start on every run')).checked, false);
    p.assert.equal(await p.ev("JSON.parse(localStorage.getItem('lohgo.settings')).freshRun"), false);
    await p.command('make "keptvar 5');
    await p.runProgram('print :keptvar\n', { path: '/projects/fresh.lgo' });
    p.assert.match(await transcript(p), /\n5\n$/);
    await p.reload();
    p.assert.equal((await item(p, 'Fresh start on every run')).checked, false);
    await pick(p, 'Fresh start on every run');
    p.assert.equal((await item(p, 'Fresh start on every run')).checked, true);
    await p.command('make "keptvar 5');
    await p.runProgram('print :keptvar\n', { path: '/projects/fresh.lgo' });
    p.assert.match(await transcript(p), /keptvar has no value/);
  });
  t.test('Graph paper grid toggles the grid and remembers it', async (p) => {
    p.assert.equal((await item(p, 'Graph paper grid')).checked, false);
    await pick(p, 'Graph paper grid');
    p.assert.equal(await p.ev('LG.app.turtleView.grid'), true);
    p.assert.equal((await item(p, 'Graph paper grid')).checked, true);
    p.assert.equal(await p.ev("document.getElementById('tbGrid').classList.contains('on')"), true);
    await p.reload();
    p.assert.equal((await item(p, 'Graph paper grid')).checked, true);
    await pick(p, 'Graph paper grid');
    p.assert.equal(await p.ev('LG.app.turtleView.grid'), false);
    p.assert.equal((await item(p, 'Graph paper grid')).checked, false);
  });
  t.test('Classic triangle turtle toggles the turtle style and remembers it', async (p) => {
    p.assert.equal((await item(p, 'Classic triangle turtle')).checked, false);
    await pick(p, 'Classic triangle turtle');
    p.assert.equal(await p.ev('LG.app.settings.turtleStyle'), 'classic');
    await p.reload();
    p.assert.equal((await item(p, 'Classic triangle turtle')).checked, true);
    await pick(p, 'Classic triangle turtle');
    p.assert.equal(await p.ev('LG.app.settings.turtleStyle'), 'turtle');
    p.assert.equal((await item(p, 'Classic triangle turtle')).checked, false);
  });

  // ---- actions -------------------------------------------------------------------------------------------
  t.test('New program asks for a name and opens the new file', async (p) => {
    await pick(p, 'New program');
    p.assert.equal(await p.waitModal(), 'New program');
    await p.modalInput('menunew');
    await p.modalButton('OK');
    await p.sleep(100);
    p.assert.equal(await p.activePath(), '/projects/menunew.lgo');
    p.assert.equal(await p.ev("LG.app.vfs.exists('/projects/menunew.lgo')"), true);
  });
  t.test('New program can be cancelled', async (p) => {
    const before = await p.ev('LG.app.docs.length');
    await pick(p, 'New program');
    await p.waitModal();
    await p.modalButton('Cancel');
    p.assert.equal(await p.ev('LG.app.docs.length'), before);
    p.assert.equal(await p.modalOpen(), false);
  });
  t.test('Open… lists programs and opens the one picked', async (p) => {
    await p.ev("LG.app.vfs.writeText('/projects/openme.lgo', 'print 1\\n', { trusted: true })");
    await pick(p, 'Open…');
    p.assert.equal(await p.waitModal(), 'Open a program');
    await p.modalInput('openme');
    await p.click('.modal .list-row', 'openme.lgo');
    await p.sleep(100);
    p.assert.equal(await p.activePath(), '/projects/openme.lgo');
  });
  t.test('Save writes the program to its file', async (p) => {
    await p.newFile('/projects/menusave.lgo', 'print 1\n');
    await p.setCode('print "saved\n');
    p.assert.equal(await p.ev('LG.app.active.dirty'), true);
    await pick(p, 'Save');
    p.assert.equal(await p.ev("LG.app.vfs.readText('/projects/menusave.lgo')"), 'print "saved\n');
    p.assert.equal(await p.ev('LG.app.active.dirty'), false);
    p.assert.equal(await p.status(), 'Saved /projects/menusave.lgo');
  });
  t.test('Save as… saves under a new name', async (p) => {
    await p.newFile('/projects/menusa.lgo', 'print 2\n');
    await pick(p, 'Save as…');
    p.assert.equal(await p.waitModal(), 'Save as');
    await p.modalInput('menusa2');
    await p.modalButton('OK');
    await p.sleep(100);
    p.assert.equal(await p.activePath(), '/projects/menusa2.lgo');
    p.assert.equal(await p.ev("LG.app.vfs.readText('/projects/menusa2.lgo')"), 'print 2\n');
  });
  t.test('Share as a link… opens the share dialog for the program', async (p) => {
    await p.newFile('/projects/menushare.lgo', 'print 3\n');
    await pick(p, 'Share as a link…');
    p.assert.equal(await p.waitModal(), 'Share menushare');
  });
  t.test('Open a shared program… asks for a link', async (p) => {
    await pick(p, 'Open a shared program…');
    p.assert.equal(await p.waitModal(), 'Open a shared program');
  });
  t.test('Download this file downloads the program', async (p) => {
    await p.newFile('/projects/menudl.lgo', 'print 4\n');
    await p.ev("window.__dl = []; window.__dlOrig = LG.UI.download; LG.UI.download = (name, data, type) => window.__dl.push([name, new TextDecoder().decode(data), type])");
    await pick(p, 'Download this file');
    const dl = await p.ev('window.__dl');
    await p.ev('LG.UI.download = window.__dlOrig');
    p.assert.deepEqual(dl, [['menudl.lgo', 'print 4\n', 'text/plain']]);
  });
  t.test('Close closes the program', async (p) => {
    await p.newFile('/projects/menuclose.lgo', 'print 5\n');
    await pick(p, 'Close');
    p.assert.equal(await p.ev("!!LG.app.docByPath('/projects/menuclose.lgo')"), false);
  });
  t.test('Close asks first when there are unsaved changes', async (p) => {
    await p.newFile('/projects/menuclose2.lgo', 'print 5\n');
    await p.ev('LG.app.settings.autosave = false');
    await p.setCode('print 6\n');
    await pick(p, 'Close');
    p.assert.equal(await p.waitModal(), 'Save changes?');
    await p.modalButton('Cancel');
    p.assert.equal(await p.ev("!!LG.app.docByPath('/projects/menuclose2.lgo')"), true);
    await p.ev('LG.app.settings.autosave = true');
  });
  t.test('Run runs the program in the editor', async (p) => {
    await p.newFile('/projects/menurun2.lgo', 'print "fromrun\n');
    await pick(p, 'Run');
    await p.waitState('idle');
    p.assert.match(await transcript(p), /▶ Running menurun2\.lgo\nfromrun\n/);
  });
  t.test('Pause pauses a running program', async (p) => {
    await startRunning(p);
    await pick(p, 'Pause');
    await p.waitState('paused');
    p.assert.equal(await p.ev("document.getElementById('state').textContent"), 'Paused');
    await p.stopProgram();
  });
  t.test('Stop stops a running program', async (p) => {
    await startRunning(p);
    await pick(p, 'Stop');
    await p.waitState('idle');
    p.assert.match(await transcript(p), /Stopped\.\n$/);
  });
  t.test('Continue carries on a paused program', async (p) => {
    await startPaused(p);
    await p.ev('LG.app.clearBreakpoints()');
    await pick(p, 'Continue');
    await p.waitState('idle');
    p.assert.match(await transcript(p), /2\n1\n$/);
  });
  t.test('Step into starts the program paused at the first instruction', async (p) => {
    await p.newFile('/projects/menustep.lgo', 'print 1\nprint 2\n');
    await pick(p, 'Step into');
    await p.waitState('paused');
    p.assert.equal(await p.ev('LG.app.active.editor.marks.exec'), 0);
    await pick(p, 'Step over');
    await p.waitState('paused');
    p.assert.equal(await p.ev('LG.app.active.editor.marks.exec'), 1);
    p.assert.match(await transcript(p), /1\n$/);
    await p.stopProgram();
  });
  t.test('Step over does not stop inside a procedure', async (p) => {
    await p.newFile('/projects/menuover.lgo', 'to f\nprint "inside\nend\nf\nprint "after\n');
    await p.ev("LG.app.toggleBreakpoint('/projects/menuover.lgo', 3)");
    await p.ev('LG.app.runActive()');
    await p.waitState('paused');
    await pick(p, 'Step over');
    await p.waitState('paused');
    p.assert.equal(await p.ev('LG.app.active.editor.marks.exec'), 4);
    p.assert.match(await transcript(p), /inside\n$/);
    await p.stopProgram();
  });
  t.test('Step out finishes the procedure and pauses in its caller', async (p) => {
    await p.newFile('/projects/menuout.lgo', 'to f\nprint "a\nprint "b\nend\nf\nprint "c\n');
    await p.ev("LG.app.toggleBreakpoint('/projects/menuout.lgo', 1)");
    await p.ev('LG.app.runActive()');
    await p.waitState('paused');
    await p.ev('LG.app.clearBreakpoints()');
    await pick(p, 'Step out');
    await p.waitState('paused');
    p.assert.match(await transcript(p), /a\nb\n$/);
    p.assert.equal(await p.ev('LG.app.active.editor.marks.exec'), 5);
    await p.stopProgram();
  });
  t.test('Toggle breakpoint sets and clears a breakpoint on the cursor line', async (p) => {
    await p.newFile('/projects/menubp.lgo', 'print 1\nprint 2\nprint 3\n');
    await p.ev('LG.app.active.editor.setCursor(1, 0)');
    await pick(p, 'Toggle breakpoint');
    p.assert.deepEqual(await p.ev("[...(LG.app.breakpoints.get('/projects/menubp.lgo') || new Map()).keys()]"), [1]);
    await pick(p, 'Toggle breakpoint');
    p.assert.deepEqual(await p.ev("[...(LG.app.breakpoints.get('/projects/menubp.lgo') || new Map()).keys()]"), []);
  });
  t.test('Remove all breakpoints removes them from every file', async (p) => {
    await p.newFile('/projects/menubp2.lgo', 'print 1\nprint 2\n');
    await p.ev("LG.app.toggleBreakpoint('/projects/menubp2.lgo', 0); LG.app.toggleBreakpoint('/projects/menubp2.lgo', 1); LG.app.toggleBreakpoint('/projects/menubp.lgo', 0)");
    await pick(p, 'Remove all breakpoints');
    p.assert.equal(await p.ev('LG.app.breakpoints.size'), 0);
  });
  t.test('Clear the drawing clears the screen and says so', async (p) => {
    await p.command('fd 50 rt 90 fd 20');
    p.assert.ok(await p.segments() > 0);
    await resetPrompt(p);
    await pick(p, 'Clear the drawing (CS)');
    await p.waitState('idle');
    p.assert.equal(await p.segments(), 0);
    const tt = await p.turtle();
    p.assert.deepEqual([tt.x, tt.y, tt.heading], [0, 0, 0]);
    p.assert.equal(await transcript(p), 'clearscreen\n');
  });
  t.test('Big turtle world makes the world full size, Escape brings it back', async (p) => {
    await pick(p, 'Big turtle world');
    p.assert.equal(await fullscreen(p), true);
    await p.key('Escape');
    p.assert.equal(await fullscreen(p), false);
  });
  t.test('Save the drawing as a picture downloads a PNG named after the program', async (p) => {
    await p.newFile('/projects/menupic.lgo', 'fd 10\n');
    await p.ev("window.__dl = []; window.__dlOrig = LG.UI.download; LG.UI.download = (name, data, type) => window.__dl.push([name, data.length > 100, type, data[1], data[2], data[3]])");
    await pick(p, 'Save the drawing as a picture');
    const dl = await p.ev('window.__dl');
    await p.ev('LG.UI.download = window.__dlOrig');
    p.assert.deepEqual(dl, [['menupic.png', true, 'image/png', 80, 78, 71]]);
  });
  t.test('Learn Logo opens the lessons', async (p) => {
    await pick(p, 'Learn Logo (lessons)');
    p.assert.equal(await p.waitModal(), 'Learn Logo');
  });
  t.test('Program library opens the library', async (p) => {
    await pick(p, 'Program library');
    p.assert.equal(await p.waitModal(), 'Program library');
  });
  t.test('Guided tours opens a menu of tours', async (p) => {
    await pick(p, 'Guided tours');
    await p.wait("!!document.querySelector('.menu-pop')");
    const labels = await p.ev("[...document.querySelectorAll('.menu-pop .menu-item')].map((e) => e.children[0].textContent)");
    p.assert.ok(labels.length >= 2, labels.join(','));
    p.assert.equal(labels[labels.length - 1], 'All the lessons…');
    await p.closeMenus();
  });
  t.test('Language reference opens the reference', async (p) => {
    await pick(p, 'Language reference');
    p.assert.equal(await p.waitModal(), 'Logo reference');
  });
  t.test('Keyboard shortcuts lists the shortcuts', async (p) => {
    await pick(p, 'Keyboard shortcuts');
    p.assert.equal(await p.waitModal(), 'Keyboard shortcuts');
    p.assert.match(await p.modalText(), /F5\s+Run, or continue a paused program/);
  });
  t.test('Colours and themes… opens the settings', async (p) => {
    await pick(p, 'Colours and themes…');
    p.assert.equal(await p.waitModal(), 'Looks and settings');
  });
  t.test('About Lohgo shows the about box', async (p) => {
    await pick(p, 'About Lohgo');
    p.assert.equal(await p.waitModal(), 'About Lohgo');
    p.assert.match(await p.modalText(), /Jyotiprakash Mishra/);
  });
}
