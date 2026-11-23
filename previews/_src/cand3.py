from lib import *
CX, CY, R = 195, 285, 145
def harmono(seed, nseg=2600, T=70.0, width=1.6, hue0=None, bg=(0, 0, 0)):
    r = random.Random(seed)
    base = [2, 3, 2, 3]
    fr = [base[i] + (r.random() - 0.5) * 0.03 + r.choice([0, 0, 1, -1]) * (r.random() < 0.4) for i in range(4)]       # near-integer ratios make closed-ish rosettes
    amp = [1.0, 0.8 + r.random() * 0.4, 1.0, 0.8 + r.random() * 0.4]
    ph = [r.random() * 6.283 for _ in range(4)]
    dmp = [0.012 + r.random() * 0.012 for _ in range(4)]
    def pos(t):
        x = amp[0] * math.sin(fr[0] * t + ph[0]) * math.exp(-dmp[0] * t) + amp[1] * math.sin(fr[1] * t + ph[1]) * math.exp(-dmp[1] * t)
        y = amp[2] * math.sin(fr[2] * t + ph[2]) * math.exp(-dmp[2] * t) + amp[3] * math.sin(fr[3] * t + ph[3]) * math.exp(-dmp[3] * t)
        return x, y
    pts = [pos(T * i / nseg) for i in range(nseg + 1)]
    m = max(max(abs(p[0]), abs(p[1])) for p in pts)
    c = Canvas(bg); h0 = r.random() * 360 if hue0 is None else hue0
    for i in range(nseg):
        a, b = pts[i], pts[i + 1]; f = i / nseg
        c.line(CX + R * a[0] / m, CY + R * a[1] / m, CX + R * b[0] / m, CY + R * b[1] / m, hsl(h0 + 300 * f, 1.0, 0.64), width * (1.15 - 0.55 * f))
    c.time(); return done(c)
if __name__ == '__main__': sheet([harmono(s) for s in (1, 2, 3, 4, 5, 6, 7, 8)], 'cand3.png', cols=4)
