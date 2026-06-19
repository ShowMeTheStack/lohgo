// The command center: Logo's listener. Type instructions, see what PRINT says, answer
// READLIST, define procedures with TO ... END right at the prompt.
(function (LG) {
  'use strict';
  const { h, icon } = LG.UI;
  const D = LG.Data;
  const MAX_NODES = 4000;

  class Commander extends LG.Emitter {
    constructor(app) {
      super();
      this.app = app;
      this.box = document.getElementById('transcript');
      this.input = document.getElementById('cmdInput');
      this.inputBox = document.getElementById('cmdInputBox');
      this.prompt = document.getElementById('cmdPrompt');
      this.hist = LG.UI.storage.get('cmdHistory', []);
      this.hpos = this.hist.length;
      this.defining = null;        // lines of a TO definition typed at the prompt
      this.pendingText = '';
      this.color = null;
      this.flushPending = false;
      this.buildTabs();
      this.bind();
    }
    buildTabs() {
      const tabs = document.getElementById('cmdTabs');
      tabs.setAttribute('role', 'tablist');
      this.tabCmd = h('button.ctab.active', { type: 'button', id: 'tabCommands', role: 'tab', 'aria-selected': 'true' }, 'Commands');
      this.tabProb = h('button.ctab', { type: 'button', id: 'tabProblems', role: 'tab', 'aria-selected': 'false' }, 'Problems', this.probBadge = h('span.badge.hidden', '0'));
      tabs.append(this.tabCmd, this.tabProb);
      this.tabCmd.addEventListener('click', () => this.showTab('commands'));
      this.tabProb.addEventListener('click', () => this.showTab('problems'));
      this.probBox = h('div#problems.hidden', { style: { flex: '1', minHeight: '0', overflow: 'auto' } });
      this.box.parentNode.insertBefore(this.probBox, this.box);
      const tools = document.getElementById('cmdTools');
      const clr = h('button.ibtn', { type: 'button', title: 'Clear the text (Ctrl+L)', 'aria-label': 'Clear text', id: 'tbClearText' }, icon('clear'));
      clr.addEventListener('click', () => this.clear());
      tools.appendChild(clr);
    }
    showTab(t) {
      const prob = t === 'problems';
      this.tabCmd.classList.toggle('active', !prob);
      this.tabProb.classList.toggle('active', prob);
      this.tabCmd.setAttribute('aria-selected', String(!prob));
      this.tabProb.setAttribute('aria-selected', String(prob));
      this.probBox.classList.toggle('hidden', !prob);
      this.box.classList.toggle('hidden', prob);
      this.inputBox.classList.toggle('hidden', prob);
      if (!prob) this.input.focus();
    }

    // ---- output -------------------------------------------------------------------------------
    /** Text written by the program (PRINT, TYPE, SHOW) */
    write(text) {
      const app = this.app;
      app.outputLen = (app.outputLen || 0) + text.length;
      app.outputTail = ((app.outputTail || '') + text).slice(-20000);
      if (this.page) { this.pageWrite(text); return; }
      this.pendingText += text;
      if (this.pendingText.length > 200000) this.flush();
      else if (!this.flushPending) { this.flushPending = true; requestAnimationFrame(() => this.flush()); }
    }
    flush() {
      this.flushPending = false;
      if (!this.pendingText) return;
      const t = this.pendingText;
      this.pendingText = '';
      const last = this.box.lastChild;
      if (last && last.nodeType === 3 && !this.color) last.appendData(t);
      else if (last && last.classList && last.classList.contains('out') && last.dataset.color === (this.color || '')) last.appendChild(document.createTextNode(t));
      else {
        const span = h('span.out', t);
        if (this.color) { span.style.color = this.color; span.dataset.color = this.color; }
        this.box.appendChild(span);
      }
      this.trim();
      this.scroll();
    }
    trim() {
      while (this.box.childNodes.length > MAX_NODES) this.box.removeChild(this.box.firstChild);
      const first = this.box.firstChild;
      if (first && first.nodeType === 3 && first.length > 400000) first.deleteData(0, first.length - 300000);
    }
    scroll() {
      const b = this.box;
      b.scrollTop = b.scrollHeight;
    }
    line(cls, text) {
      this.flush();
      const last = this.box.lastChild;
      const txt = last ? (last.nodeType === 3 ? last.data : last.textContent) : '';
      if (txt && !txt.endsWith('\n')) this.box.appendChild(document.createTextNode('\n'));
      const el = h('span.' + cls, text);
      this.box.appendChild(el);
      this.box.appendChild(document.createTextNode('\n'));
      this.scroll();
      return el;
    }
    echo(text) { this.endPage(); return this.line('echo', text); }

    // ---- a positioned text page (CLEARTEXT / SETCURSOR) ----------------------------------------
    /** Start a page where SETCURSOR can move around and text overwrites what is there */
    startPage() {
      if (this.page) return;
      this.flush();
      const el = h('span.out.page');
      this.box.appendChild(el);
      this.page = { el, lines: [''], x: 0, y: 0 };
    }
    endPage() { if (this.page) { this.page = null; this.box.appendChild(document.createTextNode('\n')); } }
    setCursor(x, y) {
      this.startPage();
      const p = this.page;
      p.x = Math.max(0, x); p.y = Math.max(0, Math.min(y, 400));
      while (p.lines.length <= p.y) p.lines.push('');
    }
    cursor() { return this.page ? [this.page.x, this.page.y] : [0, 0]; }
    pageWrite(text) {
      const p = this.page;
      for (const ch of text) {
        if (ch === '\n') { p.y++; p.x = 0; if (p.lines.length <= p.y) p.lines.push(''); continue; }
        let l = p.lines[p.y];
        if (l.length < p.x) l = l.padEnd(p.x);
        p.lines[p.y] = l.slice(0, p.x) + ch + l.slice(p.x + 1);
        p.x++;
      }
      if (!this.pageTimer) this.pageTimer = requestAnimationFrame(() => { this.pageTimer = 0; if (this.page) { this.page.el.textContent = this.page.lines.join('\n'); this.scroll(); } });
    }
    note(text) { return this.line('note', text); }
    clear() { this.flush(); this.page = null; this.box.innerHTML = ''; }
    /** CLEARTEXT from a program: an empty page with the cursor at the top */
    clearText() { this.clear(); this.startPage(); }

    /** Show an error the way Logo does, with where it happened and a hint */
    error(e, opts) {
      opts = opts || {};
      const el = this.line('err', e.message || String(e));
      const I = this.app.interp;
      const proc = e.procName;
      const path = e.src !== undefined ? I.filePath(e.src) : null;
      if (proc) el.appendChild(h('span.in', '\n  in ' + proc));
      if (e.ln !== undefined && path) {
        const lineText = this.app.lineText(path, e.ln - 1).trim();
        if (lineText) el.appendChild(h('span.in', '\n  ' + lineText));
        const where = h('span.in.clickable', { title: 'Double-click to see the line' }, '\n  ' + path.replace(/^.*\//, '') + ', line ' + e.ln);
        el.appendChild(where);
        el.addEventListener('dblclick', () => this.app.gotoError(e));
        el.addEventListener('click', (ev) => { if (ev.detail === 1 && this.app.isTouch) this.app.gotoError(e); });
      }
      const hint = LG.ERROR_HINTS[e.code];
      if (hint && !opts.noHint) this.line('hint', hint);
      return el;
    }

    // ---- problems -----------------------------------------------------------------------------
    setProblems(list) {
      this.problems = list;
      this.probBox.innerHTML = '';
      this.probBadge.textContent = String(list.length);
      this.probBadge.classList.toggle('hidden', !list.length);
      if (!list.length) { this.probBox.appendChild(h('div.empty', 'No problems. Errors from running your program are listed here.')); return; }
      list.forEach((p, i) => {
        const row = h('div.list-row.clickable', { tabindex: '0', title: 'Double-click to go to the line', id: 'problem' + i },
          h('span.err', '●'), h('span.grow', p.message), h('span.muted.code', (p.path ? p.path.replace(/^.*\//, '') : '') + (p.ln ? ':' + p.ln : '')));
        row.addEventListener('dblclick', () => this.app.gotoError(p.err));
        row.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.app.gotoError(p.err); } });
        if (this.app.isTouch) row.addEventListener('click', () => this.app.gotoError(p.err));
        this.probBox.appendChild(row);
      });
    }

    // ---- input --------------------------------------------------------------------------------
    bind() {
      const ta = this.input;
      ta.addEventListener('input', () => this.autosize());
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.submit(); return; }
        if (e.key === 'ArrowUp' && !ta.value.slice(0, ta.selectionStart).includes('\n')) { e.preventDefault(); this.history(-1); return; }
        if (e.key === 'ArrowDown' && !ta.value.slice(ta.selectionEnd).includes('\n')) { e.preventDefault(); this.history(1); return; }
        if (e.key === 'Tab' && !e.shiftKey && ta.value.trim()) { e.preventDefault(); this.complete(); return; }
        if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); this.clear(); return; }
        if (e.key === 'Escape') {
          if (this.defining) { this.defining = null; this.setPrompt(); this.note('Definition cancelled.'); e.preventDefault(); return; }
          if (ta.value) { ta.value = ''; this.autosize(); e.preventDefault(); }
        }
      });
      this.box.addEventListener('mouseup', () => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) this.input.focus({ preventScroll: true });
      });
    }
    autosize() {
      const ta = this.input;
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
    setPrompt() {
      const reading = this.reading;
      this.inputBox.classList.toggle('reading', !!reading);
      this.prompt.textContent = reading ? '»' : this.defining ? '>' : '?';
      this.input.placeholder = reading ? 'The program is waiting for you to type something and press Enter'
        : this.defining ? 'Type the lines of ' + this.defining.name + ', then END' : '';
    }
    history(dir) {
      if (!this.hist.length) return;
      if (this.hpos === this.hist.length && dir < 0) this.draft = this.input.value;
      this.hpos = LG.clamp(this.hpos + dir, 0, this.hist.length);
      this.input.value = this.hpos === this.hist.length ? (this.draft || '') : this.hist[this.hpos];
      this.autosize();
      const n = this.input.value.length;
      this.input.setSelectionRange(n, n);
    }
    complete() {
      const ta = this.input;
      const before = ta.value.slice(0, ta.selectionStart);
      const m = /([A-Za-z.?][\w.?]*)$/.exec(before);
      if (!m) return;
      const pre = m[1].toLowerCase();
      const I = this.app.interp;
      const names = [...new Set([...I.procs.values()].map((p) => p.name.toLowerCase()).concat([...I.prims.keys()]))].filter((n) => n.startsWith(pre) && n !== pre).sort();
      if (!names.length) return;
      let common = names[0];
      for (const n of names) while (!n.startsWith(common)) common = common.slice(0, -1);
      if (common.length > pre.length) {
        ta.setRangeText(common.slice(pre.length) + (names.length === 1 ? ' ' : ''), ta.selectionStart, ta.selectionEnd, 'end');
      } else if (names.length > 1) {
        this.note(names.slice(0, 40).join('  ') + (names.length > 40 ? '  …' : ''));
      }
    }
    focus() { this.input.focus(); }
    focusForKeys() {
      // phones: bring up the keyboard; characters typed go to the program
      this.keyMode = true;
      this.input.focus();
      LG.UI.toast('Type on the keyboard: keys go to your program. Tap the turtle world when you are done.', '', 3500);
    }
    /** The program wants a line of input (READLIST, READWORD) */
    startReading(req) {
      this.reading = req;
      this.setPrompt();
      if (this.app.view !== 'turtle' && this.app.isPhone()) this.app.setView('turtle');
      this.input.focus({ preventScroll: true });
    }
    stopReading() { this.reading = null; this.setPrompt(); }

    submit() {
      const ta = this.input;
      const text = ta.value;
      ta.value = '';
      this.autosize();
      if (this.keyMode && this.app.isBusy() && !this.reading) {
        for (const ch of text) this.app.turtleView.pushKey(ch);
        this.app.turtleView.pushKey('\n');
        return;
      }
      if (this.reading) {
        this.echo(text).classList.add('answer');
        this.reading = null;
        this.setPrompt();
        this.app.interp.provideInput(text);
        return;
      }
      if (text.trim()) {
        if (this.hist[this.hist.length - 1] !== text) this.hist.push(text);
        if (this.hist.length > 300) this.hist.splice(0, this.hist.length - 300);
        LG.UI.storage.set('cmdHistory', this.hist);
      }
      this.hpos = this.hist.length;
      this.draft = '';
      this.run(text);
    }
    /** Run what was typed at the prompt */
    run(text) {
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (this.defining) {
          this.echo(line).classList.add('def');
          if (/^\s*end\s*$/i.test(line)) { this.finishDefinition(); continue; }
          this.defining.lines.push(line);
          continue;
        }
        if (/^\s*(to|\.macro)\s+\S/i.test(line)) {
          this.echo(line);
          let name = '';
          try { name = LG.Parser.parseTitle(LG.Reader.readList(line)).name; } catch (e) { this.error(e); continue; }
          if (this.app.interp.isPrim(name) && !this.app.interp.redefOk()) { this.error(new LG.LogoError(22, { proc: name })); continue; }
          this.defining = { name, lines: [line] };
          this.setPrompt();
          continue;
        }
        // instructions run up to the next TO line; the definition is taken once they finish
        const next = lines.findIndex((l, j) => j > i && /^\s*(to|\.macro)\s+\S/i.test(l));
        const rest = lines.slice(i, next < 0 ? undefined : next).join('\n');
        if (!rest.trim() && next < 0) { this.echo(''); return; }
        if (rest.trim()) { this.echo(rest); this.app.runCommand(rest); }
        if (next >= 0) this.runAfter(lines.slice(next).join('\n'));
        return;
      }
      this.setPrompt();
    }
    /** Take the remaining typed lines once the instructions before them have finished */
    runAfter(text) {
      const I = this.app.interp;
      if (!I.isBusy()) { this.run(text); return; }
      const h = () => { if (I.isBusy()) return; I.off('state', h); setTimeout(() => this.run(text), 0); };
      I.on('state', h);
    }
    finishDefinition() {
      const def = this.defining;
      this.defining = null;
      this.setPrompt();
      const I = this.app.interp;
      try {
        const items = I.parseSource(def.lines.join('\n') + '\nend', null);
        for (const it of items) if (it.kind === 'proc') { const p = I.defineProc(Object.assign(it.spec, { file: null, src: undefined })); this.line('ok', p.name + ' defined'); }
        this.app.workspaceChanged();
      } catch (e) { this.error(e); }
    }
  }

  LG.Commander = Commander;
})(LG);
