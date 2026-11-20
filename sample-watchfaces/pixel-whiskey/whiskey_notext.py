#!/usr/bin/env python3
"""32x32 whiskey-themed clock GIF for iDotMatrix.
Usage: python whiskey_clock.py 17:44 27 THU 8 [out.gif]
       (time, temp C, 3-letter weekday, day of month)
"""
import sys
from PIL import Image

W = H = 32
FRAMES, MS = 8, 160
BG, GRID = (14, 6, 2), (30, 15, 6)
GOLD, COPPER, CREAM = (235, 175, 65), (185, 115, 45), (255, 228, 175)
GLASS, GLASS_D = (175, 195, 210), (115, 140, 160)
WOOD, WOOD_L = (78, 38, 14), (140, 80, 32)
ICE, ICE_IN, ICE_HI = (200, 230, 245), (150, 190, 215), (255, 255, 255)

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

def cube(img, x0, y0, n):
    for y in range(n):
        for x in range(n):
            edge = x in (0, n - 1) or y in (0, n - 1)
            px(img, x0 + x, y0 + y, ICE if edge else ICE_IN)
    px(img, x0 + 1, y0 + 1, ICE_HI)

def rocks_glass(img, f):
    # sides + rim
    for y in range(17, 30):
        px(img, 2, y, GLASS); px(img, 12, y, GLASS)
    for x in range(2, 13):
        px(img, x, 17, GLASS)
    # whiskey: dark at the bottom, light at the surface
    for y in range(19, 28):
        t = (y - 19) / 8
        c = tuple(int(a + (b - a) * t) for a, b in zip((238, 152, 38), (140, 55, 4)))
        for x in range(3, 12):
            px(img, x, y, c)
    for x in range(3, 12):
        px(img, x, 19, (255, 205, 100))              # surface highlight
    # thick glass base
    for y in (28, 29):
        for x in range(2, 13):
            px(img, x, y, GLASS_D if y == 29 else GLASS)
    # bobbing ice
    o = (0, 0, 1, 1, 1, 1, 0, 0)[f]
    cube(img, 4, 18 + o, 4)
    cube(img, 8, 22 + (1 - o), 3)
    # glint sliding across the liquid
    gx = 3 + f
    for y in range(21, 27):
        r, g, b = img.getpixel((gx, y))
        px(img, gx, y, (min(r + 60, 255), min(g + 60, 255), min(b + 50, 255)))
    px(img, 3, 18, GLASS_D); px(img, 11, 18, GLASS_D) if f % 4 == 0 else None

def frame(f, t, temp, wd, day):
    img = Image.new("RGB", (W, H), BG)
    for y in range(1, 30, 4):
        for x in range(1, W, 4):
            px(img, x, y, GRID)
    for x in range(W):                               # wooden bar
        px(img, x, 30, WOOD_L); px(img, x, 31, WOOD)
    rocks_glass(img, f)
    for x in range(4, 11):                           # warm reflection on the bar
        px(img, x, 30, (170, 95, 25))
    return img

def build(t="17:44", temp=27, wd="THU", day=8, out="whiskey_clock.gif"):
    fr = [frame(f, t, temp, wd, day) for f in range(FRAMES)]
    fr[0].save(out, save_all=True, append_images=fr[1:], duration=MS, loop=0, disposal=1)
    return out

if __name__ == "__main__":
    a = sys.argv[1:]
    print(build(a[0] if a else "17:44", int(a[1]) if len(a) > 1 else 27,
                a[2] if len(a) > 2 else "THU", a[3] if len(a) > 3 else "8",
                a[4] if len(a) > 4 else "whiskey_clock.gif"))
