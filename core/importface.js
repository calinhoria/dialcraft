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
  TIME_POINTER: 'TIME_POINTER', DATE_POINTER: 'DATE_POINTER', TEXT: 'TEXT', TEXT_IMG: 'TEXT_IMG',
  IMG_STATUS: 'IMG_STATUS', IMG_CLICK: 'IMG_CLICK', BUTTON: 'IMG', TEXT_FONT: 'TEXT', GROUP: 'SLEEP_CHART', GRADKIENT_POLYLINE: 'POLYLINE',
  WATCHFACE_EDIT_GROUP: 'EDIT_SLOT', WATCHFACE_EDIT_MASK: 'IMG', WATCHFACE_EDIT_FG_MASK: 'IMG',
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
  'prop', 'text_style', 'anim_status', 'system_status', 'id', 'event', 'edit_type', 'date']);
const TIME_PARTS = ['hour', 'minute', 'second'];
const DATE_PARTS = ['month', 'year', 'day'];
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
// The Maker's "Linear scale": the face creates an empty FILL_RECT and keeps the scale's real
// parameters in a commented-out block (it resizes the rectangle in its own code). Read those.
function parseLinearScales(code) {
  const out = [];
  const re = /\/\/\s*(\w+)\s*=\s*hmUI\.createWidget\(\s*hmUI\.widget\.Linear_Scale\s*,\s*\{([\s\S]*?)\/\/\s*\}\s*\)/g;
  let m;
  while ((m = re.exec(code))) {
    const kv = {};
    for (const line of m[2].split('\n')) {
      const t = /^\s*\/\/\s*(\w+)\s*:\s*(.*?)\s*,?\s*$/.exec(line);
      if (t) kv[t[1]] = t[2];
    }
    const n = (k) => (kv[k] != null && Number.isFinite(+kv[k]) ? +kv[k] : undefined);
    const yes = (k) => /^true$/i.test(String(kv[k] || ''));
    const color = kv.color != null ? Number(kv.color) : NaN;
    out.push({
      name: m[1], used: false,
      x: n('start_x'), y: n('start_y'), length: n('lenght') != null ? n('lenght') : n('length'), lineWidth: n('line_width'),
      rounded: /Rounded/i.test(kv.line_cap || ''), vertical: yes('vertical'), mirror: yes('mirror'), inversion: yes('inversion'),
      alpha: n('alpha'), color: Number.isFinite(color) ? '#' + (color & 0xffffff).toString(16).padStart(6, '0') : undefined,
      dataType: nameOf(kv.type), show: showOf(kv.show_level),
    });
  }
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
  // The clock the face reads. The watchface code often sets a digit picture from
  // `e.format_hour` / `e.minute` in a refresh function; capture() calls those
  // functions at several times and records which picture each widget got.
  const clock = { h: 10, m: 9, s: 36 };
  const listeners = [];
  const entries = [];
  const timeValues = () => ({
    hour: clock.h, minute: clock.m, second: clock.s, format_hour: clock.h % 12 || 12,
    day: 15, month: 6, year: 2024, week: 1,
  });
  const makeTime = () => {
    const base = mk('Time', 'time');
    const vals = {
      getHours: () => clock.h, getMinutes: () => clock.m, getSeconds: () => clock.s,
      getFormatHour: () => clock.h % 12 || 12, getDate: () => 15, getMonth: () => 6, getFullYear: () => 2024, getDay: () => 1,
      addEventListener: (_ev, cb) => { if (typeof cb === 'function') listeners.push(cb); },
      onPerMinute: (cb) => { if (typeof cb === 'function') listeners.push(cb); },
      onPerSecond: (cb) => { if (typeof cb === 'function') listeners.push(cb); },
    };
    return new Proxy(base, {
      get(t, prop, r) {
        const tv = timeValues();
        if (typeof prop === 'string' && prop in tv) return tv[prop];
        if (typeof prop === 'string' && prop in vals) return vals[prop];
        return Reflect.get(t, prop, r);
      },
    });
  };
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
        if (/(^|\.)createSensor$/.test(name)) {
          sensor = args && args.length ? args[0] : undefined;
          if (typeof sensor === 'string' && /(^|\.)TIME$/.test(sensor)) return makeTime();
        }
        return mk(tag, `${name}()`);
      },
      construct() { return name === 'Time' ? makeTime() : mk(tag, `new ${name}`); },
    });
  };
  const createWidget = (type, params) => {
    let p = {};
    try { p = JSON.parse(JSON.stringify(params || {})); } catch (e) { p = { ...(params || {}) }; }
    // a button's tap code is a function (lost in the copy): keep its text to read the action from
    if (params && typeof params.click_func === 'function') {
      try { p._click = Function.prototype.toString.call(params.click_func); } catch (e) { /* no source */ }
    }
    const entry = { type: nameOf(type) || String(type), params: p, sensor };
    if (params && typeof params.resume_call === 'function') listeners.push(params.resume_call);
    entries.push(entry);
    // a complication slot: the face asks it which type the wearer picked (getProperty CURRENT_TYPE)
    if (entry.type === 'WATCHFACE_EDIT_GROUP') entry.slotIndex = calls.filter((c) => c.type === 'WATCHFACE_EDIT_GROUP').length;
    calls.push(entry);
    const inst = mk('widgetInstance', 'widget');
    // setProperty(hmUI.prop.VISIBLE, v) is how a face lights one of two labels
    // (AM / PM): remember the last value so the import can tell which hour shows it
    return new Proxy(inst, {
      get(t, prop, r) {
        if (prop === 'setProperty') {
          return (key, val) => {
            if (/VISIBLE/.test(String(key))) entry.visible = !!val;
            // a picture picked at runtime: setProperty(MORE, { src }) or setProperty(SRC, name)
            if (/MORE/.test(String(key)) && val && typeof val === 'object' && typeof val.src === 'string') entry.more = val.src;
            else if (/(^|\.)SRC$/.test(String(key)) && typeof val === 'string') entry.more = val;
            return undefined;
          };
        }
        if (prop === 'getProperty' && entry.slotIndex != null) {
          // answer with the type this pass tries (or one no case matches, for the base pass)
          return (key) => (/CURRENT_TYPE/.test(String(key))
            ? (opts.pick && opts.pick.slot === entry.slotIndex ? `edit_type.${opts.pick.type}` : 'edit_type.__none__')
            : mk('widgetInstance', 'value'));
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
    reset() { calls.length = 0; config = null; sensor = undefined; listeners.length = 0; entries.length = 0; },
    mk,
    // call the face's refresh callbacks at each time and record the picture every widget ends up with
    probe(times) {
      const out = [];
      for (const [h, m] of times) {
        clock.h = h; clock.m = m; clock.s = 0;
        for (const e of entries) e.more = undefined;
        for (const cb of listeners.slice()) { try { cb(); } catch (err) { /* the face's own refresh failed: that widget stays static */ } }
        out.push(entries.map((e) => e.more));
      }
      entries.forEach((e, i) => { const seq = out.map((o) => o[i]); if (seq.every((v) => typeof v === 'string')) e.probes = seq; });
      clock.h = 10; clock.m = 9; clock.s = 36;
    },
  };
}

// Four IMG widgets whose picture the face sets every minute from the clock are really the
// hour and minute digits: find which digit each follows (from the pictures it showed at
// the probe times), and replace the four by Digital time layers.
function liftClockDigits(calls, ctx) {
  const roles = {
    ht: ([h]) => Math.floor((h % 12 || 12) / 10), hu: ([h]) => (h % 12 || 12) % 10,
    mt: ([, m]) => Math.floor(m / 10), mu: ([, m]) => m % 10,
  };
  const found = {};
  calls.forEach((c, i) => {
    if (c.type !== 'IMG' || !c.probes || c.probes.length !== PROBE_TIMES.length) return;
    for (const [role, digit] of Object.entries(roles)) {
      const map = new Map();
      let ok = true;
      PROBE_TIMES.forEach((t, k) => {
        const d = digit(t);
        if (map.has(d) && map.get(d) !== c.probes[k]) ok = false;
        map.set(d, c.probes[k]);
      });
      if (!ok || new Set(map.values()).size !== map.size || map.size < 2) continue;
      if (!found[role]) found[role] = [];
      found[role].push({ i, c, map });
      break;
    }
  });
  const drop = new Set();
  const add = new Map();    // call index → synthetic call
  for (const [part, tens, units] of [['hour', 'ht', 'hu'], ['minute', 'mt', 'mu']]) {
    const T = found[tens] && found[tens][0], U = found[units] && found[units][0];
    if (!T || !U) continue;
    const digits = Array.from({ length: 10 }, (_, d) => U.map.get(d));
    if (digits.some((v) => !v)) continue;
    const params = {
      ...U.c.params,
      [`${part}_startX`]: T.c.params.x, [`${part}_startY`]: T.c.params.y,
      [`${part}_array`]: digits, [`${part}_zero`]: 1, _unitsX: U.c.params.x,
    };
    for (const k of ['x', 'y', 'w', 'h', 'src', 'enable']) delete params[k];
    const first = Math.min(T.i, U.i);
    add.set(first, { type: 'IMG_TIME', params, sensor: undefined });
    drop.add(T.i); drop.add(U.i);
    ctx.clockDigits = (ctx.clockDigits || 0) + 1;
  }
  if (!drop.size) return calls;
  const out = [];
  calls.forEach((c, i) => { if (add.has(i)) out.push(add.get(i)); if (!drop.has(i)) out.push(c); });
  return out;
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
// 12-hour value and minute: every digit 0-9 appears as a units digit, tens digits cover 0-1 (hour) and 0-5 (minute)
const PROBE_TIMES = [[12, 0], [1, 12], [2, 23], [3, 34], [4, 45], [5, 56], [6, 7], [7, 18], [8, 29], [9, 41], [10, 52], [11, 3]];
function capture(code, opts = {}) {
  const calls = [];
  const notes = [];
  const attemptNotes = [];
  const { sandbox, getConfig, reset, mk, probe } = makeShim(calls, attemptNotes, opts);
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
    for (const n of todo) {
      stub(n);
      // `__$$hmAppManager$$__`, `DeviceRuntimeCore` & co. are the Maker toolchain's own wrapper, not something to design
      if (!/^__\$\$.*\$\$__$/.test(n) && n !== 'DeviceRuntimeCore') notes.push(`stubbed the unknown global \`${n}\``);
    }
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
    if (!error || /^onInit/.test(error)) { try { probe(PROBE_TIMES.map(([h12, m]) => [h12 % 12, m])); } catch (e) { /* no clock-driven widgets */ } }
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
  // what the face's own start-up code hides (a stat it shows only after a tap, a dimming
  // overlay): the visibility it sets on the first run is how the face starts
  captured.calls = liftClockDigits(captured.calls, ctx);
  for (const c of captured.calls) c.initVisible = c.visible;
  ctx.linear = parseLinearScales(codeText);
  ctx.code = codeText;
  if (/VISIBLE/.test(codeText) && /getHours|hour/.test(codeText)) {
    const am = liftClockDigits(capture(codeText, { hour: 9 }).calls, ctx);
    pmRun = liftClockDigits(capture(codeText, { hour: 15 }).calls, ctx);
    captured.calls.forEach((c, i) => { c.visible = am[i] ? am[i].visible : undefined; c.visiblePm = pmRun[i] ? pmRun[i].visible : undefined; });
  }
  // complication slots: run the code once per optional type; what each type adds is that type's layers
  const slotCalls = captured.calls.filter((c) => c.type === 'WATCHFACE_EDIT_GROUP');
  const inserts = new Map();     // call index → [{ call, slot, type }]
  const sameCall = (a, b) => a && b && a.type === b.type && JSON.stringify(a.params) === JSON.stringify(b.params);
  slotCalls.forEach((sc) => {
    const types = (Array.isArray(sc.params.optional_types) ? sc.params.optional_types : []).map((o) => nameOf(o && o.type)).filter(Boolean);
    for (const T of types) {
      const run = liftClockDigits(capture(codeText, { pick: { slot: sc.slotIndex, type: T } }).calls, ctx);
      const B = captured.calls;
      let a = 0;
      while (a < B.length && a < run.length && sameCall(B[a], run[a])) a++;
      let z = 0;
      while (z < B.length - a && z < run.length - a && sameCall(B[B.length - 1 - z], run[run.length - 1 - z])) z++;
      const extra = run.slice(a, run.length - z);
      if (!extra.length) continue;
      if (!inserts.has(a)) inserts.set(a, []);
      for (const c of extra) inserts.get(a).push({ call: c, slot: sc.params.edit_id, type: T });
    }
  });
  const pushCall = (call, tag) => {
    const made = mapWidget(call.type, call.params, ctx, skipped, call.sensor);
    if (tag) for (const e of made) { e.editSlot = tag.slot; e.editType = tag.type; ctx.editChildren = (ctx.editChildren || 0) + 1; }
    else if (pmRun && call.visible !== call.visiblePm && (call.visible === true || call.visiblePm === true)) {
      for (const e of made) {
        e.showWhen = call.visible === true && call.visiblePm !== true ? 'am' : 'pm';
        e.name = e.showWhen === 'am' ? 'AM lit' : 'PM lit';
      }
    } else if (call.initVisible === false) {
      for (const e of made) e.visible = false;
      ctx.startHidden = (ctx.startHidden || 0) + made.length;
    }
    elements.push(...made);
  };
  captured.calls.forEach((call, idx) => {
    // the layers a type adds sit where the face's switch is: right after the slot's code
    for (const x of inserts.get(idx) || []) pushCall(x.call, { slot: x.slot, type: x.type });
    pushCall(call, null);
  });
  for (const x of inserts.get(captured.calls.length) || []) pushCall(x.call, { slot: x.slot, type: x.type });
  for (const lin of ctx.linear.filter((x) => !x.used && x.show === 'aod')) {
    lin.used = true;
    ctx.bars = (ctx.bars || 0) + 1;
    elements.push(newElement('BAR', clean({
      name: `${lin.dataType && dataType(lin.dataType) ? dataType(lin.dataType).label : 'Progress'} bar`, show: 'aod', alpha: lin.alpha, x: lin.x, y: lin.y, length: lin.length, lineWidth: lin.lineWidth,
      rounded: lin.rounded, vertical: lin.vertical, mirror: lin.mirror, inversion: lin.inversion, color: lin.color,
      dataType: lin.dataType && dataType(lin.dataType) ? lin.dataType : undefined,
    })));
  }
  elements = mergeStates(elements);
  // the Maker's "switch background" button: a list of pictures the first background
  // layer cycles through, with a toast name for each
  if (elements.some((e) => e.kind === 'TAP' && e.action === 'variant')) {
    const listOf = (name) => {
      const m = new RegExp(`${name}\\s*=\\s*\\[([^\\]]*)\\]`).exec(codeText);
      return m ? [...m[1].matchAll(/['"]([^'"]*)['"]/g)].map((x) => x[1]) : [];
    };
    const pics = listOf('backgroundList').map((n) => ctx.resolve(n)).filter(Boolean);
    const toasts = listOf('backgroundToastList').map((t) => t.replace('%s', '').trim());
    const bg = pics.length > 1 ? elements.find((e) => e.kind === 'IMG' && e.src === pics[0]) : null;
    if (bg) {
      bg.images = pics;
      if (toasts.some(Boolean)) bg.variantNames = toasts.slice(0, pics.length);
      bg.name = bg.name === 'Image' ? 'Background (variants)' : bg.name;
      notes.push(`${pics.length} background variants found — the first background layer cycles through them (preview them with the Variant picker)`);
    }
  }
  if (ctx.editSlots) notes.push(`${ctx.editSlots} editable complication slot${ctx.editSlots === 1 ? '' : 's'} imported (Complication layers) with ${ctx.editChildren || 0} layer${ctx.editChildren === 1 ? '' : 's'} that appear for one choice only — the wearer picks the type on the watch; preview each choice with the Complication selector`);
  if (ctx.sleepCharts) notes.push(`${ctx.sleepCharts} sleep chart${ctx.sleepCharts === 1 ? '' : 's'} imported as Sleep chart layers (the watch fills them from last night's sleep stages)`);
  if (ctx.bars) notes.push(`${ctx.bars} linear scale${ctx.bars === 1 ? '' : 's'} came in as Progress bar layers (the Maker keeps their settings in a comment; the face's code resizes them at runtime)`);
  if (ctx.emptyWidgets) notes.push(`${ctx.emptyWidgets} empty widget${ctx.emptyWidgets === 1 ? '' : 's'} left out (no parameters — placeholders the face's code fills in at runtime, such as the Maker's linear scale bars)`);
  if (ctx.startHidden) notes.push(`${ctx.startHidden} layer${ctx.startHidden === 1 ? '' : 's'} start hidden (the face's own code hides ${ctx.startHidden === 1 ? 'it' : 'them'} on start and shows ${ctx.startHidden === 1 ? 'it' : 'them'} on a tap) — they stay in the list, switched off, and are not exported`);
  if (ctx.taps) notes.push(`${ctx.taps} tap zone${ctx.taps === 1 ? '' : 's'} came in as Tap zone layers${ctx.customTaps ? ` — ${ctx.customTaps} of them ran custom code the designer does not keep (the original code is in the layer's note)` : ''}`);
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
    language: languageTag(appJson.defaultLanguage || app.defaultLanguage || Object.keys(appJson.i18n || {})[0]),
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
    for (const key of ['src', 'unit', 'unitImperial', 'invalid', 'minuteCover', 'secondCover', 'dot', 'negative', 'bg', 'cover', 'scale', 'am', 'pm', 'hour', 'minute', 'second']) {
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
  // createWidget(FILL_RECT) with no parameters is a placeholder the Maker leaves for a widget
  // it configures in code (its "Linear scale" bars): drawn as a default rectangle it would
  // cover the face, so it is left out
  if (['FILL_RECT', 'STROKE_RECT', 'CIRCLE', 'ARC'].includes(type)
    && !Object.keys(p || {}).some((k) => k !== 'show_level' && k !== '_click')) {
    const lin = type === 'FILL_RECT' ? (ctx.linear || []).find((x) => !x.used && x.show !== 'aod') : null;
    if (lin) {
      lin.used = true;
      ctx.bars = (ctx.bars || 0) + 1;
      return [newElement('BAR', clean({
        name: `${lin.dataType && dataType(lin.dataType) ? dataType(lin.dataType).label : 'Progress'} bar`, show: lin.show, alpha: lin.alpha, x: lin.x, y: lin.y, length: lin.length, lineWidth: lin.lineWidth,
        rounded: lin.rounded, vertical: lin.vertical, mirror: lin.mirror, inversion: lin.inversion, color: lin.color,
        dataType: lin.dataType && dataType(lin.dataType) ? lin.dataType : undefined,
      }))];
    }
    ctx.emptyWidgets = (ctx.emptyWidgets || 0) + 1;
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
    case 'WATCHFACE_EDIT_MASK':
    case 'WATCHFACE_EDIT_FG_MASK': {
      // pictures drawn only while the wearer customises the face
      const src = img(p.src);
      return el('IMG', { name: type === 'WATCHFACE_EDIT_MASK' ? 'Edit mask' : 'Edit foreground mask', ...box, src });
    }
    case 'WATCHFACE_EDIT_GROUP': {
      const opts = (Array.isArray(p.optional_types) ? p.optional_types : []).map((o) => ({ type: nameOf(o && o.type), preview: img(o && o.preview) || '' })).filter((o) => o.type);
      ctx.editSlots = (ctx.editSlots || 0) + 1;
      return el('EDIT_SLOT', clean({
        name: `Complication ${p.edit_id != null ? p.edit_id : ctx.editSlots}`, ...box,
        editId: num(p.edit_id), defaultType: nameOf(p.default_type), optionalTypes: opts,
        selectImage: img(p.select_image) || '', unSelectImage: img(p.un_select_image) || '',
        tipsBg: img(p.tips_BG) || '', tipsX: num(p.tips_x), tipsY: num(p.tips_y), tipsWidth: num(p.tips_width), tipsMargin: num(p.tips_margin),
      }));
    }
    case 'GRADKIENT_POLYLINE': {
      const dt = nameOf(p.type);
      if (dt !== 'HEART' && dt !== 'SLEEP') {
        // drawn by the face's own code (addLine / addPoint): the data is not part of the design
        skipped.set('GRADKIENT_POLYLINE (data drawn by code)', (skipped.get('GRADKIENT_POLYLINE (data drawn by code)') || 0) + 1);
        return [];
      }
      return el('POLYLINE', { name: dt === 'SLEEP' ? 'Sleep line chart' : 'Heart-rate chart', ...box, dataType: dt });
    }
    case 'GROUP': {
      // the Maker's sleep chart: an empty group the face's code fills with a bar per sleep stage
      const m = /sleepColors\s*=\s*\[([^\]]*)\]/.exec(ctx.code || '');
      const cols = m ? m[1].split(',').map((t) => Number(t.trim())).filter(Number.isFinite).map((n) => '#' + (n & 0xffffff).toString(16).padStart(6, '0')) : [];
      ctx.sleepCharts = (ctx.sleepCharts || 0) + 1;
      return el('SLEEP_CHART', clean({
        name: 'Sleep chart', ...box,
        colorDeep: cols[0], colorLight: cols[1], colorRem: cols[2], colorWake: cols[3],
      }));
    }
    case 'BUTTON': {
      // The tap zones the Maker adds: a picture (often an invisible 1×1 one) with a click
      // function. The picture stays a layer when it is visible; the click becomes a Tap zone.
      const src = img(p.normal_src || p.press_src);
      const size = src ? ctx.size(src) : null;
      const out = [];
      if (src && !(size && size.w <= 2 && size.h <= 2)) out.push(mk('IMG', { ...base, name: 'Button', ...box, src }));
      const click = String(p._click || '');
      const app = /startApp\s*\(\s*\{[^}]*?url\s*:\s*['"]([^'"]+)['"]/.exec(click);
      const sys = /launchApp\s*\(\s*\{[^}]*?appId\s*:\s*(?:\w+\.)?(SYSTEM_APP_\w+)/.exec(click);
      let action = 'none', appUrl = '', note = '', sysApp = '';
      if (/switchBackground\s*\(/.test(click)) action = 'variant';
      else if (sys) { action = 'sysapp'; sysApp = sys[1]; }
      else if (app) { action = 'app'; appUrl = app[1]; }
      else if (click) { note = click.replace(/\s+/g, ' ').slice(0, 160); ctx.customTaps = (ctx.customTaps || 0) + 1; }
      const tapName = action === 'variant' ? 'Tap: next background' : action === 'app' ? `Tap: ${appUrl.replace(/Screen$/, '')}` : action === 'sysapp' ? `Tap: ${sysApp.replace(/^SYSTEM_APP_/, '').toLowerCase()}` : 'Tap zone';
      const visible = (p.text && String(p.text).length) || p.normal_color != null;
      out.push(mk('TAP', {
        ...base, name: tapName, ...box, action, appUrl, sysApp: sysApp || undefined, note,
        ...(visible ? {
          text: p.text == null ? '' : String(p.text), textColor: p.color != null ? hexOf(p.color) : undefined, textSize: num(p.text_size),
          normalColor: p.normal_color != null ? hexOf(p.normal_color) : undefined, pressColor: p.press_color != null ? hexOf(p.press_color) : undefined, radius: num(p.radius),
        } : {}),
      }));
      ctx.taps = (ctx.taps || 0) + 1;
      return out;
    }
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
    case 'TEXT_FONT':
    case 'TEXT': {
      const font = typeof p.font === 'string' ? path.basename(p.font) : undefined;
      const dt = type === 'TEXT_FONT' ? nameOf(p.type) : undefined;
      return el('TEXT', {
        name: dt && dataType(dt) ? dataType(dt).label : 'Text', ...box,
        dataType: dt && dataType(dt) ? dt : undefined,
        text: p.text == null ? '' : String(p.text),
        color: hexOf(p.color), size: num(p.text_size),
        alignH: alignOf(p.align_h), alignV: alignOf(p.align_v),
        lineSpace: num(p.line_space), charSpace: num(p.char_space),
        textStyle: ['WRAP', 'ELLIPSIS'].includes(nameOf(p.text_style)) ? nameOf(p.text_style) : undefined,
        fontFile: font || '',
      });
    }
    case 'TEXT_IMG': {
      const dt = nameOf(p.type);
      return el('TEXT_IMG', {
        name: (dt && dataType(dt) ? dataType(dt).label : 'Reading'), ...box,
        dataType: dt, images: imgs(p.font_array), hSpace: num(p.h_space), alignH: alignOf(p.align_h),
        unit: img(p.unit_en) || '', dot: img(p.dot_image) || '', negative: img(p.negative_image) || '',
        unitImperial: img(p.imperial_unit_en || p.imperial_unit_sc || p.imperial_unit_tc) || '',
        invalid: img(Array.isArray(p.invalid_image) ? p.invalid_image[0] : p.invalid_image) || '',
        text: typeof p.text === 'string' && /\d/.test(p.text) ? p.text.replace(/[^0-9]/g, '') : undefined,
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
        const digits = imgs(p[`${part}_array`]);
        // digit widgets lifted from a clock refresh carry where the units digit sits instead of a spacing
        const gap = p._unitsX != null ? Math.max(0, p._unitsX - num(p[`${part}_startX`]) - ((digits[0] && ctx.size(digits[0])) || { w: 0 }).w) : num(p[`${part}_space`]);
        out.push(mk('IMG_TIME', {
          ...base, part, name: part[0].toUpperCase() + part.slice(1),
          x: num(p[`${part}_startX`]),
          y: follow ? undefined : num(p[`${part}_startY`]),
          zero: num(p[`${part}_zero`]) ? 1 : 0, space: gap,
          follow, alignH: alignOf(p[`${part}_align`]),
          images: digits, unit: img(p[`${part}_unit_en`]) || '',
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
          ...base, part, name: part === 'month' ? 'Month' : part === 'year' ? 'Year' : 'Day',
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
    case 'DATE_POINTER':
      return el('DATE_POINTER', {
        name: 'Date pointer',
        dateType: ['MONTH', 'DAY', 'WEEK'].includes(nameOf(p.type)) ? nameOf(p.type) : 'WEEK',
        centerX: num(p.center_x), centerY: num(p.center_y),
        src: img(p.src), posX: num(p.posX), posY: num(p.posY),
        scale: img(p.scale_en || p.scale_sc || p.scale_tc) || '', scaleX: num(p.scale_x), scaleY: num(p.scale_y),
        cover: img(p.cover_path) || '', coverX: num(p.cover_x), coverY: num(p.cover_y),
        startAngle: num(p.start_angle), endAngle: p.end_angle == null ? 180 : num(p.end_angle),
      });
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
        minuteCover: img(p.minute_cover_path) || '', secondCover: img(p.second_cover_path) || '',
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
        // no w/h = the picture's own size (the kind's 100×100 default would squash it)
        name: 'Level', x: box.x, y: box.y, w: box.w === undefined ? 0 : box.w, h: box.h === undefined ? 0 : box.h,
        images: imgs(p.image_array), dataType: nameOf(p.type), level: num(p.level),
      });
    case 'IMG_PROGRESS': {
      const xs = (Array.isArray(p.x) ? p.x : [p.x]).map(num).filter((v) => v !== undefined);
      const ys = (Array.isArray(p.y) ? p.y : [p.y]).map(num).filter((v) => v !== undefined);
      // evenly spaced on one row is a start + a spread; anything else keeps its own position per picture
      const spreadV = xs.length > 1 ? xs[1] - xs[0] : 0;
      const uniform = xs.every((v, k) => v === xs[0] + k * spreadV) && ys.every((v) => v === ys[0]);
      const positions = !uniform && xs.length > 1 ? xs.map((v, k) => [v, ys[k] !== undefined ? ys[k] : ys[0]]) : undefined;
      return el('IMG_PROGRESS', {
        name: 'Progress', x: xs[0], y: ys[0], spread: xs.length > 1 ? spreadV : undefined, positions,
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
        displayOnRestart: p.display_on_restart ? true : undefined, defaultFrame: num(p.default_frame_index) || undefined,
      });
    }
    default:
      skipped.set(type, (skipped.get(type) || 0) + 1);
      return [];
  }
}

// The designer emits a layer shown in both states as two widgets (ONLY_NORMAL +
// ONLY_AOD). Fold them back into one layer on the way in.
// "enUS", "zh_CN", "en-us" → a valid BCP-47 tag ("en-US"); anything unusable → en-US
function languageTag(raw) {
  let t = String(raw || '').trim().replace(/_/g, '-');
  if (/^[a-z]{2,3}[A-Z]{2}$/.test(t)) t = `${t.slice(0, -2)}-${t.slice(-2)}`;
  try { return Intl.getCanonicalLocales(t)[0] || 'en-US'; } catch (e) { return 'en-US'; }
}
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

module.exports = { languageTag, importFaceDir, stripModule, WIDGET_KIND, NON_VISUAL, collectRefs };
