// ---- Orbit: the Earth's limb from a space station. The sunlit side follows the real time of day, a satellite and a shooting star cross ----
FONT = 'Rajdhani';
const R = 190, ECX = 195, ECY = 410, OY = 220, OH = H - OY;   // the visible cap of the disc, y 220..450

// ---------- noise on the sphere ----------
const h3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const sm = (t) => t * t * (3 - 2 * t), lp = (a, b, t) => a + (b - a) * t;
const vn = (x, y, z) => { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
  return lp(lp(lp(h3(xi, yi, zi), h3(xi + 1, yi, zi), xf), lp(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), xf), yf), lp(lp(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), xf), lp(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), xf), yf), zf); };
const fbm = (x, y, z, o) => { let a = 0, amp = 0.5, f = 1; for (let i = 0; i < o; i++) { a += amp * vn(x * f, y * f, z * f); f *= 2; amp *= 0.5; } return a; };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---------- the Earth, once: day-lit colours, plus a map of land and city lights for the night overlay ----------
const LAND = new Uint8Array(W * OH), LIGHT = new Uint8Array(W * OH), COV = new Float32Array(W * OH), NX = new Float32Array(W * OH), NZ = new Float32Array(W * OH);
const earth = mkc(W, OH), eg = earth.getContext('2d'), id = eg.createImageData(W, OH), d = id.data;
for (let y = 0; y < OH; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x, nx = (x + 0.5 - ECX) / R, ny = (ECY - (y + OY + 0.5)) / R, r2 = nx * nx + ny * ny, r = Math.sqrt(r2);
  const cov = Math.max(0, Math.min(1, (1 - r) * R + 0.5)); COV[i] = cov; if (cov <= 0) continue;
  const nz = Math.sqrt(Math.max(0, 1 - r2)); NX[i] = nx; NZ[i] = nz;
  const px = nx * 2.3 + 4.1, py = ny * 2.3 + 1.7, pz = nz * 2.3 + 8.3;
  const e = fbm(px, py, pz, 5), mo = fbm(px * 1.7 + 9, py * 1.7, pz * 1.7, 3);
  let col;
  if (e > 0.54) { LAND[i] = 1; const t = Math.max(0, Math.min(1, (mo - 0.35) / 0.35)); col = mixc(mixc([48, 118, 62], [92, 140, 70], t), mixc([168, 140, 86], [205, 180, 120], t), Math.max(0, Math.min(1, (e - 0.62) * 6))); if (vn(px * 7, py * 7, pz * 7) > 0.6 && h3(x, y, 3) > 0.55) LIGHT[i] = 1; }
  else { const t = Math.max(0, Math.min(1, (0.54 - e) / 0.16)); col = mixc([44, 142, 196], [8, 40, 112], Math.pow(t, 0.7)); }
  const c = fbm(px * 0.8 + 31, py * 0.8, pz * 0.8, 4); if (c > 0.56) col = mixc(col, [255, 255, 255], Math.min(0.88, (c - 0.56) * 4.2));
  const limb = Math.max(0, 1 - nz / 0.34); col = mixc(col, [120, 190, 255], limb * 0.55);   // the atmosphere thickening at the edge
  const sh = 0.62 + 0.38 * Math.pow(nz, 0.5);
  d[i * 4] = col[0] * sh; d[i * 4 + 1] = col[1] * sh; d[i * 4 + 2] = col[2] * sh; d[i * 4 + 3] = 255 * cov;
}
eg.putImageData(id, 0, 0);

// ---------- scene: space, stars, a faint galaxy band, the atmosphere glow, the Earth ----------
const c = mkc(W, H), g = c.getContext('2d');
g.fillStyle = grad(g, 0, 0, 0, H, [[0, '#02030a'], [0.6, '#050a1c'], [1, '#04101f']]); g.fillRect(0, 0, W, H);
g.save(); g.filter = 'blur(16px)'; g.translate(150, 90); g.rotate(-0.5); g.fillStyle = 'rgba(120,130,220,0.13)'; g.fillRect(-260, -26, 520, 52); g.fillStyle = 'rgba(210,150,200,0.07)'; g.fillRect(-260, -8, 520, 16); g.restore();
for (let i = 0; i < 230; i++) { const x = srand(i * 1.9) * W, y = srand(i * 4.3) * (OY + 40), a = 0.18 + srand(i * 7.7) * 0.6, s = srand(i * 2.7) > 0.93 ? 1.6 : 1; g.fillStyle = (srand(i * 9.3) > 0.8 ? 'rgba(255,225,190,' : 'rgba(200,220,255,') + a + ')'; g.fillRect(x, y, s, s); }
g.fillStyle = rgrad(g, ECX, ECY, R - 4, R + 26, [[0, 'rgba(90,170,255,0.55)'], [0.35, 'rgba(60,130,255,0.22)'], [1, 'rgba(40,90,255,0)']]); g.fillRect(0, OY - 40, W, H);
g.drawImage(earth, 0, OY);
await scene(c, 'scene_orbit');

// ---------- the night side: one picture per hour (the Earth turns 15 degrees an hour) ----------
const nightPic = (hour) => {
  const cv = mkc(W, OH), cg = cv.getContext('2d'), im = cg.createImageData(W, OH), o = im.data, A = (12 - hour) * Math.PI / 12, sa = Math.sin(A), ca = Math.cos(A);
  for (let i = 0; i < W * OH; i++) {
    const cov = COV[i]; if (cov <= 0) continue;
    const ill = NX[i] * sa + NZ[i] * ca, t = Math.max(0, Math.min(1, (0.1 - ill) / 0.25)), tt = sm(t), tw = Math.exp(-Math.pow(ill / 0.09, 2));
    let col = mixc([3, 8, 28], [255, 110, 50], Math.min(1, tw * 1.2) * (1 - tt * 0.85)), al = Math.max(0.86 * tt, 0.24 * tw * (1 - tt * 0.5));
    if (LIGHT[i] && tt > 0.7) { col = [255, 212, 120]; al = 0.95; }
    o[i * 4] = col[0]; o[i * 4 + 1] = col[1]; o[i * 4 + 2] = col[2]; o[i * 4 + 3] = 255 * al * cov;
  }
  cg.putImageData(im, 0, 0); return cv;
};
const nv = []; for (let h = 0; h < 24; h++) { const cv = nightPic(h); nv.push(['h' + h, (gg) => gg.drawImage(cv, 0, 0)]); }
await mkSlot('night', 'Night side', nv, W, OH, 0, OY);

// ---------- twinkling stars (a transparent sprite, three phases) ----------
const twk = (k) => (gg) => { for (let i = 0; i < 16; i++) { const x = srand(i * 5.1 + 3) * W, y = srand(i * 8.3 + 1) * (OY - 12), ph = (i + k) % 3, r = ph === 0 ? 2.4 : ph === 1 ? 1.5 : 0.9, a = ph === 0 ? 1 : ph === 1 ? 0.7 : 0.35;
  gg.fillStyle = 'rgba(235,245,255,' + a + ')'; gg.fillRect(x - 0.5, y - 0.5, 1.4, 1.4); if (ph === 0) { line(gg, x - r - 1.5, y + 0.2, x + r + 1.5, y + 0.2, 'rgba(235,245,255,0.8)', 0.9); line(gg, x + 0.2, y - r - 1.5, x + 0.2, y + r + 1.5, 'rgba(235,245,255,0.8)', 0.9); } } };
await mkSlot('tw', 'Stars twinkle', [['a', twk(0)], ['b', twk(1)], ['c', twk(2)]], W, OY, 0, 0);

// ---------- satellite and shooting star ----------
const sat = (blink) => (gg) => {
  const px = (x, y, w, h, col) => { gg.fillStyle = col; gg.fillRect(x, y, w, h); };
  for (const sx of [1, 30]) { px(sx, 6, 15, 12, '#1d4f9a'); gg.strokeStyle = 'rgba(190,225,255,0.7)'; gg.lineWidth = 0.7; for (let k = 1; k < 4; k++) { gg.beginPath(); gg.moveTo(sx + k * 3.75, 6); gg.lineTo(sx + k * 3.75, 18); gg.stroke(); } gg.beginPath(); gg.moveTo(sx, 12); gg.lineTo(sx + 15, 12); gg.stroke(); gg.strokeRect(sx + 0.4, 6.4, 14.2, 11.2); }
  px(16, 10, 14, 5, '#cfd6de'); px(16, 10, 14, 1.4, '#ffffff'); px(21, 3, 4, 7, '#aeb6bf'); px(21, 15, 4, 6, '#aeb6bf'); px(20, 21, 6, 2, '#7d8791');
  if (blink) { circ(gg, 23, 3, 2.4, 'rgba(255,60,60,0.35)'); circ(gg, 23, 3, 1.3, '#ff4040'); }
};
await mkSlot('sat', 'Satellite', [['a', sat(1)], ['b', sat(0)]], 46, 26, 0, 176);
await mkSlot('shoot', 'Shooting star', [['s', (gg) => { gg.lineCap = 'round'; const q = gg.createLinearGradient(52, 2, 4, 30); q.addColorStop(0, 'rgba(255,255,255,0)'); q.addColorStop(1, 'rgba(255,255,255,0.95)'); gg.strokeStyle = q; gg.lineWidth = 2; gg.beginPath(); gg.moveTo(52, 2); gg.lineTo(5, 29); gg.stroke(); circ(gg, 4.5, 29.5, 2.2, '#ffffff'); }]], 58, 34, 330, 22);

// ---------- readings on glass pills over the night side ----------
const pl = mkc(W, H), pg = pl.getContext('2d');
const glass = (x, y, w, h) => { rr(pg, x, y, w, h, h / 2); pg.fillStyle = 'rgba(4,14,36,0.62)'; pg.fill(); pg.strokeStyle = 'rgba(130,200,255,0.5)'; pg.lineWidth = 1.2; pg.stroke(); };
glass(92, 344, 206, 46); glass(60, 398, 270, 46);
await addImg('orbit_pills', pl, 0, 0, 'Reading pills');

// ---------- native layers ----------
park(['Hour', 'Colon', 'Minute', 'Weekday', 'Day', 'Steps', 'Heart rate', 'Battery']);
await seqRow(['Hour', 'Colon', 'Minute'], CX, 112, 6);
const wd = E('Weekday'); wd.labelAlign = 'right'; rerenderGlyphLayers(); await loadAllImages();
await dateRow(CX, 46, 10);
await chipAt('Steps', 'steps', CX, 367, 30, '#9fd8ff');
await chipAt('Heart rate', 'heart', CX, 421, 30, '#ff6b7a');
await batChipAt('Battery', CX, 421, 40, 24, ['#5fe08a', '#ffc247', '#ff5757'], '#cfe8ff');
await chipRow([['Heart rate', 'Heart rate icon'], ['Battery', 'Battery level']], CX, 34);

// layer order is set in orbit.tail.js (the Orbit group goes right above the scene)

globalThis.__A = { font: 'Orbitron', size: 100, color: '#6fa3c8', row: [CX, 225, 6], col: true };
globalThis.__G = { Date: ['Weekday', 'Day'], Steps: ['Steps icon', 'Steps'], 'Heart rate': ['Heart rate icon', 'Heart rate'], Battery: ['Battery level', 'Battery'], Orbit: ['Night side', 'Stars twinkle', 'Shooting star', 'Satellite', 'Reading pills'] };
