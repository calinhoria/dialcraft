import json, glob, os, shutil
from PIL import Image
H = os.path.dirname(os.path.abspath(__file__))
pf = glob.glob(H + '/project/*.wfproj.json')[0]; p = json.load(open(pf))
n = 0
for src in glob.glob(H + '/assets/sb/*.png'):
    name = 'sb/' + os.path.basename(src); dst = H + '/project/images/' + name
    os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copy(src, dst)
    w, h = Image.open(dst).size; rec = next((i for i in p['images'] if i['name'] == name), None)
    if rec: rec['width'], rec['height'] = w, h; n += 1
json.dump(p, open(pf, 'w')); print('pictures placed', n)
