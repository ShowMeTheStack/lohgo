(function (LG) {
  'use strict';
  LG.HELP_ENTRIES = (LG.HELP_ENTRIES || []).concat([
    // ---- Building words and lists ------------------------------------------------------------
    {
      n: 'word', a: [], g: 'Building words and lists',
      s: 'WORD word1 word2\n(WORD word1 word2 word3 ...)',
      d: '<p>Outputs a single word made by gluing its inputs together, with no spaces between them. Numbers count as words, so <code>word 1 2</code> outputs the word <code>12</code>.</p>' +
        '<p>Normally WORD takes two inputs. Put the whole call in parentheses to give it any other number, including none: <code>(word)</code> outputs the empty word.</p>' +
        '<p>Every input must be a word. Giving it a list or an array stops with an error such as <code>word doesn\'t like [b] as input</code>.</p>',
      e: 'print word "sun "flower\nprint (word "a "b "c 123)',
      see: ['sentence', 'list', 'combine']
    },
    {
      n: 'list', a: [], g: 'Building words and lists',
      s: 'LIST thing1 thing2\n(LIST thing1 thing2 thing3 ...)',
      d: '<p>Outputs a list whose members are its inputs, in order. Each input becomes exactly one member, so a list input stays a list inside the result: <code>list [a b] "c</code> outputs <code>[[a b] c]</code>.</p>' +
        '<p>Two inputs are the default. Use parentheses for any other number; <code>(list)</code> outputs the empty list <code>[]</code>. Inputs can be words, lists or arrays.</p>',
      e: 'show list "apple [banana cherry]\nshow (list 1 2 3 4)',
      see: ['sentence', 'fput', 'lput']
    },
    {
      n: 'sentence', a: ['se'], g: 'Building words and lists',
      s: 'SENTENCE thing1 thing2\n(SENTENCE thing1 thing2 thing3 ...)',
      d: '<p>Outputs a list made from its inputs. A word input becomes one member of the result. A list input has its members spliced in, one level deep only, so a list inside a list stays a list.</p>' +
        '<p>For example <code>sentence [a [b]] "c</code> outputs <code>[a [b] c]</code>. Compare LIST, which would give <code>[[a [b]] c]</code>.</p>' +
        '<p>Two inputs are the default; use parentheses for more or fewer. Arrays are not accepted and give an error such as <code>sentence doesn\'t like {a b} as input</code>.</p>',
      e: 'show sentence [the quick] [brown fox]\nshow (se "one [two three] [[four]])',
      see: ['list', 'word', 'fput']
    },
    {
      n: 'fput', a: [], g: 'Building words and lists',
      s: 'FPUT thing list',
      d: '<p>Outputs a new list with <code>thing</code> added at the front of <code>list</code>. The original list is not changed. This is the fastest way to grow a list, because nothing has to be copied.</p>' +
        '<p>If the second input is a word, the first input must be a single character, and FPUT outputs a word with that character in front: <code>fput "c "at</code> outputs <code>cat</code>. Anything else (for example a two-letter first input with a word, or an array as the second input) gives an error like <code>fput doesn\'t like cd as input</code>.</p>',
      e: 'show fput "red [green blue]\nshow fput "c "at',
      see: ['lput', 'combine', 'butfirst']
    },
    {
      n: 'lput', a: [], g: 'Building words and lists',
      s: 'LPUT thing list',
      d: '<p>Outputs a new list with <code>thing</code> added at the end of <code>list</code>. The original list is not changed. LPUT has to copy the whole list, so for very long lists FPUT is quicker.</p>' +
        '<p>If the second input is a word, the first must be a single character and LPUT outputs a word: <code>lput "s "cat</code> outputs <code>cats</code>. Other combinations give a <code>doesn\'t like</code> error.</p>',
      e: 'show lput "blue [red green]\nshow lput "s "cat',
      see: ['fput', 'butlast', 'last']
    },
    {
      n: 'combine', a: [], g: 'Building words and lists',
      s: 'COMBINE thing1 thing2',
      d: '<p>Joins two things in whichever way makes sense. If the second input is a list, COMBINE acts like FPUT and puts the first input at the front of it. Otherwise both inputs must be words and COMBINE acts like WORD.</p>' +
        '<p>So <code>combine "a [b c]</code> outputs <code>[a b c]</code> and <code>combine "a "b</code> outputs <code>ab</code>. A list as the first input with a word as the second is an error.</p>',
      e: 'show combine "a [b c]\nshow combine "snow "man',
      see: ['fput', 'word']
    },
    {
      n: 'reverse', a: [], g: 'Building words and lists',
      s: 'REVERSE thing',
      d: '<p>Outputs a list with the members of the input in the opposite order, or a word with its characters in the opposite order. Only the top level is reversed: lists inside the list keep their own order.</p>' +
        '<p>Arrays are not accepted and give a <code>doesn\'t like</code> error.</p>',
      e: 'show reverse [1 2 3 4]\nprint reverse "stressed',
      see: ['first', 'last']
    },
    {
      n: 'gensym', a: [], g: 'Building words and lists',
      s: 'GENSYM',
      d: '<p>Outputs a new word each time it is called: <code>g1</code>, then <code>g2</code>, then <code>g3</code>, and so on. It is handy when a program needs to invent names, for example for variables or property lists, that will not clash with each other.</p>' +
        '<p>The counter keeps going for as long as the page is open.</p>',
      e: 'print gensym\nprint gensym',
      see: ['word', 'make']
    },

    // ---- Taking things apart -----------------------------------------------------------------
    {
      n: 'first', a: [], g: 'Taking words and lists apart',
      s: 'FIRST thing',
      d: '<p>Outputs the first member of a list, or the first character of a word. <code>first [apple banana]</code> is <code>apple</code> and <code>first "hello</code> is <code>h</code>. A number is a word, so <code>first 123</code> is <code>1</code>.</p>' +
        '<p>Given an array, FIRST does something different: it outputs the array\'s origin, the index of its first slot (usually 1). Use ITEM to read what is stored in an array.</p>' +
        '<p>The empty list <code>[]</code> and the empty word have no first member, so they give an error like <code>first doesn\'t like [] as input</code>.</p>',
      e: 'print first [apple banana cherry]\nprint first "hello\nprint first (listtoarray [a b c] 0)',
      see: ['butfirst', 'last', 'item', 'firsts']
    },
    {
      n: 'firsts', a: [], g: 'Taking words and lists apart',
      s: 'FIRSTS list',
      d: '<p>Takes a list whose members are all lists or words, and outputs a list of the FIRST of each one. <code>firsts [[a b] [c d] ef]</code> outputs <code>[a c e]</code>.</p>' +
        '<p>The input must be a list, and none of its members may be empty; otherwise you get an error like <code>firsts doesn\'t like ... as input</code>.</p>',
      e: 'show firsts [[1 2 3] [4 5 6] [7 8 9]]',
      see: ['first', 'butfirsts']
    },
    {
      n: 'last', a: [], g: 'Taking words and lists apart',
      s: 'LAST thing',
      d: '<p>Outputs the last member of a list, or the last character of a word. <code>last [a b c]</code> is <code>c</code> and <code>last "hello</code> is <code>o</code>.</p>' +
        '<p>An empty list or empty word gives an error like <code>last doesn\'t like [] as input</code>. Arrays are not accepted.</p>',
      e: 'print last [apple banana cherry]\nprint last "hello',
      see: ['first', 'butlast']
    },
    {
      n: 'butfirst', a: ['bf'], g: 'Taking words and lists apart',
      s: 'BUTFIRST thing\nBF thing',
      d: '<p>Outputs everything except the first member of a list, or everything except the first character of a word. <code>bf [a b c]</code> is <code>[b c]</code> and <code>bf "hello</code> is <code>ello</code>. A one-member list gives <code>[]</code>; a one-character word gives the empty word.</p>' +
        '<p>FIRST and BUTFIRST together are the usual way to walk through a list one member at a time in a recursive procedure.</p>' +
        '<p>An empty list or word gives an error like <code>butfirst doesn\'t like [] as input</code>. Arrays are not accepted.</p>',
      e: 'show butfirst [apple banana cherry]\nprint bf "hello',
      see: ['first', 'butlast', 'butfirsts']
    },
    {
      n: 'butfirsts', a: ['bfs'], g: 'Taking words and lists apart',
      s: 'BUTFIRSTS list\nBFS list',
      d: '<p>Takes a list whose members are all lists or words, and outputs a list of the BUTFIRST of each one. <code>bfs [[a b] [c d] ef]</code> outputs <code>[[b] [d] f]</code>.</p>' +
        '<p>The input must be a list and none of its members may be empty, or you get a <code>doesn\'t like</code> error.</p>',
      e: 'show butfirsts [[1 2 3] [4 5 6] [7 8 9]]',
      see: ['butfirst', 'firsts']
    },
    {
      n: 'butlast', a: ['bl'], g: 'Taking words and lists apart',
      s: 'BUTLAST thing\nBL thing',
      d: '<p>Outputs everything except the last member of a list, or everything except the last character of a word. <code>bl [a b c]</code> is <code>[a b]</code> and <code>bl "hello</code> is <code>hell</code>.</p>' +
        '<p>An empty list or word gives an error like <code>butlast doesn\'t like [] as input</code>. Arrays are not accepted.</p>',
      e: 'show butlast [apple banana cherry]\nprint bl "hello',
      see: ['last', 'butfirst']
    },
    {
      n: 'item', a: [], g: 'Taking words and lists apart',
      s: 'ITEM index thing',
      d: '<p>Outputs one member of a list, one character of a word, or one slot of an array. For lists and words, counting starts at 1: <code>item 2 [a b c]</code> is <code>b</code> and <code>item 2 "hello</code> is <code>e</code>.</p>' +
        '<p>For an array, the index is counted from the array\'s origin, which is 1 unless you chose another one when you made the array. An array made with <code>(array 5 0)</code> has slots 0 to 4.</p>' +
        '<p>The index must be a whole number. If it is too small or too large you get an error like <code>item doesn\'t like 5 as input</code>.</p>',
      e: 'print item 3 [red orange yellow green]\nprint item 2 "hello\nprint item 0 (listtoarray [x y z] 0)',
      see: ['first', 'setitem', 'mditem', 'pick']
    },
    {
      n: 'mditem', a: [], g: 'Arrays',
      s: 'MDITEM indexlist thing',
      d: '<p>Reads one slot of a multi-dimensional array (an array of arrays, as made by MDARRAY). The first input is a list of indices, one per dimension. <code>mditem [2 3] :grid</code> is the same as <code>item 3 item 2 :grid</code>.</p>' +
        '<p>It also works through nested lists, since it simply applies ITEM once for each index. An index out of range gives a <code>doesn\'t like</code> error.</p>',
      e: 'make "grid mdarray [2 3]\nmdsetitem [2 3] :grid "X\nshow :grid\nprint mditem [2 3] :grid',
      see: ['mdarray', 'mdsetitem', 'item']
    },
    {
      n: 'pick', a: [], g: 'Taking words and lists apart',
      s: 'PICK thing',
      d: '<p>Outputs a randomly chosen member of a list, or a randomly chosen character of a word. Each member has the same chance of being picked.</p>' +
        '<p>An empty list or empty word gives an error. Arrays are not accepted. RERANDOM makes the choices repeatable.</p>',
      e: 'repeat 5 [print pick [rock paper scissors]]',
      see: ['random', 'item', 'rerandom']
    },
    {
      n: 'remove', a: [], g: 'Taking words and lists apart',
      s: 'REMOVE thing list',
      d: '<p>Outputs a copy of the second input with every member equal to <code>thing</code> taken out. Equality is tested the same way as EQUALP, so numbers like <code>3</code> and <code>3.0</code> match and, while CASEIGNOREDP is true (the default), upper and lower case letters match.</p>' +
        '<p>If the second input is a word, REMOVE takes out every matching character: <code>remove "l "hello</code> is <code>heo</code>. Arrays are not accepted.</p>',
      e: 'show remove "b [a b c b d]\nprint remove "l "hello',
      see: ['remdup', 'memberp', 'equalp']
    },
    {
      n: 'remdup', a: [], g: 'Taking words and lists apart',
      s: 'REMDUP list',
      d: '<p>Outputs a copy of a list (or word) with duplicates removed. When something appears more than once, the copy that is kept is the <b>last</b> one, so the order of the result follows the final appearances: <code>remdup [a b a c b]</code> is <code>[a c b]</code>, and <code>remdup "banana</code> is <code>bna</code>.</p>' +
        '<p>Members are compared as EQUALP compares them, so while CASEIGNOREDP is true <code>A</code> and <code>a</code> count as the same. Arrays are not accepted.</p>',
      e: 'show remdup [a b a c b]\nprint remdup "banana',
      see: ['remove', 'equalp']
    },
    {
      n: 'quoted', a: [], g: 'Taking words and lists apart',
      s: 'QUOTED thing',
      d: '<p>If the input is a word, outputs that word with a quotation mark in front, so <code>quoted "abc</code> is <code>"abc</code>. Any other input (a list or an array) is output unchanged.</p>' +
        '<p>This is useful when building instruction lists to RUN, where a word needs its quote so Logo treats it as data and not as a procedure name.</p>',
      e: 'print quoted "hello\nrun (list "print quoted "hello)',
      see: ['run', 'word']
    },

    // ---- Arrays ------------------------------------------------------------------------------
    {
      n: 'array', a: [], g: 'Arrays',
      s: 'ARRAY size\n(ARRAY size origin)',
      d: '<p>Outputs a new array with <code>size</code> slots, each holding the empty list <code>[]</code>. An array is like a list, but you can change any slot in place with SETITEM and reach any slot quickly with ITEM.</p>' +
        '<p>Slots are numbered from 1 unless you give an <code>origin</code>: <code>(array 5 0)</code> has slots 0 to 4. Arrays print in braces, and an origin other than 1 is shown after an @ sign, as in <code>{[] [] []}@0</code>. You can also type an array directly, like <code>{a b c}</code>.</p>' +
        '<p>The size must be a whole number, zero or more. Anything else is a <code>doesn\'t like</code> error.</p>',
      e: 'make "a array 3\nsetitem 2 :a "hello\nshow :a\nshow (array 4 0)',
      see: ['setitem', 'item', 'mdarray', 'listtoarray', 'arrayp']
    },
    {
      n: 'mdarray', a: [], g: 'Arrays',
      s: 'MDARRAY sizelist\n(MDARRAY sizelist origin)',
      d: '<p>Outputs a new multi-dimensional array: an array of arrays. The input is a list of sizes, one per dimension, so <code>mdarray [2 3]</code> is an array of 2 slots, each holding an array of 3 slots. Every innermost slot starts as <code>[]</code>.</p>' +
        '<p>The optional origin applies to every dimension. Use MDITEM and MDSETITEM to read and change slots. An empty size list or a negative size is an error.</p>',
      e: 'make "board mdarray [3 3]\nmdsetitem [2 2] :board "X\nshow :board',
      see: ['mditem', 'mdsetitem', 'array']
    },
    {
      n: 'listtoarray', a: [], g: 'Arrays',
      s: 'LISTTOARRAY list\n(LISTTOARRAY list origin)',
      d: '<p>Outputs a new array holding the members of the list, in order. The origin is 1 unless you give another one.</p>' +
        '<p>The input must be a list; a word or an array gives a <code>doesn\'t like</code> error.</p>',
      e: 'show listtoarray [red green blue]\nshow (listtoarray [red green blue] 0)',
      see: ['arraytolist', 'array']
    },
    {
      n: 'arraytolist', a: [], g: 'Arrays',
      s: 'ARRAYTOLIST array',
      d: '<p>Outputs a new list holding the contents of an array, in order. Changing the array later does not change the list. The array\'s origin is not kept.</p>' +
        '<p>The input must be an array.</p>',
      e: 'show arraytolist {red green blue}',
      see: ['listtoarray']
    },
    {
      n: 'setitem', a: [], g: 'Arrays',
      s: 'SETITEM index array value',
      d: '<p>Changes one slot of an array so that it holds <code>value</code>. The array is changed in place: every variable that refers to it sees the change. SETITEM outputs nothing.</p>' +
        '<p>The index is counted from the array\'s origin and must be in range. The first input must be an array; lists cannot be changed this way.</p>' +
        '<p>To protect you from building an array that contains itself (which would print forever), SETITEM refuses a value that contains the array, giving a <code>doesn\'t like</code> error. .SETITEM skips that check.</p>',
      e: 'make "scores array 3\nsetitem 1 :scores 10\nsetitem 3 :scores 25\nshow :scores',
      see: ['item', 'array', 'mdsetitem', '.setitem']
    },
    {
      n: 'mdsetitem', a: [], g: 'Arrays',
      s: 'MDSETITEM indexlist array value',
      d: '<p>Changes one slot of a multi-dimensional array. The first input is a list of indices, one per dimension. <code>mdsetitem [2 3] :grid "X</code> puts <code>X</code> in row 2, column 3.</p>' +
        '<p>Indices out of range, or a value that contains the array itself, give a <code>doesn\'t like</code> error.</p>',
      e: 'make "grid mdarray [2 3]\nmdsetitem [1 2] :grid "X\nshow :grid',
      see: ['mditem', 'mdarray', 'setitem']
    },
    {
      n: '.setitem', a: [], g: 'Arrays',
      s: '.SETITEM index array value',
      d: '<p>Does the same as SETITEM but without checking whether the value contains the array. It is a little faster, and it lets you build circular structures on purpose, which can then print or compare forever. Use SETITEM unless you know you need this.</p>',
      e: 'make "a array 2\n.setitem 1 :a "hi\nshow :a',
      see: ['setitem']
    },
    {
      n: '.setfirst', a: [], g: 'Changing lists in place',
      s: '.SETFIRST list value',
      d: '<p>Changes the first member of an existing list in place, without making a copy. Every variable that shares that list sees the change. Outputs nothing.</p>' +
        '<p>This is an advanced tool. Changing a list that appears in a procedure\'s text changes the procedure too. The first input must be a non-empty list.</p>',
      e: 'make "pets [cat dog fish]\n.setfirst :pets "hamster\nshow :pets',
      see: ['.setbf', 'fput', 'setitem']
    },
    {
      n: '.setbf', a: [], g: 'Changing lists in place',
      s: '.SETBF list value',
      d: '<p>Replaces everything after the first member of an existing list, in place: afterwards BUTFIRST of the list is <code>value</code>. Outputs nothing.</p>' +
        '<p>The first input must be a non-empty list and the second must be a list. As with .SETFIRST, other variables sharing the list see the change, and it is possible to make a list that loops back on itself.</p>',
      e: 'make "l [a b c]\n.setbf :l [x y]\nshow :l',
      see: ['.setfirst', 'butfirst']
    },

    // ---- Stacks and queues -------------------------------------------------------------------
    {
      n: 'push', a: [], g: 'Stacks and queues',
      s: 'PUSH stackname thing',
      d: '<p>Treats the variable named by the first input as a stack and puts <code>thing</code> on top of it (at the front of the list). Note that the first input is the variable\'s <b>name</b>, so it takes a quote: <code>push "stack 5</code>.</p>' +
        '<p>If the variable has no value yet, PUSH starts it as an empty list. If it holds something that is not a list, you get a <code>doesn\'t like</code> error.</p>',
      e: 'make "stack []\npush "stack 1\npush "stack 2\npush "stack 3\nshow :stack',
      see: ['pop', 'queue', 'fput']
    },
    {
      n: 'pop', a: [], g: 'Stacks and queues',
      s: 'POP stackname',
      d: '<p>Removes the top member of a stack (the front of the list held in the named variable) and outputs it. The variable is changed. Pushing and then popping gives things back in the reverse order: last in, first out.</p>' +
        '<p>Popping an empty stack gives <code>pop doesn\'t like [] as input</code>. A variable with no value gives a <code>has no value</code> error.</p>',
      e: 'make "stack [c b a]\nprint pop "stack\nshow :stack',
      see: ['push', 'dequeue']
    },
    {
      n: 'queue', a: [], g: 'Stacks and queues',
      s: 'QUEUE queuename thing',
      d: '<p>Treats the variable named by the first input as a queue and adds <code>thing</code> at the back (the end of the list). Like PUSH, the first input is a name and takes a quote.</p>' +
        '<p>If the variable has no value yet, QUEUE starts it as an empty list.</p>',
      e: 'make "line []\nqueue "line "amy\nqueue "line "ben\nshow :line',
      see: ['dequeue', 'push', 'lput']
    },
    {
      n: 'dequeue', a: [], g: 'Stacks and queues',
      s: 'DEQUEUE queuename',
      d: '<p>Removes the member at the front of a queue and outputs it. Together with QUEUE this gives first in, first out: things come out in the order they went in.</p>' +
        '<p>An empty queue gives <code>dequeue doesn\'t like [] as input</code>.</p>',
      e: 'make "line [amy ben cara]\nprint dequeue "line\nshow :line',
      see: ['queue', 'pop']
    },

    // ---- Predicates --------------------------------------------------------------------------
    {
      n: 'wordp', a: ['word?'], g: 'Predicates',
      s: 'WORDP thing\nWORD? thing',
      d: '<p>Outputs <code>true</code> if the input is a word and <code>false</code> otherwise. Numbers are words, so <code>wordp 3</code> is <code>true</code>.</p>',
      e: 'print wordp "hello\nprint wordp 42\nprint wordp [hello]',
      see: ['listp', 'arrayp', 'numberp']
    },
    {
      n: 'listp', a: ['list?'], g: 'Predicates',
      s: 'LISTP thing\nLIST? thing',
      d: '<p>Outputs <code>true</code> if the input is a list (including the empty list) and <code>false</code> otherwise. Arrays are not lists.</p>',
      e: 'print listp [a b]\nprint listp []\nprint listp "a',
      see: ['wordp', 'arrayp']
    },
    {
      n: 'arrayp', a: ['array?'], g: 'Predicates',
      s: 'ARRAYP thing\nARRAY? thing',
      d: '<p>Outputs <code>true</code> if the input is an array and <code>false</code> otherwise.</p>',
      e: 'print arrayp {a b}\nprint arrayp [a b]',
      see: ['array', 'listp', 'wordp']
    },
    {
      n: 'emptyp', a: ['empty?'], g: 'Predicates',
      s: 'EMPTYP thing\nEMPTY? thing',
      d: '<p>Outputs <code>true</code> if the input is the empty list <code>[]</code> or the empty word, and <code>false</code> for anything else.</p>' +
        '<p>An array is never counted as empty, even one with no slots; use <code>count</code> to check an array\'s size.</p>',
      e: 'print emptyp []\nprint emptyp "||\nprint emptyp [a]',
      see: ['count', 'butfirst']
    },
    {
      n: 'equalp', a: ['equal?'], g: 'Predicates',
      s: 'EQUALP thing1 thing2\nEQUAL? thing1 thing2',
      d: '<p>Outputs <code>true</code> if the two inputs are equal and <code>false</code> otherwise. The infix form is <code>thing1 = thing2</code>.</p>' +
        '<ul><li>Two numbers are equal if they have the same value, so <code>3</code> equals <code>3.0</code>.</li>' +
        '<li>Two words are compared letter by letter. While the variable CASEIGNOREDP is <code>true</code> (the default), upper and lower case count as the same.</li>' +
        '<li>Two lists are equal if they have the same length and their members are equal, one by one.</li>' +
        '<li>An array is only equal to itself, never to a different array with the same contents.</li></ul>',
      e: 'print equalp [a b c] [a b c]\nprint equalp 3 3.0\nprint equalp "Hello "hello\nprint "cat = "dog',
      see: ['notequalp', '.eq', 'memberp', 'beforep']
    },
    {
      n: 'notequalp', a: ['notequal?'], g: 'Predicates',
      s: 'NOTEQUALP thing1 thing2\nNOTEQUAL? thing1 thing2',
      d: '<p>Outputs <code>true</code> if the two inputs are not equal, and <code>false</code> if they are. It always gives the opposite answer to EQUALP, using the same rules. The infix form is <code>thing1 &lt;&gt; thing2</code>.</p>',
      e: 'print notequalp "cat "dog\nprint 3 <> 3.0',
      see: ['equalp']
    },
    {
      n: 'beforep', a: ['before?'], g: 'Predicates',
      s: 'BEFOREP word1 word2\nBEFORE? word1 word2',
      d: '<p>Outputs <code>true</code> if <code>word1</code> comes before <code>word2</code> in character-code order (dictionary order for plain letters), and <code>false</code> otherwise, including when they are equal.</p>' +
        '<p>While CASEIGNOREDP is <code>true</code> (the default) both words are compared in lower case. Numbers are compared as text, not by value, so <code>beforep 10 9</code> is <code>true</code>. Both inputs must be words.</p>',
      e: 'print beforep "apple "banana\nprint beforep "zebra "Apple',
      see: ['equalp', 'lessp']
    },
    {
      n: '.eq', a: [], g: 'Predicates',
      s: '.EQ thing1 thing2',
      d: '<p>Outputs <code>true</code> if the two inputs are the very same object, not just equal-looking. Two separately typed lists <code>[a]</code> and <code>[a]</code> are EQUALP but not .EQ; a variable\'s value is .EQ to itself.</p>' +
        '<p>Words with the same spelling are always .EQ. This is mainly useful when working with lists you change in place with .SETFIRST or .SETBF.</p>',
      e: 'make "x [a b]\nprint .eq :x :x\nprint .eq [a b] [a b]',
      see: ['equalp', '.setfirst']
    },
    {
      n: 'memberp', a: ['member?'], g: 'Predicates',
      s: 'MEMBERP thing collection\nMEMBER? thing collection',
      d: '<p>Outputs <code>true</code> if <code>thing</code> is equal (as EQUALP sees it) to one of the members of <code>collection</code>, and <code>false</code> otherwise. The collection can be a list or an array.</p>' +
        '<p>If the collection is a word, MEMBERP checks whether <code>thing</code> is one of its characters, so the first input must be a single character to give <code>true</code>: <code>memberp "e "hello</code> is <code>true</code> but <code>memberp "el "hello</code> is <code>false</code>. Use SUBSTRINGP for longer pieces.</p>',
      e: 'print memberp "pear [apple pear plum]\nprint memberp "e "hello',
      see: ['member', 'substringp', 'equalp']
    },
    {
      n: 'substringp', a: ['substring?'], g: 'Predicates',
      s: 'SUBSTRINGP word1 word2\nSUBSTRING? word1 word2',
      d: '<p>Outputs <code>true</code> if <code>word1</code> appears somewhere inside <code>word2</code>, as a run of characters next to each other. <code>substringp "ell "hello</code> is <code>true</code>. Case is ignored while CASEIGNOREDP is <code>true</code>.</p>' +
        '<p>If either input is not a word (a list, for example) the answer is simply <code>false</code>, not an error.</p>',
      e: 'print substringp "ell "hello\nprint substringp "cat "concatenate',
      see: ['memberp']
    },
    {
      n: 'numberp', a: ['number?'], g: 'Predicates',
      s: 'NUMBERP thing\nNUMBER? thing',
      d: '<p>Outputs <code>true</code> if the input is a number, or a word that reads as one, such as <code>"42</code>, <code>"-3.5</code>, <code>".5</code> or <code>"1e3</code>. Outputs <code>false</code> for other words, lists and arrays.</p>',
      e: 'print numberp 42\nprint numberp "1e3\nprint numberp "forty',
      see: ['wordp']
    },
    {
      n: 'vbarredp', a: ['vbarred?', 'backslashedp', 'backslashed?'], g: 'Predicates',
      s: 'VBARREDP char\nVBARRED? char',
      d: '<p>In Berkeley Logo this tells whether a character was typed inside vertical bars or after a backslash. Lohgo does not keep that information, so VBARREDP always outputs <code>false</code>. It is here so that programs written for Berkeley Logo still run.</p>' +
        '<p>The input must be a word.</p>',
      e: 'print vbarredp "a',
      see: ['ascii']
    },

    // ---- Characters and text -----------------------------------------------------------------
    {
      n: 'count', a: [], g: 'Characters and text',
      s: 'COUNT thing',
      d: '<p>Outputs how many members a list has, how many characters a word has, or how many slots an array has. Only the top level of a list is counted: <code>count [a [b c]]</code> is 2.</p>' +
        '<p>A number counts as a word, so <code>count 12345</code> is 5.</p>',
      e: 'print count [apple banana cherry]\nprint count "elephant\nprint count {1 2 3 4}',
      see: ['emptyp', 'item']
    },
    {
      n: 'ascii', a: ['rawascii'], g: 'Characters and text',
      s: 'ASCII char',
      d: '<p>Outputs the character code of a one-character word: <code>ascii "A</code> is 65 and <code>ascii "a</code> is 97. Characters beyond plain ASCII give their Unicode number.</p>' +
        '<p>The input must be exactly one character; anything else gives an error such as <code>ascii doesn\'t like ab as input</code>. RAWASCII is the same.</p>',
      e: 'print ascii "A\nprint ascii "z',
      see: ['char']
    },
    {
      n: 'char', a: [], g: 'Characters and text',
      s: 'CHAR code',
      d: '<p>Outputs the one-character word whose character code is the input. <code>char 65</code> is <code>A</code>. It is the reverse of ASCII.</p>' +
        '<p>The input must be a whole number from 0 to 1114111 (the largest Unicode code).</p>',
      e: 'print char 72\nprint (word char 72 char 105)',
      see: ['ascii']
    },
    {
      n: 'member', a: [], g: 'Characters and text',
      s: 'MEMBER thing collection',
      d: '<p>Like MEMBERP, but instead of <code>true</code> it outputs the part of the collection starting with the first match. <code>member "c [a b c d]</code> is <code>[c d]</code> and <code>member "c "abcde</code> is <code>cde</code>.</p>' +
        '<p>If there is no match it outputs an empty list (or the empty word, when the collection is a word). Arrays are not accepted.</p>',
      e: 'show member "c [a b c d e]\nprint member "l "hello',
      see: ['memberp']
    },
    {
      n: 'lowercase', a: [], g: 'Characters and text',
      s: 'LOWERCASE word',
      d: '<p>Outputs a copy of the word with every capital letter changed to small. The input must be a word.</p>',
      e: 'print lowercase "HeLLo',
      see: ['uppercase']
    },
    {
      n: 'uppercase', a: [], g: 'Characters and text',
      s: 'UPPERCASE word',
      d: '<p>Outputs a copy of the word with every small letter changed to a capital. The input must be a word; a list gives a <code>doesn\'t like</code> error.</p>',
      e: 'print uppercase "hello',
      see: ['lowercase']
    },
    {
      n: 'standout', a: [], g: 'Characters and text',
      s: 'STANDOUT word',
      d: '<p>In Berkeley Logo this wraps a word in terminal codes so it prints in bold or inverse. Lohgo\'s text area does not use those codes, so STANDOUT outputs the word unchanged. The input must be a word.</p>',
      e: 'print standout "hello',
      see: ['print']
    },
    {
      n: 'parse', a: [], g: 'Characters and text',
      s: 'PARSE word',
      d: '<p>Reads the word the way Logo reads a line you type and outputs the result as a list. Spaces separate members, and brackets make sublists: <code>parse "|print [a b]|</code> outputs <code>[print [a b]]</code>.</p>' +
        '<p>This is how a program can turn text, for example something read with READWORD, into a list it can RUN. The input must be a word.</p>',
      e: 'show parse "|forward 50 right 90|',
      see: ['runparse', 'run', 'readword']
    },
    {
      n: 'runparse', a: [], g: 'Characters and text',
      s: 'RUNPARSE thing',
      d: '<p>Outputs a list in the form Logo uses just before running it, with infix operators split into their own members. <code>runparse [print 3+4]</code> outputs <code>[print 3 + 4]</code>.</p>' +
        '<p>The input may be a list or a word; a word is first read as with PARSE.</p>',
      e: 'show runparse [print 3+4*2]',
      see: ['parse', 'run']
    },

    // ---- Property lists ----------------------------------------------------------------------
    {
      n: 'pprop', a: [], g: 'Property lists',
      s: 'PPROP plistname propname value',
      d: '<p>Stores <code>value</code> under the property <code>propname</code> in the property list called <code>plistname</code>. A property list is a named set of labelled values, a little like a record card: <code>pprop "fido "breed "beagle</code>.</p>' +
        '<p>If the property already exists, its value is replaced. Both names must be words, and upper and lower case in names are treated as the same. Property lists live separately from variables, so a property list and a variable may share a name.</p>',
      e: 'pprop "fido "breed "beagle\npprop "fido "age 3\nshow plist "fido',
      see: ['gprop', 'remprop', 'plist']
    },
    {
      n: 'gprop', a: [], g: 'Property lists',
      s: 'GPROP plistname propname',
      d: '<p>Outputs the value stored under <code>propname</code> in the property list <code>plistname</code>. If there is no such property (or no such property list) it outputs the empty list <code>[]</code>, not an error.</p>',
      e: 'pprop "fido "breed "beagle\nprint gprop "fido "breed',
      see: ['pprop', 'plist']
    },
    {
      n: 'remprop', a: [], g: 'Property lists',
      s: 'REMPROP plistname propname',
      d: '<p>Removes the property <code>propname</code> from the property list <code>plistname</code>. If it was the last property, the property list disappears. Removing something that is not there does nothing.</p>',
      e: 'pprop "fido "age 3\npprop "fido "breed "beagle\nremprop "fido "age\nshow plist "fido',
      see: ['pprop', 'gprop']
    },
    {
      n: 'plist', a: [], g: 'Property lists',
      s: 'PLIST plistname',
      d: '<p>Outputs a whole property list as a flat list of names and values, one after the other, in the order the properties were first stored: <code>[breed beagle age 3]</code>. A property list that does not exist gives <code>[]</code>.</p>',
      e: 'pprop "fido "breed "beagle\npprop "fido "age 3\nshow plist "fido',
      see: ['pprop', 'gprop', 'remprop']
    }
  ]);
})(LG);
