// Equalizer VFD: canvas only. A vintage car-stereo vacuum-fluorescent display: a slanted cyan 7-segment clock (the unlit segments show as a ghost "8") above a
// 18 x 20 spectrum analyzer of 2:1 blocks (18 x 9 px) with a peak-hold block on every column. The watch has no audio, so the spectrum is a made-up music
// pattern (a hump across the bands, a beat that kicks the low end). It plays for about 5 s (the bars rise, dance, then fall back to a one-block floor and the peaks
// drop onto them) and then STOPS: the screen stays still and only a once-a-second check of the clock runs (battery). A new play starts on every wake-up,
// on a tap and when the minute changes (the segments then fade out and in like phosphor). One opaque canvas; only the blocks and segments that change are
// redrawn. The always-on screen stays black.
const fs = require('fs')
const userImports = "import { Time } from '@zos/sensor'"
const SEGJS = String.raw`
const segPolys = (x, y, w, h, th, sl) => {
  const g = 2, P = (pts) => pts.map((p) => [p[0] + (y + h - p[1]) * sl, p[1]])
  const hs = (cy) => { const xl = x + th * 0.5 + g, xr = x + w - th * 0.5 - g; return P([[xl, cy], [xl + th / 2, cy - th / 2], [xr - th / 2, cy - th / 2], [xr, cy], [xr - th / 2, cy + th / 2], [xl + th / 2, cy + th / 2]]) }
  const vs = (cx, y0, y1) => { const yt = y0 + g, yb = y1 - g; return P([[cx, yt], [cx + th / 2, yt + th / 2], [cx + th / 2, yb - th / 2], [cx, yb], [cx - th / 2, yb - th / 2], [cx - th / 2, yt + th / 2]]) }
  const mid = y + h / 2
  return { a: hs(y + th / 2), g: hs(mid), d: hs(y + h - th / 2), f: vs(x + th / 2, y + th / 2, mid), b: vs(x + w - th / 2, y + th / 2, mid), e: vs(x + th / 2, mid, y + h - th / 2), c: vs(x + w - th / 2, mid, y + h - th / 2) }
}
const SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' }
const XS = [30, 102, 216, 288], DY0 = 46, DW = 60, DH = 118, DTH = 13, DSL = 0.1
const BW = 18, BH = 9, PX = 20, PY = 11, NC = 18, NR = 20, AX = 16, AB = 432`;
const userCode = String.raw`
const DEBUG = true                                       // logs to the developer bridge (zeus bridge): frames per second while the display plays
let logN = 0
const say = (m) => { if (DEBUG) console.log('[eq ' + (++logN) + '] ' + m) }
const cv = W.k1
${SEGJS}
const tm = new Time()
const mixc = (a, b, t) => (Math.round(a[0] + (b[0] - a[0]) * t) << 16) | (Math.round(a[1] + (b[1] - a[1]) * t) << 8) | Math.round(a[2] + (b[2] - a[2]) * t)
const BGA = [3, 7, 11], GHA = [7, 30, 40], LITA = [70, 232, 255], COREA = [215, 252, 255]
const BG = mixc(BGA, BGA, 0), GHOST = mixc(GHA, GHA, 0)
const R1 = { x1: 0, y1: 0, x2: 0, y2: 0, color: 0 }, PP = { data_array: null, color: 0 }
const rect = (x1, y1, x2, y2, col) => { R1.x1 = x1; R1.y1 = y1; R1.x2 = x2; R1.y2 = y2; R1.color = col; cv.drawRect(R1) }
const poly = (pts, col) => { PP.data_array = pts; PP.color = col; cv.drawPoly(PP) }
// ---- clock: 4 x 7 segments + the colon ----
const SG = []
for (let i = 0; i < 4; i++) {
  const P = segPolys(XS[i], DY0, DW, DH, DTH, DSL)
  for (const s of 'abcdefg') {
    const pts = P[s].map((p) => ({ x: Math.round(p[0]), y: Math.round(p[1]) }))
    let mx = 0, my = 0; pts.forEach((p) => { mx += p.x; my += p.y }); mx /= 6; my /= 6
    SG.push({ i, s, pts, core: pts.map((p) => ({ x: Math.round(mx + (p.x - mx) * 0.55), y: Math.round(my + (p.y - my) * 0.55) })) })
  }
}
const NS = SG.length, CCX = Math.round((XS[1] + DW + XS[2]) / 2 + 4)
const sl = new Array(NS).fill(0), dl = new Array(NS).fill(-1)
const SLV = []; for (let l = 0; l <= 6; l++) SLV.push({ base: mixc(GHA, LITA, l / 6), core: l >= 3 ? mixc(LITA, COREA, 0.45 * l / 6) : mixc(GHA, LITA, l / 6) })
const drawSeg = (k, l) => { const g = SG[k]; poly(g.pts, SLV[l].base); if (l >= 3) poly(g.core, SLV[l].core) }
let colonOn = -1
const drawColon = (on) => { for (const dy of [DY0 + 40, DY0 + 80]) rect(CCX - 7, dy - 7, CCX + 7, dy + 7, on ? SLV[6].base : GHOST); colonOn = on }
const timeStr = () => { const h = tm.getHours(), m = tm.getMinutes(); return (h < 10 ? '0' : '') + h + (m < 10 ? '0' : '') + m }
const litNow = (str) => { const on = new Array(NS).fill(0); for (let k = 0; k < NS; k++) if (SEGS[str.charAt(SG[k].i)].indexOf(SG[k].s) >= 0) on[k] = 1; return on }
// ---- analyzer: blocks, 0 = unlit ghost, 1 = lit, 2 = peak ----
const ROWC = [], ROWG = []; for (let k = 0; k < NR; k++) { ROWC.push(mixc([30, 170, 255], [110, 240, 255], k / NR)); ROWG.push(mixc(GHA, [18, 100, 150], 0.55)) }
const PKC = mixc([225, 252, 255], [225, 252, 255], 0), PKG = mixc(GHA, [60, 170, 220], 0.6)
const ds = new Array(NC * NR).fill(0)
const blk = (c, k, st) => {
  const x = AX + c * PX, y = AB - (k + 1) * PY + (PY - BH)
  rect(x - 1, y - 1, x + BW + 1, y + BH + 1, st === 1 ? ROWG[k] : st === 2 ? PKG : BG)
  rect(x, y, x + BW, y + BH, st === 1 ? ROWC[k] : st === 2 ? PKC : GHOST)
}
const val = new Array(NC).fill(1), peak = new Array(NC).fill(1), hold = new Array(NC).fill(0)
const targets = (t0, ph) => {                      // t0 = seconds since the play started (the fade in / out), ph = a random phase so every play dances differently
  const t = t0 + ph
  let g = 1
  if (t0 < 0.25) g = t0 / 0.25
  else if (t0 > 4.2) g = Math.max(0, 1 - (t0 - 4.2) / 0.5)
  const beat = (t * 2.2) % 1 < 0.18 ? 1 : 0, out = []
  for (let c = 0; c < NC; c++) {
    const env = 0.55 + 0.45 * Math.sin(c / NC * 3.14159 * 1.15 + 0.25), low = c < 4 ? 1 : 0.6
    const w1 = 0.5 + 0.5 * Math.sin(t * 2.7 + c * 0.42), w2 = 0.5 + 0.5 * Math.sin(t * 4.3 - c * 0.31 + 1.2), w3 = 0.5 + 0.5 * Math.sin(t * 7.1 + c * 0.9)
    const h = NR * (0.1 + 0.62 * env * (0.55 * w1 + 0.45 * w2) + 0.1 * w3 * env + 0.3 * beat * low * env)
    out.push(Math.max(1, Math.min(NR, 1 + (h - 1) * g)))
  }
  return out
}
let gap = 0
const drawBars = (t, dt) => {
  const tg = targets(t, PH); gap = 0
  for (let c = 0; c < NC; c++) {
    if (tg[c] > val[c]) val[c] += (tg[c] - val[c]) * Math.min(1, dt * 22); else val[c] = Math.max(tg[c], val[c] - dt * 14)
    if (val[c] >= peak[c]) { peak[c] = val[c]; hold[c] = t + 0.45 } else if (t > hold[c]) peak[c] = Math.max(val[c], peak[c] - dt * (t > 4.2 ? 26 : 7))   // at the end the peaks drop fast onto the bars
    if (peak[c] - val[c] > gap) gap = peak[c] - val[c]
    const n = Math.round(val[c]), pk = Math.ceil(peak[c] - 0.001)
    for (let k = 0; k < NR; k++) {
      const st = k < n ? 1 : (k === pk - 1 && pk > n) ? 2 : 0
      if (ds[c * NR + k] !== st) { blk(c, k, st); ds[c * NR + k] = st }
    }
  }
}
const drawClock = (dt, blink) => {
  const on = litNow(timeStr())
  for (let k = 0; k < NS; k++) {
    if (on[k]) sl[k] = Math.min(1, sl[k] + dt / 0.15); else sl[k] = Math.max(0, sl[k] - dt / 0.12)
    const l = Math.round(sl[k] * 6)
    if (l !== dl[k]) { drawSeg(k, l); dl[k] = l }
  }
  const co = blink === null ? 1 : ((blink % 1) < 0.55 ? 1 : 0)
  if (co !== colonOn) drawColon(co)
}
// ---- loop: plays for 5 s, then idles with a once-a-second check of the clock ----
const PLAY = 5.0
let timer = null, playing = false, P0 = 0, PH = 0, last = 0, lastStr = '', frames = 0, tLog = 0
const play = (now) => { playing = true; P0 = now; PH = Math.random() * 10; last = now; frames = 0; tLog = now; lastStr = timeStr(); for (let c = 0; c < NC; c++) { hold[c] = 0 } }
const tick = () => {
  timer = null
  const now = Date.now()
  try {
    if (!playing) { const s = timeStr(); if (s !== lastStr) { play(now); say('minute changed: play') } }
    if (playing) {
      const t = (now - P0) / 1000, dt = Math.min(0.1, (now - last) / 1000); last = now
      lastStr = timeStr()
      drawBars(t, dt); drawClock(dt, t); frames++
      if ((t >= PLAY && gap < 0.05) || t >= PLAY + 1.5) { playing = false; drawClock(0, null); say('done: idle') }
    } else drawClock(0.05, null)                       // idle: a pending fade (after a minute change) finishes, nothing else changes
  } catch (e) { say('draw: ' + e); return }
  if (DEBUG && playing && now - tLog >= 2000) { say(Math.round(frames * 1000 / Math.max(1, now - tLog)) + ' fps'); tLog = now; frames = 0 }
  timer = setTimeout(tick, playing ? Math.max(0, 33 - (Date.now() - now)) : 1000)
}
const stop = () => { if (timer) { try { clearTimeout(timer) } catch (e) {} timer = null } }
const WAKE_GAP = 8000
let pausedAt = 0, startedAt = 0
const onPause = () => { if (Date.now() - startedAt < 1500) return; pausedAt = Date.now(); stop() }   // switching faces: the watch pauses and resumes the new face right after it loads, so a pause that early must not stop the loop
const onResume = () => {
  const n = Date.now()
  if (n - startedAt < 1500) return                       // the watch also calls resume once when the face loads
  say('resume after ' + (n - pausedAt) + ' ms' + (n - pausedAt >= WAKE_GAP ? ': play' : ': carry on'))
  stop()
  if (n - pausedAt >= WAKE_GAP) play(n); else if (playing) { P0 += n - pausedAt; last = n }
  tick()
}
const onTap = () => { stop(); play(Date.now()); tick() }
try { cv.addEventListener(ui.event.CLICK_UP, onTap) } catch (e) { say('tap: ' + e) }
ui.createWidget(ui.widget.WIDGET_DELEGATE, { pause_call: onPause, resume_call: onResume })
rect(0, 0, 390, 450, BG)
for (let c = 0; c < NC; c++) for (let k = 0; k < NR; k++) { const x = AX + c * PX, y = AB - (k + 1) * PY + (PY - BH); rect(x, y, x + BW, y + BH, GHOST) }
for (let k = 0; k < NS; k++) poly(SG[k].pts, GHOST)
for (let c = 0; c < NC; c++) { blk(c, 0, 1); ds[c * NR] = 1 }
drawColon(0)
startedAt = Date.now(); play(startedAt); tick()`;
const stillScript = `
${SEGJS}
const c = document.createElement('canvas'); c.width = 390; c.height = 450; const g = c.getContext('2d'); g.fillStyle = '#03070b'; g.fillRect(0, 0, 390, 450)
const poly = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill() }
'1059'.split('').forEach((ch, i) => { const P = segPolys(XS[i], DY0, DW, DH, DTH, DSL); for (const s of 'abcdefg') { const on = SEGS[ch].indexOf(s) >= 0; poly(P[s], on ? '#46e8ff' : '#071e28'); if (on) { const m = P[s].reduce((a, p) => [a[0] + p[0] / 6, a[1] + p[1] / 6], [0, 0]); poly(P[s].map((p) => [m[0] + (p[0] - m[0]) * 0.55, m[1] + (p[1] - m[1]) * 0.55]), '#b4f6ff') } } })
const ccx = (XS[1] + DW + XS[2]) / 2 + 4; g.fillStyle = '#46e8ff'; g.fillRect(ccx - 7, DY0 + 33, 14, 14); g.fillRect(ccx - 7, DY0 + 73, 14, 14)
for (let col = 0; col < NC; col++) {
  const env = 0.55 + 0.45 * Math.sin(col / NC * 3.14159 * 1.15 + 0.25), n = Math.round(1 + 16 * env * (0.55 + 0.4 * Math.sin(col * 0.42 + 1.1))), pk = Math.min(NR, n + 1 + (col % 3))
  for (let k = 0; k < NR; k++) {
    const x = AX + col * PX, y = AB - (k + 1) * PY + (PY - BH), lit = k < n, isp = k === pk - 1 && pk > n
    g.fillStyle = lit ? '#126494' : isp ? '#3caadc' : '#03070b'; if (lit || isp) g.fillRect(x - 1, y - 1, BW + 2, BH + 2)
    const f = k / NR; g.fillStyle = lit ? 'rgb(' + Math.round(30 + 80 * f) + ',' + Math.round(170 + 70 * f) + ',255)' : isp ? '#e1fcff' : '#071e28'; g.fillRect(x, y, BW, BH)
  }
}
const n = addProjectImage('eq/still.png', c, {}).name; await loadAllImages()
const e = await addElement('IMG', { src: n }); Object.assign(e, { name: 'Display (preview)', src: n, x: 0, y: 0, show: 'normal', previewOnly: true }); return n`;
const steps = [
  { script: 'project.appId = 2024163; return 1' },
  { script: stillScript },
  { script: `let e = await addElement('CANVAS', { x: 0, y: 0, w: 390, h: 450, show: 'normal', handle: 'k1' }); Object.assign(e, { x: 0, y: 0, name: 'Display canvas' })
    project.groups = project.groups || {}; project.groups.gCanvas = 'Canvas'; project.elements.find((x) => x.name === 'Display canvas').group = 'gCanvas'; return 1` },
];
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: 'Equalizer VFD', device: 'bip-6', language: 'en-US', optimizePng: 'lossless',
  description: 'A vintage car-stereo display: a cyan 7-segment clock over a spectrum analyzer of 2:1 blocks with peak-hold blocks. It plays for 5 seconds on every wake-up, tap and minute change, then stops. All drawn by the watch on one canvas, no pictures.',
  preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/equalizer-vfd', userImports, userCode, steps }, null, 1));
console.log('recipe.json written');
