#!/usr/bin/env python3
"""recipe.tpl.json + PNG assets -> recipe.json (images injected as base64 for the editor)."""
import base64, io, json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))

def b64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()

# logo downscaled to its final on-screen size (crisp, no watch-side scaling)
logo = Image.open(os.path.join(HERE, "logo_white.png")).convert("RGBA")
logo = logo.resize((320, 100), Image.LANCZOS)
buf = io.BytesIO()
logo.save(buf, format="PNG")
logo_b64 = base64.b64encode(buf.getvalue()).decode()

imgs = [("bg.png", 390, 450, b64(os.path.join(HERE, "bg.png"))),
        ("logo_white.png", 320, 100, logo_b64)]
for i in range(10):
    imgs.append((f"fizz_{i}.png", 390, 450, b64(os.path.join(HERE, f"fizz_{i}.png"))))

js = (
    "const IMGS = " + json.dumps(imgs) + ";\n"
    "for (const [name, w, h, data] of IMGS) { const rec = { name, width: w, height: h, url: 'data:image/png;base64,' + data }; "
    "const i = project.images.findIndex((x) => x.name === name); if (i >= 0) project.images[i] = rec; else project.images.push(rec); }\n"
    "return IMGS.length;"
)

tpl = open(os.path.join(HERE, "recipe.tpl.json")).read()
if "__IMAGES__" not in tpl:
    raise SystemExit("placeholder __IMAGES__ not found in recipe.tpl.json")
# escape as the contents of a JSON string (the script sits inside one)
recipe = tpl.replace("__IMAGES__", json.dumps(js)[1:-1])
open(os.path.join(HERE, "recipe.json"), "w").write(recipe)
print("recipe.json written,", len(imgs), "images")

# --nofizz: measurement twin without the animation, so no bubbles pollute the ink boxes
if "--nofizz" in sys.argv:
    r = json.loads(recipe)
    r["steps"] = [s for s in r["steps"] if s.get("name") != "Fizz"]
    r["preview"] = "preview-measure.png"
    r["previewAod"] = None
    r["save"] = r["out"] = None
    open(os.path.join(HERE, "recipe-measure.json"), "w").write(json.dumps(r, indent=1))
    print("recipe-measure.json written")
