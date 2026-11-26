const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const faceFont = new FontFace('Rosette Inter', 'url(data:font/ttf;base64,' + FONT_BASE64 + ')');
document.fonts.add(await faceFont.load());
const inter = 'Rosette Inter';
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const digits = Array.from({ length: 10 }, (_, i) => String(i));
const white = '#fafafa';
const dim = '#777777';
project.appId = 2024197;
project.groups = { clock: 'Clock', aod: 'Clock AOD', header: 'Date and battery', art: 'Spirograph', footer: 'Equation' };

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function asset(name, c) {
  return addProjectImage(name + '.png', c).name;
}
function layer(kind, config) {
  const element = newElement(kind, config);
  project.elements.push(element);
  return element;
}
function picture(name, src, x, y, group, extra = {}) {
  return layer('IMG', { name, src, x, y, group, show: 'normal', ...extra });
}
function drawText(c, text, size, color, x, baseline, widthScale = 1, heightScale = 1) {
  const g = c.getContext('2d');
  g.save();
  g.font = size + 'px ' + inter;
  g.fillStyle = color;
  g.translate(x, baseline);
  g.scale(widthScale, heightScale);
  g.fillText(text, 0, 0);
  g.restore();
}
function metrics(text, size) {
  const g = canvas(1, 1).getContext('2d');
  g.font = size + 'px ' + inter;
  return g.measureText(text);
}
function clockDigit(name, digit, color) {
  const c = canvas(52, 64);
  const m = metrics(digit, 83);
  const sx = 1.00;
  const x = (52 - (m.actualBoundingBoxRight + m.actualBoundingBoxLeft) * sx) / 2;
  drawText(c, digit, 83, color, x + m.actualBoundingBoxLeft * sx, 62, sx, 1);
  return asset(name, c);
}
function clockColon(name, color) {
  const c = canvas(12, 64);
  const g = c.getContext('2d');
  g.fillStyle = color;
  for (const y of [18, 45]) {
    g.beginPath(); g.ellipse(6, y, 5.1, 4.1, 0, 0, TAU); g.fill();
  }
  return asset(name, c);
}
function datePart(name, text) {
  const w = Math.ceil(metrics(text, 23).width * 1.04);
  const c = canvas(w, 22);
  drawText(c, text, 23, white, 0, 18, 1.04, 0.88);
  return { src: asset(name, c), w, c };
}
function batteryIcon(index, color) {
  const c = canvas(35, 18);
  const g = c.getContext('2d');
  g.strokeStyle = g.fillStyle = color;
  g.lineWidth = 1.8;
  g.beginPath(); g.roundRect(1.5, 2.5, 28, 13, 2); g.stroke();
  g.beginPath(); g.roundRect(30, 6, 3.3, 6, 1); g.stroke();
  g.fillRect(4, 5, 21, 8);
  return asset('battery_' + index, c);
}
function renderArt(model, color) {
  const c = canvas(ART.w, ART.h);
  const g = c.getContext('2d');
  g.lineWidth = 1;
  g.lineJoin = 'round';
  const drawing = makeRosette(model);
  for (const loop of drawing.paths) {
    g.strokeStyle = loop.accent ? color : hex(INK);
    g.beginPath();
    loop.data.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y));
    g.closePath(); g.stroke();
  }
  g.fillStyle = '#000000';
  g.beginPath();
  g.ellipse(ART.w / 2, ART.h / 2, drawing.hole.x, drawing.hole.y, 0, 0, TAU);
  g.fill();
  return asset('rosette_reference', c);
}

const colors = PALETTE.map(hex);
const hours = digits.map((digit) => clockDigit('hour_' + digit, digit, white));
const minutes = colors.map((color, k) => digits.map((digit) => clockDigit('minute_' + k + '_' + digit, digit, color)));
const aod = digits.map((digit) => clockDigit('aod_' + digit, digit, dim));
const colon = clockColon('colon', white);
const aodColon = clockColon('aod_colon', dim);
const weekdaysText = weekdays.map((day, i) => datePart('weekday_' + i, day + ', '));
const monthsText = months.map((month, i) => datePart('month_' + i, month + ' '));
const daysText = Array.from({ length: 31 }, (_, i) => datePart('day_' + (i + 1), String(i + 1)));
const datePreview = canvas(176, 22);
let offset = 0;
for (const part of [weekdaysText[2], monthsText[0], daysText[27]]) {
  datePreview.getContext('2d').drawImage(part.c, offset, 0); offset += part.w;
}
const dateStill = asset('date_reference', datePreview);
const batteryImages = colors.map((color, i) => batteryIcon(i, color));
const batteryDigits = [...digits, '%'].map((digit, i) => {
  const m = metrics(digit, 23);
  const c = canvas(i === 10 ? 19 : 14, 22);
  drawText(c, digit, 23, white, (c.width - m.width) / 2, 18, 1, 0.88);
  return asset('battery_text_' + i, c);
});
const math = canvas(300, 28);
const equation = [
  ['r', true], [' = ', false], ['a', true], [' + ', false],
  ['b', true], [' cos ', false], ['(', false], ['kθ', true], [')', false],
];
const mathCtx = math.getContext('2d');
function setMathFont(italics) {
  mathCtx.font = (italics ? 'italic ' : '') + '26px "Times New Roman"';
}
let equationWidth = 0;
for (const [value, italics] of equation) {
  setMathFont(italics);
  equationWidth += mathCtx.measureText(value).width;
}
let equationX = (300 - equationWidth) / 2;
mathCtx.fillStyle = '#f3f3f3';
for (const [value, italics] of equation) {
  setMathFont(italics);
  mathCtx.save(); mathCtx.translate(equationX, 19); mathCtx.scale(1, 0.84);
  mathCtx.fillText(value, 0, 0);
  mathCtx.restore();
  equationX += mathCtx.measureText(value).width;
}
mathCtx.fillStyle = '#d6d6d6';
mathCtx.fillRect(0, 13, 43, 1.5);
mathCtx.fillRect(266, 13, 34, 1.5);
asset('equation', math);
asset('transparent', canvas(1, 1));
const still = renderArt(DEFAULT_MODEL, colors[0]);
await loadAllImages();

await picture('Date (reference)', dateStill, 49, 26, 'header', { previewOnly: true });
await picture('Battery icon', batteryImages[0], 255, 28, 'header', { handle: 'batteryIcon' });
layer('TEXT_IMG', { name: 'Battery percentage', x: 284, y: 26, w: 56, h: 22, images: batteryDigits.slice(0, 10), unit: batteryDigits[10], dataType: 'BATTERY', alignH: 'RIGHT', group: 'header', show: 'normal' });
await picture('Spirograph (reference)', still, ART.x, ART.y, 'art', { previewOnly: true });
layer('CANVAS', { name: 'Spirograph canvas', x: ART.x, y: ART.y, w: ART.w, h: ART.h, group: 'art', show: 'normal', handle: 'rosette' });
await picture('Equation', 'equation.png', 45, 399, 'footer');

function clockPart(name, part, images, x, y, group, show, extra = {}) {
  return layer('IMG_TIME', { name, part, images, x, y, zero: 1, space: 0, alignH: 'LEFT', group, show, ...extra });
}
await clockPart('Minute', 'minute', minutes[0], 207, 331, 'clock', 'normal', { previewOnly: true });
await picture('Colon', colon, 188, 331, 'clock');
await clockPart('Hour', 'hour', hours, 77, 331, 'clock', 'normal');
await clockPart('Minute AOD', 'minute', aod, 207, 193, 'aod', 'aod');
await picture('Colon AOD', aodColon, 188, 193, 'aod', { show: 'aod' });
await clockPart('Hour AOD', 'hour', aod, 77, 193, 'aod', 'aod');

layer('IMG', { name: 'Runtime images', x: 4, y: 4, visible: false, locked: true, images: [
  ...minutes.slice(1).flat(), ...batteryImages.slice(1),
  ...[...weekdaysText, ...monthsText, ...daysText].map((item) => item.src), 'transparent.png',
] });
const widths = {
  weekdays: weekdaysText.map((i) => i.w),
  months: monthsText.map((i) => i.w),
  days: daysText.map((i) => i.w),
};
project.userCode = '{\n' + ART_CODE + '\nconst DATE_WIDTHS = ' + JSON.stringify(widths) + ';\n' + WATCH_CODE + '\n}';
return widths;
