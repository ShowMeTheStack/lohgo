// Guided tours and the step engine that lessons use: spotlight a part of the screen, explain
// it, and (for hands-on steps) wait until the learner has done the thing.
(function (LG) {
  'use strict';
  const { h } = LG.UI;
  const esc = LG.escapeHtml;
  const code = (s) => '<pre>' + esc(s) + '</pre>';

  /** Put text in a program of the learner's own (in /projects/tour) and open it */
  function scratch(app, name, text) {
    const dir = '/projects/tour';
    app.vfs.mkdir(dir, { parents: true, exist: true, trusted: true });
    const p = dir + '/' + name;
    app.vfs.writeText(p, text, { trusted: true });
    const d = app.docByPath(p);
    if (d) { d.editor.setValue(text); d.savedText = text; d.dirty = false; }
    app.openFile(p);
    return p;
  }
  const ed = (app) => app.active && app.active.editor;
  const ranSince = (app, c) => (app.runCount || 0) > c.runs && app.interp.state === 'idle';
  const typed = (app, c, re) => (app.commandLog || []).slice(c.cmds).some((t) => re.test(t));

  const TOURS = {
    welcome: {
      title: 'Welcome to Lohgo',
      steps: [
        { title: 'Welcome!', text: 'Lohgo is a place to program in <b>Logo</b>, the language with the turtle. You give the turtle commands and it draws. Let\'s take a one-minute look around.' },
        { sel: '#worldCard', title: 'The turtle world', text: 'This is where the turtle lives. Whatever it draws appears here. The readout in the corner says where the turtle is and which way it faces.' },
        { sel: '#cmdCard', title: 'The command center', text: 'Type a command here and press <kbd>Enter</kbd>, and the turtle does it straight away. Try <code>fd 100</code> (forward 100 steps) or <code>rt 90</code> (turn right).' },
        { sel: '#cmdInputBox', title: 'Try it now', text: 'Type ' + '<code>repeat 4 [fd 100 rt 90]</code>' + ' and press Enter.', wait: (app, c) => typed(app, c, /repeat/i), waitText: 'Waiting for a REPEAT command…' },
        { sel: '#editorCard', title: 'The editor', text: 'Longer programs go here. You teach the turtle new words with <code>to</code> … <code>end</code>, and the words you made work just like the built-in ones.' },
        { sel: '#tbRun', title: 'Run', text: 'This button (or <kbd>F5</kbd>) runs the program in the editor. Step, Over and Out let you go through it one instruction at a time.' },
        { sel: '#speed', title: 'Turtle speed', text: 'Slide this to the left to watch the turtle walk, and further left to see every instruction light up in the editor as it runs.' },
        { sel: '#inspCard', title: 'Inside your program', text: 'When a program pauses, these tabs show its variables, which procedures are running (even when one calls itself), and what just happened.' },
        { sel: '#rail', title: 'Programs, lessons and help', text: 'Your files, the procedures you have defined, a library of hundreds of programs, step-by-step lessons, tours and the language reference all live here.' },
        { title: 'Have fun!', text: 'A good next step is <b>Learn</b>: lessons that start from the very first command. Or open <b>Library</b> and run something, then change it.' },
      ],
    },
    first: {
      title: 'Your first program',
      steps: [
        { title: 'A program of your own', text: 'Let\'s write a program. I made you a new empty file called <b>first.lgo</b>.', action: (app) => scratch(app, 'first.lgo', '') },
        { sel: '#editorCard', title: 'Teach the turtle a word', text: 'Type this in the editor:' + code('to square\n  repeat 4 [forward 100 right 90]\nend'), wait: (app) => /to\s+square[\s\S]*end/i.test(ed(app) ? ed(app).getValue() : ''), waitText: 'Waiting for TO SQUARE … END…' },
        { sel: '#tbRun', title: 'Run it', text: 'Press <kbd>F5</kbd> or the Run button. Nothing is drawn yet: the program only <i>teaches</i> the word.', wait: (app, c) => ranSince(app, c), waitText: 'Waiting for you to run it…' },
        { sel: '#cmdInputBox', title: 'Use your word', text: 'Now type <code>square</code> in the command center and press Enter.', wait: (app, c) => typed(app, c, /\bsquare\b/i), waitText: 'Waiting for SQUARE…' },
        { sel: '#editorCard', title: 'Words that take inputs', text: 'Change the first line to <code>to square :size</code> and the 100 to <code>:size</code>. Then add a last line <code>square 50 square 150</code> and run it again.', wait: (app, c) => /:size/i.test(ed(app) ? ed(app).getValue() : '') && ranSince(app, c), waitText: 'Waiting for a square with a :size…' },
        { sel: '#worldCard', title: 'That is programming', text: 'You made a new word, gave it an input, and used it. Everything in Logo is built like that, one small word at a time.' },
      ],
    },
    debug: {
      title: 'The debugger',
      steps: [
        { title: 'Watching a program think', text: 'The debugger lets you stop a program in the middle and look inside. Here is a short recursive program to try it on.', action: (app) => scratch(app, 'countdown.lgo', 'to countdown :n\n  if :n = 0 [print "Liftoff! stop]\n  print :n\n  countdown :n - 1\nend\n\ncountdown 5\n') },
        { sel: '#editors .ed-gutter', title: 'Set a breakpoint', text: 'Click in the margin next to line 3, <code>print :n</code>. A red dot appears: the program will stop there.', wait: (app) => { const m = app.breakpoints.get(app.active && app.active.path); return !!(m && m.size); }, waitText: 'Waiting for a breakpoint…' },
        { sel: '#tbRun', title: 'Run to the breakpoint', text: 'Press <kbd>F5</kbd>. The program stops before that line and the line lights up.', wait: (app) => app.interp.state === 'paused', waitText: 'Waiting for the program to stop…' },
        { sel: '#inspCard', title: 'Variables', text: 'The Variables tab shows <code>:n</code>. Click its value and type a different number, like 2, then press Enter. You just changed the program while it runs.' },
        { sel: '#tbRun', title: 'Continue', text: 'Press <kbd>F5</kbd> a few times. Each time the program stops again with a smaller <code>:n</code>.', wait: (app, c) => (app.interp.count > (c.count || 0)) && app.interp.state === 'paused', waitText: 'Waiting for you to continue…', enter: (app, c) => { c.count = app.interp.count; } },
        { sel: '#itab-stack', title: 'The call stack', text: 'Open <b>Call Stack</b>. Every COUNTDOWN that is still waiting for the next one to finish is listed. Click an older one to see its own <code>:n</code>.' },
        { sel: '#debugGroup', title: 'Step by step', text: '<b>Step</b> (<kbd>F11</kbd>) runs one instruction, <b>Over</b> (<kbd>F10</kbd>) runs a whole line, <b>Out</b> finishes the current procedure. <b>Stop</b> ends the program.' },
      ],
    },
    turtle: {
      title: 'Turtle graphics',
      steps: [
        { sel: '#worldCard', title: 'The turtle', text: 'The turtle has a position, a heading and a pen. <code>fd</code> and <code>bk</code> move it, <code>rt</code> and <code>lt</code> turn it, <code>pu</code> and <code>pd</code> lift and lower the pen.' },
        { sel: '#cmdInputBox', title: 'Colours', text: 'Try <code>setpc "red fd 100</code>. Colours can be names, numbers 0 to 15, or a list of red, green and blue like <code>[255 128 0]</code>.', wait: (app, c) => typed(app, c, /setpc|setpencolor/i), waitText: 'Waiting for SETPC…' },
        { sel: '#cmdInputBox', title: 'Shapes that fill', text: 'Try <code>filled "yellow [repeat 5 [fd 100 rt 144]]</code> for a filled star.', wait: (app, c) => typed(app, c, /filled/i), waitText: 'Waiting for FILLED…' },
        { sel: '#tbGrid', title: 'Graph paper', text: 'This button puts graph paper behind the drawing: the thick lines are every 100 steps, and the centre is 0, 0.' },
        { sel: '#speed', title: 'Slow motion', text: 'Move the speed slider left (on a phone: More, then Turtle speed) and type <code>repeat 6 [fd 80 rt 60]</code> to watch the turtle walk.' },
        { sel: '#tbSnap', title: 'Keep your picture', text: 'This saves the drawing as a picture you can keep or print. <code>cs</code> (clearscreen) starts again.' },
      ],
    },
    files: {
      title: 'Files and sharing',
      steps: [
        { sel: '#railFiles', title: 'Your files', text: 'Your programs live in <b>/projects</b>, saved in this browser. <b>/examples</b> holds the examples: you can change and run them, and saving makes a copy of your own.', action: (app) => { if (app.side !== 'files') app.toggleSide('files'); } },
        { sel: '#sideTools', title: 'New, import, folders', text: 'Make new programs and folders, bring files in from your computer, or use a real folder on your computer (in Chrome and Edge).' },
        { sel: '#tbShare', title: 'Share', text: 'Share turns a program into a link. Whoever opens it gets their own copy; nothing is uploaded anywhere because the program travels inside the link.' },
        { title: 'Files from programs', text: 'Programs can read and write files too: <code>openwrite</code>, <code>setwrite</code>, <code>print</code>, <code>close</code>, then <code>openread</code> and <code>readlist</code>. Try the <b>diary</b> example.' },
      ],
    },
  };

  const Tours = LG.Tours = {
    TOURS,
    scratch,
    menu(app) {
      const items = Object.entries(TOURS).map(([id, t]) => ({ label: t.title, action: () => Tours.start(app, id) }));
      items.push({ sep: true }, { label: 'All the lessons…', action: () => LG.Lessons && LG.Lessons.browse(app) });
      const btn = document.getElementById('railTours') || document.getElementById('menuBtn');
      const r = btn.getBoundingClientRect();
      LG.UI.showMenu(items, r.right + 6, r.top);
    },
    start(app, id, opts) {
      Tours.stop();
      const tour = typeof id === 'object' ? id : TOURS[id];
      if (!tour) return;
      const spot = h('div.tour-spot');
      const pop = h('div.tour-pop', { role: 'dialog', 'aria-live': 'polite', 'aria-label': tour.title });
      document.body.append(spot, pop);
      const st = { app, id, tour, i: (opts && opts.at) || 0, spot, pop, timer: null, ctx: {} };
      Tours.active = st;
      st.onResize = () => Tours.place(st);
      window.addEventListener('resize', st.onResize);
      Tours.show(st);
    },
    stop() {
      const st = Tours.active;
      if (!st) return;
      clearInterval(st.timer);
      st.spot.remove(); st.pop.remove();
      window.removeEventListener('resize', st.onResize);
      Tours.active = null;
      if (st.tour.onStop) st.tour.onStop(st.app);
    },
    next() { const st = Tours.active; if (st && st.i < st.tour.steps.length - 1) { st.i++; Tours.show(st); } },
    async show(st) {
      const app = st.app;
      const step = st.tour.steps[st.i];
      clearInterval(st.timer);
      st.ctx = { runs: app.runCount || 0, cmds: (app.commandLog || []).length, out: app.outputLen || 0 };
      if (step.action) { try { await step.action(app, st.ctx); } catch (e) { console.error(e); } }
      if (step.enter) { try { step.enter(app, st.ctx); } catch (e) { console.error(e); } }
      if (app.isPhone() && step.sel) {
        const s = step.sel;
        if (/editor|gutter|tbRun|tbShare/.test(s)) app.setView(/tbRun/.test(s) ? app.view : 'code');
        else if (/world|cmd|tbGrid|tbSnap/.test(s)) app.setView('turtle');
        else if (/insp|itab/.test(s)) app.setView('debug');
        else if (/railFiles|side/.test(s)) app.setView('files');
      }
      const pop = st.pop;
      pop.innerHTML = '';
      const last = st.i === st.tour.steps.length - 1;
      const next = h('button.btn.primary', { type: 'button', id: 'tourNext' }, last ? (st.tour.finishLabel || 'Finish') : 'Next');
      const back = h('button.btn', { type: 'button', id: 'tourBack', disabled: st.i === 0 }, 'Back');
      const close = h('button.btn', { type: 'button', id: 'tourClose' }, 'Close');
      next.addEventListener('click', () => { if (last) { Tours.stop(); if (st.tour.onFinish) st.tour.onFinish(app); } else { st.i++; Tours.show(st); } });
      back.addEventListener('click', () => { if (st.i > 0) { st.i--; Tours.show(st); } });
      close.addEventListener('click', () => Tours.stop());
      const parts = [h('div.step', (st.tour.label || st.tour.title) + ' · ' + (st.i + 1) + ' of ' + st.tour.steps.length), h('h3', step.title)];
      if (step.quiz) {
        const qz = step.quiz;
        const fb = h('p', { style: { fontWeight: '600', margin: '6px 0 0' }, 'aria-live': 'polite' });
        const opts = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' } });
        qz.options.forEach((o, i) => {
          const b = h('button.btn', { type: 'button', style: { textAlign: 'left', height: 'auto', padding: '7px 14px', borderRadius: '12px' } }, h('span', { html: o }));
          b.addEventListener('click', () => {
            const ok = i === qz.answer;
            fb.textContent = (ok ? 'Yes! ' : 'Not quite. ') + (qz.explain || '');
            fb.style.color = ok ? 'var(--accent)' : 'var(--err)';
            if (ok) { next.disabled = false; next.focus(); if (st.tour.onQuiz) st.tour.onQuiz(app, st); }
          });
          opts.appendChild(b);
        });
        parts.push(h('div.txt', { html: qz.q }), opts, fb);
        next.disabled = true;
      } else {
        parts.push(h('div.txt', { html: step.text }));
      }
      let hintEl = null;
      if (step.hint) { hintEl = h('div.txt.muted', { hidden: true, style: { marginTop: '6px' }, html: 'Hint: ' + step.hint }); parts.push(hintEl); }
      let waitEl = null;
      if (step.wait) { waitEl = h('div.wait', step.waitText || 'Waiting for you…'); parts.push(waitEl); }
      const acts = h('div.acts', step.hint ? h('button.btn', { type: 'button', onclick: () => { hintEl.hidden = false; Tours.place(st); } }, 'Hint') : null, close, back, next);
      parts.push(acts);
      pop.append(...parts);
      if (step.wait) {
        next.textContent = last ? 'Finish' : 'Skip';
        st.timer = setInterval(() => {
          let ok = false;
          try { ok = step.wait(app, st.ctx); } catch (e) { ok = false; }
          if (!ok) return;
          clearInterval(st.timer);
          waitEl.textContent = 'Done!';
          waitEl.classList.add('done');
          next.textContent = last ? (st.tour.finishLabel || 'Finish') : 'Next';
          if (st.tour.onStepDone) st.tour.onStepDone(app, st);
          const ae = document.activeElement;
          if (!ae || ae === document.body || pop.contains(ae)) next.focus();
          if (!last) setTimeout(() => { if (Tours.active === st && st.tour.steps[st.i] === step) { st.i++; Tours.show(st); } }, 1100);
        }, 250);
      }
      Tours.place(st);
      setTimeout(() => Tours.place(st), 260);
    },
    place(st) {
      const step = st.tour.steps[st.i];
      let el = null;
      if (step.sel) {
        // phones have no rail: point at the tab bar instead
        const phoneSel = st.app.isPhone() && { '#railFiles': '#mtab-files', '#rail': '#mbar', '#debugGroup': '#mtab-more' }[step.sel];
        const all = [...document.querySelectorAll(phoneSel || step.sel)];
        el = all.find((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) || null;
      }
      const pop = st.pop;
      const pw = pop.offsetWidth, ph = pop.offsetHeight;
      const W = window.innerWidth, H = window.innerHeight;
      if (!el) {
        st.spot.style.cssText = `left:${W / 2}px;top:${H / 2}px;width:0;height:0;box-shadow:0 0 0 9999px rgba(30,24,14,.28)`;
        pop.style.left = Math.max(10, (W - pw) / 2) + 'px';
        pop.style.top = Math.max(10, (H - ph) / 2) + 'px';
        return;
      }
      const r = el.getBoundingClientRect();
      const pad = 5;
      st.spot.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
      let x, y;
      if (r.bottom + ph + 18 < H) { y = r.bottom + 14; x = r.left + r.width / 2 - pw / 2; }
      else if (r.top - ph - 18 > 0) { y = r.top - ph - 14; x = r.left + r.width / 2 - pw / 2; }
      else if (r.right + pw + 18 < W) { x = r.right + 14; y = r.top + r.height / 2 - ph / 2; }
      else if (r.left - pw - 18 > 0) { x = r.left - pw - 14; y = r.top + r.height / 2 - ph / 2; }
      else { x = (W - pw) / 2; y = H - ph - 12; }
      pop.style.left = Math.max(10, Math.min(W - pw - 10, x)) + 'px';
      pop.style.top = Math.max(10, Math.min(H - ph - 10, y)) + 'px';
    },
  };
})(LG);
