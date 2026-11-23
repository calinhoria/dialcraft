// Terminal ASCII: canvas only. A green terminal drawn one character per cell (24 x 18 cells of 16 x 25 px, about 26 px text, one drawText per cell): the command
// "root@bip6:~$ clock --big" types out, the time appears as big amber digits made of filled rectangles (no font glyphs) (each pixel of a 3 x 5 font is one 15 x 24 block with a 1 px gap, 125 px tall) that decode out of random
// characters, then an ASCII box fills its [####------] bars for battery, steps, heart rate and calories (the watch's own sensors, a "--" when one is
// not available), the date and a prompt with a blinking cursor. The scene is rebuilt as a character grid and only the cells that CHANGED are redrawn (a clear
// rect + drawText, about 0.5 ms each). A wake-up or a tap types the whole screen out again (about 3 s); a new minute only re-decodes the digits that change
// (about 1 s); then the face STOPS animating: a once-a-second tick blinks the cursor (one cell), checks the clock and re-reads the numbers when a sensor reports a change (or every minute).
// Steps, heart rate and calories need permissions in app.json (the watch answers PERMISSION DENIED data:user.hd.step / heart_rate / calorie without them, seen on a Bip 6);
// Dialcraft's export does not write them for custom code, so after face-cli run: node post.js (it adds them to out/terminal-ascii/app.json).
const fs = require('fs')
const userImports = "import { Time, Battery, Step, HeartRate, Calorie } from '@zos/sensor'"
const GLY = "{ 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111' }"
const userCode = String.raw`
const DEBUG = true                                       // logs to the developer bridge (zeus bridge): cells redrawn per frame, fps while it plays
let logN = 0
const say = (m) => { if (DEBUG) console.log('[ta ' + (++logN) + '] ' + m) }
say('loading')
const cv = W.k1
const CW = 16, CH = 25, NC = 24, NR = 18, N = NC * NR
const lay = (t, s) => { try { const m = ui.getTextLayout(t, { text_size: s, text_width: 100 }); if (m && m.width > 1 && m.height > 1) return m } catch (e) {} return { width: Math.round(s * 0.6), height: Math.round(s * 1.2) } }
let TS = 40; while (TS > 12 && (lay('#', TS).height > CH + 3 || lay('#', TS).width > CW)) TS--          // the biggest text that still fits a 16 x 25 cell
const OX = Math.round((CW - lay('#', TS).width) / 2), OY = Math.round((CH - lay('#', TS).height) / 2)
let TB = Math.round(TS * 1.3); while (TB > TS && lay('#', TB).width > CW) TB--          // the date and the stats are set a size bigger (about 30 %), as wide as a cell allows
const OXB = Math.round((CW - lay('#', TB).width) / 2), OYB = Math.round((CH - lay('#', TB).height) / 2)
const G = 0x46e66e, DG = 0x1e7837, AM = 0xffbe32, LG = 0x78f096, SHADE = [0x5c4312, 0x9a7020, 0xd9a22b]
const GLY = ${GLY}
const DXS = [4, 8, 14, 18], R0 = 3
const DIG = '\u2588'                                    // marks a clock pixel in the grid (drawn as a rectangle); the decode flickers through dimmer amber blocks
const tm = new Time()
const failed = {}
const rd = (name, f, d) => { try { const v = f(); return v == null || v !== v ? d : v } catch (e) { if (!failed[name] && String(e).indexOf('of null') < 0) { failed[name] = 1; say('read ' + name + ': ' + e) } return d } }   // a failing sensor shows 0 and says why on the bridge, once
const mk = (name, C) => { try { return new C() } catch (e) { say('sensor ' + name + ': ' + e); return null } }   // a sensor that is missing or needs a permission must never stop the face
const bat = mk('battery', Battery), stp = mk('step', Step), hrs = mk('heart', HeartRate), cal = mk('calorie', Calorie)
// ---- cells: the drawn screen and the wanted screen ----
const shCh = new Array(N).fill(' '), shCo = new Array(N).fill(0), tgCh = new Array(N).fill(' '), tgCo = new Array(N).fill(0)
const R1 = { x1: 0, y1: 0, x2: 0, y2: 0, color: 0 }, T1 = { x: 0, y: 0, text: '', text_size: TS, color: 0 }
const cell = (i, ch, co) => {
  const x = (i % NC) * CW, y = Math.floor(i / NC) * CH
  R1.x1 = x; R1.y1 = y; R1.x2 = x + CW - 1; R1.y2 = y + CH - 1          // drawRect on the watch includes its end coordinates: a cell is x .. x + CW - 1 (an end at x + CW would also wipe the first column of the next cell)
  R1.color = 0; cv.drawRect(R1)
  if (ch === DIG) { R1.x2 = x + CW - 2; R1.y2 = y + CH - 2; R1.color = co; cv.drawRect(R1); return }   // a clock pixel is a filled rectangle of its own colour (not a font glyph, which is narrower than the cell), 1 px short of the cell on the right and bottom so the pixels are 1 px apart
  if (ch !== ' ') { const big = i >= 9 * NC && i < 15 * NC; T1.x = x + (big ? OXB : OX); T1.y = y + (big ? OYB : OY); T1.text_size = big ? TB : TS; T1.text = ch; T1.color = co; cv.drawText(T1) }
}
const put = (r, c0, s, co, n) => { const m = n == null ? s.length : Math.min(n, s.length); for (let k = 0; k < m; k++) { const c = c0 + k; if (c >= 0 && c < NC && r >= 0 && r < NR) { tgCh[r * NC + c] = s.charAt(k); tgCo[r * NC + c] = co } } }
// the date and the stats (rows 9 - 14) use the bigger text, whose capitals ('M', 'W', 'B', 'R' ...) are wider than a 16 px cell, so they are NOT drawn cell by cell (the next cell's clear would
// cut the overflow): a row is redrawn as a whole, the date as ONE string with the font's own spacing, centred
const BR0 = 9, BR1 = 14, bigSig = new Array(NR).fill('')
const drawBigRow = (r) => {
  const y = r * CH, c0 = r * NC
  R1.x1 = 0; R1.y1 = y; R1.x2 = 389; R1.y2 = y + CH - 1; R1.color = 0; cv.drawRect(R1)
  T1.text_size = TB; T1.y = y + OYB
  if (r === BR0) {
    let str = '', co = 0; for (let c = 0; c < NC; c++) { str += tgCh[c0 + c]; if (!co && tgCh[c0 + c] !== ' ') co = tgCo[c0 + c] }
    str = str.replace(/^ +| +$/g, '')
    if (str.length) { T1.text = str; T1.color = co; T1.x = Math.max(0, Math.round((390 - lay(str, TB).width) / 2)); cv.drawText(T1) }
    return 1 + (str.length ? 1 : 0)
  }
  let n = 1
  for (let c = 0; c < NC; c++) if (tgCh[c0 + c] !== ' ') { T1.text = tgCh[c0 + c]; T1.color = tgCo[c0 + c]; T1.x = c * CW + OXB; cv.drawText(T1); n++ }
  return n
}
const flush = () => {
  let n = 0
  for (let i = 0; i < N; i++) {
    if (i >= BR0 * NC && i < (BR1 + 1) * NC) continue
    if (tgCh[i] !== shCh[i] || (tgCh[i] !== ' ' && tgCo[i] !== shCo[i])) { cell(i, tgCh[i], tgCo[i]); shCh[i] = tgCh[i]; shCo[i] = tgCo[i]; n++ }
  }
  for (let r = BR0; r <= BR1; r++) {
    let sig = ''; for (let c = 0; c < NC; c++) { const i = r * NC + c; sig += tgCh[i] + (tgCh[i] === ' ' ? '' : tgCo[i]) }
    if (sig !== bigSig[r]) { bigSig[r] = sig; n += drawBigRow(r) }
  }
  return n
}
// ---- time as big characters ----
const timeStr = () => { const h = tm.getHours(), m = tm.getMinutes(); return (h < 10 ? '0' : '') + h + (m < 10 ? '0' : '') + m }
const litFor = (str) => {                                // 3 x 5 pixels, one character per pixel; the colon is two characters in column 12
  const a = new Array(N).fill(0)
  for (let k = 0; k < 4; k++) { const g = GLY[str.charAt(k)]; for (let j = 0; j < 15; j++) if (g.charAt(j) === '1') a[(R0 + Math.floor(j / 3)) * NC + DXS[k] + (j % 3)] = 1 }
  a[(R0 + 1) * NC + 12] = 1; a[(R0 + 3) * NC + 12] = 1
  return a
}
// ---- the numbers ----
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
let DATA = null
const readData = () => {
  const d = new Date(), b = rd('battery', () => bat.getCurrent(), 0), s = rd('steps', () => stp.getCurrent(), 0), st = rd('step target', () => stp.getTarget(), 8000) || 8000
  let h = rd('heart', () => hrs.getCurrent(), 0); if (!h) h = rd('heart last', () => hrs.getLast(), 0)
  const c = rd('calories', () => cal.getCurrent(), 0), ct = rd('calorie target', () => cal.getTarget(), 500) || 500
  say('data: battery ' + b + ', steps ' + s + '/' + st + ', heart ' + h + ', calories ' + c + '/' + ct)
  DATA = { date: DAY[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()],
    bars: [['BAT', b, b + '%'], ['STP', s / st * 100, '' + s], ['HR ', h / 1.8, h > 0 ? '' + h : '--'], ['CAL', c / ct * 100, '' + c]] }
}
let dirty = 0                                             // the sensors tell us when a value changed: the next idle tick reads them again
const watch = (name, o, ev) => { try { if (o && typeof o[ev] === 'function') o[ev](() => { dirty = 1 }) } catch (e) { say('watch ' + name + ': ' + e) } }
watch('battery', bat, 'onChange'); watch('steps', stp, 'onChange'); watch('heart', hrs, 'onCurrentChange'); watch('calories', cal, 'onChange')
// ---- the scene at time t of a play (wake: the whole screen types out, minute: only the changed digits decode, idle: the finished screen) ----
let mode = 'idle', clFrom = new Array(N).fill(0), clTo = new Array(N).fill(0), cursorOn = 1
const CMD = '$ clock --big', CC = 2                        // the command and its left margin (2 cells keep it clear of the rounded corner)
const scene = (t) => {
  tgCh.fill(' '); tgCo.fill(0)
  const wake = mode === 'wake', n = wake ? Math.min(CMD.length, Math.floor(t * 22)) : CMD.length
  put(1, CC, CMD, G, n)
  if (n < CMD.length) put(1, CC + n, '_', G)
  const ct0 = wake ? 0.7 : 0
  for (let i = 0; i < N; i++) {
    if (!clFrom[i] && !clTo[i]) continue
    const c = i % NC, r = Math.floor(i / NC), p = t - ct0 - (c * 0.02 + (r - R0) * 0.03)
    let ch = ' ', co = AM
    if (mode === 'idle' || (clFrom[i] && clTo[i] && !wake)) ch = clTo[i] ? DIG : ' '
    else if (p < 0) ch = clFrom[i] ? DIG : ' '
    else if (p < 0.35) { ch = DIG; co = SHADE[Math.floor(Math.random() * 3)] }
    else ch = clTo[i] ? DIG : ' '
    if (ch !== ' ') { tgCh[i] = ch; tgCo[i] = co }
  }
  if (!wake || t > 1.3) put(9, Math.floor((NC - DATA.date.length) / 2), DATA.date, DG)
  if (!wake || t > 1.4) {
    const k = wake ? Math.max(0, Math.min(1, (t - 1.4) / 0.6)) : 1
    for (let j = 0; j < 4; j++) {
      const b = DATA.bars[j], fill = Math.max(0, Math.min(8, Math.round(8 * Math.max(0, Math.min(100, b[1])) / 100 * k)))
      put(11 + j, CC, b[0] + ' [' + '#'.repeat(fill) + '-'.repeat(8 - fill) + '] ' + b[2], j % 2 === 0 ? G : LG)
    }
  }
  if (!wake || t > 1.9) { put(16, CC, '$', G); if (cursorOn) put(16, CC + 2, '_', G) }
}
// ---- loop ----
let timer = null, playing = false, P0 = 0, frames = 0, cellsSum = 0, tLog = 0, lastStr = '', idleN = 0, didRead = false
const play = (m, now) => {
  readData(); didRead = false; mode = m; playing = true; P0 = now; frames = 0; cellsSum = 0; tLog = now
  const to = litFor(timeStr()); lastStr = timeStr()
  if (m === 'wake') clFrom = new Array(N).fill(0); else clFrom = clTo
  clTo = to; cursorOn = 1
}
const tick = () => {
  timer = null
  const now = Date.now()
  try {
    if (playing) {
      const t = (now - P0) / 1000
      if (!didRead && t > 1.2) { didRead = true; readData() }                   // the watch may not have its numbers ready the instant it wakes: read again once the screen has typed out
      scene(t); const n = flush(); frames++; cellsSum += n
      if (t >= (mode === 'wake' ? 2.5 : 1.3)) {
        playing = false; mode = 'idle'; scene(99); flush()
        say('play done: ' + frames + ' frames, ' + Math.round(cellsSum / Math.max(1, frames)) + ' cells redrawn per frame on average, ' + Math.round(frames * 1000 / Math.max(1, now - P0)) + ' fps')
      }
    } else {
      const s = timeStr()
      if (s !== lastStr) { play('minute', now); say('minute changed: decode') }
      else { idleN++; cursorOn = cursorOn ? 0 : 1; if (dirty || idleN % 60 === 0) { dirty = 0; readData() } scene(99); flush() }
    }
  } catch (e) { say('draw: ' + e); return }
  timer = setTimeout(tick, playing ? Math.max(0, 33 - (Date.now() - now)) : 1000)
}
const stop = () => { if (timer) { try { clearTimeout(timer) } catch (e) {} timer = null } }
const WAKE_GAP = 8000
let pausedAt = 0, startedAt = 0
const onPause = () => { if (Date.now() - startedAt < 1500) return; pausedAt = Date.now(); stop() }   // switching faces: the watch pauses and resumes the new face right after it loads, so a pause that early must not stop the loop
const onResume = () => {
  const n = Date.now()
  if (n - startedAt < 1500) return                       // the watch also calls resume once when the face loads
  say('resume after ' + (n - pausedAt) + ' ms' + (n - pausedAt >= WAKE_GAP ? ': type out' : ': carry on'))
  stop()
  if (n - pausedAt >= WAKE_GAP) play('wake', n); else if (playing) P0 += n - pausedAt
  tick()
}
const onTap = () => { stop(); play('wake', Date.now()); tick() }
try { cv.addEventListener(ui.event.CLICK_UP, onTap) } catch (e) { say('tap: ' + e) }
ui.createWidget(ui.widget.WIDGET_DELEGATE, { pause_call: onPause, resume_call: onResume })
say('ready: text size ' + TS + ', date and stats ' + TB + ', offset ' + OX + '/' + OXB)
R1.x1 = 0; R1.y1 = 0; R1.x2 = 390; R1.y2 = 450; R1.color = 0; cv.drawRect(R1)
startedAt = Date.now(); play('wake', startedAt); say('playing'); tick()`;
const stillScript = `
const GLY = ${GLY}
const c = document.createElement('canvas'); c.width = 390; c.height = 450; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 390, 450)
g.font = '26px Menlo, Monaco, Courier, monospace'; g.textBaseline = 'middle'; g.textAlign = 'center'
const put = (r, c0, s, col) => { g.fillStyle = col; g.font = (r >= 9 && r <= 14 ? 25 : 19) + 'px Menlo, Monaco, Courier, monospace'; for (let k = 0; k < s.length; k++) if (s[k] !== ' ') g.fillText(s[k], (c0 + k) * 16 + 8, r * 25 + 13) }
put(1, 2, '$ clock --big', '#46e66e')
const blk = (r, c) => { g.fillStyle = '#ffbe32'; g.fillRect(c * 16, r * 25, 15, 24) }
const DXS = [4, 8, 14, 18]; '1042'.split('').forEach((ch, k) => { const gg = GLY[ch]; for (let j = 0; j < 15; j++) if (gg[j] === '1') blk(3 + Math.floor(j / 3), DXS[k] + (j % 3)) })
blk(4, 12); blk(6, 12)
put(9, 7, 'Mon 23 Nov', '#1e7837')
const rows = [['BAT', 6, '80%'], ['STP', 5, '5120'], ['HR ', 4, '72'], ['CAL', 3, '312']]
rows.forEach((b, j) => put(11 + j, 2, b[0] + ' [' + '#'.repeat(b[1]) + '-'.repeat(8 - b[1]) + '] ' + b[2], j % 2 === 0 ? '#46e66e' : '#78f096'))
put(16, 2, '$ _', '#46e66e')
const n = addProjectImage('ta/still.png', c, {}).name; await loadAllImages()
const e = await addElement('IMG', { src: n }); Object.assign(e, { name: 'Terminal (preview)', src: n, x: 0, y: 0, show: 'normal', previewOnly: true }); return n`;
const steps = [
  { script: 'project.appId = 2024164; return 1' },
  { script: stillScript },
  { script: `let e = await addElement('CANVAS', { x: 0, y: 0, w: 390, h: 450, show: 'normal', handle: 'k1' }); Object.assign(e, { x: 0, y: 0, name: 'Terminal canvas' })
    project.groups = project.groups || {}; project.groups.gCanvas = 'Canvas'; project.elements.find((x) => x.name === 'Terminal canvas').group = 'gCanvas'; return 1` },
];
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: 'Terminal ASCII', device: 'bip-6', language: 'en-US', optimizePng: 'lossless',
  description: 'A green terminal drawn in big text characters: the command types out, the time appears as big amber # digits that decode, and an ASCII box fills bars for battery, steps, heart rate and calories. It plays for about 2.5 seconds on every wake-up or tap, then only blinks the cursor. All drawn by the watch on one canvas, no pictures.',
  preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/terminal-ascii', userImports, userCode, steps }, null, 1));
console.log('recipe.json written');
