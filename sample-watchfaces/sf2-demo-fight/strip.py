#!/usr/bin/env python3
"""Compose the scripted fight from sim.json into one strip (what the watch plays)."""
import json, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.abspath(__file__))
A = f'{ROOT}/assets'
man = json.load(open(f'{A}/manifest.json'))
sim = json.load(open(f'{ROOT}/build/sim.json'))
W, H = 390, 450
BAR_Y, BAR_H, BAR_W = 26, 18, 164
BAR_L_X, BAR_R_X = 12, 214
CLIPS = ['idle', 'punch', 'punchH', 'crouchP', 'kickL', 'kickB', 'kickH', 'kickR', 'sweep', 'tatsu', 'shoryu', 'block', 'fire', 'hit', 'down', 'up', 'win']
HERO = {'ryu': 'punchH_2.png', 'ken': 'hit_1.png'}
bg = Image.open(f'{ROOT}/bg_final.png').convert('RGBA')


def order(who):
    o = [HERO[who]]
    for clip in CLIPS:
        for f in man[who][clip]:
            if f != HERO[who]:
                o.append(f)
    return o


ORD = {'ryu': order('ryu'), 'ken': order('ken')}
BASE = {'ryu': (2, 124), 'ken': (126, 124)}
DIG = [Image.open(f'{A}/hud/digit_{i}.png').convert('RGBA') for i in range(10)]
COLON = Image.open(f'{A}/hud/colon.png').convert('RGBA')


def compose(row):
    c = bg.copy()
    for who in ('ryu', 'ken'):
        im = Image.open(f'{A}/{who}/{ORD[who][row[who]]}').convert('RGBA')
        c.alpha_composite(im, (row['ryuX'] if who == 'ryu' else row['kenX'], BASE[who][1]))
    d = ImageDraw.Draw(c)
    for x0, wv, left in ((BAR_L_X, row['hpL'], True), (BAR_R_X, row['hpR'], False)):
        d.rectangle((x0 - 2, BAR_Y - 2, x0 + BAR_W + 2, BAR_Y + BAR_H + 2), fill=(12, 12, 12, 255))
        d.rectangle((x0, BAR_Y, x0 + BAR_W, BAR_Y + BAR_H), fill=(244, 28, 28, 255))
        if left:
            d.rectangle((x0 + BAR_W - wv, BAR_Y, x0 + BAR_W, BAR_Y + BAR_H), fill=(255, 230, 0, 255))
        else:
            d.rectangle((x0, BAR_Y, x0 + wv, BAR_Y + BAR_H), fill=(255, 230, 0, 255))
    c.alpha_composite(Image.open(f'{A}/hud/name_ryu.png').convert('RGBA'), (12, 48))
    c.alpha_composite(Image.open(f'{A}/hud/name_ken.png').convert('RGBA'), (318, 48))
    # round win pips
    for key, x in (('pip1', 12), ('pip2', 25), ('pip3', 369), ('pip4', 356)):
        if row.get(key) == 72:
            d.ellipse((x, 72, x + 8, 80), fill=(255, 212, 0, 255))
    x = 56
    for ch in '10':
        c.alpha_composite(DIG[int(ch)], (x, 140)); x += 64
    c.alpha_composite(COLON, (187, 155))
    x = 203
    for ch in '09':
        c.alpha_composite(DIG[int(ch)], (x, 140)); x += 64
    if row['sparkXY'][0] > -50:
        f = ['spark_1', 'spark_0', 'spark_2'][[1, 0, 2].index(row['spark'])]
        c.alpha_composite(Image.open(f'{A}/fx/{f}.png').convert('RGBA'), tuple(row['sparkXY']))
    if row['orb'] != 'empty':
        c.alpha_composite(Image.open(f"{A}/fx/{row['orb']}.png").convert('RGBA'), tuple(row['orbXY']))
    # round timer
    if row.get('tens') is not None and (row.get('tensY') or 0) >= 0:
        c.alpha_composite(Image.open(f"{A}/hud/timer_{(row['tens'] + 9) % 10}.png").convert('RGBA'), (171, 47))
        c.alpha_composite(Image.open(f"{A}/hud/timer_{(row['ones'] + 9) % 10}.png").convert('RGBA'), (195, 47))
    if row.get('koko') == 'ko':
        c.alpha_composite(Image.open(f'{A}/hud/ko_small.png').convert('RGBA'), (177, 24))
    if row.get('round') in (1, 2, 3):
        c.alpha_composite(Image.open(f"{A}/hud/round_{row['round']}.png").convert('RGBA'), (53, 98))
    if row.get('youwin') == 'youwin':
        c.alpha_composite(Image.open(f'{A}/hud/youwin.png').convert('RGBA'), (53, 98))
    if row['fight'] == 'fight':
        c.alpha_composite(Image.open(f'{A}/hud/fight.png').convert('RGBA'), (100, 246))
    if row['ko'] == 'ko':
        c.alpha_composite(Image.open(f'{A}/hud/ko.png').convert('RGBA'), (123, 50))
    return c


# pick moments from the simulated round: banner, hits, fireball, KO, win
rows = {r['t']: r for r in sim}
sparks = []
for r in sim:
    if r['spark'] != 0 and r['sparkXY'][0] > -50 and (not sparks or r['t'] - sparks[-1] > 900):
        sparks.append(r['t'])
orbs = [r['t'] for r in sim if r['orb'] != 'empty']
kos = [r['t'] for r in sim if r['ko'] == 'ko']
downs = [r['t'] for r in sim if r['ken'] in (40, 41, 42) or r['ryu'] in (40, 41, 42)]
base = sim[0]['t']
kos2 = [r['t'] for r in sim if r.get('youwin') == 'youwin']
want = [base] + [base + 1000] + sparks[:2]
if orbs:
    want.append(orbs[len(orbs) // 2])
if downs:
    want.append(downs[0])
if kos:
    want += [kos[0] + 300, kos[0] + 1200]
if kos2:
    want += [kos2[0] + 300]
want = sorted(set(t for t in want if t in rows))[:12]
sel = [rows[t] for t in want]
times = want
tiles = [compose(r) for r in sel]
cols = 4
tw, th = W // 2, H // 2
sheet = Image.new('RGB', (cols * (tw + 6), ((len(tiles) + cols - 1) // cols) * (th + 16)), (18, 18, 18))
d = ImageDraw.Draw(sheet)
for i, (t, im) in enumerate(zip(times, tiles)):
    x, y = (i % cols) * (tw + 6), (i // cols) * (th + 16)
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y + 14))
    d.text((x + 2, y + 2), f'{t} ms', fill=(255, 220, 0))
sheet.save(f'{ROOT}/build/demo-strip.png')
print('saved build/demo-strip.png', sheet.size)
