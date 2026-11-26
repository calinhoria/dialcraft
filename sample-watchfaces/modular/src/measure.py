"""Compare the render with the reference, element by element (ink boxes in device px) and report the overall difference.
python3 src/measure.py [preview.png]"""
from PIL import Image
import numpy as np, sys, os
MOD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ref = Image.open(MOD + '/sheets/reference.png').convert('RGB')
SX, SY = 390 / 387.0, 450 / 466.0
# the reference screen (387 x 466 px at 23,17) resampled to the watch's 390 x 450: the only unavoidable difference is the aspect (0.830 vs 0.867)
refd = np.array(ref.crop((23, 17, 410, 483)).resize((390, 450), Image.LANCZOS)).astype(int)
pv = np.array(Image.open(sys.argv[1] if len(sys.argv) > 1 else MOD + '/preview.png').convert('RGB')).astype(int)
REG = {
    'weekday': (235, 44, 306, 82), 'day': (310, 44, 352, 82), 'time': (140, 88, 380, 165), 'rings': (28, 66, 142, 182),
    'wx icon': (38, 186, 92, 232), 'temp': (97, 192, 150, 226), 'high': (155, 192, 232, 226), 'low': (235, 192, 320, 226),
    'lab now': (36, 238, 94, 264), 'lab 1': (104, 238, 158, 264), 'lab 2': (170, 238, 224, 264), 'lab 3': (236, 238, 290, 264), 'lab 4': (302, 238, 356, 264),
    'ic now': (36, 266, 94, 308), 'ic 1': (104, 266, 158, 308), 'ic 2': (170, 266, 224, 308), 'ic 3': (236, 266, 290, 308), 'ic 4': (302, 266, 356, 308),
    'ring hr': (24, 322, 140, 430), 'ring st': (142, 322, 258, 430), 'ring bt': (260, 322, 376, 430),
    'heart': (62, 338, 100, 372), 'shoe': (178, 338, 222, 372), 'batt': (294, 338, 338, 372),
    'v hr': (56, 378, 108, 408), 'v st': (150, 378, 250, 408), 'v bt': (276, 378, 360, 408),
}


def bb(a, r, th):
    x0, y0, x1, y1 = r
    m = a[y0:y1, x0:x1].max(2) > th
    ys, xs = np.where(m)
    if len(xs) == 0: return None
    return (xs.min() + x0, xs.max() + x0 + 1, ys.min() + y0, ys.max() + y0 + 1)


print('%-9s %-26s %-26s' % ('', 'reference  x0-x1 y0-y1 (w x h)', 'render'))
for k, r in REG.items():
    th = 28 if k.startswith('ring') else 60
    a, b = bb(refd, r, th), bb(pv, r, th)
    f = lambda q: '-' if q is None else '%3d-%3d %3d-%3d (%3dx%2d)' % (q[0], q[1], q[2], q[3], q[1] - q[0], q[3] - q[2])
    print('%-9s %-26s %-26s' % (k, f(a), f(b)))
d = np.abs(refd - pv).sum(2)
print('pixels differing by more than 60 (sum of channels): %.2f %%' % (100.0 * (d > 60).mean()))
