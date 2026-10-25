#!/usr/bin/env python3
"""Recipe for the Waterfall Clock (variation 4, exotic jungle), Bip 6 390x450.

Back to front: ONE native frame animation with the whole background (water, rays, pollen, foliage, flowers, animals),
transparent grained glass digits (native clock), two random butterflies in front (sprites moved by code), stats line.
AOD: a dim glass clock on black."""
import json, os
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
A = f'{ROOT}/assets'
W, H = 390, 450
man = json.load(open(f'{A}/manifest.json'))
CW, CH = man['cell']
HOUR_X = MIN_X = (W - 2 * CW) // 2
HOUR_Y, MIN_Y = man['rows']
AW, AH = man['aod']
AOD_X = (W - 2 * AW) // 2
AOD_Y1 = (H - (2 * AH + 14)) // 2
AOD_Y2 = AOD_Y1 + AH + 14
CAN = man['can']
NF, FPS = man['frames'], man['fps']
DIG = [f'digits/d_{i}.png' for i in range(10)]
AOD = [f'digits/a_{i}.png' for i in range(10)]
NUM = [f'ui/num_{i}.png' for i in range(10)]
DAY = [f'ui/day_{i}.png' for i in range(7)]
MONTH = [f'ui/month_{i}.png' for i in range(12)]
BFLY = [[f'bf/b{b}_{h}{f}.png' for h in (0, 1) for f in (0, 1, 2)] for b in (0, 3)]     # the two front butterflies
BG = [f'bg/bg_{i:02d}.png' for i in range(NF)]


def w(path):
    return Image.open(f'{A}/{path}').width


GAP, GROUP_GAP = 4, 18
date_w = w(DAY[0]) + GAP + w('ui/dot.png') + GAP + 2 * w(NUM[0]) + GAP + max(w(m) for m in MONTH)
heart_w = 3 * w(NUM[0]) + GAP + w('ui/bpm.png')
step_w = 5 * w(NUM[0])
total = date_w + GROUP_GAP + heart_w + GROUP_GAP + step_w
X0 = (W - total) // 2
STAT_Y = 413
DATE_X = X0
DOT_X = DATE_X + w(DAY[0]) + GAP
DAY_X = DOT_X + w('ui/dot.png') + GAP
MONTH_X = DAY_X + 2 * w(NUM[0]) + GAP
HEART_NUM_X = DATE_X + date_w + GROUP_GAP
BPM_X = HEART_NUM_X + 3 * w(NUM[0]) + GAP
STEP_X = HEART_NUM_X + heart_w + GROUP_GAP

images = [(f'wf/{f}', f'{A}/{f}') for f in BG + DIG + AOD + NUM + DAY + MONTH + ['ui/dot.png', 'ui/bpm.png'] + sum(BFLY, [])]


def repo_root(p):
    d = p
    while d != '/':
        if os.path.exists(os.path.join(d, 'package.json')) and os.path.isdir(os.path.join(d, 'tools')):
            return d
        d = os.path.dirname(d)
    return p


REPO = repo_root(ROOT)
script_images = '\n'.join(f"  [{json.dumps(n)}, {json.dumps(os.path.relpath(p, REPO))}]," for n, p in images)
wfl = lambda l: ['wf/' + f for f in l]

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
project.appId = 2024137;

// ---- the background: one frame animation, a seamless loop -------------------------
mk('IMG_ANIM', {{ name: 'Background', frames: {json.dumps(wfl(BG))}, fps: {FPS}, animPrefix: 'bg', repeat: 0, x: 0, y: 0, show: 'normal' }});

// ---- the clock: grained, see-through glass digits ----------------------------------
mk('IMG_TIME', {{ name: 'Minute Main', part: 'minute', images: {json.dumps(wfl(DIG))}, zero: 1, space: 0, x: {MIN_X}, y: {MIN_Y}, alignH: 'LEFT', show: 'normal' }});
mk('IMG_TIME', {{ name: 'Hour Main', part: 'hour', images: {json.dumps(wfl(DIG))}, zero: 1, space: 0, x: {HOUR_X}, y: {HOUR_Y}, alignH: 'LEFT', show: 'normal' }});

// ---- in front of the clock: two random butterflies ----------------------------------
mk('IMG', {{ name: 'Butterfly 1', images: {json.dumps(wfl(BFLY[0]))}, x: 180, y: 120, w: {CAN}, h: {CAN}, show: 'normal', handle: 'bf0' }});
mk('IMG', {{ name: 'Butterfly 2', images: {json.dumps(wfl(BFLY[1]))}, x: 240, y: 300, w: {CAN}, h: {CAN}, show: 'normal', handle: 'bf1' }});

// ---- stats line ----------------------------------------------------------------------------
mk('IMG_WEEK', {{ name: 'Weekday', images: {json.dumps(wfl(DAY))}, x: {DATE_X}, y: {STAT_Y}, show: 'normal' }});
mk('IMG', {{ name: 'Dot', src: 'wf/ui/dot.png', x: {DOT_X}, y: {STAT_Y + 1}, w: {w('ui/dot.png')}, h: {w('ui/dot.png')}, show: 'normal' }});
mk('IMG_DATE', {{ name: 'Day', part: 'day', images: {json.dumps(wfl(NUM))}, zero: 1, space: 0, x: {DAY_X}, y: {STAT_Y}, alignH: 'LEFT', show: 'normal' }});
mk('IMG_DATE', {{ name: 'Month', part: 'month', images: {json.dumps(wfl(MONTH))}, isCharacter: true, x: {MONTH_X}, y: {STAT_Y}, show: 'normal' }});
mk('TEXT_IMG', {{ name: 'Heart rate', dataType: 'HEART', images: {json.dumps(wfl(NUM))}, hSpace: 0, x: {HEART_NUM_X}, y: {STAT_Y}, w: {3 * w(NUM[0])}, alignH: 'RIGHT', show: 'normal' }});
mk('IMG', {{ name: 'BPM label', src: 'wf/ui/bpm.png', x: {BPM_X}, y: {STAT_Y + 2}, w: {w('ui/bpm.png')}, h: {w('ui/bpm.png')}, show: 'normal' }});
mk('TEXT_IMG', {{ name: 'Steps', dataType: 'STEP', images: {json.dumps(wfl(NUM))}, hSpace: 0, x: {STEP_X}, y: {STAT_Y}, w: {5 * w(NUM[0])}, alignH: 'LEFT', show: 'normal' }});

// ---- AOD: a dim glass clock on black -----------------------------------------------------------
mk('IMG_TIME', {{ name: 'Minute AOD', part: 'minute', images: {json.dumps(wfl(AOD))}, zero: 1, space: 0, x: {AOD_X}, y: {AOD_Y2}, alignH: 'LEFT', show: 'aod' }});
mk('IMG_TIME', {{ name: 'Hour AOD', part: 'hour', images: {json.dumps(wfl(AOD))}, zero: 1, space: 0, x: {AOD_X}, y: {AOD_Y1}, alignH: 'LEFT', show: 'aod' }});

project.groups = project.groups || {{}};
const grp = (id, label, names) => {{ project.groups[id] = label; for (const nm of names) {{ const e = project.elements.find((x) => x.name === nm); if (e) e.group = id; }} }};
grp('gBack', 'Background', ['Background']);
grp('gBugs', 'Butterflies', ['Butterfly 1', 'Butterfly 2']);
grp('gClock', 'Clock', ['Hour Main', 'Minute Main']);
grp('gAod', 'Clock (AOD)', ['Hour AOD', 'Minute AOD']);
grp('gStats', 'Stats', ['Weekday', 'Dot', 'Day', 'Month', 'Heart rate', 'BPM label', 'Steps']);
return {{ images: added, layers: project.elements.length }};
"""

USER_CODE = """
{
  // The background is a native frame animation. The only code: two butterflies wander at random in front of the clock.
  const TICK = 100, FLAP = [0, 1, 2, 1], HALF = __HALF__;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const BUGS = ['bf0', 'bf1'].map((h, i) => ({ h, x: rnd(40, 340), y: rnd(40, 380), vx: 0, vy: 0, tx: rnd(20, 370), ty: rnd(30, 400), n: Math.floor(rnd(10, 40)), sp: 2.4 + i * 0.6 }));
  let tk = 0, id = null;
  const tick = () => {
    id = null;
    tk++;
    try {
      const fl = FLAP[tk % 4];
      for (const b of BUGS) {
        if (--b.n <= 0) { b.tx = rnd(20, 370); b.ty = rnd(30, 400); b.n = Math.floor(rnd(15, 55)); }
        const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy) || 1;
        b.vx = b.vx * 0.8 + (dx / d) * b.sp * 0.5 + rnd(-0.7, 0.7);
        b.vy = b.vy * 0.8 + (dy / d) * b.sp * 0.5 + rnd(-0.7, 0.7);
        b.x += b.vx; b.y += b.vy;
        W[b.h].setProperty(ui.prop.MORE, { x: pxv(Math.round(b.x - HALF)), y: pxv(Math.round(b.y - HALF)), src: F[b.h][(b.vx < 0 ? 3 : 0) + fl] });
      }
    } catch (e) {}
    id = setTimeout(tick, TICK);
  };
  const start = () => { if (id === null) tick(); };
  const stop = () => { if (id !== null) { clearTimeout(id); id = null; } };
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: start, pause_call: stop });
  start();
}
""".replace('__HALF__', str(CAN // 2))

recipe = {
    'name': 'Waterfall Clock',
    'device': 'bip-6',
    'language': 'en-US',
    'optimizePng': 48,
    'description': 'Exotic jungle waterfall clock: macaw, tree frog and flowers on a green wall, golden rays, falling water, pollen and swaying foliage as one looping frame animation behind grained see-through glass digits; two random butterflies fly in front of the clock.',
    'userCode': USER_CODE,
    'steps': [{'script': maker}],
    'preview': 'preview.png',
    'previewAod': 'preview-aod.png',
    'save': 'project',
    'out': 'out/waterfall-clock',
    'build': False,
}
json.dump(recipe, open(f'{ROOT}/recipe.json', 'w'), indent=1)
print('recipe:', len(images), 'images')
