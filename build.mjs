// Build: inline the CSS and all the JavaScript (in manifest order) into one self-contained index.html.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = dirname(fileURLToPath(import.meta.url));
for (const t of ['tools/gen-samples.mjs', 'tools/gen-library.mjs', 'tools/gen-lessons.mjs']) {
  if (existsSync(join(root, t))) execSync('node ' + t, { cwd: root, stdio: 'inherit' });
}
const src = (p) => readFileSync(join(root, 'src', p), 'utf8');
const manifest = JSON.parse(src('manifest.json'));

let version = '0.1.0';
try { version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version; } catch (e) { /* none yet */ }

// "dir/*.js" entries pull in every file of a folder, in name order
const expand = (list) => list.flatMap((f) => {
  if (!f.endsWith('/*.js')) return [f];
  const d = f.slice(0, -5);
  return existsSync(join(root, 'src', d)) ? readdirSync(join(root, 'src', d)).filter((x) => x.endsWith('.js')).sort().map((x) => d + '/' + x) : [];
});
const js = [...expand(manifest.core), ...expand(manifest.ide)]
  .map((f) => `// ==== ${f} ====\n${src(f)}`)
  .join('\n')
  .replace(/<\/script/gi, '<\\/script');
const css = manifest.css.map((f) => src(f)).join('\n');

let html = src('shell.html');
html = html.replace('/*@@CSS@@*/', () => css);
html = html.replace('//@@JS@@', () => js);
// the author's photo, embedded so the page stays a single file
html = html.replace(/@@AUTHOR_PNG@@/g, () => readFileSync(join(root, 'assets', 'author.png')).toString('base64'));
html = html.replace(/@@VERSION@@/g, version);
writeFileSync(join(root, 'index.html'), html);
console.log(`index.html: ${(html.length / 1024).toFixed(1)} KB`);
