#!/usr/bin/env python3
"""Build PixelLattice.ttf: a 3x5 pixel font (each cell a 100-unit square on a 120-unit pitch) for the weekday layer.
Covers A-Z (lower case draws the same shapes), 0-9, '-' and every accented Latin letter whose base is A-Z: the accent becomes
one cell in the row above the letter. Scripts other than Latin have no glyph."""
import unicodedata, os
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
F = {
 '0': ['111','101','101','101','111'], '1': ['010','110','010','010','111'], '2': ['111','001','111','100','111'], '3': ['111','001','111','001','111'],
 '4': ['101','101','111','001','001'], '5': ['111','100','111','001','111'], '6': ['111','100','111','101','111'], '7': ['111','001','001','001','001'],
 '8': ['111','101','111','101','111'], '9': ['111','101','111','001','111'], '-': ['000','000','111','000','000'],
 'A': ['111','101','111','101','101'], 'B': ['110','101','110','101','110'], 'C': ['111','100','100','100','111'], 'D': ['110','101','101','101','110'],
 'E': ['111','100','111','100','111'], 'F': ['111','100','110','100','100'], 'G': ['111','100','101','101','111'], 'H': ['101','101','111','101','101'],
 'I': ['111','010','010','010','111'], 'J': ['001','001','001','101','111'], 'K': ['101','101','110','101','101'], 'L': ['100','100','100','100','111'],
 'M': ['101','111','111','101','101'], 'N': ['111','101','101','101','101'], 'O': ['111','101','101','101','111'], 'P': ['111','101','111','100','100'],
 'Q': ['111','101','101','111','001'], 'R': ['111','101','111','110','101'], 'S': ['111','100','111','001','111'], 'T': ['111','010','010','010','010'],
 'U': ['101','101','101','101','111'], 'V': ['101','101','101','101','010'], 'W': ['101','101','111','111','101'], 'X': ['101','101','010','101','101'],
 'Y': ['101','101','010','010','010'], 'Z': ['111','001','010','100','111'] }
MARK = {'́': '001', '̀': '100', '̂': '010', '̌': '010', '̈': '101', '̃': '101'}
SPECIAL = {'ł': 'L', 'Ł': 'L', 'ø': 'O', 'Ø': 'O', 'ß': 'S', 'đ': 'D', 'Đ': 'D', 'æ': 'A', 'Æ': 'A', 'œ': 'O', 'Œ': 'O', 'ı': 'I', 'İ': 'I', 'ð': 'D', 'þ': 'T'}
P, INK, ADV, UPM = 120, 100, 480, 1000
def glyph(rows, mark):
    pen = TTGlyphPen(None)
    cells = [(c, r) for r, row in enumerate(rows) for c, b in enumerate(row) if b == '1']
    if mark: cells += [(c, -1) for c, b in enumerate(mark) if b == '1']
    for c, r in cells:
        x0, y0 = c * P, (4 - r) * P
        pen.moveTo((x0, y0)); pen.lineTo((x0, y0 + INK)); pen.lineTo((x0 + INK, y0 + INK)); pen.lineTo((x0 + INK, y0)); pen.closePath()
    return pen.glyph()
order = ['.notdef', 'space']; glyphs = {'.notdef': glyph(F['0'], ''), 'space': TTGlyphPen(None).glyph()}; cmap = {32: 'space'}
def add(cp, rows, mark):
    name = 'u%04X' % cp; key = name
    if key not in glyphs: order.append(key); glyphs[key] = glyph(rows, mark)
    cmap[cp] = key
for ch, rows in F.items():
    add(ord(ch), rows, '')
    if ch.isalpha(): add(ord(ch.lower()), rows, '')
for cp in range(0xC0, 0x250):
    ch = chr(cp)
    if ch in SPECIAL: add(cp, F[SPECIAL[ch]], ''); continue
    d = unicodedata.normalize('NFD', ch)
    if len(d) > 1 and d[0].upper() in F and d[0].isalpha() and d[0].isascii():
        add(cp, F[d[0].upper()], MARK.get(d[1], '010'))
fb = FontBuilder(UPM, isTTF=True); fb.setupGlyphOrder(order); fb.setupCharacterMap(cmap); fb.setupGlyf(glyphs)
fb.setupHorizontalMetrics({n: (ADV, 0) for n in order}); fb.setupHorizontalHeader(ascent=800, descent=-100)
fb.setupNameTable({'familyName': 'Pixel Lattice', 'styleName': 'Regular'}); fb.setupOS2(sTypoAscender=800, sTypoDescender=-100, usWinAscent=800, usWinDescent=100)
fb.setupPost(); fb.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'PixelLattice.ttf'))
print(len(cmap), 'code points')
