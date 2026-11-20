#!/usr/bin/env python3
"""32x32 cocktail-bar clock GIF for iDotMatrix (martini glass, olive, neon, bokeh).
Usage: python cocktail_clock.py 17:44 27 THU 8 [out.gif]
       (time, temp C, 3-letter weekday, day of month)
"""
import sys
from PIL import Image

W = H = 32
FRAMES, MS = 8, 150
BG = (10, 4, 18)
WHITE, PINK, CYAN, AMBER = (255, 235, 245), (255, 70, 170), (80, 235, 255), (255, 200, 90)
GLASS, GLASS_D = (200, 225, 240), (120, 150, 175)
DRINK_T, DRINK_B = (255, 130, 190), (215, 40, 120)
OLIVE, PIMENTO, PICK = (120, 160, 45), (225, 45, 45), (225, 190, 120)
BAR, BAR_L = (88, 44, 20), (165, 98, 46)
BOKEH = [(20, 12, (80, 30, 110)), (27, 21, (30, 70, 110)), (18, 27, (100, 40, 70)),
         (30, 15, (90, 60, 20)), (23, 10, (60, 30, 100))]

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

def martini(img, f):
    # drink, darker toward the bottom of the bowl
    for y in range(14, 19):
        left, right = 2 + (y - 13), 14 - (y - 13)
        t = (y - 14) / 4
        for x in range(left + 1, right):
            px(img, x, y, mix(DRINK_T, DRINK_B, t))
    for x in range(4, 13):
        px(img, x, 14, (255, 180, 215))                       # surface highlight
    gx = 5 + f                                                # glint sliding across
    if 5 <= gx <= 11:
        px(img, gx, 15, (255, 215, 235))
    # olive on a pick, bobbing
    b = (0, 0, 1, 1, 1, 1, 0, 0)[f]
    for i in range(5):
        px(img, 3 + i, 11 + i + b, PICK)
    for dx in (0, 1):
        for dy in (0, 1):
            px(img, 7 + dx, 15 + dy + b, OLIVE)
    px(img, 8, 16 + b, PIMENTO)
    # glass outline: bowl, stem, base
    for y in range(13, 20):
        px(img, 2 + (y - 13), y, GLASS); px(img, 14 - (y - 13), y, GLASS)
    for x in range(2, 15):
        px(img, x, 13, GLASS)
    for y in range(20, 27):
        px(img, 8, y, GLASS)
    for x in range(6, 11):
        px(img, x, 27, GLASS)
    for x in range(4, 13):
        px(img, x, 28, GLASS_D if x not in (4, 12) else GLASS)
    if f % 4 == 0:
        px(img, 14, 12, WHITE); px(img, 14, 11, (255, 255, 255))   # rim sparkle

def frame(f, t, temp, wd, day):
    img = Image.new("RGB", (W, H), BG)
    for i, (x, y, c) in enumerate(BOKEH):                   # blurry bar lights
        k = 0.5 + 0.5 * ((f + i * 2) % 8 < 4)
        col = tuple(int(v * (0.6 + 0.5 * k)) for v in c)
        for dx in (0, 1):
            for dy in (0, 1):
                px(img, x + dx, y + dy, col)
    hh, mm = t.split(":")
    for ch, x in zip(hh + mm, (3, 9, 19, 25)):
        glyph(img, F57[ch], x, 2, WHITE)
    if f < 4:
        for y in (4, 8):
            px(img, 15, y, PINK); px(img, 16, y, PINK)
    for x in range(W):                                       # bar counter
        px(img, x, 29, BAR_L); px(img, x, 30, BAR); px(img, x, 31, BAR)
    martini(img, f)
    flick = PINK if f != 5 else (170, 40, 115)               # tiny neon flicker
    text35(img, wd, 17, 12, flick)
    text35(img, str(day), 17, 18, CYAN)
    x = 17
    for ch in str(temp):
        glyph(img, F35[ch], x, 24, AMBER); x += 4
    for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):
        px(img, x + dx, 24 + dy, AMBER)
    glyph(img, F35["C"], x + 3, 24, AMBER)
    return img

def build(t="17:44", temp=27, wd="THU", day=8, out="cocktail_clock.gif"):
    fr = [frame(f, t, temp, wd, day) for f in range(FRAMES)]
    fr[0].save(out, save_all=True, append_images=fr[1:], duration=MS, loop=0, disposal=1)
    return out

if __name__ == "__main__":
    a = sys.argv[1:]
    print(build(a[0] if a else "17:44", int(a[1]) if len(a) > 1 else 27,
                a[2] if len(a) > 2 else "THU", a[3] if len(a) > 3 else "8",
                a[4] if len(a) > 4 else "cocktail_clock.gif"))
