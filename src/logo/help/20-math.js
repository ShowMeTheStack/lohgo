(function (LG) {
  'use strict';
  LG.HELP_ENTRIES = (LG.HELP_ENTRIES || []).concat([
    // ---- Arithmetic --------------------------------------------------------------------------
    {
      n: 'sum', a: [], g: 'Arithmetic',
      s: 'SUM num1 num2\n(SUM num1 num2 num3 ...)',
      d: '<p>Outputs the total of its inputs. The infix form is <code>num1 + num2</code>.</p>' +
        '<p>Two inputs are the default; use parentheses for more or fewer. <code>(sum)</code> outputs 0. Every input must be a number, or a word that reads as one such as <code>"12</code>; otherwise you get an error like <code>sum doesn\'t like apple as input</code>.</p>' +
        '<p>Logo prints whole numbers exactly and other numbers with up to 15 significant digits, so <code>0.1 + 0.2</code> prints as <code>0.3</code>.</p>',
      e: 'print sum 3 4\nprint (sum 1 2 3 4 5)\nprint 2.5 + 0.25',
      see: ['difference', 'product', 'quotient']
    },
    {
      n: 'difference', a: [], g: 'Arithmetic',
      s: 'DIFFERENCE num1 num2',
      d: '<p>Outputs <code>num1</code> minus <code>num2</code>. The infix form is <code>num1 - num2</code>.</p>' +
        '<p>Be careful with spaces around the minus sign: <code>3 - 2</code> and <code>3-2</code> subtract, while a minus sign glued to the front of a number, as in <code>-2</code>, makes a negative number.</p>',
      e: 'print difference 10 3\nprint 10 - 3 - 2',
      see: ['sum', 'minus']
    },
    {
      n: 'minus', a: [], g: 'Arithmetic',
      s: 'MINUS num',
      d: '<p>Outputs the negative of its input: <code>minus 5</code> is -5 and <code>minus -5</code> is 5. This is useful when the number comes from a variable or another procedure, where you cannot just type a minus sign in front.</p>',
      e: 'make "n 7\nprint minus :n\nprint minus -2.5',
      see: ['difference', 'abs']
    },
    {
      n: 'product', a: [], g: 'Arithmetic',
      s: 'PRODUCT num1 num2\n(PRODUCT num1 num2 num3 ...)',
      d: '<p>Outputs its inputs multiplied together. The infix form is <code>num1 * num2</code>.</p>' +
        '<p>Two inputs are the default; use parentheses for more or fewer. <code>(product)</code> outputs 1. Non-numeric inputs give a <code>doesn\'t like</code> error.</p>',
      e: 'print product 6 7\nprint (product 2 3 4)\nprint 1.5 * 4',
      see: ['sum', 'quotient', 'power']
    },
    {
      n: 'quotient', a: [], g: 'Arithmetic',
      s: 'QUOTIENT num1 num2\n(QUOTIENT num)',
      d: '<p>Outputs <code>num1</code> divided by <code>num2</code>. The infix form is <code>num1 / num2</code>. The answer is not rounded: <code>quotient 7 2</code> is 3.5. Use INT or ROUND if you want a whole number.</p>' +
        '<p>With one input in parentheses, <code>(quotient 4)</code>, it outputs 1 divided by the input, here 0.25.</p>' +
        '<p>Dividing by zero is an error: <code>quotient doesn\'t like 0 as input</code>.</p>',
      e: 'print quotient 7 2\nprint 1 / 3\nprint (quotient 4)',
      see: ['remainder', 'modulo', 'int', 'product']
    },
    {
      n: 'remainder', a: [], g: 'Arithmetic',
      s: 'REMAINDER num1 num2',
      d: '<p>Outputs what is left over when <code>num1</code> is divided by <code>num2</code>. <code>remainder 17 5</code> is 2.</p>' +
        '<p>The answer has the same sign as the first input: <code>remainder -7 2</code> is -1. If you want an answer with the sign of the second input, as clock arithmetic usually needs, use MODULO. The inputs do not have to be whole numbers. Dividing by zero is an error.</p>',
      e: 'print remainder 17 5\nprint remainder -7 2',
      see: ['modulo', 'quotient', 'int']
    },
    {
      n: 'modulo', a: [], g: 'Arithmetic',
      s: 'MODULO num1 num2',
      d: '<p>Like REMAINDER, but the answer has the same sign as the second input. For a positive second input the answer is always between 0 and one less than it: <code>modulo -7 2</code> is 1, while <code>remainder -7 2</code> is -1.</p>' +
        '<p>This makes MODULO the right choice for wrapping around, for example keeping an angle between 0 and 359. Dividing by zero is an error.</p>',
      e: 'print modulo -7 2\nprint modulo 370 360\nprint modulo -30 360',
      see: ['remainder']
    },
    {
      n: 'int', a: [], g: 'Arithmetic',
      s: 'INT num',
      d: '<p>Outputs the whole-number part of its input by chopping off anything after the decimal point. It rounds toward zero, so <code>int 3.9</code> is 3 and <code>int -3.9</code> is -3.</p>',
      e: 'print int 3.9\nprint int -3.9',
      see: ['round', 'quotient']
    },
    {
      n: 'round', a: [], g: 'Arithmetic',
      s: 'ROUND num',
      d: '<p>Outputs the whole number nearest to the input. A number exactly halfway between two whole numbers is rounded away from zero, so <code>round 2.5</code> is 3 and <code>round -2.5</code> is -3.</p>',
      e: 'print round 3.7\nprint round 2.5\nprint round -2.5',
      see: ['int', 'form']
    },
    {
      n: 'abs', a: [], g: 'Arithmetic',
      s: 'ABS num',
      d: '<p>Outputs the absolute value of its input: the same number with any minus sign removed. <code>abs -4</code> is 4 and <code>abs 4</code> is 4.</p>',
      e: 'print abs -4\nprint abs 7 - 10',
      see: ['minus']
    },
    {
      n: 'sqrt', a: [], g: 'Arithmetic',
      s: 'SQRT num',
      d: '<p>Outputs the square root of its input: the number that, multiplied by itself, gives the input. <code>sqrt 16</code> is 4.</p>' +
        '<p>The input must not be negative; <code>sqrt -1</code> gives <code>sqrt doesn\'t like -1 as input</code>.</p>',
      e: 'print sqrt 16\nprint sqrt 2',
      see: ['power']
    },
    {
      n: 'power', a: [], g: 'Arithmetic',
      s: 'POWER base exponent',
      d: '<p>Outputs <code>base</code> raised to the power <code>exponent</code>, that is, <code>base</code> multiplied by itself <code>exponent</code> times. <code>power 2 10</code> is 1024. The infix form is <code>base ^ exponent</code>.</p>' +
        '<p>The exponent may be negative or a fraction: <code>power 2 -1</code> is 0.5 and <code>power 9 0.5</code> is 3. A negative base with a fractional exponent has no real answer and gives a <code>doesn\'t like</code> error.</p>',
      e: 'print power 2 10\nprint 3 ^ 2\nprint power 9 0.5',
      see: ['sqrt', 'exp', 'product']
    },
    {
      n: 'exp', a: [], g: 'Arithmetic',
      s: 'EXP num',
      d: '<p>Outputs <i>e</i> (about 2.71828) raised to the power of the input. It is the reverse of LN. Very large inputs give <code>inf</code>.</p>',
      e: 'print exp 1\nprint exp 0',
      see: ['ln', 'power']
    },
    {
      n: 'ln', a: [], g: 'Arithmetic',
      s: 'LN num',
      d: '<p>Outputs the natural logarithm of the input: the power you would have to raise <i>e</i> to in order to get the input. It is the reverse of EXP.</p>' +
        '<p>The input must be greater than zero, or you get a <code>doesn\'t like</code> error.</p>',
      e: 'print ln 1\nprint ln exp 2',
      see: ['exp', 'log10']
    },
    {
      n: 'log10', a: [], g: 'Arithmetic',
      s: 'LOG10 num',
      d: '<p>Outputs the logarithm to base 10 of the input: the power you would have to raise 10 to in order to get the input. <code>log10 1000</code> is 3.</p>' +
        '<p>The input must be greater than zero, or you get a <code>doesn\'t like</code> error.</p>',
      e: 'print log10 1000\nprint log10 2',
      see: ['ln', 'power']
    },
    {
      n: 'pi', a: [], g: 'Arithmetic',
      s: 'PI',
      d: '<p>Outputs the number pi, about 3.14159265358979: the distance around a circle divided by the distance across it.</p>',
      e: 'print pi\nprint 2 * pi * 10',
      see: ['sin', 'radsin']
    },
    {
      n: 'form', a: [], g: 'Arithmetic',
      s: 'FORM num width precision',
      d: '<p>Outputs a word showing <code>num</code> with exactly <code>precision</code> digits after the decimal point, padded on the left with spaces to at least <code>width</code> characters. <code>form 3.14159 8 2</code> is <code>    3.14</code>. A precision of 0 gives no decimal point. It is handy for lining up columns of numbers.</p>' +
        '<p>Because of the spaces, the result may not count as a number for further arithmetic.</p>' +
        '<p>If <code>precision</code> is a C-style format word such as <code>"%6.2f</code>, <code>"%d</code>, <code>"%e</code>, <code>"%g</code> or <code>"%x</code>, the number is formatted that way instead and <code>width</code> is ignored. A precision that is neither a number nor such a format is an error.</p>',
      e: 'print form 3.14159 8 2\nprint form 2 8 3\nprint form 255 0 "%x',
      see: ['round', 'int']
    },

    // ---- Trigonometry ------------------------------------------------------------------------
    {
      n: 'sin', a: [], g: 'Trigonometry',
      s: 'SIN degrees',
      d: '<p>Outputs the sine of an angle given in degrees, the same units the turtle uses for turning. <code>sin 30</code> is 0.5 and <code>sin 90</code> is 1.</p>' +
        '<p>Tiny rounding errors are cleaned up, so <code>sin 180</code> is exactly 0. For angles in radians use RADSIN.</p>',
      e: 'print sin 30\nprint sin 90',
      see: ['cos', 'tan', 'arcsin', 'radsin']
    },
    {
      n: 'cos', a: [], g: 'Trigonometry',
      s: 'COS degrees',
      d: '<p>Outputs the cosine of an angle given in degrees. <code>cos 0</code> is 1 and <code>cos 60</code> is 0.5. Tiny rounding errors are cleaned up, so <code>cos 90</code> is exactly 0.</p>',
      e: 'print cos 60\nrepeat 36 [setxy 100 * cos repcount * 10 100 * sin repcount * 10]',
      see: ['sin', 'tan', 'arccos', 'radcos']
    },
    {
      n: 'tan', a: [], g: 'Trigonometry',
      s: 'TAN degrees',
      d: '<p>Outputs the tangent of an angle given in degrees: the sine divided by the cosine. <code>tan 45</code> is 1. Near 90 degrees the answer becomes enormous; <code>tan 90</code> is a very large number rather than an error.</p>',
      e: 'print tan 45',
      see: ['sin', 'cos', 'arctan', 'radtan']
    },
    {
      n: 'radsin', a: [], g: 'Trigonometry',
      s: 'RADSIN radians',
      d: '<p>Outputs the sine of an angle given in radians. A full turn is 2 times pi radians, so <code>radsin pi / 2</code> is 1. Unlike SIN, the answer is not tidied, so <code>radsin pi</code> prints a tiny number close to 0.</p>',
      e: 'print radsin pi / 2',
      see: ['sin', 'radcos', 'radtan']
    },
    {
      n: 'radcos', a: [], g: 'Trigonometry',
      s: 'RADCOS radians',
      d: '<p>Outputs the cosine of an angle given in radians. <code>radcos 0</code> is 1 and <code>radcos pi</code> is -1.</p>',
      e: 'print radcos pi',
      see: ['cos', 'radsin', 'radtan']
    },
    {
      n: 'radtan', a: [], g: 'Trigonometry',
      s: 'RADTAN radians',
      d: '<p>Outputs the tangent of an angle given in radians. <code>radtan pi / 4</code> is very close to 1.</p>',
      e: 'print radtan pi / 4',
      see: ['tan', 'radsin', 'radcos']
    },
    {
      n: 'arctan', a: [], g: 'Trigonometry',
      s: 'ARCTAN num\n(ARCTAN x y)',
      d: '<p>With one input, outputs the angle in degrees whose tangent is the input, between -90 and 90. <code>arctan 1</code> is 45.</p>' +
        '<p>With two inputs in parentheses, outputs the angle in degrees from the positive x axis to the point (<code>x</code>, <code>y</code>), between -180 and 180. This version knows which quarter of the plane the point is in, so <code>(arctan -1 0)</code> is 180 and <code>(arctan 0 1)</code> is 90.</p>',
      e: 'print arctan 1\nprint (arctan -1 0)\nprint (arctan 0 1)',
      see: ['tan', 'radarctan', 'arcsin', 'arccos']
    },
    {
      n: 'radarctan', a: [], g: 'Trigonometry',
      s: 'RADARCTAN num\n(RADARCTAN x y)',
      d: '<p>Like ARCTAN, but the answer is in radians. With one input the result is between -pi/2 and pi/2; with two inputs, <code>(radarctan x y)</code>, it is the angle of the point (<code>x</code>, <code>y</code>), between -pi and pi.</p>',
      e: 'print radarctan 1\nprint (radarctan -1 0)',
      see: ['arctan']
    },
    {
      n: 'arcsin', a: [], g: 'Trigonometry',
      s: 'ARCSIN num',
      d: '<p>Outputs the angle in degrees, between -90 and 90, whose sine is the input. <code>arcsin 0.5</code> is 30.</p>' +
        '<p>The input must be between -1 and 1; anything else gives a <code>doesn\'t like</code> error.</p>',
      e: 'print arcsin 0.5\nprint arcsin 1',
      see: ['sin', 'arccos', 'radarcsin']
    },
    {
      n: 'arccos', a: [], g: 'Trigonometry',
      s: 'ARCCOS num',
      d: '<p>Outputs the angle in degrees, between 0 and 180, whose cosine is the input. <code>arccos 0.5</code> is 60.</p>' +
        '<p>The input must be between -1 and 1; anything else gives a <code>doesn\'t like</code> error.</p>',
      e: 'print arccos 0.5\nprint arccos -1',
      see: ['cos', 'arcsin', 'radarccos']
    },
    {
      n: 'radarcsin', a: [], g: 'Trigonometry',
      s: 'RADARCSIN num',
      d: '<p>Outputs the angle in radians, between -pi/2 and pi/2, whose sine is the input. The input must be between -1 and 1.</p>',
      e: 'print radarcsin 1',
      see: ['arcsin', 'radarccos']
    },
    {
      n: 'radarccos', a: [], g: 'Trigonometry',
      s: 'RADARCCOS num',
      d: '<p>Outputs the angle in radians, between 0 and pi, whose cosine is the input. The input must be between -1 and 1.</p>',
      e: 'print radarccos -1',
      see: ['arccos', 'radarcsin']
    },

    // ---- Number sequences --------------------------------------------------------------------
    {
      n: 'iseq', a: [], g: 'Number sequences',
      s: 'ISEQ from to',
      d: '<p>Outputs a list of the whole numbers from <code>from</code> to <code>to</code>, counting by one, and including both ends. <code>iseq 1 5</code> is <code>[1 2 3 4 5]</code>. If <code>from</code> is bigger, it counts down: <code>iseq 5 1</code> is <code>[5 4 3 2 1]</code>.</p>' +
        '<p>Both inputs must be whole numbers. The list may have at most about ten million members.</p>',
      e: 'show iseq 1 10\nshow iseq 3 -3',
      see: ['rseq', 'repeat', 'for']
    },
    {
      n: 'rseq', a: [], g: 'Number sequences',
      s: 'RSEQ from to count',
      d: '<p>Outputs a list of <code>count</code> numbers evenly spaced from <code>from</code> to <code>to</code>, including both ends. <code>rseq 0 1 5</code> is <code>[0 0.25 0.5 0.75 1]</code>.</p>' +
        '<p>The ends may be any numbers. The count must be a whole number, zero or more; a count of 1 gives just <code>[from]</code>.</p>',
      e: 'show rseq 0 1 5\nshow rseq 10 0 3',
      see: ['iseq']
    },

    // ---- Comparing numbers -------------------------------------------------------------------
    {
      n: 'lessp', a: ['less?'], g: 'Comparing numbers',
      s: 'LESSP num1 num2\nLESS? num1 num2',
      d: '<p>Outputs <code>true</code> if <code>num1</code> is smaller than <code>num2</code>, and <code>false</code> otherwise. The infix form is <code>num1 &lt; num2</code>.</p>' +
        '<p>Both inputs must be numbers. To put words in alphabetical order use BEFOREP; <code>lessp "a 3</code> gives <code>lessp doesn\'t like a as input</code>.</p>',
      e: 'print lessp 3 5\nprint 10 < 2',
      see: ['greaterp', 'lessequalp', 'beforep', 'equalp']
    },
    {
      n: 'greaterp', a: ['greater?'], g: 'Comparing numbers',
      s: 'GREATERP num1 num2\nGREATER? num1 num2',
      d: '<p>Outputs <code>true</code> if <code>num1</code> is bigger than <code>num2</code>, and <code>false</code> otherwise. The infix form is <code>num1 &gt; num2</code>. Both inputs must be numbers.</p>',
      e: 'print greaterp 3 5\nprint 10 > 2',
      see: ['lessp', 'greaterequalp']
    },
    {
      n: 'lessequalp', a: ['lessequal?'], g: 'Comparing numbers',
      s: 'LESSEQUALP num1 num2\nLESSEQUAL? num1 num2',
      d: '<p>Outputs <code>true</code> if <code>num1</code> is smaller than or equal to <code>num2</code>, and <code>false</code> otherwise. The infix form is <code>num1 &lt;= num2</code>. Both inputs must be numbers.</p>',
      e: 'print lessequalp 3 3\nprint 4 <= 3',
      see: ['lessp', 'greaterequalp']
    },
    {
      n: 'greaterequalp', a: ['greaterequal?'], g: 'Comparing numbers',
      s: 'GREATEREQUALP num1 num2\nGREATEREQUAL? num1 num2',
      d: '<p>Outputs <code>true</code> if <code>num1</code> is bigger than or equal to <code>num2</code>, and <code>false</code> otherwise. The infix form is <code>num1 &gt;= num2</code>. Both inputs must be numbers.</p>',
      e: 'print greaterequalp 3 3\nprint 2 >= 3',
      see: ['greaterp', 'lessequalp']
    },

    // ---- Random numbers ----------------------------------------------------------------------
    {
      n: 'random', a: [], g: 'Random numbers',
      s: 'RANDOM num\n(RANDOM start end)',
      d: '<p>With one input, outputs a random whole number from 0 up to one less than the input, each equally likely. <code>random 6</code> gives 0, 1, 2, 3, 4 or 5, so a dice roll is <code>1 + random 6</code>.</p>' +
        '<p>With two inputs in parentheses, outputs a random whole number from <code>start</code> to <code>end</code>, including both: <code>(random 1 6)</code> is a dice roll.</p>' +
        '<p>Inputs must be whole numbers. The single input must be at least 1, and <code>end</code> must not be less than <code>start</code>; otherwise you get a <code>doesn\'t like</code> error.</p>',
      e: 'repeat 5 [print 1 + random 6]\nprint (random 10 20)',
      see: ['rerandom', 'pick']
    },
    {
      n: 'rerandom', a: [], g: 'Random numbers',
      s: 'RERANDOM\n(RERANDOM seed)',
      d: '<p>Restarts the random number generator, so that RANDOM and PICK give the same sequence again. This is useful for testing a program that uses random numbers, or for drawing the same "random" picture twice.</p>' +
        '<p>With no input the seed is 0. With a whole-number seed in parentheses, each different seed gives its own repeatable sequence.</p>',
      e: 'rerandom\nprint random 100\nrerandom\nprint random 100',
      see: ['random', 'pick']
    },

    // ---- Bits --------------------------------------------------------------------------------
    {
      n: 'bitand', a: [], g: 'Bits',
      s: 'BITAND num1 num2\n(BITAND num1 num2 num3 ...)',
      d: '<p>Outputs the bitwise AND of its inputs: each bit of the result is 1 only where that bit is 1 in every input. <code>bitand 12 10</code> is 8, because 1100 AND 1010 is 1000 in binary.</p>' +
        '<p>Inputs must be whole numbers and are treated as 32-bit signed integers. <code>(bitand)</code> with no inputs outputs -1 (all bits set).</p>',
      e: 'print bitand 12 10',
      see: ['bitor', 'bitxor', 'bitnot']
    },
    {
      n: 'bitor', a: [], g: 'Bits',
      s: 'BITOR num1 num2\n(BITOR num1 num2 num3 ...)',
      d: '<p>Outputs the bitwise OR of its inputs: each bit of the result is 1 where that bit is 1 in at least one input. <code>bitor 12 10</code> is 14 (1100 OR 1010 is 1110).</p>' +
        '<p>Inputs must be whole numbers and are treated as 32-bit signed integers. <code>(bitor)</code> outputs 0.</p>',
      e: 'print bitor 12 10',
      see: ['bitand', 'bitxor']
    },
    {
      n: 'bitxor', a: [], g: 'Bits',
      s: 'BITXOR num1 num2\n(BITXOR num1 num2 num3 ...)',
      d: '<p>Outputs the bitwise exclusive OR of its inputs: each bit of the result is 1 where an odd number of the inputs have a 1 in that place. <code>bitxor 12 10</code> is 6 (1100 XOR 1010 is 0110).</p>' +
        '<p>Inputs must be whole numbers and are treated as 32-bit signed integers. <code>(bitxor)</code> outputs 0.</p>',
      e: 'print bitxor 12 10',
      see: ['bitand', 'bitor']
    },
    {
      n: 'bitnot', a: [], g: 'Bits',
      s: 'BITNOT num',
      d: '<p>Outputs the number with every bit flipped. Because numbers are treated as 32-bit signed integers, the result is always minus the input minus one: <code>bitnot 5</code> is -6.</p>',
      e: 'print bitnot 5\nprint bitnot -1',
      see: ['bitand', 'bitxor']
    },
    {
      n: 'ashift', a: [], g: 'Bits',
      s: 'ASHIFT num places',
      d: '<p>Arithmetic shift. With a positive <code>places</code>, shifts the bits of <code>num</code> left, which multiplies by 2 for each place: <code>ashift 3 2</code> is 12. With a negative <code>places</code>, shifts right and keeps the sign, which divides by 2 for each place and rounds down: <code>ashift -8 -1</code> is -4.</p>' +
        '<p>Inputs must be whole numbers, and the result is a 32-bit signed integer, so large shifts wrap around.</p>',
      e: 'print ashift 3 2\nprint ashift -8 -1',
      see: ['lshift']
    },
    {
      n: 'lshift', a: [], g: 'Bits',
      s: 'LSHIFT num places',
      d: '<p>Logical shift. Shifting left (positive <code>places</code>) is the same as ASHIFT. Shifting right (negative <code>places</code>) fills the top bits with zeros instead of copying the sign, so a negative number turns into a large positive one: <code>lshift -8 -1</code> is 2147483644.</p>' +
        '<p>Inputs must be whole numbers; they are treated as 32-bit integers.</p>',
      e: 'print lshift 1 4\nprint lshift -8 -1',
      see: ['ashift']
    },

    // ---- Logic -------------------------------------------------------------------------------
    {
      n: 'and', a: [], g: 'Logic',
      s: 'AND tf1 tf2\n(AND tf1 tf2 tf3 ...)',
      d: '<p>Outputs <code>true</code> if all of its inputs are <code>true</code>, and <code>false</code> if any of them is <code>false</code>. <code>(and)</code> with no inputs outputs <code>true</code>.</p>' +
        '<p>Each input must be the word <code>true</code> or <code>false</code> (in any case), or an instruction list that outputs one of them. Lists are run only when needed, from left to right, and AND stops at the first <code>false</code>. So <code>and :n &gt; 0 [10 / :n &gt; 2]</code> never divides by zero.</p>' +
        '<p>Any other input, such as <code>"yes</code>, gives a <code>doesn\'t like</code> error.</p>',
      e: 'print and "true "false\nprint and 3 > 1 5 > 2\nmake "n 0\nprint and :n > 0 [10 / :n > 2]',
      see: ['or', 'not', 'if']
    },
    {
      n: 'or', a: [], g: 'Logic',
      s: 'OR tf1 tf2\n(OR tf1 tf2 tf3 ...)',
      d: '<p>Outputs <code>true</code> if at least one of its inputs is <code>true</code>, and <code>false</code> if all of them are <code>false</code>. <code>(or)</code> with no inputs outputs <code>false</code>.</p>' +
        '<p>Each input must be <code>true</code> or <code>false</code>, or an instruction list that outputs one of them. Lists are run only when needed, from left to right, and OR stops at the first <code>true</code>. Other inputs give a <code>doesn\'t like</code> error.</p>',
      e: 'print or "true "false\nprint or 1 > 5 [2 > 1]',
      see: ['and', 'not']
    },
    {
      n: 'not', a: [], g: 'Logic',
      s: 'NOT tf',
      d: '<p>Outputs <code>true</code> if its input is <code>false</code>, and <code>false</code> if its input is <code>true</code>.</p>' +
        '<p>The input may also be an instruction list that outputs <code>true</code> or <code>false</code>; NOT runs it and flips the answer. Any other input gives a <code>doesn\'t like</code> error.</p>',
      e: 'print not "true\nprint not 3 > 5\nprint not [emptyp [a b]]',
      see: ['and', 'or']
    }
  ]);
})(LG);
