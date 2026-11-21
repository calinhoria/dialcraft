// ---- Patrol Visor build (runs after kit.js inside a face-cli script step) ----
/*IMGS*/
/*GEO*/
/*POS*/
const PIC = {};
const toCanvas = async (b) => { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); const c = mk(im.naturalWidth, im.naturalHeight); c.getContext('2d').drawImage(im, 0, 0); return c; };
const pic = async (k) => { if (!PIC[k]) PIC[k] = addProjectImage('rc/' + k + '.png', await toCanvas(IMGS[k]), {}).name; return PIC[k]; };
const blankPic = (k, w, h) => { if (!PIC[k]) PIC[k] = addProjectImage('rc/' + k + '.png', mk(w, h), {}).name; return PIC[k]; };
const digits = async (p) => { const o = []; for (let i = 0; i < 10; i++) o.push(await pic(p + i)); return o; };
const log = [];

// scene
const sc = await addElement('IMG', { src: await pic('scene') });
Object.assign(sc, { name: 'Scene', src: await pic('scene'), x: 0, y: 0, show: 'normal', locked: true });
for (const [k, nm, xy] of [['icon_heart', 'Heart icon', HPOS], ['icon_bat', 'Battery shell', BPOS]]) {
  const e = await addElement('IMG', { src: await pic(k) }); Object.assign(e, { name: nm, src: await pic(k), x: xy[0], y: xy[1], show: 'normal' });
}

// clock (normal) and its dim twin (AOD)
const D = await digits('d'), N = await digits('n');
const clockSet = async (suffix, imgs, colon, show) => {
  for (const [part, x] of [['Hour', G.HX], ['Minute', G.MX]]) {
    const e = E(part + ' ' + suffix); delete e.glyph; Object.assign(e, { images: imgs, space: G.SP, x, y: G.Y, show, zero: 1 });
  }
  const c = E('Colon ' + suffix); delete c.glyph; Object.assign(c, { src: await pic(colon), w: 0, h: 0, x: G.CX, y: G.Y, show });
};
await clockSet('Main', D, 'colon', 'normal');
await clockSet('AOD', N, 'ncolon', 'aod');

// readings: the visor digits, small, centred under their plates
const R = await digits('r');
for (const [n, cx] of [['Heart rate', 112], ['Steps', 195], ['Battery', 279]]) {
  const e = E(n); Object.assign(e, { images: R, unit: '', hSpace: -2, alignH: 'CENTER_H', show: 'normal' }); delete e.glyph;
}
await loadAllImages();
for (const [n, cx] of [['Heart rate', 112], ['Steps', 195], ['Battery', 279]]) cc(n, cx, 372);

// bars: native segment progress (steps in the chin slot, battery cells inside the battery shell)
const sb = await pic('seg_s'), bb = await pic('seg_b');
await segBar('Steps bar', 'STEP', STEPPOS.map(() => sb), STEPPOS);
await segBar('Battery cells', 'BATTERY', BATPOS.map(() => bb), BATPOS);

// engraved date on the forehead plate
const wd = E('Weekday'); wd.labelAlign = 'right';
await rerenderGlyphLayers([wd, E('Day')]); await loadAllImages();
E('Day').space = -5; park(['Weekday', 'Day']); await dateRow(195, 64, 10);

// sprite slots (first picture = what the still preview shows)
const slot = async (handle, name, keys, x, y) => {
  const imgs = []; for (const k of keys) imgs.push(typeof k === 'string' ? await pic(k) : blankPic(k[0], k[1], k[2]));
  const e = await addElement('IMG', { src: imgs[0] });
  Object.assign(e, { name, src: imgs[0], images: imgs, handle, x: Math.round(x), y: Math.round(y), show: 'normal' }); return e;
};
const coverW = G.CV[2] - G.CV[0], coverH = G.CV[3] - G.CV[1];
await slot('cover', 'Recalibrate cover', [['blank_cover', coverW, coverH], 'cover'], G.CV[0], G.CV[1]);
const GD = []; for (let i = 0; i < 10; i++) GD.push('g' + i);
await slot('gM1', 'Glitch minute tens', [['blank_g', 77, 100]].concat(GD), G.MX, G.Y);
await slot('gM2', 'Glitch minute ones', [['blank_g', 77, 100]].concat(GD), G.MX + G.DW + G.SP, G.Y);
await slot('beam', 'Scan beam', [['blank_beam', G.BEAM[0], G.BEAM[1]], 'beam'], 195 - G.BEAM[0] / 2, 200);
const tx = G.MX + (2 * G.DW + G.SP) / 2, ty = G.Y + 50;
await slot('ret', 'Reticle', ['ret2', 'ret0', 'ret1', ['blank_ret', G.RS, G.RS]], tx - G.RS / 2, ty - G.RS / 2);
await slot('led', 'Status light', ['led_on', 'led_dim', 'led_off'], 108, 23);

// layer order, bottom to top
const order = ['Background', 'Scene', 'Heart icon', 'Battery shell', 'Steps bar', 'Battery cells', 'Heart rate', 'Steps', 'Battery', 'Weekday', 'Day',
  'Minute AOD', 'Colon AOD', 'Hour AOD', 'Minute Main', 'Colon Main', 'Hour Main',
  'Recalibrate cover', 'Glitch minute tens', 'Glitch minute ones', 'Scan beam', 'Reticle', 'Status light'];
const listed = order.map(E), miss = order.filter((n, i) => !listed[i]);
const rest = project.elements.filter((e) => !listed.includes(e));
project.elements = listed.filter(Boolean).concat(rest);
log.push('missing:' + miss.join(',') + ' extra:' + rest.map((e) => e.name).join(','));

// groups
project.groups = {};
const GR = { Clock: ['Minute Main', 'Colon Main', 'Hour Main'], 'Clock AOD': ['Minute AOD', 'Colon AOD', 'Hour AOD'], Date: ['Weekday', 'Day'],
  Vitals: ['Heart icon', 'Heart rate'], Patrol: ['Steps bar', 'Steps'], 'Power cell': ['Battery shell', 'Battery cells', 'Battery'],
  'Visor FX': ['Recalibrate cover', 'Glitch minute tens', 'Glitch minute ones', 'Scan beam', 'Reticle', 'Status light'] };
for (const [g, list] of Object.entries(GR)) {
  const id = 'g' + g.replace(/\W/g, ''); project.groups[id] = g; let n = 0;
  for (const nm of list) { const e = project.elements.find((x) => x.name === nm); if (e) { e.group = id; n++; } }
  log.push(g + ':' + n);
}
await loadAllImages();
return log.join(' ');
