// The language reference: every primitive with its inputs, what it does and an example to try,
// plus a few short topic pages.
(function (LG) {
  'use strict';
  const { h, icon } = LG.UI;
  const esc = LG.escapeHtml;

  const Help = LG.Help = {};
  let index = null;

  function build() {
    if (index) return index;
    const entries = (LG.HELP_ENTRIES || []).slice();
    const byName = new Map();
    for (const e of entries) {
      byName.set(e.n.toLowerCase(), e);
      for (const a of e.a || []) byName.set(a.toLowerCase(), e);
    }
    const groups = [];
    for (const e of entries) if (!groups.includes(e.g)) groups.push(e.g);
    index = { entries, byName, groups };
    return index;
  }
  Help.find = (w) => build().byName.get(String(w || '').toLowerCase()) || null;
  /** A short description for the editor callout */
  Help.brief = function (w) {
    const e = Help.find(w);
    if (!e || e.topic) return null;
    const first = (e.d || '').replace(/<[^>]+>/g, '').split(/(?<=\.)\s/)[0];
    return h('div', h('div', { style: { font: '700 13px var(--font-code)', color: 'var(--c-prim)' } }, e.s), h('div', { style: { fontSize: '12.5px', marginTop: '4px', color: 'var(--ink-2)' } }, first), h('div.muted', { style: { fontSize: '11.5px', marginTop: '6px' } }, 'F1 for more'));
  };

  Help.open = function (app, word) {
    const ix = build();
    let current = word ? Help.find(word) : null;
    let group = current ? current.g : ix.groups[0];
    const search = h('input', { type: 'text', placeholder: 'Search, e.g. forward, list, color', 'aria-label': 'Search the reference', id: 'helpSearch', spellcheck: 'false', autocapitalize: 'off' });
    const nav = h('div.sheet-nav');
    const main = h('div.sheet-main', { id: 'helpMain' });
    const searchBox = h('div', { style: { padding: '4px 2px 8px' } }, search);
    const renderNav = () => {
      // keep the search box in the page: taking it out would lose the focus after every key typed
      while (nav.lastChild && nav.lastChild !== searchBox) nav.lastChild.remove();
      if (!searchBox.parentNode) nav.appendChild(searchBox);
      for (const g of ix.groups) {
        const n = ix.entries.filter((e) => e.g === g).length;
        const it = h('div.nav-item' + (g === group && !search.value ? '.active' : ''), { role: 'button', tabindex: '0' }, h('span', g), h('span.n', String(n)));
        it.addEventListener('click', () => { group = g; current = null; search.value = ''; render(); });
        nav.appendChild(it);
      }
    };
    const entryView = (e) => {
      const box = h('div.help-entry');
      box.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        h('button.small-btn', { type: 'button', onclick: () => { current = null; group = e.g; search.value = ''; render(); } }, '◀ ' + e.g), h('span.muted', { style: { fontSize: '12px' } }, e.topic ? 'Topic' : 'Primitive')));
      box.appendChild(h('h3', e.n + ((e.a && e.a.length) ? '   ' + e.a.join('  ') : '')));
      if (e.s) box.appendChild(h('div.syn', e.s));
      box.appendChild(h('div', { html: e.d || '' }));
      if (e.e) {
        box.appendChild(h('div.vsec', { style: { padding: '12px 0 4px' } }, 'Example'));
        box.appendChild(h('pre', e.e));
        const tryIt = h('button.btn.primary', { type: 'button', id: 'helpTry' }, 'Try it');
        tryIt.addEventListener('click', () => {
          if (app.isBusy()) { LG.UI.toast('Stop the running program first', 'err'); return; }
          closeFn(null);
          if (app.isPhone()) app.setView('turtle');
          const lines = e.e.split('\n');
          if (lines.some((l) => /^\s*(to|\.macro)\s/i.test(l))) {   // definitions need the editor: TO and .MACRO cannot be typed on one line
            LG.Tours.scratch(app, 'try-' + e.n.replace(/[^\w]/g, '') + '.lgo', e.e + '\n');
            app.runActive();
          } else {
            app.commander.echo(e.e);
            app.runCommand(e.e);
          }
        });
        box.appendChild(h('div', { style: { marginTop: '8px', display: 'flex', gap: '8px' } }, tryIt));
      }
      if (e.see && e.see.length) {
        box.appendChild(h('div.vsec', { style: { padding: '14px 0 4px' } }, 'See also'));
        const row = h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
        for (const s of e.see) { const x = Help.find(s); if (!x) continue; const b = h('button.small-btn', { type: 'button' }, s); b.addEventListener('click', () => { current = x; render(); }); row.appendChild(b); }
        box.appendChild(row);
      }
      return box;
    };
    const listView = (items, title) => {
      const box = h('div');
      if (title) box.appendChild(h('div.vsec', { style: { padding: '6px 0 6px' } }, title));
      if (!items.length) box.appendChild(h('div.empty', 'Nothing found. Try a shorter word.'));
      for (const e of items) {
        const row = h('div.list-row.clickable', { tabindex: '0', role: 'button' },
          h('span.code', { style: { color: 'var(--c-prim)', minWidth: '150px', fontWeight: '700' } }, e.n), h('span.grow', (e.d || '').replace(/<[^>]+>/g, '').split(/(?<=\.)\s/)[0]));
        row.addEventListener('click', () => { current = e; render(); });
        row.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { current = e; render(); } });
        box.appendChild(row);
      }
      return box;
    };
    const render = () => {
      renderNav();
      main.innerHTML = '';
      main.scrollTop = 0;
      if (current) { main.appendChild(entryView(current)); return; }
      const q = search.value.trim().toLowerCase();
      if (q) {
        const hits = ix.entries.filter((e) => e.n.toLowerCase().includes(q) || (e.a || []).some((a) => a.toLowerCase().includes(q)) || (e.d || '').toLowerCase().includes(q));
        hits.sort((a, b) => (b.n.toLowerCase() === q) - (a.n.toLowerCase() === q) || (b.n.toLowerCase().startsWith(q)) - (a.n.toLowerCase().startsWith(q)));
        main.appendChild(listView(hits.slice(0, 200), hits.length + ' found'));
        return;
      }
      main.appendChild(listView(ix.entries.filter((e) => e.g === group), group));
    };
    search.addEventListener('input', () => { current = null; render(); });
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const r = main.querySelector('.list-row'); if (r) r.click(); } });
    if (word && !current) search.value = word;
    render();
    let closeFn = () => {};
    LG.UI.modal({
      title: 'Logo reference', wide: true,
      body: h('div.sheet-grid', nav, main),
      buttons: [{ label: 'Close', value: null }],
      onOpen: (box, close) => { closeFn = close; setTimeout(() => search.focus(), 40); },
    });
    void icon; void esc;
  };
})(LG);
