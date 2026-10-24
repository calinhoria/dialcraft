#!/usr/bin/env python3
"""Generate the Dialcraft recipe for the Skate Park demo face (Bip 6, 390x450).

A skater rides in from the left, pushes twice, throws a trick off the flat and rolls out;
the loop alternates heelflip and indy grab. Art: "Skater Girl 2D" by overcrafted
(opengameart.org, CC-BY 4.0), sliced into sprite frames.
"""
import json, os

ROOT = os.path.dirname(os.path.abspath(__file__))
A = f'{ROOT}/assets'
W, H = 390, 450
man = json.load(open(f'{A}/skate/manifest.json'))
CELL = man['cell']

# picture order: the still frame first, then every clip; the code maps through IDX
STILL = 'flip_05.png'
SKATE = [f'skate/{STILL}']
for clip in ['roll', 'push', 'flip', 'grab']:
    for f in man['clips'][clip]:
        if f != STILL:
            SKATE.append(f'skate/{f}')
IDX = {clip: [SKATE.index(f'skate/{f}') for f in man['clips'][clip]] for clip in ['roll', 'push', 'flip', 'grab']}
STILL_X, STILL_Y = 245, None

CLOCK = [f'ui/clock_{i}.png' for i in range(10)]

images = [('skate/bg.png', f'{ROOT}/bg.png')]
for f in SKATE:
    images.append((f, f'{A}/{f}'))
for f in CLOCK:
    images.append((f'skate/{f}', f'{A}/{f}'))
images.append(('skate/ui/clock_colon.png', f'{A}/ui/clock_colon.png'))

GROUND = 430
BASE_Y = GROUND - CELL['ay']

HOUR_X, COLON_X, MIN_X, CLOCK_Y = 103, 179, 211, 26


def repo_root(p):
    d = p
    while d != '/':
        if os.path.exists(os.path.join(d, 'package.json')) and os.path.isdir(os.path.join(d, 'tools')):
            return d
        d = os.path.dirname(d)
    return p


REPO = repo_root(ROOT)
script_images = '\n'.join(f"  [{json.dumps(n)}, {json.dumps(os.path.relpath(p, REPO))}]," for n, p in images)

maker = f"""
const FILES = [
{script_images}
];
let added = 0;
for (const [name, path] of FILES) {{
  const r = await API.readImage(path);
  if (!r) throw new Error('cannot read ' + path);
  project.images.push({{ name, width: r.width, height: r.height, url: 'data:image/png;base64,' + r.dataBase64 }});
  added++;
}}
const mk = (kind, patch) => {{ const e = newElement(kind, patch); project.elements.push(e); return e; }};
project.appId = 2024133;

mk('IMG', {{ name: 'Skatepark', src: 'skate/bg.png', x: 0, y: 0, w: {W}, h: {H}, show: 'normal' }});
mk('IMG', {{ name: 'Skater', images: {json.dumps(SKATE)}, x: 245, y: {BASE_Y - 60}, w: {CELL['w']}, h: {CELL['h']}, show: 'normal', handle: 'sk' }});

// clock, in both states
mk('IMG_TIME', {{ name: 'Minute Main', part: 'minute', images: {json.dumps(['skate/' + f for f in CLOCK])}, zero: 1, space: 0, x: {MIN_X}, y: {CLOCK_Y}, alignH: 'LEFT', show: 'both' }});
mk('IMG', {{ name: 'Colon Main', src: 'skate/ui/clock_colon.png', x: {COLON_X}, y: {CLOCK_Y}, w: 28, h: 58, show: 'both' }});
mk('IMG_TIME', {{ name: 'Hour Main', part: 'hour', images: {json.dumps(['skate/' + f for f in CLOCK])}, zero: 1, space: 0, x: {HOUR_X}, y: {CLOCK_Y}, alignH: 'RIGHT', show: 'both' }});

project.groups = project.groups || {{}};
const grp = (id, label, names) => {{ project.groups[id] = label; let n = 0; for (const nm of names) {{ const e = project.elements.find((x) => x.name === nm); if (e) {{ e.group = id; n++; }} }} return n; }};
grp('gScene', 'Skatepark', ['Skatepark', 'Skater']);
grp('gClock', 'Clock', ['Hour Main', 'Colon Main', 'Minute Main']);
return {{ images: added, layers: project.elements.length }};
"""

USER_CODE = f"""
{{
  // The skater rides in, pushes twice, throws a trick off the flat and rolls out. Loops.
  const MS = 55, CYCLE = 5600, BASE_Y = {BASE_Y}, START_X = -80, OUT_X = 470;
  const ROLL = {json.dumps(IDX['roll'])}, PUSH = {json.dumps(IDX['push'])};
  const FLIP = {json.dumps(IDX['flip'])}, GRAB = {json.dumps(IDX['grab'])};
  const PICS = F.sk;

  let seed = (Date.now() ^ 0x2545f491) >>> 0;
  const rnd = () => {{ seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }};
  let passes = 0, trick = 0, t0 = Date.now();

  const frame = (seq, el, ms) => seq[Math.min(seq.length - 1, Math.floor(el / ms))];

  const tick = () => {{
    const now = Date.now();
    let t = now - t0;
    if (t >= CYCLE) {{
      // next pass: alternate the trick, nudge the pacing a little
      trick = passes % 2 === 0 ? 0 : 1;
      passes++;
      t0 = now;
      t = 0;
    }}
    let x = 0, y = BASE_Y, pic = PICS[ROLL[0]];
    const phase1 = 1100, phase2 = 2100, phase3 = 3400;
    if (t < phase1) {{                                   // roll in
      x = START_X + (120 - START_X) * (t / phase1);
      pic = PICS[frame(ROLL, t, 95)];
    }} else if (t < phase2) {{                           // push
      x = 120 + 90 * ((t - phase1) / (phase2 - phase1));
      pic = PICS[frame(PUSH, t - phase1, 95)];
    }} else if (t < phase3) {{                           // trick off the flat
      const u = (t - phase2) / (phase3 - phase2);
      x = 210 + 70 * u;
      y = BASE_Y - Math.round(96 * 4 * u * (1 - u));
      pic = PICS[trick === 0 ? frame(FLIP, t - phase2, 70) : frame(GRAB, t - phase2, 95)];
    }} else if (t < 4750) {{                             // roll out
      x = 280 + (OUT_X - 280) * ((t - phase3) / (4750 - phase3));
      pic = PICS[frame(ROLL, t - phase3, 95)];
    }} else {{
      x = OUT_X;                                         // off screen until the loop restarts
    }}
    W.sk.setProperty(ui.prop.MORE, {{ x: pxv(Math.round(x)), y: pxv(Math.round(y)), src: pic }});
  }};

  const safe = () => {{ try {{ tick(); }} catch (e) {{}} }};
  let id = null, pausedAt = 0;
  const start = () => {{
    if (pausedAt) {{ t0 += Date.now() - pausedAt; pausedAt = 0; }}
    if (id === null) {{ try {{ id = setInterval(safe, MS); }} catch (e) {{}} }}
    safe();
  }};
  const stop = () => {{
    if (id !== null) {{ try {{ clearInterval(id); }} catch (e) {{}} id = null; }}
    pausedAt = Date.now();
  }};
  ui.createWidget(ui.widget.WIDGET_DELEGATE, {{ resume_call: start, pause_call: stop }});
  safe();
  start();
}}
"""

recipe = {
    'name': 'Skate Park',
    'device': 'bip-6',
    'language': 'en-US',
    'optimizePng': 64,
    'description': 'Skate park demo: a skater rolls in, pushes, throws a heelflip or an indy grab and rolls out, on a dusk city street. Skater art "Skater Girl 2D" by overcrafted (opengameart.org), CC-BY 4.0.',
    'userCode': USER_CODE,
    'steps': [{'script': maker}],
    'preview': 'preview.png',
    'previewAod': 'preview-aod.png',
    'save': 'project',
    'out': 'out/skate-park',
    'build': False,
}

json.dump(recipe, open(f'{ROOT}/recipe.json', 'w'), indent=1)
print('recipe:', f'{ROOT}/recipe.json', 'images', len(images), 'base y', BASE_Y)
