// Guided tours: the welcome tour on a first visit, the Tours menu, every step of every tour
// (title, counter, spotlight, buttons, and the hands-on steps done for real), and phones.
import { TOURS, popup, htmlText, spotCheck, settle } from './60-learn-lib.mjs';
import { TOUR_SOLVE } from './60-steps-lib.mjs';

const IDS = Object.keys(TOURS);
// on a phone the rail and the step buttons are gone: those steps point at the tab bar, and the speed slider does not exist
const PHONE = { '#railFiles': '#mtab-files', '#rail': '#mbar', '#debugGroup': '#mtab-more', '#speed': null };

const visibleAny = (p, sel) => p.fn((sel) => [...document.querySelectorAll(sel)].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight && getComputedStyle(e).visibility !== 'hidden'; }), sel);

async function startTour(p, id) {
  await p.ev(`LG.Tours.start(LG.app, ${JSON.stringify(id)})`);
  await p.wait(`LG.Tours.active && LG.Tours.active.id === ${JSON.stringify(id)} && !!document.querySelector('.tour-pop h3')`, 4000);
  await p.sleep(80);
}

async function cleanup(p) {
  await p.ev('LG.Tours.stop()');
  if (await p.ev('LG.app.interp.state !== "idle"')) { await p.ev('LG.app.stop()'); await settle(p, { timeout: 4000 }); }
  await p.ev('LG.app.clearBreakpoints && LG.app.clearBreakpoints()');
}

/** Is the tour on step j of tour id? */
const at = (id, j) => `LG.Tours.active && LG.Tours.active.id === ${JSON.stringify(id)} && LG.Tours.active.i === ${j}`;

async function reach(p, id, j) {
  if (await p.ev(at(id, j))) return;
  await p.fresh();
  await startTour(p, id);
  for (let k = 0; k < j; k++) {
    const s = TOURS[id].steps[k];
    if (s.wait) await TOUR_SOLVE[id + ':' + k](p);
    else await p.click('#tourNext');
    await p.wait(at(id, k + 1), 6000);
    await p.sleep(60);
  }
}

export default function (t) {
  // ---- first visit -------------------------------------------------------------------------------------
  t.test('the welcome tour starts by itself on a first visit', async (p) => {
    await p.wait("!!document.querySelector('.tour-pop h3')", 4000);
    const pp = await popup(p);
    p.assert.equal(pp.tour, 'Welcome to Lohgo');
    p.assert.equal(pp.step, 'Welcome to Lohgo · 1 of ' + TOURS.welcome.steps.length);
    p.assert.equal(pp.title, 'Welcome!');
    p.assert.ok(await p.exists('.tour-spot'), 'the page is dimmed behind the popup');
    // it only happens once
    await p.reload();
    await p.sleep(1200);
    p.assert.equal(await p.exists('.tour-pop'), false, 'the tour does not come back on the next visit');
  }, { fresh: { firstRun: true } });

  t.test('#notour keeps the welcome tour away on a first visit', async (p) => {
    await p.sleep(1500);
    p.assert.equal(await p.exists('.tour-pop'), false);
    p.assert.equal(await p.exists('.tour-spot'), false);
  }, { fresh: { firstRun: true, hash: 'notour' } });

  t.test('a returning visitor gets no tour', async (p) => {
    await p.sleep(1200);
    p.assert.equal(await p.exists('.tour-pop'), false);
  }, { fresh: true });

  // ---- the Tours menu ---------------------------------------------------------------------------------------
  t.test('the Tours rail button lists every tour and the lessons', async (p) => {
    await p.click('#railTours');
    await p.wait("!!document.querySelector('.menu-pop')", 3000);
    const items = await p.texts('.menu-pop .menu-item');
    p.assert.deepEqual(items, [...IDS.map((id) => TOURS[id].title), 'All the lessons…']);
    await p.closeMenus();
  }, { fresh: true });

  for (const id of IDS) {
    t.test(`the Tours menu starts "${TOURS[id].title}"`, async (p) => {
      await p.click('#railTours');
      await p.wait("!!document.querySelector('.menu-pop')", 3000);
      await p.click('.menu-pop .menu-item', TOURS[id].title);
      await p.wait("!!document.querySelector('.tour-pop h3')", 3000);
      const pp = await popup(p);
      p.assert.equal(pp.tour, TOURS[id].title);
      p.assert.equal(pp.step, `${TOURS[id].title} · 1 of ${TOURS[id].steps.length}`);
      p.assert.equal(pp.title, TOURS[id].steps[0].title);
      p.assert.equal(await p.exists('.menu-pop'), false, 'the menu closes');
      await cleanup(p);
    });
  }

  t.test('All the lessons… in the Tours menu opens the Learn sheet', async (p) => {
    await p.click('#railTours');
    await p.wait("!!document.querySelector('.menu-pop')", 3000);
    await p.click('.menu-pop .menu-item', 'All the lessons');
    p.assert.equal(await p.waitModal(), 'Learn Logo');
    await p.modalButton('Close');
  }, { fresh: true });

  t.test('the main menu has Guided tours, which opens the same list', async (p) => {
    await p.menu('Guided tours');
    await p.wait("!!document.querySelector('.menu-pop')", 3000);
    p.assert.deepEqual(await p.texts('.menu-pop .menu-item'), [...IDS.map((id) => TOURS[id].title), 'All the lessons…']);
    await p.closeMenus();
  }, { fresh: true });

  // ---- buttons ----------------------------------------------------------------------------------------------------
  t.test('Next and Back move through the welcome tour; Back is off on the first step', async (p) => {
    await startTour(p, 'welcome');
    let pp = await popup(p);
    p.assert.equal(pp.backDisabled, true);
    await p.click('#tourNext');
    pp = await popup(p);
    p.assert.equal(pp.i, 1);
    p.assert.equal(pp.title, TOURS.welcome.steps[1].title);
    p.assert.equal(pp.backDisabled, false);
    await p.click('#tourNext');
    p.assert.equal((await popup(p)).i, 2);
    await p.click('#tourBack');
    pp = await popup(p);
    p.assert.equal(pp.i, 1);
    p.assert.equal(pp.title, TOURS.welcome.steps[1].title);
    await p.click('#tourBack');
    p.assert.equal((await popup(p)).i, 0);
    await cleanup(p);
  }, { fresh: true });

  t.test('Close ends a tour and removes the spotlight', async (p) => {
    await startTour(p, 'welcome');
    await p.click('#tourNext');
    await p.click('#tourClose');
    p.assert.equal(await p.exists('.tour-pop'), false);
    p.assert.equal(await p.exists('.tour-spot'), false);
    p.assert.equal(await p.ev('LG.Tours.active'), null);
  }, { fresh: true });

  t.test('Skip moves past a hands-on step without doing it', async (p) => {
    await startTour(p, 'welcome');
    for (let k = 0; k < 3; k++) await p.click('#tourNext');
    let pp = await popup(p);
    p.assert.equal(pp.i, 3);
    p.assert.equal(pp.next, 'Skip');
    await p.click('#tourNext');
    pp = await popup(p);
    p.assert.equal(pp.i, 4);
    p.assert.equal(pp.next, 'Next');
    await cleanup(p);
  }, { fresh: true });

  t.test('the spotlight follows its element when the window is resized', async (p) => {
    await startTour(p, 'welcome');
    await p.click('#tourNext');
    await p.click('#tourNext');
    await spotCheck(p, '#cmdCard');
    await p.viewport(1100, 760);
    await spotCheck(p, '#cmdCard');
    await p.viewport(1400, 900);
    await spotCheck(p, '#cmdCard');
    await cleanup(p);
  }, { fresh: true });

  t.test('starting one tour replaces another', async (p) => {
    await startTour(p, 'welcome');
    await startTour(p, 'turtle');
    p.assert.equal(await p.count('.tour-pop'), 1);
    p.assert.equal(await p.count('.tour-spot'), 1);
    p.assert.equal((await popup(p)).tour, TOURS.turtle.title);
    await cleanup(p);
  }, { fresh: true });

  // ---- every step of every tour -----------------------------------------------------------------------------
  for (const id of IDS) {
    const tour = TOURS[id];
    const n = tour.steps.length;
    tour.steps.forEach((s, j) => {
      const last = j === n - 1;
      t.test(`tour ${id} step ${j + 1}/${n}: ${s.title}`, async (p) => {
        const A = p.assert;
        await reach(p, id, j);
        const pp = await popup(p);
        A.equal(pp.step, `${tour.title} · ${j + 1} of ${n}`);
        A.equal(pp.title, s.title);
        A.equal(pp.txt.replace(/\s+/g, ' '), (await htmlText(p, s.text)).replace(/\s+/g, ' '));
        A.equal(pp.backDisabled, j === 0);
        A.equal(await p.ev("document.querySelector('.tour-pop').getAttribute('role')"), 'dialog');
        if (s.sel) A.ok(await visibleAny(p, s.sel), s.sel + ' is on screen');
        await spotCheck(p, s.sel);
        if (s.wait) {
          A.equal(pp.wait, s.waitText);
          A.equal(pp.next, last ? 'Finish' : 'Skip');
          await p.ev('(window.__done = [], LG.Tours.active.tour.onStepDone = (a, st) => window.__done.push(st.i))');
          await TOUR_SOLVE[id + ':' + j](p);
          await p.wait(`window.__done.includes(${j})`, 8000);
          const now = await popup(p);
          if (now.i === j) { A.equal(now.wait, 'Done!'); A.equal(now.next, 'Next'); }
          await p.wait(at(id, j + 1), 4000);
          // the tour object is shared, so take the test hook off again
          await p.ev('delete LG.Tours.active.tour.onStepDone');
          return;
        }
        if (!last) {
          A.equal(pp.next, 'Next');
          await p.click('#tourNext');
          await p.wait(at(id, j + 1), 3000);
          return;
        }
        A.equal(pp.next, 'Finish');
        await p.click('#tourNext');
        A.equal(await p.exists('.tour-pop'), false, 'Finish closes the tour');
        A.equal(await p.exists('.tour-spot'), false);
        await cleanup(p);
      }, { timeout: 90000 });
    });
  }

  // things the hands-on steps leave behind
  t.test('the first-program tour leaves a working SQUARE with a size', async (p) => {
    await reach(p, 'first', 5);
    p.assert.match(await p.code(), /to square :size/);
    p.assert.equal(await p.activePath(), '/projects/tour/first.lgo');
    p.assert.ok(await p.ev("LG.app.interp.procs.has('square')"));
    p.assert.ok(await p.segments() >= 8);
    await cleanup(p);
  }, { timeout: 90000 });

  t.test('the debugger tour stops at the breakpoint with :n in the Variables tab', async (p) => {
    await reach(p, 'debug', 3);
    p.assert.equal(await p.state(), 'paused');
    p.assert.equal(await p.activePath(), '/projects/tour/countdown.lgo');
    await p.inspector('vars');
    p.assert.match(await p.paneText('vars'), /\bn\b[\s\S]*5/);
    await cleanup(p);
  }, { timeout: 90000 });

  // ---- phones ----------------------------------------------------------------------------------------------------
  for (const id of IDS) {
    t.test(`on a phone, the ${id} tour switches views so each spotlighted part is visible`, async (p) => {
      await startTour(p, id);
      const tour = TOURS[id];
      for (let j = 0; j < tour.steps.length; j++) {
        const s = tour.steps[j];
        await p.wait(at(id, j), 4000);
        await p.sleep(320);
        const sel = s.sel && (s.sel in PHONE ? PHONE[s.sel] : s.sel);
        if (sel) p.assert.ok(await visibleAny(p, sel), `step ${j + 1}: ${sel} visible in view ${await p.ev('LG.app.view')}`);
        await spotCheck(p, sel);
        p.assert.ok(await p.noHScroll(), 'no sideways scrolling');
        const pr = await p.rect('.tour-pop');
        p.assert.ok(pr.x >= 0 && pr.right <= 391, 'the popup fits the phone');
        if (j < tour.steps.length - 1) await p.tap('#tourNext');
      }
      await p.tap('#tourNext');
      p.assert.equal(await p.exists('.tour-pop'), false);
      await cleanup(p);
    }, { fresh: { width: 390, height: 844, mobile: true, touch: true }, timeout: 60000 });
  }
}
