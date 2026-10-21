const fs = require('fs');
const pre = `
const W = dev().w, H = dev().h;
let seed = 41; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const SAND_Y = 392;
`;

// ---------- static scene: water, sand, rocks, castle, chest, coral ----------
const sceneJS = pre + `
const c = mk(W, H), g = c.getContext('2d');
let gr = g.createLinearGradient(0, 0, 0, H);
gr.addColorStop(0, '#8fe9ff'); gr.addColorStop(0.18, '#3cc3ea'); gr.addColorStop(0.5, '#1581c4'); gr.addColorStop(0.8, '#0b4a8c'); gr.addColorStop(1, '#082a5a');
g.fillStyle = gr; g.fillRect(0, 0, W, H);
// soft depth haze blobs
for (let i = 0; i < 26; i++) { const x = rnd() * W, y = 60 + rnd() * 300, r = 40 + rnd() * 90; const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, 'rgba(120,230,255,' + (0.05 + rnd() * 0.06) + ')'); q.addColorStop(1, 'rgba(120,230,255,0)'); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2); }
// distant hills and rocks, hazy blue
for (const [x0, w, h, a] of [[-30, 170, 80, 0.5], [110, 190, 110, 0.42], [250, 200, 70, 0.5]]) { g.beginPath(); g.moveTo(x0, SAND_Y + 4); g.bezierCurveTo(x0 + w * 0.2, SAND_Y - h, x0 + w * 0.7, SAND_Y - h * 0.9, x0 + w, SAND_Y + 4); g.closePath(); const q = g.createLinearGradient(0, SAND_Y - h, 0, SAND_Y); q.addColorStop(0, 'rgba(20,90,150,' + a + ')'); q.addColorStop(1, 'rgba(10,50,110,' + a + ')'); g.fillStyle = q; g.fill(); }
// sand floor with dunes
g.beginPath(); g.moveTo(0, SAND_Y + 6); for (let x = 0; x <= W; x += 6) g.lineTo(x, SAND_Y + 6 + Math.sin(x / 38) * 5 + Math.sin(x / 13) * 1.5); g.lineTo(W, H); g.lineTo(0, H); g.closePath();
gr = g.createLinearGradient(0, SAND_Y, 0, H); gr.addColorStop(0, '#f6e2a8'); gr.addColorStop(0.35, '#d9b878'); gr.addColorStop(1, '#8c6a3c'); g.fillStyle = gr; g.fill();
g.save(); g.clip();
for (let i = 0; i < 18; i++) { const y = SAND_Y + 14 + i * 3.4; g.beginPath(); for (let x = 0; x <= W; x += 6) g.lineTo(x, y + Math.sin(x / (22 + i) + i) * 2); g.strokeStyle = 'rgba(255,245,210,' + (0.13 - i * 0.005) + ')'; g.lineWidth = 1.2; g.stroke(); }
for (let i = 0; i < 160; i++) { const x = rnd() * W, y = SAND_Y + 8 + rnd() * 60; g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,230,0.5)' : 'rgba(110,80,40,0.45)'; g.fillRect(x, y, 1 + rnd() * 1.5, 1 + rnd()); }
g.restore();
const rock = (cx, cy, rx, ry, base, hi) => { g.save(); g.translate(cx, cy); g.shadowColor = 'rgba(0,20,50,0.5)'; g.shadowBlur = 10; g.shadowOffsetY = 4; g.beginPath(); for (let a = 0; a <= TAU + 0.1; a += 0.3) { const k = 1 + 0.12 * Math.sin(a * 3 + cx) + 0.06 * Math.sin(a * 5); g.lineTo(Math.cos(a) * rx * k, Math.sin(a) * ry * k); } g.closePath(); const q = g.createRadialGradient(-rx * 0.3, -ry * 0.5, 2, 0, 0, rx * 1.1); q.addColorStop(0, hi); q.addColorStop(1, base); g.fillStyle = q; g.fill(); g.shadowColor = 'transparent'; g.beginPath(); g.ellipse(-rx * 0.2, -ry * 0.55, rx * 0.4, ry * 0.12, -0.2, 0, 7); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fill(); g.restore(); };
rock(40, 392, 52, 30, '#2e4a62', '#7c9bb4'); rock(92, 402, 30, 18, '#39556a', '#86a6bb');
// coral branches (recursive)
const branch = (x, y, len, ang, wd, col, depth) => { if (depth === 0 || len < 4) return; const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len; g.strokeStyle = col; g.lineWidth = wd; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); branch(x2, y2, len * 0.74, ang - 0.5 - rnd() * 0.2, wd * 0.72, col, depth - 1); branch(x2, y2, len * 0.74, ang + 0.5 + rnd() * 0.2, wd * 0.72, col, depth - 1); if (depth === 1) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(x2, y2, wd * 0.8, 0, 7); g.fill(); } };
g.save(); g.shadowColor = 'rgba(0,20,50,0.4)'; g.shadowBlur = 6;
branch(22, 400, 30, -1.5, 7, '#ff4f93', 5); branch(46, 404, 24, -1.3, 6, '#ff8a3d', 5);
branch(352, 404, 30, -1.6, 7, '#b45cff', 5); branch(370, 402, 22, -1.9, 6, '#ff5aa5', 4);
g.restore();
// brain coral dome
const dome = (cx, cy, r, c1, c2) => { g.save(); g.beginPath(); g.ellipse(cx, cy, r, r * 0.7, 0, Math.PI, 0); g.closePath(); const q = g.createRadialGradient(cx - r * 0.3, cy - r * 0.45, 2, cx, cy, r); q.addColorStop(0, c1); q.addColorStop(1, c2); g.fillStyle = q; g.fill(); g.clip(); g.strokeStyle = 'rgba(80,20,40,0.35)'; g.lineWidth = 1.4; for (let i = 0; i < 9; i++) { g.beginPath(); for (let t = 0; t <= 10; t++) g.lineTo(cx - r + t * r * 0.2 + Math.sin(t + i) * 2.5, cy - r * 0.7 + i * r * 0.1 + Math.cos(t * 1.4 + i) * 2.5); g.stroke(); } g.restore(); };
dome(300, 404, 26, '#ffb3c8', '#c44a7a');
// treasure chest, lid open, glowing gold
{ const x = 118, y = 372; g.save(); g.shadowColor = 'rgba(0,10,40,0.55)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
  const glow = g.createRadialGradient(x + 32, y - 4, 2, x + 32, y - 4, 46); glow.addColorStop(0, 'rgba(255,230,120,0.65)'); glow.addColorStop(1, 'rgba(255,200,60,0)'); g.fillStyle = glow; g.fillRect(x - 20, y - 50, 104, 96);
  g.fillStyle = '#f2c230'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(x + 8 + i * 6 + (i % 2) * 2, y + 1 - (i % 3) * 2, 4, 0, 7); g.fill(); }
  g.fillStyle = '#ffe680'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x + 16 + i * 9, y - 3 - (i % 2) * 3, 3, 0, 7); g.fill(); }
  const wood = g.createLinearGradient(0, y, 0, y + 34); wood.addColorStop(0, '#a5642c'); wood.addColorStop(1, '#4a2810');
  g.fillStyle = wood; g.beginPath(); g.roundRect(x, y + 4, 64, 32, 4); g.fill(); g.shadowColor = 'transparent';
  g.strokeStyle = 'rgba(40,18,6,0.5)'; g.lineWidth = 1; for (const k of [14, 24]) { g.beginPath(); g.moveTo(x + 2, y + k); g.lineTo(x + 62, y + k); g.stroke(); }
  g.fillStyle = '#e8b830'; g.fillRect(x + 6, y + 4, 7, 32); g.fillRect(x + 51, y + 4, 7, 32); g.fillRect(x, y + 4, 64, 4);
  g.fillStyle = '#fff2b0'; g.beginPath(); g.roundRect(x + 27, y + 10, 10, 12, 2); g.fill(); g.fillStyle = '#6a3a12'; g.fillRect(x + 31, y + 14, 2, 5);
  g.save(); g.translate(x + 2, y + 5); g.rotate(-0.95); g.fillStyle = wood; g.beginPath(); g.roundRect(0, -22, 62, 22, [10, 10, 2, 2]); g.fill(); g.fillStyle = '#e8b830'; g.fillRect(5, -22, 7, 22); g.fillRect(50, -22, 7, 22); g.restore(); g.restore(); }
// castle
{ const x = 238, b = SAND_Y + 12; g.save(); g.shadowColor = 'rgba(0,10,40,0.5)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
  const stone = (x0, y0, w, h) => { const q = g.createLinearGradient(x0, 0, x0 + w, 0); q.addColorStop(0, '#d6c6f0'); q.addColorStop(0.5, '#a894d4'); q.addColorStop(1, '#6f5ca6'); g.fillStyle = q; g.fillRect(x0, y0, w, h); };
  const tower = (x0, w, h, roof) => { stone(x0, b - h, w, h); g.shadowColor = 'transparent'; g.fillStyle = '#6f5ca6'; for (let i = 0; i < 4; i++) g.fillRect(x0 + i * (w / 4) + 1, b - h - 7, w / 4 - 3, 8); g.fillStyle = 'rgba(60,40,110,0.3)'; for (let r = 0; r < h; r += 9) g.fillRect(x0, b - h + r, w, 1); g.fillStyle = '#ffe9a0'; g.beginPath(); g.roundRect(x0 + w / 2 - 3, b - h + 16, 6, 11, [3, 3, 0, 0]); g.fill(); if (roof) { g.fillStyle = '#ff5a7a'; g.beginPath(); g.moveTo(x0 - 3, b - h - 6); g.lineTo(x0 + w / 2, b - h - 30); g.lineTo(x0 + w + 3, b - h - 6); g.closePath(); g.fill(); g.strokeStyle = '#5a3a2a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x0 + w / 2, b - h - 30); g.lineTo(x0 + w / 2, b - h - 42); g.stroke(); g.fillStyle = '#ffd23a'; g.beginPath(); g.moveTo(x0 + w / 2, b - h - 42); g.lineTo(x0 + w / 2 + 12, b - h - 38); g.lineTo(x0 + w / 2, b - h - 34); g.fill(); } g.shadowColor = 'rgba(0,10,40,0.5)'; };
  stone(x + 22, b - 48, 56, 48); tower(x, 24, 82, true); tower(x + 76, 24, 64, true); tower(x + 38, 24, 98, true);
  g.shadowColor = 'transparent'; g.fillStyle = '#2a1b4a'; g.beginPath(); g.roundRect(x + 41, b - 24, 18, 24, [9, 9, 0, 0]); g.fill(); g.fillStyle = '#ffe9a0'; g.beginPath(); g.roundRect(x + 29, b - 40, 6, 10, [3, 3, 0, 0]); g.fill(); g.beginPath(); g.roundRect(x + 65, b - 40, 6, 10, [3, 3, 0, 0]); g.fill(); g.restore(); }
// starfish, shells, pebbles on the sand
const star = (cx, cy, r, col) => { g.save(); g.translate(cx, cy); g.rotate(rnd()); g.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r; g.lineTo(Math.cos(i * TAU / 10) * rr, Math.sin(i * TAU / 10) * rr); } g.closePath(); g.fillStyle = col; g.shadowColor = 'rgba(60,30,0,0.4)'; g.shadowBlur = 3; g.fill(); g.shadowColor = 'transparent'; g.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(Math.cos(i * TAU / 5) * r * 0.5, Math.sin(i * TAU / 5) * r * 0.5, 1.2, 0, 7); g.fill(); } g.restore(); };
star(205, 430, 11, '#ff7a2a'); star(165, 440, 7, '#ff5a7a'); star(345, 436, 9, '#ffb02a');
for (let i = 0; i < 26; i++) { const x = 10 + rnd() * 370, y = SAND_Y + 18 + rnd() * 50, r = 2 + rnd() * 4; const cols = ['#e7d3b0', '#b99a74', '#f5b5a8', '#9ab0bf']; g.fillStyle = cols[i % 4]; g.shadowColor = 'rgba(40,20,0,0.35)'; g.shadowBlur = 2; g.beginPath(); g.ellipse(x, y, r * 1.3, r, 0, 0, 7); g.fill(); }
names.push(addProjectImage('scene.png', c, {}).name);
`;

// ---------- looping light beams ----------
const raysJS = pre + `
const N = 8, RH = 300;
const B = [{ x: 40, w: 46, a: 0.4 }, { x: 140, w: 70, a: 0.7 }, { x: 250, w: 50, a: 1.9 }, { x: 330, w: 62, a: 3.1 }, { x: 205, w: 36, a: 4.2 }];
for (let k = 0; k < N; k++) {
  const ph = TAU * k / N, c = mk(W, RH), g = c.getContext('2d');
  B.forEach((b, i) => {
    const al = 0.09 + 0.06 * Math.sin(ph + b.a * 2), sh = 8 * Math.sin(ph + b.a), sk = 70 + 10 * Math.sin(ph * 2 + i);
    const q = g.createLinearGradient(0, 0, 0, RH); q.addColorStop(0, 'rgba(255,255,230,' + al * 2.2 + ')'); q.addColorStop(1, 'rgba(160,240,255,0)');
    g.fillStyle = q; g.beginPath(); g.moveTo(b.x + sh, 0); g.lineTo(b.x + sh + b.w, 0); g.lineTo(b.x + sh + b.w + sk + b.w * 0.6, RH); g.lineTo(b.x + sh + sk - b.w * 0.2, RH); g.closePath(); g.fill();
  });
  names.push(addProjectImage('anim/rays_' + k + '.png', c, {}).name);
}
`;

// ---------- swaying plants ----------
const plantsJS = pre + `
const N = 10, PH = 222, BASE = 216;
const P = [
  { x: 14, h: 150, w: 9, c: ['#1f8a3c', '#6ee06b'], m: 1, p: 0.4, s: 12 }, { x: 34, h: 110, w: 7, c: ['#17783a', '#58d066'], m: 1, p: 1.6, s: 10 },
  { x: 68, h: 90, w: 8, c: ['#b0245a', '#ff6fa5'], m: 1, p: 2.4, s: 9 }, { x: 96, h: 120, w: 8, c: ['#1f8a3c', '#78e87a'], m: 1, p: 3.4, s: 11 },
  { x: 214, h: 100, w: 7, c: ['#17783a', '#58d066'], m: 1, p: 0.9, s: 10 }, { x: 226, h: 150, w: 9, c: ['#1f8a3c', '#6ee06b'], m: 1, p: 2.0, s: 12 },
  { x: 338, h: 120, w: 8, c: ['#7a2aa8', '#d28bff'], m: 1, p: 1.0, s: 11 }, { x: 352, h: 160, w: 9, c: ['#1f8a3c', '#78e87a'], m: 1, p: 3.0, s: 13 }, { x: 374, h: 100, w: 8, c: ['#17783a', '#58d066'], m: 1, p: 4.4, s: 10 }
];
for (let k = 0; k < N; k++) {
  const ph = TAU * k / N, c = mk(W, PH), g = c.getContext('2d');
  for (const p of P) {
    const pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16, sw = p.s * Math.sin(ph * p.m + p.p + t * 2.2) * Math.pow(t, 1.4); pts.push([p.x + sw, BASE - p.h * t, p.w * (1 - t * 0.85)]); }
    const q = g.createLinearGradient(p.x - p.w, 0, p.x + p.w, 0); q.addColorStop(0, p.c[0]); q.addColorStop(1, p.c[1]);
    g.beginPath(); pts.forEach(([x, y, w]) => g.lineTo(x - w, y)); for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i][0] + pts[i][2], pts[i][1]); g.closePath(); g.fillStyle = q; g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1; g.beginPath(); pts.forEach(([x, y]) => g.lineTo(x, y)); g.stroke();
    // leaf blades
    for (let i = 3; i < 16; i += 3) { const [x, y, w] = pts[i], d = i % 2 ? 1 : -1, ln = 16 + p.h * 0.08; g.save(); g.translate(x, y); g.rotate(d * (0.9 - i * 0.02) + 0.18 * Math.sin(ph + i)); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(ln * 0.5, -ln * 0.4, ln, 0); g.quadraticCurveTo(ln * 0.5, ln * 0.25, 0, 0); g.fillStyle = p.c[1]; g.globalAlpha = 0.85; g.fill(); g.restore(); }
  }
  names.push(addProjectImage('anim/plants_' + k + '.png', c, {}).name);
}
`;

// ---------- rising bubbles ----------
const bubblesJS = pre + `
const N = 12, BH = 380;
const S = [];
for (const [sx, sy, n] of [[142, 340, 7], [58, 366, 5], [300, 358, 5]]) for (let i = 0; i < n; i++) S.push({ x: sx, y: sy, off: i / n + rnd() * 0.05, r: 2 + rnd() * 4.2, amp: 3 + rnd() * 6, ph: rnd() * TAU, rise: 250 + rnd() * 60 });
for (let k = 0; k < N; k++) {
  const c = mk(W, BH), g = c.getContext('2d');
  for (const s of S) {
    const f = (((k / N) + s.off) % 1 + 1) % 1, y = s.y - f * s.rise, x = s.x + s.amp * Math.sin(TAU * f * 2 + s.ph), r = s.r * (0.8 + f * 0.5), a = Math.min(f / 0.08, 1) * (1 - Math.pow(f, 3));
    const q = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); q.addColorStop(0, 'rgba(255,255,255,' + 0.1 * a + ')'); q.addColorStop(0.75, 'rgba(190,240,255,' + 0.2 * a + ')'); q.addColorStop(1, 'rgba(230,255,255,' + 0.85 * a + ')');
    g.fillStyle = q; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,' + 0.9 * a + ')'; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, Math.max(0.8, r * 0.25), 0, 7); g.fill();
  }
  names.push(addProjectImage('anim/bubbles_' + k + '.png', c, {}).name);
}
`;

// ---------- foreground sand lip + glass overlay ----------
const frontJS = pre + `
const FH = 58, c = mk(W, FH), g = c.getContext('2d');
g.beginPath(); g.moveTo(0, FH); g.lineTo(0, 36); for (let x = 0; x <= W; x += 6) g.lineTo(x, 34 + Math.sin(x / 30 + 1) * 6 + Math.sin(x / 11) * 1.5); g.lineTo(W, FH); g.closePath();
const q = g.createLinearGradient(0, 24, 0, FH); q.addColorStop(0, '#f0d99c'); q.addColorStop(1, '#a07a46'); g.fillStyle = q; g.fill();
for (let i = 0; i < 30; i++) { const x = rnd() * W, y = 42 + rnd() * 14; g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,230,0.5)' : 'rgba(110,80,40,0.45)'; g.fillRect(x, y, 1.5, 1.2); }
for (const [x, y, r, col] of [[24, 40, 6, '#9ab0bf'], [64, 46, 4, '#f5b5a8'], [338, 44, 7, '#e7d3b0'], [368, 40, 4, '#b99a74'], [190, 48, 3, '#f0f0e0']]) { g.fillStyle = col; g.shadowColor = 'rgba(40,20,0,0.4)'; g.shadowBlur = 3; g.beginPath(); g.ellipse(x, y, r * 1.3, r, 0, 0, 7); g.fill(); }
names.push(addProjectImage('front.png', c, {}).name);
`;
const glassJS = pre + `
const c = mk(W, H), g = c.getContext('2d');
// water surface band
let q = g.createLinearGradient(0, 0, 0, 34); q.addColorStop(0, 'rgba(255,255,255,0.7)'); q.addColorStop(0.5, 'rgba(190,245,255,0.28)'); q.addColorStop(1, 'rgba(190,245,255,0)');
g.fillStyle = q; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); for (let x = W; x >= 0; x -= 5) g.lineTo(x, 22 + Math.sin(x / 17) * 3 + Math.sin(x / 7) * 1.4); g.closePath(); g.fill();
g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.6; g.beginPath(); for (let x = 0; x <= W; x += 4) g.lineTo(x, 20 + Math.sin(x / 17) * 3 + Math.sin(x / 7) * 1.4); g.stroke();
// glass edge vignette
q = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.78); q.addColorStop(0, 'rgba(0,25,60,0)'); q.addColorStop(1, 'rgba(0,25,60,0.38)'); g.fillStyle = q; g.fillRect(0, 0, W, H);
// reflections
q = g.createLinearGradient(0, 0, 60, 0); q.addColorStop(0, 'rgba(255,255,255,0.22)'); q.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = q; g.beginPath(); g.moveTo(10, 40); g.lineTo(36, 40); g.lineTo(54, 330); g.lineTo(18, 330); g.closePath(); g.fill();
g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.roundRect(W - 22, 60, 5, 150, 3); g.fill();
names.push(addProjectImage('glass.png', c, {}).name);
`;

// ---------- fish sprites: 4 species x 2 directions x 6 tail frames ----------
const fishJS = pre + `
const NF = 6, CW = 120, CH = 88, CX = 60, CY = 44;
const SPEC = {
  clown: { H: 22, body: ['#ff5a14', '#ff8a2a', '#ffd08a'], tail: ['#ff7a1a', '#ff5a14'], fin: '#ff6a18', edge: '#1a0a05', TL: 26, TT: 22 },
  tang:  { H: 27, body: ['#1346c8', '#2c7cf0', '#7cc4ff'], tail: ['#ffd21a', '#ffb000'], fin: '#ffd21a', edge: '#0a1a50', TL: 24, TT: 26 },
  angel: { H: 18, body: ['#e8a800', '#ffd83a', '#fff2a0'], tail: ['#ffe36a', '#ff9a2a'], fin: '#ffc23a', edge: '#241400', TL: 24, TT: 22 },
  betta: { H: 15, body: ['#4a12d8', '#d82a9a', '#ff8ad0'], tail: ['#7a2aff', '#ff3aa8'], fin: '#a02cff', edge: '#200a50', TL: 40, TT: 36 }
};
function fish(sp, ph, dir) {
  const S = SPEC[sp], c = mk(CW, CH), g = c.getContext('2d');
  g.translate(CX, CY); if (dir < 0) g.scale(-1, 1);
  const A = 5 * Math.sin(ph), bend = (x) => A * Math.pow((40 - x) / 80, 2), HH = S.H;
  const prof = (u) => HH * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.94 + 0.035)), 0.55);
  const top = [], bot = [];
  for (let i = 0; i <= 24; i++) { const u = i / 24, x = -40 + 80 * u, h = prof(u); top.push([x, bend(x) - h * (sp === 'angel' ? 1 : 1.05)]); bot.push([x, bend(x) + h * 0.95]); }
  const bodyPath = () => { g.beginPath(); top.forEach(([x, y]) => g.lineTo(x, y)); for (let i = bot.length - 1; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]); g.closePath(); };
  const yTop = (x) => bend(x) - prof((x + 40) / 80) * 1.05, yBot = (x) => bend(x) + prof((x + 40) / 80) * 0.95;
  // tail (behind the body), swinging about the peduncle
  const ty = bend(-40), sw = 0.5 * Math.sin(ph + 0.9);
  g.save(); g.translate(-39, ty); g.rotate(sw); const L = S.TL, T = S.TT;
  let q = g.createLinearGradient(0, 0, -L, 0); q.addColorStop(0, S.tail[0]); q.addColorStop(1, S.tail[1]);
  g.beginPath(); g.moveTo(2, -3); g.bezierCurveTo(-L * 0.4, -T * 1.15, -L * 0.9, -T * 1.0, -L, -T * (sp === 'betta' ? 0.9 : 0.8)); g.bezierCurveTo(-L * (sp === 'tang' ? 0.55 : 0.75), -T * 0.1, -L * (sp === 'tang' ? 0.55 : 0.75), T * 0.1, -L, T * (sp === 'betta' ? 0.9 : 0.8)); g.bezierCurveTo(-L * 0.9, T * 1.0, -L * 0.4, T * 1.15, 2, 3); g.closePath();
  g.globalAlpha = sp === 'betta' ? 0.86 : 1; g.fillStyle = q; g.fill(); g.globalAlpha = 1; g.lineWidth = 1.2; g.strokeStyle = S.edge; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.8; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-L * 0.55, i * T * 0.2, -L * 0.95, i * T * 0.27); g.stroke(); }
  g.restore();
  // dorsal + anal fins (behind body)
  const fin = (x0, x1, h, side, wob) => { const ya = side < 0 ? yTop : yBot, hh = h * (1 + 0.12 * Math.sin(ph * 2 + wob)); g.beginPath(); g.moveTo(x0, ya(x0)); g.bezierCurveTo(x0 + (x1 - x0) * 0.2, ya(x0) + side * hh, x0 + (x1 - x0) * 0.6, ya(x1) + side * hh * 0.9, x1 - 6 * (sp === 'angel' ? -1 : 1), ya(x1) + side * hh * (sp === 'angel' ? 0.2 : 0.35)); g.lineTo(x1, ya(x1)); g.closePath(); const f = g.createLinearGradient(0, ya(x0), 0, ya(x0) + side * hh); f.addColorStop(0, S.fin); f.addColorStop(1, S.tail[1]); g.globalAlpha = sp === 'betta' || sp === 'angel' ? 0.88 : 1; g.fillStyle = f; g.fill(); g.globalAlpha = 1; g.lineWidth = 1.1; g.strokeStyle = S.edge; g.stroke(); };
  if (sp === 'angel') { fin(-22, 14, 30, -1, 0); fin(-20, 10, 26, 1, 1.4); } else if (sp === 'betta') { fin(-28, 10, 20, -1, 0); fin(-24, 6, 24, 1, 1.4); } else if (sp === 'tang') { fin(-26, 20, 14, -1, 0); fin(-22, 14, 12, 1, 1.4); } else { fin(-20, 12, 12, -1, 0); fin(-16, 6, 8, 1, 1.4); }
  // body
  const bg = g.createLinearGradient(0, -HH, 0, HH); bg.addColorStop(0, S.body[0]); bg.addColorStop(0.45, S.body[1]); bg.addColorStop(1, S.body[2]);
  g.save(); g.shadowColor = 'rgba(0,15,40,0.45)'; g.shadowBlur = 5; g.shadowOffsetY = 3; bodyPath(); g.fillStyle = bg; g.fill(); g.restore();
  g.save(); bodyPath(); g.clip();
  const band = (x, w, col, edge) => { g.fillStyle = col; g.fillRect(x - w / 2 + bend(x) * 0.5, -HH * 1.4, w, HH * 2.8); if (edge) { g.fillStyle = edge; g.fillRect(x - w / 2 - 1.6 + bend(x) * 0.5, -HH * 1.4, 1.6, HH * 2.8); g.fillRect(x + w / 2 + bend(x) * 0.5, -HH * 1.4, 1.6, HH * 2.8); } };
  if (sp === 'clown') { band(-26, 4, '#fff', '#111'); band(4, 11, '#fff', '#111'); band(28, 7, '#fff', '#111'); }
  if (sp === 'angel') { band(-22, 4, '#2a1a00'); band(-6, 5, '#2a1a00'); band(10, 4, '#2a1a00'); band(26, 3, '#2a1a00'); }
  if (sp === 'tang') { g.fillStyle = '#0a1240'; g.beginPath(); g.moveTo(24, -4); g.bezierCurveTo(8, -26, -14, -22, -24, -6); g.bezierCurveTo(-8, -10, 0, 4, 12, 8); g.bezierCurveTo(18, 8, 22, 4, 24, -4); g.fill(); }
  if (sp === 'betta') { g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; for (let i = 0; i < 9; i++) for (let j = -2; j <= 2; j++) { g.beginPath(); g.arc(-30 + i * 8 + (j % 2) * 4, j * 6, 4, 0, 7); g.stroke(); } }
  // belly sheen + back highlight
  g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.ellipse(2, -HH * 0.55 + A * 0.3, 30, HH * 0.22, 0, 0, 7); g.fill();
  g.restore(); bodyPath(); g.lineWidth = 1.4; g.strokeStyle = S.edge; g.stroke();
  // gill, eye, mouth
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.3; g.beginPath(); g.arc(18, 0, HH * 0.62, -1.1, 1.1); g.stroke();
  const ex = 27, ey = -HH * 0.22; g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, ey, 4.6, 0, 7); g.fill(); g.strokeStyle = S.edge; g.lineWidth = 1; g.stroke();
  g.fillStyle = '#0a0a14'; g.beginPath(); g.arc(ex + 1, ey, 2.7, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + 2, ey - 1.1, 1, 0, 7); g.fill();
  g.strokeStyle = S.edge; g.lineWidth = 1.2; g.beginPath(); g.moveTo(39, 3); g.quadraticCurveTo(36, 5.5, 33, 4.5); g.stroke();
  // pectoral fin flaps
  g.save(); g.translate(14, HH * 0.15 + bend(14)); g.rotate(0.5 * Math.sin(ph * 2 + 1)); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-10, -4, -16, 4 + 2 * Math.sin(ph * 2)); g.quadraticCurveTo(-8, 8, 0, 3); g.closePath(); g.fillStyle = sp === 'tang' ? '#ffd21a' : S.fin; g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1; g.strokeStyle = S.edge; g.lineWidth = 0.9; g.stroke(); g.restore();
  return c;
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
const F = 'Bebas Neue';
const tag = (suffix) => ({ script: `const n = project.elements.length; for (const i of [n-3,n-2,n-1]) project.elements[i].name += ' ${suffix}'; return 1` });

// ---------- code that runs on the watch ----------
const userCode = `{
  // Fish are plain IMG layers moved with MORE {x, y, src}: up to three swim at a time, some behind the clock, some in front.
  const MS = 100, SW = 390, SPW = 120, SPH = 88, NF = 6, TOPY = 34, BOTY = 300
  const SPECIES = ['clown', 'tang', 'angel', 'betta']
  const SLOTS = ['b0', 'b1', 'b2', 'f0', 'f1', 'f2']
  const active = {}
  let id = null, tickN = 0, target = 2, nextTarget = 30, nextSpawn = 5
  const rand = (a, b) => a + Math.random() * (b - a)
  const park = (s) => { active[s] = null; try { W[s].setProperty(ui.prop.MORE, { x: pxv(-400), y: pxv(0) }) } catch (e) {} }
  const count = () => SLOTS.filter((s) => active[s]).length
  const freeSlot = () => {
    const group = Math.random() < 0.5 ? ['b0', 'b1', 'b2'] : ['f0', 'f1', 'f2']
    const other = group[0] === 'b0' ? ['f0', 'f1', 'f2'] : ['b0', 'b1', 'b2']
    for (const s of group.concat(other)) if (!active[s]) return s
    return null
  }
  const spawn = (fromEdge) => {
    const s = freeSlot()
    if (!s) return
    let y = 0, ok = false
    for (let i = 0; i < 8 && !ok; i++) { y = rand(TOPY, BOTY); ok = SLOTS.every((o) => !active[o] || Math.abs(active[o].base - y) > 80) }
    const dir = Math.random() < 0.5 ? 1 : -1
    const sp = SPECIES[Math.floor(Math.random() * SPECIES.length)]
    const speed = rand(1.6, 3.2)
    active[s] = { sp, dir, vx: speed, base: y, x: fromEdge ? (dir > 0 ? -SPW : SW) : rand(30, SW - SPW - 30), amp: rand(4, 12), bob: rand(0.04, 0.09), ph: rand(0, 6.28), age: 0, rate: rand(0.7, 1.1), sm: 1, smT: 1, turned: false, drift: rand(-0.12, 0.12) }
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
  wrap(raysJS, anim('Light beams', 'rays', 5, 0)),
  wrap(plantsJS, anim('Plants', 'plants', 6, 226)),
  wrap(fishJS, 'return names.length'),
  slot('Fish back 0', 'b0', 'clown_r_0', 40, 70, 225), slot('Fish back 1', 'b1', 'tang_l_0', 250, 215, 225), slot('Fish back 2', 'b2', 'betta_r_0', -400, 0, 225),
  { preset: 'clock' }, tag('Main'), { preset: 'clock' }, tag('Aod'), { preset: 'weekday' }, { preset: 'day' }, { preset: 'temp' },
  slot('Fish front 0', 'f0', 'angel_l_0', 210, 250, 255), slot('Fish front 1', 'f1', 'clown_l_0', -400, 0, 255), slot('Fish front 2', 'f2', 'tang_r_0', -400, 0, 255),
  wrap(bubblesJS, anim('Bubbles', 'bubbles', 8, 40)),
  wrap(frontJS, img('Sand front', 392)),
  wrap(glassJS, img('Glass', 0)),
  { remove: 'Colon Aod' },
];
const face = (size) => ({ font: F, size, fill: 'gradient', from: '#ffffff', to: '#bdeeff', angle: 90, borderColor: '#08305f', borderWidth: 4, shadowColor: '#021a3a', shadowX: 0, shadowY: 4, shadowBlur: 6 });
const dim = { font: F, size: 120, fill: 'solid', color: '#2a6f9a' };
steps.push(
  { edit: 'Hour Main', set: { x: 45, y: 110, show: 'normal', zero: 1 }, glyph: face(150) },
  { edit: 'Colon Main', set: { x: 182, y: 127, show: 'normal' }, glyph: face(150) },
  { edit: 'Minute Main', set: { x: 214, y: 110, show: 'normal', zero: 1 }, glyph: face(150) },
  { edit: 'Hour Aod', set: { x: 60, y: 90, show: 'aod', zero: 1 }, glyph: dim },
  { edit: 'Minute Aod', set: { x: 60, y: 230, show: 'aod', zero: 1 }, glyph: dim },
  { edit: 'Weekday', set: { x: 134, y: 52, show: 'normal' }, glyph: face(42) },
  { edit: 'Day', set: { x: 206, y: 52, show: 'normal' }, glyph: face(42) },
  { edit: 'Temperature', set: { x: 155, y: 282, show: 'normal' }, glyph: face(46) },
);
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: 'Mini Aquarium', device: 'bip-6', font: F, optimizePng: 32,
  description: 'A colourful mini aquarium: swaying plants, castle, treasure chest and coral, light beams and bubbles. Up to three fish (clownfish, blue tang, angelfish, betta) spawn at random and swim behind and in front of the clock, each with a flapping tail and fins.',
  preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/aquarium', userCode, steps }, null, 1));
