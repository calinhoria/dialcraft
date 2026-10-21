const W = dev().w, H = dev().h;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
const TAU = Math.PI * 2;
const TS = 32, X0 = 3, GY = 386;
const px = (g, rows, pal, s, x0, y0) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x0 + i * s, y0 + j * s, s, s); } }));
// the NES colours of World 1-1 (day) and the blue underground (night)
const TH = {
  d: { sky: '#5c94fc', base: '#c84c0c', hi: '#fc9838', goomba: '#b8541c', goombaDk: '#7c3000' },
  n: { sky: '#000000', base: '#0070ec', hi: '#3cbcfc', goomba: '#3c78c8', goombaDk: '#0c2c78' },
};

// rows of bricks: black mortar below each row, vertical joints offset on every other row, a light edge on top of each brick
const bricks = (g, x0, y0, w, h, nrows, bw, th) => {
  const rh = h / nrows;
  g.fillStyle = th.base; g.fillRect(x0, y0, w, h);
  for (let r = 0; r < nrows; r++) {
    const y = y0 + r * rh, off = r % 2 ? bw / 2 : 0;
    g.fillStyle = th.hi; g.fillRect(x0, y, w, 2);
    g.fillStyle = '#000'; g.fillRect(x0, y + rh - 2, w, 2);
    for (let k = -1; k <= Math.ceil(w / bw) + 1; k++) {
      const xm = x0 + off + k * bw - 2;
      if (xm >= x0 && xm < x0 + w) { g.fillStyle = '#000'; g.fillRect(xm, y, 2, rh); g.fillStyle = th.hi; g.fillRect(xm + 2, y + 2, 2, rh - 4); }
    }
  }
};
const brickBlock = (t) => { const c = mk(TS, TS), g = c.getContext('2d'); bricks(g, 0, 0, TS, TS, 4, 16, TH[t]); g.strokeStyle = '#000'; g.lineWidth = 2; g.strokeRect(1, 1, TS - 2, TS - 2); return c; };

const qBlock = (k) => {
  const c = mk(TS, TS), g = c.getContext('2d');
  const base = ['#e8a000', '#fcb838', '#c07000'][k], hi = ['#fcd8a8', '#fff0c0', '#e8b070'][k];
  g.fillStyle = '#000'; g.fillRect(0, 0, TS, TS);
  g.fillStyle = base; g.fillRect(2, 2, TS - 4, TS - 4);
  g.fillStyle = hi; g.fillRect(2, 2, TS - 4, 2); g.fillRect(2, 2, 2, TS - 4);
  g.fillStyle = '#a04000'; g.fillRect(2, TS - 4, TS - 4, 2); g.fillRect(TS - 4, 2, 2, TS - 4);
  g.fillStyle = '#7c3000'; for (const [x, y] of [[5, 5], [TS - 8, 5], [5, TS - 8], [TS - 8, TS - 8]]) g.fillRect(x, y, 3, 3);
  const Q = ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'];
  px(g, Q.map((r) => r.replace(/#/g, 'S')), { S: '#000' }, 3, 10, 7);
  px(g, Q.map((r) => r.replace(/#/g, 'S')), { S: '#7c3000' }, 3, 9, 6);
  return c;
};
const usedBlock = () => {
  const c = mk(TS, TS), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, TS, TS); g.fillStyle = '#a04000'; g.fillRect(2, 2, TS - 4, TS - 4);
  g.fillStyle = '#c87038'; g.fillRect(2, 2, TS - 4, 2); g.fillRect(2, 2, 2, TS - 4);
  g.fillStyle = '#5c2000'; g.fillRect(2, TS - 4, TS - 4, 2); g.fillRect(TS - 4, 2, 2, TS - 4);
  g.fillStyle = '#000'; for (const [x, y] of [[5, 5], [TS - 8, 5], [5, TS - 8], [TS - 8, TS - 8]]) g.fillRect(x, y, 3, 3);
  return c;
};

// green pipe, two tiles wide: a cap on top and a body below
const pipe = (h) => {
  const c = mk(2 * TS, h * TS), g = c.getContext('2d');
  const stripe = (x, y, w, hh, inset) => { g.fillStyle = '#80d010'; g.fillRect(x + inset + 3, y, 8, hh); g.fillRect(x + inset + 14, y, 3, hh); g.fillStyle = '#005800'; g.fillRect(x + w - inset - 14, y, 11, hh); };
  g.fillStyle = '#000'; g.fillRect(0, 0, 2 * TS, TS);
  g.fillStyle = '#00a800'; g.fillRect(2, 2, 2 * TS - 4, TS - 4); stripe(0, 2, 2 * TS, TS - 4, 2);
  if (h > 1) {
    g.fillStyle = '#000'; g.fillRect(4, TS, 2 * TS - 8, (h - 1) * TS);
    g.fillStyle = '#00a800'; g.fillRect(6, TS, 2 * TS - 12, (h - 1) * TS); stripe(4, TS, 2 * TS - 8, (h - 1) * TS, 4);
  }
  return c;
};

// Mario (13 x 16 pixels, drawn at 2x) in four poses
const PAL = { R: '#e52521', S: '#ffa044', B: '#6c3c00', U: '#0058f8', Y: '#fcd800', K: '#000' };
const HEAD = ['....RRRRR....', '...RRRRRRRRR.', '...BBBSSKS...', '..BSBSSSKSSS.', '..BSBBSSSKSSS', '..BBSSSSKKKK.', '....SSSSSSS..'];
const MARIO = {
  s: HEAD.concat(['...RRURRR....', '..RRRURRURRR.', '.RRRRUUUURRRR', '.SSRUYUUYURSS', '.SSSUUUUUUSSS', '.SSUUUUUUUUSS', '...UUU..UUU..', '..BBB....BBB.', '.BBBB....BBBB']),
  r1: HEAD.concat(['...RRURRR....', '..RRRURRURRR.', '.RRRRUUUURRRR', '.SSRUYUUYURSS', '.SSSUUUUUUSSS', '.SSUUUUUUUUSS', '..UUUU.UUUU..', '.BBBB...BBB..', 'BBBB.....BBB.']),
  r2: HEAD.concat(['...RRURRR....', '..RRRURRURRR.', '.RRRRUUUURRRR', '.SSRUYUUYURSS', '.SSSUUUUUUSSS', '.SSUUUUUUUUSS', '...UUUUUU....', '...BBBBBB....', '..BBBBBBBB...']),
  j: ['....RRRRR....', '...RRRRRRRRR.', '...BBBSSKS...', '..BSBSSSKSSS.', '..BSBBSSSKSSS', 'S.BBSSSSKKKKS', 'SS..SSSSSSS.S', 'SSRRRURRR.SS.', '.RRRRURRURRR.', '.RRRRUUUURRRR', '..RRUYUUYURR.', '..UUUUUUUUUU.', '.UUUUUUUUUUU.', 'UUU.......UUU', 'BBB.......BBB', 'BBBB.....BBBB'],
};
const marioImg = (k) => { const c = mk(26, 32), g = c.getContext('2d'); px(g, MARIO[k], PAL, 2, 0, 0); return c; };

// Goomba (16 x 16 pixels at 2x), two walking frames (the second is the first mirrored) and a squashed one
const GOOMBA = ['.....BBBBBB.....', '....BBBBBBBB....', '...BBBBBBBBBB...', '..BBBBBBBBBBBB..', '.BBBKKBBBBKKBBB.', '.BBBBKKBBKKBBBB.', 'BBBWWWBBBBWWWBBB', 'BBBWWKBBBBKWWBBB', 'BBBWWKBBBBKWWBBB', 'BBBBBBBBBBBBBBBB', '.BBBBBBBBBBBBBB.', '..BBBTTTTTTBBB..', '....TTTTTTTT....', '....TTTTTTTT....', '..KKKKTTTTKKKK..', '.KKKKKK..KKKKKK.'];
const goombaImg = (t, f, flat) => {
  const c = mk(TS, TS), g = c.getContext('2d');
  const base = mk(TS, TS), b = base.getContext('2d');
  px(b, GOOMBA, { B: TH[t].goomba, K: '#000', W: '#fff', T: '#f8d8a8' }, 2, 0, 0);
  if (flat) { g.drawImage(base, 0, 0, TS, TS, 0, 24, TS, 8); return c; }
  if (f) { g.translate(TS, 0); g.scale(-1, 1); }
  g.drawImage(base, 0, 0);
  return c;
};

const coinImg = (k) => {
  const c = mk(TS, TS), g = c.getContext('2d'), w = [16, 11, 5, 11][k];
  g.fillStyle = '#000'; g.beginPath(); g.ellipse(16, 16, w / 2 + 2, 13, 0, 0, TAU); g.fill();
  g.fillStyle = '#fcd800'; g.beginPath(); g.ellipse(16, 16, w / 2, 11, 0, 0, TAU); g.fill();
  if (w > 8) { g.fillStyle = '#e8a000'; g.fillRect(15, 9, 3, 14); }
  return c;
};

const shroom = (g, x, y, s) => px(g, ['....RRRR....', '..RRWWRRRR..', '.RRWWWRRWWR.', 'RRRWWRRRWWRR', 'RWWRRRRRRWWR', 'RWWRRRRRRRRR', '.WWWWWWWWWW.', '..WWKWWKWW..', '..WWKWWKWW..', '...WWWWWW...'], { R: '#e52521', W: '#fff0d0', K: '#000' }, s, x, y);

// backgrounds
const outlined = (g, fill, path, lw) => { g.beginPath(); path(); g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = lw || 2; g.strokeStyle = '#000'; g.stroke(); };
const hill = (g, cx, w, h) => {
  outlined(g, '#00a800', () => { g.ellipse(cx, GY, w / 2, h, 0, Math.PI, 0); });
  g.fillStyle = '#005800';
  for (const [dx, dy, rw, rh] of [[-0.22, 0.42, 5, 10], [0.05, 0.5, 5, 10], [0.28, 0.4, 5, 9]]) { g.beginPath(); g.ellipse(cx + dx * w, GY - dy * h, rw, rh, 0, 0, TAU); g.fill(); }
};
const bush = (g, x, y) => {
  g.fillStyle = '#000'; for (const [dx, r] of [[0, 17], [24, 22], [50, 17]]) { g.beginPath(); g.arc(x + dx, y - r + 6, r + 2, Math.PI, 0); g.fill(); } g.fillRect(x - 19, y + 2, 88, 4);
  g.fillStyle = '#58d820'; for (const [dx, r] of [[0, 17], [24, 22], [50, 17]]) { g.beginPath(); g.arc(x + dx, y - r + 6, r, Math.PI, 0); g.fill(); } g.fillRect(x - 17, y + 2, 84, 2);
};
const cloud = (g, x, y) => {
  g.fillStyle = '#000'; for (const [dx, dy, r] of [[18, 28, 16], [40, 20, 21], [62, 28, 16]]) { g.beginPath(); g.arc(x + dx, y + dy, r + 2, 0, TAU); g.fill(); } g.fillRect(x + 16, y + 26, 48, 20);
  g.fillStyle = '#fff'; for (const [dx, dy, r] of [[18, 28, 16], [40, 20, 21], [62, 28, 16]]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, TAU); g.fill(); } g.fillRect(x + 18, y + 28, 44, 16);
  g.fillStyle = '#a4e4fc'; g.fillRect(x + 8, y + 38, 64, 4);
};
const scene = (t) => {
  const c = mk(W, H), g = c.getContext('2d'), th = TH[t];
  g.fillStyle = th.sky; g.fillRect(0, 0, W, H);
  if (t === 'd') {
    hill(g, 120, 200, 78); hill(g, 336, 130, 44);
    bush(g, 214, GY); bush(g, 16, GY); bush(g, 292, GY);
    cloud(g, 250, 128); cloud(g, 28, 150);
  } else {
    bricks(g, -X0 - 29, 130, W + 70, TS, 2, TS, th);
  }
  for (let k = -1; k <= 12; k++) bricks(g, X0 + k * TS, GY, TS, TS * 2, 4, TS, th);
  shroom(g, 124, 12, 3);
  return c;
};
// the ground uses 2 big bricks per tile (16 px rows), like the original
const groundTile = (t) => { const c = mk(TS, TS), g = c.getContext('2d'); bricks(g, 0, 0, TS, TS, 2, TS, TH[t]); return c; };
const pit = (t) => { const c = mk(2 * TS, 2 * TS), g = c.getContext('2d'); g.fillStyle = TH[t].sky; g.fillRect(0, 0, 2 * TS, 2 * TS); return c; };

// a still of the game for the editor preview (drawn in Dialcraft only, never exported to the watch face)
const demo = (t) => {
  const c = mk(W, H), g = c.getContext('2d'), at = (col, row) => [X0 + col * TS, GY - row * TS];
  const put = (img, col, row) => { const [x, y] = at(col, row); g.drawImage(img, x, y); };
  put(qBlock(0), 2, 4); put(brickBlock(t), 3, 4); put(qBlock(0), 4, 4); put(brickBlock(t), 5, 4);
  const [px0, py0] = at(8, 2); g.drawImage(pipe(2), px0, py0);
  const [gx, gy] = at(10, 1); g.drawImage(goombaImg(t, 0, false), gx, gy);
  for (const col of [5, 6]) put(coinImg(0), col, 1);
  g.drawImage(marioImg('j'), 150, 300);
  return c;
};
