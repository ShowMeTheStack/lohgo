// The Files panel: opening and closing it, the tree, selection, keyboard, the disk note and
// files that programs write.
import { tidy, openFilesPanel, row, expand, refreshTree, put, rm, closeAll, disk, exists, tabNames } from './20-ed-lib.mjs';

const sideOpen = (p) => p.ev("!document.getElementById('side').classList.contains('closed')");
const rowNames = (p) => p.ev("[...document.querySelectorAll('#sideBody .trow')].map((r) => r.querySelector('.name').textContent)");
const rowPaths = (p) => p.ev("[...document.querySelectorAll('#sideBody .trow')].map((r) => r.dataset.path)");
const rowOf = (p, path) => p.fn((pa) => { const r = document.querySelector(`.trow[data-path="${pa}"]`); if (!r) return null; return { sel: r.classList.contains('sel'), open: r.classList.contains('open'), expanded: r.getAttribute('aria-expanded'), twisty: r.querySelector('.twisty').textContent, tag: (r.querySelector('.tag') || {}).textContent || '', pad: parseFloat(r.style.paddingLeft), weight: getComputedStyle(r.querySelector('.name')).fontWeight }; }, path);
async function focusRow(p, path) {
  await p.fn((pa) => document.querySelector(`.trow[data-path="${pa}"]`).focus(), path);
}

export default function (t) {
  t.beforeEach(async (p) => {
    await openFilesPanel(p);
    await rm(p, '/projects/t');
    await put(p, '/projects/t/b.lgo', 'print "b');
    await put(p, '/projects/t/a.lgo', 'print "a');
    await put(p, '/projects/t/notes.txt', 'some notes');
    await put(p, '/projects/t/data.bin', 'xx');
    await put(p, '/projects/t/sub/deep.lgo', 'print "deep');
    await expand(p, '/projects', '/projects/t');
    await p.fn(() => { LG.app.expanded.delete('/projects/t/sub'); LG.app.selectedPath = null; LG.app.renderSide(); });
  });
  t.afterEach(tidy);

  // ---- the panel -----------------------------------------------------------------------------------
  t.test('the Files panel is open on a wide screen', async (p) => {
    p.assert.equal(await sideOpen(p), true);
    p.assert.equal(await p.ev("document.getElementById('sideTitle').textContent"), 'Files');
  });
  t.test('the Files rail button is highlighted while the panel is open', async (p) => {
    p.assert.equal(await p.ev("document.getElementById('railFiles').classList.contains('active')"), true);
  });
  t.test('clicking the Files rail button closes the panel', async (p) => {
    await p.click('#railFiles');
    p.assert.equal(await sideOpen(p), false);
    p.assert.equal(await p.ev("document.getElementById('railFiles').classList.contains('active')"), false);
    await p.click('#railFiles');
    p.assert.equal(await sideOpen(p), true);
  });
  t.test('a closed panel stays closed after a reload', async (p) => {
    await p.click('#railFiles');
    await p.reload();
    p.assert.equal(await sideOpen(p), false);
    await p.click('#railFiles');
    await p.reload();
    p.assert.equal(await sideOpen(p), true);
  });
  t.test('the Procedures button swaps the panel to procedures and back', async (p) => {
    await p.click('#railProcs');
    p.assert.equal(await p.ev("document.getElementById('sideTitle').textContent"), 'Procedures');
    await p.click('#railFiles');
    p.assert.equal(await p.ev("document.getElementById('sideTitle').textContent"), 'Files');
    p.assert.ok(await p.count('#sideBody .trow') > 0);
  });
  t.test('the panel has four toolbar buttons with names', async (p) => {
    p.assert.deepEqual(await p.ev("[...document.querySelectorAll('#sideTools button')].map((b) => b.id + ':' + b.getAttribute('aria-label'))"),
      ['fNew:New program', 'fNewFolder:New folder', 'fImport:Bring files from your computer', 'fMount:Use a folder from your computer']);
  });
  t.test('the toolbar buttons do not multiply when the tree redraws', async (p) => {
    for (let i = 0; i < 3; i++) await p.click(row('/projects/t'));
    await refreshTree(p);
    p.assert.equal(await p.count('#sideTools button'), 4);
  });
  t.test('on a narrow screen the panel starts closed and floats', async (p) => {
    await p.fresh({ width: 1000, height: 800 });
    p.assert.equal(await sideOpen(p), false);
    await p.click('#railFiles');
    p.assert.equal(await sideOpen(p), true);
    await p.click('#editors');
    await p.sleep(80);
    p.assert.equal(await sideOpen(p), false);
    await p.fresh();
  }, { timeout: 40000 });

  // ---- the tree ------------------------------------------------------------------------------------------
  t.test('the top level shows examples and projects', async (p) => {
    const names = await p.ev("[...document.querySelectorAll('#sideBody .trow')].filter((r) => parseFloat(r.style.paddingLeft) === 8).map((r) => r.querySelector('.name').textContent)");
    p.assert.ok(names.includes('examples') && names.includes('projects'), names.join());
  });
  t.test('/examples is marked as originals', async (p) => {
    p.assert.equal((await rowOf(p, '/examples')).tag, 'originals');
  });
  t.test('/library is marked as originals once it exists', async (p) => {
    await p.ev("LG.Library.install(LG.app, LG.LIBRARY.items[0].path)");
    await refreshTree(p);
    p.assert.equal((await rowOf(p, '/library')).tag, 'originals');
  });
  t.test('/projects has no tag', async (p) => {
    p.assert.equal((await rowOf(p, '/projects')).tag, '');
  });
  t.test('folders come before files, files in name order', async (p) => {
    const paths = (await rowPaths(p)).filter((x) => /^\/projects\/t\/[^/]+$/.test(x));
    p.assert.deepEqual(paths, ['/projects/t/sub', '/projects/t/a.lgo', '/projects/t/b.lgo', '/projects/t/data.bin', '/projects/t/notes.txt']);
  });
  t.test('numbers in names sort as numbers', async (p) => {
    for (const n of [10, 2, 1]) await put(p, `/projects/t/n${n}.lgo`, '');
    await refreshTree(p);
    const paths = (await rowPaths(p)).filter((x) => /\/n\d+\.lgo$/.test(x));
    p.assert.deepEqual(paths, ['/projects/t/n1.lgo', '/projects/t/n2.lgo', '/projects/t/n10.lgo']);
  });
  t.test('an expanded folder shows an open twisty and aria-expanded', async (p) => {
    const r = await rowOf(p, '/projects/t');
    p.assert.equal(r.twisty, '▾');
    p.assert.equal(r.expanded, 'true');
  });
  t.test('a collapsed folder hides what is inside', async (p) => {
    const r = await rowOf(p, '/projects/t/sub');
    p.assert.equal(r.twisty, '▸');
    p.assert.equal(r.expanded, 'false');
    p.assert.equal(await p.exists(row('/projects/t/sub/deep.lgo')), false);
  });
  t.test('clicking a folder opens it', async (p) => {
    await p.click(row('/projects/t/sub'));
    p.assert.equal(await p.exists(row('/projects/t/sub/deep.lgo')), true);
    p.assert.equal((await rowOf(p, '/projects/t/sub')).twisty, '▾');
  });
  t.test('clicking an open folder closes it', async (p) => {
    await p.click(row('/projects/t'));
    p.assert.equal(await p.exists(row('/projects/t/a.lgo')), false);
  });
  t.test('nested rows are indented one step per level', async (p) => {
    await p.click(row('/projects/t/sub'));
    const a = (await rowOf(p, '/projects')).pad, b = (await rowOf(p, '/projects/t')).pad, c = (await rowOf(p, '/projects/t/sub')).pad, d = (await rowOf(p, '/projects/t/sub/deep.lgo')).pad;
    p.assert.deepEqual([b - a, c - b, d - c], [16, 16, 16]);
  });
  t.test('which folders are open is remembered after a reload', async (p) => {
    await p.click(row('/projects/t/sub'));
    await p.reload();
    await openFilesPanel(p);
    p.assert.equal(await p.exists(row('/projects/t/sub/deep.lgo')), true);
  });
  t.test('a closed folder stays closed after a reload', async (p) => {
    await p.click(row('/projects/t'));
    await p.reload();
    await openFilesPanel(p);
    p.assert.equal(await p.exists(row('/projects/t/a.lgo')), false);
  });
  t.test('clicking a program opens it in the editor', async (p) => {
    await p.click(row('/projects/t/a.lgo'));
    p.assert.equal(await p.activePath(), '/projects/t/a.lgo');
    p.assert.equal(await p.code(), 'print "a');
  });
  t.test('clicking a .txt file opens it too', async (p) => {
    await p.click(row('/projects/t/notes.txt'));
    p.assert.equal(await p.activePath(), '/projects/t/notes.txt');
  });
  t.test('clicking a file that is not a program only selects it', async (p) => {
    const before = await p.activePath();
    await p.click(row('/projects/t/data.bin'));
    p.assert.equal(await p.activePath(), before);
    p.assert.equal((await rowOf(p, '/projects/t/data.bin')).sel, true);
  });
  t.test('clicking a row selects it and only it', async (p) => {
    await p.click(row('/projects/t/sub'));
    await p.click(row('/projects/t/data.bin'));
    p.assert.equal(await p.count('#sideBody .trow.sel'), 1);
    p.assert.equal((await rowOf(p, '/projects/t/data.bin')).sel, true);
  });
  t.test('open files are shown in bold', async (p) => {
    await closeAll(p);
    await p.ev("LG.app.openFile('/projects/t/b.lgo')");
    await refreshTree(p);
    p.assert.equal((await rowOf(p, '/projects/t/b.lgo')).open, true);
    p.assert.equal((await rowOf(p, '/projects/t/b.lgo')).weight, '700');
    p.assert.equal((await rowOf(p, '/projects/t/a.lgo')).open, false);
    p.assert.notEqual((await rowOf(p, '/projects/t/a.lgo')).weight, '700');
  });
  t.test('closing a file takes away its bold', async (p) => {
    await closeAll(p);
    await p.click(row('/projects/t/a.lgo'));
    await p.click('#editorTabs .etab[title="/projects/t/a.lgo"] .x');
    await p.sleep(500);
    await refreshTree(p);
    p.assert.equal((await rowOf(p, '/projects/t/a.lgo')).open, false);
  });
  t.test('the tree shows a file the moment it is opened from the tree', async (p) => {
    await closeAll(p);
    await p.click(row('/projects/t/a.lgo'));
    await p.wait(`document.querySelector('.trow[data-path="/projects/t/a.lgo"]').classList.contains('open')`, 2000);
  });
  t.test('each row tells its full path in a tooltip', async (p) => {
    p.assert.equal(await p.attr(row('/projects/t/a.lgo'), 'title'), '/projects/t/a.lgo');
  });
  t.test('rows are tree items for screen readers', async (p) => {
    p.assert.equal(await p.attr('#sideBody .tree', 'role'), 'tree');
    p.assert.equal(await p.attr(row('/projects/t/a.lgo'), 'role'), 'treeitem');
  });
  t.test('folder and file rows have different icons', async (p) => {
    const a = await p.ev(`document.querySelector('.trow[data-path="/projects/t/sub"] svg').innerHTML`);
    const b = await p.ev(`document.querySelector('.trow[data-path="/projects/t/a.lgo"] svg').innerHTML`);
    p.assert.notEqual(a, b);
  });
  t.test('names keep their capitals', async (p) => {
    await put(p, '/projects/t/MyProgram.lgo', '');
    await refreshTree(p);
    p.assert.ok((await rowNames(p)).includes('MyProgram.lgo'));
  });
  t.test('the tree keeps its scroll position when it redraws', async (p) => {
    for (let i = 0; i < 60; i++) await put(p, `/projects/t/many/f${i}.lgo`, '');
    await expand(p, '/projects/t/many');
    await p.ev("document.getElementById('sideBody').scrollTop = 400");
    await refreshTree(p);
    p.assert.equal(await p.ev("document.getElementById('sideBody').scrollTop"), 400);
  });
  t.test('a long name is cut with an ellipsis, not widening the panel', async (p) => {
    await put(p, '/projects/t/' + 'very-long-name-'.repeat(6) + '.lgo', '');
    await refreshTree(p);
    p.assert.equal(await p.ev("document.getElementById('sideBody').scrollWidth <= document.getElementById('sideBody').clientWidth + 1"), true);
  });

  // ---- keyboard -----------------------------------------------------------------------------------------
  t.test('rows can be reached with Tab', async (p) => {
    p.assert.equal(await p.attr(row('/projects/t/a.lgo'), 'tabindex'), '0');
  });
  t.test('Enter on a program row opens it', async (p) => {
    await focusRow(p, '/projects/t/b.lgo');
    await p.key('Enter');
    p.assert.equal(await p.activePath(), '/projects/t/b.lgo');
  });
  t.test('Enter on a folder row opens the folder', async (p) => {
    await focusRow(p, '/projects/t/sub');
    await p.key('Enter');
    p.assert.equal(await p.exists(row('/projects/t/sub/deep.lgo')), true);
  });
  t.test('Delete on a row asks before deleting', async (p) => {
    await focusRow(p, '/projects/t/a.lgo');
    await p.key('Delete');
    p.assert.equal(await p.waitModal(), 'Delete?');
    p.assert.match(await p.modalText(), /Delete \/projects\/t\/a\.lgo\? This cannot be undone\./);
    await p.modalButton('Delete');
    p.assert.equal(await exists(p, '/projects/t/a.lgo'), false);
  });
  t.test('Backspace on a row asks before deleting too', async (p) => {
    await focusRow(p, '/projects/t/a.lgo');
    await p.key('Backspace');
    p.assert.equal(await p.waitModal(), 'Delete?');
    await p.modalButton('Cancel');
    p.assert.equal(await exists(p, '/projects/t/a.lgo'), true);
  });
  t.test('F2 on a row renames it', async (p) => {
    await focusRow(p, '/projects/t/a.lgo');
    await p.key('F2');
    p.assert.equal(await p.waitModal(), 'Rename');
    p.assert.equal(await p.ev("document.querySelector('.modal input').value"), 'a.lgo');
    await p.modalInput('z.lgo');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.equal(await exists(p, '/projects/t/z.lgo'), true);
    p.assert.equal(await exists(p, '/projects/t/a.lgo'), false);
  });
  t.test('F2 on an original is refused without asking', async (p) => {
    await focusRow(p, '/examples/spiral.lgo');
    await p.key('F2');
    await p.waitToast(/kept safe/);
    p.assert.equal(await p.modalOpen(), false);
  });
  t.test('F2 on the examples folder is refused', async (p) => {
    await focusRow(p, '/examples');
    await p.key('F2');
    await p.waitToast(/kept safe/);
    p.assert.equal(await exists(p, '/examples'), true);
  });
  t.test('F2 on /projects is refused', async (p) => {
    await focusRow(p, '/projects');
    await p.key('F2');
    await p.waitToast(/kept safe/);
    p.assert.equal(await p.modalOpen(), false);
  });
  t.test('Delete on an original is refused', async (p) => {
    await focusRow(p, '/examples/spiral.lgo');
    await p.key('Delete');
    await p.waitToast(/kept safe/);
    p.assert.equal(await exists(p, '/examples/spiral.lgo'), true);
  });
  t.test('Delete on /projects is refused', async (p) => {
    await focusRow(p, '/projects');
    await p.key('Delete');
    await p.waitToast(/kept safe/);
    p.assert.equal(await exists(p, '/projects'), true);
  });
  t.test('Delete on /examples is refused', async (p) => {
    await focusRow(p, '/examples');
    await p.key('Delete');
    await p.waitToast(/kept safe/);
    p.assert.equal(await exists(p, '/examples'), true);
  });
  t.test('keys on a tree row do not reach the editor', async (p) => {
    await p.ev("LG.app.openFile('/projects/t/b.lgo')");
    await focusRow(p, '/projects/t/a.lgo');
    await p.key('x');
    p.assert.equal(await p.code(), 'print "b');
  });

  // ---- the disk note --------------------------------------------------------------------------------------
  t.test('the note under the tree explains where programs live', async (p) => {
    p.assert.match(await p.text('#sideBody .side-note'), /Your programs live in this browser\./);
    p.assert.match(await p.text('#sideBody .side-note'), /Right-click \(or long-press\)/);
  });
  t.test('the note shows how much of the disk is used', async (p) => {
    const kb = await p.ev('Math.round(LG.app.vfs.used() / 1024)');
    p.assert.match(await p.text('#sideBody .side-note'), new RegExp('\\b' + kb + ' KB used\\.'));
  });
  t.test('the used amount grows when a big file is added', async (p) => {
    const before = await p.ev('Math.round(LG.app.vfs.used() / 1024)');
    await put(p, '/projects/t/big.txt', 'x'.repeat(300 * 1024));
    await refreshTree(p);
    const m = /(\d+) KB used/.exec(await p.text('#sideBody .side-note'));
    p.assert.ok(+m[1] >= before + 299, m[1] + ' vs ' + before);
  });

  // ---- files written by programs ------------------------------------------------------------------------------
  t.test('a file a program writes appears in the tree', async (p) => {
    await p.runProgram('openwrite "/projects/t/out.txt\nsetwrite "/projects/t/out.txt\nprint "hello\nsetwrite []\nclose "/projects/t/out.txt\n', { path: '/projects/t/writer.lgo' });
    p.assert.equal(await p.state(), 'idle', await p.output());
    await p.wait(`!!document.querySelector('.trow[data-path="/projects/t/out.txt"]')`, 3000);
    p.assert.equal(await disk(p, '/projects/t/out.txt'), 'hello\n');
  });
  t.test('a file a program deletes disappears from the tree', async (p) => {
    await p.runProgram('erasefile "/projects/t/notes.txt\n', { path: '/projects/t/eraser.lgo' });
    p.assert.equal(await p.state(), 'idle', await p.output());
    await p.wait(`!document.querySelector('.trow[data-path="/projects/t/notes.txt"]')`, 3000);
  });
  t.test('SAVE from the command center shows the new file', async (p) => {
    await p.command('define "hello [[] [print "hi]]');
    await p.command('save "/projects/t/saved.lgo');
    await p.wait(`!!document.querySelector('.trow[data-path="/projects/t/saved.lgo"]')`, 3000);
    p.assert.match(await disk(p, '/projects/t/saved.lgo'), /to hello/i);
  });
  t.test('a folder a program makes appears in the tree', async (p) => {
    await p.command('mkdir "/projects/t/made');
    p.assert.equal(await p.state(), 'idle', await p.output());
    await p.wait(`!!document.querySelector('.trow[data-path="/projects/t/made"]')`, 3000);
  });
  t.test('an open file a program rewrites is updated in the editor', async (p) => {
    await p.ev("LG.app.openFile('/projects/t/notes.txt')");
    await p.runProgram('openwrite "/projects/t/notes.txt\nsetwrite "/projects/t/notes.txt\nprint "new\nsetwrite []\nclose "/projects/t/notes.txt\n', { path: '/projects/t/writer.lgo' });
    await p.ev("LG.app.openFile('/projects/t/notes.txt')");
    await p.wait("LG.app.active.editor.getValue() === 'new\\n'", 3000);
  });
  t.test('the tree does not grow open-file marks for files only in the tree', async (p) => {
    await closeAll(p);
    await refreshTree(p);
    p.assert.equal(await p.count('#sideBody .trow.open'), 0);
    p.assert.deepEqual(await tabNames(p), []);
  });
}
