// Language reference: topic pages (ideas rather than single primitives).
(function (LG) {
  'use strict';
  LG.HELP_ENTRIES = (LG.HELP_ENTRIES || []).concat([

    { n: 'Getting started', g: 'Topics', topic: true,
      d: `<p>Lohgo has three parts that work together.</p><ul><li><b>The turtle world</b> is the drawing area. The turtle starts in the middle, facing up. When you tell it to move with its pen down, it leaves a line behind.</li><li><b>The command center</b> is where you type one instruction at a time and press Enter. It runs straight away, and anything printed appears there. Use the up arrow to bring back an earlier line.</li><li><b>The editor</b> holds a whole program: procedures you define with <code>TO</code> ... <code>END</code>, and instructions that use them. Press <b>Run</b> (or F5) to run it. Running from the editor starts fresh: the drawing is cleared and old procedures and variables are forgotten. Save with Ctrl+S; programs are kept on the browser's virtual disk under <code>/projects</code>.</li></ul><p>A first try: type <code>forward 100</code>, then <code>right 90</code>, then <code>forward 100</code>. Then try the instruction below, which does the same thing four times.</p><p>The speed slider sets how fast the turtle walks. <b>Stop</b> (Shift+F5) ends a program that runs too long. Press F1 on any word in the editor to see its help page.</p>`,
      e: `repeat 4 [forward 100 right 90]`, see: ['forward', 'right', 'repeat', 'to'] },

    { n: 'Words, numbers and lists', g: 'Topics', topic: true,
      d: `<p>Logo has a few kinds of things, and how you write each one tells Logo what you mean.</p><ul><li><b>Words.</b> A quote mark in front means "this word itself": <code>print "hello</code> prints <code>hello</code>. There is no closing quote. Without the quote, Logo would try to run a procedure called <code>hello</code>. To put a space inside a word, use vertical bars: <code>"|two words|</code>.</li><li><b>Numbers</b> are words too, but need no quote: <code>print 3 + 4</code>.</li><li><b>Values of variables.</b> A colon in front means "the value of": <code>:size</code> is the thing stored under the name <code>size</code>.</li><li><b>Lists</b> are written in square brackets: <code>[red green blue]</code>. Nothing inside a list is run or looked up, so you do not quote the words in it, and <code>[:x]</code> is a list holding the word <code>:x</code>, not its value. Lists can hold other lists: <code>[1 [2 3] 4]</code>. Lists of instructions, like the second input to <code>REPEAT</code>, are run only when the command chooses to.</li><li><b>Arrays</b> are written in braces: <code>{10 20 30}</code>. Like lists they hold several things, but you can change an item in place with <code>SETITEM</code>. They count from 1 unless you add <code>@0</code> after them: <code>{a b}@0</code>.</li></ul><p>To build a list from values, use <code>LIST</code> or <code>SENTENCE</code>: <code>(list :x :y)</code>.</p>`,
      e: `make "x 5 print "hello print :x show [x :x] show list "x :x show item 2 {a b c}`, see: ['print', 'show', 'list', 'sentence', 'make', 'array'] },

    { n: 'Procedures and inputs', g: 'Topics', topic: true,
      d: `<p>You teach Logo a new word with <code>TO</code>. The first line names the procedure and its inputs, then come the instructions, then <code>END</code>:</p><pre>to square :size
  repeat 4 [forward :size right 90]
end</pre><p>Now <code>square 50</code> and <code>square 120</code> both work. Inside, <code>:size</code> is whatever number was given.</p><p><b>Commands and operations.</b> A procedure like <code>SQUARE</code> that does something is a <i>command</i>. A procedure can instead hand back a value with <code>OUTPUT</code>; then it is an <i>operation</i>, and its value must be used by something, such as <code>PRINT</code>. <code>OUTPUT</code> also ends the procedure at once. <code>STOP</code> ends a command early without a value.</p><p><b>Optional inputs.</b> An input written in brackets with a value, like <code>[:sides 4]</code>, is optional: if it is left out it gets that value. To give it, put the whole call in parentheses: <code>(polygon 50 6)</code>.</p><p><b>Rest inputs.</b> An input written alone in brackets, like <code>[:others]</code>, collects any extra inputs into a list, so <code>(total 1 2 3 4)</code> works.</p><p>Common mistakes: forgetting <code>END</code>, putting a space between the colon and the name, and using a value from an operation without doing anything with it (<i>You don't say what to do with ...</i>).</p>`,
      e: `to polygon :size [:sides 4]
  repeat :sides [forward :size right 360 / :sides]
end
to total [:numbers]
  output reduce "sum fput 0 :numbers
end
polygon 80
(polygon 60 6)
print (total 1 2 3 4)`, see: ['to', 'output', 'stop', 'end'] },

    { n: 'Variables and scope', g: 'Topics', topic: true,
      d: `<p>A variable is a name with a value. <code>make "score 10</code> stores 10 under <code>score</code>; <code>:score</code> gets it back. Notice the quote in <code>MAKE</code> (you are naming the variable) and the colon when you use it (you want its value).</p><p><b>Global variables</b> are made by <code>MAKE</code> outside any procedure, or inside one when the name is not local. They last until the program is run again.</p><p><b>Local variables.</b> A procedure's inputs are local to it. So are names listed with <code>LOCAL</code>, or made with <code>LOCALMAKE</code>. When the procedure ends they disappear, and any global variable with the same name comes back untouched.</p><p><b>Dynamic scope.</b> In Logo a procedure can see the local variables of the procedure that called it, and of that one's caller, and so on. In the example, <code>INNER</code> has no variable called <code>x</code>, but it can use the one belonging to <code>OUTER</code>, because <code>OUTER</code> is still running. Most other languages do not work this way. It is convenient, but it also means a helper procedure can change its caller's variables by accident; use <code>LOCAL</code> in procedures that use <code>MAKE</code> for scratch values.</p>`,
      e: `to outer
  local "x
  make "x 5
  inner
end
to inner
  print :x
end
outer
print namep "x`, see: ['make', 'local', 'localmake', 'thing', 'namep'] },

    { n: 'Recursion', g: 'Topics', topic: true,
      d: `<p>A procedure may use itself. That is called recursion, and it is one of the most natural ways to work in Logo. Every recursive procedure needs two things:</p><ul><li>a <b>stop rule</b> that ends the chain, usually an <code>IF</code> near the top: <code>if :size &lt; 5 [stop]</code>;</li><li>a <b>smaller step</b>: each call works on a smaller size, a shorter list or a lower level, so the stop rule is reached eventually.</li></ul><p>Without a stop rule the procedure calls itself forever and you get <i>Stack overflow</i> (or, if the call is the very last thing it does, a program that never ends; press Stop).</p><p>The tree below is the classic example: each branch is a trunk with two smaller trees on top. Put a breakpoint inside it and open the Call Stack to watch the copies of <code>TREE</code> waiting inside one another.</p>`,
      e: `to tree :size
  if :size < 8 [stop]
  forward :size
  left 25 tree :size * 0.7
  right 50 tree :size * 0.7
  left 25 back :size
end
penup back 150 pendown
tree 100`, see: ['stop', 'output', 'if'] },

    { n: 'Templates', g: 'Topics', topic: true,
      d: `<p>Commands like <code>MAP</code>, <code>FILTER</code>, <code>FOREACH</code>, <code>REDUCE</code> and <code>APPLY</code> take a <i>template</i>: a list of instructions with holes in it, filled in each time with a different value.</p><ul><li><b>Question-mark slots.</b> <code>?</code> stands for the value: <code>map [? * 10] [1 2 3]</code> gives <code>[10 20 30]</code>. When there are several inputs, <code>?1</code> is the first, <code>?2</code> the second, and so on.</li><li><b>Named slots.</b> Start the template with a list of names, and use them as variables: <code>map [[n] :n * 10] [1 2 3]</code>. This is clearer when the template is long, and it works inside other templates without the <code>?</code>s getting mixed up.</li><li><b>A procedure name.</b> A word names a procedure to use: <code>map "first [apple banana]</code> gives <code>[a b]</code>.</li></ul><p>To give a template command more lists than usual, put the call in parentheses: <code>(map [?1 + ?2] [1 2] [10 20])</code>.</p>`,
      e: `show map [? * 10] [1 2 3]
show filter [? > 2] [1 5 2 7]
show (map [[x y] :x * :y] [1 2] [3 4])
foreach [red green blue] [print ?]`, see: ['map', 'filter', 'foreach', 'reduce', 'apply'] },

    { n: 'Infix and precedence', g: 'Topics', topic: true,
      d: `<p>Logo understands arithmetic written the usual way, with <code>+ - * /</code> between numbers, and comparisons <code>= &lt; &gt; &lt;= &gt;= &lt;&gt;</code>. The rules for what goes with what can surprise you.</p><p><b>Times and divide before plus and minus</b>, as in school: <code>2 + 3 * 4</code> is 14.</p><p><b>Infix before inputs.</b> Logo finishes the arithmetic to the right of a procedure name before handing the result over as an input. So <code>sum 3 4 * 2</code> is <code>sum 3 (4 * 2)</code>, which is 11, not 14. Use parentheses when you mean something else: <code>(sum 3 4) * 2</code>.</p><p><b>The IF gotcha.</b> <code>if :x = 1 [...]</code> works as you expect. But <code>if first :list = 1 [...]</code> does not: it means <code>first (:list = 1)</code>, which is the first letter of <code>true</code> or <code>false</code>, and you get <i>if doesn't like f as input</i>. Write <code>if (first :list) = 1 [...]</code> or <code>if equalp first :list 1 [...]</code>.</p><p><b>Minus signs and spaces.</b> Spaces around <code>-</code> matter:</p><table><tr><td><code>3 - 1</code></td><td>subtraction, 2</td></tr><tr><td><code>3-1</code></td><td>also subtraction, 2</td></tr><tr><td><code>:x -1</code></td><td>two separate things: <code>:x</code> and the number -1</td></tr><tr><td><code>-:x</code></td><td>minus the value of x</td></tr></table><p>So <code>print :x -1</code> prints <code>:x</code> and then complains <i>You don't say what to do with -1</i>. Write <code>:x - 1</code> with a space on both sides.</p>`,
      e: `print sum 3 4 * 2
print (sum 3 4) * 2
make "x 5
print :x - 1
print -:x`, see: ['sum', 'difference', 'equalp', 'minus'] },

    { n: 'Colors', g: 'Topics', topic: true,
      d: `<p>Anywhere Lohgo wants a color (<code>SETPENCOLOR</code>, <code>SETBACKGROUND</code>, <code>SETFLOODCOLOR</code>, <code>FILLED</code>, <code>SETTEXTCOLOR</code>) you can give it in any of these ways.</p><p><b>A palette number.</b> These are Berkeley Logo's standard colors:</p><table><tr><td>0 black</td><td>4 red</td><td>8 brown</td><td>12 salmon</td></tr><tr><td>1 blue</td><td>5 magenta</td><td>9 tan</td><td>13 purple</td></tr><tr><td>2 green</td><td>6 yellow</td><td>10 forest</td><td>14 orange</td></tr><tr><td>3 cyan</td><td>7 white</td><td>11 aqua</td><td>15 grey</td></tr></table><p>Numbers 8 to 255 can be given new colors with <code>SETPALETTE</code>.</p><p><b>A mix of red, green and blue</b>, as a list of three numbers from 0 (none) to 255 (full): <code>[255 0 0]</code> is red, <code>[255 255 0]</code> yellow, <code>[128 128 128]</code> grey. This lets you make any color, and change it smoothly in a loop.</p><p><b>A name</b>, such as <code>"red</code>, <code>"skyblue</code>, <code>"gold</code> or <code>"tomato</code>. The sixteen palette names always work, and so do the color names web pages use. <b>A hex code</b> like <code>"#ff8800</code> works too.</p><p><code>PENCOLOR</code> and <code>BACKGROUND</code> output the color the way you gave it.</p>`,
      e: `setpensize 6
for [i 0 15] [setpencolor :i forward 20]
penup home right 90 forward 40 left 90 pendown
for [g 0 255 15] [setpencolor (list 255 :g 0) forward 10]`, see: ['setpencolor', 'setbackground', 'setpalette', 'palette'] },

    { n: 'The turtle world', g: 'Topics', topic: true,
      d: `<p>The turtle world is 800 turtle steps wide and 600 tall. The point (0, 0) is in the middle. x grows to the right and y grows upward, so the corners are (-400, -300) at the bottom left and (400, 300) at the top right.</p><p>Headings are compass directions in degrees: 0 is north (up), 90 east, 180 south, 270 west. <code>RIGHT</code> turns clockwise, so the numbers grow as the turtle turns right.</p><p>What happens at the edge depends on the mode:</p><ul><li><code>WINDOW</code> (the start): the turtle can walk off the edge and keep going. You cannot see it out there, but it can come back.</li><li><code>WRAP</code>: the edges join up, and a turtle leaving on the right comes back on the left.</li><li><code>FENCE</code>: moving past an edge stops the program with <i>Turtle out of bounds</i>.</li></ul><p>Turn on the grid in the turtle world toolbar to see the coordinates; the bottom bar shows where the mouse is. Zooming changes only the view. <code>CLEARSCREEN</code> wipes the drawing and sends the turtle home; <code>CLEAN</code> wipes the drawing only.</p>`,
      e: `penup setxy -400 -300 pendown setxy 400 300
penup setxy -400 300 pendown setxy 400 -300
penup home pendown label [(0, 0)]`, see: ['setxy', 'wrap', 'window', 'fence', 'heading'] },

    { n: 'Keyboard and mouse', g: 'Topics', topic: true,
      d: `<p>There are two ways for a program to listen to you.</p><p><b>Asking and waiting.</b> <code>READLIST</code> and <code>READWORD</code> wait for a line typed in the command center. <code>READCHAR</code> waits for a single key pressed in the turtle world; arrow keys arrive as the words <code>LEFT</code>, <code>RIGHT</code>, <code>UP</code> and <code>DOWN</code>. <code>KEYP</code> says whether a key is waiting, without waiting itself, which is how a game keeps moving while checking for keys.</p><p><b>Events.</b> <code>KEYBOARDON [instructions]</code> runs the instructions every time a key goes down, and <code>KEYBOARDVALUE</code> tells you which (Windows key codes: A is 65, the arrows 37 to 40, space 32, Enter 13). <code>MOUSEON</code> takes five lists for left button down and up, right button down and up, and mouse movement. <code>MOUSEPOS</code>, <code>CLICKPOS</code> and <code>BUTTON</code> report the mouse in turtle coordinates. Event instructions run between the instructions of a running program, or by themselves after it ends; turn them off with <code>KEYBOARDOFF</code> and <code>MOUSEOFF</code>.</p><p>The turtle world only hears keys when it has the keyboard focus: click it first.</p>`,
      e: `keyboardon [if keyboardvalue = 37 [left 15] if keyboardvalue = 39 [right 15] if keyboardvalue = 38 [forward 10]]
print [Click the turtle world and steer with the arrow keys. Type keyboardoff to stop.]`, see: ['readchar', 'keyp', 'keyboardon', 'mouseon', 'mousepos'] },

    { n: 'Files on the virtual disk', g: 'Topics', topic: true,
      d: `<p>A web page cannot freely use the files on your computer, so Lohgo keeps its own <b>virtual disk</b> inside the browser. Your programs and data are saved there and are still there next time you open Lohgo on the same browser. The Files panel lets you browse it, bring files in from your computer and download them.</p><p>In browsers that allow it, the Files panel can also lend Lohgo a real folder from your computer. It appears as <code>/mnt/</code> followed by the folder's name, and you choose whether programs may only read it, must ask before each change, or may write freely.</p><p>Paths use forward slashes, starting from <code>/</code>. Your own work goes in <code>/projects</code>, for example <code>/projects/notes.txt</code>. The examples that come with Lohgo are originals: you can read them, and saving one makes your own copy. A name that does not start with <code>/</code> is looked up in the current folder (<code>CHDIR</code>) or under the prefix (<code>SETPREFIX</code>).</p><p>Writing a file takes four steps: open it, make it the writer, print into it, then put things back and close it. Reading is the same with <code>OPENREAD</code>, <code>SETREAD</code> and <code>READLIST</code>, and <code>EOFP</code> tells you when you have reached the end.</p><p>Instead of a file name you can give a list holding one word. <code>openread [|some text|]</code> reads from that text, and <code>openwrite [result]</code> collects what you print into the variable <code>result</code> when you close it.</p>`,
      e: `openwrite "/projects/shopping.txt
setwrite "/projects/shopping.txt
print [apples] print [bread] print [milk]
setwrite [] close "/projects/shopping.txt
openread "/projects/shopping.txt
setread "/projects/shopping.txt
while [not eofp] [print readlist]
setread [] close "/projects/shopping.txt`, see: ['openread', 'openwrite', 'setread', 'setwrite', 'close', 'files'] },

    { n: 'The debugger', g: 'Topics', topic: true,
      d: `<p>The debugger lets you stop a program in the middle and look inside it.</p><p><b>Breakpoints.</b> Click in the margin next to a line in the editor (or press F9) to put a red dot there. When you run with F5 the program pauses just before that line. Right-click the margin for more: <b>Stop only when...</b> makes a conditional breakpoint such as <code>:n = 3</code>, and <b>Run to here</b> runs up to that line once.</p><p><b>Stepping.</b> While paused:</p><table><tr><td>F5</td><td>continue</td></tr><tr><td>F11 (or F8)</td><td>step into: run one instruction, going inside procedures</td></tr><tr><td>F10</td><td>step over: run one line, without stopping inside procedures it calls</td></tr><tr><td>Shift+F11</td><td>step out: finish the current procedure</td></tr><tr><td>Shift+F5</td><td>stop</td></tr></table><p><b>Call Stack</b> lists the procedures that are running, newest at the top. Click an older one to see its own variables. In a recursive procedure you can see each copy waiting for the one it called.</p><p><b>Variables</b> shows the values in the selected procedure and the global ones. Click a value to change it, then continue: a quick way to test an idea. Lists and arrays unfold so you can see inside them.</p><p><b>Watch</b> keeps an eye on an expression such as <code>:size * 2</code>. It can also stop the program when the value changes, or when it becomes true.</p><p>While paused you can type instructions in the command center; they run inside the selected procedure, so <code>print :size</code> shows its local value. After an error the program's state is kept, so you can look around in the same way.</p>`,
      e: `to countdown :n
  if :n = 0 [print "Liftoff! stop]
  print :n
  countdown :n - 1
end
countdown 5`, see: ['Errors and what they mean', 'Recursion'] },

    { n: 'Errors and what they mean', g: 'Topics', topic: true,
      d: `<p>When something goes wrong Logo stops and says what it did not understand. The messages follow Berkeley Logo. Here are the common ones.</p><table>
<tr><td><b>I don't know how to foo</b></td><td>There is no procedure called <code>foo</code>. Check the spelling, define it with <code>TO</code>, or put a quote in front if you meant the word itself: <code>"foo</code>.</td></tr>
<tr><td><b>Not enough inputs to forward</b></td><td>Something is missing, as in <code>forward</code> on its own. Count the inputs the procedure needs.</td></tr>
<tr><td><b>forward doesn't like abc as input</b></td><td>The input is the wrong kind: a word where a number was needed, an empty list given to <code>FIRST</code>, or an item number past the end of a list.</td></tr>
<tr><td><b>You don't say what to do with 7</b></td><td>A value was made but nothing used it. Did you forget <code>PRINT</code> or <code>OUTPUT</code>? A loose minus sign (<code>:x -1</code>) also causes this.</td></tr>
<tr><td><b>size has no value</b></td><td>There is no variable called <code>size</code> here. Use <code>MAKE</code> first, check the spelling after the colon, or check that the procedure has that input.</td></tr>
<tr><td><b>f didn't output to print</b></td><td><code>PRINT</code> wanted a value but the procedure <code>F</code> ended without <code>OUTPUT</code>. Make sure every way through it outputs something.</td></tr>
<tr><td><b>Too much inside ()'s</b></td><td>There are more inputs inside parentheses than the procedure takes.</td></tr>
<tr><td><b>')' not found</b>, <b>Unexpected ']'</b></td><td>Brackets or parentheses do not pair up. Count the opening and closing ones.</td></tr>
<tr><td><b>Can only use STOP or OUTPUT inside a procedure</b></td><td>These end a procedure, so they only make sense between <code>TO</code> and <code>END</code>.</td></tr>
<tr><td><b>Stack overflow</b></td><td>A procedure called itself too many times, usually because its stop rule is missing or never true.</td></tr>
<tr><td><b>Turtle out of bounds</b></td><td>In <code>FENCE</code> mode the turtle tried to leave the world.</td></tr>
<tr><td><b>forward is a primitive</b></td><td>You tried to define a procedure with the same name as a built-in one. Choose another name.</td></tr>
<tr><td><b>Can't find catch tag for foo</b></td><td><code>THROW "foo</code> ran without a matching <code>CATCH "foo</code> around it.</td></tr>
<tr><td><b>File system error: ...</b></td><td>A file could not be opened, read or written: it does not exist, is not open, or is in a folder you cannot change.</td></tr>
</table><p>Double-click the file and line number under the error to jump to that line. The debugger shows the state of the program when it stopped. To handle an error in your own program instead of stopping, use <code>CATCH "error [...]</code> and <code>ERROR</code>.</p>`,
      e: `catch "error [print first []]
show error`, see: ['catch', 'error', 'The debugger'] },

    { n: 'Differences from Berkeley Logo', g: 'Topics', topic: true,
      d: `<p>Lohgo follows Berkeley Logo (UCBLogo) closely: the same primitives, the same rules for parsing, the same error messages, and programs from <i>Computer Science Logo Style</i> should run unchanged. It adds some things and leaves a few out.</p><p><b>Added from FMSLogo and MSWLogo:</b></p><ul><li>colors as names (<code>"skyblue</code>), hex codes and <code>[r g b]</code> lists everywhere, and <code>SETPALETTE</code> for numbers 8 to 255;</li><li><code>ARC</code>, <code>ELLIPSE</code>, <code>ELLIPSEARC</code>, <code>FILLED</code>, <code>(FILL "true)</code>, <code>SETFLOODCOLOR</code>, <code>SETLABELHEIGHT</code>, <code>STAMP</code> and turtle shapes;</li><li>events: <code>MOUSEON</code>, <code>KEYBOARDON</code>, <code>KEYBOARDVALUE</code>, <code>SETTIMER</code>, <code>CLEARTIMER</code>;</li><li><code>SOUND</code>, <code>TONE</code>, <code>TIME</code>, <code>TIMEMILLI</code>;</li><li>folders: <code>DIRECTORY</code>, <code>FILES</code>, <code>FOLDERS</code>, <code>CHDIR</code>, <code>POPDIR</code>, <code>MKDIR</code>, <code>RMDIR</code>, <code>CURRENTDIR</code> (note that Berkeley Logo's own <code>DIRECTORY</code> behaves differently).</li></ul><p><b>Added from LCSI Logo:</b> several turtles with <code>TELL</code>, <code>ASK</code>, <code>EACH</code> and <code>WHO</code>, alongside FMSLogo's <code>SETTURTLE</code>.</p><p><b>Different because it runs in a browser:</b></p><ul><li>Files live on a virtual disk inside the browser, with paths like <code>/projects/notes.txt</code>. Real DOS or Unix paths such as <code>C:\\logo</code> or <code>~/logo</code> do not exist; a real folder can only be reached by lending it to Lohgo from the Files panel, after which it appears under <code>/mnt</code>.</li><li><code>SHELL</code> cannot run system commands and always gives an error.</li><li><code>EPSPICT</code> is not available; <code>SAVEPICT</code> saves a PNG instead, and <code>LOADPICT</code> loads one.</li><li><code>SETCURSOR</code> and <code>CURSOR</code> are only approximate, because the command center is a scrolling list rather than a fixed text grid. <code>SETMARGINS</code>, <code>SETPENPATTERN</code> and <code>REFRESH</code> are accepted but have no visible effect.</li><li>The turtle world is always 800 by 600 steps, and the turtle animates at the speed set by the speed slider.</li></ul>`,
      see: ['Files on the virtual disk', 'Colors', 'tell', 'mouseon'] },
  ]);
})(LG);
