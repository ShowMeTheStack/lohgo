// The Learn sheet: units with counts, lesson rows, progress, Carry on / Start lesson 1, forgetting
// progress, starting lessons from rows, and #lesson=<id> links.
import { LESSONS, popup } from './60-learn-lib.mjs';
import { lessonSteps } from './60-steps-lib.mjs';

const UNITS = [...new Set(LESSONS.map((l) => l.unit))];
const firstTitle = (i) => lessonSteps(i)[0].title;

async function openLearn(p) {
  await p.click('#railLearn');
  const title = await p.waitModal();
  p.assert.equal(title, 'Learn Logo');
}
const navItems = (p) => p.ev("[...document.querySelectorAll('.modal .sheet-nav .nav-item')].map(e => ({ unit: e.children[0].textContent, n: e.querySelector('.n').textContent, active: e.classList.contains('active') }))");
const rows = (p) => p.ev("[...document.querySelectorAll('#learnMain .lesson-row')].map(r => ({ id: r.id, num: r.querySelector('.num').textContent, t: r.querySelector('.t').textContent, s: r.querySelector('.s').textContent, level: r.querySelector('.tagc').textContent, min: r.querySelector('.muted').textContent, done: r.classList.contains('done') }))");
const setDone = (p, ids) => p.fn((ids) => LG.UI.storage.set('lessonsDone', ids), ids);
const progress = (p) => p.ev("document.querySelector('.modal .sheet-nav > div:first-child').textContent");

async function expectLesson(p, idx) {
  await p.wait(`LG.Tours.active && LG.Tours.active.tour.label === 'Lesson ${idx + 1}' && !!document.querySelector('.tour-pop h3')`, 5000);
  const pp = await popup(p);
  p.assert.equal(pp.step, `Lesson ${idx + 1} · 1 of ${lessonSteps(idx).length}`);
  p.assert.equal(pp.title, firstTitle(idx));
  p.assert.equal(await p.modalOpen(), false, 'the sheet closes');
}

export default function (t) {
  t.test('Learn on the rail opens the sheet with every unit and a count', async (p) => {
    await openLearn(p);
    p.assert.match(await p.modalText(), new RegExp(LESSONS.length + ' lessons, from the first FORWARD'));
    const nav = await navItems(p);
    p.assert.deepEqual(nav.map((x) => x.unit), UNITS);
    p.assert.deepEqual(nav.map((x) => x.n), UNITS.map((u) => '0/' + LESSONS.filter((l) => l.unit === u).length));
    p.assert.equal(nav.filter((x) => x.active).length, 1);
    p.assert.ok(nav[0].active, 'the first unit is open at first');
    p.assert.equal(await progress(p), `0% done · 0 of ${LESSONS.length}`);
    p.assert.deepEqual(await p.texts('.modal-back:last-child .modal-foot button'), ['Close', 'Forget my progress', 'Start lesson 1']);
    await p.modalButton('Close');
    p.assert.equal(await p.modalOpen(), false);
  }, { fresh: true });

  t.test('the main menu opens the Learn sheet too', async (p) => {
    await p.menu('Learn Logo (lessons)');
    p.assert.equal(await p.waitModal(), 'Learn Logo');
    await p.modalButton('Close');
  }, { fresh: true });

  for (const u of UNITS) {
    t.test(`unit "${u}" lists its lessons with number, title, summary, level and minutes`, async (p) => {
      await openLearn(p);
      await p.click('.modal .sheet-nav .nav-item', u);
      const nav = await navItems(p);
      p.assert.ok(nav.find((x) => x.unit === u).active, 'the unit is highlighted');
      p.assert.equal(await p.text('#learnMain h4'), u);
      const want = LESSONS.map((l, i) => ({ l, i })).filter((x) => x.l.unit === u).map(({ l, i }) => ({
        id: 'lesson-' + l.id, num: String(i + 1), t: l.title, s: l.summary, level: l.level, min: (l.minutes || 5) + ' min', done: false,
      }));
      const got = await rows(p);
      p.assert.equal(got.length, want.length);
      got.forEach((r, k) => p.assert.deepEqual(r, want[k]));
      await p.modalButton('Close');
    }, { fresh: true });
  }

  t.test('Start lesson 1 starts the first lesson', async (p) => {
    await openLearn(p);
    await p.modalButton('Start lesson 1');
    await expectLesson(p, 0);
  }, { fresh: true });

  t.test('progress shows ticks, counts and a percentage, and Carry on goes to the first lesson not done', async (p) => {
    const done = LESSONS.slice(0, 5).map((l) => l.id).concat([LESSONS[7].id]);
    await setDone(p, done);
    await openLearn(p);
    const pct = Math.round(done.length / LESSONS.length * 100);
    p.assert.equal(await progress(p), `${pct}% done · ${done.length} of ${LESSONS.length}`);
    const nav = await navItems(p);
    for (const x of nav) {
      const ls = LESSONS.filter((l) => l.unit === x.unit);
      p.assert.equal(x.n, ls.filter((l) => done.includes(l.id)).length + '/' + ls.length, x.unit);
    }
    await p.click('.modal .sheet-nav .nav-item', UNITS[0]);
    for (const r of await rows(p)) {
      const id = r.id.slice(7);
      const isDone = done.includes(id);
      p.assert.equal(r.done, isDone, id);
      p.assert.equal(r.num, isDone ? '✓' : String(LESSONS.findIndex((l) => l.id === id) + 1));
    }
    p.assert.deepEqual(await p.texts('.modal-back:last-child .modal-foot button'), ['Close', 'Forget my progress', 'Carry on']);
    await p.modalButton('Carry on');
    await expectLesson(p, 5);
  }, { fresh: true });

  t.test('Forget my progress asks first; Cancel keeps the ticks', async (p) => {
    await setDone(p, [LESSONS[0].id, LESSONS[1].id]);
    await openLearn(p);
    await p.modalButton('Forget my progress');
    p.assert.equal(await p.waitModal(), 'Forget progress?');
    p.assert.match(await p.modalText(), /Clear the tick marks on every lesson\?/);
    await p.modalButton('Cancel');
    p.assert.deepEqual(await p.ev("LG.UI.storage.get('lessonsDone', [])"), [LESSONS[0].id, LESSONS[1].id]);
  }, { fresh: true });

  t.test('Forget my progress clears every tick after Forget', async (p) => {
    await setDone(p, [LESSONS[0].id, LESSONS[1].id]);
    await openLearn(p);
    await p.modalButton('Forget my progress');
    p.assert.equal(await p.waitModal(), 'Forget progress?');
    await p.modalButton('Forget');
    p.assert.deepEqual(await p.ev("LG.UI.storage.get('lessonsDone', [])"), []);
    await openLearn(p);
    p.assert.equal(await progress(p), `0% done · 0 of ${LESSONS.length}`);
    p.assert.equal(await p.count('#learnMain .lesson-row.done'), 0);
    p.assert.equal(await p.text('.modal-back:last-child .modal-foot button.primary'), 'Start lesson 1');
    await p.modalButton('Close');
  }, { fresh: true });

  t.test('the sheet opens on the unit of the last lesson started', async (p) => {
    const idx = 30;
    await p.ev(`LG.Lessons.start(LG.app, ${idx})`);
    await p.sleep(200);
    await openLearn(p);
    p.assert.ok(await p.wait('!LG.Tours.active', 2000), 'opening the sheet ends the running lesson');
    const nav = await navItems(p);
    p.assert.equal(nav.find((x) => x.active).unit, LESSONS[idx].unit);
    p.assert.ok(await p.exists('#lesson-' + LESSONS[idx].id));
    await p.modalButton('Close');
  }, { fresh: true });

  t.test('Enter on a focused lesson row starts it', async (p) => {
    await openLearn(p);
    await p.click('.modal .sheet-nav .nav-item', LESSONS[12].unit);
    await p.ev(`document.getElementById('lesson-${LESSONS[12].id}').focus()`);
    await p.key('Enter');
    await expectLesson(p, 12);
  }, { fresh: true });

  t.test('finishing a lesson ticks it in the sheet', async (p) => {
    // lesson 1 is the welcome tour: click through to the end
    await p.ev('LG.Lessons.start(LG.app, 0)');
    await p.wait("!!document.querySelector('.tour-pop h3')", 3000);
    const n = lessonSteps(0).length;
    for (let j = 0; j < n; j++) {
      if (j === 3) { await p.click('#cmdInput'); await p.insertText('repeat 4 [fd 100 rt 90]'); await p.key('Enter'); await p.wait('LG.Tours.active.i === 4', 5000); continue; }
      await p.click('#tourNext');
    }
    await p.wait("LG.Tours.active && LG.Tours.active.tour.label === 'Lesson 2'", 3000);
    await openLearn(p);
    await p.click('.modal .sheet-nav .nav-item', LESSONS[0].unit);
    const r = (await rows(p)).find((x) => x.id === 'lesson-' + LESSONS[0].id);
    p.assert.equal(r.done, true);
    p.assert.equal(r.num, '✓');
    p.assert.equal((await navItems(p)).find((x) => x.unit === LESSONS[0].unit).n, '1/' + LESSONS.filter((l) => l.unit === LESSONS[0].unit).length);
    await p.modalButton('Close');
  }, { fresh: true });

  t.test('the Learn sheet fits a phone', async (p) => {
    await p.tap('#mtab-more');
    await p.wait("!!document.querySelector('.menu-pop')", 3000);
    await p.tap('.menu-pop .menu-item', 'Learn Logo');
    p.assert.equal(await p.waitModal(), 'Learn Logo');
    p.assert.ok(await p.noHScroll());
    const r = await p.rect('.modal');
    p.assert.ok(r.x >= 0 && r.right <= 391);
    await p.tap('#learnMain .lesson-row');
    await expectLesson(p, 0);
  }, { fresh: { width: 390, height: 844, mobile: true, touch: true } });

  // every lesson can be started from its row, and from a #lesson= link
  LESSONS.forEach((l, i) => {
    t.test(`clicking the row of lesson ${i + 1} (${l.id}) starts it`, async (p) => {
      await p.ev('LG.Tours.stop()');
      await openLearn(p);
      await p.click('.modal .sheet-nav .nav-item', l.unit);
      await p.click('#lesson-' + l.id);
      await expectLesson(p, i);
      await p.ev('LG.Tours.stop(); LG.app.isBusy() && LG.app.stop()');
    }, { fresh: i === 0 });
  });
  LESSONS.forEach((l, i) => {
    t.test(`#lesson=${l.id} in the address starts lesson ${i + 1}`, async (p) => {
      await expectLesson(p, i);
      p.assert.equal(await p.ev("LG.UI.storage.get('lessonLast', null)"), l.id);
    }, { fresh: { hash: 'lesson=' + l.id } });
  });
}
