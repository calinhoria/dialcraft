// ---- Knitted Time: a knitted blanket, the time in knitted digits, felt patches for the readings, a ball of yarn and a pair of needles ----
FONT = 'Cherry Bomb One';
const BG = ['#a9dccf', '#8fcbbd', '#6eb2a4'], YARN = ['#fff0b8', '#ffd45e', '#e0a52b'];   // blanket mint; the digits in sunny yellow yarn
const CORAL = ['#ff9f8a', '#ff6f5e', '#c4412f'];

// a field of knit stitches (stockinette: a column of Vs): every stitch is two slanted leaves, lit from the top left
const knit = (g, x0, y0, w, h, sw, sh, pal, jitter) => {
  for (let r = 0, y = y0; y < y0 + h + sh; r++, y += sh) for (let c = 0, x = x0 - sw; x < x0 + w + sw; c++, x += sw) {
    const j = jitter ? (srand(r * 91 + c * 7.3) - 0.5) * jitter : 0;
    for (const sd of [-1, 1]) {
      const cx = x + sw / 2 + sd * sw * 0.23, cy = y + sh * 0.5 + j, rot = sd * 0.5;
      const q = g.createLinearGradient(cx - sw * 0.3, cy - sh * 0.5, cx + sw * 0.3, cy + sh * 0.5); q.addColorStop(0, pal[0]); q.addColorStop(0.55, pal[1]); q.addColorStop(1, pal[2]);
      g.beginPath(); g.ellipse(cx, cy, sw * 0.27, sh * 0.66, rot, 0, TAU); g.fillStyle = q; g.fill(); g.strokeStyle = pal[2]; g.globalAlpha = 0.55; g.lineWidth = 0.8; g.stroke(); g.globalAlpha = 1;
    }
  }
};
// loose fibres so the yarn looks fuzzy
const fuzz = (g, x0, y0, w, h, n, col, seed) => { g.strokeStyle = col; g.lineWidth = 0.7; for (let i = 0; i < n; i++) { const x = x0 + srand(i * 3.1 + seed) * w, y = y0 + srand(i * 5.7 + seed) * h, a = srand(i * 7.9 + seed) * TAU; g.globalAlpha = 0.35 + srand(i + seed) * 0.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3); g.stroke(); } g.globalAlpha = 1; };

// ================= scene =================
const c = mkc(W, H), g = c.getContext('2d');
g.fillStyle = BG[1]; g.fillRect(0, 0, W, H);
knit(g, 0, 0, W, H, 12, 14, BG, 0);
fuzz(g, 0, 0, W, H, 900, '#e9fbf5', 11);
// soft light from the top, a vignette toward the edges
g.fillStyle = rgrad(g, CX, 170, 40, 330, [[0, 'rgba(255,255,255,0.16)'], [1, 'rgba(20,70,70,0.34)']]); g.fillRect(0, 0, W, H);

// felt patches: a blanket stitch border, a soft shadow, a little felt grain
const patch = (x, y, w, h, fill, edge, stitch) => {
  g.save(); g.shadowColor = 'rgba(20,60,60,0.45)'; g.shadowBlur = 8; g.shadowOffsetY = 3; rr(g, x, y, w, h, h / 2); g.fillStyle = fill; g.fill(); g.restore();
  rr(g, x, y, w, h, h / 2); g.strokeStyle = edge; g.lineWidth = 1.2; g.stroke();
  for (let i = 0; i < 260; i++) { const px = x + srand(i * 1.3 + x) * w, py = y + srand(i * 2.9 + y) * h; g.fillStyle = srand(i) > 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(120,90,60,0.13)'; g.fillRect(px, py, 1.3, 1.3); }
  // blanket stitch: short dashes pointing inward around the border
  g.save(); rr(g, x + 5, y + 5, w - 10, h - 10, (h - 10) / 2); g.setLineDash([5, 4]); g.strokeStyle = stitch; g.lineWidth = 1.8; g.stroke(); g.restore();
};
const FELT = '#fff2d2';
patch(124, 22, 142, 42, '#ffc2cf', '#e58ea2', '#fff7fa');      // the date tag
patch(90, 180, 210, 46, FELT, '#e0c690', '#e2563f');            // steps
patch(40, 238, 150, 46, FELT, '#e0c690', '#e2563f');            // heart rate
patch(200, 238, 150, 46, FELT, '#e0c690', '#e2563f');           // battery
// the thread from the ball to the needles, drawn as a loose loop
g.lineCap = 'round'; g.beginPath(); g.moveTo(84, 396); g.bezierCurveTo(130, 420, 190, 398, 246, 338); g.strokeStyle = CORAL[2]; g.lineWidth = 3.4; g.stroke();
g.beginPath(); g.moveTo(84, 395); g.bezierCurveTo(130, 419, 190, 397, 246, 337); g.strokeStyle = CORAL[0]; g.lineWidth = 1.5; g.stroke();
await scene(c, 'scene_knit');

// ================= knitted digits and colon =================
const DW = 80, DH = 118, BASE = 106;
const yarnDigit = (ch) => {
  const cv = mkc(DW, DH), cg = cv.getContext('2d');
  cg.font = '122px "Cherry Bomb One"'; cg.textAlign = 'center'; cg.textBaseline = 'alphabetic'; cg.lineJoin = 'round';
  cg.strokeStyle = '#a8611e'; cg.lineWidth = 7; cg.strokeText(ch, DW / 2, BASE);                       // darker outline: the digit's edge in shadow
  const pat = mkc(DW, DH), pg = pat.getContext('2d'); pg.fillStyle = YARN[1]; pg.fillRect(0, 0, DW, DH); knit(pg, 0, 0, DW, DH, 9, 10, YARN, 0); fuzz(pg, 0, 0, DW, DH, 90, '#fff7d0', 5);
  const t = mkc(DW, DH), tg = t.getContext('2d'); tg.font = cg.font; tg.textAlign = 'center'; tg.fillStyle = '#fff'; tg.fillText(ch, DW / 2, BASE);
  tg.globalCompositeOperation = 'source-in'; tg.drawImage(pat, 0, 0);          // the stitches only where the digit is
  cg.drawImage(t, 0, 0); return cv;
};
const digits = []; for (let n = 0; n < 10; n++) digits.push(addProjectImage('knit/d_' + n + '.png', yarnDigit(String(n)), {}).name);
const colonCv = mkc(30, DH), cgc = colonCv.getContext('2d');
for (const cy of [38, 80]) { cgc.fillStyle = '#a8611e'; cgc.beginPath(); cgc.arc(15, cy, 12.5, 0, TAU); cgc.fill(); const pat = mkc(30, DH), pg = pat.getContext('2d'); pg.fillStyle = YARN[1]; pg.fillRect(0, 0, 30, DH); knit(pg, 0, 0, 30, DH, 8, 9, YARN, 0);
  const t = mkc(30, DH), tg = t.getContext('2d'); tg.fillStyle = '#fff'; tg.beginPath(); tg.arc(15, cy, 10, 0, TAU); tg.fill(); tg.globalCompositeOperation = 'source-in'; tg.drawImage(pat, 0, 0); cgc.drawImage(t, 0, 0); }
const colon = addProjectImage('knit/colon.png', colonCv, {}).name;
await loadAllImages();
for (const n of ['Hour', 'Minute']) { const e = E(n); e.glyph = null; e.images = digits; e.space = 2; e.zero = 1; e.alignH = 'LEFT'; }
const ce = E('Colon'); ce.glyph = null; ce.src = colon;
await loadAllImages();

// ================= native layers =================
park(['Hour', 'Colon', 'Minute', 'Weekday', 'Day', 'Steps', 'Heart rate', 'Battery']);
await seqRow(['Hour', 'Colon', 'Minute'], CX, 122, 2);
const wd = E('Weekday'); wd.labelAlign = 'right'; rerenderGlyphLayers(); await loadAllImages();
await dateRow(CX, 43, 10);
await chipAt('Steps', 'steps', CX, 203, 30, '#e2563f');
await chipAt('Heart rate', 'heart', 115, 261, 30, '#e2563f');
await chipAt('Battery', 'bolt', 275, 261, 30, '#e2563f');   // replaced below by a battery cell
project.elements = project.elements.filter((e) => e.name !== 'Battery icon');
await batChipAt('Battery', 275, 261, 40, 24, ['#3fae62', '#e0a020', '#d0392b'], '#5b3413');

// ================= sprite slots: the ball of yarn, the needles, the scarf that grows =================
const ball = (k) => (gg) => {
  const cx = 28, cy = 28, R0 = 23;
  gg.save(); gg.beginPath(); gg.arc(cx, cy, R0, 0, TAU); gg.clip();
  gg.fillStyle = grad(gg, 6, 4, 50, 52, [[0, CORAL[0]], [0.55, CORAL[1]], [1, CORAL[2]]]); gg.fillRect(0, 0, 56, 56);
  for (let i = 0; i < 9; i++) { const th = k * Math.PI / 8 + i * Math.PI / 9; gg.beginPath(); gg.ellipse(cx, cy, 30, 11 + (i % 3) * 3, th, 0, TAU); gg.strokeStyle = 'rgba(150,40,30,0.5)'; gg.lineWidth = 1.6; gg.stroke(); gg.beginPath(); gg.ellipse(cx - 1, cy - 1, 30, 11 + (i % 3) * 3, th, 0, TAU); gg.strokeStyle = 'rgba(255,200,185,0.55)'; gg.lineWidth = 1; gg.stroke(); }
  gg.restore();
  gg.beginPath(); gg.arc(cx, cy, R0, 0, TAU); gg.strokeStyle = CORAL[2]; gg.lineWidth = 1.2; gg.stroke();
  gg.fillStyle = 'rgba(255,255,255,0.42)'; gg.beginPath(); gg.ellipse(19, 17, 7, 4, -0.6, 0, TAU); gg.fill();
  gg.beginPath(); gg.moveTo(48, 40); gg.quadraticCurveTo(54, 44, 52, 50); gg.strokeStyle = CORAL[1]; gg.lineWidth = 2.6; gg.lineCap = 'round'; gg.stroke();
};
const bv = []; for (let k = 0; k < 8; k++) bv.push(['f' + k, ball(k)]);
await mkSlot('ball', 'Ball of yarn', bv, 56, 56, 34, 372);
const needles = (up) => (gg) => {
  const wood = ['#e8c88e', '#c9965a'], dy = up ? -3 : 0;
  const nd = (x0, y0, x1, y1, d) => { gg.lineCap = 'round'; gg.beginPath(); gg.moveTo(x0, y0 + d); gg.lineTo(x1, y1 + d); gg.strokeStyle = wood[1]; gg.lineWidth = 4.6; gg.stroke(); gg.beginPath(); gg.moveTo(x0, y0 + d); gg.lineTo(x1, y1 + d); gg.strokeStyle = wood[0]; gg.lineWidth = 2.6; gg.stroke(); circ(gg, x1, y1 + d, 4.6, '#ff6f5e', '#c4412f', 1); };
  nd(8, 52, 58, 6, dy); nd(68, 52, 18, 6, -dy);
  for (let i = 0; i < 5; i++) { gg.beginPath(); gg.arc(24 + i * 7, 40 + (i % 2) * 1.4, 4, Math.PI, 0); gg.strokeStyle = CORAL[1]; gg.lineWidth = 2.4; gg.stroke(); }
  if (up) { for (const [x, y] of [[38, 18], [30, 12]]) { line(gg, x - 3, y, x + 3, y, '#fff7d0', 1.4); line(gg, x, y - 3, x, y + 3, '#fff7d0', 1.4); } }
};
await mkSlot('needles', 'Needles', [['a', needles(1)], ['b', needles(0)]], 76, 56, 232, 292);
await mkSlot('swatch', 'Scarf', [['s', (gg) => { gg.save(); rr(gg, 0, -8, 44, 88, 3); gg.clip(); gg.fillStyle = CORAL[1]; gg.fillRect(0, 0, 44, 80); knit(gg, 0, 0, 44, 80, 7, 8, CORAL, 0); fuzz(gg, 0, 0, 44, 80, 70, '#ffe1d8', 21); gg.restore(); gg.fillStyle = 'rgba(0,0,0,0.12)'; gg.fillRect(0, 0, 44, 3); }]], 44, 80, 248, 322);

globalThis.__A = { font: 'Cherry Bomb One', size: 100, color: '#9ab8ae', row: [CX, 225, 6], col: true };
globalThis.__G = { Date: ['Weekday', 'Day'], Steps: ['Steps icon', 'Steps'], 'Heart rate': ['Heart rate icon', 'Heart rate'], Battery: ['Battery level', 'Battery'], Yarn: ['Ball of yarn', 'Needles', 'Scarf'] };
