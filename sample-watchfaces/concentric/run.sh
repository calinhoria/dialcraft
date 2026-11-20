#!/bin/bash
# Builds Concentric from scratch: layers (face-cli + build.js), ring frames (frames.py), font into the project, then the Zeus export.
set -e
H=/Volumes/Projects/Projects/dialcraft/sample-watchfaces/concentric; ROOT=/Volumes/Projects/Projects/dialcraft
cd "$H" && rm -rf project out preview.png preview-aod.png && python3 make_recipe.py
cli() { cd "$ROOT" && env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tools/face-cli.js "$1" 2>&1 | tail -1 | python3 -c "import sys,json;r=json.loads(sys.stdin.read());print('ok' if r['ok'] else 'FAILED', r.get('error') or '');print([l[:300] for l in r['log'] if 'fail' in l or 'ERR' in l]);print(*r.get('lint',[]),sep='\n');print(r.get('export'))"; }
cli "$H/recipe.json"
python3 "$H/frames.py"
python3 "$H/fix_project.py"
cli "$H/export.json"
