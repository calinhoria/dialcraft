#!/bin/sh
# cut the sheets (only with --cut), build the recipe, render, print the result summary
cd "$(dirname "$0")/.." || exit 1
MOD=$(pwd)
[ "$1" = "--cut" ] && python3 src/cut.py
python3 src/make.py || exit 1
cd ../.. || exit 1
env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tools/face-cli.js "$MOD/recipe.json" 2>&1 | tail -1 | python3 -c "
import sys, json
r = json.loads(sys.stdin.read())
print('ok', r.get('ok'), r.get('error') or '')
for l in r.get('log', []):
    if 'fail' in l: print('LOG', l[:400])
print('\n'.join(r.get('layers', [])))
print('\n'.join(r.get('lint', [])))
print(json.dumps(r.get('export'))[:600])
"
