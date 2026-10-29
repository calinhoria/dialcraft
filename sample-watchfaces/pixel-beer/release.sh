#!/bin/sh
# Release build from the project saved in the app (never rewrites it): the .zab plus a store/ folder with the images the Zepp console asks for.
#   ./release.sh [name]     -> release-<name>/  (default: en)
set -e
cd "$(dirname "$0")"
N="${1:-en}"; R="release-$N"; ROOT="$(cd ../.. && pwd)"
rm -rf "$R" && mkdir -p "$R/store"
cat > "$R/recipe.json" <<JSON
{"name":"Pixel Beer","device":"bip-6","open":"$PWD/project","preview":"$PWD/$R/preview.png","previewAod":"$PWD/$R/preview-aod.png","out":"$PWD/$R/zeus","build":true,"steps":[]}
JSON
(cd "$ROOT" && env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tools/face-cli.js "$PWD/sample-watchfaces/pixel-beer/$R/recipe.json" | tail -1 | python3 -c "import sys,json;r=json.loads(sys.stdin.read());print('ok',r['ok'],'syntax',r['export']['syntax'],[l for l in r['lint'] if 'error' in l])")
cp "$R"/zeus/dist/*.zab "$R/"
cp "$R/preview.png" "$R/store/preview-390x450.png"
python3 "$ROOT/.claude/skills/create-amazfit-watchface/examples/animated/capture.py" "$PWD/project" "$R/store/preview-390x450.gif" 6 10 0 | tail -1
rm -rf "$R/zeus/dist"
ls -la "$R" "$R/store"
