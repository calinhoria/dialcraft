// Run the generated skate code with stubs and dump the sprite position/picture per step.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const OUT = process.argv[3] || './build/sim.json';
const START = Number(process.argv[4] || 0);
const a = src.indexOf('const pxv =');
const b = src.indexOf('  build() {');
let block = src.slice(a, b).trim();
block = block.slice(0, block.lastIndexOf('}')).trim();

const now = { t: START };
Date.now = () => now.t;
global.px = (n) => n;
global.pxv = (n) => n;
global.ui = { prop: { MORE: 'MORE' }, widget: { WIDGET_DELEGATE: 1 }, createWidget: () => ({}) };
let cb = null;
global.setInterval = (fn) => { cb = fn; return 1; };
global.clearInterval = () => { cb = null; };
const rec = {};
const mk = (n) => ({ setProperty: (p, v) => { rec[n] = v; } });
global.W = new Proxy({}, { get: (o, k) => (o[k] || (o[k] = mk(k))) });
const arrays = {};
for (const m of src.matchAll(/const (variants_\d+) = \[([\s\S]*?)\]/g)) {
  arrays[m[1]] = [...m[2].matchAll(/A\('([^']+)'\)/g)].map((x) => x[1]);
}
const F = {};
for (const m of src.matchAll(/F\.(\w+) = (variants_\d+)/g)) F[m[1]] = arrays[m[2]];
global.F = F;

block = block.replace('const safe = () => { try { tick(); } catch (e) {} };', 'const safe = () => { tick(); };');
new Function(block)();

const out = [];
for (let t = START; t < START + 12000; t += 55) {
  now.t = t;
  rec.sk = null;
  cb();
  out.push({ t, x: rec.sk.x, y: rec.sk.y, pic: rec.sk.src });
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 0));
console.log('steps', out.length, '→', OUT);
