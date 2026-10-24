// Run the generated poker code with stubs and dump what the face draws per time step.
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
// use the picture arrays the generator actually emitted, so a recorded src is a file name
const F = {};
const arrays = {};
for (const m of src.matchAll(/const (variants_\d+) = \[([\s\S]*?)\]/g)) {
  arrays[m[1]] = [...m[2].matchAll(/A\('([^']+)'\)/g)].map((x) => x[1]);
}
for (const m of src.matchAll(/F\.(\w+) = (variants_\d+)/g)) F[m[1]] = arrays[m[2]];
global.F = F;
if (!F.c0) throw new Error('could not read the picture lists');

block = block.replace('const safe = () => { try { tick(); } catch (e) {} };', 'const safe = () => { tick(); };');
new Function(block)();

const out = [];
for (let t = START; t < START + 40000; t += 60) {
  now.t = t;
  for (const k of ['c0', 'c1', 'c2', 'c3', 'c4', 'lbl', 'w1', 'w2', 'w3', 'w4',
    'cr1', 'cr2', 'cr3', 'cr4', 'mini1', 'mini2', 'betv', 'h0', 'h1', 'h2', 'h3', 'h4']) rec[k] = null;
  cb();
  out.push({
    t, cards: [rec.c0.src, rec.c1.src, rec.c2.src, rec.c3.src, rec.c4.src],
    lbl: rec.lbl.src, win: [rec.w1.src, rec.w2.src, rec.w3.src, rec.w4.src],
    credit: [rec.cr1.src, rec.cr2.src, rec.cr3.src, rec.cr4.src],
    mini: [rec.mini1.src, rec.mini2.src], bet: rec.betv.src,
    hold: [rec.h0.y, rec.h1.y, rec.h2.y, rec.h3.y, rec.h4.y],
  });
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 0));
console.log('steps', out.length, '→', OUT);
