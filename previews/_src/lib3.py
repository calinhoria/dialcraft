import math, random, colorsys
from PIL import Image, ImageDraw, ImageFont
SS = 2
W, H = 390, 450
CX, CY = 195, 225                                   # the centre of the patterns
CKX, CKY = 195, 80                                  # the clock is at the top
A1, B1 = 146, 52                                    # the clear zone around the clock (half width, half height): the clock plus a gap
A2, B2 = 195, 150                                   # how far the repelling reaches
def hsl(h, s=1.0, l=0.66):
    r, g, b = colorsys.hls_to_rgb((h % 360) / 360.0, l, s)
    return (int(r * 255), int(g * 255), int(b * 255))
def rdp(pts, eps):
    if len(pts) < 3: return list(pts)
    (x1, y1), (x2, y2) = pts[0], pts[-1]; dx, dy = x2 - x1, y2 - y1; L = math.hypot(dx, dy); best = -1; bi = 0
    for i in range(1, len(pts) - 1):
        d = abs(dy * (pts[i][0] - x1) - dx * (pts[i][1] - y1)) / L if L else math.hypot(pts[i][0] - x1, pts[i][1] - y1)
        if d > best: best = d; bi = i
    if best <= eps: return [pts[0], pts[-1]]
    return rdp(pts[:bi + 1], eps)[:-1] + rdp(pts[bi:], eps)
CA, CB = 128, 44                                   # the clock's clear ellipse
def edge_dist(x, y):
    """Approximate distance in px from (x, y) to the clock's clear ellipse (negative inside)."""
    dx, dy = x - CKX, y - CKY; u = math.hypot(dx / CA, dy / CB)
    if u < 1e-6: return -CB
    gx, gy = dx / (CA * CA) / u, dy / (CB * CB) / u
    return (u - 1) / math.hypot(gx, gy)
def smooth(t): t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)
def uval(x, y): return math.hypot((x - CKX) / A1, (y - CKY) / B1)          # 1 on the edge of the clear zone
def vval(x, y): return math.hypot((x - CX) / A2, (y - CY) / B2)          # 1 where the repelling ends
def repel(x, y):
    """Push a point away from the clock: inside the zone it lands just outside it, further out the push fades to nothing."""
    dx, dy = x - CX, y - CY; v = vval(x, y)
    if v >= 1: return x, y
    u = uval(x, y)
    if u < 1e-6: return CX, CY - B1 * 1.05
    s0 = math.sqrt(1 + u * u) / u; g = smooth((1 - v) / 0.6)
    s = 1 + (s0 - 1) * g
    return CX + dx * s, CY + dy * s
class Canvas:
    def __init__(self, bg=(0, 0, 0)): self.bg = bg; self.ops = []; self.timetext = None; self.segs = 0; self.mark = None
    def line(self, x1, y1, x2, y2, col, w=1): self.ops.append(('l', x1, y1, x2, y2, col, w))
    def wline(self, p, q, col, w=1, step=7, eps=1.4):
        """A straight line that bends around the clock: cut into short pieces, each point repelled, split where the repelling tears it (a line through the
        centre), and simplified to as few segments as the bend needs."""
        n = max(1, int(math.hypot(q[0] - p[0], q[1] - p[1]) / step)); orig = []; pts = []
        for i in range(n + 1): x = p[0] + (q[0] - p[0]) * i / n; y = p[1] + (q[1] - p[1]) * i / n; orig.append((x, y)); pts.append(repel(x, y))
        d0 = math.hypot(q[0] - p[0], q[1] - p[1]) / n; run = [pts[0]]
        for i in range(1, n + 1):
            if math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) > 3.0 * d0 + 10: self._run(run, col, w, eps); run = [pts[i]]
            else: run.append(pts[i])
        self._run(run, col, w, eps)
    def _run(self, run, col, w, eps):
        sp = rdp(run, eps)
        for a, b in zip(sp, sp[1:]): self.line(*a, *b, col, w)
    def pline(self, orig, warped, colf, wf, jump=3.0, slack=10):
        """A curve through already repelled points; where the repelling tore two neighbours far apart (the curve passed the centre) the line is not drawn."""
        for i in range(len(orig) - 1):
            d0 = math.hypot(orig[i + 1][0] - orig[i][0], orig[i + 1][1] - orig[i][1]); d1 = math.hypot(warped[i + 1][0] - warped[i][0], warped[i + 1][1] - warped[i][1])
            if d1 > jump * d0 + slack: continue
            self.line(*warped[i], *warped[i + 1], colf(i), wf(i))
    def circle(self, x, y, r, col): self.ops.append(('c', x, y, r, col))
    def ring(self, x, y, r, col, w=1): self.ops.append(('r', x, y, r, col, w))
    def arc(self, bb, a0, a1, col, w): self.ops.append(('a', bb, a0, a1, col, w))
    def rect(self, x1, y1, x2, y2, col): self.ops.append(('q', x1, y1, x2, y2, col))
    def time(self, t='10:09'): self.timetext = t
    def dissolve(self, seed=1, cap=1300, reach=88):
        """Random black squares: certain at the clock, thinning to nothing `reach` px away (in every direction); drawn nearest first, so the darkness spreads outward."""
        self.mark = len(self.ops); r = random.Random(seed); dots = []
        for _ in range(40000):
            x = r.uniform(0, W); y = r.uniform(0, H); dpx = edge_dist(x, y)
            if dpx > reach: continue
            p = 1 - smooth(dpx / reach)
            if r.random() > p ** 1.25: continue
            dots.append((dpx + r.random() * 14, x, y, 3 + 10 * p))
        if len(dots) > cap: dots = r.sample(dots, cap)
        for (u, x, y, size) in sorted(dots): self.circle(x, y, size * 0.62, (0, 0, 0))
    def base(self): im = Image.new('RGB', (W * SS, H * SS), self.bg); return im, ImageDraw.Draw(im)
    def withtime(self, im):
        im = im.copy(); d = ImageDraw.Draw(im)
        if self.timetext:
            try: f = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 92 * SS)
            except Exception: f = ImageFont.load_default()
            bb = d.textbbox((0, 0), self.timetext, font=f); x = (W * SS - (bb[2] - bb[0])) / 2 - bb[0]; y = CKY * SS - (bb[1] + bb[3]) / 2
            for dx in range(-5 * SS, 5 * SS + 1, SS):                        # a 5 px black border, then the white digits
                for dy in range(-5 * SS, 5 * SS + 1, SS):
                    if dx * dx + dy * dy <= (5 * SS) ** 2: d.text((x + dx, y + dy), self.timetext, font=f, fill=(0, 0, 0))
            d.text((x, y), self.timetext, font=f, fill=(255, 255, 255))
        return im
    def apply(self, d, op):
        k = op[0]
        if k == 'l': d.line([(op[1] * SS, op[2] * SS), (op[3] * SS, op[4] * SS)], fill=op[5], width=max(1, int(round(op[6] * SS))))
        elif k == 'c': d.ellipse([(op[1] - op[3]) * SS, (op[2] - op[3]) * SS, (op[1] + op[3]) * SS, (op[2] + op[3]) * SS], fill=op[4])
        elif k == 'r': d.ellipse([(op[1] - op[3]) * SS, (op[2] - op[3]) * SS, (op[1] + op[3]) * SS, (op[2] + op[3]) * SS], outline=op[4], width=max(1, int(round(op[5] * SS))))
        elif k == 'a': d.arc([v * SS for v in op[1]], op[2], op[3], fill=op[4], width=max(1, int(round(op[5] * SS))))
        elif k == 'q': d.rectangle([op[1] * SS, op[2] * SS, op[3] * SS, op[4] * SS], fill=op[5])
    def out(self):
        im, d = self.base()
        for op in self.ops: self.apply(d, op)
        return self.withtime(im).resize((W, H), Image.LANCZOS)
def sheet(ims, path, cols=None, pad=10):
    ims = [i.out() if hasattr(i, 'ops') else i for i in ims]
    cols = cols or len(ims); rows = (len(ims) + cols - 1) // cols
    s = Image.new('RGB', (cols * W + (cols - 1) * pad, rows * H + (rows - 1) * pad), (40, 40, 44))
    for i, im in enumerate(ims): s.paste(im, ((i % cols) * (W + pad), (i // cols) * (H + pad)))
    s.save(path)
