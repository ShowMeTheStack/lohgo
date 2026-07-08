// The Logo course: lessons are guided steps on top of the tour engine, with live checks
// and short quizzes. Progress is remembered in the browser.
(function (LG) {
  'use strict';
  const { h } = LG.UI;
  const store = LG.UI.storage;

  const fileFor = (l) => '/lessons/' + l.id + '.lgo';

  function loadCode(app, lesson, code) {
    const vfs = app.vfs;
    vfs.mkdir('/lessons', { exist: true, trusted: true, readOnly: true });
    const p = fileFor(lesson);
    vfs.writeText(p, code, { trusted: true, readOnly: true });
    const d = app.docByPath(p);
    if (d) { d.editor.setValue(code); d.savedText = code; d.dirty = false; app.renderTabs(); }
    app.openFile(p);
  }

  /**
   * Checks a step can wait for:
   *   {run: true}            the program in the editor ran and finished
   *   {command: 'regex'}     something matching was typed in the command center
   *   {codeHas: 'regex'}     the editor contains it
   *   {output: 'regex'}      the program or a command printed it (since the step began)
   *   {drawn: n}             the turtle drew at least n lines since the step began
   *   {defined: 'name'}      a procedure with that name exists
   *   {paused: true}         the program is paused in the debugger
   *   {breakpoint: true}     there is a breakpoint in the lesson file
   *   {variable: 'name', value: 'regex'}  a global variable has a matching value
   */
  function makeWait(c, lesson) {
    if (c.run) return [(a, x) => (a.runCount || 0) > x.runs && a.interp.state === 'idle', 'Waiting for you to run the program (F5)…'];
    if (c.command) { const re = new RegExp(c.command, 'i'); return [(a, x) => (a.commandLog || []).slice(x.cmds).some((t) => re.test(t)) && !a.isBusy(), 'Waiting for your command…']; }
    if (c.codeHas) { const re = new RegExp(c.codeHas, 'i'); return [(a) => !!a.active && re.test(a.active.editor.getValue()), 'Waiting for your change to the program…']; }
    if (c.output) { const re = new RegExp(c.output, 'i'); return [(a, x) => { const n = (a.outputLen || 0) - x.out; return n > 0 && re.test((a.outputTail || '').slice(-n)) && !a.isBusy(); }, 'Waiting for the right output…']; }
    if (c.drawn) return [(a, x) => (a.world.drawnTotal || 0) - (x.drawn0 || 0) >= c.drawn, 'Waiting for the turtle to draw…'];
    if (c.defined) { const k = String(c.defined).toLowerCase(); return [(a) => a.interp.procs.has(k), 'Waiting for ' + c.defined.toUpperCase() + ' to be defined…']; }
    if (c.paused) return [(a) => a.interp.state === 'paused', 'Waiting for the program to pause…'];
    if (c.breakpoint) return [(a) => { const b = a.breakpoints.get(fileFor(lesson)); return !!(b && b.size); }, 'Waiting for a breakpoint…'];
    if (c.variable) { const re = new RegExp(c.value || '.', 'i'); const k = c.variable.toLowerCase(); return [(a) => { const v = a.interp.globals.get(k); return v !== undefined && re.test(LG.Data.showText(v)); }, 'Waiting for :' + c.variable + '…']; }
    return [null, ''];
  }

  function toTour(app, lesson, idx) {
    const L = LG.LESSONS;
    const steps = lesson.steps.map((s) => {
      const st = { title: s.title, text: s.text, sel: s.sel, hint: s.hint, quiz: s.quiz };
      st.action = (a) => {
        if (s.code !== undefined) loadCode(a, lesson, s.code);
        else if (!a.docByPath(fileFor(lesson)) && a.vfs.exists(fileFor(lesson))) a.openFile(fileFor(lesson), { noFocus: true });
        if (s.tab) a.inspector.show(s.tab);
      };
      st.enter = (a, x) => { x.seg = a.world.segments; x.drawn0 = a.world.drawnTotal || 0; };
      if (s.check) { const [w, t] = makeWait(s.check, lesson); if (w) { st.wait = w; st.waitText = s.waitText || t; } }
      return st;
    });
    const next = L[idx + 1];
    return {
      title: lesson.title,
      label: 'Lesson ' + (idx + 1),
      steps,
      finishLabel: next ? 'Done. Next lesson' : 'Done',
      onFinish: (a) => {
        Lessons.complete(lesson.id);
        if (next) setTimeout(() => Lessons.start(a, idx + 1), 300);
        else LG.UI.toast('You finished every lesson. Well done!', 'ok', 6000);
      },
    };
  }

  const Lessons = LG.Lessons = {
    fileFor,
    done() { return new Set(store.get('lessonsDone', [])); },
    complete(id) { const d = Lessons.done(); d.add(id); store.set('lessonsDone', [...d]); store.set('lessonLast', id); },
    startById(app, id) { const i = (LG.LESSONS || []).findIndex((l) => l.id === id); if (i >= 0) Lessons.start(app, i); },
    start(app, idx) {
      const L = LG.LESSONS || [];
      const lesson = L[idx];
      if (!lesson) return;
      store.set('lessonLast', lesson.id);
      // a program left paused (say by the debugger lesson) would make F5 continue it instead of running the lesson
      if (app.interp.state === 'paused' || app.isBusy()) app.stop();
      if (lesson.tour) {
        const base = LG.Tours.TOURS[lesson.tour];
        const next = L[idx + 1];
        LG.Tours.start(app, Object.assign({}, base, {
          label: 'Lesson ' + (idx + 1),
          finishLabel: next ? 'Done. Next lesson' : 'Done',
          onFinish: (a) => { Lessons.complete(lesson.id); if (next) setTimeout(() => Lessons.start(a, idx + 1), 300); },
        }));
        return;
      }
      LG.Tours.start(app, toTour(app, lesson, idx));
    },
    async browse(app) {
      LG.Tours.stop();
      const L = LG.LESSONS || [];
      const done = Lessons.done();
      const units = [];
      for (const l of L) if (!units.includes(l.unit)) units.push(l.unit);
      let unit = null;
      const lastId = store.get('lessonLast', null);
      const lastIdx = L.findIndex((l) => l.id === lastId);
      unit = lastIdx >= 0 ? L[lastIdx].unit : units[0];
      const nav = h('div.sheet-nav');
      const main = h('div.sheet-main', { id: 'learnMain' });
      let closeFn = () => {};
      const render = () => {
        nav.innerHTML = '';
        const pct = L.length ? Math.round(done.size / L.length * 100) : 0;
        nav.appendChild(h('div', { style: { padding: '6px 10px 10px', fontSize: '12.5px', color: 'var(--ink-2)' } }, h('b', pct + '%'), ' done · ' + done.size + ' of ' + L.length));
        for (const u of units) {
          const ls = L.filter((l) => l.unit === u);
          const n = ls.filter((l) => done.has(l.id)).length;
          const it = h('div.nav-item' + (u === unit ? '.active' : ''), { role: 'button', tabindex: '0' }, h('span', u), h('span.n', n + '/' + ls.length));
          it.addEventListener('click', () => { unit = u; render(); });
          nav.appendChild(it);
        }
        main.innerHTML = '';
        const box = h('div.lesson-unit', h('h4', unit));
        L.forEach((l, i) => {
          if (l.unit !== unit) return;
          const row = h('div.lesson-row' + (done.has(l.id) ? '.done' : ''), { role: 'button', tabindex: '0', id: 'lesson-' + l.id },
            h('span.num', done.has(l.id) ? '✓' : String(i + 1)),
            h('div', { style: { flex: '1', minWidth: '0' } }, h('div.t', l.title), h('div.s', l.summary)),
            h('span.tagc', l.level), h('span.muted', { style: { fontSize: '11.5px', whiteSpace: 'nowrap' } }, (l.minutes || 5) + ' min'));
          const go = () => { closeFn(null); Lessons.start(app, i); };
          row.addEventListener('click', go);
          row.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });   // else the Enter also clicks the Learn button that gets focus back
          box.appendChild(row);
        });
        main.appendChild(box);
      };
      render();
      const nextIdx = Math.max(0, L.findIndex((l) => !done.has(l.id)));
      const r = await LG.UI.modal({
        title: 'Learn Logo', wide: true,
        body: h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: '0' } },
          h('p', { style: { marginTop: '0' } }, L.length + ' lessons, from the first FORWARD to recursion, lists and games. Each one guides you through the real screen and checks your work as you go.'),
          h('div.sheet-grid', { style: { flex: '1', minHeight: '0' } }, nav, main)),
        buttons: [{ label: 'Close', value: null }, { label: 'Forget my progress', value: 'reset' }, { label: done.size ? 'Carry on' : 'Start lesson 1', value: 'go', primary: true }],
        onOpen: (b, c) => { closeFn = c; },
      });
      if (r === 'go') Lessons.start(app, nextIdx);
      if (r === 'reset' && await LG.UI.confirm('Forget progress?', 'Clear the tick marks on every lesson?', 'Forget')) store.set('lessonsDone', []);
    },
  };
})(LG);
