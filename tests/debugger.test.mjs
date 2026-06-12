// Debugger tests: breakpoints, frames, changing values in any frame, stepping, post-mortem.
import assert from 'node:assert/strict';
import { LG } from './harness.mjs';

function make(src, path = '/projects/d.lgo') {
  let out = '';
  const I = new LG.Interp({ vfs: new LG.VFS(), io: { print: (t) => { out += t; } }, turtle: new LG.TurtleWorld({ headless: true }) });
  I.timeSlice = 1e9;
  const wait = (ev) => new Promise((res) => {
    const evs = ['paused', 'done', 'error', 'immediateDone', 'immediateError'];
    const hs = evs.map((e) => [e, (x) => { hs.forEach(([n, f]) => I.off(n, f)); res({ ev: e, x }); }]);
    hs.forEach(([n, f]) => I.on(n, f));
  });
  const bp = (line) => I.breakpoints.set(I.fileId(path) + ':' + line, { cond: '' });
  return { I, wait, bp, out: () => out, load: () => I.loadText(src, path) };
}
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

const FACT = 'to fact :n\nif :n = 0 [output 1]\noutput :n * fact :n - 1\nend\nprint fact 5\n';

test('breakpoint pauses with every recursive frame', async () => {
  const t = make(FACT);
  t.bp(2);
  let w = t.wait(); t.load(); let r = await w;
  assert.equal(r.ev, 'paused');
  for (let i = 0; i < 3; i++) { w = t.wait(); t.I.resume(); r = await w; }
  const fr = LG.Debug.frames(t.I);
  assert.equal(fr.length, 5);
  assert.deepEqual(fr.slice(1).map((f) => f.act.vars.get('n')), [5, 4, 3, 2]);
  t.I.breakpoints.clear();
  w = t.wait(); t.I.resume(); r = await w;
  assert.equal(r.ev, 'done');
  assert.equal(t.out(), '120\n');
});
test('changing :n in an older frame changes the result', async () => {
  // :n is read after the recursive call returns, so an edit to an older frame shows up
  const t = make('to total :n\nif :n = 0 [output 0]\noutput (total :n - 1) + :n\nend\nprint total 5\n');
  t.bp(2);
  let w = t.wait(); t.load(); await w;
  w = t.wait(); t.I.resume(); await w;          // fact 4 inside fact 5
  const fr = LG.Debug.frames(t.I);
  const outer = LG.Debug.frameEntries(t.I, fr[1]).find((e) => e.name === 'n');
  LG.Debug.assign(t.I, outer, '10');              // fact 5 frame now thinks n = 10
  t.I.breakpoints.clear();
  w = t.wait(); t.I.resume(); await w;
  assert.equal(t.out(), String(10 + 4 + 3 + 2 + 1) + '\n');
});
test('step into, over and out', async () => {
  const src = 'to a\nprint 1\nb\nprint 3\nend\nto b\nprint 2\nend\na\n';
  const t = make(src);
  t.bp(2);
  let w = t.wait(); t.load(); await w;
  assert.equal(t.I.stepNode.ln, 2);
  w = t.wait(); t.I.resume('over'); await w;
  assert.equal(t.I.stepNode.ln, 3);
  w = t.wait(); t.I.resume('into'); await w;
  assert.equal(t.I.stepNode.ln, 7);
  assert.equal(LG.Debug.frames(t.I).length, 3);
  w = t.wait(); t.I.resume('out'); await w;
  assert.equal(t.I.stepNode.ln, 4);
  t.I.breakpoints.clear();
  w = t.wait(); t.I.resume(); await w;
  assert.equal(t.out(), '1\n2\n3\n');
});
test('immediate commands run in the selected frame', async () => {
  const t = make(FACT);
  t.bp(2);
  let w = t.wait(); t.load(); await w;
  w = t.wait(); t.I.resume(); await w;
  w = t.wait(); t.I.runImmediate('print :n * 100', 1); let r = await w;
  assert.equal(r.ev, 'immediateDone');
  assert.ok(t.out().endsWith('500\n'));
  w = t.wait(); t.I.runImmediate('output :n', 2); r = await w;
  assert.equal(r.ev, 'immediateError');
  assert.equal(t.I.state, 'paused');
  t.I.halt();
});
test('errors keep the frames for a post-mortem', async () => {
  const t = make('to boom :k\nif :k = 0 [print 1 / :k]\nboom :k - 1\nend\nboom 3\n');
  let w = t.wait(); t.load(); let r = await w;
  assert.equal(r.ev, 'error');
  assert.equal(r.x.ln, 2);
  assert.equal(r.x.procName, 'boom');
  const fr = LG.Debug.frames(t.I);
  assert.equal(fr.length, 5);
  w = t.wait(); t.I.runImmediate('print :k + 7', 1); r = await w;
  assert.equal(r.ev, 'immediateDone');
  assert.ok(t.out().endsWith('10\n'));
  assert.equal(t.I.state, 'error');
});
test('pause request and watches', async () => {
  const t = make('make "i 0\nforever [make "i :i + 1]\n');
  t.I.timeSlice = 10;
  let w = t.wait(); t.load();
  setTimeout(() => t.I.requestPause(), 30);
  const r = await w;
  assert.equal(r.ev, 'paused');
  assert.ok(t.I.peek(':i * 2') > 0);
  assert.throws(() => t.I.peek('make "i 1'));
  t.I.halt();
});
test('conditional breakpoints', async () => {
  const t = make('for [k 1 10] [\nprint :k\n]\n');
  t.I.breakpoints.set(t.I.fileId('/projects/d.lgo') + ':2', { cond: ':k = 7' });
  let w = t.wait(); t.load(); const r = await w;
  assert.equal(r.ev, 'paused');
  assert.equal(LG.Debug.lookup(t.I, 'k', LG.Debug.frames(t.I).pop().scope).value, 7);
  t.I.halt();
});
test('deep recursion does not overflow', async () => {
  const t = make('to down :n\nif :n = 0 [output 0]\noutput 1 + down :n - 1\nend\nprint down 30000\n');
  const w = t.wait(); t.load(); const r = await w;
  assert.equal(r.ev, 'done');
  assert.equal(t.out(), '30000\n');
});
test('lists are edited by copying, arrays in place', async () => {
  const t = make('make "l [1 2 3]\nmake "a {1 2 3}\nmake "keep :l\npause\nprint :l print :keep show :a\n');
  let w = t.wait(); t.load(); await w;
  const g = LG.Debug.globals(t.I);
  const l = g.find((e) => e.name === 'l');
  const item2 = LG.Debug.children(l).items[1];
  LG.Debug.assign(t.I, item2, '"x');
  const a = g.find((e) => e.name === 'a');
  LG.Debug.assign(t.I, LG.Debug.children(a).items[0], '[9 9]');
  w = t.wait(); t.I.resume(); await w;
  assert.equal(t.out(), '1 x 3\n1 2 3\n{[9 9] 2 3}\n');
});

let pass = 0;
for (const [name, fn] of tests) {
  try { await fn(); pass++; console.log('ok - ' + name); } catch (e) { console.log('FAIL - ' + name + '\n  ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n  ')); }
}
console.log(`${pass}/${tests.length} debugger tests passed`);
process.exit(pass === tests.length ? 0 : 1);
