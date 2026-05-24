// Core namespace and shared helpers. Every source file attaches to the global LG object.
/* global globalThis */
var LG = (typeof globalThis !== 'undefined' && globalThis.LG) || {};
if (typeof globalThis !== 'undefined') globalThis.LG = LG;

(function (LG) {
  'use strict';

  /** UTF-8 text <-> Uint8Array */
  LG.utf8 = function (s) { return new TextEncoder().encode(s); };
  LG.unutf8 = function (b) { return new TextDecoder().decode(b); };

  LG.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  LG.escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Tiny event emitter mixin */
  LG.Emitter = class {
    constructor() { this._h = {}; }
    on(ev, fn) { (this._h[ev] || (this._h[ev] = [])).push(fn); return () => this.off(ev, fn); }
    off(ev, fn) { const a = this._h[ev]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }
    emit(ev, ...args) { const a = this._h[ev]; if (a) for (const fn of a.slice()) fn(...args); }
  };

  LG.isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
})(LG);
