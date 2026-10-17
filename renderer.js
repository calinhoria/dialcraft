'use strict';
// Renderer for the Amazfit (Zepp OS) watchface designer.
//
// The editor model is a plain object:
//   project = { version, name, device, appId, vender, description, font,
//               groups, elements[], images[] }
// `elements` are the watchface widgets (see core/kinds.js for the kind list and
// the Zepp docs at https://docs.zepp.com/docs/watchface/api/hmUI/widget/ for the
// parameters each one maps to). `images` is the project image pool; each image
// is { name, width, height, url } where url is a data: URL so the canvas can
// draw it and the main process can write the PNG on save.
//
// core/codegen.js turns the same model into a Zeus CLI project (app.json +
// app.js + watchface/<target>/index.js), so every field edited here has to stay
// in sync with the emitters there.

const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ state --
let META = null;
let DEVICES = [], DATA_TYPES = [], KINDS = [], SHOW_LEVELS = [], WEATHER_ICONS = [], SYSTEM_STATUS = [];
const DT_BY_KEY = {};
const KIND_BY_ID = {};

let project = null;
let selectedId = null;
let multiSel = new Set();
let groupCollapsed = new Set();      // group ids collapsed in the Layers panel
let dirty = false;

let previewMode = 'normal';          // 'normal' | 'aod'
let liveClock = false;
let clockTimer = null;

let showGrid = true;
let showMask = true;
let exportRender = false;            // true while composing the saved preview
let guides = { v: [], h: [] };

const GRID_PX = 20;
const SNAP_PX = 4;
const SAFE_PX = 2;
const REF_CLOCK = { h: 10, m: 9, s: 36 };  // design-spec reference time 10:09:36
const REF_DATE = { day: 17, month: 10, year: 2026, weekday: 6 }; // 1 = Monday

let clock = { ...REF_CLOCK };
let dateParts = { ...REF_DATE };
let testData = {};                    // dataType key -> preview value

const imgCache = new Map();           // name -> HTMLImageElement
let glyphFont = 'Orbitron';

// geometric kinds whose anchor is a centre rather than a top-left corner
const CENTER_KINDS = new Set(['CIRCLE', 'ARC_PROGRESS', 'TIME_POINTER']);
// kinds whose box is driven by the w/h fields (resizable from the corners)
const WH_KINDS = new Set(['IMG', 'IMG_LEVEL', 'IMG_PROGRESS', 'IMG_POINTER', 'IMG_ANIM',
  'IMG_STATUS', 'IMG_CLICK', 'TEXT', 'FILL_RECT', 'STROKE_RECT', 'ARC']);
// kinds that draw digit images and therefore take an image array + metrics
const SET_KINDS = new Set(['IMG_TIME', 'IMG_WEEK', 'IMG_DATE', 'TEXT_IMG', 'IMG_LEVEL', 'IMG_PROGRESS']);

const dev = () => DEVICES.find((d) => d.target === (project && project.device)) || DEVICES[0];
const dtByKey = (k) => DT_BY_KEY[k] || null;
const kindById = (k) => KIND_BY_ID[k] || null;
const elements = () => (project ? project.elements : []);
const elementById = (id) => elements().find((e) => e.id === id) || null;
const selEl = () => elementById(selectedId);
const selection = () => elements().filter((e) => multiSel.has(e.id));

// ------------------------------------------------------------------ toast --
const TOAST_MS = 10000;
let toastEl = null, toastTimer = null, toastStart = 0, toastLeft = TOAST_MS;
function dismissToast() {
  if (!toastEl) return;
  clearTimeout(toastTimer);
  toastEl.remove(); toastEl = null;
}
function showUndoToast(message, onUndo, label = 'Undo') {
  dismissToast();
  const host = $('toastHost');
  const el = document.createElement('div');
  el.className = 'toast';
  const msg = document.createElement('span');
  msg.className = 'tmsg'; msg.textContent = message;
  const btn = document.createElement('button');
  btn.className = 'tbtn'; btn.textContent = label;
  btn.onclick = () => { dismissToast(); onUndo(); };
  const close = document.createElement('button');
  close.className = 'tclose'; close.title = 'Dismiss';
  close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  close.onclick = () => dismissToast();
  const bar = document.createElement('div');
  bar.className = 'tbar';
  el.appendChild(msg); el.appendChild(btn); el.appendChild(close); el.appendChild(bar);
  el.onmouseenter = () => { el.classList.add('paused'); toastLeft -= (Date.now() - toastStart); clearTimeout(toastTimer); };
  el.onmouseleave = () => { el.classList.remove('paused'); toastStart = Date.now(); toastTimer = setTimeout(dismissToast, toastLeft); };
  host.appendChild(el);
  toastEl = el; toastStart = Date.now(); toastLeft = TOAST_MS;
  toastTimer = setTimeout(dismissToast, TOAST_MS);
}

function status(msg, isErr) {
  const m = $('meta');
  m.textContent = msg || '';
  m.classList.toggle('err', !!isErr);
}

// ------------------------------------------------------------------ history --
let past = [], future = [];
function snapshot() { return project ? JSON.stringify(project) : null; }
function updateHistoryButtons() {
  $('btnUndo').disabled = !past.length;
  $('btnRedo').disabled = !future.length;
}
function pushHistory() {
  const s = snapshot();
  if (s == null) return;
  if (past.length && past[past.length - 1] === s) return;
  past.push(s);
  if (past.length > 80) past.shift();
  future = [];
  dirty = true;
  updateHistoryButtons();
  scheduleCode();
}
function restoreHistory(json) {
  const p = JSON.parse(json);
  project.elements = p.elements;
  project.groups = p.groups || {};
  project.name = p.name; project.description = p.description;
  project.appId = p.appId; project.font = p.font;
  project.images = p.images || project.images;
  loadAllImages();
  if (selectedId && !elementById(selectedId)) selectedId = null;
  multiSel = new Set([...multiSel].filter((id) => elementById(id)));
  dirty = true;
  refreshPanels(); render(); scheduleCode();
}
function undo() {
  if (!past.length) return;
  future.push(snapshot());
  restoreHistory(past.pop());
  updateHistoryButtons();
}
function redo() {
  if (!future.length) return;
  past.push(snapshot());
  restoreHistory(future.pop());
  updateHistoryButtons();
}
window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
  if (!project) return;
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); doSave(); return; }
  if (mod && e.key.toLowerCase() === 'g') { e.preventDefault(); e.shiftKey ? ungroup() : groupSelection(); return; }
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelection(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const sel = selection();
    if (!sel.length) return;
    if (document.activeElement && /input|select|textarea/i.test(document.activeElement.tagName)) return;
    e.preventDefault(); deleteSelection(); return;
  }
  if (e.key === 'Escape') { selectedId = null; multiSel = new Set(); refreshPanels(); render(); return; }
  if (e.key.startsWith('Arrow') && selection().length) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const d = e.key === 'ArrowLeft' ? [-step, 0] : e.key === 'ArrowRight' ? [step, 0] : e.key === 'ArrowUp' ? [0, -step] : [0, step];
    pushHistory();
    for (const el of selection()) moveEl(el, d[0], d[1]);
    refreshPanels(); render();
  }
});

// ------------------------------------------------------------------ images --
function loadImageEl(img) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = img.url;
  });
}
async function loadAllImages() {
  imgCache.clear();
  if (!project) return;
  await Promise.all(project.images.map(async (it) => {
    const im = await loadImageEl(it);
    if (im) imgCache.set(it.name, im);
  }));
}
function imgFor(name) { return name ? imgCache.get(name) || null : null; }
function imgMeta(name) { return (project && project.images.find((i) => i.name === name)) || null; }

function addProjectImage(name, canvas, { replace = true } = {}) {
  const url = canvas.toDataURL('image/png');
  const w = canvas.width, h = canvas.height;
  const existing = project.images.find((i) => i.name === name);
  if (existing) {
    if (!replace) { name = uniqImageName(name); }
    else { existing.url = url; existing.width = w; existing.height = h; return { name, url }; }
  }
  project.images.push({ name, width: w, height: h, url });
  return { name, url };
}
function uniqImageName(base) {
  const taken = new Set(project.images.map((i) => i.name));
  if (!taken.has(base)) return base;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  let n = 2;
  while (taken.has(`${stem}_${n}${ext}`)) n++;
  return `${stem}_${n}${ext}`;
}
function imageDataBase64(img) { return String(img.url || '').split(',')[1] || ''; }
function projectImagesPayload() {
  return project.images.map((i) => ({ name: i.name, dataBase64: imageDataBase64(i) }));
}
// imported fonts: the file travels with the project (<dir>/fonts/<file>) and is
// copied into the Zeus export when a Text layer actually uses it
function fontRecords() {
  return customFonts.map((f) => ({
    name: f.name, family: f.family, ext: f.ext, format: f.format, dataBase64: f.dataBase64,
  }));
}
function projectFontsPayload() { return customFonts.map((f) => ({ name: f.name, family: f.family })); }

// ------------------------------------------------------------------- fonts --
// The typeface catalogue arrives with the meta payload (core/fonts.js). Fonts
// imported by the user are registered here with FontFace, kept in memory as data
// URLs and written to <project>/fonts/ on save, so a project stays portable.
let BUNDLED_FONTS = [];
let FONT_VARIATIONS = {};
const customFonts = [];              // { name, family, ext, format, url, dataBase64 }
const fontCache = new Set();         // families already handed to document.fonts
let glyphOpts = { size: 48, color: '#ffffff', weight: 400, variations: '' };

function baseName(p) { return String(p || '').split(/[\\/]/).pop(); }
function customFont(family) { return customFonts.find((f) => f.family === family); }
function bundledFont(family) { return BUNDLED_FONTS.find((f) => f.family === family); }
function fontFamilies() { return [...customFonts.map((f) => f.family), ...BUNDLED_FONTS.map((f) => f.family)]; }
function fontUrlFor(family) {
  const c = customFont(family);
  if (c) return c.url;
  const b = bundledFont(family);
  return b ? b.file : null;
}
// a Text layer stores the font *file* it ships with; map it back to a family
function familyForFontFile(file) {
  if (!file) return null;
  const n = baseName(file);
  const c = customFonts.find((f) => f.name === n);
  if (c) return c.family;
  const b = BUNDLED_FONTS.find((x) => baseName(x.file) === n);
  return b ? b.family : null;
}
function fontFileOptions() {
  const out = [{ value: '', label: 'System font (default)' }];
  for (const f of customFonts) out.push({ value: f.name, label: `${f.family} · imported` });
  for (const f of BUNDLED_FONTS) out.push({ value: baseName(f.file), label: `${f.family} · bundled` });
  return out;
}
async function registerCustomFont(rec, { quiet } = {}) {
  let family = rec.family || baseName(rec.name).replace(/\.[^.]+$/, '');
  // two files can share a family (Inter-Bold vs Inter-Thin): keep them apart so
  // each one can be rasterized and shipped on its own
  if (customFonts.some((f) => f.family === family && f.name !== rec.name)) {
    family = rec.full || rec.subfamily ? `${rec.family || family} ${rec.subfamily || rec.full}`.trim() : `${family} ${customFonts.length + 1}`;
  }
  const url = rec.url || (rec.dataBase64 ? `data:font/${rec.format || 'ttf'};base64,${rec.dataBase64}` : null);
  if (!url) return null;
  const entry = {
    name: rec.name, family,
    ext: rec.ext || ('.' + (baseName(rec.name).split('.').pop() || 'ttf')),
    format: rec.format || 'truetype',
    url, dataBase64: rec.dataBase64 || '',
  };
  const at = customFonts.findIndex((f) => f.name === entry.name);
  if (at >= 0) customFonts[at] = entry; else customFonts.push(entry);
  try {
    const ff = new FontFace(family, `url("${url}")`);
    await ff.load();
    document.fonts.add(ff);
    fontCache.add(family);
    return entry;
  } catch (e) {
    if (!quiet) status(`Could not load “${family}” (${e && e.message ? e.message : e}).`, true);
    return entry;
  }
}
function setFontOn(ctx, family, size, weight, variations) {
  const w = +weight || 0;
  ctx.font = `${w && w !== 400 ? `${w} ` : ''}${size}px "${family}"`;
  const v = (variations != null && variations !== '') ? variations : FONT_VARIATIONS[family];
  try { ctx.fontVariationSettings = v || 'normal'; } catch (e) { /* unsupported */ }
}
async function ensureFont(family, weight) {
  if (!family) return false;
  if (fontCache.has(family)) return true;
  const src = fontUrlFor(family);
  if (!src) return false;
  try {
    const ff = new FontFace(family, `url("${src}")`, weight ? { weight: String(weight) } : undefined);
    await ff.load();
    document.fonts.add(ff);
    fontCache.add(family);
    await document.fonts.ready;
    return true;
  } catch (e) { return false; }
}
function fillFontSelect(sel) {
  sel.innerHTML = '';
  const cats = [];
  const addTo = (label, f) => {
    let g = cats.find((x) => x.label === label);
    if (!g) { g = document.createElement('optgroup'); g.label = label; cats.push(g); sel.appendChild(g); }
    const o = document.createElement('option');
    o.value = f.family; o.textContent = f.family;
    g.appendChild(o);
  };
  for (const f of customFonts) addTo('Project fonts', f);
  for (const f of BUNDLED_FONTS) addTo(f.cat || 'Bundled', f);
  sel.value = glyphFont;
}

// font_#_0-9 style asset naming rules from the watchface specification
let glyphSetSeq = 1;
function nextDigitPrefix() {
  const used = project.images
    .map((i) => /^font_(\d+)_\d+\.png$/.exec(i.name))
    .filter(Boolean).map((m) => +m[1]);
  let n = 1;
  while (used.includes(n)) n++;
  glyphSetSeq = n + 1;
  return `font_${n}`;
}

// Draw a set of glyphs from one font into transparent PNGs and register them.
// mono=true shares one cell width so digits line up; entries are {tag,char}.
async function genGlyphImages(entries, opts = {}) {
  const {
    size = glyphOpts.size, color = glyphOpts.color, prefix = null, mono = true,
    family = null, weight = glyphOpts.weight, variations = glyphOpts.variations,
  } = opts;
  const fam = family || glyphFont;
  if (!await ensureFont(fam, weight)) throw new Error(`Font not available: ${fam}`);
  const chars = entries.map((e) => e.char).join('');
  try { await document.fonts.load(`${weight && weight !== 400 ? weight + ' ' : ''}${size}px "${fam}"`, chars); } catch (e) { /* keep going */ }
  const meas = document.createElement('canvas').getContext('2d');
  setFontOn(meas, fam, size, weight, variations);
  const pad = Math.max(1, Math.round(size / 28));
  const info = entries.map((e) => {
    const m = meas.measureText(e.char);
    return {
      e,
      left: m.actualBoundingBoxLeft || 0,
      right: m.actualBoundingBoxRight || 0,
      asc: m.actualBoundingBoxAscent || size * 0.8,
      desc: m.actualBoundingBoxDescent || 0,
    };
  });
  const ascent = Math.ceil(Math.max(...info.map((i) => i.asc)));
  const descent = Math.ceil(Math.max(...info.map((i) => i.desc)));
  const H = Math.max(1, ascent + descent + pad * 2);
  const wide = Math.ceil(Math.max(...info.map((i) => i.left + i.right)));
  const pre = prefix || nextDigitPrefix();
  const names = [];
  for (const i of info) {
    const cw = Math.max(1, Math.ceil(mono ? wide : (i.left + i.right)) + pad * 2);
    const c2 = document.createElement('canvas');
    c2.width = cw; c2.height = H;
    const c = c2.getContext('2d');
    setFontOn(c, fam, size, weight, variations);
    c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillStyle = color;
    const inkW = Math.max(0, i.left + i.right);
    c.save();
    c.translate((cw - inkW) / 2 + i.left, pad + ascent);
    c.fillText(i.e.char, 0, 0);
    c.restore();
    const name = uniqImageName(i.e.name || `${pre}_${i.e.tag}.png`);
    addProjectImage(name, c2, { replace: false });
    names.push(name);
  }
  await loadAllImages();
  return names;
}

// simple non-glyph artwork (analog hands)
function drawHandCanvas(w, h, pivotY, color = '#ffffff', width = 8) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = color;
  const x = w / 2;
  const r = Math.min(width, w) / 2;
  const round = (yy1, yy2) => {
    g.beginPath();
    g.moveTo(x - r, yy1); g.lineTo(x + r, yy1); g.lineTo(x + r, yy2); g.lineTo(x - r, yy2);
    g.closePath(); g.fill();
    g.beginPath(); g.arc(x, yy1, r, Math.PI, 0); g.fill();
    g.beginPath(); g.arc(x, yy2, r, 0, Math.PI); g.fill();
  };
  round(6, pivotY);
  return c;
}
// --------------------------------------------------------------- preview values --
// Normalisers used to size the reading (the design spec caps the digits per type).
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function pad2(v) { return String(v == null ? 0 : v).replace(/[^0-9]/g, '').padStart(2, '0').slice(-2); }

// full-scale value per data type — the denominator for level/progress widgets
const DT_MAX = {
  STEP: 10000, STEP_TARGET: 12000, CAL: 500, CAL_TARGET: 600, DISTANCE: 10, STAND: 12,
  STAND_TARGET: 12, FLOOR: 20, FAT_BURNING: 90, FAT_BURNING_TARGET: 90,
  HEART: 200, SPO2: 100, STRESS: 100, PAI_DAILY: 100, PAI_WEEKLY: 400, BATTERY: 100,
  HUMIDITY: 100, UVI: 12, AQI: 300, WIND: 12, WEATHER: 28, ALTIMETER: 1100, ALTITUDE: 1000,
  TRAINING_LOAD: 400, VO2MAX: 60, RECOVERY_TIME: 72, READINESS: 100, MONTH_RUN_TIMES: 30,
  MONTH_RUN_DISTANCE: 400, WEATHER_CURRENT: 50, WEATHER_LOW: 50, WEATHER_HIGH: 50, MOON: 8,
};
function dtValue(key) {
  if (key == null) return 0;
  if (Object.prototype.hasOwnProperty.call(testData, key)) return testData[key];
  const d = dtByKey(key);
  return d && d.preview != null ? d.preview : 0;
}
function valueString(key) {
  const v = dtValue(key);
  const d = dtByKey(key);
  if (typeof v === 'number' && d && d.dot) return v.toFixed(2);
  return String(v);
}
function levelFraction(key, staticLevel) {
  if (!key) return clamp01((+staticLevel || 0) / 100);
  const max = DT_MAX[key] || 100;
  return clamp01(Number(dtValue(key)) / max);
}
function weekIndexS() { return Math.max(0, Math.min(6, (+dateParts.weekday || 1) - 1)); }

// digit string a widget shows in the preview
function digitTextFor(e) {
  switch (e.kind) {
    case 'IMG_TIME': {
      const p = e.part || 'hour';
      if (p === 'minute') return pad2(clock.m);
      if (p === 'second') return pad2(clock.s);
      if (p === 'hour12') { const h = clock.h % 12; return String(h === 0 ? 12 : h); }
      return pad2(clock.h);
    }
    case 'IMG_DATE': return pad2((e.part || 'day') === 'month' ? dateParts.month : dateParts.day);
    case 'TEXT_IMG': {
      const d = dtByKey(e.dataType);
      let t = valueString(e.dataType).replace(/[^0-9]/g, '');
      if (d && d.digits) t = t.padStart(d.digits, '0').slice(-d.digits);
      return t;
    }
    case 'IMG_LEVEL': return String(levelIndex(e));
    case 'IMG_PROGRESS': return String(progressCount(e));
    case 'IMG_WEEK': return String(weekIndexS());
    default: return '';
  }
}
function setFirstImage(e) {
  const list = (e.images || []).filter(Boolean);
  for (const n of list) { const m = imgMeta(n); if (m) return m; }
  return null;
}
function setCell(e) {
  const m = setFirstImage(e);
  if (m) return { w: m.width, h: m.height, any: true };
  const size = +e.size || 44;
  return { w: Math.max(8, Math.round(size * 0.6)), h: Math.max(8, size), any: false };
}
function setSpacing(e) {
  if (e.kind === 'TEXT_IMG') return +e.hSpace || 0;
  if (e.kind === 'IMG_TIME' || e.kind === 'IMG_DATE') return +e.space || 0;
  return 0;
}
function setUnitWidth(e) {
  const m = e.unit ? imgMeta(e.unit) : null;
  return m ? m.width + 2 : 0;
}
function measureSet(e) {
  const cell = setCell(e);
  const n = Math.max(1, digitTextFor(e).length);
  const sp = setSpacing(e);
  return { w: n * cell.w + Math.max(0, n - 1) * sp + setUnitWidth(e), h: cell.h, cell, n, sp };
}
function levelIndex(e) {
  const n = Math.max(1, (e.images || []).length);
  const frac = levelFraction(e.dataType, e.level);
  return Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1))));
}
function progressCount(e) {
  const n = Math.max(1, (e.images || []).length);
  const frac = levelFraction(e.dataType, e.level);
  return Math.max(0, Math.min(n, Math.round(frac * n)));
}

// --------------------------------------------------------------------- boxes --
// On-screen box of a widget in device pixels (used for hit-testing, snapping,
// selection frames and the resize handles).
function elBox(e) {
  const W = dev().w, H = dev().h;
  const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
  switch (e.kind) {
    case 'CIRCLE':
    case 'ARC_PROGRESS': {
      const r = Math.max(1, num(e.radius, 60));
      return { x: num(e.centerX) - r, y: num(e.centerY) - r, w: r * 2, h: r * 2 };
    }
    case 'TIME_POINTER': return { x: 0, y: 0, w: W, h: H };
    case 'IMG':
    case 'IMG_POINTER':
    case 'IMG_ANIM':
    case 'IMG_STATUS':
    case 'IMG_CLICK': {
      const m = imgMeta(e.kind === 'IMG_ANIM' ? (e.frames || [])[0] : e.src)
        || (e.kind === 'IMG_ANIM' ? imgMeta((e.frames || []).find(Boolean)) : null);
      const w = num(e.w, 0) || (m ? m.width : 60);
      const h = num(e.h, 0) || (m ? m.height : 60);
      return { x: num(e.x), y: num(e.y), w, h };
    }
    case 'TEXT': return { x: num(e.x), y: num(e.y), w: num(e.w, 200), h: num(e.h, 40) };
    case 'IMG_TIME':
    case 'IMG_WEEK':
    case 'IMG_DATE':
    case 'TEXT_IMG': {
      const m = measureSet(e);
      return { x: num(e.x), y: num(e.y), w: m.w, h: m.h };
    }
    case 'IMG_LEVEL': {
      const m = setFirstImage(e);
      return { x: num(e.x), y: num(e.y), w: num(e.w, 0) || (m ? m.width : 100), h: num(e.h, 0) || (m ? m.height : 100) };
    }
    case 'IMG_PROGRESS': {
      const m = setFirstImage(e);
      const n = Math.max(1, (e.images || []).length);
      const cw = m ? m.width : 20, ch = m ? m.height : 20;
      const spread = num(e.spread, 24);
      return { x: num(e.x), y: num(e.y), w: cw + (n - 1) * spread, h: ch };
    }
    case 'ARC': return { x: num(e.x), y: num(e.y), w: num(e.w, 100), h: num(e.h, 100) };
    case 'FILL_RECT':
    case 'STROKE_RECT': return { x: num(e.x), y: num(e.y), w: num(e.w, 100), h: num(e.h, 100) };
    default: return { x: num(e.x), y: num(e.y), w: num(e.w, 100), h: num(e.h, 100) };
  }
}
function moveEl(e, dx, dy) {
  if (e.kind === 'CIRCLE' || e.kind === 'ARC_PROGRESS') {
    e.centerX = Math.round((+e.centerX || 0) + dx);
    e.centerY = Math.round((+e.centerY || 0) + dy);
    return;
  }
  if (e.kind === 'TIME_POINTER') {
    e.centerX = Math.round((+e.centerX || 0) + dx);
    e.centerY = Math.round((+e.centerY || 0) + dy);
    return;
  }
  e.x = Math.round((+e.x || 0) + dx);
  e.y = Math.round((+e.y || 0) + dy);
}
function placeEl(e, x, y) {
  const b = elBox(e);
  moveEl(e, Math.round(x - b.x), Math.round(y - b.y));
}

// ------------------------------------------------------------------- rendering --
function showAllowed(show, mode) {
  if (show === 'edit') return false;
  if (mode === 'aod') return show === 'aod' || show === 'both';
  return show === 'normal' || show === 'both' || show == null;
}
function hexOrWhite(c) { return typeof c === 'string' && c ? c : '#ffffff'; }
function drawMissing(c, x, y, w, h) {
  c.save();
  c.strokeStyle = 'rgba(255,255,255,0.28)';
  c.setLineDash([4, 3]);
  c.lineWidth = 1;
  c.strokeRect(x + 0.5, y + 0.5, Math.max(1, w - 1), Math.max(1, h - 1));
  c.setLineDash([]);
  c.restore();
}
function drawGlyphPlaceholder(c, ch, x, y, w, h, color) {
  c.save();
  c.fillStyle = hexOrWhite(color);
  c.globalAlpha *= 0.85;
  c.font = `${Math.max(8, Math.round(h * 0.76))}px "Inter", sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(ch, x + w / 2, y + h / 2 + 1);
  c.restore();
}
function put(c, name, x, y, w, h) {
  const im = imgFor(name);
  if (!im) { drawMissing(c, x, y, w, h); return false; }
  c.drawImage(im, x, y, w, h);
  return true;
}
function putRot(c, name, x, y, w, h, deg, cx, cy) {
  const im = imgFor(name);
  if (!im) { drawMissing(c, x, y, w, h); return; }
  c.save();
  c.translate(cx, cy);
  c.rotate((deg * Math.PI) / 180);
  c.drawImage(im, x - cx, y - cy, w, h);
  c.restore();
}
function drawDigits(c, e, x, y, text) {
  const { cell, sp } = measureSet(e);
  const names = e.images || [];
  let cx = x;
  for (let i = 0; i < text.length; i++) {
    const idx = +text[i];
    const name = names[idx];
    const im = imgFor(name);
    if (im) c.drawImage(im, cx, y, cell.w, cell.h);
    else drawGlyphPlaceholder(c, text[i], cx, y, cell.w, cell.h, e.color);
    cx += cell.w + sp;
  }
  if (e.unit) {
    const m = imgMeta(e.unit);
    if (m) put(c, e.unit, cx, y + (cell.h - m.height) / 2, m.width, m.height);
  }
  return cx;
}
function alignTextX(c, text, e) {
  const a = e.alignH || 'CENTER_H';
  if (a === 'LEFT') return e.x;
  const w = c.measureText(text).width;
  if (a === 'RIGHT') return e.x + (+e.w || 200) - w;
  return e.x + ((+e.w || 200) - w) / 2;
}
function drawElement(c, e) {
  const bg = (hex) => `0x${hex}`;
  switch (e.kind) {
    case 'IMG': {
      const b = elBox(e);
      if (e.angle) putRot(c, e.src, b.x, b.y, b.w, b.h, +e.angle, +e.centerX || b.x + b.w / 2, +e.centerY || b.y + b.h / 2);
      else put(c, e.src, b.x, b.y, b.w, b.h);
      break;
    }
    case 'IMG_ANIM': {
      const frames = e.frames || [];
      if (!frames.length) { const b = elBox(e); drawMissing(c, b.x, b.y, b.w, b.h); break; }
      const i = exportRender ? 0 : Math.floor(animTick * (Math.max(1, +e.fps || 30) / 30)) % frames.length;
      const b = elBox(e);
      put(c, frames[i], b.x, b.y, b.w, b.h);
      break;
    }
    case 'IMG_LEVEL': {
      const b = elBox(e);
      const name = (e.images || [])[levelIndex(e)];
      put(c, name, b.x, b.y, b.w, b.h);
      break;
    }
    case 'IMG_PROGRESS': {
      const b = elBox(e);
      const n = (e.images || []).length;
      const filled = progressCount(e);
      const spread = +e.spread || 24;
      const cw = b.w && n ? (b.w - (n - 1) * spread) / n : 20;
      const ch = b.h;
      for (let i = 0; i < filled && i < n; i++) put(c, (e.images || [])[i], b.x + i * spread, b.y, cw, ch);
      break;
    }
    case 'IMG_POINTER': {
      const b = elBox(e);
      const dt = dtByKey(e.dataType);
      let ang = +e.angle || 0;
      if (e.dataType) {
        const frac = levelFraction(e.dataType, e.level);
        ang = (+e.startAngle || 0) + frac * ((+e.endAngle || 360) - (+e.startAngle || 0));
      }
      putRot(c, e.src, b.x, b.y, b.w, b.h, ang, +e.centerX || b.x + b.w / 2, +e.centerY || b.y + b.h / 2);
      break;
    }
    case 'IMG_TIME':
    case 'IMG_DATE':
    case 'TEXT_IMG': {
      const b = elBox(e);
      const text = digitTextFor(e);
      const cell = setCell(e);
      const sp = setSpacing(e);
      if (e.alignH && e.alignH !== 'LEFT') {
        const tw = text.length * cell.w + Math.max(0, text.length - 1) * sp + setUnitWidth(e);
        const x = e.alignH === 'RIGHT' ? b.x + b.w - tw : b.x + (b.w - tw) / 2;
        drawDigits(c, e, x, b.y, text);
      } else {
        drawDigits(c, e, b.x, b.y, text);
      }
      break;
    }
    case 'IMG_WEEK': {
      const b = elBox(e);
      const name = (e.images || [])[weekIndexS()];
      const cell = setCell(e);
      put(c, name, b.x, b.y, cell.w, cell.h);
      break;
    }
    case 'TEXT': {
      const b = elBox(e);
      const fam = familyForFontFile(e.fontFile) || 'Inter';
      if (e.fontFile && !fontCache.has(fam)) ensureFont(fam, e.weight).then(() => render());
      c.save();
      c.fillStyle = hexOrWhite(e.color);
      setFontOn(c, fam, +e.size || 32, e.weight, e.variations);
      const va = e.alignV || 'CENTER_V';
      c.textBaseline = va === 'TOP' ? 'top' : va === 'BOTTOM' ? 'bottom' : 'middle';
      const lines = String(e.text == null ? '' : e.text).split('\n');
      const lh = (+e.size || 32) * 1.15 + (+e.lineSpace || 0);
      const totalH = lines.length * lh;
      let y = va === 'TOP' ? b.y : va === 'BOTTOM' ? b.y + b.h - totalH + lh : b.y + (b.h - totalH) / 2 + lh / 2;
      for (const line of lines) {
        c.textAlign = 'left';
        const x = alignTextX(c, line, e);
        c.fillText(line, x, y);
        y += lh;
      }
      c.restore();
      break;
    }
    case 'IMG_STATUS': {
      const b = elBox(e);
      put(c, e.src, b.x, b.y, b.w, b.h);
      break;
    }
    case 'IMG_CLICK': {
      const b = elBox(e);
      put(c, e.src, b.x, b.y, b.w, b.h);
      break;
    }
    case 'FILL_RECT': {
      c.save();
      c.fillStyle = hexOrWhite(e.color);
      roundRect(c, +e.x, +e.y, +e.w, +e.h, +e.radius || 0);
      c.fill();
      c.restore();
      break;
    }
    case 'STROKE_RECT': {
      c.save();
      c.strokeStyle = hexOrWhite(e.color);
      c.lineWidth = Math.max(1, +e.lineWidth || 2);
      roundRect(c, (+e.x) + c.lineWidth / 2, (+e.y) + c.lineWidth / 2,
        (+e.w) - c.lineWidth, (+e.h) - c.lineWidth, +e.radius || 0);
      c.stroke();
      c.restore();
      break;
    }
    case 'CIRCLE': {
      c.save();
      c.fillStyle = hexOrWhite(e.color);
      c.beginPath();
      c.arc(+e.centerX || 0, +e.centerY || 0, Math.max(0.5, +e.radius || 0), 0, Math.PI * 2);
      c.fill();
      c.restore();
      break;
    }
    case 'ARC': {
      const b = elBox(e);
      c.save();
      c.strokeStyle = hexOrWhite(e.color);
      c.lineWidth = Math.max(1, +e.lineWidth || 12);
      c.beginPath();
      const s = (+e.startAngle || 0) * Math.PI / 180;
      const en = (+e.endAngle || 0) * Math.PI / 180;
      c.arc(b.x + b.w / 2, b.y + b.h / 2, Math.max(0.5, +e.radius || Math.min(b.w, b.h) / 2), s, en);
      c.stroke();
      c.restore();
      break;
    }
    case 'ARC_PROGRESS': {
      const frac = levelFraction(e.dataType, e.level);
      const s = (+e.startAngle || 0) * Math.PI / 180;
      const en = (+e.endAngle || 0) * Math.PI / 180;
      const cx = +e.centerX || 0, cy = +e.centerY || 0, r = Math.max(0.5, +e.radius || 0);
      c.save();
      if (e.bg) {
        const m = imgMeta(e.bg);
        if (m) c.drawImage(imgFor(e.bg), cx - r - (+e.lineWidth || 12) / 2, cy - r - (+e.lineWidth || 12) / 2, m.width, m.height);
      }
      // track
      c.strokeStyle = 'rgba(255,255,255,0.13)';
      c.lineWidth = Math.max(1, +e.lineWidth || 12);
      c.beginPath(); c.arc(cx, cy, r, s, en); c.stroke();
      // value
      c.strokeStyle = hexOrWhite(e.color);
      c.beginPath(); c.arc(cx, cy, r, s, s + frac * (en - s)); c.stroke();
      c.restore();
      break;
    }
    case 'TIME_POINTER': {
      const cx = +e.centerX || 0, cy = +e.centerY || 0;
      const hands = [
        ['hour', (clock.h % 12) * 30 + clock.m * 0.5, e.hour, e.hourPivotX, e.hourPivotY],
        ['minute', clock.m * 6 + clock.s * 0.1, e.minute, e.minutePivotX, e.minutePivotY],
        ['second', clock.s * 6, e.second, e.secondPivotX, e.secondPivotY],
      ];
      for (const [, ang, name, pxv, pyv] of hands) {
        if (!name) continue;
        const m = imgMeta(name);
        if (!m) continue;
        c.save();
        c.translate(cx, cy);
        c.rotate((ang * Math.PI) / 180);
        c.drawImage(imgFor(name), -(+pxv || 0), -(+pyv || 0), m.width, m.height);
        c.restore();
      }
      if (e.cover) {
        const m = imgMeta(e.cover);
        if (m) { c.drawImage(imgFor(e.cover), cx - m.width / 2, cy - m.height / 2, m.width, m.height); }
      }
      break;
    }
    default: break;
  }
}
function roundRect(c, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}
let animTick = 0;

// editor overlays: grid, safe area, snap guides, selection frames + handles
function handleRects(b) {
  const s = 7;
  const pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]];
  return pts.map(([x, y]) => ({ x: x - s / 2, y: y - s / 2, s }));
}
function drawOverlay(c, W, H) {
  if (showGrid) {
    c.save();
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(255,255,255,0.06)';
    c.beginPath();
    for (let x = GRID_PX; x < W; x += GRID_PX) { c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, H); }
    for (let y = GRID_PX; y < H; y += GRID_PX) { c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); }
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.11)';
    c.beginPath();
    for (let x = GRID_PX * 4; x < W; x += GRID_PX * 4) { c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, H); }
    for (let y = GRID_PX * 4; y < H; y += GRID_PX * 4) { c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); }
    c.stroke();
    c.setLineDash([5, 4]);
    c.strokeStyle = 'rgba(91,140,255,0.45)';
    c.beginPath();
    c.moveTo(W / 2 + 0.5, 0); c.lineTo(W / 2 + 0.5, H);
    c.moveTo(0, H / 2 + 0.5); c.lineTo(W, H / 2 + 0.5);
    c.stroke();
    c.restore();
  }
  // 2px safe area (design specification)
  c.save();
  c.strokeStyle = 'rgba(255,193,107,0.35)';
  c.setLineDash([6, 5]);
  c.lineWidth = 1;
  c.strokeRect(SAFE_PX + 0.5, SAFE_PX + 0.5, W - SAFE_PX * 2 - 1, H - SAFE_PX * 2 - 1);
  c.restore();
  if (guides.v.length || guides.h.length) {
    c.save();
    c.strokeStyle = 'rgba(255,120,220,0.95)';
    c.lineWidth = 1;
    c.beginPath();
    for (const x of guides.v) { c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, H); }
    for (const y of guides.h) { c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); }
    c.stroke();
    c.restore();
  }
  const sel = selection();
  for (const e of sel) {
    const b = elBox(e);
    const primary = e.id === selectedId;
    c.save();
    c.strokeStyle = primary ? '#5b8cff' : 'rgba(91,140,255,0.55)';
    c.lineWidth = 1;
    c.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    if (primary && WH_KINDS.has(e.kind)) {
      for (const hRect of handleRects(b)) {
        c.fillStyle = '#0d0f14';
        c.fillRect(hRect.x, hRect.y, hRect.s, hRect.s);
        c.strokeStyle = '#5b8cff';
        c.strokeRect(hRect.x + 0.5, hRect.y + 0.5, hRect.s - 1, hRect.s - 1);
      }
    }
    if (primary && (e.kind === 'CIRCLE' || e.kind === 'ARC_PROGRESS')) {
      c.fillStyle = '#5b8cff';
      c.beginPath();
      c.arc(b.x + b.w, b.y + b.h / 2, 4, 0, Math.PI * 2);
      c.fill();
    }
    if (primary && e.kind === 'TIME_POINTER') {
      c.fillStyle = '#ff78dc';
      c.beginPath();
      c.arc(+e.centerX || 0, +e.centerY || 0, 4, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }
}

function drawScene(c, W, H, mode, overlay) {
  c.save();
  c.clearRect(0, 0, W, H);
  c.fillStyle = '#000000';
  c.fillRect(0, 0, W, H);
  for (const e of elements()) {
    if (e.visible === false) continue;
    if (!showAllowed(e.show, mode)) continue;
    c.save();
    if (e.alpha != null && e.alpha < 255) c.globalAlpha = Math.max(0, e.alpha / 255);
    try { drawElement(c, e); } catch (err) { /* never let one widget break the preview */ }
    c.restore();
  }
  c.restore();
  if (overlay) drawOverlay(c, W, H);
}
// ------------------------------------------------------------------ canvas --
function fitScale() {
  const d = dev();
  const cs = document.querySelector('main .center');
  const availW = Math.max(220, (cs ? cs.clientWidth : 560) - 48);
  const availH = Math.max(220, window.innerHeight - 320);
  return Math.max(0.24, Math.min(availW / d.w, availH / d.h, 1));
}
function render() {
  if (!project) return;
  const d = dev(), W = d.w, H = d.h;
  const cv = $('cv');
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const scale = fitScale();
  cv.style.width = Math.round(W * scale) + 'px';
  cv.style.height = Math.round(H * scale) + 'px';
  drawScene(cv.getContext('2d'), W, H, previewMode, true);
  $('watchTitle').textContent = project.name || 'Watchface';
  const shape = d.shape === 'r' ? 'round' : d.shape === 's' ? 'square' : 'band';
  $('watchSub').textContent = `${d.name} · ${W}×${H} ${shape} · ${previewMode === 'aod' ? 'AOD preview' : 'normal preview'}`;
  applyDeviceMask();
}
window.addEventListener('resize', () => { if (project) render(); });

// device mask — assets/masks/<target>.svg, generated by tools/gen-masks.js and
// listed in the masks manifest that arrives with the metadata
function applyDeviceMask() {
  const host = $('cvDevice');
  const cv = $('cv');
  if (!project) return;
  const d = dev();
  const meta = (META && META.masks) ? META.masks[project.device] : null;
  const rect = cv.getBoundingClientRect();
  const scale = cv.width ? (rect.width / cv.width) : 1;
  const pad = parseFloat(getComputedStyle(host).paddingTop) || 0;
  const roundShape = d.shape === 'r' || (meta && meta.shape === 'r');
  // corner radius: half the canvas for a round face, the device radius otherwise
  const devRadius = (meta ? meta.radius : d.radius) || 0;
  const corner = roundShape ? rect.width / 2 : devRadius * scale;
  cv.style.borderRadius = showMask ? Math.round(corner) + 'px' : '0px';
  host.style.borderRadius = showMask ? Math.round(corner + pad) + 'px' : '0px';
  host.classList.toggle('plain', !showMask || !meta);
  if (showMask && meta) {
    const url = `url("assets/masks/${project.device}.svg")`;
    cv.style.webkitMaskImage = cv.style.maskImage = url;
    cv.style.webkitMaskSize = cv.style.maskSize = '100% 100%';
    cv.style.webkitMaskRepeat = cv.style.maskRepeat = 'no-repeat';
  } else {
    cv.style.webkitMaskImage = cv.style.maskImage = 'none';
  }
}
$('btnMask').classList.toggle('on', showMask);
$('btnMask').onclick = () => {
  showMask = !showMask;
  $('btnMask').classList.toggle('on', showMask);
  if (project) render();
};
$('btnGrid').classList.toggle('on', showGrid);
$('btnGrid').onclick = () => {
  showGrid = !showGrid;
  $('btnGrid').classList.toggle('on', showGrid);
  if (!showGrid) guides = { v: [], h: [] };
  if (project) render();
};

// compose the saved preview: black background, normal state, no editor overlay
function composePreviewB64() {
  const d = dev();
  const cv = document.createElement('canvas');
  cv.width = d.w; cv.height = d.h;
  const prev = exportRender;
  exportRender = true;
  drawScene(cv.getContext('2d'), d.w, d.h, 'normal', false);
  exportRender = prev;
  return cv.toDataURL('image/png').split(',')[1];
}

// ----------------------------------------------------------------- layers --
function groupName(gid) { return (project.groups && project.groups[gid]) || `Group ${String(gid).replace(/^g/, '')}`; }
const ICON = {
  grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18"/><path d="M10.6 5.2A9.6 9.6 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-2.4 3.2M6.3 6.3A17 17 0 0 0 2 12s4 7 10 7a9.6 9.6 0 0 0 3-.5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  unlock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>',
  img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 16l5-5 4 4 3-2 6 6"/><circle cx="9" cy="9" r="1.4"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  data: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 19V5M4 19h16"/><path d="M8 19v-6M12 19V9M16 19v-4"/></svg>',
  shape: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="6" width="18" height="12" rx="2"/></svg>',
  text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6V4h16v2M12 4v16M8 20h8"/></svg>',
};
function kindIcon(kind) {
  const k = kindById(kind);
  const g = k ? k.group : 'Image';
  return g === 'Time' || g === 'Clock' ? ICON.clock : g === 'Data' ? ICON.data : g === 'Shape' ? ICON.shape : g === 'Text' ? ICON.text : ICON.img;
}
function aodBadge(e) {
  if (e.show === 'aod') return 'AOD';
  if (e.show === 'edit') return 'EDIT';
  return null;
}
function layerLabel(e) {
  return e.name || (kindById(e.kind) ? kindById(e.kind).label : e.kind);
}
function layerRow(e) {
  const row = document.createElement('div');
  row.className = 'layer' + (e.id === selectedId ? ' sel' : '') + (multiSel.has(e.id) && e.id !== selectedId ? ' multi' : '')
    + (e.visible === false ? ' hid' : '') + (e.locked ? ' locked' : '');
  row.dataset.id = e.id;
  const left = document.createElement('span');
  left.className = 'lname';
  const grip = document.createElement('span');
  grip.className = 'grip'; grip.innerHTML = ICON.grip;
  const icon = document.createElement('span');
  icon.className = 'licon'; icon.innerHTML = kindIcon(e.kind);
  const nm = document.createElement('span');
  nm.className = 'nname'; nm.textContent = layerLabel(e);
  const badge = aodBadge(e);
  left.appendChild(grip); left.appendChild(icon);
  if (badge) { const b = document.createElement('span'); b.className = 'grp'; b.textContent = badge; left.appendChild(b); }
  left.appendChild(nm);
  const right = document.createElement('span');
  right.className = 'lrow-r';
  const mk = (cls, html, title, fn) => {
    const b = document.createElement('button');
    b.className = 'lb ' + cls; b.innerHTML = html; b.title = title;
    b.onclick = (ev) => { ev.stopPropagation(); fn(); };
    return b;
  };
  right.appendChild(mk('vis', e.visible === false ? ICON.eyeOff : ICON.eye, e.visible === false ? 'Show' : 'Hide', () => {
    pushHistory(); e.visible = e.visible === false ? true : false; refreshPanels(); render();
  }));
  right.appendChild(mk('lock' + (e.locked ? ' on' : ''), e.locked ? ICON.lock : ICON.unlock, e.locked ? 'Unlock' : 'Lock', () => {
    pushHistory(); e.locked = !e.locked; refreshPanels(); render();
  }));
  right.appendChild(mk('trash', ICON.trash, 'Delete', () => { deleteElements([e]); }));
  row.appendChild(left); row.appendChild(right);
  row.onclick = (ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
      if (multiSel.has(e.id)) multiSel.delete(e.id); else multiSel.add(e.id);
      selectedId = e.id;
    } else { selectedId = e.id; multiSel = new Set([e.id]); }
    refreshPanels(); render();
  };
  return row;
}
function groupBlock(gid, members) {
  const wrap = document.createElement('div');
  wrap.className = 'group-block' + (groupCollapsed.has(gid) ? ' collapsed' : '');
  const head = document.createElement('div');
  head.className = 'group-row' + (groupCollapsed.has(gid) ? ' collapsed' : '');
  const chev = document.createElement('span'); chev.className = 'gchev'; chev.textContent = '▾';
  chev.onclick = (ev) => {
    ev.stopPropagation();
    if (groupCollapsed.has(gid)) groupCollapsed.delete(gid); else groupCollapsed.add(gid);
    refreshPanels();
  };
  const nm = document.createElement('span'); nm.className = 'gname'; nm.textContent = groupName(gid);
  const cnt = document.createElement('span'); cnt.className = 'gcount'; cnt.textContent = `${members.length}`;
  head.appendChild(chev); head.appendChild(nm); head.appendChild(cnt);
  head.onclick = () => {
    selectedId = members.length ? members[0].id : null;
    multiSel = new Set(members.map((m) => m.id));
    refreshPanels(); render();
  };
  const body = document.createElement('div');
  body.className = 'group-body';
  body.dataset.gid = gid;
  for (const m of members) body.appendChild(layerRow(m));
  wrap.appendChild(head); wrap.appendChild(body);
  return wrap;
}
function makeSortable(container) {
  if (typeof Sortable === 'undefined') return;
  Sortable.create(container, {
    group: 'wf-layers', handle: '.grip', animation: 120,
    ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen', fallbackClass: 'sortable-fallback',
    fallbackOnBody: true,
    onEnd: applyLayerOrder,
  });
}
function applyLayerOrder() {
  const containers = document.querySelectorAll('#layers .layers-list, #layers .group-body');
  const order = [];
  const usedGroups = new Set();
  containers.forEach((container) => {
    const gid = container.dataset.gid || null;
    if (gid) usedGroups.add(gid);
    container.querySelectorAll(':scope > .layer').forEach((row) => {
      const e = elementById(row.dataset.id);
      if (!e) return;
      e.group = gid;
      order.push(e);
    });
  });
  for (const gid of Object.keys(project.groups || {})) {
    if (!usedGroups.has(gid)) delete project.groups[gid];
  }
  order.reverse();
  project.elements = order;
  dirty = true;
  refreshPanels(); render(); scheduleCode();
}
function renderLayers() {
  const host = $('layers');
  host.innerHTML = '';
  if (!project) return;
  const top = [...elements()].reverse();
  const byGroup = new Map();
  for (const e of top) {
    if (!e.group) continue;
    if (!byGroup.has(e.group)) byGroup.set(e.group, []);
    byGroup.get(e.group).push(e);
  }
  const rootList = document.createElement('div');
  rootList.className = 'layers-list';
  rootList.dataset.gid = '';
  const emitted = new Set();
  for (const e of top) {
    if (e.group) {
      if (emitted.has(e.group)) continue;
      emitted.add(e.group);
      rootList.appendChild(groupBlock(e.group, byGroup.get(e.group)));
      continue;
    }
    rootList.appendChild(layerRow(e));
  }
  host.appendChild(rootList);
  $('wcount').textContent = String(elements().length);
  makeSortable(rootList);
  host.querySelectorAll('.group-body').forEach(makeSortable);
}

// ----------------------------------------------------------------- properties --
function mkRow(lbl, title) {
  const r = document.createElement('div');
  r.className = 'row';
  const s = document.createElement('span');
  s.className = 'lbl'; s.textContent = lbl;
  if (title) s.title = title;
  r.appendChild(s);
  return r;
}
function ctlNum(obj, key, { min, max, step = 1 } = {}) {
  const inp = document.createElement('input');
  inp.type = 'number'; inp.step = step;
  if (min != null) inp.min = min;
  if (max != null) inp.max = max;
  inp.value = Number.isFinite(+obj[key]) ? +obj[key] : 0;
  inp.oninput = () => { pushHistory(); obj[key] = +inp.value || 0; render(); scheduleCode(); };
  return inp;
}
function ctlText(obj, key, placeholder) {
  const inp = document.createElement('input');
  inp.type = 'text'; inp.value = obj[key] == null ? '' : obj[key];
  if (placeholder) inp.placeholder = placeholder;
  inp.oninput = () => { pushHistory(); obj[key] = inp.value; refreshPanels(); render(); scheduleCode(); };
  return inp;
}
function ctlColor(obj, key) {
  const inp = document.createElement('input');
  inp.type = 'color'; inp.value = obj[key] || '#ffffff';
  inp.oninput = () => { pushHistory(); obj[key] = inp.value; render(); scheduleCode(); };
  return inp;
}
function ctlSelect(value, options, onChange) {
  const sel = document.createElement('select');
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o.value; opt.textContent = o.label;
    if (o.group) { opt.disabled = true; }
    sel.appendChild(opt);
  }
  sel.value = value;
  sel.onchange = () => { pushHistory(); onChange(sel.value); refreshPanels(); render(); scheduleCode(); };
  return sel;
}
function ctlCheck(obj, key, title) {
  const inp = document.createElement('input');
  inp.type = 'checkbox'; inp.checked = !!obj[key];
  if (title) inp.title = title;
  inp.onchange = () => { pushHistory(); obj[key] = inp.checked; render(); scheduleCode(); };
  return inp;
}
function ctlButton(label, title, fn) {
  const b = document.createElement('button');
  b.textContent = label;
  if (title) b.title = title;
  b.onclick = fn;
  return b;
}
function imageOptions(includeEmpty) {
  const out = includeEmpty ? [{ value: '', label: '— none —' }] : [];
  for (const im of project.images) out.push({ value: im.name, label: im.name });
  return out;
}
function rowSingleImage(label, obj, key) {
  const row = mkRow(label);
  const img = imgFor(obj[key]);
  const wrap = document.createElement('div');
  wrap.className = 'imgbtn' + (obj[key] ? (img ? '' : ' missing') : ' empty');
  if (obj[key] && img) {
    const th = document.createElement('img');
    th.className = 'imgthumb-sm'; th.src = img.src;
    wrap.appendChild(th);
  }
  const sel = ctlSelect(obj[key] || '', imageOptions(true), (v) => { obj[key] = v; });
  wrap.appendChild(sel);
  row.appendChild(wrap);
  return row;
}
function setHint(kind, e) {
  const n = (e.images || []).length;
  if (kind === 'IMG_WEEK') return n === 7 ? '' : `weekday sets use 7 images (have ${n})`;
  if (kind === 'TEXT_IMG' || kind === 'IMG_TIME' || kind === 'IMG_DATE') return n === 10 ? '' : `digit sets use 10 images, 0-9 (have ${n})`;
  if (e.dataType === 'WEATHER') return n === 29 ? '' : `the weather set uses 29 icons in the spec order (have ${n})`;
  if (kind === 'IMG_LEVEL' || kind === 'IMG_PROGRESS') return n ? '' : 'add an image per level';
  return '';
}
function rowImageSet(label, e) {
  const row = mkRow(label);
  const btn = ctlButton(`${(e.images || []).length} image${(e.images || []).length === 1 ? '' : 's'}…`, 'Edit the image set', () => openImageSet(e));
  row.appendChild(btn);
  return row;
}
function dtOptions(forClick) {
  const groups = [];
  const out = [];
  for (const d of DATA_TYPES) {
    if (!!d.clickOnly !== !!forClick) continue;
    if (d.preview == null && !d.bound) continue;
    if (d.key === 'TIME' || d.key === 'DATE' || d.key === 'WEEK') continue;
    let g = groups.find((x) => x.label === d.group);
    if (!g) { g = { label: d.group, value: `__${d.group}` }; groups.push(g); out.push(g); }
    out.push({ value: d.key, label: d.label });
  }
  return out.map((o) => o.value.startsWith('__') ? { value: o.value, label: o.label, group: true } : o);
}
function groupBox(title) {
  const box = document.createElement('div');
  box.className = 'group-box';
  const head = document.createElement('div');
  head.className = 'gb-head'; head.textContent = title;
  box.appendChild(head);
  return box;
}
function infoBlock(e) {
  const k = kindById(e.kind);
  const b = elBox(e);
  const box = document.createElement('div');
  box.className = 'pinfo';
  const rows = [
    ['kind', k ? k.label : e.kind],
    ['docs', k ? `hmUI.widget.${e.kind}` : e.kind],
    ['box', `${Math.round(b.x)}, ${Math.round(b.y)} · ${Math.round(b.w)}×${Math.round(b.h)}`],
  ];
  for (const [k2, v] of rows) {
    const a = document.createElement('div'); a.className = 'k'; a.textContent = k2;
    const b2 = document.createElement('div'); b2.className = 'v'; b2.textContent = v;
    box.appendChild(a); box.appendChild(b2);
  }
  return box;
}
function renderProps() {
  const host = $('props');
  host.innerHTML = '';
  if (!project) return;
  const e = selEl();
  const sel = selection();
  if (sel.length > 1) {
    host.appendChild(groupBox(`${sel.length} layers selected`));
    host.appendChild(propsGroupTools(sel));
  }
  if (!e) {
    if (sel.length <= 1) host.innerHTML = '<p class="muted">Select a layer.</p>';
    return;
  }
  host.appendChild(infoBlock(e));
  // common
  host.appendChild(ctlRow('Name', ctlText(e, 'name', layerLabel(e))));
  host.appendChild(ctlRow('Show in', ctlSelect(e.show || 'both', SHOW_LEVELS.map((s) => ({ value: s.key, label: s.label })), (v) => { e.show = v; })));
  host.appendChild(ctlRow('Alpha', ctlNum(e, 'alpha', { min: 0, max: 255 })));

  const geo = document.createElement('div');
  geo.className = 'prop-sep';
  host.appendChild(geo);
  if (CENTER_KINDS.has(e.kind)) {
    host.appendChild(ctlRow('Center X', ctlNum(e, 'centerX')));
    host.appendChild(ctlRow('Center Y', ctlNum(e, 'centerY')));
    host.appendChild(ctlRow('Radius', ctlNum(e, 'radius', { min: 0 })));
  } else if (WH_KINDS.has(e.kind)) {
    host.appendChild(ctlRow('X', ctlNum(e, 'x')));
    host.appendChild(ctlRow('Y', ctlNum(e, 'y')));
    host.appendChild(ctlRow('W', ctlNum(e, 'w', { min: 0 })));
    host.appendChild(ctlRow('H', ctlNum(e, 'h', { min: 0 })));
  } else {
    host.appendChild(ctlRow('X', ctlNum(e, 'x')));
    host.appendChild(ctlRow('Y', ctlNum(e, 'y')));
  }
  host.appendChild(propsKind(e));
  const del = ctlButton('Delete layer', '', () => deleteElements([e]));
  del.className = 'row-btn';
  host.appendChild(del);
}
function ctlRow(label, control) {
  const row = mkRow(label);
  row.appendChild(control);
  return row;
}
function propsGroupTools(sel) {
  const box = groupBox('Align');
  const wrap = document.createElement('div');
  wrap.className = 'aligntools';
  const D = dev();
  const items = [
    ['Left', () => alignSel(sel, 'left', D)],
    ['Center', () => alignSel(sel, 'hcenter', D)],
    ['Right', () => alignSel(sel, 'right', D)],
    ['Top', () => alignSel(sel, 'top', D)],
    ['Middle', () => alignSel(sel, 'vcenter', D)],
    ['Bottom', () => alignSel(sel, 'bottom', D)],
  ];
  for (const [label, fn] of items) {
    const b = document.createElement('button');
    b.textContent = label; b.onclick = fn;
    wrap.appendChild(b);
  }
  box.appendChild(wrap);
  return box;
}
function alignSel(sel, mode, D) {
  if (sel.length < 2) return;
  pushHistory();
  const boxes = sel.map((e) => ({ e, b: elBox(e) }));
  const minX = Math.min(...boxes.map((x) => x.b.x));
  const maxX = Math.max(...boxes.map((x) => x.b.x + x.b.w));
  const minY = Math.min(...boxes.map((x) => x.b.y));
  const maxY = Math.max(...boxes.map((x) => x.b.y + x.b.h));
  for (const { e, b } of boxes) {
    let dx = 0, dy = 0;
    if (mode === 'left') dx = minX - b.x;
    else if (mode === 'right') dx = maxX - (b.x + b.w);
    else if (mode === 'hcenter') dx = (minX + maxX) / 2 - (b.x + b.w / 2);
    else if (mode === 'top') dy = minY - b.y;
    else if (mode === 'bottom') dy = maxY - (b.y + b.h);
    else if (mode === 'vcenter') dy = (minY + maxY) / 2 - (b.y + b.h / 2);
    moveEl(e, Math.round(dx), Math.round(dy));
  }
  refreshPanels(); render();
}
// kind-specific rows
function propsKind(e) {
  const frag = document.createElement('div');
  const add = (label, ctl) => frag.appendChild(ctlRow(label, ctl));
  switch (e.kind) {
    case 'IMG':
      add('Image', buildSingle(e, 'src'));
      add('Angle', ctlNum(e, 'angle', { min: -360, max: 360 }));
      add('Pos X', ctlNum(e, 'posX'));
      add('Pos Y', ctlNum(e, 'posY'));
      break;
    case 'IMG_ANIM':
      add('Frames', ctlButton(`${(e.frames || []).length} frame${(e.frames || []).length === 1 ? '' : 's'}…`, 'Import a frame sequence', () => openAnimFrames(e)));
      add('FPS', ctlNum(e, 'fps', { min: 1, max: 60 }));
      add('Repeat', ctlNum(e, 'repeat', { min: 0 }), '0 = forever');
      add('Step', ctlNum(e, 'step', { min: 1 }));
      break;
    case 'IMG_LEVEL':
      add('Data', ctlSelect(e.dataType || '', [{ value: '', label: '— static level —' }, ...dtOptions(false)], (v) => {
        e.dataType = v || null;
      }));
      if (!e.dataType) add('Level', ctlNum(e, 'level', { min: 0, max: 100 }));
      add('Images', ctlButton(`${(e.images || []).length}…`, 'Edit the image set', () => openImageSet(e)));
      break;
    case 'IMG_PROGRESS':
      add('Data', ctlSelect(e.dataType || '', [{ value: '', label: '— static level —' }, ...dtOptions(false)], (v) => {
        e.dataType = v || null;
      }));
      if (!e.dataType) add('Level', ctlNum(e, 'level', { min: 0, max: 100 }));
      add('Spread', ctlNum(e, 'spread', { min: 0 }));
      add('Images', ctlButton(`${(e.images || []).length}…`, 'Edit the image set', () => openImageSet(e)));
      break;
    case 'IMG_POINTER': {
      add('Image', buildSingle(e, 'src'));
      add('Data', ctlSelect(e.dataType || '', [{ value: '', label: '— fixed angle —' }, ...dtOptions(false)], (v) => { e.dataType = v || null; }));
      add('Angle', ctlNum(e, 'angle', { min: -360, max: 360 }));
      add('Start', ctlNum(e, 'startAngle', { min: -360, max: 360 }));
      add('End', ctlNum(e, 'endAngle', { min: -360, max: 360 }));
      add('Center X', ctlNum(e, 'centerX'));
      add('Center Y', ctlNum(e, 'centerY'));
      break;
    }
    case 'IMG_TIME':
      add('Part', ctlSelect(e.part || 'hour', [
        { value: 'hour', label: 'Hour' }, { value: 'hour12', label: 'Hour (12h)' },
        { value: 'minute', label: 'Minute' }, { value: 'second', label: 'Second' },
      ], (v) => { e.part = v; }));
      if ((e.part || 'hour') !== 'hour12') {
        add('Leading 0', ctlCheck(e, 'zero'));
        add('Space', ctlNum(e, 'space'));
      }
      add('Follow', ctlCheck(e, 'follow', 'Seconds follow the minute hand'));
      add('Align', ctlSelect(e.alignH || 'LEFT', alignOptions(), (v) => { e.alignH = v; }));
      add('Digits', ctlButton(`${(e.images || []).length}…`, 'Edit the digit set', () => openImageSet(e)));
      add('Unit', buildSingle(e, 'unit'));
      if ((e.part || 'hour') === 'hour12') {
        add('AM image', buildSingle(e, 'am'));
        add('AM X', ctlNum(e, 'amX'));
        add('AM Y', ctlNum(e, 'amY'));
        add('PM image', buildSingle(e, 'pm'));
        add('PM X', ctlNum(e, 'pmX'));
        add('PM Y', ctlNum(e, 'pmY'));
      }
      break;
    case 'IMG_DATE':
      add('Part', ctlSelect(e.part || 'day', [{ value: 'day', label: 'Day' }, { value: 'month', label: 'Month' }], (v) => { e.part = v; }));
      add('Leading 0', ctlCheck(e, 'zero'));
      add('Space', ctlNum(e, 'space'));
      add('Follow', ctlCheck(e, 'follow'));
      add('Character', ctlCheck(e, 'isCharacter', 'Month name instead of digits'));
      add('Align', ctlSelect(e.alignH || 'LEFT', alignOptions(), (v) => { e.alignH = v; }));
      add('Digits', ctlButton(`${(e.images || []).length}…`, 'Edit the digit set', () => openImageSet(e)));
      break;
    case 'IMG_WEEK':
      add('Weekdays', ctlButton(`${(e.images || []).length}…`, 'Edit the 7 weekday images', () => openImageSet(e)));
      break;
    case 'TEXT_IMG':
      add('Data', ctlSelect(e.dataType || 'STEP', dtOptions(false), (v) => { e.dataType = v; }));
      add('Digits', ctlButton(`${(e.images || []).length}…`, 'Edit the digit set', () => openImageSet(e)));
      add('Spacing', ctlNum(e, 'hSpace', { min: 0 }));
      add('Align', ctlSelect(e.alignH || 'LEFT', alignOptions(), (v) => { e.alignH = v; }));
      add('Unit', buildSingle(e, 'unit'));
      add('Decimal', buildSingle(e, 'dot'));
      add('Negative', buildSingle(e, 'negative'));
      break;
    case 'TEXT':
      add('Text', ctlText(e, 'text', 'MONDAY'));
      add('Color', ctlColor(e, 'color'));
      add('Size', ctlNum(e, 'size', { min: 1 }));
      add('Font', ctlSelect(e.fontFile || '', fontFileOptions(), (v) => {
        e.fontFile = v;
        const fam = familyForFontFile(v);
        if (fam) ensureFont(fam, e.weight).then(() => render());
        else render();
      }));
      add('Weight', ctlSelect(String(e.weight || 400), [
        { value: '300', label: '300 light' }, { value: '400', label: '400 regular' },
        { value: '500', label: '500 medium' }, { value: '600', label: '600 semi bold' },
        { value: '700', label: '700 bold' }, { value: '900', label: '900 black' },
      ], (v) => { e.weight = +v; render(); }));
      add('Align H', ctlSelect(e.alignH || 'CENTER_H', alignOptions(), (v) => { e.alignH = v; }));
      add('Align V', ctlSelect(e.alignV || 'CENTER_V', [
        { value: 'TOP', label: 'Top' }, { value: 'CENTER_V', label: 'Middle' }, { value: 'BOTTOM', label: 'Bottom' },
      ], (v) => { e.alignV = v; }));
      add('Line space', ctlNum(e, 'lineSpace'));
      add('Char space', ctlNum(e, 'charSpace'));
      break;
    case 'IMG_STATUS':
      add('Status', ctlSelect(e.status || 'DISCONNECT', SYSTEM_STATUS.map((s) => ({ value: s.key, label: s.label })), (v) => { e.status = v; }));
      add('Icon', buildSingle(e, 'src'));
      break;
    case 'IMG_CLICK':
      add('Action', ctlSelect(e.dataType || 'OUTDOOR_RUNNING', dtOptions(true), (v) => { e.dataType = v; }));
      add('Icon', buildSingle(e, 'src'));
      break;
    case 'FILL_RECT':
    case 'STROKE_RECT':
      add('Color', ctlColor(e, 'color'));
      add('Radius', ctlNum(e, 'radius', { min: 0 }));
      if (e.kind === 'STROKE_RECT') add('Line width', ctlNum(e, 'lineWidth', { min: 1 }));
      add('Angle', ctlNum(e, 'angle', { min: -360, max: 360 }));
      break;
    case 'CIRCLE':
      add('Color', ctlColor(e, 'color'));
      break;
    case 'ARC':
      add('Color', ctlColor(e, 'color'));
      add('Start', ctlNum(e, 'startAngle', { min: -360, max: 360 }));
      add('End', ctlNum(e, 'endAngle', { min: -360, max: 360 }));
      add('Line width', ctlNum(e, 'lineWidth', { min: 1 }));
      break;
    case 'ARC_PROGRESS':
      add('Data', ctlSelect(e.dataType || '', [{ value: '', label: '— static level —' }, ...dtOptions(false)], (v) => { e.dataType = v || null; }));
      add('Level', ctlNum(e, 'level', { min: 0, max: 100 }));
      add('Color', ctlColor(e, 'color'));
      add('Start', ctlNum(e, 'startAngle', { min: -360, max: 360 }));
      add('End', ctlNum(e, 'endAngle', { min: -360, max: 360 }));
      add('Line width', ctlNum(e, 'lineWidth', { min: 1 }));
      add('Background', buildSingle(e, 'bg'));
      break;
    case 'TIME_POINTER': {
      add('Center X', ctlNum(e, 'centerX'));
      add('Center Y', ctlNum(e, 'centerY'));
      add('Hour hand', buildSingle(e, 'hour'));
      add('Hour pivot X', ctlNum(e, 'hourPivotX'));
      add('Hour pivot Y', ctlNum(e, 'hourPivotY'));
      add('Minute hand', buildSingle(e, 'minute'));
      add('Minute pivot X', ctlNum(e, 'minutePivotX'));
      add('Minute pivot Y', ctlNum(e, 'minutePivotY'));
      add('Second hand', buildSingle(e, 'second'));
      add('Second pivot X', ctlNum(e, 'secondPivotX'));
      add('Second pivot Y', ctlNum(e, 'secondPivotY'));
      add('Cover', buildSingle(e, 'cover'));
      break;
    }
    default: break;
  }
  const hint = setHint(e.kind, e);
  if (hint) {
    const h = document.createElement('div');
    h.className = 'ilm-hint';
    h.style.marginTop = '8px';
    h.textContent = hint;
    frag.appendChild(h);
  }
  return frag;
}
function alignOptions() {
  return [
    { value: 'LEFT', label: 'Left' },
    { value: 'CENTER_H', label: 'Center' },
    { value: 'RIGHT', label: 'Right' },
  ];
}
// image field with a "…" upload helper (single-image widgets)
function buildSingle(obj, key) {
  const wrap = document.createElement('div');
  wrap.className = 'imgpick';
  const sel = ctlSelect(obj[key] || '', imageOptions(true), (v) => { obj[key] = v; });
  wrap.appendChild(sel);
  const b = ctlButton('…', 'Import an image', async () => {
    const imgs = await API.pickImages();
    if (!imgs || !imgs.length) return;
    const it = await importOneImage(imgs[0]);
    if (it) { pushHistory(); obj[key] = it.name; refreshPanels(); render(); scheduleCode(); }
  });
  b.className = 'grow-btn';
  wrap.appendChild(b);
  return wrap;
}

// --------------------------------------------------------------- test data --
function renderTestData() {
  const host = $('testData');
  if (!host) return;
  host.innerHTML = '';
  let group = null;
  for (const d of DATA_TYPES) {
    if (d.preview == null) continue;
    if (d.group !== group) {
      group = d.group;
      const g = document.createElement('div');
      g.className = 'td-group'; g.textContent = group;
      host.appendChild(g);
    }
    const v = testData[d.key];
    const row = mkRow(d.label, d.note || '');
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = v == null ? '' : v;
    inp.dataset.td = d.key;
    inp.oninput = () => {
      const raw = inp.value;
      testData[d.key] = /^-?\d+(\.\d+)?$/.test(raw.trim()) ? Number(raw) : raw;
      render();
    };
    row.appendChild(inp);
    host.appendChild(row);
  }
}
function syncTestDataInputs() {
  document.querySelectorAll('#testData input[data-td]').forEach((inp) => {
    const k = inp.dataset.td;
    const v = testData[k] == null ? '' : String(testData[k]);
    if (document.activeElement !== inp && inp.value !== v) inp.value = v;
  });
}
function tickClock() {
  const now = new Date();
  clock = { h: now.getHours(), m: now.getMinutes(), s: now.getSeconds() };
  dateParts = { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear(), weekday: ((now.getDay() + 6) % 7) + 1 };
}
function setLiveClock(on) {
  liveClock = !!on;
  $('tdCurrent').checked = liveClock;
  $('btnPreviewLive').classList.toggle('on', liveClock);
  if (liveClock) {
    tickClock();
    if (!clockTimer) clockTimer = setInterval(() => { tickClock(); scheduleCode(); render(); }, 1000);
  } else if (clockTimer) {
    clearInterval(clockTimer); clockTimer = null;
  }
  render();
}
$('tdCurrent').onchange = () => setLiveClock($('tdCurrent').checked);

// -------------------------------------------------------------- code panel --
let codeTimer = null;
function scheduleCode() {
  clearTimeout(codeTimer);
  codeTimer = setTimeout(refreshCode, 260);
}
async function refreshCode() {
  if (!project) return;
  try {
    const res = await API.generateCode({ project });
    $('code').textContent = res.code || '// (no code)';
    const w = $('codeWarn');
    if (res.warnings && res.warnings.length) {
      w.hidden = false;
      w.textContent = `${res.warnings.length} warning${res.warnings.length === 1 ? '' : 's'}: ${res.warnings.join(' · ')}`;
    } else { w.hidden = true; w.textContent = ''; }
  } catch (e) {
    $('code').textContent = '// code generation failed: ' + (e.message || e);
  }
}
$('btnCopyCode').onclick = async () => {
  try { await navigator.clipboard.writeText($('code').textContent || ''); status('Copied the generated watchface JS.'); }
  catch (e) { status('Could not copy: ' + (e.message || e), true); }
};

// ---------------------------------------------------------------- panels API --
function refreshPanels() {
  renderProjectPanel();
  renderLayers();
  renderProps();
  renderTestData();
  renderImagesPanel();
  const has = !!project;
  ['btnComponents', 'btnPresets', 'btnGlyphs', 'btnUpload', 'btnSave', 'btnExportZeus', 'btnBuild', 'btnInstall', 'btnFonts'].forEach((id) => { if ($(id)) $(id).disabled = !has; });
}
function renderProjectPanel() {
  if (!project) return;
  $('inpName').value = project.name || '';
  $('inpDesc').value = project.description || '';
  $('inpAppId').value = project.appId || '';
  $('projDevice').value = project.device;
  const d = dev();
  $('screenInfo').textContent = `${d.w}×${d.h} px · designWidth ${d.designWidth} · ${d.shape === 'r' ? 'round' : d.shape === 's' ? 'square' : 'band'}`;
  $('targetInfo').textContent = `Zeus target ${d.target} · assets/${d.assetDir} · Zepp OS ${d.api}+`;
}
function renderImagesPanel() {
  if (!project) return;
  const host = $('images');
  host.innerHTML = '';
  const used = new Set();
  collectUsedImages(used);
  for (const im of project.images) {
    const cell = document.createElement('div');
    cell.className = 'img' + (used.has(im.name) ? '' : ' unused');
    const thumb = document.createElement('img');
    thumb.src = im.url; thumb.alt = im.name;
    const cap = document.createElement('div');
    cap.className = 'cap'; cap.textContent = im.name;
    cap.title = `${im.name} · ${im.width}×${im.height}`;
    if (!used.has(im.name)) {
      const t = document.createElement('span');
      t.className = 'unused-tag'; t.textContent = 'unused';
      cap.appendChild(t);
    }
    const del = document.createElement('button');
    del.className = 'del'; del.textContent = '×'; del.title = 'Delete image';
    del.onclick = (ev) => { ev.stopPropagation(); deleteImage(im.name); };
    cell.appendChild(thumb); cell.appendChild(cap); cell.appendChild(del);
    host.appendChild(cell);
  }
  $('icount').textContent = String(project.images.length);
}
function collectUsedImages(set) {
  for (const e of elements()) {
    for (const key of ['src', 'unit', 'dot', 'negative', 'hour', 'minute', 'second', 'cover', 'bg', 'am', 'pm']) {
      if (e[key]) set.add(e[key]);
    }
    for (const key of ['images', 'frames']) {
      if (Array.isArray(e[key])) for (const n of e[key]) if (n) set.add(typeof n === 'string' ? n : n.name);
    }
  }
}
function deleteImage(name) {
  const before = project.images.slice();
  project.images = project.images.filter((i) => i.name !== name);
  const scrub = (e) => {
    for (const key of ['src', 'unit', 'dot', 'negative', 'hour', 'minute', 'second', 'cover', 'bg', 'am', 'pm']) if (e[key] === name) e[key] = '';
    for (const key of ['images', 'frames']) if (Array.isArray(e[key])) e[key] = e[key].filter((n) => (typeof n === 'string' ? n : n.name) !== name);
  };
  for (const e of elements()) scrub(e);
  imgCache.delete(name);
  dirty = true;
  showUndoToast(`Deleted ${name} (and cleared the layers that used it).`, () => {
    project.images = before;
    loadAllImages().then(() => { refreshPanels(); render(); scheduleCode(); });
  });
  refreshPanels(); render(); scheduleCode();
}
$('btnPruneImages').onclick = () => {
  const used = new Set();
  collectUsedImages(used);
  const unused = project.images.filter((i) => !used.has(i.name));
  if (!unused.length) { status('No unused images.'); return; }
  const before = project.images.slice();
  project.images = project.images.filter((i) => used.has(i.name));
  dirty = true;
  showUndoToast(`Removed ${unused.length} unused image${unused.length === 1 ? '' : 's'}.`, () => {
    project.images = before;
    loadAllImages().then(() => { refreshPanels(); render(); });
  });
  refreshPanels(); render(); scheduleCode();
};

// ---------------------------------------------------------------- selection --
function deleteElements(list) {
  if (!list.length) return;
  const ids = new Set(list.map((e) => e.id));
  const before = project.elements.slice();
  const imagesBefore = project.images.map((i) => i.name);
  project.elements = project.elements.filter((e) => !ids.has(e.id));
  if (ids.has(selectedId)) selectedId = null;
  multiSel = new Set([...multiSel].filter((id) => !ids.has(id)));
  dirty = true;
  const names = list.map(layerLabel).join(', ');
  showUndoToast(`Deleted ${list.length} layer${list.length === 1 ? '' : 's'} (${names}).`, () => {
    project.elements = before;
    project.images = project.images.filter((i) => imagesBefore.includes(i.name));
    refreshPanels(); render(); scheduleCode();
  });
  refreshPanels(); render(); scheduleCode();
}
function deleteSelection() { deleteElements(selection()); }
function duplicateSelection() {
  const sel = selection();
  if (!sel.length) return;
  pushHistory();
  const taken = new Set(elements().map((e) => e.name));
  const copies = sel.map((e) => {
    const copy = JSON.parse(JSON.stringify(e));
    copy.id = `el${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
    copy.name = uniqName(`${e.name} copy`, taken);
    taken.add(copy.name);
    moveEl(copy, 12, 12);
    copy.group = null;
    project.elements.push(copy);
    return copy;
  });
  selectedId = copies[copies.length - 1].id;
  multiSel = new Set(copies.map((c) => c.id));
  refreshPanels(); render(); scheduleCode();
}
function uniqName(base, taken) {
  taken = taken || new Set(elements().map((e) => e.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}
function groupSelection() {
  const sel = selection();
  if (sel.length < 2) { status('Select two or more layers to group them.'); return; }
  pushHistory();
  const gid = `g${Date.now().toString(36)}`;
  project.groups = project.groups || {};
  project.groups[gid] = `Group ${Object.keys(project.groups).length + 1}`;
  for (const e of sel) e.group = gid;
  refreshPanels(); render(); scheduleCode();
}
function ungroup() {
  const sel = selection();
  const targets = sel.length ? sel : [];
  if (!targets.length) return;
  pushHistory();
  for (const e of targets) e.group = null;
  for (const gid of Object.keys(project.groups || {})) {
    if (!elements().some((e) => e.group === gid)) delete project.groups[gid];
  }
  refreshPanels(); render(); scheduleCode();
}
$('btnGroup').onclick = groupSelection;
$('btnUngroup').onclick = ungroup;

// ---------------------------------------------------------------- new element --
// Mirror of core/kinds.js newElement() — the renderer has no require(), so the
// kind defaults come from the metadata the main process sends.
function newElement(kindId, patch = {}) {
  const k = kindById(kindId);
  return {
    id: `el${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    kind: kindId,
    name: k ? k.label : kindId,
    x: 0, y: 0,
    show: 'both',
    visible: true, locked: false, group: null, alpha: 255,
    ...(k ? k.defaults : {}),
    ...patch,
  };
}
async function addElement(kindId, patch = {}) {
  if (!project) return null;
  const k = kindById(kindId);
  if (!k) return null;
  pushHistory();
  const e = newElement(kindId, patch);
  e.name = uniqName(k.label, new Set(elements().map((x) => x.name)));
  const d = dev();
  const n = elements().length;
  // stagger so successive widgets do not stack exactly
  if (CENTER_KINDS.has(kindId)) {
    e.centerX = Math.round(d.w / 2) + (n % 3) * 10;
    e.centerY = Math.round(d.h / 2) + (n % 4) * 10;
  } else {
    e.x = Math.round(d.w / 4) + (n % 3) * 12;
    e.y = Math.round(d.h / 3) + (n % 5) * 14;
  }
  project.elements.push(e);
  selectedId = e.id;
  multiSel = new Set([e.id]);
  // digit-driven widgets get a usable set straight away
  if (kindId === 'IMG_TIME' || kindId === 'IMG_DATE' || kindId === 'TEXT_IMG' || kindId === 'IMG_LEVEL' || kindId === 'IMG_PROGRESS') {
    await attachDigitSet(e);
  }
  refreshPanels(); render(); scheduleCode();
  return e;
}
async function attachDigitSet(e) {
  try {
    const prefix = nextDigitPrefix();
    const names = await genGlyphImages('0123456789'.split('').map((c, i) => ({ tag: String(i), char: c })), { prefix });
    if (e.kind === 'IMG_LEVEL' || e.kind === 'IMG_PROGRESS') e.images = names.slice(0, 10);
    else e.images = names;
  } catch (err) {
    status('Could not generate a digit set: ' + (err.message || err), true);
  }
}
// -------------------------------------------------------------------- menus --
let componentsOpen = false, presetsOpen = false, glyphsOpen = false;
function toggleComponents(open) { componentsOpen = open == null ? !componentsOpen : open; $('componentsMenu').hidden = !componentsOpen; $('btnComponents').classList.toggle('on', componentsOpen); }
function togglePresets(open) { presetsOpen = open == null ? !presetsOpen : open; $('presetsMenu').hidden = !presetsOpen; $('btnPresets').classList.toggle('on', presetsOpen); }
function toggleGlyphs(open) { glyphsOpen = open == null ? !glyphsOpen : open; $('glyphsMenu').hidden = !glyphsOpen; $('btnGlyphs').classList.toggle('on', glyphsOpen); }
document.addEventListener('click', (e) => {
  if (componentsOpen && !e.target.closest('#btnComponents') && !e.target.closest('#componentsMenu')) toggleComponents(false);
  if (presetsOpen && !e.target.closest('#btnPresets') && !e.target.closest('#presetsMenu')) togglePresets(false);
  if (glyphsOpen && !e.target.closest('#btnGlyphs') && !e.target.closest('#glyphsMenu')) toggleGlyphs(false);
});
function buildComponentsMenu() {
  const m = $('componentsMenu');
  m.innerHTML = '';
  let group = null;
  for (const k of KINDS) {
    if (k.group !== group) {
      group = k.group;
      const t = document.createElement('div');
      t.className = 'pm-title'; t.textContent = group;
      m.appendChild(t);
    }
    const b = document.createElement('button');
    b.type = 'button';
    const nm = document.createElement('span');
    nm.textContent = k.label;
    const sub = document.createElement('span');
    sub.className = 'pm-sub'; sub.textContent = `hmUI.${k.id}`;
    b.appendChild(nm); b.appendChild(sub);
    b.onclick = () => { toggleComponents(false); addElement(k.id); };
    m.appendChild(b);
  }
}
$('btnComponents').onclick = (e) => { e.stopPropagation(); toggleComponents(); };
$('btnPresets').onclick = (e) => { e.stopPropagation(); togglePresets(); };
$('btnGlyphs').onclick = (e) => { e.stopPropagation(); toggleGlyphs(); };

// glyph helpers ------------------------------------------------------------
async function genWeekSet() {
  const labels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  return genGlyphImages(labels.map((l, i) => ({ tag: `w${i + 1}`, char: l })), { prefix: 'week', mono: false, size: 40 });
}
async function genUnit(tag, char) {
  // the design specification names separators after the glyph itself
  // (colon.png, dot.png, negative.png …), so use the tag as the file name
  const names = await genGlyphImages([{ tag, char, name: `${tag.replace(/[^\w\-]+/g, '_')}.png` }], { mono: false, size: 40 });
  return names[0];
}
async function ensureDigitNames() {
  const existing = project.images.filter((i) => /^font_\d+_\d+\.png$/.test(i.name));
  const byTag = new Map();
  for (const i of existing) {
    const m = /^font_(\d+)_(\d+)\.png$/.exec(i.name);
    byTag.set(m[2], i.name);
  }
  if (byTag.size === 10) return Array.from({ length: 10 }, (_, i) => byTag.get(String(i)));
  const prefix = nextDigitPrefix();
  return genGlyphImages('0123456789'.split('').map((c, i) => ({ tag: String(i), char: c })), { prefix });
}
async function ensureHands() {
  const specs = [
    ['hour_hand.png', 16, 150, '#ffffff'],
    ['minute_hand.png', 12, 210, '#ffffff'],
    ['second_hand.png', 6, 220, '#e5484d'],
  ];
  const out = {};
  for (const [name, w, h, color] of specs) {
    if (imgMeta(name)) { out[name] = name; continue; }
    const c = drawHandCanvas(w, h, h - 10, color, w);
    addProjectImage(name, c, { replace: false });
    out[name] = name;
  }
  await loadAllImages();
  return out;
}
async function ensureDial() {
  if (imgMeta('dial.png')) return 'dial.png';
  const d = dev();
  const size = Math.round(Math.min(d.w, d.h) * 0.86);
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  const cx = size / 2, cy = size / 2;
  g.strokeStyle = '#ffffff'; g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, size / 2 - 2, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 - 90) * Math.PI / 180;
    const r1 = size / 2 - 4, r2 = size / 2 - (i % 3 === 0 ? 18 : 11);
    g.lineWidth = i % 3 === 0 ? 4 : 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    g.stroke();
  }
  addProjectImage('dial.png', c, { replace: false });
  await loadAllImages();
  return 'dial.png';
}

// build the Glyphs menu ----------------------------------------------------
function glyphMenuItem(m, label, sub, fn) {
  const b = document.createElement('button');
  b.type = 'button';
  const nm = document.createElement('span'); nm.textContent = label;
  b.appendChild(nm);
  if (sub) { const s = document.createElement('span'); s.className = 'pm-sub'; s.textContent = sub; b.appendChild(s); }
  b.onclick = async () => { toggleGlyphs(false); try { await fn(); } catch (e) { status(String(e.message || e), true); } };
  m.appendChild(b);
}
function buildGlyphsMenu() {
  const m = $('glyphsMenu');
  m.innerHTML = '';
  glyphMenuItem(m, 'Font library & glyphs…', `${BUNDLED_FONTS.length} bundled · ${customFonts.length} imported`, async () => {
    openFontModal();
  });
  glyphMenuItem(m, 'Digit set 0-9', `from ${glyphFont}`, async () => {
    const names = await genGlyphImages('0123456789'.split('').map((c, i) => ({ tag: String(i), char: c })), { prefix: nextDigitPrefix() });
    status(`Generated ${names.length} digit images from ${glyphFont}.`);
    refreshPanels();
  });
  glyphMenuItem(m, 'Weekday set (MON-SUN)', '7 images', async () => {
    await genWeekSet(); status('Generated the 7 weekday images.'); refreshPanels();
  });
  glyphMenuItem(m, 'Separators (: . % - ° /)', 'one image each', async () => {
    const entries = [['colon', ':'], ['dot', '.'], ['percent', '%'], ['negative', '-'], ['degree', '°'], ['slash', '/']];
    for (const [tag, ch] of entries) await genUnit(tag, ch);
    status('Generated the separator images (colon, dot, percent, negative, degree, slash).'); refreshPanels();
  });
  glyphMenuItem(m, 'Analog hands', 'hour / minute / second', async () => {
    await ensureHands(); status('Generated hour/minute/second hand images.'); refreshPanels();
  });
  glyphMenuItem(m, 'Analog dial', 'ticks + rim', async () => {
    await ensureDial(); status('Generated dial.png.'); refreshPanels();
  });
}

// ------------------------------------------------------------------ presets --
const PRESETS = [
  { group: 'Canvas' },
  { id: 'bg', label: 'Black background', sub: 'full-screen fill' },
  { group: 'Time' },
  { id: 'clock', label: 'Digital clock', sub: 'hour : minute' },
  { id: 'clocksec', label: 'Digital clock + seconds', sub: 'hh:mm:ss' },
  { id: 'analog', label: 'Analog clock', sub: 'dial + hands' },
  { id: 'weekday', label: 'Weekday', sub: 'MON…SUN images' },
  { id: 'day', label: 'Day of month', sub: 'IMG_DATE' },
  { id: 'month', label: 'Month', sub: 'IMG_DATE' },
  { group: 'Data' },
  { id: 'steps', label: 'Steps', sub: 'TEXT_IMG' },
  { id: 'hr', label: 'Heart rate', sub: 'bpm' },
  { id: 'cal', label: 'Calories', sub: 'kcal' },
  { id: 'battery', label: 'Battery', sub: '%' },
  { id: 'temp', label: 'Temperature', sub: '° + minus' },
  { id: 'distance', label: 'Distance', sub: 'km with dot' },
  { id: 'spo2', label: 'Blood oxygen', sub: '%' },
  { id: 'stress', label: 'Stress', sub: 'score' },
  { id: 'weather', label: 'Weather icon', sub: '29-icon level' },
  { group: 'Progress & shapes' },
  { id: 'arcprogress', label: 'Step progress arc', sub: 'ARC_PROGRESS' },
  { id: 'level', label: 'Battery image level', sub: 'IMG_LEVEL' },
  { id: 'rect', label: 'Filled rectangle', sub: 'FILL_RECT' },
  { id: 'stroke', label: 'Stroked rectangle', sub: 'STROKE_RECT' },
  { id: 'circle', label: 'Circle', sub: 'CIRCLE' },
  { id: 'arc', label: 'Arc', sub: 'ARC' },
  { group: 'Text & misc' },
  { id: 'text', label: 'Text', sub: 'TEXT widget' },
  { id: 'datatext', label: 'Any reading as images', sub: 'TEXT_IMG' },
  { id: 'status', label: 'Bluetooth status', sub: 'IMG_STATUS' },
  { id: 'click', label: 'Tap shortcut', sub: 'IMG_CLICK' },
];
function buildPresetsMenu() {
  const m = $('presetsMenu');
  m.innerHTML = '';
  for (const p of PRESETS) {
    if (p.group) {
      const t = document.createElement('div');
      t.className = 'pm-title'; t.textContent = p.group;
      m.appendChild(t);
      continue;
    }
    const b = document.createElement('button');
    b.type = 'button';
    const nm = document.createElement('span'); nm.textContent = p.label;
    b.appendChild(nm);
    if (p.sub) { const s = document.createElement('span'); s.className = 'pm-sub'; s.textContent = p.sub; b.appendChild(s); }
    b.onclick = async () => {
      togglePresets(false);
      try { await applyPreset(p.id); } catch (e) { status(String(e.message || e), true); }
    };
    m.appendChild(b);
  }
}
async function addPresetElement(kindId, patch) {
  const before = project.elements.length;
  const e = await addElement(kindId, patch);
  // addElement pushed history + refreshed; keep it silent for composite presets
  return e;
}
async function applyPreset(id) {
  if (!project) return;
  const d = dev();
  const cx = Math.round(d.w / 2), cy = Math.round(d.h / 2);
  switch (id) {
    case 'bg': {
      pushHistory();
      const e = newElement('FILL_RECT', { x: 0, y: 0, w: d.w, h: d.h, color: '#000000', radius: 0, name: 'Background', locked: true, show: 'both' });
      project.elements.unshift(e);
      status('Added a black background (locked, in both states).');
      break;
    }
    case 'clock': return clockPreset(false);
    case 'clocksec': return clockPreset(true);
    case 'analog': return analogPreset();
    case 'weekday': return weekdayPreset();
    case 'day':
    case 'month': {
      const digits = await ensureDigitNames();
      const e = newElement('IMG_DATE', { part: id, images: digits, zero: 0, show: 'both', x: cx - 30, y: cy, name: id === 'month' ? 'Month' : 'Day' });
      project.elements.push(e); selectedId = e.id; multiSel = new Set([e.id]);
      break;
    }
    case 'steps': return dataTextPreset('STEP', 'Steps', null);
    case 'hr': return dataTextPreset('HEART', 'Heart rate', await genUnit('bpm', 'bpm'));
    case 'cal': return dataTextPreset('CAL', 'Calories', null);
    case 'battery': return dataTextPreset('BATTERY', 'Battery', await genUnit('percent', '%'));
    case 'temp': return dataTextPreset('WEATHER_CURRENT', 'Temperature', await genUnit('degree', '°'), await genUnit('negative', '-'));
    case 'distance': return dataTextPreset('DISTANCE', 'Distance', null, null, true);
    case 'spo2': return dataTextPreset('SPO2', 'Blood oxygen', await genUnit('percent', '%'));
    case 'stress': return dataTextPreset('STRESS', 'Stress', null);
    case 'weather': {
      pushHistory();
      const names = weatherNamesIfAny();
      const e = newElement('IMG_LEVEL', { dataType: 'WEATHER', images: names, show: 'normal', x: cx - 40, y: cy, w: 0, h: 0, name: 'Weather icon' });
      project.elements.push(e); selectedId = e.id; multiSel = new Set([e.id]);
      if (!names.length) status('Weather icon added — assign the 29 weather images in Properties (Images…).', true);
      break;
    }
    case 'arcprogress': {
      pushHistory();
      const e = newElement('ARC_PROGRESS', { dataType: 'STEP', show: 'normal', centerX: cx, centerY: cy, radius: Math.round(Math.min(d.w, d.h) * 0.32), startAngle: -220, endAngle: 40, lineWidth: 14, color: '#34e073', name: 'Step arc' });
      project.elements.push(e); selectedId = e.id; multiSel = new Set([e.id]);
      break;
    }
    case 'level': {
      const digits = await ensureDigitNames();
      pushHistory();
      const e = newElement('IMG_LEVEL', { dataType: 'BATTERY', images: digits, show: 'normal', w: 0, h: 0, x: cx - 40, y: cy, name: 'Battery level' });
      project.elements.push(e); selectedId = e.id; multiSel = new Set([e.id]);
      break;
    }
    case 'rect': await addElement('FILL_RECT', { x: cx - 90, y: cy - 30, w: 180, h: 60, color: '#101522', radius: 14, show: 'normal' }); break;
    case 'stroke': await addElement('STROKE_RECT', { x: cx - 90, y: cy - 30, w: 180, h: 60, color: '#5b8cff', radius: 14, lineWidth: 3, show: 'normal' }); break;
    case 'circle': await addElement('CIRCLE', { centerX: cx, centerY: cy, radius: 70, color: '#5b8cff', show: 'normal' }); break;
    case 'arc': await addElement('ARC', { x: cx - 100, y: cy - 100, w: 200, h: 200, radius: 90, startAngle: -90, endAngle: 90, lineWidth: 12, color: '#34e073', show: 'normal' }); break;
    case 'text': await addElement('TEXT', { text: 'MONDAY', size: 32, x: cx - 90, y: cy - 20, w: 180, h: 40, color: '#ffffff', alignH: 'CENTER_H', alignV: 'CENTER_V', show: 'normal' }); break;
    case 'datatext': return dataTextPreset('STEP', 'Reading', null);
    case 'status': {
      pushHistory();
      const e = newElement('IMG_STATUS', { status: 'DISCONNECT', show: 'normal', x: 40, y: 40, w: 0, h: 0, name: 'Bluetooth off icon' });
      project.elements.push(e); selectedId = e.id; multiSel = new Set([e.id]);
      break;
    }
    case 'click': {
      pushHistory();
      const e = newElement('IMG_CLICK', { dataType: 'OUTDOOR_RUNNING', show: 'normal', x: cx - 20, y: cy + 90, w: 40, h: 40, name: 'Run shortcut' });
      project.elements.push(e); selectedId = e.id; multiSel = new Set([e.id]);
      break;
    }
    default: break;
  }
  refreshPanels(); render(); scheduleCode();
}
function weatherNamesIfAny() {
  const out = [];
  for (let i = 0; i < 29; i++) {
    const m = project.images.find((x) => new RegExp(`(^|[^0-9])0*${i}(\\D|$)`).test(x.name) && /weather|icon|w_/i.test(x.name));
    if (!m) return [];
    out.push(m.name);
  }
  return out;
}
async function clockPreset(withSeconds) {
  pushHistory();
  const d = dev();
  const digits = await ensureDigitNames();
  const colon = await genUnit('colon', ':');
  const cell = imgMeta(digits.find(Boolean));
  const cw = cell ? cell.width : 40, ch = cell ? cell.height : 60;
  const colonMeta = imgMeta(colon);
  const colonW = colonMeta ? colonMeta.width : Math.round(cw * 0.5);
  const colonH = colonMeta ? colonMeta.height : ch;
  const gap = Math.round(ch * 0.2);
  const digitW = cw * 2;
  // lay the parts out in order, then centre the whole row
  const seq = [{ t: 'hour', w: digitW }, { t: 'colon', w: colonW }, { t: 'minute', w: digitW }];
  if (withSeconds) seq.push({ t: 'colon', w: colonW }, { t: 'second', w: digitW });
  const total = seq.reduce((s, x) => s + x.w, 0) + gap * (seq.length - 1);
  let x = Math.round((d.w - total) / 2);
  const y = Math.round((d.h - ch) / 2);
  const els = [];
  let colonCount = 0;
  for (const part of seq) {
    if (part.t === 'colon') {
      colonCount++;
      els.push(newElement('IMG', { src: colon, show: 'both', x, y: Math.round((d.h - colonH) / 2), w: 0, h: 0, name: colonCount === 1 ? 'Colon' : 'Colon 2' }));
    } else {
      els.push(newElement('IMG_TIME', { part: part.t, images: digits, zero: 0, space: 0, show: part.t === 'second' ? 'normal' : 'both', x, y, name: part.t.charAt(0).toUpperCase() + part.t.slice(1) }));
    }
    x += part.w + gap;
  }
  project.elements.push(...els);
  selectedId = els[0].id; multiSel = new Set(els.map((e) => e.id));
  status(`Added a digital clock from ${glyphFont} glyphs.`);
  refreshPanels(); render(); scheduleCode();
}
async function analogPreset() {
  pushHistory();
  const d = dev();
  const hands = await ensureHands();
  const dial = await ensureDial();
  const e = newElement('TIME_POINTER', {
    centerX: Math.round(d.w / 2), centerY: Math.round(d.h / 2),
    hour: hands['hour_hand.png'], minute: hands['minute_hand.png'], second: hands['second_hand.png'],
    cover: dial,
    name: 'Analog clock',
  });
  e.show = 'normal';
  // pivots sit at the tail of each hand image
  for (const [key, file] of [['hour', 'hour_hand.png'], ['minute', 'minute_hand.png'], ['second', 'second_hand.png']]) {
    const m = imgMeta(file);
    e[`${key}PivotX`] = m ? Math.round(m.width / 2) : 0;
    e[`${key}PivotY`] = m ? m.height - 10 : 0;
  }
  project.elements.push(e);
  selectedId = e.id; multiSel = new Set([e.id]);
  status('Added an analog clock (hands + dial).');
  refreshPanels(); render(); scheduleCode();
}
async function weekdayPreset() {
  pushHistory();
  const d = dev();
  let names = project.images.filter((i) => /^week_w\d/.test(i.name)).map((i) => i.name);
  if (names.length !== 7) names = await genWeekSet();
  const m = imgMeta(names[0]);
  const e = newElement('IMG_WEEK', { images: names, show: 'both', x: Math.round(d.w / 2) - (m ? Math.round(m.width / 2) : 30), y: Math.round(d.h * 0.2), name: 'Weekday' });
  project.elements.push(e); selectedId = e.id; multiSel = new Set([e.id]);
  refreshPanels(); render(); scheduleCode();
}
async function dataTextPreset(dataType, label, unit, negative, useDot) {
  pushHistory();
  const d = dev();
  const digits = await ensureDigitNames();
  const cell = imgMeta(digits.find(Boolean));
  const cw = cell ? cell.width : 30, ch = cell ? cell.height : 44;
  const e = newElement('TEXT_IMG', {
    dataType, images: digits, hSpace: Math.max(1, Math.round(cw * 0.06)),
    unit: unit || '', negative: negative || '', dot: useDot ? await genUnit('dot', '.') : '',
    alignH: 'LEFT', show: 'normal',
    // stack successive readings under the centre so presets do not pile up
    x: Math.round(d.w / 2) - cw,
    y: Math.round(d.h / 2) + 40 + project.elements.filter((x) => x.kind === 'TEXT_IMG').length * (ch + 14),
    name: label,
  });
  project.elements.push(e); selectedId = e.id; multiSel = new Set([e.id]);
  refreshPanels(); render(); scheduleCode();
}

// ------------------------------------------------------- image set dialog --
let ismState = null;   // { e, field, entries, ismSortable }
function setFieldOf(e) { return e.kind === 'IMG_ANIM' ? 'frames' : 'images'; }
function openImageSet(e) {
  const field = setFieldOf(e);
  ismState = { e, field, entries: [...(e[field] || [])] };
  const k = kindById(e.kind);
  $('ismTitle').textContent = `${k ? k.label : e.kind} · ${field}`;
  $('ismSub').textContent = e.kind === 'IMG_WEEK'
    ? 'Seven images, index 0 = Monday (the watch picks one per weekday)'
    : 'Drag the handle to reorder · index 0 is the first frame (digit 0, weather icon 0 …)';
  const hint = setHint(e.kind, { ...e, images: ismState.entries });
  $('ismHint').hidden = !hint;
  $('ismHint').textContent = hint || '';
  ismRender();
  refreshIsmPick();
  $('imgSetModal').hidden = false;
}
function refreshIsmPick() {
  const sel = $('ismPick');
  sel.innerHTML = '';
  const o0 = document.createElement('option');
  o0.value = ''; o0.textContent = '— pick a project image —';
  sel.appendChild(o0);
  for (const im of project.images) {
    const o = document.createElement('option');
    o.value = im.name; o.textContent = im.name;
    sel.appendChild(o);
  }
  sel.onchange = () => {
    $('ismPreview').hidden = true;
    if (!sel.value) return;
    const im = imgFor(sel.value);
    if (im) { $('ismPreview').src = im.src; $('ismPreview').hidden = false; }
  };
}
function ismRender() {
  const host = $('ismList');
  host.innerHTML = '';
  ismState.entries.forEach((name, i) => {
    const row = document.createElement('div');
    row.className = 'ilm-row';
    row.dataset.name = name;
    const grip = document.createElement('span');
    grip.className = 'grip'; grip.innerHTML = ICON.grip;
    const idx = document.createElement('span');
    idx.className = 'idx'; idx.textContent = String(i);
    const thumb = document.createElement('img');
    const im = imgFor(name);
    if (im) thumb.src = im.src;
    const nm = document.createElement('span');
    nm.className = 'nm'; nm.textContent = name;
    nm.title = name;
    const rm = document.createElement('button');
    rm.className = 'rm'; rm.textContent = '×'; rm.title = 'Remove';
    rm.onclick = () => { ismState.entries.splice(i, 1); ismRender(); };
    row.appendChild(grip); row.appendChild(idx); row.appendChild(thumb); row.appendChild(nm); row.appendChild(rm);
    host.appendChild(row);
  });
  $('ismCount').textContent = `${ismState.entries.length}`;
  if (typeof Sortable !== 'undefined') {
    if (ismState.sortable) ismState.sortable.destroy();
    ismState.sortable = Sortable.create(host, {
      handle: '.grip', animation: 120, ghostClass: 'sortable-ghost', fallbackClass: 'sortable-fallback', fallbackOnBody: true,
      onEnd: () => {
        const names = [...host.querySelectorAll('.ilm-row')].map((r) => r.dataset.name);
        ismState.entries = names;
        ismRender();
      },
    });
  }
}
$('ismAdd').onclick = () => {
  const v = $('ismPick').value;
  if (!v) return;
  ismState.entries.push(v);
  ismRender();
};
$('ismUpload').onclick = () => $('ismUploadFile').click();
$('ismUploadFile').onchange = async (ev) => {
  const files = [...ev.target.files];
  ev.target.value = '';
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const img = await loadImgEl(url);
    if (!img) continue;
    const mode = await openFitDialog(img, f.name);
    if (!mode) continue;
    const canvas = composeFit(img, mode.mode, mode.fx, mode.fy, dev().w, dev().h);
    const name = uniqImageName(f.name.replace(/\.[^.]+$/, '').replace(/[^\w\-]+/g, '_') + '.png');
    addProjectImage(name, canvas, { replace: false });
    await loadAllImages();
    ismState.entries.push(name);
    refreshIsmPick();
  }
  ismRender(); refreshPanels();
};
$('ismGenDigits').onclick = async () => {
  try {
    const prefix = nextDigitPrefix();
    const names = await genGlyphImages('0123456789'.split('').map((c, i) => ({ tag: String(i), char: c })), { prefix });
    ismState.entries = names;
    ismRender(); refreshIsmPick(); refreshPanels();
    status(`Generated a 0-9 set from ${glyphFont} (${prefix}).`);
  } catch (e) { status(String(e.message || e), true); }
};
$('ismGenWeather').onclick = () => {
  const names = weatherNamesIfAny();
  if (!names.length) { status('No 29-icon weather set found. Import images named like weather_0.png … weather_28.png first.', true); return; }
  ismState.entries = names; ismRender();
};
$('ismGenWeek').onclick = async () => {
  const names = project.images.filter((i) => /^week_w\d/.test(i.name)).map((i) => i.name);
  if (names.length === 7) { ismState.entries = names; ismRender(); return; }
  try { ismState.entries = await genWeekSet(); ismRender(); refreshIsmPick(); refreshPanels(); }
  catch (e) { status(String(e.message || e), true); }
};
$('ismCancel').onclick = () => { $('imgSetModal').hidden = true; ismState = null; };
$('ismSave').onclick = () => {
  if (!ismState) return;
  pushHistory();
  ismState.e[ismState.field] = ismState.entries.slice();
  $('imgSetModal').hidden = true;
  ismState = null;
  refreshPanels(); render(); scheduleCode();
};
async function openAnimFrames(e) {
  const imgs = await API.pickImages();
  if (!imgs || !imgs.length) return;
  pushHistory();
  const prefix = (e.name || 'anim').toLowerCase().replace(/[^\w]+/g, '_');
  const frames = [];
  let i = 0;
  for (const item of imgs) {
    const url = 'data:image/png;base64,' + item.dataBase64;
    const img = await loadImgEl(url);
    if (!img) continue;
    frames.push(`anim/${prefix}_${i}.png`);
    const canvas = composeFit(img, 'asis', 0.5, 0.5, dev().w, dev().h);
    addProjectImage(`anim/${prefix}_${i}.png`, canvas, { replace: false });
    i++;
  }
  await loadAllImages();
  e.animPrefix = prefix;
  e.frames = frames;
  refreshPanels(); render(); scheduleCode();
}

// --------------------------------------------------------- import / fit dialog --
function loadImgEl(src) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}
// compose an imported image for the screen: asis keeps every pixel, cover fills
// the screen (crop via the drag offsets), contain fits inside it
function composeFit(img, mode, fx, fy, W, H) {
  if (mode === 'asis') {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c;
  }
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const scale = mode === 'cover' ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih);
  const dw = iw * scale, dh = ih * scale;
  const dx = mode === 'cover' ? (W - dw) * fx : (W - dw) / 2;
  const dy = mode === 'cover' ? (H - dh) * fy : (H - dh) / 2;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, dx, dy, dw, dh);
  return c;
}
function fitResultSize(img, mode, W, H) {
  if (mode === 'asis') return { w: img.naturalWidth, h: img.naturalHeight };
  return { w: W, h: H };
}
let cropState = null;
function openFitDialog(img, name, defaultMode = 'asis') {
  return new Promise((resolve) => {
    const stage = $('cropStage');
    const cv = $('cropCv');
    const modes = document.querySelectorAll('input[name="cropMode"]');
    const mode = defaultMode || 'asis';
    for (const r of modes) r.checked = r.value === mode;
    const d = dev();
    const stageW = 300;
    const scale = Math.min(stageW / d.w, 220 / d.h, 1);
    const vw = Math.round(d.w * scale), vh = Math.round(d.h * scale);
    stage.style.width = vw + 'px';
    stage.style.height = vh + 'px';
    cv.width = vw; cv.height = vh;
    cropState = { img, mode, fx: 0.5, fy: 0.5, drag: null, resolve, vw, vh };
    $('cropName').textContent = name || '';
    const draw = () => {
      const s = cropState;
      const g = cv.getContext('2d');
      g.clearRect(0, 0, vw, vh);
      g.fillStyle = '#05070c';
      g.fillRect(0, 0, vw, vh);
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const sc = s.mode === 'cover' ? Math.max(vw / iw, vh / ih) : s.mode === 'contain' ? Math.min(vw / iw, vh / ih) : scale;
      const dw = iw * sc, dh = ih * sc;
      let dx, dy;
      if (s.mode === 'cover') { dx = (vw - dw) * s.fx; dy = (vh - dh) * s.fy; }
      else { dx = (vw - dw) / 2; dy = (vh - dh) / 2; }
      g.drawImage(img, dx, dy, dw, dh);
      const out = fitResultSize(img, s.mode, d.w, d.h);
      $('cropSize').textContent = `${out.w}×${out.h}`;
      const info = $('cropInfo');
      info.classList.toggle('warn', s.mode !== 'asis' && (out.w < iw || out.h < ih));
      info.textContent = s.mode === 'asis'
        ? 'The image is kept at its own size — good for icons and digits.'
        : s.mode === 'cover' ? 'Fills the screen; drag the image to choose what stays visible.'
          : 'Fits inside the screen, centred, keeping the aspect ratio.';
      stage.classList.toggle('can-drag', s.mode === 'cover');
    };
    cropState.draw = draw;
    const onMove = (e) => {
      if (!cropState || !cropState.drag) return;
      const r = stage.getBoundingClientRect();
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const sc = Math.max(vw / iw, vh / ih);
      cropState.fx = clamp01(cropState.drag.fx - (e.clientX - cropState.drag.x) / (vw - iw * sc));
      cropState.fy = clamp01(cropState.drag.fy - (e.clientY - cropState.drag.y) / (vh - ih * sc));
      draw();
    };
    const onUp = () => { if (cropState) { cropState.drag = null; stage.classList.remove('dragging'); } };
    stage.onmousedown = (e) => {
      if (!cropState || cropState.mode !== 'cover') return;
      cropState.drag = { x: e.clientX, y: e.clientY, fx: cropState.fx, fy: cropState.fy };
      stage.classList.add('dragging');
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    for (const r of modes) r.onchange = () => { if (cropState) { cropState.mode = r.value; draw(); } };
    $('cropOk').onclick = () => {
      const res = { mode: cropState.mode, fx: cropState.fx, fy: cropState.fy };
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      $('cropModal').hidden = true;
      const r = cropState.resolve; cropState = null; r(res);
    };
    $('cropCancel').onclick = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      $('cropModal').hidden = true;
      const r = cropState.resolve; cropState = null; r(null);
    };
    $('cropModal').hidden = false;
    draw();
  });
}
async function importOneImage(item, opts = {}) {
  const url = 'data:image/png;base64,' + item.dataBase64;
  const img = await loadImgEl(url);
  if (!img) return null;
  const fit = await openFitDialog(img, (item.name || 'image') + '.png', opts.defaultMode || 'asis');
  if (!fit) return null;
  const canvas = composeFit(img, fit.mode, fit.fx, fit.fy, dev().w, dev().h);
  const base = String(item.name || 'image').replace(/\.[^.]+$/, '').replace(/[^\w\-]+/g, '_') + '.png';
  const name = uniqImageName(base);
  addProjectImage(name, canvas, { replace: false });
  await loadAllImages();
  return { name, width: canvas.width, height: canvas.height };
}
async function importImages(items, opts = {}) {
  const added = [];
  for (const it of items) {
    const r = await importOneImage(it, opts);
    if (r) added.push(r);
  }
  if (added.length) {
    pushHistory();
    refreshPanels(); render();
    status(`Imported ${added.length} image${added.length === 1 ? '' : 's'}.`);
  }
  return added;
}
$('btnUpload').onclick = async () => {
  const imgs = await API.pickImages();
  if (imgs && imgs.length) await importImages(imgs);
};
$('fileUpload').onchange = async (ev) => {
  const files = [...ev.target.files];
  ev.target.value = '';
  const items = [];
  for (const f of files) items.push({ name: f.name, dataBase64: (await fileToBase64(f)) });
  if (items.length) await importImages(items);
};
function fileToBase64(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.readAsDataURL(file);
  });
}
// -------------------------------------------------------------------- canvas input --
// contextBridge exposes `window.api` as a non-configurable global, so binding it
// to a `const api` would throw "Identifier has already been declared".
const API = window.api;
function eventDevPos(ev) {
  const cv = $('cv');
  const r = cv.getBoundingClientRect();
  const sc = cv.width / (r.width || 1);
  return { x: (ev.clientX - r.left) * sc, y: (ev.clientY - r.top) * sc };
}
function alignTargets(excludeId) {
  const xs = [], ys = [];
  for (const e of elements()) {
    if (e.id === excludeId || e.visible === false) continue;
    const b = elBox(e);
    xs.push(b.x, b.x + b.w / 2, b.x + b.w);
    ys.push(b.y, b.y + b.h / 2, b.y + b.h);
  }
  return { xs, ys };
}
function snapAxis(value, size, targets, snapTo) {
  const refs = [value, value + size / 2, value + size];
  let best = null;
  for (const t of targets) {
    for (let k = 0; k < 3; k++) {
      const d = Math.abs(refs[k] - t);
      if (d <= SNAP_PX && (!best || d < best.d)) best = { d, delta: t - refs[k], at: t, snapTo };
    }
  }
  return best;
}
// snap a box against the other widgets, the screen centre and the grid
function snapBox(boxX, boxY, boxW, boxH, excludeId) {
  const d = dev();
  const cx = d.w / 2, cy = d.h / 2;
  const al = alignTargets(excludeId);
  const gx = [], gy = [];
  for (let x = GRID_PX; x < d.w; x += GRID_PX) gx.push(x);
  for (let y = GRID_PX; y < d.h; y += GRID_PX) gy.push(y);
  const bx = snapAxis(boxX, boxW, [...al.xs, cx], 'align') || snapAxis(boxX, boxW, gx, 'grid');
  const by = snapAxis(boxY, boxH, [...al.ys, cy], 'align') || snapAxis(boxY, boxH, gy, 'grid');
  const v = [], h = [];
  let nX = boxX, nY = boxY;
  if (bx) { nX = Math.round(boxX + bx.delta); if (bx.snapTo === 'align' || bx.at === cx) v.push(bx.at); }
  if (by) { nY = Math.round(boxY + by.delta); if (by.snapTo === 'align' || by.at === cy) h.push(by.at); }
  guides = { v, h };
  return { x: nX, y: nY };
}
function hitElement(ev) {
  const p = eventDevPos(ev);
  const list = elements();
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (e.visible === false || e.locked) continue;
    const b = elBox(e);
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return e;
  }
  return null;
}
function handleAt(ev) {
  const e = selEl();
  if (!e) return null;
  const p = eventDevPos(ev);
  const b = elBox(e);
  const tol = Math.max(5, Math.round(9 * (cv_scale())));
  if (e.kind === 'CIRCLE' || e.kind === 'ARC_PROGRESS') {
    if (Math.hypot(p.x - (b.x + b.w), p.y - (b.y + b.h / 2)) <= tol) return 'radius';
    return null;
  }
  if (!WH_KINDS.has(e.kind)) return null;
  const pts = { nw: [b.x, b.y], ne: [b.x + b.w, b.y], sw: [b.x, b.y + b.h], se: [b.x + b.w, b.y + b.h] };
  for (const k of Object.keys(pts)) {
    if (Math.abs(p.x - pts[k][0]) <= tol && Math.abs(p.y - pts[k][1]) <= tol) return k;
  }
  return null;
}
function cv_scale() {
  const cv = $('cv');
  const r = cv.getBoundingClientRect();
  return r.width ? cv.width / r.width : 1;
}
let drag = null;
$('cv').addEventListener('mousedown', (ev) => {
  if (!project) return;
  const handle = handleAt(ev);
  const p = eventDevPos(ev);
  if (handle && selEl()) {
    const e = selEl();
    const b = elBox(e);
    pushHistory();
    drag = { mode: 'resize', handle, e, px: p.x, py: p.y, startX: +e.x || 0, startY: +e.y || 0, startW: b.w, startH: b.h, startRadius: +e.radius || 60, cx: +e.centerX || 0, cy: +e.centerY || 0 };
    return;
  }
  const hit = hitElement(ev);
  if (!hit) {
    selectedId = null; multiSel = new Set();
    refreshPanels(); render();
    return;
  }
  if (!(selectedId === hit.id || multiSel.has(hit.id))) { selectedId = hit.id; multiSel = new Set([hit.id]); }
  else selectedId = hit.id;
  pushHistory();
  refreshPanels(); render();
  drag = {
    mode: 'move', e: hit, px: p.x, py: p.y,
    startBox: elBox(hit),
    mates: selection().filter((m) => m.id !== hit.id && !m.locked).map((m) => ({ el: m, box: elBox(m) })),
  };
});
window.addEventListener('mousemove', (ev) => {
  if (!drag || !project) return;
  const p = eventDevPos(ev);
  if (drag.mode === 'move') {
    const rawDx = p.x - drag.px, rawDy = p.y - drag.py;
    let boxX = drag.startBox.x + rawDx, boxY = drag.startBox.y + rawDy;
    if (showGrid) {
      const s = snapBox(boxX, boxY, drag.startBox.w, drag.startBox.h, drag.e.id);
      boxX = s.x; boxY = s.y;
    } else guides = { v: [], h: [] };
    const dx = Math.round(boxX - drag.startBox.x), dy = Math.round(boxY - drag.startBox.y);
    if (drag.dx !== dx || drag.dy !== dy) {
      moveEl(drag.e, dx - (drag.dx || 0), dy - (drag.dy || 0));
      for (const m of drag.mates) moveEl(m.el, dx - (drag.dx || 0), dy - (drag.dy || 0));
      drag.dx = dx; drag.dy = dy;
      render();
    }
    return;
  }
  // resize
  const e = drag.e;
  const dx = p.x - drag.px, dy = p.y - drag.py;
  if (drag.handle === 'radius') {
    e.radius = Math.max(4, Math.round(Math.hypot(p.x - drag.cx, p.y - drag.cy)));
    render(); return;
  }
  let { startX: x, startY: y, startW: w, startH: h } = drag;
  if (drag.handle.includes('e')) w = drag.startW + dx;
  if (drag.handle.includes('s')) h = drag.startH + dy;
  if (drag.handle.includes('w')) { x = drag.startX + dx; w = drag.startW - dx; }
  if (drag.handle.includes('n')) { y = drag.startY + dy; h = drag.startH - dy; }
  if (e.kind === 'TEXT') { w = Math.max(20, w); h = Math.max(16, h); }
  if (w < 2) { w = 2; }
  if (h < 2) { h = 2; }
  e.x = Math.round(x); e.y = Math.round(y); e.w = Math.round(w); e.h = Math.round(h);
  render();
});
window.addEventListener('mouseup', () => {
  if (!drag) return;
  drag = null;
  guides = { v: [], h: [] };
  if (project) { refreshPanels(); render(); scheduleCode(); }
});
$('cv').addEventListener('mousemove', (ev) => {
  if (drag || !project) return;
  const h = handleAt(ev);
  const cursor = h === 'radius' ? 'nwse-resize' : h ? (h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize') : (hitElement(ev) ? 'move' : 'default');
  $('cv').style.cursor = cursor;
});
$('cv').addEventListener('dblclick', (ev) => {
  const hit = hitElement(ev);
  if (hit && hit.group) {
    selectedId = hit.id; multiSel = new Set([hit.id]);
    refreshPanels(); render();
  }
});
// drop files onto the preview to import them
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  if (!project) return;
  const items = [];
  for (const f of [...(e.dataTransfer.files || [])]) {
    if (f.path && API.readImage) {
      const r = await API.readImage(f.path);
      if (r) items.push(r);
    } else {
      items.push({ name: f.name, dataBase64: await fileToBase64(f) });
    }
  }
  if (items.length) await importImages(items);
});
// preview-state buttons
function setPreviewMode(mode) {
  previewMode = mode;
  $('btnPreviewNormal').classList.toggle('on', mode === 'normal');
  $('btnPreviewAod').classList.toggle('on', mode === 'aod');
  if (project) render();
}
$('btnPreviewNormal').onclick = () => setPreviewMode('normal');
$('btnPreviewAod').onclick = () => setPreviewMode('aod');
$('btnPreviewLive').onclick = () => setLiveClock(!liveClock);

// -------------------------------------------------------------- project lifecycle --
function freshProject(name, target) {
  return {
    version: 1,
    name: name || 'My watchface',
    device: target,
    appId: 2000000 + Math.floor(Math.random() * 900000),
    vender: 'watchface-designer',
    description: '',
    font: glyphFont,
    fonts: [],
    groups: {},
    elements: [],
    images: [],
    savePath: null,
  };
}
function resetTestData() {
  testData = {};
  for (const d of DATA_TYPES) {
    if (d.preview != null) testData[d.key] = d.preview;
  }
  clock = { ...REF_CLOCK };
  dateParts = { ...REF_DATE };
}
let newFaceMode = 'new';
function fillDeviceSelect(sel) {
  sel.innerHTML = '';
  const groups = {};
  for (const d of DEVICES) {
    const label = d.shape === 'r' ? 'Round' : d.shape === 's' ? 'Square' : 'Band';
    if (!groups[label]) { groups[label] = document.createElement('optgroup'); groups[label].label = label; sel.appendChild(groups[label]); }
    const o = document.createElement('option');
    o.value = d.target; o.textContent = d.label;
    groups[label].appendChild(o);
  }
}
function openNewFaceDialog() {
  newFaceMode = 'new';
  $('newFaceModal').querySelector('h3').textContent = 'New watchface';
  $('newFaceName').value = '';
  $('newFaceCreate').textContent = 'Create';
  $('newFaceTemplate').closest('.row').style.display = '';
  if (!project) $('newFaceDevice').value = DEVICES[0].target;
  $('newFaceModal').hidden = false;
  $('newFaceName').focus();
}
function openConvertDialog() {
  if (!project) return;
  newFaceMode = 'convert';
  $('newFaceModal').querySelector('h3').textContent = 'Change device';
  $('newFaceName').value = project.name || '';
  $('newFaceCreate').textContent = 'Convert';
  $('newFaceTemplate').closest('.row').style.display = 'none';
  $('newFaceDevice').value = project.device;
  $('newFaceModal').hidden = false;
}
$('btnNew').onclick = openNewFaceDialog;
$('btnEmptyNew').onclick = openNewFaceDialog;
$('btnEmptyOpenProject').onclick = () => $('btnOpen').click();
$('btnConvert').onclick = openConvertDialog;
$('newFaceCancel').onclick = () => { $('newFaceModal').hidden = true; };
$('newFaceCreate').onclick = async () => {
  const name = $('newFaceName').value.trim() || 'My watchface';
  const target = $('newFaceDevice').value;
  $('newFaceModal').hidden = true;
  if (newFaceMode === 'convert') { convertProject(target, name); return; }
  const template = $('newFaceTemplate').value;
  await createProject(name, target, template);
};
async function createProject(name, target, template) {
  project = freshProject(name, target);
  project.font = glyphFont;
  project.images = [];
  imgCache.clear();
  selectedId = null; multiSel = new Set();
  past = []; future = []; updateHistoryButtons(); dirty = true;
  resetTestData();
  glyphFont = project.font;
  $('projFont').value = glyphFont;
  setEmptyState(); refreshPanels(); render();
  if (template === 'digital') { await clockPreset(false); }
  else if (template === 'analog') { await analogPreset(); }
  else if (template === 'health') {
    await dataTextPreset('STEP', 'Steps', null);
    await dataTextPreset('HEART', 'Heart rate', await genUnit('bpm', 'bpm'));
    await dataTextPreset('BATTERY', 'Battery', await genUnit('percent', '%'));
  }
  status(`New watchface “${name}” on ${dev().name}.`);
  refreshPanels(); render(); scheduleCode();
}
function convertProject(target, name) {
  const from = dev();
  const to = DEVICES.find((d) => d.target === target);
  if (!to) return;
  pushHistory();
  const sx = to.w / from.w, sy = to.h / from.h;
  const s = (v) => Math.round((+v || 0) * sx);
  const t = (v) => Math.round((+v || 0) * sy);
  for (const e of elements()) {
    if (e.kind === 'CIRCLE' || e.kind === 'ARC_PROGRESS' || e.kind === 'TIME_POINTER') {
      e.centerX = s(e.centerX); e.centerY = t(e.centerY);
      if (e.radius) e.radius = Math.round(e.radius * Math.min(sx, sy));
    } else {
      if (e.x != null) e.x = s(e.x);
      if (e.y != null) e.y = t(e.y);
      if (e.w) e.w = s(e.w);
      if (e.h) e.h = t(e.h);
      if (e.centerX) e.centerX = s(e.centerX);
      if (e.centerY) e.centerY = t(e.centerY);
    }
  }
  project.device = target;
  project.name = name || project.name;
  refreshPanels(); render(); scheduleCode();
  status(`Converted “${project.name}” from ${from.name} to ${to.name}. Images keep their size — check the layout.`);
}
$('btnCloseProject').onclick = () => {
  project = null; selectedId = null; multiSel = new Set();
  imgCache.clear();
  past = []; future = []; updateHistoryButtons();
  setEmptyState(); refreshPanels(); renderRecents();
  status('');
};
$('inpName').oninput = (ev) => { if (!project) return; project.name = ev.target.value; dirty = true; $('watchTitle').textContent = project.name || 'Watchface'; scheduleCode(); };
$('inpDesc').oninput = (ev) => { if (!project) return; project.description = ev.target.value; dirty = true; scheduleCode(); };
$('inpAppId').oninput = (ev) => { if (!project) return; project.appId = +ev.target.value || 0; dirty = true; scheduleCode(); };
$('projFont').onchange = (ev) => { glyphFont = ev.target.value; if (project) { project.font = glyphFont; scheduleCode(); buildGlyphsMenu(); } };
$('projDevice').onchange = (ev) => {
  if (!project || ev.target.value === project.device) return;
  const target = ev.target.value;
  $('projDevice').value = project.device;   // revert; use the Convert button instead
  status('Use “Change device…” to retarget the project (it scales the layout).');
};

// ------------------------------------------------------------ open / save / recents --
function setEmptyState() {
  const empty = !project;
  document.querySelector('main').classList.toggle('empty', empty);
  $('emptyState').hidden = !empty;
  if (empty) renderRecents();
}
async function loadProject(res) {
  project = res.project;
  project.groups = project.groups || {};
  project.elements = project.elements || [];
  project.images = (res.images || []).map((i) => ({
    name: i.name, width: i.width, height: i.height,
    url: 'data:image/png;base64,' + i.dataBase64,
  }));
  project.savePath = res.savePath || null;
  customFonts.length = 0;
  for (const f of res.fonts || []) await registerCustomFont(f, { quiet: true });
  fillFontSelect($('projFont'));
  buildFontList();
  glyphFont = project.font || glyphFont;
  if (!fontFamilies().includes(glyphFont)) glyphFont = 'Orbitron';
  $('projFont').value = glyphFont;
  selectedId = null; multiSel = new Set(); groupCollapsed = new Set();
  past = []; future = []; updateHistoryButtons(); dirty = false;
  resetTestData();
  await loadAllImages();
  setEmptyState(); refreshPanels(); render(); scheduleCode();
  status(`Opened “${project.name}” (${project.elements.length} layers, ${project.images.length} images).`);
}
$('btnOpen').onclick = async () => {
  const res = await API.openProjectDialog();
  if (!res) return;
  if (res.error) { status(res.error, true); return; }
  await loadProject(res);
};
async function doSave() {
  if (!project) return;
  const payload = {
    project: { ...project, fonts: projectFontsPayload() },
    images: projectImagesPayload(),
    fonts: fontRecords(),
    savePath: project.savePath || null,
    previewBase64: composePreviewB64(),
  };
  const res = await API.saveProject(payload);
  if (!res) return;
  project.savePath = res.savePath;
  dirty = false;
  status(`Saved → ${res.savePath}`);
  renderRecents();
}
$('btnSave').onclick = doSave;
async function renderRecents() {
  const wrap = $('recentWrap'), list = $('recentList');
  if (!wrap || project) { if (wrap) wrap.hidden = true; return; }
  let items = [];
  try { items = (await API.recentList()) || []; } catch (e) { items = []; }
  list.innerHTML = '';
  wrap.hidden = !items.length;
  for (const r of items) {
    const d = document.createElement('div');
    d.className = 'recent-item' + (r.exists ? '' : ' missing');
    d.title = r.path;
    const main = document.createElement('div');
    main.className = 'ri-main';
    const nm = document.createElement('div');
    nm.className = 'ri-name'; nm.textContent = r.name || String(r.path).split(/[\\/]/).pop();
    const pth = document.createElement('div');
    pth.className = 'ri-path';
    const dv = DEVICES.find((x) => x.target === r.device);
    pth.textContent = (dv ? dv.name + ' · ' : '') + r.path + (r.exists ? '' : ' · missing');
    main.appendChild(nm); main.appendChild(pth);
    d.appendChild(main);
    const open = document.createElement('button');
    open.className = 'icon-only';
    open.textContent = r.exists ? 'Open' : '—';
    open.disabled = !r.exists;
    open.onclick = async (ev) => {
      ev.stopPropagation();
      const res = await API.openProjectPath(r.path);
      if (res && res.error) { status(res.error, true); return; }
      if (res) await loadProject(res);
    };
    d.appendChild(open);
    if (r.exists) d.onclick = () => open.onclick(new Event('click'));
    list.appendChild(d);
  }
}

// ------------------------------------------------------------------- export --
let lastLogPath = null;
function openLogModal(title, path, sub) {
  $('logTitle').textContent = title;
  $('logPath').textContent = path || '';
  $('logSub').textContent = sub || '';
  $('logBox').textContent = '';
  lastLogPath = path || null;
  $('logModal').hidden = false;
}
function appendLog(line) {
  const box = $('logBox');
  box.textContent += line + '\n';
  box.scrollTop = box.scrollHeight;
}
$('logClose').onclick = () => { $('logModal').hidden = true; };
$('logFolder').onclick = () => { if (lastLogPath) API.showInFolder(lastLogPath); };
$('btnExportZeus').onclick = async () => {
  if (!project) return;
  const payload = { project, images: projectImagesPayload(), fonts: fontRecords(), previewBase64: composePreviewB64() };
  const res = await API.exportZeus(payload);
  if (!res) return;
  if (res.ok === false) { openLogModal('Zeus export failed', '', res.error); return; }
  lastLogPath = res.outDir;
  openLogModal('Zeus project exported', res.outDir,
    `${res.target} · assets/${res.assetDir} · watchface/${res.target}/index.js`);
  appendLog('app.json, app.js, README.md and the watchface code were written.');
  if (res.warnings && res.warnings.length) appendLog('\nWarnings:\n- ' + res.warnings.join('\n- '));
  appendLog('\nNext:\n  cd ' + JSON.stringify(res.outDir) + '\n  npm i @zeppos/zeus-cli -g\n  zeus preview   # QR for the Zepp app (developer mode)\n  zeus build     # installable .zab in dist/');
  status(`Exported the Zeus project → ${res.outDir}`);
};
$('btnBuild').onclick = async () => {
  if (!project) return;
  openLogModal('Zeus build', '', 'running the Zeus CLI…');
  appendLog('Exporting the project first…');
  const payload = { project, images: projectImagesPayload(), fonts: fontRecords(), previewBase64: composePreviewB64() };
  const res = await API.buildZeus(payload);
  lastLogPath = res.outDir || null;
  if (res.error && res.error !== 'cancelled') {
    $('logSub').textContent = res.error;
    appendLog('\n' + res.error);
    return;
  }
  $('logPath').textContent = res.outDir || '';
  $('logSub').textContent = res.ok
    ? `build finished · ${(res.artifacts || []).length} artifact(s) in dist/`
    : `the Zeus CLI exited with code ${res.code}`;
  if (res.ok) {
    appendLog('\nArtifacts:');
    for (const a of res.artifacts || []) appendLog('  ' + a);
    status('Build finished — see the log for the .zab path.');
  } else {
    status('Build failed — see the log.', true);
  }
};

// -------------------------------------------------------------------- lint --
function hexLuminance(hex) {
  const s = String(hex || '').replace('#', '');
  if (s.length !== 3 && s.length !== 6) return null;
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  if (!Number.isFinite(n)) return null;
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// a shape painted with a near-black colour costs no AOD pixels
function elemLuminance(e) {
  if (['FILL_RECT', 'STROKE_RECT', 'CIRCLE', 'ARC', 'ARC_PROGRESS', 'TEXT'].includes(e.kind)) return hexLuminance(e.color);
  return null;
}
function lintProject() {
  const out = [];
  const d = dev();
  const add = (level, message) => out.push({ level, message });
  if (!project.name || !project.name.trim()) add('warn', 'The watchface has no name — the store requires one.');
  if (!project.appId || project.appId < 1) add('error', 'Set an App id (1 … 9999999) before exporting.');
  if (!project.elements.length) add('warn', 'There are no layers yet.');
  const taken = new Set();
  let aodArea = 0;
  for (const e of project.elements) {
    const b = elBox(e);
    const label = e.name || e.kind;
    if (taken.has(label)) add('warn', `Duplicate layer name “${label}” — rename one of them.`);
    taken.add(label);
    const fullscreen = b.w >= d.w - 1 && b.h >= d.h - 1;
    if (b.x < -1 || b.y < -1 || b.x + b.w > d.w + 1 || b.y + b.h > d.h + 1) {
      add('error', `“${label}” is off-screen (box ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}×${Math.round(b.h)} on ${d.w}×${d.h}).`);
    } else if (!fullscreen && (b.x < SAFE_PX || b.y < SAFE_PX || b.x + b.w > d.w - SAFE_PX || b.y + b.h > d.h - SAFE_PX)) {
      add('info', `“${label}” touches the 2px safe edge — the bezel may clip it.`);
    }
    if (e.visible === false) continue;
    if (SET_KINDS.has(e.kind)) {
      const n = (e.images || []).length;
      if (!n) add('warn', `“${label}” has no images — it will not draw.`);
      else if (e.kind === 'IMG_TIME' || e.kind === 'IMG_DATE' || e.kind === 'TEXT_IMG') {
        if (e.kind !== 'IMG_DATE' && n !== 10) add('warn', `“${label}” is a digit set with ${n} images — the spec uses 10 (0-9).`);
      } else if (e.kind === 'IMG_WEEK' && n !== 7) {
        add('error', `“${label}” is a weekday set with ${n} images — it must have exactly 7.`);
      } else if (e.kind === 'IMG_LEVEL' && e.dataType === 'WEATHER' && n !== 29) {
        add('warn', `“${label}” uses a weather level with ${n} icons — the spec defines 29 (0-28).`);
      }
    }
    for (const key of ['src', 'unit', 'dot', 'negative', 'hour', 'minute', 'second', 'cover', 'bg', 'am', 'pm']) {
      if (e[key] && !imgMeta(e[key])) add('error', `“${label}” references a missing image: ${e[key]}.`);
    }
    for (const key of ['images', 'frames']) {
      for (const n of (e[key] || [])) {
        const nm = typeof n === 'string' ? n : n.name;
        if (nm && !imgMeta(nm)) add('error', `“${label}” references a missing image: ${nm}.`);
      }
    }
    if (e.kind === 'TEXT' && !(+(e.size || 0) > 0)) add('error', `“${label}” has a text size of 0.`);
    if (e.kind === 'TEXT' && e.fontFile) {
      const fam = familyForFontFile(e.fontFile);
      const known = customFonts.some((f) => f.name === e.fontFile) || BUNDLED_FONTS.some((f) => baseName(f.file) === e.fontFile);
      if (!known) add('error', `“${label}” uses the font ${e.fontFile}, which is not in the project — re-import it.`);
      else if (!fam) add('info', `“${label}”: ${e.fontFile} will be copied into assets/${d.assetDir}/fonts/ for the build.`);
    }
    if (e.kind === 'IMG_ANIM' && showAllowed(e.show, 'aod')) add('warn', `“${label}” is an animation shown in AOD — the spec discourages that.`);
    if (e.kind === 'TIME_POINTER' && e.second && showAllowed(e.show, 'aod')) {
      add('error', `“${label}” shows the second hand in AOD — the spec forbids it.`);
    }
    if (e.kind === 'ARC_PROGRESS' && e.dataType && !(dtByKey(e.dataType) && dtByKey(e.dataType).reader)) {
      add('info', `“${label}”: ${e.dataType} has no automatic reader instance in the generated code — set the level by hand.`);
    }
    if (showAllowed(e.show, 'aod')) {
      const lum = elemLuminance(e);
      if (lum == null || lum > 0.18) aodArea += Math.min(b.w * b.h, d.w * d.h);
    }
  }
  const ratio = aodArea / (d.w * d.h);
  if (ratio > 0.10) add('warn', `Roughly ${Math.round(ratio * 100)}% of the screen is lit in AOD — the spec asks for under 10%.`);
  const used = new Set();
  collectUsedImages(used);
  const unused = project.images.filter((i) => !used.has(i.name));
  if (unused.length) add('info', `${unused.length} image${unused.length === 1 ? '' : 's'} in the project are unused.`);
  for (const m of (project.font ? [] : [])) add('info', m);
  if (!glyphFont) add('info', 'Pick a glyph font to generate digit images.');
  return out;
}
function showLint() {
  if (!project) return;
  const items = lintProject();
  const host = $('lintList');
  host.innerHTML = '';
  const order = { error: 0, warn: 1, info: 2 };
  items.sort((a, b) => order[a.level] - order[b.level]);
  $('lintCount').textContent = items.length ? `${items.length} item${items.length === 1 ? '' : 's'}` : 'all clear';
  if (!items.length) {
    const d = document.createElement('div');
    d.className = 'lint-item info';
    d.textContent = 'No problems found. The project matches the Zepp watchface design rules we check.';
    host.appendChild(d);
  }
  for (const it of items) {
    const d = document.createElement('div');
    d.className = 'lint-item ' + it.level;
    d.textContent = it.message;
    host.appendChild(d);
  }
  $('lintModal').hidden = false;
}
$('btnLint').onclick = showLint;
$('lintClose').onclick = () => { $('lintModal').hidden = true; };

// ------------------------------------------------------------------ panels --
document.querySelectorAll('[data-panel-head]').forEach((head) => {
  head.onclick = () => {
    const panel = head.closest('[data-panel]');
    if (panel) panel.classList.toggle('collapsed');
  };
});

// ------------------------------------------------------------ font library --
let fontSelFamily = null;

function openFontModal() {
  $('fontModal').hidden = false;
  fontSelFamily = (fontSelFamily && fontFamilies().includes(fontSelFamily)) ? fontSelFamily : glyphFont;
  buildFontList();
  renderFontPreview();
}
function buildFontList() {
  const wrap = $('fontList');
  wrap.innerHTML = '';
  $('fontCount').textContent = `${BUNDLED_FONTS.length} bundled · ${customFonts.length} imported`;
  const group = (label) => {
    const h = document.createElement('div');
    h.className = 'font-group';
    h.textContent = label;
    wrap.appendChild(h);
  };
  const row = (family, meta) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'font-row' + (family === fontSelFamily ? ' on' : '');
    const n = document.createElement('span'); n.className = 'f-name'; n.textContent = family;
    const s = document.createElement('span'); s.className = 'f-meta'; s.textContent = meta;
    b.appendChild(n); b.appendChild(s);
    ensureFont(family).then((ok) => { if (ok) n.style.fontFamily = `"${family}"`; });
    b.onclick = () => { fontSelFamily = family; buildFontList(); renderFontPreview(); };
    wrap.appendChild(b);
  };
  if (customFonts.length) {
    group('Project fonts');
    for (const f of customFonts) row(f.family, `${f.name} · ${String(f.ext || '').replace('.', '')}`);
  }
  const cats = [];
  for (const f of BUNDLED_FONTS) if (!cats.includes(f.cat || 'Bundled')) cats.push(f.cat || 'Bundled');
  for (const cat of cats) {
    group(cat);
    for (const f of BUNDLED_FONTS.filter((x) => (x.cat || 'Bundled') === cat)) row(f.family, baseName(f.file));
  }
}
function fontForm() {
  return {
    size: Math.max(6, Math.min(400, +$('fontSize').value || 48)),
    color: $('fontColor').value || '#ffffff',
    weight: +$('fontWeight').value || 400,
    variations: $('fontVariation').value.trim(),
  };
}
function renderFontPreview() {
  const cv = $('fontPreview');
  const c = cv.getContext('2d');
  const { size, color, weight, variations } = fontForm();
  c.clearRect(0, 0, cv.width, cv.height);
  c.fillStyle = '#0b0f14';
  c.fillRect(0, 0, cv.width, cv.height);
  const family = fontSelFamily || glyphFont;
  const wasLoaded = fontCache.has(family);
  if (!wasLoaded) ensureFont(family, weight).then((ok) => { if (ok) renderFontPreview(); });
  const active = wasLoaded || fontCache.has(family);
  // the canvas is a fixed 460×230 window, so clamp the specimen sizes
  const big = Math.min(size, 104);
  const row = Math.min(Math.round(size * 0.55), 48);
  const small = Math.min(Math.round(size * 0.38), 32);
  // header
  c.fillStyle = active ? '#7cc4ff' : '#ff9f9f';
  c.font = '12px -apple-system, sans-serif';
  c.textAlign = 'left'; c.textBaseline = 'top';
  c.fillText(`${family} · ${size}px · ${weight}${active ? '' : ' · not loaded'}`, 14, 9);
  // the clock
  c.fillStyle = color;
  c.textBaseline = 'middle';
  setFontOn(c, family, big, weight, variations);
  c.fillText('10:09', 14, 64);
  c.font = '11px -apple-system, sans-serif';
  c.fillStyle = '#5b6b80';
  const w1 = c.measureText('10:09').width;
  c.fillText(`← ${Math.round(w1)}px wide`, Math.min(14 + w1 + 10, cv.width - 110), 64);
  // digit row + accents
  c.fillStyle = color;
  setFontOn(c, family, row, weight, variations);
  c.fillText('0123456789', 14, 128);
  setFontOn(c, family, small, weight, variations);
  c.fillText('SAT 17 OCT · 08670', 14, 172);
  c.fillText(': . % - ° /  STEP 75%', 14, 206);
  $('fontInfo').textContent = active
    ? `Rasterizing glyphs with ${family}. A Text layer can also ship this file so the watch draws live text with it.`
    : `${family} could not be loaded in this session.`;
}
function useGlyphFont(family) {
  glyphFont = family || fontSelFamily || glyphFont;
  if (project) { project.font = glyphFont; scheduleCode(); }
  fillFontSelect($('projFont'));
  buildGlyphsMenu();
}
async function importFonts() {
  const picked = await API.pickFont();
  if (!picked || !picked.length) return;
  for (const rec of picked) {
    const entry = await registerCustomFont(rec);
    if (entry) status(`Imported “${entry.family}” from ${entry.name}.`);
  }
  fillFontSelect($('projFont'));
  if (picked[0]) {
    const first = customFonts.find((f) => f.name === picked[0].name);
    fontSelFamily = first ? first.family : fontSelFamily;
  }
  buildFontList();
  renderFontPreview();
  refreshPanels();
}
$('btnFonts').onclick = () => { if (project) openFontModal(); };
$('fontImport').onclick = () => importFonts();
$('fontClose').onclick = () => { $('fontModal').hidden = true; };
$('fontRemove').onclick = () => {
  const rec = customFont(fontSelFamily);
  if (!rec) { status('Only imported fonts can be removed — bundled ones ship with the designer.', true); return; }
  const used = (project ? project.elements : []).filter((e) => e.fontFile === rec.name);
  for (const e of used) e.fontFile = '';
  customFonts.splice(customFonts.indexOf(rec), 1);
  fontCache.delete(rec.family);
  if (glyphFont === rec.family) useGlyphFont('Orbitron');
  if (used.length) status(`Removed “${rec.family}” and unlinked it from ${used.length} layer(s).`);
  else status(`Removed “${rec.family}”.`);
  fillFontSelect($('projFont'));
  buildFontList(); renderFontPreview(); refreshPanels(); render(); scheduleCode();
};
$('fontUseGlyph').onclick = () => { useGlyphFont(fontSelFamily); status(`Glyphs now come from ${glyphFont}.`); };
for (const id of ['fontSize', 'fontColor', 'fontWeight', 'fontVariation']) {
  // remember the settings so the Glyphs menu quick actions reuse them
  $(id).oninput = () => { glyphOpts = fontForm(); renderFontPreview(); };
  $(id).onchange = () => { glyphOpts = fontForm(); renderFontPreview(); };
}
async function fontGen(what) {
  if (!fontSelFamily) return;
  useGlyphFont(fontSelFamily);
  const o = fontForm();
  const opts = { family: fontSelFamily, size: o.size, color: o.color, weight: o.weight, variations: o.variations };
  try {
    if (what === 'digits') {
      const names = await genGlyphImages('0123456789'.split('').map((c, i) => ({ tag: String(i), char: c })), { ...opts, prefix: nextDigitPrefix() });
      status(`Generated ${names.length} digit images from ${fontSelFamily}.`);
    } else if (what === 'week') {
      await genWeekSet(); status('Generated the 7 weekday images.');
    } else if (what === 'sep') {
      for (const [tag, ch] of [['colon', ':'], ['dot', '.'], ['percent', '%'], ['negative', '-'], ['degree', '°'], ['slash', '/']]) await genUnit(tag, ch);
      status('Generated the separator images.');
    } else if (what === 'hands') {
      await ensureHands(); status('Generated hour/minute/second hand images.');
    } else if (what === 'dial') {
      await ensureDial(); status('Generated dial.png.');
    }
  } catch (e) { status(String(e.message || e), true); }
  refreshPanels(); render();
}
$('fontGenDigits').onclick = () => fontGen('digits');
$('fontGenWeek').onclick = () => fontGen('week');
$('fontGenSep').onclick = () => fontGen('sep');
$('fontGenHands').onclick = () => fontGen('hands');
$('fontGenDial').onclick = () => fontGen('dial');

// ------------------------------------------------------- install over Wi-Fi --
let instQrWhat = 'install';
let instLast = null;
let instBusy = false;

function instLogLine(line) {
  const box = $('instLog');
  box.textContent += line + '\n';
  box.scrollTop = box.scrollHeight;
}
function copyText(text) {
  const done = () => status('Copied to the clipboard.');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallback());
    return;
  }
  fallback();
  function fallback() {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { status('Could not copy — select the URL manually.', true); }
    ta.remove();
  }
}
function fillInstallAddresses(list) {
  const sel = $('instAddress');
  const cur = sel.value;
  const addrs = (list && list.length) ? list : (META.addresses || []);
  sel.innerHTML = '';
  for (const a of addrs) {
    const o = document.createElement('option');
    o.value = a.address;
    o.textContent = `${a.address}${a.iface ? ' · ' + a.iface : ''}`;
    sel.appendChild(o);
  }
  if (!addrs.length) {
    const o = document.createElement('option');
    o.value = '127.0.0.1'; o.textContent = '127.0.0.1 · no LAN address found';
    sel.appendChild(o);
  }
  if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
}
function packageRoute(st) {
  const files = (st && st.files) || [];
  const pkg = files.find((f) => /\.zab$/i.test(f.label || '')) || files.find((f) => /\.zab$/i.test(f.route || ''));
  return pkg ? pkg.route : null;
}
function instUrlFor(st) {
  if (!st || !st.running) return null;
  const host = st.host || (META.addresses && META.addresses[0] && META.addresses[0].address) || '127.0.0.1';
  const base = `http://${host}:${st.port}`;
  if (instQrWhat === 'page') return base + '/';
  const route = packageRoute(st);
  return route ? `${base}/${encodeURIComponent(route)}` : base + '/';
}
async function updateInstallQr() {
  const st = instLast;
  const url = instUrlFor(st);
  const img = $('instQr');
  if (!url) {
    img.hidden = true;
    $('instQrEmpty').hidden = false;
    $('instQrEmpty').textContent = st && st.port ? 'No package on the server yet — press “Build & serve”.' : 'Start the server to get a QR code';
    $('instQrHint').textContent = '';
    return;
  }
  const data = await API.qr({ text: url, width: 400 });
  if (data && img.src !== data) img.src = data;
  img.hidden = !data;
  $('instQrEmpty').hidden = !!data;
  if (!data) $('instQrEmpty').textContent = 'Could not render the QR code';
  $('instQrHint').textContent = instQrWhat === 'install'
    ? 'Zepp App → Developer Mode → scan.'
    : 'Any camera: opens the download page.';
}
function syncInstallButtons() {
  const running = !!(instLast && instLast.running);
  $('instStop').disabled = !running || instBusy;
  $('instBuild').disabled = instBusy || !project;
  $('instServe').disabled = instBusy || !project;
  const url = instUrlFor(instLast);
  $('instCopy').disabled = !url;
  $('instOpen').disabled = !url;
}
async function refreshInstall(status) {
  instLast = status || await API.installStatus();
  $('instState').textContent = instLast.running ? `serving · port ${instLast.port}` : 'stopped';
  fillInstallAddresses(instLast.addresses);
  if (instLast.host && [...$('instAddress').options].some((o) => o.value === instLast.host)) $('instAddress').value = instLast.host;
  if (instLast.port) $('instPort').value = instLast.port;
  const files = $('instFiles');
  files.innerHTML = '';
  if (!instLast.files || !instLast.files.length) {
    const d = document.createElement('div');
    d.className = 'muted small';
    d.textContent = 'No package built yet — press “Build & serve”.';
    files.appendChild(d);
  } else {
    for (const f of instLast.files) {
      const d = document.createElement('div');
      d.className = 'inst-file' + (/\.[zZ][aA][bB]$/.test(f.label) ? ' pkg' : '');
      const n = document.createElement('span');
      n.className = 'if-name'; n.textContent = f.label;
      const m = document.createElement('span');
      m.className = 'if-meta'; m.textContent = `${f.kind} · ${fmtBytes(f.size)}`;
      d.appendChild(n); d.appendChild(m);
      files.appendChild(d);
    }
  }
  await updateInstallQr();
  $('instUrl').textContent = instUrlFor(instLast) || '—';
  syncInstallButtons();
}
function fmtBytes(n) {
  const v = Number(n) || 0;
  if (v >= 1048576) return (v / 1048576).toFixed(2) + ' MB';
  if (v >= 1024) return (v / 1024).toFixed(1) + ' KB';
  return v + ' B';
}
function installPayload() {
  return {
    project: { ...project, fonts: projectFontsPayload() },
    images: projectImagesPayload(),
    fonts: fontRecords(),
    previewBase64: composePreviewB64(),
    port: +$('instPort').value || 7331,
    address: $('instAddress').value,
  };
}
async function doInstall(mode) {
  if (!project || instBusy) return;
  instBusy = true;
  $('instLog').textContent = '';
  syncInstallButtons();
  const d = dev();
  if (mode === 'build') {
    instLogLine(`Exporting and building for ${d.name} (${d.target}), API level ${d.api}…`);
    const br = await API.installBuild(installPayload());
    if (!br || br.ok === false) {
      instLogLine(`build failed: ${(br && br.error) || 'unknown error'}`);
      $('instState').textContent = 'build failed';
      instBusy = false;
      syncInstallButtons();
      renderRecents();
      return;
    }
    instLogLine(`build ok · ${(br.artifacts || []).length} artifact(s) in ${br.outDir}`);
  }
  instLogLine('starting the server…');
  const res = await API.installStart(installPayload());
  instBusy = false;
  if (res && res.ok === false) instLogLine('server error: ' + res.error);
  else instLogLine(`serving ${res.installUrl || res.pageUrl}`);
  await refreshInstall(res);
}
async function openInstallModal() {
  if (!project) return;
  $('installModal').hidden = false;
  $('instLog').textContent = '';
  fillInstallAddresses(null);
  await refreshInstall();
  if (instLast.running) {
    instLogLine(`serving ${instUrlFor(instLast) || ''}`);
    instLogLine('waiting for the watch to fetch the package…');
  } else {
    instLogLine('Press “Build & serve” to package the watchface and start the server.');
  }
}
$('btnInstall').onclick = openInstallModal;
$('instClose').onclick = () => { $('installModal').hidden = true; };
$('instBuild').onclick = () => doInstall('build');
$('instServe').onclick = () => doInstall('serve');
$('instStop').onclick = async () => {
  instLogLine('stopping the server…');
  const st = await API.installStop();
  await refreshInstall(st);
};
$('instFolder').onclick = () => API.installOpenFolder();
$('instCopy').onclick = () => { const u = instUrlFor(instLast); if (u) copyText(u); };
$('instOpen').onclick = () => { const u = instUrlFor(instLast); if (u) API.openExternal(u); };
$('instAddress').onchange = async () => {
  // the server binds every interface, only the advertised URL changes
  if (instLast) instLast = { ...instLast, host: $('instAddress').value };
  await updateInstallQr();
  const u = instUrlFor(instLast);
  $('instUrl').textContent = u || '—';
  syncInstallButtons();
};
$('instPort').onchange = () => {
  const p = +$('instPort').value;
  if (!Number.isInteger(p) || p < 1024 || p > 65535) { status('Port must be between 1024 and 65535.', true); $('instPort').value = (instLast && instLast.port) || 7331; return; }
  if (instLast && instLast.running && instLast.port !== p) instLogLine(`port ${p} applies the next time you start the server (still on ${instLast.port}).`);
};
for (const r of document.querySelectorAll('input[name="instQrWhat"]')) {
  r.onchange = async () => {
    if (!r.checked) return;
    instQrWhat = r.value;
    await updateInstallQr();
    const u = instUrlFor(instLast);
    $('instUrl').textContent = u || '—';
    syncInstallButtons();
  };
}

// --------------------------------------------------------------------- init --
async function init() {
  META = await API.meta();
  DEVICES = META.devices;
  DATA_TYPES = META.dataTypes;
  KINDS = META.kinds;
  SHOW_LEVELS = META.showLevels;
  WEATHER_ICONS = META.weatherIcons;
  SYSTEM_STATUS = META.systemStatus;
  BUNDLED_FONTS = META.fonts || [];
  FONT_VARIATIONS = META.fontVariations || {};
  for (const d of DATA_TYPES) DT_BY_KEY[d.key] = d;
  for (const k of KINDS) KIND_BY_ID[k.id] = k;
  fillFontSelect($('projFont'));
  fillDeviceSelect($('projDevice'));
  fillDeviceSelect($('newFaceDevice'));
  $('newFaceDevice').value = DEVICES[0].target;
  glyphFont = $('projFont').value;
  buildComponentsMenu();
  buildPresetsMenu();
  buildGlyphsMenu();
  resetTestData();
  renderTestData();
  setPreviewMode('normal');
  setLiveClock(false);
  setEmptyState();
  API.onBuildLog((line) => { appendLog(line); if (!$('installModal').hidden) instLogLine(line); });
  API.onLanRequest((req) => {
    if ($('installModal').hidden) return;
    instLogLine(`${req.method} ${req.url} → ${req.status} ${req.label || ''}${req.ip ? '  (' + String(req.ip).replace(/^::ffff:/, '') + ')' : ''}`);
  });
  // animation preview: re-draw only when an animation is on the canvas
  setInterval(() => {
    if (exportRender || !project) return;
    animTick++;
    if (elements().some((e) => e.kind === 'IMG_ANIM' && e.visible !== false)) render();
  }, 120);
}
init().catch((e) => {
  document.body.innerHTML = `<pre style="padding:24px;color:#ffb4b4">Failed to start: ${e && e.message ? e.message : e}</pre>`;
});

