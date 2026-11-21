// Maze Pac-Man: neon-blue maze on the left, the time as double-line blue digits on the right (the reference watch face).
// Pac-Man plays the maze by himself, live: he goes for the nearest dot, keeps away from the four ghosts, the ghosts chase him; when the board is
// clear it fills again. The whole game is a precomputed script (cells per step) played from Date.now(), so the watch only moves sprites.
// The time, weekday and seconds are native layers. Walls are one scene picture, dots are small widgets that are deleted as they get eaten.
const fs = require('fs');
const SEED = Number(process.env.SEED || 7);
const COLS = 15, ROWS = 23, T = 19.5, OX = -30, OY = 0.75, M = 3;   // the maze is bigger than the screen: about a quarter bleeds off the left edge     // maze grid (odd x odd cells), tile and wall-outline size in px
const BLUE = '#1f6bff', GLOW = '#2c7bff', DOT = '#ffb21e';
const STEP = 160;                                                  // ms per cell
const GCOL = ['#e9ecff', '#ff9b3d', '#4fe3ff', '#ff3434'];

// ---- seeded random
let s = SEED >>> 0; const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ri = (n) => Math.floor(rnd() * n);

// ---- the maze: rooms at odd/odd cells, carved by a depth-first walk, then some walls opened so there are loops
const id = (c, r) => r * COLS + c;
const cx = (c) => OX + c * T + T / 2, cy = (r) => OY + r * T + T / 2;
const CORNER = 86, inCorner = () => false;
const visible = (c, r) => {           // cells the game uses: fully on the screen, clear of the rounded left corners
  const x = cx(c), y = cy(r);
  if (x < 10 || x > 252 || y < 8 || y > 442) return false;
  for (const [ox, oy] of [[CORNER, CORNER], [CORNER, 450 - CORNER]]) if (x < ox && (oy < 225 ? y < oy : y > oy) && Math.hypot(x - ox, y - oy) > CORNER - 22) return false;
  return true;
};
const path = new Array(COLS * ROWS).fill(false), seen = {};
const rooms = []; for (let r = 1; r < ROWS; r += 2) for (let c = 1; c < COLS; c += 2) if (!inCorner(c, r)) rooms.push([c, r]);
const start0 = rooms[ri(rooms.length)]; const st = [start0]; seen[id(...start0)] = 1; path[id(...start0)] = true;
while (st.length) {
  const [c, r] = st[st.length - 1];
  const nb = [[2, 0], [-2, 0], [0, 2], [0, -2]].map(([a, b]) => [c + a, r + b, a / 2, b / 2]).filter(([a, b]) => a > 0 && b > 0 && a < COLS && b < ROWS && !seen[id(a, b)] && !inCorner(a, b));
  if (!nb.length) { st.pop(); continue; }
  const [a, b, da, db] = nb[ri(nb.length)]; seen[id(a, b)] = 1; path[id(a, b)] = true; path[id(c + da, r + db)] = true; st.push([a, b]);
}
for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) {      // braid: wall cells between two rooms
  if (path[id(c, r)]) continue; const horiz = r % 2 === 1 && c % 2 === 0, vert = r % 2 === 0 && c % 2 === 1; if (!horiz && !vert) continue;
  const a = horiz ? [c - 1, r] : [c, r - 1], b = horiz ? [c + 1, r] : [c, r + 1];
  if (path[id(...a)] && path[id(...b)] && rnd() < 0.2) path[id(c, r)] = true;
}
let cells = []; for (let i = 0; i < path.length; i++) if (path[i] && visible(i % COLS, Math.floor(i / COLS))) cells.push(i);
{ const ok = new Set(cells), vr = cells.filter((i) => i % COLS % 2 === 1 && Math.floor(i / COLS) % 2 === 1); globalThis.__p0 = vr[Math.floor(rnd() * vr.length)];
  const q = [__p0], got = new Set(q); const nb = (i) => [i + 1, i - 1, i + COLS, i - COLS].filter((n) => ok.has(n) && !(Math.abs(n % COLS - i % COLS) > 1));
  for (let h = 0; h < q.length; h++) for (const n of nb(q[h])) if (!got.has(n)) { got.add(n); q.push(n); }
  cells = cells.filter((i) => got.has(i)); }
const gameSet = new Set(cells); const adj = {}; for (const i of cells) { const c = i % COLS, r = (i - c) / COLS; adj[i] = [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([a, b]) => [c + a, r + b]).filter(([a, b]) => a >= 0 && b >= 0 && a < COLS && b < ROWS && gameSet.has(id(a, b))).map(([a, b]) => id(a, b)); }
const bfs = (from, blocked) => { const d = { [from]: 0 }, prev = {}, q = [from]; for (let h = 0; h < q.length; h++) for (const n of adj[q[h]]) if (d[n] === undefined && !blocked.has(n)) { d[n] = d[q[h]] + 1; prev[n] = q[h]; q.push(n); } return { d, prev }; };
const dist = (a, b) => { const { d } = bfs(a, new Set()); return d[b] === undefined ? 99 : d[b]; };

// ---- the game, step by step: pac-man, 4 ghosts
const pickFar = (n, min) => { const { d } = bfs(start0 ? id(...start0) : cells[0], new Set()); const far = cells.filter((i) => (d[i] || 0) >= min); const out = []; for (let k = 0; k < n; k++) out.push(far.splice(ri(far.length), 1)[0]); return out; };
const pacStart = __p0;
const dStart = bfs(pacStart, new Set()).d;
const far = cells.filter((i) => dStart[i] >= 9 && i % COLS % 2 === 1 && Math.floor(i / COLS) % 2 === 1);
const ghostStart = []; for (let k = 0; k < 4; k++) ghostStart.push(far.splice(ri(far.length), 1)[0]);
const pac = [pacStart], gh = ghostStart.map((g) => [g]), eatAt = {}; eatAt[pacStart] = 0;
const eaten = new Set([pacStart]); let stuck = 0;
const IGN = Number(process.env.IGN || 0.01), CH = Number(process.env.CH || 1);
const mode = [0], tp = [0]; let deaths = 0, lastEat = 0;
const hold = (n) => { for (let i = 0; i < n; i++) { pac.push(pac[pac.length - 1]); gh.forEach((g) => g.push(g[g.length - 1])); mode.push(0); tp.push(0); } };
hold(4);
for (let step = pac.length; step < 1200; step = pac.length) {
  const p = pac[step - 1], G = gh.map((g) => g[step - 1]);
  const done = eaten.size >= cells.length;
  let n = p;
  if (!done) {
    const ghostSet = new Set(G), danger = new Set(G); for (const g of G) if (dist(p, g) <= 4) for (const q of adj[g]) danger.add(q);
    danger.delete(p);
    const pickNext = (blocked) => {
      const { d, prev } = bfs(p, blocked); let best = null;
      for (const i of cells) if (!eaten.has(i) && d[i] !== undefined && (best === null || d[i] < d[best] || (d[i] === d[best] && rnd() < 0.5))) best = i;
      if (best === null) return null; let x = best; while (prev[x] !== p) x = prev[x]; return d[best] === 0 ? null : x;
    };
    n = rnd() < IGN ? pickNext(ghostSet) : pickNext(danger);
    if (n === null) { let bn = p, bv = Math.min(...G.map((g) => dist(p, g))) - 0.5; for (const q of adj[p]) { if (G.includes(q)) continue; const v = Math.min(...G.map((g) => dist(q, g))); if (v > bv) { bv = v; bn = q; } } n = bn; }
  }
  const gn = G.map((cur, k) => {
    const prevc = gh[k].length > 1 ? gh[k][gh[k].length - 2] : -1;
    let opts = adj[cur].slice(); const noBack = opts.filter((q) => q !== prevc); if (noBack.length) opts = noBack;
    if (!opts.length) return cur;
    if (rnd() < [0.4, 0.5, 0.45, 0.7][k] * CH) { const { d } = bfs(n, new Set()); return opts.reduce((a, b) => (d[b] < d[a] ? b : a)); }
    return opts[ri(opts.length)];
  });
  pac.push(n); if (!eaten.has(n)) { eaten.add(n); eatAt[n] = step; lastEat = step; }
  gn.forEach((q, k) => gh[k].push(q)); mode.push(0); tp.push(0);
  const caught = gn.some((q, k) => q === n || (q === p && G[k] === n));
  if (caught) {
    deaths++;
    for (let i = 1; i <= 9; i++) { pac.push(n); gh.forEach((g) => g.push(g[g.length - 1])); mode.push(i); tp.push(0); }
    pac.push(pacStart); gh.forEach((g, k) => g.push(ghostStart[k])); mode.push(10); tp.push(1);
    hold(4);
  }
  if (done && step > lastEat + 10) break;
}
const S = pac.length;                       // positions 0..S-1, then the board resets
const CYC = S * STEP;
console.log('cells', cells.length, 'steps', S, 'cycle', (CYC / 1000).toFixed(1) + 's', 'deaths', deaths, 'seed', SEED);
if (S >= 1190) process.exit(1);
const dirOf = (a, b) => { if (a === b) return -1; const d = b - a; return d === 1 ? 0 : d === COLS ? 1 : d === -1 ? 2 : 3; };   // 0 R, 1 D, 2 L, 3 U
const dirs = (arr) => { const o = []; let last = 0; for (let t = 0; t < arr.length; t++) { const d = t + 1 < arr.length && !tp[t + 1] ? dirOf(arr[t], arr[t + 1]) : -1; if (d >= 0) last = d; o.push(last); } return o; };
const wrapAround = (arr) => arr;      // the last position is held, then the board resets
const eatT = cells.map((i) => (eatAt[i] === undefined ? 1e9 : eatAt[i]));
const DATA = { COLS, T, OX, OY, STEP, S, cells, eat: eatT, pac: pac, pacD: dirs(pac), mode, tp, gh: gh, ghD: gh.map(dirs) };

// ---- picture drawing (runs in the editor page)
const js = `
const W = dev().w, H = dev().h, COLS = ${COLS}, ROWS = ${ROWS}, T = ${T}, OX = ${OX}, OY = ${OY}, M = ${M};
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
const img = (name, w, h, fn) => { const c = mk(w, h), g = c.getContext('2d'); fn(g); names.push(addProjectImage(name, c, {}).name); };
const PATH = ${JSON.stringify(path.map((b) => (b ? 1 : 0)))};
const VOID = (c, r) => false;
const isWall = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !PATH[r * COLS + c];
const drawWalls = (g) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.save(); g.shadowColor = '${GLOW}'; g.shadowBlur = 7; g.fillStyle = '${BLUE}';
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (isWall(c, r)) g.fillRect(OX + c * T, OY + r * T, T, T);
  g.restore();
  g.fillStyle = '#000';
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (isWall(c, r)) {
    const x = OX + c * T, y = OY + r * T, l = isWall(c - 1, r), rt = isWall(c + 1, r), u = isWall(c, r - 1), d = isWall(c, r + 1);
    const edgeX = c === 0 || c === COLS - 1, edgeY = r === 0 || r === ROWS - 1;
    const x0 = x + (l ? 0 : M), x1 = x + T - (rt ? 0 : M), y0 = y + (u ? 0 : M), y1 = y + T - (d ? 0 : M);
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  g.fillStyle = '${BLUE}';
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (isWall(c, r)) {
    const x = OX + c * T, y = OY + r * T;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (isWall(c + dx, r) && isWall(c, r + dy) && !isWall(c + dx, r + dy)) g.fillRect(dx < 0 ? x : x + T - M, dy < 0 ? y : y + T - M, M, M);
  }
};
globalThis.drawWalls = drawWalls;
// -- segmented digits and letters: separate solid bars with small gaps, upright (the reference's LCD look), all drawn here
const SEGCOL = '#18a2ff', SEGDIM = '#1a4fa8';
const drawSeg = (g, keys, x0, y0, w, h, th, gap, color, dim) => {
  const xl = x0 + th / 2, xr = x0 + w - th / 2, xm = x0 + w / 2, yt = y0 + th / 2, ym = y0 + h / 2, yb = y0 + h - th / 2, hh = th / 2;
  const poly = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); if (dim) { g.lineWidth = 1.6; g.strokeStyle = color; g.lineJoin = 'round'; g.stroke(); } else { g.fillStyle = color; g.fill(); } };
  const hb = (xa, xb, y) => poly([[xa + gap, y], [xa + gap + hh, y - hh], [xb - gap - hh, y - hh], [xb - gap, y], [xb - gap - hh, y + hh], [xa + gap + hh, y + hh]]);
  const vb = (x, ya, yb2) => poly([[x, ya + gap], [x + hh, ya + gap + hh], [x + hh, yb2 - gap - hh], [x, yb2 - gap], [x - hh, yb2 - gap - hh], [x - hh, ya + gap + hh]]);
  const db = (xa, ya, xb, yb2) => { const dx = xb - xa, dy = yb2 - ya, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, e = gap + th * 0.55, p = th * 0.4;
    const sx = xa + ux * e, sy = ya + uy * e, ex = xb - ux * e, ey = yb2 - uy * e; poly([[sx - uy * p, sy + ux * p], [ex - uy * p, ey + ux * p], [ex + uy * p, ey - ux * p], [sx + uy * p, sy - ux * p]]); };
  const F = { a: () => hb(xl, xr, yt), d: () => hb(xl, xr, yb), g: () => hb(xl, xr, ym), g1: () => hb(xl, xm, ym), g2: () => hb(xm, xr, ym),
    f: () => vb(xl, yt, ym), e: () => vb(xl, ym, yb), b: () => vb(xr, yt, ym), c: () => vb(xr, ym, yb), i: () => vb(xm, yt, ym), l: () => vb(xm, ym, yb),
    h: () => db(xl, yt, xm, ym), j: () => db(xr, yt, xm, ym), k: () => db(xl, yb, xm, ym), m: () => db(xr, yb, xm, ym) };
  for (const k of keys) F[k]();
};
const DIG = [['a','b','c','d','e','f'], ['b','c'], ['a','b','g','e','d'], ['a','b','g','c','d'], ['f','g','b','c'], ['a','f','g','c','d'], ['a','f','g','e','d','c'], ['a','b','c'], ['a','b','c','d','e','f','g'], ['a','b','c','d','f','g']];
const LET = { M: ['f','e','b','c','h','j'], O: ['a','b','c','d','e','f'], N: ['f','e','b','c','h','m'], T: ['a','i','l'], U: ['f','e','d','c','b'], E: ['a','f','e','d','g1'], W: ['f','e','b','c','k','m'],
  D: ['a','b','c','d','i','l'], H: ['f','e','b','c','g1','g2'], F: ['a','f','e','g1'], R: ['a','f','e','b','g1','g2','m'], I: ['a','d','i','l'], A: ['a','b','c','e','f','g1','g2'], S: ['a','f','g1','g2','c','d'] };
const BD = { w: 50, h: 76, th: 11, gap: 2 }, SD = { w: 19, h: 30, th: 4.4, gap: 1 }, WD = { w: 22, h: 30, th: 4.4, gap: 1 };
const glowed = (g, fn) => { g.save(); g.shadowColor = '${GLOW}'; g.shadowBlur = 5; fn(); g.restore(); };
for (let n = 0; n < 10; n++) img('mz/d_' + n + '.png', BD.w, BD.h, (g) => glowed(g, () => drawSeg(g, DIG[n], 0, 0, BD.w, BD.h, BD.th, BD.gap, SEGCOL, false)));
for (let n = 0; n < 10; n++) img('mz/a_' + n + '.png', BD.w, BD.h, (g) => drawSeg(g, DIG[n], 1, 1, BD.w - 2, BD.h - 2, BD.th, BD.gap, SEGDIM, true));
for (let n = 0; n < 10; n++) img('mz/s_' + n + '.png', SD.w, SD.h, (g) => drawSeg(g, DIG[n], 0, 0, SD.w, SD.h, SD.th, SD.gap, SEGCOL, false));
['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].forEach((nm, i) => img('mz/w_' + i + '.png', 3 * WD.w + 2 * 4, WD.h, (g) => [...nm].forEach((ch, j) => drawSeg(g, LET[ch], j * (WD.w + 4), 0, WD.w, WD.h, WD.th, WD.gap, SEGCOL, false))));
img('mz/blank.png', 2, 2, () => {});
img('mz/scene.png', W, H, (g) => drawWalls(g));
// -- sprites
const PS = 18, SC = 18 / 16;
const pacImg = (d, m) => img('mz/p' + d + '_' + m + '.png', PS, PS, (g) => {
  g.translate(PS / 2, PS / 2); g.rotate(d * Math.PI / 2); g.scale(SC, SC); g.fillStyle = '#ffe11a';
  const a = [0, 0.32, 0.7][m]; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 7.2, a, Math.PI * 2 - a); g.closePath(); g.fill();
});
for (let d = 0; d < 4; d++) for (let m = 0; m < 3; m++) if (m > 0 || d === 0) pacImg(d, m);
for (let i = 1; i <= 9; i++) img('mz/pd' + i + '.png', PS, PS, (g) => { g.translate(PS / 2, PS / 2 + 1); g.rotate(-Math.PI / 2); g.scale(SC, SC); g.fillStyle = '#ffe11a'; const a = 0.7 + i * (Math.PI - 0.72) / 9; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 7.2, a, Math.PI * 2 - a); g.closePath(); g.fill(); });
const GCOL = ${JSON.stringify(GCOL)};
const ghostImg = (k, f, d) => img('mz/g' + k + '_' + f + '_' + d + '.png', PS, PS, (g) => {
  g.scale(SC, SC);
  g.fillStyle = GCOL[k]; g.beginPath(); g.arc(8, 7.5, 7, Math.PI, 0); g.lineTo(15, 14.5);
  const feet = f ? [12.5, 10, 7.5, 5, 2.5, 1] : [11.67, 8.33, 5, 1.67];
  if (f) { for (const x of [12.5, 10, 7.5, 5, 2.5]) { g.lineTo(x, (Math.round(x / 2.5) % 2) ? 12 : 14.5); } } else { g.lineTo(11.5, 12); g.lineTo(8, 14.5); g.lineTo(4.5, 12); }
  g.lineTo(1, 14.5); g.closePath(); g.fill();
  const ox = [1.1, 0, -1.1, 0][d], oy = [0, 1.1, 0, -1.1][d];
  for (const ex of [5.4, 10.6]) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, 7, 2.3, 2.9, 0, 0, 7); g.fill(); g.fillStyle = '#1230d0'; g.beginPath(); g.arc(ex + ox, 7 + oy, 1.25, 0, 7); g.fill(); }
});
for (let k = 0; k < 4; k++) for (let f = 0; f < 2; f++) for (let d = 0; d < 4; d++) ghostImg(k, f, d);
img('mz/dot.png', 6, 6, (g) => { g.fillStyle = '${DOT}'; g.beginPath(); g.arc(3, 3, 2.6, 0, 7); g.fill(); });
`;

// the editor still: the board half way through a game (what the preview and the store picture show)
const stillStep = Math.round(S * 0.42);
const stillJS = `
const W = dev().w, H = dev().h, COLS = ${COLS}, ROWS = ${ROWS}, T = ${T}, OX = ${OX}, OY = ${OY};
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
const t = ${stillStep}, D = ${JSON.stringify({ cells, eat: eatT, pac: pac[stillStep], gh: gh.map((g) => g[stillStep]), pd: dirs(pac)[stillStep], gd: gh.map((g) => dirs(g)[stillStep]) })};
const sc = mk(W, H), sg = sc.getContext('2d'); globalThis.drawWalls(sg);
const getImg = (n) => { const p = project.images.find((i) => i.name === n); return p; };
const draw = async (n, x, y) => { const im = new Image(); im.src = getImg(n).url; await im.decode(); sg.drawImage(im, Math.round(x), Math.round(y)); };
for (let k = 0; k < D.cells.length; k++) if (D.eat[k] > t) { const i = D.cells[k]; await draw('mz/dot.png', OX + (i % COLS) * T + T / 2 - 3, OY + Math.floor(i / COLS) * T + T / 2 - 3); }
const pos = (i) => [OX + (i % COLS) * T + T / 2 - 9, OY + Math.floor(i / COLS) * T + T / 2 - 9];
for (let k = 0; k < 4; k++) await draw('mz/g' + k + '_0_' + D.gd[k] + '.png', ...pos(D.gh[k]));
await draw(D.pd === 0 ? 'mz/p0_1.png' : 'mz/p' + D.pd + '_1.png', ...pos(D.pac));
names.push(addProjectImage('mz/still.png', sc, {}).name);
`;

const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const GX = 282, GW = 108, CXP = 328;               // the time panel
const SEV = 'Seven Segment';
const BIG = { font: 'DSEG7 Modern', fill: 'solid', size: 107 };
const BLU = { fill: 'solid', color: '#18a2ff' };
const FD = '/Volumes/Projects/Projects/dialcraft/.claude/skills/create-amazfit-watchface/examples/animated/fonts/';
const b64 = (f) => fs.readFileSync(FD + f).toString('base64');
const APP_ID = Number(process.env.APP_ID || 1133669);
const steps = [
  { script: `project.appId = ${APP_ID}; return project.appId` },
  { script: `await registerCustomFont({ name: 'seven-segment.ttf', family: 'Seven Segment', format: 'truetype', ext: '.ttf', dataBase64: '${fs.readFileSync(__dirname + '/seven-segment.ttf').toString('base64')}' }); return 1` },
  { preset: 'bg' },
  wrap(js, `const e = await addElement('IMG', { src: 'mz/scene.png' }); e.name = 'Maze'; e.src = 'mz/scene.png'; e.x = 0; e.y = 0; e.show = 'normal'; return names.length`),
  wrap(stillJS, `const e = await addElement('IMG', { src: 'mz/still.png' }); e.name = 'Game still'; e.src = 'mz/still.png'; e.previewOnly = true; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  { preset: 'clock' },
  { script: `const n = project.elements.length; for (const i of [n - 3, n - 2, n - 1]) project.elements[i].name += ' Aod'; return 1` },
  { preset: 'clocksec' }, { preset: 'weekday' },
  { script: `project.groups = project.groups || {}; let k = 0; for (const e of project.elements) if (/ Aod$/.test(e.name)) { e.group = 'gClockAod'; k++; } project.groups.gClockAod = 'Clock AOD'; return k + ' ' + project.elements.map((e) => e.name).join(',')` },
  { script: `project.elements = project.elements.filter((e) => !/^Colon/.test(e.name)); return project.elements.length` },
  { edit: 'Hour', set: { x: 272, y: 131, show: 'normal', zero: 1, alignH: 'LEFT' }, glyph: { font: SEV, fill: 'solid', color: '#18a2ff', size: 107 } },
  { edit: 'Minute', set: { x: 272, y: 232, show: 'normal', zero: 1, alignH: 'LEFT' }, glyph: { font: SEV, fill: 'solid', color: '#18a2ff', size: 107 } },
  { edit: 'Hour Aod', set: { x: 272, y: 131, show: 'aod', zero: 1, alignH: 'LEFT' }, glyph: { font: SEV, fill: 'outline', color: '#000000', outlineColor: '#1a4fa8', outlineWidth: 2, size: 107 } },
  { edit: 'Minute Aod', set: { x: 272, y: 232, show: 'aod', zero: 1, alignH: 'LEFT' }, glyph: { font: SEV, fill: 'outline', color: '#000000', outlineColor: '#1a4fa8', outlineWidth: 2, size: 107 } },
  { edit: 'Second', set: { x: 272, y: 334, show: 'normal', zero: 1, alignH: 'LEFT' }, glyph: { font: SEV, fill: 'solid', color: '#18a2ff', size: 40 } },
  { edit: 'Weekday', set: { x: 271, y: 72, show: 'normal' }, glyph: { font: SEV, fill: 'solid', color: '#18a2ff', size: 40 } },
  { script: `project.groups = project.groups || {}; project.groups.gClock = 'Clock'; let n = 0; for (const nm of ['Second', 'Minute', 'Hour']) { const e = project.elements.find((x) => x.name === nm); if (e) { e.group = 'gClock'; n++ } } return n` },
];
const userCode = `{
  // Pac-Man plays the maze by himself. The game is a script (a cell per step, ${STEP} ms), played from Date.now() so it never drifts:
  // he goes for the nearest dot, keeps clear of the ghosts, the ghosts chase him; when the board is clear it fills again.
  const D = ${JSON.stringify(DATA)}
  const norm = ui.show_level.ONLY_NORMAL
  const CYC = D.S * D.STEP
  const cx = (i) => D.OX + (i % D.COLS) * D.T + D.T / 2 - 9, cy = (i) => D.OY + Math.floor(i / D.COLS) * D.T + D.T / 2 - 9
  const pic = (n) => A('mz/' + n + '.png')
  const mkw = (n, x, y) => ui.createWidget(ui.widget.IMG, { x: pxv(Math.round(x)), y: pxv(Math.round(y)), src: pic(n), show_level: norm })
  let dots = [], pacW = null, gW = [], lastT = -1, lastKey = []
  const kill = (w) => { try { ui.deleteWidget(w) } catch (e) {} }
  const build = (t) => {
    for (const w of dots) if (w) kill(w)
    if (pacW) kill(pacW)
    for (const w of gW) kill(w)
    dots = D.cells.map((i, k) => (D.eat[k] > t ? mkw('dot', D.OX + (i % D.COLS) * D.T + D.T / 2 - 3, D.OY + Math.floor(i / D.COLS) * D.T + D.T / 2 - 3) : null))
    gW = [0, 1, 2, 3].map((k) => mkw('g' + k + '_0_0', 0, 0))
    pacW = mkw('p0_1', 0, 0)
    lastKey = []
  }
  const move = (k, w, x, y, src) => {
    const key = Math.round(x) + '|' + Math.round(y) + '|' + src
    if (lastKey[k] === key) return
    lastKey[k] = key
    try { w.setProperty(ui.prop.MORE, { x: pxv(Math.round(x)), y: pxv(Math.round(y)), src: pic(src) }) } catch (e) {}
  }
  const at = (arr, t, i0) => { const a = arr[i0], b = arr[Math.min(i0 + 1, arr.length - 1)], f = D.tp[Math.min(i0 + 1, arr.length - 1)] ? 0 : t - i0; return [cx(a) + (cx(b) - cx(a)) * f, cy(a) + (cy(b) - cy(a)) * f] }
  const tick = () => {
    const now = Date.now(), ph = now % CYC, st = ph / D.STEP, i0 = Math.min(Math.floor(st), D.S - 1)
    if (ph < lastT || lastT < 0) build(st - 0.4)
    lastT = ph
    for (let k = 0; k < dots.length; k++) if (dots[k] && D.eat[k] - 0.4 <= st) { kill(dots[k]); dots[k] = null }
    const mouth = [1, 2, 1, 0][Math.floor(now / 80) % 4]
    const pd = D.pacD[i0], moving = D.pac[i0] !== D.pac[Math.min(i0 + 1, D.S - 1)]
    const pp = at(D.pac, st, i0)
    const dm = D.mode[i0]
    move(4, pacW, pp[0], pp[1], dm >= 1 && dm <= 9 ? 'pd' + dm : 'p' + (mouth === 0 ? 0 : pd) + '_' + (mouth === 0 ? 0 : (moving ? mouth : 1)))
    for (let k = 0; k < 4; k++) { const gp = at(D.gh[k], st, i0); move(k, gW[k], gp[0], gp[1], 'g' + k + '_' + (Math.floor(now / 160) % 2) + '_' + D.ghD[k][i0]) }
  }
  let id = null
  const safe = () => { try { tick() } catch (e) {} }
  const start = () => { if (id === null) { try { id = setInterval(safe, 100) } catch (e) {} } }
  const stop = () => { if (id !== null) { try { clearInterval(id) } catch (e) {} id = null } }
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: start, pause_call: stop })
  safe()
  start()
}`;
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: 'Maze Pacman', device: 'bip-6', language: 'en-US', font: 'Orbitron', optimizePng: 32,
  description: 'A neon-blue maze that Pac-Man plays by himself: he eats the dots, dodges four ghosts that chase him, and the board refills when it is clear. Time stacked in double-line blue digits, weekday and seconds beside the maze.',
  preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/maze-pacman', build: process.env.BUILD === '1', userCode, steps }, null, 1));
