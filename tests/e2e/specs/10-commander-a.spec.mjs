// The command center, part one: typing, Enter and Shift+Enter, the echo, what PRINT/TYPE/SHOW
// write, values, errors with their hints and locations, history, Tab completion, clearing.
import { transcript, resetPrompt } from './10-lang-lib.mjs';

const inputValue = (p) => p.ev("document.getElementById('cmdInput').value");
async function typeAtPrompt(p, text) {
  await p.click('#cmdInput');
  await p.type(text);
}
async function enter(p) {
  await p.key('Enter');
  await p.waitState(['idle', 'error', 'paused', 'input']);
  await p.sleep(40);
}
/** Classes of the transcript's element children, in order */
const classes = (p) => p.ev("[...document.getElementById('transcript').children].map((e) => e.className)");

export default function (t) {
  t.beforeEach(async (p) => { await resetPrompt(p); });

  // ---- typing and Enter ------------------------------------------------------------------------
  t.test('typing an instruction and pressing Enter runs it', async (p) => {
    await typeAtPrompt(p, 'print "hello');
    p.assert.equal(await inputValue(p), 'print "hello');
    await enter(p);
    p.assert.equal(await transcript(p), 'print "hello\nhello\n');
  });
  t.test('the input is emptied after Enter', async (p) => {
    await typeAtPrompt(p, 'print 1');
    await enter(p);
    p.assert.equal(await inputValue(p), '');
  });
  t.test('the input keeps focus after a command', async (p) => {
    await typeAtPrompt(p, 'print 1');
    await enter(p);
    p.assert.equal(await p.focusedId(), 'cmdInput');
  });
  t.test('the typed instruction is echoed with the echo style', async (p) => {
    await typeAtPrompt(p, 'fd 10');
    await enter(p);
    p.assert.equal(await transcript(p), 'fd 10\n');
    p.assert.deepEqual(await classes(p), ['echo']);
  });
  t.test('Enter on an empty prompt echoes an empty line and runs nothing', async (p) => {
    await p.click('#cmdInput');
    await enter(p);
    p.assert.equal(await transcript(p), '\n');
    p.assert.equal(await p.state(), 'idle');
  });
  t.test('a typed command moves the turtle', async (p) => {
    await p.command('cs');
    await typeAtPrompt(p, 'rt 90 fd 30');
    await enter(p);
    const tt = await p.turtle();
    p.assert.deepEqual([tt.x, tt.y, tt.heading], [30, 0, 90]);
    await p.command('cs');
  });
  t.test('Shift+Enter starts a new line instead of running', async (p) => {
    await typeAtPrompt(p, 'print 1');
    await p.key('Enter', { shift: true });
    await p.type('print 2');
    p.assert.equal(await inputValue(p), 'print 1\nprint 2');
    p.assert.equal(await transcript(p), '');
    await enter(p);
    p.assert.equal(await transcript(p), 'print 1\nprint 2\n1\n2\n');
  });
  t.test('the input grows taller for several lines', async (p) => {
    await p.click('#cmdInput');
    const h0 = (await p.rect('#cmdInput')).h;
    await p.type('print 1');
    await p.key('Enter', { shift: true });
    await p.type('print 2');
    await p.key('Enter', { shift: true });
    await p.type('print 3');
    const h1 = (await p.rect('#cmdInput')).h;
    p.assert.ok(h1 > h0 + 10, `input grew from ${h0} to ${h1}`);
    await enter(p);
    const h2 = (await p.rect('#cmdInput')).h;
    p.assert.ok(Math.abs(h2 - h0) < 2, `input shrank back to ${h2} (was ${h0})`);
  });
  t.test('a multi-line instruction with a list across lines runs as one', async (p) => {
    await typeAtPrompt(p, 'repeat 2 [');
    await p.key('Enter', { shift: true });
    await p.type('print "x]');
    await enter(p);
    p.assert.equal(await transcript(p), 'repeat 2 [\nprint "x]\nx\nx\n');
  });

  // ---- output -----------------------------------------------------------------------------------
  t.test('PRINT output is exact text', async (p) => {
    await p.command('print [a [b c] d]');
    p.assert.equal(await transcript(p), 'print [a [b c] d]\na [b c] d\n');
  });
  t.test('SHOW keeps the outer brackets', async (p) => {
    await p.command('show [a [b c] d]');
    p.assert.equal(await transcript(p), 'show [a [b c] d]\n[a [b c] d]\n');
  });
  t.test('TYPE writes without a newline', async (p) => {
    await p.command('type "a type "b');
    p.assert.equal(await transcript(p), 'type "a type "b\nab');
  });
  t.test('the next echo starts on its own line after TYPE', async (p) => {
    await p.command('type "abc');
    await p.command('print "z');
    p.assert.equal(await transcript(p), 'type "abc\nabc\nprint "z\nz\n');
  });
  t.test('colored output starts its own styled span', async (p) => {
    await p.command('print "plain (settextcolor 1) print "blue (settextcolor 7)');
    const spans = await p.ev("[...document.querySelectorAll('#transcript span.out')].map((e) => [e.textContent, e.style.color])");
    p.assert.deepEqual(spans, [['blue\n', 'rgb(0, 0, 255)']]);
    p.assert.equal(await transcript(p), 'print "plain (settextcolor 1) print "blue (settextcolor 7)\nplain\nblue\n');
  });
  t.test('a value output by an instruction is shown', async (p) => {
    await p.command('sum 2 3');
    p.assert.equal(await transcript(p), 'sum 2 3\n5\n');
    p.assert.deepEqual(await classes(p), ['echo', 'out']);
  });
  t.test('a list value is shown with brackets', async (p) => {
    await p.command('list 1 [2]');
    p.assert.equal(await transcript(p), 'list 1 [2]\n[1 [2]]\n');
  });
  t.test('a word value is shown without a quote', async (p) => {
    await p.command('word "a "b');
    p.assert.equal(await transcript(p), 'word "a "b\nab\n');
  });
  t.test('a command that outputs nothing shows nothing after the echo', async (p) => {
    await p.command('make "cmda 1');
    p.assert.equal(await transcript(p), 'make "cmda 1\n');
  });
  t.test('several PRINTs in one line each get a line', async (p) => {
    await p.command('print 1 print 2 print 3');
    p.assert.equal(await transcript(p), 'print 1 print 2 print 3\n1\n2\n3\n');
  });
  t.test('the status bar reports a finished command', async (p) => {
    await p.command('print 1');
    p.assert.equal(await p.state(), 'idle');
    p.assert.equal(await p.ev("document.getElementById('state').textContent"), 'Ready');
  });

  // ---- errors -----------------------------------------------------------------------------------
  t.test('an error shows its message in the error style', async (p) => {
    await p.command('foo');
    p.assert.equal(await transcript(p), 'foo\nI don\'t know how to foo\nCheck the spelling, or define it with TO ... END before you use it.\n');
    p.assert.deepEqual(await classes(p), ['echo', 'err', 'hint']);
  });
  t.test('an error without a hint shows only the message', async (p) => {
    await p.command('goto "x');
    p.assert.deepEqual(await classes(p), ['echo', 'err']);
  });
  t.test('an error in a procedure names the procedure', async (p) => {
    await p.command('to cmdbad\nfoo\nend');
    await resetPrompt(p);
    await p.command('cmdbad');
    p.assert.equal(await p.text('#transcript .err'), 'I don\'t know how to foo\n  in cmdbad');
  });
  t.test('an error in a program file shows the procedure, the line and the file', async (p) => {
    await p.runProgram('to f1\nprint 1\nfoo 3\nend\nf1\n', { path: '/projects/cmderr.lgo' });
    const err = await p.ev("document.querySelector('#transcript .err').textContent");
    p.assert.equal(err, 'I don\'t know how to foo\n  in f1\n  foo 3\n  cmderr.lgo, line 3');
    p.assert.equal(await p.text('#transcript .hint'), 'Check the spelling, or define it with TO ... END before you use it.');
    p.assert.equal(await p.state(), 'error');
  });
  t.test('the error location says double-click to see the line', async (p) => {
    await p.runProgram('print 1\nprint :undefinedthing\n', { path: '/projects/cmderr2.lgo' });
    p.assert.equal(await p.attr('#transcript .err .clickable', 'title'), 'Double-click to see the line');
  });
  t.test('double-clicking an error jumps to its line in the editor', async (p) => {
    await p.runProgram('print 1\n\nprint 2\nprint :nosuchvar\nprint 5\n', { path: '/projects/cmderr3.lgo' });
    await p.newFile('/projects/other.lgo', 'print "other\n');
    p.assert.equal(await p.activePath(), '/projects/other.lgo');
    await p.dblclick('#transcript .err');
    await p.sleep(80);
    p.assert.equal(await p.activePath(), '/projects/cmderr3.lgo');
    p.assert.equal(await p.ev('LG.app.active.editor.cursor().line'), 3);
  });
  t.test('a single click on an error does not jump', async (p) => {
    await p.runProgram('print :nosuchvar2\n', { path: '/projects/cmderr4.lgo' });
    await p.newFile('/projects/other.lgo', 'print "other\n');
    await p.click('#transcript .err');
    await p.sleep(80);
    p.assert.equal(await p.activePath(), '/projects/other.lgo');
  });
  t.test('an error puts the program in the error state', async (p) => {
    await p.command('foo');
    p.assert.equal(await p.state(), 'error');
    p.assert.equal(await p.ev("document.getElementById('state').textContent"), 'Error');
  });
  t.test('commands still run after an error', async (p) => {
    await p.command('foo');
    await resetPrompt(p);
    await p.command('print 42');
    p.assert.equal(await transcript(p), 'print 42\n42\n');
  });

  // ---- history ----------------------------------------------------------------------------------
  t.test('ArrowUp brings back the last command', async (p) => {
    await p.command('print "h1');
    await p.command('print "h2');
    await p.click('#cmdInput');
    await p.key('ArrowUp');
    p.assert.equal(await inputValue(p), 'print "h2');
  });
  t.test('ArrowUp twice goes further back, ArrowDown comes forward', async (p) => {
    await p.command('print "h1');
    await p.command('print "h2');
    await p.click('#cmdInput');
    await p.key('ArrowUp');
    await p.key('ArrowUp');
    p.assert.equal(await inputValue(p), 'print "h1');
    await p.key('ArrowDown');
    p.assert.equal(await inputValue(p), 'print "h2');
  });
  t.test('ArrowDown past the newest restores the draft', async (p) => {
    await p.command('print "h1');
    await typeAtPrompt(p, 'my draft');
    await p.key('ArrowUp');
    p.assert.equal(await inputValue(p), 'print "h1');
    await p.key('ArrowDown');
    p.assert.equal(await inputValue(p), 'my draft');
  });
  t.test('a recalled command can be run again with Enter', async (p) => {
    await p.command('print "again');
    await resetPrompt(p);
    await p.click('#cmdInput');
    await p.key('ArrowUp');
    await enter(p);
    p.assert.equal(await transcript(p), 'print "again\nagain\n');
  });
  t.test('the cursor goes to the end of a recalled command', async (p) => {
    await p.command('print "cursorend');
    await p.click('#cmdInput');
    await p.key('ArrowUp');
    p.assert.equal(await p.ev("document.getElementById('cmdInput').selectionStart"), 'print "cursorend'.length);
  });
  t.test('the same command twice in a row is kept once', async (p) => {
    await p.command('print "dup');
    await p.command('print "dup');
    const hist = await p.ev('LG.app.commander.hist.slice(-2)');
    p.assert.notDeepEqual(hist, ['print "dup', 'print "dup']);
    p.assert.equal(hist[1], 'print "dup');
  });
  t.test('empty commands are not kept in the history', async (p) => {
    await p.command('print "notempty');
    await p.command('   ');
    p.assert.equal(await p.ev('LG.app.commander.hist[LG.app.commander.hist.length - 1]'), 'print "notempty');
  });
  t.test('ArrowUp at the oldest command stays there', async (p) => {
    const n = await p.ev('LG.app.commander.hist.length');
    await p.click('#cmdInput');
    // a multi-line entry takes an extra press to get past its first line
    for (let i = 0; i < n * 2 + 5; i++) await p.key('ArrowUp', { after: 5 });
    p.assert.equal(await inputValue(p), await p.ev('LG.app.commander.hist[0]'));
  });
  t.test('ArrowUp on the second line of a multi-line input moves the cursor, not the history', async (p) => {
    await p.command('print "older');
    await typeAtPrompt(p, 'print 1');
    await p.key('Enter', { shift: true });
    await p.type('print 2');
    await p.key('ArrowUp');
    p.assert.equal(await inputValue(p), 'print 1\nprint 2');
  });
  t.test('the history is remembered after a reload', async (p) => {
    await p.command('print "remembered');
    await p.reload();
    await p.click('#cmdInput');
    await p.key('ArrowUp');
    p.assert.equal(await inputValue(p), 'print "remembered');
  });

  // ---- Tab completion ---------------------------------------------------------------------------
  t.test('Tab completes a single match and adds a space', async (p) => {
    await typeAtPrompt(p, 'forw');
    await p.key('Tab');
    p.assert.equal(await inputValue(p), 'forward ');
    p.assert.equal(await p.focusedId(), 'cmdInput');
  });
  t.test('Tab completes the last word of an instruction', async (p) => {
    await typeAtPrompt(p, 'repeat 4 [hidet');
    await p.key('Tab');
    p.assert.equal(await inputValue(p), 'repeat 4 [hideturtle ');
  });
  t.test('Tab completes to the common prefix of several matches', async (p) => {
    await typeAtPrompt(p, 'butf');
    await p.key('Tab');
    p.assert.equal(await inputValue(p), 'butfirst');
    p.assert.equal(await transcript(p), '');
  });
  t.test('Tab lists the matches when there is no longer common prefix', async (p) => {
    await typeAtPrompt(p, 'rep');
    await p.key('Tab');
    p.assert.equal(await inputValue(p), 'rep');
    p.assert.equal(await transcript(p), 'repcount  repeat\n');
    p.assert.deepEqual(await classes(p), ['note']);
  });
  t.test('Tab knows procedures you defined', async (p) => {
    await p.command('to zebracrossing\nend');
    await resetPrompt(p);
    await typeAtPrompt(p, 'zebrac');
    await p.key('Tab');
    p.assert.equal(await inputValue(p), 'zebracrossing ');
  });
  t.test('Tab with no match changes nothing', async (p) => {
    await typeAtPrompt(p, 'qqqzz');
    await p.key('Tab');
    p.assert.equal(await inputValue(p), 'qqqzz');
    p.assert.equal(await transcript(p), '');
  });
  t.test('Tab on an empty prompt moves focus away as usual', async (p) => {
    await p.click('#cmdInput');
    await p.key('Tab');
    p.assert.notEqual(await p.focusedId(), 'cmdInput');
  });

  // ---- clearing and Escape ----------------------------------------------------------------------
  t.test('Ctrl+L clears the transcript', async (p) => {
    await p.command('print "gone');
    await p.click('#cmdInput');
    await p.key('l', { ctrl: true });
    p.assert.equal(await transcript(p), '');
  });
  t.test('Ctrl+L keeps what you are typing', async (p) => {
    await p.command('print "gone');
    await typeAtPrompt(p, 'print "kept');
    await p.key('l', { ctrl: true });
    p.assert.equal(await inputValue(p), 'print "kept');
  });
  t.test('the clear button clears the transcript', async (p) => {
    await p.command('print "gone');
    p.assert.equal(await p.attr('#tbClearText', 'title'), 'Clear the text (Ctrl+L)');
    await p.click('#tbClearText');
    p.assert.equal(await transcript(p), '');
  });
  t.test('Escape empties the input', async (p) => {
    await typeAtPrompt(p, 'print "never');
    await p.key('Escape');
    p.assert.equal(await inputValue(p), '');
    p.assert.equal(await transcript(p), '');
  });
  t.test('clicking the transcript puts the cursor back in the input', async (p) => {
    await p.command('print "click');
    await p.click('#editors');
    await p.click('#transcript');
    p.assert.equal(await p.focusedId(), 'cmdInput');
  });
  t.test('Ctrl+` jumps to the command center from the editor', async (p) => {
    await p.click('#editors');
    p.assert.notEqual(await p.focusedId(), 'cmdInput');
    await p.key('`', { ctrl: true });
    p.assert.equal(await p.focusedId(), 'cmdInput');
  });
  t.test('a welcome example click runs it in the command center', async (p) => {
    await p.fresh();
    await p.click('#welcome code', 'fd 100 rt 90 fd 100');
    await p.waitState('idle');
    p.assert.equal(await transcript(p), 'fd 100 rt 90 fd 100\n');
    p.assert.equal(await p.exists('#welcome'), false);
    p.assert.equal(await p.segments(), 2);
  });
  t.test('typing a command hides the welcome bubble', async (p) => {
    await p.fresh();
    p.assert.equal(await p.exists('#welcome'), true);
    await p.command('print 1');
    p.assert.equal(await p.exists('#welcome'), false);
  });
}
