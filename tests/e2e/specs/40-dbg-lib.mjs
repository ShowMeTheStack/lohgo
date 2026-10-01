// Shared helpers for the debugger specs (40-*). They drive the editor gutter, the inspector
// panes and the hover callout with real mouse and keyboard input.

export const PATH = '/projects/e2e.lgo';

/** Put the program back into a known state between tests */
export async function reset(p) {
  await p.closeModals();
  await p.closeMenus();
  await p.ev(`(() => {
    const a = LG.app;
    if (LG.Tours && LG.Tours.active) LG.Tours.stop();
    if (a.interp.state !== 'idle') a.stop();
    if (a.interp.clearHandlers) a.interp.clearHandlers();
    a.interp.traced.clear(); a.interp.stepped.clear();
    a.clearBreakpoints();
    a.inspector.watches = []; a.inspector.saveWatches();
    a.inspector.filter.value = '';
    a.callout.hide();
    a.commander.clear();
    for (const st of [a.inspector.tree.state, a.callout.state]) { st.expanded.clear(); st.pages.clear(); st.prev.clear(); if (st.seen) st.seen.clear(); }
    a.selFrame = null;
    a.inspector.show('vars');
  })()`);
  await p.sleep(30);
}

/** Open a program in the editor without running it */
export async function load(p, text, path = PATH) {
  await p.newFile(path, text);
  await p.sleep(40);
}

/** Pixel position of the middle of a line in the gutter of the active editor */
export async function gutterPoint(p, line) {
  return p.fn((line) => {
    const e = LG.app.active.editor;
    e.revealLine(line);
    const gr = e.gutter.getBoundingClientRect();
    const mr = e.main.getBoundingClientRect();
    const padTop = parseFloat(getComputedStyle(e.ta).paddingTop) || 0;
    return [gr.left + gr.width / 2, mr.top + padTop + (line + 0.5) * e.lineHeight - e.ta.scrollTop];
  }, line);
}

/** Click the gutter next to a line (0-based) */
export async function gutterClick(p, line) {
  const [x, y] = await gutterPoint(p, line);
  await p.clickAt(x, y);
  await p.sleep(40);
}

/** Right-click the gutter next to a line and wait for the menu */
export async function gutterMenu(p, line) {
  const [x, y] = await gutterPoint(p, line);
  await p.clickAt(x, y, { button: 'right' });
  await p.wait("!!document.querySelector('.menu-pop')", 3000);
  return p.ev("[...document.querySelectorAll('.menu-pop .menu-item')].map(e => e.children[0].innerText)");
}

/** Pixel position of a character in the active editor (0-based line and column) */
export async function charPoint(p, line, col) {
  return p.fn((line, col) => {
    const e = LG.app.active.editor;
    e.revealLine(line);
    const r = e.ta.getBoundingClientRect();
    const cs = getComputedStyle(e.ta);
    const padLeft = parseFloat(cs.paddingLeft) || 0, padTop = parseFloat(cs.paddingTop) || 0;
    return [r.left + padLeft + (col + 0.5) * e.charWidth - e.ta.scrollLeft, r.top + padTop + (line + 0.5) * e.lineHeight - e.ta.scrollTop];
  }, line, col);
}

/** Where a word starts in a line of the active editor */
export async function colOf(p, line, word, nth = 0) {
  return p.fn((line, word, nth) => {
    const t = LG.app.active.editor.getLine(line);
    let i = -1;
    for (let k = 0; k <= nth; k++) i = t.indexOf(word, i + 1);
    return i;
  }, line, word, nth);
}

/** Rest the mouse on a word and wait for the callout */
export async function hoverWord(p, line, word, opts = {}) {
  const col = await colOf(p, line, word, opts.nth || 0);
  if (col < 0) throw new Error('word not on line: ' + word);
  const [x, y] = await charPoint(p, line, col + (opts.offset === undefined ? 1 : opts.offset));
  await p.mouse('mouseMoved', x - 3, y);
  await p.sleep(20);
  await p.mouse('mouseMoved', x, y);
  if (opts.expect === false) { await p.sleep(500); return [x, y]; }
  await p.wait("!!document.querySelector('.callout')", 3000);
  await p.sleep(40);
  return [x, y];
}

/** Breakpoints of a file as [[line, cond, disabled]] (0-based lines) */
export async function bps(p, path = PATH) {
  return p.fn((path) => [...(LG.app.breakpoints.get(path) || new Map())].map(([l, b]) => [l, b.cond || '', !!b.disabled]).sort((a, b) => a[0] - b[0]), path);
}

/** Gutter line classes of the active editor, after the next frame */
export async function gutterClasses(p) {
  await p.sleep(40);
  return p.ev("[...LG.app.active.editor.inner.querySelectorAll('.ed-gl')].map(e => e.className.replace('ed-gl', '').trim())");
}

/** 0-based index of the editor line marked with a class (exec, frame, errline, bpline), or -1 */
export async function markedLine(p, cls) {
  await p.sleep(40);
  return p.ev(`[...LG.app.active.editor.hl.querySelectorAll('.ed-line')].findIndex(e => e.classList.contains(${JSON.stringify(cls)}))`);
}
export async function waitMarked(p, cls, line) {
  return p.wait(`[...LG.app.active.editor.hl.querySelectorAll('.ed-line')].findIndex(e => e.classList.contains(${JSON.stringify(cls)})) === ${line}`, 4000);
}

/** The interpreter line (1-based) of the newest frame */
export async function pausedLine(p) {
  return p.ev('(() => { const f = LG.Debug.frames(LG.app.interp); const t = f[f.length - 1]; return t ? t.line : null; })()');
}
export async function topTitle(p) {
  return p.ev('(() => { const f = LG.Debug.frames(LG.app.interp); const t = f[f.length - 1]; return t ? t.title : null; })()');
}

/** Rows of the Call Stack pane: [{lvl, title, where, sel}] */
export async function stackRows(p) {
  await p.inspector('stack');
  return p.ev("[...document.querySelectorAll('#ipane-stack .frame-row')].map(r => ({ id: r.id, lvl: r.querySelector('.lvl').innerText, title: r.querySelector('.t').innerText, where: r.querySelector('.where').innerText, sel: r.classList.contains('sel') }))");
}

/** Rows of the Variables pane: [{name, type, value, input, loop, changed, editable, key}] */
export async function varRows(p) {
  return p.ev(`[...document.querySelectorAll('#ipane-vars .vrow:not(.pager)')].map(r => {
    const n = r.querySelector('.vn'); const v = r.querySelector('.vv');
    return { name: n.querySelector('span:not(.twisty):not(.vbadge)').innerText, type: r.querySelector('.vt').innerText, value: v.innerText,
      input: !!n.querySelector('.vbadge:not(.loop)'), loop: !!n.querySelector('.vbadge.loop'), changed: v.classList.contains('changed'), editable: v.classList.contains('editable'), key: r.dataset.key };
  })`);
}
export async function varRow(p, name, section) {
  const rows = await varRows(p);
  return rows.find((r) => r.name === name && (!section || r.key.startsWith(section))) || null;
}
/** Section headings of the Variables pane */
export async function varSections(p) {
  return p.ev("[...document.querySelectorAll('#ipane-vars .vsec')].map(e => e.innerText)");
}

/** Selector for the value cell of a variable row by its tree key */
export function cellSel(key, pane = '#ipane-vars') {
  return `${pane} .vrow[data-key="${key.replace(/"/g, '\\"')}"] .vv`;
}
export function twistySel(key, pane = '#ipane-vars') {
  return `${pane} .vrow[data-key="${key.replace(/"/g, '\\"')}"] .twisty`;
}

/** Click a value, type a new one and finish with a key (Enter, Escape) or 'blur' */
export async function editCell(p, sel, text, how = 'Enter') {
  await p.click(sel);
  await p.wait(`!!document.querySelector(${JSON.stringify(sel + ' input')})`, 2000);
  await p.ev(`(() => { const i = document.querySelector(${JSON.stringify(sel + ' input')}); i.select(); })()`);
  await p.insertText(text);
  if (how === 'blur') {
    await p.click('#inspTabs');
  } else {
    await p.key(how);
  }
  await p.sleep(80);
}

/** Wait until the program pauses, and return the pause line */
export async function untilPaused(p, ms = 8000) {
  await p.waitState('paused', ms);
  await p.sleep(60);
  return pausedLine(p);
}

/** Start the program in the editor with F5 (from the editor) */
export async function f5(p) {
  await p.ev('LG.app.active.editor.focus()');
  await p.key('F5');
}

export async function watchRows(p) {
  return p.ev("[...document.querySelectorAll('#ipane-watch .list-row')].map(r => ({ expr: r.children[0].innerText, value: r.children[1].innerText, mode: r.querySelector('select').value }))");
}

/** Press a key (F11, F10...) while paused or idle, wait for the program to settle, return the pause line or null */
export async function stepKey(p, key, mods = {}) {
  const before = await p.ev('LG.app.interp.steps');
  await p.key(key, mods);
  await p.wait(`LG.app.interp.steps !== ${before} || LG.app.interp.state === 'idle'`, 4000).catch(() => {});
  await p.waitState(['paused', 'idle', 'error']);
  await p.sleep(30);
  return (await p.state()) === 'paused' ? pausedLine(p) : null;
}
/** Value of a variable as the newest frame sees it, as text */
export async function seen(p, name) {
  return p.fn((name) => { const f = LG.Debug.frames(LG.app.interp); const t = f[f.length - 1]; const r = LG.Debug.lookup(LG.app.interp, name, t ? t.scope : null); return r ? LG.Debug.brief(r.value) : null; }, name);
}

/** Pixel position of a point inside a code line (0-based), a little way into the text */
export async function linePoint(p, line, dx = 20) {
  return p.fn((line, dx) => {
    const e = LG.app.active.editor;
    const r = e.ta.getBoundingClientRect();
    const cs = getComputedStyle(e.ta);
    return [r.left + (parseFloat(cs.paddingLeft) || 0) + dx, r.top + (parseFloat(cs.paddingTop) || 0) + (line + 0.5) * e.lineHeight - e.ta.scrollTop];
  }, line, dx);
}
