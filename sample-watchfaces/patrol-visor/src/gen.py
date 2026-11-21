#!/usr/bin/env python3
"""UNIT 0900 - Patrol Visor: builds the pictures and writes recipe.json (run from this folder)."""
import base64, io, json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE)
KIT = '/Users/calinbelut/.claude/skills/create-amazfit-watchface/examples/animated/kit.js'
FONT = '/Users/calinbelut/.claude/skills/create-amazfit-watchface/examples/animated/fonts/chakra-petch-700.ttf'
A = 'a/'
OUTDIR = sys.argv[1] if len(sys.argv) > 1 else 'build'

def b64(im):
    bio = io.BytesIO(); im.save(bio, 'PNG', optimize=True); return base64.b64encode(bio.getvalue()).decode()
def L(n): return Image.open(A + n).convert('RGBA')
def scale(im, k): return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
def blank(w, h): return Image.new('RGBA', (w, h))
def canvas(im, w, h):
    c = blank(w, h); c.alpha_composite(im, ((w - im.width) // 2, (h - im.height) // 2)); return c

# ---------------- layout constants (device px) ----------------
DW, DH = 69, 100          # clock digit picture
SP = -6                   # digit spacing inside hour / minute
GAP = -2                  # box gap hour|colon|minute
CY = 211                  # visor centre line
HOUR_W = 2 * DW + SP
CLOCK_W = HOUR_W * 2 + 32 + 2 * GAP
HX = 195 - CLOCK_W // 2; CX_ = HX + HOUR_W + GAP; MX = CX_ + 32 + GAP
CLK_Y = CY - 50
P = {}

# ---------------- pictures ----------------
scene = Image.open('scene.png').convert('RGBA')
# heart icon into the left plate, battery shell into the right plate
heart = scale(L('heart_full.png'), 30 / L('heart_full.png').height)
HPOS = [round(111.5 - heart.width / 2), round(326.5 - heart.height / 2)]
bat = L('bat_full.png'); ba = np.array(bat)
ba[30:104, 32:66, 3] = 0                                   # take the fill block out of the shell
shell = Image.fromarray(ba); kb = 46 / shell.width
shell = scale(shell, kb); BX, BY = round(278.5 - shell.width / 2), round(326.5 - shell.height / 2)
P['icon_heart'] = heart; P['icon_bat'] = shell               # own layers: full colour, the scene is palette-reduced
block = L('bat_full.png').crop((32, 36, 66, 101))          # the glowing cell, with its glow
seg_b = scale(block, kb)                                    # battery cell size
seg_s = scale(block, 12.5 / block.height)                  # steps bar cell size (slot is 13 px tall)
q = scene.convert('RGB').quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
P['scene'] = q.convert('RGBA')
P['seg_b'] = seg_b; P['seg_s'] = seg_s
bat_pos = [[BX + round((33 + i * 34.5) * kb), BY + round(36 * kb)] for i in range(5)]
steps_pos = [[157 + round(i * 7.9), 324] for i in range(10)]

for i in range(10):
    d = L(f'd{i}.png'); P[f'd{i}'] = d
    P[f'g{i}'] = L(f'g{i}.png')
    P[f'r{i}'] = scale(d, 31 / d.height)                   # reading digits
    a = np.array(d).astype(float); a[..., :3] *= 0.62; a[..., 3] = 255 * (a[..., 3] / 255) ** 1.8
    P[f'n{i}'] = Image.fromarray(a.clip(0, 255).astype('uint8'))   # AOD digits: dimmer, less glow
P['colon'] = L('colon.png'); P['gcolon'] = canvas(L('gcolon.png'), 40, 100)
a = np.array(L('colon.png')).astype(float); a[..., :3] *= 0.62; a[..., 3] = 255 * (a[..., 3] / 255) ** 1.8
P['ncolon'] = Image.fromarray(a.clip(0, 255).astype('uint8'))

RS = 156
for i in range(3):
    r = L(f'ret{i}.png'); bb = r.getbbox(); r = r.crop(bb); k = [0.74, 0.86, 0.99][i] * RS / max(r.size)
    P[f'ret{i}'] = canvas(scale(r, k), RS, RS)
P['beam'] = L('beam.png')
for i, nm in enumerate(['led_dim', 'led_on', 'led_off']):
    l = L(f'led{i}.png'); bb = l.getbbox(); l = l.crop(bb); P[nm] = canvas(scale(l, 22 / max(l.size)), 24, 24)
# the cover: the scene behind the clock, so glitched digits can replace the real ones for a moment
CV = (MX + 1, CLK_Y - 4, MX + HOUR_W + 14, CLK_Y + DH + 4)
P['cover'] = P['scene'].crop(CV)

def q48(im): return im.quantize(48, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert('RGBA')
for k in list(P):
    if k[0] in 'dngr' and k[1:].isdigit() or k in ('colon', 'ncolon', 'gcolon'): P[k] = q48(P[k])
for k, im in P.items(): im.save(f'{A}p_{k}.png')
imgs = {k: b64(im) for k, im in P.items()}
sizes = {k: list(im.size) for k, im in P.items()}

geo = dict(HX=HX, CX=CX_, MX=MX, Y=CLK_Y, DW=DW, SP=SP, CV=CV, RS=RS, BEAM=list(P['beam'].size))

# ---------------- watch code ----------------
CODE = open('code.js').read().replace('/*GEO*/', 'const G = ' + json.dumps(geo) + ';')

# ---------------- build script (runs in the editor) ----------------
BUILD = open(KIT).read() + '\n' + open('build.js').read()
BUILD = BUILD.replace('/*IMGS*/', 'const IMGS = ' + json.dumps(imgs) + ';').replace('/*GEO*/', 'const G = ' + json.dumps(geo) + ';') \
    .replace('/*POS*/', 'const BATPOS = ' + json.dumps(bat_pos) + '; const STEPPOS = ' + json.dumps(steps_pos) + '; const HPOS = ' + json.dumps(HPOS) + '; const BPOS = ' + json.dumps([BX, BY]) + ';')

FONT_STEP = ("await registerCustomFont({ name: 'chakra-petch-700.ttf', family: 'Chakra Petch', format: 'truetype', ext: '.ttf', dataBase64: '"
             + base64.b64encode(open(FONT, 'rb').read()).decode() + "' }); glyphFont = 'Chakra Petch'; glyphOpts.size = 18; return 'font'")
ENG = {'font': 'Chakra Petch', 'size': 38, 'weight': 700, 'fill': 'solid', 'color': '#121317'}
recipe = {
    'name': 'Patrol Visor', 'device': 'bip-6', 'font': 'Chakra Petch', 'language': 'en-US', 'optimizePng': 256,
    'description': 'UNIT 0900 · Patrol Visor. An armoured patrol helmet; the time burns in the visor. A scan beam sweeps it every 6 s, a reticle hunts and locks on the time once a minute, the digits recalibrate at each new minute, and the status light pulses. Engraved date, heart rate, steps (with a bar), battery (with cells). Dim visor clock in always-on mode.',
    'userCode': CODE,
    'steps': [
        {'script': FONT_STEP},
        {'preset': 'bg'}, {'preset': 'weekday'}, {'preset': 'day'},
        {'preset': 'steps'}, {'preset': 'hr'}, {'preset': 'battery'},
        {'preset': 'clock'},
        {'script': "for (const n of ['Hour','Colon','Minute']) { const e = project.elements.find((x) => x.name === n); e.name = n + ' Main'; } return 'renamed'"},
        {'preset': 'clock'},
        {'script': "for (const n of ['Hour','Colon','Minute']) { const e = project.elements.find((x) => x.name === n); e.name = n + ' AOD'; } return 'renamed'"},
        {'edit': 'Weekday', 'glyph': ENG},
        {'edit': 'Day', 'glyph': ENG},
        {'script': BUILD},
    ],
    'preview': 'preview.png', 'previewAod': 'preview-aod.png',
    'save': OUTDIR + '/project', 'out': OUTDIR + '/zeus',
}
json.dump(recipe, open('recipe.json', 'w'))
print('recipe.json', os.path.getsize('recipe.json'), 'bytes; clock', HX, CX_, MX, CLK_Y, 'cover', CV)
