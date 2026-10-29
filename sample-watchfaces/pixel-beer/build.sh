#!/bin/sh
# Rebuild everything: font, recipe, run the editor, then put the font into the saved project (face-cli's save does not).
set -e
cd "$(dirname "$0")"
python3 make_font.py
GS=100 node gen.js "$@"
(cd ../.. && env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tools/face-cli.js sample-watchfaces/pixel-beer/recipe.json | tail -1)
python3 -I - <<'PY'
import json, glob, os, shutil
f = glob.glob('project/*.wfproj.json')[0]; pr = json.load(open(f))
os.makedirs('project/fonts', exist_ok=True); shutil.copy('PixelLattice.ttf', 'project/fonts/PixelLattice.ttf')
open('project/fonts/LICENSE-PixelLattice.txt', 'w').write('Pixel Lattice - made for this face by make_font.py (squares on a grid, no third-party outlines). Draws the weekday names; no font is shipped in the watchface.\n')
pr['fonts'] = [{'name': 'PixelLattice.ttf', 'family': 'Pixel Lattice'}]; json.dump(pr, open(f, 'w'), indent=1)
PY
