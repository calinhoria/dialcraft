#!/usr/bin/env python3
"""Measure ink boxes of the Coca-Cola preview (and AOD) — alignment, gaps, margins."""
import sys
from PIL import Image

PRE = sys.argv[1] if len(sys.argv) > 1 else "/Users/calinbelut/Downloads/mimo/preview.png"
im = Image.open(PRE).convert("RGB")
W, H = im.size
px = im.load()

def is_ink(x, y, bg=None):
    r, g, b = px[x, y]
    if bg == "red":
        return not (r > 110 and g < 90 and b < 90)   # not reddish
    # white-ish ink on anything
    return r > 170 and g > 170 and b > 170

def box(x0, y0, x1, y1, test=is_ink):
    xs, ys = [], []
    for y in range(y0, y1):
        for x in range(x0, x1):
            if test(x, y):
                xs.append(x); ys.append(y)
    if not xs:
        return None
    return (min(xs), min(ys), max(xs) + 1, max(ys) + 1)

def show(label, b):
    if not b:
        print(f"{label:24s} none"); return
    x0, y0, x1, y1 = b
    print(f"{label:24s} x {x0:4d}-{x1:4d} (w {x1-x0:3d}, cx {(x0+x1)/2:6.1f})  y {y0:4d}-{y1:4d} (h {y1-y0:3d}, cy {(y0+y1)/2:6.1f})")

print(f"== {PRE}  {W}x{H}")
logo   = box(0, 10, W, 136)
wave   = box(0, 136, W, 190)
hour   = box(0, 190, 181, 280)      # left of colon box
minute = box(209, 190, W, 280)
# colon: white ink strictly between hour and minute boxes
colon  = box(181, 190, 209, 280)
tag    = box(0, 396, W, H)
# temperature: red ink inside the cap circle only
def red_ink(x, y):
    r, g, b = px[x, y]
    dx, dy = x - 195, y - 336
    return r > 150 and g < 90 and b < 90 and dx * dx + dy * dy < 34 * 34
temp   = box(150, 300, 240, 375, red_ink)
def white_ink(x, y):
    r, g, b = px[x, y]
    return r > 230 and g > 230 and b > 230
cap    = box(135, 280, 255, 395, white_ink)

show("logo", logo)
show("wave", wave)
show("hour digits", hour)
show("colon", colon)
show("minute digits", minute)
show("temperature (red)", temp)
show("bottle cap (white)", cap)
show("tagline", tag)

if hour and minute and colon:
    hcy = (hour[1] + hour[3]) / 2
    mcy = (minute[1] + minute[3]) / 2
    digcy = (hcy + mcy) / 2
    colcy = (colon[1] + colon[3]) / 2
    midx = (hour[2] + minute[0]) / 2
    colcx = (colon[0] + colon[2]) / 2
    print(f"-- digits cy avg {digcy:.1f} | colon cy {colcy:.1f}  -> dy {colcy-digcy:+.1f}")
    print(f"-- hour right {hour[2]} | minute left {minute[0]} | mid {midx:.1f} | colon cx {colcx:.1f} -> dx {colcx-midx:+.1f}")
    print(f"-- hour h {hour[3]-hour[1]} ({hour[1]}-{hour[3]}) | minute h {minute[3]-minute[1]} ({minute[1]}-{minute[3]})")

if logo and wave and tag and hour:
    print(f"-- top margin {logo[1]} | logo->wave gap {wave[1]-logo[3]} | wave->clock gap {hour[1]-wave[3]}")
    if cap:
        print(f"-- clock->cap gap {cap[1]-hour[3]} | cap->tagline gap {tag[1]-cap[3]} | bottom margin {H-tag[3]}")
    print(f"-- left margin {min(logo[0], hour[0], minute[0], 4)} | right margin {W-max(logo[2], minute[2])}")
