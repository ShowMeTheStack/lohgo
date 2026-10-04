import { textOf } from './50-ui-lib.mjs';
// The rail on the left: Files and Procedures toggle the side panel; Library, Learn, Tours,
// Help and Looks open their sheets. Also the Procedures panel itself.

const RAIL = [
  ['#railFiles', 'Files'], ['#railProcs', 'Procedures'], ['#railLibrary', 'Library'], ['#railLearn', 'Learn'],
  ['#railTours', 'Tours'], ['#railHelp', 'Help'], ['#railSettings', 'Looks'],
];
const SHEETS = [
  ['#railLibrary', 'Program library'], ['#railLearn', 'Learn Logo'], ['#railHelp', 'Logo reference'], ['#railSettings', 'Looks and settings'],
];
const sideOpen = (p) => p.ev("!document.getElementById('side').classList.contains('closed')");

export default function (t) {
  for (const [sel, label] of RAIL) {
    t.test(`rail button ${label} is labelled and shows its name`, async (p) => {
      p.assert.equal(await p.attr(sel, 'aria-label'), label);
      p.assert.equal(await p.attr(sel, 'title'), label);
      p.assert.equal((await p.text(sel)).trim(), label);
      p.assert.equal(await p.ev(`document.querySelector(${JSON.stringify(sel)}).tagName`), 'BUTTON');
    });
  }

  t.test('the rail lists its buttons in order with Looks at the bottom', async (p) => {
    const ids = await p.ev("[...document.querySelectorAll('#rail .rbtn')].map(b => b.id)");
    p.assert.deepEqual(ids, RAIL.map(([s]) => s.slice(1)));
    const looks = await p.rect('#railSettings');
    const rail = await p.rect('#rail');
    p.assert.ok(rail.bottom - looks.bottom < 30, 'Looks sits at the foot of the rail');
  }, { fresh: true });

  t.test('Files is open at first on a wide screen and marked active', async (p) => {
    p.assert.equal(await sideOpen(p), true);
    p.assert.equal(await textOf(p, '#sideTitle'), 'Files');
    p.assert.ok(await p.ev("document.getElementById('railFiles').classList.contains('active')"));
    p.assert.ok(!(await p.ev("document.getElementById('railProcs').classList.contains('active')")));
    p.assert.ok(await p.exists('#sideBody [role=tree]'));
  }, { fresh: true });

  t.test('clicking Files closes the panel and clicking again opens it', async (p) => {
    await p.click('#railFiles');
    p.assert.equal(await sideOpen(p), false);
    p.assert.equal(await p.visible('#side'), false);
    p.assert.ok(!(await p.ev("document.getElementById('railFiles').classList.contains('active')")));
    await p.click('#railFiles');
    p.assert.equal(await sideOpen(p), true);
    p.assert.equal(await p.visible('#side'), true);
  }, { fresh: true });

  t.test('closing the side panel gives the stage the room', async (p) => {
    const before = await p.rect('#stage');
    await p.click('#railFiles');
    const after = await p.rect('#stage');
    p.assert.ok(after.w > before.w + 200, `stage grew from ${before.w} to ${after.w}`);
    p.assert.ok(after.x < before.x, 'stage moved left');
  }, { fresh: true });

  t.test('Procedures swaps the open panel to the procedures list', async (p) => {
    await p.click('#railProcs');
    p.assert.equal(await sideOpen(p), true);
    p.assert.equal(await textOf(p, '#sideTitle'), 'Procedures');
    p.assert.ok(await p.ev("document.getElementById('railProcs').classList.contains('active')"));
    p.assert.ok(!(await p.ev("document.getElementById('railFiles').classList.contains('active')")));
    p.assert.equal(await p.exists('#sideBody [role=tree]'), false);
    await p.click('#railProcs');
    p.assert.equal(await sideOpen(p), false);
  }, { fresh: true });

  t.test('the side panel being closed is remembered after a reload', async (p) => {
    await p.click('#railFiles');
    await p.reload();
    p.assert.equal(await sideOpen(p), false);
    p.assert.equal(await p.ev('LG.app.side'), null);
  }, { fresh: true });

  t.test('the Procedures panel is remembered after a reload', async (p) => {
    await p.click('#railProcs');
    await p.reload();
    p.assert.equal(await sideOpen(p), true);
    p.assert.equal(await textOf(p, '#sideTitle'), 'Procedures');
    p.assert.ok(await p.ev("document.getElementById('railProcs').classList.contains('active')"));
  }, { fresh: true });

  t.test('reopening Files after a reload keeps it open after the next reload', async (p) => {
    await p.click('#railFiles');
    await p.reload();
    await p.click('#railFiles');
    await p.reload();
    p.assert.equal(await sideOpen(p), true);
    p.assert.equal(await textOf(p, '#sideTitle'), 'Files');
  }, { fresh: true });

  for (const [sel, title] of SHEETS) {
    t.test(`${sel.slice(5)} opens the "${title}" sheet and Escape closes it`, async (p) => {
      await p.click(sel);
      p.assert.equal(await p.waitModal(), title);
      p.assert.equal(await p.count('.modal-back'), 1);
      await p.key('Escape');
      await p.waitGone('.modal-back');
      p.assert.equal(await p.modalOpen(), false);
    }, { fresh: true });
  }

  t.test('the Library sheet lists programs in categories', async (p) => {
    await p.click('#railLibrary');
    await p.waitModal();
    p.assert.ok(await p.count('.modal .pcard') > 5, 'program cards');
    p.assert.ok(await p.ev("document.querySelector('.modal').classList.contains('wide')"));
    await p.key('Escape');
  }, { fresh: true });

  t.test('the Learn sheet lists lessons', async (p) => {
    await p.click('#railLearn');
    await p.waitModal();
    p.assert.ok((await p.modalText()).length > 100);
    p.assert.ok(await p.count('.modal [role=button], .modal .list-row, .modal button') > 3);
    await p.key('Escape');
  }, { fresh: true });

  t.test('the Help sheet shows the language reference with a search box', async (p) => {
    await p.click('#railHelp');
    await p.waitModal();
    p.assert.ok(await p.exists('.modal input[type=text]'));
    await p.wait("document.activeElement && document.activeElement.matches('.modal input[type=text]')");
    await p.type('forward');
    await p.wait("[...document.querySelectorAll('.modal .list-row')].some(r => /^forward/i.test(r.textContent.trim()))");
    await p.key('Escape');
  }, { fresh: true });

  t.test('Tours opens a menu of the guided tours beside the rail', async (p) => {
    await p.click('#railTours');
    await p.wait("!!document.querySelector('.menu-pop')");
    const labels = await p.ev("[...document.querySelectorAll('.menu-pop .menu-item')].map(e => e.innerText.trim())");
    p.assert.deepEqual(labels, ['Welcome to Lohgo', 'Your first program', 'The debugger', 'Turtle graphics', 'Files and sharing', 'All the lessons…']);
    const m = await p.rect('.menu-pop');
    const r = await p.rect('#railTours');
    p.assert.ok(m.x >= r.right, 'menu opens to the right of the rail');
    await p.closeMenus();
  }, { fresh: true });

  t.test('picking a tour from the Tours menu starts it', async (p) => {
    await p.click('#railTours');
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.click('.menu-pop .menu-item', 'Turtle graphics');
    await p.wait("!!document.querySelector('.tour-pop')");
    p.assert.match(await textOf(p, '.tour-pop'), /Turtle graphics · 1 of/);
    await p.click('#tourClose');
    p.assert.equal(await p.exists('.tour-pop'), false);
  }, { fresh: true });

  t.test('"All the lessons" in the Tours menu opens the Learn sheet', async (p) => {
    await p.click('#railTours');
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.click('.menu-pop .menu-item', 'All the lessons');
    p.assert.equal(await p.waitModal(), 'Learn Logo');
    await p.key('Escape');
  }, { fresh: true });

  t.test('Escape closes the Tours menu', async (p) => {
    await p.click('#railTours');
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.key('Escape');
    p.assert.equal(await p.exists('.menu-pop'), false);
  }, { fresh: true });

  // ---- the Procedures panel -------------------------------------------------------------------
  t.test('Procedures lists the TO lines of the active file with their line numbers', async (p) => {
    await p.newFile('/projects/procs.lgo', '; shapes\nto square :n\nrepeat 4 [fd :n rt 90]\nend\n\nto tri :n ; a triangle\nrepeat 3 [fd :n rt 120]\nend\n');
    await p.click('#railProcs');
    await p.wait("document.querySelectorAll('#sideBody .proc-row').length >= 2");
    const sec = await p.ev("[...document.querySelectorAll('#sideBody .vsec')].map(e => e.textContent)");
    p.assert.equal(sec[0], 'In procs.lgo');
    const rows = await p.ev("[...document.querySelectorAll('#sideBody .proc-row')].slice(0, 2).map(r => [r.querySelector('.t').innerText, r.querySelector('.s').innerText])");
    p.assert.deepEqual(rows, [['to square :n', 'line 2'], ['to tri :n', 'line 6']]);
  }, { fresh: true });

  t.test('clicking a procedure of the file puts the cursor on its line', async (p) => {
    await p.newFile('/projects/procs.lgo', 'print 1\nprint 2\nprint 3\nto deep\nprint 4\nend\n');
    await p.click('#railProcs');
    await p.wait("document.querySelectorAll('#sideBody .proc-row').length >= 1");
    await p.ev('LG.app.active.editor.setCursor(0, 0)');
    await p.click('#sideBody .proc-row', 'to deep');
    await p.wait('LG.app.active.editor.cursor().line === 3');
    p.assert.equal(await p.activePath(), '/projects/procs.lgo');
  }, { fresh: true });

  t.test('clicking a procedure in another file opens that file at the line', async (p) => {
    await p.newFile('/projects/lib.lgo', '\n\nto helper\nprint "hi\nend\n');
    await p.ev('LG.app.runActive()');
    await p.waitState('idle');
    await p.newFile('/projects/other.lgo', 'print 1\n');
    await p.click('#railProcs');
    await p.wait("[...document.querySelectorAll('#sideBody .proc-row')].some(r => /helper/.test(r.innerText))");
    p.assert.match(await textOf(p, '#sideBody'), /lib\.lgo:3/);
    await p.click('#sideBody .proc-row', 'helper');
    await p.wait("LG.app.active.path === '/projects/lib.lgo' && LG.app.active.editor.cursor().line === 2");
  }, { fresh: true });

  t.test('the workspace section counts procedures defined by running', async (p) => {
    await p.click('#railProcs');
    await p.runProgram('to aa\nend\nto bb\nend\nto cc\nend\n');
    await p.wait("/Defined in the workspace \\(3\\)/.test(document.getElementById('sideBody').textContent)");
  }, { fresh: true });

  t.test('with no procedures the panel explains how to make one', async (p) => {
    await p.runProgram('print 1\n');
    await p.click('#railProcs');
    p.assert.match(await textOf(p, '#sideBody'), /Defined in the workspace \(0\)/);
    p.assert.match(await textOf(p, '#sideBody .side-note'), /type TO/);
  }, { fresh: true });

  t.test('a procedure typed at the prompt is listed and opens as a new program', async (p) => {
    await p.click('#railProcs');
    await p.command('define "twice [[x] [output :x * 2]]');
    await p.wait("/typed at the prompt/.test(document.getElementById('sideBody').textContent)", 3000);
    await p.click('#sideBody .proc-row', 'twice');
    await p.wait("/twice/.test(LG.app.active.path)");
    p.assert.match(await p.code(), /to twice :x/i);
  }, { fresh: true });

  t.test('the refresh button rebuilds the list', async (p) => {
    await p.click('#railProcs');
    await p.fn(() => LG.app.interp.runText('define "late [[] []]'));
    await p.waitState('idle');
    await p.click('#sideTools button[aria-label=Refresh]');
    p.assert.match(await textOf(p, '#sideBody'), /to late/);
  }, { fresh: true });

  t.test('typing a new TO line in the editor shows up in the panel', async (p) => {
    await p.newFile('/projects/live.lgo', 'print 1\n');
    await p.click('#railProcs');
    await p.ev('LG.app.active.editor.focus(); LG.app.active.editor.setCursor(1, 0)');
    await p.type('to newone\n');
    await p.wait("/to newone/.test(document.getElementById('sideBody').textContent)", 3000);
  }, { fresh: true });

  t.test('a procedure row can be opened with the keyboard', async (p) => {
    await p.newFile('/projects/kb.lgo', 'print 1\nto kbproc\nend\n');
    await p.click('#railProcs');
    await p.wait("document.querySelectorAll('#sideBody .proc-row').length >= 1");
    await p.ev("document.querySelector('#sideBody .proc-row').focus(); LG.app.active.editor.setCursor(0, 0)");
    await p.key('Enter');
    await p.wait('LG.app.active.editor.cursor().line === 1');
  }, { fresh: true });

  t.test('buried procedures stay out of the list unless buried names are shown', async (p) => {
    await p.click('#railProcs');
    await p.command('define "hidden1 [[] []]');
    await p.command('define "shown1 [[] []]');
    await p.command('bury "hidden1');
    await p.click('#sideTools button[aria-label=Refresh]');
    let txt = await textOf(p, '#sideBody');
    p.assert.match(txt, /shown1/);
    p.assert.doesNotMatch(txt, /hidden1/);
    await p.ev('LG.app.settings.showBuried = true; LG.app.renderSide()');
    txt = await textOf(p, '#sideBody');
    p.assert.match(txt, /hidden1/);
  }, { fresh: true });
}
