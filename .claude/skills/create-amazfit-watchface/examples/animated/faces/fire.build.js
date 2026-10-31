// ---- Fire clock: an LED-matrix face, cell for cell from the reference (32 columns, 1 px gaps) ----
const SLUG = 'fire'; FONT = 'DSEG7 Fire';
const C = 12, OX = 3, OY = 3, SH = 5;           // cell, grid origin, rows added above the reference grid
const X = (c) => OX + C * c, R = (r) => OY + C * (r + SH);   // r = row of the reference grid
const ROWC = ['#f9e66b', '#f9d35d', '#f9c24e', '#f9b03f', '#f99d30', '#f98c22', '#f97a13'];   // the brightest pulse level; the veil sprites dim it
const led = (g, c, r, col) => { g.fillStyle = col; g.fillRect(c * C, r * C, C - 1, C - 1); };
const mkPic = (name, w, h, fn) => { const c = mkc(w, h); fn(c.getContext('2d')); return addProjectImage(name, c, {}).name; };
const P35 = { 0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'], 3: ['###', '..#', '###', '..#', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'], 6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '..#', '..#', '..#'], 8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '###'], C: ['###', '#..', '#..', '#..', '###'], '-': ['...', '...', '###', '...', '...'] };
// scene: black gaps, dark off-cells on the whole grid, the static shadow row under the digits
const sc = mkc(W, H), sg = sc.getContext('2d'); sg.fillStyle = '#000'; sg.fillRect(0, 0, W, H);
for (let r = 0; r < 37; r++) for (let c = 0; c < 32; c++) { sg.fillStyle = '#0a0607'; sg.fillRect(OX + c * C, OY + r * C, C - 1, C - 1); }
for (const c of DATA.shadow) { sg.fillStyle = '#5a1405'; sg.fillRect(OX + c * C, R(14), C - 1, C - 1); }

await scene(sc, 'scene_fire');
// digit pictures (5 x 7 cells), the dim set for always-on, 3 x 5 for the temperature
const hn = [], an = [], tn = [];
for (let n = 0; n < 10; n++) {
  hn.push(mkPic('px/h_' + n + '.png', (n === 1 ? 5 : 6) * C, 7 * C, (g) => { DATA.digits[n].forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') led(g, c, r, ROWC[r]); })); }));
  an.push(mkPic('px/a_' + n + '.png', (n === 1 ? 5 : 6) * C, 7 * C, (g) => { DATA.digits[n].forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') led(g, c, r, '#5c3d14'); })); }));
  tn.push(mkPic('px/t_' + n + '.png', 3 * C, 5 * C, (g) => { P35[n].forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') led(g, c, r, '#ffa014'); })); }));
}
const unit = mkPic('px/unit.png', 6 * C, 5 * C, (g) => { for (const [c, r] of [[0, 0], [1, 0], [0, 1], [1, 1]]) led(g, c, r, '#ffa014'); P35.C.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') led(g, 3 + c, r, '#ffa014'); })); });
const minus = mkPic('px/minus.png', 3 * C, 5 * C, (g) => P35['-'].forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') led(g, c, r, '#ffa014'); })));
await loadAllImages();
for (const [n, x] of [['Hour', 3], ['Minute', 19]]) { const e = E(n); e.glyph = null; e.images = hn; e.space = 0; e.zero = 1; e.x = X(x); e.y = R(7); e.alignH = 'LEFT'; }
project.elements = project.elements.filter((q) => q.name !== 'Colon');
const t = E('Temperature'); t.glyph = null; t.images = tn; t.hSpace = C; t.alignH = 'CENTER_H'; t.unit = unit; t.negative = minus; t.w = 16 * C; t.x = 195 - 9 * C; t.y = R(17); t.show = 'normal';
// pulse: the reference digits cycle bright / mid / dim; the pictures are the bright level, a see-through dark veil gives mid and dim (colon is left clear)
const VL = [['m', (g) => { g.fillStyle = 'rgba(0,0,0,0.133)'; g.fillRect(0, 0, 400, 100); }], ['d', (g) => { g.fillStyle = 'rgba(0,0,0,0.265)'; g.fillRect(0, 0, 400, 100); }]];
await mkSlot('vl', 'Pulse 1', VL, 12 * C, 7 * C, X(3), R(7), 'veilL');
await mkSlot('vr', 'Pulse 2', VL, 13 * C, 7 * C, X(17), R(7), 'veilR');
// sprites: blinking colon, 3 chunks of flame frames, ember cells
await mkSlot('colon', 'Colon Main', [['on', (g) => { for (const r of [0, 2]) for (const c of [0, 1]) led(g, c, r, '#ffdc5a'); }]], 2 * C, 3 * C, X(15), R(9));
const CH = [[0, 11], [11, 22], [22, 32]];
for (let i = 0; i < 3; i++) {
  const [a, b] = CH[i], vs = [];
  for (let f = 0; f < 12; f++) vs.push(['f' + f, (g) => { for (let r = 0; r < 10; r++) for (let c = a; c < b; c++) { const col = DATA.flames[f][r][c]; if (col) led(g, c - a, r, '#' + col); } }]);
  await mkSlot('fl' + i, 'Flame ' + (i + 1), vs, (b - a) * C, 10 * C, X(a), R(22));
}
const EC = ['ffc850', 'ff8c1e', '8c320f'];
for (let i = 0; i < 8; i++) await mkSlot('em' + i, 'Ember ' + (i + 1), EC.map((k) => [k, (g) => led(g, 0, 0, '#' + k)]), C, C, 0, 0, 'ember');

// embers per frame in screen cells; those that would sit on the temperature are left out
const tb = [8, 24, 19, 23];
const EM = DATA.embers.map((fr) => fr.map(([c, r, k]) => [X(c), R(r), k]).filter(([x, y]) => !((x >= X(tb[0]) && x < X(tb[1])) && (y >= OY + C * tb[2] && y < OY + C * (tb[3] + 1)))));
globalThis.__PER = { v: [[X(3), R(7)], [X(17), R(7)]], e: EM, fl: CH.map(([a]) => [X(a), R(22)]), k: [X(15), R(9)] };
globalThis.__REFADJ = (ms) => ms - (ms % 1200);
globalThis.__A = { aod: an, C, hx: X(3), mx: X(19), y: R(7), colx: X(15), coly: R(9), col: true };
globalThis.__G = { Temperature: ['Temperature'], Pulse: ['Pulse 1', 'Pulse 2'], Flames: ['Flame 1', 'Flame 2', 'Flame 3'], Embers: ['Ember 1', 'Ember 2', 'Ember 3', 'Ember 4', 'Ember 5', 'Ember 6', 'Ember 7', 'Ember 8'] };
