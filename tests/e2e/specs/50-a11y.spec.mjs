// Accessibility: names for buttons, tab and tree roles, live regions, the canvas label, visible
// keyboard focus, keyboard reach, and reduced motion.
import { media, tabWalk } from './50-ui-lib.mjs';

/** Visible buttons (and role=button elements) inside a container that have no accessible name */
const unnamed = (p, sel) => p.fn((s) => {
  const out = [];
  for (const root of document.querySelectorAll(s)) {
    for (const b of root.querySelectorAll('button, [role=button], [role=tab], [role=menuitem], input, textarea, select')) {
      const r = b.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (b.type === 'checkbox' && b.closest('label')) continue;
      const name = (b.getAttribute('aria-label') || '').trim() || (b.tagName !== 'INPUT' && b.tagName !== 'TEXTAREA' ? (b.textContent || '').trim() : '') || (b.getAttribute('title') || '').trim();
      if (!name) out.push(b.outerHTML.slice(0, 80));
    }
  }
  return out;
}, sel);

const REGIONS = [['top bar', '#top'], ['rail', '#rail'], ['side panel', '#side'], ['turtle world', '#worldCard'], ['command center', '#cmdCard'], ['editor', '#editorCard'], ['debugger', '#inspCard']];
const outline = (p) => p.ev("(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), shadow: cs.boxShadow, fv: a.matches(':focus-visible') }; })()");

export default function (t) {
  t.afterEach(async (p) => { await media(p, []); });

  // ---- names ---------------------------------------------------------------------------------------
  for (const [name, sel] of REGIONS) {
    t.test(`every button in the ${name} has a name`, async (p) => {
      p.assert.deepEqual(await unnamed(p, sel), []);
    });
  }

  t.test('every button in the paused debugger has a name', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'to f :n\nprint :n\nend\nf 3\n');
    await p.ev("LG.app.toggleBreakpoint('/projects/e2e.lgo', 1)");
    await p.ev("LG.app.inspector.addWatch(':n')");
    await p.key('F5');
    await p.waitState('paused');
    for (const tab of ['vars', 'stack', 'watch', 'bps', 'hist']) {
      await p.click('#itab-' + tab);
      p.assert.deepEqual(await unnamed(p, '#inspCard'), [], tab);
    }
    await p.stopProgram();
  }, { fresh: true });

  t.test('every button in the phone tab bar has a name', async (p) => {
    p.assert.deepEqual(await unnamed(p, '#mbar'), []);
    p.assert.deepEqual(await unnamed(p, '#worldKeys'), []);
  }, { fresh: { width: 390, height: 844, mobile: true, touch: true } });

  t.test('every control in the Looks dialog has a name', async (p) => {
    await p.click('#railSettings');
    await p.waitModal();
    p.assert.deepEqual(await unnamed(p, '.modal'), []);
    p.assert.equal(await p.attr('#setFont', 'aria-label'), 'Code size');
    await p.key('Escape');
  }, { fresh: true });

  t.test('every item in the main menu is a named menu item', async (p) => {
    await p.click('#menuBtn');
    await p.wait("!!document.querySelector('.menu-pop')");
    p.assert.equal(await p.attr('.menu-pop', 'role'), 'menu');
    const items = await p.ev("[...document.querySelectorAll('.menu-pop .menu-item')].map(e => [e.getAttribute('role'), e.textContent.trim().length > 0])");
    p.assert.ok(items.length > 25);
    p.assert.ok(items.every(([r, named]) => r === 'menuitem' && named));
    // section headings are not menu items
    p.assert.ok(await p.ev("[...document.querySelectorAll('.menu-pop .menu-head')].every(e => !e.getAttribute('role'))"));
    await p.closeMenus();
  }, { fresh: true });

  t.test('icons inside buttons are hidden from screen readers', async (p) => {
    p.assert.equal(await p.ev("[...document.querySelectorAll('button svg')].filter(s => s.getAttribute('aria-hidden') !== 'true').length"), 0);
  });

  t.test('the page has a language and labelled landmarks', async (p) => {
    p.assert.equal(await p.ev('document.documentElement.lang'), 'en');
    p.assert.equal(await p.attr('#rail', 'aria-label'), 'Panels');
    p.assert.equal(await p.attr('#side', 'aria-label'), 'Side panel');
    p.assert.equal(await p.attr('#mbar', 'aria-label'), 'Views');
    for (const [id, label] of [['worldCard', 'Turtle world'], ['cmdCard', 'Command center'], ['editorCard', 'Editor'], ['inspCard', 'Debugger']]) p.assert.equal(await p.attr('#' + id, 'aria-label'), label);
    p.assert.equal(await p.ev("document.getElementById('top').tagName"), 'HEADER');
    p.assert.equal(await p.ev("document.getElementById('status').tagName"), 'FOOTER');
  });

  t.test('the splitters are labelled separators', async (p) => {
    const s = await p.ev("['splitRight','splitCmd','splitInsp'].map(id => { const e = document.getElementById(id); return [e.getAttribute('role'), e.getAttribute('aria-orientation'), !!e.getAttribute('aria-label')]; })");
    p.assert.deepEqual(s, [['separator', 'vertical', true], ['separator', 'horizontal', true], ['separator', 'horizontal', true]]);
  });

  // ---- tabs ----------------------------------------------------------------------------------------
  t.test('debugger tabs say which one is selected', async (p) => {
    for (const k of ['stack', 'watch', 'bps', 'hist', 'vars']) {
      await p.click('#itab-' + k);
      const sel = await p.ev("[...document.querySelectorAll('#inspTabs [role=tab]')].map(b => b.id + '=' + b.getAttribute('aria-selected'))");
      p.assert.deepEqual(sel.filter((x) => x.endsWith('=true')), ['itab-' + k + '=true']);
      p.assert.equal(sel.length, 5);
    }
    p.assert.equal(await p.attr('#inspTabs', 'role'), 'tablist');
    p.assert.equal(await p.attr('#ipane-vars', 'role'), 'tabpanel');
  }, { fresh: true });

  t.test('editor tabs say which program is selected', async (p) => {
    await p.newFile('/projects/second.lgo', '');
    let sel = await p.ev("[...document.querySelectorAll('#editorTabs [role=tab]')].map(b => b.title + '=' + b.getAttribute('aria-selected'))");
    p.assert.deepEqual(sel, ['/projects/start.lgo=false', '/projects/second.lgo=true']);
    await p.click('#editorTabs .etab', 'start.lgo');
    sel = await p.ev("[...document.querySelectorAll('#editorTabs [role=tab]')].map(b => b.getAttribute('aria-selected'))");
    p.assert.deepEqual(sel, ['true', 'false']);
    p.assert.equal(await p.attr('#editorTabs', 'role'), 'tablist');
    p.assert.equal(await p.attr('#editorTabs .etab .x', 'aria-label'), 'Close start.lgo');
  }, { fresh: true });

  t.test('command center tabs say which one is selected', async (p) => {
    p.assert.equal(await p.attr('#cmdTabs', 'role'), 'tablist');
    p.assert.deepEqual(await p.ev("[...document.querySelectorAll('#cmdTabs .ctab')].map(b => [b.getAttribute('role'), b.getAttribute('aria-selected')])"), [['tab', 'true'], ['tab', 'false']]);
    await p.click('#tabProblems');
    p.assert.deepEqual(await p.ev("[...document.querySelectorAll('#cmdTabs .ctab')].map(b => b.getAttribute('aria-selected'))"), ['false', 'true']);
    await p.click('#tabCommands');
    p.assert.deepEqual(await p.ev("[...document.querySelectorAll('#cmdTabs .ctab')].map(b => b.getAttribute('aria-selected'))"), ['true', 'false']);
  }, { fresh: true });

  // ---- the file tree ------------------------------------------------------------------------------
  t.test('the file tree uses tree and treeitem roles', async (p) => {
    p.assert.equal(await p.attr('#sideBody .tree', 'role'), 'tree');
    p.assert.equal(await p.attr('#sideBody .tree', 'aria-label'), 'Files');
    p.assert.ok(await p.ev("[...document.querySelectorAll('#sideBody .tree > *')].every(r => r.getAttribute('role') === 'treeitem')"));
  }, { fresh: true });

  t.test('folders have aria-expanded and files do not', async (p) => {
    const rows = await p.ev("[...document.querySelectorAll('#sideBody .trow')].map(r => [r.dataset.path, r.getAttribute('aria-expanded')])");
    const m = Object.fromEntries(rows);
    p.assert.equal(m['/projects'], 'true');
    p.assert.equal(m['/examples'], 'true');
    p.assert.equal(m['/projects/start.lgo'], null);
  }, { fresh: true });

  t.test('clicking a folder flips aria-expanded', async (p) => {
    await p.click('#sideBody .trow[data-path="/examples"]');
    p.assert.equal(await p.attr('#sideBody .trow[data-path="/examples"]', 'aria-expanded'), 'false');
    p.assert.equal(await p.exists('#sideBody .trow[data-path="/examples/spiral.lgo"]'), false);
    await p.click('#sideBody .trow[data-path="/examples"]');
    p.assert.equal(await p.attr('#sideBody .trow[data-path="/examples"]', 'aria-expanded'), 'true');
  }, { fresh: true });

  t.test('Enter on a focused folder opens and closes it', async (p) => {
    await p.ev("document.querySelector('#sideBody .trow[data-path=\"/projects\"]').focus()");
    await p.key('Enter');
    p.assert.equal(await p.attr('#sideBody .trow[data-path="/projects"]', 'aria-expanded'), 'false');
    await p.ev("document.querySelector('#sideBody .trow[data-path=\"/projects\"]').focus()");
    await p.key('Enter');
    p.assert.equal(await p.attr('#sideBody .trow[data-path="/projects"]', 'aria-expanded'), 'true');
  }, { fresh: true });

  t.test('Enter on a focused file opens it', async (p) => {
    await p.ev("document.querySelector('#sideBody .trow[data-path=\"/examples/spiral.lgo\"]').focus()");
    await p.key('Enter');
    await p.wait("LG.app.active.path === '/examples/spiral.lgo'");
  }, { fresh: true });

  // ---- live regions and labels --------------------------------------------------------------------
  t.test('the transcript is a polite live region and output goes into it', async (p) => {
    p.assert.equal(await p.attr('#transcript', 'aria-live'), 'polite');
    await p.command('print "announced');
    p.assert.match(await p.text('#transcript'), /announced/);
  }, { fresh: true });

  t.test('toasts are announced', async (p) => {
    await p.ev("LG.UI.toast('hello there')");
    p.assert.equal(await p.attr('.toasts', 'role'), 'status');
    p.assert.equal(await p.attr('.toasts', 'aria-live'), 'polite');
  }, { fresh: true });

  t.test('the turtle canvas has a label and can take focus', async (p) => {
    p.assert.match(await p.attr('#worldCanvas', 'aria-label'), /Turtle drawing/);
    p.assert.equal(await p.ev("document.getElementById('worldCanvas').tabIndex"), 0);
  });

  t.test('the command input and the speed slider are labelled', async (p) => {
    p.assert.match(await p.attr('#cmdInput', 'aria-label'), /Logo instruction/);
    p.assert.equal(await p.attr('#speed', 'aria-label'), 'Turtle speed');
  });

  t.test('the paused frame in the call stack is marked current', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'to f :n\nif :n = 0 [print 0 stop]\nf :n - 1\nend\nf 2\n');
    await p.ev("LG.app.toggleBreakpoint('/projects/e2e.lgo', 1)");
    await p.key('F5');
    await p.waitState('paused');
    await p.click('#itab-stack');
    p.assert.equal(await p.count('#ipane-stack [aria-current=true]'), 1);
    p.assert.ok(await p.ev("[...document.querySelectorAll('#ipane-stack .frame-row')].every(r => r.getAttribute('role') === 'button' && r.tabIndex === 0)"));
    await p.stopProgram();
  }, { fresh: true });

  // ---- focus ---------------------------------------------------------------------------------------
  t.test('keyboard focus on a top bar button is clearly visible', async (p) => {
    await p.ev("document.getElementById('brand').focus()");
    await p.key('Tab');
    const o = await outline(p);
    p.assert.ok(o.fv, 'matches :focus-visible');
    p.assert.equal(o.style, 'solid');
    p.assert.ok(o.width >= 2);
  }, { fresh: true });

  t.test('keyboard focus on a rail button is clearly visible', async (p) => {
    await p.ev("document.getElementById('railFiles').focus()");
    await p.key('Tab');
    p.assert.equal(await p.ev('document.activeElement.id'), 'railProcs');
    const o = await outline(p);
    p.assert.ok(o.fv && o.style === 'solid' && o.width >= 2, JSON.stringify(o));
  }, { fresh: true });

  t.test('keyboard focus on the canvas shows a ring', async (p) => {
    await p.ev("document.getElementById('cmdInput').focus()");
    await p.key('Tab', { shift: true });
    for (let i = 0; i < 12 && (await p.ev('document.activeElement.id')) !== 'worldCanvas'; i++) await p.key('Tab', { shift: true });
    p.assert.equal(await p.ev('document.activeElement.id'), 'worldCanvas');
    const o = await outline(p);
    p.assert.ok(o.fv && /inset/.test(o.shadow), JSON.stringify(o));
  }, { fresh: true });

  t.test('a mouse click on a button does not leave a focus ring', async (p) => {
    await p.click('#tbGrid');
    p.assert.equal(await p.ev('document.activeElement.id'), 'tbGrid');
    p.assert.equal((await outline(p)).fv, false);
    await p.click('#tbGrid');
  }, { fresh: true });

  t.test('Tab reaches the main controls in a sensible order', async (p) => {
    await p.ev('document.activeElement && document.activeElement.blur()');
    const seen = await tabWalk(p, 60);
    const idx = (id) => seen.indexOf(id);
    for (const id of ['brand', 'tbRun', 'tbInto', 'speed', 'menuBtn', 'railFiles', 'railHelp', 'railSettings', 'tbGrid', 'worldCanvas', 'cmdInput', 'splitRight']) p.assert.ok(idx(id) >= 0, id + ' not reached: ' + seen.join(','));
    p.assert.ok(idx('brand') < idx('tbRun') && idx('tbRun') < idx('railFiles') && idx('railFiles') < idx('worldCanvas') && idx('worldCanvas') < idx('cmdInput'), seen.join(','));
    // disabled buttons are skipped
    p.assert.equal(idx('tbStop'), -1);
    p.assert.equal(idx('tbPause'), -1);
  }, { fresh: true });

  t.test('everything Tab lands on is visible', async (p) => {
    const hidden = [];
    for (let i = 0; i < 70; i++) {
      await p.key('Tab', { after: 5 });
      const v = await p.ev("(() => { const a = document.activeElement; if (!a || a === document.body) return true; const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0; })()");
      if (!v) hidden.push(await p.ev('document.activeElement.outerHTML.slice(0, 60)'));
    }
    p.assert.deepEqual(hidden, []);
  }, { fresh: true });

  t.test('Enter on a focused rail button opens its sheet', async (p) => {
    await p.ev("document.getElementById('railHelp').focus()");
    await p.key('Enter');
    p.assert.equal(await p.waitModal(), 'Logo reference');
    await p.key('Escape');
    await p.waitGone('.modal-back');
    p.assert.equal(await p.ev('document.activeElement.id'), 'railHelp', 'focus goes back to the rail button');
  }, { fresh: true });

  t.test('Space on a focused rail button toggles its panel', async (p) => {
    await p.ev("document.getElementById('railFiles').focus()");
    await p.key(' ');
    p.assert.ok(await p.ev("document.getElementById('side').classList.contains('closed')"));
    await p.key(' ');
    p.assert.ok(!(await p.ev("document.getElementById('side').classList.contains('closed')")));
  }, { fresh: true });

  t.test('the welcome examples can be run from the keyboard', async (p) => {
    await p.ev("document.querySelector('#welcome code').focus()");
    p.assert.equal(await p.attr('#welcome code', 'role'), 'button');
    await p.key('Enter');
    await p.waitState('idle');
    p.assert.equal(await p.segments(), 2);
  }, { fresh: true });

  t.test('Ctrl+` jumps from the editor to the command center', async (p) => {
    await p.ev('LG.app.active.editor.focus()');
    await p.key('`', { ctrl: true });
    p.assert.equal(await p.ev('document.activeElement.id'), 'cmdInput');
  }, { fresh: true });

  t.test('Escape leaves the big turtle world', async (p) => {
    await p.key('F4');
    p.assert.ok(await p.ev("document.getElementById('worldCard').classList.contains('fullscreen')"));
    await p.key('Escape');
    p.assert.ok(!(await p.ev("document.getElementById('worldCard').classList.contains('fullscreen')")));
  }, { fresh: true });

  // ---- reduced motion -------------------------------------------------------------------------------
  t.test('buttons animate normally', async (p) => {
    p.assert.notEqual(await p.ev("getComputedStyle(document.getElementById('tbRun')).transitionDuration"), '0s');
  }, { fresh: true });

  t.test('prefers-reduced-motion turns off transitions', async (p) => {
    await media(p, [{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    p.assert.ok((await p.ev("getComputedStyle(document.getElementById('tbRun')).transitionDuration")).split(',').every((d) => parseFloat(d) === 0));
  }, { fresh: true });

  t.test('prefers-reduced-motion turns off the menu animation', async (p) => {
    await media(p, [{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await p.click('#menuBtn');
    await p.wait("!!document.querySelector('.menu-pop')");
    p.assert.equal(await p.ev("getComputedStyle(document.querySelector('.menu-pop')).animationName"), 'none');
    await p.closeMenus();
    await media(p, []);
    await p.click('#menuBtn');
    await p.wait("!!document.querySelector('.menu-pop')");
    p.assert.equal(await p.ev("getComputedStyle(document.querySelector('.menu-pop')).animationName"), 'pop');
    await p.closeMenus();
  }, { fresh: true });

  t.test('prefers-reduced-motion also covers dialogs and toasts', async (p) => {
    await media(p, [{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await p.ev("LG.UI.toast('still')");
    await p.ev('LG.app.aboutDialog()');
    await p.waitModal();
    const anims = await p.ev("[...document.querySelectorAll('.modal-back, .modal, .toast')].map(e => getComputedStyle(e).animationName)");
    p.assert.ok(anims.every((a) => a === 'none'), anims.join(','));
    await p.key('Escape');
  }, { fresh: true });
}
