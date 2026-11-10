// ---- Cloud Windmill: the time in cloud digits above a countryside; each minute a gust blows the minute away and it drifts back (the hour too, on the hour) ----
FONT = 'Fredoka';
const IM = {};
for (const k of Object.keys(DATA.img)) { const i = new Image(); i.src = 'data:image/png;base64,' + DATA.img[k]; await i.decode(); IM[k] = i; }
const pic = (k) => (gg) => gg.drawImage(IM[k], 0, 0);

// ================= scene: the painted countryside (the windmill without sails) and nothing but the painted scene =================
const c = mkc(W, H), g = c.getContext('2d');
g.drawImage(IM.scene, 0, 0);
const plate = (x, y, w, h) => {
  g.save(); g.shadowColor = 'rgba(0,30,40,0.4)'; g.shadowBlur = 6; g.shadowOffsetY = 2; rr(g, x, y, w, h, h / 2); g.fillStyle = 'rgba(16,48,66,0.74)'; g.fill(); g.restore();
  rr(g, x + 0.6, y + 0.6, w - 1.2, h - 1.2, h / 2); g.strokeStyle = 'rgba(255,255,255,0.32)'; g.lineWidth = 1.2; g.stroke();
};
await scene(c, 'scene_windmill');

// ================= cloud digits: native, data-bound hour and minute layers drawn with ten cloud pictures =================
const digits = [];
for (let n = 0; n < 10; n++) { const im = IM['d' + n], cv = mkc(im.width, im.height); cv.getContext('2d').drawImage(im, 0, 0); digits.push(addProjectImage('cloud/d_' + n + '.png', cv, {}).name); }
await loadAllImages();
for (const n of ['Hour', 'Minute']) { const e = E(n); e.glyph = null; e.images = digits; e.space = 4; e.zero = 1; e.alignH = 'CENTER_H'; }
project.elements = project.elements.filter((e) => e.name !== 'Colon');
await loadAllImages();

park(['Hour', 'Minute', 'Temperature']);
cc('Hour', 132, 66); cc('Minute', 132, 170);
// temperature: very subtle, top right, right-aligned so it grows to the left
E('Temperature').alpha = 175;
await align(['Temperature'], { r: 344, cy: 43 });

// ================= sprite slots (bottom to top): sails, drifting clouds, birds, the night veil and its lights, then the sky covers for the wind =================
const sv = []; for (let k = 0; k < 18; k++) sv.push(['a' + k, pic('s' + k)]);
await mkSlot('sails', 'Windmill sails', sv, 152, 152, 180, 105);
await mkSlot('cl1', 'Distant cloud 1', [['a', pic('c1a')], ['f', pic('c1f')]], 54, 20, 60, 192);
await mkSlot('cl2', 'Distant cloud 2', [['a', pic('c2a')], ['f', pic('c2f')]], 42, 16, 150, 166);
await mkSlot('cl3', 'Distant cloud 3', [['a', pic('c3a')], ['f', pic('c3f')]], 34, 13, 230, 122);
const bv = [0, 1, 2].map((k) => ['b' + k, pic('b' + k)]);
await mkSlot('bird0', 'Bird 1', bv, 28, 18, 100, 120, 'bird');
await mkSlot('bird1', 'Bird 2', bv, 28, 18, 100, 150, 'bird');
await mkSlot('bird2', 'Bird 3', bv, 28, 18, 100, 175, 'bird');
const vv = []; for (let L = 1; L <= 7; L++) vv.push(['l' + L, pic('veil' + L)]);
await mkSlot('veil', 'Night veil', vv, 390, 450, 0, 0);
await mkSlot('win', 'Window light', [['w', pic('win')]], 18, 22, 256, 199);
await mkSlot('stars', 'Stars', [['sa', pic('sa')], ['sb', pic('sb')]], 240, 212, 0, 0);
await mkSlot('moon', 'Moon', [['m1', pic('m1')], ['m2', pic('m2')]], 44, 44, 218, 78);
for (let i = 0; i < 3; i++) await mkSlot('ff' + i, 'Firefly ' + (i + 1), [['on', pic('ffon')], ['dim', pic('ffdim')]], 14, 14, 60 + i * 50, 300, 'firefly');
const lv = (nm, key) => { const o = []; for (let L = 0; L <= 7; L++) o.push(['p' + L, pic(key + L)]); return o; };
await mkSlot('skyH', 'Sky hour', lv('H', 'pH'), 176, 104, 44, 14);
await mkSlot('skyM', 'Sky minute', lv('M', 'pM'), 176, 104, 44, 118);
const gv = []; for (let i = 1; i <= 8; i++) gv.push(['g' + i, pic('g' + i)]);
const rv = [3, 6, 8].map((i) => ['r' + i, pic('r' + i)]);
await mkSlot('gustH', 'Gust hour', gv, 154, 80, 44, 26, 'gust');
await mkSlot('gustM', 'Gust minute', gv, 154, 80, 44, 130, 'gust');
await mkSlot('pullH', 'Pull hour', rv, 154, 80, 44, 26, 'pull');
await mkSlot('pullM', 'Pull minute', rv, 154, 80, 44, 130, 'pull');

globalThis.__A = { font: 'Fredoka', size: 96, color: '#8fb4d8', stack: [['Hour', 195, 150], ['Minute', 195, 300]] };
globalThis.__G = { Wind: ['Sky hour', 'Sky minute', 'Gust hour', 'Gust minute', 'Pull hour', 'Pull minute'] };
globalThis.__GB = { Windmill: ['Windmill sails'], Clouds: ['Distant cloud 1', 'Distant cloud 2', 'Distant cloud 3'], Birds: ['Bird 1', 'Bird 2', 'Bird 3'], 'Day and night': ['Night veil', 'Window light', 'Stars', 'Moon', 'Firefly 1', 'Firefly 2', 'Firefly 3'] };
globalThis.__TOP = ['Sky hour', 'Sky minute', 'Gust hour', 'Gust minute', 'Pull hour', 'Pull minute'];
