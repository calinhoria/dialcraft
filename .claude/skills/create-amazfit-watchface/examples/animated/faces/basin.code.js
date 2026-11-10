{
  // Water Basin: every 6 s a drop forms on the leaf tip, falls, and splashes into the basin; two rings spread out and fade.
  // The impact is on every multiple of 6 seconds, so a drop lands exactly as the minute changes.
  const MS = 90;
  /*V*/
  const P = 6, TI = 2.6;               // cycle length, the moment of impact in the cycle
  const FALL0 = 1.8, TIP_Y = 96, WATER_Y = 338, DX = 241, RX = 166, RY = 322;
  const tick = () => {
    const d = new Date(), t = d.getSeconds() + d.getMilliseconds() / 1000;
    const c = (t + TI) % P;            // c in [0,P): the drop is at the tip from c = 0 and lands at c = TI, i.e. when t is a multiple of 6
    // the drop
    if (c < FALL0) slot('drop')(DX, TIP_Y, V.drop[c < 0.6 ? 'b1' : c < 1.2 ? 'b2' : 'b3']);
    else if (c < TI) { const q = (c - FALL0) / (TI - FALL0); slot('drop')(DX, Math.round(TIP_Y + 8 + (WATER_Y - TIP_Y - 8) * q * q), V.drop.f); }
    else slot('drop').hide();
    // the splash and the rings after the impact (age = seconds since impact)
    const age = c >= TI ? c - TI : -1;
    if (age >= 0 && age < 0.88) slot('splash')(191, 292, V.splash['s' + Math.min(7, Math.floor(age / 0.11))]); else slot('splash').hide();
    const ring = (h, a) => { if (a >= 0 && a < 2.4) slot(h)(RX, RY, V[h]['r' + Math.min(5, Math.floor(a / 0.4))]); else slot(h).hide(); };
    ring('ripA', age);
    ring('ripB', age >= 0 ? age - 0.7 : -1);
  };
  /*RUNTIME*/
}
