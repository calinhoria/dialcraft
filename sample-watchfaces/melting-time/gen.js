const fs = require('fs');
const pre = `
const W = dev().w, H = dev().h;
let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
try { await document.fonts.load('143px "Bebas Neue"'); } catch (e) {}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const blurData = (src, px) => { const c = mk(src.width, src.height), g = c.getContext('2d'); g.filter = 'blur(' + px + 'px)'; g.drawImage(src, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
// turns a white-on-transparent mask into molten ivory wax: normal-mapped light from the upper left, specular, darker amber at the thin edges, soft drop shadow
function shade(mask, K, shadow) {
  const w = mask.width, h = mask.height;
  const A = blurData(mask, 2.2), Hh = blurData(mask, 5);
  const out = mk(w, h), og = out.getContext('2d'), id = og.createImageData(w, h), d = id.data;
  const L = [-0.5, -0.55, 0.67], ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;
  let hv = [L[0], L[1], L[2] + 1]; const hl = Math.hypot(...hv); hv = hv.map((v) => v / hl);
  const hAt = (x, y) => Hh[(clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)) * 4 + 3] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, a = clamp((A[i + 3] / 255 - 0.5) * 6 + 0.5, 0, 1);
    if (a <= 0) continue;
    let nx = -(hAt(x + 1, y) - hAt(x - 1, y)) * K, ny = -(hAt(x, y + 1) - hAt(x, y - 1)) * K, nz = 1; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const diff = nx * L[0] + ny * L[1] + nz * L[2], sp = Math.pow(Math.max(0, nx * hv[0] + ny * hv[1] + nz * hv[2]), 44);
    const th = clamp(Hh[i + 3] / 255, 0, 1), edge = 1 - clamp((th - 0.15) / 0.5, 0, 1);
    const t = clamp(0.28 + 0.85 * diff, 0, 1);
    let r = 120 + (246 - 120) * t, gg = 82 + (226 - 82) * t, b = 22 + (150 - 22) * t;
    r = r * (1 - edge * 0.18) + 200 * edge * 0.12; gg = gg * (1 - edge * 0.30); b = b * (1 - edge * 0.5);
    r += 255 * sp * 0.9; gg += 255 * sp * 0.9; b += 255 * sp * 0.8;
    d[i] = clamp(r, 0, 255); d[i + 1] = clamp(gg, 0, 255); d[i + 2] = clamp(b, 0, 255); d[i + 3] = a * 255;
  }
  og.putImageData(id, 0, 0);
  if (!shadow) return out;
  const fin = mk(w, h), fg = fin.getContext('2d'); fg.shadowColor = 'rgba(20,10,0,0.55)'; fg.shadowBlur = 5; fg.shadowOffsetX = 3; fg.shadowOffsetY = 4; fg.drawImage(out, 0, 0); return fin;
}
`;

const DW = 78, DH = 190, TIP = 172, CX = 39;
const digitsJS = pre + `
const DW = ${DW}, DH = ${DH}, TIP = ${TIP}, CX = ${CX};
for (let n = 0; n < 10; n++) {
  const m = mk(DW, DH), g = m.getContext('2d');
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineJoin = 'round'; g.lineWidth = 7; g.font = '143px "Bebas Neue"'; g.textAlign = 'center';
  g.strokeText(String(n), CX, 121); g.fillText(String(n), CX, 121);
  g.beginPath(); g.roundRect(6, 111, 66, 15, 7); g.fill();
  // sag: the lower part of every column is pulled down, more on one side (a draped, melting look)
  const src = g.getImageData(0, 0, DW, DH).data, dst = g.createImageData(DW, DH);
  const p1 = rnd() * 6, p2 = rnd() * 6, side = rnd() > 0.5 ? 1 : -1;
  for (let x = 0; x < DW; x++) {
    const ramp0 = 40, bottom = 126;
    const f = 0.5 + 0.5 * Math.sin(x * 0.12 + p1) * Math.cos(x * 0.05 + p2), lean = 0.35 + 0.65 * (side > 0 ? x / DW : 1 - x / DW);
    const s = 5 + 20 * f * lean;
    for (let y = 0; y < DH; y++) {
      const r = Math.pow(clamp((y - ramp0) / (bottom - ramp0), 0, 1), 1.5), sy = Math.round(y - s * r);
      if (sy < 0 || sy >= DH) continue;
      dst.data[(y * DW + x) * 4 + 3] = src[(sy * DW + x) * 4 + 3]; dst.data[(y * DW + x) * 4] = dst.data[(y * DW + x) * 4 + 1] = dst.data[(y * DW + x) * 4 + 2] = 255;
    }
  }
  g.clearRect(0, 0, DW, DH); g.putImageData(dst, 0, 0);
  const bw = (x) => { for (let y = DH - 1; y > 0; y--) if (dst.data[(y * DW + x) * 4 + 3] > 128) return y; return 126; };
  // drips: the centre one always ends at the same height (a falling drop is animated there), two smaller ones vary
  const drip = (x, tip, w, rb) => { const y0 = bw(x) - 8; g.fillStyle = '#fff'; g.beginPath(); g.roundRect(x - w / 2, y0, w, tip - y0, w / 2); g.fill(); g.beginPath(); g.arc(x, tip, rb, 0, 7); g.fill(); };
  drip(CX, TIP, 7, 6.3);
  const xs = [14 + rnd() * 14, 50 + rnd() * 14];
  xs.forEach((x, i) => drip(x, bw(Math.round(x)) + 12 + rnd() * 20, 5, 4.2));
  names.push(addProjectImage('melt/d' + n + '.png', shade(m, 7, true), {}).name);
}
// colon: two blobs
{ const m = mk(30, DH), g = m.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.arc(15, 66, 9.5, 0, 7); g.fill(); g.beginPath(); g.arc(15, 96, 9.5, 0, 7); g.fill();
  g.beginPath(); g.roundRect(2, 112, 26, 14, 7); g.fill(); g.beginPath(); g.moveTo(11, 105); g.lineTo(19, 105); g.lineTo(18, 124); g.lineTo(12, 124); g.fill(); g.beginPath(); g.roundRect(12, 120, 6, 24, 3); g.fill(); g.beginPath(); g.arc(15, 144, 4.5, 0, 7); g.fill();
  names.push(addProjectImage('melt/colon.png', shade(m, 7, true), {}).name); }
`;

const sceneJS = pre + `
const c = mk(W, H), g = c.getContext('2d'), LT = 219, FACE = 292;
let gr = g.createLinearGradient(0, 0, 0, LT); gr.addColorStop(0, '#142b44'); gr.addColorStop(0.4, '#4a6c86'); gr.addColorStop(0.72, '#e5a878'); gr.addColorStop(1, '#f7d29c'); g.fillStyle = gr; g.fillRect(0, 0, W, LT);
gr = g.createRadialGradient(300, 208, 6, 300, 208, 190); gr.addColorStop(0, 'rgba(255,236,190,0.95)'); gr.addColorStop(0.2, 'rgba(255,210,150,0.5)'); gr.addColorStop(1, 'rgba(255,190,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, LT);
for (let i = 0; i < 6; i++) { const y = 60 + i * 24 + rnd() * 10, x = rnd() * W, w = 120 + rnd() * 160; const cg = g.createLinearGradient(x, 0, x + w, 0); cg.addColorStop(0, 'rgba(255,200,170,0)'); cg.addColorStop(0.5, 'rgba(255,205,170,' + (0.1 + rnd() * 0.12) + ')'); cg.addColorStop(1, 'rgba(255,200,170,0)'); g.fillStyle = cg; g.beginPath(); g.ellipse(x + w / 2, y, w / 2, 4 + rnd() * 5, 0, 0, 7); g.fill(); }
for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.2 + rnd() * 0.5) + ')'; g.fillRect(rnd() * W, rnd() * 80, 1, 1); }
const range = (col, base, amp, seedv, step) => { seed = seedv; g.beginPath(); g.moveTo(0, LT); for (let x = 0; x <= W + step; x += step) { g.lineTo(x, base - amp * (0.35 + 0.65 * Math.abs(Math.sin(x * 0.021 + seedv) * Math.cos(x * 0.0073 + seedv * 2))) - rnd() * 4); } g.lineTo(W, LT); g.closePath(); g.fillStyle = col; g.fill(); };
range('rgba(120,98,120,0.75)', 214, 44, 2, 6); range('rgba(78,62,84,0.9)', 218, 30, 5, 5);
// the slab: sunlit top, stratified face
gr = g.createLinearGradient(0, LT - 14, 0, LT); gr.addColorStop(0, '#d9c3a0'); gr.addColorStop(1, '#b49b78'); g.fillStyle = gr; g.fillRect(0, LT - 14, W, 14);
g.fillStyle = 'rgba(255,240,205,0.5)'; g.fillRect(0, LT - 14, W, 1.5);
gr = g.createLinearGradient(0, LT, 0, FACE); gr.addColorStop(0, '#8e7655'); gr.addColorStop(0.55, '#6a5239'); gr.addColorStop(1, '#3d2e20'); g.fillStyle = gr; g.fillRect(0, LT, W, FACE - LT);
for (let i = 0; i < 16; i++) { const y = LT + 4 + rnd() * (FACE - LT - 8); g.strokeStyle = 'rgba(' + (rnd() > 0.5 ? '30,18,8' : '200,170,125') + ',' + (0.1 + rnd() * 0.18) + ')'; g.lineWidth = 0.6 + rnd() * 1.4; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= W; x += 30) g.lineTo(x, y + (rnd() - 0.5) * 3); g.stroke(); }
for (let i = 0; i < 1800; i++) { g.fillStyle = 'rgba(' + (rnd() > 0.5 ? '255,235,200' : '20,10,0') + ',' + (0.04 + rnd() * 0.08) + ')'; g.fillRect(rnd() * W, LT + rnd() * (FACE - LT), 1 + rnd() * 1.5, 1 + rnd()); }
for (let i = 0; i < 4; i++) { let x = 30 + rnd() * 330, y = LT + 2; g.strokeStyle = 'rgba(20,10,0,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 10; y += 8 + rnd() * 6; g.lineTo(x, y); } g.stroke(); }
// sand
gr = g.createLinearGradient(0, FACE, 0, H); gr.addColorStop(0, '#d7ad78'); gr.addColorStop(0.5, '#b88c58'); gr.addColorStop(1, '#6e4f30'); g.fillStyle = gr; g.fillRect(0, FACE, W, H - FACE);
for (let i = 0; i < 20; i++) { const y = FACE + 10 + i * 7 + rnd() * 5; g.strokeStyle = 'rgba(' + (i % 2 ? '255,230,180' : '70,45,20') + ',0.13)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + 5 * Math.sin(i), W * 0.65, y - 5, W, y + 3); g.stroke(); }
for (let i = 0; i < 2600; i++) { g.fillStyle = 'rgba(' + (rnd() > 0.5 ? '255,235,190' : '60,35,10') + ',' + (0.05 + rnd() * 0.1) + ')'; g.fillRect(rnd() * W, FACE + rnd() * (H - FACE), 1, 1); }
gr = g.createLinearGradient(0, FACE, 0, FACE + 44); gr.addColorStop(0, 'rgba(25,12,0,0.7)'); gr.addColorStop(1, 'rgba(25,12,0,0)'); g.fillStyle = gr; g.fillRect(0, FACE, W, 44);
names.push(addProjectImage('scene.png', c, {}).name);
`;

const puddleJS = pre + `
const R = [66, 52, 42, 32, 22, 14], CXS = [60, 138, 252, 330];
R.forEach((r, k) => {
  const m = mk(W, 46), g = m.getContext('2d'); g.fillStyle = '#fff';
  for (const cx of CXS) { g.beginPath(); g.ellipse(cx, 22, r, Math.max(4, r * 0.24), 0, 0, 7); g.fill(); }
  const s = shade(m, 3.2, true), sg = s.getContext('2d'); sg.globalCompositeOperation = 'source-atop';
  names.push(addProjectImage('melt/puddle_' + k + '.png', s, {}).name);
});
`;

const dropJS = pre + `
const DWD = 30, DHT = 70, N = 20, LAND = 58;
const blob = (g, x, y, r, stretch) => {
  g.save(); g.translate(x, y); g.scale(1, stretch);
  g.beginPath(); g.moveTo(0, -r * 1.7); g.bezierCurveTo(r * 0.5, -r * 0.8, r * 1.05, -r * 0.3, r, 0.2 * r); g.arc(0, 0.2 * r, r, 0, Math.PI, false); g.bezierCurveTo(-r * 1.05, -r * 0.3, -r * 0.5, -r * 0.8, 0, -r * 1.7); g.closePath();
  const gr = g.createRadialGradient(-r * 0.35, -r * 0.2, r * 0.1, 0, 0, r * 1.2); gr.addColorStop(0, '#fff6cf'); gr.addColorStop(0.55, '#e8c668'); gr.addColorStop(1, '#a87a1e'); g.fillStyle = gr; g.fill();
  g.strokeStyle = 'rgba(110,72,10,0.55)'; g.lineWidth = 0.8; g.stroke();
  g.beginPath(); g.ellipse(-r * 0.38, -r * 0.15, r * 0.2, r * 0.38, 0.4, 0, 7); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill();
  g.restore();
};
for (let k = 0; k < N; k++) {
  const c = mk(DWD, DHT), g = c.getContext('2d'), X = 15;
  if (k <= 7) { const u = k / 7, r = 6.3 + 2.4 * u, y = 9 + 6 * u * u, nw = 7 * (1 - 0.8 * u);
    g.fillStyle = '#e2bd5c'; g.beginPath(); g.roundRect(X - nw / 2, 0, nw, y, nw / 2); g.fill(); blob(g, X, y, r, 1 + 0.25 * u); }
  else if (k <= 14) { const t = k - 8, y = 16 + 0.5 * 2.33 * t * t; blob(g, X, y, 5.2, 1 + 0.06 * t); }
  else { const t = (k - 15) / 4;
    g.save(); g.translate(X, LAND); g.scale(1, 0.26);
    for (const [rr, a] of [[6 + 20 * t, 0.7 * (1 - t)], [3 + 11 * t, 0.5 * (1 - t)]]) { g.beginPath(); g.arc(0, 0, rr, 0, 7); g.strokeStyle = 'rgba(255,248,215,' + a + ')'; g.lineWidth = 2.6; g.stroke(); }
    g.restore();
    if (t < 0.6) for (const s of [-1, 1]) { const dx = s * (4 + 10 * t), dy = -(10 * Math.sin(Math.PI * t / 0.6)); g.beginPath(); g.arc(X + dx, LAND - 3 + dy, 2.2 * (1 - t * 0.5), 0, 7); g.fillStyle = 'rgba(240,210,120,' + (1 - t) + ')'; g.fill(); }
  }
  names.push(addProjectImage('anim/drop_' + k + '.png', c, {}).name);
}
`;

const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const F = 'Bebas Neue';
const SLOTS = [60, 138, 252, 330], PH = [0, 5, 10, 15];
const TY = 95;
const steps = [{ preset: 'bg' },
  wrap(sceneJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Scene'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  wrap(puddleJS, `const e = await addElement('IMG_LEVEL', { dataType: 'BATTERY', images: names, w: 0, h: 0 }); e.name = 'Puddle'; e.images = names; e.dataType = 'BATTERY'; e.x = 0; e.y = 293; e.show = 'normal'; return names.length`),
  { preset: 'clock' },
  wrap(digitsJS, `
    const dg = names.slice(0, 10), colon = names[10];
    for (const [nm, x] of [['Hour', 21], ['Minute', 213]]) { const e = project.elements.find((q) => q.name === nm); e.glyph = null; e.images = dg.slice(); e.space = 0; e.zero = 1; e.x = x; e.y = ${TY}; e.show = 'normal'; }
    const col = project.elements.find((q) => q.name === 'Colon'); project.elements = project.elements.filter((q) => q !== col);
    const ce = await addElement('IMG', { src: colon }); ce.name = 'Colon'; ce.src = colon; ce.x = 177; ce.y = ${TY}; ce.show = 'normal'; return 1`),
  wrap(dropJS, `const SL = ${JSON.stringify(SLOTS)}, PH = ${JSON.stringify(PH)};
    for (let i = 0; i < 4; i++) { const fr = names.map((_, k) => names[(k + PH[i]) % names.length]); const e = await addElement('IMG_ANIM', { frames: fr, fps: 10, animPrefix: 'drop' + i, repeat: 0 }); e.name = 'Drop ' + (i + 1); e.frames = fr; e.x = SL[i] - 15; e.y = ${TY + TIP - 9}; e.show = 'normal'; } return names.length`),
  { preset: 'weekday' }, { preset: 'day' }, { preset: 'steps' }, { preset: 'clock' },
  { script: `const n = project.elements.length; ['Hour','Colon','Minute'].forEach((nm,i)=>{ project.elements[n-3+i].name = nm + ' Aod'; }); return 1` },
  { remove: 'Colon Aod' },
];
const ink = (size, extra) => ({ font: F, size, fill: 'solid', color: '#fff3d2', borderColor: '#2b1a08', borderWidth: 2, shadowColor: '#000000', shadowX: 0, shadowY: 2, shadowBlur: 4, ...extra });
steps.push(
  { edit: 'Weekday', set: { x: 118, y: 14 }, glyph: ink(46) },
  { edit: 'Day', set: { x: 218, y: 14 }, glyph: ink(46) },
  { edit: 'Steps', set: { x: 120, y: 372, alignH: 'CENTER_H', w: 150 }, glyph: ink(46) },
  { edit: 'Hour Aod', set: { x: 60, y: 110, show: 'aod', zero: 1 }, glyph: { font: F, size: 150, fill: 'solid', color: '#7a6a3a' } },
  { edit: 'Minute Aod', set: { x: 60, y: 250, show: 'aod', zero: 1 }, glyph: { font: F, size: 150, fill: 'solid', color: '#7a6a3a' } });
fs.writeFileSync('recipe.json', JSON.stringify({ name: 'Melting Time', device: 'bip-6', font: F, description: 'Dali-style melting digits slumped over a stone ledge: wax-like drips, falling drops, and a puddle that grows as the battery drains.', preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/melting-time', steps }, null, 1));
