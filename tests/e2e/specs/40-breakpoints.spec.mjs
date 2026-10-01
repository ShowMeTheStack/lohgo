// Breakpoints: the gutter, F9, the Breakpoints tab, the gutter menu, conditions, persistence
// and where a program actually stops.
import { PATH, reset, load, gutterClick, gutterPoint, gutterMenu, bps, gutterClasses, markedLine, waitMarked, pausedLine, untilPaused, f5, linePoint } from './40-dbg-lib.mjs';

const COUNT = 'to f :n\n  if :n = 0 [stop]\n  print :n\n  f :n - 1\nend\nf 5\nprint "end\n';

/** Run with F5 and keep pressing F5 at every pause; returns the lines it stopped on */
async function stopsOf(p, max = 20) {
  const lines = [];
  await f5(p);
  for (let i = 0; i < max; i++) {
    await p.waitState(['paused', 'idle', 'error']);
    if ((await p.state()) !== 'paused') break;
    lines.push(await pausedLine(p));
    await p.key('F5');
    await p.sleep(30);
  }
  return lines;
}
async function nVar(p) { return p.ev("(() => { const f = LG.Debug.frames(LG.app.interp); const t = f[f.length - 1]; const r = LG.Debug.lookup(LG.app.interp, 'n', t.scope); return r ? LG.Debug.brief(r.value) : null; })()"); }

export default function (t) {
  t.beforeEach(reset);

  // ---- the gutter --------------------------------------------------------------------------------
  for (const line of [0, 1, 2, 3, 5]) {
    t.test(`clicking the gutter at line ${line + 1} sets a breakpoint there`, async (p) => {
      await load(p, COUNT);
      await gutterClick(p, line);
      p.assert.deepEqual(await bps(p), [[line, '', false]]);
      const g = await gutterClasses(p);
      p.assert.match(g[line], /\bbp\b/);
      p.assert.equal(g.filter((c) => /\bbp\b/.test(c)).length, 1);
    });
  }
  t.test('clicking the gutter again removes the breakpoint', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    await gutterClick(p, 2);
    p.assert.deepEqual(await bps(p), []);
    p.assert.ok(!(await gutterClasses(p)).some((c) => /\bbp\b/.test(c)));
  });
  t.test('the breakpoint dot is drawn as a red circle in the gutter', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    await p.sleep(60);
    const st = await p.ev("(() => { const g = LG.app.active.editor.inner.querySelectorAll('.ed-gl')[2]; const s = getComputedStyle(g, '::before'); return { content: s.content, bg: s.backgroundColor, w: parseFloat(s.width), radius: s.borderRadius }; })()");
    p.assert.notEqual(st.content, 'none');
    p.assert.ok(st.w > 4, 'dot has a size');
    p.assert.notEqual(st.bg, 'rgba(0, 0, 0, 0)');
  });
  t.test('the line with a breakpoint is tinted in the code', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 3);
    p.assert.equal(await markedLine(p, 'bpline'), 3);
  });
  t.test('several breakpoints can be set in one file', async (p) => {
    await load(p, COUNT);
    for (const l of [1, 2, 3]) await gutterClick(p, l);
    p.assert.deepEqual((await bps(p)).map((b) => b[0]), [1, 2, 3]);
  });
  t.test('right-clicking the gutter does not toggle a breakpoint', async (p) => {
    await load(p, COUNT);
    await gutterMenu(p, 2);
    await p.closeMenus();
    p.assert.deepEqual(await bps(p), []);
  });
  t.test('clicking the gutter below the last line sets nothing', async (p) => {
    await load(p, 'print 1\nprint 2');
    const [x, y] = await gutterPoint(p, 6);
    await p.clickAt(x, y);
    p.assert.deepEqual(await bps(p), []);
  });
  t.test('a gutter click does not move the cursor or change the text', async (p) => {
    await load(p, COUNT);
    const before = await p.code();
    await gutterClick(p, 4);
    p.assert.equal(await p.code(), before);
    p.assert.equal(await p.ev('LG.app.active.dirty'), false);
  });
  t.test('the gutter still finds the right line after scrolling a long file', async (p) => {
    const lines = []; for (let i = 0; i < 120; i++) lines.push('print ' + i);
    await load(p, lines.join('\n'));
    await gutterClick(p, 90);
    p.assert.deepEqual((await bps(p)).map((b) => b[0]), [90]);
    p.assert.ok(await p.ev('LG.app.active.editor.ta.scrollTop > 0'));
  });

  // ---- F9 ------------------------------------------------------------------------------------------
  for (const line of [0, 2, 6]) {
    t.test(`F9 sets a breakpoint on cursor line ${line + 1}`, async (p) => {
      await load(p, COUNT);
      await p.ev(`LG.app.active.editor.setCursor(${line}, 1)`);
      await p.key('F9');
      p.assert.deepEqual(await bps(p), [[line, '', false]]);
    });
  }
  t.test('F9 twice removes the breakpoint again', async (p) => {
    await load(p, COUNT);
    await p.ev('LG.app.active.editor.setCursor(3, 0)');
    await p.key('F9');
    await p.key('F9');
    p.assert.deepEqual(await bps(p), []);
  });
  t.test('F9 after clicking into a line uses the clicked line', async (p) => {
    await load(p, COUNT);
    const [x, y] = await linePoint(p, 2, 16);
    await p.clickAt(x, y);
    await p.key('F9');
    p.assert.deepEqual((await bps(p)).map((b) => b[0]), [2]);
  });
  t.test('Toggle breakpoint in the main menu uses the cursor line', async (p) => {
    await load(p, COUNT);
    await p.ev('LG.app.active.editor.setCursor(1, 0)');
    await p.menu('Toggle breakpoint');
    p.assert.deepEqual((await bps(p)).map((b) => b[0]), [1]);
    await p.menu('Remove all breakpoints');
    p.assert.deepEqual(await bps(p), []);
  });

  // ---- Breakpoints tab ------------------------------------------------------------------------------
  t.test('the Breakpoints tab badge is hidden with no breakpoints', async (p) => {
    await load(p, COUNT);
    p.assert.ok(await p.ev("document.querySelector('#itab-bps .badge').classList.contains('hidden')"));
  });
  t.test('the Breakpoints tab badge counts breakpoints', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 1);
    p.assert.equal(await p.text('#itab-bps .badge'), '1');
    await gutterClick(p, 2);
    await gutterClick(p, 3);
    p.assert.equal(await p.text('#itab-bps .badge'), '3');
    p.assert.ok(!(await p.ev("document.querySelector('#itab-bps .badge').classList.contains('hidden')")));
  });
  t.test('the badge counts breakpoints in every open file', async (p) => {
    await load(p, 'print 1\nprint 2', '/projects/a40.lgo');
    await gutterClick(p, 0);
    await load(p, COUNT);
    await gutterClick(p, 2);
    p.assert.equal(await p.text('#itab-bps .badge'), '2');
  });
  t.test('the Breakpoints tab explains how to add one when empty', async (p) => {
    await load(p, COUNT);
    await p.click('#itab-bps');
    p.assert.match(await p.paneText('bps'), /Click in the margin/);
  });
  t.test('the Breakpoints tab lists each breakpoint with file, line and code', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 3);
    await gutterClick(p, 1);
    await p.click('#itab-bps');
    const rows = await p.texts('#ipane-bps .list-row .grow');
    p.assert.deepEqual(rows.map((r) => r.replace(/\s+/g, ' ')), ['e2e.lgo:2 if :n = 0 [stop]', 'e2e.lgo:4 f :n - 1']);
    p.assert.match(await p.paneText('bps'), /2 breakpoints/);
  });
  t.test('the Breakpoints tab says "1 breakpoint" for one', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    await p.click('#itab-bps');
    p.assert.match(await p.paneText('bps'), /\b1 breakpoint\b(?!s)/);
  });
  t.test('unchecking Enabled disables the breakpoint and the gutter shows it hollow', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    await p.click('#itab-bps');
    await p.click('#ipane-bps .list-row input[type=checkbox]');
    p.assert.deepEqual(await bps(p), [[2, '', true]]);
    p.assert.match((await gutterClasses(p))[2], /disabled/);
    p.assert.equal(await p.ev("document.querySelector('#ipane-bps .list-row input[type=checkbox]').checked"), false);
  });
  t.test('a disabled breakpoint does not stop the program', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    await p.click('#itab-bps');
    await p.click('#ipane-bps .list-row input[type=checkbox]');
    p.assert.deepEqual(await stopsOf(p), []);
    await p.waitOutput(/end/);
  });
  t.test('checking Enabled again makes it stop the program', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    await p.click('#itab-bps');
    await p.click('#ipane-bps .list-row input[type=checkbox]');
    await p.click('#ipane-bps .list-row input[type=checkbox]');
    p.assert.deepEqual(await bps(p), [[2, '', false]]);
    p.assert.equal((await stopsOf(p)).length, 5);
  });
  t.test('add condition opens the "Stop only when" prompt', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    await p.click('#itab-bps');
    await p.click('#ipane-bps .small-btn', 'add condition');
    p.assert.match(await p.waitModal(), /Stop only when/);
    p.assert.match(await p.modalText(), /line 3/);
    await p.modalButton('Cancel');
  });
  t.test('a condition typed in the prompt is saved and shown on the button', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    await p.click('#itab-bps');
    await p.click('#ipane-bps .small-btn', 'add condition');
    await p.waitModal();
    await p.modalInput(':n = 2');
    await p.modalButton('OK');
    p.assert.deepEqual(await bps(p), [[2, ':n = 2', false]]);
    p.assert.ok(await p.exists('#ipane-bps .small-btn'));
    p.assert.match(await p.paneText('bps'), /if :n = 2/);
    p.assert.match((await gutterClasses(p))[2], /\bcond\b/);
  });
  t.test('pressing Enter in the condition prompt accepts it', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    await p.click('#itab-bps');
    await p.click('#ipane-bps .small-btn', 'add condition');
    await p.waitModal();
    await p.modalInput(':n < 3');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.deepEqual(await bps(p), [[2, ':n < 3', false]]);
  });
  t.test('cancelling the condition prompt keeps the breakpoint as it was', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    await p.click('#itab-bps');
    await p.click('#ipane-bps .small-btn', 'add condition');
    await p.waitModal();
    await p.modalInput(':n = 1');
    await p.modalButton('Cancel');
    p.assert.deepEqual(await bps(p), [[2, '', false]]);
  });
  t.test('the condition button shows the old condition in the prompt to edit', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    await p.ev("LG.app.breakpoints.get('/projects/e2e.lgo').get(2).cond = ':n = 4'; LG.app.breakpointsChanged('/projects/e2e.lgo')");
    await p.click('#itab-bps');
    await p.click('#ipane-bps .small-btn', 'if :n = 4');
    await p.waitModal();
    p.assert.equal(await p.ev("document.querySelector('.modal-back:last-child input').value"), ':n = 4');
    await p.modalInput('');
    await p.modalButton('OK');
    p.assert.deepEqual(await bps(p), [[2, '', false]]);
  });
  t.test('the remove button in the list removes that breakpoint only', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 1);
    await gutterClick(p, 3);
    await p.click('#itab-bps');
    await p.click('#ipane-bps .list-row .ibtn[aria-label="Remove breakpoint"]');
    p.assert.deepEqual((await bps(p)).map((b) => b[0]), [3]);
    p.assert.equal(await p.count('#ipane-bps .list-row'), 1);
  });
  t.test('Remove all clears every breakpoint and the badge', async (p) => {
    await load(p, COUNT);
    for (const l of [1, 2, 3]) await gutterClick(p, l);
    await p.click('#itab-bps');
    await p.click('#bpClearAll');
    p.assert.deepEqual(await bps(p), []);
    p.assert.match(await p.paneText('bps'), /Click in the margin/);
    p.assert.ok(await p.ev("document.querySelector('#itab-bps .badge').classList.contains('hidden')"));
    p.assert.ok(!(await gutterClasses(p)).some((c) => /\bbp\b/.test(c)));
  });
  t.test('clicking a breakpoint row goes to its line', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 3);
    await p.ev('LG.app.active.editor.setCursor(0, 0)');
    await p.click('#itab-bps');
    await p.click('#ipane-bps .list-row .grow');
    await p.wait('LG.app.active.editor.cursor().line === 3');
    p.assert.equal(await p.ev('document.activeElement === LG.app.active.editor.ta'), true);
  });
  t.test('clicking a breakpoint row in another file opens that file', async (p) => {
    await load(p, 'print 1\nprint 2\nprint 3', '/projects/b40.lgo');
    await gutterClick(p, 2);
    await load(p, COUNT);
    await p.click('#itab-bps');
    await p.click('#ipane-bps .list-row .grow', 'b40.lgo');
    await p.wait("LG.app.active.path === '/projects/b40.lgo' && LG.app.active.editor.cursor().line === 2");
  });
  t.test('rows are sorted by file and then line', async (p) => {
    await load(p, 'print 1\nprint 2\nprint 3', '/projects/zz40.lgo');
    await gutterClick(p, 1);
    await load(p, COUNT);
    await gutterClick(p, 4);
    await gutterClick(p, 0);
    await p.click('#itab-bps');
    const rows = (await p.texts('#ipane-bps .list-row .grow')).map((r) => r.split(/\s+/)[0]);
    p.assert.deepEqual(rows, ['e2e.lgo:1', 'e2e.lgo:5', 'zz40.lgo:2']);
  });
  t.test('the condition button click does not jump to the line', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 4);
    await p.ev('LG.app.active.editor.setCursor(0, 0)');
    await p.click('#itab-bps');
    await p.click('#ipane-bps .small-btn', 'add condition');
    await p.waitModal();
    await p.modalButton('Cancel');
    p.assert.equal(await p.ev('LG.app.active.editor.cursor().line'), 0);
  });

  // ---- gutter context menu -----------------------------------------------------------------------------
  t.test('the gutter menu on a plain line offers Add, Stop only when and Run to here', async (p) => {
    await load(p, COUNT);
    p.assert.deepEqual(await gutterMenu(p, 2), ['Add breakpoint', 'Stop only when…', 'Run to here']);
    await p.closeMenus();
  });
  t.test('the gutter menu on a breakpoint offers Remove and Disable', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    p.assert.deepEqual(await gutterMenu(p, 2), ['Remove breakpoint', 'Stop only when…', 'Disable', 'Run to here']);
    await p.closeMenus();
  });
  t.test('Add breakpoint from the gutter menu', async (p) => {
    await load(p, COUNT);
    await gutterMenu(p, 3);
    await p.click('.menu-pop .menu-item', 'Add breakpoint');
    p.assert.deepEqual(await bps(p), [[3, '', false]]);
  });
  t.test('Remove breakpoint from the gutter menu', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 3);
    await gutterMenu(p, 3);
    await p.click('.menu-pop .menu-item', 'Remove breakpoint');
    p.assert.deepEqual(await bps(p), []);
  });
  t.test('Disable and then Enable from the gutter menu', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 3);
    await gutterMenu(p, 3);
    await p.click('.menu-pop .menu-item', 'Disable');
    p.assert.deepEqual(await bps(p), [[3, '', true]]);
    p.assert.ok((await gutterMenu(p, 3)).includes('Enable'));
    await p.click('.menu-pop .menu-item', 'Enable');
    p.assert.deepEqual(await bps(p), [[3, '', false]]);
  });
  t.test('Stop only when from the gutter menu makes a conditional breakpoint', async (p) => {
    await load(p, COUNT);
    await gutterMenu(p, 2);
    await p.click('.menu-pop .menu-item', 'Stop only when');
    p.assert.match(await p.waitModal(), /Stop only when/);
    await p.modalInput(':n = 3');
    await p.modalButton('OK');
    p.assert.deepEqual(await bps(p), [[2, ':n = 3', false]]);
    const stops = await stopsOf(p);
    p.assert.deepEqual(stops, [3]);
  });
  t.test('Stop only when on a disabled breakpoint enables it', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    await gutterMenu(p, 2);
    await p.click('.menu-pop .menu-item', 'Disable');
    await gutterMenu(p, 2);
    await p.click('.menu-pop .menu-item', 'Stop only when');
    await p.waitModal();
    await p.modalInput(':n = 1');
    await p.modalButton('OK');
    p.assert.deepEqual(await bps(p), [[2, ':n = 1', false]]);
  });
  t.test('Run to here starts the program and stops at that line', async (p) => {
    await load(p, COUNT);
    await gutterMenu(p, 3);
    await p.click('.menu-pop .menu-item', 'Run to here');
    p.assert.equal(await untilPaused(p), 4);
    p.assert.equal(await nVar(p), '5');
    p.assert.deepEqual(await bps(p), [], 'no lasting breakpoint');
    await p.key('F5');
    await p.waitState('idle');
    await p.waitOutput(/end/);
  });
  t.test('Run to here while paused continues to that line', async (p) => {
    await load(p, 'print 1\nprint 2\nprint 3\nprint 4\n');
    await gutterClick(p, 0);
    await f5(p);
    p.assert.equal(await untilPaused(p), 1);
    await gutterMenu(p, 3);
    await p.click('.menu-pop .menu-item', 'Run to here');
    p.assert.equal(await untilPaused(p), 4);
    p.assert.match(await p.output(), /1\n2\n3/);
    await p.key('F5');
    await p.waitState('idle');
  });
  t.test('Run to here from the code context menu', async (p) => {
    await load(p, 'print 1\nprint 2\nprint 3\n');
    const [x, y] = await linePoint(p, 1);
    await p.clickAt(x, y, { button: 'right' });
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.click('.menu-pop .menu-item', 'Run to here');
    p.assert.equal(await untilPaused(p), 2);
    await p.stopProgram();
  });
  t.test('Toggle breakpoint from the code context menu', async (p) => {
    await load(p, 'print 1\nprint 2\nprint 3\n');
    const [x, y] = await linePoint(p, 2);
    await p.clickAt(x, y, { button: 'right' });
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.click('.menu-pop .menu-item', 'Toggle breakpoint');
    p.assert.deepEqual((await bps(p)).map((b) => b[0]), [2]);
  });

  // ---- persistence and Save as ---------------------------------------------------------------------------
  t.test('breakpoints persist across a reload', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    await gutterClick(p, 3);
    await p.reload();
    await p.ev(`LG.app.openFile('${PATH}')`);
    await p.sleep(80);
    p.assert.deepEqual((await bps(p)).map((b) => b[0]), [2, 3]);
    const g = await gutterClasses(p);
    p.assert.match(g[2], /\bbp\b/);
    p.assert.match(g[3], /\bbp\b/);
    p.assert.equal(await p.text('#itab-bps .badge'), '2');
  });
  t.test('conditions and disabled flags persist across a reload', async (p) => {
    await load(p, COUNT);
    await gutterMenu(p, 2);
    await p.click('.menu-pop .menu-item', 'Stop only when');
    await p.waitModal();
    await p.modalInput(':n = 2');
    await p.modalButton('OK');
    await gutterClick(p, 3);
    await gutterMenu(p, 3);
    await p.click('.menu-pop .menu-item', 'Disable');
    await p.reload();
    await p.ev(`LG.app.openFile('${PATH}')`);
    p.assert.deepEqual(await bps(p), [[2, ':n = 2', false], [3, '', true]]);
    p.assert.deepEqual(await stopsOf(p), [3]);
  });
  t.test('a removed breakpoint stays removed after a reload', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    await gutterClick(p, 2);
    await p.reload();
    await p.ev(`LG.app.openFile('${PATH}')`);
    p.assert.deepEqual(await bps(p), []);
  });
  t.test('breakpoints follow the program to its new name with Save as', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    await p.menu('Save as');
    await p.waitModal();
    await p.modalInput('/projects/renamed40.lgo');
    await p.modalButton('OK');
    await p.wait("LG.app.active.path === '/projects/renamed40.lgo'");
    p.assert.deepEqual(await bps(p, '/projects/renamed40.lgo'), [[2, '', false]]);
    p.assert.match((await gutterClasses(p))[2], /\bbp\b/);
    p.assert.deepEqual(await stopsOf(p), [3, 3, 3, 3, 3]);
  });
  t.test('Save as from an example moves the breakpoints to the copy', async (p) => {
    await p.ev("LG.app.vfs.mkdir('/examples', {parents: true, exist: true, trusted: true}); LG.app.vfs.writeText('/examples/bp40.lgo', 'print 1\\nprint 2\\n', {trusted: true}); LG.app.openFile('/examples/bp40.lgo')");
    await p.sleep(80);
    await gutterClick(p, 1);
    await p.menu('Save as');
    await p.waitModal();
    await p.modalInput('/projects/bp40copy.lgo');
    await p.modalButton('OK');
    await p.wait("LG.app.active.path === '/projects/bp40copy.lgo'");
    p.assert.deepEqual(await bps(p, '/projects/bp40copy.lgo'), [[1, '', false]]);
    p.assert.deepEqual(await bps(p, '/examples/bp40.lgo'), []);
  });

  // ---- editing shifts breakpoints --------------------------------------------------------------------------
  t.test('inserting a line above a breakpoint moves it down', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 3);
    await p.ev('LG.app.active.editor.setCursor(1, 0)');
    await p.key('Enter');
    p.assert.deepEqual((await bps(p)).map((b) => b[0]), [4]);
    p.assert.match((await gutterClasses(p))[4], /\bbp\b/);
  });
  t.test('pasting three lines above a breakpoint moves it down by three', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 5);
    await p.ev('LG.app.active.editor.setCursor(0, 0)');
    await p.insertText('print 1\nprint 2\nprint 3\n');
    p.assert.deepEqual((await bps(p)).map((b) => b[0]), [8]);
  });
  t.test('deleting a line above a breakpoint moves it up', async (p) => {
    await load(p, 'print 1\nprint 2\nprint 3\nprint 4\n');
    await gutterClick(p, 3);
    await p.ev('LG.app.active.editor.setCursor(1, 0)');
    await p.key('Backspace');
    p.assert.deepEqual((await bps(p)).map((b) => b[0]), [2]);
  });
  t.test('typing on a line does not move breakpoints', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 3);
    await p.ev('LG.app.active.editor.setCursor(1, 2)');
    await p.type('xy');
    p.assert.deepEqual((await bps(p)).map((b) => b[0]), [3]);
  });
  t.test('inserting a line below a breakpoint leaves it in place', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 1);
    await p.ev('LG.app.active.editor.setCursor(4, 3)');
    await p.key('Enter');
    p.assert.deepEqual((await bps(p)).map((b) => b[0]), [1]);
  });
  t.test('a shifted breakpoint still stops on the same instruction', async (p) => {
    await load(p, 'print 1\nprint 2\nprint 3\n');
    await gutterClick(p, 2);
    await p.ev('LG.app.active.editor.setCursor(0, 0)');
    await p.insertText('print 0\n');
    p.assert.deepEqual(await stopsOf(p), [4]);
    p.assert.match(await p.ev('LG.app.active.editor.getLine(3)'), /print 3/);
  });
  t.test('a shifted breakpoint is saved at its new line', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    await p.ev('LG.app.active.editor.setCursor(0, 0)');
    await p.key('Enter');
    const stored = await p.ev("JSON.parse(localStorage.getItem('lohgo.breakpoints'))");
    p.assert.deepEqual(stored['/projects/e2e.lgo'].map((x) => x[0]), [3]);
  });

  // ---- where the program stops --------------------------------------------------------------------------------
  t.test('a breakpoint in a recursive procedure stops on every call', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    p.assert.deepEqual(await stopsOf(p), [3, 3, 3, 3, 3]);
  });
  t.test('the status bar says it stopped at a breakpoint in the procedure', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    await f5(p);
    await untilPaused(p);
    p.assert.match(await p.status(), /Stopped at a breakpoint in f/);
    await p.stopProgram();
  });
  t.test('the program pauses before the breakpoint line runs', async (p) => {
    await load(p, 'print "a\nprint "b\nprint "c\n');
    await gutterClick(p, 1);
    await f5(p);
    await untilPaused(p);
    const out = await p.output();
    p.assert.match(out, /\ba\b/);
    p.assert.ok(!/^b$/m.test(out));
    await p.key('F5');
    await p.waitOutput(/^c$/m);
  });
  for (const [cond, want] of [[':n = 3', ['3']], [':n < 3', ['2', '1']], [':n > 3', ['5', '4']], ['equalp :n 1', ['1']], [':n = 9', []], ['(remainder :n 2) = 0', ['4', '2']]]) {
    t.test(`a conditional breakpoint "${cond}" stops only when it is true`, async (p) => {
      await load(p, COUNT);
      await gutterClick(p, 2);
      await p.ev(`LG.app.breakpoints.get('${PATH}').get(2).cond = ${JSON.stringify(cond)}; LG.app.breakpointsChanged('${PATH}')`);
      const seen = [];
      await f5(p);
      for (;;) {
        await p.waitState(['paused', 'idle', 'error']);
        if ((await p.state()) !== 'paused') break;
        seen.push(await nVar(p));
        await p.key('F5');
      }
      p.assert.deepEqual(seen, want);
      p.assert.equal(await p.state(), 'idle');
    });
  }
  t.test('a condition can use a global variable', async (p) => {
    await load(p, 'make "limit 2\nto g :n\n  if :n = 0 [stop]\n  print :n\n  g :n - 1\nend\ng 4\n');
    await gutterClick(p, 3);
    await p.ev(`LG.app.breakpoints.get('${PATH}').get(3).cond = ':n = :limit'; LG.app.breakpointsChanged('${PATH}')`);
    await f5(p);
    await untilPaused(p);
    p.assert.equal(await nVar(p), '2');
    await p.key('F5');
    await p.waitState('idle');
  });
  t.test('a condition that cannot be worked out stops, to be safe', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    await p.ev(`LG.app.breakpoints.get('${PATH}').get(2).cond = ':nosuchvar = 1'; LG.app.breakpointsChanged('${PATH}')`);
    await f5(p);
    p.assert.equal(await untilPaused(p), 3);
    await p.stopProgram();
  });
  t.test('a breakpoint inside a list that spans lines stops on every pass', async (p) => {
    await load(p, 'repeat 3 [\n  fd 10\n  rt 90\n]\nprint "done\n');
    await gutterClick(p, 2);
    p.assert.deepEqual(await stopsOf(p), [3, 3, 3]);
    await p.waitOutput(/done/);
  });
  t.test('a breakpoint inside a multi-line IF list stops only when the branch runs', async (p) => {
    await load(p, 'to h :x\n  if :x > 1 [\n    print "big\n  ]\nend\nh 1\nh 2\nh 3\n');
    await gutterClick(p, 2);
    const seen = [];
    await f5(p);
    for (;;) {
      await p.waitState(['paused', 'idle', 'error']);
      if ((await p.state()) !== 'paused') break;
      seen.push(await p.ev("(() => { const f = LG.Debug.frames(LG.app.interp); return f[f.length - 1].title; })()"));
      await p.key('F5');
    }
    p.assert.deepEqual(seen, ['h 2', 'h 3']);
  });
  t.test('a breakpoint inside a procedure stops when it is called from the command center', async (p) => {
    await load(p, 'to sq :s\n  repeat 4 [fd :s rt 90]\nend\n');
    await f5(p);
    await p.waitState('idle');
    await gutterClick(p, 1);
    await p.command('sq 30', { until: ['paused'] });
    p.assert.equal(await pausedLine(p), 2);
    const st = await p.ev("LG.Debug.frames(LG.app.interp).map(f => f.title)");
    p.assert.deepEqual(st, ['top level', 'sq 30']);
    // the REPEAT is on one line, so it stops again on each of its four passes
    let stops = 1;
    for (;;) {
      await p.key('F5');
      await p.waitState(['paused', 'idle']);
      if ((await p.state()) !== 'paused') break;
      stops++;
    }
    p.assert.equal(stops, 4);
    p.assert.equal(await p.segments(), 4);
  });
  t.test('several instructions on one line stop only once per pass', async (p) => {
    await load(p, 'fd 1 fd 2 fd 3 fd 4\nprint "done\n');
    await gutterClick(p, 0);
    p.assert.deepEqual(await stopsOf(p), [1]);
    await p.waitOutput(/done/);
  });
  t.test('a line run once per call stops once per call', async (p) => {
    await load(p, 'to two\n  fd 1 fd 2 fd 3\nend\ntwo\ntwo\ntwo\n');
    await gutterClick(p, 1);
    p.assert.deepEqual(await stopsOf(p), [2, 2, 2]);
  });
  t.test('a loop written on one line stops on every pass', async (p) => {
    await load(p, 'make "k 0\nrepeat 4 [make "k :k + 1]\nprint :k\n');
    await gutterClick(p, 1);
    const ks = [];
    await f5(p);
    for (;;) {
      await p.waitState(['paused', 'idle', 'error']);
      if ((await p.state()) !== 'paused') break;
      ks.push(await p.ev("LG.Data.showText(LG.app.interp.globals.get('k'))"));
      await p.key('F5');
    }
    p.assert.deepEqual(ks, ['0', '1', '2', '3']);
    await p.waitOutput(/^4$/m);
  });
  t.test('a breakpoint on a line that never runs does not stop', async (p) => {
    await load(p, 'to never\n  print "no\nend\nprint "yes\n');
    await gutterClick(p, 1);
    p.assert.deepEqual(await stopsOf(p), []);
  });
  t.test('breakpoints in two files each stop in their own file', async (p) => {
    await load(p, 'to helper40\n  print "helped\nend\n', '/projects/helper40.lgo');
    await f5(p);
    await p.waitState('idle');
    await gutterClick(p, 1);
    await load(p, 'load "/projects/helper40.lgo\nhelper40\nprint "after\n');
    await gutterClick(p, 2);
    await f5(p);
    await untilPaused(p);
    p.assert.equal(await p.activePath(), '/projects/helper40.lgo');
    p.assert.equal(await markedLine(p, 'exec'), 1);
    await p.key('F5');
    await untilPaused(p);
    p.assert.equal(await p.activePath(), PATH);
    p.assert.equal(await markedLine(p, 'exec'), 2);
    await p.key('F5');
    await p.waitState('idle');
  });
  t.test('a breakpoint added while paused takes effect when continuing', async (p) => {
    await load(p, 'print 1\nprint 2\nprint 3\nprint 4\n');
    await gutterClick(p, 0);
    await f5(p);
    await untilPaused(p);
    await gutterClick(p, 2);
    await p.key('F5');
    p.assert.equal(await untilPaused(p), 3);
    await p.key('F5');
    await p.waitState('idle');
  });
  t.test('a breakpoint removed while paused no longer stops', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    await f5(p);
    await untilPaused(p);
    await gutterClick(p, 2);
    await p.key('F5');
    await p.waitState('idle');
    await p.waitOutput(/end/);
  });
  t.test('the Run button reads Continue at a breakpoint and continues', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 2);
    await p.click('#tbRun');
    await untilPaused(p);
    p.assert.match(await p.text('#tbRun'), /Continue/);
    await p.click('#tbRun');
    await untilPaused(p);
    p.assert.equal(await nVar(p), '4');
    await p.stopProgram();
    p.assert.match(await p.text('#tbRun'), /Run/);
  });
  t.test('the exec line is shown at the breakpoint', async (p) => {
    await load(p, COUNT);
    await gutterClick(p, 3);
    await f5(p);
    await untilPaused(p);
    await waitMarked(p, 'exec', 3);
    p.assert.match((await gutterClasses(p))[3], /exec/);
    await p.stopProgram();
    await p.sleep(60);
    p.assert.equal(await markedLine(p, 'exec'), -1);
  });
}
