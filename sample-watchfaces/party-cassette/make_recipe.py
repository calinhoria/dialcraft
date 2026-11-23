import json, os
H = os.path.dirname(os.path.abspath(__file__)); K = '/Volumes/Projects/Projects/dialcraft/.claude/skills/create-amazfit-watchface/examples/animated/'
kit = open(K + 'kit.js').read(); build = open(H + '/build.js').read().replace('__GEO__', json.dumps(json.load(open(H + '/geometry.json'))))
steps = [{"preset": "bg"}, {"edit": "Background", "set": {"color": "#000000"}},
         {"script": "try {\n" + kit + "\n" + build + "\n} catch (e) { return 'ERR ' + e.stack.split('\\n').slice(0,4).join(' | ') }"}]
json.dump({"name": "Party Cassette", "device": "bip-6", "language": "en-US", "steps": steps, "optimizePng": "lossless", "preview": "preview.png", "previewAod": "preview-aod.png", "save": "project",
           "description": "A black party face recreated from a reference: PARTY with two bolts, an orange cassette whose reels turn slowly, chunky grey time, battery as 83% BATTERY and equaliser blocks along the bottom."}, open(H + '/recipe.json', 'w'))
