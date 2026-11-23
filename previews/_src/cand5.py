from lib import *
CORNER, TOP = 86, 128
def inside_dist(x, y):                                  # distance from (x, y) to the edge of the rounded screen, and a clear zone for the clock row on top
    dx = min(x, W - x); dy = min(y, H - y)
    if dx < CORNER and dy < CORNER:
        cx = CORNER if x < W / 2 else W - CORNER; cy = CORNER if y < H / 2 else H - CORNER
        d = CORNER - math.hypot(x - cx, y - cy)
    else: d = min(dx, dy)
    return min(d, y - TOP)
def pack(seed, rmin=4, rmax=44, gap=2.2, n=900, tries=260):
    r = random.Random(seed); cs = []
    # radii drawn with many small and a few large (density ~ 1 / r^2), placed biggest first
    radii = sorted((rmin / (1 - r.random() * (1 - rmin / rmax)) for _ in range(n)), reverse=True)
    for rt in radii:
        for _ in range(tries):
            x = r.uniform(0, W); y = r.uniform(TOP, H)
            if inside_dist(x, y) - gap < rt: continue
            if all(math.hypot(x - px, y - py) >= pr + rt + gap for (px, py, pr) in cs): cs.append((x, y, rt)); break
    return cs
def style(cs, kind):
    c = Canvas()
    for (x, y, rad) in cs:
        u = (y - TOP) / (H - TOP); hue = 55 - 290 * u
        if kind == 'donut':
            c.circle(x, y, rad, hsl(hue, 0.95, 0.58))
            if rad > 11: c.circle(x, y, rad * 0.62, hsl(hue, 0.95, 0.7)); c.circle(x, y, rad * 0.3, (0, 0, 0))
        elif kind == 'bubble':
            c.circle(x, y, rad, hsl(hue, 0.9, 0.42)); c.circle(x - rad * 0.12, y - rad * 0.12, rad * 0.78, hsl(hue, 0.9, 0.58)); c.circle(x - rad * 0.28, y - rad * 0.3, max(1.5, rad * 0.22), (255, 255, 255))
        elif kind == 'ring':
            c.ring(x, y, rad, hsl(hue, 1.0, 0.64), 2.2)
            if rad > 14: c.ring(x, y, rad * 0.6, hsl(hue + 25, 1.0, 0.64), 1.6)
        elif kind == 'target':
            for i, f in enumerate((1.0, 0.72, 0.46, 0.22)):
                c.circle(x, y, rad * f, hsl(hue + 18 * i, 0.95, 0.5 + 0.08 * i) if i % 2 == 0 else (0, 0, 0))
    c.time(); return done(c)
if __name__ == '__main__':
    cs = pack(5); print(len(cs), 'circles')
    sheet([style(cs, 'donut'), style(cs, 'bubble'), style(cs, 'target')], 'cand5.png', cols=3)
