#!/usr/bin/env python3
"""Coca-Cola animated face for Amazfit Bip 6 — asset generator.

Draws every picture the face uses:
  bg.png        red gradient background with a soft top highlight
  logo.png      the Coca-Cola script logo, white (from the Wikimedia SVG)
  wave_XX.png   the white ribbon along the bottom, 16 frames of a travelling wave
  bub_XX.png    24 frames of rising bubbles (seamless loop)
"""
import math, os, random, subprocess, sys, re
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, 'assets')
os.makedirs(A, exist_ok=True)
W, H = 390, 450          # Bip 6
SS = 3                   # supersample factor for shapes

COKE_RED = (230, 26, 43)
DEEP_RED = (150, 0, 12)


def save(img, name):
    p = os.path.join(A, name)
    img.save(p, 'PNG', optimize=True)
    return p


# ---------------------------------------------------------------- background --
def background():
    img = Image.new('RGB', (W, H))
    top, bottom = (238, 0, 20), (158, 0, 10)
    for y in range(H):
        t = y / (H - 1)
        # ease so the top stays bright and the bottom falls away
        k = t ** 1.25
        c = tuple(round(top[i] + (bottom[i] - top[i]) * k) for i in range(3))
        ImageDraw.Draw(img).line([(0, y), (W, y)], fill=c)
    # soft light from the top centre, like the gloss of a cold bottle
    glow = Image.new('L', (W, H), 0)
    g = ImageDraw.Draw(glow)
    for i in range(60, 0, -1):
        r = i * 5
        a = int(2.2 * (60 - i) / 60 * 8)
        g.ellipse([W // 2 - r, -150 - r // 3, W // 2 + r, 200 + r // 3], fill=a)
    glow = glow.filter(ImageFilter.GaussianBlur(40))
    white = Image.new('RGB', (W, H), (255, 255, 255))
    img = Image.composite(white, img, glow.point(lambda v: min(70, v)))
    # gentle vignette in the corners
    mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask).ellipse([-W * 0.45, -H * 0.35, W * 1.45, H * 1.35], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(90))
    dark = Image.new('RGB', (W, H), (120, 0, 8))
    img = Image.composite(img, dark, mask)
    save(img, 'bg.png')


# --------------------------------------------------------------------- logo --
def logo():
    src = os.path.join(A, 'coke.svg')
    txt = open(src).read()
    txt = re.sub(r'fill="[^"]*"', 'fill="#ffffff"', txt)
    txt = txt.replace('<svg ', '<svg fill="#ffffff" ', 1)
    white = os.path.join(A, 'coke_white.svg')
    open(white, 'w').write(txt)
    big = os.path.join(A, 'logo_big.png')
    subprocess.run(['rsvg-convert', '-w', '920', '-b', 'none', white, '-o', big], check=True)
    # the editor paints an Image layer 1:1 and clips it, so ship it at the drawn size
    for name, (w, h) in (('logo.png', (230, 72)), ('logo_aod.png', (140, 44))):
        im = Image.open(big).convert('RGBA')
        save(im.resize((w, h), Image.LANCZOS), name)
    os.remove(big)


# ------------------------------------------------------------------ weather --
def weather_icons(w=46, h=41):
    src = os.path.join(A, 'weather')
    for i in range(29):
        p = os.path.join(src, f'w_{i}.png')
        im = Image.open(p).convert('RGBA')
        save(im.resize((w, h), Image.LANCZOS), f'weather/weather_{i}.png')


# --------------------------------------------------------------------- wave --
def wave_frames(n=60, top=352, amp=7, lam=W):
    """White band with a travelling wavy top edge plus a thin ripple above it,
    one wavelength per loop so the frames join seamlessly."""
    for f in range(n):
        phase = 2 * math.pi * f / n
        band = Image.new('L', (W * SS, H * SS), 0)
        ribbon = Image.new('L', (W * SS, H * SS), 0)
        db, dr = ImageDraw.Draw(band), ImageDraw.Draw(ribbon)
        pts = [(x * SS, (top + amp * math.sin(2 * math.pi * x / lam + phase)) * SS)
               for x in range(0, W + 1, 2)]
        db.polygon(pts + [(W * SS, H * SS), (0, H * SS)], fill=255)
        rib = [(x * SS, (top - 17 + amp * math.sin(2 * math.pi * (x + lam / 4) / lam + phase)) * SS)
               for x in range(0, W + 1, 2)]
        dr.line(rib, fill=255, width=3 * SS, joint='curve')
        img = band.resize((W, H), Image.LANCZOS).crop((0, 300, W, H))
        ribimg = ribbon.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.5)).crop((0, 300, W, H))
        ribimg = ribimg.point(lambda v: int(v * 0.45))
        out = Image.new('RGBA', img.size, (255, 255, 255, 0))
        out.putalpha(img)
        over = Image.new('RGBA', img.size, (255, 255, 255, 0))
        over.putalpha(ribimg)
        out = Image.alpha_composite(out, over)
        save(out, f'wave_{f:02d}.png')


# ------------------------------------------------------------------ bubbles --
def bubbles(n=48, count=38, seed=7):
    rnd = random.Random(seed)
    bs = []
    span = H + 80
    for _ in range(count):
        r = rnd.uniform(1.8, 11.0)
        bs.append(dict(x=rnd.uniform(8, W - 8), y0=rnd.uniform(0, span), r=r,
                       sway=rnd.uniform(3, 9), swayPh=rnd.uniform(0, 6.28),
                       a=rnd.uniform(0.16, 0.55), v=rnd.uniform(0.5, 1.2)))
    for f in range(n):
        t = f / n
        big = Image.new('L', (W * SS, H * SS), 0)
        hi = Image.new('L', (W * SS, H * SS), 0)
        db, dh = ImageDraw.Draw(big), ImageDraw.Draw(hi)
        for b in bs:
            y = (b['y0'] - t * span * b['v']) % span - 40
            x = b['x'] + b['sway'] * math.sin(6.283 * t * b['v'] + b['swayPh'])
            r = b['r'] * SS
            cx, cy = x * SS, y * SS
            al = int(255 * b['a'])
            db.ellipse([cx - r, cy - r, cx + r, cy + r], fill=al)
            db.ellipse([cx - r, cy - r, cx + r, cy + r], outline=min(255, al + 70),
                       width=max(1, int(r * 0.28)))
            dh.ellipse([cx - r * 0.55, cy - r * 0.62, cx - r * 0.05, cy - r * 0.2], fill=200)
        body = big.resize((W, H), Image.LANCZOS)
        shine = hi.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.5))
        out = Image.new('RGBA', (W, H), (255, 255, 255, 0))
        out.putalpha(body)
        out2 = Image.new('RGBA', (W, H), (255, 255, 255, 0))
        out2.putalpha(shine)
        out = Image.alpha_composite(out, out2)
        save(out, f'bub_{f:02d}.png')


if __name__ == '__main__':
    background()
    logo()
    weather_icons()
    wave_frames()
    bubbles()
    print('assets written to', A)
