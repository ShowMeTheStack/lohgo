// The speed slider: its labels, slow motion animation, step-by-step highlighting and Instant.
import { resetWorld, inkNear } from './30-world-lib.mjs';

const LABELS = ['Step by step', 'Very slow', 'Slow', 'Leisurely', 'Walking', 'Trotting', 'Running', 'Racing', 'Flying', 'Zooming', 'Instant'];
const label = (p) => p.text('#speedBox .lbl');
const execLine = (p) => p.ev("(LG.app.active.editor.inner.querySelector('.ed-gl.exec') || {}).innerText || ''");

/** Move the slider with the keyboard: Home, then ArrowRight n times */
async function setSpeed(p, n) {
  await p.click('#speed');
  await p.key('Home');
  for (let i = 0; i < n; i++) await p.key('ArrowRight');
}

export default function (t) {
  t.beforeEach(async (p) => {
    if (await p.state() !== 'idle') await p.stopProgram();
    await resetWorld(p);
  });
  t.afterEach(async (p) => {
    if (await p.state() !== 'idle') await p.stopProgram();
    await p.ev('LG.app.setSpeed(10)');
  });

  LABELS.forEach((name, i) => {
    t.test(`slider position ${i} is "${name}"`, async (p) => {
      await setSpeed(p, i);
      p.assert.equal(await label(p), name);
      p.assert.equal(await p.ev('LG.app.settings.speed'), i);
      p.assert.equal(await p.ev("document.getElementById('speed').value"), String(i));
    });
  });
  t.test('End jumps to Instant and Home to Step by step', async (p) => {
    await p.click('#speed');
    await p.key('Home');
    p.assert.equal(await label(p), 'Step by step');
    await p.key('End');
    p.assert.equal(await label(p), 'Instant');
  });
  t.test('the slider has a label for screen readers', async (p) => {
    p.assert.equal(await p.attr('#speed', 'aria-label'), 'Turtle speed');
    p.assert.equal(await p.attr('#speed', 'max'), '10');
  });
  t.test('the speed is remembered after a reload', async (p) => {
    await setSpeed(p, 3);
    await p.reload();
    p.assert.equal(await label(p), 'Leisurely');
    p.assert.equal(await p.ev("document.getElementById('speed').value"), '3');
  });
  t.test('a saved speed is used when the page opens', async (p) => {
    await p.fresh({ settings: { speed: 2 } });
    p.assert.equal(await label(p), 'Slow');
    p.assert.equal(await p.ev('LG.app.interp.speedDelay'), 90);
  }, { timeout: 40000 });
  t.test('at Instant the turtle gets there at once', async (p) => {
    await setSpeed(p, 10);
    await p.command('fd 200', { wait: false });
    await p.waitState('idle', 2000);
    p.assert.equal((await p.turtle()).y, 200);
    p.assert.ok((await inkNear(p, 0, 190))[3] > 150);
  });
  t.test('at Slow the turtle walks: its position changes while FD runs', async (p) => {
    await setSpeed(p, 2);
    await p.command('fd 200', { wait: false });
    const seen = [];
    for (let i = 0; i < 6; i++) { await p.sleep(80); seen.push((await p.turtle()).y); }
    await p.waitState('idle', 8000);
    p.assert.ok(seen.some((y) => y > 0 && y < 200), 'part way: ' + seen.join(' '));
    for (let i = 1; i < seen.length; i++) p.assert.ok(seen[i] >= seen[i - 1], 'never goes back: ' + seen.join(' '));
    p.assert.ok(new Set(seen).size >= 3, 'several positions: ' + seen.join(' '));
    p.assert.equal((await p.turtle()).y, 200);
  }, { timeout: 15000 });
  t.test('at Slow the line grows as the turtle walks', async (p) => {
    await setSpeed(p, 2);
    await p.command('fd 200', { wait: false });
    await p.wait('LG.app.world.current.y > 20 && LG.app.world.current.y < 120', 4000);
    p.assert.ok((await inkNear(p, 0, 10))[3] > 150, 'behind the turtle');
    p.assert.equal((await inkNear(p, 0, 190, 2))[3], 0, 'not yet ahead of it');
    await p.waitState('idle', 8000);
    p.assert.ok((await inkNear(p, 0, 190))[3] > 150);
  }, { timeout: 15000 });
  t.test('at Very slow turning is animated too', async (p) => {
    await setSpeed(p, 1);
    await p.command('rt 180', { wait: false });
    await p.wait('LG.app.world.current.heading > 10 && LG.app.world.current.heading < 170', 3000);
    await p.waitState('idle', 6000);
    p.assert.equal((await p.turtle()).heading, 180);
  }, { timeout: 15000 });
  t.test('the position chip changes during a slow walk', async (p) => {
    await setSpeed(p, 2);
    await p.command('fd 200', { wait: false });
    await p.sleep(150);
    const a = await p.text('#turtleChip');
    await p.sleep(200);
    const b = await p.text('#turtleChip');
    p.assert.notEqual(a, b);
    await p.waitState('idle', 8000);
  }, { timeout: 15000 });
  t.test('faster speeds finish sooner', async (p) => {
    const timeIt = async (n) => {
      await p.ev(`LG.app.setSpeed(${n})`);
      await p.command('cs', {});
      const t0 = Date.now();
      await p.command('fd 300', { timeout: 15000 });
      return Date.now() - t0;
    };
    const slow = await timeIt(3);
    const fast = await timeIt(7);
    const instant = await timeIt(10);
    p.assert.ok(slow > fast && fast > instant, `${slow} ${fast} ${instant}`);
    p.assert.ok(slow > 500, 'leisurely is visibly slow: ' + slow);
  }, { timeout: 30000 });
  t.test('slow speeds wait between instructions', async (p) => {
    await p.ev('LG.app.setSpeed(3)');
    const t0 = Date.now();
    await p.runProgram('repeat 20 [make "x 1]\n', { timeout: 10000 });
    const ms = Date.now() - t0;
    p.assert.ok(ms >= 20 * 30, 'took ' + ms);
  }, { timeout: 15000 });
  t.test('changing the speed during a run takes effect', async (p) => {
    await setSpeed(p, 1);
    await p.command('fd 400', { wait: false });
    await p.sleep(200);
    p.assert.ok((await p.turtle()).y < 400);
    await p.ev("document.getElementById('speed').focus()");
    await p.key('End');
    p.assert.equal(await label(p), 'Instant');
    await p.waitState('idle', 3000);
    p.assert.equal((await p.turtle()).y, 400);
  }, { timeout: 15000 });
  t.test('Stop halts a slow walk at once', async (p) => {
    await setSpeed(p, 2);
    await p.command('fd 300', { wait: false });
    await p.sleep(200);
    await p.click('#tbStop');
    const y = (await p.turtle()).y;
    await p.sleep(300);
    p.assert.equal((await p.turtle()).y, y);
    p.assert.ok(y < 300);
  });

  // ---- step by step highlighting --------------------------------------------------------------------
  t.test('Step by step lights up each line in turn', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'make "a 1\nmake "b 2\nmake "c 3\n');
    await setSpeed(p, 0);
    await p.key('F5');
    const seen = new Set();
    const t0 = Date.now();
    while (Date.now() - t0 < 4000 && await p.state() !== 'idle') {
      const l = await execLine(p);
      if (l) seen.add(l);
      await p.sleep(60);
    }
    p.assert.deepEqual([...seen].sort(), ['1', '2', '3']);
  }, { timeout: 15000 });
  t.test('the light goes out when the program ends', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'make "a 1\n');
    await setSpeed(p, 0);
    await p.key('F5');
    await p.wait("!!LG.app.active.editor.inner.querySelector('.ed-gl.exec')", 3000);
    await p.waitState('idle', 4000);
    await p.sleep(50);
    p.assert.equal(await execLine(p), '');
  }, { timeout: 15000 });
  t.test('Step by step shows lines inside procedures', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'to two\nmake "x 1\nmake "y 2\nend\ntwo\n');
    await setSpeed(p, 0);
    await p.key('F5');
    const seen = new Set();
    const t0 = Date.now();
    while (Date.now() - t0 < 5000 && await p.state() !== 'idle') {
      const l = await execLine(p);
      if (l) seen.add(l);
      await p.sleep(60);
    }
    p.assert.ok(seen.has('2') && seen.has('3'), 'lines seen: ' + [...seen].join(','));
  }, { timeout: 15000 });
  t.test('Very slow lights up lines too', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'make "a 1\nmake "b 2\nmake "c 3\nmake "d 4\n');
    await setSpeed(p, 1);
    await p.key('F5');
    await p.wait("!!LG.app.active.editor.inner.querySelector('.ed-gl.exec')", 3000);
    await p.waitState('idle', 5000);
  }, { timeout: 15000 });
  t.test('at Slow and faster no line is lit', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'repeat 8 [make "a 1]\n');
    await setSpeed(p, 2);
    await p.key('F5');
    let lit = false;
    while (await p.state() !== 'idle') { if (await execLine(p)) lit = true; await p.sleep(40); }
    p.assert.equal(lit, false);
  }, { timeout: 15000 });
  t.test('Stop during step by step takes the light away', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'forever [make "a 1]\n');
    await setSpeed(p, 0);
    await p.key('F5');
    await p.wait("!!LG.app.active.editor.inner.querySelector('.ed-gl.exec')", 3000);
    await p.key('F5', { shift: true });
    await p.waitState('idle');
    p.assert.equal(await execLine(p), '');
  }, { timeout: 15000 });
  t.test('Pause during step by step keeps the line shown', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'forever [make "a 1]\n');
    await setSpeed(p, 0);
    await p.key('F5');
    await p.sleep(300);
    await p.click('#tbPause');
    await p.waitState('paused', 3000);
    p.assert.equal(await execLine(p), '1');
  }, { timeout: 15000 });
}
