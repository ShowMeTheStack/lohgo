// One test per reference entry with an example: find it by searching, check its page, press
// Try it, and check that it ran without an error and printed or drew something.
import { HELP, cmd, clickWorld, worldSum } from './60-learn-lib.mjs';

export const WITH_EXAMPLE = HELP.filter((e) => e.e);

export async function openRef(p) {
  await p.click('#railHelp');
  p.assert.equal(await p.waitModal(), 'Logo reference');
  await p.wait("document.activeElement && document.activeElement.id === 'helpSearch'", 2000);
}

/** Search for an entry by name and open it with Enter */
export async function openEntry(p, name) {
  await openRef(p);
  await p.insertText(name);
  await p.key('Enter');
  await p.wait("!!document.querySelector('#helpMain .help-entry')", 2000);
}

export function entryPage(p) {
  return p.ev(`(() => {
    const m = document.querySelector('#helpMain .help-entry');
    return {
      h3: m.querySelector('h3').textContent,
      syn: (m.querySelector('.syn') || {}).textContent || null,
      ex: (m.querySelector(':scope > pre') || {}).textContent || null,
      exLabel: [...m.querySelectorAll('.vsec')].map((e) => e.textContent),
      see: [...m.querySelectorAll('.vsec + div > .small-btn')].map((b) => b.textContent),
      back: m.querySelector('.small-btn').textContent,
      kind: m.querySelector('.muted').textContent,
      tryIt: !!m.querySelector('#helpTry'),
    };
  })()`);
}

/** Let the example finish, answering questions, pressing keys and continuing pauses on the way */
async function finish(p, e) {
  const t0 = Date.now();
  let keys = 0;
  while (Date.now() - t0 < 20000) {
    const [st, reading, wantChar] = await p.ev("[LG.app.interp.state, !!LG.app.commander.reading, (() => { const I = LG.app.interp; const f = I.stack[I.stack.length - 1]; return !!(f && f.wantInput === 'char'); })()]");
    if (st === 'idle' || st === 'error') return st;
    if (st === 'paused') { await cmd(p, 'continue', { wait: false }); await p.sleep(200); continue; }
    if (st === 'input' && reading) { await p.click('#cmdInput'); await p.insertText('blue sky'); await p.key('Enter'); await p.sleep(100); continue; }
    if (st === 'input' && wantChar) { if (!keys++) await clickWorld(p); await p.key('k'); await p.sleep(80); continue; }
    if (/keyp/.test(e.e) && keys < 3) { if (!keys++) await clickWorld(p); await p.key('k'); }
    await p.sleep(100);
  }
  throw new Error('the example is still running after 20s');
}

export function tryTests(t, list) {
  for (const e of list) {
    t.test(`Try it: ${e.n}`, async (p) => {
      const A = p.assert;
      await openEntry(p, e.n);
      const pg = await entryPage(p);
      A.ok(pg.h3.startsWith(e.n), `the page is about ${e.n}, got ${pg.h3}`);
      for (const a of e.a || []) A.ok(pg.h3.includes(a), 'the alias ' + a + ' is shown');
      A.equal(pg.kind, e.topic ? 'Topic' : 'Primitive');
      A.equal(pg.back, '◀ ' + e.g);
      if (e.s) A.equal(pg.syn, e.s);
      A.equal(pg.ex, e.e);
      A.deepEqual(pg.see, [...(e.see || [])]);
      A.ok(pg.tryIt);
      const sum0 = await worldSum(p);
      await p.ev("window.__n0 = document.getElementById('transcript').childNodes.length; window.__len0 = LG.app.outputLen || 0; window.__seg0 = LG.app.world.drawnTotal || 0");
      // count the notes TONE and SOUND play
      await p.ev("(() => { const AC = window.AudioContext; if (AC && !AC.prototype.__counted) { const o = AC.prototype.createOscillator; AC.prototype.createOscillator = function () { window.__osc = (window.__osc || 0) + 1; return o.apply(this, arguments); }; AC.prototype.__counted = true; } window.__osc = 0; })()");
      await p.click('#helpTry');
      const helpWord = /^\s*help\s+"(\S+)/m.exec(e.e);
      if (helpWord) {
        // HELP opens the reference again, on the entry it names
        await p.wait("!!document.querySelector('#helpMain .help-entry')", 3000);
        A.ok((await entryPage(p)).h3.startsWith(helpWord[1]));
        await p.modalButton('Close');
      }
      A.equal(await p.modalOpen(), false, 'Try it closes the reference');
      const st = await finish(p, e);
      await p.sleep(150);
      const r = await p.ev(`(() => {
        LG.app.commander.flush();
        const nodes = [...document.getElementById('transcript').childNodes];
        const fresh = nodes.length >= window.__n0 ? nodes.slice(window.__n0) : nodes;
        const errs = fresh.filter((n) => n.nodeType === 1 && n.classList.contains('err')).map((n) => n.textContent);
        return { errs, printed: (LG.app.outputLen || 0) - window.__len0, drawn: (LG.app.world.drawnTotal || 0) - window.__seg0, notes: window.__osc || 0 };
      })()`);
      const sum1 = await worldSum(p);
      if (e.errorOk) {
        A.ok(r.errs.length, 'the example shows its error');
        if (typeof e.errorOk === 'string') A.match(r.errs.join('\n'), new RegExp(e.errorOk, 'i'));
      } else {
        A.deepEqual(r.errs, [], 'no error in the command center');
        A.notEqual(st, 'error');
      }
      A.ok(r.printed > 0 || r.drawn > 0 || sum1 !== sum0 || r.notes > 0, 'the example printed, drew or played something');
    }, { fresh: true, timeout: 45000 });
  }
}
