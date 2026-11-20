// Casio LCD: the LCD face is one full-screen picture (unlit, and a backlit twin the code swaps in for 4 s when you tap); the time, seconds, date,
// weekday and three readings are native, data-bound digit layers made of the LCD digit pictures. Always-on: light digits on black, no seconds.
// art.py draws every picture and post.py puts them into the saved project (here they are placeholders of the right size).
const GEO = __GEO__;
const P = GEO.pos, Z = GEO.size, N = GEO.names;
const ph = (name, [w, h]) => addProjectImage(name, mk(w, h), { replace: true });
const phSet = (names, size) => names.forEach((n) => ph(n, size));
ph('lcd/scene.png', [W, H]); ph('lcd/scene-lit.png', [W, H]); ph('lcd/tap.png', [8, 8]);
for (const k of ['b', 's', 't', 'a']) phSet(N[k], Z[k]);
phSet(N.w, Z.w); ph('lcd/colon.png', Z.colon); ph('lcd/colon_off.png', Z.colon); ph('lcd/colon_aod.png', Z.colon); ph('lcd/dot.png', Z.dot); ph('lcd/minus.png', Z.minus); ph('lcd/degree.png', Z.degree);
const els = [];
const add = (kind, patch) => { const e = newElement(kind, Object.assign({ show: 'normal' }, patch)); project.elements.push(e); els.push(e); return e; };
// the LCD: two pictures, F.scene[0] unlit, F.scene[1] backlit
add('IMG', { name: 'LCD', src: 'lcd/scene.png', images: ['lcd/scene.png', 'lcd/scene-lit.png'], x: 0, y: 0, handle: 'scene' });
add('IMG_WEEK', { name: 'Weekday', images: N.w, x: P.week[0], y: P.week[1] });
add('IMG_DATE', { name: 'Month', part: 'month', images: N.s, zero: 1, space: 0, x: P.month[0], y: P.month[1] });
add('IMG', { name: 'Date dot', src: 'lcd/dot.png', x: P.dot[0], y: P.dot[1], w: 0, h: 0 });
add('IMG_DATE', { name: 'Day', part: 'day', images: N.s, zero: 1, space: 0, x: P.day[0], y: P.day[1] });
const hour = add('IMG_TIME', { name: 'Hour', part: 'hour', images: N.b, zero: 1, space: 0, x: P.hour[0], y: P.hour[1] });
add('IMG_ANIM', { name: 'Blinking colon', frames: ['lcd/colon.png', 'lcd/colon_off.png'], fps: 2, repeat: 0, step: 1, animPrefix: 'lcd_colon', blink: true, x: P.colon[0], y: P.colon[1] });
add('IMG_TIME', { name: 'Minute', part: 'minute', images: N.b, zero: 1, space: 0, x: P.minute[0], y: P.minute[1] });
add('IMG_TIME', { name: 'Seconds', part: 'second', images: N.s, zero: 1, space: 0, x: P.second[0], y: P.second[1] });
for (const [label, [cx, type]] of Object.entries(P.info)) {
  const e = add('TEXT_IMG', { name: label === 'BATT' ? 'Battery' : label === 'STEP' ? 'Steps' : 'Temperature', dataType: type, images: N.t, hSpace: 0, alignH: 'CENTER_H', x: Math.round(cx - P.info_w / 2), y: P.info_y, w: P.info_w });
  if (type === 'WEATHER_CURRENT') { e.unit = 'lcd/degree.png'; e.negative = 'lcd/minus.png'; }
}
// always-on: the time only, light digits on black
// (centred on the screen: there are no seconds beside it)
const w4 = 4 * Z.b[0] + Z.colon[0], aX = Math.round((W - w4) / 2), aY = Math.round(H / 2 - Z.b[1] / 2 - 0.5);
add('IMG_TIME', { name: 'Hour AOD', part: 'hour', images: N.a, zero: 1, space: 0, x: aX, y: aY, show: 'aod' });
add('IMG', { name: 'Colon AOD', src: 'lcd/colon_aod.png', x: aX + 2 * Z.b[0], y: aY, w: 0, h: 0, show: 'aod' });
add('IMG_TIME', { name: 'Minute AOD', part: 'minute', images: N.a, zero: 1, space: 0, x: aX + 2 * Z.b[0] + Z.colon[0], y: aY, show: 'aod' });
project.groups = project.groups || {};
// Illuminator: a tap lights the LCD (the backlit picture) for 4 seconds
project.userCode = `// <illuminator>
// Tap anywhere: the LCD shows its backlit picture for 4 seconds, then goes back. Leaving the screen (it goes off) puts it back at once.
{
  let off = null;
  const light = (on) => { try { W.scene.setProperty(ui.prop.MORE, { x: pxv(0), y: pxv(0), src: F.scene[on ? 1 : 0] }); } catch (e) {} };
  const reset = () => { if (off) { clearTimeout(off); off = null; } light(false); };
  const press = () => { light(true); if (off) clearTimeout(off); off = setTimeout(() => { off = null; light(false); }, 4000); };
  ui.createWidget(ui.widget.BUTTON, { x: px(0), y: px(0), w: px(${'${W}'}), h: px(${'${H}'}), text: '', normal_src: A('lcd/tap.png'), press_src: A('lcd/tap.png'), click_func: press, show_level: ui.show_level.ONLY_NORMAL });
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { pause_call: reset });
}
// </illuminator>
`.replace('${W}', W).replace('${H}', H);
return project.elements.map((x) => x.name).join(', ');
