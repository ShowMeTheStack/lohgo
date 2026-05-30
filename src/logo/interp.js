// The Logo evaluator.
//
// Instructions run inside JavaScript generators. A procedure call does not recurse on the
// JavaScript stack: the generator yields a request and a driver loop pushes a new frame onto
// its own stack. That keeps recursion depth limited only by memory, lets the program pause
// between any two instructions (debugger, WAIT, READLIST, keeping the page responsive), and
// makes every frame inspectable. Errors, THROW, OUTPUT and STOP unwind through the
// generators like exceptions.
(function (LG) {
  'use strict';
  const D = LG.Data;
  const { Pair, NIL, LArray, isList, isWord } = D;
  const { OutputSignal, StopSignal, ThrowSignal, GotoSignal, HaltSignal } = LG.Signals;
  const LogoError = LG.LogoError;

  const STEP = { t: 'step' };
  /** Returned (not thrown) by OUTPUT and STOP when the caller can handle it; value in interp.exitValue */
  const EXIT = { t: 'exit' };
  const MAX_DEPTH = 200000;

  let actIds = 0;

  // primitives that only compute a value; anything else could change the program's state
  const SAFE_GROUPS = new Set(['math', 'data']);
  const UNSAFE = new Set(['push', 'pop', 'queue', 'dequeue', 'setitem', 'mdsetitem', '.setitem', '.setfirst', '.setbf', 'pprop', 'remprop', 'gensym', 'random', 'rerandom', 'pick']);
  function safeTree(t) {
    if (t.k !== 'call') return true;
    const p = t.p && t.p.prim;
    if (!p || !(SAFE_GROUPS.has(p.group) || ['?', '#', 'thing', 'namep', 'repcount', 'pos', 'xcor', 'ycor', 'heading', 'pencolor', 'pendownp', 'towards', 'distance', 'shownp', 'gprop', 'plist', 'and', 'or', 'not'].includes(p.name))) return false;
    if (UNSAFE.has(p.name)) return false;
    return t.a.every(safeTree);
  }

  class Interp extends LG.Emitter {
    constructor(opts) {
      super();
      opts = opts || {};
      this.vfs = opts.vfs || null;
      this.io = opts.io || null;           // text window, keyboard, mouse
      this.turtle = opts.turtle || null;   // turtle graphics world
      this.audio = opts.audio || null;
      this.prims = new Map();
      this.procs = new Map();
      this.globals = new Map();
      this.plists = new Map();
      this.buried = { procs: new Set(), names: new Set(), plists: new Set() };
      this.traced = new Set();
      this.stepped = new Set();
      this.gen = 1;                        // bumped whenever procedures change (tree caches)
      this.files = [];                     // file id -> path
      this.fileIds = new Map();
      const self = this;
      this.procTable = {
        get(name) {
          const u = self.procs.get(name);
          if (u) return u.entry;
          const p = self.prims.get(name);
          return p ? p.entry : null;
        },
      };
      // driver state
      this.stack = [];
      this.state = 'idle';
      this.frame = null;
      this.scope = null;
      this.sendVal = undefined;
      this.pending = null;                 // exception travelling down the stack
      this.repStack = [];
      this.slotStack = [];
      this.breakpoints = new Map();        // "src:ln" -> {cond}
      this.stepMode = null;
      this.pauseRequested = false;
      this.lastStepKey = '';
      this.steps = 0;
      this.timeSlice = 14;
      this.events = [];
      this.inHandler = 0;
      this.topTest = undefined;
      this.caseIgnored = true;
      this.hist = { size: 256, i: 0, n: 0, nodes: new Array(256), acts: new Array(256) };
      this.tick = 0;
      this.count = 0;                      // instructions run since the interpreter started
      this.speedDelay = 0;                 // ms to wait after each instruction (slow motion)
      this.errorSnapshot = null;
      this.lastError = null;
      this.timer = null;
      LG.Prims.install(this);
    }

    // ---- primitives ---------------------------------------------------------------------------
    /**
     * Define a primitive. names: "forward fd". min/def/max inputs (max -1 = any number).
     * opts.gen: fn is a generator (it can run Logo code or wait). opts.pure=false forces the
     * slow path even for plain functions.
     */
    def(names, min, def, max, fn, opts) {
      opts = opts || {};
      const list = names.split(/\s+/).filter(Boolean);
      const prim = { name: list[0], names: list, fn, gen: !!opts.gen, pure: !opts.gen && opts.pure !== false, group: opts.group || '', inline: opts.inline || null };
      prim.entry = { name: list[0], min, def, max, prim, special: opts.special };
      for (const n of list) this.prims.set(n.toLowerCase(), prim);
      return prim;
    }
    isPrim(name) { return this.prims.has(String(name).toLowerCase()); }

    // ---- argument checking --------------------------------------------------------------------
    bad(node, datum) { return new LogoError(7, { proc: node ? node.name : '?', datum }); }
    num(v, node) {
      const n = D.num(v);
      if (Number.isNaN(n)) throw this.bad(node, v);
      return n;
    }
    int(v, node) {
      const n = this.num(v, node);
      if (!Number.isInteger(n)) {
        if (Math.abs(n - Math.round(n)) < 1e-9) return Math.round(n);
        throw this.bad(node, v);
      }
      return n;
    }
    word(v, node) { if (!isWord(v)) throw this.bad(node, v); return D.wordText(v); }
    list(v, node) { if (!isList(v)) throw this.bad(node, v); return v; }
    bool(v, node) {
      if (isWord(v)) { const s = D.wordText(v).toLowerCase(); if (s === 'true') return true; if (s === 'false') return false; }
      throw this.bad(node, v);
    }
    tf(b) { return b ? 'true' : 'false'; }

    // ---- variables ----------------------------------------------------------------------------
    /** Find the scope that holds a variable, or null for global */
    holder(name, sc) {
      for (let s = sc === undefined ? this.scope : sc; s; s = s.parent) if (s.vars && s.vars.has(name)) return s;
      return null;
    }
    getVar(name, sc) {
      const h = this.holder(name, sc);
      const v = h ? h.vars.get(name) : this.globals.get(name);
      if (v === undefined) throw new LogoError(11, { datum: name });
      return v;
    }
    hasValue(name, sc) {
      const h = this.holder(name, sc);
      return (h ? h.vars.get(name) : this.globals.get(name)) !== undefined;
    }
    setVar(name, v, sc) {
      const h = this.holder(name, sc);
      if (h) h.vars.set(name, v); else this.globals.set(name, v);
    }
    /** LOCAL: the innermost procedure activation (or nested scope) gets the variable */
    makeLocal(name) {
      const sc = this.scope;
      if (!sc) { if (!this.globals.has(name)) this.globals.set(name, undefined); return; }
      if (!sc.vars) sc.vars = new Map();
      if (!sc.vars.has(name)) sc.vars.set(name, undefined);
    }

    // ---- files --------------------------------------------------------------------------------
    fileId(path) {
      if (!path) return undefined;
      let id = this.fileIds.get(path);
      if (id === undefined) { id = this.files.length; this.files.push(path); this.fileIds.set(path, id); }
      return id;
    }
    filePath(id) { return id === undefined ? null : this.files[id]; }

    // ---- procedures ---------------------------------------------------------------------------
    /**
     * Define a user procedure.
     * spec: {name, inputs, lines: [{list, ln, text}], file, ln, endLn, titleText, macro}
     */
    defineProc(spec) {
      const key = spec.name.toLowerCase();
      if (this.prims.has(key) && !this.redefOk()) throw new LogoError(22, { proc: spec.name });
      const inp = spec.inputs;
      const min = inp.req.length;
      const max = inp.rest ? -1 : inp.req.length + inp.opt.length;
      let def = inp.def !== null && inp.def !== undefined ? inp.def : min;
      if (def < min) def = min;
      const proc = Object.assign({}, spec, { key });
      proc.entry = { name: spec.name, min, def, max, user: proc, macro: !!spec.macro };
      this.procs.set(key, proc);
      this.gen++;
      this.emit('defined', proc);
      return proc;
    }
    redefOk() { const v = this.globals.get('redefp'); return v !== undefined && D.wordText(v).toLowerCase() === 'true'; }
    eraseProc(name) {
      const key = name.toLowerCase();
      if (this.procs.delete(key)) { this.gen++; this.emit('erased', key); return true; }
      return false;
    }
    /** Procedure text in DEFINE/TEXT format: [[inputs] [line] ...] */
    procText(proc) {
      const inp = proc.inputs;
      const ins = inp.req.slice();
      for (const o of inp.opt) ins.push(new Pair(o.name, o.dflt));
      if (inp.rest) ins.push(D.list(inp.rest));
      if (inp.def !== null && inp.def !== undefined && inp.def !== inp.req.length) ins.push(inp.def);
      return D.fromArray([D.fromArray(ins)].concat(proc.lines.map((l) => l.list)));
    }
    /** Source text of a procedure as PO prints it */
    procSource(proc) {
      if (proc.srcText) return proc.srcText;
      const inp = proc.inputs;
      const title = [proc.macro ? '.macro' : 'to', proc.name]
        .concat(inp.req.map((n) => ':' + n))
        .concat(inp.opt.map((o) => '[:' + o.name + ' ' + D.printText(o.dflt) + ']'))
        .concat(inp.rest ? ['[:' + inp.rest + ']'] : [])
        .concat(inp.def !== null && inp.def !== undefined && inp.def !== inp.req.length ? [String(inp.def)] : []);
      return [title.join(' ')].concat(proc.lines.map((l) => (l.text !== undefined ? l.text : D.printText(l.list)))).concat(['end']).join('\n');
    }

    // ---- loading source -----------------------------------------------------------------------
    /**
     * Split source text into procedure definitions and top-level instruction lines.
     * Returns [{kind:'proc', spec} | {kind:'line', list, ln}]
     */
    parseSource(text, path) {
      const src = this.fileId(path);
      const lines = LG.Reader.read(text, { src });
      const rawLines = text.split('\n');
      const out = [];
      for (let i = 0; i < lines.length; i++) {
        const L = lines[i];
        const first = L.list instanceof Pair ? L.list.f : null;
        const kw = typeof first === 'string' ? first.toLowerCase() : '';
        if (kw === 'to' || kw === '.macro') {
          const t = LG.Parser.parseTitle(L.list);
          const body = [];
          let end = null;
          for (i++; i < lines.length; i++) {
            const B = lines[i];
            const bf = B.list instanceof Pair ? B.list.f : null;
            if (typeof bf === 'string' && bf.toLowerCase() === 'end' && B.list.r === NIL) { end = B; break; }
            body.push({ list: B.list, ln: B.ln, endLn: B.endLn, text: rawLines.slice(B.ln - 1, B.endLn).join('\n') });
          }
          const endLn = end ? end.ln : (body.length ? body[body.length - 1].endLn : L.ln);
          out.push({
            kind: 'proc',
            spec: {
              name: t.name, inputs: t.inputs, lines: body, file: path || null, src, ln: L.ln, endLn,
              macro: kw === '.macro', srcText: rawLines.slice(L.ln - 1, endLn).join('\n'), noEnd: !end,
            },
          });
        } else {
          out.push({ kind: 'line', list: L.list, ln: L.ln });
        }
      }
      return out;
    }

    /** Generator: define the procedures in source text and run its top-level instructions */
    * loadGen(text, path) {
      const items = this.parseSource(text, path);
      for (const it of items) {
        if (it.kind === 'proc') this.defineProc(it.spec);
        else yield* this.runTrees(LG.Parser.treesFor(it.list, this), false);
      }
    }

    // ---- evaluation ---------------------------------------------------------------------------
    /** Evaluate a tree that needs no driver involvement */
    evalPure(n) {
      switch (n.k) {
        case 'lit': return n.v;
        case 'var': return this.getVar(n.n);
        case 'call': {
          const a = n.a;
          const args = new Array(a.length);
          for (let i = 0; i < a.length; i++) {
            const v = this.evalPure(a[i]);
            if (v === undefined) { this.cur = a[i]; throw new LogoError(5, { proc: a[i].name, caller: n.name }); }
            args[i] = v;
          }
          this.cur = n;
          return n.p.prim.fn.call(this, args, n);
        }
      }
      throw new LogoError(0);
    }

    * evalNode(n) {
      if (n.pure) return this.evalPure(n);
      switch (n.k) {
        case 'lit': return n.v;
        case 'var': return this.getVar(n.n);
        case 'unk': {
          // the procedure may have been defined earlier on this same line (DEFINE, LOAD);
          // if it now exists and the inputs written for it fit, call it
          this.cur = n;
          const e = this.procTable.get(n.name.toLowerCase());
          if (e && n.a.length >= e.min && (e.max < 0 || n.a.length <= e.max) && (n.a.length || e.def === 0)) {
            return yield* this.evalNode(Object.assign({}, n, { k: 'call', p: e, pure: false }));
          }
          throw new LogoError(13, { proc: n.name });
        }
        case 'call': {
          if (n.missing) { this.cur = n; throw new LogoError(6, { proc: n.name }); }
          const a = n.a;
          const args = new Array(a.length);
          for (let i = 0; i < a.length; i++) {
            const x = a[i];
            const v = x.pure ? this.evalPure(x) : yield* this.evalNode(x);
            if (v === undefined) { this.cur = x; throw new LogoError(5, { proc: x.name || '?', caller: n.name }); }
            args[i] = v;
          }
          this.cur = n;
          const e = n.p;
          if (e.prim) {
            if (e.prim.gen) return yield* e.prim.fn.call(this, args, n);
            return e.prim.fn.call(this, args, n);
          }
          // user procedure (the entry may be stale if it was redefined; use the current one)
          const proc = this.procs.get(e.user.key) || e.user;
          const v = yield { t: 'call', proc, args, node: n };
          if (proc.macro) return yield* this.runMacroResult(v, n);
          return v;
        }
      }
      throw new LogoError(0);
    }

    * runMacroResult(v, n) {
      if (!isList(v)) throw new LogoError(29, { datum: v });
      return yield* this.runList(v, true);
    }

    /**
     * Run instruction trees. wantValue: the last instruction may output a value.
     * exitOk: the caller understands EXIT, so OUTPUT and STOP can return it instead of throwing.
     */
    * runTrees(trees, wantValue, exitOk) {
      const last = trees.length - 1;
      const h = this.hist;
      for (let i = 0; i <= last; i++) {
        const n = trees[i];
        this.stepNode = n;
        this.cur = null;
        h.nodes[h.i] = n; h.acts[h.i] = this.frame.act;
        h.i = (h.i + 1) & 255;
        if (h.n < 256) h.n++;
        this.count++;
        // hand control to the driver only when something needs to look at this instruction
        if (this.watch || ++this.tick >= 1000) { this.tick = 0; yield STEP; }
        let v;
        if (n.exitKind && exitOk) {
          // OUTPUT / STOP with a complicated input: evaluate it, then leave without throwing
          if (n.exitKind === 'output') {
            const x = n.a[0];
            const ov = x.pure ? this.evalPure(x) : yield* this.evalNode(x);
            if (ov === undefined) { this.cur = x; throw new LogoError(5, { proc: x.name || '?', caller: n.name }); }
            this.exitValue = ov;
          } else this.exitValue = undefined;
          return EXIT;
        }
        if (n.inl) {
          // IF, IFELSE, REPEAT, OUTPUT and STOP with simple inputs run right here
          v = yield* this.inline(n, wantValue && i === last, exitOk);
          if (v === EXIT) return EXIT;
        } else v = n.pure ? this.evalPure(n) : yield* this.evalNode(n);
        if (v !== undefined) {
          if (wantValue && i === last) return v;
          this.cur = n;
          throw new LogoError(9, { datum: v });
        }
      }
      return undefined;
    }
    * inline(n, wantValue, exitOk) {
      const a = n.a;
      this.cur = n;
      switch (n.inl) {
        case 'output': {
          const v = this.evalPure(a[0]);
          if (v === undefined) { this.cur = a[0]; throw new LogoError(5, { proc: a[0].name, caller: n.name }); }
          if (exitOk) { this.exitValue = v; return EXIT; }
          throw new OutputSignal(v);
        }
        case 'stop':
          if (exitOk) { this.exitValue = undefined; return EXIT; }
          throw new StopSignal();
        case 'if': case 'ifelse': {
          const c = this.evalPure(a[0]);
          this.cur = n;
          const t = this.bool(c, n);
          const body = a.length === 3 ? this.evalPure(t ? a[1] : a[2]) : t ? this.evalPure(a[1]) : null;
          if (body === null) return undefined;
          if (!isList(body)) return yield* this.evalNode(Object.assign({}, n, { inl: null, pure: false }));
          return yield* this.runTrees(LG.Parser.treesFor(body, this), true, exitOk);
        }
        case 'repeat': {
          const k = Math.floor(this.num(this.evalPure(a[0]), n));
          const body = this.evalPure(a[1]);
          if (!isList(body)) return yield* this.evalNode(Object.assign({}, n, { inl: null, pure: false }));
          const trees = LG.Parser.treesFor(body, this);
          const rs = this.repStack;
          const at = rs.length;
          rs.push(0);
          try {
            for (let j = 1; j <= k; j++) {
              rs[at] = j;
              if ((yield* this.runTrees(trees, false, exitOk)) === EXIT) return EXIT;
            }
          } finally { rs.length = at; }
          return undefined;
        }
      }
      throw new LogoError(0);
    }
    /** Iterator that runs a list (use with yield*) */
    runList(list, wantValue) {
      if (isWord(list)) list = LG.Reader.readList(D.wordText(list));
      if (!isList(list)) throw new LogoError(7, { proc: 'run', datum: list });
      return this.runTrees(LG.Parser.treesFor(list, this), wantValue);
    }

    /** Generator for a procedure activation (run by the driver in its own frame) */
    * runProc(proc, args, act) {
      const inp = proc.inputs;
      const vars = act.vars;
      let i = 0;
      for (const n of inp.req) vars.set(n, args[i++]);
      for (const o of inp.opt) {
        if (i < args.length) vars.set(o.name, args[i++]);
        else vars.set(o.name, yield* this.runList(o.dflt, true));
      }
      if (inp.rest) vars.set(inp.rest, D.fromArray(args.slice(i)));
      const traced = this.traced.has(proc.key);
      if (traced) this.traceLine(act.depth, '( ' + proc.name + (args.length ? ' ' + args.map((a) => this.traceText(a)).join(' ') : '') + ' )');
      let result;
      try {
        let li = 0;
        const lines = proc.lines;
        while (li < lines.length) {
          try {
            for (; li < lines.length; li++) {
              act.line = li;
              if ((yield* this.runTrees(LG.Parser.treesFor(lines[li].list, this), false, true)) === EXIT) {
                result = this.exitValue;
                this.exitValue = undefined;
                li = lines.length;
                break;
              }
            }
          } catch (e) {
            if (!(e instanceof GotoSignal)) throw e;
            li = this.findTag(proc, e.tag);
          }
        }
      } catch (e) {
        if (e instanceof OutputSignal) result = e.value;
        else if (!(e instanceof StopSignal)) throw e;
      }
      if (traced) this.traceLine(act.depth, proc.name + (result === undefined ? ' stops' : ' outputs ' + this.traceText(result)));
      return result;
    }
    findTag(proc, tag) {
      const t = D.wordText(tag).toLowerCase();
      for (let i = 0; i < proc.lines.length; i++) {
        const l = proc.lines[i].list;
        if (l instanceof Pair && typeof l.f === 'string' && l.f.toLowerCase() === 'tag' && l.r instanceof Pair) {
          const w = String(l.r.f).replace(/^"/, '').toLowerCase();
          if (w === t) return i;
        }
      }
      throw new LogoError(37, { datum: tag });
    }
    traceLine(depth, text) { this.print(' '.repeat(Math.max(0, depth - 1)) + text + '\n'); }
    /** A value as TRACE shows it: words other than numbers get a quote, as in Berkeley Logo */
    traceText(v) { return (typeof v === 'string' && !D.isNumberWord(v) ? '"' : '') + D.showText(v); }

    /** Run a nested scope (FOR, templates) within the current frame */
    * withScope(vars, body) {
      const fr = this.frame;
      const saved = fr.scope;
      const sc = { vars, parent: saved, act: fr.act };
      fr.scope = sc; this.scope = sc;
      try {
        return yield* body();
      } catch (e) {
        // note where it went wrong while the loop or template variables are still in scope
        if (e instanceof LogoError && !e.where) this.locate(e, fr);
        throw e;
      } finally { fr.scope = saved; this.scope = saved; }
    }

    // ---- templates (APPLY, MAP, FOREACH, ...) ---------------------------------------------------
    /** Apply a template to inputs. Returns the value (or undefined). */
    * apply(tmpl, args, node, wantValue) {
      if (isWord(tmpl)) {
        const name = D.wordText(tmpl).toLowerCase();
        const e = this.procTable.get(name);
        if (!e) throw new LogoError(13, { proc: D.wordText(tmpl) });
        if (args.length < e.min) throw new LogoError(6, { proc: e.name });
        if (e.max >= 0 && args.length > e.max) throw new LogoError(38, { proc: e.name });
        if (e.prim) {
          const n = { k: 'call', name: e.name, p: e, a: [] };
          if (e.prim.gen) return yield* e.prim.fn.call(this, args, n);
          return e.prim.fn.call(this, args, n);
        }
        const proc = e.user;
        const v = yield { t: 'call', proc, args, node: node };
        if (proc.macro) return yield* this.runMacroResult(v, node);
        return v;
      }
      if (!isList(tmpl) || tmpl === NIL) throw new LogoError(32, { datum: tmpl });
      const first = tmpl.f;
      if (isList(first)) {
        // explicit-slot template: [[a b] body] or procedure text form [[a b] [line] [line]]
        const names = D.toArray(first).map((x) => D.wordText(x).replace(/^:/, '').toLowerCase());
        const rest = tmpl.r;
        const vars = new Map();
        names.forEach((nm, i) => vars.set(nm, args[i]));
        if (args.length < names.length) throw new LogoError(6, { proc: 'template' });
        const allLists = rest !== NIL && D.toArray(rest).every(isList);
        if (allLists && rest instanceof Pair && rest.r !== NIL) {
          return yield* this.withScope(vars, function* () {
            try {
              for (let l = rest; l instanceof Pair; l = l.r) yield* this.runList(l.f, false);
            } catch (e) {
              if (e instanceof OutputSignal) return e.value;
              if (e instanceof StopSignal) return undefined;
              throw e;
            }
            return undefined;
          }.bind(this));
        }
        return yield* this.withScope(vars, function* () { return yield* this.runList(rest, true); }.bind(this));
      }
      // question-mark template
      this.slotStack.push({ args, index: this.slotIndex || 1 });
      try { return yield* this.runList(tmpl, true); } finally { this.slotStack.pop(); }
    }
    * applyValue(tmpl, args, node, who) {
      const v = yield* this.apply(tmpl, args, node, true);
      if (v === undefined) throw new LogoError(5, { proc: isWord(tmpl) ? D.wordText(tmpl) : 'template', caller: who || (node && node.name) || 'apply' });
      return v;
    }

    // ---- output -------------------------------------------------------------------------------
    print(text) {
      if (this.writer && this.writer.write) { this.writer.write(text); return; }
      if (this.dribble) this.dribble(text);
      if (this.io) this.io.print(text); else this.emit('print', text);
    }

    // ---- the driver ---------------------------------------------------------------------------
    /** Start running a generator at top level (or on top of a paused program for immediate commands) */
    start(gen, opts) {
      opts = opts || {};
      const postMortem = this.state === 'error' && !!opts.postMortem;
      const paused = this.state === 'paused' || postMortem;
      if (this.isBusy() && !paused) throw new Error('busy');
      const base = opts.scope !== undefined ? opts.scope : null;
      const act = opts.act || (base && base.act) || this.topAct();
      const fr = { gen, act, scope: base || (act.top ? null : act), imm: paused, resumeState: postMortem ? 'error' : 'paused', label: opts.label || '' };
      if (!paused) {
        this.stack = [];
        this.repStack = [];
        this.slotStack = [];
        this.errorSnapshot = null;
        this.lastError = null;
        this.hist.i = 0; this.hist.n = 0;
        this.stepMode = opts.stepMode || null;
        this.pauseRequested = !!opts.pauseFirst;
        this.continueRequested = false;
        this.emit('start', opts);
      }
      this.stack.push(fr);
      this.sendVal = undefined;
      this.pending = null;
      this.state = 'running';
      this.emit('state', this.state);
      this.run();
    }
    topAct() { if (!this._top) this._top = { top: true, id: 0, proc: null, vars: null, depth: 0 }; return this._top; }
    isBusy() { return this.state === 'running' || this.state === 'waiting' || this.state === 'input'; }

    /** Run instruction text at top level, e.g. from the command center */
    runText(text, opts) {
      opts = opts || {};
      const self = this;
      this.start((function* () {
        const lines = LG.Reader.read(text, { src: self.fileId(opts.file) });
        let last;
        for (const L of lines) last = yield* self.runTrees(LG.Parser.treesFor(L.list, self), !!opts.wantValue);
        return last;
      })(), opts);
    }
    /** Load source text: define procedures and run the top-level lines */
    loadText(text, path, opts) { this.start(this.loadGen(text, path), Object.assign({ label: path }, opts || {})); }

    /** Main loop: runs until the stack empties, the program pauses or waits, or the time slice ends */
    run() {
      if (this.running) return;
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      this.running = true;
      const t0 = Date.now();
      let n = 0;
      try {
        for (;;) {
          const st = this.stack;
          if (!st.length) { this.finish(); return; }
          const fr = st[st.length - 1];
          if (fr.wakeAt) {
            const left = fr.wakeAt - Date.now();
            if (left > 0) {
              // timer, key and mouse handlers run while the program waits
              if (this.events.length && !this.inHandler && !fr.imm && !fr.handler) {
                this.runEvent();
                if (this.state !== 'running') { this.state = 'running'; this.emit('state', this.state); }
                continue;
              }
              this.state = 'waiting'; this.schedule(left); this.emit('state', this.state); return;
            }
            fr.wakeAt = 0;
          }
          if (fr.wantInput) { this.state = 'input'; this.emit('state', this.state); return; }
          this.frame = fr;
          this.scope = fr.scope;
          let r;
          try {
            if (this.pending) {
              const e = this.pending;
              this.pending = null;
              r = fr.gen.throw(e);
            } else {
              const v = this.sendVal;
              this.sendVal = undefined;
              r = fr.gen.next(v);
            }
          } catch (e) {
            st.pop();
            if (e instanceof RangeError || (e && e.name === 'InternalError')) e = new LogoError(2);
            if (e instanceof LogoError && !e.where) this.locate(e, fr);
            // THROW "ERROR becomes an error if nothing catches it: keep the frames it was thrown from
            else if (e instanceof ThrowSignal && !e.where && D.wordText(e.tag).toLowerCase() === 'error') this.locate(e, fr);
            if (fr.imm && !(e instanceof HaltSignal)) { this.immediateError(e, fr); return; }
            this.pending = e;
            if (!st.length) { this.uncaught(e); return; }
            continue;
          }
          if (r.done) {
            st.pop();
            if (fr.handler) this.inHandler--;
            if (fr.imm) { this.state = fr.resumeState || 'paused'; this.emit('immediateDone', r.value); this.emit('state', this.state); return; }
            this.sendVal = r.value;
            continue;
          }
          const req = r.value;
          if (req === STEP) {
            if (++n > 20) {
              n = 0;
              if (Date.now() - t0 > this.timeSlice) { fr.node = this.stepNode; fr.act.node = this.stepNode; this.schedule(0); return; }
            }
            if (this.onStep(fr)) return;
            continue;
          }
          switch (req.t) {
            case 'call': {
              if (st.length >= MAX_DEPTH) { this.pending = new LogoError(2); continue; }
              const parentAct = fr.act;
              fr.node = req.node; parentAct.node = req.node;
              const act = { id: ++actIds, proc: req.proc, vars: new Map(), parent: this.scope, caller: parentAct, node: req.node, args: req.args, depth: (parentAct.depth || 0) + 1, line: 0 };
              st.push({ gen: this.runProc(req.proc, req.args, act), act, scope: act });
              break;
            }
            case 'wait': {
              fr.wakeAt = Date.now() + req.ms;
              break;
            }
            case 'input': {
              fr.wantInput = req.kind;
              this.inputPrompt = req;
              this.emit('needInput', req);
              break;
            }
            case 'pause': {
              this.pause('pause');
              return;
            }
            case 'async': {
              // wait for a promise (permission prompts, files on mounted folders)
              fr.wantInput = 'async';
              const token = fr;
              req.promise.then((v) => { if (this.stack[this.stack.length - 1] === token && token.wantInput === 'async') this.provideInput({ ok: v }); },
                (e) => { if (this.stack[this.stack.length - 1] === token && token.wantInput === 'async') this.provideInput({ err: e }); });
              break;
            }
            default:
              this.pending = new LogoError(0);
          }
        }
      } finally {
        this.running = false;
      }
    }
    schedule(ms) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => { this.timer = null; if (this.state === 'running' || this.state === 'waiting') { this.state = 'running'; this.run(); } }, ms);
    }
    /** Called before each instruction. Returns true when the driver must stop. */
    onStep(fr) {
      this.steps++;
      const node = this.stepNode;
      fr.node = node;
      const act = fr.act;
      act.node = node;
      if (this.events.length && !this.inHandler && !fr.imm) { this.runEvent(); return false; }
      if (fr.imm || fr.handler) return false;
      if (!this.watch) return false;
      const key = node.key;
      // later instructions on the same line do not re-trigger a breakpoint; a loop that comes
      // back to the start of the line does
      const sameLine = key === this.lastStepKey && act === this.lastStepAct && node.col > this.lastStepCol;
      this.lastStepKey = key; this.lastStepAct = act; this.lastStepCol = node.col;
      if (this.pauseRequested) { this.pauseRequested = false; this.pause('pause'); return true; }
      const sm = this.stepMode;
      if (sm) {
        const depth = this.stack.length;
        // Step over runs the rest of the line it stopped on, and whatever that line calls; a loop
        // that comes back to the start of the line stops again
        const restOfLine = sm.mode === 'over' && sm.key !== undefined && key === sm.key && act === sm.act && node.col > sm.col;
        if (restOfLine) sm.col = node.col;
        else if (sm.mode === 'into' || (sm.mode === 'over' && depth <= sm.depth) || (sm.mode === 'out' && depth < sm.depth) || (sm.mode === 'line' && depth <= sm.depth && !sameLine)) {
          this.stepMode = null; this.pause('step'); return true;
        }
      }
      if (node.ln !== undefined && !sameLine && this.breakpoints.size) {
        const bp = this.breakpoints.get(key);
        if (bp && this.bpHit(bp, fr)) { this.stepMode = null; this.pause('breakpoint'); return true; }
      }
      if (act.proc && this.stepped.size && this.stepped.has(act.proc.key)) { this.pause('stepped'); return true; }
      if (this.stepHook && this.stepHook(fr)) { this.stepMode = null; this.pause('watch'); return true; }
      if (this.speedDelay > 0) { fr.wakeAt = Date.now() + this.speedDelay; this.emit('slowStep', node); }
      return false;
    }
    /** Whether every instruction must stop at the driver (debugging, slow motion) */
    get watch() {
      return this.pauseRequested || this.stepMode !== null || this.breakpoints.size > 0 || this.stepped.size > 0 || this.speedDelay > 0 || this.events.length > 0 || !!this.stepHook;
    }
    /** Recent instructions, oldest first: [{node, act}] */
    recent() {
      const h = this.hist, out = [];
      for (let k = h.n; k > 0; k--) { const j = (h.i - k + h.size) % h.size; out.push({ node: h.nodes[j], act: h.acts[j] }); }
      return out;
    }
    bpHit(bp, fr) {
      if (!bp.cond) return true;
      try {
        const lst = LG.Reader.readList(bp.cond);
        const trees = LG.Parser.treeify(LG.Reader.runparse(lst), this.procTable);
        if (trees.length !== 1 || !trees[0].pure) return true;
        this.scope = fr.scope;
        return this.bool(this.evalPure(trees[0]), { name: 'breakpoint condition' });
      } catch (e) { return true; }
    }
    /** Record where an error happened */
    locate(e, fr) {
      const n = this.cur || this.stepNode;
      e.where = true;
      e.act = fr.act;
      e.procName = fr.act && fr.act.proc ? fr.act.proc.name : '';
      if (!e.parseError) {
        e.node = n;
        e.src = n ? n.src : undefined;
        e.ln = n ? n.ln : undefined;
        e.col = n ? n.col : undefined;
      }
      // a command typed after an error (or while paused) must not replace the frames being looked at
      const imm = fr.imm || this.stack.some((f) => f.imm);
      if (!imm && (!this.errorSnapshot || this.errorSnapshot.err !== e)) {
        const frs = this.stack[this.stack.length - 1] === fr ? this.stack.slice() : this.stack.concat([fr]);
        this.errorSnapshot = { err: e, frames: frs.map((f) => ({ act: f.act, scope: f.scope, node: f.node })) };
        this.errorSnapshot.frames[this.errorSnapshot.frames.length - 1].node = n;
      }
    }
    pause(why) {
      this.state = 'paused';
      this.pauseWhy = why;
      this.emit('paused', why);
      this.emit('state', this.state);
    }
    finish() {
      this.state = 'idle';
      this.frame = null; this.scope = null;
      const v = this.sendVal; this.sendVal = undefined;
      this.emit('done', v);
      this.emit('state', this.state);
      if (this.events.length) this.runEvent();
    }
    uncaught(e) {
      this.pending = null;
      this.frame = null; this.scope = null;
      if (e instanceof HaltSignal) { this.state = 'idle'; this.emit('halted', e.reason); this.emit('state', this.state); return; }
      if (e instanceof ThrowSignal) {
        const tag = D.wordText(e.tag).toLowerCase();
        if (tag === 'toplevel') { this.state = 'idle'; this.emit('halted', 'toplevel'); this.emit('state', this.state); return; }
        if (tag === 'error') e = Object.assign(new LogoError(35, { message: e.value !== undefined ? D.printText(e.value) : 'Throw "Error' }), { node: e.node, src: e.src, ln: e.ln });
        else { const x = new LogoError(14, { datum: e.tag }); x.node = e.node; e = x; }
      }
      if (e instanceof OutputSignal || e instanceof StopSignal) e = new LogoError(31);
      if (e instanceof GotoSignal) e = new LogoError(36);
      if (!(e instanceof LogoError)) {
        const x = new LogoError(0, { message: 'Internal error: ' + (e && e.message) });
        x.internal = e;
        e = x;
      }
      this.lastError = e;
      this.state = 'error';
      this.emit('error', e);
      this.emit('state', this.state);
    }
    immediateError(e, fr) {
      if (e instanceof OutputSignal || e instanceof StopSignal) e = new LogoError(31);
      if (e instanceof ThrowSignal) {
        const tag = D.wordText(e.tag).toLowerCase();
        e = tag === 'error' ? new LogoError(35, { message: e.value !== undefined ? D.printText(e.value) : 'Throw "Error' }) : new LogoError(14, { datum: e.tag });
      }
      if (e instanceof GotoSignal) e = new LogoError(36);
      if (!(e instanceof LogoError)) e = new LogoError(0, { message: String(e && e.message) });
      this.state = (fr && fr.resumeState) || 'paused';
      this.emit('immediateError', e);
      this.emit('state', this.state);
    }

    // ---- control from the IDE -----------------------------------------------------------------
    resume(mode) {
      if (this.state !== 'paused') return;
      const depth = this.stack.length;
      const top = this.stack[depth - 1];
      const at = top && top.node;
      this.stepMode = mode ? { mode, depth, key: at ? at.key : undefined, act: top ? top.act : null, col: at ? at.col : -1 } : null;
      this.lastStepKey = mode && mode !== 'over' ? '' : this.lastStepKey;
      this.continueRequested = false;
      this.state = 'running';
      this.emit('state', this.state);
      // resuming from inside a 'paused' handler: let the current run loop unwind first
      if (this.running) this.schedule(0); else this.run();
    }
    requestPause() { if (this.isBusy()) { this.pauseRequested = true; if (this.state === 'waiting') { const fr = this.stack[this.stack.length - 1]; if (fr) fr.wakeAt = 0; this.state = 'running'; this.run(); } } }
    halt() {
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      const was = this.state;
      for (const fr of this.stack) { try { fr.gen.return(); } catch (e) { /* ignore */ } }
      this.stack = [];
      this.repStack = []; this.slotStack = [];
      this.events = []; this.inHandler = 0;
      this.state = 'idle';
      this.frame = null; this.scope = null;
      if (was !== 'idle') { this.emit('halted', 'stop'); this.emit('state', this.state); }
    }
    /** Answer READLIST/READCHAR etc. */
    provideInput(value) {
      const fr = this.stack[this.stack.length - 1];
      if (!fr || !fr.wantInput) return false;
      fr.wantInput = null;
      this.inputPrompt = null;
      this.sendVal = value;
      this.state = 'running';
      this.emit('state', this.state);
      this.run();
      return true;
    }
    /** Evaluate an expression without side effects (watches, hover): only primitives that do not run code */
    peek(text, scope) {
      const list = LG.Reader.readList(text);
      const trees = LG.Parser.treeify(LG.Reader.runparse(list), this.procTable);
      if (trees.length !== 1) throw new Error(trees.length ? 'Watch one expression at a time' : 'Nothing to watch');
      const t = trees[0];
      if (!t.pure || !safeTree(t)) throw new Error('Watches can only use variables and simple operations, not procedures or commands');
      const saved = this.scope;
      this.scope = scope === undefined ? this.scope : scope;
      try { return this.evalPure(t); } finally { this.scope = saved; }
    }
    /** Run instructions in a paused program's frame (immediate window) */
    runImmediate(text, frameIndex) {
      const snap = this.frames();
      const f = snap[frameIndex === undefined ? snap.length - 1 : frameIndex];
      const self = this;
      const scope = f ? f.scope : null;
      this.start((function* () {
        let last;
        for (const L of LG.Reader.read(text, {})) last = yield* self.runTrees(LG.Parser.treesFor(L.list, self), true);
        return last;
      })(), { scope, act: f ? f.act : undefined, postMortem: this.state === 'error' });
    }

    // ---- events (mouse, keyboard, timers) ------------------------------------------------------
    queueEvent(list, slots) {
      this.events.push({ list, slots });
      if (this.state === 'idle') this.runEvent();
      else if (this.state === 'waiting') this.run();
    }
    runEvent() {
      const ev = this.events.shift();
      if (!ev) return;
      const self = this;
      const gen = (function* () {
        if (ev.slots) self.slotStack.push({ args: ev.slots, index: 1 });
        try { yield* self.runList(ev.list, false); } finally { if (ev.slots) self.slotStack.pop(); }
      })();
      const act = this.topAct();
      if (this.state === 'idle') {
        this.stack = [];
        this.stack.push({ gen, act, scope: null, handler: true });
        this.inHandler++;
        this.state = 'running';
        this.emit('state', this.state);
        // called from inside the run loop (a program just finished): let the loop unwind first
        if (!this.running) this.run(); else this.schedule(0);
      } else {
        this.stack.push({ gen, act, scope: null, handler: true });
        this.inHandler++;
      }
    }

    // ---- inspection (debugger) ----------------------------------------------------------------
    /** Frames bottom-up: [{act, scope, node, proc}] (live, or captured at an error) */
    frames() {
      if ((this.state === 'error') && this.errorSnapshot) return this.errorSnapshot.frames.map((f) => Object.assign({ proc: f.act.proc }, f));
      const out = [];
      for (const fr of this.stack) {
        if (fr.imm) continue;
        if (out.length && out[out.length - 1].act === fr.act) { out[out.length - 1].scope = fr.scope; out[out.length - 1].node = fr.node; continue; }
        out.push({ act: fr.act, scope: fr.scope, node: fr.node || (fr.act && fr.act.node), proc: fr.act ? fr.act.proc : null, handler: !!fr.handler });
      }
      return out;
    }

    // ---- reset ---------------------------------------------------------------------------------
    resetWorkspace() {
      this.halt();
      this.procs.clear(); this.globals.clear(); this.plists.clear();
      this.buried = { procs: new Set(), names: new Set(), plists: new Set() };
      this.traced.clear(); this.stepped.clear();
      this.gen++;
      this.emit('reset');
    }
  }

  LG.Interp = Interp;
  LG.STEP = STEP;
  LG.EXIT = EXIT;
})(LG);
