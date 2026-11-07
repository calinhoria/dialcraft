// ---- Worn Denim: a pair of well-washed jeans. Faded twill, a waistband with a leather label, a back pocket with silver rivets and tan topstitching,
//      the time embroidered in thread. A still face (no code). ----
FONT = 'Alfa Slab One';

// ---------- noise ----------
const h3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const sm = (t) => t * t * (3 - 2 * t), lp = (a, b, t) => a + (b - a) * t;
const vn = (x, y, z) => { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
  return lp(lp(lp(h3(xi, yi, zi), h3(xi + 1, yi, zi), xf), lp(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), xf), yf), lp(lp(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), xf), lp(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), xf), yf), zf); };
const fbm = (x, y, z, o) => { let a = 0, amp = 0.5, f = 1; for (let i = 0; i < o; i++) { a += amp * vn(x * f, y * f, z * f); f *= 2; amp *= 0.5; } return a; };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ---------- the cloth: a diagonal twill of indigo warp threads with pale weft showing through, slubs, white flecks and wear ----------
// dir +1 / -1 mirrors the twill, seed shifts the noise, wear 0..1 how faded it is
const cloth = (w, h, dir, seed, wear, dark) => {
  const cv = mkc(w, h), cg = cv.getContext('2d'), im = cg.createImageData(w, h), o = im.data;
  const DK = [62, 102, 164], MD = [98, 146, 206], LT = [168, 202, 238], WH = [210, 228, 246];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, u = ((x * dir + y) % 4 + 4) % 4;                                  // a faint diagonal twill under the warp streaks
    const warp = (h3(x, 0, seed) - 0.5) * 0.62 + (h3(Math.floor(x / 2), 3, seed) - 0.5) * 0.3;     // vertical streaks: each blue warp thread a shade of its own
    const slub = (vn(x * 0.06, y * 0.12, seed + 5) - 0.5) * 0.6 + (vn(x * 0.9, y * 0.03, seed + 9) - 0.5) * 0.42;   // uneven yarn: streaks that run lengthwise
    let col = mixc(DK, MD, clamp01(0.5 + warp + slub + (u === 1 ? 0.05 : u === 3 ? -0.05 : 0)));
    if (u === 0) col = mixc(col, WH, 0.16);
    // long pale and dark warp threads that run the length of the cloth, broken up so they read as thread, not as stripes
    const run = Math.floor(y / (7 + 11 * h3(x, 5, seed)));
    const tv = h3(x, run, seed + 21); if (tv > 0.86) col = mixc(col, WH, 0.34 + 0.3 * h3(x, y, seed + 2)); else if (tv < 0.1) col = mixc(col, DK, 0.5);
    if (h3(Math.floor(x / 2), y, seed + 11) > 0.93) col = mixc(col, WH, 0.42);                       // pale weft slubs: short horizontal dashes
    // stonewash: broad mottled fading, strongest toward the middle of a panel
    const mott = fbm(x * 0.017 + seed, y * 0.017, seed + 2, 5), f = clamp01((mott - 0.32) * 2.3) * wear;
    col = mixc(col, mixc(LT, WH, 0.3 * h3(y, x, 4)), 0.1 + f * 0.7);
    const d = dark || 0; col = [col[0] * (1 - d), col[1] * (1 - d), col[2] * (1 - d)];
    o[i] = col[0]; o[i + 1] = col[1]; o[i + 2] = col[2]; o[i + 3] = 255;
  }
  cg.putImageData(im, 0, 0); return cv;
};

// ---------- thread: a stitched line with a soft shadow, a body colour and a highlight ----------
const THREAD = ['#6d4217', '#c38a42', '#ecc07c'];
const stitchPath = (g, pathFn, dash, w) => {   // w: the thread's width in px (about 1.5 for jeans topstitching)
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.setLineDash(dash);
  g.translate(0.5, 1.1); pathFn(g); g.strokeStyle = 'rgba(14,34,76,0.5)'; g.lineWidth = w + 0.5; g.stroke(); g.translate(-0.5, -1.1);
  pathFn(g); g.strokeStyle = THREAD[0]; g.lineWidth = w + 0.5; g.stroke();
  pathFn(g); g.strokeStyle = THREAD[1]; g.lineWidth = w; g.stroke();
  pathFn(g); g.strokeStyle = THREAD[2]; g.lineWidth = w * 0.35; g.translate(-0.25, -0.35); g.stroke(); g.restore();
};

// ================= scene =================
const c = mkc(W, H), g = c.getContext('2d');
g.drawImage(cloth(W, H, 1, 3, 1.0), 0, 0);
// the cloth is brighter in the middle where the light falls, darker at the edges
g.fillStyle = rgrad(g, CX, 190, 40, 330, [[0, 'rgba(255,255,255,0.1)'], [1, 'rgba(14,44,100,0.34)']]); g.fillRect(0, 0, W, H);
// fine lengthwise hairs over the fading, so the vertical grain stays clear
g.save(); for (let x = 0; x < W; x++) { const a = h3(x, 7, 3); if (a > 0.7) { g.fillStyle = a > 0.9 ? 'rgba(225,238,252,0.2)' : 'rgba(26,60,118,0.13)'; g.fillRect(x, 0, 1, H); } } g.restore();
// whiskers: the pale creases that wear into jeans, fanning from the pocket corners
g.save(); g.globalCompositeOperation = 'screen';
for (const [x0, y0, dir] of [[40, 190, -1], [350, 190, 1], [30, 150, -1], [360, 130, 1]]) for (let i = 0; i < 9; i++) { const a = (dir < 0 ? Math.PI : 0) + (i - 4) * 0.1 + (dir < 0 ? 0.28 : -0.28), len = 60 + srand(i * 3.7 + x0) * 70, y1 = y0 + Math.sin(a) * len * 0.5 + 30; g.strokeStyle = 'rgba(190,214,238,' + (0.08 + srand(i + y0) * 0.1) + ')'; g.lineWidth = 1 + srand(i) * 1.6; g.beginPath(); g.moveTo(x0, y0 + (i - 4) * 4); g.quadraticCurveTo(x0 + Math.cos(a) * len * 0.5, y0 + (i - 4) * 4 + 8, x0 + Math.cos(a) * len, y1); g.stroke(); }
g.restore();

// waistband: a darker strip with two rows of gold topstitching and a seam shadow
g.fillStyle = 'rgba(14,34,76,0.24)'; g.fillRect(0, 0, W, 64);
g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, 64, W, 4); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 68, W, 4);
g.fillStyle = 'rgba(150,185,225,0.2)'; g.fillRect(0, 63, W, 1);
for (const y of [58, 62]) stitchPath(g, (gg) => { gg.beginPath(); gg.moveTo(-4, y); gg.lineTo(W + 4, y); }, [5, 2], 1.5);

// the leather label sewn on the waistband
const LX = 96, LY = 11, LW = 198, LH = 44;
g.save(); g.shadowColor = 'rgba(0,6,20,0.7)'; g.shadowBlur = 9; g.shadowOffsetY = 4; rr(g, LX, LY, LW, LH, 5); g.fillStyle = '#9b6b3a'; g.fill(); g.restore();
const lg = mkc(LW, LH), lgc = lg.getContext('2d'), li = lgc.createImageData(LW, LH), lo = li.data;
for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) { const i = (y * LW + x) * 4, t = y / LH, gr = fbm(x * 0.35, y * 0.35, 9, 3), pore = h3(x, y, 2) > 0.9 ? -22 : 0, base = mixc([196, 150, 98], [150, 102, 56], t);
  lo[i] = base[0] + (gr - 0.5) * 46 + pore; lo[i + 1] = base[1] + (gr - 0.5) * 38 + pore; lo[i + 2] = base[2] + (gr - 0.5) * 28 + pore; lo[i + 3] = 255; }
lgc.putImageData(li, 0, 0);
g.save(); rr(g, LX, LY, LW, LH, 5); g.clip(); g.drawImage(lg, LX, LY); g.fillStyle = grad(g, 0, LY, 0, LY + LH, [[0, 'rgba(255,240,210,0.28)'], [0.25, 'rgba(255,240,210,0)'], [1, 'rgba(40,18,0,0.3)']]); g.fillRect(LX, LY, LW, LH); g.restore();
rr(g, LX, LY, LW, LH, 5); g.strokeStyle = 'rgba(60,30,8,0.7)'; g.lineWidth = 1.2; g.stroke();
stitchPath(g, (gg) => { rr(gg, LX + 5, LY + 5, LW - 10, LH - 10, 3); }, [4, 2], 1.4);

// ---------- the back pocket ----------
const pocket = (d) => (gg) => {   // d = inset in px
  const t = 190 + d, l = 64 + d, r = 326 - d, sb = 344 - d * 0.6, tip = 444 - d * 1.5;
  gg.beginPath(); gg.moveTo(l, t); gg.lineTo(r, t); gg.lineTo(r, sb); gg.quadraticCurveTo(r - 6 + d * 0.3, tip - 46, CX, tip); gg.quadraticCurveTo(l + 6 - d * 0.3, tip - 46, l, sb); gg.closePath();
};
const pk = cloth(W, H, -1, 17, 0.5, 0.2);
g.save(); g.shadowColor = 'rgba(0,4,16,0.75)'; g.shadowBlur = 12; g.shadowOffsetY = 5; pocket(0)(g); g.fillStyle = '#14284a'; g.fill(); g.restore();
g.save(); pocket(0)(g); g.clip(); g.drawImage(pk, 0, 0);
g.fillStyle = grad(g, 0, 190, 0, 444, [[0, 'rgba(255,255,255,0.06)'], [1, 'rgba(0,10,40,0.16)']]); g.fillRect(0, 190, W, 260);
// the rim keeps its deeper blue where the cloth is doubled and rubs less
g.save(); g.filter = 'blur(7px)'; pocket(0)(g); g.strokeStyle = 'rgba(24,62,128,0.5)'; g.lineWidth = 26; g.stroke(); g.restore();
// the hem band: darker, with a soft fold above it
g.fillStyle = 'rgba(20,56,120,0.2)'; g.fillRect(0, 190, W, 26); g.fillStyle = 'rgba(8,24,60,0.3)'; g.fillRect(0, 216, W, 2.4); g.fillStyle = 'rgba(200,222,246,0.3)'; g.fillRect(0, 218.4, W, 1.2); g.fillStyle = 'rgba(200,222,246,0.3)'; g.fillRect(0, 190, W, 1.4);
// a few creases and light wear along the pocket's own edge
g.globalCompositeOperation = 'screen'; for (let i = 0; i < 10; i++) { g.strokeStyle = 'rgba(180,205,232,' + (0.05 + srand(i) * 0.08) + ')'; g.lineWidth = 1 + srand(i * 2.1) * 2; g.beginPath(); g.moveTo(70 + srand(i * 4.3) * 250, 224 + srand(i * 1.7) * 60); g.quadraticCurveTo(190 + (srand(i) - 0.5) * 80, 300 + srand(i * 6.1) * 40, 80 + srand(i * 3.9) * 230, 360 + srand(i * 5.3) * 50); g.stroke(); }
g.restore();
pocket(0)(g); g.strokeStyle = 'rgba(8,18,44,0.8)'; g.lineWidth = 1.4; g.stroke();
pocket(1.5)(g); g.strokeStyle = 'rgba(150,185,225,0.28)'; g.lineWidth = 1; g.stroke();
// topstitching: two rows around the pocket, two across the hem
stitchPath(g, pocket(8), [5, 2], 1.5);
stitchPath(g, (gg) => { gg.beginPath(); gg.moveTo(72, 203); gg.lineTo(318, 203); }, [5, 2], 1.5);
// the arcuate design: threads that run across and cross into a peak, as on a worn back pocket
for (const y of [368, 374, 380]) stitchPath(g, (gg) => { gg.beginPath(); gg.moveTo(98, y); gg.lineTo(292, y); }, [5, 2], 1.4);
for (const dy of [0, 6]) {
  stitchPath(g, (gg) => { gg.beginPath(); gg.moveTo(98, 382 + dy * 0.3); gg.lineTo(CX, 352 + dy * 0.4); gg.lineTo(292, 382 + dy * 0.3); }, [5, 2], 1.4);
  stitchPath(g, (gg) => { gg.beginPath(); gg.moveTo(98, 368 - dy * 0.3); gg.lineTo(CX, 394 + dy * 0.3); gg.lineTo(292, 368 - dy * 0.3); }, [5, 2], 1.4);
}
// silver rivets at the top corners
const rivet = (x, y) => { g.save(); g.shadowColor = 'rgba(0,10,30,0.6)'; g.shadowBlur = 4; g.shadowOffsetY = 2; g.beginPath(); g.arc(x, y, 7.4, 0, TAU); g.fillStyle = '#4a4f57'; g.fill(); g.restore();
  g.beginPath(); g.arc(x, y, 6.4, 0, TAU); g.fillStyle = rgrad(g, x - 2, y - 2.4, 0.5, 7.4, [[0, '#ffffff'], [0.45, '#bfc5cc'], [1, '#6c727b']]); g.fill();
  g.beginPath(); g.arc(x, y, 4, 0, TAU); g.strokeStyle = 'rgba(70,76,86,0.55)'; g.lineWidth = 1; g.stroke(); g.beginPath(); g.arc(x - 1.5, y - 1.8, 1.4, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill(); };
for (const [x, y] of [[74, 205], [316, 205], [LX + 11, LY + 9], [LX + LW - 11, LY + 9]]) rivet(x, y);
// a loose thread end, as on a pair that has seen some use
g.lineCap = 'round'; g.beginPath(); g.moveTo(322, 331); g.bezierCurveTo(340, 322, 349, 340, 338, 351); g.strokeStyle = 'rgba(10,30,70,0.4)'; g.lineWidth = 1.8; g.stroke(); g.beginPath(); g.moveTo(322, 330); g.bezierCurveTo(340, 321, 349, 339, 338, 350); g.strokeStyle = THREAD[1]; g.lineWidth = 1.2; g.stroke();
await scene(c, 'scene_denim');

// ================= embroidered digits: thread laid in rows (a fill stitch), with a running-stitch border =================
const DW = 80, DH = 108, BASE = 95;
const FILL = ['#8a5518', '#d9a04c', '#f5d393'];
const threadFill = (w, h, seed) => {   // long stitches laid in tight rows (a fill stitch); rows are staggered, each stitch a rounded bit of thread with a highlight and a shade
  const pat = mkc(w, h), pg = pat.getContext('2d'); pg.fillStyle = FILL[0]; pg.fillRect(0, 0, w, h); pg.lineCap = 'round';
  for (let r = 0, y = -1; y < h + 3; r++, y += 2.2) for (let x = -((r * 5.3) % 17); x < w + 18; x += 17) { const j = srand(r * 13.1 + x * 0.7 + seed), L = 15.2;
    pg.beginPath(); pg.moveTo(x, y + 1.1); pg.lineTo(x + L, y + 1.1); pg.strokeStyle = 'rgba(70,38,6,0.6)'; pg.lineWidth = 2.1; pg.stroke();
    pg.beginPath(); pg.moveTo(x + 0.2, y + 0.8); pg.lineTo(x + L - 0.2, y + 0.8); pg.strokeStyle = FILL[1]; pg.globalAlpha = 0.86 + 0.14 * j; pg.lineWidth = 1.6; pg.stroke(); pg.globalAlpha = 1;
    pg.beginPath(); pg.moveTo(x + 1.2, y + 0.3); pg.lineTo(x + L - 1.4, y + 0.3); pg.strokeStyle = FILL[2]; pg.globalAlpha = 0.4 + 0.45 * j; pg.lineWidth = 0.6; pg.stroke(); pg.globalAlpha = 1; }
  return pat;
};
const stitchedDigit = (ch) => {
  const cv = mkc(DW, DH), cg = cv.getContext('2d'), set = (g) => { g.font = '112px "Alfa Slab One"'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; };
  set(cg); cg.save(); cg.shadowColor = 'rgba(8,24,64,0.75)'; cg.shadowBlur = 4; cg.shadowOffsetY = 3; cg.fillStyle = '#5f3a10'; cg.fillText(ch, DW / 2, BASE); cg.restore();           // the embroidery pressing into the cloth
  const t = mkc(DW, DH), tg = t.getContext('2d'); set(tg); tg.fillStyle = '#fff'; tg.fillText(ch, DW / 2, BASE); tg.globalCompositeOperation = 'source-in'; tg.drawImage(threadFill(DW, DH, 5), 0, 0);
  cg.drawImage(t, 0, 0);
  cg.save(); set(cg); cg.setLineDash([4.6, 2.2]); cg.lineCap = 'round'; cg.strokeStyle = 'rgba(70,38,6,0.7)'; cg.lineWidth = 3; cg.translate(0, 0.6); cg.strokeText(ch, DW / 2, BASE); cg.translate(0, -0.6); cg.strokeStyle = FILL[1]; cg.lineWidth = 2.1; cg.strokeText(ch, DW / 2, BASE); cg.strokeStyle = FILL[2]; cg.lineWidth = 0.7; cg.strokeText(ch, DW / 2, BASE); cg.restore();
  return cv;
};
const digits = []; for (let n = 0; n < 10; n++) digits.push(addProjectImage('den/d_' + n + '.png', stitchedDigit(String(n)), {}).name);
const colonCv = mkc(30, DH), cgc = colonCv.getContext('2d');
for (const cy of [38, 72]) { cgc.save(); cgc.shadowColor = 'rgba(8,24,64,0.75)'; cgc.shadowBlur = 4; cgc.shadowOffsetY = 3; cgc.fillStyle = '#5f3a10'; cgc.beginPath(); cgc.arc(15, cy, 11.5, 0, TAU); cgc.fill(); cgc.restore();
  const t = mkc(30, DH), tg = t.getContext('2d'); tg.fillStyle = '#fff'; tg.beginPath(); tg.arc(15, cy, 11.5, 0, TAU); tg.fill(); tg.globalCompositeOperation = 'source-in'; tg.drawImage(threadFill(30, DH, 9), 0, 0); cgc.drawImage(t, 0, 0);
  cgc.save(); cgc.setLineDash([4.4, 2.2]); cgc.lineCap = 'round'; cgc.beginPath(); cgc.arc(15, cy, 11.5, 0, TAU); cgc.strokeStyle = FILL[1]; cgc.lineWidth = 2.1; cgc.stroke(); cgc.strokeStyle = FILL[2]; cgc.lineWidth = 0.7; cgc.stroke(); cgc.restore(); }
const colon = addProjectImage('den/colon.png', colonCv, {}).name;
await loadAllImages();
for (const n of ['Hour', 'Minute']) { const e = E(n); e.glyph = null; e.images = digits; e.space = 3; e.zero = 1; e.alignH = 'LEFT'; }
const ce = E('Colon'); ce.glyph = null; ce.src = colon;
await loadAllImages();

// ================= native layers =================
park(['Hour', 'Colon', 'Minute', 'Weekday', 'Day', 'Steps', 'Heart rate', 'Battery']);
await seqRow(['Hour', 'Colon', 'Minute'], CX, 127, 3);
const wd = E('Weekday'); wd.labelAlign = 'right'; rerenderGlyphLayers(); await loadAllImages();
await dateRow(CX, 33, 10);
await chipAt('Steps', 'steps', CX, 246, 30, '#e8b04a');
await chipAt('Heart rate', 'heart', CX, 284, 30, '#e8b04a');
await batChipAt('Battery', CX, 322, 40, 24, ['#e8b04a', '#e8b04a', '#e06a4a'], '#e8b04a');

globalThis.__A = { font: 'Alfa Slab One', size: 100, color: '#a9bbd2', row: [CX, 225, 6], col: true };
globalThis.__G = { Date: ['Weekday', 'Day'], Steps: ['Steps icon', 'Steps'], 'Heart rate': ['Heart rate icon', 'Heart rate'], Battery: ['Battery level', 'Battery'] };
