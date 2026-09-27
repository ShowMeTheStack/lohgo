// Filling, labels, stamps and shapes, several turtles, SETSCRUNCH and saving pictures.
import { resetWorld, inkNear, inkCount, colorCount, totalInk, show, screenPx, near, px } from './30-world-lib.mjs';

const SQUARE = 'repeat 4 [fd 100 rt 90]';

export default function (t) {
  t.beforeEach(async (p) => { await resetWorld(p); });

  // ---- FILL ------------------------------------------------------------------------------------
  t.test('FILL inside a square paints the inside with the pen colour', async (p) => {
    await p.command(`${SQUARE} pu setxy 50 50 setpc 4 fill`);
    p.assert.ok(near(await px(p, 50, 50), [255, 0, 0], 12));
    p.assert.ok(near(await px(p, 10, 90), [255, 0, 0], 12));
  });
  t.test('FILL stays inside the lines', async (p) => {
    await p.command(`${SQUARE} pu setxy 50 50 setfc 4 fill`);
    p.assert.equal((await px(p, 150, 50))[3], 0);
    p.assert.equal((await px(p, -50, 50))[3], 0);
    p.assert.equal((await px(p, 50, 150))[3], 0);
    p.assert.equal((await px(p, 50, -50))[3], 0);
  });
  t.test('FILL uses the flood colour when one is set', async (p) => {
    await p.command(`setpc 1 ${SQUARE} pu setxy 50 50 setfloodcolor 2 fill`);
    p.assert.ok(near(await px(p, 50, 50), [0, 255, 0], 12));
    p.assert.ok(near(await inkNear(p, 0, 50, 0.5), [0, 0, 255], 40), 'the outline keeps the pen colour');
  });
  t.test('FILL accepts colour names for the flood colour', async (p) => {
    await p.command(`${SQUARE} pu setxy 50 50 setfc "orange fill`);
    p.assert.ok(near(await px(p, 50, 50), [255, 163, 0], 12));
  });
  t.test('FLOODCOLOR reports what SETFLOODCOLOR set', async (p) => {
    await p.command('setfc [1 2 3]');
    p.assert.equal(await show(p, 'floodcolor'), '[1 2 3]');
  });
  t.test('FLOODCOLOR follows the pen until it is set', async (p) => {
    await p.command('setpc 5');
    p.assert.equal(await show(p, 'fc'), '5');
  });
  t.test('FILL on an empty world floods all of it', async (p) => {
    await p.command('setfc 3 fill');
    for (const [x, y] of [[0, 0], [-399, 299], [399, -299], [200, -100]]) p.assert.ok(near(await px(p, x, y), [0, 255, 255], 12), `${x},${y}`);
  });
  t.test('FILL inside a circle stops at the circle', async (p) => {
    await p.command('arc 360 60 setfc 4 fill');
    p.assert.ok(near(await px(p, 0, 0), [255, 0, 0], 12));
    p.assert.ok(near(await px(p, 40, 40), [255, 0, 0], 12));
    p.assert.equal((await px(p, 0, 80))[3], 0);
  });
  t.test('FILL outside a shape leaves the inside alone', async (p) => {
    await p.command(`${SQUARE} pu setxy -100 -100 setfc 2 fill`);
    p.assert.ok(near(await px(p, -100, -100), [0, 255, 0], 12));
    p.assert.equal((await px(p, 50, 50))[3], 0);
  });
  t.test('FILL over a filled area recolours it', async (p) => {
    await p.command(`${SQUARE} pu setxy 50 50 setfc 2 fill setfc 4 fill`);
    p.assert.ok(near(await px(p, 50, 50), [255, 0, 0], 12));
    p.assert.equal((await px(p, 150, 50))[3], 0);
  });
  t.test('FILL with the turtle off the world does nothing', async (p) => {
    await p.command('pu setxy 600 0 fill');
    p.assert.equal(await totalInk(p), 0);
    p.assert.equal(await p.state(), 'idle');
  });
  t.test('plain FILL stops at a line of any colour', async (p) => {
    await p.command(`setpc 4 ${SQUARE} setpc 1 pu setxy 50 0 pd fd 100 pu setxy 25 50 setfc 2 fill`);
    p.assert.ok(near(await px(p, 25, 50), [0, 255, 0], 12));
    p.assert.equal((await px(p, 75, 50))[3], 0, 'the other half stays empty');
  });
  t.test('(FILL "true) fills up to lines of the pen colour only', async (p) => {
    await p.command(`setpc 4 ${SQUARE} setpc 1 pu setxy 40 40 pd repeat 4 [fd 20 rt 90] pu setxy 20 20 setfc 2 setpc 4 (fill "true)`);
    p.assert.ok(near(await px(p, 20, 20), [0, 255, 0], 12));
    p.assert.ok(near(await px(p, 50, 50), [0, 255, 0], 12), 'it crosses the blue square');
    p.assert.equal((await px(p, 150, 50))[3], 0, 'it stops at the red square');
  });
  t.test('plain FILL does not cross into a smaller shape', async (p) => {
    await p.command(`setpc 4 ${SQUARE} setpc 1 pu setxy 40 40 pd repeat 4 [fd 20 rt 90] pu setxy 20 20 setfc 2 fill`);
    p.assert.ok(near(await px(p, 20, 20), [0, 255, 0], 12));
    p.assert.equal((await px(p, 50, 50))[3], 0);
  });
  t.test('(FILL "false) is the same as FILL', async (p) => {
    await p.command(`${SQUARE} pu setxy 50 50 setfc 4 (fill "false)`);
    p.assert.ok(near(await px(p, 50, 50), [255, 0, 0], 12));
  });
  t.test('several turtles fill where each one is', async (p) => {
    await p.command('fd 100 bk 200 pu home tell [1 2] ask 1 [setxy -50 0] ask 2 [setxy 50 0] setfc 4 fill');
    p.assert.ok(near(await px(p, -50, 0), [255, 0, 0], 12));
    p.assert.ok(near(await px(p, 50, 0), [255, 0, 0], 12));
  });

  // ---- FILLED ------------------------------------------------------------------------------------
  t.test('FILLED paints the shape drawn inside it', async (p) => {
    await p.command(`filled 4 [${SQUARE}]`);
    p.assert.ok(near(await px(p, 50, 50), [255, 0, 0], 12));
    p.assert.equal((await px(p, 150, 50))[3], 0);
  });
  t.test('FILLED keeps the outline on top', async (p) => {
    await p.command(`setpensize 4 filled 4 [${SQUARE}]`);
    p.assert.ok(near(await px(p, 0, 50), [0, 0, 0], 30));
  });
  t.test('FILLED works with a colour name and a triangle', async (p) => {
    await p.command('filled "blue [repeat 3 [fd 120 rt 120]]');
    p.assert.ok(near(await px(p, 30, 40), [0, 0, 255], 12));
    p.assert.equal((await px(p, -30, 40))[3], 0);
  });
  t.test('FILLED with the pen up fills with no outline', async (p) => {
    await p.command(`pu filled 2 [${SQUARE}]`);
    p.assert.ok(near(await px(p, 50, 50), [0, 255, 0], 12));
    p.assert.ok(near(await px(p, 0.5, 50), [0, 255, 0], 12));
  });
  t.test('FILLED leaves the turtle where the drawing ends', async (p) => {
    await p.command('filled 4 [fd 50 rt 90 fd 50 rt 90 fd 50]');
    const tt = await p.turtle();
    p.assert.deepEqual([tt.x, tt.y, tt.heading], [50, 0, 180]);
  });
  t.test('FILLED with a bad colour is an error', async (p) => {
    await p.command(`filled "nocolour [${SQUARE}]`);
    await p.waitOutput(/filled doesn't like nocolour/i);
    p.assert.equal(await totalInk(p), 0);
  });
  t.test('FILLED with too few points draws only the line', async (p) => {
    await p.command('filled 4 [fd 50]');
    p.assert.ok((await inkNear(p, 0, 25))[3] > 150);
    p.assert.equal(await colorCount(p, [255, 0, 0], -50, -50, 50, 100), 0);
  });

  // ---- LABEL ---------------------------------------------------------------------------------------
  t.test('LABEL writes text starting at the turtle', async (p) => {
    await p.command('label "Hello');
    p.assert.ok(await inkCount(p, 0, 0, 60, 14) > 20);
    p.assert.equal(await inkCount(p, -60, -20, -2, 30), 0);
    p.assert.equal(await inkCount(p, 0, -30, 60, -6), 0);
  });
  t.test('LABEL does not move the turtle', async (p) => {
    await p.command('label "Hello');
    const tt = await p.turtle();
    p.assert.deepEqual([tt.x, tt.y], [0, 0]);
  });
  t.test('LABEL uses the pen colour', async (p) => {
    await p.command('setpc 4 setlabelheight 30 label "MMM');
    p.assert.ok(await colorCount(p, [255, 0, 0], 0, 0, 80, 30) > 50);
  });
  t.test('LABEL of a list writes its words', async (p) => {
    await p.command('label [two words]');
    p.assert.ok(await inkCount(p, 50, 0, 100, 14) > 10);
  });
  t.test('LABEL with a number', async (p) => {
    await p.command('label 12345');
    p.assert.ok(await inkCount(p, 0, 0, 40, 12) > 10);
  });
  t.test('SETLABELHEIGHT makes bigger letters', async (p) => {
    await p.command('label "W pu setxy 0 -100 setlabelheight 60 label "W');
    const small = await inkCount(p, 0, 0, 80, 70);
    const big = await inkCount(p, 0, -100, 80, -30);
    p.assert.ok(big > small * 8, `${small} ${big}`);
    p.assert.ok(await inkCount(p, 0, -70, 80, -45) > 0, 'tall letters reach high');
  });
  t.test('LABELSIZE follows SETLABELHEIGHT', async (p) => {
    await p.command('setlabelheight 30');
    p.assert.match(await show(p, 'labelsize'), /^\[\d+ 30\]$/);
  });
  t.test('SETLABELHEIGHT 0 is refused', async (p) => {
    await p.command('setlabelheight 0');
    await p.waitOutput(/setlabelheight doesn't like 0/i);
  });
  t.test('LABEL at another place', async (p) => {
    await p.command('pu setxy -200 100 label "here');
    p.assert.ok(await inkCount(p, -200, 100, -160, 112) > 10);
    p.assert.equal(await inkCount(p, -10, -10, 50, 14), 0);
  });
  t.test('LABEL in erase mode rubs text out', async (p) => {
    await p.command('setlabelheight 30 label "MMM pe label "MMM');
    p.assert.ok(await inkCount(p, 0, 0, 80, 30, 200) < 20);
  });

  // ---- STAMP and SETSHAPE -----------------------------------------------------------------------
  const shapes = ['turtle', 'triangle', 'arrow', 'circle', 'square', 'star'];
  for (const s of shapes) {
    t.test(`SETSHAPE "${s} then STAMP leaves a picture of it`, async (p) => {
      await p.command(`setshape "${s} stamp`);
      p.assert.equal(await show(p, 'shape'), s);
      const n = await inkCount(p, -15, -15, 15, 15);
      p.assert.ok(n > 100, 'stamped pixels ' + n);
      p.assert.equal(await inkCount(p, 20, 20, 60, 60), 0);
    });
    t.test(`the "${s} shape shows on screen where the turtle is`, async (p) => {
      await p.command(`setshape "${s} setpc 4 pu setxy 100 -50`);
      const n = await screenColorAt(p, 100, -50);
      p.assert.ok(n > 5, 'turtle pixels ' + n);
    });
  }
  t.test('SETSHAPE "none hides the turtle and stamps nothing', async (p) => {
    await p.command('setshape "none stamp');
    p.assert.equal(await totalInk(p), 0);
    p.assert.ok(near(await screenPx(p, 0, 0), [255, 255, 255], 10));
  });
  t.test('SETSHAPE with an unknown shape is refused', async (p) => {
    await p.command('setshape "dragon');
    await p.waitOutput(/setshape doesn't like dragon/i);
    p.assert.equal(await show(p, 'shape'), 'turtle');
  });
  t.test('a stamp is drawn in the pen colour', async (p) => {
    await p.command('setpc 4 setshape "square stamp');
    p.assert.ok(near(await px(p, 3, -3), [255, 0, 0], 12));
  });
  t.test('a stamp turns with the turtle', async (p) => {
    await p.command('setshape "arrow rt 90 stamp');
    p.assert.ok((await inkNear(p, 9, 0, 1))[3] > 150, 'the tip points east');
    p.assert.equal((await inkNear(p, 0, 10, 1))[3], 0, 'nothing north');
  });
  t.test('several stamps along a path', async (p) => {
    await p.command('setshape "circle pu repeat 4 [stamp fd 50]');
    for (const y of [0, 50, 100, 150]) p.assert.ok((await inkNear(p, 0, y, 1))[3] > 150, 'stamp at ' + y);
    p.assert.equal((await inkNear(p, 0, 25, 1))[3], 0);
  });

  // ---- SHOWTURTLE / HIDETURTLE --------------------------------------------------------------------
  t.test('HIDETURTLE takes the turtle off the screen', async (p) => {
    await p.command('setpc 4 setshape "square');
    p.assert.ok(!near(await screenPx(p, 0, 0), [255, 255, 255], 30));
    await p.command('hideturtle');
    p.assert.ok(near(await screenPx(p, 0, 0), [255, 255, 255], 10));
    p.assert.equal(await show(p, 'shown?'), 'false');
  });
  t.test('SHOWTURTLE brings it back', async (p) => {
    await p.command('setpc 4 setshape "square ht st');
    p.assert.ok(!near(await screenPx(p, 0, 0), [255, 255, 255], 30));
    p.assert.equal(await show(p, 'shownp'), 'true');
  });
  t.test('the turtle is never part of the drawing', async (p) => {
    await p.command('pu setxy 50 50');
    p.assert.equal(await totalInk(p), 0);
  });
  t.test('the classic triangle turtle setting changes how it looks', async (p) => {
    const before = await screenPx(p, 0, 0);
    await p.menu('Classic triangle turtle');
    p.assert.equal(await p.ev('LG.app.settings.turtleStyle'), 'classic');
    const after = await screenPx(p, 0, 0);
    p.assert.ok(!near(before, after, 30), `${before} / ${after}`);
    await p.menu('Classic triangle turtle');
    p.assert.equal(await p.ev('LG.app.settings.turtleStyle'), 'turtle');
  });

  // ---- several turtles -----------------------------------------------------------------------------
  t.test('TELL a list moves every turtle in it', async (p) => {
    await p.command('setturtle 1 rt 90 setturtle 2 lt 90 tell [1 2] fd 50');
    p.assert.equal(await show(p, 'ask 1 [pos]'), '[50 0]');
    p.assert.equal(await show(p, 'ask 2 [pos]'), '[-50 0]');
    p.assert.equal(await show(p, 'ask 0 [pos]'), '[0 0]');
    p.assert.ok((await inkNear(p, 25, 0))[3] > 150);
    p.assert.ok((await inkNear(p, -25, 0))[3] > 150);
  });
  t.test('WHO reports the turtles being told', async (p) => {
    p.assert.equal(await show(p, 'who'), '0');
    await p.command('tell [1 3]');
    p.assert.equal(await show(p, 'who'), '[1 3]');
    await p.command('tell 2');
    p.assert.equal(await show(p, 'who'), '2');
  });
  t.test('ASK runs for other turtles and then comes back', async (p) => {
    await p.command('ask 1 [fd 30]');
    p.assert.equal(await show(p, 'who'), '0');
    p.assert.equal(await show(p, 'pos'), '[0 0]');
    p.assert.equal(await show(p, 'ask 1 [ycor]'), '30');
  });
  t.test('ASK a list of turtles', async (p) => {
    await p.command('ask [1 2] [fd 40]');
    p.assert.equal(await show(p, 'ask 2 [ycor]'), '40');
    p.assert.equal(await show(p, 'ask 1 [ycor]'), '40');
  });
  t.test('EACH runs the list once for each turtle', async (p) => {
    await p.command('tell [1 2 3] each [fd 20 * who]');
    p.assert.equal(await show(p, 'ask 1 [ycor]'), '20');
    p.assert.equal(await show(p, 'ask 2 [ycor]'), '40');
    p.assert.equal(await show(p, 'ask 3 [ycor]'), '60');
    p.assert.equal(await show(p, 'who'), '[1 2 3]');
  });
  t.test('SETTURTLE picks the turtle to command', async (p) => {
    await p.command('setturtle 3 fd 25');
    p.assert.equal(await show(p, 'turtle'), '3');
    p.assert.equal(await show(p, 'turtles'), '3');
    p.assert.equal(await show(p, 'ask 0 [ycor]'), '0');
  });
  t.test('each turtle keeps its own pen colour', async (p) => {
    await p.command('setpensize 4 tell 1 setpc 4 rt 90 tell 2 setpc 1 lt 90 tell [1 2] fd 100');
    p.assert.ok(near(await px(p, 50, 0), [255, 0, 0], 12));
    p.assert.ok(near(await px(p, -50, 0), [0, 0, 255], 12));
  });
  t.test('every turtle is drawn on screen', async (p) => {
    await p.command('setshape "square setpc 4 setturtle 1 setshape "square setpc 1 pu setxy 100 0 st');
    p.assert.ok(near(await screenPx(p, 0, 0), [255, 0, 0], 60));
    p.assert.ok(near(await screenPx(p, 100, 0), [0, 0, 255], 60));
  });
  t.test('CLEARSCREEN sends every turtle home', async (p) => {
    await p.command('ask 1 [fd 50] ask 2 [rt 90 fd 50] cs');
    p.assert.equal(await show(p, 'ask 1 [pos]'), '[0 0]');
    p.assert.equal(await show(p, 'ask 2 [list pos heading]'), '[[0 0] 0]');
  });
  t.test('turtle numbers out of range are refused', async (p) => {
    await p.command('setturtle 5000');
    await p.waitOutput(/setturtle doesn't like 5000/i);
    await p.command('tell -1');
    await p.waitOutput(/tell doesn't like -1/i);
  });
  t.test('a fresh run starts with one turtle', async (p) => {
    await p.command('setturtle 4');
    await p.runProgram('print turtles print who\n');
    await p.waitOutput(/^0\n0$/m);
  });

  // ---- SETSCRUNCH ---------------------------------------------------------------------------------
  t.test('SETSCRUNCH stretches sideways moves', async (p) => {
    await p.command('setscrunch 2 1 rt 90 fd 50');
    p.assert.equal((await p.turtle()).x, 100);
    p.assert.equal(await show(p, 'scrunch'), '[2 1]');
  });
  t.test('SETSCRUNCH squashes up and down moves', async (p) => {
    await p.command('setscrunch 1 0.5 fd 100');
    p.assert.equal((await p.turtle()).y, 50);
  });
  t.test('SETSCRUNCH makes ARC an oval', async (p) => {
    await p.command('setscrunch 2 1 arc 360 50');
    p.assert.ok((await inkNear(p, 100, 0, 2))[3] > 150);
    p.assert.ok((await inkNear(p, 0, 50, 2))[3] > 150);
    p.assert.equal((await inkNear(p, 50, 0, 2))[3], 0);
  });
  t.test('SETSCRUNCH 0 is refused', async (p) => {
    await p.command('setscrunch 0 1');
    await p.waitOutput(/setscrunch doesn't like 0/i);
    p.assert.equal(await show(p, 'scrunch'), '[1 1]');
  });

  // ---- SAVEPICT and LOADPICT --------------------------------------------------------------------
  t.test('SAVEPICT writes a PNG file', async (p) => {
    await p.command('fd 100 savepict "/projects/e2e-pic.png', { until: ['idle', 'error'] });
    const sig = await p.ev("Array.from(LG.app.vfs.readFile('/projects/e2e-pic.png').slice(0, 8))");
    p.assert.deepEqual(sig, [137, 80, 78, 71, 13, 10, 26, 10]);
  });
  t.test('LOADPICT brings a saved drawing back', async (p) => {
    await p.command('setpensize 4 setpc 4 rt 90 fd 150 savepict "/projects/e2e-pic.png cs', { until: ['idle', 'error'] });
    p.assert.equal(await totalInk(p), 0);
    await p.command('loadpict "/projects/e2e-pic.png', { until: ['idle', 'error'] });
    p.assert.ok(near(await px(p, 75, 0), [255, 0, 0], 30));
    p.assert.ok(near(await px(p, 75, 50), [255, 255, 255], 12), 'the background comes back as part of the picture');
  });
  t.test('SAVEPICT keeps the background colour', async (p) => {
    await p.command('setbg 1 savepict "/projects/e2e-pic.png setbg 7 cs loadpict "/projects/e2e-pic.png', { until: ['idle', 'error'] });
    p.assert.ok(near(await px(p, -200, -200), [0, 0, 255], 12));
  });
  t.test('a relative SAVEPICT name goes in the current folder', async (p) => {
    await p.command('chdir "/projects savepict "e2e-rel.png', { until: ['idle', 'error'] });
    p.assert.equal(await p.ev("LG.app.vfs.exists('/projects/e2e-rel.png')"), true);
    await p.ev("LG.app.vfs.unlink('/projects/e2e-rel.png', {trusted: true})");
  });
  t.test('LOADPICT of a missing file is an error', async (p) => {
    await p.command('loadpict "/projects/no-such-picture.png', { until: ['idle', 'error'] });
    await p.waitOutput(/file system error/i);
  });
  t.test('LOADPICT of a text file is an error', async (p) => {
    await p.ev("LG.app.vfs.writeText('/projects/e2e-notpic.png', 'hello', {trusted: true})");
    await p.command('loadpict "/projects/e2e-notpic.png', { until: ['idle', 'error'] });
    await p.waitOutput(/not a picture/i);
  });
  t.test('SAVEPICT into /examples is refused', async (p) => {
    await p.command('savepict "/examples/e2e.png', { until: ['idle', 'error'] });
    await p.waitOutput(/file system error/i);
    p.assert.equal(await p.ev("LG.app.vfs.exists('/examples/e2e.png')"), false);
  });
}

/** How many pixels near the turtle's spot on screen look red or blue (the shape in the pen colour) */
async function screenColorAt(p, x, y) {
  await p.ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
  return p.fn((x, y) => {
    const tv = LG.app.turtleView, v = tv.view;
    const sx = Math.round(v.x + (x + 400) * v.k), sy = Math.round(v.y + (300 - y) * v.k);
    const R = Math.ceil(14 * v.k);
    const d = tv.ctx.getImageData(sx - R, sy - R, 2 * R + 1, 2 * R + 1).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (!(d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235)) n++;
    return n;
  }, x, y);
}
