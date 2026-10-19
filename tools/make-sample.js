'use strict';
// Build a small, self-contained sample watchface (used by `npm run sample`).
//
// It writes two things into samples/sample-digital/:
//   1. a designer project (sample-digital.wfproj.json + images/) you can open
//      from the app, and
//   2. a ready Zeus CLI project (app.json, app.js, watchface/, assets/) built
//      from the same model, so `zeus preview` / `zeus build` work out of the box.
//
// The digit images are drawn here with a tiny 5x7 bitmap font so the sample
// needs no external assets and no canvas.
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const { DEVICES, deviceByKey } = require('../core/devices');
const { generateWatchface, generateAppJson, generateAppJs, generateProjectReadme } = require('../core/codegen');
const { appIconPng } = require('../core/icon');

const FONT = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00110', '00110'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '\u00b0': ['01100', '10010', '01100', '00000', '00000', '00000', '00000'],
};

function glyphPng(ch, scale = 10, color = [255, 255, 255, 255]) {
  const rows = FONT[ch] || FONT['.'];
  const w = 5, h = 7, pad = 1;
  const png = new PNG({ width: (w + pad * 2) * scale, height: (h + pad * 2) * scale });
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const gx = Math.floor(x / scale) - pad;
      const gy = Math.floor(y / scale) - pad;
      const on = gx >= 0 && gx < w && gy >= 0 && gy < h && rows[gy][gx] === '1';
      const i = (png.width * y + x) << 2;
      png.data[i] = color[0]; png.data[i + 1] = color[1];
      png.data[i + 2] = color[2]; png.data[i + 3] = on ? color[3] : 0;
    }
  }
  return PNG.sync.write(png);
}

function el(kind, patch) {
  return {
    id: `el${Math.random().toString(36).slice(2, 8)}`,
    kind, x: 0, y: 0, show: 'both', visible: true, locked: false, group: null, alpha: 255,
    ...patch,
  };
}

function build(target = 'gtr-3-pro') {
  const d = deviceByKey(target) || DEVICES[0];
  const W = d.w, H = d.h;
  const images = [];
  const addGlyphs = (prefix, chars) => chars.map((ch) => {
    const name = `${prefix}_${ch.charCodeAt(0).toString(16)}.png`;
    images.push({ name, data: glyphPng(ch) });
    return name;
  });
  const time = addGlyphs('time', '0123456789'.split(''));
  const colon = addGlyphs('colon', [':'])[0];
  const data = addGlyphs('font_2', '0123456789'.split(''));
  const deg = addGlyphs('unit', ['\u00b0'])[0];

  const cw = 60, ch = 90, gap = 14;
  const total = cw * 4 + gap * 2;
  const x0 = Math.round((W - total) / 2);
  const yTop = Math.round(H * 0.3);

  const elements = [
    el('FILL_RECT', { name: 'Background', x: 0, y: 0, w: W, h: H, color: '#000000', radius: 0, locked: true }),
    el('IMG_TIME', { name: 'Hour', part: 'hour', images: time, zero: 0, space: 0, x: x0, y: yTop }),
    el('IMG', { name: 'Colon', src: colon, x: x0 + cw * 2 + gap, y: yTop + Math.round((ch - cw) / 2) }),
    el('IMG_TIME', { name: 'Minute', part: 'minute', images: time, zero: 0, space: 0, x: x0 + cw * 2 + gap * 2, y: yTop }),
    el('TEXT_IMG', { name: 'Steps', dataType: 'STEP', images: data, hSpace: 2, alignH: 'LEFT', unit: '', show: 'normal', x: Math.round(W / 2) - cw * 2, y: Math.round(H * 0.62) }),
    el('TEXT_IMG', { name: 'Temperature', dataType: 'WEATHER_CURRENT', images: data, hSpace: 2, alignH: 'LEFT', unit: deg, show: 'normal', x: Math.round(W / 2) - cw, y: Math.round(H * 0.74) }),
    el('ARC_PROGRESS', { name: 'Step arc', dataType: 'STEP', show: 'normal', centerX: Math.round(W / 2), centerY: Math.round(H / 2), radius: Math.round(Math.min(W, H) * 0.4), startAngle: -220, endAngle: 40, lineWidth: 10, color: '#34e073' }),
    // live text: rendered by the watch with a real font file, not glyph images
    el('TEXT', { name: 'Steps label', text: 'STEPS', color: '#9fb0c8', size: 30, box: 'wh', w: 220, h: 44, x: Math.round(W / 2) - 110, y: Math.round(H * 0.86), fontFile: 'Orbitron-Bold.ttf', weight: 700, show: 'normal' }),
  ];
  return { elements, images, d, W, H };
}

function writeSample() {
  const { elements, images, d, W, H } = build();
  const project = {
    version: 1,
    name: 'Sample Digital',
    device: d.target,
    appId: 2000001,
    vender: 'dialcraft',
    description: 'Sample watchface generated by Dialcraft',
    font: 'Orbitron',
    groups: {},
    elements,
  };

  const out = path.join(__dirname, '..', 'samples', 'sample-digital');
  const imgDir = path.join(out, 'images');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(imgDir, { recursive: true });
  for (const im of images) fs.writeFileSync(path.join(imgDir, im.name), im.data);
  fs.writeFileSync(path.join(out, 'sample-digital.wfproj.json'), JSON.stringify(project, null, 2) + '\n');

  // the font a Text layer renders with (bundled, so it is not part of project.fonts)
  const fontName = 'Orbitron-Bold.ttf';
  const fontBytes = fs.readFileSync(path.join(__dirname, '..', 'assets', 'fonts', fontName));

  // a ready Zeus CLI project next to the designer project
  const zeusDir = path.join(out, 'zeus');
  const zeusAssets = path.join(zeusDir, 'assets', d.assetDir);
  const assetDir = path.join(zeusAssets, 'images');
  const zeusFontDir = path.join(zeusAssets, 'fonts');
  fs.mkdirSync(assetDir, { recursive: true });
  fs.mkdirSync(zeusFontDir, { recursive: true });
  for (const im of images) fs.writeFileSync(path.join(assetDir, im.name), im.data);
  // app icon: app.json points at images/preview.png and zeus build fails without it
  fs.writeFileSync(path.join(assetDir, 'preview.png'), appIconPng(null));
  fs.writeFileSync(path.join(zeusFontDir, fontName), fontBytes);
  fs.copyFileSync(path.join(__dirname, '..', 'assets', 'fonts', 'FONTS.md'), path.join(zeusFontDir, 'FONTS-LICENSES.md'));
  const wfDir = path.join(zeusDir, 'watchface', d.target);
  fs.mkdirSync(wfDir, { recursive: true });
  const gen = generateWatchface(project, d);
  fs.writeFileSync(path.join(wfDir, 'index.js'), gen.code);
  fs.writeFileSync(path.join(zeusDir, 'app.json'), generateAppJson(project, d, { appId: project.appId, vender: project.vender }));
  fs.writeFileSync(path.join(zeusDir, 'app.js'), generateAppJs());
  fs.writeFileSync(path.join(zeusDir, 'README.md'), generateProjectReadme(project, d));
  fs.writeFileSync(path.join(zeusDir, '.gitignore'), 'node_modules/\ndist/\n.DS_Store\n');

  console.log(`sample written to ${out}`);
  console.log(`  designer project: sample-digital.wfproj.json + ${images.length} images`);
  console.log(`  Zeus project:     zeus/ (${d.target} ${W}x${H}, fonts/${fontName})`);
  if (gen.warnings.length) console.log(`  warnings:\n   - ${gen.warnings.join('\n   - ')}`);
}

writeSample();
