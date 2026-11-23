from lib import *
CX, CY, R = 195, 285, 140
def table(N, k, width=1, hue0=0, sweep=360):
    c = Canvas()
    for i in range(N):
        a1 = 2 * math.pi * i / N; a2 = 2 * math.pi * (k * i) / N
        c.line(CX + R * math.cos(a1), CY + R * math.sin(a1), CX + R * math.cos(a2), CY + R * math.sin(a2), hsl(hue0 + sweep * i / N), width)
    c.time(); return done(c)
if __name__ == '__main__': sheet([table(200, 2), table(200, 3), table(200, 4), table(200, 7), table(240, 21), table(240, 34), table(300, 51), table(300, 2.5)], 'cand1.png', cols=4)
