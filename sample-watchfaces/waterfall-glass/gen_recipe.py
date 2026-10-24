#!/usr/bin/env python3
"""Generate the Dialcraft recipe for the Waterfall glass face (Bip 6, 390x450).

Concept: the "Liquid Glass" handoff, waterfall variant (wf.py) — a dark rock/water
plate, the time as glass digits stacked in two rows, spray drifting over everything,
and a small stats line at the bottom.
"""
import json, os
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
A = f'{ROOT}/assets'
W, H = 390, 450
man = json.load(open(f'{A}/manifest.json'))
HC, MC, AC = man['hour_cell'], man['min_cell'], man['aod_cell']

HOUR_X = (W - HC[0] * 2) // 2
MIN_X = (W - MC[0] * 2) // 2
HOUR_Y, MIN_Y = 62, 222
AOD_X = (W - AC[0] * 2) // 2
AOD_Y1, AOD_Y2 = 139, 229

SPRAY = [f'fx/spray_{i:02d}.png' for i in range(man['spray'])]
HOUR = [f'digits/hour_{i}.png' for i in range(10)]
MIN = [f'digits/min_{i}.png' for i in range(10)]
AOD = [f'digits/aod_{i}.png' for i in range(10)]
NUM = [f'ui/num_{i}.png' for i in range(10)]
DAY = [f'ui/day_{i}.png' for i in range(7)]
MONTH = [f'ui/month_{i}.png' for i in range(12)]


def w(path):
    return Image.open(f'{A}/{path}').width


# stats line, laid out from the real image widths (max content), centred
GAP, GROUP_GAP = 4, 16
date_w = w(DAY[0]) + GAP + w('ui/dot.png') + GAP + 2 * w(NUM[0]) + GAP + max(w(m) for m in MONTH)
heart_w = w('ui/heart.png') + 3 + 3 * w(NUM[0]) + GAP + w('ui/bpm.png')
step_w = w('ui/foot.png') + 3 + 5 * w(NUM[0])
total = date_w + GROUP_GAP + heart_w + GROUP_GAP + step_w
X0 = (W - total) // 2 + 5
STAT_Y = 411

DATE_X = X0
DOT_X = DATE_X + w(DAY[0]) + GAP
DAY_X = DOT_X + w('ui/dot.png') + GAP
MONTH_X = DAY_X + 2 * w(NUM[0]) + GAP
HEART_ICON_X = DATE_X + date_w + GROUP_GAP
HEART_NUM_X = HEART_ICON_X + w('ui/heart.png') + 3
BPM_X = HEART_NUM_X + 3 * w(NUM[0]) + GAP
FOOT_ICON_X = HEART_ICON_X + heart_w + GROUP_GAP
STEP_X = FOOT_ICON_X + w('ui/foot.png') + 3
print('stats line', total, 'px from', X0)

images = [('wf/bg.png', f'{A}/bg.png')]
for f in SPRAY:
    images.append((f'wf/{f}', f'{A}/{f}'))
for f in HOUR + MIN + AOD + NUM + DAY + MONTH:
    images.append((f'wf/{f}', f'{A}/{f}'))
for extra in ['ui/dot.png', 'ui/bpm.png', 'ui/heart.png', 'ui/foot.png']:
    images.append((f'wf/{extra}', f'{A}/{extra}'))


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
project.appId = 2024135;

// ---- the rock and water ------------------------------------------------
mk('IMG', {{ name: 'Waterfall', src: 'wf/bg.png', x: 0, y: 0, w: {W}, h: {H}, show: 'normal' }});

// ---- time: glass digits, two rows --------------------------------------
mk('IMG_TIME', {{ name: 'Minute Main', part: 'minute', images: {json.dumps(['wf/' + f for f in MIN])}, zero: 1, space: 0, x: {MIN_X}, y: {MIN_Y}, alignH: 'LEFT', show: 'normal' }});
mk('IMG_TIME', {{ name: 'Hour Main', part: 'hour', images: {json.dumps(['wf/' + f for f in HOUR])}, zero: 1, space: 0, x: {HOUR_X}, y: {HOUR_Y}, alignH: 'LEFT', show: 'normal' }});

// ---- spray, drawn over the digits --------------------------------------
mk('IMG', {{ name: 'Spray', images: {json.dumps(['wf/' + f for f in SPRAY])}, x: 0, y: 0, w: {W}, h: {H}, show: 'normal', handle: 'spray' }});

// ---- stats line --------------------------------------------------------
mk('IMG_WEEK', {{ name: 'Weekday', images: {json.dumps(['wf/' + f for f in DAY])}, x: {DATE_X}, y: {STAT_Y}, show: 'normal' }});
mk('IMG', {{ name: 'Dot', src: 'wf/ui/dot.png', x: {DOT_X}, y: {STAT_Y + 1}, w: {w('ui/dot.png')}, h: {w('ui/dot.png')}, show: 'normal' }});
mk('IMG_DATE', {{ name: 'Day', part: 'day', images: {json.dumps(['wf/' + f for f in NUM])}, zero: 1, space: 0, x: {DAY_X}, y: {STAT_Y}, alignH: 'LEFT', show: 'normal' }});
mk('IMG_DATE', {{ name: 'Month', part: 'month', images: {json.dumps(['wf/' + f for f in MONTH])}, isCharacter: true, x: {MONTH_X}, y: {STAT_Y}, show: 'normal' }});
mk('IMG', {{ name: 'Heart icon', src: 'wf/ui/heart.png', x: {HEART_ICON_X}, y: {STAT_Y}, w: {w('ui/heart.png')}, h: {w('ui/heart.png')}, show: 'normal' }});
mk('TEXT_IMG', {{ name: 'Heart rate', dataType: 'HEART', images: {json.dumps(['wf/' + f for f in NUM])}, hSpace: 0, x: {HEART_NUM_X}, y: {STAT_Y}, w: {3 * w(NUM[0])}, alignH: 'RIGHT', show: 'normal' }});
mk('IMG', {{ name: 'BPM label', src: 'wf/ui/bpm.png', x: {BPM_X}, y: {STAT_Y + 2}, w: {w('ui/bpm.png')}, h: {w('ui/bpm.png')}, show: 'normal' }});
mk('IMG', {{ name: 'Step icon', src: 'wf/ui/foot.png', x: {FOOT_ICON_X}, y: {STAT_Y}, w: {w('ui/foot.png')}, h: {w('ui/foot.png')}, show: 'normal' }});
mk('TEXT_IMG', {{ name: 'Steps', dataType: 'STEP', images: {json.dumps(['wf/' + f for f in NUM])}, hSpace: 0, x: {STEP_X}, y: {STAT_Y}, w: {5 * w(NUM[0])}, alignH: 'LEFT', show: 'normal' }});

// ---- AOD: a compact glass time on black --------------------------------
mk('IMG_TIME', {{ name: 'Minute AOD', part: 'minute', images: {json.dumps(['wf/' + f for f in AOD])}, zero: 1, space: 0, x: {AOD_X}, y: {AOD_Y2}, alignH: 'LEFT', show: 'aod' }});
mk('IMG_TIME', {{ name: 'Hour AOD', part: 'hour', images: {json.dumps(['wf/' + f for f in AOD])}, zero: 1, space: 0, x: {AOD_X}, y: {AOD_Y1}, alignH: 'LEFT', show: 'aod' }});

// ---- groups ------------------------------------------------------------
project.groups = project.groups || {{}};
const grp = (id, label, names) => {{ project.groups[id] = label; let n = 0; for (const nm of names) {{ const e = project.elements.find((x) => x.name === nm); if (e) {{ e.group = id; n++; }} }} return n; }};
grp('gScene', 'Waterfall', ['Waterfall', 'Spray']);
grp('gClock', 'Clock', ['Hour Main', 'Minute Main']);
grp('gAod', 'Clock (AOD)', ['Hour AOD', 'Minute AOD']);
grp('gStats', 'Stats', ['Weekday', 'Dot', 'Day', 'Month', 'Heart icon', 'Heart rate', 'BPM label', 'Step icon', 'Steps']);
return {{ images: added, layers: project.elements.length }};
"""

USER_CODE = f"""
{{
  // the spray loop: {man['spray']} frames at 10 fps, restarting on every minute for variety
  const MS = 55, NF = {man['spray']}, FRAME_MS = 100;
  let idx = 0, last = -1, id = null, pausedAt = 0;
  const tick = () => {{
    const now = Date.now();
    const i = Math.floor((now % (NF * FRAME_MS)) / FRAME_MS) % NF;
    if (i !== last) {{
      last = i;
      W.spray.setProperty(ui.prop.MORE, {{ x: pxv(0), y: pxv(0), src: F.spray[i] }});
    }}
  }};
  const safe = () => {{ try {{ tick(); }} catch (e) {{}} }};
  const start = () => {{
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
    'name': 'Waterfall Glass',
    'device': 'bip-6',
    'language': 'en-US',
    'optimizePng': 16,
    'description': 'Liquid Glass waterfall: glass digits stacked over a dark rock waterfall with drifting spray, and a small stats line underneath (weekday, date, heart rate, steps). Concept from the Liquid Glass handoff (wf.py).',
    'userCode': USER_CODE,
    'steps': [{'script': maker}],
    'preview': 'preview.png',
    'previewAod': 'preview-aod.png',
    'save': 'project',
    'out': 'out/waterfall-glass',
    'build': False,
}

json.dump(recipe, open(f'{ROOT}/recipe.json', 'w'), indent=1)
print('recipe:', f'{ROOT}/recipe.json', 'images', len(images))
