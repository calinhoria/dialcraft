// Cola Galore: a glass of fizzy cola that fills over one minute, the level following the seconds (same mechanism as Beer Minute).
// Ten liquid frames (dark brown cola, fizz bubbles rising) and ten cover frames (Coke-red band above, beige fizz on the surface)
// are swapped by a timer while the cover slides up. Frames are reduced to 16 colours at export.
const fs = require('fs');
const NAME = 'Cola Galore', OUT = 'out/cola-galore', F = 'Bebas Neue';
const DESC = 'A glass of ice-cold cola that fills over one minute, the level following the seconds: dark brown cola with rising fizz, a tan head, a Coke-red band above, and a .';
const pre = `
const W = dev().w, H = dev().h;
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
`;
const liquidJS = pre + `
const FH = 500, N = 10, S0 = 40, PER = 120, FOAM = 20;
const bub = Array.from({ length: 120 }, () => ({ x: 10 + rnd() * (W - 20), y: rnd() * PER, r: 0.7 + rnd() * 1.7 }));
const fz = Array.from({ length: 200 }, () => ({ x: rnd() * W, y: rnd() * (FOAM - 6), r: 0.8 + rnd() * 2.6 }));
for (let k = 0; k < N; k++) {
  const ph = 2 * Math.PI * k / N;
  const ys = (x) => S0 + 2 * Math.sin(2 * Math.PI * x / W - ph) + 1 * Math.sin(4 * Math.PI * x / W + 2 * ph);
  const c = mk(W, FH), g = c.getContext('2d');
  g.beginPath(); g.moveTo(0, FH); g.lineTo(0, ys(0) + 6);
  for (let x = 0; x <= W; x += 6) g.lineTo(x, ys(x) + 6);
  g.lineTo(W, FH); g.closePath();
  const lg = g.createLinearGradient(0, S0, 0, FH);
  lg.addColorStop(0, '#4a1a08'); lg.addColorStop(0.25, '#2f0f05'); lg.addColorStop(0.65, '#1a0803'); lg.addColorStop(1, '#0a0301');
  g.fillStyle = lg; g.fill();
  g.save(); g.clip();
  const rg = g.createRadialGradient(W / 2, S0 + 230, 10, W / 2, S0 + 230, 330);
  rg.addColorStop(0, 'rgba(200,85,20,0.3)'); rg.addColorStop(0.5, 'rgba(160,60,10,0.12)'); rg.addColorStop(1, 'rgba(200,80,15,0)');
  g.fillStyle = rg; g.fillRect(0, S0, W, FH);
  seed = 41;
  for (let i = 0; i < 16; i++) {
    const x = rnd() * W, w = 10 + rnd() * 34, a = 0.05 + rnd() * 0.07, light = rnd() > 0.5;
    const sg = g.createLinearGradient(x - w, 0, x + w, 0), col = light ? '210,120,60' : '10,2,0';
    sg.addColorStop(0, 'rgba(' + col + ',0)'); sg.addColorStop(0.5, 'rgba(' + col + ',' + a + ')'); sg.addColorStop(1, 'rgba(' + col + ',0)');
    g.fillStyle = sg; g.fillRect(x - w, S0, w * 2, FH);
  }
  const hg = g.createLinearGradient(0, 0, W, 0);
  hg.addColorStop(0, 'rgba(8,2,0,0.6)'); hg.addColorStop(0.1, 'rgba(8,2,0,0)'); hg.addColorStop(0.9, 'rgba(8,2,0,0)'); hg.addColorStop(1, 'rgba(8,2,0,0.6)');
  g.fillStyle = hg; g.fillRect(0, 0, W, FH);
  // plenty of fizz, rising 12 px per frame (loops every 120 px)
  for (const b of bub) {
    for (let t = ((b.y - k * 12) % PER + PER) % PER; t < FH; t += PER) {
      if (t < S0 + FOAM) continue;
      const bx = b.x + 2 * Math.sin((t + k * 12) / 26 + b.x);
      g.beginPath(); g.arc(bx, t, b.r, 0, 7); g.fillStyle = 'rgba(255,225,215,0.22)'; g.fill();
      g.lineWidth = 0.9; g.strokeStyle = 'rgba(255,240,235,0.75)'; g.stroke();
    }
  }
  g.restore();
  // beige fizz head
  g.beginPath(); g.moveTo(0, ys(0) + FOAM);
  for (let x = 0; x <= W; x += 4) g.lineTo(x, ys(x) - 1 + 1.2 * Math.sin(x / 7 + ph));
  g.lineTo(W, ys(W) + FOAM); g.closePath();
  const fg = g.createLinearGradient(0, S0 - 4, 0, S0 + FOAM);
  fg.addColorStop(0, '#fff3e3'); fg.addColorStop(0.55, '#e9c9a4'); fg.addColorStop(1, 'rgba(120,55,22,0.9)');
  g.fillStyle = fg; g.fill();
  g.save(); g.clip();
  for (const d of fz) { g.beginPath(); g.arc(d.x, ys(d.x) + 3 + d.y, d.r, 0, 7); g.strokeStyle = 'rgba(190,120,100,0.4)'; g.lineWidth = 0.8; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fill(); }
  g.restore();
  names.push(addProjectImage('cola_' + k + '.png', c, {}).name);
}
`;
const coverJS = pre + `
const FOAM = 20, TOP = H, CH = H + FOAM + 8, NF = 10;
seed = 9;
const drops = Array.from({ length: 120 }, () => ({ x: rnd() * W, y: rnd() * (H - 10), r: 0.9 + rnd() * 2.4 }));
const fz = Array.from({ length: 160 }, () => ({ x: rnd() * W, y: rnd() * (FOAM - 6), r: 0.8 + rnd() * 2.6 }));
for (let k = 0; k < NF; k++) {
  const ph = 2 * Math.PI * k / NF;
  const c = mk(W, CH), g = c.getContext('2d');
  const rd = g.createRadialGradient(W * 0.85, -20, 10, W * 0.5, TOP * 0.5, TOP * 0.95);
  rd.addColorStop(0, '#f5434a'); rd.addColorStop(0.35, '#e8222a'); rd.addColorStop(1, '#b50f18');
  g.fillStyle = rd; g.fillRect(0, 0, W, TOP + 8);
  for (const d of drops) { g.beginPath(); g.arc(d.x, d.y, d.r, 0, 7); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fill(); g.lineWidth = 0.8; g.strokeStyle = 'rgba(255,255,255,0.4)'; g.stroke(); g.beginPath(); g.arc(d.x - d.r * 0.3, d.y - d.r * 0.35, Math.max(0.5, d.r * 0.3), 0, 7); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill(); }
  g.beginPath(); g.moveTo(0, TOP + FOAM);
  for (let x = 0; x <= W; x += 4) g.lineTo(x, TOP - 1 + 3 * Math.sin(x / 19 + ph) + 1.4 * Math.sin(x / 7 - 2 * ph));
  g.lineTo(W, TOP + FOAM); g.closePath();
  const fg = g.createLinearGradient(0, TOP - 4, 0, TOP + FOAM);
  fg.addColorStop(0, '#fff3e3'); fg.addColorStop(0.55, '#e9c9a4'); fg.addColorStop(1, 'rgba(120,55,22,0.9)');
  g.fillStyle = fg; g.fill();
  g.save(); g.clip();
  for (const d of fz) { const y = TOP + 3 + d.y + 2 * Math.sin(ph + d.x); g.beginPath(); g.arc(d.x + 1.5 * Math.sin(ph + d.y), y, d.r, 0, 7); g.strokeStyle = 'rgba(190,120,100,0.4)'; g.lineWidth = 0.8; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fill(); }
  g.restore();
  names.push(addProjectImage('cover_' + k + '.png', c, {}).name);
}
`;
const glassJS = pre + `
const c = mk(W, H), g = c.getContext('2d');
for (const left of [true, false]) {
  const g1 = g.createLinearGradient(left ? 0 : W, 0, left ? 16 : W - 16, 0);
  g1.addColorStop(0, 'rgba(255,225,220,0.4)'); g1.addColorStop(1, 'rgba(255,225,220,0)');
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
names.push(addProjectImage('glass_front.png', c, {}).name);
`;
const face = (size) => ({ font: F, size, fill: 'gradient', from: '#ffffff', to: '#ffd9d4', angle: 90,
  borderColor: '#4a0308', borderWidth: 1.5, shadowColor: '#000000', shadowX: 0, shadowY: 2, shadowBlur: 3 });
const dim = { font: F, size: 120, fill: 'solid', color: '#c24a48' };
const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const tag = (suffix) => ({ script: `const n = project.elements.length; for (const i of [n-3,n-2,n-1]) project.elements[i].name += ' ${suffix}'; return 1` });
const steps = [{ preset: 'bg' },
  wrap(liquidJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Liquid'; e.src = names[0]; e.images = names.slice(); e.handle = 'liquid'; e.x = 0; e.y = 0; e.show = 'normal'; return names.length;`),
  wrap(coverJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Cover'; e.src = names[0]; e.images = names.slice(); e.handle = 'cover'; e.x = 0; e.y = 40 - dev().h; e.show = 'normal'; return 1`),
  { preset: 'clock' }, tag('Main'), { preset: 'clock' }, tag('Aod'), { preset: 'weekday' }, { preset: 'day' }, { preset: 'temp' },
  wrap(glassJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Glass'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  { remove: 'Colon Aod' },
  { edit: 'Hour Main', set: { x: 41, y: 171, show: 'normal', zero: 1 }, glyph: face(150) },
  { edit: 'Colon Main', set: { x: 178, y: 188, show: 'normal' }, glyph: face(150) },
  { edit: 'Minute Main', set: { x: 210, y: 171, show: 'normal', zero: 1 }, glyph: face(150) },
  { edit: 'Hour Aod', set: { x: 140, y: 115, show: 'aod', zero: 1 }, glyph: dim },
  { edit: 'Minute Aod', set: { x: 142, y: 241, show: 'aod', zero: 1 }, glyph: dim },
  { edit: 'Weekday', set: { x: 134, y: 36, show: 'normal' }, glyph: face(46) },
  { edit: 'Day', set: { x: 206, y: 44, show: 'normal' }, glyph: face(46) },
  { edit: 'Temperature', set: { x: 155, y: 378, show: 'normal' }, glyph: face(58) },
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
