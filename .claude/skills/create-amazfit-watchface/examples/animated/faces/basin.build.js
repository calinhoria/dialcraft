// ---- Water Basin: the time in painted water digits above a mossy stone basin; a drop forms on the leaf, falls, splashes, and rings spread over the water.
// The drop lands exactly on every multiple of 6 seconds, so it hits the water as the minute changes. ----
FONT = 'Fredoka';
const IM = {};
for (const k of Object.keys(DATA.img)) { const i = new Image(); i.src = 'data:image/png;base64,' + DATA.img[k]; await i.decode(); IM[k] = i; }
const pic = (k) => (gg) => gg.drawImage(IM[k], 0, 0);
const c = mkc(W, H), g = c.getContext('2d');
g.drawImage(IM.scene, 0, 0);
await scene(c, 'scene_basin');

const digits = [];
for (let n = 0; n < 10; n++) { const im = IM['d' + n], cv = mkc(im.width, im.height); cv.getContext('2d').drawImage(im, 0, 0); digits.push(addProjectImage('water/d_' + n + '.png', cv, {}).name); }
await loadAllImages();
for (const n of ['Hour', 'Minute']) { const e = E(n); e.glyph = null; e.images = digits; e.space = 3; e.zero = 1; e.alignH = 'CENTER_H'; }
project.elements = project.elements.filter((e) => e.name !== 'Colon');
await loadAllImages();

park(['Hour', 'Minute', 'Weekday', 'Day', 'Temperature']);
cc('Hour', 118, 66); cc('Minute', 118, 170);
const wd = E('Weekday'); wd.labelAlign = 'right'; rerenderGlyphLayers(); await loadAllImages();
await dateRow(112, 416, 8);
E('Temperature').alpha = 190;
await align(['Temperature'], { r: 338, cy: 416 });

// ---- sprites, bottom to top: ripples, splash, the drop ----
const M = DATA.meta;
const rv = []; for (let i = 0; i < 6; i++) rv.push(['r' + i, pic('rp' + i)]);
await mkSlot('ripA', 'Ripple 1', rv, M.rw, M.rh, 251 - M.rw / 2, 355 - M.rh / 2, 'rip');
await mkSlot('ripB', 'Ripple 2', rv, M.rw, M.rh, 251 - M.rw / 2, 355 - M.rh / 2, 'rip');
const sv = []; for (let i = 0; i < 8; i++) sv.push(['s' + i, pic('sp' + i)]);
await mkSlot('splash', 'Splash', sv, 120, 72, 191, 292);
await mkSlot('drop', 'Drop', [['b1', pic('b1')], ['b2', pic('b2')], ['b3', pic('b3')], ['f', pic('fall')]], M.dw, M.dh, 251 - M.dw / 2, 96);
globalThis.__REFADJ = (ms) => ms - 350;

globalThis.__A = { font: 'Fredoka', size: 96, color: '#7fd6d0', stack: [['Hour', 195, 150], ['Minute', 195, 300]] };
globalThis.__G = { Date: ['Weekday', 'Day'] };
globalThis.__GB = { Water: ['Ripple 1', 'Ripple 2', 'Splash', 'Drop'] };
