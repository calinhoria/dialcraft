const fs = require('fs');
const pre = `
const W = dev().w, H = dev().h;
let seed = 13; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hash = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
const HOR = 150, SEA_H = 150, SHORE_Y = 268, SHORE_H = 106, WL = 340;   // horizon, sea layer height, shore layer top / height, mean waterline
`;
const sceneJS = pre + `
const c = mk(W, H), g = c.getContext('2d');
// sky: soft blue above, peach haze at the horizon
let gr = g.createLinearGradient(0, 0, 0, HOR); gr.addColorStop(0, '#6aa9d6'); gr.addColorStop(0.55, '#a9cfe6'); gr.addColorStop(0.88, '#f1dcc8'); gr.addColorStop(1, '#f6d3b0'); g.fillStyle = gr; g.fillRect(0, 0, W, HOR);
// sun just above the horizon, with a wide glow
gr = g.createRadialGradient(272, HOR - 4, 2, 272, HOR - 4, 150); gr.addColorStop(0, 'rgba(255,244,214,0.95)'); gr.addColorStop(0.12, 'rgba(255,225,170,0.6)'); gr.addColorStop(0.4, 'rgba(255,205,150,0.16)'); gr.addColorStop(1, 'rgba(255,200,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, HOR);
g.beginPath(); g.arc(272, HOR - 2, 13, 0, 7); g.fillStyle = '#fffaf0'; g.fill();
// soft stretched clouds
g.save(); g.filter = 'blur(7px)';
for (const [x, y, w, a] of [[70, 62, 130, 0.5], [250, 40, 160, 0.4], [330, 96, 120, 0.45], [120, 108, 110, 0.35], [40, 20, 90, 0.35]]) { g.fillStyle = 'rgba(255,248,240,' + a + ')'; g.beginPath(); g.ellipse(x, y, w, 7 + rnd() * 5, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,214,190,' + a * 0.6 + ')'; g.beginPath(); g.ellipse(x + 20, y + 7, w * 0.8, 5, 0, 0, 7); g.fill(); }
g.restore();
// sand under the sea and shore layers: wet near the water, dry below, with a lacy run-up edge
const sand = (y0) => { gr = g.createLinearGradient(0, y0, 0, H); gr.addColorStop(0, '#9d8059'); gr.addColorStop(0.35, '#b99b6e'); gr.addColorStop(0.55, '#d8c093'); gr.addColorStop(1, '#ead9ae'); g.fillStyle = gr; g.fillRect(0, y0, W, H - y0); };
sand(HOR);
const edge = (x) => 366 + 5 * Math.sin(x * 0.045) + 3 * Math.sin(x * 0.13 + 1) + 2 * Math.sin(x * 0.31);
g.beginPath(); g.moveTo(0, edge(0)); for (let x = 0; x <= W; x += 3) g.lineTo(x, edge(x)); g.lineTo(W, H); g.lineTo(0, H); g.closePath();
gr = g.createLinearGradient(0, 360, 0, H); gr.addColorStop(0, '#d9c498'); gr.addColorStop(0.2, '#e4d1a4'); gr.addColorStop(1, '#efdeb4'); g.fillStyle = gr; g.fill();
// wet sheen and the dark line where the water reached
g.beginPath(); for (let x = 0; x <= W; x += 3) { x ? g.lineTo(x, edge(x)) : g.moveTo(x, edge(x)); } g.strokeStyle = 'rgba(110,86,52,0.45)'; g.lineWidth = 2; g.stroke();
g.beginPath(); for (let x = 0; x <= W; x += 3) { x ? g.lineTo(x, edge(x) - 3) : g.moveTo(x, edge(x) - 3); } g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.2; g.stroke();
// sand ripples and grain
for (let i = 0; i < 18; i++) { const y = 378 + i * 4.3 + rnd() * 2, a = 0.05 + rnd() * 0.05; g.strokeStyle = 'rgba(120,95,55,' + a + ')'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.25, y + 3 * Math.sin(i), W * 0.7, y - 3, W, y + 2); g.stroke(); g.strokeStyle = 'rgba(255,250,230,' + a * 1.2 + ')'; g.beginPath(); g.moveTo(0, y + 2); g.bezierCurveTo(W * 0.25, y + 3 * Math.sin(i) + 2, W * 0.7, y - 1, W, y + 4); g.stroke(); }
for (let i = 0; i < 9000; i++) { const y = HOR + 150 + rnd() * (H - HOR - 150); g.fillStyle = 'rgba(' + (rnd() > 0.5 ? '255,248,225' : '110,85,50') + ',' + (0.06 + rnd() * 0.12) + ')'; g.fillRect(rnd() * W, y, 1, 1); }
for (let i = 0; i < 3000; i++) { g.fillStyle = 'rgba(' + (rnd() > 0.5 ? '230,210,170' : '90,70,40') + ',0.1)'; g.fillRect(rnd() * W, 300 + rnd() * 66, 1, 1); }
// shells and pebbles
const shell = (x, y, s, rot) => { g.save(); g.translate(x, y); g.rotate(rot); g.shadowColor = 'rgba(70,50,25,0.45)'; g.shadowBlur = 3; g.shadowOffsetY = 2; g.beginPath(); g.moveTo(0, s * 0.9); g.bezierCurveTo(-s * 1.2, s * 0.4, -s * 1.1, -s * 0.8, 0, -s); g.bezierCurveTo(s * 1.1, -s * 0.8, s * 1.2, s * 0.4, 0, s * 0.9); const q = g.createRadialGradient(-s * 0.3, -s * 0.4, 1, 0, 0, s * 1.3); q.addColorStop(0, '#fff3ea'); q.addColorStop(1, '#e8b7a0'); g.fillStyle = q; g.fill(); g.shadowColor = 'transparent'; g.strokeStyle = 'rgba(160,100,80,0.55)'; g.lineWidth = 0.8; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(0, s * 0.85); g.quadraticCurveTo(i * s * 0.28, 0, i * s * 0.34, -s * 0.85); g.stroke(); } g.restore(); };
shell(52, 418, 9, -0.5); shell(338, 432, 7, 0.6); shell(300, 392, 5, 0.2);
for (const [x, y, r] of [[96, 438, 3.2], [104, 441, 2.2], [350, 404, 3], [28, 396, 2.4], [250, 440, 2.6]]) { g.save(); g.shadowColor = 'rgba(60,45,25,0.5)'; g.shadowBlur = 2; g.shadowOffsetY = 1.5; g.beginPath(); g.ellipse(x, y, r * 1.3, r, 0.3, 0, 7); const q = g.createRadialGradient(x - 1, y - 1, 0.5, x, y, r * 1.4); q.addColorStop(0, '#b9b2a6'); q.addColorStop(1, '#6f695f'); g.fillStyle = q; g.fill(); g.restore(); }
names.push(addProjectImage('scene.png', c, {}).name);
`;
const seaJS = pre + `
const N = 12, SUNX = 272;
const deep0 = hex('#e4cfc0'), deep1 = hex('#2c86ac'), deep2 = hex('#2a9fb1'), shallow = hex('#63cabd'), haze = hex('#f3d9c4');
for (let k = 0; k < N; k++) {
  const ph = 2 * Math.PI * k / N, c = mk(W, SEA_H), g = c.getContext('2d'), id = g.createImageData(W, SEA_H), d = id.data;
  const hf = (x, t) => { const v = 1 / (0.22 + t), a = 0.04 + 0.96 * Math.pow(t, 1.1); return a * (0.55 * Math.sin(v * 2.6 + ph + x * 0.004) + 0.3 * Math.sin(v * 4.4 + 2 * ph + x * 0.011) + 0.22 * Math.sin(x * 0.05 + v * 7 + 3 * ph)); };
  for (let y = 0; y < SEA_H; y++) {
    const t = y / (SEA_H - 1);
    let base = t < 0.12 ? mix(deep0, deep1, t / 0.12) : t < 0.55 ? mix(deep1, deep2, (t - 0.12) / 0.43) : mix(deep2, shallow, (t - 0.55) / 0.45);
    const refl = Math.pow(1 - t, 2.4) * 0.55;
    for (let x = 0; x < W; x++) {
      const h0 = hf(x, t), hy = hf(x, t + 1 / (SEA_H - 1)), hx = hf(x + 1, t);
      const dy = clamp((hy - h0) * 70, -1.4, 1.4), dx = clamp((hx - h0) * 70, -1.4, 1.4);
      let col = mix(base, haze, refl);
      const lit = clamp(-dy * 0.22 + dx * 0.05, -0.5, 0.5);
      col = col.map((v) => v * (1 + lit * 0.6));
      col = mix(col, [255, 255, 255], clamp(h0 * 0.1, 0, 0.12) * (0.4 + t));
      // sun glitter on the reflection path
      const gx = (x - SUNX) / (18 + 90 * t), gl = Math.exp(-gx * gx * 0.5), n = hash(x, y), sp = gl * clamp((h0 * 0.5 + 0.5 - 0.55) * 3.2, 0, 1) * clamp(n * 1.6 - 0.25, 0, 1) * (0.5 + 0.6 * t);
      col = mix(col, [255, 240, 205], clamp(sp * 0.9 + gl * 0.12 * (1 - t), 0, 0.95));
      const i = (y * W + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
  }
  g.putImageData(id, 0, 0);
  names.push(addProjectImage('anim/sea_' + k + '.png', c, {}).name);
}
`;
const shoreJS = pre + `
const N = 20, LH = SHORE_H;
const sh0 = hex('#63cabd'), sh1 = hex('#9fe3d2'), sh2 = hex('#cdf2e6');
const nz = (x) => 0.5 + 0.5 * Math.sin(x * 0.21 + 1.3) * Math.sin(x * 0.067) + 0.25 * Math.sin(x * 0.53);
for (let k = 0; k < N; k++) {
  const ph = 2 * Math.PI * k / N, c = mk(W, LH), g = c.getContext('2d'), id = g.createImageData(W, LH), d = id.data;
  for (let x = 0; x < W; x++) {
    const L = (WL - SHORE_Y) + 19 * Math.sin(ph) + 4 * Math.sin(x * 0.035 + ph) + 3 * Math.sin(x * 0.09 - 2 * ph) + 2.5 * Math.sin(x * 0.2 + 3 * ph);
    const fw = 3 + 4 * clamp(nz(x), 0, 1);
    for (let y = 0; y < LH; y++) {
      const i = (y * W + x) * 4, dist = L - y;
      let r = 0, gg = 0, b = 0, a = 0;
      if (dist >= 0) {
        // translucent shallow water, clearer toward the front so the sand shows through
        const e = 1 - Math.exp(-dist / 16), top = clamp(y / 26, 0, 1);
        a = clamp((0.5 + 0.5 * e) * top + (1 - top) * 0, 0, 1) * (y < 26 ? 1 : 1);
        a = clamp(0.46 + 0.54 * e, 0, 1) * top;
        const ca = 0.5 + 0.5 * Math.sin(x * 0.11 + y * 0.17 + ph * 2) * Math.sin(x * 0.043 - y * 0.09 + ph);
        let col = mix(sh1, sh0, clamp(e * 1.1, 0, 1)); col = col.map((v) => v * (0.94 + 0.08 * ca));
        // lacy foam at the front and a second, broken line behind it
        const f1 = clamp(1 - dist / fw, 0, 1), f2 = clamp(1 - Math.abs(dist - (11 + 3 * nz(x + 40))) / 2.4, 0, 1) * clamp(hash(x >> 1, 7) * 2.2 - 0.45, 0, 1) * 0.65;
        const foam = clamp(f1 + f2, 0, 1);
        col = mix(col, [255, 255, 255], foam * 0.95);
        a = clamp(a + foam * (1 - a), 0, 1);
        r = col[0]; gg = col[1]; b = col[2];
      } else if (dist > -7) {
        // wet shadow just in front of the water
        const s = 1 + dist / 7; r = 96; gg = 74; b = 44; a = 0.28 * s * s;
        if (dist > -1.6) { r = 255; gg = 255; b = 255; a = 0.35 * (1 + dist / 1.6); }
      }
      d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = a * 255;
    }
  }
  g.putImageData(id, 0, 0);
  names.push(addProjectImage('anim/shore_' + k + '.png', c, {}).name);
}
`;
const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const F = 'Montserrat', FT = 'Montserrat';
const steps = [{ preset: 'bg' },
  wrap(sceneJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Scene'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  { preset: 'clock' }, { preset: 'weekday' }, { preset: 'day' }, { preset: 'battery' }, { preset: 'steps' }, { preset: 'clock' },
  { script: `const n = project.elements.length; ['Hour','Colon','Minute'].forEach((nm,i)=>{ project.elements[n-3+i].name = nm + ' Aod'; }); return 1` },
  { remove: 'Colon Aod' },
  wrap(seaJS, `const e = await addElement('IMG_ANIM', { frames: names, fps: 6, animPrefix: 'sea', repeat: 0 }); e.name = 'Sea'; e.frames = names; e.x = 0; e.y = 150; e.show = 'normal'; return names.length`),
  wrap(shoreJS, `const e = await addElement('IMG_ANIM', { frames: names, fps: 5, animPrefix: 'shore', repeat: 0 }); e.name = 'Shore wash'; e.frames = names; e.x = 0; e.y = 268; e.show = 'normal'; return names.length`),
];
const soft = (size, color, extra) => ({ font: F, size, weight: 300, fill: 'solid', color, shadowColor: '#1a3a52', shadowX: 0, shadowY: 2, shadowBlur: 8, ...extra });
const sand = (size, color) => ({ font: F, size, weight: 600, fill: 'solid', color, borderColor: '#f4e6c2', borderWidth: 1, shadowColor: '#f4e6c2', shadowX: 0, shadowY: 1, shadowBlur: 0 });
steps.push(
  { edit: 'Hour', set: { x: 44, y: 24, zero: 1 }, glyph: { ...soft(96, '#ffffff'), font: FT } },
  { edit: 'Colon', set: { x: 176, y: 36 }, glyph: { ...soft(96, '#ffffff'), font: FT } },
  { edit: 'Minute', set: { x: 206, y: 24, zero: 1 }, glyph: { ...soft(96, '#ffffff'), font: FT } },
  { edit: 'Weekday', set: { x: 70, y: 112 }, glyph: soft(22, '#ffffff', { weight: 500 }) },
  { edit: 'Day', set: { x: 150, y: 112 }, glyph: soft(22, '#ffffff', { weight: 500 }) },
  { edit: 'Battery', set: { x: 205, y: 112 }, glyph: soft(22, '#ffffff', { weight: 500 }) },
  { edit: 'Steps', set: { x: 120, y: 396, alignH: 'CENTER_H', w: 150 }, glyph: sand(40, '#6a4f2e') },
  { edit: 'Hour Aod', set: { x: 70, y: 120, show: 'aod', zero: 1 }, glyph: { font: F, size: 110, weight: 300, fill: 'solid', color: '#7f8a90' } },
  { edit: 'Minute Aod', set: { x: 70, y: 260, show: 'aod', zero: 1 }, glyph: { font: F, size: 110, weight: 300, fill: 'solid', color: '#7f8a90' } },
);
fs.writeFileSync('recipe.json', JSON.stringify({ name: 'Calm Beach', device: 'bip-6', font: F, description: 'Gentle waves rolling onto a sandy beach at sunrise: shimmering sea, a foamy wash that comes and goes, wet sand, shells.', preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/calm-beach', steps }, null, 1));
