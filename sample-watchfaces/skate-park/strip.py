#!/usr/bin/env python3
"""Compose frames of the simulated skate run into one strip."""
import json, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.abspath(__file__))
A = f'{ROOT}/assets'
sim = json.load(open(f'{ROOT}/build/sim.json'))
bg = Image.open(f'{ROOT}/bg.png').convert('RGBA')
W, H = bg.size


def img(p):
    q = p.replace('skate/ui/', 'ui/').replace('skate/', 'skate/')
    return Image.open(f'{A}/{q}').convert('RGBA')


def compose(row):
    c = bg.copy()
    c.alpha_composite(img(row['pic']), (row['x'], row['y']))
    # clock 10:09
    c.alpha_composite(img('ui/clock_colon.png'), (181, 26))
    c.alpha_composite(img('ui/clock_1.png'), (105, 26))
    c.alpha_composite(img('ui/clock_0.png'), (141, 26))
    c.alpha_composite(img('ui/clock_0.png'), (213, 26))
    c.alpha_composite(img('ui/clock_9.png'), (249, 26))
    return c


base = sim[0]['t']
rows = {r['t'] - base: r for r in sim}
ks = sorted(rows)
want = [k for k in ks if k <= 4800][::5][:10]
tiles = [compose(rows[t]) for t in want if t in rows]
cols = 5
tw, th = W // 3, H // 3
sheet = Image.new('RGB', (cols * (tw + 5), ((len(tiles) + cols - 1) // cols) * (th + 14)), (18, 18, 18))
d = ImageDraw.Draw(sheet)
for i, t in enumerate(want[:len(tiles)]):
    x, y = (i % cols) * (tw + 5), (i // cols) * (th + 14)
    sheet.paste(tiles[i].resize((tw, th), Image.LANCZOS), (x, y + 12))
    d.text((x + 2, y), f'{t} ms', fill=(255, 220, 0))
sheet.save(f'{ROOT}/build/demo-strip.png')
print('saved build/demo-strip.png', sheet.size)
