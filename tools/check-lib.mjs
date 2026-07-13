// Run Logo programs headlessly and report errors.
// usage: node tools/check-lib.mjs <dir-or-file>... [--time 3000] [--verbose]
// Programs that are still running (games, animations) when the time is up count as fine.
// Scripted answers are typed for READLIST/READWORD and keys for READCHAR.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { runLogo } from '../tests/harness.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const time = +opt('--time', 3000);
const verbose = args.includes('--verbose'); if (verbose) args.splice(args.indexOf('--verbose'), 1);
const files = [];
const walk = (p) => { if (statSync(p).isDirectory()) for (const f of readdirSync(p).sort()) walk(join(p, f)); else if (/\.lgo$/i.test(p)) files.push(p); };
for (const a of args) walk(a);
// helper files next to programs, so LOAD works
const support = {};
for (const f of files) {
  const m = /library\/([^/]+)\/([^/]+)$/.exec(f);
  if (m) support['/library/' + m[1] + '/' + m[2]] = readFileSync(f, 'utf8');
  const s = /samples\/(.+)$/.exec(f);
  if (s) support['/examples/' + s[1]] = readFileSync(f, 'utf8');
}
let bad = 0;
for (const f of files) {
  if (basename(f).startsWith('_')) continue;
  const src = readFileSync(f, 'utf8');
  const m = /library\/([^/]+)\/([^/]+)$/.exec(f);
  const path = m ? '/library/' + m[1] + '/' + m[2] : '/projects/' + basename(f);
  const input = ['Sam', '7', '5', 'yes', '3', 'no', '12', '2', 'hello world', '42', '1', 'quit', 'q', 'n', 'bye', 'stop', '0', 'exit', ''];
  let I = null;
  const p = runLogo(src, { path, files: support, input, keys: 'xyzq ', seed: 7, timeSlice: 40, onInterp: (x) => { I = x; } });
  let to;
  const r = await Promise.race([p, new Promise((res) => { to = setTimeout(() => res('TIMEOUT'), time); })]);
  clearTimeout(to);
  let s;
  if (r === 'TIMEOUT') s = 'ok (still running)';
  else if (r.error) { s = 'ERROR: ' + r.error.message + (r.error.procName ? ' in ' + r.error.procName : '') + (r.error.ln ? ' (line ' + r.error.ln + ')' : ''); bad++; }
  else s = 'ok (' + r.interp.count + ' instructions, ' + r.interp.turtle.segments + ' lines drawn)';
  console.log(f + ': ' + s);
  if (verbose && r !== 'TIMEOUT') console.log(r.out.slice(0, 1500) + '\n---');
  if (r === 'TIMEOUT' && I) { I.halt(); if (I.clearHandlers) I.clearHandlers(); }
}
console.log(`${files.length - bad}/${files.length} ok`);
process.exit(bad ? 1 : 0);
