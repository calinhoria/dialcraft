#!/usr/bin/env python3
"""Slice the Street Fighter II sheets into watchface assets (fighters, HUD, fx, stage).

Everything lands in ./assets. Run this before gen_recipe.py.
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw

SRC = '/Users/calinbelut/Downloads/sf2 sprites'
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = f'{ROOT}/assets'
CELLBG = np.array([85, 170, 255])     # fighter sheet cell background
GAP = np.array([0, 85, 127])          # teal between sheet rows
MAGIC = (255, 0, 255)
SCALE = 2

for sub in ['ryu', 'ken', 'fx', 'hud']:
    os.makedirs(f'{OUT}/{sub}', exist_ok=True)

FIGHTERS = f'{SRC}/Arcade - Street Fighter 2 _ Super Street Fighter 2 - Fighters - %s.png'
HUD = f'{SRC}/Arcade - Street Fighter 2 _ Super Street Fighter 2 - Miscellaneous - Game Text, Fonts, & Health Bars.png'
FX = f'{SRC}/Arcade - Street Fighter 2 _ Super Street Fighter 2 - Miscellaneous - Effects.png'
STAGE = f"{SRC}/Arcade - Street Fighter 2 _ Super Street Fighter 2 - Stages - Blanka's Stage.png"


# ----------------------------------------------------------------- fighters --
def sheet(name):
    return Image.open(FIGHTERS % name).convert('RGB')


def band_boxes(mask):
    rows = mask.sum(axis=1)
    bands, inb = [], False
    for y, v in enumerate(rows):
        if v > 2 and not inb:
            start, inb = y, True
        elif v <= 2 and inb:
            bands.append((start, y - 1)); inb = False
    if inb:
        bands.append((start, len(rows) - 1))
    return bands


def frame_boxes(mask, bands):
    out = {}
    for bi, (s, e) in enumerate(bands):
        if e - s + 1 <= 20:            # the little caption rows
            continue
        sub = mask[s:e + 1]
        xs = np.where(sub.sum(axis=0) > 0)[0]
        if not len(xs):
            continue
        segs, st, prev = [], xs[0], xs[0]
        for x in xs[1:]:
            if x - prev > 1:
                segs.append((st, prev)); st = x
            prev = x
        segs.append((st, prev))
        frs = []
        for x0, x1 in segs:
            ys = np.where(sub[:, x0:x1 + 1].sum(axis=1) > 0)[0]
            frs.append((int(x0), int(s + ys.min()), int(x1), int(s + ys.max())))
        out[bi] = frs
    return out


def keyed_crop(im, box, pad=2, bg=CELLBG):
    """RGBA crop with the cell background flooded out from the border."""
    x0, y0, x1, y1 = box
    crop = im.crop((max(0, x0 - pad), max(0, y0 - pad), x1 + 1 + pad, y1 + 1 + pad)).copy()
    w, h = crop.size
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (0, h // 2), (w - 1, h // 2), (w // 2, h - 1)]:
        if crop.getpixel(seed) == tuple(int(v) for v in bg):
            ImageDraw.floodfill(crop, seed, MAGIC, thresh=0)
    a = np.array(crop)
    alpha = (np.abs(a.astype(int) - np.array(MAGIC)).sum(axis=2) > 10)
    # pockets the flood fill cannot reach (between an arm and the body), and the
    # teal separator rows the 2 px padding picks up
    alpha &= (np.abs(a.astype(int) - bg).sum(axis=2) > 6)
    alpha &= (np.abs(a.astype(int) - GAP).sum(axis=2) > 6)
    out = np.zeros((a.shape[0], a.shape[1], 4), 'uint8')
    out[..., :3] = a
    out[..., 3] = (alpha * 255).astype('uint8')
    out[~alpha] = 0
    return Image.fromarray(out, 'RGBA')


def ink(img):
    return np.array(img)[:, :, 3] > 8


def frame_box(img):
    """(anchor_x, anchor_y, ink left/right/top/bottom) inside this crop."""
    m = ink(img)
    ys = np.where(m.any(axis=1))[0]
    xs = np.where(m.any(axis=0))[0]
    top, bot, left, right = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
    if bot - top + 1 < 110:                 # lying down: centre the body, feet mean nothing
        ax = int(round((left + right) / 2))
    else:                                   # standing: the feet are the anchor
        lo = max(top, bot - max(2, int((bot - top + 1) * 0.10)))
        feet = np.where(m[lo:bot + 1].any(axis=0))[0]
        ax = int(round((feet.min() + feet.max()) / 2)) if len(feet) else (left + right) // 2
    return ax, bot, left, right, top, bot


def norm_mask(img, size=56):
    m = ink(img)
    return np.array(Image.fromarray((m * 255).astype('uint8')).resize((size, size), Image.BILINEAR)).astype(np.float32) / 255.


R = {}
BOXES = {}
for name in ['Ryu', 'Ken']:
    im = sheet(name)
    a = np.array(im).astype(int)
    mask = (np.abs(a - CELLBG).sum(axis=2) != 0) & (np.abs(a - GAP).sum(axis=2) != 0)
    bands = band_boxes(mask)
    boxes = frame_boxes(mask, bands)
    BOXES[name] = boxes
    R[name] = {bi: [keyed_crop(im, b) for b in bs] for bi, bs in boxes.items()}
    print(name, 'bands', len(R[name]), 'frames', sum(len(v) for v in R[name].values()))

ken_all = [(bi, i, norm_mask(img)) for bi, lst in R['Ken'].items() for i, img in enumerate(lst)]


def best_ken(img):
    r = norm_mask(img)
    best = (9.0, None)
    for bi, i, km in ken_all:
        s = float(np.abs(r - km).mean())
        if s < best[0]:
            best = (s, (bi, i))
    return best


CLIPS = {
    'idle': (15, [0, 1, 2, 3]),
    'punch': (24, [0, 1]),
    'punchH': (25, [0, 1, 2]),
    'crouchP': (29, [0, 1]),
    'kickL': (27, [0, 1, 2]),
    'kickB': (28, [0, 1, 2]),
    'kickH': (34, [0, 1]),
    'kickR': (35, [0, 1, 2, 3, 4]),
    'sweep': (40, [0, 1, 2, 3]),
    'block': (50, [0, 1]),
    'fire': (47, [0, 1, 2, 3]),
    'shoryu': (48, [0, 1, 2, 3, 4, 5]),
    'tatsu': (49, [0, 1, 2, 3, 4, 5]),
    'hit': (52, [0, 1, 2, 3]),
    'down': (58, [0, 1, 2, 3, 4]),
    'up': (59, [0, 1, 2, 3]),
    'win': (60, [0, 1, 2]),
}

# the sheet draws every frame at its in-game height, so the ground line of a band
# tells us how high each airborne frame really is (shoryuken, hurricane kick)
GROUND = {}
for who in ['Ryu', 'Ken']:
    GROUND[who] = {bi: max(b[3] for b in bs) for bi, bs in BOXES[who].items()}

pairs = []
for clip, (bi, idxs) in CLIPS.items():
    for i in idxs:
        ry = R['Ryu'][bi][i]
        score, key = best_ken(ry)
        kb = key[0]
        pairs.append((clip, i, ry, R['Ken'][kb][key[1]], score, bi, kb))
        print(f'  {clip}.{i} -> Ken {key} score {score:.3f}')


# the sheet only encodes a small hop for the airborne specials; lift them into a
# readable arc (native px, per frame)
LIFT = {
    'shoryu': [0, -4, -18, -30, -16, 0],
    'tatsu': [0, -6, -14, -12, -4, 0],
}


def frame_dy(who, bi, i, clip=None):
    """How much higher than the band's ground line this frame sits in the sheet."""
    d = BOXES[who][bi][i][3] - GROUND[who][bi]
    if clip in LIFT:
        d += LIFT[clip][i]
    return d


def compute_canvas(who):
    lo = hi = None
    top_min = 0
    for clip, i, ry, kn, sc, bi, kb in pairs:
        img = ry if who == 'ryu' else kn
        ax, ay, left, right, top, bot = frame_box(img)
        dy = frame_dy('Ryu' if who == 'ryu' else 'Ken', bi if who == 'ryu' else kb, i, clip)
        d0, d1 = left - ax, right - ax
        lo = d0 if lo is None else min(lo, d0)
        hi = d1 if hi is None else max(hi, d1)
        top_min = min(top_min, (top - bot) + dy)
    pad = 2
    return lo - pad, hi + pad, top_min - pad


manifest = {'ryu': {}, 'ken': {}, 'cell': {}}
for who in ['ryu', 'ken']:
    lo, hi, ty = compute_canvas(who)
    nw, nh = int(hi - lo), int(-ty) + 4
    ax, ay = -lo, -ty + 2
    manifest['cell'][who] = {'w': nw * SCALE, 'h': nh * SCALE, 'ax': ax * SCALE, 'ay': ay * SCALE}
    manifest[who] = {k: [] for k in CLIPS}
    print(who, 'cell native', nw, nh, 'anchor', ax, ay)

for clip, i, ry, kn, sc, bi, kb in pairs:
    for who, img in [('ryu', ry), ('ken', kn)]:
        cell = manifest['cell'][who]
        nw, nh = cell['w'] // SCALE, cell['h'] // SCALE
        ax, ay = cell['ax'] // SCALE, cell['ay'] // SCALE
        canvas = Image.new('RGBA', (nw, nh), (0, 0, 0, 0))
        fx, fy, left, right, top, bot = frame_box(img)
        dy = frame_dy('Ryu' if who == 'ryu' else 'Ken', bi if who == 'ryu' else kb, i, clip)
        canvas.alpha_composite(img, (ax - fx, ay + dy - fy))
        if who == 'ryu':                    # Ryu faces left in the sheet; he fights on the left
            canvas = canvas.transpose(Image.FLIP_LEFT_RIGHT)
        big = canvas.resize((nw * SCALE, nh * SCALE), Image.NEAREST)
        name = f'{clip}_{i}.png'
        big.save(f'{OUT}/{who}/{name}')
        manifest[who][clip].append(name)

manifest['cell']['ryu']['ax'] = manifest['cell']['ryu']['w'] - manifest['cell']['ryu']['ax']

# the travelling fireball: Ryu's sheet, the "Hadouken (General)" row (band 70, frames 0-1),
# padded onto one canvas so the two frames do not jump when they alternate
for i in range(2):
    im = R['Ryu'][70][i]
    big = im.resize((im.width * SCALE, im.height * SCALE), Image.NEAREST)
    c = Image.new('RGBA', (76, 80), (0, 0, 0, 0))
    c.alpha_composite(big, ((76 - big.width) // 2, (80 - big.height) // 2))
    c.save(f'{OUT}/fx/orb_{i}.png')
Image.new('RGBA', (4, 4), (0, 0, 0, 0)).save(f'{OUT}/fx/empty.png')


# ---------------------------------------------------------------- hit spark --
def keyed_fx(box, pad=1, scale=2):
    im = Image.open(FX).convert('RGB')
    fbg = np.array([42, 81, 114])
    x0, y0, x1, y1 = box
    c = im.crop((max(0, x0 - pad), max(0, y0 - pad), x1 + 1 + pad, y1 + 1 + pad)).copy()
    w, h = c.size
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if c.getpixel(seed) == tuple(int(v) for v in fbg):
            ImageDraw.floodfill(c, seed, MAGIC, thresh=0)
    a = np.array(c)
    m = (np.abs(a.astype(int) - np.array(MAGIC)).sum(axis=2) > 10)
    m &= (np.abs(a.astype(int) - fbg).sum(axis=2) > 6)
    o = np.zeros((a.shape[0], a.shape[1], 4), 'uint8')
    o[..., :3] = a
    o[..., 3] = (m * 255).astype('uint8')
    o[~m] = 0
    img = Image.fromarray(o, 'RGBA')
    return img.resize((img.width * scale, img.height * scale), Image.NEAREST)


SPARK_BOXES = [(158, 66, 176, 90), (180, 68, 204, 92), (206, 68, 232, 92)]
SW, SH = 64, 60
for i, b in enumerate(SPARK_BOXES):
    im = keyed_fx(b)
    c = Image.new('RGBA', (SW, SH), (0, 0, 0, 0))
    c.alpha_composite(im, ((SW - im.width) // 2, (SH - im.height) // 2))
    c.save(f'{OUT}/fx/spark_{i}.png')


# --------------------------------------------------------------------- HUD --
def hud_key(img, bg=np.array([111, 99, 87]), tol=18):
    a = np.array(img.convert('RGB')).astype(int)
    m = (np.abs(a - bg).sum(axis=2) > tol)
    o = np.zeros((a.shape[0], a.shape[1], 4), 'uint8')
    o[..., :3] = a
    o[..., 3] = (m * 255).astype('uint8')
    o[~m] = 0
    return Image.fromarray(o, 'RGBA')


def hud():
    im = Image.open(HUD).convert('RGB')
    runs = [(16, 27), (34, 42), (48, 60), (64, 76), (80, 92), (96, 108), (112, 123), (128, 140), (144, 155), (160, 171)]
    for i, (x0, x1) in enumerate(runs):
        cx = (x0 + x1 + 1) / 2.0
        left = int(round(cx - 7.5))
        c = hud_key(im.crop((left, 32, left + 15, 49)))
        c = c.resize((60, 68), Image.NEAREST)          # uniform 15 px cells, 4x
        c.save(f'{OUT}/hud/digit_{i}.png')
    c = hud_key(im.crop((139, 101, 143, 111)))
    c = c.resize((c.width * 3, c.height * 3), Image.NEAREST)
    c.save(f'{OUT}/hud/colon.png')
    for name, box in [('ryu', (16, 56, 44, 66)), ('ken', (128, 56, 158, 66))]:
        d = hud_key(im.crop(box))
        a = np.array(d); ys, xs = np.where(a[:, :, 3] > 8)
        d = d.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
        d = d.resize((d.width * 2, d.height * 2), Image.NEAREST)
        d.save(f'{OUT}/hud/name_{name}.png')
    c = hud_key(im.crop((16, 168, 82, 195)))
    a = np.array(c); ys, xs = np.where(a[:, :, 3] > 8)
    c = c.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    c = c.resize((c.width * 3, c.height * 3), Image.NEAREST)
    c.save(f'{OUT}/hud/fight.png')
    # KO: crop its black outline, then peel the health bar it sits on off the border
    ko = im.crop((159, 0, 195, 16)).copy()
    arr = np.array(ko).astype(int)
    bgs = [np.array([255, 0, 0]), np.array([255, 255, 0]), np.array([111, 99, 87]), np.array([0, 0, 0])]
    h, w = arr.shape[:2]
    seen = np.zeros((h, w), bool)
    stack = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    while stack:
        y, x = stack.pop()
        if y < 0 or x < 0 or y >= h or x >= w or seen[y, x]:
            continue
        seen[y, x] = True
        px = arr[y, x]
        if min(np.abs(px - b).sum() for b in bgs) > 30:
            continue
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx]:
                stack.append((ny, nx))
    o = np.zeros((h, w, 4), 'uint8')
    o[..., :3] = arr
    o[..., 3] = ((~seen) * 255).astype('uint8')
    ko = Image.fromarray(o, 'RGBA')
    a = np.array(ko); ys, xs = np.where(a[:, :, 3] > 8)
    ko = ko.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    ko = ko.resize((ko.width * 4, ko.height * 4), Image.NEAREST)
    ko.save(f'{OUT}/hud/ko.png')


hud()


# ------------------------------------------------------------ text banners --
def text_banners():
    """ROUND 1-3 and YOU WIN, composed from the sheet's own arcade font."""
    im = Image.open(HUD).convert('RGB')
    a = np.array(im).astype(int)
    bg = np.array([111, 99, 87])
    m = (np.abs(a - bg).sum(axis=2) > 20)

    def runs(y0, y1):
        cols = m[y0:y1 + 1, 14:212].sum(axis=0) > 0
        out, st, prev = [], None, None
        for x in range(len(cols)):
            if cols[x]:
                if st is None:
                    st = x
                prev = x
            elif st is not None:
                out.append((st + 14, prev + 14)); st = None
        if st is not None:
            out.append((st + 14, prev + 14))
        return out

    glyphs = {}
    for i, (x0, x1) in enumerate(runs(101, 110)[:10]):
        glyphs[str(i)] = (x0, x1, 101, 110)
    for i, (x0, x1) in enumerate(runs(113, 122)):
        glyphs['@ABCDEFGHIJKLMNO'[i]] = (x0, x1, 113, 122)
    for i, (x0, x1) in enumerate(runs(125, 134)):
        glyphs['PQRSTUVWXYZ[\\]^_'[i]] = (x0, x1, 125, 134)

    def word(text, scale=4, gap=1):
        parts = []
        for ch in text:
            if ch == ' ':
                parts.append(None)
            else:
                x0, x1, y0, y1 = glyphs[ch]
                parts.append(im.crop((x0, y0, x1 + 1, y1 + 1)))
        W = sum((p.width if p else 7) + gap for p in parts) - gap
        Hh = max(p.height for p in parts if p)
        out = Image.new('RGBA', (W, Hh), (0, 0, 0, 0))
        x = 0
        for p in parts:
            if p is None:
                x += 7 + gap
                continue
            keyed = hud_key(p)
            out.alpha_composite(keyed, (x, 0))
            x += p.width + gap
        return out.resize((out.width * scale, out.height * scale), Image.NEAREST)

    for i, t in enumerate(['ROUND 1', 'ROUND 2', 'ROUND 3']):
        word(t).save(f'{OUT}/hud/round_{i + 1}.png')
    word('YOU WIN').save(f'{OUT}/hud/youwin.png')

    # the round timer: the same font, uniform 12 px cells so 99 never shifts
    small = runs(101, 110)[:10]
    for i, (x0, x1) in enumerate(small):
        cx = (x0 + x1 + 1) / 2.0
        left = int(round(cx - 6))
        c = hud_key(im.crop((left, 101, left + 12, 111)))
        c = c.resize((24, 20), Image.NEAREST)
        c.save(f'{OUT}/hud/timer_{i}.png')

    # KO for the little block between the bars (the 4x one is the big banner)
    ko1 = Image.open(f'{OUT}/hud/ko.png')
    ko1.resize((ko1.width // 4, ko1.height // 4), Image.NEAREST).save(f'{OUT}/hud/ko_small.png')


text_banners()


# ------------------------------------------------------------------- stage --
def stage():
    im = Image.open(STAGE).convert('RGB')
    bgc = np.array([63, 96, 57])
    x0, y0, w, h = 230, 15, 195, 225
    c = np.array(im.crop((x0, y0, x0 + w, y0 + h))).astype(float)
    green = (np.abs(c - bgc).sum(axis=2) <= 18)
    H, W, _ = c.shape
    top = np.array([74, 160, 224], float)
    horiz = np.array([206, 238, 251], float)
    out = c.copy()
    for y in range(H):
        t = min(1, y / (H * 0.62))
        out[y, green[y]] = top * (1 - t) + horiz * t
    for x in range(W):                        # holes between sea and deck: interpolate
        y = 0
        while y < H:
            if green[y, x]:
                a0 = y
                while y < H and green[y, x]:
                    y += 1
                a1 = y
                if a0 > 0 and a1 < H:
                    above, below = out[a0 - 1, x], out[a1, x]
                    for yy in range(a0, a1):
                        t = (yy - (a0 - 1)) / (a1 - (a0 - 1))
                        out[yy, x] = above * (1 - t) + below * t
            else:
                y += 1
    img = Image.fromarray(out.astype('uint8')).resize((390, 450), Image.NEAREST)
    a = np.array(img).astype(float)
    prof = {0: 0.38, 60: 0.30, 110: 0.42, 160: 0.42, 210: 0.34, 260: 0.12, 320: 0.0, 449: 0.0}
    ys = sorted(prof)
    for y in range(450):
        k = 0.88
        for i in range(len(ys) - 1):
            if ys[i] <= y <= ys[i + 1]:
                t = (y - ys[i]) / (ys[i + 1] - ys[i])
                k *= 1 - (prof[ys[i]] * (1 - t) + prof[ys[i + 1]] * t)
                break
        a[y] *= k
    Image.fromarray(np.clip(a, 0, 255).astype('uint8')).save(f'{ROOT}/bg_final.png')


stage()

json.dump(manifest, open(f'{OUT}/manifest.json', 'w'), indent=1)
print(json.dumps({k: ({kk: len(vv) for kk, vv in v.items()} if k != 'cell' else v) for k, v in manifest.items()}, indent=1))
