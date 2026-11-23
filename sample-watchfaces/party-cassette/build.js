// Party Cassette (recreated from a reference image): black face, PARTY with two lightning bolts, an orange cassette whose two reels turn slowly, the time in chunky
// grey digits, the battery as "83% BATTERY", and a row of equaliser blocks along the bottom edge. The time and battery are native layers; the reels are two pictures
// that the code turns (native angle, pivot in the middle). Always-on: the time only, dim.
const GEO = __GEO__;
const P = GEO.pos, Z = GEO.size, N = GEO.names;
const ph = (name, [w, h]) => addProjectImage(name, mk(w, h), { replace: true });
const SIZE = { bg: [W, H], colon: Z.colon, colon_a: Z.colon, unit: Z.unit, reel0: Z.reel, reel1: Z.reel, edge: Z.edge };
for (let d = 0; d < 10; d++) { SIZE['c' + d] = Z.c; SIZE['a' + d] = Z.c; SIZE['t' + d] = Z.t; }
for (const [n, sz] of Object.entries(SIZE)) ph('pc/' + n + '.png', sz);
const els = [];
const add = (kind, patch) => { const e = newElement(kind, Object.assign({ show: 'normal' }, patch)); project.elements.push(e); els.push(e); return e; };
add('IMG', { name: 'Scene', src: 'pc/bg.png', x: 0, y: 0 });
GEO.reels.forEach((r, i) => add('IMG', { name: 'Reel ' + (i ? 'right' : 'left'), src: 'pc/reel' + i + '.png', x: r[0], y: r[1], w: 0, h: 0, centerX: r[0] + Z.reel[0] / 2, centerY: r[1] + Z.reel[1] / 2, handle: 'reel' + i }));
add('IMG_TIME', { name: 'Hour', part: 'hour', images: N.c, zero: 1, space: P.space, x: P.hour[0], y: P.hour[1] });
add('IMG', { name: 'Colon', src: 'pc/colon.png', x: P.colon[0], y: P.colon[1], w: 0, h: 0 });
add('IMG_TIME', { name: 'Minute', part: 'minute', images: N.c, zero: 1, space: P.space, x: P.minute[0], y: P.minute[1] });
add('IMG', { name: 'Cassette edge', src: 'pc/edge.png', x: GEO.edge[0], y: GEO.edge[1], w: 0, h: 0 });   // the cassette's bottom outline lies over the top of the time, as in the reference
add('TEXT_IMG', { name: 'Battery', dataType: 'BATTERY', images: N.t, hSpace: 0, alignH: 'CENTER_H', unit: 'pc/unit.png', x: 3, y: P.batt[1], w: W });
const aY = Math.round(H / 2 - Z.c[1] / 2);    // always-on: the same digits, dim, on the middle of the screen
add('IMG_TIME', { name: 'Hour AOD', part: 'hour', images: N.a, zero: 1, space: P.space, x: P.hour[0], y: aY, show: 'aod' });
add('IMG', { name: 'Colon AOD', src: 'pc/colon_a.png', x: P.colon[0], y: aY, w: 0, h: 0, show: 'aod' });
add('IMG_TIME', { name: 'Minute AOD', part: 'minute', images: N.a, zero: 1, space: P.space, x: P.minute[0], y: aY, show: 'aod' });
project.userCode = `// <reels>
// The two cassette reels turn slowly (25 degrees a second), driven by the clock so the turn is smooth after a pause. Only while the screen is on.
{
  let timer = null;
  const upd = () => { try { const a = ((Date.now() / 1000) * 25) % 360; W.reel0.setProperty(ui.prop.ANGLE, a); W.reel1.setProperty(ui.prop.ANGLE, a); } catch (e) {} };
  const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const tickNext = () => { upd(); timer = setTimeout(tickNext, 100); };
  const start = () => { stop(); tickNext(); };
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { pause_call: stop, resume_call: start });
  start();
}
// </reels>
`;
project.groups = project.groups || {};
const grp = (id, name, names) => { project.groups[id] = name; for (const n of names) { const e = els.find((x) => x.name === n); if (e) e.group = id; } };
grp('gClock', 'Clock', ['Hour', 'Colon', 'Minute']); grp('gReels', 'Cassette reels', ['Reel left', 'Reel right']); grp('gAod', 'Always-on', ['Hour AOD', 'Colon AOD', 'Minute AOD']);
return project.elements.map((x) => x.name).join(', ');
