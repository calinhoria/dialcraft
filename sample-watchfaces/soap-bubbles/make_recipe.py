import json, os
H = os.path.dirname(os.path.abspath(__file__)); K = '/Volumes/Projects/Projects/dialcraft/.claude/skills/create-amazfit-watchface/examples/animated/'
kit = open(K + 'kit.js').read(); build = open(H + '/build.js').read().replace('__GEO__', json.dumps(json.load(open(H + '/geometry.json'))))
steps = [{"preset": "bg"}, {"edit": "Background", "set": {"color": "#000000"}},
         {"script": "try {\n" + kit + "\n" + build + "\n} catch (e) { return 'ERR ' + e.stack.split('\\n').slice(0,4).join(' | ') }"}]
json.dump({"name": "Soap Bubbles", "device": "bip-6", "language": "en-US", "steps": steps, "optimizePng": "lossless", "preview": "preview.png", "previewAod": "preview-aod.png", "save": "project",
           "description": "Soap bubbles: a dusk scene with a giant bubble around the time and twelve see-through bubbles that rise, sway and pop into droplets (tap one to pop it), twinkling sparkles and three bubble badges for battery, steps and temperature."}, open(H + '/recipe.json', 'w'))
