// The editor hover callout. While a program is paused, pointing at a variable shows its value
// as an unfoldable tree that can be edited. The callout stays open while the mouse moves
// into it. It edits the newest frame; older frames are edited from the Variables panel.
// When nothing is running, pointing at a primitive shows how to use it.
(function (LG) {
  'use strict';
  const { h } = LG.UI;

  class Callout {
    constructor(app) {
      this.app = app;
      this.el = null;
      this.hideTimer = null;
      this.state = { expanded: new Set(), pages: new Map(), prev: new Map() };
    }
    showFor(doc, pos, x, y) {
      const line = doc.editor.lines()[pos.line] || '';
      const w = LG.LogoLang.wordAt(line, pos.col);
      if (!w) { this.scheduleHide(300); return; }
      // nothing to show for words in a comment
      if (/(^|[^\\]);/.test(line.slice(0, w.start).replace(/\|[^|]*\|/g, ''))) { this.scheduleHide(300); return; }
      const key = doc.path + ':' + pos.line + ':' + w.start + ':' + w.word;
      if (this.el && this.key === key) { this.cancelHide(); return; }
      const I = this.app.interp;
      const paused = I.state === 'paused' || I.state === 'error';
      if (paused && (w.kind === 'var' || w.kind === 'quoted' || w.kind === 'proc')) {
        const frames = LG.Debug.frames(I);
        const top = frames[frames.length - 1];
        const found = top ? LG.Debug.lookup(I, w.word, top.scope) : LG.Debug.lookup(I, w.word, null);
        if (found && found.value !== undefined) {
          this.open(key, x, y, () => this.renderValue(w.word, found, top));
          return;
        }
      }
      if (!paused && w.kind === 'proc' && LG.Help && LG.Help.brief(w.word)) {
        this.open(key, x, y, () => h('div', { style: { padding: '10px 14px' } }, LG.Help.brief(w.word)));
        return;
      }
      this.scheduleHide(300);
    }
    renderValue(name, found, top) {
      const box = h('div');
      const tree = new LG.VarTree({
        app: this.app,
        state: this.state,
        canEdit: () => true,
        refresh: () => tree.render(box, [{ entries: [LG.Debug.entry(name, this.current().value, this.current().ref)], key: 'callout' }]),
        onEdited: () => { this.app.afterEdit(); tree.refresh(); },
      });
      const self = this;
      this.current = () => {
        const fr = LG.Debug.frames(this.app.interp);
        const t = fr[fr.length - 1];
        return LG.Debug.lookup(self.app.interp, name, t ? t.scope : null) || found;
      };
      tree.refresh();
      const where = top && top.proc ? 'Value in ' + top.proc.name + ' (the newest frame). Click it to change it. Use the Call Stack for older frames.' : 'Click the value to change it.';
      return h('div', box, h('div.callout-foot', where));
    }
    open(key, x, y, build) {
      this.hide();
      this.key = key;
      const body = h('div.callout-body');
      this.el = h('div.callout', { role: 'dialog', 'aria-label': 'Value' }, body);
      body.appendChild(build());
      document.body.appendChild(this.el);
      // layout size, not the bounding box: the opening animation scales the box down
      const r = { width: this.el.offsetWidth, height: this.el.offsetHeight };
      const left = Math.min(x + 6, window.innerWidth - r.width - 8);
      let top = y + 18;
      if (top + r.height > window.innerHeight - 8) top = Math.max(8, y - r.height - 10);
      this.el.style.left = Math.max(8, left) + 'px';
      this.el.style.top = top + 'px';
      this.el.addEventListener('mouseenter', () => this.cancelHide());
      this.el.addEventListener('mouseleave', () => { if (!this.el.contains(document.activeElement)) this.scheduleHide(400); });
      this.el.addEventListener('focusout', () => setTimeout(() => { if (this.el && !this.el.contains(document.activeElement) && !this.el.matches(':hover')) this.scheduleHide(300); }, 0));
    }
    scheduleHide(ms) {
      this.cancelHide();
      this.hideTimer = setTimeout(() => {
        if (this.el && (this.el.matches(':hover') || this.el.contains(document.activeElement))) return;
        this.hide();
      }, ms);
    }
    cancelHide() { if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; } }
    hide() { this.cancelHide(); if (this.el) { this.el.remove(); this.el = null; this.key = null; } }
    isOpen() { return !!this.el; }
  }

  LG.Callout = Callout;
})(LG);
