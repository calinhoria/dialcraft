{
  // Neon Street: hover-cars cross the street one at a time (behind the clock), a drone wanders over the whole screen (in front of it) and blinks.
  const MS = 80;
  /*V*/
  const PER = /*PER*/[];
  const FORCEG = -1;
  const tick = () => {
    const t = Date.now() / 1000;
    // a hover-car every 12 s, crossing in 5.5 s at a different height (the four colours in turn)
    const q = (t % 12) / 5.5, k = Math.floor(t / 12) % 4;
    if (q < 1) slot('car')(Math.round(-110 + q * 500), Math.round([232, 150, 300, 205][k] + 2 * Math.sin(t * 3)), V.car['c' + k]); else slot('car').hide();
    // the drone drifts and bobs, its red eye blinks
    slot('drone')(Math.round(195 - 33 + 140 * Math.sin(t / 8.5)), Math.round(225 - 20 + 150 * Math.sin(t / 6.3 + 1)), V.drone[Math.floor(t * 2) % 4 === 0 ? 'off' : 'on']);
    // street boards flicker now and then (the glowing / bright / glitched / dark states of a neon billboard)
    [['bbP', 17, 11, 207, 314]].forEach(([h, P, off, bx, by]) => {
      const m = (t + off) % P, f = Math.floor(m * 10);
      if (m < 1.0 && f % 5 !== 4) slot(h)(bx, by, V[h]['s' + [1, 2, 3, 2][f % 4]]); else slot(h).hide();
    });
    // the glitch: around the minute change a patch of the street hides the minute digits and glitched copies of them flicker through
    const d = new Date(), ph = d.getSeconds() + d.getMilliseconds() / 1000;
    const gt = ph >= 59.55 ? ph - 59.55 : ph + 0.45, gi = Math.floor(gt * 12);
    if (FORCEG >= 0 || (gt < 1.1 && gi % 5 !== 4)) {
      const mn = d.getMinutes(), dg = [Math.floor(mn / 10), mn % 10], st = FORCEG >= 0 ? 'sxd'[FORCEG] : 'sxdsdxsd'[gi % 8];
      const w0 = PER.bw[dg[0]], w1 = PER.bw[dg[1]], left = PER.mc - (w0 + w1 + PER.sp) / 2;
      const PXL = Math.max(0, PER.mc - PER.pw / 2);
      slot('glP')(PXL, PER.y, V.glP.p);
      slot('glC')(PER.cx, PER.cy, V.glC.c);
      slot('glA')(Math.round(left - Math.floor((PER.cw - w0) / 2)), PER.y, V.glA[st + dg[0]]);
      slot('glB')(Math.round(left + w0 + PER.sp - Math.floor((PER.cw - w1) / 2)), PER.y, V.glB[st + dg[1]]);
    } else { slot('glP').hide(); slot('glC').hide(); slot('glA').hide(); slot('glB').hide(); }
  };
  /*RUNTIME*/
}
