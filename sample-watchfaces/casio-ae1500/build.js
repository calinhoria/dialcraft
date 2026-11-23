// Casio AE-1500 style LCD (green, and a black theme): the display (LCD) and the case are two full-screen pictures (the case has a window over the display, so it can be
// deleted to keep only the display); the time, seconds, weekday and date are native, data-bound layers made of the digit pictures cut from the reference photo.
// The 12-hour time shows the P mark in the afternoon. Tap the bottom band: next colour theme (green / black). Always-on: light digits on black, no seconds.
// art.py draws every picture and post.py puts them into the saved project (here they are placeholders of the right size).
const GEO = __GEO__;
const P = GEO.pos, Z = GEO.size, N = GEO.names;
const ph = (name, [w, h]) => addProjectImage(name, mk(w, h), { replace: true });
const SIZE = { lcd: [W, H], case: [W, H], colon: Z.colon, dash: Z.dash, pm: Z.pm, colon_aod: Z.colon, blank: [8, 8] };
for (let n = 0; n < 11; n++) SIZE['bar' + n] = Z.bar;
SIZE.bell = Z.bell; SIZE.al1 = Z.al1;
for (let d = 0; d < 10; d++) SIZE['t' + d] = Z.t;
SIZE.blk = Z.blk;
for (const k of ['tcolon', 'tminus', 'tdeg', 'ic_batt', 'ic_step', 'ic_temp', 'ic_sunrise', 'ic_sunset']) SIZE[k] = Z[k];
for (const k of ['b', 'm', 's', 'a']) for (let d = 0; d < 10; d++) SIZE[k + d] = Z[k];
for (let i = 0; i < 7; i++) SIZE['w' + i] = Z.w;
for (const [n, sz] of Object.entries(SIZE)) { ph('lcd/' + n + '.png', sz); if (GEO.themed.includes(n)) ph('lcd/' + n + '__t1.png', sz); }
project.themes = { accent: '#a3a998', list: [{ name: 'Black', color: '#151518' }], recolored: GEO.themed.map((n) => 'lcd/' + n + '.png') };
const els = [];
const add = (kind, patch) => { const e = newElement(kind, Object.assign({ show: 'normal' }, patch)); project.elements.push(e); els.push(e); return e; };
add('IMG', { name: 'Display', src: 'lcd/lcd.png', x: 0, y: 0 });
// the seconds bar (between the display and the case): its picture is swapped every second by the code below, bar0 .. bar10 = that many blocks lit
add('IMG', { name: 'Seconds bar', src: 'lcd/bar5.png', images: ['lcd/bar5.png'].concat(N.bar), x: P.bar[0], y: P.bar[1], handle: 'sbar' });
// the alarm indicators: native system-status layers, shown only while an alarm is set (a watch face cannot read how many alarms there are)
add('IMG_STATUS', { name: 'Alarm bell', status: 'CLOCK', src: 'lcd/bell.png', x: P.bell[0], y: P.bell[1] });
const WITH_CASE = false;                                          // true: the green resin case, bezel, scale and lettering around the display (lcd/case.png) is put back
if (WITH_CASE) add('IMG', { name: 'Case', src: 'lcd/case.png', x: 0, y: 0 });
add('IMG_WEEK', { name: 'Weekday', images: N.w, x: P.week[0], y: P.week[1] });
// month and day are two separate widgets, and a follow=1 day only chains to a month inside the same widget: on the watch it vanished. So the day has its own x, and both keep a leading 0 (fixed width)
add('IMG_DATE', { name: 'Month', part: 'month', images: N.s, zero: 1, space: 0, unit: 'lcd/dash.png', x: P.month[0], y: P.month[1] });
add('IMG_DATE', { name: 'Day', part: 'day', images: N.s, zero: 1, space: 0, x: P.day[0], y: P.day[1] });
add('IMG_TIME', { name: 'Hour', part: 'hour', images: N.b, zero: 1, space: 0, x: P.hour[0], y: P.hour[1] });
add('IMG', { name: 'Colon', src: 'lcd/colon.png', x: P.colon[0], y: P.colon[1], w: 0, h: 0 });
add('IMG_TIME', { name: 'Minute', part: 'minute', images: N.b, zero: 1, space: 0, x: P.minute[0], y: P.minute[1] });
add('IMG_TIME', { name: 'Seconds', part: 'second', images: N.m, zero: 1, space: 0, x: P.second[0], y: P.second[1] });
// the stats: battery and temperature along the top, steps and the next sunrise / sunset along the bottom. Small digits cut from the same segments, flat icons like the bell.
{
  const TH = Z.t[1], TWd = Z.t[0], G = 4, YT = 20, YB = 398;
  const icon = (name, key, x, y, extra) => add('IMG', Object.assign({ name, src: 'lcd/' + key + '.png', x, y: y + Math.round((TH - Z[key][1]) / 2), w: 0, h: 0 }, extra || {}));
  const reading = (name, type, x, y, extra) => add('TEXT_IMG', Object.assign({ name, dataType: type, images: N.t, hSpace: 0, alignH: 'LEFT', x, y }, extra || {}));
  const wBatt = Z.ic_batt[0] + G + 3 * TWd, wTemp = Z.ic_temp[0] + G + Z.tminus[0] + 2 * TWd + TWd;
  // the top row, left to right: the alarm bell, the temperature, the battery
  const bell = els.find((e) => e.name === 'Alarm bell');
  let x = Math.round((W - (Z.bell[0] + 20 + wTemp + 24 + wBatt)) / 2);
  bell.x = x; bell.y = YT + Math.round((TH - Z.bell[1]) / 2); x += Z.bell[0] + 20;
  icon('Temperature icon', 'ic_temp', x, YT); reading('Temperature', 'WEATHER_CURRENT', x + Z.ic_temp[0] + G, YT, { unit: 'lcd/tdeg.png', negative: 'lcd/tminus.png' }); x += wTemp + 24;
  icon('Battery icon', 'ic_batt', x, YT); reading('Battery', 'BATTERY', x + Z.ic_batt[0] + G, YT);
  // the four blocks inside the battery icon show the real level (native IMG_PROGRESS, 25 % each)
  add('IMG_PROGRESS', { name: 'Battery level', dataType: 'BATTERY', images: [1, 2, 3, 4].map(() => 'lcd/blk.png'), positions: [0, 1, 2, 3].map((i) => [x + 6 + i * 6, YT + Math.round((TH - Z.ic_batt[1]) / 2) + 6]) });
  // the left column beside the seconds: the next sunrise / sunset above, the steps below (top and bottom flush with the seconds, which are 78 px tall: two rows and a 10 px gap)
  const yS = P.second[1], yP = P.second[1] + Z.m[1] - TH, L = 18, IC = Z.ic_sunrise[0], TX = L + IC + G;   // one icon column, one text column: the two readings start at the same x
  icon('Steps icon', 'ic_step', L + IC - Z.ic_step[0] - 1, yP);   // the footprint's right ink edge lines up with the sun icon's: both icons are 4 px from the same digit column
  reading('Steps', 'STEP', TX, yP);
  icon('Sunrise icon', 'ic_sunrise', L, yS); reading('Sunrise', 'SUN_RISE', TX, yS, { dot: 'lcd/tcolon.png' });
  icon('Sunset icon', 'ic_sunset', L, yS); reading('Sunset', 'SUN_SET', TX, yS, { dot: 'lcd/tcolon.png' });
  // the sunrise and the sunset share one spot: the generated code shows the one that is next
  for (const n of ['Sunrise icon', 'Sunrise']) els.find((e) => e.name === n).showWhen = 'sunrise';
  for (const n of ['Sunset icon', 'Sunset']) els.find((e) => e.name === n).showWhen = 'sunset';
}
// always-on: the time only, light digits on black, centred (no seconds beside it)
const w4 = 4 * Z.b[0] + Z.colon[0], aX = Math.round((W - w4) / 2), aY = Math.round(H / 2 - Z.b[1] / 2);
add('IMG_TIME', { name: 'Hour AOD', part: 'hour', images: N.a, zero: 1, space: 0, x: aX, y: aY, show: 'aod' });
add('IMG', { name: 'Colon AOD', src: 'lcd/colon_aod.png', x: aX + 2 * Z.b[0], y: aY, w: 0, h: 0, show: 'aod' });
add('IMG_TIME', { name: 'Minute AOD', part: 'minute', images: N.a, zero: 1, space: 0, x: aX + 2 * Z.b[0] + Z.colon[0], y: aY, show: 'aod' });
// the theme switch: a tap on the bottom band of the case ("10 YEAR BATTERY")
add('TAP', { name: 'Tap: next colour theme', action: 'theme', x: 28, y: 166, w: 301, h: 128 });
// the tap zones the owner placed in the editor (kept here so a rebuild does not lose them): weather on the temperature, calendar on the date, timer on the seconds, activity on the steps, sun & moon on the sunrise / sunset
for (const [name, app, x, y, w, h] of [['Tap zone', 'WEATHER', 96, 13, 100, 50], ['Tap zone 2', 'COUNTDOWN', 246, 323, 102, 84], ['Tap zone 3', 'STATUS', 17, 366, 136, 48], ['Tap zone 4', 'CALENDAR', 206, 77, 140, 60], ['Tap zone 5', 'SUN_AND_MOON', 17, 311, 140, 51]]) add('TAP', { name, action: 'sysapp', sysApp: 'SYSTEM_APP_' + app, x, y, w, h });
project.userImports = "import { Time as BarTime } from '@zos/sensor'";       // aliased: the generated code imports Time itself once a layer uses showWhen (sunrise / sunset), and a second import of the same name breaks the build
project.userCode = `// <seconds-bar>
// The bar down the right of the display counts the seconds in tens, like the watch's chronograph scale: it shows the last digit of the seconds: 1 block at :01, 9 at :09, all 10 at :00, :10, :20 ...
// It swaps the bar's picture when the second changes (checked every 0.1 s), and only while the screen is on.
{
  const tm = new BarTime();
  let timer = null;
  let last = -1;
  const upd = () => { try { const sec = tm.getSeconds(); if (sec === last) return; last = sec; const n = sec % 10 || 10; W.sbar.setProperty(ui.prop.MORE, { x: pxv(\${P.bar[0]}), y: pxv(\${P.bar[1]}), src: F.sbar[n + 1] }); } catch (e) {} };
  const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const tickNext = () => { upd(); timer = setTimeout(tickNext, 100); };   // polls every 0.1 s and redraws only when the second changed, so the bar never drifts from the native seconds
  const start = () => { stop(); last = -1; tickNext(); };
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { pause_call: stop, resume_call: start });
  start();
}
// </seconds-bar>
`.replace('\${P.bar[0]}', P.bar[0]).replace('\${P.bar[1]}', P.bar[1]);
project.groups = project.groups || {};
project.groups.gClock = 'Clock'; for (const n of ['Hour', 'Colon', 'Minute', 'Seconds']) els.find((e) => e.name === n).group = 'gClock';
project.groups.gDate = 'Date'; for (const n of ['Weekday', 'Month', 'Day']) els.find((e) => e.name === n).group = 'gDate';
project.groups.gAlarm = 'Alarm'; for (const n of ['Alarm bell']) els.find((e) => e.name === n).group = 'gAlarm';
project.groups.gStatTop = 'Battery and temperature'; for (const n of ['Battery icon', 'Battery', 'Temperature icon', 'Temperature']) els.find((e) => e.name === n).group = 'gStatTop';
project.groups.gStatBot = 'Steps and sun'; for (const n of ['Steps icon', 'Steps', 'Sunrise icon', 'Sunrise', 'Sunset icon', 'Sunset']) els.find((e) => e.name === n).group = 'gStatBot';
project.groups.gBar = 'Seconds bar'; els.find((e) => e.name === 'Seconds bar').group = 'gBar';
project.groups.gAod = 'Always-on'; for (const n of ['Hour AOD', 'Colon AOD', 'Minute AOD']) els.find((e) => e.name === n).group = 'gAod';
return project.elements.map((x) => x.name).join(', ');
