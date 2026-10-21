const fs = require('fs');
const lib = fs.readFileSync(__dirname + '/lib.js', 'utf8');
const base = `
const W = dev().w, H = dev().h;
const names = [];
`;
const wrap = (body, tail) => ({ script: `${base}${lib}\n${body}\nawait loadAllImages();\n${tail}` });
const last = (n, suffix) => ({ script: `const n = project.elements.length; for (let i = n - ${n}; i < n; i++) project.elements[i].name += ' ${suffix}'; return ${n}` });
const nameLast = (name, dataType) => ({ script: `const e = project.elements[project.elements.length - 1]; e.name = '${name}'; ${dataType ? `e.dataType = '${dataType}';` : ''} return e.name` });
const group = (id, label, list) => ({ script: `project.groups = project.groups || {}; project.groups.${id} = '${label}'; let n = 0; for (const nm of ${JSON.stringify(list)}) { const e = project.elements.find((x) => x.name === nm); if (e) { e.group = '${id}'; n++ } } return n` });

const F = 'Bebas Neue';
const C = { orange: '#ff9f33', peach: '#fda97d', pink: '#dd83b9', purple: '#9a7bd9', tan: '#bf8b75', black: '#000000' };
const g = (color, size) => ({ font: F, fill: 'solid', color, size });
const dim = { font: F, fill: 'solid', color: '#7a4f3a' };

const build = (themeIdx) => {
  const steps = [{ preset: 'bg' },
    wrap(`names.push(addProjectImage('lcars_frame.png', await frame(), {}).name);`, `const e = await addElement('IMG', { src: names[0] }); e.name = 'LCARS frame'; e.src = names[0]; e.x = 0; e.y = 0; e.show = 'normal'; return 1`),
    wrap(`for (let i = 0; i < 29; i++) names.push(addProjectImage('weather/w_' + i + '.png', wIcon(i), {}).name);`,
      `const e = await addElement('IMG_LEVEL', { dataType: 'WEATHER', images: names, w: 0, h: 0 }); e.name = 'Weather icon'; e.images = names; e.dataType = 'WEATHER'; e.x = 312; e.y = 79; e.show = 'normal'; return 29`),
  ];
  for (const [nm, col, type, x] of [['Move bar', 'pink', 'CAL', 30], ['Exercise bar', 'purple', 'FAT_BURNING', 56], ['Stand bar', 'orange', 'STAND', 83]]) {
    steps.push(wrap(`for (let l = 0; l <= 10; l++) names.push(addProjectImage('bars/${col}_' + l + '.png', barImg(ROLE.${col}, l), {}).name);`,
      `const e = await addElement('IMG_LEVEL', { dataType: '${type}', images: names, w: 0, h: 0 }); e.name = '${nm}'; e.images = names; e.dataType = '${type}'; e.x = ${x}; e.y = 296; e.show = 'normal'; return 11`));
  }
  steps.push(
    { preset: 'clocksec' }, last(5, 'Main'), { preset: 'clock' }, last(3, 'Aod'),
    { preset: 'weekday' }, { preset: 'day' }, { preset: 'month' },
    { preset: 'temp' }, nameLast('Current', 'WEATHER_CURRENT'), { preset: 'temp' }, nameLast('High temp', 'WEATHER_HIGH'), { preset: 'temp' }, nameLast('Low temp', 'WEATHER_LOW'),
    { preset: 'datatext' }, nameLast('Sunrise', 'SUN_RISE'), { preset: 'datatext' }, nameLast('Sunset', 'SUN_SET'), { preset: 'datatext' }, nameLast('Humidity', 'HUMIDITY'),
    { preset: 'steps' }, { preset: 'hr' }, { preset: 'battery' },
    { remove: 'Colon Aod' }, { remove: 'Colon 2 Main' },
  );
  steps.push(
    // time and seconds
    { edit: 'Hour Main', set: { x: 25, y: 195, show: 'normal', zero: 1, space: -12 }, glyph: g(C.peach, 122) },
    { edit: 'Colon Main', set: { x: 131, y: 209, show: 'normal' }, glyph: g(C.peach, 122) },
    { edit: 'Minute Main', set: { x: 163, y: 195, show: 'normal', zero: 1, space: -12 }, glyph: g(C.peach, 122) },
    { edit: 'Second Main', set: { x: 299, y: 217, show: 'normal', zero: 1, space: 2 }, glyph: g(C.purple, 66) },
    { edit: 'Hour Aod', set: { x: 129, y: 92, show: 'aod', zero: 1 }, glyph: { ...dim, size: 150 } },
    { edit: 'Minute Aod', set: { x: 129, y: 242, show: 'aod', zero: 1 }, glyph: { ...dim, size: 150 } },
    // weather
    { edit: 'Current', set: { x: 121, y: 64, show: 'normal', alignH: 'LEFT', hSpace: -6 }, glyph: g(C.pink, 24) },
    { edit: 'High temp', set: { x: 121, y: 89, show: 'normal', alignH: 'LEFT', hSpace: -6 }, glyph: g(C.peach, 24) },
    { edit: 'Low temp', set: { x: 121, y: 113, show: 'normal', alignH: 'LEFT', hSpace: -6 }, glyph: g(C.purple, 24) },
    { edit: 'Sunrise', set: { x: 196, y: 67, show: 'normal', alignH: 'RIGHT', hSpace: -6 }, glyph: g(C.peach, 22) },
    { edit: 'Sunset', set: { x: 196, y: 91, show: 'normal', alignH: 'RIGHT', hSpace: -6 }, glyph: g(C.peach, 22) },
    { edit: 'Humidity', set: { x: 196, y: 111, show: 'normal', alignH: 'RIGHT', hSpace: -6 }, glyph: g(C.peach, 22) },
    // readings next to their label boxes
    { edit: 'Steps', set: { x: 112, y: 298, show: 'normal', alignH: 'RIGHT', hSpace: -7 }, glyph: g(C.pink, 26) },
    { edit: 'Heart rate', set: { x: 130, y: 332, show: 'normal', alignH: 'RIGHT', hSpace: -7, unit: '' }, glyph: g(C.tan, 26) },
    { edit: 'Battery', set: { x: 130, y: 366, show: 'normal', alignH: 'RIGHT', hSpace: -7, unit: '' }, glyph: g(C.purple, 26) },
    // date box: 12 SEP over MON, black on orange
    { edit: 'Day', set: { x: 291, y: 311, show: 'normal', zero: 0, space: -7 }, glyph: g(C.black, 30) },
    { edit: 'Month', set: { x: 319, y: 311, show: 'normal' }, glyph: g(C.black, 30) },
    { edit: 'Weekday', set: { x: 306, y: 342, show: 'normal' }, glyph: g(C.black, 30) },
    { script: `const e = project.elements.find((x) => x.name === 'Month'); e.isCharacter = true; e.part = 'month'; e.images = await genLabelSet(e, 'month'); return e.images.length` },
    { script: `let n = 0; for (const nm of ['Sunrise', 'Sunset']) { const e = project.elements.find((x) => x.name === nm); e.dot = await genUnit('scolon', ':', { style: digitStyleOf(e.images) }); n++ } return n` },
    { add: 'TAP', name: 'Tap: next colour theme', patch: { action: 'theme' }, set: { show: 'normal', x: 293, y: 21, w: 65, h: 31 } },
    { script: `document.getElementById('btnPruneImages').click(); return project.images.length + ' images after pruning'` },
  );
  steps.push(
    wrap(`
const orig = project.images.map((i) => i.name).filter((n) => !/__t\\d+\\.png$/.test(n));
const done = new Set();
for (let k = 0; k < THEMES.length; k++) for (const n of orig) {
  const src = imageToCanvas(n); if (!src) continue;
  const cp = mkc(src.cv.width, src.cv.height); cp.getContext('2d').drawImage(src.cv, 0, 0);
  if (!recolorImage(cp, THEMES[k].roles)) continue;
  addProjectImage(themedName(n, k + 1), cp, {}); done.add(n);
}
project.themes = { accent: ROLE.orange, list: THEMES.map((t) => ({ name: t.name, color: t.accent })), recolored: [...done] };`, `return project.images.length + ' images, ' + project.themes.recolored.length + ' themed'`),
    group('gDate', 'Date', ['Day', 'Month', 'Weekday']),
    group('gWeather', 'Weather', ['Current', 'High temp', 'Low temp', 'Sunrise', 'Sunset', 'Humidity']),
    group('gActivity', 'Activity bars', ['Move bar', 'Exercise bar', 'Stand bar']),
    group('gReadings', 'Readings', ['Steps', 'Heart rate', 'Battery']),
    { script: `project.groups = project.groups || {}; for (const e of project.elements) { if (/ Aod$/.test(e.name) && e.group) project.groups[e.group] = 'Clock AOD' } return 1` },
  );
  if (themeIdx) steps.push({ script: `themeIdx = ${themeIdx}; render(); return themeIdx` });
  return steps;
};

const common = { device: 'bip-6', font: F, optimizePng: 32 };
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: 'LCARS Stardate', ...common,
  description: 'A starship-console face in LCARS style: weather table, sunrise and sunset, a huge time with seconds, three activity bars, steps, heart rate, battery and the date in colour-blocked panels. Tap the LCARS tab to cycle five colour themes: Blue Alert, Red Alert, Sickbay Green, Command Gold and Violet.',
  preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/lcars-stardate', steps: build(0) }, null, 1));
for (let k = 1; k <= 5; k++) fs.writeFileSync(__dirname + `/recipe-theme${k}.json`, JSON.stringify({ name: 'LCARS Stardate theme ' + k, ...common, preview: `preview-theme${k}.png`, steps: build(k) }, null, 1));
