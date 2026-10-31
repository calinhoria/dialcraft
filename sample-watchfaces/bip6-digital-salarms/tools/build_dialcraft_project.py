"""Builds a Dialcraft project (.wfproj.json + images/) from the old saved project + the freshly generated assets.
usage: build_dialcraft_project.py <old project dir> <new project dir> <new name>"""
import base64, json, os, sys, glob, shutil
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.join(here, '..')
old_dir, new_dir, name = sys.argv[1:4]
lay = json.load(open(os.path.join(root, 'layout.json')))
L, gc = lay['layout'], lay['gauge_c']
old = json.load(open(glob.glob(os.path.join(old_dir, '*.wfproj.json'))[0]))
els = {e['name']: e for e in old['elements']}

def put(e, x, y, w=None, h=None):
    e['x'], e['y'] = int(x), int(y)
    if w is not None: e['w'], e['h'] = int(w), int(h)

els['Image']['name'] = 'Background'
put(els['Weekday'], *L['week'])
els['Day']['images'] = [f'dt_{i}.png' for i in range(10)]
put(els['Day'], *L['day']); put(els['Month'], *L['month'])
els['Level']['name'] = 'Battery icon'; put(els['Battery icon'] if 'Battery icon' in els else els['Level'], *L['bat_icon'])
put(els['Battery'], *L['battery']); put(els['Calories'], *L['cal'])
put(els['Hour'], *L['hour']); put(els['Minute'], *L['minute']); put(els['Second'], *L['second'])
put(els['Steps'], *L['steps']); put(els['Heart rate'], *L['hr'])
a = els['Analog clock']; a['centerX'], a['centerY'] = gc; a['secondPivotX'], a['secondPivotY'] = 4, lay['needle_len']
els['Image 2']['name'] = 'Gauge hub'; put(els['Image 2'], *L['hub'])
els['Image 3']['name'] = 'Glass glare'
for n, nn in (('Hour', 'Hour Main'), ('Minute', 'Minute Main'), ('Second', 'Second Main')): els[n]['name'] = nn
# project order = bottom to top; clock parts: second, minute, hour (Layers panel reads hour, minute, second top to bottom)
order = ['Background', 'Weekday', 'Day', 'Month', 'Level', 'Battery', 'Calories', 'Second', 'Minute', 'Hour', 'Steps', 'Heart rate',
         'Analog clock', 'Image 2', 'Image 3']
names = {'Level': 'Battery icon', 'Image': 'Background', 'Image 2': 'Gauge hub', 'Image 3': 'Glass glare',
         'Second': 'Second Main', 'Minute': 'Minute Main', 'Hour': 'Hour Main'}
byname = {e['name']: e for e in old['elements']}
new = [byname[names.get(n, n)] for n in order]
old['groups'] = {'gDate': 'Date', 'gBatt': 'Battery', 'gClock': 'Clock Main'}
for n, g in (('Weekday', 'gDate'), ('Day', 'gDate'), ('Month', 'gDate'), ('Battery icon', 'gBatt'), ('Battery', 'gBatt'),
             ('Second Main', 'gClock'), ('Minute Main', 'gClock'), ('Hour Main', 'gClock')):
    byname[n]['group'] = g
old['elements'] = new
old['name'] = name
imgs = []
os.makedirs(os.path.join(new_dir, 'images'), exist_ok=True)
for f in sorted(os.listdir(os.path.join(root, 'assets'))):
    if not f.endswith('.png') or f == 'icon.png': continue
    p = os.path.join(root, 'assets', f); w, h = Image.open(p).size
    imgs.append({'name': f, 'width': w, 'height': h, 'url': 'data:image/png;base64,' + base64.b64encode(open(p, 'rb').read()).decode()})
    shutil.copy(p, os.path.join(new_dir, 'images', f))
old['images'] = imgs
json.dump(old, open(os.path.join(new_dir, name + '.wfproj.json'), 'w'))
print('project written:', new_dir, len(new), 'layers,', len(imgs), 'images')
