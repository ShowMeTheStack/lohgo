// The program library: hundreds of commented Logo programs in categories. The texts are packed
// into one compressed string and unpacked the first time the library is opened.
(function (LG) {
  'use strict';
  const { h } = LG.UI;
  const store = LG.UI.storage;
  let texts = null;

  async function load() {
    if (texts) return texts;
    const L = LG.LIBRARY;
    const bin = atob(L.blob);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const res = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')));
    texts = JSON.parse(await res.text());
    return texts;
  }

  const Library = LG.Library = {
    load,
    /** Copy one program (and any helper files in its folder) to /library/<category>/ */
    async install(app, path) {
      const t = await load();
      if (typeof t[path] !== 'string') throw new Error(path + ' is not in the library');
      const vfs = app.vfs;
      const cat = path.split('/')[0];
      vfs.mkdir('/library', { exist: true, trusted: true, readOnly: true });
      vfs.mkdir('/library/' + cat, { exist: true, trusted: true, readOnly: true });
      const put = (k) => { const p = '/library/' + k; if (!vfs.exists(p) || vfs.readText(p) !== t[k]) vfs.writeText(p, t[k], { trusted: true, readOnly: true }); };
      put(path);
      // helper files (names starting with an underscore) that programs LOAD
      for (const k of Object.keys(t)) if (k.startsWith(cat + '/_')) put(k);
      return '/library/' + path;
    },
    async open(app, path, run) {
      try {
        const p = await Library.install(app, path);
        const d = app.openFile(p);
        app.expanded.add('/library'); app.expanded.add(('/library/' + path.split('/')[0]).toLowerCase());
        app.renderSide();
        app.setStatus('Opened ' + p + '. Read the comments at the top, then press F5.');
        if (d) d.editor.setCursor(0, 0);
        if (app.isPhone()) app.setView('code');
        if (run) app.runActive();
      } catch (e) { LG.UI.toast('Could not open that program: ' + e.message, 'err'); }
    },
    async browse(app, initialCat) {
      const L = LG.LIBRARY;
      if (!L || !L.items.length) { LG.UI.toast('The library is empty', 'err'); return; }
      const state = Object.assign({ cat: '*', level: '*', q: '' }, store.get('libState', {}));
      if (initialCat) state.cat = initialCat;
      const opened = new Set(store.get('libOpened', []));
      const nav = h('div.sheet-nav');
      const main = h('div.sheet-main', { id: 'libMain' });
      const search = h('input.field', { type: 'text', placeholder: 'Search ' + L.items.length + ' programs', value: state.q, 'aria-label': 'Search programs', id: 'libSearch', spellcheck: 'false' });
      const levels = h('div.seg', { id: 'libLevels' });
      for (const lv of ['*', 'Beginner', 'Intermediate', 'Advanced']) {
        const b = h('button', { type: 'button', dataset: { lv } }, lv === '*' ? 'All' : lv);
        b.addEventListener('click', () => { state.level = lv; render(); });
        levels.appendChild(b);
      }
      let closeFn = () => {};
      const renderNav = () => {
        nav.innerHTML = '';
        const mk = (id, label, n) => {
          const it = h('div.nav-item' + (state.cat === id ? '.active' : ''), { role: 'button', tabindex: '0', dataset: { cat: id } }, h('span', label), h('span.n', String(n)));
          it.addEventListener('click', () => { state.cat = id; render(); });
          it.addEventListener('keydown', (e) => { if (e.key === 'Enter') { state.cat = id; render(); } });
          nav.appendChild(it);
        };
        mk('*', 'Everything', L.items.length);
        for (const c of L.categories) mk(c.id, c.name, c.count);
      };
      const render = () => {
        state.q = search.value;
        store.set('libState', state);
        renderNav();
        for (const b of levels.children) b.classList.toggle('on', b.dataset.lv === state.level);
        const q = state.q.trim().toLowerCase();
        const list = L.items.filter((it) => (state.cat === '*' || it.cat === state.cat)
          && (state.level === '*' || it.level.toLowerCase() === state.level.toLowerCase())
          && (!q || (it.title + ' ' + it.summary + ' ' + it.tags.join(' ') + ' ' + it.path).toLowerCase().includes(q)));
        main.innerHTML = '';
        const cat = state.cat === '*' ? null : L.categories.find((c) => c.id === state.cat);
        main.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', margin: '2px 0 12px', flexWrap: 'wrap' } },
          h('div', { style: { flex: '1', minWidth: '160px' } }, h('div', { style: { font: '800 17px var(--font-head)' } }, cat ? cat.name : 'Everything'), h('div.muted', { style: { fontSize: '12.5px' } }, cat && cat.blurb ? cat.blurb : list.length + ' programs')),
          levels));
        const grid = h('div.cards');
        for (const it of list.slice(0, 600)) {
          const card = h('div.pcard', { role: 'button', tabindex: '0', title: it.path, dataset: { path: it.path } },
            h('div.t', (opened.has(it.path) ? '✓ ' : '') + it.title),
            h('div.d', it.summary),
            h('div.tags', h('span.tagc.lv-' + it.level.toLowerCase(), it.level), ...it.tags.slice(0, 3).map((t) => h('span.tagc', t))));
          const go = () => { opened.add(it.path); store.set('libOpened', [...opened]); closeFn(null); Library.open(app, it.path); };
          card.addEventListener('click', go);
          card.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
          grid.appendChild(card);
        }
        if (!list.length) grid.appendChild(h('div.empty', 'No programs match that.'));
        main.appendChild(grid);
      };
      search.addEventListener('input', render);
      render();
      load().catch(() => {});
      await LG.UI.modal({
        title: 'Program library', wide: true, selectInput: false,
        body: h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: '0' } },
          h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' } }, search),
          h('div.sheet-grid', { style: { flex: '1', minHeight: '0' } }, nav, main)),
        buttons: [{ label: 'Close', value: null }],
        onOpen: (b, c) => { closeFn = c; },
      });
    },
  };
})(LG);
