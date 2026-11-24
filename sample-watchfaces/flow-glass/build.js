// Flow Glass (door to another dimension): a deep starfield with a full honeycomb of flat tiles with four round windows that open (the tiles vanish ring by ring) onto a starfield and a faint nebula, and fill again, like doors to another dimension. The sky is a picture
// (a nebula and many static stars); on TWO canvases the watch draws the twinkling stars (under the tiles) and the tiles (a flat hexagon plus a lighter facet). The tile colours follow a slow
// plasma field over a six-colour palette; at every minute change a slow ripple of light passes through the tiles, a tap sends one from your finger, and now and then one tile sparkles.
// The time is a native layer: tall, glassy, mostly opaque digits, hours over minutes. Always-on: the outline time only.
const GEO = __GEO__;
const P = GEO.pos, Z = GEO.size, N = GEO.names;
const ph = (name, [w, h]) => addProjectImage(name, mk(w, h), { replace: true });
const SIZE = { bg: [W, H], still: Z.still };
for (let d = 0; d < 10; d++) { SIZE['g' + d] = Z.g; SIZE['a' + d] = Z.g; }
for (const [n, sz] of Object.entries(SIZE)) ph('fg/' + n + '.png', sz);
const els = [];
const add = (kind, patch) => { const e = newElement(kind, Object.assign({ show: 'normal' }, patch)); project.elements.push(e); els.push(e); return e; };
add('IMG', { name: 'Tiles (preview)', src: 'fg/still.png', x: 0, y: 0, previewOnly: true });
add('CANVAS', { name: 'Tiles', x: 0, y: 0, w: W, h: H, handle: 'cv' });
add('IMG_TIME', { name: 'Hour', part: 'hour', images: N.g, zero: 1, space: P.space, x: P.hour[0], y: P.hour[1] });
add('IMG_TIME', { name: 'Minute', part: 'minute', images: N.g, zero: 1, space: P.space, x: P.minute[0], y: P.minute[1] });
add('IMG_TIME', { name: 'Hour AOD', part: 'hour', images: N.a, zero: 1, space: P.space, x: P.hour[0], y: P.hour[1], show: 'aod' });
add('IMG_TIME', { name: 'Minute AOD', part: 'minute', images: N.a, zero: 1, space: P.space, x: P.minute[0], y: P.minute[1], show: 'aod' });
project.userCode = `// <door>
// A full honeycomb of hexagon tiles (side 20), a flat rainbow laid across the screen in diagonal bands; waves of flips turn tiles over (they squeeze to a sliver and open as the opposite hue of the rainbow), the tiles are 80 % opaque, with four WINDOWS. The tiles outside the windows live on one canvas, the tiles inside the windows on another, so a window can be opened
// (its tiles are erased ring by ring from the middle, the starfield and nebula show through) and filled again (the tiles come back from the edge inwards, each with a flash). Tile colour =
// a rainbow of 12 hues laid across the screen in diagonal bands that roll on by one band every 8-12 seconds (tile after tile, so it flows); only a tile whose colour changed is redrawn. Stars: 46 twinkling dots on a canvas under the tiles. A slow ripple of light at every
// minute change and from a tap. About 5 frames a second; the tile colours are only recomputed every 8-12 seconds (and the field drifts slowly), so most frames draw nothing.
{
  const PAL = __PAL__, TL = __TILES__, STARS = __STARS__, WIN = __WINDOWS__
  const S = 20, RAD = 18.4, BUDGET = 40, STEP = 420
  const cv = W.cv
  const pts = []; for (let k = 0; k < 7; k++) pts.push({ x: 0, y: 0 })
  const PP = { data_array: pts, color: 0 }
  const COS = [], SIN = []; for (let k = 0; k < 6; k++) { COS.push(Math.cos(k * Math.PI / 3)); SIN.push(Math.sin(k * Math.PI / 3)) }
  const RS = { x1: 0, y1: 0, x2: 0, y2: 0, color: 0 }, CL = { x: 0, y: 0, w: 34, h: 28 }
  const rnd = (a, b) => a + Math.random() * (b - a)
  const pack = (c) => (c[0] << 16) | (c[1] << 8) | c[2]
  const lift = (c, k) => [Math.min(255, c[0] + k), Math.min(255, c[1] + k), Math.min(255, c[2] + k)]
  const COLS = PAL.map(pack), LIGHT = PAL.map((c) => pack(lift(c, 100)))
  const T = TL.map((t) => ({ x: t[0], y: t[1], d: t[2], win: t[3], dw: t[4], idx: -1, want: 0, flashAt: 0, flipAt: 0, flashEnd: 0, pend: false, present: true, at: 0, cv: cv, hue: Math.floor(((0.6 * t[0] + 0.8 * t[1]) / 560) * PAL.length) % PAL.length, fs: -1, fat: 0 }))
  const WS = [].map((w, i) => ({ i, mode: 'closed', t0: 0, nextAt: Date.now() + 5000 + i * 4200, max: w[2] + 0.2, tiles: T.filter((o) => o.win === i) }))
  const PT = { color: 0, line_width: 2 }
  const hex = (c, x, y, col, r, dx, dy) => { for (let k = 0; k < 6; k++) { pts[k].x = Math.round(x + dx + r * COS[k]); pts[k].y = Math.round(y + dy + r * SIN[k]) } pts[6].x = pts[0].x; pts[6].y = pts[0].y; PP.color = col; c.drawPoly(PP) }
  const outline = (c, x, y, hue, sx) => {                     // a flat rainbow tile; sx < 1 squeezes it sideways (a tile turning over)
    for (let k = 0; k < 6; k++) { pts[k].x = Math.round(x + RAD * COS[k] * sx); pts[k].y = Math.round(y + RAD * SIN[k]) } pts[6].x = pts[0].x; pts[6].y = pts[0].y
    PP.color = COLS[hue]; c.drawPoly(PP)
  }
  const FLIP = [0.62, 0.14, 0.62, 1], FSTEP = 190
  const flipStep = (o, now) => {                              // one step of a flip: erase the inside of the tile (a little inside its border, so the neighbours' borders stay) and draw it squeezed
    CL.x = o.x - 17; CL.y = o.y - 14; CL.w = 34; CL.h = 28; o.cv.clear(CL)
    if (o.fs === 1) o.hue = (o.hue + 6) % PAL.length                        // the back of a tile is the opposite hue of the rainbow
    outline(o.cv, o.x, o.y, o.hue, FLIP[o.fs])
    if (o.fs >= 3) { o.fs = -1; o.idx = 0 } else { o.fs++; o.fat = now + FSTEP }
  }
  const ST = STARS.map((s) => ({ s, lv: -1 }))
  const TINT = [[190, 200, 235], [235, 215, 190], [200, 230, 240]], LEVEL = [0.16, 0.34, 0.6, 0.88]
  const star = (o, lv) => {
    const c = TINT[o.s.tint], k = LEVEL[lv], col = (Math.floor(c[0] * k) << 16) | (Math.floor(c[1] * k) << 8) | Math.floor(c[2] * k)
    RS.color = col; RS.x1 = o.s.x; RS.y1 = o.s.y; RS.x2 = o.s.x + 2; RS.y2 = o.s.y + 2; cs.drawRect(RS)
    if (o.s.big) { RS.x1 = o.s.x - 3; RS.y1 = o.s.y + 1; RS.x2 = o.s.x + 5; RS.y2 = o.s.y + 2; cs.drawRect(RS); RS.x1 = o.s.x + 1; RS.y1 = o.s.y - 3; RS.x2 = o.s.x + 2; RS.y2 = o.s.y + 5; cs.drawRect(RS) }
  }
  let pri = [], norm = [], timer = null, last = 0, startedAt = 0, pausedAt = 0, errs = 0, nF = 0, msF = 0, nOps = 0, nStar = 0, tLog = 0, lastMin = -1, nextSpark = 0, nextWave = Date.now() + 5000, nextField = Date.now() + 9000
  const NP = PAL.length; let phase = 0
  for (const o of T) { o.s = (0.6 * o.x + 0.8 * o.y) / 560; o.want = o.nextIdx = Math.floor(o.s * NP) % NP; o.chgAt = 0 }          // the position of the tile across the diagonal bands, and its starting colour
  const field = (now) => { return
                                                     // a rainbow laid across the screen in diagonal bands; every update it rolls on by one band, tile after tile
    phase = (phase + 1) % NP
    for (const o of T) { o.nextIdx = (Math.floor(o.s * NP) + phase) % NP; o.chgAt = now + o.s * 1800 }
  }
  const wave = (ox, oy, now, perTile, reach) => { for (const o of T) { if (!o.present) continue; const d = Math.sqrt((o.x - ox) * (o.x - ox) + (o.y - oy) * (o.y - oy)) / 30; if (d <= (reach || 99)) o.flipAt = now + d * perTile } }
  const windows = (now) => {
    for (const w of WS) {
      if (w.mode === 'closed' && now >= w.nextAt) { w.mode = 'opening'; w.t0 = now; for (const o of w.tiles) o.at = now + o.dw * STEP + rnd(0, 120) }
      else if (w.mode === 'opening') {
        let left = 0
        for (const o of w.tiles) { if (o.present) { if (now >= o.at && !o.pend) { o.pend = true; o.flashAt = 0; o.flashEnd = 0; pri.push([o, 2]) } left++ } }
        if (left === 0) { w.mode = 'open'; w.nextAt = now + rnd(9000, 14000) }
      } else if (w.mode === 'open' && now >= w.nextAt) { w.mode = 'closing'; w.t0 = now; for (const o of w.tiles) o.at = now + (w.max - o.dw) * STEP + rnd(0, 120) }
      else if (w.mode === 'closing') {
        let left = 0
        for (const o of w.tiles) { if (!o.present) { if (now >= o.at) { o.present = true; o.idx = -1; o.flashAt = now; o.flashEnd = 0 } else left++ } }
        if (left === 0) { w.mode = 'settle'; w.t0 = now }
      } else if (w.mode === 'settle' && now - w.t0 > 1200) { w.mode = 'closed'; w.nextAt = now + rnd(7000, 12000) }
    }
  }
  const frame = (now) => {
    const d = new Date(), m = d.getMinutes()
    if (lastMin >= 0 && m !== lastMin) wave(195, 225, now, 190); lastMin = m
    if (now >= nextSpark) { const o = T[Math.floor(Math.random() * T.length)]; if (o.fs < 0) { o.flipAt = now } nextSpark = now + rnd(2500, 5000) }
    if (now >= nextWave) { const q = T[Math.floor(Math.random() * T.length)]; wave(q.x, q.y, now, 130, 3.2); nextWave = now + rnd(10000, 16000) }
    if (now >= nextField) { field(now); nextField = now + rnd(8000, 12000) }          // the colours move on only every 8-12 seconds, and only the tiles the slow field has carried across a colour boundary change
    windows(now)
    let n = 0
    for (const o of T) {
      if (n >= 14) break
      if (o.fs >= 0) { if (now >= o.fat) { flipStep(o, now); n++ } }
      else if (o.flipAt && now >= o.flipAt) { o.flipAt = 0; o.fs = 0; flipStep(o, now); n++ }
      else if (o.idx < 0) { o.idx = 0; outline(o.cv, o.x, o.y, o.hue, 1); n++ }          // first draw of every tile (a few per frame, so the honeycomb fills in over a couple of seconds)
    }
    nOps += n
    let ns = 0
    nStar += ns
  }
  const tick = () => {
    timer = null
    const now = Date.now(); last = now
    try { frame(now) } catch (e) { if (errs++ < 3) console.log('[door] ' + e) }
    nF++; msF += Date.now() - now
    if (now - tLog >= 5000) { if (tLog) console.log('[door] ' + (nF * 1000 / (now - tLog)).toFixed(1) + ' fps, ' + (msF / nF).toFixed(1) + ' ms per frame, ' + (nOps / nF).toFixed(2) + ' tile ops and ' + (nStar / nF).toFixed(1) + ' star redraws per frame, windows ' + WS.map((w) => w.mode).join('/')); tLog = now; nF = 0; msF = 0; nOps = 0; nStar = 0 }
    timer = setTimeout(tick, Math.max(0, 200 - (Date.now() - now)))          // about 5 frames a second
  }
  const stop = () => { if (timer) { try { clearTimeout(timer) } catch (e) {} timer = null } }
  try { cv.setAlpha(204) } catch (e) { console.log('[door] alpha ' + e) }          // the tiles are 80 % opaque (204 of 255): the sky shows faintly through them
  for (const c of [cv]) try { c.addEventListener(ui.event.CLICK_UP, (i) => { wave(i.x, i.y, Date.now(), 120, 4) }) } catch (e) {}
  const onPause = () => { if (Date.now() - startedAt < 1500) return; console.log('[door] paused by the watch'); pausedAt = Date.now(); stop() }
  const onResume = () => { const n = Date.now(); if (n - startedAt < 1500) return; console.log('[door] resumed'); last = n; if (!timer) tick() }
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { pause_call: onPause, resume_call: onResume })
  startedAt = Date.now(); last = startedAt
  console.log('[door] start: canvases ' + (cv ? 'ok' : 'MISSING') + ' ' + T.length + ' tiles, ' + WS.length + ' windows, ' + ST.length + ' stars')
  tick()
  console.log('[door] first frame drawn' + (errs ? ' with ' + errs + ' error(s)' : ' without errors'))
}
// </door>
`.replace('__PAL__', JSON.stringify(GEO.pal)).replace('__TILES__', JSON.stringify(GEO.tiles)).replace('__STARS__', JSON.stringify(GEO.stars)).replace('__WINDOWS__', JSON.stringify(GEO.windows));
project.groups = project.groups || {};
const grp = (id, name, names) => { project.groups[id] = name; for (const n of names) { const e = els.find((x) => x.name === n); if (e) e.group = id; } };
grp('gDoor', 'Sky and tiles', ['Tiles']); grp('gClock', 'Clock', ['Hour', 'Minute']); grp('gAod', 'Always-on', ['Hour AOD', 'Minute AOD']);
return project.elements.map((x) => x.name).join(', ');
