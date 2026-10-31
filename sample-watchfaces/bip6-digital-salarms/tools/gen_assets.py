"""Digital Salarms (big text, no bezel). Generates assets/*.png, preview.png and layout.json.
Run: python3 tools/gen_assets.py"""
import json, math, os, calendar, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import refmaps

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'assets')
W, H = 390, 450
SS = 4
INK = (28, 13, 0, 255)
SHADOW = (95, 45, 8, 120)
GHOST = (70, 35, 6, 62)
ORANGE = (255, 106, 0, 255)
rng = np.random.default_rng(7)

def S(v): return int(round(v * SS))

# ---------------- layout (single source of truth; also written to layout.json) ----------------
M = 14                                   # side margin of every panel
TOP = 21                                 # top and bottom margin
DATE_P = (M, TOP, W - 2 * M, 48)         # date panel x,y,w,h
MID_Y, MID_H = 79, 108
LEFT_P = (M, MID_Y, 242, MID_H)          # battery + calories
GAUGE_BOX = (268, MID_Y, 108, 108)
GAUGE_C = (GAUGE_BOX[0] + 54, GAUGE_BOX[1] + 54)
LCD_P = (M, 197, W - 2 * M, 232)         # time + steps/heart rate
DIG_Y = 213                              # big digits top
BIG = dict(dw=46, dh=92, cw=58, t=8)
MED = dict(dw=24, dh=46, cw=32, t=5)
HOUR_X, MIN_X, SEC_X = 33, 169, 297      # hour/minute/second cells (2 digits each)
SEC_Y = DIG_Y + BIG['dh'] - MED['dh']
SM_INK, DT_INK, LBL_INK = 26, 30, 18     # ink heights: readings, date row, labels
SM_W, SM_H = 22, 34
DT_W, DT_H = 24, 38
BOX_Y, BOX_H = 329, 84
BOXES = ((28, 160), (202, 160))          # steps, heart rate boxes x,w
ROW1_C, ROW2_C = MID_Y + 27, MID_Y + 81  # centres of battery / calories rows
LEFT_CX = LEFT_P[0] + LEFT_P[2] // 2

def font(size, bold=True, _c={}):
    k = (round(size * SS), bold)
    if k not in _c:
        for p, idx in (('/System/Library/Fonts/Avenir Next Condensed.ttc', 1 if bold else 0),
                       ('/System/Library/Fonts/HelveticaNeue.ttc', 1 if bold else 0)):
            try: _c[k] = ImageFont.truetype(p, k[0], index=idx); break
            except Exception: pass
    return _c[k]

def size_for(target, ch, bold):
    """font size whose glyph `ch` is `target` px tall (ink)"""
    lo, hi = 6, 220
    for _ in range(28):
        mid = (lo + hi) / 2
        bb = font(mid, bold).getbbox(ch, anchor='ls')
        if (bb[3] - bb[1]) / SS < target: lo = mid
        else: hi = mid
    return (lo + hi) / 2

def ink_h(f, ch):
    bb = f.getbbox(ch, anchor='ls'); return (bb[3] - bb[1]) / SS

def down(img, size): return img.resize(size, Image.LANCZOS)

def save(img, name, size=None):
    if size: img = down(img, size)
    img.save(os.path.join(OUT, name)); return img

def with_shadow(layer, dx=2.2, dy=2.8, blur=1.1, color=SHADOW):
    a = layer.getchannel('A')
    a = ImageChops.offset(a, S(dx), S(dy)).filter(ImageFilter.GaussianBlur(S(blur)))
    sh = Image.new('RGBA', layer.size, color[:3] + (0,))
    sh.putalpha(a.point(lambda v: v * color[3] // 255))
    sh.alpha_composite(layer); return sh

def draw_text(img, cx, cy, txt, f, fill, h_ink):
    """advance-centred horizontally, baseline so a glyph of height h_ink is centred on cy"""
    ImageDraw.Draw(img).text((cx * SS, (cy + h_ink / 2) * SS), txt, font=f, fill=fill, anchor='ms')

# ---------------- seven segment ----------------
SEGS = {'0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abfgcd'}

def seg_polys(w, h, t, g):
    m = t / 2
    hz = lambda yc, xl, xr: [(xl, yc), (xl + t / 2, yc - t / 2), (xr - t / 2, yc - t / 2), (xr, yc), (xr - t / 2, yc + t / 2), (xl + t / 2, yc + t / 2)]
    vt = lambda xc, yt, yb: [(xc, yt), (xc + t / 2, yt + t / 2), (xc + t / 2, yb - t / 2), (xc, yb), (xc - t / 2, yb - t / 2), (xc - t / 2, yt + t / 2)]
    ym = h / 2
    return {'a': hz(m, m + g, w - m - g), 'g': hz(ym, m + g, w - m - g), 'd': hz(h - m, m + g, w - m - g),
            'f': vt(m, m + g, ym - g), 'b': vt(w - m, m + g, ym - g), 'e': vt(m, ym + g, h - m - g), 'c': vt(w - m, ym + g, h - m - g)}

def seven(segs, p, color, shear=0.08, shadow=True, k=1.0):
    img = Image.new('RGBA', (p['cw'] * SS, p['dh'] * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    polys = seg_polys(p['dw'] * SS, p['dh'] * SS, p['t'] * SS, p['t'] * SS * .14)
    for s in segs:
        d.polygon([(x + (p['dh'] * SS - y) * shear, y) for x, y in polys[s]], fill=color)
    return with_shadow(img, 2.2 * k, 2.8 * k, 1.1 * k) if shadow else img

# ---------------- digit / word images ----------------
def make_digits():
    for pre, p, k in (('big', BIG, 1.0), ('med', MED, .7)):
        for n in '0123456789':
            save(seven(SEGS[n], p, INK, k=k), f'{pre}_{n}.png', (p['cw'], p['dh']))
    for pre, ink, cw, ch in (('sm', SM_INK, SM_W, SM_H), ('dt', DT_INK, DT_W, DT_H)):
        f = font(size_for(ink, '0', False), False)
        for n in '0123456789':
            img = Image.new('RGBA', (cw * SS, ch * SS), (0, 0, 0, 0)); draw_text(img, cw / 2, ch / 2, n, f, INK, ink_h(f, '0'))
            save(with_shadow(img, 1.4, 1.8, .8), f'{pre}_{n}.png', (cw, ch))
    f = font(size_for(SM_INK, '0', False), False)
    img = Image.new('RGBA', (30 * SS, SM_H * SS), (0, 0, 0, 0)); draw_text(img, 15, SM_H / 2, '%', f, INK, ink_h(f, '0'))
    save(with_shadow(img, 1.4, 1.8, .8), 'sm_pct.png', (30, SM_H))
    img = Image.new('RGBA', (SM_W * SS, SM_H * SS), (0, 0, 0, 0))
    ImageDraw.Draw(img).rectangle((S(4), S(SM_H / 2 - 1.5), S(SM_W - 4), S(SM_H / 2 + 1.5)), fill=INK)
    save(with_shadow(img, 1.2, 1.5, .7), 'sm_dash.png', (SM_W, SM_H))

def make_words():
    f = font(size_for(DT_INK, 'H', False), False); hh = ink_h(f, 'H')
    def word(txt, name):
        img = Image.new('RGBA', (84 * SS, DT_H * SS), (0, 0, 0, 0)); draw_text(img, 42, DT_H / 2, txt, f, INK, hh)
        save(with_shadow(img, 1.4, 1.8, .8), name, (84, DT_H))
    for i, d in enumerate(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']): word(d, f'week_{i}.png')
    for i in range(12): word(calendar.month_abbr[i + 1].upper(), f'mon_{i}.png')

def make_battery():
    """bat_0..bat_5: outline + 5 segments with n lit. 46x28 canvas, icon outline 38x20 at (3,4)"""
    for n in range(6):
        img = Image.new('RGBA', (46 * SS, 28 * SS), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
        ox, oy, bw, bh = 3, 4, 36, 20
        d.rounded_rectangle((S(ox), S(oy), S(ox + bw), S(oy + bh)), S(3), outline=INK, width=S(3))
        d.rectangle((S(ox + bw), S(oy + 6), S(ox + bw + 4), S(oy + bh - 6)), fill=INK)
        sw, gap = 4.6, 1.5
        x0 = ox + 3 + (bw - 6 - (5 * sw + 4 * gap)) / 2
        for i in range(5):
            x = x0 + i * (sw + gap)
            d.rectangle((S(x), S(oy + 3 + 1.5), S(x + sw), S(oy + bh - 3 - 1.5)), fill=INK if i < n else GHOST)
        save(with_shadow(img, 1.3, 1.6, .7), f'bat_{n}.png', (46, 28))

# ---------------- backgrounds / panels ----------------
def inset_shadow(img, mask, dx, dy, blur, strength):
    inv = ImageChops.offset(ImageChops.invert(mask), S(dx), S(dy)).filter(ImageFilter.GaussianBlur(S(blur)))
    a = ImageChops.multiply(inv, mask).point(lambda v: int(v * strength))
    layer = Image.new('RGBA', mask.size, (0, 0, 0, 255)); layer.putalpha(a); img.alpha_composite(layer)

def cham(x, y, w, h, c):
    tl, tr, br, bl = c
    return [(x + tl, y), (x + w - tr, y), (x + w, y + tr), (x + w, y + h - br), (x + w - br, y + h), (x + bl, y + h), (x, y + h - bl), (x, y + tl)]

def lcd_panel(img, box, c, tex, frame=3):
    x, y, w, h = box; d = ImageDraw.Draw(img)
    outer = lambda dy: [(S(px), S(py + dy)) for px, py in cham(x - frame, y - frame, w + 2 * frame, h + 2 * frame, tuple(v + frame for v in c))]
    d.polygon(outer(1.5), fill=(110, 110, 118, 255)); d.polygon(outer(0), fill=(5, 5, 6, 255))
    tile = refmaps.backlight(tex, (S(w), S(h))).convert('RGBA')
    m = Image.new('L', tile.size, 0)
    ImageDraw.Draw(m).polygon([(S(px - x), S(py - y)) for px, py in cham(x, y, w, h, c)], fill=255)
    inset_shadow(tile, m, 2, 3, 2.5, .3)
    img.paste(tile, (S(x), S(y)), m)

def carbon(w, h):
    ys, xs = np.mgrid[0:h, 0:w]; c = S(2.2)
    lum = 13 + 2 * (((xs // c) + (ys // c)) % 2) + 9 * ((ys // S(1.6)) % 2)
    lum = lum * (1 + .35 * np.exp(-(((xs / w - .5) / .5) ** 2 + ((ys / h - .4) / .5) ** 2)))
    return Image.fromarray(np.clip(np.dstack([lum, lum, lum * 1.03, np.full((h, w), 255)]), 0, 255).astype('uint8'), 'RGBA')

def lcd_label(d, x, y, txt, anchor, f):
    d.text((S(x + 1), S(y + 1.4)), txt, font=f, fill=SHADOW, anchor=anchor)
    d.text((S(x), S(y)), txt, font=f, fill=INK, anchor=anchor)

def colon_x():
    """x centre of the colon: midpoint between hour right ink edge and minute left ink edge (measured later, nudge here)"""
    return (HOUR_X + 58 + BIG['dw'] + 7.4 * .5 + MIN_X) / 2 + 1.5

def make_bg():
    size = (S(W), S(H))
    img = carbon(*size); d = ImageDraw.Draw(img)
    # panels
    lcd_panel(img, DATE_P, (24, 24, 8, 8), refmaps.BOX_MAIN)
    lcd_panel(img, LEFT_P, (8, 8, 8, 8), refmaps.BOX_BATT)
    lcd_panel(img, LCD_P, (24, 24, 30, 30), refmaps.BOX_MAIN, 4)
    d = ImageDraw.Draw(img)
    # date dash
    cx, cy = 222, DATE_P[1] + DATE_P[3] / 2
    d.rectangle((S(cx - 6 + 1), S(cy - 1.5 + 1.4), S(cx + 6 + 1), S(cy + 1.5 + 1.4)), fill=SHADOW)
    d.rectangle((S(cx - 6), S(cy - 1.5), S(cx + 6), S(cy + 1.5)), fill=INK)
    # left panel divider + CAL label
    dy = MID_Y + MID_H / 2
    d.line((S(M + 10), S(dy + 1), S(M + LEFT_P[2] - 10), S(dy + 1)), fill=(255, 225, 160, 140), width=S(1))
    d.line((S(M + 10), S(dy), S(M + LEFT_P[2] - 10), S(dy)), fill=(60, 30, 5, 255), width=S(1.3))
    fl = font(size_for(LBL_INK, 'H', True), True); hl = ink_h(fl, 'H')
    lcd_label(d, 30, ROW2_C + hl / 2, 'CAL', 'ls', fl)
    # gauge housing from the photo
    gx, gy, gw = GAUGE_BOX[0], GAUGE_BOX[1], GAUGE_BOX[2]
    g = refmaps.gauge((S(gw), S(gw))).convert('RGBA')
    gm = Image.new('L', g.size, 0); ImageDraw.Draw(gm).rounded_rectangle((0, 0, g.width - 1, g.height - 1), S(16), fill=255)
    d.rounded_rectangle((S(gx - 2), S(gy - 2), S(gx + gw + 2), S(gy + gw + 3.5)), S(18), fill=(80, 80, 86, 255))
    img.paste(g, (S(gx), S(gy)), gm); d = ImageDraw.Draw(img)
    # big LCD: ghosts, colon, SEC, boxes + labels
    for x in (HOUR_X, HOUR_X + BIG['cw'], MIN_X, MIN_X + BIG['cw']):
        img.alpha_composite(seven('abcdefg', BIG, GHOST, shadow=False), (S(x), S(DIG_Y)))
    for x in (SEC_X, SEC_X + MED['cw']):
        img.alpha_composite(seven('abcdefg', MED, GHOST, shadow=False), (S(x), S(SEC_Y)))
    mid = DIG_Y + BIG['dh'] / 2; ccx = colon_x(); q = 11
    for off, sh in ((-17, 5.0), (17, 2.3)):
        px = ccx + sh - 3.7
        d.rounded_rectangle((S(px - q / 2 + 1.4), S(mid + off - q / 2 + 1.8), S(px + q / 2 + 1.4), S(mid + off + q / 2 + 1.8)), S(1), fill=SHADOW)
        d.rounded_rectangle((S(px - q / 2), S(mid + off - q / 2), S(px + q / 2), S(mid + off + q / 2)), S(1), fill=INK)
    lcd_label(d, SEC_X + 2, SEC_Y - 10, 'SEC', 'ls', fl)
    for (bx, bw), name in zip(BOXES, ('STEPS', 'H/RATE')):
        d.rounded_rectangle((S(bx + 1), S(BOX_Y + 1.5), S(bx + bw + 1), S(BOX_Y + BOX_H + 1.5)), S(10), outline=SHADOW, width=S(2))
        d.rounded_rectangle((S(bx), S(BOX_Y), S(bx + bw), S(BOX_Y + BOX_H)), S(10), outline=(120, 60, 8, 255), width=S(1.6))
        lcd_label(d, bx + bw / 2, BOX_Y + 14 + LBL_INK, name, 'ms', fl)
    out = down(img, (W, H)); save(out, 'bg.png'); return out

def make_glare():
    size = (S(W), S(H)); g = Image.new('L', size, 0); d = ImageDraw.Draw(g)
    d.polygon([(S(230), 0), (S(350), 0), (S(150), S(H)), (0, S(H)), (0, S(340))], fill=12)
    d.polygon([(S(110), 0), (S(160), 0), (0, S(240)), (0, S(170))], fill=7)
    g = g.filter(ImageFilter.GaussianBlur(S(2)))
    m = Image.new('L', size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), S(86), fill=255)
    g = ImageChops.multiply(g, m)
    layer = Image.new('RGBA', size, (255, 255, 255, 255)); layer.putalpha(g); save(layer, 'glare.png', (W, H))

def make_needle():
    L = 40
    img = Image.new('RGBA', (8 * SS, 2 * L * SS), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    d.polygon([(S(4), S(1)), (S(7), S(L)), (S(1), S(L))], fill=(255, 100, 0, 255))
    d.polygon([(S(4), S(1)), (S(4), S(L)), (S(1), S(L))], fill=(255, 165, 70, 255))
    d.rectangle((S(3), S(L), S(5), S(L + 12)), fill=(255, 100, 0, 255))
    save(img, 'needle.png', (8, 2 * L))
    hub = Image.new('RGBA', (16 * SS, 16 * SS), (0, 0, 0, 0)); d = ImageDraw.Draw(hub)
    d.ellipse((S(1), S(1), S(15), S(15)), fill=(25, 25, 27, 255), outline=(190, 190, 196, 255), width=S(1.5))
    d.ellipse((S(5), S(5), S(11), S(11)), fill=ORANGE); save(hub, 'hub.png', (16, 16))
    return L

# ---------------- layer positions (device px) ----------------
def layout():
    dy = DATE_P[1] + DATE_P[3] // 2
    wk_x = 70; day_x = 155; mon_x = 236
    return {
        'week': (wk_x, dy - DT_H // 2), 'day': (day_x, dy - DT_H // 2), 'month': (mon_x, dy - DT_H // 2),
        'bat_icon': (28, ROW1_C - 14), 'battery': (LEFT_CX - 60, ROW1_C - SM_H // 2, 120, SM_H),
        'cal': (LEFT_CX - 60, ROW2_C - SM_H // 2, 120, SM_H),
        'hour': (HOUR_X, DIG_Y), 'minute': (MIN_X, DIG_Y), 'second': (SEC_X, SEC_Y),
        'steps': (BOXES[0][0], BOX_Y + 14 + LBL_INK + 12 - (SM_H - SM_INK) // 2, BOXES[0][1], SM_H),
        'hr': (BOXES[1][0], BOX_Y + 14 + LBL_INK + 12 - (SM_H - SM_INK) // 2, BOXES[1][1], SM_H),
        'gauge_c': GAUGE_C, 'hub': (GAUGE_C[0] - 8, GAUGE_C[1] - 8),
    }

def make_icon(bg):
    bg.crop((0, 30, 390, 420)).resize((192, 192), Image.LANCZOS).save(os.path.join(OUT, 'icon.png'))

def preview(bg, lay, L):
    img = bg.copy()
    put = lambda name, x, y: img.alpha_composite(Image.open(os.path.join(OUT, name)), (int(x), int(y)))
    for ch, x in zip('0125', (HOUR_X, HOUR_X + BIG['cw'], MIN_X, MIN_X + BIG['cw'])): put(f'big_{ch}.png', x, DIG_Y)
    for ch, x in zip('06', (SEC_X, SEC_X + MED['cw'])): put(f'med_{ch}.png', x, SEC_Y)
    put('week_5.png', *lay['week'])
    for ch, x in zip('31', (lay['day'][0], lay['day'][0] + DT_W)): put(f'dt_{ch}.png', x, lay['day'][1])
    put('mon_9.png', *lay['month'])
    put('bat_4.png', *lay['bat_icon'])
    def row(s, box):
        ws = [30 if c == '%' else SM_W for c in s]; x = box[0] + (box[2] - sum(ws)) / 2
        for c, w in zip(s, ws): put('sm_pct.png' if c == '%' else f'sm_{c}.png', x, box[1]); x += w
    row('75%', lay['battery']); row('280', lay['cal']); row('8670', lay['steps']); row('86', lay['hr'])
    n = Image.open(os.path.join(OUT, 'needle.png')).rotate(-6 * 6, resample=Image.BICUBIC, center=(4, L))
    img.alpha_composite(n, (GAUGE_C[0] - 4, GAUGE_C[1] - L)); put('hub.png', *lay['hub']); put('glare.png', 0, 0)
    img.save(os.path.join(ROOT, 'preview.png'))

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith('.png'): os.remove(os.path.join(OUT, f))
    make_digits(); make_words(); make_battery(); make_glare(); L = make_needle()
    bg = make_bg(); make_icon(bg); lay = layout(); preview(bg, lay, L)
    json.dump({'layout': lay, 'needle_len': L, 'gauge_c': GAUGE_C}, open(os.path.join(ROOT, 'layout.json'), 'w'), indent=1)
    print('ok', len(os.listdir(OUT)), 'assets')
