import json, os
H = os.path.dirname(os.path.abspath(__file__)); K = '/Volumes/Projects/Projects/dialcraft/.claude/skills/create-amazfit-watchface/examples/animated/'
kit = open(K + 'kit.js').read(); build = open(H + '/build.js').read().replace('__GEO__', json.dumps(json.load(open(H + '/geometry.json'))))
steps = [{"preset": "bg"}, {"edit": "Background", "set": {"color": "#000000"}},
         {"script": "try {\n" + kit + "\n" + build + "\n} catch (e) { return 'ERR ' + e.stack.split('\\n').slice(0,4).join(' | ') }"}]
json.dump({"name": "Flow Glass", "device": "bip-6", "language": "en-US", "steps": steps, "optimizePng": "lossless", "preview": "preview.png", "previewAod": "preview-aod.png", "save": "project",
           "description": "A Flow-style face: soft glows drift over a dark base on canvases (they are only moved, so it stays smooth), the time stacked in tall plain digits. Tap to change the colour: pink, teal, violet, amber."}, open(H + '/recipe.json', 'w'))
