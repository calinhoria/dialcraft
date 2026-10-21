// ---- the LCARS frame and the small animated panels ----
const COL = { gold: '#fbb03b', orange: '#ff9540', purple: '#cf74cf', violet: '#9a4cff', blue: '#8ab4ff', peach: '#f0c8a8' };
const mkc = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const FONT = '"Bebas Neue", "Oswald", sans-serif';
// geometry shared by the frame and the panels (device pixels)
const G = { sx: 14, sw: 64, cx: 86, cr: 376, bar: 14 };
const ROW = { time: [36, 120], date: [128, 162], power: [170, 204], ship: [212, 354], data: [362, 414] };
const WIN = { x: 86, y: 224, w: 292, h: 104 };

const pillPath = (g, x, y, w, h, l, r) => { g.beginPath(); g.roundRect(x, y, w, h, [l ? h / 2 : 0, r ? h / 2 : 0, r ? h / 2 : 0, l ? h / 2 : 0]); };
const pill = (g, x, y, w, h, col, l, r) => { g.fillStyle = col; pillPath(g, x, y, w, h, l, r); g.fill(); };

const frame = async () => {
  try { await document.fonts.load('700 22px "Bebas Neue"', 'TIMEDATEPOWERSHIPDATASTEPSHEARTTEMP0123456789'); } catch (e) {}
  const c = mkc(W, H), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  // the top elbow: it follows the rounded screen corner and runs into the header bar
  g.fillStyle = COL.gold; g.beginPath();
  g.moveTo(G.sx, ROW.time[1]); g.lineTo(G.sx, 86); g.arc(86, 86, 72, Math.PI, Math.PI * 1.5);
  g.lineTo(322, 14); g.arc(322, 21, 7, -Math.PI / 2, Math.PI / 2); g.lineTo(G.sx + G.sw + 12, 28);
  g.arc(G.sx + G.sw + 12, 40, 12, -Math.PI / 2, Math.PI, true); g.lineTo(G.sx + G.sw, ROW.time[1]); g.closePath(); g.fill();
  const block = (r, col) => { g.fillStyle = col; g.fillRect(G.sx, r[0], G.sw, r[1] - r[0]); };
  block(ROW.date, COL.purple); block(ROW.power, COL.gold); block(ROW.ship, COL.orange); block(ROW.data, COL.purple);
  // labels sit at the bottom right of their blocks, like the reference
  g.fillStyle = '#000'; g.font = '700 20px ' + FONT; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
  const lab = (t, r) => g.fillText(t, G.sx + G.sw - 6, r[1] - 6);
  lab('TIME', ROW.time); lab('DATE', ROW.date); lab('POWER', ROW.power); lab('SHIP', ROW.ship); lab('DATA', ROW.data);
  // header and footer pills around the starship window
  pill(g, G.cx, ROW.ship[0], G.cr - G.cx, 16, COL.purple, true, true);
  g.fillStyle = '#000'; g.fillRect(G.cx + 14, ROW.ship[0], 104, 16);
  g.fillStyle = '#fff'; g.font = '700 14px ' + FONT; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('EXPLORER CLASS', G.cx + 20, ROW.ship[0] + 9);
  g.fillStyle = '#000'; g.fillText('U.S.S. DIALCRAFT  |  NCC-77001', G.cx + 128, ROW.ship[0] + 9);
  pill(g, G.cx, ROW.ship[1] - 16, G.cr - G.cx, 16, COL.purple, true, true);
  // readings: a small label chip above each value
  const chip = (x, w, col, t) => { pill(g, x, ROW.data[0], w, 18, col, true, false); g.fillStyle = '#000'; g.font = '700 16px ' + FONT; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(t, x + 12, ROW.data[0] + 10); };
  chip(86, 120, COL.gold, 'STEPS'); chip(212, 76, COL.orange, 'HEART'); chip(294, 82, COL.blue, 'TEMP');
  // the power bar track, and the bottom bar
  pill(g, 196, ROW.power[0] + 6, 180, 22, '#201528', true, true);
  pill(g, 40, 421, 90, 14, COL.orange, true, false); pill(g, 134, 421, 70, 14, COL.purple, false, false); pill(g, 208, 421, 50, 14, COL.gold, false, false); pill(g, 262, 421, 70, 14, COL.violet, false, true);
  names.push(addProjectImage('lcars.png', c, {}).name);
};

// ---- small animated panels (each loops without a seam) ----
// bars that rise and fall like a live signal
const levels = (w, h, n, cols, kmax, phase) => {
  const out = [];
  for (let k = 0; k < kmax; k++) {
    const c = mkc(w, h), g = c.getContext('2d'), bw = w / n;
    for (let i = 0; i < n; i++) {
      const m = 1 + (i * 7) % 3, v = 0.5 + 0.28 * Math.sin(TAU * (k / kmax) * m + i * 1.7 + phase) + 0.18 * Math.sin(TAU * (k / kmax) * (m + 1) + i * 0.9);
      const bh = Math.max(3, Math.round(h * Math.min(1, Math.max(0.12, v))));
      g.fillStyle = cols[i % cols.length]; g.fillRect(Math.round(i * bw), h - bh, Math.max(2, Math.round(bw) - 3), bh);
    }
    out.push(c);
  }
  return out;
};
const vlevels = (w, h, n, cols, kmax) => {
  const out = [];
  for (let k = 0; k < kmax; k++) {
    const c = mkc(w, h), g = c.getContext('2d'), bh = h / n;
    for (let i = 0; i < n; i++) {
      const v = 0.55 + 0.35 * Math.sin(TAU * (k / kmax) * (1 + i % 2) + i * 2.1);
      g.fillStyle = cols[i % cols.length]; g.fillRect(0, Math.round(i * bh), Math.round(w * Math.min(1, Math.max(0.15, v))), Math.max(2, Math.round(bh) - 4));
    }
    out.push(c);
  }
  return out;
};
// a light that sweeps along a bar
const shimmer = (w, h, kmax) => {
  const out = [];
  for (let k = 0; k < kmax; k++) {
    const c = mkc(w, h), g = c.getContext('2d'), x = -40 + (w + 80) * (k / kmax);
    const gr = g.createLinearGradient(x - 28, 0, x + 28, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,245,220,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.roundRect(0, 0, w, h, h / 2); g.fill();
    out.push(c);
  }
  return out;
};
// a scrolling ticker of numbers on the lower pill
const ticker = (w, h, kmax) => {
  const probe = mkc(8, 8).getContext('2d'); probe.font = '700 14px ' + FONT;
  const txt = '47-88  213  5.09  771  38.4  4D6C  0F2A  91  3.7721  608  27.1  E4  1180  56.02  7B  334  ';
  const period = Math.round(probe.measureText(txt).width);
  const out = [];
  for (let k = 0; k < kmax; k++) {
    const c = mkc(w, h), g = c.getContext('2d'); g.fillStyle = COL.purple; g.beginPath(); g.roundRect(0, 0, w, h, h / 2); g.fill();
    g.save(); g.beginPath(); g.roundRect(0, 0, w, h, h / 2); g.clip();
    g.fillStyle = '#000'; g.font = '700 14px ' + FONT; g.textBaseline = 'middle'; g.textAlign = 'left';
    const off = -period * (k / kmax);
    for (let r = 0; r < Math.ceil(w / period) + 2; r++) g.fillText(txt, off + r * period + 18, h / 2 + 1);
    g.restore();
    out.push(c);
  }
  return out;
};
// the grid of small lit buttons in the tall block
const buttons = (w, h, kmax) => {
  const out = [], cols = [COL.gold, COL.purple, COL.violet, COL.blue, '#000'];
  let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < kmax; k++) {
    const c = mkc(w, h), g = c.getContext('2d'), cw = 14, ch = 14;
    for (let j = 0; j < Math.floor(h / (ch + 4)); j++) for (let i = 0; i < Math.floor(w / (cw + 4)); i++) {
      const r = rnd(); g.fillStyle = r < 0.28 ? '#000' : cols[Math.floor(rnd() * 4)]; g.fillRect(i * (cw + 4), j * (ch + 4), cw, ch);
    }
    out.push(c);
  }
  return out;
};
