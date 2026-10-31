{
  // Meow clock: the Meoweather cat (walk, sit, lie, jump, dream, burp, poo) advanced every 100 ms; the clock and temperature are native layers
  const MS = 40;
  const D = /*PER*/[];
  /*V*/
  // the cat: the behaviour state machine of iDotMatrix-Meoweather (walk, sit, lie, jump, dream, burp, poo), advanced every 100 ms
  const OX = D.g[0], OY = D.g[1], CC = D.g[2], CF = D.g[3], TAILY = [1, 2, 1, 2];
  const CFG = { day: { wb: [15, 40], t: { sit: [0.15, 30, 80], lie: [0.08, 50, 120], jump: [0.06, 8, 8], burp: [0.04, 10, 14], poo: [0.02, 8, 10] } }, night: { wb: [3, 10], t: { sit: [0.08, 20, 50], lie: [0.2, 60, 120], dream: [0.5, 100, 180], burp: [0.02, 10, 12], poo: [0.01, 8, 10] } } };
  const ORDER = ['sit', 'lie', 'jump', 'dream', 'burp', 'poo'];
  const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const s = { x: 3, right: true, beh: 'walk', walkFrame: 0, bf: 0, tailPhase: 0, tailC: 0, eyes: false, blink: rnd(20, 40), budget: rnd(15, 40), dur: 0, step: 0, day: true, puke: [], poo: [] };
  const roll = () => {
    const cfg = s.day ? CFG.day : CFG.night, r = Math.random(); let cur = 0, nx = 'walk';
    for (const k of ORDER) { const t = cfg.t[k]; if (!t || t[0] <= 0) continue; cur += t[0]; if (r < cur) { nx = k; break; } }
    s.budget = rnd(cfg.wb[0], cfg.wb[1]);
    if (nx !== 'walk') { s.dur = rnd(cfg.t[nx][1], cfg.t[nx][2]); s.beh = nx; s.bf = 0; }
  };
  const timed = () => { s.bf++; if (s.bf >= s.dur) { s.beh = 'walk'; s.bf = 0; } };
  const adv = () => {
    const h = new Date().getHours(); s.day = h >= 7 && h < 20;
    for (const i of s.puke) i.ttl--; s.puke = s.puke.filter((i) => i.ttl > 0);
    for (const i of s.poo) i.ttl--; s.poo = s.poo.filter((i) => i.ttl > 0);
    if (++s.tailC >= 3) { s.tailPhase = (s.tailPhase + 1) % 4; s.tailC = 0; }
    s.blink--;
    if (s.blink <= 0) { s.eyes = s.blink > -2; if (s.blink <= -2) s.blink = rnd(25, 50); } else s.eyes = false;
    if (s.beh === 'walk') {
      if (++s.step < 2) return; s.step = 0;
      if (!s.day && s.x >= 22) s.right = false;
      s.x += s.right ? 1 : -1;
      if (s.x >= 24) { s.x = 24; s.right = false; }
      if (s.x <= 3) { s.x = 3; s.right = true; }
      s.walkFrame = (s.walkFrame + 1) % 2; s.budget--;
      if (s.budget <= 0) roll();
    } else if (s.beh === 'burp') {
      if (s.bf === 0) s.puke.push({ x: s.right ? s.x + 5 : s.x - 1, ttl: 1000 });
      timed();
    } else if (s.beh === 'poo') {
      if (s.bf === 0) s.poo.push({ x: s.right ? s.x : s.x + 4, ttl: 1000 });
      timed();
    } else timed();
  };
  const AB = 'AB';
  const drawCat = () => {
    let nm, tl = 0, yo = 0;
    switch (s.beh) {
      case 'walk': nm = (s.eyes ? 'BLINK_' : 'WALK_') + AB[s.walkFrame % 2]; tl = 1; break;
      case 'sit': nm = 'SIT_' + AB[Math.floor(s.bf / 20) % 2]; break;
      case 'lie': nm = 'LIE_' + AB[Math.floor(s.bf / 30) % 2]; tl = 1; yo = 1; break;
      case 'jump': { const j = Math.min(Math.floor(s.bf / 2), 3); nm = 'JUMP_' + (j + 1); yo = [1, 0, -1, 0][j]; tl = 1; break; }
      case 'dream': nm = 'DREAM'; break;
      case 'burp': nm = 'BURP_' + AB[Math.floor(s.bf / 4) % 2]; break;
      default: nm = 'POO_' + AB[Math.floor(s.bf / 4) % 2];
    }
    slot('cat')(OX + CC * s.x, OY + CC * (CF + yo), V.cat[nm + '_' + (s.right ? 'r' : 'm') + (s.day ? 'd' : 'n') + (tl ? TAILY[s.tailPhase] : 0)]);
    const fx = [], fl = CF + 3;
    if (s.beh === 'dream') { const ph = s.bf % 12, zx = s.x + 2; if (ph < 3) fx.push([zx, CF - 1, 'z']); else if (ph < 6) fx.push([zx + 1, CF - 2, 'z']); else if (ph < 9) fx.push([zx + 2, CF - 3, 'z']); }
    if (s.beh === 'burp' && s.bf < 3) { const mx = s.right ? s.x + 4 : s.x, dr = s.right ? 1 : -1; fx.push([mx, CF + 2, s.day ? 'g' : 'gn'], [mx + dr, fl, s.day ? 'g' : 'gn']); }
    for (const i of s.puke.slice(-3)) fx.push([i.x, fl, 'p' + (i.ttl >= 12 ? 0 : i.ttl >= 8 ? 1 : i.ttl >= 4 ? 2 : 3)]);
    for (const i of s.poo.slice(-3)) fx.push([i.x, fl, 'q' + (i.ttl >= 14 ? 0 : i.ttl >= 10 ? 1 : i.ttl >= 5 ? 2 : 3)]);
    for (let k = 0; k < 8; k++) { const e = fx[k]; if (e && e[0] >= 0 && e[0] < 32) slot('fx' + k)(OX + CC * e[0], OY + CC * e[1], V['fx' + k][e[2]]); else slot('fx' + k).hide(); }
  };
  let lastAdv = Math.floor(Date.now() / 100);
  const tick = () => {
    const n100 = Math.floor(Date.now() / 100);
    for (let k = Math.min(n100 - lastAdv, 5); k > 0; k--) adv();
    lastAdv = n100;
    drawCat();
  };
  /*RUNTIME*/
}
