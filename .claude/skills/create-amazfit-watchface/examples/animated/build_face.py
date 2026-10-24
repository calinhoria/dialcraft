#!/usr/bin/env python3
"""Build the recipe of an animated, sprite-based face.

    python3 build_face.py faces/receipt            # writes faces/receipt.recipe.json
    env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tools/face-cli.js .claude/skills/create-amazfit-watchface/examples/animated/faces/receipt.recipe.json

A face is three files next to each other: <stem>.face.json (fonts, presets, glyph styles of the native layers),
<stem>.build.js (runs in the editor: places the native layers, draws the scene, bakes the sprite slots) and
<stem>.code.js (the watch code: the timeline). See references/animated-faces.md.
"""
import json, base64, os, sys
H = os.path.dirname(os.path.abspath(__file__))
KIT = open(H + '/kit.js').read(); TAIL = open(H + '/tail.js').read(); RUNTIME = open(H + '/runtime.js').read()

def build(stem):
    stem = os.path.abspath(stem); cfg = json.load(open(stem + '.face.json'))
    build_js = open(stem + '.build.js').read(); code = open(stem + '.code.js').read()
    fonts = cfg['fonts']; fam0 = fonts[0][1]; slug = cfg['slug']
    reg = ''.join("await registerCustomFont({name:'%s',family:'%s',format:'truetype',ext:'.ttf',dataBase64:'%s'}); " %
                  (fn, fam, base64.b64encode(open(os.path.join(H, 'fonts', fn), 'rb').read()).decode()) for fn, fam in fonts)
    steps = [{"script": reg + "glyphFont='%s'; glyphOpts.size=18; return 1" % fam0}]
    steps += [{"preset": p} for p in cfg['presets']]
    steps.append({"edit": "Background", "set": {"color": cfg['bg']}})
    if 'suntimes' in cfg['presets']:   # the preset swaps by showWhen and brings two default icons; layout needs the layers visible, the face re-sets showWhen when placed
        steps.append({"script": "for (const e of project.elements) if (e.showWhen === 'sunrise' || e.showWhen === 'sunset') delete e.showWhen; return 1"})
        steps.append({"remove": "Sunrise icon"}); steps.append({"remove": "Sunset icon"})
    if 'sun' in cfg['presets']: steps.append({"remove": "Sun icon"})
    for st in cfg['styles']:
        gl = dict(st[1]); gl.setdefault('font', fam0)
        step = {"edit": st[0], "glyph": gl}
        if len(st) > 2: step["set"] = st[2]
        steps.append(step)
    main = ("const CODE_SRC = " + json.dumps(code) + ";\nconst RUNTIME_SRC = " + json.dumps(RUNTIME) + ";\n" + KIT + "\n" + build_js +
            "\nrefPlace(fillCode(CODE_SRC, RUNTIME_SRC));\nproject.userCode = fillCode(CODE_SRC, RUNTIME_SRC);\nproject.userImports = '';\nreturn project.elements.length;")
    steps.append({"script": main})
    steps.append({"script": KIT + "\n" + TAIL})
    rec = {"language": cfg['language'], "name": cfg['name'], "device": cfg.get('device', 'bip-6'), "steps": steps,
           "preview": slug + ".png", "previewAod": slug + "-aod.png", "save": slug + "-project", "out": slug + "-export", "optimizePng": cfg.get('optimizePng', 32)}
    json.dump(rec, open(stem + '.recipe.json', 'w'))
    print('wrote', stem + '.recipe.json')

if __name__ == '__main__':
    for s in sys.argv[1:]: build(s)
