#!/usr/bin/env python3
"""Compose frames of the simulated poker round (what the watch draws) into one strip."""
import json, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.abspath(__file__))
A = f'{ROOT}/assets'
sim = json.load(open(f'{ROOT}/build/sim.json'))
W, H = 390, 450
CX = [11, 85, 159, 233, 307]
CY, CW, CH = 88, 72, 108
HOLD_Y = 70
PANEL_Y, PANEL_H = 230, 48
P1, P2, P3 = (8, 150), (156, 240), (246, 382)
CRX = [288, 310, 332, 354]
MIX = [100, 122]
WINX = [284, 308, 332, 356]
VAL_Y = PANEL_Y + 22
CAP_Y = PANEL_Y + 5

BG = (0, 0, 230)
CYAN = (33, 255, 255)


def img(p):
    return Image.open(f"{A}/{p.replace('poker/', '')}").convert('RGBA')


def num(parts):
    return ''.join(os.path.basename(p).replace('.png', '').split('_')[-1] for p in parts)


def compose(row):
    c = Image.new('RGBA', (W, H), BG + (255,))
    d = ImageDraw.Draw(c)
    # clock 10:09
    c.alpha_composite(img('ui/clock_colon.png'), (185, 10))
    c.alpha_composite(img('ui/clock_1.png'), (83, 10))
    c.alpha_composite(img('ui/clock_0.png'), (131, 10))
    c.alpha_composite(img('ui/clock_0.png'), (204, 10))
    c.alpha_composite(img('ui/clock_9.png'), (252, 10))
    # cards
    for i, p in enumerate(row['cards']):
        c.alpha_composite(img(p), (CX[i], CY))
        if row['hold'][i] and row['hold'][i] > 0:
            c.alpha_composite(img('ui/hold.png'), (CX[i] + 17, HOLD_Y))
    # result line
    c.alpha_composite(img(row['lbl']), (14, 202))
    for j, p in enumerate(row['win']):
        c.alpha_composite(img(p), (WINX[j], 200))
    # panels
    for (x0, x1), cap in ((P1, 'mini'), (P2, 'bet'), (P3, 'credit')):
        d.rounded_rectangle((x0, PANEL_Y, x1 - 1, PANEL_Y + PANEL_H - 1), 3, fill=CYAN + (255,))
    c.alpha_composite(img('ui/panel_mini.png'), (P1[0] + 6, CAP_Y))
    c.alpha_composite(img('ui/panel_bet.png'), (P2[0] + 6, CAP_Y))
    c.alpha_composite(img('ui/panel_credit.png'), (P3[0] + 6, CAP_Y))
    for j, p in enumerate(row['credit']):
        c.alpha_composite(img(p), (CRX[j], VAL_Y))
    for j, p in enumerate(row['mini']):
        c.alpha_composite(img(p), (MIX[j], VAL_Y))
    c.alpha_composite(img(row_bet(row)), (212, VAL_Y))
    # paytable
    c.alpha_composite(img('ui/paytable.png'), (10, 296))
    return c


def row_bet(row):
    # the bet digit is fixed at 5: its picture in the rotated list
    return 'ui/digit_5.png'


base = sim[0]['t']
rows = {r['t'] - base: r for r in sim}
keys = sorted(rows)


def pick(pred, after=0):
    for k in keys:
        if k >= after and pred(rows[k]):
            return k
    return None


want = [0]
h = pick(lambda r: 'label_01' in r['lbl'])
if h: want.append(h)
w = pick(lambda r: num(r['win']) != '0000')
if w: want.append(w + 120)
g = pick(lambda r: 'label_02' in r['lbl'])
if g:
    want += [g, g + 600, g + 1200]
y = pick(lambda r: 'label_17' in r['lbl'])
if y: want.append(y)
m = pick(lambda r: 'label_16' in r['lbl'])
if m: want.append(m)
want = sorted(set(x for x in want if x in rows))[:8]
tiles = [compose(rows[t]) for t in want]
cols = 4
tw, th = W // 2, H // 2
sheet = Image.new('RGB', (cols * (tw + 6), ((len(tiles) + cols - 1) // cols) * (th + 16)), (18, 18, 18))
d = ImageDraw.Draw(sheet)
for i, t in enumerate(want[:len(tiles)]):
    x, y2 = (i % cols) * (tw + 6), (i // cols) * (th + 16)
    sheet.paste(tiles[i].resize((tw, th), Image.LANCZOS), (x, y2 + 14))
    d.text((x + 2, y2 + 2), f'{t} ms', fill=(255, 220, 0))
sheet.save(f'{ROOT}/build/demo-strip.png')
print('saved build/demo-strip.png', sheet.size, want)
