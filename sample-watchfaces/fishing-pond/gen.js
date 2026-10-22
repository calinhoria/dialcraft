// Fishing Pond: a fisher on a wooden dock plays a calm fishing game by itself: cast, wait, nibbles, sometimes a fish leaves, sometimes it bites,
// a fight with the rod bending, reeling, lifting the catch (perch, carp, pike, an old boot, the rare golden fish), into the bucket.
// The lake follows the day (day, sunset, night). The rod, line and float are pictures swapped per state; fish, splash and the bucket are layers.
const fs = require('fs');
const pre = `
const W = dev().w, H = dev().h, HOR = 170;
let seed = 33; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const BX = (e) => 320 - 15 * e, BY = (e) => 298 + 5.4 * e;
`;
const PH = [
  { id: 'day', from: 360, sky: ['#5fa8dc', '#9fd2ee', '#d8eef2', '#f6f0d0'], sun: { x: 300, y: 70, r: 200, col: '255,244,200', a: 0.9 }, trees: ['#4f7a5a', '#2f5a42'], haze: 'rgba(240,244,230,0.35)', water: ['rgba(40,110,130,0.18)', 'rgba(14,64,84,0.5)', 'rgba(6,34,50,0.78)'], glit: '255,246,210', stars: 0, lamp: 0.1, moon: 0 },
  { id: 'sunset', from: 1020, sky: ['#2c3a78', '#8a5a8c', '#f0845c', '#ffcf8a'], sun: { x: 120, y: 168, r: 230, col: '255,170,90', a: 0.95 }, trees: ['#3a3a58', '#1f2440'], haze: 'rgba(255,170,120,0.3)', water: ['rgba(120,60,70,0.22)', 'rgba(60,40,70,0.55)', 'rgba(24,20,44,0.82)'], glit: '255,190,120', stars: 0.2, lamp: 0.6, moon: 0 },
  { id: 'night', from: 1200, sky: ['#050a1c', '#0c1a3a', '#1a2c58', '#2a3a68'], sun: { x: 290, y: 80, r: 140, col: '200,220,255', a: 0.5 }, trees: ['#14203a', '#0a1228'], haze: 'rgba(80,110,170,0.18)', water: ['rgba(10,24,56,0.3)', 'rgba(6,16,40,0.6)', 'rgba(2,8,22,0.86)'], glit: '210,226,255', stars: 1, lamp: 1, moon: 1 },
];
const sceneJS = (P) => pre + `const P = ${JSON.stringify(P)};
const sky = mk(W, HOR), s = sky.getContext('2d');
let gr = s.createLinearGradient(0, 0, 0, HOR); [0, 0.4, 0.75, 1].forEach((p, i) => gr.addColorStop(p, P.sky[i])); s.fillStyle = gr; s.fillRect(0, 0, W, HOR);
if (P.sun) { const q = s.createRadialGradient(P.sun.x, P.sun.y, 0, P.sun.x, P.sun.y, P.sun.r); q.addColorStop(0, 'rgba(' + P.sun.col + ',' + P.sun.a + ')'); q.addColorStop(0.3, 'rgba(' + P.sun.col + ',' + P.sun.a * 0.35 + ')'); q.addColorStop(1, 'rgba(' + P.sun.col + ',0)'); s.fillStyle = q; s.fillRect(0, 0, W, HOR); }
for (let i = 0; i < 160 * P.stars; i++) { s.fillStyle = 'rgba(255,255,255,' + (0.3 + rnd() * 0.6) + ')'; s.fillRect(rnd() * W, rnd() * 120, rnd() < 0.15 ? 2 : 1, 1); }
if (P.moon) { s.beginPath(); s.arc(290, 70, 15, 0, 7); const q = s.createRadialGradient(285, 65, 2, 290, 70, 16); q.addColorStop(0, '#fffbe8'); q.addColorStop(1, '#cfd8e8'); s.fillStyle = q; s.fill(); }
for (let i = 0; i < 7; i++) { const x = rnd() * W, y = 30 + rnd() * 80, w = 60 + rnd() * 120; const q = s.createRadialGradient(x, y, 1, x, y, w); q.addColorStop(0, 'rgba(255,240,230,' + (P.stars ? 0.05 : 0.18) + ')'); q.addColorStop(1, 'rgba(255,240,230,0)'); s.save(); s.translate(x, y); s.scale(1, 0.2); s.translate(-x, -y); s.fillStyle = q; s.beginPath(); s.arc(x, y, w, 0, 7); s.fill(); s.restore(); }
const trees = (hmin, hmax, col, step) => { for (let x = -14; x < W + 14; x += step * (0.6 + rnd() * 0.8)) { const h = hmin + rnd() * (hmax - hmin), rw = 10 + rnd() * 16; s.beginPath(); s.ellipse(x, HOR - h * 0.5, rw, h * 0.6, 0, 0, 7); s.fillStyle = col; s.fill(); } };
trees(14, 34, P.trees[0], 18); trees(8, 22, P.trees[1], 14);
s.fillStyle = P.haze; s.fillRect(0, HOR - 60, W, 60);
const c = mk(W, H), g = c.getContext('2d'); g.drawImage(sky, 0, 0);
const rc = mk(W, H - HOR), r = rc.getContext('2d');
for (let dy = 0; dy < H - HOR; dy++) { const sy = clamp(HOR - 1 - dy * 0.7, 0, HOR - 1), off = (1.5 + dy * 0.016) * Math.sin(dy * 0.3 + 1); r.drawImage(sky, 0, sy, W, 1, off - 6, dy, W + 12, 1); }
g.save(); g.filter = 'blur(1px)'; g.drawImage(rc, 0, HOR); g.restore();
gr = g.createLinearGradient(0, HOR, 0, H); gr.addColorStop(0, P.water[0]); gr.addColorStop(0.5, P.water[1]); gr.addColorStop(1, P.water[2]); g.fillStyle = gr; g.fillRect(0, HOR, W, H - HOR);
for (let i = 0; i < 160; i++) { const dy = rnd() * 220, y = HOR + dy, x = P.sun.x + (rnd() + rnd() - 1) * (40 + dy * 0.5), w = 4 + rnd() * 16; g.fillStyle = 'rgba(' + P.glit + ',' + (0.1 + rnd() * 0.38) * (1 - dy / 300) + ')'; g.fillRect(x, y, w, 1.2); }
for (let i = 0; i < 260; i++) { const dy = rnd() * (H - HOR), y = HOR + dy, w = 10 + rnd() * (14 + dy * 0.3), x = rnd() * W; g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,' + (0.03 + rnd() * 0.06) + ')' : 'rgba(0,20,30,' + (0.08 + rnd() * 0.1) + ')'; g.fillRect(x, y, w, 1); }
// the dock: planks, front beam, pilings
const piling = (x) => { const q = g.createLinearGradient(x - 6, 0, x + 6, 0); q.addColorStop(0, '#2a1a0e'); q.addColorStop(0.45, '#6a4a2a'); q.addColorStop(1, '#241408'); g.fillStyle = q; g.fillRect(x - 6, 372, 12, 46); g.fillStyle = 'rgba(180,200,210,0.25)'; g.beginPath(); g.ellipse(x, 418, 10, 2.4, 0, 0, 7); g.fill(); };
for (const x of [24, 98, 192]) piling(x);
g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 8; g.shadowOffsetY = 4; g.fillStyle = '#4a3220'; g.fillRect(-10, 360, 220, 16); g.restore();
for (let row = 0; row < 5; row++) { const y = 332 + row * 6.2, x0 = -10; let x = x0 - hash(row, 1) * 30; while (x < 214) { const w = 44 + hash(x, row) * 36; g.beginPath(); g.roundRect(x, y, w - 1.4, 5.6, 1.2); const q = g.createLinearGradient(0, y, 0, y + 6); const k = hash(row, x); q.addColorStop(0, 'rgb(' + (150 + k * 30 | 0) + ',' + (110 + k * 24 | 0) + ',' + (68 + k * 16 | 0) + ')'); q.addColorStop(1, 'rgb(' + (104 + k * 20 | 0) + ',' + (74 + k * 16 | 0) + ',' + (44 + k * 10 | 0) + ')'); g.fillStyle = q; g.fill(); g.strokeStyle = 'rgba(30,16,6,0.6)'; g.lineWidth = 0.8; g.stroke(); x += w; } }
g.beginPath(); g.moveTo(200, 332); g.quadraticCurveTo(216, 346, 206, 362); g.lineTo(200, 362); g.closePath(); g.fillStyle = '#7a5532'; g.fill();
g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-10, 372, 220, 4); g.strokeStyle = 'rgba(255,230,180,0.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-10, 361); g.lineTo(206, 361); g.stroke();
// the bucket, a lantern post and a small tackle box
g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 5; g.shadowOffsetY = 3; g.beginPath(); g.moveTo(58, 326); g.lineTo(98, 326); g.lineTo(93, 352); g.lineTo(63, 352); g.closePath(); const bg = g.createLinearGradient(58, 0, 98, 0); bg.addColorStop(0, '#6a7480'); bg.addColorStop(0.4, '#b8c2cc'); bg.addColorStop(1, '#5a6470'); g.fillStyle = bg; g.fill(); g.restore();
g.strokeStyle = 'rgba(30,36,44,0.6)'; g.lineWidth = 1; for (const y of [334, 343]) { g.beginPath(); g.moveTo(60, y); g.lineTo(96, y); g.stroke(); } g.beginPath(); g.ellipse(78, 326, 20, 4, 0, 0, 7); g.fillStyle = 'rgba(20,30,40,0.75)'; g.fill(); g.strokeStyle = '#8a949e'; g.lineWidth = 1.6; g.stroke();
g.fillStyle = '#7a3a1c'; g.fillRect(14, 326, 30, 16); g.fillStyle = '#c8a24a'; g.fillRect(14, 332, 30, 2); g.fillRect(27, 330, 4, 6);
g.fillStyle = '#3a2614'; g.fillRect(14, 296, 4, 36); g.fillStyle = '#242018'; g.fillRect(11, 288, 10, 11); g.fillStyle = 'rgba(255,214,130,' + (0.5 + P.lamp * 0.5) + ')'; g.fillRect(13, 290, 6, 7);
if (P.lamp > 0.05) { const q = g.createRadialGradient(16, 293, 1, 16, 293, 70 * P.lamp + 18); q.addColorStop(0, 'rgba(255,214,130,' + 0.6 * P.lamp + ')'); q.addColorStop(1, 'rgba(255,214,130,0)'); g.fillStyle = q; g.beginPath(); g.arc(16, 293, 70 * P.lamp + 18, 0, 7); g.fill(); const q2 = g.createLinearGradient(0, 376, 0, 450); q2.addColorStop(0, 'rgba(255,214,130,' + 0.3 * P.lamp + ')'); q2.addColorStop(1, 'rgba(255,214,130,0)'); g.fillStyle = q2; g.fillRect(0, 376, 70, 70); }
names.push(addProjectImage('scene_' + P.id + '.png', c, {}).name);
`;
const fisherJS = pre + `
// a seated fisher with a straw hat, facing right; frame 0 calm, frame 1 cheering. Sheet 86 x 140, shown at (112, 258).
function fisher(cheer) {
  const c = mk(86, 140), g = c.getContext('2d');
  const skin = (x, y, r) => { const q = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r * 1.1); q.addColorStop(0, '#fbd8b4'); q.addColorStop(1, '#d9a074'); return q; };
  const legC = '#3a4a68';
  // legs: thighs along the boards, shins hanging over the edge, boots
  g.lineCap = 'round'; g.strokeStyle = '#2e3a54'; g.lineWidth = 9; g.beginPath(); g.moveTo(26, 82); g.lineTo(56, 84); g.lineTo(58, 118); g.stroke();
  g.strokeStyle = legC; g.beginPath(); g.moveTo(30, 80); g.lineTo(62, 82); g.lineTo(64, 116); g.stroke();
  for (const [bx, by, col] of [[58, 122, '#2a1c12'], [64, 120, '#3a281a']]) { g.beginPath(); g.roundRect(bx - 6, by - 6, 15, 12, 4); g.fillStyle = col; g.fill(); g.beginPath(); g.roundRect(bx - 2, by - 7, 8, 7, 3); g.fill(); }
  // back arm, jacket
  g.beginPath(); g.ellipse(32, 62, 14, 24, 0.12, 0, 7); let q = g.createLinearGradient(18, 0, 48, 0); q.addColorStop(0, '#7a2a1e'); q.addColorStop(0.5, '#b03a2a'); q.addColorStop(1, '#6a2218'); g.fillStyle = q; g.fill();
  g.strokeStyle = 'rgba(20,8,4,0.5)'; g.lineWidth = 1.2; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(20 + k * 5, 42); g.lineTo(22 + k * 5, 84); g.stroke(); } for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(18, 46 + k * 7); g.lineTo(48, 46 + k * 7); g.stroke(); }
  g.fillStyle = '#7a4a22'; g.fillRect(16, 74, 32, 4);
  // arm to the rod handle at (58, 42)
  g.strokeStyle = '#a63424'; g.lineWidth = 8; g.beginPath(); g.moveTo(34, 50); g.lineTo(50, 52); g.lineTo(58, 44); g.stroke(); g.beginPath(); g.arc(58, 43, 4.2, 0, 7); g.fillStyle = skin(58, 43, 4); g.fill();
  if (cheer) { g.strokeStyle = '#a63424'; g.lineWidth = 8; g.beginPath(); g.moveTo(30, 50); g.lineTo(24, 28); g.lineTo(30, 8); g.stroke(); g.beginPath(); g.arc(30, 6, 4.4, 0, 7); g.fillStyle = skin(30, 6, 4); g.fill(); }
  // head, hat, face
  const hy = cheer ? 28 : 31, hx = 40;
  g.beginPath(); g.arc(hx, hy, 11.5, 0, 7); g.fillStyle = skin(hx, hy, 11); g.fill();
  g.beginPath(); g.arc(hx + 11, hy + 2, 2.8, 0, 7); g.fillStyle = skin(hx + 11, hy + 2, 3); g.fill();
  g.beginPath(); g.arc(hx + 5.5, hy - 1.5, 1.4, 0, 7); g.fillStyle = '#2a1608'; g.fill();
  g.strokeStyle = '#8a4a32'; g.lineWidth = 1.2; g.beginPath(); if (cheer) g.arc(hx + 6, hy + 5, 3.4, 0.1, 3.0); else g.arc(hx + 6, hy + 6, 3, 0.3, 1.2); g.stroke();
  g.fillStyle = 'rgba(224,100,90,0.4)'; g.beginPath(); g.arc(hx + 4, hy + 5, 3, 0, 7); g.fill();
  g.beginPath(); g.ellipse(hx - 1, hy - 9, 21, 5.4, cheer ? -0.12 : 0.06, 0, 7); q = g.createLinearGradient(0, hy - 14, 0, hy - 4); q.addColorStop(0, '#f2d27a'); q.addColorStop(1, '#b88e3a'); g.fillStyle = q; g.fill(); g.strokeStyle = '#7a5a1c'; g.lineWidth = 1; g.stroke();
  g.beginPath(); g.ellipse(hx - 1, hy - 12, 10.5, 8, 0, Math.PI, 0); g.fillStyle = '#f6dc8a'; g.fill(); g.stroke(); g.fillStyle = '#b03a2a'; g.fillRect(hx - 11, hy - 13, 21, 3);
  g.strokeStyle = 'rgba(120,90,30,0.5)'; g.lineWidth = 0.8; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(hx - 14 + k * 3, hy - 9); g.lineTo(hx - 15 + k * 3, hy - 8); g.stroke(); }
  names.push(addProjectImage('fisher/f' + (cheer ? 1 : 0) + '.png', c, {}).name);
}
fisher(0); fisher(1);
`;
const rigJS = pre + `
// rod, line and float, 200 x 140 shown at (150, 205); rod handle at local (20, 95). Index: 0 idle, 1 dip, 2 nibble, 3 + e*3 + (bend-1) fight / reel, 27 lift, 28 cast back, 29 cast forward
const OXr = 150, OYr = 205;
function rig(o) {
  const c = mk(200, 140), g = c.getContext('2d');
  const base = [20, 95], bend = o.bend || 0, tip = o.tip || [110 - bend * 7, 22 + bend * 13];
  const ctrl = [base[0] + (tip[0] - base[0]) * 0.5 - bend * 1.5, base[1] + (tip[1] - base[1]) * 0.5 + 3 + bend * 3];
  // line
  if (o.end) { const E = o.end, sag = o.taut ? 1.5 : 12; g.strokeStyle = 'rgba(240,244,236,0.85)'; g.lineWidth = 1; g.beginPath(); g.moveTo(tip[0], tip[1]); g.quadraticCurveTo((tip[0] + E[0]) / 2, (tip[1] + E[1]) / 2 + sag, E[0], E[1]); g.stroke(); }
  // ripples where the line meets the water
  if (o.ripple) { const E = o.ripple; for (let k = 0; k < o.rings; k++) { g.beginPath(); g.ellipse(E[0], E[1] + 1.5, 8 + k * 7, 2.4 + k * 1.6, 0, 0, 7); g.strokeStyle = 'rgba(255,255,255,' + (0.5 - k * 0.14) + ')'; g.lineWidth = 1; g.stroke(); } }
  if (o.bob) { const B = o.bob; g.beginPath(); g.ellipse(B[0], B[1] + 2, 4.2, 5.6 - o.dip, 0, 0, 7); const q = g.createLinearGradient(0, B[1] - 4, 0, B[1] + 6); q.addColorStop(0, '#e83a2a'); q.addColorStop(0.55, '#e83a2a'); q.addColorStop(0.56, '#f6f2e8'); q.addColorStop(1, '#cfc8b8'); g.fillStyle = q; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 0.8; g.stroke(); g.fillStyle = '#e8e8e8'; g.fillRect(B[0] - 0.6, B[1] - 8 + o.dip, 1.2, 4); }
  // rod
  g.lineCap = 'round'; g.strokeStyle = '#2a1a0c'; g.lineWidth = 4.4; g.beginPath(); g.moveTo(base[0] - 6, base[1] + 5); g.lineTo(base[0], base[1]); g.stroke();
  g.strokeStyle = '#6a4a22'; g.lineWidth = 3; g.beginPath(); g.moveTo(base[0], base[1]); g.quadraticCurveTo(ctrl[0], ctrl[1], tip[0], tip[1]); g.stroke();
  g.strokeStyle = '#c8a05a'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(base[0], base[1] - 1); g.quadraticCurveTo(ctrl[0], ctrl[1] - 1, tip[0], tip[1]); g.stroke();
  g.fillStyle = '#2a1a0c'; g.beginPath(); g.roundRect(base[0] - 2, base[1] - 4, 12, 8, 2); g.fill(); g.fillStyle = '#9a9aa2'; g.beginPath(); g.arc(base[0] + 6, base[1] + 6, 4, 0, 7); g.fill(); g.strokeStyle = '#4a4a52'; g.lineWidth = 1; g.stroke();
  names.push(addProjectImage('rig/r' + names.length + '.png', c, {}).name);
}
const E = (e) => [BX(e) - OXr, BY(e) - OYr];
rig({ end: E(0), bob: E(0), dip: 0, ripple: E(0), rings: 2 });
rig({ end: E(0), bob: [E(0)[0], E(0)[1] + 2], dip: 1.6, ripple: E(0), rings: 2 });
rig({ end: E(0), bob: [E(0)[0], E(0)[1] + 4], dip: 3.4, ripple: E(0), rings: 3 });
for (let e = 0; e < 8; e++) for (let b = 1; b <= 3; b++) rig({ bend: b, end: E(e), taut: true, ripple: E(e), rings: b });
rig({ bend: 2, end: [118, 80], taut: true });
rig({ tip: [52, 10], end: [34, 50] });
rig({ bend: -1, tip: [122, 36], end: [150, 60], taut: false });
`;
const fishJS = pre + `
function fish(kind, cv, sc) {
  const c = mk(56, 32), g = c.getContext('2d'); g.translate(28, 16); g.scale(sc || 1, sc || 1);
  const bodyG = (a, b) => { const q = g.createLinearGradient(0, -8, 0, 9); q.addColorStop(0, a); q.addColorStop(1, b); return q; };
  g.save(); g.rotate(cv ? 0.16 : 0);
  if (kind === 3) { g.beginPath(); g.moveTo(-12, -12); g.lineTo(2, -12); g.lineTo(3, 0); g.quadraticCurveTo(16, 2, 18, 9); g.lineTo(-12, 9); g.closePath(); g.fillStyle = bodyG('#8a5a2a', '#4a2c12'); g.fill(); g.strokeStyle = '#2a1608'; g.lineWidth = 1.2; g.stroke(); g.fillStyle = '#c8b890'; for (let i = 0; i < 3; i++) g.fillRect(-9 + i * 3.4, -9 + i * 1, 1.6, 2); g.fillStyle = '#3a2412'; g.fillRect(-12, 6, 30, 3); g.restore(); return c; }
  const L = kind === 2 ? 25 : kind === 1 ? 20 : 17, Hh = kind === 2 ? 5.4 : kind === 1 ? 9 : 7.4;
  const pal = [['#c8d6dc', '#6a8a98'], ['#f08a2a', '#b34a12'], ['#8a9a3a', '#4a5a1c'], ['', ''], ['#ffd84a', '#d8901a']][kind];
  g.beginPath(); g.moveTo(-L - 1, 0); g.lineTo(-L - 9, -7); g.lineTo(-L - 7, 0); g.lineTo(-L - 9, 7); g.closePath(); g.fillStyle = pal[1]; g.fill();
  g.beginPath(); g.ellipse(0, 0, L, Hh, 0, 0, 7); g.fillStyle = bodyG(pal[0], pal[1]); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.stroke();
  if (kind === 0) { g.strokeStyle = 'rgba(40,70,60,0.55)'; g.lineWidth = 1.6; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 5, -Hh + 1); g.lineTo(i * 5 + 1, Hh - 1); g.stroke(); } g.beginPath(); g.moveTo(-4, -Hh); g.lineTo(0, -Hh - 6); g.lineTo(8, -Hh); g.closePath(); g.fillStyle = '#d85a3a'; g.fill(); }
  if (kind === 1) { g.strokeStyle = 'rgba(120,50,10,0.5)'; g.lineWidth = 0.8; for (let i = -3; i <= 3; i++) for (let j = -1; j <= 1; j++) { g.beginPath(); g.arc(i * 5, j * 4.4, 2.6, 0.3, Math.PI - 0.3); g.stroke(); } g.beginPath(); g.moveTo(-6, -Hh); g.lineTo(2, -Hh - 6); g.lineTo(10, -Hh); g.closePath(); g.fillStyle = '#e06a1a'; g.fill(); }
  if (kind === 2) { g.fillStyle = 'rgba(255,230,120,0.8)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(-18 + i * 4.4, -1 + Math.sin(i) * 2, 1, 0, 7); g.fill(); } g.beginPath(); g.moveTo(8, -Hh); g.lineTo(18, -Hh - 4); g.lineTo(21, -Hh + 1); g.closePath(); g.fillStyle = '#6a7a28'; g.fill(); }
  if (kind === 4) { g.strokeStyle = 'rgba(255,255,230,0.7)'; g.lineWidth = 1; for (let i = -3; i <= 3; i++) { g.beginPath(); g.arc(i * 5, 0, 3, 0.4, 2.7); g.stroke(); } g.save(); g.shadowColor = '#fff3a0'; g.shadowBlur = 7; g.beginPath(); g.ellipse(0, 0, L - 3, Hh - 2, 0, 0, 7); g.fillStyle = 'rgba(255,240,150,0.35)'; g.fill(); g.restore(); }
  g.beginPath(); g.arc(L - 6, -1.2, 2.2, 0, 7); g.fillStyle = '#fff'; g.fill(); g.beginPath(); g.arc(L - 5.4, -1.2, 1.1, 0, 7); g.fillStyle = '#111'; g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1; g.beginPath(); g.arc(L - 9, 0, 6.5, -0.9, 0.9); g.stroke(); g.restore();
  return c;
}
const flip = (c) => { const o = mk(c.width, c.height), g = o.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); return o; };
for (let k = 0; k < 5; k++) for (const dir of [0, 1]) for (const cv of [0, 1]) { const c = fish(k, cv, 1); names.push(addProjectImage('fish/f' + k + dir + cv + '.png', dir ? flip(c) : c, {}).name); }
// bucket icons (small, tail up) and underwater shadows
for (let k = 0; k < 5; k++) { const big = fish(k, 1, 0.55), c = mk(26, 22), g = c.getContext('2d'); g.translate(13, 11); g.rotate(-0.9); g.drawImage(big, -28, -16); names.push(addProjectImage('fish/i' + k + '.png', c, {}).name); }
for (const [w, sc] of [[44, 0.6], [56, 0.85]]) for (const dir of [0, 1]) { const c = mk(56, 32), g = c.getContext('2d'); g.save(); g.filter = 'blur(1.2px)'; g.translate(28, 16); g.scale(sc, sc * 0.7); g.beginPath(); g.ellipse(0, 0, 22, 8, 0, 0, 7); g.fillStyle = 'rgba(6,22,34,0.55)'; g.fill(); g.beginPath(); g.moveTo(-20, 0); g.lineTo(-30, -7); g.lineTo(-28, 0); g.lineTo(-30, 7); g.closePath(); g.fill(); g.restore(); names.push(addProjectImage('fish/s' + w + dir + '.png', dir ? flip(c) : c, {}).name); }
// splash frames and sparkles
for (let k = 0; k < 4; k++) { const c = mk(44, 30), g = c.getContext('2d'); const u = k / 3; g.translate(22, 20); for (let j = 0; j < 2; j++) { const rr = 5 + u * 14 + j * 5; g.beginPath(); g.ellipse(0, 0, rr, rr * 0.3, 0, 0, 7); g.strokeStyle = 'rgba(255,255,255,' + (0.8 - u * 0.6 - j * 0.15) + ')'; g.lineWidth = 1.4; g.stroke(); }
  for (let i = 0; i < 8; i++) { const a = -Math.PI * (0.15 + 0.7 * i / 7), d = 4 + u * 14, h = Math.sin(u * Math.PI) * 10; g.beginPath(); g.arc(Math.cos(a) * d * 1.4, -Math.abs(Math.sin(a)) * h - 2 + u * 6, 1.6 - u * 0.8, 0, 7); g.fillStyle = 'rgba(235,248,255,' + (0.95 - u * 0.5) + ')'; g.fill(); } names.push(addProjectImage('fx/spl' + k + '.png', c, {}).name); }
for (const r of [6, 9]) { const c = mk(22, 22), g = c.getContext('2d'); g.translate(11, 11); g.fillStyle = '#fff6b0'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.3 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); names.push(addProjectImage('fx/spk' + r + '.png', c, {}).name); }
`;
const fgJS = pre + `
const c = mk(W, H), g = c.getContext('2d');
const reeds = (x0, dirn, n, hmin) => { for (let i = 0; i < n; i++) { const x = x0 + dirn * i * 4 + rnd() * 3, top = hmin + rnd() * 90, lean = dirn * (4 + rnd() * 14); const q = g.createLinearGradient(0, top, 0, H); q.addColorStop(0, '#9aa44f'); q.addColorStop(0.5, '#4a5a26'); q.addColorStop(1, '#1d2a14'); g.strokeStyle = q; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + lean * 0.2, (top + H) / 2, x + lean, top); g.stroke();
  if (i % 3 === 0) { g.save(); g.translate(x + lean, top); g.beginPath(); g.ellipse(0, 12, 4.2, 13, 0, 0, 7); g.fillStyle = '#5a3a22'; g.fill(); g.restore(); } } };
reeds(384, -1, 14, 250); reeds(2, 1, 5, 380);
for (const [x, y, rw, rh] of [[300, 402, 26, 6], [352, 424, 22, 5], [250, 428, 18, 4.5]]) { g.save(); g.translate(x, y); g.beginPath(); g.ellipse(0, 0, rw, rh, 0, 0.18, Math.PI * 2 - 0.1); g.lineTo(0, 0); g.closePath(); const q = g.createRadialGradient(-rw * 0.3, -rh * 0.3, 1, 0, 0, rw); q.addColorStop(0, '#6fa04a'); q.addColorStop(1, '#2c5a2c'); g.fillStyle = q; g.fill(); g.restore(); }
names.push(addProjectImage('foreground.png', c, {}).name);
`;
const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const F = 'Josefin Sans';
const addLay = (name, handle, imgs, rot, x, y) => `{ const im = ${imgs}; const e = await addElement('IMG', { src: im[${rot}] }); e.name = '${name}'; e.src = im[${rot}]; e.images = im.slice(${rot}).concat(im.slice(0, ${rot})); e.handle = '${handle}'; e.x = ${x}; e.y = ${y}; e.show = 'normal'; }`;
// image counts: fish 20, bucket icons 5, shadows 4, splash 4, sparkle 2
const NF = 20, NI = 5, NSH = 4, NSP = 4, NSK = 2, NR = 30;
const steps = [{ preset: 'bg' }];
PH.forEach((P) => steps.push(wrap(sceneJS(P), `window.__fp = window.__fp || {}; window.__fp['${P.id}'] = names[0]; return 1`)));
steps.push(
  { script: `const sc = ${JSON.stringify(PH.map((P) => P.id))}.map((id) => window.__fp[id]); const e = await addElement('IMG', { src: sc[0] }); e.name = 'Lake and dock'; e.src = sc[0]; e.images = sc; e.handle = 'scene'; e.x = 0; e.y = 0; e.show = 'normal'; return sc.length` },
  wrap(fishJS, `
    const fk = names.slice(0, ${NF}), ic = names.slice(${NF}, ${NF + NI}), sh = names.slice(${NF + NI}, ${NF + NI + NSH}), sp = names.slice(${NF + NI + NSH}, ${NF + NI + NSH + NSP}), sk = names.slice(${NF + NI + NSH + NSP});
    ${addLay('Fish shadow 1', 'sh0', 'sh', 0, 214, 346)}
    ${addLay('Fish shadow 2', 'sh1', 'sh', 3, 262, 392)}
    return 1`),
  wrap(fisherJS, `const f = names.slice(0, 2); { const e = await addElement('IMG', { src: f[1] }); e.name = 'Fisher'; e.src = f[1]; e.images = [f[1], f[0]]; e.handle = 'fs'; e.x = 112; e.y = 258; e.show = 'normal'; } return 1`),
  wrap(rigJS, `
    const rg = names.slice(0, ${NR}); { const e = await addElement('IMG', { src: rg[27] }); e.name = 'Rod and line'; e.src = rg[27]; e.images = rg.slice(27).concat(rg.slice(0, 27)); e.handle = 'rig'; e.x = 150; e.y = 205; e.show = 'normal'; } return 1`),
  wrap(fishJS, `
    const fk = names.slice(0, ${NF}), ic = names.slice(${NF}, ${NF + NI}), sp = names.slice(${NF + NI + NSH}, ${NF + NI + NSH + NSP}), sk = names.slice(${NF + NI + NSH + NSP});
    ${addLay('Hooked fish', 'fish', 'fk', 4, 244, 270)}
    ${addLay('Splash', 'spl', 'sp', 2, 250, 296)}
    ${addLay('Sparkle 1', 'sk0', 'sk', 0, 296, 252)}
    ${addLay('Sparkle 2', 'sk1', 'sk', 1, 232, 252)}
    ${Array.from({ length: 5 }, (_, i) => addLay('Bucket fish ' + (i + 1), 'bk' + i, 'ic', [1, 0, 2, 4, 3][i], 64 + i * 6, 306 + (i % 2) * 2)).join('\n    ')}
    return 1`),
  wrap(fgJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Reeds and lily pads'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  { preset: 'clock' }, { preset: 'clock' },
  { script: `const n = project.elements.length; ['Hour','Colon','Minute'].forEach((nm,i)=>{ project.elements[n-3+i].name = nm + ' Aod'; }); return 1` },
  { preset: 'weekday' }, { preset: 'day' }, { preset: 'steps' }, { preset: 'battery' },
  { remove: 'Colon Aod' },
);
const ink = (size, color, extra) => ({ font: F, size, weight: 600, fill: 'solid', color, shadowColor: 'rgba(8,24,40,0.8)', shadowX: 0, shadowY: 2, shadowBlur: 6, ...extra });
steps.push(
  { edit: 'Hour', set: { x: 67, y: 22, space: -10, show: 'normal', zero: 1 }, glyph: ink(84, '#fff6e4') },
  { edit: 'Colon', set: { x: 176, y: 33, show: 'normal' }, glyph: ink(84, '#fff6e4') },
  { edit: 'Minute', set: { x: 206, y: 22, show: 'normal', zero: 1 }, glyph: ink(84, '#fff6e4') },
  { edit: 'Weekday', set: { x: 130, y: 94, show: 'normal' }, glyph: ink(30, '#fff6e4') },
  { edit: 'Day', set: { x: 210, y: 104, space: -4, show: 'normal' }, glyph: ink(30, '#fff6e4') },
  { edit: 'Steps', set: { x: 108, y: 398, hSpace: -3, show: 'normal' }, glyph: ink(32, '#fff6e4') },
  { edit: 'Battery', set: { x: 217, y: 398, hSpace: -3, show: 'normal' }, glyph: ink(32, '#fff6e4') },
  { edit: 'Hour Aod', set: { x: 122, y: 111, show: 'aod', zero: 1 }, glyph: { font: F, size: 120, weight: 600, fill: 'solid', color: '#7a8a96' } },
  { edit: 'Minute Aod', set: { x: 109, y: 251, show: 'aod', zero: 1 }, glyph: { font: F, size: 120, weight: 600, fill: 'solid', color: '#7a8a96' } },
  { script: `project.groups = project.groups || {}; project.groups.gRig = 'Fishing'; project.groups.gBucket = 'Bucket'; let n = 0; for (const e of project.elements) { if (['Fisher','Rod and line','Hooked fish','Splash'].includes(e.name) || /^(Fish shadow|Sparkle)/.test(e.name)) { e.group = 'gRig'; n++ } if (/^Bucket fish/.test(e.name)) { e.group = 'gBucket'; n++ } } return n` },
  { script: `project.groups = project.groups || {}; project.groups.gDate = 'Date'; let n = 0; for (const e of project.elements) { if (e.name === 'Weekday' || e.name === 'Day' || e.name === 'Month') { e.group = 'gDate'; n++ } } for (const k of Object.keys(project.groups)) if (project.groups[k] === 'Clock 2') project.groups[k] = 'Clock AOD'; return n` },
  { script: `document.getElementById('btnPruneImages').click(); return project.images.length + ' images left'` },
);
const MEASURE = !!process.env.MEASURE;
if (MEASURE) steps.splice(1, 3 + 1 + 5);
// Runs on the watch: the fishing game, and the swap of the lake picture with the time of day. Everything is placed from Date.now() deltas.
const userImports = "import { Time as DCTime } from '@zos/sensor'";
const userCode = `{
  const MS = 100
  const lerp = (a, b, t) => a + (b - a) * t
  const BX = (e) => 320 - 15 * e, BY = (e) => 298 + 5.4 * e
  const FROM = ${JSON.stringify(PH.map((P, i) => [P.from, i]).sort((a, b) => a[0] - b[0]))}
  const RROT = 27, FKROT = 4
  let seed = 3
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const ri = (a, b) => a + rnd() * (b - a)
  const mv = (w, x, y, src) => { if (src === undefined) w.setProperty(ui.prop.MORE, { x: pxv(Math.round(x)), y: pxv(Math.round(y)) }); else w.setProperty(ui.prop.MORE, { x: pxv(Math.round(x)), y: pxv(Math.round(y)), src }) }
  const away = (w) => w.setProperty(ui.prop.MORE, { x: pxv(-200), y: pxv(0) })
  const RIG = (i) => F.rig[(i - RROT + 30) % 30]
  const FK = (k, dir, cv) => F.fish[((k * 2 + dir) * 2 + cv - FKROT + 20) % 20]
  const FS = [F.fs[1], F.fs[0]]
  const BKROT = [1, 0, 2, 4, 3]
  const bk = []; for (let i = 0; i < 5; i++) bk.push({ w: W['bk' + i], kind: -1 })
  let clock = null; try { clock = new DCTime() } catch (e) {}
  const minutes = () => { try { if (clock) { const h = clock.getHours(), m = clock.getMinutes(); if (typeof h === 'number' && typeof m === 'number') return h * 60 + m } } catch (e) {} try { const d = new Date(); return d.getHours() * 60 + d.getMinutes() } catch (e) {} return 600 }
  const phase = (m) => { let p = 2; for (const f of FROM) if (m >= f[0]) p = f[1]; return p }
  let curPh = -1, t = 0, last = 0, id = null, st = 'cast', tt = 0, dur = 1, shown = {}, rigI = -1, fsI = -1
  let fkind = 0, fdir = 0, e = 0, lost = false, biteSoon = false, nib = 0, caught = 0, fx = 0, fy = 0
  const set = (name, v) => { if (shown[name] === v) return false; shown[name] = v; return true }
  const rig = (i) => { if (set('rig', i)) mv(W.rig, 150, 205, RIG(i)) }
  const fisher = (i) => { if (set('fs', i)) mv(W.fs, 112, 258, FS[i]) }
  const hideFish = () => { away(W.fish); shown.fish = -1 }
  const SHK = [{ w: W.sh0, x: 100, y: 346, vx: 6, dir: 0, sz: 0, tx: 0, ty: 0 }, { w: W.sh1, x: 280, y: 392, vx: -5, dir: 1, sz: 1, tx: 0, ty: 0 }]
  const shSrc = (q) => F[q.w === W.sh0 ? 'sh0' : 'sh1'][((q.sz * 2 + q.dir) - (q.w === W.sh0 ? 0 : 3) + 4) % 4]
  const to = (s, d) => { st = s; tt = 0; dur = d }
  const pickFish = () => { const r = rnd(); return r < 0.38 ? 0 : r < 0.62 ? 1 : r < 0.78 ? 2 : r < 0.9 ? 3 : 4 }
  to('cast', 0.9)
  const tick = () => {
    const now = Date.now(); let dt = last ? (now - last) / 1000 : MS / 1000; dt = Math.min(0.15, dt); last = now; t += dt; tt += dt
    const p = phase(minutes()); if (p !== curPh) { curPh = p; W.scene.setProperty(ui.prop.MORE, { x: pxv(0), y: pxv(0), src: F.scene[p] }) }
    // underwater shadows drift; one comes to the float while we wait
    for (const q of SHK) { let tx = q.tx, ty = q.ty
      const near = (st === 'wait' && tt > dur - 2.2 || st === 'nibble') && q === SHK[0]
      if (near) { q.x += (BX(0) - 16 + Math.sin(t * 2.4) * 10 - q.x) * Math.min(1, dt * 1.6); q.y += (BY(0) + 22 + Math.cos(t * 2) * 5 - q.y) * Math.min(1, dt * 1.6) }
      else { q.x += q.vx * dt; q.y += Math.sin(t * 0.7 + q.sz) * 3 * dt }
      if (q.x > 360) { q.vx = -Math.abs(q.vx); q.dir = 1 } if (q.x < 120) { q.vx = Math.abs(q.vx); q.dir = 0 }
      mv(q.w, q.x - 28, q.y - 16, shSrc(q)) }
    if (st === 'cast') {
      fisher(0); hideFish(); away(W.spl); away(W.sk0); away(W.sk1)
      if (tt < 0.35) rig(28); else if (tt < 0.6) rig(29); else rig(0)
      if (tt >= dur) { to('wait', ri(4, 8.5)); mv(W.spl, BX(0) - 22, BY(0) - 14, F.spl[0]); shown.spl = 0 }
    } else if (st === 'wait') {
      rig(Math.floor(t * 1.3) % 2 ? 1 : 0)
      if (shown.spl !== -1) { const k = Math.min(3, Math.floor(tt / 0.25)); if (k >= 3 && tt > 1) { away(W.spl); shown.spl = -1 } else mv(W.spl, BX(0) - 22, BY(0) - 14, F.spl[k]) }
      if (tt >= dur) { to('nibble', ri(1.4, 2.6)); nib = 0; biteSoon = rnd() < 0.72 }
    } else if (st === 'nibble') {
      rig(Math.floor(tt / 0.32) % 2 ? 2 : 1)
      if (tt >= dur) { if (biteSoon) { fkind = pickFish(); fdir = rnd() < 0.5 ? 0 : 1; to('fight', ri(3, 5)); lost = rnd() < 0.2; mv(W.spl, BX(0) - 22, BY(0) - 14, F.spl[1]); shown.spl = 1 } else to('wait', ri(2.5, 5)) }
    } else if (st === 'fight') {
      const b = 1 + Math.floor(tt / 0.45) % 3
      rig(3 + 0 * 3 + (b - 1)); fisher(0)
      const k = Math.min(3, Math.floor(tt / 0.15)); if (tt < 0.6) mv(W.spl, BX(0) - 22, BY(0) - 14, F.spl[k]); else if (shown.spl !== -1) { away(W.spl); shown.spl = -1 }
      const jump = Math.max(0, Math.sin(tt * 6)) * 16
      mv(W.fish, BX(0) - 28 + Math.sin(tt * 5) * 8, BY(0) - 14 - jump, FK(fkind, Math.floor(tt * 3) % 2, Math.floor(tt * 7) % 2)); shown.fish = 1
      if (tt >= dur) { if (lost) { hideFish(); mv(W.spl, BX(0) - 22, BY(0) - 14, F.spl[2]); to('cast', 1.6) } else { to('reel', 3.4); e = 0 } }
    } else if (st === 'reel') {
      e = Math.min(7, Math.floor(tt / dur * 8)); const b = 2 + Math.floor(tt / 0.5) % 2 - 0; rig(3 + e * 3 + (b - 1)); fisher(0)
      mv(W.fish, BX(e) - 28 + Math.sin(tt * 6) * 5, BY(e) - 12 - Math.max(0, Math.sin(tt * 7)) * 6, FK(fkind, fdir, Math.floor(tt * 6) % 2)); shown.fish = 1
      if (tt >= dur) to('lift', 1.5)
    } else if (st === 'lift') {
      rig(27); fisher(1); const sw = Math.sin(tt * 4) * 6, rise = Math.min(1, tt / 0.5)
      fx = 262 - 28 + sw; fy = lerp(BY(7) - 12, 268, rise); mv(W.fish, fx, fy, FK(fkind, 0, Math.floor(tt * 5) % 2)); shown.fish = 1
      if (fkind === 4) { mv(W.sk0, fx + 40, fy - 10 + Math.sin(tt * 9) * 3, F.sk0[Math.floor(tt * 8) % 2]); mv(W.sk1, fx - 8, fy + 6 + Math.cos(tt * 9) * 3, F.sk1[Math.floor(tt * 8 + 1) % 2]) }
      if (tt >= dur) to('bucket', 0.8)
    } else if (st === 'bucket') {
      rig(27); fisher(1); away(W.sk0); away(W.sk1)
      const u = Math.min(1, tt / dur), x = lerp(fx, 70, u), y = lerp(fy, 316, u) - Math.sin(u * Math.PI) * 40
      mv(W.fish, x, y, FK(fkind, 1, 1))
      if (tt >= dur) { hideFish(); const slot = bk[caught % 5]; slot.kind = fkind; mv(slot.w, 64 + (caught % 5) * 6, 306 + (caught % 5 % 2) * 2, F['bk' + (caught % 5)][(fkind - BKROT[caught % 5] + 5) % 5]); caught++; if (caught % 5 === 0) to('release', 1.6); else to('rest', 1.2) }
    } else if (st === 'release') {
      if (tt >= dur) { for (const s of bk) { away(s.w) } mv(W.spl, 70, 330, F.spl[2]); shown.spl = 2; to('rest', 0.8) }
    } else if (st === 'rest') {
      fisher(0); rig(0); if (tt >= dur) { for (const s of bk.slice(0, caught % 5 === 0 ? 5 : 0)) away(s.w); to('cast', 0.9) }
    }
  }
  for (const s of bk) away(s.w)
  const safe = () => { try { tick() } catch (e) {} }
  const stop = () => { if (id === null) return; try { clearInterval(id) } catch (e) {} id = null }
  const start = () => { if (id !== null) return; last = 0; try { id = setInterval(safe, MS) } catch (e) {} }
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: () => { curPh = -1; start() }, pause_call: stop })
  safe()
  start()
}`;
const full = { name: 'Fishing Pond', device: 'bip-6', font: F, description: 'A fisher on a wooden dock plays a calm fishing game by itself: casts, waits, nibbles, hooks, fights, reels and lifts a catch into the bucket. The lake follows the day: day, sunset, night.', preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/fishing-pond', optimizePng: 24, userImports, userCode, steps };
if (MEASURE) { delete full.save; delete full.out; delete full.optimizePng; delete full.previewAod; full.preview = 'measure.png'; }
fs.writeFileSync(__dirname + (MEASURE ? '/recipe-measure.json' : '/recipe.json'), JSON.stringify(full, null, 1));
