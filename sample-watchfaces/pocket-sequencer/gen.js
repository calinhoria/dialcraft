const fs = require('fs');
const pre = `
const W = dev().w, H = dev().h;
let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
const KX = [21, 111, 201, 291], KY = [198, 250, 302, 354], KW = 78, KH = 44;
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
`;
const bgJS = pre + `
try { await document.fonts.load('20px "DSEG14 Classic"'); } catch (e) {}
const c = mk(W, H), g = c.getContext('2d');
g.fillStyle = '#e6e3da'; g.fillRect(0, 0, W, H);
for (let i = 0; i < 5000; i++) { g.fillStyle = 'rgba(' + (rnd() > 0.5 ? '255,255,255' : '90,80,60') + ',' + (0.03 + rnd() * 0.05) + ')'; g.fillRect(rnd() * W, rnd() * H, 1, 1); }
let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0.08)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
// LCD bezel and glass
g.save(); g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 8; g.shadowOffsetY = 3; rr(g, 12, 12, 366, 164, 14); g.fillStyle = '#26282a'; g.fill(); g.restore();
rr(g, 12, 12, 366, 164, 14); g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 1; g.stroke();
rr(g, 20, 20, 350, 148, 7); gr = g.createLinearGradient(0, 20, 0, 168); gr.addColorStop(0, '#cdd5b8'); gr.addColorStop(1, '#aebb98'); g.fillStyle = gr; g.fill();
g.save(); rr(g, 20, 20, 350, 148, 7); g.clip();
gr = g.createLinearGradient(0, 20, 0, 44); gr.addColorStop(0, 'rgba(30,40,20,0.35)'); gr.addColorStop(1, 'rgba(30,40,20,0)'); g.fillStyle = gr; g.fillRect(20, 20, 350, 24);
gr = g.createLinearGradient(20, 0, 44, 0); gr.addColorStop(0, 'rgba(30,40,20,0.25)'); gr.addColorStop(1, 'rgba(30,40,20,0)'); g.fillStyle = gr; g.fillRect(20, 20, 24, 148);
for (let y = 20; y < 168; y += 3) { g.fillStyle = 'rgba(40,55,30,0.05)'; g.fillRect(20, y, 350, 1); }
g.fillStyle = 'rgba(40,55,30,0.35)'; g.fillRect(28, 48, 334, 1);
g.restore();
// printed labels
g.font = 'bold 9px "Helvetica Neue", Arial, sans-serif'; g.fillStyle = '#8a8579'; g.textBaseline = 'middle';
g.fillText('STEP SEQUENCER  \\u2022  1\\u201316', 22, 187); g.textAlign = 'right'; g.fillText('BIP-1', 368, 187); g.textAlign = 'left';
g.fillStyle = '#ff5a1f'; g.fillRect(22, 424, 8, 8);
g.fillStyle = '#4a463c'; g.font = 'bold 11px "Helvetica Neue", Arial, sans-serif'; g.fillText('STEPS', 36, 428);
// keys
let n = 1;
for (const y of KY) for (const x of KX) {
  const beat = (n - 1) % 4 === 0;
  g.save(); g.shadowColor = 'rgba(50,40,20,0.45)'; g.shadowBlur = 6; g.shadowOffsetY = 4; rr(g, x, y, KW, KH, 9); g.fillStyle = '#b9b4a6'; g.fill(); g.restore();
  rr(g, x, y, KW, KH - 4, 9); gr = g.createLinearGradient(0, y, 0, y + KH - 4); gr.addColorStop(0, beat ? '#ffffff' : '#fdfcf8'); gr.addColorStop(1, beat ? '#d3d9de' : '#dedacf'); g.fillStyle = gr; g.fill();
  rr(g, x + 0.5, y + 0.5, KW - 1, KH - 5, 8.5); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1; g.stroke();
  g.fillStyle = 'rgba(80,70,50,0.55)'; g.font = 'bold 10px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.fillText(String(n), x + KW / 2, y + KH / 2 - 2); g.textAlign = 'left';
  n++;
}
names.push(addProjectImage('body.png', c, {}).name);
`;
const litJS = pre + `
for (let n = 0; n < 16; n++) {
  const c = mk(KW + 16, KH + 16), g = c.getContext('2d');
  g.save(); g.shadowColor = 'rgba(255,90,31,0.75)'; g.shadowBlur = 9; rr(g, 8, 8, KW, KH - 4, 9); g.fillStyle = '#ff5a1f'; g.fill(); g.restore();
  rr(g, 8, 8, KW, KH - 4, 9); const gr = g.createLinearGradient(0, 8, 0, KH + 4); gr.addColorStop(0, '#ff8a52'); gr.addColorStop(1, '#f2470f'); g.fillStyle = gr; g.fill();
  rr(g, 8.5, 8.5, KW - 1, KH - 5, 8.5); g.strokeStyle = 'rgba(255,230,210,0.8)'; g.lineWidth = 1; g.stroke();
  g.fillStyle = '#fff'; g.font = 'bold 10px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n + 1), 8 + KW / 2, 8 + KH / 2 - 2);
  names.push(addProjectImage('keys/lit_' + n + '.png', c, {}).name);
}
`;
const headJS = pre + `
const GW = 374, GH = 214;
for (let n = 0; n < 16; n++) {
  const c = mk(GW, GH), g = c.getContext('2d'), col = n % 4, row = Math.floor(n / 4), x = KX[col] - 8, y = KY[row] - 192;
  g.save(); g.shadowColor = 'rgba(47,107,255,0.8)'; g.shadowBlur = 8; rr(g, x - 2, y - 2, KW + 4, KH - 2, 11); g.strokeStyle = '#2f6bff'; g.lineWidth = 3; g.stroke(); g.restore();
  rr(g, x, y, KW, KH - 4, 9); g.fillStyle = 'rgba(255,255,255,0.28)'; g.fill();
  names.push(addProjectImage('anim/head_' + n + '.png', c, {}).name);
}
`;
const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const F = 'DSEG14 Classic';
const LCD = '#1e2616';
const steps = [{ preset: 'bg' },
  wrap(bgJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Body'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  { preset: 'clock' }, { script: `const n = project.elements.length; ['Hour','Colon','Minute'].forEach((nm,i)=>{ project.elements[n-3+i].name = 'Ghost ' + nm; }); return 1` },
  { preset: 'clock' }, { preset: 'weekday' }, { preset: 'day' }, { preset: 'battery' }, { preset: 'steps' }, { preset: 'clock' },
  { script: `const n = project.elements.length; ['Hour','Colon','Minute'].forEach((nm,i)=>{ project.elements[n-3+i].name = nm + ' Aod'; }); return 1` },
  { remove: 'Colon Aod' }, { remove: 'Ghost Colon' },
];
const lcd = (size, color, extra) => ({ font: F, size, fill: 'solid', color, ...extra });
steps.push(
  { edit: 'Ghost Hour', set: { x: 36, y: 52 }, glyph: lcd(96, '#2a3320') },
  { edit: 'Ghost Minute', set: { x: 206, y: 52 }, glyph: lcd(96, '#2a3320') },
  { script: `for (const nm of ['Ghost Hour', 'Ghost Minute']) { const e = project.elements.find((q) => q.name === nm); const eight = e.images[8]; e.images = e.images.map(() => eight); e.glyph = null; e.alpha = 32; e.zero = 1; e.show = 'normal'; } return 1` },
  { edit: 'Hour', set: { x: 36, y: 52, zero: 1 }, glyph: lcd(96, LCD) },
  { edit: 'Colon', set: { x: 186, y: 66 }, glyph: lcd(96, LCD) },
  { edit: 'Minute', set: { x: 206, y: 52, zero: 1 }, glyph: lcd(96, LCD) },
  { edit: 'Weekday', set: { x: 30, y: 26 }, glyph: lcd(18, LCD) },
  { edit: 'Day', set: { x: 110, y: 26 }, glyph: lcd(18, LCD) },
  { edit: 'Battery', set: { x: 300, y: 26 }, glyph: lcd(18, LCD) },
  { edit: 'Steps', set: { x: 130, y: 404, alignH: 'LEFT' }, glyph: lcd(28, '#26282a') },
  { edit: 'Hour Aod', set: { x: 70, y: 130, show: 'aod', zero: 1 }, glyph: lcd(110, '#5f6a4c') },
  { edit: 'Minute Aod', set: { x: 70, y: 270, show: 'aod', zero: 1 }, glyph: lcd(110, '#5f6a4c') },
);
// lit keys (steps progress, native) and the playhead (animation) sit between the body and the LCD text
const mid = [
  wrap(litJS, `const e = await addElement('IMG_PROGRESS', { dataType: 'STEP', images: names }); e.name = 'Lit keys'; e.images = names; e.dataType = 'STEP'; e.positions = names.map((_, i) => [KX[i % 4] - 8, KY[Math.floor(i / 4)] - 8]); e.x = 0; e.y = 0; e.show = 'normal';
     const bi = project.elements.indexOf(e); project.elements.splice(bi, 1); const body = project.elements.findIndex((q) => q.name === 'Body'); project.elements.splice(body + 1, 0, e); return names.length`),
  wrap(headJS, `const e = await addElement('IMG_ANIM', { frames: names, fps: 8, animPrefix: 'head', repeat: 0 }); e.name = 'Playhead'; e.frames = names; e.x = 8; e.y = 192; e.show = 'normal';
     const bi = project.elements.indexOf(e); project.elements.splice(bi, 1); const lit = project.elements.findIndex((q) => q.name === 'Lit keys'); project.elements.splice(lit + 1, 0, e); return names.length`),
];
steps.splice(2, 0, ...mid);
fs.writeFileSync('recipe.json', JSON.stringify({ name: 'Pocket Sequencer', device: 'bip-6', font: F, description: 'A pocket-synth style face: LCD time, a 16-key step sequencer that lights up with your daily steps, and a playhead running across the keys.', preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/pocket-sequencer', steps }, null, 1));
