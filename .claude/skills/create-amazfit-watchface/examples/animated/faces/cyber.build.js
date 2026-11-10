// ---- Neon Street: a cyberpunk street; the big pink neon clock sits in the middle over a dark haze; hover-cars cross behind it, a drone wanders in front of it, the time glitches at every minute change ----
FONT = 'Orbitron';
const IM = {};
for (const k of Object.keys(DATA.img)) { const i = new Image(); i.src = 'data:image/png;base64,' + DATA.img[k]; await i.decode(); IM[k] = i; }
const pic = (k) => (gg) => gg.drawImage(IM[k], 0, 0);
const c = mkc(W, H), g = c.getContext('2d');
g.drawImage(IM.scene, 0, 0);
// a soft dark haze behind the clock so the neon digits read over the busy towers
{ const q = g.createLinearGradient(0, 120, 0, 330); q.addColorStop(0, 'rgba(6,4,26,0)'); q.addColorStop(0.24, 'rgba(6,4,26,0.78)'); q.addColorStop(0.76, 'rgba(6,4,26,0.78)'); q.addColorStop(1, 'rgba(6,4,26,0)'); g.fillStyle = q; g.fillRect(0, 120, W, 210); }
// two dark neon-edged plates for the readings
const plate = (x, y, w, h, edge) => {
  g.save(); g.shadowColor = edge; g.shadowBlur = 8; rr(g, x, y, w, h, h / 2); g.fillStyle = 'rgba(8,6,30,0.82)'; g.fill(); g.restore();
  rr(g, x + 0.8, y + 0.8, w - 1.6, h - 1.6, h / 2); g.strokeStyle = edge; g.lineWidth = 1.6; g.stroke();
};
plate(38, 390, 168, 38, '#ff3fb4'); plate(256, 390, 96, 38, '#00d8ff');
await scene(c, 'scene_neon');

const digits = [];
for (let n = 0; n < 10; n++) { const im = IM['d' + n], cv = mkc(im.width, im.height); cv.getContext('2d').drawImage(im, 0, 0); digits.push(addProjectImage('neon/d_' + n + '.png', cv, {}).name); }
await loadAllImages();
for (const n of ['Hour', 'Minute']) { const e = E(n); e.glyph = null; e.images = digits; e.space = 4; e.zero = 1; e.alignH = 'CENTER_H'; }
const colonCv = mkc(IM.colon.width, IM.colon.height); colonCv.getContext('2d').drawImage(IM.colon, 0, 0);
const ce = E('Colon'); ce.glyph = null; ce.src = addProjectImage('neon/colon.png', colonCv, {}).name;
await loadAllImages();

park(['Hour', 'Colon', 'Minute', 'Weekday', 'Day', 'Temperature']);
await seqRow(['Hour', 'Colon', 'Minute'], 195, 225, 6);
const wd = E('Weekday'); wd.labelAlign = 'right'; rerenderGlyphLayers(); await loadAllImages();
await dateRow(122, 410, 8);
await align(['Temperature'], { cx: 304, cy: 410 });

// where the minute digits sit, for the glitch overlay (the native layer centres its digits in its box)
const hb = elBox(E('Hour')), mb = elBox(E('Minute'));
const cb = E('Colon'), PWD = 2 * Math.max(...DATA.meta.bw) + 4 + 8;
globalThis.__PER = { y: E('Minute').y, mc: Math.round(mb.x + mb.w / 2), bw: DATA.meta.bw, sp: 4, cw: DATA.meta.cw, pw: PWD, cx: cb.x, cy: cb.y };
const PX = globalThis.__PER;

// ---- sprites, bottom to top: hover-cars, one flickering street board, then (above the clock) the drone and the glitch ----
const cv_ = []; for (let i = 0; i < 4; i++) cv_.push(['c' + i, pic('car' + i)]);
await mkSlot('car', 'Hover-car', cv_, 104, 40, 140, 236);
{ const [h, label, bx, by, bwid, bh] = ['bbP', 'Board', 207, 314, 19, 51];
  const vs = [0, 1, 2, 3].map((k) => ['s' + k, (gg) => gg.drawImage(IM['bb' + k], 0, 0, IM['bb' + k].width, IM['bb' + k].height, 0, 0, bwid, bh)]);
  await mkSlot(h, label, vs, bwid, bh, bx, by); }
await mkSlot('drone', 'Drone', [['on', pic('dr0')], ['off', pic('dr1')]], 66, 40, 290, 118);
// ---- the glitch at the minute change: a patch of the street hides the minute digits, two glitched copies replace them, the colon is redrawn on top ----
const PW = PX.pw, PH = 124, PXL = Math.max(0, PX.mc - PW / 2);
await mkSlot('glP', 'Glitch cover', [['p', (gg) => gg.drawImage(c, PXL, PX.y, PW, PH, 0, 0, PW, PH)]], PW, PH, PXL, PX.y);
await mkSlot('glC', 'Glitch colon', [['c', pic('colon')]], IM.colon.width, IM.colon.height, PX.cx, PX.cy);
const gv = []; for (let d = 0; d < 10; d++) for (const st of 'sxd') gv.push([st + d, pic('g' + st + d)]);
await mkSlot('glA', 'Glitch minute 1', gv, PX.cw, 124, PXL, PX.y, 'glg');
await mkSlot('glB', 'Glitch minute 2', gv, PX.cw, 124, PXL + 60, PX.y, 'glg');
globalThis.__REFADJ = (ms) => ms + 2500;
globalThis.__A = { font: 'Orbitron', size: 96, color: '#ff5fc4', row: [195, 225, 8], col: true };
globalThis.__G = { Date: ['Weekday', 'Day'], Glitch: ['Glitch cover', 'Glitch colon', 'Glitch minute 1', 'Glitch minute 2'] };
globalThis.__GB = { Traffic: ['Hover-car'] };
globalThis.__TOP = ['Drone', 'Glitch cover', 'Glitch colon', 'Glitch minute 1', 'Glitch minute 2'];
