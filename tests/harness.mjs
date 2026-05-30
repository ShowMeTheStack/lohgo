// Loads the Logo engine into Node and runs programs headlessly.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'src/manifest.json'), 'utf8'));
// load into the main context: code in a vm context pays for every global lookup
for (const f of manifest.core) (0, eval)(readFileSync(join(root, 'src', f), 'utf8') + '\n//# sourceURL=' + f);
export const LG = globalThis.LG;

/**
 * Run Logo source. opts.input: lines for READLIST/READWORD; opts.keys: characters for READCHAR.
 * Resolves {out, error, interp}.
 */
export function runLogo(src, opts = {}) {
  opts = opts || {};
  const vfs = new LG.VFS();
  for (const d of ['/projects']) vfs.mkdir(d, { exist: true });
  if (opts.files) for (const [p, t] of Object.entries(opts.files)) { vfs.mkdir(p.replace(/\/[^/]*$/, ''), { parents: true, exist: true }); vfs.writeText(p, t); }
  let out = '';
  const keys = (opts.keys || '').split('');
  const lines = (opts.input || []).slice();
  const io = {
    print: (t) => { out += t; },
    clearText: () => { out += '<CT>'; },
    keyp: () => keys.length > 0,
    readKey: () => (keys.length ? keys.shift() : null),
    cursor: () => [0, 0],
  };
  const I = new LG.Interp({ vfs, io, turtle: new LG.TurtleWorld({ headless: true }) });
  if (opts.onInterp) opts.onInterp(I);
  if (opts.seed !== undefined) I.random = LG.makeRandom(opts.seed);
  I.timeSlice = opts.timeSlice || 1e9;
  return new Promise((resolve) => {
    const finish = (error) => resolve({ out, error, interp: I, vfs });
    I.on('needInput', (req) => {
      setTimeout(() => {
        if (req.kind === 'line') I.provideInput(lines.length ? lines.shift() : null);
        else if (req.kind === 'char') I.provideInput(keys.length ? keys.shift() : null);
      }, 0);
    });
    I.on('done', () => finish(null));
    I.on('halted', () => finish(null));
    I.on('error', (e) => finish(e));
    I.on('paused', () => { if (opts.onPause) opts.onPause(I); else I.resume(); });
    try { I.loadText(src, opts.path || '/projects/test.lgo'); } catch (e) { finish(e); }
  });
}
