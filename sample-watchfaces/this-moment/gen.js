// This Moment: after BA | AXR9800 by Bruno Amadori (Facer), on the Bip 6. Static: one scene picture (prep.py) and native layers:
// the time with the original's monoline digits (picture sets drawn by prep.py), the weekday and the day in Saira Semi Condensed.
// Positions follow the original preview through the same mapping as prep.py: X = (x - 552) * k + 195, Y = y * k, k = 450 / 1344.
const fs = require('fs');
const B = __dirname + '/build/', M = JSON.parse(fs.readFileSync(B + 'meta.json', 'utf8')), K = M.K;
const X = (x) => (x - 552) * K + 195, Y = (y) => y * K;
const pics = ['scene.png', 'colon.png', 'acolon.png', ...[...Array(10).keys()].flatMap((n) => ['d_' + n + '.png', 'a_' + n + '.png'])];
const data = Object.fromEntries(pics.map((f) => [f, fs.readFileSync(B + f).toString('base64')]));
const font = fs.readFileSync(B + 'saira-500.ttf').toString('base64');   // Saira Medium: the original's WED 17
const INK = '#787e60', DATE = Number(process.env.DATE_SIZE || 28);
const TIME_Y = Math.round(Y(249)), HOUR_R = X(523), MIN_L = X(588), COLON_X = X(552);
const steps = [
  { script: `project.appId = ${Number(process.env.APP_ID || 1133671)};
    await registerCustomFont({ name: 'saira-500.ttf', family: 'Saira Medium', format: 'truetype', ext: '.ttf', dataBase64: '${font}' });
    const D = ${JSON.stringify(data)};
    for (const [n, b] of Object.entries(D)) { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode();
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); addProjectImage('tm/' + n, c, {}); }
    await loadAllImages(); return Object.keys(D).length` },
  { preset: 'bg' },
  { script: `const e = await addElement('IMG', { src: 'tm/scene.png' }); e.name = 'Scene'; e.src = 'tm/scene.png'; e.x = 0; e.y = 0; e.show = 'normal'; return 1` },
  { preset: 'clock' },
  { script: `const n = project.elements.length; for (const i of [n - 3, n - 2, n - 1]) project.elements[i].name += ' Aod'; return 1` },
  { preset: 'clock' }, { preset: 'weekday' }, { preset: 'day' },
  { edit: 'Weekday', set: { show: 'normal' }, glyph: { font: 'Saira Medium', fill: 'solid', color: INK, size: DATE } },
  { edit: 'Day', set: { show: 'normal', zero: 0 }, glyph: { font: 'Saira Medium', fill: 'solid', color: INK, size: DATE } },   // same size as the weekday: the app gives date pictures one cell and baseline
  { script: `
    const E = (n) => project.elements.find((q) => q.name === n);
    const set = (p) => [...Array(10).keys()].map((n) => 'tm/' + p + '_' + n + '.png');
    for (const [n, p, al, x, show] of [['Hour', 'd', 'RIGHT', ${HOUR_R}, 'normal'], ['Minute', 'd', 'LEFT', ${MIN_L}, 'normal'], ['Hour Aod', 'a', 'RIGHT', ${HOUR_R}, 'aod'], ['Minute Aod', 'a', 'LEFT', ${MIN_L}, 'aod']]) {
      const e = E(n); e.glyph = null; e.images = set(p); e.space = ${Math.round(M.gap)}; e.zero = 1; e.alignH = al; e.show = show; e.y = ${TIME_Y};
      const w = 2 * ${Math.ceil(M.DW)} + ${Math.round(M.gap)}; e.w = w; e.x = Math.round(al === 'RIGHT' ? x - w : x); }
    for (const [n, src, show] of [['Colon', 'tm/colon.png', 'normal'], ['Colon Aod', 'tm/acolon.png', 'aod']]) {
      const e = E(n); e.glyph = null; e.src = src; e.images = undefined; e.show = show; e.y = ${TIME_Y}; e.x = Math.round(${COLON_X} - ${Math.ceil(36 * K + 4)} / 2); }
    project.groups = project.groups || {};
    for (const e of project.elements) if (/ Aod$/.test(e.name)) e.group = 'gClockAod';
    project.groups.gClockAod = 'Clock AOD';
    return project.elements.map((e) => e.name + '@' + e.x + ',' + e.y).join(' ')` },
  { script: fs.readFileSync(__dirname + '/../../.claude/skills/create-amazfit-watchface/examples/animated/kit.js', 'utf8') + `
    const wd = E('Weekday'); wd.labelAlign = 'right'; E('Day').space = Number(${JSON.stringify(process.env.DAY_SPACE || -4)}); rerenderGlyphLayers(); await loadAllImages();
    park(['Weekday', 'Day']); await dateRow(${X(559).toFixed(1)}, ${Y(170).toFixed(1)}, ${(23 * K).toFixed(1)});
    project.groups.gDate = 'Date'; E('Weekday').group = 'gDate'; E('Day').group = 'gDate';
    return E('Weekday').x + ',' + E('Weekday').y + ' ' + E('Day').x + ',' + E('Day').y` },
];
fs.writeFileSync(__dirname + '/recipe.json', JSON.stringify({ name: 'This Moment', device: 'bip-6', language: 'en-US', font: 'Inter', optimizePng: 'lossless',
  description: 'A retro LCD window over 70s chevron stripes: the time in rounded monoline digits, the weekday and the date. After BA | AXR9800.',
  preview: 'preview.png', previewAod: 'preview-aod.png', save: 'project', out: 'out/this-moment', steps }, null, 1));
console.log('recipe written', pics.length, 'pictures');
