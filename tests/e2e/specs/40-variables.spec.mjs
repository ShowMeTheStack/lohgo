// The Variables panel: inputs, locals, loop variables, globals and property lists, the filter,
// changing values in place, unfolding lists and arrays, paging and change highlights.
import { PATH, reset, load, gutterClick, untilPaused, f5, stackRows, varRows, varRow, varSections, cellSel, twistySel, editCell, stepKey, seen } from './40-dbg-lib.mjs';

// 1 to show :a :b / 2 localmake "c :a + :b / 3 print :c / 4 end / 5 make "g 5 / 6 show 1 2
const SHOW = 'to show2 :a :b\n  localmake "c :a + :b\n  print :c\nend\nmake "g 5\nshow2 1 2\n';
const EDIT = 'to e :x\n  show :x\nend\ne 1\n';

async function pauseAt(p, src, line) {
  await load(p, src);
  await gutterClick(p, line);
  await f5(p);
  await untilPaused(p);
  await p.click('#itab-vars');
}
const fk = (name) => `frame1/${name}`;

export default function (t) {
  t.beforeEach(reset);

  // ---- what is listed --------------------------------------------------------------------------------
  t.test('inputs and locals of the paused procedure are listed', async (p) => {
    await pauseAt(p, SHOW, 2);
    const rows = (await varRows(p)).filter((r) => r.key.startsWith('frame'));
    p.assert.deepEqual(rows.map((r) => [r.name, r.value]), [['a', '1'], ['b', '2'], ['c', '3']]);
  });
  t.test('inputs carry an "input" badge and locals do not', async (p) => {
    await pauseAt(p, SHOW, 2);
    p.assert.equal((await varRow(p, 'a', 'frame')).input, true);
    p.assert.equal((await varRow(p, 'b', 'frame')).input, true);
    p.assert.equal((await varRow(p, 'c', 'frame')).input, false);
  });
  t.test('the section heading names the procedure and counts its variables', async (p) => {
    await pauseAt(p, SHOW, 2);
    const secs = await p.ev("[...document.querySelectorAll('#ipane-vars .vsec')].map(e => e.textContent)");
    p.assert.equal(secs[0], 'Inputs and locals of show2 (3)');
    p.assert.equal(secs[1], 'Global variables (1)');
  });
  t.test('the frame label names the call and the line', async (p) => {
    await pauseAt(p, SHOW, 2);
    p.assert.match(await p.text('#ipane-vars .insp-tools span'), /In show2 1 2\s+· line 3/);
  });
  t.test('a procedure with no variables says so', async (p) => {
    await pauseAt(p, 'to plain\n  print 1\nend\nplain\n', 1);
    p.assert.match(await p.paneText('vars'), /no inputs or local variables/);
  });
  t.test('a LOCAL without a value is shown as having none', async (p) => {
    await pauseAt(p, 'to lo\n  local "z\n  print 1\nend\nlo\n', 2);
    const r = await varRow(p, 'z', 'frame');
    p.assert.equal(r.value, '(no value)');
  });
  t.test('optional and rest inputs get the input badge too', async (p) => {
    await pauseAt(p, 'to opt :a [:b 7] [:r]\n  print :a\nend\n(opt 1)\n', 1);
    const rows = (await varRows(p)).filter((r) => r.key.startsWith('frame'));
    p.assert.deepEqual(rows.map((r) => [r.name, r.value, r.input]), [['a', '1', true], ['b', '7', true], ['r', '[]', true]]);
  });
  t.test('a FOR variable at the top level is listed as a loop variable', async (p) => {
    await pauseAt(p, 'for [i 1 3] [\n  print :i\n]\n', 1);
    p.assert.match(await p.paneText('vars'), /Loop variables/i);
    const r = await varRow(p, 'i', 'frame');
    p.assert.equal(r.loop, true);
    p.assert.equal(r.value, '1');
  });
  t.test('a FOR variable inside a procedure has the loop badge next to the inputs', async (p) => {
    await pauseAt(p, 'to cnt :n\n  for [k 1 :n] [\n    print :k\n  ]\nend\ncnt 2\n', 2);
    const n = await varRow(p, 'n', 'frame');
    const k = await varRow(p, 'k', 'frame');
    p.assert.equal(n.input, true);
    p.assert.equal(n.loop, false);
    p.assert.equal(k.loop, true);
    p.assert.equal(k.input, false);
  });
  t.test('a template variable is shown while its template runs', async (p) => {
    await pauseAt(p, 'to tpl\n  foreach [5 6] [[v]\n    print :v\n  ]\nend\ntpl\n', 2);
    const v = await varRow(p, 'v', 'frame');
    p.assert.equal(v.value, '5');
    p.assert.equal(v.loop, true);
  });
  t.test('global variables are listed in name order', async (p) => {
    await pauseAt(p, 'make "zeta 1\nmake "alpha 2\nmake "mid 3\nprint 1\n', 3);
    const g = (await varRows(p)).filter((r) => r.key.startsWith('g/')).map((r) => r.name);
    p.assert.deepEqual(g, ['alpha', 'mid', 'zeta']);
  });
  for (const [src, type, value] of [
    ['42', 'number', '42'], ['-3.5', 'number', '-3.5'], ['"hello', 'word', '"hello'], ['"true', 'true/false', '"true'],
    ['[1 2 3]', 'list [3]', '[1 2 3]'], ['[]', 'list [0]', '[]'], ['[a [b c]]', 'list [2]', '[a [b c]]'], ['{4 5}', 'array {2}', '{4 5}'],
    ['(listtoarray [])', 'array {0}', '{}'],
  ]) {
    t.test(`a global holding ${src} shows type "${type}"`, async (p) => {
      await pauseAt(p, `make "v ${src}\nprint 1\n`, 1);
      const r = await varRow(p, 'v', 'g');
      p.assert.equal(r.type, type);
      p.assert.equal(r.value, value);
    });
  }
  t.test('a very long value is shortened with an ellipsis', async (p) => {
    await pauseAt(p, 'make "long iseq 1 400\nprint 1\n', 1);
    const r = await varRow(p, 'long', 'g');
    p.assert.ok(r.value.length <= 121);
    p.assert.match(r.value, /…|\.\.\./);
  });
  t.test('with no globals the panel says how to make one', async (p) => {
    await pauseAt(p, 'print 1\n', 0);
    p.assert.match(await p.paneText('vars'), /none yet \(MAKE "name value creates one\)/);
  });
  t.test('buried variables are hidden', async (p) => {
    await pauseAt(p, 'make "hid 1\nmake "shown 2\nbury [[] [hid]]\nprint 1\n', 3);
    p.assert.equal(await varRow(p, 'hid', 'g'), null);
    p.assert.ok(await varRow(p, 'shown', 'g'));
  });
  t.test('property lists are listed and unfold to their properties', async (p) => {
    await pauseAt(p, 'pprop "dog "legs 4\npprop "dog "sound "woof\nprint 1\n', 2);
    p.assert.match(await p.paneText('vars'), /Property lists/i);
    const dog = await varRow(p, 'dog', 'p');
    p.assert.equal(dog.value, '2 properties');
    p.assert.equal(dog.type, 'plist');
    await p.click(twistySel('p/dog'));
    p.assert.equal((await varRow(p, 'legs', 'p/dog')).value, '4');
    p.assert.equal((await varRow(p, 'sound', 'p/dog')).value, '"woof');
  });
  t.test('a property value can be changed', async (p) => {
    await pauseAt(p, 'pprop "cat "lives 9\nprint gprop "cat "lives\n', 1);
    await p.click(twistySel('p/cat'));
    await editCell(p, cellSel('p/cat/lives'), '8');
    await p.key('F5');
    await p.waitState('idle');
    await p.waitOutput(/^8$/m);
  });
  t.test('nothing is listed in a frame while the program runs', async (p) => {
    await load(p, 'make "w 1\nforever [make "w :w + 1]\n');
    await f5(p);
    await p.sleep(100);
    await p.click('#itab-vars');
    p.assert.match(await p.text('#ipane-vars .insp-tools span'), /Running\. Pause to look inside/);
    p.assert.ok(!/Inputs and locals/i.test(await p.paneText('vars')));
    await p.stopProgram();
  });
  t.test('when idle the label reads Workspace', async (p) => {
    await load(p, 'make "w 1\n');
    await f5(p);
    await p.waitState('idle');
    await p.click('#itab-vars');
    p.assert.equal(await p.text('#ipane-vars .insp-tools span'), 'Workspace');
    p.assert.equal((await varRow(p, 'w', 'g')).value, '1');
  });

  // ---- filter ---------------------------------------------------------------------------------------------
  t.test('the filter box keeps only matching names in every section', async (p) => {
    await pauseAt(p, 'make "apple 1\nmake "banana 2\nto f :appetite :x\n  print 1\nend\nf 1 2\n', 3);
    await p.click('#ipane-vars input[aria-label="Filter variables"]');
    await p.type('app');
    const names = (await varRows(p)).map((r) => r.name);
    p.assert.deepEqual(names, ['appetite', 'apple']);
  });
  t.test('the filter ignores case', async (p) => {
    await pauseAt(p, 'make "Apple 1\nmake "pear 2\nprint 1\n', 2);
    await p.click('#ipane-vars input[aria-label="Filter variables"]');
    await p.type('APP');
    p.assert.deepEqual((await varRows(p)).map((r) => r.name), ['apple']);
  });
  t.test('a filter with no matches leaves empty sections that say none', async (p) => {
    await pauseAt(p, 'make "apple 1\nprint 1\n', 1);
    await p.click('#ipane-vars input[aria-label="Filter variables"]');
    await p.type('zzz');
    p.assert.equal((await varRows(p)).length, 0);
    p.assert.match(await p.paneText('vars'), /Global variables \(0\)/i);
  });
  t.test('clearing the filter shows everything again', async (p) => {
    await pauseAt(p, 'make "apple 1\nmake "banana 2\nprint 1\n', 2);
    await p.click('#ipane-vars input[aria-label="Filter variables"]');
    await p.type('ban');
    p.assert.equal((await varRows(p)).length, 1);
    for (let i = 0; i < 3; i++) await p.key('Backspace');
    p.assert.equal((await varRows(p)).length, 2);
  });
  t.test('typing in the filter does not run the program on with F-keys or move focus', async (p) => {
    await pauseAt(p, 'make "apple 1\nprint 1\n', 1);
    await p.click('#ipane-vars input[aria-label="Filter variables"]');
    await p.type('a p');
    p.assert.equal(await p.state(), 'paused');
    p.assert.equal(await p.ev('document.activeElement.getAttribute("aria-label")'), 'Filter variables');
  });

  // ---- editing values ---------------------------------------------------------------------------------------
  for (const [typed, shown, type] of [
    ['10', '10', 'number'], ['-2.5', '-2.5', 'number'], ['"hi', 'hi', 'word'], ['hello', 'hello', 'word'],
    ['[a [b c]]', '[a [b c]]', 'list [2]'], ['a b c', '[a b c]', 'list [3]'], ['{1 2 3}', '{1 2 3}', 'array {3}'], ['[]', '[]', 'list [0]'],
  ]) {
    t.test(`typing ${typed} as a new value and pressing Enter changes the input`, async (p) => {
      await pauseAt(p, EDIT, 1);
      await editCell(p, cellSel(fk('x')), typed);
      const r = await varRow(p, 'x', 'frame');
      p.assert.equal(r.type, type);
      await p.key('F5');
      await p.waitState('idle');
      p.assert.match(await p.output(), new RegExp('^' + shown.replace(/[[\]{}.]/g, '\\$&') + '$', 'm'));
    });
  }
  t.test('a successful change shows a toast', async (p) => {
    await pauseAt(p, EDIT, 1);
    await editCell(p, cellSel(fk('x')), '5');
    await p.waitToast(/Changed x/);
  });
  t.test('clicking a value opens an editor holding its current text, all selected', async (p) => {
    await pauseAt(p, 'to e :x\n  show :x\nend\ne [1 2]\n', 1);
    await p.click(cellSel(fk('x')));
    const st = await p.ev(`(() => { const i = document.querySelector(${JSON.stringify(cellSel(fk('x')) + ' input')}); return { v: i.value, s: i.selectionStart, e: i.selectionEnd, f: document.activeElement === i }; })()`);
    p.assert.deepEqual(st, { v: '[1 2]', s: 0, e: 5, f: true });
    await p.key('Escape');
  });
  t.test('Escape cancels the edit and keeps the old value', async (p) => {
    await pauseAt(p, EDIT, 1);
    await editCell(p, cellSel(fk('x')), '99', 'Escape');
    p.assert.equal((await varRow(p, 'x', 'frame')).value, '1');
    await p.key('F5');
    await p.waitState('idle');
    p.assert.match(await p.output(), /^1$/m);
  });
  t.test('Escape in the value editor does not stop the program', async (p) => {
    await pauseAt(p, EDIT, 1);
    await editCell(p, cellSel(fk('x')), '99', 'Escape');
    p.assert.equal(await p.state(), 'paused');
  });
  t.test('clicking away commits the edit', async (p) => {
    await pauseAt(p, EDIT, 1);
    await p.click(cellSel(fk('x')));
    await p.ev(`document.querySelector(${JSON.stringify(cellSel(fk('x')) + ' input')}).select()`);
    await p.insertText('77');
    await p.click('#ipane-vars .vsec');
    await p.sleep(80);
    p.assert.equal((await varRow(p, 'x', 'frame')).value, '77');
  });
  t.test('Enter on a focused value starts editing it', async (p) => {
    await pauseAt(p, EDIT, 1);
    await p.ev(`document.querySelector(${JSON.stringify(cellSel(fk('x')))}).focus()`);
    await p.key('Enter');
    p.assert.ok(await p.exists(cellSel(fk('x')) + ' input'));
    await p.key('Escape');
  });
  t.test('keys typed in the value editor do not reach the debugger shortcuts', async (p) => {
    await pauseAt(p, EDIT, 1);
    await p.click(cellSel(fk('x')));
    await p.type('abc');
    p.assert.equal(await p.state(), 'paused');
    await p.key('Escape');
  });
  t.test('an unreadable value shows an error and keeps the old value', async (p) => {
    await pauseAt(p, EDIT, 1);
    await editCell(p, cellSel(fk('x')), '1 ]');
    p.assert.equal((await varRow(p, 'x', 'frame')).value, '1');
    await p.waitToast(/Could not change x/);
  });
  t.test('an empty value shows an error and keeps the old value', async (p) => {
    await pauseAt(p, EDIT, 1);
    await editCell(p, cellSel(fk('x')), ' ');
    p.assert.equal((await varRow(p, 'x', 'frame')).value, '1');
    await p.waitToast(/Could not change x.*Type a value/);
  });
  t.test('the same text again changes nothing and shows no toast', async (p) => {
    await pauseAt(p, EDIT, 1);
    await editCell(p, cellSel(fk('x')), '1');
    await p.sleep(100);
    p.assert.ok(!/Changed x/.test(await p.lastToast()));
  });
  t.test('changing a local changes what the procedure does next', async (p) => {
    await pauseAt(p, SHOW, 2);
    await editCell(p, cellSel(fk('c')), '100');
    await p.key('F5');
    await p.waitState('idle');
    p.assert.match(await p.output(), /^100$/m);
  });
  t.test('changing a loop counter changes how many times the loop runs', async (p) => {
    await pauseAt(p, 'make "k 0\nwhile [:k < 10] [\n  make "k :k + 1\n]\nprint :k\n', 2);
    await editCell(p, cellSel('g/k'), '8');
    await p.click('#itab-bps');
    await p.click('#bpClearAll');
    await p.key('F5');
    await p.waitState('idle');
    p.assert.match(await p.output(), /^10$/m);
    p.assert.equal(await p.ev('LG.app.interp.steps') > 0, true);
  });
  t.test('changing an input in an older frame changes that call only', async (p) => {
    await load(p, 'to r :n\n  if :n = 0 [stop]\n  r :n - 1\n  print :n\nend\nr 3\n');
    await gutterClick(p, 1);
    await p.ev(`LG.app.breakpoints.get('${PATH}').get(1).cond = ':n = 1'; LG.app.breakpointsChanged('${PATH}')`);
    await f5(p);
    await untilPaused(p);
    await stackRows(p);
    await p.click('#frame2');
    await p.click('#itab-vars');
    p.assert.equal((await varRow(p, 'n', 'frame')).value, '2');
    await editCell(p, cellSel('frame2/n'), '20');
    p.assert.equal(await seen(p, 'n'), '1', 'the newest frame is untouched');
    await p.click('#itab-bps');
    await p.click('#bpClearAll');
    await p.key('F5');
    await p.waitState('idle');
    p.assert.match(await p.output(), /^1\n20\n3$/m);
  });
  t.test('the edited older frame stays selected after the edit', async (p) => {
    await load(p, 'to r :n\n  if :n = 0 [stop]\n  r :n - 1\nend\nr 2\n');
    await gutterClick(p, 1);
    await p.ev(`LG.app.breakpoints.get('${PATH}').get(1).cond = ':n = 0'; LG.app.breakpointsChanged('${PATH}')`);
    await f5(p);
    await untilPaused(p);
    await stackRows(p);
    await p.click('#frame1');
    await p.click('#itab-vars');
    await editCell(p, cellSel('frame1/n'), '9');
    p.assert.match(await p.text('#ipane-vars .insp-tools span'), /In r 2/);
    p.assert.equal((await varRow(p, 'n', 'frame')).value, '9');
  });
  t.test('a global can be changed while paused', async (p) => {
    await pauseAt(p, 'make "g 1\nprint :g\n', 1);
    await editCell(p, cellSel('g/g'), '"changed');
    await p.key('F5');
    await p.waitState('idle');
    p.assert.match(await p.output(), /^changed$/m);
  });
  t.test('globals can be changed when nothing is running', async (p) => {
    await load(p, 'make "idlev 3\n');
    await f5(p);
    await p.waitState('idle');
    await p.click('#itab-vars');
    p.assert.equal((await varRow(p, 'idlev', 'g')).editable, true);
    await editCell(p, cellSel('g/idlev'), '[x y]');
    await p.command('show :idlev');
    await p.waitOutput(/^\[x y\]$/m);
  });
  t.test('values cannot be changed while the program runs', async (p) => {
    await load(p, 'make "busy 1\nforever [make "busy 1]\n');
    await f5(p);
    await p.sleep(100);
    await p.click('#itab-vars');
    const r = await varRow(p, 'busy', 'g');
    p.assert.equal(r.editable, false);
    await p.click(cellSel('g/busy'));
    p.assert.equal(await p.exists(cellSel('g/busy') + ' input'), false);
    await p.stopProgram();
  });
  t.test('inputs and globals are editable while paused', async (p) => {
    await pauseAt(p, SHOW, 2);
    for (const r of await varRows(p)) p.assert.equal(r.editable, true, r.name);
  });

  // ---- unfolding lists and arrays ------------------------------------------------------------------------------
  t.test('a list unfolds to its items and folds back', async (p) => {
    await pauseAt(p, 'make "l [10 20 30]\nprint 1\n', 1);
    p.assert.equal(await p.attr(twistySel('g/l'), 'aria-expanded'), 'false');
    await p.click(twistySel('g/l'));
    const kids = (await varRows(p)).filter((r) => r.key.startsWith('g/l/'));
    p.assert.deepEqual(kids.map((r) => [r.name, r.value]), [['1', '10'], ['2', '20'], ['3', '30']]);
    p.assert.equal(await p.attr(twistySel('g/l'), 'aria-expanded'), 'true');
    await p.click(twistySel('g/l'));
    p.assert.equal((await varRows(p)).filter((r) => r.key.startsWith('g/l/')).length, 0);
  });
  t.test('double-clicking the name unfolds a list', async (p) => {
    await pauseAt(p, 'make "l [a b]\nprint 1\n', 1);
    await p.dblclick('#ipane-vars .vrow[data-key="g/l"] .vn');
    p.assert.equal((await varRows(p)).filter((r) => r.key.startsWith('g/l/')).length, 2);
  });
  t.test('words and numbers cannot be unfolded', async (p) => {
    await pauseAt(p, 'make "w "abc\nprint 1\n', 1);
    p.assert.equal(await p.attr(twistySel('g/w'), 'aria-expanded'), null);
    p.assert.equal(await p.text(twistySel('g/w')), '');
  });
  t.test('an empty list cannot be unfolded', async (p) => {
    await pauseAt(p, 'make "e []\nprint 1\n', 1);
    p.assert.equal(await p.attr(twistySel('g/e'), 'aria-expanded'), null);
  });
  t.test('a nested list unfolds one level at a time', async (p) => {
    await pauseAt(p, 'make "n [a [b [c d]]]\nprint 1\n', 1);
    await p.click(twistySel('g/n'));
    p.assert.equal((await varRow(p, '2', 'g/n/')).value, '[b [c d]]');
    await p.click(twistySel('g/n/2'));
    p.assert.equal((await varRow(p, '2', 'g/n/2/')).value, '[c d]');
    await p.click(twistySel('g/n/2/2'));
    p.assert.deepEqual((await varRows(p)).filter((r) => r.key.startsWith('g/n/2/2/')).map((r) => r.value), ['"c', '"d']);
  });
  t.test('an array unfolds with its index numbers', async (p) => {
    await pauseAt(p, 'make "arr {x y z}\nprint 1\n', 1);
    await p.click(twistySel('g/arr'));
    p.assert.deepEqual((await varRows(p)).filter((r) => r.key.startsWith('g/arr/')).map((r) => r.name), ['1', '2', '3']);
  });
  t.test('an array with origin 0 numbers its parts from 0', async (p) => {
    await pauseAt(p, 'make "arr {x y}@0\nprint 1\n', 1);
    await p.click(twistySel('g/arr'));
    p.assert.deepEqual((await varRows(p)).filter((r) => r.key.startsWith('g/arr/')).map((r) => r.name), ['0', '1']);
  });
  t.test('unfolded lists stay unfolded after a step', async (p) => {
    await pauseAt(p, 'make "l [1 2]\nprint 1\nprint 2\n', 1);
    await p.click(twistySel('g/l'));
    await stepKey(p, 'F11');
    p.assert.equal((await varRows(p)).filter((r) => r.key.startsWith('g/l/')).length, 2);
  });
  t.test('an item inside a list can be changed', async (p) => {
    await pauseAt(p, 'make "l [1 2 3]\nshow :l\n', 1);
    await p.click(twistySel('g/l'));
    await editCell(p, cellSel('g/l/2'), '"two');
    p.assert.equal((await varRow(p, 'l', 'g')).value, '[1 two 3]');
    await p.key('F5');
    await p.waitState('idle');
    p.assert.match(await p.output(), /^\[1 two 3\]$/m);
  });
  t.test('changing an item does not change another variable that shares the list', async (p) => {
    await pauseAt(p, 'make "orig [1 2 3]\nmake "copy :orig\nshow :orig\nshow :copy\n', 2);
    await p.click(twistySel('g/copy'));
    await editCell(p, cellSel('g/copy/1'), '9');
    await p.key('F5');
    await p.waitState('idle');
    p.assert.match(await p.output(), /^\[1 2 3\]\n\[9 2 3\]$/m);
  });
  t.test('an item inside a nested list can be changed', async (p) => {
    await pauseAt(p, 'make "n [a [b c]]\nshow :n\n', 1);
    await p.click(twistySel('g/n'));
    await p.click(twistySel('g/n/2'));
    await editCell(p, cellSel('g/n/2/1'), '[x]');
    await p.key('F5');
    await p.waitState('idle');
    p.assert.match(await p.output(), /^\[a \[\[x\] c\]\]$/m);
  });
  t.test('an array element can be changed and the program sees it', async (p) => {
    await pauseAt(p, 'make "arr {1 2 3}\nshow item 2 :arr\n', 1);
    await p.click(twistySel('g/arr'));
    await editCell(p, cellSel('g/arr/2'), '42');
    p.assert.equal((await varRow(p, 'arr', 'g')).value, '{1 42 3}');
    await p.key('F5');
    await p.waitState('idle');
    p.assert.match(await p.output(), /^42$/m);
  });
  t.test('an item of a list input in a procedure can be changed', async (p) => {
    await pauseAt(p, 'to sumup :l\n  print apply "sum :l\nend\nsumup [1 2 3]\n', 1);
    await p.click(twistySel(fk('l')));
    await editCell(p, cellSel(fk('l') + '/3'), '30');
    await p.key('F5');
    await p.waitState('idle');
    p.assert.match(await p.output(), /^33$/m);
  });

  // ---- paging ------------------------------------------------------------------------------------------------
  t.test('a list of 250 items shows the first 100 with a pager', async (p) => {
    await pauseAt(p, 'make "big iseq 1 250\nprint 1\n', 1);
    await p.click(twistySel('g/big'));
    const kids = (await varRows(p)).filter((r) => r.key.startsWith('g/big/'));
    p.assert.equal(kids.length, 100);
    p.assert.equal(kids[0].value, '1');
    p.assert.equal(kids[99].value, '100');
    p.assert.match(await p.text('#ipane-vars .vrow.pager'), /1–100 of 250/);
    p.assert.equal(await p.ev("[...document.querySelectorAll('#ipane-vars .vrow.pager button')][0].disabled"), true);
  });
  t.test('later shows the next page and earlier goes back', async (p) => {
    await pauseAt(p, 'make "big iseq 1 250\nprint 1\n', 1);
    await p.click(twistySel('g/big'));
    await p.click('#ipane-vars .vrow.pager button', 'later');
    p.assert.match(await p.text('#ipane-vars .vrow.pager'), /101–200 of 250/);
    p.assert.equal((await varRows(p)).filter((r) => r.key.startsWith('g/big/'))[0].name, '101');
    await p.click('#ipane-vars .vrow.pager button', 'later');
    p.assert.match(await p.text('#ipane-vars .vrow.pager'), /201–250 of 250/);
    const last = (await varRows(p)).filter((r) => r.key.startsWith('g/big/'));
    p.assert.equal(last.length, 50);
    p.assert.equal(last[49].value, '250');
    p.assert.equal(await p.ev("[...document.querySelectorAll('#ipane-vars .vrow.pager button')][1].disabled"), true);
    await p.click('#ipane-vars .vrow.pager button', 'earlier');
    p.assert.match(await p.text('#ipane-vars .vrow.pager'), /101–200 of 250/);
  });
  t.test('a list of exactly 100 items has no pager', async (p) => {
    await pauseAt(p, 'make "hund iseq 1 100\nprint 1\n', 1);
    await p.click(twistySel('g/hund'));
    p.assert.equal(await p.count('#ipane-vars .vrow.pager'), 0);
    p.assert.equal((await varRows(p)).filter((r) => r.key.startsWith('g/hund/')).length, 100);
  });
  t.test('a big array pages too', async (p) => {
    await pauseAt(p, 'make "ba listtoarray iseq 1 150\nprint 1\n', 1);
    await p.click(twistySel('g/ba'));
    p.assert.match(await p.text('#ipane-vars .vrow.pager'), /1–100 of 150/);
  });
  t.test('an item on the second page can be changed', async (p) => {
    await pauseAt(p, 'make "big iseq 1 150\nprint item 120 :big\n', 1);
    await p.click(twistySel('g/big'));
    await p.click('#ipane-vars .vrow.pager button', 'later');
    await editCell(p, cellSel('g/big/120'), '"x');
    await p.key('F5');
    await p.waitState('idle');
    p.assert.match(await p.output(), /^x$/m);
  });

  // ---- changes after a step -------------------------------------------------------------------------------------
  t.test('a value that changed in the last step is highlighted', async (p) => {
    await pauseAt(p, 'make "a 1\nmake "b 1\nmake "a 2\nprint :a\n', 2);
    p.assert.equal((await varRow(p, 'a', 'g')).changed, false);
    await stepKey(p, 'F11');
    await p.click('#itab-vars');
    p.assert.equal((await varRow(p, 'a', 'g')).changed, true);
    p.assert.equal((await varRow(p, 'b', 'g')).changed, false);
  });
  t.test('the highlight goes away on the next step that does not change it', async (p) => {
    await pauseAt(p, 'make "a 1\nmake "a 2\nprint 1\nprint 2\n', 1);
    await stepKey(p, 'F11');
    p.assert.equal((await varRow(p, 'a', 'g')).changed, true);
    await stepKey(p, 'F11');
    p.assert.equal((await varRow(p, 'a', 'g')).changed, false);
  });
  t.test('a loop variable is highlighted as it counts', async (p) => {
    await pauseAt(p, 'for [i 1 3] [\n  print :i\n]\n', 1);
    await p.key('F5');
    await untilPaused(p);
    await p.click('#itab-vars');
    const r = await varRow(p, 'i', 'frame');
    p.assert.equal(r.value, '2');
    p.assert.equal(r.changed, true);
  });
  t.test('a changed value is drawn in a different colour', async (p) => {
    await pauseAt(p, 'make "a 1\nmake "a 2\nprint 1\n', 1);
    await stepKey(p, 'F11');
    const c = await p.ev("(() => { const ch = document.querySelector('#ipane-vars .vv.changed'); const n = [...document.querySelectorAll('#ipane-vars .vv')].find(e => !e.classList.contains('changed')); return [getComputedStyle(ch).color, getComputedStyle(ch).fontWeight, n ? getComputedStyle(n).color : '']; })()");
    p.assert.notEqual(c[0], c[2]);
    p.assert.equal(c[1], '700');
  });
  t.test('the Variables panel shows the new values at each pause', async (p) => {
    await pauseAt(p, 'to c :n\n  if :n = 0 [stop]\n  print :n\n  c :n - 1\nend\nc 3\n', 2);
    const vals = [];
    for (let i = 0; i < 3; i++) {
      vals.push((await varRow(p, 'n', 'frame')).value);
      await p.key('F5');
      await p.waitState(['paused', 'idle']);
      await p.sleep(40);
    }
    p.assert.deepEqual(vals, ['3', '2', '1']);
  });
  t.test('showing buried names is a setting', async (p) => {
    await p.ev("LG.app.settings.showBuried = true");
    try {
      await pauseAt(p, 'make "hid 1\nbury [[] [hid]]\nprint 1\n', 2);
      p.assert.ok(await varRow(p, 'hid', 'g'));
    } finally {
      await p.ev('LG.app.settings.showBuried = false');
    }
  });
}
