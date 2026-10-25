import math, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

S = 2
SW, SH = 390, 450
W, H = SW * S, SH * S
N = 80
FPS = 20
TAU = 2 * math.pi

Y, X = np.mgrid[0:H, 0:W].astype(np.float32)


def font(size, var="Light", rounded=False):
    p = "/System/Library/Fonts/SFNSRounded.ttf" if rounded else "/System/Library/Fonts/SFNS.ttf"
    f = ImageFont.truetype(p, int(round(size * S)))
    f.set_variation_by_name(var)
    return f


def blur(arr, r):
    """Gaussian blur of float array (H,W) or (H,W,3) in 0..1."""
    if arr.ndim == 2:
        im = Image.fromarray(np.clip(arr * 255, 0, 255).astype(np.uint8))
        return np.asarray(im.filter(ImageFilter.GaussianBlur(r)), np.float32) / 255
    im = Image.fromarray(np.clip(arr * 255, 0, 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r)), np.float32) / 255


def smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def bilinear(img, sx, sy):
    sx = np.clip(sx, 0, W - 1.001)
    sy = np.clip(sy, 0, H - 1.001)
    x0 = sx.astype(np.int32)
    y0 = sy.astype(np.int32)
    fx = sx - x0
    fy = sy - y0
    a = img[y0, x0]
    b = img[y0, x0 + 1]
    c = img[y0 + 1, x0]
    d = img[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def rr_sdf(px, py, cx, cy, hx, hy, r):
    qx = np.abs(px - cx) - hx + r
    qy = np.abs(py - cy) - hy + r
    return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r


# ---------------------------------------------------------------- background
ORBS = [
    (0.16, 0.14, 0.34, (0.10, 0.78, 0.98), 1.00, 0.0),
    (0.88, 0.30, 0.30, (0.58, 0.30, 1.00), 1.10, 1.7),
    (0.22, 0.80, 0.34, (1.00, 0.24, 0.56), 0.95, 3.4),
    (0.84, 0.90, 0.28, (1.00, 0.62, 0.20), 0.80, 5.0),
    (0.52, 0.50, 0.26, (0.22, 0.42, 1.00), 0.55, 2.4),
]


def background(t):
    ph = TAU * t
    lin = np.zeros((H, W, 3), np.float32) + np.array([0.012, 0.016, 0.045], np.float32)
    for cx, cy, r, col, amp, p0 in ORBS:
        ox = cx + 0.11 * math.cos(ph + p0)
        oy = cy + 0.07 * math.sin(ph + p0 * 1.3)
        sig = r * W
        d2 = (X - ox * W) ** 2 + (Y - oy * H) ** 2
        w = np.exp(-d2 / (2 * sig * sig))
        lin += w[..., None] * (np.array(col, np.float32) * amp)
    # flowing ribbons give the glass something to refract
    for y0, amp, f, ph0, wd, col, k in [
        (0.33, 0.10, 1.3, 0.4, 0.030, (0.65, 0.95, 1.0), 0.55),
        (0.66, 0.08, 1.0, 2.1, 0.026, (1.0, 0.72, 0.95), 0.50),
        (0.50, 0.12, 0.8, 4.0, 0.020, (0.8, 0.8, 1.0), 0.35),
    ]:
        yc = (y0 + amp * np.sin(X / W * TAU * f + ph + ph0)) * H
        band = np.exp(-(((Y - yc) / (wd * H)) ** 2))
        band *= 0.55 + 0.45 * np.sin(X / W * 4.0 + ph * 2 + ph0)
        lin += band[..., None] * np.array(col, np.float32) * k
    img = 1 - np.exp(-lin * 1.05)
    # gentle vignette
    vx = (X / W - 0.5) * 2
    vy = (Y / H - 0.5) * 2
    img *= (1 - 0.28 * np.clip(vx * vx + vy * vy - 0.3, 0, 1.2))[..., None]
    return img.astype(np.float32)


# --------------------------------------------------------------------- glass
def glass(cv, bg, t, cx, cy, hx, hy, r, bend=20, ew=12, mag=0.96, phase=0.0, lift=1.0, light=None):
    cx, cy, hx, hy, r = [v * S for v in (cx, cy, hx, hy, r)]
    m = 44 * S
    X0 = int(max(0, cx - hx - m)); X1 = int(min(W, cx + hx + m))
    Y0 = int(max(0, cy - hy - m)); Y1 = int(min(H, cy + hy + m))
    px = X[Y0:Y1, X0:X1]
    py = Y[Y0:Y1, X0:X1]
    sdf = rr_sdf(px, py, cx, cy, hx, hy, r)
    gy, gx = np.gradient(sdf)
    nn = np.hypot(gx, gy) + 1e-6
    nx, ny = gx / nn, gy / nn
    depth = np.clip(-sdf, 0, None)
    inside = np.clip(0.5 - sdf, 0, 1)

    reg = cv[Y0:Y1, X0:X1]
    # soft drop shadow
    sh = blur(inside, 9 * S / 2)
    sh = np.roll(sh, 7 * S, axis=0)
    reg *= (1 - 0.42 * sh * (1 - inside))[..., None]

    # refracted + chromatically split backdrop
    lens = bend * S * np.exp(-depth / (ew * S))
    chans = []
    for k, ch in enumerate((1.0, 1.08, 1.17)):
        sx = px + nx * lens * ch
        sy = py + ny * lens * ch
        sx = cx + (sx - cx) * mag
        sy = cy + (sy - cy) * mag
        chans.append(bilinear(bg[..., k], sx, sy))
    col = np.stack(chans, -1)
    lum = col @ np.array([0.299, 0.587, 0.114], np.float32)
    col = lum[..., None] + (col - lum[..., None]) * 1.35
    ty = np.clip((py - (cy - hy)) / (2 * hy), 0, 1)
    col = col * 0.90 + ((0.045 + 0.085 * (1 - ty)) * lift)[..., None]

    # subtle inner shading just inside the rim for volume
    band = np.exp(-((depth - 9 * S) ** 2) / (2 * (5 * S) ** 2))
    col *= (1 - 0.12 * band)[..., None]

    # rim light: key light + faint counter light
    if light is None:
        light = -2.35 + 0.8 * math.sin(TAU * t)
    lx, ly = math.cos(light), math.sin(light)
    ndl = nx * lx + ny * ly
    rim = np.exp(-depth / (1.1 * S)) * (
        1.05 * np.clip(ndl, 0, 1) ** 2 + 0.55 * np.clip(-ndl, 0, 1) ** 2 + 0.20
    )
    glow = np.exp(-depth / (9 * S)) * (0.17 * np.clip(ndl, 0, 1) + 0.035)
    col += (rim + glow)[..., None]

    # specular blob + travelling glint
    blob = 0.10 * np.exp(-(((px - (cx - hx * 0.45)) / (hx * 0.9)) ** 2 + ((py - (cy - hy * 0.62)) / (hy * 0.45)) ** 2))
    u = ((px - (cx - hx)) / (2 * hx) + (py - (cy - hy)) / (2 * hy)) / 2
    pos = -0.35 + 1.7 * ((t + phase) % 1.0)
    glint = 0.11 * np.exp(-(((u - pos) / 0.065) ** 2))
    col += (blob + glint)[..., None]

    out = reg * (1 - inside)[..., None] + np.clip(col, 0, 1) * inside[..., None]
    cv[Y0:Y1, X0:X1] = out


# ---------------------------------------------------------------------- text
def text(cv, s, x, y, f, alpha=1.0, top=(255, 255, 255), bot=(255, 255, 255), shadow=0.0, track=0.0, anchor="mm"):
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    if track:
        adv = [f.getlength(c) + track * S for c in s]
        total = sum(adv) - track * S
        cxp = x * S - total / 2
        for c, a in zip(s, adv):
            d.text((cxp, y * S), c, font=f, fill=255, anchor="lm")
            cxp += a
    else:
        d.text((x * S, y * S), s, font=f, fill=255, anchor=anchor)
    bb = m.getbbox()
    if bb is None:
        return
    x0, y0, x1, y1 = bb
    pad = 24 * S
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad); x1 = min(W, x1 + pad); y1 = min(H, y1 + pad)
    mk = np.asarray(m, np.float32)[y0:y1, x0:x1] / 255
    reg = cv[y0:y1, x0:x1]
    if shadow:
        sm = blur(np.roll(mk, 3 * S, axis=0), 5 * S / 2)
        reg *= (1 - shadow * sm * (1 - mk))[..., None]
    ty = np.clip((np.arange(y0, y1, dtype=np.float32) - bb[1]) / max(1, bb[3] - bb[1]), 0, 1)[:, None, None]
    c = (np.array(top, np.float32) * (1 - ty) + np.array(bot, np.float32) * ty) / 255
    a = (mk * alpha)[..., None]
    cv[y0:y1, x0:x1] = reg * (1 - a) + c * a


# --------------------------------------------------------------------- rings
def ring(cv, cx, cy, R, w, p, c1, c2, glow=0.6, track=0.13):
    cx, cy, R, w = cx * S, cy * S, R * S, w * S
    m = int(R + w + 20 * S)
    X0 = int(cx) - m; X1 = int(cx) + m; Y0 = int(cy) - m; Y1 = int(cy) + m
    px = X[Y0:Y1, X0:X1]; py = Y[Y0:Y1, X0:X1]
    dx = px - cx; dy = py - cy
    rr = np.hypot(dx, dy)
    frac = (np.arctan2(dx, -dy) % TAU) / TAU
    band = np.clip(w / 2 - np.abs(rr - R) + 0.5, 0, 1)
    reg = cv[Y0:Y1, X0:X1]
    reg += (band * track)[..., None]
    if p > 0.004:
        arc = band * (frac <= p)
        th = TAU * p
        ex, ey = cx + R * math.sin(th), cy - R * math.cos(th)
        cap1 = np.clip(w / 2 - np.hypot(px - cx, py - (cy - R)) + 0.5, 0, 1)
        cap2 = np.clip(w / 2 - np.hypot(px - ex, py - ey) + 0.5, 0, 1)
        mk = np.maximum(arc, np.maximum(cap1, cap2))
        g = np.clip(frac / max(p, 1e-3), 0, 1)
        if p < 0.995:
            g = np.where(frac > p, 1.0, g)
        c = np.array(c1, np.float32) * (1 - g[..., None]) + np.array(c2, np.float32) * g[..., None]
        c = c / 255
        gl = blur(mk, 5 * S)
        reg += gl[..., None] * c * glow
        reg[:] = reg * (1 - mk[..., None]) + (c * 0.9 + 0.10) * mk[..., None]
    np.clip(reg, 0, 1, out=reg)


# ------------------------------------------------------------ perimeter bead
def perimeter(inset=13, R=51):
    x0, y0, x1, y1 = inset, inset, SW - inset, SH - inset
    pts = []
    def arc(cx, cy, a0, a1, n=60):
        for i in range(n):
            a = a0 + (a1 - a0) * i / n
            pts.append((cx + R * math.cos(a), cy + R * math.sin(a)))
    def line(ax, ay, bx, by, n=100):
        for i in range(n):
            pts.append((ax + (bx - ax) * i / n, ay + (by - ay) * i / n))
    line(SW / 2, y0, x1 - R, y0)
    arc(x1 - R, y0 + R, -math.pi / 2, 0)
    line(x1, y0 + R, x1, y1 - R)
    arc(x1 - R, y1 - R, 0, math.pi / 2)
    line(x1 - R, y1, x0 + R, y1)
    arc(x0 + R, y1 - R, math.pi / 2, math.pi)
    line(x0, y1 - R, x0, y0 + R)
    arc(x0 + R, y0 + R, math.pi, 1.5 * math.pi)
    line(x0 + R, y0, SW / 2, y0)
    pts = np.array(pts)
    seg = np.hypot(*np.diff(pts, axis=0, append=pts[:1]).T)
    cum = np.concatenate([[0], np.cumsum(seg)])
    return pts, cum


PER_PTS, PER_CUM = perimeter()


def per_at(s):
    s = (s % 1.0) * PER_CUM[-1]
    i = int(np.searchsorted(PER_CUM, s) - 1)
    i = max(0, min(i, len(PER_PTS) - 1))
    return PER_PTS[i]


def soft_dot(cv, x, y, rad, a):
    x, y, rad = x * S, y * S, rad * S
    m = int(rad * 4)
    X0 = max(0, int(x) - m); X1 = min(W, int(x) + m); Y0 = max(0, int(y) - m); Y1 = min(H, int(y) + m)
    d2 = (X[Y0:Y1, X0:X1] - x) ** 2 + (Y[Y0:Y1, X0:X1] - y) ** 2
    cv[Y0:Y1, X0:X1] += (a * np.exp(-d2 / (2 * rad * rad)))[..., None]


# --------------------------------------------------------------------- scene
F_TIME = font(122, "Thin")
F_DATE = font(12.5, "Semibold")
F_VAL = font(21, "Medium", rounded=True)
F_LAB = font(8.5, "Bold")
F_WX = font(14, "Medium")


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return 1 - (1 - x) ** 3


def prog(u, target, delay=0.0):
    a = ease((u - 0.03 - delay) / 0.38)
    b = 1 - ease((u - 0.93) / 0.07)
    return target * a * b, a * b


def frame(k):
    t = k / N
    u = (t + 0.32) % 1.0
    bg = background(t)
    bgb = blur(bg, 3 * S)
    cv = bg.copy()

    # hairline track for the seconds bead
    sd = rr_sdf(X, Y, W / 2, H / 2, (SW / 2 - 13) * S, (SH / 2 - 13) * S, 51 * S)
    cv += (np.clip(0.6 * S - np.abs(sd) + 0.5, 0, 1) * 0.10)[..., None]

    # ---- glass layers
    glass(cv, bgb, t, 195, 45, 68, 15.5, 15.5, bend=9, ew=6, phase=0.10)
    glass(cv, bgb, t, 195, 172, 163, 82, 46, bend=26, ew=14, phase=0.00)
    for i, x in enumerate((70, 195, 320)):
        glass(cv, bgb, t, x, 332, 48, 48, 48, bend=20, ew=12, phase=0.2 + 0.12 * i)
    glass(cv, bgb, t, 195, 413, 78, 17.5, 17.5, bend=9, ew=6, phase=0.55)

    # ---- date
    text(cv, "SAT  ·  24 OCT", 195, 45, F_DATE, alpha=0.92, track=1.7, shadow=0.0)

    # ---- time
    blink = 0.55 + 0.45 * math.cos(TAU * t * 4) ** 2
    parts = [("10", 1.0), (":", blink), ("24", 1.0)]
    widths = [F_TIME.getlength(s) for s, _ in parts]
    total = sum(widths) / S
    x = 195 - total / 2
    base_y = 172 + 41
    for (s, a), wd in zip(parts, widths):
        yy = base_y - (7 if s == ":" else 0)
        text(cv, s, x, yy, F_TIME, alpha=a, top=(255, 255, 255), bot=(214, 228, 255), shadow=0.33, anchor="ls")
        x += wd / S

    # ---- complications
    steps_p, steps_a = prog(u, 0.82, 0.00)
    heart_p, heart_a = prog(u, 0.68, 0.05)
    batt_p, batt_a = prog(u, 0.86, 0.10)
    pulse = 0.55 + 0.45 * math.cos(TAU * t * 5) ** 6
    ring(cv, 70, 332, 40.5, 5.2, steps_p, (70, 255, 200), (120, 200, 255), glow=0.55)
    ring(cv, 195, 332, 40.5, 5.2, heart_p, (255, 120, 150), (255, 70, 110), glow=0.35 + 0.5 * pulse)
    ring(cv, 320, 332, 40.5, 5.2, batt_p, (255, 226, 90), (255, 170, 60), glow=0.55)

    text(cv, f"{8240 * steps_a / 1000:.1f}k", 70, 328, F_VAL, alpha=0.97, shadow=0.0)
    text(cv, "STEPS", 70, 348, F_LAB, alpha=0.70, track=1.2)
    text(cv, f"{int(round(72 * (0.4 + 0.6 * heart_a)))}", 195, 328, F_VAL, alpha=0.97)
    text(cv, "BPM", 195, 348, F_LAB, alpha=0.70, track=1.2)
    text(cv, f"{int(round(86 * batt_a))}%", 320, 328, F_VAL, alpha=0.97)
    text(cv, "BATT", 320, 348, F_LAB, alpha=0.70, track=1.2)

    # ---- weather pill: little sun + text
    sx, sy = 143, 413
    soft_dot(cv, sx, sy, 3.6, 0.0)
    sun = Image.new("L", (W, H), 0)
    sd_ = ImageDraw.Draw(sun)
    sd_.ellipse([(sx - 4.6) * S, (sy - 4.6) * S, (sx + 4.6) * S, (sy + 4.6) * S], fill=255)
    for i in range(8):
        a = i * math.pi / 4
        sd_.line([(sx + 7.0 * math.cos(a)) * S, (sy + 7.0 * math.sin(a)) * S,
                  (sx + 9.4 * math.cos(a)) * S, (sy + 9.4 * math.sin(a)) * S], fill=255, width=int(1.6 * S))
    sm = np.asarray(sun, np.float32) / 255
    sc = np.array([1.0, 0.86, 0.45], np.float32)
    g = blur(sm, 3 * S)
    cv += g[..., None] * sc * 0.35
    cv[:] = cv * (1 - sm[..., None]) + sc * sm[..., None]
    text(cv, "Clear  ·  18°", 205, 413, F_WX, alpha=0.95)

    # ---- seconds bead with a fading comet tail
    s = (t + 0.0) % 1.0
    for j in range(26, 0, -1):
        x, y = per_at(s - j * 0.0035)
        soft_dot(cv, x, y, 1.9, 0.30 * (1 - j / 27) ** 1.6)
    bx, by = per_at(s)
    soft_dot(cv, bx, by, 8, 0.10)
    glass(cv, bgb, t, bx, by, 8.5, 8.5, 8.5, bend=6, ew=4, phase=0.0, lift=1.6)

    return np.clip(cv, 0, 1)


# ------------------------------------------------------------------ assembly
CW, CH = 450, 520
OX, OY = 30, 35


def rounded_mask(w, h, r, scale=4):
    im = Image.new("L", (w * scale, h * scale), 0)
    ImageDraw.Draw(im).rounded_rectangle([0, 0, w * scale - 1, h * scale - 1], r * scale, fill=255)
    return im.resize((w, h), Image.LANCZOS)


def make_case():
    gy, gx = np.mgrid[0:CH, 0:CW].astype(np.float32)
    base = np.zeros((CH, CW, 3), np.float32) + np.array([7, 7, 10], np.float32)
    rad = np.hypot(gx - CW / 2, gy - CH / 2) / 330
    base *= (1.35 - 0.7 * np.clip(rad, 0, 1))[..., None]
    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
    # straps
    strap = Image.new("RGB", (CW, CH), (0, 0, 0))
    ImageDraw.Draw(strap).rectangle([112, 0, CW - 112, CH], fill=(24, 25, 30))
    fade = np.abs(gy - CH / 2) / (CH / 2)
    sm = np.clip((fade - 0.78) / 0.22, 0, 1) ** 0.8
    sm_im = Image.fromarray((sm * 255).astype(np.uint8))
    cm = Image.new("L", (CW, CH), 0)
    ImageDraw.Draw(cm).rectangle([112, 0, CW - 112, CH], fill=255)
    cmask = Image.fromarray((np.asarray(cm, np.float32) * sm).astype(np.uint8))
    img.paste(strap, (0, 0), cmask)
    # case body
    cw, ch = SW + 2 * (OX - 8), SH + 2 * (OY - 8)
    body = Image.new("RGB", (cw, ch))
    bx, by = np.mgrid[0:ch, 0:cw].astype(np.float32)
    t = (bx / ch * 0.6 + by / cw * 0.4)
    c = np.stack([70 - 48 * t, 72 - 48 * t, 82 - 52 * t], -1)
    body = Image.fromarray(np.clip(c, 0, 255).astype(np.uint8))
    img.paste(body, (8, 8), rounded_mask(cw, ch, 96))
    # bezel (black glass)
    bw, bh = SW + 2 * 14, SH + 2 * 14
    bz = Image.new("RGB", (bw, bh), (3, 3, 4))
    img.paste(bz, (OX - 14 + 0, OY - 14 + 0), rounded_mask(bw, bh, 78))
    return img


CASE = make_case()
SCREEN_MASK = rounded_mask(SW, SH, 64)


def compose(cv, seed=0):
    rng = np.random.default_rng(seed)
    a = np.clip(cv * 255 + rng.normal(0, 1.1, cv.shape), 0, 255).astype(np.uint8)
    scr = Image.fromarray(a).resize((SW, SH), Image.LANCZOS)
    out = CASE.copy()
    out.paste(scr, (OX, OY), SCREEN_MASK)
    return out


if __name__ == "__main__":
    mode = sys.argv[1]
    out = sys.argv[2]
    if mode == "still":
        k = int(sys.argv[3])
        compose(frame(k)).save(out)
    else:
        frames = []
        for k in range(N):
            frames.append(compose(frame(k), k))
            print(k, end=" ", flush=True)
        frames[0].save(out + "_f0.png")
        # global palette from a mosaic of sample frames for stable colours
        sample = [frames[i] for i in range(0, N, 10)]
        mos = Image.new("RGB", (CW * 4, CH * 2))
        for i, f in enumerate(sample[:8]):
            mos.paste(f, ((i % 4) * CW, (i // 4) * CH))
        pal = mos.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        q = [f.quantize(palette=pal, dither=Image.Dither.FLOYDSTEINBERG) for f in frames]
        q[0].save(out, save_all=True, append_images=q[1:], duration=int(1000 / FPS), loop=0, optimize=False, disposal=1)
        print("saved")
