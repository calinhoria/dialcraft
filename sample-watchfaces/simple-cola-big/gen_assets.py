#!/usr/bin/env python3
"""Coca-Cola watchface assets: white logo, red background with dynamic ribbon + bottle cap, fizz frames."""
import math, random, subprocess, os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 390, 450
RED_TOP = (244, 0, 9)        # Coca-Cola dynamic red
RED_BOT = (170, 0, 6)
WHITE = (255, 255, 255)

# ---------- 1. logo: official Spencerian script, painted white ----------
raw = os.path.join(HERE, "_logo_raw.png")
subprocess.run(["rsvg-convert", "-w", "900", "-o", raw, os.path.join(HERE, "coca-cola-logo.svg")], check=True)
logo = Image.open(raw).convert("RGBA")
px = logo.load()
for y in range(logo.height):
    for x in range(logo.width):
        r, g, b, a = px[x, y]
        if a > 0:
            px[x, y] = (255, 255, 255, a)
# trim to ink
bbox = logo.getbbox()
logo = logo.crop(bbox)
logo.save(os.path.join(HERE, "logo_white.png"))
os.remove(raw)
print("logo", logo.size)

# ---------- 2. background: red gradient + vignette + dynamic ribbon + bottle cap ----------
bg = Image.new("RGBA", (W, H), (0, 0, 0, 255))
d = ImageDraw.Draw(bg)
for y in range(H):
    t = y / (H - 1)
    # slight diagonal blend: brighter top-left
    d.line([(0, y), (W, y)], fill=(
        int(RED_TOP[0] * (1 - t) + RED_BOT[0] * t),
        int(RED_TOP[1] * (1 - t) + RED_BOT[1] * t),
        int(RED_TOP[2] * (1 - t) + RED_BOT[2] * t), 255))
# radial glow behind the clock (soft light-red)
glow = Image.new("L", (W, H), 0)
gd = ImageDraw.Draw(glow)
gd.ellipse([195 - 210, 235 - 170, 195 + 210, 235 + 170], fill=70)
glow = glow.filter(ImageFilter.GaussianBlur(60))
light = Image.new("RGBA", (W, H), (255, 90, 90, 0))
light.putalpha(glow)
bg = Image.alpha_composite(bg, light)

# vignette darkening at edges
vig = Image.new("L", (W, H), 0)
vd = ImageDraw.Draw(vig)
vd.rectangle([0, 0, W, H], fill=120)
vd.ellipse([-70, -40, W + 70, H + 40], fill=0)
vig = vig.filter(ImageFilter.GaussianBlur(55))
dark = Image.new("RGBA", (W, H), (60, 0, 2, 0))
dark.putalpha(vig)
bg = Image.alpha_composite(bg, dark)
d = ImageDraw.Draw(bg)

# ---- dynamic ribbon (the iconic white wave), sits under the logo ----
def ribbon(dr, y0, h, x0=28, x1=W - 28, amp=9, phase=0.0, color=(255, 255, 255, 255)):
    top, bot = [], []
    for i in range(0, 201):
        t = i / 200
        x = x0 + (x1 - x0) * t
        # gentle S: sine of one period, thick in the middle, tapering at the ends
        y = y0 + amp * math.sin(2 * math.pi * t + phase)
        th = h * (0.35 + 0.65 * math.sin(math.pi * t) ** 0.6)
        top.append((x, y - th / 2))
        bot.append((x, y + th / 2))
    dr.polygon(top + bot[::-1], fill=color)

ribbon(d, 163, 14, phase=0.0)

# ---- bottle cap (white, serrated) holding the temperature ----
cap_cx, cap_cy, cap_r = 195, 336, 50
teeth, inner = 28, 44
pts = []
for i in range(teeth * 2):
    a = math.pi * 2 * i / (teeth * 2)
    r = cap_r if i % 2 == 0 else inner
    pts.append((cap_cx + r * math.cos(a), cap_cy + r * math.sin(a)))
# soft shadow
sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(sh)
sd.ellipse([cap_cx - cap_r - 3, cap_cy - cap_r + 4, cap_cx + cap_r + 3, cap_cy + cap_r + 8], fill=(60, 0, 2, 130))
sh = sh.filter(ImageFilter.GaussianBlur(5))
bg = Image.alpha_composite(bg, sh)
d = ImageDraw.Draw(bg)
d.polygon(pts, fill=(255, 255, 255, 255))
d.ellipse([cap_cx - inner + 4, cap_cy - inner + 4, cap_cx + inner - 4, cap_cy + inner - 4],
          outline=(226, 226, 226, 255), width=2)
bg.save(os.path.join(HERE, "bg.png"))
print("bg", bg.size)

# ---------- 3. fizz: rising soda bubbles, looping animation ----------
random.seed(7)
BUBBLES = []
for _ in range(90):
    BUBBLES.append({
        "x": random.uniform(6, W - 6),
        "y": random.uniform(0, H + 60),
        "r": random.uniform(1.6, 6.5),
        "v": random.uniform(7, 22),          # px per loop
        "a": random.uniform(35, 130),
        "sway": random.uniform(3, 9),
        "ph": random.uniform(0, math.tau),
    })
FRAMES = 10
for f in range(FRAMES):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    t = f / FRAMES
    for b in BUBBLES:
        y = (b["y"] - b["v"] * FRAMES * t) % (H + 80) - 40
        x = b["x"] + b["sway"] * math.sin(math.tau * (t + b["ph"]))
        r = b["r"]
        # fade near top and bottom
        fade = min(1.0, max(0.0, min(y, H - y) / 60))
        a = int(b["a"] * fade)
        if a < 6:
            continue
        ld.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, a))
        # highlight dot
        hr = max(1.0, r * 0.32)
        ld.ellipse([x - r * 0.45 - hr, y - r * 0.45 - hr, x - r * 0.45 + hr, y - r * 0.45 + hr],
                   fill=(255, 255, 255, min(255, a + 70)))
    layer.save(os.path.join(HERE, f"fizz_{f}.png"))
print("frames", FRAMES)
