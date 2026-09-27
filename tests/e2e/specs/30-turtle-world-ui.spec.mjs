// The turtle world card: grid, zoom, panning, the readouts, saving a picture, the big world,
// the welcome bubble, resizing and the touch keypad.
import { resetWorld, nextFrame, screenPx, worldToPage, near, inkNear, show } from './30-world-lib.mjs';

const view = (p) => p.ev('JSON.stringify(LG.app.turtleView.view)').then(JSON.parse);
const zoomChip = (p) => p.ev("(() => { const c = document.getElementById('zoomChip'); return c.classList.contains('hidden') ? '' : c.textContent; })()");

async function wheel(p, x, y, deltaY, ctrl = true) {
  await p.b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY, modifiers: ctrl ? 2 : 0 });
  await p.sleep(60);
}
async function drag(p, from, to, steps = 5) {
  await p.mouse('mouseMoved', from[0], from[1]);
  await p.mouse('mousePressed', from[0], from[1]);
  for (let i = 1; i <= steps; i++) await p.mouse('mouseMoved', from[0] + (to[0] - from[0]) * i / steps, from[1] + (to[1] - from[1]) * i / steps);
  await p.mouse('mouseReleased', to[0], to[1]);
  await p.sleep(60);
}
/** Replace LG.UI.download with a recorder; returns nothing, read window.__downloads */
const stubDownload = (p) => p.ev(`(() => { window.__downloads = []; LG.UI.download = (name, data, type) => window.__downloads.push({ name, type, bytes: Array.from(data instanceof Uint8Array ? data : []) }); })()`);
/** Decode the last recorded PNG and read one pixel of it */
const decodeLast = (p, x, y) => p.fn(async (x, y) => {
  const d = window.__downloads[window.__downloads.length - 1];
  const bmp = await createImageBitmap(new Blob([new Uint8Array(d.bytes)], { type: 'image/png' }));
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const g = c.getContext('2d');
  g.drawImage(bmp, 0, 0);
  return { w: bmp.width, h: bmp.height, px: x === null ? null : Array.from(g.getImageData(x, y, 1, 1).data) };
}, x, y);

export default function (t) {
  t.beforeEach(async (p) => {
    await resetWorld(p);
    await p.ev("LG.app.turtleView.toggleGrid(false); LG.app.toggleBigWorld(false)");
    await p.sleep(30);
  });

  // ---- the grid ------------------------------------------------------------------------------------
  t.test('the grid button draws graph paper', async (p) => {
    await p.command('ht');
    const before = await screenPx(p, 100, 37);
    p.assert.ok(near(before, [255, 255, 255], 6), 'plain paper ' + before);
    await p.click('#tbGrid');
    p.assert.match(await p.attr('#tbGrid', 'class'), /\bon\b/);
    const after = await screenPx(p, 100, 37);
    p.assert.ok(after[0] < 250, 'a grid line ' + after);
    const between = await screenPx(p, 112, 37);
    p.assert.ok(between[0] > after[0], 'between the lines is lighter');
  });
  t.test('the grid button turns the grid off again', async (p) => {
    await p.command('ht');
    await p.click('#tbGrid');
    await p.click('#tbGrid');
    p.assert.doesNotMatch(await p.attr('#tbGrid', 'class'), /\bon\b/);
    p.assert.ok(near(await screenPx(p, 100, 37), [255, 255, 255], 6));
  });
  t.test('the axes are darker than the other grid lines', async (p) => {
    await p.command('ht');
    await p.click('#tbGrid');
    const axis = await screenPx(p, 0, 37);
    const hundred = await screenPx(p, 100, 37);
    const minor = await screenPx(p, 25, 37);
    p.assert.ok(axis[0] < hundred[0] && hundred[0] < minor[0], `${axis} ${hundred} ${minor}`);
  });
  t.test('the grid is not part of the drawing', async (p) => {
    await p.click('#tbGrid');
    p.assert.equal(await p.ev('LG.app.world.ctx.getImageData(0, 0, 1600, 1200).data.some((v, i) => i % 4 === 3 && v > 0)'), false);
  });
  t.test('the grid shows up white on a dark background', async (p) => {
    await p.command('ht setbg 0');
    await p.click('#tbGrid');
    const c = await screenPx(p, 0, 37);
    p.assert.ok(c[0] > 20, 'light line on black ' + c);
  });
  t.test('the grid choice is remembered after a reload', async (p) => {
    await p.click('#tbGrid');
    p.assert.equal(await p.ev("JSON.parse(localStorage.getItem('lohgo.settings')).grid"), true);
    await p.reload();
    p.assert.match(await p.attr('#tbGrid', 'class'), /\bon\b/);
    p.assert.equal(await p.ev('LG.app.turtleView.grid'), true);
    await p.click('#tbGrid');
    p.assert.equal(await p.ev("JSON.parse(localStorage.getItem('lohgo.settings')).grid"), false);
  });
  t.test('the menu item toggles the grid and shows a tick', async (p) => {
    await p.menu('Graph paper grid');
    p.assert.equal(await p.ev('LG.app.turtleView.grid'), true);
    await p.click('#menuBtn');
    p.assert.equal((await p.menuItems()).find((i) => i.label === 'Graph paper grid').checked, true);
    await p.click('.menu-pop .menu-item', 'Graph paper grid');
    p.assert.equal(await p.ev('LG.app.turtleView.grid'), false);
  });
  t.test('the settings dialog checkbox toggles the grid', async (p) => {
    await p.click('#railSettings');
    await p.waitModal();
    await p.click('#set-grid');
    p.assert.equal(await p.ev('LG.app.turtleView.grid'), true);
    p.assert.match(await p.attr('#tbGrid', 'class'), /\bon\b/);
    await p.click('#set-grid');
    p.assert.equal(await p.ev('LG.app.turtleView.grid'), false);
    await p.modalButton('Done');
  });

  // ---- zoom -------------------------------------------------------------------------------------------
  t.test('the zoom chip is hidden at normal size', async (p) => {
    p.assert.equal(await zoomChip(p), '');
  });
  t.test('zoom in makes the world bigger and shows 125%', async (p) => {
    const v1 = await view(p);
    await p.click('#tbZoomIn');
    const v2 = await view(p);
    p.assert.ok(Math.abs(v2.w / v1.w - 1.25) < 0.01);
    p.assert.equal(await zoomChip(p), '125%');
  });
  t.test('zoom out makes it smaller and shows 80%', async (p) => {
    await p.click('#tbZoomOut');
    p.assert.equal(await zoomChip(p), '80%');
    await p.click('#tbZoomOut');
    p.assert.equal(await zoomChip(p), '64%');
  });
  t.test('fit puts the zoom back to 100% and hides the chip', async (p) => {
    await p.click('#tbZoomIn');
    await p.click('#tbZoomIn');
    await p.click('#tbZoomFit');
    p.assert.equal(await zoomChip(p), '');
    p.assert.equal(await p.ev('LG.app.turtleView.zoomK'), 1);
  });
  t.test('zoom in then out comes back to 100%', async (p) => {
    await p.click('#tbZoomIn');
    await p.click('#tbZoomOut');
    p.assert.equal(await zoomChip(p), '');
  });
  t.test('zooming in stops at 1200%', async (p) => {
    for (let i = 0; i < 16; i++) await p.click('#tbZoomIn');
    p.assert.equal(await zoomChip(p), '1200%');
  });
  t.test('zooming out stops at 25%', async (p) => {
    for (let i = 0; i < 10; i++) await p.click('#tbZoomOut');
    p.assert.equal(await zoomChip(p), '25%');
  });
  t.test('a zoomed in line is wider on screen', async (p) => {
    await p.command('ht setpensize 2 rt 90 fd 300');
    const count = () => p.fn(() => {
      const tv = LG.app.turtleView, v = tv.view;
      const sx = Math.round(v.x + 450 * v.k);
      const y0 = Math.max(0, Math.ceil(v.y)), y1 = Math.min(tv.canvas.height, Math.floor(v.y + v.h));
      const d = tv.ctx.getImageData(sx, y0, 1, y1 - y0).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] === 255 && d[i] < 128) n++;
      return n;
    });
    await nextFrame(p);
    const a = await count();
    await p.click('#tbZoomIn'); await p.click('#tbZoomIn'); await p.click('#tbZoomIn');
    await nextFrame(p);
    const b = await count();
    p.assert.ok(b > a, `${a} -> ${b}`);
  });
  t.test('Ctrl+wheel up zooms in', async (p) => {
    const [x, y] = await p.center('#worldCanvas');
    await wheel(p, x, y, -100);
    p.assert.equal(await zoomChip(p), '112%');
    await wheel(p, x, y, -100);
    p.assert.equal(await zoomChip(p), '125%');
  });
  t.test('Ctrl+wheel down zooms out', async (p) => {
    const [x, y] = await p.center('#worldCanvas');
    await wheel(p, x, y, 100);
    p.assert.equal(await zoomChip(p), '89%');
  });
  t.test('the wheel without Ctrl does not zoom', async (p) => {
    const [x, y] = await p.center('#worldCanvas');
    await wheel(p, x, y, -100, false);
    p.assert.equal(await p.ev('LG.app.turtleView.zoomK'), 1);
  });
  t.test('the world stays 4:3 at every zoom', async (p) => {
    for (const b of ['#tbZoomIn', '#tbZoomIn', '#tbZoomOut', '#tbZoomOut', '#tbZoomOut']) {
      await p.click(b);
      const v = await view(p);
      p.assert.ok(Math.abs(v.w / v.h - 4 / 3) < 0.001);
    }
  });
  t.test('ZOOM from Logo sets the zoom', async (p) => {
    await p.command('zoom 2');
    p.assert.equal(await zoomChip(p), '200%');
    await p.command('zoom 0');
    await p.waitOutput(/zoom doesn't like 0/);
  });

  // ---- panning --------------------------------------------------------------------------------------
  t.test('dragging pans a zoomed-in world', async (p) => {
    await p.click('#tbZoomIn'); await p.click('#tbZoomIn');
    const v1 = await view(p);
    const [x, y] = await p.center('#worldCanvas');
    await drag(p, [x, y], [x + 60, y - 40]);
    const v2 = await view(p);
    p.assert.ok(Math.abs(v2.x - v1.x - 60) <= 1 && Math.abs(v2.y - v1.y + 40) <= 1, `${v1.x},${v1.y} -> ${v2.x},${v2.y}`);
  });
  t.test('dragging does nothing at normal size', async (p) => {
    const v1 = await view(p);
    const [x, y] = await p.center('#worldCanvas');
    await drag(p, [x, y], [x + 60, y + 30]);
    const v2 = await view(p);
    p.assert.deepEqual([v2.x, v2.y], [v1.x, v1.y]);
  });
  t.test('a panned drawing moves on screen with the pan', async (p) => {
    await p.command('ht setpensize 6 setpc 4 fd 100');
    await p.click('#tbZoomIn'); await p.click('#tbZoomIn');
    const [x, y] = await p.center('#worldCanvas');
    await drag(p, [x, y], [x + 80, y]);
    const k = (await view(p)).k;
    // the screen point that showed world x=0 now shows world x = -80/k
    p.assert.ok(near(await screenPx(p, 0, 50), [255, 0, 0], 60), 'the line is at its world position');
    const atOld = await p.fn((sx, sy) => Array.from(LG.app.turtleView.ctx.getImageData(sx, sy, 1, 1).data).slice(0, 3), Math.round(x - 1), Math.round(y - 50 * k - 1));
    p.assert.ok(!near(atOld, [255, 0, 0], 60), 'nothing red where it used to be');
  });
  t.test('fit puts a panned world back in the middle', async (p) => {
    const v0 = await view(p);
    await p.click('#tbZoomIn'); await p.click('#tbZoomIn');
    const [x, y] = await p.center('#worldCanvas');
    await drag(p, [x, y], [x + 50, y + 50]);
    await p.click('#tbZoomFit');
    const v = await view(p);
    p.assert.deepEqual([v.x, v.y], [v0.x, v0.y]);
  });
  t.test('zooming back out to 100% undoes the pan', async (p) => {
    await p.click('#tbZoomIn');
    const [x, y] = await p.center('#worldCanvas');
    await drag(p, [x, y], [x + 50, y]);
    await p.click('#tbZoomOut');
    p.assert.deepEqual(await p.ev('LG.app.turtleView.pan'), [0, 0]);
  });
  t.test('dragging does not pan while a program runs', async (p) => {
    await p.click('#tbZoomIn'); await p.click('#tbZoomIn');
    await p.runProgram('forever [wait 1]\n', { wait: false });
    await p.sleep(100);
    const v1 = await view(p);
    const [x, y] = await p.center('#worldCanvas');
    await drag(p, [x, y], [x + 60, y]);
    const v2 = await view(p);
    p.assert.equal(v2.x, v1.x);
    await p.stopProgram();
  });

  // ---- readouts -----------------------------------------------------------------------------------------
  t.test('the position chip shows x, y and heading', async (p) => {
    await p.command('setxy 120 -45 seth 30');
    await nextFrame(p);
    p.assert.match(await p.text('#turtleChip'), /^x 120\s+y -45\s+30°$/);
  });
  t.test('the position chip shows one decimal for fractions', async (p) => {
    await p.command('setxy 1.25 2.5');
    await nextFrame(p);
    p.assert.match(await p.text('#turtleChip'), /x 1\.3\s+y 2\.5/);
  });
  t.test('the status bar repeats the turtle position', async (p) => {
    await p.command('setxy -10 20');
    await nextFrame(p);
    p.assert.equal(await p.text('#sbTurtle'), await p.text('#turtleChip'));
  });
  for (const [label, zoomClicks] of [['at normal size', 0], ['zoomed in', 3], ['zoomed out', -2]]) {
    t.test(`the status bar shows the mouse position in turtle steps ${label}`, async (p) => {
      for (let i = 0; i < Math.abs(zoomClicks); i++) await p.click(zoomClicks > 0 ? '#tbZoomIn' : '#tbZoomOut');
      for (const [wx, wy] of [[0, 0], [100, 50], [-80, -60]]) {
        const [x, y] = await worldToPage(p, wx, wy);
        await p.mouse('mouseMoved', x, y);
        await p.sleep(30);
        const m = /^mouse (-?[\d.]+), (-?[\d.]+)$/.exec(await p.text('#sbPos'));
        p.assert.ok(m, 'readout ' + await p.text('#sbPos'));
        const tol = 2 / (await view(p)).k;
        p.assert.ok(Math.abs(+m[1] - wx) <= tol && Math.abs(+m[2] - wy) <= tol, `${wx},${wy} read as ${m[1]},${m[2]}`);
      }
    });
  }
  t.test('the world info and chips do not cover the toolbar', async (p) => {
    const chip = await p.rect('#turtleChip');
    const card = await p.rect('#worldCard');
    p.assert.ok(chip.bottom <= card.bottom && chip.x >= card.x);
  });

  // ---- save picture ---------------------------------------------------------------------------------------
  t.test('the camera button saves the drawing as a PNG named after the program', async (p) => {
    await p.newFile('/projects/e2e-art.lgo', 'fd 10\n');
    await stubDownload(p);
    await p.command('setpensize 6 setpc 4 rt 90 fd 100');
    await p.click('#tbSnap');
    const d = await p.ev('window.__downloads[0]');
    p.assert.equal(d.name, 'e2e-art.png');
    p.assert.equal(d.type, 'image/png');
    p.assert.deepEqual(d.bytes.slice(0, 4), [137, 80, 78, 71]);
  });
  t.test('the saved picture is the whole world at twice the size', async (p) => {
    await stubDownload(p);
    await p.click('#tbSnap');
    const r = await decodeLast(p, null, null);
    p.assert.deepEqual([r.w, r.h], [1600, 1200]);
  });
  t.test('the saved picture holds the drawing and the background', async (p) => {
    await stubDownload(p);
    await p.command('ht setbg 1 setpensize 6 setpc 4 rt 90 fd 100');
    await p.click('#tbSnap');
    p.assert.ok(near((await decodeLast(p, 900, 600)).px, [255, 0, 0], 20), 'the line');
    p.assert.ok(near((await decodeLast(p, 900, 300)).px, [0, 0, 255], 20), 'the background');
  });
  t.test('the saved picture leaves out the grid', async (p) => {
    await stubDownload(p);
    await p.command('ht');
    await p.click('#tbGrid');
    await p.click('#tbSnap');
    p.assert.ok(near((await decodeLast(p, 1000, 525)).px, [255, 255, 255], 3));
  });
  t.test('the menu item saves a picture too', async (p) => {
    await stubDownload(p);
    await p.menu('Save the drawing as a picture');
    p.assert.equal(await p.ev('window.__downloads.length'), 1);
  });

  // ---- the big world -------------------------------------------------------------------------------------
  t.test('F4 makes the world big and Escape puts it back', async (p) => {
    const small = await p.rect('#worldCard');
    await p.key('F4');
    p.assert.match(await p.attr('#worldCard', 'class'), /fullscreen/);
    await p.sleep(80);
    const big = await p.rect('#worldCard');
    p.assert.ok(big.w > small.w && big.h > small.h);
    p.assert.ok(big.w >= 1400 - 30);
    await p.key('Escape');
    p.assert.doesNotMatch(await p.attr('#worldCard', 'class'), /fullscreen/);
  });
  t.test('F4 twice toggles back', async (p) => {
    await p.key('F4');
    await p.key('F4');
    p.assert.doesNotMatch(await p.attr('#worldCard', 'class'), /fullscreen/);
  });
  t.test('the big world button toggles the big world', async (p) => {
    await p.click('#tbBig');
    p.assert.match(await p.attr('#worldCard', 'class'), /fullscreen/);
    await p.click('#tbBig');
    p.assert.doesNotMatch(await p.attr('#worldCard', 'class'), /fullscreen/);
  });
  t.test('the canvas grows with the big world and keeps 4:3', async (p) => {
    const v1 = await view(p);
    await p.key('F4');
    await p.sleep(150);
    const v2 = await view(p);
    p.assert.ok(v2.w > v1.w * 1.3, `${v1.w} -> ${v2.w}`);
    p.assert.ok(Math.abs(v2.w / v2.h - 4 / 3) < 0.001);
    const c = await p.rect('#worldCanvas');
    p.assert.equal(await p.ev('LG.app.turtleView.canvas.width'), Math.round(c.w));
    await p.key('Escape');
  });
  t.test('Escape does not leave the big world while a program runs', async (p) => {
    await p.key('F4');
    await p.runProgram('forever [wait 1]\n', { wait: false });
    await p.sleep(80);
    await p.key('Escape');
    p.assert.match(await p.attr('#worldCard', 'class'), /fullscreen/);
    await p.stopProgram();
    await p.key('Escape');
    p.assert.doesNotMatch(await p.attr('#worldCard', 'class'), /fullscreen/);
  });
  t.test('FULLSCREEN and SPLITSCREEN from Logo', async (p) => {
    await p.runProgram('fullscreen\nprint screenmode\n');
    p.assert.match(await p.attr('#worldCard', 'class'), /fullscreen/);
    await p.waitOutput(/^FULLSCREEN$/m);
    await p.runProgram('splitscreen\nprint screenmode\n');
    p.assert.doesNotMatch(await p.attr('#worldCard', 'class'), /fullscreen/);
    await p.waitOutput(/^SPLITSCREEN$/m);
  });
  t.test('the menu item opens the big world', async (p) => {
    await p.menu('Big turtle world');
    p.assert.match(await p.attr('#worldCard', 'class'), /fullscreen/);
    await p.key('Escape');
  });

  // ---- the welcome bubble ---------------------------------------------------------------------------------
  t.test('a fresh page greets you with three examples', async (p) => {
    await p.fresh();
    p.assert.ok(await p.visible('#welcome'));
    p.assert.match(await p.text('#welcome h2'), /Hello! I am your turtle\./);
    p.assert.deepEqual(await p.texts('#welcome code'), ['fd 100 rt 90 fd 100', 'repeat 36 [fd 10 rt 10]', 'repeat 5 [fd 120 rt 144]']);
  }, { timeout: 40000 });
  t.test('clicking an example runs it and the bubble goes away', async (p) => {
    await p.fresh();
    await p.click('#welcome code', 'fd 100 rt 90 fd 100');
    await p.waitState('idle');
    p.assert.equal(await p.exists('#welcome'), false);
    const tt = await p.turtle();
    p.assert.deepEqual([tt.x, tt.y, tt.heading], [100, 100, 90]);
    await p.waitOutput(/fd 100 rt 90 fd 100/);
  }, { timeout: 40000 });
  t.test('the star example draws a star', async (p) => {
    await p.fresh();
    await p.click('#welcome code', 'repeat 5');
    await p.waitState('idle');
    p.assert.equal(await p.segments(), 5);
    p.assert.ok((await inkNear(p, 0, 60))[3] > 150);
  }, { timeout: 40000 });
  t.test('typing a command hides the bubble', async (p) => {
    await p.fresh();
    await p.command('rt 10');
    p.assert.equal(await p.exists('#welcome'), false);
  }, { timeout: 40000 });
  t.test('running a program hides the bubble', async (p) => {
    await p.fresh();
    await p.key('F5');
    await p.waitState(['idle', 'error']);
    p.assert.equal(await p.exists('#welcome'), false);
  }, { timeout: 40000 });

  // ---- resizing ------------------------------------------------------------------------------------------------
  for (const [w, h] of [[1400, 900], [1100, 800], [900, 700], [1600, 1000]]) {
    t.test(`at ${w}x${h} the world fills its card and keeps 4:3`, async (p) => {
      await p.viewport(w, h);
      await p.sleep(150);
      const wrap = await p.rect('#worldWrap');
      const cw = await p.ev('LG.app.turtleView.canvas.width');
      const ch = await p.ev('LG.app.turtleView.canvas.height');
      p.assert.ok(Math.abs(cw - wrap.w) <= 1 && Math.abs(ch - wrap.h) <= 1, `canvas ${cw}x${ch} wrap ${wrap.w}x${wrap.h}`);
      const v = await view(p);
      p.assert.ok(Math.abs(v.w / v.h - 4 / 3) < 0.001);
      p.assert.ok(v.x >= 0 && v.y >= 0 && v.x + v.w <= cw + 1 && v.y + v.h <= ch + 1, 'the whole world is visible');
      p.assert.ok(Math.abs((cw - v.w) - 2 * v.x) <= 2 || Math.abs((ch - v.h) - 2 * v.y) <= 2, 'centred');
      p.assert.ok(Math.min(v.x, v.y) <= 13, 'it touches the padding on one side');
      await p.viewport(1400, 900);
    });
  }
  t.test('a drawing stays put in turtle steps when the window changes size', async (p) => {
    await p.command('ht setpensize 6 setpc 4 rt 90 fd 100');
    await p.viewport(1000, 760);
    await p.sleep(150);
    p.assert.ok(near(await screenPx(p, 50, 0), [255, 0, 0], 60));
    await p.viewport(1400, 900);
    await p.sleep(150);
    p.assert.ok(near(await screenPx(p, 50, 0), [255, 0, 0], 60));
  });
  t.test('dragging the splitter resizes the world', async (p) => {
    const v1 = await view(p);
    const r = await p.rect('#splitRight');
    await drag(p, [r.x + r.w / 2, r.y + r.h / 2], [r.x + r.w / 2 + 150, r.y + r.h / 2]);
    await p.sleep(150);
    const v2 = await view(p);
    p.assert.notEqual(v2.w, v1.w);
    p.assert.ok(Math.abs(v2.w / v2.h - 4 / 3) < 0.001);
    await p.ev("localStorage.removeItem('lohgo.sizes'); document.documentElement.style.removeProperty('--right-w')");
  });

  // ---- touch keypad ------------------------------------------------------------------------------------------
  t.test('the keypad is hidden on a desktop', async (p) => {
    p.assert.equal(await p.visible('#worldKeys'), false);
  });
  t.test('on a touch device the keypad shows', async (p) => {
    await p.fresh({ touch: true });
    p.assert.equal(await p.ev("document.body.classList.contains('touch')"), true);
    p.assert.ok(await p.visible('#worldKeys'));
    p.assert.equal(await p.count('#worldKeys .key'), 8);
  }, { timeout: 40000 });
  for (const [label, want] of [['ArrowUp', 'UP'], ['ArrowLeft', 'LEFT'], ['ArrowRight', 'RIGHT'], ['ArrowDown', 'DOWN'], [' ', ' '], ['Enter', '\n'], ['Escape', '\u001b']]) {
    t.test(`tapping the ${JSON.stringify(label)} key sends it to READCHAR`, async (p) => {
      await p.fresh({ touch: true });
      await p.runProgram('make "k readchar\n', { wait: false });
      await p.waitState('input');
      await p.tap(`#worldKeys .key[aria-label="${label}"]`);
      await p.waitState('idle');
      p.assert.equal(await p.ev("LG.app.interp.globals.get('k')"), want);
    }, { timeout: 40000 });
  }
  t.test('keypad taps queue up for KEYP and READCHAR', async (p) => {
    await p.fresh({ touch: true });
    await p.runProgram('make "seen [] wait 30\nwhile [keyp] [make "seen lput readchar :seen]\n', { wait: false });
    await p.waitState('waiting');
    await p.tap('#worldKeys .key[aria-label="ArrowLeft"]');
    await p.tap('#worldKeys .key[aria-label="ArrowRight"]');
    await p.waitState('idle', 4000);
    p.assert.equal(await show(p, ':seen'), '[LEFT RIGHT]');
  }, { timeout: 40000 });
  t.test('the keyboard key asks for the on-screen keyboard', async (p) => {
    await p.fresh({ touch: true });
    await p.tap('#worldKeys .key[aria-label="Show keyboard"]');
    await p.waitToast(/keys go to your program/);
    p.assert.equal(await p.focusedId(), 'cmdInput');
  }, { timeout: 40000 });
  t.test('keypad taps do nothing when no program runs', async (p) => {
    await p.fresh({ touch: true });
    await p.tap('#worldKeys .key[aria-label="ArrowUp"]');
    p.assert.equal(await p.ev('LG.app.turtleView.keys.length'), 0);
    p.assert.equal(await p.state(), 'idle');
  }, { timeout: 40000 });
}

