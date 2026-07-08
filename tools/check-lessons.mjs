// Check the lessons: structure, checks, regular expressions, and that every code snippet runs.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LG, runLogo } from '../tests/harness.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
import { readdirSync } from 'node:fs';
const ldir = join(root, 'src/ide/lessons');
for (const f of readdirSync(ldir).filter((x) => x.endsWith('.js')).sort()) (0, eval)(readFileSync(join(ldir, f), 'utf8'));
const L = LG.LESSONS || [];
const TOURS = ['welcome', 'first', 'debug', 'turtle', 'files'];
const CHECKS = ['run', 'command', 'codeHas', 'output', 'drawn', 'defined', 'paused', 'breakpoint', 'variable'];
const SELS = ['#worldCard', '#cmdCard', '#cmdInputBox', '#editorCard', '#inspCard', '#tbRun', '#tbPause', '#tbStop', '#tbInto', '#tbOver', '#tbOut', '#debugGroup', '#speed', '#rail', '#railFiles', '#railProcs', '#railLibrary', '#railLearn', '#railHelp', '#tbGrid', '#tbSnap', '#editors .ed-gutter', '#itab-vars', '#itab-stack', '#itab-watch', '#itab-bps', '#itab-hist', '#tabProblems', '#tbShare', '#transcript'];
let bad = 0;
const err = (m) => { console.log('  ERROR ' + m); bad++; };
const ids = new Set();
for (const l of L) {
  console.log(l.unit + ' :: ' + l.title);
  if (!l.id || ids.has(l.id)) err('missing or duplicate id ' + l.id);
  ids.add(l.id);
  for (const k of ['unit', 'title', 'level', 'summary']) if (!l[k]) err('missing ' + k);
  if (l.tour) { if (!TOURS.includes(l.tour)) err('unknown tour ' + l.tour); continue; }
  if (!Array.isArray(l.steps) || !l.steps.length) { err('no steps'); continue; }
  for (const [i, s] of l.steps.entries()) {
    if (!s.title) err(`step ${i} has no title`);
    if (s.sel && !SELS.includes(s.sel)) err(`step ${i} unknown selector ${s.sel}`);
    if (s.quiz) {
      const q = s.quiz;
      if (!(q.q && q.options && q.options.length > 1 && q.answer >= 0 && q.answer < q.options.length)) err(`step ${i} bad quiz`);
      continue;
    }
    if (!s.text) err(`step ${i} has no text`);
    if (s.check) {
      const k = Object.keys(s.check)[0];
      if (!CHECKS.includes(k)) err(`step ${i} unknown check ${k}`);
      for (const r of ['command', 'codeHas', 'output', 'value']) if (typeof s.check[r] === 'string') { try { new RegExp(s.check[r], 'i'); } catch (e) { err(`step ${i} bad regex ${s.check[r]}`); } }
    }
    if (s.code !== undefined) {
      let X = null;
      const run = runLogo(s.code, { input: ['Sam', '7', '5', 'yes', '3', 'no'], keys: 'ab', seed: 1, onInterp: (x) => { X = x; } });
      let to;
      const r = await Promise.race([run, new Promise((res) => { to = setTimeout(() => res('TIMEOUT'), 2500); })]);
      clearTimeout(to);
      if (r === 'TIMEOUT') { if (X) X.halt(); continue; }
      if (r.error && !s.errorOk) err(`step ${i} code fails: ${r.error.message} (line ${r.error.ln})`);
    }
  }
}
console.log(`${L.length} lessons, ${bad} problems`);
process.exit(bad ? 1 : 0);
