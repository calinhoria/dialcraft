const fs = require('fs');
const pre = `
const W = dev().w, H = dev().h;
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
`;

// ---- scene: dark wall lit from a window, wooden shelf, terracotta pot with soil (static) ----
const sceneJS = pre + `
const c = mk(W, H), g = c.getContext('2d');
// wall
let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#202823'); gr.addColorStop(1, '#0c100d');
g.fillStyle = gr; g.fillRect(0, 0, W, H);
gr = g.createRadialGradient(300, 140, 10, 300, 140, 330);
gr.addColorStop(0, 'rgba(255,236,190,0.30)'); gr.addColorStop(0.45, 'rgba(255,220,160,0.09)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
g.fillStyle = gr; g.fillRect(0, 0, W, H);
// diagonal window light shafts
g.save(); g.rotate(-0.35);
for (let i = 0; i < 4; i++) { const x = 130 + i * 78; const s = g.createLinearGradient(x, 0, x + 40, 0);
  s.addColorStop(0, 'rgba(255,235,190,0)'); s.addColorStop(0.5, 'rgba(255,235,190,0.055)'); s.addColorStop(1, 'rgba(255,235,190,0)');
  g.fillStyle = s; g.fillRect(x, -100, 40, 700); }
g.restore();
// plaster grain
for (let i = 0; i < 2600; i++) { g.fillStyle = 'rgba(' + (rnd() > 0.5 ? '255,255,240' : '0,0,0') + ',' + (0.015 + rnd() * 0.03) + ')'; g.fillRect(rnd() * W, rnd() * 432, 1 + rnd() * 1.5, 1 + rnd() * 1.5); }
// shelf
const SY = 432;
gr = g.createLinearGradient(0, SY, 0, H); gr.addColorStop(0, '#8a5d36'); gr.addColorStop(0.12, '#6d4724'); gr.addColorStop(1, '#3a2312');
g.fillStyle = gr; g.fillRect(0, SY, W, H - SY);
g.fillStyle = 'rgba(255,225,170,0.45)'; g.fillRect(0, SY, W, 1.5);
for (let i = 0; i < 26; i++) { g.strokeStyle = 'rgba(30,15,5,' + (0.1 + rnd() * 0.2) + ')'; g.lineWidth = 0.6 + rnd() * 0.8; const y = SY + 3 + rnd() * (H - SY - 3);
  g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + rnd() * 3 - 1.5, W * 0.7, y + rnd() * 3 - 1.5, W, y + rnd() * 2 - 1); g.stroke(); }
// shadow of the pot on the wall and shelf
gr = g.createRadialGradient(195, SY + 2, 10, 195, SY + 2, 150); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
g.save(); g.translate(195, SY + 2); g.scale(1, 0.14); g.translate(-195, -(SY + 2)); g.fillStyle = gr; g.fillRect(0, SY - 400, W, 900); g.restore();
// pot body (tapered) with terracotta shading
const terr = (x0, x1) => { const t = g.createLinearGradient(x0, 0, x1, 0);
  t.addColorStop(0, '#6a2c14'); t.addColorStop(0.12, '#9c4624'); t.addColorStop(0.34, '#d97b48'); t.addColorStop(0.5, '#c9693a'); t.addColorStop(0.78, '#a04d27'); t.addColorStop(1, '#5a2410'); return t; };
g.beginPath(); g.moveTo(92, 372); g.lineTo(298, 372); g.bezierCurveTo(290, 400, 270, 420, 254, SY); g.lineTo(136, SY); g.bezierCurveTo(120, 420, 100, 400, 92, 372); g.closePath();
g.fillStyle = terr(92, 298); g.fill();
g.save(); g.clip();
gr = g.createLinearGradient(0, 372, 0, SY); gr.addColorStop(0, 'rgba(40,10,0,0.45)'); gr.addColorStop(0.25, 'rgba(40,10,0,0.0)'); gr.addColorStop(1, 'rgba(30,8,0,0.35)');
g.fillStyle = gr; g.fillRect(80, 372, 240, 70);
for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(' + (rnd() > 0.5 ? '255,200,150' : '60,20,5') + ',' + (0.04 + rnd() * 0.08) + ')'; g.fillRect(90 + rnd() * 210, 372 + rnd() * 62, 1 + rnd(), 1 + rnd()); }
g.restore();
// rim: front band, then the top face as an ellipse
g.beginPath(); g.roundRect(76, 347, 238, 28, [4, 4, 7, 7]); g.fillStyle = terr(76, 314); g.fill();
gr = g.createLinearGradient(0, 347, 0, 375); gr.addColorStop(0, 'rgba(255,200,150,0.18)'); gr.addColorStop(0.7, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(30,8,0,0.45)'); g.fillStyle = gr; g.fillRect(76, 347, 238, 28);
for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(' + (rnd() > 0.5 ? '255,200,150' : '60,20,5') + ',' + (0.04 + rnd() * 0.08) + ')'; g.fillRect(78 + rnd() * 234, 349 + rnd() * 25, 1 + rnd(), 1 + rnd()); }
g.beginPath(); g.ellipse(195, 348, 119, 11, 0, 0, 7);
gr = g.createLinearGradient(76, 0, 314, 0); gr.addColorStop(0, '#8a3b1c'); gr.addColorStop(0.35, '#e8935e'); gr.addColorStop(0.7, '#b9582d'); gr.addColorStop(1, '#6a2a12'); g.fillStyle = gr; g.fill();
// soil
g.beginPath(); g.ellipse(195, 349.5, 106, 7.5, 0, 0, 7);
gr = g.createLinearGradient(0, 342, 0, 357); gr.addColorStop(0, '#1d120a'); gr.addColorStop(1, '#3b2514'); g.fillStyle = gr; g.fill();
g.save(); g.clip();
for (let i = 0; i < 260; i++) { const x = 90 + rnd() * 210, y = 341 + rnd() * 16; g.beginPath(); g.arc(x, y, 0.6 + rnd() * 1.6, 0, 7); g.fillStyle = rnd() > 0.5 ? 'rgba(92,60,34,' + (0.5 + rnd() * 0.4) + ')' : 'rgba(10,5,2,0.6)'; g.fill(); }
g.restore();
names.push(addProjectImage('scene.png', c, {}).name);
`;

// ---- shared plant helpers ----
const plantLib = `
const PW = 270, PH = 240, BX = 135, BY = 238;
const mkC = () => { const c = mk(PW, PH); return [c, c.getContext('2d')]; };
const qpt = (p, t) => { const u = 1 - t; return [u*u*p[0] + 2*u*t*p[2] + t*t*p[4], u*u*p[1] + 2*u*t*p[3] + t*t*p[5]]; };
const qang = (p, t) => { const dx = 2*(1-t)*(p[2]-p[0]) + 2*t*(p[4]-p[2]), dy = 2*(1-t)*(p[3]-p[1]) + 2*t*(p[5]-p[3]); return Math.atan2(dy, dx); };
function stem(g, p, w0, w1, c0, c1) {
  const L = [], R = [], N = 30;
  for (let i = 0; i <= N; i++) { const t = i / N, [x, y] = qpt(p, t), a = qang(p, t) + Math.PI / 2, w = (w0 + (w1 - w0) * t) / 2; L.push([x + Math.cos(a) * w, y + Math.sin(a) * w]); R.push([x - Math.cos(a) * w, y - Math.sin(a) * w]); }
  g.save(); g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 5; g.shadowOffsetX = 2; g.shadowOffsetY = 1;
  g.beginPath(); L.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); R.reverse().forEach((q) => g.lineTo(q[0], q[1])); g.closePath();
  const gr = g.createLinearGradient(p[0] - w0, 0, p[0] + w0, 0); gr.addColorStop(0, c0); gr.addColorStop(0.45, c1); gr.addColorStop(1, c0); g.fillStyle = gr; g.fill(); g.restore();
  g.strokeStyle = 'rgba(255,255,200,0.22)'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i <= N; i++) { const t = i / N, [x, y] = qpt(p, t), a = qang(p, t) - Math.PI / 2; const q = [x + Math.cos(a) * (w0 + (w1 - w0) * t) * 0.18, y + Math.sin(a) * (w0 + (w1 - w0) * t) * 0.18]; i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); } g.stroke();
}
// a pointed leaf from (x,y) pointing at angle a (0 = up), length len, half-width wid, droop bends the tip
function leaf(g, x, y, a, len, wid, droop, dark) {
  g.save(); g.translate(x, y); g.rotate(a);
  const d = (droop || 0) * len;
  g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 6; g.shadowOffsetX = 2; g.shadowOffsetY = 3;
  const path = () => { g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(wid, -len * 0.18, wid * 1.05, -len * 0.62 + d * 0.3, d, -len); g.bezierCurveTo(-wid * 1.05, -len * 0.62 + d * 0.3, -wid, -len * 0.18, 0, 0); g.closePath(); };
  path();
  const gr = g.createLinearGradient(-wid, 0, wid, 0); const k = dark ? 0 : 1;
  gr.addColorStop(0, k ? '#3f8a2a' : '#2a6a20'); gr.addColorStop(0.5, k ? '#69b43c' : '#46902c'); gr.addColorStop(1, k ? '#2f7a24' : '#1f5a1a'); g.fillStyle = gr; g.fill();
  g.shadowColor = 'transparent';
  g.save(); path(); g.clip();
  const hl = g.createLinearGradient(0, 0, 0, -len); hl.addColorStop(0, 'rgba(20,50,10,0.35)'); hl.addColorStop(0.5, 'rgba(255,255,170,0.0)'); hl.addColorStop(1, 'rgba(210,255,140,0.28)'); g.fillStyle = hl; g.fillRect(-wid * 2, -len, wid * 4, len);
  g.strokeStyle = 'rgba(200,245,150,0.35)'; g.lineWidth = 0.9;
  for (let i = 1; i <= 6; i++) { const t = i / 7.5, yy = -len * t, xx = d * t * t; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(xx, yy); g.quadraticCurveTo(xx + s * wid * 0.5, yy - len * 0.04, xx + s * wid * (0.85 - 0.5 * t), yy - len * 0.13); g.stroke(); } }
  g.strokeStyle = 'rgba(215,250,160,0.75)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(d * 0.1, -len * 0.55, d, -len * 0.97); g.stroke();
  g.restore();
  path(); g.strokeStyle = 'rgba(15,55,10,0.55)'; g.lineWidth = 0.9; g.stroke();
  g.restore();
}
function crumbs(g, n) { for (let i = 0; i < n; i++) { const x = BX + (rnd() - 0.5) * 70, y = BY - 1 + (rnd() - 0.5) * 7; g.beginPath(); g.ellipse(x, y, 1.5 + rnd() * 3, 1 + rnd() * 1.6, 0, 0, 7); g.fillStyle = rnd() > 0.45 ? '#3b2514' : '#1d120a'; g.fill(); g.fillStyle = 'rgba(140,100,60,0.35)'; g.fillRect(x - 1, y - 1.5, 1.6, 0.8); } }
function mound(g, w, h) { g.beginPath(); g.moveTo(BX - w, BY + 3); g.bezierCurveTo(BX - w * 0.5, BY - h, BX + w * 0.5, BY - h, BX + w, BY + 3); g.closePath(); const gr = g.createLinearGradient(0, BY - h, 0, BY + 3); gr.addColorStop(0, '#4a3220'); gr.addColorStop(1, '#2a1a0d'); g.fillStyle = gr; g.fill(); }
function bloomHead(g, hx, hy, R, tilt) {
  g.save(); g.translate(hx, hy); g.rotate(tilt); g.scale(1, 0.93);
  g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 8; g.shadowOffsetX = 3; g.shadowOffsetY = 4;
  g.beginPath(); g.arc(0, 0, R * 0.9, 0, 7); g.fillStyle = '#2d5a1a'; g.fill(); g.shadowColor = 'transparent';
  const ring = (n, off, len, wid, c0, c1) => { for (let i = 0; i < n; i++) { const a = (i + off) / n * Math.PI * 2; g.save(); g.rotate(a);
    g.beginPath(); g.moveTo(0, -R * 0.4); g.bezierCurveTo(wid, -R * 0.4 - len * 0.3, wid * 0.8, -R * 0.4 - len * 0.8, 0, -R * 0.4 - len); g.bezierCurveTo(-wid * 0.8, -R * 0.4 - len * 0.8, -wid, -R * 0.4 - len * 0.3, 0, -R * 0.4); g.closePath();
    const gr = g.createLinearGradient(0, -R * 0.4, 0, -R * 0.4 - len); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(150,80,0,0.35)'; g.lineWidth = 0.8; g.stroke();
    g.strokeStyle = 'rgba(170,100,0,0.35)'; g.lineWidth = 0.7; for (const f of [-0.3, 0, 0.3]) { g.beginPath(); g.moveTo(wid * f * 0.3, -R * 0.45); g.lineTo(wid * f * 0.6, -R * 0.4 - len * 0.85); g.stroke(); }
    g.restore(); } };
  ring(19, 0.5, R * 0.78, R * 0.2, '#c98100', '#f3a900');
  ring(19, 0, R * 0.8, R * 0.21, '#e8a100', '#ffd51f');
  const dr = R * 0.5;
  let gr = g.createRadialGradient(0, 0, 1, 0, 0, dr); gr.addColorStop(0, '#2a1606'); gr.addColorStop(0.6, '#4e2b0c'); gr.addColorStop(1, '#8a5a1c');
  g.beginPath(); g.arc(0, 0, dr, 0, 7); g.fillStyle = gr; g.fill();
  const ga = Math.PI * (3 - Math.sqrt(5)), cs = dr / Math.sqrt(230);
  for (let n = 1; n < 230; n++) { const r = cs * Math.sqrt(n), a = n * ga; g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, 0.9 + 0.8 * (n / 230), 0, 7); g.fillStyle = n % 2 ? 'rgba(15,8,2,0.75)' : 'rgba(190,140,60,0.6)'; g.fill(); }
  g.beginPath(); g.arc(0, 0, dr, 0, 7); g.strokeStyle = 'rgba(120,70,10,0.8)'; g.lineWidth = 1.5; g.stroke();
  g.restore();
}
`;

const plantJS = pre + plantLib + `
const stages = [];
// 0 — soil cracking, a hint of green
{ const [c, g] = mkC(); mound(g, 24, 8); crumbs(g, 14);
  g.save(); g.translate(BX + 2, BY - 5); g.rotate(0.3); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(4, -9, 12, -10); g.quadraticCurveTo(6, -4, 3, 0); g.closePath(); g.fillStyle = '#9acb52'; g.fill(); g.restore();
  stages.push(c); }
// 1 — two cotyledons
{ const [c, g] = mkC(); const p = [BX, BY, BX + 3, BY - 20, BX + 4, BY - 42]; crumbs(g, 10);
  stem(g, p, 5.5, 4, '#b4cf6a', '#d7e892'); leaf(g, p[4], p[5] + 2, -1.25, 34, 13, 0.0); leaf(g, p[4], p[5] + 2, 1.15, 34, 13, 0.0); stages.push(c); }
// 2 — cotyledons and first true leaves
{ const [c, g] = mkC(); const p = [BX, BY, BX + 4, BY - 40, BX + 6, BY - 86]; crumbs(g, 10);
  stem(g, p, 7, 5, '#5f9a35', '#8bc04c'); const q = qpt(p, 0.3); leaf(g, q[0], q[1], -1.35, 28, 11, 0.06); leaf(g, q[0], q[1], 1.3, 28, 11, -0.06);
  leaf(g, p[4], p[5] + 4, -0.95, 50, 20, 0.12); leaf(g, p[4], p[5] + 4, 0.9, 50, 20, -0.12); leaf(g, p[4], p[5], 0.0, 22, 8, 0); stages.push(c); }
// 3 — leafy young plant
{ const [c, g] = mkC(); const p = [BX, BY, BX + 6, BY - 75, BX + 8, BY - 138]; crumbs(g, 10);
  stem(g, p, 9, 6, '#4f8f2e', '#78b445');
  const ts = [0.16, 0.34, 0.52, 0.7, 0.86];
  ts.forEach((t, i) => { const q = qpt(p, t), s = i % 2 ? 1 : -1, len = (62 - i * 6), droop = s * (0.2 - i * 0.03);
    leaf(g, q[0], q[1], s * (1.2 - i * 0.09), len, len * 0.38, droop, i < 2); });
  leaf(g, p[4], p[5] + 2, -0.45, 26, 9, 0); leaf(g, p[4], p[5] + 2, 0.45, 26, 9, 0); stages.push(c); }
// 4 — tall, with a bud
{ const [c, g] = mkC(); const p = [BX, BY, BX + 7, BY - 90, BX + 11, BY - 160]; crumbs(g, 10);
  stem(g, p, 10, 7, '#3f7d28', '#6aa63d');
  [0.14, 0.3, 0.46, 0.62, 0.78].forEach((t, i) => { const q = qpt(p, t), s = i % 2 ? 1 : -1, len = (74 - i * 7);
    leaf(g, q[0], q[1], s * (1.15 - i * 0.1), len, len * 0.4, s * (0.22 - i * 0.03), i < 2); });
  const hx = p[4] + 1, hy = p[5] - 8;
  g.save(); g.translate(hx, hy); g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 6; g.shadowOffsetY = 3;
  for (let i = 0; i < 12; i++) { g.save(); g.rotate(i / 12 * Math.PI * 2); g.beginPath(); g.moveTo(-8, -8); g.quadraticCurveTo(0, -30, 8, -8); g.closePath(); g.fillStyle = i % 2 ? '#356f22' : '#4a8c2c'; g.fill(); g.restore(); }
  g.shadowColor = 'transparent'; for (let i = 0; i < 9; i++) { g.save(); g.rotate((i + 0.5) / 9 * Math.PI * 2); g.beginPath(); g.moveTo(-3, -16); g.lineTo(0, -25); g.lineTo(3, -16); g.fillStyle = '#f2b400'; g.fill(); g.restore(); }
  let gr = g.createRadialGradient(-3, -3, 1, 0, 0, 17); gr.addColorStop(0, '#79b94a'); gr.addColorStop(1, '#2d6a1c'); g.beginPath(); g.arc(0, 0, 15, 0, 7); g.fillStyle = gr; g.fill();
  g.restore(); stages.push(c); }
// 5 — sunflower in bloom
{ const [c, g] = mkC(); const p = [BX, BY, BX + 7, BY - 92, BX + 13, BY - 156]; crumbs(g, 10);
  stem(g, p, 11, 8, '#3f7d28', '#6aa63d');
  g.save(); g.fillStyle = 'rgba(210,255,150,0.0)'; g.restore();
  [0.14, 0.3, 0.46, 0.62].forEach((t, i) => { const q = qpt(p, t), s = i % 2 ? 1 : -1, len = (76 - i * 7);
    leaf(g, q[0], q[1], s * (1.15 - i * 0.1), len, len * 0.4, s * (0.22 - i * 0.03), i < 2); });
  bloomHead(g, p[4] + 1, p[5] - 6, 56, 0.14); stages.push(c); }
stages.forEach((c, i) => names.push(addProjectImage('plant/stage_' + i + '.png', c, {}).name));
`;

const beeJS = pre + `
const BW = 140, BH = 96, N = 12;
function bee(g, x, y, dir, tilt, flap) {
  g.save(); g.translate(x, y); g.scale(dir, 1); g.rotate(tilt);
  g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 5; g.shadowOffsetY = 6;
  // wings
  for (const s of [0, 1]) { g.save(); g.translate(-1, -5); g.rotate(-0.5 - (s ? 0.35 : 0) + flap * (s ? -1 : 1)); g.beginPath(); g.ellipse(-2, -9, 4.6, 11, 0, 0, 7); g.fillStyle = 'rgba(235,245,255,' + (s ? 0.45 : 0.62) + ')'; g.fill(); g.strokeStyle = 'rgba(120,150,180,0.55)'; g.lineWidth = 0.7; g.stroke(); g.restore(); }
  g.shadowColor = 'transparent';
  // legs
  g.strokeStyle = '#2a1c08'; g.lineWidth = 1; for (const lx of [-3, 1, 5]) { g.beginPath(); g.moveTo(lx, 6); g.lineTo(lx - 2, 12); g.stroke(); }
  // body
  g.save(); g.beginPath(); g.ellipse(0, 0, 12.5, 8, 0, 0, 7); const gr = g.createLinearGradient(0, -8, 0, 8); gr.addColorStop(0, '#ffd23d'); gr.addColorStop(0.55, '#e8a312'); gr.addColorStop(1, '#a36d08'); g.fillStyle = gr; g.fill(); g.clip();
  g.fillStyle = '#1c1206'; g.fillRect(-7, -9, 3.4, 18); g.fillRect(-0.5, -9, 3.6, 18); g.fillRect(6, -9, 3, 18);
  g.fillStyle = 'rgba(255,240,170,0.35)'; g.beginPath(); g.ellipse(0, -4.5, 9, 2.4, 0, 0, 7); g.fill();
  g.restore();
  g.beginPath(); g.moveTo(-12, -1); g.lineTo(-17, 0.5); g.lineTo(-12, 2.5); g.fillStyle = '#1c1206'; g.fill();
  // head
  g.beginPath(); g.arc(13, 0.5, 5.4, 0, 7); g.fillStyle = '#251808'; g.fill();
  g.beginPath(); g.arc(15, -1, 1.6, 0, 7); g.fillStyle = '#0a0602'; g.fill(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(14.5, -1.8, 0.9, 0.9);
  g.strokeStyle = '#251808'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(16, -3); g.quadraticCurveTo(21, -9, 24, -6); g.stroke();
  g.restore();
}
for (let k = 0; k < N; k++) {
  const c = mk(BW, BH), g = c.getContext('2d'), th = k / N * Math.PI * 2;
  const x = BW / 2 + 42 * Math.cos(th), y = BH / 2 + 18 * Math.sin(2 * th) + 4 * Math.sin(th * 3);
  const dx = -42 * Math.sin(th), dy = 36 * Math.cos(2 * th);
  bee(g, x, y, dx >= 0 ? 1 : -1, Math.atan2(dy, Math.abs(dx)) * 0.35 * (dx >= 0 ? 1 : -1), (k % 2 ? 0.55 : -0.05));
  names.push(addProjectImage('anim/bee_' + k + '.png', c, {}).name);
}
`;

const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const F = 'Montserrat';
const CREAM = '#f4ecd8';
const steps = [{ preset: 'bg' },
  wrap(sceneJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Scene'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  wrap(plantJS, `const e = await addElement('IMG_LEVEL', { dataType: 'STEP', images: names, w: 0, h: 0 }); e.name = 'Plant'; e.images = names; e.dataType = 'STEP'; e.x = 60; e.y = 113; e.show = 'normal'; return names.length`),
  wrap(beeJS, `const e = await addElement('IMG_ANIM', { frames: names, fps: 12, animPrefix: 'bee', repeat: 0 }); e.name = 'Bee'; e.frames = names; e.x = 205; e.y = 128; e.show = 'normal'; return names.length`),
  { preset: 'clock' }, { preset: 'clock' }, { preset: 'weekday' }, { preset: 'day' }, { preset: 'steps' },
  { script: `const n = project.elements.length; const nm = ['Hour','Colon','Minute']; project.elements.slice(n-9, n-6).forEach((e,i)=>{e.name = nm[i] + ' Aod'}); return 1` },
];
const face = (size) => ({ font: F, size, weight: 300, fill: 'solid', color: CREAM, shadowColor: '#000000', shadowX: 0, shadowY: 2, shadowBlur: 6 });
steps.push(
  { remove: 'Colon Aod' },
  { edit: 'Hour', set: { x: 52, y: 12, zero: 1 }, glyph: face(78) },
  { edit: 'Colon', set: { x: 178, y: 20 }, glyph: face(78) },
  { edit: 'Minute', set: { x: 205, y: 12, zero: 1 }, glyph: face(78) },
  { edit: 'Weekday', set: { x: 100, y: 96 }, glyph: { ...face(26), weight: 500, color: '#e9b44c' } },
  { edit: 'Day', set: { x: 220, y: 96 }, glyph: { ...face(26), weight: 500, color: '#e9b44c' } },
  { edit: 'Steps', set: { x: 120, y: 386, alignH: 'CENTER_H', w: 150 }, glyph: { font: F, size: 30, weight: 700, fill: 'solid', color: '#4a1d0a', shadowColor: '#f0a878', shadowX: 0, shadowY: 1, shadowBlur: 0 } },
  { edit: 'Hour Aod', set: { x: 60, y: 120, show: 'aod', zero: 1 }, glyph: { font: F, size: 110, weight: 300, fill: 'solid', color: '#6f6a5c' } },
  { edit: 'Minute Aod', set: { x: 60, y: 250, show: 'aod', zero: 1 }, glyph: { font: F, size: 110, weight: 300, fill: 'solid', color: '#6f6a5c' } },
);
fs.writeFileSync('recipe.json', JSON.stringify({ name: 'Plant Pot', device: 'bip-6', font: F, description: 'A sunflower in a terracotta pot that grows with your daily steps, with a bee buzzing around it.', preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/plant-pot', steps }, null, 1));
