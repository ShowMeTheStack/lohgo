// Arithmetic, comparisons, random numbers, bitwise operations and logic.
(function (LG) {
  'use strict';
  const D = LG.Data;
  const { isList, isWord } = D;
  const T = (b) => (b ? 'true' : 'false');
  const DEG = Math.PI / 180;

  /** Small seedable generator (mulberry32) so RERANDOM gives repeatable sequences */
  function makeRandom(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** Round half away from zero, as C's round() does */
  const roundC = (x) => Math.sign(x) * Math.round(Math.abs(x));
  /** Clean up tiny floating point noise from degree trig: sin 180 is 0, not 1.2e-16 */
  const tidy = (x) => (Math.abs(x) < 1e-15 ? 0 : Math.abs(x - Math.round(x)) < 1e-15 ? Math.round(x) : x);

  LG.Prims.add('math', (I) => {
    const g = { group: 'math' };
    const def = (n, a, b, c, fn, o) => I.def(n, a, b, c, fn, Object.assign({}, g, o));
    const num = (v, n) => I.num(v, n);

    I.random = makeRandom(Date.now() ^ 0x5bd1e995);
    I.randInt = (k) => Math.floor(I.random() * k);

    def('sum', 0, 2, -1, function (args, n) { let s = 0; for (const a of args) s += num(a, n); return s; });
    def('difference', 2, 2, 2, function ([a, b], n) { return num(a, n) - num(b, n); });
    def('minus', 1, 1, 1, function ([a], n) { return -num(a, n); });
    def('product', 0, 2, -1, function (args, n) { let s = 1; for (const a of args) s *= num(a, n); return s; });
    def('quotient', 1, 2, 2, function (args, n) {
      if (args.length === 1) { const d = num(args[0], n); if (d === 0) throw I.bad(n, args[0]); return 1 / d; }
      const a = num(args[0], n), b = num(args[1], n);
      if (b === 0) throw I.bad(n, args[1]);
      return a / b;
    });
    def('remainder', 2, 2, 2, function ([a, b], n) {
      const x = num(a, n), y = num(b, n);
      if (y === 0) throw I.bad(n, b);
      if (Number.isInteger(x) && Number.isInteger(y)) return x % y;
      return x % y;
    });
    def('modulo', 2, 2, 2, function ([a, b], n) {
      const x = num(a, n), y = num(b, n);
      if (y === 0) throw I.bad(n, b);
      const r = x % y;
      return r !== 0 && (r < 0) !== (y < 0) ? r + y : r;
    });
    def('int', 1, 1, 1, function ([a], n) { return Math.trunc(num(a, n)); });
    def('round', 1, 1, 1, function ([a], n) { return roundC(num(a, n)); });
    def('sqrt', 1, 1, 1, function ([a], n) { const x = num(a, n); if (x < 0) throw I.bad(n, a); return Math.sqrt(x); });
    def('power', 2, 2, 2, function ([a, b], n) {
      const x = num(a, n), y = num(b, n);
      if (x < 0 && !Number.isInteger(y)) throw I.bad(n, b);
      return Math.pow(x, y);
    });
    def('exp', 1, 1, 1, function ([a], n) { return Math.exp(num(a, n)); });
    def('log10', 1, 1, 1, function ([a], n) { const x = num(a, n); if (x <= 0) throw I.bad(n, a); return Math.log10(x); });
    def('ln', 1, 1, 1, function ([a], n) { const x = num(a, n); if (x <= 0) throw I.bad(n, a); return Math.log(x); });
    def('sin', 1, 1, 1, function ([a], n) { return tidy(Math.sin(num(a, n) * DEG)); });
    def('cos', 1, 1, 1, function ([a], n) { return tidy(Math.cos(num(a, n) * DEG)); });
    def('tan', 1, 1, 1, function ([a], n) { return tidy(Math.tan(num(a, n) * DEG)); });
    def('radsin', 1, 1, 1, function ([a], n) { return Math.sin(num(a, n)); });
    def('radcos', 1, 1, 1, function ([a], n) { return Math.cos(num(a, n)); });
    def('radtan', 1, 1, 1, function ([a], n) { return Math.tan(num(a, n)); });
    def('arctan', 1, 1, 2, function (args, n) {
      if (args.length === 2) return tidy(Math.atan2(num(args[1], n), num(args[0], n)) / DEG);
      return tidy(Math.atan(num(args[0], n)) / DEG);
    });
    def('radarctan', 1, 1, 2, function (args, n) {
      if (args.length === 2) return Math.atan2(num(args[1], n), num(args[0], n));
      return Math.atan(num(args[0], n));
    });
    def('arcsin', 1, 1, 1, function ([a], n) { const x = num(a, n); if (x < -1 || x > 1) throw I.bad(n, a); return tidy(Math.asin(x) / DEG); });
    def('arccos', 1, 1, 1, function ([a], n) { const x = num(a, n); if (x < -1 || x > 1) throw I.bad(n, a); return tidy(Math.acos(x) / DEG); });
    def('radarcsin', 1, 1, 1, function ([a], n) { const x = num(a, n); if (x < -1 || x > 1) throw I.bad(n, a); return Math.asin(x); });
    def('radarccos', 1, 1, 1, function ([a], n) { const x = num(a, n); if (x < -1 || x > 1) throw I.bad(n, a); return Math.acos(x); });
    def('abs', 1, 1, 1, function ([a], n) { return Math.abs(num(a, n)); });
    def('pi', 0, 0, 0, function () { return Math.PI; });
    def('iseq', 2, 2, 2, function ([a, b], n) {
      const x = I.int(a, n), y = I.int(b, n);
      if (Math.abs(y - x) > 10000000) throw I.bad(n, b);
      const out = [];
      if (x <= y) for (let i = x; i <= y; i++) out.push(i); else for (let i = x; i >= y; i--) out.push(i);
      return D.fromArray(out);
    });
    def('rseq', 3, 3, 3, function ([a, b, c], n) {
      const x = num(a, n), y = num(b, n), k = I.int(c, n);
      if (k < 0 || k > 10000000) throw I.bad(n, c);
      const out = [];
      for (let i = 0; i < k; i++) out.push(k === 1 ? x : x + (y - x) * i / (k - 1));
      return D.fromArray(out);
    });

    // ---- comparisons ------------------------------------------------------------------------
    def('lessp less?', 2, 2, 2, function ([a, b], n) { return T(num(a, n) < num(b, n)); });
    def('greaterp greater?', 2, 2, 2, function ([a, b], n) { return T(num(a, n) > num(b, n)); });
    def('lessequalp lessequal?', 2, 2, 2, function ([a, b], n) { return T(num(a, n) <= num(b, n)); });
    def('greaterequalp greaterequal?', 2, 2, 2, function ([a, b], n) { return T(num(a, n) >= num(b, n)); });

    // ---- random -----------------------------------------------------------------------------
    def('random', 1, 1, 2, function (args, n) {
      if (args.length === 2) {
        const lo = I.int(args[0], n), hi = I.int(args[1], n);
        if (hi < lo) throw I.bad(n, args[1]);
        return lo + I.randInt(hi - lo + 1);
      }
      const k = I.int(args[0], n);
      if (k <= 0) throw I.bad(n, args[0]);
      return I.randInt(k);
    });
    def('rerandom', 0, 0, 1, function (args, n) { I.random = makeRandom(args.length ? I.int(args[0], n) : 0); });

    // ---- formatting -------------------------------------------------------------------------
    def('form', 3, 3, 3, function ([a, w, p], n) {
      const x = num(a, n), width = I.int(w, n);
      let s;
      if (isWord(p) && D.isNumberWord(p)) {
        const prec = I.int(p, n);
        if (prec < 0) throw I.bad(n, p);
        s = x.toFixed(Math.min(prec, 100));
      } else {
        // a printf-style format such as "%5.2f"
        const f = I.word(p, n);
        const m = /^%(-?)(\d*)(?:\.(\d+))?([dfegx])$/.exec(f);
        if (!m) throw I.bad(n, p);
        const pr = m[3] !== undefined ? +m[3] : 6;
        s = m[4] === 'd' ? String(Math.trunc(x)) : m[4] === 'x' ? Math.trunc(x).toString(16) : m[4] === 'e' ? x.toExponential(pr) : m[4] === 'g' ? String(+x.toPrecision(pr || 1)) : x.toFixed(pr);
        if (m[2]) s = m[1] ? s.padEnd(+m[2]) : s.padStart(+m[2]);
        return s;
      }
      return s.padStart(width);
    });

    // ---- bitwise ----------------------------------------------------------------------------
    def('bitand', 0, 2, -1, function (args, n) { let r = -1; for (const a of args) r &= I.int(a, n); return r; });
    def('bitor', 0, 2, -1, function (args, n) { let r = 0; for (const a of args) r |= I.int(a, n); return r; });
    def('bitxor', 0, 2, -1, function (args, n) { let r = 0; for (const a of args) r ^= I.int(a, n); return r; });
    def('bitnot', 1, 1, 1, function ([a], n) { return ~I.int(a, n); });
    // shifts work on 64-bit integers, like Berkeley Logo's C longs
    const big = (x) => BigInt.asIntN(64, BigInt(x));
    const small = (v) => Number(BigInt.asIntN(64, v));
    def('ashift', 2, 2, 2, function ([a, b], n) {
      const x = big(I.int(a, n)), k = I.int(b, n);
      if (Math.abs(k) > 63) return k > 0 ? 0 : (x < 0n ? -1 : 0);
      return small(k >= 0 ? x << BigInt(k) : x >> BigInt(-k));
    });
    def('lshift', 2, 2, 2, function ([a, b], n) {
      const x = BigInt.asUintN(64, BigInt(I.int(a, n))), k = I.int(b, n);
      if (Math.abs(k) > 63) return 0;
      return small(k >= 0 ? x << BigInt(k) : x >> BigInt(-k));
    });

    // ---- logic: inputs may be instruction lists that are run only when needed ----------------
    function* truth(v, n) {
      if (isList(v)) v = yield* I.runList(v, true);
      return I.bool(v, n);
    }
    def('and', 0, 2, -1, function* (args, n) {
      for (const a of args) if (!(yield* truth(a, n))) return 'false';
      return 'true';
    }, { gen: true });
    def('or', 0, 2, -1, function* (args, n) {
      for (const a of args) if (yield* truth(a, n)) return 'true';
      return 'false';
    }, { gen: true });
    def('not', 1, 1, 1, function* ([a], n) { return T(!(yield* truth(a, n))); }, { gen: true });
  });

  LG.makeRandom = makeRandom;
})(LG);
