// The settings checkboxes in the Looks dialog: fresh start, autosave, the grid and buried names.
// Each one changes what it says and is remembered after a reload.
import { savedSettings } from './50-ui-lib.mjs';

const openLooks = async (p) => { await p.click('#railSettings'); await p.waitModal(); };
const checked = (p, key) => p.ev(`document.getElementById('set-${key}').checked`);
async function toggle(p, key) {
  await openLooks(p);
  await p.click('#set-' + key);
  await p.modalButton('Done');
  await p.waitGone('.modal-back');
}

export default function (t) {
  t.test('the Looks dialog shows four settings with their defaults', async (p) => {
    await openLooks(p);
    const s = await p.ev("['freshRun','autosave','grid','showBuried'].map(k => [k, document.getElementById('set-' + k).checked, document.getElementById('set-' + k).closest('label').textContent.trim()])");
    p.assert.deepEqual(s.map((x) => [x[0], x[1]]), [['freshRun', true], ['autosave', true], ['grid', false], ['showBuried', false]]);
    p.assert.match(s[0][2], /Fresh start/);
    p.assert.match(s[1][2], /automatically/);
    p.assert.match(s[2][2], /grid/i);
    p.assert.match(s[3][2], /buried/i);
    await p.modalButton('Done');
  }, { fresh: true });

  t.test('clicking a setting label toggles its checkbox', async (p) => {
    await openLooks(p);
    await p.click('.modal label', 'Graph paper grid');
    p.assert.equal(await checked(p, 'grid'), true);
    await p.click('.modal label', 'Graph paper grid');
    p.assert.equal(await checked(p, 'grid'), false);
    await p.key('Escape');
  }, { fresh: true });

  t.test('Space toggles a focused setting', async (p) => {
    await openLooks(p);
    await p.ev("document.getElementById('set-showBuried').focus()");
    await p.key(' ');
    p.assert.equal(await checked(p, 'showBuried'), true);
    p.assert.equal((await savedSettings(p)).showBuried, true);
    await p.key('Escape');
  }, { fresh: true });

  // ---- fresh start -------------------------------------------------------------------------------
  t.test('with fresh start on, a run forgets procedures from the run before', async (p) => {
    await p.runProgram('to helper\nprint "hi\nend\n');
    p.assert.ok(await p.ev("LG.app.interp.procs.has('helper')"));
    await p.runProgram('print 1\n', { path: '/projects/two.lgo' });
    p.assert.equal(await p.ev("LG.app.interp.procs.has('helper')"), false);
  }, { fresh: true });

  t.test('with fresh start on, a run clears the old drawing', async (p) => {
    await p.command('fd 100');
    p.assert.equal(await p.segments(), 1);
    await p.runProgram('rt 90 fd 10\n');
    p.assert.equal(await p.segments(), 1);
    p.assert.deepEqual([(await p.turtle()).x, (await p.turtle()).y], [10, 0]);
  }, { fresh: true });

  t.test('with fresh start off, procedures and the drawing carry over', async (p) => {
    await toggle(p, 'freshRun');
    p.assert.equal((await savedSettings(p)).freshRun, false);
    await p.runProgram('to helper\nfd 10\nend\nhelper\n');
    await p.runProgram('helper\nprint "again\n', { path: '/projects/two.lgo' });
    p.assert.equal(await p.state(), 'idle');
    await p.waitOutput(/again/);
    p.assert.equal(await p.segments(), 2);
    p.assert.equal((await p.turtle()).y, 20);
  }, { fresh: true });

  t.test('with fresh start off, variables carry over too', async (p) => {
    await toggle(p, 'freshRun');
    await p.runProgram('make "kept 41\n');
    await p.runProgram('print :kept + 1\n', { path: '/projects/two.lgo' });
    await p.waitOutput(/^42$/m);
  }, { fresh: true });

  t.test('the fresh start setting shows as a tick in the menu and the menu can change it', async (p) => {
    await p.click('#menuBtn');
    await p.wait("!!document.querySelector('.menu-pop')");
    let it = (await p.menuItems()).find((x) => /Fresh start/.test(x.label));
    p.assert.equal(it.checked, true);
    await p.click('.menu-pop .menu-item', 'Fresh start');
    await p.sleep(50);
    p.assert.equal(await p.ev('LG.app.settings.freshRun'), false);
    await p.click('#menuBtn');
    await p.wait("!!document.querySelector('.menu-pop')");
    it = (await p.menuItems()).find((x) => /Fresh start/.test(x.label));
    p.assert.equal(it.checked, false);
    await p.closeMenus();
    await openLooks(p);
    p.assert.equal(await checked(p, 'freshRun'), false);
    await p.key('Escape');
  }, { fresh: true });

  t.test('fresh start off is remembered after a reload', async (p) => {
    await toggle(p, 'freshRun');
    await p.reload();
    p.assert.equal(await p.ev('LG.app.settings.freshRun'), false);
    await openLooks(p);
    p.assert.equal(await checked(p, 'freshRun'), false);
    await p.key('Escape');
  }, { fresh: true });

  // ---- autosave -------------------------------------------------------------------------------------
  t.test('with autosave on, a change is saved to the disk when the program runs', async (p) => {
    await p.newFile('/projects/auto.lgo', 'print 1\n');
    await p.setCode('print 2\n');
    p.assert.equal(await p.ev("LG.app.vfs.readText('/projects/auto.lgo')"), 'print 1\n');
    await p.click('#tbRun');
    await p.waitState('idle');
    p.assert.equal(await p.ev("LG.app.vfs.readText('/projects/auto.lgo')"), 'print 2\n');
    p.assert.equal(await p.exists('#editorTabs .etab.active .dot'), false);
  }, { fresh: true });

  t.test('with autosave on, a change is saved after a few seconds on its own', async (p) => {
    await p.newFile('/projects/auto.lgo', 'print 1\n');
    await p.setCode('print 3\n');
    p.assert.ok(await p.exists('#editorTabs .etab.active .dot'), 'shows as not saved at first');
    await p.wait("LG.app.vfs.readText('/projects/auto.lgo') === 'print 3\\n'", 6000);
    await p.wait("!document.querySelector('#editorTabs .etab.active .dot')", 1000);
  }, { fresh: true, timeout: 15000 });

  t.test('with autosave off, a run does not save the change', async (p) => {
    await toggle(p, 'autosave');
    p.assert.equal((await savedSettings(p)).autosave, false);
    await p.newFile('/projects/auto.lgo', 'print 1\n');
    await p.setCode('print 2\n');
    await p.click('#tbRun');
    await p.waitState('idle');
    await p.waitOutput(/^2$/m);
    p.assert.equal(await p.ev("LG.app.vfs.readText('/projects/auto.lgo')"), 'print 1\n');
    p.assert.ok(await p.exists('#editorTabs .etab.active .dot'), 'still marked as not saved');
  }, { fresh: true });

  t.test('with autosave off, waiting does not save either', async (p) => {
    await toggle(p, 'autosave');
    await p.newFile('/projects/auto.lgo', 'print 1\n');
    await p.setCode('print 5\n');
    await p.sleep(4600);
    p.assert.equal(await p.ev("LG.app.vfs.readText('/projects/auto.lgo')"), 'print 1\n');
    await p.key('s', { ctrl: true });
    p.assert.equal(await p.ev("LG.app.vfs.readText('/projects/auto.lgo')"), 'print 5\n');
  }, { fresh: true, timeout: 15000 });

  t.test('autosave off is remembered after a reload', async (p) => {
    await toggle(p, 'autosave');
    await p.reload();
    await openLooks(p);
    p.assert.equal(await checked(p, 'autosave'), false);
    await p.key('Escape');
  }, { fresh: true });

  // ---- grid -------------------------------------------------------------------------------------------
  t.test('the grid setting turns on graph paper and the grid button lights up', async (p) => {
    await toggle(p, 'grid');
    p.assert.equal(await p.ev('LG.app.turtleView.grid'), true);
    p.assert.ok(await p.ev("document.getElementById('tbGrid').classList.contains('on')"));
    await toggle(p, 'grid');
    p.assert.equal(await p.ev('LG.app.turtleView.grid'), false);
    p.assert.ok(!(await p.ev("document.getElementById('tbGrid').classList.contains('on')")));
  }, { fresh: true });

  t.test('the grid changes the picture in the turtle world', async (p) => {
    await p.ev('LG.app.hideWelcome()');
    const sample = () => p.ev("(() => { const tv = LG.app.turtleView; const d = tv.ctx.getImageData(tv.view.x, tv.view.y, Math.floor(tv.view.w), Math.floor(tv.view.h)).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s; })()");
    const a = await sample();
    await toggle(p, 'grid');
    const b = await sample();
    p.assert.notEqual(a, b);
  }, { fresh: true });

  t.test('the grid button and the setting agree', async (p) => {
    await p.click('#tbGrid');
    await openLooks(p);
    p.assert.equal(await checked(p, 'grid'), true);
    await p.key('Escape');
    p.assert.equal((await savedSettings(p)).grid, true);
  }, { fresh: true });

  t.test('the grid is remembered after a reload', async (p) => {
    await toggle(p, 'grid');
    await p.reload();
    p.assert.equal(await p.ev('LG.app.turtleView.grid'), true);
    p.assert.ok(await p.ev("document.getElementById('tbGrid').classList.contains('on')"));
  }, { fresh: true });

  // ---- buried names ------------------------------------------------------------------------------------
  t.test('buried variables are hidden from the Variables panel until shown', async (p) => {
    await p.command('make "visible1 1 make "secret1 2 buryname "secret1');
    await p.inspector('vars');
    let txt = await p.paneText('vars');
    p.assert.match(txt, /visible1/);
    p.assert.doesNotMatch(txt, /secret1/);
    await toggle(p, 'showBuried');
    txt = await p.paneText('vars');
    p.assert.match(txt, /secret1/);
    await toggle(p, 'showBuried');
    p.assert.doesNotMatch(await p.paneText('vars'), /secret1/);
  }, { fresh: true });

  t.test('showing buried names is remembered after a reload', async (p) => {
    await toggle(p, 'showBuried');
    await p.reload();
    p.assert.equal(await p.ev('LG.app.settings.showBuried'), true);
    await openLooks(p);
    p.assert.equal(await checked(p, 'showBuried'), true);
    await p.key('Escape');
  }, { fresh: true });

  t.test('settings changed in the dialog take effect without pressing Done', async (p) => {
    await openLooks(p);
    await p.click('#set-grid');
    p.assert.equal(await p.ev('LG.app.turtleView.grid'), true);
    await p.key('Escape');
    p.assert.equal(await p.ev('LG.app.turtleView.grid'), true);
  }, { fresh: true });
}
