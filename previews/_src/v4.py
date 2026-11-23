from lib3 import *
import sys
OUT = '/Volumes/Projects/Projects/dialcraft/previews/'
CORNER = 86
def on_screen(x, y):
    dx = min(x, W - x); dy = min(y, H - y)
    return not (dx < CORNER and dy < CORNER and math.hypot(CORNER - dx, CORNER - dy) > CORNER - 4)
def finish(c): c.dissolve(7); c.time(); return c
# ---- 9. sunflower: dots on the golden angle, outward from the clock ----
def sunflower(angle, hue_mode, n=980, cc=7.2):
    c = Canvas()
    for i in range(1, n):
        a = math.radians(i * angle); r = cc * math.sqrt(i); x = CX + r * math.cos(a); y = CY + r * math.sin(a)
        if not (-6 < x < W + 6 and -6 < y < H + 6) or not on_screen(x, y): continue
        hue = (i * 0.52) % 360 if hue_mode == 'turn' else 300 * (r / 240) if hue_mode == 'radius' else (math.degrees(a) % 360)
        c.circle(x, y, 1.4 + 3.4 * i / n, hsl(hue, 1.0, 0.62))
    return finish(c)
# ---- 10. halftone waves: a grid of dots whose size follows a wave ----
def halftone(kind, step=21):
    c = Canvas(); pts = []
    for j in range(int(H / step) + 1):
        for i in range(int(W / step) + 1):
            x = i * step + step * 0.5 + (step * 0.5 if j % 2 else 0) - step * 0.5; y = j * step + step * 0.5
            if not on_screen(x, y) or x > W: continue
            d = math.hypot(x - CX, y - CY)
            if kind == 'rings': s = 0.5 + 0.5 * math.sin(d / 14.0)
            elif kind == 'cross': s = 0.5 + 0.5 * math.sin((x - CX) / 19.0) * math.sin((y - CY) / 19.0)
            else: s = 0.5 + 0.25 * math.sin(math.hypot(x - 60, y - 90) / 13) + 0.25 * math.sin(math.hypot(x - 330, y - 380) / 13)
            hue = 360 * ((math.atan2(y - CY, x - CX) / (2 * math.pi)) % 1) if kind != 'cross' else 200 + 160 * (y / H)
            pts.append((d, x, y, 1.5 + (step / 2 - 1.5) * s, hue))
    for (d, x, y, r, hue) in sorted(pts): c.circle(x, y, r, hsl(hue, 0.95, 0.6))
    return finish(c)
# ---- 11. ridgeline: stacked wavy lines ----
def ridgeline(kind, seed, rows=30):
    r = random.Random(seed); c = Canvas(); ph = [r.random() * 6.28 for _ in range(4)]
    for j in range(rows):
        y0 = 34 + j * (H - 68) / (rows - 1); pts = []
        for i in range(0, W + 1, 6):
            x = i
            if kind == 'mountain': env = math.exp(-((x - CX) / 120) ** 2); amp = 46 * env * (0.6 + 0.4 * math.sin(j * 0.7 + ph[0])) + 10 * math.sin(x / 9 + j + ph[1]) * env
            elif kind == 'interfere': amp = 20 * math.sin(x / 31 + j * 0.35 + ph[0]) * math.sin(x / 17 - j * 0.21 + ph[1]) + 14 * math.sin(x / 8 + ph[2] + j * 0.5) * 0.5
            else: amp = 26 * math.sin(x / 40 + ph[0] + j * 0.28) + 12 * math.sin(x / 15 + ph[1] - j * 0.4) + 7 * math.sin(x / 6 + ph[2])
            pts.append((x, y0 - abs(amp) if kind == 'mountain' else y0 - amp))
        col = hsl(300 * j / rows + 10, 1.0, 0.62)
        for a, b in zip(pts, pts[1:]): c.line(*a, *b, col, 1.7)
    return finish(c)
# ---- 12. a tunnel of turning squares ----
def tunnel(delta, n=60, step=5.8, size0=8.0, sat=1.0):
    c = Canvas()
    for k in range(n):
        s = size0 + step * k; a = math.radians(k * delta)
        pts = [(CX + s * math.cos(a + math.pi / 4 + q * math.pi / 2) * 1.414, CY + s * math.sin(a + math.pi / 4 + q * math.pi / 2) * 1.414) for q in range(4)]
        col = hsl(360 * k / n * 1.5, sat, 0.6)
        for q in range(4): c.line(*pts[q], *pts[(q + 1) % 4], col, 1.5)
    return finish(c)
# ---- 13. sunburst: rays start at the edge of the screen and run inward, each a different length ----
def sunburst(seed, rays=210, dots=True):
    r = random.Random(seed); c = Canvas(); ph = [r.random() * 6.28 for _ in range(3)]
    for i in range(rays):
        a = 2 * math.pi * i / rays; ca, sa = math.cos(a), math.sin(a)
        t = 1.0 / max(abs(ca) / 195, abs(sa) / 225)                         # where this direction leaves the screen
        x1, y1 = CX + ca * t, CY + sa * t
        L = t * (0.2 + 0.6 * (0.5 + 0.5 * math.sin(6 * a + ph[0])) * (0.5 + 0.5 * math.sin(11 * a + ph[1])) + 0.18 * r.random())
        x2, y2 = x1 - ca * L, y1 - sa * L
        if not on_screen(x1, y1): continue
        col = hsl(360 * i / rays, 1.0, 0.62); c.line(x1, y1, x2, y2, col, 2.2)
        if dots: c.circle(x2, y2, 3.2, col)
    return finish(c)
# ---- 14. curve stitching: lines between two edges draw a smooth curve ----
def stitch(kind, n=46):
    c = Canvas()
    def q(ax, ay, bx, by, cx_, cy_, hue0, span=90):          # lines from the point i/n along the first edge to the point 1 - i/n along the second
        for i in range(n + 1):
            t = i / n; c.line(cx_ + (ax - cx_) * t, cy_ + (ay - cy_) * t, cx_ + (bx - cx_) * (1 - t), cy_ + (by - cy_) * (1 - t), hsl(hue0 + span * t), 1.2)
    corners = ((0, 0, 1, 1), (W, 0, -1, 1), (0, H, 1, -1), (W, H, -1, -1))
    if kind == 'single':
        for k, (cx_, cy_, sx, sy) in enumerate(corners): q(cx_ + sx * 235, cy_, cx_, cy_ + sy * 235, cx_, cy_, k * 90)
    elif kind == 'double':
        for k, (cx_, cy_, sx, sy) in enumerate(corners):
            q(cx_ + sx * 330, cy_, cx_, cy_ + sy * 330, cx_, cy_, k * 90); q(cx_ + sx * 190, cy_, cx_, cy_ + sy * 190, cx_, cy_, k * 90 + 180, 70)
    else:
        for k, (cx_, cy_, sx, sy) in enumerate(corners):
            q(cx_ + sx * 300, cy_, cx_, cy_ + sy * 120, cx_, cy_, k * 90, 120); q(cx_ + sx * 120, cy_, cx_, cy_ + sy * 300, cx_, cy_, k * 90 + 180, 120)
    return finish(c)
# ---- 15. constellation: points joined to their neighbours ----
def constellation(seed, link=48, hue_mode='angle', n=230):
    r = random.Random(seed); pts = []
    for _ in range(6000):
        x = r.uniform(4, W - 4); y = r.uniform(4, H - 4)
        if on_screen(x, y) and all(math.hypot(x - p[0], y - p[1]) > 21 for p in pts): pts.append((x, y))
        if len(pts) >= n: break
    c = Canvas(); L = []
    for i, p in enumerate(pts):
        for j in range(i + 1, len(pts)):
            d = math.hypot(p[0] - pts[j][0], p[1] - pts[j][1])
            if d < link: L.append((min(uval(*p), uval(*pts[j])), p, pts[j]))
    for (u, p, q) in sorted(L): mx = (p[0] + q[0]) / 2; my = (p[1] + q[1]) / 2; c.line(*p, *q, hsl(360 * ((math.atan2(my - CY, mx - CX) / (2 * math.pi)) % 1) if hue_mode == 'angle' else 200 + 140 * my / H, 0.9, 0.6), 1.3)
    for p in sorted(pts, key=lambda p: uval(*p)): c.circle(*p, 2.8, (255, 255, 255))
    return finish(c)
# ---- 16. Mondrian: rectangles by recursive splitting ----
def mondrian(seed, palette, min_size=46):
    r = random.Random(seed); rects = []
    def split(x, y, w, h, d):
        if (w < 2 * min_size and h < 2 * min_size) or (d > 1 and r.random() < 0.22): rects.append((x, y, w, h, d)); return
        if w >= h and w >= 2 * min_size: s = r.uniform(0.3, 0.7) * w; split(x, y, s, h, d + 1); split(x + s, y, w - s, h, d + 1)
        elif h >= 2 * min_size: s = r.uniform(0.3, 0.7) * h; split(x, y, w, s, d + 1); split(x, y + s, w, h - s, d + 1)
        else: rects.append((x, y, w, h, d))
    split(0, 0, W, H, 0); c = Canvas(); gap = 2.5
    for (x, y, w, h, d) in sorted(rects, key=lambda q: uval(q[0] + q[2] / 2, q[1] + q[3] / 2)):
        if palette == 'primary': col = r.choice([(225, 30, 30), (250, 210, 20), (30, 70, 200), (245, 245, 235), (245, 245, 235), (20, 20, 20)])
        elif palette == 'rainbow': col = hsl(360 * ((math.atan2(y + h / 2 - CY, x + w / 2 - CX) / (2 * math.pi)) % 1), 0.9, 0.58)
        else: col = hsl(r.choice([170, 195, 320, 280, 45]), 1.0, r.choice([0.5, 0.6, 0.7]))
        c.rect(x + gap, y + gap, x + w - gap, y + h - gap, col)
    return finish(c)
# ---- 17. fractal grids made of small squares ----
def fractal(kind):
    c = Canvas(); cells = []
    if kind == 'carpet':
        N = 27; cs = 14.4
        def keep(i, j):
            while i or j:
                if i % 3 == 1 and j % 3 == 1: return False
                i //= 3; j //= 3
            return True
        ox = (W - N * cs) / 2; oy = (H - N * cs) / 2 - 0
        for j in range(N):
            for i in range(N):
                if keep(i, j): cells.append((ox + i * cs, oy + j * cs, cs))
        oy = (H - N * cs) / 2
    elif kind == 'dust':
        N = 27; cs = 14.4
        def keep(i, j):
            for _ in range(3):
                if i % 3 == 1 or j % 3 == 1: return False
                i //= 3; j //= 3
            return True
        ox = (W - N * cs) / 2; oy = (H - N * cs) / 2
        for j in range(N):
            for i in range(N):
                if keep(i, j): cells.append((ox + i * cs, oy + j * cs, cs))
    else:
        rows = 62; cs = 6.2; ox = (W - rows * cs) / 2; oy = 30
        for j in range(rows):
            for i in range(j + 1):
                if (i & (j - i)) == 0: cells.append((ox + (i - j / 2) * cs + (rows * cs) / 2 - 0, oy + j * cs * 1.0, cs))
    for (x, y, s) in sorted(cells, key=lambda q: uval(q[0] + q[2] / 2, q[1] + q[2] / 2)):
        hue = 360 * ((math.atan2(y - CY, x - CX) / (2 * math.pi)) % 1); c.rect(x, y, x + s - 1, y + s - 1, hsl(hue, 0.95, 0.6))
    return finish(c)
# ---- 18. ripples: rings spreading from random drops ----
def ripples(seed, drops=8):
    r = random.Random(seed); c = Canvas()
    for k in range(drops):
        x = r.uniform(30, W - 30); y = r.uniform(30, H - 30); n = r.randint(6, 10); step = r.uniform(11, 16); hue = 360 * k / drops
        for i in range(1, n + 1):
            c.ring(x, y, i * step, hsl(hue + 8 * i, 1.0, 0.64 - 0.02 * i), max(1.0, 2.2 - 0.17 * i))
        c.circle(x, y, 3.5, (255, 255, 255))
    return finish(c)
SETS = {
    '9-sunflower': lambda: [sunflower(137.508, 'turn'), sunflower(137.3, 'angle'), sunflower(99.5, 'radius')],
    '10-halftone-waves': lambda: [halftone('rings'), halftone('cross'), halftone('two')],
    '11-ridgeline': lambda: [ridgeline('mountain', 1), ridgeline('interfere', 2), ridgeline('sines', 3)],
    '12-square-tunnel': lambda: [tunnel(3.0), tunnel(5.0), tunnel(8.5)],
    '13-sunburst': lambda: [sunburst(1), sunburst(2), sunburst(3)],
    '14-curve-stitching': lambda: [stitch('single'), stitch('double'), stitch('cross')],
    '15-constellation': lambda: [constellation(1), constellation(2, 56, 'y'), constellation(3, 44)],
    '16-mondrian': lambda: [mondrian(2, 'primary'), mondrian(5, 'rainbow'), mondrian(9, 'neon')],
    '17-fractal-grids': lambda: [fractal('carpet'), fractal('dust'), fractal('pascal')],
    '18-ripples': lambda: [ripples(1), ripples(4, 10), ripples(7, 6)],
}
if __name__ == '__main__':
    from PIL import Image
    only = sys.argv[1:] or list(SETS); ims = []
    for name in only:
        cs = SETS[name](); sheet(cs, OUT + 'effect-%s.png' % name); print(name, [len(c.ops) - (c.mark or 0) for c in cs], 'pattern ops +', [c.mark for c in cs]); ims.append(cs[1].out().resize((234, 270)))
    s = Image.new('RGB', (234 * 5 + 40, 270 * 2 + 10), (40, 40, 44))
    for i, im in enumerate(ims): s.paste(im, ((i % 5) * 244, (i // 5) * 280))
    s.save('overview4.png')
