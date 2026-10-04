// Tablets and small laptops (721 to 1180 wide): the side panel floats over the stage and
// closes when you tap somewhere else.
import { rects, overlap, assertReachable, textOf } from './50-ui-lib.mjs';

const SIZES = [
  { width: 768, height: 1024, mobile: true, touch: true },
  { width: 1024, height: 768, mobile: true, touch: true },
  { width: 820, height: 1180, mobile: true, touch: true },
  { width: 1180, height: 820, mobile: false, touch: false },
];
const sideOpen = (p) => p.ev("!document.getElementById('side').classList.contains('closed')");

export default function (t) {
  for (const S of SIZES) {
    const tag = `${S.width}x${S.height}`;

    t.test(`${tag}: the side panel starts closed even if it was open before`, async (p) => {
      p.assert.equal(await sideOpen(p), false);
      await p.ev("localStorage.setItem('lohgo.side', JSON.stringify('files'))");
      await p.reload();
      p.assert.equal(await sideOpen(p), false);
    }, { fresh: S });

    t.test(`${tag}: Files opens a panel floating over the stage`, async (p) => {
      const before = await rects(p, ['#stage', '#worldCard']);
      await (S.touch ? p.tap : p.click)('#railFiles');
      p.assert.equal(await sideOpen(p), true);
      const r = await rects(p, ['#side', '#stage', '#worldCard', '#rail']);
      p.assert.equal(await p.ev("getComputedStyle(document.getElementById('side')).position"), 'fixed');
      p.assert.ok(overlap(r['#side'], r['#worldCard']), 'the panel covers part of the stage');
      p.assert.deepEqual([Math.round(r['#stage'].x), Math.round(r['#stage'].w)], [Math.round(before['#stage'].x), Math.round(before['#stage'].w)], 'the stage does not move');
      p.assert.ok(Math.abs(r['#side'].x - r['#rail'].right) < 1, 'panel starts at the rail');
      p.assert.ok(r['#side'].bottom <= S.height, 'panel fits the height');
      p.assert.ok(Number(await p.ev("getComputedStyle(document.getElementById('side')).zIndex")) > 1);
    }, { fresh: S });

    t.test(`${tag}: tapping the stage closes the floating panel`, async (p) => {
      await (S.touch ? p.tap : p.click)('#railFiles');
      p.assert.equal(await sideOpen(p), true);
      await (S.touch ? p.tap : p.click)('#editorCard .card-body');
      p.assert.equal(await sideOpen(p), false);
      p.assert.ok(!(await p.ev("document.getElementById('railFiles').classList.contains('active')")));
    }, { fresh: S });

    t.test(`${tag}: clicking the top bar also closes the floating panel`, async (p) => {
      await p.click('#railProcs');
      p.assert.equal(await sideOpen(p), true);
      await p.click('#proj, #top .top-gap');
      p.assert.equal(await sideOpen(p), false);
    }, { fresh: S });

    t.test(`${tag}: tapping inside the floating panel keeps it open`, async (p) => {
      await (S.touch ? p.tap : p.click)('#railFiles');
      await (S.touch ? p.tap : p.click)('#sideBody .trow', 'projects');
      p.assert.equal(await sideOpen(p), true);
      await (S.touch ? p.tap : p.click)('#sideTitle');
      p.assert.equal(await sideOpen(p), true);
    }, { fresh: S });

    t.test(`${tag}: the rail button toggles the floating panel`, async (p) => {
      await (S.touch ? p.tap : p.click)('#railFiles');
      p.assert.equal(await sideOpen(p), true);
      await (S.touch ? p.tap : p.click)('#railFiles');
      p.assert.equal(await sideOpen(p), false);
      await (S.touch ? p.tap : p.click)('#railProcs');
      p.assert.equal(await textOf(p, '#sideTitle'), 'Procedures');
      await (S.touch ? p.tap : p.click)('#railFiles');
      p.assert.equal(await textOf(p, '#sideTitle'), 'Files');
    }, { fresh: S });

    t.test(`${tag}: a dialog opened from the panel does not close it`, async (p) => {
      await (S.touch ? p.tap : p.click)('#railFiles');
      await (S.touch ? p.tap : p.click)('#fNew');
      await p.waitModal();
      await (S.touch ? p.tap : p.click)('.modal-back:last-child .modal-head');
      p.assert.equal(await sideOpen(p), true);
      await p.key('Escape');
    }, { fresh: S });

    t.test(`${tag}: opening a program from the floating panel works`, async (p) => {
      await (S.touch ? p.tap : p.click)('#railFiles');
      await p.wait("[...document.querySelectorAll('#sideBody .trow')].some(r => /tree\\.lgo/.test(r.textContent))");
      await (S.touch ? p.tap : p.click)('#sideBody .trow', 'tree.lgo');
      await p.wait("LG.app.active.path === '/examples/tree.lgo'");
    }, { fresh: S });

    t.test(`${tag}: the panel's contents can be used`, async (p) => {
      await (S.touch ? p.tap : p.click)('#railFiles');
      await assertReachable(p, ['#fNew', '#fNewFolder', '#fImport', '#sideBody .trow']);
    }, { fresh: S });
  }

  t.test('768 wide: the project path and step labels are hidden to save room', async (p) => {
    p.assert.equal(await p.visible('#proj'), false);
    p.assert.equal(await p.visible('#tbInto .lbl'), false);
    p.assert.equal(await p.visible('#speedBox .lbl'), false);
    p.assert.ok(await p.visible('#tbInto'));
  }, { fresh: SIZES[0] });

  t.test('1024 wide: the Run label stays but step labels go', async (p) => {
    p.assert.ok(await p.visible('#tbRun .lbl'));
    p.assert.equal(await p.visible('#tbOver .lbl'), false);
  }, { fresh: SIZES[1] });

  t.test('growing from a tablet to a desktop keeps an open panel in the layout', async (p) => {
    await p.click('#railFiles');
    await p.viewport(1400, 900);
    await p.sleep(100);
    p.assert.equal(await p.ev("getComputedStyle(document.getElementById('side')).position"), 'static');
    const r = await rects(p, ['#side', '#stage']);
    p.assert.ok(r['#stage'].x >= r['#side'].right - 0.5, 'stage beside the panel');
  }, { fresh: SIZES[1] });

  t.test('on a desktop a click on the stage does not close the panel', async (p) => {
    await p.click('#editorCard .card-body');
    p.assert.equal(await sideOpen(p), true);
  }, { fresh: true });
}
