const fs = require('fs');
const frameScript = (kind) => `
const W = dev().w, H = dev().h;
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const names = [];
const save = async (prefix, i, c) => { names.push(addProjectImage('anim/' + prefix + '_' + i + '.png', c, {}).name); };
const KIND = ${JSON.stringify(kind)};
if (KIND === 'rain') {
  // skyline (static) + rain streaks that wrap every 8 frames
  const bld = []; let x = -10;
  while (x < W) { const w = 28 + rnd() * 40, h = 50 + rnd() * 110; bld.push({ x, w, h, win: rnd() }); x += w + 2; }
  const streaks = Array.from({ length: 46 }, () => ({ x: rnd() * W, y: rnd() * H, l: 14 + rnd() * 22, a: 0.18 + rnd() * 0.3 }));
  for (let k = 0; k < 8; k++) {
    const c = mk(), g = c.getContext('2d');
    for (const b of bld) {
      g.fillStyle = '#07060f'; g.fillRect(b.x, H - b.h, b.w, b.h);
      g.strokeStyle = b.win > 0.5 ? '#ff2bd6' : '#18e6ff'; g.globalAlpha = 0.55; g.lineWidth = 2;
      g.beginPath(); g.moveTo(b.x, H - b.h); g.lineTo(b.x + b.w, H - b.h); g.stroke(); g.globalAlpha = 1;
      const wr = new Function('return 0'); 
      for (let wy = H - b.h + 10; wy < H - 6; wy += 12) for (let wx = b.x + 5; wx < b.x + b.w - 6; wx += 9) {
        const v = Math.sin(wx * 12.9 + wy * 78.2 + b.x) * 43758.5; if (v - Math.floor(v) > 0.72) { g.fillStyle = (v * 7 % 1) > 0.5 ? '#18e6ff' : '#ff2bd6'; g.globalAlpha = 0.45; g.fillRect(wx, wy, 4, 5); g.globalAlpha = 1; }
      }
    }
    g.lineWidth = 1.5; g.lineCap = 'round';
    for (const s of streaks) {
      const y = (s.y + k * (H / 8)) % H;
      g.strokeStyle = '#7fdcff'; g.globalAlpha = s.a;
      g.beginPath(); g.moveTo(s.x, y); g.lineTo(s.x - s.l * 0.12, y + s.l); g.stroke();
    }
    g.globalAlpha = 1;
    await save('cp_rain', k, c);
  }
}
if (KIND === 'glitch') {
  const N = 40;
  for (let k = 0; k < N; k++) {
    const c = mk(), g = c.getContext('2d');
    const on = (k >= 30 && k <= 35) || k === 22;
    if (on) {
      const bars = 5 + Math.floor(rnd() * 5);
      for (let i = 0; i < bars; i++) {
        const y = 90 + rnd() * 250, h = 3 + rnd() * 14, x = rnd() * 220, w = 60 + rnd() * 170;
        g.globalAlpha = 0.55 + rnd() * 0.4;
        g.fillStyle = rnd() > 0.5 ? '#18e6ff' : '#ff2bd6'; g.fillRect(x + (rnd() - 0.5) * 24, y, w, h);
        g.fillStyle = '#ffffff'; g.globalAlpha = 0.5; g.fillRect(x + 8, y + h / 3, w * 0.35, Math.max(1, h / 4));
      }
      g.globalAlpha = 0.35; g.fillStyle = '#000'; g.fillRect(0, 200 + rnd() * 60, W, 6 + rnd() * 10);
    }
    await save('cp_glitch', k, c);
  }
}
if (KIND === 'laser') {
  const N = 24;
  for (let k = 0; k < N; k++) {
    const c = mk(), g = c.getContext('2d');
    const y = 4 + (H - 8) * k / (N - 1);
    const grd = g.createLinearGradient(0, y - 22, 0, y + 22);
    grd.addColorStop(0, 'rgba(255,43,214,0)'); grd.addColorStop(0.5, 'rgba(255,43,214,0.22)'); grd.addColorStop(1, 'rgba(255,43,214,0)');
    g.fillStyle = grd; g.fillRect(0, y - 22, W, 44);
    const lg = g.createLinearGradient(0, 0, W, 0);
    lg.addColorStop(0, 'rgba(255,43,214,0)'); lg.addColorStop(0.2, '#ff2bd6'); lg.addColorStop(0.8, '#ff2bd6'); lg.addColorStop(1, 'rgba(255,43,214,0)');
    g.fillStyle = lg; g.fillRect(0, y - 1, W, 2);
    await save('cp_laser', k, c);
  }
}
await loadAllImages();
return names;
`;
const anim = (kind, name, prefix, fps) => ({ script: `${frameScript(kind)}`.replace('return names;', `const e = await addElement('IMG_ANIM', { x: 0, y: 0, w: dev().w, h: dev().h, frames: names, fps: ${fps}, animPrefix: '${prefix}', repeat: 0, show: 'normal' }); e.name = '${name}'; e.frames = names; e.x = 0; e.y = 0; return names.length;`) });
const dig = (n, x, y, color, show, size) => ({ edit: n, set: { x, y, show }, glyph: { color, size } });
const recipe = {
  name: 'Glitch Cyberpunk', device: 'bip-6', font: 'Orbitron',
  description: 'Neon glitching digits with chromatic split, rain over a city skyline and a scanning laser.',
  preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/glitch-cyberpunk',
  steps: [
    { preset: 'bg' },
    anim('rain', 'City rain', 'cp_rain', 8),
    { preset: 'clock' }, { preset: 'clock' }, { preset: 'clock' }, { preset: 'clock' },
    { preset: 'weekday' }, { preset: 'steps' },
    anim('laser', 'Laser', 'cp_laser', 12),
    anim('glitch', 'Glitch', 'cp_glitch', 12),
  ],
};
fs.writeFileSync('recipe-base.json', JSON.stringify(recipe, null, 1));
