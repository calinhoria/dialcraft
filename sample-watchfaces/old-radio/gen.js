const fs = require('fs');
const pre = `
const W = dev().w, H = dev().h;
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const EYE = [195, 410];
`;
const bodyJS = pre + `
const c = mk(), g = c.getContext('2d');
// walnut cabinet
const wg = g.createLinearGradient(0, 0, 0, H); wg.addColorStop(0, '#3a2012'); wg.addColorStop(1, '#24130a');
g.fillStyle = wg; g.fillRect(0, 0, W, H);
g.globalAlpha = 0.18; g.strokeStyle = '#8a5a30'; g.lineWidth = 1;
for (let y = 6; y < H; y += 9) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(100, y + 4, 250, y - 5, W, y + 2); g.stroke(); }
g.globalAlpha = 1;
// dial window
rr(g, 18, 16, 354, 128, 14); g.fillStyle = '#c9a24e'; g.fill();
rr(g, 24, 22, 342, 116, 10);
const dg = g.createLinearGradient(0, 22, 0, 138); dg.addColorStop(0, '#ffe9b0'); dg.addColorStop(1, '#f2b657');
g.fillStyle = dg; g.fill();
g.save(); rr(g, 24, 22, 342, 116, 10); g.clip();
g.strokeStyle = 'rgba(60,25,5,0.8)'; g.fillStyle = 'rgba(60,25,5,0.9)'; g.lineWidth = 1.5;
g.beginPath(); g.moveTo(34, 112); g.lineTo(356, 112); g.stroke();
for (let i = 0; i <= 40; i++) { const x = 40 + i * 7.8; const long = i % 5 === 0; g.beginPath(); g.moveTo(x, 112); g.lineTo(x, long ? 92 : 102); g.stroke(); }
g.font = 'bold 15px Cinzel'; g.textAlign = 'center';
['88', '92', '96', '100', '104', '108'].forEach((t, i) => g.fillText(t, 40 + i * 5 * 7.8 * 1.6 / 1.6 * 1, 84));
g.font = 'bold 12px Cinzel'; g.textAlign = 'left'; g.fillText('FM', 34, 48); g.textAlign = 'right'; g.fillText('MHz', 356, 48);
g.restore();
// inset panel behind the time
rr(g, 22, 160, 346, 130, 12); g.fillStyle = '#0b0603'; g.fill(); g.strokeStyle = '#c9a24e'; g.lineWidth = 3; g.stroke();
// speaker grille
rr(g, 22, 312, 346, 126, 12); g.fillStyle = '#150b05'; g.fill();
g.strokeStyle = '#6b4724'; g.lineWidth = 3;
for (let y = 380; y < 432; y += 9) { g.beginPath(); g.moveTo(30, y); g.lineTo(360, y); g.stroke(); }
// knobs
for (const kx of [58, 332]) {
  const kg = g.createRadialGradient(kx - 6, 366 - 6, 4, kx, 366, 26); kg.addColorStop(0, '#f1d58a'); kg.addColorStop(1, '#6b4a14');
  g.fillStyle = kg; g.beginPath(); g.arc(kx, 366, 24, 0, 7); g.fill();
  g.strokeStyle = '#2a1706'; g.lineWidth = 3; g.beginPath(); g.moveTo(kx, 366); g.lineTo(kx + (kx < 195 ? -8 : 8), 346); g.stroke();
}
// magic eye socket
g.fillStyle = '#c9a24e'; g.beginPath(); g.arc(EYE[0], EYE[1], 40, 0, 7); g.fill();
g.fillStyle = '#0a0a06'; g.beginPath(); g.arc(EYE[0], EYE[1], 35, 0, 7); g.fill();
names.push(addProjectImage('radio_body.png', c, {}).name);
`;
const needleJS = pre + `
const N = 24;
for (let k = 0; k < N; k++) {
  const c = mk(), g = c.getContext('2d');
  const x = 195 + 150 * Math.sin(2 * Math.PI * k / N);
  g.shadowColor = '#ff2a1a'; g.shadowBlur = 8; g.strokeStyle = '#d3180c'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(x, 24); g.lineTo(x, 136); g.stroke();
  g.shadowBlur = 0; g.fillStyle = '#ff6a50'; g.fillRect(x - 3, 130, 6, 6);
  names.push(addProjectImage('anim/or_needle_' + k + '.png', c, {}).name);
}
`;
const eyeJS = pre + `
const N = 8;
for (let k = 0; k < N; k++) {
  const c = mk(), g = c.getContext('2d');
  const open = 0.25 + 0.75 * Math.abs(Math.sin(Math.PI * k / N * 1.0 + 0.3));
  const rg = g.createRadialGradient(EYE[0], EYE[1], 4, EYE[0], EYE[1], 33);
  rg.addColorStop(0, '#eaffd8'); rg.addColorStop(0.55, '#7dff4a'); rg.addColorStop(1, '#1f8a1c');
  g.shadowColor = '#5cff3a'; g.shadowBlur = 14; g.fillStyle = rg; g.beginPath(); g.arc(EYE[0], EYE[1], 33, 0, 7); g.fill(); g.shadowBlur = 0;
  // dark wedge: narrower when the signal is stronger
  const half = (1 - open) * 1.1 + 0.12;
  g.fillStyle = '#0a0a06'; g.beginPath(); g.moveTo(EYE[0], EYE[1]); g.arc(EYE[0], EYE[1], 34, Math.PI / 2 - half, Math.PI / 2 + half); g.closePath(); g.fill();
  g.fillStyle = '#0a0a06'; g.beginPath(); g.arc(EYE[0], EYE[1], 5, 0, 7); g.fill();
  names.push(addProjectImage('anim/or_eye_' + k + '.png', c, {}).name);
}
`;
const wrap = (body, tail) => ({ script: `const names = [];\n${body}\nawait loadAllImages();\n${tail}` });
const clock = (suf) => ({ script: `const n = project.elements.length; for (const i of [n-3,n-2,n-1]) project.elements[i].name += ' ${suf}'; return 1` });
const steps = [
  { preset: 'bg' },
  wrap(bodyJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Radio body'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return names;`),
  wrap(needleJS, `const e = await addElement('IMG_ANIM', { frames: names, fps: 8, animPrefix: 'or_needle', repeat: 0 }); e.name = 'Tuning needle'; e.frames = names; e.x = 0; e.y = 0; e.show = 'normal'; return names.length;`),
  wrap(eyeJS, `const e = await addElement('IMG_ANIM', { frames: names, fps: 6, animPrefix: 'or_eye', repeat: 0 }); e.name = 'Magic eye'; e.frames = names; e.x = 0; e.y = 0; e.show = 'normal'; return names.length;`),
  { preset: 'clock' }, clock('Main'),
  { preset: 'clock' }, clock('Aod'),
  { preset: 'weekday' }, { preset: 'steps' },
  { remove: 'Colon Aod' },
  { edit: 'Hour Main', set: { x: 70, y: 185, show: 'normal' }, glyph: { color: '#ffb23a', size: 84 } },
  { edit: 'Colon Main', set: { show: 'normal' }, glyph: { color: '#ffb23a', size: 84 } },
  { edit: 'Minute Main', set: { x: 218, y: 185, show: 'normal' }, glyph: { color: '#ffb23a', size: 84 } },
  { edit: 'Hour Aod', set: { x: 40, y: 150, show: 'aod' }, glyph: { color: '#6b4a1a', size: 110 } },
  { edit: 'Minute Aod', set: { x: 40, y: 280, show: 'aod' }, glyph: { color: '#6b4a1a', size: 110 } },
  { edit: 'Weekday', set: { x: 30, y: 316 }, glyph: { color: '#f1d58a', size: 24 } },
  { edit: 'Steps', set: { x: 250, y: 316 }, glyph: { color: '#f1d58a', size: 24 } },
];
fs.writeFileSync('recipe.json', JSON.stringify({ name: 'Old Radio', device: 'bip-6', font: 'Cinzel', description: 'Vintage tube radio: glowing dial with a drifting tuning needle, amber time and a pulsing magic eye.', preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/old-radio', steps }, null, 1));
