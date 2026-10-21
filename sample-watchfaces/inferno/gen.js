const fs = require('fs');
const pre = `
const W = dev().w, H = dev().h;
let seed = 23; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
`;
const sceneJS = pre + `
const c = mk(W, H), g = c.getContext('2d');
let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#040102'); gr.addColorStop(0.45, '#0d0403'); gr.addColorStop(0.8, '#2a0a04'); gr.addColorStop(1, '#4a1405');
g.fillStyle = gr; g.fillRect(0, 0, W, H);
// soot mottling
for (let i = 0; i < 70; i++) { const x = rnd() * W, y = rnd() * H * 0.8, r = 20 + rnd() * 60; const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, 'rgba(0,0,0,' + (0.15 + rnd() * 0.2) + ')'); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2); }
names.push(addProjectImage('scene.png', c, {}).name);
`;
const glowJS = pre + `
const N = 8, GH = 330;
for (let k = 0; k < N; k++) {
  const ph = 2 * Math.PI * k / N, a = 0.34 + 0.09 * Math.sin(ph * 2 + 0.4) + 0.06 * Math.sin(ph * 3 + 1.7) + 0.04 * Math.sin(ph + 2.5);
  const c = mk(W, GH), g = c.getContext('2d'), gr = g.createRadialGradient(195, GH - 10, 10, 195, GH - 10, 300);
  gr.addColorStop(0, 'rgba(255,120,30,' + a + ')'); gr.addColorStop(0.4, 'rgba(230,70,15,' + a * 0.55 + ')'); gr.addColorStop(1, 'rgba(160,30,5,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, GH); names.push(addProjectImage('anim/glow_' + k + '.png', c, {}).name);
}
`;
const smokeJS = pre + `
const SW = W, SH = 300, N = 16, BASEY = 270;
// each puff: x, phase offset, size, drift, shade
const P = Array.from({ length: 13 }, (_, i) => ({ x: 40 + rnd() * 310, off: (i / 13 + rnd() * 0.05) % 1, r: 26 + rnd() * 26, amp: 14 + rnd() * 26, ph: rnd() * 6.28, sh: rnd() }));
for (let k = 0; k < N; k++) {
  const c = mk(SW, SH), g = c.getContext('2d');
  for (const p of P) {
    const f = ((k / N + p.off) % 1 + 1) % 1;
    const y = BASEY - f * (BASEY + 30), x = p.x + p.amp * Math.sin(2 * Math.PI * f + p.ph) * (0.3 + f) + 24 * f;
    const r = p.r * (0.55 + f * 1.5);
    const a = clamp(Math.min(f / 0.12, 1) * Math.pow(1 - f, 1.3), 0, 1) * 0.8;
    // lit orange from below near the flames, cooling to grey-brown higher up
    const warm = Math.max(0, 1 - f * 2.4), col = mix([120, 110, 106], [190, 80, 30], warm), cl = mix(col, [30, 26, 26], 0.5);
    for (let b = 0; b < 4; b++) {
      const bx = x + Math.sin(p.ph * (b + 1) + f * 6.28 * (1 + (b % 2))) * r * 0.45, by = y + Math.cos(p.ph * (b + 2)) * r * 0.35, br = r * (0.6 + 0.12 * b);
      const q = g.createRadialGradient(bx - br * 0.2, by - br * 0.25, 0, bx, by, br);
      q.addColorStop(0, 'rgba(' + col.map(Math.round) + ',' + a * 0.8 + ')'); q.addColorStop(0.6, 'rgba(' + cl.map(Math.round) + ',' + a * 0.5 + ')'); q.addColorStop(1, 'rgba(' + cl.map(Math.round) + ',0)');
      g.fillStyle = q; g.fillRect(bx - br, by - br, br * 2, br * 2);
    }
  }
  names.push(addProjectImage('anim/smoke_' + k + '.png', c, {}).name);
}
`;
const flameJS = pre + `
const FW = W, FH = 250, BASE = 236, HM = 215, N = 16;
const T = [];
for (let i = 0; i < 9; i++) { const c = -0.92 + i * 0.23 + (rnd() - 0.5) * 0.08, mid = 1 - Math.abs(c) * 0.55; T.push({ c, w: 0.075 + rnd() * 0.04, h: mid * (0.6 + rnd() * 0.6), m: 1 + Math.floor(rnd() * 3), p: rnd() * 6.28 }); }
T.push({ c: -0.15, w: 0.2, h: 0.5, m: 2, p: 4 }, { c: 0.25, w: 0.2, h: 0.46, m: 1, p: 1 });
const stops = [[0, [58, 6, 0]], [0.1, [170, 24, 3]], [0.26, [250, 78, 10]], [0.5, [255, 150, 26]], [0.75, [255, 208, 70]], [1, [255, 246, 205]]];
const cmap = (t) => { for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])); return stops[stops.length - 1][1]; };
for (let k = 0; k < N; k++) {
  const ph = 2 * Math.PI * k / N, tmp = mk(FW, FH), tg = tmp.getContext('2d'), id = tg.createImageData(FW, FH), d = id.data;
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const u = (x - FW / 2) / (FW / 2 * 0.98), v = (BASE - y) / HM;
    const ux = u + 0.1 * Math.sin(v * 6 + ph * 2 + u * 3) * v + 0.05 * Math.sin(v * 13 - ph * 3 + u * 5) * v;
    let hh = 0; for (const t of T) hh += t.h * (0.7 + 0.3 * Math.sin(ph * t.m + t.p)) * Math.exp(-Math.pow((ux - t.c) / t.w, 2));
    hh = Math.min(hh, 1.25) * (1 - 0.25 * u * u);
    let dd = hh > 0.02 ? 1 - v / hh : 0; if (v < 0) dd *= clamp(1 + v / 0.08, 0, 1);
    if (dd <= 0) continue;
    let tt = Math.pow(dd, 0.65) * (0.86 + 0.14 * Math.sin(v * 18 + ph * 3 + ux * 9));
    tt = clamp(tt, 0, 1); const col = cmap(tt), a = clamp(tt * 3.2, 0, 1), i = (y * FW + x) * 4;
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = a * 255;
  }
  tg.putImageData(id, 0, 0);
  const c = mk(FW, FH), g = c.getContext('2d');
  g.filter = 'blur(9px)'; g.globalAlpha = 0.7; g.drawImage(tmp, 0, 0); g.filter = 'none'; g.globalAlpha = 1; g.drawImage(tmp, 0, 0);
  names.push(addProjectImage('anim/flame_' + k + '.png', c, {}).name);
}
`;
const sparkJS = pre + `
const SW = W, SH = 330, N = 16, BASEY = 320;
const S = Array.from({ length: 26 }, () => ({ x: 30 + rnd() * 330, off: rnd(), m: rnd() > 0.55 ? 2 : 1, travel: 120 + rnd() * 190, amp: 8 + rnd() * 22, r: 0.8 + rnd() * 1.6, ph: rnd() * 6 }));
for (let k = 0; k < N; k++) {
  const c = mk(SW, SH), g = c.getContext('2d');
  for (const s of S) {
    const f = (((k * s.m / N) + s.off) % 1 + 1) % 1, y = BASEY - f * s.travel, x = s.x + s.amp * Math.sin(2 * Math.PI * f * s.m + s.ph) * f + 18 * f, a = (1 - f) * (f < 0.05 ? f / 0.05 : 1) * (0.75 + 0.25 * Math.sin(k * 2.3 + s.ph));
    const q = g.createRadialGradient(x, y, 0, x, y, s.r * 4); q.addColorStop(0, 'rgba(255,240,170,' + a + ')'); q.addColorStop(0.3, 'rgba(255,160,40,' + a * 0.8 + ')'); q.addColorStop(1, 'rgba(255,80,10,0)'); g.fillStyle = q; g.beginPath(); g.arc(x, y, s.r * 4, 0, 7); g.fill();
  }
  names.push(addProjectImage('anim/spark_' + k + '.png', c, {}).name);
}
`;
const frontJS = pre + `
const FH = 66, c = mk(W, FH), g = c.getContext('2d');
// coal bed: dark lumps with glowing seams, lumpy upper edge
const lumps = [];
for (let i = 0; i < 70; i++) lumps.push({ x: rnd() * W, y: 18 + rnd() * 46, rx: 14 + rnd() * 22, ry: 8 + rnd() * 12 });
lumps.sort((a, b) => a.y - b.y);
for (const l of lumps) {
  g.save(); g.translate(l.x, l.y); g.rotate((rnd() - 0.5) * 0.6);
  const q = g.createRadialGradient(-l.rx * 0.2, -l.ry * 0.4, 1, 0, 0, l.rx); q.addColorStop(0, '#4a2a1c'); q.addColorStop(0.55, '#1c0e08'); q.addColorStop(1, '#060202');
  g.shadowColor = 'rgba(255,90,10,0.7)'; g.shadowBlur = 10; g.fillStyle = q; g.beginPath(); g.ellipse(0, 0, l.rx, l.ry, 0, 0, 7); g.fill(); g.shadowColor = 'transparent';
  g.strokeStyle = 'rgba(255,' + (90 + Math.floor(rnd() * 120)) + ',20,' + (0.5 + rnd() * 0.5) + ')'; g.lineWidth = 1.2;
  for (let s = 0; s < 3; s++) { g.beginPath(); let px = (rnd() - 0.5) * l.rx, py = (rnd() - 0.5) * l.ry; g.moveTo(px, py); for (let t = 0; t < 3; t++) { px += (rnd() - 0.5) * 12; py += (rnd() - 0.3) * 6; g.lineTo(px, py); } g.stroke(); }
  g.restore();
}
g.globalCompositeOperation = 'destination-out'; const fade = g.createLinearGradient(0, 0, 0, 22); fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = fade; g.fillRect(0, 0, W, 22);
names.push(addProjectImage('front.png', c, {}).name);
`;
const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const F = 'Bebas Neue';
const anim = (name, prefix, fps, y) => `const e = await addElement('IMG_ANIM', { frames: names, fps: ${fps}, animPrefix: '${prefix}', repeat: 0 }); e.name = '${name}'; e.frames = names; e.x = 0; e.y = ${y}; e.show = 'normal'; return names.length`;
const steps = [{ preset: 'bg' },
  wrap(sceneJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Scene'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  { preset: 'clock' }, { preset: 'weekday' }, { preset: 'day' }, { preset: 'battery' }, { preset: 'clock' },
  { script: `const n = project.elements.length; ['Hour','Colon','Minute'].forEach((nm,i)=>{ project.elements[n-3+i].name = nm + ' Aod'; }); return 1` },
  { remove: 'Colon Aod' },
  wrap(glowJS, anim('Firelight', 'glow', 8, 120)),
  wrap(smokeJS, anim('Smoke', 'smoke', 5, 0)),
  wrap(flameJS, anim('Flames', 'flame', 12, 190)),
  wrap(sparkJS, anim('Embers', 'spark', 10, 80)),
  wrap(frontJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Coals'; e.src = names[0]; e.x = 0; e.y = 384; e.show = 'normal'; return 1`),
];
const hot = (size, extra) => ({ font: F, size, weight: 400, fill: 'css', css: 'linear-gradient(180deg,#fff6c8 0%,#ffc23a 45%,#ff5a12 100%)', shadowColor: '#ff4a00', shadowX: 0, shadowY: 0, shadowBlur: 12, ...extra });
const ash = (size) => ({ font: F, size, weight: 400, fill: 'solid', color: '#ffd9a8', shadowColor: '#ff4a00', shadowX: 0, shadowY: 0, shadowBlur: 8 });
steps.push(
  { edit: 'Hour', set: { x: 24, y: 22, zero: 1 }, glyph: hot(118) },
  { edit: 'Colon', set: { x: 168, y: 30 }, glyph: hot(118) },
  { edit: 'Minute', set: { x: 202, y: 22, zero: 1 }, glyph: hot(118) },
  { edit: 'Weekday', set: { x: 96, y: 150 }, glyph: ash(28) },
  { edit: 'Day', set: { x: 168, y: 150 }, glyph: ash(28) },
  { edit: 'Battery', set: { x: 222, y: 150 }, glyph: ash(28) },
  { edit: 'Hour Aod', set: { x: 110, y: 110, show: 'aod', zero: 1 }, glyph: { font: F, size: 120, weight: 400, fill: 'solid', color: '#7a3a14' } },
  { edit: 'Minute Aod', set: { x: 110, y: 250, show: 'aod', zero: 1 }, glyph: { font: F, size: 120, weight: 400, fill: 'solid', color: '#7a3a14' } },
);
fs.writeFileSync('recipe.json', JSON.stringify({ name: 'Inferno', device: 'bip-6', font: F, optimizePng: 32,
  description: 'A roaring fire on a bed of glowing coals: animated flames, rising smoke lit from below, floating embers and a pulsing firelight, with the time in molten letters.',
  preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/inferno', steps }, null, 1));
