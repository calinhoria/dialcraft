const fs = require('fs');
const pre = `
const W = dev().w, H = dev().h;
let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const HZ = 300; // horizon
`;

// ---------- static scene: night sky, moon, mountains, sea ice, icebergs, snowfield ----------
const sceneJS = pre + `
const c = mk(W, H), g = c.getContext('2d');
let gr = g.createLinearGradient(0, 0, 0, HZ);
gr.addColorStop(0, '#030a1c'); gr.addColorStop(0.45, '#0a2040'); gr.addColorStop(0.8, '#14456a'); gr.addColorStop(1, '#2b7a8c');
g.fillStyle = gr; g.fillRect(0, 0, W, H);
// stars
for (let i = 0; i < 170; i++) { const x = rnd() * W, y = Math.pow(rnd(), 1.5) * 250, r = 0.3 + rnd() * rnd() * 1.4, a = 0.35 + rnd() * 0.65; g.fillStyle = 'rgba(' + (rnd() > 0.7 ? '190,220,255' : '255,255,245') + ',' + a * (1 - y / 330) + ')'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
// moon with halo
{ const mx = 44, my = 44; let q = g.createRadialGradient(mx, my, 6, mx, my, 70); q.addColorStop(0, 'rgba(190,225,255,0.4)'); q.addColorStop(1, 'rgba(120,180,255,0)'); g.fillStyle = q; g.fillRect(mx - 70, my - 70, 140, 140);
  q = g.createRadialGradient(mx - 4, my - 4, 2, mx, my, 17); q.addColorStop(0, '#fbfdff'); q.addColorStop(1, '#bcd2e6'); g.fillStyle = q; g.beginPath(); g.arc(mx, my, 16, 0, 7); g.fill();
  g.fillStyle = 'rgba(120,150,180,0.35)'; for (const [dx, dy, r] of [[-5, -3, 3.4], [5, 4, 2.6], [-2, 7, 2], [6, -6, 1.8]]) { g.beginPath(); g.arc(mx + dx, my + dy, r, 0, 7); g.fill(); } }
// glow of the aurora near the horizon
gr = g.createLinearGradient(0, 180, 0, HZ + 20); gr.addColorStop(0, 'rgba(60,255,160,0)'); gr.addColorStop(1, 'rgba(60,255,170,0.2)'); g.fillStyle = gr; g.fillRect(0, 180, W, 140);
// far mountains with snow caps and cool rim light
const ridge = (pts, base, top, rim) => { g.beginPath(); g.moveTo(-10, HZ + 6); pts.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(W + 10, HZ + 6); g.closePath(); const q = g.createLinearGradient(0, top, 0, HZ); q.addColorStop(0, base[0]); q.addColorStop(1, base[1]); g.fillStyle = q; g.fill(); g.strokeStyle = rim; g.lineWidth = 1.2; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
const jag = (x0, x1, h0, amp, n) => { const p = []; for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t; p.push([x, HZ - h0 - amp * (Math.abs(Math.sin(t * 7 + x0)) * 0.7 + rnd() * 0.5) * Math.sin(Math.PI * Math.min(1, t * 1.05))]); } return p; };
ridge(jag(-10, 400, 30, 70, 34), ['#3d6a86', '#1d4660'], 200, 'rgba(160,255,220,0.35)');
ridge(jag(-10, 400, 14, 46, 40), ['#244b66', '#12344b'], 240, 'rgba(150,240,230,0.3)');
// sea ice with aurora reflection
gr = g.createLinearGradient(0, HZ, 0, HZ + 48); gr.addColorStop(0, '#2f7b8c'); gr.addColorStop(1, '#0d2f4a'); g.fillStyle = gr; g.fillRect(0, HZ, W, 50);
for (let i = 0; i < 40; i++) { const x = rnd() * W, y = HZ + 2 + rnd() * 44, w = 20 + rnd() * 90; g.fillStyle = 'rgba(120,255,200,' + (0.04 + rnd() * 0.07) * (1 - (y - HZ) / 60) + ')'; g.fillRect(x, y, w, 1 + rnd() * 1.5); }
g.strokeStyle = 'rgba(10,30,50,0.5)'; g.lineWidth = 1; for (let i = 0; i < 12; i++) { let x = rnd() * W, y = HZ + 4 + rnd() * 40; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += 10 + rnd() * 25; y += (rnd() - 0.5) * 6; g.lineTo(x, y); } g.stroke(); }
// icebergs: translucent cyan faces and a lit edge
const berg = (x, y, w, h, seedv) => { g.save(); g.beginPath(); const p = [[0, 0], [w * 0.18, -h * 0.55], [w * 0.34, -h * 0.4], [w * 0.5, -h], [w * 0.68, -h * 0.55], [w * 0.82, -h * 0.7], [w, 0]]; p.forEach(([a, b]) => g.lineTo(x + a, y + b)); g.closePath(); const q = g.createLinearGradient(x, y - h, x + w, y); q.addColorStop(0, '#d8f6ff'); q.addColorStop(0.45, '#7fd0e6'); q.addColorStop(1, '#2f7fa8'); g.fillStyle = q; g.fill(); g.clip(); g.fillStyle = 'rgba(10,50,90,0.35)'; g.beginPath(); g.moveTo(x + w * 0.5, y - h); g.lineTo(x + w * 0.62, y - h * 0.4); g.lineTo(x + w * 0.5, y); g.lineTo(x + w, y); g.lineTo(x + w * 0.68, y - h * 0.55); g.closePath(); g.fill(); g.restore(); g.fillStyle = 'rgba(100,220,255,0.18)'; g.beginPath(); g.ellipse(x + w * 0.5, y + 3, w * 0.7, 4, 0, 0, 7); g.fill(); };
berg(18, HZ + 22, 78, 46, 1); berg(296, HZ + 28, 92, 52, 2); berg(214, HZ + 14, 40, 22, 3);
// snowfield
g.beginPath(); g.moveTo(0, HZ + 44); for (let x = 0; x <= W; x += 6) g.lineTo(x, HZ + 42 + Math.sin(x / 47) * 4 + Math.sin(x / 15) * 1.5); g.lineTo(W, H); g.lineTo(0, H); g.closePath();
gr = g.createLinearGradient(0, HZ + 40, 0, H); gr.addColorStop(0, '#9cc4de'); gr.addColorStop(0.3, '#6f9cc4'); gr.addColorStop(1, '#2f5280'); g.fillStyle = gr; g.fill();
g.save(); g.clip();
// green aurora light spilling over the snow, wind-sculpted ripples, sparkle
const sp = g.createRadialGradient(195, HZ + 40, 10, 195, HZ + 40, 260); sp.addColorStop(0, 'rgba(100,255,190,0.25)'); sp.addColorStop(1, 'rgba(100,255,190,0)'); g.fillStyle = sp; g.fillRect(0, HZ + 30, W, 150);
for (let i = 0; i < 26; i++) { const y = HZ + 52 + i * 5.6, a = 0.07 + 0.08 * (1 - i / 26); g.beginPath(); for (let x = 0; x <= W; x += 6) g.lineTo(x, y + Math.sin(x / (30 + i * 2) + i * 1.7) * (2 + i * 0.16)); g.strokeStyle = 'rgba(215,240,255,' + a + ')'; g.lineWidth = 1.2; g.stroke(); g.strokeStyle = 'rgba(8,24,50,' + a * 1.4 + ')'; g.beginPath(); for (let x = 0; x <= W; x += 6) g.lineTo(x, y + 2.4 + Math.sin(x / (30 + i * 2) + i * 1.7) * (2 + i * 0.16)); g.stroke(); }
for (let i = 0; i < 220; i++) { const x = rnd() * W, y = HZ + 50 + rnd() * 110, r = 0.5 + rnd() * 1.1; g.fillStyle = 'rgba(235,250,255,' + (0.3 + rnd() * 0.6) + ')'; g.fillRect(x, y, r, r); }
g.restore();
// film grain
{ const id = g.getImageData(0, 0, W, H), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 7; d[i] = clamp(d[i] + n, 0, 255); d[i + 1] = clamp(d[i + 1] + n, 0, 255); d[i + 2] = clamp(d[i + 2] + n, 0, 255); } g.putImageData(id, 0, 0); }
names.push(addProjectImage('scene.png', c, {}).name);
`;

// ---------- aurora curtains + twinkling stars (looping) ----------
const auroraJS = pre + `
const N = 12, AH = 300;
const TW = Array.from({ length: 26 }, () => ({ x: rnd() * W, y: 6 + rnd() * 200, r: 0.9 + rnd() * 1.1, p: rnd() * TAU }));
for (let k = 0; k < N; k++) {
  const ph = TAU * k / N, c = mk(W, AH), g = c.getContext('2d');
  const band = (cy, amp, hMax, col, a0, p0) => {
    g.save(); g.filter = 'blur(3px)';
    for (let x = -6; x <= W + 6; x += 3) {
      const t = x / W, yb = cy + amp * Math.sin(t * 5 + ph + p0) + amp * 0.45 * Math.sin(t * 11 - ph * 2 + p0 * 1.7);
      const rays = 0.55 + 0.45 * Math.sin(x * 0.21 + ph * 3 + p0 * 3) * Math.sin(x * 0.07 - ph + p0), h = hMax * (0.45 + 0.55 * Math.sin(t * 3.4 + p0 + ph * 0.5) * Math.sin(t * 3.4 + p0 + ph * 0.5)) * (0.65 + 0.35 * rays);
      const q = g.createLinearGradient(0, yb - h, 0, yb + 8); q.addColorStop(0, 'rgba(' + col[1] + ',0)'); q.addColorStop(0.55, 'rgba(' + col[1] + ',' + a0 * 0.45 * rays + ')'); q.addColorStop(0.92, 'rgba(' + col[0] + ',' + a0 * rays + ')'); q.addColorStop(1, 'rgba(' + col[0] + ',0)');
      g.fillStyle = q; g.fillRect(x, yb - h, 3.2, h + 8);
    }
    g.restore();
  };
  band(210, 22, 150, ['70,255,170', '60,200,255'], 0.95, 0.4);
  band(150, 18, 110, ['120,255,210', '150,110,255'], 0.7, 2.2);
  band(250, 12, 70, ['60,255,150', '40,170,255'], 0.55, 4.1);
  for (const s of TW) { const a = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(ph + s.p), 2); const q = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3); q.addColorStop(0, 'rgba(255,255,255,' + a + ')'); q.addColorStop(1, 'rgba(200,225,255,0)'); g.fillStyle = q; g.beginPath(); g.arc(s.x, s.y, s.r * 3, 0, 7); g.fill(); }
  names.push(addProjectImage('anim/aurora_' + k + '.png', c, {}).name);
}
`;

// ---------- falling snow (looping) ----------
const snowJS = pre + `
const N = 12, SH = 450;
const S = Array.from({ length: 80 }, () => ({ x: rnd() * W, off: rnd(), r: 0.8 + Math.pow(rnd(), 2) * 2.4, amp: 4 + rnd() * 10, p: rnd() * TAU, m: rnd() > 0.5 ? 2 : 1 }));
for (let k = 0; k < N; k++) {
  const c = mk(W, SH), g = c.getContext('2d');
  for (const s of S) {
    const f = (((k * s.m / N) + s.off) % 1 + 1) % 1, y = f * (SH + 20) - 10, x = s.x + s.amp * Math.sin(TAU * f * s.m + s.p), a = 0.45 + 0.5 * (s.r / 3.2);
    const q = g.createRadialGradient(x, y, 0, x, y, s.r * 1.7); q.addColorStop(0, 'rgba(255,255,255,' + a + ')'); q.addColorStop(0.5, 'rgba(235,248,255,' + a * 0.7 + ')'); q.addColorStop(1, 'rgba(220,240,255,0)'); g.fillStyle = q; g.beginPath(); g.arc(x, y, s.r * 1.7, 0, 7); g.fill();
  }
  names.push(addProjectImage('anim/snow_' + k + '.png', c, {}).name);
}
`;

// ---------- foreground bank (back-lane bears walk behind it) ----------
const bankJS = pre + `
const BH = 90, c = mk(W, BH), g = c.getContext('2d');
g.beginPath(); g.moveTo(0, BH); g.lineTo(0, 22); for (let x = 0; x <= W; x += 5) g.lineTo(x, 18 + Math.sin(x / 41 + 1) * 7 + Math.sin(x / 13) * 1.8 + Math.sin(x / 97) * 6); g.lineTo(W, BH); g.closePath();
let q = g.createLinearGradient(0, 8, 0, BH); q.addColorStop(0, '#a9cde6'); q.addColorStop(0.2, '#6f9cc4'); q.addColorStop(1, '#27456f'); g.fillStyle = q; g.fill();
g.save(); g.clip();
const gl = g.createRadialGradient(195, 0, 10, 195, 10, 240); gl.addColorStop(0, 'rgba(110,255,190,0.28)'); gl.addColorStop(1, 'rgba(110,255,190,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, 60);
for (let i = 0; i < 9; i++) { const y = 26 + i * 7; g.beginPath(); for (let x = 0; x <= W; x += 6) g.lineTo(x, y + Math.sin(x / (34 + i * 3) + i * 2) * 3); g.strokeStyle = 'rgba(220,242,255,' + (0.16 - i * 0.012) + ')'; g.lineWidth = 1.3; g.stroke(); }
for (let i = 0; i < 120; i++) { g.fillStyle = 'rgba(240,252,255,' + (0.3 + rnd() * 0.6) + ')'; g.fillRect(rnd() * W, 22 + rnd() * 60, 1 + rnd(), 1 + rnd()); }
g.restore();
// ice shards at the corners
const shard = (x, y, w, h, tilt) => { g.save(); g.translate(x, y); g.rotate(tilt); g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.2, -h); g.lineTo(w * 0.55, -h * 0.55); g.lineTo(w * 0.8, -h * 0.85); g.lineTo(w, 0); g.closePath(); const s = g.createLinearGradient(0, -h, w, 0); s.addColorStop(0, '#e6fbff'); s.addColorStop(0.5, '#86d4ea'); s.addColorStop(1, '#2c78a2'); g.fillStyle = s; g.globalAlpha = 0.93; g.fill(); g.globalAlpha = 1; g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1; g.stroke(); g.restore(); };
shard(-6, 62, 46, 38, -0.12); shard(26, 66, 30, 22, 0.1); shard(W - 44, 64, 50, 44, 0.1); shard(W - 70, 68, 30, 20, -0.12);
names.push(addProjectImage('bank.png', c, {}).name);
`;

// ---------- vignette ----------
const vigJS = pre + `
const c = mk(W, H), g = c.getContext('2d');
const q = g.createRadialGradient(W / 2, H * 0.42, H * 0.34, W / 2, H * 0.42, H * 0.8); q.addColorStop(0, 'rgba(2,8,20,0)'); q.addColorStop(1, 'rgba(2,8,20,0.5)'); g.fillStyle = q; g.fillRect(0, 0, W, H);
names.push(addProjectImage('vignette.png', c, {}).name);
`;

// ---------- sunrise icon ----------
const iconJS = pre + `
const c = mk(40, 32), g = c.getContext('2d');
g.translate(20, 24);
let q = g.createRadialGradient(0, -2, 1, 0, -2, 20); q.addColorStop(0, 'rgba(255,210,120,0.55)'); q.addColorStop(1, 'rgba(255,210,120,0)'); g.fillStyle = q; g.fillRect(-20, -22, 40, 24);
g.strokeStyle = '#ffd37a'; g.lineWidth = 2; g.lineCap = 'round'; for (let i = 0; i < 5; i++) { const a = Math.PI + (i + 0.5) * Math.PI / 5; g.beginPath(); g.moveTo(Math.cos(a) * 11, Math.sin(a) * 11); g.lineTo(Math.cos(a) * 16, Math.sin(a) * 16); g.stroke(); }
q = g.createRadialGradient(-2, -6, 1, 0, 0, 10); q.addColorStop(0, '#fff3c0'); q.addColorStop(1, '#ffb347'); g.fillStyle = q; g.beginPath(); g.arc(0, 0, 9, Math.PI, 0); g.fill();
g.strokeStyle = '#cfe8ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-18, 2); g.lineTo(18, 2); g.stroke();
names.push(addProjectImage('sun_icon.png', c, {}).name);
`;

// ---------- polar bears: mother and cub, walking / standing / sniffing, both directions ----------
const bearJS = pre + `
const SS = 2, KIND = { mom: { CW: 200, CH: 124, S: 1, head: 1.2 }, cub: { CW: 112, CH: 76, S: 0.58, head: 1.35 } };
function bear(kind, mode, k, dir) {
  const P = KIND[kind], big = mk(P.CW * SS, P.CH * SS), g = big.getContext('2d'), S = P.S;
  const phase = mode === 'walk' ? TAU * k / 8 : 0, amp = mode === 'walk' ? 0.5 : 0, drop = mode === 'sniff' ? (k ? 1 : 0.8) : 0;
  const LEG = 20, LOW = 18, GY = P.CH - 14;               // ground line in sprite
  g.scale(SS, SS);
  // contact shadow
  g.save(); g.filter = 'blur(2px)'; g.fillStyle = 'rgba(6,16,40,0.45)'; g.beginPath(); g.ellipse(P.CW * 0.46, GY + 2, 74 * S, 6 * S, 0, 0, 7); g.fill(); g.restore();
  const fur = mk(P.CW * SS, P.CH * SS), f = fur.getContext('2d'); f.scale(SS, SS);
  f.translate(P.CW * 0.46, GY - (8 + LEG + LOW) * S); if (dir < 0) { f.scale(-1, 1); } f.scale(S, S);
  const bob = 1.5 * Math.sin(phase * 2), light = f.createLinearGradient(0, -44, 0, 22); light.addColorStop(0, '#f6f2e4'); light.addColorStop(0.45, '#e5edf2'); light.addColorStop(1, '#a6b9cd');
  const dark = f.createLinearGradient(0, -44, 0, 22); dark.addColorStop(0, '#c9d2d6'); dark.addColorStop(1, '#7d92a8');
  const leg = (hx, a, col, lift) => {
    const a1 = amp * Math.sin(a), a2 = a1 * 0.3 - 0.45 * Math.max(0, Math.cos(a)) * (amp ? 1 : 0), hy = 8 + bob;
    const kx = hx + Math.sin(a1) * LEG, ky = hy + Math.cos(a1) * LEG, fx = kx + Math.sin(a2) * LOW, fy = ky + Math.cos(a2) * LOW;
    f.lineCap = 'round'; f.lineJoin = 'round'; f.strokeStyle = col; f.lineWidth = 21; f.beginPath(); f.moveTo(hx, hy); f.lineTo(kx, ky); f.stroke(); f.lineWidth = 17; f.beginPath(); f.moveTo(kx, ky); f.lineTo(fx, fy); f.stroke();
    f.fillStyle = col; f.beginPath(); f.ellipse(fx + 4, fy + 1, 12, 6.5, 0, 0, 7); f.fill(); f.fillStyle = '#2a2f38'; for (let i = 0; i < 3; i++) { f.beginPath(); f.arc(fx + 14 + i * 0.4, fy - 1 + i * 2.4, 1.2, 0, 7); f.fill(); }
  };
  // far legs, torso, near legs
  leg(26, phase + Math.PI, dark, 0); leg(-40, phase, dark, 0);
  const torso = () => { f.beginPath(); f.moveTo(-56, -14 + bob); f.bezierCurveTo(-58, -30 + bob, -36, -33 + bob, -16, -32 + bob); f.bezierCurveTo(0, -37 + bob, 18, -38 + bob, 30, -28 + bob); f.bezierCurveTo(40, -23 + bob, 46, -14 + bob, 47, -2 + bob); f.bezierCurveTo(47, 10 + bob, 38, 16 + bob, 24, 16 + bob); f.bezierCurveTo(0, 18 + bob, -30, 18 + bob, -46, 13 + bob); f.bezierCurveTo(-57, 11 + bob, -61, -2 + bob, -56, -14 + bob); f.closePath(); };
  f.save(); f.shadowColor = 'rgba(0,10,30,0.4)'; f.shadowBlur = 6; torso(); f.fillStyle = light; f.fill(); f.restore();
  // neck and head (pivot at the shoulder)
  const hy0 = -20 + bob, hr = 0.05 * Math.sin(phase + 1) + drop * 0.55;
  f.save(); f.translate(40, hy0); f.rotate(hr); f.scale(P.head, P.head);
  f.fillStyle = light; f.beginPath(); f.ellipse(2, 4, 20, 15, -0.2, 0, 7); f.fill();
  const hg = f.createLinearGradient(0, -16, 0, 16); hg.addColorStop(0, '#f6f2e4'); hg.addColorStop(1, '#c9d6e0');
  f.fillStyle = hg; f.beginPath(); f.ellipse(18, -2, 17, 14, 0, 0, 7); f.fill(); f.beginPath(); f.moveTo(26, -8); f.bezierCurveTo(42, -9, 56, -4, 57, 3); f.bezierCurveTo(56, 11, 42, 12, 28, 10); f.closePath(); f.fill();
  f.fillStyle = '#d4c2b8'; f.beginPath(); f.ellipse(5, -15, 6, 6, 0, 0, 7); f.fill(); f.fillStyle = '#f0e8e0'; f.beginPath(); f.arc(5, -14, 3.4, 0, 7); f.fill(); f.fillStyle = '#f6f2e4'; f.beginPath(); f.arc(6, -17, 4.5, 0, 7); f.fill();
  f.fillStyle = '#14161c'; f.beginPath(); f.ellipse(56, 1, 4.3, 3.4, 0.15, 0, 7); f.fill(); f.fillStyle = 'rgba(255,255,255,0.55)'; f.beginPath(); f.arc(54.6, -0.2, 1, 0, 7); f.fill();
  f.strokeStyle = 'rgba(40,40,50,0.65)'; f.lineWidth = 1; f.beginPath(); f.moveTo(55, 5); f.quadraticCurveTo(46, 10, 38, 8); f.stroke();
  f.fillStyle = '#12141a'; f.beginPath(); f.ellipse(30, -6, 2.3, 2.5, 0, 0, 7); f.fill(); f.fillStyle = 'rgba(255,255,255,0.8)'; f.beginPath(); f.arc(29.4, -7, 0.8, 0, 7); f.fill();
  f.restore();
  leg(30, phase, light, 0); leg(-36, phase + Math.PI, light, 0);
  // fur strokes over everything already drawn, tail tuft
  f.save(); f.globalCompositeOperation = 'source-atop'; seed = 11;
  for (let i = 0; i < 360; i++) { const x = -60 + rnd() * 120, y = -44 + rnd() * 70, a = 0.35 + rnd() * 0.6, l = 3 + rnd() * 7; f.strokeStyle = rnd() > 0.45 ? 'rgba(255,255,250,' + 0.18 * rnd() + ')' : 'rgba(110,135,165,' + 0.16 * rnd() + ')'; f.lineWidth = 0.8; f.beginPath(); f.moveTo(x, y); f.lineTo(x - Math.cos(a) * l, y + Math.sin(a) * l * 0.6); f.stroke(); }
  f.restore();
  // lighting: aurora rim from above, cool shade below
  f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'source-atop';
  const rl = f.createLinearGradient(0, 0, 0, P.CH * SS); rl.addColorStop(0, 'rgba(120,255,200,0.34)'); rl.addColorStop(0.4, 'rgba(120,255,200,0)'); rl.addColorStop(0.75, 'rgba(15,40,95,0.18)'); rl.addColorStop(1, 'rgba(15,40,95,0.38)'); f.fillStyle = rl; f.fillRect(0, 0, P.CW * SS, P.CH * SS);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(fur, 0, 0); g.restore();
  const out = mk(P.CW, P.CH), og = out.getContext('2d'); og.drawImage(big, 0, 0, P.CW, P.CH); return out;
}
const BEAR = {};
for (const kind of ['mom', 'cub']) for (const [d, dn] of [[1, 'r'], [-1, 'l']]) {
  const put = (key, cv) => { BEAR[key] = addProjectImage('bear/' + key + '.png', cv, {}).name; names.push(BEAR[key]); };
  for (let k = 0; k < 8; k++) put(kind + '_' + dn + '_w' + k, bear(kind, 'walk', k, d));
  put(kind + '_' + dn + '_st', bear(kind, 'stand', 0, d)); put(kind + '_' + dn + '_sn0', bear(kind, 'sniff', 0, d)); put(kind + '_' + dn + '_sn1', bear(kind, 'sniff', 1, d));
}
globalThis.__bear = BEAR;
`;
const slot = (nm, handle, key, x, y, alpha) => ({ script: `const e = await addElement('IMG', { src: globalThis.__bear['${key}'] }); e.name = '${nm}'; e.src = globalThis.__bear['${key}']; e.handle = '${handle}'; e.x = ${x}; e.y = ${y}; e.alpha = ${alpha}; e.show = 'normal'; return 1` });
const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const anim = (name, prefix, fps, y) => `const e = await addElement('IMG_ANIM', { frames: names, fps: ${fps}, animPrefix: '${prefix}', repeat: 0 }); e.name = '${name}'; e.frames = names; e.x = 0; e.y = ${y}; e.show = 'normal'; return names.length`;
const img = (name, x, y, show) => `const e = await addElement('IMG', { src: names[0] }); e.name = '${name}'; e.src = names[0]; e.x = ${x}; e.y = ${y}; e.show = '${show || 'normal'}'; return 1`;
const F = 'Inter';
const tag = (suffix) => ({ script: `const n = project.elements.length; for (const i of [n-3,n-2,n-1]) project.elements[i].name += ' ${suffix}'; return 1` });
const group = (gid, label, layers) => ({ script: `project.groups = project.groups || {}; project.groups.${gid} = '${label}'; let n = 0; for (const nm of ${JSON.stringify(layers)}) { const e = project.elements.find((x) => x.name === nm); if (e) { e.group = '${gid}'; n++; } } return '${label}: ' + n + ' layers'` });

const userCode = `{
  // Bears are plain IMG layers moved with MORE {x, y, src}. A mother and a cub spawn at random, together or alone (never more than two),
  // and cross the snow either behind the snow bank (back lane) or in front of it (front lane). Now and then they stop to sniff.
  const MS = 100, SW = 390, FOOT = 14
  const DIM = { mom: { w: 200, h: 124 }, cub: { w: 112, h: 76 } }
  const LANES = [{ base: 384, m: 'm0', c: 'c0' }, { base: 436, m: 'm1', c: 'c1' }]
  const SLOTS = ['m0', 'c0', 'm1', 'c1']
  let id = null, tickN = 0, grp = null, nextSpawn = 8
  const rand = (a, b) => a + Math.random() * (b - a)
  const park = (s) => { try { W[s].setProperty(ui.prop.MORE, { x: pxv(-400), y: pxv(0) }) } catch (e) {} }
  const spawn = (onScreen) => {
    const lane = LANES[Math.random() < 0.5 ? 0 : 1], dir = Math.random() < 0.5 ? 1 : -1, r = Math.random()
    const kind = r < 0.6 ? 'pair' : r < 0.8 ? 'mom' : 'cub'
    grp = { lane, dir, kind, cx: onScreen ? rand(120, 270) : (dir > 0 ? -110 : SW + 110), speed: rand(1.4, 2.2), age: 0, pause: 0, paused: false, pausedOnce: false, gone: { m: kind === 'cub', c: kind === 'mom' } }
  }
  const place = (slot, kind, cx, y, key) => {
    const d = DIM[kind]
    W[slot].setProperty(ui.prop.MORE, { x: pxv(Math.round(cx - d.w * 0.46)), y: pxv(Math.round(y - (d.h - FOOT))), src: A('bear/' + key + '.png') })
  }
  const tick = () => {
    tickN++
    if (!grp) { if (tickN >= nextSpawn) spawn(false); return }
    const g = grp, L = g.lane, dn = g.dir > 0 ? 'r' : 'l'
    if (g.paused) { g.pause--; if (g.pause <= 0) g.paused = false }
    else {
      g.age++
      g.cx += g.dir * g.speed
      if (!g.pausedOnce && g.cx > 90 && g.cx < SW - 90 && Math.random() < 0.006) { g.paused = true; g.pausedOnce = true; g.pause = Math.floor(rand(30, 50)) }
    }
    const wob = Math.sin(g.age * 0.05)
    if (!g.gone.m) {
      const out = g.dir > 0 ? g.cx > SW + 120 : g.cx < -120
      if (out) { g.gone.m = true; park(L.m) }
      else {
        const key = g.paused ? 'mom_' + dn + '_sn' + (Math.floor(g.pause / 8) % 2) : 'mom_' + dn + '_w' + (Math.floor(g.age / 2) % 8)
        place(L.m, 'mom', g.cx, L.base, key)
      }
    }
    if (!g.gone.c) {
      const ccx = g.kind === 'pair' ? g.cx - g.dir * (120 + 6 * wob) : g.cx
      const out = g.dir > 0 ? ccx > SW + 80 : ccx < -80
      if (out) { g.gone.c = true; park(L.c) }
      else {
        const key = g.paused ? 'cub_' + dn + '_st' : 'cub_' + dn + '_w' + ((Math.floor(g.age / 1.5) + 3) % 8)
        place(L.c, 'cub', ccx, L.base + (g.paused ? 0 : 1.5 * Math.sin(g.age * 0.6)) + (g.kind === 'pair' ? 4 : 0), key)
      }
    }
    if (g.gone.m && g.gone.c) { grp = null; nextSpawn = tickN + Math.floor(rand(10, 90)) }
  }
  const safe = () => { try { tick() } catch (e) {} }
  const start = () => { if (id === null) { try { id = setInterval(safe, MS) } catch (e) {} } }
  const stop = () => { if (id !== null) { try { clearInterval(id) } catch (e) {} id = null } }
  SLOTS.forEach(park)
  spawn(true)
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: start, pause_call: stop })
  safe()
  start()
}`;

const steps = [{ preset: 'bg' },
  wrap(sceneJS, img('Scene', 0, 0)),
  wrap(auroraJS, anim('Aurora', 'aurora', 5, 0)),
  wrap(bearJS, 'return names.length'),
  slot('Bear back', 'm0', 'mom_r_w0', 130, 250, 235), slot('Cub back', 'c0', 'cub_r_w0', -400, 0, 235),
  wrap(bankJS, img('Snow bank', 0, 366)),
  { preset: 'clock' }, tag('Main'), { preset: 'clock' }, tag('Aod'), { preset: 'weekday' }, { preset: 'day' }, { preset: 'temp' },
  { preset: 'sun' },
  slot('Bear front', 'm1', 'mom_l_w0', 150, 322, 255), slot('Cub front', 'c1', 'cub_l_w0', 40, 360, 255),
  wrap(snowJS, anim('Snowfall', 'snow', 8, 0)),
  wrap(vigJS, img('Vignette', 0, 0)),
  { remove: 'Colon Aod' },
];
const face = (size, extra) => ({ font: F, size, weight: 500, fill: 'gradient', from: '#ffffff', to: '#d4ecf6', angle: 90, borderColor: '#07162c', borderWidth: 2, shadowColor: '#020a18', shadowX: 0, shadowY: 2, shadowBlur: 8, ...extra });
const dim = { font: F, size: 110, weight: 500, fill: 'solid', color: '#3b7a8c' };
steps.push(
  { edit: 'Hour Main', set: { x: 50, y: 66, show: 'normal', zero: 1 }, glyph: face(96) },
  { edit: 'Colon Main', set: { x: 178, y: 70, show: 'normal' }, glyph: face(96) },
  { edit: 'Minute Main', set: { x: 214, y: 66, show: 'normal', zero: 1 }, glyph: face(96) },
  { edit: 'Hour Aod', set: { x: 60, y: 90, show: 'aod', zero: 1 }, glyph: dim },
  { edit: 'Minute Aod', set: { x: 60, y: 230, show: 'aod', zero: 1 }, glyph: dim },
  { edit: 'Weekday', set: { x: 131, y: 28, show: 'normal' }, glyph: face(30, { weight: 700 }) },
  { edit: 'Day', set: { x: 213, y: 34, show: 'normal' }, glyph: face(30, { weight: 700 }) },
  { edit: 'Temperature', set: { x: 38, y: 192, show: 'normal' }, glyph: face(30, { weight: 700 }) },
  { edit: 'Sun time', set: { x: 238, y: 192, show: 'normal' }, glyph: face(30, { weight: 700 }) },
  { script: `for (const k of Object.keys(project.groups)) if (project.groups[k] === 'Clock 2') project.groups[k] = 'Clock AOD'; return JSON.stringify(project.groups)` },
  { edit: 'Sun icon', set: { x: 188, y: 194, show: 'normal' } },
  group('gDate', 'Date', ['Weekday', 'Day']),
  group('gBack', 'Bears behind the bank', ['Bear back', 'Cub back']),
  group('gFront', 'Bears in front', ['Bear front', 'Cub front']),
  { script: `const used = new Set(project.elements.map((e) => e.group).filter(Boolean)); for (const k of Object.keys(project.groups)) if (!used.has(k)) delete project.groups[k]; return JSON.stringify(project.groups)` },
);
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: 'Arctic Night', device: 'bip-6', font: F, optimizePng: 64,
  description: 'A polar night under the aurora: snowfall, icebergs and a frozen sea. A polar bear and her cub spawn at random, walk across the snow together or alone, and now and then stop to sniff.',
  preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/arctic-night', userCode, steps }, null, 1));
