// Render Logo programs to PNG pictures of the turtle world (headless Chrome), to look at
// what they draw. usage: node tools/render.mjs out-dir file.lgo [file.lgo ...] [--time 4000]
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { launch } from './cdp.mjs';

const args = process.argv.slice(2);
const ti = args.indexOf('--time');
const time = ti >= 0 ? +args.splice(ti, 2)[1] : 4000;
const out = args.shift();
mkdirSync(out, { recursive: true });
const b = await launch({ width: 1000, height: 800 });
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: "try { localStorage.setItem('lohgo.settings', JSON.stringify({firstRun:false, theme:'paper'})); } catch (e) {}" });
await b.goto('#notour');
await b.waitFor('window.__lohgoReady === true', 20000);
for (const f of args) {
  const src = readFileSync(f, 'utf8');
  const m = /library\/([^/]+)\/([^/]+)$/.exec(f);
  const path = m ? '/projects/render/' + m[2] : '/projects/render/' + basename(f);
  await b.eval(`(() => { LG.app.stop(); const v = LG.app.vfs; v.mkdir('/projects/render', {parents: true, exist: true}); v.writeText(${JSON.stringify(path)}, ${JSON.stringify(src)}); const d = LG.app.docByPath(${JSON.stringify(path)}); if (d) { d.editor.setValue(v.readText(${JSON.stringify(path)})); d.savedText = d.editor.getValue(); d.dirty = false; } LG.app.openFile(${JSON.stringify(path)}); LG.app.commander.clear(); })()`);
  await b.eval('LG.app.runActive()');
  const t0 = Date.now();
  while (Date.now() - t0 < time) {
    const st = await b.eval('LG.app.interp.state');
    if (st === 'idle' || st === 'error' || st === 'input') break;
    await b.sleep(100);
  }
  const st = await b.eval('LG.app.interp.state');
  const err = st === 'error' ? await b.eval('LG.app.interp.lastError && LG.app.interp.lastError.message') : '';
  const url = await b.eval('LG.app.turtleView.snapshotDataURL()');
  const name = (m ? m[1] + '-' : '') + basename(f, '.lgo') + '.png';
  writeFileSync(join(out, name), Buffer.from(url.split(',')[1], 'base64'));
  console.log(name, st, err || '');
  await b.eval('LG.app.stop()');
}
await b.close();
process.exit(0);
