// Page helpers for Lohgo e2e specs. Every spec test receives `p` (this object).
import assert from 'node:assert/strict';

export { assert };

const KEYMAP = {
  Enter: [13, 'Enter', '\r'], Tab: [9, 'Tab'], Escape: [27, 'Escape'], Backspace: [8, 'Backspace'], Delete: [46, 'Delete'],
  ArrowUp: [38, 'ArrowUp'], ArrowDown: [40, 'ArrowDown'], ArrowLeft: [37, 'ArrowLeft'], ArrowRight: [39, 'ArrowRight'],
  Home: [36, 'Home'], End: [35, 'End'], PageUp: [33, 'PageUp'], PageDown: [34, 'PageDown'], Insert: [45, 'Insert'],
  F1: [112, 'F1'], F2: [113, 'F2'], F3: [114, 'F3'], F4: [115, 'F4'], F5: [116, 'F5'], F6: [117, 'F6'], F7: [118, 'F7'],
  F8: [119, 'F8'], F9: [120, 'F9'], F10: [121, 'F10'], F11: [122, 'F11'], F12: [123, 'F12'], Pause: [19, 'Pause'],
};

export function makePage(b, spec) {
  let scriptId = null;
  let mark = 0;
  const p = {
    b, spec, assert,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),

    // ---- lifecycle ------------------------------------------------------------------------
    /** Reload the IDE with empty storage. opts: {firstRun, settings, width, height, mobile, touch, hash} */
    async fresh(opts = {}) {
      await b.send('Storage.clearDataForOrigin', { origin: b.url.replace(/\/$/, ''), storageTypes: 'all' }).catch(() => {});
      if (scriptId) await b.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId }).catch(() => {});
      const settings = Object.assign({ firstRun: !!opts.firstRun }, opts.settings || {});
      const r = await b.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `try { if (!localStorage.getItem('lohgo.settings')) localStorage.setItem('lohgo.settings', ${JSON.stringify(JSON.stringify(settings))}); } catch (e) {}`,
      });
      scriptId = r.identifier;
      await p.viewport(opts.width || 1400, opts.height || 900, { mobile: !!opts.mobile, touch: !!opts.touch });
      await b.send('Page.navigate', { url: 'about:blank' });
      await p.sleep(50);
      // clear IndexedDB + session flag, then load the app
      await b.send('Storage.clearDataForOrigin', { origin: b.url.replace(/\/$/, ''), storageTypes: 'all' }).catch(() => {});
      await b.send('Page.navigate', { url: b.url + (opts.hash ? '#' + opts.hash : '') });
      await p.wait('window.__lohgoReady === true', 20000);
      await p.sleep(opts.firstRun ? 50 : 120);
      mark = b.logs.length;
    },
    async reload() {
      await b.send('Page.reload', {});
      await p.sleep(200);
      await p.wait('window.__lohgoReady === true', 20000);
      await p.sleep(150);
    },
    async recover() { await p.fresh(); },
    markExceptions() { mark = b.logs.length; },
    newExceptions() {
      return b.logs.slice(mark).filter((l) => l.type === 'exception' || l.type === 'error').map((l) => l.text);
    },
    screenshot: (file) => b.screenshot(file),
    async viewport(w, h, o = {}) {
      await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!o.mobile });
      await b.send('Emulation.setTouchEmulationEnabled', { enabled: !!o.touch, maxTouchPoints: 5 });
      await b.send('Runtime.evaluate', { expression: "window.dispatchEvent(new Event('resize'))" }).catch(() => {});
      await p.sleep(120);
    },

    // ---- evaluation ----------------------------------------------------------------------------
    ev: (expr) => b.eval(expr),
    /** Evaluate a function in the page: p.fn((a, b) => ..., a, b) */
    fn: (f, ...args) => b.eval(`(${f.toString()})(...${JSON.stringify(args)})`),
    async wait(expr, ms = 8000) {
      const t0 = Date.now();
      let last;
      while (Date.now() - t0 < ms) {
        try { last = await b.eval(expr); if (last) return last; } catch (e) { last = e.message; }
        await p.sleep(40);
      }
      throw new Error(`wait timed out (${ms}ms): ${expr}  [last: ${JSON.stringify(last)}]`);
    },
    async waitGone(sel, ms = 5000) { return p.wait(`!document.querySelector(${JSON.stringify(sel)})`, ms); },

    // ---- DOM queries -----------------------------------------------------------------------------
    exists: (sel) => b.eval(`!!document.querySelector(${JSON.stringify(sel)})`),
    count: (sel) => b.eval(`document.querySelectorAll(${JSON.stringify(sel)}).length`),
    text: (sel) => b.eval(`(document.querySelector(${JSON.stringify(sel)}) || {}).innerText || ''`),
    texts: (sel) => b.eval(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(e => e.innerText)`),
    attr: (sel, a) => b.eval(`(document.querySelector(${JSON.stringify(sel)}) || {getAttribute(){return null}}).getAttribute(${JSON.stringify(a)})`),
    /** visible: in layout, non-zero size, not visibility:hidden, inside viewport horizontally */
    visible: (sel) => b.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight; })()`),
    rect: (sel) => b.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return {x: r.left, y: r.top, w: r.width, h: r.height, right: r.right, bottom: r.bottom}; })()`),
    focusedId: () => b.eval('document.activeElement ? (document.activeElement.id || document.activeElement.className || document.activeElement.tagName) : null'),
    noHScroll: () => b.eval('document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1'),

    // ---- mouse ----------------------------------------------------------------------------------------
    async center(sel, textMatch) {
      const r = await b.eval(`(() => {
        let els = [...document.querySelectorAll(${JSON.stringify(sel)})];
        ${textMatch !== undefined ? `els = els.filter(e => e.innerText && e.innerText.includes(${JSON.stringify(textMatch)}));` : ''}
        const e = els.find(x => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) || els[0];
        if (!e) return null;
        e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const r = e.getBoundingClientRect();
        return [r.left + r.width / 2, r.top + r.height / 2];
      })()`);
      if (!r) throw new Error('element not found: ' + sel + (textMatch !== undefined ? ' with text ' + JSON.stringify(textMatch) : ''));
      return r;
    },
    async mouse(type, x, y, button = 'left', clickCount = 1) {
      await b.send('Input.dispatchMouseEvent', { type, x, y, button, clickCount });
    },
    async clickAt(x, y, opts = {}) {
      const button = opts.button || 'left';
      await p.mouse('mouseMoved', x, y);
      await p.mouse('mousePressed', x, y, button, 1);
      await p.mouse('mouseReleased', x, y, button, 1);
      if (opts.double) { await p.mouse('mousePressed', x, y, button, 2); await p.mouse('mouseReleased', x, y, button, 2); }
      await p.sleep(opts.after === undefined ? 60 : opts.after);
    },
    async click(sel, textMatch) { const [x, y] = await p.center(sel, textMatch); await p.clickAt(x, y); },
    async dblclick(sel, textMatch) { const [x, y] = await p.center(sel, textMatch); await p.clickAt(x, y, { double: true }); },
    async rightClick(sel, textMatch) { const [x, y] = await p.center(sel, textMatch); await p.clickAt(x, y, { button: 'right' }); },
    async hover(sel, textMatch) { const [x, y] = await p.center(sel, textMatch); await p.mouse('mouseMoved', x, y); await p.sleep(60); },
    async tap(sel, textMatch) {
      const [x, y] = await p.center(sel, textMatch);
      await b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await b.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await p.sleep(80);
    },

    // ---- keyboard -----------------------------------------------------------------------------------
    async key(k, mods = {}) {
      const m = (mods.alt ? 1 : 0) | (mods.ctrl ? 2 : 0) | (mods.meta ? 4 : 0) | (mods.shift ? 8 : 0);
      const def = KEYMAP[k];
      if (def) {
        await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: def[0], key: def[1], code: def[1], modifiers: m });
        if (def[2] && !mods.ctrl && !mods.alt) await b.send('Input.dispatchKeyEvent', { type: 'char', text: def[2], key: def[1], modifiers: m });
        await b.send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: def[0], key: def[1], code: def[1], modifiers: m });
      } else {
        const ch = k;
        const code = /^[a-z]$/i.test(ch) ? 'Key' + ch.toUpperCase() : /^[0-9]$/.test(ch) ? 'Digit' + ch : ch === ' ' ? 'Space' : ch === '/' ? 'Slash' : ch === '=' ? 'Equal' : ch === '-' ? 'Minus' : '';
        // punctuation must not reuse its char code as a virtual key code: '(' (40) would be ArrowDown
        const vk = /^[a-z0-9]$/i.test(ch) ? ch.toUpperCase().charCodeAt(0) : ch === ' ' ? 32 : ch === '/' ? 191 : ch === '=' ? 187 : ch === '-' ? 189 : 0;
        const key = mods.shift && /^[a-z]$/.test(ch) ? ch.toUpperCase() : ch;
        await b.send('Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: vk, key, code, text: (mods.ctrl || mods.alt || mods.meta) ? undefined : key, modifiers: m });
        await b.send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: vk, key, code, modifiers: m });
      }
      await p.sleep(mods.after === undefined ? 30 : mods.after);
    },
    async type(text) {
      for (const ch of text) {
        if (ch === '\n') await p.key('Enter', { after: 5 });
        else await p.key(ch, { after: 5 });
      }
      await p.sleep(40);
    },
    async insertText(text) { await b.send('Input.insertText', { text }); await p.sleep(40); },

    // ---- Lohgo shortcuts ----------------------------------------------------------------------------------
    state: () => b.eval('LG.app.interp.state'),
    async waitState(states, ms = 10000) {
      const list = Array.isArray(states) ? states : [states];
      return p.wait(`${JSON.stringify(list)}.includes(LG.app.interp.state)`, ms);
    },
    /** Text in the command center transcript */
    output: () => b.eval("(LG.app.commander.flush(), document.getElementById('transcript').innerText)"),
    async waitOutput(re, ms = 8000) {
      const src = re instanceof RegExp ? re.source : re;
      const flags = re instanceof RegExp ? re.flags : '';
      return p.wait(`(LG.app.commander.flush(), new RegExp(${JSON.stringify(src)}, ${JSON.stringify(flags)}).test(document.getElementById('transcript').innerText))`, ms);
    },
    turtle: () => b.eval('(() => { const t = LG.app.world.current; return { x: Math.round(t.x * 100) / 100, y: Math.round(t.y * 100) / 100, heading: Math.round(t.heading * 100) / 100, pen: t.penDown, shown: t.shown, color: t.color.rgb.join(","), size: t.size }; })()'),
    segments: () => b.eval('LG.app.world.segments'),
    activePath: () => b.eval('LG.app.active ? LG.app.active.path : null'),
    code: () => b.eval('LG.app.active ? LG.app.active.editor.getValue() : null'),
    /** Replace the active editor's text as if typed (marks it changed, undoable) */
    async setCode(text) {
      await b.eval(`(() => { const e = LG.app.active.editor; e.ta.focus(); e.ta.setSelectionRange(0, e.ta.value.length); e.insert(${JSON.stringify(text)}); })()`);
      await p.sleep(60);
    },
    /** Create a file on the disk and open it */
    async newFile(path, text) {
      await b.eval(`(() => { const v = LG.app.vfs; const P = ${JSON.stringify(path)}; v.mkdir(P.replace(/\\/[^/]*$/, '') || '/', { parents: true, exist: true, trusted: true }); v.writeText(P, ${JSON.stringify(text)}, { trusted: true }); const d = LG.app.docByPath(P); if (d) { d.editor.setValue(v.readText(P)); d.savedText = d.editor.getValue(); d.dirty = false; } LG.app.openFile(P); })()`);
      await p.sleep(80);
    },
    /** Put a program in a file, open it and run it (F5). Returns the final state. */
    async runProgram(text, opts = {}) {
      await p.newFile(opts.path || '/projects/e2e.lgo', text);
      await p.ev('LG.app.runActive()');
      if (opts.wait !== false) await p.waitState(opts.until || ['idle', 'error', 'paused', 'input'], opts.timeout || 10000);
      return p.state();
    },
    /** Type an instruction into the command center and press Enter */
    async command(text, opts = {}) {
      await p.click('#cmdInput');
      await p.ev(`(() => { const t = document.getElementById('cmdInput'); t.value = ${JSON.stringify(text)}; t.dispatchEvent(new Event('input', {bubbles: true})); })()`);
      await p.key('Enter');
      if (opts.wait !== false) await p.waitState(opts.until || ['idle', 'error', 'paused', 'input'], opts.timeout || 10000);
      await p.sleep(40);
    },
    async stopProgram() { await p.ev('LG.app.stop()'); await p.sleep(50); },
    inspector: (tab) => b.eval(`LG.app.inspector.show(${JSON.stringify(tab)})`),
    paneText: (tab) => b.eval(`(document.getElementById('ipane-' + ${JSON.stringify(tab)}) || {}).innerText || ''`),
    status: () => b.eval("document.getElementById('statusMsg').innerText"),

    // ---- menus & dialogs ----------------------------------------------------------------------------------
    /** Open the main menu (☰) and pick an item by its label */
    async menu(item) {
      await p.click('#menuBtn');
      await p.wait("!!document.querySelector('.menu-pop')", 3000);
      await p.click('.menu-pop .menu-item', item);
      await p.sleep(120);
    },
    menuItems: () => b.eval("[...document.querySelectorAll('.menu-pop .menu-item')].map(e => ({ label: e.children[0].innerText, sc: e.querySelector('.sc') ? e.querySelector('.sc').innerText : '', disabled: e.classList.contains('disabled'), checked: e.classList.contains('checked'), sub: !!e.querySelector('.sub-arrow') }))"),
    async closeMenus() { await p.ev('LG.UI.closeMenus()'); await p.sleep(30); },
    modalOpen: () => b.eval("!!document.querySelector('.modal-back')"),
    modalTitle: () => b.eval("(document.querySelector('.modal-back:last-child .modal-head') || {}).innerText || ''"),
    modalText: () => b.eval("(document.querySelector('.modal-back:last-child .modal') || {}).innerText || ''"),
    async waitModal(ms = 4000) { await p.wait("!!document.querySelector('.modal-back')", ms); await p.sleep(60); return p.modalTitle(); },
    async modalButton(label) { await p.click('.modal-back:last-child .modal-foot button', label); await p.sleep(100); },
    async modalInput(value, idx = 0) {
      await b.eval(`(() => { const i = document.querySelectorAll('.modal-back:last-child .modal input[type=text], .modal-back:last-child .modal textarea')[${idx}]; i.focus(); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event('input', {bubbles: true})); })()`);
      await p.sleep(40);
    },
    async closeModals() { await b.eval("LG.UI.closeAllModals()"); await p.sleep(30); },
    lastToast: () => b.eval("(() => { const t = [...document.querySelectorAll('.toast')]; return t.length ? t[t.length - 1].innerText : ''; })()"),
    async waitToast(re, ms = 4000) {
      return p.wait(`[...document.querySelectorAll('.toast')].some(t => new RegExp(${JSON.stringify(re.source || re)}, 'i').test(t.innerText))`, ms);
    },
  };
  return p;
}
