#!/bin/bash
set -e
H=/Volumes/Projects/Projects/dialcraft/sample-watchfaces/flow-glass; ROOT=/Volumes/Projects/Projects/dialcraft
cd "$H" && rm -rf project out_build preview.png preview-aod.png && python3 art.py >/dev/null && python3 make_recipe.py
cli() { cd "$ROOT" && env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tools/face-cli.js "$1" 2>&1 | tail -1 | python3 -c "import sys,json;r=json.loads(sys.stdin.read());print('ok' if r['ok'] else 'FAILED', r.get('error') or '');print(json.dumps(r.get('log'))[:500]);print(r.get('lint'));print(json.dumps(r.get('export'))[:300])"; }
cli "$H/recipe.json"
python3 "$H/post.py"
cli "$H/export.json"
# the folder out/flow-glass is only updated in place (never deleted), so a terminal or a zeus bridge that is open in it keeps working
mkdir -p "$H/out/flow-glass" && rsync -a --delete --exclude dist --exclude node_modules --exclude ".zeus*" "$H/out_build/flow-glass/" "$H/out/flow-glass/" && rm -rf "$H/out_build"
