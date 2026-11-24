"""Flow Glass: draws the liquid-glass digits (translucent white glass with rim light and highlights, so the moving colour behind shows through), the always-on outline set,
the palettes and geometry.json, plus still.png (the scene the canvases draw, for the editor preview) and demo.png."""
import json, math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
H = os.path.dirname(os.path.abspath(__file__)); OUT = H + '/assets/fg'; os.makedirs(OUT, exist_ok=True)
FONT = '/Volumes/Projects/Projects/dialcraft/.claude/skills/create-amazfit-watchface/examples/animated/fonts/fredoka-600.ttf'
SW, SH = 390, 450
geo = {'size': {}, 'names': {}}
def save(im, n): im.save(OUT + '/' + n + '.png', optimize=True)
def blur(a, s): return np.array(Image.fromarray((np.clip(a, 0, 1) * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(s))).astype(float) / 255
def blurf(a, s):                                          # float blur (keeps the range), through 16-bit-like scaling
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype('uint8')); return np.array(im.filter(ImageFilter.GaussianBlur(s))).astype(float) / 255

FONT = '/Volumes/Projects/Projects/dialcraft/.claude/skills/create-amazfit-watchface/examples/animated/fonts/antonio-700.ttf'      # a tall, plain condensed sans
INK = 180; SS = 3; MARG = 16
_f0 = ImageFont.truetype(FONT, 400); _b = _f0.getbbox('0'); EM = int(round(400 * INK / (_b[3] - _b[1]) * SS))
_f = ImageFont.truetype(FONT, EM)
CWd = int(math.ceil(max((_f.getbbox(c)[2] - _f.getbbox(c)[0]) for c in '0123456789') / SS)) + 2 * MARG; CHd = INK + 2 * MARG
def mask(ch):
    b0 = _f.getbbox('0'); bb = _f.getbbox(ch); W_, H_ = CWd * SS, CHd * SS
    m = Image.new('L', (W_, H_), 0); d = ImageDraw.Draw(m); d.text(((W_ - (bb[2] - bb[0])) / 2 - bb[0], (H_ - (b0[3] - b0[1])) / 2 - b0[1]), ch, font=_f, fill=255); return m
def over(base, ba, top, ta):
    oa = ta + ba * (1 - ta); sf = np.where(oa > 1e-6, oa, 1); return (top * ta[..., None] + base * (ba * (1 - ta))[..., None]) / sf[..., None], oa
def simple(ch):
    m = mask(ch); M = np.array(m).astype(float) / 255; H_, W_ = M.shape
    yy = np.linspace(0, 1, H_)[:, None] * np.ones((1, W_)); xx = np.ones((H_, 1)) * np.linspace(0, 1, W_)[None, :]
    one = lambda c: np.broadcast_to(np.array(c, float), (H_, W_, 3))
    # readability first: a dark soft shadow and a thin dark outline under the glass, so the digits stand out from any tile colour
    soft = np.clip(np.array(m.filter(ImageFilter.GaussianBlur(5 * SS))).astype(float) / 255 * 1.5, 0, 1) * 0.62
    out_ = np.clip(np.array(m.filter(ImageFilter.MaxFilter(2 * int(2.0 * SS) + 1))).astype(float) / 255 - M, 0, 1) * 0.92
    rgb, al = one([6, 10, 24]), np.clip(soft, 0, 1) * (1 - M)
    rgb, al = over(rgb, al, one([6, 10, 24]), out_)
    # the glass: nearly opaque, bright cool white sinking to light blue
    top = np.array([252.0, 254, 255]); bot = np.array([184.0, 208, 240]); t = yy[..., None]
    fill = top * (1 - t) + bot * t
    glass_a = M * (0.96 - 0.06 * yy)
    rgb, al = over(rgb, al, fill, glass_a)
    k = int(2.4 * SS)
    inner = np.array(m.filter(ImageFilter.MinFilter(2 * k + 1))).astype(float) / 255
    rim = np.clip(M - inner, 0, 1)
    tl = np.clip(M - np.roll(np.roll(M, 3 * SS, 0), 3 * SS, 1), 0, 1)
    br = np.clip(M - np.roll(np.roll(M, -3 * SS, 0), -3 * SS, 1), 0, 1)
    rgb, al = over(rgb, al, one([70, 100, 150]), br * 0.45)
    rgb, al = over(rgb, al, one([255, 255, 255]), np.clip(rim * 0.5 + tl * 0.9, 0, 1))
    u = xx * 0.55 + yy
    def band(c, w): return np.clip(1 - np.abs(u - c) / w, 0, 1) ** 1.3
    glare = (0.38 * band(0.30, 0.10) + 0.22 * band(0.50, 0.045) + 0.16 * band(0.92, 0.10)) * M          # reflections are kept, but fainter so they never eat into the contrast
    rgb, al = over(rgb, al, one([255, 255, 255]), np.clip(glare, 0, 1))
    arr = np.dstack([np.clip(rgb, 0, 255), np.clip(al, 0, 1) * 255]).astype('uint8'); return Image.fromarray(arr, 'RGBA').resize((CWd, CHd), Image.LANCZOS)
def outline(ch):
    m = mask(ch); M = np.array(m).astype(float) / 255; ring = np.clip(np.array(m.filter(ImageFilter.MaxFilter(2 * SS + 1))).astype(float) / 255 - M, 0, 1)
    rgb = np.ones(M.shape + (3,)) * np.array([226, 214, 222]); return Image.fromarray(np.dstack([rgb, ring * 0.9 * 255]).astype('uint8'), 'RGBA').resize((CWd, CHd), Image.LANCZOS)
for ch in '0123456789': save(simple(ch), 'g' + ch); save(outline(ch), 'a' + ch)
geo['names']['g'] = ['fg/g%d.png' % i for i in range(10)]; geo['names']['a'] = ['fg/a%d.png' % i for i in range(10)]; geo['size']['g'] = [CWd, CHd]
GAP = -14; rowW = 2 * CWd + GAP; X0 = round((SW - rowW) / 2); PITCH = INK + 14; Y1 = round((SH - (2 * INK + 14 + 2 * MARG)) / 2); Y2 = Y1 + PITCH
geo['pos'] = {'hour': [X0, Y1], 'minute': [X0, Y2], 'space': GAP}
# ---------------------------------------------------------------- the sparse honeycomb and the starfield behind it
import random
rng = random.Random(8)
PAL = [[234, 56, 56], [234, 145, 56], [234, 234, 56], [145, 234, 56], [56, 234, 56], [56, 234, 145], [56, 234, 234], [56, 145, 234], [56, 56, 234], [145, 56, 234], [234, 56, 234], [234, 56, 145]]      # a rainbow of 12 hues (every 30 degrees), in order, laid across the screen as diagonal bands
geo['pal'] = PAL
S_ = 20; DX = 1.5 * S_; DY = math.sqrt(3) * S_
def grid():
    out = []
    for c in range(-2, 16):
        for r in range(-2, 16):
            x = 195 + (c - 6) * DX; y = 225 + (r - 6) * DY + (DY / 2 if c % 2 else 0)
            if -8 <= x <= 398 and -12 <= y <= 462: out.append((x, y))
    return out
cand = grid()
# windows: round holes of whole tiles (7 or 19 tiles) in an otherwise full honeycomb; the starfield and a nebula show through them
WIN = [(75, 120, 2), (300, 170, 1), (95, 345, 1), (290, 372, 2)]
def snap(x, y): return min(cand, key=lambda p: math.hypot(p[0] - x, p[1] - y))
wins = []
for (x, y, r) in WIN:
    cx, cy = snap(x, y); wins.append((cx, cy, r))
chosen = list(cand)
geo['windows'] = [[round(cx), round(cy), r, round((r + 0.5) * DY)] for (cx, cy, r) in wins]
def win_of(x, y):
    for i, (cx, cy, r) in enumerate(wins):
        if math.hypot(x - cx, y - cy) <= (r + 0.15) * DY: return i, math.hypot(x - cx, y - cy) / DY
    return -1, 0
geo['tiles'] = []
for (x, y) in chosen:
    wi, dw = win_of(x, y); geo['tiles'].append([round(x), round(y), round(math.hypot(x - 195, y - 225) / DX, 2), wi, round(dw, 2)])
geo['hex'] = {'S': S_, 'rad': S_ * 0.92}
# the starfield: a deep blue-black sky with a faint nebula; many tiny static stars in the picture, and some twinkling ones that the canvas redraws
yy = np.linspace(0, 1, SH)[:, None]; xx = np.linspace(0, 1, SW)[None, :]
sky = np.array([3.0, 4, 12])[None, None, :] * np.ones((SH, SW, 1))
for (cx, cy, rx, ry, col, k) in ((0.3, 0.25, 0.5, 0.35, (30, 18, 70), 0.7), (0.75, 0.7, 0.55, 0.4, (10, 40, 70), 0.6), (0.5, 0.5, 0.35, 0.3, (40, 20, 60), 0.3)):
    g = np.exp(-(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)); sky = sky + g[..., None] * np.array(col)[None, None, :] * k * 0.55
for (cx, cy, r), col in zip(wins, [(110, 60, 200), (30, 130, 170), (170, 70, 140), (70, 90, 210)]):
    rr = (r + 1.1) * DY * 1.5; g = np.exp(-(((np.arange(SW)[None, :] - cx) ** 2 + (np.arange(SH)[:, None] - cy) ** 2) / (2 * (rr * 0.55) ** 2))); sky = sky + g[..., None] * np.array(col)[None, None, :] * 0.30
bg = Image.fromarray(np.clip(sky, 0, 255).astype('uint8'), 'RGB'); bd = ImageDraw.Draw(bg)
for _ in range(220):
    x = rng.uniform(0, SW); y = rng.uniform(0, SH); b = rng.choice([70, 100, 140, 190]); bd.rectangle([int(x), int(y), int(x), int(y)], fill=(b, b, min(255, b + 20)))
tw = []
for _ in range(46):
    if rng.random() < 0.75:                                             # most twinkling stars sit inside the windows, where they can be seen
        cx, cy, r, _ = rng.choice(geo['windows']); a_ = rng.uniform(0, 6.28); rr_ = rng.uniform(0, (r + 0.35) * DY * 0.9); x = round(cx + rr_ * math.cos(a_)); y = round(cy + rr_ * math.sin(a_))
    else: x = round(rng.uniform(4, SW - 4)); y = round(rng.uniform(4, SH - 4))
    big = rng.random() < 0.18
    tw.append({'x': x, 'y': y, 'big': 1 if big else 0, 'ph': round(rng.uniform(0, 6.28), 2), 'sp': round(rng.uniform(0.35, 1.1), 2), 'tint': rng.choice([0, 1, 2])})
geo['stars'] = tw
save(bg, 'bg'); geo['size']['bg'] = [SW, SH]
# a still for the editor's preview: the sky, the stars at mid brightness, the tiles coloured by the field at one moment
def field_idx(x, y, tt, d):
    return int(math.floor((0.6 * x + 0.8 * y) / 560.0 * len(PAL))) % len(PAL)
SS3 = 3; im = Image.new('RGB', (SW * SS3, SH * SS3), (0, 0, 0)); d = ImageDraw.Draw(im)
for st in []:
    c = (190, 200, 235) if st['tint'] == 0 else (235, 215, 190) if st['tint'] == 1 else (200, 230, 240)
    d.rectangle([st['x'] * SS3, st['y'] * SS3, (st['x'] + 1) * SS3 + 2, (st['y'] + 1) * SS3 + 2], fill=c)
    if st['big']: d.line([((st['x'] - 3) * SS3, st['y'] * SS3 + 1), ((st['x'] + 4) * SS3, st['y'] * SS3 + 1)], fill=c, width=2); d.line([(st['x'] * SS3 + 1, (st['y'] - 3) * SS3), (st['x'] * SS3 + 1, (st['y'] + 4) * SS3)], fill=c, width=2)
def hexpts(x, y, r, dx=0, dy=0): return [((x + dx + r * math.cos(math.radians(60 * k))) * SS3, (y + dy + r * math.sin(math.radians(60 * k))) * SS3) for k in range(6)]
for (x, y, dd, wi, dw) in geo['tiles']:
    P_ = hexpts(x, y, S_ * 0.92); d.polygon(P_, fill=tuple(PAL[int((0.6 * x + 0.8 * y) / 560 * len(PAL)) % len(PAL)]))
still = im.resize((SW, SH), Image.LANCZOS); save(still, 'still'); geo['size']['still'] = [SW, SH]
demo = still.convert('RGBA')
for i, ch in enumerate('10'): demo.alpha_composite(Image.open(OUT + '/g%s.png' % ch), (X0 + i * (CWd + GAP), Y1))
for i, ch in enumerate('09'): demo.alpha_composite(Image.open(OUT + '/g%s.png' % ch), (X0 + i * (CWd + GAP), Y2))
demo.convert('RGB').save(H + '/demo.png')
json.dump(geo, open(H + '/geometry.json', 'w'), indent=1); print('ok', len(geo['tiles']), 'tiles', len(tw), 'twinkling stars')
