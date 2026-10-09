// The program library sheet: opening it, categories, level filters, search, cards, the state it
// remembers, and what happens when a program is opened from it.
import { programs, CATEGORY_DIRS, openSheet, search, showAll, card } from './70-library-lib.mjs';

const ALL = programs();
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const NAMES = {
  shapes: 'Shapes & Polygons', patterns: 'Patterns & Mandalas', spirals: 'Spirals & Curves', fractals: 'Fractals',
  art: 'Generative Art & Colour', animation: 'Animation & Many Turtles', games: 'Games', puzzles: 'Puzzles & Logic',
  math: 'Mathematics', geometry: 'Geometry & Trigonometry', numbers: 'Number Theory', words: 'Words & Text',
  data: 'Lists & Data Structures', algorithms: 'Algorithms', recursion: 'Recursion', science: 'Science & Simulation',
  music: 'Music & Sound', files: 'Files & Data', school: 'School Helpers & Quizzes', stories: 'Stories, Chatbots & Language',
  classic: 'Classic Logo',
};
const ORDER = Object.keys(NAMES);

const cardPaths = (p) => p.ev("[...document.querySelectorAll('#libMain .pcard')].map((c) => c.dataset.path)");
const heading = (p) => p.ev("(() => { const m = document.getElementById('libMain').firstChild; return [m.firstChild.firstChild.innerText, m.firstChild.lastChild.innerText]; })()");
const navItems = (p) => p.ev("[...document.querySelectorAll('.sheet-nav .nav-item')].map((e) => ({ id: e.dataset.cat, label: e.children[0].innerText, n: e.children[1].innerText, active: e.classList.contains('active') }))");
const levelOn = (p) => p.ev("[...document.querySelectorAll('#libLevels button.on')].map((b) => b.dataset.lv)");
const sorted = (a) => a.slice().sort();
const matches = (q) => ALL.filter((x) => (x.head.title + ' ' + x.head.summary + ' ' + x.head.tags.join(' ') + ' ' + x.path).toLowerCase().includes(q.toLowerCase())).map((x) => x.path);

async function closeSheet(p) {
  if (await p.exists('#libSearch')) { await p.modalButton('Close'); await p.waitGone('#libSearch', 3000); }
}

export default function (t) {
  // ---- opening and closing ---------------------------------------------------------------------
  t.test('the Library button on the rail opens the sheet', async (p) => {
    await p.click('#railLibrary');
    await p.wait("!!document.getElementById('libSearch')", 4000);
    p.assert.equal(await p.modalTitle(), 'Program library');
    p.assert.equal(await p.attr('#libSearch', 'placeholder'), 'Search ' + ALL.length + ' programs');
    p.assert.equal(await p.count('#libMain .pcard'), ALL.length);
    await closeSheet(p);
  }, { fresh: true });
  t.test('the menu item Program library opens the sheet', async (p) => {
    await p.menu('Program library');
    await p.wait("!!document.getElementById('libSearch')", 4000);
    p.assert.equal(await p.modalTitle(), 'Program library');
    await closeSheet(p);
  }, { fresh: true });
  t.test('the search box has the keyboard focus when the sheet opens', async (p) => {
    await openSheet(p);
    await p.wait("document.activeElement && document.activeElement.id === 'libSearch'", 2000);
    await closeSheet(p);
  }, { fresh: true });
  t.test('the Open the library button shown with no program open opens the sheet', async (p) => {
    await p.ev('(async () => { for (const d of [...LG.app.docs]) { d.dirty = false; await LG.app.closeDoc(d); } })()');
    await p.wait("!!document.querySelector('.empty-ed')", 3000);
    await p.click('.empty-ed button', 'Open the library');
    await p.wait("!!document.getElementById('libSearch')", 4000);
    await closeSheet(p);
  }, { fresh: true });
  t.test('the Close button closes the sheet and opens nothing', async (p) => {
    const before = await p.ev('LG.app.docs.length');
    await openSheet(p);
    await p.modalButton('Close');
    await p.waitGone('#libSearch', 3000);
    p.assert.equal(await p.ev('LG.app.docs.length'), before);
  }, { fresh: true });
  t.test('Escape closes the sheet', async (p) => {
    await openSheet(p);
    await p.key('Escape');
    await p.waitGone('#libSearch', 3000);
    p.assert.equal(await p.modalOpen(), false);
  }, { fresh: true });
  t.test('clicking outside the sheet closes it', async (p) => {
    await openSheet(p);
    await p.clickAt(5, 5);
    await p.waitGone('#libSearch', 3000);
  }, { fresh: true });

  // ---- the categories --------------------------------------------------------------------------
  t.test('the category list starts with Everything and lists every category with its count', async (p) => {
    await openSheet(p);
    const nav = await navItems(p);
    p.assert.deepEqual(nav[0], { id: '*', label: 'Everything', n: String(ALL.length), active: true });
    const dirs = sorted(CATEGORY_DIRS);
    p.assert.deepEqual(sorted(nav.slice(1).map((x) => x.id)), dirs);
    p.assert.deepEqual(nav.slice(1).map((x) => x.id), ORDER.filter((c) => dirs.includes(c)), 'categories in their set order');
    for (const n of nav.slice(1)) p.assert.equal(n.n, String(ALL.filter((x) => x.cat === n.id).length), n.id);
    p.assert.equal(nav.slice(1).reduce((a, x) => a + +x.n, 0), ALL.length);
    await closeSheet(p);
  }, { fresh: true });
  t.test('Everything shows the number of programs under its heading', async (p) => {
    await openSheet(p);
    p.assert.deepEqual(await heading(p), ['Everything', ALL.length + ' programs']);
    await closeSheet(p);
  }, { fresh: true });
  for (const cat of CATEGORY_DIRS) {
    const mine = ALL.filter((x) => x.cat === cat);
    t.test(`the ${cat} category shows its name, blurb and only its ${mine.length} programs`, async (p) => {
      await showAll(p);
      await p.click(`.sheet-nav .nav-item[data-cat="${cat}"]`);
      const nav = await navItems(p);
      p.assert.deepEqual(nav.filter((x) => x.active).map((x) => x.id), [cat]);
      const [name, blurb] = await heading(p);
      p.assert.equal(name, NAMES[cat]);
      const want = await p.ev(`LG.LIBRARY.categories.find((c) => c.id === ${JSON.stringify(cat)}).blurb`);
      p.assert.ok(want.length > 10, 'a blurb');
      p.assert.equal(blurb, want);
      p.assert.deepEqual(sorted(await cardPaths(p)), sorted(mine.map((x) => x.path)));
      await p.click('.sheet-nav .nav-item[data-cat="*"]');
      p.assert.equal(await p.count('#libMain .pcard'), ALL.length);
      await closeSheet(p);
    });
  }
  t.test('Enter on a focused category picks it', async (p) => {
    await showAll(p);
    await p.ev("document.querySelector('.sheet-nav .nav-item[data-cat=\"music\"]').focus()");
    await p.key('Enter');
    p.assert.deepEqual((await navItems(p)).filter((x) => x.active).map((x) => x.id), ['music']);
    p.assert.equal(await p.count('#libMain .pcard'), ALL.filter((x) => x.cat === 'music').length);
    await p.click('.sheet-nav .nav-item[data-cat="*"]');
    await closeSheet(p);
  });

  // ---- the level filters -----------------------------------------------------------------------
  t.test('the level buttons are All, Beginner, Intermediate and Advanced with All on', async (p) => {
    await showAll(p);
    p.assert.deepEqual(await p.texts('#libLevels button'), ['All', ...LEVELS]);
    p.assert.deepEqual(await levelOn(p), ['*']);
    await closeSheet(p);
  });
  for (const lv of LEVELS) {
    const want = ALL.filter((x) => x.head.level === lv).map((x) => x.path);
    t.test(`the ${lv} button shows only the ${want.length} ${lv.toLowerCase()} programs`, async (p) => {
      await showAll(p);
      await p.click(`#libLevels button[data-lv="${lv}"]`);
      p.assert.deepEqual(await levelOn(p), [lv]);
      p.assert.deepEqual(sorted(await cardPaths(p)), sorted(want));
      const chips = await p.ev("[...document.querySelectorAll('#libMain .pcard .tagc:first-child')].map((e) => e.innerText)");
      p.assert.ok(chips.every((c) => c === lv), 'every level chip says ' + lv);
      await p.click('#libLevels button[data-lv="*"]');
      p.assert.equal(await p.count('#libMain .pcard'), ALL.length);
      await closeSheet(p);
    });
  }
  t.test('every level has some programs and the levels add up to the whole library', async (p) => {
    for (const lv of LEVELS) p.assert.ok(ALL.some((x) => x.head.level === lv), lv);
    p.assert.equal(LEVELS.reduce((a, lv) => a + ALL.filter((x) => x.head.level === lv).length, 0), ALL.length);
    p.assert.equal(await p.ev('LG.LIBRARY.items.length'), ALL.length);
  });
  for (const cat of CATEGORY_DIRS) {
    t.test(`a category and a level together: ${cat} at each level`, async (p) => {
      await showAll(p);
      await p.click(`.sheet-nav .nav-item[data-cat="${cat}"]`);
      for (const lv of LEVELS) {
        await p.click(`#libLevels button[data-lv="${lv}"]`);
        const want = ALL.filter((x) => x.cat === cat && x.head.level === lv).map((x) => x.path);
        p.assert.deepEqual(sorted(await cardPaths(p)), sorted(want), lv);
        if (!want.length) p.assert.equal(await p.text('#libMain .empty'), 'No programs match that.');
      }
      await p.click('#libLevels button[data-lv="*"]');
      await p.click('.sheet-nav .nav-item[data-cat="*"]');
      await closeSheet(p);
    });
  }

  // ---- search ----------------------------------------------------------------------------------
  const sample = ALL.find((x) => x.path === 'games/asteroids-lite.lgo') || ALL[0];
  const searches = [
    ['a title', sample.head.title],
    ['a title in capitals', sample.head.title.toUpperCase()],
    ['a word from a summary', sample.head.summary.split(' ').slice(2, 5).join(' ')],
    ['a tag', sample.head.tags[sample.head.tags.length - 1]],
    ['a file path', sample.path],
    ['a category folder name', 'recursion/'],
    ['a primitive name used as a tag', 'repeat'],
    ['a word with spaces around it', '  spiral  '],
  ];
  for (const [what, q] of searches) {
    t.test(`search finds programs by ${what}`, async (p) => {
      await showAll(p);
      await search(p, q);
      const want = matches(q.trim());
      p.assert.ok(want.length > 0, 'the search should find something: ' + q);
      p.assert.deepEqual(sorted(await cardPaths(p)), sorted(want));
      p.assert.deepEqual(await heading(p), ['Everything', want.length + ' programs']);
      await search(p, '');
      await closeSheet(p);
    });
  }
  t.test('search updates the cards as each letter is typed', async (p) => {
    await showAll(p);
    await p.click('#libSearch');
    const counts = [];
    for (const ch of 'koch') {
      await p.type(ch);
      counts.push(await p.count('#libMain .pcard'));
    }
    const want = ['k', 'ko', 'koc', 'koch'].map((q) => matches(q).length);
    p.assert.deepEqual(counts, want);
    p.assert.ok(want[3] < want[0]);
    await search(p, '');
    await closeSheet(p);
  });
  t.test('a search that matches nothing says so', async (p) => {
    await showAll(p);
    await search(p, 'zzqqxx nothing here');
    p.assert.equal(await p.count('#libMain .pcard'), 0);
    p.assert.equal(await p.text('#libMain .empty'), 'No programs match that.');
    p.assert.deepEqual(await heading(p), ['Everything', '0 programs']);
    await search(p, '');
    await closeSheet(p);
  });
  t.test('search works inside a category and with a level', async (p) => {
    await showAll(p);
    await p.click('.sheet-nav .nav-item[data-cat="fractals"]');
    await p.click('#libLevels button[data-lv="Advanced"]');
    await search(p, 'tree');
    const want = ALL.filter((x) => x.cat === 'fractals' && x.head.level === 'Advanced' && matches('tree').includes(x.path)).map((x) => x.path);
    p.assert.deepEqual(sorted(await cardPaths(p)), sorted(want));
    await showAll(p);
    await closeSheet(p);
  });
  t.test('clearing the search brings every program back', async (p) => {
    await showAll(p);
    await search(p, 'spiral');
    p.assert.ok((await p.count('#libMain .pcard')) < ALL.length);
    await search(p, '');
    p.assert.equal(await p.count('#libMain .pcard'), ALL.length);
    await closeSheet(p);
  });

  // ---- remembered state --------------------------------------------------------------------------
  t.test('the category, level and search are remembered when the sheet opens again', async (p) => {
    await showAll(p);
    await p.click('.sheet-nav .nav-item[data-cat="spirals"]');
    await p.click('#libLevels button[data-lv="Beginner"]');
    await search(p, 'spiral');
    const before = await cardPaths(p);
    await closeSheet(p);
    await openSheet(p);
    p.assert.equal(await p.ev("document.getElementById('libSearch').value"), 'spiral');
    p.assert.deepEqual((await navItems(p)).filter((x) => x.active).map((x) => x.id), ['spirals']);
    p.assert.deepEqual(await levelOn(p), ['Beginner']);
    p.assert.deepEqual(await cardPaths(p), before);
    await showAll(p);
    await closeSheet(p);
  }, { fresh: true });
  t.test('the category, level and search are remembered after a reload', async (p) => {
    await showAll(p);
    await p.click('.sheet-nav .nav-item[data-cat="games"]');
    await p.click('#libLevels button[data-lv="Intermediate"]');
    await search(p, 'key');
    const before = await cardPaths(p);
    await closeSheet(p);
    await p.reload();
    await openSheet(p);
    p.assert.equal(await p.ev("document.getElementById('libSearch').value"), 'key');
    p.assert.deepEqual((await navItems(p)).filter((x) => x.active).map((x) => x.id), ['games']);
    p.assert.deepEqual(await levelOn(p), ['Intermediate']);
    p.assert.deepEqual(await cardPaths(p), before);
    await showAll(p);
    await closeSheet(p);
  }, { fresh: true });

  // ---- cards -------------------------------------------------------------------------------------
  t.test('a card shows the title, summary, level chip and up to three tags', async (p) => {
    await showAll(p);
    for (const x of ALL.filter((_, i) => i % 50 === 0)) {
      const c = await card(p, x.path);
      p.assert.equal(c.title, x.head.title);
      p.assert.equal(c.summary, x.head.summary);
      p.assert.deepEqual(c.chips, [x.head.level, ...x.head.tags.slice(0, 3)]);
      p.assert.equal(await p.attr(`.pcard[data-path="${x.path}"]`, 'title'), x.path);
    }
    await closeSheet(p);
  }, { fresh: true });
  t.test('every card is a focusable button', async (p) => {
    await showAll(p);
    const bad = await p.ev("[...document.querySelectorAll('#libMain .pcard')].filter((c) => c.getAttribute('role') !== 'button' || c.tabIndex !== 0).length");
    p.assert.equal(bad, 0);
    await closeSheet(p);
  });
  t.test('a program that was opened gets a tick on its card, and it stays after a reload', async (p) => {
    const x = ALL.find((y) => y.path === 'shapes/' + y.file);
    await showAll(p);
    p.assert.equal((await card(p, x.path)).title, x.head.title);
    await p.click(`.pcard[data-path="${x.path}"]`);
    await p.waitGone('#libSearch', 3000);
    await openSheet(p);
    p.assert.equal((await card(p, x.path)).title, '✓ ' + x.head.title);
    const other = ALL.find((y) => y.path !== x.path);
    p.assert.equal((await card(p, other.path)).title, other.head.title, 'other cards have no tick');
    await closeSheet(p);
    await p.reload();
    await openSheet(p);
    p.assert.equal((await card(p, x.path)).title, '✓ ' + x.head.title);
    await closeSheet(p);
  }, { fresh: true });
  t.test('Enter on a focused card opens that program', async (p) => {
    const x = ALL.find((y) => y.cat === 'music');
    await showAll(p);
    await p.ev(`document.querySelector('.pcard[data-path="${x.path}"]').focus()`);
    await p.key('Enter');
    await p.wait(`LG.app.active && LG.app.active.path === '/library/${x.path}'`, 4000);
    p.assert.equal(await p.modalOpen(), false);
  }, { fresh: true });
  t.test('Tab moves from the search box into the sheet', async (p) => {
    await openSheet(p);
    await p.wait("document.activeElement.id === 'libSearch'", 2000);
    await p.key('Tab');
    p.assert.ok(await p.ev("document.querySelector('.modal').contains(document.activeElement) && document.activeElement.id !== 'libSearch'"));
    await closeSheet(p);
  }, { fresh: true });

  // ---- opening a program -------------------------------------------------------------------------
  const target = ALL.find((y) => y.path === 'fractals/koch-curve.lgo') || ALL[100];
  t.test('opening a program copies it to /library as a protected original', async (p) => {
    await showAll(p);
    await search(p, target.path);
    await p.click(`.pcard[data-path="${target.path}"]`);
    const path = '/library/' + target.path;
    await p.wait(`LG.app.active && LG.app.active.path === ${JSON.stringify(path)}`, 4000);
    p.assert.equal(await p.ev(`LG.app.vfs.readText(${JSON.stringify(path)})`), target.text);
    p.assert.equal(await p.ev(`LG.app.isProtected(${JSON.stringify(path)})`), true);
    p.assert.equal(await p.code(), target.text);
    p.assert.ok(await p.exists('.tab.active .lock') || await p.ev("[...document.querySelectorAll('.lock')].length > 0"), 'the tab shows it is an original');
    // only the one program is copied, not the whole category
    const files = await p.ev(`LG.app.vfs.list('/library/${target.cat}').map((e) => e.name)`);
    p.assert.deepEqual(files, [target.file]);
  }, { fresh: true });
  t.test('an opened program has the cursor at the top and the sheet sets the status line', async (p) => {
    await showAll(p);
    await search(p, target.path);
    await p.click(`.pcard[data-path="${target.path}"]`);
    await p.wait(`LG.app.active && LG.app.active.path === '/library/${target.path}'`, 4000);
    p.assert.deepEqual(await p.ev('[LG.app.active.editor.ta.selectionStart, LG.app.active.editor.ta.selectionEnd]'), [0, 0]);
    p.assert.equal(await p.status(), `Opened /library/${target.path}. Read the comments at the top, then press F5.`);
  }, { fresh: true });
  t.test('opening a program unfolds /library and its category in the Files panel', async (p) => {
    if (!(await p.ev("LG.app.side === 'files'"))) await p.click('#railFiles');
    await showAll(p);
    await search(p, target.path);
    await p.click(`.pcard[data-path="${target.path}"]`);
    const row = `#sideBody .trow[data-path="/library/${target.path}"]`;
    await p.wait(`!!document.querySelector(${JSON.stringify(row)})`, 3000);
    p.assert.equal(await p.attr('#sideBody .trow[data-path="/library"]', 'aria-expanded'), 'true');
    p.assert.equal(await p.attr(`#sideBody .trow[data-path="/library/${target.cat}"]`, 'aria-expanded'), 'true');
    p.assert.ok(await p.visible(row));
    p.assert.match(await p.text('#sideBody .trow[data-path="/library"]'), /originals/);
  }, { fresh: true });
  t.test('the library folder cannot be renamed or deleted from the Files panel', async (p) => {
    await p.ev(`LG.Library.open(LG.app, ${JSON.stringify(target.path)})`);
    await p.wait(`!!document.querySelector('#sideBody .trow[data-path="/library/${target.path}"]')`, 3000);
    await p.rightClick(`#sideBody .trow[data-path="/library/${target.path}"]`);
    await p.wait("!!document.querySelector('.menu-pop')", 2000);
    const items = await p.menuItems();
    p.assert.equal(items.find((i) => i.label === 'Rename…').disabled, true);
    p.assert.equal(items.find((i) => i.label === 'Delete').disabled, true);
    await p.closeMenus();
  }, { fresh: true });
  t.test('opening the same program twice keeps one tab', async (p) => {
    for (let i = 0; i < 2; i++) {
      await showAll(p);
      await search(p, target.path);
      await p.click(`.pcard[data-path="${target.path}"]`);
      await p.waitGone('#libSearch', 3000);
    }
    p.assert.equal(await p.ev(`LG.app.docs.filter((d) => d.path === '/library/${target.path}').length`), 1);
  }, { fresh: true });
  t.test('a damaged copy in /library is put right when the program is opened again', async (p) => {
    const path = '/library/' + target.path;
    await p.ev(`LG.Library.install(LG.app, ${JSON.stringify(target.path)})`);
    await p.wait(`LG.app.vfs.exists(${JSON.stringify(path)})`, 3000);
    await p.ev(`LG.app.vfs.writeText(${JSON.stringify(path)}, 'print "broken', { trusted: true })`);
    await showAll(p);
    await search(p, target.path);
    await p.click(`.pcard[data-path="${target.path}"]`);
    await p.wait(`LG.app.active && LG.app.active.path === ${JSON.stringify(path)}`, 4000);
    p.assert.equal(await p.ev(`LG.app.vfs.readText(${JSON.stringify(path)})`), target.text);
  }, { fresh: true });
  t.test('editing a library program and saving makes a copy in /projects', async (p) => {
    await showAll(p);
    await search(p, target.path);
    await p.click(`.pcard[data-path="${target.path}"]`);
    const orig = '/library/' + target.path;
    await p.wait(`LG.app.active && LG.app.active.path === ${JSON.stringify(orig)}`, 4000);
    await p.ev('LG.app.active.editor.focus()');
    await p.ev('LG.app.active.editor.setCursor(0, 0)');
    await p.type('; my change\n');
    p.assert.equal(await p.ev('LG.app.active.dirty'), true);
    await p.key('s', { ctrl: true });
    await p.waitModal();
    p.assert.equal(await p.modalTitle(), 'Save your own copy');
    const def = '/projects/' + target.file;
    p.assert.equal(await p.ev("document.querySelector('.modal-back:last-child .modal input').value"), def);
    await p.modalButton('OK');
    await p.wait(`LG.app.active.path === ${JSON.stringify(def)}`, 3000);
    p.assert.equal(await p.ev(`LG.app.vfs.readText(${JSON.stringify(def)})`), '; my change\n' + target.text);
    p.assert.equal(await p.ev(`LG.app.vfs.readText(${JSON.stringify(orig)})`), target.text, 'the original is unchanged');
    p.assert.equal(await p.ev('LG.app.active.dirty'), false);
    await p.waitToast(/Saved \/projects\//);
  }, { fresh: true });
  t.test('a library program cannot be saved back into /library', async (p) => {
    await p.ev(`LG.Library.open(LG.app, ${JSON.stringify(target.path)})`);
    await p.wait(`LG.app.active && LG.app.active.path === '/library/${target.path}'`, 4000);
    await p.setCode(target.text + '\nprint 1\n');
    await p.key('s', { ctrl: true });
    await p.waitModal();
    await p.modalInput('/library/' + target.cat + '/mine.lgo');
    await p.modalButton('OK');
    await p.waitToast(/Pick a folder outside/);
    p.assert.equal(await p.ev(`LG.app.vfs.exists('/library/${target.cat}/mine.lgo')`), false);
    p.assert.equal(await p.activePath(), '/library/' + target.path);
  }, { fresh: true });
  t.test('helper files whose names start with _ come along with a program', async (p) => {
    const x = ALL.find((y) => y.cat === 'games');
    // the shipped library has no helpers at the moment, so add one to the unpacked texts
    await p.ev(`(async () => { const t = await LG.Library.load(); t['games/_e2ehelper.lgo'] = 'to helper.e2e\\nprint "helped\\nend\\n'; t['music/_other.lgo'] = 'print 1\\n'; })()`);
    await p.sleep(100);
    await showAll(p);
    await search(p, x.path);
    await p.click(`.pcard[data-path="${x.path}"]`);
    await p.wait(`LG.app.active && LG.app.active.path === '/library/${x.path}'`, 4000);
    p.assert.equal(await p.ev("LG.app.vfs.readText('/library/games/_e2ehelper.lgo')"), 'to helper.e2e\nprint "helped\nend\n');
    p.assert.equal(await p.ev("LG.app.vfs.exists('/library/music/_other.lgo')"), false, 'helpers of other categories stay behind');
    p.assert.equal(await p.ev("LG.app.isProtected('/library/games/_e2ehelper.lgo')"), true);
    await p.command('load "/library/games/_e2ehelper.lgo');
    await p.command('helper.e2e');
    await p.waitOutput(/^helped$/m);
  }, { fresh: true });
  t.test('helper files never show up as cards', async (p) => {
    p.assert.equal(await p.ev("LG.LIBRARY.items.filter((i) => /\\/_/.test(i.path)).length"), 0);
    await showAll(p);
    await search(p, '/_');
    p.assert.equal(await p.count('#libMain .pcard'), 0);
    await search(p, '');
    await closeSheet(p);
  });
  t.test('a program opened from the library runs with F5', async (p) => {
    const x = ALL.find((y) => y.path === 'shapes/' + y.file && /^(clearscreen|cs)\b/m.test(y.text)) || ALL[0];
    await showAll(p);
    await search(p, x.path);
    await p.click(`.pcard[data-path="${x.path}"]`);
    await p.wait(`LG.app.active && LG.app.active.path === '/library/${x.path}'`, 4000);
    await p.key('F5');
    await p.waitOutput(new RegExp('▶ Running ' + x.file.replace(/\./g, '\\.')));
    await p.wait("LG.app.world.segments > 0 || LG.app.interp.state === 'idle'", 8000);
    await p.stopProgram();
    p.assert.notEqual(await p.state(), 'error');
  }, { fresh: true });
  t.test('LG.Library.open with run set starts the program straight away', async (p) => {
    await p.ev(`LG.Library.open(LG.app, ${JSON.stringify(target.path)}, true)`);
    await p.waitOutput(new RegExp('▶ Running ' + target.file.replace(/\./g, '\\.')));
    await p.stopProgram();
  }, { fresh: true });
  t.test('opening a program that is not in the library shows an error toast', async (p) => {
    await p.ev("LG.Library.open(LG.app, 'games/no-such-program.lgo')");
    await p.waitToast(/Could not open that program/);
    p.assert.equal(await p.ev("LG.app.vfs.exists('/library/games/no-such-program.lgo')"), false);
    p.assert.equal(await p.ev("LG.app.docs.some((d) => /no-such-program/.test(d.path))"), false, 'no empty tab is opened');
  }, { fresh: true });

  // ---- small screens -----------------------------------------------------------------------------
  t.test('on a phone the sheet fits the screen and opening a program shows the code', async (p) => {
    await p.menu('Program library');
    await p.wait("!!document.getElementById('libSearch')", 4000);
    p.assert.ok(await p.noHScroll());
    p.assert.ok(await p.visible('#libSearch'));
    const r = await p.rect('.modal');
    p.assert.ok(r.x >= 0 && r.right <= 390 + 1, JSON.stringify(r));
    await search(p, target.path);
    await p.tap(`.pcard[data-path="${target.path}"]`);
    await p.wait(`LG.app.active && LG.app.active.path === '/library/${target.path}'`, 4000);
    p.assert.equal(await p.ev('LG.app.view'), 'code');
  }, { fresh: { width: 390, height: 800, mobile: true, touch: true } });
}
