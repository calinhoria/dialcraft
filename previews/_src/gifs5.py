import lib, os
from PIL import Image
lib.RAW = True
from lib import *
import v5
OUT = '/Volumes/Projects/Projects/dialcraft/previews/'
SC = 0.62; F = 44; GROW_MS = 55; HOLD_MS = 2600
def make_gif(canvases, path):
    gap = 8; w = int(W * SC); h = int(H * SC); tw = len(canvases) * w + (len(canvases) - 1) * gap
    states = []
    for c in canvases:
        im, d = c.base(); states.append([im, d, 0])
    frames, durs = [], []
    for f in range(F + 1):
        p = f / F
        sheet_im = Image.new('RGB', (tw, h), (40, 40, 44))
        for i, (c, st) in enumerate(zip(canvases, states)):
            k = int(round(len(c.ops) * p))
            for op in c.ops[st[2]:k]: c.apply(st[1], op)
            st[2] = k
            sheet_im.paste(st[0].resize((w, h), Image.LANCZOS), (i * (w + gap), 0))
        frames.append(sheet_im.quantize(colors=160, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)); durs.append(GROW_MS)
    durs[0] = 500; durs[-1] = HOLD_MS
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=durs, loop=0, optimize=True, disposal=1)
    print(os.path.basename(path), len(frames), 'frames', round(os.path.getsize(path) / 1e6, 2), 'MB', [len(c.ops) for c in canvases])
os.makedirs(OUT, exist_ok=True)
for name in v5.SETS: make_gif(v5.SETS[name](), OUT + 'effect-%s.gif' % name)
