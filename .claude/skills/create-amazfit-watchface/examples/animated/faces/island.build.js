// ---- Island Cocktail: the view from a beach chair, a cocktail in the foreground, a palm island on the horizon;
//      small boats cross, a surfer rides in now and then, gulls glide by, the sun glitters on the water ----
FONT = 'Lilita One';
const HOR = 208, SHORE = 334, SUNX = 118, SUNY = 186;
const GX = SUNX - 34, GY = HOR + 4, GW = 68, GH = 84;          // glitter slot over the sun's reflection

// ================= scene (opaque, never moves) =================
const c = mkc(W, H), g = c.getContext('2d');
// sky: evening blue above, warm peach at the horizon
g.fillStyle = grad(g, 0, 0, 0, HOR, [[0, '#1d4a8a'], [0.42, '#4a82bf'], [0.72, '#e9a879'], [0.9, '#f8c58e'], [1, '#ffd9a3']]); g.fillRect(0, 0, W, HOR);
// sun glow and disc
g.fillStyle = rgrad(g, SUNX, SUNY, 0, 170, [[0, 'rgba(255,240,205,0.95)'], [0.1, 'rgba(255,214,160,0.55)'], [0.35, 'rgba(255,190,140,0.18)'], [1, 'rgba(255,180,130,0)']]); g.fillRect(0, 0, W, HOR);
circ(g, SUNX, SUNY, 15, '#fff6df');
// soft stretched clouds
g.save(); g.filter = 'blur(6px)';
for (const [x, y, w, a] of [[60, 160, 110, 0.45], [300, 150, 140, 0.4], [210, 176, 120, 0.35], [350, 118, 90, 0.3], [30, 124, 80, 0.25]]) {
  ell(g, x, y, w / 2, 5 + srand(x) * 4, 0, 'rgba(255,226,200,' + a + ')'); ell(g, x + 16, y + 6, w * 0.38, 4, 0, 'rgba(255,190,170,' + a * 0.7 + ')');
}
g.restore();
// the island: hazy hills on the right, a sand rim and three palms
const isl = (x) => { const t = (x - 232) / 150; if (t < 0 || t > 1) return 0; return 26 * Math.pow(Math.sin(Math.PI * t), 0.8) + 6 * Math.sin(t * 9) * Math.sin(Math.PI * t); };
g.beginPath(); g.moveTo(222, HOR); for (let x = 222; x <= 392; x += 2) g.lineTo(x, HOR - isl(x)); g.lineTo(392, HOR); g.closePath();
g.fillStyle = grad(g, 0, HOR - 34, 0, HOR, [[0, '#2f6656'], [1, '#3f7a62']]); g.fill();
g.fillStyle = 'rgba(255,200,150,0.22)'; g.fill();   // evening haze on the far hills
g.fillStyle = '#e9cf9c'; g.fillRect(226, HOR - 3, 162, 3);
const palm = (gc, x, y, h, lean, s, col, frondCol) => {
  // trunk: a slightly curved, tapering line; fronds: drooping leaves from the top
  const tx = x + lean, ty = y - h;
  gc.strokeStyle = col; gc.lineCap = 'round';
  for (let i = 0; i < 8; i++) { const a = i / 8, b = (i + 1) / 8; gc.lineWidth = s * (2.4 - 1.4 * a);
    gc.beginPath(); gc.moveTo(x + lean * a * a, y - h * a); gc.lineTo(x + lean * b * b, y - h * b); gc.stroke(); }
  for (const [ang, len] of [[-2.7, 1.0], [-2.2, 0.9], [-1.5, 0.7], [-0.9, 0.9], [-0.4, 1.0], [0.2, 0.75], [3.1, 0.75]]) {
    const L = h * 0.55 * len, ex = tx + Math.cos(ang) * L, ey = ty + Math.sin(ang) * L * 0.55 + L * 0.35;
    gc.beginPath(); gc.moveTo(tx, ty); gc.quadraticCurveTo(tx + Math.cos(ang) * L * 0.6, ty + Math.sin(ang) * L * 0.6 - L * 0.12, ex, ey);
    gc.quadraticCurveTo(tx + Math.cos(ang) * L * 0.5, ty + Math.sin(ang) * L * 0.5 + L * 0.02, tx, ty); gc.fillStyle = frondCol; gc.fill();
  }
};
palm(g, 286, HOR - 18, 30, -5, 1.1, '#243f33', '#25503c');
palm(g, 300, HOR - 20, 38, 6, 1.2, '#243f33', '#2a5a43');
palm(g, 334, HOR - 16, 26, 4, 1.0, '#243f33', '#25503c');
// sea: deep teal far, turquoise near, a warm reflection column under the sun
g.fillStyle = grad(g, 0, HOR, 0, SHORE, [[0, '#2a7fa6'], [0.35, '#1f9fb3'], [0.75, '#37c3bd'], [1, '#78dccb']]); g.fillRect(0, HOR, W, SHORE - HOR);
g.fillStyle = 'rgba(255,215,170,0.22)'; g.fillRect(0, HOR, W, 6);
for (let y = HOR + 2; y < SHORE; y += 2) {
  const t = (y - HOR) / (SHORE - HOR), half = 16 + 70 * t;
  g.fillStyle = 'rgba(255,226,180,' + (0.38 * (1 - t) + 0.05) + ')'; g.fillRect(SUNX - half / 2 + 6 * Math.sin(y * 0.7), y, half, 1);
}
// gentle wave lines, longer toward the shore
for (let i = 0; i < 46; i++) {
  const t = srand(i * 3.1), y = HOR + 6 + Math.pow(t, 0.8) * (SHORE - HOR - 16), w = 10 + 50 * ((y - HOR) / (SHORE - HOR)), x = srand(i * 7.7) * W;
  line(g, x, y, x + w, y, 'rgba(255,255,255,' + (0.12 + 0.18 * srand(i)) + ')', 1.2);
  line(g, x + 3, y + 2, x + w - 4, y + 2, 'rgba(10,70,100,0.18)', 1);
}
// shore: foam line, wet sand, dry sand with grain
const edge = (x) => SHORE + 4 * Math.sin(x * 0.05) + 2.5 * Math.sin(x * 0.17 + 1) + 1.5 * Math.sin(x * 0.41);
g.beginPath(); g.moveTo(0, edge(0)); for (let x = 0; x <= W; x += 3) g.lineTo(x, edge(x)); g.lineTo(W, H); g.lineTo(0, H); g.closePath();
g.fillStyle = grad(g, 0, SHORE, 0, H, [[0, '#c9ae7f'], [0.12, '#dcc392'], [0.4, '#ead5a6'], [1, '#f2e2b8']]); g.fill();
g.beginPath(); for (let x = 0; x <= W; x += 3) { x ? g.lineTo(x, edge(x)) : g.moveTo(x, edge(x)); } g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; g.stroke();
g.beginPath(); for (let x = 0; x <= W; x += 3) { x ? g.lineTo(x, edge(x) - 5 + 2 * Math.sin(x * 0.3)) : g.moveTo(x, edge(x) - 5); } g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5; g.stroke();
g.beginPath(); for (let x = 0; x <= W; x += 3) { x ? g.lineTo(x, edge(x) + 9 + 2 * Math.sin(x * 0.11)) : g.moveTo(x, edge(x) + 9); } g.strokeStyle = 'rgba(120,90,50,0.25)'; g.lineWidth = 1.5; g.stroke();
for (let i = 0; i < 7000; i++) { const y = SHORE + 6 + srand(i * 1.3) * (H - SHORE); g.fillStyle = 'rgba(' + (srand(i * 2.1) > 0.5 ? '255,250,230' : '120,92,55') + ',' + (0.07 + srand(i * 3.7) * 0.1) + ')'; g.fillRect(srand(i * 5.9) * W, y, 1, 1); }
await scene(c, 'scene_island');

// ================= foreground (transparent, above the sprites and the readings): palm fronds and the cocktail =================
const f = mkc(W, H), q = f.getContext('2d');
// palm fronds hanging into the top corners, dark and backlit
const frond = (gc, x0, y0, ang, len, wid, col) => {
  const ex = x0 + Math.cos(ang) * len, ey = y0 + Math.sin(ang) * len, nx = -Math.sin(ang), ny = Math.cos(ang);
  for (let i = 1; i < 16; i++) {
    const t = i / 16, px = x0 + (ex - x0) * t + nx * 10 * Math.sin(t * Math.PI), py = y0 + (ey - y0) * t + ny * 10 * Math.sin(t * Math.PI) + t * t * len * 0.25;
    const lw = wid * Math.sin(t * Math.PI) * (1 - t * 0.4);
    for (const sd of [-1, 1]) { gc.beginPath(); gc.moveTo(px, py); gc.quadraticCurveTo(px + nx * sd * lw * 0.6 + 4, py + ny * sd * lw * 0.6 + 6, px + nx * sd * lw + 6, py + ny * sd * lw + 12); gc.lineWidth = 3.2 * (1 - t * 0.5); gc.strokeStyle = col; gc.lineCap = 'round'; gc.stroke(); }
  }
  gc.beginPath(); gc.moveTo(x0, y0); gc.quadraticCurveTo((x0 + ex) / 2 + nx * 10, (y0 + ey) / 2 + ny * 10, ex, ey + len * 0.25); gc.lineWidth = 2.2; gc.strokeStyle = col; gc.stroke();
};
frond(q, 404, -14, 2.25, 92, 24, '#16382c'); frond(q, 400, -10, 1.95, 74, 20, '#1d4636'); frond(q, 396, 6, 2.65, 70, 18, '#1a4032');
frond(q, -14, -12, 0.75, 66, 18, '#16382c'); frond(q, -10, 4, 0.4, 54, 15, '#1d4636');
// the cocktail on the sand, close to the viewer: a hurricane glass of tequila sunrise, ice, a lime wheel, a paper umbrella and a straw
const CXg = 102, TOPY = 300, BASEY = 440;
q.save(); q.globalAlpha = 0.35; ell(q, CXg + 10, BASEY + 2, 50, 7, 0, '#6b4a22'); q.restore();
const bowl = (gc) => { gc.beginPath(); gc.moveTo(CXg - 46, TOPY); gc.bezierCurveTo(CXg - 54, TOPY + 50, CXg - 20, TOPY + 70, CXg - 26, TOPY + 98); gc.bezierCurveTo(CXg - 30, TOPY + 118, CXg - 10, TOPY + 120, CXg - 8, TOPY + 124);
  gc.lineTo(CXg + 8, TOPY + 124); gc.bezierCurveTo(CXg + 10, TOPY + 120, CXg + 30, TOPY + 118, CXg + 26, TOPY + 98); gc.bezierCurveTo(CXg + 20, TOPY + 70, CXg + 54, TOPY + 50, CXg + 46, TOPY); gc.closePath(); };
// straw behind the drink
q.save(); q.lineCap = 'round'; for (let i = 0; i < 9; i++) { const a = i / 9, b = (i + 1) / 9; line(q, CXg + 14 + 30 * a, TOPY + 60 - 92 * a, CXg + 14 + 30 * b, TOPY + 60 - 92 * b, i % 2 ? '#ffffff' : '#e8413c', 6); } q.restore();
// the drink: deep red at the bottom rising to orange and gold
q.save(); bowl(q); q.clip();
q.fillStyle = grad(q, 0, TOPY + 14, 0, TOPY + 124, [[0, '#ffc64a'], [0.45, '#ff8a2a'], [0.8, '#e5402c'], [1, '#b52430']]); q.fillRect(CXg - 60, TOPY + 14, 120, 112);
for (const [x, y, s, r] of [[-20, 30, 15, 0.3], [6, 24, 16, -0.2], [20, 44, 13, 0.5], [-8, 52, 14, -0.4]]) { q.save(); q.translate(CXg + x, TOPY + y); q.rotate(r); rr(q, -s / 2, -s / 2, s, s, 3); q.fillStyle = 'rgba(255,255,255,0.28)'; q.fill(); q.strokeStyle = 'rgba(255,255,255,0.55)'; q.lineWidth = 1; q.stroke(); q.restore(); }
q.fillStyle = 'rgba(255,255,255,0.18)'; q.fillRect(CXg - 60, TOPY, 120, 14);
q.fillStyle = 'rgba(255,255,255,0.4)'; q.fillRect(CXg - 60, TOPY + 13, 120, 2);
q.restore();
// glass outline, highlights and condensation
bowl(q); q.strokeStyle = 'rgba(255,255,255,0.75)'; q.lineWidth = 2; q.stroke();
q.save(); bowl(q); q.clip(); q.globalAlpha = 0.5; quad(q, CXg - 36, TOPY + 10, CXg - 44, TOPY + 52, CXg - 22, TOPY + 92, '#ffffff', 4); q.globalAlpha = 0.25; quad(q, CXg + 30, TOPY + 16, CXg + 36, TOPY + 50, CXg + 18, TOPY + 80, '#ffffff', 3); q.restore();
for (let i = 0; i < 26; i++) { const x = CXg - 34 + srand(i * 9.1) * 68, y = TOPY + 22 + srand(i * 4.3) * 90; circ(q, x, y, 0.8 + srand(i) * 1.4, 'rgba(255,255,255,0.55)'); }
ell(q, CXg, TOPY, 46, 5, 0, null, 'rgba(255,255,255,0.85)', 2);
// stem and foot
q.fillStyle = 'rgba(235,245,250,0.75)'; q.fillRect(CXg - 4, TOPY + 124, 8, 8);
q.beginPath(); q.moveTo(CXg - 4, TOPY + 132); q.lineTo(CXg + 4, TOPY + 132); q.lineTo(CXg + 30, BASEY - 2); q.lineTo(CXg - 30, BASEY - 2); q.closePath(); q.fillStyle = 'rgba(235,245,250,0.6)'; q.fill();
ell(q, CXg, BASEY - 2, 31, 4, 0, 'rgba(240,250,255,0.85)', 'rgba(255,255,255,0.95)', 1.2);
// lime wheel on the rim
q.save(); q.translate(CXg - 40, TOPY - 4); q.rotate(-0.35); circ(q, 0, 0, 17, '#9bd34a', '#5e9a1e', 2.5); circ(q, 0, 0, 13, '#d7f07a');
for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; line(q, 0, 0, Math.cos(a) * 12, Math.sin(a) * 12, 'rgba(150,200,60,0.9)', 1.6); } circ(q, 0, 0, 2.5, '#eefab0'); q.restore();
// paper umbrella
q.save(); q.translate(CXg + 8, TOPY - 14); line(q, 0, 0, -12, -42, '#8a5a2b', 2);
q.translate(-12, -44); q.rotate(-0.3);
for (let i = 0; i < 6; i++) { q.beginPath(); q.moveTo(0, 0); q.arc(0, 8, 30, Math.PI + i * Math.PI / 6, Math.PI + (i + 1) * Math.PI / 6); q.closePath(); q.fillStyle = i % 2 ? '#ff6fa3' : '#ff9ec2'; q.fill(); }
q.beginPath(); q.arc(0, 8, 30, Math.PI, 0); q.strokeStyle = 'rgba(160,40,90,0.6)'; q.lineWidth = 1; q.stroke(); q.restore();
// a cherry on top
circ(q, CXg + 26, TOPY - 6, 7, '#c8102e', '#7d0a1d', 1); circ(q, CXg + 24, TOPY - 8, 2, 'rgba(255,255,255,0.7)'); quad(q, CXg + 26, TOPY - 12, CXg + 30, TOPY - 24, CXg + 38, TOPY - 28, '#3f6b1f', 1.6);
const fg = await addImg('island_fg', f, 0, 0, 'Foreground');

// ================= native layers =================
park(['Hour', 'Colon', 'Minute', 'Weekday', 'Day', 'Steps', 'Heart rate', 'Battery']);
await seqRow(['Hour', 'Colon', 'Minute'], CX, 66, 6);
const wd = E('Weekday'); wd.labelAlign = 'right'; rerenderGlyphLayers(); await loadAllImages();
await dateRow(CX, 132, 10);
// readings on the sand, right of the glass, in a left-aligned column
const COLL = 190;
// icons share a centre column, the digits share one left edge
const ICX = COLL + 21, DL = COLL + 52;
for (const [layer, kind, cy, col] of [['Steps', 'steps', 352, '#5b3413'], ['Heart rate', 'heart', 388, '#d23a2e']]) {
  await addImg('ic_' + kind, icon(kind, 32, col), 100, 100, layer + ' icon');
  await align([layer + ' icon'], { cx: ICX, cy }); ll(layer, DL, cy); await align([layer], { l: DL, cy });
}
await batterySet('island', 42, 26, ['#2e9e5b', '#e0a020', '#d0392b'], '#5b3413', 100, 100, 'Battery level');
await align(['Battery level'], { cx: ICX, cy: 424 }); ll('Battery', DL, 424); await align(['Battery'], { l: DL, cy: 424 });

// ================= sprite slots =================
const sail = (hull, sailA, sailB, s) => (gc) => { gc.save(); gc.scale(s, s);
  poly(gc, [[2, 15], [22, 15], [19, 19], [5, 19]], hull); line(gc, 12, 15, 12, 1, '#3a2a1a', 1.2);
  poly(gc, [[12, 1], [12, 14], [3, 14]], sailA); poly(gc, [[12.8, 3], [12.8, 14], [20, 14]], sailB);
  gc.fillStyle = 'rgba(255,255,255,0.35)'; gc.fillRect(1, 19.5, 22, 1); gc.restore(); };
await mkSlot('boatA', 'Sailboat', [['s', sail('#7a4b2a', '#fff8ec', '#f1e3cc', 1)]], 24, 22, 40, HOR - 18);
await mkSlot('boatB', 'Sailboat far', [['s', sail('#5b3a22', '#ff8a5c', '#f3c9a5', 0.7)]], 17, 16, 200, HOR - 13);
const motor = (k) => (gc) => {
  // a small white speedboat heading left, with its wake
  for (let i = 0; i < 9; i++) { const x = 22 + i * 3 + (k ? 1 : 0), y = 9 + (i % 2 ? 1 : -1) * (k ? 1 : 0.5); circ(gc, x, y, 1.8 - i * 0.12, 'rgba(255,255,255,' + (0.85 - i * 0.08) + ')'); }
  poly(gc, [[2, 9], [26, 7], [26, 12], [7, 12]], '#ffffff', '#9fb8c8', 0.8); poly(gc, [[11, 7.4], [19, 6.6], [17, 3.5], [13, 3.8]], '#2b4c6a'); line(gc, 4, 11.5, 25, 11.5, '#d23a2e', 1);
};
await mkSlot('motor', 'Motorboat', [['a', motor(0)], ['b', motor(1)]], 50, 16, 300, 236);
const surfer = (k) => (gc) => {
  // a rising swell with its foaming lip, the surfer crouched on the face, spray behind
  const sw = gc.createLinearGradient(0, 14, 0, 46); sw.addColorStop(0, '#2aa7b8'); sw.addColorStop(1, 'rgba(55,195,189,0)');
  gc.beginPath(); gc.moveTo(0, 46); gc.bezierCurveTo(18, 40, 40, 20, 64, 16); gc.bezierCurveTo(78, 14, 88, 20, 96, 30); gc.lineTo(96, 46); gc.closePath(); gc.fillStyle = sw; gc.fill();
  gc.beginPath(); gc.moveTo(30, 30); gc.bezierCurveTo(44, 18, 60, 14, 74, 15); gc.strokeStyle = 'rgba(255,255,255,0.95)'; gc.lineWidth = 3; gc.lineCap = 'round'; gc.stroke();
  for (let i = 0; i < 12; i++) { const a = srand(i * 3 + k * 17); circ(gc, 64 + a * 26, 12 + srand(i * 5 + k) * 12, 1 + srand(i + k * 9) * 1.6, 'rgba(255,255,255,' + (0.5 + a * 0.4) + ')'); }
  // board
  gc.save(); gc.translate(46, 27); gc.rotate(-0.28); ell(gc, 0, 0, 15, 3, 0, '#ffd23f', '#c98d12', 1); gc.restore();
  // surfer: knees bent, arms out
  const sk = '#3b2416', bob = k === 1 ? -1 : 0;
  line(gc, 40, 27, 44, 20 + bob, sk, 2.6); line(gc, 52, 24, 48, 19 + bob, sk, 2.6);
  line(gc, 46, 19 + bob, 47, 11 + bob, sk, 3.4); circ(gc, 47.5, 8 + bob, 2.8, sk);
  line(gc, 47, 13 + bob, 39, 11 + bob + (k === 2 ? 2 : 0), sk, 2); line(gc, 47, 13 + bob, 55, 15 + bob - (k === 2 ? 2 : 0), sk, 2);
  gc.fillStyle = '#ff6f3c'; gc.fillRect(44.5, 14 + bob, 5, 4);
};
await mkSlot('surf', 'Surfer', [['a', surfer(0)], ['b', surfer(1)], ['c', surfer(2)]], 96, 46, 120, 264);
const glit = (k) => (gc) => {
  for (let i = 0; i < 30; i++) {
    const t = srand(i * 1.7 + k * 31), y = 2 + t * (GH - 4), half = 6 + 28 * (y / GH), x = GW / 2 + (srand(i * 2.3 + k * 13) - 0.5) * 2 * half;
    const r = 0.6 + srand(i * 4.1 + k) * 1.3; circ(gc, x, y, r, 'rgba(255,246,220,' + (0.55 + srand(i + k * 7) * 0.45) + ')');
    if (r > 1.4) { line(gc, x - 3, y, x + 3, y, 'rgba(255,246,220,0.6)', 0.8); }
  }
};
await mkSlot('glit', 'Sun glitter', [['a', glit(0)], ['b', glit(1)], ['c', glit(2)]], GW, GH, GX, GY);
const gulls = (up) => (gc) => {
  const one = (x, y, s) => { gc.beginPath(); gc.moveTo(x - 7 * s, y + (up ? -3 : 2) * s); gc.quadraticCurveTo(x - 3 * s, y + (up ? -5 : -1) * s, x, y); gc.quadraticCurveTo(x + 3 * s, y + (up ? -5 : -1) * s, x + 7 * s, y + (up ? -3 : 2) * s); gc.strokeStyle = '#3a3340'; gc.lineWidth = 1.6; gc.lineCap = 'round'; gc.stroke(); };
  one(10, 9, 1.1); one(28, 5, 0.85);
};
await mkSlot('gull', 'Gulls', [['u', gulls(1)], ['d', gulls(0)]], 40, 16, 250, 150);

globalThis.__GX = GX; globalThis.__GY = GY;
// the preview shows the surfer mid-ride and the motorboat crossing
globalThis.__REFADJ = (ref) => { for (let d = 0; d < 300000; d += 100) { const t = ref + d, s = (t % 30000) / 1000, m = (t % 50000) / 1000; if (s > 17.9 && s < 18.4 && m > 3 && m < 13) return t; } return ref; };
globalThis.__TOP = ['Foreground'];
globalThis.__A = { font: 'Lilita One', size: 100, color: '#6fa3b8', row: [CX, 205, 6], col: true };
globalThis.__G = { Date: ['Weekday', 'Day'], Steps: ['Steps icon', 'Steps'], 'Heart rate': ['Heart rate icon', 'Heart rate'], Battery: ['Battery level', 'Battery'],
  Sea: ['Sun glitter', 'Sailboat far', 'Sailboat', 'Motorboat', 'Surfer', 'Gulls'] };
