// Syntax colouring for the editor and the command center. Brackets are coloured by depth so
// that nested lists are easy to follow.
(function (LG) {
  'use strict';
  const esc = LG.escapeHtml;
  const INFIX = '+-*/=<>^';
  let PRIMS = null;
  let USER = new Set();

  const L = LG.LogoLang = {
    /** Primitive names (lower case), filled in by the IDE from an interpreter */
    setPrimitives(names) { PRIMS = new Set(names); },
    setUserProcs(names) { USER = new Set(names); },
    isPrimitive(w) { return !!PRIMS && PRIMS.has(String(w).toLowerCase()); },

    /** One line of Logo -> HTML. depth: bracket depth at the start of the line (for lists spanning lines) */
    highlightLine(text, depth) {
      if (!text) return '';
      let out = '';
      let i = 0;
      const n = text.length;
      let d = depth || 0;
      let first = true;
      while (i < n) {
        const c = text[i];
        if (c === ';') { out += '<span class="s-com">' + esc(text.slice(i)) + '</span>'; break; }
        if (c === ' ' || c === '\t') { let j = i; while (j < n && (text[j] === ' ' || text[j] === '\t')) j++; out += text.slice(i, j); i = j; continue; }
        if (c === '[' || c === ']' || c === '{' || c === '}') {
          if (c === ']' || c === '}') d = Math.max(0, d - 1);
          out += '<span class="s-br s-br' + (d % 4) + '">' + c + '</span>';
          if (c === '[' || c === '{') d++;
          i++;
          if (c === '}' && text[i] === '@') { let j = i + 1; while (j < n && /[-\d]/.test(text[j])) j++; out += '<span class="s-num">' + esc(text.slice(i, j)) + '</span>'; i = j; }
          continue;
        }
        if (c === '(' || c === ')') { out += '<span class="s-paren">' + c + '</span>'; i++; continue; }
        // a word runs to the next delimiter; vertical bars and backslashes quote characters
        let j = i, bar = false;
        while (j < n) {
          const ch = text[j];
          if (bar) { if (ch === '|') bar = false; j++; continue; }
          if (ch === '|') { bar = true; j++; continue; }
          if (ch === '\\') { j += 2; continue; }
          if (' \t[]{}();'.includes(ch)) break;
          j++;
        }
        const w = text.slice(i, j);
        out += L.wordHtml(w, d, first);
        first = false;
        i = j;
      }
      return out;
    },
    wordHtml(w, depth, first) {
      const lw = w.toLowerCase();
      if (first && depth === 0 && (lw === 'to' || lw === 'end' || lw === '.macro')) return '<span class="s-kw">' + esc(w) + '</span>';
      if (w[0] === '"') return '<span class="s-str">' + esc(w) + '</span>';
      if (w[0] === ':' && w.length > 1) return L.splitInfix(w, 's-var');
      if (LG.Data.isNumberWord(w)) return '<span class="s-num">' + esc(w) + '</span>';
      if (depth > 0) {
        // inside a list: words are data until the list is run, but colour likely code anyway
        if (PRIMS && PRIMS.has(lw)) return '<span class="s-prim">' + esc(w) + '</span>';
        if (USER.has(lw)) return '<span class="s-proc">' + esc(w) + '</span>';
        return L.splitInfix(w, '');
      }
      if (PRIMS && PRIMS.has(lw)) return '<span class="s-prim">' + esc(w) + '</span>';
      if (USER.has(lw)) return '<span class="s-proc">' + esc(w) + '</span>';
      return L.splitInfix(w, '');
    },
    /** Colour infix operators inside a word such as :x+1 */
    splitInfix(w, cls) {
      if (!cls && (w === '<=' || w === '>=' || w === '<>')) return '<span class="s-op">' + esc(w) + '</span>';
      if (!/[-+*/=<>^]/.test(w.slice(1)) || w.length < 2) return cls ? '<span class="' + cls + '">' + esc(w) + '</span>' : L.plain(w);
      let out = '';
      let buf = '';
      const flush = () => { if (!buf) return; out += LG.Data.isNumberWord(buf) ? '<span class="s-num">' + esc(buf) + '</span>' : buf[0] === ':' ? '<span class="s-var">' + esc(buf) + '</span>' : L.plain(buf); buf = ''; };
      for (let i = 0; i < w.length; i++) {
        const ch = w[i];
        if (INFIX.includes(ch) && i > 0) { flush(); out += '<span class="s-op">' + esc(ch) + '</span>'; } else buf += ch;
      }
      flush();
      return out;
    },
    plain(w) {
      const lw = w.toLowerCase();
      if (PRIMS && PRIMS.has(lw)) return '<span class="s-prim">' + esc(w) + '</span>';
      if (USER.has(lw)) return '<span class="s-proc">' + esc(w) + '</span>';
      if (w.length === 1 && INFIX.includes(w) || w === '<=' || w === '>=' || w === '<>') return '<span class="s-op">' + esc(w) + '</span>';
      return esc(w);
    },
    /** Bracket depth at the end of a line, given the depth at its start */
    depthAfter(text, depth) {
      let d = depth || 0, bar = false;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (bar) { if (c === '|') bar = false; continue; }
        if (c === '|') { bar = true; continue; }
        if (c === '\\') { i++; continue; }
        if (c === ';') break;
        if (c === '[' || c === '{') d++;
        else if (c === ']' || c === '}') d = Math.max(0, d - 1);
      }
      return d;
    },
    /** The word under a column: {word, kind: 'var'|'quoted'|'proc'|'num', start, end} */
    wordAt(text, col) {
      if (!text) return null;
      const isDelim = (c) => ' \t[](){};'.includes(c);
      let s = col, e = col;
      while (s > 0 && !isDelim(text[s - 1])) s--;
      while (e < text.length && !isDelim(text[e])) e++;
      if (s >= e) return null;
      let w = text.slice(s, e);
      // :x+1 -> the part under the cursor
      const parts = LG.Reader.splitWord(w);
      let off = 0;
      for (const p of parts) {
        const pv = typeof p.v === 'string' ? p.v : '';
        const ps = s + p.off, pe = ps + (pv.length || 1);
        if (col >= ps && col <= pe && pv && !LG.Reader.INFIX.has(pv)) { w = pv; s = ps; e = pe; break; }
        off++;
      }
      void off;
      if (w[0] === ':') return { word: w.slice(1), kind: 'var', start: s, end: e };
      if (w[0] === '"') return { word: w.slice(1), kind: 'quoted', start: s, end: e };
      if (LG.Data.isNumberWord(w)) return { word: w, kind: 'num', start: s, end: e };
      return { word: w, kind: 'proc', start: s, end: e };
    },
    /** Indent the line after a TO line */
    indentAfter(text) { return /^\s*(to|\.macro)\s/i.test(text); },
  };
})(LG);
