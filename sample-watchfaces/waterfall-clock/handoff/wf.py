import math, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import lg

S = 2
SW, SH = 390, 450
W, H = SW * S, SH * S
FPS = 25
LOOP = 75
XFADE = 16
WARM = 140
rng = np.random.default_rng(11)


def gblur(a, sig):
    r = max(1, int(3 * sig))
    k = np.exp(-(np.arange(-r, r + 1) ** 2) / (2 * sig * sig)).astype(np.float32)
    k /= k.sum()
    p = np.pad(a, ((0, 0), (r, r)), mode="edge")
    a1 = sum(k[i] * p[:, i:i + a.shape[1]] for i in range(2 * r + 1))
    p = np.pad(a1, ((r, r), (0, 0)), mode="edge")
    return sum(k[i] * p[i:i + a.shape[0], :] for i in range(2 * r + 1)).astype(np.float32)


def noise_layer(h, w, sx, sy, seed):
    r = np.random.default_rng(seed)
    small = r.random((max(2, int(h / sy)), max(2, int(w / sx)))).astype(np.float32)
    im = Image.fromarray((small * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return np.asarray(im, np.float32) / 255


# ------------------------------------------------------------------ clock
def digit_mask():
    f = ImageFont.truetype("/System/Library/Fonts/SFNSRounded.ttf", 188 * S)
    f.set_variation_by_name("Heavy")
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    d.text((SW / 2 * S, 62 * S), "10", font=f, fill=255, anchor="mt")
    d.text((SW / 2 * S, 222 * S), "24", font=f, fill=255, anchor="mt")
    return m


MASK2 = digit_mask()
M2 = np.asarray(MASK2, np.float32) / 255
M1 = np.asarray(MASK2.resize((SW, SH), Image.LANCZOS), np.float32) / 255
Mb = gblur(M1, 3.0)
gy1, gx1 = np.gradient(Mb)
gm = np.hypot(gx1, gy1)
NX = np.where(gm > 1e-4, -gx1 / (gm + 1e-9), 0).astype(np.float32)
NY = np.where(gm > 1e-4, -gy1 / (gm + 1e-9), -1).astype(np.float32)
SOLID = M1 > 0.5

# ------------------------------------------------------------- background
def make_bg():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    n = (noise_layer(H, W, 36, 160, 1) * 0.5 + noise_layer(H, W, 14, 70, 2) * 0.3 + noise_layer(H, W, 5, 24, 3) * 0.2)
    t = yy / H
    base = np.stack([6 + 8 * t, 20 + 28 * t, 28 + 30 * t], -1)
    rock = (0.55 + 0.9 * n)[..., None]
    col = base * rock
    # moss tint on high-noise areas
    col[..., 1] += 18 * np.clip(n - 0.5, 0, 1)[..., None][..., 0]
    vig = 1 - 0.5 * np.clip(((xx / W - 0.5) * 2) ** 2 * 0.8 + ((yy / H - 0.5) * 2) ** 2 * 0.5, 0, 1)
    col *= vig[..., None]
    # cool light bloom from the top where the water spills
    top = np.exp(-((yy / H) / 0.25) ** 2) * 14
    col += np.array([0.3, 0.8, 1.0], np.float32) * top[..., None]
    return np.clip(col / 255, 0, 1).astype(np.float32)


BG = make_bg()


def digits_layer():
    """Returns RGB image of the dark glossy digits (premultiplied by mask) as float."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    ty = np.clip((yy - 60 * S) / (290 * S), 0, 1)
    base = np.stack([46 - 28 * ty, 60 - 38 * ty, 72 - 44 * ty], -1) / 255
    mb = gblur(M2, 4.0)
    gy, gx = np.gradient(mb)
    lx, ly = -0.45, -0.89
    lit = np.clip(-(gx * lx + gy * ly) * 9, 0, 1)
    dark = np.clip((gx * lx + gy * ly) * 9, 0, 1)
    rimtop = np.clip(M2 - np.roll(M2, 5 * S, axis=0), 0, 1)
    rimtop = gblur(rimtop, 1.4)
    col = base + lit[..., None] * np.array([0.45, 0.7, 0.8]) + rimtop[..., None] * np.array([0.5, 0.8, 0.9])
    col -= dark[..., None] * 0.06
    # inner glossy sheen
    sheen = 0.10 * np.exp(-(((xx - 130 * S) / (90 * S)) ** 2 + ((yy - 110 * S) / (50 * S)) ** 2))
    col += sheen[..., None] * np.array([0.5, 0.8, 1.0])
    return np.clip(col, 0, 1).astype(np.float32)


DIG = digits_layer()


def static_scene():
    cv = BG.copy()
    # soft shadow behind digits
    sh = gblur(np.roll(np.roll(M2, 6 * S, axis=0), 3 * S, axis=1), 7)
    cv *= (1 - 0.55 * sh * (1 - M2))[..., None]
    cv = cv * (1 - M2[..., None]) + DIG * M2[..., None]
    img = Image.fromarray((np.clip(cv, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", 12 * S)
    f.set_variation_by_name("Semibold")
    d.text((SW / 2 * S, 421 * S), "SAT  ·  24 OCT      72 BPM      8.2K", font=f, fill=(210, 232, 240), anchor="mm")
    return np.asarray(img, np.float32) / 255


SCENE = static_scene()


# --------------------------------------------------------------- particles
class Sim:
    def __init__(self):
        self.x = np.zeros(0, np.float32); self.y = np.zeros(0, np.float32)
        self.vx = np.zeros(0, np.float32); self.vy = np.zeros(0, np.float32)
        self.kind = np.zeros(0, np.int8); self.life = np.zeros(0, np.float32)
        self.t = 0
        self.impacts = []

    def add(self, x, y, vx, vy, kind, life):
        self.x = np.concatenate([self.x, x.astype(np.float32)])
        self.y = np.concatenate([self.y, y.astype(np.float32)])
        self.vx = np.concatenate([self.vx, vx.astype(np.float32)])
        self.vy = np.concatenate([self.vy, vy.astype(np.float32)])
        self.kind = np.concatenate([self.kind, np.full(len(x), kind, np.int8)])
        self.life = np.concatenate([self.life, life.astype(np.float32)])

    def emit(self):
        n = 460
        centers = np.linspace(18, 372, 12) + 6 * np.sin(self.t * 0.07 + np.arange(12) * 1.7)
        widths = np.array([14, 18, 12, 20, 15, 18, 13, 19, 14, 17, 12, 15])
        k = rng.integers(0, len(centers), n)
        x = centers[k] + rng.normal(0, 1, n) * widths[k] * 0.6
        # thin out the stream with a slow pulse so it reads as flowing water
        keep = rng.random(n) < (0.78 + 0.22 * np.sin(self.t * 0.2 + k * 2.1))
        x = x[keep]
        m = len(x)
        self.add(x, rng.uniform(-14, 0, m), rng.normal(0, 0.12, m), rng.uniform(5.5, 8.5, m), 0, np.full(m, 160))

    def step(self):
        self.t += 1
        self.emit()
        self.impacts = []
        for _ in range(2):
            dt = 0.5
            self.vy += 0.62 * dt * (1 + 0.0 * self.kind)
            self.x += self.vx * dt
            self.y += self.vy * dt
            self.life -= dt
            ix = np.clip(self.x.astype(int), 0, SW - 1)
            iy = np.clip(self.y.astype(int), 0, SH - 1)
            inb = (self.y >= 0) & (self.y < SH) & (self.x >= 0) & (self.x < SW)
            hit = inb & SOLID[iy, ix]
            if hit.any():
                h = np.where(hit)[0]
                nx = NX[iy[h], ix[h]]; ny = NY[iy[h], ix[h]]
                vx, vy = self.vx[h], self.vy[h]
                vn = vx * nx + vy * ny
                imp = np.clip(-vn, 0, None)
                e = np.where(self.kind[h] == 0, 0.22, 0.35)
                # reflect the normal part, keep most of the tangential part
                self.vx[h] = vx - (1 + e) * np.minimum(vn, 0) * nx
                self.vy[h] = vy - (1 + e) * np.minimum(vn, 0) * ny
                tx, ty = -ny, nx
                flip = (ty < 0) | ((np.abs(ty) < 0.25) & (self.vx[h] < 0) & (tx > 0)) | ((np.abs(ty) < 0.25) & (self.vx[h] >= 0) & (tx < 0))
                tx = np.where(flip, -tx, tx); ty = np.where(flip, -ty, ty)
                slide = 0.5 + 0.6 * rng.random(len(h))
                self.vx[h] = self.vx[h] * 0.93 + tx * slide + rng.normal(0, 0.35, len(h)) * (1 + imp * 0.1)
                self.vy[h] = self.vy[h] * 0.93 + ty * slide * 0.7
                self.x[h] += nx * 1.6
                self.y[h] += ny * 1.6
                # splashes: droplets thrown up and outward
                big = imp > 2.2
                sp = h[big & (rng.random(len(h)) < 0.16)]
                if len(sp):
                    for _k in range(2):
                        ixs = np.clip(self.x[sp].astype(int), 0, SW - 1); iys = np.clip(self.y[sp].astype(int), 0, SH - 1)
                        snx = NX[iys, ixs]; sny = NY[iys, ixs]
                        im = np.clip(-(self.vx[sp] * 0 + 1) * 0 + 4.0 + imp[np.isin(h, sp)] * 0.35, 0, 9)
                        ang = rng.normal(0, 0.55, len(sp))
                        ca, sa = np.cos(ang), np.sin(ang)
                        dx = snx * ca - sny * sa
                        dy = snx * sa + sny * ca
                        spd = im * rng.uniform(0.45, 1.0, len(sp))
                        self.add(self.x[sp] + dx * 2, self.y[sp] + dy * 2, dx * spd + rng.normal(0, 0.4, len(sp)),
                                 dy * spd - rng.uniform(0.2, 1.2, len(sp)), 1, rng.uniform(14, 34, len(sp)))
                    self.impacts += list(zip(self.x[sp], self.y[sp], imp[np.isin(h, sp)]))
                # slow particles sitting on a surface slowly soak in
                self.life[h] -= 2.2
                slow = (self.vx[h] ** 2 + self.vy[h] ** 2) < 0.5
                kill = h[slow & (rng.random(len(h)) < 0.3)]
                self.life[kill] = -1
            # light air drag for droplets
            dm = self.kind == 1
            self.vx[dm] *= 0.985
        alive = (self.life > 0) & (self.y < SH + 20) & (self.x > -20) & (self.x < SW + 20)
        for a in ("x", "y", "vx", "vy", "kind", "life"):
            setattr(self, a, getattr(self, a)[alive])
        # cap the pool
        if len(self.x) > 24000:
            idx = rng.choice(len(self.x), 24000, replace=False)
            for a in ("x", "y", "vx", "vy", "kind", "life"):
                setattr(self, a, getattr(self, a)[idx])


# ---------------------------------------------------------------- render
FOAM = np.zeros((H, W), np.float32)
WATER_DEEP = np.array([0.42, 0.72, 0.88], np.float32)
WATER_LIGHT = np.array([0.95, 1.0, 1.0], np.float32)


def splat_all(xs, ys, ws):
    idx = []
    wt = []
    x0 = np.floor(xs).astype(np.int32); y0 = np.floor(ys).astype(np.int32)
    fx = xs - x0; fy = ys - y0
    for dx, dy, ww in ((0, 0, (1 - fx) * (1 - fy)), (1, 0, fx * (1 - fy)), (0, 1, (1 - fx) * fy), (1, 1, fx * fy)):
        xi = x0 + dx; yi = y0 + dy
        ok = (xi >= 0) & (xi < W) & (yi >= 0) & (yi < H)
        idx.append((yi[ok] * W + xi[ok])); wt.append((ws * ww)[ok])
    return np.bincount(np.concatenate(idx), weights=np.concatenate(wt), minlength=W * H).reshape(H, W).astype(np.float32)


def render(sim):
    global FOAM
    x, y, vx, vy, kind = sim.x * S, sim.y * S, sim.vx * S, sim.vy * S, sim.kind
    xs, ys, ws = [], [], []
    for j in range(11):
        f = j * 0.30
        xs.append(x - vx * f * 0.5); ys.append(y - vy * f * 0.5)
        ws.append(np.where(kind == 0, 1.5, 0.35) * (1 - j * 0.05))
    D = splat_all(np.concatenate(xs), np.concatenate(ys), np.concatenate(ws))
    Dd = splat_all(x[kind == 1], y[kind == 1], np.ones((kind == 1).sum(), np.float32))
    Ds = gblur(D, 2.1)
    alpha = 1 - np.exp(-Ds * 0.8)
    # impacts feed the foam buffer
    FOAM *= 0.80
    if sim.impacts:
        a = np.array(sim.impacts, np.float32)
        FOAM += gblur(splat_all(a[:, 0] * S, a[:, 1] * S, np.clip(a[:, 2], 0, 8) * 0.9), 5) * 6
    foam = np.clip(FOAM, 0, 1)
    # surface normal of the water body for sparkle
    Db = gblur(D, 5.0)
    gy, gx = np.gradient(Db)
    spec = np.clip(-(gx * -0.45 + gy * -0.89) * 2.2, 0, 1) ** 1.3
    depth = np.clip(Db * 0.35, 0, 1)
    deep = WATER_DEEP
    light = WATER_LIGHT
    wc = deep * (1 - depth[..., None]) + light * depth[..., None] * 0.9
    wc = wc + spec[..., None] * 0.55 + foam[..., None] * 0.55
    a = np.clip(alpha * 0.92 + foam * 0.55 * alpha + Dd * 0.0, 0, 1)
    cv = SCENE * (1 - a[..., None]) + np.clip(wc, 0, 1) * a[..., None]
    # sparse droplets read as bright specks
    dd = gblur(Dd, 1.0)
    cv += (np.clip(dd * 1.1, 0, 1) * 0.65)[..., None] * np.array([0.8, 0.95, 1.0], np.float32)
    # mist drifting off the splash zone
    mist = np.asarray(Image.fromarray((np.clip(Dd * 40, 0, 255)).astype(np.uint8)).resize((W // 4, H // 4), Image.BILINEAR), np.float32) / 255
    mist = gblur(mist, 6.0)
    mist = np.asarray(Image.fromarray((np.clip(mist, 0, 1) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), np.float32) / 255
    cv += (mist * 0.9)[..., None] * np.array([0.55, 0.75, 0.85], np.float32)
    return np.clip(cv, 0, 1)


def run(out, n_still=None):
    sim = Sim()
    for _ in range(WARM):
        sim.step()
        FOAM[:] = FOAM * 0.8
    frames = []
    total = LOOP + XFADE
    for i in range(total):
        sim.step()
        frames.append(render(sim))
        print(i, len(sim.x), round(float(frames[-1].mean()),3), end=" | ", flush=True)
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
