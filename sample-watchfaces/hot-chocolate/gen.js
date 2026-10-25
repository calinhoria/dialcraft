// Hot Chocolate: a mug that fills over one minute, the level following the seconds (same mechanism as Beer Minute).
// Ten liquid frames (swirling cocoa, sprinkles and stars rising) and ten cover frames (candy sky above, whipped cream on the surface)
// are swapped by a timer while the cover slides up. Frames are reduced to 16 colours at export.
const fs = require('fs');
const NAME = 'Hot Chocolate', OUT = 'out/hot-chocolate', F = 'Oswald';
const DESC = 'A mug of cocoa that fills over one minute, the level following the seconds: swirling chocolate, floating sprinkles and stars, whipped cream on top, candy-pink sky above.';
const pre = `
const W = dev().w, H = dev().h;
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
const COL = ['#ff4f8b', '#ffd23f', '#3ee0c5', '#5aa9ff', '#b36bff', '#ff8a3d', '#7dff6b'];
const star = (g, x, y, r, rot) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); } g.closePath(); };
`;
const liquidJS = pre + `
const FH = 500, N = 10, S0 = 40, PER = 120, FOAM = 62;
const bits = Array.from({ length: 46 }, (_, i) => ({ x: 12 + rnd() * (W - 24), y: rnd() * PER, kind: i % 3, c: COL[i % COL.length], rot: rnd() * 3 }));
for (let k = 0; k < N; k++) {
  const ph = 2 * Math.PI * k / N;
  const ys = (x) => S0 + 1.8 * Math.sin(2 * Math.PI * x / W - ph) + 0.8 * Math.sin(4 * Math.PI * x / W + 2 * ph);
  const c = mk(W, FH), g = c.getContext('2d');
  g.beginPath(); g.moveTo(0, FH); g.lineTo(0, ys(0));
  for (let x = 0; x <= W; x += 6) g.lineTo(x, ys(x));
  g.lineTo(W, FH); g.closePath();
  const lg = g.createLinearGradient(0, S0, 0, FH);
  lg.addColorStop(0, '#a5552c'); lg.addColorStop(0.3, '#7b3a1d'); lg.addColorStop(0.7, '#55260f'); lg.addColorStop(1, '#341508');
  g.fillStyle = lg; g.fill();
  g.save(); g.clip();
  const rg = g.createRadialGradient(W / 2, S0 + 170, 10, W / 2, S0 + 170, 330);
  rg.addColorStop(0, 'rgba(255,150,90,0.35)'); rg.addColorStop(1, 'rgba(255,150,90,0)');
  g.fillStyle = rg; g.fillRect(0, S0, W, FH);
  // swirling ribbons of milk chocolate, drifting with the frame
  for (let r = 0; r < 7; r++) {
    g.beginPath();
    for (let y = S0 + 40; y <= FH; y += 8) {
      const x = W / 2 + Math.sin(y / 38 + ph + r * 1.1) * (70 + r * 18) * Math.sin(y / 170 + r);
      y === S0 + 40 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.lineWidth = 10 + r * 2; g.lineCap = 'round';
    g.strokeStyle = r % 2 ? 'rgba(255,170,110,0.13)' : 'rgba(40,12,4,0.22)'; g.stroke();
  }
  // sprinkles, stars and hearts rising 12 px per frame (loops every 120 px)
  for (const b of bits) {
    for (let t = ((b.y - k * 12) % PER + PER) % PER; t < FH; t += PER) {
      if (t < S0 + 14) continue;
      const bx = b.x + 4 * Math.sin((t + k * 12) / 28 + b.x);
      g.fillStyle = b.c; g.strokeStyle = 'rgba(40,10,0,0.45)'; g.lineWidth = 1;
      if (b.kind === 0) { g.save(); g.translate(bx, t); g.rotate(b.rot + t / 60); g.beginPath(); g.roundRect(-6, -2.2, 12, 4.4, 2.2); g.fill(); g.stroke(); g.restore(); }
      else if (b.kind === 1) { star(g, bx, t, 6.5, b.rot + t / 80); g.fill(); g.stroke(); }
      else { g.beginPath(); g.arc(bx, t, 3.2, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(bx - 1, t - 1, 1, 0, 7); g.fill(); }
    }
  }
  const dg = g.createLinearGradient(0, FH - 160, 0, FH);
  dg.addColorStop(0, 'rgba(20,6,0,0)'); dg.addColorStop(1, 'rgba(20,6,0,0.5)');
  g.fillStyle = dg; g.fillRect(0, FH - 160, W, 160);
  g.restore();
  // glossy surface: a thin tan froth edge and a soft highlight
  g.beginPath();
  for (let x = 0; x <= W; x += 4) { const y = ys(x) + 1; x ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.lineWidth = 5; g.strokeStyle = '#e2b48a'; g.stroke();
  g.beginPath();
  for (let x = 0; x <= W; x += 4) { const y = ys(x) + 7; x ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.lineWidth = 3; g.strokeStyle = 'rgba(255,225,190,0.35)'; g.stroke();
  names.push(addProjectImage('cocoa_' + k + '.png', c, {}).name);
}
`;
const coverJS = pre + `
const FOAM = 62, TOP = H, CH = H + FOAM + 8, NF = 10;
seed = 5;
const conf = Array.from({ length: 60 }, (_, i) => ({ x: rnd() * W, y: rnd() * (TOP - 20), r: 4 + rnd() * 9, c: COL[i % COL.length], kind: i % 3, rot: rnd() * 3 }));
const sp = Array.from({ length: 90 }, (_, i) => ({ x: rnd() * W, y: rnd() * (FOAM - 14), c: COL[i % COL.length], rot: rnd() * 3 }));
for (let k = 0; k < NF; k++) {
  const ph = 2 * Math.PI * k / NF;
  const c = mk(W, CH), g = c.getContext('2d');
  const sy = (x) => TOP + 1.8 * Math.sin(2 * Math.PI * x / W - ph) + 0.8 * Math.sin(4 * Math.PI * x / W + 2 * ph);
  g.save(); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, sy(0) + 3); for (let x = 0; x <= W; x += 4) g.lineTo(x, sy(x) + 3); g.lineTo(W, 0); g.closePath(); g.clip();
  const sky = g.createLinearGradient(0, 0, 0, TOP);
  sky.addColorStop(0, '#2a0f5e'); sky.addColorStop(0.45, '#b2399e'); sky.addColorStop(0.8, '#ff6f91'); sky.addColorStop(1, '#ffb36b');
  g.fillStyle = sky; g.fillRect(0, 0, W, TOP + 8);
  for (const d of conf) {
    const y = d.y + 3 * Math.sin(ph + d.x);
    g.globalAlpha = 0.85; g.fillStyle = d.c;
    if (d.kind === 0) { g.beginPath(); g.arc(d.x, y, d.r * 0.5, 0, 7); g.fill(); }
    else if (d.kind === 1) { star(g, d.x, y, d.r, d.rot + ph / 2); g.fill(); }
    else { g.save(); g.translate(d.x, y); g.rotate(d.rot + ph / 3); g.beginPath(); g.roundRect(-d.r, -d.r * 0.3, d.r * 2, d.r * 0.6, d.r * 0.3); g.fill(); g.restore(); }
  }
  g.globalAlpha = 1; g.restore();
  g.beginPath();
  for (let x = 0; x <= W; x += 4) { const y = sy(x) + 1; x ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.lineWidth = 5; g.strokeStyle = '#e2b48a'; g.stroke();
  // marshmallows bobbing on the surface
  const mm = [[52, 30, 24, '#ffffff'], [92, 36, 20, '#ffc2dc'], [300, 34, 26, '#ffffff'], [330, 30, 22, '#ffe08a'], [134, 26, 18, '#ffffff'], [262, 28, 18, '#ffc2dc']];
  mm.forEach(([x, w, h, col], i) => {
    const y = sy(x) - h * 0.65 + 2 * Math.sin(ph * 1 + i * 1.7);
    g.save(); g.translate(x, y); g.rotate(0.15 * Math.sin(ph + i));
    g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, h * 0.4); g.fillStyle = col; g.fill();
    g.lineWidth = 1.2; g.strokeStyle = 'rgba(90,40,20,0.45)'; g.stroke();
    g.beginPath(); g.roundRect(-w / 2 + 4, -h / 2 + 3, w * 0.45, 3, 1.5); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fill();
    g.restore();
  });
  names.push(addProjectImage('cover_' + k + '.png', c, {}).name);
}
`;
const glassJS = pre + `
const c = mk(W, H), g = c.getContext('2d');
for (const left of [true, false]) {
  const g1 = g.createLinearGradient(left ? 0 : W, 0, left ? 22 : W - 22, 0);
  g1.addColorStop(0, 'rgba(255,200,230,0.45)'); g1.addColorStop(1, 'rgba(255,200,230,0)');
  g.fillStyle = g1; g.fillRect(left ? 0 : W - 22, 0, 22, H);
}
const refl = (x, y0, y1, w, a) => { const r = g.createLinearGradient(x, y0, x, y1); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.25, 'rgba(255,255,255,' + a + ')'); r.addColorStop(0.8, 'rgba(255,255,255,' + a + ')'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + w * 1.6, (y0 + y1) / 2, x, y1); g.quadraticCurveTo(x + w * 0.4, (y0 + y1) / 2, x, y0); g.fill(); };
refl(28, 40, 380, 6, 0.3); refl(44, 90, 320, 2.5, 0.2);
const bg2 = g.createLinearGradient(0, H - 52, 0, H); bg2.addColorStop(0, 'rgba(255,170,210,0)'); bg2.addColorStop(1, 'rgba(255,170,210,0.55)');
g.fillStyle = bg2; g.fillRect(0, H - 52, W, 52);
// twinkles
seed = 23;
for (let i = 0; i < 14; i++) { const x = 20 + rnd() * (W - 40), y = 120 + rnd() * (H - 200), r = 3 + rnd() * 4; g.fillStyle = 'rgba(255,255,255,0.8)'; star(g, x, y, r, 0); g.fill(); }
names.push(addProjectImage('glass_front.png', c, {}).name);
`;
const face = (size) => ({ font: F, size, fill: 'gradient', from: '#ffffff', to: '#ffc2dc', angle: 90,
  borderColor: '#3a1408', borderWidth: 4, shadowColor: '#000000', shadowX: 0, shadowY: 4, shadowBlur: 4 });
const dim = { font: F, size: 120, fill: 'solid', color: '#9a6a52' };
const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const tag = (suffix) => ({ script: `const n = project.elements.length; for (const i of [n-3,n-2,n-1]) project.elements[i].name += ' ${suffix}'; return 1` });
const steps = [{ preset: 'bg' },
  wrap(liquidJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Liquid'; e.src = names[0]; e.images = names.slice(); e.handle = 'liquid'; e.x = 0; e.y = 0; e.show = 'normal'; return names.length;`),
  wrap(coverJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Cover'; e.src = names[0]; e.images = names.slice(); e.handle = 'cover'; e.x = 0; e.y = 40 - dev().h; e.show = 'normal'; return 1`),
  { preset: 'clock' }, tag('Main'), { preset: 'clock' }, tag('Aod'), { preset: 'weekday' }, { preset: 'day' }, { preset: 'temp' },
  wrap(glassJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Glass'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  { remove: 'Colon Aod' },
  { edit: 'Hour Main', set: { x: 40, y: 178, show: 'normal', zero: 1 }, glyph: face(120) },
  { edit: 'Colon Main', set: { x: 178, y: 199, show: 'normal' }, glyph: face(120) },
  { edit: 'Minute Main', set: { x: 212, y: 178, show: 'normal', zero: 1 }, glyph: face(120) },
  { edit: 'Hour Aod', set: { x: 125, y: 100, show: 'aod', zero: 1 }, glyph: dim },
  { edit: 'Minute Aod', set: { x: 130, y: 240, show: 'aod', zero: 1 }, glyph: dim },
  { edit: 'Weekday', set: { x: 116, y: 31, show: 'normal' }, glyph: face(46) },
  { edit: 'Day', set: { x: 214, y: 44, show: 'normal' }, glyph: face(46) },
  { edit: 'Temperature', set: { x: 145, y: 378, show: 'normal' }, glyph: face(58) },
  // weekday names of any length: right-aligned in their cell, fixed ink gap to the day number, shared baseline (kit dateRow)
  { script: fs.readFileSync(__dirname + '/../../.claude/skills/create-amazfit-watchface/examples/animated/kit.js', 'utf8') + `
const wd = E('Weekday'); wd.labelAlign = 'right'; rerenderGlyphLayers(); await loadAllImages();
park(['Weekday', 'Day']); await dateRow(195, 66, 10); shift(['Weekday'], 0, 1); return 1` },
  // named groups
  { script: `project.groups = project.groups || {}; let n = 0;
for (const [k, v] of Object.entries(project.groups)) if (v === 'Clock 2') project.groups[k] = 'Clock AOD';
project.groups.gDate = 'Date'; for (const nm of ['Weekday', 'Day']) { const e = project.elements.find((x) => x.name === nm); if (e) { e.group = 'gDate'; n++ } } return n` },
  { script: `document.getElementById('btnPruneImages').click(); return project.images.length + ' images left'` },
];
const rec = JSON.parse(fs.readFileSync(__dirname + '/../beer-minute/recipe.json', 'utf8'));
const userCode = rec.userCode.replace(/F\.beer/g, 'F.liquid').replace(/W\.beer/g, 'W.liquid');
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: NAME, device: 'bip-6', font: F, description: DESC, preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: OUT, optimizePng: 16, userImports: rec.userImports, userCode, steps }, null, 1));
