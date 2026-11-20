import json,base64,os
H=os.path.dirname(os.path.abspath(__file__)); K='/Volumes/Projects/Projects/dialcraft/.claude/skills/create-amazfit-watchface/examples/animated/'
kit=open(K+'kit.js').read(); build=open(H+'/build.js').read(); code=open(H+'/code.js').read()
b64=base64.b64encode(open(K+'fonts/inter-500.ttf','rb').read()).decode()
reg="await registerCustomFont({name:'inter-500.ttf',family:'InterMed',format:'truetype',ext:'.ttf',dataBase64:'%s'}); glyphFont='InterMed'; glyphOpts.size=18; return 1"%b64
steps=[{"script":reg},{"preset":"bg"},{"preset":"clock"},{"edit":"Background","set":{"color":"#000000"}},
 {"edit":"Hour","glyph":{"font":"InterMed","weight":400,"size":78,"color":"#417fb8"}},{"edit":"Minute","glyph":{"font":"InterMed","weight":400,"size":36,"color":"#ffffff"},"set":{"zero":1}},
 {"script":"try {\n"+kit+"\n"+build+"\n} catch (e) { return 'ERR ' + e.stack.split('\\n').slice(0,4).join(' | ') }"}]
rec={"name":"Concentric","device":"bip-6","language":"en-US","steps":steps,"userCode":code,"userImports":"","optimizePng":"lossless",
 "preview":"preview.png","previewAod":"preview-aod.png","save":"project",
 "description":"Concentric, the Pixel Watch face, for the Bip 6: a seconds ring (its ticks are an analog second hand) and a minute ring (one step a minute) that keep the current value at 3 o'clock inside the outline pill that holds the minute; the hour sits in the middle. Recreated from lukakilic's Watch Face Format source."}
json.dump(rec,open(H+'/recipe.json','w'))
