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
const APP_TITLE = 'Dialcraft';
// the unsaved-changes marker: a dot after the face name and in the window title
function updateTitle() {
  const name = project ? (project.name || 'Watchface') : '';
  if (project) $('watchTitle').textContent = name + (dirty ? ' •' : '');
  document.title = project ? `${dirty ? '• ' : ''}${name} — ${APP_TITLE}` : APP_TITLE;
}
function setDirty(v) {
  dirty = !!v;
  updateTitle();
}
// Before anything replaces or closes the open project: Save / Don't save /
// Cancel. Resolves true when it is fine to go ahead.
async function guardUnsaved(detail) {
  if (!project || !dirty) return true;
  const answer = await API.confirmUnsaved({ name: project.name, detail });
  if (answer === 'cancel') return false;
  if (answer === 'discard') return true;
  return doSave();
}

let layerFocus = true;               // dim the layers the current preview doesn't draw
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
// (not IMG_POINTER: the watch draws the pointer at its image size, pivoting on
// its own x/y — see pointerBox)
const WH_KINDS = new Set(['IMG', 'IMG_LEVEL', 'IMG_PROGRESS', 'IMG_ANIM',
  'IMG_STATUS', 'IMG_CLICK', 'TEXT', 'FILL_RECT', 'STROKE_RECT', 'ARC']);
// kinds that draw digit images and therefore take an image array + metrics
const SET_KINDS = new Set(['IMG_TIME', 'IMG_WEEK', 'IMG_DATE', 'TEXT_IMG', 'IMG_LEVEL', 'IMG_PROGRESS']);
// text styling is only written to Text layers when a group/multi selection is used
const TEXT_KINDS = new Set(['TEXT']);

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
// While a gesture runs (scrubbing a number, a burst of wheel steps) every
// change is held, and the whole gesture becomes one undo step at the end.
let historyHold = null;
function holdHistory() { if (historyHold == null) historyHold = snapshot(); }
function releaseHistory() {
  const before = historyHold;
  historyHold = null;
  if (before != null) commitHistory(before);
}
function pushHistory() {
  if (historyHold != null) { setDirty(true); scheduleCode(); return; }
  const s = snapshot();
  if (s == null) return;
  if (past.length && past[past.length - 1] === s) return;
  past.push(s);
  if (past.length > 80) past.shift();
  future = [];
  setDirty(true);
  updateHistoryButtons();
  scheduleCode();
}
// Record a step only when something actually changed since `before` (a
// snapshot taken when a gesture started) — a click that moves nothing must not
// leave a no-op step behind for the next Ctrl+Z.
function commitHistory(before) {
  if (before == null || before === snapshot()) return false;
  if (!(past.length && past[past.length - 1] === before)) past.push(before);
  if (past.length > 80) past.shift();
  future = [];
  setDirty(true);
  updateHistoryButtons();
  scheduleCode();
  return true;
}
// The Undo button of a delete toast: the same step as Ctrl+Z, offered only while
// that step is still the latest one (afterwards Ctrl+Z walks back to it).
function undoToast(message) {
  const after = snapshot();
  showUndoToast(message, () => {
    if (project && snapshot() === after) undo();
    else status('The project changed since — use Undo (Ctrl/Cmd+Z) to step back to it.', true);
  });
}
function restoreHistory(json) {
  const p = JSON.parse(json);
  // the device goes with the layout: "Change device" rescales every layer
  if (p.device) project.device = p.device;
  project.elements = p.elements;
  project.groups = p.groups || {};
  project.name = p.name; project.description = p.description;
  project.appId = p.appId; project.font = p.font;
  project.language = p.language || project.language;
  project.images = p.images || project.images;
  loadAllImages();
  if (selectedId && !elementById(selectedId)) selectedId = null;
  multiSel = new Set([...multiSel].filter((id) => elementById(id)));
  setDirty(true);
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
  // layer order: ] / [ forward / backward, with Shift to the front / back
  if (mod && (e.code === 'BracketRight' || e.code === 'BracketLeft')) {
    e.preventDefault();
    const up = e.code === 'BracketRight';
    reorderSelection(e.shiftKey ? (up ? 'front' : 'back') : (up ? 'forward' : 'backward'));
    return;
  }
  // typing in a field (renaming a group, editing a value) must not nudge or
  // deselect layers
  const typing = document.activeElement && /input|select|textarea/i.test(document.activeElement.tagName);
  if (typing) return;
  if (mod && !e.shiftKey && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    const all = elements().filter((x) => !x.locked && !offView(x));
    if (!all.length) return;
    multiSel = new Set(all.map((x) => x.id));
    if (!multiSel.has(selectedId)) selectedId = all[all.length - 1].id;
    refreshPanels(); render();
    status(`Selected ${all.length} layer${all.length === 1 ? '' : 's'}`);
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const sel = selection();
    if (!sel.length) return;
    e.preventDefault(); deleteSelection(); return;
  }
  // face variant of the selection: Shift+N normal, Shift+A AOD, Shift+B both
  if (e.shiftKey && !mod && /^[NAB]$/i.test(e.key) && selection().length) {
    e.preventDefault();
    setShowIn(selection(), { n: 'normal', a: 'aod', b: 'both' }[e.key.toLowerCase()]);
    return;
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
// what an export/build/install ships: the project's images plus the freshly
// rasterised PNGs of every styled Text layer (see bakedTextImages)
async function exportImagesPayload() {
  return [...projectImagesPayload(), ...(await bakedTextImages())];
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
    coverage: rec.coverage || null,
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
// ---------------------------------------------------- glyph coverage --
// A canvas never says a font lacks a character: it quietly draws it with a
// system font, so "SÂMBĂTĂ" in a font without Ă came out in two typefaces. The
// main process reads each font's cmap (core/fonts.js readCmapRanges); here a
// missing letter is drawn from the font's *own* glyphs instead:
//   1. the other Romanian form (ș ↔ ş, ț ↔ ţ — comma below vs cedilla);
//   2. the base letter plus its accent, the accent taken from the font's
//      spacing mark (ˆ ¸ ´ ¨ …) or, for a breve the font does not have,
//      drawn as a crescent the thickness of the font's stems;
//   3. only when the base letter is missing too does the system font step in —
//      and the caller is told, so the panel can say so.
function fontCoverage(family) {
  const c = customFont(family);
  if (c) return c.coverage || null;
  const b = bundledFont(family);
  return b ? b.coverage || null : null;
}
function fontHas(family, ch) {
  const r = fontCoverage(family);
  if (!r || !ch) return true;                // unknown coverage (woff): trust the font
  const cp = ch.codePointAt(0);
  if (cp <= 0x20) return true;
  let lo = 0, hi = r.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cp < r[mid][0]) hi = mid - 1;
    else if (cp > r[mid][1]) lo = mid + 1;
    else return true;
  }
  return false;
}
const GLYPH_ALTERNATES = { 'ș': 'ş', 'ş': 'ș', 'ț': 'ţ', 'ţ': 'ț', 'Ș': 'Ş', 'Ş': 'Ș', 'Ț': 'Ţ', 'Ţ': 'Ț' };
// combining mark -> the font's spacing form of the same accent
const MARK_SPACING = {
  '\u0300': ['`'], '\u0301': ['\u00B4'], '\u0302': ['\u02C6', '^'], '\u0303': ['\u02DC', '~'],
  '\u0304': ['\u00AF'], '\u0306': ['\u02D8'], '\u0307': ['\u02D9'], '\u0308': ['\u00A8'],
  '\u030A': ['\u02DA', '\u00B0'], '\u030B': ['\u02DD'], '\u030C': ['\u02C7'],
  '\u0326': [','], '\u0327': ['\u00B8', ','], '\u0328': ['\u02DB'],
};
const MARK_BELOW = new Set(['\u0326', '\u0327', '\u0328']);
// how one character is drawn with this family: as itself, as an alternate form,
// composed from base + accent, or (last resort) by the system font
function glyphPlan(family, ch) {
  if (fontHas(family, ch)) return { how: 'native', ch };
  const alt = GLYPH_ALTERNATES[ch];
  if (alt && fontHas(family, alt)) return { how: 'alternate', ch: alt };
  const parts = [...ch.normalize('NFD')];
  if (parts.length > 1 && fontHas(family, parts[0])) {
    const marks = parts.slice(1).map((m) => {
      const spacing = (MARK_SPACING[m] || []).find((g) => fontHas(family, g));
      return { mark: m, glyph: spacing || null, below: MARK_BELOW.has(m) };
    });
    if (marks.every((m) => m.glyph || m.mark === '\u0306')) return { how: 'composed', base: parts[0], marks };
  }
  return { how: 'system', ch };
}
// the characters of `text` this family cannot draw natively, by how they end up
function coverageReport(family, text) {
  const out = { alternate: [], composed: [], system: [] };
  for (const ch of new Set([...String(text || '')])) {
    if (/\s/.test(ch)) continue;
    const p = glyphPlan(family, ch);
    if (p.how !== 'native') out[p.how].push(ch);
  }
  return out;
}
function coverageSummary(family, text) {
  const r = coverageReport(family, text);
  const bits = [];
  if (r.alternate.length) bits.push(`${r.alternate.join(' ')} drawn in its other form`);
  if (r.composed.length) bits.push(`${r.composed.join(' ')} composed from the font's own letter + accent`);
  if (r.system.length) bits.push(`${r.system.join(' ')} not in the font — a system font fills in`);
  return { ...r, native: !bits.length, text: bits.join(' · ') };
}
// Lay a string out with the current ctx.font (textAlign left, alphabetic
// baseline): plain runs stay one fillText (kerning kept), a composed letter is
// its base glyph plus accent pieces. Returns the pieces and the ink box.
const runCache = new Map();
function layoutRun(c, family, text) {
  const key = `${c.font}|${c.fontVariationSettings || ''}|${family}|${text}`;
  const hit = runCache.get(key);
  if (hit) return hit;
  const px = /(\d+(?:\.\d+)?)px/.exec(c.font);
  const size = (px && parseFloat(px[1])) || 32;
  const pieces = [];
  let x = 0, buf = '';
  let L = 0, R = 0, A = 0, D = 0, any = false;
  const ink = (l, r, a, d) => {
    if (!any) { L = l; R = r; A = a; D = d; any = true; return; }
    L = Math.min(L, l); R = Math.max(R, r); A = Math.max(A, a); D = Math.max(D, d);
  };
  const flush = () => {
    if (!buf) return;
    const m = c.measureText(buf);
    pieces.push({ kind: 'text', s: buf, x, y: 0 });
    ink(x - (m.actualBoundingBoxLeft || 0), x + (m.actualBoundingBoxRight || 0), m.actualBoundingBoxAscent || 0, m.actualBoundingBoxDescent || 0);
    x += m.width;
    buf = '';
  };
  let stem = 0;
  const stemWidth = () => {
    if (!stem) {
      const m = c.measureText('l');
      stem = Math.max(1, Math.min(size * 0.2, (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || 0) || size * 0.1));
    }
    return stem;
  };
  for (const ch of [...String(text == null ? '' : text)]) {
    const plan = glyphPlan(family, ch);
    if (plan.how !== 'composed') { buf += plan.ch; continue; }
    flush();
    const bm = c.measureText(plan.base);
    pieces.push({ kind: 'text', s: plan.base, x, y: 0 });
    const bl = x - (bm.actualBoundingBoxLeft || 0), br = x + (bm.actualBoundingBoxRight || 0);
    let top = -(bm.actualBoundingBoxAscent || size * 0.7), bottom = bm.actualBoundingBoxDescent || 0;
    ink(bl, br, -top, bottom);
    const cx = (bl + br) / 2;
    const gap = Math.max(1, size * 0.06);
    for (const mk of plan.marks) {
      if (mk.glyph) {
        const mm = c.measureText(mk.glyph);
        const mw = (mm.actualBoundingBoxRight || 0) - (mm.actualBoundingBoxLeft || 0);
        const gx = cx - mw / 2;
        const gy = mk.below
          ? bottom + gap + (mm.actualBoundingBoxAscent || 0)
          : top - gap - (mm.actualBoundingBoxDescent || 0);
        pieces.push({ kind: 'text', s: mk.glyph, x: gx, y: gy });
        const a = -(gy - (mm.actualBoundingBoxAscent || 0)), d = gy + (mm.actualBoundingBoxDescent || 0);
        ink(gx - (mm.actualBoundingBoxLeft || 0), gx + (mm.actualBoundingBoxRight || 0), a, d);
        if (mk.below) bottom = d; else top = -a;
      } else {
        // a breve: a crescent as wide as half the letter, as thick as its stems
        const t = stemWidth() * 0.8;
        const rx = Math.max(t * 1.6, (br - bl) * 0.28), ry = Math.max(t * 1.2, rx * 0.55);
        const yb = top - gap;                  // bottom of the crescent
        const yc = yb - ry;                    // centre line of the ellipse
        const path = new Path2D();
        path.ellipse(cx, yc, rx, ry, 0, 0, Math.PI, false);
        path.ellipse(cx, yc, Math.max(0.5, rx - t), Math.max(0.5, ry - t), 0, Math.PI, 0, true);
        path.closePath();
        pieces.push({ kind: 'path', path });
        ink(cx - rx, cx + rx, -(yc - t * 0.2), yc + ry);
        top = yc - t * 0.2;
      }
    }
    x += bm.width;
  }
  flush();
  const run = { pieces, width: x, left: any ? -L : 0, right: any ? R : 0, asc: any ? A : 0, desc: any ? D : 0 };
  if (runCache.size > 2000) runCache.clear();
  runCache.set(key, run);
  return run;
}
function runFill(c, run, ox = 0, oy = 0) {
  for (const p of run.pieces) {
    if (p.kind === 'text') c.fillText(p.s, ox + p.x, oy + p.y);
    else { c.save(); c.translate(ox, oy); c.fill(p.path); c.restore(); }
  }
}
function runStroke(c, run, ox = 0, oy = 0) {
  for (const p of run.pieces) {
    if (p.kind === 'text') c.strokeText(p.s, ox + p.x, oy + p.y);
    else { c.save(); c.translate(ox, oy); c.stroke(p.path); c.restore(); }
  }
}
// every non-ASCII letter a language writes in its weekday and month names
function languageChars(tag) {
  const out = new Set();
  for (const kind of ['week', 'month']) {
    for (const form of ['short', 'long']) {
      for (const n of localeNames(kind, tag, form)) {
        for (const ch of [...n.toLocaleUpperCase(tag), ...n.toLocaleLowerCase(tag)]) if (ch.codePointAt(0) > 0x7e) out.add(ch);
      }
    }
  }
  return [...out].join('');
}
function fillFontSelect(sel) {
  sel.innerHTML = '';
  if (sel.id === 'projFont') {
    const o = document.createElement('option');
    o.value = ''; o.textContent = `Not set (new glyphs use ${DEFAULT_GLYPH_FONT})`;
    sel.appendChild(o);
  }
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
  sel.value = sel.id === 'projFont' ? ((project && project.font) || '') : glyphFont;
}
const DEFAULT_GLYPH_FONT = 'Orbitron';

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

// Paint one glyph with the layer's style: solid colour, a 2-stop gradient, a
// gradient parsed from CSS, or a hollow outline — plus optional faux bold (a
// stroke of the same paint, so single-weight fonts get a real bold) and italic
// (a 0.212 slant, applied by the caller as a transform). `gx`/`gy` place the
// gradient back over the glyph cell when the context is already translated.
// `run` is the layoutRun() of the text, so a letter the font lacks is drawn from
// the font's own glyphs (see glyphPlan) in every one of these passes.
function paintGlyph(c, st, run, cellW, cellH, gx, gy) {
  const t = st.fill || 'solid';
  const color = st.color || '#ffffff';
  const box = { x: gx, y: gy, w: cellW, h: cellH };
  if (t === 'gradient') c.fillStyle = linearFill(c, box, st.angle == null ? 90 : +st.angle, [[st.from || color, 0], [st.to || '#000000', 1]]);
  else if (t === 'css') c.fillStyle = cssGradientFill(c, { cssGradient: st.css, color }, box);
  else c.fillStyle = color;
  if (t === 'outline') {
    // A stroked glyph puts a join disc on every corner, and at a sharp angle that
    // disc creeps into the letter ("renders inside the number"). Draw the
    // silhouette dilated by the outline width, then carve the glyph back out:
    // a true outline that never covers the inside, sharp corners included.
    const w = Math.max(1, +st.outlineWidth || 2) + (st.bold ? Math.max(1, Math.round((st.size || 48) / 18)) : 0);
    c.save();
    c.fillStyle = st.outlineColor || color;
    runFill(c, run);
    const steps = Math.max(8, Math.min(24, Math.round(w * 8)));
    for (let i = 0; i < steps; i++) {
      const a2 = (i / steps) * Math.PI * 2;
      runFill(c, run, Math.cos(a2) * w, Math.sin(a2) * w);
    }
    c.globalCompositeOperation = 'destination-out';
    runFill(c, run);
    c.restore();
    return;
  }
  if (st.bold) {
    c.lineJoin = 'round';
    c.miterLimit = 2;
    c.lineWidth = Math.max(1, Math.round((st.size || 48) / 18));
    c.strokeStyle = c.fillStyle;
    runStroke(c, run);
  }
  runFill(c, run);
}

// Draw a set of glyphs from one font into transparent PNGs and register them.
// mono=true shares one cell width so digits line up; entries are {tag,char}.
// `style` carries the glyph styling (fill type, gradient, outline, bold,
// italic); `replace` keeps the existing file names so a layer can be
// restyled in place instead of piling up a new set.
//   metricsRef  extra strings whose height the cell must also fit — separators
//               pass the digits, so colon.png gets the digits' exact cell
//               height and baseline and lines up when placed at the same Y
//   align       where the ink sits in a shared (mono) cell: center/left/right
// The returned names carry `.coverage`: the characters the font could not
// draw natively (see coverageReport).
async function genGlyphImages(entries, opts = {}) {
  const {
    size = glyphOpts.size, color = glyphOpts.color, prefix = null, mono = true,
    family = null, weight = glyphOpts.weight, variations = glyphOpts.variations,
    replace = false, style = null, cellH = 0, metricsRef = null, align = 'center',
  } = opts;
  const st = { fill: 'solid', color, size, ...(style || {}) };
  const fam = family || glyphFont;
  if (!await ensureFont(fam, weight)) throw new Error(`Font not available: ${fam}`);
  const chars = entries.map((e) => e.char).join('');
  try { await document.fonts.load(`${weight && weight !== 400 ? weight + ' ' : ''}${size}px "${fam}"`, chars); } catch (e) { /* keep going */ }
  const meas = document.createElement('canvas').getContext('2d');
  setFontOn(meas, fam, size, weight, variations);
  // An outline ring is drawn outside the glyph, so the cell always reserves room
  // for it — that also keeps the cell size the same when the fill type changes,
  // so toggling Solid/Outline never shifts the digits around.
  // (2 is the outline width a style starts with — the same default for a set
  // generated from the font library, so every cell of a size has one height)
  const pad = Math.max(1, Math.round(size / 28), Math.round(st.outlineWidth != null ? +st.outlineWidth : 2) + 1);
  const info = entries.map((e) => {
    const run = layoutRun(meas, fam, e.char);
    return {
      e, run,
      left: run.left,
      right: run.right,
      asc: run.asc || (/\S/.test(e.char) ? size * 0.8 : 0),
      desc: run.desc,
    };
  });
  const refs = (metricsRef || []).map((t) => layoutRun(meas, fam, t));
  const ascent = Math.ceil(Math.max(0, ...info.map((i) => i.asc), ...refs.map((r) => r.asc)));
  const descent = Math.ceil(Math.max(0, ...info.map((i) => i.desc), ...refs.map((r) => r.desc)));
  // cellH forces a taller cell while keeping the ink where it is (at the top):
  // that is how the degree sign is rasterised as a superscript.
  const H = cellH ? Math.max(1, Math.round(cellH)) : Math.max(1, ascent + descent + pad * 2);
  const slant = st.italic ? Math.ceil(H * 0.212) : 0;
  const wide = Math.ceil(Math.max(...info.map((i) => i.left + i.right)));
  const pre = prefix || nextDigitPrefix();
  const names = [];
  for (const i of info) {
    const cw = Math.max(1, Math.ceil(mono ? wide : (i.left + i.right)) + pad * 2 + slant);
    const c2 = document.createElement('canvas');
    c2.width = cw; c2.height = H;
    const c = c2.getContext('2d');
    setFontOn(c, fam, size, weight, variations);
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    const inkW = Math.max(0, i.left + i.right);
    c.save();
    const free = cw - inkW - slant - pad * 2;
    const lead = align === 'left' ? 0 : align === 'right' ? free : free / 2;
    const tx = pad + lead + i.left + slant;
    const ty = pad + ascent;
    c.translate(tx, ty);
    if (st.italic) c.transform(1, 0, -0.212, 1, 0, 0);
    // paint after the transform, offsetting the gradient so it still spans the cell
    paintGlyph(c, st, i.run, cw, H, -tx, -ty);
    c.restore();
    // an in-place re-render must keep the existing file names (`replace`), a
    // fresh set must never overwrite one that is already in the project
    const want = i.e.name || `${pre}_${i.e.tag}.png`;
    const name = replace ? want : uniqImageName(want);
    addProjectImage(name, c2, { replace });
    names.push(name);
  }
  await loadAllImages();
  names.coverage = coverageReport(fam, entries.map((e) => e.char).join(''));
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
// What the canvas draws for the sample time/date, spelled out in Properties so
// the leading-zero switch, the alignment anchor (and the preview as a whole) can
// be checked against what the generated code asks the watch to do.
function digitPreviewNote(e) {
  const t = digitTextFor(e);
  const isDate = e.kind === 'IMG_DATE';
  // with the live clock running the value changes every second, so the note
  // describes the rule instead of quoting a value that is stale a second later
  const sample = isDate ? `${dateParts.year}-${pad2(dateParts.month)}-${pad2(dateParts.day)}`
      : `${pad2(clock.h)}:${pad2(clock.m)}:${pad2(clock.s)}`;
  const what = liveClock ? 'the live time' : `“${t}” at ${sample}`;
  const hour12 = e.kind === 'IMG_TIME' && (e.part || 'hour') === 'hour12';
  const key = `${isDate ? (e.part === 'month' ? 'month' : 'day') : (e.part || 'hour')}_zero`;
  const zero = !!+e.zero;
  const zeroTxt = hour12
    ? 'the 12-hour form carries no leading-zero or align switch'
    : `leading zero ${zero ? 'on' : 'off'} (${key}: ${zero ? 1 : 0})`;
  const b = digitBox(e);
  const cap = digitCapacity(e);
  const src = followSource(e);
  if (src) {
    return `Preview draws ${what} right after “${src.name || src.part}” (Follow) — ${zeroTxt}, with that layer's spacing and alignment.`;
  }
  const boxTxt = cap ? `a ${cap}-digit box ${Math.round(b.w)}×${Math.round(b.h)}` : `its ${Math.round(b.w)}px run`;
  const alignTxt = hour12 ? 'the run starts at the box'
    : b.run >= b.w ? 'the value fills the box, so Align has nothing to shift'
      : e.alignH === 'RIGHT' ? 'Align Right puts the run at the box\'s right edge'
        : e.alignH === 'CENTER_H' ? 'Align Center centres the run in the box'
          : 'Align Left puts the run at the box\'s left edge';
  return `Preview draws ${what} in ${boxTxt} — ${zeroTxt} · ${alignTxt}.`;
}

// digit string a widget shows in the preview. It has to mirror what the
// generated code asks the watch for — including the leading-zero switch
// (`zero` → hour_zero / minute_zero / day_zero …): with it off the watch draws
// "9", with it on "09", and the editor has to show the same.
function padDigits(v, zero) { return zero ? pad2(v) : String(v); }
function digitTextFor(e) {
  const zero = !!+e.zero;
  switch (e.kind) {
    case 'IMG_TIME': {
      const p = e.part || 'hour';
      if (p === 'minute') return padDigits(clock.m, zero);
      if (p === 'second') return padDigits(clock.s, zero);
      // hour12 carries no zero switch in the export, so it keeps its own form
      if (p === 'hour12') { const h = clock.h % 12; return String(h === 0 ? 12 : h); }
      return padDigits(clock.h, zero);
    }
    case 'IMG_DATE': return padDigits((e.part || 'day') === 'month' ? dateParts.month : dateParts.day, zero);
    case 'TEXT_IMG': {
      const d = dtByKey(e.dataType);
      // the widget shows the reading as it is (22°, 8670 steps); the data type's
      // digit count is the *box* it stays in, not a padding request
      let t = valueString(e.dataType).replace(/[^0-9]/g, '');
      if (d && d.digits) t = t.slice(-d.digits);
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
// `Follow` is the watch's *_follow: the value is drawn directly after the
// previous part of the same kind, using that part's spacing and alignment — the
// export then sends no startX, *_space or *_align for it, exactly like Zepp's own
// tool. Time reads hour → minute → second, a date month → day (the spec's
// "12/04" order).
const FOLLOW_ORDER = {
  IMG_TIME: ['hour', 'hour12', 'minute', 'second'],
  IMG_DATE: ['month', 'day'],
};
function followSource(e) {
  if (!+e.follow) return null;
  const order = FOLLOW_ORDER[e.kind];
  if (!order) return null;
  const idx = order.indexOf(e.part || order[0]);
  if (idx <= 0) return null;
  for (let i = idx - 1; i >= 0; i--) {
    const src = elements().find((x) => x.kind === e.kind && (x.part || order[0]) === order[i] && x !== e);
    if (src) return src;
  }
  return null;
}
// the alignment and spacing a layer really uses (a following part inherits them)
function effAlign(e) { const s = followSource(e); return s ? effAlign(s) : (e.alignH || 'LEFT'); }
function effSpace(e) { const s = followSource(e); return s ? effSpace(s) : setSpacing(e); }
function measureSet(e) {
  const cell = setCell(e);
  const n = Math.max(1, digitTextFor(e).length);
  const sp = effSpace(e);
  return { w: n * cell.w + Math.max(0, n - 1) * sp + setUnitWidth(e), h: cell.h, cell, n, sp };
}
// The box a digit widget occupies. hmUI gives IMG_TIME / IMG_DATE / TEXT_IMG no
// width, so the watch lays the value out inside a box as wide as the part can
// get — hour/minute/second/day/month are two digits, a TEXT_IMG reading as many
// as its data type can show — and `align` places the value *inside* that box
// (Zepp's own tool does the same: getImgArrAfterAlign shifts the run by
// `u - b` / `(u - b) / 2` / 0, and not at all once the run is wider than the
// box). That is why a reading stays put when it grows (9:00 → 10:00) and why a
// value that fills the box looks the same in every align mode. The box is
// anchored at the layer's X — the startX the export sends — so it never jumps.
function digitCapacity(e) {
  if (e.kind === 'IMG_TIME' || e.kind === 'IMG_DATE') return 2;
  if (e.kind === 'TEXT_IMG') {
    if (e.isCharacter) return 0;             // month names have no fixed width
    const d = dtByKey(e.dataType);
    return (d && d.digits) || 0;
  }
  return 0;                                  // IMG_WEEK: one image, no align
}
function digitBox(e) {
  const m = measureSet(e);
  // a following part sits directly after the part it follows
  const sb = followSource(e) ? digitBox(followSource(e)) : null;
  const x = sb ? sb.x + sb.w : devNum(e.x);
  const y = sb ? sb.y : devNum(e.y);
  const cap = digitCapacity(e);
  const capW = cap ? cap * m.cell.w + Math.max(0, cap - 1) * m.sp + setUnitWidth(e) : 0;
  const explicit = e.kind === 'TEXT_IMG' ? devNum(e.w) : 0;   // TEXT_IMG may carry a width
  return { x, y, w: Math.max(explicit, capW, m.w), h: m.h, anchor: x, run: m.w };
}
// where the value's own run starts inside that box (the value is what grows and
// shrinks, the box does not)
function digitRunX(e, b) {
  const run = b.run == null ? b.w : b.run;
  if (run >= b.w) return b.x;
  // the 12-hour form exports no *_align, so it always starts at the box
  const mode = (e.kind === 'IMG_TIME' && (e.part || 'hour') === 'hour12') ? 'LEFT' : effAlign(e);
  if (mode === 'RIGHT') return b.x + b.w - run;
  if (mode === 'CENTER_H') return b.x + (b.w - run) / 2;
  return b.x;
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
    case 'IMG_POINTER': return pointerBox(e);
    case 'IMG':
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
    case 'TEXT_IMG':
      return digitBox(e);
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
// IMG_POINTER (docs: hmUI.widget.IMG_POINTER): center_x/center_y is the pivot on
// the screen, x/y the pivot *inside the pointer image* — so the unrotated image
// sits with its own (x, y) on the screen's (centerX, centerY).
function pointerBox(e) {
  const m = imgMeta(e.src);
  const w = m ? m.width : 20, h = m ? m.height : 60;
  return { x: devNum(e.centerX) - devNum(e.x), y: devNum(e.centerY) - devNum(e.y), w, h };
}
// Bounding box of several boxes / of the current selection. Align, distribute
// and group dragging all work on this box, so what the panel promises is what
// the canvas shows.
function devNum(v, d = 0) { return Number.isFinite(+v) ? +v : d; }
function unionBox(boxes) {
  const x = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w)), y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: x1 - x, h: y1 - y };
}
function selBox(sel) { return unionBox(sel.map((e) => elBox(e))); }
function moveEl(e, dx, dy) {
  if (e.kind === 'CIRCLE' || e.kind === 'ARC_PROGRESS') {
    e.centerX = Math.round((+e.centerX || 0) + dx);
    e.centerY = Math.round((+e.centerY || 0) + dy);
    return;
  }
  if (e.kind === 'TIME_POINTER' || e.kind === 'IMG_POINTER') {
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
    // never above the cell: a unit image taller than the digits (a degree sign
    // generated for a bigger set) is drawn from the cell top instead of centred
    if (m) put(c, e.unit, cx, y + Math.max(0, (cell.h - m.height) / 2), m.width, m.height);
  }
  return cx;
}
// ------------------------------------------------------------- text styles --
// The TEXT widget on the watch takes only one flat `color` plus `text_size`,
// `font` and spacing (https://docs.zepp.com/docs/reference/device-app-api/
// newAPI/ui/widget/TEXT/) — no gradient, no outline, no bold, no italic. Those
// styles exist only in the designer: the canvas draws them live and the export
// rasterises the layer into a transparent PNG that is emitted as an IMG
// widget. core/codegen.js mirrors needsTextBake()/bakeReason() to pick the
// widget, so the two sides must stay in step.
const TEXT_FILL_TYPES = [
  { value: 'solid', label: 'Solid' },
  { value: 'gradient', label: 'Linear gradient' },
  { value: 'css', label: 'CSS gradient' },
  { value: 'outline', label: 'Outline' },
];
function textFillType(e) { return e && TEXT_FILL_TYPES.some((t) => t.value === e.fillType) ? e.fillType : 'solid'; }
function needsTextBake(e) {
  return !!e && e.kind === 'TEXT'
    && (textFillType(e) !== 'solid' || !!e.bold || !!e.italic);
}
function bakeReason(e) {
  const why = [];
  const f = textFillType(e);
  if (f === 'gradient') why.push('gradient fill');
  else if (f === 'css') why.push('CSS gradient fill');
  else if (f === 'outline') why.push('outline fill');
  if (e.bold) why.push('bold');
  if (e.italic) why.push('italic');
  return why.join(' + ') || 'styled text';
}
// A Text layer is drawn live on the watch with the font file it ships, so a
// letter that file lacks cannot appear there (the designer can only compose
// missing letters into glyph images). '' when the font has every character.
function textMissingChars(e) {
  const fam = e && e.fontFile ? familyForFontFile(e.fontFile) : null;
  if (!fam) return '';
  const r = coverageReport(fam, e.text);
  return [...r.alternate, ...r.composed, ...r.system].join(' ');
}
// the watch has no fake-bold either: pick the heavy end of the family
function textWeight(e) { const w = +e.weight || 400; return e.bold ? Math.max(700, w) : w; }

// measured size of a Text layer as the canvas would draw it (used by the lint,
// because a baked image is clipped to the layer box while the preview is not)
let measureCanvas = null;
function textMetrics(e) {
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  const c = measureCanvas.getContext('2d');
  setFontOn(c, familyForFontFile(e.fontFile) || 'Inter', +e.size || 32, textWeight(e), e.variations);
  const lines = String(e.text == null ? '' : e.text).split('\n');
  const w = lines.reduce((m, l) => Math.max(m, c.measureText(l).width), 0);
  const h = lines.length * ((+e.size || 32) * 1.15 + (+e.lineSpace || 0));
  return { w, h };
}

function clamp01(v) { const n = +v; return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0; }

// Minimal CSS gradient parser → { type, angle, stops:[{color,pos}] } or null.
// Handles (repeating-)linear / radial / conic, `to top` or `90deg` directions,
// `NN%` stops, and any colour token the canvas accepts (#hex, names, rgb()).
function parseCssGradient(css) {
  const s = String(css || '').trim();
  const m = /^(-webkit-)?(repeating-)?(linear|radial|conic)-gradient\(([\s\S]*)\)$/i.exec(s);
  if (!m) return null;
  const type = m[3].toLowerCase();
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of m[4]) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  if (parts.length < 2) return null;
  const isDir = (t) => /^to\s/i.test(t) || /^-?[\d.]+(deg|grad|rad|turn)$/i.test(t);
  // `circle`, `ellipse`, `closest-far`, `… at 30% 40%` — radial/conic head tokens
  const isShape = (t) => /^(circle|ellipse)$/i.test(t) || /^(closest|farthest)-(side|corner)$/i.test(t) || /(^|\s)at(\s|$)/i.test(t);
  const toDeg = (t) => {
    const mm = /^(-?[\d.]+)(deg|grad|rad|turn)$/i.exec(t);
    if (mm) {
      const v = parseFloat(mm[1]), u = mm[2].toLowerCase();
      return u === 'turn' ? v * 360 : u === 'grad' ? v * 0.9 : u === 'rad' ? (v * 180) / Math.PI : v;
    }
    // `to right` / `to bottom right` — CSS angles start at "up", clockwise
    const words = t.replace(/^to\s+/i, '').split(/[\s-]+/).filter(Boolean);
    const dir = { top: 0, right: 90, bottom: 180, left: 270 };
    if (words.length === 1) return dir[words[0]] != null ? dir[words[0]] : 90;
    const a = dir[words[0]], b = dir[words[1]];
    if (a == null || b == null) return 90;
    let d = b - a;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return (a + d / 2 + 360) % 360;
  };
  let start = 0;
  let angle = 180;          // CSS default for linear-gradient: to bottom
  let center = null;        // `at …` position of a radial/conic gradient
  const readAt = (t) => { const m = /(?:^|\s)at\s+(.+)$/i.exec(t); if (m) center = m[1].trim(); };
  if (type === 'linear') {
    if (isDir(parts[0])) { angle = toDeg(parts[0]); start = 1; }
  } else if (type === 'radial') {
    if (isShape(parts[0]) || /^(circle|ellipse)?\s*(closest|farthest)/i.test(parts[0])) {
      readAt(parts[0]);
      start = 1;
    }
  } else if (type === 'conic') {
    const fm = /^from\s+(-?[\d.]+(?:deg|grad|rad|turn))/i.exec(parts[0] || '');
    if (fm || isShape(parts[0])) {
      if (fm) angle = toDeg(fm[1]);
      readAt(parts[0]);
      start = 1;
    }
  }
  const stops = [];
  for (let i = start; i < parts.length; i++) {
    const t = parts[i];
    if (!t) continue;
    const head = /^(-?[\d.]+%)(?:\s+([\s\S]+))?$/.exec(t);
    const tail = /(?:^|\s)(-?[\d.]+%)$/.exec(t);
    let color = null, pos = null;
    if (head) { pos = parseFloat(head[1]) / 100; color = (head[2] || '').trim(); }
    else if (tail) { pos = parseFloat(tail[1]) / 100; color = t.slice(0, tail.index).trim(); }
    else color = t;
    if (!color) continue;
    stops.push({ color, pos });
  }
  if (stops.length < 2) return null;
  return { type, angle, center, stops };
}
// `at 30% 40%`, `at 10px 20px`, `at left center` inside the element box
function cssPos(tok, base, size, axis) {
  const t = String(tok || '').trim().toLowerCase();
  if (/%$/.test(t)) return base + (parseFloat(t) / 100) * size;
  const px = /^(-?[\d.]+)px$/.exec(t);
  if (px) return base + parseFloat(px[1]);
  const start = axis === 'x' ? 'left' : 'top';
  const end = axis === 'x' ? 'right' : 'bottom';
  if (t === start) return base;
  if (t === end) return base + size;
  return base + size / 2;       // center / missing / unknown
}
function cssCenter(b, center) {
  if (!center) return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const [a, c] = String(center).split(/\s+/);
  return { x: cssPos(a, b.x, b.w, 'x'), y: cssPos(c, b.y, b.h, 'y') };
}
// CSS uses the "magic corners" rule for its gradient line; the preview and the
// bake just use half the box diagonal, which is visually the same at watch size.
function linearFill(c, b, cssAngle, stops) {
  const a = ((+cssAngle || 0) - 90) * Math.PI / 180;   // CSS: 0deg points up
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const r = Math.hypot(b.w, b.h) / 2 || 1;
  const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
  const g = c.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  for (const [color, pos] of stops) g.addColorStop(clamp01(pos), String(color || '#ffffff'));
  return g;
}
function radialFill(c, b, stops, center) {
  const ctr = cssCenter(b, center);
  const g = c.createRadialGradient(ctr.x, ctr.y, 0, ctr.x, ctr.y, Math.hypot(b.w, b.h) / 2 || 1);
  for (const [color, pos] of stops) g.addColorStop(clamp01(pos), String(color || '#ffffff'));
  return g;
}
function cssGradientFill(c, e, b) {
  const g = parseCssGradient(e.cssGradient);
  if (!g) return hexOrWhite(e.color);
  const stops = g.stops.map((s, i, a) => [s.color, s.pos == null ? (a.length > 1 ? i / (a.length - 1) : 0) : s.pos]);
  // conic has no canvas equivalent — drawn as a linear ramp, same stops
  return g.type === 'radial' ? radialFill(c, b, stops, g.center) : linearFill(c, b, g.angle, stops);
}
function textFillStyle(c, e, b) {
  const t = textFillType(e);
  if (t === 'gradient') return linearFill(c, b, +e.gradAngle || 0, [[e.color, 0], [e.color2 || e.color, 1]]);
  if (t === 'css') return cssGradientFill(c, e, b);
  return hexOrWhite(e.color);
}

// Shared glyph painter: used by the canvas preview *and* by the PNG bake, so
// what you see in the editor is exactly what lands in the .zab.
function drawTextInto(c, e, b, fam, box) {
  const size = +e.size || 32;
  c.save();
  setFontOn(c, fam, size, textWeight(e), e.variations);
  if (e.italic) { try { c.font = `oblique 11deg ${c.font}`; } catch (err) { /* unsupported */ } }
  const outline = textFillType(e) === 'outline';
  c.fillStyle = outline ? hexOrWhite(e.color) : textFillStyle(c, e, b);
  const va = e.alignV || 'CENTER_V';
  c.textBaseline = va === 'TOP' ? 'top' : va === 'BOTTOM' ? 'bottom' : 'middle';
  const lines = String(e.text == null ? '' : e.text).split('\n');
  const lh = size * 1.15 + (+e.lineSpace || 0);
  const totalH = lines.length * lh;
  const y0 = va === 'TOP' ? b.y : va === 'BOTTOM' ? b.y + b.h - totalH + lh : b.y + (b.h - totalH) / 2 + lh / 2;
  const run = (fn) => {
    let y = y0;
    for (const line of lines) {
      c.textAlign = 'left';
      fn(line, alignTextX(c, line, e, box), y);
      y += lh;
    }
  };
  if (outline) {
    c.lineJoin = 'round';
    c.miterLimit = 2;
    c.lineWidth = Math.max(1, +e.outlineWidth || 2);
    c.strokeStyle = hexOrWhite(e.outlineColor);
    run((t, x, y) => c.strokeText(t, x, y));
  }
  run((t, x, y) => c.fillText(t, x, y));
  c.restore();
}

// ---------------------------------------------------------------- text bake --
const bakeCache = new Map();      // image name -> base64, survives style edits
function textStyleKey(e) {
  return JSON.stringify([
    String(e.text == null ? '' : e.text), +e.size || 32, e.color, e.color2, e.gradAngle,
    e.cssGradient, e.outlineColor, e.outlineWidth, textFillType(e), !!e.bold, !!e.italic,
    e.fontFile || '', textWeight(e), e.variations || '', e.alignH, e.alignV,
    e.lineSpace, e.charSpace, Math.round(+e.w || 200), Math.round(+e.h || 40),
    e.alpha != null && +e.alpha < 255 ? +e.alpha : 255,
  ]);
}
function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
// deterministic name (`text_<layer>_<stylehash>.png`) so two exports of the
// same project produce the same assets
function bakedTextName(e) { return `text_${e.id}_${hashString(textStyleKey(e))}.png`; }

function bakeText(e) {
  const w = Math.max(1, Math.round(+e.w || 200));
  const h = Math.max(1, Math.round(+e.h || 40));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  if (e.alpha != null && +e.alpha < 255) c.globalAlpha = Math.max(0, +e.alpha) / 255;
  drawTextInto(c, e, { x: 0, y: 0, w, h }, familyForFontFile(e.fontFile) || 'Inter', { x: 0, w });
  const dataBase64 = cv.toDataURL('image/png').split(',')[1] || '';
  return { name: bakedTextName(e), dataBase64 };
}

// Refresh every styled Text layer's bitmap and hand the export a payload of
// them. The PNGs are *not* part of the project file (they are re-derived on
// demand and cached by style hash); `e.bakedImage` is what codegen reads.
async function bakedTextImages() {
  const out = [];
  for (const e of elements()) {
    if (!needsTextBake(e)) {
      if (e.bakedImage) { delete e.bakedImage; delete e.bakedKey; }
      continue;
    }
    if (e.visible === false) continue;   // codegen skips hidden layers too
    const key = textStyleKey(e);
    if (e.bakedKey === key && e.bakedImage && bakeCache.has(e.bakedImage)) {
      out.push({ name: e.bakedImage, dataBase64: bakeCache.get(e.bakedImage) });
      continue;
    }
    const fam = familyForFontFile(e.fontFile) || 'Inter';
    if (!fontCache.has(fam)) await ensureFont(fam, textWeight(e));
    const img = bakeText(e);
    if (!img.dataBase64) continue;
    bakeCache.set(img.name, img.dataBase64);
    e.bakedImage = img.name;
    e.bakedKey = key;
    out.push(img);
  }
  return out;
}
function clearBakeCache() { bakeCache.clear(); }
// the baked bitmaps are regenerated on demand, so they never travel in .wfproj.json
function stripBakeKeys(e) { const { bakedImage, bakedKey, ...rest } = e; return rest; }

function alignTextX(c, text, e, box) {
  const a = e.alignH || 'CENTER_H';
  const b = box || { x: +e.x, w: +e.w || 200 };
  if (a === 'LEFT') return b.x;
  const w = c.measureText(text).width;
  if (a === 'RIGHT') return b.x + b.w - w;
  return b.x + (b.w - w) / 2;
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
      putRot(c, e.src, b.x, b.y, b.w, b.h, ang, devNum(e.centerX), devNum(e.centerY));
      break;
    }
    case 'IMG_TIME':
    case 'IMG_DATE':
    case 'TEXT_IMG': {
      const b = digitBox(e);
      drawDigits(c, e, digitRunX(e, b), b.y, digitTextFor(e));
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
      drawTextInto(c, e, b, fam);
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
    if (primary && (e.kind === 'TIME_POINTER' || e.kind === 'IMG_POINTER')) {
      c.fillStyle = '#ff78dc';
      c.beginPath();
      c.arc(+e.centerX || 0, +e.centerY || 0, 4, 0, Math.PI * 2);
      c.fill();
    }
    // a digit widget: the value sits *inside* the part's box, so show both — the
    // dashed outline is where the glyphs are, the dot is the box origin (the X
    // the export sends as startX)
    if (primary && (e.kind === 'IMG_TIME' || e.kind === 'IMG_DATE' || e.kind === 'TEXT_IMG')) {
      const db = digitBox(e);
      const rx = digitRunX(e, db);
      const ay = db.y + db.h / 2;
      c.save();
      c.strokeStyle = 'rgba(255,120,220,0.75)';
      c.lineWidth = 1;
      c.setLineDash([3, 2]);
      c.strokeRect(rx + 0.5, db.y + 0.5, Math.max(db.run - 1, 1), Math.max(db.h - 1, 1));
      c.setLineDash([]);
      c.beginPath();
      c.moveTo(db.x - 7, ay); c.lineTo(db.x + 7, ay);
      c.stroke();
      c.fillStyle = '#ff78dc';
      c.beginPath();
      c.arc(db.x, ay, 3, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    c.restore();
  }
  // A group (or any multi-selection) gets one box around the whole selection,
  // plus a faint outline per member: this is the box that Align to box and the
  // drag snapping use, so it has to be visible.
  if (sel.length > 1) {
    const gb = selBox(sel);
    c.save();
    c.setLineDash([3, 3]);
    c.strokeStyle = 'rgba(91,140,255,0.45)';
    c.lineWidth = 1;
    for (const e of sel) {
      const eb = elBox(e);
      c.strokeRect(eb.x + 0.5, eb.y + 0.5, Math.max(eb.w - 1, 1), Math.max(eb.h - 1, 1));
    }
    c.setLineDash([]);
    c.strokeStyle = '#5b8cff';
    c.lineWidth = 2;
    c.strokeRect(gb.x + 1, gb.y + 1, Math.max(gb.w - 2, 2), Math.max(gb.h - 2, 2));
    // size label, kept inside the canvas whichever edge the box is on
    const label = `${sel.length} layers · ${Math.round(gb.w)}×${Math.round(gb.h)}`;
    c.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
    const tw = c.measureText(label).width;
    const lx = Math.min(Math.max(gb.x, 4), Math.max(4, W - tw - 12));
    const above = gb.y - 16 >= 0;
    const ly = above ? gb.y - 6 : Math.min(H - 4, gb.y + gb.h + 15);
    c.fillStyle = 'rgba(13,15,20,0.85)';
    c.fillRect(lx - 4, ly - 11, tw + 8, 15);
    c.strokeStyle = 'rgba(91,140,255,0.55)';
    c.lineWidth = 1;
    c.strokeRect(lx - 4.5, ly - 11.5, tw + 9, 16);
    c.fillStyle = '#cdd9ff';
    c.fillText(label, lx, ly);
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
  updateTitle();
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
  // the store preview and app icon always read 10:09:36 (the design spec's
  // reference time), whatever the live clock in the editor shows
  const keep = { clock, dateParts };
  clock = { ...REF_CLOCK }; dateParts = { ...REF_DATE };
  exportRender = true;
  try { drawScene(cv.getContext('2d'), d.w, d.h, 'normal', false); }
  finally { exportRender = prev; clock = keep.clock; dateParts = keep.dateParts; }
  return cv.toDataURL('image/png').split(',')[1];
}

// ----------------------------------------------------------------- layers --
function groupName(gid) { return (project.groups && project.groups[gid]) || `Group ${String(gid).replace(/^g/, '')}`; }
// Rename a group: the name is a designer label (groups are a designer concept —
// the watch sees the layers, not the grouping), so it is only stored in the
// project file.
function renameGroup(gid, name) {
  if (!project || !gid) return;
  pushHistory();
  project.groups = project.groups || {};
  const n = String(name == null ? '' : name).trim();
  if (n) project.groups[gid] = n; else delete project.groups[gid];
  refreshPanels(); render(); scheduleCode();
}
// the group every selected layer belongs to, when the whole selection is one
function commonGroup(sel) {
  const g = sel.length > 1 && sel[0] ? sel[0].group : null;
  return g && sel.every((e) => e.group === g) ? g : null;
}
// inline rename in the layers panel (double-click the group name)
function startGroupRename(gid, span) {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'gname-edit';
  inp.value = groupName(gid);
  span.replaceWith(inp);
  inp.focus();
  inp.select();
  let closed = false;
  const done = (save) => {
    if (closed) return;
    closed = true;
    const v = inp.value;
    if (inp.parentNode) inp.replaceWith(span);
    if (save && v.trim() !== groupName(gid)) renameGroup(gid, v);
  };
  inp.onkeydown = (ev) => {
    ev.stopPropagation();
    if (ev.key === 'Enter') done(true);
    else if (ev.key === 'Escape') done(false);
  };
  inp.onblur = () => done(true);
  inp.onclick = (ev) => ev.stopPropagation();
  inp.ondblclick = (ev) => ev.stopPropagation();
}
// the same rename, as a Properties row (a whole group is selected)
function groupNameInput(gid) {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = groupName(gid);
  inp.placeholder = 'Group name';
  inp.onchange = () => renameGroup(gid, inp.value);
  inp.onkeydown = (ev) => { if (ev.key === 'Enter') inp.blur(); else if (ev.key === 'Escape') { inp.value = groupName(gid); inp.blur(); } };
  return inp;
}
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
  dup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="8.5" y="8.5" width="12" height="12" rx="2.6"/><path d="M15.5 5.4A2.6 2.6 0 0 0 12.9 3H5.6A2.6 2.6 0 0 0 3 5.6v7.3A2.6 2.6 0 0 0 5.4 15.5"/></svg>',
  group: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="2.5" width="19" height="19" rx="3.2" stroke-dasharray="3.4 2.6"/><rect x="6" y="6" width="7" height="7" rx="1.7" fill="currentColor" stroke="none"/><rect x="11.5" y="11.5" width="7" height="7" rx="1.7" fill="currentColor" stroke="none"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M4 20h16"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  toFront: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14"/><path d="M12 20V9m0 0-4 4m4-4 4 4"/></svg>',
  forward: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V6m0 0-5 5m5-5 5 5"/></svg>',
  backward: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v13m0 0-5-5m5 5 5-5"/></svg>',
  toBack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20h14"/><path d="M12 4v11m0 0-4-4m4 4 4-4"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  ungroup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2.5 8.5V5.7A3.2 3.2 0 0 1 5.7 2.5h2.8M15.5 2.5h2.8a3.2 3.2 0 0 1 3.2 3.2v2.8M21.5 15.5v2.8a3.2 3.2 0 0 1-3.2 3.2h-2.8M8.5 21.5H5.7a3.2 3.2 0 0 1-3.2-3.2v-2.8"/><rect x="5.5" y="5.5" width="6.5" height="6.5" rx="1.7" fill="currentColor" stroke="none"/><rect x="13.5" y="13.5" width="5.5" height="5.5" rx="1.6" fill="currentColor" stroke="none"/></svg>',
};
function kindIcon(kind) {
  const k = kindById(kind);
  const g = k ? k.group : 'Image';
  return g === 'Time' || g === 'Clock' ? ICON.clock : g === 'Data' ? ICON.data : g === 'Shape' ? ICON.shape : g === 'Text' ? ICON.text : ICON.img;
}
function aodBadge(e) {
  if (e.show === 'aod') return 'AOD';
  if (e.show === 'both') return 'BOTH';
  if (e.show === 'edit') return 'EDIT';
  return null;
}
function layerLabel(e) {
  return e.name || (kindById(e.kind) ? kindById(e.kind).label : e.kind);
}
// dimmed in the layers list: the focused view (Normal / AOD) doesn't draw it
const offView = (e) => layerFocus && !showAllowed(e.show, previewMode);
function layerRow(e) {
  const row = document.createElement('div');
  row.className = 'layer' + (e.id === selectedId ? ' sel' : '') + (multiSel.has(e.id) && e.id !== selectedId ? ' multi' : '')
    + (e.visible === false ? ' hid' : '') + (e.locked ? ' locked' : '') + (offView(e) ? ' offview' : '');
  row.dataset.id = e.id;
  if (offView(e)) row.title = `Not drawn in ${previewMode === 'aod' ? 'AOD' : 'the normal face'} — switch the filter to All to edit it`;
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
  if (badge) { const b = document.createElement('span'); b.className = 'grp ' + badge.toLowerCase(); b.textContent = badge; b.title = 'Shown in: ' + badge.toLowerCase(); left.appendChild(b); }
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
    if (offView(e)) return;   // not part of this view: disabled until the filter is All
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
      if (multiSel.has(e.id)) multiSel.delete(e.id); else multiSel.add(e.id);
      selectedId = e.id;
    } else { selectedId = e.id; multiSel = new Set([e.id]); }
    refreshPanels(); render();
  };
  return row;
}
// A group in the Layers panel: a header that selects the whole group (and
// drags it as one unit), with its own show / lock switches acting on every
// member, and an indented body holding the members.
function groupBlock(gid, members) {
  const collapsed = groupCollapsed.has(gid);
  const allSel = members.length > 0 && members.every((m) => multiSel.has(m.id));
  const someSel = !allSel && members.some((m) => multiSel.has(m.id));
  const allHidden = members.every((m) => m.visible === false);
  const allLocked = members.every((m) => m.locked);
  const wrap = mkEl('div', 'group-block' + (collapsed ? ' collapsed' : '') + (allSel ? ' sel' : ''));
  const head = mkEl('div', 'group-row' + (collapsed ? ' collapsed' : '') + (allSel ? ' sel' : someSel ? ' part' : '')
    + (allHidden ? ' hid' : '') + (members.every(offView) ? ' offview' : ''));
  const grip = mkEl('span', 'grip'); grip.innerHTML = ICON.grip;
  grip.title = 'Drag to move the whole group';
  const chev = mkEl('button', 'gchev'); chev.type = 'button'; chev.innerHTML = ICON.chevron;
  chev.title = collapsed ? 'Expand' : 'Collapse';
  chev.onclick = (ev) => {
    ev.stopPropagation();
    if (groupCollapsed.has(gid)) groupCollapsed.delete(gid); else groupCollapsed.add(gid);
    refreshPanels();
  };
  const icon = mkEl('span', 'gicon'); icon.innerHTML = ICON.folder;
  const nm = mkEl('span', 'gname', groupName(gid));
  nm.title = 'Double-click to rename this group';
  nm.ondblclick = (ev) => { ev.stopPropagation(); startGroupRename(gid, nm); };
  const cnt = mkEl('span', 'gcount', String(members.length));
  cnt.title = `${members.length} layer${members.length === 1 ? '' : 's'}`;
  const right = mkEl('span', 'lrow-r');
  const btn = (cls, html, title, fn) => {
    const b = mkEl('button', 'lb ' + cls); b.type = 'button'; b.innerHTML = html; b.title = title;
    b.onclick = (ev) => { ev.stopPropagation(); fn(); };
    return b;
  };
  right.appendChild(btn('vis', allHidden ? ICON.eyeOff : ICON.eye, allHidden ? 'Show the group' : 'Hide the group', () => {
    pushHistory(); for (const m of members) m.visible = allHidden; refreshPanels(); render(); scheduleCode();
  }));
  right.appendChild(btn('lock' + (allLocked ? ' on' : ''), allLocked ? ICON.lock : ICON.unlock, allLocked ? 'Unlock the group' : 'Lock the group', () => {
    pushHistory(); for (const m of members) m.locked = !allLocked; refreshPanels(); render();
  }));
  head.appendChild(grip); head.appendChild(chev); head.appendChild(icon); head.appendChild(nm); head.appendChild(cnt); head.appendChild(right);
  head.onclick = () => {
    const live = members.filter((m) => !offView(m));
    if (!live.length) return;
    selectedId = live[0].id;
    multiSel = new Set(live.map((m) => m.id));
    refreshPanels(); render();
  };
  const body = mkEl('div', 'group-body');
  body.dataset.gid = gid;
  for (const m of members) body.appendChild(layerRow(m));
  wrap.appendChild(head); wrap.appendChild(body);
  return wrap;
}
// Rows drag from anywhere (the buttons excepted). A group block drags as one
// unit in the top-level list; a group body takes layers but never another
// group, so groups stay one level deep.
function makeSortable(container, { root = false } = {}) {
  if (typeof Sortable === 'undefined') return;
  Sortable.create(container, {
    group: root ? { name: 'wf-layers' } : { name: 'wf-layers', put: (_to, _from, dragEl) => !dragEl.classList.contains('group-block') },
    draggable: root ? '.layer, .group-block' : '.layer',
    filter: '.lb, .gchev, .gname-edit, input, .offview', preventOnFilter: false,
    animation: 120, fallbackTolerance: 4,
    ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen', fallbackClass: 'sortable-fallback',
    fallbackOnBody: true,
    onEnd: applyLayerOrder,
  });
}
// The panel lists layers top (front) to bottom (back); read it back in exactly
// that order — a group block contributes its members where it sits — and
// store the reverse as the paint order.
function applyLayerOrder() {
  const rootList = document.querySelector('#layers .layers-list');
  if (!rootList || !project) return;
  const order = [];
  const usedGroups = new Set();
  const take = (row, gid) => {
    const e = elementById(row.dataset.id);
    if (!e) return;
    e.group = gid;
    order.push(e);
  };
  for (const child of rootList.children) {
    if (child.classList.contains('layer')) take(child, null);
    else if (child.classList.contains('group-block')) {
      const body = child.querySelector('.group-body');
      const gid = body && body.dataset.gid;
      if (!gid) continue;
      body.querySelectorAll(':scope > .layer').forEach((row) => { take(row, gid); usedGroups.add(gid); });
    }
  }
  if (order.length !== elements().length) { refreshPanels(); return; }   // never lose a layer to a stray drop
  const before = snapshot();
  for (const gid of Object.keys(project.groups || {})) {
    if (!usedGroups.has(gid)) delete project.groups[gid];
  }
  project.elements = order.reverse();
  commitHistory(before);
  refreshPanels(); render(); scheduleCode();
}
// Paint order as the panel shows it: top-level units (a layer, or a whole
// group) from front to back, a group's members in their own order.
function layerUnits() {
  const units = [];
  const byGroup = new Map();
  for (const e of [...elements()].reverse()) {
    if (e.group) {
      if (!byGroup.has(e.group)) { const u = { gid: e.group, members: [] }; byGroup.set(e.group, u); units.push(u); }
      byGroup.get(e.group).members.push(e);
    } else units.push({ el: e });
  }
  return units;
}
function unitsToElements(units) {
  const front = [];
  for (const u of units) front.push(...(u.members || [u.el]));
  return front.reverse();
}
// move the marked items of a front-to-back list: front / back / forward / backward
function moveMarked(list, marked, how) {
  const on = list.map((x) => marked(x));
  if (how === 'front') return [...list.filter((_, i) => on[i]), ...list.filter((_, i) => !on[i])];
  if (how === 'back') return [...list.filter((_, i) => !on[i]), ...list.filter((_, i) => on[i])];
  const out = list.slice(), flags = on.slice();
  if (how === 'forward') {
    for (let i = 1; i < out.length; i++) {
      if (flags[i] && !flags[i - 1]) { [out[i - 1], out[i]] = [out[i], out[i - 1]]; [flags[i - 1], flags[i]] = [flags[i], flags[i - 1]]; }
    }
  } else {
    for (let i = out.length - 2; i >= 0; i--) {
      if (flags[i] && !flags[i + 1]) { [out[i + 1], out[i]] = [out[i], out[i + 1]]; [flags[i + 1], flags[i]] = [flags[i], flags[i + 1]]; }
    }
  }
  return out;
}
// Bring forward / send backward / to front / to back. Part of one group moves
// inside that group; anything else moves whole units (a selected member takes
// its group along), so the panel and the paint order never disagree.
function reorderSelection(how) {
  const sel = selection();
  if (!project || !sel.length) return;
  const ids = new Set(sel.map((e) => e.id));
  const before = snapshot();
  const units = layerUnits();
  const gid = sel[0].group;
  const unit = gid ? units.find((u) => u.gid === gid) : null;
  if (unit && sel.every((e) => e.group === gid) && sel.length < unit.members.length) {
    unit.members = moveMarked(unit.members, (e) => ids.has(e.id), how);
    project.elements = unitsToElements(units);
  } else {
    const hit = (u) => (u.members ? u.members.some((e) => ids.has(e.id)) : ids.has(u.el.id));
    project.elements = unitsToElements(moveMarked(units, hit, how));
  }
  if (!commitHistory(before)) {
    status(`Already at the ${how === 'front' || how === 'forward' ? 'front' : 'back'}.`);
    return;
  }
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
  makeSortable(rootList, { root: true });
  host.querySelectorAll('.group-body').forEach((b) => makeSortable(b));
}

// ------------------------------------------------------------ number fields --
// Number fields work the way design tools do:
//   wheel        over a focused field steps it (Shift ×10) instead of scrolling
//   ↑ / ↓        step it, Shift ×10
//   drag label   scrub: drag a row's label — or the X / Y / W / H prefix — left
//                or right, 1 unit per pixel (Shift ×10); a click still focuses
// A whole drag or wheel burst is one undo step (holdHistory / releaseHistory).
const NUM_SCOPE = '#props, #fontModal';
function scopedNumber(el) {
  return el && el.matches && el.matches('input[type="number"]') && el.closest(NUM_SCOPE) ? el : null;
}
function setNumber(inp, v) {
  const step = +inp.step || 1;
  if (inp.min !== '') v = Math.max(+inp.min, v);
  if (inp.max !== '') v = Math.min(+inp.max, v);
  v = +(Math.round(v / step) * step).toFixed(4);
  if (String(v) === inp.value) return;
  inp.value = String(v);
  inp.dispatchEvent(new Event('input', { bubbles: true }));
}
function stepNumber(inp, steps) { setNumber(inp, (+inp.value || 0) + steps * (+inp.step || 1)); }
let wheelTimer = null;
document.addEventListener('wheel', (ev) => {
  const inp = scopedNumber(ev.target);
  if (!inp || document.activeElement !== inp) return;   // unfocused: the panel scrolls
  ev.preventDefault();                                   // also stops the native step
  const d = ev.deltaY || ev.deltaX;                      // Shift+wheel turns into deltaX on macOS
  if (!d) return;
  holdHistory();
  stepNumber(inp, (d < 0 ? 1 : -1) * (ev.shiftKey ? 10 : 1));
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(releaseHistory, 500);
}, { passive: false });
document.addEventListener('keydown', (ev) => {
  const inp = scopedNumber(ev.target);
  if (!inp || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') || ev.metaKey || ev.ctrlKey) return;
  ev.preventDefault();
  stepNumber(inp, (ev.key === 'ArrowUp' ? 1 : -1) * (ev.shiftKey ? 10 : 1));
});
// the number field a label scrubs: a prefix's own field, or the only one in its row
function scrubTarget(lbl) {
  if (lbl.classList.contains('pfx')) return lbl.parentElement.querySelector('input[type="number"]');
  const all = lbl.parentElement.querySelectorAll('input[type="number"]');
  return all.length === 1 ? all[0] : null;
}
document.addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0 || !ev.target.closest) return;
  if (ev.target.closest('.info')) return;
  const lbl = ev.target.closest('#props .pfx, #props .row > .lbl, #fontModal .row > .lbl');
  const inp = lbl && scrubTarget(lbl);
  if (!inp) return;
  ev.preventDefault();
  const start = +inp.value || 0, x0 = ev.clientX;
  let moved = false;
  try { lbl.setPointerCapture(ev.pointerId); } catch (e) { /* the window listeners still follow */ }
  const move = (e) => {
    const dx = e.clientX - x0;
    if (!moved && Math.abs(dx) < 3) return;
    if (!moved) { moved = true; holdHistory(); document.body.classList.add('scrubbing'); }
    setNumber(inp, start + Math.round(dx) * (e.shiftKey ? 10 : 1) * (+inp.step || 1));
  };
  const end = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    document.body.classList.remove('scrubbing');
    if (moved) { releaseHistory(); refreshPanels(); }
    else { inp.focus(); inp.select(); }
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
});

// ----------------------------------------------------------------- properties --
// What each property does, shown by the ⓘ next to its label. Keyed by
// "<KIND>:<label>" for a kind-specific meaning, else by the label alone; a row
// built with an explicit title uses that instead.
const PROP_HELP = {
  'Name': 'The layer’s name in the designer and in the generated code comments. The watch never shows it.',
  'Show in': 'Which face variant draws this layer: Normal (screen on), AOD (always-on display, screen off), Both, or Edit (only while the wearer customises the face). Applies to every selected layer. Shortcuts: Shift+N / Shift+A / Shift+B.',
  'Alpha': 'Opacity from 0 (invisible) to 255 (solid).',
  'Position': 'Top-left corner of the layer, in screen pixels from the top-left of the display. Drag the X / Y letters to scrub; the wheel steps a focused field (Shift ×10).',
  'Box': 'Width and height of the layer box, in pixels.',
  'IMG:Box': 'Size of the widget area. The watch draws the picture at its own pixel size — this does not stretch it. “Use image size” matches the two.',
  'Center': 'Centre point on the screen, in pixels.',
  'TIME_POINTER:Center': 'The point every hand turns around — normally the middle of the screen.',
  'IMG_POINTER:Center': 'Where the needle’s pivot sits on the screen.',
  'Pivot': 'The rotation centre inside the pointer image (from its top-left corner) — the point that sits on Center.',
  'Pivot X': 'Rotation centre inside the hand image, from its left edge. Usually half the image width.',
  'Pivot Y': 'Rotation centre inside the hand image, from its top edge. Usually near the bottom of the hand.',
  'Radius': 'Radius of the circle / arc in pixels — also draggable with the dot on the canvas.',
  'Helpers': 'Quick layout actions for this layer.',
  'Angle': 'Rotation in degrees, clockwise. 0 points at 12 o’clock.',
  'Pos X': 'Horizontal offset of the picture inside the widget box.',
  'Pos Y': 'Vertical offset of the picture inside the widget box.',
  'Image': 'The PNG this layer draws. Click to pick from the project with previews, or upload a new one.',
  'Pointer': 'The needle image, drawn pointing at 12 o’clock.',
  'Data': 'The sensor reading that drives this widget on the watch. The canvas previews it with the value from Test data.',
  'Level': 'A fixed value from 0 to 100, used when no data is bound.',
  'Spread': 'Horizontal distance between the progress images, in pixels.',
  'Part': 'Which part of the time this layer shows. A clock is usually an hour layer, a colon image and a minute layer.',
  'Leading 0': 'Draw 09 instead of 9.',
  'Space': 'Extra gap between digits, in pixels (negative tightens).',
  'Spacing': 'Extra gap between digits, in pixels.',
  'Align': 'Where the value sits inside its fixed-width box: left, centred or right. The box stays put while the value grows or shrinks.',
  'Follow': 'Draw this value right after the previous part (hour → minute, month → day), using its spacing and alignment.',
  'Unit': 'An image drawn right after the value — °, %, km, bpm.',
  'Decimal': 'The image used for the decimal point (distance: 5.30).',
  'Negative': 'The image used for the minus sign (temperature below zero).',
  'AM': 'Image shown before noon in the 12-hour form.',
  'PM': 'Image shown after noon in the 12-hour form.',
  'Character': 'Show the month as a name (JAN, IANUARIE) instead of digits.',
  'Text': 'The text to draw. Use a new line for several lines.',
  'Size': 'The height the glyphs are drawn at, in pixels.',
  'TEXT:Size': 'Font size in pixels.',
  'Fill': 'How the glyphs are painted: a flat colour, a 2-colour gradient, a CSS gradient or a hollow outline.',
  'Color': 'Fill colour.',
  'Outline': 'Colour of the outline ring.',
  'Outline width': 'Thickness of the outline in pixels.',
  'From': 'Gradient start colour.',
  'To': 'Gradient end colour.',
  'Angle°': 'Gradient direction in CSS degrees: 0 = up, 90 = right, 180 = down.',
  'Gradient': 'A CSS gradient, e.g. linear-gradient(180deg, #ffd400, #ff2d55).',
  'Bold': 'Thicker glyphs. The watch has no bold, so a bold layer is shipped as an image.',
  'Italic': 'Slanted glyphs. Shipped as an image, like bold.',
  'Font': 'The typeface. “composes” = letters the font lacks are built from its own glyphs; “lacks” = a system font would fill in.',
  'Weight': 'Font weight. Only fonts with several weights change; otherwise use Bold.',
  'Align H': 'Horizontal alignment of the text inside its box.',
  'Align V': 'Vertical alignment of the text inside its box.',
  'Line space': 'Extra space between lines, in pixels.',
  'Char space': 'Extra space between characters, in pixels.',
  'Status': 'The system state that shows this icon (Bluetooth disconnected, do-not-disturb, alarm, lock).',
  'Action': 'The app the watch opens when this area is tapped.',
  'Icon': 'The image shown for this widget.',
  'Line width': 'Stroke thickness in pixels.',
  'Start': 'Start angle in degrees (0 = 12 o’clock, clockwise).',
  'End': 'End angle in degrees. The value fills from Start towards End.',
  'Background': 'An image drawn behind the arc — the empty track.',
  'Cover': 'An image drawn on top of the hands’ pivot (the centre cap).',
  'FPS': 'Frames per second.',
  'Repeat': 'How many times the animation plays; 0 loops forever.',
  'Step': 'Advance this many frames per tick (2 = every other frame).',
  'Symbol': 'Type a character (°, :, ♥, A) and the image is drawn from the font below instead of picked.',
  'Redraw': 'Rasterise the images again with the style above (it also happens by itself a moment after a change).',
  'Names': 'The wording of the names: short (MON), full (MONDAY) or narrow (M).',
  'Case': 'UPPERCASE, the language’s own casing, Capitalize or lowercase.',
  'Language': 'The language the names are written in, as a tag like ro-RO or de-DE. Empty uses the project language.',
  'Label align': 'Every name sits in one cell as wide as the longest; this places each name inside it, so the label never jumps.',
  'Group name': 'A designer label for the group. The watch never sees groups.',
};
let propsHelpKind = null;      // the kind whose Properties are being built
function helpFor(label) {
  return PROP_HELP[`${propsHelpKind}:${label}`] || PROP_HELP[label] || '';
}
function mkRow(lbl, title) {
  const r = document.createElement('div');
  r.className = 'row';
  const s = document.createElement('span');
  s.className = 'lbl'; s.textContent = lbl;
  const help = title || helpFor(lbl);
  if (help) {
    // the ⓘ is drawn by CSS, so the label's text stays just the label
    const i = document.createElement('span');
    i.className = 'info';
    i.dataset.help = help;
    i.setAttribute('aria-label', help);
    s.appendChild(i);
  }
  r.appendChild(s);
  return r;
}
// One tooltip for every ⓘ: shown on hover, kept inside the window.
{
  const tip = document.createElement('div');
  tip.className = 'help-tip';
  tip.hidden = true;
  document.body.appendChild(tip);
  document.addEventListener('mouseover', (ev) => {
    const i = ev.target.closest && ev.target.closest('.info');
    if (!i) return;
    tip.textContent = i.dataset.help;
    tip.hidden = false;
    const r = i.getBoundingClientRect();
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const left = Math.max(8, Math.min(r.left - 10, window.innerWidth - w - 8));
    const top = r.bottom + 6 + h > window.innerHeight - 8 ? r.top - h - 6 : r.bottom + 6;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  });
  document.addEventListener('mouseout', (ev) => {
    if (ev.target.closest && ev.target.closest('.info')) tip.hidden = true;
  });
}
// Rows about the layer as a whole (Show in, Alpha) write to every selected
// layer — the primary first, so the panel still shows that layer's values.
function commonTargets(e) {
  const sel = selection();
  return sel.length > 1 ? [e, ...sel.filter((x) => x.id !== e.id)] : [e];
}
// Multi-layer editing: when several layers (or a whole group) are selected the
// style controls write to every one of them, not just to the primary layer.
function asList(obj) { return Array.isArray(obj) ? obj : [obj]; }
function targetsFor(e, kinds) {
  const sel = selection();
  if (sel.length <= 1) return [e];
  const pool = kinds ? sel.filter((x) => kinds.has(x.kind)) : sel;
  return pool.length ? pool : [e];
}
// same idea for predicates the kind alone cannot answer (a glyph layer is one
// whose images come from the design's glyph pipeline)
function targetsWhere(e, pred) {
  const sel = selection();
  if (sel.length <= 1) return [e];
  const pool = sel.filter(pred);
  return pool.length ? pool : [e];
}
function setOn(targets, key, value) { for (const t of targets) t[key] = value; }

function ctlNum(obj, key, { min, max, step = 1 } = {}) {
  const targets = asList(obj);
  const first = targets[0] || {};
  const inp = document.createElement('input');
  inp.type = 'number'; inp.step = step;
  if (min != null) inp.min = min;
  if (max != null) inp.max = max;
  inp.value = Number.isFinite(+first[key]) ? +first[key] : 0;
  inp.oninput = () => { pushHistory(); setOn(targets, key, +inp.value || 0); render(); scheduleCode(); };
  return inp;
}
function ctlText(obj, key, placeholder) {
  const targets = asList(obj);
  const first = targets[0] || {};
  const inp = document.createElement('input');
  inp.type = 'text'; inp.value = first[key] == null ? '' : first[key];
  if (placeholder) inp.placeholder = placeholder;
  // refreshPanels() rebuilds this field, so carry the focus and caret across
  inp.dataset.keepFocus = `text:${key}`;
  inp.oninput = () => { pushHistory(); setOn(targets, key, inp.value); withFocusKept(() => refreshPanels()); render(); scheduleCode(); };
  return inp;
}
function ctlColor(obj, key) {
  const targets = asList(obj);
  const first = targets[0] || {};
  const inp = document.createElement('input');
  inp.type = 'color'; inp.value = first[key] || '#ffffff';
  inp.oninput = () => { pushHistory(); setOn(targets, key, inp.value); render(); scheduleCode(); };
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
  const targets = asList(obj);
  const first = targets[0] || {};
  const inp = document.createElement('input');
  inp.type = 'checkbox'; inp.checked = !!first[key];
  if (title) inp.title = title;
  inp.onchange = () => { pushHistory(); setOn(targets, key, inp.checked); render(); scheduleCode(); };
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
// ------------------------------------------------------------ image fields --
// One image control for every picture a layer points at (an Image's src, a
// unit, AM/PM, hands, icons …): a thumbnail on a checkerboard, the file name
// and size, and Choose / Upload / Clear. Choosing opens a grid of the
// project's images with previews instead of a bare list of file names.
function mkEl(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
const IMAGE_KEYS = ['src', 'unit', 'dot', 'negative', 'hour', 'minute', 'second', 'cover', 'bg', 'am', 'pm'];
function imageUseCount(name) {
  if (!name) return 0;
  return elements().filter((x) => IMAGE_KEYS.some((k) => x[k] === name)
    || ['images', 'frames'].some((k) => (x[k] || []).includes(name))).length;
}
function thumbEl(name, cls = 'thumb') {
  const t = mkEl('span', cls);
  const meta = name ? imgMeta(name) : null;
  if (meta) { const im = document.createElement('img'); im.src = meta.url; im.alt = name; t.appendChild(im); }
  else t.classList.add(name ? 'missing' : 'none');
  return t;
}
function imageField(obj, key, { onChange } = {}) {
  const name = obj[key] || '';
  const meta = name ? imgMeta(name) : null;
  const wrap = mkEl('div', 'imgfield' + (!name ? ' empty' : meta ? '' : ' missing'));
  const set = (v) => {
    if ((obj[key] || '') === v) return;
    pushHistory();
    obj[key] = v;
    if (onChange) onChange(v);
    refreshPanels(); render(); scheduleCode();
  };
  const pick = mkEl('button', 'if-pick');
  pick.type = 'button';
  pick.title = name ? `${name} — click to choose another image` : 'Choose a project image';
  pick.appendChild(thumbEl(name, 'if-thumb'));
  const txt = mkEl('span', 'if-text');
  txt.appendChild(mkEl('span', 'if-name', name || 'None'));
  const uses = imageUseCount(name);
  txt.appendChild(mkEl('span', 'if-sub', meta
    ? `${meta.width}×${meta.height}${uses > 1 ? ` · ${uses} layers` : ''}`
    : name ? 'not in the project' : 'choose…'));
  pick.appendChild(txt);
  pick.onclick = () => openImagePicker(pick, { value: name, onPick: set });
  wrap.appendChild(pick);
  const up = mkEl('button', 'if-btn');
  up.type = 'button'; up.title = 'Upload an image for this';
  up.innerHTML = ICON.upload;
  up.onclick = async () => {
    const imgs = await API.pickImages();
    if (!imgs || !imgs.length) return;
    const it = await importOneImage(imgs[0]);
    if (it) set(it.name);
  };
  wrap.appendChild(up);
  if (name) {
    const clr = mkEl('button', 'if-btn');
    clr.type = 'button'; clr.title = 'Clear';
    clr.innerHTML = ICON.x;
    clr.onclick = () => set('');
    wrap.appendChild(clr);
  }
  return wrap;
}
// An image set (digits, weekdays, levels, frames): every picture in order as a
// strip of thumbnails with its index, the count against what the widget
// expects, and the editor one click away.
function imageSetField(e, { buttons = [] } = {}) {
  const field = setFieldOf(e);
  const list = e[field] || [];
  const wrap = mkEl('div', 'setfield');
  const strip = mkEl('div', 'sf-strip');
  const shown = list.slice(0, 40);
  const labels = e.kind === 'IMG_WEEK' ? weekNames(e) : labelKind(e) === 'month' ? monthNames(e) : null;
  shown.forEach((n, i) => {
    const c = thumbEl(n, 'sf-cell');
    c.dataset.i = String(i);
    // a wide picture (a weekday name) gets a wide cell, so it stays readable
    const m = imgMeta(n);
    if (m && m.height) c.style.width = `${Math.min(110, Math.max(24, Math.round(34 * m.width / m.height)))}px`;
    c.title = `${i}${labels && labels[i] ? ` · ${labels[i]}` : ''} · ${n}${imgMeta(n) ? '' : ' (missing)'}`;
    c.onclick = () => openImageSet(e);
    strip.appendChild(c);
  });
  if (list.length > shown.length) strip.appendChild(mkEl('span', 'sf-more', `+${list.length - shown.length}`));
  if (!list.length) {
    const none = mkEl('button', 'sf-empty', 'No images yet — add or generate a set');
    none.type = 'button';
    none.onclick = () => openImageSet(e);
    strip.appendChild(none);
  }
  wrap.appendChild(strip);
  const foot = mkEl('div', 'sf-foot');
  const first = list.map(imgMeta).find(Boolean);
  foot.appendChild(mkEl('span', 'sf-count', `${list.length} image${list.length === 1 ? '' : 's'}${first ? ` · ${first.width}×${first.height}` : ''}`));
  const hint = setHint(e.kind, e);
  if (hint) foot.appendChild(mkEl('span', 'sf-hint', hint));
  foot.appendChild(mkEl('span', 'flex-1'));
  for (const b of buttons) foot.appendChild(b);
  const edit = ctlButton('Edit…', 'Reorder, add, remove or generate the images', () => openImageSet(e));
  foot.appendChild(edit);
  wrap.appendChild(foot);
  return wrap;
}
// a titled section inside Properties
function section(host, title) {
  const h = mkEl('div', 'psec', title);
  host.appendChild(h);
  return h;
}
// a row whose control takes the full width under its label
function stackRow(label, control, title) {
  const r = ctlRow(label, control, title);
  r.classList.add('stack');
  return r;
}

// ------------------------------------------------------------ image picker --
// A popover grid of the project's images with previews. Single mode picks one
// (or None); multi mode collects several, in click order, for an image set.
let pickerEl = null;
function closeImagePicker() {
  if (!pickerEl) return;
  pickerEl.remove();
  pickerEl = null;
  document.removeEventListener('mousedown', pickerOutside, true);
  document.removeEventListener('keydown', pickerKey, true);
}
function pickerOutside(ev) { if (pickerEl && !pickerEl.contains(ev.target)) closeImagePicker(); }
function pickerKey(ev) { if (ev.key === 'Escape') { ev.stopPropagation(); closeImagePicker(); } }
function openImagePicker(anchor, { value = '', multi = false, onPick } = {}) {
  closeImagePicker();
  const box = mkEl('div', 'imgpicker');
  const head = mkEl('div', 'ip-head');
  const search = document.createElement('input');
  search.type = 'text';
  search.placeholder = `Search ${project.images.length} images`;
  head.appendChild(search);
  box.appendChild(head);
  const grid = mkEl('div', 'ip-grid');
  box.appendChild(grid);
  const foot = mkEl('div', 'ip-foot');
  const upload = ctlButton('Upload…', 'Import images from disk', async () => {
    closeImagePicker();
    const imgs = await API.pickImages();
    if (!imgs || !imgs.length) return;
    const added = await importImages(multi ? imgs : imgs.slice(0, 1));
    if (added.length) onPick(multi ? added.map((a) => a.name) : added[0].name);
  });
  foot.appendChild(upload);
  foot.appendChild(mkEl('span', 'flex-1'));
  const chosen = [];
  let addBtn = null;
  if (multi) {
    addBtn = ctlButton('Add', '', () => { const v = chosen.slice(); closeImagePicker(); if (v.length) onPick(v); });
    addBtn.className = 'primary';
    foot.appendChild(addBtn);
  }
  box.appendChild(foot);
  const sync = () => {
    if (!addBtn) return;
    addBtn.disabled = !chosen.length;
    addBtn.textContent = chosen.length ? `Add ${chosen.length}` : 'Add';
    grid.querySelectorAll('.ip-cell[data-name]').forEach((c) => {
      const at = chosen.indexOf(c.dataset.name);
      c.classList.toggle('on', at >= 0);
      c.dataset.order = at >= 0 ? String(at + 1) : '';
    });
  };
  const cell = (name) => {
    const b = mkEl('button', 'ip-cell' + (!multi && name === value ? ' on' : ''));
    b.type = 'button';
    if (name) b.dataset.name = name;
    b.appendChild(thumbEl(name, 'ip-thumb'));
    const meta = name ? imgMeta(name) : null;
    b.appendChild(mkEl('span', 'ip-name', name || 'None'));
    b.appendChild(mkEl('span', 'ip-sub', meta ? `${meta.width}×${meta.height}` : name ? '' : 'no image'));
    b.title = name || 'No image';
    b.onclick = () => {
      if (!multi) { closeImagePicker(); onPick(name); return; }
      const at = chosen.indexOf(name);
      if (at >= 0) chosen.splice(at, 1); else chosen.push(name);
      sync();
    };
    return b;
  };
  const fill = () => {
    const q = search.value.trim().toLowerCase();
    grid.innerHTML = '';
    if (!multi && !q) grid.appendChild(cell(''));
    const list = project.images.filter((i) => !q || i.name.toLowerCase().includes(q));
    for (const im of list) grid.appendChild(cell(im.name));
    if (!list.length) grid.appendChild(mkEl('div', 'ip-empty', project.images.length ? 'No image matches.' : 'The project has no images yet — upload some.'));
    sync();
  };
  search.oninput = fill;
  search.onkeydown = (ev) => {
    if (ev.key !== 'Enter') return;
    const firstCell = grid.querySelector('.ip-cell[data-name]');
    if (firstCell) firstCell.click();
  };
  fill();
  document.body.appendChild(box);
  pickerEl = box;
  // below the anchor, kept inside the window (above it when there is no room)
  const r = anchor.getBoundingClientRect();
  const bw = box.offsetWidth, bh = box.offsetHeight;
  const left = Math.max(8, Math.min(r.left, window.innerWidth - bw - 8));
  const below = r.bottom + 6 + bh <= window.innerHeight - 8;
  box.style.left = `${left}px`;
  box.style.top = `${below ? r.bottom + 6 : Math.max(8, r.top - bh - 6)}px`;
  setTimeout(() => search.focus(), 0);
  document.addEventListener('mousedown', pickerOutside, true);
  document.addEventListener('keydown', pickerKey, true);
}
function setHint(kind, e) {
  const n = (e.images || []).length;
  if (kind === 'IMG_WEEK') return n === 7 ? '' : `weekday sets use 7 images (have ${n})`;
  if (kind === 'TEXT_IMG' || kind === 'IMG_TIME' || kind === 'IMG_DATE') return n === 10 ? '' : `digit sets use 10 images, 0-9 (have ${n})`;
  if (e.dataType === 'WEATHER') return n === 29 ? '' : `the weather set uses 29 icons in the spec order (have ${n})`;
  if (kind === 'IMG_LEVEL' || kind === 'IMG_PROGRESS') return n ? '' : 'add an image per level';
  return '';
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
// The top of Properties: what this layer is, its box, and a link to the Zepp
// docs page of the widget it becomes.
function propsHeader(e) {
  const k = kindById(e.kind);
  const b = elBox(e);
  const h = mkEl('div', 'phdr');
  const ic = mkEl('span', 'ph-icon'); ic.innerHTML = kindIcon(e.kind);
  const main = mkEl('div', 'ph-main');
  main.appendChild(mkEl('div', 'ph-kind', k ? k.label : e.kind));
  main.appendChild(mkEl('div', 'ph-sub', `${Math.round(b.x)}, ${Math.round(b.y)} · ${Math.round(b.w)}×${Math.round(b.h)}${e.locked ? ' · locked' : ''}${e.visible === false ? ' · hidden' : ''}`));
  const docs = mkEl('button', 'ph-docs', `${(k && k.docs) || e.kind} ↗`);
  docs.type = 'button';
  docs.title = `Open the Zepp OS docs for hmUI.widget.${(k && k.docs) || e.kind}`;
  docs.onclick = () => API.openExternal(`https://docs.zepp.com/docs/watchface/api/hmUI/widget/${(k && k.docs) || e.kind}/`);
  h.appendChild(ic); h.appendChild(main); h.appendChild(docs);
  return h;
}
// a row with two short number fields side by side (X / Y, W / H)
function pairRow(label, parts, title) {
  const wrap = mkEl('div', 'pair');
  for (const [pfx, ctl] of parts) {
    const f = mkEl('label', 'pf');
    f.appendChild(mkEl('span', 'pfx', pfx));
    f.appendChild(ctl);
    wrap.appendChild(f);
  }
  return ctlRow(label, wrap, title);
}
// Which face variant a layer belongs to — Normal (screen on), AOD (screen off),
// both, or Edit (only while the wearer customises the face) — as one-click
// segments that set every selected layer at once. A mixed selection lights no
// segment and says how it splits.
const SHOW_SEGMENTS = [
  ['normal', 'Normal', 'Only while the screen is on'],
  ['aod', 'AOD', 'Only on the always-on (screen-off) display'],
  ['both', 'Both', 'In the normal face and in AOD (exported as two widgets)'],
  ['edit', 'Edit', 'Only while the wearer customises the face'],
];
function ctlShowIn(targets) {
  const wrap = mkEl('div', 'seg');
  const cur = new Set(targets.map((t) => t.show || 'normal'));
  for (const [key, label, tip] of SHOW_SEGMENTS) {
    const b = mkEl('button', 'seg-b' + (cur.size === 1 && cur.has(key) ? ' on' : ''), label);
    b.type = 'button';
    b.dataset.show = key;
    b.title = targets.length > 1 ? `${tip} — all ${targets.length} selected layers` : tip;
    b.onclick = () => setShowIn(targets, key);
    wrap.appendChild(b);
  }
  if (cur.size > 1) {
    const counts = SHOW_SEGMENTS.map(([k, l]) => [l, targets.filter((t) => (t.show || 'normal') === k).length]).filter(([, n]) => n);
    wrap.title = `Mixed: ${counts.map(([l, n]) => `${n} ${l}`).join(', ')}`;
    wrap.classList.add('mixed');
  }
  return wrap;
}
function setShowIn(targets, key) {
  if (!targets.length || targets.every((t) => (t.show || 'normal') === key)) return;
  pushHistory();
  setOn(targets, 'show', key);
  refreshPanels(); render(); scheduleCode();
  const name = SHOW_SEGMENTS.find(([k]) => k === key)[1];
  status(`${targets.length === 1 ? `“${layerLabel(targets[0])}”` : `${targets.length} layers`} → ${name === 'Both' ? 'Normal + AOD' : name}.`);
}
// opacity as a slider with its number beside it
function ctlAlpha(targets) {
  const first = targets[0] || {};
  const v0 = Number.isFinite(+first.alpha) ? +first.alpha : 255;
  const wrap = mkEl('div', 'rowctl');
  const range = document.createElement('input');
  range.type = 'range'; range.min = 0; range.max = 255; range.value = v0;
  const n = document.createElement('input');
  n.type = 'number'; n.min = 0; n.max = 255; n.value = v0; n.className = 'num-sm';
  const set = (v) => {
    v = Math.max(0, Math.min(255, Math.round(+v || 0)));
    pushHistory(); setOn(targets, 'alpha', v);
    range.value = v; n.value = v;
    render(); scheduleCode();
  };
  range.oninput = () => set(range.value);
  n.oninput = () => set(n.value);
  wrap.appendChild(range); wrap.appendChild(n);
  return wrap;
}
// Quick layout actions: centre on the screen, match the picture's own size.
function geoHelpers(e) {
  const d = dev();
  const wrap = mkEl('div', 'rowctl wrap');
  const center = (axis) => {
    pushHistory();
    if (e.kind === 'TIME_POINTER' || e.kind === 'IMG_POINTER') {
      if (axis !== 'y') e.centerX = Math.round(d.w / 2);
      if (axis !== 'x') e.centerY = Math.round(d.h / 2);
    } else {
      const b = elBox(e);
      moveEl(e, axis !== 'y' ? Math.round(d.w / 2 - (b.x + b.w / 2)) : 0, axis !== 'x' ? Math.round(d.h / 2 - (b.y + b.h / 2)) : 0);
    }
    refreshPanels(); render(); scheduleCode();
  };
  wrap.appendChild(ctlButton('Center ↔', 'Centre horizontally on the screen', () => center('x')));
  wrap.appendChild(ctlButton('Center ↕', 'Centre vertically on the screen', () => center('y')));
  const pic = ['IMG', 'IMG_STATUS', 'IMG_CLICK', 'IMG_LEVEL'].includes(e.kind)
    ? imgMeta(e.kind === 'IMG_LEVEL' ? (e.images || [])[0] : e.src) : null;
  if (pic && (+e.w !== pic.width || +e.h !== pic.height)) {
    wrap.appendChild(ctlButton('Use image size', `Set W×H to the picture's ${pic.width}×${pic.height}`, () => {
      pushHistory(); e.w = pic.width; e.h = pic.height; refreshPanels(); render(); scheduleCode();
    }));
  }
  return wrap;
}
// Rebuilding the panel empties it for a moment, which clamps the panel's own
// scroll to the top — remember where it was and put it back, so typing in a
// field (the Symbol field especially: the font rows come and go) does not jump.
function renderProps() {
  const host = $('props');
  const keepTop = host.scrollTop;
  renderPropsBody(host);
  if (host.scrollTop !== keepTop) host.scrollTop = keepTop;
}
function renderPropsBody(host) {
  host.innerHTML = '';
  if (!project) return;
  const e = selEl();
  const sel = selection();
  if (sel.length > 1) {
    const gb = groupBox(`${sel.length} layers selected`);
    // the face variant helper sits first: picking which layers stay on in AOD
    // is the usual reason to select several at once
    gb.appendChild(stackRow('Show in', ctlShowIn(sel), `Applies to all ${sel.length} selected layers`));
    gb.appendChild(propNote('Show in, Alpha and the styles below apply to every selected layer.'));
    host.appendChild(gb);
    const gid = commonGroup(sel);
    if (gid) host.appendChild(ctlRow('Group name', groupNameInput(gid), 'Rename this group (double-clicking its name in the layers panel works too)'));
    host.appendChild(propsGroupTools(sel));
  }
  if (!e) {
    if (sel.length <= 1) host.innerHTML = '<p class="muted">Select a layer.</p>';
    return;
  }
  propsHelpKind = e.kind;
  host.appendChild(propsHeader(e));
  // common
  const many = sel.length > 1;
  const targets = commonTargets(e);
  section(host, 'Layer');
  host.appendChild(ctlRow('Name', ctlText(e, 'name', layerLabel(e))));
  if (!many) host.appendChild(stackRow('Show in', ctlShowIn(targets)));
  host.appendChild(ctlRow('Alpha', ctlAlpha(targets),
    many ? `Applies to all ${sel.length} selected layers` : ''));

  section(host, 'Position & size');
  if (CENTER_KINDS.has(e.kind)) {
    host.appendChild(pairRow('Center', [['X', ctlNum(e, 'centerX')], ['Y', ctlNum(e, 'centerY')]]));
    if (e.kind !== 'TIME_POINTER') host.appendChild(ctlRow('Radius', ctlNum(e, 'radius', { min: 0 })));
  } else if (e.kind === 'IMG_POINTER') {
    host.appendChild(pairRow('Center', [['X', ctlNum(e, 'centerX')], ['Y', ctlNum(e, 'centerY')]]));
    host.appendChild(pairRow('Pivot', [['X', ctlNum(e, 'x')], ['Y', ctlNum(e, 'y')]]));
  } else if (WH_KINDS.has(e.kind)) {
    host.appendChild(pairRow('Position', [['X', ctlNum(e, 'x')], ['Y', ctlNum(e, 'y')]]));
    host.appendChild(pairRow('Box', [['W', ctlNum(e, 'w', { min: 0 })], ['H', ctlNum(e, 'h', { min: 0 })]]));
  } else {
    host.appendChild(pairRow('Position', [['X', ctlNum(e, 'x')], ['Y', ctlNum(e, 'y')]]));
  }
  host.appendChild(ctlRow('Helpers', geoHelpers(e)));
  host.appendChild(propsKind(e));
  const del = ctlButton('Delete layer', '', () => deleteElements([e]));
  del.className = 'row-btn';
  host.appendChild(del);
}
function ctlRow(label, control, title) {
  const row = mkRow(label, title);
  row.appendChild(control);
  return row;
}
// full-width explanatory line inside the properties panel
function propNote(text) {
  const p = document.createElement('p');
  p.className = 'prop-note';
  p.textContent = text;
  return p;
}
// ---------------------------------------------------------------------------
// Glyph styling
//
// A digit / weekday / data layer draws PNG images, not text, so hmUI has no
// text_size or color parameter for it: both were baked when the glyphs were
// rasterised. Every such layer carries a spec (`e.glyph`) that the rows below
// edit, and changing anything re-renders the layer's *own* images in place —
// the reference designer's per-layer font box, wired to this project's glyph
// pipeline.
//
// Three cases are special, because the watchface format fixes their file names
// (so the file is shared between layers instead of owned by one):
//   * separators — colon.png, degree.png, dot.png, negative.png, percent.png,
//     slash.png, am/pm.png. A clock colon is a single IMG layer pointing at
//     colon.png; a temperature reading carries its degree (and minus) glyph as
//     the layer's `unit` / `negative` image, so the ° follows the digits;
//   * a blinking colon is a frame list: the `…_off` frames are rendered blank,
//     so the blink keeps working while the colon itself takes the new style;
//   * imported sets (weather icons, month names) are never re-rendered.
const DIGIT_SET_KINDS = new Set(['IMG_TIME', 'IMG_DATE', 'IMG_LEVEL', 'IMG_PROGRESS', 'TEXT_IMG']);
const GLYPH_ATTACHED = ['unit', 'dot', 'negative', 'am', 'pm'];
const GLYPH_FILLS = [
  { value: 'solid', label: 'Solid' },
  { value: 'gradient', label: 'Gradient (2 stops)' },
  { value: 'css', label: 'Gradient from CSS' },
  { value: 'outline', label: 'Outline' },
];
const DIGIT_FILE_RE = /^font_\d+_\d+\.png$/;
// a weekday / month set is owned by its layer (week_w1…, week2_w1… for a second
// layer in another language or style), so two layers never overwrite each other
const WEEK_FILE_RE = /^week\d*_w\d+\.png$/;
const MONTH_FILE_RE = /^month\d*_m\d+\.png$/;
const LABEL_FILE_RE = { week: /^(week\d*)_w\d+\.png$/, month: /^(month\d*)_m\d+\.png$/ };
const DIGIT_METRICS = ['0123456789'];
const WEEK_CHARS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const SEPARATOR_CHARS = { colon: ':', dot: '.', percent: '%', negative: '-', degree: '°', slash: '/', am: 'A', pm: 'P' };
const SEPARATOR_FILE_RE = /^(colon|dot|percent|negative|degree|slash|am|pm)(_\w+)?\.png$/i;
const DEFAULT_GLYPH_CSS = 'linear-gradient(180deg, #ffd400, #ff2d55)';

// ------------------------------------------------------------ localization --
// Weekday and month names are asked of the browser instead of being written down
// here, so a watchface can be generated in any language: `project.language` is
// the project default and one layer may override it. The wording (Mon / Monday /
// M) and its casing are per layer as well — both end up baked into the images.
const LABEL_FORMS = [
  { value: 'short', label: 'Short (Mon)' },
  { value: 'long', label: 'Full (Monday)' },
  { value: 'narrow', label: 'Narrow (M)' },
];
const LABEL_CASES = [
  { value: 'upper', label: 'UPPERCASE' },
  { value: '', label: 'As generated' },
  { value: 'capitalize', label: 'Capitalize' },
  { value: 'lower', label: 'lowercase' },
];
// a familiar list for the picker — any BCP-47 tag can simply be typed in
const LANGUAGE_SUGGESTIONS = ['en-US', 'en-GB', 'ro-RO', 'de-DE', 'fr-FR', 'es-ES', 'it-IT', 'pt-BR', 'nl-NL', 'pl-PL', 'cs-CZ', 'sk-SK', 'hu-HU', 'sv-SE', 'da-DK', 'fi-FI', 'nb-NO', 'tr-TR', 'ru-RU', 'uk-UA', 'el-GR', 'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW', 'th-TH', 'vi-VN', 'id-ID', 'hi-IN', 'ar-EG', 'he-IL'];
function projectLanguage() {
  const l = project && project.language;
  return l && String(l).trim() ? String(l).trim() : 'en-US';
}
function languageOf(e) {
  const l = e && e.language;
  return l && String(l).trim() ? String(l).trim() : projectLanguage();
}
function localeKnown(tag) {
  if (!tag) return false;
  try { return Intl.DateTimeFormat.supportedLocalesOf([tag]).length > 0; }
  catch (err) { return false; }
}
function applyLabelCase(text, mode) {
  if (mode === 'upper') return text.toLocaleUpperCase();
  if (mode === 'lower') return text.toLocaleLowerCase();
  if (mode === 'capitalize') return text.charAt(0).toLocaleUpperCase() + text.slice(1);
  return text;
}
// an unset case means UPPERCASE: that is what the designer has always drawn for
// weekday sets, so existing faces keep their look and the option can relax it
function labelCaseOf(e) {
  const c = e && e.labelCase;
  return c == null ? 'upper' : c;
}
// 2024-01-01 is a Monday and the 15th sits mid-month: walking from those two
// gives the seven weekdays and the twelve months in the order the widget wants.
function localeNames(kind, tag, form) {
  const loc = localeKnown(tag) ? tag : 'en-US';
  try {
    if (kind === 'week') {
      const fmt = new Intl.DateTimeFormat(loc, { weekday: form || 'short', timeZone: 'UTC' });
      return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i, 12))));
    }
    const fmt = new Intl.DateTimeFormat(loc, { month: form || 'short', timeZone: 'UTC' });
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(Date.UTC(2024, i, 15, 12))));
  } catch (err) { /* fall back below */ }
  return kind === 'week' ? WEEK_CHARS.slice() : [];
}
function weekNames(e) {
  return localeNames('week', languageOf(e), (e && e.labelForm) || 'short')
    .map((s) => applyLabelCase(s, labelCaseOf(e)));
}
function monthNames(e) {
  return localeNames('month', languageOf(e), (e && e.labelForm) || 'short')
    .map((s) => applyLabelCase(s, labelCaseOf(e)));
}

// colon.png → { : }, colon_off.png → a blank frame, degree.png → { ° }
function separatorGlyphFor(name) {
  const stem = String(name || '').replace(/\.png$/i, '');
  if (!stem) return null;
  const off = /(_off|_empty|_blank)$/i.test(stem);
  const base = stem.replace(/(_off|_empty|_blank|_\d+)$/i, '');
  const ch = SEPARATOR_CHARS[base];
  if (ch == null) return null;
  return { tag: stem.replace(/[^\w\-]+/g, '_'), char: off ? ' ' : ch, name: String(name) };
}
// a glyph layer is a digit/weekday/data layer, or an image layer whose file is
// one of the fixed separators (the clock colon, a blink frame list)
// a readable file name for an image generated from a symbol: 'A' → symbol_A.png,
// '°' → symbol_u00b0.png (never a spec separator name — those are shared files)
function symbolFileName(char) {
  const c = String(char == null ? '' : char).trim();
  if (!c) return 'symbol.png';
  if (/^[A-Za-z0-9]$/.test(c)) return `symbol_${c}.png`;
  return `symbol_${[...c].map((ch) => 'u' + ch.codePointAt(0).toString(16).padStart(4, '0')).join('_')}.png`;
}
// the symbol a layer's image is drawn from: an explicit one (any image layer can
// be generated from a character), or the separator its file name implies
function layerSymbol(e) {
  // an explicit choice wins, even an empty one (that is how Symbol is cleared
  // back to a regular image layer); otherwise a separator file name implies it
  if (e.symbol) return e.symbol.char ? e.symbol : null;
  const sep = e.kind === 'IMG' ? separatorGlyphFor(e.src) : null;
  return sep ? { char: sep.char, name: sep.name } : null;
}
function isGlyphLayer(e) {
  if (!e) return false;
  if (DIGIT_SET_KINDS.has(e.kind) || e.kind === 'IMG_WEEK') return true;
  if (e.kind === 'IMG') return !!layerSymbol(e);
  if (e.kind === 'IMG_ANIM') {
    const f = e.frames || [];
    return f.length > 0 && f.every((n) => !!separatorGlyphFor(n));
  }
  return false;
}
// what the panel edits, with the values the layer's images were drawn with
function glyphStyle(e) {
  const sepOnly = (e.kind === 'IMG' || e.kind === 'IMG_ANIM') && isGlyphLayer(e) && !(e.symbol && e.symbol.char);
  // a colon / blink layer with no style of its own draws like the clock digits
  // next to it, so restyling it keeps it in step with them
  const g = e.glyph || (sepOnly ? ((digitLayerFor(e) || {}).glyph) : null) || {};
  // an imported set carries no style of its own: offer the size its pictures are
  // drawn at, so the first re-render keeps their proportions
  const keep = (!g.size && glyphSpecForLayer(e)) ? importedGlyphHeight(e) : 0;
  const size = +g.size || keep || (labelKind(e) ? 40 : +glyphOpts.size) || 48;
  return {
    font: g.font || glyphFont,
    size: Math.max(8, Math.round(size)),
    weight: g.weight == null ? +glyphOpts.weight : +g.weight,
    variations: g.variations == null ? glyphOpts.variations : g.variations,
    fill: g.fill || 'solid',
    color: g.color || '#ffffff',
    from: g.from || '#ffd400',
    to: g.to || '#ff2d55',
    angle: g.angle == null ? 180 : +g.angle,
    css: g.css || DEFAULT_GLYPH_CSS,
    outlineColor: g.outlineColor || '#ffffff',
    outlineWidth: Math.max(1, Math.round(+g.outlineWidth || 2)),
    bold: !!g.bold,
    italic: !!g.italic,
  };
}
// the glyph list this layer's images stand for, or null when the designer must
// not touch them (imported sets, month names, an unknown picture)
function glyphSpecForLayer(e) {
  const g = e.glyph || {};
  if (g.glyphs && g.glyphs.length) return g.glyphs.map((x) => ({ ...x }));
  const imgs = e.images || [];
  if (e.kind === 'IMG_WEEK') {
    const labels = weekNames(e);
    // a set the designer drew (week_w1.png …) and a whole imported one are both
    // the seven weekdays in order, so either can be restyled
    if (imgs.length >= 7) return imgs.slice(0, 7).map((n, i) => ({ tag: `w${i + 1}`, char: labels[i], name: n }));
    if (!imgs.length) return labels.map((l, i) => ({ tag: `w${i + 1}`, char: l }));
    return null;
  }
  if (e.kind === 'IMG' || e.kind === 'IMG_ANIM') {
    if (e.kind === 'IMG' && e.symbol && e.symbol.char) {
      return [{ tag: 'symbol', char: e.symbol.char, name: e.symbol.name || e.src || null }];
    }
    const files = e.kind === 'IMG_ANIM' ? (e.frames || []) : (e.src ? [e.src] : []);
    const seps = files.map(separatorGlyphFor);
    return seps.length && seps.every(Boolean) ? seps : null;
  }
  if (!DIGIT_SET_KINDS.has(e.kind)) return null;
  if (e.kind === 'IMG_DATE' && e.isCharacter) {
    const labels = monthNames(e);
    if (imgs.length >= 12) return imgs.slice(0, 12).map((n, i) => ({ tag: `m${i + 1}`, char: labels[i], name: n }));
    if (!imgs.length) return labels.map((l, i) => ({ tag: `m${i + 1}`, char: l }));
    return null;
  }
  if (imgs.length >= 10 && imgs.slice(0, 10).every((n) => DIGIT_FILE_RE.test(n))) {
    return imgs.slice(0, 10).map((n, i) => ({ tag: String(i), char: String(i), name: n }));
  }
  // The widget's own parameters say what its images are: a time/date/data part
  // is the digits 0-9 in that order (the docs require it), so a set that came
  // from another watchface can be restyled too. Level and progress sets are
  // pictures of a level, not characters, so they stay untouched.
  const digits = e.kind === 'IMG_TIME' || e.kind === 'TEXT_IMG' || (e.kind === 'IMG_DATE' && !e.isCharacter);
  if (digits && imgs.length >= 10) {
    return imgs.slice(0, 10).map((n, i) => ({ tag: String(i), char: String(i), name: n }));
  }
  if (!imgs.length) return '0123456789'.split('').map((c, i) => ({ tag: String(i), char: c }));
  return null;   // hand-picked images are left alone
}
// true when this layer still draws the pictures it came with, so Properties can
// say out loud that a style change will replace them
function importedGlyphSet(e) {
  const g = e.glyph || {};
  if (g.glyphs && g.glyphs.length) return false;
  if (e.kind === 'IMG' && layerSymbol(e)) return false;
  const files = glyphLayerFiles(e);
  if (!files.length) return false;
  return !files.some((n) => DIGIT_FILE_RE.test(n) || WEEK_FILE_RE.test(n) || MONTH_FILE_RE.test(n) || SEPARATOR_FILE_RE.test(n));
}
// the em size that would draw a glyph cell as tall as these pictures are — the
// cell is ascent + descent + padding (see genGlyphImages), so measuring a digit
// at a probe size is enough to invert it. Best effort: a font that is not
// loaded yet is measured in the fallback face, which is close enough to start.
function importedGlyphHeight(e) {
  const n = (e.images || [])[0] || (e.frames || [])[0];
  const meta = n ? imgMeta(n) : null;
  if (!meta || !meta.height) return 0;
  const g = e.glyph || {};
  const probe = 100;
  let cell = 0;
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    setFontOn(ctx, g.font || glyphFont, probe,
      g.weight == null ? glyphOpts.weight : g.weight,
      g.variations == null ? glyphOpts.variations : g.variations);
    const m = ctx.measureText('0');
    const pad = Math.max(1, Math.round(probe / 28));
    cell = Math.ceil((m.actualBoundingBoxAscent || probe * 0.8) + Math.ceil(m.actualBoundingBoxDescent || 0)) + pad * 2;
  } catch (err) { cell = 0; }
  return Math.max(8, Math.round(meta.height * (cell > 0 ? probe / cell : 1)));
}
// separator images attached to a layer (the temperature ° / −, a decimal dot,
// AM/PM) — they are re-rendered with the layer, keeping their design names
function attachedSepGlyphs(e) {
  const out = [];
  for (const key of GLYPH_ATTACHED) {
    const g = separatorGlyphFor(e[key]);
    if (g) out.push(g);
  }
  return out;
}
function glyphLayerFiles(e) {
  const out = [];
  for (const n of (e.images || [])) out.push(n);
  for (const n of (e.frames || [])) out.push(n);
  if (e.src) out.push(e.src);
  for (const key of GLYPH_ATTACHED) if (e[key]) out.push(e[key]);
  return out.filter(Boolean);
}
// other layers that point at the same glyph files
function glyphUsersOf(names, ...except) {
  const set = new Set(names.filter(Boolean));
  return elements().filter((x) => !except.includes(x) && glyphLayerFiles(x).some((n) => set.has(n)));
}
function labelKind(e) {
  if (!e) return null;
  if (e.kind === 'IMG_WEEK') return 'week';
  if (e.kind === 'IMG_DATE' && e.isCharacter) return 'month';
  return null;
}
// week, week2, week3 … — the first whose files are not in the project yet
function nextLabelPrefix(kind) {
  const taken = new Set(project.images.map((i) => i.name));
  const first = kind === 'week' ? 'w1' : 'm1';
  for (let n = 1; ; n++) {
    const p = n === 1 ? kind : `${kind}${n}`;
    if (!taken.has(`${p}_${first}.png`)) return p;
  }
}
// the prefix of a label set this layer owns alone (null: none, or shared)
function ownLabelPrefix(e, kind) {
  const imgs = (e && e.images) || [];
  const m = imgs.length ? LABEL_FILE_RE[kind].exec(imgs[0]) : null;
  if (!m) return null;
  return glyphUsersOf(imgs, e).length ? null : m[1];
}
function freshPrefixFor(e) {
  const lk = labelKind(e);
  return lk ? nextLabelPrefix(lk) : nextDigitPrefix();
}
function glyphPrefixFor(e, spec) {
  const first = (spec[0] && spec[0].name) || (e.images || [])[0] || e.src || '';
  const m = /^(font_\d+)_\d+\.png$/.exec(first);
  if (m) return m[1];
  const lk = labelKind(e);
  if (lk) {
    const lm = LABEL_FILE_RE[lk].exec(first);
    return lm ? lm[1] : nextLabelPrefix(lk);
  }
  return nextDigitPrefix();
}
// names the design owns (colon.png, degree.png …): layers share them on
// purpose, so they are never forked into a private copy
function designFixedName(n) {
  return SEPARATOR_FILE_RE.test(n);
}
// The clock digits a separator belongs to: a digit layer in the same group,
// else the nearest one on the canvas.
function digitLayerFor(e) {
  if (!project || !e) return null;
  const digits = elements().filter((x) => x !== e && (x.kind === 'IMG_TIME' || x.kind === 'IMG_DATE' || x.kind === 'TEXT_IMG')
    && (x.images || []).length);
  if (!digits.length) return null;
  const mates = e.group ? digits.filter((x) => x.group === e.group) : [];
  const pool = mates.length ? mates : digits;
  const b = elBox(e);
  const dist = (x) => { const o = elBox(x); return Math.hypot(o.x + o.w / 2 - b.x - b.w / 2, o.y + o.h / 2 - b.y - b.h / 2); };
  return pool.slice().sort((a, c) => dist(a) - dist(c))[0];
}
// the style a digit set was drawn with — the layer that owns it, else the
// font library defaults those sets are generated from
function digitStyleOf(names) {
  const first = (names || []).find(Boolean);
  const owner = first ? elements().find((x) => x.glyph && (x.images || []).includes(first)) : null;
  return glyphStyle(owner || { kind: 'IMG_TIME', glyph: { font: glyphFont, size: +glyphOpts.size || 48, color: glyphOpts.color,
    weight: glyphOpts.weight, variations: glyphOpts.variations, fill: 'solid' } });
}
// what a layer stores as its glyph spec: the style, nothing derived
function glyphSpecFrom(st) {
  const { font, size, weight, variations, fill, color, from, to, angle, css, outlineColor, outlineWidth, bold, italic } = st;
  return { font, size, weight, variations, fill, color, from, to, angle, css, outlineColor, outlineWidth, bold, italic };
}
// Rasterise this layer's images again, in place, with its current style.
// A digit set shared with a layer we are *not* restyling is copied first (the
// reference does the same): the other layers keep the glyphs they were drawn
// with, this one gets a set of its own.
async function regenerateGlyphs(e, { targets = [e] } = {}) {
  const spec = glyphSpecForLayer(e);
  if (!spec || !spec.length) return null;
  const st = glyphStyle(e);
  // An image drawn from a symbol gets a file of its own the first time
  // (symbol_<char>.png) — it never overwrites the picture (or the shared
  // separator file) the layer was pointing at. Later edits re-render that file
  // in place, and the symbol is remembered on the layer.
  const sym = e.kind === 'IMG' ? layerSymbol(e) : null;
  if (sym && !(e.symbol && e.symbol.name)) {
    const name = uniqImageName(symbolFileName(sym.char));
    e.symbol = { char: sym.char, name };
    spec[0].name = name;
  }
  const cur = spec.map((g) => g.name).filter(Boolean);
  let pre = glyphPrefixFor(e, spec);
  // A set another layer draws too is copied first, so that layer keeps the
  // glyphs it was designed with: that covers a generated digit set and a set the
  // project imported, but never separators or weekday/month names, which carry
  // design-fixed names (colon.png, week_w1.png) that layers share on purpose.
  const shared = glyphUsersOf(cur, e).filter((x) => !targets.includes(x)).length > 0;
  const fork = shared && cur.length > 0 && !cur.every(designFixedName);
  if (fork) pre = freshPrefixFor(e);
  // digits and separators share one cell height and baseline (DIGIT_METRICS), so
  // a colon generated beside a digit set lines up with it at the same Y
  const digitLike = DIGIT_SET_KINDS.has(e.kind) || (!e.symbol || !e.symbol.char) && spec.every((g) => separatorGlyphFor(g.name));
  const names = await genGlyphImages(
    spec.map((g) => ({ tag: g.tag, char: g.char, name: (fork || !g.name) ? `${pre}_${g.tag}.png` : g.name })),
    { prefix: pre, mono: spec.length > 1, replace: true, size: st.size,
      family: st.font, weight: st.weight, variations: st.variations, style: st,
      metricsRef: digitLike && !labelKind(e) ? DIGIT_METRICS : null,
      align: e.labelAlign || 'center' },
  );
  if (e.kind === 'IMG') e.src = names[0];
  else if (e.kind === 'IMG_ANIM') e.frames = names;
  else e.images = names;
  for (const key of GLYPH_ATTACHED) {
    const g = separatorGlyphFor(e[key]);
    if (!g) continue;
    // the same size and the digits' cell height and baseline: a font draws its
    // ° high and its − at the digits' mid-height, so they land where the
    // typeface designer put them next to these digits
    const [n] = await genGlyphImages([{ tag: g.tag, char: g.char, name: g.name }],
      { prefix: g.tag, mono: false, replace: true, size: st.size, metricsRef: DIGIT_METRICS,
        family: st.font, weight: st.weight, variations: st.variations, style: st });
    e[key] = n;
  }
  return names;
}
// Editing a control re-renders 10-40 PNGs per layer, so it is batched: the
// canvas updates at once, the images follow a moment after the last change.
let glyphGenTimer = null;
let glyphGenQueue = [];
function scheduleGlyphGen(targets) {
  for (const t of targets) if (!glyphGenQueue.includes(t.id)) glyphGenQueue.push(t.id);
  clearTimeout(glyphGenTimer);
  glyphGenTimer = setTimeout(glyphGenNow, 400);
}
async function glyphGenNow() {
  const ids = glyphGenQueue;
  glyphGenQueue = [];
  const list = ids.map(elementById).filter(Boolean);
  if (list.length && project) await rerenderGlyphLayers(list, { quiet: true });
}
async function rerenderGlyphLayers(targets, { quiet } = {}) {
  const list = targets.filter(Boolean);
  let done = 0;
  for (const el of list) {
    try { if (await regenerateGlyphs(el, { targets: list })) done++; }
    catch (err) { status('Could not re-render the glyphs: ' + (err.message || err), true); }
  }
  if (!done) {
    if (!quiet) status('Nothing to re-render on these layers — they use imported images.', true);
    return 0;
  }
  await loadAllImages();
  withFocusKept(() => refreshPanels());
  render(); scheduleCode();
  status(`Re-rendered ${done} image layer${done === 1 ? '' : 's'} at the new size / colour.`);
  return done;
}
function glyphFamilyOptions() {
  const out = [];
  const seen = new Set();
  const push = (fam, label) => { if (!fam || seen.has(fam)) return; seen.add(fam); out.push({ value: fam, label }); };
  for (const f of customFonts) push(f.family, `${f.family} · imported`);
  for (const f of BUNDLED_FONTS) push(f.family, `${f.family} · bundled`);
  const cur = glyphStyle(selEl() || {}).font;
  push(cur, cur);
  return out;
}
// The character an image is drawn from. Works for any image layer: type a symbol
// and the PNG is rasterised from the font and set as this layer's image (a
// separator layer keeps its design name, a fresh one gets symbol_*.png).
function symbolInput(e) {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.maxLength = 4;
  inp.placeholder = '° ♥ A';
  inp.dataset.keepFocus = 'symbol';
  const sym = layerSymbol(e);
  inp.value = sym ? sym.char : '';
  const had = !!layerSymbol(e);
  inp.oninput = () => {
    pushHistory();
    const char = inp.value.trim();
    // a fresh symbol gets a file of its own when it is generated; an existing
    // generated file is re-rendered in place. Clearing it makes this a regular
    // image layer again (the picture it already has stays).
    e.symbol = char ? { char, name: (e.symbol && e.symbol.name) || null } : { char: '' };
    // the font rows appear/disappear with the symbol, so rebuild when that changes
    if (!!char === had) render(); else refreshPanels();
    scheduleGlyphGen([e]);
    scheduleCode();
  };
  return inp;
}
// Regenerating glyphs rebuilds the Properties panel; put the caret back where it
// was so typing a symbol or a size does not lose focus mid-edit.
function withFocusKept(fn) {
  const act = document.activeElement;
  const key = act && act.dataset ? act.dataset.keepFocus : null;
  const pos = key && act.selectionStart != null ? act.selectionStart : null;
  fn();
  if (!key) return;
  const next = document.querySelector(`[data-keep-focus="${key}"]`);
  if (next && next.focus) {
    next.focus();
    if (pos != null && next.setSelectionRange) next.setSelectionRange(pos, pos);
  }
}
// ------------------------------------------------- names & language rows ----
// Weekday / month names are baked into images, so the layer picks the wording,
// the casing and — if it differs from the project — the language.
function labelRows(add, e, kind) {
  add('Names', ctlSelect(e.labelForm || 'short', LABEL_FORMS, (v) => { e.labelForm = v; relabelGlyphs(e); }),
    kind === 'week'
      ? 'Mon, Monday or M — written in the language below and rasterised as images'
      : 'Jan, January or J — written in the language below and rasterised as images');
  add('Case', ctlSelect(labelCaseOf(e), LABEL_CASES, (v) => { e.labelCase = v; relabelGlyphs(e); }),
    'UPPERCASE (the default), the language’s own casing, Capitalize or lowercase');
  add('Language', langInput(e), `Empty uses the project language (${projectLanguage()})`);
  add('Label align', ctlSelect(e.labelAlign || 'center', [
    { value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' },
  ], (v) => { e.labelAlign = v; relabelGlyphs(e); }),
  'Every name is drawn in one cell as wide as the longest; this places each name inside it, so the label never jumps between days');
}
function langInput(e) {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = e.language || '';
  inp.placeholder = projectLanguage();
  inp.title = 'BCP-47 tag for this layer only, e.g. ro-RO or de-DE';
  inp.onchange = () => {
    const v = inp.value.trim();
    if (v && !localeKnown(v)) { status(`“${v}” is not a language tag this browser knows.`, true); inp.value = e.language || ''; return; }
    pushHistory(); e.language = v;
    relabelGlyphs(e); refreshPanels(); render(); scheduleCode();
  };
  return inp;
}
// names are baked into images: a set the designer drew is redrawn right away, an
// imported one waits for “Re-render” so nobody loses their artwork by accident
function relabelGlyphs(e) {
  if (!glyphSpecForLayer(e)) { status('Names apply to a generated weekday or month set.', true); return; }
  const first = (e.images || [])[0] || '';
  if (WEEK_FILE_RE.test(first) || MONTH_FILE_RE.test(first)) scheduleGlyphGen([e]);
  else status('The images take the new names on the next “Re-render” — until then the layer keeps its own pictures.');
}
function rememberGlyphStyle(e, size) {
  e.glyph = {
    ...(e.glyph || {}),
    font: glyphFont, size, color: glyphOpts.color,
    weight: glyphOpts.weight, variations: glyphOpts.variations, fill: (e.glyph && e.glyph.fill) || 'solid',
  };
}
// Month names are their own 12-image set (the widget has no "month name" array to
// fill with digits), so switching the mode on draws one straight away.
function characterCheck(e) {
  const inp = document.createElement('input');
  inp.type = 'checkbox';
  inp.checked = !!e.isCharacter;
  inp.title = 'Month name instead of digits';
  inp.onchange = async () => {
    pushHistory();
    e.isCharacter = !!inp.checked;
    if (e.isCharacter) {
      e.part = 'month';
      if (!(e.images || []).length) {
        try { rememberGlyphStyle(e, 40); e.images = await genLabelSet(e, 'month'); }
        catch (err) { status('Could not generate the month names: ' + (err.message || err), true); }
      }
    }
    refreshPanels(); render(); scheduleCode();
  };
  return inp;
}
// Properties rows for one glyph layer; every control writes to *all* selected
// glyph layers, so selecting a group restyles the whole clock in one go.
function glyphStyleRows(frag, add, e) {
  const spec = glyphSpecForLayer(e);
  const files = glyphLayerFiles(e);
  // any image layer can be *generated* from a symbol (a character drawn with a
  // font); kinds that only draw imported sets cannot
  const canSymbol = e.kind === 'IMG';
  const sym = canSymbol ? layerSymbol(e) : null;
  const sepOnly = (e.kind === 'IMG' || e.kind === 'IMG_ANIM') && !!spec && !(e.symbol && e.symbol.char);
  // the widget's own parameters say what the images are, so a set that came from
  // another watchface is editable — but the style rows will redraw it
  const imported = !!spec && importedGlyphSet(e);
  if (!spec && !canSymbol) {
    if (files.length) {
      frag.appendChild(propNote(`These ${files.length} images were imported or picked by hand, so the designer leaves them alone — size and colour are in the pictures themselves.`));
    }
    return;
  }
  section(frag, spec ? 'Glyph style' : 'Draw from a symbol');
  const T = targetsWhere(e, isGlyphLayer);
  const st = glyphStyle(e);
  const apply = (key, value) => {
    for (const t of T) { const g = (t.glyph = t.glyph || glyphSpecFrom(glyphStyle(t))); g[key] = value; }
    scheduleGlyphGen(T);
  };
  const num = (key, { min = null, max = null } = {}) => {
    const inp = document.createElement('input');
    inp.type = 'number';
    if (min != null) inp.min = min;
    if (max != null) inp.max = max;
    inp.value = st[key];
    inp.oninput = () => {
      pushHistory();
      let v = +inp.value || 0;
      if (min != null) v = Math.max(min, v);
      if (max != null) v = Math.min(max, v);
      apply(key, v);
      render(); scheduleCode();
    };
    return inp;
  };
  const color = (key) => {
    const inp = document.createElement('input');
    inp.type = 'color';
    inp.value = st[key];
    inp.oninput = () => { pushHistory(); apply(key, inp.value); render(); scheduleCode(); };
    return inp;
  };
  const text = (key, placeholder) => {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = st[key] || '';
    if (placeholder) inp.placeholder = placeholder;
    inp.oninput = () => { pushHistory(); apply(key, inp.value); render(); scheduleCode(); };
    return inp;
  };
  const check = (key, title) => {
    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.checked = !!st[key];
    if (title) inp.title = title;
    inp.onchange = () => { pushHistory(); apply(key, inp.checked); render(); scheduleCode(); };
    return inp;
  };
  if (canSymbol) {
    add('Symbol', symbolInput(e), 'The character this image is drawn from — a letter, a separator like ° or :, an emoji. Fill it in and the image is rasterised from the font below, into a file of its own');
  }
  if (spec) {
    // the characters this layer draws decide which fonts can draw it natively
    const need = spec.map((g) => g.char).join('');
    const fontOpts = glyphFamilyOptions().map((o) => {
      const cov = coverageReport(o.value, need);
      const tag = cov.system.length ? ` · lacks ${cov.system.join('')}`
        : (cov.composed.length || cov.alternate.length) ? ` · composes ${[...cov.composed, ...cov.alternate].join('')}` : '';
      return { value: o.value, label: o.label + tag };
    });
    add('Font', ctlSelect(st.font, fontOpts, (v) => {
      apply('font', v);
      ensureFont(v, st.weight).then(() => render());
    }), 'Typeface these images are rasterised from');
    const cov = coverageSummary(st.font, need);
    if (!cov.native) {
      const n = propNote(`${st.font}: ${cov.text}.${cov.system.length ? ' Pick a font marked without “lacks” to keep one typeface.' : ''}`);
      n.classList.add(cov.system.length ? 'warn' : 'info');
      frag.appendChild(n);
    }
    add('Size', num('size', { min: 8 }), 'Height the glyphs are rasterised at, in px');
    add('Fill', ctlSelect(st.fill, GLYPH_FILLS, (v) => apply('fill', v)));
    if (st.fill === 'solid') add('Color', color('color'));
    if (st.fill === 'outline') {
      // the outline is a hollow ring: the fill colour is not used
      add('Outline', color('outlineColor'), 'Colour of the outline ring');
      add('Outline width', num('outlineWidth', { min: 1, max: 24 }));
    }
    if (st.fill === 'gradient') {
      add('From', color('from'));
      add('To', color('to'));
      add('Angle°', num('angle'), '0 = up, 90 = right (CSS degrees)');
    }
    if (st.fill === 'css') {
      add('Gradient', text('css', 'linear-gradient(180deg, #ffd400, #ff2d55)'));
      frag.appendChild(propNote(parseCssGradient(st.css)
        ? 'linear / radial / conic, e.g. linear-gradient(180deg, #ffd400 0%, #ff2d55 100%)'
        : 'not parsed — the glyphs fall back to the flat colour'));
    }
    add('Bold', check('bold', 'Thickens every glyph — works with single-weight fonts too'));
    add('Italic', check('italic', 'Slants every glyph 12°'));
    const btns = mkEl('div', 'rowctl wrap');
    btns.appendChild(ctlButton(files.length ? 'Redraw now' : (spec.length > 1 ? 'Generate images' : 'Generate image'),
      files.length ? 'Rasterise these images again now' : 'Rasterise from this style now', () => {
        pushHistory();
        rerenderGlyphLayers(T);
      }));
    const digitsSrc = sepOnly ? digitLayerFor(e) : null;
    if (digitsSrc) {
      btns.appendChild(ctlButton('Match digits', `Take the font, size and fill of “${digitsSrc.name}”`, () => {
        pushHistory();
        e.glyph = glyphSpecFrom(glyphStyle(digitsSrc));
        refreshPanels();
        rerenderGlyphLayers([e], { quiet: true });
      }));
    }
    add('Redraw', btns);
  }
  // one line on what the images are and what a change does to them
  const notes = [];
  if (imported) notes.push(`Restyling redraws the ${files.length} pictures this layer came with.`);
  else if (canSymbol && sym) notes.push(`Draws “${sym.char}” into ${sym.name || 'a file of its own'}.`);
  else if (canSymbol) notes.push('A regular image layer — type a character in Symbol to draw it from a font instead.');
  const attached = attachedSepGlyphs(e);
  if (attached.length) notes.push(`${attached.map((a) => a.name).join(', ')} follow${attached.length === 1 ? 's' : ''} this style.`);
  if (e.kind === 'IMG_ANIM' && (e.frames || []).some((n) => /(_off|_empty|_blank)\.png$/i.test(n))) notes.push('The …_off blink frames stay blank.');
  const shared = glyphUsersOf((spec || []).map((g) => g.name).filter(Boolean), e);
  if (shared.length) notes.push(`Shared with ${shared.length} other layer${shared.length === 1 ? '' : 's'} — restyling gives this one its own copy.`);
  const nT = T.filter((t) => !!glyphSpecForLayer(t)).length;
  if (nT > 1) notes.push(`Styles are applied to all ${nT} selected image layers.`);
  if (notes.length) frag.appendChild(propNote(notes.join(' ')));
}
function propsGroupTools(sel) {
  const D = dev();
  const tools = (title, defs) => {
    const box = groupBox(title);
    const wrap = document.createElement('div');
    wrap.className = 'aligntools';
    for (const [label, tip, fn] of defs) {
      const b = document.createElement('button');
      b.textContent = label;
      if (tip) b.title = tip;
      b.onclick = fn;
      wrap.appendChild(b);
    }
    box.appendChild(wrap);
    return box;
  };
  const ALIGN = [
    ['Left', 'Align left edges', 'left'],
    ['Center', 'Centre horizontally', 'hcenter'],
    ['Right', 'Align right edges', 'right'],
    ['Top', 'Align top edges', 'top'],
    ['Middle', 'Centre vertically', 'vcenter'],
    ['Bottom', 'Align bottom edges', 'bottom'],
  ];
  const frag = document.createDocumentFragment();
  frag.appendChild(tools('Align to box', ALIGN.map(([label, tip, mode]) => [
    label, `${tip} — relative to the selection's bounding box`, () => alignSel(sel, mode, D, 'box'),
  ])));
  frag.appendChild(tools('Align to device', ALIGN.map(([label, tip, mode]) => [
    label, `${tip.replace(/ edges$/, '')} — moves the whole selection as one block, relative to the device screen`, () => alignSel(sel, mode, D, 'device'),
  ])));
  // Distribute mirrors the reference designer's row: Even spaces the gaps *and*
  // the device margins, Spread puts the first and last on the device edges,
  // Start/End pack the row against that edge.
  const DIST = [
    ['Even', 'Space evenly across the device: equal gaps and equal device margins', 'evenly'],
    ['Spread', 'First layer on the left device edge, last on the right edge', 'between'],
    ['Start', 'Pack the row against the left device edge', 'start'],
    ['End', 'Pack the row against the right device edge', 'end'],
  ];
  const dist = (axis, [label, tip, mode]) => [label, tip, () => distributeSel(sel, axis, mode, D)];
  frag.appendChild(tools('Distribute across', DIST.map((d) => dist('x', d))));
  frag.appendChild(tools('Distribute down', DIST.map((d) => dist('y', d))));
  return frag;
}
// Align the selection: `ref` is the selection's bounding box (default) or the
// whole device screen.
function alignSel(sel, mode, D, ref = 'box') {
  if (sel.length < 2) return;
  pushHistory();
  const boxes = sel.map((e) => ({ e, b: elBox(e) }));
  const U = unionBox(boxes.map((x) => x.b));
  // to the device the selection moves as one block, keeping its inner layout;
  // to its own box each layer lines up individually
  const group = ref === 'device';
  const R = group ? { x: 0, y: 0, w: D.w, h: D.h } : U;
  for (const { e, b: own } of boxes) {
    const b = group ? U : own;
    let dx = 0, dy = 0;
    if (mode === 'left') dx = R.x - b.x;
    else if (mode === 'right') dx = R.x + R.w - (b.x + b.w);
    else if (mode === 'hcenter') dx = R.x + R.w / 2 - (b.x + b.w / 2);
    else if (mode === 'top') dy = R.y - b.y;
    else if (mode === 'bottom') dy = R.y + R.h - (b.y + b.h);
    else if (mode === 'vcenter') dy = R.y + R.h / 2 - (b.y + b.h / 2);
    moveEl(e, Math.round(dx), Math.round(dy));
  }
  refreshPanels(); render(); scheduleCode();
  status(`Aligned ${sel.length} layers to the ${ref === 'device' ? 'device' : 'selection box'}.`);
}
// Distribute the selection along one axis, in *layers-panel order* (top of the
// list first) so a jumbled layout — hour, colon, minute — is never scrambled:
//   evenly  = equal gaps and equal device margins (the row centres on the device)
//   between = first layer on one device edge, last on the other
//   start   = pack against the low edge (left / top)
//   end     = pack against the high edge (right / bottom)
function distributeSel(sel, axis, mode, D) {
  if (sel.length < 2) return;
  const span = axis === 'x' ? D.w : D.h;
  const sizeOf = (b) => (axis === 'x' ? b.w : b.h);
  const posOf = (b) => (axis === 'x' ? b.x : b.y);
  const order = new Map([...elements()].reverse().map((e, i) => [e.id, i]));
  const items = sel.map((e) => ({ e, b: elBox(e) })).sort((a, b) => order.get(a.e.id) - order.get(b.e.id));
  const total = items.reduce((a, o) => a + sizeOf(o.b), 0);
  const slack = span - total;
  const targets = new Map();
  if (mode === 'start') {
    let p = 0;
    for (const o of items) { targets.set(o, Math.round(p)); p += sizeOf(o.b); }
  } else if (mode === 'end') {
    let p = span;
    for (let i = items.length - 1; i >= 0; i--) { p -= sizeOf(items[i].b); targets.set(items[i], Math.round(p)); }
  } else if (mode === 'between') {
    const gap = slack / (items.length - 1);
    let p = 0;
    for (const o of items) { targets.set(o, Math.round(p)); p += sizeOf(o.b) + gap; }
  } else {
    const gap = slack / (items.length + 1);   // n layers → n+1 shares
    let p = gap;
    for (const o of items) { targets.set(o, Math.round(p)); p += sizeOf(o.b) + gap; }
  }
  const moved = items.filter((o) => posOf(o.b) !== targets.get(o)).length;
  if (!moved) {
    status(`Nothing to do — already distributed ${axis === 'x' ? 'across' : 'down'} the device.`);
    return;
  }
  pushHistory();
  for (const [o, p] of targets) {
    const d = p - posOf(o.b);
    moveEl(o.e, axis === 'x' ? Math.round(d) : 0, axis === 'x' ? 0 : Math.round(d));
  }
  refreshPanels(); render(); scheduleCode();
  status(`Distributed ${items.length} layers ${axis === 'x' ? 'across' : 'down'} the device (${moved} moved).`);
}
// kind-specific rows
function propsKind(e) {
  const frag = document.createElement('div');
  const add = (label, ctl, title) => frag.appendChild(ctlRow(label, ctl, title));
  const img = (label, key, title) => add(label, imageField(e, key), title);
  const set = (title, label, opts) => { section(frag, title); frag.appendChild(stackRow(label, imageSetField(e, opts))); };
  const k = kindById(e.kind);
  if (!['IMG', 'TIME_POINTER', 'IMG_WEEK'].includes(e.kind)) section(frag, k ? k.label : 'Widget');
  switch (e.kind) {
    case 'IMG':
      section(frag, 'Image');
      img('Image', 'src');
      add('Angle', ctlNum(e, 'angle', { min: -360, max: 360 }));
      add('Pos X', ctlNum(e, 'posX'));
      add('Pos Y', ctlNum(e, 'posY'));
      // every image layer gets the helper: the Symbol field is how an image is
      // generated from a font (the font rows follow it, see glyphStyleRows)
      glyphStyleRows(frag, add, e);
      break;
    case 'IMG_ANIM':
      add('FPS', ctlNum(e, 'fps', { min: 1, max: 60 }));
      add('Repeat', ctlNum(e, 'repeat', { min: 0 }), '0 = forever');
      add('Step', ctlNum(e, 'step', { min: 1 }));
      // a run of PNGs, or an animated GIF/WebP that is split for you
      set('Frames', 'Frames', { buttons: [ctlButton('Import…',
        'Pick several PNGs to use as frames — or pick an animated GIF / WebP and it is split into one PNG per frame, with the frame rate taken from the file', () => pickAnimFrames(e))] });
      // a blinking colon is a frame list of separator glyphs
      if (isGlyphLayer(e)) glyphStyleRows(frag, add, e);
      break;
    case 'IMG_LEVEL':
    case 'IMG_PROGRESS':
      add('Data', ctlSelect(e.dataType || '', [{ value: '', label: '— static level —' }, ...dtOptions(false)], (v) => {
        e.dataType = v || null;
      }));
      if (!e.dataType) add('Level', ctlNum(e, 'level', { min: 0, max: 100 }));
      if (e.kind === 'IMG_PROGRESS') add('Spread', ctlNum(e, 'spread', { min: 0 }));
      set('Images', 'One image per level');
      glyphStyleRows(frag, add, e);
      break;
    case 'IMG_POINTER':
      add('Data', ctlSelect(e.dataType || '', [{ value: '', label: '— fixed angle —' }, ...dtOptions(false)], (v) => { e.dataType = v || null; }));
      add('Angle', ctlNum(e, 'angle', { min: -360, max: 360 }));
      add('Start', ctlNum(e, 'startAngle', { min: -360, max: 360 }));
      add('End', ctlNum(e, 'endAngle', { min: -360, max: 360 }));
      section(frag, 'Image');
      img('Pointer', 'src', 'The needle, drawn pointing at 12 o’clock; Pivot X/Y is its rotation centre inside this image');
      break;
    case 'IMG_TIME': {
      add('Part', ctlSelect(e.part || 'hour', [
        { value: 'hour', label: 'Hour' }, { value: 'hour12', label: 'Hour (12h)' },
        { value: 'minute', label: 'Minute' }, { value: 'second', label: 'Second' },
      ], (v) => { e.part = v; }));
      const src = followSource(e);
      if ((e.part || 'hour') !== 'hour12') {
        add('Leading 0', ctlCheck(e, 'zero'));
        if (!src) {
          add('Space', ctlNum(e, 'space'));
          add('Align', ctlSelect(e.alignH || 'LEFT', alignOptions(), (v) => { e.alignH = v; }),
            'Where the value sits inside the widget box (hour/minute/second/day/month are 2 digits, a reading is as wide as its data type): Left, centred, or Right — the box stays put, the value moves inside it');
        }
      }
      add('Follow', ctlCheck(e, 'follow'),
        'Follow the previous time part: the watch draws this value directly after it, with its spacing and alignment — so the export sends no startX, space or align for this layer');
      if (src) {
        frag.appendChild(propNote(`Follows “${src.name || src.part}”: placed right after it, with its spacing and alignment.`));
      }
      frag.appendChild(propNote(digitPreviewNote(e)));
      set('Digits', 'Digits 0-9');
      img('Unit', 'unit');
      if ((e.part || 'hour') === 'hour12') {
        img('AM', 'am');
        add('AM X', ctlNum(e, 'amX'));
        add('AM Y', ctlNum(e, 'amY'));
        img('PM', 'pm');
        add('PM X', ctlNum(e, 'pmX'));
        add('PM Y', ctlNum(e, 'pmY'));
      }
      glyphStyleRows(frag, add, e);
      break;
    }
    case 'IMG_DATE':
      add('Part', ctlSelect(e.part || 'day', [{ value: 'day', label: 'Day' }, { value: 'month', label: 'Month' }], (v) => {
        e.part = v;
        if (v !== 'month') e.isCharacter = false;   // only months have names
      }));
      add('Leading 0', ctlCheck(e, 'zero'));
      if (!followSource(e)) add('Space', ctlNum(e, 'space'));
      add('Follow', ctlCheck(e, 'follow'),
        'Follow the previous date part (month → day, the spec\'s 12/04 order): the watch draws this value directly after it, with its spacing and alignment');
      add('Character', characterCheck(e), 'Month name instead of digits');
      if (!followSource(e)) add('Align', ctlSelect(e.alignH || 'LEFT', alignOptions(), (v) => { e.alignH = v; }),
        'Where the value sits inside the widget box: Left, centred, or Right — the box stays put, the value moves inside it');
      frag.appendChild(propNote(digitPreviewNote(e)));
      if (e.isCharacter) {
        set('Month names', '12 images, January first');
        labelRows(add, e, 'month');
      } else {
        set('Digits', 'Digits 0-9');
      }
      glyphStyleRows(frag, add, e);
      break;
    case 'IMG_WEEK':
      set('Weekdays', '7 images, Monday first');
      labelRows(add, e, 'week');
      glyphStyleRows(frag, add, e);
      break;
    case 'TEXT_IMG':
      add('Data', ctlSelect(e.dataType || 'STEP', dtOptions(false), (v) => { e.dataType = v; }));
      add('Spacing', ctlNum(e, 'hSpace', { min: 0 }));
      add('Align', ctlSelect(e.alignH || 'LEFT', alignOptions(), (v) => { e.alignH = v; }),
        'Where the value sits inside the widget box: Left, centred, or Right — the box stays put, the value moves inside it');
      set('Digits', 'Digits 0-9');
      img('Unit', 'unit');
      img('Decimal', 'dot');
      img('Negative', 'negative');
      glyphStyleRows(frag, add, e);
      break;
    case 'TEXT': {
      // Every row here writes to all selected Text layers, so selecting a group
      // restyles the whole group (its children) in one go.
      const T = targetsFor(e, TEXT_KINDS);
      const fill = textFillType(e);
      const addNote = (txt) => frag.appendChild(propNote(txt));
      add('Text', ctlText(T, 'text', 'MONDAY'));
      add('Size', ctlNum(T, 'size', { min: 1 }));
      add('Fill', ctlSelect(fill, TEXT_FILL_TYPES, (v) => setOn(T, 'fillType', v)));
      if (fill === 'solid') add('Color', ctlColor(T, 'color'));
      if (fill === 'outline') {
        add('Color', ctlColor(T, 'color'));
        add('Outline', ctlColor(T, 'outlineColor'));
        add('Outline width', ctlNum(T, 'outlineWidth', { min: 1, max: 24 }));
      }
      if (fill === 'gradient') {
        add('From', ctlColor(T, 'color'));
        add('To', ctlColor(T, 'color2'));
        add('Angle°', ctlNum(T, 'gradAngle', { min: -360, max: 360 }), '0 = up, 90 = right');
      }
      if (fill === 'css') {
        add('Gradient', ctlText(T, 'cssGradient', 'linear-gradient(90deg, #fff, #f0f)'));
        addNote(parseCssGradient(e.cssGradient)
          ? 'linear / radial / conic, e.g. linear-gradient(180deg, #ffd400 0%, #ff2d55 100%)'
          : 'not parsed — the export falls back to the flat colour above');
      }
      add('Bold', ctlCheck(T, 'bold'), 'Picks the boldest face of the font and, on watch, is baked into an image');
      add('Italic', ctlCheck(T, 'italic'), 'Slanted 11°; on watch it is baked into an image');
      add('Font', ctlSelect(e.fontFile || '', fontFileOptions(), (v) => {
        setOn(T, 'fontFile', v);
        const fam = familyForFontFile(v);
        if (fam) ensureFont(fam, e.weight).then(() => render());
        else render();
      }));
      const missing = textMissingChars(e);
      if (missing) {
        const n = propNote(`${familyForFontFile(e.fontFile)} has no ${missing} — ${needsTextBake(e)
          ? 'they are drawn from a system font in the baked image.'
          : 'the watch cannot draw them with this font. Pick a font that has them.'}`);
        n.classList.add('warn');
        frag.appendChild(n);
      }
      add('Weight', ctlSelect(String(e.weight || 400), [
        { value: '300', label: '300 light' }, { value: '400', label: '400 regular' },
        { value: '500', label: '500 medium' }, { value: '600', label: '600 semi bold' },
        { value: '700', label: '700 bold' }, { value: '900', label: '900 black' },
      ], (v) => { setOn(T, 'weight', +v); render(); }));
      add('Align H', ctlSelect(e.alignH || 'CENTER_H', alignOptions(), (v) => setOn(T, 'alignH', v)));
      add('Align V', ctlSelect(e.alignV || 'CENTER_V', [
        { value: 'TOP', label: 'Top' }, { value: 'CENTER_V', label: 'Middle' }, { value: 'BOTTOM', label: 'Bottom' },
      ], (v) => setOn(T, 'alignV', v)));
      add('Line space', ctlNum(T, 'lineSpace'));
      add('Char space', ctlNum(T, 'charSpace'));
      if (T.length > 1) addNote(`Styles are applied to all ${T.length} selected Text layers.`);
      const tm = textMetrics(e);
      const fits = tm.w <= (+e.w || 0) + 1 && tm.h <= (+e.h || 0) + 1;
      addNote(`Text draws ${Math.round(tm.w)}×${Math.round(tm.h)} in a ${Math.round(+e.w || 0)}×${Math.round(+e.h || 0)} box`
        + (fits ? '.' : ' — it is clipped.'));
      if (needsTextBake(e)) {
        addNote(`The watch TEXT widget cannot draw ${bakeReason(e)}: this layer is baked into ${bakedTextName(e)} and emitted as an IMG.`);
      }
      break;
    }
    case 'IMG_STATUS':
      add('Status', ctlSelect(e.status || 'DISCONNECT', SYSTEM_STATUS.map((s) => ({ value: s.key, label: s.label })), (v) => { e.status = v; }));
      img('Icon', 'src');
      break;
    case 'IMG_CLICK':
      add('Action', ctlSelect(e.dataType || 'OUTDOOR_RUNNING', dtOptions(true), (v) => { e.dataType = v; }));
      img('Icon', 'src');
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
      img('Background', 'bg');
      break;
    case 'TIME_POINTER': {
      for (const [key, label] of [['hour', 'Hour'], ['minute', 'Minute'], ['second', 'Second']]) {
        section(frag, `${label} hand`);
        img('Image', key);
        add('Pivot X', ctlNum(e, `${key}PivotX`));
        add('Pivot Y', ctlNum(e, `${key}PivotY`));
      }
      section(frag, 'Centre cap');
      img('Cover', 'cover');
      break;
    }
    default: break;
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
    if (!clockTimer) clockTimer = setInterval(() => { tickClock(); render(); }, 1000);
  } else if (clockTimer) {
    clearInterval(clockTimer); clockTimer = null;
  }
  if (project) renderProps();     // the digit notes say "the live time" or quote the sample
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
    await bakedTextImages();      // gives codegen the baked names for styled text
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
  syncLayersToolbar();
  const has = !!project;
  ['btnComponents', 'btnPresets', 'btnGlyphs', 'btnUpload', 'btnSave', 'btnExportZeus', 'btnBuild', 'btnInstall', 'btnFonts'].forEach((id) => { if ($(id)) $(id).disabled = !has; });
}
function renderProjectPanel() {
  if (!project) return;
  $('inpName').value = project.name || '';
  $('wfSummary').textContent = `${project.name || 'Untitled'} · ${dev().name}`;
  $('inpDesc').value = project.description || '';
  $('inpAppId').value = project.appId || '';
  const dv = dev();
  $('projDeviceName').textContent = dv.name;
  $('projDevice').title = `${dv.label || dv.name} — click to retarget the project to another watch (scales the layout)`;
  $('projLang').value = project.language || '';
  $('projLang').placeholder = 'en-US';
  $('projLang').title = languageSample();
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
  pushHistory();
  project.images = project.images.filter((i) => i.name !== name);
  const scrub = (e) => {
    for (const key of ['src', 'unit', 'dot', 'negative', 'hour', 'minute', 'second', 'cover', 'bg', 'am', 'pm']) if (e[key] === name) e[key] = '';
    for (const key of ['images', 'frames']) if (Array.isArray(e[key])) e[key] = e[key].filter((n) => (typeof n === 'string' ? n : n.name) !== name);
  };
  for (const e of elements()) scrub(e);
  imgCache.delete(name);
  setDirty(true);
  undoToast(`Deleted ${name} (and cleared the layers that used it).`);
  refreshPanels(); render(); scheduleCode();
}
$('btnPruneImages').onclick = () => {
  const used = new Set();
  collectUsedImages(used);
  const unused = project.images.filter((i) => !used.has(i.name));
  if (!unused.length) { status('No unused images.'); return; }
  pushHistory();
  project.images = project.images.filter((i) => used.has(i.name));
  setDirty(true);
  undoToast(`Removed ${unused.length} unused image${unused.length === 1 ? '' : 's'}.`);
  refreshPanels(); render(); scheduleCode();
};

// ---------------------------------------------------------------- selection --
function deleteElements(list) {
  if (!list.length) return;
  const ids = new Set(list.map((e) => e.id));
  pushHistory();
  project.elements = project.elements.filter((e) => !ids.has(e.id));
  if (ids.has(selectedId)) selectedId = null;
  multiSel = new Set([...multiSel].filter((id) => !ids.has(id)));
  setDirty(true);
  const names = list.map(layerLabel).join(', ');
  undoToast(`Deleted ${list.length} layer${list.length === 1 ? '' : 's'} (${names}).`);
  refreshPanels(); render(); scheduleCode();
}
function deleteSelection() { deleteElements(selection()); }
// A duplicated clock owns its separator images. `colon.png` (and dot / negative /
// percent / degree / am / pm) are fixed design names shared by every layer that
// points at them, so a copy that kept sharing them could not be restyled on its
// own; the copy gets its own file (`colon_2.png`). Digit sets stay shared — they
// fork by themselves when they are restyled (see regenerateGlyphs).
function duplicateSeparatorImages(el) {
  const map = new Map();
  const fresh = (name) => {
    if (!name) return name;
    if (map.has(name)) return map.get(name);
    const meta = imgMeta(name);
    if (!meta || !separatorGlyphFor(name)) return name;      // not a separator: keep sharing
    const copyName = uniqImageName(name);
    project.images.push({ name: copyName, width: meta.width, height: meta.height, url: meta.url });
    map.set(name, copyName);
    return copyName;
  };
  for (const key of ['src', 'unit', 'dot', 'negative', 'am', 'pm']) if (el[key]) el[key] = fresh(el[key]);
  for (const key of ['images', 'frames']) if (Array.isArray(el[key])) el[key] = el[key].map(fresh);
  return [...map.values()];
}
function duplicateSelection() {
  const sel = selection();
  if (!sel.length) return;
  pushHistory();
  const taken = new Set(elements().map((e) => e.name));
  // duplicating a whole group gives the copies a group of their own, named
  // "<group> copy", so the two can be moved and restyled independently
  const gid = commonGroup(sel);
  let newGid = null;
  if (gid) {
    newGid = `g${Date.now().toString(36)}`;
    project.groups = project.groups || {};
    project.groups[newGid] = uniqName(`${groupName(gid)} copy`, new Set(Object.values(project.groups)));
  }
  const newImages = [];
  const copies = sel.map((e) => {
    const copy = JSON.parse(JSON.stringify(e));
    copy.id = `el${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
    copy.name = uniqName(`${e.name} copy`, taken);
    taken.add(copy.name);
    moveEl(copy, 12, 12);
    copy.group = newGid;
    newImages.push(...duplicateSeparatorImages(copy));
    project.elements.push(copy);
    return copy;
  });
  selectedId = copies[copies.length - 1].id;
  multiSel = new Set(copies.map((c) => c.id));
  refreshPanels(); render(); scheduleCode();
  const parts = [];
  if (gid) parts.push(`group “${project.groups[newGid]}”`);
  if (newImages.length) parts.push(newImages.join(', '));
  status(`Duplicated ${copies.length} layer${copies.length === 1 ? '' : 's'}${parts.length ? ' — ' + parts.join(' · ') : ''}.`);
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
// the layers toolbar mirrors what the current selection can do
function syncLayersToolbar() {
  if (!$('btnDup')) return;
  const sel = selection();
  for (const id of ['btnToFront', 'btnForward', 'btnBackward', 'btnToBack', 'btnDup', 'btnDelLayers']) $(id).disabled = !sel.length;
  $('btnGroup').disabled = sel.length < 2;
  $('btnUngroup').disabled = !sel.some((e) => e.group);
  $('layersSelInfo').textContent = sel.length > 1 ? `${sel.length} selected` : sel.length ? layerLabel(sel[0]) : 'No selection';
}
{
  const mod = /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl+';
  const tools = [
    ['btnToFront', ICON.toFront, `Bring to front (${mod}Shift+])`, () => reorderSelection('front')],
    ['btnForward', ICON.forward, `Bring forward (${mod}])`, () => reorderSelection('forward')],
    ['btnBackward', ICON.backward, `Send backward (${mod}[)`, () => reorderSelection('backward')],
    ['btnToBack', ICON.toBack, `Send to back (${mod}Shift+[)`, () => reorderSelection('back')],
    ['btnDup', ICON.dup, `Duplicate (${mod}D)`, duplicateSelection],
    ['btnGroup', ICON.group, `Group (${mod}G)`, groupSelection],
    ['btnUngroup', ICON.ungroup, `Ungroup (${mod}Shift+G)`, ungroup],
    ['btnDelLayers', ICON.trash, 'Delete (Delete / Backspace)', deleteSelection],
  ];
  for (const [id, icon, title, fn] of tools) {
    const b = $(id);
    b.innerHTML = icon;
    b.title = title;
    b.setAttribute('aria-label', title);
    b.onclick = fn;
  }
}

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
    // a component added from the menu starts in Normal only; AOD is opt-in
    // (presets too — Show in / Shift+B opts the selection into AOD)
    show: 'normal',
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
  if (kindId === 'IMG_POINTER') {
    e.centerX = Math.round(d.w / 2);
    e.centerY = Math.round(d.h / 2);
  } else if (CENTER_KINDS.has(kindId)) {
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
  if (kindId === 'IMG_TIME' || kindId === 'IMG_DATE' || kindId === 'TEXT_IMG' || kindId === 'IMG_LEVEL' || kindId === 'IMG_PROGRESS' || kindId === 'IMG_WEEK') {
    await attachDigitSet(e);
  }
  refreshPanels(); render(); scheduleCode();
  return e;
}
async function attachDigitSet(e) {
  try {
    if (labelKind(e)) {
      rememberGlyphStyle(e, 40);
      e.images = await genLabelSet(e, labelKind(e));
    } else {
      const prefix = nextDigitPrefix();
      const names = await genGlyphImages('0123456789'.split('').map((c, i) => ({ tag: String(i), char: c })), { prefix });
      if (e.kind === 'IMG_LEVEL' || e.kind === 'IMG_PROGRESS') e.images = names.slice(0, 10);
      else e.images = names;
      // remember what the set was drawn with, so Properties shows the real values
      rememberGlyphStyle(e, +glyphOpts.size);
    }
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
// Weekday / month names, drawn with the layer's own glyph style. The seven (or
// twelve) images share one cell — as wide as the widest name, as tall as the
// tallest accent — with each name placed by the layer's label alignment, so
// switching days never makes the label jump. A layer that owns its set
// redraws it in place; otherwise it gets a set of its own (week2_w1.png …).
async function genLabelSet(e, kind) {
  const el = e || { kind: kind === 'week' ? 'IMG_WEEK' : 'IMG_DATE', isCharacter: kind === 'month' };
  const labels = kind === 'week' ? weekNames(el) : monthNames(el);
  const t = kind === 'week' ? 'w' : 'm';
  const pre = ownLabelPrefix(el, kind) || nextLabelPrefix(kind);
  const st = glyphStyle(el);
  return genGlyphImages(labels.map((l, i) => ({ tag: `${t}${i + 1}`, char: l, name: `${pre}_${t}${i + 1}.png` })), {
    prefix: pre, mono: true, replace: true, size: st.size, family: st.font, weight: st.weight,
    variations: st.variations, style: st, align: el.labelAlign || 'center',
  });
}
// A separator (colon.png, degree.png …) drawn with the digits' style and in
// their exact cell: same font size, same cell height, same baseline. Placed at
// the digits' Y it sits where the typeface puts it — no guessed offsets.
async function genUnit(tag, char, { style = null } = {}) {
  const st = style || digitStyleOf([]);
  const names = await genGlyphImages([{ tag, char, name: `${tag.replace(/[^\w\-]+/g, '_')}.png` }], {
    mono: false, size: st.size, family: st.font, weight: st.weight, variations: st.variations,
    style: st, metricsRef: DIGIT_METRICS,
  });
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
  glyphMenuItem(m, 'Digit set 0-9', `the selected layer, else a loose set`, async () => {
    const t = selection().find((x) => x.kind === 'IMG_TIME' || x.kind === 'TEXT_IMG' || x.kind === 'IMG_DATE' || x.kind === 'IMG_LEVEL' || x.kind === 'IMG_PROGRESS');
    const prefix = nextDigitPrefix();
    const names = await genGlyphImages('0123456789'.split('').map((c, i) => ({ tag: String(i), char: c, name: `${prefix}_${i}.png` })),
      { prefix, replace: true });
    if (t) {
      pushHistory();
      t.images = names.slice(0, 10);
      rememberGlyphStyle(t, +glyphOpts.size);
      selectedId = t.id; multiSel = new Set([t.id]);
      status(`Generated the 0-9 set of “${t.name}” from ${glyphFont}.`);
    } else {
      status(`Generated ${names.length} loose digit images from ${glyphFont} — pick them under a layer's Images.`);
    }
    refreshPanels(); render(); scheduleCode();
  });
  glyphMenuItem(m, 'Weekday set', 'the selected layer, else a loose set', async () => {
    const t = selection().find((x) => x.kind === 'IMG_WEEK');
    const names = await genLabelSet(t || null, 'week');
    if (t) {
      pushHistory();
      t.images = names;
      rememberGlyphStyle(t, 40);
      selectedId = t.id; multiSel = new Set([t.id]);
      status(`Generated “${t.name}”'s ${names.length} weekday images (${languageOf(t)}).`);
    } else {
      status(`Generated the ${names.length} loose weekday images (${projectLanguage()}).`);
    }
    refreshPanels(); render(); scheduleCode();
  });
  glyphMenuItem(m, 'Separators (: . % - ° /)', 'one image each', async () => {
    const entries = [['colon', ':'], ['dot', '.'], ['percent', '%'], ['negative', '-'], ['degree', '°'], ['slash', '/']];
    // in the style of the selected digit layer, so they match it out of the box
    const src = selection().find((x) => DIGIT_SET_KINDS.has(x.kind) && (x.images || []).length);
    const style = src ? glyphStyle(src) : null;
    for (const [tag, ch] of entries) await genUnit(tag, ch, { style });
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
      const e = newElement('FILL_RECT', { x: 0, y: 0, w: d.w, h: d.h, color: '#000000', radius: 0, name: 'Background', locked: true, show: 'normal' });
      project.elements.unshift(e);
      status('Added a black background (locked).');
      break;
    }
    case 'clock': return clockPreset(false);
    case 'clocksec': return clockPreset(true);
    case 'analog': return analogPreset();
    case 'weekday': return weekdayPreset();
    case 'day':
    case 'month': {
      pushHistory();
      const digits = await ensureDigitNames();
      const e = newElement('IMG_DATE', { part: id, images: digits, zero: 0, show: 'normal', x: cx - 30, y: cy, name: id === 'month' ? 'Month' : 'Day' });
      project.elements.push(e); selectedId = e.id; multiSel = new Set([e.id]);
      break;
    }
    case 'steps': return dataTextPreset('STEP', 'Steps', null);
    case 'hr': return dataTextPreset('HEART', 'Heart rate', ['bpm', 'bpm']);
    case 'cal': return dataTextPreset('CAL', 'Calories', null);
    case 'battery': return dataTextPreset('BATTERY', 'Battery', ['percent', '%']);
    case 'temp': return dataTextPreset('WEATHER_CURRENT', 'Temperature', ['degree', '°'], ['negative', '-']);
    case 'distance': return dataTextPreset('DISTANCE', 'Distance', null, null, true);
    case 'spo2': return dataTextPreset('SPO2', 'Blood oxygen', ['percent', '%']);
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
      pushHistory();
      const digits = await ensureDigitNames();
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
  const style = digitStyleOf(digits);
  const colon = await genUnit('colon', ':', { style });
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
      els.push(newElement('IMG', { src: colon, show: 'normal', x, y: Math.round((d.h - colonH) / 2), w: 0, h: 0, name: colonCount === 1 ? 'Colon' : 'Colon 2', glyph: glyphSpecFrom(style) }));
    } else {
      els.push(newElement('IMG_TIME', { part: part.t, images: digits, zero: part.t === 'hour' ? 0 : 1, space: 0, show: 'normal', x, y, name: part.t.charAt(0).toUpperCase() + part.t.slice(1), glyph: glyphSpecFrom(style) }));
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
  const e = newElement('IMG_WEEK', { images: [], show: 'normal', y: Math.round(d.h * 0.2), name: 'Weekday' });
  rememberGlyphStyle(e, 40);
  e.images = await genLabelSet(e, 'week');
  const m = imgMeta(e.images[0]);
  e.x = Math.round(d.w / 2) - (m ? Math.round(m.width / 2) : 30);
  project.elements.push(e); selectedId = e.id; multiSel = new Set([e.id]);
  refreshPanels(); render(); scheduleCode();
}
async function dataTextPreset(dataType, label, unit, negative, useDot) {
  pushHistory();
  const d = dev();
  const digits = await ensureDigitNames();
  const cell = imgMeta(digits.find(Boolean));
  const cw = cell ? cell.width : 30, ch = cell ? cell.height : 44;
  // separators are generated after the digits, at the digits' cell height, so a
  // colon/degree keeps the reading's proportions (a [tag, char] spec defers the
  // rasterisation until the height is known; a plain string is an existing file)
  const style = digitStyleOf(digits);
  const asUnit = async (spec) => (Array.isArray(spec) ? genUnit(spec[0], spec[1], { style }) : spec);
  const unitName = await asUnit(unit);
  const negativeName = await asUnit(negative);
  const dotName = useDot ? await genUnit('dot', '.', { style }) : '';
  const e = newElement('TEXT_IMG', {
    dataType, images: digits, hSpace: Math.max(1, Math.round(cw * 0.06)),
    unit: unitName || '', negative: negativeName || '', dot: dotName,
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
    ? `Seven images, index 0 = Monday (the watch picks one per weekday) · ${languageOf(e)}`
    : 'Drag the handle to reorder · index 0 is the first frame (digit 0, weather icon 0 …)';
  // the generator buttons belong to the layer this dialog was opened from
  const months = e.kind === 'IMG_DATE' && !!e.isCharacter;
  $('ismGenDigits').textContent = months ? 'Month names' : 'Digits 0-9';
  $('ismGenDigits').hidden = e.kind === 'IMG_WEEK';
  $('ismGenWeek').hidden = e.kind !== 'IMG_WEEK';
  const hint = setHint(e.kind, { ...e, images: ismState.entries });
  $('ismHint').hidden = !hint;
  $('ismHint').textContent = hint || '';
  ismRender();
  $('imgSetModal').hidden = false;
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
    const meta = imgMeta(name);
    const dims = mkEl('span', 'dims', meta ? `${meta.width}×${meta.height}` : 'missing');
    if (!meta) row.classList.add('missing');
    const rm = document.createElement('button');
    rm.className = 'rm'; rm.textContent = '×'; rm.title = 'Remove';
    rm.onclick = () => { ismState.entries.splice(i, 1); ismRender(); };
    row.appendChild(grip); row.appendChild(idx); row.appendChild(thumb); row.appendChild(nm); row.appendChild(dims); row.appendChild(rm);
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
  openImagePicker($('ismAdd'), {
    multi: true,
    onPick: (names) => { if (!ismState) return; ismState.entries.push(...names); ismRender(); },
  });
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
  }
  ismRender(); refreshPanels();
};
$('ismGenDigits').onclick = async () => {
  try {
    const e = ismState.e;
    if (e.kind === 'IMG_DATE' && e.isCharacter) {
      ismState.entries = await genLabelSet(e, 'month');
      status(`Generated the 12 month names in ${languageOf(e)} ${e.labelForm || 'short'} form.`);
    } else {
      const prefix = nextDigitPrefix();
      const names = await genGlyphImages('0123456789'.split('').map((c, i) => ({ tag: String(i), char: c, name: `${prefix}_${i}.png` })),
        { prefix, replace: true });
      ismState.entries = names;
      status(`Generated a 0-9 set from ${glyphFont} (${prefix}).`);
    }
    ismRender(); refreshPanels();
  } catch (err) { status(String(err.message || err), true); }
};
$('ismGenWeather').onclick = () => {
  const names = weatherNamesIfAny();
  if (!names.length) { status('No 29-icon weather set found. Import images named like weather_0.png … weather_28.png first.', true); return; }
  ismState.entries = names; ismRender();
};
$('ismGenWeek').onclick = async () => {
  const e = ismState.e;
  try {
    ismState.entries = await genLabelSet(e, 'week');
    ismRender(); refreshPanels();
    status(`Generated the 7 weekday names in ${languageOf(e)} ${e.labelForm || 'short'} form.`);
  } catch (err) { status(String(err.message || err), true); }
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
// ---------------------------------------------- frame sequences / GIF split --
// One row in Properties: a run of PNGs becomes the frame list, and an animated
// GIF (or WebP) is split into one PNG per frame with the browser's own decoder,
// so the frame rate comes from the file's own delays. A still picture — even one
// saved as .gif — is simply a single frame.
let framesTarget = null;
function pickAnimFrames(e) {
  framesTarget = e;
  $('framesInput').click();
}
$('framesInput').onchange = async (ev) => {
  const files = [...(ev.target.files || [])];
  ev.target.value = '';
  const e = framesTarget;
  framesTarget = null;
  if (!files.length || !e) return;
  try {
    const one = files.length === 1 ? files[0] : null;
    const animated = !!one && (/^image\/(gif|webp|avif)/i.test(one.type || '') || /\.(gif|webp|avif)$/i.test(one.name || ''));
    // an animated file splits itself; anything else is used as-is
    if (!(animated && await splitGifInto(e, one))) await addFrameFiles(e, files);
  } catch (err) { status('Could not import those frames: ' + (err.message || err), true); }
};
function animPrefixForLayer(e) {
  return (e.animPrefix || String(e.name || 'anim')).toLowerCase().replace(/[^\w]+/g, '_') || 'anim';
}
// returns the number of frames it split out, 0 when the file holds a single one
async function splitGifInto(e, file) {
  if (typeof ImageDecoder === 'undefined') throw new Error('this build cannot decode animations');
  const data = new Uint8Array(await file.arrayBuffer());
  const dec = new ImageDecoder({ data, type: file.type || 'image/gif' });
  await dec.tracks.ready;
  const track = dec.tracks.selectedTrack;
  const count = track ? track.frameCount : 0;
  if (!count || count < 2) {
    if (dec.close) dec.close();
    return 0;                       // not an animation: the caller adds it as one frame
  }
  pushHistory();
  const prefix = animPrefixForLayer(e);
  // frames this layer had before: those names are its own, so replace them in place
  const prev = new Set(e.frames || []);
  const frames = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const { image } = await dec.decode({ frameIndex: i });
    total += +image.duration || 0;
    const c = document.createElement('canvas');
    c.width = image.displayWidth; c.height = image.displayHeight;
    c.getContext('2d').drawImage(image, 0, 0);
    if (image.close) image.close();
    const name = `anim/${prefix}_${i}.png`;
    frames.push(addProjectImage(name, c, { replace: prev.has(name) }).name);
  }
  if (dec.close) dec.close();
  await loadAllImages();
  e.animPrefix = prefix;
  e.frames = frames;
  const ms = total / count / 1000;
  if (ms > 0) e.fps = Math.max(1, Math.min(60, Math.round(1000 / ms)));
  selectedId = e.id;
  refreshPanels(); render(); scheduleCode();
  status(`Split ${file.name} into ${frames.length} frames · ${e.fps || 30} fps from the file's delays.`);
  return frames.length;
}
async function addFrameFiles(e, files) {
  const prefix = animPrefixForLayer(e);
  const canvases = [];
  for (const f of files) {
    if (!/^image\//i.test(f.type || '')) continue;
    const url = URL.createObjectURL(f);
    const img = await loadImgEl(url);
    URL.revokeObjectURL(url);
    if (!img) continue;
    canvases.push(composeFit(img, 'asis', 0.5, 0.5, dev().w, dev().h));
  }
  if (!canvases.length) { status('Those files are not images the designer can read.', true); return; }
  pushHistory();
  const prev = new Set(e.frames || []);
  const frames = canvases.map((c, i) => {
    const name = `anim/${prefix}_${i}.png`;
    return addProjectImage(name, c, { replace: prev.has(name) }).name;
  });
  await loadAllImages();
  e.animPrefix = prefix;
  e.frames = frames;
  selectedId = e.id;
  refreshPanels(); render(); scheduleCode();
  status(`“${e.name}” now has ${frames.length} frame${frames.length === 1 ? '' : 's'}.`);
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
// align/snap targets from the other widgets — `exclude` is an id, or every id
// of a group being dragged (a group must never snap to its own members)
function alignTargets(exclude) {
  const skip = new Set(Array.isArray(exclude) ? exclude : (exclude == null ? [] : [exclude]));
  const xs = [], ys = [];
  for (const e of elements()) {
    if (skip.has(e.id) || e.visible === false) continue;
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
function snapBox(boxX, boxY, boxW, boxH, exclude) {
  const d = dev();
  const cx = d.w / 2, cy = d.h / 2;
  const al = alignTargets(exclude);
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
    if (e.visible === false || e.locked || offView(e)) continue;
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
    drag = { mode: 'resize', before: snapshot(), handle, e, px: p.x, py: p.y, startX: +e.x || 0, startY: +e.y || 0, startW: b.w, startH: b.h, startRadius: +e.radius || 60, cx: +e.centerX || 0, cy: +e.centerY || 0 };
    return;
  }
  const hit = hitElement(ev);
  const additive = ev.ctrlKey || ev.metaKey || ev.shiftKey;
  if (!hit) {
    if (additive) return;   // a slipped Ctrl-click must not drop the selection
    selectedId = null; multiSel = new Set();
    refreshPanels(); render();
    return;
  }
  if (additive) {
    // Ctrl / ⌘ / Shift-click toggles the layer in the selection
    if (multiSel.has(hit.id)) {
      multiSel.delete(hit.id);
      if (selectedId === hit.id) selectedId = [...multiSel].pop() || null;
    } else { multiSel.add(hit.id); selectedId = hit.id; }
    refreshPanels(); render();
    return;
  }
  if (!(selectedId === hit.id || multiSel.has(hit.id))) { selectedId = hit.id; multiSel = new Set([hit.id]); }
  else selectedId = hit.id;
  refreshPanels(); render();
  drag = {
    mode: 'move', before: snapshot(), e: hit, px: p.x, py: p.y,
    startBox: elBox(hit),
    mates: selection().filter((m) => m.id !== hit.id && !m.locked).map((m) => ({ el: m, box: elBox(m) })),
  };
});
window.addEventListener('mousemove', (ev) => {
  if (!drag || !project) return;
  const p = eventDevPos(ev);
  if (drag.mode === 'move') {
    const rawDx = p.x - drag.px, rawDy = p.y - drag.py;
    // A group (or any multi-selection) is dragged *and snapped* as one box, so
    // the snap aid belongs to the group's bounding box, not to the layer that
    // happens to be under the cursor.
    const mates = drag.mates.filter((m) => !m.locked);
    const group = mates.length ? unionBox([drag.startBox, ...mates.map((m) => m.box)]) : drag.startBox;
    let boxX = group.x + rawDx, boxY = group.y + rawDy;
    if (showGrid) {
      const skip = [drag.e.id, ...mates.map((m) => m.el.id)];
      const s = snapBox(boxX, boxY, group.w, group.h, skip);
      boxX = s.x; boxY = s.y;
    } else guides = { v: [], h: [] };
    const dx = Math.round(boxX - group.x), dy = Math.round(boxY - group.y);
    if (drag.dx !== dx || drag.dy !== dy) {
      moveEl(drag.e, dx - (drag.dx || 0), dy - (drag.dy || 0));
      for (const m of mates) moveEl(m.el, dx - (drag.dx || 0), dy - (drag.dy || 0));
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
  const before = drag.before;
  drag = null;
  if (project) commitHistory(before);
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
// a click on the empty workspace around the device deselects (the side panels
// act on the selection, so they never do)
document.querySelector('main').addEventListener('mousedown', (ev) => {
  if (!project || ev.target.closest('#cv, .panel-c, button, input, select, textarea, a, .meta-status') || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return;
  if (!selectedId && !multiSel.size) return;
  selectedId = null; multiSel = new Set();
  refreshPanels(); render();
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
  if (project) { render(); renderLayers(); }
  syncLayerView();
  // an empty AOD is why a watch shows its own AOD face instead of yours
  if (project && mode === 'aod' && !elements().some((e) => e.visible !== false && showAllowed(e.show, 'aod'))) {
    status('Nothing is shown in AOD — the watch would use its own default AOD face. Set the layers that should stay on to “Both” (or “AOD only”).');
  }
}
function syncLayerView() {
  const cur = layerFocus ? previewMode : 'all';
  document.querySelectorAll('#layersView button').forEach((b) => b.classList.toggle('on', b.dataset.view === cur));
}
document.querySelectorAll('#layersView button').forEach((b) => {
  b.onclick = () => {
    const v = b.dataset.view;
    layerFocus = v !== 'all';
    if (layerFocus) {
      // layers outside the view become unselectable: drop them from the selection
      setPreviewMode(v);
      multiSel = new Set([...multiSel].filter((id) => { const e = elementById(id); return e && !offView(e); }));
      if (selectedId && !multiSel.has(selectedId)) selectedId = [...multiSel].pop() || null;
      refreshPanels(); render();
    }
    else { syncLayerView(); if (project) renderLayers(); }
  };
});
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
    vender: 'dialcraft',
    description: '',
    font: glyphFont,
    language: 'en-US',
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
$('btnNew').onclick = async () => { if (await guardUnsaved()) openNewFaceDialog(); };
$('btnEmptyNew').onclick = openNewFaceDialog;
$('btnEmptyOpenProject').onclick = () => $('btnOpen').click();
$('projDevice').onclick = openConvertDialog;
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
  clearBakeCache();
  selectedId = null; multiSel = new Set();
  past = []; future = []; updateHistoryButtons(); setDirty(true);
  resetTestData();
  glyphFont = project.font;
  $('projFont').value = glyphFont;
  setEmptyState(); refreshPanels(); render();
  if (template === 'digital') { await clockPreset(false); }
  else if (template === 'analog') { await analogPreset(); }
  else if (template === 'health') {
    await dataTextPreset('STEP', 'Steps', null);
    await dataTextPreset('HEART', 'Heart rate', ['bpm', 'bpm']);
    await dataTextPreset('BATTERY', 'Battery', ['percent', '%']);
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
    if (e.kind === 'CIRCLE' || e.kind === 'ARC_PROGRESS' || e.kind === 'TIME_POINTER' || e.kind === 'IMG_POINTER') {
      // a pointer's x/y is the pivot inside its image, which keeps its size
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
$('btnCloseProject').onclick = async () => {
  if (!await guardUnsaved()) return;
  project = null; selectedId = null; multiSel = new Set();
  imgCache.clear();
  past = []; future = []; updateHistoryButtons();
  setEmptyState(); refreshPanels(); renderRecents(); updateTitle();
  status('');
};
$('inpName').oninput = (ev) => { if (!project) return; project.name = ev.target.value; setDirty(true); scheduleCode(); };
$('inpDesc').oninput = (ev) => { if (!project) return; project.description = ev.target.value; setDirty(true); scheduleCode(); };
$('inpAppId').oninput = (ev) => { if (!project) return; project.appId = +ev.target.value || 0; setDirty(true); scheduleCode(); };
// The language decides how weekday and month names are written when a glyph set
// is generated (Intl, so every locale the browser knows works — no table here).
$('projLang').onchange = (ev) => {
  if (!project) return;
  const v = ev.target.value.trim();
  if (v && !localeKnown(v)) {
    status(`“${v}” is not a language tag this browser knows (try ro-RO, de-DE, ja-JP…).`, true);
    ev.target.value = project.language || '';
    return;
  }
  pushHistory();
  project.language = v || 'en-US';
  setDirty(true);
  refreshPanels();
  status(`Project language: ${projectLanguage()} — ${languageSample()}. Existing sets keep their images until they are re-rendered.`);
};
function languageSample() {
  const w = localeNames('week', projectLanguage(), 'short');
  const m = localeNames('month', projectLanguage(), 'short');
  return `Mon → ${w[0]}, January → ${m[0]}, Sunday → ${localeNames('week', projectLanguage(), 'long')[6]}`;
}
function buildLangSuggest() {
  const list = $('langSuggest');
  if (!list) return;
  list.innerHTML = '';
  for (const tag of LANGUAGE_SUGGESTIONS) {
    const o = document.createElement('option');
    o.value = tag;
    list.appendChild(o);
  }
}
buildLangSuggest();
$('projFont').onchange = (ev) => {
  glyphFont = ev.target.value || DEFAULT_GLYPH_FONT;
  if (project) { project.font = ev.target.value; scheduleCode(); buildGlyphsMenu(); }
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
  clearBakeCache();
  customFonts.length = 0;
  for (const f of res.fonts || []) await registerCustomFont(f, { quiet: true });
  fillFontSelect($('projFont'));
  buildFontList();
  glyphFont = project.font && fontFamilies().includes(project.font) ? project.font : DEFAULT_GLYPH_FONT;
  $('projFont').value = project.font && fontFamilies().includes(project.font) ? project.font : '';
  selectedId = null; multiSel = new Set(); groupCollapsed = new Set();
  past = []; future = []; updateHistoryButtons(); setDirty(false);
  resetTestData();
  await loadAllImages();
  setEmptyState(); refreshPanels(); render(); scheduleCode();
  if (res.imported) {
    // An imported Zeus CLI / Watchface Maker folder keeps its source untouched:
    // no save path, so Save asks where to put the designer project.
    setDirty(true);
    const src = res.source || '';
    status(`Imported “${project.name}” — ${project.elements.length} layers, ${project.images.length} images.`);
    openLogModal(`Imported “${project.name}”`, src,
      `${dev().name} · the source folder was not changed`);
    appendLog((res.report || []).join('\n'));
    return;
  }
  status(`Opened “${project.name}” (${project.elements.length} layers, ${project.images.length} images).`);
}
$('btnOpen').onclick = async () => {
  if (!await guardUnsaved()) return;
  const res = await API.openProjectDialog();
  if (!res) return;
  if (res.error) { status(res.error, true); return; }
  await loadProject(res);
};
// Import… is the same door with an import-shaped dialog; Open already accepts a
// watchface folder, this just makes the feature findable.
async function importFaceDialog() {
  if (!await guardUnsaved()) return;
  const res = await API.openProjectDialog({
    title: 'Import a watchface folder',
    buttonLabel: 'Import',
    message: 'Pick a Zepp OS watchface project folder (app.json + watchface/ + assets/)',
    force: true,
  });
  if (!res) return;
  if (res.error) { status(res.error, true); return; }
  await loadProject(res);
}
if ($('btnImport')) $('btnImport').onclick = importFaceDialog;
if ($('btnEmptyImport')) $('btnEmptyImport').onclick = importFaceDialog;
async function doSave() {
  if (!project) return false;
  const payload = {
    // bakedImage/bakedKey are derived at export time and must not be persisted
    project: { ...project, fonts: projectFontsPayload(), elements: elements().map(stripBakeKeys) },
    images: projectImagesPayload(),
    fonts: fontRecords(),
    savePath: project.savePath || null,
    previewBase64: composePreviewB64(),
  };
  const res = await API.saveProject(payload);
  if (!res) return false;
  project.savePath = res.savePath;
  setDirty(false);
  status(`Saved → ${res.savePath}`);
  renderRecents();
  return true;
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
    const ico = document.createElement('span');
    ico.className = 'ri-ico ' + r.kind; ico.innerHTML = ICON.folder;
    const main = document.createElement('div');
    main.className = 'ri-main';
    const top = document.createElement('div');
    top.className = 'ri-top';
    const nm = document.createElement('span');
    nm.className = 'ri-name'; nm.textContent = r.name || String(r.path).split(/[\\/]/).pop();
    const badge = document.createElement('span');
    badge.className = 'ri-badge ' + (r.exists ? r.kind : 'gone');
    badge.textContent = !r.exists ? 'Missing' : r.kind === 'project' ? 'Project' : 'Imported';
    badge.title = !r.exists ? 'The folder was moved or deleted'
      : r.kind === 'project' ? 'A saved designer project (.wfproj.json) on disk'
        : 'A Zepp OS / Watchface Maker folder opened as-is — Save it to keep it as a project';
    top.appendChild(nm); top.appendChild(badge);
    const pth = document.createElement('div');
    pth.className = 'ri-path';
    const dv = DEVICES.find((x) => x.target === r.device);
    const shown = r.home && String(r.path).startsWith(r.home) ? '~' + String(r.path).slice(r.home.length) : r.path;
    pth.textContent = [dv && dv.name, r.at && ago(r.at), shown].filter(Boolean).join(' · ');
    main.appendChild(top); main.appendChild(pth);
    const rm = document.createElement('button');
    rm.type = 'button'; rm.className = 'ri-x'; rm.innerHTML = ICON.x;
    rm.title = 'Remove from this list (the folder is not deleted)';
    rm.onclick = async (ev) => { ev.stopPropagation(); await API.recentRemove(r.path); renderRecents(); };
    d.appendChild(ico); d.appendChild(main); d.appendChild(rm);
    const open = async () => {
      const res = await API.openProjectPath(r.path);
      if (res && res.error) { status(res.error, true); return; }
      if (res) await loadProject(res);
    };
    // a folder that was moved or deleted stays listed: say what is wrong instead
    // of leaving a dead row behind
    d.onclick = r.exists ? open : () => status(`That project folder is gone: ${r.path}`, true);
    list.appendChild(d);
  }
}
// "3 min ago", "2 days ago"
function ago(t) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const dd = Math.round(h / 24);
  return dd < 30 ? `${dd} day${dd === 1 ? '' : 's'} ago` : new Date(t).toLocaleDateString();
}
$('recentClear').onclick = async () => { await API.recentClear(); renderRecents(); };

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
  const payload = { project, images: await exportImagesPayload(), fonts: fontRecords(), previewBase64: composePreviewB64() };
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
  const payload = { project, images: await exportImagesPayload(), fonts: fontRecords(), previewBase64: composePreviewB64() };
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
// The AOD pixel budget, measured rather than estimated: draw the screen-off
// state and count the pixels that are not (near) black. Summing layer boxes
// double-counted overlaps and dark pictures (a face could read "156% lit").
function aodLitFraction() {
  const d = dev();
  const cv = document.createElement('canvas');
  cv.width = d.w; cv.height = d.h;
  const c = cv.getContext('2d', { willReadFrequently: true });
  const prev = exportRender;
  exportRender = true;
  drawScene(c, d.w, d.h, 'aod', false);
  exportRender = prev;
  const px = c.getImageData(0, 0, d.w, d.h).data;
  let lit = 0;
  for (let i = 0; i < px.length; i += 4) if (Math.max(px[i], px[i + 1], px[i + 2]) > 40) lit++;
  return lit / (d.w * d.h);
}
function lintProject() {
  const out = [];
  const d = dev();
  const add = (level, message) => out.push({ level, message });
  if (!project.name || !project.name.trim()) add('warn', 'The watchface has no name — the store requires one.');
  if (!project.appId || project.appId < 1) add('error', 'Set an App id (1 … 9999999) before exporting.');
  if (!project.elements.length) add('warn', 'There are no layers yet.');
  const taken = new Set();
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
    if (e.kind === 'TEXT' && needsTextBake(e)) {
      add('info', `“${label}”: ${bakeReason(e)} is baked into images/${bakedTextName(e)} — the watch TEXT widget can only draw a flat colour.`);
      const m = textMetrics(e);
      if (m.w > (+e.w || 0) + 1 || m.h > (+e.h || 0) + 1) {
        add('warn', `“${label}”: the text needs ${Math.round(m.w)}×${Math.round(m.h)} but the layer box is ${Math.round(+e.w || 0)}×${Math.round(+e.h || 0)} — the baked image clips it.`);
      }
    }
    if (e.kind === 'TEXT' && textFillType(e) === 'css' && !parseCssGradient(e.cssGradient)) {
      add('warn', `“${label}”: the CSS gradient could not be read — the flat colour is used instead.`);
    }
    if (e.kind === 'TEXT' && e.fontFile) {
      const fam = familyForFontFile(e.fontFile);
      const known = customFonts.some((f) => f.name === e.fontFile) || BUNDLED_FONTS.some((f) => baseName(f.file) === e.fontFile);
      if (!known) add('error', `“${label}” uses the font ${e.fontFile}, which is not in the project — re-import it.`);
      else if (!fam) add('info', `“${label}”: ${e.fontFile} will be copied into assets/${d.assetDir}/fonts/ for the build.`);
    }
    if (e.kind === 'TEXT' && textMissingChars(e)) {
      add(needsTextBake(e) ? 'info' : 'warn', `“${label}”: ${familyForFontFile(e.fontFile)} has no ${textMissingChars(e)} — ${needsTextBake(e)
        ? 'a system font fills them in in the baked image' : 'the watch cannot draw them with this font'}.`);
    }
    if (e.kind === 'IMG_ANIM' && showAllowed(e.show, 'aod')) add('warn', `“${label}” is an animation shown in AOD — the spec discourages that.`);
    if (e.kind === 'TIME_POINTER' && e.second && showAllowed(e.show, 'aod')) {
      add('error', `“${label}” shows the second hand in AOD — the spec forbids it.`);
    }
    if (e.kind === 'ARC_PROGRESS' && e.dataType && !(dtByKey(e.dataType) && dtByKey(e.dataType).reader)) {
      add('info', `“${label}”: ${e.dataType} has no automatic reader instance in the generated code — set the level by hand.`);
    }
  }
  const ratio = aodLitFraction();
  if (ratio > 0.10) add('warn', `${Math.round(ratio * 100)}% of the screen is lit in AOD — the spec asks for under 10%.`);
  // Digit / reading layers that overlap: the usual cause is a glyph size raised
  // after the preset placed the layers, so each cell grew and the parts now run
  // into each other — which reads as stray strokes from the neighbouring glyph.
  const glyphish = (e) => DIGIT_SET_KINDS.has(e.kind) || e.kind === 'IMG_WEEK' || (e.kind === 'IMG' && isGlyphLayer(e));
  const shown = project.elements.filter((e) => e.visible !== false && glyphish(e) && e.show !== 'edit');
  const clash = [];
  for (let i = 0; i < shown.length; i++) {
    for (let j = i + 1; j < shown.length; j++) {
      const a = shown[i], b = shown[j];
      const bothNormal = showAllowed(a.show, 'normal') && showAllowed(b.show, 'normal');
      const bothAod = showAllowed(a.show, 'aod') && showAllowed(b.show, 'aod');
      if (!bothNormal && !bothAod) continue;
      const ba = elBox(a), bb = elBox(b);
      const ox = Math.min(ba.x + ba.w, bb.x + bb.w) - Math.max(ba.x, bb.x);
      const oy = Math.min(ba.y + ba.h, bb.y + bb.h) - Math.max(ba.y, bb.y);
      if (ox > 2 && oy > 2) clash.push({ a, b, ox: Math.round(ox), oy: Math.round(oy) });
    }
  }
  for (const c of clash.slice(0, 3)) {
    add('warn', `“${c.a.name}” and “${c.b.name}” overlap by ${c.ox}×${c.oy} px — images run into each other (raise the glyph size before placing a clock, or select the row and use Distribute ▸ Start to pack it).`);
  }
  // Without a single layer that draws in the screen-off state the watch has
  // nothing to show and falls back to its own AOD face.
  if (!elements().some((e) => e.visible !== false && showAllowed(e.show, 'aod'))) {
    add('warn', 'Nothing is shown in AOD — the watch will fall back to its own default AOD face. Set the layers that should stay on to “Both” (or “AOD only”).');
  }
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
// The layers the font modal generates for: the selection, when it can carry
// glyphs. Generation is per component — a digit set belongs to the layer it was
// drawn for, never to the project as a whole.
function glyphTargets() {
  return selection().filter((e) => e.kind === 'IMG' || isGlyphLayer(e));
}
function updateFontTarget() {
  const el = $('fontTarget');
  if (!el) return;
  const targets = glyphTargets();
  el.className = 'row small';
  if (!targets.length) {
    el.textContent = 'Select a layer first — glyphs are generated for the selected component.';
    return;
  }
  const first = targets[0];
  const k = kindById(first.kind);
  const label = targets.length === 1
    ? `“${first.name}” (${k ? k.label : first.kind})`
    : `${targets.length} selected layers`;
  const names = first.kind === 'IMG_WEEK'
    ? ` · names ${(first.labelForm || 'short')}, case ${labelCaseOf(first)}, language ${languageOf(first)}`
    : (first.kind === 'IMG_DATE' && first.isCharacter ? ` · month names in ${languageOf(first)}` : '');
  el.textContent = `Generating for ${label}${names}.`;
}
// weekday / month wording lives on the layer, so the modal offers it too, and the
// generator button says what it will draw for this particular component
function syncFontTargetRows() {
  if (!$('fontNames')) return;
  const targets = glyphTargets();
  const t = targets[0];
  const isWeek = !!t && t.kind === 'IMG_WEEK';
  const isMonth = !!t && t.kind === 'IMG_DATE' && t.isCharacter;
  const labeling = isWeek || isMonth;
  // .row is a grid, so the `hidden` attribute cannot do this
  $('fontNamesRow').style.display = labeling ? '' : 'none';
  $('fontCaseRow').style.display = labeling ? '' : 'none';
  $('fontGenWeek').style.display = isWeek ? '' : 'none';
  $('fontGenSet').style.display = isWeek ? 'none' : '';
  const setBtn = $('fontGenSet');
  if (isMonth) { setBtn.textContent = 'Month names'; setBtn.title = 'Rasterize the 12 month names in the wording above'; }
  else if (t && DIGIT_SET_KINDS.has(t.kind)) { setBtn.textContent = 'Digits 0-9'; setBtn.title = "Rasterize this set's 0-9 images from the typeface above"; }
  else if (t) { setBtn.textContent = 'Redraw images'; setBtn.title = "Rasterize this layer's images (symbols, separators) from the typeface above"; }
  else { setBtn.textContent = 'Digits 0-9'; setBtn.title = 'Select a layer first'; }
  if (!labeling) return;
  $('fontNames').value = t.labelForm || 'short';
  $('fontCase').value = labelCaseOf(t);
}
function applyTargetLabels(patch) {
  const targets = glyphTargets().filter((t) => t.kind === 'IMG_WEEK' || (t.kind === 'IMG_DATE' && t.isCharacter));
  if (!targets.length) return;
  pushHistory();
  for (const t of targets) Object.assign(t, patch);
  const first = (targets[0].images || [])[0] || '';
  updateFontTarget();
  refreshPanels(); render(); scheduleCode();
  if (WEEK_FILE_RE.test(first) || MONTH_FILE_RE.test(first)) {
    rerenderGlyphLayers(targets, { quiet: true }).then((n) => {
      updateFontTarget(); refreshPanels(); render();
      status(`Redrew ${n} layer${n === 1 ? '' : 's'} with the new names (${labelCaseOf(targets[0]) || 'as generated'}).`);
    });
  } else {
    status('These images are kept until you press “Weekdays” — then they are drawn with the new names.');
  }
}
function openFontModal() {
  $('fontModal').hidden = false;
  const targets = glyphTargets();
  const first = targets[0];
  // seed the form with the component's own glyph style, so pressing a generator
  // button reproduces what the layer already looks like
  if (first) {
    const st = glyphStyle(first);
    $('fontSize').value = String(st.size);
    $('fontColor').value = st.color;
    if (fontWeightOption(st.weight)) $('fontWeight').value = String(st.weight);
    $('fontVariation').value = st.variations || '';
    if (fontFamilies().includes(st.font)) fontSelFamily = st.font;
  }
  fontSelFamily = (fontSelFamily && fontFamilies().includes(fontSelFamily)) ? fontSelFamily : glyphFont;
  buildFontList();
  renderFontPreview();
  updateFontTarget();
  syncFontTargetRows();
}
function fontWeightOption(w) {
  const sel = $('fontWeight');
  return [...sel.options].some((o) => +o.value === +w);
}
function buildFontTargetSelects() {
  const fill = (id, options) => {
    const sel = $(id);
    if (!sel) return;
    sel.innerHTML = '';
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = o.value; opt.textContent = o.label;
      sel.appendChild(opt);
    }
  };
  fill('fontNames', LABEL_FORMS);
  fill('fontCase', LABEL_CASES);
}
buildFontTargetSelects();
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
  // how each font copes with the letters of the project language (ă ș ț …)
  const lang = projectLanguage();
  const need = project ? languageChars(lang) : '';
  const row = (family, meta) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'font-row' + (family === fontSelFamily ? ' on' : '');
    const n = document.createElement('span'); n.className = 'f-name'; n.textContent = family;
    const s = document.createElement('span'); s.className = 'f-meta'; s.textContent = meta;
    b.appendChild(n); b.appendChild(s);
    if (need) {
      const cov = coverageSummary(family, need);
      const badge = mkEl('span', 'f-cov ' + (cov.native ? 'ok' : cov.system.length ? 'miss' : 'comp'),
        cov.native ? '✓' : cov.system.length ? '✕' : '≈');
      badge.title = cov.native ? `Draws every ${lang} letter (${need})` : `${lang}: ${cov.text}`;
      b.appendChild(badge);
    }
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
  const w1 = c.measureText('10:09').width;      // in the specimen font, before the label font
  c.font = '11px -apple-system, sans-serif';
  c.fillStyle = '#5b6b80';
  c.fillText(`← ${Math.round(w1)}px wide`, Math.min(14 + w1 + 10, cv.width - 110), 64);
  // digit row + accents
  c.fillStyle = color;
  setFontOn(c, family, row, weight, variations);
  c.fillText('0123456789', 14, 128);
  // the project's own weekday / month words, drawn the way the glyph images
  // will be (letters the font lacks composed from its own glyphs)
  setFontOn(c, family, small, weight, variations);
  c.textBaseline = 'alphabetic';
  const lang = projectLanguage();
  const wk = weekNames({}), mo = monthNames({});
  const longDay = applyLabelCase(localeNames('week', lang, 'long')[5] || '', 'upper');
  const line1 = `${wk[5]} 17 ${mo[9]} · ${longDay}`;
  const need = languageChars(lang);
  const line2 = `${need ? need + '  ' : ''}: . % - ° /  75%`;
  runFill(c, layoutRun(c, family, line1), 14, 172 + small * 0.35);
  runFill(c, layoutRun(c, family, line2), 14, 206 + small * 0.35);
  const cov = need ? coverageSummary(family, need) : { native: true };
  $('fontInfo').textContent = !active
    ? `${family} could not be loaded in this session.`
    : cov.native
      ? `Rasterizing glyphs with ${family}${need ? ` — every ${lang} letter is in the font` : ''}. A Text layer can also ship this file so the watch draws live text with it.`
      : `${family} · ${lang}: ${cov.text}.`;
  $('fontInfo').classList.toggle('warn', !cov.native);
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
$('fontUseGlyph').onclick = async () => {
  const targets = glyphTargets();
  if (targets.length) {
    // per component: the selected layers draw their glyphs with this typeface
    pushHistory();
    for (const t of targets) t.glyph = { ...(t.glyph || {}), font: fontSelFamily };
    const done = await rerenderGlyphLayers(targets, { quiet: true });
    updateFontTarget(); refreshPanels(); render(); scheduleCode();
    status(done ? `“${targets[0].name}” now draws its glyphs with ${fontSelFamily}.` : `${fontSelFamily} is set for ${targets.length} layer(s).`,
      !done);
    return;
  }
  useGlyphFont(fontSelFamily);
  status(`Glyphs now come from ${glyphFont}.`);
};
for (const id of ['fontSize', 'fontColor', 'fontWeight', 'fontVariation']) {
  // remember the settings so the loose-set actions reuse them
  $(id).oninput = () => { glyphOpts = fontForm(); renderFontPreview(); };
  $(id).onchange = () => { glyphOpts = fontForm(); renderFontPreview(); };
}
$('fontNames').onchange = () => applyTargetLabels({ labelForm: $('fontNames').value });
$('fontCase').onchange = () => applyTargetLabels({ labelCase: $('fontCase').value });
async function fontGen(what) {
  if (!fontSelFamily) return;
  const o = fontForm();
  // Analog hands and the dial are project artwork that a pointer links by name,
  // so they stay project-wide. Everything else is drawn for the component.
  if (what === 'hands') { await ensureHands(); status('Generated hour/minute/second hand images.'); refreshPanels(); render(); return; }
  if (what === 'dial') { await ensureDial(); status('Generated dial.png.'); refreshPanels(); render(); return; }
  const targets = glyphTargets();
  if (!targets.length) {
    status('Select a layer first — glyphs are generated for the selected component.', true);
    return;
  }
  pushHistory();
  for (const t of targets) {
    // keep whatever else the layer's glyph style carries (outline, gradient …)
    t.glyph = { ...(t.glyph || {}), font: fontSelFamily, size: o.size, color: o.color, weight: o.weight, variations: o.variations };
    if (t.kind === 'IMG_WEEK' && !t.labelForm) t.labelForm = 'short';
  }
  try {
    const done = await rerenderGlyphLayers(targets, { quiet: true });
    updateFontTarget(); syncFontTargetRows(); refreshPanels(); render(); scheduleCode();
    const what2 = targets[0].kind === 'IMG_WEEK' ? 'weekday images' : (targets[0].kind === 'IMG_DATE' && targets[0].isCharacter) ? 'month names' : 'glyphs';
    status(done
      ? `Drew ${targets.length === 1 ? `“${targets[0].name}”'s` : `${targets.length} layers'`} ${what2} from ${fontSelFamily} at ${o.size}px.`
      : 'Nothing to draw here — a layer needs a digit/weekday set, a separator or a Symbol before glyphs can be rasterised for it.', !done);
  } catch (e) { status(String(e.message || e), true); }
}
$('fontGenSet').onclick = () => fontGen('set');
$('fontGenWeek').onclick = () => fontGen('week');
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
// The Zepp App's Developer-Mode scanner does not take a plain web URL: the QR
// payload is the same host/path with the scheme swapped for `zpkd1://`. Checked
// against a QR the community tools hand out —
//   zpkd1://amazfitwatchfaces.com/dl/bip/zip/45655/x.zip?zpk=…&comp=Bip_6
// The app puts a fetchable scheme back and pulls the file; a plain-HTTP LAN
// address with a port installs fine on the watch (verified with the official
// app). Zepp's own Watchface Maker uses a cloud scheme instead:
//   watchface://api-mifit-cn2.huami.com/custom/tools/app-dial/download/<token>
function zpkdUrl(url) { return url ? String(url).replace(/^https?:\/\//i, 'zpkd1://') : null; }
// what the QR actually encodes: package → zpkd1://, landing page → plain http
function instQrPayload(st) {
  const url = instUrlFor(st);
  if (!url) return null;
  return instQrWhat === 'install' ? zpkdUrl(url) : url;
}
async function updateInstallQr() {
  const st = instLast;
  const payload = instQrPayload(st);
  const img = $('instQr');
  const enc = $('instEncoded');
  if (!payload) {
    img.hidden = true;
    $('instQrEmpty').hidden = false;
    $('instQrEmpty').textContent = st && st.port ? 'No package on the server yet — press “Build & serve”.' : 'Start the server to get a QR code';
    $('instQrHint').textContent = '';
    if (enc) enc.textContent = '—';
    syncInstallButtons();
    return;
  }
  const data = await API.qr({ text: payload, width: 400 });
  if (data && img.src !== data) img.src = data;
  img.hidden = !data;
  $('instQrEmpty').hidden = !!data;
  if (!data) $('instQrEmpty').textContent = 'Could not render the QR code';
  $('instQrHint').textContent = instQrWhat === 'install'
    ? 'Zepp App → Developer Mode → scan.'
    : 'Any camera: opens the download page.';
  if (enc) enc.textContent = payload;
  syncInstallButtons();
}
function syncInstallButtons() {
  const running = !!(instLast && instLast.running);
  $('instStop').disabled = !running || instBusy;
  $('instBuild').disabled = instBusy || !project;
  $('instServe').disabled = instBusy || !project;
  const url = instUrlFor(instLast);
  $('instCopy').disabled = !url;
  $('instOpen').disabled = !url;
  const enc = $('instCopyEncoded');
  if (enc) enc.disabled = !instQrPayload(instLast);
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
async function installPayload() {
  return {
    project: { ...project, fonts: projectFontsPayload() },
    images: await exportImagesPayload(),
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
    const br = await API.installBuild(await installPayload());
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
  const res = await API.installStart(await installPayload());
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
$('instCopyEncoded').onclick = () => { const p = instQrPayload(instLast); if (p) copyText(p); };
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
  fillDeviceSelect($('newFaceDevice'));
  $('newFaceDevice').value = DEVICES[0].target;
  glyphFont = $('projFont').value || DEFAULT_GLYPH_FONT;
  buildComponentsMenu();
  buildPresetsMenu();
  buildGlyphsMenu();
  resetTestData();
  renderTestData();
  setPreviewMode('normal');
  setLiveClock(true);
  setEmptyState();
  API.onCloseRequest(async () => {
    // a failure in the prompt must never leave the window impossible to close
    let ok = true;
    try { ok = await guardUnsaved(); } catch (e) { ok = true; }
    if (ok) API.closeConfirmed(); else API.closeCancelled();
  });
  API.onBuildLog((line) => { appendLog(line); if (!$('installModal').hidden) instLogLine(line); });
  API.onLanRequest((req) => {
    if ($('installModal').hidden) return;
    instLogLine(`${req.method} ${req.url} → ${req.status} ${req.label || ''}${req.ip ? '  (' + String(req.ip).replace(/^::ffff:/, '') + ')' : ''}`);
  });
  // Animation preview: the draw code reads animTick in 1/30 s units, so advance
  // it from the wall clock and sample at ~30 Hz. (Sampling at 120 ms made a
  // 30 fps animation look like ~8 fps, next to nothing like the export.)
  let animClock = 0;
  setInterval(() => {
    if (exportRender || !project) return;
    const now = performance.now();
    const dt = animClock ? Math.min(0.5, (now - animClock) / 1000) : 0;
    animClock = now;
    if (!elements().some((e) => e.kind === 'IMG_ANIM' && e.visible !== false)) return;
    animTick += dt * 30;
    render();
  }, 33);
}
init().catch((e) => {
  document.body.innerHTML = `<pre style="padding:24px;color:#ffb4b4">Failed to start: ${e && e.message ? e.message : e}</pre>`;
});

