#!/usr/bin/env python3
"""Measured checks on the final previews: colon centring, gaps, margins, safe edge, groups."""
import json, os, glob
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
PREV = f'{ROOT}/preview.png'
AOD = f'{ROOT}/preview-aod.png'
proj = glob.glob(f'{ROOT}/project/*.wfproj.json')[0]
AXE = json.load(open(proj))


def clock_boxes(img, band):
    a = np.array(img.convert('RGB')).astype(int)
    y0, y1 = band
    sub = a[y0:y1]
    blue = (np.abs(sub - np.array([0, 68, 170])).sum(axis=2) < 40)
    orange = (np.abs(sub - np.array([238, 102, 68])).sum(axis=2) < 60)
    ink = blue | orange
    cols = ink.any(axis=0)
    xs = np.where(cols)[0]
    groups, s, prev = [], xs[0], xs[0]
    for x in xs[1:]:
        if x - prev > 2:
            groups.append((s, prev)); s = x
        prev = x
    groups.append((s, prev))
    out = []
    for (gx0, gx1) in groups:
        ys = np.where(ink[:, gx0:gx1 + 1].any(axis=1))[0]
        out.append({'x': (int(gx0), int(gx1)), 'y': (int(ys.min()) + y0, int(ys.max()) + y0)})
    return out


def report(tag, img, band):
    boxes = clock_boxes(img, band)
    colon = [b for b in boxes if 180 <= b['x'][0] <= 205][0]
    hr = [b for b in boxes if b['x'][1] < colon['x'][0]]
    mr = [b for b in boxes if b['x'][0] > colon['x'][1]]
    hour = {'x': (hr[0]['x'][0], hr[-1]['x'][1]), 'y': (min(b['y'][0] for b in hr), max(b['y'][1] for b in hr))}
    minute = {'x': (mr[0]['x'][0], mr[-1]['x'][1]), 'y': (min(b['y'][0] for b in mr), max(b['y'][1] for b in mr))}
    print(f'--- {tag} clock')
    print('   hour ink  ', hour['x'], hour['y'])
    print('   colon ink ', colon['x'], colon['y'])
    print('   minute ink', minute['x'], minute['y'])
    print('   gaps      hour→colon', colon['x'][0] - hour['x'][1] - 1, ' colon→minute', minute['x'][0] - colon['x'][1] - 1)
    print(f'   vertical  digits {(hour["y"][0] + hour["y"][1]) / 2:.1f} / colon {(colon["y"][0] + colon["y"][1]) / 2:.1f} / digits {(minute["y"][0] + minute["y"][1]) / 2:.1f}')
    print(f'   colon x   {(colon["x"][0] + colon["x"][1]) / 2:.1f} vs midpoint {(hour["x"][1] + minute["x"][0]) / 2:.1f}')
    print(f'   clock span {hour["x"][0]}..{minute["x"][1]} centre {(hour["x"][0] + minute["x"][1]) / 2:.1f} (screen 195)')


report('normal', Image.open(PREV), (120, 240))
report('AOD', Image.open(AOD), (180, 280))

a = np.array(Image.open(AOD).convert('RGB'))
ys, xs = np.where(a.sum(axis=2) > 60)
print(f'AOD ink bbox {xs.min()}..{xs.max()} / {ys.min()}..{ys.max()} centre {(xs.min() + xs.max()) / 2:.1f},{(ys.min() + ys.max()) / 2:.1f}')

print('--- HUD margins')
els = {e['name']: e for e in AXE['elements']}
for n in ['Health RYU lost', 'Health KEN lost', 'Frame RYU', 'Frame KEN', 'Name RYU', 'Name KEN']:
    e = els[n]
    print(f"   {n:15s} x {e['x']:3.0f}..{e['x'] + e['w']:3.0f}  y {e['y']:3.0f}..{e['y'] + e['h']:3.0f}")
l, r = els['Frame RYU'], els['Frame KEN']
print('   left margin', l['x'], ' right margin', 390 - (r['x'] + r['w']), ' gap between frames', r['x'] - (l['x'] + l['w']))
print('--- groups')
bygroup = {}
for e in AXE['elements']:
    bygroup.setdefault(e.get('group'), []).append(e['name'])
for k, v in AXE.get('groups', {}).items():
    print('  ', v, '→', bygroup.get(k))
print('--- element order (bottom → top)')
for e in AXE['elements']:
    print('  ', e['name'])
