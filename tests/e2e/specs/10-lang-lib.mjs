// Shared helpers for the 10- specs: run something at the command center prompt and read back
// exactly what the transcript shows.

/** The transcript as plain text (no styling line breaks) */
export async function transcript(p) {
  return p.ev("(LG.app.commander.flush(), document.getElementById('transcript').textContent)");
}

/** Put the IDE back to an idle prompt with an empty transcript */
export async function resetPrompt(p) {
  // close dialogs the way a person does, so their key handlers go away too
  for (let i = 0; i < 6 && await p.ev('LG.UI.anyModalOpen()'); i++) await p.key('Escape');
  await p.ev(`(() => {
    LG.UI.closeMenus();
    const c = LG.app.commander;
    if (LG.app.interp.state !== 'idle') LG.app.stop();
    if (c.defining) { c.defining = null; c.setPrompt(); }
    if (c.reading) c.stopReading();
    c.input.value = ''; c.color = null; c.endPage();
    c.clear();
  })()`);
  await p.sleep(20);
}

/** Type an instruction at the prompt, press Enter and return the whole transcript */
export async function at(p, text) {
  await resetPrompt(p);
  await p.command(text);
  return transcript(p);
}

/**
 * Register one test per case. Each case is [instruction, expected output]; the transcript must
 * be the echoed instruction followed by exactly that output. A third member 'full' means the
 * expected text is the whole transcript (used when TO ... END lines are echoed one by one).
 */
export function cases(t, group, list) {
  list.forEach(([cmd, out, mode], i) => {
    t.test(`${group} ${String(i + 1).padStart(2, '0')}: ${cmd.replace(/\n/g, ' / ')}`, async (p) => {
      const got = await at(p, cmd);
      p.assert.equal(got, mode === 'full' ? out : cmd + '\n' + out, 'transcript was ' + JSON.stringify(got));
    });
  });
}
