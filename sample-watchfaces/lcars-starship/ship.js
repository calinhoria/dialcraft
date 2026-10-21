// ---- a small software 3D renderer: parametric meshes, z-buffer, per-pixel lighting, procedural hull plating and windows, bloom ----
const TAU = Math.PI * 2;
const SW = 294, SH = 104, SS = 2, RW = SW * SS, RH = SH * SS;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ---------- meshes ----------
const meshes = [];
const grid = (nu, nv, f, kind, opt = {}) => {
  const P = [], UV = [], T = [], id = (i, j) => j * (nu + 1) + i;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { P.push(f(i / nu, j / nv)); UV.push([i / nu, j / nv]); }
  const N = P.map(() => [0, 0, 0]);
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
    T.push([a, b, c], [a, c, d]);
    const n = cross(sub(P[b], P[a]), sub(P[d], P[a]));
    for (const q of [a, b, c, d]) { N[q][0] += n[0]; N[q][1] += n[1]; N[q][2] += n[2]; }
  }
  let flip = !!opt.flip;
  if (opt.ctr) { let s = 0; for (let k = 0; k < P.length; k++) s += dot(N[k], sub(P[k], opt.ctr)); flip = s < 0; }
  for (let k = 0; k < N.length; k++) { N[k] = nrm(N[k]); if (flip) N[k] = [-N[k][0], -N[k][1], -N[k][2]]; }
  meshes.push({ P, N, T, UV, kind });
};
// a tube along A -> B with an elliptical (super-elliptical) section; prof(v) rounds the ends
const tube = (A, B, ay, az, prof, kind, e = 2, nu = 36, nv = 30) => {
  const d = sub(B, A); let s = nrm(cross(d, [0, 1, 0])); const t = nrm(cross(s, d));
  const sp = (x) => Math.sign(x) * Math.pow(Math.abs(x), 2 / e);
  const ctr = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
  grid(nu, nv, (u, v) => {
    const a = u * TAU, p = prof(v), c = sp(Math.cos(a)) * az * p, y = sp(Math.sin(a)) * ay * p;
    return [A[0] + d[0] * v + s[0] * c + t[0] * y, A[1] + d[1] * v + s[1] * c + t[1] * y, A[2] + d[2] * v + s[2] * c + t[2] * y];
  }, kind, { ctr });
};
const CX = 0.42;
const sTop = (r) => 0.118 * Math.pow(Math.max(0, 1 - r * r), 0.55) + 0.016;
const sBot = (r) => 0.07 * Math.pow(Math.max(0, 1 - r * r), 0.6) + 0.016;
grid(120, 34, (u, v) => { const a = u * TAU; return [CX + v * Math.cos(a), sTop(v), v * Math.sin(a)]; }, 'saucerTop');
grid(120, 34, (u, v) => { const a = u * TAU; return [CX + v * Math.cos(a), -sBot(v), v * Math.sin(a)]; }, 'saucerBot', { flip: true });
grid(120, 4, (u, v) => { const a = u * TAU; return [CX + Math.cos(a), sTop(1) + (-sBot(1) - sTop(1)) * v, Math.sin(a)]; }, 'rim');
grid(48, 14, (u, v) => { const a = u * TAU, ph = v * Math.PI / 2; return [CX - 0.02 + Math.cos(ph) * Math.cos(a) * 0.12, sTop(0.1) - 0.01 + Math.sin(ph) * 0.052, Math.cos(ph) * Math.sin(a) * 0.12]; }, 'dome', { flip: true });
const capsule = (v) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * v - 1), 5)), 0.5);
tube([-1.08, -0.23, 0], [0.04, -0.18, 0], 0.135, 0.17, (v) => Math.pow(Math.sin(Math.PI * Math.min(1, v * 0.96 + 0.02)), 0.42) * (0.6 + 0.4 * v), 'hull', 2.6, 40, 40);
tube([-0.2, -0.22, 0], [0.02, -0.02, 0], 0.05, 0.1, () => 1, 'pylon', 2, 20, 6);
for (const z of [-1, 1]) {
  tube([-0.74, -0.14, 0.11 * z], [-0.86, 0.2, 0.62 * z], 0.075, 0.016, () => 1, 'pylon', 2, 16, 8);
  tube([-1.5, 0.24, 0.66 * z], [-0.4, 0.24, 0.66 * z], 0.076, 0.076, capsule, 'nacelle', 2, 40, 48);
}
grid(24, 10, (u, v) => { const a = u * TAU, ph = v * Math.PI / 2; return [0.02 + Math.sin(ph) * 0.03, -0.2 + Math.cos(ph) * Math.cos(a) * 0.05, Math.cos(ph) * Math.sin(a) * 0.05]; }, 'deflector', { flip: false });

// ---------- shading ----------
const lines = (x, step, w) => { const f = Math.abs(((x / step) % 1 + 1) % 1 - 0.5) * step; return f > step / 2 - w; };
const shadeKind = (kind, u, v, pulse, lit) => {
  let alb = [0.62, 0.64, 0.7], em = null, glossy = 0.5;
  if (kind === 'saucerTop' || kind === 'saucerBot') {
    const n = hash(Math.floor(u * 96), Math.floor(v * 30)); alb = alb.map((c) => c * (0.93 + 0.1 * n));
    if (lines(v, 0.17, 0.0035) || lines(u * TAU, TAU / 24, 0.004)) alb = alb.map((c) => c * 0.6);
    const rows = kind === 'saucerTop' ? [0.83, 0.76, 0.69] : [0.86, 0.79, 0.72];
    for (const r of rows) if (Math.abs(v - r) < 0.011) {
      const cell = Math.floor(u * 170), f = (u * 170) % 1;
      if (f > 0.2 && f < 0.8) { if (hash(cell, r * 100) > 0.32) em = [255, 226, 150]; else alb = [0.1, 0.12, 0.16]; }
    }
    if (kind === 'saucerBot') {
      if (Math.abs(v - 0.2) < 0.016) em = [90, 170, 255];
      if (v < 0.16) alb = alb.map((c) => c * 0.72);
      if (Math.abs(v - 0.44) < 0.006 && hash(Math.floor(u * 40), 3) > 0.5) em = [255, 150, 60];
    }
  } else if (kind === 'rim') { alb = [0.5, 0.52, 0.58]; if (hash(Math.floor(u * 60), 9) > 0.8) em = [255, 120, 80]; }
  else if (kind === 'dome') { alb = [0.82, 0.84, 0.9]; if (lines(u * TAU, TAU / 12, 0.01)) alb = alb.map((c) => c * 0.65); }
  else if (kind === 'hull') {
    alb = [0.6, 0.63, 0.7].map((c) => c * (0.94 + 0.08 * hash(Math.floor(u * 40), Math.floor(v * 80))));
    if (lines(v, 0.07, 0.004)) alb = alb.map((c) => c * 0.65);
    for (const ur of [0.2, 0.27, 0.73, 0.8]) if (Math.abs(u - ur) < 0.013) { const f = (v * 90) % 1; if (f > 0.2 && f < 0.8) { if (hash(Math.floor(v * 90), ur * 50) > 0.3) em = [255, 222, 150]; else alb = [0.1, 0.12, 0.16]; } }
    if (v > 0.93) { em = [60 + 40 * pulse, 140, 230]; }
  } else if (kind === 'nacelle') {
    alb = [0.55, 0.58, 0.65];
    if (v > 0.94) { em = [255, 50 + 40 * pulse, 30]; alb = [0.4, 0.1, 0.1]; }
    else if (v > 0.1 && v < 0.9 && ((u > 0.18 && u < 0.32) || (u > 0.68 && u < 0.82))) { const g = 0.7 + 0.3 * Math.sin(v * 120 + pulse * 4); em = [60 * g, 150 * g, 255 * g]; alb = [0.1, 0.2, 0.4]; }
    else if (lines(v, 0.09, 0.004)) alb = alb.map((c) => c * 0.65);
    if (v < 0.07) { em = [60, 120 + 80 * pulse, 255]; }
  } else if (kind === 'pylon') { alb = [0.48, 0.5, 0.57]; }
  else if (kind === 'deflector') { em = [70 + 50 * pulse, 150, 235]; alb = [0.2, 0.3, 0.5]; }
  return { alb, em, glossy };
};

// ---------- rasteriser ----------
const render = (frame, N) => {
  const CAM = globalThis.__cam || { yaw: -0.38, pitch: -0.3 };
  const t = frame / N, yaw = CAM.yaw + 0.05 * Math.sin(TAU * t), pitch = CAM.pitch + 0.03 * Math.sin(TAU * t + 1.2), roll = 0.035 * Math.sin(TAU * t + 0.5);
  const bob = 0.02 * Math.sin(TAU * t * 2), pulse = 0.65 + 0.35 * Math.sin(TAU * t * 2 + 0.5);
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  const rot = (p) => { let x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy, y = p[1]; const y2 = y * cp - z * sp, z2 = y * sp + z * cp; const x3 = x * cr - y2 * sr, y3 = x * sr + y2 * cr; return [x3, y3, z2]; };
  const D = 5.2, F = 930, ox = RW * 0.5, oy = RH * 0.5 + 6;
  const img = new Uint8ClampedArray(RW * RH * 4), emi = new Uint8ClampedArray(RW * RH * 4), zb = new Float32Array(RW * RH).fill(1e9);
  const L1 = nrm([-0.55, -0.12, 0.83]), L2 = nrm([0.45, 0.8, -0.1]), H1 = nrm([L1[0], L1[1], L1[2] + 1]);
  for (const m of meshes) {
    const R = m.P.map((p) => { const q = rot([p[0] - 0.0, p[1] + 0.0, p[2]]); q[1] += bob; return q; });
    const RN = m.N.map((n) => rot(n));
    const S = R.map((q) => { const d = D - q[2]; return [ox + F * q[0] / d, oy - F * q[1] / d, d]; });
    for (const [ia, ib, ic] of m.T) {
      const a = S[ia], b = S[ib], c = S[ic];
      const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), maxX = Math.min(RW - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
      const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), maxY = Math.min(RH - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(area) < 1e-6) continue;
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area, w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area, w2 = 1 - w0 - w1;
        if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
        const d = w0 * a[2] + w1 * b[2] + w2 * c[2], zi = y * RW + x;
        if (d >= zb[zi]) continue;
        zb[zi] = d;
        const n = nrm([w0 * RN[ia][0] + w1 * RN[ib][0] + w2 * RN[ic][0], w0 * RN[ia][1] + w1 * RN[ib][1] + w2 * RN[ic][1], w0 * RN[ia][2] + w1 * RN[ib][2] + w2 * RN[ic][2]]);
        const u = w0 * m.UV[ia][0] + w1 * m.UV[ib][0] + w2 * m.UV[ic][0], v = w0 * m.UV[ia][1] + w1 * m.UV[ib][1] + w2 * m.UV[ic][1];
        const s = shadeKind(m.kind, u, v, pulse);
        const d1 = Math.max(0, dot(n, L1)), d2 = Math.max(0, dot(n, L2)), spec = Math.pow(Math.max(0, dot(n, H1)), 46) * 0.55;
        const k = zi * 4;
        for (let ch = 0; ch < 3; ch++) {
          const amb = 0.15 * [0.75, 0.85, 1][ch], key = d1 * [1, 0.96, 0.9][ch] * 0.95, rim = d2 * [0.5, 0.66, 1][ch] * 0.4;
          let val = s.alb[ch] * (amb + key + rim) + spec * (s.em ? 0 : 1);
          val = val * 255;
          if (s.em) val = Math.max(val * 0.3, s.em[ch]);
          img[k + ch] = val; emi[k + ch] = s.em ? s.em[ch] : 0;
        }
        img[k + 3] = 255; emi[k + 3] = s.em ? 255 : 0;
      }
    }
  }
  return { img, emi };
};

// ---------- warp star field behind the ship, then the ship and its glow ----------
const frameCanvas = (frame, N, rnd) => {
  const c = document.createElement('canvas'); c.width = RW; c.height = RH; const g = c.getContext('2d');
  g.fillStyle = '#01020a'; g.fillRect(0, 0, RW, RH);
  const FX = RW * 1.0, FY = RH * 0.47, R = RW * 1.25;
  const rr = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (let i = 0; i < 80; i++) {
    const a = Math.PI * (0.5 + rr() * 1.0), r0 = rr() * R, sp = 1 + Math.floor(rr() * 2), tone = rr();
    const r = (r0 + (frame / N) * R * sp) % R + 8, len = Math.max(3, r * 0.13 * sp);
    const x1 = FX + Math.cos(a) * r, y1 = FY + Math.sin(a) * r * 0.5, x0 = FX + Math.cos(a) * (r - len), y0 = FY + Math.sin(a) * (r - len) * 0.5;
    const al = Math.min(1, r / (RW * 0.5)) * (0.45 + 0.55 * rr());
    const grad = g.createLinearGradient(x0, y0, x1, y1); const col = tone > 0.75 ? '255,215,170' : tone > 0.4 ? '200,220,255' : '170,190,255';
    grad.addColorStop(0, 'rgba(' + col + ',0)'); grad.addColorStop(1, 'rgba(' + col + ',' + al + ')');
    g.strokeStyle = grad; g.lineWidth = r > RW * 0.6 ? 2.4 : 1.4; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  const { img, emi } = render(frame, N);
  const ship = document.createElement('canvas'); ship.width = RW; ship.height = RH; ship.getContext('2d').putImageData(new ImageData(img, RW, RH), 0, 0);
  const glow = document.createElement('canvas'); glow.width = RW; glow.height = RH; glow.getContext('2d').putImageData(new ImageData(emi, RW, RH), 0, 0);
  // soft blue glow behind the hull, then the ship, then the bloom of the lights
  g.drawImage(ship, 0, 0);
  g.globalCompositeOperation = 'lighter';
  g.filter = 'blur(10px)'; g.globalAlpha = 0.85; g.drawImage(glow, 0, 0);
  g.filter = 'blur(3px)'; g.globalAlpha = 0.6; g.drawImage(glow, 0, 0);
  g.filter = 'none'; g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  const out = document.createElement('canvas'); out.width = SW; out.height = SH; const o = out.getContext('2d'); o.imageSmoothingQuality = 'high'; o.drawImage(c, 0, 0, SW, SH);
  return out;
};
