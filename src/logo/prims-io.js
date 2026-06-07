// Text input and output, files, the keyboard and mouse, events, timers and sound.
(function (LG) {
  'use strict';
  const D = LG.Data;
  const { NIL, isList, isWord } = D;
  const LogoError = LG.LogoError;
  const T = (b) => (b ? 'true' : 'false');

  LG.Prims.add('io', (I) => {
    const g = { group: 'io' };
    const def = (n, a, b, c, fn, o) => I.def(n, a, b, c, fn, Object.assign({}, g, o));
    const gdef = (n, a, b, c, fn, o) => def(n, a, b, c, fn, Object.assign({ gen: true }, o));
    const io = () => I.io || {};

    // ---- printing ---------------------------------------------------------------------------
    def('print pr', 0, 1, -1, function (args) { I.print(args.map((a) => D.toText(a, I.printOpts(false))).join(' ') + '\n'); });
    def('type', 0, 1, -1, function (args) { I.print(args.map((a) => D.toText(a, I.printOpts(false))).join('')); });
    def('show', 0, 1, -1, function (args) { I.print(args.map((a) => D.toText(a, I.printOpts(true))).join(' ') + '\n'); });

    // ---- files ------------------------------------------------------------------------------
    I.prefix = '';
    I.files_open = new Map();      // name key -> {name, path, mode, text, pos, out, varName}
    I.reader = null;               // null = keyboard
    I.writer = null;               // null = screen
    I.resolvePath = function (name) {
      let p = String(name);
      if (I.prefix && !p.startsWith('/')) p = I.prefix.replace(/\/$/, '') + '/' + p;
      return I.vfs ? I.vfs.abs(p) : p;
    };
    const fileKey = (v, n) => (isList(v) ? 'list:' + (v.f !== undefined ? D.wordText(v.f) : '') : I.resolvePath(I.word(v, n)).toLowerCase());
    const fsErr = (e, name) => new LogoError(18, { datum: (e && e.message) || name });

    function* ensureLoaded(path) {
      if (I.vfs && I.vfs.exists(path) && !I.vfs.isReady(path)) {
        const r = yield { t: 'async', promise: I.vfs.load(path) };
        if (r && r.err) throw fsErr(r.err, path);
      }
    }
    function* mayWrite(path) {
      if (!I.vfs) throw new LogoError(18, { datum: 'no disk' });
      const w = I.vfs.canWrite(path);
      if (w === 'yes') return true;
      if (w === 'ask' && I.askWrite) {
        const r = yield { t: 'async', promise: I.askWrite(path) };
        if (r && r.ok) return true;
      }
      throw new LogoError(18, { datum: 'Permission denied: ' + path });
    }
    function flushFile(f) {
      if (f.varName) { I.setVar(f.varName, f.out); return; }
      try { I.vfs.writeText(f.path, f.out, { trusted: true }); } catch (e) { throw fsErr(e, f.path); }
    }
    function* open(v, n, mode) {
      const k = fileKey(v, n);
      if (I.files_open.has(k)) throw new LogoError(18, { datum: 'File already open: ' + D.printText(v) });
      // a list names a string to read, or a variable to collect written text in
      if (isList(v)) {
        if (v !== NIL && !isWord(v.f)) throw I.bad(n, v);
        const w = v === NIL ? '' : D.wordText(v.f);
        const f = { name: v, mode, path: null, pos: 0 };
        if (mode === 'read') f.text = w;
        else { f.varName = w.toLowerCase(); f.out = mode === 'append' && I.hasValue(f.varName) ? D.printText(I.getVar(f.varName)) : ''; f.pos = f.out.length; }
        I.files_open.set(k, f);
        return;
      }
      const name = I.word(v, n);
      const path = I.resolvePath(name);
      const f = { name, mode, path, pos: 0 };
      if (mode === 'read' || mode === 'update' || mode === 'append') {
        yield* ensureLoaded(path);
        if (mode === 'read' || I.vfs.exists(path)) {
          try { f.text = I.vfs.readText(path); } catch (e) { if (mode === 'read') throw fsErr(e, name); f.text = ''; }
        } else f.text = '';
      }
      if (mode !== 'read') {
        yield* mayWrite(path);
        f.out = mode === 'write' ? '' : f.text;
        // appending writes after what is there; updating starts at the beginning
        f.pos = mode === 'append' ? f.out.length : 0;
        try { I.vfs.writeText(path, f.out, { trusted: true }); } catch (e) { throw fsErr(e, name); }
      }
      I.files_open.set(k, f);
    }
    gdef('openread', 1, 1, 1, function* ([v], n) { yield* open(v, n, 'read'); });
    gdef('openwrite', 1, 1, 1, function* ([v], n) { yield* open(v, n, 'write'); });
    gdef('openappend', 1, 1, 1, function* ([v], n) { yield* open(v, n, 'append'); });
    gdef('openupdate', 1, 1, 1, function* ([v], n) { yield* open(v, n, 'update'); });
    const closeFile = (k) => {
      const f = I.files_open.get(k);
      if (!f) return false;
      if (f.mode !== 'read') flushFile(f);
      I.files_open.delete(k);
      if (I.reader === f) I.reader = null;
      if (I.writer && I.writer.file === f) I.writer = null;
      return true;
    };
    def('close', 1, 1, 1, function ([v], n) { if (!closeFile(fileKey(v, n))) throw new LogoError(18, { datum: 'File not open: ' + D.printText(v) }); });
    def('closeall', 0, 0, 0, function () { for (const k of [...I.files_open.keys()]) closeFile(k); });
    def('allopen', 0, 0, 0, function () { return D.fromArray([...I.files_open.values()].map((f) => f.name)); });
    const getOpen = (v, n) => {
      const f = I.files_open.get(fileKey(v, n));
      if (!f) throw new LogoError(18, { datum: 'File not open: ' + D.printText(v) });
      return f;
    };
    def('setread', 1, 1, 1, function ([v], n) {
      if (v === NIL) { I.reader = null; return; }
      const f = getOpen(v, n);
      if (f.mode === 'write' || f.mode === 'append') throw new LogoError(18, { datum: 'File not open for reading: ' + D.printText(v) });
      I.reader = f;
    });
    def('setwrite', 1, 1, 1, function ([v], n) {
      if (v === NIL) { I.writer = null; return; }
      const f = getOpen(v, n);
      if (f.mode === 'read') throw new LogoError(18, { datum: 'File not open for writing: ' + D.printText(v) });
      I.writer = {
        file: f,
        write(text) {
          if (f.pos !== undefined && f.pos < f.out.length) { f.out = f.out.slice(0, f.pos) + text + f.out.slice(f.pos + text.length); f.pos += text.length; }
          else { f.out += text; f.pos = f.out.length; }
          if (f.mode === 'update') f.text = f.out;   // reading sees what was just written
          if (!f.varName) flushFile(f);
        },
      };
    });
    def('reader', 0, 0, 0, function () { return I.reader ? I.reader.name : NIL; });
    def('writer', 0, 0, 0, function () { return I.writer ? I.writer.file.name : NIL; });
    def('readpos', 0, 0, 0, function () { if (!I.reader) throw new LogoError(18, { datum: 'Not reading a file' }); return I.reader.pos; });
    def('writepos', 0, 0, 0, function () { if (!I.writer) throw new LogoError(18, { datum: 'Not writing a file' }); return I.writer.file.pos !== undefined ? I.writer.file.pos : I.writer.file.out.length; });
    def('setreadpos', 1, 1, 1, function ([p], n) { if (!I.reader) throw new LogoError(18, { datum: 'Not reading a file' }); I.reader.pos = Math.max(0, Math.min(I.int(p, n), I.reader.text.length)); });
    def('setwritepos', 1, 1, 1, function ([p], n) { if (!I.writer) throw new LogoError(18, { datum: 'Not writing a file' }); I.writer.file.pos = Math.max(0, Math.min(I.int(p, n), I.writer.file.out.length)); });
    def('eofp eof?', 0, 0, 0, function () { if (!I.reader) return T(!(io().keyp && io().keyp())); return T(I.reader.pos >= I.reader.text.length); });
    gdef('filep file?', 1, 1, 1, function* ([v], n) {
      const path = I.resolvePath(I.word(v, n));
      return T(!!I.vfs && I.vfs.exists(path) && I.vfs.stat(path).type === 'file');
    });
    gdef('erasefile erf', 1, 1, 1, function* ([v], n) {
      const path = I.resolvePath(I.word(v, n));
      yield* mayWrite(path);
      try { I.vfs.unlink(path, { trusted: true }); } catch (e) { throw fsErr(e, path); }
    });
    gdef('dribble', 1, 1, 1, function* ([v], n) {
      if (I.dribble) throw new LogoError(17);
      const path = I.resolvePath(I.word(v, n));
      yield* mayWrite(path);
      let text = '';
      I.dribble = (t) => { text += t; try { I.vfs.writeText(path, text, { trusted: true }); } catch (e) { /* ignore */ } };
    });
    def('nodribble', 0, 0, 0, function () { I.dribble = null; });
    def('setprefix', 1, 1, 1, function ([v], n) { I.prefix = v === NIL ? '' : I.word(v, n); });
    def('prefix', 0, 0, 0, function () { return I.prefix ? I.prefix : NIL; });
    // folders (FMSLogo)
    const dirList = (kind) => {
      if (!I.vfs) return NIL;
      return D.fromArray(I.vfs.list(I.prefix || '.').filter((e) => !kind || e.type === kind).map((e) => e.name));
    };
    def('directory', 0, 0, 0, function () { return dirList(null); });
    def('files', 0, 0, 0, function () { return dirList('file'); });
    def('folders directories', 0, 0, 0, function () { return dirList('dir'); });
    I.dirStack = [];
    def('chdir', 1, 1, 1, function ([v], n) {
      try { I.dirStack.push(I.vfs.cwd); I.vfs.chdir(I.resolvePath(I.word(v, n))); } catch (e) { I.dirStack.pop(); throw fsErr(e, D.wordText(v)); }
    });
    def('popdir', 0, 0, 0, function () { if (I.dirStack.length) I.vfs.chdir(I.dirStack.pop()); });
    def('currentdir', 0, 0, 0, function () { return I.vfs ? I.vfs.cwd : '/'; });
    gdef('mkdir', 1, 1, 1, function* ([v], n) {
      const path = I.resolvePath(I.word(v, n));
      yield* mayWrite(path);
      try { I.vfs.mkdir(path, { trusted: true }); } catch (e) { throw fsErr(e, path); }
    });
    gdef('rmdir', 1, 1, 1, function* ([v], n) {
      const path = I.resolvePath(I.word(v, n));
      yield* mayWrite(path);
      try { I.vfs.rmdir(path, { trusted: true }); } catch (e) { throw fsErr(e, path); }
    });

    // ---- reading ----------------------------------------------------------------------------
    /** Next line from the current reader, or null at end of file */
    const fileLine = (f) => {
      if (f.pos >= f.text.length) return null;
      let j = f.text.indexOf('\n', f.pos);
      if (j < 0) j = f.text.length;
      let line = f.text.slice(f.pos, j);
      f.pos = j + 1;
      if (line.endsWith('\r')) line = line.slice(0, -1);
      return line;
    };
    function* readLine(kind, n) {
      if (I.reader) return fileLine(I.reader);
      if (I.inputQueue && I.inputQueue.length) return I.inputQueue.shift();
      const v = yield { t: 'input', kind: 'line', what: kind, node: n };
      return v === null || v === undefined ? null : String(v);
    }
    gdef('readlist rl', 0, 0, 0, function* (args, n) {
      const s = yield* readLine('list', n);
      if (s === null) return '';
      return LG.Reader.readList(s);
    });
    gdef('readword rw', 0, 0, 0, function* (args, n) {
      const s = yield* readLine('word', n);
      return s === null ? NIL : s;
    });
    gdef('readrawline', 0, 0, 0, function* (args, n) {
      const s = yield* readLine('word', n);
      return s === null ? NIL : s;
    });
    function* readChar(n) {
      if (I.reader) {
        const f = I.reader;
        if (f.pos >= f.text.length) return null;
        const c = String.fromCodePoint(f.text.codePointAt(f.pos));
        f.pos += c.length;
        return c;
      }
      const k = io().readKey && io().readKey();
      if (k !== null && k !== undefined) return k;
      return yield { t: 'input', kind: 'char', node: n };
    }
    gdef('readchar rc', 0, 0, 0, function* (args, n) { const c = yield* readChar(n); return c === null ? NIL : c; });
    gdef('readchars rcs', 1, 1, 1, function* ([k], n) {
      const want = I.int(k, n);
      let s = '';
      for (let i = 0; i < want; i++) { const c = yield* readChar(n); if (c === null) break; s += c; }
      return s === '' && I.reader ? NIL : s;
    });
    def('keyp key?', 0, 0, 0, function () {
      if (I.reader) return T(I.reader.pos < I.reader.text.length);
      return T(!!(io().keyp && io().keyp()));
    });

    // ---- the text window ---------------------------------------------------------------------
    def('cleartext ct', 0, 0, 0, function () { if (io().clearText) io().clearText(); });
    def('setcursor', 1, 1, 1, function ([p], n) {
      const a = D.toArray(I.list(p, n)).map((x) => I.int(x, n));
      if (a.length !== 2) throw I.bad(n, p);
      if (io().setCursor) io().setCursor(a[0], a[1]);
    });
    def('cursor', 0, 0, 0, function () { const c = io().cursor ? io().cursor() : [0, 0]; return D.list(c[0], c[1]); });
    def('setmargins', 1, 1, 1, function () { });
    def('settextcolor', 1, 2, 2, function (args) { if (io().setTextColor) io().setTextColor(args[0], args[1]); });
    def('increasefont', 0, 0, 0, function () { if (io().setTextSize) io().setTextSize((io().textSize() || 14) + 2); });
    def('decreasefont', 0, 0, 0, function () { if (io().setTextSize) io().setTextSize(Math.max(8, (io().textSize() || 14) - 2)); });
    def('settextsize', 1, 1, 1, function ([s], n) { const k = I.num(s, n); if (k <= 0) throw I.bad(n, s); if (io().setTextSize) io().setTextSize(k); });
    def('textsize', 0, 0, 0, function () { return io().textSize ? io().textSize() : 14; });
    def('setfont', 1, 1, 1, function ([f], n) { if (io().setFont) io().setFont(I.word(f, n)); });
    def('font', 0, 0, 0, function () { return io().font ? io().font() : 'monospace'; });
    def('textscreen ts', 0, 0, 0, function () { if (io().layout) io().layout('text'); });
    def('fullscreen fs', 0, 0, 0, function () { if (io().layout) io().layout('full'); });
    def('splitscreen ss', 0, 0, 0, function () { if (io().layout) io().layout('split'); });
    def('shell', 1, 1, 2, function ([c]) { throw new LogoError(35, { message: 'SHELL is not available in the browser' }); });

    // ---- mouse --------------------------------------------------------------------------------
    const pt = (p) => D.list(p ? p[0] : 0, p ? p[1] : 0);
    def('mousepos', 0, 0, 0, function () { return pt(io().mousePos && io().mousePos()); });
    def('clickpos', 0, 0, 0, function () { return pt(io().clickPos && io().clickPos()); });
    def('buttonp button?', 0, 0, 0, function () { return T(!!(io().button && io().button())); });
    def('button', 0, 0, 0, function () { return io().button ? io().button() : 0; });

    // ---- events (FMSLogo) ---------------------------------------------------------------------
    I.handlers = { mouse: null, key: null, timers: new Map() };
    def('mouseon', 5, 5, 5, function (args, n) { args.forEach((a) => I.list(a, n)); I.handlers.mouse = { ldown: args[0], lup: args[1], rdown: args[2], rup: args[3], move: args[4] }; });
    def('mouseoff', 0, 0, 0, function () { I.handlers.mouse = null; });
    def('keyboardon', 1, 1, 2, function (args, n) { args.forEach((a) => I.list(a, n)); I.handlers.key = { down: args[0], up: args[1] || NIL }; });
    def('keyboardoff', 0, 0, 0, function () { I.handlers.key = null; });
    def('keyboardvalue', 0, 0, 0, function () { return I.lastKeyValue || 0; });
    def('settimer', 3, 3, 3, function ([id, ms, l], n) {
      const k = I.int(id, n), d = I.int(ms, n);
      I.list(l, n);
      if (d <= 0) throw I.bad(n, ms);
      const old = I.handlers.timers.get(k);
      if (old) clearInterval(old);
      I.handlers.timers.set(k, setInterval(() => { if (I.events.length < 50) I.queueEvent(l); }, d));
    });
    def('cleartimer', 1, 1, 1, function ([id], n) {
      const k = I.int(id, n);
      const t = I.handlers.timers.get(k);
      if (t) { clearInterval(t); I.handlers.timers.delete(k); }
    });
    I.clearHandlers = function () {
      for (const t of I.handlers.timers.values()) clearInterval(t);
      I.handlers.timers.clear();
      I.handlers.mouse = null; I.handlers.key = null;
    };

    // ---- time ---------------------------------------------------------------------------------
    const t0 = Date.now();
    def('time', 0, 0, 0, function () {
      const d = new Date();
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const mons = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const p2 = (x) => String(x).padStart(2, '0');
      return D.list(days[d.getDay()], mons[d.getMonth()], d.getDate(), p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()), d.getFullYear());
    });
    def('timemilli', 0, 0, 0, function () { return Date.now() - t0; });

    // ---- sound --------------------------------------------------------------------------------
    gdef('sound', 1, 1, 1, function* ([l], n) {
      const a = D.toArray(I.list(l, n)).map((x) => I.num(x, n));
      if (a.length % 2) throw I.bad(n, l);
      let total = 0;
      for (let i = 0; i < a.length; i += 2) {
        if (I.audio) I.audio.tone(a[i], a[i + 1], total);
        total += Math.max(0, a[i + 1]);
      }
      if (total > 0) yield { t: 'wait', ms: total };
    });
    gdef('tone', 2, 2, 2, function* ([f, d], n) {
      const hz = I.num(f, n), ms = I.num(d, n);
      if (ms < 0) throw I.bad(n, d);
      if (I.audio) I.audio.tone(hz, ms, 0);
      if (ms > 0) yield { t: 'wait', ms };
    });
  });
})(LG);
