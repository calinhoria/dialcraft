const fs = require('fs');
const pre = `
const W = dev().w, H = dev().h;
let seed = 63; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const h2 = (x, y, s) => { const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
const vn = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return (h2(xi, yi, s) * (1 - u) + h2(xi + 1, yi, s) * u) * (1 - v) + (h2(xi, yi + 1, s) * (1 - u) + h2(xi + 1, yi + 1, s) * u) * v; };
const fbm = (x, y, s) => 0.55 * vn(x, y, s) + 0.3 * vn(x * 2.1, y * 2.1, s + 5) + 0.15 * vn(x * 4.3, y * 4.3, s + 9);
const MAT = {
  steel: { a: '#d8dde5', b: '#868c97' }, copper: { a: '#e8a373', b: '#94491f' }, rust: { a: '#5a3422', b: '#b9622a' },
  oak: { a: '#d6a766', b: '#a67638' }, walnut: { a: '#7d5535', b: '#40271a' }, concrete: { a: '#7b7e82', b: '#5f6266' }, lime: { a: '#c4c1b8', b: '#a29f96' },
};
const PIECE = { I: 'steel', O: 'oak', T: 'concrete', S: 'copper', Z: 'rust', J: 'walnut', L: 'lime' };
// one square tile of a real material: procedural texture, bevelled edge, rivets or a knot where it fits
function tile(mat, s) {
  const c = mk(s, s), g = c.getContext('2d'), id = g.createImageData(s, s), d = id.data, sd = rnd() * 900, m = MAT[mat], A = hex(m.a), B = hex(m.b), bw = s >= 18 ? 2 : 1;
  const ox = rnd() * 40, oy = rnd() * 40;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    let col, f = 1; const X = x + ox, Y = y + oy;
    if (mat === 'steel' || mat === 'copper') {
      col = lerp3(A, B, y / s * 0.9 + 0.05); f = 1 + (h2(0, Y, sd) - 0.5) * 0.26 + (h2(X * 0.25, Y, sd + 3) - 0.5) * 0.1;
      if (mat === 'copper' && fbm(X * 0.12, Y * 0.12, sd) > 0.7) { col = lerp3(col, hex('#4aa58a'), 0.55); }
    } else if (mat === 'rust') {
      const t = clamp((fbm(X * 0.22, Y * 0.22, sd) - 0.35) * 2.2, 0, 1); col = lerp3(A, B, t); f = 1 + (h2(X, Y, sd) - 0.5) * 0.3; if (h2(X, Y, sd + 8) > 0.965) f *= 0.45;
    } else if (mat === 'oak' || mat === 'walnut') {
      const gr = Math.sin((Y * 0.95 + 5 * fbm(X * 0.07, Y * 0.25, sd)) * 2.3); col = lerp3(A, B, clamp(0.5 + 0.5 * gr * 0.9, 0, 1) * 0.7 + (y / s) * 0.15); f = 1 + (h2(X * 0.1, Y * 2, sd) - 0.5) * 0.1;
    } else {
      const blot = fbm(X * 0.14, Y * 0.14, sd); col = lerp3(A, B, clamp(blot * 1.3 - 0.2, 0, 1)); f = 1 + (h2(X, Y, sd) - 0.5) * 0.3;
      const hh = h2(X, Y, sd + 11); if (hh > 0.985) f *= 0.4; else if (hh < 0.012) f *= 1.35;
    }
    const e = Math.min(x, y, s - 1 - x, s - 1 - y);
    if (e < bw) { if (y < bw || x < bw) f *= (y < x ? 1.34 : 1.2); if (y >= s - bw || x >= s - bw) f *= (y > x ? 0.55 : 0.66); }
    else if (e < bw + 1) f *= 0.93;
    const i = (y * s + x) * 4; d[i] = clamp(col[0] * f, 0, 255); d[i + 1] = clamp(col[1] * f, 0, 255); d[i + 2] = clamp(col[2] * f, 0, 255); d[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  if (s >= 18 && (mat === 'steel' || mat === 'rust' || mat === 'copper')) for (const [rx, ry] of [[4.5, 4.5], [s - 5.5, 4.5], [4.5, s - 5.5], [s - 5.5, s - 5.5]]) { g.beginPath(); g.arc(rx, ry, 1.7, 0, 7); const q = g.createRadialGradient(rx - 0.5, ry - 0.5, 0.2, rx, ry, 1.8); q.addColorStop(0, 'rgba(255,255,255,0.9)'); q.addColorStop(1, 'rgba(40,40,45,0.9)'); g.fillStyle = q; g.fill(); }
  if (s >= 18 && (mat === 'oak' || mat === 'walnut') && rnd() < 0.35) { const kx = 5 + rnd() * (s - 10), ky = 5 + rnd() * (s - 10); for (let r = 3; r > 0; r--) { g.beginPath(); g.ellipse(kx, ky, r * 1.6, r, 0, 0, 7); g.strokeStyle = 'rgba(40,20,5,' + (0.45 - r * 0.08) + ')'; g.lineWidth = 0.8; g.stroke(); } }
  return c;
}
const FONT57 = { 0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], 1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'], 2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'], 3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'], 4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], 5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'], 6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], 7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'], 8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], 9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'] };
const CS = 22, WX = 85, WY = 164, COLS = 10, ROWS = 12;      // the well: cell size and origin
const STACK = ['...SS.....', '..SS.....J', 'L.OOTT..JJ', 'LLOOTZZ.IJ'];   // the four bottom rows, top to bottom
`;
const sceneJS = pre + `
try { await document.fonts.load('26px "Barlow Condensed"'); } catch (e) {}
const c = mk(W, H), g = c.getContext('2d'), id = g.createImageData(W, H), d = id.data;
// board-formed concrete wall
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const base = 92 - (y / H) * 22, bl = fbm(x * 0.03, y * 0.03, 3), fine = h2(x, y, 7); let v = base + (bl - 0.5) * 34 + (fine - 0.5) * 22; const board = y % 64; if (board < 2) v -= 28; else if (board < 3) v += 10; if (h2(x, y, 19) > 0.992) v -= 40; const i = (y * W + x) * 4; d[i] = clamp(v * 1.0, 0, 255); d[i + 1] = clamp(v * 1.01, 0, 255); d[i + 2] = clamp(v * 1.04, 0, 255); d[i + 3] = 255; }
g.putImageData(id, 0, 0);
for (const y of [32, 96, 160, 224, 288, 352, 416]) for (const x of [34, 195, 356]) { g.beginPath(); g.arc(x, y + 31, 4.2, 0, 7); g.fillStyle = 'rgba(20,20,22,0.7)'; g.fill(); g.beginPath(); g.arc(x, y + 31.8, 4.2, 0.1, 3.0); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; g.stroke(); }
const gr0 = g.createRadialGradient(195, 120, 20, 195, 240, 330); gr0.addColorStop(0, 'rgba(255,240,215,0.1)'); gr0.addColorStop(1, 'rgba(0,0,0,0.38)'); g.fillStyle = gr0; g.fillRect(0, 0, W, H);
// brushed steel plates helper
const plate = (x, y, w, h, mat) => { const t = mk(w, h), tg = t.getContext('2d'), id2 = tg.createImageData(w, h), dd = id2.data, A = hex(MAT[mat].a), B = hex(MAT[mat].b), sd = rnd() * 99; for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const col = lerp3(A, B, yy / h * 0.8), f = 1 + (h2(0, yy, sd) - 0.5) * 0.22 + (h2(xx * 0.2, yy, sd + 2) - 0.5) * 0.08, e = Math.min(xx, yy, w - 1 - xx, h - 1 - yy); let ff = f; if (e < 2) ff *= (yy < 2 || xx < 2) ? 1.3 : 0.6; const i = (yy * w + xx) * 4; dd[i] = clamp(col[0] * ff, 0, 255); dd[i + 1] = clamp(col[1] * ff, 0, 255); dd[i + 2] = clamp(col[2] * ff, 0, 255); dd[i + 3] = 255; } tg.putImageData(id2, 0, 0);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 7; g.shadowOffsetX = 2; g.shadowOffsetY = 4; rr(g, x, y, w, h, 3); g.fillStyle = '#444'; g.fill(); g.restore(); g.save(); rr(g, x, y, w, h, 3); g.clip(); g.drawImage(t, x, y); g.restore();
  for (const [rx, ry] of [[x + 5, y + 5], [x + w - 5, y + 5], [x + 5, y + h - 5], [x + w - 5, y + h - 5]]) { g.beginPath(); g.arc(rx, ry, 2, 0, 7); const q = g.createRadialGradient(rx - 0.6, ry - 0.6, 0.2, rx, ry, 2.2); q.addColorStop(0, '#fff'); q.addColorStop(1, '#5a5f68'); g.fillStyle = q; g.fill(); } };
plate(26, 122, 146, 32, 'steel'); plate(178, 122, 112, 32, 'steel'); plate(296, 122, 70, 32, 'steel');
plate(318, 168, 56, 48, 'steel'); plate(18, 168, 60, 66, 'steel');
// next-piece window (left)
rr(g, 24, 186, 48, 40, 3); g.fillStyle = '#16171a'; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 2; g.stroke();
g.fillStyle = '#2a2b2e'; g.font = '700 9px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('NEXT', 48, 177);
for (const [cx, cy, m] of [[0, 0, 'oak'], [1, 0, 'oak'], [0, 1, 'oak'], [1, 1, 'oak']]) g.drawImage(tile(m, 14), 34 + cx * 14, 190 + cy * 14);
// right channel plate engraving
g.fillStyle = '#2a2b2e'; g.fillText('DAY', 346, 177); g.fillStyle = '#1b1d21'; g.fillRect(220, 145, 3, 3);
// gauge slot (battery) on the left
g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 6; g.shadowOffsetY = 3; rr(g, 30, 250, 36, 180, 5); g.fillStyle = '#6c717b'; g.fill(); g.restore();
rr(g, 38, 262, 20, 156, 4); g.fillStyle = '#0c0d0f'; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 1.5; g.stroke();
g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1; for (let i = 0; i <= 10; i++) { const y = 262 + i * 15.6; g.beginPath(); g.moveTo(63, y); g.lineTo(i % 5 ? 66 : 69, y); g.stroke(); }
g.fillStyle = '#2a2b2e'; g.fillText('BAT', 48, 242);
// well: steel frame, dark concrete back wall, faint cell grid
g.save(); g.shadowColor = 'rgba(0,0,0,0.65)'; g.shadowBlur = 12; g.shadowOffsetY = 5; rr(g, WX - 9, WY - 8, COLS * CS + 18, ROWS * CS + 16, 6); g.fillStyle = '#444'; g.fill(); g.restore();
{ const w = COLS * CS + 18, h = ROWS * CS + 16, t = mk(w, h), tg = t.getContext('2d'), id3 = tg.createImageData(w, h), dd = id3.data, A = hex(MAT.steel.a), B = hex(MAT.steel.b); for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const col = lerp3(A, B, yy / h * 0.8), f = 1 + (h2(0, yy, 4) - 0.5) * 0.24, i = (yy * w + xx) * 4; dd[i] = clamp(col[0] * f, 0, 255); dd[i + 1] = clamp(col[1] * f, 0, 255); dd[i + 2] = clamp(col[2] * f, 0, 255); dd[i + 3] = 255; } tg.putImageData(id3, 0, 0); g.save(); rr(g, WX - 9, WY - 8, w, h, 6); g.clip(); g.drawImage(t, WX - 9, WY - 8); g.restore(); }
for (let i = 0; i < 6; i++) for (const sx of [WX - 4.5, WX + COLS * CS + 4.5]) { const ry = WY + 8 + i * 50; g.beginPath(); g.arc(sx, ry, 2.2, 0, 7); const q = g.createRadialGradient(sx - 0.7, ry - 0.7, 0.2, sx, ry, 2.4); q.addColorStop(0, '#fff'); q.addColorStop(1, '#4a4f58'); g.fillStyle = q; g.fill(); }
g.fillStyle = '#17181b'; g.fillRect(WX, WY, COLS * CS, ROWS * CS);
const wall = g.createLinearGradient(0, WY, 0, WY + ROWS * CS); wall.addColorStop(0, '#202125'); wall.addColorStop(1, '#101113'); g.fillStyle = wall; g.fillRect(WX, WY, COLS * CS, ROWS * CS);
for (let i = 0; i < 1400; i++) { g.fillStyle = 'rgba(' + (rnd() > 0.5 ? '255,255,255' : '0,0,0') + ',' + (0.03 + rnd() * 0.05) + ')'; g.fillRect(WX + rnd() * COLS * CS, WY + rnd() * ROWS * CS, 1, 1); }
g.strokeStyle = 'rgba(255,255,255,0.045)'; g.lineWidth = 1; for (let i = 1; i < COLS; i++) { g.beginPath(); g.moveTo(WX + i * CS + 0.5, WY); g.lineTo(WX + i * CS + 0.5, WY + ROWS * CS); g.stroke(); } for (let j = 1; j < ROWS; j++) { g.beginPath(); g.moveTo(WX, WY + j * CS + 0.5); g.lineTo(WX + COLS * CS, WY + j * CS + 0.5); g.stroke(); }
// inner shadow at the top of the well
const ish = g.createLinearGradient(0, WY, 0, WY + 22); ish.addColorStop(0, 'rgba(0,0,0,0.55)'); ish.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = ish; g.fillRect(WX, WY, COLS * CS, 22);
names.push(addProjectImage('scene.png', c, {}).name);
`;
const digitsJS = pre + `
const CSZ = 13, DW = 74, DH = 98;
const mats = { hour: ['oak', 'oak', 'oak', 'walnut'], minute: ['steel', 'steel', 'steel', 'steel', 'steel', 'copper'] };
for (const part of ['hour', 'minute']) for (let n = 0; n < 10; n++) {
  const c = mk(DW, DH), g = c.getContext('2d'); FONT57[n].forEach((row, ry) => [...row].forEach((b, rx) => { if (b !== '1') return; const m = mats[part][Math.floor(rnd() * mats[part].length)]; g.save(); g.shadowColor = 'rgba(0,0,0,0.65)'; g.shadowBlur = 5; g.shadowOffsetX = 2; g.shadowOffsetY = 3; g.drawImage(tile(m, CSZ), 4 + rx * CSZ, 2 + ry * CSZ); g.restore(); }));
  names.push(addProjectImage('blk/' + part + '_' + n + '.png', c, {}).name);
}
{ const c = mk(34, DH), g = c.getContext('2d'); for (const ry of [2, 4]) { g.save(); g.shadowColor = 'rgba(0,0,0,0.65)'; g.shadowBlur = 5; g.shadowOffsetX = 2; g.shadowOffsetY = 3; g.drawImage(tile('copper', CSZ), 10, 2 + ry * CSZ); g.restore(); } names.push(addProjectImage('blk/colon.png', c, {}).name); }
`;
const fallJS = pre + `
const FW = COLS * CS, FH = ROWS * CS;
const SH = { I_h: [[0, 0], [1, 0], [2, 0], [3, 0]], I_v: [[0, 0], [0, 1], [0, 2], [0, 3]], O: [[0, 0], [1, 0], [0, 1], [1, 1]] };
const board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
const frames = [];
let uid = 1;
const cellsNow = () => { const out = []; for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (board[r][c]) out.push({ r, c, cell: board[r][c], dy: 0 }); return out; };
const collide = (shape, x, y) => SH[shape].some(([dx, dy]) => { const c = x + dx, r = y + dy; return c < 0 || c >= COLS || r >= ROWS || (r >= 0 && board[r][c]); });
const landY = (shape, x, y) => { while (!collide(shape, x, y + 1)) y++; return y; };
let mark = 0;
function dropPiece(mat, shape, x, y, rotAt, targetX) {
  const tiles = Array.from({ length: 4 }, () => tile(mat, CS));
  const push = (flash) => frames.push({ cells: cellsNow(), piece: { shape, x, y, tiles, flash } });
  if (rotAt != null) { while (y < rotAt) { push(); y++; } shape = 'I_h'; x -= 1; y += 1; }
  while (x !== targetX) { push(); x += Math.sign(targetX - x); y++; }
  const ly = landY(shape, x, y);
  while (y < ly) { push(); y = Math.min(y + (y < 3 ? 1 : 2), ly); }
  push();
  push(true);
  SH[shape].forEach(([dx, dy], i) => { board[y + dy][x + dx] = { id: uid++, tile: tiles[i] }; });
}
function clearFullRows() {
  const full = []; for (let r = 0; r < ROWS; r++) if (board[r].every(Boolean)) full.push(r);
  if (!full.length) return;
  const bright = () => cellsNow().map((o) => full.includes(o.r) ? { ...o, flash: true } : o);
  frames.push({ cells: bright() });
  const T = 8;
  for (let i = 1; i <= T; i++) frames.push({ cells: cellsNow().map((o) => full.includes(o.r) ? { ...o, dis: i / T } : o), sparks: { rows: full, t: i / T } });
  for (const r of full) for (let c = 0; c < COLS; c++) board[r][c] = null;
  // what sat above the cleared rows drops down, first halfway, then onto the stack
  for (const r of full) {
    frames.push({ cells: cellsNow().map((o) => o.r < r ? { ...o, dy: 0.5 } : o) });
    for (let rr = r - 1; rr >= 0; rr--) for (let c = 0; c < COLS; c++) { board[rr + 1][c] = board[rr][c]; board[rr][c] = null; }
  }
}
const piece = (mat, shape, x, y, rotAt, tx) => { dropPiece(mat, shape, x, y, rotAt, tx); clearFullRows(); };
piece('steel', 'I_v', 4, -4, 1, 0);
piece('oak', 'O', 4, -2, null, 4);
mark = frames.length;   // the animation starts here, so the still preview shows a stack
piece('copper', 'I_h', 3, -1, null, 6);
piece('concrete', 'I_v', 2, -4, 1, 0);
piece('rust', 'I_h', 3, -1, null, 6);
for (let i = 0; i < 4; i++) frames.push({ cells: cellsNow() });
const dissolve = (t, id, tl) => { const c = mk(CS, CS), g = c.getContext('2d'); g.drawImage(tl, 0, 0); const im = g.getImageData(0, 0, CS, CS), d = im.data, thr = t * 1.3; for (let y = 0; y < CS; y++) for (let x = 0; x < CS; x++) { const n = h2(x * 1.7, y * 1.3, id), i = (y * CS + x) * 4; if (n < thr - 0.16) d[i + 3] = 0; else if (n < thr) { const k = (n - (thr - 0.16)) / 0.16; d[i] = 255; d[i + 1] = 150 + 90 * k; d[i + 2] = 60 + 60 * k; d[i + 3] = 255 * (0.4 + 0.6 * k); } } g.putImageData(im, 0, 0); return c; };
const order = frames.map((_, i) => (i + mark) % frames.length);
order.forEach((fi, k) => {
  const f = frames[fi], c = mk(FW, FH), g = c.getContext('2d');
  const put = (tl, x, y, flash) => { g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 5; g.shadowOffsetY = 2; g.drawImage(tl, x, y); g.restore(); if (flash) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x, y, CS, CS); } };
  for (const o of f.cells) { const x = o.c * CS, y = (o.r + (o.dy || 0)) * CS; if (o.dis != null) { g.drawImage(dissolve(o.dis, o.cell.id, o.cell.tile), x, y); } else put(o.cell.tile, x, y, o.flash); }
  if (f.piece) SH[f.piece.shape].forEach(([dx, dy], i) => { const x = (f.piece.x + dx) * CS, y = (f.piece.y + dy) * CS; if (y > -CS) put(f.piece.tiles[i], x, y, f.piece.flash); });
  if (f.sparks) for (const r of f.sparks.rows) for (let i = 0; i < 46; i++) { const sx = (i / 46) * FW + h2(i, 3, 5) * 8, sy0 = r * CS + h2(i, 9, 7) * CS, t = f.sparks.t, y = sy0 - t * (20 + h2(i, 4, 2) * 40), x = sx + (h2(i, 6, 1) - 0.5) * 24 * t, a = Math.max(0, 1 - t) * (0.4 + 0.6 * h2(i, 8, 3)); g.fillStyle = h2(i, 1, 1) > 0.5 ? 'rgba(255,200,110,' + a + ')' : 'rgba(190,190,190,' + a * 0.8 + ')'; g.fillRect(x, y, 1.5 + h2(i, 2, 2) * 2, 1.5 + h2(i, 2, 8) * 2); }
  names.push(addProjectImage('anim/fall_' + k + '.png', c, {}).name);
});
`;
const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const F = 'Barlow Condensed';
const steps = [{ preset: 'bg' },
  wrap(sceneJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Scene'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  { preset: 'clock' }, { preset: 'steps' }, { preset: 'day' }, { preset: 'month' }, { preset: 'temp' }, { preset: 'weekday' }, { preset: 'clock' },
  { script: `const n = project.elements.length; ['Hour','Colon','Minute'].forEach((nm,i)=>{ project.elements[n-3+i].name = nm + ' Aod'; }); return 1` },
  { remove: 'Colon Aod' },
  wrap(digitsJS, `
    const hr = names.slice(0, 10), mn = names.slice(10, 20), colon = names[20];
    const H1 = project.elements.find((q) => q.name === 'Hour'), M1 = project.elements.find((q) => q.name === 'Minute');
    for (const [e, set, x] of [[H1, hr, 22], [M1, mn, 222]]) { e.glyph = null; e.images = set; e.space = 0; e.zero = 1; e.x = x; e.y = 22; e.show = 'normal'; }
    project.elements = project.elements.filter((q) => q.name !== 'Colon');
    const ce = await addElement('IMG', { src: colon }); ce.name = 'Colon'; ce.src = colon; ce.x = 172; ce.y = 22; ce.show = 'normal'; return 1`),
  { add: 'BAR', name: 'Battery gauge', patch: { dataType: 'BATTERY' }, set: { x: 48, y: 262, length: 156, lineWidth: 14, vertical: true, inversion: true, color: '#ffb02e', show: 'normal' } },
  wrap(fallJS, `const e = await addElement('IMG_ANIM', { frames: names, fps: 10, animPrefix: 'fall', repeat: 0 }); e.name = 'Falling piece'; e.frames = names; e.x = 85; e.y = 164; e.show = 'normal'; return names.length`),
];
const ink = (size, color, extra) => ({ font: F, size, weight: 700, fill: 'solid', color, shadowColor: '#e8ecf2', shadowX: 0, shadowY: 1, shadowBlur: 0, ...extra });
steps.push(
  { edit: 'Steps', set: { x: 34, y: 126, alignH: 'LEFT' }, glyph: ink(26, '#1b1d21') },
  { edit: 'Day', set: { x: 184, y: 126, zero: 1, space: -2 }, glyph: ink(26, '#1b1d21') },
  { edit: 'Month', set: { x: 228, y: 126, zero: 1, space: -2 }, glyph: ink(26, '#1b1d21') },
  { edit: 'Temperature', set: { x: 304, y: 126, alignH: 'LEFT' }, glyph: ink(26, '#1b1d21') },
  { edit: 'Weekday', set: { x: 324, y: 186 }, glyph: ink(22, '#1b1d21') },
  { edit: 'Hour Aod', set: { x: 70, y: 120, show: 'aod', zero: 1 }, glyph: { font: F, size: 150, weight: 700, fill: 'solid', color: '#80858c' } },
  { edit: 'Minute Aod', set: { x: 70, y: 260, show: 'aod', zero: 1 }, glyph: { font: F, size: 150, weight: 700, fill: 'solid', color: '#80858c' } },
);
fs.writeFileSync('recipe.json', JSON.stringify({ name: 'Block Stack', device: 'bip-6', font: F, description: 'Falling blocks, built from real materials: the time is spelled in oak, walnut, brushed steel and copper blocks on a board-formed concrete wall, with a steel-framed well where a walnut piece keeps landing on a stack of metal, wood and concrete.', preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', optimizePng: true, out: 'out/block-stack', steps }, null, 1));
