#!/usr/bin/env python3
"""Assets for the Waterfall Clock (variation 4, exotic jungle).

The whole background (wall, vines, colour light, rays, falling water, pollen, swaying foliage, flowers, macaw, frog, hummingbird
and two butterflies) is ONE full-screen frame animation: NF pictures rendered with the concept's own renderer (wf3 / wf4) and
looped seamlessly (the concept's cross-fade). The water falls straight through: nothing in the background touches the digits.
On top: transparent grained glass digits (native clock) and two random butterflies as sprites.
Source concept: "Waterfall Clock Handoff" wf.py / wf3.py / wf4.py.
"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = f'{ROOT}/assets'
sys.path.insert(0, f'{ROOT}/handoff')
import wf, lg                      # noqa: E402
import wf3 as J                    # noqa: E402
import wf4 as D                    # noqa: E402  (tints J.BG3 with the colour glows)

S, SW, SH, W, H = wf.S, wf.SW, wf.SH, wf.W, wf.H
gblur = wf.gblur
GRADE = np.array([0.98, 1.03, 0.95], np.float32)
NF = 25                 # background pictures; the concept loop is 75 sim steps, so every third one
FPS_BG = 8              # 25 pictures at 8 fps = 3.1 s, the concept's 3 s loop


def grade(c):
    return np.clip(D.sat(c, 1.18) * GRADE, 0, 1)


def downscale(c, a, size):
    """Straight-alpha float RGB + A -> PIL RGBA, resized with premultiplied maths."""
    pm = np.dstack([c * a[..., None], a]).astype(np.float32)
    ims = [Image.fromarray(pm[..., i], 'F').resize(size, Image.LANCZOS) for i in range(4)]
    p = np.stack([np.asarray(i, np.float32) for i in ims], -1)
    al = np.clip(p[..., 3], 0, 1)
    rgb = np.where(al[..., None] > 1e-4, p[..., :3] / np.maximum(al, 1e-4)[..., None], 0)
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 1) * 255, al * 255]).round().astype(np.uint8), 'RGBA')


# ------------------------------------------------------- background frames --
BACK = [D.BFLY[1], D.BFLY[2]]            # the orange and yellow butterflies stay in the picture (their loops are periodic)


def back_insects(t):
    im = Image.new('RGBA', (SW * D.SS, SH * D.SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    ph = math.tau * t
    P_ = D.P
    for cx, cy, ax, ay, kx, ky, p, s, cols, nfl in BACK:
        x = cx + ax * math.sin(ph * kx + p)
        y = cy + ay * math.sin(ph * ky + p * 1.3)
        ang = math.atan2(ay * ky * math.cos(ph * ky + p * 1.3), ax * kx * math.cos(ph * kx + p))
        D.butterfly(d, x * P_, y * P_, ang, s, ph * nfl + p, cols)
    D.hummingbird(d, (70 + 5 * math.sin(ph * 2)) * P_, (392 + 7 * math.sin(ph * 3)) * P_, 20 * P_ / P_, ph * 28)
    im = im.resize((W, H), Image.LANCZOS)
    a = np.asarray(im, np.float32) / 255
    al = a[..., 3:4]
    return np.concatenate([a[..., :3] * al, al], -1)


def bg_frame(sim, t):
    ray = J.rays(t)
    wf.SCENE = (J.BG3 + ray[..., None] * J.RAYCOL * 0.60).astype(np.float32)      # the wall, no digits
    out = wf.render(sim)
    out = out + (ray * 0.15)[..., None] * J.RAYCOL
    J.motes(out, t)
    for lay in (J.fg_layer(t), D.decor_layer(t), back_insects(t)):
        out = out * (1 - lay[..., 3:4]) + lay[..., :3]
    return np.clip(D.sat(out, 1.18) * GRADE, 0, 1)


def render_background():
    wf.SOLID = np.zeros_like(wf.SOLID)                  # the water falls through: nothing to bounce on
    sim = wf.Sim()
    for _ in range(wf.WARM):
        sim.step()
        wf.FOAM[:] = wf.FOAM * 0.8
    raw = []
    for i in range(wf.LOOP + wf.XFADE):
        sim.step()
        raw.append(bg_frame(sim, (i % wf.LOOP) / wf.LOOP))
        print(i, end=' ', flush=True)
    loop = []
    for i in range(wf.LOOP):
        if i < wf.XFADE:                                # the concept's cross-fade closes the water loop
            a = i / wf.XFADE
            loop.append((1 - a) * raw[wf.LOOP + i] + a * raw[i])
        else:
            loop.append(raw[i])
    step = wf.LOOP // NF
    for k in range(NF):
        im = Image.fromarray((loop[k * step] * 255 + 0.5).astype(np.uint8)).resize((SW, SH), Image.LANCZOS)
        im.save(f'{OUT}/bg/bg_{k:02d}.png')
    print('\nbackground frames', NF)


os.makedirs(f'{OUT}/bg', exist_ok=True)
if '--skip-bg' not in sys.argv:
    render_background()

# ------------------------------------------------------------ glass digits --
CELL_W = 138
ROW_TOP = (62, 222)
S4 = 4
K = S4 / 2
FONT_ROUND = '/System/Library/Fonts/SFNSRounded.ttf'
grng = np.random.default_rng(99)


def mask(ch, size=188, top=8, cx=CELL_W // 2, w=CELL_W, h=260):
    f = ImageFont.truetype(FONT_ROUND, int(size * S4))
    f.set_variation_by_name('Heavy')
    m = Image.new('L', (w * S4, h * S4), 0)
    ImageDraw.Draw(m).text((cx * S4, top * S4), ch, font=f, fill=255, anchor='mt')
    return np.asarray(m, np.float32) / 255


def jade(M, seed, dim=1.0):
    """Frosted-looking jade glass: no blur is possible, so it is darker and more opaque than clear glass, has a lit rim and
    moss on top; grain is added after the final downscale (see grain())."""
    h, w = M.shape
    yy_ = np.mgrid[0:h, 0:w][0].astype(np.float32)
    lx, ly = J.LX, J.LY
    mb_s = gblur(M, 1.8 * K); gy_s, gx_s = np.gradient(mb_s); gm_s = np.hypot(gx_s, gy_s) + 1e-6
    mb_n = gblur(M, 4.0 * K); gy_n, gx_n = np.gradient(mb_n)
    dp = np.clip((gblur(M, 7.0 * K) - 0.5) * 2.4, 0, 1)
    edge = (1 - dp) ** 2
    lit_s = np.clip(-(gx_s * lx + gy_s * ly) / gm_s, 0, 1) * np.clip(gm_s * 14 * K, 0, 1)
    lit_b = np.clip(-(gx_n * lx + gy_n * ly) * 9 * K, 0, 1)
    dark_b = np.clip((gx_n * lx + gy_n * ly) * 9 * K, 0, 1)
    ty = (yy_ / h)[..., None]
    col = np.array([0.13, 0.36, 0.22], np.float32) + 0.08 * (1 - ty) + 0.08 * dp[..., None]      # darker than before
    rim = lit_s + 0.22 * np.clip(gm_s * 14 * K, 0, 1)
    col = col + rim[..., None] * np.array([0.95, 1.0, 0.85], np.float32) * 0.85
    col = col + (lit_b * 0.26)[..., None] * np.array([0.7, 1.0, 0.6], np.float32)
    col = col + (dark_b * edge * 0.22)[..., None] * np.array([0.5, 0.95, 0.7], np.float32)
    a = M * (0.68 + 0.18 * dp)                                                                    # more opaque: frosted, not clear
    a = np.maximum(a, M * np.clip(rim * 0.95 + lit_b * 0.45, 0, 1))
    top = np.clip(M - np.roll(M, int(12 * S4), axis=0), 0, 1)
    moss = np.clip(gblur(top, 3.0 * K) * 1.6 * (0.35 + 1.1 * wf.noise_layer(h, w, 6 * K, 6 * K, seed)) - 0.25, 0, 1)
    moss = np.clip(moss * 1.4, 0, 1) * M
    mcol = np.array([0.20, 0.52, 0.16], np.float32) + lit_b[..., None] * 0.12
    col = col * (1 - moss[..., None] * 0.92) + mcol * moss[..., None] * 0.92
    a = np.maximum(a, moss * 0.92)
    return np.clip(col * dim, 0, 1), np.clip(a, 0, 1)


def grain(im, amt=0.02, aamt=0.035):
    """Tiny grain on the finished 1x picture: it reads as frosted glass even though nothing behind is blurred."""
    arr = np.asarray(im, np.float32) / 255
    n = grng.normal(0, 1, arr.shape[:2]).astype(np.float32)
    n2 = grng.normal(0, 1, arr.shape[:2]).astype(np.float32)
    solid = (arr[..., 3] > 0.04)
    arr[..., :3] = np.clip(arr[..., :3] + (n * amt)[..., None] * solid[..., None], 0, 1)
    arr[..., 3] = np.clip(arr[..., 3] + n2 * aamt * np.clip(arr[..., 3] * 2, 0, 1) * np.clip((1 - arr[..., 3]) * 4 + 0.3, 0, 1), 0, 1)
    return Image.fromarray((arr * 255 + 0.5).astype(np.uint8), 'RGBA')


masks = {d: mask(str(d)) for d in range(10)}
ink_top, ink_bot = 10 ** 6, 0
for d in range(10):
    ys, xs = np.where(masks[d] > 0.02)
    ink_top, ink_bot = min(ink_top, ys.min()), max(ink_bot, ys.max())
ink_top, ink_bot = int(ink_top // S4), int(ink_bot // S4)
y0c, y1c = ink_top - 3, ink_bot + 4
for d in range(10):
    c, a = jade(masks[d], 31 + d)
    grain(downscale(c[y0c * S4:y1c * S4], a[y0c * S4:y1c * S4], (CELL_W, y1c - y0c))).save(f'{OUT}/digits/d_{d}.png')
ROWS = [t - 8 + y0c for t in ROW_TOP]

A_SIZE, A_PITCH = 112, 82
am = {d: mask(str(d), A_SIZE, 4, A_PITCH // 2, A_PITCH, 160) for d in range(10)}
aink = [10 ** 6, 0]
for d in range(10):
    ys, xs = np.where(am[d] > 0.02)
    aink = [min(aink[0], ys.min()), max(aink[1], ys.max())]
ay0, ay1 = int(aink[0] // S4) - 2, int(aink[1] // S4) + 2
for d in range(10):
    c, a = jade(am[d], 71 + d, dim=0.6)
    downscale(c[ay0 * S4:ay1 * S4], np.maximum(a * 0.85, am[d] * 0.5)[ay0 * S4:ay1 * S4], (A_PITCH, ay1 - ay0)).save(f'{OUT}/digits/a_{d}.png')

# ---------------------------------------------------------- flying sprites --
P = D.P
CAN = 44
COLS = [b[8] for b in D.BFLY] + [((235, 60, 150), (60, 10, 40), (255, 190, 225))]


def sprite(draw_fn):
    im = Image.new('RGBA', (CAN * P, CAN * P), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(im))
    a = np.asarray(im.resize((CAN * S, CAN * S), Image.LANCZOS), np.float32) / 255
    return downscale(grade(a[..., :3]), a[..., 3], (CAN, CAN))


FLAP = (0.0, math.pi / 3, math.pi / 2)
for bi, cols in enumerate(COLS):
    size = (13, 11, 9, 11)[bi] * 1.7
    for hi, ang in enumerate((0.0, math.pi)):
        for fi, fl in enumerate(FLAP):
            sprite(lambda d, cols=cols, ang=ang, fl=fl, size=size: D.butterfly(d, CAN * P / 2, CAN * P / 2, ang, size, fl, cols)).save(f'{OUT}/bf/b{bi}_{hi}{fi}.png')
for fi, fl in enumerate((0.5, -0.9)):
    sprite(lambda d, fl=fl: D.hummingbird(d, CAN * P * 0.55, CAN * P * 0.55, 20, fl + 1.4)).save(f'{OUT}/bf/hb{fi}.png')
Image.new('RGBA', (4, 4), (0, 0, 0, 0)).save(f'{OUT}/ui/empty.png')

# ------------------------------------------------------------------- text --
FONT = '/System/Library/Fonts/SFNS.ttf'


def txt(s, size=12, color=(220, 244, 214), var='Semibold', pad=1):
    f = ImageFont.truetype(FONT, size * 2)
    f.set_variation_by_name(var)
    tmp = ImageDraw.Draw(Image.new('RGB', (8, 8)))
    box = tmp.textbbox((0, 0), s, font=f)
    w = (box[2] - box[0]) + pad * 4
    h = (box[3] - box[1]) + pad * 4
    im = Image.new('RGBA', (int(w), int(h)), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((pad * 2 - box[0], pad * 2 - box[1]), s, font=f, fill=color + (255,))
    return im.resize((max(1, im.width // 2), max(1, im.height // 2)), Image.LANCZOS)


for i, d in enumerate(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']):
    txt(d).save(f'{OUT}/ui/day_{i}.png')
for i, m in enumerate(['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']):
    txt(m).save(f'{OUT}/ui/month_{i}.png')
for i in range(10):
    txt(str(i)).save(f'{OUT}/ui/num_{i}.png')
txt('·', 12, (170, 205, 160)).save(f'{OUT}/ui/dot.png')
txt('BPM', 9, (170, 205, 160)).save(f'{OUT}/ui/bpm.png')

json.dump({'cell': [CELL_W, y1c - y0c], 'rows': ROWS, 'aod': [A_PITCH, ay1 - ay0], 'can': CAN, 'frames': NF, 'fps': FPS_BG}, open(f'{OUT}/manifest.json', 'w'))
print('done')
