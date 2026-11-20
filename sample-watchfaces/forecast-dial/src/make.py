#!/usr/bin/env python3
import json, base64, os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
SK = ROOT + '/.claude/skills/create-amazfit-watchface/examples/animated'
HERE = os.path.dirname(os.path.abspath(__file__))
KIT = open(SK + '/kit.js').read()
def font(fn, fam):
    return "await registerCustomFont({name:'%s',family:'%s',format:'truetype',ext:'.ttf',dataBase64:'%s'}); " % (fn, fam, base64.b64encode(open(SK + '/fonts/' + fn, 'rb').read()).decode())
steps = []
steps.append({"script": font('antonio-400.ttf', 'Antonio') + "glyphFont='Antonio'; glyphOpts.size=22; return 1"})
for p in ['bg', 'weekday', 'day', 'month', 'clock', 'steps', 'hr', 'cal', 'battery', 'suntimes']:
    steps.append({"preset": p})
steps.append({"script": open(HERE + '/add.js').read()})
for st in json.load(open(HERE + '/styles.json')):
    gl = dict(st[1]); gl.setdefault('font', 'Antonio')
    s = {"edit": st[0], "glyph": gl}
    if len(st) > 2: s["set"] = st[2]
    steps.append(s)
ICONS = open(HERE + '/icons.json').read()
steps.append({"script": "const ICONS = " + ICONS + ";\n" + KIT + "\n" + open(HERE + '/place.js').read()})
CODE = open(HERE + '/forecast.code.js').read()
rec = {"userImports": "import { Weather as DCWeather } from '@zos/sensor'", "userCode": CODE, "language": "en-US", "name": "Forecast Dial", "device": "bip-6", "font": "Antonio", "steps": steps,
       "preview": "preview.png", "previewAod": "preview-aod.png", "save": "project", "out": "export"}
json.dump(rec, open(HERE + '/recipe.json', 'w'))
print('wrote recipe.json', len(steps), 'steps')
