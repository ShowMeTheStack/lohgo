// Errors and the control-flow signals used by OUTPUT, STOP, THROW and GOTO.
// Codes and wording follow Berkeley Logo, so ERROR and CATCH "ERROR behave the same.
(function (LG) {
  'use strict';

  const CODES = {
    0: 'Fatal internal error',
    1: 'Out of memory',
    2: 'Stack overflow',
    3: 'Turtle out of bounds',
    4: '%P doesn\'t like %D as input',
    5: '%P didn\'t output to %Q',
    6: 'Not enough inputs to %P',
    7: '%P doesn\'t like %D as input',
    8: 'Too much inside ()\'s',
    9: 'You don\'t say what to do with %D',
    10: '\')\' not found',
    11: '%D has no value',
    12: 'Unexpected \')\'',
    13: 'I don\'t know how to %P',
    14: 'Can\'t find catch tag for %D',
    15: '%P is already defined',
    16: 'Stopped',
    17: 'Already dribbling',
    18: 'File system error: %D',
    19: 'Assuming you mean IFELSE, not IF',
    20: '%D shadowed by local in procedure call',
    21: 'Throw "Error',
    22: '%P is a primitive',
    23: 'Can\'t use TO inside a procedure',
    24: 'I don\'t know how to %P',
    25: 'IFTRUE/IFFALSE without TEST',
    26: 'Unexpected \']\'',
    27: 'Unexpected \'}\'',
    28: 'Couldn\'t initialize graphics',
    29: 'Macro returned %D instead of a list',
    30: 'You don\'t say what to do with %D',
    31: 'Can only use STOP or OUTPUT inside a procedure',
    32: 'APPLY doesn\'t like %D as input',
    33: 'END inside multi-line instruction',
    34: 'Really out of memory',
    35: '%D',
    36: 'Can\'t use GOTO outside a procedure',
    37: 'Can\'t find tag %D',
    38: 'Too many inputs to %P',
    39: 'Disk is read-only',
  };

  /** A Logo run-time error. proc/datum fill in %P and %D in the message. */
  class LogoError extends Error {
    constructor(code, opts) {
      opts = opts || {};
      super('');
      this.code = code;
      this.proc = opts.proc || '';
      this.datum = opts.datum;
      this.caller = opts.caller || '';
      this.custom = opts.message;
      this.hint = opts.hint;
      this.message = this.text();
    }
    text() {
      if (this.custom) return this.custom;
      const D = LG.Data;
      const t = CODES[this.code] || ('Error ' + this.code);
      return t.replace('%P', this.proc).replace('%Q', this.caller).replace('%D', () => this.datum === undefined ? '' : D.showText(this.datum));
    }
  }

  // Non-error signals: they unwind the interpreter's generators like exceptions do.
  class OutputSignal { constructor(value) { this.value = value; } }
  class StopSignal { }
  class ThrowSignal { constructor(tag, value) { this.tag = tag; this.value = value; } }
  class GotoSignal { constructor(tag) { this.tag = tag; } }
  /** Raised when the program is stopped from outside (Stop button, BYE, THROW "TOPLEVEL) */
  class HaltSignal { constructor(reason) { this.reason = reason || 'halt'; } }

  /** Plain-English hints shown under an error in the IDE */
  const HINTS = {
    4: 'Check the kind of thing you gave it: a number, a word or a list.',
    5: 'The procedure ended without OUTPUT. Make sure every path through it outputs something.',
    6: 'Something is missing after the command. Count the inputs it needs.',
    7: 'Check the kind of thing you gave it: a number, a word or a list.',
    9: 'A value was produced but nothing used it. Did you forget PRINT, or a command before it?',
    10: 'Every ( needs a matching ).',
    11: 'Use MAKE to give the variable a value first, or check the spelling after the colon.',
    13: 'Check the spelling, or define it with TO ... END before you use it.',
    24: 'Check the spelling, or define it with TO ... END before you use it.',
    26: 'There is a ] without a matching [.',
    31: 'OUTPUT and STOP only make sense inside a procedure (between TO and END).',
  };

  LG.LogoError = LogoError;
  LG.Signals = { OutputSignal, StopSignal, ThrowSignal, GotoSignal, HaltSignal };
  LG.ERROR_CODES = CODES;
  LG.ERROR_HINTS = HINTS;
})(LG);
