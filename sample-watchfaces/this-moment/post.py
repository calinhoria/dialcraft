#!/usr/bin/env python3
"""After face-cli: put the font into the saved project (face-cli's save does not), so Dialcraft re-renders the date in Saira, not a fallback."""
import glob, json, os, shutil
H = os.path.dirname(os.path.abspath(__file__)); P = H + '/project'
os.makedirs(P + '/fonts', exist_ok=True); shutil.copy(H + '/build/saira-500.ttf', P + '/fonts/saira-500.ttf')
open(P + '/fonts/LICENSE-saira.txt', 'w').write('Saira (saira-500.ttf) - SIL Open Font License 1.1, from Fontsource (fonts.google.com). Used to draw the weekday and day images.\n')
f = glob.glob(P + '/*.wfproj.json')[0]; pr = json.load(open(f))
pr['fonts'] = [{'name': 'saira-500.ttf', 'family': 'Saira Medium'}]
open(f, 'w').write(json.dumps(pr, indent=2, ensure_ascii=False)); print('fonts', pr['fonts'])
