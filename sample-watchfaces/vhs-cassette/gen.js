const fs = require('fs');
const pre = `
const W = dev().w, H = dev().h;
let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
try { await document.fonts.load('34px "VT323"'); } catch (e) {}
`;
// cassette geometry (local): body 360x228, label y14-136, window x86-274 y78-130, hubs at (120,104) and (240,104)
const bgJS = pre + `
const c = mk(W, H), g = c.getContext('2d');
let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#12182a'); gr.addColorStop(1, '#05060b'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
gr = g.createRadialGradient(195, 200, 10, 195, 200, 300); gr.addColorStop(0, 'rgba(70,90,160,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
g.font = '34px "VT323", monospace'; g.textBaseline = 'alphabetic';
g.shadowColor = 'rgba(255,255,255,0.55)'; g.shadowBlur = 6; g.fillStyle = '#f2f2f2';
g.fillText('\\u25B6 PLAY', 16, 36); g.fillText('REC', 322, 36); g.fillText('SP', 16, 196);

names.push(addProjectImage('scene.png', c, {}).name);
`;
const cassetteJS = pre + `
const CW = 360, CH = 228, c = mk(CW, CH), g = c.getContext('2d');
const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
// body: smoked polycarbonate with a soft drop shadow
g.save(); g.shadowColor = 'rgba(0,0,0,0.75)'; g.shadowBlur = 14; g.shadowOffsetY = 6; rr(4, 2, CW - 8, CH - 10, 12);
let gr = g.createLinearGradient(0, 0, 0, CH); gr.addColorStop(0, '#5a5e65'); gr.addColorStop(0.5, '#3a3d43'); gr.addColorStop(1, '#25272b'); g.fillStyle = gr; g.fill(); g.restore();
rr(4, 2, CW - 8, CH - 10, 12); g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.2; g.stroke();
g.save(); rr(4, 2, CW - 8, CH - 10, 12); g.clip();
gr = g.createLinearGradient(0, 0, CW, CH); gr.addColorStop(0, 'rgba(255,255,255,0.14)'); gr.addColorStop(0.35, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.04)'); gr.addColorStop(1, 'rgba(0,0,0,0.2)'); g.fillStyle = gr; g.fillRect(0, 0, CW, CH);
for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(255,255,255,' + (0.03 + rnd() * 0.06) + ')'; g.lineWidth = 0.5; const x = rnd() * CW, y = rnd() * CH; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8 + rnd() * 22, y + (rnd() - 0.5) * 6); g.stroke(); }
g.restore();
// paper label
g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 4; g.shadowOffsetY = 1; rr(24, 14, 312, 122, 5);
gr = g.createLinearGradient(0, 14, 0, 136); gr.addColorStop(0, '#f6eed6'); gr.addColorStop(1, '#e3d6b4'); g.fillStyle = gr; g.fill(); g.restore();
g.save(); rr(24, 14, 312, 122, 5); g.clip();
for (let i = 0; i < 700; i++) { g.fillStyle = 'rgba(' + (rnd() > 0.5 ? '120,95,50' : '255,255,255') + ',' + (0.03 + rnd() * 0.05) + ')'; g.fillRect(24 + rnd() * 312, 14 + rnd() * 122, 1, 1); }
gr = g.createLinearGradient(0, 14, 0, 44); gr.addColorStop(0, '#e24b2d'); gr.addColorStop(1, '#bf371d'); g.fillStyle = gr; g.fillRect(24, 14, 312, 27);
g.fillStyle = '#f6eed6'; g.fillRect(24, 41, 312, 2);
g.fillStyle = '#1f3f7a'; g.fillRect(24, 43, 312, 2.5);
g.font = 'bold 15px "Helvetica Neue", Arial, sans-serif'; g.fillStyle = '#fbf3df'; g.fillText('SIDE A', 36, 33); g.textAlign = 'right'; g.fillText('C-60  \\u2022  NORMAL BIAS', 324, 33); g.textAlign = 'left';
g.strokeStyle = 'rgba(40,60,110,0.35)'; g.lineWidth = 0.8; for (const y of [72]) { g.beginPath(); g.moveTo(36, y); g.lineTo(324, y); g.stroke(); }
g.font = 'italic 11px "Helvetica Neue", Arial, sans-serif'; g.fillStyle = 'rgba(25,40,90,0.7)'; g.fillText('daily steps mix', 36, 68);
g.restore();
// window with the two tape packs
const WX = 86, WY = 78, WW = 188, WH = 52;
rr(WX, WY, WW, WH, 8); g.fillStyle = '#0b0b0d'; g.fill();
g.save(); rr(WX, WY, WW, WH, 8); g.clip();
gr = g.createLinearGradient(0, WY, 0, WY + WH); gr.addColorStop(0, 'rgba(60,64,72,0.55)'); gr.addColorStop(1, 'rgba(20,22,26,0.2)'); g.fillStyle = gr; g.fillRect(WX, WY, WW, WH);
const pack = (cx, cy, R) => { const p = g.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.1, cx, cy, R); p.addColorStop(0, '#5a3b24'); p.addColorStop(0.6, '#3a2415'); p.addColorStop(1, '#1d110a'); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fillStyle = p; g.fill();
  for (let r = 14; r < R; r += 1.6) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.strokeStyle = 'rgba(' + (rnd() > 0.5 ? '120,80,50' : '10,5,2') + ',0.22)'; g.lineWidth = 0.6; g.stroke(); }
  g.beginPath(); g.arc(cx, cy, R, 0.3 * Math.PI, 1.1 * Math.PI); g.strokeStyle = 'rgba(255,225,190,0.35)'; g.lineWidth = 1.4; g.stroke(); };
pack(120, 104, 26); pack(240, 104, 18);
// tape between the packs
g.strokeStyle = '#3d2918'; g.lineWidth = 2; g.beginPath(); g.moveTo(120, 129.5); g.lineTo(240, 122); g.stroke();
// glass reflections
gr = g.createLinearGradient(WX, WY, WX + WW, WY + WH); gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.04)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.07)');
g.beginPath(); g.moveTo(WX, WY); g.lineTo(WX + 80, WY); g.lineTo(WX + 30, WY + WH); g.lineTo(WX, WY + WH); g.closePath(); g.fillStyle = gr; g.fill();
g.restore();
rr(WX, WY, WW, WH, 8); g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 2.4; g.stroke(); rr(WX - 1, WY - 1, WW + 2, WH + 2, 9); g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 0.8; g.stroke();
// bottom trapezoid
g.beginPath(); g.moveTo(60, 148); g.lineTo(300, 148); g.lineTo(282, 216); g.lineTo(78, 216); g.closePath();
gr = g.createLinearGradient(0, 148, 0, 216); gr.addColorStop(0, '#1a1b1e'); gr.addColorStop(1, '#2c2e32'); g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; g.stroke();
g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 3;
for (const x of [96, 264]) { g.beginPath(); g.arc(x, 188, 10, 0, 7); g.fillStyle = '#08090a'; g.fill(); g.beginPath(); g.arc(x, 188, 10, 0, 7); g.strokeStyle = 'rgba(190,195,205,0.6)'; g.lineWidth = 2; g.stroke(); g.beginPath(); g.arc(x, 188, 4.2, 0, 7); g.fillStyle = '#9ca1aa'; g.fill(); }
for (const [x, w] of [[146, 24], [190, 24]]) { rr(x, 178, w, 16, 2); g.fillStyle = '#07080a'; g.fill(); g.strokeStyle = 'rgba(200,205,215,0.35)'; g.lineWidth = 1; g.stroke(); }
g.restore();
for (const x of [74, 286]) { g.beginPath(); g.arc(x, 168, 2.6, 0, 7); g.fillStyle = '#050506'; g.fill(); }
g.strokeStyle = '#4a3220'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(98, 199); g.lineTo(262, 199); g.stroke(); g.strokeStyle = 'rgba(255,200,150,0.25)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(98, 198.2); g.lineTo(262, 198.2); g.stroke();
// screws
for (const [x, y] of [[16, 14], [344, 14], [16, 202], [344, 202], [180, 150]]) { const s = g.createRadialGradient(x - 1, y - 1, 0.5, x, y, 5.5); s.addColorStop(0, '#d8dadf'); s.addColorStop(1, '#6b6e75'); g.beginPath(); g.arc(x, y, 5.2, 0, 7); g.fillStyle = s; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 0.8; g.stroke();
  g.strokeStyle = '#2a2b2e'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 3.6, y - 1.6); g.lineTo(x + 3.6, y + 1.6); g.stroke(); }
names.push(addProjectImage('cassette.png', c, {}).name);
`;
const hubJS = pre + `
const S = 44, N = 6;
for (let k = 0; k < N; k++) {
  const c = mk(S, S), g = c.getContext('2d'); g.translate(S / 2, S / 2); g.rotate(-k * Math.PI / 18);
  g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 3; g.shadowOffsetY = 1;
  g.beginPath(); g.arc(0, 0, 15.5, 0, 7); const gr = g.createRadialGradient(-4, -5, 2, 0, 0, 16); gr.addColorStop(0, '#f1f2f4'); gr.addColorStop(0.7, '#c4c7cc'); gr.addColorStop(1, '#8c9097'); g.fillStyle = gr; g.fill(); g.shadowColor = 'transparent';
  g.beginPath(); g.arc(0, 0, 10.5, 0, 7); g.fillStyle = '#0a0a0c'; g.fill();
  for (let i = 0; i < 6; i++) { g.save(); g.rotate(i * Math.PI / 3); g.beginPath(); g.moveTo(-2.2, -10.4); g.lineTo(2.2, -10.4); g.lineTo(1.6, -5.2); g.lineTo(-1.6, -5.2); g.closePath(); g.fillStyle = '#e4e6ea'; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 0.6; g.stroke(); g.restore(); }
  g.beginPath(); g.arc(0, 0, 15.5, 0, 7); g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 0.9; g.stroke();
  names.push(addProjectImage('anim/hub_' + k + '.png', c, {}).name);
}
`;
const crtJS = pre + `
const c = mk(W, H), g = c.getContext('2d');
for (let y = 0; y < H; y += 3) { g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, y, W, 1); }
const gr = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
const gl = g.createLinearGradient(0, 0, W, H); gl.addColorStop(0, 'rgba(255,255,255,0.05)'); gl.addColorStop(0.4, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, H);
names.push(addProjectImage('crt.png', c, {}).name);
`;
const glitchJS = pre + `
const N = 24, GH = 60;
for (let k = 0; k < N; k++) {
  const c = mk(W, GH), g = c.getContext('2d');
  const on = k === 6 || k === 7 || k === 8 || k === 18;
  if (on) {
    const amp = k === 7 ? 1 : 0.6;
    // snow band
    for (let i = 0; i < 900 * amp; i++) { const y = rnd() * GH, x = rnd() * W, w = 2 + rnd() * 30; g.fillStyle = 'rgba(255,255,255,' + (0.12 + rnd() * 0.35) + ')'; g.fillRect(x, y, w, 1); }
    for (let i = 0; i < 7; i++) { const y = rnd() * GH, o = (rnd() - 0.5) * 40; g.fillStyle = 'rgba(255,40,60,0.22)'; g.fillRect(Math.max(0, o), y, W, 2); g.fillStyle = 'rgba(40,230,255,0.2)'; g.fillRect(Math.max(0, -o), y + 2, W, 2); }
    const tear = 18 + rnd() * 20; g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(0, tear, W, 1.5); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, tear + 1.5, W, 3);
    const fade = g.createLinearGradient(0, 0, 0, GH); fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(0.15, 'rgba(0,0,0,0)'); fade.addColorStop(0.85, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = fade; g.fillRect(0, 0, W, GH); g.globalCompositeOperation = 'source-over';
  }
  names.push(addProjectImage('anim/glitch_' + k + '.png', c, {}).name);
}
`;
const recJS = pre + `
for (const on of [true, false]) { const c = mk(26, 26), g = c.getContext('2d');
  if (on) { g.shadowColor = '#ff2020'; g.shadowBlur = 8; g.beginPath(); g.arc(13, 13, 8, 0, 7); const gr = g.createRadialGradient(11, 11, 1, 13, 13, 8); gr.addColorStop(0, '#ff8a80'); gr.addColorStop(0.5, '#ff2a1c'); gr.addColorStop(1, '#b00800'); g.fillStyle = gr; g.fill(); }
  names.push(addProjectImage('anim/rec_' + (on ? 'on' : 'off') + '.png', c, {}).name); }
`;

const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const F = 'VT323';
const tag = (suffix) => ({ script: `const n = project.elements.length; for (const i of [n-3,n-2,n-1]) project.elements[i].name += ' ${suffix}'; return 1` });
const steps = [{ preset: 'bg' },
  wrap(bgJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Scene'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  wrap(cassetteJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Cassette'; e.src = names[0]; e.x = 15; e.y = 207; e.show = 'normal'; return 1`),
  wrap(hubJS, `for (const [nm, x] of [['Hub L', 113], ['Hub R', 233]]) { const e = await addElement('IMG_ANIM', { frames: names, fps: 12, animPrefix: 'hub', repeat: 0 }); e.name = nm; e.frames = names; e.x = x; e.y = 287; e.show = 'normal'; } return names.length`),
  wrap(crtJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'CRT'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  wrap(glitchJS, `const e = await addElement('IMG_ANIM', { frames: names, fps: 12, animPrefix: 'glitch', repeat: 0 }); e.name = 'Glitch'; e.frames = names; e.x = 0; e.y = 380; e.show = 'normal'; return names.length`),
  wrap(recJS, `const e = await addElement('IMG_ANIM', { frames: names, fps: 2, animPrefix: 'rec', repeat: 0 }); e.name = 'REC dot'; e.frames = names; e.x = 292; e.y = 15; e.show = 'normal'; return names.length`),
  { preset: 'clock' }, tag('Cyan'), { preset: 'clock' }, tag('Red'), { preset: 'clock' }, tag('Main'), { preset: 'clock' }, tag('Aod'),
  { preset: 'weekday' }, { preset: 'day' }, { preset: 'steps' },
  { remove: 'Colon Aod' },
];
const g = (size, color, extra) => ({ font: F, size, fill: 'solid', color, ...extra });
const place = (sfx, dx, color, extra) => [
  { edit: 'Hour ' + sfx, set: { x: 58 + dx, y: 40 + (dx === 8 ? 8 : 0), show: 'normal', zero: 1 }, glyph: g(150, color, extra) },
  { edit: 'Colon ' + sfx, set: { x: 172 + dx, y: 52 + (dx === 8 ? 8 : 0), show: 'normal' }, glyph: g(150, color, extra) },
  { edit: 'Minute ' + sfx, set: { x: 204 + dx, y: 40 + (dx === 8 ? 8 : 0), show: 'normal', zero: 1 }, glyph: g(150, color, extra) }];
steps.push(...place('Cyan', -4, '#19e6ff', {}), ...place('Red', 4, '#ff2d3d', {}),
  ...place('Main', 8, '#f4f4f4', { shadowColor: '#ffffff', shadowX: 0, shadowY: 0, shadowBlur: 8 }),
  { edit: 'Hour Aod', set: { x: 60, y: 110, show: 'aod', zero: 1 }, glyph: g(150, '#6c6c6c') },
  { edit: 'Minute Aod', set: { x: 60, y: 250, show: 'aod', zero: 1 }, glyph: g(150, '#6c6c6c') },
  { edit: 'Weekday', set: { x: 112, y: 158 }, glyph: g(40, '#f2f2f2', { borderColor: '#000000', borderWidth: 2, shadowColor: '#ffffff', shadowBlur: 5, shadowX: 0, shadowY: 0 }) },
  { edit: 'Day', set: { x: 212, y: 158 }, glyph: g(40, '#f2f2f2', { borderColor: '#000000', borderWidth: 2, shadowColor: '#ffffff', shadowBlur: 5, shadowX: 0, shadowY: 0 }) },
  { edit: 'Steps', set: { x: 150, y: 247, alignH: 'CENTER_H', w: 150 }, glyph: g(32, '#1b2a55') });
fs.writeFileSync('recipe.json', JSON.stringify({ name: 'VHS Cassette', device: 'bip-6', font: F, description: 'A realistic compact cassette with spinning reels under a VHS on-screen display: REC dot, tracking glitch, chromatic-aberration time.', preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/vhs-cassette', steps }, null, 1));
