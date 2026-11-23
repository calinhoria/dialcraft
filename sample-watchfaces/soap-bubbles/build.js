// Soap Bubbles: a dusk-coloured scene with a giant bubble around the time, twelve see-through bubbles (pictures with a real alpha channel, so you see through them)
// that float up with a gentle sway and pop into a burst of droplets at the top (or when tapped), sparkles that twinkle, three bubble badges for battery, steps and
// temperature. The time, date and readings are native layers; the code only moves the bubble pictures and swaps the pop / sparkle pictures. Always-on: the outline time only.
const GEO = __GEO__;
const P = GEO.pos, Z = GEO.size, N = GEO.names;
const ph = (name, [w, h]) => addProjectImage(name, mk(w, h), { replace: true });
const SIZE = { bg: [W, H], colon: Z.colon, colon_a: Z.colon, tdeg: Z.tdeg, tminus: Z.tminus };
for (const k of Object.keys(Z)) if (/^(b_|badge_|ic_)/.test(k)) SIZE[k] = Z[k];
for (const k of ['c', 'a']) for (let d = 0; d < 10; d++) SIZE[k + d] = Z.c;
for (let d = 0; d < 10; d++) { SIZE['d' + d] = Z.d; SIZE['t' + d] = Z.t; }
for (let i = 0; i < 7; i++) SIZE['w' + i] = Z.w;
for (let i = 0; i < 5; i++) { SIZE['pa_' + i] = Z.pa; SIZE['pb_' + i] = Z.pb; }
for (let i = 0; i < 4; i++) SIZE['sp_' + i] = Z.sp;
for (const [n, sz] of Object.entries(SIZE)) ph('sb/' + n + '.png', sz);
const els = [];
const add = (kind, patch) => { const e = newElement(kind, Object.assign({ show: 'normal' }, patch)); project.elements.push(e); els.push(e); return e; };
add('IMG', { name: 'Scene', src: 'sb/bg.png', x: 0, y: 0 });
// the twelve floating bubbles (code moves them; the numbers in geometry.json are the start positions, so the face begins exactly like this preview)
const FRONT = [2, 4];   // two bubbles drift in front of the clock now and then, the others stay behind it
const bubbleEl = (s, i) => add('IMG', { name: 'Bubble ' + (i + 1), src: 'sb/b_' + s.key + '.png', x: Math.round(s.cx - s.D / 2), y: Math.round(s.cy - s.D / 2), w: 0, h: 0, handle: 'bb' + i });
GEO.sprites.forEach((s, i) => { if (!FRONT.includes(i)) bubbleEl(s, i); });
// the sparkles: a slot of blank + three sizes, swapped by the code
GEO.sparks.forEach((p, i) => add('IMG', { name: 'Sparkle ' + (i + 1), src: N.sp[0], images: N.sp, x: p[0], y: p[1], handle: 'sp' + i }));
// the clock, the date, the three badges
add('IMG_TIME', { name: 'Hour', part: 'hour', images: N.c, zero: 1, space: 0, x: P.hour[0], y: P.hour[1] });
add('IMG', { name: 'Colon', src: 'sb/colon.png', x: P.colon[0], y: P.colon[1], w: 0, h: 0 });
add('IMG_TIME', { name: 'Minute', part: 'minute', images: N.c, zero: 1, space: 0, x: P.minute[0], y: P.minute[1] });
add('IMG_WEEK', { name: 'Weekday', images: N.w, x: P.week[0], y: P.week[1] });
add('IMG_DATE', { name: 'Day', part: 'day', images: N.d, zero: 0, space: 0, x: P.day[0], y: P.day[1] });
const BAD = Z.badge_bat[0], TY = 60, IY = 20;
const KIND = { bat: ['Battery', 'BATTERY'], step: ['Steps', 'STEP'], temp: ['Temperature', 'WEATHER_CURRENT'] };
for (const b of GEO.badges) {
  const [nm, dt] = KIND[b.k]; const ic = Z['ic_' + b.k];
  add('IMG', { name: nm + ' bubble', src: 'sb/badge_' + b.k + '.png', x: b.x, y: b.y, w: 0, h: 0 });
  add('IMG', { name: nm + ' icon', src: 'sb/ic_' + b.k + '.png', x: b.x + Math.round((BAD - ic[0]) / 2), y: b.y + IY, w: 0, h: 0 });
  add('TEXT_IMG', Object.assign({ name: nm, dataType: dt, images: N.t, hSpace: 0, alignH: 'CENTER_H', x: b.x, y: b.y + TY, w: BAD }, b.k === 'temp' ? { unit: 'sb/tdeg.png', negative: 'sb/tminus.png' } : {}));
}
// the pop bursts (two sizes, two slots each) and the tap catcher sit on top of everything
FRONT.forEach((i) => bubbleEl(GEO.sprites[i], i));       // above the clock, the date and the badges: you see them through the bubble
for (const [key, n] of [['pa', 2], ['pb', 2]]) for (let i = 0; i < n; i++) add('IMG', { name: 'Pop ' + key + (i + 1), src: N[key][0], images: N[key], x: 120, y: 120, handle: key + i });
add('CANVAS', { name: 'Tap catcher', x: 0, y: 0, w: W, h: H, handle: 'tap' });
// always-on: the outline time, centred
const aW = 4 * Z.c[0] + Z.colon[0], aX = Math.round((W - aW) / 2), aY = Math.round(H / 2 - Z.c[1] / 2);
add('IMG_TIME', { name: 'Hour AOD', part: 'hour', images: N.a, zero: 1, space: 0, x: aX, y: aY, show: 'aod' });
add('IMG', { name: 'Colon AOD', src: 'sb/colon_a.png', x: aX + 2 * Z.c[0], y: aY, w: 0, h: 0, show: 'aod' });
add('IMG_TIME', { name: 'Minute AOD', part: 'minute', images: N.a, zero: 1, space: 0, x: aX + 2 * Z.c[0] + Z.colon[0], y: aY, show: 'aod' });
project.userCode = `// <bubbles>
// Twelve bubbles rise and sway; at the top they pop (a burst of droplets), and a new one floats up from below. A tap on a bubble pops it. Sparkles twinkle now and then.
// A real wake-up blows all the bubbles in again from below. Only the picture position changes; every bubble is a see-through picture.
{
  const FRONT = __FRONT__, S = __SPRITES__, SPK = __SPARKS__;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const B = S.map((s, i) => ({ w: W['bb' + i], D: s.D, v: s.v, amp: s.amp, sw: s.w, ph: s.ph, bx: s.cx - s.amp * Math.sin(s.ph), y0: s.cy, t0: 0, at: 0, popY: Math.max(8, s.cy - rnd(30, 90)), lx: -999, ly: -999, on: true, front: FRONT.includes(i) }));
  const POPS = { pa: [0, 1].map((i) => ({ w: W['pa' + i], f: F['pa' + i], t: 0, x: 0, y: 0, busy: false })), pb: [0, 1].map((i) => ({ w: W['pb' + i], f: F['pb' + i], t: 0, x: 0, y: 0, busy: false })) };
  const SPA = SPK.map((p, i) => ({ w: W['sp' + i], f: F['sp' + i], t: 0, next: 0, step: -1, last: -1 }));
  const FR = [1, 2, 3, 4, 0], FT = [60, 70, 80, 90, 0];
  let timer = null, tStart = 0, pausedAt = 0, startedAt = 0, ticks = 0;
  const pop = (b, now) => {
    const kind = b.D >= 90 ? 'pa' : 'pb', pl = POPS[kind], sz = kind === 'pa' ? 160 : 96;
    const q = pl[0].busy ? pl[1] : pl[0]; q.busy = true; q.t = now; q.x = Math.round(b.lx + b.D / 2 - sz / 2); q.y = Math.round(b.ly + b.D / 2 - sz / 2); q.step = -1;
    b.on = false; b.w.setProperty(ui.prop.MORE, { x: pxv(0), y: pxv(470) }); b.lx = -999; b.ly = -999
    b.at = now + (b.front ? rnd(6000, 16000) : rnd(300, 1800)); b.popY = b.front ? rnd(15, 90) : rnd(20, 210)
  }
  const launch = (b, now) => { b.bx = b.front ? rnd(100, 290) : rnd(48, 342); b.y0 = 450 + b.D / 2 + rnd(0, 25); b.t0 = now; b.on = true }
  const place = (b, now) => {
    const sec = (now - tStart) / 1000, cy = b.y0 - b.v * (now - b.t0) / 1000, cx = b.bx + b.amp * Math.sin(b.ph + b.sw * sec);
    const x = Math.round(cx - b.D / 2), y = Math.round(cy - b.D / 2)
    if (x !== b.lx || y !== b.ly) { b.lx = x; b.ly = y; b.w.setProperty(ui.prop.MORE, { x: pxv(x), y: pxv(y) }) }
    return cy
  }
  const tick = () => {
    timer = null
    const now = Date.now()
    try {
      for (const b of B) {
        if (!b.on) { if (now >= b.at) { launch(b, now); place(b, now) } continue }
        const cy = place(b, now)
        if (cy < b.popY) pop(b, now)
      }
      for (const k of ['pa', 'pb']) for (const q of POPS[k]) {
        if (!q.busy) continue
        const st = Math.min(4, Math.floor((now - q.t) / 75))
        if (st !== q.step) { q.step = st; q.w.setProperty(ui.prop.MORE, { x: pxv(q.x), y: pxv(q.y), src: q.f[FR[st]] }); if (st >= 4) q.busy = false }
      }
      const SEQ = [1, 2, 3, 2, 1, 0]
      for (const s of SPA) {
        if (s.next === 0) s.next = now + rnd(200, 3500)
        if (s.step < 0 && now >= s.next) { s.step = 0; s.t = now }
        if (s.step >= 0) {
          const k = Math.floor((now - s.t) / 110)
          if (k >= SEQ.length) { s.step = -1; s.next = now + rnd(1500, 5000); if (s.last !== 0) { s.last = 0; s.w.setProperty(ui.prop.MORE, { x: pxv(s.x), y: pxv(s.y), src: s.f[0] }) } }
          else if (SEQ[k] !== s.last) { s.last = SEQ[k]; s.w.setProperty(ui.prop.MORE, { x: pxv(s.x), y: pxv(s.y), src: s.f[SEQ[k]] }) }
        }
      }
    } catch (e) { return }
    timer = setTimeout(tick, Math.max(0, 45 - (Date.now() - now)))
  }
  SPA.forEach((s, i) => { s.x = SPK[i][0]; s.y = SPK[i][1] })
  const stop = () => { if (timer) { try { clearTimeout(timer) } catch (e) {} timer = null } }
  const start = (blow) => {
    stop(); startedAt = Date.now(); const now = startedAt
    if (blow) { tStart = now; B.forEach((b, i) => { b.on = false; b.at = now + i * 160 + rnd(0, 200); b.w.setProperty(ui.prop.MORE, { x: pxv(0), y: pxv(470) }); b.lx = -999 }) }
    else { tStart = now; B.forEach((b) => { b.t0 = now; b.lx = -999 }) }
    for (const s of SPA) s.next = 0
    tick()
  }
  const hit = (info) => {
    const now = Date.now(); let best = null, bd = 1e9
    for (const b of B) { if (!b.on) continue; const dx = info.x - (b.lx + b.D / 2), dy = info.y - (b.ly + b.D / 2), d = Math.sqrt(dx * dx + dy * dy); if (d < b.D / 2 + 8 && d < bd) { bd = d; best = b } }
    if (best) { pop(best, now); best.at = now + 700 + rnd(0, 900) }
  }
  try { W.tap.addEventListener(ui.event.CLICK_UP, hit) } catch (e) {}
  const WAKE_GAP = 8000
  const onPause = () => { if (Date.now() - startedAt < 1500) return; pausedAt = Date.now(); stop() }
  const onResume = () => { const n = Date.now(); if (n - startedAt < 1500) return; if (n - pausedAt >= WAKE_GAP) { start(true); return } tick() }
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { pause_call: onPause, resume_call: onResume })
  start(false)
}
// </bubbles>
`.replace('__FRONT__', JSON.stringify(FRONT)).replace('__SPRITES__', JSON.stringify(GEO.sprites)).replace('__SPARKS__', JSON.stringify(GEO.sparks));
project.groups = project.groups || {};
const grp = (id, name, names) => { project.groups[id] = name; for (const n of names) { const e = els.find((x) => x.name === n); if (e) e.group = id; } };
grp('gClock', 'Clock', ['Hour', 'Colon', 'Minute']);
grp('gDate', 'Date', ['Weekday', 'Day']);
grp('gBub', 'Bubbles', GEO.sprites.map((s, i) => 'Bubble ' + (i + 1)));
grp('gSpk', 'Sparkles', GEO.sparks.map((s, i) => 'Sparkle ' + (i + 1)));
for (const [id, nm] of [['gB1', 'Battery'], ['gB2', 'Steps'], ['gB3', 'Temperature']]) grp(id, nm + ' badge', [nm + ' bubble', nm + ' icon', nm]);
grp('gPop', 'Pops and taps', ['Pop pa1', 'Pop pa2', 'Pop pb1', 'Pop pb2', 'Tap catcher']);
grp('gAod', 'Always-on', ['Hour AOD', 'Colon AOD', 'Minute AOD']);
return project.elements.map((x) => x.name).join(', ');
