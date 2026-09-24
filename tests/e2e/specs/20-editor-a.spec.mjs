// The editor, part one: typing and syntax colouring.
import { spans, classOf, rendered, clickAt, cursor, tabs } from './20-ed-lib.mjs';

const FILE = '/projects/colours.lgo';
async function show(p, text) {
  await p.newFile(FILE, '');
  await p.setCode(text);
  await rendered(p);
}

// [code, line, word, expected class]
const WORDS = [
  ['to square :size', 0, 'to', 's-kw'],
  ['TO SQUARE :size', 0, 'TO', 's-kw'],
  ['To mixed', 0, 'To', 's-kw'],
  ['end', 0, 'end', 's-kw'],
  ['END', 0, 'END', 's-kw'],
  ['  end', 0, 'end', 's-kw'],
  ['.macro twice :x', 0, '.macro', 's-kw'],
  ['to square :size', 0, ':size', 's-var'],
  ['to square :size', 0, 'square', ''],
  ['fd 100', 0, 'fd', 's-prim'],
  ['forward 100', 0, 'forward', 's-prim'],
  ['FORWARD 100', 0, 'FORWARD', 's-prim'],
  ['rt 90', 0, 'rt', 's-prim'],
  ['setpencolor "red', 0, 'setpencolor', 's-prim'],
  ['repeat 4 [fd 10]', 0, 'repeat', 's-prim'],
  ['make "x 5', 0, 'make', 's-prim'],
  ['fd 100', 0, '100', 's-num'],
  ['fd 2.5', 0, '2.5', 's-num'],
  ['fd -5', 0, '-5', 's-num'],
  ['print 1e3', 0, '1e3', 's-num'],
  ['print .5', 0, '.5', 's-num'],
  ['print "hello', 0, '"hello', 's-str'],
  ['print "Hello.World', 0, '"Hello.World', 's-str'],
  ['print "', 0, '"', 's-str'],
  ['make "x 5', 0, '"x', 's-str'],
  ['print :x', 0, ':x', 's-var'],
  ['print :long.name', 0, ':long.name', 's-var'],
  ['print thing "x', 0, 'thing', 's-prim'],
  ['print sum :a :b', 0, ':b', 's-var'],
  ['print 3 * 4', 0, '*', 's-op'],
  ['print 3 + 4', 0, '+', 's-op'],
  ['print 3 - 4', 0, '-', 's-op'],
  ['print 3 / 4', 0, '/', 's-op'],
  ['if 3 = 4 [stop]', 0, '=', 's-op'],
  ['if 3 < 4 [stop]', 0, '<', 's-op'],
  ['if 3 > 4 [stop]', 0, '>', 's-op'],
  ['if 3 <= 4 [stop]', 0, '<=', 's-op'],
  ['if 3 >= 4 [stop]', 0, '>=', 's-op'],
  ['if 3 <> 4 [stop]', 0, '<>', 's-op'],
  ['print (sum 1 2 3)', 0, '(', 's-paren'],
  ['print (sum 1 2 3)', 0, ')', 's-paren'],
  ['print zzzunknown', 0, 'zzzunknown', ''],
  ['print to', 0, 'to', 's-prim'],
  ['print "to', 0, '"to', 's-str'],
  ['print [end]', 0, 'end', 's-prim'],
  ['show [fd 10]', 0, 'fd', 's-prim'],
  ['show [fd 10]', 0, '10', 's-num'],
  ['show [:x "y]', 0, ':x', 's-var'],
  ['show [:x "y]', 0, '"y', 's-str'],
  ['print |a b c|', 0, '|a b c|', ''],
];

// [code, line, list of [text, class] in order of the brackets on that line]
const BRACKETS = [
  ['repeat 4 [fd 10]', 0, ['s-br s-br0', 's-br s-br0']],
  ['print [a [b]]', 0, ['s-br s-br0', 's-br s-br1', 's-br s-br1', 's-br s-br0']],
  ['print [a [b [c]]]', 0, ['s-br s-br0', 's-br s-br1', 's-br s-br2', 's-br s-br2', 's-br s-br1', 's-br s-br0']],
  ['print [[[[x]]]]', 0, ['s-br s-br0', 's-br s-br1', 's-br s-br2', 's-br s-br3', 's-br s-br3', 's-br s-br2', 's-br s-br1', 's-br s-br0']],
  ['print [[[[[x]]]]]', 0, ['s-br s-br0', 's-br s-br1', 's-br s-br2', 's-br s-br3', 's-br s-br0', 's-br s-br0', 's-br s-br3', 's-br s-br2', 's-br s-br1', 's-br s-br0']],
  ['print [a] [b]', 0, ['s-br s-br0', 's-br s-br0', 's-br s-br0', 's-br s-br0']],
  ['show {1 2 3}', 0, ['s-br s-br0', 's-br s-br0']],
  ['show {[a]}', 0, ['s-br s-br0', 's-br s-br1', 's-br s-br1', 's-br s-br0']],
  ['repeat 4 [\n  fd 10\n]', 0, ['s-br s-br0']],
  ['repeat 4 [\n  fd 10\n]', 2, ['s-br s-br0']],
  ['repeat 4 [\n  rt [x]\n]', 1, ['s-br s-br1', 's-br s-br1']],
  ['print [a [\nb [c]\n]]', 1, ['s-br s-br2', 's-br s-br2']],
  ['print [a [\nb [c]\n]]', 2, ['s-br s-br1', 's-br s-br0']],
  ['print [\n[\n[\n[x]\n]\n]\n]', 3, ['s-br s-br3', 's-br s-br3']],
  ['print [\n[\n[\n[x]\n]\n]\n]', 6, ['s-br s-br0']],
  ['; [ in a comment\nprint [x]', 1, ['s-br s-br0', 's-br s-br0']],
  ['print [x ; ] inside\n[y]\n]', 1, ['s-br s-br1', 's-br s-br1']],
  ['print ]]\nprint [x]', 1, ['s-br s-br0', 's-br s-br0']],
  ['print "a\\[b [c]', 0, ['s-br s-br0', 's-br s-br0']],
  ['print |[| [c]', 0, ['s-br s-br0', 's-br s-br0']],
];

export default function (t) {
  // ---- colouring of single words ------------------------------------------------------------------
  for (const [code, line, word, cls] of WORDS) {
    t.test(`colour: ${JSON.stringify(word)} in ${JSON.stringify(code)} is ${cls || 'plain'}`, async (p) => {
      await show(p, code);
      const s = await spans(p, line);
      const hit = s.find((x) => x[1] === word);
      p.assert.ok(hit, `no token ${word} in ${JSON.stringify(s)}`);
      p.assert.equal(hit[0], cls);
    });
  }

  // ---- brackets by depth ------------------------------------------------------------------------------
  for (const [code, line, want] of BRACKETS) {
    t.test(`brackets: line ${line + 1} of ${JSON.stringify(code)}`, async (p) => {
      await show(p, code);
      const s = (await spans(p, line)).filter((x) => /s-br/.test(x[0]));
      p.assert.deepEqual(s.map((x) => x[0]), want);
    });
  }

  // ---- comments ------------------------------------------------------------------------------------------
  t.test('a whole-line comment is one s-com span', async (p) => {
    await show(p, '; draw a square');
    p.assert.deepEqual(await spans(p, 0), [['s-com', '; draw a square']]);
  });
  t.test('a comment after code keeps the code coloured', async (p) => {
    await show(p, 'fd 10 ; forward a bit');
    const s = await spans(p, 0);
    p.assert.deepEqual(s[0], ['s-prim', 'fd']);
    p.assert.deepEqual(s[s.length - 1], ['s-com', '; forward a bit']);
  });
  t.test('words inside a comment are not coloured as code', async (p) => {
    await show(p, '; fd 10 [ ] :x "y to end');
    p.assert.equal((await spans(p, 0)).length, 1);
  });
  t.test('a semicolon inside a quoted word with a bar does not start a comment', async (p) => {
    await show(p, 'print "|a;b| fd 1');
    const s = await spans(p, 0);
    p.assert.equal(s.filter((x) => x[0] === 's-com').length, 0);
    p.assert.ok(s.some((x) => x[0] === 's-prim' && x[1] === 'fd'));
  });
  t.test('the comment colour is applied to the text after a semicolon only', async (p) => {
    await show(p, 'print 1;two');
    p.assert.equal(await classOf(p, 0, ';two'), 's-com');
    p.assert.equal(await classOf(p, 0, '1'), 's-num');
  });

  // ---- keywords, procedures and infix inside words ----------------------------------------------------
  t.test('TO is only a keyword at the start of a line', async (p) => {
    await show(p, 'print "x to');
    p.assert.notEqual(await classOf(p, 0, 'to'), 's-kw');
  });
  t.test('END inside a list is not a keyword', async (p) => {
    await show(p, 'run [\nend\n]');
    p.assert.notEqual(await classOf(p, 1, 'end'), 's-kw');
  });
  t.test(':x+1 splits into variable, operator and number', async (p) => {
    await show(p, 'print :x+1');
    const s = await spans(p, 0);
    p.assert.deepEqual(s.slice(1), [['s-var', ':x'], ['s-op', '+'], ['s-num', '1']]);
  });
  t.test('3*:n splits into number, operator and variable', async (p) => {
    await show(p, 'print 3*:n');
    p.assert.deepEqual((await spans(p, 0)).slice(1), [['s-num', '3'], ['s-op', '*'], ['s-var', ':n']]);
  });
  t.test('the @ origin after an array is coloured as a number', async (p) => {
    await show(p, 'show {a b}@0');
    p.assert.equal(await classOf(p, 0, '@0'), 's-num');
  });
  t.test('a user procedure is plain until the program runs, then s-proc', async (p) => {
    await p.ev('LG.app.settings.freshRun = true');
    await show(p, 'to zigzag\nfd 10\nend\nzigzag\n');
    p.assert.equal(await classOf(p, 3, 'zigzag'), '');
    await p.key('F5');
    await p.waitState('idle');
    await rendered(p);
    p.assert.equal(await classOf(p, 3, 'zigzag'), 's-proc');
    p.assert.equal(await classOf(p, 0, 'zigzag'), 's-proc');
  });
  t.test('a user procedure inside a list is coloured s-proc too', async (p) => {
    await show(p, 'to hop\nfd 5\nend\nrepeat 2 [hop]\n');
    await p.key('F5');
    await p.waitState('idle');
    await rendered(p);
    p.assert.equal(await classOf(p, 3, 'hop'), 's-proc');
  });
  t.test('a procedure defined at the command center is coloured in the editor', async (p) => {
    await show(p, 'wiggle 3');
    p.assert.equal(await classOf(p, 0, 'wiggle'), '');
    await p.command('define "wiggle [[n] [print :n]]');
    await rendered(p);
    p.assert.equal(await classOf(p, 0, 'wiggle'), 's-proc');
  });
  t.test('an erased procedure goes back to plain after the next run', async (p) => {
    await show(p, 'to blip\nend\nblip\n');
    await p.key('F5');
    await p.waitState('idle');
    await rendered(p);
    p.assert.equal(await classOf(p, 2, 'blip'), 's-proc');
    await p.setCode('print "x\nblip\n');
    await p.key('F5');
    await p.waitState(['idle', 'error']);
    await rendered(p);
    p.assert.equal(await classOf(p, 1, 'blip'), '');
  });
  t.test('primitive names are matched without regard to case', async (p) => {
    await show(p, 'Fd 10 PrInT 3 RePeAt 1 [ ]');
    const s = await spans(p, 0);
    p.assert.deepEqual(s.filter((x) => x[0] === 's-prim').map((x) => x[1]), ['Fd', 'PrInT', 'RePeAt']);
  });
  t.test('angle brackets are shown as text, not HTML', async (p) => {
    await show(p, 'print "<b>bold</b>');
    p.assert.equal(await p.ev('LG.app.active.editor.hl.querySelector("b")'), null);
    p.assert.equal(await classOf(p, 0, '"<b>bold</b>'), 's-str');
  });
  t.test('an ampersand is shown as text', async (p) => {
    await show(p, 'print "a&b>c');
    p.assert.equal(await classOf(p, 0, '"a&b>c'), 's-str');
  });
  t.test('tabs inside a line keep the words apart', async (p) => {
    await show(p, 'fd\t10');
    p.assert.deepEqual(await spans(p, 0), [['s-prim', 'fd'], ['s-num', '10']]);
  });
  t.test('every line of the text has one highlighted line', async (p) => {
    await show(p, 'a\nb\n\nc\n');
    p.assert.equal(await p.ev('LG.app.active.editor.hl.children.length'), 5);
  });
  t.test('the highlighted text matches the textarea text exactly', async (p) => {
    const code = 'to tri :s\n  repeat 3 [fd :s rt 120] ; three\nend\n\nprint (sum 1 2) [a [b]] "x :y\n';
    await show(p, code);
    p.assert.equal(await p.ev("[...LG.app.active.editor.hl.children].map((l) => l.textContent === ' ' ? '' : l.textContent).join('\\n')"), code);
  });
  t.test('the colours change when a theme changes but the classes stay', async (p) => {
    await show(p, 'fd 10');
    const before = await p.ev("getComputedStyle(LG.app.active.editor.hl.querySelector('.s-prim')).color");
    await p.ev("LG.app.setTheme('chalk')");
    await rendered(p);
    const after = await p.ev("getComputedStyle(LG.app.active.editor.hl.querySelector('.s-prim')).color");
    await p.ev("LG.app.setTheme('auto')");
    p.assert.notEqual(before, after);
    p.assert.equal(await classOf(p, 0, 'fd'), 's-prim');
  });
  t.test('bracket depth colours are four different colours', async (p) => {
    await show(p, 'print [[[[x]]]]');
    const cols = await p.ev("[0,1,2,3].map((i) => getComputedStyle(LG.app.active.editor.hl.querySelector('.s-br' + i)).color)");
    p.assert.equal(new Set(cols).size, 4);
  });

  // ---- typing --------------------------------------------------------------------------------------------
  t.test('typed text appears in the editor and is coloured as you type', async (p) => {
    await p.newFile(FILE, '');
    await clickAt(p, 0, 0);
    await p.type('fd 50');
    p.assert.equal(await p.code(), 'fd 50');
    await rendered(p);
    p.assert.deepEqual(await spans(p, 0), [['s-prim', 'fd'], ['s-num', '50']]);
  });
  t.test('typing marks the tab as changed with a dot', async (p) => {
    await p.newFile(FILE, 'x');
    p.assert.equal((await tabs(p)).find((x) => x.active).dirty, false);
    await clickAt(p, 0, 0);
    await p.key('End');
    await p.type('y');
    p.assert.equal((await tabs(p)).find((x) => x.active).dirty, true);
  });
  t.test('typing back to the saved text clears the dot', async (p) => {
    await p.newFile(FILE, 'x');
    await clickAt(p, 0, 0);
    await p.key('End');
    await p.type('y');
    await p.key('Backspace');
    p.assert.equal((await tabs(p)).find((x) => x.active).dirty, false);
  });
  t.test('Enter splits a line at the caret', async (p) => {
    await p.newFile(FILE, 'fd 10 rt 90');
    await clickAt(p, 0, 6);
    await p.key('ArrowLeft');
    await p.key('Enter');
    const lines = (await p.code()).split('\n');
    p.assert.equal(lines.length, 2);
    p.assert.equal(lines[0], 'fd 10');
    p.assert.equal(lines[1].trim(), 'rt 90');
  });
  t.test('Backspace at the start of a line joins it to the line above', async (p) => {
    await p.newFile(FILE, 'fd 10\nrt 90');
    await clickAt(p, 1, 0);
    await p.key('Home');
    await p.key('Home');
    await p.key('Backspace');
    p.assert.equal(await p.code(), 'fd 10rt 90');
  });
  t.test('Delete removes the character after the caret', async (p) => {
    await p.newFile(FILE, 'fdd 10');
    await clickAt(p, 0, 0);
    await p.key('Home');
    await p.key('Delete');
    p.assert.equal(await p.code(), 'dd 10');
  });
  t.test('clicking in the text puts the caret on that line and column', async (p) => {
    await p.newFile(FILE, 'first line\nsecond line\nthird line');
    await clickAt(p, 1, 3);
    const c = await cursor(p);
    p.assert.equal(c.line, 1);
    p.assert.ok(c.col === 3 || c.col === 4, 'col ' + c.col);
  });
  t.test('clicking far right of a short line puts the caret at its end', async (p) => {
    await p.newFile(FILE, 'ab\ncd');
    await clickAt(p, 0, 40);
    p.assert.deepEqual(await cursor(p), { line: 0, col: 2 });
  });
  t.test('the current line is shaded while the editor has focus', async (p) => {
    await p.newFile(FILE, 'one\ntwo\nthree');
    await clickAt(p, 2, 1);
    await rendered(p);
    p.assert.equal(await p.ev("[...LG.app.active.editor.hl.children].findIndex((l) => l.classList.contains('curline'))"), 2);
  });
  t.test('the current line shading follows the arrow keys', async (p) => {
    await p.newFile(FILE, 'one\ntwo\nthree');
    await clickAt(p, 2, 1);
    await p.key('ArrowUp');
    await rendered(p);
    p.assert.equal(await p.ev("[...LG.app.active.editor.hl.children].findIndex((l) => l.classList.contains('curline'))"), 1);
  });
  t.test('no line is shaded when the editor loses focus', async (p) => {
    await p.newFile(FILE, 'one\ntwo');
    await clickAt(p, 1, 1);
    await p.click('#cmdInput');
    await p.ev('LG.app.active.editor.render()');
    p.assert.equal(await p.count('#editors .ed-line.curline'), 0);
  });
  t.test('pasting text (insertText) works and colours it', async (p) => {
    await p.newFile(FILE, '');
    await clickAt(p, 0, 0);
    await p.insertText('repeat 3 [print "hi]');
    await rendered(p);
    p.assert.equal(await p.code(), 'repeat 3 [print "hi]');
    p.assert.equal(await classOf(p, 0, '"hi'), 's-str');
  });
  t.test('typing a closing bracket recolours the following lines', async (p) => {
    await p.newFile(FILE, 'print [a\nprint [b]');
    await rendered(p);
    p.assert.deepEqual((await spans(p, 1)).filter((x) => /s-br/.test(x[0])).map((x) => x[0]), ['s-br s-br1', 's-br s-br1']);
    await clickAt(p, 0, 20);
    await p.type(']');
    await rendered(p);
    p.assert.deepEqual((await spans(p, 1)).filter((x) => /s-br/.test(x[0])).map((x) => x[0]), ['s-br s-br0', 's-br s-br0']);
  });
  t.test('the scroll position of the colours follows the textarea', async (p) => {
    await p.newFile(FILE, Array.from({ length: 200 }, (_, i) => 'print ' + i).join('\n'));
    await p.ev('LG.app.active.editor.ta.scrollTop = 1500; LG.app.active.editor.ta.dispatchEvent(new Event("scroll"))');
    await p.sleep(50);
    const [a, b] = await p.ev('[LG.app.active.editor.ta.scrollTop, LG.app.active.editor.hl.scrollTop]');
    p.assert.ok(a > 1000);
    p.assert.equal(a, b);
  });
  t.test('the mouse wheel scrolls text, colours and line numbers together', async (p) => {
    await p.newFile(FILE, Array.from({ length: 200 }, (_, i) => 'print ' + i).join('\n'));
    const r = await p.rect('#editors .ed-ta');
    await p.b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: r.x + 100, y: r.y + 100, deltaX: 0, deltaY: 600 });
    await p.sleep(250);
    const st = await p.ev('LG.app.active.editor.ta.scrollTop');
    p.assert.ok(st > 100, 'scrolled ' + st);
    p.assert.equal(await p.ev('LG.app.active.editor.hl.scrollTop'), st);
    p.assert.equal(await p.ev('LG.app.active.editor.inner.style.transform'), `translateY(${-st}px)`);
  });
}
