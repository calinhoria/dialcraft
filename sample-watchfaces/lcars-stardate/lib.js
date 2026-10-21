// ---- drawing helpers for the LCARS Stardate face ----
const TAU = Math.PI * 2;
const mkc = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const FONT = '"Bebas Neue", sans-serif';
// the five colour roles of the face (the themes swap these)
const ROLE = { orange: '#ff9f33', peach: '#fda97d', pink: '#dd83b9', purple: '#9a7bd9', tan: '#bf8b75' };
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return 'rgb(' + Math.round(r * k) + ',' + Math.round(g * k) + ',' + Math.round(b * k) + ')'; };

// ---------- the static LCARS frame ----------
const frame = async () => {
  try { await ensureFont('Bebas Neue', 700); await document.fonts.load('700 20px "Bebas Neue"', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'); } catch (e) {}
  const c = mkc(W, H), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const txt = (s, x, y, col, size, align = 'left') => { g.fillStyle = col; g.font = '700 ' + size + 'px ' + FONT; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y); };
  // title with a tan bracket
  g.fillStyle = ROLE.tan; g.fillRect(50, 28, 7, 32); g.fillRect(50, 54, 196, 6);
  txt('ATMOSPHERIC PROCESS', 66, 42, ROLE.orange, 25);
  // weather labels
  txt('CURRENT', 32, 76, ROLE.pink, 20); txt('HIGH TEMP', 32, 101, ROLE.peach, 20); txt('LOW TEMP', 32, 125, ROLE.purple, 20);
  txt('SUNR', 169, 79, ROLE.peach, 18); txt('SUNS', 169, 103, ROLE.peach, 18); txt('HUMD', 169, 123, ROLE.peach, 18);
  // the tall bar and the LCARS tab (a tap on the tab changes the colour theme)
  g.fillStyle = ROLE.peach; g.fillRect(254, 21, 35, 114);
  g.fillStyle = ROLE.purple; g.beginPath(); g.roundRect(293, 21, 65, 31, [0, 17, 0, 0]); g.fill();
  txt('LCARS', 303, 38, '#000', 19);
  // the pink band and its elbow with the emblem
  g.fillStyle = ROLE.pink; g.beginPath();
  g.moveTo(20, 136); g.lineTo(367, 136); g.lineTo(367, 172); g.arc(344, 172, 23, 0, Math.PI / 2); g.lineTo(289, 195);
  g.lineTo(289, 173); g.arc(275, 173, 14, 0, -Math.PI / 2, true); g.lineTo(20, 159); g.closePath(); g.fill();
  // emblem: a circle with an arrowhead (drawn here, not copied)
  g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(328, 167, 22, 0, TAU); g.stroke();
  g.fillStyle = '#000'; g.beginPath(); g.moveTo(328, 148); g.bezierCurveTo(334, 160, 340, 172, 345, 184); g.lineTo(328, 175); g.lineTo(311, 184); g.bezierCurveTo(316, 172, 322, 160, 328, 148); g.closePath(); g.fill();
  g.fillStyle = ROLE.pink; g.beginPath(); g.moveTo(328, 158); g.bezierCurveTo(331, 166, 334, 172, 336, 177); g.lineTo(328, 173); g.lineTo(320, 177); g.bezierCurveTo(322, 172, 325, 166, 328, 158); g.closePath(); g.fill();
  g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(333, 178); g.bezierCurveTo(342, 170, 346, 158, 344, 150); g.stroke();
  // STARDATE label
  txt('STARDATE', 55, 178, ROLE.orange, 26);
  // activity bar labels
  txt('M', 39, 388, ROLE.pink, 16, 'center'); txt('E', 64, 388, ROLE.purple, 16, 'center'); txt('S', 91, 388, ROLE.orange, 16, 'center');
  // reading label boxes
  const box = (y, col, t) => { g.fillStyle = col; g.fillRect(169, y, 95, 30); txt(t, 178, y + 16, '#000', 21); };
  box(296, ROLE.pink, 'STEPS'); box(330, ROLE.tan, 'HEART'); box(364, ROLE.purple, 'BATTERY');
  // date box
  g.fillStyle = ROLE.orange; g.fillRect(287, 295, 81, 97);
  // bottom bar (rounded at the screen corner) and the small pill
  g.fillStyle = ROLE.purple; g.beginPath(); g.roundRect(32, 398, 230, 32, [0, 0, 0, 22]); g.fill();
  txt('U.S.S. DIALCRAFT', 147, 415, '#000', 22, 'center');
  g.fillStyle = ROLE.pink; g.beginPath(); g.roundRect(287, 398, 71, 32, [0, 0, 22, 0]); g.fill();
  txt('NX-38', 322, 415, '#000', 21, 'center');
  return c;
};

// ---------- weather icons (29 of them, in the order of the watch's table): thin orange line drawings ----------
const wIcon = (i) => {
  const c = mkc(38, 34), g = c.getContext('2d');
  g.strokeStyle = ROLE.orange; g.fillStyle = ROLE.orange; g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round';
  const sun = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); for (let k = 0; k < 8; k++) { const a = k * TAU / 8; g.beginPath(); g.moveTo(x + Math.cos(a) * (r + 3), y + Math.sin(a) * (r + 3)); g.lineTo(x + Math.cos(a) * (r + 7), y + Math.sin(a) * (r + 7)); g.stroke(); } };
  const cloud = (x, y) => { g.beginPath(); g.arc(x + 8, y + 12, 7, Math.PI * 0.5, Math.PI * 1.5); g.arc(x + 15, y + 6, 8, Math.PI, Math.PI * 1.9); g.arc(x + 25, y + 12, 6, Math.PI * 1.5, Math.PI * 0.5); g.closePath(); g.stroke(); };
  const rain = (n, long) => { for (let k = 0; k < n; k++) { const x = 11 + k * (16 / Math.max(1, n - 1 || 1)) * (n > 1 ? 1 : 0.0) + (n === 1 ? 10 : 0); g.beginPath(); g.moveTo(x, 24); g.lineTo(x - 3, 24 + (long ? 8 : 5)); g.stroke(); } };
  const snow = (n) => { for (let k = 0; k < n; k++) { const x = 10 + k * (n > 1 ? 18 / (n - 1) : 0) + (n === 1 ? 8 : 0); g.beginPath(); g.arc(x, 28, 1.4, 0, TAU); g.fill(); } };
  const bolt = () => { g.beginPath(); g.moveTo(19, 21); g.lineTo(14, 29); g.lineTo(19, 29); g.lineTo(15, 34); g.stroke(); };
  const fog = () => { for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(5, 10 + k * 8); g.lineTo(33, 10 + k * 8); g.stroke(); } };
  const wind = () => { for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(5, 9 + k * 8); g.bezierCurveTo(20, 9 + k * 8, 24, 3 + k * 8, 30, 8 + k * 8); g.stroke(); } };
  const moon = (x, y) => { g.beginPath(); g.arc(x, y, 9, 0.9, TAU - 0.9); g.arc(x + 5, y - 2, 8, TAU - 1.1, 1.1, true); g.closePath(); g.stroke(); };
  const name = ['cloud', 'rainS', 'snowS', 'sun', 'cloud', 'rainL', 'snowL', 'rainM', 'snowM', 'snowH', 'rainH', 'wind', 'sleet', 'fog', 'fog', 'thunder', 'snowH', 'wind', 'rainH', 'hail', 'thunder', 'rainH', 'wind', 'wind', 'rainH', 'cloud', 'moonCloud', 'moonRain', 'moon'][i];
  switch (name) {
    case 'sun': sun(19, 17, 8); break;
    case 'cloud': cloud(3, 5); break;
    case 'rainS': cloud(3, 2); rain(2, false); break;
    case 'rainL': cloud(3, 2); rain(1, false); break;
    case 'rainM': cloud(3, 2); rain(3, false); break;
    case 'rainH': cloud(3, 2); rain(4, true); break;
    case 'snowS': case 'snowL': cloud(3, 2); snow(2); break;
    case 'snowM': cloud(3, 2); snow(3); break;
    case 'snowH': cloud(3, 2); snow(4); break;
    case 'sleet': cloud(3, 2); rain(2, false); snow(1); break;
    case 'thunder': cloud(3, 0); bolt(); break;
    case 'hail': cloud(3, 2); rain(2, false); snow(2); break;
    case 'fog': fog(); break;
    case 'wind': wind(); break;
    case 'moon': moon(19, 17); break;
    case 'moonCloud': moon(13, 11); cloud(8, 12); break;
    case 'moonRain': moon(13, 9); cloud(8, 9); rain(2, false); break;
  }
  return c;
};

// ---------- the M / E / S bars: a rounded pill, dim on top, bright from the bottom up (11 fill levels) ----------
const barImg = (col, level) => {
  const w = 17, h = 82, c = mkc(w, h), g = c.getContext('2d');
  g.save(); g.beginPath(); g.roundRect(0, 0, w, h, w / 2); g.clip();
  g.fillStyle = shade(col, 0.38); g.fillRect(0, 0, w, h);
  const fh = Math.round(h * level / 10); g.fillStyle = col; g.fillRect(0, h - fh, w, fh);
  g.restore();
  return c;
};

// ---------- colour themes: every role colour is swapped for the theme's, keeping shading and edges ----------
const THEMES = [
  { name: 'Blue Alert', accent: '#5aa9ff', roles: { orange: '#5aa9ff', peach: '#a9d4ff', pink: '#7a8cff', purple: '#5b7cf0', tan: '#6f86a8' } },
  { name: 'Red Alert', accent: '#ff3b30', roles: { orange: '#ff3b30', peach: '#ff8a7a', pink: '#ff5c7a', purple: '#d83a55', tan: '#a85a55' } },
  { name: 'Sickbay Green', accent: '#3ddc84', roles: { orange: '#3ddc84', peach: '#b6f0c8', pink: '#7ad7b0', purple: '#35b387', tan: '#6fa085' } },
  { name: 'Command Gold', accent: '#ffcc33', roles: { orange: '#ffcc33', peach: '#ffe08a', pink: '#f5a742', purple: '#d9971f', tan: '#b88a4a' } },
  { name: 'Violet', accent: '#c9a0ff', roles: { orange: '#c9a0ff', peach: '#e6d3ff', pink: '#ff86d0', purple: '#9d6df0', tan: '#8f7aa8' } },
];
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const recolorImage = (cv, roles) => {
  const g = cv.getContext('2d', { willReadFrequently: true }), im = g.getImageData(0, 0, cv.width, cv.height), d = im.data;
  const base = Object.keys(ROLE).map((k) => ({ k, c: hexRgb(ROLE[k]), t: hexRgb(roles[k]) }));
  let hits = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i], gg = d[i + 1], b = d[i + 2], len = Math.hypot(r, gg, b);
    if (len < 25) continue;
    const sat = (Math.max(r, gg, b) - Math.min(r, gg, b)) / Math.max(1, Math.max(r, gg, b));
    if (sat < 0.12) continue;
    let best = null;
    for (const p of base) {
      const bb = p.c[0] * p.c[0] + p.c[1] * p.c[1] + p.c[2] * p.c[2], k = (r * p.c[0] + gg * p.c[1] + b * p.c[2]) / bb;
      if (k < 0.05 || k > 1.2) continue;
      const res = Math.hypot(r - k * p.c[0], gg - k * p.c[1], b - k * p.c[2]);
      if (!best || res < best.res) best = { res, k, p };
    }
    if (!best || best.res > len * 0.22) continue;
    d[i] = Math.min(255, best.k * best.p.t[0]); d[i + 1] = Math.min(255, best.k * best.p.t[1]); d[i + 2] = Math.min(255, best.k * best.p.t[2]);
    hits++;
  }
  g.putImageData(im, 0, 0);
  return hits;
};
