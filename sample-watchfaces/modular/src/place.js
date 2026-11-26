// ===== Modular: placement. Measured from the reference (screen 387x466 -> 390x450), pictures cut from the owner's image sheets =====
const ART = /*ART*/{};
const RED = '#EE2025', WHITE = '#FFFFFF', DIV = '#2E2E30';
const nm = (n) => E(n) || (() => { throw new Error('no layer ' + n); })();
const loadB64 = (b64) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + b64; });
const canvasOf = async (k) => { const im = await loadB64(ART[k]); const c = mk(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0); return c; };
const pimg = async (k) => addProjectImage('m_' + k + '.png', await canvasOf(k), {}).name;

// --- every number on the face uses the owner's digit sheet too (so the time, the date and the readings share one hand) ---
const degCanvas = (Hh, col, r, sw) => { const w = Math.ceil(2 * r + sw + 3), c = mk(w, Hh), g = c.getContext('2d'); g.strokeStyle = col; g.lineWidth = sw; g.beginPath(); g.arc(w / 2 + 0.5, r + sw / 2 + 1, r, 0, TAU); g.stroke(); return c; };
let D20 = [], NEG20 = '', PCT20 = '', DEG20 = '';
{
  const D26 = [];
  for (let i = 0; i < 10; i++) { D20.push(await pimg('d20_' + i)); D26.push(await pimg('d26_' + i)); }
  const H = 20, stroke = 3;
  const png = (key, c) => addProjectImage('m_' + key + '.png', c, {}).name;
  // degree sign: a ring at the top of the cell; percent: Outfit, on the baseline; minus: a short bar at mid height
  const deg = png('deg20', degCanvas(H, '#fff', 2.3, 1.8));
  const neg = (() => { const w = 8, c = mk(w + 2, H), g = c.getContext('2d'); g.fillStyle = '#fff'; rr(g, 1, H * 0.5 - 1.5, w, 3, 1.5); g.fill(); return png('neg20', c); })();
  await document.fonts.load('500 28px "Outfit Medium"');
  const pct = (() => { const sz = Math.round(H / 0.72), c0 = mk(1, 1).getContext('2d'); c0.font = '500 ' + sz + 'px "Outfit Medium"'; const w = Math.ceil(c0.measureText('%').width) + 3, c = mk(w, H), g = c.getContext('2d'); g.font = '500 ' + sz + 'px "Outfit Medium"'; g.fillStyle = '#fff'; g.textBaseline = 'alphabetic'; g.fillText('%', 1.5, H - 0.5); return png('pct20', c); })();
  NEG20 = neg; PCT20 = pct; DEG20 = deg;
  const setD = (name, unit) => { const e = nm(name); e.images = D20.slice(); e.hSpace = READ_SPACE; e.unit = unit; e.negative = neg; e.dot = ''; };
  setD('Temp now', deg); setD('Temp high', deg); setD('Temp low', deg); 
  const dd = nm('Day'); dd.images = D26.slice(); dd.space = DAY_SPACE;
  await loadAllImages();
}
// --- the time: the owner's digit sheet (hour, colon, minute), ink centred on one line ---
const DIGS = []; for (let i = 0; i < 10; i++) DIGS.push(await pimg('d_' + i));
{
  const h = nm('Hour'), m = nm('Minute'), c = nm('Colon');
  h.images = DIGS.slice(); m.images = DIGS.slice(); h.space = TIME_SPACE; m.space = TIME_SPACE;
  c.src = await pimg('d_colon');
  await loadAllImages();
}
{
  const cy = TIME_CY;
  await align(['Hour'], { l: 0, cy }); await align(['Minute'], { l: 0, cy });
  const bh = await inkBox(['Hour']), bm = await inkBox(['Minute']), bc = await inkBox(['Colon']);
  const total = bh.w + COLON_GAP + bc.w + COLON_GAP + bm.w, x0 = TIME_CX - total / 2;
  await align(['Hour'], { l: x0, cy });
  await align(['Colon'], { l: x0 + bh.w + COLON_GAP, cy });
  await align(['Minute'], { l: x0 + bh.w + COLON_GAP + bc.w + COLON_GAP, cy });
}
// --- date row: TUE (red) 21, right edge on 348 ---
park(['Weekday', 'Day']);
{
  const wd = nm('Weekday'); wd.labelAlign = 'right'; await rerenderGlyphLayers([wd], { quiet: true }); await loadAllImages();
  await dateRow(DATE_CX, DATE_CY, DATE_GAP);
  await align(['Weekday', 'Day'], { r: DATE_R });
}
// --- activity rings (native arcs on dark tracks): move, exercise, stand ---
{
  const CX = 84.5, CY = 87.5;
  const RING = [['Move ring', 'CAL', 45.5, 11, '#F8144C', '#4A0A1C'], ['Exercise ring', 'FAT_BURNING', 31, 11, '#A1FD04', '#2E4A02'], ['Stand ring', 'STAND', 17.5, 10, '#00EEF5', '#004648']];
  for (const [name, dt, R, LW, col, tr] of RING) {
    const S = Math.ceil((R + LW) * 2) + 4, t = mk(S, S), g = t.getContext('2d');
    g.strokeStyle = tr; g.lineWidth = LW; g.beginPath(); g.arc(S / 2, S / 2, R, 0, TAU); g.stroke();
    await addImg('ringtrack_' + dt, t, CX - S / 2, CY - S / 2, name + ' track', 'normal');
    await addArc(name, dt, CX, CY, R, LW, -90, 270, col);
  }
}
// --- current row: the weather picture, the temperature (blue), high and low ---
const WFC = await Promise.all(Array.from({ length: 29 }, (_, i) => pimg('wxf_' + String(i).padStart(2, '0'))));
const ROW1 = 172, BLUE = '#4FB3F6', DIM = '#9A9A9A', SOFT = '#E6E6E6';
park(['Temp now', 'Temp high', 'Temp low']);
{
  const tintCv = async (key, col) => { const c = await canvasOf(key); const g = c.getContext('2d'); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); return c; };
  const TD = []; for (let i = 0; i < 10; i++) TD.push(addProjectImage('m_td20_' + i + '.png', await tintCv('d20_' + i, BLUE), {}).name);
  const degC = addProjectImage('m_degblue.png', degCanvas(20, BLUE, 2.3, 1.8), {}).name;
  const tn = nm('Temp now'); tn.images = TD; tn.unit = degC;
  addProjectImage('m_deg18.png', degCanvas(18, '#fff', 2.1, 1.6), {});
  await applyPreset('weather');
  { const w = E('Weather icon'); w.name = 'Weather now'; Object.assign(w, { images: WFC, x: Math.round(51 - SF / 2), y: Math.round(ROW1 - SF / 2), show: 'normal', w: 0, h: 0 }); }
  await loadAllImages();
  await align(['Temp now'], { l: 74, cy: ROW1 });
  const mkT = async (name, text, color) => {
    const t = await addElement('TEXT', {});
    Object.assign(t, { name, text, x: 0, y: Math.round(ROW1 - LAB_SIZE * 0.6), w: Math.ceil(LAB_SIZE * 1.4), h: Math.ceil(LAB_SIZE * 1.25), size: LAB_SIZE, color, fontFile: 'outfit-500.ttf', alignH: 'LEFT', alignV: 'CENTER_V', show: 'normal' });
  };
  if (ROW_MODE === 'arrows') {
    // the high and the low as small arrows, then the next sunrise / sunset (the watch shows whichever comes next)
    const tri = (up, col) => { const c = mk(11, 10), g = c.getContext('2d'); g.fillStyle = col; g.beginPath(); if (up) { g.moveTo(5.5, 1); g.lineTo(10.5, 9); g.lineTo(0.5, 9); } else { g.moveTo(0.5, 1); g.lineTo(10.5, 1); g.lineTo(5.5, 9); } g.closePath(); g.fill(); return c; };
    await addImg('arrow_hi', tri(true, SOFT), 100, 100, 'Arrow high', 'normal'); await addImg('arrow_lo', tri(false, DIM), 100, 100, 'Arrow low', 'normal');
    // the sun readings: the sheet's digits and colon; the preset's own icons are replaced by simple drawn ones (no sunrise / sunset pictures in the sheets)
    project.elements = project.elements.filter((e) => e.name !== 'Sunrise icon' && e.name !== 'Sunset icon');
    for (const e of project.elements) if (e.showWhen === 'sunrise' || e.showWhen === 'sunset') delete e.showWhen;
    const COLN = await pimg('d20_colon');
    for (const n of ['Sunrise', 'Sunset']) { const e = nm(n); e.images = D20.slice(); e.hSpace = 1; e.dot = COLN; e.unit = ''; e.x = 100; e.y = 100; }
    await loadAllImages();
    let r = (await inkBox(['Temp now'])).r + 14;
    await align(['Arrow high'], { l: r, cy: ROW1 }); r = (await inkBox(['Arrow high'])).r + 4;
    await align(['Temp high'], { l: r, cy: ROW1 }); r = (await inkBox(['Temp high'])).r + 10;
    await align(['Arrow low'], { l: r, cy: ROW1 }); r = (await inkBox(['Arrow low'])).r + 4;
    await align(['Temp low'], { l: r, cy: ROW1 }); r = (await inkBox(['Temp low'])).r + 14;
    // the owner's sunrise and sunset pictures (one sheet)
    const sunPic = (kind) => canvasOf('i_' + kind);
    for (const [layer, kind] of [['Sunrise', 'sunrise'], ['Sunset', 'sunset']]) { await addImg('sunpic_' + kind, await sunPic(kind), 100, 100, layer + ' icon', 'normal'); await loadAllImages(); await align([layer + ' icon'], { l: r, cy: ROW1 }); const ib = await inkBox([layer + ' icon']); await align([layer], { l: ib.r + 6, cy: ROW1 }); const db = await inkBox([layer]); nm(layer + ' icon').y = Math.round(db.b - SUNOFF[kind] - SUN_LIFT); }   // the horizon line sits SUN_LIFT px above the digits' baseline
    const names = ['Weather now', 'Temp now', 'Arrow high', 'Temp high', 'Arrow low', 'Temp low', 'Sunrise', 'Sunrise icon', 'Sunset', 'Sunset icon'];
    const bb = await inkBox(['Weather now', 'Temp now', 'Arrow high', 'Temp high', 'Arrow low', 'Temp low', 'Sunset', 'Sunset icon']); shift(names, ROW_RIGHT - bb.r, 0);
    swapSun();
  } else {
  // H: and L: = the letter in the font + the sheet's colon, whose dots sit on the digits' centre line (the font's colon sits low)
    const COL = await pimg('d20_colon'), colIm = await loadB64(ART['d20_colon']);
    const mkC = async (name) => { const e = await addElement('IMG', { src: COL }); Object.assign(e, { name, src: COL, x: 100, y: 100, show: 'normal' }); };
    await mkT('H label', 'H', SOFT); await mkT('L label', 'L', SOFT); await mkC('H colon'); await mkC('L colon');
    await loadAllImages();
    let r = (await inkBox(['Temp now'])).r + 16;
    await align(['H label'], { l: r, cy: ROW1 }); r = (await inkBox(['H label'])).r + 2;
    await align(['H colon'], { l: r, cy: ROW1 }); r = (await inkBox(['H colon'])).r + 6;
    await align(['Temp high'], { l: r, cy: ROW1 }); r = (await inkBox(['Temp high'])).r + 12;
    await align(['L label'], { l: r, cy: ROW1 }); r = (await inkBox(['L label'])).r + 2;
    await align(['L colon'], { l: r, cy: ROW1 }); r = (await inkBox(['L colon'])).r + 6;
    await align(['Temp low'], { l: r, cy: ROW1 });
    // the whole row moves right so that it ends on the clock's right edge
    const names = ['Weather now', 'Temp now', 'H label', 'H colon', 'Temp high', 'L label', 'L colon', 'Temp low'];
    const bb = await inkBox(names); shift(names, ROW_RIGHT - bb.r, 0);
  }
}
// --- the next five days: the high on top, the picture, the weekday below (filled from the watch's forecast: code below) ---
const COLX = [65, 131, 197, 263, 329], Y_T = 214, Y_I = 256, Y_L = 298;
for (const x of [32, 98, 164, 230, 296, 362]) { const e = await addElement('FILL_RECT', {}); Object.assign(e, { name: 'Divider ' + x, x, y: 205, w: 1, h: 108, color: '#2E2E30', radius: 0, show: 'normal' }); }
{
  const mkL = async (name, handle, text, cx, cy, color) => {
    const t = await addElement('TEXT', {});
    Object.assign(t, { name, handle, text, x: cx - 33, y: Math.round(cy - FC_SIZE * 0.6), w: 66, h: Math.ceil(FC_SIZE * 1.25), size: FC_SIZE, color, fontFile: 'outfit-400.ttf', alignH: 'CENTER_H', alignV: 'CENTER_V', show: 'normal' });
    return t;
  };
  const TXT = ['WED', 'THU', 'FRI', 'SAT', 'SUN'], TMP = ['30', '29', '31', '28', '27'], LOW = ['22', '21', '23', '20', '19'], ICO = [3, 0, 4, 3, 0];
  // layout of the day columns: base = the high only, stack = high over low, oneline = "30°/22°" on one line
  const YT = FC_MODE === 'stack' ? 213 : Y_T, YLOW = 236, YI = FC_MODE === 'stack' ? 266 : Y_I, YLB = Y_L;
  { const g18 = mk(11, 18), g = g18.getContext('2d'); g.strokeStyle = DIM; g.lineWidth = 1.6; g.beginPath(); g.arc(5.5, 4.5, 2.1, 0, TAU); g.stroke(); addProjectImage('m_deg18g.png', g18, {}); }
  // a number right-aligned on cx + 9 with the small degree ring right after it
  const numDeg = async (label, handle, text, cx, cy, color, degImg) => {
    const t = await mkL(label, handle, text, cx, cy, color); t.alignH = 'RIGHT'; t.x = cx + 9 - 66;
    const d = await addElement('IMG', { src: degImg }); Object.assign(d, { name: label + ' degree', src: degImg, x: cx + 10, y: cy - 10, show: 'normal' });
    await loadAllImages(); await align([label], { r: cx + 9 }); const nb = await inkBox([label]); await align([label + ' degree'], { l: nb.r + 2, t: nb.y });
  };
  for (let i = 0; i < 5; i++) {
    if (FC_MODE === 'oneline') { const t = await mkL('Day temp ' + (i + 1), 'fc' + i + '_t', TMP[i] + '\u00b0/' + LOW[i] + '\u00b0', COLX[i], YT, '#FFFFFF'); t.size = 19; }
    else {
      await numDeg('Day temp ' + (i + 1), 'fc' + i + '_t', TMP[i], COLX[i], YT, '#FFFFFF', 'm_deg18.png');
      if (FC_MODE === 'stack') await numDeg('Day low ' + (i + 1), 'fc' + i + '_l', LOW[i], COLX[i], YLOW, DIM, 'm_deg18g.png');
    }
    await mkL('Day label ' + (i + 1), 'fc' + i + '_d', TXT[i], COLX[i], YLB, DIM);
    const ic = await addElement('IMG', { src: WFC[ICO[i]] });
    Object.assign(ic, { name: 'Day icon ' + (i + 1), handle: 'fc' + i + '_ic', src: WFC[ICO[i]], images: [WFC[ICO[i]], ...WFC], x: Math.round(COLX[i] - SF / 2), y: Math.round(YI - SF / 2), show: 'normal' });
  }
}
// --- three round complications the wearer can swap (long-press the face): calories, steps, heart rate, battery ---
// every choice brings its own icon, value, dim track and ring; the heart-rate ring is a plain full ring, because a heart rate has no goal to fill towards
{
  const CXS = [81, 199, 317], CY = 381.5, R = 47, LW = 6, S = (R + LW) * 2 + 4, FRAME = 104;
  const CH = {
    CAL: { label: 'Calories', track: '#4A2A12', arc: '#FF6A00', icon: 'flame', icy: 362, goal: true },
    STEP: { label: 'Steps', track: '#173A52', arc: '#2FA2FF', icon: 'shoe', icy: 360, goal: true },
    HEART: { label: 'Heart rate', track: '#4A2220', arc: '#FF3B30', icon: 'heart', icy: 362, goal: false },
    BATTERY: { label: 'Battery', track: '#1A4A28', arc: '#30D158', icon: 'batt', icy: 363, goal: true },
  };
  const DEFAULT = ['CAL', 'STEP', 'BATTERY'];
  // the select frames shown while the wearer customises
  const frame = (a, w) => { const c = mk(FRAME, FRAME), g = c.getContext('2d'); g.strokeStyle = 'rgba(255,255,255,' + a + ')'; g.lineWidth = w; g.beginPath(); g.arc(FRAME / 2, FRAME / 2, FRAME / 2 - 2, 0, TAU); g.stroke(); return c; };
  const unsel = addProjectImage('slot_unsel.png', frame(0.35, 2), {}).name, sel = addProjectImage('slot_sel.png', frame(1, 3), {}).name;
  for (let i = 0; i < 3; i++) {
    const cx = CXS[i], k = i + 1, opts = [];
    for (const [type, c] of Object.entries(CH)) {
      const tie = (e) => { e.editSlot = k; e.editType = type; return e; };
      const tr = mk(S, S), g = tr.getContext('2d'); g.strokeStyle = c.track; g.lineWidth = LW; g.beginPath(); g.arc(S / 2, S / 2, R, 0, TAU); g.stroke();
      tie(await addImg('ctrack_' + type, tr, cx - S / 2, CY - S / 2, 'Slot ' + k + ' ' + c.label + ' track', 'normal'));
      if (c.goal) tie(await addArc('Slot ' + k + ' ' + c.label + ' ring', type, cx, CY, R, LW, -90, 270, c.arc));
      else { const rg = mk(S, S), h = rg.getContext('2d'); h.strokeStyle = c.arc; h.lineWidth = LW; h.beginPath(); h.arc(S / 2, S / 2, R, 0, TAU); h.stroke(); tie(await addImg('cring_' + type, rg, cx - S / 2, CY - S / 2, 'Slot ' + k + ' ' + c.label + ' ring', 'normal')); }
      let prev = '';
      if (ART['i_' + c.icon]) {
        const nmI = await pimg('i_' + c.icon), im = await loadB64(ART['i_' + c.icon]); prev = nmI;
        const e = await addElement('IMG', { src: nmI }); Object.assign(e, { name: 'Slot ' + k + ' ' + c.label + ' icon', src: nmI, x: Math.round(cx - im.width / 2), y: Math.round(c.icy - im.height / 2), show: 'normal' }); tie(e);
      }
      await dataTextPreset(type, 'Slot ' + k + ' ' + c.label + ' value', '', ['negative', '-']);
      const v = nm('Slot ' + k + ' ' + c.label + ' value'); v.images = D20.slice(); v.hSpace = READ_SPACE; v.negative = NEG20; v.dot = ''; v.unit = type === 'BATTERY' ? PCT20 : ''; tie(v);
      cc(v.name, cx + (type === 'BATTERY' ? 2 : 0), VAL_CY);
      opts.push({ type, preview: prev });
    }
    const slot = await addElement('EDIT_SLOT', {});
    Object.assign(slot, { name: 'Complication ' + k, editId: k, x: Math.round(cx - FRAME / 2), y: Math.round(CY - FRAME / 2), w: FRAME, h: FRAME, defaultType: DEFAULT[i], optionalTypes: opts, selectImage: sel, unSelectImage: unsel, show: 'normal' });
  }
}
// --- the top-left zone is a complication too: the three activity rings (default), or one big ring with a reading inside ---
{
  const CX = 84.5, CY = 87.5, R = 45.5, LW = 10, S = 2 * (R + LW) + 4, FR = 108, K = 4;
  const tie = (e, type) => { e.editSlot = K; e.editType = type; return e; };
  for (const n of ['Move ring track', 'Move ring', 'Exercise ring track', 'Exercise ring', 'Stand ring track', 'Stand ring']) tie(nm(n), 'CAL');
  const CH = { BATTERY: ['Battery', '#1A4A28', '#30D158', true], STEP: ['Steps', '#173A52', '#2FA2FF', true], HEART: ['Heart rate', '#4A2220', '#FF3B30', false] };
  const opts = [{ type: 'CAL', preview: '' }];
  for (const [type, [label, trc, col, goal]] of Object.entries(CH)) {
    const tr = mk(S, S), g = tr.getContext('2d'); g.strokeStyle = goal ? trc : col; g.lineWidth = LW; g.beginPath(); g.arc(S / 2, S / 2, R, 0, TAU); g.stroke();
    tie(await addImg('bigtrack_' + type, tr, CX - S / 2, CY - S / 2, 'Ring zone ' + label + ' track', 'normal'), type);
    if (goal) tie(await addArc('Ring zone ' + label + ' ring', type, CX, CY, R, LW, -90, 270, col), type);
    await dataTextPreset(type, 'Ring zone ' + label + ' value', '', ['negative', '-']);
    const v = nm('Ring zone ' + label + ' value'); v.images = D20.slice(); v.hSpace = READ_SPACE; v.negative = NEG20; v.dot = ''; v.unit = type === 'BATTERY' ? PCT20 : ''; tie(v, type);
    cc(v.name, CX + (type === 'BATTERY' ? 2 : 0), CY);
    opts.push({ type, preview: '' });
  }
  const frame = (a, w) => { const c = mk(FR, FR), g = c.getContext('2d'); g.strokeStyle = 'rgba(255,255,255,' + a + ')'; g.lineWidth = w; g.beginPath(); g.arc(FR / 2, FR / 2, FR / 2 - 2, 0, TAU); g.stroke(); return c; };
  const slot = await addElement('EDIT_SLOT', {});
  Object.assign(slot, { name: 'Complication ' + K, editId: K, x: Math.round(CX - FR / 2), y: Math.round(CY - FR / 2), w: FR, h: FR, defaultType: 'CAL', optionalTypes: opts,
    selectImage: addProjectImage('slot4_sel.png', frame(1, 3), {}).name, unSelectImage: addProjectImage('slot4_unsel.png', frame(0.35, 2), {}).name, show: 'normal' });
}
// --- tap zones on every complication: a tap opens the matching watch screen (one zone per choice, only the picked one exists) ---
{
  const APP = { CAL: 'SYSTEM_APP_STATUS', STEP: 'SYSTEM_APP_STATUS', HEART: 'SYSTEM_APP_HR', BATTERY: 'SYSTEM_APP_SETTING' };
  const ZONES = [[4, 84.5, 87.5, 104, ['CAL', 'BATTERY', 'STEP', 'HEART']], [1, 81, 381.5, 100, ['CAL', 'STEP', 'HEART', 'BATTERY']], [2, 199, 381.5, 100, ['CAL', 'STEP', 'HEART', 'BATTERY']], [3, 317, 381.5, 100, ['CAL', 'STEP', 'HEART', 'BATTERY']]];
  for (const [k, cx, cy, sz, types] of ZONES) for (const type of types) {
    const t = await addElement('TAP', {});
    Object.assign(t, { name: 'Tap complication ' + k + ' ' + type, x: Math.round(cx - sz / 2), y: Math.round(cy - sz / 2), w: sz, h: sz, action: 'sysapp', sysApp: APP[type], show: 'normal', editSlot: k, editType: type });
  }
}
// --- AOD: the time and the date stay ---
for (const n of ['Hour', 'Colon', 'Minute', 'Weekday', 'Day']) nm(n).show = 'both';
return project.elements.length;
