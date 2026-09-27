// Turtle motion: where the turtle ends up, and the lines it leaves on the drawing (read back as pixels).
import { resetWorld, inkNear, inkCount, totalInk, show, screenPx, near } from './30-world-lib.mjs';

const INK = (px) => px[3] > 150;

export default function (t) {
  t.beforeEach(async (p) => { await resetWorld(p); });

  // ---- where the turtle ends up --------------------------------------------------------------
  const moves = [
    ['fd 100', [0, 100, 0]],
    ['forward 37', [0, 37, 0]],
    ['bk 80', [0, -80, 0]],
    ['back 12.5', [0, -12.5, 0]],
    ['fd -50', [0, -50, 0]],
    ['rt 90 fd 60', [60, 0, 90]],
    ['right 90 forward 60 right 90 forward 60', [60, -60, 180]],
    ['lt 90 fd 60', [-60, 0, 270]],
    ['left 45', [0, 0, 315]],
    ['rt 45 fd 100', [70.71, 70.71, 45]],
    ['lt 360', [0, 0, 0]],
    ['rt 450', [0, 0, 90]],
    ['rt -90', [0, 0, 270]],
    ['lt -30', [0, 0, 30]],
    ['repeat 4 [fd 50 rt 90]', [0, 0, 0]],
    ['repeat 3 [fd 80 rt 120]', [0, 0, 0]],
    ['setxy 100 50', [100, 50, 0]],
    ['setxy -100 -50', [-100, -50, 0]],
    ['setpos [-120 -30]', [-120, -30, 0]],
    ['setpos list 3 4', [3, 4, 0]],
    ['rt 30 setx 70', [70, 0, 30]],
    ['sety -90', [0, -90, 0]],
    ['setxy 10 20 setx 0', [0, 20, 0]],
    ['setxy 10 20 sety 0', [10, 0, 0]],
    ['setheading 135', [0, 0, 135]],
    ['seth -45', [0, 0, 315]],
    ['seth 720', [0, 0, 0]],
    ['fd 100 rt 90 fd 30 home', [0, 0, 0]],
    ['seth 90 fd 1000 seth 0', [1000, 0, 0]],
  ];
  for (const [src, want] of moves) {
    t.test(`${src} leaves the turtle at ${want.join(' ')}`, async (p) => {
      await p.command(src);
      const tt = await p.turtle();
      p.assert.ok(Math.abs(tt.x - want[0]) < 0.02 && Math.abs(tt.y - want[1]) < 0.02, `pos ${tt.x},${tt.y}`);
      p.assert.equal(tt.heading, want[2]);
    });
  }

  // ---- what gets drawn -----------------------------------------------------------------------
  const lines = [
    // command, points that must have ink, points that must be clear
    ['fd 100', [[0, 10], [0, 50], [0, 99]], [[0, 120], [0, -20], [30, 50]]],
    ['bk 80', [[0, -40], [0, -79]], [[0, 20], [0, -100]]],
    ['rt 90 fd 60', [[30, 0], [59, 0]], [[-20, 0], [30, 20]]],
    ['lt 90 fd 60', [[-30, 0]], [[30, 0]]],
    ['rt 45 fd 100', [[35.36, 35.36], [60, 60]], [[-35, 35], [35, -35]]],
    ['setxy 100 50', [[50, 25], [80, 40]], [[50, -25], [0, 50]]],
    ['setpos [-120 -30]', [[-60, -15]], [[60, 15]]],
    ['setx 70', [[35, 0]], [[-35, 0]]],
    ['sety -90', [[0, -45]], [[0, 45]]],
    ['fd 100 rt 90 fd 50 home', [[0, 50], [25, 100], [25, 50]], [[50, 0], [-25, 50]]],
    ['repeat 4 [fd 100 rt 90]', [[0, 50], [50, 100], [100, 50], [50, 0]], [[50, 50], [-50, 50]]],
    ['repeat 3 [fd 100 rt 120]', [[0, 50], [43.3, 75]], [[-30, 50]]],
  ];
  for (const [src, ink, clear] of lines) {
    t.test(`${src} draws where it should and nowhere else`, async (p) => {
      await p.command(src);
      for (const [x, y] of ink) p.assert.ok(INK(await inkNear(p, x, y)), `ink at ${x},${y}`);
      for (const [x, y] of clear) p.assert.equal((await inkNear(p, x, y, 3))[3], 0, `clear at ${x},${y}`);
    });
  }

  t.test('the line is drawn in black by default', async (p) => {
    await p.command('fd 100');
    const c = await inkNear(p, 0, 50);
    p.assert.ok(near(c, [0, 0, 0]), String(c));
  });
  t.test('a pen width of 1 makes a thin line about 2 drawing pixels wide', async (p) => {
    await p.command('rt 90 fd 200');
    const n = await inkCount(p, 50, -5, 51, 5);
    p.assert.ok(n >= 1 && n <= 4, 'pixels across ' + n);
  });
  t.test('SETHEADING alone draws nothing', async (p) => {
    await p.command('seth 135 rt 20 lt 70');
    p.assert.equal(await totalInk(p), 0);
  });
  t.test('a pen-up move draws nothing and a pen-down one does', async (p) => {
    await p.command('pu fd 50 pd fd 50');
    p.assert.equal((await inkNear(p, 0, 25, 3))[3], 0);
    p.assert.ok(INK(await inkNear(p, 0, 75)));
  });
  t.test('SETXY with the pen up only moves the turtle', async (p) => {
    await p.command('pu setxy 150 -100');
    p.assert.equal(await totalInk(p), 0);
    const tt = await p.turtle();
    p.assert.deepEqual([tt.x, tt.y], [150, -100]);
  });
  t.test('HOME with the pen up goes back without a line', async (p) => {
    await p.command('fd 60 pu home');
    p.assert.ok(INK(await inkNear(p, 0, 30)));
    await p.command('pd');
    p.assert.equal((await p.turtle()).heading, 0);
  });
  t.test('HOME resets the heading too', async (p) => {
    await p.command('rt 123 fd 40 home');
    const tt = await p.turtle();
    p.assert.deepEqual([tt.x, tt.y, tt.heading], [0, 0, 0]);
  });
  t.test('a zero-length FD leaves the turtle in place', async (p) => {
    await p.command('fd 0');
    const tt = await p.turtle();
    p.assert.deepEqual([tt.x, tt.y], [0, 0]);
  });
  t.test('a long walk of small steps lands where the sum says', async (p) => {
    await p.command('repeat 100 [fd 1]');
    p.assert.equal((await p.turtle()).y, 100);
    p.assert.ok(INK(await inkNear(p, 0, 50)));
  });
  t.test('a 360-sided polygon comes back to the start', async (p) => {
    await p.command('repeat 360 [fd 1 rt 1]');
    const tt = await p.turtle();
    p.assert.ok(Math.abs(tt.x) < 0.01 && Math.abs(tt.y) < 0.01, `${tt.x},${tt.y}`);
    p.assert.equal(tt.heading, 0);
  });

  // ---- ARC, ELLIPSE, DOT -----------------------------------------------------------------------
  t.test('ARC 90 50 sweeps clockwise from straight ahead', async (p) => {
    await p.command('arc 90 50');
    for (const [x, y] of [[0, 50], [35.36, 35.36], [50, 0]]) p.assert.ok(INK(await inkNear(p, x, y, 2)), `ink ${x},${y}`);
    for (const [x, y] of [[-35.36, 35.36], [0, -50], [-50, 0]]) p.assert.equal((await inkNear(p, x, y, 3))[3], 0, `clear ${x},${y}`);
  });
  t.test('ARC does not move or turn the turtle', async (p) => {
    await p.command('rt 30 arc 200 70');
    const tt = await p.turtle();
    p.assert.deepEqual([tt.x, tt.y, tt.heading], [0, 0, 30]);
  });
  t.test('ARC 360 draws a whole circle', async (p) => {
    await p.command('arc 360 40');
    for (const [x, y] of [[40, 0], [-40, 0], [0, 40], [0, -40], [28.28, -28.28]]) p.assert.ok(INK(await inkNear(p, x, y, 2)), `ink ${x},${y}`);
    p.assert.equal((await inkNear(p, 0, 0, 5))[3], 0);
  });
  t.test('a negative ARC angle sweeps counterclockwise', async (p) => {
    await p.command('arc -90 50');
    p.assert.ok(INK(await inkNear(p, -35.36, 35.36, 2)));
    p.assert.equal((await inkNear(p, 35.36, 35.36, 3))[3], 0);
  });
  t.test('ARC starts at the turtle heading', async (p) => {
    await p.command('seth 90 arc 90 50');
    p.assert.ok(INK(await inkNear(p, 35.36, -35.36, 2)));
    p.assert.equal((await inkNear(p, 35.36, 35.36, 3))[3], 0);
    p.assert.equal((await inkNear(p, -35.36, -35.36, 3))[3], 0);
  });
  t.test('ARC with the pen up draws nothing', async (p) => {
    await p.command('pu arc 360 60');
    p.assert.equal(await totalInk(p), 0);
  });
  t.test('ARC is centred on the turtle wherever it is', async (p) => {
    await p.command('pu setxy 100 100 pd arc 360 20');
    p.assert.ok(INK(await inkNear(p, 120, 100, 2)));
    p.assert.ok(INK(await inkNear(p, 100, 80, 2)));
    p.assert.equal((await inkNear(p, 20, 0, 3))[3], 0);
  });
  t.test('ELLIPSE 200 100 is wide across the turtle and short along its heading', async (p) => {
    await p.command('ellipse 200 100');
    p.assert.ok(INK(await inkNear(p, 100, 0, 2)), 'right edge');
    p.assert.ok(INK(await inkNear(p, -100, 0, 2)), 'left edge');
    p.assert.ok(INK(await inkNear(p, 0, 50, 2)), 'top edge');
    p.assert.equal((await inkNear(p, 0, 100, 3))[3], 0);
  });
  t.test('turning the turtle tilts the ellipse', async (p) => {
    await p.command('rt 90 ellipse 200 100');
    p.assert.ok(INK(await inkNear(p, 0, 100, 2)), 'top edge');
    p.assert.ok(INK(await inkNear(p, 50, 0, 2)), 'right edge');
    p.assert.equal((await inkNear(p, 100, 0, 3))[3], 0);
  });
  t.test('ELLIPSE does not move the turtle', async (p) => {
    await p.command('ellipse 80 40');
    const tt = await p.turtle();
    p.assert.deepEqual([tt.x, tt.y, tt.heading], [0, 0, 0]);
  });
  t.test('ELLIPSE with equal sizes is a circle', async (p) => {
    await p.command('ellipse 100 100');
    for (const [x, y] of [[50, 0], [0, 50], [-50, 0], [0, -50], [35.36, 35.36]]) p.assert.ok(INK(await inkNear(p, x, y, 2)), `${x},${y}`);
  });
  t.test('ELLIPSEARC draws only part of the oval', async (p) => {
    await p.command('ellipsearc 90 100 100 0');
    const full = [[50, 0], [0, 50], [-50, 0], [0, -50]];
    let inked = 0;
    for (const [x, y] of full) if (INK(await inkNear(p, x, y, 2))) inked++;
    p.assert.ok(inked >= 1 && inked <= 2, 'inked quarter points ' + inked);
  });
  t.test('DOT paints at a point without moving the turtle', async (p) => {
    await p.command('dot [50 -60]');
    p.assert.ok(INK(await inkNear(p, 50, -60, 1)));
    const tt = await p.turtle();
    p.assert.deepEqual([tt.x, tt.y], [0, 0]);
    p.assert.equal((await inkNear(p, 0, -30, 3))[3], 0);
  });
  t.test('DOT works with the pen up', async (p) => {
    await p.command('pu dot [-70 20]');
    p.assert.ok(INK(await inkNear(p, -70, 20, 1)));
  });
  t.test('a bigger pen makes a bigger dot', async (p) => {
    await p.command('dot [0 100] setpensize 10 dot [100 100]');
    const small = await inkCount(p, -8, 92, 8, 108);
    const big = await inkCount(p, 92, 92, 108, 108);
    p.assert.ok(big > small * 4, `${small} vs ${big}`);
  });
  t.test('DOT uses the pen colour', async (p) => {
    await p.command('setpc "red dot [10 10]');
    p.assert.ok(near(await inkNear(p, 10, 10, 1), [255, 0, 0]));
  });

  // ---- reporters -------------------------------------------------------------------------------
  const reporters = [
    ['fd 30 rt 90 fd 40', 'pos', '[40 30]'],
    ['fd 30 rt 90 fd 40', 'xcor', '40'],
    ['fd 30 rt 90 fd 40', 'ycor', '30'],
    ['rt 33', 'heading', '33'],
    ['lt 10', 'heading', '350'],
    ['', 'pos', '[0 0]'],
    ['', 'heading', '0'],
    ['', 'towards [100 0]', '90'],
    ['', 'towards [0 -100]', '180'],
    ['', 'towards [-100 0]', '270'],
    ['', 'towards [100 100]', '45'],
    ['', 'towards [0 100]', '0'],
    ['setxy 50 50', 'towards [0 0]', '225'],
    ['', 'distance [30 40]', '50'],
    ['setxy -30 -40', 'distance [0 0]', '50'],
    ['', 'distance [0 0]', '0'],
    ['rt 45 fd 10', 'round xcor * 1000', '7071'],
    ['setpos [1.5 -2.5]', 'pos', '[1.5 -2.5]'],
    ['rt 90 fd 100 lt 90 fd 100', 'list xcor ycor', '[100 100]'],
    ['', 'shownp', 'true'],
    ['ht', 'shownp', 'false'],
    ['', 'pendownp', 'true'],
    ['pu', 'pendownp', 'false'],
  ];
  for (const [setup, expr, want] of reporters) {
    t.test(`${setup ? setup + ' then ' : ''}${expr} reports ${want}`, async (p) => {
      if (setup) await p.command(setup);
      p.assert.equal(await show(p, expr), want);
    });
  }

  t.test('the position chip follows the turtle', async (p) => {
    await p.command('fd 40 rt 90 fd 25');
    await p.wait("/x 25\\s+y 40\\s+90°/.test(document.getElementById('turtleChip').innerText)", 3000);
    p.assert.match(await p.text('#sbTurtle'), /x 25\s+y 40\s+90°/);
  });
  t.test('the position chip says when the pen is up', async (p) => {
    await p.command('pu');
    await p.wait("/pen up/.test(document.getElementById('turtleChip').innerText)", 3000);
    await p.command('pd');
    await p.wait("!/pen up/.test(document.getElementById('turtleChip').innerText)", 3000);
  });
  t.test('a line shows on the visible turtle world too', async (p) => {
    await p.command('ht rt 90 fd 150');
    const c = await screenPx(p, 100, 0);
    p.assert.ok(c.every((v) => v < 200), 'line pixel ' + c);
    const bg = await screenPx(p, 100, 60);
    p.assert.ok(near(bg, [255, 255, 255], 30), 'background ' + bg);
  });
  t.test('a bad input to FORWARD is an error that names it', async (p) => {
    await p.command('fd "abc');
    await p.waitOutput(/fd doesn't like abc as input/i);
  });
  t.test('SETPOS needs a list of two numbers', async (p) => {
    await p.command('setpos [1 2 3]');
    await p.waitOutput(/setpos doesn't like \[1 2 3\] as input/i);
  });
}
