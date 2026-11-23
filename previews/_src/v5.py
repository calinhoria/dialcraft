import lib
from lib import *
import sys
OUT = '/Volumes/Projects/Projects/dialcraft/previews/'
TOP = 132; CX, CY = 195, 291; R = 160                     # the drawing area under the clock
CORNER = 86
def on_screen(x, y):
    dx = min(x, W - x); dy = min(y, H - y)
    return not (dx < CORNER and dy < CORNER and math.hypot(CORNER - dx, CORNER - dy) > CORNER - 4)
def fin(c): c.time(); return done(c)
def ang_hue(x, y): return 360 * ((math.atan2(y - CY, x - CX) / (2 * math.pi)) % 1)
# ---- 9. sunflower ----
def sunflower(angle, hue_mode, n=960, cc=5.35):
    c = Canvas()
    for i in range(1, n):
        a = math.radians(i * angle); r = cc * math.sqrt(i); x = CX + r * math.cos(a); y = CY + r * math.sin(a)
        if y < TOP or not on_screen(x, y): continue
        hue = (i * 0.52) % 360 if hue_mode == 'turn' else 300 * (r / 170) if hue_mode == 'radius' else (math.degrees(a) % 360)
        c.circle(x, y, 1.2 + 2.9 * i / n, hsl(hue, 1.0, 0.62))
    return fin(c)
# ---- 10. halftone waves ----
def halftone(kind, step=21):
    c = Canvas()
    for j in range(int((H - TOP) / step) + 1):
        for i in range(int(W / step) + 1):
            x = i * step + step / 2 + (step / 2 if j % 2 else 0) - step / 2; y = TOP + 10 + j * step
            if y > H - 6 or not on_screen(x, y) or x > W: continue
            d = math.hypot(x - CX, y - CY)
            if kind == 'rings': s = 0.5 + 0.5 * math.sin(d / 14.0)
            elif kind == 'cross': s = 0.5 + 0.5 * math.sin((x - CX) / 19.0) * math.sin((y - CY) / 19.0)
            else: s = 0.5 + 0.25 * math.sin(math.hypot(x - 60, y - 160) / 13) + 0.25 * math.sin(math.hypot(x - 330, y - 420) / 13)
            hue = ang_hue(x, y) if kind != 'cross' else 200 + 160 * ((y - TOP) / (H - TOP))
            c.circle(x, y, 1.5 + (step / 2 - 1.5) * s, hsl(hue, 0.95, 0.6))
    return fin(c)
# ---- 11. ridgeline ----
def ridgeline(kind, seed, rows=22):
    r = random.Random(seed); c = Canvas(); ph = [r.random() * 6.28 for _ in range(4)]
    for j in range(rows):
        y0 = TOP + 24 + j * (H - TOP - 44) / (rows - 1); pts = []
        for i in range(0, W + 1, 6):
            x = i
            if kind == 'mountain': env = math.exp(-((x - CX) / 120) ** 2); amp = 36 * env * (0.6 + 0.4 * math.sin(j * 0.7 + ph[0])) + 8 * math.sin(x / 9 + j + ph[1]) * env; y = y0 - abs(amp)
            elif kind == 'interfere': y = y0 - (15 * math.sin(x / 31 + j * 0.35 + ph[0]) * math.sin(x / 17 - j * 0.21 + ph[1]) + 7 * math.sin(x / 8 + ph[2] + j * 0.5))
            else: y = y0 - (19 * math.sin(x / 40 + ph[0] + j * 0.28) + 9 * math.sin(x / 15 + ph[1] - j * 0.4) + 5 * math.sin(x / 6 + ph[2]))
            pts.append((x, y))
        col = hsl(300 * j / rows + 10, 1.0, 0.62)
        for a, b in zip(pts, pts[1:]): c.line(*a, *b, col, 1.7)
    return fin(c)
# ---- 12. tunnel of turning squares ----
def tunnel(delta, n=44, step=2.55, size0=6.0):
    c = Canvas()
    for k in range(n):
        s = size0 + step * k; a = math.radians(k * delta)
        pts = [(CX + s * math.cos(a + math.pi / 4 + q * math.pi / 2) * 1.414, CY + s * math.sin(a + math.pi / 4 + q * math.pi / 2) * 1.414) for q in range(4)]
        col = hsl(360 * k / n * 1.5, 1.0, 0.6)
        for q in range(4): c.line(*pts[q], *pts[(q + 1) % 4], col, 1.5)
    return fin(c)
# ---- 13. sunburst ----
def sunburst(seed, rays=200):
    r = random.Random(seed); c = Canvas(); ph = [r.random() * 6.28 for _ in range(3)]
    for i in range(rays):
        a = 2 * math.pi * i / rays; L = 40 + 120 * (0.5 + 0.5 * math.sin(7 * a + ph[0])) * (0.55 + 0.45 * math.sin(13 * a + ph[1])) + 26 * r.random()
        x1, y1 = CX + 24 * math.cos(a), CY + 24 * math.sin(a); x2, y2 = CX + L * math.cos(a), CY + L * math.sin(a)
        col = hsl(360 * i / rays, 1.0, 0.62); c.line(x1, y1, x2, y2, col, 2.0); c.circle(x2, y2, 3.0, col)
    return fin(c)
# ---- 14. curve stitching ----
def stitch(kind, n=46):
    c = Canvas()
    def q(ax, ay, bx, by, cx_, cy_, hue0, span=90):
        for i in range(n + 1):
            t = i / n; c.line(cx_ + (ax - cx_) * t, cy_ + (ay - cy_) * t, cx_ + (bx - cx_) * (1 - t), cy_ + (by - cy_) * (1 - t), hsl(hue0 + span * t), 1.2)
    if kind == 'astroid':
        L = 168
        for k, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))): q(CX + sx * L, CY, CX, CY + sy * L, CX, CY, k * 90 + 20)
    elif kind == 'corners':
        L = 215
        for k, (cx_, cy_, sx, sy) in enumerate(((0, TOP, 1, 1), (W, TOP, -1, 1), (0, H, 1, -1), (W, H, -1, -1))): q(cx_ + sx * L, cy_, cx_, cy_ + sy * L, cx_, cy_, k * 90)
    else:
        for k in range(6):
            a = math.radians(60 * k); b = math.radians(60 * (k + 1)); RR = 172
            q(CX + RR * math.cos(a), CY + RR * math.sin(a), CX + RR * math.cos(b), CY + RR * math.sin(b), CX, CY, 60 * k)
    return fin(c)
# ---- 15. constellation ----
def constellation(seed, link=48, hue_mode='angle', n=170):
    r = random.Random(seed); pts = []
    for _ in range(6000):
        x = r.uniform(4, W - 4); y = r.uniform(TOP + 4, H - 4)
        if on_screen(x, y) and all(math.hypot(x - p[0], y - p[1]) > 22 for p in pts): pts.append((x, y))
        if len(pts) >= n: break
    c = Canvas()
    for i, p in enumerate(pts):
        for j in range(i + 1, len(pts)):
            q = pts[j]
            if math.hypot(p[0] - q[0], p[1] - q[1]) < link: mx = (p[0] + q[0]) / 2; my = (p[1] + q[1]) / 2; c.line(*p, *q, hsl(ang_hue(mx, my) if hue_mode == 'angle' else 200 + 140 * (my - TOP) / (H - TOP), 0.9, 0.6), 1.3)
    for p in pts: c.circle(*p, 2.8, (255, 255, 255))
    return fin(c)
# ---- 16. Mondrian ----
def mondrian(seed, palette, min_size=44):
    r = random.Random(seed); rects = []
    def split(x, y, w, h, d):
        if (w < 2 * min_size and h < 2 * min_size) or (d > 1 and r.random() < 0.22): rects.append((x, y, w, h, d)); return
        if w >= h and w >= 2 * min_size: s = r.uniform(0.3, 0.7) * w; split(x, y, s, h, d + 1); split(x + s, y, w - s, h, d + 1)
        elif h >= 2 * min_size: s = r.uniform(0.3, 0.7) * h; split(x, y, w, s, d + 1); split(x, y + s, w, h - s, d + 1)
        else: rects.append((x, y, w, h, d))
    split(0, TOP, W, H - TOP, 0); c = Canvas(); gap = 2.5
    for (x, y, w, h, d) in sorted(rects, key=lambda q: q[4]):
        if palette == 'primary': col = r.choice([(225, 30, 30), (250, 210, 20), (30, 70, 200), (245, 245, 235), (245, 245, 235), (20, 20, 20)])
        elif palette == 'rainbow': col = hsl(ang_hue(x + w / 2, y + h / 2), 0.9, 0.58)
        else: col = hsl(r.choice([170, 195, 320, 280, 45]), 1.0, r.choice([0.5, 0.6, 0.7]))
        c.rect(x + gap, y + gap, x + w - gap, y + h - gap, col)
    return fin(c)
# ---- 17. fractal grids ----
def fractal(kind):
    c = Canvas(); cells = []; N = 27; cs = 11.8; ox = (W - N * cs) / 2; oy = TOP
    if kind == 'carpet':
        def keep(i, j):
            while i or j:
                if i % 3 == 1 and j % 3 == 1: return False
                i //= 3; j //= 3
            return True
        cells = [(ox + i * cs, oy + j * cs, cs) for j in range(N) for i in range(N) if keep(i, j)]
    elif kind == 'dust':
        def keep(i, j):
            for _ in range(3):
                if i % 3 == 1 or j % 3 == 1: return False
                i //= 3; j //= 3
            return True
        cells = [(ox + i * cs, oy + j * cs, cs) for j in range(N) for i in range(N) if keep(i, j)]
    else:
        rows = 50; cs = 6.3; ox = (W - rows * cs) / 2 + 0; oy = TOP + 3
        for j in range(rows):
            for i in range(j + 1):
                if (i & (j - i)) == 0: cells.append((ox + (rows * cs) / 2 + (i - j / 2) * cs - cs / 2, oy + j * cs, cs))
    for (x, y, s) in cells: c.rect(x, y, x + s - 1, y + s - 1, hsl(ang_hue(x + s / 2, y + s / 2), 0.95, 0.6))
    return fin(c)
# ---- 18. ripples ----
def ripples(seed, drops=8):
    r = random.Random(seed); c = Canvas()
    for k in range(drops):
        x = r.uniform(34, W - 34); y = r.uniform(TOP + 50, H - 34); n = r.randint(5, 9); step = r.uniform(9, 14); hue = 360 * k / drops
        for i in range(1, n + 1):
            if y - i * step < TOP: break                                            # rings stay under the clock
            c.ring(x, y, i * step, hsl(hue + 8 * i, 1.0, 0.64 - 0.02 * i), max(1.0, 2.2 - 0.17 * i))
        c.circle(x, y, 3.5, (255, 255, 255))
    return fin(c)
SETS = {
    '9-sunflower': lambda: [sunflower(137.508, 'turn'), sunflower(137.3, 'angle'), sunflower(99.5, 'radius')],
    '10-halftone-waves': lambda: [halftone('rings'), halftone('cross'), halftone('two')],
    '11-ridgeline': lambda: [ridgeline('mountain', 1), ridgeline('interfere', 2), ridgeline('sines', 3)],
    '12-square-tunnel': lambda: [tunnel(3.0), tunnel(5.0), tunnel(8.5)],
    '13-sunburst': lambda: [sunburst(1), sunburst(2), sunburst(3)],
    '14-curve-stitching': lambda: [stitch('astroid'), stitch('corners'), stitch('star')],
    '15-constellation': lambda: [constellation(1), constellation(2, 56, 'y'), constellation(3, 44)],
    '16-mondrian': lambda: [mondrian(2, 'primary'), mondrian(5, 'rainbow'), mondrian(9, 'neon')],
    '17-fractal-grids': lambda: [fractal('carpet'), fractal('dust'), fractal('pascal')],
    '18-ripples': lambda: [ripples(1), ripples(4, 10), ripples(7, 6)],
}
if __name__ == '__main__':
    from PIL import Image
    lib.RAW = False; ims = []
    for name in SETS:
        cs = SETS[name](); sheet(cs, OUT + 'effect-%s.png' % name); ims.append(cs[1])
    s = Image.new('RGB', (234 * 5 + 40, 270 * 2 + 10), (40, 40, 44))
    for i, im in enumerate(ims): s.paste(im.resize((234, 270)), ((i % 5) * 244, (i // 5) * 280))
    s.save('overview5.png'); print('ok')
