// The Files panel and everything that moves programs around: new, open, rename, delete,
// import and download, zip, share links, and mounting a real folder.
(function (LG) {
  'use strict';
  const { h, icon } = LG.UI;
  const store = LG.UI.storage;

  const Files = LG.Files = {};
  const isLogo = (p) => /\.(lgo|logo|lg|txt)$/i.test(p);
  const parentOf = (p) => p.replace(/\/[^/]*$/, '') || '/';
  const err = (e) => (e && e.message) || String(e);

  // ---- the tree ---------------------------------------------------------------------------------
  Files.render = function (app, body, tools) {
    const tb = (ic, title, fn, id) => { const b = h('button.ibtn', { type: 'button', title, 'aria-label': title, id }, icon(ic)); b.addEventListener('click', fn); tools.appendChild(b); };
    if (!tools.querySelector('#fNew')) {
      tools.innerHTML = '';
      tb('newFile', 'New program', () => Files.newFile(app), 'fNew');
      tb('newFolder', 'New folder', () => Files.newFolder(app), 'fNewFolder');
      tb('upload', 'Bring files from your computer', () => Files.importFiles(app), 'fImport');
      tb('drive', 'Use a folder from your computer', () => Files.mountDialog(app), 'fMount');
    }
    const prevScroll = body.scrollTop;
    body.innerHTML = '';
    const tree = h('div.tree', { role: 'tree', 'aria-label': 'Files' });
    const vfs = app.vfs;
    const walk = (dir, depth) => {
      let list;
      try { list = vfs.list(dir); } catch (e) { return; }
      for (const e of list) {
        const key = e.path.toLowerCase();
        const isDir = e.type === 'dir';
        const open = isDir && app.expanded.has(key);
        const isOpenDoc = !!app.docByPath(e.path);
        const row = h('div.trow' + (app.selectedPath && app.selectedPath.toLowerCase() === key ? '.sel' : '') + (isOpenDoc ? '.open' : ''),
          { role: 'treeitem', tabindex: '0', 'aria-expanded': isDir ? String(open) : null, title: e.path, dataset: { path: e.path }, style: { paddingLeft: (8 + depth * 16) + 'px' } },
          h('span.twisty', isDir ? (open ? '▾' : '▸') : ''), icon(isDir ? (open ? 'folderOpen' : 'folder') : 'file'), h('span.name', e.name),
          tagFor(app, e));
        row.addEventListener('click', () => {
          app.selectedPath = e.path;
          if (isDir) { if (open) app.expanded.delete(key); else app.expanded.add(key); store.set('expanded', [...app.expanded]); Files.render(app, body, tools); return; }
          if (isLogo(e.path) || /\.(bas|txt)$/i.test(e.path)) { app.openFile(e.path); if (app.isPhone()) app.setView('code'); }
          else Files.render(app, body, tools);
        });
        row.addEventListener('keydown', (ev) => {
          // arrow keys move through the tree; Left/Right fold and unfold folders
          const rows = [...tree.querySelectorAll('.trow')];
          const i = rows.indexOf(row);
          if (ev.key === 'ArrowDown' && rows[i + 1]) { ev.preventDefault(); rows[i + 1].focus(); return; }
          if (ev.key === 'ArrowUp' && rows[i - 1]) { ev.preventDefault(); rows[i - 1].focus(); return; }
          if (ev.key === 'Home') { ev.preventDefault(); rows[0].focus(); return; }
          if (ev.key === 'End') { ev.preventDefault(); rows[rows.length - 1].focus(); return; }
          if (isDir && ((ev.key === 'ArrowRight' && !open) || (ev.key === 'ArrowLeft' && open))) {
            ev.preventDefault();
            if (open) app.expanded.delete(key); else app.expanded.add(key);
            store.set('expanded', [...app.expanded]);
            app.renderSide();
            const again = document.querySelector('#sideBody .trow[data-path="' + CSS.escape(e.path) + '"]');
            if (again) again.focus();
            return;
          }
          if (ev.key === 'Enter') { ev.preventDefault(); row.click(); }
          if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); Files.remove(app, e.path); }
          if (ev.key === 'F2') { ev.preventDefault(); Files.rename(app, e.path); }
        });
        row.addEventListener('contextmenu', (ev) => { ev.preventDefault(); Files.menu(app, e, ev.clientX, ev.clientY); });
        let pressT = null;
        row.addEventListener('touchstart', (ev) => { const t = ev.touches[0]; pressT = setTimeout(() => Files.menu(app, e, t.clientX, t.clientY), 550); }, { passive: true });
        row.addEventListener('touchend', () => clearTimeout(pressT));
        row.addEventListener('touchmove', () => clearTimeout(pressT));
        tree.appendChild(row);
        if (open) walk(e.path, depth + 1);
      }
    };
    walk('/', 0);
    body.appendChild(tree);
    const used = vfs.used();
    body.appendChild(h('div.side-note', 'Your programs live in this browser. ' + (used > 1024 ? Math.round(used / 1024) + ' KB used. ' : '') + 'Right-click (or long-press) a file or folder for more.'));
    body.scrollTop = prevScroll;
  };
  function tagFor(app, e) {
    const p = e.path.toLowerCase();
    if (p === '/examples' || p === '/library' || p === '/lessons') return h('span.tag', 'originals');
    if (p.startsWith('/mnt/') && p.split('/').length === 3) { const m = app.vfs.mounts.get(p); return h('span.tag', m ? ({ read: 'read only', ask: 'asks first', write: 'can write' }[m.mode]) : ''); }
    return null;
  }

  Files.menu = function (app, e, x, y) {
    const isDir = e.type === 'dir';
    const p = e.path;
    const prot = app.isProtected(p) || /^\/(examples|library|lessons)$/i.test(p);
    const mountRoot = /^\/mnt\/[^/]+$/i.test(p);
    const items = isDir ? [
      { label: 'New program here', action: () => Files.newFile(app, p), disabled: prot },
      { label: 'New folder here', action: () => Files.newFolder(app, p), disabled: prot },
      { label: 'Bring files here from your computer', action: () => Files.importFiles(app, p), disabled: prot },
      { sep: true },
      { label: 'Share this folder as a link…', action: () => Files.shareDialog(app, p) },
      { label: 'Download as .zip', action: () => Files.downloadZip(app, p) },
      { sep: true },
      mountRoot ? { label: 'Stop using this folder', action: () => { app.vfs.unmount(p); app.renderSide(); } } : null,
      { label: 'Rename…', action: () => Files.rename(app, p), disabled: prot || mountRoot || p === '/projects' },
      { label: 'Delete', action: () => Files.remove(app, p), disabled: prot || mountRoot || p === '/projects' },
    ] : [
      { label: 'Open', action: () => app.openFile(p) },
      { label: 'Run', action: () => { const d = app.openFile(p); if (d) app.runActive(); } },
      { sep: true },
      { label: 'Share as a link…', action: () => Files.shareDialog(app, p) },
      { label: 'Download', action: () => Files.download(app, p) },
      { label: 'Duplicate', action: () => Files.duplicate(app, p) },
      { sep: true },
      { label: 'Rename…', action: () => Files.rename(app, p), disabled: prot },
      { label: 'Delete', action: () => Files.remove(app, p), disabled: prot },
    ];
    LG.UI.showMenu(items.filter(Boolean), x, y);
  };

  // ---- creating and changing files ------------------------------------------------------------------
  Files.currentDir = function (app) {
    const sel = app.selectedPath;
    if (sel && app.vfs.isDir(sel) && !app.isProtected(sel + '/x')) return sel;
    if (app.active && !app.isProtected(app.active.path)) return parentOf(app.active.path);
    return '/projects';
  };
  Files.newFile = async function (app, dir) {
    dir = dir || Files.currentDir(app);
    let n = 1, def;
    do { def = 'untitled' + (n > 1 ? n : '') + '.lgo'; n++; } while (app.vfs.exists(dir + '/' + def) || app.docByPath(dir + '/' + def));
    const name = await LG.UI.prompt('New program', 'Name', def, { hint: 'It goes in ' + dir + '. You can also type a path such as /projects/games/maze.lgo.' });
    if (!name) return null;
    let p = name.trim();
    if (!/\.[^/.]+$/.test(p)) p += '.lgo';
    if (!p.startsWith('/')) p = dir + '/' + p;
    try {
      const disp = app.vfs.abs(p);
      if (app.isProtected(disp)) throw new Error('Pick a folder outside /examples, /library and /lessons');
      app.vfs.mkdir(parentOf(disp), { parents: true, exist: true });
      if (!app.vfs.exists(disp)) app.vfs.writeText(disp, '; ' + disp.replace(/^.*\//, '') + '\n\nto start\n  repeat 4 [fd 100 rt 90]\nend\n\nstart\n');
      app.expanded.add(parentOf(disp).toLowerCase());
      const d = app.openFile(disp);
      if (d) setTimeout(() => { d.editor.setCursor(3, 2); d.editor.focus(); }, 0);
      if (app.isPhone()) app.setView('code');
      app.renderSide();
      return d;
    } catch (e) { LG.UI.toast('Could not make that program: ' + err(e), 'err'); return null; }
  };
  Files.newFolder = async function (app, dir) {
    dir = dir || Files.currentDir(app);
    const name = await LG.UI.prompt('New folder', 'Folder name', 'my folder');
    if (!name) return;
    try {
      const p = app.vfs.abs(dir + '/' + name.trim());
      app.vfs.mkdir(p);
      app.expanded.add(dir.toLowerCase()); app.expanded.add(p.toLowerCase());
      store.set('expanded', [...app.expanded]);
    } catch (e) { LG.UI.toast('Could not make the folder: ' + err(e), 'err'); }
    app.renderSide();
  };
  // folders that hold everything else, or belong to someone else, are never renamed or deleted
  const keptSafe = (app, p) => app.isProtected(p) || /^\/(projects|mnt)$/i.test(p) || /^\/mnt\/[^/]+$/i.test(p);
  Files.rename = async function (app, p) {
    if (keptSafe(app, p)) { LG.UI.toast('That one is kept safe and cannot be renamed', 'err'); return; }
    const old = p.replace(/^.*\//, '');
    const name = await LG.UI.prompt('Rename', 'New name', old);
    if (!name || name === old) return;
    const np = parentOf(p) + '/' + name.trim();
    try {
      app.vfs.rename(p, np);
      // breakpoints follow the files they are in
      for (const bp of [...app.breakpoints.keys()]) {
        if (bp.toLowerCase() === p.toLowerCase() || bp.toLowerCase().startsWith(p.toLowerCase() + '/')) {
          const m = app.breakpoints.get(bp);
          app.breakpoints.delete(bp);
          app.breakpoints.set(app.vfs.abs(np + bp.slice(p.length)), m);
        }
      }
      for (const d of app.docs) {
        if (d.path.toLowerCase() === p.toLowerCase() || d.path.toLowerCase().startsWith(p.toLowerCase() + '/')) {
          d.path = app.vfs.abs(np + d.path.slice(p.length));
          d.name = d.path.replace(/^.*\//, '');
        }
      }
      for (const bp of [...app.breakpoints.keys()]) app.breakpointsChanged(bp);
      app.renderTabs(); app.updateUI(); app.saveSession();
    } catch (e) { LG.UI.toast('Could not rename: ' + err(e), 'err'); }
    app.renderSide();
  };
  Files.remove = async function (app, p) {
    if (keptSafe(app, p)) { LG.UI.toast('That one is kept safe and cannot be deleted', 'err'); return; }
    const st = app.vfs.stat(p);
    if (!st) return;
    const isDir = st.type === 'dir';
    const ok = await LG.UI.confirm('Delete?', 'Delete <b>' + LG.escapeHtml(p) + '</b>' + (isDir ? ' and everything in it' : '') + '? This cannot be undone.', 'Delete');
    if (!ok) return;
    try {
      for (const d of app.docs.slice()) if (d.path.toLowerCase() === p.toLowerCase() || d.path.toLowerCase().startsWith(p.toLowerCase() + '/')) { d.dirty = false; await app.closeDoc(d); }
      if (isDir) app.vfs.rmdir(p, { recursive: true }); else app.vfs.unlink(p);
    } catch (e) { LG.UI.toast('Could not delete: ' + err(e), 'err'); }
    app.renderSide();
  };
  Files.duplicate = function (app, p) {
    const base = p.replace(/(\.[^./]*)?$/, '');
    const ext = (/(\.[^./]*)$/.exec(p) || ['', ''])[1];
    let n = 2, np;
    const dir = app.isProtected(p) ? '/projects' : parentOf(p);
    do { np = dir + '/' + base.replace(/^.*\//, '') + '-' + n + ext; n++; } while (app.vfs.exists(np));
    // a file open in the editor is copied as it looks now, unsaved changes included
    const d = app.docByPath(p);
    try { app.vfs.writeFile(np, d ? LG.utf8(d.editor.getValue()) : app.vfs.readFile(p)); app.openFile(np); } catch (e) { LG.UI.toast('Could not copy: ' + err(e), 'err'); }
    app.renderSide();
  };
  Files.download = function (app, p) {
    const d = app.docByPath(p);
    if (d && d.dirty && !app.isProtected(p)) app.saveDoc(d);
    const data = d ? LG.utf8(d.editor.getValue()) : app.vfs.readFile(p);
    LG.UI.download(p.replace(/^.*\//, ''), data, 'text/plain');
  };
  Files.importFiles = async function (app, dir) {
    dir = dir || Files.currentDir(app);
    const files = await LG.UI.pickFiles('', true);
    if (!files || !files.length) return;
    let last = null, brought = 0;
    for (const f of files) {
      const p = dir + '/' + f.name.replace(/[<>:"|?*\\/]/g, '_');
      try {
        if (app.vfs.exists(p) && !(await LG.UI.confirm('Replace?', LG.escapeHtml(p) + ' is already there. Replace it?', 'Replace'))) continue;
        app.vfs.writeFile(p, new Uint8Array(await f.arrayBuffer()));
        last = p;
        brought++;
        const d = app.docByPath(p);
        if (d) { const t = app.vfs.readText(p); d.editor.setValue(t); d.savedText = t; d.dirty = false; }
      } catch (e) { LG.UI.toast('Could not bring in ' + f.name + ': ' + err(e), 'err'); }
    }
    app.expanded.add(dir.toLowerCase());
    app.renderSide();
    if (last && isLogo(last)) app.openFile(last);
    if (brought) LG.UI.toast('Brought in ' + brought + ' file' + (brought === 1 ? '' : 's'), 'ok');
  };
  Files.openDialog = async function (app) {
    const all = app.vfs.walk('/').filter((x) => x.entry.type === 'file').map((x) => x.path).filter(isLogo).sort();
    const filter = h('input', { type: 'text', placeholder: 'Type to find a program', 'aria-label': 'Find a program' });
    const list = h('div', { style: { maxHeight: '50vh', overflow: 'auto', marginTop: '8px' } });
    let chosen = null, close = () => {};
    const render = () => {
      list.innerHTML = '';
      const q = filter.value.toLowerCase();
      for (const p of all.filter((x) => x.toLowerCase().includes(q)).slice(0, 400)) {
        const row = h('div.list-row.clickable', h('span', icon('file')), h('span.grow.code', p));
        row.querySelector('svg').style.width = '16px';
        row.addEventListener('click', () => { chosen = p; close(); });
        list.appendChild(row);
      }
      if (!list.childElementCount) list.appendChild(h('div.empty', 'Nothing matches.'));
    };
    filter.addEventListener('input', render);
    filter.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const r = list.querySelector('.list-row'); if (r) r.click(); } });
    render();
    const v = await LG.UI.modal({ title: 'Open a program', body: h('div', filter, list), buttons: [{ label: 'Cancel', value: null }, { label: 'From my computer…', value: 'import' }], onOpen: (box, c) => { close = () => c(null); setTimeout(() => filter.focus(), 30); } });
    if (v === 'import') Files.importFiles(app);
    if (chosen) app.openFile(chosen);
  };

  // ---- zip and share ---------------------------------------------------------------------------------
  Files.collect = function (app, p) {
    const st = app.vfs.stat(p);
    const files = {};
    if (!st) return { files, name: 'project' };
    if (st.type === 'file') {
      const d = app.docByPath(p);
      files[p.replace(/^.*\//, '')] = d ? LG.utf8(d.editor.getValue()) : app.vfs.readFile(p);
      return { files, name: p.replace(/^.*\//, '').replace(/\.[^.]*$/, ''), main: p.replace(/^.*\//, '') };
    }
    for (const x of app.vfs.walk(p)) {
      if (x.entry.type !== 'file') continue;
      const rel = x.path.slice(p.length + 1);
      const d = app.docByPath(x.path);
      try { files[rel] = d ? LG.utf8(d.editor.getValue()) : app.vfs.readFile(x.path); } catch (e) { /* not loaded */ }
    }
    let main = null;
    if (app.active && app.active.path.toLowerCase().startsWith(p.toLowerCase() + '/')) main = app.active.path.slice(p.length + 1);
    return { files, name: p.replace(/^.*\//, '') || 'disk', main };
  };
  Files.downloadZip = function (app, p) {
    const c = Files.collect(app, p);
    if (!Object.keys(c.files).length) { LG.UI.toast('That folder is empty', 'err'); return; }
    LG.UI.download(c.name + '.zip', LG.Zip.create(c.files), 'application/zip');
  };
  Files.shareDialog = async function (app, p) {
    const c = Files.collect(app, p);
    const n = Object.keys(c.files).length;
    if (!n) { LG.UI.toast('Nothing to share there', 'err'); return; }
    let code;
    try { code = await LG.Share.pack({ name: c.name, main: c.main || null, lang: 'logo' }, c.files); } catch (e) { LG.UI.toast('Could not pack it: ' + err(e), 'err'); return; }
    const url = location.origin + location.pathname + '#share=' + code;
    const link = h('input', { type: 'text', readonly: true, value: url, 'aria-label': 'Link', id: 'shareLink' });
    const box = h('textarea', { readonly: true, 'aria-label': 'Share code', id: 'shareCode', rows: '5' }, code);
    const copy = async (t, what) => { try { await navigator.clipboard.writeText(t); LG.UI.toast(what + ' copied', 'ok'); } catch (e) { LG.UI.toast('Select it and copy it yourself', 'err'); } };
    await LG.UI.modal({
      title: 'Share ' + c.name,
      body: h('div',
        h('p', 'Anyone who opens this link gets their own copy of ' + (n === 1 ? 'this program' : 'these ' + n + ' files') + ' to play with. Everything is inside the link itself; nothing is uploaded.'),
        h('label', 'Link'), link, h('label', 'Or this code (paste it into Open a shared program)'), box,
        h('p.hint', (url.length / 1024).toFixed(1) + ' KB')),
      buttons: [{ label: 'Close', value: null }, { label: 'Copy code', value: () => { copy(code, 'Code'); }, keepOpen: true }, { label: 'Copy link', value: () => { copy(url, 'Link'); }, keepOpen: true, primary: true }],
      onOpen: () => { link.select(); },
    });
  };
  Files.importDialog = async function (app) {
    const ta = h('textarea', { placeholder: 'Paste a Lohgo link or share code here', 'aria-label': 'Share code', id: 'importCode' });
    const v = await LG.UI.modal({ title: 'Open a shared program', body: h('div', h('p', 'Paste a link someone shared with you, or the code from inside it.'), ta), buttons: [{ label: 'Cancel', value: null }, { label: 'Open', value: () => ta.value, primary: true }] });
    if (v) Files.importShare(app, v);
  };
  Files.importShare = async function (app, text) {
    let pkg;
    try { pkg = await LG.Share.unpack(text); } catch (e) { LG.UI.toast(err(e), 'err', 5000); return; }
    const base = (pkg.meta.name || 'shared').replace(/[<>:"|?*\\/\x00-\x1f]/g, '_').slice(0, 60) || 'shared';
    let dir, n = 1;
    do { dir = '/projects/shared/' + base + (n > 1 ? '-' + n : ''); n++; } while (app.vfs.exists(dir));
    try {
      app.vfs.mkdir(dir, { parents: true });
      for (const [rel, data] of Object.entries(pkg.files)) {
        const clean = rel.split(/[\\/]/).filter((s) => s && s !== '.' && s !== '..').join('/');
        if (!clean) continue;
        const p = dir + '/' + clean;
        app.vfs.mkdir(parentOf(p), { parents: true, exist: true });
        app.vfs.writeFile(p, data);
      }
    } catch (e) { LG.UI.toast('Could not open the shared program: ' + err(e), 'err'); return; }
    app.expanded.add('/projects'); app.expanded.add('/projects/shared'); app.expanded.add(dir.toLowerCase());
    store.set('expanded', [...app.expanded]);
    const files = Object.keys(pkg.files);
    const main = pkg.meta.main && pkg.files[pkg.meta.main] ? pkg.meta.main : files.find(isLogo) || files[0];
    if (main) app.openFile(dir + '/' + main);
    app.renderSide();
    if (location.hash.startsWith('#share=')) history.replaceState(null, '', location.pathname + location.search);
    LG.UI.toast('Opened your copy in ' + dir, 'ok', 4000);
  };

  // ---- real folders -----------------------------------------------------------------------------------
  Files.mountDialog = async function (app) {
    if (!window.showDirectoryPicker) {
      LG.UI.alert('Folders from your computer', 'This browser cannot open folders from your computer. Chrome and Edge on a desktop can. You can still bring single files in with the upload button, and download your programs.');
      return;
    }
    const mode = await LG.UI.modal({
      title: 'Use a folder from your computer',
      body: h('div', h('p', 'Pick a folder and it shows up under /mnt, where programs can read it with LOAD, OPENREAD and friends.'), h('p', 'How much should programs be allowed to do there?')),
      buttons: [{ label: 'Cancel', value: null }, { label: 'Read only', value: 'read' }, { label: 'Ask me before each change', value: 'ask' }, { label: 'Let them write', value: 'write', primary: true }],
      cancelValue: null,
    });
    if (!mode) return;
    let handle;
    try { handle = await window.showDirectoryPicker({ mode: mode === 'read' ? 'read' : 'readwrite' }); } catch (e) { return; }
    try {
      const p = await app.vfs.mountHandle(handle, mode);
      app.expanded.add('/mnt'); app.expanded.add(p.toLowerCase());
      app.renderSide();
      LG.UI.toast('Mounted at ' + p, 'ok');
    } catch (e) { LG.UI.toast('Could not use that folder: ' + err(e), 'err'); }
  };
})(LG);
