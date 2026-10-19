'use strict';
// Import an existing Zepp OS watchface project into the designer model.
//
// Accepts exactly what the watch runs: a Zeus CLI project folder
// (app.json + watchface/<target>/index.js + assets/<target>/…) or an official
// Watchface Maker export, in the v3 (@zos/ui) or v2 (global hmUI) shape.
//
//   const { project, images, fonts, report } = importFaceDir(dir);
//
// The widget calls in the watchface code are *executed* against a capture shim,
// so helper functions, constants, loops and image arrays resolve the same way
// they do on the watch — no regex parsing of the source. Anything the designer
// cannot author is listed in report instead of being dropped silently.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { PNG } = require('pngjs');
const { DEVICES } = require('./devices');
const { newElement } = require('./kinds');
const { dataType } = require('./datatypes');
const { fontInfoFromBuffer, fontFormat, isFontFile } = require('./fonts');
const { isSomh, somhToPng } = require('./somh');

// Zepp widget name -> designer kind. Anything missing here is reported.
const WIDGET_KIND = {
  IMG: 'IMG', IMG_ANIM: 'IMG_ANIM', IMG_LEVEL: 'IMG_LEVEL', IMG_PROGRESS: 'IMG_PROGRESS',
  IMG_POINTER: 'IMG_POINTER', IMG_TIME: 'IMG_TIME', IMG_WEEK: 'IMG_WEEK', IMG_DATE: 'IMG_DATE',
  TIME_POINTER: 'TIME_POINTER', TEXT: 'TEXT', TEXT_IMG: 'TEXT_IMG',
  IMG_STATUS: 'IMG_STATUS', IMG_CLICK: 'IMG_CLICK',
  FILL_RECT: 'FILL_RECT', STROKE_RECT: 'STROKE_RECT', CIRCLE: 'CIRCLE', ARC: 'ARC',
  ARC_PROGRESS: 'ARC_PROGRESS',
};
// Widget calls that create no layer: WIDGET_DELEGATE carries the watchface
// lifecycle callbacks (resume_call / pause_call), so there is nothing to draw
// and nothing to map. They are counted on their own instead of being listed
// with the widgets the designer cannot author.
const NON_VISUAL = {
  WIDGET_DELEGATE: 'the watchface refresh on resume / pause',
};
// constants handed to widgets; the shim turns `ui.show_level.ONLY_AOD` into the
// string "show_level.ONLY_AOD" so the name survives the capture
const CONST_GROUPS = new Set(['widget', 'align', 'align_v', 'align_h', 'data_type', 'show_level',
  'prop', 'text_style', 'anim_status', 'system_status', 'id', 'event']);
const TIME_PARTS = ['hour', 'minute', 'second'];
const DATE_PARTS = ['month', 'day'];
const IMAGE_EXT = /\.(png|jpe?g|webp|bmp|svg)$/i;
// hmSensor.id.X -> designer data type, for a widget whose picture follows a
// reading (only the ids that map onto a level-style image set are listed).
const SENSOR_LEVEL = {
  STEP: 'STEP', STEP_TOTAL: 'STEP', CALORIE: 'CAL', CAL: 'CAL', DISTANCE: 'DISTANCE',
  HEART: 'HEART', HEART_RATE: 'HEART', BLOOD_OXYGEN: 'SPO2', SPO2: 'SPO2',
  STRESS: 'STRESS', STAND: 'STAND', FAT_BURNING: 'FAT_BURNING', FLOOR: 'FLOOR',
  BATTERY: 'BATTERY', PAI: 'PAI_DAILY', ALTITUDE: 'ALTITUDE',
};

// ---------------------------------------------------------------- utilities --
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch (e) { return null; }
}
function walk(dir, out = []) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { return out; }
  for (const n of names) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const full = path.join(dir, n);
    let st = null;
    try { st = fs.statSync(full); } catch (e) { continue; }
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const num = (v) => (Number.isFinite(+v) ? +v : undefined);
// newElement spreads the patch over the kind defaults, so an undefined value
// would wipe the default — drop them instead
function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null) out[k] = v;
  return out;
}
function hexOf(v) {
  if (typeof v === 'string' && /^#/.test(v)) {
    return v.length === 4 ? '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3] : v;
  }
  const n = num(v);
  return n === undefined ? undefined : '#' + (n & 0xffffff).toString(16).padStart(6, '0');
}
// "ui.align.LEFT" / "hmUI.data_type.STEP" / "widget.IMG_TIME" -> { group, key }
function parseConst(v) {
  if (typeof v !== 'string') return null;
  const m = /^(?:\w+\.)?([a-z_]+)\.([A-Za-z_0-9]+)$/.exec(v.trim());
  return m ? { group: m[1], key: m[2] } : null;
}
function nameOf(v) {
  const c = parseConst(v);
  return c ? c.key : (typeof v === 'string' ? v : undefined);
}
function alignOf(v) {
  const k = nameOf(v);
  return ['LEFT', 'CENTER_H', 'RIGHT', 'TOP', 'BOTTOM', 'CENTER_V'].includes(k) ? k : undefined;
}
// show_level: 1 normal, 2 aod, 4 edit; no show_level means "draw in every state".
// `a | b` on two shim strings evaluates to 0, which is exactly that case.
function showOf(v) {
  const k = nameOf(v);
  if (k === 'ONLY_NORMAL') return 'normal';
  if (k === 'ONLY_AOD' || k === 'ONAL_AOD') return 'aod';
  if (k === 'ONLY_EDIT' || k === 'EDIT') return 'edit';
  const n = num(v);
  if (n === 1) return 'normal';
  if (n === 2) return 'aod';
  if (n === 4) return 'edit';
  return 'both';
}

// ------------------------------------------------------------------- shim ----
// A permissive stand-in: callable, constructable, and every property either a
// constant name (for the groups above) or another permissive. That lets the
// watchface code run untouched — sensors, hm* globals, helpers — while every
// widget call lands in `calls`.
function makeShim(calls, notes, opts = {}) {
  const log = notes || [];
  // the reading the code is currently looking at (hmSensor.createSensor(…)):
  // a widget can pick its picture from it, which is how a runtime index is
  // traced back to a data type
  let sensor;
  const mk = (tag, name) => {
    const fn = function () { return mk(tag, name); };
    return new Proxy(fn, {
      get(_t, prop) {
        if (typeof prop === 'symbol') {
          // The shim stands for a value only the watch knows. Text stays empty
          // so a name built around it does not turn to junk, but a *number*
          // has to be NaN: `Math.floor(step / 10)` then reads `ring_NaN.png`
          // instead of quietly picking index 0.
          if (prop === Symbol.toPrimitive) return (hint) => (hint === 'number' ? NaN : '');
          // an empty iterator, so `for (… of shim)` walks nothing instead of
          // throwing inside the watchface's own try/catch
          if (prop === Symbol.iterator) return () => ({ next: () => ({ done: true, value: undefined }) });
          return undefined;
        }
        const key = String(prop);
        // the value ends up in a template literal / number somewhere: keep the
        // shim printable so nothing throws "cannot convert object to primitive"
        if (key === 'toString' || key === 'valueOf' || key === 'then') return key === 'then' ? undefined : () => '';
        if (key === 'createWidget') return createWidget;
        // the Maker toolchain hands the page in as DeviceRuntimeCore.WatchFace
        if (key === 'WatchFace') return record;
        if (CONST_GROUPS.has(key)) return mk(key, `${name}.${key}`);
        if (CONST_GROUPS.has(tag)) return `${tag}.${key}`;
        return mk(tag, `${name}.${key}`);
      },
      set() { return true; },
      apply(_t, _this, args) {
        if (/(^|\.)createSensor$/.test(name)) sensor = args && args.length ? args[0] : undefined;
        return mk(tag, `${name}()`);
      },
      construct() { return mk(tag, `new ${name}`); },
    });
  };
  const createWidget = (type, params) => {
    let p = {};
    try { p = JSON.parse(JSON.stringify(params || {})); } catch (e) { p = { ...(params || {}) }; }
    const entry = { type: nameOf(type) || String(type), params: p, sensor };
    calls.push(entry);
    const inst = mk('widgetInstance', 'widget');
    // setProperty(hmUI.prop.VISIBLE, v) is how a face lights one of two labels
    // (AM / PM): remember the last value so the import can tell which hour shows it
    return new Proxy(inst, {
      get(t, prop, r) {
        if (prop === 'setProperty') {
          return (key, val) => { if (/VISIBLE/.test(String(key))) entry.visible = !!val; return undefined; };
        }
        return Reflect.get(t, prop, r);
      },
    });
  };
  const sandbox = {
    createWidget,
    record,
    console: { log: note, warn: note, error: note, info: note },
    print() {},
    px: (n) => n,
    vp: (n) => n,
    // a fixed clock, so a face that branches on the hour can be run at 09:00 and 15:00
    Date: (() => {
      const Real = Date;
      if (opts.hour == null) return Real;
      return class extends Real {
        constructor(...a) { if (a.length) super(...a); else super(2024, 0, 1, opts.hour, 0, 0); }
        static now() { return new Real(2024, 0, 1, opts.hour, 0, 0).getTime(); }
      };
    })(),
    setTimeout: () => 0,
    setInterval: () => 0,
    clearTimeout() {},
    clearInterval() {},
  };
  let config = null;
  function record(c) { if (c && typeof c === 'object') config = c; return c; }
  // watchface code often wraps everything in its own try/catch; surfacing what
  // it logged is the only way to explain an empty capture
  function note(...args) {
    for (const a of args) {
      const msg = a instanceof Error ? a.message : (a && typeof a === 'object' && typeof a.stack === 'string' ? a.message : null);
      if (!msg) continue;
      const line = `the watchface code stopped with: ${msg}`;
      if (!log.includes(line)) log.push(line);
    }
  }
  sandbox.WatchFace = record;
  sandbox.App = (c) => c;
  sandbox.Page = (c) => c;
  for (const group of CONST_GROUPS) sandbox[group] = mk(group, group);
  for (const g of ['hmUI', 'hmSensor', 'hmBle', 'hmApp', 'hmFS', 'hmTimer', 'hmSetting', 'ui', 'log',
    'Time', 'Battery', 'Step', 'Calorie', 'HeartRate', 'BloodOxygen', 'Stress', 'Pai', 'Barometer',
    'FatBurning', 'Stand', 'Distance', 'Sleep', 'Weather', 'WorldClock', 'Alarm', 'Countdown',
    'Stopwatch', 'SunRiseSet', 'createTimer', 'stopTimer', 'Timer']) {
    sandbox[g] = mk(g, g);
  }
  return {
    sandbox,
    getConfig: () => config,
    reset() { calls.length = 0; config = null; sensor = undefined; },
    mk,
  };
}

function stripModule(code) {
  return String(code)
    .replace(/^\s*import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?[ \t]*$/gm, '')
    .replace(/^\s*import\s+['"][^'"]+['"];?[ \t]*$/gm, '')
    .replace(/^\s*export\s+\{[^}]*\};?[ \t]*$/gm, '')
    .replace(/^\s*export\s+default\s+/gm, '')
    .replace(/^\s*export\s+/gm, '');
}

// Run the watchface source and collect the widget calls. A missing global (a
// sensor class or runtime helper the shim does not know) is stubbed and the run
// retried — whether the reference error reached us or was logged by the face's
// own try/catch — so an unfamiliar API never loses the whole capture.
function capture(code, opts = {}) {
  const calls = [];
  const notes = [];
  const attemptNotes = [];
  const { sandbox, getConfig, reset, mk } = makeShim(calls, attemptNotes, opts);
  const context = vm.createContext(sandbox);
  const source = stripModule(code);
  let error = null;
  let script = null;
  // Wrapped in a function: a retry re-runs the same source, and top-level
  // `const`/`let`/`class` would otherwise collide on the second run.
  const wrapped = `(function () {\n${source}\n})();`;
  try { script = new vm.Script(wrapped, { filename: 'watchface.js' }); } catch (e) {
    return { calls, error: String((e && e.message) || e), notes };
  }
  const stub = (name) => { sandbox[name] = mk(name, name); };
  for (let attempt = 0; attempt < 16; attempt++) {
    attemptNotes.length = 0;
    reset();
    let thrownMiss = null;
    try {
      script.runInContext(context, { timeout: 4000 });
      error = null;
    } catch (e) {
      const msg = String((e && e.message) || e);
      const m = /^([\w$]+) is not defined$/.exec(msg);
      if (m && !(m[1] in sandbox)) thrownMiss = m[1];
      else error = msg;
    }
    const missing = new Set();
    if (thrownMiss) missing.add(thrownMiss);
    for (const n of attemptNotes) {
      const m = /stopped with: ([\w$]+) is not defined$/.exec(n);
      if (m) missing.add(m[1]);
    }
    const todo = [...missing].filter((n) => !(n in sandbox));
    if (!todo.length) break;
    for (const n of todo) { stub(n); notes.push(`stubbed the unknown global \`${n}\``); }
  }
  for (const n of attemptNotes) if (!notes.includes(n)) notes.push(n);
  // build() registers the widgets; the designer's own export splits the work
  // into initView() + build() { this.initView() }, so only the outermost entry
  // is called (calling both would capture every widget twice).
  const config = getConfig();
  if (config) {
    if (typeof config.onInit === 'function') {
      try { config.onInit.call(config); } catch (e) { error = `onInit(): ${String((e && e.message) || e)}`; }
    }
    const entry = ['build', 'initView'].find((fn) => typeof config[fn] === 'function');
    if (entry) {
      try { config[entry].call(config); } catch (e) { error = `${entry}(): ${String((e && e.message) || e)}`; }
    }
  } else if (!error) {
    error = 'no WatchFace({ … }) call found in the file';
  }
  return { calls, error, notes };
}

// ------------------------------------------------------------------ assets ---
// Every image reference in the source, so the asset root can be picked by what
// actually resolves (v3 keeps them under assets/<target>/images, v2 under
// assets/default/img, hand-written projects put them straight in assets/).
function collectRefs(calls) {
  const refs = new Set();
  const visit = (v) => {
    if (typeof v === 'string') { if (IMAGE_EXT.test(v)) refs.add(v); return; }
    if (Array.isArray(v)) { v.forEach(visit); return; }
    if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  for (const c of calls) visit(c.params);
  return [...refs];
}
function assetIndex(root) {
  const byRel = new Map();
  for (const f of walk(root)) byRel.set(path.relative(root, f).split(path.sep).join('/'), f);
  return { root, byRel };
}
// a widget path is relative to the asset root; the designer stores bare names
// and re-adds `images/` on export
function relIn(index, ref) {
  if (!ref || typeof ref !== 'string') return null;
  const clean0 = ref.replace(/^\.\//, '');
  const tries = [clean0, clean0.replace(/^images\//, ''), clean0.split('/').pop()];
  for (const t of tries) if (index.byRel.has(t)) return t;
  const base = tries[tries.length - 1];
  const hits = [...index.byRel.keys()].filter((k) => k.split('/').pop() === base);
  return hits.length === 1 ? hits[0] : null;
}

// ------------------------------------------------------------------ device ---
function deviceFor(appJson, report) {
  const targets = Object.values((appJson && appJson.targets) || {});
  const sources = [];
  let designWidth = 0;
  for (const t of targets) {
    if (!designWidth && Number.isFinite(+t.designWidth)) designWidth = +t.designWidth;
    for (const p of t.platforms || []) if (Number.isFinite(+p.deviceSource)) sources.push(+p.deviceSource);
  }
  // the flat v2 shape keeps platforms/designWidth at the top level
  if (!designWidth && Number.isFinite(+(appJson && appJson.designWidth))) designWidth = +appJson.designWidth;
  for (const p of (appJson && appJson.platforms) || []) {
    if (Number.isFinite(+p.deviceSource)) sources.push(+p.deviceSource);
  }
  const bySource = DEVICES.find((d) => (d.sources || []).some((s) => sources.includes(s)));
  if (bySource) {
    report.push(`Device: ${bySource.name} (${bySource.target}) — from app.json deviceSource ${sources.join('/')}`);
    return bySource;
  }
  const byWidth = designWidth ? (DEVICES.find((d) => d.w === designWidth && !d.secondary)
    || DEVICES.find((d) => d.w === designWidth)) : null;
  if (byWidth) {
    report.push(`Device: ${byWidth.name} (${byWidth.target}) — guessed from designWidth ${designWidth}, check Properties`);
    return byWidth;
  }
  report.push(`Device: ${DEVICES[0].name} (${DEVICES[0].target}) — app.json names no device, pick one in Properties`);
  return DEVICES[0];
}

// -------------------------------------------------------------------- main ---
function importFaceDir(dir) {
  const report = [];
  const notes = [];
  const out = { error: null, project: null, images: [], fonts: [], savePath: null, base: path.basename(dir), source: dir, imported: true, report };

  // 1. app.json (the folder itself, or one level down like the store exports)
  let root = null;
  if (fs.existsSync(path.join(dir, 'app.json'))) root = dir;
  else {
    for (const n of (fs.existsSync(dir) ? fs.readdirSync(dir) : [])) {
      const p = path.join(dir, n);
      try { if (fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'app.json'))) { root = p; break; } } catch (e) { /* skip */ }
    }
  }
  if (!root) { out.error = 'No app.json in that folder — not a Zepp OS watchface project.'; return out; }
  const appJson = readJson(path.join(root, 'app.json')) || {};

  // 2. the watchface code
  let codeFile = null;
  for (const t of Object.values(appJson.targets || {})) {
    const p = t && t.module && t.module.watchface && t.module.watchface.path;
    if (!p) continue;
    for (const cand of [path.join(root, `${p}.js`), path.join(root, p, 'index.js'), path.join(root, p)]) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) { codeFile = cand; break; }
    }
    if (codeFile) break;
  }
  if (!codeFile) {
    const found = walk(path.join(root, 'watchface')).filter((f) => /\.js$/.test(f));
    codeFile = found.find((f) => /index\.js$/.test(f)) || found[0] || null;
  }
  if (!codeFile) { out.error = 'No watchface code found (watchface/**/index.js).'; return out; }
  report.push(`Source: ${path.relative(dir, codeFile) || path.basename(codeFile)}`);

  // 3. run the code and collect the widgets
  const captured = capture(fs.readFileSync(codeFile, 'utf8'));
  for (const n of captured.notes) notes.push(n);
  if (!captured.calls.length) notes.push('no widget calls were captured');

  // 4. the asset tree: pick the folder the references are relative to
  const assetsBase = path.join(root, 'assets');
  const candidates = [];
  if (fs.existsSync(assetsBase)) {
    candidates.push(assetsBase);
    for (const n of fs.readdirSync(assetsBase)) {
      const p = path.join(assetsBase, n);
      try { if (fs.statSync(p).isDirectory()) candidates.push(p); } catch (e) { /* skip */ }
    }
  } else {
    notes.push('there is no assets/ folder next to the code — every image reference will be missing');
  }
  const tree = assetIndex(assetsBase);
  const refs = collectRefs(captured.calls);
  let assetsRoot = assetsBase, best = -1;
  for (const cand of candidates) {
    const idx = assetIndex(cand);
    const score = refs.filter((r) => relIn(idx, r)).length;
    if (score > best) { best = score; assetsRoot = cand; }
  }
  const primary = assetIndex(assetsRoot);
  const rootRel = path.relative(assetsBase, assetsRoot).split(path.sep).join('/');

  // A face that picks its picture from a reading cycles a numbered set of files
  // (ring_0.png … ring_10.png). The index comes out of a value only the watch
  // has, so the reference arrives as `ring_NaN.png`; the set it belongs to is
  // what the widget really showed. Sets are indexed both by the paths the
  // references use and by every folder boundary, because the assets root can sit
  // one folder above them (`assets/default/img/…` for `img/…`).
  const sets = new Map();
  const setsLoose = new Map();
  const addSet = (map, rel, ref) => {
    const m = /^(.*?)(\d+)(\.[A-Za-z0-9]+)$/.exec(ref);
    if (!m) return;
    const key = `${m[1]}\u0000${m[3].toLowerCase()}`;
    if (!map.has(key)) map.set(key, []);
    if (!map.get(key).some((e) => e.rel === rel)) map.get(key).push({ ref, rel, n: Number(m[2]) });
  };
  for (const rel of primary.byRel.keys()) addSet(sets, rel, rel);
  for (const rel of tree.byRel.keys()) {
    for (let i = 0; i < rel.length; i++) {
      if (i && rel[i - 1] !== '/') continue;
      addSet(setsLoose, rel, rel.slice(i));
    }
  }
  for (const list of sets.values()) list.sort((a, b) => a.n - b.n);
  for (const list of setsLoose.values()) list.sort((a, b) => a.n - b.n);

  const device = deviceFor(appJson, report);
  const images = new Map();          // designer name -> image record
  const missing = new Set();
  const ctx = {
    device,
    compressed: 0,
    note: (line) => { if (!notes.includes(line)) notes.push(line); },
    // The pictures behind a reference whose index the sandbox could not compute
    // (…_NaN.png), lowest index first. Resolving them here also takes the
    // reference off the "could not be resolved" list — it just arrived without
    // its index.
    dynamic(ref) {
      const s = String(ref || '');
      const dot = s.lastIndexOf('.');
      if (dot <= 0) return [];
      const stem = s.slice(0, dot);
      const ext = s.slice(dot).toLowerCase();
      // the index the sandbox could not work out is glued onto the stem, so the
      // set is the longest prefix of it the package actually holds
      const find = (map) => {
        for (let k = stem.length; k > 0; k--) {
          const hit = map.get(`${stem.slice(0, k)}\u0000${ext}`);
          if (hit) return hit;
        }
        return null;
      };
      let list = find(sets);
      if (!list) {
        const loose = find(setsLoose);
        if (!loose) return [];
        // several device folders can hold the same set: keep the one the
        // references are relative to
        const own = rootRel ? loose.filter((e) => e.rel.startsWith(`${rootRel}/`)) : [];
        list = own.length ? own : loose;
      }
      const names = list.map((e) => ctx.resolve(e.ref)).filter(Boolean);
      if (names.length) missing.delete(s);
      return names;
    },
    size(name) { const im = images.get(name); return im ? { w: im.width, h: im.height } : null; },
    resolve(ref) {
      let abs = null;
      let name = null;
      // the designer stores bare names relative to the asset root and re-adds
      // `images/` on export, so strip that one segment from the reference
      const cleanRef = typeof ref === 'string' ? ref.replace(/^\.\//, '').replace(/^images\//, '') : '';
      let rel = relIn(primary, ref);
      if (rel) { abs = primary.byRel.get(rel); name = cleanRef; }
      if (!abs) {
        const rel2 = relIn(tree, ref);
        if (rel2) {
          abs = tree.byRel.get(rel2);
          // the file lives somewhere else: keep the reference when it really
          // points at this file, else fall back to the root-relative path
          name = (cleanRef && (rel2 === cleanRef || rel2.endsWith(`/${cleanRef}`))) ? cleanRef
            : (rootRel && rel2.startsWith(`${rootRel}/`) ? rel2.slice(rootRel.length + 1) : rel2.split('/').pop());
          name = name.replace(/^images\//, '');
        }
      }
      if (!abs) { if (ref) missing.add(String(ref)); return undefined; }
      if (!images.has(name)) {
        try {
          let buf = fs.readFileSync(abs);
          let png = null;
          // Maker exports ship compressed containers named .png
          if (isSomh(buf)) {
            const dec = somhToPng(buf);
            if (dec) { png = dec; buf = dec.png; ctx.compressed++; }
          } else {
            const img = PNG.sync.read(buf);
            png = { width: img.width, height: img.height, png: buf };
          }
          if (!png) { missing.add(String(ref)); return undefined; }
          images.set(name, { name, width: png.width, height: png.height, dataBase64: png.png.toString('base64') });
        } catch (e) { missing.add(String(ref)); return undefined; }
      }
      return name;
    },
  };

  // 5. map widgets -> designer elements
  const skipped = new Map();
  const lifecycle = new Map();
  ctx.lifecycle = lifecycle;
  let elements = [];
  // widgets the code shows only before / after noon (lit AM and PM labels)
  let pmRun = null;
  const codeText = fs.readFileSync(codeFile, 'utf8');
  if (/VISIBLE/.test(codeText) && /getHours|hour/.test(codeText)) {
    const am = capture(codeText, { hour: 9 }).calls;
    pmRun = capture(codeText, { hour: 15 }).calls;
    captured.calls.forEach((c, i) => { c.visible = am[i] ? am[i].visible : undefined; c.visiblePm = pmRun[i] ? pmRun[i].visible : undefined; });
  }
  for (const call of captured.calls) {
    const made = mapWidget(call.type, call.params, ctx, skipped, call.sensor);
    if (pmRun && call.visible !== call.visiblePm && (call.visible === true || call.visiblePm === true)) {
      for (const e of made) {
        e.showWhen = call.visible === true && call.visiblePm !== true ? 'am' : 'pm';
        e.name = e.showWhen === 'am' ? 'AM lit' : 'PM lit';
      }
    }
    elements.push(...made);
  }
  elements = mergeStates(elements);
  for (const [type, n] of lifecycle) {
    notes.push(`the watchface registers ${type} ×${n} for ${NON_VISUAL[type]} — not a layer, so there is nothing to design`);
  }

  // 6. fonts the Text layers reference (assets/<target>/fonts/<file>)
  const fonts = [];
  const wanted = new Set(elements.map((e) => e.fontFile).filter(Boolean).map((f) => path.basename(f)));
  if (wanted.size) {
    for (const f of walk(path.join(root, 'assets'))) {
      const base = path.basename(f);
      if (!wanted.has(base) || !isFontFile(base) || fonts.some((x) => x.name === base)) continue;
      try {
        const buf = fs.readFileSync(f);
        const ext = path.extname(base).toLowerCase();
        const info = fontInfoFromBuffer(buf, base);
        fonts.push({
          name: base, family: info.family, coverage: info.coverage, ext, format: fontFormat(ext),
          size: buf.length, dataBase64: buf.toString('base64'),
        });
      } catch (e) { notes.push(`could not read the font ${base}`); }
    }
    for (const b of [...wanted]) if (!fonts.some((f) => f.name === b)) notes.push(`font ${b} is referenced but was not found in the project`);
  }

  // 7. the project
  const app = appJson.app || {};
  const sourceAppId = Number(app.appId) || 0;
  // Only an id that came from this designer is reused. A Maker/other export
  // carries its vendor's id (the Maker hands out 1000001, 1000002, …) and the
  // Zepp App installs a local package *as* that app, so an id that is already
  // taken by a published watchface makes the install fail. A designer id is
  // free by construction — and it is only an id, the layer keeps everything else.
  // ('watchface-designer' is the id this app exported under before it was Dialcraft)
  const keepAppId = ['dialcraft', 'watchface-designer'].includes(app.vender) && sourceAppId >= 1;
  const appId = keepAppId ? sourceAppId : 2000000 + Math.floor(Math.random() * 900000);
  const project = {
    version: 1,
    name: app.appName || path.basename(dir),
    device: device.target,
    appId,
    vender: app.vender || 'dialcraft',
    description: app.description || '',
    // '' = the face ships no font (its digits are ready-made images); the
    // designer then rasterizes new glyphs with its default and says so
    font: fonts.length ? fonts[0].family : '',
    // what the face declares; weekday / month names follow it
    language: app.defaultLanguage || Object.keys(appJson.i18n || {})[0] || 'en-US',
    groups: {},
    elements,
  };
  const seen = new Map();
  for (const el of elements) {
    const key = el.name.toLowerCase();
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    if (n > 1) el.name = `${el.name} ${n}`;
  }

  // 8. the report
  const used = new Set();
  for (const el of elements) {
    for (const key of ['images', 'frames']) for (const n of el[key] || []) used.add(n);
    for (const key of ['src', 'unit', 'dot', 'negative', 'bg', 'cover', 'am', 'pm', 'hour', 'minute', 'second']) {
      if (el[key]) used.add(el[key]);
    }
  }
  report.push(`Layers: ${elements.length} imported`);
  if (!keepAppId && sourceAppId) report.push(`App id: ${sourceAppId} → ${appId} (the source id may be published — type it back in the project panel to keep it)`);
  const unused = [...images.keys()].filter((n) => !used.has(n)).length;
  report.push(`Images: ${images.size} imported${unused ? ` (${unused} not referenced by any widget)` : ''}`);
  if (fonts.length) report.push(`Fonts: ${fonts.map((f) => `${f.name} → ${f.family}`).join(', ')}`);
  if (skipped.size) {
    report.push('');
    report.push('Not in the designer (left out of the import):');
    for (const [name, n] of [...skipped.entries()].sort()) report.push(`  ${name} ×${n}`);
  }
  if (missing.size) {
    report.push('');
    report.push('Image references that could not be resolved:');
    for (const m of [...missing].sort().slice(0, 12)) report.push(`  ${m}`);
    if (missing.size > 12) report.push(`  … and ${missing.size - 12} more`);
  }
  if (/setProperty\s*\(/.test(fs.readFileSync(codeFile, 'utf8'))) {
    notes.push('the code updates widgets at runtime (setProperty) — the editor shows the value the code sets while building');
  }
  if (ctx.compressed) {
    notes.push(`${ctx.compressed} images were in Zepp's compressed format (Watchface Maker export) and were decoded to PNG`);
  }
  if (captured.error) notes.push(`the watchface code reported: ${captured.error}`);
  if (notes.length) {
    report.push('');
    report.push('Notes:');
    for (const n of notes) report.push(`  - ${n}`);
  }
  report.push('');
  report.push('The source folder is untouched — use Save to keep this as a designer project (.wfproj.json).');

  out.project = project;
  out.images = [...images.values()];
  out.fonts = fonts;
  return out;
}

// ------------------------------------------------------- widget -> element ---
function layerName(base, suffix) { return suffix ? `${base} (${suffix})` : base; }

function mapWidget(type, p, ctx, skipped, sensor) {
  if (NON_VISUAL[type]) {
    ctx.lifecycle.set(type, (ctx.lifecycle.get(type) || 0) + 1);
    return [];
  }
  const kindId = WIDGET_KIND[type];
  if (!kindId) { skipped.set(type || '?', (skipped.get(type || '?') || 0) + 1); return []; }
  const img = (ref) => ctx.resolve(ref);
  const imgs = (arr) => (Array.isArray(arr) ? arr.map(img).filter(Boolean) : []);
  // A picture the face picked from a reading: the index never made it through
  // the sandbox, but the whole set is in the package, so the widget comes in as
  // a level widget over it instead of as a picture with a broken name.
  const picked = (ref) => {
    if (!ctx.dynamic || img(ref)) return null;
    const names = ctx.dynamic(ref);
    if (names.length < 2) return null;
    const key = SENSOR_LEVEL[nameOf(sensor)];
    ctx.note(`pictures picked at runtime (${ref}) came in as a set of ${names.length}` +
      (key ? ` — the layer follows ${key}` : ' — pick the reading it should follow'));
    return { names, dataType: key && dataType(key) ? key : undefined };
  };
  const base = { show: showOf(p.show_level), alpha: num(p.alpha) };
  const box = { x: num(p.x), y: num(p.y), w: num(p.w), h: num(p.h) };
  const mk = (id, patch) => newElement(id, clean(patch));
  const el = (id, patch) => [mk(id, { ...base, ...patch })];

  switch (type) {
    case 'IMG': {
      const src = img(p.src);
      const fromReading = src ? null : picked(p.src);
      if (fromReading) {
        const size = ctx.size(fromReading.names[0]);
        return el('IMG_LEVEL', {
          name: 'Level', ...box,
          w: box.w === undefined && size ? size.w : undefined,
          h: box.h === undefined && size ? size.h : undefined,
          images: fromReading.names, dataType: fromReading.dataType,
        });
      }
      return el('IMG', {
        name: 'Image', ...box, src,
        posX: num(p.pos_x), posY: num(p.pos_y), angle: num(p.angle),
        centerX: num(p.center_x), centerY: num(p.center_y),
      });
    }
    case 'TEXT': {
      const font = typeof p.font === 'string' ? path.basename(p.font) : undefined;
      return el('TEXT', {
        name: 'Text', ...box,
        text: p.text == null ? '' : String(p.text),
        color: hexOf(p.color), size: num(p.text_size),
        alignH: alignOf(p.align_h), alignV: alignOf(p.align_v),
        lineSpace: num(p.line_space), charSpace: num(p.char_space),
        fontFile: font || '',
      });
    }
    case 'TEXT_IMG': {
      const dt = nameOf(p.type);
      return el('TEXT_IMG', {
        name: (dt && dataType(dt) ? dataType(dt).label : 'Reading'), ...box,
        dataType: dt, images: imgs(p.font_array), hSpace: num(p.h_space), alignH: alignOf(p.align_h),
        unit: img(p.unit_en) || '', dot: img(p.dot_image) || '', negative: img(p.negative_image) || '',
      });
    }
    case 'IMG_TIME': {
      const out = [];
      const amPath = img(p.am_en_path || p.am_sc_path || p.am_tc_path);
      const pmPath = img(p.pm_en_path || p.pm_sc_path || p.pm_tc_path);
      const keys = Object.keys(p);
      const hasAmPm = keys.some((k) => k.startsWith('am_') || k.startsWith('pm_'));
      if (hasAmPm) {
        // the am/pm overlay widget: no digits of its own, it lights the label
        out.push(mk('IMG_TIME', {
          ...base, part: 'hour12', name: layerName('Hour', '12h'),
          x: num(p.am_x), y: num(p.am_y), images: [],
          am: amPath || '', pm: pmPath || '',
          amX: num(p.am_x), amY: num(p.am_y), pmX: num(p.pm_x), pmY: num(p.pm_y),
        }));
      }
      for (const part of TIME_PARTS) {
        if (!keys.some((k) => k.startsWith(`${part}_`))) continue;
        const follow = num(p[`${part}_follow`]) ? 1 : 0;
        out.push(mk('IMG_TIME', {
          ...base, part, name: part[0].toUpperCase() + part.slice(1),
          x: num(p[`${part}_startX`]),
          y: follow ? undefined : num(p[`${part}_startY`]),
          zero: num(p[`${part}_zero`]) ? 1 : 0, space: num(p[`${part}_space`]),
          follow, alignH: alignOf(p[`${part}_align`]),
          images: imgs(p[`${part}_array`]), unit: img(p[`${part}_unit_en`]) || '',
        }));
      }
      return out;
    }
    case 'IMG_WEEK':
      return el('IMG_WEEK', { name: 'Weekday', ...box, images: imgs(p.week_en || p.week_sc || p.week_tc) });
    case 'IMG_DATE': {
      const out = [];
      for (const part of DATE_PARTS) {
        if (!Object.keys(p).some((k) => k.startsWith(`${part}_`))) continue;
        const follow = num(p[`${part}_follow`]) ? 1 : 0;
        out.push(mk('IMG_DATE', {
          ...base, part, name: part === 'month' ? 'Month' : 'Day',
          x: num(p[`${part}_startX`]),
          y: follow ? undefined : num(p[`${part}_startY`]),
          zero: num(p[`${part}_zero`]) ? 1 : 0, space: num(p[`${part}_space`]), follow,
          alignH: alignOf(p[`${part}_align`]),
          isCharacter: !!p[`${part}_is_character`],
          images: imgs(p[`${part}_en_array`] || p[`${part}_sc_array`] || p[`${part}_tc_array`]),
          unit: img(p[`${part}_unit_en`]) || '',
        }));
      }
      return out;
    }
    case 'TIME_POINTER': {
      const hand = (name) => [img(p[`${name}_path`]), num(p[`${name}_posX`]), num(p[`${name}_posY`])];
      const [h, hx, hy] = hand('hour');
      const [m, mx, my] = hand('minute');
      const [s, sx, sy] = hand('second');
      return el('TIME_POINTER', {
        name: 'Analog clock',
        centerX: num(p.hour_centerX) ?? num(p.minute_centerX) ?? num(p.second_centerX),
        centerY: num(p.hour_centerY) ?? num(p.minute_centerY) ?? num(p.second_centerY),
        hour: h || '', hourPivotX: hx, hourPivotY: hy,
        minute: m || '', minutePivotX: mx, minutePivotY: my,
        second: s || '', secondPivotX: sx, secondPivotY: sy,
        cover: img(p.hour_cover_path) || '',
      });
    }
    case 'IMG_POINTER':
      return el('IMG_POINTER', {
        name: 'Pointer', src: img(p.src),
        centerX: num(p.center_x), centerY: num(p.center_y), x: num(p.x), y: num(p.y),
        angle: num(p.angle), startAngle: num(p.start_angle), endAngle: num(p.end_angle),
        dataType: nameOf(p.type),
      });
    case 'IMG_LEVEL':
      return el('IMG_LEVEL', {
        name: 'Level', x: box.x, y: box.y, w: box.w, h: box.h,
        images: imgs(p.image_array), dataType: nameOf(p.type), level: num(p.level),
      });
    case 'IMG_PROGRESS': {
      const xs = (Array.isArray(p.x) ? p.x : [p.x]).map(num).filter((v) => v !== undefined);
      const ys = (Array.isArray(p.y) ? p.y : [p.y]).map(num).filter((v) => v !== undefined);
      return el('IMG_PROGRESS', {
        name: 'Progress', x: xs[0], y: ys[0], spread: xs.length > 1 ? xs[1] - xs[0] : undefined,
        images: imgs(p.image_array), dataType: nameOf(p.type), level: num(p.level),
      });
    }
    case 'ARC_PROGRESS':
      return el('ARC_PROGRESS', {
        name: 'Arc progress', centerX: num(p.center_x), centerY: num(p.center_y),
        radius: num(p.radius), startAngle: num(p.start_angle), endAngle: num(p.end_angle),
        lineWidth: num(p.line_width), color: hexOf(p.color), bg: img(p.src_bg) || '', level: num(p.level),
      });
    case 'ARC':
      return el('ARC', {
        name: 'Arc', ...box, radius: num(p.radius),
        startAngle: num(p.start_angle), endAngle: num(p.end_angle),
        lineWidth: num(p.line_width), color: hexOf(p.color),
      });
    case 'CIRCLE':
      return el('CIRCLE', {
        name: 'Circle', centerX: num(p.center_x), centerY: num(p.center_y),
        radius: num(p.radius), color: hexOf(p.color), alpha: num(p.alpha),
      });
    case 'FILL_RECT':
      return el('FILL_RECT', { name: 'Rectangle', ...box, color: hexOf(p.color), radius: num(p.radius), angle: num(p.angle) });
    case 'STROKE_RECT':
      return el('STROKE_RECT', {
        name: 'Stroked rectangle', ...box, color: hexOf(p.color),
        radius: num(p.radius), lineWidth: num(p.line_width), angle: num(p.angle),
      });
    case 'IMG_STATUS':
      return el('IMG_STATUS', { name: 'Status icon', ...box, src: img(p.src), status: nameOf(p.type) });
    case 'IMG_CLICK': {
      const dt = nameOf(p.type);
      return el('IMG_CLICK', {
        name: (dt && dataType(dt) ? dataType(dt).label : 'Shortcut'), ...box,
        src: img(p.src), dataType: dt,
      });
    }
    case 'IMG_ANIM': {
      const prefix = typeof p.anim_prefix === 'string' ? p.anim_prefix : '';
      // anim_path is the folder the widget resolves frames from, so it is also
      // the truthful reference: <anim_path>/<prefix>_<i>.png (the designer
      // exports exactly that; a flat <prefix>_<i>.png is the fallback).
      const dir = typeof p.anim_path === 'string' ? p.anim_path.replace(/^images\//, '').replace(/\/+$/, '') : 'anim';
      const frames = [];
      const size = num(p.anim_size) || 0;
      for (let i = 0; i < size; i++) {
        const rel = (prefix && dir ? ctx.resolve(`${dir}/${prefix}_${i}.png`) : null) || ctx.resolve(`${prefix}_${i}.png`);
        if (rel) frames.push(rel);
      }
      return el('IMG_ANIM', {
        name: 'Animation', x: num(p.x), y: num(p.y),
        frames, fps: num(p.anim_fps), repeat: num(p.repeat_count), step: num(p.step), animPrefix: prefix,
      });
    }
    default:
      skipped.set(type, (skipped.get(type) || 0) + 1);
      return [];
  }
}

// The designer emits a layer shown in both states as two widgets (ONLY_NORMAL +
// ONLY_AOD). Fold them back into one layer on the way in.
function mergeStates(elements) {
  const out = [];
  const sigOf = (e) => JSON.stringify({ ...e, id: null, name: null, show: null });
  for (const el of elements) {
    const prev = out[out.length - 1];
    if (prev && prev.show !== el.show && sigOf(prev) === sigOf(el)
      && ['normal', 'aod'].includes(prev.show) && ['normal', 'aod'].includes(el.show)) {
      prev.show = 'both';
      continue;
    }
    out.push(el);
  }
  return out;
}

module.exports = { importFaceDir, stripModule, WIDGET_KIND, NON_VISUAL, collectRefs };
