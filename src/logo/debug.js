// Debugger support: frames, variables and the parts of lists and arrays, as entries the
// IDE can show in a tree and change in place.
(function (LG) {
  'use strict';
  const D = LG.Data;
  const { Pair, NIL, LArray, isList, isWord } = D;

  /** Short text for a value in the variables tree */
  function brief(v, max) {
    max = max || 120;
    if (v === undefined) return '(no value)';
    let s = D.showText(v, { depth: 3, width: 24, budget: 400 });
    if (isWord(v) && typeof v === 'string' && !D.isNumberWord(v)) s = '"' + s;
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }
  function typeOf(v) {
    if (v === undefined) return '';
    if (typeof v === 'number' || (typeof v === 'string' && D.isNumberWord(v))) return 'number';
    if (typeof v === 'string') { const t = v.toLowerCase(); return t === 'true' || t === 'false' ? 'true/false' : 'word'; }
    if (isList(v)) return 'list [' + D.count(v) + ']';
    if (v instanceof LArray) return 'array {' + v.a.length + '}';
    return typeof v;
  }
  function expandable(v) { return (v instanceof Pair) || (v instanceof LArray && v.a.length > 0); }

  /** Make an entry for the tree */
  function entry(name, v, ref, extra) {
    return Object.assign({ name, value: v, text: brief(v), type: typeOf(v), expandable: expandable(v), ref }, extra || {});
  }

  /** Variables visible in a frame: its own inputs and locals, plus FOR / template scopes inside it */
  function frameEntries(I, f) {
    const out = [];
    const seen = new Set();
    const scopes = [];
    for (let s = f.scope; s; s = s.parent) {
      scopes.push(s);
      if (s === f.act) break;
    }
    for (const s of scopes) {
      if (!s.vars) continue;
      for (const [k, v] of s.vars) {
        if (seen.has(k)) continue;
        seen.add(k);
        const isInput = f.act && f.act.proc && s === f.act && procInputs(f.act.proc).includes(k);
        out.push(entry(k, v, { kind: 'var', map: s.vars, key: k }, { param: isInput, loop: s !== f.act }));
      }
    }
    return out;
  }
  function procInputs(p) {
    const i = p.inputs;
    return i.req.concat(i.opt.map((o) => o.name)).concat(i.rest ? [i.rest] : []);
  }
  function globals(I, showBuried) {
    const out = [];
    for (const [k, v] of I.globals) {
      if (v === undefined) continue;
      if (!showBuried && I.buried.names.has(k)) continue;
      out.push(entry(k, v, { kind: 'global', key: k }));
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }
  function plists(I) {
    const out = [];
    for (const [k, m] of I.plists) {
      const props = [];
      for (const [pk, e] of m) props.push(entry(e.name, e.value, { kind: 'prop', map: m, key: pk }));
      out.push({ name: k, value: null, text: m.size + (m.size === 1 ? ' property' : ' properties'), type: 'plist', expandable: m.size > 0, isGroup: true, kids: props, ref: null });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Children of an entry: [items] and the total count, for paging */
  function children(e, start, count) {
    start = start || 0; count = count || 100;
    if (e.kids) return { items: e.kids.slice(start, start + count), total: e.kids.length };
    const v = e.value;
    if (v instanceof LArray) {
      const items = [];
      for (let i = start; i < Math.min(v.a.length, start + count); i++) items.push(entry(String(i + v.origin), v.a[i], { kind: 'array', arr: v, index: i }));
      return { items, total: v.a.length };
    }
    if (v instanceof Pair) {
      const items = [];
      let i = 0, total = 0;
      for (let p = v; p instanceof Pair; p = p.r, i++) {
        total++;
        if (i >= start && items.length < count) items.push(entry(String(i + 1), p.f, { kind: 'item', parent: e, index: i }));
        if (total > 1000000) break;
      }
      return { items, total };
    }
    return { items: [], total: 0 };
  }

  /** Read the text a person typed as a Logo value: 42, "word, word, [a list], {an array} */
  function parseValue(text) {
    const t = String(text).trim();
    if (!t) throw new Error('Type a value: a number, a "word, a [list] or an {array}');
    if (t[0] === '"' && !/\s/.test(t)) return t.slice(1);
    if (t[0] === '"' && /\s/.test(t.replace(/\|[^|]*\|/g, ''))) throw new Error('A quoted word cannot have spaces in it. Use a list like [a b] or bars like "|a b|');
    // brackets must balance: [1 2 is a mistake, not a list
    let sq = 0, cu = 0, bar = false;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (bar) { if (ch === '|') bar = false; continue; }
      if (ch === '|') { bar = true; continue; }
      if (ch === '\\') { i++; continue; }
      if (ch === '[') sq++; else if (ch === ']') sq--; else if (ch === '{') cu++; else if (ch === '}') cu--;
      if (sq < 0 || cu < 0) break;
    }
    if (sq !== 0) throw new Error(sq > 0 ? 'A [ is missing its ]' : 'A ] has no [ before it');
    if (cu !== 0) throw new Error(cu > 0 ? 'A { is missing its }' : 'A } has no { before it');
    const l = LG.Reader.readList(t);
    const items = D.toArray(l);
    if (items.length === 1) {
      const x = items[0];
      if (typeof x === 'string' && D.isNumberWord(x)) { const n = parseFloat(x); return D.formatNumber(n) === x ? n : x; }
      if (typeof x === 'string' && x[0] === '"') return x.slice(1);
      return x;
    }
    return l;
  }

  /** Put a new value where an entry points. Lists are rebuilt along the path so shared lists are not disturbed. */
  function assign(I, e, text) {
    const v = typeof text === 'string' ? parseValue(text) : text;
    setRef(I, e, v);
    return v;
  }
  function setRef(I, e, v) {
    const r = e.ref;
    if (!r) throw new Error('This value cannot be changed');
    switch (r.kind) {
      case 'var': r.map.set(r.key, v); return;
      case 'global': I.globals.set(r.key, v); return;
      case 'prop': { const old = r.map.get(r.key); r.map.set(r.key, { name: old ? old.name : r.key, value: v }); return; }
      case 'array': r.arr.a[r.index] = v; return;
      case 'item': {
        // copy the parent list with one element replaced, then store that list where the parent came from
        const parent = r.parent;
        const arr = D.toArray(parent.value);
        arr[r.index] = v;
        const nl = D.fromArray(arr);
        setRef(I, parent, nl);
        parent.value = nl;
        return;
      }
    }
    throw new Error('This value cannot be changed');
  }

  /** Frames for the Call Stack panel, outermost first */
  function frames(I) {
    return I.frames().map((f, i) => {
      const p = f.proc;
      const args = f.act && f.act.args ? f.act.args : [];
      return {
        index: i,
        title: p ? p.name + (args.length ? ' ' + args.map((a) => brief(a, 24)).join(' ') : '') : (f.handler ? 'event handler' : 'top level'),
        proc: p, act: f.act, scope: f.scope, node: f.node,
        file: f.node && f.node.src !== undefined ? I.filePath(f.node.src) : (p ? p.file : null),
        line: f.node ? f.node.ln : undefined,
        f,
      };
    });
  }

  /** Value of :name as seen from a frame (dynamic scope) */
  function lookup(I, name, scope) {
    const k = String(name).toLowerCase();
    const h = I.holder(k, scope);
    if (h) return { value: h.vars.get(k), ref: { kind: 'var', map: h.vars, key: k } };
    if (I.globals.has(k)) return { value: I.globals.get(k), ref: { kind: 'global', key: k } };
    return null;
  }

  LG.Debug = { brief, typeOf, entry, frameEntries, globals, plists, children, parseValue, assign, frames, lookup, procInputs };
})(LG);
