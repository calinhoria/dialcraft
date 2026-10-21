// Beer Minute: the glass fills once a minute, the level following the seconds of the clock.
// Ten bubble frames are swapped and one cover (black above the surface, foam head under it) slides up, both from a timer;
// the glass reflections and the clock sit on top. Frames are reduced to 16 colours at export (optimizePng: 16).
const fs = require('fs');
const pre = `
const W = dev().w, H = dev().h;
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
`;
// Beer frames: 390x500, foam top at y=40. Thick flat head, calm surface, fine bubbles rising, faceted glass tint.
const beerJS = pre + `
const FH = 500, N = 10, S0 = 40, PER = 120, FOAM = 62;
const bub = Array.from({ length: 80 }, () => ({ x: 12 + rnd() * (W - 24), y: rnd() * PER, r: 0.9 + rnd() * 2.2 }));
const foamDots = Array.from({ length: 260 }, () => ({ x: rnd() * W, y: rnd() * (FOAM - 6), r: 1 + rnd() * 3.2 }));
for (let k = 0; k < N; k++) {
  const ph = 2 * Math.PI * k / N;
  const ys = (x) => S0 + 1.6 * Math.sin(2 * Math.PI * x / W - ph) + 0.8 * Math.sin(4 * Math.PI * x / W + 2 * ph);
  const c = mk(W, FH), g = c.getContext('2d');
  // beer body (starts under the foam, so no gap)
  g.beginPath(); g.moveTo(0, FH); g.lineTo(0, ys(0) + 20);
  for (let x = 0; x <= W; x += 6) g.lineTo(x, ys(x) + 20);
  g.lineTo(W, FH); g.closePath();
  const lg = g.createLinearGradient(0, S0, 0, FH);
  lg.addColorStop(0, '#ffa726'); lg.addColorStop(0.12, '#ff9419'); lg.addColorStop(0.4, '#f47d0e'); lg.addColorStop(0.75, '#d85f08'); lg.addColorStop(1, '#a03d04');
  g.fillStyle = lg; g.fill();
  g.save(); g.clip();
  // light glowing through the middle of the glass, deeper amber toward the walls and the base
  const rgl = g.createRadialGradient(W / 2, S0 + 150, 10, W / 2, S0 + 150, 330);
  rgl.addColorStop(0, 'rgba(255,170,50,0.5)'); rgl.addColorStop(0.45, 'rgba(255,140,30,0.16)'); rgl.addColorStop(1, 'rgba(150,60,0,0.0)');
  g.fillStyle = rgl; g.fillRect(0, S0, W, FH);
  const dg = g.createLinearGradient(0, FH - 190, 0, FH);
  dg.addColorStop(0, 'rgba(120,45,0,0)'); dg.addColorStop(1, 'rgba(105,38,0,0.55)');
  g.fillStyle = dg; g.fillRect(0, FH - 190, W, 190);
  // soft vertical striations, like the haze in a real pour
  seed = 41;
  for (let i = 0; i < 18; i++) {
    const x = rnd() * W, w = 10 + rnd() * 36, a = 0.04 + rnd() * 0.07, light = rnd() > 0.45;
    const sg = g.createLinearGradient(x - w, 0, x + w, 0);
    const col = light ? '255,170,60' : '120,45,0';
    sg.addColorStop(0, 'rgba(' + col + ',0)'); sg.addColorStop(0.5, 'rgba(' + col + ',' + a + ')'); sg.addColorStop(1, 'rgba(' + col + ',0)');
    g.fillStyle = sg; g.fillRect(x - w, S0, w * 2, FH);
  }
  // glass facets: ten soft vertical panels, as on a real mug
  const FW = W / 6;
  for (let i = 0; i < 6; i++) {
    const fgr = g.createLinearGradient(i * FW, 0, (i + 1) * FW, 0);
    fgr.addColorStop(0, 'rgba(255,190,90,0.07)'); fgr.addColorStop(0.5, 'rgba(255,190,90,0.03)'); fgr.addColorStop(1, 'rgba(120,45,0,0.07)');
    g.fillStyle = fgr; g.fillRect(i * FW, S0, FW, FH);
    g.fillStyle = 'rgba(110,40,0,0.08)'; g.fillRect(i * FW - 0.5, S0, 1.2, FH);
  }
  // glass thickness: edges darker
  const hg = g.createLinearGradient(0, 0, W, 0);
  hg.addColorStop(0, 'rgba(110,40,0,0.5)'); hg.addColorStop(0.1, 'rgba(110,40,0,0)'); hg.addColorStop(0.9, 'rgba(110,40,0,0)'); hg.addColorStop(1, 'rgba(110,40,0,0.5)');
  g.fillStyle = hg; g.fillRect(0, 0, W, FH);
  // fine bubbles rising 12 px/frame, wrapping every 120 px (seamless loop)
  for (const b of bub) {
    for (let t = ((b.y - k * 12) % PER + PER) % PER; t < FH; t += PER) {
      if (t < S0 + FOAM) continue;
      const bx = b.x + 1.5 * Math.sin((t + k * 12) / 30 + b.x);
      g.beginPath(); g.arc(bx, t, b.r, 0, 7); g.fillStyle = 'rgba(255,240,190,0.28)'; g.fill();
      g.lineWidth = 0.8; g.strokeStyle = 'rgba(255,248,215,0.7)'; g.stroke();
    }
  }
  g.restore();
  // thick white foam head with a soft fade into the beer
  const top = (x) => ys(x) - 1;
  g.beginPath(); g.moveTo(0, ys(0) + FOAM);
  for (let x = 0; x <= W; x += 4) g.lineTo(x, top(x) + 0.9 * Math.sin(x / 9 + ph));
  g.lineTo(W, ys(W) + FOAM);
  g.closePath();
  const fg = g.createLinearGradient(0, S0 - 4, 0, S0 + FOAM);
  fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.55, '#fffefb'); fg.addColorStop(0.85, '#fdf3dc'); fg.addColorStop(1, 'rgba(255,205,140,0.85)');
  g.fillStyle = fg; g.fill();
  g.save(); g.clip();
  for (const d of foamDots) {
    const y = ys(d.x) + 4 + d.y;
    g.beginPath(); g.arc(d.x, y, d.r, 0, 7);
    g.strokeStyle = 'rgba(214,190,150,0.30)'; g.lineWidth = 0.8; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fill();
  }
  g.restore();
  names.push(addProjectImage('beer_' + k + '.png', c, {}).name);
}
`;

const glassJS = pre + `
const c = mk(W, H), g = c.getContext('2d');
for (const left of [true, false]) {
  const g1 = g.createLinearGradient(left ? 0 : W, 0, left ? 16 : W - 16, 0);
  g1.addColorStop(0, 'rgba(215,235,245,0.40)'); g1.addColorStop(1, 'rgba(215,235,245,0)');
  g.fillStyle = g1; g.fillRect(left ? 0 : W - 16, 0, 16, H);
}
const refl = (x, y0, y1, w, a) => { const r = g.createLinearGradient(x, y0, x, y1); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.25, 'rgba(255,255,255,' + a + ')'); r.addColorStop(0.8, 'rgba(255,255,255,' + a + ')'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + w * 1.6, (y0 + y1) / 2, x, y1); g.quadraticCurveTo(x + w * 0.4, (y0 + y1) / 2, x, y0); g.fill(); };
refl(26, 30, 380, 6, 0.34); refl(40, 70, 330, 2.5, 0.2); refl(W - 28, 80, 340, 4, 0.16);
// rim
const rg = g.createLinearGradient(0, 0, 0, 12); rg.addColorStop(0, 'rgba(240,248,252,0.75)'); rg.addColorStop(1, 'rgba(240,248,252,0)');
g.fillStyle = rg; g.fillRect(0, 0, W, 12);
// heavy glass base
const bg2 = g.createLinearGradient(0, H - 52, 0, H); bg2.addColorStop(0, 'rgba(225,242,250,0)'); bg2.addColorStop(0.4, 'rgba(225,242,250,0.2)'); bg2.addColorStop(1, 'rgba(240,252,255,0.6)');
g.fillStyle = bg2; g.fillRect(0, H - 52, W, 52);
g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(14, H - 36); g.quadraticCurveTo(W / 2, H - 28, W - 14, H - 36); g.stroke();
// condensation droplets
seed = 23;
for (let i = 0; i < 70; i++) {
  const x = 10 + rnd() * (W - 20), y = 30 + rnd() * (H - 90), r = 0.9 + rnd() * 2.4;
  g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = 'rgba(255,255,255,0.10)'; g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.7; g.stroke();
  g.beginPath(); g.arc(x - r * 0.3, y - r * 0.35, Math.max(0.5, r * 0.3), 0, 7); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill();
}
names.push(addProjectImage('glass_front.png', c, {}).name);
`;


// Cover: one picture that slides up the screen. Black above the beer surface, the foam head under it.
// Drawn with the surface at y = 450 (glass empty); the watch moves it up with setProperty(MORE, { y }).
const coverJS = pre + `
const FOAM = 62, TOP = H, CH = H + FOAM + 8;
seed = 11;
const dots = Array.from({ length: 220 }, () => ({ x: rnd() * W, y: rnd() * (FOAM - 6), r: 1 + rnd() * 3.2 }));
const c = mk(W, CH), g = c.getContext('2d');
g.fillStyle = '#000'; g.fillRect(0, 0, W, TOP + 8);
g.beginPath(); g.moveTo(0, TOP + FOAM);
for (let x = 0; x <= W; x += 4) g.lineTo(x, TOP - 1 + 0.9 * Math.sin(x / 9));
g.lineTo(W, TOP + FOAM); g.closePath();
const fg = g.createLinearGradient(0, TOP - 4, 0, TOP + FOAM);
fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.55, '#fffefb'); fg.addColorStop(0.85, '#fdf3dc'); fg.addColorStop(1, 'rgba(255,205,140,0.85)');
g.fillStyle = fg; g.fill();
g.save(); g.clip();
for (const d of dots) { g.beginPath(); g.arc(d.x, TOP + 4 + d.y, d.r, 0, 7); g.strokeStyle = 'rgba(214,190,150,0.30)'; g.lineWidth = 0.8; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fill(); }
g.restore();
names.push(addProjectImage('cover.png', c, {}).name);
`;
const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const F = 'Bebas Neue';
// beer-gold digits: gradient fill, dark border and a soft shadow, one layer each
const face = (size) => ({ font: F, size, fill: 'gradient', from: '#ffd36b', to: '#ff8a00', angle: 90,
  borderColor: '#1c0b00', borderWidth: 4, shadowColor: '#000000', shadowX: 0, shadowY: 4, shadowBlur: 4 });
const dim = { font: F, size: 120, fill: 'solid', color: '#8a5a1a' };
const tag = (suffix) => ({ script: `const n = project.elements.length; for (const i of [n-3,n-2,n-1]) project.elements[i].name += ' ${suffix}'; return 1` });
const steps = [{ preset: 'bg' },
  // the 10 bubble frames: an Image layer with several pictures, swapped by the code below (handle: beer)
  wrap(beerJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Beer'; e.src = names[0]; e.images = names.slice(); e.handle = 'beer'; e.x = 0; e.y = 0; e.show = 'normal'; return names.length;`),
  // starts at the full-glass position (surface y = 40), which is also what the preview pictures show
  wrap(coverJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Cover'; e.src = names[0]; e.handle = 'cover'; e.x = 0; e.y = 40 - dev().h; e.show = 'normal'; return 1`),
  { preset: 'clock' }, tag('Main'), { preset: 'clock' }, tag('Aod'), { preset: 'weekday' }, { preset: 'day' }, { preset: 'temp' },
  wrap(glassJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Glass'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  { remove: 'Colon Aod' },
  { edit: 'Hour Main', set: { x: 45, y: 150, show: 'normal', zero: 1 }, glyph: face(150) },
  { edit: 'Colon Main', set: { x: 182, y: 167, show: 'normal' }, glyph: face(150) },
  { edit: 'Minute Main', set: { x: 214, y: 150, show: 'normal', zero: 1 }, glyph: face(150) },
  { edit: 'Hour Aod', set: { x: 60, y: 90, show: 'aod', zero: 1 }, glyph: dim },
  { edit: 'Minute Aod', set: { x: 60, y: 230, show: 'aod', zero: 1 }, glyph: dim },
  { edit: 'Weekday', set: { x: 134, y: 44, show: 'normal' }, glyph: face(46) },
  { edit: 'Day', set: { x: 206, y: 44, show: 'normal' }, glyph: face(46) },
  { edit: 'Temperature', set: { x: 155, y: 378, show: 'normal' }, glyph: face(58) },
  // the pictures the restyled digit sets left behind
  { script: `document.getElementById('btnPruneImages').click(); return project.images.length + ' images left'` },
];

// Runs on the watch (userCode). The glass fills once a minute: the cover slides up with the second of the minute and the beer
// picture cycles its bubble frames. Timer = timer.createTimer (setTimeout does not exist in a watchface).
const userImports = "import { Time as DCTime } from '@zos/sensor'";
const userCode = `{
  const MS = 100, TOP_EMPTY = 450, TOP_FULL = 40
  const NB = F.beer.length
  let n = 0, id = null, via = '', y = null, lastSec = -1, sub = 0, clock = null
  try { clock = new DCTime() } catch (e) {}
  // seconds of the minute from the Zepp Time sensor (else Date, else our own count)
  const seconds = () => {
    try { if (clock) { const s = clock.getSeconds(); if (typeof s === 'number' && s >= 0) return s } } catch (e) {}
    try { const s = new Date().getSeconds(); if (typeof s === 'number' && s >= 0) return s } catch (e) {}
    return Math.floor(n * MS / 1000) % 60
  }
  // the sensor only counts whole seconds, so the ticks since the second changed fill in the fraction
  const fraction = () => {
    const s = seconds()
    if (s !== lastSec) { lastSec = s; sub = 0 } else sub++
    return (s + Math.min(0.95, sub * MS / 1000)) / 60
  }
  const tick = () => {
    n++
    const ny = Math.round(TOP_EMPTY - (TOP_EMPTY - TOP_FULL) * fraction()) - TOP_EMPTY
    if (ny !== y) { y = ny; W.cover.setProperty(ui.prop.MORE, { x: 0, y: px(y) }) }
    W.beer.setProperty(ui.prop.SRC, F.beer[n % NB])
  }
  const stop = () => {
    if (id === null) return
    try { if (via === 't') timer.stopTimer(id); else clearInterval(id) } catch (e) {}
    id = null
  }
  const safe = () => { try { tick() } catch (e) {} }
  const start = () => {
    if (id !== null) return
    try {
      if (typeof timer !== 'undefined' && timer && timer.createTimer) { id = timer.createTimer(0, MS, safe); via = 't' }
      else if (typeof setInterval === 'function') { id = setInterval(safe, MS); via = 'i' }
    } catch (e) {}
  }
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: () => { lastSec = -1; start() }, pause_call: stop })
  safe()
  start()
}`;
// optimizePng 16: the bubble frames in 16 colours, every other picture only recompressed losslessly
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: 'Beer Minute', device: 'bip-6', font: F, description: 'A beer glass that fills over one minute, the level following the seconds: thick foam head, rising bubbles, the time in beer-gold.', preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/beer-minute', optimizePng: 16, userImports, userCode, steps }, null, 1));
