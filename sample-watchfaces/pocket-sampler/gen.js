const fs = require('fs');
const pre = `
const W = dev().w, H = dev().h;
let seed = 21; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const MX = [84, 146, 208], MY = [302, 346, 390], KW = 54, KH = 38;
const RX = [274, 324], RW = 44;
const OR = '#ff4f12', FONT = '"Helvetica Neue", Arial, sans-serif';
`;
const bgJS = pre + `
try { await document.fonts.load('20px "DSEG7 Classic"'); } catch (e) {}
const c = mk(W, H), g = c.getContext('2d');
// ---- body: brushed light-grey aluminium
let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#dcdbd6'); gr.addColorStop(1, '#c9c8c3'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(' + (rnd() > 0.5 ? '255,255,255' : '80,78,70') + ',' + (0.02 + rnd() * 0.035) + ')'; g.fillRect(0, rnd() * H, W, 1); }
for (let i = 0; i < 4000; i++) { g.fillStyle = 'rgba(' + (rnd() > 0.5 ? '255,255,255' : '70,68,60') + ',' + (0.03 + rnd() * 0.05) + ')'; g.fillRect(rnd() * W, rnd() * H, 1, 1); }
// top strip with I/O tags
g.fillStyle = '#cfcec9'; g.fillRect(0, 0, W, 34); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 34, W, 1);
const tag = (x, w, bg, fg, t) => { rr(g, x, 9, w, 21, 3); g.fillStyle = bg; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.8; g.stroke(); g.fillStyle = fg; g.font = '600 8.5px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x + w / 2, 20); };
tag(46, 58, '#f6f5f1', '#333', 'OUTPUT'); tag(112, 58, OR, '#fff', 'INPUT'); tag(178, 74, '#1c1c1f', '#e9e9e9', 'SYNC   MIDI'); tag(260, 40, '#8f8e8a', '#eee', 'USB'); g.fillStyle = '#555'; g.font = '600 8.5px ' + FONT; g.fillText('POWER', 330, 20);
// title panel
gr = g.createLinearGradient(0, 35, 0, 112); gr.addColorStop(0, '#e6e5e0'); gr.addColorStop(1, '#d9d8d3'); g.fillStyle = gr; g.fillRect(0, 35, W, 77);
g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#26262a'; g.font = '700 40px ' + FONT; g.fillText('B.P. VI', 28, 82);
g.fillStyle = '#e8481c'; g.font = '600 12px ' + FONT; g.fillText('WATCH SAMPLER', 30, 101);
g.fillStyle = 'rgba(30,30,30,0.7)'; g.font = '600 9px ' + FONT; g.fillText('64 MB', 168, 101);
// speaker grille
g.save(); g.shadowColor = 'rgba(0,0,0,0.3)'; g.shadowBlur = 4; g.shadowOffsetY = 2; rr(g, 214, 42, 160, 62, 8); gr = g.createLinearGradient(0, 42, 0, 104); gr.addColorStop(0, '#b5b4af'); gr.addColorStop(1, '#9c9b96'); g.fillStyle = gr; g.fill(); g.restore();
g.save(); rr(g, 214, 42, 160, 62, 8); g.clip();
for (let y = 49, r = 0; y < 104; y += 7.4, r++) for (let x = 221 + (r % 2) * 3.7; x < 372; x += 7.4) { g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fillStyle = '#26262a'; g.fill(); g.beginPath(); g.arc(x, y + 0.9, 2.5, 0, 3.14); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.7; g.stroke(); }
g.restore();
// display: black glass slab
g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 8; g.shadowOffsetY = 3; rr(g, 12, 112, 366, 104, 10); gr = g.createLinearGradient(0, 112, 0, 216); gr.addColorStop(0, '#0a0a0c'); gr.addColorStop(1, '#17171c'); g.fillStyle = gr; g.fill(); g.restore();
rr(g, 12, 112, 366, 104, 10); g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 1; g.stroke();
g.save(); rr(g, 12, 112, 366, 104, 10); g.clip();
g.fillStyle = 'rgba(255,255,255,0.05)'; g.beginPath(); g.moveTo(12, 112); g.lineTo(190, 112); g.lineTo(90, 216); g.lineTo(12, 216); g.closePath(); g.fill();
g.restore();
// dim "unlit" icons, like the ghost icons of the real display
g.beginPath(); g.moveTo(262, 118); g.lineTo(262, 134); g.lineTo(276, 126); g.closePath(); g.fillStyle = '#f2f2f2'; g.fill();
g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.2; rr(g, 198, 118, 28, 15, 3); g.stroke(); g.fillStyle = '#fff'; g.font = '700 8px ' + FONT; g.textAlign = 'center'; g.fillText('BAT', 212, 126);
// ring track (steps) in blue, progress is drawn live on top
g.beginPath(); g.arc(308, 166, 30, 0, 7); g.strokeStyle = '#25324f'; g.lineWidth = 11; g.stroke();
g.beginPath(); g.arc(308, 166, 30, -Math.PI / 2, Math.PI * 0.2); g.strokeStyle = 'rgba(46,118,230,0.25)'; g.stroke();
// ---- controls area
g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(0, 216, W, 1); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(0, 217, W, 1);
const keyFace = { black: ['#2e2e33', '#141417', '#050506', '#e9e9e9'], light: ['#f4f3ef', '#d9d8d2', '#a8a7a1', '#2a2a2a'], orange: ['#ff7a3c', '#ee410c', '#a52b05', '#ffffff'], grey: ['#6c6c70', '#4a4a4e', '#2c2c2e', '#f0f0f0'] };
const key = (x, y, w, h, theme, label, big) => {
  const [t0, t1, ed, fg] = keyFace[theme];
  g.save(); g.shadowColor = 'rgba(30,25,15,0.5)'; g.shadowBlur = 6; g.shadowOffsetY = 4; rr(g, x, y, w, h, 7); g.fillStyle = ed; g.fill(); g.restore();
  rr(g, x + 1, y, w - 2, h - 5, 6.5); gr = g.createLinearGradient(0, y, 0, y + h - 5); gr.addColorStop(0, t0); gr.addColorStop(1, t1); g.fillStyle = gr; g.fill();
  rr(g, x + 1.5, y + 0.5, w - 3, h - 6, 6); g.strokeStyle = theme === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.18)'; g.lineWidth = 1; g.stroke();
  g.fillStyle = fg; g.textBaseline = 'middle';
  if (big) { g.font = '500 17px ' + FONT; g.textAlign = 'left'; g.fillText(label, x + 9, y + 14); } else { g.font = '700 8px ' + FONT; g.textAlign = 'center'; g.fillText(label, x + w / 2, y + (h - 5) / 2); }
};
const nums = [['7', '8', '9'], ['4', '5', '6'], ['1', '2', '3']];
MY.forEach((y, r) => MX.forEach((x, cI) => key(x, y, KW, KH, 'black', nums[r][cI], true)));
// LEDs between key rows
MY.slice(0, 3).forEach((y, r) => MX.forEach((x, cI) => { const lit = (r + cI) % 3 === 0; g.beginPath(); g.arc(x + 8, y - 6, 2, 0, 7); g.fillStyle = lit ? '#ff3b1a' : '#8e8d88'; if (lit) { g.shadowColor = '#ff3b1a'; g.shadowBlur = 5; } g.fill(); g.shadowBlur = 0; }));
// tag buttons above the keys
[['SOUND', 'EDIT'], ['MAIN', 'COMMIT'], ['TEMPO', 'LOOP']].forEach(([a, b], i) => { key(MX[i], 230, KW, 20, 'black', a, false); key(MX[i], 252, KW, 22, i === 1 ? 'orange' : 'light', b, false); });
// right column: knob labels and keys
[['SAMPLE', 'orange'], ['TIMING', 'black'], ['FX', 'light'], ['ERASE', 'light'], ['REC', 'orange'], ['PLAY', 'grey']].forEach(([t, th], i) => key(RX[i % 2], MY[Math.floor(i / 2)], RW, KH, th, t, false));
const knob = (cx, cy, r, c0, c1, c2) => {
  g.beginPath(); g.arc(cx, cy, r + 7, 0, 7); gr = g.createLinearGradient(0, cy - r, 0, cy + r + 7); gr.addColorStop(0, '#a9a8a3'); gr.addColorStop(1, '#e3e2dd'); g.fillStyle = gr; g.fill();
  g.save(); g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 9; g.shadowOffsetY = 5; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = c2; g.fill(); g.restore();
  gr = g.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.1, cx, cy, r); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = gr; g.fill();
  g.beginPath(); g.arc(cx, cy, r * 0.62, 0, 7); gr = g.createRadialGradient(cx - r * 0.25, cy - r * 0.3, 1, cx, cy, r * 0.62); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 1; g.stroke();
  g.beginPath(); g.arc(cx, cy, r - 0.5, 3.4, 5.2); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.4; g.stroke();
};
knob(300, 262, 25, '#ff8a56', '#f0420c', '#7a2204'); knob(349, 262, 19, '#46464b', '#161618', '#050506');
g.fillStyle = '#555'; g.font = '700 7.5px ' + FONT; g.textAlign = 'center'; g.fillText('SEC', 300, 296); g.fillText('BATT', 349, 292);
// fader: slot with ticks
rr(g, 42, 246, 8, 184, 4); g.fillStyle = '#1b1b1d'; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.stroke();
g.strokeStyle = 'rgba(40,40,40,0.55)'; g.lineWidth = 1; for (let i = 0; i <= 8; i++) { const y = 254 + i * 21; g.beginPath(); g.moveTo(30, y); g.lineTo(37, y); g.moveTo(55, y); g.lineTo(62, y); g.stroke(); }
g.fillStyle = '#555'; g.font = '700 8px ' + FONT; g.textAlign = 'center'; g.fillText('HR', 46, 237);
names.push(addProjectImage('body.png', c, {}).name);
`;
const faderJS = pre + `
const N = 8;
for (let k = 0; k < N; k++) {
  const c = mk(44, 196), g = c.getContext('2d'), y = 178 - k * (156 / (N - 1));
  g.save(); g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 5; g.shadowOffsetY = 4; rr(g, 4, y - 13, 36, 26, 5); g.fillStyle = '#8c8b86'; g.fill(); g.restore();
  rr(g, 4, y - 13, 36, 24, 5); const gr = g.createLinearGradient(0, y - 13, 0, y + 11); gr.addColorStop(0, '#fbfaf7'); gr.addColorStop(1, '#c6c5bf'); g.fillStyle = gr; g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1; rr(g, 4.5, y - 12.5, 35, 23, 4.5); g.stroke();
  g.fillStyle = '#ff4f12'; g.fillRect(6, y - 1.5, 32, 3); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; for (const d of [-8, 8]) { g.beginPath(); g.moveTo(8, y + d); g.lineTo(36, y + d); g.stroke(); }
  names.push(addProjectImage('fader/f_' + k + '.png', c, {}).name);
}
`;
const headJS = pre + `
const GW = 190, GH = 140, GX = 78, GY = 296;
for (let n = 0; n < 9; n++) {
  const c = mk(GW, GH), g = c.getContext('2d'), x = MX[n % 3] - GX, y = MY[Math.floor(n / 3)] - GY;
  g.save(); g.shadowColor = 'rgba(255,90,30,0.9)'; g.shadowBlur = 10; rr(g, x, y, KW, KH - 3, 7); g.strokeStyle = '#ff5a1e'; g.lineWidth = 2; g.stroke(); g.restore();
  rr(g, x + 1, y, KW - 2, KH - 5, 6.5); const gr = g.createLinearGradient(0, y, 0, y + KH); gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,140,80,0.22)'); g.fillStyle = gr; g.fill();
  names.push(addProjectImage('anim/step_' + n + '.png', c, {}).name);
}
`;
const recJS = pre + `
for (const on of [true, false]) { const c = mk(16, 16), g = c.getContext('2d');
  if (on) { g.shadowColor = '#ff2a1a'; g.shadowBlur = 7; g.beginPath(); g.arc(8, 8, 5, 0, 7); const gr = g.createRadialGradient(6.5, 6.5, 0.5, 8, 8, 5); gr.addColorStop(0, '#ff9a8c'); gr.addColorStop(1, '#ff2a1a'); g.fillStyle = gr; g.fill(); }
  names.push(addProjectImage('anim/rec_' + (on ? 'on' : 'off') + '.png', c, {}).name); }
`;
const needleJS = pre + `
const mkN = (nm, col, len) => { const c = mk(64, 64), g = c.getContext('2d'); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 2; g.shadowOffsetY = 1; g.strokeStyle = col; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(32, 32 - len + 0); g.lineTo(32, 32 - len + 9); g.stroke(); names.push(addProjectImage(nm, c, {}).name); };
mkN('needle_sec.png', '#ffffff', 21); mkN('needle_bat.png', '#ff8a56', 16);
`;
const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const F7 = 'DSEG7 Classic', F14 = 'DSEG14 Classic';
const steps = [{ preset: 'bg' },
  wrap(bgJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Body'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  wrap(faderJS, `const e = await addElement('IMG_LEVEL', { dataType: 'HEART', images: names, w: 0, h: 0 }); e.name = 'Fader'; e.images = names; e.dataType = 'HEART'; e.x = 24; e.y = 238; e.show = 'normal'; return names.length`),
  wrap(headJS, `const e = await addElement('IMG_ANIM', { frames: names, fps: 6, animPrefix: 'step', repeat: 0 }); e.name = 'Playhead'; e.frames = names; e.x = 78; e.y = 296; e.show = 'normal'; return names.length`),
  wrap(recJS, `const e = await addElement('IMG_ANIM', { frames: names, fps: 2, animPrefix: 'rec', repeat: 0 }); e.name = 'REC dot'; e.frames = names; e.x = 232; e.y = 118; e.show = 'normal'; return names.length`),
  wrap(needleJS, `
    const [sec, bat] = names;
    const tp = await addElement('TIME_POINTER', { centerX: 300, centerY: 262 }); tp.name = 'Knob seconds'; tp.second = sec; tp.secondPivotX = 32; tp.secondPivotY = 32; tp.centerX = 300; tp.centerY = 262; tp.show = 'normal';
    const ip = await addElement('IMG_POINTER', { src: bat, dataType: 'BATTERY' }); ip.name = 'Knob battery'; ip.src = bat; ip.dataType = 'BATTERY'; ip.x = 349 - 32; ip.y = 262 - 32; ip.centerX = 349; ip.centerY = 262; ip.startAngle = -135; ip.endAngle = 135; ip.show = 'normal'; return 1`),
  { add: 'ARC_PROGRESS', name: 'Steps ring', patch: { dataType: 'STEP' }, set: { centerX: 308, centerY: 166, radius: 30, lineWidth: 11, startAngle: -90, endAngle: 270, color: '#ff4f12', show: 'normal' } },
  { preset: 'clock' }, { preset: 'weekday' }, { preset: 'day' }, { preset: 'battery' }, { preset: 'steps' }, { preset: 'clock' },
  { script: `const n = project.elements.length; ['Hour','Colon','Minute'].forEach((nm,i)=>{ project.elements[n-3+i].name = nm + ' Aod'; }); return 1` },
  { remove: 'Colon Aod' },
];
const seg = (font, size, color) => ({ font, size, fill: 'solid', color });
steps.push(
  { edit: 'Hour', set: { x: 26, y: 140, zero: 1 }, glyph: seg(F7, 56, '#f3f3f3') },
  { edit: 'Colon', set: { x: 130, y: 150 }, glyph: seg(F7, 56, '#f3f3f3') },
  { edit: 'Minute', set: { x: 150, y: 140, zero: 1 }, glyph: seg(F7, 56, '#f3f3f3') },
  { edit: 'Weekday', set: { x: 28, y: 118 }, glyph: seg(F14, 16, '#f3f3f3') },
  { edit: 'Day', set: { x: 100, y: 118 }, glyph: seg(F7, 16, '#f3f3f3') },
  { edit: 'Battery', set: { x: 140, y: 118 }, glyph: seg(F7, 16, '#f3f3f3') },
  { edit: 'Steps', set: { x: 284, y: 160, alignH: 'CENTER_H', w: 48, hSpace: -3 }, glyph: seg(F7, 11, '#ffffff') },
  { edit: 'Hour Aod', set: { x: 60, y: 120, show: 'aod', zero: 1 }, glyph: seg(F7, 100, '#8a8a8a') },
  { edit: 'Minute Aod', set: { x: 60, y: 260, show: 'aod', zero: 1 }, glyph: seg(F7, 100, '#8a8a8a') },
);
// widgets that are more likely to trip a real watch (pointers, ring, animations) are created after the time and readings,
// so a failure there can never take the clock down with it
const risky = (st) => st.script && /IMG_LEVEL|IMG_ANIM|TIME_POINTER/.test(st.script) || st.add === 'ARC_PROGRESS';
const late = steps.filter(risky), early = steps.filter((st) => !risky(st));
steps.length = 0; steps.push(...early, ...late);
fs.writeFileSync('recipe.json', JSON.stringify({ name: 'Pocket Sampler', device: 'bip-6', font: F7, description: 'A pocket-sampler homage: black-glass segment display, a step ring, a heart-rate fader, a seconds knob, a battery knob and a sequencer playhead across the keys.', preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/pocket-sampler', steps }, null, 1));
