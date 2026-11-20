#!/usr/bin/env python3
"""Cuts the Nano Banana images (art/lcd.png, lcd-lit.png, digits.png, week.png) into watch pictures for the Bip 6 (390 x 450) and works out where
every layer goes. Writes assets/lcd/*.png and geometry.json.

 scenes:   the LCD face, unlit and backlit, 390 x 450. The generator drew the printed outline with small round corners, but the Bip 6 screen is cut
           at a radius of 86: the old outline is removed and a new one drawn 15 px inside the screen edge, concentric with the corners.
 digits:   the 0-9 sheet, keyed off its magenta, each digit in an equal cell with a faint ghost of the unlit segments (the '8' under it), at four
           sizes: big (hour, minute), small (seconds, date), tiny (battery, steps, temperature) and a light always-on set of the big one.
 weekday:  the seven labels in equal cells (Monday first, as the watch counts).
 drawn:    the colon (and a blank for blinking), the date dot, the minus and the degree sign, in the same LCD style."""
import json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
H = os.path.dirname(os.path.abspath(__file__)); OUT = H + '/assets/lcd'; os.makedirs(OUT, exist_ok=True)
SW, SH = 390, 450
INK = (11, 22, 48)                                   # the LCD ink: dark navy, the colour asked of the generator
def save(im, name): im.save(OUT + '/' + name + '.png', optimize=True)
# ------------------------------------------------------------------ scenes
RECT = (39.5, 31.5, 850.5, 979.5, 80.0)              # the generator's printed outline in its picture (left, top, right, bottom, corner radius), measured
def sdf_round_rect(w, h, l, t, r_, b, rad):
    yy, xx = np.mgrid[0:h, 0:w]; cx, cy = (l + r_) / 2, (t + b) / 2; hx, hy = (r_ - l) / 2 - rad, (b - t) / 2 - rad
    qx, qy = np.abs(xx - cx) - hx, np.abs(yy - cy) - hy
    return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - rad
def scene(path, name):
    a = np.array(Image.open(H + '/art/' + path).convert('RGB')).astype(float); h, w, _ = a.shape
    d = sdf_round_rect(w, h, *RECT[:4], RECT[4]) if False else sdf_round_rect(w, h, RECT[0], RECT[1], RECT[2], RECT[3], RECT[4])
    band = np.abs(d) <= 11
    lum = a.mean(axis=2); local = np.array(Image.fromarray(lum.astype('uint8')).filter(ImageFilter.GaussianBlur(14))).astype(float)
    line = band & (local - lum > 25)
    col = np.median(a[line], axis=0)                                                     # the printed line colour (taken from the old outline)
    # remove the old outline: the band is filled from what is around it (repeated averaging), then the picture's grain is put back
    known = ~band; f = a.copy(); f[band] = np.median(a[known & (np.abs(d) < 30)], axis=0)
    for _ in range(700):
        g = (np.roll(f, 1, 0) + np.roll(f, -1, 0) + np.roll(f, 1, 1) + np.roll(f, -1, 1)) / 4; f[band] = g[band]
    hp = a - np.array(Image.fromarray(a.astype('uint8')).filter(ImageFilter.GaussianBlur(2))).astype(float)
    sd = hp[known & (np.abs(d) < 60)].std(axis=0); rng = np.random.default_rng(3); f[band] += rng.normal(0, 1, f[band].shape) * sd * 0.8
    im = Image.fromarray(np.clip(f, 0, 255).astype('uint8')).resize((SW, SH), Image.LANCZOS)
    # the new outline: 15 px inside the screen edge, corner radius 86 - 15 = 71, concentric with the screen's corners
    S = 4; ov = Image.new('L', (SW * S, SH * S), 0); dr = ImageDraw.Draw(ov)
    dr.rounded_rectangle([15 * S, 15 * S, (SW - 15) * S, (SH - 15) * S], radius=71 * S, outline=255, width=round(1.9 * S))
    al = np.array(ov.resize((SW, SH), Image.LANCZOS)).astype(float) / 255
    o = np.array(im).astype(float) * (1 - al[..., None]) + np.array(col) * al[..., None]
    out = Image.fromarray(o.astype('uint8')); out.quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(OUT + '/' + name + '.png', optimize=True)
    return col
scene('lcd.png', 'scene'); scene('lcd-lit.png', 'scene-lit')
# ------------------------------------------------------------------ keying
INK_KEY = None
def key(path):
    a = np.array(Image.open(path).convert('RGB')).astype(float)
    border = np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)]); m = np.median(border, axis=0)
    d = np.sqrt(((a - m) ** 2).sum(axis=2)); al = np.clip((d - 50) / 70, 0, 1)
    rgb = np.clip((a - (1 - al)[..., None] * m) / np.maximum(al, 1e-3)[..., None], 0, 255)
    rgb[:] = INK_KEY if INK_KEY is not None else rgb                              # the ink is one flat colour: recolour so no key-colour fringe is left on the edges
    return Image.fromarray(np.dstack([rgb, al * 255]).astype('uint8'), 'RGBA'), d
# ------------------------------------------------------------------ digits
INK_KEY = np.array(INK, float)
dig, dd = key(H + '/art/digits.png')
CELL_W, CELL_H = 176, 262; INK_TOP, INK_H = 7, 246                    # one digit's cell in the sheet's pixels; the lit segments run from INK_TOP for INK_H
def blobs(mask, y0, y1, gap=12):
    cols = np.where(mask[y0:y1].any(axis=0))[0]; g = []; s = p = cols[0]
    for x in cols[1:]:
        if x > p + gap: g.append((s, p)); s = x
        p = x
    g.append((s, p)); out = []
    for a, b in g:
        ys = np.where(mask[y0:y1, a:b + 1].any(axis=1))[0]; out.append((a, b, y0 + ys.min(), y0 + ys.max()))
    return [o for o in out if o[1] - o[0] > 100]
ghost = dd > 12; centres = []
for (y0, y1) in [(40, 330), (380, 640), (700, 975)]: centres += [((a + b) / 2, (c + d_) / 2) for a, b, c, d_ in blobs(ghost, y0, y1)]
centres = centres[:4] + centres[4:8] + centres[8:10]                  # 0-3, 4-7, 8-9 (a third glyph on the last row is ignored)
assert len(centres) == 10, centres
def cell(im, c, w=CELL_W, h=CELL_H):
    return im.crop((round(c[0] - w / 2), round(c[1] - INK_TOP - INK_H / 2), round(c[0] - w / 2) + w, round(c[1] - INK_TOP - INK_H / 2) + h))
lit = [cell(dig, c) for c in centres]
g8 = np.array(lit[8])[..., 3].astype(float)                           # the '8' lights every segment: its shape is the ghost under each digit
def ghosted(im):
    gh = np.zeros((CELL_H, CELL_W, 4), 'uint8'); gh[..., :3] = INK; gh[..., 3] = (g8 * 0.085).astype('uint8')
    return Image.alpha_composite(Image.fromarray(gh, 'RGBA'), im)
def light(im, col=(170, 180, 196)):                                    # the always-on set: light segments on black, no ghost, no shadow
    a = np.array(im).astype(float); al = np.clip((a[..., 3] / 255 - 0.55) * 2.2, 0, 1); o = np.zeros(a.shape, 'uint8'); o[..., :3] = col; o[..., 3] = (al * 255).astype('uint8')
    return Image.fromarray(o, 'RGBA')
S_BIG, S_SMALL, S_TINY = 0.34, 0.19, 0.12
def rs(im, s): return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
geo = {'names': {}, 'size': {}}
for key_, s in (('b', S_BIG), ('s', S_SMALL), ('t', S_TINY)):
    names = []
    for k in range(10):
        save(rs(ghosted(lit[k]), s), '%s%d' % (key_, k)); names.append('lcd/%s%d.png' % (key_, k))
    geo['names'][key_] = names; geo['size'][key_] = list(rs(lit[0], s).size)
names = []
for k in range(10): save(rs(light(lit[k]), S_BIG), 'a%d' % k); names.append('lcd/a%d.png' % k)
geo['names']['a'] = names; geo['size']['a'] = geo['size']['b']
# ------------------------------------------------------------------ drawn parts (colon, dot, minus, degree) in the same style: ink with a soft shadow to the lower right
def shadowed(draw_fn, w, h, s):
    k = 4; lay = Image.new('L', (w * k, h * k), 0); draw_fn(ImageDraw.Draw(lay), k); lay = lay.resize((w, h), Image.LANCZOS)
    a = np.array(lay).astype(float) / 255
    sh = Image.fromarray((a * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(3)); sh = np.roll(np.roll(np.array(sh).astype(float) / 255, 5, 0), 5, 1) * 0.38
    out = np.zeros((h, w, 4), 'uint8'); al = np.clip(a + sh * (1 - a), 0, 1); out[..., :3] = INK; out[..., 3] = (al * 255).astype('uint8')
    return rs(Image.fromarray(out, 'RGBA'), s)
top, bot = INK_TOP, INK_TOP + INK_H
def colon(dr, k):
    for yc in (top + 0.31 * INK_H, top + 0.69 * INK_H): dr.rectangle([(70 - 16) * k / 2 + 0, (yc - 16) * k, (70 + 16) * k / 2 + 0, (yc + 16) * k], fill=255)
colon_w = 70
def colon_fn(dr, k):
    for yc in (top + 0.31 * INK_H, top + 0.69 * INK_H): dr.rectangle([(colon_w / 2 - 16) * k, (yc - 16) * k, (colon_w / 2 + 16) * k, (yc + 16) * k], fill=255)
save(shadowed(colon_fn, colon_w, CELL_H, S_BIG), 'colon'); save(Image.new('RGBA', rs(lit[0], 1).size and (round(colon_w * S_BIG), round(CELL_H * S_BIG)), (0, 0, 0, 0)), 'colon_off')
colon_aod = np.array(shadowed(colon_fn, colon_w, CELL_H, S_BIG)); colon_aod[..., :3] = (170, 180, 196); colon_aod[..., 3] = np.where(colon_aod[..., 3] > 140, 255, 0); save(Image.fromarray(colon_aod, 'RGBA'), 'colon_aod')
dot_w = 60
save(shadowed(lambda dr, k: dr.rectangle([(dot_w / 2 - 15) * k, (bot - 30) * k, (dot_w / 2 + 15) * k, bot * k], fill=255), dot_w, CELL_H, S_SMALL), 'dot')
save(shadowed(lambda dr, k: dr.rectangle([(CELL_W / 2 - 50) * k, (top + INK_H / 2 - 16) * k, (CELL_W / 2 + 50) * k, (top + INK_H / 2 + 16) * k], fill=255), CELL_W, CELL_H, S_TINY), 'minus')
deg_w = 80
def deg_fn(dr, k):
    dr.rectangle([(deg_w / 2 - 24) * k, top * k, (deg_w / 2 + 24) * k, (top + 48) * k], fill=255); dr.rectangle([(deg_w / 2 - 12) * k, (top + 12) * k, (deg_w / 2 + 12) * k, (top + 36) * k], fill=0)
save(shadowed(deg_fn, deg_w, CELL_H, S_TINY), 'degree')
Image.new('RGBA', (8, 8), (0, 0, 0, 0)).save(OUT + '/tap.png')
geo['size'].update({'colon': [round(colon_w * S_BIG), round(CELL_H * S_BIG)], 'dot': [round(dot_w * S_SMALL), round(CELL_H * S_SMALL)], 'minus': list(rs(lit[0], S_TINY).size), 'degree': [round(deg_w * S_TINY), round(CELL_H * S_TINY)]})
# ------------------------------------------------------------------ weekday labels
wk, wd = key(H + '/art/week.png'); wl = np.array(wk)[..., 3] > 128
slabs = [(0, 265, 20, 300), (265, 520, 20, 300), (520, 770, 20, 300), (770, 1024, 20, 300), (0, 360, 340, 637), (360, 650, 340, 637), (650, 1024, 340, 637)]
boxes = []
for x0, x1, y0, y1 in slabs:
    sub = wl[y0:y1, x0:x1]; ys = np.where(sub.any(axis=1))[0]; xs = np.where(sub.any(axis=0))[0]; boxes.append((x0 + xs.min(), y0 + ys.min(), x0 + xs.max(), y0 + ys.max()))
LH = max(b[3] - b[1] for b in boxes) + 1; LW = max(b[2] - b[0] for b in boxes) + 1; PAD = 10
labels = []
for (l, t, r_, b) in boxes:
    c = Image.new('RGBA', (LW + 2 * PAD, LH + 2 * PAD), (0, 0, 0, 0)); cx = (l + r_) / 2; cy = (t + b) / 2
    c.paste(wk.crop((round(cx - LW / 2) - PAD, round(cy - LH / 2) - PAD, round(cx - LW / 2) - PAD + LW + 2 * PAD, round(cy - LH / 2) - PAD + LH + 2 * PAD)), (0, 0)); labels.append(c)
S_WEEK = 56 / LH
order = [1, 2, 3, 4, 5, 6, 0]                                          # sheet order SU MO TU WE TH FR SA -> Monday first
wn = []
for i, k in enumerate(order): save(rs(labels[k], S_WEEK), 'w%d' % i); wn.append('lcd/w%d.png' % i)
geo['names']['w'] = wn; geo['size']['w'] = list(rs(labels[0], S_WEEK).size)
# ------------------------------------------------------------------ where everything goes (screen pixels)
Y = lambda v: v * SH / 1024.0; X = lambda v: v * SW / 890.0
rule1, rule2, rule3, rule4 = Y(313.5), Y(657.5), Y(701.5), Y(871.5); div1, div2 = X(312), X(578)
big_h, small_h, tiny_h = geo['size']['b'][1], geo['size']['s'][1], geo['size']['t'][1]
zone_c = (rule1 + rule2) / 2                                           # the time zone's middle
ink_mid = lambda s: (INK_TOP + INK_H / 2) * s                          # from a cell's top to the middle of its lit segments
bw, cw, sw_ = geo['size']['b'][0], geo['size']['colon'][0], geo['size']['s'][0]
total = 4 * bw + cw + 8 + 2 * sw_; x0 = round((SW - total) / 2); ty = round(zone_c - ink_mid(S_BIG))
P = {'hour': [x0, ty], 'colon': [x0 + 2 * bw, ty], 'minute': [x0 + 2 * bw + cw, ty], 'second': [x0 + 4 * bw + cw + 8, round(ty + (INK_TOP + INK_H) * S_BIG - (INK_TOP + INK_H) * S_SMALL)]}
dbx0, dby0, dbx1, dby1 = X(438), Y(70), X(825), Y(272); dcx, dcy = (dbx0 + dbx1) / 2, (dby0 + dby1) / 2
dw = 4 * sw_ + geo['size']['dot'][0]; dx = round(dcx - dw / 2); dy = round(dcy - ink_mid(S_SMALL))
P['month'] = [dx, dy]; P['dot'] = [dx + 2 * sw_, dy]; P['day'] = [dx + 2 * sw_ + geo['size']['dot'][0], dy]
P['week'] = [round((X(52) + X(420)) / 2 - geo['size']['w'][0] / 2), round((Y(70) + Y(272)) / 2 - geo['size']['w'][1] / 2)]
cy_info = (rule3 + rule4) / 2; P['info_y'] = round(cy_info - ink_mid(S_TINY))
P['info'] = {'BATT': [(23 + div1) / 2, 'BATTERY'], 'STEP': [(div1 + div2) / 2, 'STEP'], 'TEMP': [(div2 + 367) / 2, 'WEATHER_CURRENT']}
P['info_w'] = round(div1 - 23 - 6)
geo['pos'] = P; geo['rules'] = [round(rule1, 1), round(rule2, 1), round(rule3, 1), round(rule4, 1), round(div1, 1), round(div2, 1)]
json.dump(geo, open(H + '/geometry.json', 'w'), indent=1); print(json.dumps({'size': geo['size'], 'pos': P, 'rules': geo['rules']}))
