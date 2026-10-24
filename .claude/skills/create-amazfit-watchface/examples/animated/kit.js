const W = dev().w, H = dev().h, CX = W / 2, TAU = Math.PI * 2, rad = (d) => d * Math.PI / 180;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const E = (n) => project.elements.find((e) => e.name === n);
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
await loadAllImages();
const inkOf = (e) => {
  const names = ((e.images && e.images.length) ? e.images : [e.src]).filter(Boolean);
  let t = 1e9, b = -1, l = 1e9, r = -1;
  for (const n of names) {
    const im = imgCache.get(n); if (!im) continue;
    const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
    const c = mk(w, h), g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 60) { if (y < t) t = y; if (y > b) b = y; if (x < l) l = x; if (x > r) r = x; }
  }
  return { t, b, l, r };
};
const vy = (e, cy) => { const k = inkOf(e); return Math.round(cy - (k.t + k.b + 1) / 2); };
// centre a layer on (cx, cy), measured on the ink vertically and on the box horizontally
const cc = (n, cx, cy) => { const e = E(n), b = elBox(e); e.alignH = 'CENTER_H'; e.x = Math.round(cx - b.w / 2); e.y = vy(e, cy); };
// left-align a layer at x, ink centred on cy
const ll = (n, x, cy) => { const e = E(n); e.alignH = 'LEFT'; e.x = Math.round(x); e.y = vy(e, cy); };
const rowC = (names, cx, cy, gap) => {
  const bs = names.map((n) => elBox(E(n)));
  const tot = bs.reduce((s, b) => s + b.w, 0) + gap * (names.length - 1);
  let x = cx - tot / 2;
  names.forEach((n, i) => { const e = E(n); e.x = Math.round(x); e.y = vy(e, cy); x += bs[i].w + gap; });
};
const under = (e, at = 1) => { project.elements.splice(project.elements.indexOf(e), 1); project.elements.splice(at, 0, e); return e; };
const addImg = async (key, canvas, x, y, name, show) => {
  const nm = addProjectImage(key + '.png', canvas, {}).name;
  const e = await addElement('IMG', { src: nm }); e.name = name; e.src = nm; e.x = Math.round(x); e.y = Math.round(y); e.show = show || 'normal'; return e;
};
const addArc = async (name, dataType, cx, cy, r, lw, a0, a1, color) => {
  const e = await addElement('ARC_PROGRESS', { dataType }); e.name = name; Object.assign(e, { dataType, centerX: cx, centerY: cy, radius: r, lineWidth: lw, startAngle: a0, endAngle: a1, color, show: 'normal' }); return e;
};
const addBar = async (name, dataType, x, y, len, lw, color, o = {}) => {
  const e = await addElement('BAR', { dataType }); e.name = name; Object.assign(e, { dataType, x, y, length: len, lineWidth: lw, color, rounded: true, show: 'normal' }, o); return e;
};
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
// ---------- icons (square canvas of size s) ----------
const ICON = {
  heart(g, s, c, line) { const k = s / 32; g.save(); g.scale(k, k); g.beginPath(); g.moveTo(16, 29); g.bezierCurveTo(3, 19, 1, 10, 8, 6); g.bezierCurveTo(12, 3.5, 16, 6, 16, 10); g.bezierCurveTo(16, 6, 20, 3.5, 24, 6); g.bezierCurveTo(31, 10, 29, 19, 16, 29); g.closePath(); if (line) { g.lineWidth = 2.6; g.strokeStyle = c; g.stroke(); } else { g.fillStyle = c; g.fill(); } g.restore(); },
  steps(g, s, c, line) { const k = s / 32; g.save(); g.scale(k, k); const foot = (x, y, rot) => { g.save(); g.translate(x, y); g.rotate(rot); g.beginPath(); g.ellipse(0, -3, 4.6, 7.2, 0, 0, TAU); g.moveTo(3.6, 8.6); g.ellipse(0, 9.6, 3.4, 3.4, 0, 0, TAU); if (line) { g.lineWidth = 2.2; g.strokeStyle = c; g.stroke(); } else { g.fillStyle = c; g.fill(); } g.restore(); }; foot(10.5, 20, -0.12); foot(21.5, 12, 0.12); g.restore(); },
  thermo(g, s, c, line) { const k = s / 32; g.save(); g.scale(k, k); g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2.6; rr(g, 12.5, 2.5, 7, 19, 3.5); g.stroke(); g.beginPath(); g.arc(16, 24.5, 5.6, 0, TAU); g.fill(); g.fillRect(14.7, 9, 2.6, 15); g.restore(); },
  sun(g, s, c, line) { const k = s / 32; g.save(); g.scale(k, k); g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.arc(16, 21, 7, Math.PI, 0); g.closePath(); if (line) g.stroke(); else g.fill(); for (let i = 0; i < 5; i++) { const a = Math.PI + (i + 0) * Math.PI / 4; g.beginPath(); g.moveTo(16 + Math.cos(a) * 11, 21 + Math.sin(a) * 11); g.lineTo(16 + Math.cos(a) * 15, 21 + Math.sin(a) * 15); g.stroke(); } g.beginPath(); g.moveTo(3, 25.5); g.lineTo(29, 25.5); g.stroke(); g.restore(); },

  sunrise(g, s, c, line) { const k = s / 32; g.save(); g.scale(k, k); g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.arc(16, 24, 6.5, Math.PI, 0); g.closePath(); if (line) g.stroke(); else g.fill(); g.beginPath(); g.moveTo(4, 27.5); g.lineTo(28, 27.5); g.stroke(); for (const a of [-2.1, -1.57, -1.04]) { g.beginPath(); g.moveTo(16 + Math.cos(a) * 10, 24 + Math.sin(a) * 10); g.lineTo(16 + Math.cos(a) * 13, 24 + Math.sin(a) * 13); g.stroke(); } g.beginPath(); g.moveTo(16, 11.5); g.lineTo(16, 2.5); g.moveTo(12.2, 6.3); g.lineTo(16, 2.5); g.lineTo(19.8, 6.3); g.stroke(); g.restore(); },
  sunset(g, s, c, line) { const k = s / 32; g.save(); g.scale(k, k); g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.arc(16, 15, 6.5, Math.PI, 0); g.closePath(); if (line) g.stroke(); else g.fill(); g.beginPath(); g.moveTo(4, 18.5); g.lineTo(28, 18.5); g.stroke(); for (const a of [-2.1, -1.57, -1.04]) { g.beginPath(); g.moveTo(16 + Math.cos(a) * 10, 15 + Math.sin(a) * 10); g.lineTo(16 + Math.cos(a) * 13, 15 + Math.sin(a) * 13); g.stroke(); } g.beginPath(); g.moveTo(16, 21.5); g.lineTo(16, 30.5); g.moveTo(12.2, 26.7); g.lineTo(16, 30.5); g.lineTo(19.8, 26.7); g.stroke(); g.restore(); },
  bolt(g, s, c) { const k = s / 32; g.save(); g.scale(k, k); g.fillStyle = c; g.beginPath(); g.moveTo(19, 2); g.lineTo(7, 18); g.lineTo(15, 18); g.lineTo(12, 30); g.lineTo(25, 13); g.lineTo(17, 13); g.closePath(); g.fill(); g.restore(); },
  calendar(g, s, c) { const k = s / 32; g.save(); g.scale(k, k); g.strokeStyle = c; g.lineWidth = 2.4; rr(g, 4, 6, 24, 22, 4); g.stroke(); g.beginPath(); g.moveTo(4, 13); g.lineTo(28, 13); g.moveTo(10, 3); g.lineTo(10, 9); g.moveTo(22, 3); g.lineTo(22, 9); g.stroke(); g.restore(); },
};
const icon = (kind, s, color, line) => { const c = mk(s, s); ICON[kind](c.getContext('2d'), s, color, line); return c; };
// battery cell, level 0..1 (drawn horizontally), returns a canvas
const cell = (w, h, level, col, frame, empty) => {
  const c = mk(w, h), g = c.getContext('2d'), t = Math.max(2, Math.round(h * 0.09)), cap = Math.round(w * 0.07);
  g.strokeStyle = frame; g.lineWidth = t; rr(g, t / 2, t / 2, w - cap - t, h - t, h * 0.28); g.stroke();
  g.fillStyle = frame; rr(g, w - cap, h * 0.3, cap, h * 0.4, cap / 2); g.fill();
  const iw = w - cap - t * 3, ih = h - t * 3;
  g.save(); rr(g, t * 1.5, t * 1.5, iw, ih, ih * 0.22); g.clip();
  g.fillStyle = empty || 'rgba(255,255,255,0.08)'; g.fillRect(0, 0, w, h);
  g.fillStyle = col; g.fillRect(t * 1.5, 0, iw * level, h);
  g.restore(); return c;
};
const batterySet = async (key, w, h, cols, frame, x, y, name, mkcell) => {
  const names = [];
  for (let i = 0; i < 10; i++) {
    const lv = (i + 1) / 10, col = lv <= 0.2 ? cols[2] : lv <= 0.5 ? cols[1] : cols[0];
    names.push(addProjectImage('bat/' + key + '_' + i + '.png', (mkcell || cell)(w, h, lv, col, frame), {}).name);
  }
  const e = await addElement('IMG_LEVEL', { dataType: 'BATTERY', images: names, w: 0, h: 0 });
  e.name = name; e.images = names; e.dataType = 'BATTERY'; e.x = Math.round(x); e.y = Math.round(y); e.show = 'normal'; return e;
};
// icon + reading chip: icon at x, reading left-aligned to its right, both centred on cy
const chip = async (layer, kind, x, cy, s, color, line, gap = 7) => {
  const ic = await addImg('ic_' + kind + '_' + color.replace('#', ''), icon(kind, s, color, line), x, cy - s / 2, layer + ' icon');
  ll(layer, x + s + gap, cy); return ic;
};
const scene = async (c, name) => { const e = await addImg(name || 'scene', c, 0, 0, 'Scene'); under(e, 1); return e; };
const fillBg = (g, col) => { g.fillStyle = col; g.fillRect(0, 0, W, H); };
const glow = (g, x, y, r, rgba0, rgba1 = 'rgba(0,0,0,0)') => { const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, rgba0); q.addColorStop(1, rgba1); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2); };

// ---- graphics helpers ----
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const Ease = {
  out: (t) => 1 - Math.pow(1 - t, 3), in: (t) => t * t * t, io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  bounce: (t) => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; },
  elastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
};
const paint = (g, fill, stroke, lw) => { if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 2; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); } };
const circ = (g, x, y, r, fill, stroke, lw) => { g.beginPath(); g.arc(x, y, r, 0, TAU); paint(g, fill, stroke, lw); };
const ell = (g, x, y, rx, ry, rot, fill, stroke, lw) => { g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU); paint(g, fill, stroke, lw); };
const poly = (g, pts, fill, stroke, lw, close = true) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (close) g.closePath(); paint(g, fill, stroke, lw); };
const line = (g, x0, y0, x1, y1, col, lw) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.stroke(); };
const quad = (g, x0, y0, cx, cy, x1, y1, col, lw) => { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.stroke(); };
let FONT = 'sans-serif';
// text: opts { align, base, font, stroke, lw, rot, sx, sy, shadow:[color,dx,dy,blur] }
const txt = (g, s, x, y, size, fill, o = {}) => {
  g.save(); g.translate(x, y); if (o.rot) g.rotate(o.rot); if (o.sx || o.sy) g.scale(o.sx || 1, o.sy || 1);
  g.font = size + 'px "' + (o.font || FONT) + '"'; g.textAlign = o.align || 'center'; g.textBaseline = o.base || 'alphabetic';
  if (o.shadow) { g.shadowColor = o.shadow[0]; g.shadowOffsetX = o.shadow[1]; g.shadowOffsetY = o.shadow[2]; g.shadowBlur = o.shadow[3] || 0; }
  if (o.stroke) { g.lineWidth = o.lw || 4; g.strokeStyle = o.stroke; g.lineJoin = 'round'; g.strokeText(s, 0, 0); }
  if (fill) { g.fillStyle = fill; g.fillText(s, 0, 0); }
  g.restore();
};
const tw = (g, s, size, font) => { g.save(); g.font = size + 'px "' + (font || FONT) + '"'; const w = g.measureText(s).width; g.restore(); return w; };
const grad = (g, x0, y0, x1, y1, stops) => { const q = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => q.addColorStop(o, c)); return q; };
const rgrad = (g, x, y, r0, r1, stops) => { const q = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => q.addColorStop(o, c)); return q; };
const srand = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const fit = (g) => { g.save(); };
// ---------- sprite rig: a static background plus small cached sprites placed by a timeline ----------
const mkc = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const SPR = new Map();
// a sprite is drawn once per key (pose) in local coordinates; the timeline only places it
const spr = (key, w, h, fn) => { if (!SPR.has(key)) { const c = mkc(w, h), g = c.getContext('2d'); fn(g); SPR.set(key, { key, c, w, h }); } return SPR.get(key); };

// text sprite: the string drawn once in a tight canvas; returns { sprite, w } (anchor: left baseline at (pad, base))
const tspr = (key, s, size, fill, o = {}) => { const font = o.font || FONT; const g0 = mkc(1, 1).getContext('2d'); g0.font = size + 'px "' + font + '"'; const w = Math.ceil(g0.measureText(s).width) + 2 * (o.pad == null ? 4 : o.pad); const h = Math.ceil(size * 1.35);
  return spr('t:' + key, w, h, (g) => { txt(g, s, o.align === 'center' ? w / 2 : (o.pad == null ? 4 : o.pad), size * 1.05, size, fill, Object.assign({}, o, { align: o.align || 'left' })); }); };

// ---------- measured placement (ink bounds from a real render of just those layers) ----------
const inkBox = async (names, state, wd) => {
  await loadAllImages();
  const d = dev(), cv = mk(d.w, d.h), g = cv.getContext('2d');
  const els = names.map(E); const miss = names.filter((n, i) => !els[i]);
  if (miss.length) throw new Error('inkBox: no layer ' + miss.join(', '));
  const keepEls = project.elements, set = new Set(els);
  project.elements = keepEls.filter((e) => set.has(e));
  const k = { clock, dateParts, exportRender };
  clock = { ...REF_CLOCK }; dateParts = { ...REF_DATE, ...(wd ? { weekday: wd } : {}) }; exportRender = true;
  try { drawScene(g, d.w, d.h, state || 'normal', false); } finally { clock = k.clock; dateParts = k.dateParts; exportRender = k.exportRender; project.elements = keepEls; }
  const px = g.getImageData(0, 0, d.w, d.h).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) { const o = (y * d.w + x) * 4; if (px[o] > 8 || px[o + 1] > 8 || px[o + 2] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  if (x1 < 0) return { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0, r: 0, b: 0 };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: (x0 + x1 + 1) / 2, cy: (y0 + y1 + 1) / 2, r: x1 + 1, b: y1 + 1 };
};
const shift = (names, dx, dy) => names.forEach((n) => { const e = E(n); e.x = Math.round(e.x + dx); e.y = Math.round(e.y + dy); });
// move the ink of `names` so that its left / cx / right edge and top / cy / bottom edge hit the targets
const align = async (names, o, state) => {
  const b = await inkBox(names, state); let dx = 0, dy = 0;
  if (o.l !== undefined) dx = o.l - b.x; else if (o.cx !== undefined) dx = o.cx - b.cx; else if (o.r !== undefined) dx = o.r - b.r;
  if (o.t !== undefined) dy = o.t - b.y; else if (o.cy !== undefined) dy = o.cy - b.cy; else if (o.b !== undefined) dy = o.b - b.b;
  shift(names, dx, dy); return inkBox(names, state);
};
// a row of layers left to right with an equal ink gap, centred on cx, vertically on cy
const seqRow = async (names, cx, cy, gap, state) => {
  const bs = []; for (const n of names) { await align([n], { cx: 195, cy: 225 }, state); bs.push(await inkBox([n], state)); }
  const tot = bs.reduce((s, b) => s + b.w, 0) + gap * (names.length - 1); let x = cx - tot / 2;
  for (let i = 0; i < names.length; i++) { await align([names[i]], { l: x, cy }, state); x += bs[i].w + gap; }
};
// park layers on screen so their size can be measured
const park = (names) => names.forEach((n) => { const e = E(n); e.x = 20; e.y = 20; });
// icon + reading chip: icon centred on cy, digits' ink centred on cy, the pair centred on cx
const chipAt = async (layer, kind, cx, cy, s, color, line, gap = 8) => {
  const icn = layer + ' icon';
  await addImg('ic_' + kind + '_' + color.replace('#', ''), icon(kind, s, color, line), 100, 100, icn);
  ll(layer, 100 + s + gap, cy); await align([icn], { cy }); await align([layer, icn], { cx }); return icn;
};
const batChipAt = async (layer, cx, cy, w, h, cols, frame, gap = 8, mkcell) => {
  await batterySet('bt' + frame.replace('#', ''), w, h, cols, frame, 100, 100, 'Battery level', mkcell);
  ll(layer, 100 + w + gap, cy); await align(['Battery level'], { cy }); await align([layer, 'Battery level'], { cx });
};
const pill = (g, x, y, w, h, fill, stroke) => { rr(g, x, y, w, h, h / 2); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); } };
// left-aligned chip: icon's left ink edge at l, reading after it, both centred on cy
const chipL = async (layer, kind, l, cy, s, color, line, gap = 8) => {
  const icn = layer + ' icon';
  await addImg('ic_' + kind + '_' + color.replace('#', ''), icon(kind, s, color, line), 100, 100, icn);
  ll(layer, 100 + s + gap, cy); await align([icn], { cy }); await align([layer, icn], { l }); return icn;
};
const allNames = ['Hour', 'Minute', 'Colon', 'Weekday', 'Day', 'Steps', 'Heart rate', 'Battery', 'Temperature', 'Sunrise', 'Sunset'];

// ---- sprite slots: a slot is one IMG layer with several pictures (F.<handle>), all on one canvas size ----
const BAKED = {}; let bakeN = 0;
const bake = (slug, key, w, h, fn) => { const id = slug + '|' + key; if (!BAKED[id]) { const c = mkc(w, h); fn(c.getContext('2d')); BAKED[id] = addProjectImage('sp/' + slug + '_' + String(bakeN++).padStart(3, '0') + '.png', c, {}).name; } return BAKED[id]; };
const SLOTS = {};      // handle -> { keys: [], names: [] }
const mkSlot = async (handle, label, variants, w, h, x, y, share) => {
  // variants: [[key, drawFn(g)], ...] all drawn on a w x h canvas; a blank picture is kept as the last one for hiding
  const all = variants.concat([['__blank', () => {}]]);
  const names = all.map(([k, fn]) => bake(share || handle, k, w, h, fn));
  const e = await addElement('IMG', { src: names[0] });
  Object.assign(e, { name: label, src: names[0], images: names, handle, x: Math.round(x), y: Math.round(y), show: 'normal' });
  SLOTS[handle] = { keys: all.map((v) => v[0]), el: e }; return e;
};
const VMAP = () => { const o = {}; for (const h in SLOTS) { o[h] = {}; SLOTS[h].keys.forEach((k, i) => { o[h][k] = i; }); } return o; };
// run the face's own code once at the reference time (10:09:36) against recording stubs, then make that the static state:
// positions/sizes as the code set them, the shown picture moved to first place (blank first where the code hides the slot)
const refPlace = (codeSrc) => {
  const ref0 = new Date(2026, 9, 24, 10, 9, 36).getTime(), refMs = globalThis.__REFADJ ? globalThis.__REFADJ(ref0) : ref0, rec = {}, RDate = Date;
  const stub = (h) => ({ setProperty: (p, v) => { rec[h] = Object.assign(rec[h] || {}, v); } });
  const Wp = new Proxy({}, { get: (o, h) => o[h] || (o[h] = stub(h)) });
  const Fp = new Proxy({}, { get: (o, h) => o[h] || (o[h] = new Proxy([], { get: (a, k) => 'ix' + k })) });
  class RD extends RDate { constructor(...a) { if (a.length) super(...a); else super(refMs); } static now() { return refMs; } }
  const ui = { prop: { MORE: 'MORE' }, widget: { WIDGET_DELEGATE: 'D' }, align: {}, createWidget: () => ({}) };
  new Function('ui', 'pxv', 'W', 'F', 'setTimeout', 'Date', codeSrc)(ui, Math.round, Wp, Fp, () => 0, RD);
  const swap = (s, i, j) => { const e = s.el; [s.keys[i], s.keys[j]] = [s.keys[j], s.keys[i]]; [e.images[i], e.images[j]] = [e.images[j], e.images[i]]; };
  for (const h in SLOTS) {
    const s = SLOTS[h], e = s.el, p = rec[h], bl = s.keys.indexOf('__blank');
    if (p) { if (p.x != null) e.x = p.x; if (p.y != null) e.y = p.y; if (p.w != null) { e.w = p.w; e.h = p.h; } }
    if (s.park) { e.x = s.park[0]; e.y = s.park[1]; if (!s.park[2]) { swap(s, 0, bl); e.src = e.images[0]; continue; } }
    const idx = p && p.src ? +String(p.src).slice(2) : 0;
    if (p && p.src && idx === bl) swap(s, 0, bl); else if (idx !== 0) swap(s, 0, idx);
    e.src = e.images[0];
  }
};
const fillCode = (CODE_SRC, RUNTIME_SRC) => CODE_SRC.replace('/*FW*/', String(globalThis.__FW || 0)).replace('/*TL*/0', String(globalThis.__TL || 0)).replace('/*CW*/0', String(globalThis.__CW || 0)).replace('/*K*/0', String(globalThis.__K || 0)).replace('/*PT*/0', String(globalThis.__PT || 0)).replace('/*PH*/0', String(globalThis.__PH || 0)).replace('/*PX*/0', String(globalThis.__PX || 0)).replace('/*V*/', 'const V = ' + JSON.stringify(VMAP()) + ';').replace('/*RUNTIME*/', RUNTIME_SRC);
const chipRow = async (groups, cx, gap) => {
  const ws = []; for (const g of groups) ws.push((await inkBox(g)).w);
  const tot = ws.reduce((a, b) => a + b, 0) + gap * (groups.length - 1); let x = cx - tot / 2;
  for (let i = 0; i < groups.length; i++) { await align(groups[i], { l: x }); x += ws[i] + gap; }
};
const textVariant = (s, size, fill, o = {}) => [s, (g) => txt(g, s, o.align === 'center' ? (o.w || 0) / 2 : (o.pad || 2), size * 1.05, size, fill, Object.assign({ align: o.align || 'left' }, o))];
const OFFX = -600;
// weekday + day row for names of any length (Romanian full names): names right-aligned in their cell, fixed ink gap to the day,
// shared baseline, row centred on the average name; layers must be parked first
const dateRow = async (cx, cy, gap) => {
  const W7 = []; for (let wd = 1; wd <= 7; wd++) W7.push(await inkBox(['Weekday'], 'normal', wd));
  const dB = await inkBox(['Day']);
  const mw = W7.reduce((s, b) => s + b.w, 0) / 7, avgR = W7.reduce((s, b) => s + b.r, 0) / 7, U0 = Math.min(...W7.map((b) => b.y));
  const Bn = W7.map((b) => b.b).sort((a, b) => a - b)[3]; const hRow = Math.max(Bn - U0, dB.h);
  const pivot = cx - (mw + gap + dB.w) / 2 + mw, base = cy + hRow / 2;
  shift(['Weekday'], Math.round(pivot - avgR), Math.round(base - Bn)); await align(['Day'], { l: pivot + gap, b: base });
};

// ---- segmented progress bar: native IMG_PROGRESS (data-bound, nothing to run); pictures[i] shows at pos[i] once the reading reaches i/N ----
const segBar = async (name, dataType, pictures, pos) => {
  const e = await addElement('IMG_PROGRESS', { dataType }); Object.assign(e, { name, dataType, images: pictures, positions: pos, x: pos[0][0], y: pos[0][1], show: 'normal' }); return e;
};

// the sunrise and sunset readings (SUN_RISE / SUN_SET) and their icons in ONE place; the watch shows the next one (showWhen sunset / sunrise).
// showWhen hides a layer in the editor too, so it is set only when the placement is done.
const swapSun = () => { for (const n of ['Sunrise', 'Sunrise icon']) { const e = E(n); if (e) e.showWhen = 'sunrise'; } for (const n of ['Sunset', 'Sunset icon']) { const e = E(n); if (e) e.showWhen = 'sunset'; } };
const sunChipAt = async (cx, cy, s, col, line, gap = 8) => { await chipAt('Sunrise', 'sunrise', cx, cy, s, col, line, gap); await chipAt('Sunset', 'sunset', cx, cy, s, col, line, gap); swapSun(); };
const sunChipL = async (l, cy, s, col, line, gap = 8) => { await chipL('Sunrise', 'sunrise', l, cy, s, col, line, gap); await chipL('Sunset', 'sunset', l, cy, s, col, line, gap); swapSun(); };
