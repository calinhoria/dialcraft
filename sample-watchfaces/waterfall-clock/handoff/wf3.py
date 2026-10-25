import math, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import wf, lg
from wf import gblur, noise_layer, W, H, S, SW, SH, M2, LOOP, XFADE, WARM, FPS

SS = 4  # drawing scale for foliage (downsampled to 2x)
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)
rnd = np.random.default_rng(21)

wf.WATER_DEEP = np.array([0.36, 0.78, 0.66], np.float32)
wf.WATER_LIGHT = np.array([0.92, 1.0, 0.94], np.float32)


# --------------------------------------------------------------- foliage
def leaf(d, x, y, ang, L, Wd, c1, c2, veins=True):
    n = 22
    nx, ny = -math.sin(ang), math.cos(ang)
    ax, ay, lf, rt = [], [], [], []
    for i in range(n + 1):
        s = i / n
        hw = Wd * 0.5 * (math.sin(math.pi * s ** 0.85) ** 0.9)
        cx, cy = x + math.cos(ang) * L * s, y + math.sin(ang) * L * s
        ax.append((cx, cy))
        lf.append((cx + nx * hw, cy + ny * hw))
        rt.append((cx - nx * hw, cy - ny * hw))
    d.polygon(ax + lf[::-1], fill=c1)
    d.polygon(ax + rt[::-1], fill=c2)
    if veins and Wd > 14:
        vc = tuple(int(v * 0.78) for v in c2[:3]) + (255,)
        for i in range(2, n - 1, 2):
            for edge in (lf, rt):
                d.line([ax[i], (edge[i + 1][0], edge[i + 1][1])], fill=vc, width=max(1, int(Wd * 0.03)))
    rib = tuple(min(255, int(v * 1.35)) for v in c1[:3]) + (255,)
    d.line([ax[0], ax[-1]], fill=rib, width=max(2, int(Wd * 0.05)))


def frond(d, x, y, ang, L, curve, nleaf, c1, c2, leaflet=0.34):
    tan = lambda s: ang + curve * 1.6 * s
    pts = []
    px, py = x, y
    steps = 40
    for i in range(steps + 1):
        s = i / steps
        a = tan(s)
        if i:
            px += math.cos(a) * L / steps
            py += math.sin(a) * L / steps
        pts.append((px, py, a))
    d.line([(p[0], p[1]) for p in pts], fill=tuple(int(v * 0.8) for v in c2[:3]) + (255,), width=max(3, int(L * 0.014)))
    for k in range(nleaf):
        s = 0.1 + 0.9 * k / nleaf
        px, py, a = pts[int(s * steps)]
        ll = L * leaflet * (0.25 + 0.75 * math.sin(math.pi * min(1, s * 1.08)) ** 0.6)
        for sgn in (1, -1):
            la = a + sgn * (0.95 - 0.25 * s) + 0.22
            leaf(d, px, py, la, ll, ll * 0.20, c1, c2, veins=False)


def build_fg():
    im = Image.new("RGBA", (SW * SS, SH * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    def col(base, j=14):
        k = int(rnd.integers(-j, j + 1))
        return tuple(int(np.clip(v + k, 0, 255)) for v in base)
    c1b, c2b = (40, 138, 58, 255), (18, 78, 40, 255)
    P = SS
    # palm fronds from the top corners
    for ang, L, cu in ((0.95, 250, 0.35), (0.55, 225, 0.30), (1.28, 190, 0.28), (0.25, 170, 0.22)):
        frond(d, -14 * P, -14 * P, ang, L * 0.60 * P, cu, 16, col(c1b), col(c2b))
    for ang, L, cu in ((math.pi - 0.95, 250, -0.35), (math.pi - 0.55, 225, -0.30), (math.pi - 1.28, 190, -0.28), (math.pi - 0.25, 170, -0.22)):
        frond(d, (SW + 14) * P, -14 * P, ang, L * 0.60 * P, cu, 16, col(c1b), col(c2b))
    # ferns and big leaves from the bottom corners
    for ang, L, cu in ((-0.95, 215, -0.30), (-0.55, 190, -0.25), (-1.35, 170, -0.2)):
        frond(d, -12 * P, (SH + 12) * P, ang, L * 0.60 * P, cu, 14, col((52, 150, 66, 255)), col((20, 90, 46, 255)), 0.30)
    for ang, L, cu in ((math.pi + 0.95, 215, 0.30), (math.pi + 0.55, 190, 0.25), (math.pi + 1.35, 170, 0.2)):
        frond(d, (SW + 12) * P, (SH + 12) * P, ang, L * 0.60 * P, cu, 14, col((52, 150, 66, 255)), col((20, 90, 46, 255)), 0.30)
    leaf(d, -10 * P, 238 * P, -0.12, 78 * P, 48 * P, (46, 150, 62, 255), (20, 88, 44, 255))
    leaf(d, (SW + 10) * P, 250 * P, math.pi + 0.15, 78 * P, 46 * P, (46, 150, 62, 255), (20, 88, 44, 255))
    im = im.resize((W, H), Image.LANCZOS)
    a = np.asarray(im, np.float32) / 255
    rgb, al = a[..., :3], a[..., 3]
    # simple lighting on the leaves: lighter toward the top, darker low down
    ty = (YY / H)[..., None]
    rgb = np.clip(rgb * (1.15 - 0.45 * ty), 0, 1)
    return np.dstack([rgb * al[..., None], al]).astype(np.float32)  # premultiplied


FG = build_fg()
FGW = np.clip(np.minimum(np.minimum(XX, W - XX), np.minimum(YY, H - YY)) / (0.34 * H), 0, 1) ** 1.2


def fg_layer(t):
    ph = math.tau * t
    dx = 7 * S * np.sin(ph + YY * 0.012 + XX * 0.004) * FGW + 2 * S * np.sin(2 * ph + XX * 0.01) * FGW
    dy = 3 * S * np.sin(ph + XX * 0.009) * FGW
    out = np.stack([lg.bilinear(FG[..., k], XX - dx, YY - dy) for k in range(4)], -1)
    return out


def build_vines():
    im = Image.new("RGBA", (SW * SS, SH * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for x0 in (22, 66, 128, 176, 238, 292, 350, 378):
        L = int(rnd.integers(170, 320))
        a = rnd.uniform(5, 12); f = rnd.uniform(0.02, 0.045); p = rnd.uniform(0, 6)
        pts = [((x0 + a * math.sin(y * f + p)) * SS, y * SS) for y in range(-10, L, 4)]
        d.line(pts, fill=(14, 64, 32, 255), width=int(rnd.uniform(1.6, 3.2) * SS))
        for i in range(6, len(pts), int(rnd.integers(4, 8))):
            px, py = pts[i]
            sg = 1 if rnd.random() < 0.5 else -1
            leaf(d, px, py, sg * rnd.uniform(0.4, 1.2) + 1.2 * (sg < 0) * 0, rnd.uniform(16, 30) * SS, rnd.uniform(7, 13) * SS,
                 (30, 112, 48, 255), (14, 64, 34, 255), veins=False)
    im = im.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.4))
    return np.asarray(im, np.float32) / 255


def make_bg():
    n = (noise_layer(H, W, 36, 160, 1) * 0.5 + noise_layer(H, W, 14, 70, 2) * 0.3 + noise_layer(H, W, 5, 24, 3) * 0.2)
    moss_n = noise_layer(H, W, 22, 22, 7) * 0.6 + noise_layer(H, W, 7, 7, 8) * 0.4
    t = YY / H
    base = np.stack([6 + 10 * t, 24 + 30 * t, 14 + 16 * t], -1)
    col = base * (0.55 + 0.9 * n)[..., None]
    moss = np.clip((moss_n - 0.5) * 3.2, 0, 1)[..., None]
    col = col * (1 - 0.6 * moss) + np.array([44, 112, 36], np.float32) * (0.5 + 0.7 * n)[..., None] * 0.6 * moss
    vg = 1 - 0.5 * np.clip(((XX / W - 0.5) * 2) ** 2 * 0.8 + ((YY / H - 0.5) * 2) ** 2 * 0.5, 0, 1)
    col *= vg[..., None]
    col = np.clip(col / 255, 0, 1).astype(np.float32)
    v = build_vines()
    a = v[..., 3:4]
    col = col * (1 - a) + v[..., :3] * a
    return col


BG3 = make_bg()
BG3B = np.stack([gblur(BG3[..., k], 6.0) for k in range(3)], -1)

SX0, SY0 = 0.84 * W, -0.16 * H
ANG = np.arctan2(YY - SY0, XX - SX0)
DIST = np.hypot(XX - SX0, YY - SY0)
WINDOW = np.exp(-(((ANG - 2.05) / 0.70) ** 2)) * np.exp(-DIST / (1.1 * H))
RAYCOL = np.array([1.0, 0.95, 0.62], np.float32)


def rays(t):
    ph = math.tau * t
    p = 0.0
    for f, a, k, p0 in ((14, 0.5, 1, 0.9), (29, 0.3, -1, 2.4), (53, 0.2, 2, 5.0)):
        p = p + a * (0.5 + 0.5 * np.sin(f * ANG + p0 + k * ph)) ** 5
    return (p * WINDOW).astype(np.float32)


# digits: jade glass with moss on the top surfaces
mb_s = gblur(M2, 1.8)
gy_s, gx_s = np.gradient(mb_s)
gm_s = np.hypot(gx_s, gy_s) + 1e-6
mb_n = gblur(M2, 4.0)
gy_n, gx_n = np.gradient(mb_n)
gm_n = np.hypot(gx_n, gy_n) + 1e-6
NXg, NYg = -gx_n / gm_n, -gy_n / gm_n
DP = np.clip((gblur(M2, 7.0) - 0.5) * 2.4, 0, 1)
EDGE = (1 - DP) ** 2
LX, LY = 0.45, -0.89  # light from the upper right, matching the rays
LIT_S = np.clip(-(gx_s * LX + gy_s * LY) / gm_s, 0, 1) * np.clip(gm_s * 14, 0, 1)
LIT_B = np.clip(-(gx_n * LX + gy_n * LY) * 9, 0, 1)
DARK_B = np.clip((gx_n * LX + gy_n * LY) * 9, 0, 1)
TY = np.clip((YY - 60 * S) / (290 * S), 0, 1)
SHADOW = gblur(np.roll(np.roll(M2, 7 * S, axis=0), -3 * S, axis=1), 8)
top = np.clip(M2 - np.roll(M2, 12 * S, axis=0), 0, 1)
MOSS = np.clip(gblur(top, 3.0) * 1.6 * (0.35 + 1.1 * noise_layer(H, W, 6, 6, 31)) - 0.25, 0, 1)
MOSS = np.clip(MOSS * 1.4, 0, 1) * M2

tm = Image.new("L", (W, H), 0)
ft = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", 12 * S)
ft.set_variation_by_name("Semibold")
ImageDraw.Draw(tm).text((SW / 2 * S, 421 * S), "SAT  ·  24 OCT      72 BPM      8.2K", font=ft, fill=255, anchor="mm")
TXT = np.asarray(tm, np.float32) / 255

MOTES = [(rnd.uniform(0.08, 0.92) * W, rnd.uniform(0.1, 0.95) * H, rnd.uniform(14, 40) * S, rnd.integers(1, 3), rnd.uniform(0, 6.28),
          rnd.uniform(1.5, 3.6) * S, rnd.integers(1, 4)) for _ in range(46)]


def glass_digits(src, ray, t):
    bend = 24 * S
    chans = []
    for k, ch in enumerate((1.0, 1.10, 1.22)):
        chans.append(lg.bilinear(src[..., k], XX + NXg * bend * EDGE * ch, YY + NYg * bend * EDGE * ch))
    col = np.stack(chans, -1)
    lum = col @ np.array([0.299, 0.587, 0.114], np.float32)
    col = lum[..., None] + (col - lum[..., None]) * 1.3
    col = col * 0.80 + np.array([0.02, 0.11, 0.05], np.float32) + (0.04 + 0.09 * (1 - TY) + 0.07 * DP)[..., None]
    col *= (1 - 0.20 * DARK_B)[..., None]
    col += (ray * 0.55)[..., None] * RAYCOL * (0.4 + 0.6 * DP)[..., None]
    rim = LIT_S * 1.0 + 0.22 * np.clip(gm_s * 14, 0, 1)
    col += rim[..., None] * np.array([0.95, 1.0, 0.85], np.float32) * 0.9
    col += (LIT_B * 0.30)[..., None] * np.array([0.7, 1.0, 0.6], np.float32)
    col += (DARK_B * EDGE * 0.26)[..., None] * np.array([0.5, 0.95, 0.7], np.float32)
    u = (XX + YY) / (W + H)
    pos = -0.25 + 1.5 * (t % 1.0)
    col += (0.28 * np.exp(-(((u - pos) / 0.028) ** 2)) * (0.5 + 0.5 * (1 - DP)))[..., None]
    return np.clip(col, 0, 1)


def scene(t):
    ray = rays(t)
    base = BG3 + ray[..., None] * RAYCOL * 0.60
    src = BG3B + ray[..., None] * RAYCOL * 0.60
    base = base * (1 - 0.5 * SHADOW * (1 - M2))[..., None]
    g = glass_digits(src, ray, t)
    cv = base * (1 - M2[..., None]) + g * M2[..., None]
    # moss clinging to the top edges
    mcol = np.array([0.20, 0.52, 0.16], np.float32) * (0.75 + 0.5 * ray[..., None] * 0.0) + ray[..., None] * 0.18 * RAYCOL
    cv = cv * (1 - MOSS[..., None] * 0.92) + mcol * MOSS[..., None] * 0.92
    cv = cv * (1 - TXT[..., None] * 0.9) + np.array([0.86, 0.96, 0.84], np.float32) * (TXT * 0.9)[..., None]
    return cv.astype(np.float32), ray


def motes(cv, t):
    ph = math.tau * t
    for x0, y0, amp, k, p, r, k2 in MOTES:
        x = x0 + amp * math.sin(ph * k + p)
        y = y0 + amp * 0.8 * math.cos(ph * k2 + p * 1.3)
        a = 0.35 + 0.65 * (0.5 + 0.5 * math.sin(ph * (k + 1) + p * 2))
        R = int(r * 3)
        x0i, y0i = int(x), int(y)
        xa, xb, ya, yb = max(0, x0i - R), min(W, x0i + R), max(0, y0i - R), min(H, y0i + R)
        if xb <= xa or yb <= ya:
            continue
        d2 = (XX[ya:yb, xa:xb] - x) ** 2 + (YY[ya:yb, xa:xb] - y) ** 2
        g = a * 0.8 * np.exp(-d2 / (2 * (r * 0.55) ** 2))
        cv[ya:yb, xa:xb] += g[..., None] * np.array([1.0, 0.95, 0.55], np.float32)


def frame(sim, t):
    sc, ray = scene(t)
    wf.SCENE = sc
    out = wf.render(sim)
    out = out + (ray * 0.15)[..., None] * RAYCOL
    motes(out, t)
    f = fg_layer(t)
    out = out * (1 - f[..., 3:4]) + f[..., :3]
    # warm green grade
    out = out * np.array([0.97, 1.03, 0.94], np.float32)
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
