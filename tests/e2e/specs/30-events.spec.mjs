// The keyboard and mouse as a running program sees them, timers, WAIT and sound.
import { resetWorld, worldToPage, inkNear, show } from './30-world-lib.mjs';

const g = (p, name) => p.ev(`(() => { const v = LG.app.interp.globals.get(${JSON.stringify(name)}); return v === undefined ? null : LG.Data.showText(v); })()`);
const focusWorld = async (p) => {
  // click a corner of the world so no handler position matters, then check the focus
  const r = await p.rect('#worldCanvas');
  await p.clickAt(r.x + 4, r.y + 4);
  p.assert.equal(await p.focusedId(), 'worldCanvas');
};
async function clickWorld(p, wx, wy, button = 'left') {
  const [x, y] = await worldToPage(p, wx, wy);
  await p.clickAt(x, y, { button });
}
const stubTone = (p) => p.ev('(() => { window.__tones = []; LG.app.audio.tone = (f, ms, d) => window.__tones.push([f, ms, d]); })()');

export default function (t) {
  t.beforeEach(async (p) => {
    if (await p.state() !== 'idle') await p.stopProgram();
    await resetWorld(p);
  });
  t.afterEach(async (p) => {
    await p.ev('LG.app.stop(); LG.app.interp.clearHandlers()');
  });

  // ---- READCHAR ------------------------------------------------------------------------------------
  const keys = [
    ['a', 'a'], ['z', 'z'], ['7', '7'], [' ', ' '], ['/', '/'], ['-', '-'],
    ['ArrowLeft', 'LEFT'], ['ArrowRight', 'RIGHT'], ['ArrowUp', 'UP'], ['ArrowDown', 'DOWN'],
    ['Enter', '\n'], ['Escape', '\u001b'], ['Backspace', '\b'], ['Tab', '\t'],
  ];
  for (const [key, want] of keys) {
    t.test(`READCHAR reads the ${JSON.stringify(key)} key pressed in the turtle world`, async (p) => {
      await p.runProgram('make "k readchar\n', { wait: false });
      await p.waitState('input');
      await focusWorld(p);
      await p.key(key);
      await p.waitState('idle');
      p.assert.equal(await p.ev("LG.app.interp.globals.get('k')"), want);
    });
  }
  t.test('READCHAR with Shift gives a capital letter', async (p) => {
    await p.runProgram('make "k readchar\n', { wait: false });
    await p.waitState('input');
    await focusWorld(p);
    await p.key('q', { shift: true });
    await p.waitState('idle');
    p.assert.equal(await p.ev("LG.app.interp.globals.get('k')"), 'Q');
  });
  t.test('a program waiting for a key says so and gives the world the keyboard', async (p) => {
    await p.runProgram('make "k readchar\n', { wait: false });
    await p.waitState('input');
    p.assert.match(await p.status(), /Waiting for a key/);
    p.assert.equal(await p.focusedId(), 'worldCanvas');
    p.assert.equal(await p.ev("document.getElementById('state').textContent"), 'Waiting');
    await p.key('x');
    await p.waitState('idle');
  });
  t.test('a key pressed before READCHAR is read straight away', async (p) => {
    await p.runProgram('wait 30\nmake "k readchar\n', { wait: false });
    await p.waitState('waiting');
    await focusWorld(p);
    await p.key('m');
    await p.waitState('idle', 3000);
    p.assert.equal(await p.ev("LG.app.interp.globals.get('k')"), 'm');
  });
  t.test('READCHARS reads several keys', async (p) => {
    await p.runProgram('make "k readchars 3\n', { wait: false });
    await p.waitState('input');
    await focusWorld(p);
    await p.type('xyz');
    await p.waitState('idle');
    p.assert.equal(await p.ev("LG.app.interp.globals.get('k')"), 'xyz');
  });
  t.test('READCHAR in a loop drives the turtle with the arrows', async (p) => {
    await p.runProgram('repeat 3 [make "k readchar if :k = "UP [fd 20] if :k = "RIGHT [rt 90]]\n', { wait: false });
    await p.waitState('input');
    await focusWorld(p);
    await p.key('ArrowUp');
    await p.key('ArrowRight');
    await p.key('ArrowUp');
    await p.waitState('idle');
    const tt = await p.turtle();
    p.assert.deepEqual([tt.x, tt.y, tt.heading], [20, 20, 90]);
  });
  t.test('keys pressed with Ctrl do not go to the program', async (p) => {
    await p.runProgram('wait 20\nprint keyp\n', { wait: false });
    await focusWorld(p);
    await p.key('b', { ctrl: true });
    await p.waitState('idle');
    await p.waitOutput(/^false$/m);
  });
  t.test('keys pressed while nothing runs are not kept', async (p) => {
    await focusWorld(p);
    await p.key('k');
    p.assert.equal(await p.ev('LG.app.turtleView.keys.length'), 0);
  });
  t.test('a run starts with no keys waiting', async (p) => {
    await p.runProgram('wait 15\n', { wait: false });
    await focusWorld(p);
    await p.key('k');
    await p.waitState('idle');
    await p.runProgram('print keyp\n');
    await p.waitOutput(/^false$/m);
  });

  // ---- KEYP --------------------------------------------------------------------------------------
  t.test('KEYP is false when no key was pressed', async (p) => {
    await p.runProgram('print keyp\n');
    await p.waitOutput(/^false$/m);
  });
  t.test('KEYP is true after a key and does not use it up', async (p) => {
    await p.runProgram('wait 20\nprint keyp\nprint readchar\nprint keyp\n', { wait: false });
    await focusWorld(p);
    await p.key('j');
    await p.waitState('idle', 3000);
    await p.waitOutput(/^true\nj\nfalse$/m);
  });
  t.test('KEYP lets a game loop keep moving until a key comes', async (p) => {
    await p.runProgram('until [keyp] [fd 1 wait 1]\nprint readchar\n', { wait: false });
    await p.sleep(300);
    p.assert.ok((await p.turtle()).y > 3, 'the turtle moved while waiting');
    await focusWorld(p);
    await p.key('ArrowDown');
    await p.waitState('idle');
    await p.waitOutput(/^DOWN$/m);
  });

  // ---- KEYBOARDON ----------------------------------------------------------------------------------
  const kvs = [['a', 65], ['Z', 90], ['5', 53], [' ', 32], ['ArrowLeft', 37], ['ArrowUp', 38], ['ArrowRight', 39], ['ArrowDown', 40], ['Enter', 13], ['Backspace', 8]];
  for (const [key, code] of kvs) {
    t.test(`KEYBOARDON sees ${JSON.stringify(key)} as KEYBOARDVALUE ${code}`, async (p) => {
      await p.command('keyboardon [make "kv keyboardvalue]');
      await focusWorld(p);
      await p.key(key);
      await p.wait(`LG.app.interp.globals.get('kv') === ${code}`, 2000);
    });
  }
  t.test('KEYBOARDON handlers run after the program has finished', async (p) => {
    await p.runProgram('make "n 0\nkeyboardon [make "n :n + 1 fd 10]\n');
    await focusWorld(p);
    await p.type('abc');
    await p.wait("LG.app.interp.globals.get('n') === 3", 2000);
    p.assert.equal((await p.turtle()).y, 30);
  });
  t.test('KEYBOARDON handlers run while a program is running', async (p) => {
    await p.runProgram('make "n 0\nkeyboardon [make "n :n + 1]\nforever [wait 1]\n', { wait: false });
    await p.sleep(100);
    await focusWorld(p);
    await p.type('ab');
    await p.wait("LG.app.interp.globals.get('n') === 2", 2000);
    p.assert.ok(['running', 'waiting'].includes(await p.state()));
  });
  t.test('KEYBOARDON with a second list runs it when the key goes up', async (p) => {
    await p.command('(keyboardon [make "down keyboardvalue] [make "up keyboardvalue])');
    await focusWorld(p);
    await p.key('g');
    await p.wait("LG.app.interp.globals.get('down') === 71 && LG.app.interp.globals.get('up') === 71", 2000);
  });
  t.test('a key handler queued as the program ends still runs and the page goes back to Ready', async (p) => {
    await p.runProgram('make "n 0\nkeyboardon [make "n :n + 1]\nmake "k readchar\n', { wait: false });
    await p.waitState('input');
    await focusWorld(p);
    await p.key('a');
    await p.waitState('idle', 2000);
    await p.wait("LG.app.interp.globals.get('n') === 1", 2000);
    p.assert.equal(await p.ev("document.getElementById('state').textContent"), 'Ready');
    await p.command('print "still-works');
    await p.waitOutput(/^still-works$/m);
  });
  t.test('Escape reaches a KEYBOARDON handler', async (p) => {
    await p.command('keyboardon [make "kv keyboardvalue]');
    await focusWorld(p);
    await p.key('Escape');
    await p.wait("LG.app.interp.globals.get('kv') === 27", 2000);
  });
  t.test('KEYBOARDOFF stops the handler', async (p) => {
    await p.command('make "n 0 keyboardon [make "n :n + 1]');
    await focusWorld(p);
    await p.key('a');
    await p.wait("LG.app.interp.globals.get('n') === 1", 2000);
    await p.command('keyboardoff');
    await focusWorld(p);
    await p.key('a');
    await p.sleep(150);
    p.assert.equal(await g(p, 'n'), '1');
  });
  t.test('Stop turns off the keyboard handler', async (p) => {
    await p.command('make "n 0 keyboardon [make "n :n + 1]');
    await p.key('F5', { shift: true });
    await focusWorld(p);
    await p.key('a');
    await p.sleep(150);
    p.assert.equal(await g(p, 'n'), '0');
  });
  t.test('a new run turns off old keyboard handlers', async (p) => {
    await p.command('keyboardon [make "hit 1]');
    await p.runProgram('make "n 0\n');
    await focusWorld(p);
    await p.key('a');
    await p.sleep(150);
    p.assert.equal(await g(p, 'hit'), null);
  });
  t.test('an error in a key handler is reported', async (p) => {
    await p.command('keyboardon [fd "oops]');
    await focusWorld(p);
    await p.key('a');
    await p.waitOutput(/fd doesn't like oops as input/);
  });

  // ---- MOUSEON -----------------------------------------------------------------------------------------
  const zooms = [['at normal size', 0], ['zoomed in twice', 2], ['zoomed out', -2]];
  for (const [zlabel, clicks] of zooms) {
    for (const [wx, wy] of [[100, 50], [-150, -75], [0, 0]]) {
      t.test(`a left click at ${wx},${wy} ${zlabel} gives that MOUSEPOS and CLICKPOS`, async (p) => {
        for (let i = 0; i < Math.abs(clicks); i++) await p.click(clicks > 0 ? '#tbZoomIn' : '#tbZoomOut');
        if (clicks > 0) await p.command(`pu setxy ${wx} ${wy}`);
        if (clicks > 0) {
          // keep the point on screen by panning it to the middle
          await p.ev(`(() => { const tv = LG.app.turtleView; const v = tv.view; tv.pan = [-(${wx}) * v.k / tv.dpr, (${wy}) * v.k / tv.dpr]; tv.layout(); tv.draw(); })()`);
        }
        await p.command('mouseon [make "d mousepos] [make "c clickpos] [] [] []');
        await clickWorld(p, wx, wy);
        await p.wait("LG.app.interp.globals.get('c') !== undefined", 2000);
        const d = await p.ev("LG.Data.toArray(LG.app.interp.globals.get('d')).map(Number)");
        const c = await p.ev("LG.Data.toArray(LG.app.interp.globals.get('c')).map(Number)");
        const k = await p.ev('LG.app.turtleView.view.k');
        const tol = 1.5 / k;
        p.assert.ok(Math.abs(d[0] - wx) <= tol && Math.abs(d[1] - wy) <= tol, `mousepos ${d} for ${wx},${wy}`);
        p.assert.deepEqual(c, d);
      });
    }
  }
  t.test('a click with the handler moves the turtle there', async (p) => {
    await p.command('mouseon [setpos mousepos] [] [] [] []');
    await clickWorld(p, 120, 80);
    await p.wait('Math.abs(LG.app.world.current.x - 120) < 2 && Math.abs(LG.app.world.current.y - 80) < 2', 2000);
    p.assert.ok((await inkNear(p, 60, 40, 2))[3] > 150, 'it drew a line on the way');
  });
  t.test('the right button runs the right-button lists', async (p) => {
    await p.command('mouseon [make "l 1] [] [make "rd 1] [make "ru 1] []');
    await clickWorld(p, 10, 10, 'right');
    await p.wait("LG.app.interp.globals.get('ru') === 1", 2000);
    p.assert.equal(await g(p, 'rd'), '1');
    p.assert.equal(await g(p, 'l'), null);
  });
  t.test('the left button up list runs on release', async (p) => {
    await p.command('mouseon [make "seq [down]] [make "seq lput "up :seq] [] [] []');
    await clickWorld(p, 0, 0);
    await p.wait("LG.app.interp.globals.get('seq') && LG.Data.showText(LG.app.interp.globals.get('seq')) === '[down up]'", 2000);
  });
  t.test('the move list runs as the mouse moves', async (p) => {
    await p.command('make "moves 0 mouseon [] [] [] [] [make "moves :moves + 1 make "last mousepos]');
    for (const [wx, wy] of [[-50, 0], [0, 20], [60, 40]]) {
      const [x, y] = await worldToPage(p, wx, wy);
      await p.mouse('mouseMoved', x, y);
      await p.sleep(40);
    }
    await p.wait("LG.app.interp.globals.get('moves') >= 2", 2000);
    const last = await p.ev("LG.Data.toArray(LG.app.interp.globals.get('last')).map(Number)");
    p.assert.ok(Math.abs(last[0] - 60) <= 2 && Math.abs(last[1] - 40) <= 2, String(last));
  });
  t.test('BUTTONP is true while the button is down', async (p) => {
    await p.command('mouseon [make "b buttonp make "which button] [make "after buttonp] [] [] []');
    await clickWorld(p, 0, 0);
    await p.wait("LG.app.interp.globals.get('after') !== undefined", 2000);
    p.assert.equal(await g(p, 'b'), 'true');
    p.assert.equal(await g(p, 'which'), '1');
    p.assert.equal(await g(p, 'after'), 'false');
  });
  t.test('BUTTON reports 2 for the right button', async (p) => {
    await p.command('mouseon [] [] [make "which button] [] []');
    await clickWorld(p, 0, 0, 'right');
    await p.wait("LG.app.interp.globals.get('which') !== undefined", 2000);
    p.assert.equal(await g(p, 'which'), '2');
  });
  t.test('BUTTONP is false with no button down', async (p) => {
    p.assert.equal(await show(p, 'buttonp'), 'false');
  });
  t.test('MOUSEPOS follows the mouse even without MOUSEON', async (p) => {
    const [x, y] = await worldToPage(p, -100, 100);
    await p.mouse('mouseMoved', x, y);
    await p.sleep(40);
    const m = /\[(-?[\d.]+) (-?[\d.]+)\]/.exec(await show(p, 'mousepos'));
    p.assert.ok(m && Math.abs(+m[1] + 100) <= 2 && Math.abs(+m[2] - 100) <= 2, String(m));
  });
  t.test('MOUSEOFF stops the handlers', async (p) => {
    await p.command('make "n 0 mouseon [make "n :n + 1] [] [] [] []');
    await clickWorld(p, 0, 0);
    await p.wait("LG.app.interp.globals.get('n') === 1", 2000);
    await p.command('mouseoff');
    await clickWorld(p, 0, 0);
    await p.sleep(150);
    p.assert.equal(await g(p, 'n'), '1');
  });
  t.test('mouse handlers run while a program runs', async (p) => {
    await p.runProgram('make "n 0\nmouseon [make "n :n + 1] [] [] [] []\nforever [wait 1]\n', { wait: false });
    await p.sleep(100);
    await clickWorld(p, 10, 10);
    await clickWorld(p, 20, 20);
    await p.wait("LG.app.interp.globals.get('n') === 2", 2000);
  });
  t.test('with MOUSEON a click does not pan a zoomed world', async (p) => {
    await p.click('#tbZoomIn'); await p.click('#tbZoomIn');
    await p.command('mouseon [] [] [] [] []');
    const v1 = await p.ev('LG.app.turtleView.view.x');
    const [x, y] = await worldToPage(p, 0, 0);
    await p.mouse('mouseMoved', x, y);
    await p.mouse('mousePressed', x, y);
    await p.mouse('mouseMoved', x + 50, y);
    await p.mouse('mouseReleased', x + 50, y);
    p.assert.equal(await p.ev('LG.app.turtleView.view.x'), v1);
  });
  t.test('with MOUSEON the right click menu is held back', async (p) => {
    await p.command('mouseon [] [] [] [] []');
    const prevented = await p.ev("(() => { const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); document.getElementById('worldCanvas').dispatchEvent(e); return e.defaultPrevented; })()");
    p.assert.equal(prevented, true);
  });
  t.test('Stop turns off mouse handlers', async (p) => {
    await p.command('mouseon [make "hit 1] [] [] [] []');
    await p.key('F5', { shift: true });
    await clickWorld(p, 0, 0);
    await p.sleep(150);
    p.assert.equal(await g(p, 'hit'), null);
  });

  // ---- timers -----------------------------------------------------------------------------------------
  t.test('SETTIMER runs its list again and again', async (p) => {
    await p.command('make "n 0 settimer 1 100 [make "n :n + 1]');
    await p.sleep(560);
    const n = +(await g(p, 'n'));
    p.assert.ok(n >= 3 && n <= 7, 'ran ' + n + ' times');
  });
  t.test('CLEARTIMER stops a timer', async (p) => {
    await p.command('make "n 0 settimer 1 50 [make "n :n + 1]');
    await p.wait("LG.app.interp.globals.get('n') >= 2", 2000);
    await p.command('cleartimer 1');
    const n = await g(p, 'n');
    await p.sleep(250);
    p.assert.equal(await g(p, 'n'), n);
  });
  t.test('two timers run side by side', async (p) => {
    await p.command('make "a 0 make "b 0 settimer 1 60 [make "a :a + 1] settimer 2 120 [make "b :b + 1]');
    await p.sleep(650);
    const a = +(await g(p, 'a')), b = +(await g(p, 'b'));
    p.assert.ok(a > b && b >= 2, `${a} ${b}`);
  });
  t.test('setting the same timer again replaces it', async (p) => {
    await p.command('make "a 0 make "b 0 settimer 1 50 [make "a :a + 1] settimer 1 50 [make "b :b + 1]');
    await p.sleep(300);
    p.assert.equal(await g(p, 'a'), '0');
    p.assert.ok(+(await g(p, 'b')) >= 2);
  });
  t.test('Stop cancels every timer', async (p) => {
    await p.command('make "n 0 settimer 1 50 [make "n :n + 1] settimer 2 50 [make "n :n + 1]');
    await p.wait("LG.app.interp.globals.get('n') >= 2", 2000);
    await p.key('F5', { shift: true });
    const n = await g(p, 'n');
    await p.sleep(250);
    p.assert.equal(await g(p, 'n'), n);
    p.assert.equal(await p.ev('LG.app.interp.handlers.timers.size'), 0);
  });
  t.test('the Stop button cancels a timer of a running program', async (p) => {
    await p.runProgram('make "n 0\nsettimer 3 40 [make "n :n + 1]\nforever [wait 1]\n', { wait: false });
    await p.wait("LG.app.interp.globals.get('n') >= 2", 2000);
    await p.click('#tbStop');
    await p.waitState('idle');
    const n = await g(p, 'n');
    await p.sleep(250);
    p.assert.equal(await g(p, 'n'), n);
  });
  t.test('a new run cancels timers from before', async (p) => {
    await p.command('settimer 1 30 [make "old 1]');
    await p.runProgram('make "n 0\n');
    await p.sleep(200);
    p.assert.equal(await g(p, 'old'), null);
  });
  t.test('timer lists run during a long WAIT, not only after it', async (p) => {
    await p.runProgram('make "n 0\nsettimer 1 50 [make "n :n + 1]\nwait 40\n', { wait: false });
    await p.sleep(400);
    p.assert.ok(+(await g(p, 'n')) >= 3, 'ran ' + await g(p, 'n') + ' times during the wait');
    p.assert.ok(['waiting', 'running'].includes(await p.state()));
    await p.waitState('idle', 3000);
  });
  t.test('timers fire while a program waits', async (p) => {
    await p.runProgram('make "n 0\nsettimer 1 50 [make "n :n + 1]\nwait 30\nprint :n\ncleartimer 1\n', { timeout: 4000 });
    const out = await p.output();
    const n = +/^(\d+)$/m.exec(out)[1];
    p.assert.ok(n >= 5 && n <= 12, 'fired ' + n);
  });
  t.test('a timer can draw', async (p) => {
    await p.command('settimer 1 30 [fd 10]');
    await p.wait('LG.app.world.current.y >= 50', 3000);
    await p.command('cleartimer 1');
    p.assert.ok((await inkNear(p, 0, 25))[3] > 150);
  });
  t.test('SETTIMER needs a positive time', async (p) => {
    await p.command('settimer 1 0 [fd 1]');
    await p.waitOutput(/settimer doesn't like 0/);
  });
  t.test('CLEARTIMER of a timer that does not exist is fine', async (p) => {
    await p.command('cleartimer 99');
    p.assert.equal(await p.state(), 'idle');
  });

  // ---- WAIT --------------------------------------------------------------------------------------------
  for (const [ticks, ms] of [[60, 1000], [30, 500], [6, 100], [0, 0], [1.5, 25]]) {
    t.test(`WAIT ${ticks} takes about ${ms} ms`, async (p) => {
      await p.runProgram(`make "t0 timemilli\nwait ${ticks}\nmake "dt timemilli - :t0\n`, { timeout: 5000 });
      const dt = +(await g(p, 'dt'));
      p.assert.ok(dt >= ms - 5 && dt <= ms + 250, `waited ${dt} ms`);
    });
  }
  t.test('WAIT with a negative time is an error', async (p) => {
    await p.runProgram('wait -1\n');
    await p.waitOutput(/wait doesn't like -1/);
  });
  t.test('the page keeps drawing during a WAIT', async (p) => {
    await p.runProgram('repeat 5 [fd 20 wait 6]\n', { wait: false });
    await p.sleep(250);
    const y = (await p.turtle()).y;
    p.assert.ok(y > 0 && y < 100, 'part way ' + y);
    await p.waitState('idle', 3000);
    p.assert.equal((await p.turtle()).y, 100);
  });
  t.test('the pill says Running during a WAIT', async (p) => {
    await p.runProgram('wait 30\n', { wait: false });
    await p.waitState('waiting');
    p.assert.equal(await p.ev("document.getElementById('state').textContent"), 'Running');
    await p.waitState('idle', 3000);
  });

  // ---- sound -------------------------------------------------------------------------------------------
  t.test('TONE plays one note with the given pitch and length', async (p) => {
    await stubTone(p);
    await p.command('tone 440 120');
    p.assert.deepEqual(await p.ev('window.__tones'), [[440, 120, 0]]);
  });
  t.test('TONE waits for the note to finish', async (p) => {
    await stubTone(p);
    await p.runProgram('make "t0 timemilli\ntone 300 300\nmake "dt timemilli - :t0\n');
    const dt = +(await g(p, 'dt'));
    p.assert.ok(dt >= 295 && dt < 600, 'took ' + dt);
  });
  t.test('SOUND plays its notes one after another', async (p) => {
    await stubTone(p);
    await p.command('sound [262 100 330 150 392 200]');
    p.assert.deepEqual(await p.ev('window.__tones'), [[262, 100, 0], [330, 150, 100], [392, 200, 250]]);
  });
  t.test('SOUND waits for the whole tune', async (p) => {
    await stubTone(p);
    await p.runProgram('make "t0 timemilli\nsound [440 100 880 200]\nmake "dt timemilli - :t0\n');
    const dt = +(await g(p, 'dt'));
    p.assert.ok(dt >= 295 && dt < 600, 'took ' + dt);
  });
  t.test('SOUND with an odd number of items is an error', async (p) => {
    await stubTone(p);
    await p.command('sound [440 100 880]');
    await p.waitOutput(/sound doesn't like \[440 100 880\]/);
    p.assert.deepEqual(await p.ev('window.__tones'), []);
  });
  t.test('SOUND of an empty list plays nothing', async (p) => {
    await stubTone(p);
    await p.command('sound []');
    p.assert.deepEqual(await p.ev('window.__tones'), []);
    p.assert.equal(await p.state(), 'idle');
  });
  t.test('TONE with a negative length is an error', async (p) => {
    await stubTone(p);
    await p.command('tone 440 -5');
    await p.waitOutput(/tone doesn't like -5/);
  });
  t.test('TONE with a word that is not a number is an error', async (p) => {
    await stubTone(p);
    await p.command('tone "high 100');
    await p.waitOutput(/tone doesn't like high/);
  });
  t.test('notes in a loop are played in order', async (p) => {
    await stubTone(p);
    await p.runProgram('repeat 3 [tone 440 20 tone 660 20]\n');
    p.assert.deepEqual(await p.ev('window.__tones.map((t) => t[0])'), [440, 660, 440, 660, 440, 660]);
  });
  t.test('Stop during a long note stops the program at once', async (p) => {
    await stubTone(p);
    await p.runProgram('tone 440 5000\nprint "after\n', { wait: false });
    await p.waitState('waiting');
    await p.click('#tbStop');
    await p.waitState('idle', 1000);
    await p.sleep(100);
    p.assert.doesNotMatch(await p.output(), /^after$/m);
  });
}
