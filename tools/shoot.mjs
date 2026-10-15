// Takes the screenshots in docs/images/ that README.md shows, from the built index.html.
// usage: node build.mjs && node tools/shoot.mjs [name ...]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs', 'images');
mkdirSync(out, { recursive: true });
const only = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(opts = {}) {
  const b = await launch({ width: opts.w || 1440, height: opts.h || 900, mobile: opts.mobile });
  const settings = Object.assign({ firstRun: false, theme: 'paper', grid: false }, opts.settings || {});
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('lohgo.settings', ${JSON.stringify(JSON.stringify(settings))}); localStorage.setItem('lohgo.side', ${JSON.stringify(JSON.stringify(opts.side === undefined ? null : opts.side))}); } catch (e) {}` });
  if (opts.mobile) await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await b.goto('#notour');
  await b.waitFor('window.__lohgoReady === true', 20000);
  await sleep(400);
  const p = {
    b,
    ev: (e) => b.eval(e),
    async open(path) { await b.eval(`LG.app.openFile(${JSON.stringify(path)})`); await sleep(250); },
    async lib(path) { await b.eval(`LG.Library.open(LG.app, ${JSON.stringify(path)})`); await sleep(700); },
    async run() { await b.eval('LG.app.runActive()'); },
    async idle(ms = 20000) { await b.waitFor("['idle','error','paused','input'].includes(LG.app.interp.state)", ms); },
    async cmd(text) { await b.eval(`(LG.app.commander.echo(${JSON.stringify(text)}), LG.app.runCommand(${JSON.stringify(text)}))`); await sleep(300); },
    async shot(name, sel) {
      const params = { format: 'png' };
      if (sel) {
        const r = await b.eval(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return {x: r.left, y: r.top, width: r.width, height: r.height}; })()`);
        params.clip = Object.assign(r, { scale: 1 });
      }
      const res = await b.send('Page.captureScreenshot', params);
      writeFileSync(join(out, name + '.png'), Buffer.from(res.data, 'base64'));
      console.log('saved', name);
    },
    close: () => b.close(),
  };
  return p;
}

/** Each shot opens a fresh page; names are the PNG file names */
const shots = {
  async overview() {
    const p = await page({ side: 'files' });
    await p.open('/examples/tree.lgo');
    await p.run(); await p.idle();
    await p.cmd('print count procedures');
    await p.shot('overview');
    await p.close();
  },
  async debugger() {
    const p = await page();
    await p.open('/examples/factorial.lgo');
    await p.ev("(() => { const d = LG.app.active; const i = d.editor.lines().findIndex(l => /^\\s*if :n = 0/.test(l)); LG.app.toggleBreakpoint(d.path, i); })()");
    await p.run(); await sleep(500);
    for (let i = 0; i < 4; i++) { await p.ev('LG.app.continue()'); await sleep(250); }
    await p.ev("LG.app.inspector.show('stack')"); await sleep(300);
    await p.shot('debugger-stack');
    await p.ev("LG.app.selectFrame(2); LG.app.inspector.show('vars')"); await sleep(300);
    await p.shot('debugger-frames');
    await p.close();
  },
  async callout() {
    const p = await page();
    await p.ev(`(() => { const v = LG.app.vfs; v.writeText('/projects/pets.lgo', ${JSON.stringify('make "pets [[cat 4] [parrot 2] [snake 0]]\nmake "grid {{1 2 3} {4 5 6}}\nto feed :list\n  if emptyp :list [stop]\n  print first first :list\n  feed butfirst :list\nend\nfeed :pets\n')}); LG.app.openFile('/projects/pets.lgo'); })()`);
    await sleep(300);
    await p.ev("LG.app.toggleBreakpoint('/projects/pets.lgo', 4)");
    await p.run(); await sleep(500);
    await p.ev("LG.app.inspector.show('vars')");
    await sleep(200);
    const at = await p.ev("(() => { const e = LG.app.active.editor; const r = e.ta.getBoundingClientRect(); const cw = e.ta.scrollWidth ? 8.4 : 8.4; return [r.left + 14 + 9 * cw, r.top + 8 + 7.5 * 22.4]; })()");
    await p.b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at[0], y: at[1] });
    await sleep(700);
    await p.ev("(() => { const tw = document.querySelector('.callout .twisty'); if (tw && tw.textContent === '▸') tw.click(); })()");
    await sleep(250);
    await p.shot('hover-callout');
    await p.close();
  },
  async gallery() {
    const list = [
      ['art-tree', '/examples/tree.lgo'], ['art-snowflake', '/examples/snowflake.lgo'], ['art-dragon', '/examples/dragon.lgo'],
      ['art-sierpinski', '/examples/sierpinski.lgo'], ['art-rainbow', '/examples/rainbow.lgo'], ['art-stars', '/examples/stars.lgo'],
      ['art-flower', '/examples/flower.lgo'], ['art-spiral', '/examples/spiral.lgo'],
    ];
    for (const [name, path] of list) {
      if (only.length && !only.includes('gallery') && !only.includes(name)) continue;
      const p = await page();
      await p.open(path); await p.run(); await p.idle(); await sleep(300);
      await p.shot(name, '#worldCard');
      await p.close();
    }
  },
  async command() {
    const p = await page();
    for (const c of ['print [Hello, turtle!]', 'repeat 5 [fd 120 rt 144]', 'to tri :s', 'repeat 3 [fd :s rt 120]', 'end', 'tri 60', 'show map [? * ?] [1 2 3 4 5]', 'print sqrt 2']) {
      await p.ev(`(() => { const t = document.getElementById('cmdInput'); t.value = ${JSON.stringify(c)}; LG.app.commander.submit(); })()`);
      await sleep(250);
    }
    await p.shot('command-center', '#leftCol');
    await p.close();
  },
  async library() {
    const p = await page();
    await p.ev("void LG.Library.browse(LG.app, 'fractals')"); await sleep(900);
    await p.shot('library');
    await p.close();
  },
  async learn() {
    const p = await page();
    await p.ev('void LG.Lessons.browse(LG.app)'); await sleep(800);
    await p.shot('learn');
    await p.ev("document.querySelectorAll('.modal-back').forEach(m => m.remove()); LG.Lessons.start(LG.app, 1)"); await sleep(900);
    await p.ev("(() => { const n = document.getElementById('tourNext'); if (n) n.click(); })()"); await sleep(800);
    await p.shot('lesson');
    await p.close();
  },
  async tour() {
    const p = await page();
    await p.ev("LG.Tours.start(LG.app, 'welcome')"); await sleep(400);
    for (let i = 0; i < 2; i++) { await p.ev("document.getElementById('tourNext').click()"); await sleep(300); }
    await sleep(400);
    await p.shot('tour');
    await p.close();
  },
  async help() {
    const p = await page();
    await p.ev("LG.Help.open(LG.app, 'arc')"); await sleep(600);
    await p.shot('help');
    await p.close();
  },
  async themes() {
    for (const th of ['chalk', 'blueprint', 'midnight', 'retro']) {
      if (only.length && !only.includes('themes') && !only.includes('theme-' + th)) continue;
      const p = await page({ settings: { theme: th } });
      await p.open('/examples/snowflake.lgo'); await p.run(); await p.idle(); await sleep(300);
      await p.shot('theme-' + th);
      await p.close();
    }
  },
  async files() {
    const p = await page({ side: 'files' });
    await p.ev("LG.app.expanded.add('/examples')");
    await p.open('/examples/diary.lgo');
    await p.ev('LG.app.renderSide()');
    await sleep(300);
    await p.ev("void LG.Files.shareDialog(LG.app, '/examples/diary.lgo')"); await sleep(700);
    await p.shot('share');
    await p.close();
  },
  async mobile() {
    const p = await page({ w: 390, h: 844, mobile: true });
    await p.open('/examples/snowflake.lgo'); await p.run(); await p.idle(); await sleep(400);
    await p.shot('phone-turtle');
    await p.ev("LG.app.setView('code')"); await sleep(300);
    await p.shot('phone-code');
    await p.close();
    const t = await page({ w: 1024, h: 768, mobile: true });
    await t.open('/examples/dragon.lgo'); await t.run(); await t.idle();
    await t.ev("LG.app.toggleSide('files')"); await sleep(400);
    await t.shot('tablet');
    await t.close();
  },
  async error() {
    const p = await page();
    await p.ev(`(() => { LG.app.vfs.writeText('/projects/oops.lgo', ${JSON.stringify('to polygon :sides :size\n  repeat :sides [fd :size rt 360 / :sides]\nend\n\npolygon 6\n')}); LG.app.openFile('/projects/oops.lgo'); })()`);
    await sleep(300);
    await p.run(); await p.idle(); await sleep(300);
    await p.shot('error');
    await p.close();
  },
};

for (const [name, fn] of Object.entries(shots)) {
  const prefixes = { gallery: /^art-/, themes: /^theme-/ };
  if (only.length && !only.includes(name) && !(prefixes[name] && only.some((o) => prefixes[name].test(o)))) continue;
  try { await fn(); } catch (e) { console.error('FAILED', name, e.message); }
}
process.exit(0);
