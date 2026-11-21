#!/usr/bin/env python3
"""Fortune Wheel pictures, from the Nano Banana art.
   art/cards.png  6 glossy cards (purple, blue, green, yellow, orange, red) on flat magenta, 3 x 2 grid
   art/dial.png   the middle dial (black knob in a red teardrop pointing to 3 o'clock) on flat green
   Each card is bent into a 30-degree slice of the wheel (12 slices, every colour twice, equal gaps: the wheel is exactly symmetric),
   the words are written on the slices in a condensed bold font (exact spelling), the dial is keyed and scaled around the knob centre,
   and a black cover hides the wheel behind the time. Output in build/."""
import json, math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
H = os.path.dirname(os.path.abspath(__file__)); ART = H + '/art'; B = H + '/build'; os.makedirs(B, exist_ok=True)
ROOT = os.path.abspath(os.path.join(H, '..', '..'))
CX, CY = 195, 225                 # pivot on the screen (screen centre)
R = 195                           # wheel radius: the wheel fits the screen width (touches both sides)
R0 = 43                           # inner end of the cards: a 3 px black gap around the plate
N = 12; STEP = 360 / N; GAP = 6   # 12 cards, 30 degrees each, 6 px black gap between neighbours
DIAL = 40                         # the red teardrop's height on the screen, px
LABELS = ['YES', 'NO', 'MAYBE', 'ABSOLUTELY', 'ASK AGAIN', 'BETTER NOT', 'LOL NO', 'SLEEP ON IT', 'ASK THE CAT', 'DREAM ON', 'OBVIOUSLY', 'NOT NOW']
CENTRES = [STEP * k + STEP / 2 for k in range(N)]     # card centres, degrees clockwise from the top (at wheel angle 0)

# ---- cards: key the magenta, cut the six tiles (grid order)
a = np.asarray(Image.open(ART + '/cards.png').convert('RGB')).astype(int)
key = (a[:, :, 0] > 200) & (a[:, :, 2] > 200) & (a[:, :, 1] < 110)
fg = ~key
def spans(v):
    out, on = [], None
    for i, x in enumerate(v):
        if x and on is None: on = i
        if not x and on is not None: out.append((on, i - 1)); on = None
    if on is not None: out.append((on, len(v) - 1))
    return [s for s in out if s[1] - s[0] > 40]
rows = spans(fg.sum(axis=1) > 20)
tiles = []
for (y0, y1) in rows:
    for (x0, x1) in spans(fg[y0:y1 + 1].sum(axis=0) > 20):
        t = a[y0 + int((y1 - y0) * 0.07):y1 - int((y1 - y0) * 0.07), x0 + 3:x1 - 2].astype(float)   # drop the keyed fringe and the card's top border (it would light up the rim)
        tiles.append(t)
assert len(tiles) == 6, 'expected 6 cards, found %d' % len(tiles)
# soften the gloss band of the art (its hard curved edge shows as an arc on every slice): blend each card towards a smooth
# top-to-bottom shade of its own body colour, keeping GLOSS of the original detail
GLOSS = float(os.environ.get('GLOSS', 1.0))
for i, t in enumerate(tiles):
    h_ = t.shape[0]; body = np.median(t[int(h_ * 0.55):int(h_ * 0.95), int(t.shape[1] * 0.2):int(t.shape[1] * 0.8)].reshape(-1, 3), axis=0)
    shade = np.linspace(1.10, 0.92, h_)[:, None, None]
    tiles[i] = GLOSS * t + (1 - GLOSS) * np.clip(body[None, None, :] * shade, 0, 255)

# ---- bend: every output pixel (supersampled x2) looks up its card at (across, along)
SS = 2; D = 2 * R * SS
yy, xx = np.mgrid[0:D, 0:D].astype(float)
dx, dy = (xx + 0.5) / SS - R, (yy + 0.5) / SS - R
r = np.hypot(dx, dy); th = (np.degrees(np.arctan2(dx, -dy)) + 360) % 360
k = np.floor(th / STEP).astype(int) % N
phi = th - (k * STEP + STEP / 2)
half = STEP / 2 - np.degrees(np.arcsin(np.clip(GAP / 2 / np.maximum(r, 1), 0, 1)))
inside = (r >= R0) & (r <= R) & (np.abs(phi) <= half)
out = np.zeros((D, D, 3))
for c in range(6):
    t = tiles[c]; th_, tw = t.shape[:2]
    m = inside & (k % 6 == c)
    u = ((phi[m] + half[m]) / (2 * half[m]) * (tw - 1))
    v = ((r[m] - R0) / (R - R0) * (th_ - 1))           # the card's glossy top at the inner end, its deeper colour towards the rim
    u0 = np.clip(np.floor(u).astype(int), 0, tw - 2); v0 = np.clip(np.floor(v).astype(int), 0, th_ - 2)
    fu = (u - u0)[:, None]; fv = (v - v0)[:, None]
    px = t[v0, u0] * (1 - fu) * (1 - fv) + t[v0, u0 + 1] * fu * (1 - fv) + t[v0 + 1, u0] * (1 - fu) * fv + t[v0 + 1, u0 + 1] * fu * fv
    out[m] = px
wheel = Image.fromarray(out.clip(0, 255).astype('uint8')).resize((2 * R, 2 * R), Image.LANCZOS).convert('RGBA')

# ---- the words: condensed bold, black, along the radius, reading outwards, centred on the card's centre line
FONT = ROOT + '/assets/fonts/Oswald-SemiBold.ttf'
RS, RE = R0 + 10, 188                      # the part of the card that is on the screen on the right side
for kk, word in enumerate(LABELS):
    size = 27
    while size > 14:
        f = ImageFont.truetype(FONT, size); bb = f.getbbox(word)
        if bb[2] - bb[0] <= RE - RS: break
        size -= 1
    bb = f.getbbox(word); w, h = bb[2] - bb[0], bb[3] - bb[1]
    lay = Image.new('RGBA', (w + 8, h + 8), (0, 0, 0, 0))
    ImageDraw.Draw(lay).text((4 - bb[0], 4 - bb[1]), word, font=f, fill=(16, 16, 16, 255))
    ang = CENTRES[kk]
    rot = lay.rotate(90 - ang, expand=True, resample=Image.BICUBIC)
    mid = RS + (w + 8) / 2; ca = math.radians(ang)
    px, py = R + mid * math.sin(ca), R - mid * math.cos(ca)
    wheel.alpha_composite(rot, (int(round(px - rot.width / 2)), int(round(py - rot.height / 2))))
# full-screen picture at (0, 0) with the wheel centred on the pivot, like the smooth second hand preset: the watch reads center_x / center_y
# relative to the picture's own top-left, so only at (0, 0) do the picture's pivot and the screen's pivot agree (otherwise it turns off-axis)
full = Image.new('RGB', (390, 450), (0, 0, 0)); full.paste(wheel.convert('RGB'), (CX - R, CY - R)); full.save(B + '/wheel.png')

# ---- the dial: key the green, find the knob centre (the black part), scale the red teardrop to DIAL px high
d = Image.open(ART + '/dial.png').convert('RGB'); da = np.asarray(d).astype(int)
g = (da[:, :, 1] > 170) & (da[:, :, 0] < 120) & (da[:, :, 2] < 120)
alpha = Image.fromarray(np.where(g, 0, 255).astype('uint8')).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
d.putalpha(alpha)
blk = (da.max(axis=2) < 60) & ~g
ys, xs = np.nonzero(blk); kx, ky = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
ys2, xs2 = np.nonzero(~g); red_h = ys2.max() - ys2.min()
reach = max(xs2.max() - kx, kx - xs2.min(), ys2.max() - ky, ky - ys2.min()) + 8
# longer point (the reference's arrow): stretch everything right of the black knob horizontally, the circle and knob stay round
rr = red_h / 2; d0 = 0.72 * rr; TIP = float(os.environ.get('TIP', 2.3))       # tip distance from the knob centre, in red radii
tip_now = xs2.max() - kx; kst = (TIP * rr - d0) / (tip_now - d0)
dw = int(kx + TIP * rr + 12); src = np.asarray(d).astype(float); outd = np.zeros((src.shape[0], max(dw, src.shape[1]), 4))
xo = np.arange(outd.shape[1]); dd = xo - kx; xsrc = np.where(dd <= d0, xo, kx + d0 + (dd - d0) / kst)
x0i = np.clip(np.floor(xsrc).astype(int), 0, src.shape[1] - 2); fx = (xsrc - x0i)[None, :, None]
outd = src[:, x0i] * (1 - fx) + src[:, x0i + 1] * fx
d = Image.fromarray(outd.clip(0, 255).astype('uint8'), 'RGBA')
reach = max(TIP * rr, kx - xs2.min(), ys2.max() - ky, ky - ys2.min()) + 8
crop = d.crop((int(kx - reach), int(ky - reach), int(kx + reach), int(ky + reach)))
s = DIAL / red_h; side = int(round(2 * reach * s)) | 1
crop.resize((side, side), Image.LANCZOS).save(B + '/dial.png')

# ---- the cover: black over the wheel on the time side (a slice from 195 to 345 degrees, on card gaps at every landing around the pivot), soft 2 px edge
ss = lambda t: (lambda c: c * c * (3 - 2 * c))(np.clip(t, 0, 1))
yy3, xx3 = np.mgrid[0:450, 0:390].astype(float)
VIS = float(os.environ.get('VIS', 200))                     # the visible arc of the wheel, degrees, centred on the pointer (3 o'clock)
dx3, dy3 = xx3 + 0.5 - CX, yy3 + 0.5 - CY; th3 = (np.degrees(np.arctan2(dx3, -dy3)) + 360) % 360; r3 = np.hypot(dx3, dy3)
rel = np.abs((th3 - 90 + 180) % 360 - 180)                  # angle from the pointer direction, 0..180, the same above and below
dist = r3 * np.sin(np.radians(np.clip(VIS / 2 - rel, 0, 90)))   # px to the nearer edge of the arc
left = np.where(rel > VIS / 2, 1.0, 0.8 * ss((30 - dist) / 30))   # hidden outside the arc, a light fade over 30 px inside it
rr3 = np.hypot(xx3 + 0.5 - CX, yy3 + 0.5 - CY); outer = np.where(rr3 >= R - 1, 1.0, 0.88 * np.clip((rr3 - 150) / 44, 0, 1) ** 2.6)   # soft at the inner end, hard at the rim   # a light fade at the rim
A = np.maximum(left, outer)
# under-glass: a very subtle light line just inside the fade, on the visible half (it fades with the cover at the centre line)
GL = float(os.environ.get('GLASS', 0))
line = GL * np.exp(-((rr3 - (R - 1)) / 0.8) ** 2) * (1 - left)
alpha = line + A * (1 - line)
rgb = np.where(alpha[..., None] > 0, (255 * line / np.maximum(alpha, 1e-6))[..., None], 0).repeat(3, axis=2)
Image.fromarray(np.dstack([rgb, 255 * alpha]).clip(0, 255).astype('uint8'), 'RGBA').save(B + '/cover.png')
json.dump({'centres': CENTRES, 'labels': LABELS, 'R': R, 'R0': R0, 'dial': side, 'knob': [float(kx), float(ky)]}, open(B + '/wheel.json', 'w'))
print('tiles', [t.shape[:2] for t in tiles], 'dial side', side, 'knob', round(kx), round(ky))

# ---- the black centre plate (Nano Banana art, optional until it arrives): key the green, scale to just cover the cards' inner ends
PLATE = 80                        # the centre plate's diameter (radius 40)
if os.path.exists(ART + '/plate.png'):
    p = Image.open(ART + '/plate.png').convert('RGB'); pa = np.asarray(p).astype(int)
    gk = (pa[:, :, 1] > 170) & (pa[:, :, 0] < 120) & (pa[:, :, 2] < 120)
    p.putalpha(Image.fromarray(np.where(gk, 0, 255).astype('uint8')).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7)))
    ys, xs = np.nonzero(~gk); pcx, pcy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2; pr = (xs.max() - xs.min()) / 2
    ri = pr * 0.86                                         # inside the grey bezel ring: only the glossy black dome
    p = p.crop((int(pcx - ri), int(pcy - ri), int(pcx + ri), int(pcy + ri))).resize((PLATE, PLATE), Image.LANCZOS)
    pa2 = np.asarray(p).astype(float)
    pa2[:, :, :3] = 255 * (pa2[:, :, :3] / 255) ** 2.2 * 0.35     # black, not grey: keep only a faint gloss
    yy2, xx2 = np.mgrid[0:PLATE, 0:PLATE]; rad = np.hypot(xx2 - PLATE / 2 + 0.5, yy2 - PLATE / 2 + 0.5) / (PLATE / 2)
    edge = np.clip((1 - rad) / 0.04, 0, 1)                         # a clean round edge (no bezel ring)
    # depth: a soft light rim on the upper-right edge, as if lit from there
    ang = np.arctan2(xx2 - PLATE / 2, -(yy2 - PLATE / 2)); wgt = np.clip(np.cos(ang - np.radians(50)), 0, 1) ** 2
    rim = np.exp(-((rad - 0.93) / 0.045) ** 2) * wgt
    pa2[:, :, :3] = np.clip(pa2[:, :, :3] + 95 * rim[:, :, None], 0, 255)
    ramp = np.clip((np.arange(PLATE) / PLATE - 0.47) / 0.15, 0, 1); ramp = ramp * ramp * (3 - 2 * ramp)
    pa2[:, :, 3] = 255 * edge * ramp[None, :]
    Image.fromarray(pa2.astype('uint8')).save(B + '/plate.png'); print('plate', PLATE)
elif os.path.exists(B + '/plate.png'): os.remove(B + '/plate.png')
