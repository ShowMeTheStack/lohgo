// Treeify: turn a run-parsed instruction list into expression trees, using the number of
// inputs each procedure takes. Infix operators bind tighter than procedure inputs, as in
// Berkeley Logo, so "sum 3 4 * 2" is 11.
(function (LG) {
  'use strict';
  const { Pair, NIL, LArray, UMINUS, isNumberWord, isList } = LG.Data;
  const { INFIX, runparse } = LG.Reader;

  const PREC = { '=': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '<>': 1, '+': 2, '-': 2, '*': 3, '/': 3, '^': 4 };
  const OPNAME = { '=': 'equalp', '<': 'lessp', '>': 'greaterp', '<=': 'lessequalp', '>=': 'greaterequalp', '<>': 'notequalp', '+': 'sum', '-': 'difference', '*': 'product', '/': 'quotient', '^': 'power' };

  const isOp = (t) => typeof t === 'string' && INFIX.has(t);
  const at = (node, cell) => {
    if (cell && cell.ln !== undefined) { node.ln = cell.ln; node.col = cell.col; node.src = cell.src; node.key = cell.src + ':' + cell.ln; }
    return node;
  };
  /** An unquoted numeric literal is a number, as in Berkeley Logo (quote it, "007, to keep a word) */
  const numLit = (t) => parseFloat(t);

  /**
   * Parse a run-parsed list into an array of instruction trees.
   * procs: {get(name) -> {name, min, def, max, prim?, user?, macro?} | null}
   */
  function treeify(list, procs) {
    let cell = list;
    const peek = () => (cell instanceof Pair ? cell.f : undefined);
    const more = () => cell instanceof Pair;
    const next = () => { const c = cell; cell = cell.r; return c; };

    function call(name, entry, args, c, paren) {
      const n = at({ k: 'call', name, p: entry, a: args, paren: !!paren }, c);
      n.pure = !!(entry.prim && entry.prim.pure) && args.every((x) => x.pure);
      // simple control forms the interpreter runs inline (see Interp.inline)
      if (entry.prim && (entry.prim.inline === 'output' || entry.prim.inline === 'stop') && !n.missing) n.exitKind = entry.prim.inline;
      n.inl = entry.prim && entry.prim.inline && args.every((x) => x.pure) && (entry.prim.inline !== 'if' || args.length >= 2) ? entry.prim.inline : null;
      return n;
    }
    function opCall(op, l, r, c) {
      const name = OPNAME[op];
      const n = call(name, procs.get(name), [l, r], c);
      n.name = op;   // errors say "/ doesn't like 0 as input", as Berkeley Logo does
      return n;
    }

    function parseExpr(minPrec) {
      let left = parseUnary();
      for (;;) {
        const t = peek();
        if (!isOp(t)) break;
        const p = PREC[t];
        if (p < minPrec) break;
        const c = next();
        const right = parseExpr(t === '^' ? p : p + 1);
        left = opCall(t, left, right, c);
      }
      return left;
    }

    function parseUnary() {
      if (peek() === UMINUS) {
        const c = next();
        const operand = parseUnary();
        return call('minus', procs.get('minus'), [operand], c);
      }
      return parsePrimary();
    }

    /** Inputs for a call with its default number of inputs: {args} or {missing: node} */
    function parseArgs(entry, name, c) {
      const args = [];
      for (let i = 0; i < entry.def; i++) {
        if (!more() || peek() === ')') return { missing: at({ k: 'call', name, p: entry, a: args, missing: true, pure: false }, c) };
        args.push(parseExpr(1));
      }
      return { args };
    }

    function parsePrimary() {
      if (!more()) throw new LG.LogoError(6, { proc: 'the instruction' });
      const c = next();
      const t = c.f;
      if (typeof t === 'number') return at({ k: 'lit', v: t, pure: true }, c);
      if (isList(t) || t instanceof LArray) return at({ k: 'lit', v: t, pure: true }, c);
      if (typeof t !== 'string') return at({ k: 'lit', v: t, pure: true }, c);
      if (t === ')') throw new LG.LogoError(12);
      if (t === '(') return parseParen();
      // a minus where an input is expected is unary even with a space after it: print - :x
      if (t === '-') return call('minus', procs.get('minus'), [parseUnary()], c);
      if (isOp(t)) throw new LG.LogoError(6, { proc: t });
      const ch = t[0];
      if (ch === '"') return at({ k: 'lit', v: t.slice(1), pure: true }, c);
      if (ch === ':' && t.length > 1) return at({ k: 'var', n: t.slice(1).toLowerCase(), name: t.slice(1), pure: true }, c);
      if (isNumberWord(t)) return at({ k: 'lit', v: numLit(t), pure: true }, c);
      // template slots: ?  ?3
      const q = /^\?(\d+)$/.exec(t);
      if (q) return call('?', procs.get('?'), [{ k: 'lit', v: +q[1], pure: true }], c, true);
      const entry = procs.get(t.toLowerCase());
      if (!entry) return at({ k: 'unk', name: t, a: [], pure: false }, c);
      if (entry.special === 'to') throw new LG.LogoError(23);
      const r = parseArgs(entry, t, c);
      return r.missing || call(t, entry, r.args, c);
    }

    function parseParen() {
      const t = peek();
      let isProcName = typeof t === 'string' && t !== '(' && t !== ')' && !isOp(t) && t[0] !== '"' && t[0] !== ':' && !isNumberWord(t) && !/^\?\d+$/.test(t);
      // (xcor > 390) is grouping, not XCOR with extra inputs
      if (isProcName && cell instanceof Pair && cell.r instanceof Pair && isOp(cell.r.f)) isProcName = false;
      if (isProcName) {
        const c = next();
        const name = t.toLowerCase();
        const entry = procs.get(name);
        const args = [];
        while (more() && peek() !== ')') args.push(parseExpr(1));
        if (!more()) throw new LG.LogoError(10);
        next(); // )
        if (!entry) {
          return at({ k: 'unk', name: t, a: args, pure: false }, c);
        }
        if (entry.special === 'to') throw new LG.LogoError(23);
        if (args.length < entry.min) return at({ k: 'call', name: t, p: entry, a: args, missing: true, pure: false }, c);
        if (entry.max >= 0 && args.length > entry.max) throw new LG.LogoError(8);
        return call(t, entry, args, c, true);
      }
      const e = parseExpr(1);
      if (!more()) throw new LG.LogoError(10);
      if (peek() !== ')') throw new LG.LogoError(8);
      next();
      return e;
    }

    const out = [];
    while (more()) {
      if (peek() === ')') throw new LG.LogoError(12);
      out.push(parseExpr(1));
    }
    return out;
  }

  /** Trees for a list that is about to be run, cached until procedures change */
  const cache = new WeakMap();
  function treesFor(list, interp) {
    if (list === NIL) return [];
    const hit = cache.get(list);
    if (hit && hit.gen === interp.gen) return hit.trees;
    let trees;
    try {
      trees = treeify(runparse(list), interp.procTable);
    } catch (e) {
      // syntax errors point at the line being parsed
      if (e instanceof LG.LogoError && e.ln === undefined && list.ln !== undefined) { e.ln = list.ln; e.src = list.src; e.col = list.col; e.parseError = true; }
      throw e;
    }
    cache.set(list, { gen: interp.gen, trees });
    return trees;
  }

  /** Words that start a procedure title line: TO NAME :A :B [:C 5] [:REST] 2 */
  function parseTitle(list) {
    const items = LG.Data.toArray(list);
    const kw = String(items.shift() || '').toLowerCase();
    const nameW = items.shift();
    if (nameW === undefined) throw new LG.LogoError(6, { proc: kw.toUpperCase() });
    if (typeof nameW !== 'string' && typeof nameW !== 'number') throw new LG.LogoError(4, { proc: kw, datum: nameW });
    const name = String(nameW);
    const inputs = { req: [], opt: [], rest: null, def: null };
    for (const it of items) {
      if (typeof it === 'string' && it[0] === ':') {
        if (inputs.opt.length || inputs.rest) throw new LG.LogoError(4, { proc: kw, datum: it });
        inputs.req.push(it.slice(1).toLowerCase());
      } else if (typeof it === 'string' && /^\d+$/.test(it)) {
        inputs.def = parseInt(it, 10);
      } else if (isList(it) && it !== NIL) {
        const parts = LG.Data.toArray(it);
        const vn = String(parts[0]).replace(/^:/, '').toLowerCase();
        if (parts.length === 1) inputs.rest = vn;
        else inputs.opt.push({ name: vn, dflt: LG.Data.fromArray(parts.slice(1)) });
      } else {
        throw new LG.LogoError(4, { proc: kw, datum: it });
      }
    }
    return { kw, name, inputs };
  }

  LG.Parser = { treeify, treesFor, parseTitle, OPNAME, PREC };
})(LG);
