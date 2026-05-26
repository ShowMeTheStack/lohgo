// Reader: Logo source text -> logical lines of words, lists and arrays (the way Berkeley Logo
// reads them), and RUNPARSE, which splits infix operators out of words before a line is run.
(function (LG) {
  'use strict';
  const { Pair, NIL, LArray, UMINUS, isNumberWord } = LG.Data;

  const INFIX = new Set(['+', '-', '*', '/', '=', '<', '>', '<=', '>=', '<>', '^']);
  const INFIX_CH = '+-*/=<>^';

  /** Build a list from [{v, ln, col}] keeping source positions on each cell */
  function build(items, src) {
    let l = NIL;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      const p = new Pair(it.v, l);
      if (it.ln !== undefined) { p.ln = it.ln; p.col = it.col; if (src !== undefined) p.src = src; }
      l = p;
    }
    return l;
  }

  /**
   * Read text into logical lines.
   * opts.src     file id stored on list cells (for breakpoints)
   * opts.ln0     line number of the first line (1-based)
   * opts.positions  keep line/column on cells (default true)
   * Returns [{list, ln, endLn, text}] or throws LogoError 26/27 for stray ] or }.
   */
  function read(text, opts) {
    opts = opts || {};
    const pos = opts.positions !== false;
    const src = opts.src;
    const lines = [];
    let ln = opts.ln0 || 1;
    let col = 0;
    let lineStart = 0, lineLn = ln;
    let top = [];
    const stack = [];
    let buf = '', started = false, wln = 0, wcol = 0;
    const cur = () => (stack.length ? stack[stack.length - 1].items : top);
    const flush = () => {
      if (!started) return;
      cur().push(pos ? { v: buf, ln: wln, col: wcol } : { v: buf });
      buf = ''; started = false;
    };
    const begin = () => { if (!started) { started = true; wln = ln; wcol = col; } };
    const endLine = (endIdx) => {
      flush();
      // unterminated [ or { at end of input: close them
      while (stack.length) closeFrame(stack[stack.length - 1].kind);
      if (top.length) lines.push({ list: build(top, src), ln: lineLn, endLn: ln, text: text.slice(lineStart, endIdx) });
      top = [];
    };
    const closeFrame = (kind) => {
      const fr = stack.pop();
      let v;
      if (kind === '[') v = build(fr.items, src);
      else v = new LArray(fr.items.map((x) => x.v), 1);
      (stack.length ? stack[stack.length - 1].items : top).push(pos ? { v, ln: fr.ln, col: fr.col } : { v });
      return v;
    };
    const n = text.length;
    let i = 0;
    let inBar = false;
    while (i < n) {
      const ch = text[i];
      if (inBar) {
        if (ch === '|') inBar = false;
        else if (ch === '\\' && i + 1 < n) { buf += text[i + 1]; i++; col++; }
        else { buf += ch; if (ch === '\n') { ln++; col = -1; } }
        i++; col++;
        continue;
      }
      if (ch === '\\' && i + 1 < n) {
        begin();
        const nx = text[i + 1];
        buf += nx;
        if (nx === '\n') { ln++; col = -1; }
        i += 2; col += 2;
        continue;
      }
      if (ch === '|') { begin(); inBar = true; i++; col++; continue; }
      if (ch === ';') {
        flush();
        while (i < n && text[i] !== '\n') { i++; col++; }
        continue;
      }
      if (ch === '~') {
        // a ~ that ends a physical line joins it with the next one
        let j = i + 1;
        while (j < n && (text[j] === ' ' || text[j] === '\t' || text[j] === '\r')) j++;
        if (j >= n || text[j] === '\n') {
          flush();
          if (j < n) { ln++; col = 0; i = j + 1; } else i = j;
          continue;
        }
      }
      if (ch === ' ' || ch === '\t' || ch === '\r') { flush(); i++; col++; continue; }
      if (ch === '\n') {
        if (!stack.length) { endLine(i); ln++; col = 0; i++; lineStart = i; lineLn = ln; continue; }
        flush(); ln++; col = 0; i++;
        continue;
      }
      if (ch === '[' || ch === '{') {
        flush();
        stack.push({ kind: ch, items: [], ln, col });
        i++; col++;
        continue;
      }
      if (ch === ']' || ch === '}') {
        flush();
        const want = ch === ']' ? '[' : '{';
        if (!stack.length || stack[stack.length - 1].kind !== want) {
          const e = new LG.LogoError(ch === ']' ? 26 : 27);
          e.ln = ln; e.src = src;
          throw e;
        }
        const v = closeFrame(want);
        i++; col++;
        if (ch === '}' && text[i] === '@') {
          const m = /^@([+-]?\d+)/.exec(text.slice(i, i + 24));
          if (m) { v.origin = parseInt(m[1], 10); i += m[0].length; col += m[0].length; }
        }
        continue;
      }
      if (ch === '(' || ch === ')') {
        flush();
        cur().push(pos ? { v: ch, ln, col } : { v: ch });
        i++; col++;
        continue;
      }
      begin();
      buf += ch;
      i++; col++;
    }
    endLine(n);
    return lines;
  }

  /** Read text as one list (PARSE, READLIST): newlines inside count as spaces */
  function readList(text) {
    const lines = read(text.replace(/\n/g, ' '), { positions: false });
    return lines.length ? lines[0].list : NIL;
  }

  const posOf = (p, from, extra) => {
    if (p.ln !== undefined) { from.ln = p.ln; from.col = p.col + (extra || 0); if (p.src !== undefined) from.src = p.src; }
    return from;
  };

  /** Split one unquoted word into its infix pieces: "3+:x" -> 3 + :x */
  function splitWord(w) {
    const out = [];
    let i = 0;
    const n = w.length;
    let afterOp = true; // at the start of a word a - is unary
    while (i < n) {
      const c = w[i];
      if (INFIX_CH.includes(c)) {
        if (c === '-' && afterOp && i + 1 < n) {
          // unary minus; a number right after it becomes a negative number
          const m = /^-(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(w.slice(i));
          const after = m ? w[i + m[0].length] : undefined;
          if (m && (after === undefined || INFIX_CH.includes(after))) { out.push({ v: m[0], off: i }); i += m[0].length; afterOp = false; continue; }
          out.push({ v: UMINUS, off: i }); i++;
          continue;
        }
        let op = c;
        if ((c === '<' && (w[i + 1] === '=' || w[i + 1] === '>')) || (c === '>' && w[i + 1] === '=')) op = c + w[i + 1];
        out.push({ v: op, off: i });
        i += op.length;
        afterOp = true;
        continue;
      }
      let j = i;
      // numbers may contain e+5 / e-5
      while (j < n && !INFIX_CH.includes(w[j])) {
        j++;
        if (j < n && (w[j] === '+' || w[j] === '-') && /[eE]$/.test(w.slice(i, j)) && /^\d+\.?\d*[eE]$|^\.\d+[eE]$/.test(w.slice(i, j))) j++;
      }
      out.push({ v: w.slice(i, j), off: i });
      i = j;
      afterOp = false;
    }
    return out;
  }

  /** RUNPARSE: split infix operators out of the top-level words of a list */
  function runparse(l) {
    const items = [];
    for (let p = l; p instanceof Pair; p = p.r) {
      const w = p.f;
      if (typeof w !== 'string' || w.length === 0 || w[0] === '"' || isNumberWord(w) || w.length === 1 && !INFIX_CH.includes(w)) {
        items.push(posOf(p, { v: w }));
        continue;
      }
      if (!/[-+*/=<>^]/.test(w)) { items.push(posOf(p, { v: w })); continue; }
      if (INFIX.has(w)) { items.push(posOf(p, { v: w })); continue; }
      for (const piece of splitWord(w)) items.push(posOf(p, { v: piece.v }, piece.off));
    }
    let out = NIL;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      const c = new Pair(it.v, out);
      if (it.ln !== undefined) { c.ln = it.ln; c.col = it.col; if (it.src !== undefined) c.src = it.src; }
      out = c;
    }
    return out;
  }

  LG.Reader = { read, readList, runparse, INFIX, splitWord };
})(LG);
