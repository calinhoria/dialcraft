// Pixel Beer: an LED-matrix face. Every digit, weekday name and the mug are cells on one 12 px lattice (10 px ink, 2 px gap).
// The time, weekday, day and temperature are native data-bound layers whose pictures are baked pixel glyphs; the scene holds the
// dim lattice dots, the mug and the ground. AOD: the same clock as dim hollow cells.
const fs = require('fs');
// Language: `node gen.js [tag]` sets the project language (default ro-RO). The weekday is a normal text layer drawn in the Pixel Lattice font
// (make_font.py), so changing the layer's Language in the editor redraws the names; Latin scripts only.
const LANG = process.argv[2] || 'ro-RO', DEFAULT = LANG === 'ro-RO', SUF = DEFAULT ? '' : '.' + LANG;
const js = `
const W = dev().w, H = dev().h, C = 12, INK = 10, OX = 3, OY = 6;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const F57 = {
 0: ['01110','10001','10011','10101','11001','10001','01110'], 1: ['00100','01100','00100','00100','00100','00100','01110'],
 2: ['01110','10001','00001','00010','00100','01000','11111'], 3: ['11110','00001','00001','01110','00001','00001','11110'],
 4: ['00010','00110','01010','10010','11111','00010','00010'], 5: ['11111','10000','11110','00001','00001','10001','01110'],
 6: ['00110','01000','10000','11110','10001','10001','01110'], 7: ['11111','00001','00010','00100','01000','01000','01000'],
 8: ['01110','10001','10001','01110','10001','10001','01110'], 9: ['01110','10001','10001','01111','00001','00010','01100'] };
const F35 = {
 0: ['111','101','101','101','111'], 1: ['010','110','010','010','111'], 2: ['111','001','111','100','111'], 3: ['111','001','111','001','111'],
 4: ['101','101','111','001','001'], 5: ['111','100','111','001','111'], 6: ['111','100','111','101','111'], 7: ['111','001','001','001','001'],
 8: ['111','101','111','101','111'], 9: ['111','101','111','001','111'],
 C: ['111','100','100','100','111'], '-': ['000','000','111','000','000'],
 L: ['100','100','100','100','111'], U: ['101','101','101','101','111'], N: ['111','101','101','101','101'], M: ['101','111','111','101','101'],
 A: ['111','101','111','101','101'], R: ['111','101','111','110','101'], I: ['111','010','010','010','111'], E: ['111','100','111','100','111'],
 J: ['001','001','001','101','111'], O: ['111','101','101','101','111'], V: ['101','101','101','101','010'], S: ['111','100','111','001','111'],
 D: ['110','101','101','101','110'], B: ['110','101','110','101','110'], F: ['111','100','110','100','100'], G: ['111','100','101','101','111'],
 H: ['101','101','111','101','101'], K: ['101','101','110','101','101'], P: ['111','101','111','100','100'], Q: ['111','101','101','111','001'],
 T: ['111','010','010','010','010'], W: ['101','101','111','111','101'], X: ['101','101','010','101','101'], Y: ['101','101','010','010','010'], Z: ['111','001','010','100','111'] };
const GOLD = '#e8b030', DIM = '#c58a28', CREAM = '#efe8d0', AODC = '#7a5c20';
const names = [];
const put = (rows, g, x0, y0, color, hollow) => rows.forEach((row, r) => [...row].forEach((b, c) => {
  if (b !== '1') return; const x = x0 + c * C, y = y0 + r * C;
  if (hollow) { g.strokeStyle = color; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, INK - 1, INK - 1); } else { g.fillStyle = color; g.fillRect(x, y, INK, INK); } }));
const img = (name, w, h, fn) => { const c = mk(w, h), g = c.getContext('2d'); fn(g); names.push(addProjectImage(name, c, {}).name); };
const cell = (g, c, r, col) => { g.fillStyle = col; g.fillRect(OX + c * C, OY + r * C, INK, INK); };
const lerp = (a, b, t) => { const h = (s, i) => parseInt(s.slice(i, i + 2), 16); return '#' + [1, 3, 5].map((i) => Math.round(h(a, i) + (h(b, i) - h(a, i)) * t).toString(16).padStart(2, '0')).join(''); };
// scene (0)
img('scene.png', W, H, (g) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  for (let r = 0; r < 37; r++) for (let c = 0; c < 32; c++) if (c % 4 === 3 && r % 4 === 1) cell(g, c, r, '#1d1509');
  const MC = 3, R0 = 18, WALL = '#8eb0c9', FOAM = '#e8e3cc';
  for (let c = 0; c < 9; c++) { cell(g, MC + c, R0 + 1, FOAM); cell(g, MC + c, R0 + 2, FOAM); }
  for (let k = 3; k <= 15; k++) {
    cell(g, MC, R0 + k, WALL); cell(g, MC + 8, R0 + k, WALL);
    for (let c = 1; c <= 7; c++) {
      if (k === 3) { cell(g, MC + c, R0 + k, (c === 2 || c === 3 || c >= 5) ? '#f0a828' : FOAM); continue; }
      cell(g, MC + c, R0 + k, lerp(c === 1 ? '#f6b232' : '#f0a828', c === 1 ? '#cf8420' : '#c27a1c', (k - 4) / 11));
    }
  }
  for (let c = 0; c < 9; c++) cell(g, MC + c, R0 + 16, WALL);
  for (const [c, k] of [[4, 8], [2, 11], [6, 14]]) cell(g, MC + c, R0 + k, '#f2cf6a');
  for (const c of [9, 10]) { cell(g, MC + c, R0 + 6, WALL); cell(g, MC + c, R0 + 12, WALL); }
  for (let k = 7; k <= 11; k++) cell(g, MC + 10, R0 + k, WALL);
  for (let c = 0; c < 32; c++) { cell(g, c, 35, '#6b4423'); cell(g, c, 36, '#4a2e15'); }
});
// time digits: normal (1..10 hour set, 11..20 minute set share the same pictures), colon, AOD digits, AOD colon
const DW = 5 * C, DH = 7 * C;
for (let n = 0; n < 10; n++) img('px/h_' + n + '.png', DW, DH, (g) => put(F57[n].map((s) => s), g, 0, 0, GOLD, false));
img('px/colon.png', 2 * C, DH, (g) => { for (const r of [2, 4]) put(['11'], g, 0, r * C, GOLD, false); });
for (let n = 0; n < 10; n++) img('px/a_' + n + '.png', DW, DH, (g) => put(F57[n], g, 0, 0, AODC, true));
img('px/a_colon.png', 2 * C, DH, (g) => { for (const r of [2, 4]) put(['11'], g, 0, r * C, AODC, true); });
// day digits, temperature digits, unit, minus
for (let n = 0; n < 10; n++) img('px/d_' + n + '.png', 3 * C, 5 * C, (g) => put(F35[n], g, 0, 0, DIM, false));
for (let n = 0; n < 10; n++) img('px/t_' + n + '.png', 3 * C, 5 * C, (g) => put(F35[n], g, 0, 0, CREAM, false));
img('px/unit.png', 6 * C, 5 * C, (g) => { put(['11', '11'], g, 0, 0, CREAM, false); put(F35.C, g, 3 * C, 0, CREAM, false); });
img('fz/bub.png', INK, INK, (g) => { g.fillStyle = '#ffe596'; g.fillRect(0, 0, INK, INK); });
img('fz/foam.png', INK, INK, (g) => { g.fillStyle = '#e8e3cc'; g.fillRect(0, 0, INK, INK); });
img('fz/glint.png', INK, INK, (g) => { g.fillStyle = '#fffdf0'; g.fillRect(0, 0, INK, INK); });
img('fz/blank.png', INK, INK, (g) => {});
img('px/minus.png', 3 * C, 5 * C, (g) => put(F35['-'], g, 0, 0, CREAM, false));
`;
const wrap = (tail) => ({ script: `${js}\nawait loadAllImages();\n${tail}` });
const GS = Number(process.env.GS || 100);
const FONT = fs.readFileSync(__dirname + '/PixelLattice.ttf').toString('base64');
// The Zepp console fixes the appId when the watchface entry is created; the package must carry the same one.
const APP_ID = Number(process.env.APP_ID || 1133666);
const steps = [
  { script: `project.appId = ${APP_ID}; return project.appId` },
  { script: `await registerCustomFont({ name: 'PixelLattice.ttf', family: 'Pixel Lattice', format: 'truetype', ext: '.ttf', dataBase64: '${FONT}' }); return 1` },
  { preset: 'bg' },
  wrap(`const e = await addElement('IMG', { src: names[0] }); e.name = 'Scene'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return names.length`),
  { preset: 'clock' }, { preset: 'weekday' }, { preset: 'day' }, { preset: 'temp' }, { preset: 'clock' },
  { script: `const n = project.elements.length; ['Hour','Colon','Minute'].forEach((nm, i) => { project.elements[n - 3 + i].name = nm + ' Aod'; });
    project.groups = project.groups || {}; let k = 0; for (const e of project.elements) if (/ Aod$/.test(e.name)) { e.group = 'gClockAod'; k++; } project.groups.gClockAod = 'Clock AOD'; return k` },
  { remove: 'Colon Aod' },
  wrap(`
    const E = (n) => project.elements.find((q) => q.name === n);
    const nm = (p, n) => names.slice(names.indexOf('px/' + p + '_0.png'), names.indexOf('px/' + p + '_0.png') + n);
    const by = (p) => names.filter((s) => s.indexOf('px/' + p + '_') === 0 && /_\\d\\.png$/.test(s));
    const hr = names.filter((s) => /px\\/h_\\d\\.png$/.test(s)), ar = names.filter((s) => /px\\/a_\\d\\.png$/.test(s));
    const dd = names.filter((s) => /px\\/d_\\d\\.png$/.test(s)), tt = names.filter((s) => /px\\/t_\\d\\.png$/.test(s));
    const X = (c) => OX + c * C, Y = (r) => OY + r * C;
    for (const [e, set, x] of [[E('Hour'), hr, X(3)], [E('Minute'), hr, X(18)], [E('Hour Aod'), ar, X(3)], [E('Minute Aod'), ar, X(18)]]) { e.glyph = null; e.images = set; e.space = C; e.zero = 1; e.x = x; e.y = Y(5); }
    for (const n of ['Hour', 'Minute']) E(n).show = 'normal';
    for (const n of ['Hour Aod', 'Minute Aod']) E(n).show = 'aod';
    project.elements = project.elements.filter((q) => q.name !== 'Colon');
    const ce = await addElement('IMG', { src: names.find((s) => s === 'px/colon.png') }); ce.name = 'Colon'; ce.src = 'px/colon.png'; ce.x = X(15); ce.y = Y(5); ce.show = 'normal';
    const ca = await addElement('IMG', { src: 'px/a_colon.png' }); ca.name = 'Colon Aod'; ca.src = 'px/a_colon.png'; ca.x = X(15); ca.y = Y(5); ca.show = 'aod'; ca.group = 'gClockAod';
    const w = E('Weekday'); w.x = X(15) - 4; w.y = Y(16) - 4; w.show = 'normal';
    const d = E('Day'); d.glyph = null; d.images = dd; d.space = C; d.zero = 0; d.x = X(15); d.y = Y(23); d.show = 'normal';
    const t = E('Temperature'); t.glyph = null; t.images = tt; t.hSpace = C; t.alignH = 'LEFT'; t.unit = 'px/unit.png'; t.negative = 'px/minus.png'; t.x = X(15); t.y = Y(29); t.show = 'normal';
    project.groups = project.groups || {}; project.groups.gInfo = 'Info'; for (const n of ['Weekday', 'Day', 'Temperature']) E(n).group = 'gInfo';
    return 1`),
  { edit: 'Weekday', set: { labelForm: 'short', labelCase: 'upper', labelAlign: 'left' }, glyph: { font: 'Pixel Lattice', size: GS, weight: 400, fill: 'solid', color: '#c58a28' } },
  wrap(`
    const mkI = async (name, handle, x, y, src) => { const e = await addElement('IMG', { src }); e.name = name; e.src = src; e.handle = handle; e.x = x; e.y = y; e.show = 'normal'; e.group = 'gFizz'; };
    const X = (c) => OX + c * C, Y = (r) => OY + r * C;
    const INIT = [[5, 30], [8, 26], [4, 23], [6, 33], [9, 24], [4, 28], [7, 22], [5, 25], [10, 31]];
    for (let i = 0; i < 9; i++) await mkI('Bubble ' + (i + 1), 'bb' + i, X(INIT[i][0]), Y(INIT[i][1]), 'fz/bub.png');
    for (const [i, c] of [2, 5, 7, 0].entries()) await mkI('Foam bump ' + (i + 1), 'fb' + i, X(3 + c), Y(18), 'fz/foam.png');
    for (const [i, c] of [[4, 19], [6, 20], [7, 19]].entries()) await mkI('Foam glint ' + (i + 1), 'fg' + i, X(3 + c[0]), Y(c[1]), 'fz/glint.png');
    project.groups = project.groups || {}; project.groups.gFizz = 'Beer fizz';
    return 16`),
];
const userCode = `{
  // Bubbles climb the beer one row at a time, bumps of foam come and go on the head, a few foam cells glint. All on the 12 px lattice.
  const C = 12, OX = 3, OY = 6, MC = 3, R0 = 18, MS = 100
  const BUB = [[5, 2.1, 12], [8, 3.0, 4], [4, 1.6, 9], [6, 2.6, 0], [9, 1.9, 15], [4, 2.8, 7], [7, 3.4, 2], [5, 1.4, 5], [10, 2.3, 10]]
  const hash = (a, b) => (Math.imul(a + 1, 73856093) ^ Math.imul(b + 7, 19349663)) >>> 0
  const last = {}
  const put = (k, x, y, src) => {
    const key = x + '|' + y + '|' + src
    if (last[k] === key) return
    last[k] = key
    W[k].setProperty(ui.prop.MORE, { x: pxv(x), y: pxv(y), src: A(src) })
  }
  const tick = () => {
    const now = Date.now() / 1000
    for (let i = 0; i < BUB.length; i++) {
      const b = BUB[i], u = now * b[1] + b[2], pos = Math.floor(u) % 12
      const col = Math.min(10, b[0] + ((Math.floor(u / 5) + i) % 2))
      put('bb' + i, OX + col * C, OY + (33 - pos) * C, 'fz/bub.png')
    }
    const s1 = Math.floor(now / 0.6)
    for (let k = 0; k < 4; k++) {
      const h = hash(s1, k)
      put('fb' + k, OX + (MC + (h >>> 3) % 9) * C, OY + R0 * C, (h & 3) === 0 ? 'fz/blank.png' : 'fz/foam.png')
    }
    const s2 = Math.floor(now / 0.4)
    for (let k = 0; k < 3; k++) {
      const h = hash(s2, k + 11)
      put('fg' + k, OX + (MC + (h >>> 3) % 9) * C, OY + (R0 + 1 + ((h >>> 8) & 1)) * C, (h & 3) === 0 ? 'fz/blank.png' : 'fz/glint.png')
    }
  }
  let id = null
  const safe = () => { try { tick() } catch (e) {} }
  const start = () => { if (id === null) { try { id = setInterval(safe, MS) } catch (e) {} } }
  const stop = () => { if (id !== null) { try { clearInterval(id) } catch (e) {} id = null } }
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: start, pause_call: stop })
  safe()
  start()
}`;
fs.writeFileSync(__dirname + '/recipe' + SUF + '.json', JSON.stringify({ name: 'Pixel Beer', device: 'bip-6', language: LANG, font: 'Inter',
  description: 'An animated LED-matrix face: bubbles rise through the beer, foam bumps come and go and glint. the time, weekday, day and temperature are cells on one pixel lattice, next to a pixel-art beer mug standing on the ground.',
  preview: 'preview' + SUF + '.png', previewAod: 'preview-aod' + SUF + '.png', save: 'project' + SUF, optimizePng: true, build: process.env.BUILD === '1', userCode, out: 'out/pixel-beer' + SUF, steps }, null, 1));
