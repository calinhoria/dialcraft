import math, sys
import numpy as np
from PIL import Image, ImageDraw
import wf, lg
import wf3 as J
from wf3 import leaf, W, H, S, SW, SH, XX, YY, LOOP, XFADE, WARM, FPS

SS = 4
P = SS
rnd = np.random.default_rng(5)

# ------------------------------------------------------------ colour light
def orb(cx, cy, r, col, a):
    d2 = (XX - cx * W) ** 2 + (YY - cy * H) ** 2
    return (np.exp(-d2 / (2 * (r * W) ** 2))[..., None] * np.array(col, np.float32) * a)


COLOR = (orb(0.10, 0.80, 0.30, (1.0, 0.18, 0.55), 0.22) + orb(0.92, 0.22, 0.26, (1.0, 0.55, 0.10), 0.20)
         + orb(0.88, 0.86, 0.28, (0.10, 0.85, 0.80), 0.20) + orb(0.12, 0.18, 0.26, (0.55, 0.30, 1.0), 0.20)
         + orb(0.50, 0.55, 0.30, (0.25, 0.90, 0.45), 0.10)).astype(np.float32)
J.BG3 = np.clip(J.BG3 + COLOR * 0.9, 0, 1)
J.BG3B = np.clip(J.BG3B + COLOR * 0.9, 0, 1)


# ------------------------------------------------------------------ flowers
def hibiscus(d, x, y, r, c1, c2, rot=0.0):
    for i in range(5):
        a = rot + i * math.tau / 5
        leaf(d, x, y, a, r, r * 0.95, c1, c2, veins=False)
    for i in range(5):
        a = rot + i * math.tau / 5 + math.tau / 10
        leaf(d, x, y, a, r * 0.55, r * 0.5, tuple(min(255, int(v * 0.8)) for v in c2[:3]) + (255,), c2, veins=False)
    d.line([(x, y), (x + math.cos(rot - 0.9) * r * 1.2, y + math.sin(rot - 0.9) * r * 1.2)], fill=(255, 235, 120, 255), width=int(r * 0.12))
    for k in range(4):
        a = rot - 0.9 + (k - 1.5) * 0.12
        px, py = x + math.cos(a) * r * 1.25, y + math.sin(a) * r * 1.25
        d.ellipse([px - r * 0.09, py - r * 0.09, px + r * 0.09, py + r * 0.09], fill=(255, 190, 40, 255))


def orchid(d, x, y, r, rot=0.0):
    for a in (-0.35, 0.35):
        leaf(d, x, y, rot + math.pi * 1.5 + a * 2.2, r * 1.15, r * 0.55, (255, 235, 250, 255), (220, 150, 220, 255), veins=False)
    for a in (0.0,):
        leaf(d, x, y, rot + math.pi * 1.5, r * 1.05, r * 0.5, (255, 240, 252, 255), (235, 170, 230, 255), veins=False)
    for a in (-2.4, 2.4):
        leaf(d, x, y, rot + math.pi * 0.5 + a * 0.55, r, r * 0.6, (245, 200, 240, 255), (200, 100, 200, 255), veins=False)
    leaf(d, x, y, rot + math.pi * 0.5, r * 0.65, r * 0.5, (190, 40, 150, 255), (130, 20, 110, 255), veins=False)


def heliconia(d, x, y, ang, n, L):
    for i in range(n):
        a = ang + (-0.55 if i % 2 else 0.55)
        px, py = x + math.cos(ang) * L * 0.55 * i / n * 2, y + math.sin(ang) * L * 0.55 * i / n * 2
        leaf(d, px, py, a, L * 0.55, L * 0.30, (255, 70, 40, 255), (200, 20, 40, 255), veins=False)
        leaf(d, px, py, a, L * 0.30, L * 0.12, (255, 215, 60, 255), (255, 160, 30, 255), veins=False)


def croton(d, x, y, ang, L):
    leaf(d, x, y, ang, L, L * 0.34, (250, 190, 40, 255), (210, 70, 30, 255))


# ------------------------------------------------------------------ animals
def ell(d, cx, cy, rx, ry, fill, rot=0.0):
    pts = []
    for i in range(36):
        a = i * math.tau / 36
        x, y = rx * math.cos(a), ry * math.sin(a)
        pts.append((cx + x * math.cos(rot) - y * math.sin(rot), cy + x * math.sin(rot) + y * math.cos(rot)))
    d.polygon(pts, fill=fill)


def macaw(d, cx, cy, s):
    # branch
    d.line([((SW + 14) * P, (cy + 0.36 * s + 6) * P), ((cx - 0.30 * s) * P, (cy + 0.36 * s) * P)], fill=(70, 44, 24, 255), width=int(5 * P))
    # tail
    leaf(d, (cx + 0.02 * s) * P, (cy + 0.25 * s) * P, 1.62, 0.78 * s * P, 0.13 * s * P, (230, 40, 40, 255), (25, 80, 200, 255), veins=False)
    leaf(d, (cx + 0.10 * s) * P, (cy + 0.25 * s) * P, 1.50, 0.70 * s * P, 0.12 * s * P, (25, 100, 230, 255), (20, 60, 170, 255), veins=False)
    # body
    ell(d, cx * P, cy * P, 0.23 * s * P, 0.36 * s * P, (225, 32, 34, 255), rot=0.08)
    ell(d, (cx - 0.05 * s) * P, (cy - 0.04 * s) * P, 0.16 * s * P, 0.28 * s * P, (245, 70, 60, 255), rot=0.08)
    # wing, layered colour bands
    leaf(d, (cx + 0.06 * s) * P, (cy - 0.22 * s) * P, 1.72, 0.60 * s * P, 0.26 * s * P, (28, 100, 230, 255), (20, 60, 175, 255), veins=False)
    leaf(d, (cx + 0.06 * s) * P, (cy - 0.20 * s) * P, 1.70, 0.40 * s * P, 0.22 * s * P, (255, 205, 40, 255), (235, 160, 20, 255), veins=False)
    leaf(d, (cx + 0.06 * s) * P, (cy - 0.20 * s) * P, 1.68, 0.22 * s * P, 0.2 * s * P, (235, 40, 40, 255), (190, 25, 30, 255), veins=False)
    # head
    hx, hy = cx - 0.06 * s, cy - 0.40 * s
    ell(d, hx * P, hy * P, 0.15 * s * P, 0.15 * s * P, (232, 36, 38, 255))
    ell(d, (hx - 0.07 * s) * P, (hy + 0.01 * s) * P, 0.085 * s * P, 0.07 * s * P, (250, 244, 232, 255))
    ell(d, (hx - 0.06 * s) * P, (hy - 0.005 * s) * P, 0.026 * s * P, 0.026 * s * P, (252, 215, 60, 255))
    ell(d, (hx - 0.06 * s) * P, (hy - 0.005 * s) * P, 0.014 * s * P, 0.014 * s * P, (10, 10, 10, 255))
    # beak
    d.polygon([((hx - 0.10 * s) * P, (hy - 0.07 * s) * P), ((hx - 0.27 * s) * P, (hy + 0.00 * s) * P), ((hx - 0.22 * s) * P, (hy + 0.12 * s) * P),
               ((hx - 0.13 * s) * P, (hy + 0.07 * s) * P), ((hx - 0.08 * s) * P, (hy + 0.04 * s) * P)], fill=(244, 232, 205, 255))
    d.polygon([((hx - 0.20 * s) * P, (hy + 0.07 * s) * P), ((hx - 0.13 * s) * P, (hy + 0.11 * s) * P), ((hx - 0.09 * s) * P, (hy + 0.07 * s) * P)], fill=(70, 70, 76, 255))
    # claws on the branch
    for k in (0, 1):
        d.line([((cx - 0.06 * s + k * 0.1 * s) * P, (cy + 0.34 * s) * P), ((cx - 0.06 * s + k * 0.1 * s) * P, (cy + 0.40 * s) * P)], fill=(90, 90, 96, 255), width=int(2.4 * P))


def frog(d, cx, cy, s):
    g1, g2 = (96, 210, 50, 255), (50, 150, 40, 255)
    # back leg folded
    ell(d, (cx + 0.55 * s) * P, (cy + 0.2 * s) * P, 0.55 * s * P, 0.28 * s * P, g2, rot=0.4)
    for dx in (0.88, 1.02, 1.14):
        ell(d, (cx + dx * s) * P, (cy + 0.50 * s) * P, 0.07 * s * P, 0.07 * s * P, (255, 140, 30, 255))
    # body
    ell(d, cx * P, cy * P, 0.95 * s * P, 0.68 * s * P, g1)
    ell(d, (cx + 0.1 * s) * P, (cy + 0.25 * s) * P, 0.7 * s * P, 0.22 * s * P, (70, 120, 235, 255))
    ell(d, (cx - 0.1 * s) * P, (cy + 0.45 * s) * P, 0.55 * s * P, 0.18 * s * P, (252, 245, 220, 255))
    # front feet
    for dx in (-0.78, -0.58):
        ell(d, (cx + dx * s) * P, (cy + 0.62 * s) * P, 0.12 * s * P, 0.1 * s * P, (255, 140, 30, 255))
    # eyes
    for dx in (-0.55, 0.12):
        ex, ey = cx + dx * s, cy - 0.55 * s
        ell(d, ex * P, ey * P, 0.34 * s * P, 0.34 * s * P, (230, 25, 40, 255))
        ell(d, ex * P, ey * P, 0.12 * s * P, 0.28 * s * P, (10, 10, 10, 255))
        ell(d, (ex - 0.08 * s) * P, (ey - 0.12 * s) * P, 0.06 * s * P, 0.06 * s * P, (255, 255, 255, 255))


def build_decor():
    im = Image.new("RGBA", (SW * SS, SH * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # flowers tucked in the foliage and along the sides
    hibiscus(d, 30 * P, 64 * P, 17 * P, (255, 60, 90, 255), (200, 20, 70, 255), rot=0.4)
    hibiscus(d, 356 * P, 396 * P, 17 * P, (255, 150, 40, 255), (230, 70, 30, 255), rot=1.0)
    hibiscus(d, 20 * P, 176 * P, 11 * P, (255, 110, 190, 255), (215, 50, 140, 255), rot=2.0)
    orchid(d, 372 * P, 186 * P, 10 * P, rot=0.2)
    orchid(d, 14 * P, 330 * P, 10 * P, rot=-0.3)
    orchid(d, 346 * P, 320 * P, 8 * P, rot=0.5)
    heliconia(d, 44 * P, 440 * P, -1.25, 4, 40 * P)
    heliconia(d, 346 * P, 440 * P, -1.9, 4, 38 * P)
    croton(d, 30 * P, 456 * P, -0.95, 44 * P)
    croton(d, 360 * P, 456 * P, -2.2, 44 * P)
    croton(d, 8 * P, 120 * P, 0.15, 44 * P)
    # animals
    macaw(d, 336, 126, 66)
    frog(d, 40 * P / P, 228, 14) if False else frog(d, 40, 229, 11)
    im = im.resize((W, H), Image.LANCZOS)
    a = np.asarray(im, np.float32) / 255
    rgb, al = a[..., :3], a[..., 3]
    return np.dstack([rgb * al[..., None], al]).astype(np.float32)


DECOR = build_decor()
DW = np.clip(np.minimum(np.minimum(XX, W - XX), np.minimum(YY, H - YY)) / (0.34 * H), 0, 1) ** 1.2 * 0.35


def decor_layer(t):
    ph = math.tau * t
    dx = 3 * S * np.sin(ph + YY * 0.012 + 0.6) * DW
    dy = 1.4 * S * np.sin(ph + XX * 0.009 + 0.6) * DW
    return np.stack([lg.bilinear(DECOR[..., k], XX - dx, YY - dy) for k in range(4)], -1)


# -------------------------------------------------------- animated insects
BFLY = [  # cx, cy, ax, ay, kx, ky, phase, size, wing colours, flaps per loop
    (200, 150, 120, 60, 1, 2, 0.4, 13, ((30, 110, 255), (10, 30, 120), (160, 220, 255)), 12),
    (170, 300, 150, 40, 1, 1, 2.6, 11, ((255, 150, 20), (30, 20, 10), (255, 230, 150)), 10),
    (230, 80, 90, 36, 2, 1, 4.1, 9, ((255, 225, 40), (50, 40, 10), (255, 250, 190)), 14),
]


def butterfly(d, x, y, ang, s, flap, cols):
    c1, c2, c3 = cols
    f = 0.18 + 0.82 * abs(math.cos(flap))
    for sgn in (1, -1):
        def pt(u, v):  # wing-local: u along body, v outward
            return (x + (math.cos(ang) * u - math.sin(ang) * v * f * sgn) * s * P,
                    y + (math.sin(ang) * u + math.cos(ang) * v * f * sgn) * s * P)
        def wing(cu, cv, ru, rv, rot, fill):
            pts = []
            for i in range(24):
                a = i * math.tau / 24
                u, v = ru * math.cos(a), rv * math.sin(a)
                pts.append(pt(cu + u * math.cos(rot) - v * math.sin(rot), cv + u * math.sin(rot) + v * math.cos(rot)))
            d.polygon(pts, fill=fill + (255,))
        wing(-0.15, 0.55, 0.62, 0.42, -0.5, c2)
        wing(0.50, 0.55, 0.48, 0.40, 0.5, c2)
        wing(-0.15, 0.55, 0.52, 0.34, -0.5, c1)
        wing(0.50, 0.55, 0.40, 0.32, 0.5, c1)
        wing(0.7, 0.7, 0.07, 0.07, 0, c3)
        wing(0.3, 0.8, 0.06, 0.06, 0, c3)
    ell(d, x, y, 0.55 * s * P, 0.09 * s * P, (25, 20, 20, 255), rot=ang)


def hummingbird(d, x, y, s, flap):
    # wings first (blurred feel via two overlapping angles)
    for k, a in enumerate((-0.9 + 0.9 * math.sin(flap), -0.2 + 0.9 * math.sin(flap + 1.2))):
        leaf(d, x, y - 0.05 * s * P, -1.55 + a, 0.85 * s * P, 0.28 * s * P, (210, 235, 240, 150), (170, 205, 215, 120), veins=False)
    ell(d, x, y, 0.42 * s * P, 0.22 * s * P, (28, 170, 120, 255), rot=0.3)
    ell(d, x - 0.38 * s * P, y - 0.18 * s * P, 0.17 * s * P, 0.16 * s * P, (20, 140, 110, 255))
    ell(d, x - 0.46 * s * P, y - 0.06 * s * P, 0.1 * s * P, 0.08 * s * P, (235, 40, 70, 255))
    d.line([(x - 0.52 * s * P, y - 0.2 * s * P), (x - 1.1 * s * P, y - 0.02 * s * P)], fill=(30, 30, 30, 255), width=int(1.6 * P))
    leaf(d, x + 0.36 * s * P, y + 0.08 * s * P, 0.5, 0.55 * s * P, 0.2 * s * P, (30, 120, 90, 255), (15, 80, 60, 255), veins=False)
    ell(d, x - 0.42 * s * P, y - 0.2 * s * P, 0.025 * s * P, 0.025 * s * P, (0, 0, 0, 255))


def insects(t):
    im = Image.new("RGBA", (SW * SS, SH * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    ph = math.tau * t
    for cx, cy, ax, ay, kx, ky, p, s, cols, nfl in BFLY:
        x = cx + ax * math.sin(ph * kx + p)
        y = cy + ay * math.sin(ph * ky + p * 1.3)
        vx = ax * kx * math.cos(ph * kx + p)
        vy = ay * ky * math.cos(ph * ky + p * 1.3)
        ang = math.atan2(vy, vx)
        butterfly(d, x * P, y * P, ang, s, ph * nfl + p, cols)
    hx = 70 + 5 * math.sin(ph * 2)
    hy = 392 + 7 * math.sin(ph * 3)
    hummingbird(d, hx * P, hy * P, 20, ph * 28)
    im = im.resize((W, H), Image.LANCZOS)
    a = np.asarray(im, np.float32) / 255
    al = a[..., 3:4]
    return np.concatenate([a[..., :3] * al, al], -1)


def sat(img, k):
    l = img @ np.array([0.299, 0.587, 0.114], np.float32)
    return l[..., None] + (img - l[..., None]) * k


def frame(sim, t):
    sc, ray = J.scene(t)
    wf.SCENE = sc
    out = wf.render(sim)
    out = out + (ray * 0.15)[..., None] * J.RAYCOL
    J.motes(out, t)
    for lay in (J.fg_layer(t), decor_layer(t), insects(t)):
        out = out * (1 - lay[..., 3:4]) + lay[..., :3]
    out = sat(out, 1.18) * np.array([0.98, 1.03, 0.95], np.float32)
    return np.clip(out, 0, 1)


def run(out, n_still=None):
    sim = wf.Sim()
    for _ in range(WARM):
        sim.step()
        wf.FOAM[:] = wf.FOAM * 0.8
    frames = []
    for i in range(LOOP + XFADE):
        sim.step()
        frames.append(frame(sim, (i % LOOP) / LOOP))
        print(i, end=" ", flush=True)
        if n_still is not None and i == n_still:
            lg.compose(frames[-1]).save(out)
            return
    O = []
    for i in range(LOOP):
        if i < XFADE:
            a = i / XFADE
            O.append((1 - a) * frames[LOOP + i] + a * frames[i])
        else:
            O.append(frames[i])
    imgs = [lg.compose(f, k) for k, f in enumerate(O)]
    imgs[0].save(out + "_f0.png")
    mos = Image.new("RGB", (lg.CW * 4, lg.CH * 2))
    for i in range(8):
        mos.paste(imgs[i * (LOOP // 8)], ((i % 4) * lg.CW, (i // 4) * lg.CH))
    pal = mos.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    q = [im.quantize(palette=pal, dither=Image.Dither.FLOYDSTEINBERG) for im in imgs]
    q[0].save(out, save_all=True, append_images=q[1:], duration=int(1000 / FPS), loop=0, optimize=False, disposal=1)
    print("saved")


if __name__ == "__main__":
    if sys.argv[1] == "still":
        run(sys.argv[2], int(sys.argv[3]))
    else:
        run(sys.argv[2])
