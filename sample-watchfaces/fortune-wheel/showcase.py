#!/usr/bin/env python3
"""Store GIF for Fortune Wheel, rendered from the face's own pictures (not recorded from the app: the app's recorder does not play the
watch's own angle animation). Same timing as the face's code: 1 s speed-up (easein, 20% of the turn), 3.8 s slow-down (easeout), 3 extra turns,
landing on a card centre under the pointer. One spin (MAYBE -> ASK THE CAT), then a short cross-fade back to the start; under the store's 1 MB.
Needs preview.png (run face-cli first) and build/ (prep.py).   python3 showcase.py [fps=10] [colours=64]"""
import json, os, sys
from PIL import Image, ImageDraw
H = os.path.dirname(os.path.abspath(__file__)); B = H + '/build/'
FPS = int(sys.argv[1]) if len(sys.argv) > 1 else 10; COLS = int(sys.argv[2]) if len(sys.argv) > 2 else 64
meta = json.load(open(B + 'wheel.json')); CX, CY, PTR = 195, 225, 90
wheel = Image.open(B + 'wheel.png').convert('RGB'); cover = Image.open(B + 'cover.png').convert('RGBA')
plate = Image.open(B + 'plate.png').convert('RGBA') if os.path.exists(B + 'plate.png') else None
dial = Image.open(B + 'dial.png').convert('RGBA'); side = meta['dial']
prev = Image.open(H + '/preview.png').convert('RGB')
# the left column (time, date, power) is taken from the preview where the cover hides the wheel completely
left = Image.new('L', cover.size); left.putdata([255 if a >= 254 else 0 for a in cover.getchannel('A').getdata()])
mask = Image.new('L', (390, 450), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, 389, 449], radius=86, fill=255)   # the Bip 6 corners
def frame(angle):
    f = wheel.rotate(-angle, resample=Image.BICUBIC, center=(CX, CY), fillcolor=(0, 0, 0)).convert('RGBA')
    f.alpha_composite(cover)
    f = f.convert('RGB'); f.paste(prev, (0, 0), left); f = f.convert('RGBA')
    if plate: f.alpha_composite(plate, (CX - plate.width // 2, CY - plate.height // 2))
    f.alpha_composite(dial, (CX - (side - 1) // 2, CY - (side - 1) // 2))
    out = Image.new('RGB', (390, 450), (20, 20, 24)); out.paste(f.convert('RGB'), (0, 0), mask); return out
def spin(rest, target, turns=3):
    total = ((target - rest) % 360 + 360) % 360 + 360 * turns; a1 = rest + total * 0.2
    angs = []
    for i in range(int(4.8 * FPS) + 1):
        t = i * 1000 / FPS
        if t < 1000: k = t / 1000; angs.append(rest + (a1 - rest) * k * k)
        else: k = min(1, (t - 1000) / 3800); angs.append(a1 + (rest + total - a1) * (1 - (1 - k) ** 2))
    return angs
land = lambda name: (PTR - meta['centres'][meta['labels'].index(name)]) % 360
a_maybe, a_cat = land('MAYBE'), land('ASK THE CAT')
hold = lambda a, s: [a] * int(s * FPS)
angles = hold(a_maybe, 0.8) + spin(a_maybe, a_cat) + hold(a_cat, 1.6)
frames = [frame(a) for a in angles]
frames += [Image.blend(frames[-1], frames[0], k / 4) for k in (1, 2, 3)]      # a short cross-fade back to the start, so the loop does not jump
pal = frames[len(frames) // 3].quantize(colors=COLS, method=Image.Quantize.MEDIANCUT)
q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
q[0].save(H + '/showcase.gif', save_all=True, append_images=q[1:], duration=int(1000 / FPS), loop=0, optimize=True, disposal=1)
print('frames', len(q), 'fps', FPS, 'bytes', os.path.getsize(H + '/showcase.gif'))
