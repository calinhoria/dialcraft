// Pixel Whiskey: tv-dlna's preview_gifs/whiskey_clock.py as an LED-matrix face for the Bip 6. One 12 px lattice (11 px cell, 1 px gap).
// Time, weekday, day and temperature are native data-bound layers with baked pixel pictures (the weekday is the Pixel Lattice font); the scene is
// the dim dot grid, the wooden bar and the glass; the ice cubes and the glint are one transparent sprite of 8 frames (160 ms); the colon blinks.
// 5 rows of the dot grid were added on top so the 32x32 picture fills the 390x450 screen. AOD: the same clock as dim hollow cells.
const fs = require('fs');
const LANG = process.argv[2] || 'en-US', DEFAULT = LANG === 'en-US', SUF = DEFAULT ? '' : '.' + LANG;
const DATA = fs.readFileSync(__dirname + '/data.json', 'utf8');
const js = `
const D = ${DATA};
const W = dev().w, H = dev().h, C = 12, INK = 11, OX = 3, OY = 3, SH = 5;
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
 8: ['111','101','111','101','111'], 9: ['111','101','111','001','111'], C: ['111','100','100','100','111'], '-': ['000','000','111','000','000'] };
const GOLD = '#ebaf41', COPPER = '#b9732d', CREAM = '#ffe4af', AODC = '#6b5320';
const names = [];
const put = (rows, g, x0, y0, color, hollow) => rows.forEach((row, r) => [...row].forEach((b, c) => {
  if (b !== '1') return; const x = x0 + c * C, y = y0 + r * C;
  if (hollow) { g.strokeStyle = color; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, INK - 1, INK - 1); } else { g.fillStyle = color; g.fillRect(x, y, INK, INK); } }));
const img = (name, w, h, fn) => { const c = mk(w, h), g = c.getContext('2d'); fn(g); names.push(addProjectImage(name, c, {}).name); };
// scene (0): the sky above, then the reference cell for cell
img('scene.png', W, H, (g) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  for (let r = 0; r < SH + 32; r++) for (let c = 0; c < 32; c++) { const ry = r - SH; g.fillStyle = r < SH ? '#' + (((ry % 4) + 4) % 4 === 1 && c % 4 === 1 ? D.grid : D.bg) : '#' + D.scene[ry][c]; g.fillRect(OX + c * C, OY + r * C, INK, INK); }
});
const DW = 5 * C, DH = 7 * C;
for (let n = 0; n < 10; n++) img('px/h_' + n + '.png', DW, DH, (g) => put(F57[n], g, 0, 0, GOLD, false));
img('px/colon.png', 2 * C, DH, (g) => { for (const r of [2, 6]) put(['11'], g, 0, r * C, GOLD, false); });
for (let n = 0; n < 10; n++) img('px/a_' + n + '.png', DW, DH, (g) => put(F57[n], g, 0, 0, AODC, true));
img('px/a_colon.png', 2 * C, DH, (g) => { for (const r of [2, 6]) put(['11'], g, 0, r * C, AODC, true); });
for (let n = 0; n < 10; n++) img('px/d_' + n + '.png', 3 * C, 5 * C, (g) => put(F35[n], g, 0, 0, COPPER, false));
for (let n = 0; n < 10; n++) img('px/t_' + n + '.png', 3 * C, 5 * C, (g) => put(F35[n], g, 0, 0, CREAM, false));
img('px/unit.png', 6 * C, 5 * C, (g) => { put(['11', '11'], g, 0, 0, CREAM, false); put(F35.C, g, 3 * C, 0, CREAM, false); });
img('px/minus.png', 3 * C, 5 * C, (g) => put(F35['-'], g, 0, 0, CREAM, false));
img('fz/blank.png', INK, INK, (g) => {});
// sprites: the cells that change between the 8 frames, on transparent pictures
const BANDS = { gl: [18, 26, 3, 11] };
for (const [k, [r0, r1, c0, c1]] of Object.entries(BANDS)) for (let f = 0; f < 8; f++) img('fz/' + k + '_' + f + '.png', (c1 - c0) * C + INK, (r1 - r0) * C + INK, (g) => {
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const v = D.frames[f][r][c]; if (v) { g.fillStyle = '#' + v; g.fillRect((c - c0) * C, (r - r0) * C, INK, INK); } } });
`;
const wrap = (tail) => ({ script: `${js}\nawait loadAllImages();\n${tail}` });
const GS = Number(process.env.GS || 100);
const FONT = fs.readFileSync(__dirname + '/PixelLattice.ttf').toString('base64');
const APP_ID = Number(process.env.APP_ID || 1133669);
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
    const hr = names.filter((s) => /px\\/h_\\d\\.png$/.test(s)), ar = names.filter((s) => /px\\/a_\\d\\.png$/.test(s));
    const dd = names.filter((s) => /px\\/d_\\d\\.png$/.test(s)), tt = names.filter((s) => /px\\/t_\\d\\.png$/.test(s));
    const X = (c) => OX + c * C, Y = (r) => OY + (r + SH) * C, CW = 16;   // the weekday / day column starts at cell 16 (the reference has 17); the temperature is right-aligned to cell 29 so a 2-digit value stays clear of the corner arc
    for (const [e, set, x] of [[E('Hour'), hr, X(3)], [E('Minute'), hr, X(19)], [E('Hour Aod'), ar, X(3)], [E('Minute Aod'), ar, X(19)]]) { e.glyph = null; e.images = set; e.space = C; e.zero = 1; e.x = x; e.y = Y(2); }
    for (const n of ['Hour', 'Minute']) E(n).show = 'normal';
    for (const n of ['Hour Aod', 'Minute Aod']) E(n).show = 'aod';
    project.elements = project.elements.filter((q) => q.name !== 'Colon');
    const ce = await addElement('IMG', { src: 'px/colon.png' }); ce.name = 'Colon'; ce.src = 'px/colon.png'; ce.handle = 'col'; ce.x = X(15); ce.y = Y(2); ce.show = 'normal';
    const ca = await addElement('IMG', { src: 'px/a_colon.png' }); ca.name = 'Colon Aod'; ca.src = 'px/a_colon.png'; ca.x = X(15); ca.y = Y(2); ca.show = 'aod'; ca.group = 'gClockAod';
    const w = E('Weekday'); w.x = X(CW) - 4; w.y = Y(12) - 15; w.show = 'normal';
    const d = E('Day'); d.glyph = null; d.images = dd; d.space = C; d.zero = 0; d.x = X(CW); d.y = Y(18); d.show = 'normal';
    const t = E('Temperature'); t.glyph = null; t.images = tt; t.hSpace = C; t.alignH = 'RIGHT'; t.unit = 'px/unit.png'; t.negative = 'px/minus.png'; t.x = X(29) + INK - 206; t.y = Y(24); t.show = 'normal';
    project.groups = project.groups || {}; project.groups.gInfo = 'Info'; for (const n of ['Weekday', 'Day', 'Temperature']) E(n).group = 'gInfo';
    return 1`),
  { edit: 'Weekday', set: { labelForm: 'short', labelCase: 'upper', labelAlign: 'left' }, glyph: { font: 'Pixel Lattice', size: GS, weight: 400, fill: 'solid', color: '#b9732d' } },
  wrap(`
    const X = (c) => OX + c * C, Y = (r) => OY + (r + SH) * C;
    const mkI = async (name, handle, x, y, src) => { const e = await addElement('IMG', { src }); e.name = name; e.src = src; e.handle = handle; e.x = x; e.y = y; e.show = 'normal'; e.group = 'gFire'; };
    await mkI('Ice and glint', 'gl', X(3), Y(18), 'fz/gl_0.png');
    project.groups = project.groups || {}; project.groups.gFire = 'Glass';
    // the sprites go right above the scene, under every native layer (their glow cells must not dim the text)
    const fire = ['Ice and glint'].map((n) => project.elements.find((q) => q.name === n));
    const rest = project.elements.filter((q) => !fire.includes(q)), at = rest.findIndex((q) => q.name === 'Scene') + 1;
    project.elements = rest.slice(0, at).concat(fire, rest.slice(at));
    return 1`),
];
const userCode = `{
  // 8 frames of 160 ms as in the reference: the ice cubes bob and a glint slides across the whiskey; the colon blinks (on for the first 4 frames).
  const C = 12, OX = 3, OY = 3, SH = 5, MS = 80
  const X = (c) => OX + c * C, Y = (r) => OY + (r + SH) * C
  const last = {}
  const put = (k, x, y, src) => {
    const key = x + '|' + y + '|' + src
    if (last[k] === key) return
    last[k] = key
    W[k].setProperty(ui.prop.MORE, { x: pxv(x), y: pxv(y), src: A(src) })
  }
  const tick = () => {
    const f = Math.floor(Date.now() / 160) % 8
    put('gl', X(3), Y(18), 'fz/gl_' + f + '.png')
    put('col', X(15), Y(2), f < 4 ? 'px/colon.png' : 'fz/blank.png')
  }
  let id = null
  const safe = () => { try { tick() } catch (e) {} }
  const start = () => { if (id === null) { try { id = setInterval(safe, MS) } catch (e) {} } }
  const stop = () => { if (id !== null) { try { clearInterval(id) } catch (e) {} id = null } }
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: start, pause_call: stop })
  safe()
  start()
}`;
fs.writeFileSync(__dirname + '/recipe' + SUF + '.json', JSON.stringify({ name: 'Pixel Whiskey', device: 'bip-6', language: LANG, font: 'Inter',
  description: 'An animated LED-matrix whiskey: ice cubes bob in a rocks glass on a wooden bar and a glint slides across the whiskey while the colon blinks. The time, weekday, day and temperature are cells on the same pixel lattice.',
  preview: 'preview' + SUF + '.png', previewAod: 'preview-aod' + SUF + '.png', save: 'project' + SUF, optimizePng: true, build: process.env.BUILD === '1', userCode, out: 'out/pixel-whiskey' + SUF, steps }, null, 1));
