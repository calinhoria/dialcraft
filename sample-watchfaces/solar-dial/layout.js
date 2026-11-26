const font = 'Solar Inter';
await registerCustomFont({ name: 'inter-500.ttf', family: font, format: 'truetype', ext: 'ttf', dataBase64: FONT_BASE64 });
await document.fonts.load('500 30px "' + font + '"');

project.appId = 2024208;
project.groups = {
  dial: 'Solar dial', date: 'Date', clock: 'Clock', aod: 'Clock AOD',
  rise: 'Sunrise', set: 'Sunset',
};

function addLayer(kind, props) {
  const layer = newElement(kind, props);
  project.elements.push(layer);
  return layer;
}

function picture(name, src, x, y, group, props = {}) {
  return addLayer('IMG', { name, src, x, y, group, show: 'normal', ...props });
}

const referenceSheets = {};
let dialArt;
for (const [name, base64] of Object.entries(ART)) {
  const image = new Image();
  image.src = 'data:image/png;base64,' + base64;
  await image.decode();
  const canvas = mk(image.width, image.height);
  canvas.getContext('2d').drawImage(image, 0, 0);
  if (name.endsWith('-glyphs.png')) referenceSheets[name] = canvas;
  else if (name === 'sun.png') {
    const crop = mk(MARKER_SIZE, MARKER_SIZE);
    const inset = (canvas.width - MARKER_SIZE) / 2;
    crop.getContext('2d').drawImage(canvas, inset, inset, MARKER_SIZE, MARKER_SIZE, 0, 0, MARKER_SIZE, MARKER_SIZE);
    addProjectImage(name, crop);
  } else {
    if (name === 'solar-dial.png') dialArt = canvas;
    addProjectImage(name, canvas);
  }
}

const moon = mk(MARKER_SIZE, MARKER_SIZE);
const moonContext = moon.getContext('2d');
glow(moonContext, MARKER_SIZE / 2, MARKER_SIZE / 2, 23, 'rgba(111,161,247,0.35)', 'rgba(111,161,247,0)');
circ(moonContext, MARKER_SIZE / 2, MARKER_SIZE / 2, 9, '#adcbfa');
const moonPath = addProjectImage('moon.png', moon).name;

const skies = ['solar-dial.png'];
for (const [id, tint] of [
  ['horizon', 'rgba(181,74,48,0.24)'],
  ['nautical', 'rgba(41,28,88,0.47)'],
  ['astronomical', 'rgba(12,24,62,0.66)'],
  ['night', 'rgba(4,13,37,0.83)'],
]) {
  const canvas = mk(dialArt.width, dialArt.height);
  const g = canvas.getContext('2d');
  g.drawImage(dialArt, 0, 0);
  circ(g, DIAL.centerX, DIAL.centerY, 180, tint);
  skies.push(addProjectImage('sky-' + id + '.png', canvas).name);
}

picture('Solar sky', skies[0], 0, 0, 'dial', {
  images: skies, handle: 'solarSky', locked: true, solarDial: { role: 'sky' },
});
const referenceMarker = markerAt(solarDialState(985, 422, 1063).angle);
picture('Sun and moon marker', 'sun.png', referenceMarker.x, referenceMarker.y, 'dial', {
  images: ['sun.png', moonPath], handle: 'solarMarker', locked: true,
  solarDial: { role: 'marker', ...DIAL },
});

function glyph(name, value, w, h, fontSize, baseline, color, scale = 1, thinning = 0) {
  const canvas = mk(w, h);
  const g = canvas.getContext('2d');
  g.font = '500 ' + fontSize + 'px "' + font + '"';
  const m = g.measureText(value);
  const bearing = (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
  g.fillStyle = color;
  g.translate(w / 2, baseline);
  g.scale(scale, 1);
  g.fillText(value, -bearing, 0);
  if (thinning) {
    const pixels = g.getImageData(0, 0, w, h);
    const source = pixels.data.slice();
    for (let row = 1; row < h - 1; row++) {
      for (let col = 1; col < w - 1; col++) {
        const a = (row * w + col) * 4 + 3;
        const edge = Math.min(source[a - 4], source[a + 4], source[a - 4 * w], source[a + 4 * w]);
        pixels.data[a] = Math.min(source[a], source[a] + (edge - source[a]) * thinning);
      }
    }
    g.putImageData(pixels, 0, 0);
  }
  return addProjectImage(name + '.png', canvas).name;
}

function digitSet(name, w, h, size, baseline, color, scale, thinning) {
  return Array.from({ length: 10 }, (_, i) => glyph(name + '-' + i, String(i), w, h, size, baseline, color, scale, thinning));
}

function referenceGlyph(name, sheet, x, width, height, color) {
  const canvas = mk(width, height);
  const g = canvas.getContext('2d');
  g.drawImage(referenceSheets[sheet], x, 0, width, height, 0, 0, width, height);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, width, height);
  return addProjectImage(name + '.png', canvas).name;
}

function addClock(name, show, y, color) {
  const aod = show === 'aod';
  const label = aod ? ' AOD' : '';
  const available = [1, 6, 2, 5];
  const images = Array.from({ length: 10 }, (_, digit) => {
    const slot = available.indexOf(digit);
    const assetName = name + '-' + digit;
    return slot >= 0
      ? referenceGlyph(assetName, 'clock-glyphs.png', slot * 48, 48, 66, color)
      : glyph(assetName, String(digit), 48, 66, 84, 64, color, 0.94, 1.45);
  });
  const common = { images, zero: 1, y, show, group: name, alignH: 'LEFT' };
  addLayer('IMG_TIME', { ...common, name: 'Minute' + label, part: 'minute', x: 199 });
  picture('Colon' + label, referenceGlyph(name + '-colon', 'clock-glyphs.png', 192, 12, 66, color), 181, y, name, { show });
  addLayer('IMG_TIME', { ...common, name: 'Hour' + label, part: 'hour', x: 84, space: -4 });
}

addClock('clock', 'normal', 176, '#f6f8ff');
addClock('aod', 'aod', 192, '#7f8798');

const dateGlyph = { font, weight: 500, size: 28, color: '#f7f9ff', fill: 'solid' };
await applyPreset('weekday');
await applyPreset('day');
const weekday = E('Weekday');
const day = E('Day');
for (const e of [weekday, day]) {
  e.glyph = { ...dateGlyph };
  e.group = 'date';
  delete e.link;
}
weekday.labelAlign = 'right';
await rerenderGlyphLayers([weekday, day], { quiet: true });
await loadAllImages();
park(['Weekday', 'Day']);
await dateRow(195, 146, 10);
day.space = -4;
await align(['Weekday', 'Day'], { cx: 195 }, 'normal');
// Calibrate the pictured weekday and digits in their native cells.
weekday.images[1] = referenceGlyph('weekday-tue', 'date-glyphs.png', 0, 70, 40, dateGlyph.color);
day.images[2] = referenceGlyph('date-2', 'date-glyphs.png', 70, 22, 40, dateGlyph.color);
day.images[1] = referenceGlyph('date-1', 'date-glyphs.png', 92, 22, 40, dateGlyph.color);

const readingDigits = digitSet('solar-time', 13, 24, 24, 21, '#fff4df', 0.96, 0.25);
const readingColon = glyph('solar-time-colon', ':', 7, 24, 24, 20, '#fff4df', 0.88, 0.35);
const readingMissing = glyph('solar-time-missing', '--:--', 62, 24, 23, 20, '#fff4df');
for (const [label, group, binding, center] of [
  ['Sunrise', 'rise', 'SUN_RISE', 58],
  ['Sunset', 'set', 'SUN_SET', 332],
]) {
  picture(label + ' icon', label.toLowerCase() + '.png', center - 20, 360, group);
  // Bip 6 clips TEXT_IMG to its authored width. Leave room for all five
  // character cells, including the separator and inter-character spacing.
  addLayer('TEXT_IMG', {
    name: label, x: center - 31, y: 394, w: 78, show: 'normal', group,
    dataType: binding, alignH: 'LEFT', images: readingDigits,
    dot: readingColon, invalid: readingMissing, padding: 1,
  });
}
project.font = font;
project.fonts = [{ name: 'inter-500.ttf', family: font }];
return { referenceMarker, date: [weekday.x, day.x, day.y] };
