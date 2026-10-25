#!/usr/bin/env python3
"""Measured text-layout check: renders ONLY the text layers of a recipe (black background, no scene art) and reports,
per row of text, each word group's ink top / bottom and the row centre. Exits 1 when words in one row do not share
a top and bottom line (> 2 px; round digits overshoot by 1-2), a row is not centred (> 3 px), or text is too small to read
(tallest glyph in a row under 6 % of the screen height / 24 px; a row 14 % tall or more counts as the clock).  Run it on the FINAL recipe, every time.

  python3 .claude/skills/create-amazfit-watchface/check_text_layout.py path/to/recipe.json [--mode normal|aod]

Why it exists: a weekday + day row placed by hand drifts (names differ in width and ink height). Use dateRow() from
examples/animated/kit.js for that row; this script proves it worked.
"""
import json, subprocess, sys, os, tempfile
import numpy as np
from PIL import Image

TEXT = {'IMG_TIME', 'IMG_WEEK', 'IMG_DATE', 'TEXT_IMG', 'TEXT', 'IMG_LEVEL'}
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
src = sys.argv[1]; aod = '--mode' in sys.argv and sys.argv[sys.argv.index('--mode') + 1] == 'aod'
r = json.load(open(src))
for k in ('userCode', 'userImports', 'save', 'out', 'optimizePng', 'open', 'build'): r.pop(k, None)
keep = ("project.elements = project.elements.filter((e) => /^(IMG_TIME|IMG_WEEK|IMG_DATE|TEXT_IMG|TEXT)$/.test(e.kind) || /colon/i.test(e.name)); "
        "project.elements.forEach((e) => { e.group = undefined }); return project.elements.length")
r['steps'] = list(r['steps']) + [{'script': keep}]
tmp = tempfile.mkdtemp(); png = os.path.join(tmp, 'ink.png'); pa = os.path.join(tmp, 'aod.png')
r['preview'] = png; r['previewAod'] = pa
json.dump(r, open(os.path.join(tmp, 'r.json'), 'w'))
env = {k: v for k, v in os.environ.items() if k != 'ELECTRON_RUN_AS_NODE'}
out = subprocess.run([os.path.join(root, 'node_modules/.bin/electron'), os.path.join(root, 'tools/face-cli.js'), os.path.join(tmp, 'r.json')], capture_output=True, text=True, cwd=root, env=env)
last = json.loads(out.stdout.strip().splitlines()[-1])
if not last.get('ok'): print('render failed', last); sys.exit(2)
m = np.array(Image.open(pa if aod else png).convert('RGB')).astype(int).sum(2) > 60
H, W = m.shape
rows = np.where(m.any(1))[0]; bands = []; s = p = rows[0]
for y in rows[1:]:
    if y > p + 3: bands.append((s, p)); s = y
    p = y
bands.append((s, p)); bad = 0
for y0, y1 in bands:
    sub = m[y0:y1 + 1]; cols = np.where(sub.any(0))[0]; groups = []; s = p = cols[0]
    for x in cols[1:]:
        if x > p + 6: groups.append((s, p)); s = x
        p = x
    groups.append((s, p))
    info = []
    for a, b in groups:
        ys = np.where(m[y0:y1 + 1, a:b + 1].any(1))[0] + y0
        info.append((int(a), int(b), int(ys.min()), int(ys.max())))
    cx = (groups[0][0] + groups[-1][1]) / 2
    hmax = max(i[3] - i[2] for i in info); big = [i for i in info if i[3] - i[2] >= 0.8 * hmax]  # a colon is shorter on purpose
    tops = [i[2] for i in big]; bots = [i[3] for i in big]
    flag = ''
    if len(info) > 1 and (max(tops) - min(tops) > 2 or max(bots) - min(bots) > 2): flag += ' <-- tops/bottoms differ'; bad = 1
    if abs(cx - W / 2) > 3 and len(info) > 1: flag += ' <-- row off-centre'; bad = 1
    if hmax + 1 < max(24, 0.06 * H): flag += f' <-- too small ({hmax + 1}px, min {max(24, round(0.06 * H))}px)'; bad = 1
    print(f'band y {y0}-{y1}  centre x {cx:.1f}  groups(x0,x1,top,bottom) {info}{flag}')
print('FAIL' if bad else 'ok'); sys.exit(bad)
