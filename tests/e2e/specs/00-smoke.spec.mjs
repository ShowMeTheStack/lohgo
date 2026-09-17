// Smoke tests: the page loads, a command runs, a program runs, the debugger pauses.
export default function (t) {
  t.test('the studio loads with every main area', async (p) => {
    for (const id of ['#worldCard', '#cmdCard', '#editorCard', '#inspCard', '#tbRun', '#rail']) p.assert.ok(await p.visible(id), id);
    p.assert.equal(await p.state(), 'idle');
  });
  t.test('a command moves the turtle', async (p) => {
    await p.command('fd 100 rt 90 fd 50');
    p.assert.deepEqual(await p.turtle().then((x) => [x.x, x.y, x.heading]), [50, 100, 90]);
  });
  t.test('PRINT shows in the command center', async (p) => {
    await p.command('print sum 2 3');
    await p.waitOutput(/^5$/m);
  });
  t.test('a program runs with F5', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'to sq\nrepeat 4 [fd 10 rt 90]\nend\nsq\nprint "done\n');
    await p.key('F5');
    await p.waitOutput(/done/);
    p.assert.equal(await p.segments(), 4);
  });
  t.test('a breakpoint pauses the program', async (p) => {
    await p.newFile('/projects/e2e.lgo', 'to f :n\nif :n = 0 [stop]\nf :n - 1\nend\nf 3\n');
    await p.ev("LG.app.toggleBreakpoint('/projects/e2e.lgo', 1)");
    await p.key('F5');
    await p.waitState('paused');
    await p.inspector('stack');
    p.assert.match(await p.paneText('stack'), /f 3/);
    await p.stopProgram();
  });
}
