import json, os
H = os.path.dirname(os.path.abspath(__file__)); K = '/Volumes/Projects/Projects/dialcraft/.claude/skills/create-amazfit-watchface/examples/animated/'
kit = open(K + 'kit.js').read(); build = open(H + '/build.js').read().replace('__GEO__', json.dumps(json.load(open(H + '/geometry.json'))))
steps = [{"preset": "bg"}, {"edit": "Background", "set": {"color": "#000000"}},
         {"script": "try {\n" + kit + "\n" + build + "\n} catch (e) { return 'ERR ' + e.stack.split('\\n').slice(0,4).join(' | ') }"}]
json.dump({"name": "Casio AE-1500", "device": "bip-6", "language": "en-US", "steps": steps, "optimizePng": "lossless", "preview": "preview.png", "previewAod": "preview-aod.png", "save": "project",
           "description": "A Casio AE-1500 style digital: the LCD and the green resin case cut from a photo (the case is a separate layer), 12-hour time with the P mark, seconds, weekday and date in the watch's own segment font, and a black theme (tap the bottom band)."}, open(H + '/recipe.json', 'w'))
