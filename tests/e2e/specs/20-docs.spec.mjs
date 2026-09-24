// Documents: tabs, new, save, save as, originals, closing with changes, autosave, the session
// across reloads and the empty editor.
import { tidy, tabs, tabNames, tabSel, docPaths, disk, exists, closeAll, put, rm, setCursor, rendered, clickAt } from './20-ed-lib.mjs';

const active = (p) => p.ev('LG.app.active ? LG.app.active.path : null');
const dirty = (p, path) => p.fn((pa) => { const d = LG.app.docByPath(pa); return d ? d.dirty : null; }, path);
const promptValue = () => "document.querySelector('.modal-back:last-child .modal input').value";
const modalButtons = (p) => p.ev("[...document.querySelectorAll('.modal-back:last-child .modal-foot button')].map((b) => b.innerText)");
const unloadBlocked = (p) => p.ev("(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; })()");
async function typeInto(p, text) { await setCursor(p, 0, 0); await p.insertText(text); }
async function clean(p) {
  await closeAll(p);
  for (const d of ['/projects/d', '/projects/untitled.lgo', '/projects/untitled2.lgo', '/projects/untitled3.lgo', '/projects/games', '/art', '/projects/spiral.lgo', '/projects/spiral-2.lgo', '/projects/flower.lgo', '/projects/flower-2.lgo', '/projects/mine', '/projects/copy.lgo']) await rm(p, d);
}
async function newProgramPrompt(p) {
  await p.key('n', { alt: true });
  return p.waitModal();
}

export default function (t) {
  t.beforeEach(clean);
  t.afterEach(tidy);

  // ---- tabs -------------------------------------------------------------------------------------------
  t.test('each open file has a tab named after it', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'print 1');
    await p.newFile('/projects/d/two.lgo', 'print 2');
    p.assert.deepEqual(await tabNames(p), ['one.lgo', 'two.lgo']);
  });
  t.test('a tab shows the full path as its tooltip', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'print 1');
    p.assert.equal((await tabs(p))[0].title, '/projects/d/one.lgo');
  });
  t.test('the newest file is the active tab', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'print 1');
    await p.newFile('/projects/d/two.lgo', 'print 2');
    p.assert.deepEqual((await tabs(p)).map((x) => x.active), [false, true]);
  });
  t.test('clicking a tab switches to that file', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'print 1');
    await p.newFile('/projects/d/two.lgo', 'print 2');
    await p.click(tabSel('/projects/d/one.lgo'));
    p.assert.equal(await active(p), '/projects/d/one.lgo');
    p.assert.equal(await p.code(), 'print 1');
  });
  t.test('only the active file\'s editor is visible', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'print 1');
    await p.newFile('/projects/d/two.lgo', 'print 2');
    await p.click(tabSel('/projects/d/one.lgo'));
    p.assert.equal(await p.ev("[...document.querySelectorAll('#editors .ed')].filter((e) => e.style.display !== 'none').length"), 1);
    p.assert.equal(await p.ev("[...document.querySelectorAll('#editors .ed')].find((e) => e.style.display !== 'none').querySelector('textarea').value"), 'print 1');
  });
  t.test('clicking a tab puts the caret in its editor', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'print 1');
    await p.newFile('/projects/d/two.lgo', 'print 2');
    await p.click(tabSel('/projects/d/one.lgo'));
    p.assert.equal(await p.ev('document.activeElement === LG.app.active.editor.ta'), true);
  });
  t.test('the top bar and window title name the active file', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'print 1');
    p.assert.equal(await p.text('#proj'), '/projects/d/one.lgo');
    p.assert.equal(await p.ev('document.title'), 'one.lgo · Lohgo');
  });
  t.test('each tab keeps its own caret and scroll position', async (p) => {
    await p.newFile('/projects/d/one.lgo', Array.from({ length: 200 }, (_, i) => 'print ' + i).join('\n'));
    await setCursor(p, 150, 2);
    await p.newFile('/projects/d/two.lgo', 'print 2');
    await p.click(tabSel('/projects/d/one.lgo'));
    p.assert.equal(await p.ev('LG.app.active.editor.cursor().line'), 150);
    p.assert.ok(await p.ev('LG.app.active.editor.ta.scrollTop') > 0);
  });
  t.test('the close button on a tab closes it', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'print 1');
    await p.newFile('/projects/d/two.lgo', 'print 2');
    await p.click(tabSel('/projects/d/one.lgo') + ' .x');
    p.assert.deepEqual(await tabNames(p), ['two.lgo']);
  });
  t.test('closing the active tab activates its left neighbour', async (p) => {
    await p.newFile('/projects/d/one.lgo', '1');
    await p.newFile('/projects/d/two.lgo', '2');
    await p.newFile('/projects/d/three.lgo', '3');
    await p.click(tabSel('/projects/d/two.lgo'));
    await p.click(tabSel('/projects/d/two.lgo') + ' .x');
    p.assert.equal(await active(p), '/projects/d/one.lgo');
  });
  t.test('closing the first tab activates the next one', async (p) => {
    await p.newFile('/projects/d/one.lgo', '1');
    await p.newFile('/projects/d/two.lgo', '2');
    await p.click(tabSel('/projects/d/one.lgo'));
    await p.click(tabSel('/projects/d/one.lgo') + ' .x');
    p.assert.equal(await active(p), '/projects/d/two.lgo');
  });
  t.test('closing an inactive tab keeps the active one', async (p) => {
    await p.newFile('/projects/d/one.lgo', '1');
    await p.newFile('/projects/d/two.lgo', '2');
    await p.click(tabSel('/projects/d/one.lgo') + ' .x');
    p.assert.equal(await active(p), '/projects/d/two.lgo');
  });
  t.test('a middle click on a tab closes it', async (p) => {
    await p.newFile('/projects/d/one.lgo', '1');
    await p.newFile('/projects/d/two.lgo', '2');
    const [x, y] = await p.center(tabSel('/projects/d/one.lgo'));
    await p.mouse('mouseMoved', x, y);
    await p.mouse('mousePressed', x, y, 'middle');
    await p.mouse('mouseReleased', x, y, 'middle');
    await p.sleep(80);
    p.assert.deepEqual(await tabNames(p), ['two.lgo']);
  });
  t.test('a right click on a tab does not close it', async (p) => {
    await p.newFile('/projects/d/one.lgo', '1');
    await p.rightClick(tabSel('/projects/d/one.lgo'));
    p.assert.deepEqual(await tabNames(p), ['one.lgo']);
  });
  t.test('Alt+W closes the active file', async (p) => {
    await p.newFile('/projects/d/one.lgo', '1');
    await p.newFile('/projects/d/two.lgo', '2');
    await p.key('w', { alt: true });
    p.assert.deepEqual(await tabNames(p), ['one.lgo']);
  });
  t.test('Close in the menu closes the active file', async (p) => {
    await p.newFile('/projects/d/one.lgo', '1');
    await p.menu('Close');
    p.assert.deepEqual(await tabNames(p), []);
  });
  t.test('a changed file shows a dot on its tab', async (p) => {
    await p.newFile('/projects/d/one.lgo', '1');
    await typeInto(p, 'x');
    p.assert.equal((await tabs(p))[0].dirty, true);
  });
  t.test('saving removes the dot', async (p) => {
    await p.newFile('/projects/d/one.lgo', '1');
    await typeInto(p, 'x');
    await p.key('s', { ctrl: true });
    p.assert.equal((await tabs(p))[0].dirty, false);
  });
  t.test('originals have a diamond on their tab', async (p) => {
    await p.ev("LG.app.openFile('/examples/spiral.lgo')");
    const t0 = (await tabs(p)).find((x) => x.title === '/examples/spiral.lgo');
    p.assert.equal(t0.lock, true);
    p.assert.equal(await p.attr(tabSel('/examples/spiral.lgo') + ' .lock', 'title'), 'An original: saving makes your own copy');
  });
  t.test('own programs have no diamond', async (p) => {
    await p.newFile('/projects/d/one.lgo', '1');
    p.assert.equal((await tabs(p))[0].lock, false);
  });
  t.test('opening a file that is already open switches to its tab', async (p) => {
    await p.newFile('/projects/d/one.lgo', '1');
    await p.newFile('/projects/d/two.lgo', '2');
    await p.ev("LG.app.openFile('/projects/d/ONE.lgo')");
    p.assert.equal((await tabNames(p)).length, 2);
    p.assert.equal(await active(p), '/projects/d/one.lgo');
  });
  t.test('many tabs do not push the page wider', async (p) => {
    for (let i = 0; i < 14; i++) await put(p, `/projects/d/a-rather-long-file-name-${i}.lgo`, 'print ' + i);
    await p.ev("for (let i = 0; i < 14; i++) LG.app.openFile('/projects/d/a-rather-long-file-name-' + i + '.lgo')");
    p.assert.equal(await p.noHScroll(), true);
    p.assert.equal((await tabNames(p)).length, 14);
  });

  // ---- New program -------------------------------------------------------------------------------------
  t.test('Alt+N asks for a name with untitled.lgo ready', async (p) => {
    p.assert.equal(await newProgramPrompt(p), 'New program');
    p.assert.equal(await p.ev(promptValue()), 'untitled.lgo');
  });
  t.test('the new program prompt says which folder it goes in', async (p) => {
    await newProgramPrompt(p);
    p.assert.match(await p.modalText(), /It goes in \/projects/);
  });
  t.test('Enter makes the program, opens it and puts the caret in the procedure', async (p) => {
    await newProgramPrompt(p);
    await p.key('Enter');
    await p.sleep(100);
    p.assert.equal(await active(p), '/projects/untitled.lgo');
    p.assert.equal(await exists(p, '/projects/untitled.lgo'), true);
    p.assert.match(await p.code(), /^; untitled\.lgo\n\nto start\n {2}repeat 4 \[fd 100 rt 90\]\nend\n\nstart\n$/);
    p.assert.deepEqual(await p.ev('LG.app.active.editor.cursor()'), { line: 3, col: 2 });
  });
  t.test('a new program runs straight away', async (p) => {
    await newProgramPrompt(p);
    await p.key('Enter');
    await p.sleep(100);
    await p.key('F5');
    await p.waitState('idle');
    p.assert.equal(await p.segments(), 4);
  });
  t.test('the second new program is called untitled2.lgo', async (p) => {
    await put(p, '/projects/untitled.lgo', 'x');
    await newProgramPrompt(p);
    p.assert.equal(await p.ev(promptValue()), 'untitled2.lgo');
  });
  t.test('an open but unsaved untitled.lgo also counts as taken', async (p) => {
    await p.ev("LG.app.newScratch('', 'untitled')");
    await newProgramPrompt(p);
    p.assert.equal(await p.ev(promptValue()), 'untitled2.lgo');
    await p.key('Escape');
  });
  t.test('a name without .lgo gets .lgo added', async (p) => {
    await newProgramPrompt(p);
    await p.modalInput('spiral');
    await p.key('Enter');
    await p.sleep(80);
    p.assert.equal(await active(p), '/projects/spiral.lgo');
  });
  t.test('a name with a folder makes the folder', async (p) => {
    await newProgramPrompt(p);
    await p.modalInput('games/maze');
    await p.key('Enter');
    await p.sleep(80);
    p.assert.equal(await active(p), '/projects/games/maze.lgo');
    p.assert.equal(await p.ev("LG.app.vfs.isDir('/projects/games')"), true);
  });
  t.test('a full path puts the program there', async (p) => {
    await newProgramPrompt(p);
    await p.modalInput('/art/sun.lgo');
    await p.key('Enter');
    await p.sleep(80);
    p.assert.equal(await active(p), '/art/sun.lgo');
    p.assert.equal(await exists(p, '/art/sun.lgo'), true);
  });
  t.test('a new program may not go into /examples', async (p) => {
    await newProgramPrompt(p);
    await p.modalInput('/examples/mine.lgo');
    await p.key('Enter');
    await p.waitToast(/Pick a folder outside/);
    p.assert.equal(await exists(p, '/examples/mine.lgo'), false);
  });
  t.test('a new program may not go into /library or /lessons', async (p) => {
    for (const dir of ['/library', '/lessons']) {
      await newProgramPrompt(p);
      await p.modalInput(dir + '/mine.lgo');
      await p.key('Enter');
      await p.waitToast(/Pick a folder outside/);
      p.assert.equal(await exists(p, dir + '/mine.lgo'), false);
    }
  });
  t.test('naming an existing program opens it without changing it', async (p) => {
    await put(p, '/projects/d/keep.lgo', 'print "kept');
    await newProgramPrompt(p);
    await p.modalInput('/projects/d/keep.lgo');
    await p.key('Enter');
    await p.sleep(80);
    p.assert.equal(await p.code(), 'print "kept');
    p.assert.equal(await disk(p, '/projects/d/keep.lgo'), 'print "kept');
  });
  t.test('Cancel makes nothing', async (p) => {
    const before = await docPaths(p);
    await newProgramPrompt(p);
    await p.modalButton('Cancel');
    p.assert.deepEqual(await docPaths(p), before);
    p.assert.equal(await exists(p, '/projects/untitled.lgo'), false);
  });
  t.test('Escape makes nothing', async (p) => {
    await newProgramPrompt(p);
    await p.key('Escape');
    p.assert.equal(await exists(p, '/projects/untitled.lgo'), false);
  });
  t.test('a bad file name is refused with a message', async (p) => {
    await newProgramPrompt(p);
    await p.modalInput('what?.lgo');
    await p.key('Enter');
    await p.waitToast(/Could not make that program/);
  });
  t.test('the new program goes next to the active program', async (p) => {
    await p.newFile('/projects/d/one.lgo', '1');
    await newProgramPrompt(p);
    p.assert.match(await p.modalText(), /It goes in \/projects\/d\b/);
    await p.key('Enter');
    await p.sleep(80);
    p.assert.equal(await active(p), '/projects/d/untitled.lgo');
  });
  t.test('when an original is active the new program goes to /projects', async (p) => {
    await p.ev("LG.app.openFile('/examples/spiral.lgo')");
    await newProgramPrompt(p);
    p.assert.match(await p.modalText(), /It goes in \/projects\./);
  });
  t.test('the New program button by the tabs works', async (p) => {
    await p.click('#tbNew');
    p.assert.equal(await p.waitModal(), 'New program');
    await p.key('Enter');
    await p.sleep(80);
    p.assert.equal(await p.ev('LG.app.active.name'), 'untitled.lgo');
  });
  t.test('New program in the menu works', async (p) => {
    await p.menu('New program');
    p.assert.equal(await p.waitModal(), 'New program');
  });
  t.test('the menu shows Alt+N for New program', async (p) => {
    await p.click('#menuBtn');
    await p.wait("!!document.querySelector('.menu-pop')");
    const it = (await p.menuItems()).find((x) => x.label === 'New program');
    p.assert.equal(it.sc, 'Alt+N');
  });
  t.test('a new program appears in the Files panel', async (p) => {
    if (await p.ev("document.getElementById('side').classList.contains('closed')")) await p.click('#railFiles');
    await newProgramPrompt(p);
    await p.modalInput('spiral');
    await p.key('Enter');
    await p.wait("!!document.querySelector('.trow[data-path=\"/projects/spiral.lgo\"]')", 3000);
  });

  // ---- Save -------------------------------------------------------------------------------------------------
  t.test('Ctrl+S writes the file', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'print 1');
    await typeInto(p, 'fd 1\n');
    await p.key('s', { ctrl: true });
    p.assert.equal(await disk(p, '/projects/d/one.lgo'), 'fd 1\nprint 1');
  });
  t.test('Ctrl+S says it saved in the status bar', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'print 1');
    await typeInto(p, 'x');
    await p.key('s', { ctrl: true });
    p.assert.equal(await p.status(), 'Saved /projects/d/one.lgo');
  });
  t.test('Ctrl+S does not type an s', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'print 1');
    await setCursor(p, 0, 0);
    await p.key('s', { ctrl: true });
    p.assert.equal(await p.code(), 'print 1');
  });
  t.test('the Save button saves', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await typeInto(p, 'b');
    await p.click('#tbSave');
    p.assert.equal(await disk(p, '/projects/d/one.lgo'), 'ba');
  });
  t.test('Save in the menu saves', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await typeInto(p, 'c');
    await p.menu('Save');
    p.assert.equal(await disk(p, '/projects/d/one.lgo'), 'ca');
  });
  t.test('Save only saves the active file', async (p) => {
    await p.ev('LG.app.settings.autosave = false');
    try {
      await p.newFile('/projects/d/one.lgo', 'a');
      await typeInto(p, 'x');
      await p.newFile('/projects/d/two.lgo', 'b');
      await typeInto(p, 'y');
      await p.key('s', { ctrl: true });
      p.assert.equal(await disk(p, '/projects/d/two.lgo'), 'yb');
      p.assert.equal(await disk(p, '/projects/d/one.lgo'), 'a');
    } finally { await p.ev('LG.app.settings.autosave = true'); }
  });
  t.test('a saved file survives a reload', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await typeInto(p, 'saved ');
    await p.key('s', { ctrl: true });
    await p.sleep(300);
    await p.reload();
    p.assert.equal(await disk(p, '/projects/d/one.lgo'), 'saved a');
  });
  t.test('saving recreates a folder that was deleted meanwhile', async (p) => {
    await p.newFile('/projects/d/sub/one.lgo', 'a');
    await typeInto(p, 'b');
    await p.ev("LG.app.vfs.rmdir('/projects/d/sub', { recursive: true, trusted: true })");
    await p.key('s', { ctrl: true });
    p.assert.equal(await disk(p, '/projects/d/sub/one.lgo'), 'ba');
  });

  // ---- Save as ----------------------------------------------------------------------------------------------
  t.test('Ctrl+Shift+S asks for a new name with the current path ready', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await p.key('s', { ctrl: true, shift: true });
    p.assert.equal(await p.waitModal(), 'Save as');
    p.assert.equal(await p.ev(promptValue()), '/projects/d/one.lgo');
  });
  t.test('Save as with a plain name saves next to the current file', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await p.key('s', { ctrl: true, shift: true });
    await p.waitModal();
    await p.modalInput('copy.lgo');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.equal(await active(p), '/projects/d/copy.lgo');
    p.assert.equal(await disk(p, '/projects/d/copy.lgo'), 'a');
  });
  t.test('Save as keeps the old file on the disk', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await typeInto(p, 'new ');
    await p.key('s', { ctrl: true, shift: true });
    await p.waitModal();
    await p.modalInput('copy');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.equal(await disk(p, '/projects/d/copy.lgo'), 'new a');
    p.assert.equal(await disk(p, '/projects/d/one.lgo'), 'a');
  });
  t.test('Save as renames the tab', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await p.key('s', { ctrl: true, shift: true });
    await p.waitModal();
    await p.modalInput('other');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.deepEqual(await tabNames(p), ['other.lgo']);
  });
  t.test('Save as with a full path puts it in that folder', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await p.key('s', { ctrl: true, shift: true });
    await p.waitModal();
    await p.modalInput('/projects/mine/art/pic.lgo');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.equal(await disk(p, '/projects/mine/art/pic.lgo'), 'a');
  });
  t.test('Save as with a relative folder works from the current folder', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await p.key('s', { ctrl: true, shift: true });
    await p.waitModal();
    await p.modalInput('sub/x');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.equal(await active(p), '/projects/d/sub/x.lgo');
  });
  t.test('Save as onto an existing file asks first', async (p) => {
    await put(p, '/projects/d/there.lgo', 'old');
    await p.newFile('/projects/d/one.lgo', 'new');
    await p.key('s', { ctrl: true, shift: true });
    await p.waitModal();
    await p.modalInput('there.lgo');
    await p.key('Enter');
    p.assert.equal(await p.waitModal(), 'Replace?');
    p.assert.match(await p.modalText(), /\/projects\/d\/there\.lgo already exists/);
  });
  t.test('Replace overwrites the existing file', async (p) => {
    await put(p, '/projects/d/there.lgo', 'old');
    await p.newFile('/projects/d/one.lgo', 'new');
    await p.key('s', { ctrl: true, shift: true });
    await p.waitModal();
    await p.modalInput('there.lgo');
    await p.key('Enter');
    await p.waitModal();
    await p.modalButton('Replace');
    p.assert.equal(await disk(p, '/projects/d/there.lgo'), 'new');
    p.assert.equal(await active(p), '/projects/d/there.lgo');
  });
  t.test('Cancel on Replace? leaves both files alone', async (p) => {
    await put(p, '/projects/d/there.lgo', 'old');
    await p.newFile('/projects/d/one.lgo', 'new');
    await p.key('s', { ctrl: true, shift: true });
    await p.waitModal();
    await p.modalInput('there.lgo');
    await p.key('Enter');
    await p.waitModal();
    await p.modalButton('Cancel');
    p.assert.equal(await disk(p, '/projects/d/there.lgo'), 'old');
    p.assert.equal(await active(p), '/projects/d/one.lgo');
  });
  t.test('Save as onto a file open in another tab replaces that tab', async (p) => {
    await p.newFile('/projects/d/there.lgo', 'old');
    await p.newFile('/projects/d/one.lgo', 'new');
    await p.key('s', { ctrl: true, shift: true });
    await p.waitModal();
    await p.modalInput('there.lgo');
    await p.key('Enter');
    await p.waitModal();
    await p.modalButton('Replace');
    p.assert.deepEqual(await tabNames(p), ['there.lgo']);
    p.assert.equal(await p.code(), 'new');
  });
  t.test('Save as to the same name just saves', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await typeInto(p, 'b');
    await p.key('s', { ctrl: true, shift: true });
    await p.waitModal();
    await p.key('Enter');
    await p.sleep(100);
    p.assert.equal(await p.modalOpen(), false);
    p.assert.equal(await disk(p, '/projects/d/one.lgo'), 'ba');
  });
  t.test('Save as into /examples is refused', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await p.key('s', { ctrl: true, shift: true });
    await p.waitModal();
    await p.modalInput('/examples/one.lgo');
    await p.key('Enter');
    await p.waitToast(/Pick a folder outside/);
    p.assert.equal(await active(p), '/projects/d/one.lgo');
  });
  t.test('Save as with a bad name is refused', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await p.key('s', { ctrl: true, shift: true });
    await p.waitModal();
    await p.modalInput('a|b');
    await p.key('Enter');
    await p.waitToast(/not a usable file name/);
  });
  t.test('Save as keeps the breakpoints', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a\nb');
    await p.ev("LG.app.toggleBreakpoint('/projects/d/one.lgo', 1)");
    await p.key('s', { ctrl: true, shift: true });
    await p.waitModal();
    await p.modalInput('two');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.deepEqual(await p.ev("[...(LG.app.breakpoints.get('/projects/d/two.lgo') || new Map()).keys()]"), [1]);
    await p.ev('LG.app.clearBreakpoints()');
  });
  t.test('Save as in the menu works', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await p.menu('Save as');
    p.assert.equal(await p.waitModal(), 'Save as');
  });
  t.test('Save as says where it saved', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await p.key('s', { ctrl: true, shift: true });
    await p.waitModal();
    await p.modalInput('two');
    await p.key('Enter');
    await p.waitToast(/Saved \/projects\/d\/two\.lgo/);
  });

  // ---- originals --------------------------------------------------------------------------------------------
  t.test('an original can be edited', async (p) => {
    await p.ev("LG.app.openFile('/examples/spiral.lgo')");
    await typeInto(p, '; mine\n');
    p.assert.match(await p.code(), /^; mine\n/);
    p.assert.equal((await tabs(p)).find((x) => x.title === '/examples/spiral.lgo').dirty, true);
  });
  t.test('a changed original runs with the changes', async (p) => {
    await p.ev("LG.app.openFile('/examples/spiral.lgo')");
    await p.setCode('print "changed\n');
    await p.key('F5');
    await p.waitOutput(/^changed$/m);
  });
  t.test('Ctrl+S on an original asks for a name in /projects', async (p) => {
    await p.ev("LG.app.openFile('/examples/spiral.lgo')");
    await typeInto(p, 'x');
    await p.key('s', { ctrl: true });
    p.assert.equal(await p.waitModal(), 'Save your own copy');
    p.assert.equal(await p.ev(promptValue()), '/projects/spiral.lgo');
  });
  t.test('saving an original writes a copy to /projects and keeps the original', async (p) => {
    const orig = await disk(p, '/examples/spiral.lgo');
    await p.ev("LG.app.openFile('/examples/spiral.lgo')");
    await typeInto(p, '; mine\n');
    await p.key('s', { ctrl: true });
    await p.waitModal();
    await p.key('Enter');
    await p.sleep(120);
    p.assert.equal(await disk(p, '/examples/spiral.lgo'), orig);
    p.assert.equal(await disk(p, '/projects/spiral.lgo'), '; mine\n' + orig);
    p.assert.equal(await active(p), '/projects/spiral.lgo');
  });
  t.test('after saving a copy the tab loses its diamond', async (p) => {
    await p.ev("LG.app.openFile('/examples/spiral.lgo')");
    await typeInto(p, 'x');
    await p.key('s', { ctrl: true });
    await p.waitModal();
    await p.key('Enter');
    await p.sleep(120);
    const t0 = await tabs(p);
    p.assert.equal(t0.find((x) => x.active).lock, false);
    p.assert.equal(t0.find((x) => x.active).dirty, false);
  });
  t.test('the suggested copy name skips names already used', async (p) => {
    await put(p, '/projects/spiral.lgo', 'mine');
    await p.ev("LG.app.openFile('/examples/spiral.lgo')");
    await typeInto(p, 'x');
    await p.key('s', { ctrl: true });
    await p.waitModal();
    p.assert.equal(await p.ev(promptValue()), '/projects/spiral-2.lgo');
  });
  t.test('a plain name for the copy goes into /projects', async (p) => {
    await p.ev("LG.app.openFile('/examples/spiral.lgo')");
    await typeInto(p, 'x');
    await p.key('s', { ctrl: true });
    await p.waitModal();
    await p.modalInput('copy');
    await p.key('Enter');
    await p.sleep(120);
    p.assert.equal(await active(p), '/projects/copy.lgo');
  });
  t.test('the copy cannot be saved back into /examples', async (p) => {
    await p.ev("LG.app.openFile('/examples/spiral.lgo')");
    await typeInto(p, 'x');
    await p.key('s', { ctrl: true });
    await p.waitModal();
    await p.modalInput('/examples/spiral.lgo');
    await p.key('Enter');
    await p.waitToast(/Pick a folder outside/);
    p.assert.equal(await active(p), '/examples/spiral.lgo');
  });
  t.test('cancelling the copy keeps the changed original open', async (p) => {
    await p.ev("LG.app.openFile('/examples/spiral.lgo')");
    await typeInto(p, 'x');
    await p.key('s', { ctrl: true });
    await p.waitModal();
    await p.key('Escape');
    p.assert.equal(await active(p), '/examples/spiral.lgo');
    p.assert.equal(await dirty(p, '/examples/spiral.lgo'), true);
  });
  t.test('autosave never writes to an original', async (p) => {
    const orig = await disk(p, '/examples/spiral.lgo');
    await p.ev("LG.app.openFile('/examples/spiral.lgo')");
    await typeInto(p, 'x');
    await p.ev('LG.app.autosaveAll()');
    p.assert.equal(await disk(p, '/examples/spiral.lgo'), orig);
  });
  t.test('a library program is an original too', async (p) => {
    await p.ev("LG.Library.open(LG.app, LG.LIBRARY.items[0].path)");
    await p.wait("LG.app.active && LG.app.active.path.startsWith('/library/')");
    p.assert.equal((await tabs(p)).find((x) => x.active).lock, true);
    await typeInto(p, 'x');
    await p.key('s', { ctrl: true });
    p.assert.equal(await p.waitModal(), 'Save your own copy');
    p.assert.match(await p.ev(promptValue()), /^\/projects\//);
  });
  t.test('a lesson file is an original too', async (p) => {
    await p.ev("LG.app.vfs.mkdir('/lessons', { exist: true, trusted: true, readOnly: true }); LG.app.vfs.writeText('/lessons/test.lgo', 'print 1', { trusted: true, readOnly: true }); LG.app.openFile('/lessons/test.lgo')");
    p.assert.equal((await tabs(p)).find((x) => x.active).lock, true);
    await typeInto(p, 'x');
    await p.key('s', { ctrl: true });
    p.assert.equal(await p.waitModal(), 'Save your own copy');
    p.assert.equal(await p.ev(promptValue()), '/projects/test.lgo');
  });

  // ---- closing with changes ---------------------------------------------------------------------------------
  t.test('closing a changed original asks Keep your changes?', async (p) => {
    await p.ev("LG.app.openFile('/examples/spiral.lgo')");
    await typeInto(p, 'x');
    await p.click(tabSel('/examples/spiral.lgo') + ' .x');
    p.assert.equal(await p.waitModal(), 'Keep your changes?');
    p.assert.deepEqual(await modalButtons(p), ['Cancel', 'Throw them away', 'Save my copy…']);
  });
  t.test('Throw them away closes the original unchanged', async (p) => {
    const orig = await disk(p, '/examples/spiral.lgo');
    await p.ev("LG.app.openFile('/examples/spiral.lgo')");
    await typeInto(p, 'x');
    await p.click(tabSel('/examples/spiral.lgo') + ' .x');
    await p.waitModal();
    await p.modalButton('Throw them away');
    p.assert.equal(await p.ev("!!LG.app.docByPath('/examples/spiral.lgo')"), false);
    p.assert.equal(await disk(p, '/examples/spiral.lgo'), orig);
  });
  t.test('Save my copy saves to /projects and closes the tab', async (p) => {
    await p.ev("LG.app.openFile('/examples/spiral.lgo')");
    await typeInto(p, '; changed\n');
    await p.click(tabSel('/examples/spiral.lgo') + ' .x');
    await p.waitModal();
    await p.modalButton('Save my copy');
    p.assert.equal(await p.waitModal(), 'Save your own copy');
    await p.key('Enter');
    await p.sleep(120);
    p.assert.match(await disk(p, '/projects/spiral.lgo'), /^; changed\n/);
    p.assert.equal(await p.ev("!!LG.app.docByPath('/examples/spiral.lgo')"), false);
  });
  t.test('Cancel on Keep your changes? keeps the tab', async (p) => {
    await p.ev("LG.app.openFile('/examples/spiral.lgo')");
    await typeInto(p, 'x');
    await p.click(tabSel('/examples/spiral.lgo') + ' .x');
    await p.waitModal();
    await p.modalButton('Cancel');
    p.assert.equal(await dirty(p, '/examples/spiral.lgo'), true);
  });
  t.test('cancelling the name after Save my copy keeps the tab', async (p) => {
    await p.ev("LG.app.openFile('/examples/spiral.lgo')");
    await typeInto(p, 'x');
    await p.click(tabSel('/examples/spiral.lgo') + ' .x');
    await p.waitModal();
    await p.modalButton('Save my copy');
    await p.waitModal();
    await p.key('Escape');
    await p.sleep(80);
    p.assert.equal(await dirty(p, '/examples/spiral.lgo'), true);
  });
  t.test('closing an unchanged original asks nothing', async (p) => {
    await p.ev("LG.app.openFile('/examples/spiral.lgo')");
    await p.click(tabSel('/examples/spiral.lgo') + ' .x');
    p.assert.equal(await p.modalOpen(), false);
    p.assert.equal(await p.ev("!!LG.app.docByPath('/examples/spiral.lgo')"), false);
  });
  t.test('closing a changed own file asks Save changes?', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await typeInto(p, 'b');
    await p.click(tabSel('/projects/d/one.lgo') + ' .x');
    p.assert.equal(await p.waitModal(), 'Save changes?');
    p.assert.deepEqual(await modalButtons(p), ['Cancel', "Don't save", 'Save as…', 'Save']);
  });
  t.test('Save saves and closes', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await typeInto(p, 'b');
    await p.click(tabSel('/projects/d/one.lgo') + ' .x');
    await p.waitModal();
    await p.click('.modal-back:last-child .modal-foot button.primary');
    await p.sleep(80);
    p.assert.equal(await disk(p, '/projects/d/one.lgo'), 'ba');
    p.assert.deepEqual(await tabNames(p), []);
  });
  t.test("Don't save closes and leaves the file as it was", async (p) => {
    await p.ev('LG.app.settings.autosave = false');
    try {
      await p.newFile('/projects/d/one.lgo', 'a');
      await typeInto(p, 'b');
      await p.click(tabSel('/projects/d/one.lgo') + ' .x');
      await p.waitModal();
      await p.modalButton("Don't save");
      p.assert.equal(await disk(p, '/projects/d/one.lgo'), 'a');
      p.assert.deepEqual(await tabNames(p), []);
    } finally { await p.ev('LG.app.settings.autosave = true'); }
  });
  t.test('Save as… saves under a new name and closes', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await typeInto(p, 'b');
    await p.click(tabSel('/projects/d/one.lgo') + ' .x');
    await p.waitModal();
    await p.modalButton('Save as');
    p.assert.equal(await p.waitModal(), 'Save as');
    await p.modalInput('renamed');
    await p.key('Enter');
    await p.sleep(120);
    p.assert.equal(await disk(p, '/projects/d/renamed.lgo'), 'ba');
    p.assert.deepEqual(await tabNames(p), []);
  });
  t.test('Cancel on Save changes? keeps the tab open and changed', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await typeInto(p, 'b');
    await p.click(tabSel('/projects/d/one.lgo') + ' .x');
    await p.waitModal();
    await p.modalButton('Cancel');
    p.assert.equal(await dirty(p, '/projects/d/one.lgo'), true);
    p.assert.equal(await p.code(), 'ba');
  });
  t.test('Escape on Save changes? cancels', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await typeInto(p, 'b');
    await p.click(tabSel('/projects/d/one.lgo') + ' .x');
    await p.waitModal();
    await p.key('Escape');
    p.assert.deepEqual(await tabNames(p), ['one.lgo']);
  });
  t.test('closing an unchanged own file asks nothing', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await p.click(tabSel('/projects/d/one.lgo') + ' .x');
    p.assert.equal(await p.modalOpen(), false);
  });
  t.test('a middle click on a changed tab asks too', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await typeInto(p, 'b');
    const [x, y] = await p.center(tabSel('/projects/d/one.lgo'));
    await p.mouse('mousePressed', x, y, 'middle');
    await p.mouse('mouseReleased', x, y, 'middle');
    p.assert.equal(await p.waitModal(), 'Save changes?');
  });

  // ---- autosave ---------------------------------------------------------------------------------------------
  t.test('autosave is on by default and saves a changed file within a few seconds', async (p) => {
    p.assert.equal(await p.ev('LG.app.settings.autosave'), true);
    await p.newFile('/projects/d/one.lgo', 'a');
    await typeInto(p, 'auto ');
    await p.wait("LG.app.vfs.readText('/projects/d/one.lgo') === 'auto a'", 7000);
    p.assert.equal(await dirty(p, '/projects/d/one.lgo'), false);
  }, { timeout: 15000 });
  t.test('the autosave setting can be turned off in Looks and settings', async (p) => {
    await p.click('#railSettings');
    await p.waitModal();
    p.assert.equal(await p.ev("document.getElementById('set-autosave').checked"), true);
    await p.click('#set-autosave');
    p.assert.equal(await p.ev('LG.app.settings.autosave'), false);
    p.assert.equal(await p.ev("JSON.parse(localStorage.getItem('lohgo.settings')).autosave"), false);
    await p.key('Escape');
    await p.newFile('/projects/d/one.lgo', 'a');
    await typeInto(p, 'manual ');
    await p.sleep(4600);
    p.assert.equal(await disk(p, '/projects/d/one.lgo'), 'a');
    p.assert.equal(await dirty(p, '/projects/d/one.lgo'), true);
    await p.click('#railSettings');
    await p.waitModal();
    await p.click('#set-autosave');
    await p.key('Escape');
    p.assert.equal(await p.ev('LG.app.settings.autosave'), true);
  }, { timeout: 20000 });
  t.test('running a program saves it first when autosave is on', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'print 1');
    await typeInto(p, 'print 0\n');
    await p.key('F5');
    await p.waitState('idle');
    p.assert.equal(await disk(p, '/projects/d/one.lgo'), 'print 0\nprint 1');
  });
  t.test('running does not save when autosave is off', async (p) => {
    await p.ev('LG.app.settings.autosave = false');
    try {
      await p.newFile('/projects/d/one.lgo', 'print 1');
      await typeInto(p, 'print 0\n');
      await p.key('F5');
      await p.waitState('idle');
      p.assert.equal(await disk(p, '/projects/d/one.lgo'), 'print 1');
    } finally { await p.ev('LG.app.settings.autosave = true'); }
  });

  // ---- leaving the page --------------------------------------------------------------------------------------
  t.test('leaving the page with a changed original asks first', async (p) => {
    await p.ev("LG.app.openFile('/examples/spiral.lgo')");
    await typeInto(p, 'x');
    p.assert.equal(await unloadBlocked(p), true);
  });
  t.test('leaving the page with a changed own file saves it and does not ask', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await typeInto(p, 'b');
    p.assert.equal(await unloadBlocked(p), false);
    p.assert.equal(await disk(p, '/projects/d/one.lgo'), 'ba');
  });
  t.test('leaving the page with autosave off and unsaved work asks first', async (p) => {
    await p.ev('LG.app.settings.autosave = false');
    try {
      await p.newFile('/projects/d/one.lgo', 'a');
      await typeInto(p, 'b');
      p.assert.equal(await unloadBlocked(p), true);
    } finally { await p.ev('LG.app.settings.autosave = true'); }
  });
  t.test('leaving the page with nothing changed does not ask', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    p.assert.equal(await unloadBlocked(p), false);
  });

  // ---- the session --------------------------------------------------------------------------------------------
  t.test('open tabs and the active tab come back after a reload', async (p) => {
    await p.newFile('/projects/d/one.lgo', '1');
    await p.newFile('/projects/d/two.lgo', '2');
    await p.newFile('/projects/d/three.lgo', '3');
    await p.click(tabSel('/projects/d/two.lgo'));
    await p.sleep(300);
    await p.reload();
    p.assert.deepEqual(await tabNames(p), ['one.lgo', 'two.lgo', 'three.lgo']);
    p.assert.equal(await active(p), '/projects/d/two.lgo');
  });
  t.test('an original left open comes back after a reload', async (p) => {
    await p.ev("LG.app.openFile('/examples/spiral.lgo')");
    await p.sleep(300);
    await p.reload();
    p.assert.equal(await active(p), '/examples/spiral.lgo');
  });
  t.test('unsaved typing survives a reload through autosave', async (p) => {
    await p.newFile('/projects/d/one.lgo', 'a');
    await typeInto(p, 'typed ');
    await p.reload();
    p.assert.equal(await p.code(), 'typed a');
  });
  t.test('a program made just before a reload is still there', async (p) => {
    await newProgramPrompt(p);
    await p.modalInput('quick');
    await p.key('Enter');
    await p.sleep(30);
    await p.reload();
    p.assert.equal(await exists(p, '/projects/quick.lgo'), true);
    p.assert.equal(await active(p), '/projects/quick.lgo');
    await rm(p, '/projects/quick.lgo');
  });
  t.test('a file deleted just before a reload stays deleted', async (p) => {
    await put(p, '/projects/d/gone.lgo', 'x');
    await p.sleep(300);
    await p.ev("LG.app.vfs.unlink('/projects/d/gone.lgo', { trusted: true })");
    await p.reload();
    p.assert.equal(await exists(p, '/projects/d/gone.lgo'), false);
  });
  t.test('a file deleted while away is skipped after a reload', async (p) => {
    await p.newFile('/projects/d/one.lgo', '1');
    await p.newFile('/projects/d/two.lgo', '2');
    await p.ev("LG.app.vfs.unlink('/projects/d/two.lgo', { trusted: true })");
    await p.sleep(300);
    await p.reload();
    p.assert.deepEqual(await tabNames(p), ['one.lgo']);
    p.assert.equal(await active(p), '/projects/d/one.lgo');
  });
  t.test('a closed tab stays closed after a reload', async (p) => {
    await p.newFile('/projects/d/one.lgo', '1');
    await p.newFile('/projects/d/two.lgo', '2');
    await p.click(tabSel('/projects/d/one.lgo') + ' .x');
    await p.sleep(300);
    await p.reload();
    p.assert.deepEqual(await tabNames(p), ['two.lgo']);
  });
  t.test('the session is stored as the list of paths and the active one', async (p) => {
    await p.newFile('/projects/d/one.lgo', '1');
    await p.newFile('/projects/d/two.lgo', '2');
    p.assert.deepEqual(await p.ev("JSON.parse(localStorage.getItem('lohgo.session'))"), { open: ['/projects/d/one.lgo', '/projects/d/two.lgo'], active: '/projects/d/two.lgo' });
  });
  t.test('a first visit opens the starter program', async (p) => {
    await p.fresh();
    p.assert.equal(await active(p), '/projects/start.lgo');
    p.assert.match(await p.code(), /Welcome to Lohgo/);
  });

  // ---- the empty editor -------------------------------------------------------------------------------------
  t.test('with no file open the editor says so and offers buttons', async (p) => {
    p.assert.ok(await p.visible('#editors .empty-ed'));
    p.assert.match(await p.text('#editors .empty-ed'), /No program open\./);
    p.assert.deepEqual(await p.texts('#editors .empty-ed button'), ['New program', 'Open the library']);
  });
  t.test('the empty editor\'s New program button makes a program', async (p) => {
    await p.click('#editors .empty-ed button', 'New program');
    p.assert.equal(await p.waitModal(), 'New program');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.equal(await active(p), '/projects/untitled.lgo');
    p.assert.equal(await p.exists('#editors .empty-ed'), false);
  });
  t.test('the empty editor\'s Open the library button opens the library', async (p) => {
    await p.click('#editors .empty-ed button', 'Open the library');
    await p.waitModal();
    p.assert.match(await p.modalTitle(), /librar/i);
  });
  t.test('with no file open, file items in the menu are greyed out', async (p) => {
    await p.click('#menuBtn');
    await p.wait("!!document.querySelector('.menu-pop')");
    const items = await p.menuItems();
    for (const l of ['Save', 'Save as…', 'Share as a link…', 'Download this file', 'Close']) p.assert.equal(items.find((x) => x.label === l).disabled, true, l);
    p.assert.equal(items.find((x) => x.label === 'New program').disabled, false);
  });
  t.test('with no file open, F5 asks for a program', async (p) => {
    await p.key('F5');
    await p.waitToast(/Open or create a program first/);
  });
  t.test('with no file open, Ctrl+S does nothing', async (p) => {
    await p.key('s', { ctrl: true });
    p.assert.equal(await p.modalOpen(), false);
  });
  t.test('with no file open the top bar shows no path', async (p) => {
    p.assert.equal(await p.text('#proj'), '');
    p.assert.equal(await p.ev('document.title'), 'Lohgo');
  });
  t.test('opening a file hides the empty message', async (p) => {
    await p.newFile('/projects/d/one.lgo', '1');
    p.assert.equal(await p.exists('#editors .empty-ed'), false);
  });
  t.test('closing the last tab brings the empty message back', async (p) => {
    await p.newFile('/projects/d/one.lgo', '1');
    await p.click(tabSel('/projects/d/one.lgo') + ' .x');
    p.assert.ok(await p.visible('#editors .empty-ed'));
  });
}
