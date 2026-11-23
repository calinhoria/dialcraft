// SP: live spirographs (watch-portable: plain ES5 maths; the watch draws them with drawLine on 3 setAlpha canvases).
// A curve is a hypotrochoid: a wheel of r teeth rolls inside a ring of R teeth, the pen sits d from the wheel's centre:
//   x = (R-r) cos t + d cos((R-r)/r t),  y = (R-r) sin t - d sin((R-r)/r t),  closing after n = r / gcd(R, r) turns.
// All 3 curves of a pattern share the ring R (so they nest) but have their own wheel, pen distance, turn and colour.
var SP = (function () {
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6d2b79f5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
  function hsl(h, sat, l) { h = ((h % 360) + 360) % 360; var a = sat * Math.min(l, 1 - l), f = function (n) { var k = (n + h / 30) % 12, v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(v * 255) }; return (f(0) << 16) | (f(8) << 8) | f(4) }
  function gcd(a, b) { return b ? gcd(b, a % b) : a }
  // seed -> { P: palette name, ring: R, curves: [{ n, P (segments), color, w, pt(i) -> [x, y] }] }
  function make(seed, opt) {
    var r = rng(seed), pick = function (a) { return a[Math.floor(r() * a.length)] }
    var cx = (opt && opt.cx) || 195, cy = (opt && opt.cy) || 225, FIT = (opt && opt.fit) || 182
    var h0 = r() * 360                   // the rainbow starts at a random hue; the 3 curves are 120 deg apart
    var curves = [], ph = -Math.PI / 2, donut = r() < 0.5, L = 0
    // one curve: a hypotrochoid in gear units (ring Rg, wheel rg, pen d), turned by ph, scaled so its reach is `reach` px
    function curve(Rg, rg, d, reach, hue, P) {
      var tab = []; for (var q = 0; q < 48; q++) tab.push(hsl(hue + q * 7.5, 1, 0.68))      // one full turn of the colour wheel along the stroke
      var n = rg / gcd(Rg, rg), s = reach / ((Rg - rg) + d), k = (Rg - rg) / rg
      return { n: n, P: P, R: Rg, r: rg, d: Math.round(d * 10) / 10, color: tab[0], col: function (i) { return tab[Math.floor(48 * i / P) % 48] }, w: 2,
        pt: function (i) { var t = Math.PI * 2 * n * i / P, a = (Rg - rg) * Math.cos(t) + d * Math.cos(k * t), b = (Rg - rg) * Math.sin(t) - d * Math.sin(k * t)
          return [Math.round(cx + s * (a * Math.cos(ph) - b * Math.sin(ph))), Math.round(cy + s * (a * Math.sin(ph) + b * Math.cos(ph)))] } }
    }
    if (donut) {
      // DONUTS (like a spirograph sheet): three concentric dense rings with a hole, each with many lobes (L) and a few turns (n). The hole is
      // set by the pen distance: inner radius / outer radius = (Rg - rg - d) / (Rg - rg + d). Every ring is L-fold symmetric and mirror-symmetric.
      var outer = FIT, spec = [[20, 34, 0.55, 0.12], [14, 24, 0.5, 0.12], [9, 15, 0.2, 0.2]]
      for (var c = 0; c < 3; c++) {
        var lo = spec[c][0], hi = spec[c][1], Ld, nd, tries = 0
        // many turns (n about 30-45% of L, coprime with L) so the ring fills with a dense mesh
        do { Ld = lo + Math.floor(r() * (hi - lo + 1)); nd = Math.max(3, Math.round(Ld * (0.3 + r() * 0.15))); tries++ } while (tries < 200 && gcd(Ld, nd) !== 1)
        var h = spec[c][2] + r() * spec[c][3], gap = Ld - nd, d = gap * (1 - h) / (1 + h)
        curves.push(curve(Ld, nd, d, outer, h0 + c * 120, Math.max(420, Math.min(900, Ld * 20))))
        outer = outer * h - 6; if (c === 0) L = Ld
      }
    } else {
      // LOOPED ROSETTES: one lobe count L for the pattern (ring = L gear units, wheel = n units, n < L and coprime with L, so a curve has
      // exactly L lobes), mostly one turn, a different pen distance per curve (> 1 wheel: looped petals). All curves start at the same angle
      // on the +x axis (a mirror axis of every hypotrochoid) and the pattern is turned so a lobe points up: L-fold AND mirror symmetric.
      L = pick([5, 5, 6, 7, 7, 8])
      for (var c2 = 0; c2 < 3; c2++) {
        var n2 = (L % 2 && r() < 0.34) ? 2 : 1, rr = n2 * 16, Rg = L * 16
        var d2 = rr * (1.1 + (c2 + r() * 0.9) * 0.8)
        curves.push(curve(Rg, rr, d2, FIT * (c2 === 0 ? 1 : 0.84 + r() * 0.16), h0 + c2 * 120, 600))
      }
    }
    return { seed: seed, L: L, mode: donut ? 'donut' : 'loops', curves: curves, info: (donut ? 'donut' : 'loops') + ' L' + L + ' h' + Math.round(h0) + ' ' + curves.map(function (c) { return c.R + '/' + c.n }).join(' ') }
  }
  return { make: make }
})()
