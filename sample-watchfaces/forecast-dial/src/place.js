// ===== Sketch Dial: placement, plain shapes baked in code (icons come from the owner's image files) =====
const ACC = '#FFB020', GREY = '#8D939C', DIMC = '#2B2F36', WHITE = '#F4F4F4';
const DCX = 205, DCY = 148, DR = 94;
const nm = (n) => E(n) || (() => { throw new Error('no layer ' + n); })();
// --- date row: SUN 15 NOV, centred at the top ---
park(['Weekday', 'Day', 'Month']);
const wd = E('Weekday'); wd.labelAlign = 'right'; await rerenderGlyphLayers([wd], { quiet: true }); await loadAllImages();
await dateRow(DCX, 25, 8);
{ const d = await inkBox(['Day']); ll('Month', d.r + 8, 25); await align(['Month'], { l: d.r + 8 }); await align(['Weekday', 'Day', 'Month'], { cx: DCX }); }
// --- dial: 12 dots, two thin hands, a cap ---
{
  const S = (DR + 10) * 2, c = mk(S, S), g = c.getContext('2d');
  for (let i = 0; i < 12; i++) {
    const a = rad(i * 30 - 90), x = S / 2 + Math.cos(a) * DR, y = S / 2 + Math.sin(a) * DR, q = i % 3 === 0;
    circ(g, x, y, q ? 5 : 3.4, q ? ACC : '#C9CDD3');
  }
  await addImg('dial_dots', c, DCX - S / 2, DCY - S / 2, 'Dial dots', 'normal');
}
{
  const hand = (len, w, col) => { const h = len + 12, c = mk(w, h), g = c.getContext('2d'); g.fillStyle = col; rr(g, 0, 0, w, h, w / 2); g.fill(); return c; };
  const hn = addProjectImage('hand_hour.png', hand(62, 7, ACC), {}).name, mn = addProjectImage('hand_minute.png', hand(88, 5, WHITE), {}).name;
  const cap = mk(18, 18), g = cap.getContext('2d'); circ(g, 9, 9, 9, ACC); circ(g, 9, 9, 3.5, '#000000');
  const cn = addProjectImage('hand_cap.png', cap, {}).name;
  const e = await addElement('TIME_POINTER', {});
  Object.assign(e, { name: 'Analog clock', show: 'both', centerX: DCX, centerY: DCY, hour: hn, minute: mn, second: '', cover: cn,
    hourPivotX: 3, hourPivotY: 62 + 12 - 6, minutePivotX: 2, minutePivotY: 88 + 12 - 6, coverX: DCX - 9, coverY: DCY - 9 });
}
// --- digital time, right of the pivot ---
await seqRow(['Hour', 'Colon', 'Minute'], 258, DCY + 28, 3);
// --- left column: four round shortcuts (the icons are filled in from the owner's pictures) ---
const SC = [['World clock', 'SYSTEM_APP_WORLD_CLOCK'], ['Workout', 'SYSTEM_APP_SPORT'], ['Compass', 'SYSTEM_APP_COMPASS'], ['Sun & moon', 'SYSTEM_APP_SUN_AND_MOON']];
{
  const c = mk(48, 48), g = c.getContext('2d'); circ(g, 24, 24, 22, '#101216', '#4A4F58', 2);
  for (let i = 0; i < 4; i++) {
    await addImg('sc_ring' + i, c, 23, 44 + i * 54, 'Shortcut ' + SC[i][0], 'normal');
    const t = await addElement('TAP', {});
    Object.assign(t, { name: 'Tap ' + SC[i][0], x: 23, y: 44 + i * 54, w: 48, h: 48, action: 'sysapp', sysApp: SC[i][1], show: 'normal' });
  }
}
// --- info row: sunrise / sunset, today's max / min, wind and pressure ---
{
  const arrow = (up, col) => { const c = mk(12, 14), g = c.getContext('2d'); poly(g, up ? [[6, 1], [11, 11], [1, 11]] : [[6, 13], [11, 3], [1, 3]], col); return c; };
  const A = (up, col) => addProjectImage('arrow_' + (up ? 'up' : 'dn') + '_' + col.slice(1) + '.png', arrow(up, col), {});
  const rows = [['Sunrise', true, 'Sunrise', 88, 262], ['Sunset', false, 'Sunset', 88, 287], ['Temp high', true, 'Temp high', 205, 262], ['Temp low', false, 'Temp low', 205, 287]];
  for (const [layer, up, , x, cy] of rows) {
    ll(layer, x, cy);
    A(up, ACC);
    const ar = await addImg('arrow_' + (up ? 'up' : 'dn') + '_' + ACC.slice(1), arrow(up, ACC), x - 15, cy - 7, layer + ' arrow', 'normal');
    await align([layer + ' arrow'], { cy: (await inkBox([layer])).cy + (layer === 'Sunrise' ? -1.5 : layer === 'Temp low' ? 1.5 : 0) });
  }
  ll('Wind', 284, 262); ll('Pressure', 284, 287);
}
// --- forecast row: thin separators (the days, icons and temperatures come with the icon files and the code) ---
for (const x of [74, 148, 222, 296]) {
  const e = await addElement('FILL_RECT', {}); Object.assign(e, { name: 'Forecast line ' + x, x, y: 300, w: 1, h: 71, color: DIMC, radius: 0, show: 'normal' });
}
// --- bottom rings: battery, steps, heart rate, calories ---
{
  const R = 32, LW = 6, S = (R + LW) * 2 + 4, RINGS = [['Battery', 'BATTERY', 75], ['Steps', 'STEP', 155], ['Heart rate', 'HEART', 235], ['Calories', 'CAL', 315]];
  const track = mk(S, S), g = track.getContext('2d'); g.strokeStyle = DIMC; g.lineWidth = LW; g.lineCap = 'round'; g.beginPath(); g.arc(S / 2, S / 2, R, rad(135), rad(405)); g.stroke();
  for (const [layer, dt, cx] of RINGS) {
    await addImg('ring_track_' + dt, track, cx - S / 2, 410 - S / 2, layer + ' ring track', 'normal');
    await addArc(layer + ' ring', dt, cx, 410, R, LW, 135, 405, ACC);
    cc(layer, cx, 409);
    if (layer === 'Battery') nm('Battery').x += 2;   // the % picture pads the right side
  }
}

// ===== the owner's icons (cut from the three image sheets) =====
const loadB64 = (b64) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + b64; });
const iconCanvas = async (grp, key) => { const im = await loadB64(ICONS[grp].icons[key]), c = mk(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0); return c; };
const putIcon = async (grp, key, cx, cy, name, show) => { const c = await iconCanvas(grp, key); return addImg(grp + '_' + key, c, Math.round(cx - c.width / 2), Math.round(cy - c.height / 2), name, show || 'normal'); };
{
  const sc = ['globe', 'runner', 'compass', 'moon'];
  for (let i = 0; i < 4; i++) await putIcon('sc', sc[i], 47, 68 + i * 54, 'Icon ' + SC[i][0], 'normal');
  await putIcon('info', 'sunrise', 47, 275, 'Sun icon', 'normal');
  await putIcon('info', 'wind', 264, 275, 'Wind icon', 'normal');
  const ri = [['Battery', 'bolt', 75], ['Steps', 'steps', 155], ['Heart rate', 'heart', 235], ['Calories', 'flame', 315]];
  for (const [l, k, cx] of ri) await putIcon('ring', k, cx, 437, l + ' icon', 'normal');
}
// ===== weather: the current icon (the watch picks one of 29) and the five-day forecast =====
// the 29 pictures in the watch's order (Cloudy, Shower, Snow shower, Sunny, Overcast, Light rain … Clear night), one drawn icon each
const WX29 = ['cloudy', 'shower', 'snow_shower', 'sunny', 'overcast', 'rain_light', 'snow_light', 'rain_mod', 'snow_mod', 'snow_heavy', 'rain_heavy', 'sandstorm', 'sleet', 'fog', 'haze', 'thundershower', 'snowstorm', 'dust', 'rain_extreme', 'rain_hail', 'thunder_hail', 'rainstorm_heavy', 'sand_blowing', 'sandstorm_strong', 'rainstorm', 'unknown', 'night_cloudy', 'night_rain', 'night_clear'];
{
  const names = {};
  const nameOf = async (grp, k) => { const id = grp + k; if (!names[id]) names[id] = addProjectImage(grp + '_wx_' + k + '.png', await iconCanvas(grp, k), {}).name; return names[id]; };
  const cur = []; for (const k of WX29) cur.push(await nameOf('wx', k));
  await applyPreset('weather');
  const w = E('Weather icon'); Object.assign(w, { images: cur, x: 149, y: 258, show: 'normal', w: 0, h: 0 });
  // forecast: day label, icon and low/high for five days (today first); the code fills them from the watch's weather data
  const fc = []; for (const k of WX29) fc.push(await nameOf('fc', k));
  const COLS = [[20, 54], [75, 73], [149, 73], [223, 73], [297, 73]];
  const DAYS = ['SAT', 'SUN', 'MON', 'TUE', 'WED'], TEMPS = ['7/17', '9/18', '8/16', '6/13', '8/15'], ICO = [3, 0, 4, 5, 0];
  for (let i = 0; i < 5; i++) {
    const [x, cw] = COLS[i], cx = x + cw / 2;
    const d = await addElement('TEXT', {}); Object.assign(d, { name: 'Forecast day ' + (i + 1), handle: 'fc' + i + '_d', text: DAYS[i], x, y: 302, w: cw, h: 24, size: 21, color: i === 0 ? ACC : GREY, fontFile: 'antonio-400.ttf', alignH: 'CENTER_H', alignV: 'CENTER_V', show: 'normal' });
    const ic = await addElement('IMG', { src: fc[ICO[i]] });
    Object.assign(ic, { name: 'Forecast icon ' + (i + 1), handle: 'fc' + i + '_ic', src: fc[ICO[i]], images: fc, x: Math.round(cx - 10), y: 326, show: 'normal' });
    const t = await addElement('TEXT', {}); Object.assign(t, { name: 'Forecast temp ' + (i + 1), handle: 'fc' + i + '_t', text: TEMPS[i], x, y: 349, w: cw, h: 24, size: 21, color: WHITE, fontFile: 'antonio-400.ttf', alignH: 'CENTER_H', alignV: 'CENTER_V', show: 'normal' });
  }
}
// --- AOD: the hands and the digital time stay, nothing else ---
for (const n of ['Hour', 'Colon', 'Minute', 'Weekday', 'Day', 'Month']) nm(n).show = 'both';
return project.elements.length;
