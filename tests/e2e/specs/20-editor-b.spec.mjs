// The editor, part two: indentation, comments, find, go to line, help, the gutter, undo,
// selection, big files and the right-click menu.
import { tidy, rendered, clickAt, rightClickAt, cursor, selection, setCursor, bps, gutterBps, clickGutter, gutterPoint, editCommand, closeAll } from './20-ed-lib.mjs';

const FILE = '/projects/edit.lgo';
const open = (p, text) => p.newFile(FILE, text);
const menuLabels = (p) => p.ev("[...document.querySelectorAll('.menu-pop .menu-item')].map((e) => e.children[0].innerText)");

async function selectLines(p, a, b) {
  // select from the start of line a to the end of line b with the keyboard
  await setCursor(p, a, 0);
  for (let i = a; i < b; i++) await p.key('ArrowDown', { shift: true, after: 5 });
  await p.key('End', { shift: true });
}

export default function (t) {
  t.afterEach(tidy);

  // ---- auto-indent ---------------------------------------------------------------------------------
  t.test('Enter after a TO line indents the next line', async (p) => {
    await open(p, '');
    await clickAt(p, 0, 0);
    await p.type('to square :n\n');
    p.assert.equal(await p.code(), 'to square :n\n  ');
  });
  t.test('Enter after an upper-case TO line indents too', async (p) => {
    await open(p, '');
    await clickAt(p, 0, 0);
    await p.type('TO BOX\n');
    p.assert.equal(await p.code(), 'TO BOX\n  ');
  });
  t.test('Enter after a .MACRO line indents', async (p) => {
    await open(p, '');
    await clickAt(p, 0, 0);
    await p.type('.macro twice :x\n');
    p.assert.equal(await p.code(), '.macro twice :x\n  ');
  });
  t.test('Enter keeps the indentation of the current line', async (p) => {
    await open(p, 'to sq\n    fd 10');
    await clickAt(p, 1, 40);
    await p.key('Enter');
    p.assert.equal(await p.code(), 'to sq\n    fd 10\n    ');
  });
  t.test('Enter on an ordinary line does not add indentation', async (p) => {
    await open(p, 'fd 10');
    await clickAt(p, 0, 20);
    await p.key('Enter');
    p.assert.equal(await p.code(), 'fd 10\n');
  });
  t.test('a word starting with "to" is not a TO line', async (p) => {
    await open(p, 'towards [0 0]');
    await clickAt(p, 0, 40);
    await p.key('Enter');
    p.assert.equal(await p.code(), 'towards [0 0]\n');
  });
  t.test('typing a whole procedure keeps the body indented', async (p) => {
    await open(p, '');
    await clickAt(p, 0, 0);
    await p.type('to tri\nrepeat 3 [fd 50 rt 120]\n');
    p.assert.equal(await p.code(), 'to tri\n  repeat 3 [fd 50 rt 120]\n  ');
  });
  t.test('auto-indent can be switched off in the settings', async (p) => {
    await open(p, '');
    await p.ev('LG.app.settings.autoIndent = false');
    try {
      await clickAt(p, 0, 0);
      await p.type('to tri\n');
      p.assert.equal(await p.code(), 'to tri\n');
    } finally { await p.ev('LG.app.settings.autoIndent = true'); }
  });
  t.test('the indent width follows the tab size setting', async (p) => {
    await open(p, '');
    await p.ev('LG.app.settings.tabSize = 4');
    try {
      await clickAt(p, 0, 0);
      await p.type('to tri\n');
      p.assert.equal(await p.code(), 'to tri\n    ');
    } finally { await p.ev('LG.app.settings.tabSize = 2'); }
  });
  t.test('Enter with the caret inside the indentation keeps only what is left of it', async (p) => {
    await open(p, '    fd 10');
    await setCursor(p, 0, 2);
    await p.key('Enter');
    // two spaces stay before the break and two are carried to the new line, ahead of the rest
    p.assert.equal(await p.code(), '  \n    fd 10');
  });
  t.test('Enter replaces a selection', async (p) => {
    await open(p, 'fd 10 rt 90');
    await p.fn(() => { const ta = LG.app.active.editor.ta; ta.focus(); ta.setSelectionRange(5, 6); });
    await p.key('Enter');
    p.assert.equal(await p.code(), 'fd 10\nrt 90');
  });

  // ---- Tab and Shift+Tab -----------------------------------------------------------------------------
  t.test('Tab inserts spaces at the caret', async (p) => {
    await open(p, 'fd 10');
    await setCursor(p, 0, 0);
    await p.key('Tab');
    p.assert.equal(await p.code(), '  fd 10');
  });
  t.test('Tab keeps focus in the editor', async (p) => {
    await open(p, 'fd 10');
    await setCursor(p, 0, 0);
    await p.key('Tab');
    p.assert.equal(await p.ev("document.activeElement === LG.app.active.editor.ta"), true);
  });
  t.test('Tab with several lines selected indents them all', async (p) => {
    await open(p, 'a\nb\nc\nd');
    await selectLines(p, 1, 2);
    await p.key('Tab');
    p.assert.equal(await p.code(), 'a\n  b\n  c\nd');
  });
  t.test('Tab keeps the indented lines selected', async (p) => {
    await open(p, 'a\nb\nc');
    await selectLines(p, 0, 1);
    await p.key('Tab');
    p.assert.equal((await selection(p))[2], '  a\n  b');
  });
  t.test('Tab leaves empty lines in a selection empty', async (p) => {
    await open(p, 'a\n\nb');
    await selectLines(p, 0, 2);
    await p.key('Tab');
    p.assert.equal(await p.code(), '  a\n\n  b');
  });
  t.test('Shift+Tab removes one level of indentation from the current line', async (p) => {
    await open(p, '    fd 10');
    await setCursor(p, 0, 6);
    await p.key('Tab', { shift: true });
    p.assert.equal(await p.code(), '  fd 10');
  });
  t.test('Shift+Tab on several lines outdents them all', async (p) => {
    await open(p, '  a\n    b\nc');
    await selectLines(p, 0, 2);
    await p.key('Tab', { shift: true });
    p.assert.equal(await p.code(), 'a\n  b\nc');
  });
  t.test('Shift+Tab removes only the spaces there are', async (p) => {
    await open(p, ' x');
    await setCursor(p, 0, 1);
    await p.key('Tab', { shift: true });
    p.assert.equal(await p.code(), 'x');
  });
  t.test('Tab then Shift+Tab gives back the original text', async (p) => {
    await open(p, 'to f\nfd 1\nend');
    await selectLines(p, 0, 2);
    await p.key('Tab');
    await p.key('Tab', { shift: true });
    p.assert.equal(await p.code(), 'to f\nfd 1\nend');
  });

  // ---- comment toggle ------------------------------------------------------------------------------------
  t.test('Ctrl+/ comments out the current line', async (p) => {
    await open(p, 'fd 10\nrt 90');
    await setCursor(p, 1, 1);
    await p.key('/', { ctrl: true });
    p.assert.equal(await p.code(), 'fd 10\n; rt 90');
  });
  t.test('Ctrl+/ twice gives back the line', async (p) => {
    await open(p, 'fd 10');
    await setCursor(p, 0, 1);
    await p.key('/', { ctrl: true });
    await p.key('/', { ctrl: true });
    p.assert.equal(await p.code(), 'fd 10');
  });
  t.test('Ctrl+/ on a selection comments every line and keeps indentation', async (p) => {
    await open(p, 'to f\n  fd 1\nend');
    await selectLines(p, 0, 2);
    await p.key('/', { ctrl: true });
    const lines = (await p.code()).split('\n');
    p.assert.equal(lines.length, 3);
    p.assert.ok(lines[1].startsWith('  '), 'indent kept: ' + lines[1]);
    p.assert.deepEqual(lines, ['; to f', '  ; fd 1', '; end']);
  });
  t.test('a commented line does not run', async (p) => {
    await open(p, 'print "one\nprint "two');
    await setCursor(p, 1, 0);
    await p.key('/', { ctrl: true });
    await p.key('F5');
    await p.waitState(['idle', 'error']);
    p.assert.equal(await p.state(), 'idle', await p.output());
    const out = await p.output();
    p.assert.match(out, /one/);
    p.assert.doesNotMatch(out.split('Running').pop(), /two/);
  });
  t.test('a commented line is coloured as a comment', async (p) => {
    await open(p, 'fd 10');
    await setCursor(p, 0, 0);
    await p.key('/', { ctrl: true });
    await rendered(p);
    p.assert.equal(await p.ev("LG.app.active.editor.hl.children[0].querySelector('.s-com') !== null"), true);
  });
  t.test('Ctrl+/ on a mix of commented and plain lines comments them all', async (p) => {
    await open(p, '; a\nfd 1');
    await selectLines(p, 0, 1);
    await p.key('/', { ctrl: true });
    await p.key('F5');
    await p.waitState(['idle', 'error']);
    p.assert.equal(await p.segments(), 0);
  });
  t.test('Ctrl+/ leaves blank lines alone', async (p) => {
    await open(p, 'fd 1\n\nfd 2');
    await selectLines(p, 0, 2);
    await p.key('/', { ctrl: true });
    p.assert.equal((await p.code()).split('\n')[1], '');
  });
  t.test('Ctrl+/ uncomments a line written with a semicolon by hand', async (p) => {
    await open(p, ';fd 1');
    await setCursor(p, 0, 0);
    await p.key('/', { ctrl: true });
    p.assert.equal(await p.code(), 'fd 1');
  });
  t.test('Ctrl+/ uncomments lines that start with a semicolon comment marker it added', async (p) => {
    await open(p, 'fd 1');
    await setCursor(p, 0, 0);
    await p.key('/', { ctrl: true });
    const commented = await p.code();
    await p.key('/', { ctrl: true });
    p.assert.notEqual(commented, 'fd 1');
    p.assert.equal(await p.code(), 'fd 1');
  });

  // ---- duplicate line ---------------------------------------------------------------------------------------
  t.test('Ctrl+D duplicates the current line below it', async (p) => {
    await open(p, 'fd 10\nrt 90');
    await setCursor(p, 0, 2);
    await p.key('d', { ctrl: true });
    p.assert.equal(await p.code(), 'fd 10\nfd 10\nrt 90');
  });
  t.test('Ctrl+D puts the caret on the copy', async (p) => {
    await open(p, 'fd 10\nrt 90');
    await setCursor(p, 0, 2);
    await p.key('d', { ctrl: true });
    p.assert.equal((await cursor(p)).line, 1);
  });
  t.test('Ctrl+D on the last line works', async (p) => {
    await open(p, 'a\nb');
    await setCursor(p, 1, 0);
    await p.key('d', { ctrl: true });
    p.assert.equal(await p.code(), 'a\nb\nb');
  });
  t.test('Ctrl+D on an empty line adds another empty line', async (p) => {
    await open(p, '');
    await setCursor(p, 0, 0);
    await p.key('d', { ctrl: true });
    p.assert.equal(await p.code(), '\n');
  });
  t.test('Ctrl+D moves a breakpoint below the copy down with its line', async (p) => {
    await open(p, 'a\nb\nc');
    await p.ev(`LG.app.toggleBreakpoint('${FILE}', 2)`);
    await setCursor(p, 0, 0);
    await p.key('d', { ctrl: true });
    p.assert.deepEqual(await bps(p, FILE), [3]);
    await p.ev('LG.app.clearBreakpoints()');
  });

  // ---- smart Home ---------------------------------------------------------------------------------------------
  t.test('Home goes to the first word of an indented line, then to column 0', async (p) => {
    await open(p, '    fd 10');
    await setCursor(p, 0, 8);
    await p.key('Home');
    p.assert.equal((await cursor(p)).col, 4);
    await p.key('Home');
    p.assert.equal((await cursor(p)).col, 0);
    await p.key('Home');
    p.assert.equal((await cursor(p)).col, 4);
  });
  t.test('Shift+Home selects to the start of the line', async (p) => {
    await open(p, 'fd 10');
    await setCursor(p, 0, 5);
    await p.key('Home', { shift: true });
    p.assert.equal((await selection(p))[2], 'fd 10');
  });

  // ---- find ----------------------------------------------------------------------------------------------------
  t.test('Ctrl+F opens the Find box', async (p) => {
    await open(p, 'fd 10');
    await setCursor(p, 0, 0);
    await p.key('f', { ctrl: true });
    p.assert.equal(await p.waitModal(), 'Find');
    await p.key('Escape');
  });
  t.test('Find selects the first match after the caret', async (p) => {
    await open(p, 'fd 10\nrt 90\nfd 20');
    await setCursor(p, 1, 0);
    await p.key('f', { ctrl: true });
    await p.waitModal();
    await p.type('fd');
    await p.key('Enter');
    await p.sleep(80);
    const s = await selection(p);
    p.assert.equal(s[2], 'fd');
    p.assert.equal((await cursor(p)).line, 2);
  });
  t.test('Find ignores case', async (p) => {
    await open(p, 'print "HELLO');
    await setCursor(p, 0, 0);
    await p.key('f', { ctrl: true });
    await p.waitModal();
    await p.type('hello');
    await p.key('Enter');
    await p.sleep(80);
    p.assert.equal((await selection(p))[2], 'HELLO');
  });
  t.test('Find wraps around to the top', async (p) => {
    await open(p, 'repeat 4 [fd 10]\nprint 1');
    await setCursor(p, 1, 3);
    await p.key('f', { ctrl: true });
    await p.waitModal();
    await p.type('repeat');
    await p.key('Enter');
    await p.sleep(80);
    p.assert.deepEqual((await selection(p)).slice(0, 2), [0, 6]);
  });
  t.test('Find remembers the last search and finds the next one', async (p) => {
    await open(p, 'a x\nb x\nc x');
    await setCursor(p, 0, 0);
    await p.key('f', { ctrl: true });
    await p.waitModal();
    await p.type('x');
    await p.key('Enter');
    await p.sleep(80);
    p.assert.equal((await cursor(p)).line, 0);
    await p.key('f', { ctrl: true });
    await p.waitModal();
    p.assert.equal(await p.ev("document.querySelector('.modal input').value"), 'x');
    await p.key('Enter');
    await p.sleep(80);
    p.assert.equal((await cursor(p)).line, 1);
  });
  t.test('Find with no match says so', async (p) => {
    await open(p, 'fd 10');
    await setCursor(p, 0, 0);
    await p.key('f', { ctrl: true });
    await p.waitModal();
    await p.type('zebra');
    await p.key('Enter');
    await p.waitToast(/Not found: zebra/);
  });
  t.test('Find treats special characters literally', async (p) => {
    await open(p, 'print (sum 1 2)\nprint [a.b]');
    await setCursor(p, 0, 0);
    await p.key('f', { ctrl: true });
    await p.waitModal();
    await p.type('[a.b]');
    await p.key('Enter');
    await p.sleep(80);
    p.assert.equal((await selection(p))[2], '[a.b]');
  });
  t.test('Escape closes Find and leaves the text alone', async (p) => {
    await open(p, 'fd 10');
    await setCursor(p, 0, 0);
    await p.key('f', { ctrl: true });
    await p.waitModal();
    await p.key('Escape');
    p.assert.equal(await p.modalOpen(), false);
    p.assert.equal(await p.code(), 'fd 10');
  });
  t.test('Find scrolls a match far down into view', async (p) => {
    await open(p, Array.from({ length: 300 }, (_, i) => 'print ' + i).join('\n') + '\nprint "needle');
    await setCursor(p, 0, 0);
    await p.key('f', { ctrl: true });
    await p.waitModal();
    await p.type('needle');
    await p.key('Enter');
    await p.sleep(100);
    const { top, h, line } = await p.ev('(() => { const e = LG.app.active.editor; return { top: e.ta.scrollTop, h: e.ta.clientHeight, line: e.cursor().line * e.lineHeight }; })()');
    p.assert.ok(line >= top && line <= top + h, `line at ${line}, view ${top}..${top + h}`);
  });
  t.test('Ctrl+H replaces every match', async (p) => {
    await open(p, 'fd 10\nfd 20\nrt 90');
    await setCursor(p, 0, 0);
    await p.key('h', { ctrl: true });
    p.assert.equal(await p.waitModal(), 'Replace');
    await p.type('fd');
    await p.key('Enter');
    await p.sleep(100);
    await p.waitModal();
    await p.type('forward');
    await p.key('Enter');
    await p.waitToast(/Replaced 2 times/);
    p.assert.equal(await p.code(), 'forward 10\nforward 20\nrt 90');
  });
  t.test('a replace-all is one undo step', async (p) => {
    await open(p, 'fd 1 fd 2');
    await setCursor(p, 0, 0);
    await p.key('h', { ctrl: true });
    await p.waitModal();
    await p.type('fd');
    await p.key('Enter');
    await p.sleep(100);
    await p.waitModal();
    await p.type('bk');
    await p.key('Enter');
    await p.sleep(100);
    p.assert.equal(await p.code(), 'bk 1 bk 2');
    await editCommand(p, 'undo');
    p.assert.equal(await p.code(), 'fd 1 fd 2');
  });

  // ---- go to line ---------------------------------------------------------------------------------------------------
  t.test('Ctrl+G opens Go to line', async (p) => {
    await open(p, 'a\nb');
    await setCursor(p, 0, 0);
    await p.key('g', { ctrl: true });
    p.assert.equal(await p.waitModal(), 'Go to line');
    await p.key('Escape');
  });
  t.test('Go to line moves the caret to that line', async (p) => {
    await open(p, 'a\nb\nc\nd\ne');
    await setCursor(p, 0, 0);
    await p.key('g', { ctrl: true });
    await p.waitModal();
    await p.type('4');
    await p.key('Enter');
    await p.sleep(80);
    p.assert.deepEqual(await cursor(p), { line: 3, col: 0 });
  });
  t.test('Go to line scrolls a far line into view', async (p) => {
    await open(p, Array.from({ length: 500 }, (_, i) => 'print ' + i).join('\n'));
    await setCursor(p, 0, 0);
    await p.key('g', { ctrl: true });
    await p.waitModal();
    await p.type('400');
    await p.key('Enter');
    await p.sleep(100);
    const { top, h, lh } = await p.ev('(() => { const e = LG.app.active.editor; return { top: e.ta.scrollTop, h: e.ta.clientHeight, lh: e.lineHeight }; })()');
    p.assert.equal((await cursor(p)).line, 399);
    p.assert.ok(399 * lh >= top && 399 * lh <= top + h);
  });
  t.test('Go to line flashes the line', async (p) => {
    await open(p, 'a\nb\nc');
    await setCursor(p, 0, 0);
    await p.key('g', { ctrl: true });
    await p.waitModal();
    await p.type('2');
    await p.key('Enter');
    await p.sleep(60);
    p.assert.equal(await p.ev("LG.app.active.editor.hl.children[1].classList.contains('flash')"), true);
  });
  t.test('Go to line past the end goes to the last line', async (p) => {
    await open(p, 'a\nb\nc');
    await setCursor(p, 0, 0);
    await p.key('g', { ctrl: true });
    await p.waitModal();
    await p.type('99');
    await p.key('Enter');
    await p.sleep(80);
    p.assert.equal((await cursor(p)).line, 2);
  });
  t.test('Go to line with words does nothing', async (p) => {
    await open(p, 'a\nb\nc');
    await setCursor(p, 1, 0);
    await p.key('g', { ctrl: true });
    await p.waitModal();
    await p.type('abc');
    await p.key('Enter');
    await p.sleep(80);
    p.assert.equal((await cursor(p)).line, 1);
  });
  t.test('Go to line 0 does nothing', async (p) => {
    await open(p, 'a\nb\nc');
    await setCursor(p, 2, 0);
    await p.key('g', { ctrl: true });
    await p.waitModal();
    await p.type('0');
    await p.key('Enter');
    await p.sleep(80);
    p.assert.equal((await cursor(p)).line, 2);
  });

  // ---- F1 help -------------------------------------------------------------------------------------------------------
  const HELPWORDS = [['fd 100', 1, /forward/i], ['repeat 4 [fd 1]', 2, /repeat/i], ['print "x', 3, /print/i], ['setpencolor "red', 4, /setpencolor/i], ['  make "x 1', 3, /make/i]];
  for (const [code, col, re] of HELPWORDS) {
    t.test(`F1 on ${code.trim().split(' ')[0]} opens its help page`, async (p) => {
      await open(p, code);
      await setCursor(p, 0, col);
      await p.key('F1');
      p.assert.equal(await p.waitModal(), 'Logo reference');
      await p.wait("!!document.querySelector('#helpMain h3')", 3000);
      p.assert.match(await p.text('#helpMain h3'), re);
      await p.key('Escape');
    });
  }
  t.test('F1 on a word that is not a primitive searches for it', async (p) => {
    await open(p, 'zzqq 1');
    await setCursor(p, 0, 1);
    await p.key('F1');
    await p.waitModal();
    p.assert.equal(await p.ev("document.getElementById('helpSearch').value"), 'zzqq');
    await p.key('Escape');
  });
  t.test('F1 on an empty line opens the reference index', async (p) => {
    await open(p, '\nfd 1');
    await setCursor(p, 0, 0);
    await p.key('F1');
    await p.waitModal();
    p.assert.equal(await p.ev("document.getElementById('helpSearch').value"), '');
    p.assert.equal(await p.exists('#helpMain h3'), false);
    await p.key('Escape');
  });
  t.test('F1 does not insert anything into the program', async (p) => {
    await open(p, 'fd 1');
    await setCursor(p, 0, 0);
    await p.key('F1');
    await p.waitModal();
    await p.key('Escape');
    p.assert.equal(await p.code(), 'fd 1');
  });
  t.test('after closing help the caret is back in the editor', async (p) => {
    await open(p, 'fd 1');
    await setCursor(p, 0, 1);
    await p.key('F1');
    await p.waitModal();
    await p.key('Escape');
    await p.sleep(60);
    p.assert.equal(await p.ev('document.activeElement === LG.app.active.editor.ta'), true);
  });

  // ---- line numbers and gutter -------------------------------------------------------------------------------------------
  t.test('the gutter shows one number per line', async (p) => {
    await open(p, 'a\nb\nc\nd');
    await rendered(p);
    p.assert.deepEqual(await p.texts('#editors .ed:not([style*="none"]) .ed-gl'), ['1', '2', '3', '4']);
  });
  t.test('line numbers grow when lines are added', async (p) => {
    await open(p, 'a');
    await setCursor(p, 0, 1);
    await p.key('Enter');
    await p.key('Enter');
    await rendered(p);
    p.assert.equal(await p.ev('LG.app.active.editor.inner.children.length'), 3);
  });
  t.test('line numbers shrink when lines are deleted', async (p) => {
    await open(p, 'a\nb\nc');
    await setCursor(p, 2, 0);
    await p.key('Backspace');
    await rendered(p);
    p.assert.equal(await p.ev('LG.app.active.editor.inner.children.length'), 2);
  });
  t.test('line numbers line up with the text lines', async (p) => {
    await open(p, Array.from({ length: 40 }, (_, i) => 'print ' + i).join('\n'));
    await rendered(p);
    const d = await p.ev('(() => { const e = LG.app.active.editor; return [0, 10, 39].map((i) => Math.abs(e.inner.children[i].getBoundingClientRect().top - e.hl.children[i].getBoundingClientRect().top)); })()');
    for (const x of d) p.assert.ok(x < 2, 'offset ' + d);
  });
  t.test('line numbers stay lined up after scrolling', async (p) => {
    await open(p, Array.from({ length: 300 }, (_, i) => 'print ' + i).join('\n'));
    await p.ev('(() => { const e = LG.app.active.editor; e.ta.scrollTop = 2000; e.ta.dispatchEvent(new Event("scroll")); })()');
    await p.sleep(60);
    const d = await p.ev('(() => { const e = LG.app.active.editor; return Math.abs(e.inner.children[120].getBoundingClientRect().top - e.hl.children[120].getBoundingClientRect().top); })()');
    p.assert.ok(d < 2, 'offset ' + d);
  });
  t.test('the gutter gets wider for four-digit line numbers', async (p) => {
    await open(p, 'a');
    const w1 = (await p.rect('#editors .ed:not([style*="none"]) .ed-gutter')).w;
    await p.setCode(Array.from({ length: 1200 }, () => 'x').join('\n'));
    await rendered(p);
    const w2 = (await p.rect('#editors .ed:not([style*="none"]) .ed-gutter')).w;
    p.assert.ok(w2 > w1, `${w1} -> ${w2}`);
  });
  t.test('clicking a line number adds a breakpoint dot', async (p) => {
    await open(p, 'a\nb\nc');
    await clickGutter(p, 1);
    await rendered(p);
    p.assert.deepEqual(await bps(p, FILE), [1]);
    p.assert.deepEqual(await gutterBps(p), [1]);
    await p.ev('LG.app.clearBreakpoints()');
  });
  t.test('clicking the line number again removes the dot', async (p) => {
    await open(p, 'a\nb\nc');
    await clickGutter(p, 2);
    await clickGutter(p, 2);
    await rendered(p);
    p.assert.deepEqual(await bps(p, FILE), []);
    p.assert.deepEqual(await gutterBps(p), []);
  });
  t.test('clicking each line number of a long file marks exactly that line', async (p) => {
    await open(p, Array.from({ length: 60 }, (_, i) => 'print ' + i).join('\n'));
    for (const ln of [0, 7, 19, 33, 59]) await clickGutter(p, ln);
    await rendered(p);
    p.assert.deepEqual(await bps(p, FILE), [0, 7, 19, 33, 59]);
    await p.ev('LG.app.clearBreakpoints()');
  });
  t.test('a breakpoint line is tinted in the text', async (p) => {
    await open(p, 'a\nb');
    await clickGutter(p, 0);
    await rendered(p);
    p.assert.equal(await p.ev("LG.app.active.editor.hl.children[0].classList.contains('bpline')"), true);
    await p.ev('LG.app.clearBreakpoints()');
  });
  t.test('a breakpoint dot is drawn red in the gutter', async (p) => {
    await open(p, 'a\nb');
    await clickGutter(p, 0);
    await rendered(p);
    const bg = await p.ev("getComputedStyle(LG.app.active.editor.inner.children[0], '::before').backgroundColor");
    p.assert.notEqual(bg, 'rgba(0, 0, 0, 0)');
    await p.ev('LG.app.clearBreakpoints()');
  });
  t.test('F9 toggles a breakpoint on the caret line', async (p) => {
    await open(p, 'a\nb\nc');
    await setCursor(p, 2, 0);
    await p.key('F9');
    p.assert.deepEqual(await bps(p, FILE), [2]);
    await p.key('F9');
    p.assert.deepEqual(await bps(p, FILE), []);
  });
  t.test('a breakpoint moves down when a line is inserted above it', async (p) => {
    await open(p, 'a\nb\nc');
    await clickGutter(p, 2);
    await setCursor(p, 0, 1);
    await p.key('Enter');
    await rendered(p);
    p.assert.deepEqual(await bps(p, FILE), [3]);
    p.assert.deepEqual(await gutterBps(p), [3]);
    await p.ev('LG.app.clearBreakpoints()');
  });
  t.test('a breakpoint moves up when a line above it is removed', async (p) => {
    await open(p, 'a\nb\nc');
    await clickGutter(p, 2);
    await setCursor(p, 1, 0);
    await p.key('Backspace');
    await rendered(p);
    p.assert.deepEqual(await bps(p, FILE), [1]);
    await p.ev('LG.app.clearBreakpoints()');
  });
  t.test('breakpoints are remembered after a reload', async (p) => {
    await open(p, 'a\nb\nc');
    await clickGutter(p, 1);
    await p.ev('LG.app.vfs.flushNow && LG.app.vfs.flushNow()');
    await p.sleep(250);
    await p.reload();
    await p.ev(`LG.app.openFile('${FILE}')`);
    p.assert.deepEqual(await bps(p, FILE), [1]);
    await rendered(p);
    p.assert.deepEqual(await gutterBps(p), [1]);
    await p.ev('LG.app.clearBreakpoints()');
  });
  t.test('right-clicking a line number offers the breakpoint menu', async (p) => {
    await open(p, 'a\nb');
    await clickGutter(p, 0, { button: 'right' });
    await p.wait("!!document.querySelector('.menu-pop')");
    p.assert.deepEqual(await menuLabels(p), ['Add breakpoint', 'Stop only when…', 'Run to here']);
  });
  t.test('right-clicking a breakpoint offers to remove or disable it', async (p) => {
    await open(p, 'a\nb');
    await clickGutter(p, 1);
    await clickGutter(p, 1, { button: 'right' });
    await p.wait("!!document.querySelector('.menu-pop')");
    p.assert.deepEqual(await menuLabels(p), ['Remove breakpoint', 'Stop only when…', 'Disable', 'Run to here']);
    await p.click('.menu-pop .menu-item', 'Disable');
    await rendered(p);
    p.assert.equal(await p.ev("LG.app.active.editor.inner.children[1].classList.contains('disabled')"), true);
    await p.ev('LG.app.clearBreakpoints()');
  });
  t.test('a conditional breakpoint from the gutter menu gets a yellow dot', async (p) => {
    await open(p, 'to f :n\nprint :n\nend\nf 1');
    await clickGutter(p, 1, { button: 'right' });
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.click('.menu-pop .menu-item', 'Stop only when');
    await p.waitModal();
    await p.modalInput(':n = 3');
    await p.key('Enter');
    await rendered(p);
    p.assert.equal(await p.ev("LG.app.active.editor.inner.children[1].classList.contains('cond')"), true);
    p.assert.equal(await p.ev(`LG.app.breakpoints.get('${FILE}').get(1).cond`), ':n = 3');
    await p.ev('LG.app.clearBreakpoints()');
  });
  t.test('right-clicking a line number does not toggle a breakpoint', async (p) => {
    await open(p, 'a\nb');
    await clickGutter(p, 0, { button: 'right' });
    p.assert.deepEqual(await bps(p, FILE), []);
  });
  t.test('Run to here from the gutter pauses on that line', async (p) => {
    await open(p, 'print 1\nprint 2\nprint 3');
    await clickGutter(p, 2, { button: 'right' });
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.click('.menu-pop .menu-item', 'Run to here');
    await p.waitState('paused');
    p.assert.equal(await p.ev("[...LG.app.active.editor.hl.children].findIndex((l) => l.classList.contains('exec'))"), 2);
    await p.stopProgram();
  });

  // ---- selection, cursor and undo -------------------------------------------------------------------------------
  t.test('Shift+arrows select text', async (p) => {
    await open(p, 'forward 10');
    await setCursor(p, 0, 0);
    for (let i = 0; i < 7; i++) await p.key('ArrowRight', { shift: true, after: 5 });
    p.assert.equal((await selection(p))[2], 'forward');
  });
  t.test('typing replaces the selection', async (p) => {
    await open(p, 'forward 10');
    await setCursor(p, 0, 0);
    for (let i = 0; i < 7; i++) await p.key('ArrowRight', { shift: true, after: 5 });
    await p.type('fd');
    p.assert.equal(await p.code(), 'fd 10');
  });
  t.test('double-clicking a word selects it', async (p) => {
    await open(p, 'print sum 2 3');
    const pt = await (await import('./20-ed-lib.mjs')).point(p, 0, 7);
    await p.clickAt(pt[0], pt[1], { double: true });
    p.assert.equal((await selection(p))[2], 'sum');
  });
  t.test('dragging with the mouse selects text', async (p) => {
    await open(p, 'print sum 2 3');
    const { point } = await import('./20-ed-lib.mjs');
    const [x1, y1] = await point(p, 0, 0);
    const [x2] = await point(p, 0, 9);
    await p.mouse('mouseMoved', x1 - 3, y1);
    await p.mouse('mousePressed', x1 - 3, y1);
    await p.mouse('mouseMoved', x2 - 3, y1);
    await p.mouse('mouseReleased', x2 - 3, y1);
    await p.sleep(60);
    p.assert.equal((await selection(p))[2], 'print sum');
  });
  t.test('select all then Delete empties the editor', async (p) => {
    await open(p, 'a\nb\nc');
    await setCursor(p, 0, 0);
    await editCommand(p, 'selectAll');
    await p.key('Delete');
    p.assert.equal(await p.code(), '');
  });
  t.test('undo takes back typing', async (p) => {
    await open(p, 'fd 10');
    await setCursor(p, 0, 5);
    await p.insertText(' rt 90');
    p.assert.equal(await p.code(), 'fd 10 rt 90');
    await editCommand(p, 'undo');
    p.assert.equal(await p.code(), 'fd 10');
  });
  t.test('redo puts the typing back', async (p) => {
    await open(p, 'fd 10');
    await setCursor(p, 0, 5);
    await p.insertText(' rt 90');
    await editCommand(p, 'undo');
    await editCommand(p, 'redo');
    p.assert.equal(await p.code(), 'fd 10 rt 90');
  });
  t.test('undo takes back an auto-indented Enter', async (p) => {
    await open(p, 'to f');
    await setCursor(p, 0, 4);
    await p.key('Enter');
    p.assert.equal(await p.code(), 'to f\n  ');
    await editCommand(p, 'undo');
    p.assert.equal(await p.code(), 'to f');
  });
  t.test('undo takes back Tab indentation of a block', async (p) => {
    await open(p, 'a\nb');
    await selectLines(p, 0, 1);
    await p.key('Tab');
    await editCommand(p, 'undo');
    p.assert.equal(await p.code(), 'a\nb');
  });
  t.test('undo takes back a comment toggle', async (p) => {
    await open(p, 'fd 1');
    await setCursor(p, 0, 0);
    await p.key('/', { ctrl: true });
    await editCommand(p, 'undo');
    p.assert.equal(await p.code(), 'fd 1');
  });
  t.test('undo takes back a duplicated line', async (p) => {
    await open(p, 'fd 1');
    await setCursor(p, 0, 0);
    await p.key('d', { ctrl: true });
    await editCommand(p, 'undo');
    p.assert.equal(await p.code(), 'fd 1');
  });
  t.test('undo back to the saved text clears the changed dot', async (p) => {
    await open(p, 'fd 1');
    await setCursor(p, 0, 4);
    await p.insertText('0');
    p.assert.equal(await p.ev('LG.app.active.dirty'), true);
    await editCommand(p, 'undo');
    p.assert.equal(await p.ev('LG.app.active.dirty'), false);
  });
  t.test('each file has its own undo history', async (p) => {
    await p.newFile('/projects/u1.lgo', 'one');
    await setCursor(p, 0, 3);
    await p.insertText('X');
    await p.newFile('/projects/u2.lgo', 'two');
    await setCursor(p, 0, 3);
    await p.insertText('Y');
    await p.ev("LG.app.openFile('/projects/u1.lgo')");
    await setCursor(p, 0, 4);
    // Chrome keeps one undo list per page, so a step may be spent on the other file; it must never change it
    for (let i = 0; i < 3 && (await p.code()) !== 'one'; i++) await editCommand(p, 'undo');
    p.assert.equal(await p.code(), 'one');
    p.assert.equal(await p.ev("LG.app.docByPath('/projects/u2.lgo').editor.getValue()"), 'twoY');
    await closeAll(p);
  });

  // ---- very long files --------------------------------------------------------------------------------------------------
  t.test('a 5000-line file opens with every line number', async (p) => {
    await open(p, Array.from({ length: 5000 }, (_, i) => `print ${i} ; line ${i + 1}`).join('\n'));
    await rendered(p);
    p.assert.equal(await p.ev('LG.app.active.editor.inner.children.length'), 5000);
    p.assert.equal(await p.ev('LG.app.active.editor.hl.children.length'), 5000);
  });
  t.test('typing at the end of a 5000-line file is quick', async (p) => {
    await open(p, Array.from({ length: 5000 }, (_, i) => `repeat 2 [fd ${i} rt 1]`).join('\n'));
    await setCursor(p, 4999, 0);
    await p.key('End');
    const t0 = Date.now();
    await p.type(' fd 1');
    const ms = Date.now() - t0;
    p.assert.ok((await p.code()).endsWith('rt 1] fd 1'));
    p.assert.ok(ms < 4000, ms + ' ms');
  });
  t.test('a 5000-line file scrolls to the bottom with Ctrl+End', async (p) => {
    await open(p, Array.from({ length: 5000 }, (_, i) => `print ${i}`).join('\n'));
    await setCursor(p, 0, 0);
    await p.ev('(() => { const e = LG.app.active.editor; e.ta.setSelectionRange(e.ta.value.length, e.ta.value.length); e.revealLine(4999); })()');
    await p.sleep(60);
    const r = await p.ev('(() => { const e = LG.app.active.editor; const g = e.inner.children[4999].getBoundingClientRect(); const b = e.gutter.getBoundingClientRect(); return [g.top, b.top, b.bottom]; })()');
    p.assert.ok(r[0] >= r[1] && r[0] <= r[2], 'last line number visible ' + r);
  });
  t.test('a 5000-line file runs from the editor', async (p) => {
    await open(p, Array.from({ length: 5000 }, () => 'make "n :n + 1').join('\n').replace(/^/, 'make "n 0\n') + '\nprint :n');
    await p.key('F5');
    await p.waitState(['idle', 'error'], 20000);
    await p.waitOutput(/^5000$/m);
  }, { timeout: 40000 });
  t.test('a very long line scrolls sideways and stays lined up', async (p) => {
    await open(p, 'print "' + 'x'.repeat(3000));
    await setCursor(p, 0, 0);
    await p.key('End');
    await p.sleep(80);
    const [a, b] = await p.ev('[LG.app.active.editor.ta.scrollLeft, LG.app.active.editor.hl.scrollLeft]');
    p.assert.ok(a > 0);
    p.assert.equal(a, b);
  });
  t.test('a big paste goes in as a whole', async (p) => {
    await open(p, '');
    await setCursor(p, 0, 0);
    const big = Array.from({ length: 3000 }, (_, i) => 'fd ' + i).join('\n');
    await p.fn((t) => LG.app.active.editor.insert(t), big);
    await rendered(p);
    p.assert.equal((await p.code()).length, big.length);
    p.assert.equal(await p.ev('LG.app.active.editor.inner.children.length'), 3000);
    p.assert.equal(await p.ev('LG.app.active.dirty'), true);
  });

  // ---- the right-click menu ------------------------------------------------------------------------------------------------
  t.test('right-clicking a primitive offers help, breakpoint and run to here', async (p) => {
    await open(p, 'forward 10');
    await rightClickAt(p, 0, 2);
    await p.wait("!!document.querySelector('.menu-pop')");
    p.assert.deepEqual(await menuLabels(p), ['Help on forward', 'Toggle breakpoint', 'Run to here']);
  });
  t.test('Help on a word opens that help page', async (p) => {
    await open(p, 'repeat 2 [fd 1]');
    await rightClickAt(p, 0, 1);
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.click('.menu-pop .menu-item', 'Help on repeat');
    await p.waitModal();
    await p.wait("!!document.querySelector('#helpMain h3')");
    p.assert.match(await p.text('#helpMain h3'), /^repeat/i);
  });
  t.test('right-clicking a variable offers to watch it', async (p) => {
    await open(p, 'print :size');
    await rightClickAt(p, 0, 8);
    await p.wait("!!document.querySelector('.menu-pop')");
    p.assert.equal((await menuLabels(p))[0], 'Watch :size');
  });
  t.test('Watch :x adds a watch and shows the Watch panel', async (p) => {
    await p.ev("LG.app.inspector.watches.length = 0; LG.app.inspector.saveWatches()");
    await open(p, 'make "x 5\nprint :x');
    await rightClickAt(p, 1, 7);
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.click('.menu-pop .menu-item', 'Watch :x');
    await p.sleep(80);
    p.assert.deepEqual(await p.ev('LG.app.inspector.watches.map((w) => w.expr)'), [':x']);
    p.assert.ok(await p.visible('#ipane-watch'));
  });
  t.test('watching the same variable twice keeps one watch', async (p) => {
    await p.ev("LG.app.inspector.watches.length = 0; LG.app.inspector.saveWatches()");
    await open(p, 'print :x');
    for (let i = 0; i < 2; i++) {
      await rightClickAt(p, 0, 7);
      await p.wait("!!document.querySelector('.menu-pop')");
      await p.click('.menu-pop .menu-item', 'Watch :x');
      await p.sleep(60);
    }
    p.assert.deepEqual(await p.ev('LG.app.inspector.watches.map((w) => w.expr)'), [':x']);
    await p.ev("LG.app.inspector.watches.length = 0; LG.app.inspector.saveWatches()");
  });
  t.test('right-clicking a quoted name offers to watch it', async (p) => {
    await open(p, 'make "total 0');
    await rightClickAt(p, 0, 7);
    await p.wait("!!document.querySelector('.menu-pop')");
    p.assert.equal((await menuLabels(p))[0], 'Watch :total');
  });
  t.test('right-clicking a number offers only breakpoint and run to here', async (p) => {
    await open(p, 'fd 12345');
    await rightClickAt(p, 0, 5);
    await p.wait("!!document.querySelector('.menu-pop')");
    p.assert.deepEqual(await menuLabels(p), ['Toggle breakpoint', 'Run to here']);
  });
  t.test('Toggle breakpoint from the text menu marks that line', async (p) => {
    await open(p, 'print 1\nprint 2');
    await rightClickAt(p, 1, 1);
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.click('.menu-pop .menu-item', 'Toggle breakpoint');
    p.assert.deepEqual(await bps(p, FILE), [1]);
    await rightClickAt(p, 1, 1);
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.click('.menu-pop .menu-item', 'Toggle breakpoint');
    p.assert.deepEqual(await bps(p, FILE), []);
  });
  t.test('Run to here from the text menu pauses on that line', async (p) => {
    await open(p, 'print "a\nprint "b\nprint "c');
    await rightClickAt(p, 1, 1);
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.click('.menu-pop .menu-item', 'Run to here');
    await p.waitState('paused');
    await p.waitOutput(/^a$/m);
    p.assert.doesNotMatch((await p.output()).split('Running').pop(), /^b$/m);
    await p.stopProgram();
  });
  t.test('Run to here leaves no breakpoint behind', async (p) => {
    await open(p, 'print "a\nprint "b');
    await rightClickAt(p, 1, 1);
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.click('.menu-pop .menu-item', 'Run to here');
    await p.waitState('paused');
    await p.key('F5');
    await p.waitState('idle');
    await p.key('F5');
    await p.waitState(['idle', 'paused']);
    p.assert.equal(await p.state(), 'idle');
    p.assert.deepEqual(await bps(p, FILE), []);
  });
  t.test('Run to here inside a procedure pauses inside it', async (p) => {
    await open(p, 'to f\nprint "in\nend\nf');
    await rightClickAt(p, 1, 1);
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.click('.menu-pop .menu-item', 'Run to here');
    await p.waitState('paused');
    await p.inspector('stack');
    p.assert.match(await p.paneText('stack'), /\bf\b/);
    await p.stopProgram();
  });
  t.test('right-clicking past the end of the text shows no editor menu', async (p) => {
    await open(p, 'fd 1');
    await rightClickAt(p, 5, 0);
    await p.sleep(80);
    p.assert.equal(await p.exists('.menu-pop'), false);
  });
  t.test('Escape closes the right-click menu', async (p) => {
    await open(p, 'fd 1');
    await rightClickAt(p, 0, 0);
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.key('Escape');
    p.assert.equal(await p.exists('.menu-pop'), false);
  });
  t.test('the right-click menu works with the keyboard', async (p) => {
    await open(p, 'print 1\nprint 2');
    await rightClickAt(p, 0, 1);
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.key('ArrowDown');
    await p.key('ArrowDown');
    await p.key('Enter');
    await p.sleep(60);
    p.assert.deepEqual(await bps(p, FILE), [0]);
    await p.ev('LG.app.clearBreakpoints()');
  });

  // ---- gutter point sanity: the dots are where the numbers are --------------------------------------------------------------
  t.test('the gutter point used for clicks is on the right number', async (p) => {
    await open(p, Array.from({ length: 30 }, (_, i) => 'print ' + i).join('\n'));
    const [x, y] = await gutterPoint(p, 25);
    const txt = await p.fn((a, b) => document.elementFromPoint(a, b).textContent, x, y);
    p.assert.equal(txt, '26');
  });
}
