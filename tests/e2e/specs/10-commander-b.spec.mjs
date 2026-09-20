// The command center, part two: TO ... END at the prompt, READLIST/READWORD answered at the
// prompt, the Problems tab, the text page (CLEARTEXT, SETCURSOR), text colour and size, and
// commands while a program runs or is paused.
import { transcript, resetPrompt } from './10-lang-lib.mjs';

const prompt = (p) => p.ev("document.getElementById('cmdPrompt').textContent");
const placeholder = (p) => p.ev("document.getElementById('cmdInput').placeholder");
const inputValue = (p) => p.ev("document.getElementById('cmdInput').value");
async function typeLine(p, text) {
  await p.click('#cmdInput');
  await p.type(text);
  await p.key('Enter');
  await p.sleep(60);
}

export default function (t) {
  t.beforeEach(async (p) => { await resetPrompt(p); await p.ev('LG.app.commander.showTab("commands")'); });

  // ---- TO ... END at the prompt -----------------------------------------------------------------
  t.test('the prompt is ? when idle', async (p) => {
    p.assert.equal(await prompt(p), '?');
  });
  t.test('typing a TO line changes the prompt to >', async (p) => {
    await typeLine(p, 'to square :s');
    p.assert.equal(await prompt(p), '>');
    p.assert.equal(await placeholder(p), 'Type the lines of square, then END');
    p.assert.equal(await transcript(p), 'to square :s\n');
  });
  t.test('lines of a definition are echoed in the definition style', async (p) => {
    await typeLine(p, 'to square2 :s');
    await typeLine(p, 'repeat 4 [fd :s rt 90]');
    const defs = await p.ev("[...document.querySelectorAll('#transcript .echo.def')].map((e) => e.textContent)");
    p.assert.deepEqual(defs, ['repeat 4 [fd :s rt 90]']);
    p.assert.equal(await prompt(p), '>');
  });
  t.test('END finishes the definition and says it is defined', async (p) => {
    await typeLine(p, 'to square3 :s');
    await typeLine(p, 'repeat 4 [fd :s rt 90]');
    await typeLine(p, 'end');
    p.assert.equal(await transcript(p), 'to square3 :s\nrepeat 4 [fd :s rt 90]\nend\nsquare3 defined\n');
    p.assert.equal(await p.text('#transcript .ok'), 'square3 defined');
    p.assert.equal(await prompt(p), '?');
    p.assert.equal(await placeholder(p), '');
  });
  t.test('a procedure defined at the prompt runs', async (p) => {
    await typeLine(p, 'to triple :x');
    await typeLine(p, 'output :x * 3');
    await typeLine(p, 'end');
    await resetPrompt(p);
    await p.command('print triple 5');
    p.assert.equal(await transcript(p), 'print triple 5\n15\n');
  });
  t.test('END is accepted in capitals and with spaces around it', async (p) => {
    await typeLine(p, 'to capsend');
    await typeLine(p, '  END  ');
    p.assert.equal(await prompt(p), '?');
    p.assert.equal(await p.ev("LG.app.interp.procs.has('capsend')"), true);
  });
  t.test('Escape cancels a definition', async (p) => {
    await typeLine(p, 'to cancelled1');
    await typeLine(p, 'print 1');
    await p.key('Escape');
    p.assert.equal(await prompt(p), '?');
    p.assert.equal(await transcript(p), 'to cancelled1\nprint 1\nDefinition cancelled.\n');
    p.assert.equal(await p.ev("LG.app.interp.procs.has('cancelled1')"), false);
  });
  t.test('Escape while defining keeps the text you were typing', async (p) => {
    await typeLine(p, 'to cancelled2');
    await p.type('print 2');
    await p.key('Escape');
    p.assert.equal(await prompt(p), '?');
    p.assert.equal(await inputValue(p), 'print 2');
  });
  t.test('redefining a procedure replaces it', async (p) => {
    await p.command('to redef1\noutput 1\nend');
    await p.command('to redef1\noutput 2\nend');
    p.assert.equal(await transcript(p), 'to redef1\noutput 1\nend\nredef1 defined\nto redef1\noutput 2\nend\nredef1 defined\n');
    await resetPrompt(p);
    await p.command('print redef1');
    p.assert.equal(await transcript(p), 'print redef1\n2\n');
  });
  t.test('defining a primitive name is refused', async (p) => {
    await typeLine(p, 'to forward :n');
    p.assert.equal(await transcript(p), 'to forward :n\nforward is a primitive\n');
    p.assert.equal(await prompt(p), '?');
    p.assert.equal(await p.text('#transcript .err'), 'forward is a primitive');
  });
  t.test('defining a primitive is refused in any letter case', async (p) => {
    await typeLine(p, 'TO PRINT');
    p.assert.equal(await transcript(p), 'TO PRINT\nPRINT is a primitive\n');
  });
  t.test('a whole definition typed with Shift+Enter is defined at once', async (p) => {
    await p.click('#cmdInput');
    await p.type('to shifted');
    await p.key('Enter', { shift: true });
    await p.type('print "s');
    await p.key('Enter', { shift: true });
    await p.type('end');
    await p.key('Enter');
    await p.sleep(60);
    p.assert.equal(await transcript(p), 'to shifted\nprint "s\nend\nshifted defined\n');
    p.assert.equal(await prompt(p), '?');
  });
  t.test('a definition then instructions in one go defines and runs', async (p) => {
    await p.command('to inone\nprint "ran\nend\ninone');
    p.assert.equal(await transcript(p), 'to inone\nprint "ran\nend\ninone defined\ninone\nran\n');
  });
  t.test('instructions before a definition run first', async (p) => {
    await p.command('print "first\nto later1\nend\nprint "second');
    p.assert.equal(await transcript(p), 'print "first\nfirst\nto later1\nend\nlater1 defined\nprint "second\nsecond\n');
  });
  t.test('a procedure defined at the prompt is listed in the Procedures panel', async (p) => {
    await p.command('to listedproc :a\nend');
    if (await p.ev('LG.app.side') !== 'procs') await p.click('#railProcs');
    await p.wait("document.getElementById('sideBody').innerText.includes('to listedproc :a')");
    p.assert.match(await p.text('#sideBody'), /to listedproc :a\s+typed at the prompt/);
    await p.click('#railProcs');
  });

  // ---- READLIST / READWORD -----------------------------------------------------------------------
  t.test('READLIST waits with a » prompt', async (p) => {
    await p.command('show readlist');
    p.assert.equal(await p.state(), 'input');
    p.assert.equal(await prompt(p), '»');
    p.assert.equal(await p.ev("document.getElementById('cmdInputBox').classList.contains('reading')"), true);
    p.assert.equal(await placeholder(p), 'The program is waiting for you to type something and press Enter');
    p.assert.equal(await p.focusedId(), 'cmdInput');
  });
  t.test('the answer to READLIST is echoed and used', async (p) => {
    await p.command('show readlist');
    await typeLine(p, 'a b [c]');
    await p.waitState('idle');
    p.assert.equal(await transcript(p), 'show readlist\na b [c]\n[a b [c]]\n');
    p.assert.equal(await p.ev("document.querySelector('#transcript .answer').textContent"), 'a b [c]');
    p.assert.equal(await prompt(p), '?');
  });
  t.test('READWORD gives the line as one word', async (p) => {
    await p.command('show readword');
    await typeLine(p, 'hello there');
    await p.waitState('idle');
    p.assert.equal(await transcript(p), 'show readword\nhello there\nhello there\n');
    await resetPrompt(p);
    await p.command('make "rwv rw');
    await typeLine(p, 'two words');
    await p.waitState('idle');
    await resetPrompt(p);
    await p.command('print count :rwv');
    p.assert.equal(await transcript(p), 'print count :rwv\n9\n');
  });
  t.test('an empty answer to READLIST is the empty list', async (p) => {
    await p.command('show readlist');
    await typeLine(p, '');
    await p.waitState('idle');
    p.assert.equal(await transcript(p), 'show readlist\n\n[]\n');
  });
  t.test('a program asks twice and both answers are used', async (p) => {
    await p.runProgram('type [Name?\\ ]\nmake "n readword\ntype [Age?\\ ]\nmake "a readword\nprint (se "Hi :n :a)\n', { path: '/projects/ask.lgo' });
    p.assert.equal(await p.state(), 'input');
    await typeLine(p, 'Ann');
    await p.waitState('input');
    await typeLine(p, '9');
    await p.waitState('idle');
    p.assert.equal(await transcript(p), '▶ Running ask.lgo\nName? \nAnn\nAge? \n9\nHi Ann 9\n');
  });
  t.test('answering does not add to the command history', async (p) => {
    await p.command('print "beforeask');
    await p.command('show readword');
    await typeLine(p, 'secretanswer');
    await p.waitState('idle');
    p.assert.notEqual(await p.ev('LG.app.commander.hist[LG.app.commander.hist.length - 1]'), 'secretanswer');
  });
  t.test('stopping a program that waits for input restores the prompt', async (p) => {
    await p.command('show readlist');
    await p.click('#tbStop');
    await p.waitState('idle');
    p.assert.equal(await prompt(p), '?');
    p.assert.equal(await p.ev("document.getElementById('cmdInputBox').classList.contains('reading')"), false);
  });

  // ---- the Problems tab ---------------------------------------------------------------------------
  t.test('the Problems tab has no badge when there are no problems', async (p) => {
    await p.runProgram('print 1\n', { path: '/projects/fine.lgo' });
    p.assert.equal(await p.ev("document.querySelector('#tabProblems .badge').classList.contains('hidden')"), true);
    await p.click('#tabProblems');
    p.assert.equal(await p.text('#problems'), 'No problems. Errors from running your program are listed here.');
  });
  t.test('an error in a program shows a badge count of 1', async (p) => {
    await p.runProgram('print 1\nfoo\n', { path: '/projects/prob1.lgo' });
    p.assert.equal(await p.ev("document.querySelector('#tabProblems .badge').classList.contains('hidden')"), false);
    p.assert.equal(await p.text('#tabProblems .badge'), '1');
  });
  t.test('the Problems tab lists the error with its file and line', async (p) => {
    await p.runProgram('print 1\nprint 2\nfoo\n', { path: '/projects/prob2.lgo' });
    await p.click('#tabProblems');
    p.assert.equal(await p.count('#problems .list-row'), 1);
    const row = await p.ev("[...document.querySelectorAll('#problem0 span')].map((s) => s.textContent)");
    p.assert.deepEqual(row, ['●', 'I don\'t know how to foo', 'prob2.lgo:3']);
  });
  t.test('the Problems tab hides the transcript and input, Commands brings them back', async (p) => {
    await p.click('#tabProblems');
    p.assert.equal(await p.visible('#transcript'), false);
    p.assert.equal(await p.visible('#cmdInputBox'), false);
    p.assert.equal(await p.visible('#problems'), true);
    p.assert.ok((await p.attr('#tabProblems', 'class')).includes('active'));
    await p.click('#tabCommands');
    p.assert.equal(await p.visible('#transcript'), true);
    p.assert.equal(await p.visible('#problems'), false);
    p.assert.equal(await p.focusedId(), 'cmdInput');
  });
  t.test('double-clicking a problem goes to the line', async (p) => {
    await p.runProgram('print 1\nprint 2\nprint 3\nfoo\n', { path: '/projects/prob3.lgo' });
    await p.newFile('/projects/other.lgo', 'print "other\n');
    await p.click('#tabProblems');
    await p.dblclick('#problem0');
    await p.sleep(80);
    p.assert.equal(await p.activePath(), '/projects/prob3.lgo');
    p.assert.equal(await p.ev('LG.app.active.editor.cursor().line'), 3);
  });
  t.test('Enter on a focused problem goes to the line', async (p) => {
    await p.runProgram('to f\nfoo\nend\n\nf\n', { path: '/projects/prob4.lgo' });
    await p.newFile('/projects/other.lgo', 'print "other\n');
    await p.click('#tabProblems');
    await p.ev("document.getElementById('problem0').focus()");
    await p.key('Enter');
    await p.sleep(80);
    p.assert.equal(await p.activePath(), '/projects/prob4.lgo');
    p.assert.equal(await p.ev('LG.app.active.editor.cursor().line'), 1);
    // the Enter that picked the problem must not also land in the code
    p.assert.equal(await p.code(), 'to f\nfoo\nend\n\nf\n');
  });
  t.test('running again clears the problems', async (p) => {
    await p.runProgram('foo\n', { path: '/projects/prob5.lgo' });
    p.assert.equal(await p.text('#tabProblems .badge'), '1');
    await p.runProgram('print 1\n', { path: '/projects/prob5.lgo' });
    p.assert.equal(await p.ev("document.querySelector('#tabProblems .badge').classList.contains('hidden')"), true);
  });
  t.test('the editor marks the error line', async (p) => {
    await p.runProgram('print 1\nfoo\n', { path: '/projects/prob6.lgo' });
    p.assert.equal(await p.activePath(), '/projects/prob6.lgo');
    p.assert.equal(await p.ev('LG.app.active.editor.marks.err'), 1);
  });

  // ---- the text page -------------------------------------------------------------------------------
  t.test('CLEARTEXT empties the transcript', async (p) => {
    await p.command('print "old');
    await p.command('cleartext print "new');
    p.assert.equal(await transcript(p), 'new\n');
  });
  t.test('CT is short for CLEARTEXT', async (p) => {
    await p.command('print "old');
    await p.command('ct');
    p.assert.equal(await transcript(p), '');
  });
  t.test('SETCURSOR moves where text appears', async (p) => {
    await p.command('ct type "abc setcursor [1 2] type "X');
    p.assert.equal(await transcript(p), 'abc\n\n X');
  });
  t.test('text written at the cursor overwrites what is there', async (p) => {
    await p.command('ct print "hello setcursor [1 0] type "EL');
    p.assert.equal(await transcript(p), 'hELlo\n');
  });
  t.test('CURSOR reports the cursor position', async (p) => {
    await p.command('ct setcursor [3 1] show cursor');
    p.assert.equal(await transcript(p), '\n   [3 1]\n');
  });
  t.test('CURSOR follows typed text', async (p) => {
    await p.command('ct type "abcd make "cur cursor print " show :cur');
    p.assert.equal(await transcript(p), 'abcd\n[4 0]\n');
  });
  t.test('the next command after a text page starts on a new line', async (p) => {
    await p.command('ct type "page');
    await p.command('print "after');
    p.assert.equal(await transcript(p), 'page\nprint "after\nafter\n');
  });

  // ---- text colour and size -------------------------------------------------------------------------
  t.test('SETTEXTCOLOR colours the text that follows', async (p) => {
    await p.command('(settextcolor 4) print "red');
    const spans = await p.ev("[...document.querySelectorAll('#transcript span.out')].map((e) => [e.textContent, e.style.color])");
    p.assert.deepEqual(spans, [['red\n', 'rgb(255, 0, 0)']]);
  });
  t.test('SETTEXTCOLOR accepts a colour name and an RGB list', async (p) => {
    await p.command('(settextcolor "green) print "g (settextcolor [0 0 255]) print "b');
    const spans = await p.ev("[...document.querySelectorAll('#transcript span.out')].map((e) => [e.textContent, e.style.color])");
    p.assert.equal(spans.length, 2);
    p.assert.equal(spans[0][0], 'g\n');
    p.assert.match(spans[0][1], /^rgb\(0, \d+, 0\)$/);
    p.assert.deepEqual(spans[1], ['b\n', 'rgb(0, 0, 255)']);
  });
  t.test('echoes and errors keep their own style after SETTEXTCOLOR', async (p) => {
    await p.command('(settextcolor 4)');
    await p.command('foo');
    p.assert.equal(await p.ev("document.querySelector('#transcript .err').style.color"), '');
    p.assert.equal(await p.ev("[...document.querySelectorAll('#transcript .echo')].every((e) => !e.style.color)"), true);
  });
  t.test('SETTEXTSIZE changes the transcript text size and TEXTSIZE reports it', async (p) => {
    await p.command('settextsize 20 print textsize');
    p.assert.equal(await transcript(p), 'settextsize 20 print textsize\n20\n');
    p.assert.equal(await p.ev("getComputedStyle(document.getElementById('transcript')).fontSize"), '20px');
    await p.command('settextsize 14');
  });
  t.test('SETTEXTSIZE refuses a size of zero', async (p) => {
    await p.command('settextsize 0');
    p.assert.equal(await transcript(p), 'settextsize 0\nsettextsize doesn\'t like 0 as input\nCheck the kind of thing you gave it: a number, a word or a list.\n');
  });

  // ---- while a program runs or is paused ------------------------------------------------------------
  t.test('a command typed while a program runs is refused with a note', async (p) => {
    await p.runProgram('forever [wait 1]\n', { path: '/projects/busy.lgo', wait: false });
    await p.waitState(['running', 'waiting']);
    await p.command('print "nope', { wait: false });
    await p.sleep(80);
    p.assert.match(await transcript(p), /print "nope\nThe program is still running\. Press Stop \(or Pause\) first\.\n$/);
    p.assert.equal(await p.ev("[...document.querySelectorAll('#transcript .note')].pop().textContent"), 'The program is still running. Press Stop (or Pause) first.');
    p.assert.ok(['running', 'waiting'].includes(await p.state()));
    await p.stopProgram();
  });
  t.test('stopping a running program notes Stopped.', async (p) => {
    await p.runProgram('forever [wait 1]\n', { path: '/projects/busy.lgo', wait: false });
    await p.waitState(['running', 'waiting']);
    await p.click('#tbStop');
    await p.waitState('idle');
    p.assert.match(await transcript(p), /Stopped\.\n$/);
  });
  t.test('a command while paused runs in the paused procedure', async (p) => {
    await p.newFile('/projects/pz.lgo', 'to f :n\nif :n = 0 [stop]\nf :n - 1\nend\nf 3\n');
    await p.ev("LG.app.clearBreakpoints(); LG.app.toggleBreakpoint('/projects/pz.lgo', 1)");
    await p.key('F5');
    await p.waitState('paused');
    await p.ev('LG.app.commander.clear()');
    await p.command('print :n');
    p.assert.equal(await transcript(p), 'print :n\n3\n');
    p.assert.equal(await p.state(), 'paused');
    await p.ev('LG.app.clearBreakpoints()');
    await p.stopProgram();
  });
  t.test('a command while paused runs in the frame picked in the call stack', async (p) => {
    await p.newFile('/projects/pz2.lgo', 'to f :n\nif :n = 0 [stop]\nf :n - 1\nend\nf 3\n');
    await p.ev("LG.app.clearBreakpoints(); LG.app.toggleBreakpoint('/projects/pz2.lgo', 1)");
    await p.key('F5');
    await p.waitState('paused');
    await p.key('F5');
    await p.waitState('paused');
    await p.key('F5');
    await p.waitState('paused');
    await p.inspector('stack');
    await p.click('#frame1');
    await p.ev('LG.app.commander.clear()');
    await p.command('print :n');
    p.assert.equal(await transcript(p), 'print :n\n3\n');
    await p.click('#frame3');
    await p.ev('LG.app.commander.clear()');
    await p.command('print :n');
    p.assert.equal(await transcript(p), 'print :n\n1\n');
    await p.ev('LG.app.clearBreakpoints()');
    await p.stopProgram();
  });
  t.test('a value typed while paused is shown and the program stays paused', async (p) => {
    await p.newFile('/projects/pz3.lgo', 'to g :a\nprint :a\nend\ng [x y]\n');
    await p.ev("LG.app.clearBreakpoints(); LG.app.toggleBreakpoint('/projects/pz3.lgo', 1)");
    await p.key('F5');
    await p.waitState('paused');
    await p.ev('LG.app.commander.clear()');
    await p.command('count :a');
    p.assert.equal(await transcript(p), 'count :a\n2\n');
    await p.command('make "a [z]');
    await p.ev('LG.app.clearBreakpoints()');
    await p.key('F5');
    await p.waitState('idle');
    p.assert.match(await transcript(p), /z\n/);
  });
  t.test('an error typed while paused keeps the program paused', async (p) => {
    await p.newFile('/projects/pz4.lgo', 'to g :a\nprint :a\nend\ng 1\n');
    await p.ev("LG.app.clearBreakpoints(); LG.app.toggleBreakpoint('/projects/pz4.lgo', 1)");
    await p.key('F5');
    await p.waitState('paused');
    await p.ev('LG.app.commander.clear()');
    await p.command('foo');
    p.assert.equal(await transcript(p), 'foo\nI don\'t know how to foo\n  in g\nCheck the spelling, or define it with TO ... END before you use it.\n');
    p.assert.equal(await p.state(), 'paused');
    await p.ev('LG.app.clearBreakpoints()');
    await p.stopProgram();
  });
  t.test('THROW typed while paused names the missing tag', async (p) => {
    await p.newFile('/projects/pz5.lgo', 'to g\nprint 1\nend\ng\n');
    await p.ev("LG.app.clearBreakpoints(); LG.app.toggleBreakpoint('/projects/pz5.lgo', 1)");
    await p.key('F5');
    await p.waitState('paused');
    await p.ev('LG.app.commander.clear()');
    await p.command('throw "nowhere');
    p.assert.equal(await transcript(p), 'throw "nowhere\nCan\'t find catch tag for nowhere\n');
    await p.ev('LG.app.clearBreakpoints()');
    await p.stopProgram();
  });
  t.test('after an error a command can read the variables where it happened', async (p) => {
    await p.runProgram('to h :v\nfoo\nend\nh 77\n', { path: '/projects/pm.lgo' });
    p.assert.equal(await p.state(), 'error');
    await resetPrompt(p);
    await p.runProgram('to h :v\nfoo\nend\nh 77\n', { path: '/projects/pm.lgo' });
    await p.ev('LG.app.commander.clear()');
    await p.command('print :v');
    p.assert.equal(await transcript(p), 'print :v\n77\n');
  });
}
