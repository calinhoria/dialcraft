import lib, os
from PIL import Image
lib.RAW = True
from lib import *
import cand1, cand3, cand5, others
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
t = cand1.table; h = cand3.harmono
make_gif([t(200, 2), t(200, 3), t(300, 51)], OUT + 'effect-1-times-table.gif')
make_gif([others.maurer(2, 29), others.maurer(3, 47), others.maurer(6, 71)], OUT + 'effect-2-maurer-rose.gif')
make_gif([h(1), h(3), h(7)], OUT + 'effect-3-harmonograph.gif')
make_gif([others.truchet(30, 4, 5, 'rainbow'), others.truchet(22, 9, 4, 'two'), others.truchet(40, 2, 7, 'rainbow')], OUT + 'effect-4-truchet-arcs.gif')
make_gif([cand5.style(cand5.pack(5), 'donut'), cand5.style(cand5.pack(8), 'bubble'), cand5.style(cand5.pack(11), 'target')], OUT + 'effect-5-circle-packing.gif')
make_gif([others.attractor('clifford', -1.4, 1.6, 1.0, 0.7), others.attractor('dejong', 1.641, 1.902, 0.316, 1.525, hue0=180), others.attractor('clifford', -1.7, 1.3, -0.1, -1.21, hue0=60)], OUT + 'effect-6-attractor-dust.gif')
make_gif([others.tree(), others.koch(), others.dragon()], OUT + 'effect-7-fractals.gif')
make_gif([others.moire([(-28, 0), (28, 0)], 6), others.moire([(0, -30), (-26, 15), (26, 15)], 7, 150, 1.3, False), others.moire([(0, 0), (34, 20)], 6)], OUT + 'effect-8-moire-circles.gif')
