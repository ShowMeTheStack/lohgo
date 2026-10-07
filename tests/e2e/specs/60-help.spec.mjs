// The language reference sheet: opening it (rail, F1, menu, HELP), searching, groups with
// counts, entry pages with see-also links, F1 in the editor, and the hover summary.
import { HELP, cmd, charPoint, settle, clickExact } from './60-learn-lib.mjs';
import { openRef, entryPage } from './60-ref-lib.mjs';

const GROUPS = [...new Set(HELP.map((e) => e.g))];
const find = (n) => HELP.find((e) => e.n.toLowerCase() === n.toLowerCase() || (e.a || []).some((a) => a.toLowerCase() === n.toLowerCase()));

const navItems = (p) => p.ev("[...document.querySelectorAll('.modal .sheet-nav .nav-item')].map(e => ({ g: e.children[0].textContent, n: e.querySelector('.n').textContent, active: e.classList.contains('active') }))");
const rowNames = (p) => p.ev("[...document.querySelectorAll('#helpMain .list-row')].map(r => r.querySelector('.code').textContent)");
const listTitle = (p) => p.ev("(document.querySelector('#helpMain .vsec') || {}).textContent || ''");
const clickGroup = (p, g) => clickExact(p, '.modal .sheet-nav .nav-item > span:first-child', g);
const searchValue = (p) => p.ev("document.getElementById('helpSearch').value");

async function typeSearch(p, text) {
  await p.ev("(() => { const s = document.getElementById('helpSearch'); s.focus(); s.select(); })()");
  await p.key('Backspace');
  await p.type(text);
}

export default function (t) {
  t.test('Help on the rail opens the reference on the first group, with the search box focused', async (p) => {
    await openRef(p);
    const nav = await navItems(p);
    p.assert.deepEqual(nav.map((x) => x.g), GROUPS);
    p.assert.ok(nav[0].active);
    p.assert.equal(await listTitle(p), GROUPS[0]);
    p.assert.deepEqual(await rowNames(p), HELP.filter((e) => e.g === GROUPS[0]).map((e) => e.n));
    await p.modalButton('Close');
    p.assert.equal(await p.modalOpen(), false);
  }, { fresh: true });

  t.test('F1 opens the reference when the editor does not have the keyboard', async (p) => {
    await p.click('#worldCanvas');
    await p.key('F1');
    p.assert.equal(await p.waitModal(), 'Logo reference');
    await p.modalButton('Close');
  }, { fresh: true });

  t.test('the main menu has Language reference (F1)', async (p) => {
    await p.click('#menuBtn');
    await p.wait("!!document.querySelector('.menu-pop')", 3000);
    const it = (await p.menuItems()).find((x) => x.label === 'Language reference');
    p.assert.ok(it);
    p.assert.equal(it.sc, 'F1');
    await p.click('.menu-pop .menu-item', 'Language reference');
    p.assert.equal(await p.waitModal(), 'Logo reference');
    await p.modalButton('Close');
  }, { fresh: true });

  t.test('HELP "forward opens the page for FORWARD', async (p) => {
    await cmd(p, 'help "forward');
    p.assert.equal(await p.waitModal(), 'Logo reference');
    await p.wait("!!document.querySelector('#helpMain .help-entry')", 2000);
    const pg = await entryPage(p);
    p.assert.ok(pg.h3.startsWith('forward'));
    p.assert.equal(pg.syn, find('forward').s);
    await p.modalButton('Close');
  }, { fresh: true });

  t.test('HELP "fd finds FORWARD by its short name', async (p) => {
    await cmd(p, 'help "fd');
    await p.waitModal();
    await p.wait("!!document.querySelector('#helpMain .help-entry')", 2000);
    p.assert.ok((await entryPage(p)).h3.startsWith('forward'));
    await p.modalButton('Close');
  }, { fresh: true });

  t.test('(HELP) with no input opens the reference', async (p) => {
    await cmd(p, '(help)');
    p.assert.equal(await p.waitModal(), 'Logo reference');
    p.assert.equal(await listTitle(p), GROUPS[0]);
    await p.modalButton('Close');
  }, { fresh: true });

  t.test('HELP on an unknown word searches for it and says nothing was found', async (p) => {
    await cmd(p, 'help "zzqqx');
    await p.waitModal();
    p.assert.equal(await searchValue(p), 'zzqqx');
    p.assert.equal(await listTitle(p), '0 found');
    p.assert.equal(await p.text('#helpMain .empty'), 'Nothing found. Try a shorter word.');
    await p.modalButton('Close');
  }, { fresh: true });

  t.test('typing in the search box letter by letter keeps the focus and filters as you type', async (p) => {
    await openRef(p);
    await p.type('forw');
    p.assert.equal(await searchValue(p), 'forw');
    p.assert.equal(await p.focusedId(), 'helpSearch');
    const names = await rowNames(p);
    p.assert.equal(names[0], 'forward');
    p.assert.ok(names.every((n) => { const e = find(n); return [e.n, ...(e.a || [])].some((x) => x.toLowerCase().includes('forw')) || e.d.toLowerCase().includes('forw'); }));
    p.assert.equal(await listTitle(p), names.length + ' found');
    p.assert.equal(await p.ev("document.querySelectorAll('.modal .sheet-nav .nav-item.active').length"), 0, 'no group is highlighted while searching');
    await p.modalButton('Close');
  }, { fresh: true });

  t.test('search finds a primitive by its alias', async (p) => {
    await openRef(p);
    await p.type('setpc');
    p.assert.equal((await rowNames(p))[0], 'setpencolor');
    await p.modalButton('Close');
  }, { fresh: true });

  t.test('search finds words in the descriptions', async (p) => {
    await openRef(p);
    await p.type('square root');
    const names = await rowNames(p);
    p.assert.ok(names.includes('sqrt'), names.join(' '));
    for (const n of names) p.assert.ok(find(n).d.toLowerCase().includes('square root') || find(n).n.toLowerCase().includes('square root'), n);
    await p.modalButton('Close');
  }, { fresh: true });

  t.test('an exact name comes first in the results', async (p) => {
    await openRef(p);
    await p.type('list');
    p.assert.equal((await rowNames(p))[0], 'list');
    await p.modalButton('Close');
  }, { fresh: true });

  t.test('Enter in the search box opens the first result', async (p) => {
    await openRef(p);
    await p.type('repeat');
    await p.key('Enter');
    await p.wait("!!document.querySelector('#helpMain .help-entry')", 2000);
    p.assert.ok((await entryPage(p)).h3.startsWith('repeat'));
    await p.modalButton('Close');
  }, { fresh: true });

  t.test('clearing the search shows the group again', async (p) => {
    await openRef(p);
    await p.type('xyz');
    await typeSearch(p, '');
    p.assert.equal(await listTitle(p), GROUPS[0]);
    p.assert.ok((await navItems(p))[0].active);
    await p.modalButton('Close');
  }, { fresh: true });

  t.test('Enter on a focused result row opens it', async (p) => {
    await openRef(p);
    await p.ev("document.querySelector('#helpMain .list-row').focus()");
    await p.key('Enter');
    await p.wait("!!document.querySelector('#helpMain .help-entry')", 2000);
    p.assert.ok((await entryPage(p)).h3.startsWith(HELP[0].n));
    await p.modalButton('Close');
  }, { fresh: true });

  // every group, its count and its entries
  for (const g of GROUPS) {
    t.test(`group "${g}" shows its count and lists its entries`, async (p) => {
      if (!(await p.modalOpen())) await openRef(p);
      await clickGroup(p, g);
      const want = HELP.filter((e) => e.g === g).map((e) => e.n);
      const item = (await navItems(p)).find((x) => x.g === g);
      p.assert.equal(item.n, String(want.length));
      p.assert.ok(item.active);
      p.assert.equal(await listTitle(p), g);
      p.assert.deepEqual(await rowNames(p), want);
      // the first line of each description is shown next to the name
      const first = HELP.find((e) => e.g === g);
      p.assert.equal(await p.ev("document.querySelector('#helpMain .list-row .grow').textContent"), first.d.replace(/<[^>]+>/g, '').split(/(?<=\.)\s/)[0]);
    }, { fresh: g === GROUPS[0] });
  }

  t.test('an entry page shows the name and aliases, syntax, description, example and see-also', async (p) => {
    await openRef(p);
    await p.type('forward');
    await p.key('Enter');
    await p.wait("!!document.querySelector('#helpMain .help-entry')", 2000);
    const e = find('forward');
    const pg = await entryPage(p);
    p.assert.equal(pg.h3.replace(/\s+/g, ' '), [e.n, ...e.a].join(' '));
    p.assert.equal(pg.syn, e.s);
    p.assert.equal(pg.kind, 'Primitive');
    p.assert.deepEqual(pg.exLabel, ['Example', 'See also']);
    p.assert.equal(pg.ex, e.e);
    p.assert.deepEqual(pg.see, [...e.see]);
    const desc = await p.ev("document.querySelector('#helpMain .help-entry > .syn + div').textContent");
    p.assert.equal(desc, await p.fn((h) => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent; }, e.d));
    await p.modalButton('Close');
  }, { fresh: true });

  // see-also buttons go to their pages; the back button goes to the group
  const withSee = HELP.filter((e) => e.see && e.see.length);
  for (const e of withSee.filter((x, i) => i % 4 === 0)) {
    t.test(`see-also on ${e.n} go to ${e.see.join(', ')} and back to the group`, async (p) => {
      await openRef(p);
      for (const s of e.see) {
        await typeSearch(p, e.n);
        await p.key('Enter');
        await p.wait("!!document.querySelector('#helpMain .help-entry')", 2000);
        await p.click('#helpMain .help-entry .vsec + div > .small-btn', s);
        const target = find(s);
        const pg = await entryPage(p);
        p.assert.ok(pg.h3.startsWith(target.n), `${s} opens ${target.n}, got ${pg.h3}`);
        p.assert.equal(await p.ev("document.getElementById('helpMain').scrollTop"), 0, 'the new page starts at the top');
      }
      // back to the group of the last page
      const last = find(e.see[e.see.length - 1]);
      await p.click('#helpMain .help-entry .small-btn', '◀');
      p.assert.equal(await listTitle(p), last.g);
      p.assert.ok((await navItems(p)).find((x) => x.g === last.g).active);
      p.assert.ok((await rowNames(p)).includes(last.n));
      await p.modalButton('Close');
    }, { fresh: true });
  }

  t.test('F1 in the editor opens the page for the word under the cursor', async (p) => {
    await p.newFile('/projects/help.lgo', 'repeat 4 [forward 100 right 90]\n');
    const [x, y] = await charPoint(p, 0, 13);
    await p.clickAt(x, y);
    await p.key('F1');
    p.assert.equal(await p.waitModal(), 'Logo reference');
    await p.wait("!!document.querySelector('#helpMain .help-entry')", 2000);
    p.assert.ok((await entryPage(p)).h3.startsWith('forward'));
    await p.modalButton('Close');
    const [x2, y2] = await charPoint(p, 0, 2);
    await p.clickAt(x2, y2);
    await p.key('F1');
    await p.waitModal();
    await p.wait("!!document.querySelector('#helpMain .help-entry')", 2000);
    p.assert.ok((await entryPage(p)).h3.startsWith('repeat'));
    await p.modalButton('Close');
  }, { fresh: true });

  t.test('F1 on a word that is not in the reference searches for it', async (p) => {
    await p.newFile('/projects/help.lgo', 'to zebra\nend\nzebra\n');
    const [x, y] = await charPoint(p, 2, 2);
    await p.clickAt(x, y);
    await p.key('F1');
    await p.waitModal();
    p.assert.equal(await searchValue(p), 'zebra');
    p.assert.equal(await listTitle(p), '0 found');
    await p.modalButton('Close');
  }, { fresh: true });

  t.test('the editor menu has Help on the word under the pointer', async (p) => {
    await p.newFile('/projects/help.lgo', 'print sum 2 3\n');
    const [x, y] = await charPoint(p, 0, 7);
    await p.clickAt(x, y, { button: 'right' });
    await p.wait("!!document.querySelector('.menu-pop')", 3000);
    await p.click('.menu-pop .menu-item', 'Help on sum');
    await p.waitModal();
    await p.wait("!!document.querySelector('#helpMain .help-entry')", 2000);
    p.assert.ok((await entryPage(p)).h3.startsWith('sum'));
    await p.modalButton('Close');
  }, { fresh: true });

  t.test('Try it while a program runs asks to stop it first', async (p) => {
    await cmd(p, 'forever [wait 1]', { wait: false });
    await p.waitState(['running', 'waiting']);
    await openRef(p);
    await p.type('forward');
    await p.key('Enter');
    await p.wait("!!document.getElementById('helpTry')", 2000);
    await p.click('#helpTry');
    await p.waitToast(/Stop the running program first/);
    p.assert.equal(await p.modalOpen(), true, 'the reference stays open');
    await p.modalButton('Close');
    await p.key('F5', { shift: true });
    await settle(p, { timeout: 4000 });
  }, { fresh: true });

  t.test('Try it on an example with a procedure puts it in a file of its own and runs it', async (p) => {
    await openRef(p);
    await p.type('Procedures and inputs');
    await p.key('Enter');
    await p.wait("!!document.getElementById('helpTry')", 2000);
    await p.click('#helpTry');
    await settle(p);
    p.assert.equal(await p.activePath(), '/projects/tour/try-Proceduresandinputs.lgo');
    p.assert.equal(await p.code(), find('Procedures and inputs').e + '\n');
    p.assert.ok(await p.ev("LG.app.interp.procs.has('polygon')"));
  }, { fresh: true });

  t.test('Try it on a one-line example echoes it in the command center', async (p) => {
    await openRef(p);
    await p.type('sqrt');
    await p.key('Enter');
    await p.wait("!!document.getElementById('helpTry')", 2000);
    await p.click('#helpTry');
    await settle(p);
    const out = await p.output();
    p.assert.ok(out.includes(find('sqrt').e.split('\n')[0]), out);
  }, { fresh: true });

  // hover summaries: one primitive from each group
  const PRIMS = GROUPS.map((g) => HELP.find((e) => e.g === g && !e.topic && /^[a-z][\w.?]*$/i.test(e.n))).filter(Boolean);
  for (const e of PRIMS) {
    t.test(`resting the mouse on ${e.n} in the editor shows its summary`, async (p) => {
      await p.newFile('/projects/hover.lgo', `; hover\nignore [${e.n}]\n`);
      await p.ev('LG.app.callout.hide()');
      const [x, y] = await charPoint(p, 1, 9);
      await p.mouse('mouseMoved', x - 30, y + 40);
      await p.sleep(50);
      await p.mouse('mouseMoved', x, y);
      await p.wait("!!document.querySelector('.callout')", 3000);
      const txt = await p.text('.callout');
      p.assert.ok(txt.includes(e.s.split('\n')[0]), `the summary shows the syntax: ${txt}`);
      p.assert.match(txt, /F1 for more/);
      await p.mouse('mouseMoved', 5, 5);
      await p.ev('LG.app.callout.hide()');
    }, { fresh: e === PRIMS[0] });
  }

  t.test('no summary for a word of your own or a comment', async (p) => {
    await p.newFile('/projects/hover.lgo', '; forward in a comment\nto zebra\nend\n');
    await p.ev('LG.app.callout.hide()');
    const [x, y] = await charPoint(p, 1, 4);
    await p.mouse('mouseMoved', x, y);
    await p.sleep(700);
    p.assert.equal(await p.exists('.callout'), false);
    const [x2, y2] = await charPoint(p, 0, 4);
    await p.mouse('mouseMoved', x2, y2);
    await p.sleep(700);
    p.assert.equal(await p.exists('.callout'), false);
  }, { fresh: true });

  t.test('on a phone the reference fits and Try it shows the turtle', async (p) => {
    await p.tap('#mtab-more');
    await p.wait("!!document.querySelector('.menu-pop')", 3000);
    await p.tap('.menu-pop .menu-item', 'Language reference');
    p.assert.equal(await p.waitModal(), 'Logo reference');
    p.assert.ok(await p.noHScroll());
    await p.ev("(() => { const s = document.getElementById('helpSearch'); s.focus(); })()");
    await p.insertText('forward');
    await p.key('Enter');
    await p.wait("!!document.getElementById('helpTry')", 2000);
    await p.tap('#helpTry');
    await settle(p);
    p.assert.equal(await p.ev('LG.app.view'), 'turtle');
    p.assert.ok(await p.segments() > 0);
  }, { fresh: { width: 390, height: 844, mobile: true, touch: true } });
}
