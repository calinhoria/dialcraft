// Concentric (Pixel Watch, Watch Face Format) for the Bip 6, from the repo's watchface.xml and a screenshot of the real face:
// two numeral rings with ticks, the hour in the middle, an outline pill running to the right edge that holds the minute. No complications.
// The ring pictures are drawn by frames.py and put into the saved project: this script only places the layers.
const CY = H / 2;
await document.fonts.load('500 24px InterMed');
const PILL = '#5ab0ff', HX = 195;
// The rings (frames.py draws every picture of them and puts it into the saved project; here they get placeholders):
//   seconds ticks: one full-screen picture the code turns 6 degrees every second, together with the seconds numerals
//   minute ticks:  an Image layer with 5 frames (the tick pattern repeats every 5 minutes), swapped once a minute by the code
//   numerals:      12 + 12 small square pictures the code moves to their next spot (seconds numerals every second, minute numerals every minute)
const NUM = 32, SEC_R = 162, MIN_R = 105, T0 = 36, M0 = 9;                 // the preview time is 10:09:36
const spot = (r, ang) => [Math.round(CX + r * Math.sin(rad(ang)) - NUM / 2), Math.round(CY - r * Math.cos(rad(ang)) - NUM / 2)];
// seconds ticks: one full-screen picture (pivot = the ring centre, the same point however the watch counts it); the code turns it by 6 degrees
// every second in the same call that moves the seconds numerals, so ticks and numerals always change together
const sr = await addImg('cc/sec-ring', mk(W, H), 0, 0, 'Seconds ring'); Object.assign(sr, { handle: 'secring', angle: (90 + 6 * T0) % 360, centerX: CX, centerY: CY });
const mr = await addImg('cc/min-placeholder', mk(284, 284), 53, 83, 'Minute ring'); mr.handle = 'minring';   // 284 x 284 round the ring centre
const nums = [];
for (let k = 0; k < 12; k++) {
  const t = String((k * 5) % 60).padStart(2, '0');
  const [sx, sy] = spot(SEC_R, 90 + 6 * T0 - 30 * k), [mx, my] = spot(MIN_R, 90 + 6 * M0 - 30 * k);
  const s = await addImg('cc/sn' + k, mk(NUM, NUM), sx, sy, 'Seconds ' + t); s.handle = 'sn' + k; nums.push(s.name);
  const m = await addImg('cc/mn' + k, mk(NUM, NUM), mx, my, 'Minute ' + t); m.handle = 'mn' + k; nums.push(m.name);
}
// the pill: an outline only, the rings show through; open at the right edge (it runs off the screen)
const pillImg = (col, lw, back) => { const c = mk(142, 70), g = c.getContext('2d'), t = lw / 2; g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = 'round';
  // a stadium: the left end is a half circle as wide as half the pill's height (measured on the real face), the top and bottom run off the right edge
  if (back) { g.fillStyle = '#000'; g.beginPath(); g.moveTo(back, t); g.lineTo(35, t); g.arc(35, 35, 35 - t, -Math.PI / 2, Math.PI / 2, true); g.lineTo(back, 70 - t); g.closePath(); g.fill(); }   // a black backing behind the minute, as tall as the pill; the rest of the pill stays see-through
  g.beginPath(); g.moveTo(143, t); g.lineTo(35, t); g.arc(35, 35, 35 - t, -Math.PI / 2, Math.PI / 2, true); g.lineTo(143, 70 - t); g.stroke(); return c; };
await addImg('cc/pill', pillImg(PILL, 3, 76), 248, CY - 35, 'Minute pill');
await addImg('cc/pill-aod', pillImg('#8a8a8a', 2), 248, CY - 35, 'Minute pill AOD', 'aod');
// the clock: hour and minute, no colon; a dim twin for always-on
for (const n of ['Hour', 'Minute', 'Colon']) { const e = E(n); if (e) { e.name = n + ' Main'; e.show = 'normal'; } }
const mg = E('Hour Main').group; if (mg) project.groups[mg] = 'Clock';
project.elements = project.elements.filter((x) => x.name !== 'Colon Main');
await applyPreset('clock');
project.elements = project.elements.filter((x) => !(x.name === 'Colon' && x.show !== 'aod'));
for (const n of ['Hour', 'Minute', 'Colon']) { const e = project.elements.find((x) => x.name === n); if (e) e.show = 'aod'; }
project.elements = project.elements.filter((x) => x.name !== 'Colon');
{ const ag = E('Hour').group; if (ag) project.groups[ag] = 'Clock AOD'; }
for (const [n, size, col] of [['Hour', 78, '#cfcfcf'], ['Minute', 36, '#cfcfcf']]) {
  const e = E(n); e.glyph = Object.assign(glyphSpecFrom(glyphStyle(e)), e.glyph || {}, { font: 'InterMed', size, weight: 400, color: col }); await rerenderGlyphLayers([e], { quiet: true });
}
for (const e of project.elements) if (e.kind === 'IMG_TIME') e.space = -1;
const place = (n, cx, cy, show) => { const e = project.elements.find((x) => x.name === n && (!show || x.show === show)); const b = elBox(e); e.alignH = 'CENTER_H'; e.x = Math.round(cx - b.w / 2); e.y = vy(e, cy); return e; };
place('Hour Main', HX, CY); place('Minute Main', 291, CY); place('Hour', HX, CY, 'aod'); place('Minute', 291, CY, 'aod');
// order, bottom to top: rings, numerals, pills, clock
const want = ['Seconds ring', 'Minute ring', ...nums, 'Minute pill', 'Minute pill AOD'];
const listed = want.map((n) => project.elements.find((x) => x.name === n)).filter(Boolean);
const bgl = project.elements.filter((x) => x.kind === 'FILL_RECT');
const rest = project.elements.filter((x) => !listed.includes(x) && !bgl.includes(x));
project.elements = bgl.concat(listed, rest);
return project.elements.length;
