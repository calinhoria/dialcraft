const fs = require('fs');
const pre = `
const W = dev().w, H = dev().h;
let seed = 41; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const blurData = (src, px) => { const c = mk(src.width, src.height), g = c.getContext('2d'); g.filter = 'blur(' + px + 'px)'; g.drawImage(src, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
`;
const sceneJS = pre + `
const c = mk(W, H), g = c.getContext('2d');
// ---- the city, drawn sharp and then blurred: seen through wet glass
const city = mk(W, H), cg = city.getContext('2d');
let gr = cg.createLinearGradient(0, 0, 0, 330); gr.addColorStop(0, '#070b1e'); gr.addColorStop(0.5, '#171a3a'); gr.addColorStop(0.85, '#3d2446'); gr.addColorStop(1, '#6e3b4c'); cg.fillStyle = gr; cg.fillRect(0, 0, W, 330);
cg.save(); cg.filter = 'blur(14px)'; for (const [x, y, w, col] of [[90, 120, 150, 'rgba(120,70,130,0.35)'], [300, 80, 160, 'rgba(70,90,160,0.3)'], [200, 190, 220, 'rgba(160,80,110,0.3)']]) { cg.fillStyle = col; cg.beginPath(); cg.ellipse(x, y, w, 22, 0, 0, 7); cg.fill(); } cg.restore();
const HOR = 322;
const towers = (n, hmin, hmax, wmin, wmax, col, lit) => { let x = -20; while (x < W + 20) { const w = wmin + rnd() * (wmax - wmin), h = hmin + rnd() * (hmax - hmin); cg.fillStyle = col; cg.fillRect(x, HOR - h, w, h + 4);
  if (lit) for (let wx = x + 4; wx < x + w - 5; wx += 7) for (let wy = HOR - h + 6; wy < HOR - 4; wy += 10) if (rnd() < lit) { const k = rnd(); cg.fillStyle = k < 0.6 ? 'rgba(255,214,140,' + (0.5 + rnd() * 0.5) + ')' : k < 0.85 ? 'rgba(255,240,200,0.9)' : 'rgba(150,200,255,0.8)'; cg.fillRect(wx, wy, 3.2, 4.4); }
  x += w + rnd() * 6; } };
towers(0, 40, 120, 20, 46, '#232a4a', 0.25); towers(0, 70, 170, 24, 54, '#161c38', 0.3); towers(0, 90, 230, 30, 64, '#0b0f24', 0.22);
cg.fillStyle = '#ff2a2a'; cg.beginPath(); cg.arc(268, HOR - 238, 2.5, 0, 7); cg.fill(); cg.fillRect(267.2, HOR - 236, 1.6, 40);
// wet road with reflections
gr = cg.createLinearGradient(0, HOR, 0, H); gr.addColorStop(0, '#171a2c'); gr.addColorStop(1, '#07080f'); cg.fillStyle = gr; cg.fillRect(0, HOR, W, H - HOR);
const lights = ['#ffb455', '#ffd890', '#ff4a3a', '#46e0ff', '#7dff9a', '#ffe9b0', '#ff8a3a', '#ffffff'];
const L = Array.from({ length: 40 }, () => ({ x: rnd() * W, y: 190 + rnd() * 150, r: 5 + rnd() * 13, col: lights[rnd() * lights.length | 0], a: 0.16 + rnd() * 0.26 }));
cg.save(); cg.globalCompositeOperation = 'lighter'; for (const l of L) { if (l.y < 250) continue; const s = cg.createLinearGradient(0, HOR, 0, HOR + 90 + l.r * 2); s.addColorStop(0, l.col); s.addColorStop(1, 'rgba(0,0,0,0)'); cg.globalAlpha = l.a * 0.4; cg.fillStyle = s; cg.fillRect(l.x - l.r * 0.5, HOR, l.r, 90 + l.r * 2); } cg.restore();
// soften everything: it is behind rain-streaked glass
g.filter = 'blur(3.2px)'; g.drawImage(city, 0, 0); g.filter = 'none';
// bokeh discs
g.save(); g.globalCompositeOperation = 'lighter';
for (const l of L) { const q = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r); q.addColorStop(0, l.col.replace('#', '#') + '00'); const rgb = [parseInt(l.col.slice(1, 3), 16), parseInt(l.col.slice(3, 5), 16), parseInt(l.col.slice(5, 7), 16)].join(',');
  q.addColorStop(0, 'rgba(' + rgb + ',' + l.a * 0.55 + ')'); q.addColorStop(0.8, 'rgba(' + rgb + ',' + l.a * 0.75 + ')'); q.addColorStop(0.93, 'rgba(' + rgb + ',' + l.a + ')'); q.addColorStop(1, 'rgba(' + rgb + ',0)'); g.fillStyle = q; g.beginPath(); g.arc(l.x, l.y, l.r, 0, 7); g.fill(); }
g.restore();
// fog on the glass toward the sill, faint grain
gr = g.createLinearGradient(0, 300, 0, 410); gr.addColorStop(0, 'rgba(150,170,210,0)'); gr.addColorStop(1, 'rgba(150,170,210,0.16)'); g.fillStyle = gr; g.fillRect(0, 300, W, 110);
for (let i = 0; i < 5000; i++) { g.fillStyle = 'rgba(190,210,245,' + (0.01 + rnd() * 0.03) + ')'; g.fillRect(rnd() * W, rnd() * 410, 1, 1); }
// ---- interior: window frame and sill
const wood = (x0, y0, x1, y1, vert) => { const q = vert ? g.createLinearGradient(x0, 0, x1, 0) : g.createLinearGradient(0, y0, 0, y1); q.addColorStop(0, '#46301f'); q.addColorStop(0.45, '#2a1b11'); q.addColorStop(1, '#150d08'); return q; };
g.fillStyle = wood(0, 0, 14, 0, true); g.fillRect(0, 0, 14, H); g.fillStyle = wood(376, 0, 390, 0, true); g.fillRect(376, 0, 14, H);
g.fillStyle = 'rgba(255,200,150,0.12)'; g.fillRect(13, 0, 1.5, 410); g.fillRect(376, 0, 1.5, 410);
g.fillStyle = wood(0, 0, 0, 12); g.fillRect(0, 0, W, 10);
for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(' + (rnd() > 0.5 ? '10,5,2' : '120,85,55') + ',0.18)'; g.lineWidth = 0.7; const x = rnd() * 14; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + rnd() * 3, H); g.stroke(); g.beginPath(); g.moveTo(376 + x, 0); g.lineTo(376 + x + rnd() * 3, H); g.stroke(); }
gr = g.createLinearGradient(0, 404, 0, H); gr.addColorStop(0, '#5a3d27'); gr.addColorStop(0.12, '#3b2616'); gr.addColorStop(1, '#1a100a'); g.fillStyle = gr; g.fillRect(0, 404, W, H - 404);
g.fillStyle = 'rgba(255,190,130,0.35)'; g.fillRect(0, 404, W, 1.6); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 406, W, 4);
for (let i = 0; i < 14; i++) { const y = 412 + rnd() * 36; g.strokeStyle = 'rgba(' + (rnd() > 0.5 ? '10,5,2' : '150,105,70') + ',0.2)'; g.lineWidth = 0.7 + rnd(); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(100, y + rnd() * 3 - 1.5, 260, y + rnd() * 3 - 1.5, W, y); g.stroke(); }
gr = g.createRadialGradient(195, 404, 10, 195, 410, 200); gr.addColorStop(0, 'rgba(255,170,90,0.22)'); gr.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = gr; g.fillRect(0, 404, W, 46);
// mug with a hint of steam, and a small plant on the sill
g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 7; g.shadowOffsetY = 4; g.beginPath(); g.moveTo(296, 372); g.lineTo(334, 372); g.lineTo(331, 406); g.quadraticCurveTo(315, 411, 299, 406); g.closePath(); gr = g.createLinearGradient(296, 0, 336, 0); gr.addColorStop(0, '#9a9a9a'); gr.addColorStop(0.35, '#f4f1ea'); gr.addColorStop(1, '#8b8680'); g.fillStyle = gr; g.fill(); g.restore();
g.strokeStyle = '#d9d4ca'; g.lineWidth = 4.5; g.beginPath(); g.arc(336, 388, 9, -1.3, 1.3); g.stroke(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.beginPath(); g.arc(336, 388, 11, -1.3, 1.3); g.stroke();
g.beginPath(); g.ellipse(315, 373, 19, 4, 0, 0, 7); g.fillStyle = '#3b2314'; g.fill();
g.save(); g.filter = 'blur(3px)'; g.strokeStyle = 'rgba(255,240,225,0.28)'; g.lineWidth = 5; for (const dx of [-6, 4]) { g.beginPath(); g.moveTo(315 + dx, 366); g.bezierCurveTo(309 + dx, 352, 322 + dx, 344, 314 + dx, 328); g.stroke(); } g.restore();
g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 6; g.shadowOffsetY = 3; g.beginPath(); g.moveTo(44, 408); g.lineTo(76, 408); g.lineTo(72, 384); g.lineTo(48, 384); g.closePath(); gr = g.createLinearGradient(44, 0, 76, 0); gr.addColorStop(0, '#8a3f22'); gr.addColorStop(0.4, '#c9683c'); gr.addColorStop(1, '#6a2b14'); g.fillStyle = gr; g.fill(); g.restore();
for (let i = 0; i < 9; i++) { g.save(); g.translate(60, 386); g.rotate(-1.2 + i * 0.3); g.beginPath(); g.ellipse(0, -13, 5, 13, 0, 0, 7); const q = g.createLinearGradient(-5, 0, 5, 0); q.addColorStop(0, '#2c6a3a'); q.addColorStop(0.5, '#5aa86a'); q.addColorStop(1, '#245a30'); g.fillStyle = q; g.fill(); g.strokeStyle = 'rgba(10,40,20,0.5)'; g.lineWidth = 0.7; g.stroke(); g.restore(); }
// inner shadow where the glass meets the frame
for (const left of [true, false]) { const s = g.createLinearGradient(left ? 14 : 376, 0, left ? 40 : 350, 0); s.addColorStop(0, 'rgba(0,0,0,0.45)'); s.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = s; g.fillRect(left ? 14 : 350, 10, 26, 394); }
names.push(addProjectImage('scene.png', c, {}).name);
`;
const digitsJS = pre + `
try { await document.fonts.load('130px "Bebas Neue"'); } catch (e) {}
const scene = imgCache.get('scene.png');
const DW = 62, DH = 112, BASE = 104;
const L = [-0.5, -0.55, 0.67], ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;
let hv = [L[0], L[1], L[2] + 1]; const hl = Math.hypot(...hv); hv = hv.map((v) => v / hl);
// glass lettering: frosted body that picks up the blurred city behind it, bevelled rim, specular edge light
function glass(maskDraw, bx, by, w, h) {
  const m = mk(w, h), mg = m.getContext('2d'); mg.fillStyle = '#fff'; mg.strokeStyle = '#fff'; mg.lineJoin = 'round'; mg.lineWidth = 2; maskDraw(mg);
  const A = blurData(m, 0.9), Hh = blurData(m, 3.6);
  const bc = mk(w, h), bg = bc.getContext('2d'); bg.filter = 'blur(5px)'; bg.drawImage(scene, bx, by, w, h, 0, 0, w, h); const B = bg.getImageData(0, 0, w, h).data;
  const out = mk(w, h), og = out.getContext('2d'), id = og.createImageData(w, h), d = id.data;
  const hAt = (x, y) => Hh[(clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)) * 4 + 3] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, a = A[i + 3] / 255; if (a <= 0.01) continue;
    let nx = -(hAt(x + 1, y) - hAt(x - 1, y)) * 9, ny = -(hAt(x, y + 1) - hAt(x, y - 1)) * 9, nz = 1; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const dif = nx * L[0] + ny * L[1] + nz * L[2], sp = Math.pow(Math.max(0, nx * hv[0] + ny * hv[1] + nz * hv[2]), 26), th = Hh[i + 3] / 255, edge = clamp(1 - th * 1.5, 0, 1);
    const bk = [B[i] * 1.7 + 30, B[i + 1] * 1.7 + 38, B[i + 2] * 1.7 + 55];
    let r = bk[0] * 0.55 + 170 * 0.45, gg = bk[1] * 0.55 + 195 * 0.45, b = bk[2] * 0.55 + 240 * 0.45;
    const shade = 0.82 + 0.38 * dif - 0.35 * edge * Math.max(0, -dif); r *= shade; gg *= shade; b *= shade;
    r += 255 * sp * 0.85; gg += 255 * sp * 0.85; b += 255 * sp * 0.9;
    const al = clamp(0.5 + 0.45 * edge + 0.55 * sp + 0.12 * Math.max(dif, 0), 0, 0.96) * a;
    d[i] = clamp(r, 0, 255); d[i + 1] = clamp(gg, 0, 255); d[i + 2] = clamp(b, 0, 255); d[i + 3] = al * 255;
  }
  og.putImageData(id, 0, 0); return out;
}
const POS = { hour: [58, 46], minute: [208, 46] };
for (const part of ['hour', 'minute']) for (let n = 0; n < 10; n++) {
  const [px, py] = POS[part];
  names.push(addProjectImage('glass/' + part + '_' + n + '.png', glass((g) => { g.font = '130px "Bebas Neue"'; g.textAlign = 'center'; g.fillText(String(n), DW / 2, BASE); g.strokeText(String(n), DW / 2, BASE); }, px, py, DW, DH), {}).name);
}
names.push(addProjectImage('glass/colon.png', glass((g) => { g.beginPath(); g.arc(13, 40, 6.5, 0, 7); g.fill(); g.beginPath(); g.arc(13, 78, 6.5, 0, 7); g.fill(); }, 182, 46, 26, DH), {}).name);
`;
const dropsJS = pre + `
const scene = imgCache.get('scene.png');
const c = mk(W, H), g = c.getContext('2d');
const bead = (x, y, r) => {
  if (r < 2) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = 'rgba(210,225,255,0.22)'; g.fill(); g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, Math.max(0.5, r * 0.35), 0, 7); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fill(); return; }
  g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 3; g.shadowOffsetY = 1.5; g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = 'rgba(40,50,80,0.35)'; g.fill(); g.restore();
  g.save(); g.beginPath(); g.arc(x, y, r, 0, 7); g.clip(); g.translate(x, y); g.rotate(Math.PI);
  const s = r * 3.4; g.drawImage(scene, clamp(x - s / 2, 0, W - s), clamp(y - s / 2, 0, H - s), s, s, -r, -r, 2 * r, 2 * r);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(-r, -r, 2 * r, 2 * r); g.restore();
  g.beginPath(); g.arc(x, y, r - r * 0.12, 0, 7); g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = r * 0.3; g.stroke();
  g.beginPath(); g.arc(x, y, r * 0.78, 0.15 * Math.PI, 0.85 * Math.PI); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = Math.max(0.8, r * 0.22); g.stroke();
  g.beginPath(); g.arc(x - r * 0.38, y - r * 0.42, Math.max(0.7, r * 0.2), 0, 7); g.fillStyle = 'rgba(255,255,255,0.95)'; g.fill();
};
const drops = [];
for (let i = 0; i < 230; i++) { const big = rnd() < 0.08, r = big ? 5 + rnd() * 4 : rnd() < 0.5 ? 0.8 + rnd() * 1.3 : 1.8 + rnd() * 2.6; drops.push([14 + rnd() * 362, 12 + rnd() * 392, r]); }
drops.sort((a, b) => a[2] - b[2]);
// a few drops have run and left a short clear trail
for (let i = 0; i < 14; i++) { const [x, y, r] = drops[drops.length - 1 - i]; g.fillStyle = 'rgba(190,210,245,0.07)'; g.fillRect(x - 1, y - 40 - rnd() * 40, 2, 60); }
for (const [x, y, r] of drops) bead(x, y, r);
names.push(addProjectImage('drops_static.png', c, {}).name);
`;
const streakJS = pre + `
const N = 6, SH = 330;
for (let k = 0; k < N; k++) {
  const c = mk(W, SH), g = c.getContext('2d'); g.filter = 'blur(0.5px)'; g.lineCap = 'round';
  for (let i = 0; i < 80; i++) { const x = rnd() * W, y = rnd() * SH, len = 14 + rnd() * 26; g.strokeStyle = 'rgba(190,215,255,' + (0.05 + rnd() * 0.14) + ')'; g.lineWidth = 0.7 + rnd() * 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x - len * 0.14, y + len); g.stroke(); }
  names.push(addProjectImage('anim/rain_' + k + '.png', c, {}).name);
}
`;
const runJS = pre + `
const N = 16, BW = 130, BH = 400, BAND = BAND_IDX;
const D = Array.from({ length: 4 }, (_, i) => ({ x: 16 + ((i + rnd() * 0.7) / 4) * (BW - 32), y0: 10 + rnd() * 190, travel: 110 + rnd() * 90, r: 3.6 + rnd() * 2.6, ph: rnd() }));
const ease = (s) => s - 0.8 * Math.sin(4 * Math.PI * s) / (4 * Math.PI);
for (let k = 0; k < N; k++) {
  const c = mk(BW, BH), g = c.getContext('2d');
  for (const d of D) {
    const s = ((k / N + d.ph) % 1), f = ease(s), y = d.y0 + d.travel * f, a = clamp(Math.min(s / 0.1, (1 - s) / 0.22), 0, 1), x = d.x + 2 * Math.sin(f * 6 + d.ph * 9);
    // wet trail
    const tl = g.createLinearGradient(0, d.y0, 0, y); tl.addColorStop(0, 'rgba(200,220,255,0)'); tl.addColorStop(1, 'rgba(200,220,255,' + 0.2 * a + ')'); g.strokeStyle = tl; g.lineWidth = 2.2; g.beginPath(); g.moveTo(d.x, d.y0); g.lineTo(x, y); g.stroke();
    g.save(); g.globalAlpha = a; const r = d.r;
    g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 3; g.shadowOffsetY = 2; g.beginPath(); g.ellipse(x, y, r * 0.82, r * 1.12, 0, 0, 7); const q = g.createRadialGradient(x, y - r * 0.2, 1, x, y, r * 1.2); q.addColorStop(0, 'rgba(180,200,235,0.16)'); q.addColorStop(1, 'rgba(60,75,115,0.5)'); g.fillStyle = q; g.fill(); g.restore();
    g.beginPath(); g.ellipse(x, y, r * 0.8, r * 1.1, 0, 0.1 * Math.PI, 0.9 * Math.PI); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = Math.max(1, r * 0.24); g.stroke();
    g.beginPath(); g.ellipse(x, y, r * 0.8, r * 1.1, 0, 0, 7); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 0.9; g.stroke();
    g.beginPath(); g.arc(x - r * 0.33, y - r * 0.5, Math.max(0.8, r * 0.2), 0, 7); g.fillStyle = 'rgba(255,255,255,0.95)'; g.fill(); g.restore();
  }
  names.push(addProjectImage('anim/run' + BAND + '_' + k + '.png', c, {}).name);
}
`;
const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const F = 'Bebas Neue';
const steps = [{ preset: 'bg' },
  wrap(sceneJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Scene'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  { preset: 'clock' }, { preset: 'weekday' }, { preset: 'day' }, { preset: 'battery' }, { preset: 'steps' }, { preset: 'clock' },
  { script: `const n = project.elements.length; ['Hour','Colon','Minute'].forEach((nm,i)=>{ project.elements[n-3+i].name = nm + ' Aod'; }); return 1` },
  { remove: 'Colon Aod' },
  wrap(digitsJS, `
    const hr = names.slice(0, 10), mn = names.slice(10, 20), colon = names[20];
    const H1 = project.elements.find((q) => q.name === 'Hour'), M1 = project.elements.find((q) => q.name === 'Minute');
    for (const [e, set, x] of [[H1, hr, 58], [M1, mn, 208]]) { e.glyph = null; e.images = set; e.space = 0; e.zero = 1; e.x = x; e.y = 46; e.show = 'normal'; }
    const col = project.elements.find((q) => q.name === 'Colon'); project.elements = project.elements.filter((q) => q !== col);
    const ce = await addElement('IMG', { src: colon }); ce.name = 'Colon'; ce.src = colon; ce.x = 182; ce.y = 46; ce.show = 'normal';
    // keep the clock layers right after the scene, ahead of the other readouts' creation order
    return 1`),
  wrap(dropsJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Drops on glass'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  wrap(streakJS, `const e = await addElement('IMG_ANIM', { frames: names, fps: 12, animPrefix: 'rain', repeat: 0 }); e.name = 'Rain outside'; e.frames = names; e.x = 0; e.y = 0; e.show = 'normal'; return names.length`),
];
[[0, 4], [1, 9], [2, 14]].forEach(([band, off]) => steps.push(wrap(runJS.replace('BAND_IDX', band), `const fr = names.map((_, k) => names[(k + ${off}) % names.length]); const e = await addElement('IMG_ANIM', { frames: fr, fps: 6, animPrefix: 'run${band}', repeat: 0 }); e.name = 'Running drops ${band + 1}'; e.frames = fr; e.x = ${band * 130}; e.y = 20; e.show = 'normal'; return names.length`)));
const txt = (size, color, extra) => ({ font: F, size, fill: 'solid', color, shadowColor: '#000000', shadowX: 0, shadowY: 1, shadowBlur: 5, ...extra });
steps.push(
  { edit: 'Weekday', set: { x: 96, y: 160 }, glyph: txt(30, '#e8eeff') },
  { edit: 'Day', set: { x: 172, y: 160 }, glyph: txt(30, '#e8eeff') },
  { edit: 'Battery', set: { x: 214, y: 160 }, glyph: txt(30, '#e8eeff') },
  { edit: 'Steps', set: { x: 110, y: 408, alignH: 'CENTER_H', w: 150 }, glyph: txt(30, '#ffd9a8', { shadowColor: '#ff9a3a', shadowBlur: 8 }) },
  { edit: 'Hour Aod', set: { x: 70, y: 120, show: 'aod', zero: 1 }, glyph: { font: F, size: 150, fill: 'solid', color: '#7a8296' } },
  { edit: 'Minute Aod', set: { x: 70, y: 260, show: 'aod', zero: 1 }, glyph: { font: F, size: 150, fill: 'solid', color: '#7a8296' } },
);
fs.writeFileSync('recipe.json', JSON.stringify({ name: 'Rainy Window', device: 'bip-6', font: F, description: 'A rainy night seen from inside through a window: blurred city lights, drops running down the glass and over the glassy clock, a wooden sill with a warm mug.', preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/rainy-window', steps }, null, 1));
