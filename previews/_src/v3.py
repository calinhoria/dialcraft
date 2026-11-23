from lib3 import *
import sys
OUT = '/Volumes/Projects/Projects/dialcraft/previews/'
# ---- 1. times table ----
def table(N, k, R=186, width=1.0):
    c = Canvas()
    for i in range(N):
        a1 = 2 * math.pi * i / N; a2 = 2 * math.pi * (k * i) / N
        c.line(CX + R * math.cos(a1), CY + R * math.sin(a1), CX + R * math.cos(a2), CY + R * math.sin(a2), hsl(360 * i / N), width)
    c.dissolve(7); c.time(); return c
# ---- 2. Maurer rose ----
def maurer(n, d, R=186, width=1.0):
    c = Canvas(); raw = []
    for k in range(361):
        th = math.radians(k * d); r = math.sin(n * th); raw.append((CX + 192 * r * math.cos(th), CY + 222 * r * math.sin(th)))
    for k in range(360): c.line(*raw[k], *raw[k + 1], hsl(300 * k / 360), width)
    rose = []
    for k in range(361):
        th = math.radians(k); r = math.sin(n * th); rose.append((CX + 192 * r * math.cos(th), CY + 222 * r * math.sin(th)))
    c.pline(rose, rose, lambda i: (255, 255, 255), lambda i: 1.4)
    c.dissolve(7); c.time(); return c
# ---- 3. harmonograph ----
def harmono(seed, nseg=2600, T=70.0, width=1.6, R=186):
    r = random.Random(seed)
    base = [2, 3, 2, 3]
    fr = [base[i] + (r.random() - 0.5) * 0.03 + r.choice([0, 0, 1, -1]) * (r.random() < 0.4) for i in range(4)]
    amp = [1.0, 0.8 + r.random() * 0.4, 1.0, 0.8 + r.random() * 0.4]; ph = [r.random() * 6.283 for _ in range(4)]; dmp = [0.012 + r.random() * 0.012 for _ in range(4)]
    def pos(t):
        x = amp[0] * math.sin(fr[0] * t + ph[0]) * math.exp(-dmp[0] * t) + amp[1] * math.sin(fr[1] * t + ph[1]) * math.exp(-dmp[1] * t)
        y = amp[2] * math.sin(fr[2] * t + ph[2]) * math.exp(-dmp[2] * t) + amp[3] * math.sin(fr[3] * t + ph[3]) * math.exp(-dmp[3] * t)
        return x, y
    pts = [pos(T * i / nseg) for i in range(nseg + 1)]; mx_ = max(abs(p[0]) for p in pts); my_ = max(abs(p[1]) for p in pts)
    c = Canvas(); h0 = r.random() * 360
    raw = [(CX + 192 * p[0] / mx_, CY + 222 * p[1] / my_) for p in pts]
    c.pline(raw, raw, lambda i: hsl(h0 + 300 * i / nseg, 1.0, 0.64), lambda i: width * (1.15 - 0.55 * i / nseg))
    c.dissolve(7); c.time(); return c
# ---- 4. Truchet arcs: tiles shrink and thin out toward the clock, and appear in a ripple moving outward from it ----
CORNER = 86
def on_screen(x, y):
    dx = min(x, W - x); dy = min(y, H - y)
    if dx < CORNER and dy < CORNER: return math.hypot(CORNER - dx, CORNER - dy) < CORNER - 6
    return True
def truchet(cell, seed, width, mode):
    r = random.Random(seed); c = Canvas(); cols = W // cell; rows = H // cell; ox = (W - cols * cell) // 2; oy = (H - rows * cell) // 2; tiles = []
    for j in range(rows):
        for i in range(cols):
            x0 = ox + i * cell; y0 = oy + j * cell; mx, my = x0 + cell / 2, y0 + cell / 2; flip = r.random() < 0.5
            u = hypot_u = math.hypot((mx - CX) / (A1 + cell * 0.6), (my - CY) / (B1 + cell * 0.6))
            if not on_screen(mx, my): continue
            tiles.append((u, i, j, x0, y0, flip))
    tiles.sort()
    for (u, i, j, x0, y0, flip) in tiles:
        h = cell / 2; col = hsl(360 * ((math.atan2(y0 + h - CY, x0 + h - CX) / (2 * math.pi)) % 1)) if mode == 'rainbow' else (hsl(190) if (i + j) % 2 else hsl(330))
        wd = max(1.5, width * min(1.0, 0.35 + 0.65 * (u - 1) / 0.9))
        for (ax, ay, a0) in (((x0, y0, 0), (x0 + cell, y0 + cell, 180)) if not flip else ((x0 + cell, y0, 90), (x0, y0 + cell, 270))): c.arc([ax - h, ay - h, ax + h, ay + h], a0, a0 + 90, col, wd)
    c.dissolve(7); c.time(); return c
# ---- 5. circle packing: circles get smaller toward the clock and appear outward from it ----
def pack(seed, rmin=4, rmax=44, gap=2.2, n=1100, tries=300):
    r = random.Random(seed); cs = []
    radii = sorted((rmin / (1 - r.random() * (1 - rmin / rmax)) for _ in range(n)), reverse=True)
    for rt in radii:
        for _ in range(tries):
            x = r.uniform(0, W); y = r.uniform(0, H)
            if min(x, W - x, y, H - y) - gap < rt or not on_screen(x, y): continue
            if all(math.hypot(x - px, y - py) >= pr + rt + gap for (px, py, pr) in cs): cs.append((x, y, rt)); break
    return cs
def packstyle(cs, kind):
    c = Canvas()
    for (x, y, rad) in sorted(cs, key=lambda q: uval(q[0], q[1])):
        hue = 360 * ((math.atan2(y - CY, x - CX) / (2 * math.pi)) % 1)
        if kind == 'donut':
            c.circle(x, y, rad, hsl(hue, 0.95, 0.58))
            if rad > 11: c.circle(x, y, rad * 0.62, hsl(hue, 0.95, 0.7)); c.circle(x, y, rad * 0.3, (0, 0, 0))
        elif kind == 'bubble':
            c.circle(x, y, rad, hsl(hue, 0.9, 0.42)); c.circle(x - rad * 0.12, y - rad * 0.12, rad * 0.78, hsl(hue, 0.9, 0.58)); c.circle(x - rad * 0.28, y - rad * 0.3, max(1.5, rad * 0.22), (255, 255, 255))
        else:
            for i, f in enumerate((1.0, 0.72, 0.46, 0.22)): c.circle(x, y, rad * f, hsl(hue + 18 * i, 0.95, 0.5 + 0.08 * i) if i % 2 == 0 else (0, 0, 0))
    c.dissolve(7); c.time(); return c
# ---- 6. attractor dust ----
def attractor(kind, a, b, cc, dd, n=6500, hue0=0, size=2.0):
    x, y = 0.1, 0.1; pts = []
    for i in range(n + 200):
        if kind == 'clifford': x, y = math.sin(a * y) + cc * math.cos(a * x), math.sin(b * x) + dd * math.cos(b * y)
        else: x, y = math.sin(a * y) - math.cos(b * x), math.sin(cc * x) - math.cos(dd * y)
        if i >= 200: pts.append((x, y))
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; rx = max(xs) - min(xs); ry = max(ys) - min(ys); cx = (max(xs) + min(xs)) / 2; cy = (max(ys) + min(ys)) / 2
    c = Canvas()
    for i, (px, py) in enumerate(pts):
        X, Y = CX + (px - cx) / rx * 384, CY + (py - cy) / ry * 440; c.rect(X, Y, X + size, Y + size, hsl(hue0 + 300 * i / n, 1.0, 0.62))
    c.dissolve(7); c.time(); return c
# ---- 7. fractals ----
def tree(depth=10, ang=24, shrink=0.74):
    c = Canvas()
    def go(x, y, a, L, d):
        if d == 0 or L < 2: return
        x2 = x + L * math.cos(math.radians(a)); y2 = y - L * math.sin(math.radians(a))
        col = (hsl(25, 0.6, 0.35) if d > depth - 3 else hsl(150 - 110 * (depth - d) / depth, 0.9, 0.55))
        c.line(x, y, x2, y2, col, max(1, d * 0.55))
        go(x2, y2, a + ang, L * shrink, d - 1); go(x2, y2, a - ang, L * shrink, d - 1)
    go(195, 448, 90, 70, depth); c.dissolve(7); c.time(); return c
def koch(depth=4, R=205):
    c = Canvas(); pts = [(CX + R * math.cos(math.radians(-90 + 120 * k)), CY + R * math.sin(math.radians(-90 + 120 * k)) + 14) for k in range(3)]
    def seg(p, q, d, out):
        if d == 0: out.append(p); return
        dx, dy = (q[0] - p[0]) / 3, (q[1] - p[1]) / 3; a = (p[0] + dx, p[1] + dy); b = (p[0] + 2 * dx, p[1] + 2 * dy)
        pk = (a[0] + (b[0] - a[0]) * 0.5 + (b[1] - a[1]) * math.sqrt(3) / 2, a[1] + (b[1] - a[1]) * 0.5 - (b[0] - a[0]) * math.sqrt(3) / 2)
        for s, e in ((p, a), (a, pk), (pk, b), (b, q)): seg(s, e, d - 1, out)
    out = []
    for k in range(3): seg(pts[k], pts[(k + 1) % 3], depth, out)
    out.append(out[0])
    for i in range(len(out) - 1): c.line(*out[i], *out[i + 1], hsl(360 * i / len(out)), 1.6)
    c.dissolve(7); c.time(); return c
def dragon(iters=11):
    seq = [1]
    for _ in range(iters - 1): seq = seq + [1] + [-s for s in reversed(seq)]
    x = y = 0.0; a = 0; pts = [(0.0, 0.0)]
    for t in seq: a += t * 90; x += math.cos(math.radians(a)); y += math.sin(math.radians(a)); pts.append((x, y))
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; sc = 400 / max(max(xs) - min(xs), max(ys) - min(ys)); cx = (max(xs) + min(xs)) / 2; cy = (max(ys) + min(ys)) / 2
    c = Canvas(); raw = [(CX + (p[0] - cx) * sc, CY + (p[1] - cy) * sc) for p in pts]
    c.pline(raw, raw, lambda i: hsl(300 * i / len(raw) + 20), lambda i: 1.5)
    c.dissolve(7); c.time(); return c
# ---- 8. moire circles: every ring stops short of the clock's clear zone ----
def moire(centres, step=6, R=190, width=1.4, rainbow=True):
    c = Canvas()
    for k, (dx, dy) in enumerate(centres):
        r = step
        while r < R:
            col = hsl(360 * r / R + 120 * k) if rainbow else (hsl(190) if k % 2 == 0 else hsl(320))
            c.ring(CX + dx, CY + dy, r, col, width)
            r += step
    c.dissolve(7); c.time(); return c
SETS = {
    '1-times-table': lambda: [table(180, 2), table(180, 3), table(240, 51)],
    '2-maurer-rose': lambda: [maurer(2, 29), maurer(3, 47), maurer(6, 71)],
    '3-harmonograph': lambda: [harmono(1), harmono(2), harmono(7)],
    '4-truchet-arcs': lambda: [truchet(30, 4, 5, 'rainbow'), truchet(22, 9, 4, 'two'), truchet(40, 2, 7, 'rainbow')],
    '5-circle-packing': lambda: [packstyle(pack(5), 'donut'), packstyle(pack(8), 'bubble'), packstyle(pack(11), 'target')],
    '6-attractor-dust': lambda: [attractor('clifford', -1.4, 1.6, 1.0, 0.7), attractor('dejong', 1.641, 1.902, 0.316, 1.525, hue0=180), attractor('clifford', -1.7, 1.3, -0.1, -1.21, hue0=60)],
    '7-fractals': lambda: [tree(), koch(), dragon()],
    '8-moire-circles': lambda: [moire([(-28, 0), (28, 0)], 6), moire([(0, -30), (-26, 15), (26, 15)], 7, 190, 1.3, False), moire([(0, 0), (34, 20)], 6)],
}
if __name__ == '__main__':
    only = sys.argv[1:] or list(SETS)
    for name in only:
        cs = SETS[name](); sheet(cs, OUT + 'effect-%s.png' % name); print(name, [len(c.ops) for c in cs])
