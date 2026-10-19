'use strict';
// Render the designer's application icon: build/icon.png (1024×1024) and, on
// macOS, build/icon.icns. electron-builder derives the Windows / Linux icons
// from the PNG.
//
//   npx electron tools/make-icon.js
//
// The artwork is drawn with the canvas API in a hidden window so it can use the
// bundled Orbitron face: a round watch on a dark squircle, an arc-progress ring,
// "10:09" (the design-spec reference time) and the editor's own pink selection
// frame around it — a watchface being designed.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'build');

function page(fontB64) {
  return `<!doctype html><meta charset="utf-8"><body style="margin:0;background:transparent">
<canvas id="c" width="1024" height="1024"></canvas>
<script>
async function draw() {
  const ff = new FontFace('Orbitron', 'url(data:font/ttf;base64,${fontB64})');
  await ff.load(); document.fonts.add(ff);
  const c = document.getElementById('c').getContext('2d');
  const S = 1024, cx = 512, cy = 512;
  // squircle tile on Apple's 824px icon grid
  const r = 186, x0 = 100, y0 = 100, w = 824;
  const tile = new Path2D();
  tile.moveTo(x0 + r, y0); tile.arcTo(x0 + w, y0, x0 + w, y0 + w, r); tile.arcTo(x0 + w, y0 + w, x0, y0 + w, r);
  tile.arcTo(x0, y0 + w, x0, y0, r); tile.arcTo(x0, y0, x0 + w, y0, r); tile.closePath();
  c.save();
  c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 40; c.shadowOffsetY = 14;
  let g = c.createLinearGradient(0, y0, 0, y0 + w);
  g.addColorStop(0, '#222b45'); g.addColorStop(1, '#0b0e18');
  c.fillStyle = g; c.fill(tile);
  c.restore();
  c.save(); c.clip(tile);
  g = c.createRadialGradient(cx, 160, 20, cx, 160, 620);
  g.addColorStop(0, 'rgba(91,140,255,.28)'); g.addColorStop(1, 'rgba(91,140,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  // strap
  const strap = (y, h) => {
    const gg = c.createLinearGradient(392, 0, 632, 0);
    gg.addColorStop(0, '#1a2031'); gg.addColorStop(.5, '#2b3349'); gg.addColorStop(1, '#1a2031');
    c.fillStyle = gg; c.beginPath(); c.roundRect(398, y, 228, h, 34); c.fill();
  };
  strap(70, 230); strap(724, 230);
  c.restore();
  // case
  c.save();
  c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 36; c.shadowOffsetY = 12;
  g = c.createLinearGradient(0, 230, 0, 794);
  g.addColorStop(0, '#59647f'); g.addColorStop(.5, '#2a3144'); g.addColorStop(1, '#151a27');
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, 282, 0, Math.PI * 2); c.fill();
  c.restore();
  // crown
  c.fillStyle = '#3b4560'; c.beginPath(); c.roundRect(784, 470, 34, 84, 10); c.fill();
  // screen
  c.fillStyle = '#04060b'; c.beginPath(); c.arc(cx, cy, 246, 0, Math.PI * 2); c.fill();
  // arc progress ring: track + value
  c.lineCap = 'round'; c.lineWidth = 24;
  c.strokeStyle = 'rgba(255,255,255,.08)';
  c.beginPath(); c.arc(cx, cy, 206, -Math.PI * 1.25, Math.PI * .25); c.stroke();
  g = c.createLinearGradient(300, 700, 720, 300);
  g.addColorStop(0, '#34e0a1'); g.addColorStop(1, '#5b8cff');
  c.strokeStyle = g;
  c.beginPath(); c.arc(cx, cy, 206, -Math.PI * 1.25, -Math.PI * .02); c.stroke();
  // the time, in the bundled digital face
  c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '700 116px Orbitron';
  c.fillText('10:09', cx, cy + 6);
  c.font = '700 34px Orbitron'; c.fillStyle = '#8fa6d8';
  c.fillText('MON 19', cx, cy + 102);
  // the editor's selection frame around the digits
  const m = { x: cx - 186, y: cy - 66, w: 372, h: 140 };
  c.strokeStyle = '#ff78dc'; c.lineWidth = 6; c.setLineDash([18, 12]);
  c.strokeRect(m.x, m.y, m.w, m.h);
  c.setLineDash([]);
  for (const [hx, hy] of [[m.x, m.y], [m.x + m.w, m.y], [m.x, m.y + m.h], [m.x + m.w, m.y + m.h]]) {
    c.fillStyle = '#04060b'; c.fillRect(hx - 13, hy - 13, 26, 26);
    c.strokeStyle = '#ff78dc'; c.lineWidth = 6; c.strokeRect(hx - 13, hy - 13, 26, 26);
  }
  return document.getElementById('c').toDataURL('image/png');
}
</script>`;
}

app.whenReady().then(async () => {
  const font = fs.readFileSync(path.join(ROOT, 'assets', 'fonts', 'Orbitron-Bold.ttf')).toString('base64');
  const win = new BrowserWindow({ show: false, width: 1024, height: 1024, webPreferences: { offscreen: true } });
  const html = path.join(app.getPath('temp'), 'awd-icon.html');
  fs.writeFileSync(html, page(font));
  await win.loadFile(html);
  const url = await win.webContents.executeJavaScript('draw()');
  fs.mkdirSync(OUT, { recursive: true });
  const png = Buffer.from(url.split(',')[1], 'base64');
  fs.writeFileSync(path.join(OUT, 'icon.png'), png);
  console.log('wrote build/icon.png');
  if (process.platform === 'darwin') {
    // iconutil wants an .iconset of the standard sizes
    const set = path.join(app.getPath('temp'), 'awd-icon.iconset');
    fs.rmSync(set, { recursive: true, force: true });
    fs.mkdirSync(set);
    const src = path.join(OUT, 'icon.png');
    for (const size of [16, 32, 128, 256, 512]) {
      for (const scale of [1, 2]) {
        const px = size * scale;
        const name = `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`;
        execFileSync('sips', ['-z', String(px), String(px), src, '--out', path.join(set, name)], { stdio: 'ignore' });
      }
    }
    execFileSync('iconutil', ['-c', 'icns', set, '-o', path.join(OUT, 'icon.icns')]);
    console.log('wrote build/icon.icns');
  }
  fs.rmSync(html, { force: true });
  app.exit(0);
}).catch((e) => { console.error(e); app.exit(1); });
