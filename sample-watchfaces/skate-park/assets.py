#!/usr/bin/env python3
"""Build the skate-park face assets: skater sprite frames (CC-BY, overcrafted) + a dusk
skatepark background + Anton clock digits.

Skater art: "Skater Girl 2D" by overcrafted, opengameart.org — CC-BY 4.0.
"""
import glob, json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HOME = os.path.expanduser('~')
SRC = f'{HOME}/Downloads/skate-sprites/girl/Skater Girl 2D Opengameart/animations/PNG Image Sequence'
FONT = '/Volumes/Projects/Projects/dialcraft/assets/fonts/Anton-Regular.ttf'
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = f'{ROOT}/assets'
for sub in ['skate', 'ui']:
    os.makedirs(f'{OUT}/{sub}', exist_ok=True)

# ------------------------------------------------------------------ skater --
CLIPS = {
    'roll': ('roll B', 2),        # every 2nd frame
    'push': ('push single', 2),
    'flip': ('heel flip', 1),     # every frame (the board spins)
    'grab': ('indy grab', 1),
}
TARGET_H = 126


def frames(clip, step):
    fs = sorted(glob.glob(f'{SRC}/{clip}/*.png'))
    return [Image.open(f).convert('RGBA') for f in fs][::step]


def ink_box(im):
    a = np.array(im)[:, :, 3] > 8
    ys, xs = np.where(a)
    return xs.min(), xs.max(), ys.min(), ys.max()


sets = {k: frames(v[0], v[1]) for k, v in CLIPS.items()}
heights = [ink_box(im)[3] - ink_box(im)[2] + 1 for ims in sets.values() for im in ims]
scale = TARGET_H / max(heights)
print('scale', round(scale, 4), 'max height', max(heights))

scaled = {}
ext = [10 ** 9, -10 ** 9, 10 ** 9, -10 ** 9]      # left, right, top, bottom relative to the anchor
for k, ims in sets.items():
    out = []
    for im in ims:
        x0, x1, y0, y1 = ink_box(im)
        w = max(1, round(im.width * scale))
        h = max(1, round(im.height * scale))
        s = im.resize((w, h), Image.LANCZOS)
        # anchor: the wheels' bottom centre
        bx = int(round(((x0 + x1) / 2) * scale))
        by = int(round(y1 * scale))
        out.append((s, bx, by))
        ext[0] = min(ext[0], int(x0 * scale) - bx)
        ext[1] = max(ext[1], int(x1 * scale) - bx)
        ext[2] = min(ext[2], int(y0 * scale) - by)
        ext[3] = max(ext[3], 0)
    scaled[k] = out

pad = 4
CW = ext[1] - ext[0] + pad * 2
CH = -ext[2] + pad * 2
AX, AY = -ext[0] + pad, -ext[2] + pad
print('cell', CW, CH, 'anchor', AX, AY)

manifest = {'cell': {'w': CW, 'h': CH, 'ax': AX, 'ay': AY}, 'clips': {}}
for k, ims in scaled.items():
    manifest['clips'][k] = []
    for i, (im, bx, by) in enumerate(ims):
        c = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
        c.alpha_composite(im, (AX - bx, AY - by))
        name = f'{k}_{i:02d}.png'
        c.save(f'{OUT}/skate/{name}')
        manifest['clips'][k].append(name)

json.dump(manifest, open(f'{OUT}/skate/manifest.json', 'w'), indent=1)
print({k: len(v) for k, v in manifest['clips'].items()})


# -------------------------------------------------------------- background --
def background():
    W, H = 390, 450
    img = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(img)
    # dusk sky
    top, bot = np.array([26, 14, 48]), np.array([255, 122, 77])
    for y in range(H):
        t = min(1, y / 300)
        c = top * (1 - t) + bot * t
        d.line((0, y, W, y), fill=tuple(int(v) for v in c))
    # sun
    d.ellipse((248, 150, 348, 250), fill=(255, 214, 150))
    # clouds
    for (cx, cy, s) in [(60, 120, 1.0), (300, 90, 0.7), (150, 175, 0.55)]:
        d.rounded_rectangle((cx - 40 * s, cy - 12 * s, cx + 40 * s, cy + 12 * s), 12 * s, fill=(58, 36, 80))
        d.rounded_rectangle((cx - 22 * s, cy - 22 * s, cx + 26 * s, cy + 6 * s), 12 * s, fill=(58, 36, 80))
    # skyline
    rng = np.random.default_rng(7)
    x = -10
    while x < W + 10:
        w = int(rng.integers(30, 62))
        h = int(rng.integers(40, 120))
        y0 = 352 - h
        d.rectangle((x, y0, x + w, 352), fill=(17, 11, 32))
        for wy in range(y0 + 8, 344, 14):
            for wx in range(x + 6, x + w - 6, 12):
                if rng.random() < 0.22:
                    d.rectangle((wx, wy, wx + 4, wy + 5), fill=(255, 209, 102))
        x += w + int(rng.integers(4, 12))
    # ground
    d.rectangle((0, 352, W, H), fill=(38, 31, 52))
    d.rectangle((0, 352, W, 356), fill=(74, 63, 96))
    for _ in range(40):
        gx = int(rng.integers(0, W))
        gy = int(rng.integers(360, H))
        d.line((gx, gy, gx + int(rng.integers(6, 26)), gy + int(rng.integers(-3, 4))), fill=(30, 24, 42))
    img.save(f'{ROOT}/bg.png')


background()


# ------------------------------------------------------------------- clock --
def text(s, size, color, shadow=None, off=3, pad=6):
    f = ImageFont.truetype(FONT, size)
    tmp = Image.new('RGBA', (10, 10))
    box = ImageDraw.Draw(tmp).textbbox((0, 0), s, font=f)
    w = box[2] - box[0] + pad * 2
    h = box[3] - box[1] + pad * 2
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if shadow:
        d.text((pad - box[0] + off, pad - box[1] + off), s, font=f, fill=shadow + (255,))
    d.text((pad - box[0], pad - box[1]), s, font=f, fill=color + (255,))
    return im


cells = []
for i in range(10):
    im = text(str(i), 56, (255, 246, 234), (24, 12, 40), 3, 4)
    cells.append(im)
CWc = max(c.width for c in cells)
CHc = max(c.height for c in cells)
for i, im in enumerate(cells):
    c = Image.new('RGBA', (CWc, CHc), (0, 0, 0, 0))
    c.alpha_composite(im, ((CWc - im.width) // 2, (CHc - im.height) // 2))
    c.save(f'{OUT}/ui/clock_{i}.png')
col = text(':', 56, (255, 246, 234), (24, 12, 40), 3, 4)
cc = Image.new('RGBA', (28, CHc), (0, 0, 0, 0))
cc.alpha_composite(col, ((28 - col.width) // 2, (CHc - col.height) // 2))
cc.save(f'{OUT}/ui/clock_colon.png')
Image.new('RGBA', (4, 4), (0, 0, 0, 0)).save(f'{OUT}/ui/empty.png')
print('clock cell', CWc, CHc)
