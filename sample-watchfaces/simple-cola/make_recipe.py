#!/usr/bin/env python3
"""Recipe builder for the Coca-Cola face (Amazfit Bip 6).

    python3 gen_assets.py           # redraw the pictures
    python3 make_recipe.py          # write coke.recipe.json
    cd /Volumes/Projects/Projects/dialcraft
    env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tools/face-cli.js \
        /Users/calinbelut/Downloads/deep/coke.recipe.json
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, 'assets')
W, H = 390, 450

NBUB, NWAVE = 48, 60
COKE_RED = '#E00A17'          # reading red on the white band
WHITE = '#ffffff'

# ---- geometry (device pixels, Bip 6 390x450) --------------------------------
LOGO = dict(x=80, y=40, w=230, h=72)
TIME_SIZE = 124
TIME_Y = 140
TAG_Y = 289
TAG_SIZE = 28
BAND_Y = 300                  # the wave frame is cropped from y=300
WAVE_TOP = 352                # mean height of the white edge
TEMP_SIZE = 42
TEMP_Y = 380
ICE_SIZE = 46
AOD_TIME_SIZE = 100
AOD_TIME_Y = 177
AOD_LOGO = dict(x=125, y=116, w=140, h=44)


def build():
    steps = []

    # ------------------------------------------------ 1. pictures and decor --
    steps.append({'script': f"""
const imp = async (p, name) => {{
  const r = await API.readImage(p);
  if (!r) throw new Error('cannot read ' + p);
  let n = name || r.name; if (!/\\.png$/i.test(n)) n += '.png';
  const url = 'data:image/png;base64,' + r.dataBase64;
  const i = project.images.findIndex((x) => x.name === n);
  if (i >= 0) project.images[i] = {{ name: n, width: r.width, height: r.height, url }};
  else project.images.push({{ name: n, width: r.width, height: r.height, url }});
  return n;
}};
const A = {json.dumps(A)};
await imp(A + '/bg.png', 'bg.png');
const bub = [];
for (let i = 0; i < {NBUB}; i++) bub.push(await imp(A + '/bub_' + String(i).padStart(2, '0') + '.png'));
const wave = [];
for (let i = 0; i < {NWAVE}; i++) wave.push(await imp(A + '/wave_' + String(i).padStart(2, '0') + '.png'));
await imp(A + '/logo.png', 'logo.png');
await imp(A + '/logo_aod.png', 'logo_aod.png');
for (let i = 0; i < 29; i++) await imp(A + '/weather/weather_' + i + '.png');
await loadAllImages();
const mk = async (kind, patch, name) => {{
  const e = await addElement(kind, patch);
  if (!e) return null;
  e.name = name;
  for (const k of ['x', 'y', 'w', 'h']) if (patch[k] !== undefined) e[k] = patch[k];
  return e;
}};
await mk('FILL_RECT', {{ x: 0, y: 0, w: {W}, h: {H}, color: '#000000', radius: 0, show: 'aod' }}, 'AOD background');
await mk('IMG', {{ src: 'bg.png', x: 0, y: 0, w: {W}, h: {H}, show: 'normal' }}, 'Red background');
await mk('IMG_ANIM', {{ frames: bub, fps: 12, repeat: 0, x: 0, y: 0, w: {W}, h: {H}, show: 'normal' }}, 'Bubbles');
await mk('IMG_ANIM', {{ frames: wave, fps: 10, repeat: 0, x: 0, y: {BAND_Y}, w: {W}, h: {H - BAND_Y}, show: 'normal' }}, 'White wave');
await mk('IMG', {{ src: 'logo.png', x: {LOGO['x']}, y: {LOGO['y']}, w: {LOGO['w']}, h: {LOGO['h']}, show: 'normal' }}, 'Logo');
return project.elements.length;
"""})

    # --------------------------------------------------------- 2. presets ---
    steps.append({'preset': 'clock'})
    steps.append({'preset': 'weather'})
    steps.append({'edit': 'Weather icon', 'tint': {'fill': 'solid', 'color': COKE_RED}})

    # ------------------------------------------------- 3. clock look / pos --
    for nm in ('Hour', 'Minute'):
        steps.append({'edit': nm, 'glyph': {'font': 'Anton', 'color': WHITE, 'size': TIME_SIZE},
                      'set': {'y': TIME_Y, 'show': 'normal'}})
    steps.append({'edit': 'Colon', 'glyph': {'font': 'Anton', 'color': WHITE, 'size': TIME_SIZE},
                  'set': {'y': TIME_Y, 'show': 'normal'}})

    # ----------------------------------------------------------- 4. tagline --
    steps.append({'add': 'TEXT', 'name': 'Tagline',
                  'patch': {'text': 'ICE COLD', 'color': WHITE, 'size': TAG_SIZE, 'weight': 400,
                            'charSpace': 10, 'alignH': 'CENTER_H', 'alignV': 'CENTER_V',
                            'fontFile': 'Anton-Regular.ttf', 'show': 'normal'},
                  'set': {'x': 10, 'y': TAG_Y, 'w': W - 20, 'h': 28}})

    # ------------------------ 5. temperature, AOD clock, packing, centring --
    steps.append({'script': f"""
const cx = dev().w / 2;
const byName = (n) => project.elements.find((e) => (e.name || '').toLowerCase() === n.toLowerCase());
const box = (e) => elBox(e);
const place = (list, gapY) => {{}};
const save = [glyphFont, +glyphOpts.size, glyphOpts.color];
glyphFont = 'Anton';

// --- temperature with its degree sign, drawn at the reading's own size -----
glyphOpts.size = {TEMP_SIZE}; glyphOpts.color = '{COKE_RED}';
const temp = await addElement('TEXT_IMG', {{ dataType: 'WEATHER_CURRENT', hSpace: 3, alignH: 'CENTER_H', show: 'normal' }});
temp.name = 'Temperature';
temp.unit = await genUnit('degree', '\\u00b0', {{ style: glyphStyle(temp) }});
temp.alignH = 'CENTER_H';
temp.y = {TEMP_Y};
glyphOpts.size = save[1]; glyphOpts.color = save[2];

// --- AOD clock: its own digit set at the AOD size, dim ---------------------
glyphOpts.size = {AOD_TIME_SIZE}; glyphOpts.color = '{WHITE}';
const ah = await addElement('IMG_TIME', {{ part: 'hour', zero: 1, space: 0, show: 'aod', alpha: 160 }});
const am = await addElement('IMG_TIME', {{ part: 'minute', zero: 1, space: 0, show: 'aod', alpha: 160, images: ah.images }});
const ac = await addElement('IMG', {{ src: await genUnit('colon_aod', ':', {{ style: glyphStyle(ah) }}), w: 0, h: 0, show: 'aod', alpha: 160 }});
ah.name = 'Hour AOD'; am.name = 'Minute AOD'; ac.name = 'Colon AOD';
for (const e of [ah, am, ac]) e.y = {AOD_TIME_Y};
// the Layers panel lists the top layer first: minute, colon, hour
const aodSet = [am, ac, ah];
project.elements = project.elements.filter((e) => !aodSet.includes(e)).concat(aodSet);
glyphOpts.size = save[1]; glyphOpts.color = save[2];

// --- main clock: pack the three parts with an even gap, centre the run -----
const hr = byName('Hour'), co = byName('Colon'), mi = byName('Minute');
let gap = 8;
const packRow = (a, b, c, dx, dy) => {{
  const ba = box(a), bb = box(b), bc = box(c);
  const total = ba.w + gap + bb.w + gap + bc.w;
  let x = Math.round(cx - total / 2) + dx;
  a.x = x; x += ba.w + gap;
  b.x = x; x += bb.w + gap;
  c.x = x;
  // the colon cell is shorter than a digit: centre its ink on theirs
  const digitsTop = ba.y, digitsBot = ba.y + ba.h;
  b.y = Math.round(digitsTop + (digitsBot - digitsTop - bb.h) / 2) + dy;
  return {{ total, boxes: [ba, bb, bc] }};
}};
const main = packRow(hr, co, mi, -5, 6);
const aod = packRow(ah, ac, am, -4, -7);

// --- weather row: icon + reading, centred as one block --------------------
const wi = byName('Weather icon'), ti = temp;
wi.w = {ICE_SIZE}; wi.h = {ICE_SIZE - 5};
const bt = box(ti), bw = box(wi);
// bearings measured on the preview: the icon picture starts 4 px into its box,
// the reading's first digit 18 px into its own
wi.x = 130; ti.x = 168;
wi.y = Math.round(bt.y + (bt.h - bw.h) / 2);
return JSON.stringify({{ main: main.boxes, aod: aod.boxes, temp: [bt, bw], y: [hr.y, co.y, mi.y, wi.y] }});
"""})

    # ------------------------------------------- AOD logo (before grouping) --
    steps.append({'add': 'IMG', 'name': 'AOD logo',
                  'patch': {'src': 'logo_aod.png', 'show': 'aod', 'alpha': 120},
                  'set': dict(AOD_LOGO)})

    # --------------------------------------------------------- 7. grouping ---
    steps.append({'script': r"""
// reuse the group the clock preset made (it is already named "Clock") instead
// of leaving a second, empty one behind
const gidFor = (title, fallback) => Object.keys(project.groups || {}).find((k) => project.groups[k] === title) || fallback;
project.groups = project.groups || {};
const put = (key, title, names) => {
  const gid = gidFor(title, key);
  project.groups[gid] = title;
  let n = 0;
  for (const nm of names) {
    for (const e of project.elements) {
      if ((e.name || '').toLowerCase() === nm.toLowerCase()) { e.group = gid; n++; }
    }
  }
  return title + ' ' + n;
};
const out = [
  put('gDecor', 'Background and motion', ['AOD background', 'Red background', 'Bubbles', 'White wave']),
  put('gLogo', 'Logo', ['Logo', 'AOD logo']),
  put('gClock', 'Clock', ['Hour', 'Colon', 'Minute']),
  put('gTag', 'Tagline', ['Tagline']),
  put('gWeather', 'Weather', ['Weather icon', 'Temperature']),
  put('gAod', 'AOD clock', ['Hour AOD', 'Colon AOD', 'Minute AOD'])
];
// drop groups nobody is in, and any leftover from a preset
for (const gid of Object.keys(project.groups)) {
  if (!project.elements.some((e) => e.group === gid)) delete project.groups[gid];
}
return out.join(' · ');
"""})

    rec = {
        'name': 'Coca-Cola Ice Cold',
        'device': 'bip-6',
        'font': 'Anton',
        'language': 'en-US',
        'description': 'A red Coca-Cola face: white script logo, ice-cold time, rising bubbles and a flowing ribbon carrying the temperature.',
        'optimizePng': 'lossless',
        'steps': steps,
        'preview': 'preview.png',
        'previewAod': 'preview-aod.png',
        'save': 'project',
        'out': 'out/coca-cola',
        'build': True,
    }
    p = os.path.join(HERE, 'coke.recipe.json')
    json.dump(rec, open(p, 'w'), indent=1)
    print('wrote', p)

    # the same face with the moving pictures removed, so the ink can be measured
    probe = dict(rec)
    probe['steps'] = steps + [{'remove': 'Bubbles'}]
    probe['preview'] = 'probe.png'
    probe['previewAod'] = 'probe-aod.png'
    probe.pop('save', None)
    probe.pop('out', None)
    json.dump(probe, open(os.path.join(HERE, 'probe.recipe.json'), 'w'), indent=1)


if __name__ == '__main__':
    build()
