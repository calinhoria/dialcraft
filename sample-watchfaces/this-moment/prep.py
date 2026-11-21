#!/usr/bin/env python3
"""This Moment (after BA | AXR9800 by Bruno Amadori, Facer): the pictures, drawn in code at 4x and scaled down.
Geometry and colours are measured on the original preview (build/original-preview.png, 1104 x 1344) and mapped to the Bip 6 (390 x 450)
with one uniform scale: X = (x - 552) * k + 195, Y = y * k, k = 450 / 1344. The stripes simply continue at the left and right edges.
  build/scene.png   background, chevron stripes, beige field (AXR9800, dashed line, bar), MODE, the LCD window with THIS MOMENT
  build/d_N.png     time digits: monoline strokes with round caps on a rounded-square skeleton (stroke and corners from the original)
  build/a_N.png     the same, dim, for the always-on screen; colon.png / acolon.png"""
import json, math, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
H = os.path.dirname(os.path.abspath(__file__)); B = H + '/build/'
W, HH, S = 390, 450, 4
K = 450 / 1344
X = lambda x: ((x - 552) * K + 195) * S
Y = lambda y: y * K * S
P = lambda pt: (X(pt[0]), Y(pt[1]))
DARK = (36, 25, 23); YEL = (252, 197, 43); ORA = (253, 111, 60); RED = (244, 61, 63); BEI = (222, 206, 183)
LCD = (194, 205, 160); INK = (120, 126, 96); MODEC = (168, 154, 136)
img = Image.new('RGB', (W * S, HH * S), BEI); d = ImageDraw.Draw(img)

def fillet(pts, radii, closed=True, steps=10):
    """polygon / polyline with each listed corner rounded (radius in the same units as pts; 0 = sharp)"""
    out = []; n = len(pts)
    for i, p in enumerate(pts):
        r = radii[i] if isinstance(radii, (list, tuple)) else radii
        if (not closed and (i == 0 or i == n - 1)) or r <= 0: out.append(p); continue
        p0, p2 = pts[i - 1], pts[(i + 1) % n]
        v1 = (p0[0] - p[0], p0[1] - p[1]); v2 = (p2[0] - p[0], p2[1] - p[1]); l1, l2 = math.hypot(*v1), math.hypot(*v2)
        if l1 == 0 or l2 == 0: out.append(p); continue
        u1 = (v1[0] / l1, v1[1] / l1); u2 = (v2[0] / l2, v2[1] / l2)
        ang = math.acos(max(-1, min(1, u1[0] * u2[0] + u1[1] * u2[1])))
        if ang < 1e-3 or ang > math.pi - 1e-3: out.append(p); continue
        tl = min(r / math.tan(ang / 2), l1 / 2, l2 / 2)
        rr = tl * math.tan(ang / 2)
        a1 = (p[0] + u1[0] * tl, p[1] + u1[1] * tl); a2 = (p[0] + u2[0] * tl, p[1] + u2[1] * tl)
        bis = (u1[0] + u2[0], u1[1] + u2[1]); bl = math.hypot(*bis)
        c = (p[0] + bis[0] / bl * rr / math.sin(ang / 2), p[1] + bis[1] / bl * rr / math.sin(ang / 2))
        s0, s1 = math.atan2(a1[1] - c[1], a1[0] - c[0]), math.atan2(a2[1] - c[1], a2[0] - c[0])
        ds = (s1 - s0 + math.pi) % (2 * math.pi) - math.pi
        for j in range(steps + 1): t = s0 + ds * j / steps; out.append((c[0] + rr * math.cos(t), c[1] + rr * math.sin(t)))
    return out

# ---- chevron stripes: four boundaries (black | yellow | orange | red | beige), arms with dx/dy = 0.92, apex on x = 350, each corner its own radius
AX, SLOPE, FAR = 350, 0.92, 1600
BOUND = [(872.8, 18), (1000.5, 22), (1173.0, 36), (1307.6, 84)]      # sharp-apex y and corner radius, measured on the original
def vee(ys): return [(AX - SLOPE * FAR, ys - FAR), (AX, ys), (AX + SLOPE * FAR, ys - FAR)]
def above(ys, r):
    v = fillet(vee(ys), [0, r, 0], closed=False)
    return [P(q) for q in v] + [P((AX + SLOPE * FAR, -FAR)), P((AX - SLOPE * FAR, -FAR))]
for (ys, r), col in zip(reversed(BOUND), [RED, ORA, YEL, DARK]):
    d.polygon(above(ys, r), fill=col)
for ys, r in BOUND[1:]:
    d.line([P(q) for q in fillet(vee(ys), [0, r, 0], closed=False)], fill=DARK, width=int(6 * K * S), joint='curve')

# ---- beige field: dashed line, bar, AXR9800, parallel to the right arm (x + 0.92 y = c)
def along(c, y): return (c - SLOPE * y, y)
dirv = (SLOPE, -1); dl = math.hypot(*dirv); dirv = (dirv[0] / dl, dirv[1] / dl)
p0, end = along(1674, 1364), along(1674, 560)
L = math.hypot(end[0] - p0[0], end[1] - p0[1]); t = 0
while t < L:
    a0 = (p0[0] + dirv[0] * t, p0[1] + dirv[1] * t); a1 = (p0[0] + dirv[0] * min(t + 40, L), p0[1] + dirv[1] * min(t + 40, L))
    d.line([P(a0), P(a1)], fill=DARK, width=int(7 * K * S)); t += 58
b0, b1 = along(1765, 1160), along(1765, 600)
d.line([P(b0), P(b1)], fill=DARK, width=int(22 * K * S))
rc = 11 * K * S; c0 = P(b0); d.ellipse([c0[0] - rc, c0[1] - rc, c0[0] + rc, c0[1] + rc], fill=DARK)
f = ImageFont.truetype(B + 'saira-700.ttf', int(80 * S)); word = 'AXR9800'; bb = f.getbbox(word)       # Saira Bold, fitted to the original's label
lay = Image.new('L', (bb[2] + 8 * S, bb[3] + 8 * S), 0); ImageDraw.Draw(lay).text((4 * S, 4 * S), word, font=f, fill=255); lay = lay.crop(lay.getbbox())
lay = lay.resize((int(302 * K * S), int(47 * K * S)), Image.LANCZOS)          # 302 long, 47 tall in the original (measured)
rot = lay.rotate(math.degrees(math.atan2(1, SLOPE)), expand=True, resample=Image.BICUBIC); c = P((853, 821))
img.paste(Image.new('RGB', rot.size, DARK), (int(c[0] - rot.width / 2), int(c[1] - rot.height / 2)), rot)

# ---- MODE (reads upwards)
f = ImageFont.truetype(B + 'saira-300.ttf', int(50 * K * S)); bb = f.getbbox('MODE')
lay = Image.new('L', (bb[2] - bb[0] + 4 * S, bb[3] - bb[1] + 4 * S), 0); ImageDraw.Draw(lay).text((2 * S - bb[0], 2 * S - bb[1]), 'MODE', font=f, fill=255)
rot = lay.rotate(90, expand=True); c = P((71, 340))
img.paste(Image.new('RGB', rot.size, MODEC), (int(c[0] - rot.width / 2), int(c[1] - rot.height / 2)), rot)

# ---- the LCD window: outer outline measured on the original (chamfered top corners, tab at the bottom left)
OUT = [(189, 78), (914, 78), (998, 162), (998, 561), (651, 561), (540, 672), (111, 672), (111, 156)]
RAD = [88, 82, 82, 64, 52, 52, 64, 88]                  # fitted to the original's frame outline (top corners, bottom left; step / bottom right to match)
CONVEX = [1, 1, 1, 1, 0, 1, 1, 1]
def offset(pts, dd):
    n = len(pts); lines = []
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]; ex, ey = b[0] - a[0], b[1] - a[1]; l = math.hypot(ex, ey); nx, ny = -ey / l, ex / l
        lines.append(((a[0] + nx * dd, a[1] + ny * dd), (ex, ey)))
    out = []
    for i in range(n):
        (q1, d1), (q2, d2) = lines[i - 1], lines[i]
        den = d1[0] * d2[1] - d1[1] * d2[0]; tt = ((q2[0] - q1[0]) * d2[1] - (q2[1] - q1[1]) * d2[0]) / den
        out.append((q1[0] + d1[0] * tt, q1[1] + d1[1] * tt))
    return out
def shape(dd):
    return [P(q) for q in fillet(offset(OUT, dd), [max(2, r - dd) if cv else r + dd for r, cv in zip(RAD, CONVEX)])]
sm = Image.new('L', img.size, 0); ImageDraw.Draw(sm).polygon(shape(-6), fill=255)      # soft dark shadow around the frame
sm = sm.filter(ImageFilter.GaussianBlur(9 * K * S)); img = Image.composite(Image.new('RGB', img.size, DARK), img, Image.eval(sm, lambda v: int(v * 0.85))); d = ImageDraw.Draw(img)
d.polygon(shape(0), fill=RED)
d.polygon(shape(16), fill=DARK)
lcdmask = Image.new('L', img.size, 0); ImageDraw.Draw(lcdmask).polygon(shape(30), fill=255)
img.paste(LCD, (0, 0), lcdmask)
sh = lcdmask.filter(ImageFilter.GaussianBlur(15 * K * S / 2)); sh = Image.eval(sh, lambda v: int((255 - v) * 0.85))
shade = Image.new('L', img.size, 0); shade.paste(sh, (0, 0), lcdmask)
img = Image.composite(Image.new('RGB', img.size, (150, 160, 118)), img, shade); d = ImageDraw.Draw(img)
f = ImageFont.truetype(B + 'saira-semi-condensed-600.ttf', int(80 * S)); bb = f.getbbox('THIS MOMENT')       # fitted to the original: 352 long, 40 tall
lay = Image.new('L', (bb[2] + 8 * S, bb[3] + 8 * S), 0); ImageDraw.Draw(lay).text((4 * S, 4 * S), 'THIS MOMENT', font=f, fill=255); lay = lay.crop(lay.getbbox())
lay = lay.resize((int(352 * K * S), int(40 * K * S)), Image.LANCZOS)
img.paste(Image.new('RGB', lay.size, INK), (int(X(183)), int(Y(565))), lay)
d.line([P((183, 551)), P((580, 551))], fill=INK, width=int(6 * K * S))
d.line([P((183, 620)), P((536, 620))], fill=INK, width=int(6 * K * S))
img.resize((W, HH), Image.LANCZOS).save(B + 'scene.png')

# ---- time digits: monoline strokes (31 units, round caps) on a rounded-square skeleton, 116 x 264 (the 1 is 75 wide), from the original
DH = 264 * K; TT = 31 * K; DW = 116 * K; W1 = 75 * K; RS = 25 * K
def skel(n, w):
    l, r, t, b, m = TT / 2, w - TT / 2, TT / 2, DH - TT / 2, DH / 2
    c = (l + r) / 2
    return {0: [[(c, t), (r, t), (r, b), (l, b), (l, t), (c, t)]], 1: [[(l, t), (r, t), (r, b)]],
            2: [[(l, t), (r, t), (r, m), (l, m), (l, b), (r, b)]], 3: [[(l, t), (r, t), (r, b), (l, b)], [(l + (r - l) * 0.3, m), (r, m)]],
            4: [[(l, t), (l, m), (r, m)], [(r, t), (r, b)]], 5: [[(r, t), (l, t), (l, m), (r, m), (r, b), (l, b)]],
            6: [[(r, t), (l, t), (l, b), (r, b), (r, m), (l, m)]], 7: [[(l, t), (r, t), (r, b)]],
            8: [[(c, t), (r, t), (r, b), (l, b), (l, t), (c, t)], [(l, m), (r, m)]], 9: [[(r, m), (l, m), (l, t), (r, t), (r, b), (l, b)]]}[n]
def digit(n, col):
    w = W1 if n == 1 else DW
    cw, ch = int(math.ceil(DW)), int(math.ceil(DH))           # every digit in the same cell (the watch's digit sets are one width), the 1 centred in it
    ox = (DW - w) / 2
    im = Image.new('RGBA', (cw * S, ch * S), col + (0,)); dd = ImageDraw.Draw(im)
    for path in skel(n, w):
        rs = RS * 0.45 if n == 1 else RS                          # the 1: flag and stem meet in a tight corner (only the pen's roundness), as in the original
        pts = fillet(path, [0] + [rs] * (len(path) - 2) + [0], closed=False)
        pts = [((x + ox) * S, y * S) for x, y in pts]
        rr = TT * S / 2
        for (xa, ya), (xb, yb) in zip(pts, pts[1:]):          # a round pen stamped every half pixel: clean monoline, round caps and corners
            nstep = max(1, int(math.hypot(xb - xa, yb - ya) * 2))
            for j in range(nstep + 1):
                x_, y_ = xa + (xb - xa) * j / nstep, ya + (yb - ya) * j / nstep
                dd.ellipse([x_ - rr, y_ - rr, x_ + rr, y_ + rr], fill=col + (255,))
    return im.resize((cw, ch), Image.LANCZOS)
for k in range(10):
    digit(k, INK).save(B + 'd_%d.png' % k); digit(k, (112, 118, 92)).save(B + 'a_%d.png' % k)
CW = 36 * K + 4
for name, col in (('colon', INK), ('acolon', (112, 118, 92))):
    cw, ch = int(math.ceil(CW)), int(math.ceil(DH))
    im = Image.new('RGBA', (cw * S, ch * S), col + (0,)); dd = ImageDraw.Draw(im); rr = 18 * K * S
    for cy in (314.5 - 249, 449 - 249):
        cx = cw * S / 2; dd.ellipse([cx - rr, cy * K * S - rr, cx + rr, cy * K * S + rr], fill=col + (255,))
    im.resize((cw, ch), Image.LANCZOS).save(B + name + '.png')
json.dump({'DW': DW, 'DH': DH, 'W1': W1, 'K': K, 'gap': 15 * K}, open(B + 'meta.json', 'w'))
print('ok', 'digit', round(DW, 1), 'x', round(DH, 1), 'stroke', round(TT, 1))
