#!/usr/bin/env python3
"""Slice American Poker 2 art into watchface assets.

Source: ~/Downloads/Arcade - American Poker 95 - Miscellaneous - Cards.png (card sheet)
        ~/Downloads/amp2.png (the game screen, for the palette)
Everything lands in ./assets.
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HOME = os.path.expanduser('~')
SHEET = f'{HOME}/Downloads/Arcade - American Poker 95 - Miscellaneous - Cards.png'
SCREEN = f'{HOME}/Downloads/amp2.png'
FONT = '/Volumes/Projects/Projects/dialcraft/assets/fonts/PressStart2P-Regular.ttf'
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = f'{ROOT}/assets'
for sub in ['cards', 'ui']:
    os.makedirs(f'{OUT}/{sub}', exist_ok=True)

BLUE = (0, 0, 230)
CYAN = (33, 255, 255)
DARK = (0, 16, 110)
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)

# ---------------------------------------------------------------- the cards --
def cards():
    im = Image.open(SHEET).convert('RGB')
    CW, CH = 48, 72
    xs = [round(1 + k * 48.85) - 1 for k in range(13)]
    ys = [0, 73, 146, 219]                      # spades, clubs, hearts, diamonds
    n = 0
    for r in range(4):
        for k in range(13):
            c = im.crop((xs[k], ys[r], xs[k] + CW, ys[r] + CH))
            c = c.resize((CW * 3 // 2, CH * 3 // 2), Image.NEAREST)   # 72x108
            c.save(f'{OUT}/cards/card_{n:02d}.png')
            n += 1
    # the JOLLY card sits in the sheet's bottom row (third box), the back is the first
    back = im.crop((1, 292, 49, 364)).resize((72, 108), Image.NEAREST)
    back.save(f'{OUT}/cards/back.png')
    jolly = im.crop((100, 292, 148, 364)).resize((72, 108), Image.NEAREST)
    jolly.save(f'{OUT}/cards/card_52.png')
    print('cards', n, '+ joker + back')


# ------------------------------------------------------------ arcade text --
def make_font(size):
    return ImageFont.truetype(FONT, size)


def text_img(s, size, color, outline=None, ow=2, pad=None):
    """Press Start 2P rendered without anti-aliasing, optional hard outline."""
    f = make_font(size)
    tmp = Image.new('RGBA', (10, 10))
    d = ImageDraw.Draw(tmp)
    box = d.textbbox((0, 0), s, font=f)
    pad = pad if pad is not None else (ow + 1)
    w = box[2] - box[0] + pad * 2
    h = box[3] - box[1] + pad * 2
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if outline:
        for dx in range(-ow, ow + 1):
            for dy in range(-ow, ow + 1):
                if dx or dy:
                    d.text((pad - box[0] + dx, pad - box[1] + dy), s, font=f, fill=outline + (255,))
    d.text((pad - box[0], pad - box[1]), s, font=f, fill=color + (255,))
    a = np.array(img)
    a[:, :, 3] = np.where(a[:, :, 3] > 110, 255, 0)     # kill the anti-aliasing
    return Image.fromarray(a)


def ui():
    # money digits: white with a hard black outline, on the cyan panels
    for i in range(10):
        text_img(str(i), 16, WHITE, BLACK, 2).save(f'{OUT}/ui/digit_{i}.png')
    # HOLD tag
    tag = text_img('HOLD', 7, DARK, None, 0, pad=2)
    box = Image.new('RGBA', (tag.width + 6, tag.height + 4), CYAN + (255,))
    box.alpha_composite(tag, (3, 2))
    box.save(f'{OUT}/ui/hold.png')
    # result line labels
    labels = ['DEAL', 'DRAW', 'GAMBLE', 'RED', 'BLACK', 'NO WIN',
              'JACKS OR BETTER', 'TWO PAIR', 'THREE OF A KIND', 'STRAIGHT',
              'FLUSH', 'FULL HOUSE', 'FOUR OF A KIND', 'STRAIGHT FLUSH',
              'ROYAL FLUSH', '5 OF A KIND', 'MINI BONUS!', 'YOU WIN']
    # the clock: 48 px digits in the same font, uniform cells so 10:09 never shifts
    for i in range(10):
        im = text_img(str(i), 48, WHITE, BLACK, 2)
        cell = Image.new('RGBA', (48, 54), (0, 0, 0, 0))
        cell.alpha_composite(im, ((48 - im.width) // 2, (54 - im.height) // 2))
        cell.save(f'{OUT}/ui/clock_{i}.png')
    col = text_img(':', 48, WHITE, BLACK, 2)
    cc = Image.new('RGBA', (20, 54), (0, 0, 0, 0))
    cc.alpha_composite(col, ((20 - col.width) // 2, (54 - col.height) // 2))
    cc.save(f'{OUT}/ui/clock_colon.png')

    meta = {}
    for i, s in enumerate(labels):
        im = text_img(s, 14, WHITE, BLACK, 2)
        im.save(f'{OUT}/ui/label_{i:02d}.png')
        meta[s] = {'i': i, 'w': im.width, 'h': im.height}
    # panel captions (dark blue on the cyan panels)
    for name, txt in [('mini', 'MINI BONUS'), ('bet', 'BET'), ('credit', 'CREDIT')]:
        text_img(txt, 9, DARK, None, 0, pad=1).save(f'{OUT}/ui/panel_{name}.png')

    # the payout table, baked as one panel (static art)
    rows = [('5 OF A KIND', '3000', RED), ('ROYAL FLUSH', '1900', RED),
            ('STR. FLUSH', '400', BLACK), ('4 OF A KIND', '200', BLACK),
            ('FULL HOUSE', '60', BLACK), ('FLUSH', '45', BLACK),
            ('STRAIGHT', '35', BLACK), ('3 OF A KIND', '25', BLACK),
            ('2 PAIR', '15', BLACK), ('JACKS OR BETTER', '15', BLACK)]
    rowimgs = [(text_img(n, 9, c, None, 0, pad=1), text_img(v, 9, c, None, 0, pad=1)) for n, v, c in rows]
    rh = max(max(l.height, r.height) for l, r in rowimgs) + 1
    PW, PH = 370, 6 + rh * len(rowimgs) + 4
    panel = Image.new('RGBA', (PW, PH), CYAN + (255,))
    d = ImageDraw.Draw(panel)
    d.rounded_rectangle((0, 0, PW - 1, PH - 1), 3, fill=CYAN + (255,))
    y = 4
    for l, r in rowimgs:
        panel.alpha_composite(l, (10, y))
        panel.alpha_composite(r, (PW - 12 - r.width, y))
        y += rh
    panel.save(f'{OUT}/ui/paytable.png')
    json.dump(meta, open(f'{OUT}/ui/labels.json', 'w'), indent=1)
    print('labels', len(labels), 'paytable', panel.size)


cards()
ui()
Image.new('RGBA', (4, 4), (0, 0, 0, 0)).save(f'{OUT}/ui/empty.png')
