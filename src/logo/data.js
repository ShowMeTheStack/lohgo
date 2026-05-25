// Logo data: words (JS strings or numbers), lists (linked pairs, like Berkeley Logo), arrays,
// printing, number formatting and equality.
(function (LG) {
  'use strict';

  /** A list cell. ln/col/src remember where a token came from in source code (for the debugger). */
  class Pair {
    constructor(f, r) { this.f = f; this.r = r; }
  }
  /** The empty list. Its own object so identity tests are cheap. */
  const NIL = Object.freeze({ nil: true, toString() { return '[]'; } });
  /** Logo arrays: {a: JS array, origin} */
  class LArray {
    constructor(a, origin) { this.a = a; this.origin = origin === undefined ? 1 : origin; }
  }
  /** Marker produced by runparse for a unary minus ("-" glued to what follows). */
  const UMINUS = Object.freeze({ uminus: true, toString() { return '-'; } });

  const isList = (x) => x === NIL || x instanceof Pair;
  const isWord = (x) => typeof x === 'string' || typeof x === 'number';
  const isArray = (x) => x instanceof LArray;

  function fromArray(arr, tail) {
    let l = tail || NIL;
    for (let i = arr.length - 1; i >= 0; i--) l = new Pair(arr[i], l);
    return l;
  }
  function list(...items) { return fromArray(items); }
  function toArray(l) {
    const out = [];
    let n = 0;
    while (l instanceof Pair) { out.push(l.f); l = l.r; if (++n > 50000000) break; }
    return out;
  }
  function count(l) { let n = 0; while (l instanceof Pair) { n++; l = l.r; } return n; }

  // ---- numbers ---------------------------------------------------------------------------------
  const NUM_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
  function isNumberWord(s) { return typeof s === 'number' || (typeof s === 'string' && s.length < 400 && NUM_RE.test(s)); }
  /** The number a word stands for, or NaN if it is not numeric */
  function num(x) {
    if (typeof x === 'number') return x;
    if (typeof x === 'string' && x.length < 400 && NUM_RE.test(x)) return parseFloat(x);
    return NaN;
  }
  /** Berkeley Logo prints integers exactly and other numbers with 15 significant digits. */
  function formatNumber(n) {
    if (Number.isInteger(n) && Math.abs(n) < 1e15) return Object.is(n, -0) ? '0' : String(n);
    if (!isFinite(n)) return isNaN(n) ? 'nan' : n > 0 ? 'inf' : '-inf';
    let s = n.toPrecision(15);
    if (s.includes('e')) {
      let [m, e] = s.split('e');
      if (m.includes('.')) m = m.replace(/0+$/, '').replace(/\.$/, '');
      const ev = parseInt(e, 10);
      return m + 'e' + (ev < 0 ? '-' : '+') + String(Math.abs(ev)).padStart(2, '0');
    }
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }
  /** The text of a word */
  function wordText(x) { return typeof x === 'number' ? formatNumber(x) : x; }

  // ---- printing ------------------------------------------------------------------------------
  const SPECIAL = /[\s[\]{}()|;"\\]/;
  /**
   * Text for PRINT/TYPE/SHOW.
   * opts.outer: wrap a list in brackets (SHOW does, PRINT does not)
   * opts.full: FULLPRINTP, show vertical bars around words that need them
   * opts.depth/width: PRINTDEPTHLIMIT and PRINTWIDTHLIMIT
   */
  function toText(x, opts) {
    opts = opts || {};
    const full = !!opts.full;
    const depthLimit = opts.depth >= 0 ? opts.depth : -1;
    const widthLimit = opts.width >= 0 ? opts.width : -1;
    let budget = opts.budget || 2000000;
    const parts = [];
    const word = (w) => {
      const t = wordText(w);
      if (full && typeof w === 'string' && (w === '' || SPECIAL.test(w))) return '|' + t.replace(/\|/g, '\\|') + '|';
      return t;
    };
    const rec = (v, depth, top) => {
      if (--budget < 0) { parts.push('...'); return; }
      if (isWord(v)) { parts.push(word(v)); return; }
      if (v === UMINUS) { parts.push('-'); return; }
      if (isList(v)) {
        if (depthLimit >= 0 && depth > depthLimit) { parts.push('...'); return; }
        if (!top) parts.push('[');
        let first = true, n = 0;
        for (let l = v; l instanceof Pair; l = l.r) {
          if (!first) parts.push(' ');
          if (widthLimit >= 0 && n >= widthLimit) { parts.push('...'); break; }
          rec(l.f, depth + 1, false);
          first = false; n++;
          if (budget < 0) break;
        }
        if (!top) parts.push(']');
        return;
      }
      if (v instanceof LArray) {
        if (depthLimit >= 0 && depth > depthLimit) { parts.push('...'); return; }
        parts.push('{');
        v.a.forEach((e, i) => {
          if (i) parts.push(' ');
          if (widthLimit >= 0 && i >= widthLimit) { if (i === widthLimit) parts.push('...'); return; }
          rec(e, depth + 1, false);
        });
        parts.push('}');
        if (v.origin !== 1) parts.push('@' + v.origin);
        return;
      }
      if (v && v.proc) { parts.push(v.proc.name); return; }
      parts.push(String(v));
    };
    rec(x, 0, !opts.outer);
    return parts.join('');
  }
  const printText = (x, o) => toText(x, Object.assign({ outer: false }, o));
  const showText = (x, o) => toText(x, Object.assign({ outer: true }, o));

  // ---- equality ------------------------------------------------------------------------------
  function wordEqual(a, b, ignoreCase) {
    if (typeof a === 'number' || typeof b === 'number' || (NUM_RE.test(a) && NUM_RE.test(b))) {
      const x = num(a), y = num(b);
      if (!isNaN(x) && !isNaN(y)) return x === y;
    }
    const s = wordText(a), t = wordText(b);
    return ignoreCase ? s === t || s.toLowerCase() === t.toLowerCase() : s === t;
  }
  function equal(a, b, ignoreCase) {
    if (a === b) return true;
    if (isWord(a)) return isWord(b) && wordEqual(a, b, ignoreCase);
    if (isList(a)) {
      if (!isList(b)) return false;
      while (a instanceof Pair && b instanceof Pair) {
        if (a === b) return true;
        if (!equal(a.f, b.f, ignoreCase)) return false;
        a = a.r; b = b.r;
      }
      return a === NIL && b === NIL;
    }
    return false; // arrays are equal only to themselves
  }

  /** Copy of a list's spine (elements shared) */
  function copyList(l) { return fromArray(toArray(l)); }

  LG.Data = { Pair, NIL, LArray, UMINUS, isList, isWord, isArray, fromArray, list, toArray, count, isNumberWord, num, formatNumber, wordText, toText, printText, showText, equal, wordEqual, copyList, NUM_RE };
})(LG);
