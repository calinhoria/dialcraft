{
  // Concentric. Once a second, just after the second changes, in one call:
  //   turns the seconds tick ring to 90 + 6 s degrees and moves the 12 seconds numerals to their next spot (numeral k at 90 + 6 s - 30 k
  //   degrees, upright, on whole pixels), so ticks and numerals always change together
  //   and, when the minute changes, swaps the minute tick frame (5 frames, the pattern repeats every 5 minutes) and moves the 12 minute numerals
  // Spot tables: 60 whole-pixel positions per ring (one per 6 degrees), worked out once at start.
  const CX = 195, CY = 225, NUM = 32, FRAME = 1000, MIN_FIRST = 4;      // the minute frame list starts with frame 4 (the preview minute 9)
  const rad = Math.PI / 180;
  const table = (r) => { const xs = [], ys = []; for (let j = 0; j < 60; j++) { xs.push(Math.round(CX + r * Math.sin(j * 6 * rad) - NUM / 2)); ys.push(Math.round(CY - r * Math.cos(j * 6 * rad) - NUM / 2)); } return { xs, ys }; };
  const SEC = table(162), MIN = table(105);
  const MIN_XY = { x: pxv(53), y: pxv(83) };
  // numeral k (value 5k) at step v (second or minute): angle 90 + 6 v - 30 k = 6 * (15 + v - 5 k) -> table index
  const place = (pre, T, v) => { for (let k = 0; k < 12; k++) { const j = (((15 + v - 5 * k) % 60) + 60) % 60; W[pre + k].setProperty(ui.prop.MORE, { x: pxv(T.xs[j]), y: pxv(T.ys[j]) }); } };
  let lastS = -1, lastM = -1, built = null;
  const tick = () => {
    if (!W.sn0 || !W.secring || !W.minring) return;
    if (W.sn0 !== built) { built = W.sn0; lastS = -1; lastM = -1; }   // new widgets (the watch rebuilt the face): send everything again
    const d = new Date(), s = d.getSeconds(), m = d.getMinutes();
    if (s !== lastS) { lastS = s; W.secring.setProperty(ui.prop.ANGLE, (90 + 6 * s) % 360); place('sn', SEC, s); }
    if (m !== lastM) { lastM = m; W.minring.setProperty(ui.prop.MORE, { x: MIN_XY.x, y: MIN_XY.y, src: F.minring[((m % 5) - MIN_FIRST + 5) % 5] }); place('mn', MIN, m); }
  };
  // One update chain for the whole session: each update schedules the next one just after the next second boundary.
  // start / stop bump a generation number, so an older chain (screen off, or a face instance the watch replaced) ends by itself.
  const G = globalThis;
  G.__ccTick = () => { try { tick(); } catch (e) { /* a bad frame must not stop the clock */ } };
  const next = () => FRAME - (Date.now() % FRAME) + 2;
  const loop = (g) => { if (g !== G.__ccGen) return; G.__ccTick(); try { setTimeout(() => loop(g), next()); } catch (e) {} };
  const stop = () => { G.__ccGen = (G.__ccGen || 0) + 1; };
  const start = () => { stop(); loop(G.__ccGen); };
  start();
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { pause_call: stop, resume_call: start });
}
