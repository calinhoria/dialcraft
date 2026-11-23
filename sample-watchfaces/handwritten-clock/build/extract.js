// node build/extract.js <hersheytext.json>: pull the digits 0-9 of the Hershey "Script 1-stroke" font out of the hersheytext package
// (curl -L https://unpkg.com/hersheytext/hersheytext.json). Output: build/digits.json  { "0": [[x, y, x, y, ...], ...strokes], ... } in font units.
const fs = require('fs')
const src = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).scripts
const out = {}
for (const ch of '0123456789') {
  const c = src.chars[ch.charCodeAt(0) - 33]
  out[ch] = (c.d.match(/M[^M]*/g) || []).map((part) => (part.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)).filter((s) => s.length >= 4)
}
fs.writeFileSync(__dirname + '/digits.json', JSON.stringify(out))
console.log(Object.entries(out).map(([k, v]) => k + ':' + v.length + ' strokes ' + v.reduce((a, s) => a + s.length / 2, 0) + ' pts').join('  '))
