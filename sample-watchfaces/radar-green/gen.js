// Radar Green: canvas only. A green phosphor radar scope (rings, crosshair, degree ticks) with a rotating beam and a fading trail. The time is a slanted
// green 7-segment LCD (HH:MM) that is NOT visible until the beam crosses it: on every wake-up the sweep starts and each segment lights (and its unlit
// ghost appears) the moment the beam passes over it, then slowly dims to a steady glow and is refreshed on every turn. When the minute changes a segment
// only updates when the beam next crosses it, so for a moment the screen shows a half-old, half-new time. A few contacts (blips) flare up as the beam passes.
// Three canvas layers: the scope (opaque, drawn once), the digits and blips (see-through, only the pieces that change are redrawn) and the beam with its
// trail (see-through at setAlpha 150, cleared and redrawn every frame from 11 thick lines). The beam runs for ONE turn plus the glow settling (about 3.8 s)
// and then stops: the digits stay on the screen and the face only checks the clock once a second (battery). A new sweep starts when the minute changes, on a
// wake-up and on a tap. The always-on screen stays black.
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
const CX = 195, CY = 225, RR = 188, DW = 56, DH = 104, DTH = 12, DSL = 0.08, XS = [50, 116, 218, 284]`;
const userCode = String.raw`
const DEBUG = true                                       // logs to the developer bridge (zeus bridge): frames per second of the beam
let logN = 0
const say = (m) => { if (DEBUG) console.log('[rg ' + (++logN) + '] ' + m) }
const cvB = W.k1, cvD = W.k2, cvS = W.k3                  // scope, digits + blips, beam
${SEGJS}
const tm = new Time()
const mixc = (a, b, t) => (Math.round(a[0] + (b[0] - a[0]) * t) << 16) | (Math.round(a[1] + (b[1] - a[1]) * t) << 8) | Math.round(a[2] + (b[2] - a[2]) * t)
const BG = [1, 9, 4], LIT = [110, 255, 140], GHOST = [8, 52, 22], WHITE = [220, 255, 225]
const DPS = 150                                          // beam speed in degrees per second (one turn in 2.4 s)
const R1 = { x1: 0, y1: 0, x2: 0, y2: 0, color: 0 }, C1 = { center_x: 0, center_y: 0, radius: 0, color: 0 }, L1 = { x1: 0, y1: 0, x2: 0, y2: 0, color: 0 }
const rect = (cv, x1, y1, x2, y2, col) => { R1.x1 = x1; R1.y1 = y1; R1.x2 = x2; R1.y2 = y2; R1.color = col; cv.drawRect(R1) }
const ball = (cv, x, y, r, col) => { C1.center_x = x; C1.center_y = y; C1.radius = r; C1.color = col; cv.drawCircle(C1) }
const line = (cv, x1, y1, x2, y2, col, w) => { cv.setPaint({ color: col, line_width: w }); L1.x1 = x1; L1.y1 = y1; L1.x2 = x2; L1.y2 = y2; L1.color = col; cv.drawLine(L1) }
const ring = (cv, r, col, w) => { cv.setPaint({ color: col, line_width: w }); C1.center_x = CX; C1.center_y = CY; C1.radius = r; C1.color = col; cv.strokeCircle(C1) }
// ---- the scope (drawn once) ----
const drawScope = () => {
  rect(cvB, 0, 0, 390, 450, mixc(BG, BG, 0))
  ring(cvB, Math.round(RR / 3), 0x004e1c, 2); ring(cvB, Math.round(RR * 2 / 3), 0x004e1c, 2)
  line(cvB, CX - RR, CY, CX + RR, CY, 0x004e1c, 2); line(cvB, CX, CY - RR, CX, CY + RR, 0x004e1c, 2)
  for (let a = 0; a < 360; a += 10) {
    const l = a % 30 === 0 ? 14 : 7, s = Math.sin(a * Math.PI / 180), c = -Math.cos(a * Math.PI / 180)
    line(cvB, Math.round(CX + (RR - l) * s), Math.round(CY + (RR - l) * c), Math.round(CX + RR * s), Math.round(CY + RR * c), 0x00963c, 2)
  }
  ring(cvB, RR, 0x00aa46, 3); ball(cvB, CX, CY, 4, mixc(LIT, LIT, 0))
}
// ---- digits: 4 x 7 segments + 2 colon dots, each with its place in the sweep ----
const phiOf = (x, y) => (Math.atan2(x - CX, -(y - CY)) * 180 / Math.PI + 360) % 360
const SG = []
for (let i = 0; i < 4; i++) {
  const P = segPolys(XS[i], CY - 52, DW, DH, DTH, DSL)
  for (const s of 'abcdefg') {
    const pts = P[s].map((p) => ({ x: Math.round(p[0]), y: Math.round(p[1]) }))
    let mx = 0, my = 0; pts.forEach((p) => { mx += p.x; my += p.y }); mx /= 6; my /= 6
    const core = pts.map((p) => ({ x: Math.round(mx + (p.x - mx) * 0.55), y: Math.round(my + (p.y - my) * 0.55) }))
    SG.push({ i, s, pts, core, phi: phiOf(mx, my), dot: 0 })
  }
}
const CCX = Math.round((XS[1] + DW + XS[2]) / 2 + 3)
for (const dy of [-20, 20]) SG.push({ i: 9, s: 'dot', dot: 1, x: CCX - 6, y: CY + dy - 6, phi: phiOf(CCX, CY + dy), pts: null, core: null })
const NS = SG.length
const LUT = []; for (let l = 0; l <= 6; l++) { const bb = 0.55 + 0.45 * l / 6; LUT.push({ base: mixc(GHOST, LIT, bb), core: mixc(LIT, WHITE, 0.4 * bb) }) }
const GHOSTC = mixc(GHOST, GHOST, 0)
const PP = { data_array: null, color: 0 }
const poly = (cv, pts, col) => { PP.data_array = pts; PP.color = col; cv.drawPoly(PP) }
const state = new Array(NS).fill(0), dState = new Array(NS).fill(0), dLvl = new Array(NS).fill(-1)
const drawSeg = (k, st, lv) => {
  const g = SG[k]
  if (g.dot) { rect(cvD, g.x, g.y, g.x + 12, g.y + 12, st === 2 ? LUT[lv].base : GHOSTC); return }
  if (st === 2) { poly(cvD, g.pts, LUT[lv].base); poly(cvD, g.core, LUT[lv].core) } else poly(cvD, g.pts, GHOSTC)
}
// ---- contacts ----
const BL = [[150, 38], [125, 125], [165, 200], [125, 305], [140, 320], [70, 350], [172, 80]].map((p) => ({ x: Math.round(CX + p[0] * Math.sin(p[1] * Math.PI / 180)), y: Math.round(CY - p[0] * Math.cos(p[1] * Math.PI / 180)), phi: p[1], seen: 0, lv: -1 }))
const drawBlip = (b, lv) => {
  cvD.clear({ x: b.x - 20, y: b.y - 20, w: 40, h: 40 })
  if (lv > 0) { const k = lv / 5; ball(cvD, b.x, b.y, Math.round(4 + 10 * k), mixc(BG, [10, 110, 40], 0.6 * k)); ball(cvD, b.x, b.y, Math.round(2 + 6 * k), mixc(BG, LIT, k)) }
}
// ---- the beam: the trail is 10 thick lines fading back from the beam, the canvas is see-through ----
const TR = []; for (let k = 9; k >= 0; k--) TR.push(mixc([10, 70, 30], [150, 255, 180], Math.pow((9 - k) / 9, 1.6)))
const drawBeam = (th) => {
  cvS.clear({ x: 0, y: 0, w: 390, h: 450 })
  for (let k = 9; k >= 0; k--) {
    const a = (th - k * 3.5) * Math.PI / 180
    line(cvS, CX, CY, Math.round(CX + RR * Math.sin(a)), Math.round(CY - RR * Math.cos(a)), TR[9 - k], 11)
  }
  const a = th * Math.PI / 180
  line(cvS, CX, CY, Math.round(CX + RR * Math.sin(a)), Math.round(CY - RR * Math.cos(a)), 0xbeffcd, 4)
}
// ---- time and loop ----
const timeStr = () => { const h = tm.getHours(), m = tm.getMinutes(); return (h < 10 ? '0' : '') + h + (m < 10 ? '0' : '') + m }
const litNow = (str) => { const on = new Array(NS).fill(0); for (let k = 0; k < NS; k++) { const g = SG[k]; if (g.dot) on[k] = 1; else if (SEGS[str.charAt(g.i)].indexOf(g.s) >= 0) on[k] = 1 } return on }
let T0 = 0, prevTh = -1, timer = null, frames = 0, tLog = 0, scanning = false, lastStr = ''
const END_TH = 575          // one turn to reveal everything + the glow settling, stopped where no segment sits just behind the beam (215 deg), so nothing jumps
const crossed = (a, b, phi) => Math.floor((b - phi) / 360) > Math.floor((a - phi) / 360)
const startSweep = (now, delay) => { scanning = true; T0 = now + delay; prevTh = -1; tLog = now; frames = 0; for (let i = 0; i < BL.length; i++) { BL[i].seen = 0 } }
const finishScan = () => {                               // the beam is switched off: the digits stay as they are, nothing runs but a once-a-second check of the clock
  scanning = false; cvS.clear({ x: 0, y: 0, w: 390, h: 450 })
  for (let k = 0; k < NS; k++) if (state[k] === 2 && dLvl[k] !== 0) { drawSeg(k, 2, 0); dLvl[k] = 0 }
  for (let i = 0; i < BL.length; i++) if (BL[i].lv > 0) { drawBlip(BL[i], 0); BL[i].lv = 0 }
  say('scan done: idle')
}
const tick = () => {
  timer = null
  const now = Date.now()
  try {
    if (!scanning) { const s = timeStr(); if (s !== lastStr) { lastStr = s; startSweep(now, 0); say('minute changed: sweep') } }
    if (scanning) {
      const th = (now - T0) * DPS / 1000
      if (th >= 0) {
        const on = litNow(timeStr())
        for (let k = 0; k < NS; k++) {
          if (crossed(prevTh, th, SG[k].phi)) state[k] = on[k] ? 2 : 1
          if (state[k] === 0) continue
          let lv = 0
          if (state[k] === 2) { const age = (((th - SG[k].phi) % 360) + 360) % 360, bb = Math.max(0.55, Math.exp(-age / 160)); lv = Math.round((bb - 0.55) / 0.45 * 6) }
          if (state[k] !== dState[k] || (state[k] === 2 && lv !== dLvl[k])) { drawSeg(k, state[k], lv); dState[k] = state[k]; dLvl[k] = lv }
        }
        for (let i = 0; i < BL.length; i++) {
          const b = BL[i]
          if (crossed(prevTh, th, b.phi)) b.seen = 1
          if (!b.seen) continue
          const age = (((th - b.phi) % 360) + 360) % 360, lv = Math.max(0, Math.round(Math.exp(-age / 75) * 5))
          if (lv !== b.lv) { drawBlip(b, lv); b.lv = lv }
        }
        drawBeam(th); prevTh = th; frames++
        if (th >= END_TH) finishScan()
      }
    }
  } catch (e) { say('draw: ' + e); return }
  if (DEBUG && scanning && now - tLog >= 2000) { say(Math.round(frames * 1000 / Math.max(1, now - tLog)) + ' fps'); tLog = now; frames = 0 }
  timer = setTimeout(tick, scanning ? Math.max(0, 33 - (Date.now() - now)) : 1000)
}
const resetScan = (now) => {
  cvD.clear({ x: 0, y: 0, w: 390, h: 450 }); cvS.clear({ x: 0, y: 0, w: 390, h: 450 })
  for (let k = 0; k < NS; k++) { state[k] = 0; dState[k] = 0; dLvl[k] = -1 }
  for (let i = 0; i < BL.length; i++) { BL[i].seen = 0; BL[i].lv = -1 }
  lastStr = timeStr(); startSweep(now, 300)
}
// pause / resume: the notification shade also pauses the face, so a short absence only carries on (a running sweep goes on from where it was, an idle face keeps checking the clock); a longer one
// (a real wake-up) starts a new scan: the digits are gone until the beam finds them again
const WAKE_GAP = 8000
let pausedAt = 0, startedAt = 0
const stop = () => { if (timer) { try { clearTimeout(timer) } catch (e) {} timer = null } }
const onPause = () => { if (Date.now() - startedAt < 1500) return; pausedAt = Date.now(); stop() }   // switching faces: the watch pauses and resumes the new face right after it loads, so a pause that early must not stop the loop
const onResume = () => {
  const n = Date.now()
  if (n - startedAt < 1500) return                       // the watch also calls resume once when the face loads
  say('resume after ' + (n - pausedAt) + ' ms' + (n - pausedAt >= WAKE_GAP ? ': new scan' : ': carry on'))
  if (n - pausedAt >= WAKE_GAP) { resetScan(n) } else if (scanning) { T0 += n - pausedAt }
  stop(); tick()
}
const onTap = () => { const n = Date.now(); resetScan(n); stop(); tick() }
try { cvS.addEventListener(ui.event.CLICK_UP, onTap); cvD.addEventListener(ui.event.CLICK_UP, onTap) } catch (e) { say('tap: ' + e) }
ui.createWidget(ui.widget.WIDGET_DELEGATE, { pause_call: onPause, resume_call: onResume })
try { cvS.setAlpha(150) } catch (e) { say('alpha: ' + e) }
drawScope(); startedAt = Date.now(); resetScan(startedAt); tick()`;
const stillScript = `
${SEGJS}
const c = document.createElement('canvas'); c.width = 390; c.height = 450; const g = c.getContext('2d'); g.fillStyle = '#010904'; g.fillRect(0, 0, 390, 450)
g.strokeStyle = '#004e1c'; g.lineWidth = 2
for (const r of [RR / 3, RR * 2 / 3]) { g.beginPath(); g.arc(CX, CY, r, 0, 6.2832); g.stroke() }
g.beginPath(); g.moveTo(CX - RR, CY); g.lineTo(CX + RR, CY); g.moveTo(CX, CY - RR); g.lineTo(CX, CY + RR); g.stroke()
g.strokeStyle = '#00963c'
for (let a = 0; a < 360; a += 10) { const l = a % 30 === 0 ? 14 : 7, s = Math.sin(a * Math.PI / 180), q = -Math.cos(a * Math.PI / 180); g.beginPath(); g.moveTo(CX + (RR - l) * s, CY + (RR - l) * q); g.lineTo(CX + RR * s, CY + RR * q); g.stroke() }
g.strokeStyle = '#00aa46'; g.lineWidth = 3; g.beginPath(); g.arc(CX, CY, RR, 0, 6.2832); g.stroke()
for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(70,255,120,' + (0.35 * Math.exp(-k / 12)) + ')'; g.beginPath(); g.moveTo(CX, CY); g.arc(CX, CY, RR, (-90 + 125 - k - 1) * Math.PI / 180, (-90 + 125 - k) * Math.PI / 180); g.fill() }
g.strokeStyle = '#beffcd'; g.lineWidth = 3; g.beginPath(); g.moveTo(CX, CY); g.lineTo(CX + RR * Math.sin(125 * Math.PI / 180), CY - RR * Math.cos(125 * Math.PI / 180)); g.stroke()
const poly = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill() }
'1059'.split('').forEach((ch, i) => { const P = segPolys(XS[i], CY - 52, DW, DH, DTH, DSL); for (const s of 'abcdefg') { const on = SEGS[ch].indexOf(s) >= 0; poly(P[s], on ? '#6eff8c' : '#083416'); if (on) { const m = P[s].reduce((a, p) => [a[0] + p[0] / 6, a[1] + p[1] / 6], [0, 0]); poly(P[s].map((p) => [m[0] + (p[0] - m[0]) * 0.55, m[1] + (p[1] - m[1]) * 0.55]), '#a8ffb8') } } })
g.fillStyle = '#6eff8c'; const ccx = (XS[1] + DW + XS[2]) / 2 + 3; g.fillRect(ccx - 6, CY - 26, 12, 12); g.fillRect(ccx - 6, CY + 14, 12, 12)
g.fillStyle = '#6eff8c'; for (const b of [[150, 38], [125, 125], [165, 200]]) { g.beginPath(); g.arc(CX + b[0] * Math.sin(b[1] * Math.PI / 180), CY - b[0] * Math.cos(b[1] * Math.PI / 180), 6, 0, 6.2832); g.fill() }
const n = addProjectImage('rg/still.png', c, {}).name; await loadAllImages()
const e = await addElement('IMG', { src: n }); Object.assign(e, { name: 'Radar (preview)', src: n, x: 0, y: 0, show: 'normal', previewOnly: true }); return n`;
const cv = (h, name) => `{ const e = await addElement('CANVAS', { x: 0, y: 0, w: 390, h: 450, show: 'normal', handle: '${h}' }); Object.assign(e, { x: 0, y: 0, name: '${name}' }) }`;
const steps = [
  { script: 'project.appId = 2024162; return 1' },
  { script: stillScript },
  { script: `${cv('k1', 'Scope canvas')}\n${cv('k2', 'Digits canvas')}\n${cv('k3', 'Beam canvas')}
    project.groups = project.groups || {}; project.groups.gCanvas = 'Canvas'; for (const n of ['Scope canvas', 'Digits canvas', 'Beam canvas']) project.elements.find((x) => x.name === n).group = 'gCanvas'; return 3` },
];
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: 'Radar Green', device: 'bip-6', language: 'en-US', optimizePng: 'lossless',
  description: 'A green radar scope whose beam reveals the time, written in 7-segment LCD digits, as it sweeps: on every wake-up (or tap) the scan starts and each segment lights as the beam passes. All drawn by the watch on three canvas layers, no pictures.',
  preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/radar-green', userImports, userCode, steps }, null, 1));
console.log('recipe.json written');
