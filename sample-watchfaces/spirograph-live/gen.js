// Spirograph Live: a digital face over spirographs the watch draws live. Every wake or tap the pen draws 3 nested hypotrochoids (one
// per CANVAS layer, each with its own opacity so the overlaps blend) in about 2.5 s with drawLine; the ink stays (a canvas keeps its
// pixels), so the face then costs nothing. The curve maths is spiro.js (shared with the editor's still); vet.js checks it.
// Layout: preview still (editor only), 3 Canvas layers (handles k1..k3), time (Open Sans, white with a 5 px black border),
// and an empty full-screen Text layer on top (handle tap) that catches the tap. After face-cli: node post.js.
const fs = require('fs'), B = __dirname + '/build/';
const spiro = fs.readFileSync(__dirname + '/spiro.js', 'utf8');
const ALPHAS = [240, 195, 150];            // layer opacity of the 3 canvases (setAlpha on the watch)
const STILL_SEED = 628374;
const CV = { x: 50, y: 135, w: 290, h: 290 }, FIT = 140;      // the canvas layers: just the spirograph's box (smaller = cheaper to redraw); centre (195, 280) on the screen
const userImports = '';
const userCode = spiro + String.raw`
const DEBUG = false                                      // true: log to the developer bridge
const say = (m) => { if (DEBUG) console.log('[sp] ' + m) }
const C = [W.k1, W.k2, W.k3]                            // the three Canvas layers of the layout (code handles k1..k3)
const DUR = 2500
const LN = { x1: 0, y1: 0, x2: 0, y2: 0, color: 0 }, PT = { color: 0, line_width: 2 }
let V = null, timer = null, t0 = 0, done = [0, 0, 0], last = [null, null, null], frames = 0
const tick = () => {
  timer = null
  const ms = Date.now() - t0, prog = Math.min(1, ms / DUR)
  try {
    for (let c = 0; c < 3; c++) {
      const cu = V.curves[c], tgt = Math.floor(prog * cu.P)
      if (tgt <= done[c]) continue
      PT.color = cu.color; PT.line_width = cu.w; C[c].setPaint(PT)           // the brush sets the width; each segment gets its own rainbow colour
      while (done[c] < tgt) {
        done[c]++
        const p = cu.pt(done[c]), q = last[c]
        LN.x1 = q[0]; LN.y1 = q[1]; LN.x2 = p[0]; LN.y2 = p[1]; LN.color = cu.col(done[c])
        C[c].drawLine(LN); last[c] = p
      }
    }
  } catch (e) { say('draw: ' + e); return }
  frames++
  if (prog < 1) timer = setTimeout(tick, 0)
  else say(Math.round(frames * 1000 / ms) + ' fps, ' + V.info)
}
// pause / resume: pulling down the notification shade pauses the face just like the screen turning off, so a short absence only carries on; a longer one
// (a real wake-up) starts a new drawing
const WAKE_GAP = 8000
let pausedAt = 0, startedAt = 0
const stop = () => { if (timer) { try { clearTimeout(timer) } catch (e) {} timer = null } }
const start = () => {
  stop(); startedAt = Date.now()
  const seed = ((Date.now() & 0x7fffffff) ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0
  try {
    V = SP.make(seed, { cx: ${CV.w / 2}, cy: ${CV.h / 2}, fit: ${FIT} })
    C.forEach((cv) => cv.clear({ x: 0, y: 0, w: ${CV.w}, h: ${CV.h} }))
    done = [0, 0, 0]; last = V.curves.map((cu) => cu.pt(0))
  } catch (e) { say('make: ' + e); return }
  t0 = Date.now(); frames = 0; tick()
}
try { W.tap.addEventListener(ui.event.CLICK_UP, start) } catch (e) { say('tap: ' + e) }       // the empty full-screen Text layer on top (handle tap)
const onPause = () => { pausedAt = Date.now(); stop() }
const onResume = () => {
  const n = Date.now()
  if (n - startedAt < 1500) return                       // the watch also calls resume once when the face loads
  if (n - pausedAt >= WAKE_GAP) { start(); return }
  t0 += n - pausedAt; if (V && done.some((d, i) => d < V.curves[i].P)) tick()                    // a drawing in progress carries on
}
ui.createWidget(ui.widget.WIDGET_DELEGATE, { pause_call: onPause, resume_call: onResume })
start()`;
const FONT = 'Open Sans Regular', fontB64 = fs.readFileSync(B + 'open-sans-400.ttf').toString('base64');
const glyph = (size) => ({ font: FONT, size, weight: 400, fill: 'solid', color: '#ffffff', borderColor: '#000000', borderWidth: 5 });
const kit = fs.readFileSync(__dirname + '/../../.claude/skills/create-amazfit-watchface/examples/animated/kit.js', 'utf8');
// the editor / store still: the same engine, one pattern, drawn in the editor with the same opacities (hidden on the watch)
const stillScript = spiro + `
const V = SP.make(${STILL_SEED}, { cx: ${CV.x + CV.w / 2}, cy: ${CV.y + CV.h / 2}, fit: ${FIT} }), AL = ${JSON.stringify(ALPHAS)}
const c = document.createElement('canvas'); c.width = 390; c.height = 450; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 390, 450)
g.lineWidth = 2; g.lineJoin = 'round'; g.lineCap = 'round'
V.curves.forEach((cu, k) => { g.globalAlpha = AL[k] / 255; let q = cu.pt(0); for (let i = 1; i <= cu.P; i++) { const p = cu.pt(i); g.strokeStyle = '#' + ('00000' + cu.col(i).toString(16)).slice(-6); g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(p[0], p[1]); g.stroke(); q = p } })
const n = addProjectImage('sp/still.png', c, {}).name; await loadAllImages()
const e = await addElement('IMG', { src: n }); Object.assign(e, { name: 'Spirograph (preview)', src: n, x: 0, y: 0, show: 'normal', previewOnly: true }); return n + ' ' + V.info`;
const steps = [
  { script: `project.appId = 2024150; await registerCustomFont({ name: 'open-sans-400.ttf', family: '${FONT}', format: 'truetype', ext: '.ttf', dataBase64: '${fontB64}' });
    await document.fonts.load('80px "${FONT}"'); return 1` },
  { script: stillScript },
  // the three drawing surfaces: Canvas layers in the layout, under the time and date; the code reaches them by handle
  { script: `const AL = ${JSON.stringify(ALPHAS)}; for (let i = 1; i <= 3; i++) { const e = await addElement('CANVAS', { x: ${CV.x}, y: ${CV.y}, w: ${CV.w}, h: ${CV.h}, show: 'normal', handle: 'k' + i }); Object.assign(e, { x: ${CV.x}, y: ${CV.y}, alpha: AL[i - 1], name: 'Spirograph canvas ' + i }) } return 3` },
  { preset: 'clock' },
  // on top of everything: an empty full-screen Text layer catches the tap (handle tap)
  { script: `const t = await addElement('TEXT', { x: 0, y: 0, w: 390, h: 450, text: '', show: 'normal', handle: 'tap' }); Object.assign(t, { x: 0, y: 0, name: 'Tap for a new spirograph' }); return 1` },
  { edit: 'Hour', set: { show: 'both', zero: 1 }, glyph: glyph(92) },
  { edit: 'Colon', set: { show: 'both' }, glyph: glyph(92) },
  { edit: 'Minute', set: { show: 'both', zero: 1 }, glyph: glyph(92) },
  { script: kit + `
const CY = 78, GAP = 8
await align(['Hour', 'Minute'], { cy: CY })
const hb = await inkBox(['Hour']); const cb0 = await align(['Colon'], { cx: 195, cy: hb.cy })
E('Hour').alignH = 'RIGHT'; await align(['Hour'], { r: cb0.x - GAP })
E('Minute').alignH = 'LEFT'; await align(['Minute'], { l: cb0.r + GAP })
await align(['Hour', 'Colon', 'Minute'], { cx: 195 })
project.groups = project.groups || {}
project.groups.gCanvas = 'Canvas'; for (const n of ['Spirograph canvas 1', 'Spirograph canvas 2', 'Spirograph canvas 3']) E(n).group = 'gCanvas'
return 'colon ' + JSON.stringify(cb0)` },
];
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: 'Spirograph Live', device: 'bip-6', language: 'en-US', optimizePng: 'lossless',
  description: 'A digital face over spirographs the watch draws live: every wake or tap the pen draws three nested curves in new colours, each on its own see-through canvas layer, and the ink stays on the screen.',
  preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/spirograph-live', userCode, steps }, null, 1));
console.log('recipe.json written');
