// Pens and colours: pen up/down/erase/reverse, pen colours in every form, pen size, the background,
// CLEAN and CLEARSCREEN, WRAP/WINDOW/FENCE and the palette. Checked by reading pixels back.
import { resetWorld, inkNear, inkCount, colorCount, totalInk, show, screenPx, near, px } from './30-world-lib.mjs';

const PALETTE = [
  [0, 0, 0], [0, 0, 255], [0, 255, 0], [0, 255, 255], [255, 0, 0], [255, 0, 255], [255, 255, 0], [255, 255, 255],
  [155, 96, 59], [197, 136, 18], [100, 162, 64], [120, 187, 187], [255, 149, 119], [144, 113, 208], [255, 163, 0], [183, 183, 183],
];
const NAMES = ['black', 'blue', 'green', 'cyan', 'red', 'magenta', 'yellow', 'white', 'brown', 'tan', 'forest', 'aqua', 'salmon', 'purple', 'orange', 'grey'];

export default function (t) {
  t.beforeEach(async (p) => { await resetWorld(p); });

  // ---- pen colours -------------------------------------------------------------------------------
  PALETTE.forEach((rgb, i) => {
    t.test(`SETPC ${i} draws in ${NAMES[i]}`, async (p) => {
      await p.command(`setpensize 4 setpc ${i} fd 100`);
      const c = await px(p, 0, 50);
      p.assert.ok(near(c, rgb, 12) && c[3] === 255, `${c} vs ${rgb}`);
    });
  });
  NAMES.forEach((name, i) => {
    t.test(`SETPC "${name} uses colour ${i}`, async (p) => {
      await p.command(`setpensize 4 setpc "${name} rt 90 fd 100`);
      p.assert.ok(near(await px(p, 50, 0), PALETTE[i], 12));
    });
  });
  const css = [['"gray', [183, 183, 183]], ['"skyblue', [135, 206, 235]], ['"navy', [0, 0, 128]], ['"Gold', [255, 215, 0]],
    ['"#ff8800', [255, 136, 0]], ['"#0f0', [0, 255, 0]], ['"#123456', [18, 52, 86]],
    ['[10 200 30]', [10, 200, 30]], ['[300 -5 128]', [255, 0, 128]], ['[127.6 0 0]', [128, 0, 0]]];
  for (const [c, rgb] of css) {
    t.test(`SETPC ${c} draws in rgb ${rgb.join(' ')}`, async (p) => {
      await p.command(`setpensize 4 setpc ${c} fd 100`);
      p.assert.ok(near(await px(p, 0, 50), rgb, 12), String(await px(p, 0, 50)));
    });
  }
  const reported = [['4', '4'], ['"red', 'red'], ['"RED', 'red'], ['[10 20 30]', '[10 20 30]'], ['"#ff8800', '#ff8800'], ['"skyblue', 'skyblue']];
  for (const [c, want] of reported) {
    t.test(`PENCOLOR after SETPC ${c} is ${want}`, async (p) => {
      await p.command(`setpc ${c}`);
      p.assert.equal(await show(p, 'pencolor'), want);
    });
  }
  t.test('PENCOLOR starts as 0', async (p) => { p.assert.equal(await show(p, 'pc'), '0'); });
  for (const bad of ['"notacolour', '[1 2]', '[a b c]', '-1']) {
    t.test(`SETPC ${bad} is refused`, async (p) => {
      await p.command(`setpc ${bad}`);
      await p.waitOutput(/setpc doesn't like/i);
      p.assert.equal(await show(p, 'pc'), '0');
    });
  }
  t.test('SETCOLOR is another name for SETPENCOLOR', async (p) => {
    await p.command('setpensize 4 setcolor 2 fd 50');
    p.assert.ok(near(await px(p, 0, 25), [0, 255, 0], 12));
  });
  t.test('changing colour part way keeps earlier lines', async (p) => {
    await p.command('setpensize 4 setpc 4 fd 50 setpc 1 fd 50');
    p.assert.ok(near(await px(p, 0, 25), [255, 0, 0], 12));
    p.assert.ok(near(await px(p, 0, 75), [0, 0, 255], 12));
  });
  t.test('the turtle shell on screen shows the pen colour', async (p) => {
    await p.command('setpc 4');
    const c = await screenPx(p, 0, 0);
    p.assert.ok(c[0] > 150 && c[1] < 120, 'centre of the turtle ' + c);
  });

  // ---- pen size --------------------------------------------------------------------------------
  t.test('SETPENSIZE 8 makes a line about 8 steps wide', async (p) => {
    await p.command('setpensize 8 rt 90 fd 200');
    const n = await inkCount(p, 100, -10, 100.5, 10);
    p.assert.ok(n >= 14 && n <= 18, 'drawing pixels across ' + n);
  });
  for (const s of [2, 5, 20]) {
    t.test(`SETPENSIZE ${s} is reported by PENSIZE`, async (p) => {
      await p.command(`setpensize ${s}`);
      p.assert.equal(await show(p, 'pensize'), `[${s} ${s}]`);
    });
  }
  t.test('SETPENSIZE takes a list too', async (p) => {
    await p.command('setpensize [6 6]');
    p.assert.equal(await show(p, 'pensize'), '[6 6]');
  });
  t.test('SETPENSIZE 0 is refused', async (p) => {
    await p.command('setpensize 0');
    await p.waitOutput(/setpensize doesn't like 0/i);
  });
  t.test('a wider pen covers more pixels', async (p) => {
    await p.command('fd 100 pu setx 50 pd setpensize 10 bk 100');
    const thin = await inkCount(p, -20, 20, 20, 80);
    const thick = await inkCount(p, 30, 20, 70, 80);
    p.assert.ok(thick > thin * 3, `${thin} ${thick}`);
  });

  // ---- pen modes -------------------------------------------------------------------------------
  t.test('PENERASE rubs out a line it goes over', async (p) => {
    await p.command('setpensize 3 fd 100 pe setpensize 6 bk 100');
    p.assert.equal((await inkNear(p, 0, 50, 2))[3], 0);
    p.assert.equal(await show(p, 'penmode'), 'ERASE');
  });
  t.test('PENERASE only rubs out where it goes', async (p) => {
    await p.command('fd 100 rt 90 fd 100 pe setpensize 6 bk 100');
    p.assert.ok((await inkNear(p, 0, 50))[3] > 150);
    p.assert.equal((await inkNear(p, 50, 100, 2))[3], 0);
  });
  t.test('PENREVERSE draws on an empty spot', async (p) => {
    await p.command('px setpensize 4 fd 100');
    p.assert.ok((await px(p, 0, 50))[3] > 200);
    p.assert.equal(await show(p, 'penmode'), 'REVERSE');
  });
  t.test('PENREVERSE going twice over a line takes it away', async (p) => {
    await p.command('px setpensize 4 fd 100 bk 100');
    p.assert.equal((await px(p, 0, 50))[3], 0);
  });
  t.test('PENPAINT goes back to normal drawing', async (p) => {
    await p.command('pe ppt setpensize 4 fd 100');
    p.assert.ok((await px(p, 0, 50))[3] > 200);
    p.assert.equal(await show(p, 'penmode'), 'PAINT');
  });
  t.test('PENUP then PENDOWN keeps the erase mode', async (p) => {
    await p.command('pe pu pd');
    p.assert.equal(await show(p, 'penmode'), 'ERASE');
  });
  t.test('PENERASE and PENREVERSE put the pen down', async (p) => {
    await p.command('pu pe');
    p.assert.equal(await show(p, 'pendownp'), 'true');
    await p.command('pu px');
    p.assert.equal(await show(p, 'pendown?'), 'true');
  });
  t.test('PEN reports the whole pen state', async (p) => {
    await p.command('pu setpc 4 setpensize 3');
    p.assert.equal(await show(p, 'pen'), '[penup paint 4 [3 3] []]');
  });
  t.test('SETPEN puts back a saved pen', async (p) => {
    await p.command('make "saved pen setpc 2 setpensize 9 pu setpen :saved');
    p.assert.equal(await show(p, 'pen'), '[pendown paint 0 [1 1] []]');
  });
  t.test('SETPEN can set a colour and size', async (p) => {
    await p.command('setpen [pendown paint 4 [5 5]] fd 100');
    p.assert.ok(near(await px(p, 0, 50), [255, 0, 0], 12));
    p.assert.equal(await show(p, 'pensize'), '[5 5]');
  });

  // ---- background ------------------------------------------------------------------------------
  t.test('SETBG keeps the drawing', async (p) => {
    await p.command('setpensize 4 fd 100 setbg 1');
    p.assert.ok(near(await px(p, 0, 50), [0, 0, 0], 12));
    p.assert.equal((await px(p, 100, 100))[3], 0, 'the background is not painted into the drawing');
  });
  const bgs = [['1', [0, 0, 255]], ['"yellow', [255, 255, 0]], ['[20 40 60]', [20, 40, 60]], ['"#336699', [51, 102, 153]], ['14', [255, 163, 0]]];
  for (const [c, rgb] of bgs) {
    t.test(`SETBG ${c} paints the visible world`, async (p) => {
      await p.command(`setbg ${c}`);
      p.assert.ok(near(await screenPx(p, 200, 200), rgb, 12), String(await screenPx(p, 200, 200)));
      p.assert.ok(near(await screenPx(p, -390, -290), rgb, 12));
    });
  }
  t.test('BACKGROUND reports what SETBG set', async (p) => {
    p.assert.equal(await show(p, 'background'), '7');
    await p.command('setbg [1 2 3]');
    p.assert.equal(await show(p, 'bg'), '[1 2 3]');
    await p.command('setsc "red');
    p.assert.equal(await show(p, 'screencolor'), 'red');
  });
  t.test('a line still shows on the screen after SETBG', async (p) => {
    await p.command('ht setpensize 6 setpc 7 rt 90 fd 200 setbg 0');
    p.assert.ok(near(await screenPx(p, 100, 0), [255, 255, 255], 30));
    p.assert.ok(near(await screenPx(p, 100, 50), [0, 0, 0], 12));
  });
  t.test('outside the world is the desk, not the background', async (p) => {
    await p.command('setbg 4');
    const v = await p.ev('JSON.stringify(LG.app.turtleView.view)').then(JSON.parse);
    const c = await p.fn((x, y) => [...LG.app.turtleView.ctx.getImageData(x, y, 1, 1).data].slice(0, 3), Math.max(0, v.x - 6), v.y + 50);
    p.assert.ok(!near(c, [255, 0, 0], 60), 'desk ' + c);
  });
  t.test('SETBG with a bad colour is refused', async (p) => {
    await p.command('setbg "nope');
    await p.waitOutput(/setbg doesn't like nope/i);
  });

  // ---- CLEAN and CLEARSCREEN -------------------------------------------------------------------
  t.test('CLEAN erases the drawing and leaves the turtle', async (p) => {
    await p.command('fd 100 rt 90 fd 50 clean');
    p.assert.equal(await totalInk(p), 0);
    const tt = await p.turtle();
    p.assert.deepEqual([tt.x, tt.y, tt.heading], [50, 100, 90]);
  });
  t.test('CLEARSCREEN erases the drawing and sends the turtle home', async (p) => {
    await p.command('fd 100 rt 90 fd 50 cs');
    p.assert.equal(await totalInk(p), 0);
    const tt = await p.turtle();
    p.assert.deepEqual([tt.x, tt.y, tt.heading], [0, 0, 0]);
  });
  t.test('CLEARSCREEN keeps the pen colour, size and background', async (p) => {
    await p.command('setpc 4 setpensize 3 setbg 1 clearscreen');
    p.assert.equal(await show(p, 'pc'), '4');
    p.assert.equal(await show(p, 'pensize'), '[3 3]');
    p.assert.equal(await show(p, 'bg'), '1');
  });
  t.test('CLEARSCREEN keeps the pen up if it was up', async (p) => {
    await p.command('pu cs');
    p.assert.equal(await show(p, 'pendownp'), 'false');
  });
  t.test('CLEAN from the menu item clears the drawing', async (p) => {
    await p.command('fd 100');
    await p.menu('Clear the drawing (CS)');
    await p.waitState('idle');
    p.assert.equal(await totalInk(p), 0);
  });

  // ---- WRAP, WINDOW, FENCE -----------------------------------------------------------------------
  t.test('WINDOW is the starting mode', async (p) => { p.assert.equal(await show(p, 'turtlemode'), 'WINDOW'); });
  t.test('in WINDOW the turtle walks off the edge', async (p) => {
    await p.command('window fd 400');
    p.assert.equal((await p.turtle()).y, 400);
    p.assert.ok((await inkNear(p, 0, 290))[3] > 150);
  });
  t.test('in WRAP the turtle comes back on the other side', async (p) => {
    await p.command('wrap fd 350');
    p.assert.equal((await p.turtle()).y, -250);
    p.assert.ok((await inkNear(p, 0, 280))[3] > 150, 'top part');
    p.assert.ok((await inkNear(p, 0, -280))[3] > 150, 'bottom part');
    p.assert.equal((await inkNear(p, 0, -200, 3))[3], 0, 'past the end');
    p.assert.equal(await show(p, 'turtlemode'), 'WRAP');
  });
  t.test('WRAP works sideways', async (p) => {
    await p.command('wrap rt 90 fd 500');
    p.assert.equal((await p.turtle()).x, -300);
    p.assert.ok((await inkNear(p, 395, 0, 3))[3] > 150);
    p.assert.ok((await inkNear(p, -350, 0))[3] > 150);
  });
  t.test('WRAP works going backwards', async (p) => {
    await p.command('wrap bk 400');
    p.assert.equal((await p.turtle()).y, 200);
  });
  t.test('WRAP can go round several times', async (p) => {
    await p.command('wrap fd 1250');
    p.assert.equal((await p.turtle()).y, 50);
  });
  t.test('WRAP on a slant crosses a corner cleanly', async (p) => {
    await p.command('wrap rt 45 fd 600');
    const tt = await p.turtle();
    p.assert.ok(Math.abs(tt.x) <= 400 && Math.abs(tt.y) <= 300, `${tt.x},${tt.y}`);
  });
  t.test('FENCE stops the turtle at the edge with an error', async (p) => {
    await p.command('fence fd 400');
    await p.waitOutput(/out of bounds/i);
    p.assert.equal((await p.turtle()).y, 0);
    p.assert.equal(await show(p, 'turtlemode'), 'FENCE');
  });
  t.test('FENCE allows moves inside the world', async (p) => {
    await p.command('fence fd 250 rt 90 fd 350');
    const tt = await p.turtle();
    p.assert.deepEqual([tt.x, tt.y], [350, 250]);
  });
  t.test('FENCE checks SETXY too', async (p) => {
    await p.command('fence setxy 500 0');
    await p.waitOutput(/out of bounds/i);
  });
  t.test('FENCE refuses when the turtle is already outside', async (p) => {
    await p.command('window fd 500');
    await p.command('fence');
    await p.waitOutput(/out of bounds/i);
    p.assert.equal(await show(p, 'turtlemode'), 'WINDOW');
  });
  t.test('a FENCE error in a program marks the line', async (p) => {
    await p.runProgram('fence\nfd 100\nfd 400\n');
    p.assert.equal(await p.state(), 'error');
    p.assert.equal(await p.wait("(LG.app.active.editor.inner.querySelector('.ed-gl.err') || {}).innerText"), '3');
  });

  // ---- the palette ----------------------------------------------------------------------------
  t.test('PALETTE reports the standard colours', async (p) => {
    p.assert.equal(await show(p, 'palette 4'), '[255 0 0]');
    p.assert.equal(await show(p, 'palette 14'), '[255 163 0]');
  });
  t.test('SETPALETTE gives a number a new colour', async (p) => {
    await p.command('setpalette 20 [10 200 30] setpensize 4 setpc 20 fd 100');
    p.assert.ok(near(await px(p, 0, 50), [10, 200, 30], 12));
    p.assert.equal(await show(p, 'palette 20'), '[10 200 30]');
  });
  t.test('SETPALETTE can change colour 9', async (p) => {
    await p.command('setpalette 9 [0 0 0] setpensize 4 setpc 9 fd 100');
    p.assert.ok(near(await px(p, 0, 50), [0, 0, 0], 12));
  });
  t.test('SETPALETTE refuses the first eight colours', async (p) => {
    await p.command('setpalette 3 [1 1 1]');
    await p.waitOutput(/setpalette doesn't like 3/i);
    p.assert.equal(await show(p, 'palette 3'), '[0 255 255]');
  });
  t.test('a fresh run puts the palette back', async (p) => {
    await p.command('setpalette 9 [1 2 3]');
    await p.runProgram('print palette 9\n');
    await p.waitOutput(/^197 136 18$/m);
  });
}
