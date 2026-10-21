const fs = require('fs');
const base = `
const W = dev().w, H = dev().h;
const names = [];
const TAU = Math.PI * 2;
try { await ensureFont('Bebas Neue', 700); await document.fonts.load('700 20px "Bebas Neue"', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'); } catch (e) {}
`;
const ship = fs.readFileSync(__dirname + '/ship.js', 'utf8').replace(/^const TAU = .*\n/m, '');
const panels = fs.readFileSync(__dirname + '/panels.js', 'utf8');

const wrap = (body, tail) => ({ script: `${base}${body}\nawait loadAllImages();\n${tail}` });
const anim = (name, prefix, fps, x, y) => `const e = await addElement('IMG_ANIM', { frames: names, fps: ${fps}, animPrefix: '${prefix}', repeat: 0 }); e.name = '${name}'; e.frames = names; e.x = ${x}; e.y = ${y}; e.show = 'normal'; return names.length`;
const tag = (suffix) => ({ script: `const n = project.elements.length; for (const i of [n-3,n-2,n-1]) project.elements[i].name += ' ${suffix}'; return 1` });
const group = (id, label, list) => ({ script: `project.groups = project.groups || {}; project.groups.${id} = '${label}'; let n = 0; for (const nm of ${JSON.stringify(list)}) { const e = project.elements.find((x) => x.name === nm); if (e) { e.group = '${id}'; n++ } } return n` });
const push = (arr, prefix) => `${arr}.forEach((c, i) => names.push(addProjectImage('anim/${prefix}_' + i + '.png', c, {}).name));`;

const F = 'Bebas Neue';
const org = { font: F, fill: 'solid', color: '#ff9540' };
const val = { font: F, fill: 'solid', color: '#f0c8a8' };
const dim = { font: F, fill: 'solid', color: '#6b3f12' };
const BX = 200, BY = 180, BL = 172;   // power bar

const steps = [{ preset: 'bg' },
  wrap(panels + `await frame();`, `const e = await addElement('IMG', { src: names[0] }); e.name = 'LCARS frame'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
  wrap(ship + `
const NF = 16;
for (let k = 0; k < NF; k++) names.push(addProjectImage('anim/ship_' + k + '.png', frameCanvas(k, NF), {}).name);`, anim('Starship window', 'ship', 12, 86, 230)),
  wrap(panels + push('levels(146, 26, 24, [COL.purple, COL.gold, COL.violet], 12, 0)', 'sig'), anim('Date signal', 'sig', 6, 230, 132)),
  wrap(panels + push('vlevels(46, 76, 8, [COL.gold, COL.orange], 8)', 'met'), anim('Time meters', 'met', 8, 328, 40)),
  wrap(panels + push('ticker(270, 14, 12)', 'tick'), anim('Data ticker', 'tick', 6, 96, 339)),
  wrap(panels + push('buttons(46, 104, 8)', 'btn'), anim('Button grid', 'btn', 2, 23, 236)),
  { add: 'BAR', name: 'Power bar', patch: { dataType: 'BATTERY' }, set: { x: BX, y: BY, length: BL, lineWidth: 14, color: '#fbb03b', rounded: true, show: 'normal' } },
  wrap(panels + push(`shimmer(${BL}, 14, 10)`, 'shim'), anim('Power shimmer', 'shim', 10, BX, BY)),
  { preset: 'battery' },
  { preset: 'clock' }, tag('Main'), { preset: 'clock' }, tag('Aod'),
  { preset: 'weekday' }, { preset: 'day' },
  { preset: 'steps' }, { preset: 'hr' }, { preset: 'temp' },
  { remove: 'Colon Aod' },
];
steps.push(
  { script: `project.groups = project.groups || {}; for (const e of project.elements) { if (/ Aod$/.test(e.name) && e.group) project.groups[e.group] = 'Clock AOD' } return 1` },
  { edit: 'Hour Main', set: { x: 88, y: 34, show: 'normal', zero: 1 }, glyph: { ...org, size: 112 } },
  { edit: 'Colon Main', set: { x: 198, y: 48, show: 'normal' }, glyph: { ...org, size: 112 } },
  { edit: 'Minute Main', set: { x: 226, y: 34, show: 'normal', zero: 1 }, glyph: { ...org, size: 112 } },
  { edit: 'Hour Aod', set: { x: 128, y: 92, show: 'aod', zero: 1 }, glyph: { ...dim, size: 150 } },
  { edit: 'Minute Aod', set: { x: 128, y: 242, show: 'aod', zero: 1 }, glyph: { ...dim, size: 150 } },
  { edit: 'Weekday', set: { x: 90, y: 122, show: 'normal' }, glyph: { ...val, color: '#cf74cf', size: 40 } },
  { edit: 'Day', set: { x: 160, y: 127, show: 'normal', zero: 1 }, glyph: { ...val, size: 40 } },
  { edit: 'Battery', set: { x: 94, y: 170, show: 'normal', alignH: 'LEFT' }, glyph: { ...val, size: 40 } },
  { edit: 'Steps', set: { x: 94, y: 384, show: 'normal', alignH: 'LEFT' }, glyph: { ...val, size: 38 } },
  { edit: 'Heart rate', set: { x: 220, y: 384, show: 'normal', alignH: 'LEFT', unit: '' }, glyph: { ...val, size: 38 } },
  { edit: 'Temperature', set: { x: 302, y: 384, show: 'normal', alignH: 'LEFT' }, glyph: { ...val, size: 38 } },
  group('gDate', 'Date', ['Weekday', 'Day']),
  group('gPower', 'Power', ['Power bar', 'Power shimmer', 'Battery']),
  group('gSensors', 'Sensors', ['Steps', 'Heart rate', 'Temperature']),
  group('gActivity', 'Activity panels', ['Date signal', 'Time meters', 'Data ticker', 'Button grid']),
);
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: 'LCARS Starship', device: 'bip-6', font: F, optimizePng: 48,
  description: 'A starship console in LCARS style: elbow blocks in gold, orange and purple on black, the time, date, power, steps, heart rate and temperature in labelled panels, and a viewscreen with a 3D-rendered starship at warp. Meters, a data ticker, a button grid and a shimmering power bar keep the console busy.',
  preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/lcars-starship', steps }, null, 1));
