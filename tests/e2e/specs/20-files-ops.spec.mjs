// The Files panel, part two: context menus and every item in them, the toolbar, bringing files
// in from the computer, the Open dialog and folders from the computer.
import {
  tidy, openFilesPanel, row, expand, refreshTree, put, rm, closeAll, disk, exists, tabNames, rowMenu, pick,
  stubDownload, downloads, stubPick, unzip, tempFiles, chooseFiles, stubFolder, hostText, setCursor, realPicker,
} from './20-ed-lib.mjs';

const labels = (items) => items.map((x) => x.label);
const disabled = (items) => items.filter((x) => x.disabled).map((x) => x.label);
const active = (p) => p.activePath();
const promptValue = (p) => p.ev("document.querySelector('.modal-back:last-child .modal input').value");
const text = (bytes) => Buffer.from(bytes).toString('utf8');

async function mount(p, mode, files, name) {
  await stubFolder(p, name || 'proj', files || { 'hello.lgo': 'print "fromdisk', 'data.txt': 'line one', 'sub/inner.lgo': 'print 2' });
  await p.click('#fMount');
  await p.waitModal();
  await p.modalButton({ read: 'Read only', ask: 'Ask me before each change', write: 'Let them write' }[mode]);
  await p.waitToast(/Mounted at \/mnt\//);
  await refreshTree(p);
}
async function unmountAll(p) {
  await p.ev("for (const k of [...LG.app.vfs.mounts.keys()]) LG.app.vfs.unmount(k); LG.app.renderSide()");
}

export default function (t) {
  t.beforeEach(async (p) => {
    await tidy(p);
    await openFilesPanel(p);
    await closeAll(p);
    await rm(p, '/projects/t');
    await put(p, '/projects/t/a.lgo', 'print "a');
    await put(p, '/projects/t/b.lgo', 'print "b');
    await put(p, '/projects/t/sub/deep.lgo', 'print "deep');
    await p.ev("LG.app.vfs.mkdir('/projects/t/empty', { trusted: true })");
    await expand(p, '/projects', '/projects/t', '/projects/t/sub');
    await p.ev('LG.app.selectedPath = null');
    await stubDownload(p);
    await p.sleep(200);
  });
  t.afterEach(async (p) => { await tidy(p); await unmountAll(p); });

  // ---- what the menus offer --------------------------------------------------------------------------
  t.test('a folder menu offers every folder action', async (p) => {
    const items = await rowMenu(p, '/projects/t');
    p.assert.deepEqual(labels(items), ['New program here', 'New folder here', 'Bring files here from your computer', 'Share this folder as a link…', 'Download as .zip', 'Rename…', 'Delete']);
    p.assert.deepEqual(disabled(items), []);
  });
  t.test('a file menu offers every file action', async (p) => {
    const items = await rowMenu(p, '/projects/t/a.lgo');
    p.assert.deepEqual(labels(items), ['Open', 'Run', 'Share as a link…', 'Download', 'Duplicate', 'Rename…', 'Delete']);
    p.assert.deepEqual(disabled(items), []);
  });
  t.test('/projects cannot be renamed or deleted from its menu', async (p) => {
    p.assert.deepEqual(disabled(await rowMenu(p, '/projects')), ['Rename…', 'Delete']);
  });
  t.test('/examples only offers sharing and downloading', async (p) => {
    p.assert.deepEqual(disabled(await rowMenu(p, '/examples')), ['New program here', 'New folder here', 'Bring files here from your computer', 'Rename…', 'Delete']);
  });
  t.test('an example file cannot be renamed or deleted from its menu', async (p) => {
    p.assert.deepEqual(disabled(await rowMenu(p, '/examples/spiral.lgo')), ['Rename…', 'Delete']);
  });
  t.test('greyed out menu items do nothing when clicked', async (p) => {
    await rowMenu(p, '/examples/spiral.lgo');
    await p.click('.menu-pop .menu-item', 'Delete');
    await p.sleep(100);
    p.assert.equal(await p.modalOpen(), false);
    p.assert.equal(await exists(p, '/examples/spiral.lgo'), true);
  });
  t.test('Escape closes a tree menu', async (p) => {
    await rowMenu(p, '/projects/t');
    await p.key('Escape');
    p.assert.equal(await p.exists('.menu-pop'), false);
  });
  t.test('a click elsewhere closes a tree menu', async (p) => {
    await rowMenu(p, '/projects/t');
    await p.click('#worldCanvas');
    p.assert.equal(await p.exists('.menu-pop'), false);
  });
  t.test('the tree menu opens where the mouse is', async (p) => {
    await refreshTree(p);
    const [x, y] = await p.center(row('/projects/t/a.lgo'));
    await p.clickAt(x, y, { button: 'right' });
    const r = await p.rect('.menu-pop');
    const vh = await p.ev('innerHeight');
    p.assert.ok(Math.abs(r.x - x) < 3, JSON.stringify([r, x, y]));
    // below the mouse if it fits, otherwise pushed up just enough to stay on screen
    p.assert.ok(Math.abs(r.y - y) < 6 || Math.abs(r.bottom - (vh - 4)) < 6, JSON.stringify([r, x, y]));
    p.assert.ok(r.bottom <= vh);
  });

  // ---- folder actions ----------------------------------------------------------------------------------
  t.test('New program here makes the program in that folder', async (p) => {
    await rowMenu(p, '/projects/t/sub');
    await pick(p, 'New program here');
    await p.waitModal();
    p.assert.match(await p.modalText(), /It goes in \/projects\/t\/sub\./);
    await p.modalInput('made');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.equal(await active(p), '/projects/t/sub/made.lgo');
    p.assert.equal(await exists(p, '/projects/t/sub/made.lgo'), true);
  });
  t.test('New program here skips names already used in that folder', async (p) => {
    await put(p, '/projects/t/untitled.lgo', '');
    await rowMenu(p, '/projects/t');
    await pick(p, 'New program here');
    await p.waitModal();
    p.assert.equal(await promptValue(p), 'untitled2.lgo');
  });
  t.test('New folder here makes a folder and opens it in the tree', async (p) => {
    await rowMenu(p, '/projects/t');
    await pick(p, 'New folder here');
    p.assert.equal(await p.waitModal(), 'New folder');
    p.assert.equal(await promptValue(p), 'my folder');
    await p.modalInput('art');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.equal(await p.ev("LG.app.vfs.isDir('/projects/t/art')"), true);
    p.assert.equal(await p.ev("LG.app.expanded.has('/projects/t/art')"), true);
    p.assert.equal(await p.exists(row('/projects/t/art')), true);
  });
  t.test('a folder name that is already used is refused', async (p) => {
    await rowMenu(p, '/projects/t');
    await pick(p, 'New folder here');
    await p.waitModal();
    await p.modalInput('sub');
    await p.key('Enter');
    await p.waitToast(/Could not make the folder: File already exists/);
  });
  t.test('a folder name with odd characters is refused', async (p) => {
    await rowMenu(p, '/projects/t');
    await pick(p, 'New folder here');
    await p.waitModal();
    await p.modalInput('a*b');
    await p.key('Enter');
    await p.waitToast(/Could not make the folder/);
  });
  t.test('cancelling New folder makes nothing', async (p) => {
    const n = await p.ev("LG.app.vfs.list('/projects/t').length");
    await rowMenu(p, '/projects/t');
    await pick(p, 'New folder here');
    await p.waitModal();
    await p.key('Escape');
    p.assert.equal(await p.ev("LG.app.vfs.list('/projects/t').length"), n);
  });
  t.test('Rename… renames a folder', async (p) => {
    await rowMenu(p, '/projects/t/sub');
    await pick(p, 'Rename…');
    p.assert.equal(await promptValue(p), 'sub');
    await p.modalInput('inner');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.equal(await disk(p, '/projects/t/inner/deep.lgo'), 'print "deep');
    p.assert.equal(await exists(p, '/projects/t/sub'), false);
  });
  t.test('renaming a folder moves the open tabs inside it', async (p) => {
    await p.ev("LG.app.openFile('/projects/t/sub/deep.lgo')");
    await rowMenu(p, '/projects/t/sub');
    await pick(p, 'Rename…');
    await p.modalInput('moved');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.equal(await active(p), '/projects/t/moved/deep.lgo');
    p.assert.equal(await p.text('#proj'), '/projects/t/moved/deep.lgo');
  });
  t.test('renaming a folder keeps the session pointing at the new place', async (p) => {
    await p.ev("LG.app.openFile('/projects/t/sub/deep.lgo')");
    await rowMenu(p, '/projects/t/sub');
    await pick(p, 'Rename…');
    await p.modalInput('moved');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.deepEqual((await p.ev("JSON.parse(localStorage.getItem('lohgo.session'))")).open, ['/projects/t/moved/deep.lgo']);
  });
  t.test('Delete on a folder asks, naming everything in it', async (p) => {
    await rowMenu(p, '/projects/t/sub');
    await pick(p, 'Delete');
    p.assert.equal(await p.waitModal(), 'Delete?');
    p.assert.match(await p.modalText(), /Delete \/projects\/t\/sub and everything in it\? This cannot be undone\./);
    await p.modalButton('Delete');
    p.assert.equal(await exists(p, '/projects/t/sub'), false);
    p.assert.equal(await exists(p, '/projects/t/sub/deep.lgo'), false);
  });
  t.test('deleting a folder closes its open tabs without asking', async (p) => {
    await p.ev("LG.app.openFile('/projects/t/sub/deep.lgo')");
    await p.setCode('changed');
    await rowMenu(p, '/projects/t/sub');
    await pick(p, 'Delete');
    await p.waitModal();
    await p.modalButton('Delete');
    await p.sleep(80);
    p.assert.equal(await p.modalOpen(), false);
    p.assert.deepEqual(await tabNames(p), []);
  });
  t.test('Cancel keeps the folder', async (p) => {
    await rowMenu(p, '/projects/t/sub');
    await pick(p, 'Delete');
    await p.waitModal();
    await p.modalButton('Cancel');
    p.assert.equal(await exists(p, '/projects/t/sub/deep.lgo'), true);
  });
  t.test('Download as .zip gives a zip named after the folder', async (p) => {
    await rowMenu(p, '/projects/t');
    await pick(p, 'Download as .zip');
    const d = await downloads(p);
    p.assert.equal(d.length, 1);
    p.assert.equal(d[0].name, 't.zip');
    p.assert.equal(d[0].type, 'application/zip');
  });
  t.test('the zip holds every file with paths inside the folder', async (p) => {
    await rowMenu(p, '/projects/t');
    await pick(p, 'Download as .zip');
    const z = unzip((await downloads(p))[0].bytes);
    p.assert.equal(z.__count, 3);
    p.assert.equal(z['a.lgo'], 'print "a');
    p.assert.equal(z['b.lgo'], 'print "b');
    p.assert.equal(z['sub/deep.lgo'], 'print "deep');
  });
  t.test('the zip holds unsaved changes from open tabs', async (p) => {
    await p.ev("LG.app.openFile('/projects/t/a.lgo')");
    await p.ev('LG.app.settings.autosave = false');
    try {
      await p.setCode('print "unsaved');
      await rowMenu(p, '/projects/t');
      await pick(p, 'Download as .zip');
      p.assert.equal(unzip((await downloads(p))[0].bytes)['a.lgo'], 'print "unsaved');
    } finally { await p.ev('LG.app.settings.autosave = true'); }
  });
  t.test('a zip of a folder of examples holds the examples', async (p) => {
    await rowMenu(p, '/examples');
    await pick(p, 'Download as .zip');
    const d = (await downloads(p))[0];
    p.assert.equal(d.name, 'examples.zip');
    const z = unzip(d.bytes);
    p.assert.equal(z['spiral.lgo'], await disk(p, '/examples/spiral.lgo'));
  });
  t.test('an empty folder cannot be zipped', async (p) => {
    await rowMenu(p, '/projects/t/empty');
    await pick(p, 'Download as .zip');
    await p.waitToast(/That folder is empty/);
    p.assert.equal((await downloads(p)).length, 0);
  });
  t.test('the zip keeps non-ASCII names and text', async (p) => {
    await put(p, '/projects/t/sub/größe.lgo', 'print "größe');
    await rowMenu(p, '/projects/t/sub');
    await pick(p, 'Download as .zip');
    p.assert.equal(unzip((await downloads(p))[0].bytes)['größe.lgo'], 'print "größe');
  });
  t.test('Share this folder as a link opens the share dialog for the folder', async (p) => {
    await rowMenu(p, '/projects/t');
    await pick(p, 'Share this folder as a link');
    p.assert.equal(await p.waitModal(), 'Share t');
    p.assert.match(await p.modalText(), /these 3 files/);
  });
  t.test('an empty folder cannot be shared', async (p) => {
    await rowMenu(p, '/projects/t/empty');
    await pick(p, 'Share this folder as a link');
    await p.waitToast(/Nothing to share there/);
  });
  t.test('Bring files here puts the files in that folder', async (p) => {
    await stubPick(p, [{ name: 'one.lgo', text: 'print 1' }, { name: 'two.txt', text: 'two' }]);
    await rowMenu(p, '/projects/t/sub');
    await pick(p, 'Bring files here from your computer');
    await p.waitToast(/Brought in 2 files/);
    p.assert.equal(await disk(p, '/projects/t/sub/one.lgo'), 'print 1');
    p.assert.equal(await disk(p, '/projects/t/sub/two.txt'), 'two');
  });

  // ---- file actions ---------------------------------------------------------------------------------------
  t.test('Open opens the file', async (p) => {
    await rowMenu(p, '/projects/t/b.lgo');
    await pick(p, 'Open');
    p.assert.equal(await active(p), '/projects/t/b.lgo');
  });
  t.test('Run opens the file and runs it', async (p) => {
    await rowMenu(p, '/projects/t/b.lgo');
    await pick(p, 'Run');
    await p.waitState('idle');
    p.assert.equal(await active(p), '/projects/t/b.lgo');
    await p.waitOutput(/^b$/m);
  });
  t.test('Run on an example runs it', async (p) => {
    await put(p, '/projects/t/sq.lgo', 'repeat 4 [fd 10 rt 90]');
    await rowMenu(p, '/projects/t/sq.lgo');
    await pick(p, 'Run');
    await p.waitState('idle');
    p.assert.equal(await p.segments(), 4);
  });
  t.test('Download gives the file with its name', async (p) => {
    await rowMenu(p, '/projects/t/a.lgo');
    await pick(p, 'Download');
    const d = (await downloads(p))[0];
    p.assert.equal(d.name, 'a.lgo');
    p.assert.equal(d.type, 'text/plain');
    p.assert.equal(text(d.bytes), 'print "a');
  });
  t.test('Download of an open changed file saves it and gives the new text', async (p) => {
    await p.ev("LG.app.openFile('/projects/t/a.lgo')");
    await p.setCode('print "newer');
    await rowMenu(p, '/projects/t/a.lgo');
    await pick(p, 'Download');
    p.assert.equal(text((await downloads(p))[0].bytes), 'print "newer');
    p.assert.equal(await disk(p, '/projects/t/a.lgo'), 'print "newer');
  });
  t.test('Download this file in the main menu downloads the active file', async (p) => {
    await p.ev("LG.app.openFile('/projects/t/b.lgo')");
    await p.menu('Download this file');
    p.assert.equal((await downloads(p))[0].name, 'b.lgo');
  });
  t.test('the real download makes a link with the file name', async (p) => {
    await p.ev("window.__clicks = []; window.__aclick = window.__aclick || HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { window.__clicks.push([this.download, this.href.slice(0, 5), document.body.contains(this)]); }; LG.UI.download = window.__realDownload");
    try {
      await rowMenu(p, '/projects/t/a.lgo');
      await pick(p, 'Download');
      p.assert.deepEqual(await p.ev('window.__clicks'), [['a.lgo', 'blob:', true]]);
      p.assert.equal(await p.ev("document.querySelectorAll('a[download]').length"), 0);
    } finally { await p.ev('HTMLAnchorElement.prototype.click = window.__aclick'); }
  });
  t.test('Duplicate makes a -2 copy next to it and opens it', async (p) => {
    await rowMenu(p, '/projects/t/a.lgo');
    await pick(p, 'Duplicate');
    p.assert.equal(await disk(p, '/projects/t/a-2.lgo'), 'print "a');
    p.assert.equal(await active(p), '/projects/t/a-2.lgo');
  });
  t.test('Duplicate again makes a -3 copy', async (p) => {
    await put(p, '/projects/t/a-2.lgo', 'x');
    await rowMenu(p, '/projects/t/a.lgo');
    await pick(p, 'Duplicate');
    p.assert.equal(await exists(p, '/projects/t/a-3.lgo'), true);
  });
  t.test('Duplicate on an example puts the copy in /projects', async (p) => {
    await rm(p, '/projects/spiral-2.lgo');
    await rowMenu(p, '/examples/spiral.lgo');
    await pick(p, 'Duplicate');
    p.assert.equal(await active(p), '/projects/spiral-2.lgo');
    p.assert.equal(await disk(p, '/projects/spiral-2.lgo'), await disk(p, '/examples/spiral.lgo'));
    await closeAll(p);
    await rm(p, '/projects/spiral-2.lgo');
  });
  t.test('Rename… renames a file', async (p) => {
    await rowMenu(p, '/projects/t/a.lgo');
    await pick(p, 'Rename…');
    p.assert.equal(await p.waitModal(), 'Rename');
    await p.modalInput('c.lgo');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.equal(await disk(p, '/projects/t/c.lgo'), 'print "a');
    p.assert.equal(await p.exists(row('/projects/t/c.lgo')), true);
    p.assert.equal(await p.exists(row('/projects/t/a.lgo')), false);
  });
  t.test('renaming an open file renames its tab', async (p) => {
    await p.ev("LG.app.openFile('/projects/t/a.lgo')");
    await rowMenu(p, '/projects/t/a.lgo');
    await pick(p, 'Rename…');
    await p.modalInput('c.lgo');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.deepEqual(await tabNames(p), ['c.lgo']);
    p.assert.equal(await p.ev('document.title'), 'c.lgo · Lohgo');
  });
  t.test('renaming an open file keeps its breakpoints', async (p) => {
    await p.ev("LG.app.openFile('/projects/t/a.lgo'); LG.app.toggleBreakpoint('/projects/t/a.lgo', 0)");
    await rowMenu(p, '/projects/t/a.lgo');
    await pick(p, 'Rename…');
    await p.modalInput('c.lgo');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.deepEqual(await p.ev("[...(LG.app.breakpoints.get('/projects/t/c.lgo') || new Map()).keys()]"), [0]);
    p.assert.equal(await p.ev("LG.app.breakpoints.has('/projects/t/a.lgo')"), false);
    p.assert.equal(await p.ev("LG.app.active.editor.inner.children[0].classList.contains('bp')"), true);
    await p.ev('LG.app.clearBreakpoints()');
  });
  t.test('renaming onto an existing name is refused', async (p) => {
    await rowMenu(p, '/projects/t/a.lgo');
    await pick(p, 'Rename…');
    await p.modalInput('b.lgo');
    await p.key('Enter');
    await p.waitToast(/Could not rename: File already exists/);
    p.assert.equal(await disk(p, '/projects/t/b.lgo'), 'print "b');
    p.assert.equal(await disk(p, '/projects/t/a.lgo'), 'print "a');
  });
  t.test('renaming with the same name does nothing', async (p) => {
    await rowMenu(p, '/projects/t/a.lgo');
    await pick(p, 'Rename…');
    await p.key('Enter');
    await p.sleep(80);
    p.assert.equal(await exists(p, '/projects/t/a.lgo'), true);
  });
  t.test('renaming can change only the capitals', async (p) => {
    await rowMenu(p, '/projects/t/a.lgo');
    await pick(p, 'Rename…');
    await p.modalInput('A.lgo');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.equal(await p.exists(row('/projects/t/A.lgo')), true);
  });
  t.test('Delete on a file asks and deletes', async (p) => {
    await rowMenu(p, '/projects/t/a.lgo');
    await pick(p, 'Delete');
    p.assert.equal(await p.waitModal(), 'Delete?');
    p.assert.doesNotMatch(await p.modalText(), /everything in it/);
    await p.modalButton('Delete');
    p.assert.equal(await exists(p, '/projects/t/a.lgo'), false);
    p.assert.equal(await p.exists(row('/projects/t/a.lgo')), false);
  });
  t.test('deleting an open file closes its tab', async (p) => {
    await p.ev("LG.app.openFile('/projects/t/a.lgo')");
    await rowMenu(p, '/projects/t/a.lgo');
    await pick(p, 'Delete');
    await p.waitModal();
    await p.modalButton('Delete');
    await p.sleep(80);
    p.assert.deepEqual(await tabNames(p), []);
  });
  t.test('Enter on the Delete? box deletes', async (p) => {
    await rowMenu(p, '/projects/t/a.lgo');
    await pick(p, 'Delete');
    await p.waitModal();
    await p.key('Enter');
    await p.sleep(80);
    p.assert.equal(await exists(p, '/projects/t/a.lgo'), false);
  });
  t.test('Share as a link opens the share dialog for the file', async (p) => {
    await rowMenu(p, '/projects/t/a.lgo');
    await pick(p, 'Share as a link');
    p.assert.equal(await p.waitModal(), 'Share a');
    p.assert.match(await p.modalText(), /this program/);
  });

  // ---- the toolbar ---------------------------------------------------------------------------------------------
  t.test('the toolbar New program uses the selected folder', async (p) => {
    await p.click(row('/projects/t/sub'));
    await p.click(row('/projects/t/sub'));
    await p.click('#fNew');
    await p.waitModal();
    p.assert.match(await p.modalText(), /It goes in \/projects\/t\/sub\./);
  });
  t.test('the toolbar New program ignores a selected originals folder', async (p) => {
    await p.click(row('/examples'));
    await p.click(row('/examples'));
    await p.click('#fNew');
    await p.waitModal();
    p.assert.match(await p.modalText(), /It goes in \/projects\./);
  });
  t.test('the toolbar New folder uses the selected folder', async (p) => {
    await p.click(row('/projects/t/sub'));
    await p.click(row('/projects/t/sub'));
    await p.click('#fNewFolder');
    await p.waitModal();
    await p.modalInput('x1');
    await p.key('Enter');
    await p.sleep(80);
    p.assert.equal(await p.ev("LG.app.vfs.isDir('/projects/t/sub/x1')"), true);
  });
  t.test('the toolbar import brings files into /projects when nothing is selected', async (p) => {
    await stubPick(p, [{ name: 'imp.lgo', text: 'print "imp' }]);
    await p.click('#fImport');
    await p.waitToast(/Brought in 1 file\b/);
    p.assert.equal(await disk(p, '/projects/imp.lgo'), 'print "imp');
    p.assert.equal(await active(p), '/projects/imp.lgo');
    await closeAll(p);
    await rm(p, '/projects/imp.lgo');
  });

  // ---- bringing files in ---------------------------------------------------------------------------------------
  t.test('an imported program opens in the editor', async (p) => {
    await stubPick(p, [{ name: 'x.lgo', text: 'fd 1' }]);
    await rowMenu(p, '/projects/t');
    await pick(p, 'Bring files here');
    await p.waitToast(/Brought in/);
    p.assert.equal(await active(p), '/projects/t/x.lgo');
  });
  t.test('an imported picture is stored but not opened', async (p) => {
    await stubPick(p, [{ name: 'pic.png', text: '\x89PNG' }]);
    await rowMenu(p, '/projects/t');
    await pick(p, 'Bring files here');
    await p.waitToast(/Brought in/);
    p.assert.equal(await exists(p, '/projects/t/pic.png'), true);
    p.assert.equal(await active(p), null);
  });
  t.test('importing over an existing file asks to replace it', async (p) => {
    await stubPick(p, [{ name: 'a.lgo', text: 'print "imported' }]);
    await rowMenu(p, '/projects/t');
    await pick(p, 'Bring files here');
    p.assert.equal(await p.waitModal(), 'Replace?');
    p.assert.match(await p.modalText(), /\/projects\/t\/a\.lgo is already there/);
    await p.modalButton('Replace');
    await p.waitToast(/Brought in/);
    p.assert.equal(await disk(p, '/projects/t/a.lgo'), 'print "imported');
  });
  t.test('Cancel keeps the existing file', async (p) => {
    await stubPick(p, [{ name: 'a.lgo', text: 'print "imported' }]);
    await rowMenu(p, '/projects/t');
    await pick(p, 'Bring files here');
    await p.waitModal();
    await p.modalButton('Cancel');
    await p.sleep(100);
    p.assert.equal(await disk(p, '/projects/t/a.lgo'), 'print "a');
  });
  t.test('replacing an open file updates its tab', async (p) => {
    await p.ev("LG.app.openFile('/projects/t/a.lgo')");
    await stubPick(p, [{ name: 'a.lgo', text: 'print "imported' }]);
    await rowMenu(p, '/projects/t');
    await pick(p, 'Bring files here');
    await p.waitModal();
    await p.modalButton('Replace');
    await p.sleep(100);
    p.assert.equal(await p.code(), 'print "imported');
    p.assert.equal(await p.ev('LG.app.active.dirty'), false);
  });
  t.test('characters that cannot be in names are replaced', async (p) => {
    await stubPick(p, [{ name: 'what?.lgo', text: 'x' }]);
    await rowMenu(p, '/projects/t');
    await pick(p, 'Bring files here');
    await p.waitToast(/Brought in/);
    p.assert.equal(await exists(p, '/projects/t/what_.lgo'), true);
  });
  t.test('choosing nothing in the file chooser does nothing', async (p) => {
    await stubPick(p, []);
    await p.ev("document.querySelectorAll('.toast').forEach((t) => t.remove())");
    await rowMenu(p, '/projects/t');
    await pick(p, 'Bring files here');
    await p.sleep(100);
    p.assert.equal(await p.ev("[...document.querySelectorAll('.toast')].some((t) => /Brought/.test(t.innerText))"), false);
  });
  t.test('Windows line endings in an imported program are cleaned up', async (p) => {
    await stubPick(p, [{ name: 'crlf.lgo', text: 'print 1\r\nprint 2\r\n' }]);
    await rowMenu(p, '/projects/t');
    await pick(p, 'Bring files here');
    await p.waitToast(/Brought in/);
    p.assert.equal(await p.code(), 'print 1\nprint 2\n');
  });
  t.test('the real file chooser brings in a file from the disk', async (p) => {
    await p.b.send('Page.setInterceptFileChooserDialog', { enabled: true });
    await realPicker(p);
    try {
      const files = tempFiles([{ name: 'real.lgo', text: 'print "real' }, { name: 'second.lgo', text: 'print 2' }]);
      await rowMenu(p, '/projects/t');
      await pick(p, 'Bring files here');
      await chooseFiles(p, files);
      await p.waitToast(/Brought in 2 files/);
      p.assert.equal(await disk(p, '/projects/t/real.lgo'), 'print "real');
      p.assert.equal(await disk(p, '/projects/t/second.lgo'), 'print 2');
      p.assert.equal(await p.exists('input[type=file]'), false);
    } finally { await p.b.send('Page.setInterceptFileChooserDialog', { enabled: false }); }
  });
  t.test('the real file chooser accepts several files from the toolbar', async (p) => {
    await p.b.send('Page.setInterceptFileChooserDialog', { enabled: true });
    await realPicker(p);
    try {
      await p.click(row('/projects/t/sub'));
      await p.click(row('/projects/t/sub'));
      await p.click('#fImport');
      await p.wait("!!document.querySelector('input[type=file]')");
      p.assert.equal(await p.ev("document.querySelector('input[type=file]').multiple"), true);
      await chooseFiles(p, tempFiles([{ name: 'r1.lgo', text: '1' }, { name: 'r2.lgo', text: '2' }, { name: 'r3.lgo', text: '3' }]));
      await p.waitToast(/Brought in 3 files/);
      p.assert.equal(await p.ev("LG.app.vfs.list('/projects/t/sub').filter((e) => /^r\\d/.test(e.name)).length"), 3);
    } finally { await p.b.send('Page.setInterceptFileChooserDialog', { enabled: false }); }
  });

  // ---- the Open dialog ----------------------------------------------------------------------------------------------
  t.test('Ctrl+O opens the Open dialog with the search box ready', async (p) => {
    await p.key('o', { ctrl: true });
    p.assert.equal(await p.waitModal(), 'Open a program');
    await p.sleep(60);
    p.assert.equal(await p.ev("document.activeElement.getAttribute('aria-label')"), 'Find a program');
  });
  t.test('the Open dialog lists programs, not other files', async (p) => {
    await put(p, '/projects/t/pic.png', 'x');
    await p.key('o', { ctrl: true });
    await p.waitModal();
    const rows = await p.texts('.modal .list-row');
    p.assert.ok(rows.includes('/projects/t/a.lgo'));
    p.assert.ok(rows.includes('/examples/spiral.lgo'));
    p.assert.ok(!rows.some((r) => r.endsWith('.png')));
  });
  t.test('typing in the Open dialog narrows the list', async (p) => {
    await p.key('o', { ctrl: true });
    await p.waitModal();
    await p.type('t/sub');
    p.assert.deepEqual(await p.texts('.modal .list-row'), ['/projects/t/sub/deep.lgo']);
  });
  t.test('the Open filter ignores case', async (p) => {
    await p.key('o', { ctrl: true });
    await p.waitModal();
    await p.type('DEEP');
    p.assert.deepEqual(await p.texts('.modal .list-row'), ['/projects/t/sub/deep.lgo']);
  });
  t.test('Enter in the Open dialog opens the first match', async (p) => {
    await p.key('o', { ctrl: true });
    await p.waitModal();
    await p.type('deep');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.equal(await p.modalOpen(), false);
    p.assert.equal(await active(p), '/projects/t/sub/deep.lgo');
  });
  t.test('clicking a row in the Open dialog opens it', async (p) => {
    await p.key('o', { ctrl: true });
    await p.waitModal();
    await p.type('/projects/t/b');
    await p.click('.modal .list-row', '/projects/t/b.lgo');
    await p.sleep(100);
    p.assert.equal(await active(p), '/projects/t/b.lgo');
  });
  t.test('the Open dialog says when nothing matches', async (p) => {
    await p.key('o', { ctrl: true });
    await p.waitModal();
    await p.type('qqqzzz');
    p.assert.equal(await p.text('.modal .empty'), 'Nothing matches.');
    await p.key('Enter');
    p.assert.equal(await p.modalOpen(), true);
  });
  t.test('Cancel closes the Open dialog without opening anything', async (p) => {
    await p.key('o', { ctrl: true });
    await p.waitModal();
    await p.modalButton('Cancel');
    p.assert.equal(await p.modalOpen(), false);
    p.assert.equal(await active(p), null);
  });
  t.test('From my computer in the Open dialog brings files in', async (p) => {
    await stubPick(p, [{ name: 'fromcomp.lgo', text: 'print "c' }]);
    await p.key('o', { ctrl: true });
    await p.waitModal();
    await p.modalButton('From my computer');
    await p.waitToast(/Brought in 1 file/);
    p.assert.equal(await active(p), '/projects/fromcomp.lgo');
    await closeAll(p);
    await rm(p, '/projects/fromcomp.lgo');
  });
  t.test('Open… in the menu opens the dialog', async (p) => {
    await p.menu('Open…');
    p.assert.equal(await p.waitModal(), 'Open a program');
  });
  t.test('the Open dialog lists programs in name order', async (p) => {
    await p.key('o', { ctrl: true });
    await p.waitModal();
    const rows = await p.texts('.modal .list-row');
    p.assert.deepEqual(rows, rows.slice().sort());
  });

  // ---- folders from the computer -----------------------------------------------------------------------------------------
  t.test('without folder support the button explains why', async (p) => {
    await p.ev('window.showDirectoryPicker = undefined');
    await p.click('#fMount');
    p.assert.equal(await p.waitModal(), 'Folders from your computer');
    p.assert.match(await p.modalText(), /cannot open folders/);
  });
  t.test('the folder dialog offers read, ask and write', async (p) => {
    await stubFolder(p, 'proj', {});
    await p.click('#fMount');
    p.assert.equal(await p.waitModal(), 'Use a folder from your computer');
    p.assert.deepEqual(await p.ev("[...document.querySelectorAll('.modal-foot button')].map((b) => b.innerText)"), ['Cancel', 'Read only', 'Ask me before each change', 'Let them write']);
  });
  t.test('Cancel in the folder dialog does not ask the browser', async (p) => {
    await stubFolder(p, 'proj', {});
    await p.click('#fMount');
    await p.waitModal();
    await p.modalButton('Cancel');
    p.assert.deepEqual(await p.ev('window.__pickerCalls'), []);
    p.assert.equal(await exists(p, '/mnt'), false);
  });
  t.test('cancelling the browser folder picker mounts nothing', async (p) => {
    await stubFolder(p, 'proj', {}, { cancel: true });
    await p.click('#fMount');
    await p.waitModal();
    await p.modalButton('Read only');
    await p.sleep(100);
    p.assert.equal(await exists(p, '/mnt'), false);
  });
  t.test('Read only asks the browser for reading only', async (p) => {
    await mount(p, 'read');
    p.assert.deepEqual(await p.ev('window.__pickerCalls'), [{ mode: 'read' }]);
  });
  t.test('Ask and write modes ask the browser for writing', async (p) => {
    await mount(p, 'ask');
    p.assert.deepEqual(await p.ev('window.__pickerCalls'), [{ mode: 'readwrite' }]);
  });
  t.test('a mounted folder appears under /mnt with its files', async (p) => {
    await mount(p, 'read');
    p.assert.equal(await p.exists(row('/mnt/proj')), true);
    p.assert.equal(await p.exists(row('/mnt/proj/hello.lgo')), true);
    p.assert.equal(await p.exists(row('/mnt/proj/data.txt')), true);
    p.assert.equal(await p.exists(row('/mnt/proj/sub')), true);
  });
  for (const [mode, tag] of [['read', 'read only'], ['ask', 'asks first'], ['write', 'can write']]) {
    t.test(`a ${mode} mount is labelled "${tag}"`, async (p) => {
      await mount(p, mode);
      p.assert.equal(await p.ev(`document.querySelector('.trow[data-path="/mnt/proj"] .tag').textContent`), tag);
    });
  }
  t.test('opening a file from a mounted folder shows its text', async (p) => {
    await mount(p, 'read');
    await p.click(row('/mnt/proj/hello.lgo'));
    await p.wait("LG.app.active && LG.app.active.path === '/mnt/proj/hello.lgo'", 3000);
    p.assert.equal(await p.code(), 'print "fromdisk');
  });
  t.test('a program in a mounted folder runs', async (p) => {
    await mount(p, 'read');
    await p.click(row('/mnt/proj/hello.lgo'));
    await p.wait("LG.app.active && LG.app.active.path === '/mnt/proj/hello.lgo'", 3000);
    await p.key('F5');
    await p.waitOutput(/^fromdisk$/m);
  });
  t.test('a program can read a file in a read-only folder', async (p) => {
    await mount(p, 'read');
    await p.runProgram('openread "/mnt/proj/data.txt\nsetread "/mnt/proj/data.txt\nprint readword\nsetread []\nclose "/mnt/proj/data.txt\n', { path: '/projects/t/reader.lgo' });
    await p.waitOutput(/^line one$/m);
  });
  t.test('a program cannot write into a read-only folder', async (p) => {
    await mount(p, 'read');
    const st = await p.runProgram('openwrite "/mnt/proj/out.txt\n', { path: '/projects/t/w.lgo' });
    p.assert.equal(st, 'error');
    await p.waitOutput(/Permission denied/);
    p.assert.equal(await hostText(p, 'out.txt'), null);
  });
  t.test('saving into a read-only folder is refused with a message', async (p) => {
    await mount(p, 'read');
    await p.click(row('/mnt/proj/hello.lgo'));
    await p.wait("LG.app.active && LG.app.active.path === '/mnt/proj/hello.lgo'", 3000);
    await p.setCode('print "changed');
    await p.key('s', { ctrl: true });
    await p.waitToast(/Could not save hello\.lgo/);
    p.assert.equal(await hostText(p, 'hello.lgo'), 'print "fromdisk');
  });
  t.test('in ask mode a program write asks first, and Allow writes the real file', async (p) => {
    await mount(p, 'ask');
    await p.runProgram('openwrite "/mnt/proj/out.txt\nsetwrite "/mnt/proj/out.txt\nprint "written\nsetwrite []\nclose "/mnt/proj/out.txt\n', { path: '/projects/t/w.lgo', wait: false });
    p.assert.equal(await p.waitModal(), 'Let the program write a file?');
    p.assert.match(await p.modalText(), /\/mnt\/proj\/out\.txt/);
    await p.modalButton('Allow');
    await p.waitState(['idle', 'error']);
    p.assert.equal(await p.state(), 'idle', await p.output());
    await p.wait("window.__folder.kids.has('out.txt') && window.__folder.kids.get('out.txt').text === 'written\\n'", 3000);
  });
  t.test('in ask mode saying no stops the program with a clear error', async (p) => {
    await mount(p, 'ask');
    await p.runProgram('openwrite "/mnt/proj/out.txt\nprint "after\n', { path: '/projects/t/w.lgo', wait: false });
    await p.waitModal();
    await p.modalButton('Cancel');
    await p.waitState(['idle', 'error']);
    p.assert.equal(await p.state(), 'error');
    await p.waitOutput(/Permission denied/);
    p.assert.equal(await hostText(p, 'out.txt'), null);
  });
  t.test('in write mode a program writes the real file without asking', async (p) => {
    await mount(p, 'write');
    await p.runProgram('openwrite "/mnt/proj/sub/made.txt\nsetwrite "/mnt/proj/sub/made.txt\nprint "free\nsetwrite []\nclose "/mnt/proj/sub/made.txt\n', { path: '/projects/t/w.lgo' });
    p.assert.equal(await p.modalOpen(), false);
    p.assert.equal(await p.state(), 'idle', await p.output());
    await p.wait("window.__folder.kids.get('sub').kids.has('made.txt') && window.__folder.kids.get('sub').kids.get('made.txt').text === 'free\\n'", 3000);
  });
  t.test('in write mode saving from the editor writes the real file', async (p) => {
    await mount(p, 'write');
    await p.click(row('/mnt/proj/hello.lgo'));
    await p.wait("LG.app.active && LG.app.active.path === '/mnt/proj/hello.lgo'", 3000);
    await p.setCode('print "edited');
    await p.key('s', { ctrl: true });
    await p.wait("window.__folder.kids.get('hello.lgo').text === 'print \"edited'", 3000);
  });
  t.test('a file written by a program in a mounted folder appears in the tree', async (p) => {
    await mount(p, 'write');
    await p.runProgram('openwrite "/mnt/proj/new.txt\nclose "/mnt/proj/new.txt\n', { path: '/projects/t/w.lgo' });
    await p.wait(`!!document.querySelector('.trow[data-path="/mnt/proj/new.txt"]')`, 3000);
  });
  t.test('mounted folders are not saved automatically', async (p) => {
    await mount(p, 'write');
    await p.click(row('/mnt/proj/hello.lgo'));
    await p.wait("LG.app.active && LG.app.active.path === '/mnt/proj/hello.lgo'", 3000);
    await p.setCode('print "auto');
    await p.ev('LG.app.autosaveAll()');
    await p.sleep(100);
    p.assert.equal(await hostText(p, 'hello.lgo'), 'print "fromdisk');
  });
  t.test('the mounted folder menu offers Stop using this folder and no rename or delete', async (p) => {
    await mount(p, 'read');
    const items = await rowMenu(p, '/mnt/proj');
    p.assert.ok(labels(items).includes('Stop using this folder'));
    p.assert.deepEqual(disabled(items).filter((x) => /Rename|Delete/.test(x)), ['Rename…', 'Delete']);
  });
  t.test('Stop using this folder takes it out of the tree', async (p) => {
    await mount(p, 'read');
    await rowMenu(p, '/mnt/proj');
    await pick(p, 'Stop using this folder');
    p.assert.equal(await exists(p, '/mnt/proj'), false);
    p.assert.equal(await exists(p, '/mnt'), false);
    p.assert.equal(await p.exists(row('/mnt/proj')), false);
    p.assert.equal(await hostText(p, 'hello.lgo'), 'print "fromdisk');
  });
  t.test('Delete on a mounted folder row is refused and the real files stay', async (p) => {
    await mount(p, 'write');
    await p.fn(() => document.querySelector('.trow[data-path="/mnt/proj"]').focus());
    await p.key('Delete');
    await p.waitToast(/kept safe/);
    p.assert.equal(await p.modalOpen(), false);
    p.assert.equal(await hostText(p, 'hello.lgo'), 'print "fromdisk');
  });
  t.test('F2 on a mounted folder row is refused', async (p) => {
    await mount(p, 'write');
    await p.fn(() => document.querySelector('.trow[data-path="/mnt/proj"]').focus());
    await p.key('F2');
    await p.waitToast(/kept safe/);
    p.assert.equal(await exists(p, '/mnt/proj'), true);
  });
  t.test('a file inside a write mount can be deleted, and the real file goes', async (p) => {
    await mount(p, 'write');
    await rowMenu(p, '/mnt/proj/data.txt');
    await pick(p, 'Delete');
    await p.waitModal();
    await p.modalButton('Delete');
    await p.wait("!window.__folder.kids.has('data.txt')", 3000);
  });
  t.test('a file inside a read mount cannot be deleted', async (p) => {
    await mount(p, 'read');
    await rowMenu(p, '/mnt/proj/data.txt');
    await pick(p, 'Delete');
    await p.waitModal();
    await p.modalButton('Delete');
    await p.waitToast(/Could not delete: Permission denied/);
    p.assert.equal(await hostText(p, 'data.txt'), 'line one');
  });
  t.test('two folders with the same name get different places', async (p) => {
    await mount(p, 'read');
    await mount(p, 'read');
    p.assert.equal(await exists(p, '/mnt/proj'), true);
    p.assert.equal(await exists(p, '/mnt/proj-2'), true);
  });
  t.test('files in hidden folders on the computer are skipped', async (p) => {
    await mount(p, 'read', { '.git/config': 'x', 'ok.lgo': 'print 1' });
    p.assert.equal(await exists(p, '/mnt/proj/ok.lgo'), true);
    p.assert.equal(await exists(p, '/mnt/proj/.git'), false);
  });
  t.test('a mounted folder does not count toward the disk note', async (p) => {
    const before = await p.ev('LG.app.vfs.used()');
    await mount(p, 'read', { 'big.txt': 'x'.repeat(200000) });
    await p.click(row('/mnt/proj/big.txt'));
    await p.ev("LG.app.vfs.load('/mnt/proj/big.txt')");
    await p.sleep(100);
    p.assert.equal(await p.ev('LG.app.vfs.used()'), before);
  });

  // ---- leftover check: the editor is untouched by menus --------------------------------------------------------------------
  t.test('using tree menus does not type into the editor', async (p) => {
    await p.ev("LG.app.openFile('/projects/t/a.lgo')");
    await setCursor(p, 0, 0);
    await rowMenu(p, '/projects/t/b.lgo');
    await p.key('ArrowDown');
    await p.key('Escape');
    p.assert.equal(await p.code(), 'print "a');
  });
}
