const fs = require('fs');
const pre = `
const W = dev().w, H = dev().h;
let seed = 77; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const names = [];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const GOLD = (g, x0, y0, x1, y1) => { const q = g.createLinearGradient(x0, y0, x1, y1); q.addColorStop(0, '#fff2b0'); q.addColorStop(0.3, '#e8b73c'); q.addColorStop(0.55, '#a8761a'); q.addColorStop(0.8, '#f1c95a'); q.addColorStop(1, '#8a5c10'); return q; };
const CHROME = (g, x0, y0, x1, y1) => { const q = g.createLinearGradient(x0, y0, x1, y1); q.addColorStop(0, '#fbfcff'); q.addColorStop(0.25, '#aeb4c0'); q.addColorStop(0.5, '#f2f4f8'); q.addColorStop(0.75, '#7b808c'); q.addColorStop(1, '#d4d8e0'); return q; };
const RW = 60, RH = 116, PITCH = 74, RY = 110, REELX = [38, 98, 194, 254];   // reel images and their on-screen positions
const BULBS = []; for (let x = 54; x <= 338; x += 22) { BULBS.push([x, 25]); BULBS.push([x, 76]); } for (let y = 37; y <= 65; y += 14) { BULBS.push([47, y]); BULBS.push([345, y]); }
// one reel face: cream paper with the digit and half of its neighbours, shaded like a cylinder
function reelFace(g, ox, oy, digit, offset) {
  g.save(); g.translate(ox, oy); g.beginPath(); g.rect(0, 0, RW, RH); g.clip();
  let q = g.createLinearGradient(0, 0, RW, 0); q.addColorStop(0, '#d8cdb0'); q.addColorStop(0.15, '#f7f1de'); q.addColorStop(0.85, '#f7f1de'); q.addColorStop(1, '#d3c8aa'); g.fillStyle = q; g.fillRect(0, 0, RW, RH);
  g.font = '92px "Anton"'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  for (const k of [-1, 0, 1]) { const d = (digit + k + 100) % 10, cy = RH / 2 + k * PITCH + (offset || 0);
    g.save(); g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = 2; g.shadowOffsetY = 1; g.fillStyle = '#cf1730'; g.strokeStyle = '#1b0508'; g.lineWidth = 2.2; g.lineJoin = 'round'; g.strokeText(String(d), RW / 2, cy + 33); g.fillText(String(d), RW / 2, cy + 33); g.restore();
    g.fillStyle = 'rgba(255,170,170,0.35)'; g.fillRect(RW / 2 - 18, cy - 28, 36, 2); }
  q = g.createLinearGradient(0, 0, 0, RH); q.addColorStop(0, 'rgba(10,5,0,0.78)'); q.addColorStop(0.16, 'rgba(10,5,0,0.28)'); q.addColorStop(0.36, 'rgba(10,5,0,0)'); q.addColorStop(0.64, 'rgba(10,5,0,0)'); q.addColorStop(0.84, 'rgba(10,5,0,0.28)'); q.addColorStop(1, 'rgba(10,5,0,0.78)'); g.fillStyle = q; g.fillRect(0, 0, RW, RH);
  q = g.createLinearGradient(0, 0, RW, 0); q.addColorStop(0, 'rgba(0,0,0,0.35)'); q.addColorStop(0.1, 'rgba(0,0,0,0)'); q.addColorStop(0.9, 'rgba(0,0,0,0)'); q.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = q; g.fillRect(0, 0, RW, RH);
  g.restore();
}
`;
const sceneJS = pre + `
try { await document.fonts.load('44px "Anton"'); } catch (e) {}
const c = mk(W, H), g = c.getContext('2d');
let gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#5e0610'); gr.addColorStop(0.3, '#a50f20'); gr.addColorStop(0.5, '#c4162a'); gr.addColorStop(0.7, '#a50f20'); gr.addColorStop(1, '#5e0610'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
for (let i = 0; i < 3000; i++) { g.fillStyle = 'rgba(' + (rnd() > 0.5 ? '255,200,200' : '0,0,0') + ',' + (0.02 + rnd() * 0.04) + ')'; g.fillRect(rnd() * W, rnd() * H, 1, 1); }
// gold pinstripes
for (const [i, w] of [[5, 2.5], [10, 1]]) { rr(g, i, i, W - i * 2, H - i * 2, 28); g.strokeStyle = GOLD(g, 0, 0, W, H); g.lineWidth = w; g.stroke(); }
// marquee
g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 8; g.shadowOffsetY = 3; rr(g, 38, 14, 314, 72, 14); g.fillStyle = GOLD(g, 38, 14, 352, 86); g.fill(); g.restore();
rr(g, 43, 19, 304, 62, 11); gr = g.createLinearGradient(0, 19, 0, 81); gr.addColorStop(0, '#1d0408'); gr.addColorStop(1, '#0a0103'); g.fillStyle = gr; g.fill();
for (const [x, y] of BULBS) { g.beginPath(); g.arc(x, y, 4, 0, 7); const q = g.createRadialGradient(x - 1, y - 1, 0.5, x, y, 4); q.addColorStop(0, '#9a8450'); q.addColorStop(1, '#4a3c1c'); g.fillStyle = q; g.fill(); }
g.font = '46px "Anton"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.save(); g.shadowColor = '#ffb020'; g.shadowBlur = 14; g.lineWidth = 4; g.strokeStyle = '#5a0a12'; g.lineJoin = 'round'; g.strokeText('SLOT TIME', 195, 52); g.fillStyle = GOLD(g, 0, 30, 0, 74); g.fillText('SLOT TIME', 195, 52); g.restore();
// reel window: chrome bezel, black recess
g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 8; g.shadowOffsetY = 4; rr(g, 26, 96, 300, 144, 12); g.fillStyle = CHROME(g, 26, 96, 326, 240); g.fill(); g.restore();
rr(g, 33, 103, 286, 130, 8); g.fillStyle = '#050304'; g.fill();
// the gap between hour and minute: two lamps
g.fillStyle = '#17090b'; g.fillRect(158, 110, 36, 116);
for (const y of [148, 188]) { const q = g.createRadialGradient(176, y, 0, 176, y, 16); q.addColorStop(0, 'rgba(255,60,40,0.55)'); q.addColorStop(1, 'rgba(255,60,40,0)'); g.fillStyle = q; g.fillRect(156, y - 16, 40, 32); g.beginPath(); g.arc(176, y, 5, 0, 7); const l = g.createRadialGradient(174.5, y - 1.5, 0.5, 176, y, 5); l.addColorStop(0, '#ffd8c8'); l.addColorStop(0.4, '#ff4a38'); l.addColorStop(1, '#8a1010'); g.fillStyle = l; g.fill(); }
// lever housing
g.save(); g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 6; g.shadowOffsetY = 3; rr(g, 340, 96, 34, 144, 10); g.fillStyle = CHROME(g, 340, 96, 374, 240); g.fill(); g.restore();
rr(g, 351, 108, 12, 120, 6); g.fillStyle = '#060304'; g.fill();
// LED panels
const PAN = [[28, 250, 196, 56, 'CREDITS'], [232, 250, 128, 56, 'BATTERY'], [28, 312, 140, 56, 'DATE  DD.MM'], [176, 312, 100, 56, 'DAY'], [284, 312, 76, 56, 'TEMP']];
for (const [x, y, w, h, l] of PAN) { g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 6; g.shadowOffsetY = 3; rr(g, x, y, w, h, 8); g.fillStyle = CHROME(g, x, y, x + w, y + h); g.fill(); g.restore(); rr(g, x + 3, y + 3, w - 6, h - 6, 6); const q = g.createLinearGradient(0, y, 0, y + h); q.addColorStop(0, '#0a0102'); q.addColorStop(1, '#1c0507'); g.fillStyle = q; g.fill(); g.fillStyle = '#e9bd55'; g.font = '700 8px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(l, x + 10, y + 12); }
g.fillStyle = '#ff3b2f'; g.fillRect(98, 356, 4, 4);
// coin tray
g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 8; g.shadowOffsetY = 3; g.beginPath(); g.moveTo(52, 450); g.lineTo(64, 384); g.quadraticCurveTo(195, 372, 326, 384); g.lineTo(338, 450); g.closePath(); g.fillStyle = CHROME(g, 52, 380, 338, 450); g.fill(); g.restore();
g.beginPath(); g.moveTo(66, 450); g.lineTo(75, 394); g.quadraticCurveTo(195, 384, 315, 394); g.lineTo(324, 450); g.closePath(); gr = g.createLinearGradient(0, 390, 0, 450); gr.addColorStop(0, '#050203'); gr.addColorStop(1, '#1a0709'); g.fillStyle = gr; g.fill();
rr(g, 150, 396, 90, 10, 5); g.fillStyle = '#000'; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 1; g.stroke();
const coin = (x, y, r) => { g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 3; g.shadowOffsetY = 2; g.beginPath(); g.ellipse(x, y, r, r * 0.45, 0, 0, 7); g.fillStyle = '#8a5c10'; g.fill(); g.restore(); g.beginPath(); g.ellipse(x, y - 2.2, r, r * 0.45, 0, 0, 7); g.fillStyle = GOLD(g, x - r, y, x + r, y + r); g.fill(); g.strokeStyle = 'rgba(90,55,5,0.7)'; g.lineWidth = 0.8; g.stroke(); g.beginPath(); g.ellipse(x, y - 2.2, r * 0.62, r * 0.27, 0, 0, 7); g.strokeStyle = 'rgba(120,75,10,0.6)'; g.stroke(); g.beginPath(); g.ellipse(x - r * 0.3, y - 3.6, r * 0.28, r * 0.1, 0, 0, 7); g.fillStyle = 'rgba(255,250,210,0.8)'; g.fill(); };
for (const [x, y, r] of [[118, 440, 15], [150, 442, 15], [186, 444, 15], [222, 442, 15], [258, 440, 15], [134, 430, 15], [170, 432, 15], [206, 432, 15], [242, 430, 15], [188, 421, 15], [150, 421, 15], [226, 421, 15], [168, 412, 15]]) coin(x, y, r);
names.push(addProjectImage('scene.png', c, {}).name);
`;
const reelsJS = pre + `
try { await document.fonts.load('92px "Anton"'); } catch (e) {}
for (let n = 0; n < 10; n++) { const c = mk(RW, RH), g = c.getContext('2d'); reelFace(g, 0, 0, n, 0); names.push(addProjectImage('reel/d' + n + '.png', c, {}).name); }
`;
const spinJS = pre + `
try { await document.fonts.load('92px "Anton"'); } catch (e) {}
const N = 40, SW = 276, STOP = [30, 32, 34, 36], START = 20;
const order = [3, 8, 1, 6, 0, 5, 9, 2, 7, 4];
for (let k = 0; k < N; k++) {
  const c = mk(SW, RH), g = c.getContext('2d');
  REELX.forEach((rx, r) => {
    if (k < START || k >= STOP[r]) return;
    const left = STOP[r] - k, v = 66 * clamp(left / 6, 0.22, 1), pos = (k - START) * 66 + r * 140;
    const tmp = mk(RW, RH), tg = tmp.getContext('2d');
    const blur = clamp(left / 5, 0.2, 1);
    for (let s = -2; s <= 2; s++) { const off = ((pos + s * v * 0.22 * blur) % (PITCH * 10) + PITCH * 10) % (PITCH * 10), idx = Math.floor(off / PITCH), fr = off - idx * PITCH;
      tg.globalAlpha = s === 0 ? 0.9 : 0.34; reelFace(tg, 0, 0, order[idx % 10], -fr); }
    g.drawImage(tmp, rx - 38, 0);
  });
  names.push(addProjectImage('anim/spin_' + k + '.png', c, {}).name);
}
`;
const leverJS = pre + `
const N = 40, LW = 50, LH = 180;
const by = (k) => k < 18 ? 112 : k < 24 ? 112 + (k - 18) / 6 * 126 : k < 27 ? 238 : k < 34 ? 238 - (k - 27) / 7 * 126 : 112;
for (let k = 0; k < N; k++) {
  const c = mk(LW, LH), g = c.getContext('2d'), y = by(k) - 90, cx = 27, piv = 178 - 90, r = 11 + 3 * (y - 22) / 126;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 4; g.shadowOffsetX = 3; g.shadowOffsetY = 3; let q = g.createLinearGradient(cx - 4, 0, cx + 4, 0); q.addColorStop(0, '#6a6f7a'); q.addColorStop(0.4, '#fbfcff'); q.addColorStop(1, '#6a6f7a'); g.fillStyle = q; g.fillRect(cx - 4, Math.min(y, piv), 8, Math.abs(piv - y)); g.restore();
  g.beginPath(); g.arc(cx, piv, 7, 0, 7); g.fillStyle = CHROME(g, cx - 7, piv - 7, cx + 7, piv + 7); g.fill();
  g.save(); g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 6; g.shadowOffsetX = 3; g.shadowOffsetY = 4; g.beginPath(); g.arc(cx, y, r, 0, 7); q = g.createRadialGradient(cx - r * 0.35, y - r * 0.4, 1, cx, y, r * 1.1); q.addColorStop(0, '#ff9a8a'); q.addColorStop(0.35, '#e0182c'); q.addColorStop(1, '#5a0510'); g.fillStyle = q; g.fill(); g.restore();
  g.beginPath(); g.arc(cx - r * 0.35, y - r * 0.4, r * 0.22, 0, 7); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fill();
  names.push(addProjectImage('anim/lever_' + k + '.png', c, {}).name);
}
`;
const bulbJS = pre + `
for (let f = 0; f < 2; f++) { const c = mk(314, 72), g = c.getContext('2d');
  BULBS.forEach(([x, y], i) => { if ((i + f) % 2) return; const px = x - 38, py = y - 14; const q = g.createRadialGradient(px, py, 0, px, py, 11); q.addColorStop(0, 'rgba(255,230,140,0.9)'); q.addColorStop(0.4, 'rgba(255,190,60,0.35)'); q.addColorStop(1, 'rgba(255,170,40,0)'); g.fillStyle = q; g.fillRect(px - 11, py - 11, 22, 22); g.beginPath(); g.arc(px, py, 3.6, 0, 7); const l = g.createRadialGradient(px - 1, py - 1, 0.3, px, py, 3.6); l.addColorStop(0, '#ffffff'); l.addColorStop(0.5, '#ffe28a'); l.addColorStop(1, '#e8a020'); g.fillStyle = l; g.fill(); });
  names.push(addProjectImage('anim/bulbs_' + f + '.png', c, {}).name); }
`;
const glareJS = pre + `
const c = mk(300, 144), g = c.getContext('2d'), X = 26, Y = 96;
// payline across the reels, and a diagonal glass reflection
let q = g.createLinearGradient(0, 0, 0, 0); g.save(); g.shadowColor = '#ff2a1a'; g.shadowBlur = 6; g.fillStyle = 'rgba(255,50,40,0.85)'; g.fillRect(8, 72 - 1, 284, 2); g.restore();
for (const [x, dir] of [[2, 1], [298, -1]]) { g.beginPath(); g.moveTo(x, 72 - 7); g.lineTo(x + dir * 9, 72); g.lineTo(x, 72 + 7); g.closePath(); g.fillStyle = GOLD(g, x, 60, x + 9, 84); g.fill(); }
q = g.createLinearGradient(8, 8, 150, 136); q.addColorStop(0, 'rgba(255,255,255,0.28)'); q.addColorStop(0.28, 'rgba(255,255,255,0.08)'); q.addColorStop(0.3, 'rgba(255,255,255,0)'); g.fillStyle = q;
g.beginPath(); g.moveTo(8, 8); g.lineTo(190, 8); g.lineTo(64, 136); g.lineTo(8, 136); g.closePath(); g.fill();
q = g.createLinearGradient(0, 8, 0, 20); q.addColorStop(0, 'rgba(255,255,255,0.3)'); q.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = q; g.fillRect(8, 8, 284, 12);
names.push(addProjectImage('glare.png', c, {}).name);
`;
const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const F7 = 'DSEG7 Classic', F14 = 'DSEG14 Classic';
const steps = [{ preset: 'bg' },
  wrap(sceneJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Cabinet'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  { preset: 'clock' }, { preset: 'steps' }, { preset: 'battery' }, { preset: 'day' }, { preset: 'month' }, { preset: 'weekday' }, { preset: 'temp' }, { preset: 'clock' },
  { script: `const n = project.elements.length; ['Hour','Colon','Minute'].forEach((nm,i)=>{ project.elements[n-3+i].name = nm + ' Aod'; }); return 1` },
  { remove: 'Colon Aod' },
  wrap(reelsJS, `
    const H1 = project.elements.find((q) => q.name === 'Hour'), M1 = project.elements.find((q) => q.name === 'Minute');
    for (const [e, x] of [[H1, 38], [M1, 194]]) { e.glyph = null; e.images = names.slice(); e.space = 0; e.zero = 1; e.x = x; e.y = 110; e.show = 'normal'; }
    project.elements = project.elements.filter((q) => q.name !== 'Colon'); return 1`),
  wrap(spinJS, `const e = await addElement('IMG_ANIM', { frames: names, fps: 8, animPrefix: 'spin', repeat: 0 }); e.name = 'Reels spinning'; e.frames = names; e.x = 38; e.y = 110; e.show = 'normal'; return names.length`),
  wrap(glareJS, `const e = await addElement('IMG', { src: names[0] }); e.name = 'Glass glare'; e.src = names[0]; e.x = 26; e.y = 96; e.show = 'normal'; return 1`),
  wrap(bulbJS, `const e = await addElement('IMG_ANIM', { frames: names, fps: 3, animPrefix: 'bulbs', repeat: 0 }); e.name = 'Marquee bulbs'; e.frames = names; e.x = 38; e.y = 14; e.show = 'normal'; return names.length`),
  wrap(leverJS, `const e = await addElement('IMG_ANIM', { frames: names, fps: 8, animPrefix: 'lever', repeat: 0 }); e.name = 'Lever'; e.frames = names; e.x = 332; e.y = 90; e.show = 'normal'; return names.length`),
];
const led = (font, size, color) => ({ font, size, fill: 'solid', color: color || '#ff3b2f', shadowColor: '#ff2a1a', shadowX: 0, shadowY: 0, shadowBlur: 6 });
steps.push(
  { edit: 'Steps', set: { x: 38, y: 268, alignH: 'LEFT' }, glyph: led(F7, 30) },
  { edit: 'Battery', set: { x: 242, y: 268 }, glyph: led(F7, 30) },
  { edit: 'Day', set: { x: 38, y: 330, zero: 1, space: -3 }, glyph: led(F7, 30) },
  { edit: 'Month', set: { x: 100, y: 330, zero: 1, space: -3 }, glyph: led(F7, 30) },
  { edit: 'Weekday', set: { x: 186, y: 330 }, glyph: led(F14, 30) },
  { edit: 'Temperature', set: { x: 288, y: 334, alignH: 'LEFT', hSpace: -3 }, glyph: led(F7, 24) },
  { edit: 'Hour Aod', set: { x: 70, y: 120, show: 'aod', zero: 1 }, glyph: { font: F7, size: 100, fill: 'solid', color: '#8a3a3a' } },
  { edit: 'Minute Aod', set: { x: 70, y: 260, show: 'aod', zero: 1 }, glyph: { font: F7, size: 100, fill: 'solid', color: '#8a3a3a' } },
);
fs.writeFileSync('recipe.json', JSON.stringify({ name: 'Slot Time', device: 'bip-6', font: F7, description: 'A slot machine that tells the time: cream reels with red digits, chrome and gold, blinking marquee, a lever that pulls and reels that spin and land on the current time.', preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/slot-time', steps }, null, 1));
