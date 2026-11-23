from lib import *
import os
OUT = '/Volumes/Projects/Projects/dialcraft/previews/'
CX, CY = 195, 285
# ---- 2. Maurer rose ----
def maurer(n, d, R=148, width=1.0, hue0=0):
    c = Canvas(); pts = []
    for k in range(361):
        th = math.radians(k * d); r = R * math.sin(n * th); pts.append((CX + r * math.cos(th), CY + r * math.sin(th)))
    for k in range(360): c.line(*pts[k], *pts[k + 1], hsl(hue0 + 300 * k / 360), width)
    for k in range(361):                                            # the plain rose under it, as a thin white line
        th = math.radians(k); r = R * math.sin(n * th); x, y = CX + r * math.cos(th), CY + r * math.sin(th)
        if k: c.line(px, py, x, y, (255, 255, 255), 1.4)
        px, py = x, y
    c.time(); return done(c)
# ---- 4. Truchet arcs ----
def truchet(cell, seed, width, mode):
    r = random.Random(seed); c = Canvas(); TOP = 125
    ox = (W - (W // cell) * cell) // 2; cols = W // cell; rows = (H - TOP) // cell; oy = TOP + (H - TOP - rows * cell) // 2
    for j in range(rows):
        for i in range(cols):
            x0 = ox + i * cell; y0 = oy + j * cell; h = cell / 2; flip = r.random() < 0.5
            u = (y0 - TOP) / (H - TOP); col = hsl(60 - 290 * u) if mode == 'rainbow' else (hsl(190) if (i + j) % 2 else hsl(330))
            for (ax, ay, a0) in (((x0, y0, 0), (x0 + cell, y0 + cell, 180)) if not flip else ((x0 + cell, y0, 90), (x0, y0 + cell, 270))):
                c.arc([v for v in (ax - h, ay - h, ax + h, ay + h)], a0, a0 + 90, col, width)
    c.time(); return done(c)
# ---- 6. attractor dust ----
def attractor(kind, a, b, cc, dd, n=6500, hue0=0, size=2.0):
    x, y = 0.1, 0.1; pts = []
    for i in range(n + 200):
        if kind == 'clifford': x, y = math.sin(a * y) + cc * math.cos(a * x), math.sin(b * x) + dd * math.cos(b * y)
        else: x, y = math.sin(a * y) - math.cos(b * x), math.sin(cc * x) - math.cos(dd * y)
        if i >= 200: pts.append((x, y))
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; mx = max(max(xs) - min(xs), max(ys) - min(ys)); cx = (max(xs) + min(xs)) / 2; cy = (max(ys) + min(ys)) / 2
    c = Canvas()
    for i, (px, py) in enumerate(pts):
        X = CX + (px - cx) / mx * 290; Y = CY + (py - cy) / mx * 290
        c.rect(X, Y, X + size, Y + size, hsl(hue0 + 300 * i / n, 1.0, 0.62))
    c.time(); return done(c)
# ---- 7. fractals ----
def tree(depth=10, ang=24, shrink=0.74):
    c = Canvas()
    def go(x, y, a, L, d):
        if d == 0 or L < 2: return
        x2 = x + L * math.cos(math.radians(a)); y2 = y - L * math.sin(math.radians(a))
        col = (hsl(25, 0.6, 0.35) if d > depth - 3 else hsl(150 - 110 * (depth - d) / depth, 0.9, 0.55))
        c.line(x, y, x2, y2, col, max(1, d * 0.55))
        go(x2, y2, a + ang, L * shrink, d - 1); go(x2, y2, a - ang, L * shrink, d - 1)
    go(195, 445, 90, 62, depth); c.time(); return done(c)
def koch(depth=4, R=150):
    c = Canvas()
    pts = [(CX + R * math.cos(math.radians(-90 + 120 * k)), CY + R * math.sin(math.radians(-90 + 120 * k)) + 12) for k in range(3)]
    def seg(p, q, d, out):
        if d == 0: out.append(p); return
        dx, dy = (q[0] - p[0]) / 3, (q[1] - p[1]) / 3; a = (p[0] + dx, p[1] + dy); b = (p[0] + 2 * dx, p[1] + 2 * dy)
        pk = (a[0] + (b[0] - a[0]) * 0.5 + (b[1] - a[1]) * math.sqrt(3) / 2, a[1] + (b[1] - a[1]) * 0.5 - (b[0] - a[0]) * math.sqrt(3) / 2)
        for s, e in ((p, a), (a, pk), (pk, b), (b, q)): seg(s, e, d - 1, out)
    out = []
    for k in range(3): seg(pts[k], pts[(k + 1) % 3], depth, out)
    out.append(out[0])
    for i in range(len(out) - 1): c.line(*out[i], *out[i + 1], hsl(360 * i / len(out)), 1.6)
    c.time(); return done(c)
def dragon(iters=11):
    seq = [1]
    for _ in range(iters - 1): seq = seq + [1] + [-s for s in reversed(seq)]
    x = y = 0.0; a = 0; pts = [(0.0, 0.0)]
    for t in seq:
        a += t * 90; x += math.cos(math.radians(a)); y += math.sin(math.radians(a)); pts.append((x, y))
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; sc = 300 / max(max(xs) - min(xs), max(ys) - min(ys)); cx = (max(xs) + min(xs)) / 2; cy = (max(ys) + min(ys)) / 2
    c = Canvas()
    for i in range(len(pts) - 1):
        c.line(CX + (pts[i][0] - cx) * sc, CY + (pts[i][1] - cy) * sc, CX + (pts[i + 1][0] - cx) * sc, CY + (pts[i + 1][1] - cy) * sc, hsl(300 * i / len(pts) + 20), 1.5)
    c.time(); return done(c)
# ---- 8. moire circles ----
def moire(centres, step=6, R=150, width=1.4, rainbow=True):
    c = Canvas()
    for k, (dx, dy) in enumerate(centres):
        r = step
        while r < R:
            col = hsl(360 * r / R + 120 * k) if rainbow else (hsl(190) if k % 2 == 0 else hsl(320))
            c.ring(CX + dx, CY + dy, r, col, width); r += step
    c.time(); return done(c)
if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    sheet([maurer(2, 29), maurer(3, 47), maurer(6, 71)], OUT + 'effect-2-maurer-rose.png')
    sheet([truchet(30, 4, 5, 'rainbow'), truchet(22, 9, 4, 'two'), truchet(40, 2, 7, 'rainbow')], OUT + 'effect-4-truchet-arcs.png')
    sheet([attractor('clifford', -1.4, 1.6, 1.0, 0.7), attractor('dejong', 1.641, 1.902, 0.316, 1.525, hue0=180), attractor('clifford', -1.7, 1.3, -0.1, -1.21, hue0=60)], OUT + 'effect-6-attractor-dust.png')
    sheet([tree(), koch(), dragon()], OUT + 'effect-7-fractals.png')
    sheet([moire([(-28, 0), (28, 0)], 6), moire([(0, -30), (-26, 15), (26, 15)], 7, 150, 1.3, False), moire([(0, 0), (34, 20)], 6)], OUT + 'effect-8-moire-circles.png')
    print('done')
