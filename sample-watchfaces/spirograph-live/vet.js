// node vet.js: build the engine for many seeds and check the numbers (no NaN, on screen, segment counts)
const fs = require('fs')
const src = fs.readFileSync(__dirname + '/spiro.js', 'utf8')
const SP = new Function(src + '; return SP')()
let bad = 0, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, minP = 1e9, maxP = 0, segMax = 0, total = 0
for (let s = 1; s <= 3000; s++) {
  const V = SP.make(s * 7919)
  for (const c of V.curves) {
    if (c.P < 360 || c.P > 900) bad++
    minP = Math.min(minP, c.P); maxP = Math.max(maxP, c.P); total += c.P
    let prev = null
    for (let i = 0; i <= c.P; i++) {
      const [x, y] = c.pt(i)
      if (!isFinite(x) || !isFinite(y)) { bad++; continue }
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      if (prev) segMax = Math.max(segMax, Math.hypot(x - prev[0], y - prev[1]))
      prev = [x, y]
    }
    const a = c.pt(0), b = c.pt(c.P); if (Math.abs(a[0] - b[0]) > 1 || Math.abs(a[1] - b[1]) > 1) bad++      // the curve closes
  }
}
console.log({ bad, x: [minX, maxX], y: [minY, maxY], segments: [minP, maxP], avg: Math.round(total / 9000), longestSegmentPx: Math.round(segMax) })
