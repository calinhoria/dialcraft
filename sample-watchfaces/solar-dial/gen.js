'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const repo = fs.existsSync(path.join(root, 'tools/face-cli.js')) ? root : process.cwd();
const skill = path.join(repo, '.claude/skills/create-amazfit-watchface/examples/animated');
const destination = process.argv.slice(2).find((arg) => !arg.startsWith('--')) || path.join(__dirname, 'recipe.json');
const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');
const base64 = (file) => fs.readFileSync(file).toString('base64');
const artNames = ['solar-dial.png', 'sun.png', 'sunrise.png', 'sunset.png', 'clock-glyphs.png', 'date-glyphs.png'];
const art = Object.fromEntries(artNames.map((name) => [name, base64(path.join(__dirname, 'art', name))]));
const { solarDialState, solarDialPoint } = require(path.join(repo, 'core/solar.js'));
const orbit = [solarDialState.toString(), solarDialPoint.toString(), read('orbit.js')].join('\n');
const recipe = {
  name: 'Solar Dial',
  device: 'bip-6',
  language: 'en-US',
  description: 'A 24-hour solar dial with a moving sun and moon, a phase-colored sky, twilight markers, and local sunrise and sunset.',
  userImports: "import * as SolarSensors from '@zos/sensor'",
  userCode: '{\n' + orbit + '\n' + read('watch.js') + '\n}',
  previewScene: {
    clock: { h: 16, m: 25, s: 0 },
    date: { year: 2026, month: 4, day: 21, weekday: 2 },
    data: { SUN_RISE: '07:02', SUN_SET: '17:43' },
  },
  steps: [{
    script: [
      fs.readFileSync(path.join(skill, 'kit.js'), 'utf8'),
      'const FONT_BASE64 = ' + JSON.stringify(base64(path.join(skill, 'fonts/inter-500.ttf'))) + ';',
      'const ART = ' + JSON.stringify(art) + ';',
      orbit,
      read('layout.js'),
    ].join('\n'),
  }],
  preview: 'preview.png',
  previewAod: 'preview-aod.png',
  save: 'project',
  out: 'out/solar-dial',
  build: process.argv.includes('--build'),
};
fs.writeFileSync(destination, JSON.stringify(recipe, null, 2) + '\n');
