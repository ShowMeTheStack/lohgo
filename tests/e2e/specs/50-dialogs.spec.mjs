// Dialogs: About, Keyboard shortcuts and Looks, and how every dialog behaves: focus stays
// inside, Escape and a click outside close it, Enter presses the default button, and the IDE's
// keys do nothing while it is open.
import { tabWalk, focusInside } from './50-ui-lib.mjs';

const DIALOGS = [
  { name: 'About', open: (p) => p.click('#brand'), title: 'About Lohgo', menu: 'About Lohgo', first: 'OK', js: 'LG.app.aboutDialog()' },
  { name: 'Keyboard shortcuts', open: (p) => p.ev('LG.app.shortcutsDialog()'), title: 'Keyboard shortcuts', menu: 'Keyboard shortcuts', first: 'OK', js: 'LG.app.shortcutsDialog()' },
  { name: 'Looks', open: (p) => p.click('#railSettings'), title: 'Looks and settings', menu: 'Colours and themes', first: 'setFont', js: 'LG.app.settingsDialog()' },
];
const focused = (p) => p.ev("(() => { const a = document.activeElement; return a ? (a.id || a.textContent.trim()) : ''; })()");

export default function (t) {
  // ---- About ---------------------------------------------------------------------------------------
  t.test('About shows the version number', async (p) => {
    await p.click('#brand');
    await p.waitModal();
    const txt = await p.modalText();
    p.assert.match(txt, /Lohgo version \d+\.\d+(\.\d+)?/);
    p.assert.doesNotMatch(txt, /@@/);
    await p.key('Escape');
  }, { fresh: true });

  t.test('About shows the copyright and the author', async (p) => {
    await p.click('#brand');
    await p.waitModal();
    p.assert.match(await p.modalText(), /Copyright © 2026 Jyotiprakash Mishra <mail@jyotiprakash\.org>/);
    await p.key('Escape');
  }, { fresh: true });

  t.test('About states the licence, the attribution term and no warranty', async (p) => {
    await p.click('#brand');
    await p.waitModal();
    const txt = await p.modalText();
    p.assert.match(txt, /GNU General Public License, version 3 or later/);
    p.assert.match(txt, /Based on "Lohgo" by Jyotiprakash Mishra \(https:\/\/lohgo\.jyotiprakash\.org\)/);
    p.assert.match(txt, /NO WARRANTY/);
    p.assert.match(txt, /not affiliated/);
    await p.key('Escape');
  }, { fresh: true });

  t.test('About links to the website and the source code in a new tab', async (p) => {
    await p.click('#brand');
    await p.waitModal();
    const links = await p.ev("[...document.querySelectorAll('.modal a')].map(a => [a.textContent, a.href, a.target, a.rel])");
    p.assert.deepEqual(links, [
      ['lohgo.jyotiprakash.org', 'https://lohgo.jyotiprakash.org/', '_blank', 'noopener'],
      ['source code', 'https://github.com/ShowMeTheStack/lohgo', '_blank', 'noopener'],
      ['About the author…', p.b.url + '#', '', ''],
    ]);
    await p.key('Escape');
  }, { fresh: true });

  t.test('the links in About can be reached with Tab', async (p) => {
    await p.click('#brand');
    await p.waitModal();
    const seen = await tabWalk(p, 3);
    p.assert.ok(seen.includes('lohgo.jyotiprakash.org') && seen.includes('source code'), seen.join(','));
    await p.key('Escape');
  }, { fresh: true });

  // ---- Keyboard shortcuts ------------------------------------------------------------------------
  t.test('Keyboard shortcuts lists the main keys', async (p) => {
    await p.ev('LG.app.shortcutsDialog()');
    await p.waitModal();
    const rows = await p.ev("[...document.querySelectorAll('.modal tr')].map(r => [r.cells[0].textContent, r.cells[1].textContent])");
    p.assert.equal(rows.length, 21);
    const m = Object.fromEntries(rows);
    p.assert.equal(m.F5, 'Run, or continue a paused program');
    p.assert.equal(m['Shift+F5'], 'Stop');
    p.assert.equal(m.F9, 'Breakpoint on the current line');
    p.assert.equal(m['Ctrl+S'], 'Save');
    p.assert.equal(m.F4, 'Big turtle world');
    await p.key('Escape');
  }, { fresh: true });

  t.test('every shortcut key is shown as a key cap', async (p) => {
    await p.ev('LG.app.shortcutsDialog()');
    await p.waitModal();
    p.assert.equal(await p.count('.modal tr td:first-child kbd'), 21);
    await p.key('Escape');
  }, { fresh: true });

  // ---- each dialog's behaviour -------------------------------------------------------------------
  for (const D of DIALOGS) {
    t.test(`${D.name}: opens from the menu`, async (p) => {
      await p.menu(D.menu);
      p.assert.equal(await p.waitModal(), D.title);
      await p.key('Escape');
    }, { fresh: true });

    t.test(`${D.name}: is a labelled modal dialog`, async (p) => {
      await D.open(p);
      await p.waitModal();
      p.assert.equal(await p.attr('.modal', 'role'), 'dialog');
      p.assert.equal(await p.attr('.modal', 'aria-modal'), 'true');
      p.assert.equal(await p.attr('.modal', 'aria-label'), D.title);
      // it sits above everything else
      const hit = await p.ev("(() => { const r = document.querySelector('.modal').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + 20); return !!e.closest('.modal'); })()");
      p.assert.ok(hit);
      await p.key('Escape');
    }, { fresh: true });

    t.test(`${D.name}: focus starts on its first control`, async (p) => {
      await D.open(p);
      await p.waitModal();
      await p.sleep(60);
      p.assert.equal(await focused(p), D.first);
      await p.key('Escape');
    }, { fresh: true });

    t.test(`${D.name}: Tab keeps focus inside and comes back round`, async (p) => {
      await D.open(p);
      await p.waitModal();
      await p.sleep(60);
      const n = await p.ev("[...document.querySelectorAll('.modal button, .modal input, .modal select, .modal textarea, .modal a[href], .modal [tabindex]:not([tabindex=\"-1\"])')].filter(x => !x.disabled && x.offsetParent !== null).length");
      const start = await focused(p);
      for (let i = 0; i < n; i++) {
        await p.key('Tab');
        p.assert.ok(await focusInside(p, '.modal'), 'focus left the dialog after ' + (i + 1) + ' tabs');
      }
      p.assert.equal(await focused(p), start, 'after one full round focus is back where it started');
      await p.key('Escape');
    }, { fresh: true });

    t.test(`${D.name}: Shift+Tab keeps focus inside and wraps to the end`, async (p) => {
      await D.open(p);
      await p.waitModal();
      await p.sleep(60);
      await p.ev("document.querySelector('.modal-foot button').focus()");
      await p.key('Tab', { shift: true });
      p.assert.ok(await focusInside(p, '.modal'));
      await p.ev("(() => { const f = [...document.querySelectorAll('.modal button, .modal input, .modal a[href]')].filter(x => x.offsetParent !== null); f[0].focus(); })()");
      await p.key('Tab', { shift: true });
      p.assert.ok(await focusInside(p, '.modal'));
      p.assert.equal(await p.ev("document.activeElement === [...document.querySelectorAll('.modal button, .modal input, .modal a[href]')].filter(x => x.offsetParent !== null).pop()"), true, 'wrapped to the last control');
      await p.key('Escape');
    }, { fresh: true });

    t.test(`${D.name}: Escape closes it and gives focus back`, async (p) => {
      await p.click('#cmdInput');
      await p.ev(D.js);
      await p.waitModal();
      await p.sleep(60);
      p.assert.notEqual(await p.ev('document.activeElement.id'), 'cmdInput');
      await p.key('Escape');
      await p.waitGone('.modal-back');
      p.assert.equal(await p.ev('document.activeElement.id'), 'cmdInput');
    }, { fresh: true });

    t.test(`${D.name}: Enter presses the default button`, async (p) => {
      await D.open(p);
      await p.waitModal();
      await p.sleep(60);
      await p.key('Enter');
      await p.waitGone('.modal-back');
    }, { fresh: true });

    t.test(`${D.name}: a click outside closes it`, async (p) => {
      await D.open(p);
      await p.waitModal();
      await p.clickAt(8, 450);
      await p.waitGone('.modal-back');
      // the click did not reach the rail or anything else behind
      p.assert.equal(await p.modalOpen(), false);
    }, { fresh: true });

    t.test(`${D.name}: a click inside does not close it`, async (p) => {
      await D.open(p);
      await p.waitModal();
      await p.click('.modal-head');
      await p.click('.modal-body');
      p.assert.equal(await p.modalOpen(), true);
      await p.key('Escape');
    }, { fresh: true });

    t.test(`${D.name}: F5 behind it does not run the program`, async (p) => {
      await D.open(p);
      await p.waitModal();
      await p.key('F5');
      await p.sleep(150);
      p.assert.equal(await p.state(), 'idle');
      p.assert.doesNotMatch(await p.output(), /Running/);
      await p.key('Escape');
    }, { fresh: true });

    t.test(`${D.name}: F4, Ctrl+O and Alt+N behind it do nothing`, async (p) => {
      await D.open(p);
      await p.waitModal();
      await p.key('F4');
      await p.key('o', { ctrl: true });
      await p.key('n', { alt: true });
      await p.sleep(100);
      p.assert.equal(await p.ev("document.getElementById('worldCard').classList.contains('fullscreen')"), false);
      p.assert.equal(await p.count('.modal-back'), 1);
      p.assert.equal(await p.ev('LG.app.docs.length'), 1);
      await p.key('Escape');
    }, { fresh: true });

    t.test(`${D.name}: typing does not reach the editor or the command center`, async (p) => {
      await p.ev('LG.app.active.editor.focus()');
      const code = await p.code();
      await D.open(p);
      await p.waitModal();
      await p.ev("document.querySelector('.modal-foot button').focus()");
      // no spaces: Space on the focused button would press it, which is right
      await p.type('fdxyz');
      await p.key('Backspace');
      p.assert.equal(await p.modalOpen(), true);
      p.assert.equal(await p.code(), code);
      p.assert.equal(await p.ev("document.getElementById('cmdInput').value"), '');
      await p.key('Escape');
    }, { fresh: true });
  }

  // ---- more dialog behaviour ----------------------------------------------------------------------
  t.test('Escape closes only the top dialog when two are open', async (p) => {
    await p.click('#brand');
    await p.waitModal();
    await p.ev('LG.app.shortcutsDialog()');
    await p.wait("document.querySelectorAll('.modal-back').length === 2");
    await p.key('Escape');
    p.assert.equal(await p.count('.modal-back'), 1);
    p.assert.equal(await p.modalTitle(), 'About Lohgo');
    await p.key('Escape');
    p.assert.equal(await p.count('.modal-back'), 0);
  }, { fresh: true });

  t.test('a prompt returns what was typed when Enter is pressed', async (p) => {
    await p.newFile('/projects/lines.lgo', 'a\nb\nc\nd\ne\nf\n');
    await p.ev('LG.app.active.editor.focus()');
    await p.key('g', { ctrl: true });
    p.assert.equal(await p.waitModal(), 'Go to line');
    await p.sleep(60);
    await p.type('4');
    await p.key('Enter');
    await p.waitGone('.modal-back');
    await p.wait('LG.app.active.editor.cursor().line === 3');
  }, { fresh: true });

  t.test('a prompt cancelled with Escape changes nothing', async (p) => {
    await p.newFile('/projects/lines.lgo', 'a\nb\nc\n');
    await p.ev('LG.app.active.editor.focus(); LG.app.active.editor.setCursor(1, 0)');
    await p.key('g', { ctrl: true });
    await p.waitModal();
    await p.type('3');
    await p.key('Escape');
    await p.waitGone('.modal-back');
    p.assert.equal(await p.ev('LG.app.active.editor.cursor().line'), 1);
  }, { fresh: true });

  t.test('a prompt starts with its text selected so typing replaces it', async (p) => {
    await p.ev('void LG.app.saveAs()');
    await p.waitModal();
    await p.sleep(60);
    p.assert.equal(await p.ev("(() => { const i = document.querySelector('.modal input'); return i.selectionStart === 0 && i.selectionEnd === i.value.length && i.value.length > 0; })()"), true);
    await p.key('Escape');
  }, { fresh: true });

  t.test('a confirm dialog answers no on Escape and yes on Enter', async (p) => {
    await p.ev("window.__c = []; void LG.UI.confirm('Sure?', 'Really?').then(v => window.__c.push(v))");
    await p.waitModal();
    await p.key('Escape');
    await p.wait('window.__c.length === 1');
    await p.ev("void LG.UI.confirm('Sure?', 'Really?').then(v => window.__c.push(v))");
    await p.waitModal();
    await p.sleep(40);
    await p.key('Enter');
    await p.wait('window.__c.length === 2');
    p.assert.deepEqual(await p.ev('window.__c'), [false, true]);
  }, { fresh: true });

  t.test('the Library sheet keeps focus inside as well', async (p) => {
    await p.click('#railLibrary');
    await p.waitModal();
    for (let i = 0; i < 12; i++) await p.key('Tab');
    p.assert.ok(await focusInside(p, '.modal'));
    await p.key('Escape');
    await p.waitGone('.modal-back');
  }, { fresh: true });

  t.test('a dialog closes the open menu behind it', async (p) => {
    await p.click('#menuBtn');
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.click('.menu-pop .menu-item', 'Keyboard shortcuts');
    await p.waitModal();
    p.assert.equal(await p.exists('.menu-pop'), false);
    await p.key('Escape');
  }, { fresh: true });

  t.test('the main menu can be driven with the keyboard', async (p) => {
    await p.click('#menuBtn');
    await p.wait("!!document.querySelector('.menu-pop')");
    await p.key('ArrowUp');
    p.assert.equal(await p.ev("document.querySelector('.menu-pop .menu-item.active').textContent"), 'About Lohgo');
    await p.key('Enter');
    p.assert.equal(await p.waitModal(), 'About Lohgo');
    await p.key('Escape');
  }, { fresh: true });
}
