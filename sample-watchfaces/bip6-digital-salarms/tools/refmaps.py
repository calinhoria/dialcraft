"""Pulls backlight maps + gauge out of the reference photo (tools/reference.png)."""
import os
import numpy as np
from PIL import Image, ImageFilter

REF = Image.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reference.png')).convert('RGB')

# boxes in reference-photo pixels
BOX_MAIN = (108, 231, 293, 303)
BOX_DATE = (130, 138, 193, 168)
BOX_BATT = (113, 177, 196, 222)
BOX_GAUGE = (203, 131, 295, 224)

RAMP = np.array([[0, 128, 74, 30], [.35, 196, 134, 66], [.6, 228, 168, 92], [.82, 250, 208, 120], [1, 255, 236, 170]], 'float32')

def backlight(box, size, k=13):
    """brightness map from the photo (thin dark glyphs wiped by a grey-scale dilation), coloured with the LCD amber ramp"""
    g = REF.crop(box).convert('L').filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.GaussianBlur(3.2))
    g = g.resize(size, Image.LANCZOS)
    a = np.asarray(g).astype('float32')
    lo, hi = np.percentile(a, 3), np.percentile(a, 99.5)
    t = np.clip((a - lo) / max(hi - lo, 1), 0, 1) ** 1.15
    rgb = np.stack([np.interp(t, RAMP[:, 0], RAMP[:, i + 1]) for i in range(3)], -1)
    return Image.fromarray(rgb.clip(0, 255).astype('uint8'), 'RGB')

def gauge(size):
    return REF.crop(BOX_GAUGE).resize(size, Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=90, threshold=2))
