import math, random, colorsys
from PIL import Image, ImageDraw, ImageFont
SS = 2                                    # supersampling, to look like the watch's smooth edges
W, H = 390, 450
RAW = False                               # True: effect functions return the recording Canvas (for the GIFs), not a finished image
def done(c): return c if RAW else c.out()
def hsl(h, s=1.0, l=0.66):
    r, g, b = colorsys.hls_to_rgb((h % 360) / 360.0, l, s)
    return (int(r * 255), int(g * 255), int(b * 255))
class Canvas:
    """Records drawing steps in order; they can be replayed up to any step (the GIFs draw a growing part of them)."""
    def __init__(self, bg=(0, 0, 0)): self.bg = bg; self.ops = []; self.timetext = None
    def line(self, x1, y1, x2, y2, col, w=1): self.ops.append(('l', x1, y1, x2, y2, col, w))
    def circle(self, x, y, r, col): self.ops.append(('c', x, y, r, col))
    def ring(self, x, y, r, col, w=1): self.ops.append(('r', x, y, r, col, w))
    def arc(self, bb, a0, a1, col, w): self.ops.append(('a', bb, a0, a1, col, w))
    def rect(self, x1, y1, x2, y2, col): self.ops.append(('q', x1, y1, x2, y2, col))
    def poly(self, pts, fill=None, outline=None, w=1): self.ops.append(('p', pts, fill, outline, w))
    def time(self, t='10:09'): self.timetext = t
    def base(self):
        im = Image.new('RGB', (W * SS, H * SS), self.bg); d = ImageDraw.Draw(im)
        if self.timetext:
            try: f = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 92 * SS)
            except Exception: f = ImageFont.load_default()
            bb = d.textbbox((0, 0), self.timetext, font=f); x = (W * SS - (bb[2] - bb[0])) / 2 - bb[0]; y = 38 * SS - bb[1]
            for dx in range(-5 * SS, 5 * SS + 1, SS):                        # a 5 px black border, then the white digits
                for dy in range(-5 * SS, 5 * SS + 1, SS):
                    if dx * dx + dy * dy <= (5 * SS) ** 2: d.text((x + dx, y + dy), self.timetext, font=f, fill=(0, 0, 0))
            d.text((x, y), self.timetext, font=f, fill=(255, 255, 255))
        return im, d
    def apply(self, d, op):
        k = op[0]
        if k == 'l': d.line([(op[1] * SS, op[2] * SS), (op[3] * SS, op[4] * SS)], fill=op[5], width=max(1, int(round(op[6] * SS))))
        elif k == 'c': d.ellipse([(op[1] - op[3]) * SS, (op[2] - op[3]) * SS, (op[1] + op[3]) * SS, (op[2] + op[3]) * SS], fill=op[4])
        elif k == 'r': d.ellipse([(op[1] - op[3]) * SS, (op[2] - op[3]) * SS, (op[1] + op[3]) * SS, (op[2] + op[3]) * SS], outline=op[4], width=max(1, int(round(op[5] * SS))))
        elif k == 'a': d.arc([v * SS for v in op[1]], op[2], op[3], fill=op[4], width=max(1, int(round(op[5] * SS))))
        elif k == 'q': d.rectangle([op[1] * SS, op[2] * SS, op[3] * SS, op[4] * SS], fill=op[5])
        elif k == 'p':
            xy = [(x * SS, y * SS) for (x, y) in op[1]]
            if op[2] is not None: d.polygon(xy, fill=op[2])
            if op[3] is not None: d.line(xy + [xy[0]], fill=op[3], width=max(1, int(round(op[4] * SS))), joint='curve')
    def out(self):
        im, d = self.base()
        for op in self.ops: self.apply(d, op)
        return im.resize((W, H), Image.LANCZOS)
def sheet(ims, path, cols=None, pad=10):
    ims = [i.out() if hasattr(i, 'ops') else i for i in ims]
    cols = cols or len(ims); rows = (len(ims) + cols - 1) // cols
    s = Image.new('RGB', (cols * W + (cols - 1) * pad, rows * H + (rows - 1) * pad), (40, 40, 44))
    for i, im in enumerate(ims): s.paste(im, ((i % cols) * (W + pad), (i // cols) * (H + pad)))
    s.save(path)
