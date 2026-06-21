// The debugger panels: variables, call stack, watches, breakpoints and history.
(function (LG) {
  'use strict';
  const { h, icon } = LG.UI;
  const Dbg = () => LG.Debug;

  class Inspector {
    constructor(app) {
      this.app = app;
      this.tab = 'vars';
      this.tree = new LG.VarTree({
        app,
        canEdit: (e) => this.canEdit(e),
        refresh: () => this.renderVars(),
        onEdited: () => { this.app.afterEdit(); },
      });
      this.watches = LG.UI.storage.get('watches', []);   // [{expr, mode: null|'change'|'true'}]
      this.build();
    }
    build() {
      const tabs = document.getElementById('inspTabs');
      const body = document.getElementById('inspBody');
      const defs = [
        ['vars', 'Variables'], ['stack', 'Call Stack'], ['watch', 'Watch'], ['bps', 'Breakpoints'], ['hist', 'History'],
      ];
      this.tabs = {};
      this.panes = {};
      for (const [k, label] of defs) {
        const b = h('button.ctab', { type: 'button', role: 'tab', id: 'itab-' + k, 'aria-selected': 'false' }, label);
        if (k === 'watch' || k === 'bps') b.appendChild(h('span.badge.soft.hidden', '0'));
        b.addEventListener('click', () => this.show(k));
        tabs.appendChild(b);
        this.tabs[k] = b;
        const pane = h('div.insp-pane', { id: 'ipane-' + k, role: 'tabpanel' });
        body.appendChild(pane);
        this.panes[k] = pane;
      }
      // variables
      this.varTools = h('div.insp-tools', this.frameLabel = h('span.muted', { style: { fontSize: '12px', flex: '1', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }),
        this.filter = h('input', { type: 'text', placeholder: 'Filter', 'aria-label': 'Filter variables', style: { flex: '0 1 140px' } }));
      this.filter.addEventListener('input', () => this.renderVars());
      this.varBody = h('div');
      this.panes.vars.append(this.varTools, this.varBody);
      // watch
      const wIn = h('input', { type: 'text', placeholder: 'Watch an expression, e.g. :size * 2', 'aria-label': 'New watch expression', id: 'watchInput', spellcheck: 'false', autocapitalize: 'off' });
      const wAdd = h('button.small-btn', { type: 'button', id: 'watchAdd' }, 'Add');
      const add = () => { if (wIn.value.trim()) { this.addWatch(wIn.value.trim()); wIn.value = ''; } };
      wAdd.addEventListener('click', add);
      wIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
      this.watchBody = h('div');
      this.panes.watch.append(h('div.insp-tools', wIn, wAdd), this.watchBody);
      this.show('vars');
    }
    show(k) {
      this.tab = k;
      for (const [n, b] of Object.entries(this.tabs)) { b.classList.toggle('active', n === k); b.setAttribute('aria-selected', String(n === k)); }
      for (const [n, p] of Object.entries(this.panes)) p.classList.toggle('active', n === k);
      this.render();
    }
    render() {
      this.renderBadges();
      if (this.tab === 'vars') this.renderVars();
      else if (this.tab === 'stack') this.renderStack();
      else if (this.tab === 'watch') this.renderWatch();
      else if (this.tab === 'bps') this.renderBps();
      else if (this.tab === 'hist') this.renderHistory();
    }
    renderBadges() {
      const set = (k, n) => { const b = this.tabs[k].querySelector('.badge'); if (b) { b.textContent = String(n); b.classList.toggle('hidden', !n); } };
      set('watch', this.watches.length);
      let n = 0;
      for (const m of this.app.breakpoints.values()) n += m.size;
      set('bps', n);
    }

    // ---- variables --------------------------------------------------------------------------
    inspectable() { const s = this.app.interp.state; return s === 'paused' || s === 'error'; }
    canEdit(e) {
      if (!e.ref) return false;
      if (e.ref.kind === 'global' || e.ref.kind === 'prop') return !this.app.isBusy() || this.inspectable();
      return this.inspectable();
    }
    frame() {
      const fr = Dbg().frames(this.app.interp);
      if (!fr.length) return null;
      const i = this.app.selFrame === null || this.app.selFrame === undefined || this.app.selFrame >= fr.length ? fr.length - 1 : this.app.selFrame;
      return fr[i];
    }
    renderVars() {
      const I = this.app.interp;
      const q = this.filter.value.trim().toLowerCase();
      const keep = (list) => (q ? list.filter((e) => e.name.toLowerCase().includes(q)) : list);
      const sections = [];
      const f = this.inspectable() ? this.frame() : null;
      if (f) {
        this.frameLabel.textContent = (f.proc ? 'In ' + f.title : 'Top level') + (f.line ? '   · line ' + f.line : '');
        if (f.proc || (f.scope && f.scope !== f.act)) sections.push({ title: f.proc ? 'Inputs and locals of ' + f.proc.name : 'Loop variables', entries: keep(Dbg().frameEntries(I, f)), key: 'frame' + f.index, empty: 'no inputs or local variables' });
      } else {
        this.frameLabel.textContent = this.app.isBusy() ? 'Running. Pause to look inside procedures.' : 'Workspace';
      }
      sections.push({ title: 'Global variables', entries: keep(Dbg().globals(I, !!this.app.settings.showBuried)), key: 'g', empty: 'none yet (MAKE "name value creates one)' });
      const pl = Dbg().plists(I);
      if (pl.length) sections.push({ title: 'Property lists', entries: keep(pl), key: 'p' });
      this.tree.render(this.varBody, sections);
    }

    // ---- call stack -------------------------------------------------------------------------
    renderStack() {
      const p = this.panes.stack;
      p.innerHTML = '';
      const frames = this.inspectable() ? Dbg().frames(this.app.interp) : [];
      if (!frames.length) {
        p.appendChild(h('div.empty', this.app.isBusy() ? 'The program is running. Pause it (or set a breakpoint) to see which procedures are active.' : 'Nothing is running. When your program pauses, every procedure that is waiting for another one to finish is listed here, the newest at the top.'));
        return;
      }
      const sel = this.app.selFrame === null || this.app.selFrame === undefined || this.app.selFrame >= frames.length ? frames.length - 1 : this.app.selFrame;
      p.appendChild(h('div.vsec', frames.length + (frames.length === 1 ? ' level' : ' levels') + (frames.length > 1 ? ' · newest first' : '')));
      for (let i = frames.length - 1; i >= 0; i--) {
        const f = frames[i];
        const row = h('div.frame-row' + (i === sel ? '.sel' : ''), { tabindex: '0', role: 'button', id: 'frame' + i, 'aria-current': i === sel ? 'true' : null },
          h('span.lvl', '#' + i), h('span.t', f.title), h('span.where', (f.file ? f.file.replace(/^.*\//, '') : '') + (f.line ? ':' + f.line : '')));
        const pick = () => { this.app.selectFrame(i); };
        row.addEventListener('click', pick);
        row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
        p.appendChild(row);
        if (frames.length > 400 && i === frames.length - 200) {
          p.appendChild(h('div.empty', '… ' + (frames.length - 400) + ' more levels …'));
          i = 200;
        }
      }
    }

    // ---- watches ------------------------------------------------------------------------------
    addWatch(expr) {
      this.watches.push({ expr, mode: null });
      this.saveWatches();
      this.show('watch');
    }
    saveWatches() {
      LG.UI.storage.set('watches', this.watches);
      this.app.syncWatchpoints();
      this.renderBadges();
    }
    watchValue(w) {
      const I = this.app.interp;
      const f = this.inspectable() ? this.frame() : null;
      try { return { ok: true, value: I.peek(w.expr, f ? f.scope : null) }; } catch (e) { return { ok: false, msg: e.message }; }
    }
    renderWatch() {
      const b = this.watchBody;
      b.innerHTML = '';
      if (!this.watches.length) { b.appendChild(h('div.empty', 'Type an expression above, like :size or count :list, to see its value every time the program pauses.')); return; }
      this.watches.forEach((w, i) => {
        const r = this.watchValue(w);
        const mode = h('select', { 'aria-label': 'Break when', title: 'Stop the program when this happens', style: { height: '26px', borderRadius: '7px', border: '1px solid var(--line)', background: 'var(--paper)' } },
          h('option', { value: '' }, 'just watch'), h('option', { value: 'change' }, 'stop when it changes'), h('option', { value: 'true' }, 'stop when true'));
        mode.value = w.mode || '';
        mode.addEventListener('change', () => { w.mode = mode.value || null; this.saveWatches(); });
        const del = h('button.ibtn', { type: 'button', title: 'Remove watch', 'aria-label': 'Remove watch ' + w.expr }, icon('x'));
        del.addEventListener('click', () => { this.watches.splice(i, 1); this.saveWatches(); this.renderWatch(); });
        b.appendChild(h('div.list-row', { id: 'watch' + i },
          h('span.code', { style: { color: 'var(--c-var)', minWidth: '0', flex: '0 1 40%', overflow: 'hidden', textOverflow: 'ellipsis' } }, w.expr),
          h('span.grow.code', { style: { color: r.ok ? 'var(--ink)' : 'var(--muted)' } }, r.ok ? Dbg().brief(r.value) : r.msg),
          mode, del));
      });
    }

    // ---- breakpoints -----------------------------------------------------------------------------
    renderBps() {
      const p = this.panes.bps;
      p.innerHTML = '';
      const all = [];
      for (const [path, m] of this.app.breakpoints) for (const [line, bp] of m) all.push({ path, line, bp });
      if (!all.length) { p.appendChild(h('div.empty', 'Click in the margin next to a line number to stop the program there. Right-click a breakpoint to give it a condition.')); return; }
      const tools = h('div.insp-tools', h('span.muted.grow', { style: { fontSize: '12px', flex: '1' } }, all.length + ' breakpoint' + (all.length === 1 ? '' : 's')));
      const clr = h('button.small-btn', { type: 'button', id: 'bpClearAll' }, 'Remove all');
      clr.addEventListener('click', () => this.app.clearBreakpoints());
      tools.appendChild(clr);
      p.appendChild(tools);
      all.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
      for (const x of all) {
        const cb = h('input', { type: 'checkbox', 'aria-label': 'Enabled' });
        cb.checked = !x.bp.disabled;
        cb.addEventListener('change', () => { x.bp.disabled = !cb.checked; this.app.breakpointsChanged(x.path); });
        const cond = h('button.small-btn', { type: 'button', title: 'Condition' }, x.bp.cond ? 'if ' + x.bp.cond : 'add condition');
        cond.addEventListener('click', () => this.app.conditionalBreakpoint(x.path, x.line));
        const del = h('button.ibtn', { type: 'button', title: 'Remove', 'aria-label': 'Remove breakpoint' }, icon('x'));
        del.addEventListener('click', () => this.app.toggleBreakpoint(x.path, x.line));
        const row = h('div.list-row.clickable', cb, h('span.grow.code', x.path.replace(/^.*\//, '') + ':' + (x.line + 1) + '  ' + this.app.lineText(x.path, x.line).trim()), cond, del);
        row.addEventListener('click', (e) => { if (e.target === row || e.target.classList.contains('grow')) this.app.goto(x.path, x.line); });
        p.appendChild(row);
      }
    }

    // ---- history ---------------------------------------------------------------------------------
    renderHistory() {
      const p = this.panes.hist;
      p.innerHTML = '';
      const I = this.app.interp;
      const items = I.recent().filter((x) => x.node && x.node.ln !== undefined).slice(-120).reverse();
      if (!items.length) { p.appendChild(h('div.empty', 'The last instructions your program ran show up here, newest first, so you can see how it got where it is.')); return; }
      for (const it of items) {
        const path = I.filePath(it.node.src);
        const row = h('div.list-row' + (path ? '.clickable' : ''),
          h('span.muted', { style: { minWidth: '86px', fontSize: '12px' } }, it.act && it.act.proc ? it.act.proc.name : 'top level'),
          h('span.grow.code', path ? this.app.lineText(path, it.node.ln - 1).trim() : ''),
          h('span.muted', { style: { fontSize: '11.5px' } }, path ? path.replace(/^.*\//, '') + ':' + it.node.ln : ''));
        if (path) row.addEventListener('click', () => this.app.goto(path, it.node.ln - 1));
        p.appendChild(row);
      }
    }
  }

  LG.Inspector = Inspector;
})(LG);
