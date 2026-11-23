// ---- VET: the shape kaleidoscope (watch-portable: drawCircle, strokeCircle, drawLine + setPaint, drawPoly, strokePoly only) ----
// A pattern = 3 shapes, each on its OWN canvas layer with its own widget.setAlpha (20-80%), 3 different solid types
// (outline shapes stuttered on the watch, so none). Each shape lives in one wedge and is drawn turned / mirrored into every slice (the maths does the turning).
// Shapes (after a kaleidoscope design guide): sharp shards, petals / teardrops, crescents, thin rods, dots, stars, hexagons, octagons.
var VET = (function () {
  var PALS = /*PALS*/
  var SOLID = ['dot', 'shard', 'petal', 'crescent', 'hex', 'oct'],      // needles and stars removed (owner's choice)
      OUTLINE = ['ring', 'shardline', 'petalline', 'crescentline', 'starline', 'hexline', 'octline']
  // ms per draw: dot .6, rod .7 (thick line), shard 1.0 (triangle) measured; the rest estimated (polygons ~1-1.7, outlines ~1.5)
  var COST = { dot: 0.6, rod: 0.7, shard: 1.0, petal: 1.3, crescent: 1.3, star: 1.4, hex: 1.7, oct: 1.7, ring: 1.5, shardline: 1.2, petalline: 1.5, crescentline: 1.5, starline: 1.6, hexline: 1.5, octline: 1.6 }
  var MEASURED = { dot: 1, rod: 1, shard: 1, hex: 1 }
  var RECIPES = [{ name: 'Random mix', note: '3 different solid shapes', random: true }]
  var SHADES = [0.8, 0.5, 0.2]
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6d2b79f5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
  function hx(s) { return parseInt(s.slice(1), 16) }
  function lum(c) { var f = function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f((c >> 16) & 255) + 0.7152 * f((c >> 8) & 255) + 0.0722 * f(c & 255) }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
  function mix(c, bg, a) { var r = ((c >> 16) & 255) * a + ((bg >> 16) & 255) * (1 - a), g = ((c >> 8) & 255) * a + ((bg >> 8) & 255) * (1 - a), b = (c & 255) * a + (bg & 255) * (1 - a); return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b) }
  // the outline of each polygon shape in its own units (size 1, pointing along +x); stars / octagons etc. are regular
  function outlinePts(base, r) {
    var p = [], j, t, u
    if (base === 'shard') { var a1 = 2.0 + r() * 0.5, a2 = -1.8 - r() * 0.6; p = [[0.75, 0], [Math.cos(a1) * (0.25 + r() * 0.2), Math.sin(a1) * (0.25 + r() * 0.2)], [Math.cos(a2) * (0.35 + r() * 0.25), Math.sin(a2) * (0.35 + r() * 0.25)]] }
    else if (base === 'petal') { for (j = 0; j <= 7; j++) { u = -1 + j * 2 / 7; p.push([u * 0.6, 0.26 * Math.pow(1 - u * u, 0.7) * (1 - 0.45 * u)]) } for (j = 6; j >= 1; j--) { u = -1 + j * 2 / 7; p.push([u * 0.6, -0.26 * Math.pow(1 - u * u, 0.7) * (1 - 0.45 * u)]) } }
    else if (base === 'crescent') { for (j = 0; j <= 7; j++) { t = -1.9 + j * 3.8 / 7; p.push([Math.cos(t) * 0.5, Math.sin(t) * 0.5]) } for (j = 6; j >= 1; j--) { t = -1.55 + j * 3.1 / 7; p.push([0.17 + Math.cos(t) * 0.4, Math.sin(t) * 0.4]) } }
    else { var nv = base === 'hex' ? 6 : base === 'oct' ? 8 : 10; for (j = 0; j < nv; j++) { t = j * Math.PI * 2 / nv; var rj = base === 'star' && j % 2 ? 0.22 : 0.5; p.push([Math.cos(t) * rj, Math.sin(t) * rj]) } }
    return p
  }
  // opt: {pal: index or -1 random, arms: number or 0, cx, cy}
  // 3 or 4 arms (6 or 8 slices)
  var N = 3        // shapes = Canvas layers
  function make(seed, opt) {
    var r = rng(seed), pick = function (a) { return a[Math.floor(r() * a.length)] }
    var pi = opt.pal >= 0 ? opt.pal : Math.floor(r() * PALS.length), P = PALS[pi], R = RECIPES[0]
    var arms = opt.arms || pick([3, 4]), SEG = 2 * arms, W = Math.PI * 2 / SEG
    // background: black unless the colours are too dark to see on it (median contrast < 3:1), then the darkest grey that works
    var cols = P.colors.map(hx), bg = 0x000000, tries = [0x000000, 0x2a2a2e, 0x55555c, 0x8a8a92]
    for (var bi = 0; bi < tries.length; bi++) { var cc = cols.map(function (k) { return contrast(k, tries[bi]) }).sort(function (a, b) { return a - b }); bg = tries[bi]; if (cc[Math.floor(cc.length / 2)] >= 3) break }
    // 4 different types: one outline, one solid, two more from the rest
    // 4 different SOLID types (outlines removed: strokePoly / strokeCircle stuttered on the watch)
    var types = [], rest = SOLID.slice()
    while (types.length < N) types.push(rest.splice(Math.floor(r() * rest.length), 1)[0])
    for (var q = types.length - 1; q > 0; q--) { var z = Math.floor(r() * (q + 1)), tt = types[q]; types[q] = types[z]; types[z] = tt }      // shuffle: any type at any radius
    var shapes = [], cost = 0, usedCol = []
    for (var i = 0; i < N; i++) {
      var type = types[i], base = type.replace('line', ''), u = (i + 0.3 + r() * 0.5) / N, rad = 25 + 275 * u
      var size = (50 + r() * 70) * (r() < 0.5 ? 0.5 + r() * 0.5 : 1 + r())
      if (type === 'rod') size *= 1.3
      var col = pick(cols); if (usedCol.indexOf(col) >= 0) col = pick(cols); usedCol.push(col)
      shapes.push({ type: type, base: base, outline: type !== base, r: rad, phi: W * (0.1 + r() * 0.8), s: size, rot: r() * Math.PI * 2, col: col, layer: i,
        pts: (base === 'dot' || base === 'ring' || base === 'rod') ? null : outlinePts(base, r), dspin: (r() - 0.5) * 4, da: (r() - 0.5) * 0.8 })
      cost += COST[type] * SEG
    }
    var ALPHA = shapes.map(function () { return 0.2 + r() * 0.6 }); ALPHA[Math.floor(r() * N)] = 0.8        // each 20-80%, one at 80%
    var POLY = shapes.map(function (sh) { var a = []; if (sh.pts) for (var j = 0; j <= sh.pts.length; j++) a.push({ x: 0, y: 0 }); return { data_array: a, color: sh.col } })
    return { ALPHA: ALPHA, seed: seed, P: P, R: { name: 'Random mix: ' + types.join(' + '), note: R.note, types: types }, pi: pi, ri: 0, arms: arms, SEG: SEG, W: W, bg: bg, shapes: shapes, cost: cost, draws: 4 * SEG,
      C: { center_x: 0, center_y: 0, radius: 1, color: 0 }, L: { x1: 0, y1: 0, x2: 0, y2: 0, color: 0 }, PAINT: { color: 0, line_width: 1 }, POLY: POLY, cx: opt.cx, cy: opt.cy }
  }
  // D: the 3 layer canvases. M: {spin, flow} from the wake motion.
  function frame(V, M, D) {
    var TRAVEL = 280, i, k, j
    for (i = 0; i < V.shapes.length; i++) {
      var sh = V.shapes[i], d = D[sh.layer], rr = sh.r + M.flow * TRAVEL * (0.6 + 0.4 * sh.r / 300), phi = sh.phi + M.flow * sh.da, rot = sh.rot + M.flow * sh.dspin, s = sh.s
      for (k = 0; k < V.SEG; k++) {
        var odd = k % 2 === 1, a = M.spin + (odd ? (k + 1) * V.W - phi : k * V.W + phi) - Math.PI / 2
        var x = V.cx + rr * Math.cos(a), y = V.cy + rr * Math.sin(a), o = a + (odd ? -rot : rot), m = odd ? -1 : 1
        if (x < -90 || y < -90 || x > 480 || y > 540) continue
        if (sh.base === 'dot' || sh.base === 'ring') {
          var C = V.C; C.center_x = Math.round(x); C.center_y = Math.round(y); C.radius = Math.round(s * 0.5); C.color = sh.col
          if (sh.base === 'ring') { V.PAINT.color = sh.col; V.PAINT.line_width = Math.max(3, Math.round(s * 0.1)); d.setPaint(V.PAINT); d.strokeCircle(C) } else d.drawCircle(C)
        } else if (sh.base === 'rod') {          // thin needle
          var hx2 = Math.cos(o) * s * 0.6, hy2 = Math.sin(o) * s * 0.6, L = V.L
          L.x1 = Math.round(x - hx2); L.y1 = Math.round(y - hy2); L.x2 = Math.round(x + hx2); L.y2 = Math.round(y + hy2); L.color = sh.col
          V.PAINT.color = sh.col; V.PAINT.line_width = Math.max(3, Math.round(s * 0.05)); d.setPaint(V.PAINT); d.drawLine(L)
        } else {                                   // polygon: the shape's own outline, mirrored in odd slices, turned to o
          var PP = V.POLY[i], pts = PP.data_array, n = sh.pts.length, co = Math.cos(o), so = Math.sin(o)
          for (j = 0; j <= n; j++) { var q = sh.pts[j % n], px = q[0] * s, py = q[1] * s * m; pts[j].x = Math.round(x + px * co - py * so); pts[j].y = Math.round(y + px * so + py * co) }
          if (sh.outline) { V.PAINT.color = sh.col; V.PAINT.line_width = Math.max(3, Math.round(s * 0.06)); d.setPaint(V.PAINT); d.strokePoly(PP) } else d.drawPoly(PP)
        }
      }
    }
  }
  return { contrast: contrast, make: make, frame: frame, COST: COST, MEASURED: MEASURED, PALS: PALS, RECIPES: RECIPES, SHADES: SHADES, mix: mix, hx: hx }
})()
