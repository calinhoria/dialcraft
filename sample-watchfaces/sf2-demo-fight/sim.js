// Run the generated user code with stubs and dump what it does per time step.
const fs = require('fs');
const path = process.argv[2];
const OUT = process.argv[3] || './build/sim.json';
const src = fs.readFileSync(path, 'utf8');
const a = src.indexOf('const pxv =');
const b = src.indexOf('  build() {');
if (a < 0 || b < 0) throw new Error('cannot find the user block');
let block = src.slice(a, b).trim();
block = block.slice(0, block.lastIndexOf('}')).trim();

const now = { t: Number(process.argv[4] || 0) };
Date.now = () => now.t;
global.px = (n) => n;
global.pxv = (n) => n;
global.ui = {
  prop: { MORE: 'MORE', X: 'X', Y: 'Y', W: 'W', H: 'H', SRC: 'SRC' },
  widget: { WIDGET_DELEGATE: 'DELEGATE' },
  createWidget: () => ({}),
};
let cb = null;
global.setInterval = (fn) => { cb = fn; return 1; };
global.clearInterval = () => {};

const rec = {};
const mk = (name) => ({ setProperty: (p, v) => { rec[name] = v; } });
const W = new Proxy({}, { get: (o, k) => (o[k] || (o[k] = mk(k))) });
const F = {};
for (const who of ['ryu', 'ken']) F[who] = Array.from({ length: 80 }, (_, i) => i);
F.spark = [0, 1, 2];
F.orb = ['empty', 'orb_0', 'orb_1'];
F.fight = ['empty', 'fight'];
F.ko = ['empty', 'ko'];
F.tens = Array.from({ length: 10 }, (_, i) => i);
F.ones = Array.from({ length: 10 }, (_, i) => i);
F.round = ['empty', 1, 2, 3];
F.youwin = ['empty', 'youwin'];
F.koko = ['empty', 'ko'];
F.pip1 = F.pip2 = F.pip3 = F.pip4 = [0];
global.W = W; global.F = F;

block = block.replace('const safe = () => { try { tick(); } catch (e) {} };', 'const safe = () => { tick(); };');
new Function(block)();

const out = [];
for (let t = Number(process.argv[4] || 0); t < Number(process.argv[4] || 0) + 60000; t += 50) {
  now.t = t;
  rec.ryu = rec.ken = rec.spark = rec.orb = rec.fight = rec.ko = rec.tens = rec.ones = rec.round = rec.youwin = rec.koko = null;
  cb();
  out.push({
    t,
    ryu: rec.ryu && rec.ryu.src, ryuX: rec.ryu && rec.ryu.x,
    ken: rec.ken && rec.ken.src, kenX: rec.ken && rec.ken.x,
    spark: rec.spark && rec.spark.src, sparkXY: rec.spark && [rec.spark.x, rec.spark.y],
    orb: rec.orb && rec.orb.src, orbXY: rec.orb && [rec.orb.x, rec.orb.y],
    hpL: rec.hpL && rec.hpL.w, hpR: rec.hpR && rec.hpR.w,
    fight: rec.fight && rec.fight.src, ko: rec.ko && rec.ko.src,
    tens: rec.tens && rec.tens.src, ones: rec.ones && rec.ones.src, tensY: rec.tens && rec.tens.y, onesY: rec.ones && rec.ones.y, round: rec.round && rec.round.src, youwin: rec.youwin && rec.youwin.src, koko: rec.koko && rec.koko.src,
    pip1: rec.pip1 && rec.pip1.y, pip2: rec.pip2 && rec.pip2.y, pip3: rec.pip3 && rec.pip3.y, pip4: rec.pip4 && rec.pip4.y,
  });
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 0));
console.log('steps', out.length, '→', OUT);
