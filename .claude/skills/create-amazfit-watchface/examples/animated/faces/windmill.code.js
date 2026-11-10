{
  // Cloud Windmill: sails turn with the clock, small distant clouds drift, birds cross the sky by day, and the whole scene follows the time of day
  // (dawn glow, dusk, night with stars, a moon, a lit window and fireflies). ~2.5 s around every minute change a gust blows the minute digits
  // away to the right (a sky-coloured cover grows over them, matched to the current light), the minute changes underneath, then the cover is
  // pulled back and the new clouds reappear. On the hour the hour digits go the same way. The sails spin faster during the gust.
  const MS = 90;
  /*V*/
  const TESTH = -1;
  const HX = 44, HW = 176, HY = 14, MY = 118, RH = 104;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const prog = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const eio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const cover = (ph) => (ph >= 58 ? eio(prog(ph, 58, 59)) : ph < 0.3 ? 1 : ph < 1.3 ? 1 - eio(prog(ph, 0.3, 1.3)) : 0);
  // light level 0 (day) .. 7 (deep night) from the hour of the day
  const KP = [[0, 7], [4.5, 7], [5.5, 5], [6.5, 3], [7.5, 1], [8.5, 0], [17, 0], [18, 1], [19, 3], [20, 5], [21, 6.5], [22, 7], [24, 7]];
  const lvlAt = (h) => { for (let i = 1; i < KP.length; i++) if (h <= KP[i][0]) { const a = KP[i - 1], b = KP[i]; return a[1] + (b[1] - a[1]) * (h - a[0]) / (b[0] - a[0]); } return 7; };
  const GW = 154, GH = 80;
  // one region (a row of digits): the sky cover, the gust that pushes the digits away and flies off, and the swirl that pulls them back
  const region = (sk, gu, pu, y, on, ph, u, L) => {
    const f = on ? cover(ph) : 0, cy = y + (RH - GH) / 2;
    if (f > 0) slot(sk)(HX, y, V[sk]['p' + L], Math.max(1, Math.round(HW * f)), RH); else slot(sk).hide();
    if (on && u >= 0.5 && u < 3.0) {
      let x, i, dy = 0;
      if (u < 1.5) { i = 1 + Math.min(3, Math.floor((u - 0.5) * 4)); x = HX + Math.round(HW * f) + 20 - GW; }
      else { const q = (u - 1.5) / 1.5, x0 = HX + HW + 20 - GW; i = 5 + Math.min(3, Math.floor(q * 4)); x = x0 + Math.round(q * (400 - x0)); dy = -Math.round(q * 12); }
      slot(gu)(x, cy + dy, V[gu]['g' + i]);
    } else slot(gu).hide();
    if (on && f > 0 && f < 1 && ph >= 0.3 && ph < 1.4) slot(pu)(HX + Math.round(HW * f) - 24, cy, V[pu][f > 0.66 ? 'r3' : f > 0.33 ? 'r6' : 'r8']); else slot(pu).hide();
  };
  const tick = () => {
    const d = new Date(), now = d.getTime(), t = now / 1000, ph = d.getSeconds() + d.getMilliseconds() / 1000, mn = d.getMinutes();
    const L = Math.round(lvlAt(TESTH >= 0 ? TESTH : d.getHours() + mn / 60));
    // the light
    if (L > 0) slot('veil')(0, 0, V.veil['l' + L]); else slot('veil').hide();
    if (L >= 3) slot('win')(256, 199, V.win.w); else slot('win').hide();
    if (L >= 5) {
      slot('stars')(0, 0, V.stars[Math.floor(t / 1.2) % 2 ? 'sa' : 'sb']);
      slot('moon')(218, 78, V.moon[L >= 6 ? 'm2' : 'm1']);
      for (let i = 0; i < 3; i++) slot('ff' + i)(Math.round([60, 130, 175][i] + 45 * Math.sin(t * 0.4 + i * 2)), Math.round([300, 325, 292][i] + 14 * Math.sin(t * 0.7 + i)), V['ff' + i][Math.floor(t * 2.2 + i * 1.7) % 3 === 0 ? 'dim' : 'on']);
    } else { slot('stars').hide(); slot('moon').hide(); for (let i = 0; i < 3; i++) slot('ff' + i).hide(); }
    // drifting faded clouds (they fade in and out at the screen edges)
    const drift = (h, y, sp, off) => { const x = ((t * sp + off) % 560) - 60; slot(h)(Math.round(x), y, V[h][x < 6 || x > 330 ? 'f' : 'a']); };
    drift('cl1', 192, 2.2, 62.8); drift('cl2', 166, 3.2, 376.8); drift('cl3', 122, 1.6, 93.4);
    // birds cross the sky by day and at dusk, one after another, flapping
    const bird = (h, y0, P, off, amp) => {
      const q = ((t + off) % P) / P;
      if (L >= 5 || q > 0.42) { slot(h).hide(); return; }
      const k = q / 0.42;
      slot(h)(Math.round(-30 + k * 450), Math.round(y0 + amp * Math.sin(k * 14) - 24 * k), V[h]['b' + [0, 1, 2, 1][Math.floor(now / 130) % 4]]);
    };
    bird('bird0', 130, 38, 3, 6); bird('bird1', 170, 52, 21, 8); bird('bird2', 150, 61, 40, 5);
    // the wind
    const u = (ph + 2.5) % 60, hourGo = (mn === 59 && ph >= 58) || (mn === 0 && ph < 1.4);
    region('skyM', 'gustM', 'pullM', MY, true, ph, u, L);
    region('skyH', 'gustH', 'pullH', HY, hourGo, ph, u, L);
    const ang = (now / 1000 * 30 + 720 * eio(prog(u, 0, 4))) % 90;
    slot('sails')(180, 105, V.sails['a' + (Math.round(ang / 5) % 18)]);
  };
  /*RUNTIME*/
}
