const fs = require('fs');
const pre = `
const W = dev().w, H = dev().h;
let seed = 77; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
// a pinnate fern frond: rib with leaflets that shrink towards the tip
function frond(g, x, y, len, ang, curl, c1, c2, nl, wd) {
  const pts = []; let px = x, py = y;
  for (let i = 0; i <= 24; i++) { const t = i / 24, a = ang + curl * t * t; pts.push([px, py, a]); px += Math.cos(a) * len / 24; py += Math.sin(a) * len / 24; }
  g.lineCap = 'round'; g.strokeStyle = rgba(lerp(c1, [20, 40, 10], 0.5), 0.9); g.lineWidth = Math.max(1, wd * 0.12); g.beginPath(); pts.forEach(([a, b]) => g.lineTo(a, b)); g.stroke();
  for (let i = 3; i <= 24; i++) {
    const t = i / 24, [qx, qy, a] = pts[i], lf = wd * Math.pow(Math.sin(Math.PI * (0.08 + 0.9 * (1 - t))), 0.7) * (1 - 0.35 * t) + 2;
    for (const s of [-1, 1]) { const la = a + s * (1.15 - 0.4 * t), ex = qx + Math.cos(la) * lf, ey = qy + Math.sin(la) * lf, mx = qx + Math.cos(la - s * 0.35) * lf * 0.55, my = qy + Math.sin(la - s * 0.35) * lf * 0.55;
      const q = g.createLinearGradient(qx, qy, ex, ey); q.addColorStop(0, rgba(lerp(c1, c2, 0.1), 0.95)); q.addColorStop(1, rgba(c2, 0.95));
      g.fillStyle = q; g.beginPath(); g.moveTo(qx, qy); g.quadraticCurveTo(mx, my, ex, ey); g.quadraticCurveTo(qx + Math.cos(la + s * 0.4) * lf * 0.5, qy + Math.sin(la + s * 0.4) * lf * 0.5, qx, qy); g.fill(); }
  }
}
// a red stem plant: curved stem with opposite lanceolate leaves
function stem(g, x, y, h, lean, cTip, cBase, leaf, sway) {
  const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([x + lean * t * t * h + (sway || 0) * Math.pow(t, 1.5), y - h * t]); }
  g.strokeStyle = 'rgba(110,40,40,0.9)'; g.lineWidth = 2; g.beginPath(); pts.forEach(([a, b]) => g.lineTo(a, b)); g.stroke();
  for (let i = 2; i <= 14; i++) { const [qx, qy] = pts[i], t = i / 14, ln = leaf * (1.1 - 0.55 * t); for (const s of [-1, 1]) { const a = -Math.PI / 2 + s * (0.9 - 0.3 * t); const ex = qx + Math.cos(a) * ln, ey = qy + Math.sin(a) * ln, nx = Math.cos(a + Math.PI / 2) * ln * 0.2, ny = Math.sin(a + Math.PI / 2) * ln * 0.2; const q = g.createLinearGradient(qx, qy, ex, ey); q.addColorStop(0, rgba(cBase, 0.95)); q.addColorStop(1, rgba(cTip, 0.95)); g.fillStyle = q; g.beginPath(); g.moveTo(qx, qy); g.quadraticCurveTo((qx + ex) / 2 + nx, (qy + ey) / 2 + ny, ex, ey); g.quadraticCurveTo((qx + ex) / 2 - nx, (qy + ey) / 2 - ny, qx, qy); g.fill(); } }
}
// a fuzzy moss mound
function moss(g, cx, cy, r, n) {
  for (let i = 0; i < n; i++) { const a = Math.PI + rnd() * Math.PI, d = Math.sqrt(rnd()) * r, x = cx + Math.cos(a) * d * 1.2, y = cy + Math.sin(a) * d * 0.7 + r * 0.2, la = a + (rnd() - 0.5) * 0.8, l = 4 + rnd() * 9;
    const sh = rnd(); g.strokeStyle = rgba(lerp([30, 70, 16], [150, 190, 60], sh * sh), 0.35 + rnd() * 0.5); g.lineWidth = 0.7 + rnd() * 0.5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(la) * l * 0.6, y + Math.sin(la) * l * 0.6 + 1, x + Math.cos(la) * l, y + Math.sin(la) * l); g.stroke(); }
}
`;

// ---------- static scene: water, driftwood, ferns, moss, red plants, anubias, gravel ----------
const sceneJS = pre + `
const c = mk(W, H), g = c.getContext('2d');
let gr = g.createLinearGradient(0, 0, 0, H);
gr.addColorStop(0, '#9fd6d0'); gr.addColorStop(0.1, '#4f9ea6'); gr.addColorStop(0.35, '#2a7184'); gr.addColorStop(0.65, '#164757'); gr.addColorStop(1, '#0a2229');
g.fillStyle = gr; g.fillRect(0, 0, W, H);
// brighter column of open water under the surface light
gr = g.createRadialGradient(215, 40, 10, 215, 120, 280); gr.addColorStop(0, 'rgba(210,245,235,0.55)'); gr.addColorStop(0.4, 'rgba(120,200,200,0.2)'); gr.addColorStop(1, 'rgba(60,140,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
// out-of-focus background plants (blurred, darker, cooler)
g.save(); g.filter = 'blur(5px)';
for (let i = 0; i < 9; i++) frond(g, 20 + i * 44, 330 + rnd() * 30, 120 + rnd() * 70, -Math.PI / 2 + (rnd() - 0.5) * 0.9, (rnd() - 0.5) * 1.2, [60, 130, 80], [30, 90, 70], 20, 34);
g.restore();
// driftwood from the top-left corner
g.save(); g.lineCap = 'round';
for (const [w, col] of [[40, '#120d08'], [32, '#2a1d12'], [22, '#3c2a1a']]) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(-20, -10); g.bezierCurveTo(30, 60, 20, 140, 70, 210); g.stroke(); }
g.strokeStyle = '#1a120a'; g.lineWidth = 14; g.beginPath(); g.moveTo(40, 90); g.bezierCurveTo(90, 100, 110, 130, 120, 175); g.stroke();
g.restore();
// grain on the wood
for (let i = 0; i < 300; i++) { const t = rnd(), x = -10 + 80 * t * t + rnd() * 20, y = 0 + t * 210; g.fillStyle = 'rgba(' + (rnd() > 0.5 ? '80,60,40' : '10,6,3') + ',' + (0.2 + rnd() * 0.3) + ')'; g.fillRect(x, y, 1 + rnd() * 3, 1); }
moss(g, 40, 150, 46, 520); moss(g, 76, 205, 34, 340); moss(g, 12, 260, 40, 300);
// mid-ground java ferns, bright lit from above
for (const [x, y, l, a, cu, w] of [[22, 255, 150, -1.3, 0.8, 38], [38, 280, 130, -1.0, 0.9, 34], [60, 300, 150, -1.45, -0.5, 36], [-5, 200, 120, -0.6, -0.9, 30], [372, 270, 160, -1.8, -0.9, 40], [380, 220, 120, -2.3, 0.7, 32], [350, 300, 130, -1.35, 0.6, 34], [300, 330, 110, -1.6, 0.9, 30]])
  frond(g, x, y, l, a, cu, [190, 220, 90], [64, 130, 40], 20, w);
// rocks
const rock = (cx, cy, rx, ry, a, b) => { g.save(); g.translate(cx, cy); g.beginPath(); for (let t = 0; t <= TAU + 0.1; t += 0.35) { const k = 1 + 0.15 * Math.sin(t * 3 + cx) + 0.07 * Math.sin(t * 5); g.lineTo(Math.cos(t) * rx * k, Math.sin(t) * ry * k); } g.closePath(); const q = g.createRadialGradient(-rx * 0.3, -ry * 0.6, 2, 0, 0, rx * 1.2); q.addColorStop(0, a); q.addColorStop(1, b); g.fillStyle = q; g.fill(); g.restore(); };
rock(60, 428, 60, 30, '#4a4a42', '#14140f'); rock(330, 436, 70, 30, '#45463e', '#12130e'); rock(190, 450, 90, 26, '#3a3b34', '#0f100c');
moss(g, 58, 412, 40, 260); moss(g, 330, 420, 46, 280);
// red stem plants (Ludwigia) in two clusters
for (const [x, y, h, l, tip, base] of [[96, 420, 130, -0.15, [255, 120, 100], [150, 30, 50]], [112, 424, 105, 0.12, [255, 140, 110], [170, 40, 55]], [80, 424, 95, -0.3, [240, 100, 90], [130, 25, 45]], [300, 430, 110, 0.2, [255, 120, 100], [150, 30, 50]], [318, 432, 140, 0.06, [255, 150, 120], [170, 40, 55]], [340, 430, 90, 0.3, [240, 100, 90], [130, 25, 45]]]) stem(g, x, y, h, l, tip, base, 26);
// anubias: broad glossy leaves on stalks
const leaf = (x, y, ang, len, wd) => { g.save(); g.translate(x, y); g.rotate(ang); g.strokeStyle = '#3d5a1c'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(len * 0.35, 0); g.stroke(); g.translate(len * 0.3, 0); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(len * 0.2, -wd, len * 0.75, -wd * 0.9, len * 0.7, 0); g.bezierCurveTo(len * 0.75, wd * 0.9, len * 0.2, wd, 0, 0); const q = g.createLinearGradient(0, -wd, 0, wd); q.addColorStop(0, '#7fb83a'); q.addColorStop(0.5, '#2f7a2a'); q.addColorStop(1, '#173d1a'); g.fillStyle = q; g.fill(); g.strokeStyle = 'rgba(210,240,150,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 0); g.lineTo(len * 0.62, 0); g.stroke(); g.fillStyle = 'rgba(255,255,230,0.18)'; g.beginPath(); g.ellipse(len * 0.3, -wd * 0.35, len * 0.2, wd * 0.12, 0, 0, 7); g.fill(); g.restore(); };
for (const [x, y, a, l, w] of [[200, 436, -1.2, 80, 24], [205, 438, -0.55, 74, 22], [196, 438, -1.9, 70, 22], [214, 440, -0.15, 56, 18], [186, 440, -2.5, 56, 18]]) leaf(x, y, a, l, w);
// dark gravel with pebbles
g.beginPath(); g.moveTo(0, 440); for (let x = 0; x <= W; x += 8) g.lineTo(x, 438 + Math.sin(x / 31) * 4); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); gr = g.createLinearGradient(0, 430, 0, H); gr.addColorStop(0, '#4a3f33'); gr.addColorStop(1, '#14100c'); g.fillStyle = gr; g.fill();
for (let i = 0; i < 260; i++) { const x = rnd() * W, y = 440 + rnd() * 12, r = 0.8 + rnd() * 1.8; g.fillStyle = ['#8a7a64', '#5e5040', '#a89880', '#3a3028'][i % 4]; g.globalAlpha = 0.5 + rnd() * 0.5; g.beginPath(); g.ellipse(x, y, r * 1.3, r, 0, 0, 7); g.fill(); } g.globalAlpha = 1;
// film grain
{ const id = g.getImageData(0, 0, W, H), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 9; d[i] = clamp(d[i] + n, 0, 255); d[i + 1] = clamp(d[i + 1] + n, 0, 255); d[i + 2] = clamp(d[i + 2] + n, 0, 255); } g.putImageData(id, 0, 0); }
names.push(addProjectImage('scene.png', c, {}).name);
`;

// ---------- god rays from the surface (looping) ----------
const raysJS = pre + `
const N = 8, RH = 340;
const B = [{ a: -0.62, w: 26, p: 0.3 }, { a: -0.4, w: 40, p: 1.4 }, { a: -0.2, w: 22, p: 2.6 }, { a: -0.02, w: 46, p: 3.5 }, { a: 0.17, w: 28, p: 4.6 }, { a: 0.36, w: 38, p: 5.4 }, { a: 0.58, w: 24, p: 0.9 }];
for (let k = 0; k < N; k++) {
  const ph = TAU * k / N, c = mk(W, RH), g = c.getContext('2d');
  g.filter = 'blur(7px)';
  for (const b of B) {
    const al = 0.13 + 0.09 * Math.sin(ph + b.p), a = b.a + 0.025 * Math.sin(ph + b.p * 1.7), ox = 215, len = RH + 40;
    const x1 = ox + Math.sin(a) * len, y1 = Math.cos(a) * len, nx = Math.cos(a), ny = -Math.sin(a);
    const q = g.createLinearGradient(ox, 0, x1, y1); q.addColorStop(0, 'rgba(255,255,235,' + al * 1.8 + ')'); q.addColorStop(0.6, 'rgba(210,250,235,' + al * 0.7 + ')'); q.addColorStop(1, 'rgba(160,230,220,0)');
    g.fillStyle = q; g.beginPath(); g.moveTo(ox - b.w * 0.25, -10); g.lineTo(ox + b.w * 0.25, -10); g.lineTo(x1 + nx * b.w * 1.2, y1 + ny * b.w * 1.2); g.lineTo(x1 - nx * b.w * 1.2, y1 - ny * b.w * 1.2); g.closePath(); g.fill();
  }
  names.push(addProjectImage('anim/rays_' + k + '.png', c, {}).name);
}
`;

// ---------- swaying stem plants and grass blades (looping) ----------
const plantsJS = pre + `
const N = 10, PH = 222, BASE = 216;
for (let k = 0; k < N; k++) {
  const ph = TAU * k / N, c = mk(W, PH), g = c.getContext('2d');
  seed = 77;
  for (const [x, h, l, tip, base, s] of [[34, 150, 0.1, [255, 130, 100], [150, 30, 50], 7], [62, 120, -0.1, [250, 110, 95], [140, 28, 48], 6], [350, 160, -0.08, [255, 135, 105], [155, 32, 52], 7], [372, 120, 0.12, [245, 105, 90], [135, 26, 46], 6]])
    stem(g, x, BASE, h, l, tip, base, 22, s * Math.sin(ph + x));
  // vallisneria: long ribbon blades
  for (let i = 0; i < 16; i++) {
    const x0 = (i < 8 ? 6 + i * 11 : 296 + (i - 8) * 11) + rnd() * 6, h = 90 + rnd() * 80, sw = 8 + rnd() * 8, p = rnd() * TAU, wd = 2.2 + rnd() * 1.6;
    const pts = []; for (let j = 0; j <= 14; j++) { const t = j / 14; pts.push([x0 + sw * Math.sin(ph + p + t * 2.4) * Math.pow(t, 1.3), BASE - h * t]); }
    const q = g.createLinearGradient(0, BASE, 0, BASE - h); q.addColorStop(0, '#2d6a2a'); q.addColorStop(1, '#b8de6a');
    g.fillStyle = q; g.globalAlpha = 0.85; g.beginPath(); pts.forEach(([x, y], j) => g.lineTo(x - wd * (1 - j / 16), y)); for (let j = pts.length - 1; j >= 0; j--) g.lineTo(pts[j][0] + wd * (1 - j / 16), pts[j][1]); g.closePath(); g.fill(); g.globalAlpha = 1;
  }
  names.push(addProjectImage('anim/plants_' + k + '.png', c, {}).name);
}
`;

// ---------- floating particles and a thin stream of bubbles (looping) ----------
const motesJS = pre + `
const N = 12, BH = 380;
const M = Array.from({ length: 70 }, () => ({ x: 40 + rnd() * 320, y: 30 + rnd() * 320, r: 0.5 + rnd() * 1.4, ax: 3 + rnd() * 9, ay: 3 + rnd() * 9, p: rnd() * TAU, tw: rnd() * TAU, m: 1 + Math.floor(rnd() * 2) }));
const BU = Array.from({ length: 6 }, (_, i) => ({ off: i / 6 + rnd() * 0.05, r: 1.5 + rnd() * 2.6, amp: 2 + rnd() * 4, p: rnd() * TAU }));
for (let k = 0; k < N; k++) {
  const ph = TAU * k / N, c = mk(W, BH), g = c.getContext('2d');
  for (const m of M) {
    const x = m.x + m.ax * Math.sin(ph * m.m + m.p), y = m.y + m.ay * Math.cos(ph * m.m + m.p), a = 0.25 + 0.4 * (0.5 + 0.5 * Math.sin(ph * 2 + m.tw)) * (1 - y / BH * 0.6);
    const q = g.createRadialGradient(x, y, 0, x, y, m.r * 2.4); q.addColorStop(0, 'rgba(255,255,240,' + a + ')'); q.addColorStop(1, 'rgba(255,255,240,0)'); g.fillStyle = q; g.beginPath(); g.arc(x, y, m.r * 2.4, 0, 7); g.fill();
  }
  for (const b of BU) {
    const f = (((k / N) + b.off) % 1 + 1) % 1, y = 340 - f * 330, x = 118 + b.amp * Math.sin(TAU * f * 2 + b.p), r = b.r * (0.8 + f * 0.6), a = Math.min(f / 0.06, 1) * (1 - Math.pow(f, 4));
    const q = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); q.addColorStop(0, 'rgba(255,255,255,' + 0.06 * a + ')'); q.addColorStop(0.8, 'rgba(200,240,240,' + 0.18 * a + ')'); q.addColorStop(1, 'rgba(235,255,255,' + 0.8 * a + ')');
    g.fillStyle = q; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,' + 0.85 * a + ')'; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, Math.max(0.6, r * 0.25), 0, 7); g.fill();
  }
  names.push(addProjectImage('anim/motes_' + k + '.png', c, {}).name);
}
`;

// ---------- foreground: rippled surface, dark out-of-focus leaves, vignette ----------
const glassJS = pre + `
const c = mk(W, H), g = c.getContext('2d');
// rippled surface seen from below: bright band with caustic cells
let q = g.createLinearGradient(0, 0, 0, 90); q.addColorStop(0, 'rgba(255,255,245,0.75)'); q.addColorStop(0.35, 'rgba(190,240,230,0.3)'); q.addColorStop(1, 'rgba(160,230,225,0)'); g.fillStyle = q; g.fillRect(0, 0, W, 90);
g.save(); g.beginPath(); g.rect(0, 0, W, 80); g.clip(); g.filter = 'blur(1.2px)';
for (let i = 0; i < 90; i++) { const x = rnd() * W, y = rnd() * 70, rx = 6 + rnd() * 22, ry = 1.5 + rnd() * 3.5; g.strokeStyle = 'rgba(255,255,240,' + (0.12 + rnd() * 0.3) * (1 - y / 90) + ')'; g.lineWidth = 1 + rnd() * 1.4; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0.1, Math.PI - 0.1); g.stroke(); }
g.restore();
for (let i = 0; i < 30; i++) { const x = 120 + rnd() * 200, y = 8 + rnd() * 60, r = 1 + rnd() * 2.4; const s = g.createRadialGradient(x, y, 0, x, y, r * 1.6); s.addColorStop(0, 'rgba(255,255,255,0.95)'); s.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = s; g.beginPath(); g.arc(x, y, r * 1.6, 0, 7); g.fill(); }
// dark, blurred leaves framing the corners
g.save(); g.filter = 'blur(6px)';
for (const [x, y, a, l, w] of [[-15, H + 5, -0.7, 150, 38], [30, H + 10, -1.1, 120, 32], [W + 15, H + 5, -2.4, 150, 38], [W - 40, H + 10, -2.0, 120, 32], [-10, 0, 0.9, 110, 28], [W + 10, 30, 2.4, 90, 24]]) {
  g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(l * 0.25, -w, l * 0.8, -w * 0.8, l, 0); g.bezierCurveTo(l * 0.8, w * 0.8, l * 0.25, w, 0, 0); const lg = g.createLinearGradient(0, -w, 0, w); lg.addColorStop(0, 'rgba(60,110,40,0.85)'); lg.addColorStop(1, 'rgba(8,24,12,0.92)'); g.fillStyle = lg; g.fill(); g.restore(); }
g.restore();
// vignette
q = g.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.45, H * 0.78); q.addColorStop(0, 'rgba(0,15,20,0)'); q.addColorStop(1, 'rgba(0,12,16,0.5)'); g.fillStyle = q; g.fillRect(0, 0, W, H);
names.push(addProjectImage('glass.png', c, {}).name);
`;

// ---------- fish: neon tetra, ember tetra, two guppies; 6 tail frames, both directions ----------
const fishJS = pre + `
const NF = 6, SS = 2, CW = 150, CH = 92, CX = 76, CY = 46;
const SPEC = {
  neon:   { H: 13, BL: 46, A: 4, sk: 0.85, tf: 1.0, bf: 1.0, er: 4.6, body: ['#35505a', '#9db8c4', '#dfeaee', '#f4f7f6'], fin: [200, 215, 220], tail: 'fork', tw: 26, tt: 15 },
  ember:  { H: 12, BL: 42, A: 4, sk: 0.85, tf: 1.0, bf: 1.0, er: 4.2, body: ['#c4501a', '#ff8a30', '#ffb35a', '#ffd9a0'], fin: [255, 170, 90], tail: 'fork', tw: 24, tt: 14 },
  guppy:  { H: 13, BL: 40, A: 5, sk: 0.9, tf: 0.95, bf: 1.0, er: 4.4, body: ['#4a6a60', '#9fc0b0', '#d8e2d0', '#f0ecd8'], fin: [255, 140, 30], tail: 'fan', tw: 46, tt: 30, cols: [[255, 200, 40], [255, 110, 20], [200, 40, 20]], spots: true },
  guppy2: { H: 13, BL: 40, A: 5, sk: 0.9, tf: 0.95, bf: 1.0, er: 4.4, body: ['#3a4f78', '#7aa0d0', '#cfe0ee', '#f0f0f6'], fin: [255, 120, 190], tail: 'fan', tw: 46, tt: 30, cols: [[255, 215, 60], [255, 90, 160], [60, 130, 255]], spots: false }
};
function fish(sp, ph, dir) {
  const S = SPEC[sp], big = mk(CW * SS, CH * SS), g = big.getContext('2d');
  g.scale(SS, SS); g.translate(CX, CY); if (dir < 0) g.scale(-1, 1);
  const HH = S.H, X0 = -S.BL, X1 = S.BL, A = S.A * Math.sin(ph);
  const bend = (x) => A * Math.pow((X1 - x) / (X1 - X0), 2);
  const prof = (u) => HH * Math.max(0.13, Math.pow(Math.sin(Math.PI * Math.pow(u, S.sk)), 0.8));
  const top = [], bot = [];
  for (let i = 0; i <= 30; i++) { const u = i / 30, x = X0 + (X1 - X0) * u; top.push([x, bend(x) - prof(u) * S.tf]); bot.push([x, bend(x) + prof(u) * S.bf]); }
  const yT = (x) => bend(x) - prof((x - X0) / (X1 - X0)) * S.tf, yB = (x) => bend(x) + prof((x - X0) / (X1 - X0)) * S.bf;
  const bodyPath = () => { g.beginPath(); top.forEach(([x, y]) => g.lineTo(x, y)); for (let i = bot.length - 1; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]); g.closePath(); };
  const fc = S.fin;
  // tail
  g.save(); g.translate(X0 + 2, bend(X0)); g.rotate(0.42 * Math.sin(ph + 0.9)); g.scale(1, 1 + 0.06 * Math.sin(ph * 2));
  const L = S.tw, T = S.tt;
  if (S.tail === 'fork') {
    const q = g.createLinearGradient(0, 0, -L, 0); q.addColorStop(0, rgba(fc, 0.75)); q.addColorStop(1, rgba(fc, 0.25));
    g.fillStyle = q; g.beginPath(); g.moveTo(2, -2); g.bezierCurveTo(-L * 0.3, -T * 0.6, -L * 0.7, -T * 0.9, -L, -T); g.quadraticCurveTo(-L * 0.62, 0, -L, T); g.bezierCurveTo(-L * 0.7, T * 0.9, -L * 0.3, T * 0.6, 2, 2); g.closePath(); g.fill();
    g.strokeStyle = rgba(fc, 0.5); g.lineWidth = 0.6; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(-L * 0.92, i * T * 0.3); g.stroke(); }
  } else {
    const q = g.createLinearGradient(0, 0, -L, 0); q.addColorStop(0, rgba(S.cols[0], 0.92)); q.addColorStop(0.55, rgba(S.cols[1], 0.92)); q.addColorStop(1, rgba(S.cols[2], 0.88));
    g.fillStyle = q; g.beginPath(); g.moveTo(2, -2); g.bezierCurveTo(-L * 0.3, -T * 0.9, -L * 0.8, -T * 1.1, -L, -T * 0.5); g.bezierCurveTo(-L * 1.12, -T * 0.1, -L * 1.12, T * 0.1, -L, T * 0.5); g.bezierCurveTo(-L * 0.8, T * 1.1, -L * 0.3, T * 0.9, 2, 2); g.closePath(); g.fill();
    g.save(); g.clip(); g.strokeStyle = 'rgba(255,230,180,0.35)'; g.lineWidth = 0.7; for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(-L * 1.05, i * T * 0.16); g.stroke(); }
    if (S.spots) { for (let i = 0; i < 16; i++) { const a = (i % 8) / 7 - 0.5, r = 6 + Math.floor(i / 8) * 10 + ((i * 7) % 5); g.fillStyle = 'rgba(30,10,5,0.55)'; g.beginPath(); g.arc(-r - 8, a * T * 1.2 * (0.4 + r / 30), 2.2, 0, 7); g.fill(); } g.strokeStyle = 'rgba(40,10,0,0.55)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-L * 0.98, -T * 0.4); g.quadraticCurveTo(-L * 1.08, 0, -L * 0.98, T * 0.4); g.stroke(); }
    g.restore();
  }
  g.restore();
  // dorsal, anal and pelvic fins
  const fin = (x0, x1, h, side, col, al) => { const ya = side < 0 ? yT : yB, hh = h * (1 + 0.1 * Math.sin(ph * 2 + x0)); const q = g.createLinearGradient(0, ya(x0), 0, ya(x0) + side * hh); q.addColorStop(0, rgba(col, al)); q.addColorStop(1, rgba(col, al * 0.3)); g.fillStyle = q; g.beginPath(); g.moveTo(x0, ya(x0)); g.bezierCurveTo(x0 + (x1 - x0) * 0.1, ya(x0) + side * hh, x0 + (x1 - x0) * 0.55, ya(x1) + side * hh * 1.1, x1, ya(x1) + side * hh * 0.5); g.lineTo(x1, ya(x1)); g.closePath(); g.fill(); g.strokeStyle = rgba(col, 0.55); g.lineWidth = 0.6; g.stroke(); };
  if (S.tail === 'fan') { fin(-18, 6, 22, -1, S.cols[1], 0.9); fin(-12, 8, 8, 1, S.cols[0], 0.7); } else { fin(-8, 10, 12, -1, fc, 0.6); fin(-12, 8, 8, 1, fc, 0.55); fin(-4, 8, 5, -1, fc, 0.5); }
  // body
  const bg = g.createLinearGradient(0, -HH, 0, HH); bg.addColorStop(0, S.body[0]); bg.addColorStop(0.3, S.body[1]); bg.addColorStop(0.7, S.body[2]); bg.addColorStop(1, S.body[3]);
  g.save(); g.shadowColor = 'rgba(0,15,25,0.35)'; g.shadowBlur = 4; bodyPath(); g.fillStyle = bg; g.fill(); g.restore();
  g.save(); bodyPath(); g.clip();
  const ribbon = (u0, u1, off, wd, stops) => { g.beginPath(); const n = 18; for (let i = 0; i <= n; i++) { const u = u0 + (u1 - u0) * i / n, x = X0 + (X1 - X0) * u; g.lineTo(x, bend(x) + off * HH - wd * HH / 2); } for (let i = n; i >= 0; i--) { const u = u0 + (u1 - u0) * i / n, x = X0 + (X1 - X0) * u; g.lineTo(x, bend(x) + off * HH + wd * HH / 2); } g.closePath(); const q = g.createLinearGradient(0, off * HH - wd * HH / 2, 0, off * HH + wd * HH / 2); stops.forEach(([p, col]) => q.addColorStop(p, col)); g.fillStyle = q; g.fill(); };
  if (sp === 'neon') { g.save(); g.shadowColor = 'rgba(40,140,255,0.9)'; g.shadowBlur = 5; ribbon(0.06, 0.98, -0.12, 0.34, [[0, '#2f7dff'], [0.5, '#6fe0ff'], [1, '#1c58d8']]); g.restore(); ribbon(-0.1, 0.56, 0.42, 0.55, [[0, '#ff6a40'], [0.5, '#ff2418'], [1, '#c4120f']]); ribbon(-0.1, 0.56, 0.42, 0.55, [[0, 'rgba(255,255,255,0.0)'], [1, 'rgba(255,255,255,0)']]); }
  if (sp === 'guppy') { const q = g.createLinearGradient(X0, 0, X1, 0); q.addColorStop(0, 'rgba(255,130,30,0.75)'); q.addColorStop(0.5, 'rgba(255,170,60,0.15)'); q.addColorStop(1, 'rgba(120,210,200,0.25)'); g.fillStyle = q; g.fillRect(X0, -HH * 1.5, X1 - X0, HH * 3); }
  if (sp === 'guppy2') { const q = g.createLinearGradient(X0, 0, X1, 0); q.addColorStop(0, 'rgba(255,90,170,0.6)'); q.addColorStop(0.45, 'rgba(255,220,90,0.18)'); q.addColorStop(1, 'rgba(90,150,255,0.22)'); g.fillStyle = q; g.fillRect(X0, -HH * 1.5, X1 - X0, HH * 3); }
  // fine scales
  g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 0.6; for (let r = -2; r <= 2; r++) for (let i = 0; i < 16; i++) { const x = X0 + 6 + i * 5 + (r % 2) * 2.5; g.beginPath(); g.arc(x, bend(x) + r * 5, 3, -1.2, 1.2); g.stroke(); }
  // back sheen and belly glow
  const sh = g.createLinearGradient(0, -HH, 0, -HH * 0.2); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.ellipse(2, -HH * 0.62 + A * 0.25, (X1 - X0) * 0.36, HH * 0.14, 0, 0, 7); g.fill();
  g.restore();
  bodyPath(); g.strokeStyle = 'rgba(20,35,40,0.3)'; g.lineWidth = 0.8; g.stroke();
  // gill cover and eye with a silver iris
  const ex = X0 + (X1 - X0) * 0.86, ey = bend(ex) - HH * 0.14;
  g.strokeStyle = 'rgba(30,40,45,0.35)'; g.lineWidth = 1; g.beginPath(); g.arc(X0 + (X1 - X0) * 0.76, bend(0), HH * 0.78, -0.95, 0.95); g.stroke();
  const ir = g.createRadialGradient(ex - 1, ey - 1, 0.5, ex, ey, S.er); ir.addColorStop(0, '#f6f7e6'); ir.addColorStop(0.7, '#b4bfa8'); ir.addColorStop(1, '#6a7468'); g.fillStyle = ir; g.beginPath(); g.arc(ex, ey, S.er, 0, 7); g.fill(); g.strokeStyle = 'rgba(20,30,30,0.6)'; g.lineWidth = 0.7; g.stroke();
  g.fillStyle = '#05070a'; g.beginPath(); g.arc(ex + 0.5, ey, S.er * 0.55, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(ex + S.er * 0.25, ey - S.er * 0.3, S.er * 0.2, 0, 7); g.fill();
  // pectoral fin, almost transparent, flutters
  g.save(); g.translate(X0 + (X1 - X0) * 0.72, bend(0) + HH * 0.3); g.rotate(0.45 * Math.sin(ph * 2 + 1)); g.fillStyle = rgba(fc, 0.5); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-8, -3, -14, 3 + 2 * Math.sin(ph * 2)); g.quadraticCurveTo(-7, 6, 0, 2); g.closePath(); g.fill(); g.restore();
  const out = mk(CW, CH), og = out.getContext('2d'); og.drawImage(big, 0, 0, CW, CH); return out;
}
const FISH = {};
for (const sp of Object.keys(SPEC)) for (const [d, dn] of [[1, 'r'], [-1, 'l']]) for (let k = 0; k < NF; k++) {
  const key = sp + '_' + dn + '_' + k; FISH[key] = addProjectImage('fish/' + key + '.png', fish(sp, TAU * k / NF, d), {}).name; names.push(FISH[key]);
}
globalThis.__fish = FISH;
`;
const slot = (nm, handle, key, x, y, alpha) => ({ script: `const e = await addElement('IMG', { src: globalThis.__fish['${key}'] }); e.name = '${nm}'; e.src = globalThis.__fish['${key}']; e.handle = '${handle}'; e.x = ${x}; e.y = ${y}; e.alpha = ${alpha}; e.show = 'normal'; return 1` });
const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const anim = (name, prefix, fps, y) => `const e = await addElement('IMG_ANIM', { frames: names, fps: ${fps}, animPrefix: '${prefix}', repeat: 0 }); e.name = '${name}'; e.frames = names; e.x = 0; e.y = ${y}; e.show = 'normal'; return names.length`;
const img = (name, y) => `const e = await addElement('IMG', { src: names[0] }); e.name = '${name}'; e.src = names[0]; e.x = 0; e.y = ${y}; e.show = 'normal'; return 1`;
const F = 'Inter';
const tag = (suffix) => ({ script: `const n = project.elements.length; for (const i of [n-3,n-2,n-1]) project.elements[i].name += ' ${suffix}'; return 1` });

const userCode = `{
  // Fish are plain IMG layers moved with MORE {x, y, src}: up to three swim at a time, some behind the clock, some in front.
  const MS = 100, SW = 390, SPW = 150, NF = 6, TOPY = 30, BOTY = 300
  const SPECIES = ['neon', 'ember', 'guppy', 'guppy2']
  const SLOTS = ['b0', 'b1', 'b2', 'f0', 'f1', 'f2']
  const active = {}
  let id = null, tickN = 0, target = 2, nextTarget = 30, nextSpawn = 5
  const rand = (a, b) => a + Math.random() * (b - a)
  const park = (s) => { active[s] = null; try { W[s].setProperty(ui.prop.MORE, { x: pxv(-400), y: pxv(0) }) } catch (e) {} }
  const count = () => SLOTS.filter((s) => active[s]).length
  const freeSlot = () => {
    const back = ['b0', 'b1', 'b2'], front = ['f0', 'f1', 'f2']
    const first = Math.random() < 0.5 ? back : front, second = first === back ? front : back
    for (const s of first.concat(second)) if (!active[s]) return s
    return null
  }
  const spawn = (fromEdge) => {
    const s = freeSlot()
    if (!s) return
    let y = 0, ok = false
    for (let i = 0; i < 8 && !ok; i++) { y = rand(TOPY, BOTY); ok = SLOTS.every((o) => !active[o] || Math.abs(active[o].base - y) > 80) }
    const dir = Math.random() < 0.5 ? 1 : -1
    const sp = SPECIES[Math.floor(Math.random() * SPECIES.length)]
    const guppy = sp.indexOf('guppy') === 0
    active[s] = { sp, dir, vx: guppy ? rand(1.2, 2.4) : rand(1.8, 3.4), base: y, x: fromEdge ? (dir > 0 ? -SPW : SW) : rand(30, SW - SPW - 30), amp: rand(3, 10), bob: rand(0.04, 0.08), ph: rand(0, 6.28), age: 0, rate: rand(0.8, 1.2), sm: 1, smT: 1, turned: false, drift: rand(-0.1, 0.1) }
  }
  const tick = () => {
    tickN++
    if (tickN >= nextTarget) { const r = Math.random(); target = r < 0.15 ? 0 : r < 0.45 ? 1 : r < 0.75 ? 2 : 3; nextTarget = tickN + Math.floor(rand(50, 110)) }
    if (count() < target && tickN >= nextSpawn) { spawn(true); nextSpawn = tickN + Math.floor(rand(8, 40)) }
    for (const s of SLOTS) {
      const f = active[s]
      if (!f) continue
      f.age++
      if (f.age % 30 === 0) f.smT = Math.random() < 0.2 ? rand(1.6, 2.2) : rand(0.45, 1.2)
      f.sm += (f.smT - f.sm) * 0.12
      if (!f.turned && f.age > 40 && Math.random() < 0.004) { f.turned = true; f.dir = -f.dir }
      f.x += f.dir * f.vx * f.sm
      f.base = Math.max(TOPY, Math.min(BOTY, f.base + f.drift))
      const y = f.base + f.amp * Math.sin(f.age * f.bob + f.ph)
      const fr = Math.floor(f.age * f.rate * (0.6 + 0.4 * f.sm)) % NF
      if (f.x < -SPW - 4 || f.x > SW + 4) { park(s); continue }
      W[s].setProperty(ui.prop.MORE, { x: pxv(Math.round(f.x)), y: pxv(Math.round(y)), src: A('fish/' + f.sp + '_' + (f.dir > 0 ? 'r' : 'l') + '_' + fr + '.png') })
    }
  }
  const safe = () => { try { tick() } catch (e) {} }
  const start = () => { if (id === null) { try { id = setInterval(safe, MS) } catch (e) {} } }
  const stop = () => { if (id !== null) { try { clearInterval(id) } catch (e) {} id = null } }
  SLOTS.forEach(park)
  spawn(false); spawn(false)
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: start, pause_call: stop })
  safe()
  start()
}`;

const steps = [{ preset: 'bg' },
  wrap(sceneJS, img('Scene', 0)),
  wrap(raysJS, anim('Light rays', 'rays', 5, 0)),
  wrap(plantsJS, anim('Plants', 'plants', 6, 226)),
  wrap(fishJS, 'return names.length'),
  slot('Fish back 0', 'b0', 'neon_r_0', 40, 80, 235), slot('Fish back 1', 'b1', 'guppy_l_0', 220, 200, 235), slot('Fish back 2', 'b2', 'ember_r_0', -400, 0, 235),
  { preset: 'clock' }, tag('Main'), { preset: 'clock' }, tag('Aod'), { preset: 'weekday' }, { preset: 'day' }, { preset: 'temp' },
  slot('Fish front 0', 'f0', 'guppy2_r_0', 90, 250, 255), slot('Fish front 1', 'f1', 'neon_l_0', -400, 0, 255), slot('Fish front 2', 'f2', 'ember_l_0', -400, 0, 255),
  wrap(motesJS, anim('Particles', 'motes', 8, 40)),
  wrap(glassJS, img('Glass', 0)),
  { remove: 'Colon Aod' },
];
const face = (size) => ({ font: F, size, weight: 500, fill: 'gradient', from: '#ffffff', to: '#d6f0ea', angle: 90, borderColor: '#0a2a30', borderWidth: 2, shadowColor: '#02161a', shadowX: 0, shadowY: 2, shadowBlur: 10 });
const dim = { font: F, size: 110, weight: 700, fill: 'solid', color: '#2f7a78' };
steps.push(
  { edit: 'Hour Main', set: { x: 50, y: 126, show: 'normal', zero: 1 }, glyph: face(96) },
  { edit: 'Colon Main', set: { x: 178, y: 130, show: 'normal' }, glyph: face(96) },
  { edit: 'Minute Main', set: { x: 214, y: 126, show: 'normal', zero: 1 }, glyph: face(96) },
  { edit: 'Hour Aod', set: { x: 60, y: 90, show: 'aod', zero: 1 }, glyph: dim },
  { edit: 'Minute Aod', set: { x: 60, y: 230, show: 'aod', zero: 1 }, glyph: dim },
  { edit: 'Weekday', set: { x: 128, y: 70, show: 'normal' }, glyph: { ...face(30), weight: 700 } },
  { edit: 'Day', set: { x: 196, y: 76, show: 'normal' }, glyph: { ...face(30), weight: 700 } },
  { edit: 'Temperature', set: { x: 160, y: 256, show: 'normal' }, glyph: face(32) },
);
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: 'Planted Tank', device: 'bip-6', font: F, optimizePng: 64,
  description: 'A natural planted freshwater aquarium: light rays through a rippled surface, driftwood with moss, java ferns, red stem plants and anubias. Up to three fish (neon tetras, ember tetras, guppies) spawn at random and swim behind and in front of the clock.',
  preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/planted-tank', userCode, steps }, null, 1));
