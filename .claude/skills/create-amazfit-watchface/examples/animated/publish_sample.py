#!/usr/bin/env python3
"""Publish a built face as a sample: sample-watchfaces/<name>/ with recipe.json, previews, the editable project (fonts included) and the Zeus export.

    python3 publish_sample.py faces/receipt bon-fiscal "A thermal receipt that prints your readings every minute."

It copies the recipe with sample-style paths, runs it in place (so every file is regenerated, nothing is copied by hand), puts the font files
and their `fonts` entries into the project (face-cli's save does not write fonts), writes an OFL note, reopens the project to check that every
font registers and that it renders identically to its preview, and prints the sprite count and export size. Refuses to overwrite a folder.
"""
import json, os, sys, glob, shutil, subprocess
from PIL import Image, ImageChops
H = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(H, '..', '..', '..', '..', '..'))
CHECK = r"""
const used = new Set(); for (const e of project.elements) if (e.glyph && e.glyph.font) used.add(e.glyph.font);
const reg = customFonts.map((f) => f.family); const bad = [...used].filter((f) => !reg.includes(f) && !BUNDLED_FONTS.some((b) => b.family === f));
return JSON.stringify({ registered: reg, missing: bad });
"""
def face_cli(recipe):
    r = subprocess.run(['env', '-u', 'ELECTRON_RUN_AS_NODE', 'node_modules/.bin/electron', 'tools/face-cli.js', recipe], cwd=ROOT, capture_output=True, text=True)
    return json.loads(r.stdout.strip().splitlines()[-1])
def main(stem, name, desc):
    stem = os.path.abspath(stem); cfg = json.load(open(stem + '.face.json')); d = os.path.join(ROOT, 'sample-watchfaces', name)
    if os.path.exists(d): sys.exit('sample-watchfaces/%s exists; choose another name' % name)
    os.makedirs(d); r = json.load(open(stem + '.recipe.json'))
    r.update(preview='preview.png', previewAod='preview-aod.png', save='project', out='out/' + name, description=desc)
    json.dump(r, open(d + '/recipe.json', 'w'), indent=1)
    res = face_cli(d + '/recipe.json')
    errs = [l for l in res['lint'] if l.startswith('error')]; bad = [l for l in res['log'] if 'fail' in l]
    f = glob.glob(d + '/project/*.wfproj.json')[0]; pr = json.load(open(f)); os.makedirs(d + '/project/fonts', exist_ok=True)
    for fn, fam in cfg['fonts']:
        shutil.copy(os.path.join(H, 'fonts', fn), d + '/project/fonts/' + fn)
        open(d + '/project/fonts/LICENSE-%s.txt' % fn.split('-')[0], 'w').write('%s (%s) - SIL Open Font License 1.1, from Fontsource (fonts.google.com); latin and latin-ext merged. Used only to draw digit, weekday and text images; no font is shipped in the watchface.\n' % (fam, fn))
    pr['fonts'] = [{'name': fn, 'family': fam} for fn, fam in cfg['fonts']]; pr['font'] = cfg['fonts'][0][1]
    open(f, 'w').write(json.dumps(pr, indent=2, ensure_ascii=False))
    sp = [i for i in pr['images'] if i['name'].startswith('sp/')]
    sb = sum(os.path.getsize('%s/project/images/%s' % (d, i['name'])) for i in sp)
    ex = sum(os.path.getsize(os.path.join(rr, ff)) for rr, _, fs in os.walk('%s/out/%s/assets' % (d, name)) for ff in fs)
    chk = {"name": "c", "open": d + '/project', "steps": [{"script": CHECK}], "preview": d + '/.reopen.png'}
    json.dump(chk, open(d + '/.check.json', 'w')); c = face_cli(d + '/.check.json')
    info = json.loads([l for l in c['log'] if l.startswith('script')][0][len('script → '):].strip('"').replace('\\"', '"'))
    same = ImageChops.difference(Image.open(d + '/preview.png').convert('RGB'), Image.open(d + '/.reopen.png').convert('RGB')).getbbox() is None
    os.remove(d + '/.check.json'); os.remove(d + '/.reopen.png')
    print('%s: ok=%s lint errors=%s step failures=%s syntax=%s export warnings=%s' % (name, res['ok'], errs, bad, res['export']['syntax'], res['export']['warnings']))
    print('   unique sprites %d (%d KB), export assets %d KB, fonts missing on reopen: %s, reopened render identical: %s' % (len(sp), sb // 1024, ex // 1024, info['missing'], same))
if __name__ == '__main__':
    if len(sys.argv) < 4: sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2], sys.argv[3])
