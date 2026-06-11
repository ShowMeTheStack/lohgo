// A small speaker for SOUND and TONE: square-wave beeps, scheduled so a list of notes plays in order.
(function (LG) {
  'use strict';
  class Audio {
    constructor() { this.ctx = null; this.gain = 0.08; }
    ensure() {
      if (this.ctx) return this.ctx;
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return null;
      this.ctx = new AC();
      return this.ctx;
    }
    /** Play freq Hz for ms milliseconds, starting after delayMs */
    tone(freq, ms, delayMs) {
      const c = this.ensure();
      if (!c || !(freq > 0) || !(ms > 0)) return;
      if (c.state === 'suspended') c.resume();
      const t0 = c.currentTime + (delayMs || 0) / 1000 + 0.005;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'square';
      osc.frequency.value = Math.min(Math.max(freq, 20), 20000);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(this.gain, t0 + 0.004);
      g.gain.setValueAtTime(this.gain, t0 + ms / 1000 - 0.006);
      g.gain.linearRampToValueAtTime(0, t0 + ms / 1000);
      osc.connect(g).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + ms / 1000 + 0.02);
    }
    stop() { if (this.ctx) { this.ctx.close(); this.ctx = null; } }
  }
  LG.Audio = Audio;
})(LG);
