// Sparkling Water: a glass of fizzy water that fills over one minute, the level following the seconds.
// The water is one translucent sprite (10 frames: drifting caustics, rising bubbles, twinkling sparkles) that the code moves up the
// screen and swaps; it sits ABOVE the clock layers, so once the glass is full the time and the date are under water.
const fs = require('fs');
const NAME = 'Sparkling Water', OUT = 'out/sparkling-water', F = 'Bebas Neue';
const DESC = 'A glass of sparkling water that fills over one minute, the level following the seconds: rising bubbles, twinkling sparkles, and when it is full the time and date are under water.';
const pre = `
const W = dev().w, H = dev().h;
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
const spark = (g, x, y, r, a) => { g.save(); g.translate(x, y); g.fillStyle = 'rgba(255,255,255,' + a + ')'; g.beginPath(); g.moveTo(0, -r); g.quadraticCurveTo(0, 0, r, 0); g.quadraticCurveTo(0, 0, 0, r); g.quadraticCurveTo(0, 0, -r, 0); g.quadraticCurveTo(0, 0, 0, -r); g.fill(); g.restore(); };
`;
// the sky behind the glass: deep teal with soft light rays and a few stars
const skyJS = pre + `
const c = mk(W, H), g = c.getContext('2d');
const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0a3550'); bg.addColorStop(0.5, '#0e6a86'); bg.addColorStop(1, '#06283c');
g.fillStyle = bg; g.fillRect(0, 0, W, H);
for (let i = 0; i < 6; i++) { const x = 20 + i * 70, lg = g.createLinearGradient(x, 0, x + 120, H); lg.addColorStop(0, 'rgba(160,240,255,0.16)'); lg.addColorStop(1, 'rgba(160,240,255,0)'); g.fillStyle = lg; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 36, 0); g.lineTo(x + 170, H); g.lineTo(x + 100, H); g.closePath(); g.fill(); }
seed = 3; for (let i = 0; i < 22; i++) spark(g, rnd() * W, rnd() * 260, 2 + rnd() * 3.5, 0.5 + rnd() * 0.4);
names.push(addProjectImage('sky.png', c, {}).name);
`;
const waterJS = pre + `
const IH = 420, N = 10, SY = 8, PER = 120;
const bub = Array.from({ length: 110 }, () => ({ x: 8 + rnd() * (W - 16), y: rnd() * PER, r: 0.8 + rnd() * 2.2 }));
const sp = Array.from({ length: 16 }, () => ({ x: 14 + rnd() * (W - 28), y: 30 + rnd() * (IH - 60), r: 3 + rnd() * 4.5, p: rnd() * 6.28 }));
for (let k = 0; k < N; k++) {
  const ph = 2 * Math.PI * k / N;
  const ys = (x) => SY + 2.4 * Math.sin(2 * Math.PI * x / W - ph) + 1.2 * Math.sin(4 * Math.PI * x / W + 2 * ph);
  const c = mk(W, IH), g = c.getContext('2d');
  g.beginPath(); g.moveTo(0, IH); g.lineTo(0, ys(0));
  for (let x = 0; x <= W; x += 5) g.lineTo(x, ys(x));
  g.lineTo(W, IH); g.closePath();
  const lg = g.createLinearGradient(0, 0, 0, IH);
  lg.addColorStop(0, 'rgba(150,235,255,0.30)'); lg.addColorStop(0.5, 'rgba(60,180,225,0.34)'); lg.addColorStop(1, 'rgba(15,105,160,0.45)');
  g.fillStyle = lg; g.fill();
  g.save(); g.clip();
  // caustics: soft light ribbons drifting with the frame
  for (let r = 0; r < 6; r++) {
    g.beginPath();
    for (let y = 0; y <= IH; y += 8) { const x = W * (0.1 + 0.16 * r) + Math.sin(y / 40 + ph + r) * 34; y ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.lineWidth = 16 + (r % 3) * 8; g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,0.07)'; g.stroke();
  }
  // fine bubbles rising 12 px per frame (loops every 120 px)
  for (const b of bub) {
    for (let t = ((b.y - k * 12) % PER + PER) % PER; t < IH; t += PER) {
      if (t < SY + 12) continue;
      const bx = b.x + 2 * Math.sin((t + k * 12) / 24 + b.x);
      g.beginPath(); g.arc(bx, t, b.r, 0, 7); g.fillStyle = 'rgba(255,255,255,0.2)'; g.fill();
      g.lineWidth = 0.8; g.strokeStyle = 'rgba(255,255,255,0.8)'; g.stroke();
    }
  }
  // twinkling sparkles
  for (const s of sp) spark(g, s.x, s.y, s.r, 0.25 + 0.7 * Math.max(0, Math.sin(ph + s.p)));
  g.restore();
  // bright surface line and a soft band under it
  g.beginPath(); for (let x = 0; x <= W; x += 5) { const y = ys(x) + 1; x ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.stroke();
  g.beginPath(); for (let x = 0; x <= W; x += 5) { const y = ys(x) + 8; x ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,0.16)'; g.stroke();
  names.push(addProjectImage('water_' + k + '.png', c, {}).name);
}
`;
const glassJS = pre + `
const c = mk(W, H), g = c.getContext('2d');
for (const left of [true, false]) {
  const g1 = g.createLinearGradient(left ? 0 : W, 0, left ? 18 : W - 18, 0);
  g1.addColorStop(0, 'rgba(220,250,255,0.4)'); g1.addColorStop(1, 'rgba(220,250,255,0)');
  g.fillStyle = g1; g.fillRect(left ? 0 : W - 18, 0, 18, H);
}
const refl = (x, y0, y1, w, a) => { const r = g.createLinearGradient(x, y0, x, y1); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.25, 'rgba(255,255,255,' + a + ')'); r.addColorStop(0.8, 'rgba(255,255,255,' + a + ')'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + w * 1.6, (y0 + y1) / 2, x, y1); g.quadraticCurveTo(x + w * 0.4, (y0 + y1) / 2, x, y0); g.fill(); };
refl(26, 30, 380, 6, 0.3); refl(40, 70, 330, 2.5, 0.2); refl(W - 28, 80, 340, 4, 0.16);
const bg2 = g.createLinearGradient(0, H - 40, 0, H); bg2.addColorStop(0, 'rgba(220,250,255,0)'); bg2.addColorStop(1, 'rgba(220,250,255,0.4)');
g.fillStyle = bg2; g.fillRect(0, H - 40, W, 40);
seed = 23;
for (let i = 0; i < 50; i++) {
  const x = 12 + rnd() * (W - 24), y = 30 + rnd() * (H - 90), r = 0.8 + rnd() * 1.8;
  g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 0.8; g.stroke();
  g.beginPath(); g.arc(x - r * 0.3, y - r * 0.35, Math.max(0.5, r * 0.3), 0, 7); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill();
}
names.push(addProjectImage('glass_front.png', c, {}).name);
`;
const face = (size) => ({ font: F, size, fill: 'gradient', from: '#ffffff', to: '#c4f1ff', angle: 90,
  borderColor: '#06324a', borderWidth: 1.5, shadowColor: '#00131f', shadowX: 0, shadowY: 2, shadowBlur: 3 });
const dim = { font: F, size: 120, fill: 'solid', color: '#4f9bb5' };
const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const tag = (suffix) => ({ script: `const n = project.elements.length; for (const i of [n-3,n-2,n-1]) project.elements[i].name += ' ${suffix}'; return 1` });
const steps = [{ preset: 'bg' },
  wrap(skyJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Sky'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  { preset: 'clock' }, tag('Main'), { preset: 'clock' }, tag('Aod'), { preset: 'weekday' }, { preset: 'day' }, { preset: 'temp' },
  // the water goes ABOVE the clock layers: when the glass is full the time and date are under water. Surface at y = 40 when full.
  wrap(waterJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Water'; e.src = names[0]; e.images = names.slice(); e.handle = 'liquid'; e.x = 0; e.y = 32; e.show = 'normal'; return names.length;`),
  wrap(glassJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Glass'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  { remove: 'Colon Aod' },
  { edit: 'Hour Main', set: { x: 41, y: 171, show: 'normal', zero: 1 }, glyph: face(150) },
  { edit: 'Colon Main', set: { x: 178, y: 188, show: 'normal' }, glyph: face(150) },
  { edit: 'Minute Main', set: { x: 210, y: 171, show: 'normal', zero: 1 }, glyph: face(150) },
  { edit: 'Hour Aod', set: { x: 140, y: 115, show: 'aod', zero: 1 }, glyph: dim },
  { edit: 'Minute Aod', set: { x: 142, y: 241, show: 'aod', zero: 1 }, glyph: dim },
  { edit: 'Weekday', set: { x: 134, y: 44, show: 'normal' }, glyph: face(46) },
  { edit: 'Day', set: { x: 206, y: 44, show: 'normal' }, glyph: face(46) },
  { edit: 'Temperature', set: { x: 155, y: 378, show: 'normal' }, glyph: face(58) },
  { script: fs.readFileSync(__dirname + '/../../.claude/skills/create-amazfit-watchface/examples/animated/kit.js', 'utf8') + `
const wd = E('Weekday'); wd.labelAlign = 'right'; rerenderGlyphLayers(); await loadAllImages();
park(['Weekday', 'Day']); await dateRow(195, 63, 14); shift(['Weekday'], 0, 1); return 1` },
  { script: `project.groups = project.groups || {}; let n = 0;
for (const [k, v] of Object.entries(project.groups)) if (v === 'Clock 2') project.groups[k] = 'Clock AOD';
project.groups.gDate = 'Date'; for (const nm of ['Weekday', 'Day']) { const e = project.elements.find((x) => x.name === nm); if (e) { e.group = 'gDate'; n++ } } return n` },
  { script: `document.getElementById('btnPruneImages').click(); return project.images.length + ' images left'` },
];
// Runs on the watch: the water sprite rises with the seconds of the minute and cycles its frames.
const rec = JSON.parse(fs.readFileSync(__dirname + '/../beer-minute/recipe.json', 'utf8'));
const userCode = rec.userCode
  .replace(/TOP_EMPTY = 450, TOP_FULL = 40/, 'TOP_EMPTY = 448, TOP_FULL = 32')
  .replace(/F\.beer/g, 'F.liquid')
  .replace(/const ny = [^\n]*\n/, 'const ny = Math.round(TOP_EMPTY - (TOP_EMPTY - TOP_FULL) * fraction())\n')
  .replace(/\n\s*W\.cover\.setProperty[^\n]*/, '')
  .replace(/W\.beer\.setProperty\(ui\.prop\.MORE, \{ x: 0, y: 0, src/, 'W.liquid.setProperty(ui.prop.MORE, { x: 0, y: pxv(y), src');
if (/cover|beer/.test(userCode)) throw new Error('userCode still mentions cover/beer');
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: NAME, device: 'bip-6', font: F, description: DESC, preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: OUT, optimizePng: 16, userImports: rec.userImports, userCode, steps }, null, 1));
