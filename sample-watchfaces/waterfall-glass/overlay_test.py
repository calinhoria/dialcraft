#!/usr/bin/env python3
"""Rebuild the spray overlay and check it against the concept's own compositing.

For a handful of sim steps this renders:
  A) the concept:  SCENE*(1-a) + wc*a + add        (wf.render)
  B) the watch:    bg + digits + overlay(al, rgb)  (what the face does)
and reports the difference, so the overlay can be tuned until the watch matches.
"""
import importlib.util, sys, os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, f'{ROOT}/handoff')
spec = importlib.util.spec_from_file_location('wf', f'{ROOT}/handoff/wf.py')
wf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wf)

S, SW, SH, W, H = wf.S, wf.SW, wf.SH, wf.W, wf.H
BGC = np.asarray(Image.open(f'{ROOT}/assets/bg.png').convert('RGB'), np.float32) / 255


def digit_alpha(name):
    a = np.asarray(Image.open(f'{ROOT}/assets/digits/{name}.png').convert('RGBA'), np.float32) / 255
    return a


def digits_panel():
    """bg + the concept's digits (10 / 24) at the face positions, alpha-composited."""
    cw, ch = 116, 139
    x0 = (SW - 2 * cw) // 2
    base = BGC.copy()
    for d, x, y in [('hour_1', x0, 62), ('hour_0', x0 + cw, 62), ('min_2', x0, 222), ('min_4', x0 + cw, 222)]:
        im = digit_alpha(d)
        al = im[..., 3:4]
        base[y:y + ch, x:x + cw] = base[y:y + ch, x:x + cw] * (1 - al) + im[..., :3] * al
    return base


def layers(sim):
    """The concept's last part of render(): water colour, alpha, additive glow."""
    x, y, vx, vy, kind = sim.x * S, sim.y * S, sim.vx * S, sim.vy * S, sim.kind
    xs, ys, ws = [], [], []
    for j in range(11):
        f = j * 0.30
        xs.append(x - vx * f * 0.5); ys.append(y - vy * f * 0.5)
        ws.append(np.where(kind == 0, 1.5, 0.35) * (1 - j * 0.05))
    D = wf.splat_all(np.concatenate(xs), np.concatenate(ys), np.concatenate(ws))
    Dd = wf.splat_all(x[kind == 1], y[kind == 1], np.ones((kind == 1).sum(), np.float32))
    Ds = wf.gblur(D, 2.1)
    alpha = 1 - np.exp(-Ds * 0.8)
    wf.FOAM *= 0.80
    if sim.impacts:
        a = np.array(sim.impacts, np.float32)
        wf.FOAM += wf.gblur(wf.splat_all(a[:, 0] * S, a[:, 1] * S, np.clip(a[:, 2], 0, 8) * 0.9), 5) * 6
    foam = np.clip(wf.FOAM, 0, 1)
    Db = wf.gblur(D, 5.0)
    gy, gx = np.gradient(Db)
    spec = np.clip(-(gx * -0.45 + gy * -0.89) * 2.2, 0, 1) ** 1.3
    depth = np.clip(Db * 0.35, 0, 1)
    deep = np.array([0.42, 0.72, 0.88], np.float32)
    light = np.array([0.95, 1.0, 1.0], np.float32)
    wc = deep * (1 - depth[..., None]) + light * depth[..., None] * 0.9
    wc = np.clip(wc + spec[..., None] * 0.55 + foam[..., None] * 0.55, 0, 1)
    a = np.clip(alpha * 0.92 + foam * 0.55 * alpha, 0, 1)
    dd = wf.gblur(Dd, 1.0)
    drop = (np.clip(dd * 1.1, 0, 1) * 0.65)[..., None] * np.array([0.8, 0.95, 1.0], np.float32)
    mist = np.asarray(Image.fromarray((np.clip(Dd * 40, 0, 255)).astype(np.uint8)).resize((W // 4, H // 4), Image.BILINEAR), np.float32) / 255
    mist = wf.gblur(mist, 6.0)
    mist = np.asarray(Image.fromarray((np.clip(mist, 0, 1) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), np.float32) / 255
    haze = mist[..., None] * 0.9 * np.array([0.55, 0.75, 0.85], np.float32)
    return wc, a, drop + haze


def concept_frame(sim, wc, a, add):
    cv = wf.SCENE * (1 - a[..., None]) + wc * a[..., None] + add
    return Image.fromarray((np.clip(cv, 0, 1) * 255).astype(np.uint8)).resize((SW, SH), Image.LANCZOS)


def overlay(wc, a, add, haze_max=0.5, haze_gain=0.8):
    """Alpha overlay: water exactly as the concept, glow folded in as soft alpha."""
    lum = np.clip(add.max(axis=-1) * haze_gain, 0, haze_max)
    col = add / np.maximum(add.max(axis=-1, keepdims=True), 1e-3)
    col = np.clip(col * 0.92 + 0.06, 0, 1)
    al = a + lum * (1 - a)
    rgb = (wc * a[..., None] + col * lum[..., None]) / np.maximum(al[..., None], 1e-4)
    return np.clip(rgb, 0, 1), np.clip(al, 0, 1)


def to_watch(rgb, al):
    out = BGC * (1 - al[..., None]) + rgb * al[..., None]
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).resize((SW, SH), Image.LANCZOS)


def main():
    sim = wf.Sim()
    for _ in range(wf.WARM):
        sim.step()
        wf.FOAM[:] = wf.FOAM * 0.8
    panel = digits_panel()
    steps = [int(s) for s in (sys.argv[1:] or ['1', '10', '20', '35'])]
    want = set(steps)
    n = max(steps)
    for i in range(1, n + 1):
        sim.step()
        wc, a, add = layers(sim)
        if i not in want:
            continue
        cimg = concept_frame(sim, wc, a, add)
        rgb, al = overlay(wc, a, add)
        ov = Image.fromarray((np.dstack([rgb * 255, al * 255])).astype(np.uint8), 'RGBA').resize((SW, SH), Image.LANCZOS)
        watch = Image.fromarray((panel * 255).astype(np.uint8)).convert('RGBA')
        watch.alpha_composite(ov)
        watch = watch.convert('RGB')
        ca = np.asarray(cimg, np.float32)
        wa = np.asarray(watch, np.float32)
        print(f'step {i}: mean |concept-watch| = {np.abs(ca - wa).mean():.2f}  max {np.abs(ca - wa).max():.0f}')
        crop = (0, 0, SW, SH)
        sheet = Image.new('RGB', (SW * 2 + 6, SH), (0, 0, 0))
        sheet.paste(cimg.crop(crop), (0, 0))
        sheet.paste(watch, (SW + 6, 0))
        sheet.save(f'/tmp/cmp_{i:02d}.png')
        ov.save(f'/tmp/ov_{i:02d}.png')


main()
