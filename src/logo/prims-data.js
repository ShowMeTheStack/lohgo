// Words, lists, arrays, predicates, property lists, stacks and queues.
(function (LG) {
  'use strict';
  const D = LG.Data;
  const { Pair, NIL, LArray, isList, isWord, isArray } = D;
  const LogoError = LG.LogoError;
  const T = (b) => (b ? 'true' : 'false');

  /** The characters of a word as a JS array (handles astral characters) */
  const chars = (w) => Array.from(D.wordText(w));

  LG.Prims.add('data', (I) => {
    const g = { group: 'data' };
    const def = (n, a, b, c, fn, o) => I.def(n, a, b, c, fn, Object.assign({}, g, o));
    const wordOf = (v, node) => { if (!isWord(v)) throw I.bad(node, v); return D.wordText(v); };

    // ---- constructors ----------------------------------------------------------------------
    def('word', 0, 2, -1, function (args, n) { return args.map((a) => wordOf(a, n)).join(''); });
    def('list', 0, 2, -1, function (args) { return D.fromArray(args); });
    def('sentence se', 0, 2, -1, function (args, n) {
      const out = [];
      for (const a of args) {
        if (isList(a)) out.push(...D.toArray(a));
        else if (isArray(a)) throw I.bad(n, a);
        else out.push(a);
      }
      return D.fromArray(out);
    });
    def('fput', 2, 2, 2, function ([x, l], n) {
      if (isList(l)) return new Pair(x, l);
      if (isWord(l) && isWord(x) && chars(x).length === 1) return D.wordText(x) + D.wordText(l);
      throw I.bad(n, l);
    });
    def('lput', 2, 2, 2, function ([x, l], n) {
      if (isList(l)) return D.fromArray(D.toArray(l).concat([x]));
      if (isWord(l) && isWord(x) && chars(x).length === 1) return D.wordText(l) + D.wordText(x);
      throw I.bad(n, l);
    });
    def('array', 1, 1, 2, function ([size, origin], n) {
      const s = I.int(size, n);
      if (s < 0) throw I.bad(n, size);
      const a = new Array(s); for (let i = 0; i < s; i++) a[i] = NIL;
      return new LArray(a, origin === undefined ? 1 : I.int(origin, n));
    });
    def('mdarray', 1, 1, 2, function ([sizes, origin], n) {
      const dims = D.toArray(I.list(sizes, n)).map((x) => I.int(x, n));
      const o = origin === undefined ? 1 : I.int(origin, n);
      const make = (k) => {
        const a = new Array(dims[k]);
        for (let i = 0; i < dims[k]; i++) a[i] = k === dims.length - 1 ? NIL : make(k + 1);
        return new LArray(a, o);
      };
      if (!dims.length || dims.some((d) => d < 0)) throw I.bad(n, sizes);
      return make(0);
    });
    def('listtoarray', 1, 1, 2, function ([l, origin], n) { return new LArray(D.toArray(I.list(l, n)), origin === undefined ? 1 : I.int(origin, n)); });
    def('arraytolist', 1, 1, 1, function ([a], n) { if (!isArray(a)) throw I.bad(n, a); return D.fromArray(a.a.slice()); });
    def('combine', 2, 2, 2, function ([a, b], n) {
      if (isList(b)) return new Pair(a, b);
      return wordOf(a, n) + wordOf(b, n);
    });
    def('reverse', 1, 1, 1, function ([l], n) {
      if (isList(l)) return D.fromArray(D.toArray(l).reverse());
      if (isWord(l)) return chars(l).reverse().join('');
      throw I.bad(n, l);
    });
    let gensymN = 0;
    def('gensym', 0, 0, 0, function () { return 'G' + (++gensymN); });

    // ---- selectors -------------------------------------------------------------------------
    def('first', 1, 1, 1, function ([x], n) {
      if (x instanceof Pair) return x.f;
      if (isArray(x)) return x.origin;
      if (isWord(x) && D.wordText(x) !== '') return chars(x)[0];
      throw I.bad(n, x);
    });
    def('firsts', 1, 1, 1, function ([l], n) {
      return D.fromArray(D.toArray(I.list(l, n)).map((x) => {
        if (x instanceof Pair) return x.f;
        if (isWord(x) && D.wordText(x) !== '') return chars(x)[0];
        throw I.bad(n, l);
      }));
    });
    def('last', 1, 1, 1, function ([x], n) {
      if (x instanceof Pair) { while (x.r instanceof Pair) x = x.r; return x.f; }
      if (isWord(x) && D.wordText(x) !== '') { const c = chars(x); return c[c.length - 1]; }
      throw I.bad(n, x);
    });
    def('butfirst bf', 1, 1, 1, function ([x], n) {
      if (x instanceof Pair) return x.r;
      if (isWord(x) && D.wordText(x) !== '') return chars(x).slice(1).join('');
      throw I.bad(n, x);
    });
    def('butfirsts bfs', 1, 1, 1, function ([l], n) {
      return D.fromArray(D.toArray(I.list(l, n)).map((x) => {
        if (x instanceof Pair) return x.r;
        if (isWord(x) && D.wordText(x) !== '') return chars(x).slice(1).join('');
        throw I.bad(n, l);
      }));
    });
    def('butlast bl', 1, 1, 1, function ([x], n) {
      if (x instanceof Pair) return D.fromArray(D.toArray(x).slice(0, -1));
      if (isWord(x) && D.wordText(x) !== '') return chars(x).slice(0, -1).join('');
      throw I.bad(n, x);
    });
    const itemOf = (i, x, n, iv) => {
      if (isArray(x)) {
        const k = i - x.origin;
        if (k < 0 || k >= x.a.length) throw I.bad(n, iv);
        return x.a[k];
      }
      if (isList(x)) {
        if (i < 1) throw I.bad(n, iv);
        let l = x;
        for (let k = 1; k < i && l instanceof Pair; k++) l = l.r;
        if (!(l instanceof Pair)) throw I.bad(n, iv);
        return l.f;
      }
      if (isWord(x)) {
        const c = chars(x);
        if (i < 1 || i > c.length) throw I.bad(n, iv);
        return c[i - 1];
      }
      throw I.bad(n, x);
    };
    def('item', 2, 2, 2, function ([i, x], n) { return itemOf(I.int(i, n), x, n, i); });
    def('mditem', 2, 2, 2, function ([idx, a], n) {
      let x = a;
      for (const i of D.toArray(I.list(idx, n))) x = itemOf(I.int(i, n), x, n, idx);
      return x;
    });
    def('pick', 1, 1, 1, function ([x], n) {
      if (isList(x) && x !== NIL) { const a = D.toArray(x); return a[I.randInt(a.length)]; }
      if (isWord(x) && D.wordText(x) !== '') { const c = chars(x); return c[I.randInt(c.length)]; }
      throw I.bad(n, x);
    });
    def('remove', 2, 2, 2, function ([t, x], n) {
      if (isList(x)) return D.fromArray(D.toArray(x).filter((e) => !D.equal(e, t, I.caseIgnoredp())));
      if (isWord(x)) { const tt = wordOf(t, n); return chars(x).filter((c) => !D.wordEqual(c, tt, I.caseIgnoredp())).join(''); }
      throw I.bad(n, x);
    });
    def('remdup', 1, 1, 1, function ([x], n) {
      const ci = I.caseIgnoredp();
      const keep = (arr) => arr.filter((e, i) => !arr.slice(i + 1).some((f) => D.equal(e, f, ci)));
      if (isList(x)) return D.fromArray(keep(D.toArray(x)));
      if (isWord(x)) return keep(chars(x)).join('');
      throw I.bad(n, x);
    });
    def('quoted', 1, 1, 1, function ([x]) { return isWord(x) ? '"' + D.wordText(x) : x; });

    // ---- mutators --------------------------------------------------------------------------
    const contains = (hay, needle, depth) => {
      if (hay === needle) return true;
      if (depth > 10000) return false;
      if (isArray(hay)) return hay.a.some((e) => contains(e, needle, depth + 1));
      if (hay instanceof Pair) { for (let l = hay; l instanceof Pair; l = l.r) if (contains(l.f, needle, depth + 1)) return true; }
      return false;
    };
    def('setitem', 3, 3, 3, function ([i, a, v], n) {
      if (!isArray(a)) throw I.bad(n, a);
      const k = I.int(i, n) - a.origin;
      if (k < 0 || k >= a.a.length) throw I.bad(n, i);
      if (contains(v, a, 0)) throw I.bad(n, v);
      a.a[k] = v;
    });
    def('mdsetitem', 3, 3, 3, function ([idx, a, v], n) {
      const ix = D.toArray(I.list(idx, n));
      let x = a;
      for (let j = 0; j < ix.length - 1; j++) x = itemOf(I.int(ix[j], n), x, n, idx);
      if (!isArray(x)) throw I.bad(n, a);
      const k = I.int(ix[ix.length - 1], n) - x.origin;
      if (k < 0 || k >= x.a.length) throw I.bad(n, idx);
      if (contains(v, a, 0)) throw I.bad(n, v);
      x.a[k] = v;
    });
    def('.setitem', 3, 3, 3, function ([i, a, v], n) {
      if (!isArray(a)) throw I.bad(n, a);
      const k = I.int(i, n) - a.origin;
      if (k < 0 || k >= a.a.length) throw I.bad(n, i);
      a.a[k] = v;
    });
    def('.setfirst', 2, 2, 2, function ([l, v], n) { if (!(l instanceof Pair)) throw I.bad(n, l); l.f = v; I.gen++; });
    def('.setbf', 2, 2, 2, function ([l, v], n) { if (!(l instanceof Pair)) throw I.bad(n, l); if (!isList(v)) throw I.bad(n, v); l.r = v; I.gen++; });
    const varName = (v, n) => wordOf(v, n).toLowerCase();
    def('push', 2, 2, 2, function ([name, x], n) {
      const k = varName(name, n);
      const cur = I.hasValue(k) ? I.getVar(k) : NIL;
      I.setVar(k, new Pair(x, I.list(cur, n)));
    });
    def('pop', 1, 1, 1, function ([name], n) {
      const k = varName(name, n);
      const cur = I.getVar(k);
      if (!(cur instanceof Pair)) throw I.bad(n, cur);
      I.setVar(k, cur.r);
      return cur.f;
    });
    def('queue', 2, 2, 2, function ([name, x], n) {
      const k = varName(name, n);
      const cur = I.hasValue(k) ? I.getVar(k) : NIL;
      I.setVar(k, D.fromArray(D.toArray(I.list(cur, n)).concat([x])));
    });
    def('dequeue', 1, 1, 1, function ([name], n) {
      const k = varName(name, n);
      const cur = I.getVar(k);
      if (!(cur instanceof Pair)) throw I.bad(n, cur);
      I.setVar(k, cur.r);
      return cur.f;
    });

    // ---- predicates ------------------------------------------------------------------------
    def('wordp word?', 1, 1, 1, function ([x]) { return T(isWord(x)); });
    def('listp list?', 1, 1, 1, function ([x]) { return T(isList(x)); });
    def('arrayp array?', 1, 1, 1, function ([x]) { return T(isArray(x)); });
    def('emptyp empty?', 1, 1, 1, function ([x]) { return T(x === NIL || (isWord(x) && D.wordText(x) === '')); });
    def('equalp equal?', 2, 2, 2, function ([a, b]) { return T(D.equal(a, b, I.caseIgnoredp())); });
    def('notequalp notequal?', 2, 2, 2, function ([a, b]) { return T(!D.equal(a, b, I.caseIgnoredp())); });
    def('beforep before?', 2, 2, 2, function ([a, b], n) {
      let x = wordOf(a, n), y = wordOf(b, n);
      if (I.caseIgnoredp()) { x = x.toLowerCase(); y = y.toLowerCase(); }
      return T(x < y);
    });
    def('.eq', 2, 2, 2, function ([a, b]) { return T(a === b || (isWord(a) && isWord(b) && a === b)); });
    def('memberp member?', 2, 2, 2, function ([x, l], n) {
      const ci = I.caseIgnoredp();
      if (isList(l)) { for (let p = l; p instanceof Pair; p = p.r) if (D.equal(x, p.f, ci)) return 'true'; return 'false'; }
      if (isArray(l)) return T(l.a.some((e) => D.equal(x, e, ci)));
      if (isWord(l)) { if (!isWord(x)) return 'false'; const c = D.wordText(x); if (chars(c).length !== 1) return 'false'; return T(chars(l).some((d) => D.wordEqual(c, d, ci))); }
      throw I.bad(n, l);
    });
    def('substringp substring?', 2, 2, 2, function ([a, b]) {
      if (!isWord(a) || !isWord(b)) return 'false';
      let x = D.wordText(a), y = D.wordText(b);
      if (I.caseIgnoredp()) { x = x.toLowerCase(); y = y.toLowerCase(); }
      return T(y.includes(x));
    });
    def('numberp number?', 1, 1, 1, function ([x]) { return T(typeof x === 'number' || (typeof x === 'string' && D.isNumberWord(x))); });
    def('vbarredp vbarred? backslashedp backslashed?', 1, 1, 1, function ([x], n) { wordOf(x, n); return 'false'; });

    // ---- queries ---------------------------------------------------------------------------
    def('count', 1, 1, 1, function ([x], n) {
      if (isList(x)) return D.count(x);
      if (isArray(x)) return x.a.length;
      if (isWord(x)) return chars(x).length;
      throw I.bad(n, x);
    });
    def('ascii rawascii', 1, 1, 1, function ([x], n) {
      const c = chars(wordOf(x, n));
      if (c.length !== 1) throw I.bad(n, x);
      return c[0].codePointAt(0);
    });
    def('char', 1, 1, 1, function ([x], n) {
      const k = I.int(x, n);
      if (k < 0 || k > 0x10FFFF) throw I.bad(n, x);
      return String.fromCodePoint(k);
    });
    def('member', 2, 2, 2, function ([x, l], n) {
      const ci = I.caseIgnoredp();
      if (isList(l)) { for (let p = l; p instanceof Pair; p = p.r) if (D.equal(x, p.f, ci)) return p; return NIL; }
      if (isWord(l)) {
        const c = chars(l), t = wordOf(x, n);
        for (let i = 0; i < c.length; i++) if (D.wordEqual(c[i], t, ci)) return c.slice(i).join('');
        return '';
      }
      throw I.bad(n, l);
    });
    def('lowercase', 1, 1, 1, function ([x], n) { return wordOf(x, n).toLowerCase(); });
    def('uppercase', 1, 1, 1, function ([x], n) { return wordOf(x, n).toUpperCase(); });
    def('standout', 1, 1, 1, function ([x], n) { return wordOf(x, n); });
    def('parse', 1, 1, 1, function ([x], n) { return LG.Reader.readList(wordOf(x, n)); });
    def('runparse', 1, 1, 1, function ([x], n) {
      const l = isWord(x) ? LG.Reader.readList(D.wordText(x)) : I.list(x, n);
      return LG.Reader.runparse(l);
    });

    // ---- property lists --------------------------------------------------------------------
    const plist = (name, n, create) => {
      const k = wordOf(name, n).toLowerCase();
      let p = I.plists.get(k);
      if (!p && create) { p = new Map(); I.plists.set(k, p); }
      return p;
    };
    const propKey = (v, n) => wordOf(v, n).toLowerCase();
    def('pprop', 3, 3, 3, function ([name, prop, v], n) { plist(name, n, true).set(propKey(prop, n), { name: D.wordText(prop), value: v }); });
    def('gprop', 2, 2, 2, function ([name, prop], n) {
      const p = plist(name, n, false);
      const e = p && p.get(propKey(prop, n));
      return e ? e.value : NIL;
    });
    def('remprop', 2, 2, 2, function ([name, prop], n) {
      const p = plist(name, n, false);
      if (p) { p.delete(propKey(prop, n)); if (!p.size) I.plists.delete(wordOf(name, n).toLowerCase()); }
    });
    def('plist', 1, 1, 1, function ([name], n) {
      const p = plist(name, n, false);
      const out = [];
      if (p) for (const e of p.values()) out.push(e.name, e.value);
      return D.fromArray(out);
    });
  });
})(LG);
