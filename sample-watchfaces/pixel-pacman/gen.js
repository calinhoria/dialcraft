// Pixel Pacman: tv-dlna's preview_gifs/pacman_clock.py as an LED-matrix face for the Bip 6. Pac-Man chews through the time, the digits regrow
// behind him (green sprout, then white) and every so often a ghost steals a pixel from the first 8 of the time. 12 px lattice, 11 px cells.
// The time is native (white 5x7 digit pictures). Black "cover" cells hide the eaten part, green sprout pictures sit on the digit pixels that
// are growing back (they depend on the digit, so there is one small picture per digit / phase), Pac-Man and the ghost are sprites.
// The whole timeline is the reference's, frame for frame (100 ms), computed from Date.now() and the real time.
const fs = require('fs');
const WHITE = '#ebebeb', SPROUT = '#46ff82', YELLOW = '#ffdc00', RED = '#ff2828', WALL = '#1e28c8', PUPIL = '#0000ff', AODC = '#5a5a5a';
const C = 12, INK = 11, OX = 3, OY = 3, GY = 12, PCY = 15;
const REACH = { 0: 3, 1: 3, 2: 2, 3: 1 };
const F57 = {
 0: ['01110','10001','10011','10101','11001','10001','01110'], 1: ['00100','01100','00100','00100','00100','00100','01110'],
 2: ['01110','10001','00001','00010','00100','01000','11111'], 3: ['11110','00001','00001','01110','00001','00001','11110'],
 4: ['00010','00110','01010','10010','11111','00010','00010'], 5: ['11111','10000','11110','00001','00001','10001','01110'],
 6: ['00110','01000','10000','11110','10001','10001','01110'], 7: ['11111','00001','00010','00100','01000','01000','01000'],
 8: ['01110','10001','10001','01110','10001','10001','01110'], 9: ['01110','10001','10001','01111','00001','00010','01100'] };
const COLON = ['00', '11', '11', '00', '11', '11', '00'];
const DX = [3, 9, 18, 24], CX0 = 15;
// ---- pictures as cell lists, de-duplicated by content: pic(cells[[c,r,color]], wCells, hCells) -> name
const pics = {}; let npic = 0;
const pic = (prefix, cells, w, h) => { if (!cells.length) return ''; const key = prefix + w + 'x' + h + JSON.stringify(cells); if (!pics[key]) pics[key] = { name: prefix + '/' + (npic++) + '.png', cells, w, h }; return pics[key].name; };
const dither = (x, y) => (x * 3 + y * 5) % 4;
// the cover: cells of the digit band that are eaten (black) for pac-man's centre cx
const CV = [];
for (let cx = -4; cx <= 40; cx++) { const cells = []; for (let y = GY; y < GY + 7; y++) for (let x = 3; x < 30; x++) { if (x > cx + REACH[Math.abs(y - PCY)]) continue; if (cx - x - 4 < dither(x, y)) cells.push([x - 3, y - GY, '#000']); } CV.push(pic('cv', cells, 27, 7)); }
// the sprouts: green cells of a glyph at x0 (only x0 mod 4 matters), by cx - x0
const sprouts = (rows, x0, cx) => { const cells = []; rows.forEach((row, r) => [...row].forEach((b, c) => { const x = x0 + c, y = GY + r; if (b !== '1' || x > cx + REACH[Math.abs(y - PCY)]) return; const t = cx - x - 4, d = dither(x, y); if (t >= d && t < d + 2) cells.push([c, r, SPROUT]); })); return cells; };
const G = {};   // G[glyph][m][rel] = picture
for (const [k, rows, w] of [...Object.keys(F57).map((v) => [v, F57[v], 5]), ['c', COLON, 2]]) { G[k] = {}; for (let m = 0; m < 4; m++) { G[k][m] = {}; for (let rel = -9; rel <= 14; rel++) { const n = pic('sp', sprouts(rows, m + 8, rel + m + 8), w, 7); if (n) G[k][m][rel] = n; } } }
// pac-man (3 mouths) and the ghost (looks x feet), each also clipped at the screen edges
const pac = (m) => { const cells = []; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { if (dx * dx + dy * dy > 10) continue; if (m === 2 && dx > 0 && Math.abs(dy) <= dx) continue; if (m === 1 && dx > 0 && Math.abs(dy) * 2 <= dx) continue; cells.push([dx + 3, dy + 3, (dx === 0 && dy === -2) ? '#000' : YELLOW]); } return cells; };
const GH = ['0011100', '0111110', '1111111', '1111111', '1111111', '1111111'], FEET = ['1101011', '1011101'];
const ghost = (look, foot) => { const cells = []; [...GH, FEET[foot]].forEach((row, y) => [...row].forEach((b, x) => { if (b === '1') cells.push([x, y, RED]); })); for (const ex of [1, 4]) for (const dx of [0, 1]) for (const dy of [0, 1]) cells.push([ex + dx, 2 + dy, WHITE]); for (const [x, y] of (look === 'l' ? [[1, 3], [4, 3]] : [[2, 2], [5, 2]])) cells.push([x, y, PUPIL]); return cells; };
const clip = (cells, a, b) => cells.filter(([c]) => c >= a && c < b).map(([c, r, k]) => [c - a, r, k]);
const SP = { pac: [0, 1, 2].map((m) => ({})), gh: {} };
const PAC = [0, 1, 2].map((m) => { const o = {}; for (let a = 0; a < 7; a++) for (let b = a + 1; b <= 7; b++) if (a === 0 || b === 7) o[a + '_' + b] = pic('pc', clip(pac(m), a, b), b - a, 7); return o; });
const GHO = {}; for (const look of ['l', 'u']) for (const foot of [0, 1]) { const o = {}; for (let a = 0; a < 7; a++) for (let b = a + 1; b <= 7; b++) if (a === 0 || b === 7) o[a + '_' + b] = pic('gh', clip(ghost(look, foot), a, b), b - a, 7); GHO[look + foot] = o; }
const STOLEN = pic('st', [[0, 0, '#000']], 1, 1), FPY = pic('fp', [[0, 0, YELLOW]], 1, 1), FPW = pic('fp', [[0, 0, WHITE]], 1, 1);
const MAP = { CV, G, PAC, GHO, STOLEN, FPY, FPW, DX, CX0 };
const js = `
const W = dev().w, H = dev().h, C = ${C}, INK = ${INK}, OX = ${OX}, OY = ${OY};
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const F57 = ${JSON.stringify(F57)};
const names = [];
const put = (rows, g, x0, y0, color, hollow) => rows.forEach((row, r) => [...row].forEach((b, c) => {
  if (b !== '1') return; const x = x0 + c * C, y = y0 + r * C;
  if (hollow) { g.strokeStyle = color; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, ${INK} - 1, ${INK} - 1); } else { g.fillStyle = color; g.fillRect(x, y, ${INK}, ${INK}); } }));
const img = (name, w, h, fn) => { const c = mk(w, h), g = c.getContext('2d'); fn(g); names.push(addProjectImage(name, c, {}).name); };
img('scene.png', W, H, (g) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.fillStyle = '${WALL}'; for (const r of [8, 28]) for (let c = 2; c < 30; c++) g.fillRect(OX + c * C, OY + r * C, INK, INK);
});
const DW = 5 * C, DH = 7 * C;
for (let n = 0; n < 10; n++) img('px/h_' + n + '.png', DW, DH, (g) => put(F57[n], g, 0, 0, '${WHITE}', false));
img('px/colon.png', 2 * C, DH, (g) => put(${JSON.stringify(COLON)}, g, 0, 0, '${WHITE}', false));
for (let n = 0; n < 10; n++) img('px/a_' + n + '.png', DW, DH, (g) => put(F57[n], g, 0, 0, '${AODC}', true));
img('px/a_colon.png', 2 * C, DH, (g) => put(${JSON.stringify(COLON)}, g, 0, 0, '${AODC}', true));
img('px/blank.png', INK, INK, (g) => {});
const PICS = ${JSON.stringify(Object.values(pics))};
for (const p of PICS) img(p.name, (p.w - 1) * C + INK, (p.h - 1) * C + INK, (g) => { for (const [c, r, k] of p.cells) { g.fillStyle = k; g.fillRect(c * C, r * C, INK, INK); } });
`;
const wrap = (tail) => ({ script: `${js}\nawait loadAllImages();\n${tail}` });
const APP_ID = Number(process.env.APP_ID || 1133668);
const steps = [
  { script: `project.appId = ${APP_ID}; return project.appId` },
  { preset: 'bg' },
  wrap(`const e = await addElement('IMG', { src: names[0] }); e.name = 'Scene'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return names.length`),
  { preset: 'clock' }, { preset: 'clock' },
  { script: `const n = project.elements.length; ['Hour','Colon','Minute'].forEach((nm, i) => { project.elements[n - 3 + i].name = nm + ' Aod'; });
    project.groups = project.groups || {}; let k = 0; for (const e of project.elements) if (/ Aod$/.test(e.name)) { e.group = 'gClockAod'; k++; } project.groups.gClockAod = 'Clock AOD'; return k` },
  { remove: 'Colon Aod' },
  wrap(`
    const E = (n) => project.elements.find((q) => q.name === n);
    const hr = names.filter((s) => /px\\/h_\\d\\.png$/.test(s)), ar = names.filter((s) => /px\\/a_\\d\\.png$/.test(s));
    const X = (c) => OX + c * C, Y = (r) => OY + r * C;
    for (const [e, set, x] of [[E('Hour'), hr, X(3)], [E('Minute'), hr, X(18)], [E('Hour Aod'), ar, X(3)], [E('Minute Aod'), ar, X(18)]]) { e.glyph = null; e.images = set; e.space = C; e.zero = 1; e.x = x; e.y = Y(${GY}); }
    for (const n of ['Hour', 'Minute']) E(n).show = 'normal';
    for (const n of ['Hour Aod', 'Minute Aod']) E(n).show = 'aod';
    project.elements = project.elements.filter((q) => q.name !== 'Colon');
    const ce = await addElement('IMG', { src: 'px/colon.png' }); ce.name = 'Colon'; ce.src = 'px/colon.png'; ce.x = X(${CX0}); ce.y = Y(${GY}); ce.show = 'normal';
    const ca = await addElement('IMG', { src: 'px/a_colon.png' }); ca.name = 'Colon Aod'; ca.src = 'px/a_colon.png'; ca.x = X(${CX0}); ca.y = Y(${GY}); ca.show = 'aod'; ca.group = 'gClockAod';
    // the first element of the clock group is the one the panel shows on top: hour, colon, minute order
    project.groups = project.groups || {};
    const mk3 = (n, handle, src, x, y) => addElement('IMG', { src }).then((e) => { e.name = n; e.src = src; e.handle = handle; e.x = x; e.y = y; e.show = 'normal'; e.group = 'gPac'; return e; });
    const bl = 'px/blank.png';
    await mk3('Eaten', 'cv', bl, X(3), Y(${GY}));
    for (const [i, x] of [[0, 3], [1, 9], [2, 18], [3, 24], [4, ${CX0}]]) await mk3('Sprout ' + (i + 1), 'sp' + i, bl, X(x), Y(${GY}));
    await mk3('Stolen pixel', 'st', bl, X(0), Y(0));
    await mk3('Loose pixel', 'fp', bl, X(0), Y(0));
    await mk3('Ghost', 'gh', bl, X(0), Y(20));
    await mk3('Pac-Man', 'pc', bl, X(0), Y(${PCY - 3}));
    project.groups.gPac = 'Pac-Man';
    return 1`),
];
const userCode = `{
  // The reference timeline, frame for frame (100 ms): 6 idle frames; if the time has an 8, a ghost slides in, steals a pixel of the first 8 and leaves; then pac-man
  // crosses from the left and the digits grow back behind him. The code reads the time from Date to know which digits are on the face.
  const C = ${C}, OX = ${OX}, OY = ${OY}, GY = ${GY}, PCY = ${PCY}, MS = 50
  const M = ${JSON.stringify(MAP)}
  const REACH = [3, 3, 2, 1]
  const X = (c) => OX + c * C, Y = (r) => OY + r * C
  const last = {}
  const put = (k, x, y, src) => {
    const key = x + '|' + y + '|' + src
    if (last[k] === key) return
    last[k] = key
    W[k].setProperty(ui.prop.MORE, { x: pxv(x), y: pxv(y), src: A(src || 'px/blank.png') })
  }
  const tick = () => {
    const d = new Date(), t = [Math.floor(d.getHours() / 10), d.getHours() % 10, Math.floor(d.getMinutes() / 10), d.getMinutes() % 10]
    const i8 = t.indexOf(8), gt = i8 < 0 ? 0 : M.DX[i8] - 1
    const nIn = i8 < 0 ? 0 : Math.ceil((32 - gt) / 2), nOut = i8 < 0 ? 0 : Math.ceil((gt + 8) / 2)
    const nTail = nIn + 10 + nOut + 4, N = 6 + (i8 < 0 ? 0 : nTail) + 45
    const fi = Math.floor(Date.now() / 100) % N
    let g = fi - 6, cx = null, gx = null, look = 'l', stolen = false, fp = null
    if (g >= 0) {
      if (i8 < 0) cx = g - 4
      else if (g < nIn) gx = Math.max(gt, 32 - 2 * (g + 1))
      else if (g < nIn + 10) { const k = g - nIn; gx = gt; look = k < 8 ? 'u' : 'l'; stolen = k >= 2; if (k === 2) fp = [M.DX[i8] + 2, GY + 6, 'y']; if (k >= 3) fp = [gx + 3, 19, 'w'] }
      else if (g < nIn + 10 + nOut) { const k = g - nIn - 10; gx = gt - 2 * (k + 1); stolen = true; fp = [gx + 3, 19, 'w'] }
      else if (g < nTail) stolen = true
      else { cx = g - nTail - 4; stolen = true }
    }
    // pictures
    const cv = cx === null ? '' : M.CV[cx + 4]
    put('cv', X(3), Y(GY), cv)
    const gl = [t[0], t[1], t[2], t[3], 'c']
    for (let s = 0; s < 5; s++) {
      const x0 = s < 4 ? M.DX[s] : M.CX0, g = gl[s]
      put('sp' + s, X(x0), Y(GY), cx === null ? '' : (M.G[g][x0 % 4][cx - x0] || ''))
    }
    // the stolen pixel stays hidden until pac-man's mouth gets there
    const tx = i8 < 0 ? 0 : M.DX[i8] + 2, ty = GY + 6
    put('st', X(tx), Y(ty), stolen && i8 >= 0 && (cx === null || tx > cx + REACH[Math.abs(ty - PCY)]) ? M.STOLEN : '')
    put('fp', fp ? X(fp[0]) : 0, fp ? Y(fp[1]) : 0, fp ? (fp[2] === 'y' ? M.FPY : M.FPW) : '')
    if (gx !== null) {
      const a = Math.max(0, -gx), b = Math.min(7, 32 - gx), foot = fi % 2
      put('gh', X(gx + a), Y(20), a < b ? M.GHO[look + foot][a + '_' + b] : '')
    } else put('gh', 0, Y(20), '')
    if (cx !== null) {
      const a = Math.max(0, 3 - cx), b = Math.min(7, 32 - (cx - 3)), m = [2, 1, 0, 1][fi % 4]
      put('pc', X(cx - 3 + a), Y(PCY - 3), a < b ? M.PAC[m][a + '_' + b] : '')
    } else put('pc', 0, Y(PCY - 3), '')
  }
  let id = null
  const safe = () => { try { tick() } catch (e) {} }
  const start = () => { if (id === null) { try { id = setInterval(safe, MS) } catch (e) {} } }
  const stop = () => { if (id !== null) { try { clearInterval(id) } catch (e) {} id = null } }
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: start, pause_call: stop })
  safe()
  start()
}`;
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: 'Pixel Pacman', device: 'bip-6', language: 'en-US', font: 'Inter',
  description: 'Pac-Man eats the time on an LED matrix: he chews through the digits, they grow back behind him, and now and then a ghost steals a pixel from an 8. Native clock on a 12 px pixel lattice.',
  preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', optimizePng: true, build: process.env.BUILD === '1', userCode, out: 'out/pixel-pacman', steps }, null, 1));
console.log('pictures', Object.keys(pics).length);
