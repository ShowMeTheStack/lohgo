// Workspace management: procedures, variables, burying, tracing, printing out, saving and loading.
(function (LG) {
  'use strict';
  const D = LG.Data;
  const { Pair, NIL, isList, isWord } = D;
  const LogoError = LG.LogoError;
  const T = (b) => (b ? 'true' : 'false');

  LG.Prims.add('workspace', (I) => {
    const g = { group: 'workspace' };
    const def = (n, a, b, c, fn, o) => I.def(n, a, b, c, fn, Object.assign({}, g, o));
    const gdef = (n, a, b, c, fn, o) => def(n, a, b, c, fn, Object.assign({ gen: true }, o));
    const wordOf = (v, n) => I.word(v, n);
    const key = (v, n) => wordOf(v, n).toLowerCase();

    // settings variables Berkeley Logo looks at
    I.globals.set('caseignoredp', 'true');
    I.buried.names.add('caseignoredp');
    I.caseIgnoredp = function () {
      const v = this.globals.get('caseignoredp');
      return v === undefined || D.wordText(v).toLowerCase() !== 'false';
    };
    I.printOpts = function (outer) {
      const gv = (k) => { const v = this.globals.get(k); return v === undefined ? undefined : v; };
      const fp = gv('fullprintp');
      const dl = gv('printdepthlimit'), wl = gv('printwidthlimit');
      return { outer, full: fp !== undefined && D.wordText(fp).toLowerCase() === 'true', depth: dl !== undefined && D.isNumberWord(dl) ? D.num(dl) : -1, width: wl !== undefined && D.isNumberWord(wl) ? D.num(wl) : -1 };
    };

    /** A contents list: a name, a list of procedure names, or [[procs] [names] [plists]] */
    function contents(v, n) {
      if (isWord(v)) return { procs: [key(v, n)], names: [], plists: [] };
      const l = I.list(v, n);
      const items = D.toArray(l);
      if (items.length && items.every(isList)) {
        const part = (i) => (items[i] ? D.toArray(items[i]).map((x) => key(x, n)) : []);
        return { procs: part(0), names: part(1), plists: part(2) };
      }
      return { procs: items.map((x) => key(x, n)), names: [], plists: [] };
    }
    const userProcs = (includeBuried) => [...I.procs.values()].filter((p) => includeBuried || !I.buried.procs.has(p.key));
    const userNames = (includeBuried) => [...I.globals.keys()].filter((k) => I.globals.get(k) !== undefined && (includeBuried || !I.buried.names.has(k)));
    const userPlists = (includeBuried) => [...I.plists.keys()].filter((k) => includeBuried || !I.buried.plists.has(k));
    const nameOf = (k) => { const p = I.procs.get(k); return p ? p.name : k; };
    const triple = (a, b, c) => D.list(D.fromArray(a), D.fromArray(b), D.fromArray(c));

    // ---- defining -------------------------------------------------------------------------------
    function defineFromText(name, text, n, macro) {
      const k = name.toLowerCase();
      if (I.prims.has(k) && !I.redefOk()) throw new LogoError(22, { proc: name });
      const items = D.toArray(I.list(text, n));
      if (!items.length) { I.eraseProc(k); return; }
      const ins = I.list(items[0], n);
      const inputs = { req: [], opt: [], rest: null, def: null };
      for (const it of D.toArray(ins)) {
        if (isWord(it) && D.isNumberWord(it)) inputs.def = I.int(it, n);
        else if (isWord(it)) inputs.req.push(D.wordText(it).replace(/^:/, '').toLowerCase());
        else if (it instanceof Pair) {
          const nm = D.wordText(it.f).replace(/^:/, '').toLowerCase();
          if (it.r === NIL) inputs.rest = nm; else inputs.opt.push({ name: nm, dflt: it.r });
        } else throw I.bad(n, text);
      }
      const lines = items.slice(1).map((l) => ({ list: I.list(l, n), text: D.printText(l) }));
      I.defineProc({ name, inputs, lines, file: null, macro: !!macro });
    }
    def('define', 2, 2, 2, function ([name, text], n) { defineFromText(wordOf(name, n), text, n, false); });
    def('.defmacro', 2, 2, 2, function ([name, text], n) { defineFromText(wordOf(name, n), text, n, true); });
    def('text', 1, 1, 1, function ([name], n) {
      const p = I.procs.get(key(name, n));
      if (!p) { if (I.prims.has(key(name, n))) throw new LogoError(22, { proc: wordOf(name, n) }); throw new LogoError(13, { proc: wordOf(name, n) }); }
      return I.procText(p);
    });
    def('fulltext', 1, 1, 1, function ([name], n) {
      const p = I.procs.get(key(name, n));
      if (!p) throw new LogoError(13, { proc: wordOf(name, n) });
      return D.fromArray(I.procSource(p).split('\n'));
    });
    def('copydef', 2, 2, 2, function ([nw, old], n) {
      const nk = key(nw, n), ok = key(old, n);
      if (I.prims.has(nk) && !I.redefOk()) throw new LogoError(22, { proc: wordOf(nw, n) });
      const p = I.procs.get(ok);
      if (p) { I.defineProc(Object.assign({}, p, { name: wordOf(nw, n), srcText: null, file: null })); return; }
      const prim = I.prims.get(ok);
      if (!prim) throw new LogoError(13, { proc: wordOf(old, n) });
      I.prims.set(nk, prim);
      I.gen++;
    });

    // ---- variables ----------------------------------------------------------------------------
    def('make', 2, 2, 2, function ([name, v], n) { I.setVar(key(name, n), v); });
    def('name', 2, 2, 2, function ([v, name], n) { I.setVar(key(name, n), v); });
    def('local', 1, 1, -1, function (args, n) {
      for (const a of args) for (const nm of isList(a) ? D.toArray(a) : [a]) I.makeLocal(key(nm, n));
    });
    def('localmake', 2, 2, 2, function ([name, v], n) { const k = key(name, n); I.makeLocal(k); I.setVar(k, v); });
    def('thing', 1, 1, 1, function ([name], n) { return I.getVar(key(name, n)); });
    def('global', 1, 1, -1, function (args, n) {
      for (const a of args) for (const nm of isList(a) ? D.toArray(a) : [a]) { const k = key(nm, n); if (!I.globals.has(k)) I.globals.set(k, undefined); }
    });

    // ---- queries ------------------------------------------------------------------------------
    def('procedurep procedure?', 1, 1, 1, function ([w]) { return T(isWord(w) && (I.procs.has(D.wordText(w).toLowerCase()) || I.prims.has(D.wordText(w).toLowerCase()))); });
    def('primitivep primitive?', 1, 1, 1, function ([w]) { return T(isWord(w) && I.prims.has(D.wordText(w).toLowerCase()) && !I.procs.has(D.wordText(w).toLowerCase())); });
    def('definedp defined?', 1, 1, 1, function ([w]) { return T(isWord(w) && I.procs.has(D.wordText(w).toLowerCase())); });
    def('namep name?', 1, 1, 1, function ([w]) { return T(isWord(w) && I.hasValue(D.wordText(w).toLowerCase())); });
    def('plistp plist?', 1, 1, 1, function ([w]) { return T(isWord(w) && I.plists.has(D.wordText(w).toLowerCase())); });
    def('contents', 0, 0, 0, function () { return triple(userProcs().map((p) => p.name), userNames(), userPlists()); });
    def('buried', 0, 0, 0, function () {
      return triple([...I.buried.procs].filter((k) => I.procs.has(k)).map(nameOf), [...I.buried.names].filter((k) => I.globals.has(k)), [...I.buried.plists].filter((k) => I.plists.has(k)));
    });
    def('traced', 0, 0, 0, function () { return triple([...I.traced].map(nameOf), [], []); });
    def('stepped', 0, 0, 0, function () { return triple([...I.stepped].map(nameOf), [], []); });
    def('procedures', 0, 0, 0, function () { return D.fromArray(userProcs().map((p) => p.name)); });
    def('primitives', 0, 0, 0, function () { return D.fromArray([...new Set([...I.prims.values()].map((p) => p.name))].sort()); });
    def('names', 0, 0, 0, function () { return triple([], userNames(), []); });
    def('plists', 0, 0, 0, function () { return triple([], [], userPlists()); });
    def('arity', 1, 1, 1, function ([w], n) {
      const e = I.procTable.get(key(w, n));
      if (!e) throw new LogoError(13, { proc: wordOf(w, n) });
      return D.list(e.min, e.def, e.max);
    });
    def('nodes', 0, 0, 0, function () { return D.list(0, 0); });

    // ---- printing out --------------------------------------------------------------------------
    // numbers are written bare, as Berkeley Logo does: Make "size 5
    const valueText = (v) => (isWord(v) ? (typeof v === 'number' || D.isNumberWord(v) ? D.wordText(v) : '"' + D.wordText(v)) : D.showText(v));
    const poProc = (k) => {
      const p = I.procs.get(k);
      if (!p) { if (I.prims.has(k)) throw new LogoError(22, { proc: k }); throw new LogoError(13, { proc: k }); }
      I.print(I.procSource(p) + '\n');
    };
    const poName = (k) => { if (!I.hasValue(k)) throw new LogoError(11, { datum: k }); I.print('Make "' + k + ' ' + valueText(I.getVar(k)) + '\n'); };
    const poPlist = (k) => {
      const p = I.plists.get(k);
      if (!p) return;
      for (const e of p.values()) I.print('Pprop "' + k + ' "' + e.name + ' ' + valueText(e.value) + '\n');
    };
    def('printout po', 1, 1, 1, function ([c], n) {
      const x = contents(c, n);
      x.procs.forEach(poProc); x.names.forEach(poName); x.plists.forEach(poPlist);
    });
    def('poall', 0, 0, 0, function () { userProcs().forEach((p) => poProc(p.key)); userNames().forEach(poName); userPlists().forEach(poPlist); });
    def('pops', 0, 0, 0, function () { userProcs().forEach((p) => poProc(p.key)); });
    def('pons', 0, 0, 0, function () { userNames().forEach(poName); });
    def('popls', 0, 0, 0, function () { userPlists().forEach(poPlist); });
    def('pon', 1, 1, 1, function ([c], n) { for (const nm of isList(c) ? D.toArray(c) : [c]) poName(key(nm, n)); });
    def('popl', 1, 1, 1, function ([c], n) { for (const nm of isList(c) ? D.toArray(c) : [c]) poPlist(key(nm, n)); });
    const title = (p) => I.procSource(p).split('\n')[0];
    def('pot', 1, 1, 1, function ([c], n) {
      for (const k of contents(c, n).procs) { const p = I.procs.get(k); if (!p) throw new LogoError(13, { proc: k }); I.print(title(p) + '\n'); }
    });
    def('pots', 0, 0, 0, function () { userProcs().forEach((p) => I.print(title(p) + '\n')); });

    // ---- erasing ------------------------------------------------------------------------------
    const erProc = (k) => { if (!I.procs.has(k) && I.prims.has(k)) throw new LogoError(22, { proc: k }); I.eraseProc(k); I.buried.procs.delete(k); };
    def('erase er', 1, 1, 1, function ([c], n) {
      const x = contents(c, n);
      x.procs.forEach(erProc);
      x.names.forEach((k) => { I.globals.delete(k); I.buried.names.delete(k); });
      x.plists.forEach((k) => { I.plists.delete(k); I.buried.plists.delete(k); });
    });
    def('erall', 0, 0, 0, function () {
      userProcs().forEach((p) => erProc(p.key));
      userNames().forEach((k) => I.globals.delete(k));
      userPlists().forEach((k) => I.plists.delete(k));
    });
    def('erps', 0, 0, 0, function () { userProcs().forEach((p) => erProc(p.key)); });
    def('erns', 0, 0, 0, function () { userNames().forEach((k) => I.globals.delete(k)); });
    def('erpls', 0, 0, 0, function () { userPlists().forEach((k) => I.plists.delete(k)); });
    def('ern', 1, 1, 1, function ([c], n) { for (const nm of isList(c) ? D.toArray(c) : [c]) I.globals.delete(key(nm, n)); });
    def('erpl', 1, 1, 1, function ([c], n) { for (const nm of isList(c) ? D.toArray(c) : [c]) I.plists.delete(key(nm, n)); });

    // ---- burying, tracing, stepping -------------------------------------------------------------
    const markAll = (set, c, n, on) => {
      const x = contents(c, n);
      const s = I.buried;
      for (const k of x.procs) (set === 'buried' ? s.procs : set)[on ? 'add' : 'delete'](k);
      if (set === 'buried') {
        for (const k of x.names) s.names[on ? 'add' : 'delete'](k);
        for (const k of x.plists) s.plists[on ? 'add' : 'delete'](k);
      }
      I.emit('workspace');
    };
    def('bury', 1, 1, 1, function ([c], n) { markAll('buried', c, n, true); });
    def('unbury', 1, 1, 1, function ([c], n) { markAll('buried', c, n, false); });
    def('buryall', 0, 0, 0, function () { userProcs().forEach((p) => I.buried.procs.add(p.key)); userNames().forEach((k) => I.buried.names.add(k)); userPlists().forEach((k) => I.buried.plists.add(k)); });
    def('unburyall', 0, 0, 0, function () { I.buried.procs.clear(); I.buried.names.clear(); I.buried.plists.clear(); I.buried.names.add('caseignoredp'); });
    def('buryname', 1, 1, 1, function ([c], n) { for (const nm of isList(c) ? D.toArray(c) : [c]) I.buried.names.add(key(nm, n)); });
    def('unburyname', 1, 1, 1, function ([c], n) { for (const nm of isList(c) ? D.toArray(c) : [c]) I.buried.names.delete(key(nm, n)); });
    def('buriedp buried?', 1, 1, 1, function ([c], n) {
      const x = contents(c, n);
      if (x.procs.length) return T(I.buried.procs.has(x.procs[0]));
      if (x.names.length) return T(I.buried.names.has(x.names[0]));
      return T(x.plists.length > 0 && I.buried.plists.has(x.plists[0]));
    });
    def('trace', 1, 1, 1, function ([c], n) { markAll(I.traced, c, n, true); });
    def('untrace', 1, 1, 1, function ([c], n) { markAll(I.traced, c, n, false); });
    def('tracedp traced?', 1, 1, 1, function ([c], n) { return T(contents(c, n).procs.some((k) => I.traced.has(k))); });
    def('step', 1, 1, 1, function ([c], n) { markAll(I.stepped, c, n, true); });
    def('unstep', 1, 1, 1, function ([c], n) { markAll(I.stepped, c, n, false); });
    def('steppedp stepped?', 1, 1, 1, function ([c], n) { return T(contents(c, n).procs.some((k) => I.stepped.has(k))); });

    // ---- editing --------------------------------------------------------------------------------
    def('edit ed', 0, 1, 1, function (args, n) { I.emit('edit', args.length ? contents(args[0], n) : { procs: [], names: [], plists: [] }); });
    def('edall', 0, 0, 0, function () { I.emit('edit', { procs: userProcs().map((p) => p.key), names: userNames(), plists: userPlists() }); });
    def('edps', 0, 0, 0, function () { I.emit('edit', { procs: userProcs().map((p) => p.key), names: [], plists: [] }); });
    def('edns', 0, 0, 0, function () { I.emit('edit', { procs: [], names: userNames(), plists: [] }); });
    def('edpls', 0, 0, 0, function () { I.emit('edit', { procs: [], names: [], plists: userPlists() }); });
    def('edn', 1, 1, 1, function ([c], n) { I.emit('edit', { procs: [], names: (isList(c) ? D.toArray(c) : [c]).map((x) => key(x, n)), plists: [] }); });
    def('edpl', 1, 1, 1, function ([c], n) { I.emit('edit', { procs: [], names: [], plists: (isList(c) ? D.toArray(c) : [c]).map((x) => key(x, n)) }); });
    def('editfile', 1, 1, 1, function ([f], n) { I.emit('editfile', I.resolvePath(wordOf(f, n))); });
    def('help', 0, 1, 1, function (args, n) { I.emit('help', args.length ? wordOf(args[0], n) : ''); });
    for (const nm of ['seteditor', 'setliblocation setlibloc', 'sethelplocation sethelploc', 'setcslsloc', 'settemploc', '.setsegmentsize']) def(nm, 1, 1, 1, function () { });
    def('gc', 0, 0, 1, function () { });

    // ---- saving and loading --------------------------------------------------------------------
    /** Source text for a workspace selection, as SAVE writes it */
    I.workspaceSource = function (x) {
      const out = [];
      for (const k of x.procs) { const p = I.procs.get(k); if (p) out.push(I.procSource(p), ''); }
      for (const k of x.names) if (I.hasValue(k)) out.push('Make "' + k + ' ' + valueText(I.getVar(k)));
      for (const k of x.plists) { const p = I.plists.get(k); if (p) for (const e of p.values()) out.push('Pprop "' + k + ' "' + e.name + ' ' + valueText(e.value)); }
      return out.join('\n') + '\n';
    };
    const writeSource = (path, text, n) => {
      if (!I.vfs) throw new LogoError(18, { datum: 'no disk' });
      try { I.vfs.writeText(path, text); } catch (e) { throw new LogoError(18, { datum: e.message || path }); }
      I.emit('saved', path);
    };
    def('save', 1, 1, 1, function ([f], n) {
      writeSource(I.resolvePath(wordOf(f, n)), I.workspaceSource({ procs: userProcs().map((p) => p.key), names: userNames(), plists: userPlists() }), n);
    });
    def('savel', 2, 2, 2, function ([c, f], n) { writeSource(I.resolvePath(wordOf(f, n)), I.workspaceSource(contents(c, n)), n); });
    gdef('load', 1, 1, 1, function* ([f], n) {
      const path = I.resolvePath(wordOf(f, n));
      let text;
      try { text = I.vfs.readText(path); } catch (e) { throw new LogoError(18, { datum: e.message || path }); }
      yield* I.loadGen(text, path);
    });
    gdef('cslsload', 1, 1, 1, function* () { });
  });
})(LG);
