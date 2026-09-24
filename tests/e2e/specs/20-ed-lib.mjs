// Shared helpers for the 20- specs (editor, documents, files, sharing).
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/** The highlighted spans of one editor line: [[className, text], ...] (plain text gets '') */
export async function spans(p, line) {
  return p.fn((i) => {
    const l = LG.app.active.editor.hl.children[i];
    if (!l) return null;
    const out = [];
    for (const n of l.childNodes) {
      if (n.nodeType === 3) { if (n.textContent.trim()) out.push(['', n.textContent.trim()]); } else out.push([n.className, n.textContent]);
    }
    return out;
  }, line);
}
/** The class of the first span on a line whose text is exactly `word` */
export async function classOf(p, line, word) {
  const s = await spans(p, line);
  const hit = (s || []).find((x) => x[1] === word);
  return hit ? hit[0] : null;
}
/** Wait for the editor to finish its next render */
export async function rendered(p) {
  await p.ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
}
/** Screen point of a character in the active editor */
export async function point(p, line, col) {
  return p.fn((ln, c) => {
    const e = LG.app.active.editor;
    e.revealLine(ln);
    const r = e.ta.getBoundingClientRect();
    return [r.left + e.padLeft + (c + 0.5) * e.charWidth - e.ta.scrollLeft, r.top + e.padTop + (ln + 0.5) * e.lineHeight - e.ta.scrollTop];
  }, line, col);
}
/** Click into the editor text at a line and column */
export async function clickAt(p, line, col) {
  await p.ev('LG.app.callout.hide()');
  const [x, y] = await point(p, line, col);
  await p.clickAt(x, y);
}
export async function rightClickAt(p, line, col) {
  await p.ev('LG.app.callout.hide()');
  const [x, y] = await point(p, line, col);
  await p.clickAt(x, y, { button: 'right' });
}
/** Screen point of a gutter line number */
export async function gutterPoint(p, line) {
  return p.fn((ln) => {
    const e = LG.app.active.editor;
    e.revealLine(ln);
    const g = e.inner.children[ln].getBoundingClientRect();
    return [g.left + g.width / 2, g.top + g.height / 2];
  }, line);
}
export async function clickGutter(p, line, opts) {
  await p.ev('LG.app.callout.hide()');
  const [x, y] = await gutterPoint(p, line);
  await p.clickAt(x, y, opts);
}
export const cursor = (p) => p.ev('LG.app.active.editor.cursor()');
export const selection = (p) => p.ev('(() => { const t = LG.app.active.editor.ta; return [t.selectionStart, t.selectionEnd, t.value.slice(t.selectionStart, t.selectionEnd)]; })()');
export const setCursor = (p, line, col) => p.fn((l, c) => LG.app.active.editor.setCursor(l, c), line, col);
export const bps = (p, path) => p.fn((pa) => { const m = LG.app.breakpoints.get(pa || LG.app.active.path); return m ? [...m.keys()].sort((a, b) => a - b) : []; }, path || null);
export const gutterBps = (p) => p.ev("[...LG.app.active.editor.inner.children].map((g, i) => g.classList.contains('bp') ? i : -1).filter((i) => i >= 0)");

/** Undo and redo the way the Mac menu does it (Chrome's headless keyboard needs the command name) */
export async function editCommand(p, cmd) {
  const k = { undo: ['z', 'KeyZ', 90, 4], redo: ['z', 'KeyZ', 90, 12], selectAll: ['a', 'KeyA', 65, 4] }[cmd];
  await p.b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k[0], code: k[1], windowsVirtualKeyCode: k[2], modifiers: k[3], commands: [cmd] });
  await p.b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k[0], code: k[1], windowsVirtualKeyCode: k[2], modifiers: k[3] });
  await p.sleep(60);
}

// ---- tabs and documents ---------------------------------------------------------------------------
export const tabs = (p) => p.ev("[...document.querySelectorAll('#editorTabs .etab')].map((t) => ({ name: [...t.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(''), title: t.title, active: t.classList.contains('active'), dirty: !!t.querySelector('.dot'), lock: !!t.querySelector('.lock') }))");
export const tabNames = async (p) => (await tabs(p)).map((t) => t.name);
export const docPaths = (p) => p.ev('LG.app.docs.map((d) => d.path)');
export const disk = (p, path) => p.fn((pa) => { try { return LG.app.vfs.readText(pa); } catch (e) { return null; } }, path);
export const exists = (p, path) => p.fn((pa) => LG.app.vfs.exists(pa), path);
export const tabSel = (path) => `#editorTabs .etab[title="${path}"]`;
/** Close every open document without questions */
export async function closeAll(p) {
  await p.ev('(async () => { for (const d of LG.app.docs.slice()) { d.dirty = false; await LG.app.closeDoc(d); } })()');
  await p.sleep(40);
}
/** Write a file to the disk without opening it */
export async function put(p, path, text) {
  await p.fn((pa, t) => { const v = LG.app.vfs; v.mkdir(pa.replace(/\/[^/]*$/, '') || '/', { parents: true, exist: true, trusted: true }); v.writeText(pa, t, { trusted: true }); }, path, text);
}
export async function rm(p, path) {
  await p.fn((pa) => { const v = LG.app.vfs; if (!v.exists(pa)) return; if (v.isDir(pa)) v.rmdir(pa, { recursive: true, trusted: true }); else v.unlink(pa, { trusted: true }); }, path);
}

// ---- the Files panel --------------------------------------------------------------------------------
export async function openFilesPanel(p) {
  if (await p.ev("document.getElementById('side').classList.contains('closed') || LG.app.side !== 'files'")) {
    await p.click('#railFiles');
    await p.sleep(80);
  }
  await p.wait("!document.getElementById('side').classList.contains('closed') && document.getElementById('sideTitle').textContent === 'Files'");
}
export const row = (path) => `.trow[data-path="${path}"]`;
export async function expand(p, ...dirs) {
  await p.fn((ds) => { for (const d of ds) LG.app.expanded.add(d.toLowerCase()); LG.UI.storage.set('expanded', [...LG.app.expanded]); LG.app.renderSide(); }, dirs);
  await p.sleep(30);
}
export async function refreshTree(p) { await p.ev('LG.app.renderSide()'); await p.sleep(20); }
export async function rowMenu(p, path) {
  await refreshTree(p);
  await p.rightClick(row(path));
  await p.wait("!!document.querySelector('.menu-pop')", 3000);
  return p.ev("[...document.querySelectorAll('.menu-pop .menu-item')].map((e) => ({ label: e.children[0].innerText, disabled: e.classList.contains('disabled') }))");
}
export async function pick(p, label) {
  await p.click('.menu-pop .menu-item', label);
  await p.sleep(120);
}

// ---- stubs ------------------------------------------------------------------------------------------
/** Capture LG.UI.download calls in window.__dl as {name, type, bytes:[...]} */
export async function stubDownload(p) {
  await p.ev(`(() => { window.__dl = []; window.__realDownload = window.__realDownload || LG.UI.download; LG.UI.download = (name, data, type) => { const b = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data)); window.__dl.push({ name, type, bytes: Array.from(b) }); }; })()`);
}
export const downloads = (p) => p.ev('window.__dl || []');
/** Answer the next file picks with these files: [{name, text}] (one list per pick) */
export async function stubPick(p, ...picks) {
  await p.fn((lists) => { window.__picks = lists; window.__realPick = window.__realPick || LG.UI.pickFiles; LG.UI.pickFiles = async () => { const l = window.__picks.shift() || []; return l.map((f) => new File([f.text], f.name)); }; }, picks);
}
/** Capture clipboard writes in window.__clip */
export async function stubClipboard(p, fail) {
  await p.fn((f) => { window.__clip = []; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { if (f) throw new Error('denied'); window.__clip.push(t); } } }); }, !!fail);
}

/** Read a stored (uncompressed) zip: {name: text} */
export function unzip(bytes) {
  const b = Buffer.from(bytes);
  const out = {};
  let off = 0;
  while (off + 4 <= b.length && b.readUInt32LE(off) === 0x04034b50) {
    const size = b.readUInt32LE(off + 18);
    const nlen = b.readUInt16LE(off + 26);
    const xlen = b.readUInt16LE(off + 28);
    const name = b.slice(off + 30, off + 30 + nlen).toString('utf8');
    const start = off + 30 + nlen + xlen;
    out[name] = b.slice(start, start + size).toString('utf8');
    off = start + size;
  }
  // the end record must say how many entries there are
  const eocd = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  out.__count = eocd >= 0 ? b.readUInt16LE(eocd + 10) : -1;
  return out;
}

/** Real files on disk for the browser's file chooser */
export function tempFiles(files) {
  const dir = mkdtempSync(join(tmpdir(), 'lohgo-e2e-'));
  return files.map((f) => { const fp = join(dir, f.name); writeFileSync(fp, f.text); return fp; });
}
/** Feed real files to the file input the page just opened (intercepts the native chooser) */
export async function realPicker(p) { await p.ev('if (window.__realPick) LG.UI.pickFiles = window.__realPick'); }
export async function chooseFiles(p, paths) {
  await p.wait("!!document.querySelector('input[type=file]')", 4000);
  const doc = await p.b.send('DOM.getDocument', { depth: 0 });
  const q = await p.b.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file]' });
  await p.b.send('DOM.setFileInputFiles', { files: paths, nodeId: q.nodeId });
  await p.sleep(250);
}

/** An in-memory folder that looks like a File System Access directory handle */
export async function stubFolder(p, name, files, opts) {
  await p.fn((nm, fl, o) => {
    o = o || {};
    window.__hostWrites = [];
    window.__pickerCalls = [];
    const mkFile = (name, text) => ({
      kind: 'file', name, text,
      async getFile() { const t = this.text; return new File([t], this.name); },
      async createWritable() { const self = this; const parts = []; return { async write(d) { parts.push(d); }, async close() { self.text = new TextDecoder().decode(parts[parts.length - 1]); window.__hostWrites.push(self.name); } }; },
    });
    const mkDir = (name) => ({
      kind: 'directory', name, kids: new Map(),
      async *entries() { for (const [k, v] of this.kids) yield [k, v]; },
      async getDirectoryHandle(n, op) { if (!this.kids.has(n)) { if (!op || !op.create) throw new DOMException('nope', 'NotFoundError'); this.kids.set(n, mkDir(n)); } return this.kids.get(n); },
      async getFileHandle(n, op) { if (!this.kids.has(n)) { if (!op || !op.create) throw new DOMException('nope', 'NotFoundError'); this.kids.set(n, mkFile(n, '')); } return this.kids.get(n); },
      async removeEntry(n) { this.kids.delete(n); window.__hostWrites.push('-' + n); },
    });
    const root = mkDir(nm);
    for (const [path, text] of Object.entries(fl)) {
      const parts = path.split('/');
      let d = root;
      for (const s of parts.slice(0, -1)) { if (!d.kids.has(s)) d.kids.set(s, mkDir(s)); d = d.kids.get(s); }
      d.kids.set(parts[parts.length - 1], mkFile(parts[parts.length - 1], text));
    }
    window.__folder = root;
    window.showDirectoryPicker = async (op) => { window.__pickerCalls.push(op); if (o.cancel) throw new DOMException('cancelled', 'AbortError'); return root; };
  }, name, files, opts || {});
}
/** Text of a file inside the in-memory folder */
export const hostText = (p, path) => p.fn((pa) => { let d = window.__folder; const parts = pa.split('/'); for (const s of parts.slice(0, -1)) d = d && d.kids.get(s); const f = d && d.kids.get(parts[parts.length - 1]); return f ? f.text : null; }, path);

/** Close menus and dialogs the way a person would (Escape), so the app's dialog stack stays right */
export async function tidy(p) {
  await p.closeMenus();
  for (let i = 0; i < 6 && await p.ev('LG.UI.anyModalOpen()'); i++) { await p.key('Escape'); await p.sleep(40); }
  await p.ev('LG.app.callout.hide()');
}
