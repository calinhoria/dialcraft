// Matrix Clock: canvas only. Katakana rain falls on a full-screen opaque canvas (each step of a column draws its new head, recolours three
// characters behind it and erases the tail: about 9 drawText / drawRect calls, a drawText costs 0.25 ms on the Bip 6 at any size) and a
// second, see-through canvas holds the clock: dot-matrix digits drawn from small squares on a plain black square (no border line) that keeps the rain 14 px away,
// decoding out of random digits on every wake, every minute and every tap (a tap also speeds the rain up for a moment). No native time layers, no pictures. The always-on screen stays black.
// After face-cli: node post.js is not needed (no fonts in the project).
const fs = require('fs')
const RAIN = { x: 0, y: 0, w: 390, h: 450 }, PANEL = { x: 25, y: 140, w: 340, h: 170 }
// the clock is drawn from small squares (a 5 x 7 dot-matrix font), so its size is exact and no font is needed: 27 units wide, 7 high
const GLYPHS = { 0: '01110 10001 10011 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110', 2: '01110 10001 00001 00010 00100 01000 11111',
  3: '11110 00001 00001 01110 00001 00001 11110', 4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
  6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000', 8: '01110 10001 10001 01110 10001 10001 01110',
  9: '01110 10001 10001 01111 00001 00010 01100' }
const U = 11, DOT = 9, COLX = [0, 6, 16, 22], COLON = 13, UNITS = 27, PAD = 14      // dot pitch / size in px, the 4 digits' and the colon's column, width in units, gap around the clock
const userImports = "import { Time } from '@zos/sensor'"
const userCode = String.raw`
const DEBUG = false                                      // true: log to the developer bridge
const say = (m) => { if (DEBUG) console.log('[mx] ' + m) }
const cvR = W.k1, cvC = W.k2                            // the two Canvas layers of the layout (code handles k1 = rain, k2 = clock panel)
const GL = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789'
const rnd = (n) => Math.floor(Math.random() * n)
const pick = () => GL.charAt(rnd(GL.length))
const RW = ${RAIN.w}, RH = ${RAIN.h}, PW = ${PANEL.w}, PH = ${PANEL.h}
const lay = (t, s, d) => { try { const m = ui.getTextLayout(t, { text_size: s, text_width: 400 }); if (m && m.width > 2 && m.height > 2) return m } catch (e) {} return d }
// ---- rain ----
const TS = 22, cm = lay('ア', TS, { width: 22, height: 26 }), CW = cm.width, CH = cm.height
const COLS = Math.floor(RW / CW), ROWS = Math.floor(RH / CH), X0 = Math.floor((RW - COLS * CW) / 2)
const T = { x: 0, y: 0, text: '', text_size: TS, color: 0 }, RC = { x1: 0, y1: 0, x2: 0, y2: 0, color: 0 }
const HEAD = 0xe0ffe6, BRIGHT = 0x3dff70, MID = 0x00c443, DIM = 0x00692a
const cell = (c, r, ch, col) => {                        // clear the cell, then draw ch in col (col < 0: only clear)
  const x = X0 + c * CW, y = r * CH
  RC.x1 = x; RC.y1 = y; RC.x2 = x + CW; RC.y2 = y + CH; RC.color = 0; cvR.drawRect(RC)
  if (col >= 0) { T.x = x; T.y = y; T.text = ch; T.color = col; cvR.drawText(T) }
}
const mkCol = () => ({ row: -rnd(14), acc: 0, speed: 6 + Math.random() * 8, len: 7 + rnd(7), ch: [] })
let COL = []
let surgeUntil = 0
const stepCol = (c, k) => {
  k.row++
  const r = k.row, at = (rr, col) => { if (rr >= 0 && rr < ROWS) cell(c, rr, k.ch[rr], col) }
  if (r >= 0 && r < ROWS) { k.ch[r] = pick(); at(r, HEAD) }
  at(r - 1, BRIGHT); at(r - 3, MID); at(r - k.len + 2, DIM)
  if (r - k.len >= 0 && r - k.len < ROWS) cell(c, r - k.len, null, -1)
  if (r - k.len >= ROWS) { k.row = -rnd(10); k.speed = 6 + Math.random() * 8; k.len = 7 + rnd(7) }
}
// ---- clock: dot-matrix digits ----
const tm = new Time()
const GLY = ${JSON.stringify(GLYPHS)}, U = ${U}, DOT = ${DOT}, COLX = ${JSON.stringify(COLX)}, COLON = ${COLON}, UNITS = ${UNITS}, PAD = ${PAD}
const IX = Math.floor((PW - UNITS * U) / 2), IY = Math.floor((PH - 7 * U) / 2), INKW = UNITS * U - (U - DOT), INKH = 7 * U - (U - DOT)
const LIT = 0x6bff94, SCRAMBLE = 0xe0ffe6, UNLIT = 0x07301a
const DR = { x1: 0, y1: 0, x2: 0, y2: 0, color: 0 }
const dot = (cx, ry, col) => { DR.x1 = IX + cx * U; DR.y1 = IY + ry * U; DR.x2 = DR.x1 + DOT; DR.y2 = DR.y1 + DOT; DR.color = col; cvC.drawRect(DR) }
const glyph = (slot, ch, col) => { const rows = GLY[ch].split(' '); for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) dot(COLX[slot] + c, r, rows[r].charAt(c) === '1' ? col : UNLIT) }
let dec = { t0: 0, settle: [0, 0, 0, 0] }, lastStr = '', shown = [null, null, null, null]
const startDecode = () => { const n = Date.now(); dec = { t0: n, settle: [n + 350, n + 600, n + 850, n + 1100] } }
const clockBase = () => {                                                      // the black square (the same PAD on all four sides of the dots) and the colon
  cvC.clear({ x: 0, y: 0, w: PW, h: PH })
  DR.x1 = IX - PAD; DR.y1 = IY - PAD; DR.x2 = IX + INKW + PAD; DR.y2 = IY + INKH + PAD; DR.color = 0; cvC.drawRect(DR)
  for (let r = 0; r < 7; r++) dot(COLON, r, r === 2 || r === 4 ? LIT : UNLIT)
  shown = [null, null, null, null]
}
const drawPanel = (str, now) => {                                              // only the digits that changed are redrawn
  for (let i = 0; i < 4; i++) {
    const done = now >= dec.settle[i], ch = done ? str.charAt(i < 2 ? i : i + 1) : String(rnd(10)), col = done ? LIT : SCRAMBLE, key = ch + col
    if (shown[i] !== key) { glyph(i, ch, col); shown[i] = key }
  }
}
// ---- loop ----
let timer = null, last = 0, frames = 0, tLog = 0
const tick = () => {
  timer = null
  const now = Date.now(), dt = Math.min(200, now - last); last = now
  try {
    const surge = now < surgeUntil ? 2.6 : 1
    for (let c = 0; c < COL.length; c++) { const k = COL[c]; k.acc += k.speed * surge * dt / 1000; while (k.acc >= 1) { k.acc -= 1; stepCol(c, k) } }
    const hh = tm.getHours(), mm = tm.getMinutes()
    const str = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm
    if (str !== lastStr) { lastStr = str; startDecode() }
    if (now < dec.settle[3] + 60) drawPanel(str, now)
  } catch (e) { say('draw: ' + e); return }
  frames++
  if (DEBUG && now - tLog > 6000) { say(Math.round(frames * 1000 / Math.max(1, now - tLog)) + ' fps, ' + COLS + ' cols x ' + ROWS + ' rows'); tLog = now; frames = 0 }
  timer = setTimeout(tick, Math.max(0, 33 - (Date.now() - now)))
}
// pause / resume: pulling down the notification shade pauses the face just like the screen turning off, so a short absence only carries on; a longer one
// (a real wake-up) starts a new drawing
const WAKE_GAP = 8000
let pausedAt = 0, startedAt = 0
const stop = () => { if (timer) { try { clearTimeout(timer) } catch (e) {} timer = null } }
const start = () => {
  stop(); startedAt = Date.now()
  RC.x1 = 0; RC.y1 = 0; RC.x2 = RW; RC.y2 = RH; RC.color = 0; cvR.drawRect(RC); clockBase()
  COL = Array.from({ length: COLS }, mkCol); surgeUntil = 0; lastStr = ''
  last = Date.now(); tLog = last; frames = 0; tick()
}
const onTap = () => { startDecode(); surgeUntil = Date.now() + 1500 }
try { cvR.addEventListener(ui.event.CLICK_UP, onTap); cvC.addEventListener(ui.event.CLICK_UP, onTap) } catch (e) { say('tap: ' + e) }
const onPause = () => { if (Date.now() - startedAt < 1500) return; pausedAt = Date.now(); stop() }   // switching faces: the watch pauses and resumes the new face right after it loads, so a pause that early must not stop the loop
const onResume = () => {
  const n = Date.now()
  if (n - startedAt < 1500) return                       // the watch also calls resume once when the face loads
  if (n - pausedAt >= WAKE_GAP) { start(); return }
  last = n; tick()                                      // the rain, the clock and a decode in progress carry on
}
ui.createWidget(ui.widget.WIDGET_DELEGATE, { pause_call: onPause, resume_call: onResume })
start()`;
// the editor / store still: katakana rain with a clock panel (hidden on the watch, where the canvases draw)
const stillScript = `
const c = document.createElement('canvas'); c.width = 390; c.height = 450; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 390, 450)
const GL = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789', CW = 22, CH = 26; let s = 7
const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
g.font = '22px sans-serif'; g.textBaseline = 'top'
for (let col = 0; col < 17; col++) { const head = Math.floor(rnd() * 17), len = 7 + Math.floor(rnd() * 7)
  for (let k = 0; k < len; k++) { const r = head - k; if (r < 0 || r > 16) continue; g.fillStyle = k === 0 ? '#e0ffe6' : k === 1 ? '#3dff70' : k < 4 ? '#00c443' : k < len - 2 ? '#00c443' : '#00692a'; g.fillText(GL.charAt(Math.floor(rnd() * GL.length)), 8 + col * CW, r * CH) } }
const GLY = ${JSON.stringify(GLYPHS)}, U = ${U}, DOT = ${DOT}, COLX = ${JSON.stringify(COLX)}, COLON = ${COLON}, UNITS = ${UNITS}, PAD = ${PAD}
const IX = ${PANEL.x} + Math.floor((${PANEL.w} - UNITS * U) / 2), IY = ${PANEL.y} + Math.floor((${PANEL.h} - 7 * U) / 2), INKW = UNITS * U - (U - DOT), INKH = 7 * U - (U - DOT)
g.fillStyle = '#000'; g.fillRect(IX - PAD, IY - PAD, INKW + 2 * PAD, INKH + 2 * PAD)
const dot = (cx, ry, col) => { g.fillStyle = col; g.fillRect(IX + cx * U, IY + ry * U, DOT, DOT) }
for (let r = 0; r < 7; r++) dot(${COLON}, r, r === 2 || r === 4 ? '#6bff94' : '#07301a')
'1009'.split('').forEach((ch, i) => { const rows = GLY[ch].split(' '); for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) dot(COLX[i] + c, r, rows[r][c] === '1' ? '#6bff94' : '#07301a') })
const n = addProjectImage('mx/still.png', c, {}).name; await loadAllImages()
const e = await addElement('IMG', { src: n }); Object.assign(e, { name: 'Matrix (preview)', src: n, x: 0, y: 0, show: 'normal', previewOnly: true }); return n`;
const steps = [
  { script: 'project.appId = 2024152; return 1' },
  { script: stillScript },
  { script: `let e = await addElement('CANVAS', { x: ${RAIN.x}, y: ${RAIN.y}, w: ${RAIN.w}, h: ${RAIN.h}, show: 'normal', handle: 'k1' }); Object.assign(e, { x: ${RAIN.x}, y: ${RAIN.y}, name: 'Rain canvas' })
    e = await addElement('CANVAS', { x: ${PANEL.x}, y: ${PANEL.y}, w: ${PANEL.w}, h: ${PANEL.h}, show: 'normal', handle: 'k2' }); Object.assign(e, { x: ${PANEL.x}, y: ${PANEL.y}, name: 'Clock canvas' })
    project.groups = project.groups || {}; project.groups.gCanvas = 'Canvas'; for (const n of ['Rain canvas', 'Clock canvas']) project.elements.find((x) => x.name === n).group = 'gCanvas'; return 2` },
];
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: 'Matrix Clock', device: 'bip-6', language: 'en-US', optimizePng: 'lossless',
  description: 'Matrix-style katakana rain with a clock whose digits decode out of random digits on every wake, minute and tap. Everything is drawn by the watch on two canvas layers, no pictures.',
  preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/matrix-clock', userImports, userCode, steps }, null, 1));
console.log('recipe.json written');
