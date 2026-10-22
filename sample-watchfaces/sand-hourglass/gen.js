// Sand Hourglass: a wooden hourglass that runs once a minute, the sand following the seconds of the clock.
// The bulbs are 61 pictures (one per second, swapped once a second); the falling sand is particles:
// a thin stream picture (length follows the pile), 8 grains that fall under gravity, and 4 grains that hop off the pile.
// The grains are ordinary layers with handles, so the glass sits over them. Pictures are reduced to 24 colours at export.
const fs = require('fs');

// Geometry shared by the node side (tables for the code on the watch) and the picture scripts.
const GEOM = `
const G = { W: 160, H: 380, cx: 80, yn: 190, y0: 18, R: 56, rn: 4, slope: 0.7, fill: 0.74 };
const rTop = (y) => { const t = Math.max(0, Math.min(1, (G.yn - y) / (G.yn - G.y0))); const p = t < 0.59 ? Math.sin(t / 0.59 * Math.PI / 2) : 1 - 0.25 * Math.pow((t - 0.59) / 0.41, 2); return G.rn + (G.R - G.rn) * p; };
const rAt = (y) => y <= G.yn ? rTop(y) : rTop(2 * G.yn - y);
const YB = 2 * G.yn - G.y0;
let Vbulb = 0; for (let y = G.y0; y < G.yn; y++) Vbulb += Math.PI * Math.pow(rAt(y + 0.5) - 2, 2);
const Vs = G.fill * Vbulb;
const pileVol = (apex) => { let v = 0; for (let y = Math.ceil(apex); y < YB; y++) { const w = Math.min(rAt(y + 0.5) - 2, (y + 0.5 - apex) / G.slope); if (w > 0) v += Math.PI * w * w; } return v; };
const solveApex = (V) => { let lo = G.yn, hi = YB; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (pileVol(m) > V) lo = m; else hi = m; } return (lo + hi) / 2; };
const topVol = (yt) => { let v = 0; for (let y = Math.ceil(yt); y < G.yn; y++) v += Math.PI * Math.pow(rAt(y + 0.5) - 2, 2); return v; };
const solveTop = (V) => { let lo = G.y0, hi = G.yn; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (topVol(m) > V) lo = m; else hi = m; } return (lo + hi) / 2; };
`;
const geo = new Function(GEOM + '; return { G, rAt, YB, Vs, solveApex, solveTop };')();
const APEX = [], TOPY = [];
for (let L = 0; L <= 60; L++) { APEX.push(+geo.solveApex(L / 60 * geo.Vs).toFixed(1)); TOPY.push(+geo.solveTop((1 - L / 60) * geo.Vs).toFixed(1)); }

const OX = 18, OY = 35, PREV = 36, GR = 8, HP = 4, SSTEP = 4, NS = 45;
const SLEN0 = Math.max(1, Math.min(NS, Math.round((APEX[PREV] - 191) / SSTEP)));

const pre = GEOM + `
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const profile = (g, inset) => { g.beginPath(); for (let y = G.y0; y <= YB; y += 2) g.lineTo(G.cx - rAt(y) + inset, y); for (let y = YB; y >= G.y0; y -= 2) g.lineTo(G.cx + rAt(y) - inset, y); g.closePath(); };
`;

const frameJS = pre + `
const c = mk(G.W, G.H), g = c.getContext('2d');
// faint tint of the empty glass
profile(g, 0); g.fillStyle = 'rgba(150,190,215,0.08)'; g.fill();
// posts
for (const x of [6, 145]) {
  const q = g.createLinearGradient(x, 0, x + 9, 0);
  q.addColorStop(0, '#2a1809'); q.addColorStop(0.25, '#8a5a2e'); q.addColorStop(0.5, '#c58b4a'); q.addColorStop(0.75, '#7a4d26'); q.addColorStop(1, '#24140a');
  g.fillStyle = q; g.fillRect(x, 12, 9, 356);
  for (const y of [34, 336]) { const b = g.createLinearGradient(x - 1, 0, x + 10, 0); b.addColorStop(0, '#6e4a14'); b.addColorStop(0.45, '#f1d37a'); b.addColorStop(1, '#6e4a14'); g.fillStyle = b; g.fillRect(x - 1, y, 11, 6); }
}
// plates
const plate = (y) => {
  g.save(); g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 5; g.shadowOffsetY = y < 100 ? 3 : -2;
  g.beginPath(); g.roundRect(2, y, 156, 18, 5); const q = g.createLinearGradient(0, y, 0, y + 18);
  q.addColorStop(0, '#b87a3e'); q.addColorStop(0.5, '#8a5a2e'); q.addColorStop(1, '#4d2e15'); g.fillStyle = q; g.fill(); g.restore();
  g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1;
  for (let i = 0; i < 7; i++) { const yy = y + 3 + i * 2.2; g.beginPath(); g.moveTo(6, yy); g.bezierCurveTo(50, yy + 1.5, 100, yy - 1.5, 154, yy + 0.5); g.stroke(); }
  g.fillStyle = '#e6bf62'; g.fillRect(4, y < 100 ? y + 15 : y, 152, 3);
  g.fillStyle = 'rgba(255,235,170,0.45)'; g.fillRect(6, y < 100 ? y + 1 : y + 16, 148, 1);
};
plate(0); plate(362);
names.push(addProjectImage('hg/frame.png', c, {}).name);
`;

const glassJS = pre + `
const c = mk(G.W, G.H), g = c.getContext('2d');
profile(g, 0);
let q = g.createLinearGradient(G.cx - G.R, 0, G.cx + G.R, 0); q.addColorStop(0, 'rgba(255,255,255,0.12)'); q.addColorStop(0.3, 'rgba(255,255,255,0.02)'); q.addColorStop(0.8, 'rgba(255,255,255,0)'); q.addColorStop(1, 'rgba(255,255,255,0.07)');
g.fillStyle = q; g.fill();
g.strokeStyle = 'rgba(205,232,250,0.6)'; g.lineWidth = 1.6; g.lineJoin = 'round'; g.stroke();
profile(g, 3.5); g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 1; g.stroke();
// specular streaks along the left and right sides of both bulbs
const streak = (y0, y1, side, off, a, w) => {
  const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.3, 'rgba(255,255,255,' + a + ')'); gr.addColorStop(0.75, 'rgba(255,255,255,' + a + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.strokeStyle = gr; g.lineWidth = w; g.lineCap = 'round'; g.beginPath();
  for (let y = y0; y <= y1; y += 2) g.lineTo(G.cx + side * (rAt(y) - off), y); g.stroke();
};
streak(G.y0 + 16, G.yn - 30, -1, 8, 0.55, 3.5); streak(G.yn + 30, YB - 14, -1, 8, 0.4, 3);
streak(G.y0 + 26, G.yn - 40, 1, 7, 0.2, 2); streak(G.yn + 40, YB - 22, 1, 7, 0.16, 2);
names.push(addProjectImage('hg/glass.png', c, {}).name);
`;

const sandJS = pre + `
const rIn = []; for (let y = 0; y < G.H; y++) rIn.push(Math.max(0, rAt(y + 0.5) - 2));
const hash = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
const LIGHT = [247, 218, 148], MID = [222, 178, 98], DARK = [162, 114, 54];
for (let L = 0; L <= 60; L++) {
  const f = L / 60, apex = solveApex(f * Vs), yt = solveTop((1 - f) * Vs);
  const dipD = 16 * Math.min(1, f * 12) * Math.min(1, (1 - f) * 5), rt = rIn[Math.min(G.H - 1, Math.floor(yt))] + 1e-6;
  const c = mk(G.W, G.H), g = c.getContext('2d'), im = g.createImageData(G.W, G.H), d = im.data;
  for (let y = G.y0; y < YB; y++) for (let x = 0; x < G.W; x++) {
    const dx = x + 0.5 - G.cx, ar = Math.abs(dx), r = rIn[y]; if (ar > r) continue;
    let surf;
    if (y < G.yn) surf = yt + dipD * Math.pow(1 - Math.min(1, ar / rt), 1.5); else surf = apex + G.slope * ar;
    const depth = y + 0.5 - surf; if (depth < -0.5) continue;
    if (y < G.yn && yt >= G.yn - 0.5) continue;
    const n = hash(x, y) - 0.5, shade = 1 - 0.42 * Math.pow(ar / (r + 2), 2.2);
    let k = 0.2 + 0.72 * shade + n * 0.55 + 0.05 * Math.sin(depth * 0.4 + ar * 0.06);
    if (depth < 2.5) k += 0.2 * (1 - depth / 2.5);
    k = clamp(k, 0, 1);
    const col = k < 0.5 ? mix(DARK, MID, k * 2) : mix(MID, LIGHT, (k - 0.5) * 2);
    const i = (y * G.W + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = Math.round(255 * clamp(depth + 0.5, 0, 1));
  }
  g.putImageData(im, 0, 0);
  names.push(addProjectImage('hg/sand_' + L + '.png', c, {}).name);
}
`;

const spriteJS = pre + `
// stream pictures: 4 px wide, lengths 4..${SSTEP * NS}, two dash phases for a shimmer
for (let ph = 0; ph < 2; ph++) for (let k = 1; k <= ${NS}; k++) {
  const h = k * ${SSTEP}, c = mk(4, h), g = c.getContext('2d'), im = g.createImageData(4, h), d = im.data;
  for (let y = 0; y < h; y++) { const m = 0.62 + 0.38 * Math.sin(y * 0.85 + ph * Math.PI); for (let x = 0; x < 4; x++) { const a = (x === 1 || x === 2 ? 0.95 : 0.3) * m, i = (y * 4 + x) * 4; d[i] = 244; d[i + 1] = 214; d[i + 2] = 140; d[i + 3] = Math.round(255 * a); } }
  g.putImageData(im, 0, 0);
  names.push(addProjectImage('hg/stream_' + ph + '_' + k + '.png', c, {}).name);
}
for (const [nm, col] of [['a', '#fbe3a6'], ['b', '#d9aa58']]) { const c = mk(4, 4), g = c.getContext('2d'); g.beginPath(); g.arc(2, 2, 1.6, 0, 7); g.fillStyle = col; g.fill(); names.push(addProjectImage('hg/grain_' + nm + '.png', c, {}).name); }
`;

const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const F = 'Bebas Neue';
const face = (size) => ({ font: F, size, fill: 'gradient', from: '#ffe7ae', to: '#d9983c', angle: 90, borderColor: '#1c0f03', borderWidth: 3 });
const small = (size) => ({ font: F, size, fill: 'solid', color: '#e8c27a' });
const dim = { font: F, size: 120, fill: 'solid', color: '#7a5a24' };
const tag = (suffix) => ({ script: `const n = project.elements.length; for (const i of [n-3,n-2,n-1]) project.elements[i].name += ' ${suffix}'; return 1` });
const lay = (name, extra) => `const e = await addElement('IMG', { src: names[0] }); e.name = '${name}'; e.src = names[0]; e.x = ${OX}; e.y = ${OY}; e.show = 'normal'; ${extra || ''} return 1`;

const grainSteps = [];
for (let i = 0; i < GR + HP; i++) {
  const hop = i >= GR;
  // preview positions: a stream of grains between the neck and the pile, and a few hops off the apex
  const ap = APEX[PREV], xs = hop ? OX + 80 + [-14, 11, -6, 17][i - GR] : OX + 79 + [0, 1, -1, 1, 0, -1, 1, 0][i];
  const ys = hop ? OY + ap - [8, 12, 5, 3][i - GR] : OY + 192 + (ap - 194) * (i + 0.5) / GR;
  grainSteps.push({ g: i, hop, x: Math.round(xs), y: Math.round(ys) });
}

const steps = [{ preset: 'bg' },
  wrap(frameJS, lay('Frame')),
  wrap(sandJS, `const e = await addElement('IMG', { src: names[${PREV}] }); e.name = 'Sand'; e.src = names[${PREV}]; e.images = names.slice(${PREV}).concat(names.slice(0, ${PREV})); e.handle = 'sand'; e.x = ${OX}; e.y = ${OY}; e.show = 'normal'; return names.length`),
  wrap(spriteJS, `
    const st0 = names.slice(0, ${2 * NS}), st = st0.slice(${SLEN0 - 1}).concat(st0.slice(0, ${SLEN0 - 1})), ga = names[${2 * NS}], gb = names[${2 * NS + 1}];
    const s = await addElement('IMG', { src: st[0] }); s.name = 'Sand stream'; s.src = st[0]; s.images = st.slice(); s.handle = 'stream'; s.x = ${OX + 78}; s.y = ${OY + 191}; s.show = 'normal';
    const pos = ${JSON.stringify(grainSteps.map((q) => [q.x, q.y]))};
    for (let i = 0; i < pos.length; i++) { const e = await addElement('IMG', { src: i % 2 ? gb : ga }); e.name = (i < ${GR} ? 'Grain ' : 'Hop grain ') + (i < ${GR} ? i + 1 : i - ${GR} + 1); e.src = i % 2 ? gb : ga; e.handle = (i < ${GR} ? 'g' : 'h') + (i < ${GR} ? i : i - ${GR}); e.x = pos[i][0]; e.y = pos[i][1]; e.show = 'normal'; }
    return pos.length`),
  wrap(glassJS, lay('Glass')),
  { script: `project.groups = project.groups || {}; project.groups.gHg = 'Hourglass'; let n = 0; for (const e of project.elements) { if (['Frame','Sand','Sand stream','Glass'].includes(e.name) || /^(Hop grain|Grain) \\d/.test(e.name)) { e.group = 'gHg'; n++ } } return n` },
  { preset: 'clock' }, tag('Main'), { preset: 'clock' }, tag('Aod'), { preset: 'weekday' }, { preset: 'day' }, { preset: 'steps' }, { preset: 'battery' },
  { remove: 'Colon Main' }, { remove: 'Colon Aod' },
  { edit: 'Hour Main', set: { x: 209, y: 90, show: 'normal', zero: 1 }, glyph: face(160) },
  { edit: 'Minute Main', set: { x: 213, y: 233, show: 'normal', zero: 1 }, glyph: face(160) },
  { edit: 'Hour Aod', set: { x: 139, y: 107, show: 'aod', zero: 1 }, glyph: dim },
  { edit: 'Minute Aod', set: { x: 142, y: 247, show: 'aod', zero: 1 }, glyph: dim },
  { edit: 'Weekday', set: { x: 232, y: 30, show: 'normal' }, glyph: small(40) },
  { edit: 'Day', set: { x: 294, y: 37, space: -3, show: 'normal' }, glyph: small(40) },
  { edit: 'Steps', set: { x: 206, y: 379, hSpace: -2, show: 'normal' }, glyph: small(38) },
  { edit: 'Battery', set: { x: 297, y: 379, hSpace: -2, show: 'normal' }, glyph: small(38) },
  { script: `project.groups = project.groups || {}; project.groups.gDate = 'Date'; let n = 0; for (const e of project.elements) { if (e.name === 'Weekday' || e.name === 'Day' || e.name === 'Month') { e.group = 'gDate'; n++ } } for (const k of Object.keys(project.groups)) if (project.groups[k] === 'Clock 2') project.groups[k] = 'Clock AOD'; return n` },
  { script: `document.getElementById('btnPruneImages').click(); return project.images.length + ' images left'` },
];

const userImports = "import { Time as DCTime } from '@zos/sensor'";
const userCode = `{
  const OX = ${OX}, OY = ${OY}, CX = OX + 80, YN = OY + 190, YB = OY + 362, SLOPE = 0.7, NS = ${NS}, STEP = ${SSTEP}
  const GR = ${GR}, HP = ${HP}, MS = 70, GRAV = 1100
  const APEX = ${JSON.stringify(APEX)}
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  let id = null, via = '', n = 0, curL = -1, last = 0, clock = null
  try { clock = new DCTime() } catch (e) {}
  const seconds = () => {
    try { if (clock) { const s = clock.getSeconds(); if (typeof s === 'number' && s >= 0) return s } } catch (e) {}
    try { const s = new Date().getSeconds(); if (typeof s === 'number' && s >= 0) return s } catch (e) {}
    return Math.floor(n * MS / 1000) % 60
  }
  const away = (w) => w.setProperty(ui.prop.MORE, { x: pxv(-20), y: pxv(0) })
  const gr = [], hp = []
  for (let i = 0; i < GR; i++) gr.push({ w: W['g' + i], y: YN + rnd() * 80, vy: 0, dx: 0 })
  for (let i = 0; i < HP; i++) hp.push({ w: W['h' + i], on: false, x: 0, y: 0, vx: 0, vy: 0 })
  const surf = (x, apex) => Math.min(YB, apex + SLOPE * Math.abs(x - CX))
  const tick = () => {
    n++
    const now = Date.now(), dt = Math.min(0.12, last ? (now - last) / 1000 : MS / 1000); last = now
    const L = Math.min(60, seconds())
    const apex = OY + APEX[L]
    if (L !== curL) { curL = L; W.sand.setProperty(ui.prop.MORE, { x: pxv(OX), y: pxv(OY), src: F.sand[(L - ${PREV} + 61) % 61] }) }
    if (L >= 60) { away(W.stream); for (const g of gr) away(g.w); }
    else {
      const k = Math.max(1, Math.min(NS, Math.round((apex - YN - 1) / STEP)))
      W.stream.setProperty(ui.prop.MORE, { x: pxv(CX - 2), y: pxv(YN + 1), src: F.stream[((n % 2) * NS + k - 1 - ${SLEN0 - 1} + 2 * NS) % (2 * NS)] })
      for (const g of gr) {
        g.vy += GRAV * dt; g.y += g.vy * dt
        if (g.y >= apex - 1) {
          const h = hp.find((q) => !q.on)
          if (h && rnd() < 0.6) { h.on = true; h.x = CX + (rnd() - 0.5) * 4; h.y = apex - 2; h.vx = (rnd() - 0.5) * 90; h.vy = -(45 + rnd() * 60) }
          g.y = YN + 1; g.vy = 0; g.dx = Math.round(rnd() * 2) - 1
        }
        g.w.setProperty(ui.prop.MORE, { x: pxv(CX - 1 + g.dx), y: pxv(Math.round(g.y)) })
      }
    }
    for (const h of hp) {
      if (!h.on) { away(h.w); continue }
      h.vy += GRAV * dt; h.x += h.vx * dt; h.y += h.vy * dt
      if (h.vy > 0 && h.y >= surf(h.x, apex) - 1) { h.on = false; away(h.w); continue }
      h.w.setProperty(ui.prop.MORE, { x: pxv(Math.round(h.x)), y: pxv(Math.round(h.y)) })
    }
  }
  const safe = () => { try { tick() } catch (e) {} }
  const stop = () => {
    if (id === null) return
    try { if (via === 't') timer.stopTimer(id); else clearInterval(id) } catch (e) {}
    id = null
  }
  const start = () => {
    if (id !== null) return
    last = 0
    try {
      if (typeof setInterval === 'function') { id = setInterval(safe, MS); via = 'i' }
      else if (typeof timer !== 'undefined' && timer && timer.createTimer) { id = timer.createTimer(0, MS, safe); via = 't' }
    } catch (e) {}
  }
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: () => { curL = -1; start() }, pause_call: stop })
  safe()
  start()
}`;
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: 'Sand Hourglass', device: 'bip-6', font: F, description: 'A wooden hourglass that runs once a minute: the sand follows the seconds, a thin stream falls from the neck with grains that tumble off the pile.', preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/sand-hourglass', optimizePng: 24, userImports, userCode, steps }, null, 1));
console.log('apex', APEX[0], APEX[30], APEX[59], APEX[60], 'top', TOPY[0], TOPY[30], TOPY[59]);
