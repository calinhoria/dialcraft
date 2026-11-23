"""Soap Bubbles: draws every picture (background, bubbles with real see-through alpha, pop frames, sparkles, pearl digits) and geometry.json.
Run: python3 art.py   (writes assets/sb/*.png, geometry.json and demo.png, a composite to judge the look before the editor)"""
import numpy as np, json, math, os, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

H = os.path.dirname(os.path.abspath(__file__))
OUT = H + '/assets/sb'; os.makedirs(OUT, exist_ok=True)
FONT = '/Volumes/Projects/Projects/dialcraft/.claude/skills/create-amazfit-watchface/examples/animated/fonts/fredoka-600.ttf'
SW, SH = 390, 450
geo = {'size': {}, 'names': {}}
def save(im, name): im.save(OUT + '/' + name + '.png', optimize=True)

# ------------------------------------------------------------------ colour helpers
def hsv2rgb(h, s, v):
    h = np.mod(h, 1.0) * 6; i = np.floor(h).astype(int) % 6; f = h - np.floor(h)
    p = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s)
    r = np.choose(i, [v, q, p, p, t, v]); g = np.choose(i, [t, v, v, q, p, p]); b = np.choose(i, [p, p, t, v, v, q])
    return np.stack([r, g, b], -1)
def smooth(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def over(base, ba, top, ta):
    """premultiplied-free 'over': base/top are rgb float arrays, ba/ta alpha arrays -> (rgb, alpha)"""
    oa = ta + ba * (1 - ta); safe = np.where(oa > 1e-6, oa, 1)
    return (top * ta[..., None] + base * (ba * (1 - ta))[..., None]) / safe[..., None], oa
def to_img(rgb, a, size):
    n = rgb.shape[0]; arr = np.zeros((n, n, 4)); arr[..., :3] = rgb * a[..., None]; arr[..., 3] = a        # premultiplied, so the edge does not get a dark halo when it is shrunk
    ims = [Image.fromarray((np.clip(arr[..., k], 0, 1) * 255).astype('uint8'), 'L').resize((size, size), Image.LANCZOS) for k in range(4)]
    p = np.stack([np.array(i).astype(float) / 255 for i in ims], -1); al = p[..., 3]; safe = np.where(al > 1e-4, al, 1)
    out = np.zeros((size, size, 4), 'uint8'); out[..., :3] = np.clip(p[..., :3] / safe[..., None], 0, 1) * 255; out[..., 3] = np.clip(al, 0, 1) * 255
    return Image.fromarray(out, 'RGBA')

# ------------------------------------------------------------------ the soap bubble: see-through, a thin-film rainbow that thickens at the rim, window reflections
def bubble(D, hue0=0.0, phase=0.0, body=0.10, rim=0.62, tint=None, ss=3):
    n = D * ss; c = (np.arange(n) + 0.5) / n * 2 - 1; x, y = np.meshgrid(c, c); r = np.hypot(x, y); th = np.arctan2(y, x)
    inside = (r <= 1.0).astype(float)
    # thin film: colour bands that run roughly horizontally (heavier at the bottom), swirled by two sine fields, wider bands near the rim
    sw = 0.16 * np.sin(3.1 * x + phase) + 0.11 * np.sin(5.3 * y - 1.7 * x + phase * 1.7)
    hue = hue0 + 0.55 * (y * 0.5 + 0.5) + sw + 0.35 * r ** 2
    film = hsv2rgb(hue, 0.62, 1.0)
    white = np.ones_like(film)
    body_rgb = film * 0.55 + white * 0.45
    if tint is not None: body_rgb = body_rgb * 0.4 + np.array(tint)[None, None, :] * 0.6
    a_body = body + 0.0 * r
    a_film = rim * smooth(0.50, 1.0, r) ** 1.7                                   # the film shows mostly towards the rim (fresnel)
    a_band = 0.20 * smooth(0.15, 0.7, r) * (0.5 + 0.5 * np.sin(9 * hue))           # faint extra colour bands inside
    rgb, a = body_rgb, a_body
    rgb, a = over(rgb, a, film, np.clip(a_film + a_band, 0, 1))
    ring = smooth(0.955, 0.985, r) * (1 - smooth(0.985, 1.0, r))                  # a thin bright edge, brighter on the lit side
    lit = 0.65 + 0.35 * np.cos(th + 2.35)
    rgb, a = over(rgb, a, np.ones_like(film) * np.array([0.93, 0.98, 1.0]), np.clip(ring * (0.55 + 0.45 * lit), 0, 1))
    # reflections: a curved window highlight upper left, a small round glint, a cooler crescent lower right
    ang = (th + math.pi) % (2 * math.pi)                                           # 0 = left, grows clockwise on screen (y down)
    c1 = math.radians(220); da = np.abs(((ang - c1 + math.pi) % (2 * math.pi)) - math.pi)
    span = math.radians(50); taper = np.clip(1 - (da / span) ** 2, 0, 1)
    rc = 0.80; wid = 0.075 * taper
    cres = smooth(rc - wid - 0.015, rc - wid + 0.01, r) * (1 - smooth(rc + wid - 0.01, rc + wid + 0.015, r)) * (da < span)
    rgb, a = over(rgb, a, np.ones_like(film), np.clip(cres * 0.92, 0, 1))
    for (gx, gy, gr, ga) in ((-0.40, -0.52, 0.075, 0.95), (-0.27, -0.64, 0.036, 0.9)):
        g = 1 - smooth(gr * 0.6, gr, np.hypot(x - gx, y - gy)); rgb, a = over(rgb, a, np.ones_like(film), np.clip(g * ga, 0, 1))
    c2 = math.radians(40); da2 = np.abs(((ang - c2 + math.pi) % (2 * math.pi)) - math.pi); span2 = math.radians(34); t2 = np.clip(1 - (da2 / span2) ** 2, 0, 1)
    w2 = 0.045 * t2; cres2 = smooth(0.83 - w2 - 0.015, 0.83 - w2 + 0.01, r) * (1 - smooth(0.83 + w2 - 0.01, 0.83 + w2 + 0.015, r)) * (da2 < span2)
    rgb, a = over(rgb, a, np.ones_like(film) * np.array([0.7, 0.95, 1.0]), np.clip(cres2 * 0.55, 0, 1))
    a = a * inside
    return to_img(rgb, a, D)

# ------------------------------------------------------------------ pop frames: a burst ring of rainbow arcs and droplets, 4 frames
def pop_frames(S):
    ss = 4; frames = []; rnd = random.Random(7)
    base = [(rnd.uniform(0, 2 * math.pi), rnd.uniform(0.75, 1.0), rnd.uniform(0.7, 1.3)) for _ in range(16)]
    cols = [(255, 180, 230), (170, 235, 255), (255, 245, 170), (200, 180, 255), (255, 255, 255)]
    for f, (R, aw, dr, drops_a) in enumerate(((0.52, 0.85, 0.075, 1.0), (0.72, 0.75, 0.06, 1.0), (0.88, 0.55, 0.04, 0.85), (0.98, 0.30, 0.025, 0.55))):
        im = Image.new('RGBA', (S * ss, S * ss), (0, 0, 0, 0)); d = ImageDraw.Draw(im); c = S * ss / 2
        # broken ring: 14 arcs, each its own pastel colour
        k = 14
        for i in range(k):
            a0 = i * 360 / k + 6 * f; col = cols[i % 4]
            d.arc([c - R * c, c - R * c, c + R * c, c + R * c], a0, a0 + 360 / k * 0.62, fill=col + (int(255 * aw),), width=max(2, int(S * ss * 0.018 * (1.2 - 0.25 * f))))
        # droplets flying out
        for (ang, rr, sz) in base:
            rd = R * (0.78 + 0.5 * rr * (0.6 + 0.12 * f)) * c; x = c + rd * math.cos(ang); y = c + rd * math.sin(ang); r = dr * c * sz
            d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, int(255 * drops_a)))
            d.ellipse([x - r * 0.45 - r * 0.2, y - r * 0.45 - r * 0.25, x + r * 0.2, y + r * 0.1], fill=(255, 255, 255, 255)) if False else None
        frames.append(im.resize((S, S), Image.LANCZOS))
    return frames

# ------------------------------------------------------------------ sparkle (4-point star) in 3 sizes
def sparkle(S, k):
    ss = 6; im = Image.new('RGBA', (S * ss, S * ss), (0, 0, 0, 0)); d = ImageDraw.Draw(im); c = S * ss / 2; L = c * k; w = c * 0.16 * k
    pts = [(c, c - L), (c + w, c - w), (c + L, c), (c + w, c + w), (c, c + L), (c - w, c + w), (c - L, c), (c - w, c - w)]
    d.polygon(pts, fill=(255, 255, 255, 255))
    g = Image.new('RGBA', im.size, (0, 0, 0, 0)); gd = ImageDraw.Draw(g); gd.ellipse([c - w * 1.4, c - w * 1.4, c + w * 1.4, c + w * 1.4], fill=(255, 235, 250, 150))
    return Image.alpha_composite(g.filter(ImageFilter.GaussianBlur(w * 0.8)), im).resize((S, S), Image.LANCZOS)

# ------------------------------------------------------------------ pearl text: rounded font filled with a pearly gradient, violet edge and soft shadow
def pearl(text, em, w=None, h=None, edge=3, ss=3, size_ref=None):
    f = ImageFont.truetype(FONT, em * ss)
    bb = f.getbbox(text); tw, th_ = bb[2] - bb[0], bb[3] - bb[1]
    W_ = (w or (tw // ss + 2 * (edge + 4))) * ss; H_ = (h or (th_ // ss + 2 * (edge + 4))) * ss
    m = Image.new('L', (W_, H_), 0); d = ImageDraw.Draw(m); d.text(((W_ - tw) / 2 - bb[0], (H_ - th_) / 2 - bb[1]), text, font=f, fill=255)
    return finish_text(m, W_, H_, edge, ss)
def finish_text(m, W_, H_, edge, ss):
    mk = np.array(m).astype(float) / 255
    grow = m.filter(ImageFilter.MaxFilter(edge * ss * 2 // 2 * 2 + 1)); gm = np.array(grow).astype(float) / 255
    yy = np.linspace(0, 1, H_)[:, None] * np.ones((1, W_)); xx = np.ones((H_, 1)) * np.linspace(0, 1, W_)[None, :]
    top = np.array([1.0, 1.0, 1.0]); mid = np.array([1.0, 0.88, 0.97]); bot = np.array([0.78, 0.90, 1.0])
    t = yy[..., None]; fill = np.where(t < 0.5, top + (mid - top) * (t / 0.5), mid + (bot - mid) * ((t - 0.5) / 0.5))
    iri = hsv2rgb(0.55 + 0.35 * yy + 0.2 * xx, 0.35, 1.0); fill = fill * 0.8 + iri * 0.2
    # an inner rim light: lighter along the top-left edge, a touch darker along the bottom-right
    gx = np.array(m.filter(ImageFilter.GaussianBlur(1.6 * ss))).astype(float) / 255
    shade = np.clip((mk - gx) * 2.2, -0.5, 0.5); fill = np.clip(fill + shade[..., None] * np.array([0.0, 0.0, 0.0]) , 0, 1)
    edge_a = np.clip(gm - mk, 0, 1)
    edge_rgb = np.ones((H_, W_, 3)) * np.array([0.38, 0.16, 0.62])
    sh = np.array(grow.filter(ImageFilter.GaussianBlur(2.2 * ss))).astype(float) / 255
    shadow = np.roll(sh, int(2.2 * ss), axis=0) * 0.55
    rgb = np.ones((H_, W_, 3)) * np.array([0.16, 0.06, 0.32]); a = shadow
    rgb, a = over(rgb, a, edge_rgb, edge_a * 0.92)
    rgb, a = over(rgb, a, fill, mk)
    hl = np.clip((np.array(m.filter(ImageFilter.GaussianBlur(0.8 * ss))).astype(float) / 255) - np.roll(np.roll(np.array(m.filter(ImageFilter.GaussianBlur(0.8 * ss))).astype(float) / 255, 2 * ss, 0), 2 * ss, 1), 0, 1)
    rgb, a = over(rgb, a, np.ones((H_, W_, 3)), np.clip(hl * 0.8, 0, 1) * mk)
    n_w, n_h = W_ // ss, H_ // ss
    arr = np.zeros((H_, W_, 4)); arr[..., :3] = rgb * a[..., None]; arr[..., 3] = a
    chans = [Image.fromarray((np.clip(arr[..., k], 0, 1) * 255).astype('uint8'), 'L').resize((n_w, n_h), Image.LANCZOS) for k in range(4)]
    p = np.stack([np.array(i).astype(float) / 255 for i in chans], -1); al = p[..., 3]; safe = np.where(al > 1e-4, al, 1)
    out = np.zeros((n_h, n_w, 4), 'uint8'); out[..., :3] = np.clip(p[..., :3] / safe[..., None], 0, 1) * 255; out[..., 3] = np.clip(al, 0, 1) * 255
    return Image.fromarray(out, 'RGBA')

def glyph_set(chars, em, cell_w, cell_h, baseline_ref='0'):
    """pictures of equal size, the ink sitting on one baseline"""
    f = ImageFont.truetype(FONT, em * 3); refb = f.getbbox(baseline_ref)
    res = []
    for ch in chars:
        bb = f.getbbox(ch); tw = bb[2] - bb[0]
        W_ = cell_w * 3; H_ = cell_h * 3; m = Image.new('L', (W_, H_), 0); d = ImageDraw.Draw(m)
        d.text(((W_ - tw) / 2 - bb[0], (H_ - (refb[3] - refb[1])) / 2 - refb[1]), ch, font=f, fill=255)
        res.append(finish_text(m, W_, H_, 3 if em > 60 else 2, 3))
    return res

# ------------------------------------------------------------------ the background: dusk gradient, soft bokeh, stars, and one giant bubble holding the time
def background():
    rng = np.random.RandomState(4)
    yy = np.linspace(0, 1, SH)[:, None]; xx = np.linspace(0, 1, SW)[None, :]
    stops = [(0.0, (30, 20, 92)), (0.42, (92, 52, 178)), (0.74, (196, 96, 196)), (1.0, (255, 150, 176))]
    img = np.zeros((SH, SW, 3))
    for k in range(3):
        for (y0, c0), (y1, c1) in zip(stops, stops[1:]):
            m = (yy >= y0) & (yy <= y1); t = (yy - y0) / (y1 - y0); img[..., k] = np.where(m, c0[k] + (c1[k] - c0[k]) * t, img[..., k])
    img = img / 255.0
    # a warm glow behind the clock and two cool ones at the sides
    def glow(cx, cy, rx, ry, col, k):
        g = np.exp(-(((np.arange(SW)[None, :] - cx) / rx) ** 2 + ((np.arange(SH)[:, None] - cy) / ry) ** 2)); return g[..., None] * np.array(col)[None, None, :] * k
    img = img + glow(195, 215, 170, 130, (1.0, 0.55, 0.85), 0.22) + glow(40, 330, 110, 110, (0.3, 0.6, 1.0), 0.18) + glow(350, 120, 120, 100, (0.5, 0.9, 1.0), 0.14)
    base = Image.fromarray((np.clip(img, 0, 1) * 255).astype('uint8'), 'RGB').convert('RGBA')
    # bokeh: big soft discs
    bk = Image.new('RGBA', (SW, SH), (0, 0, 0, 0)); d = ImageDraw.Draw(bk)
    for _ in range(26):
        r = rng.uniform(14, 46); x = rng.uniform(-10, SW + 10); y = rng.uniform(-10, SH + 10)
        col = [(255, 200, 235), (190, 225, 255), (255, 240, 190), (215, 195, 255)][rng.randint(4)]
        d.ellipse([x - r, y - r, x + r, y + r], fill=col + (int(rng.uniform(14, 34)),)); d.ellipse([x - r, y - r, x + r, y + r], outline=col + (int(rng.uniform(30, 60)),), width=2)
    base = Image.alpha_composite(base, bk.filter(ImageFilter.GaussianBlur(1.2)))
    # stars
    st = Image.new('RGBA', (SW, SH), (0, 0, 0, 0)); sd = ImageDraw.Draw(st)
    for _ in range(46):
        x = rng.uniform(4, SW - 4); y = rng.uniform(4, SH - 4); r = rng.choice([1.2, 1.6, 2.2, 3.2]); a = int(rng.uniform(120, 240))
        if r > 2: sd.polygon([(x, y - r * 2.2), (x + r * 0.45, y - r * 0.45), (x + r * 2.2, y), (x + r * 0.45, y + r * 0.45), (x, y + r * 2.2), (x - r * 0.45, y + r * 0.45), (x - r * 2.2, y), (x - r * 0.45, y - r * 0.45)], fill=(255, 255, 255, a))
        else: sd.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, a))
    base = Image.alpha_composite(base, st)
    # the giant bubble around the time (the see-through one: only its rim and reflections show)
    hero = bubble(346, hue0=0.02, phase=0.6, body=0.035, rim=0.5)
    base.alpha_composite(hero, (195 - 173, 222 - 173))
    return base.convert('RGB')

# ------------------------------------------------------------------ build the pictures
bg = background(); save(bg, 'bg')
BUB = {  # key: (diameter, hue0, phase, body alpha)
    'xl': (150, 0.00, 0.3, 0.09), 'l1': (108, 0.30, 1.1, 0.10), 'l2': (108, 0.62, 2.0, 0.10), 'm1': (78, 0.10, 2.6, 0.11), 'm2': (78, 0.78, 0.7, 0.11),
    's1': (56, 0.45, 1.6, 0.12), 's2': (56, 0.92, 3.0, 0.12), 'x1': (38, 0.20, 0.2, 0.13)}
for k, (D, h0, ph, bd) in BUB.items():
    save(bubble(D, h0, ph, bd), 'b_' + k); geo['size']['b_' + k] = [D, D]
# the three stat badges: bigger, a touch more tinted so the numbers read
BAD = 110
for k, (h0, tint) in {'bat': (0.30, (0.78, 1.0, 0.86)), 'step': (0.05, (1.0, 0.82, 0.90)), 'temp': (0.55, (0.80, 0.90, 1.0))}.items():
    save(bubble(BAD, h0, 1.3 + h0 * 3, 0.20, 0.66, tint), 'badge_' + k); geo['size']['badge_' + k] = [BAD, BAD]
# pop frames in two sizes, plus a blank of each size
for key, S in (('pa', 160), ('pb', 96)):
    fr = pop_frames(S); names = []
    Image.new('RGBA', (S, S), (0, 0, 0, 0)).save(OUT + '/%s_0.png' % key); names.append('sb/%s_0.png' % key)
    for i, im in enumerate(fr): save(im, '%s_%d' % (key, i + 1)); names.append('sb/%s_%d.png' % (key, i + 1))
    geo['names'][key] = names; geo['size'][key] = [S, S]
# sparkles: blank + 3 sizes on a 26 px cell
SP = 26; Image.new('RGBA', (SP, SP), (0, 0, 0, 0)).save(OUT + '/sp_0.png')
for i, k in enumerate((0.45, 0.75, 1.0)): save(sparkle(SP, k), 'sp_%d' % (i + 1))
geo['names']['sp'] = ['sb/sp_%d.png' % i for i in range(4)]; geo['size']['sp'] = [SP, SP]
# the clock digits (big), the colon, an always-on set
CW, CH = 80, 128
dig = glyph_set('0123456789', 150, CW, CH)
for i, im in enumerate(dig): save(im, 'c%d' % i)
geo['names']['c'] = ['sb/c%d.png' % i for i in range(10)]; geo['size']['c'] = [CW, CH]
# the colon: two pearl dots
def dots_img(w, h, em=150):
    f = ImageFont.truetype(FONT, em * 3); m = Image.new('L', (w * 3, h * 3), 0); d = ImageDraw.Draw(m); r = w * 3 * 0.30; cx = w * 3 / 2
    for cy in (h * 3 * 0.355, h * 3 * 0.645): d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    return finish_text(m, w * 3, h * 3, 3, 3)
COLW = 34; save(dots_img(COLW, CH), 'colon'); geo['size']['colon'] = [COLW, CH]
# always-on digits: thin light outlines on black (no fills): same cells
def outline_set():
    f = ImageFont.truetype(FONT, 150 * 3); refb = f.getbbox('0'); res = []
    for ch in '0123456789':
        bb = f.getbbox(ch); tw = bb[2] - bb[0]; W_, H_ = CW * 3, CH * 3
        m = Image.new('L', (W_, H_), 0); d = ImageDraw.Draw(m); d.text(((W_ - tw) / 2 - bb[0], (H_ - (refb[3] - refb[1])) / 2 - refb[1]), ch, font=f, fill=255)
        ring = ImageChops.subtract(m.filter(ImageFilter.MaxFilter(7)), m.filter(ImageFilter.MinFilter(1)))
        a = ring.resize((CW, CH), Image.LANCZOS); im = Image.new('RGBA', (CW, CH), (200, 190, 230, 0)); im.putalpha(a.point(lambda v: int(v * 0.75))); res.append(im)
    return res
for i, im in enumerate(outline_set()): save(im, 'a%d' % i)
geo['names']['a'] = ['sb/a%d.png' % i for i in range(10)]
dc = Image.new('RGBA', (COLW, CH), (0, 0, 0, 0)); dd = ImageDraw.Draw(dc)
for cy in (CH * 0.355, CH * 0.645): dd.ellipse([COLW / 2 - 7, cy - 7, COLW / 2 + 7, cy + 7], outline=(200, 190, 230, 190), width=2)
save(dc, 'colon_a')
# the date row: weekday words and day digits
DW, DH = 96, 44
wk = glyph_set(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], 40, DW, DH, 'H')
for i, im in enumerate(wk): save(im, 'w%d' % i)
geo['names']['w'] = ['sb/w%d.png' % i for i in range(7)]; geo['size']['w'] = [DW, DH]
DDW = 25
dd_ = glyph_set('0123456789', 40, DDW, DH, '0')
for i, im in enumerate(dd_): save(im, 'd%d' % i)
geo['names']['d'] = ['sb/d%d.png' % i for i in range(10)]; geo['size']['d'] = [DDW, DH]
# the stat digits (inside the badges) with a degree sign and a minus
TW, TH_ = 21, 36
td = glyph_set('0123456789', 35, TW, TH_, '0')
for i, im in enumerate(td): save(im, 't%d' % i)
geo['names']['t'] = ['sb/t%d.png' % i for i in range(10)]; geo['size']['t'] = [TW, TH_]
save(glyph_set(['°'], 35, 16, TH_, '0')[0], 'tdeg'); geo['size']['tdeg'] = [16, TH_]
save(glyph_set(['-'], 35, 16, TH_, '0')[0], 'tminus'); geo['size']['tminus'] = [16, TH_]
# small pearl icons for the badges: battery, footprint, thermometer (drawn white-pearl with the same edge)
def icon_mask(kind, w=30, h=30, ss=3):
    m = Image.new('L', (w * ss, h * ss), 0); d = ImageDraw.Draw(m); s = ss
    if kind == 'bat':
        d.rounded_rectangle([3 * s, 7 * s, 24 * s, 23 * s], radius=3 * s, fill=255); d.rounded_rectangle([5.5 * s, 9.5 * s, 21.5 * s, 20.5 * s], radius=1.5 * s, fill=0)
        d.rectangle([24 * s, 12 * s, 27 * s, 18 * s], fill=255)
        for i in range(3): d.rectangle([(7 + i * 5) * s, 11 * s, (10.5 + i * 5) * s, 19 * s], fill=255)
    elif kind == 'step':
        d.ellipse([9 * s, 12 * s, 21 * s, 24 * s], fill=255); d.ellipse([10 * s, 21 * s, 20 * s, 29 * s], fill=255)
        for (x, y, r) in ((8, 8.5, 2.2), (12, 5.5, 2.2), (17, 5.5, 2.2), (21.5, 8.5, 2.2)): d.ellipse([(x - r) * s, (y - r) * s, (x + r) * s, (y + r) * s], fill=255)
    else:
        d.rounded_rectangle([12 * s, 2 * s, 18 * s, 20 * s], radius=3 * s, fill=255); d.ellipse([8 * s, 17 * s, 22 * s, 29 * s], fill=255)
        d.rounded_rectangle([14 * s, 6 * s, 16 * s, 22 * s], radius=1 * s, fill=0)
    return m
for k in ('bat', 'step', 'temp'):
    im = finish_text(icon_mask(k), 90, 90, 2, 3); save(im, 'ic_' + k); geo['size']['ic_' + k] = list(im.size)
# ------------------------------------------------------------------ the sprites' start table (the same numbers drive the code: the face starts exactly as the preview shows it)
rnd = random.Random(11)
order = ['xl', 'l1', 'l2', 'm1', 'm2', 'm1', 's1', 's2', 's1', 'x1', 'x1', 's2', 'm2']
start = [(250, 150), (60, 300), (318, 262), (112, 128), (286, 70), (52, 92), (350, 190), (150, 380), (210, 330), (90, 205), (336, 330), (318, 50), (160, 60)]
sprites = []
for i, (k, (cx, cy)) in enumerate(zip(order, start)):
    D = BUB[k][0]
    sprites.append({'key': k, 'D': D, 'cx': cx, 'cy': cy, 'v': round(rnd.uniform(28, 46) * (1.3 - D / 220), 1), 'amp': round(rnd.uniform(8, 20), 1), 'w': round(rnd.uniform(0.5, 1.1), 2), 'ph': round(rnd.uniform(0, 6.28), 2)})
geo['sprites'] = sprites
spark = [(40, 215), (350, 255), (95, 55), (300, 120), (60, 410), (330, 410)]
geo['sparks'] = spark
# the clock and the date row position
total = 4 * CW + COLW
cx0 = round((SW - total) / 2); cy0 = 150
geo['pos'] = {'hour': [cx0, cy0], 'colon': [cx0 + 2 * CW, cy0], 'minute': [cx0 + 2 * CW + COLW, cy0]}
rowW = DW + 10 + 2 * DDW; rx0 = round((SW - rowW) / 2)
geo['pos'].update({'week': [rx0, 82], 'day': [rx0 + DW + 10, 82]})
bx = [78, 195, 312]; by = [384, 392, 384]
geo['badges'] = [{'k': k, 'x': bx[i] - BAD // 2, 'y': by[i] - BAD // 2} for i, k in enumerate(('bat', 'step', 'temp'))]
json.dump(geo, open(H + '/geometry.json', 'w'), indent=1)

# ------------------------------------------------------------------ demo composite (what it should look like) -> demo.png
def demo():
    im = bg.convert('RGBA')
    for s in sprites:
        p = Image.open(OUT + '/b_%s.png' % s['key']); im.alpha_composite(p, (round(s['cx'] - s['D'] / 2), round(s['cy'] - s['D'] / 2)))
    for i, ch in enumerate('1009'):
        x = geo['pos']['hour'][0] + (i * CW if i < 2 else 2 * CW + COLW + (i - 2) * CW); im.alpha_composite(Image.open(OUT + '/c%s.png' % ch), (x, cy0))
    im.alpha_composite(Image.open(OUT + '/colon.png'), tuple(geo['pos']['colon']))
    im.alpha_composite(Image.open(OUT + '/w6.png'), tuple(geo['pos']['week']));
    for i, ch in enumerate('23'): im.alpha_composite(Image.open(OUT + '/d%s.png' % ch), (geo['pos']['day'][0] + i * DDW, 82))
    for b, val in zip(geo['badges'], ('75', '8670', '22')):
        im.alpha_composite(Image.open(OUT + '/badge_%s.png' % b['k']), (b['x'], b['y']))
        ic = Image.open(OUT + '/ic_%s.png' % b['k']); im.alpha_composite(ic, (b['x'] + (BAD - ic.size[0]) // 2, b['y'] + 18))
        for j, ch in enumerate(val): im.alpha_composite(Image.open(OUT + '/t%s.png' % ch), (b['x'] + round(BAD / 2 - len(val) * TW / 2) + j * TW, b['y'] + 58))
    im.convert('RGB').save(H + '/demo.png')
demo(); print('ok', len(sprites), 'sprites')
