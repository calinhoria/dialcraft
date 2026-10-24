#!/usr/bin/env python3
"""Measured checks for the American Poker 2 face: clock centring, gaps, margins."""
import glob
import numpy as np
from PIL import Image
import json

ROOT = '/Volumes/Projects/Projects/dialcraft/sample-watchfaces/american-poker-2'
prev = Image.open(f'{ROOT}/preview.png').convert('RGB')
aod = Image.open(f'{ROOT}/preview-aod.png').convert('RGB')

a = np.array(prev).astype(int)
BG = np.array([0, 0, 230])
ink = (np.abs(a - BG).sum(axis=2) > 40)

# --- clock: white ink in the top band
band = ink[8:66]
cols = band.sum(axis=0) > 0
xs = np.where(cols)[0]
groups, s, p = [], xs[0], xs[0]
for x in xs[1:]:
    if x - p > 3:
        groups.append((s, p)); s = x
    p = x
groups.append((s, p))
print('clock ink runs:', groups)
hour = [g for g in groups if g[1] < 180]
colon = [g for g in groups if 180 <= g[0] <= 205]
minute = [g for g in groups if g[0] > 205]
if hour and colon and minute and len(hour) >= 2:
    hx = (hour[0][0], hour[-1][1])
    mx = (minute[0][0], minute[-1][1])
    cx = colon[0]
    ys = [np.where(band[:, x])[0] for x in range(cx[0], cx[1] + 1)]
    ys = [v for v in ys if len(v)]
    cy = (int(min(v.min() for v in ys)) + 8, int(max(v.max() for v in ys)) + 8)
    hy = [np.where(band[:, x])[0] for x in range(hx[0], hx[1] + 1)]
    hy = (int(min(v.min() for v in hy if len(v)) + 8), int(max(v.max() for v in hy if len(v)) + 8))
    print('hour ink', hx, hy)
    print('colon ink', cx, cy)
    print('minute ink', mx)
    print('gaps', cx[0] - hx[1] - 1, mx[0] - cx[1] - 1)
    print('colon x centre %.1f  midpoint %.1f' % ((cx[0] + cx[1]) / 2, (hx[1] + mx[0]) / 2))
    print('clock centre %.1f (screen 195)' % ((hx[0] + mx[1]) / 2))

# --- cards row: white card bodies
row = ink[88:196]
cols = row.sum(axis=0) > 3
xs = np.where(cols)[0]
print('cards ink x', xs.min(), xs.max(), ' width', xs.max() - xs.min() + 1)

# --- panels
for y in (230, 277):
    r = ink[y]
    xs = np.where(r)[0]
    print('panel row', y, 'ink', xs.min(), xs.max())

# --- project file: boxes
proj = json.load(open(glob.glob(f'{ROOT}/project/*.wfproj.json')[0]))
print('--- layer boxes')
for e in proj['elements']:
    if e['name'] in ('Card 1', 'Card 5', 'Hold 1', 'Mini panel', 'Credit panel', 'Payout table',
                     'Result label', 'Win 1', 'Win 4', 'Table'):
        print(f"   {e['name']:14s} x{e['x']:4.0f} y{e['y']:4.0f} {e['w']:4.0f}x{e['h']:4.0f}")

# --- AOD
aa = np.array(aod).astype(int)
ys, xs = np.where(aa.sum(axis=2) > 60)
print('AOD ink bbox', xs.min(), xs.max(), ys.min(), ys.max(),
      'centre %.1f,%.1f' % ((xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2))
print('AOD lit %.2f%%' % (100 * len(xs) / (aod.width * aod.height)))
