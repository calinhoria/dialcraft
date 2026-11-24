#!/usr/bin/env python3
"""Casio AE-1500 style LCD face for the Bip 6 (390 x 450), cut from the reference photo (ref/casio-ae1500-green.png).
Everything printed or lit is taken from the photo: the seven LCD segments are cut out of its '8', every digit / weekday letter is the union of those
segment shapes, and CASIO, the WR badge, "5 ALARMS", SNZ, the bell, the P mark and the case lettering are the photo's own pixels turned into alpha masks.
Two themes from the same shapes: green (dark ink on the grey-green LCD, green case) and black (light ink on a black LCD, charcoal case, blue accents).
Writes assets/lcd/*.png (the base set = green; NAME__t1.png = black) and geometry.json."""
import json, os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from ae_lib import RGB, L, label
H = os.path.dirname(os.path.abspath(__file__)); OUT = H + '/assets/lcd'; os.makedirs(OUT, exist_ok=True)
SW, SH = 390, 450
SC = 0.65                                                     # screen pixels per photo pixel
XC, YC = 680.0, 378.0                                         # photo point (time centre, top of CASIO) -> screen (195, 64)
sx = lambda x: 195 + (x - XC) * SC
sy = lambda y: 225 + (y - 676) * SC                           # the display's middle (photo y 676) at the screen's middle
K = SC / 0.55                                                 # the earlier, smaller layout's pixel sizes times K
n_x = lambda x_old: round(sx(680 + (x_old - 195) / 0.55))       # an x of the earlier layout -> the same photo point at this scale
n_y = lambda y_old: round(sy(378 + (y_old - 64) / 0.55))
LCD_BG = 163.0                                                # the LCD's grey in the photo (luminance)
def alpha_of(x0, y0, x1, y1, ink=35.0):
    return np.clip((150.0 - L[y0:y1, x0:x1]) / (150.0 - ink), 0, 1)
def dil(m, n):
    o = m.copy()
    for _ in range(n):
        p = o.copy(); p[1:] |= o[:-1]; p[:-1] |= o[1:]; p[:, 1:] |= o[:, :-1]; p[:, :-1] |= o[:, 1:]; o = p
    return o
# ------------------------------------------------------------------ the seven segments, cut out of the photo's '8'
X8, Y8, X8e, Y8e = 780, 574, 882, 780
m = L[Y8:Y8e, X8:X8e] < 80
lab, comps = label(m); comps = [c for c in comps if c[0] > 500]
assert len(comps) == 7, comps
sub = alpha_of(X8, Y8, X8e, Y8e)
labels_full = lab
BX0, BY0, BX1, BY1 = min(c[1] for c in comps), min(c[2] for c in comps), max(c[3] for c in comps), max(c[4] for c in comps)
BW8, BH8 = BX1 - BX0 + 1, BY1 - BY0 + 1
segmask = {}
for c in comps:
    ids = np.unique(lab[(np.arange(lab.shape[0])[:, None] >= c[2]) & (np.arange(lab.shape[0])[:, None] <= c[4]) & (np.arange(lab.shape[1])[None, :] >= c[1]) & (np.arange(lab.shape[1])[None, :] <= c[3]) & (lab > 0)])
cx_ = lambda c: ((c[1] + c[3]) / 2 - BX0) / BW8; cy_ = lambda c: ((c[2] + c[4]) / 2 - BY0) / BH8
names = {}
for c in comps:
    x, y = cx_(c), cy_(c)
    s = 'a' if y < 0.2 else 'd' if y > 0.8 else 'g' if 0.35 < y < 0.65 and 0.25 < x < 0.75 else ('f' if x < 0.5 else 'b') if y < 0.5 else ('e' if x < 0.5 else 'c')
    names[s] = c
assert sorted(names) == list('abcdefg'), names
# a pixel belongs to the segment whose (dilated) component it is nearest to
own = np.zeros(lab.shape, int)
for i, s in enumerate('abcdefg'):
    c = names[s]; k = lab[(c[2] + c[4]) // 2, (c[1] + c[3]) // 2] if lab[(c[2] + c[4]) // 2, (c[1] + c[3]) // 2] else None
    if k is None:   # centre fell in a gap: take the label under the first pixel of the box
        ys, xs = np.nonzero(lab[c[2]:c[4] + 1, c[1]:c[3] + 1]); k = lab[c[2] + ys[0], c[1] + xs[0]]
    segmask[s] = (dil(lab == k, 2) & (np.where(lab > 0, lab == k, True))) * sub
CELLW = 105                                                   # a digit's pitch in photo pixels (the 8 is 97 wide, so 4 px of room each side)
def seg_canvas(segs, w=CELLW):
    """the cell (w x BH8 photo px, alpha 0..1) with the given segments lit, the 8's bounding box centred"""
    cv = np.zeros((BH8, w), float); ox = (w - BW8) // 2
    for s in segs:
        a = segmask[s][BY0:BY1 + 1, BX0:BX1 + 1]; cv[:, ox:ox + BW8] = np.maximum(cv[:, ox:ox + BW8], a)
    return cv
# ------------------------------------------------------------------ digit sets cut from the photo's own small digits (date row, seconds)
def seg_pieces(box, thr=80, minpx=60, ink=35.0):
    """the segments of the digit inside box (photo px): {key: (alpha of the whole box limited to that segment, bbox left, top, right, bottom)}, keyed by where the
    segment sits inside the digit's bounding box; plus the box's origin and the digit's bounding box"""
    x0, y0, x1, y1 = box; lab, comps = label(L[y0:y1, x0:x1] < thr); al = alpha_of(x0, y0, x1, y1, ink)
    keep = [(i + 1, c) for i, c in enumerate(comps) if c[0] >= minpx]
    bx0, by0, bx1, by1 = min(c[1] for _, c in keep), min(c[2] for _, c in keep), max(c[3] for _, c in keep), max(c[4] for _, c in keep)
    out = {}
    for i, c in keep:
        cx = ((c[1] + c[3]) / 2 - bx0) / max(bx1 - bx0, 1); cy = ((c[2] + c[4]) / 2 - by0) / max(by1 - by0, 1)
        sg = 'a' if cy < 0.2 else 'd' if cy > 0.8 else 'g' if 0.35 < cy < 0.65 and 0.2 < cx < 0.8 else ('f' if cx < 0.5 else 'b') if cy < 0.5 else ('e' if cx < 0.5 else 'c')
        out[sg] = (al * (dil(lab == i, 2) & ((lab == 0) | (lab == i))), x0 + c[1], y0 + c[2], x0 + c[3], y0 + c[4])
    return out, (x0, y0), (x0 + bx0, y0 + by0, x0 + bx1, y0 + by1)
def build_master(zero_box, g_box, pitch, ph):
    """all seven segments of one cell (pitch x ph photo px): a - f from the photo's '0', g from another digit that has it, lined up on the f segment and the top"""
    z, (zx0, zy0), (zl, zt, zr, zb) = seg_pieces(zero_box); g, (gx0, gy0), _ = seg_pieces(g_box)
    assert {'a', 'b', 'c', 'd', 'e', 'f'} <= set(z) and {'g', 'f', 'a'} <= set(g), (sorted(z), sorted(g))
    ox = (pitch - (zr - zl + 1)) // 2; master = {}
    for sg, (a, *_) in z.items(): master[sg] = (a, zx0 - zl + ox, zy0 - zt)
    dx, dy = z['f'][1] - g['f'][1], z['a'][2] - g['a'][2]
    master['g'] = (g['g'][0], gx0 + dx - zl + ox, gy0 + dy - zt)
    return master
def master_canvas(master, segs, pitch, ph):
    cv = np.zeros((ph, pitch), float)
    for sg in segs:
        a, x, y = master[sg]; h, w = a.shape; y0, x0 = max(y, 0), max(x, 0); y1, x1 = min(y + h, ph), min(x + w, pitch)
        if y1 > y0 and x1 > x0: cv[y0:y1, x0:x1] = np.maximum(cv[y0:y1, x0:x1], a[y0 - y:y1 - y, x0 - x:x1 - x])
    return cv
MASTER_S = build_master((806, 452, 858, 533), (676, 452, 726, 533), 48, 73)       # the date row's digits: the 0 and the 6
MASTER_M = build_master((706, 822, 778, 941), (638, 822, 700, 941), 70, 109)      # the seconds: the 0 and the 5
DIG = {'0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg'}
LET = {'S': 'acdfg', 'U': 'bcdef', 'M': 'abcef', 'O': 'abcdef', 'T': 'aef', 'W': 'bcdef', 'E': 'adefg', 'H': 'bcefg', 'F': 'aefg', 'R': 'abcefg', 'A': 'abcefg'}
WEEK = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']             # Monday first, as the watch counts
# sizes: (cell width, cell height) in screen px for the three digit sizes, from the photo's digits (big 203 tall, seconds 109, date 73)
SIZES = {'b': (round(105 * SC), round(BH8 * SC)), 'm': (round(70 * SC * 78 / 71), 78), 's': (round(47.5 * SC), round(73 * SC))}
PHOTO_CELL = {'b': (105, BH8), 'm': (70, 109), 's': (48, 73)}
# ------------------------------------------------------------------ themes
THEMES = {
    'green': dict(case=(66, 77, 68), case_hi=(98, 105, 98), case_lo=(44, 53, 46), caseink=(228, 238, 232), bezel=(26, 29, 52), lcd=(163, 169, 154), dots=-17, ink=(22, 22, 26), block=(22, 22, 26), accent=(176, 206, 62), line=(22, 22, 26)),
    'black': dict(case=(62, 62, 73), case_hi=(88, 88, 100), case_lo=(40, 40, 48), caseink=(150, 162, 188), bezel=(5, 5, 7), lcd=(9, 9, 11), dots=5, ink=(200, 196, 177), block=(170, 172, 174), accent=(58, 118, 214), line=(200, 196, 177)),
}
def tint(a, rgb, scale_to=None, size=None):
    """alpha array (0..1) -> RGBA picture in one colour, resized with LANCZOS from 4x detail"""
    h, w = a.shape
    im = np.zeros((h, w, 4), 'uint8'); im[..., :3] = rgb; im[..., 3] = (np.clip(a, 0, 1) * 255).astype('uint8')
    im = Image.fromarray(im, 'RGBA')
    return im.resize(size, Image.LANCZOS) if size else im
def premul_resize(a, size):
    return np.array(Image.fromarray((np.clip(a, 0, 1) * 255).astype('uint8')).resize(size, Image.LANCZOS)).astype(float) / 255
def save(im, name): im.save(OUT + '/' + name + '.png', optimize=True)
geo = {'names': {}, 'size': {}}
def shift_x(cv, dx):
    out = np.zeros_like(cv)
    if dx >= 0: out[:, dx:] = cv[:, :cv.shape[1] - dx]
    else: out[:, :dx] = cv[:, -dx:]
    return out
def mw_canvas(letter, master, width, ph, right_edge):
    """M and W the way the watch builds them: a double zero with shared middle segments, using the watch's own segments, identical and unscaled. M: the left zero
    (a, f, e, b, c: no bottom bar) and a right zero whose left verticals are the left zero's b and c (the two shared middle segments), so the right zero adds only
    its own a, b, c one leg-spacing further right. W: the same with the bottom bar d instead of a. The glyph's right edge is put at right_edge."""
    top = 'd' if letter == 'W' else 'a'
    if letter == 'T':     # the M with its left and right legs switched off: both top bars and the shared middle b, c
        cl = master_canvas(master, [top, 'b', 'c'], width, ph); cr = master_canvas(master, [top], width, ph)
    else:
        cl = master_canvas(master, [top, 'f', 'e', 'b', 'c'], width, ph); cr = master_canvas(master, [top, 'b', 'c'], width, ph)
    left = lambda sg: np.nonzero(master_canvas(master, [sg], width, ph).max(axis=0) > 0.02)[0].min()
    dx = int(left('b') - left('f'))                                     # the distance between the left and the right legs of one zero
    cv = np.maximum(cl, shift_x(cr, dx)); xr = np.nonzero(cv.max(axis=0) > 0.02)[0].max()
    return shift_x(cv, right_edge - xr)
def t_canvas(master, width, ph):
    """T as on the watch (see the photo of TU): the top bar a, and a stem down the middle made of the watch's own right-hand verticals b and c moved half a leg-spacing to the left."""
    left = lambda sg: np.nonzero(master_canvas(master, [sg], width, ph).max(axis=0) > 0.02)[0].min()
    dx = int(left('b') - left('f'))
    return np.maximum(master_canvas(master, ['a'], width, ph), shift_x(master_canvas(master, ['b', 'c'], width, ph), -(dx // 2)))
WK_PAD = 28; WK_W = WK_PAD + 96                                     # the weekday picture (photo px): two normal cells, with room on the left for the double-width M / W
def week_canvas(w):
    cv = np.zeros((73, WK_W), float)
    if w[0] in 'MWT':
        cv = np.maximum(cv, mw_canvas(w[0], MASTER_S, WK_W, 73, WK_PAD + 46))
    else: cv[:, WK_PAD:WK_PAD + 48] = master_canvas(MASTER_S, LET[w[0]], 48, 73)
    cv[:, WK_PAD + 48:WK_PAD + 96] = np.maximum(cv[:, WK_PAD + 48:WK_PAD + 96], master_canvas(MASTER_S, LET[w[1]], 48, 73))
    return cv
def sets(theme_key, suffix):
    th = THEMES[theme_key]; ink = th['ink']
    for key_, (cw, ch) in SIZES.items():
        pw, ph = PHOTO_CELL[key_]
        names_ = []
        for d in '0123456789':
            cv = seg_canvas(DIG[d]) if key_ == 'b' else master_canvas(MASTER_S if key_ == 's' else MASTER_M, DIG[d], int(pw), ph); a = premul_resize(cv, (cw, ch)); save(tint(a, ink), '%s%s%s' % (key_, d, suffix)); names_.append('lcd/%s%s.png' % (key_, d))
        geo['names'][key_] = ['lcd/%s%d.png' % (key_, d) for d in range(10)]; geo['size'][key_] = [cw, ch]
    # weekday labels: two letters in the small size, one picture per day
    cw, ch = SIZES['s']
    for i, w in enumerate(WEEK):
        a = premul_resize(week_canvas(w), (round(WK_W * SC), ch)); save(tint(a, ink), 'w%d%s' % (i, suffix))
    geo['names']['w'] = ['lcd/w%d.png' % i for i in range(7)]; geo['size']['w'] = [round(WK_W * SC), ch]
# the colon (the photo's own two slanted dots), the dash, and the P mark
def photo_mask(x0, y0, x1, y1, pad=3):
    return alpha_of(x0 - pad, y0 - pad, x1 + pad + 1, y1 + pad + 1)
colon_zone = (630, 669)                                          # photo x range between the hour's and the minute's cells
colon_a = np.zeros((BH8, colon_zone[1] - colon_zone[0]), float)
for (x0, x1, y0, y1) in ((640, 664, 621, 655), (636, 660, 697, 731)):
    mm = L[y0 - 3:y1 + 4, x0 - 3:x1 + 4] < 80; lab_, cc = label(mm); big = max(cc, key=lambda k: k[0])
    a = alpha_of(x0 - 3, y0 - 3, x1 + 4, y1 + 4); colon_a[y0 - 3 - 576:y1 + 4 - 576, x0 - 3 - colon_zone[0]:x1 + 4 - colon_zone[0]] = np.maximum(colon_a[y0 - 3 - 576:y1 + 4 - 576, x0 - 3 - colon_zone[0]:x1 + 4 - colon_zone[0]], a)
colon_size = (round((colon_zone[1] - colon_zone[0]) * SC), SIZES['b'][1])
dash_zone = (724.5, 758.0)                                        # between the month and day cells of the date row
dash_a = np.zeros((73, round(dash_zone[1] - dash_zone[0])), float)
dsrc = alpha_of(735 - 3, 490 - 3, 750 + 4, 500 + 4); ox = 735 - 3 - int(dash_zone[0]); oy = 490 - 3 - 456
dash_a[oy:oy + dsrc.shape[0], ox:ox + dsrc.shape[1]] = dsrc
dash_size = (round(dash_a.shape[1] * SC), SIZES['s'][1])
P_BOX = (418, 587, 442, 617); p_a = photo_mask(*P_BOX); p_size = (round(p_a.shape[1] * SC), round(p_a.shape[0] * SC))
def extras(theme_key, suffix):
    ink = THEMES[theme_key]['ink']
    save(tint(premul_resize(colon_a, colon_size[::1]), ink), 'colon' + suffix)
    save(tint(premul_resize(dash_a, dash_size), ink), 'dash' + suffix)
    save(tint(premul_resize(p_a, p_size), ink), 'pm' + suffix)
# ------------------------------------------------------------------ the two big pictures: the DISPLAY (LCD) and the CASE (a separate layer with a window over the display)
LCD = (0, 0, SW, SH); LCD_R = 0                          # the display panel on the screen (left, top, right, bottom) and its corner radius
BEZ = (14, 44, 376, 412); BEZ_R = 30                          # the case's window: the dark bezel ring (16 px) around the display, where the dial printing sits
S4 = 4
def rrect_mask(box, r, size=(SW, SH)):
    im = Image.new('L', (size[0] * S4, size[1] * S4), 0); ImageDraw.Draw(im).rounded_rectangle([v * S4 for v in box], radius=r * S4, fill=255)
    return np.array(im.resize(size, Image.LANCZOS)).astype(float) / 255
def paste_alpha(canvas_rgb, canvas_a, a, x, y, rgb):
    h, w = a.shape; x0, y0 = max(x, 0), max(y, 0); x1, y1 = min(x + w, SW), min(y + h, SH)
    if x1 <= x0 or y1 <= y0: return
    aa = a[y0 - y:y1 - y, x0 - x:x1 - x][..., None]
    reg = canvas_rgb[y0:y1, x0:x1]; canvas_rgb[y0:y1, x0:x1] = reg * (1 - aa) + np.array(rgb, float) * aa
    canvas_a[y0:y1, x0:x1] = np.maximum(canvas_a[y0:y1, x0:x1], aa[..., 0])
def photo_item(box, pad=3):
    x0, y0, x1, y1 = box
    a = alpha_of(x0 - pad, y0 - pad, x1 + pad + 1, y1 + pad + 1)
    size = (max(1, round(a.shape[1] * SC)), max(1, round(a.shape[0] * SC)))
    return premul_resize(a, size), round(sx(x0 - pad)), round(sy(y0 - pad))
ITEMS = {'casio': (633, 378, 756, 400), 'wr': (648, 412, 739, 444), 'alarms': (449, 838, 617, 853), 'snz': (795, 837, 859, 853)}
BELL_BOX = (810, 864, 846, 908)                                # the bell: shown only while an alarm is set (a native system-status layer)
AL_X0, AL_Y0, AL_W, AL_H = n_x(55), n_y(377), round(48 * K), round(17 * K)                     # the first alarm block (AL1), likewise
DIV1, DIV2 = round(sy(555)) - 1, round(sy(810)) - 1            # the two rules (y of their top pixel)
BAR_X, BAR_Y, BAR_W, BAR_H, BAR_PITCH = n_x(335), n_y(104), round(22 * K), round(272 * K), 27.2 * K  # the seconds bar: 10 blocks down the right of the display
def lcd_picture(tk):
    th = THEMES[tk]; rng = np.random.default_rng(5)
    rgb = np.zeros((SH, SW, 3), float); rgb[:] = th['lcd']
    # the LCD's dot pattern, as in the photo: a square lattice of soft grey dots 9 photo px (5 screen px) apart, ONLY above the first rule and below the second
    # (the time zone between them is flat); 4x supersampled so the dots stay round
    P5 = 6; tile = Image.new('L', (P5 * S4, P5 * S4), 0); ImageDraw.Draw(tile).ellipse([(P5 / 2 - 1.7) * S4, (P5 / 2 - 1.7) * S4, (P5 / 2 + 1.7) * S4, (P5 / 2 + 1.7) * S4], fill=255)
    big = Image.new('L', (SW * S4, SH * S4), 0)
    for yv in range(0, SH, P5):
        for xv in range(0, SW, P5): big.paste(tile, (xv * S4, yv * S4))
    dots = np.array(big.resize((SW, SH), Image.LANCZOS)).astype(float) / 255
    zone = np.zeros((SH, SW)); zone[:DIV1] = 1; zone[DIV2 + 2:] = 1
    rgb += (dots * zone * th['dots'])[..., None] + rng.normal(0, 0.7, (SH, SW, 1))
    # a soft lighter patch (the glass catches the light)
    yy, xx = np.mgrid[0:SH, 0:SW]; d = np.hypot((xx - 195) / 200.0, (yy - 230) / 200.0); rgb += (np.clip(1 - d, 0, 1) ** 2 * (4 if tk == 'green' else 2))[..., None]
    A = np.zeros((SH, SW), float)
    for key_, box in {}.items():                                   # (CASIO, WR, 5 ALARMS and SNZ are no longer printed on the display)
        a, x, y = photo_item(box); paste_alpha(rgb, A, a, x, y + 0, th['ink'])      # CASIO and WR sit a few px lower than in the photo: the case's title band covers the top of the display here
    for yv in (DIV1, DIV2): rgb[yv:yv + 2, n_x(40):n_x(322)] = th['line']
    # (no inner shadow: the display fills the screen, there is no case lip to shade it)
    m = rrect_mask(LCD, LCD_R)
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), m * 255]).astype('uint8'), 'RGBA')
def alarm_pictures(tk):
    th = THEMES[tk]
    a, x, y = photo_item(BELL_BOX); save(tint(a, th['ink']), 'bell' + ('' if tk == 'green' else '__t1')); bell_geo = [a.shape[1], a.shape[0], x, y]
    lay = Image.new('L', (AL_W * S4, AL_H * S4), 0); ImageDraw.Draw(lay).rounded_rectangle([1 * S4, 0, (AL_W - 1) * S4, (AL_H - 1) * S4], radius=0, fill=255)
    save(tint(np.array(lay.resize((AL_W, AL_H), Image.LANCZOS)).astype(float) / 255, th['block']), 'al1' + ('' if tk == 'green' else '__t1'))
    return bell_geo
BLK_H = round(19 * K)
def bar_picture(tk, n):
    th = THEMES[tk]; lay = Image.new('L', (BAR_W * S4, BAR_H * S4), 0); dr = ImageDraw.Draw(lay)
    for i in range(n):
        y0 = 1 + i * BAR_PITCH; dr.rounded_rectangle([1 * S4, y0 * S4, (BAR_W - 1) * S4, (y0 + 19 * K) * S4], radius=0, fill=255)
    a = np.array(lay.resize((BAR_W, BAR_H), Image.LANCZOS)).astype(float) / 255
    return tint(a, th['block'])
# ---- the case: lettering. (The photo's curved lettering was tried first, unwarped: it came out stretched, so the case lines are set in type instead.) Ring text from the photo's masks: and straightened (a polar unwarp: each letter turned upright, not just shifted)
def fit_circle(xs, ys, w=None):
    A = np.c_[xs, ys, np.ones_like(xs)]; b = -(xs ** 2 + ys ** 2)
    if w is not None: A = A * w[:, None]; b = b * w
    D, E, F = np.linalg.lstsq(A, b, rcond=None)[0]; cx, cy = -D / 2, -E / 2
    return cx, cy, math.sqrt(max(cx * cx + cy * cy - F, 1e-6))
def bilinear(a, X, Y):
    h, w = a.shape; x0 = np.floor(X).astype(int); y0 = np.floor(Y).astype(int); fx = X - x0; fy = Y - y0
    def g(yy, xx): ok = (yy >= 0) & (yy < h) & (xx >= 0) & (xx < w); return np.where(ok, a[np.clip(yy, 0, h - 1), np.clip(xx, 0, w - 1)], 0.0)
    return g(y0, x0) * (1 - fx) * (1 - fy) + g(y0, x0 + 1) * fx * (1 - fy) + g(y0 + 1, x0) * (1 - fx) * fy + g(y0 + 1, x0 + 1) * fx * fy
def straighten(a):
    h, w = a.shape; yv = np.arange(h)[:, None]; wt = a.sum(axis=0); cyv = (a * yv).sum(axis=0) / np.maximum(wt, 1e-6); ok = wt > 1.5
    xs, ys = np.arange(w)[ok].astype(float), cyv[ok]
    cx, cy, R = fit_circle(xs, ys, np.sqrt(wt[ok]))
    rows = np.nonzero(a.max(axis=1) > 0.3)[0]; th_ = int(rows.max() - rows.min() + 1); H_ = int(th_ * 1.7) + 4
    if R > 4000: return a
    top = cy > ys.mean()                                          # the centre of the curve is below the text (a frown) or above it (a smile)
    ang = np.arctan2(xs - cx, (cy - ys) if top else (ys - cy)); a0, a1 = ang.min(), ang.max()
    Wo = int(R * (a1 - a0)) + 8; u = np.arange(Wo)[None, :]; v = np.arange(H_)[:, None] - H_ / 2.0
    th = a0 + (u - 4) / R; r = (R - v) if top else (R + v)
    X = cx + r * np.sin(th); Y = (cy - r * np.cos(th)) if top else (cy + r * np.cos(th))
    out = bilinear(a, X, Y); rr = np.nonzero(out.max(axis=1) > 0.3)[0]; cc = np.nonzero(out.max(axis=0) > 0.3)[0]
    return out[rr.min():rr.max() + 1, cc.min():cc.max() + 1]
def photo_text(box, fn, rot=0):
    x0, y0, x1, y1 = box; a = np.clip(fn(RGB[y0:y1, x0:x1], L[y0:y1, x0:x1]), 0, 1)
    if rot: a = np.rot90(a, rot)
    return straighten(a)
LIGHT = lambda c, l: (l - 105.0) / 110.0                           # light lettering on the case
WHITE_ON_NAVY = lambda c, l: (l - 125.0) / 75.0
LIME = lambda c, l: ((c[..., 1] - c[..., 2]) - 20.0) / 60.0
TEXTS = {'illuminator': ((470, 195, 880, 265), LIGHT, 0), 'battery': ((450, 1070, 895, 1185), LIGHT, 0), 'water': ((520, 344, 860, 378), WHITE_ON_NAVY, 0),
         'al': ((470, 965, 900, 1048), lambda c, l: (l - 185.0) / 50.0, 0), 'chrono': ((352, 496, 410, 800), LIME, -1)}
_cache = {}
def text_mask(key_):
    if key_ not in _cache: _cache[key_] = photo_text(*TEXTS[key_])
    return _cache[key_]
def numeral(box, deg):
    x0, y0, x1, y1 = box; a = np.clip((L[y0:y1, x0:x1] - 70.0) / 120.0, 0, 1)
    im = Image.fromarray((a * 255).astype('uint8')).rotate(deg, resample=Image.BICUBIC, expand=True); a = np.array(im).astype(float) / 255
    rr = np.nonzero(a.max(axis=1) > 0.3)[0]; cc = np.nonzero(a.max(axis=0) > 0.3)[0]
    return a[rr.min():rr.max() + 1, cc.min():cc.max() + 1]
from PIL import ImageFont
ORB = os.path.join(H, '..', '..', 'assets', 'fonts', 'Orbitron-Bold.ttf')       # Orbitron Bold (SIL OFL), for the two tiny ring lines the photo hides
def font_text(text, target_w):
    """the line set in Orbitron Bold, as an alpha mask of the given width (4x supersampled)"""
    f = ImageFont.truetype(ORB, 60); bb = f.getbbox(text); w, h = bb[2] - bb[0], bb[3] - bb[1]
    im = Image.new('L', (w + 8, h + 8), 0); ImageDraw.Draw(im).text((4 - bb[0], 4 - bb[1]), text, font=f, fill=255)
    k = target_w / float(w + 8); size = (max(1, round((w + 8) * k)), max(1, round((h + 8) * k)))
    return np.array(im.resize(size, Image.LANCZOS)).astype(float) / 255
def screw(rgb, th, cx, cy, r=13):
    S = 4; w = 2 * r + 6
    yy, xx = np.mgrid[0:w * S, 0:w * S] / S - w / 2.0; d = np.hypot(xx, yy)
    ring = np.clip((r - d) * S / 2, 0, 1); inner = np.clip((r - 2.2 - d) * S / 2, 0, 1)
    base = np.array(th['case'], float); shade = (-(xx + yy) / (2 * r)) * 14
    col = np.zeros((w * S, w * S, 3), float); col[:] = np.array(th['case_lo'], float); col = col * (1 - inner[..., None]) + (base + shade[..., None]) * inner[..., None]
    mark = np.zeros((w * S, w * S), float)
    for k in range(3):
        ang = math.radians(-90 + 120 * k); ex, ey = math.cos(ang), math.sin(ang)
        t = np.clip(xx * ex + yy * ey, 0, 7.0); dd = np.hypot(xx - t * ex, yy - t * ey)
        mark = np.maximum(mark, np.clip((1.3 - dd) * S / 2, 0, 1) * (xx * ex + yy * ey > -0.3))
    col = col * (1 - 0.56 * mark[..., None]) + np.array(th['case_lo'], float) * 0.56 * mark[..., None]
    im = Image.fromarray(np.dstack([col, ring * 255]).astype('uint8'), 'RGBA').resize((w, w), Image.LANCZOS)
    rgb_im = Image.fromarray(np.clip(rgb, 0, 255).astype('uint8'), 'RGB'); rgb_im.paste(im, (round(cx - w / 2), round(cy - w / 2)), im)
    return np.array(rgb_im).astype(float)
def case_picture(tk):
    th = THEMES[tk]; rng = np.random.default_rng(11)
    yy, xx = np.mgrid[0:SH, 0:SW]
    rgb = np.zeros((SH, SW, 3), float); rgb[:] = th['case']
    rgb += ((1 - yy / SH) * 14 - 4)[..., None]
    rgb += (np.clip(1 - np.hypot((xx - 195) / 230.0, (yy - 26) / 60.0), 0, 1) ** 2 * 16)[..., None]
    rgb += (np.clip(1 - np.hypot((xx - 195) / 230.0, (yy - 430) / 50.0), 0, 1) ** 2 * 10)[..., None]
    rgb += rng.normal(0, 2.2, (SH, SW, 1))
    ring = rrect_mask(BEZ, BEZ_R)[..., None]; rgb = rgb * (1 - ring) + np.array(th['bezel'], float) * ring
    outer = rrect_mask((BEZ[0] - 1.5, BEZ[1] - 1.5, BEZ[2] + 1.5, BEZ[3] + 1.5), BEZ_R + 1.5) - ring[..., 0]
    rgb += (np.clip(outer, 0, 1) * 18)[..., None]
    A = np.zeros((SH, SW), float)
    def put_text(key_, cx, cy, scale, rgb_, rot90=0):
        a = text_mask(key_); size = (round(a.shape[1] * scale), round(a.shape[0] * scale)); aa = premul_resize(a, size)
        if rot90: aa = np.rot90(aa, rot90)
        paste_alpha(rgb, A, aa, round(cx - aa.shape[1] / 2), round(cy - aa.shape[0] / 2), rgb_)
    ink_ = th['caseink']
    il = font_text('ILLUMINATOR', 150); hh_ = il.shape[0]; pad = int(hh_ * 0.25) + 2
    sheared = np.zeros((hh_, il.shape[1] + pad)); 
    for yv_ in range(hh_): sheared[yv_, int(round((hh_ - yv_) * 0.2)):int(round((hh_ - yv_) * 0.2)) + il.shape[1]] = il[yv_]      # the lettering is oblique
    paste_alpha(rgb, A, sheared, round(195 - sheared.shape[1] / 2), 25 - hh_ // 2, ink_)
    ah = 10; S_ = 4; arr = Image.new('L', (36 * S_, ah * S_), 0); drw = ImageDraw.Draw(arr)                                  # the two arrows: wedges pointing outwards
    drw.polygon([(0, ah * S_ / 2), (30 * S_, 0), (30 * S_, ah * S_)], fill=255); al_ = np.array(arr.resize((36, ah), Image.LANCZOS)).astype(float) / 255
    paste_alpha(rgb, A, al_[:, :30], round(195 - sheared.shape[1] / 2 - 34), 25 - ah // 2, ink_)
    paste_alpha(rgb, A, al_[:, :30][:, ::-1], round(195 + sheared.shape[1] / 2 + 4), 25 - ah // 2, ink_)
    by_ = font_text('10 YEAR BATTERY', 214); paste_alpha(rgb, A, by_, round(195 - by_.shape[1] / 2), 431 - by_.shape[0] // 2, ink_)
    # the dial frame on the bezel: WATER 100M RESIST on top, AL1 - AL5 along the bottom, ALARM CHRONOGRAPH up the left, the 0 - 10 scale down the right
    wa = font_text('WATER 100M RESIST', 176); paste_alpha(rgb, A, wa, round(195 - wa.shape[1] / 2), 52 - wa.shape[0] // 2, (225, 230, 236) if tk == 'green' else (215, 215, 220))
    for i in range(5):
        lab = font_text('AL%d' % (i + 1), 17); paste_alpha(rgb, A, lab, round(195 + (i - 2) * 58 - lab.shape[1] / 2), 404 - lab.shape[0] // 2, (225, 230, 236) if tk == 'green' else (215, 215, 220))
    ch = np.rot90(font_text('ALARM CHRONOGRAPH', 170), 1); paste_alpha(rgb, A, ch, 22 - ch.shape[1] // 2, 214 - ch.shape[0] // 2, th['accent'])
    for i in range(10):                                                                      # the ticks: ten, five above and five below the pointer
        y0 = 228 + (i - 4.5) * 27.0; rgb[round(y0) - 1:round(y0) + 1, 364:371] = (226, 230, 236) if tk == 'green' else (214, 214, 220)
    for (txt, wv, cx, cy) in (('0', 6, 368, 84), ('10', 11, 368, 380)):                     # the scale's two numerals, upright
        aa = font_text(txt, wv); paste_alpha(rgb, A, aa, round(cx - aa.shape[1] / 2), round(cy - aa.shape[0] / 2), (226, 230, 236) if tk == 'green' else (214, 214, 220))
    # the pointer: the photo's own blunt wedge (flat against the ring, truncated tip towards the display), at the middle of the ring between two ticks
    px0, py0, px1, py1 = 1008, 646, 1036, 702; reg = RGB[py0:py1, px0:px1]; pm = np.clip(((reg[..., 1] - reg[..., 2]) - 25.0) / 60.0, 0, 1)
    pa = premul_resize(pm, (max(1, round(pm.shape[1] * SC)), max(1, round(pm.shape[0] * SC))))
    paste_alpha(rgb, A, pa, round(368.5 - pa.shape[1] / 2), round(228 - pa.shape[0] / 2), th['accent'])
    for (cx, cy) in ((50, 25), (340, 25), (50, 427), (340, 427)): rgb = screw(rgb, th, cx, cy)
    hole = rrect_mask(LCD, LCD_R)
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), (1 - hole) * 255]).astype('uint8'), 'RGBA')
def aod_set():
    ink = (190, 194, 204)
    for d in '0123456789':
        cv = seg_canvas(DIG[d]); a = premul_resize(cv, SIZES['b']); a = np.clip((a - 0.5) * 2.4 + 0.5, 0, 1); save(tint(a, ink), 'a' + d)
    geo['names']['a'] = ['lcd/a%d.png' % d for d in range(10)]; geo['size']['a'] = list(SIZES['b'])
    ca = premul_resize(colon_a, colon_size); ca = np.clip((ca - 0.5) * 2.4 + 0.5, 0, 1); save(tint(ca, ink), 'colon_aod')
# ------------------------------------------------------------------ the stats row: a small digit set (the same segments, 22 x 34), colon / minus / degree, and flat icons in the same style as the bell
TW, TH = 22, 34
def icon_canvas(kind):
    """flat one-colour icons drawn big (4x) and returned as an alpha array at screen size: battery, footprint, thermometer, sunrise, sunset"""
    def new(w, h): im = Image.new('L', (w * S4, h * S4), 0); return im, ImageDraw.Draw(im)
    def fin(im, w, h): return np.array(im.resize((w, h), Image.LANCZOS)).astype(float) / 255
    s = S4
    if kind == 'batt':
        w, h = 38, 22; im, d = new(w, h)                                                       # the body 1..33 x 1..21 (3 px wall), the three blocks 2 px from the wall on every side and 2 px apart
        d.rectangle([1 * s, 1 * s, 33 * s, 21 * s], fill=255); d.rectangle([4 * s, 4 * s, 30 * s, 18 * s], fill=0)
        d.rectangle([33 * s, 7 * s, 37 * s, 15 * s], fill=255)
        return fin(im, w, h)                                                                   # the blocks inside are a separate picture (blk), lit by the battery level
    if kind == 'step':
        w, h = 24, 34; im, d = new(w, h)
        d.ellipse([5 * s, 11 * s, 19 * s, 25 * s], fill=255)                                                              # the ball of the foot
        d.polygon([(6.5 * s, 22 * s), (17.5 * s, 22 * s), (15.5 * s, 28 * s), (8.5 * s, 28 * s)], fill=255)                  # the arch
        d.ellipse([7.5 * s, 26 * s, 16.5 * s, 33.5 * s], fill=255)                                                           # the heel
        for (x, y, r) in ((5, 7, 2.3), (9.5, 4.2, 2.3), (14.5, 4.2, 2.3), (19, 7, 2.3)): d.ellipse([(x - r) * s, (y - r) * s, (x + r) * s, (y + r) * s], fill=255)      # the toes
        return fin(im, w, h)
    if kind == 'temp':
        w, h = 18, 34; im, d = new(w, h)
        d.rectangle([6 * s, 1 * s, 12 * s, 24 * s], fill=255); d.rectangle([8 * s, 4 * s, 10 * s, 22 * s], fill=0)
        d.ellipse([2 * s, 20 * s, 16 * s, 33 * s], fill=255); d.ellipse([5 * s, 23 * s, 13 * s, 31 * s], fill=0); d.ellipse([6.5 * s, 24.5 * s, 11.5 * s, 29.5 * s], fill=255)
        d.rectangle([8 * s, 12 * s, 10 * s, 26 * s], fill=255)
        for y in (6, 11, 16): d.rectangle([13 * s, y * s, 17 * s, (y + 1.6) * s], fill=255)
        return fin(im, w, h)
    w, h = 36, 34; im, d = new(w, h); cx, hy = 18, 22                                               # sunrise / sunset: the horizon, the half sun with its rays and an arrow
    d.rectangle([1 * s, hy * s, 35 * s, (hy + 2.5) * s], fill=255)
    d.pieslice([(cx - 8) * s, (hy - 8) * s, (cx + 8) * s, (hy + 8) * s], 180, 360, fill=255)
    for ang in (-90, -45, 0, -135, -180):
        import math as _m; ca, sa = _m.cos(_m.radians(ang)), _m.sin(_m.radians(ang))
        if ang in (0, -180): continue
        d.line([((cx + 11.5 * ca) * s, (hy + 11.5 * sa) * s), ((cx + 15.5 * ca) * s, (hy + 15.5 * sa) * s)], fill=255, width=int(2.4 * s))
    if kind == 'sunrise': d.polygon([(cx * s, (hy + 5) * s), ((cx - 5) * s, (hy + 11) * s), ((cx + 5) * s, (hy + 11) * s)], fill=255)
    else: d.polygon([(cx * s, (hy + 12) * s), ((cx - 5) * s, (hy + 6) * s), ((cx + 5) * s, (hy + 6) * s)], fill=255)
    return fin(im, w, h)
def stats_set(tk, suffix):
    ink = THEMES[tk]['ink']
    for d in '0123456789':
        cv = master_canvas(MASTER_S, DIG[d], 48, 73); save(tint(premul_resize(cv, (TW, TH)), ink), 't%s%s' % (d, suffix))
    ccw = round((colon_zone[1] - colon_zone[0]) * TH / BH8)
    save(tint(premul_resize(colon_a, (ccw, TH)), ink), 'tcolon' + suffix)
    save(tint(premul_resize(dash_a, (round(dash_a.shape[1] * TH / 73), TH)), ink), 'tminus' + suffix)
    save(tint(premul_resize(master_canvas(MASTER_S, 'abfg', 48, 73), (TW, TH)), ink), 'tdeg' + suffix)
    for k in ('batt', 'step', 'temp', 'sunrise', 'sunset'):
        ic = icon_canvas(k); save(tint(ic, ink), 'ic_' + k + suffix); geo['size']['ic_' + k] = [ic.shape[1], ic.shape[0]]
    bl = np.zeros((10, 4)); bl[:] = 1; save(tint(bl, ink), 'blk' + suffix); geo['size']['blk'] = [4, 10]
    geo['names']['t'] = ['lcd/t%d.png' % d for d in range(10)]; geo['size']['t'] = [TW, TH]
    geo['size']['tcolon'] = [ccw, TH]; geo['size']['tminus'] = [round(dash_a.shape[1] * TH / 73), TH]; geo['size']['tdeg'] = [TW, TH]
# ------------------------------------------------------------------ write everything
for tk, suffix in (('green', ''), ('black', '__t1')):
    sets(tk, suffix); extras(tk, suffix)
    save(lcd_picture(tk), 'lcd' + suffix); save(case_picture(tk), 'case' + suffix)
    for n in range(11): save(bar_picture(tk, n), 'bar%d%s' % (n, suffix))
    save(bar_picture(tk, 1).crop((0, 1, BAR_W, 1 + BLK_H)), 'barblk' + suffix)   # one lit block: ten of these are shown / hidden by the seconds code (no picture swap)
    bell_geo = alarm_pictures(tk); stats_set(tk, suffix)
aod_set()
Image.new('RGBA', (8, 8), (0, 0, 0, 0)).save(OUT + '/blank.png')
geo['names']['bar'] = ['lcd/bar%d.png' % n for n in range(11)]
geo['size'].update({'colon': list(colon_size), 'dash': list(dash_size), 'pm': list(p_size), 'bar': [BAR_W, BAR_H], 'barblk': [BAR_W, BLK_H], 'bell': bell_geo[:2], 'al1': [AL_W, AL_H], 'screen': [SW, SH]})
cb, cm, cs = SIZES['b'], SIZES['m'], SIZES['s']
DATE_DY = 0                                                       # the date row sits a little lower than in the photo, to leave room for CASIO / WR under the case's title band
CLOCK_DX = 4                                                      # centres the digits between the two rules (the photo's digits sit right of centre: the bar is beside them there)
P = {'hour': [round(sx(420)) + CLOCK_DX, round(sy(576))], 'colon': [round(sx(630)) + CLOCK_DX, round(sy(576))], 'minute': [round(sx(669)) + CLOCK_DX, round(sy(576))],
     'second': [n_x(322) - 2 * cm[0], round(sy(827))], 'week': [round(sx(520) - WK_PAD * SC), round(sy(456)) + DATE_DY],
     'month': [round(sx(629.5)), round(sy(456)) + DATE_DY], 'dash': [round(sx(724.5)), round(sy(456)) + DATE_DY], 'day': [round(sx(758)), round(sy(456)) + DATE_DY],
     'pm': [round(sx(P_BOX[0] - 3)), round(sy(P_BOX[1] - 3))], 'bar': [BAR_X, BAR_Y], 'barblk_y': [round(BAR_Y + 1 + i * BAR_PITCH) for i in range(10)], 'bell': bell_geo[2:], 'al1': [AL_X0, AL_Y0]}
geo['pos'] = P
geo['themed'] = ['lcd', 'case', 'colon', 'dash', 'pm'] + ['%s%d' % (k, d) for k in 'bms' for d in range(10)] + ['w%d' % i for i in range(7)] + ['bar%d' % n for n in range(11)] + ['barblk'] + ['bell', 'al1'] + ['t%d' % d for d in range(10)] + ['tcolon', 'tminus', 'tdeg'] + ['blk'] + ['ic_' + k for k in ('batt', 'step', 'temp', 'sunrise', 'sunset')]
json.dump(geo, open(H + '/geometry.json', 'w'), indent=1); print(json.dumps({'size': geo['size'], 'pos': P}))
