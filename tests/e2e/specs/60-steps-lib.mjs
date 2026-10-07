// Doing what each tour and lesson step asks, the way a learner would, and one test per step.
import {
  LESSONS, TOURS, snippets, hintSnippets, decode, defaultWaitText, popup, htmlText, spotCheck,
  cmd, settle, runF5, editReplace, editAppend, editInsertBefore, gutterClick, clickWorld, clickExact,
} from './60-learn-lib.mjs';

/** True once the current step's check has passed (or the tour moved on) */
const doneExpr = (i) => `(!LG.Tours.active || LG.Tours.active.i !== ${i} || !!document.querySelector('.tour-pop .wait.done'))`;

async function stopIfBusy(p) {
  if (await p.ev('LG.app.isBusy()')) { await p.key('F5', { shift: true }); await settle(p, { timeout: 5000 }); }
}

// ---- the tours ------------------------------------------------------------------------------------------
export const TOUR_SOLVE = {
  'welcome:3': (p) => cmd(p, 'repeat 4 [fd 100 rt 90]'),
  'first:1': async (p) => { await p.click('#editors .ed-ta'); await p.insertText('to square\n  repeat 4 [forward 100 right 90]\nend\n'); },
  'first:2': (p) => runF5(p),
  'first:3': (p) => cmd(p, 'square'),
  'first:4': async (p) => {
    await editReplace(p, 'to square', 'to square :size');
    await editReplace(p, 'forward 100', 'forward :size');
    await editAppend(p, 'square 50 square 150');
    await runF5(p);
  },
  'debug:1': (p) => gutterClick(p, 2),
  'debug:2': (p) => runF5(p),
  'debug:4': (p) => runF5(p),
  'turtle:1': (p) => cmd(p, 'setpc "red fd 100'),
  'turtle:2': (p) => cmd(p, 'filled "yellow [repeat 5 [fd 100 rt 144]]'),
};

// ---- the lessons: steps that need more than the generic rules ---------------------------------------------
const BACKWARDS = 'to backwards :w\n  if emptyp :w [output "]\n  output word last :w backwards butlast :w\nend';
const OV = {
  'repeat-squares:6': (p) => editReplace(p, 'repeat 4 [fd 100 rt 90]', 'repeat 4 [fd 150 rt 90]'),
  'words-building:5': async (p) => {
    await editInsertBefore(p, 'cs\nhouse 100', 'to street\n  repeat 4 [house 60 pu rt 90 fd 80 lt 90 pd]\nend\n\n');
    await editReplace(p, 'cs\nhouse 100', 'cs\nstreet');
  },
  'color-label:6': (p) => cmd(p, 'setlabelheight 50 setpc "blue label "Maya'),
  'words-workspace:6': async (p) => { await cmd(p, 'to zigzag'); await cmd(p, 'repeat 4 [fd 30 rt 90 fd 30 lt 90]'); await cmd(p, 'end'); },
  'color-pen:8': async (p) => { await editReplace(p, 'setpencolor repcount', 'setpencolor [0 200 255]'); await editReplace(p, 'setbackground "black', 'setbackground 1'); },
  'math-random:7': (p) => editReplace(p, 'repeat 4 [fd 10 + random 50 rt 90]', 'repeat 5 [fd 20 + random 50 rt 144]'),
  'var-counters:6': async (p) => { await editReplace(p, 'make "len 5', 'make "len 300'); await editReplace(p, 'make "len :len + 5', 'make "len :len - 5'); },
  'if-logic:7': (p) => editReplace(p, 'ifelse and (abs :x) < 100 (abs :y) < 100 [setpc "red] [setpc "grey]', 'ifelse not and (abs :x) < 100 (abs :y) < 100 [setpc "red] [setpc "grey]'),
  'words-letters:7': async (p) => {
    await editAppend(p, 'to unshift :letter\n  output char (ascii :letter) - 1\nend\n\nprint (word unshift "i unshift "c unshift "n)');
    await runF5(p);
  },
  'words-recursion:7': async (p) => {
    await editAppend(p, BACKWARDS + '\n\nto palindromep :w\n  output :w = backwards :w\nend');
    await runF5(p);
  },
  'lists-making:7': (p) => editInsertBefore(p, 'print :pets', 'make "pets lput "hamster :pets\n'),
  'recursion-spiral:4': (p) => editReplace(p, 'right 90', 'right 91'),
  'talk-quiz:6': async (p) => {
    await editInsertBefore(p, '  print (sentence [You got]', '  question [What is the capital of France?] "Paris\n');
    await editReplace(p, 'out of 3.', 'out of 4.');
  },
  'talk-keys:2': async (p, x) => {
    await runF5(p, { wait: false });
    await p.waitState('input', 5000);
    await clickWorld(p);
    for (let i = 0; i < 3; i++) { await p.key('ArrowUp'); await p.sleep(120); }
    await p.wait(x.done, 5000);
  },
  'talk-keys:3': async (p) => { await clickWorld(p); await p.key('q'); await settle(p); },
  'talk-keys:5': async (p, x) => {
    await runF5(p, { wait: false });
    await clickWorld(p);
    await p.key('ArrowLeft');
    await p.wait(x.done, 15000);
    await stopIfBusy(p);
  },
  'talk-keys:7': (p) => editReplace(p, '  if :key = "RIGHT [right 30]\n', '  if :key = "RIGHT [right 30]\n  if :key = "c [setpencolor random 16]\n'),
  'talk-mouse-timers:1': async (p, x) => {
    await runF5(p, { wait: false });
    const r = await p.rect('#worldCanvas');
    for (let i = 0; i < 6 && !(await p.ev(x.done)); i++) { await p.mouse('mouseMoved', r.x + r.w * 0.8, r.y + r.h * (i % 2 ? 0.2 : 0.8)); await p.sleep(700); }
    await p.wait(x.done, 8000);
    await stopIfBusy(p);
  },
  'talk-mouse-timers:3': async (p, x) => {
    await clickWorld(p, -100, -60); await p.sleep(150);
    await clickWorld(p, 120, -40); await p.sleep(150);
    await clickWorld(p, 60, 80); await p.sleep(150);
    await p.wait(x.done, 5000);
  },
  'data-plists:6': async (p) => { await editReplace(p, '[snake 0 hiss]]', '[snake 0 hiss] [cat 4 meow]]'); await editAppend(p, 'describe "cat'); },
  'capstone-catcher:4': (p) => editReplace(p, '  if :key = "RIGHT [setx xcor + 40]\nend', '  if :key = "RIGHT [setx xcor + 40]\n  if xcor < -360 [setx -360]\n  if xcor > 360 [setx 360]\nend'),
  'capstone-star:4': (p) => editReplace(p, 'make "speed 3', 'make "speed 6'),
  'capstone-score:4': (p) => editReplace(p, 'make "lives 3', 'make "lives 5'),
};

/** Do what lesson step j asks, deriving the action from its check and its own text */
export async function solveLessonStep(p, idx, j) {
  const l = LESSONS[idx];
  const s = l.steps[j];
  const c = s.check;
  const key = l.id + ':' + (j + 1);
  const x = { done: doneExpr(j) };
  if (OV[key]) return OV[key](p, x);
  const tc = snippets(s.text);
  const hc = hintSnippets(s.hint);
  const all = [...tc, ...hc];
  const content = (why) => new Error(`content problem in ${key}: ${why}`);
  if (c.run) return runF5(p);
  if (c.command) {
    const re = new RegExp(c.command, 'i');
    const m = all.filter((v) => re.test(v));
    if (!m.length) throw content(`nothing the step suggests matches /${c.command}/`);
    if (/Press <kbd>F5<\/kbd>, then/.test(s.text)) await runF5(p);
    return cmd(p, m[0], { until: x.done });
  }
  if (c.codeHas) {
    const re = new RegExp(c.codeHas, 'i');
    const ch = /Change <code>([^<]+)<\/code>(?: inside \w+| in \w+)? to <code>([^<]+)<\/code>/.exec(s.text);
    if (ch) return editReplace(p, decode(ch[1]), decode(ch[2]));
    const m = all.find((v) => re.test(v));
    if (!m) throw content(`no suggested code matches /${c.codeHas}/`);
    return editAppend(p, m);
  }
  if (c.defined) {
    const def = all.find((v) => /^\s*to\s/i.test(v));
    if (!def) throw content('no procedure to copy');
    await editAppend(p, def);
    return runF5(p);
  }
  // output, drawn, variable: run the program, or type what the step suggests until it is satisfied
  const runFirst = s.code !== undefined || /^Press <kbd>F5/.test(s.text) || (!tc.length && /\b(F5|Run it|Run this|run it)\b/.test(s.text));
  if (runFirst) {
    await runF5(p, { until: x.done });
  } else {
    if (!all.length) throw content('nothing to type');
    for (const v of all) {
      if (await p.ev(x.done)) break;
      await cmd(p, v, { until: x.done });
      try { await p.wait(x.done, 700); } catch (e) { /* try the next suggestion */ }
    }
  }
  await p.wait(x.done, 8000).catch(() => { throw content('doing everything the step suggests does not satisfy ' + JSON.stringify(c)); });
  if (c.drawn) await stopIfBusy(p);
}

// ---- moving through a lesson ------------------------------------------------------------------------------
export function lessonSteps(idx) {
  const l = LESSONS[idx];
  if (!l.tour) return l.steps;
  return TOURS[l.tour].steps.map((s) => ({ title: s.title, text: s.text, sel: s.sel, tourWait: !!s.wait, waitText: s.waitText }));
}

async function solveAny(p, idx, j) {
  const l = LESSONS[idx];
  if (l.tour) {
    const f = TOUR_SOLVE[l.tour + ':' + j];
    if (!f) throw new Error('no way to do ' + l.tour + ' step ' + j);
    return f(p);
  }
  return solveLessonStep(p, idx, j);
}

export async function startLesson(p, idx) {
  await p.ev(`LG.Lessons.start(LG.app, ${idx})`);
  await p.wait(`LG.Tours.active && LG.Tours.active.tour.label === 'Lesson ${idx + 1}' && LG.Tours.active.i === 0 && !!document.querySelector('.tour-pop h3')`, 5000);
  await p.sleep(100);
}

/** Wait for the tour to move from step j to the next one by itself */
async function waitAdvance(p, idx, j) {
  await p.wait(`LG.Tours.active && LG.Tours.active.tour.label === 'Lesson ${idx + 1}' && LG.Tours.active.i === ${j + 1}`, 6000);
  await p.sleep(80);
}

/** Get through step j as quickly as a learner who knows the answers */
async function passStep(p, idx, j) {
  const s = lessonSteps(idx)[j];
  if (s.quiz) {
    await clickExact(p, '.tour-pop .txt + div > button', await htmlText(p, s.quiz.options[s.quiz.answer]));
    await p.click('#tourNext');
  } else if (s.check || s.tourWait) {
    await solveAny(p, idx, j);
    await waitAdvance(p, idx, j);
    return;
  } else {
    await p.click('#tourNext');
  }
  await waitAdvance(p, idx, j);
}

/** Make sure lesson idx is showing step j, replaying the earlier steps from a fresh page if needed */
export async function ensureAt(p, idx, j) {
  const cur = await p.ev("LG.Tours.active ? [LG.Tours.active.tour.label, LG.Tours.active.i] : null");
  if (cur && cur[0] === 'Lesson ' + (idx + 1) && cur[1] === j) return;
  await p.fresh();
  await startLesson(p, idx);
  for (let k = 0; k < j; k++) await passStep(p, idx, k);
}

/** One test per step of lesson idx */
export function lessonTests(t, idx) {
  const l = LESSONS[idx];
  const steps = lessonSteps(idx);
  const n = steps.length;
  steps.forEach((s, j) => {
    const last = j === n - 1;
    t.test(`lesson ${idx + 1} (${l.id}) step ${j + 1}/${n}: ${s.title}`, async (p) => {
      const A = p.assert;
      await ensureAt(p, idx, j);
      const pp = await popup(p);
      A.equal(pp.step, `Lesson ${idx + 1} · ${j + 1} of ${n}`);
      A.equal(pp.title, s.title);
      A.equal(pp.tour, l.tour ? TOURS[l.tour].title : l.title);
      A.equal(pp.backDisabled, j === 0, 'Back is disabled only on the first step');
      await spotCheck(p, s.sel);
      if (s.code !== undefined) {
        A.equal(await p.activePath(), '/lessons/' + l.id + '.lgo');
        A.equal(await p.code(), s.code);
        A.ok(await p.ev("!!document.querySelector('#editorTabs .etab.active .lock')"), 'the lesson tab is marked as an original');
        A.ok(await p.ev('LG.app.isProtected(LG.app.active.path)'));
      }
      if (s.tab) A.ok(await p.ev(`document.getElementById('itab-${s.tab}').classList.contains('active') || document.getElementById('itab-${s.tab}').getAttribute('aria-selected') === 'true'`), 'inspector tab ' + s.tab);
      if (s.hint) {
        A.equal(await p.visible('.tour-pop .txt.muted'), false, 'the hint starts hidden');
        await p.click('.tour-pop .acts button', 'Hint');
        A.ok(await p.visible('.tour-pop .txt.muted'), 'Hint shows the hint');
        A.equal(await p.ev("document.querySelector('.tour-pop .txt.muted').textContent").then((v) => v.replace(/\s+/g, '')), ('Hint: ' + await htmlText(p, s.hint)).replace(/\s+/g, ''));
      }
      if (s.quiz) {
        A.equal(pp.txt, await htmlText(p, s.quiz.q));
        const opts = [];
        for (const o of s.quiz.options) opts.push(await htmlText(p, o));
        A.deepEqual(pp.quiz, opts);
        A.equal(pp.nextDisabled, true, 'Next waits for the right answer');
        for (let k = 0; k < opts.length; k++) {
          if (k === s.quiz.answer) continue;
          await clickExact(p, '.tour-pop .txt + div > button', opts[k]);
          A.match(await p.text('.tour-pop p'), /^Not quite\./);
          A.equal(await p.ev("document.getElementById('tourNext').disabled"), true, 'a wrong answer keeps Next disabled');
        }
        await clickExact(p, '.tour-pop .txt + div > button', opts[s.quiz.answer]);
        A.match(await p.text('.tour-pop p'), /^Yes!/);
        A.equal(await p.ev("document.getElementById('tourNext').disabled"), false, 'the right answer enables Next');
      } else {
        A.equal(pp.txt.replace(/\s+/g, ' '), (await htmlText(p, s.text)).replace(/\s+/g, ' '));
      }
      if (s.check || s.tourWait) {
        A.equal(pp.wait, s.waitText || defaultWaitText(s.check));
        A.equal(pp.done, false);
        A.equal(pp.next, last ? 'Finish' : 'Skip');
        await p.ev(`(window.__done = [], LG.Tours.active.tour.onStepDone = (a, st) => window.__done.push(st.i))`);
        await solveAny(p, idx, j);
        await p.wait(`window.__done.includes(${j})`, 8000);
        const now = await popup(p);
        if (now.i === j) { A.equal(now.wait, 'Done!'); A.equal(now.done, true); }
        if (!last) await waitAdvance(p, idx, j);
        return;
      }
      if (!last) {
        A.equal(pp.next, 'Next');
        await p.click('#tourNext');
        await waitAdvance(p, idx, j);
        return;
      }
      // the last step: finishing marks the lesson done and goes on to the next one
      const nextL = LESSONS[idx + 1];
      A.equal(await p.text('#tourNext'), nextL ? 'Done. Next lesson' : 'Done');
      await p.click('#tourNext');
      await p.wait(`(JSON.parse(localStorage.getItem('lohgo.lessonsDone') || '[]') || []).includes(${JSON.stringify(l.id)}) || LG.Lessons.done().has(${JSON.stringify(l.id)})`, 3000);
      if (nextL) {
        await p.wait(`LG.Tours.active && LG.Tours.active.tour.label === 'Lesson ${idx + 2}' && LG.Tours.active.i === 0`, 4000);
        const np = await popup(p);
        A.equal(np.step, `Lesson ${idx + 2} · 1 of ${lessonSteps(idx + 1).length}`);
      } else {
        await p.waitToast(/finished every lesson/);
        A.equal(await p.exists('.tour-pop'), false);
      }
    }, { timeout: 240000 });
  });
}
