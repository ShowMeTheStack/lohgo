// Shared helpers for the library specs (70-*). The programs are read straight from library/ and
// samples/ so every program gets its own test, opened and run the way a person would.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const LIB = join(ROOT, 'library');

export const read = (file) => readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');

/** The header fields of a library program, parsed here without the generator's code */
export function header(text) {
  const get = (k) => {
    for (const line of text.split('\n')) {
      const m = line.match(new RegExp('^;+\\s*' + k + ':\\s*(.*)$', 'i'));
      if (m) return m[1].trim();
    }
    return '';
  };
  const lv = get('LEVEL').split(/\s/)[0] || 'Intermediate';
  return {
    title: get('TITLE'),
    summary: get('SUMMARY'),
    level: lv[0].toUpperCase() + lv.slice(1).toLowerCase(),
    tags: get('TAGS').split(',').map((s) => s.trim()).filter(Boolean),
  };
}

export const CATEGORY_DIRS = readdirSync(LIB).filter((d) => statSync(join(LIB, d)).isDirectory()).sort();

/** Every program in the library folder (helper files starting with _ are not programs) */
export function programs(cats = CATEGORY_DIRS) {
  const out = [];
  for (const c of cats) {
    for (const f of readdirSync(join(LIB, c)).filter((x) => /\.lgo$/i.test(x) && !x.startsWith('_')).sort()) {
      const text = read(join(LIB, c, f));
      out.push({ path: c + '/' + f, cat: c, file: f, text, head: header(text) });
    }
  }
  return out;
}

export function samples() {
  const dir = join(ROOT, 'samples');
  return readdirSync(dir).filter((f) => f.endsWith('.lgo')).sort().map((f) => ({ file: f, text: read(join(dir, f)) }));
}

// What to type when a program asks a question, taken from each program's HOW TO USE notes.
// When the list runs out, an answer is picked from the question itself.
export const ANSWERS = {
  'algorithms/binary-lightbulbs.lgo': ['200', '1011b', 'quit'],
  'files/quiz-from-file.lgo': ['green', 'elephant', '366', 'QUIT'],
  'algorithms/coin-change-dp.lgo': ['6', '11', 'quit'],
  'algorithms/linear-search.lgo': ['17', '42', 'quit'],
  'animation/prize-wheel.lgo': ['', 'quit'],
  'art/color-mixer.lgo': ['200', '100', '50', 'quit'],
  'classic/backwards.lgo': ['hello world', 'quit'],
  'classic/doctor.lgo': ['I feel tired', 'my computer is slow', 'bye'],
  'classic/pig-latin.lgo': ['logo is fun', 'string theory', 'quit'],
  'classic/teach-the-turtle.lgo': ['zigzag', 'repeat 3 [rt 45 fd 30 lt 90 fd 30 rt 45]', 'quit'],
  'data/address-book-file.lgo': ['Nina Leeds 555-0199', 'list', 'done'],
  'data/shop-inventory.lgo': ['list', 'sell 3 apples', 'buy 10 pears', 'price pears 90', 'quit'],
  'data/pet-phone-book.lgo': ['Rex', 'Sam', 'Rex', 'quit'],
  'files/address-book.lgo': ['ADD', 'Maya 555-0192 Springfield', 'FIND', 'spring', 'LIST', 'QUIT'],
  'files/high-score-table.lgo': ['Ann', '50', '25', '75', '12', '88', '63', '37'],
  'files/dribble-transcript.lgo': ['12', '20'],
  'files/todo-list.lgo': ['add feed the cat', 'add walk the dog', 'done 1', 'tidy', 'quit'],
  'files/recipe-box.lgo': ['1', '4'],
  'files/seat-booking.lgo': ['C4', 'A1', 'QUIT'],
  'files/weather-log.lgo': ['21 12'],
  'files/locker-lookup.lgo': ['7', '12', 'QUIT'],
  'files/saved-settings.lgo': ['yes', '4', '6', '80'],
  'games/connect-four.lgo': ['4', '3', '4', 'quit'],
  'games/dice-battle.lgo': ['', '', 'quit'],
  'games/hangman.lgo': ['e', 'a', 't', 'quit'],
  'games/blackjack.lgo': ['h', 's', '', 'quit'],
  'games/hi-lo-cards.lgo': ['h', 'l', 'h', 'l'],
  'games/guess-the-number.lgo': ['50', '25', '75', 'quit'],
  'games/nim.lgo': ['2 3', '1 1', 'quit'],
  'games/rock-paper-scissors.lgo': ['rock', 'paper', 's', 'quit'],
  'games/memory-match.lgo': ['3 14', '1 2', 'quit'],
  'games/battleship.lgo': ['B7', 'C3', 'quit'],
  'games/tic-tac-toe.lgo': ['5', '1', '9', 'quit'],
  'geometry/coordinate-distance.lgo': ['1', '2', '4', '6'],
  'geometry/protractor.lgo': ['45', '120', 'quit'],
  'geometry/triangle-from-sides.lgo': ['3', '4', '5'],
  'math/base-converter.lgo': ['200', '7', 'quit'],
  'math/arithmetic-quiz.lgo': ['12', '7', 'quit'],
  'math/quadratic-solver.lgo': ['1', '-2', '-3'],
  'music/ear-training.lgo': ['r', 'quit'],
  'music/tempo-control.lgo': ['120', 'quit'],
  'math/newton-square-root.lgo': ['7'],
  'numbers/prime-checker.lgo': ['97', '12', 'quit'],
  'numbers/binary-cards.lgo': ['yes', 'no', 'y', 'n', 'yes', 'no'],
  'music/jukebox.lgo': ['1', 'quit'],
  'numbers/kaprekar.lgo': ['3524', 'quit'],
  'numbers/number-words.lgo': ['1234', '-7', 'quit'],
  'patterns/flower-maker.lgo': ['8', 'red', '40', 'quit'],
  'patterns/mandala-generator.lgo': ['Ann', '42', 'quit'],
  'puzzles/collatz-explorer.lgo': ['27'],
  'recursion/arithmetic-parser.lgo': ['7-2-1', '(8 + 4) / 3 * 2', 'quit'],
  'puzzles/number-pyramid.lgo': ['10', ''],
  'puzzles/sliding-puzzle.lgo': ['8', '6', 'quit'],
  'recursion/guess-my-number.lgo': ['h', 'l', 'y'],
  'recursion/palindromes.lgo': ['racecar', 'hello', 'quit'],
  'recursion/reverse-a-word.lgo': ['logo', 'quit'],
  'school/add-subtract-drill.lgo': ['5', 'QUIT'],
  'school/bigger-or-smaller.lgo': ['>', '<', '=', 'QUIT'],
  'school/flash-cards.lgo': ['cat', 'QUIT'],
  'school/mental-math-timer.lgo': ['5', 'QUIT'],
  'school/bar-chart-reader.lgo': ['5', 'apples', 'QUIT'],
  'school/number-bonds.lgo': ['10', '4', '6', 'QUIT'],
  'school/even-or-odd.lgo': ['even', 'o', 'QUIT'],
  'school/shapes-quiz.lgo': ['triangle', 'square', 'QUIT'],
  'school/multiplication-grid.lgo': ['48', 'QUIT'],
  'school/word-problems.lgo': ['12', 'QUIT'],
  'school/angle-estimator.lgo': ['90', 'QUIT'],
  'school/roman-numerals.lgo': ['12', 'XII', 'QUIT'],
  'school/capitals-quiz.lgo': ['Paris', 'HINT', 'New Delhi', 'QUIT'],
  'school/fraction-pies.lgo': ['3/8', 'QUIT'],
  'school/number-line-jumps.lgo': ['5', 'QUIT'],
  'school/area-and-perimeter.lgo': ['24', 'QUIT'],
  'school/sharing-sweets.lgo': ['4 2', 'QUIT'],
  'school/times-tables.lgo': ['7', '49', '14', 'QUIT'],
  'school/clock-quiz.lgo': ['1', '9:30', '12:05', 'QUIT'],
  'school/left-or-right.lgo': ['left', 'r', 'QUIT'],
  'school/money-counter.lgo': ['47', 'QUIT'],
  'school/place-value-blocks.lgo': ['234', 'QUIT'],
  'school/spelling-practice.lgo': ['because', 'friend'],
  'school/unit-trainer.lgo': ['100', 'QUIT'],
  'science/epidemic-sir.lgo': ['3'],
  'science/temperature-table.lgo': ['37', 'quit'],
  'shapes/block-letters.lgo': ['HELLO'],
  'shapes/shape-maker.lgo': ['6', '50', 'quit'],
  'spirals/spiral-explorer.lgo': ['121', 'quit'],
  'stories/atbash-cipher.lgo': ['hello', 'svool', 'QUIT'],
  'stories/castle-adventure.lgo': ['look', 'north', 'take key', 'inventory', 'help', 'quit'],
  'stories/cave-adventure.lgo': ['LEFT', 'RIGHT', 'QUIT'],
  'stories/acrostic-poem.lgo': ['Ann', 'QUIT'],
  'stories/eliza-chatbot.lgo': ['I feel tired', 'my brother is annoying', 'BYE'],
  'stories/caesar-cipher.lgo': ['meet me at noon', '3', 'QUIT'],
  'stories/interview-bot.lgo': ['Sam', '', 'pizza', 'blue'],
  'stories/compliment-machine.lgo': ['Ann', 'QUIT'],
  'stories/opposites-game.lgo': ['cold', 'QUIT'],
  'stories/fortune-teller.lgo': ['red', '1', '2', 'QUIT'],
  'stories/limerick-builder.lgo': ['Ann', '1'],
  'stories/pig-latin.lgo': ['the cat is happy', 'back atcay', 'QUIT'],
  'stories/haiku-maker.lgo': ['an old silent pond', 'QUIT'],
  'stories/sentence-diagram.lgo': ['the hungry cat quickly ate the small fish', 'QUIT'],
  'stories/morse-code.lgo': ['SOS', '... --- ...', 'QUIT'],
  'stories/spoonerisms.lgo': ['bad salad', 'QUIT'],
  'stories/word-chain.lgo': ['cat', 'tiger', 'QUIT'],
  'stories/riddles.lgo': ['a towel', 'QUIT'],
  'stories/tongue-twisters.lgo': ['S', 'B', 'QUIT'],
  'stories/zoggish-translator.lgo': ['hello friend I like your hat', 'QUIT'],
  'stories/mad-libs.lgo': ['dog', '', 'jump', 'blue', '', 'cake', 'happy'],
  'words/alphabetical-order.lgo': ['pear apple fig'],
  'words/backwards-talk.lgo': ['hello there', 'quit'],
  'words/number-names.lgo': ['42', '1999', 'quit'],
  'words/rhyme-finder.lgo': ['cat', 'quit'],
  'words/plurals.lgo': ['box', 'baby', 'quit'],
  'words/vowel-detective.lgo': ['the quick brown fox'],
  'words/acrostic-poem.lgo': ['Ann'],
  'words/pig-latin.lgo': ['logo is fun', 'quit'],
  'words/word-shapes.lgo': ['elephant'],
  'words/word-chain.lgo': ['apple', 'elephant', 'quit'],
  'words/spelling-bee.lgo': ['plant', 'planter', 'quit'],
  'words/spell-checker.lgo': ['teh cat sat', 'quit'],
  // the examples
  'guess.lgo': ['50', '25', '75', '12', '88'],
  'diary.lgo': ['I tested the diary today'],
};

/** An answer picked from the question the program printed last */
export function guessAnswer(prompt) {
  const q = (prompt || '').toLowerCase();
  if (/yes or no|\(y\/n\)|\by\/n\b|yes\/no/.test(q)) return 'yes';
  if (/name/.test(q)) return 'Ann';
  if (/colou?r/.test(q) && !/number/.test(q)) return 'red';
  if (/\d\s*[-+x×*\/÷]\s*\d|number|how many|how much|how old|age|amount|guess|size|angle|degrees|column|row|digit|total|sum|\bfrom \d+|between \d+|\d+ to \d+/.test(q)) return '5';
  return 'hello';
}

const KEYBOARD = /\b(keyboardon|readchar|rc|keyp|keyboardvalue|readchars)\b/i;
const MOUSE = /\b(mouseon|buttonp|mousepos|clickpos)\b/i;

/** Open the library sheet with the rail button */
export async function openSheet(p) {
  if (await p.exists('#libSearch')) return;
  await p.click('#railLibrary');
  await p.wait("!!document.getElementById('libSearch')", 4000);
  await p.sleep(60);
}

/** Put text in the search box the way typing would (select all, type over it) */
export async function search(p, text) {
  await p.click('#libSearch');
  await p.ev("document.getElementById('libSearch').select()");
  if (text) await p.insertText(text);
  else if (await p.ev("document.getElementById('libSearch').value !== ''")) await p.key('Backspace');
  await p.sleep(40);
}

/** Show every program: Everything, All levels, no search */
export async function showAll(p) {
  await openSheet(p);
  await p.click('.sheet-nav .nav-item[data-cat="*"]');
  await p.click('#libLevels button[data-lv="*"]');
  await search(p, '');
}

/** What a card shows */
export function card(p, path) {
  return p.ev(`(() => {
    const c = document.querySelector('.pcard[data-path="' + ${JSON.stringify(path)} + '"]');
    if (!c) return null;
    return { title: c.querySelector('.t').innerText, summary: c.querySelector('.d').innerText,
      chips: [...c.querySelectorAll('.tagc')].map((e) => e.innerText), levelClass: c.querySelector('.tagc').className };
  })()`);
}

async function clean(p) {
  await p.ev('LG.app.stop()');
  await p.ev('LG.UI.closeMenus(); LG.UI.closeAllModals()');
  await p.sleep(40);
}

/** Close every open editor tab so the next program starts from a tidy page */
async function closeDocs(p) {
  await p.ev(`(async () => { for (const d of [...LG.app.docs]) { d.dirty = false; await LG.app.closeDoc(d); } })()`);
  await p.sleep(30);
}

/** Run the active program with F5 for a short while, answering questions, pressing keys
 *  and clicking the world as the program needs. Returns what happened. */
export async function driveRun(p, key, text, ms = 2500) {
  const answers = (ANSWERS[key] || []).slice();
  const usesKeys = KEYBOARD.test(text.replace(/;.*$/gm, ''));
  const usesMouse = MOUSE.test(text.replace(/;.*$/gm, ''));
  await p.ev('LG.app.active.editor.focus()');
  await p.key('F5');
  await p.sleep(80);
  const t0 = Date.now();
  let asked = 0, keys = 0, clicks = 0, prevAsk = -1;
  const KEYSEQ = ['ArrowUp', 'ArrowLeft', ' ', 'ArrowRight', 'a', 'r', '1', 'ArrowDown', 'g', 'Enter', 'b', 'y', ' '];
  let worldFocused = false;
  while (Date.now() - t0 < ms) {
    const s = await p.state();
    if (s === 'error' || s === 'idle') break;
    if (s === 'paused') { await p.key('F5'); await p.sleep(60); continue; }
    const reading = await p.ev('!!LG.app.commander.reading');
    if (s === 'input' && reading) {
      // a question in the command center: answer it there
      const n = await p.ev("document.querySelectorAll('#transcript .answer').length");
      if (n === prevAsk) { await p.sleep(40); continue; }
      prevAsk = n;
      let ans = answers.length ? answers.shift() : null;
      if (ans === null) {
        const last = await p.ev("(LG.app.commander.flush(), document.getElementById('transcript').innerText.trim().split('\\n').slice(-2).join(' '))");
        ans = guessAnswer(last);
        if (process.env.E2E_LIBLOG) console.log('GUESS', key, JSON.stringify(last), '->', ans);
      }
      await p.click('#cmdInput');
      if (ans) await p.insertText(ans);
      await p.key('Enter');
      asked++;
      await p.sleep(120);
      continue;
    }
    if (s === 'input' || usesKeys) {
      if (!worldFocused || (await p.ev('document.activeElement && document.activeElement.id')) !== 'worldCanvas') {
        await p.click('#worldCanvas');
        clicks++;
        worldFocused = true;
      }
      await p.key(KEYSEQ[keys % KEYSEQ.length]);
      keys++;
      await p.sleep(s === 'input' ? 60 : 140);
      if (!usesMouse) continue;
    }
    if (usesMouse) {
      const r = await p.rect('#worldCanvas');
      const pts = [[0.5, 0.5], [0.3, 0.35], [0.7, 0.6], [0.45, 0.7], [0.6, 0.3]];
      const [fx, fy] = pts[clicks % pts.length];
      const x = r.x + r.w * fx, y = r.y + r.h * fy;
      await p.clickAt(x, y);
      // and a short drag for the drawing programs
      await p.mouse('mousePressed', x, y);
      await p.mouse('mouseMoved', x + 20, y + 10);
      await p.mouse('mouseMoved', x + 40, y + 25);
      await p.mouse('mouseReleased', x + 40, y + 25);
      clicks++;
      await p.sleep(200);
      continue;
    }
    await p.sleep(100);
  }
  const res = await p.ev(`(() => ({
    state: LG.app.interp.state,
    problems: (LG.app.problems || []).map((x) => x.message),
    errs: (LG.app.commander.flush(), [...document.querySelectorAll('#transcript .err')].map((e) => e.innerText)),
    status: document.getElementById('statusMsg').innerText,
  }))()`);
  res.asked = asked; res.keys = keys; res.clicks = clicks;
  if (process.env.E2E_LIBLOG) console.log('RUN', key, JSON.stringify(res), JSON.stringify(await p.ev("document.getElementById('transcript').innerText.slice(-300)")));
  return res;
}

export function assertClean(p, res, what) {
  const info = what + ': ' + JSON.stringify(res);
  p.assert.notEqual(res.state, 'error', info);
  p.assert.deepEqual(res.problems, [], info);
  p.assert.deepEqual(res.errs, [], info);
  p.assert.doesNotMatch(res.status, /^Error/, info);
}

/** One test per library program: open it from the sheet, check its card, run it, stop it */
export function programTests(t, cats) {
  for (const prog of programs(cats)) {
    t.test(`library program ${prog.path} opens from the sheet and runs without an error`, async (p) => {
      await clean(p);
      await closeDocs(p);
      await p.ev('LG.app.commander.clear && LG.app.commander.clear()');
      await showAll(p);
      await search(p, prog.path);
      await p.wait(`!!document.querySelector('.pcard[data-path="${prog.path}"]')`, 3000);
      // the card shows the header of the file
      const c = await card(p, prog.path);
      p.assert.equal(c.title.replace(/^✓ /, ''), prog.head.title || prog.file, 'title');
      p.assert.equal(c.summary, prog.head.summary, 'summary');
      p.assert.deepEqual(c.chips, [prog.head.level, ...prog.head.tags.slice(0, 3)], 'level and tags');
      p.assert.ok(c.levelClass.includes('lv-' + prog.head.level.toLowerCase()), 'level chip colour');
      p.assert.ok(['Beginner', 'Intermediate', 'Advanced'].includes(prog.head.level), 'a known level: ' + prog.head.level);
      p.assert.ok(prog.head.title && prog.head.summary && prog.head.tags.length, 'header has a title, summary and tags');
      await p.click(`.pcard[data-path="${prog.path}"]`);
      await p.wait(`LG.app.active && LG.app.active.path === ${JSON.stringify('/library/' + prog.path)}`, 5000);
      p.assert.equal(await p.code(), prog.text, 'the editor holds the file from the library');
      p.assert.equal(await p.modalOpen(), false);
      const res = await driveRun(p, prog.path, prog.text);
      assertClean(p, res, prog.path);
      await clean(p);
      p.assert.notEqual(await p.state(), 'error');
    }, { timeout: 40000 });
  }
}

/** One test per example in /examples: open it from the Files panel and run it */
export function sampleTests(t) {
  for (const s of samples()) {
    t.test(`example /examples/${s.file} opens from the Files panel and runs without an error`, async (p) => {
      await clean(p);
      await closeDocs(p);
      await p.ev('LG.app.commander.clear && LG.app.commander.clear()');
      if (!(await p.ev("LG.app.side === 'files'"))) await p.click('#railFiles');
      const row = `#sideBody .trow[data-path="/examples/${s.file}"]`;
      if (!(await p.exists(row))) await p.click('#sideBody .trow[data-path="/examples"]');
      await p.wait(`!!document.querySelector(${JSON.stringify(row)})`, 3000);
      await p.click(row);
      await p.wait(`LG.app.active && LG.app.active.path === ${JSON.stringify('/examples/' + s.file)}`, 4000);
      p.assert.equal(await p.code(), s.text, 'the editor holds the example');
      const res = await driveRun(p, s.file, s.text);
      assertClean(p, res, s.file);
      await clean(p);
    }, { timeout: 40000 });
  }
}
