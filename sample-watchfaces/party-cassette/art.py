"""Party Cassette, matched to the reference screenshot (ref/reference.png): the screen is cut out of the reference and scaled to the Bip 6 (390 x 450);
the time and the battery text are removed from it and rebuilt as native layers (the time in the E4 Digital V2 Bold font), and the two cassette reels are cut out as
sprites the code turns. Writes assets/pc/*.png, geometry.json, demo.png."""
import json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
H = os.path.dirname(os.path.abspath(__file__)); OUT = H + '/assets/pc'; os.makedirs(OUT, exist_ok=True)
INTER = '/Volumes/Projects/Projects/dialcraft/.claude/skills/create-amazfit-watchface/examples/animated/fonts/inter-600.ttf'
E4 = H + '/fonts/E4DigitalV2-Bold.ttf'
SW, SH = 390, 450
BOX = (68, 215, 476, 716)                       # the screen inside the reference picture (408 x 501)
KX, KY = SW / (BOX[2] - BOX[0]), SH / (BOX[3] - BOX[1])
geo = {'size': {}, 'names': {}}
def save(im, n): im.save(OUT + '/' + n + '.png', optimize=True)
ref = np.array(Image.open(H + '/ref/reference.png').convert('RGB')).astype(float)
ox, oy = BOX[0], BOX[1]

# ------------------------------------------------------------------ the scene: the screen of the reference, time and battery text taken out
work = ref.copy()
def grey_mask(x0, y0, x1, y1, lo, neutral):
    sub = work[y0:y1, x0:x1]; m = (sub.min(2) > lo) & (sub.max(2) - sub.min(2) < neutral)
    big = Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.MaxFilter(5)); return np.array(big) > 0
def fill_rows(x0, y0, x1, y1, m, ax=5):                 # fill each run of masked pixels from the pixels either side of the run (smooth backdrop behind the time), the pixels between runs stay untouched
    for y in range(y0, y1):
        row = m[y - y0]
        if not row.any(): continue
        x = 0
        while x < len(row):
            if not row[x]: x += 1; continue
            a = x
            while x < len(row) and row[x]: x += 1
            b = x - 1
            l = work[y, max(x0, x0 + a - ax):x0 + a].mean(0); r = work[y, x0 + b + 1:x0 + b + 1 + ax].mean(0)
            for xx in range(a, b + 1): work[y, x0 + xx] = l + (r - l) * (xx - a) / max(1, b - a)
def fill_cols(x0, y0, x1, y1, m, ay=3):                  # the same, per column (behind the battery text)
    for x in range(x0, x1):
        col = m[:, x - x0]
        if not col.any(): continue
        ys = np.where(col)[0]; a, b = ys.min(), ys.max()
        t = work[y0 + max(0, a - ay):y0 + a, x].mean(0); bt = work[y0 + b + 1:y0 + b + 1 + ay, x].mean(0)
        for y in range(a, b + 1): work[y0 + y, x] = t + (bt - t) * (y - a) / max(1, b - a)
# the clean teal block of the equaliser, taken from one the text does not touch
teal = work[661:672, 107:118].copy()
tm = grey_mask(100, 532, 458, 624, 105, 28)
_yy, _xx = np.mgrid[532:624, 100:458]; tm &= (_yy >= np.where(_xx < 290, 541.5, 538.75 + 0.02376 * _xx - 2.7))        # never above the cassette's lower edge: the silver strip along that edge looks like a digit but is cassette
fill_rows(100, 532, 458, 624, tm, 3)
bm = grey_mask(165, 640, 386, 676, 150, 40); fill_cols(165, 640, 386, 676, bm)
for k in (5, 9, 15): x = int(round(107.5 + 14 * k)); work[661:672, x:x + 11] = teal
scene = Image.fromarray(np.clip(work[BOX[1]:BOX[3], BOX[0]:BOX[2]], 0, 255).astype('uint8')).resize((SW, SH), Image.LANCZOS)
# the cassette's bottom edge lies OVER the top of the time in the reference (the digits start under its dark outline, lower and lower towards the right): keep that edge as a picture above the time layers
EX0, EX1, EY0, EY1 = 100, 452, 530, 553
ov = work[EY0:EY1, EX0:EX1].copy(); al = np.zeros(ov.shape[:2])
for xx in range(EX0, EX1):
    e = 538.75 + 0.02376 * xx
    for yy in range(EY0, EY1): al[yy - EY0, xx - EX0] = np.clip(e - yy + 0.5, 0, 1)
ovi = np.dstack([ov, al * 255]).astype('uint8'); edge_w, edge_h = round((EX1 - EX0) * KX), round((EY1 - EY0) * KY)
rgb = Image.fromarray(ovi[..., :3]).resize((edge_w, edge_h), Image.LANCZOS); alp = Image.fromarray(ovi[..., 3]).resize((edge_w, edge_h), Image.LANCZOS)
edge = rgb.convert('RGBA'); edge.putalpha(alp); save(edge, 'edge'); geo['size']['edge'] = [edge_w, edge_h]; geo['edge'] = [round((EX0 - ox) * KX), round((EY0 - oy) * KY)]
# the bezel's titanium and the black ring still show in the corners and along the sides: flood them from the border and paint them black
from collections import deque
sc_arr = np.array(scene).astype(int); hh, ww = sc_arr.shape[:2]
def bez(p): return p.sum() == 0 or (p.min() > 100 and p.max() - p.min() < 35)
seen = np.zeros((hh, ww), bool); dq = deque()
for x in range(ww):
    for y in (0, hh - 1):
        if bez(sc_arr[y, x]) and not seen[y, x]: seen[y, x] = True; dq.append((y, x))
for y in range(hh):
    for x in (0, ww - 1):
        if bez(sc_arr[y, x]) and not seen[y, x]: seen[y, x] = True; dq.append((y, x))
while dq:
    y, x = dq.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < hh and 0 <= nx < ww and not seen[ny, nx] and bez(sc_arr[ny, nx]): seen[ny, nx] = True; dq.append((ny, nx))
grow = np.array(Image.fromarray((seen * 255).astype('uint8')).filter(ImageFilter.MaxFilter(5))) > 0
sc_arr[grow] = 0; scene = Image.fromarray(sc_arr.astype('uint8'))
save(scene, 'bg')

# ------------------------------------------------------------------ the two reels, cut out of the original picture (a circle around each hub)
RS = 48
def reel(cx, cy):
    r = 22.5; half = 26; c = Image.fromarray(ref[int(round(cy - half)):int(round(cy + half)), int(round(cx - half)):int(round(cx + half))].astype('uint8'))
    S = 8; m = Image.new('L', (c.width * S, c.height * S), 0); ImageDraw.Draw(m).ellipse([(half - r) * S, (half - r) * S, (half + r) * S, (half + r) * S], fill=255)
    m = m.resize(c.size, Image.LANCZOS); c = c.convert('RGBA'); c.putalpha(m)
    return c.resize((RS, RS), Image.LANCZOS)
reels = []
for i, (cx, cy) in enumerate(((194.9, 433.4), (348.0, 440.7))):
    save(reel(cx, cy), 'reel%d' % i); reels.append([round((cx - ox) * KX - RS / 2), round((cy - oy) * KY - RS / 2)])
geo['reels'] = reels; geo['size']['reel'] = [RS, RS]

# ------------------------------------------------------------------ the time digits: 1 and 8 are cut out of the reference as they are (the tops of the 3 and 5 are hidden under the cassette there, so they are made like the rest); 0 2 3 4 5 6 7 9 are made from the E4 Digital font and coloured from the same rows of the reference
CHr = 72
CELL = {'1': 119, '8': 189}; CY0 = 543
def holes_filled(a):                                          # alpha 0..1 -> the same with the closed holes (the dark slots inside 8 / 0 / 6 ...) made solid
    h, w = a.shape; out = a.copy(); free = a < 0.5; seen = np.zeros((h, w), bool); dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if free[y, x] and not seen[y, x]: seen[y, x] = True; dq.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if free[y, x] and not seen[y, x]: seen[y, x] = True; dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and free[ny, nx] and not seen[ny, nx]: seen[ny, nx] = True; dq.append((ny, nx))
    out[free & ~seen] = 1.0; return out
def pic(rgb, alpha, dim):
    if dim: rgb = rgb * 0.42
    im = np.dstack([np.clip(rgb, 0, 255), np.clip(alpha, 0, 1) * 255]).astype('uint8')
    return Image.fromarray(im, 'RGBA').resize((CW, CH), Image.LANCZOS)
def cut_digit(ch):
    x0 = CELL[ch]; rgb = ref[CY0:CY0 + CHr, x0:x0 + CWr]; a = np.clip((rgb.min(2) - 50) / 100, 0, 1)
    return rgb, holes_filled(a)
# colour of a digit, row by row (taken from the stem of the 8), and the dark slot colour
prof = ref[CY0:CY0 + CHr, 191:206].mean(1)
slot = ref[563:568, 211:228].reshape(-1, 3).mean(0)
F4 = ImageFont.truetype(E4, 400); B8 = F4.getbbox('8'); SCF = CHr / (B8[3] - B8[1])          # the font is scaled so the digits are 72 px tall like the reference
HS = 0.84                                                                         # the reference squeezes the font to 84 % of its width (the 8 is 62 px wide)
def ink_w(ch): bb = F4.getbbox(ch); return (bb[2] - bb[0]) * SCF * HS
CWr = int(np.ceil(max(ink_w(c) for c in '0123456789')))                              # one cell width for every digit (tabular): the widest digit; the narrower ones sit in the middle
CW, CH = round(CWr * KX), round(CHr * KY)
def font_glyph(ch, cw_px, S=4, dy_from_digit_top=True):
    f = ImageFont.truetype(E4, int(round(400 * SCF * S))); b8 = f.getbbox('8'); bb = f.getbbox(ch)
    nat = int(round(cw_px / HS)) * S; im = Image.new('L', (nat, CHr * S), 0); gw = bb[2] - bb[0]
    ImageDraw.Draw(im).text(((nat - gw) / 2 - bb[0], -b8[1]), ch, font=f, fill=255)
    m = im.resize((cw_px, CHr), Image.LANCZOS); a = np.array(m).astype(float) / 255; return a
def font_digit(ch):
    a = font_glyph(ch, CWr); filled = holes_filled(a)
    rgb = np.broadcast_to(prof[:, None, :], (CHr, CWr, 3)).copy(); rgb[filled > a + 0.01] = slot; return rgb, filled
for ch in '0123456789':
    rgb, a = font_digit(ch)
    save(pic(rgb, a, False), 'c' + ch); save(pic(rgb, a, True), 'a' + ch)
geo['names']['c'] = ['pc/c%d.png' % i for i in range(10)]; geo['names']['a'] = ['pc/a%d.png' % i for i in range(10)]; geo['size']['c'] = [CW, CH]
# the colon from the same font
cwc = int(np.ceil(ink_w(':'))) + 6
a0 = font_glyph(':', cwc); rows = np.where(a0.max(1) > 0.5)[0]; mid = (rows.min() + rows.max()) // 2
gap = np.where(a0[:, a0.shape[1] // 2] < 0.1)[0]; gap = gap[(gap > rows.min()) & (gap < rows.max())]; split = int(gap.mean()) if len(gap) else mid
top_dot = a0[rows.min():split + 1]; bot_dot = a0[split + 1:rows.max() + 1]
a = np.zeros((CHr, cwc)); m0 = 4
a[m0:m0 + top_dot.shape[0]] = np.maximum(a[m0:m0 + top_dot.shape[0]], top_dot)
a[CHr - m0 - bot_dot.shape[0]:CHr - m0] = np.maximum(a[CHr - m0 - bot_dot.shape[0]:CHr - m0], bot_dot)
rgb = np.broadcast_to(prof[:, None, :], (CHr, cwc, 3)).copy()
def cpic(dim):
    im = np.dstack([np.clip(rgb * (0.42 if dim else 1), 0, 255), a * 255]).astype('uint8'); return Image.fromarray(im, 'RGBA').resize((round(cwc * KX), CH), Image.LANCZOS)
cl = cpic(False); save(cl, 'colon'); save(cpic(True), 'colon_a'); geo['size']['colon'] = list(cl.size)
# ------------------------------------------------------------------ the battery text: "% BATTERY" is cut out of the reference as it is, the 8 and the 3 too; the other digits are drawn in a matching sans
TXY0, TXY1 = 645, 671
def cut_text(x0, x1):                                          # white text over the (cleaned) backdrop: the coverage is how far each pixel is from the backdrop towards white
    r = ref[TXY0:TXY1 + 1, x0:x1 + 1]; bgp = work[TXY0:TXY1 + 1, x0:x1 + 1]
    a = np.clip(((r - bgp) / np.maximum(255 - bgp, 1)).mean(2), 0, 1); a = np.clip(a * 1.05, 0, 1)
    im = np.dstack([np.full(a.shape + (3,), 255), a * 255]).astype('uint8')
    return Image.fromarray(im, 'RGBA').resize((max(1, round(im.shape[1] * KX)), round(im.shape[0] * KY)), Image.LANCZOS)
TH = round((TXY1 - TXY0 + 1) * KY)
def font_text(ch):
    f = ImageFont.truetype(INTER, 120); b0 = f.getbbox('0'); sc = 22 / (b0[3] - b0[1]); f = ImageFont.truetype(INTER, int(round(120 * sc * 4))); b0 = f.getbbox('0'); bb = f.getbbox(ch)
    w = bb[2] - bb[0] + 2 * 4; im = Image.new('L', (w, (TXY1 - TXY0 + 1) * 4), 0); ImageDraw.Draw(im).text((4 - bb[0], 2 * 4 - b0[1]), ch, font=f, fill=255)
    a = im.resize((max(1, round(w / 4 * KX)), TH), Image.LANCZOS); o = Image.new('RGBA', a.size, (255, 255, 255, 0)); o.putalpha(a); return o
BD = {'8': (173, 188), '3': (193, 207)}
for ch in '0123456789': save(cut_text(*BD[ch]) if ch in BD else font_text(ch), 't' + ch)
wd = [Image.open(OUT + '/t%d.png' % i).width for i in range(10)]
geo['names']['t'] = ['pc/t%d.png' % i for i in range(10)]; geo['size']['t'] = [max(wd), TH]
u = cut_text(209, 375); save(u, 'unit'); geo['size']['unit'] = list(u.size)
# ------------------------------------------------------------------ positions (screen px): measured in the reference and scaled
def sx(x): return (x - ox) * KX
def sy(y): return (y - oy) * KY
SPB, GAPC = 8, 10                                     # gap between two digits, and between a digit and the colon (screen px)
tot = 4 * CW + 2 * SPB + 2 * GAPC + cl.width; X0 = round((SW - tot) / 2); YT = round(sy(543))
geo['pos'] = {'hour': [X0, YT], 'colon': [X0 + 2 * CW + SPB + GAPC, YT], 'minute': [X0 + 2 * CW + SPB + 2 * GAPC + cl.width, YT], 'space': SPB, 'batt': [0, round(sy(TXY0))]}
json.dump(geo, open(H + '/geometry.json', 'w'), indent=1)
# demo
im = scene.convert('RGBA'); P = geo['pos']
for i, ch in enumerate('1835'):
    x = P['hour'][0] + i * (CW + P['space']) if i < 2 else P['minute'][0] + (i - 2) * (CW + P['space']); im.alpha_composite(Image.open(OUT + '/c%s.png' % ch), (x, P['hour'][1]))
im.alpha_composite(cl, tuple(P['colon']))
for r, p in zip(('reel0', 'reel1'), reels): im.alpha_composite(Image.open(OUT + '/%s.png' % r), tuple(p))
im.convert('RGB').save(H + '/demo.png'); print('ok', geo['pos'], CW, CH)
