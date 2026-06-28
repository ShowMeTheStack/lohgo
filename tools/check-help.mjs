// Check the language reference: every primitive has an entry, entries are well formed,
// and every example runs without an error.
// usage: node tools/check-help.mjs [--examples]
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LG, runLogo } from '../tests/harness.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'src/logo/help');
for (const f of readdirSync(dir).filter((x) => x.endsWith('.js')).sort()) (0, eval)(readFileSync(join(dir, f), 'utf8'));
const E = LG.HELP_ENTRIES || [];
const I = new LG.Interp({ vfs: new LG.VFS() });
const prims = new Map();
for (const p of I.prims.values()) prims.set(p.name, p);
let bad = 0;
const err = (m) => { console.log('ERROR ' + m); bad++; };
const names = new Map();
for (const e of E) {
  if (!e.n || !e.g || !e.d) err('incomplete entry ' + JSON.stringify(e).slice(0, 80));
  const k = (e.n || '').toLowerCase();
  if (names.has(k)) err('duplicate entry ' + e.n);
  names.set(k, e);
  for (const a of e.a || []) names.set(a.toLowerCase(), e);
  if (!e.topic) {
    const p = prims.get(k) || I.prims.get(k);
    if (!p) err('entry for unknown primitive ' + e.n);
    else for (const a of p.names.slice(1)) if (!(e.a || []).map((x) => x.toLowerCase()).includes(a.toLowerCase())) err(e.n + ' is missing alias ' + a);
    if (!e.s) err(e.n + ' has no syntax line');
  }
}
for (const p of prims.values()) if (!names.has(p.name.toLowerCase())) err('no entry for ' + p.name);
if (process.argv.includes('--examples')) {
  for (const e of E) {
    if (!e.e) continue;
    let X = null;
    const run = runLogo(e.e, { input: ['Sam', '5', 'yes', 'hello'], keys: 'ab', seed: 3, onInterp: (x) => { X = x; } });
    let to;
    const r = await Promise.race([run, new Promise((res) => { to = setTimeout(() => res('TIMEOUT'), 2500); })]);
    clearTimeout(to);
    if (r === 'TIMEOUT') { if (X) X.halt(); continue; }
    if (r.error && !e.errorOk) err('example for ' + e.n + ': ' + r.error.message);
  }
}
console.log(`${E.length} entries, ${prims.size} primitives, ${bad} problems`);
process.exit(bad ? 1 : 0);
