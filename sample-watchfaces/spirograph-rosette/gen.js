'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv.slice(2).find((arg) => !arg.startsWith('--')) || process.cwd();
const fontPath = '.claude/skills/create-amazfit-watchface/examples/animated/fonts/inter-500.ttf';
const font64 = fs.readFileSync(path.join(root, fontPath)).toString('base64');
const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');
const art = read('rosette.js');
const watch = read('watch.js');
const layout = read('layout.js');
const setup = [
  art,
  'const FONT_BASE64 = ' + JSON.stringify(font64) + ';',
  'const ART_CODE = ' + JSON.stringify(art) + ';',
  'const WATCH_CODE = ' + JSON.stringify(watch) + ';',
  layout,
].join('\n');
const recipe = {
  name: 'Spirograph Rosette', device: 'bip-6', language: 'en-US',
  description: 'A live two-tone canvas rosette. Tap the rosette for a new model, or tap the minutes to cycle five accent colors.',
  preview: 'preview.png', previewAod: 'preview-aod.png',
  previewScene: { clock: { h: 16, m: 25, s: 0 }, date: { year: 2025, month: 1, day: 28, weekday: 2 }, data: { BATTERY: 92 } },
  save: 'project', out: 'zeus', build: process.argv.includes('--build'),
  userImports: "import { Time } from '@zos/sensor'",
  steps: [{ script: setup }],
};
fs.writeFileSync(path.join(__dirname, 'recipe.json'), JSON.stringify(recipe, null, 2));
