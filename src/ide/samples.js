// The example programs that come with Lohgo. They live in /examples as originals: anyone can
// open, change and run them, and saving makes a copy of their own.
(function (LG) {
  'use strict';
  const Samples = LG.Samples = {};

  /** Copy the examples onto the disk when they are missing or out of date */
  Samples.install = function (app) {
    const vfs = app.vfs;
    const files = LG.SAMPLE_FILES || {};
    const sig = Object.keys(files).length + ':' + Object.values(files).reduce((a, t) => (a * 31 + t.length) >>> 0, 7);
    const stamp = LG.UI.storage.get('examplesSig', '');
    const missing = !vfs.exists('/examples');
    if (!missing && stamp === sig) return;
    try { if (vfs.exists('/examples')) vfs.rmdir('/examples', { recursive: true, trusted: true }); } catch (e) { /* first time */ }
    vfs.mkdir('/examples', { trusted: true, readOnly: true });
    for (const [rel, text] of Object.entries(files)) {
      const p = '/examples/' + rel;
      const dir = p.replace(/\/[^/]*$/, '');
      if (!vfs.exists(dir)) vfs.mkdir(dir, { parents: true, trusted: true, readOnly: true });
      vfs.writeText(p, text, { trusted: true, readOnly: true });
    }
    LG.UI.storage.set('examplesSig', sig);
  };

  /** The first program a new visitor sees */
  Samples.starter = function () {
    return [
      '; Welcome to Lohgo!',
      '; This is a Logo program. Press F5 (or the green Run button) to run it.',
      '; Then try changing the numbers and running it again.',
      '',
      'to square :size',
      '  repeat 4 [forward :size right 90]',
      'end',
      '',
      'to flower',
      '  repeat 36 [square 80 right 10]',
      'end',
      '',
      'setpencolor "purple',
      'flower',
      '',
    ].join('\n');
  };
})(LG);
