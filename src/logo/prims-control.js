// Control structures, templates and macros. Most of these run Logo code, so they are
// generators and can be paused in the middle like any other instruction.
(function (LG) {
  'use strict';
  const D = LG.Data;
  const { Pair, NIL, isList, isWord, isArray } = D;
  const { OutputSignal, StopSignal, ThrowSignal, GotoSignal, HaltSignal } = LG.Signals;
  const LogoError = LG.LogoError;

  LG.Prims.add('control', (I) => {
    const g = { group: 'control' };
    const def = (n, a, b, c, fn, o) => I.def(n, a, b, c, fn, Object.assign({}, g, o));
    const gdef = (n, a, b, c, fn, o) => def(n, a, b, c, fn, Object.assign({ gen: true }, o));
    const runnable = (v, n) => { if (!isList(v) && !isWord(v)) throw I.bad(n, v); return v; };

    /** Evaluate a TF input: a word, or an expression list that is run for its value */
    function* cond(v, n) {
      if (isList(v)) {
        const r = yield* I.runList(v, true);
        if (r === undefined) throw new LogoError(5, { proc: 'the condition', caller: n.name });
        return I.bool(r, n);
      }
      return I.bool(v, n);
    }

    gdef('run', 1, 1, 1, function* ([l], n) { return yield* I.runList(runnable(l, n), true); });
    gdef('runresult', 1, 1, 1, function* ([l], n) {
      const v = yield* I.runList(runnable(l, n), true);
      return v === undefined ? NIL : D.list(v);
    });
    gdef('repeat', 2, 2, 2, function* ([c, body], n) {
      const k = Math.floor(I.num(c, n));
      runnable(body, n);
      const rs = I.repStack;
      rs.push(0);
      try {
        for (let i = 1; i <= k; i++) { rs[rs.length - 1] = i; yield* I.runList(body, false); }
      } finally { rs.pop(); }
    }, { inline: 'repeat' });
    gdef('forever', 1, 1, 1, function* ([body], n) {
      runnable(body, n);
      const rs = I.repStack;
      rs.push(0);
      try {
        for (let i = 1; ; i++) { rs[rs.length - 1] = i; yield* I.runList(body, false); }
      } finally { rs.pop(); }
    });
    def('repcount', 0, 0, 0, function () { const rs = I.repStack; return rs.length ? rs[rs.length - 1] : -1; });
    gdef('if', 2, 2, 3, function* (args, n) {
      const c = args[0];
      const t = isList(c) ? yield* cond(c, n) : I.bool(c, n);
      if (args.length === 3) return yield* I.runList(runnable(t ? args[1] : args[2], n), true);
      if (t) return yield* I.runList(runnable(args[1], n), true);
      return undefined;
    }, { inline: 'if' });
    gdef('ifelse', 3, 3, 3, function* ([c, a, b], n) {
      const t = isList(c) ? yield* cond(c, n) : I.bool(c, n);
      return yield* I.runList(runnable(t ? a : b, n), true);
    }, { inline: 'ifelse' });
    const actOf = () => (I.frame ? I.frame.act : I.topAct());
    gdef('test', 1, 1, 1, function* ([c], n) { actOf().test = yield* cond(c, n); });
    gdef('iftrue ift', 1, 1, 1, function* ([l], n) {
      const t = actOf().test;
      if (t === undefined) throw new LogoError(25);
      if (t) return yield* I.runList(runnable(l, n), true);
      return undefined;
    });
    gdef('iffalse iff', 1, 1, 1, function* ([l], n) {
      const t = actOf().test;
      if (t === undefined) throw new LogoError(25);
      if (!t) return yield* I.runList(runnable(l, n), true);
      return undefined;
    });
    def('stop', 0, 0, 0, function () { throw new StopSignal(); }, { inline: 'stop' });
    def('output op', 1, 1, 1, function ([v]) { throw new OutputSignal(v); }, { inline: 'output' });
    def('.maybeoutput', 1, 1, 1, function ([v]) { throw new OutputSignal(v); });

    // ---- catch / throw / errors --------------------------------------------------------------
    gdef('catch', 2, 2, 2, function* ([tag, body], n) {
      const t = I.word(tag, n).toLowerCase();
      try {
        return yield* I.runList(runnable(body, n), true);
      } catch (e) {
        if (e instanceof ThrowSignal) {
          const et = D.wordText(e.tag).toLowerCase();
          if (t === 'error' && et === 'error') {
            I.caughtError = new LogoError(35, { message: e.value !== undefined ? D.printText(e.value) : 'Throw "Error' });
            I.caughtError.procName = I.frame && I.frame.act && I.frame.act.proc ? I.frame.act.proc.name : '';
            return undefined;
          }
          if (et === t || (t === 'true' && et !== 'toplevel')) return e.value;
          throw e;
        }
        if (e instanceof LogoError && t === 'error') {
          I.caughtError = e;
          if (!e.where) { e.node = I.cur || I.stepNode; e.procName = I.frame && I.frame.act && I.frame.act.proc ? I.frame.act.proc.name : ''; }
          return undefined;
        }
        if (e instanceof RangeError && t === 'error') { I.caughtError = new LogoError(2); return undefined; }
        throw e;
      }
    });
    def('throw', 1, 1, 2, function (args, n) {
      const tag = I.word(args[0], n);
      const s = new ThrowSignal(tag, args[1]);
      s.node = n;
      throw s;
    });
    def('error', 0, 0, 0, function () {
      const e = I.caughtError;
      I.caughtError = null;
      if (!e) return NIL;
      const where = e.node && e.node.ln !== undefined ? e.node.ln : NIL;
      return D.list(e.code, e.message, e.procName || NIL, where);
    });
    gdef('pause', 0, 0, 0, function* () { yield { t: 'pause' }; });
    def('continue co', 0, 0, 1, function () { I.continueRequested = true; });
    gdef('wait', 1, 1, 1, function* ([t], n) {
      const k = I.num(t, n);
      if (k < 0) throw I.bad(n, t);
      yield { t: 'wait', ms: k * 1000 / 60 };
    });
    def('bye', 0, 0, 0, function () { throw new HaltSignal('bye'); });
    def('goto', 1, 1, 1, function ([t], n) {
      if (!I.frame || !I.frame.act || !I.frame.act.proc) throw new LogoError(36);
      throw new GotoSignal(I.word(t, n));
    });
    def('tag', 1, 1, 1, function () { });
    def('ignore', 1, 1, 1, function () { });
    def('to', 0, 0, -1, function () { throw new LogoError(23); }, { special: 'to' });
    def('.macro', 0, 0, -1, function () { throw new LogoError(23); }, { special: 'to' });
    def('end', 0, 0, 0, function () { throw new LogoError(33, { message: 'END without TO' }); });

    // ---- ` (quasiquote) ---------------------------------------------------------------------
    function* backquote(l, n) {
      const out = [];
      for (let p = l; p instanceof Pair; p = p.r) {
        const x = p.f;
        if (isList(x)) { out.push(yield* backquote(x, n)); continue; }
        if (x === ',' || x === ',@') {
          // a lone comma applies to the next member, which is run as an expression
          p = p.r;
          if (!(p instanceof Pair)) throw I.bad(n, l);
          const v = isList(p.f) ? yield* I.runList(p.f, true) : yield* evalWord(D.wordText(p.f), p, n);
          if (v === undefined) throw new LogoError(5, { proc: D.printText(p.f), caller: '`' });
          if (x === ',@') out.push(...D.toArray(I.list(v, n))); else out.push(v);
          continue;
        }
        if (typeof x === 'string' && x.startsWith(',@')) {
          const v = yield* evalWord(x.slice(2), p, n);
          for (const e of D.toArray(I.list(v, n))) out.push(e);
          continue;
        }
        if (typeof x === 'string' && x.startsWith(',')) {
          out.push(yield* evalWord(x.slice(1), p, n));
          continue;
        }
        out.push(x);
      }
      return D.fromArray(out);
    }
    function* evalWord(text, p, n) {
      const v = yield* I.runList(LG.Reader.readList(text), true);
      if (v === undefined) throw new LogoError(5, { proc: text, caller: n.name });
      return v;
    }
    gdef('`', 1, 1, 1, function* ([l], n) { return yield* backquote(I.list(l, n), n); });

    // ---- loops -------------------------------------------------------------------------------
    gdef('for', 2, 2, 2, function* ([ctl, body], n) {
      const items = I.list(ctl, n);
      if (!(items instanceof Pair)) throw I.bad(n, ctl);
      const name = I.word(items.f, n).toLowerCase();
      const trees = LG.Parser.treeify(LG.Reader.runparse(items.r), I.procTable);
      if (trees.length < 2 || trees.length > 3) throw I.bad(n, ctl);
      const vals = [];
      for (const t of trees) {
        const v = t.pure ? I.evalPure(t) : yield* I.evalNode(t);
        vals.push(I.num(v, n));
      }
      const [start, end] = vals;
      const step = vals.length === 3 ? vals[2] : (start <= end ? 1 : -1);
      runnable(body, n);
      const vars = new Map();
      return yield* I.withScope(vars, function* () {
        for (let v = start; step >= 0 ? v <= end + 1e-12 : v >= end - 1e-12; v += step) {
          vars.set(name, Number.isInteger(start) && Number.isInteger(step) ? v : +v.toPrecision(14));
          yield* I.runList(body, false);
          if (step === 0) break;
        }
      });
    });
    gdef('do.while', 2, 2, 2, function* ([body, c], n) {
      do { yield* I.runList(runnable(body, n), false); } while (yield* cond(c, n));
    });
    gdef('while', 2, 2, 2, function* ([c, body], n) {
      while (yield* cond(c, n)) yield* I.runList(runnable(body, n), false);
    });
    gdef('do.until', 2, 2, 2, function* ([body, c], n) {
      do { yield* I.runList(runnable(body, n), false); } while (!(yield* cond(c, n)));
    });
    gdef('until', 2, 2, 2, function* ([c, body], n) {
      while (!(yield* cond(c, n))) yield* I.runList(runnable(body, n), false);
    });
    gdef('case', 2, 2, 2, function* ([v, clauses], n) {
      const ci = I.caseIgnoredp();
      for (const cl of D.toArray(I.list(clauses, n))) {
        if (!(cl instanceof Pair)) throw I.bad(n, clauses);
        const k = cl.f;
        const hit = (isWord(k) && D.wordText(k).toLowerCase() === 'else') || (isList(k) && D.toArray(k).some((x) => D.equal(x, v, ci)));
        if (hit) return yield* I.runList(cl.r, true);
      }
      return undefined;
    });
    gdef('cond', 1, 1, 1, function* ([clauses], n) {
      for (const cl of D.toArray(I.list(clauses, n))) {
        if (!(cl instanceof Pair)) throw I.bad(n, clauses);
        const k = cl.f;
        const hit = (isWord(k) && D.wordText(k).toLowerCase() === 'else') || (yield* cond(k, n));
        if (hit) return yield* I.runList(cl.r, true);
      }
      return undefined;
    });

    // ---- templates ---------------------------------------------------------------------------
    /** Members of a data input to MAP/FOREACH/FILTER: list members or the characters of a word */
    const members = (d, n) => {
      if (isList(d)) return D.toArray(d);
      if (isWord(d)) return Array.from(D.wordText(d));
      if (isArray(d)) return d.a.slice();
      throw I.bad(n, d);
    };
    gdef('apply', 2, 2, 2, function* ([t, inputs], n) { return yield* I.apply(t, D.toArray(I.list(inputs, n)), n, true); });
    gdef('invoke', 1, 2, -1, function* (args, n) { return yield* I.apply(args[0], args.slice(1), n, true); });
    gdef('foreach', 2, 2, -1, function* (args, n) {
      const t = args[args.length - 1];
      const data = args.slice(0, -1).map((d) => members(d, n));
      const len = data[0].length;
      if (data.some((d) => d.length !== len)) throw I.bad(n, args[1]);
      for (let i = 0; i < len; i++) {
        I.slotIndex = i + 1;
        const v = yield* I.apply(t, data.map((d) => d[i]), n, false);
        if (v !== undefined) throw new LogoError(9, { datum: v });
      }
    });
    gdef('map', 2, 2, -1, function* (args, n) {
      const t = args[0];
      const srcs = args.slice(1);
      const data = srcs.map((d) => members(d, n));
      const len = data[0].length;
      if (data.some((d) => d.length !== len)) throw I.bad(n, srcs[1]);
      const out = [];
      for (let i = 0; i < len; i++) {
        I.slotIndex = i + 1;
        out.push(yield* I.applyValue(t, data.map((d) => d[i]), n, 'map'));
      }
      if (isWord(srcs[0])) return out.map((w) => I.word(w, n)).join('');
      return D.fromArray(out);
    });
    gdef('map.se', 2, 2, -1, function* (args, n) {
      const t = args[0];
      const data = args.slice(1).map((d) => members(d, n));
      const len = data[0].length;
      const out = [];
      for (let i = 0; i < len; i++) {
        I.slotIndex = i + 1;
        const v = yield* I.applyValue(t, data.map((d) => d[i]), n, 'map.se');
        if (isList(v)) out.push(...D.toArray(v)); else out.push(v);
      }
      return D.fromArray(out);
    });
    gdef('filter', 2, 2, 2, function* ([t, d], n) {
      const m = members(d, n);
      const out = [];
      for (let i = 0; i < m.length; i++) {
        I.slotIndex = i + 1;
        if (I.bool(yield* I.applyValue(t, [m[i]], n, 'filter'), n)) out.push(m[i]);
      }
      return isWord(d) ? out.join('') : D.fromArray(out);
    });
    gdef('find', 2, 2, 2, function* ([t, d], n) {
      const m = members(d, n);
      for (let i = 0; i < m.length; i++) {
        I.slotIndex = i + 1;
        if (I.bool(yield* I.applyValue(t, [m[i]], n, 'find'), n)) return m[i];
      }
      return NIL;
    });
    gdef('reduce', 2, 2, 2, function* ([t, d], n) {
      const m = members(d, n);
      if (!m.length) throw I.bad(n, d);
      let acc = m[m.length - 1];
      for (let i = m.length - 2; i >= 0; i--) acc = yield* I.applyValue(t, [m[i], acc], n, 'reduce');
      return acc;
    });
    gdef('crossmap', 2, 2, -1, function* (args, n) {
      const t = args[0];
      let lists = args.slice(1);
      if (lists.length === 1) lists = D.toArray(I.list(lists[0], n));
      const data = lists.map((d) => members(d, n));
      const out = [];
      const pick = [];
      function* rec(k) {
        if (k === data.length) { out.push(yield* I.applyValue(t, pick.slice(), n, 'crossmap')); return; }
        for (const x of data[k]) { pick[k] = x; yield* rec(k + 1); }
      }
      yield* rec(0);
      return D.fromArray(out);
    });
    /** CASCADE endtest template startvalue [template startvalue ...] [finaltemplate] */
    gdef('cascade', 3, 3, -1, function* (args, n) {
      const end = args[0];
      const rest = args.slice(1);
      let final = null;
      if (rest.length % 2 === 1) final = rest.pop();
      const tmpls = [], vals = [];
      for (let i = 0; i < rest.length; i += 2) { tmpls.push(rest[i]); vals.push(rest[i + 1]); }
      let count = 0;
      for (;;) {
        count++;
        if (isWord(end) && D.isNumberWord(end)) { if (count > I.int(end, n)) break; }
        else {
          I.slotIndex = count;
          if (I.bool(yield* I.applyValue(end, vals.slice(), n, 'cascade'), n)) break;
        }
        I.slotIndex = count;
        const next = [];
        for (const t of tmpls) next.push(yield* I.applyValue(t, vals.slice(), n, 'cascade'));
        for (let i = 0; i < vals.length; i++) vals[i] = next[i];
      }
      if (final) return yield* I.applyValue(final, vals.slice(), n, 'cascade');
      return vals[0];
    });
    gdef('cascade.2', 5, 5, -1, function* (args, n) {
      const p = I.prims.get('cascade');
      return yield* p.fn.call(I, args, n);
    });
    /** TRANSFER endtest template inbasket: moves items from ?IN to ?OUT */
    gdef('transfer', 3, 3, 3, function* ([end, t, basket], n) {
      let inb = members(basket, n), outb = NIL;
      const vars = new Map();
      return yield* I.withScope(vars, function* () {
        for (;;) {
          vars.set('?in', D.fromArray(inb)); vars.set('?out', outb);
          if (isList(end) && end === NIL) { if (!inb.length) break; }
          else if (I.bool(yield* I.runList(end, true), n)) break;
          if (!inb.length) break;
          vars.set('?in', D.fromArray(inb)); vars.set('?out', outb);
          outb = yield* I.applyValue(t, [inb[0], outb], n, 'transfer');
          inb = inb.slice(1);
        }
        return outb;
      });
    });
    def('?', 0, 0, 1, function (args, n) {
      const top = I.slotStack[I.slotStack.length - 1];
      if (!top) throw new LogoError(13, { proc: '?' });
      const k = args.length ? I.int(args[0], n) : 1;
      if (k < 1 || k > top.args.length) throw I.bad(n, args.length ? args[0] : k);
      return top.args[k - 1];
    });
    def('?rest', 0, 0, 1, function (args, n) {
      const top = I.slotStack[I.slotStack.length - 1];
      if (!top) throw new LogoError(13, { proc: '?rest' });
      const k = args.length ? I.int(args[0], n) : 1;
      return D.fromArray(top.args.slice(k));
    });
    def('?in', 0, 0, 0, function () { return I.getVar('?in'); });
    def('?out', 0, 0, 0, function () { return I.getVar('?out'); });
    def('#', 0, 0, 0, function () {
      const top = I.slotStack[I.slotStack.length - 1];
      if (!top) throw new LogoError(13, { proc: '#' });
      return top.index;
    });

    // ---- macros ------------------------------------------------------------------------------
    def('macrop macro?', 1, 1, 1, function ([w]) {
      if (!isWord(w)) return 'false';
      const p = I.procs.get(D.wordText(w).toLowerCase());
      return p && p.macro ? 'true' : 'false';
    });
    gdef('macroexpand', 1, 1, 1, function* ([l], n) {
      const list = I.list(l, n);
      if (!(list instanceof Pair)) throw I.bad(n, l);
      const p = I.procs.get(D.wordText(list.f).toLowerCase());
      if (!p || !p.macro) throw I.bad(n, l);
      const trees = LG.Parser.treeify(LG.Reader.runparse(list.r), I.procTable);
      const args = [];
      for (const t of trees) args.push(t.pure ? I.evalPure(t) : yield* I.evalNode(t));
      return yield { t: 'call', proc: p, args, node: n };
    });
  });
})(LG);
