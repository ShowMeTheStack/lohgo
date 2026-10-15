// Lohgo: the application. Wires the turtle world, the command center, the editor, the
// debugger panels and the files together.
(function (LG) {
  'use strict';
  const { h, icon } = LG.UI;
  const store = LG.UI.storage;
  const D = LG.Data;

  const DEFAULTS = {
    theme: 'auto', fontSize: 14, grid: false, turtleStyle: 'turtle', speed: 10, freshRun: true, autosave: true,
    showBuried: false, firstRun: true, autoIndent: true, tabSize: 2, animate: 0,
  };
  const SPEEDS = [
    { label: 'Step by step', delay: 600, anim: 2 },
    { label: 'Very slow', delay: 250, anim: 2 },
    { label: 'Slow', delay: 90, anim: 3 },
    { label: 'Leisurely', delay: 30, anim: 4 },
    { label: 'Walking', delay: 8, anim: 6 },
    { label: 'Trotting', delay: 0, anim: 10 },
    { label: 'Running', delay: 0, anim: 18 },
    { label: 'Racing', delay: 0, anim: 40 },
    { label: 'Flying', delay: 0, anim: 120 },
    { label: 'Zooming', delay: 0, anim: 400 },
    { label: 'Instant', delay: 0, anim: 0 },
  ];
  const PROTECTED = /^\/(examples|library|lessons)(\/|$)/i;

  class App {
    constructor() {
      LG.app = this;
      this.settings = Object.assign({}, DEFAULTS, store.get('settings', {}));
      this.docs = [];
      this.active = null;
      this.breakpoints = new Map();          // path -> Map(line -> {cond, disabled})
      for (const [p, m] of Object.entries(store.get('breakpoints', {}))) this.breakpoints.set(p, new Map(m));
      this.selFrame = null;
      this.expanded = new Set(store.get('expanded', ['/projects', '/examples']));
      this.isTouch = matchMedia('(pointer: coarse)').matches;
      document.body.classList.toggle('touch', this.isTouch);
      this.vfs = new LG.VFS();
      this.world = new LG.TurtleWorld();
      this.audio = LG.Audio ? new LG.Audio() : null;
      this.interp = new LG.Interp({ vfs: this.vfs, turtle: this.world, audio: this.audio });
      LG.LogoLang.setPrimitives([...this.interp.prims.keys()]);
      this.applyTheme();
      try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (this.settings.theme === 'auto') this.applyTheme(); }); } catch (e) { /* old browsers */ }
      this.buildTop();
      this.buildRail();
      this.buildMobile();
      this.turtleView = new LG.TurtleView(this, this.world);
      this.commander = new LG.Commander(this);
      this.inspector = new LG.Inspector(this);
      this.callout = new LG.Callout(this);
      this.interp.io = this.makeIO();
      this.bindInterp();
      this.bindSplitters();
      this.bindKeys();
      this.setSpeed(this.settings.speed, true);
      this.renderTabs();
      this.updateUI();
      this.setView('turtle');
      window.addEventListener('beforeunload', (e) => {
        this.autosaveAll();
        // anything still unsaved after autosave (originals, folders from the computer, or autosave off) would be lost
        if (this.docs.some((d) => d.dirty)) { e.preventDefault(); e.returnValue = ''; }
      });
      setInterval(() => this.autosaveAll(), 4000);
      this.init();
    }

    async init() {
      try { await this.vfs.persist('lohgo-disk'); } catch (e) { /* private mode: memory only */ }
      for (const d of ['/projects']) this.vfs.mkdir(d, { exist: true, trusted: true });
      LG.Samples.install(this);
      this.restoreSession();
      this.commander.setProblems([]);
      this.welcome();
      this.renderSide();
      const hash = location.hash;
      if (/#share=/.test(hash)) LG.Files.importShare(this, hash);
      else if (/#lesson=/.test(hash) && LG.Lessons) LG.Lessons.startById(this, decodeURIComponent(hash.split('=')[1]));
      window.__lohgoReady = true;
      if (this.settings.firstRun && LG.Tours && !/#notour/.test(hash)) {
        this.settings.firstRun = false;
        this.saveSettings();
        setTimeout(() => LG.Tours.start(this, 'welcome'), 700);
      }
    }

    // ---- settings and theme ------------------------------------------------------------------
    saveSettings() { store.set('settings', this.settings); }
    applyTheme() {
      let t = this.settings.theme;
      if (t === 'auto') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'midnight' : 'paper';
      document.documentElement.dataset.theme = t;
      document.documentElement.style.setProperty('--code-size', this.settings.fontSize + 'px');
      const meta = document.querySelector('meta[name=theme-color]');
      if (meta) meta.content = getComputedStyle(document.body).getPropertyValue('--desk').trim() || '#efe7d8';
      for (const d of this.docs || []) d.editor.render();
      if (this.turtleView) this.turtleView.draw();
    }
    setTheme(t) { this.settings.theme = t; this.saveSettings(); this.applyTheme(); }
    zoomCode(dir) {
      this.settings.fontSize = LG.clamp(this.settings.fontSize + dir, 10, 26);
      this.saveSettings();
      this.applyTheme();
    }

    // ---- top bar ---------------------------------------------------------------------------------
    buildTop() {
      const btn = (id, ic, label, title, fn, cls) => {
        const b = h('button.pbtn' + (cls ? '.' + cls : ''), { type: 'button', id, title, 'aria-label': label }, icon(ic), h('span.lbl', label));
        b.addEventListener('click', fn);
        return b;
      };
      const rg = document.getElementById('runGroup');
      this.tb = {
        run: btn('tbRun', 'run', 'Run', 'Run the program in the editor (F5)', () => this.runOrContinue(), 'go'),
        pause: btn('tbPause', 'pause', 'Pause', 'Pause (Ctrl+Break)', () => this.pause()),
        stop: btn('tbStop', 'stop', 'Stop', 'Stop (Shift+F5)', () => this.stop(), 'stop'),
      };
      rg.append(this.tb.run, this.tb.pause, this.tb.stop);
      const dg = document.getElementById('debugGroup');
      this.tb.into = btn('tbInto', 'stepInto', 'Step', 'Step into: run one instruction (F11 or F8)', () => this.step('into'));
      this.tb.over = btn('tbOver', 'stepOver', 'Over', 'Step over: run one line, without stopping inside procedures it calls (F10)', () => this.step('over'));
      this.tb.out = btn('tbOut', 'stepOut', 'Out', 'Step out: finish this procedure (Shift+F11)', () => this.step('out'));
      for (const k of ['into', 'over', 'out']) this.tb[k].querySelector('.lbl').classList.add('opt');
      dg.append(this.tb.into, this.tb.over, this.tb.out);
      const sp = document.getElementById('speedBox');
      sp.title = 'Turtle speed';
      this.speedInput = h('input', { type: 'range', min: '0', max: String(SPEEDS.length - 1), step: '1', 'aria-label': 'Turtle speed', id: 'speed' });
      this.speedLabel = h('span.lbl', '');
      sp.append(icon('speed'), this.speedInput, this.speedLabel);
      this.speedInput.addEventListener('input', () => this.setSpeed(+this.speedInput.value));
      this.statePill = document.getElementById('state');
      this.projLabel = document.getElementById('proj');
      const menuBtn = document.getElementById('menuBtn');
      menuBtn.appendChild(icon('menu'));
      menuBtn.addEventListener('click', () => this.openMenu(menuBtn));
      document.getElementById('brand').addEventListener('click', () => this.aboutDialog());
    }
    setSpeed(v, quiet) {
      v = LG.clamp(Math.round(v), 0, SPEEDS.length - 1);
      this.settings.speed = v;
      this.speedInput.value = String(v);
      this.speedLabel.textContent = SPEEDS[v].label;
      this.interp.speedDelay = SPEEDS[v].delay;
      this.interp.anim = SPEEDS[v].anim;
      if (!quiet) this.saveSettings();
    }

    // ---- rail and side panels ----------------------------------------------------------------
    buildRail() {
      const rail = document.getElementById('rail');
      const item = (id, ic, label, fn) => {
        const b = h('button.rbtn', { type: 'button', id, title: label, 'aria-label': label }, icon(ic), h('span', label));
        b.addEventListener('click', fn);
        rail.appendChild(b);
        return b;
      };
      this.railBtns = {
        files: item('railFiles', 'folder', 'Files', () => this.toggleSide('files')),
        procs: item('railProcs', 'procs', 'Procedures', () => this.toggleSide('procs')),
      };
      rail.appendChild(h('div', { style: { height: '8px' } }));
      item('railLibrary', 'library', 'Library', () => LG.Library && LG.Library.browse(this));
      item('railLearn', 'learn', 'Learn', () => LG.Lessons && LG.Lessons.browse(this));
      item('railTours', 'tour', 'Tours', () => LG.Tours && LG.Tours.menu(this));
      item('railHelp', 'help', 'Help', () => LG.Help && LG.Help.open(this));
      rail.appendChild(h('div.rail-gap'));
      item('railSettings', 'palette', 'Looks', () => this.settingsDialog());
      // a floating side panel (tablets) closes when you tap somewhere else
      document.addEventListener('pointerdown', (e) => {
        if (!this.side || this.isPhone() || window.innerWidth > 1180) return;
        if (e.target.closest('#side, #rail, .menu-pop, .modal-back')) return;
        this.side = null;
        this.applySide();
      });
      this.side = store.get('side', 'files');
      if (window.innerWidth <= 1180) this.side = null;
      this.applySide();
    }
    toggleSide(name) {
      if (this.isPhone()) { this.side = name; this.applySide(); this.setView('files'); return; }
      this.side = this.side === name ? null : name;
      store.set('side', this.side);
      this.applySide();
    }
    applySide() {
      const side = document.getElementById('side');
      side.classList.toggle('closed', !this.side);
      for (const [k, b] of Object.entries(this.railBtns)) b.classList.toggle('active', this.side === k);
      this.renderSide();
    }
    renderSide() {
      if (!this.side || !this.vfs) return;
      const title = document.getElementById('sideTitle');
      const tools = document.getElementById('sideTools');
      const body = document.getElementById('sideBody');
      // the toolbar is rebuilt only when the panel changes, so a click on it is never lost to a redraw
      if (tools.dataset.side !== this.side) { tools.innerHTML = ''; tools.dataset.side = this.side; }
      if (this.side === 'files') { title.textContent = 'Files'; LG.Files.render(this, body, tools); }
      else if (this.side === 'procs') { title.textContent = 'Procedures'; this.renderProcs(body, tools); }
    }
    renderProcs(body, tools) {
      body.innerHTML = '';
      const I = this.interp;
      const procs = [...I.procs.values()].filter((p) => this.settings.showBuried || !I.buried.procs.has(p.key)).sort((a, b) => a.name.localeCompare(b.name));
      const fileProcs = this.active ? this.outline(this.active) : [];
      const list = h('div', { style: { padding: '6px' } });
      if (fileProcs.length) {
        list.appendChild(h('div.vsec', 'In ' + this.active.name));
        for (const p of fileProcs) {
          const r = h('div.proc-row', { tabindex: '0', role: 'button' }, h('span.t', p.title), h('span.s', 'line ' + (p.line + 1)));
          r.addEventListener('click', () => this.goto(this.active.path, p.line));
          r.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); r.click(); } });
          list.appendChild(r);
        }
      }
      list.appendChild(h('div.vsec', 'Defined in the workspace (' + procs.length + ')'));
      if (!procs.length) list.appendChild(h('div.side-note', 'Run a program, or type TO followed by a name in the command center, to define procedures. They stay defined until you run again or ERASE them.'));
      for (const p of procs) {
        const where = p.file ? p.file.replace(/^.*\//, '') + ':' + p.ln : 'typed at the prompt';
        const r = h('div.proc-row', { tabindex: '0', role: 'button', title: 'Show where it is defined' }, h('span.t', I.procSource(p).split('\n')[0]), h('span.s', where));
        r.addEventListener('click', () => this.editProc(p.key));
        r.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); r.click(); } });
        list.appendChild(r);
      }
      body.appendChild(list);
      const refresh = h('button.ibtn', { type: 'button', title: 'Refresh', 'aria-label': 'Refresh' }, icon('refresh'));
      refresh.addEventListener('click', () => this.renderSide());
      if (!tools.childElementCount) tools.appendChild(refresh);
    }
    /** TO lines in a document: [{name, title, line}] */
    outline(d) {
      const out = [];
      d.editor.lines().forEach((l, i) => {
        const m = /^\s*(to|\.macro)\s+(\S+)(.*)$/i.exec(l);
        if (m) out.push({ name: m[2], title: m[1].toLowerCase() + ' ' + m[2] + m[3].replace(/\s*;.*$/, ''), line: i });
      });
      return out;
    }
    workspaceChanged() {
      LG.LogoLang.setUserProcs([...this.interp.procs.keys()]);
      for (const d of this.docs) d.editor.cache.clear();
      if (this.active) this.active.editor.render();
      if (this.side === 'procs') this.renderSide();
      this.inspector.render();
    }

    // ---- mobile views -----------------------------------------------------------------------------
    buildMobile() {
      const bar = document.getElementById('mbar');
      const items = [['turtle', 'turtle', 'Turtle'], ['code', 'edit', 'Code'], ['debug', 'bug', 'Debug'], ['files', 'folder', 'Files'], ['more', 'more', 'More']];
      this.mtabs = {};
      for (const [k, ic, label] of items) {
        const b = h('button.mtab', { type: 'button', id: 'mtab-' + k, 'aria-label': label }, icon(ic), h('span', label));
        b.addEventListener('click', () => (k === 'more' ? this.openMenu(b) : this.setView(k)));
        bar.appendChild(b);
        this.mtabs[k] = b;
      }
      // landscape phones have no tab bar: a small view switcher sits in the top bar
      const mv = document.querySelector('.mviews');
      const seg = h('div.seg');
      for (const [k, label] of [['turtle', 'Turtle'], ['code', 'Code'], ['debug', 'Debug']]) {
        const b = h('button', { type: 'button', dataset: { v: k } }, label);
        b.addEventListener('click', () => this.setView(k));
        seg.appendChild(b);
      }
      mv.appendChild(seg);
      this.mviewSeg = seg;
    }
    isPhone() { return window.innerWidth <= 720 || (window.innerHeight <= 500 && window.innerWidth <= 920); }
    setView(v) {
      this.view = v;
      document.body.dataset.view = v;
      for (const [k, b] of Object.entries(this.mtabs)) b.classList.toggle('active', k === v);
      for (const b of this.mviewSeg.children) b.classList.toggle('on', b.dataset.v === v);
      if (v === 'files') { if (!this.side) this.side = 'files'; this.applySide(); }
      if (v === 'code' && this.active) setTimeout(() => this.active.editor.render(), 0);
      if (v === 'debug') this.inspector.render();
      if (v === 'turtle') setTimeout(() => this.turtleView.resize(), 0);
    }

    // ---- splitters ---------------------------------------------------------------------------------
    bindSplitters() {
      const root = document.documentElement.style;
      const sizes = store.get('sizes', {});
      for (const [k, v] of Object.entries(sizes)) root.setProperty(k, v);
      const save = (k, v) => { sizes[k] = v; store.set('sizes', sizes); };
      const stage = document.getElementById('stage');
      LG.UI.splitter(document.getElementById('splitRight'), (e) => {
        const r = stage.getBoundingClientRect();
        const w = LG.clamp(r.right - e.clientX, 300, r.width - 310);
        const v = (w / r.width * 100).toFixed(1) + '%';
        root.setProperty('--right-w', v); save('--right-w', v);
      });
      const left = document.getElementById('leftCol');
      LG.UI.splitter(document.getElementById('splitCmd'), (e) => {
        const r = left.getBoundingClientRect();
        const hh = LG.clamp(r.bottom - e.clientY, 90, r.height - 160);
        const v = (hh / r.height * 100).toFixed(1) + '%';
        root.setProperty('--cmd-h', v); save('--cmd-h', v);
      });
      const right = document.getElementById('rightCol');
      LG.UI.splitter(document.getElementById('splitInsp'), (e) => {
        const r = right.getBoundingClientRect();
        const hh = LG.clamp(r.bottom - e.clientY, 80, r.height - 140);
        const v = (hh / r.height * 100).toFixed(1) + '%';
        root.setProperty('--insp-h', v); save('--insp-h', v);
      });
      // keyboard resizing for the splitters
      for (const [id, prop, dir] of [['splitRight', '--right-w', 1], ['splitCmd', '--cmd-h', 1], ['splitInsp', '--insp-h', 1]]) {
        const el = document.getElementById(id);
        el.tabIndex = 0;
        el.addEventListener('keydown', (e) => {
          const keys = id === 'splitRight' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
          const i = keys.indexOf(e.key);
          if (i < 0) return;
          e.preventDefault();
          const cur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(prop)) || 40;
          const v = LG.clamp(cur + (i === 0 ? 2 : -2) * dir, 18, 75).toFixed(1) + '%';
          root.setProperty(prop, v); save(prop, v);
        });
      }
    }
    toggleBigWorld(on) {
      const card = document.getElementById('worldCard');
      const big = on === undefined ? !card.classList.contains('fullscreen') : on;
      card.classList.toggle('fullscreen', big);
      setTimeout(() => this.turtleView.resize(), 0);
    }

    // ---- the interpreter's view of the screen and keyboard ---------------------------------------
    makeIO() {
      const tv = this.turtleView.io();
      const cmd = this.commander;
      let textSize = 14;
      return Object.assign(tv, {
        print: (t) => cmd.write(t),
        clearText: () => cmd.clearText(),
        setCursor: (x, y) => cmd.setCursor(x, y),
        cursor: () => cmd.cursor(),
        setTextColor: (fg) => {
          const c = this.world.color(fg, D);
          cmd.flush();
          cmd.color = c ? 'rgb(' + c.rgb.join(',') + ')' : null;
        },
        textSize: () => textSize,
        setTextSize: (n) => { textSize = n; document.getElementById('transcript').style.fontSize = n + 'px'; },
        setFont: (f) => { document.getElementById('transcript').style.fontFamily = f + ', var(--font-code)'; this.fontName = f; },
        font: () => this.fontName || 'monospace',
        layout: (mode) => this.screenLayout(mode),
        screenMode: () => this.screenModeName || 'split',
      });
    }
    screenLayout(mode) {
      this.screenModeName = mode;
      if (mode === 'full') this.toggleBigWorld(true);
      else this.toggleBigWorld(false);
      if (mode === 'text' && this.isPhone()) this.setView('turtle');
    }

    // ---- running -------------------------------------------------------------------------------------
    isBusy() { return this.interp.isBusy(); }
    bindInterp() {
      const I = this.interp;
      I.on('state', () => this.updateUI());
      I.on('paused', (why) => this.onPaused(why));
      I.on('error', (e) => this.onError(e));
      I.on('immediateError', (e) => { this.commander.error(e); this.updateUI(); });
      I.on('immediateDone', (v) => {
        if (v !== undefined) this.commander.line('out', D.showText(v, { width: 100, depth: 6 }));
        this.inspector.tree.mark();
        this.inspector.render();
        if (I.continueRequested) { I.continueRequested = false; this.continue(); }
      });
      I.on('done', (v) => this.onDone(v));
      // the slowest speeds light up each instruction in the editor as it runs
      I.on('slowStep', () => { if (I.speedDelay >= 250 && this.selFrame === null) { this.showExec(); this.slowMarks = true; } });
      I.on('halted', (why) => {
        this.clearExec();
        if (why === 'stop') this.commander.note('Stopped.');
        if (why === 'bye') this.commander.note('Bye! (BYE ends the program here; the page stays open.)');
        this.endRun();
      });
      I.on('needInput', (req) => {
        if (req.kind === 'line') this.commander.startReading(req);
        else if (req.kind === 'char') {
          const c = document.getElementById('worldCanvas');
          if (document.activeElement !== this.commander.input) c.focus({ preventScroll: true });
          this.setStatus('Waiting for a key: click the turtle world and press a key');
        }
      });
      I.on('defined', () => { this.wsDirty = true; });
      I.on('erased', () => { this.wsDirty = true; });
      I.on('edit', (what) => this.editWorkspace(what));
      I.on('editfile', (p) => this.openFile(p));
      I.on('help', (w) => LG.Help && LG.Help.open(this, w));
      I.on('saved', () => { this.renderSide(); this.refreshDocsFromDisk(); });
      I.askWrite = (path) => LG.UI.confirm('Let the program write a file?', 'Your program wants to change <b>' + LG.escapeHtml(path) + '</b> in a folder you mounted from your computer. Allow it?', 'Allow');
      // files changed by programs (OPENWRITE, ERASEFILE...) show up in the tree, and unchanged open tabs follow them
      this.vfs.on('change', () => { clearTimeout(this.fsTimer); this.fsTimer = setTimeout(() => { if (this.side === 'files') this.renderSide(); this.refreshDocsFromDisk(); }, 120); });
    }
    /** Run the active file: define its procedures and run its instructions */
    runOrContinue() {
      if (this.interp.state === 'paused') { this.continue(); return; }
      this.runActive();
    }
    runActive(opts) {
      opts = opts || {};
      const d = this.active;
      if (!d) { LG.UI.toast('Open or create a program first', 'err'); return; }
      if (this.isBusy()) return;
      if (this.interp.state === 'paused' || this.interp.state === 'error') this.interp.halt();
      this.autosaveAll();
      this.prepareRun(d.name);
      this.syncBreakpoints();
      if (opts.arm) opts.arm();   // run to here: a one-off breakpoint that must exist before the first instruction
      this.runCount = (this.runCount || 0) + 1;
      this.lastRunPath = d.path;
      try {
        this.interp.loadText(d.editor.getValue(), d.path, { stepMode: opts.step ? { mode: 'into', depth: 0 } : null });
      } catch (e) {
        this.onError(e);
      }
    }
    prepareRun(label) {
      const I = this.interp;
      this.clearExec();
      this.clearErrorMarks();
      this.problems = [];
      this.commander.setProblems([]);
      this.commander.stopReading();
      this.selFrame = null;
      this.inspector.tree.state.prev.clear(); this.inspector.tree.state.seen.clear();   // a new run starts with no change highlights
      this.turtleView.reset();
      if (I.clearHandlers) I.clearHandlers();
      if (I.files_open) { for (const k of [...I.files_open.keys()]) I.files_open.delete(k); I.reader = null; I.writer = null; }
      if (this.settings.freshRun) {
        // a fresh start: forget procedures and variables from earlier runs, clear the drawing
        for (const k of [...I.procs.keys()]) if (!I.buried.procs.has(k)) I.procs.delete(k);
        for (const k of [...I.globals.keys()]) if (!I.buried.names.has(k)) I.globals.delete(k);
        for (const k of [...I.plists.keys()]) if (!I.buried.plists.has(k)) I.plists.delete(k);
        I.gen++;
        this.wsDirty = true;   // forgotten procedures must lose their colour and leave the Procedures panel
        this.world.reset();
        this.world.palette = LG.TurtleWorld.PALETTE.map((c) => c.slice());
      }
      this.hideWelcome();
      this.commander.endPage();
      this.commander.note('▶ Running ' + label);
      this.runStart = performance.now();
      this.runCount0 = I.count;
    }
    /** Run a line typed in the command center */
    runCommand(text) {
      const I = this.interp;
      this.hideWelcome();
      (this.commandLog || (this.commandLog = [])).push(text);
      if (this.commandLog.length > 500) this.commandLog.splice(0, 100);
      if (I.state === 'paused' || I.state === 'error') {
        try {
          I.runImmediate(text, this.selFrame === null ? undefined : this.selFrame);
        } catch (e) { this.commander.error(e); }
        return;
      }
      if (this.isBusy()) { this.commander.note('The program is still running. Press Stop (or Pause) first.'); return; }
      this.syncBreakpoints();
      this.selFrame = null;
      this.clearExec();
      try { I.runText(text, { wantValue: true, label: 'command' }); } catch (e) { this.commander.error(e); }
    }
    stop() {
      if (this.interp.clearHandlers) this.interp.clearHandlers();
      if (this.interp.state === 'idle') return;
      this.interp.halt();
      this.commander.stopReading();
      this.clearExec();
      this.endRun();
      this.updateUI();
    }
    pause() { if (this.isBusy()) this.interp.requestPause(); }
    continue() {
      if (this.interp.state !== 'paused') return;
      this.clearExec();
      this.selFrame = null;
      this.interp.resume(null);
    }
    step(mode) {
      const I = this.interp;
      if (I.state === 'paused') { this.clearExec(); this.selFrame = null; I.resume(mode); return; }
      if (mode === 'out') return;   // nothing to step out of (the Out button is disabled too)
      if (I.state === 'idle' || I.state === 'error') {
        if (I.state === 'error') I.halt();
        this.runActive({ step: true });
      }
    }
    onPaused(why) {
      this.selFrame = null;
      this.showExec();
      this.inspector.tree.mark();
      this.inspector.render();
      const f = this.inspector.frame();
      const where = f && f.proc ? ' in ' + f.proc.name : '';
      const msgs = { breakpoint: 'Stopped at a breakpoint' + where, step: 'Paused' + where, pause: 'Paused' + where, stepped: 'Stepping through ' + (f && f.proc ? f.proc.name : ''), watch: 'A watch changed' + where };
      this.setStatus((msgs[why] || 'Paused') + '. F5 continues, F10 steps over, F11 steps in.');
      if (why === 'watch') this.inspector.show('watch');
      if (this.isPhone() && this.view === 'turtle' && why !== 'pause') this.setView('code');
      this.updateUI();
    }
    onError(e) {
      this.commander.flush();
      this.commander.error(e);
      const I = this.interp;
      const path = e.src !== undefined ? I.filePath(e.src) : null;
      this.problems = [{ message: e.message, path, ln: e.ln, err: e }];
      this.commander.setProblems(this.problems);
      if (path && e.ln) this.markError(path, e.ln - 1);
      this.selFrame = null;
      this.inspector.render();
      this.setStatus('Error: ' + e.message + (e.procName ? ' (in ' + e.procName + ')' : ''));
      this.endRun();
      this.updateUI();
    }
    onDone(v) {
      if (v !== undefined) this.commander.line('out', D.showText(v, { width: 200, depth: 8 }));
      this.endRun();
    }
    endRun() {
      this.commander.stopReading();
      if (this.slowMarks) { this.slowMarks = false; this.clearExecMarks(); }
      if (this.wsDirty) { this.wsDirty = false; this.workspaceChanged(); }
      if (this.runStart && this.interp.state === 'idle') {
        const ms = performance.now() - this.runStart;
        this.runStart = 0;
        const n = this.interp.count - (this.runCount0 || 0);
        this.setStatus('Finished in ' + (ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(1) + ' s') + ' · ' + n.toLocaleString() + ' instruction' + (n === 1 ? '' : 's'));
      }
      this.inspector.tree.mark();
      this.inspector.render();
      this.updateUI();
    }
    afterEdit() { this.inspector.render(); }

    // ---- breakpoints ---------------------------------------------------------------------------------
    toggleBreakpoint(path, line) {
      let m = this.breakpoints.get(path);
      if (!m) { m = new Map(); this.breakpoints.set(path, m); }
      if (m.has(line)) m.delete(line); else m.set(line, { cond: '', disabled: false });
      this.breakpointsChanged(path);
    }
    breakpointsChanged(path) {
      const m = this.breakpoints.get(path);
      if (m && !m.size) this.breakpoints.delete(path);
      const d = this.docByPath(path);
      if (d) d.editor.setBreakpoints(this.breakpoints.get(path) || new Map());
      const obj = {};
      for (const [p, mm] of this.breakpoints) obj[p] = [...mm];
      store.set('breakpoints', obj);
      this.syncBreakpoints();
      this.inspector.render();
    }
    clearBreakpoints() { const paths = [...this.breakpoints.keys()]; this.breakpoints.clear(); paths.forEach((p) => this.breakpointsChanged(p)); }
    async conditionalBreakpoint(path, line) {
      const m = this.breakpoints.get(path) || new Map();
      const cur = m.get(line);
      const v = await LG.UI.prompt('Stop only when…', 'Stop at line ' + (line + 1) + ' only when this is true (leave empty to always stop):', cur ? cur.cond : '', { hint: 'Examples:  :n = 3    :size < 10    emptyp :list' });
      if (v === null || v === undefined) return;
      if (!this.breakpoints.has(path)) this.breakpoints.set(path, m);
      m.set(line, { cond: v.trim(), disabled: false });
      this.breakpointsChanged(path);
    }
    /** Copy the editor's breakpoints into the interpreter (keyed by file id and line) */
    syncBreakpoints() {
      const I = this.interp;
      I.breakpoints.clear();
      for (const [path, m] of this.breakpoints) {
        const src = I.fileId(path);
        for (const [line, bp] of m) if (!bp.disabled) I.breakpoints.set(src + ':' + (line + 1), bp);
      }
      this.syncWatchpoints();
    }
    syncWatchpoints() {
      const I = this.interp;
      const ws = this.inspector ? this.inspector.watches.filter((w) => w.mode) : [];
      if (!ws.length) { I.stepHook = null; return; }
      const last = new Map();
      I.stepHook = (fr) => {
        for (const w of ws) {
          let v;
          try { v = D.showText(I.peek(w.expr, fr.scope)); } catch (e) { v = undefined; }
          const prev = last.get(w);
          last.set(w, v);
          if (w.mode === 'change' && prev !== undefined && v !== prev) return true;
          if (w.mode === 'true' && v === 'true' && prev !== 'true') return true;
        }
        return false;
      };
    }

    // ---- showing where the program is ---------------------------------------------------------------
    showExec() {
      this.clearExecMarks();
      const frames = LG.Debug.frames(this.interp);
      if (!frames.length) return;
      const top = frames[frames.length - 1];
      const sel = this.selFrame === null || this.selFrame >= frames.length ? frames.length - 1 : this.selFrame;
      const show = (f, kind) => {
        if (!f.file || !f.line) return;
        const d = this.openFile(f.file, { noFocus: kind !== 'exec' });
        if (!d) return;
        if (kind === 'exec') d.editor.setExec(f.line - 1); else d.editor.setFrame(f.line - 1);
        if (this.active !== d && kind === 'frame') this.activate(d);
      };
      show(top, 'exec');
      if (sel !== frames.length - 1) show(frames[sel], 'frame');
    }
    clearExecMarks() { for (const d of this.docs) { d.editor.setExec(null); d.editor.setFrame(null); } }
    clearExec() { this.clearExecMarks(); this.callout.hide(); }
    selectFrame(i) {
      this.selFrame = i;
      this.showExec();
      this.inspector.render();
    }
    markError(path, line) {
      const d = this.openFile(path);
      if (d) { d.editor.setError(line); this.activate(d); }
    }
    clearErrorMarks() { for (const d of this.docs) d.editor.setError(null); }
    gotoError(e) {
      const I = this.interp;
      const path = e.src !== undefined ? I.filePath(e.src) : null;
      if (!path || !e.ln) return;
      this.goto(path, e.ln - 1);
      const d = this.docByPath(path);
      if (d) d.editor.setError(e.ln - 1);
    }
    goto(path, line) {
      const d = this.openFile(path);
      if (!d) return;
      this.activate(d);
      if (this.isPhone()) this.setView('code');
      setTimeout(() => { d.editor.setCursor(line, 0); d.editor.revealLine(line); d.editor.flashLine(line); d.editor.focus(); }, 0);
    }
    editProc(key) {
      const p = this.interp.procs.get(key);
      if (!p) return;
      if (p.file && this.vfs.exists(p.file)) { this.goto(p.file, (p.ln || 1) - 1); return; }
      this.newScratch(this.interp.procSource(p) + '\n', p.name);
    }
    editWorkspace(what) {
      const I = this.interp;
      for (const k of what.procs || []) { if (I.procs.has(k)) { this.editProc(k); return; } }
      const text = I.workspaceSource(what);
      this.newScratch(text.trim() ? text : '; Nothing to edit yet\n', 'workspace');
    }
    newScratch(text, stem) {
      let n = 1, p;
      do { p = '/projects/' + stem.replace(/[^\w.-]/g, '') + (n > 1 ? n : '') + '.lgo'; n++; } while (this.vfs.exists(p) || this.docByPath(p));
      const d = this.createDoc(p, text);
      d.dirty = true;
      this.activate(d);
      this.renderTabs();
      if (this.isPhone()) this.setView('code');
    }
    lineText(path, line) {
      const d = this.docByPath(path);
      if (d) return d.editor.getLine(line);
      try { return this.vfs.readText(path).split('\n')[line] || ''; } catch (e) { return ''; }
    }

    // ---- documents -------------------------------------------------------------------------------------
    isProtected(path) { return PROTECTED.test(path || ''); }
    docByPath(p) {
      if (!p) return null;
      const k = p.toLowerCase();
      return this.docs.find((d) => d.path.toLowerCase() === k) || null;
    }
    openFile(path, opts) {
      opts = opts || {};
      let display;
      try { display = this.vfs.abs(path); } catch (e) { return null; }
      let d = this.docByPath(display);
      if (!d) {
        let text = '';
        if (this.vfs.exists(display)) {
          if (!this.vfs.isReady(display)) { this.vfs.load(display).then(() => this.openFile(display, opts)); return null; }
          try { text = this.vfs.readText(display).replace(/\r\n?/g, '\n'); } catch (e) { LG.UI.toast(e.message, 'err'); return null; }
        }
        d = this.createDoc(display, text);
      }
      if (!opts.noFocus || !this.active) this.activate(d);
      else this.renderTabs();
      return d;
    }
    createDoc(path, text) {
      const editor = new LG.Editor(document.getElementById('editors'), { lang: LG.LogoLang, settings: this.settings });
      editor.setValue(text);
      const d = { path, editor, dirty: false, savedText: text, name: path.replace(/^.*\//, '') };
      editor.on('change', () => { d.dirty = editor.getValue() !== d.savedText; this.renderTabs(); editor.setError(null); if (this.side === 'procs') this.renderSideSoon(); });
      editor.on('cursor', () => this.updateStatus());
      editor.on('gutter', (line) => this.toggleBreakpoint(d.path, line));
      editor.on('gutterContext', (line, e) => this.gutterMenu(d, line, e));
      editor.on('bpsShifted', (map) => { this.breakpoints.set(d.path, new Map(map)); this.breakpointsChanged(d.path); });
      editor.on('help', (line, col) => { const w = LG.LogoLang.wordAt(line, col); if (LG.Help) LG.Help.open(this, w ? w.word : ''); });
      editor.on('hover', (pos, x, y) => this.callout.showFor(d, pos, x, y));
      editor.on('hoverOut', () => this.callout.scheduleHide(450));
      editor.on('context', (pos, e) => this.editorMenu(d, pos, e));
      editor.on('find', (replace) => this.findDialog(replace));
      editor.on('gotoLine', () => this.gotoLineDialog());
      editor.setBreakpoints(this.breakpoints.get(path) || new Map());
      this.docs.push(d);
      return d;
    }
    renderSideSoon() { clearTimeout(this.sideTimer); this.sideTimer = setTimeout(() => this.renderSide(), 400); }
    activate(d) {
      this.active = d;
      for (const x of this.docs) x.editor.show(x === d);
      this.renderTabs();
      this.updateUI();
      this.saveSession();
      if (this.side) this.renderSideSoon();
    }
    renderTabs() {
      const tabs = document.getElementById('editorTabs');
      tabs.innerHTML = '';
      for (const d of this.docs) {
        const x = h('span.x', { title: 'Close', role: 'button', 'aria-label': 'Close ' + d.name }, '×');
        const t = h('button.etab' + (d === this.active ? '.active' : ''), { type: 'button', role: 'tab', title: d.path, 'aria-selected': String(d === this.active) },
          this.isProtected(d.path) ? h('span.lock', { title: 'An original: saving makes your own copy' }, '◆') : null,
          d.name, d.dirty ? h('span.dot', { title: 'Not saved' }) : null, x);
        t.addEventListener('click', (e) => { if (e.target === x) { this.closeDoc(d); return; } this.activate(d); d.editor.focus(); });
        t.addEventListener('auxclick', (e) => { if (e.button === 1) this.closeDoc(d); });
        tabs.appendChild(t);
      }
      const editors = document.getElementById('editors');
      let empty = editors.querySelector('.empty-ed');
      if (!this.docs.length) {
        if (!empty) {
          empty = h('div.empty-ed', h('div', { style: { fontSize: '40px' } }, '🐢'), h('div', 'No program open.'),
            h('div', h('button.btn.primary', { type: 'button', onclick: () => LG.Files.newFile(this) }, 'New program'), ' ', h('button.btn', { type: 'button', onclick: () => LG.Library && LG.Library.browse(this) }, 'Open the library')));
          editors.appendChild(empty);
        }
      } else if (empty) empty.remove();
      const tools = document.getElementById('editorTools');
      if (!tools.childElementCount) {
        const nb = h('button.ibtn', { type: 'button', title: 'New program', 'aria-label': 'New program', id: 'tbNew' }, icon('newFile'));
        nb.addEventListener('click', () => LG.Files.newFile(this));
        const sb = h('button.ibtn', { type: 'button', title: 'Save (Ctrl+S)', 'aria-label': 'Save', id: 'tbSave' }, icon('save'));
        sb.addEventListener('click', () => this.save());
        const sh = h('button.ibtn', { type: 'button', title: 'Share this program as a link', 'aria-label': 'Share', id: 'tbShare' }, icon('share'));
        sh.addEventListener('click', () => this.active && LG.Files.shareDialog(this, this.active.path));
        tools.append(nb, sb, sh);
      }
    }
    async closeDoc(d) {
      if (d.dirty) {
        let r;
        if (this.isProtected(d.path)) {
          r = await LG.UI.modal({
            title: 'Keep your changes?',
            body: h('div', h('p', 'You changed ' + d.name + ', which is one of the originals. The original stays as it was.'), h('p', 'Save your version as a program of your own?')),
            buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Throw them away', value: 'no' }, { label: 'Save my copy…', value: 'copy', primary: true }],
            cancelValue: 'cancel',
          });
          if (r === 'cancel') return false;
          if (r === 'copy' && !(await this.saveCopy(d))) return false;
        } else {
          r = await LG.UI.modal({
            title: 'Save changes?', body: h('p', 'Save the changes to ' + d.name + '?'),
            buttons: [{ label: 'Cancel', value: 'cancel' }, { label: "Don't save", value: 'no' }, { label: 'Save as…', value: 'as' }, { label: 'Save', value: 'yes', primary: true }],
            cancelValue: 'cancel',
          });
          if (r === 'cancel') return false;
          if (r === 'yes' && !this.saveDoc(d)) return false;
          if (r === 'as' && !(await this.saveAs(d))) return false;
        }
      }
      const i = this.docs.indexOf(d);
      if (i < 0) return true;
      this.docs.splice(i, 1);
      d.editor.destroy();
      if (this.active === d) this.active = this.docs[Math.max(0, i - 1)] || null;
      if (this.active) this.activate(this.active); else { this.renderTabs(); this.updateUI(); this.saveSession(); }
      return true;
    }
    saveSession() { store.set('session', { open: this.docs.map((d) => d.path), active: this.active ? this.active.path : null }); }
    restoreSession() {
      const s = store.get('session', null);
      if (s && s.open && s.open.length) {
        for (const p of s.open) if (this.vfs.exists(p)) this.openFile(p, { noFocus: true });
        const a = s.active && this.docByPath(s.active);
        if (a) this.activate(a); else if (this.docs.length) this.activate(this.docs[0]);
      }
      if (!this.docs.length) {
        const start = '/projects/start.lgo';
        if (!this.vfs.exists(start)) this.vfs.writeText(start, LG.Samples.starter(), { trusted: true });
        this.openFile(start);
      }
    }
    saveDoc(d) {
      if (this.isProtected(d.path)) return false;
      try {
        const dir = d.path.replace(/\/[^/]*$/, '') || '/';
        if (!this.vfs.exists(dir)) this.vfs.mkdir(dir, { parents: true, trusted: true });
        this.vfs.writeText(d.path, d.editor.getValue(), { trusted: this.vfs.canWrite(d.path) !== 'no' });
        d.savedText = d.editor.getValue();
        d.dirty = false;
        this.renderTabs();
        return true;
      } catch (e) {
        LG.UI.toast('Could not save ' + d.name + ': ' + e.message, 'err');
        return false;
      }
    }
    async save() {
      const d = this.active;
      if (!d) return;
      if (this.isProtected(d.path)) { await this.saveCopy(d); return; }
      if (this.saveDoc(d)) this.setStatus('Saved ' + d.path);
    }
    autosaveAll() {
      if (!this.settings.autosave) return;
      for (const d of this.docs) if (d.dirty && !this.isProtected(d.path) && this.vfs.exists(d.path.replace(/\/[^/]*$/, '') || '/') && !/^\/mnt\//i.test(d.path)) this.saveDoc(d);
    }
    async saveCopy(d) {
      const stem = d.name.replace(/\.[^.]*$/, '');
      let n = 1, def;
      do { def = '/projects/' + stem + (n > 1 ? '-' + n : '') + '.lgo'; n++; } while (this.vfs.exists(def) || this.docByPath(def));
      return this.saveAs(d, { title: 'Save your own copy', def, hint: 'This is an original, so your version is saved as a new program of your own. Type a name, or a path like /projects/games/maze.lgo.' });
    }
    async saveAs(d, opts) {
      d = d || this.active;
      opts = opts || {};
      if (!d) return false;
      const name = await LG.UI.prompt(opts.title || 'Save as', 'Name', opts.def || d.path, { hint: opts.hint || 'A name like spiral.lgo saves next to the current program; a path like /projects/art/spiral.lgo picks the folder.' });
      if (!name) return false;
      let p = name.trim();
      if (!/\.[^/.]+$/.test(p)) p += '.lgo';
      if (!p.startsWith('/')) p = (this.isProtected(d.path) ? '/projects' : d.path.replace(/\/[^/]*$/, '')) + '/' + p;
      let disp;
      try { disp = this.vfs.abs(p); } catch (e) { LG.UI.toast('That is not a usable file name', 'err'); return false; }
      if (this.isProtected(disp)) { LG.UI.toast('Pick a folder outside /examples, /library and /lessons, such as /projects', 'err', 5000); return false; }
      if (this.vfs.exists(disp) && disp.toLowerCase() !== d.path.toLowerCase()) {
        if (!(await LG.UI.confirm('Replace?', LG.escapeHtml(disp) + ' already exists. Replace it?', 'Replace'))) return false;
      }
      const other = this.docByPath(disp);
      if (other && other !== d) { other.dirty = false; await this.closeDoc(other); }
      const old = d.path;
      d.path = disp; d.name = disp.replace(/^.*\//, '');
      if (!this.saveDoc(d)) { d.path = old; d.name = old.replace(/^.*\//, ''); return false; }
      const bps = this.breakpoints.get(old);
      if (bps && bps.size) { this.breakpoints.set(d.path, new Map(bps)); if (this.isProtected(old)) this.breakpoints.delete(old); this.breakpointsChanged(d.path); }
      this.activate(d);
      LG.UI.toast('Saved ' + d.path, 'ok');
      this.renderSide();
      return true;
    }
    refreshDocsFromDisk() {
      for (const d of this.docs) {
        if (d.dirty) continue;
        try { const t = this.vfs.readText(d.path); if (t !== d.savedText) { d.editor.setValue(t); d.savedText = t; } } catch (e) { /* gone */ }
      }
    }

    // ---- menus ------------------------------------------------------------------------------------------
    menuItems() {
      const I = this.interp;
      const paused = I.state === 'paused';
      const busy = this.isBusy();
      const sep = { sep: true };
      return [
        { head: 'Program' },
        { label: 'New program', sc: 'Alt+N', action: () => LG.Files.newFile(this) },
        { label: 'Open…', sc: 'Ctrl+O', action: () => LG.Files.openDialog(this) },
        { label: 'Save', sc: 'Ctrl+S', action: () => this.save(), disabled: !this.active },
        { label: 'Save as…', sc: 'Ctrl+Shift+S', action: () => this.saveAs(), disabled: !this.active },
        { label: 'Share as a link…', action: () => this.active && LG.Files.shareDialog(this, this.active.path), disabled: !this.active },
        { label: 'Open a shared program…', action: () => LG.Files.importDialog(this) },
        { label: 'Download this file', action: () => this.active && LG.Files.download(this, this.active.path), disabled: !this.active },
        { label: 'Close', sc: 'Alt+W', action: () => this.active && this.closeDoc(this.active), disabled: !this.active },
        sep,
        { head: 'Run' },
        { label: paused ? 'Continue' : 'Run', sc: 'F5', action: () => this.runOrContinue(), disabled: busy },
        { label: 'Pause', sc: 'Ctrl+Break', action: () => this.pause(), disabled: !busy },
        { label: 'Stop', sc: 'Shift+F5', action: () => this.stop(), disabled: I.state === 'idle' },
        { label: 'Step into', sc: 'F11', action: () => this.step('into'), disabled: busy },
        { label: 'Step over', sc: 'F10', action: () => this.step('over'), disabled: busy },
        { label: 'Step out', sc: 'Shift+F11', action: () => this.step('out'), disabled: !paused },
        { label: 'Toggle breakpoint', sc: 'F9', action: () => this.active && this.toggleBreakpoint(this.active.path, this.active.editor.cursor().line), disabled: !this.active },
        { label: 'Remove all breakpoints', action: () => this.clearBreakpoints() },
        { label: 'Fresh start on every run', checked: this.settings.freshRun, action: () => { this.settings.freshRun = !this.settings.freshRun; this.saveSettings(); } },
        sep,
        { head: 'Turtle' },
        { label: 'Clear the drawing (CS)', action: () => this.command('clearscreen') },
        { label: 'Graph paper grid', checked: this.turtleView.grid, action: () => this.turtleView.toggleGrid() },
        { label: 'Big turtle world', sc: 'F4', action: () => this.toggleBigWorld() },
        { label: 'Turtle speed', items: SPEEDS.map((sp, i) => ({ label: sp.label, checked: this.settings.speed === i, action: () => this.setSpeed(i) })) },
        { label: 'Save the drawing as a picture', action: () => this.savePicture() },
        { label: 'Classic triangle turtle', checked: this.settings.turtleStyle === 'classic', action: () => { this.settings.turtleStyle = this.settings.turtleStyle === 'classic' ? 'turtle' : 'classic'; this.saveSettings(); this.turtleView.draw(); } },
        sep,
        { head: 'Help' },
        { label: 'Learn Logo (lessons)', action: () => LG.Lessons && LG.Lessons.browse(this) },
        { label: 'Program library', action: () => LG.Library && LG.Library.browse(this) },
        { label: 'Guided tours', action: () => LG.Tours && LG.Tours.menu(this) },
        { label: 'Language reference', sc: 'F1', action: () => LG.Help && LG.Help.open(this) },
        { label: 'Keyboard shortcuts', action: () => this.shortcutsDialog() },
        { label: 'Colours and themes…', action: () => this.settingsDialog() },
        { label: 'About the author', action: () => LG.authorDialog() },
        { label: 'About Lohgo', action: () => this.aboutDialog() },
      ];
    }
    openMenu(anchor) {
      const r = anchor.getBoundingClientRect();
      const items = this.menuItems().map((it) => {
        if (it.head) return { label: it.head, header: true, disabled: true };
        return it;
      });
      LG.UI.showMenu(items, Math.max(8, r.right - 280), r.bottom + 6);
      // line the menu's right edge up with the button
      const pop = document.querySelector('.menu-pop');
      if (pop) pop.style.left = Math.max(8, Math.min(r.right - pop.offsetWidth, window.innerWidth - pop.offsetWidth - 8)) + 'px';
    }
    command(text) { if (!this.isBusy()) { this.commander.echo(text); this.runCommand(text); } }
    gutterMenu(d, line, e) {
      const m = this.breakpoints.get(d.path);
      const has = m && m.has(line);
      LG.UI.showMenu([
        { label: has ? 'Remove breakpoint' : 'Add breakpoint', action: () => this.toggleBreakpoint(d.path, line) },
        { label: 'Stop only when…', action: () => this.conditionalBreakpoint(d.path, line) },
        has ? { label: m.get(line).disabled ? 'Enable' : 'Disable', action: () => { const bp = m.get(line); bp.disabled = !bp.disabled; this.breakpointsChanged(d.path); } } : null,
        { label: 'Run to here', action: () => this.runToLine(d, line) },
      ].filter(Boolean), e.clientX, e.clientY);
    }
    editorMenu(d, pos, e) {
      const w = pos ? LG.LogoLang.wordAt(d.editor.getLine(pos.line), pos.col) : null;
      const items = [];
      if (w && w.kind === 'proc' && LG.Help) items.push({ label: 'Help on ' + w.word, action: () => LG.Help.open(this, w.word) });
      if (w && (w.kind === 'var' || w.kind === 'quoted')) items.push({ label: 'Watch :' + w.word, action: () => {
        const have = this.inspector.watches.some((x) => x.expr.toLowerCase() === ':' + w.word.toLowerCase());
        if (have) this.inspector.show('watch'); else this.inspector.addWatch(':' + w.word);
      } });
      if (pos) items.push({ label: 'Toggle breakpoint', action: () => this.toggleBreakpoint(d.path, pos.line) });
      if (pos) items.push({ label: 'Run to here', action: () => this.runToLine(d, pos.line) });
      if (!items.length) return;
      e.preventDefault();
      LG.UI.showMenu(items, e.clientX, e.clientY);
    }
    runToLine(d, line) {
      const I = this.interp;
      const src = I.fileId(d.path);
      const key = src + ':' + (line + 1);
      const temp = { cond: '', temp: true };
      const restore = () => { if (I.breakpoints.get(key) === temp) I.breakpoints.delete(key); I.off('paused', restore); I.off('done', restore); I.off('error', restore); I.off('halted', restore); };
      const arm = () => { if (!I.breakpoints.has(key)) I.breakpoints.set(key, temp); I.on('paused', restore); I.on('done', restore); I.on('error', restore); I.on('halted', restore); };
      if (I.state === 'paused') { arm(); this.continue(); return; }
      if (this.isBusy()) return;
      this.syncBreakpoints();
      if (this.active !== d) this.activate(d);
      this.runActive({ arm });
    }

    // ---- keyboard ---------------------------------------------------------------------------------------
    bindKeys() {
      document.addEventListener('keydown', (e) => {
        if (LG.UI.anyModalOpen()) return;
        const k = e.key;
        const ctrl = e.ctrlKey || e.metaKey;
        const handled = () => { e.preventDefault(); e.stopPropagation(); };
        if (k === 'F5' && !e.shiftKey) { handled(); this.runOrContinue(); return; }
        if (k === 'F5' && e.shiftKey) { handled(); this.stop(); return; }
        if (k === 'F11' && e.shiftKey) { handled(); this.step('out'); return; }
        if (k === 'F11' || (k === 'F8' && !e.shiftKey)) { handled(); this.step('into'); return; }
        if (k === 'F8' && e.shiftKey) { handled(); this.step('out'); return; }
        if (k === 'F10') { handled(); this.step('over'); return; }
        if (k === 'F9' && this.active) { handled(); this.toggleBreakpoint(this.active.path, this.active.editor.cursor().line); return; }
        if (k === 'F4') { handled(); this.toggleBigWorld(); return; }
        if (k === 'F1' && !(e.target && e.target.classList && e.target.classList.contains('ed-ta'))) { handled(); if (LG.Help) LG.Help.open(this); return; }
        if ((k === 'Pause' || k === 'Cancel') || (ctrl && k === 'Pause')) { handled(); this.pause(); return; }
        if (ctrl && (k === 's' || k === 'S')) { handled(); if (e.shiftKey) this.saveAs(); else this.save(); return; }
        if (ctrl && (k === 'o' || k === 'O')) { handled(); LG.Files.openDialog(this); return; }
        if (e.altKey && (k === 'n' || k === 'N' || e.code === 'KeyN')) { handled(); LG.Files.newFile(this); return; }
        if (e.altKey && (k === 'w' || k === 'W' || e.code === 'KeyW')) { handled(); if (this.active) this.closeDoc(this.active); return; }
        if (ctrl && (k === '=' || k === '+')) { handled(); this.zoomCode(1); return; }
        if (ctrl && k === '-') { handled(); this.zoomCode(-1); return; }
        if (ctrl && k === '`') { handled(); this.commander.focus(); return; }
        if (k === 'Escape' && document.getElementById('worldCard').classList.contains('fullscreen') && !this.isBusy()) { this.toggleBigWorld(false); return; }
        // Escape inside the callout's value editor cancels the edit there; anywhere else it closes the callout
        if (k === 'Escape' && this.callout.isOpen() && !(e.target && e.target.tagName === 'INPUT' && this.callout.el.contains(e.target))) { this.callout.hide(); }
      }, true);
    }
    shortcutsDialog() {
      const rows = [
        ['F5', 'Run, or continue a paused program'], ['Shift+F5', 'Stop'], ['Ctrl+Break', 'Pause'],
        ['F11 or F8', 'Step into (one instruction)'], ['F10', 'Step over'], ['Shift+F11', 'Step out of the procedure'], ['F9', 'Breakpoint on the current line'],
        ['F4', 'Big turtle world'], ['F1', 'Help on the word under the cursor'], ['Ctrl+S', 'Save'], ['Ctrl+Shift+S', 'Save as'], ['Ctrl+O', 'Open'],
        ['Alt+N', 'New program'], ['Alt+W', 'Close the program'], ['Ctrl+F / Ctrl+H', 'Find / replace'], ['Ctrl+G', 'Go to line'], ['Ctrl+/', 'Comment or uncomment lines'],
        ['Ctrl+ =/-', 'Bigger or smaller code'], ['Ctrl+`', 'Jump to the command center'], ['↑ ↓ in the command center', 'Earlier commands'], ['Tab in the command center', 'Complete a name'],
      ];
      LG.UI.alert('Keyboard shortcuts', '<table style="border-spacing:0 6px">' + rows.map(([k, v]) => `<tr><td style="padding-right:16px"><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('') + '</table>');
    }
    async findDialog(replace) {
      if (!this.active) return;
      const q = await LG.UI.prompt(replace ? 'Replace' : 'Find', 'Find', this.lastFind || '');
      if (!q) return;
      this.lastFind = q;
      if (replace) {
        // Ctrl+H: replace every match (one undo step)
        const w = await LG.UI.prompt('Replace', 'Replace every "' + q + '" with', '', { ok: 'Replace all' });
        if (w === null || w === undefined) return;
        const n = this.active.editor.replaceAll(q, w, {});
        LG.UI.toast(n ? 'Replaced ' + n + ' time' + (n === 1 ? '' : 's') : 'Not found: ' + q, n ? 'ok' : undefined);
        return;
      }
      const r = this.active.editor.find(q, {}, this.active.editor.ta.selectionEnd);
      if (!r || !r.count) LG.UI.toast('Not found: ' + q);
    }
    async gotoLineDialog() {
      if (!this.active) return;
      const v = await LG.UI.prompt('Go to line', 'Line number', '');
      const n = parseInt(v, 10);
      if (n > 0) this.goto(this.active.path, n - 1);
    }

    // ---- dialogs --------------------------------------------------------------------------------------
    settingsDialog() {
      const themes = [['auto', 'Match my device', ['#fffcf5', '#151922']], ['paper', 'Paper', ['#fffcf5', '#2c8a55']], ['chalk', 'Chalkboard', ['#1f3329', '#f4d35e']], ['blueprint', 'Blueprint', ['#0f3560', '#6fd3ff']], ['midnight', 'Midnight', ['#151922', '#4fd18b']], ['retro', 'Green screen', ['#020802', '#39ff6a']]];
      const box = h('div');
      const sw = h('div.swatches');
      const render = () => {
        sw.innerHTML = '';
        for (const [k, label, [a, b]] of themes) {
          const s = h('button.swatch' + (this.settings.theme === k ? '.on' : ''), { type: 'button', id: 'theme-' + k, 'aria-pressed': String(this.settings.theme === k) },
            h('div.sw', { style: { background: `linear-gradient(135deg, ${a} 60%, ${b} 60%)` } }), label);
          s.addEventListener('click', () => { this.setTheme(k); render(); });
          sw.appendChild(s);
        }
      };
      render();
      const size = h('input', { type: 'range', min: '10', max: '26', value: String(this.settings.fontSize), 'aria-label': 'Code size', id: 'setFont' });
      size.addEventListener('input', () => { this.settings.fontSize = +size.value; this.saveSettings(); this.applyTheme(); });
      const check = (label, key, after) => {
        const c = h('input', { type: 'checkbox', id: 'set-' + key });
        c.checked = !!this.settings[key];
        c.addEventListener('change', () => { this.settings[key] = c.checked; this.saveSettings(); if (after) after(); });
        return h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', fontWeight: '500' } }, c, label);
      };
      box.append(h('label', 'Theme'), sw, h('label', 'Code size'), size,
        h('div', { style: { marginTop: '10px' } },
          check('Fresh start on every run (forget old procedures and clear the drawing)', 'freshRun'),
          check('Save my programs automatically', 'autosave'),
          check('Graph paper grid behind the drawing', 'grid', () => this.turtleView.toggleGrid(this.settings.grid)),
          check('Show buried names in the Variables panel', 'showBuried', () => this.inspector.render())));
      LG.UI.modal({ title: 'Looks and settings', body: box, buttons: [{ label: 'Done', value: true, primary: true }], enterValue: true });
    }
    aboutDialog() {
      LG.UI.alert('About Lohgo', `<p><b>Lohgo</b> version @@VERSION@@</p>
        <p>A Logo programming studio for the browser: turtle graphics, a debugger that walks through recursion,
        lessons for beginners and a library of example programs. The language follows Berkeley Logo, with
        turtle, colour and event commands from MSWLogo and FMSLogo.</p>
        <p>Runs entirely in your browser; nothing is uploaded.</p>
        <p>Copyright &copy; 2026 Jyotiprakash Mishra &lt;mail@jyotiprakash.org&gt;<br>
        <a href="https://lohgo.jyotiprakash.org" target="_blank" rel="noopener">lohgo.jyotiprakash.org</a> &middot;
        <a href="https://github.com/ShowMeTheStack/lohgo" target="_blank" rel="noopener">source code</a></p>
        <p>Free software under the GNU General Public License, version 3 or later, with an attribution term (section 7(b)):
        derived works must keep the notice <i>Based on "Lohgo" by Jyotiprakash Mishra (https://lohgo.jyotiprakash.org)</i>.
        There is NO WARRANTY.</p>
        <p class="muted">Logo is not a trademark. MSWLogo and FMSLogo are the work of their authors; Berkeley Logo (UCBLogo) is by
        Brian Harvey and others at the University of California, Berkeley. Lohgo is an independent implementation, is not affiliated
        with or endorsed by any of them, and contains no code from them.</p>
        <p><a href="#" id="aboutAuthorLink">About the author&hellip;</a></p>`);
      // close this dialog, then open the author's page
      const a = document.getElementById('aboutAuthorLink');
      if (a) a.addEventListener('click', (e) => { e.preventDefault(); const ok = a.closest('.modal').querySelector('.modal-foot button'); if (ok) ok.click(); LG.authorDialog(); });
    }
    async savePicture() {
      const url = this.turtleView.snapshotDataURL();
      const bin = atob(url.split(',')[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const name = (this.active ? this.active.name.replace(/\.[^.]*$/, '') : 'drawing') + '.png';
      LG.UI.download(name, bytes, 'image/png');
    }

    // ---- welcome --------------------------------------------------------------------------------------
    welcome() {
      const wrap = document.getElementById('worldWrap');
      const ex = (code) => { const c = h('code', { title: 'Click to run it', role: 'button', tabindex: '0' }, code); c.addEventListener('click', () => { this.commander.echo(code); this.runCommand(code); }); c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.click(); } }); return c; };
      this.welcomeEl = h('div.welcome#welcome', h('div.bubble',
        h('h2', 'Hello! I am your turtle.'),
        h('p', 'Type a command below and press Enter, or click one of these:'),
        h('div.row', ex('fd 100 rt 90 fd 100'), ex('repeat 36 [fd 10 rt 10]'), ex('repeat 5 [fd 120 rt 144]')),
        h('p', { style: { marginTop: '10px', marginBottom: '0' } }, 'Press ', h('kbd', 'F5'), ' to run the program in the editor.'),
        h('p.welcome-by', 'Made by ', h('a', { href: '#', id: 'welcomeAuthor', onclick: (e) => { e.preventDefault(); LG.authorDialog(); } }, 'Jyotiprakash Mishra'))));
      wrap.appendChild(this.welcomeEl);
    }
    hideWelcome() { if (this.welcomeEl) { this.welcomeEl.remove(); this.welcomeEl = null; } }

    // ---- status and buttons -------------------------------------------------------------------------
    setStatus(msg) { this.statusMsg = msg; document.getElementById('statusMsg').textContent = msg || ''; }
    updateStatus() {
      const el = document.getElementById('sbCursor');
      if (!el) return;
      if (!this.active) { el.textContent = ''; return; }
      const c = this.active.editor.cursor();
      el.textContent = 'Ln ' + (c.line + 1) + ', Col ' + (c.col + 1);
    }
    updateUI() {
      const I = this.interp;
      const st = I.state;
      const busy = this.isBusy();
      const paused = st === 'paused';
      this.tb.run.disabled = busy;
      this.tb.run.querySelector('.lbl').textContent = paused ? 'Continue' : 'Run';
      this.tb.run.title = paused ? 'Continue (F5)' : 'Run the program in the editor (F5)';
      this.tb.pause.disabled = !busy;
      this.tb.stop.disabled = st === 'idle';
      this.tb.into.disabled = busy;
      this.tb.over.disabled = busy;
      this.tb.out.disabled = !paused;
      const labels = { idle: 'Ready', running: 'Running', waiting: 'Running', input: 'Waiting', paused: 'Paused', error: 'Error' };
      this.statePill.textContent = labels[st] || st;
      this.statePill.className = 'state ' + (busy ? 'running' : paused ? 'paused' : st === 'error' ? 'error' : '');
      this.projLabel.textContent = this.active ? this.active.path : '';
      document.title = (this.active ? this.active.name + ' · ' : '') + 'Lohgo';
    }
  }

  LG.App = App;
  LG.SPEEDS = SPEEDS;
  if (LG.isBrowser) {
    const start = () => { try { new App(); } catch (e) { console.error(e); document.body.insertAdjacentHTML('afterbegin', '<pre style="color:red;padding:12px">' + LG.escapeHtml(e.stack || String(e)) + '</pre>'); } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
})(LG);
