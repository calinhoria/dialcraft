import lib
from lib import *
import sys
OUT = '/Volumes/Projects/Projects/dialcraft/previews/'
TOP = 132; CX, CY = 195, 291
CORNER = 86
def on_screen(x, y):
    dx = min(x, W - x); dy = min(y, H - y)
    return not (dx < CORNER and dy < CORNER and math.hypot(CORNER - dx, CORNER - dy) > CORNER - 4)
def fin(c): c.time(); return done(c)
# ---- 19. honeycomb ----
def honeycomb(kind, R=16.5):
    c = Canvas(); r = random.Random(3); dx = 1.5 * R; dy = math.sqrt(3) * R; cells = []
    cols = int(W / dx) + 2; rows = int((H - TOP) / dy) + 2
    for i in range(cols):
        for j in range(rows):
            x = i * dx; y = TOP + R + j * dy + (dy / 2 if i % 2 else 0)
            if y > H - 4 or not on_screen(x, y) or x > W + 2: continue
            cells.append((math.hypot(x - CX, y - CY), x, y))
    for (d, x, y) in sorted(cells):
        k = 0.9 if kind != 'outline' else 0.94
        pts = [(x + R * k * math.cos(math.radians(60 * q)), y + R * k * math.sin(math.radians(60 * q))) for q in range(6)]
        hue = 360 * ((math.atan2(y - CY, x - CX) / (2 * math.pi)) % 1)
        if kind == 'gradient': c.poly(pts, fill=hsl(hue, 0.95, 0.58))
        elif kind == 'wave': c.poly(pts, fill=hsl(200 + 130 * (y - TOP) / (H - TOP), 0.95, 0.3 + 0.35 * (0.5 + 0.5 * math.sin(d / 17.0))))
        else:
            if r.random() < 0.32: c.poly(pts, fill=hsl(hue, 0.95, 0.58))
            else: c.poly(pts, outline=hsl(hue, 0.95, 0.6), w=1.6)
    return fin(c)
# ---- 20. equalizer ----
def equalizer(kind, n=34, seed=1):
    r = random.Random(seed); c = Canvas(); ph = [r.random() * 6.28 for _ in range(3)]; bw = 8.4; gap = 2.8; x0 = (W - n * (bw + gap) + gap) / 2
    for i in range(n):
        h = 26 + 250 * (0.5 + 0.5 * math.sin(0.45 * i + ph[0])) * (0.55 + 0.45 * math.sin(1.3 * i + ph[1])) + 14 * r.random(); x = x0 + i * (bw + gap); hue = 300 * i / n
        if kind == 'bars': c.rect(x, H - 6 - h, x + bw, H - 6, hsl(hue, 1.0, 0.6))
        elif kind == 'mirror': hh = h / 2; c.rect(x, CY - hh, x + bw, CY + hh, hsl(hue, 1.0, 0.6))
        else:
            segs = int(h / 8)
            for s in range(segs): yy = H - 8 - (s + 1) * 8 + 1.5; c.rect(x, yy, x + bw, yy + 5.5, hsl(125 - 125 * s / 36, 1.0, 0.55))
    return fin(c)
# ---- 21. golden spiral ----
def golden(kind, flip=False):
    fib = [1, 1]
    while len(fib) < 10: fib.append(fib[-1] + fib[-2])
    sq = []; x0 = y0 = 0; x1 = y1 = 0; arcs = []
    for k, f in enumerate(fib):
        d = (k + 3) % 4 if k else 3                                   # the first square counts as 'up', then right, down, left, up ...
        if k == 0: sx, sy = 0, 0; x1, y1 = f, f; d = 3
        elif d == 0: sx, sy = x1, y0; x1 += f
        elif d == 1: sx, sy = x0, y1; y1 += f
        elif d == 2: sx, sy = x0 - f, y0; x0 -= f
        else: sx, sy = x0, y0 - f; y0 -= f
        sq.append((sx, sy, f))
        cen = {0: (sx, sy + f, 270), 1: (sx, sy, 0), 2: (sx + f, sy, 90), 3: (sx + f, sy + f, 180)}[d]
        arcs.append((cen[0], cen[1], f, cen[2]))
    bw, bh = x1 - x0, y1 - y0; sc = min(380 / bw, 305 / bh); ox = (W - bw * sc) / 2 - x0 * sc; oy = TOP + (H - TOP - bh * sc) / 2 - y0 * sc
    def T(px, py): return ox + px * sc if not flip else W - (ox + px * sc), oy + py * sc
    c = Canvas()
    for k, (sx, sy, f) in enumerate(sq):
        xa, ya = T(sx, sy); xb, yb = T(sx + f, sy + f); xa, xb = min(xa, xb), max(xa, xb)
        if kind == 'filled': c.rect(xa + 1, ya + 1, xb - 1, yb - 1, hsl(360 * k / len(sq), 0.9, 0.5))
        else: c.rect(xa, ya, xb, ya + 1, (90, 90, 100)); c.rect(xa, yb - 1, xb, yb, (90, 90, 100)); c.rect(xa, ya, xa + 1, yb, (90, 90, 100)); c.rect(xb - 1, ya, xb, yb, (90, 90, 100))
    for k, (cx, cy, f, a0) in enumerate(arcs):
        px, py = T(cx, cy); rad = f * sc; a0f, a1f = (a0, a0 + 90) if not flip else (180 - a0 - 90, 180 - a0)
        c.arc([px - rad, py - rad, px + rad, py + rad], a0f % 360, (a0f % 360) + 90, (255, 255, 255) if kind == 'filled' else hsl(360 * k / len(arcs)), 3.0 if kind != 'filled' else 2.4)
    return fin(c)
# ---- 22. Lissajous table ----
def lissajous(cols_ab, rows_ab, hue_by='cell', n=110):
    c = Canvas(); nc, nr = len(cols_ab), len(rows_ab); cw = 372 / nc; ch = 300 / nr; ox = (W - nc * cw) / 2; oy = TOP + 6
    for j, b in enumerate(rows_ab):
        for i, a in enumerate(cols_ab):
            cx = ox + (i + 0.5) * cw; cy = oy + (j + 0.5) * ch; rx = cw * 0.44; ry = ch * 0.44; pts = []
            for k in range(n + 1):
                t = 2 * math.pi * k / n; pts.append((cx + rx * math.sin(a * t + math.pi / 2 * (1 if hue_by != 'phase' else (i + 1) / nc)), cy + ry * math.sin(b * t)))
            col = hsl(300 * (i + j * nc) / (nc * nr) + 20, 1.0, 0.62)
            for p, q in zip(pts, pts[1:]): c.line(*p, *q, col, 1.4)
    return fin(c)
# ---- 23. spiral galaxy ----
def galaxy(arms, hue0, hue1, seed, n=1800):
    r = random.Random(seed); c = Canvas(); dots = []
    for _ in range(n):
        t = r.random() ** 0.75; k = r.randrange(arms); th = k * 2 * math.pi / arms + 5.2 * t ** 0.7 + r.gauss(0, 0.1 + 0.16 * t)
        rad = t * 188; x = CX + rad * math.cos(th) + r.gauss(0, 2.5 + 5 * t); y = CY + rad * 0.82 * math.sin(th) + r.gauss(0, 2.5 + 5 * t)
        if y < TOP or not on_screen(x, y) or x < -4 or x > W + 4: continue
        dots.append((t, x, y, 1.2 + 1.3 * r.random() * (1 - 0.5 * t), hue0 + (hue1 - hue0) * t, 0.62 + 0.25 * (1 - t)))
    for (t, x, y, rad, hue, l) in sorted(dots): c.circle(x, y, rad, hsl(hue, 1.0 if t > 0.1 else 0.3, min(0.92, l)))
    return fin(c)
SETS = {
    '19-honeycomb': lambda: [honeycomb('gradient'), honeycomb('wave'), honeycomb('outline')],
    '20-equalizer': lambda: [equalizer('bars'), equalizer('mirror', seed=4), equalizer('segments', seed=2)],
    '21-golden-spiral': lambda: [golden('filled'), golden('lines'), golden('filled', True)],
    '22-lissajous-table': lambda: [lissajous([1, 2, 3, 4], [1, 2, 3]), lissajous([2, 3, 5, 7], [3, 4, 5], 'phase'), lissajous([3, 5, 7], [2, 4, 6])],
    '23-galaxy': lambda: [galaxy(2, 45, 230, 1), galaxy(3, 20, 300, 2), galaxy(4, 180, 330, 3)],
}
if __name__ == '__main__':
    from PIL import Image
    lib.RAW = False; ims = []
    for name in SETS:
        cs = SETS[name](); sheet(cs, OUT + 'effect-%s.png' % name); ims.append(cs[1])
    s = Image.new('RGB', (234 * 5 + 40, 270), (40, 40, 44))
    for i, im in enumerate(ims): s.paste(im.resize((234, 270)), (i * 244, 0))
    s.save('overview6.png'); print('ok')
