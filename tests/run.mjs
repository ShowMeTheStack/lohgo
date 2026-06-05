// Language tests: each tests/cases/NAME.lgo runs headlessly and its printed output must equal NAME.out.
// NAME.in (optional) holds lines typed for READLIST/READWORD.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runLogo } from './harness.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'cases');
const only = process.argv[2];
let pass = 0, fail = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.lgo')).sort()) {
  if (only && !f.includes(only)) continue;
  const base = f.slice(0, -4);
  const src = readFileSync(join(dir, f), 'utf8');
  const want = readFileSync(join(dir, base + '.out'), 'utf8');
  const input = existsSync(join(dir, base + '.in')) ? readFileSync(join(dir, base + '.in'), 'utf8').split('\n') : [];
  const r = await runLogo(src, { input, seed: 1, path: '/projects/' + f });
  const got = r.out + (r.error ? '!! ' + r.error.message + '\n' : '');
  if (got === want) { pass++; console.log('ok - ' + base); continue; }
  fail++;
  console.log('FAIL - ' + base);
  const a = got.split('\n'), b = want.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { console.log(`  line ${i + 1}: got ${JSON.stringify(a[i])} want ${JSON.stringify(b[i])}`); break; }
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
