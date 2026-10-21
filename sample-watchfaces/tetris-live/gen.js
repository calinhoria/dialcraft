const fs = require('fs');
const pre = `
const W = dev().w, H = dev().h;
let seed = 63; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const rgb = (a) => 'rgb(' + a.map((v) => Math.round(clamp(v, 0, 255))).join(',') + ')';
const lite = (s, t) => { const a = hex(s); return rgb(a.map((v) => v + (255 - v) * t)); };
const dark = (s, t) => { const a = hex(s); return rgb(a.map((v) => v * (1 - t))); };
const h2 = (x, y, s) => { const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
// the classic seven colours
const COL = { cyan: '#00d4f0', yellow: '#f8d800', purple: '#b040e0', green: '#34d034', red: '#f03232', blue: '#2c4cf0', orange: '#f88a00' };
const PIECE = { I: 'cyan', O: 'yellow', T: 'purple', S: 'green', Z: 'red', J: 'blue', L: 'orange' };
// a glossy bevelled block
function btile(col, s) {
  const c = mk(s, s), g = c.getContext('2d'), b = Math.max(2, Math.round(s * 0.17)), base = COL[col] || col;
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  const poly = (pts, f) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fillStyle = f; g.fill(); };
  poly([[0, 0], [s, 0], [s - b, b], [b, b]], lite(base, 0.62)); poly([[0, 0], [b, b], [b, s - b], [0, s]], lite(base, 0.32));
  poly([[0, s], [b, s - b], [s - b, s - b], [s, s]], dark(base, 0.5)); poly([[s, 0], [s, s], [s - b, s - b], [s - b, b]], dark(base, 0.3));
  const q = g.createLinearGradient(0, b, 0, s - b); q.addColorStop(0, lite(base, 0.18)); q.addColorStop(1, dark(base, 0.12)); g.fillStyle = q; g.fillRect(b, b, s - 2 * b, s - 2 * b);
  if (s >= 14) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(b + 1, b + 1, Math.max(2, s * 0.22), Math.max(1, s * 0.07)); g.fillRect(b + 1, b + 1, Math.max(1, s * 0.07), Math.max(2, s * 0.22)); }
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, s - 1, s - 1);
  return c;
}
const FONT57 = { 0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], 1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'], 2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'], 3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'], 4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], 5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'], 6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], 7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'], 8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], 9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'] };
const CS = 22, WX = 85, WY = 164, COLS = 10, ROWS = 12;
const LABEL = '700 8px "Press Start 2P", "Courier New", monospace';
// a neon-edged dark panel with a small label tag
const panel = (g, x, y, w, h, col, label) => {
  g.save(); g.shadowColor = col; g.shadowBlur = 8; rr(g, x, y, w, h, 6); g.fillStyle = '#080b22'; g.fill(); g.restore();
  rr(g, x, y, w, h, 6); const q = g.createLinearGradient(0, y, 0, y + h); q.addColorStop(0, '#12183e'); q.addColorStop(1, '#070a1c'); g.fillStyle = q; g.fill();
  rr(g, x + 1, y + 1, w - 2, h - 2, 5); g.strokeStyle = col; g.lineWidth = 2; g.stroke();
  rr(g, x + 3.5, y + 3.5, w - 7, h - 7, 3); g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.stroke();
  if (label) { g.font = LABEL; g.fillStyle = col; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(label, x + 9, y + 12); }
};
`;
const sceneJS = pre + `
try { await document.fonts.load('8px "Press Start 2P"'); } catch (e) {}
const c = mk(W, H), g = c.getContext('2d');
let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#05071a'); gr.addColorStop(0.5, '#0a1040'); gr.addColorStop(1, '#04051a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
// ghost tetrominoes drifting in the background
const SHAPES = { I: [[0, 0], [1, 0], [2, 0], [3, 0]], O: [[0, 0], [1, 0], [0, 1], [1, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]], S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]] };
const keys = Object.keys(SHAPES);
for (let i = 0; i < 26; i++) { const k = keys[i % 7], t = btile(PIECE[k], 14), ox = rnd() * W, oy = rnd() * H, rot = Math.floor(rnd() * 4) * Math.PI / 2; g.save(); g.globalAlpha = 0.11; g.translate(ox, oy); g.rotate(rot); SHAPES[k].forEach(([x, y]) => g.drawImage(t, x * 14, y * 14)); g.restore(); }
for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.15 + rnd() * 0.5) + ')'; g.fillRect(rnd() * W, rnd() * H, 1, 1); }
// readout panels
panel(g, 22, 114, 148, 44, '#00d4f0', 'STEPS'); panel(g, 176, 114, 114, 44, '#f8d800', 'DATE'); panel(g, 296, 114, 72, 44, '#f03232', 'TEMP'); g.fillStyle = '#fff'; g.fillRect(226, 146, 4, 4);
panel(g, 16, 166, 64, 74, '#b040e0', 'NEXT'); rr(g, 24, 186, 48, 46, 3); g.fillStyle = '#04050f'; g.fill();
panel(g, 316, 166, 60, 50, '#2c4cf0', 'DAY'); panel(g, 316, 222, 60, 44, '#34d034', 'LINES');
panel(g, 22, 248, 52, 156, '#f88a00', null);   // ends at y 404: the Bip 6's corner radius is 86 px, a taller card was cut off g.font = LABEL; g.fillStyle = '#f88a00'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BAT', 48, 260);
rr(g, 38, 272, 20, 124, 4); g.fillStyle = '#04050f'; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; g.stroke();
for (let i = 1; i < 10; i++) { g.fillStyle = 'rgba(8,11,34,0.95)'; g.fillRect(38, 272 + i * 12.4 - 1, 20, 2); }
// the well: chrome frame, deep black inside, faint cell grid
g.save(); g.shadowColor = 'rgba(80,120,255,0.5)'; g.shadowBlur = 14; rr(g, WX - 9, WY - 8, COLS * CS + 18, ROWS * CS + 16, 6); g.fillStyle = '#444'; g.fill(); g.restore();
rr(g, WX - 9, WY - 8, COLS * CS + 18, ROWS * CS + 16, 6); gr = g.createLinearGradient(WX - 9, 0, WX + COLS * CS + 9, 0); gr.addColorStop(0, '#6f7690'); gr.addColorStop(0.15, '#f2f5ff'); gr.addColorStop(0.5, '#9aa3c2'); gr.addColorStop(0.85, '#e9edfb'); gr.addColorStop(1, '#5d647e'); g.fillStyle = gr; g.fill();
rr(g, WX - 4, WY - 3, COLS * CS + 8, ROWS * CS + 6, 3); g.fillStyle = '#0a0c20'; g.fill();
g.fillStyle = '#03040b'; g.fillRect(WX, WY, COLS * CS, ROWS * CS);
g.strokeStyle = 'rgba(120,150,255,0.09)'; g.lineWidth = 1; for (let i = 1; i < COLS; i++) { g.beginPath(); g.moveTo(WX + i * CS + 0.5, WY); g.lineTo(WX + i * CS + 0.5, WY + ROWS * CS); g.stroke(); } for (let j = 1; j < ROWS; j++) { g.beginPath(); g.moveTo(WX, WY + j * CS + 0.5); g.lineTo(WX + COLS * CS, WY + j * CS + 0.5); g.stroke(); }
const ish = g.createLinearGradient(0, WY, 0, WY + 20); ish.addColorStop(0, 'rgba(0,0,0,0.7)'); ish.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = ish; g.fillRect(WX, WY, COLS * CS, 20);
names.push(addProjectImage('scene.png', c, {}).name);
`;
const digitsJS = pre + `
const CSZ = 11, DW = 64, DH = 84;   // 11 px blocks: the clock is 290 px wide, clear of the watch's rounded corners
const DCOL = ['cyan', 'yellow', 'purple', 'green', 'red', 'blue', 'orange', 'cyan', 'yellow', 'purple'];
const cache = {}; const T = (c) => cache[c] || (cache[c] = btile(c, CSZ));
for (const part of ['hour', 'minute']) for (let n = 0; n < 10; n++) {
  const c = mk(DW, DH), g = c.getContext('2d'); const col = part === 'hour' ? DCOL[n] : DCOL[(n + 3) % 10];
  FONT57[n].forEach((row, ry) => [...row].forEach((b, rx) => { if (b === '1') { g.save(); g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 4; g.shadowOffsetX = 2; g.shadowOffsetY = 3; g.drawImage(T(col), 4 + rx * CSZ, 2 + ry * CSZ); g.restore(); } }));
  names.push(addProjectImage('blk/' + part + '_' + n + '.png', c, {}).name);
}
{ const c = mk(34, DH), g = c.getContext('2d'); for (const ry of [2, 4]) { g.save(); g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 4; g.shadowOffsetX = 2; g.shadowOffsetY = 3; g.drawImage(T('red'), 10, 2 + ry * CSZ); g.restore(); } names.push(addProjectImage('blk/colon.png', c, {}).name); }
`;
const tilesJS = pre + `
const dissolve = (t, id, tl) => { const c = mk(CS, CS), g = c.getContext('2d'); g.drawImage(tl, 0, 0); const im = g.getImageData(0, 0, CS, CS), d = im.data, thr = t * 1.3; for (let y = 0; y < CS; y++) for (let x = 0; x < CS; x++) { const n = h2(x * 1.7, y * 1.3, id), i = (y * CS + x) * 4; if (n < thr - 0.16) d[i + 3] = 0; else if (n < thr) { const k = (n - (thr - 0.16)) / 0.16; d[i] = 255; d[i + 1] = 200 + 55 * k; d[i + 2] = 120 + 100 * k; d[i + 3] = 255 * (0.5 + 0.5 * k); } } g.putImageData(im, 0, 0); return c; };
Object.keys(COL).forEach((m, mi) => {
  const base = btile(m, CS);
  names.push(addProjectImage('tiles/' + m + '.png', base, {}).name);
  names.push(addProjectImage('tiles/mini_' + m + '.png', btile(m, 12), {}).name);
  const flash = mk(CS, CS), fg = flash.getContext('2d'); fg.drawImage(base, 0, 0); fg.fillStyle = 'rgba(255,255,255,0.7)'; fg.fillRect(0, 0, CS, CS); names.push(addProjectImage('tiles/' + m + '_d0.png', flash, {}).name);
  for (let k = 1; k < 7; k++) names.push(addProjectImage('tiles/' + m + '_d' + k + '.png', dissolve(k / 6.4, mi * 10 + 3, base), {}).name);
});
`;
const demoJS = pre + `
// a still of the game for the editor and the store picture (drawn in Dialcraft only, never exported to the watch face)
const c = mk(W, H), g = c.getContext('2d');
const STK = ['....SS....', '..SSZZ...J', 'L.OOTTT.JJ', 'LLOOTZZ.IJ'];
const put = (ch, cx, cy) => { g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 3; g.drawImage(btile(PIECE[ch], CS), WX + cx * CS, WY + cy * CS); g.restore(); };
STK.forEach((row, ri) => [...row].forEach((ch, ci) => { if (ch !== '.') put(ch, ci, ROWS - 4 + ri); }));
[[4, 3], [3, 4], [4, 4], [5, 4]].forEach(([cx, cy]) => put('T', cx, cy));
[[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([cx, cy]) => g.drawImage(btile('yellow', 12), 36 + cx * 12, 194 + cy * 12));
g.fillStyle = '#ffffff'; g.font = '14px "Press Start 2P", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('12', 346, 247);
names.push(addProjectImage('demo_preview.png', c, {}).name);
`;
const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const F = 'Press Start 2P';
const steps = [{ preset: 'bg' },
  wrap(sceneJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Scene'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  { preset: 'clock' }, { preset: 'steps' }, { preset: 'day' }, { preset: 'month' }, { preset: 'temp' }, { preset: 'weekday' }, { preset: 'clock' },
  { script: `const n = project.elements.length; ['Hour','Colon','Minute'].forEach((nm,i)=>{ project.elements[n-3+i].name = nm + ' Aod'; }); return 1` },
  { remove: 'Colon Aod' },
  wrap(digitsJS, `
    const hr = names.slice(0, 10), mn = names.slice(10, 20), colon = names[20];
    const H1 = project.elements.find((q) => q.name === 'Hour'), M1 = project.elements.find((q) => q.name === 'Minute');
    for (const [e, set, x] of [[H1, hr, 50], [M1, mn, 212]]) { e.glyph = null; e.images = set; e.space = 0; e.zero = 1; e.x = x; e.y = 18; e.show = 'normal'; }
    project.elements = project.elements.filter((q) => q.name !== 'Colon');
    const ce = await addElement('IMG', { src: colon }); ce.name = 'Colon'; ce.src = colon; ce.x = 178; ce.y = 18; ce.show = 'normal'; return 1`),
  { add: 'BAR', name: 'Battery gauge', patch: { dataType: 'BATTERY' }, set: { x: 41, y: 272, length: 124, lineWidth: 14, vertical: true, inversion: true, color: '#34d034', show: 'normal', handle: 'bat' } },
  wrap(tilesJS, `return names.length`),
  wrap(demoJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Demo preview'; e.src = names[0]; e.previewOnly = true; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
];
const val = (size, color) => ({ font: F, size, weight: 400, fill: 'solid', color, shadowColor: '#000000', shadowX: 1, shadowY: 1, shadowBlur: 0 });
steps.push(
  { edit: 'Steps', set: { x: 32, y: 130, alignH: 'LEFT', hSpace: 0 }, glyph: val(14, '#ffffff') },
  { edit: 'Day', set: { x: 186, y: 130, zero: 1, space: -2 }, glyph: val(14, '#ffffff') },
  { edit: 'Month', set: { x: 240, y: 130, zero: 1, space: -2 }, glyph: val(14, '#ffffff') },
  { edit: 'Temperature', set: { x: 304, y: 130, alignH: 'LEFT' }, glyph: val(14, '#ffffff') },
  { edit: 'Weekday', set: { x: 322, y: 188 }, glyph: val(12, '#ffffff') },
  { edit: 'Hour Aod', set: { x: 70, y: 120, show: 'aod', zero: 1 }, glyph: { font: F, size: 90, fill: 'solid', color: '#6a6f8a' } },
  { edit: 'Minute Aod', set: { x: 70, y: 260, show: 'aod', zero: 1 }, glyph: { font: F, size: 90, fill: 'solid', color: '#6a6f8a' } },
);
fs.writeFileSync('recipe.json', JSON.stringify({ name: 'Tetris Live', device: 'bip-6', font: F, description: 'Real Tetris, played live by an AI on the watch, in the classic seven colours: pieces fall, rotate and lock, full rows dissolve and the stack drops. The time is spelled in coloured blocks.', preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', optimizePng: true, out: 'out/tetris-live', userCode: fs.readFileSync('game.js', 'utf8'), steps }, null, 1));
