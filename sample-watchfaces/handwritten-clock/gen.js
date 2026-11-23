// Handwritten Clock: a drawing table. A dark wooden desk, a wooden board frame with brass screws and a slate board with a faint grid (one picture, drawn
// in the editor by the recipe below), and on the board the time stacked in two rows (hours over minutes), which a pen WRITES in chalk: the digits are the Hershey
// "Script 1-stroke" font (build/digits.json, see build/NOTICE.txt), smoothed here, and the watch draws their strokes one segment after another
// with drawLine (a pen speed of 1 px per ms, each digit a little different in slant, size and position, like a real hand). At every wake and tap
// the whole time is written again; when the minute changes only the digits that changed are wiped and rewritten. The ink stays on the canvas, a second canvas above it shows the chalk's tip and a puff of dust
// when a digit is done, and the face costs nothing while it rests (one time check a second). The always-on screen stays black. After face-cli nothing more to run.
const fs = require('fs')
const raw = JSON.parse(fs.readFileSync(__dirname + '/build/digits.json', 'utf8'))
// ---- the glyphs: Chaikin-smoothed, the top of the tallest digit at y 0, every digit starting at x 0 ----
const chaikin = (p, n) => { for (let k = 0; k < n; k++) { if (p.length < 3) return p; const q = [p[0]]; for (let i = 0; i < p.length - 1; i++) { const a = p[i], b = p[i + 1]; q.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]) } q.push(p[p.length - 1]); p = q } return p }
const GLY = {}
let minY = 1e9, maxY = -1e9
for (const [ch, strokes] of Object.entries(raw)) {
  const ss = strokes.map((s) => { const pts = []; for (let i = 0; i < s.length; i += 2) pts.push([s[i], s[i + 1]]); return chaikin(pts, 2) })
  const xs = ss.flat().map((p) => p[0]), ys = ss.flat().map((p) => p[1])
  GLY[ch] = { minX: Math.min(...xs), w: Math.max(...xs) - Math.min(...xs), ss }
  minY = Math.min(minY, ...ys); maxY = Math.max(maxY, ...ys)
}
const r1 = (v) => Math.round(v * 10) / 10
const DATA = {}
for (const [ch, g] of Object.entries(GLY)) DATA[ch] = { w: r1(g.w), s: g.ss.map((s) => s.flatMap((p) => [r1(p[0] - g.minX), r1(p[1] - minY)])) }
const WC = r1(Math.max(...Object.values(GLY).map((g) => g.w))), HC = r1(maxY - minY), GAPU = 1.5, RGAP = 14
// ---- layout: the board and the two rows of two cells on it ----
const FRAME = { x: 34, y: 54, w: 322, h: 342, t: 14 }                           // the wooden frame (outer box) and its thickness; the slate board is inside it
const CV = { x: 54, y: 74, w: 282, h: 302 }                                    // the canvas layer: the board's writing area; slot coordinates below are local to it
const ROWU = 2 * WC + GAPU, S = 5.4
const X0 = (CV.w - ROWU * S) / 2, Y0 = (CV.h - (2 * HC * S + RGAP)) / 2
const SLOTS = [0, 1, 2, 3].map((i) => ({ x: Math.round(X0 + (i % 2) * (WC + GAPU) * S), y: Math.round(Y0 + Math.floor(i / 2) * (HC * S + RGAP)) }))
const INK = 0xf4ecd8, PEN = 4
const userImports = "import { Time } from '@zos/sensor'"
const userCode = String.raw`
const DEBUG = false                                      // true: log to the developer bridge
const say = (m) => { if (DEBUG) console.log('[hw] ' + m) }
const cv = W.k1, cd = W.k2                              // the Canvas layers of the layout: the ink (handle k1) and, above it, the chalk tip and dust (handle k2)
const GL = ${JSON.stringify(DATA)}
const S = ${S}, WC = ${WC}, HC = ${HC}, SLOTS = ${JSON.stringify(SLOTS)}, CW = ${CV.w}, CH = ${CV.h}, INK = ${INK}, PEN = ${PEN}
const SPEED = 1.0, LIFT = 70                             // pen speed (px per ms) and the distance the pen travels between two digits
const tm = new Time()
const LN = { x1: 0, y1: 0, x2: 0, y2: 0, color: INK }, CC = { center_x: 0, center_y: 0, radius: PEN / 2, color: INK }, PT = { color: INK, line_width: PEN }
let jobs = [], t0 = 0, shown = [null, null, null, null], timer = null
// chalk dust: when a digit is finished a few grains drift off its last stroke and fade into the board (their colour runs to the slate)
let puffs = [], tipX = -1, tipY = -1, dustOn = false
const DC = { center_x: 0, center_y: 0, radius: 3, color: 0xffffff }, DR = { x1: 0, y1: 0, x2: 0, y2: 0, color: 0 }
const puff = (x, y, now) => { const parts = []; for (let k = 0; k < 18; k++) parts.push({ vx: (Math.random() - 0.3) * 0.1, vy: -Math.random() * 0.07, s: 2 + Math.floor(Math.random() * 3) }); puffs.push({ x: x, y: y, t0: now, parts: parts }) }
const mix = (k) => { const a = 0xf4, b = 0x1d, c1 = 0xec, d = 0x28, e = 0xd8, f = 0x24, kk = Math.min(1, k); return (Math.round(a + (b - a) * kk) << 16) | (Math.round(c1 + (d - c1) * kk) << 8) | Math.round(e + (f - e) * kk) }
const drawDust = (now) => {
  const live = puffs.length > 0 || tipX >= 0
  if (!live && !dustOn) return
  cd.clear({ x: 0, y: 0, w: CW, h: CH }); dustOn = live
  puffs = puffs.filter((p) => now - p.t0 < 700)
  for (const p of puffs) { const dt = now - p.t0, k = dt / 700; DR.color = mix(Math.pow(k, 0.7)); for (const q of p.parts) { DR.x1 = Math.round(p.x + q.vx * dt); DR.y1 = Math.round(p.y + q.vy * dt + 0.00012 * dt * dt); DR.x2 = DR.x1 + q.s; DR.y2 = DR.y1 + q.s; cd.drawRect(DR) } }
  if (tipX >= 0) { DC.center_x = Math.round(tipX); DC.center_y = Math.round(tipY); DC.radius = 4; DC.color = 0x8a8374; cd.drawCircle(DC); DC.radius = 2; DC.color = 0xffffff; cd.drawCircle(DC) }     // the chalk's tip
}
// one digit, written by hand: its strokes as segments in canvas coordinates, with a little random slant, size and position
const makeJob = (slot, ch) => {
  const g = GL[ch], sc = S * (0.97 + Math.random() * 0.06), rot = (Math.random() - 0.5) * 0.08, jx = (Math.random() - 0.5) * 5, jy = (Math.random() - 0.5) * 5
  const cs = Math.cos(rot), sn = Math.sin(rot), cx = SLOTS[slot].x + WC * S / 2 + jx, cy = SLOTS[slot].y + HC * S / 2 + jy
  const segs = []; let d = 0
  for (const st of g.s) {
    let px = 0, py = 0
    for (let i = 0; i < st.length; i += 2) {
      const x = (st[i] - g.w / 2) * sc, y = (st[i + 1] - HC / 2) * sc, X = cx + x * cs - y * sn, Y = cy + x * sn + y * cs
      if (i) { d += Math.hypot(X - px, Y - py); segs.push({ x1: px, y1: py, x2: X, y2: Y, d: d, first: i === 2, last: i === st.length - 2 }) }
      px = X; py = Y
    }
  }
  return { slot: slot, segs: segs, i: 0, len: d, off: 0 }
}
const enqueue = (slot, ch, pen) => {
  const j = makeJob(slot, ch), last = jobs.length ? jobs[jobs.length - 1] : null
  j.off = last ? last.off + last.len + LIFT : pen
  jobs.push(j)
}
const wipe = (slot) => { cv.clear({ x: Math.max(0, SLOTS[slot].x - 12), y: Math.max(0, SLOTS[slot].y - 12), w: WC * S + 24, h: HC * S + 24 }) }
const tick = () => {
  timer = null
  const now = Date.now()
  try {
    const hh = tm.getHours(), mm = tm.getMinutes(), str = (hh < 10 ? '0' : '') + hh + (mm < 10 ? '0' : '') + mm
    if (!jobs.length) t0 = now
    // a digit changed: wipe it and every digit still waiting for the pen, then write them again in order (an old pending digit must not be drawn over a new one)
    const redo = []
    for (let i = 0; i < 4; i++) if (shown[i] !== str.charAt(i)) redo.push(i)
    if (redo.length) {
      for (const j of jobs) if (redo.indexOf(j.slot) < 0) redo.push(j.slot)
      redo.sort(); jobs = []; t0 = now
      for (const i of redo) { shown[i] = str.charAt(i); wipe(i); enqueue(i, str.charAt(i), 0) }
    }
    const pen = (now - t0) * SPEED
    cv.setPaint(PT)
    while (jobs.length) {
      const j = jobs[0]
      while (j.i < j.segs.length && j.off + j.segs[j.i].d <= pen) {
        const sg = j.segs[j.i++]
        if (sg.first) { CC.center_x = Math.round(sg.x1); CC.center_y = Math.round(sg.y1); cv.drawCircle(CC) }
        LN.x1 = Math.round(sg.x1); LN.y1 = Math.round(sg.y1); LN.x2 = Math.round(sg.x2); LN.y2 = Math.round(sg.y2); cv.drawLine(LN)
        CC.center_x = LN.x2; CC.center_y = LN.y2; cv.drawCircle(CC)                    // round joints and ends, like a pen
      }
      if (j.i >= j.segs.length) { const sg = j.segs[j.segs.length - 1]; if (sg) puff(sg.x2, sg.y2, now); jobs.shift() } else { const sg = j.segs[Math.max(0, j.i - 1)]; tipX = sg.x2; tipY = sg.y2; break }
    }
    if (!jobs.length) tipX = -1
    drawDust(now)
  } catch (e) { say('draw: ' + e); return }
  timer = setTimeout(tick, jobs.length || puffs.length ? 16 : 1000)
}
const stop = () => { if (timer) { try { clearTimeout(timer) } catch (e) {} timer = null } }
const start = () => { stop(); jobs = []; puffs = []; tipX = -1; shown = [null, null, null, null]; cv.clear({ x: 0, y: 0, w: CW, h: CH }); cd.clear({ x: 0, y: 0, w: CW, h: CH }); t0 = Date.now(); tick() }
try { cv.addEventListener(ui.event.CLICK_UP, start); cd.addEventListener(ui.event.CLICK_UP, start) } catch (e) { say('tap: ' + e) }
ui.createWidget(ui.widget.WIDGET_DELEGATE, { pause_call: stop, resume_call: start })
start()`;
// the editor / store still: the time 10:09 written in the same font and layout (hidden on the watch, where the canvas draws)
const stillScript = `
const DATA = ${JSON.stringify(DATA)}, S = ${S}, WC = ${WC}, HC = ${HC}, SLOTS = ${JSON.stringify(SLOTS)}
const c = document.createElement('canvas'); c.width = 390; c.height = 450; const g = c.getContext('2d')
g.strokeStyle = '#f4ecd8'; g.lineWidth = ${PEN}; g.lineCap = 'round'; g.lineJoin = 'round'
'1009'.split('').forEach((ch, i) => { const gl = DATA[ch], ox = ${CV.x} + SLOTS[i].x + (WC - gl.w) * S / 2, oy = ${CV.y} + SLOTS[i].y
  gl.s.forEach((st) => { g.beginPath(); for (let k = 0; k < st.length; k += 2) { const x = ox + st[k] * S, y = oy + st[k + 1] * S; k ? g.lineTo(x, y) : g.moveTo(x, y) } g.stroke() }) })
const n = addProjectImage('hw/still.png', c, {}).name; await loadAllImages()
const e = await addElement('IMG', { src: n }); Object.assign(e, { name: 'Handwriting (preview)', src: n, x: 0, y: 0, show: 'normal', previewOnly: true }); return n`;
// the desk, the frame and the board: one picture drawn here (seeded, so a rebuild gives the same wood)
const deskScript = `
const c = document.createElement('canvas'); c.width = 390; c.height = 450; const g = c.getContext('2d')
let seed = 11; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
// desk: dark walnut with long grain lines and a soft vignette
const wood = g.createLinearGradient(0, 0, 390, 450); wood.addColorStop(0, '#5b3b24'); wood.addColorStop(1, '#3a2415'); g.fillStyle = wood; g.fillRect(0, 0, 390, 450)
for (let i = 0; i < 150; i++) { const y = rnd() * 450, a = 0.04 + rnd() * 0.08, dark = rnd() < 0.6; g.strokeStyle = dark ? 'rgba(20,10,4,' + a + ')' : 'rgba(255,220,170,' + a * 0.6 + ')'; g.lineWidth = 0.6 + rnd() * 1.6
  g.beginPath(); let yy = y; g.moveTo(0, yy); for (let x = 0; x <= 390; x += 30) { yy += (rnd() - 0.5) * 3; g.lineTo(x, yy) } g.stroke() }
const vg = g.createRadialGradient(195, 225, 120, 195, 225, 330); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = vg; g.fillRect(0, 0, 390, 450)
const F = ${JSON.stringify(FRAME)}
const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath() }
// the frame: light oak, a soft shadow on the desk, a bevel (light top-left, dark bottom-right)
g.save(); g.shadowColor = 'rgba(0,0,0,0.65)'; g.shadowBlur = 22; g.shadowOffsetX = 5; g.shadowOffsetY = 8
const fg = g.createLinearGradient(F.x, F.y, F.x + F.w, F.y + F.h); fg.addColorStop(0, '#d9ac72'); fg.addColorStop(0.5, '#b88650'); fg.addColorStop(1, '#8a5e33')
g.fillStyle = fg; rr(F.x, F.y, F.w, F.h, 14); g.fill(); g.restore()
for (let i = 0; i < 60; i++) { const y = F.y + rnd() * F.h; g.strokeStyle = 'rgba(70,40,15,' + (0.05 + rnd() * 0.08) + ')'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(F.x + 4, y); g.lineTo(F.x + F.w - 4, y + (rnd() - 0.5) * 3); g.stroke() }
g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,235,200,0.55)'; rr(F.x + 1, F.y + 1, F.w - 2, F.h - 2, 13); g.stroke()
g.strokeStyle = 'rgba(40,20,5,0.55)'; rr(F.x + F.t - 1, F.y + F.t - 1, F.w - 2 * F.t + 2, F.h - 2 * F.t + 2, 7); g.stroke()
// the board: dark slate with a faint drafting grid and a thin margin line
const bx = F.x + F.t, by = F.y + F.t, bw = F.w - 2 * F.t, bh = F.h - 2 * F.t
const bg = g.createLinearGradient(bx, by, bx + bw, by + bh); bg.addColorStop(0, '#26332f'); bg.addColorStop(1, '#18211e'); g.fillStyle = bg; rr(bx, by, bw, bh, 6); g.fill()
g.save(); rr(bx, by, bw, bh, 6); g.clip(); g.lineWidth = 1
for (let x = bx + 12; x < bx + bw; x += 20) { g.strokeStyle = ((x - bx - 12) % 100 === 0) ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.045)'; g.beginPath(); g.moveTo(x, by); g.lineTo(x, by + bh); g.stroke() }
for (let y = by + 12; y < by + bh; y += 20) { g.strokeStyle = ((y - by - 12) % 100 === 0) ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.045)'; g.beginPath(); g.moveTo(bx, y); g.lineTo(bx + bw, y); g.stroke() }
const sh = g.createLinearGradient(bx, by, bx, by + 26); sh.addColorStop(0, 'rgba(0,0,0,0.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.fillRect(bx, by, bw, 26)     // the frame's inner shadow
g.restore()
g.strokeStyle = 'rgba(244,236,216,0.16)'; g.lineWidth = 1; rr(bx + 8, by + 8, bw - 16, bh - 16, 3); g.stroke()
// brass screws in the frame's corners
for (const [sx, sy] of [[F.x + 7, F.y + 7], [F.x + F.w - 7, F.y + 7], [F.x + 7, F.y + F.h - 7], [F.x + F.w - 7, F.y + F.h - 7]]) {
  const sg = g.createRadialGradient(sx - 1.5, sy - 1.5, 0.5, sx, sy, 4.5); sg.addColorStop(0, '#f6dc8e'); sg.addColorStop(1, '#8c6a1e'); g.fillStyle = sg; g.beginPath(); g.arc(sx, sy, 4, 0, Math.PI * 2); g.fill()
  g.strokeStyle = 'rgba(60,40,5,0.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(sx - 2.5, sy - 2.5); g.lineTo(sx + 2.5, sy + 2.5); g.stroke() }
// props on the desk (the rows above and below the frame): a pencil, a chalk stub and a ruler, each with a soft shadow
const prop = (draw, x, y, rot, w, h) => { g.save(); g.translate(x, y); g.rotate(rot); g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 5; g.shadowOffsetX = 2; g.shadowOffsetY = 3; draw(w, h); g.restore() }
// pencil: a yellow hexagonal body with light and dark flats, a metal ferrule, a pink eraser, a sharpened wooden cone and a graphite tip
prop((w, h) => { const bg2 = g.createLinearGradient(0, -h / 2, 0, h / 2); bg2.addColorStop(0, '#f6d44a'); bg2.addColorStop(0.5, '#e8b92a'); bg2.addColorStop(1, '#b8861a')
  g.fillStyle = bg2; g.fillRect(34, -h / 2, w - 34 - 26, h)
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(34, -h / 2 + 1.5, w - 60, 2); g.fillStyle = 'rgba(80,50,0,0.35)'; g.fillRect(34, h / 2 - 3, w - 60, 2.5)
  const fg2 = g.createLinearGradient(0, -h / 2, 0, h / 2); fg2.addColorStop(0, '#e9e9e9'); fg2.addColorStop(0.5, '#a9a9a9'); fg2.addColorStop(1, '#6f6f6f'); g.fillStyle = fg2; g.fillRect(w - 26, -h / 2, 12, h)
  g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.8; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(w - 23 + k * 3, -h / 2); g.lineTo(w - 23 + k * 3, h / 2); g.stroke() }
  g.fillStyle = '#e88aa0'; rr(w - 14, -h / 2 + 0.5, 14, h - 1, 3); g.fill()
  g.fillStyle = '#e7c493'; g.beginPath(); g.moveTo(34, -h / 2); g.lineTo(8, -2); g.lineTo(8, 2); g.lineTo(34, h / 2); g.closePath(); g.fill()
  g.fillStyle = '#2b2b2b'; g.beginPath(); g.moveTo(14, -3); g.lineTo(0, 0); g.lineTo(14, 3); g.closePath(); g.fill() }, 76, 25, -0.045, 190, 11)
// chalk stub: a short white cylinder with a worn, dusty end
prop((w, h) => { const cg = g.createLinearGradient(0, -h / 2, 0, h / 2); cg.addColorStop(0, '#fbf8ef'); cg.addColorStop(0.55, '#e6e0d0'); cg.addColorStop(1, '#b9b1a0'); g.fillStyle = cg; rr(-w / 2, -h / 2, w, h, 4); g.fill()
  g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(-w / 2 + 3, -h / 2 + 1.5, w - 8, 1.6)
  for (let k = 0; k < 14; k++) { g.fillStyle = 'rgba(255,255,250,' + (0.1 + rnd() * 0.25) + ')'; g.beginPath(); g.arc(w / 2 + 2 + rnd() * 9, (rnd() - 0.5) * 12, 0.6 + rnd() * 1.4, 0, 7); g.fill() } }, 308, 28, 0.16, 36, 13)
// ruler along the bottom: pale wood with a bevel, tick marks every 5 px, longer every 25 px and numbered every 50 px
prop((w, h) => { const rg = g.createLinearGradient(0, -h / 2, 0, h / 2); rg.addColorStop(0, '#f1d58a'); rg.addColorStop(1, '#c9a24f'); g.fillStyle = rg; rr(-w / 2, -h / 2, w, h, 3); g.fill()
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-w / 2 + 2, -h / 2 + 1); g.lineTo(w / 2 - 2, -h / 2 + 1); g.stroke()
  g.strokeStyle = 'rgba(60,35,5,0.85)'; g.fillStyle = 'rgba(60,35,5,0.9)'; g.font = '8px sans-serif'; g.textAlign = 'center'
  for (let k = 0; k <= 50; k++) { const x = -w / 2 + 6 + k * 5, L = k % 10 === 0 ? 11 : k % 5 === 0 ? 8 : 5; g.lineWidth = k % 5 === 0 ? 1.1 : 0.8; g.beginPath(); g.moveTo(x, -h / 2 + 1); g.lineTo(x, -h / 2 + 1 + L); g.stroke(); if (k % 10 === 0) g.fillText(String(k / 10), x, -h / 2 + 21) } }, 195, 423, 0, 262, 26)
const n = addProjectImage('hw/desk.png', c, {}).name; await loadAllImages()
const e = await addElement('IMG', { src: n }); Object.assign(e, { name: 'Desk and frame', src: n, x: 0, y: 0, show: 'normal' }); return n`;
const steps = [
  { script: 'project.appId = 2024153; return 1' },
  { script: deskScript },
  { script: stillScript },
  { script: `for (const [h, nm] of [['k1', 'Handwriting canvas'], ['k2', 'Chalk dust canvas']]) { const e = await addElement('CANVAS', { x: ${CV.x}, y: ${CV.y}, w: ${CV.w}, h: ${CV.h}, show: 'normal', handle: h }); Object.assign(e, { x: ${CV.x}, y: ${CV.y}, name: nm }) } return 2` },
];
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: 'Handwritten Clock', device: 'bip-6', language: 'en-US', optimizePng: 'lossless',
  description: 'The time is written by a pen: big handwritten digits (a Hershey script font) drawn stroke by stroke by the watch on a canvas layer at every wake, tap and minute change.',
  preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/handwritten-clock', userImports, userCode, steps }, null, 1));
console.log('recipe.json written; S', S, 'WC', WC, 'HC', HC, 'slots', JSON.stringify(SLOTS));
