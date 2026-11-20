#!/usr/bin/env python3
"""Draws the ring pictures of Concentric and puts them into the saved project (run after face-cli has saved it).

  seconds ticks: one full-screen picture (390 x 450, ring centre 195, 225), tick k at -6k degrees; the code turns it to 90 + 6 s degrees every
                 second, in the same call that moves the seconds numerals
  minute ticks:  5 frames; frame f is the tick ring turned to 90 + 6 f degrees (the pattern repeats every 30 degrees = 5 minutes)
  numerals:      24 square pictures (32 x 32), the ink of each centred exactly in its square; the code moves them

Everything is drawn 8x larger and scaled down, so ticks and numeral ink sit at their exact sub-pixel places.
"""
import json, math, os, glob
from PIL import Image, ImageDraw, ImageFont
H = os.path.dirname(os.path.abspath(__file__))
FONT = '/Volumes/Projects/Projects/dialcraft/.claude/skills/create-amazfit-watchface/examples/animated/fonts/inter-500.ttf'
SS, COLOURS, NUM = 8, 32, 32
TICK = (109, 111, 115, 255)                    # the repo's tick grey
SEC_COL, MIN_COL = (90, 176, 255, 255), (153, 153, 153, 255)
font = ImageFont.truetype(FONT, 21 * SS)
def ticks(box, r_out, minor, major, th, size=None, centre=None):
    bw, bh = size or (box, box); Cx, Cy = centre or (box / 2, box / 2)
    im = Image.new('RGBA', (bw * SS, bh * SS), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for k in range(60):                        # tick k sits 6k degrees counter-clockwise of the ring's zero
        mj = k % 5 == 0; a = math.radians(-6 * k + th); r0, r1 = r_out - 1, r_out - (major if mj else minor); w = (2.4 if mj else 2.0) * SS
        p0 = (Cx + r0 * math.sin(a), Cy - r0 * math.cos(a)); p1 = (Cx + r1 * math.sin(a), Cy - r1 * math.cos(a))
        d.line([(p0[0] * SS, p0[1] * SS), (p1[0] * SS, p1[1] * SS)], fill=TICK, width=round(w))
        for p in (p0, p1): d.ellipse([p[0] * SS - w / 2, p[1] * SS - w / 2, p[0] * SS + w / 2, p[1] * SS + w / 2], fill=TICK)   # round caps
    return im.resize((bw, bh), Image.LANCZOS)
def numeral(txt, col):
    im = Image.new('RGBA', (NUM * SS, NUM * SS), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    l, t, r, b = d.textbbox((0, 0), txt, font=font, anchor='ls')
    d.text((NUM * SS / 2 - (l + r) / 2, NUM * SS / 2 - (t + b) / 2), txt, font=font, fill=col, anchor='ls')   # ink centred in the square
    return im.resize((NUM, NUM), Image.LANCZOS)
def save(im, name, p):
    path = H + '/project/images/' + name; os.makedirs(os.path.dirname(path), exist_ok=True)
    im.quantize(COLOURS, method=Image.Quantize.FASTOCTREE).save(path, optimize=True)
    p['images'] = [i for i in p['images'] if i['name'] != name] + [{'name': name, 'width': im.width, 'height': im.height}]
def main():
    pf = glob.glob(H + '/project/*.wfproj.json')[0]; p = json.load(open(pf))
    save(ticks(0, 192, 5, 11, 0, size=(390, 450), centre=(195, 225)), 'cc/sec-ring.png', p)
    names = []
    for j in range(5):                         # list position j holds frame (4 + j) % 5: the preview minute 9 shows frame 4 first
        f = (4 + j) % 5; name = 'cc/min/f%d.png' % f; save(ticks(284, 140, 5, 10, 90 + 6 * f), name, p); names.append(name)
    e = next(x for x in p['elements'] if x.get('handle') == 'minring'); e.update(src=names[0], images=names, x=53, y=83)
    for k in range(12):
        t = '%02d' % ((5 * k) % 60); save(numeral(t, SEC_COL), 'cc/sn%d.png' % k, p); save(numeral(t, MIN_COL), 'cc/mn%d.png' % k, p)
    for old in glob.glob(H + '/project/images/cc/*-placeholder.png'): os.remove(old)
    p['images'] = [i for i in p['images'] if not i['name'].endswith('-placeholder.png')]
    p['userCode'] = open(H + '/code.js').read(); p.pop('themes', None)
    json.dump(p, open(pf, 'w')); print('ring pictures written')
if __name__ == '__main__':
    main()
