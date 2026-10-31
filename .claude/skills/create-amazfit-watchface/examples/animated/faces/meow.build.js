// ---- Meow clock: a red seven-segment LED clock on a 32-column dot grid, the Meoweather cat walking along the bottom ----
const SLUG = 'meow'; FONT = 'DSEG7 Fire';
const C = 12, OX = 3, OY = 3;
const X = (c) => OX + C * c, Y = (r) => OY + C * r;
const DT = 8, TT = 20, RED = '#ff0000', GHOST = '#161616', DIMRED = '#5a0000', TEMPC = '#ff0000';   // digit top row, temperature top row
const led = (g, c, r, col) => { g.fillStyle = col; g.fillRect(c * C, r * C, C - 1, C - 1); };
const mkPic = (name, w, h, fn) => { const c = mkc(w, h); fn(c.getContext('2d')); return addProjectImage(name, c, {}).name; };
const P35 = { 0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'], 3: ['###', '..#', '###', '..#', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'], 6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '..#', '..#', '..#'], 8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '###'], C: ['###', '#..', '#..', '#..', '###'], '-': ['...', '...', '###', '...', '...'] };
// seven segments on a 5 x 9 cell digit; unlit segments stay as a faint ghost
const SEG = { a: [[1, 0], [2, 0], [3, 0]], b: [[4, 1], [4, 2], [4, 3]], c: [[4, 5], [4, 6], [4, 7]], d: [[1, 8], [2, 8], [3, 8]], e: [[0, 5], [0, 6], [0, 7]], f: [[0, 1], [0, 2], [0, 3]], g: [[1, 4], [2, 4], [3, 4]] };
const ON = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
const digit = (n, lit, ghost) => (g) => { for (const k in SEG) { const on = ON[n].includes(k); if (on) SEG[k].forEach(([c, r]) => led(g, c, r, lit)); else if (ghost) SEG[k].forEach(([c, r]) => led(g, c, r, ghost)); } };
// scene: black, with the colon (two dots on the middle column) drawn in
const sc = mkc(W, H), sg = sc.getContext('2d'); sg.fillStyle = '#000'; sg.fillRect(0, 0, W, H);
for (const r of [DT + 3, DT + 6]) { sg.fillStyle = RED; sg.fillRect(X(16), Y(r), C - 1, C - 1); }
await scene(sc, 'scene_meow');
const hn = [], an = [], tn = [];
for (let n = 0; n < 10; n++) {
  hn.push(mkPic('px/h_' + n + '.png', 5 * C, 9 * C, digit(n, RED, GHOST)));
  an.push(mkPic('px/a_' + n + '.png', 5 * C, 9 * C, digit(n, DIMRED, null)));
  tn.push(mkPic('px/t_' + n + '.png', 3 * C, 5 * C, (g) => { P35[n].forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') led(g, c, r, TEMPC); })); }));
}
const unit = mkPic('px/unit.png', 6 * C, 5 * C, (g) => { for (const [c, r] of [[0, 0], [1, 0], [0, 1], [1, 1]]) led(g, c, r, TEMPC); P35.C.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') led(g, 3 + c, r, TEMPC); })); });
const minus = mkPic('px/minus.png', 3 * C, 5 * C, (g) => P35['-'].forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') led(g, c, r, TEMPC); })));
await loadAllImages();
for (const [n, x] of [['Hour', 3], ['Minute', 19]]) { const e = E(n); e.glyph = null; e.images = hn; e.space = C; e.zero = 1; e.x = X(x); e.y = Y(DT); e.alignH = 'LEFT'; }
project.elements = project.elements.filter((q) => q.name !== 'Colon');
const t = E('Temperature'); t.glyph = null; t.images = tn; t.hSpace = C; t.alignH = 'CENTER_H'; t.unit = unit; t.negative = minus; t.w = 16 * C; t.x = 195 - 9 * C + 6;   // ink centred on the colon axis (x 201), half a cell off the dot grid t.y = Y(TT); t.show = 'normal';
// ---- the cat (sprites, colours and behaviours from github.com/brmk/iDotMatrix-Meoweather): walks along the bottom ----
const CATSPR = { WALK_A: ['..o.o', '..gog', '.oooo', '.r.r.'], WALK_B: ['..o.o', '..gog', '.oooo', '..rr.'], BLINK_A: ['..o.o', '..ooo', '.oooo', '.r.r.'], BLINK_B: ['..o.o', '..ooo', '.oooo', '..rr.'], SIT_A: ['..o.o', '..gog', '.sooo', '.ssr.'], SIT_B: ['..o.o', '..ooo', '.sooo', '.ssr.'], LIE_A: ['..o.o', '..gog', '.oooo'], LIE_B: ['..o.o', '..ooo', '.oooo'], JUMP_1: ['..o.o', '..gog', '.oooo', '.r.r.'], JUMP_2: ['..o.o', '..gog', '.oooo', '.o.o.'], JUMP_3: ['..o.o', '..gog', '.oooo', '.....'], JUMP_4: ['..o.o', '..gog', '.oooo', '.r.r.'], DREAM: ['.....', '..o.o', '.sooo', '.ssso'], BURP_A: ['..o.o', '..ooo', '.sooo', '.ssr.'], BURP_B: ['...o.', '..ooo', '.sooo', '.ssr.'], POO_A: ['..o.o', '..ooo', '.sooo', '.ss..'], POO_B: ['..o.o', '..ooo', '.sooo', '..ss.'] };
const CATPAL = { d: { o: [255, 155, 30], g: [50, 220, 80], s: [184, 74, 10], l: [255, 205, 130], r: [225, 145, 65] }, n: { o: [130, 75, 15], g: [20, 100, 35], s: [95, 38, 5], l: [130, 105, 65], r: [115, 74, 33] } };
const catrgb = (c) => 'rgb(' + c.join(',') + ')';
const WITH_TAIL = /^(WALK|BLINK|LIE|JUMP)_/;
const CATF = 32;   // grid row of the cat's top: its feet stand on row 35, near the bottom edge
const catVars = [];
for (const nm of Object.keys(CATSPR)) for (const m of ['r', 'm']) for (const p of ['d', 'n']) for (const tl of (WITH_TAIL.test(nm) ? [1, 2] : [0])) {
  catVars.push([nm + '_' + m + p + tl, (g) => {
    CATSPR[nm].forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.') led(g, m === 'r' ? c : 4 - c, r, catrgb(CATPAL[p][ch])); }));
    if (tl) led(g, m === 'r' ? 0 : 4, tl, catrgb(CATPAL[p].s));
  }]);
}
await mkSlot('cat', 'Cat', catVars, 5 * C, 4 * C, OX + 3 * C, OY + CATF * C);
const CATFX = { g: [50, 220, 80], gn: [20, 100, 35], z: [160, 160, 255], p0: [50, 220, 80], p1: [42, 185, 68], p2: [34, 150, 56], p3: [24, 110, 40], q0: [120, 70, 20], q1: [100, 58, 16], q2: [80, 46, 12], q3: [60, 35, 9] };
for (let i = 0; i < 8; i++) await mkSlot('fx' + i, 'Cat fx ' + (i + 1), Object.keys(CATFX).map((k) => [k, (g) => led(g, 0, 0, catrgb(CATFX[k]))]), C, C, 0, 0, 'catfx');
globalThis.__PER = { g: [OX, OY, C, CATF] };
globalThis.__A = { aod: an, C, hx: X(3), mx: X(19), y: Y(DT), colx: X(16), coly: Y(DT + 3), col: true };
globalThis.__G = { Temperature: ['Temperature'], Cat: ['Cat', 'Cat fx 1', 'Cat fx 2', 'Cat fx 3', 'Cat fx 4', 'Cat fx 5', 'Cat fx 6', 'Cat fx 7', 'Cat fx 8'] };
