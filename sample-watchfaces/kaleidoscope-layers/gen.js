// Kaleidoscope Layers: a digital face over a shape kaleidoscope drawn live by the watch on 3 CANVAS layers.
// Each wake / tap makes a new pattern: a palette (24, vivid, from Lospec + neon sets; no magenta / chroma green / raw neon), 6-12
// slices, and 3 different solid shapes (dots, shards, petals, crescents, hexagons, octagons). Each shape sits on its OWN canvas with
// its own widget.setAlpha (20-80%), so overlapping shapes really blend (measured on a Bip 6: setAlpha canvases blend; the canvas has
// no transform, so the shapes are turned / mirrored into every slice by the maths in vet.js). Wake: shapes fly in while the
// kaleidoscope turns (3 s), a 2 s drift to rest, then it holds still (the canvas keeps its pixels). Outline shapes, needles and
// stars were dropped (outlines stuttered on the watch). Time and date: native layers in Open Sans Regular, white with a 2 px
// black border; the code is project.userCode. After face-cli: node post.js.
// mockup.html is the design mockup (same engine; #t=ms&r=seed freezes it, #still renders the screen only for build/still.png).
const fs = require('fs'), B = __dirname + '/build/';
const vet = fs.readFileSync(__dirname + '/vet.js', 'utf8').replace('/*PALS*/', JSON.stringify(JSON.parse(fs.readFileSync(__dirname + '/palettes.json', 'utf8'))));
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(B + f).toString('base64');
const userImports = '';
// the face's code (project.userCode): it draws on the three Canvas layers of the layout (handles k1..k4, under the time and date) and a tap on the full-screen 'tap' Text layer starts a new pattern
const userCode = String.raw`` + vet + String.raw`
// wake motion: flow-in 2 s while turning steadily, then a 1 s drift to rest. The turn always lands at exactly 0 (a mirror line
// straight up: the pattern upright and left-right symmetric): it starts TURN back, TURN = the whole number of slices nearest 60 deg
const FLOW = 2000, DRIFT = 1000, S_END = (FLOW + DRIFT / 2) / 1000
const motion = (ms, W) => { const t = Math.max(0, ms); let s; if (t < FLOW) s = t / 1000; else { const u = Math.min(t - FLOW, DRIFT); s = (FLOW + u - u * u / (2 * DRIFT)) / 1000 }
  const TURN = Math.max(1, Math.round((Math.PI / 3) / W)) * W
  const e = Math.min(1, t / FLOW); return { spin: -TURN * (1 - s / S_END), flow: Math.pow(1 - e, 3), done: t >= FLOW + DRIFT } }
const DEBUG = false                                      // true: log to the developer bridge
const say = (m) => { if (DEBUG) console.log('[kl] ' + m) }
const L = [W.k1, W.k2, W.k3]       // the three Canvas layers of the layout (code handles k1..k3), see the layer list
let V = null, timer = null, t0 = 0, frames = 0
const tick = () => {
  timer = null
  const ms = Date.now() - t0, M = motion(ms, V.W)
  try { L.forEach((c) => c.clear({ x: 0, y: 0, w: 390, h: 450 })); VET.frame(V, M, L) } catch (e) { say('draw: ' + e); return }
  frames++
  if (!M.done) timer = setTimeout(tick, 0)
  else say(Math.round(frames * 1000 / ms) + ' fps, ' + V.draws + ' draws, ' + V.SEG + ' slices, ' + V.R.types.join(' ') + ', ' + V.P.name)
}
const stop = () => { if (timer) { try { clearTimeout(timer) } catch (e) {} timer = null } }
const start = () => {
  stop()
  const seed = ((Date.now() & 0x7fffffff) ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0
  try { V = VET.make(seed, { pal: -1, arms: 0, cx: 195, cy: 225 }); L.forEach((c, i) => c.setAlpha(Math.round(255 * (V.ALPHA[i] || 1)))) } catch (e) { say('make: ' + e); return }
  t0 = Date.now(); frames = 0; tick()
}
try { W.tap.addEventListener(ui.event.CLICK_UP, start) } catch (e) { say('tap: ' + e) }       // the empty full-screen Text layer on top (handle tap)
ui.createWidget(ui.widget.WIDGET_DELEGATE, { pause_call: stop, resume_call: start })
start()`;
const FONT = 'Open Sans Regular', fontB64 = fs.readFileSync(B + 'open-sans-400.ttf').toString('base64');
// white Open Sans with a 2 px black border (readable on any pattern); shown on the always-on screen too
const glyph = (size) => ({ font: FONT, size, weight: 400, fill: 'solid', color: '#ffffff', borderColor: '#000000', borderWidth: 2 });
const kit = fs.readFileSync(__dirname + '/../../.claude/skills/create-amazfit-watchface/examples/animated/kit.js', 'utf8');
const steps = [
  { script: `project.appId = 1133691; await registerCustomFont({ name: 'open-sans-400.ttf', family: '${FONT}', format: 'truetype', ext: '.ttf', dataBase64: '${fontB64}' });
    await document.fonts.load('80px "${FONT}"'); return 1` },
  // the editor / store preview: one pattern (hidden on the watch, where the canvases draw)
  { script: `const im = new Image(); im.src = '${b64('still.png')}'; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0);
    const n = addProjectImage('kal/still.png', c, {}).name; await loadAllImages(); const e = await addElement('IMG', { src: n }); Object.assign(e, { name: 'Kaleidoscope (preview)', src: n, x: 0, y: 0, show: 'normal', previewOnly: true }); return n` },
  // the three drawing surfaces: Canvas layers in the layout (under the time and date), the code reaches them by handle; opacity is set by the code per pattern
  { script: `for (let i = 1; i <= 3; i++) { const e = await addElement('CANVAS', { x: 0, y: 0, w: 390, h: 450, show: 'normal', handle: 'k' + i }); Object.assign(e, { x: 0, y: 0, name: 'Kaleidoscope canvas ' + i }) } return 3` },
  { preset: 'clock' }, { preset: 'weekday' }, { preset: 'day' },
  // on top of everything: an empty full-screen Text layer catches the tap (handle tap)
  { script: `const t = await addElement('TEXT', { x: 0, y: 0, w: 390, h: 450, text: '', show: 'normal', handle: 'tap' }); Object.assign(t, { x: 0, y: 0, name: 'Tap for a new pattern' }); return 1` },
  { edit: 'Hour', set: { show: 'both', zero: 1 }, glyph: glyph(92) },
  { edit: 'Colon', set: { show: 'both' }, glyph: glyph(92) },
  { edit: 'Minute', set: { show: 'both', zero: 1 }, glyph: glyph(92) },
  { edit: 'Weekday', set: { show: 'both' }, glyph: glyph(38) },
  { edit: 'Day', set: { show: 'both', zero: 0 }, glyph: glyph(38) },
  // placed on their ink (kit): the colon centred on the screen and on the digits, hours right-aligned before it, minutes after it;
  // the weekday + day row with dateRow (names of any length, fixed gap, shared baseline)
  { script: kit + `
const CY = 230, GAP = 8
await align(['Hour', 'Minute'], { cy: CY })
const hb = await inkBox(['Hour']); const cb0 = await align(['Colon'], { cx: 195, cy: hb.cy })
E('Hour').alignH = 'RIGHT'; await align(['Hour'], { r: cb0.x - GAP })
E('Minute').alignH = 'LEFT'; await align(['Minute'], { l: cb0.r + GAP })
const wd = E('Weekday'); wd.labelAlign = 'right'; rerenderGlyphLayers(); await loadAllImages()
park(['Weekday', 'Day']); await dateRow(195, 146, 10)
// whole rows centred on the screen (their ink at the reference time / date)
await align(['Hour', 'Colon', 'Minute'], { cx: 195 }); await align(['Weekday', 'Day'], { cx: 195 })
project.groups = project.groups || {}; project.groups.gDate = 'Date'; for (const n of ['Weekday', 'Day']) E(n).group = 'gDate'
return 'colon ' + JSON.stringify(cb0)` },
];
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: 'Kaleidoscope Layers', device: 'bip-6', language: 'en-US', optimizePng: 'lossless',
  description: 'A digital face over a shape kaleidoscope the watch draws live on three see-through canvas layers: every wake or tap brings new colours and shapes that fly in, turn and settle.',
  preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/kaleidoscope-layers', userCode, steps }, null, 1));
console.log('recipe.json written');
