const fs = require('fs');
const pre = `
const W = dev().w, H = dev().h;
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
`;
// Beer frames: 390x500, foam top at y=40. Thick flat head, calm surface (1-2 px), fine bubbles rising, faceted glass tint.
const beerJS = pre + `
const FH = 380, N = 10, S0 = 40, PER = 120, FOAM = 62;
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
  names.push(addProjectImage('anim/bg_beer_' + k + '.png', c, {}).name);
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
// Tap: chrome pipe and spout in the top-left corner, black lever on top. The spout is centred on x=26.
const tapJS = pre + `
const c = mk(90, 70), g = c.getContext('2d');
const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const chromeH = (y, h) => { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#5a5f66'); gr.addColorStop(0.22, '#f6f9fc'); gr.addColorStop(0.5, '#c4cad0'); gr.addColorStop(0.8, '#8c9299'); gr.addColorStop(1, '#4a4f55'); return gr; };
const chromeV = (x, w) => { const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#5a5f66'); gr.addColorStop(0.3, '#f6f9fc'); gr.addColorStop(0.55, '#c4cad0'); gr.addColorStop(1, '#4a4f55'); return gr; };
// lever
const lg = g.createLinearGradient(10, 0, 24, 0); lg.addColorStop(0, '#111'); lg.addColorStop(0.35, '#5a5a5a'); lg.addColorStop(1, '#0a0a0a');
rr(10, 0, 14, 30, 5); g.fillStyle = lg; g.fill();
// pipe
rr(-12, 24, 58, 20, 9); g.fillStyle = chromeH(24, 20); g.fill();
g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1; g.stroke();
// collar
rr(34, 22, 9, 24, 3); g.fillStyle = chromeH(22, 24); g.fill(); g.stroke();
// spout
g.beginPath(); g.moveTo(15, 42); g.lineTo(37, 42); g.lineTo(33, 66); g.lineTo(19, 66); g.closePath();
g.fillStyle = chromeV(15, 22); g.fill(); g.stroke();
g.beginPath(); g.ellipse(26, 66, 7, 2.6, 0, 0, 7); g.fillStyle = '#1a1208'; g.fill();
names.push(addProjectImage('tap.png', c, {}).name);
`;
// Pour: a stream wobbling down from the spout (y=62 on screen) into a splash where it meets the foam (y=180).
const pourJS = pre + `
const PW = 60, PH = 100, CX = 26, SURF = 56, N = 8, PER = 48;
for (let k = 0; k < N; k++) {
  const c = mk(PW, PH), g = c.getContext('2d');
  const ph = 2 * Math.PI * k / N;
  const half = (y) => 7.2 - 2.2 * (y / SURF) + 0.9 * Math.sin(2 * Math.PI * (y - k * PER / N) / PER);
  g.beginPath(); g.moveTo(CX - half(0), 0);
  for (let y = 0; y <= SURF + 6; y += 2) g.lineTo(CX - half(y) + 0.7 * Math.sin(y / 11 + ph), y);
  for (let y = SURF + 6; y >= 0; y -= 2) g.lineTo(CX + half(y) + 0.7 * Math.sin(y / 11 + ph), y);
  g.closePath();
  const sg = g.createLinearGradient(CX - 9, 0, CX + 9, 0);
  sg.addColorStop(0, '#d9780a'); sg.addColorStop(0.3, '#ffb531'); sg.addColorStop(0.55, '#ffd36b'); sg.addColorStop(1, '#e8860e');
  g.fillStyle = sg; g.fill();
  g.save(); g.clip();
  for (let i = 0; i < 4; i++) {
    const y0 = ((i * 12 + k * PER / N) % PER), x = CX - 2 + (i % 2) * 3;
    for (let y = y0 - PER; y < PH; y += PER) { g.fillStyle = 'rgba(255,248,215,0.7)'; g.fillRect(x, y, 1.6, 9 + i * 2); }
  }
  g.restore();
  // splash where the stream meets the foam
  g.fillStyle = 'rgba(255,255,255,0.95)';
  for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(CX + (i - 2) * 6 + 1.5 * Math.sin(ph + i), SURF - 1 + 1.5 * Math.cos(ph * 2 + i), 7 + 2 * Math.sin(ph + i * 2), 5, 0, 0, 7); g.fill(); }
  for (let i = 0; i < 7; i++) {
    const t = ((k / N) + i / 7) % 1, dir = i % 2 ? 1 : -1, vx = 6 + (i % 3) * 5;
    const x = CX + dir * (4 + vx * t * 2.2), y = SURF - 4 - 30 * Math.sin(Math.PI * t) * (0.6 + (i % 3) * 0.25);
    g.beginPath(); g.arc(x, y, 2.4 * (1 - 0.5 * t), 0, 7); g.fillStyle = 'rgba(255,250,235,' + (1 - 0.7 * t) + ')'; g.fill();
  }
  names.push(addProjectImage('anim/bg_pour_' + k + '.png', c, {}).name);
}
`;
const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const F = 'Bebas Neue';
// beer-orange face with a dark border and a soft shadow: Dialcraft's own text visibility aids, no extra layers
const face = (size, bw, sh) => ({ font: F, size, fill: 'gradient', from: '#ffd36b', to: '#ff8a00', angle: 90,
  borderColor: '#1c0b00', borderWidth: bw, shadowColor: '#000000', shadowX: 0, shadowY: sh, shadowBlur: sh });
const SH = '#1c0b00';
const FACE = { fill: 'gradient', from: '#ffd36b', to: '#ff8a00', angle: 90 };
const gl = (size, dark) => ({ font: F, size, ...(dark ? { fill: 'solid', color: SH } : FACE) });
const big = [[-4, 4], [4, 4], [-4, -4], [4, -4]], small = [[-3, 3], [3, 3], [-3, -3], [3, -3]];
const tag = (suffix) => ({ script: `const n = project.elements.length; for (const i of [n-3,n-2,n-1]) project.elements[i].name += ' ${suffix}'; return 1` });
const steps = [{ preset: 'bg' },
  wrap(beerJS, `const e = await addElement('IMG_ANIM', { frames: names, fps: 10, animPrefix: 'bg_beer', repeat: 0 }); e.name = 'Beer'; e.frames = names; e.x = 0; e.y = 78; e.show = 'normal'; return names.length;`),
  wrap(pourJS, `const e = await addElement('IMG_ANIM', { frames: names, fps: 12, animPrefix: 'bg_pour', repeat: 0 }); e.name = 'Pour'; e.frames = names; e.x = 0; e.y = 62; e.show = 'normal'; return names.length;`),
];
// dark offset copies (outline + drop shadow) first, the orange face on top
big.forEach((_, i) => steps.push({ preset: 'clock' }, tag('S' + i)));
steps.push({ preset: 'clock' }, tag('Main'), { preset: 'clock' }, tag('Aod'));
const small3 = [['weekday', 'Weekday', 134, 44, 46], ['day', 'Day', 206, 44, 46], ['temp', 'Temperature', 155, 378, 58]];
for (const [pre_, nm] of small3) {
  small.forEach((_, i) => steps.push({ preset: pre_ }, { script: `project.elements[project.elements.length-1].name = '${nm} S${i}'; return 1` }));
  steps.push({ preset: pre_ });
}
steps.push(wrap(glassJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Glass'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`), { remove: 'Colon Aod' }, wrap(tapJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Tap'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`), { script: `project.optimizePng = true; return 1` });
const place = (suffix, dx, dy, dark) => [
  { edit: 'Hour ' + suffix, set: { x: 45 + dx, y: 150 + dy, show: 'normal', zero: 1 }, glyph: gl(150, dark) },
  { edit: 'Colon ' + suffix, set: { x: 182 + dx, y: 167 + dy, show: 'normal' }, glyph: gl(150, dark) },
  { edit: 'Minute ' + suffix, set: { x: 214 + dx, y: 150 + dy, show: 'normal', zero: 1 }, glyph: gl(150, dark) }];
big.forEach(([dx, dy], i) => steps.push(...place('S' + i, dx, dy, true)));
steps.push(...place('Main', 0, 0, false));
steps.push(
  { edit: 'Hour Aod', set: { x: 60, y: 90, show: 'aod', zero: 1 }, glyph: { font: F, size: 120, fill: 'solid', color: '#8a5a1a' } },
  { edit: 'Minute Aod', set: { x: 60, y: 230, show: 'aod', zero: 1 }, glyph: { font: F, size: 120, fill: 'solid', color: '#8a5a1a' } });
for (const [, nm, x, y, size] of small3) {
  small.forEach(([dx, dy], i) => steps.push({ edit: nm + ' S' + i, set: { x: x + dx, y: y + dy }, glyph: gl(size, true) }));
  steps.push({ edit: nm, set: { x, y }, glyph: gl(size, false) });
}
fs.writeFileSync('recipe.json', JSON.stringify({ name: 'Infinite Beer', device: 'bip-6', font: F, description: 'A beer tap that never stops pouring into a mug that stays 60% full: thick foam, rising bubbles.', preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/infinite-beer', steps }, null, 1));
