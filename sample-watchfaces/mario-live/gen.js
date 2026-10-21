const fs = require('fs');
const lib = fs.readFileSync(__dirname + '/sprites.js', 'utf8');

// ---------- scenes, tiles and sprites (the same pictures the watch loads) ----------
const scenesJS = lib + `
names.push(addProjectImage('tiles/scene_d.png', scene('d'), {}).name);
names.push(addProjectImage('tiles/scene_n.png', scene('n'), {}).name);
`;
const tilesJS = lib + `
const add = (n, c) => names.push(addProjectImage('tiles/' + n + '.png', c, {}).name);
for (const t of ['d', 'n']) { add('brick_' + t, brickBlock(t)); add('pit_' + t, pit(t)); for (let f = 0; f < 2; f++) add('goomba_' + t + '_' + f, goombaImg(t, f, false)); add('goomba_' + t + '_f', goombaImg(t, 0, true)); }
for (let k = 0; k < 3; k++) add('q' + k, qBlock(k));
add('qu', usedBlock()); add('pipe1', pipe(1)); add('pipe2', pipe(2));
for (const k of ['s', 'r1', 'r2', 'j']) add('mario_' + k, marioImg(k));
for (let k = 0; k < 4; k++) add('coin' + k, coinImg(k));
`;
const demoJS = (t) => lib + `names.push(addProjectImage('demo_${t}.png', demo('${t}'), {}).name);`;

const wrap = (body, tail) => ({ script: `${body}\nawait loadAllImages();\n${tail}` });
const tag = (suffix) => ({ script: `const n = project.elements.length; for (const i of [n-3,n-2,n-1]) project.elements[i].name += ' ${suffix}'; return 1` });
const group = (id, label, list) => ({ script: `project.groups = project.groups || {}; project.groups.${id} = '${label}'; let n = 0; for (const nm of ${JSON.stringify(list)}) { const e = project.elements.find((x) => x.name === nm); if (e) { e.group = '${id}'; n++ } } return n` });

const F = 'Press Start 2P';
const hud = (size, bw) => ({ font: F, size, fill: 'solid', color: '#ffffff', borderColor: '#000000', borderWidth: bw });
const dim = { font: F, fill: 'solid', color: '#6a5a10' };

const build = (night) => {
  const T = night ? 'n' : 'd';
  const steps = [
    { preset: 'bg' },
    wrap(scenesJS, `const e = await addElement('IMG', { src: names[${night ? 1 : 0}] }); e.name = 'Level scene'; e.src = names[${night ? 1 : 0}]; e.handle = 'scene'; e.x = 0; e.y = 0; e.show = 'normal'; return 2`),
    wrap(demoJS(T), `const e = await addElement('IMG', { src: names[0] }); e.name = 'Demo still'; e.src = names[0]; e.previewOnly = true; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
    wrap(tilesJS, 'return names.length'),
    { preset: 'clock' }, tag('Main'), { preset: 'clock' }, tag('Aod'),
    { preset: 'battery' },
  ];
  steps.push(
    { script: `project.groups = project.groups || {}; for (const e of project.elements) { if (/ Aod$/.test(e.name) && e.group) project.groups[e.group] = 'Clock AOD' } return 1` },
    { edit: 'Hour Main', set: { x: 40, y: 52, show: 'normal', zero: 1 }, glyph: hud(68, 4) },
    { edit: 'Colon Main', set: { x: 181, y: 60, show: 'normal' }, glyph: hud(68, 4) },
    { edit: 'Minute Main', set: { x: 214, y: 52, show: 'normal', zero: 1 }, glyph: hud(68, 4) },
    { edit: 'Hour Aod', set: { x: 40, y: 193, show: 'aod', zero: 1 }, glyph: { ...dim, size: 68 } },
    { edit: 'Colon Aod', set: { x: 181, y: 201, show: 'aod' }, glyph: { ...dim, size: 68 } },
    { edit: 'Minute Aod', set: { x: 214, y: 193, show: 'aod', zero: 1 }, glyph: { ...dim, size: 68 } },
    { edit: 'Battery', set: { x: 170, y: 12, show: 'normal', alignH: 'LEFT' }, glyph: hud(28, 4) },
    group('gClock', 'Clock', ['Minute Main', 'Colon Main', 'Hour Main']),
  );
  return steps;
};

const userImports = "import { Time as DCTime } from '@zos/sensor'";
const userCode = fs.readFileSync(__dirname + '/game.js', 'utf8');
const description = 'An AI plays Super-Mario-style platformer screens live on the watch: Mario runs, jumps pits and pipes, stomps Goombas and bumps ? blocks, then walks into a fresh screen. Overworld in daylight, underground from 19:00 to 07:00. Big time on top, battery as a mushroom.';
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: 'Mario Live', device: 'bip-6', font: F, optimizePng: 32, description,
  preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/mario-live', userImports, userCode, steps: build(false) }, null, 1));
// the same face with the underground scene, only to look at (nothing is saved or exported)
fs.writeFileSync(__dirname + '/recipe-night.json', JSON.stringify({ name: 'Mario Live night', device: 'bip-6', font: F, optimizePng: 32, preview: 'preview-night.png', steps: build(true) }, null, 1));
