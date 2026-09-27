// Files from programs: writing, reading, positions, string streams, DRIBBLE, SAVE/LOAD/SAVEL,
// folders, the read-only /examples folder and the Files panel.
import { resetWorld } from './30-world-lib.mjs';

const D = '/projects/e2e-io';
const read = (p, path) => p.ev(`LG.app.vfs.exists(${JSON.stringify(path)}) ? LG.app.vfs.readText(${JSON.stringify(path)}) : null`);
const write = (p, path, text) => p.ev(`LG.app.vfs.writeText(${JSON.stringify(path)}, ${JSON.stringify(text)}, { trusted: true })`);
const exists = (p, path) => p.ev(`LG.app.vfs.exists(${JSON.stringify(path)})`);
const g = (p, name) => p.ev(`(() => { const v = LG.app.interp.globals.get(${JSON.stringify(name)}); return v === undefined ? null : LG.Data.showText(v); })()`);
/** Run a program and return everything it printed (the transcript after the Running note) */
async function run(p, src) {
  await p.runProgram(src, { path: '/projects/e2e-io-prog.lgo', until: ['idle', 'error'] });
  const out = await p.output();
  return out.slice(out.lastIndexOf('▶ Running')).split('\n').slice(1).join('\n').replace(/\n+$/, '');
}

export default function (t) {
  t.beforeEach(async (p) => {
    await resetWorld(p);
    await p.ev(`(() => { const v = LG.app.vfs; if (v.exists('${D}')) v.rmdir('${D}', { recursive: true, trusted: true }); v.mkdir('${D}', { trusted: true });
      for (const f of ['/projects/e2e-panel.txt', '/projects/e2e-panel-dir', '/projects/e2e-saved.lgo']) if (v.exists(f)) { if (v.stat(f).type === 'dir') v.rmdir(f, { recursive: true, trusted: true }); else v.unlink(f, { trusted: true }); }
      LG.app.interp.files_open.clear(); LG.app.interp.reader = null; LG.app.interp.writer = null; LG.app.interp.dribble = null; LG.app.interp.dirStack = []; })()`);
  });

  // ---- writing ---------------------------------------------------------------------------------------
  t.test('OPENWRITE, SETWRITE and PRINT put text in a file', async (p) => {
    await run(p, `openwrite "${D}/a.txt\nsetwrite "${D}/a.txt\nprint [hello world]\nprint 42\nsetwrite []\nclose "${D}/a.txt\n`);
    p.assert.equal(await read(p, `${D}/a.txt`), 'hello world\n42\n');
  });
  t.test('TYPE and SHOW write to the file too', async (p) => {
    await run(p, `openwrite "${D}/a.txt\nsetwrite "${D}/a.txt\ntype "ab\ntype "cd\nshow [1 [2]]\nclose "${D}/a.txt\n`);
    p.assert.equal(await read(p, `${D}/a.txt`), 'abcd[1 [2]]\n');
  });
  t.test('text written to a file does not show in the command center', async (p) => {
    const out = await run(p, `openwrite "${D}/a.txt\nsetwrite "${D}/a.txt\nprint "secret\nsetwrite []\nprint "public\nclose "${D}/a.txt\n`);
    p.assert.equal(out, 'public');
  });
  t.test('OPENWRITE empties a file that was there', async (p) => {
    await write(p, `${D}/a.txt`, 'old stuff\n');
    await run(p, `openwrite "${D}/a.txt\nsetwrite "${D}/a.txt\nprint "new\nclose "${D}/a.txt\n`);
    p.assert.equal(await read(p, `${D}/a.txt`), 'new\n');
  });
  t.test('OPENAPPEND adds to the end', async (p) => {
    await write(p, `${D}/a.txt`, 'one\n');
    await run(p, `openappend "${D}/a.txt\nsetwrite "${D}/a.txt\nprint "two\nclose "${D}/a.txt\n`);
    p.assert.equal(await read(p, `${D}/a.txt`), 'one\ntwo\n');
  });
  t.test('OPENAPPEND makes a file that was not there', async (p) => {
    await run(p, `openappend "${D}/new.txt\nsetwrite "${D}/new.txt\nprint "first\nclose "${D}/new.txt\n`);
    p.assert.equal(await read(p, `${D}/new.txt`), 'first\n');
  });
  t.test('the file has the text before it is closed', async (p) => {
    await run(p, `openwrite "${D}/a.txt\nsetwrite "${D}/a.txt\nprint "early\nsetwrite []\n`);
    p.assert.equal(await read(p, `${D}/a.txt`), 'early\n');
  });
  t.test('WRITER says which file is being written', async (p) => {
    const out = await run(p, `openwrite "${D}/a.txt\nshow writer\nsetwrite "${D}/a.txt\nmake "w writer\nsetwrite []\nshow :w\nclose "${D}/a.txt\n`);
    p.assert.equal(out, `[]\n${D}/a.txt`);
  });
  t.test('ALLOPEN lists open files and CLOSEALL closes them', async (p) => {
    const out = await run(p, `openwrite "${D}/a.txt\nopenwrite "${D}/b.txt\nshow allopen\ncloseall\nshow allopen\n`);
    p.assert.equal(out, `[${D}/a.txt ${D}/b.txt]\n[]`);
  });
  t.test('CLOSEALL saves what was written', async (p) => {
    await run(p, `openwrite "${D}/a.txt\nsetwrite "${D}/a.txt\nprint "kept\ncloseall\nprint "screen\n`);
    p.assert.equal(await read(p, `${D}/a.txt`), 'kept\n');
    await p.waitOutput(/^screen$/m);
  });
  t.test('CLOSE of a file that is not open is an error', async (p) => {
    await run(p, `close "${D}/nothing.txt\n`);
    await p.waitOutput(/File system error: File not open/);
  });
  t.test('opening a file twice is an error', async (p) => {
    await run(p, `openwrite "${D}/a.txt\nopenwrite "${D}/a.txt\n`);
    await p.waitOutput(/File already open/);
  });
  t.test('SETWRITE of a file opened for reading is an error', async (p) => {
    await write(p, `${D}/a.txt`, 'x\n');
    await run(p, `openread "${D}/a.txt\nsetwrite "${D}/a.txt\n`);
    await p.waitOutput(/not open for writing/);
  });
  t.test('a relative name is written in the current folder', async (p) => {
    await run(p, `chdir "${D}\nopenwrite "rel.txt\nsetwrite "rel.txt\nprint "here\nclose "rel.txt\n`);
    p.assert.equal(await read(p, `${D}/rel.txt`), 'here\n');
  });
  t.test('writing into a folder that does not exist is an error', async (p) => {
    await run(p, `openwrite "${D}/nope/a.txt\n`);
    await p.waitOutput(/File system error/);
  });

  // ---- reading ---------------------------------------------------------------------------------------
  t.test('READLIST reads one line at a time as a list', async (p) => {
    await write(p, `${D}/r.txt`, 'one two\nthree [four five]\n');
    const out = await run(p, `openread "${D}/r.txt\nsetread "${D}/r.txt\nshow readlist\nshow readlist\nsetread []\nclose "${D}/r.txt\n`);
    p.assert.equal(out, '[one two]\n[three [four five]]');
  });
  t.test('READWORD reads a line as a word', async (p) => {
    await write(p, `${D}/r.txt`, 'one two\n');
    const out = await run(p, `openread "${D}/r.txt\nsetread "${D}/r.txt\nmake "w readword\nsetread []\nshow wordp :w\nshow count :w\n`);
    p.assert.equal(out, 'true\n7');
  });
  t.test('READRAWLINE keeps the spaces', async (p) => {
    await write(p, `${D}/r.txt`, '  spaced   out \n');
    await run(p, `openread "${D}/r.txt\nsetread "${D}/r.txt\nmake "w readrawline\nsetread []\n`);
    p.assert.equal(await p.ev("LG.app.interp.globals.get('w')"), '  spaced   out ');
  });
  t.test('READCHAR and READCHARS read characters', async (p) => {
    await write(p, `${D}/r.txt`, 'abcdef');
    const out = await run(p, `openread "${D}/r.txt\nsetread "${D}/r.txt\nprint readchar\nprint readchars 3\nprint readchar\nsetread []\n`);
    p.assert.equal(out, 'a\nbcd\ne');
  });
  t.test('READCHAR reads the end of a line as a newline', async (p) => {
    await write(p, `${D}/r.txt`, 'a\nb');
    await run(p, `openread "${D}/r.txt\nsetread "${D}/r.txt\nmake "c1 readchar\nmake "c2 readchar\nmake "c3 readchar\nsetread []\n`);
    p.assert.deepEqual([await p.ev("LG.app.interp.globals.get('c1')"), await p.ev("LG.app.interp.globals.get('c2')"), await p.ev("LG.app.interp.globals.get('c3')")], ['a', '\n', 'b']);
  });
  t.test('EOFP says when the file is used up', async (p) => {
    await write(p, `${D}/r.txt`, 'x\ny\n');
    const out = await run(p, `openread "${D}/r.txt\nsetread "${D}/r.txt\nshow eofp\nignore readlist\nshow eofp\nignore readlist\nshow eofp\nsetread []\n`);
    p.assert.equal(out, 'false\nfalse\ntrue');
  });
  t.test('a loop reads a whole file with EOFP', async (p) => {
    await write(p, `${D}/r.txt`, '1\n2\n3\n4\n');
    const out = await run(p, `openread "${D}/r.txt\nsetread "${D}/r.txt\nmake "total 0\nuntil [eofp] [make "total :total + first readlist]\nsetread []\nprint :total\n`);
    p.assert.equal(out, '10');
  });
  t.test('at the end READLIST gives the empty word and READWORD and READCHAR the empty list', async (p) => {
    await write(p, `${D}/r.txt`, '');
    const out = await run(p, `openread "${D}/r.txt\nsetread "${D}/r.txt\nshow emptyp readlist\nshow listp readword\nshow listp readchar\nsetread []\n`);
    p.assert.equal(out, 'true\ntrue\ntrue');
  });
  t.test('Windows line ends are read without the carriage return', async (p) => {
    await write(p, `${D}/r.txt`, 'ab\r\ncd\r\n');
    const out = await run(p, `openread "${D}/r.txt\nsetread "${D}/r.txt\nshow readword\nshow readword\nsetread []\n`);
    p.assert.equal(out, 'ab\ncd');
  });
  t.test('READPOS and SETREADPOS move about in the file', async (p) => {
    await write(p, `${D}/r.txt`, 'hello world');
    const out = await run(p, `openread "${D}/r.txt\nsetread "${D}/r.txt\nignore readchars 3\nshow readpos\nsetreadpos 6\nprint readchars 5\nsetreadpos 0\nprint readchar\nsetread []\n`);
    p.assert.equal(out, '3\nworld\nh');
  });
  t.test('SETREADPOS past the end stops at the end', async (p) => {
    await write(p, `${D}/r.txt`, 'abc');
    const out = await run(p, `openread "${D}/r.txt\nsetread "${D}/r.txt\nsetreadpos 99\nshow readpos\nshow eofp\nsetread []\n`);
    p.assert.equal(out, '3\ntrue');
  });
  t.test('READPOS with no file chosen is an error', async (p) => {
    await run(p, 'show readpos\n');
    await p.waitOutput(/Not reading a file/);
  });
  t.test('READER says which file is being read', async (p) => {
    await write(p, `${D}/r.txt`, 'x');
    const out = await run(p, `show reader\nopenread "${D}/r.txt\nsetread "${D}/r.txt\nmake "r reader\nsetread []\nshow :r\nshow reader\n`);
    p.assert.equal(out, `[]\n${D}/r.txt\n[]`);
  });
  t.test('KEYP while reading a file says whether there is more', async (p) => {
    await write(p, `${D}/r.txt`, 'a');
    const out = await run(p, `openread "${D}/r.txt\nsetread "${D}/r.txt\nshow keyp\nignore readchar\nshow keyp\nsetread []\n`);
    p.assert.equal(out, 'true\nfalse');
  });
  t.test('OPENREAD of a missing file is an error', async (p) => {
    await run(p, `openread "${D}/missing.txt\n`);
    await p.waitOutput(/File system error/);
    p.assert.equal(await p.state(), 'error');
  });
  t.test('SETREAD of a file opened for writing is an error', async (p) => {
    await run(p, `openwrite "${D}/a.txt\nsetread "${D}/a.txt\n`);
    await p.waitOutput(/not open for reading/);
  });
  t.test('SETREAD of a file that is not open is an error', async (p) => {
    await run(p, `setread "${D}/r.txt\n`);
    await p.waitOutput(/File not open/);
  });
  t.test('an example program can be read', async (p) => {
    const name = await p.ev("LG.app.vfs.list('/examples').find((e) => e.type === 'file').path");
    const out = await run(p, `openread "${name}\nsetread "${name}\nshow wordp readword\nsetread []\nclose "${name}\n`);
    p.assert.equal(out, 'true');
  });

  // ---- OPENUPDATE and positions -------------------------------------------------------------------------
  t.test('OPENUPDATE reads and writes the same file', async (p) => {
    await write(p, `${D}/u.txt`, 'abcdef');
    const out = await run(p, `openupdate "${D}/u.txt\nsetread "${D}/u.txt\nprint readchars 2\nsetwrite "${D}/u.txt\nsetwritepos 2\ntype "XY\nsetwrite []\nsetread []\nclose "${D}/u.txt\n`);
    p.assert.equal(out, 'ab');
    p.assert.equal(await read(p, `${D}/u.txt`), 'abXYef');
  });
  t.test('WRITEPOS follows what is written', async (p) => {
    const out = await run(p, `openwrite "${D}/a.txt\nsetwrite "${D}/a.txt\ntype "hello\nmake "wp writepos\nsetwrite []\nshow :wp\nclose "${D}/a.txt\n`);
    p.assert.equal(out, '5');
  });
  t.test('SETWRITEPOS overwrites in the middle', async (p) => {
    await run(p, `openwrite "${D}/a.txt\nsetwrite "${D}/a.txt\ntype "abcdef\nsetwritepos 1\ntype "Z\nsetwrite []\nclose "${D}/a.txt\n`);
    p.assert.equal(await read(p, `${D}/a.txt`), 'aZcdef');
  });
  t.test('SETWRITEPOS with nothing being written is an error', async (p) => {
    await run(p, 'setwritepos 3\n');
    await p.waitOutput(/Not writing a file/);
  });

  // ---- files and folders ---------------------------------------------------------------------------------
  t.test('FILEP knows files from folders', async (p) => {
    await write(p, `${D}/f.txt`, 'x');
    const out = await run(p, `show filep "${D}/f.txt\nshow filep "${D}/none.txt\nshow filep "${D}\n`);
    p.assert.equal(out, 'true\nfalse\nfalse');
  });
  t.test('ERASEFILE deletes a file', async (p) => {
    await write(p, `${D}/f.txt`, 'x');
    await run(p, `erasefile "${D}/f.txt\n`);
    p.assert.equal(await exists(p, `${D}/f.txt`), false);
  });
  t.test('ERASEFILE of a missing file is an error', async (p) => {
    await run(p, `erasefile "${D}/none.txt\n`);
    await p.waitOutput(/File system error/);
  });
  t.test('MKDIR, FOLDERS and RMDIR', async (p) => {
    const out = await run(p, `chdir "${D}\nmkdir "sub\nmkdir "other\nshow folders\nrmdir "other\nshow folders\n`);
    p.assert.equal(out, '[other sub]\n[sub]');
    p.assert.equal(await exists(p, `${D}/sub`), true);
  });
  t.test('FILES lists only files and DIRECTORY lists both', async (p) => {
    await write(p, `${D}/b.txt`, '1');
    await write(p, `${D}/a.lgo`, '1');
    await p.ev(`LG.app.vfs.mkdir('${D}/zdir', { trusted: true })`);
    const out = await run(p, `chdir "${D}\nshow files\nshow directory\n`);
    p.assert.equal(out, '[a.lgo b.txt]\n[zdir a.lgo b.txt]');
  });
  t.test('RMDIR of a folder with files in it is an error', async (p) => {
    await p.ev(`LG.app.vfs.mkdir('${D}/full', { trusted: true })`);
    await write(p, `${D}/full/x.txt`, '1');
    await run(p, `rmdir "${D}/full\n`);
    await p.waitOutput(/File system error/);
    p.assert.equal(await exists(p, `${D}/full/x.txt`), true);
  });
  t.test('MKDIR of a folder that is there is an error', async (p) => {
    await run(p, `mkdir "${D}\n`);
    await p.waitOutput(/File system error/);
  });
  t.test('CHDIR, CURRENTDIR and POPDIR', async (p) => {
    await p.ev(`LG.app.vfs.mkdir('${D}/sub', { trusted: true })`);
    const out = await run(p, `chdir "${D}\nprint currentdir\nchdir "sub\nprint currentdir\npopdir\nprint currentdir\npopdir\nprint currentdir\n`);
    p.assert.equal(out, `${D}\n${D}/sub\n${D}\n/`);
  });
  t.test('CHDIR .. goes up a folder', async (p) => {
    const out = await run(p, `chdir "${D}\nchdir "..\nprint currentdir\n`);
    p.assert.equal(out, '/projects');
  });
  t.test('CHDIR to a missing folder is an error and stays put', async (p) => {
    await run(p, `chdir "${D}\nchdir "nowhere\n`);
    await p.waitOutput(/File system error/);
    await p.command('print currentdir');
    await p.waitOutput(new RegExp('^' + D + '$', 'm'));
  });
  t.test('SETPREFIX puts relative names under a folder', async (p) => {
    const out = await run(p, `setprefix "${D}\nshow prefix\nopenwrite "pre.txt\nclose "pre.txt\nsetprefix []\nshow prefix\n`);
    p.assert.equal(out, `${D}\n[]`);
    p.assert.equal(await exists(p, `${D}/pre.txt`), true);
  });

  // ---- string streams --------------------------------------------------------------------------------------
  t.test('OPENREAD of a list reads from the word inside it', async (p) => {
    const out = await run(p, 'openread [hello]\nsetread [hello]\nprint readchar\nprint readchars 2\nshow eofp\nsetread []\nclose [hello]\n');
    p.assert.equal(out, 'h\nel\nfalse');
  });
  t.test('OPENWRITE of a list collects the text in a variable', async (p) => {
    await run(p, 'openwrite [buf]\nsetwrite [buf]\nprint "abc\ntype 12\nsetwrite []\nclose [buf]\n');
    p.assert.equal(await p.ev("LG.app.interp.globals.get('buf')"), 'abc\n12');
  });
  t.test('OPENAPPEND of a list adds to the variable', async (p) => {
    await run(p, 'make "buf "start-\nopenappend [buf]\nsetwrite [buf]\ntype "more\nsetwrite []\nclose [buf]\n');
    p.assert.equal(await p.ev("LG.app.interp.globals.get('buf')"), 'start-more');
  });
  t.test('a string stream shows in ALLOPEN', async (p) => {
    const out = await run(p, 'openwrite [buf]\nshow allopen\ncloseall\n');
    p.assert.equal(out, '[[buf]]');
  });

  // ---- DRIBBLE ----------------------------------------------------------------------------------------------
  t.test('DRIBBLE copies what is printed into a file', async (p) => {
    const out = await run(p, `dribble "${D}/log.txt\nprint "one\nprint [two three]\nnodribble\nprint "four\n`);
    p.assert.equal(out, 'one\ntwo three\nfour');
    p.assert.equal(await read(p, `${D}/log.txt`), 'one\ntwo three\n');
  });
  t.test('DRIBBLE twice is an error', async (p) => {
    await run(p, `dribble "${D}/log.txt\ndribble "${D}/log2.txt\n`);
    await p.waitOutput(/Already dribbling/);
    await p.command('nodribble');
  });

  // ---- SAVE, LOAD, SAVEL --------------------------------------------------------------------------------
  t.test('SAVE writes procedures and variables', async (p) => {
    await run(p, `to sq :n\nrepeat 4 [fd :n rt 90]\nend\nmake "size 5\nsave "${D}/ws.lgo\n`);
    const text = await read(p, `${D}/ws.lgo`);
    p.assert.match(text, /^to sq :n\nrepeat 4 \[fd :n rt 90\]\nend$/m);
    p.assert.match(text, /^Make "size 5$/m);
  });
  t.test('LOAD brings saved procedures and variables back', async (p) => {
    await write(p, `${D}/ws.lgo`, 'to twice :x\noutput :x * 2\nend\nMake "v 21\n');
    const out = await run(p, `load "${D}/ws.lgo\nprint twice :v\n`);
    p.assert.equal(out, '42');
  });
  t.test('SAVE then LOAD round trips a workspace', async (p) => {
    await run(p, `to greet\nprint [hi there]\nend\nmake "list [1 [2 3]]\nsave "${D}/ws.lgo\n`);
    const out = await run(p, `load "${D}/ws.lgo\ngreet\nshow :list\n`);
    p.assert.equal(out, 'hi there\n[1 [2 3]]');
  });
  t.test('SAVEL saves only the procedures named', async (p) => {
    await run(p, `to keep\nprint 1\nend\nto skip\nprint 2\nend\nsavel [keep] "${D}/part.lgo\n`);
    const text = await read(p, `${D}/part.lgo`);
    p.assert.match(text, /to keep/);
    p.assert.doesNotMatch(text, /to skip/);
  });
  t.test('a relative SAVE goes in the current folder', async (p) => {
    await run(p, `make "a 1\nchdir "${D}\nsave "rel.lgo\n`);
    p.assert.match(await read(p, `${D}/rel.lgo`), /Make "a 1/);
  });
  t.test('SAVE updates an open editor tab of the same file', async (p) => {
    await write(p, '/projects/e2e-saved.lgo', 'old text\n');
    await p.ev("LG.app.openFile('/projects/e2e-saved.lgo')");
    await p.ev("LG.app.openFile('/projects/e2e-io-prog.lgo')");
    await run(p, 'to fresh\nprint 1\nend\nsave "/projects/e2e-saved.lgo\n');
    p.assert.match(await p.ev("LG.app.docByPath('/projects/e2e-saved.lgo').editor.getValue()"), /to fresh/);
    await p.ev("LG.app.closeDoc(LG.app.docByPath('/projects/e2e-saved.lgo'))");
  });

  // ---- /examples is read-only ---------------------------------------------------------------------------
  const refused = [
    ['OPENWRITE', 'openwrite "/examples/e2e.txt\n', '/examples/e2e.txt'],
    ['OPENAPPEND', 'openappend "/examples/e2e.txt\n', '/examples/e2e.txt'],
    ['SAVE', 'make "a 1\nsave "/examples/e2e.lgo\n', '/examples/e2e.lgo'],
    ['SAVEL', 'to f\nend\nsavel [f] "/examples/e2e.lgo\n', '/examples/e2e.lgo'],
    ['MKDIR', 'mkdir "/examples/e2edir\n', '/examples/e2edir'],
    ['DRIBBLE', 'dribble "/examples/e2e.txt\n', '/examples/e2e.txt'],
  ];
  for (const [what, src, path] of refused) {
    t.test(`${what} into /examples is refused`, async (p) => {
      await run(p, src);
      p.assert.equal(await p.state(), 'error');
      await p.waitOutput(/File system error/);
      p.assert.equal(await exists(p, path), false);
    });
  }
  t.test('ERASEFILE of an example is refused', async (p) => {
    const name = await p.ev("LG.app.vfs.list('/examples').find((e) => e.type === 'file').path");
    await run(p, `erasefile "${name}\n`);
    await p.waitOutput(/Permission denied/);
    p.assert.equal(await exists(p, name), true);
  });
  t.test('OPENUPDATE of an example is refused', async (p) => {
    const name = await p.ev("LG.app.vfs.list('/examples').find((e) => e.type === 'file').path");
    const before = await read(p, name);
    await run(p, `openupdate "${name}\n`);
    await p.waitOutput(/Permission denied/);
    p.assert.equal(await read(p, name), before);
  });

  // ---- the Files panel -------------------------------------------------------------------------------------
  const panelRow = (path) => `#sideBody .trow[data-path="${path}"]`;
  t.test('a file written by a program shows in the Files panel', async (p) => {
    if (await p.ev("LG.app.side !== 'files'")) await p.click('#railFiles');
    p.assert.equal(await p.exists(panelRow('/projects/e2e-panel.txt')), false);
    await run(p, 'openwrite "/projects/e2e-panel.txt\nclose "/projects/e2e-panel.txt\n');
    await p.wait(`!!document.querySelector('${panelRow('/projects/e2e-panel.txt')}')`, 3000);
  });
  t.test('a folder made by MKDIR shows in the Files panel', async (p) => {
    if (await p.ev("LG.app.side !== 'files'")) await p.click('#railFiles');
    await run(p, 'mkdir "/projects/e2e-panel-dir\n');
    await p.wait(`!!document.querySelector('${panelRow('/projects/e2e-panel-dir')}')`, 3000);
    p.assert.equal(await p.attr(panelRow('/projects/e2e-panel-dir'), 'aria-expanded'), 'false');
  });
  t.test('ERASEFILE takes the file out of the Files panel', async (p) => {
    if (await p.ev("LG.app.side !== 'files'")) await p.click('#railFiles');
    await write(p, '/projects/e2e-panel.txt', 'x');
    await p.wait(`!!document.querySelector('${panelRow('/projects/e2e-panel.txt')}')`, 3000);
    await run(p, 'erasefile "/projects/e2e-panel.txt\n');
    await p.wait(`!document.querySelector('${panelRow('/projects/e2e-panel.txt')}')`, 3000);
  });
  t.test('a file saved by SAVE shows in the Files panel and opens with a click', async (p) => {
    if (await p.ev("LG.app.side !== 'files'")) await p.click('#railFiles');
    await run(p, 'to e2esaved\nprint 1\nend\nsave "/projects/e2e-saved.lgo\n');
    await p.wait(`!!document.querySelector('${panelRow('/projects/e2e-saved.lgo')}')`, 3000);
    await p.click(panelRow('/projects/e2e-saved.lgo'));
    await p.wait("LG.app.active.path === '/projects/e2e-saved.lgo'");
    p.assert.match(await p.code(), /to e2esaved/);
    await p.ev("LG.app.closeDoc(LG.app.active)");
  });

  // ---- runs and open files ---------------------------------------------------------------------------------
  t.test('a new run closes files left open by the last one', async (p) => {
    await run(p, `openwrite "${D}/a.txt\nsetwrite "${D}/a.txt\n`);
    const out = await run(p, 'show allopen\nshow writer\n');
    p.assert.equal(out, '[]\n[]');
  });
  t.test('a program left writing a file still prints to the screen next run', async (p) => {
    await run(p, `openwrite "${D}/a.txt\nsetwrite "${D}/a.txt\n`);
    const out = await run(p, 'print "visible\n');
    p.assert.equal(out, 'visible');
  });
}
