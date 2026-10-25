// Fanta Fizz: a glass of orange soda that fills over one minute, the level following the seconds (same mechanism as Beer Minute).
// Ten liquid frames (dark brown cola, fizz bubbles rising) and ten cover frames (Coke-red band above, beige fizz on the surface)
// are swapped by a timer while the cover slides up. Frames are reduced to 16 colours at export.
const fs = require('fs');
const NAME = 'Fanta Fizz', OUT = 'out/fanta-fizz', F = 'Bebas Neue';
const DESC = 'A glass of orange soda that fills over one minute, the level following the seconds: juicy orange with floating pulp and fizz, a summer-blue sky with orange slices above, and a blue clock, green leaves and green date, as on the bottle.';
const pre = `
const W = dev().w, H = dev().h;
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
const leaf = (g, x, y, len, rot, c1, c2) => { g.save(); g.translate(x, y); g.rotate(rot); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -len * 0.38, len, 0); g.quadraticCurveTo(len * 0.5, len * 0.38, 0, 0); const lg = g.createLinearGradient(0, -len * 0.3, 0, len * 0.3); lg.addColorStop(0, c1); lg.addColorStop(1, c2); g.fillStyle = lg; g.fill(); g.beginPath(); g.moveTo(0, 0); g.lineTo(len * 0.92, 0); g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,0.35)'; g.stroke(); g.restore(); };
`;
const liquidJS = pre + `
const FH = 500, N = 10, S0 = 40, PER = 120, FOAM = 20;
const bub = Array.from({ length: 110 }, () => ({ x: 10 + rnd() * (W - 20), y: rnd() * PER, r: 0.7 + rnd() * 1.7 }));
const pulp = Array.from({ length: 34 }, () => ({ x: 14 + rnd() * (W - 28), y: rnd() * PER, w: 5 + rnd() * 9, h: 2 + rnd() * 3, rot: rnd() * 3 }));
const fz = Array.from({ length: 160 }, () => ({ x: rnd() * W, y: rnd() * (FOAM - 6), r: 0.8 + rnd() * 2.2 }));
for (let k = 0; k < N; k++) {
  const ph = 2 * Math.PI * k / N;
  const ys = (x) => S0 + 2 * Math.sin(2 * Math.PI * x / W - ph) + 1 * Math.sin(4 * Math.PI * x / W + 2 * ph);
  const c = mk(W, FH), g = c.getContext('2d');
  g.beginPath(); g.moveTo(0, FH); g.lineTo(0, ys(0) + 6);
  for (let x = 0; x <= W; x += 6) g.lineTo(x, ys(x) + 6);
  g.lineTo(W, FH); g.closePath();
  const lg = g.createLinearGradient(0, S0, 0, FH);
  lg.addColorStop(0, '#ffb42a'); lg.addColorStop(0.25, '#ff9100'); lg.addColorStop(0.65, '#f26a00'); lg.addColorStop(1, '#c24a00');
  g.fillStyle = lg; g.fill();
  g.save(); g.clip();
  const rg = g.createRadialGradient(W / 2, S0 + 200, 10, W / 2, S0 + 200, 330);
  rg.addColorStop(0, 'rgba(255,225,90,0.5)'); rg.addColorStop(0.5, 'rgba(255,170,30,0.18)'); rg.addColorStop(1, 'rgba(255,170,30,0)');
  g.fillStyle = rg; g.fillRect(0, S0, W, FH);
  const hg = g.createLinearGradient(0, 0, W, 0);
  hg.addColorStop(0, 'rgba(140,50,0,0.45)'); hg.addColorStop(0.1, 'rgba(140,50,0,0)'); hg.addColorStop(0.9, 'rgba(140,50,0,0)'); hg.addColorStop(1, 'rgba(140,50,0,0.45)');
  g.fillStyle = hg; g.fillRect(0, 0, W, FH);
  // orange pulp drifting up 12 px per frame
  for (const p of pulp) for (let t = ((p.y - k * 12) % PER + PER) % PER; t < FH; t += PER) {
    if (t < S0 + 16) continue;
    g.save(); g.translate(p.x + 3 * Math.sin((t + k * 12) / 30 + p.x), t); g.rotate(p.rot + t / 50);
    g.beginPath(); g.ellipse(0, 0, p.w, p.h, 0, 0, 7); g.fillStyle = 'rgba(255,225,140,0.38)'; g.fill(); g.restore();
  }
  for (const b of bub) for (let t = ((b.y - k * 12) % PER + PER) % PER; t < FH; t += PER) {
    if (t < S0 + FOAM) continue;
    const bx = b.x + 2 * Math.sin((t + k * 12) / 26 + b.x);
    g.beginPath(); g.arc(bx, t, b.r, 0, 7); g.fillStyle = 'rgba(255,245,210,0.25)'; g.fill(); g.lineWidth = 0.8; g.strokeStyle = 'rgba(255,250,225,0.85)'; g.stroke();
  }
  g.restore();
  g.beginPath(); g.moveTo(0, ys(0) + FOAM);
  for (let x = 0; x <= W; x += 4) g.lineTo(x, ys(x) - 1 + 1.2 * Math.sin(x / 7 + ph));
  g.lineTo(W, ys(W) + FOAM); g.closePath();
  const fg = g.createLinearGradient(0, S0 - 4, 0, S0 + FOAM);
  fg.addColorStop(0, '#fffbe6'); fg.addColorStop(0.55, '#ffe2a6'); fg.addColorStop(1, 'rgba(255,150,30,0.9)');
  g.fillStyle = fg; g.fill(); g.save(); g.clip();
  for (const d of fz) { g.beginPath(); g.arc(d.x, ys(d.x) + 3 + d.y, d.r, 0, 7); g.strokeStyle = 'rgba(210,130,40,0.4)'; g.lineWidth = 0.8; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fill(); }
  g.restore();
  names.push(addProjectImage('fanta_' + k + '.png', c, {}).name);
}
`;
const coverJS = pre + `
const FOAM = 20, TOP = H, CH = H + FOAM + 8, NF = 10;
seed = 9;
const fz = Array.from({ length: 120 }, () => ({ x: rnd() * W, y: rnd() * (FOAM - 6), r: 0.8 + rnd() * 2.2 }));
const sl = Array.from({ length: 7 }, (_, i) => ({ x: 40 + rnd() * (W - 80), y: 40 + rnd() * (TOP - 120), r: 15 + rnd() * 10, rot: rnd() * 3, i }));
const dots = Array.from({ length: 40 }, () => ({ x: rnd() * W, y: rnd() * (TOP - 20), r: 1.5 + rnd() * 2.5 }));
for (let k = 0; k < NF; k++) {
  const ph = 2 * Math.PI * k / NF;
  const c = mk(W, CH), g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, TOP); sky.addColorStop(0, '#1b7fe8'); sky.addColorStop(0.6, '#5cc0ff'); sky.addColorStop(1, '#b5ecff');
  g.fillStyle = sky; g.fillRect(0, 0, W, TOP + 8);
  for (const [lx, ly, ll, lr, i] of [[-10, 60, 150, 0.2, 0], [380, 90, 140, 3.0, 1], [30, 220, 120, -0.5, 2], [370, 250, 130, 3.6, 3], [150, 20, 110, 0.9, 4], [250, 30, 100, 2.2, 5]]) leaf(g, lx, ly + 4 * Math.sin(ph + i), ll, lr + 0.05 * Math.sin(ph + i), i % 2 ? '#2f9c3c' : '#58c452', '#1f7a2e');
  for (const d of dots) { g.beginPath(); g.arc(d.x, d.y + 3 * Math.sin(ph + d.x), d.r, 0, 7); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fill(); }
  for (const s of sl) {
    g.save(); g.translate(s.x, s.y + 5 * Math.sin(ph + s.i * 1.3)); g.rotate(s.rot + 0.15 * Math.sin(ph + s.i));
    g.beginPath(); g.arc(0, 0, s.r, 0, 7); g.fillStyle = '#ffa31a'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#ff7a00'; g.stroke();
    g.beginPath(); g.arc(0, 0, s.r - 4, 0, 7); g.fillStyle = '#ffcb45'; g.fill();
    for (let q = 0; q < 8; q++) { g.beginPath(); g.moveTo(0, 0); g.lineTo((s.r - 4) * Math.cos(q * Math.PI / 4), (s.r - 4) * Math.sin(q * Math.PI / 4)); g.lineWidth = 1.5; g.strokeStyle = '#fff1c2'; g.stroke(); }
    g.restore();
  }
  g.beginPath(); g.moveTo(0, TOP + FOAM);
  for (let x = 0; x <= W; x += 4) g.lineTo(x, TOP - 1 + 3 * Math.sin(x / 19 + ph) + 1.4 * Math.sin(x / 7 - 2 * ph));
  g.lineTo(W, TOP + FOAM); g.closePath();
  const fg = g.createLinearGradient(0, TOP - 4, 0, TOP + FOAM);
  fg.addColorStop(0, '#fffbe6'); fg.addColorStop(0.55, '#ffe2a6'); fg.addColorStop(1, 'rgba(255,150,30,0.9)');
  g.fillStyle = fg; g.fill(); g.save(); g.clip();
  for (const d of fz) { const y = TOP + 3 + d.y + 2 * Math.sin(ph + d.x); g.beginPath(); g.arc(d.x + 1.5 * Math.sin(ph + d.y), y, d.r, 0, 7); g.strokeStyle = 'rgba(210,130,40,0.4)'; g.lineWidth = 0.8; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fill(); }
  g.restore();
  names.push(addProjectImage('cover_' + k + '.png', c, {}).name);
}
`;
const glassJS = pre + `
const c = mk(W, H), g = c.getContext('2d');
for (const left of [true, false]) {
  const g1 = g.createLinearGradient(left ? 0 : W, 0, left ? 16 : W - 16, 0);
  g1.addColorStop(0, 'rgba(255,235,200,0.42)'); g1.addColorStop(1, 'rgba(255,235,200,0)');
  g.fillStyle = g1; g.fillRect(left ? 0 : W - 16, 0, 16, H);
}
const refl = (x, y0, y1, w, a) => { const r = g.createLinearGradient(x, y0, x, y1); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.25, 'rgba(255,255,255,' + a + ')'); r.addColorStop(0.8, 'rgba(255,255,255,' + a + ')'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + w * 1.6, (y0 + y1) / 2, x, y1); g.quadraticCurveTo(x + w * 0.4, (y0 + y1) / 2, x, y0); g.fill(); };
refl(26, 30, 380, 6, 0.34); refl(40, 70, 330, 2.5, 0.2); refl(W - 28, 80, 340, 4, 0.16);
// condensation droplets, as on the cold glass in the photo
seed = 23;
for (let i = 0; i < 70; i++) {
  const x = 12 + rnd() * (W - 24), y = 40 + rnd() * (H - 130), r = 0.8 + rnd() * 1.8;
  g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 0.8; g.stroke();
  g.beginPath(); g.arc(x - r * 0.3, y - r * 0.35, Math.max(0.5, r * 0.3), 0, 7); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill();
}
const bg2 = g.createLinearGradient(0, H - 40, 0, H); bg2.addColorStop(0, 'rgba(255,230,225,0)'); bg2.addColorStop(1, 'rgba(255,230,225,0.45)');
g.fillStyle = bg2; g.fillRect(0, H - 40, W, 40);
[[8, 330, 70, -0.9], [8, 150, 64, 0.6], [382, 190, 70, 3.8], [382, 360, 66, 2.5]].forEach(([x, y, l, r], i) => leaf(g, x, y, l, r, i % 2 ? '#3aa845' : '#63cf58', '#1d7a2c'));
names.push(addProjectImage('glass_front.png', c, {}).name);
`;
const mkT = (from, to, border, bw = 1.5) => (size) => ({ font: F, size, fill: 'gradient', from, to, angle: 90, borderColor: border, borderWidth: bw, shadowColor: '#000000', shadowX: 0, shadowY: 2, shadowBlur: 3 });
const T = {
  hour: mkT('#3a74f0', '#1537a8', '#ffffff', 3),
  minute: mkT('#3a74f0', '#1537a8', '#ffffff', 3),
  colon: mkT('#3a74f0', '#1537a8', '#ffffff', 3),
  week: mkT('#d4ff7a', '#4fc63c', '#0d5a1c'),
  day: mkT('#d4ff7a', '#4fc63c', '#0d5a1c'),
  temp: mkT('#d4ff7a', '#4fc63c', '#0d5a1c'),
};
const dim = { font: F, size: 120, fill: 'solid', color: '#4a7ae0' };
const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const tag = (suffix) => ({ script: `const n = project.elements.length; for (const i of [n-3,n-2,n-1]) project.elements[i].name += ' ${suffix}'; return 1` });
const steps = [{ preset: 'bg' },
  wrap(liquidJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Liquid'; e.src = names[0]; e.images = names.slice(); e.handle = 'liquid'; e.x = 0; e.y = 0; e.show = 'normal'; return names.length;`),
  wrap(coverJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Cover'; e.src = names[0]; e.images = names.slice(); e.handle = 'cover'; e.x = 0; e.y = 40 - dev().h; e.show = 'normal'; return 1`),
  { preset: 'clock' }, tag('Main'), { preset: 'clock' }, tag('Aod'), { preset: 'weekday' }, { preset: 'day' }, { preset: 'temp' },
  wrap(glassJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Glass'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  { remove: 'Colon Aod' },
  { edit: 'Hour Main', set: { x: 41, y: 171, show: 'normal', zero: 1 }, glyph: T.hour(150) },
  { edit: 'Colon Main', set: { x: 178, y: 188, show: 'normal' }, glyph: T.colon(150) },
  { edit: 'Minute Main', set: { x: 210, y: 171, show: 'normal', zero: 1 }, glyph: T.minute(150) },
  { edit: 'Hour Aod', set: { x: 140, y: 115, show: 'aod', zero: 1 }, glyph: dim },
  { edit: 'Minute Aod', set: { x: 142, y: 241, show: 'aod', zero: 1 }, glyph: dim },
  { edit: 'Weekday', set: { x: 134, y: 36, show: 'normal' }, glyph: T.week(46) },
  { edit: 'Day', set: { x: 206, y: 44, show: 'normal' }, glyph: T.day(46) },
  { edit: 'Temperature', set: { x: 155, y: 378, show: 'normal' }, glyph: T.temp(58) },
  // weekday names of any length: right-aligned in their cell, fixed ink gap to the day number, shared baseline (kit dateRow)
  { script: fs.readFileSync(__dirname + '/../../.claude/skills/create-amazfit-watchface/examples/animated/kit.js', 'utf8') + `
const wd = E('Weekday'); wd.labelAlign = 'right'; rerenderGlyphLayers(); await loadAllImages();
park(['Weekday', 'Day']); await dateRow(195, 63, 14); shift(['Weekday'], 0, 1); return 1` },
  // named groups
  { script: `project.groups = project.groups || {}; let n = 0;
for (const [k, v] of Object.entries(project.groups)) if (v === 'Clock 2') project.groups[k] = 'Clock AOD';
project.groups.gDate = 'Date'; for (const nm of ['Weekday', 'Day']) { const e = project.elements.find((x) => x.name === nm); if (e) { e.group = 'gDate'; n++ } } return n` },
  { script: `document.getElementById('btnPruneImages').click(); return project.images.length + ' images left'` },
];
const rec = JSON.parse(fs.readFileSync(__dirname + '/../beer-minute/recipe.json', 'utf8'));
const userCode = rec.userCode.replace(/F\.beer/g, 'F.liquid').replace(/W\.beer/g, 'W.liquid');
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: NAME, device: 'bip-6', font: F, description: DESC, preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: OUT, optimizePng: 16, userImports: rec.userImports, userCode, steps }, null, 1));
