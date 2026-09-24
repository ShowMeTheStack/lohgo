// Sharing: the share dialog, share links opened on load, the Open a shared program dialog,
// bad and unsafe codes, and zip downloads.
import { tidy, openFilesPanel, row, expand, put, rm, closeAll, disk, exists, tabNames, rowMenu, pick, stubDownload, downloads, unzip, stubClipboard } from './20-ed-lib.mjs';

const pack = (p, meta, files) => p.fn(async (m, f) => {
  const enc = {};
  for (const [k, v] of Object.entries(f)) enc[k] = LG.utf8(v);
  return LG.Share.pack(m, enc);
}, meta, files);
/** A share code built by hand (to make codes the app itself would never make) */
const rawCode = (p, obj, compress) => p.fn(async (o, z) => {
  const b64 = (bytes) => { let s = ''; for (const c of bytes) s += String.fromCharCode(c); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const files = {};
  for (const [k, v] of Object.entries(o.files || {})) files[k] = typeof v === 'string' ? b64(LG.utf8(v)) : v;
  const json = LG.utf8(JSON.stringify(o.files ? Object.assign({}, o, { files }) : o));
  if (!z) return 'LHG1.r' + b64(json);
  const res = new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw')));
  return 'LHG1.z' + b64(new Uint8Array(await res.arrayBuffer()));
}, obj, !!compress);
const sharedDirs = (p) => p.ev("LG.app.vfs.exists('/projects/shared') ? LG.app.vfs.list('/projects/shared').map((e) => e.name) : []");
async function importViaDialog(p, text) {
  await p.menu('Open a shared program…');
  p.assert.equal(await p.waitModal(), 'Open a shared program');
  await p.ev(`(() => { const t = document.getElementById('importCode'); t.focus(); t.value = ${JSON.stringify(text)}; })()`);
  await p.modalButton('Open');
  await p.sleep(250);
}
async function shareDialogFor(p, path) {
  await p.ev(`LG.app.openFile(${JSON.stringify(path)})`);
  await p.click('#tbShare');
  return p.waitModal();
}

export default function (t) {
  t.beforeEach(async (p) => {
    await tidy(p);
    await closeAll(p);
    await rm(p, '/projects/shared');
    await rm(p, '/projects/s');
    await put(p, '/projects/s/main.lgo', 'to hi\nprint "hello\nend\nhi\n');
    await put(p, '/projects/s/helper.lgo', 'to helper\nend\n');
    await put(p, '/projects/s/art/pic.txt', 'picture');
    await p.ev("document.querySelectorAll('.toast').forEach((t) => t.remove())");
  });
  t.afterEach(tidy);

  // ---- the share dialog ------------------------------------------------------------------------------
  t.test('the Share button opens a dialog named after the program', async (p) => {
    p.assert.equal(await shareDialogFor(p, '/projects/s/main.lgo'), 'Share main');
  });
  t.test('the share dialog has a link, a code and three buttons', async (p) => {
    await shareDialogFor(p, '/projects/s/main.lgo');
    p.assert.ok(await p.visible('#shareLink'));
    p.assert.ok(await p.visible('#shareCode'));
    p.assert.deepEqual(await p.texts('.modal-foot button'), ['Close', 'Copy code', 'Copy link']);
  });
  t.test('the link is this page with #share= and the code', async (p) => {
    await shareDialogFor(p, '/projects/s/main.lgo');
    const link = await p.ev("document.getElementById('shareLink').value");
    const code = await p.ev("document.getElementById('shareCode').value");
    const base = await p.ev('location.origin + location.pathname');
    p.assert.equal(link, base + '#share=' + code);
    p.assert.match(code, /^LHG1\.[zr][A-Za-z0-9_-]+$/);
  });
  t.test('the link and code are read-only', async (p) => {
    await shareDialogFor(p, '/projects/s/main.lgo');
    p.assert.equal(await p.ev("document.getElementById('shareLink').readOnly && document.getElementById('shareCode').readOnly"), true);
  });
  t.test('the link is selected, ready to copy', async (p) => {
    await shareDialogFor(p, '/projects/s/main.lgo');
    await p.sleep(60);
    p.assert.equal(await p.ev("(() => { const l = document.getElementById('shareLink'); return l.selectionStart === 0 && l.selectionEnd === l.value.length; })()"), true);
  });
  t.test('the dialog says how big the link is', async (p) => {
    await shareDialogFor(p, '/projects/s/main.lgo');
    const kb = await p.ev("(document.getElementById('shareLink').value.length / 1024).toFixed(1) + ' KB'");
    p.assert.equal(await p.text('.modal .hint'), kb);
  });
  t.test('a big program gives a bigger size note', async (p) => {
    await put(p, '/projects/s/big.lgo', Array.from({ length: 3000 }, (_, i) => `print ${i * 7919 % 1000003}`).join('\n'));
    await shareDialogFor(p, '/projects/s/big.lgo');
    p.assert.ok(parseFloat(await p.text('.modal .hint')) > 5);
  });
  t.test('one program is described as this program', async (p) => {
    await shareDialogFor(p, '/projects/s/main.lgo');
    p.assert.match(await p.modalText(), /gets their own copy of this program/);
    p.assert.match(await p.modalText(), /nothing is uploaded/);
  });
  t.test('Copy link copies the link and says so', async (p) => {
    await stubClipboard(p);
    await shareDialogFor(p, '/projects/s/main.lgo');
    await p.modalButton('Copy link');
    await p.waitToast(/Link copied/);
    p.assert.deepEqual(await p.ev('window.__clip'), [await p.ev("document.getElementById('shareLink').value")]);
    p.assert.equal(await p.modalOpen(), true);
  });
  t.test('Copy code copies just the code', async (p) => {
    await stubClipboard(p);
    await shareDialogFor(p, '/projects/s/main.lgo');
    await p.modalButton('Copy code');
    await p.waitToast(/Code copied/);
    p.assert.deepEqual(await p.ev('window.__clip'), [await p.ev("document.getElementById('shareCode').value")]);
  });
  t.test('when copying is not allowed the dialog says to copy by hand', async (p) => {
    await stubClipboard(p, true);
    await shareDialogFor(p, '/projects/s/main.lgo');
    await p.modalButton('Copy link');
    await p.waitToast(/Select it and copy it yourself/);
  });
  t.test('Close closes the share dialog', async (p) => {
    await shareDialogFor(p, '/projects/s/main.lgo');
    await p.modalButton('Close');
    p.assert.equal(await p.modalOpen(), false);
  });
  t.test('Share as a link in the main menu opens the dialog', async (p) => {
    await p.ev("LG.app.openFile('/projects/s/main.lgo')");
    await p.menu('Share as a link…');
    p.assert.equal(await p.waitModal(), 'Share main');
  });
  t.test('an example can be shared', async (p) => {
    p.assert.equal(await shareDialogFor(p, '/examples/spiral.lgo'), 'Share spiral');
  });
  t.test('the code holds the program text, including unsaved changes', async (p) => {
    await p.ev("LG.app.openFile('/projects/s/main.lgo')");
    await p.ev('LG.app.settings.autosave = false');
    try {
      await p.setCode('print "unsaved\n');
      await p.click('#tbShare');
      await p.waitModal();
      const code = await p.ev("document.getElementById('shareCode').value");
      const pkg = await p.fn(async (c) => { const r = await LG.Share.unpack(c); return { meta: r.meta, files: Object.fromEntries(Object.entries(r.files).map(([k, v]) => [k, LG.unutf8(v)])) }; }, code);
      p.assert.deepEqual(pkg.files, { 'main.lgo': 'print "unsaved\n' });
      p.assert.equal(pkg.meta.name, 'main');
      p.assert.equal(pkg.meta.lang, 'logo');
    } finally { await p.ev('LG.app.settings.autosave = true'); }
  });
  t.test('sharing a folder holds every file in it with relative paths', async (p) => {
    await openFilesPanel(p);
    await expand(p, '/projects', '/projects/s');
    await rowMenu(p, '/projects/s');
    await pick(p, 'Share this folder');
    p.assert.equal(await p.waitModal(), 'Share s');
    p.assert.match(await p.modalText(), /these 3 files/);
    const code = await p.ev("document.getElementById('shareCode').value");
    const names = await p.fn(async (c) => Object.keys((await LG.Share.unpack(c)).files).sort(), code);
    p.assert.deepEqual(names, ['art/pic.txt', 'helper.lgo', 'main.lgo']);
  });
  t.test('sharing a folder remembers the open program in it as the main one', async (p) => {
    await p.ev("LG.app.openFile('/projects/s/helper.lgo')");
    await openFilesPanel(p);
    await expand(p, '/projects', '/projects/s');
    await rowMenu(p, '/projects/s');
    await pick(p, 'Share this folder');
    await p.waitModal();
    const code = await p.ev("document.getElementById('shareCode').value");
    p.assert.equal(await p.fn(async (c) => (await LG.Share.unpack(c)).meta.main, code), 'helper.lgo');
  });
  t.test('the share code is compressed', async (p) => {
    await put(p, '/projects/s/rep.lgo', 'fd 10 rt 10\n'.repeat(500));
    await shareDialogFor(p, '/projects/s/rep.lgo');
    const code = await p.ev("document.getElementById('shareCode').value");
    p.assert.match(code, /^LHG1\.z/);
    p.assert.ok(code.length < 1000, code.length);
  });

  // ---- opening a #share= link on load -------------------------------------------------------------------
  t.test('a #share= link makes a copy under /projects/shared and opens it', async (p) => {
    const code = await pack(p, { name: 'party', main: 'main.lgo', lang: 'logo' }, { 'main.lgo': 'print "party', 'other.lgo': 'print 2' });
    await p.fresh({ hash: 'share=' + code });
    await p.wait("LG.app.active && LG.app.active.path === '/projects/shared/party/main.lgo'", 5000);
    p.assert.equal(await disk(p, '/projects/shared/party/other.lgo'), 'print 2');
    p.assert.equal(await p.code(), 'print "party');
  }, { timeout: 40000 });
  t.test('after opening a share link the address no longer has the code', async (p) => {
    const code = await pack(p, { name: 'party', main: 'main.lgo' }, { 'main.lgo': 'print 1' });
    await p.fresh({ hash: 'share=' + code });
    await p.wait("LG.app.active && LG.app.active.path.startsWith('/projects/shared/')", 5000);
    p.assert.equal(await p.ev('location.hash'), '');
  }, { timeout: 40000 });
  t.test('opening a share link says where the copy is', async (p) => {
    const code = await pack(p, { name: 'party', main: 'main.lgo' }, { 'main.lgo': 'print 1' });
    await p.fresh({ hash: 'share=' + code });
    await p.waitToast(/Opened your copy in \/projects\/shared\/party/);
  }, { timeout: 40000 });
  t.test('a shared program opened from a link runs', async (p) => {
    const code = await pack(p, { name: 'sq', main: 'sq.lgo' }, { 'sq.lgo': 'repeat 4 [fd 50 rt 90]\n' });
    await p.fresh({ hash: 'share=' + code });
    await p.wait("LG.app.active && LG.app.active.path === '/projects/shared/sq/sq.lgo'", 5000);
    await p.key('F5');
    await p.waitState('idle');
    p.assert.equal(await p.segments(), 4);
  }, { timeout: 40000 });
  t.test('a share link with folders keeps them', async (p) => {
    const code = await pack(p, { name: 'game', main: 'src/game.lgo' }, { 'src/game.lgo': 'load "../lib/util.lgo', 'lib/util.lgo': 'to util end' });
    await p.fresh({ hash: 'share=' + code });
    await p.wait("LG.app.active && LG.app.active.path === '/projects/shared/game/src/game.lgo'", 5000);
    p.assert.equal(await disk(p, '/projects/shared/game/lib/util.lgo'), 'to util end');
  }, { timeout: 40000 });
  t.test('a share link shows the shared folder open in the tree', async (p) => {
    const code = await pack(p, { name: 'party', main: 'main.lgo' }, { 'main.lgo': 'print 1' });
    await p.fresh({ hash: 'share=' + code });
    await p.wait("LG.app.active && LG.app.active.path.startsWith('/projects/shared/')", 5000);
    await openFilesPanel(p);
    await p.wait(`!!document.querySelector('.trow[data-path="/projects/shared/party/main.lgo"]')`, 3000);
  }, { timeout: 40000 });
  t.test('a bad share link on load shows an error and opens nothing new', async (p) => {
    await p.fresh({ hash: 'share=LHG1.zAAAA' });
    await p.waitToast(/damaged or incomplete/);
    p.assert.deepEqual(await sharedDirs(p), []);
  }, { timeout: 40000 });

  // ---- the Open a shared program dialog ----------------------------------------------------------------------
  t.test('Open a shared program takes a pasted code', async (p) => {
    const code = await pack(p, { name: 'pasted', main: 'p.lgo' }, { 'p.lgo': 'print "pasted' });
    await importViaDialog(p, code);
    p.assert.equal(await p.activePath(), '/projects/shared/pasted/p.lgo');
    p.assert.equal(await p.code(), 'print "pasted');
  });
  t.test('Open a shared program takes a whole pasted link', async (p) => {
    const code = await pack(p, { name: 'linked', main: 'p.lgo' }, { 'p.lgo': 'print 1' });
    await importViaDialog(p, 'https://lohgo.jyotiprakash.org/#share=' + code);
    p.assert.equal(await p.activePath(), '/projects/shared/linked/p.lgo');
  });
  t.test('spaces and new lines around a pasted code are ignored', async (p) => {
    const code = await pack(p, { name: 'spaced', main: 'p.lgo' }, { 'p.lgo': 'print 1' });
    await importViaDialog(p, '\n   ' + code + '  \n');
    p.assert.equal(await p.activePath(), '/projects/shared/spaced/p.lgo');
  });
  t.test('opening the same share twice makes a second copy', async (p) => {
    const code = await pack(p, { name: 'twice', main: 'p.lgo' }, { 'p.lgo': 'print 1' });
    await importViaDialog(p, code);
    await importViaDialog(p, code);
    p.assert.deepEqual((await sharedDirs(p)).sort(), ['twice', 'twice-2']);
    p.assert.equal(await p.activePath(), '/projects/shared/twice-2/p.lgo');
  });
  t.test('the dialog explains what to paste', async (p) => {
    await p.menu('Open a shared program…');
    await p.waitModal();
    p.assert.match(await p.modalText(), /Paste a link someone shared with you/);
    p.assert.equal(await p.attr('#importCode', 'placeholder'), 'Paste a Lohgo link or share code here');
  });
  t.test('Cancel in the dialog imports nothing', async (p) => {
    await p.menu('Open a shared program…');
    await p.waitModal();
    await p.ev("document.getElementById('importCode').value = 'LHG1.rAAAA'");
    await p.modalButton('Cancel');
    await p.sleep(150);
    p.assert.deepEqual(await sharedDirs(p), []);
    p.assert.equal(await p.ev("[...document.querySelectorAll('.toast')].length"), 0);
  });
  t.test('Open with an empty box does nothing', async (p) => {
    await importViaDialog(p, '');
    p.assert.deepEqual(await sharedDirs(p), []);
    p.assert.equal(await p.ev("[...document.querySelectorAll('.toast.err')].length"), 0);
  });
  t.test('Enter in the code box makes a new line, not a submit', async (p) => {
    await p.menu('Open a shared program…');
    await p.waitModal();
    await p.click('#importCode');
    await p.key('Enter');
    p.assert.equal(await p.modalOpen(), true);
  });
  t.test('a whole share round trip: share, paste, same files', async (p) => {
    await openFilesPanel(p);
    await expand(p, '/projects', '/projects/s');
    await rowMenu(p, '/projects/s');
    await pick(p, 'Share this folder');
    await p.waitModal();
    const link = await p.ev("document.getElementById('shareLink').value");
    await p.modalButton('Close');
    await importViaDialog(p, link);
    for (const f of ['main.lgo', 'helper.lgo', 'art/pic.txt']) p.assert.equal(await disk(p, '/projects/shared/s/' + f), await disk(p, '/projects/s/' + f), f);
  });
  t.test('accented letters and symbols survive sharing', async (p) => {
    const code = await pack(p, { name: 'unicode', main: 'u.lgo' }, { 'u.lgo': 'print "Größe ; π ≈ 3.14 🐢' });
    await importViaDialog(p, code);
    p.assert.equal(await disk(p, '/projects/shared/unicode/u.lgo'), 'print "Größe ; π ≈ 3.14 🐢');
  });
  t.test('a binary file survives sharing byte for byte', async (p) => {
    const bytes = Array.from({ length: 256 }, (_, i) => i);
    const code = await p.fn((b) => LG.Share.pack({ name: 'bin', main: null }, { 'all.bin': new Uint8Array(b), 'x.lgo': LG.utf8('print 1') }), bytes);
    await importViaDialog(p, code);
    p.assert.deepEqual(await p.ev("Array.from(LG.app.vfs.readFile('/projects/shared/bin/all.bin'))"), bytes);
  });
  t.test('an uncompressed code works too', async (p) => {
    const code = await rawCode(p, { v: 1, meta: { name: 'plain', main: 'a.lgo' }, files: { 'a.lgo': 'print "plain' } });
    p.assert.match(code, /^LHG1\.r/);
    await importViaDialog(p, code);
    p.assert.equal(await p.activePath(), '/projects/shared/plain/a.lgo');
  });
  t.test('without a main program the first program is opened', async (p) => {
    const code = await rawCode(p, { v: 1, meta: { name: 'nomain' }, files: { 'readme.md': 'hi', 'b.lgo': 'print "b' } }, true);
    await importViaDialog(p, code);
    p.assert.equal(await p.activePath(), '/projects/shared/nomain/b.lgo');
  });
  t.test('a main program that is not in the code is ignored', async (p) => {
    const code = await rawCode(p, { v: 1, meta: { name: 'badmain', main: 'missing.lgo' }, files: { 'b.lgo': 'print "b' } }, true);
    await importViaDialog(p, code);
    p.assert.equal(await p.activePath(), '/projects/shared/badmain/b.lgo');
  });
  t.test('a share without a name goes into /projects/shared/shared', async (p) => {
    const code = await rawCode(p, { v: 1, meta: {}, files: { 'b.lgo': 'print 1' } }, true);
    await importViaDialog(p, code);
    p.assert.equal(await p.activePath(), '/projects/shared/shared/b.lgo');
  });
  t.test('slashes and odd characters in the shared name are made safe', async (p) => {
    const code = await rawCode(p, { v: 1, meta: { name: '../../etc/a:b' }, files: { 'b.lgo': 'print 1' } }, true);
    await importViaDialog(p, code);
    const dirs = await sharedDirs(p);
    p.assert.equal(dirs.length, 1);
    p.assert.ok(!/[/:]/.test(dirs[0]), dirs[0]);
    p.assert.match(await p.activePath(), /^\/projects\/shared\/[^/]+\/b\.lgo$/);
  });
  t.test('a very long shared name is shortened', async (p) => {
    const code = await rawCode(p, { v: 1, meta: { name: 'n'.repeat(300) }, files: { 'b.lgo': 'print 1' } }, true);
    await importViaDialog(p, code);
    p.assert.equal((await sharedDirs(p))[0].length, 60);
  });
  t.test('dot folders inside a share are dropped from paths', async (p) => {
    const code = await rawCode(p, { v: 1, meta: { name: 'dots', main: 'a/./b.lgo' }, files: { 'a/./b.lgo': 'print 1' } }, true);
    await importViaDialog(p, code);
    p.assert.equal(await disk(p, '/projects/shared/dots/a/b.lgo'), 'print 1');
  });

  // ---- bad codes -----------------------------------------------------------------------------------------------
  const BAD = [
    ['plain words', 'hello there', /does not look like a Lohgo share code/],
    ['a web address without a code', 'https://example.com/#other=1', /does not look like a Lohgo share code/],
    ['a cut-off compressed code', 'LHG1.zq1YqK', /damaged or incomplete/],
    ['random letters after the prefix', 'LHG1.zZZZZZZZZZZZZZZZZ', /damaged or incomplete/],
    ['an uncompressed code that is not JSON', 'LHG1.raGVsbG8', /damaged or incomplete/],
  ];
  for (const [what, code, re] of BAD) {
    t.test(`a bad code (${what}) gives a clear error`, async (p) => {
      await importViaDialog(p, code);
      await p.waitToast(re);
      p.assert.deepEqual(await sharedDirs(p), []);
    });
  }
  t.test('a code from a newer version is refused', async (p) => {
    const code = await rawCode(p, { v: 2, meta: { name: 'future' }, files: { 'a.lgo': 'x' } }, true);
    await importViaDialog(p, code);
    await p.waitToast(/Unsupported share code version/);
    p.assert.deepEqual(await sharedDirs(p), []);
  });
  t.test('a code with no files is refused', async (p) => {
    const code = await rawCode(p, { v: 1, meta: { name: 'nofiles' } }, true);
    await importViaDialog(p, code);
    await p.waitToast(/Unsupported share code version/);
  });
  t.test('a code with an empty file list is refused and makes no folder', async (p) => {
    const code = await rawCode(p, { v: 1, meta: { name: 'empty' }, files: {} }, true);
    await importViaDialog(p, code);
    await p.waitToast(/has no files in it/);
    p.assert.deepEqual(await sharedDirs(p), []);
  });
  t.test('a code whose file data is broken is refused', async (p) => {
    const code = await rawCode(p, { v: 1, meta: { name: 'broken' }, files: { 'a.lgo': 42 } }, true);
    await importViaDialog(p, code);
    await p.waitToast(/damaged or incomplete/);
    p.assert.deepEqual(await sharedDirs(p), []);
  });
  t.test('the error for a bad code stays long enough to read', async (p) => {
    await importViaDialog(p, 'nonsense');
    await p.waitToast(/does not look like/);
    await p.sleep(4000);
    p.assert.equal(await p.ev("[...document.querySelectorAll('.toast')].some((t) => /does not look like/.test(t.innerText))"), true);
  }, { timeout: 15000 });

  // ---- unsafe paths -------------------------------------------------------------------------------------------------
  const UNSAFE = ['../evil.lgo', 'a/../../evil.lgo', '/etc/evil.lgo', 'C:/evil.lgo', 'c:evil.lgo', '\\\\server\\evil.lgo', 'a\\..\\..\\evil.lgo', '..'];
  for (const bad of UNSAFE) {
    t.test(`a share with the path ${JSON.stringify(bad)} is refused`, async (p) => {
      const code = await rawCode(p, { v: 1, meta: { name: 'evil' }, files: { 'ok.lgo': 'print 1', [bad]: 'print "evil' } }, true);
      await importViaDialog(p, code);
      await p.waitToast(/Unsafe path in share code/);
      p.assert.deepEqual(await sharedDirs(p), []);
      p.assert.equal(await exists(p, '/projects/evil.lgo'), false);
      p.assert.equal(await exists(p, '/evil.lgo'), false);
    });
  }
  t.test('an unsafe share link on load is refused too', async (p) => {
    const code = await rawCode(p, { v: 1, meta: { name: 'evil' }, files: { '../../x.lgo': 'print 1' } }, true);
    await p.fresh({ hash: 'share=' + code });
    await p.waitToast(/Unsafe path in share code/);
    p.assert.equal(await exists(p, '/x.lgo'), false);
    p.assert.deepEqual(await sharedDirs(p), []);
  }, { timeout: 40000 });
  t.test('names with two dots that are not folders are fine', async (p) => {
    const code = await rawCode(p, { v: 1, meta: { name: 'dots2', main: 'a..b.lgo' }, files: { 'a..b.lgo': 'print 1' } }, true);
    await importViaDialog(p, code);
    p.assert.equal(await p.activePath(), '/projects/shared/dots2/a..b.lgo');
  });

  // ---- zip downloads ----------------------------------------------------------------------------------------------
  t.test('a zip of a shared copy has the same files as the share', async (p) => {
    const code = await pack(p, { name: 'zipme', main: 'm.lgo' }, { 'm.lgo': 'print 1', 'd/e.txt': 'eee' });
    await importViaDialog(p, code);
    await stubDownload(p);
    await openFilesPanel(p);
    await expand(p, '/projects', '/projects/shared');
    await rowMenu(p, '/projects/shared/zipme');
    await pick(p, 'Download as .zip');
    const d = (await downloads(p))[0];
    p.assert.equal(d.name, 'zipme.zip');
    const z = unzip(d.bytes);
    p.assert.equal(z.__count, 2);
    p.assert.equal(z['m.lgo'], 'print 1');
    p.assert.equal(z['d/e.txt'], 'eee');
  });
  t.test('a zip has valid checksums', async (p) => {
    await stubDownload(p);
    await openFilesPanel(p);
    await expand(p, '/projects', '/projects/s');
    await rowMenu(p, '/projects/s');
    await pick(p, 'Download as .zip');
    const bytes = Buffer.from((await downloads(p))[0].bytes);
    const crc = (b) => { let c = 0xffffffff; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return (c ^ 0xffffffff) >>> 0; };
    let off = 0, n = 0;
    while (bytes.readUInt32LE(off) === 0x04034b50) {
      const size = bytes.readUInt32LE(off + 18), nlen = bytes.readUInt16LE(off + 26);
      const data = bytes.slice(off + 30 + nlen, off + 30 + nlen + size);
      p.assert.equal(bytes.readUInt32LE(off + 14), crc(data));
      off += 30 + nlen + size;
      n++;
    }
    p.assert.equal(n, 3);
  });
  t.test('a zip lists its files in a central directory', async (p) => {
    await stubDownload(p);
    await openFilesPanel(p);
    await expand(p, '/projects', '/projects/s');
    await rowMenu(p, '/projects/s');
    await pick(p, 'Download as .zip');
    const b = Buffer.from((await downloads(p))[0].bytes);
    const eocd = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const cdOff = b.readUInt32LE(eocd + 16), cdSize = b.readUInt32LE(eocd + 12);
    p.assert.equal(cdOff + cdSize, eocd);
    const names = [];
    for (let o = cdOff; o < cdOff + cdSize;) { const nl = b.readUInt16LE(o + 28); names.push(b.slice(o + 46, o + 46 + nl).toString()); o += 46 + nl; }
    p.assert.deepEqual(names.sort(), ['art/pic.txt', 'helper.lgo', 'main.lgo']);
  });
  t.test('the tabs are not changed by sharing or zipping', async (p) => {
    await p.ev("LG.app.openFile('/projects/s/main.lgo')");
    await stubDownload(p);
    await openFilesPanel(p);
    await expand(p, '/projects', '/projects/s');
    await rowMenu(p, '/projects/s');
    await pick(p, 'Download as .zip');
    p.assert.deepEqual(await tabNames(p), ['main.lgo']);
  });
}
