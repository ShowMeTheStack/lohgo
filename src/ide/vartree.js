// A tree of Logo values for the Variables panel and the editor hover callout. Lists and arrays
// unfold one level at a time; any value can be changed by typing a new one.
(function (LG) {
  'use strict';
  const { h } = LG.UI;
  const PAGE = 100;

  class VarTree {
    /** opts: {app, canEdit(entry), onEdited(), refresh(), state?} */
    constructor(opts) {
      this.opts = opts;
      this.state = opts.state || { expanded: new Set(), pages: new Map(), prev: new Map() };
      if (!this.state.seen) this.state.seen = new Map();
    }
    /** The program moved on (a pause, a command): values from now on are compared with the ones shown until now */
    mark() {
      const st = this.state;
      for (const [k, v] of st.seen) st.prev.set(k, v);
      st.seen = new Map();
    }
    render(el, sections) {
      el.innerHTML = '';
      for (const sec of sections) {
        if (sec.title) el.appendChild(h('div.vsec', sec.title + (sec.entries && sec.count !== false ? ' (' + sec.entries.length + ')' : '')));
        if (sec.entries && !sec.entries.length) el.appendChild(h('div.empty', { style: { padding: '4px 14px 8px' } }, sec.empty || 'none'));
        for (const e of sec.entries || []) this.row(el, e, 0, (sec.key || '') + '/' + e.name);
      }
    }
    row(el, e, depth, key) {
      const st = this.state;
      // compared with the value at the last pause, so the highlight stays however often the panel redraws
      const changed = st.prev.has(key) && st.prev.get(key) !== e.text && !e.isGroup;
      st.seen.set(key, e.text);
      const open = st.expanded.has(key);
      const tw = h('span.twisty', { role: e.expandable ? 'button' : null, 'aria-label': e.expandable ? (open ? 'Collapse ' + e.name : 'Expand ' + e.name) : null, 'aria-expanded': e.expandable ? String(open) : null }, e.expandable ? (open ? '▾' : '▸') : '');
      const editable = !e.isGroup && !!e.ref && this.opts.canEdit(e);
      const nameCell = h('div.vn', { style: { paddingLeft: (8 + depth * 14) + 'px' } }, tw, h('span', e.name),
        e.param ? h('span.vbadge', 'input') : null, e.loop ? h('span.vbadge.loop', 'loop') : null);
      const valCell = h('div.vv' + (changed ? '.changed' : '') + (editable ? '.editable' : ''),
        { title: editable ? 'Click to change' : (e.expandable ? 'Unfold to see the parts' : ''), tabindex: editable ? '0' : null, role: editable ? 'button' : null },
        e.isGroup ? h('span.muted', e.text) : e.text);
      const rowEl = h('div.vrow', { dataset: { key } }, nameCell, h('div.vt', e.type), valCell);
      const toggle = () => { if (open) st.expanded.delete(key); else st.expanded.add(key); this.refresh(); };
      if (e.expandable) { tw.addEventListener('click', toggle); nameCell.addEventListener('dblclick', toggle); }
      if (editable) {
        const start = () => this.edit(valCell, e);
        valCell.addEventListener('click', start);
        valCell.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); start(); } });
      }
      el.appendChild(rowEl);
      if (e.expandable && open) {
        const pk = key + '#page';
        const start = st.pages.get(pk) || 0;
        let kids;
        try { kids = LG.Debug.children(e, start, PAGE); } catch (err) { kids = { items: [], total: 0 }; }
        for (const c of kids.items) this.row(el, c, depth + 1, key + '/' + c.name);
        if (kids.total > PAGE) {
          el.appendChild(h('div.vrow.pager', h('div', { style: { paddingLeft: (24 + depth * 14) + 'px', display: 'flex', gap: '6px', alignItems: 'center', padding: '4px 0 4px ' + (24 + depth * 14) + 'px' } },
            h('button.small-btn', { type: 'button', disabled: start === 0, onclick: () => { st.pages.set(pk, Math.max(0, start - PAGE)); this.refresh(); } }, '◀ earlier'),
            h('span.muted', `${start + 1}–${Math.min(kids.total, start + PAGE)} of ${kids.total}`),
            h('button.small-btn', { type: 'button', disabled: start + PAGE >= kids.total, onclick: () => { st.pages.set(pk, start + PAGE); this.refresh(); } }, 'later ▶'))));
        }
      }
    }
    edit(cell, e) {
      if (cell.querySelector('input')) return;
      const cur = LG.Debug.brief(e.value, 100000);
      const inp = h('input', { type: 'text', value: cur, 'aria-label': 'New value for ' + e.name, spellcheck: 'false', autocapitalize: 'off' });
      cell.innerHTML = '';
      cell.appendChild(inp);
      inp.focus();
      inp.select();
      let done = false;
      const commit = (ok) => {
        if (done) return;
        done = true;
        if (ok && inp.value !== cur) {
          try {
            LG.Debug.assign(this.opts.app.interp, e, inp.value);
            LG.UI.toast('Changed ' + e.name, 'ok', 1400);
          } catch (err) { LG.UI.toast('Could not change ' + e.name + ': ' + err.message, 'err'); }
        }
        if (this.opts.onEdited) this.opts.onEdited(); else this.refresh();
      };
      inp.addEventListener('keydown', (ev) => {
        ev.stopPropagation();
        if (ev.key === 'Enter') commit(true);
        if (ev.key === 'Escape') commit(false);
      });
      inp.addEventListener('blur', () => commit(true));
    }
    refresh() { if (this.opts.refresh) this.opts.refresh(); }
  }

  LG.VarTree = VarTree;
})(LG);
