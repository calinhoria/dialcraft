#!/usr/bin/env python3
"""Builds recipe.json for the Modular face: python3 src/make.py  (run from the modular folder), then, from the repo root,
env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tools/face-cli.js sample-watchfaces/modular/recipe.json"""
import json, base64, os, glob
HERE = os.path.dirname(os.path.abspath(__file__))
MOD = os.path.dirname(HERE)
ROOT = os.path.abspath(os.path.join(MOD, '..', '..'))
SK = ROOT + '/.claude/skills/create-amazfit-watchface/examples/animated'
KIT = open(SK + '/kit.js').read()
CFG = json.load(open(HERE + '/config.json'))
WX = json.load(open(MOD + '/art/wx.json'))
art = {}
for f in sorted(glob.glob(MOD + '/art/*.png')):
    art[os.path.basename(f)[:-4]] = base64.b64encode(open(f, 'rb').read()).decode()


def font(fn, fam):
    return "await registerCustomFont({name:'%s',family:'%s',format:'truetype',ext:'.ttf',dataBase64:'%s'}); " % (fn, fam, base64.b64encode(open(SK + '/fonts/' + fn, 'rb').read()).decode())


steps = []
steps.append({"script": font('outfit-600.ttf', 'Outfit') + font('outfit-500.ttf', 'Outfit Medium') + font('outfit-400.ttf', 'Outfit Regular') + "glyphFont='Outfit'; glyphOpts.size=22; return 1"})
import sys
for p in ['bg', 'weekday', 'day', 'clock'] + (['suntimes'] if os.environ.get('VARIANT') != 'hl' else []):
    steps.append({"preset": p})
steps.append({"script": open(HERE + '/add.js').read()})
for name, gl, st in CFG['styles']:
    gl = dict(gl); gl.setdefault('font', 'Outfit')
    s = {"edit": name, "glyph": gl}
    if st: s["set"] = st
    steps.append(s)
VARIANT = os.environ.get('VARIANT', '')
CFG['consts']['FC_MODE'] = VARIANT if VARIANT in ('base', 'stack', 'oneline') else 'stack'   # the chosen layout: high over low
CFG['consts']['ROW_MODE'] = 'hl' if VARIANT == 'hl' else 'arrows'   # the chosen row: arrows for high / low, then the next sunrise / sunset
consts = ''.join('const %s = %s;\n' % (k, json.dumps(v)) for k, v in CFG['consts'].items()) + 'const SC = %d, SF = %d;\n' % (WX['cur'], WX['fc'])
consts += 'const SUNOFF = %s;\n' % json.dumps(json.load(open(MOD + '/art/sun.json')))
place = open(HERE + '/place.js').read().replace('/*ART*/{}', json.dumps(art))
steps.append({"script": consts + KIT + "\n" + place})
CODE = open(HERE + '/forecast.code.js').read().replace('/*COLX*/', ', '.join(str(int(x - WX['fc'] / 2)) for x in [65, 131, 197, 263, 329])).replace('/*ICY*/0', str(int((266 if CFG['consts'].get('FC_MODE') == 'stack' else 256) - WX['fc'] / 2)))   # the icons' row: 266 in the stacked layout, 256 otherwise (same numbers as place.js)
rec = {"userImports": "import { Weather as DCWeather } from '@zos/sensor'", "userCode": CODE, "language": "en-US", "name": "Modular", "device": "bip-6", "font": "Outfit",
       "description": "A modular face in the style of a smartwatch infograph: activity rings, the time, weather with the next four hours, and heart rate, steps and battery in round gauges.",
       "translations": {"names": {"week.short": {"en-US": ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]}}},
       "previewScene": CFG['scene'], "steps": steps, "preview": "preview.png", "previewAod": "preview-aod.png", "save": "project", "out": "out/modular"}
if VARIANT:                                   # a preview-only variant: nothing else is written
    rec['preview'] = 'preview-%s.png' % VARIANT
    for k in ('previewAod', 'save', 'out'): rec.pop(k, None)
json.dump(rec, open(MOD + ('/recipe-%s.json' % VARIANT if VARIANT else '/recipe.json'), 'w'))
print('wrote recipe.json', len(steps), 'steps')
