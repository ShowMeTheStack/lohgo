// Logo typed at the command center: templates, control structures, property lists, stacks and
// queues, CATCH/THROW/ERROR, RUN/RUNRESULT, DEFINE/TEXT, PO/POTS/ERASE/BURY, TRACE and the
// messages for common mistakes. Each case is an instruction and the exact transcript.
import { cases } from './10-lang-lib.mjs';

const KIND = 'Check the kind of thing you gave it: a number, a word or a list.\n';
const SPELL = 'Check the spelling, or define it with TO ... END before you use it.\n';
const MISSING = 'Something is missing after the command. Count the inputs it needs.\n';
const NOOUT = 'The procedure ended without OUTPUT. Make sure every path through it outputs something.\n';
const INPROC = 'OUTPUT and STOP only make sense inside a procedure (between TO and END).\n';
const NOVAL = 'Use MAKE to give the variable a value first, or check the spelling after the colon.\n';
const UNUSED = 'A value was produced but nothing used it. Did you forget PRINT, or a command before it?\n';

/** A procedure typed at the prompt followed by an instruction that uses it, all in one go */
function proc(src, then, out) {
  const name = /^to\s+(\S+)/i.exec(src)[1];
  return [src + '\n' + then, src + '\n' + name + ' defined\n' + then + '\n' + out, 'full'];
}

export default function (t) {
  cases(t, 'templates', [
    ['print map [? * 2] [1 2 3]', '2 4 6\n'],
    ['print map "first [abc def]', 'a d\n'],
    ['print map [[x] :x * :x] [1 2 3]', '1 4 9\n'],
    ['show (map [list ?1 ?2] [a b] [1 2])', '[[a 1] [b 2]]\n'],
    ['print map [word ? #] [a b]', 'a1 b2\n'],
    ['print map.se [list ? ?] [a b]', 'a a b b\n'],
    ['print map "uppercase "abc', 'ABC\n'],
    ['print filter [? > 2] [1 2 3 4]', '3 4\n'],
    ['print filter "numberp [a 1 b 2]', '1 2\n'],
    ['show filter [memberp ? [a e]] [a b e]', '[a e]\n'],
    ['print filter "numberp "a1b2', '12\n'],
    ['print reduce "sum [1 2 3 4]', '10\n'],
    ['print reduce [?1 + ?2] [1 2 3]', '6\n'],
    ['print reduce "word [a b c]', 'abc\n'],
    ['print apply "sum [3 4]', '7\n'],
    ['print apply [[x y] :x - :y] [10 3]', '7\n'],
    ['apply [print ?] [5]', '5\n'],
    ['print (invoke "word "a "b "c)', 'abc\n'],
    ['print invoke [? + 1] 4', '5\n'],
    ['print find [? > 2] [1 2 3 4]', '3\n'],
    ['show find "numberp [a b]', '[]\n'],
    ['foreach [a b c] [type ?] print "', 'abc\n'],
    ['foreach [1 2] [print # * ?]', '1\n4\n'],
    ['(foreach [a b] [1 2] [print word ?1 ?2])', 'a1\nb2\n'],
    ['print crossmap [word ?1 ?2] [[a b] [1 2]]', 'a1 a2 b1 b2\n'],
    ['print cascade 3 [? * 2] 1', '8\n'],
    ['print (cascade 5 [lput # ?] [])', '1 2 3 4 5\n'],
    ['print map [? * 2] [1 2] [3]', '2 4\n[3]\n'],
    ['print map [?1 + ?2] [1 2] [10 20]', '? doesn\'t like 2 as input\n' + KIND],
    ['print map "nosuchthing [1]', 'I don\'t know how to nosuchthing\n' + SPELL],
  ]);

  cases(t, 'control', [
    ['repeat 3 [type repcount] print "', '123\n'],
    ['repeat 3 [print repcount]', '1\n2\n3\n'],
    ['repeat 0 [print 1]', ''],
    ['repeat 2 [repeat 2 [type "x]] print "', 'xxxx\n'],
    ['for [i 1 5] [type :i] print "', '12345\n'],
    ['for [i 3 1] [type :i] print "', '321\n'],
    ['for [i 10 0 -5] [print :i]', '10\n5\n0\n'],
    ['for [i 1 2 0.5] [print :i]', '1\n1.5\n2\n'],
    ['if 1 < 2 [print "yes]', 'yes\n'],
    ['if 1 > 2 [print "yes]', ''],
    ['ifelse 1 > 2 [print "yes] [print "no]', 'no\n'],
    ['print ifelse "true ["a] ["b]', 'a\n'],
    ['print ifelse 2 = 3 [1] [2]', '2\n'],
    ['test 3 = 3 iftrue [print "t] iffalse [print "f]', 't\n'],
    ['test 3 = 4 iftrue [print "t] iffalse [print "f]', 'f\n'],
    ['make "wn 0 while [:wn < 3] [make "wn :wn + 1] print :wn', '3\n'],
    ['make "un 0 until [:un > 3] [make "un :un + 1] print :un', '4\n'],
    ['make "dw 0 do.while [make "dw :dw + 1] [:dw < 3] print :dw', '3\n'],
    ['make "du 10 do.until [make "du :du + 1] [:du > 3] print :du', '11\n'],
    ['print case 2 [[[1] "one] [[2 3] "two] [else "other]]', 'two\n'],
    ['print case 9 [[[1] "one] [else "other]]', 'other\n'],
    ['print cond [[[1 > 2] "a] [else "b]]', 'b\n'],
    ['print cond [[[1 < 2] "a] [else "b]]', 'a\n'],
    ['run [print "hi]', 'hi\n'],
    ['print run [sum 1 2]', '3\n'],
    ['print runresult [sum 2 2]', '4\n'],
    ['show runresult [ignore 1]', '[]\n'],
    ['print run [1 + 1]', '2\n'],
    ['run "nosuchword', 'I don\'t know how to nosuchword\n' + SPELL],
    ['ignore 5', ''],
    ['print if "false [1]', 'if didn\'t output to print\n' + NOOUT],
    ['if "maybe [print 1]', 'if doesn\'t like maybe as input\n' + KIND],
    ['repeat "a [fd 1]', 'repeat doesn\'t like a as input\n' + KIND],
    ['repeat 2', 'Not enough inputs to repeat\n' + MISSING],
    ['print until', 'Not enough inputs to until\n' + MISSING],
    ['output 3', 'Can only use STOP or OUTPUT inside a procedure\n' + INPROC],
    ['stop', 'Can only use STOP or OUTPUT inside a procedure\n' + INPROC],
    ['goto "x', 'Can\'t use GOTO outside a procedure\n'],
    proc('to gt1\nmake "gi 0\ntag "top\nmake "gi :gi + 1\nif :gi < 3 [goto "top]\nprint :gi\nend', 'gt1', '3\n'),
    proc('to fact :n\nif :n < 2 [output 1]\noutput :n * fact :n - 1\nend', 'print fact 5', '120\n'),
    proc('to stp :n\nif :n > 2 [stop]\nprint :n\nstp :n + 1\nend', 'stp 1', '1\n2\n'),
    proc('to opt1 :a [:b 2]\noutput :a + :b\nend', 'print opt1 1 print (opt1 1 5)', '3\n6\n'),
    proc('to rest1 :a [:r]\noutput :r\nend', 'show (rest1 1 2 3)', '[2 3]\n'),
    proc('to loc1\nlocal "lv\nmake "lv 5\noutput :lv\nend', 'print loc1 print namep "lv', '5\nfalse\n'),
    proc('to dyn1\noutput :dynv\nend', 'make "dynv 7 print dyn1', '7\n'),
    proc('to noout\nprint "x\nend', 'print noout', 'x\nnoout didn\'t output to print\n' + NOOUT),
  ]);

  cases(t, 'variables', [
    ['make "x1 5 print :x1', '5\n'],
    ['make "x2 [a b] show :x2', '[a b]\n'],
    ['make "x3 "w print thing "x3', 'w\n'],
    ['name 3 "x4 print :x4', '3\n'],
    ['make "x5 1 make "x5 :x5 + 1 print :x5', '2\n'],
    ['print namep "x1', 'true\n'],
    ['print namep "nosuchname', 'false\n'],
    ['print :nosuchvar', 'nosuchvar has no value\n' + NOVAL],
    ['print thing "nosuchvar2', 'nosuchvar2 has no value\n' + NOVAL],
    [':nosuch3', 'nosuch3 has no value\n' + NOVAL],
    ['make "x6 3 ern "x6 print namep "x6', 'false\n'],
  ]);

  cases(t, 'property lists', [
    ['pprop "pl1 "a 1 print gprop "pl1 "a', '1\n'],
    ['pprop "pl2 "a 1 pprop "pl2 "b 2 show plist "pl2', '[a 1 b 2]\n'],
    ['pprop "pl3 "a 1 pprop "pl3 "b 2 remprop "pl3 "a show plist "pl3', '[b 2]\n'],
    ['show gprop "pl4 "x', '[]\n'],
    ['pprop "pl5 "a [x y] show gprop "pl5 "a', '[x y]\n'],
    ['pprop "pl6 "a 1 pprop "pl6 "a 2 show plist "pl6', '[a 2]\n'],
    ['show plist "pl7', '[]\n'],
    ['pprop "pl8 "k 1 print plistp "pl8', 'true\n'],
  ]);

  cases(t, 'stacks and queues', [
    ['make "st1 [] push "st1 1 push "st1 2 show :st1', '[2 1]\n'],
    ['make "st2 [] push "st2 1 push "st2 2 print pop "st2 show :st2', '2\n[1]\n'],
    ['make "qu1 [] queue "qu1 1 queue "qu1 2 show :qu1', '[1 2]\n'],
    ['make "qu2 [] queue "qu2 1 queue "qu2 2 print dequeue "qu2 show :qu2', '1\n[2]\n'],
    ['make "st3 [a] print pop "st3 show :st3', 'a\n[]\n'],
    ['make "st4 [] print pop "st4', 'pop doesn\'t like [] as input\n' + KIND],
  ]);

  cases(t, 'catch throw error', [
    ['print catch "x [(throw "x 7)]', '7\n'],
    ['print catch "true [(throw "zz 8)]', '8\n'],
    ['print catch "foo [throw "foo]', 'catch didn\'t output to print\n' + NOOUT],
    ['catch "foo [print 1 throw "foo print 2] print 3', '1\n3\n'],
    ['catch "error [print 1 / 0] print "ok', 'ok\n'],
    ['catch "error [foo] show error', '[13 I don\'t know how to foo [] 1]\n'],
    ['catch "error [foo] print first error', '13\n'],
    ['catch "error [foo] print item 2 error', 'I don\'t know how to foo\n'],
    ['catch "error [print :nv1] print first error', '11\n'],
    ['catch "error [(throw "error [my bad])] show error', '[35 my bad [] []]\n'],
    ['catch "error [throw "error] print item 2 error', 'Throw "Error\n'],
    ['catch "error [] show error', '[]\n'],
    ['throw "nobody', 'Can\'t find catch tag for nobody\n'],
    ['throw "error', 'Throw "Error\n'],
    ['(throw "error [oops here])', 'oops here\n'],
    ['throw "toplevel print "never', ''],
    ['print catch "a [catch "b [(throw "a 1)] 2]', '1\n'],
  ]);

  cases(t, 'define and text', [
    ['define "dbl2 [[x] [output :x * 2]]\nprint dbl2 5', '10\n'],
    ['define "dfa [[] [print "hi]]\ndfa', 'hi\n'],
    ['define "dfb [[a b] [output :a - :b]]\nshow text "dfb', '[[a b] [output :a - :b]]\n'],
    proc('to tx1 :x\noutput :x * :x\nend', 'show text "tx1', '[[x] [output :x * :x]]\n'),
    ['show text "nosuch', 'I don\'t know how to nosuch\n' + SPELL],
    ['copydef "add2 "sum\nprint add2 1 2', '3\n'],
    ['print procedurep "sum', 'true\n'],
    ['print primitivep "fd', 'true\n'],
    ['print primitivep "nosuch', 'false\n'],
    ['print definedp "fd', 'false\n'],
    ['define "dfc [[] [output 1]]\nprint definedp "dfc', 'true\n'],
    ['define "fd [[] []]', 'fd is a primitive\n'],
  ]);

  cases(t, 'workspace', [
    proc('to po1 :a\n  print :a\n  ; note\nend', 'po "po1', 'to po1 :a\n  print :a\n  ; note\nend\n'),
    proc('to po2\nend', 'po [po2]', 'to po2\nend\n'),
    ['make "pov "abc\npo [[] [pov]]', 'Make "pov "abc\n'],
    proc('to er1\nend', 'erase "er1 print procedurep "er1', 'false\n'),
    ['erase "nosuchproc', ''],
    ['po "nosuchproc', 'I don\'t know how to nosuchproc\n' + SPELL],
    ['erall\nto pa1\nend', 'erall\nto pa1\nend\npa1 defined\n', 'full'],
    ['erall\ndefine "pa2 [[a] []]\ndefine "pa3 [[] []]\npots', 'to pa2 :a\nto pa3\n'],
    ['erall\ndefine "pb1 [[] []]\ndefine "pb2 [[] []]\nbury "pb1\npots', 'to pb2\n'],
    ['erall\ndefine "pc1 [[] []]\nbury "pc1\nunbury "pc1\npots', 'to pc1\n'],
    ['erall\ndefine "pd1 [[] []]\nbury "pd1\nerall\nprint procedurep "pd1', 'true\n'],
    ['erall\nunbury "pd1\nerall\npots', ''],
    ['erall\nmake "pn1 1\nprint namep "pn1\nerns\nprint namep "pn1', 'true\nfalse\n'],
  ]);

  cases(t, 'trace', [
    proc('to trf :n\nif :n < 2 [output 1]\noutput :n * trf :n - 1\nend', 'trace "trf print trf 3 untrace "trf',
      '( trf 3 )\n ( trf 2 )\n  ( trf 1 )\n  trf outputs 1\n trf outputs 2\ntrf outputs 6\n6\n'),
    proc('to tpa :x\nif :x > 1 [stop]\nprint :x\nend', 'trace "tpa tpa 1 tpa 5 untrace "tpa',
      '( tpa 1 )\n1\ntpa stops\n( tpa 5 )\ntpa stops\n'),
    proc('to tpb :w\noutput word :w "!\nend', 'trace "tpb show tpb [a b] untrace "tpb',
      '( tpb [a b] )\nword doesn\'t like [a b] as input\n  in tpb\n' + KIND),
    proc('to tpc\noutput 1\nend', 'trace "tpc untrace "tpc print tpc', '1\n'),
  ]);

  cases(t, 'common mistakes', [
    ['fd', 'Not enough inputs to fd\n' + MISSING],
    ['foo', 'I don\'t know how to foo\n' + SPELL],
    ['forwrd 10', 'I don\'t know how to forwrd\n' + SPELL],
    ['fd "a', 'fd doesn\'t like a as input\n' + KIND],
    ['print', 'Not enough inputs to print\n' + MISSING],
    ['print (print 1)', '1\nprint didn\'t output to print\n' + NOOUT],
    ['print (sum 1 2', '\')\' not found\nEvery ( needs a matching ).\n'],
    ['print sum 1 2)', 'Unexpected \')\'\n'],
    [')', 'Unexpected \')\'\n'],
    [']', 'Unexpected \']\'\nThere is a ] without a matching [.\n'],
    ['print "true and "false', 'true\nNot enough inputs to and\n' + MISSING],
    ['print 7 % 3', '7\nI don\'t know how to %\n' + SPELL],
    ['print wait 0', 'wait didn\'t output to print\n' + NOOUT],
    ['print emptyp ignore 5', 'ignore didn\'t output to emptyp\n' + NOOUT],
    ['to fd', 'fd is a primitive\n'],
    proc('to bad1\nprint 1\nfoo\nend', 'bad1', '1\nI don\'t know how to foo\n  in bad1\n' + SPELL),
    proc('to bad2 :x\noutput :x + :y\nend', 'print bad2 1', 'y has no value\n  in bad2\n' + NOVAL),
    proc('to bad3 :x\noutput :x\nend', 'print bad3', 'Not enough inputs to bad3\n' + MISSING),
    proc('to bad4\n3\nend', 'bad4', 'You don\'t say what to do with 3\n  in bad4\n' + UNUSED),
  ]);
}
