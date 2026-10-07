// Shared helpers for the tours, lessons and reference specs (60-*). The lesson, tour and help
// data are read straight from src/ so every step and entry gets its own test.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'src');

function load(files, LG) {
  const ctx = vm.createContext({ LG, console });
  for (const f of files) vm.runInContext(readFileSync(f, 'utf8'), ctx, { filename: f });
  return LG;
}

// plain data is copied out of the sandbox so arrays compare equal with assert.deepEqual
const plain = (x) => JSON.parse(JSON.stringify(x));
export const LESSONS = plain(load(['part1.js', 'part2.js'].map((f) => join(SRC, 'ide', 'lessons', f)), {}).LESSONS);
export const TOURS = load([join(SRC, 'ide', 'tour.js')], { UI: { h() {} }, escapeHtml: (s) => s }).Tours.TOURS;
const helpDir = join(SRC, 'logo', 'help');
export const HELP = plain(load(readdirSync(helpDir).filter((f) => f.endsWith('.js')).sort().map((f) => join(helpDir, f)), {}).HELP_ENTRIES);

const ENT = { '&gt;': '>', '&lt;': '<', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
export const decode = (s) => s.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, (m) => ENT[m] || m);

/** The code snippets (<code> and <pre>) in a piece of lesson HTML, in order */
export function snippets(html) {
  const out = [];
  if (!html) return out;
  const re = /<code>([\s\S]*?)<\/code>|<pre>([\s\S]*?)<\/pre>/g;
  let m;
  while ((m = re.exec(html))) out.push(decode(m[1] !== undefined ? m[1] : m[2]));
  return out;
}
/** A hint written as plain Logo (no prose) counts as a snippet too */
export function hintSnippets(hint) {
  if (!hint) return [];
  const s = snippets(hint);
  if (s.length) return s;
  if (/[.!?:]\s*$/.test(hint.trim()) || /\b(the|and|then|with|Click|Put|Press)\b/.test(hint)) return [];
  return [decode(hint)];
}

export function defaultWaitText(c) {
  if (c.run) return 'Waiting for you to run the program (F5)…';
  if (c.command) return 'Waiting for your command…';
  if (c.codeHas) return 'Waiting for your change to the program…';
  if (c.output) return 'Waiting for the right output…';
  if (c.drawn) return 'Waiting for the turtle to draw…';
  if (c.defined) return 'Waiting for ' + c.defined.toUpperCase() + ' to be defined…';
  if (c.paused) return 'Waiting for the program to pause…';
  if (c.breakpoint) return 'Waiting for a breakpoint…';
  if (c.variable) return 'Waiting for :' + c.variable + '…';
  return '';
}

// ---- reading the tour popup ---------------------------------------------------------------------
export function popup(p) {
  return p.ev(`(() => {
    const pop = document.querySelector('.tour-pop');
    if (!pop) return null;
    const q = (s) => pop.querySelector(s);
    const t = (s) => (q(s) || {}).textContent || '';
    const st = LG.Tours.active;
    return {
      step: t('.step'), title: t('h3'), txt: t('.txt:not(.muted)'), wait: t('.wait'), done: !!q('.wait.done'),
      next: t('#tourNext'), nextDisabled: q('#tourNext') ? q('#tourNext').disabled : null,
      backDisabled: q('#tourBack') ? q('#tourBack').disabled : null,
      i: st ? st.i : -1, tour: st ? st.tour.title : null, label: st ? (st.tour.label || st.tour.title) : null,
      quiz: [...pop.querySelectorAll('.txt + div > button')].map((b) => b.textContent),
      hint: !!q('.txt.muted'),
    };
  })()`);
}
/** The text a browser shows for some HTML */
export const htmlText = (p, html) => p.fn((x) => { const d = document.createElement('div'); d.innerHTML = x; return d.textContent; }, html);

/** The spotlight must sit over the element the step points at (with 5px padding), or be a dot in the middle */
export async function spotCheck(p, sel) {
  await p.sleep(320);
  const r = await p.fn((sel) => {
    const spot = document.querySelector('.tour-spot');
    if (!spot) return { err: 'no spotlight' };
    const s = spot.getBoundingClientRect();
    const el = sel ? [...document.querySelectorAll(sel)].find((x) => { const b = x.getBoundingClientRect(); return b.width > 0 && b.height > 0; }) : null;
    const pop = document.querySelector('.tour-pop').getBoundingClientRect();
    const out = { s: [s.left, s.top, s.width, s.height], pop: [pop.left, pop.top, pop.right, pop.bottom], W: innerWidth, H: innerHeight };
    if (el) { const b = el.getBoundingClientRect(); out.e = [b.left - 5, b.top - 5, b.width + 10, b.height + 10]; }
    return out;
  }, sel || null);
  if (r.err) throw new Error(r.err);
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 2);
  if (r.e) { if (!near(r.s, r.e)) throw new Error(`spotlight ${JSON.stringify(r.s)} is not over ${sel} ${JSON.stringify(r.e)}`); }
  else if (!(r.s[2] === 0 && r.s[3] === 0)) throw new Error(`step without a target should have no spotlight hole, got ${JSON.stringify(r.s)}`);
  // the popup stays on screen
  if (r.pop[0] < 0 || r.pop[1] < 0 || r.pop[2] > r.W + 1 || r.pop[3] > r.H + 1) throw new Error('popup off screen ' + JSON.stringify(r.pop));
  return r;
}

// ---- driving the IDE like a learner ---------------------------------------------------------------
/** Type a line into the command center and press Enter, then let it finish */
export async function cmd(p, text, opts = {}) {
  await p.click('#cmdInput');
  const ok = await p.ev("document.activeElement === document.getElementById('cmdInput')");
  if (!ok) await p.ev("document.getElementById('cmdInput').focus()");
  await p.ev("(() => { const t = document.getElementById('cmdInput'); t.select(); })()");
  await p.insertText(text);
  await p.key('Enter');
  if (opts.wait !== false) await settle(p, opts);
}

/** Wait until nothing runs; answer READLIST/READWORD questions from opts.answers on the way */
export async function settle(p, opts = {}) {
  const answers = (opts.answers || []).slice();
  const t0 = Date.now();
  const limit = opts.timeout || 45000;
  await p.sleep(60);
  while (Date.now() - t0 < limit) {
    const s = await p.ev('[LG.app.interp.state, !!LG.app.commander.reading]');
    if (['idle', 'error', 'paused'].includes(s[0])) return s[0];
    if (opts.until && await p.ev(opts.until)) return s[0];
    if (s[0] === 'input' && s[1]) {
      const a = answers.length ? answers.shift() : (opts.answer || 'Ada');
      await p.click('#cmdInput');
      await p.insertText(String(a));
      await p.key('Enter');
    }
    await p.sleep(80);
  }
  throw new Error('program still running after ' + limit + 'ms');
}

/** Press F5 (the learner's way of running the program in the editor) and let it run */
export async function runF5(p, opts = {}) {
  await p.key('F5');
  if (opts.wait !== false) return settle(p, opts);
}

/** Select a range of the editor text and type over it */
async function editAt(p, start, end, text) {
  await p.fn((s, e) => { const ed = LG.app.active.editor; ed.ta.focus(); ed.ta.setSelectionRange(s, e); }, start, end);
  await p.insertText(text);
  await p.sleep(60);
}
export async function editReplace(p, from, to) {
  const v = await p.code();
  const i = v.indexOf(from);
  if (i < 0) throw new Error(`the program has no ${JSON.stringify(from)} to change`);
  await editAt(p, i, i + from.length, to);
}
export async function editAppend(p, text) {
  const v = await p.code();
  await editAt(p, v.length, v.length, (v.endsWith('\n') || !v ? '' : '\n') + text + '\n');
}
export async function editInsertBefore(p, anchor, text) {
  const v = await p.code();
  const i = v.indexOf(anchor);
  if (i < 0) throw new Error(`the program has no ${JSON.stringify(anchor)}`);
  await editAt(p, i, i, text);
}

/** Click the editor gutter next to a 0-based line */
export async function gutterClick(p, line) {
  const [x, y] = await p.fn((line) => {
    const e = LG.app.active.editor;
    e.revealLine(line);
    const gr = e.gutter.getBoundingClientRect();
    const mr = e.main.getBoundingClientRect();
    return [gr.left + gr.width / 2, mr.top + e.padTop + (line + 0.5) * e.lineHeight - e.ta.scrollTop];
  }, line);
  await p.clickAt(x, y);
}

/** Screen point of a character in the active editor */
export async function charPoint(p, line, col) {
  return p.fn((line, col) => {
    const e = LG.app.active.editor;
    e.revealLine(line);
    const r = e.ta.getBoundingClientRect();
    return [r.left + e.padLeft + (col + 0.5) * e.charWidth - e.ta.scrollLeft, r.top + e.padTop + (line + 0.5) * e.lineHeight - e.ta.scrollTop];
  }, line, col);
}

export async function clickWorld(p, dx = 0, dy = 0) {
  const r = await p.rect('#worldCanvas');
  await p.clickAt(r.x + r.w / 2 + dx, r.y + r.h / 2 + dy);
}

/** Pixel checksum of the turtle world as shown */
export function worldSum(p) {
  return p.ev(`(() => { const c = document.getElementById('worldCanvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 7) s = (s * 31 + d[i]) >>> 0; return s; })()`);
}

/** Click the visible element whose text is exactly `text` */
export async function clickExact(p, sel, text) {
  const pt = await p.fn((sel, text) => {
    const e = [...document.querySelectorAll(sel)].find((x) => x.textContent.trim() === text.trim());
    if (!e) return null;
    e.scrollIntoView({ block: 'nearest' });
    const r = e.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }, sel, text);
  if (!pt) throw new Error(`no ${sel} reading ${JSON.stringify(text)}`);
  await p.clickAt(pt[0], pt[1]);
}
