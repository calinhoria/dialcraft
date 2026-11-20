import json, glob, shutil, os
H = os.path.dirname(os.path.abspath(__file__)); K = '/Volumes/Projects/Projects/dialcraft/.claude/skills/create-amazfit-watchface/examples/animated/fonts/inter-500.ttf'
f = glob.glob(H + '/project/*.wfproj.json')[0]; p = json.load(open(f)); os.makedirs(H + '/project/fonts', exist_ok=True)
shutil.copy(K, H + '/project/fonts/inter-500.ttf')
open(H + '/project/fonts/LICENSE-inter.txt', 'w').write('Inter - SIL Open Font License 1.1 (fonts.google.com). Used only to draw the dial numerals; no font is shipped in the watchface.\n')
p['fonts'] = [{'name': 'inter-500.ttf', 'family': 'InterMed'}]; p['font'] = 'InterMed'
for n in ('dial.png', 'second_hand.png'):          # left over from the Analog clock preset, not used
    p['images'] = [i for i in p['images'] if i['name'] != n]
    fp = H + '/project/images/' + n
    if os.path.exists(fp): os.remove(fp)
json.dump(p, open(f, 'w'))
