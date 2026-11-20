#!/usr/bin/env python3
"""32x32 campfire clock GIF for iDotMatrix (flickering fire, sparks, pines, stars).
Usage: python campfire_clock.py 17:44 27 THU 8 [out.gif]
       (time, temp C, 3-letter weekday, day of month)
"""
import sys, math
from PIL import Image

W = H = 32
FRAMES, MS = 8, 130
CREAM, ORANGE, AMBER = (255, 235, 190), (255, 150, 50), (255, 200, 90)
LOG, LOG_L = (92, 52, 26), (140, 85, 40)
PINE, PINE_L = (5, 22, 24), (10, 40, 36)
CX, BASE = 12, 27                                # fire centre x, base row
STARS = [(1, 0), (13, 10), (30, 1), (6, 9), (22, 10), (28, 9), (10, 1)]

F57 = {  # 5x7 dot-matrix digits
 '0': "01110 10001 10011 10101 11001 10001 01110",
 '1': "00100 01100 00100 00100 00100 00100 01110",
 '2': "01110 10001 00001 00010 00100 01000 11111",
 '3': "11110 00001 00001 01110 00001 00001 11110",
 '4': "00010 00110 01010 10010 11111 00010 00010",
 '5': "11111 10000 11110 00001 00001 10001 01110",
 '6': "00110 01000 10000 11110 10001 10001 01110",
 '7': "11111 00001 00010 00100 01000 01000 01000",
 '8': "01110 10001 10001 01110 10001 10001 01110",
 '9': "01110 10001 10001 01111 00001 00010 01100"}

F35 = {  # 3x5 small font
 '0': "111 101 101 101 111", '1': "010 110 010 010 111",
 '2': "111 001 111 100 111", '3': "111 001 111 001 111",
 '4': "101 101 111 001 001", '5': "111 100 111 001 111",
 '6': "111 100 111 101 111", '7': "111 001 001 001 001",
 '8': "111 101 111 101 111", '9': "111 101 111 001 111",
 'A': "010 101 111 101 101", 'D': "110 101 101 101 110",
 'E': "111 100 110 100 111", 'F': "111 100 110 100 100",
 'H': "101 101 111 101 101", 'I': "111 010 010 010 111",
 'M': "101 111 111 101 101", 'N': "111 101 101 101 101",
 'O': "111 101 101 101 111", 'R': "110 101 110 101 101",
 'S': "111 100 111 001 111", 'T': "111 010 010 010 010",
 'U': "101 101 101 101 111", 'W': "101 101 111 111 101",
 '-': "000 000 111 000 000", 'C': "111 100 100 100 111",
 'J':"001 001 001 101 111",
 'L':"100 100 100 100 111",
 'V':"101 101 101 101 010",}

def px(img, x, y, c):
    if 0 <= x < W and 0 <= y < H:
        img.putpixel((x, y), c)

def mix(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))

def glyph(img, rows, x0, y0, col):
    for r, row in enumerate(rows.split()):
        for c, b in enumerate(row):
            if b == '1':
                px(img, x0 + c, y0 + r, col)

def text35(img, s, x0, y0, col):
    for ch in s:
        if ch == ' ':
            x0 += 2; continue
        glyph(img, F35[ch], x0, y0, col); x0 += 4

def pine(img, cx, top, bottom, half):
    """simple layered pine: triangles of growing width"""
    h = bottom - top
    for y in range(top, bottom + 1):
        w = int(half * ((y - top) / h)) + (0 if (y - top) % 3 else 0)
        w = max(0, w - ((y - top) % 3 == 0) * 0)
        tier = (y - top) % 4
        for x in range(cx - w, cx + w + 1):
            px(img, x, y, PINE_L if (x > cx and tier < 2) else PINE)
    for y in range(bottom, bottom + 3):
        px(img, cx, y, (30, 16, 8))

def flame(img, f):
    ph = 2 * math.pi * f / FRAMES
    for dx in range(-3, 4):
        tip = max(0, round(8 - 2 * abs(dx) + 1.4 * math.sin(ph + dx * 1.3) + 0.5 * math.sin(2 * ph + dx)))
        for layer, (col, shrink) in enumerate((((205, 40, 10), 0), ((255, 130, 20), 2), ((255, 235, 120), 4))):
            if abs(dx) > 3 - layer:
                continue
            h = tip - shrink
            sway = round(math.sin(ph + layer) * (1 if tip > 5 else 0))
            for k in range(max(0, h)):
                y = BASE - k
                c = col if k < h - 1 else mix(col, (120, 10, 5), 0.5)   # darker tip
                px(img, CX + dx + (sway if k > 3 else 0), y, c)

def frame(f, t, temp, wd, day):
    img = Image.new("RGB", (W, H))
    flick = 0.85 + 0.15 * math.sin(2 * math.pi * f / FRAMES * 2)
    for y in range(H):
        base = mix((4, 6, 22), (26, 14, 40), y / 30)
        for x in range(W):
            d = math.hypot(x - CX, (y - 22) * 1.2)
            g = max(0.0, 1 - d / 13) * 0.32 * flick          # firelight glow
            px(img, x, y, mix(base, (255, 120, 30), g))
    for i, (x, y) in enumerate(STARS):
        px(img, x, y, (255, 255, 255) if (f + i * 3) % 8 < 2 else (140, 140, 190))
    pine(img, 3, 12, 28, 3)                                   # trees behind the camp
    pine(img, 6, 18, 28, 2)
    for y in range(29, 32):                                   # ground
        for x in range(W):
            g = max(0.0, 1 - math.hypot(x - CX, (y - 28) * 2) / 10) * 0.3 * flick
            px(img, x, y, mix((18, 12, 8), (255, 120, 30), g))
    # logs
    for x in range(CX - 5, CX + 6):
        px(img, x, 28, LOG)
    for x in list(range(CX - 5, CX - 2)) + list(range(CX + 3, CX + 6)):
        px(img, x, 27 - (1 if x in (CX - 5, CX + 5) else 0), LOG_L)
    for x in (CX - 4, CX - 1, CX + 2, CX + 4):                # glowing embers
        if (x + f) % 3 == 0:
            px(img, x, 28, (255, 140, 40))
    flame(img, f)
    # sparks rising (loop = 8 frames)
    for i, (sx, off) in enumerate(((CX - 2, 0), (CX + 1, 3), (CX + 3, 5), (CX - 1, 7))):
        k = (f + off) % 8
        y = 19 - k
        x = sx + round(math.sin(k * 0.9 + i) * 1.5)
        px(img, x, y, mix((255, 210, 90), (150, 40, 10), k / 8))
    return img

def build(t="17:44", temp=27, wd="THU", day=8, out="campfire_clock.gif"):
    fr = [frame(f, t, temp, wd, day) for f in range(FRAMES)]
    fr[0].save(out, save_all=True, append_images=fr[1:], duration=MS, loop=0, disposal=1)
    return out

if __name__ == "__main__":
    a = sys.argv[1:]
    print(build(a[0] if a else "17:44", int(a[1]) if len(a) > 1 else 27,
                a[2] if len(a) > 2 else "THU", a[3] if len(a) > 3 else "8",
                a[4] if len(a) > 4 else "campfire_clock.gif"))
