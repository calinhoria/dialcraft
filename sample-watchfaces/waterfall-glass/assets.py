#!/usr/bin/env python3
"""Export the Waterfall glass concept (from the Liquid Glass handoff) into watch assets.

Runs the handoff's own renderer (handoff/wf.py) and splits it into what a watch can
actually animate: a static rock/water plate, glass digit pictures, and a loop of
particle (spray/mist) overlays. Stats text is baked in the same SF style.

Source concept: "Liquid Glass Watch Face Handoff" — wf.py (waterfall), by the user.
"""
import importlib.util, json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
HAND = f'{ROOT}/handoff'
OUT = f'{ROOT}/assets'
for sub in ['fx', 'digits', 'ui']:
    os.makedirs(f'{OUT}/{sub}', exist_ok=True)

sys.path.insert(0, HAND)
spec = importlib.util.spec_from_file_location('wf', f'{HAND}/wf.py')
wf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wf)          # builds BG, MASK2, DIG, SCENE

S = wf.S
SW, SH = wf.SW, wf.SH
W, H = wf.W, wf.H
print('loaded', SW, SH, 'supersample', S)

# --------------------------------------------------------------- the plate --
bg = Image.fromarray((np.clip(wf.BG, 0, 1) * 255).astype(np.uint8)).resize((SW, SH), Image.LANCZOS)
bg.save(f'{OUT}/bg.png')
print('bg', bg.size)

# ------------------------------------------------------------- glass digits --
FONT_ROUND = '/System/Library/Fonts/SFNSRounded.ttf'


def glass_digit(ch, top_y, size=188):
    """One digit rendered with the concept's glass shading, returned as an RGBA cell."""
    f = ImageFont.truetype(FONT_ROUND, size * S)
    f.set_variation_by_name('Heavy')
    m = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(m)
    d.text((SW / 2 * S, top_y * S), ch, font=f, fill=255, anchor='mt')
    M = np.asarray(m, np.float32) / 255
    ys, xs = np.where(M > 0.02)
    if not len(xs):
        return None, (0, 0, 0, 0)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()

    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    ty = np.clip((yy - 60 * S) / (290 * S), 0, 1)
    base = np.stack([46 - 28 * ty, 60 - 38 * ty, 72 - 44 * ty], -1) / 255
    mb = wf.gblur(M, 4.0)
    gy, gx = np.gradient(mb)
    lx, ly = -0.45, -0.89
    lit = np.clip(-(gx * lx + gy * ly) * 9, 0, 1)
    dark = np.clip((gx * lx + gy * ly) * 9, 0, 1)
    rimtop = np.clip(M - np.roll(M, 5 * S, axis=0), 0, 1)
    rimtop = wf.gblur(rimtop, 1.4)
    col = base + lit[..., None] * np.array([0.45, 0.7, 0.8]) + rimtop[..., None] * np.array([0.5, 0.8, 0.9])
    col -= dark[..., None] * 0.06
    sheen = 0.10 * np.exp(-(((xx - 130 * S) / (90 * S)) ** 2 + ((yy - 110 * S) / (50 * S)) ** 2))
    col += sheen[..., None] * np.array([0.5, 0.8, 1.0])
    col = np.clip(col, 0, 1)
    rgba = np.dstack([col * 255, M * 255]).astype(np.uint8)
    cell = Image.fromarray(rgba[y0:y1 + 1, x0:x1 + 1], 'RGBA')
    cell = cell.resize((max(1, cell.width // S), max(1, cell.height // S)), Image.LANCZOS)
    return cell, (x0, x1, y0, y1)


def digit_set(tag, top_y, size=188):
    cells = []
    for i in range(10):
        c, _ = glass_digit(str(i), top_y, size)
        cells.append(c)
    cw = max(c.width for c in cells)
    ch = max(c.height for c in cells)
    for i, c in enumerate(cells):
        out = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        out.alpha_composite(c, ((cw - c.width) // 2, ch - c.height))
        out.save(f'{OUT}/digits/{tag}_{i}.png')
    print(tag, 'cell', cw, ch)
    return cw, ch


HOUR_CELL = digit_set('hour', 62)
MIN_CELL = digit_set('min', 222)
AOD_CELL = digit_set('aod', 150, 112)

# ---------------------------------------------------------------- particles --
def particle_frame(sim):
    """The concept's water, as an alpha overlay (rgb + alpha) instead of a composite.

    The concept renders ``SCENE*(1-a) + wc*a`` and then *adds* the droplets and the
    mist. Painting that as one picture over live digits only works if the glow is
    folded in as soft alpha — doing it as opaque colour turned the mist into white
    blobs over the numbers.
    """
    x, y, vx, vy, kind = sim.x * S, sim.y * S, sim.vx * S, sim.vy * S, sim.kind
    xs, ys, ws = [], [], []
    for j in range(11):
        f = j * 0.30
        xs.append(x - vx * f * 0.5); ys.append(y - vy * f * 0.5)
        ws.append(np.where(kind == 0, 1.5, 0.35) * (1 - j * 0.05))
    D = wf.splat_all(np.concatenate(xs), np.concatenate(ys), np.concatenate(ws))
    Dd = wf.splat_all(x[kind == 1], y[kind == 1], np.ones((kind == 1).sum(), np.float32))
    Ds = wf.gblur(D, 2.1)
    alpha = 1 - np.exp(-Ds * 0.8)
    wf.FOAM *= 0.80
    if sim.impacts:
        a = np.array(sim.impacts, np.float32)
        wf.FOAM += wf.gblur(wf.splat_all(a[:, 0] * S, a[:, 1] * S, np.clip(a[:, 2], 0, 8) * 0.9), 5) * 6
    foam = np.clip(wf.FOAM, 0, 1)
    Db = wf.gblur(D, 5.0)
    gy, gx = np.gradient(Db)
    spec = np.clip(-(gx * -0.45 + gy * -0.89) * 2.2, 0, 1) ** 1.3
    depth = np.clip(Db * 0.35, 0, 1)
    deep = np.array([0.42, 0.72, 0.88], np.float32)
    light = np.array([0.95, 1.0, 1.0], np.float32)
    wc = deep * (1 - depth[..., None]) + light * depth[..., None] * 0.9
    wc = np.clip(wc + spec[..., None] * 0.55 + foam[..., None] * 0.55, 0, 1)
    a = np.clip(alpha * 0.92 + foam * 0.55 * alpha, 0, 1)
    # sparkles and mist, the two things the concept adds on top
    dd = wf.gblur(Dd, 1.0)
    drop = (np.clip(dd * 1.1, 0, 1) * 0.65)[..., None] * np.array([0.8, 0.95, 1.0], np.float32)
    mist = np.asarray(Image.fromarray((np.clip(Dd * 40, 0, 255)).astype(np.uint8)).resize((W // 4, H // 4), Image.BILINEAR), np.float32) / 255
    mist = wf.gblur(mist, 6.0)
    mist = np.asarray(Image.fromarray((np.clip(mist, 0, 1) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), np.float32) / 255
    add = drop + mist[..., None] * 0.9 * np.array([0.55, 0.75, 0.85], np.float32)
    # fold the glow in as alpha that never goes opaque: the digits stay readable
    lum = np.clip(add.max(axis=-1) * 0.8, 0, 0.5)
    col = add / np.maximum(add.max(axis=-1, keepdims=True), 1e-3)
    col = np.clip(col * 0.92 + 0.06, 0, 1)
    al = np.clip(a + lum * (1 - a), 0, 1)
    rgb = np.clip((wc * a[..., None] + col * lum[..., None]) / np.maximum(al[..., None], 1e-4), 0, 1)
    rgba = np.dstack([rgb * 255, al * 255]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA').resize((SW, SH), Image.LANCZOS)


def particles(n=20):
    sim = wf.Sim()
    for _ in range(wf.WARM):
        sim.step()
        wf.FOAM[:] = wf.FOAM * 0.8
    total = wf.LOOP + wf.XFADE
    raw = []
    for i in range(total):
        sim.step()
        raw.append(particle_frame(sim))
    frames = []
    for i in range(wf.LOOP):
        if i < wf.XFADE:
            a = i / wf.XFADE
            frames.append(Image.blend(raw[wf.LOOP + i], raw[i], a))
        else:
            frames.append(raw[i])
    pick = [frames[int(round(k * (len(frames) - 1) / (n - 1)))] for k in range(n)]
    for i, f in enumerate(pick):
        # keep the sources small: the spray is a soft overlay, 96 colours is plenty
        f.quantize(colors=96, method=Image.FASTOCTREE).save(f'{OUT}/fx/spray_{i:02d}.png')
    print('spray frames', len(pick))


particles(12)

# ------------------------------------------------------------------- text --
FONT = '/System/Library/Fonts/SFNS.ttf'


def txt(s, size=12, color=(210, 232, 240), var='Semibold', pad=1):
    f = ImageFont.truetype(FONT, size * S)
    f.set_variation_by_name(var)
    tmp = ImageDraw.Draw(Image.new('RGB', (8, 8)))
    box = tmp.textbbox((0, 0), s, font=f)
    w = (box[2] - box[0]) + pad * 2 * S
    h = (box[3] - box[1]) + pad * 2 * S
    im = Image.new('RGBA', (int(w), int(h)), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((pad * S - box[0], pad * S - box[1]), s, font=f, fill=color + (255,))
    return im.resize((max(1, im.width // S), max(1, im.height // S)), Image.LANCZOS)


DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
for i, d in enumerate(DAYS):
    txt(d).save(f'{OUT}/ui/day_{i}.png')
for i, m in enumerate(MONTHS):
    txt(m).save(f'{OUT}/ui/month_{i}.png')
for i in range(10):
    txt(str(i)).save(f'{OUT}/ui/num_{i}.png')
txt('·', 12, (170, 200, 212)).save(f'{OUT}/ui/dot.png')
txt('BPM', 9, (170, 200, 212)).save(f'{OUT}/ui/bpm.png')
txt('STEPS', 9, (170, 200, 212)).save(f'{OUT}/ui/steps.png')

# small glass icons: heart and footprint
def icon_heart(size=13):
    im = Image.new('RGBA', (size * S, size * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = (220, 240, 248, 235)
    r = size * S
    d.ellipse((r * 0.08, r * 0.12, r * 0.52, r * 0.56), fill=c)
    d.ellipse((r * 0.48, r * 0.12, r * 0.92, r * 0.56), fill=c)
    d.polygon([(r * 0.09, r * 0.42), (r * 0.91, r * 0.42), (r * 0.5, r * 0.95)], fill=c)
    return im.resize((size, size), Image.LANCZOS)


def icon_foot(size=14):
    """A little sneaker seen from the side."""
    im = Image.new('RGBA', (size * S, size * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = (220, 240, 248, 235)
    r = size * S
    d.rounded_rectangle((r * 0.10, r * 0.30, r * 0.92, r * 0.74), r * 0.18, fill=c)
    d.rounded_rectangle((r * 0.10, r * 0.60, r * 0.98, r * 0.86), r * 0.13, fill=c)
    d.rectangle((r * 0.06, r * 0.78, r * 0.98, r * 0.88), fill=c)
    return im.resize((size, size), Image.LANCZOS)


icon_heart().save(f'{OUT}/ui/heart.png')
icon_foot().save(f'{OUT}/ui/foot.png')
Image.new('RGBA', (4, 4), (0, 0, 0, 0)).save(f'{OUT}/ui/empty.png')

json.dump({'hour_cell': HOUR_CELL, 'min_cell': MIN_CELL, 'aod_cell': AOD_CELL, 'spray': 12},
          open(f'{OUT}/manifest.json', 'w'), indent=1)
print('done')
