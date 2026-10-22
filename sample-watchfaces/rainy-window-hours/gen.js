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

// Six looks of the same city and street, picked by the time of day (minutes after midnight). The skyline, the lights and the
// windows are drawn with the same random seed, so it is one place that changes light, not six places.
const ALL = ['#ffb455', '#ffd890', '#ff4a3a', '#46e0ff', '#7dff9a', '#ffe9b0', '#ff8a3a', '#ffffff'];
const WARM = ['#ffb455', '#ffd890', '#ff8a3a', '#ffe9b0', '#ff6a3a', '#ffffff'];
const GREY = ['#ffd890', '#ff4a3a', '#ffffff', '#ffe9b0', '#ffffff'];
const PH = [
  { id: 'night', from: 1290, sky: ['#070b1e', '#171a3a', '#3d2446', '#6e3b4c'], glows: [[90, 120, 150, 'rgba(120,70,130,0.35)'], [300, 80, 160, 'rgba(70,90,160,0.3)'], [200, 190, 220, 'rgba(160,80,110,0.3)']], sun: null, tow: ['#232a4a', '#161c38', '#0b0f24'], litMul: 1, haze: null, road: ['#171a2c', '#07080f'], pal: ALL, bk: 1, fog: [150, 170, 210, 0.16], lamp: 1, red: 1 },
  { id: 'dawn', from: 330, sky: ['#2c3a66', '#6a6f9c', '#e79a96', '#ffcf9a'], glows: [[110, 140, 170, 'rgba(160,130,190,0.25)'], [290, 220, 170, 'rgba(255,190,150,0.22)']], sun: { x: 290, y: 305, r: 190, col: '255,190,150', a: 0.45 }, tow: ['#3f4a6c', '#2c3556', '#1c2342'], litMul: 0.5, haze: 'rgba(255,190,170,0.08)', road: ['#2a3048', '#0d1018'], pal: WARM, bk: 0.8, fog: [220, 190, 200, 0.15], lamp: 0.6, red: 1 },
  { id: 'day', from: 480, sky: ['#6f7d8c', '#8d99a5', '#a9b2ba', '#bcc3c8'], glows: [[90, 110, 170, 'rgba(255,255,255,0.14)'], [300, 70, 180, 'rgba(235,240,248,0.16)'], [200, 200, 230, 'rgba(255,255,255,0.1)']], sun: null, tow: ['#7d8794', '#616c7a', '#47505e'], litMul: 0.12, haze: 'rgba(200,210,220,0.18)', road: ['#4a5058', '#23272c'], pal: GREY, bk: 0.6, fog: [210, 222, 235, 0.2], lamp: 0.15, red: 0 },
  { id: 'golden', from: 990, sky: ['#5f7fa8', '#9bb0c8', '#f0c78a', '#ffd9a0'], glows: [[110, 120, 160, 'rgba(255,230,190,0.18)'], [300, 150, 170, 'rgba(255,200,140,0.2)']], sun: { x: 120, y: 292, r: 210, col: '255,215,140', a: 0.6 }, tow: ['#6b7288', '#4c5268', '#323850'], litMul: 0.15, haze: 'rgba(255,215,160,0.12)', road: ['#4a4548', '#1a1718'], pal: WARM, bk: 0.75, fog: [255, 235, 200, 0.14], lamp: 0.35, red: 0 },
  { id: 'sunset', from: 1110, sky: ['#2b2150', '#8a3f6a', '#e8725a', '#ffb25c'], glows: [[100, 130, 160, 'rgba(200,90,130,0.28)'], [300, 200, 190, 'rgba(255,150,90,0.25)']], sun: { x: 250, y: 300, r: 190, col: '255,160,80', a: 0.6 }, tow: ['#4a3050', '#33253f', '#20182e'], litMul: 0.35, haze: 'rgba(255,150,90,0.1)', road: ['#3a2434', '#120a12'], pal: WARM, bk: 0.9, fog: [255, 190, 150, 0.12], lamp: 0.7, red: 0 },
  { id: 'dusk', from: 1185, sky: ['#10163a', '#2a2f68', '#5a4a8a', '#c0708a'], glows: [[100, 120, 160, 'rgba(120,80,160,0.3)'], [300, 90, 170, 'rgba(70,100,180,0.28)'], [200, 200, 220, 'rgba(190,100,130,0.26)']], sun: null, tow: ['#2e3560', '#1e2448', '#12163a'], litMul: 0.8, haze: null, road: ['#20243e', '#0a0c18'], pal: ALL, bk: 0.9, fog: [160, 160, 210, 0.16], lamp: 0.9, red: 1 },
];
const NP = PH.length, PREV = +(process.env.PREV || 2), BACK = 'dusk';
const sceneJS = (P) => pre + `const P = ${JSON.stringify(P)};

const c = mk(W, H), g = c.getContext('2d');
// ---- the city, drawn sharp and then blurred: seen through wet glass
const city = mk(W, H), cg = city.getContext('2d');
let gr = cg.createLinearGradient(0, 0, 0, 330); P.sky.forEach((c, i) => gr.addColorStop([0, 0.5, 0.85, 1][i], c)); cg.fillStyle = gr; cg.fillRect(0, 0, W, 330);
cg.save(); cg.filter = 'blur(14px)'; for (const [x, y, w, col] of P.glows) { cg.fillStyle = col; cg.beginPath(); cg.ellipse(x, y, w, 22, 0, 0, 7); cg.fill(); } cg.restore();
const HOR = 322;
if (P.sun) { const s = P.sun, q = cg.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r); q.addColorStop(0, 'rgba(' + s.col + ',' + s.a + ')'); q.addColorStop(1, 'rgba(' + s.col + ',0)'); cg.fillStyle = q; cg.fillRect(0, 0, W, HOR); }
const towers = (n, hmin, hmax, wmin, wmax, col, lit) => { let x = -20; while (x < W + 20) { const w = wmin + rnd() * (wmax - wmin), h = hmin + rnd() * (hmax - hmin); cg.fillStyle = col; cg.fillRect(x, HOR - h, w, h + 4);
  if (lit) for (let wx = x + 4; wx < x + w - 5; wx += 7) for (let wy = HOR - h + 6; wy < HOR - 4; wy += 10) { const q0 = rnd(), k = rnd(); if (q0 < lit * P.litMul) { cg.fillStyle = k < 0.6 ? 'rgba(255,214,140,' + (0.5 + rnd() * 0.5) + ')' : k < 0.85 ? 'rgba(255,240,200,0.9)' : 'rgba(150,200,255,0.8)'; cg.fillRect(wx, wy, 3.2, 4.4); } }
  x += w + rnd() * 6; } };
towers(0, 40, 120, 20, 46, P.tow[0], 0.25); towers(0, 70, 170, 24, 54, P.tow[1], 0.3); towers(0, 90, 230, 30, 64, P.tow[2], 0.22);
if (P.haze) { cg.fillStyle = P.haze; cg.fillRect(0, 0, W, HOR); }
if (P.red) { cg.fillStyle = '#ff2a2a'; cg.beginPath(); cg.arc(268, HOR - 238, 2.5, 0, 7); cg.fill(); cg.fillRect(267.2, HOR - 236, 1.6, 40); }
// wet road with reflections
gr = cg.createLinearGradient(0, HOR, 0, H); gr.addColorStop(0, P.road[0]); gr.addColorStop(1, P.road[1]); cg.fillStyle = gr; cg.fillRect(0, HOR, W, H - HOR);
const lights = P.pal;
const L = Array.from({ length: 40 }, () => ({ x: rnd() * W, y: 190 + rnd() * 150, r: 5 + rnd() * 13, col: lights[rnd() * lights.length | 0], a: (0.16 + rnd() * 0.26) * P.bk }));
cg.save(); cg.globalCompositeOperation = 'lighter'; for (const l of L) { if (l.y < 250) continue; const s = cg.createLinearGradient(0, HOR, 0, HOR + 90 + l.r * 2); s.addColorStop(0, l.col); s.addColorStop(1, 'rgba(0,0,0,0)'); cg.globalAlpha = l.a * 0.4; cg.fillStyle = s; cg.fillRect(l.x - l.r * 0.5, HOR, l.r, 90 + l.r * 2); } cg.restore();
// soften everything: it is behind rain-streaked glass
g.filter = 'blur(3.2px)'; g.drawImage(city, 0, 0); g.filter = 'none';
// bokeh discs
g.save(); g.globalCompositeOperation = 'lighter';
for (const l of L) { const q = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r); q.addColorStop(0, l.col.replace('#', '#') + '00'); const rgb = [parseInt(l.col.slice(1, 3), 16), parseInt(l.col.slice(3, 5), 16), parseInt(l.col.slice(5, 7), 16)].join(',');
  q.addColorStop(0, 'rgba(' + rgb + ',' + l.a * 0.55 + ')'); q.addColorStop(0.8, 'rgba(' + rgb + ',' + l.a * 0.75 + ')'); q.addColorStop(0.93, 'rgba(' + rgb + ',' + l.a + ')'); q.addColorStop(1, 'rgba(' + rgb + ',0)'); g.fillStyle = q; g.beginPath(); g.arc(l.x, l.y, l.r, 0, 7); g.fill(); }
g.restore();
// fog on the glass toward the sill, faint grain
gr = g.createLinearGradient(0, 300, 0, 410); gr.addColorStop(0, 'rgba(' + P.fog.slice(0, 3) + ',0)'); gr.addColorStop(1, 'rgba(' + P.fog.slice(0, 3) + ',' + P.fog[3] + ')'); g.fillStyle = gr; g.fillRect(0, 300, W, 110);
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
gr = g.createRadialGradient(195, 404, 10, 195, 410, 200); gr.addColorStop(0, 'rgba(255,170,90,' + 0.3 * P.lamp + ')'); gr.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = gr; g.fillRect(0, 404, W, 46);
// mug with a hint of steam, and a small plant on the sill
g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 7; g.shadowOffsetY = 4; g.beginPath(); g.moveTo(296, 372); g.lineTo(334, 372); g.lineTo(331, 406); g.quadraticCurveTo(315, 411, 299, 406); g.closePath(); gr = g.createLinearGradient(296, 0, 336, 0); gr.addColorStop(0, '#9a9a9a'); gr.addColorStop(0.35, '#f4f1ea'); gr.addColorStop(1, '#8b8680'); g.fillStyle = gr; g.fill(); g.restore();
g.strokeStyle = '#d9d4ca'; g.lineWidth = 4.5; g.beginPath(); g.arc(336, 388, 9, -1.3, 1.3); g.stroke(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.beginPath(); g.arc(336, 388, 11, -1.3, 1.3); g.stroke();
g.beginPath(); g.ellipse(315, 373, 19, 4, 0, 0, 7); g.fillStyle = '#3b2314'; g.fill();
g.save(); g.filter = 'blur(3px)'; g.strokeStyle = 'rgba(255,240,225,0.28)'; g.lineWidth = 5; for (const dx of [-6, 4]) { g.beginPath(); g.moveTo(315 + dx, 366); g.bezierCurveTo(309 + dx, 352, 322 + dx, 344, 314 + dx, 328); g.stroke(); } g.restore();
g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 6; g.shadowOffsetY = 3; g.beginPath(); g.moveTo(44, 408); g.lineTo(76, 408); g.lineTo(72, 384); g.lineTo(48, 384); g.closePath(); gr = g.createLinearGradient(44, 0, 76, 0); gr.addColorStop(0, '#8a3f22'); gr.addColorStop(0.4, '#c9683c'); gr.addColorStop(1, '#6a2b14'); g.fillStyle = gr; g.fill(); g.restore();
for (let i = 0; i < 9; i++) { g.save(); g.translate(60, 386); g.rotate(-1.2 + i * 0.3); g.beginPath(); g.ellipse(0, -13, 5, 13, 0, 0, 7); const q = g.createLinearGradient(-5, 0, 5, 0); q.addColorStop(0, '#2c6a3a'); q.addColorStop(0.5, '#5aa86a'); q.addColorStop(1, '#245a30'); g.fillStyle = q; g.fill(); g.strokeStyle = 'rgba(10,40,20,0.5)'; g.lineWidth = 0.7; g.stroke(); g.restore(); }
// inner shadow where the glass meets the frame
for (const left of [true, false]) { const s = g.createLinearGradient(left ? 14 : 376, 0, left ? 40 : 350, 0); s.addColorStop(0, 'rgba(0,0,0,0.45)'); s.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = s; g.fillRect(left ? 14 : 350, 10, 26, 394); }
names.push(addProjectImage('scene_' + P.id + '.png', c, {}).name);
`;
const digitsJS = pre + `
try { await document.fonts.load('130px "Bebas Neue"'); } catch (e) {}
const scene = imgCache.get('scene_' + ${JSON.stringify(BACK)} + '.png');
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
    let r = bk[0] * 0.55 + 135 * 0.45, gg = bk[1] * 0.55 + 160 * 0.45, b = bk[2] * 0.55 + 225 * 0.45;
    const shade = 0.82 + 0.38 * dif - 0.35 * edge * Math.max(0, -dif); r *= shade; gg *= shade; b *= shade;
    r += 255 * sp * 0.85; gg += 255 * sp * 0.85; b += 255 * sp * 0.9;
    const al = clamp(0.5 + 0.45 * edge + 0.55 * sp + 0.12 * Math.max(dif, 0), 0, 0.96) * a;
    d[i] = clamp(r, 0, 255); d[i + 1] = clamp(gg, 0, 255); d[i + 2] = clamp(b, 0, 255); d[i + 3] = al * 255;
  }
  og.putImageData(id, 0, 0);
  const fin = mk(w, h), fg = fin.getContext('2d'); fg.filter = 'blur(3.5px)'; fg.globalAlpha = 0.8; fg.drawImage(m, 0, 0); fg.filter = 'none'; fg.globalCompositeOperation = 'source-in'; fg.fillStyle = 'rgba(8,12,28,1)'; fg.fillRect(0, 0, w, h); fg.globalCompositeOperation = 'source-over'; fg.globalAlpha = 1; fg.drawImage(out, 0, 0); return fin;
}
const POS = { hour: [58, 46], minute: [208, 46] };
for (const part of ['hour', 'minute']) for (let n = 0; n < 10; n++) {
  const [px, py] = POS[part];
  names.push(addProjectImage('glass/' + part + '_' + n + '.png', glass((g) => { g.font = '130px "Bebas Neue"'; g.textAlign = 'center'; g.fillText(String(n), DW / 2, BASE); g.strokeText(String(n), DW / 2, BASE); }, px, py, DW, DH), {}).name);
}
names.push(addProjectImage('glass/colon.png', glass((g) => { g.beginPath(); g.arc(13, 40, 6.5, 0, 7); g.fill(); g.beginPath(); g.arc(13, 78, 6.5, 0, 7); g.fill(); }, 182, 46, 26, DH), {}).name);
`;
const dropsJS = (id) => pre + `
const scene = imgCache.get('scene_' + '${id}' + '.png');
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
names.push(addProjectImage('drops_${id}.png', c, {}).name);
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
const rot = (k) => `names.slice(${PREV}).concat(names.slice(0, ${PREV}))`;
const steps = [{ preset: 'bg' }];
PH.forEach((P) => steps.push(wrap(sceneJS(P), `window.__sc = window.__sc || {}; window.__sc['${P.id}'] = names[0]; return 1`)));
steps.push(
  { script: `const names = ${JSON.stringify(PH.map((P) => P.id))}.map((id) => window.__sc[id]); const e = await addElement('IMG', { src: names[${PREV}] }); e.name = 'Scene'; e.src = names[${PREV}]; e.images = ${rot()}; e.handle = 'scene'; e.x = 0; e.y = 0; e.show = 'normal'; return names.length` },
  { preset: 'clock' }, { preset: 'weekday' }, { preset: 'day' }, { preset: 'battery' }, { preset: 'steps' }, { preset: 'clock' },
  { script: `const n = project.elements.length; ['Hour','Colon','Minute'].forEach((nm,i)=>{ project.elements[n-3+i].name = nm + ' Aod'; }); return 1` },
  { remove: 'Colon Aod' },
  wrap(digitsJS, `
    const hr = names.slice(0, 10), mn = names.slice(10, 20), colon = names[20];
    const H1 = project.elements.find((q) => q.name === 'Hour'), M1 = project.elements.find((q) => q.name === 'Minute');
    for (const [e, set, x] of [[H1, hr, 56], [M1, mn, 206]]) { e.glyph = null; e.images = set; e.space = 0; e.zero = 1; e.x = x; e.y = 46; e.show = 'normal'; }
    const col = project.elements.find((q) => q.name === 'Colon'); project.elements = project.elements.filter((q) => q !== col);
    const ce = await addElement('IMG', { src: colon }); ce.name = 'Colon'; ce.src = colon; ce.x = 180; ce.y = 46; ce.show = 'normal';
    return 1`),
);
PH.forEach((P) => steps.push(wrap(dropsJS(P.id), `window.__dr = window.__dr || {}; window.__dr['${P.id}'] = names[0]; return 1`)));
steps.push(
  { script: `const names = ${JSON.stringify(PH.map((P) => P.id))}.map((id) => window.__dr[id]); const e = await addElement('IMG', { src: names[${PREV}] }); e.name = 'Drops on glass'; e.src = names[${PREV}]; e.images = ${rot()}; e.handle = 'drops'; e.x = 0; e.y = 0; e.show = 'normal'; return names.length` },
  wrap(streakJS, `const e = await addElement('IMG_ANIM', { frames: names, fps: 12, animPrefix: 'rain', repeat: 0 }); e.name = 'Rain outside'; e.frames = names; e.x = 0; e.y = 0; e.show = 'normal'; return names.length`),
);
[[0, 4], [1, 9], [2, 14]].forEach(([band, off]) => steps.push(wrap(runJS.replace('BAND_IDX', band), `const fr = names.map((_, k) => names[(k + ${off}) % names.length]); const e = await addElement('IMG_ANIM', { frames: fr, fps: 6, animPrefix: 'run${band}', repeat: 0 }); e.name = 'Running drops ${band + 1}'; e.frames = fr; e.x = ${band * 130}; e.y = 20; e.show = 'normal'; return names.length`)));
const txt = (size, color, extra) => ({ font: F, size, fill: 'solid', color, shadowColor: '#000000', shadowX: 0, shadowY: 1, shadowBlur: 5, ...extra });
steps.push(
  { edit: 'Weekday', set: { x: 112, y: 160 }, glyph: txt(30, '#f2f5ff') },
  { edit: 'Day', set: { x: 166, y: 160 }, glyph: txt(30, '#f2f5ff') },
  { edit: 'Battery', set: { x: 215, y: 160 }, glyph: txt(30, '#f2f5ff') },
  { edit: 'Steps', set: { x: 126, y: 408, alignH: 'CENTER_H', w: 150 }, glyph: txt(30, '#ffd9a8', { shadowColor: '#ff9a3a', shadowBlur: 8 }) },
  { edit: 'Hour Aod', set: { x: 129, y: 96, show: 'aod', zero: 1 }, glyph: { font: F, size: 150, fill: 'solid', color: '#7a8296' } },
  { edit: 'Minute Aod', set: { x: 125, y: 236, show: 'aod', zero: 1 }, glyph: { font: F, size: 150, fill: 'solid', color: '#7a8296' } },
  { script: `project.groups = project.groups || {}; project.groups.gRain = 'Rain'; let n = 0; for (const e of project.elements) { if (['Drops on glass','Rain outside'].includes(e.name) || /^Running drops/.test(e.name)) { e.group = 'gRain'; n++ } } return n` },
  { script: `project.groups = project.groups || {}; project.groups.gDate = 'Date'; let n = 0; for (const e of project.elements) { if (e.name === 'Weekday' || e.name === 'Day' || e.name === 'Month') { e.group = 'gDate'; n++ } } for (const k of Object.keys(project.groups)) if (project.groups[k] === 'Clock 2') project.groups[k] = 'Clock AOD'; return n` },
  { script: `document.getElementById('btnPruneImages').click(); return project.images.length + ' images left'` },
);

// Runs on the watch. Every few seconds it looks at the clock and, when the time of day has moved into another look, swaps the
// scene and the drops on the glass (a plain IMG changes picture through MORE, as on Beer Minute). The rain is the animations above.
const userImports = "import { Time as DCTime } from '@zos/sensor'";
const userCode = `{
  const NP = ${NP}, PREV = ${PREV}, MS = 5000
  const FROM = ${JSON.stringify(PH.map((P) => [P.from, PH.indexOf(P)]).sort((a, b) => a[0] - b[0]))}
  let id = null, cur = -1, clock = null
  try { clock = new DCTime() } catch (e) {}
  const minutes = () => {
    try { if (clock) { const h = clock.getHours(), m = clock.getMinutes(); if (typeof h === 'number' && typeof m === 'number') return h * 60 + m } } catch (e) {}
    try { const d = new Date(); return d.getHours() * 60 + d.getMinutes() } catch (e) {}
    return 600
  }
  const phase = (m) => { let p = 0; for (const f of FROM) if (m >= f[0]) p = f[1]; return p }
  const tick = () => {
    const p = phase(minutes())
    if (p === cur) return
    cur = p
    const i = (p - PREV + NP) % NP
    W.scene.setProperty(ui.prop.MORE, { x: pxv(0), y: pxv(0), src: F.scene[i] })
    W.drops.setProperty(ui.prop.MORE, { x: pxv(0), y: pxv(0), src: F.drops[i] })
  }
  const safe = () => { try { tick() } catch (e) {} }
  const stop = () => { if (id === null) return; try { clearInterval(id) } catch (e) {} id = null }
  const start = () => { if (id !== null) return; try { id = setInterval(safe, MS) } catch (e) {} }
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: () => { cur = -1; safe(); start() }, pause_call: stop })
  safe()
  start()
}`;
const tagn = process.env.PREV ? '-' + PH[PREV].id : '';
const full = { name: 'Rainy Window Hours', device: 'bip-6', font: F, description: 'A rainy window onto a city that follows the time of day: dawn, grey daylight, golden hour, sunset, dusk and a neon night, with drops running down the glass and over the glassy clock.', preview: 'preview' + tagn + '.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/rainy-window-hours', optimizePng: 32, userImports, userCode, steps };
if (tagn) { delete full.save; delete full.out; delete full.previewAod; delete full.optimizePng; }
fs.writeFileSync(__dirname + '/recipe' + tagn + '.json', JSON.stringify(full, null, 1));
