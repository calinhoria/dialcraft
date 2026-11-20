import json, base64, os
H = os.path.dirname(os.path.abspath(__file__)); K = '/Volumes/Projects/Projects/dialcraft/.claude/skills/create-amazfit-watchface/examples/animated/'
kit = open(K + 'kit.js').read(); build = open(H + '/build.js').read()
b64 = base64.b64encode(open(K + 'fonts/inter-500.ttf', 'rb').read()).decode()
reg = "await registerCustomFont({name:'inter-500.ttf',family:'InterMed',format:'truetype',ext:'.ttf',dataBase64:'%s'}); glyphFont='InterMed'; glyphOpts.size=18; return 1" % b64
steps = [{"script": reg}, {"preset": "bg"}, {"preset": "clock"}, {"edit": "Background", "set": {"color": "#000000"}},
         {"script": "try {\n" + kit + "\n" + build + "\n} catch (e) { return 'ERR ' + e.stack.split('\\n').slice(0,4).join(' | ') }"}]
json.dump({"name": "Comet Clock", "device": "bip-6", "language": "en-US", "steps": steps, "optimizePng": "lossless", "preview": "preview.png", "previewAod": "preview-aod.png", "save": "project",
           "description": "A digital clock with a comet that circles the digits once a minute: its place on the circle is the second."}, open(H + '/recipe.json', 'w'))
