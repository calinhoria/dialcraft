"""Key the magenta off the five generated sheets and cut every picture the face needs into art/ (RGBA PNG at watch size).
Run from this folder:  python3 src/cut.py
The sheets are in ../sheets (digits, wx_a / wx_b / wx_c = weather icons 1-10 / 11-20 / 21-29, icons = heart, shoe, battery).
"""
from PIL import Image
import numpy as np, os, json

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SH = os.path.join(ROOT, 'sheets') + '/'
ART = os.path.join(ROOT, 'art') + '/'
os.makedirs(ART, exist_ok=True)

DIG_H = int(os.environ.get('DIG_H', 64))     # time digits: ink height in device px
WX_CUR = 0.144                               # current weather icon: device px per sheet px
WX_FC = 0.117                                # forecast icons
CIC = {'heart': 0.068, 'shoe': 0.072, 'batt': 0.074}   # complication icons, device px per sheet px


def key(path):
    """magenta -> alpha, with the magenta taken out of the soft edges (un-mix). returns float RGBA 0..1"""
    a = np.array(Image.open(path).convert('RGB')).astype(float)
    bg = np.array([250.0, 5.0, 249.0])
    m = np.minimum(a[:, :, 0], a[:, :, 2]) - a[:, :, 1]
    t = np.clip(m / 244.0, 0, 1)
    al = 1 - t
    al[al < 0.06] = 0
    al = np.clip(al, 0, 1)
    out = np.zeros(a.shape[:2] + (4,))
    k = al > 0
    for c in range(3):
        v = a[:, :, c]
        out[:, :, c] = np.where(k, np.clip((v - (1 - al) * bg[c]) / np.maximum(al, 1e-3), 0, 255), 0) / 255.0
    out[:, :, 3] = al
    return out


def bbox(al, th=0.3):
    ys, xs = np.where(al > th)
    return xs.min(), xs.max() + 1, ys.min(), ys.max() + 1


def resize(rgba, w, h):
    """premultiplied LANCZOS resize of a float RGBA array"""
    pm = rgba.copy()
    pm[:, :, :3] *= pm[:, :, 3:4]
    ch = [Image.fromarray((pm[:, :, i] * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS) for i in range(4)]
    r = np.stack([np.array(c).astype(float) / 255 for c in ch], 2)
    a = r[:, :, 3:4]
    r[:, :, :3] = np.where(a > 0.004, r[:, :, :3] / np.maximum(a, 1e-3), 0)
    return np.clip(r, 0, 1)


def save(rgba, name):
    Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), 'RGBA').save(ART + name)


def runs(mask1d, gap=6):
    out = []; s = None; last = None
    for i, v in enumerate(mask1d):
        if v:
            if s is None: s = i
            last = i
        elif s is not None and i - last > gap:
            out.append((s, last + 1)); s = None
    if s is not None: out.append((s, last + 1))
    return out


# ---------------------------------------------------------------- digits 0-9 (white): sets of one cell size, the ink centred in the cell
d = key(SH + 'digits.png')
al = d[:, :, 3]
rows = runs((al > 0.3).any(1), 40)
assert len(rows) == 3, rows
cells = []
for r, (y0, y1) in enumerate(rows):
    for (x0, x1) in runs((al[y0:y1] > 0.3).any(0), 30):
        cells.append((r, y0, y1, x0, x1))
assert len(cells) == 11, len(cells)
names = list('0123456789') + ['colon']
h0 = rows[0][1] - rows[0][0]
meta = {}


def digit_set(H, prefix, bold=0.0, pad=0, thin=0.0):
    """ten digits and the colon at ink height H; every digit the same canvas (width of the widest, ink centred) because the watch draws a digit set in equal cells"""
    sc = H / float(h0)
    pics = {}
    for (r, y0, y1, x0, x1), nm in zip(cells, names):
        fy0, fy1 = rows[2] if nm == 'colon' else (y0, y1)     # the colon takes the third row's frame: it lands on the digits' centre line
        crop = d[fy0:fy1, x0:x1]
        w = max(1, int(round((x1 - x0) * sc))); h = int(round((fy1 - fy0) * sc))
        out = resize(crop, w, h)
        oy = (H - h) // 2
        cv = np.zeros((H, w, 4))
        cv[max(oy, 0):max(oy, 0) + min(h, H)] = out[:min(h, H)]
        cv[:, :, :3] = np.where(cv[:, :, 3:4] > 0, 1.0, 0.0)       # pure white (the layer can be tinted)
        pics[nm] = cv
    W = max(p.shape[1] for n, p in pics.items() if n != 'colon') + 2 * pad
    for nm, p in pics.items():
        if nm == 'colon':
            save(p, f'{prefix}_colon.png'); meta[f'{prefix}_colon'] = [p.shape[1], H]; continue
        cv = np.zeros((H, W, 4)); ox = (W - p.shape[1]) // 2
        cv[:, ox:ox + p.shape[1]] = p
        if bold:                                   # small sizes lose weight in the downsample: thicken the stroke a little
            from PIL import ImageFilter
            a3 = np.array(Image.fromarray((cv[:, :, 3] * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) / 255.0
            cv[:, :, 3] = np.clip(cv[:, :, 3] * (1 - bold) + a3 * bold, 0, 1)
            cv[:, :, :3] = np.where(cv[:, :, 3:4] > 0, 1.0, 0.0)
        if thin:                                   # a lighter stroke: blend towards the eroded alpha
            from PIL import ImageFilter
            a3 = np.array(Image.fromarray((cv[:, :, 3] * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))) / 255.0
            cv[:, :, 3] = np.clip(cv[:, :, 3] * (1 - thin) + a3 * thin, 0, 1)
            cv[:, :, :3] = np.where(cv[:, :, 3:4] > 0, 1.0, 0.0)
        save(cv, f'{prefix}_{nm}.png')
    meta[prefix] = [W, H]


digit_set(DIG_H, 'd')
digit_set(20, 'd20', 0.25, 1)
digit_set(26, 'd26', 0.15, 1)
digit_set(18, 'd18', 0.25, 1)
json.dump(meta, open(ART + 'digits.json', 'w'))
print('digit sets (cell width, height)', meta)

# ---------------------------------------------------------------- weather (29, the watch's order)
CELLS = [('wx_a.png', 5, 2, 10), ('wx_b.png', 5, 2, 10), ('wx_c.png', 5, 2, 9)]
icons = []
for fn, cols, nrows, n in CELLS:
    k = key(SH + fn)
    Hh, Ww = k.shape[:2]
    for i in range(n):
        r, c = divmod(i, cols)
        x0, x1, y0, y1 = c * Ww // cols, (c + 1) * Ww // cols, r * Hh // nrows, (r + 1) * Hh // nrows
        cell = k[y0:y1, x0:x1]
        bx0, bx1, by0, by1 = bbox(cell[:, :, 3], 0.12)
        icons.append(cell[by0:by1, bx0:bx1])
assert len(icons) == 29
ext = max(max(c.shape[:2]) for c in icons)
print('largest icon', ext)


def wx_set(prefix, f):
    S = int(np.ceil(ext * f)) + 2
    S += S % 2
    for i, ic in enumerate(icons):
        h, w = ic.shape[:2]
        nw, nh = max(1, int(round(w * f))), max(1, int(round(h * f)))
        r = resize(ic, nw, nh)
        cv = np.zeros((S, S, 4))
        ox, oy = (S - nw) // 2, (S - nh) // 2
        cv[oy:oy + nh, ox:ox + nw] = r
        save(cv, f'{prefix}_{i:02d}.png')
    return S


S1 = wx_set('wxc', WX_CUR)
S2 = wx_set('wxf', WX_FC)
print('weather canvases', S1, S2)

# ---------------------------------------------------------------- heart, shoe, battery
k = key(SH + 'icons.png')
Hh, Ww = k.shape[:2]
for i, (nm, f) in enumerate(CIC.items()):
    cell = k[:, i * Ww // 3:(i + 1) * Ww // 3]
    bx0, bx1, by0, by1 = bbox(cell[:, :, 3], 0.2)
    c = cell[by0:by1, bx0:bx1]
    w, h = int(round(c.shape[1] * f)), int(round(c.shape[0] * f))
    save(resize(c, w, h), f'i_{nm}.png')
    print(nm, w, h)
json.dump({'cur': S1, 'fc': S2}, open(ART + 'wx.json', 'w'))

# ---------------------------------------------------------------- flame (calories), its own sheet: one icon, 28 px tall
fl = key(SH + 'flame.png')
bx0, bx1, by0, by1 = bbox(fl[:, :, 3], 0.2)
c = fl[by0:by1, bx0:bx1]
h = 28; w = int(round(c.shape[1] * h / c.shape[0]))
save(resize(c, w, h), 'i_flame.png')
print('flame', w, h)

# ---------------------------------------------------------------- sunrise and sunset icons (one sheet, two icons)
# one scale for both (the suns match): the wider icon is 28 px wide. sun.json = where the horizon line ends (px from the icon's top), to put it on the digits' baseline
su = key(SH + 'sun.png')
Wd = su.shape[1]
crops = []
for i in range(2):
    cell = su[:, i * Wd // 2:(i + 1) * Wd // 2]
    bx0, bx1, by0, by1 = bbox(cell[:, :, 3], 0.2)
    crops.append(cell[by0:by1, bx0:bx1])
f = 28.0 / max(c.shape[1] for c in crops)
off = {}
for nm, c in zip(['sunrise', 'sunset'], crops):
    w, h = int(round(c.shape[1] * f)), int(round(c.shape[0] * f))
    r = resize(c, w, h)
    save(r, f'i_{nm}.png')
    white = (r[:, :, 3] > 0.5) & (r[:, :, :3].min(2) > 0.85)          # the white horizon / reflection lines
    cnt = white.sum(1); full = np.where(cnt >= 0.8 * cnt.max())[0]
    off[nm] = int(full.min() + (np.split(full, np.where(np.diff(full) > 1)[0] + 1)[0]).size)   # bottom edge of the first (top) full-width white line
    print(nm, w, h, 'horizon ends at', off[nm])
json.dump(off, open(ART + 'sun.json', 'w'))
