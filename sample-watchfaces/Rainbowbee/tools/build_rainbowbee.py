"""Rainbowbee is a clone of Honeybee and turns its steps + calories blocks into two complication slots.
slot 1: Steps (default) / next sunrise-sunset   slot 2: Calories (default) / temperature
usage: build_honeybee_edit.py <Honeybee project dir> <new project dir> <scratch dir>"""
import base64, copy, glob, io, json, math, os, random, shutil, string, sys
from PIL import Image, ImageDraw
src_dir, new_dir, scratch = sys.argv[1:4]
K = 8                                        # supersampling

def canvas(w, h): return Image.new('RGBA', (w * K, h * K), (0, 0, 0, 0))
def fin(img, w, h): return img.resize((w, h), Image.LANCZOS)
WHITE = (255, 255, 255, 254)

def thermometer():
    im = canvas(35, 35); d = ImageDraw.Draw(im); s = lambda v: int(round(v * K))
    d.rounded_rectangle((s(9.5), s(2), s(20.5), s(23)), s(5.5), fill=WHITE)
    d.ellipse((s(15 - 7.6), s(25.2 - 7.6), s(15 + 7.6), s(25.2 + 7.6)), fill=WHITE)
    hole = Image.new('L', im.size, 0); h = ImageDraw.Draw(hole)           # cut-out like the flame icon
    h.rounded_rectangle((s(13.9), s(8), s(16.1), s(24)), s(1.1), fill=255)
    h.ellipse((s(15 - 2.8), s(25.2 - 2.8), s(15 + 2.8), s(25.2 + 2.8)), fill=255)
    a = im.getchannel('A'); a = Image.composite(Image.new('L', im.size, 0), a, hole); im.putalpha(a)
    d = ImageDraw.Draw(im)
    for y in (7, 12.5, 18):
        d.rounded_rectangle((s(23.5), s(y - 1.5), s(29.5), s(y + 1.5)), s(1.5), fill=WHITE)
    return fin(im, 35, 35)

def sun(arrow):
    im = canvas(35, 35); d = ImageDraw.Draw(im); s = lambda v: int(round(v * K))
    cx, cy = 17.5, 25.8
    d.pieslice((s(cx - 10), s(cy - 10), s(cx + 10), s(cy + 10)), 180, 360, fill=WHITE)
    d.rounded_rectangle((s(2.5), s(28.2), s(32.5), s(32)), s(1.9), fill=WHITE)
    for ang in (20, 55):
        for sg in (-1, 1):
            a = math.radians(ang)
            p = lambda r: (s(cx + sg * math.cos(a) * r), s(cy - math.sin(a) * r))
            d.line((*p(13.4), *p(17.6)), fill=WHITE, width=s(3.4))
            for r in (13.4, 17.6): d.ellipse((p(r)[0] - s(1.7), p(r)[1] - s(1.7), p(r)[0] + s(1.7), p(r)[1] + s(1.7)), fill=WHITE)
    if arrow == 'up':
        d.rounded_rectangle((s(15.9), s(8.5), s(19.1), s(15.2)), s(1.2), fill=WHITE)
        d.polygon([(s(17.5), s(1.8)), (s(23.2), s(9.6)), (s(11.8), s(9.6))], fill=WHITE)
    else:
        d.rounded_rectangle((s(15.9), s(2.8), s(19.1), s(9.5)), s(1.2), fill=WHITE)
        d.polygon([(s(17.5), s(15.2)), (s(23.2), s(8.4)), (s(11.8), s(8.4))], fill=WHITE)
    return fin(im, 35, 35)

DIGIT = (255, 255, 255, 221)                 # same white / alpha as the big_N pictures (cell 18x35, ink rows 8..29)
def colon():
    im = canvas(10, 35); d = ImageDraw.Draw(im); s = lambda v: int(round(v * K))
    for y in (13.2, 24.2): d.ellipse((s(5 - 2.1), s(y - 2.1), s(5 + 2.1), s(y + 2.1)), fill=DIGIT)
    return fin(im, 10, 35)
def degree():
    im = canvas(12, 35); d = ImageDraw.Draw(im); s = lambda v: int(round(v * K))
    d.ellipse((s(6 - 4.6), s(8), s(6 + 4.6), s(17.2)), outline=DIGIT, width=s(2.6))
    return fin(im, 12, 35)
def minus():
    im = canvas(14, 35); d = ImageDraw.Draw(im); s = lambda v: int(round(v * K))
    d.rounded_rectangle((s(3), s(17), s(11), s(20.2)), s(1.5), fill=DIGIT)
    return fin(im, 14, 35)
def frame(alpha):
    im = canvas(120, 137); d = ImageDraw.Draw(im); s = lambda v: int(round(v * K))
    d.rounded_rectangle((s(3), s(3), s(117), s(134)), s(30), outline=(255, 255, 255, alpha), width=s(4))
    return fin(im, 120, 137)

proj_file = glob.glob(os.path.join(src_dir, '*.wfproj.json'))[0]
P = json.load(open(proj_file))
imgs = {i['name']: i for i in P['images']}
def load(n): return Image.open(io.BytesIO(base64.b64decode(imgs[n]['url'].split(',')[1]))).convert('RGBA')
def preview(icon, disc=False):
    base = disc_imgs['img/disc.png'].copy() if disc else load('img/ring_10.png'); base.alpha_composite(icon, (27 if disc else 28, 27 if disc else 28)); return base

import numpy as np
def plain_disc(name):
    im = load(name); a = np.asarray(im).copy(); h, w = a.shape[:2]
    c = a[h // 2, 14].copy()                                   # a pixel of the bare disc
    yy, xx = np.mgrid[0:h, 0:w]; inner = np.hypot(xx - (w - 1) / 2, yy - (h - 1) / 2) < min(h, w) / 2 - 4
    a[..., :3] = c[:3]; a[..., 3] = np.where(inner, c[3], a[..., 3])
    # Honeybee draws the heart disc twice (an image + the tap button on top), so it renders at 1-(1-x)^2 of its own alpha: match that in ONE layer
    x = c[3] / 255.0; k = (1 - (1 - x) ** 2) / x
    a[..., 3] = np.clip(a[..., 3].astype(float) * k, 0, 255).astype('uint8')
    return Image.fromarray(a, 'RGBA')
theme_btns = sorted(n for n in imgs if n.startswith('img/heart_btn__t'))
disc_imgs = {'img/disc.png': plain_disc('img/heart_btn.png')}
for n in theme_btns: disc_imgs[n.replace('heart_btn', 'disc')] = plain_disc(n)
new_imgs = {
    'img/temp_icon.png': thermometer(), 'img/sunrise_icon.png': sun('up'), 'img/sunset_icon.png': sun('down'),
    'img/colon.png': colon(), 'img/deg.png': degree(), 'img/minus.png': minus(),
    'img/sel_slot.png': frame(235), 'img/unsel_slot.png': frame(90),
}
new_imgs['img/prev_steps.png'] = preview(load('img/steps_icon.png'))
new_imgs['img/prev_sun.png'] = preview(new_imgs['img/sunrise_icon.png'], True)
new_imgs.update(disc_imgs)
new_imgs['img/prev_cal.png'] = preview(load('img/cal_icon.png'))
new_imgs['img/prev_temp.png'] = preview(new_imgs['img/temp_icon.png'], True)
os.makedirs(os.path.join(new_dir, 'images', 'img'), exist_ok=True)
for n, im in new_imgs.items():
    buf = io.BytesIO(); im.save(buf, 'PNG'); data = buf.getvalue()
    P['images'] = [i for i in P['images'] if i['name'] != n] + [{'name': n, 'width': im.width, 'height': im.height, 'url': 'data:image/png;base64,' + base64.b64encode(data).decode()}]
    open(os.path.join(new_dir, 'images', n), 'wb').write(data)
for f in glob.glob(os.path.join(src_dir, 'images', 'img', '*')):     # everything else comes along unchanged
    t = os.path.join(new_dir, 'images', 'img', os.path.basename(f))
    if not os.path.exists(t): shutil.copy(f, t)

rid = lambda: 'elm' + ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(11))
E = {e['name']: e for e in P['elements']}
def clone(base, **kw):
    e = copy.deepcopy(E[base]); e['id'] = rid(); e.update(kw); return e
def tie(e, slot, typ): e['editSlot'] = slot; e['editType'] = typ; return e

ring1, ring2, ic_steps, ic_cal, steps, cal = E['Level'], E['Level 2'], E['Image 7'], E['Image 8'], E['Steps'], E['Calories']
ring1['name'], ring2['name'], ic_steps['name'], ic_cal['name'] = 'Steps ring', 'Calories ring', 'Steps icon', 'Calories icon'
SLOT_X, SLOT_W, SLOT_H = 236, 120, 137
def slot(eid, y, name, default, opts):
    base = {'id': rid(), 'kind': 'EDIT_SLOT', 'name': name, 'x': SLOT_X, 'y': y, 'show': 'normal', 'visible': True, 'locked': False, 'group': None, 'alpha': 255,
            'editId': eid, 'w': SLOT_W, 'h': SLOT_H, 'defaultType': default,
            'optionalTypes': [{'type': t, 'preview': p} for t, p in opts],
            'selectImage': 'img/sel_slot.png', 'unSelectImage': 'img/unsel_slot.png', 'tipsBg': '', 'tipsX': 0, 'tipsY': 0, 'tipsWidth': 0, 'tipsMargin': 10}
    return base
s1 = slot(1, 16, 'Complication 1 (steps / sunrise-sunset)', 'STEP', [('STEP', 'img/prev_steps.png'), ('SUN', 'img/prev_sun.png')])
s2 = slot(2, 163, 'Complication 2 (calories / temperature)', 'CAL', [('CAL', 'img/prev_cal.png'), ('TEMPERATURE', 'img/prev_temp.png')])
full_ring = lambda y, nm: clone('Image 7', name=nm, src='img/disc.png', x=251, y=y + 1)   # same filled disc as the heart rate: not a progress reading
sun_ring = full_ring(21, 'Sun disc')
sunrise_ic = clone('Image 7', name='Sunrise icon', src='img/sunrise_icon.png', showWhen='sunrise')
sunset_ic = clone('Image 7', name='Sunset icon', src='img/sunset_icon.png', showWhen='sunset')
rise_tx = clone('Steps', name='Sunrise time', dataType='SUN_RISE', dot='img/colon.png', unit='', showWhen='sunrise')
set_tx = clone('Steps', name='Sunset time', dataType='SUN_SET', dot='img/colon.png', unit='', showWhen='sunset')
temp_ring = full_ring(168, 'Temp disc')
temp_ic = clone('Image 8', name='Temperature icon', src='img/temp_icon.png')
temp_tx = clone('Calories', name='Temperature', dataType='WEATHER_CURRENT', unit='img/deg.png', negative='img/minus.png')
block = [s1, tie(ring1, 1, 'STEP'), tie(ic_steps, 1, 'STEP'), tie(steps, 1, 'STEP'),
         tie(sun_ring, 1, 'SUN'), tie(sunrise_ic, 1, 'SUN'), tie(sunset_ic, 1, 'SUN'), tie(rise_tx, 1, 'SUN'), tie(set_tx, 1, 'SUN'),
         s2, tie(ring2, 2, 'CAL'), tie(ic_cal, 2, 'CAL'), tie(cal, 2, 'CAL'),
         tie(temp_ring, 2, 'TEMPERATURE'), tie(temp_ic, 2, 'TEMPERATURE'), tie(temp_tx, 2, 'TEMPERATURE')]
moved = {id(x) for x in (ring1, ring2, ic_steps, ic_cal, steps, cal)}
els = []; placed = False
for e in P['elements']:
    if id(e) in moved:
        if not placed: els += block; placed = True
        continue
    els.append(e)
P['elements'] = els
if 'img/disc.png' not in P['themes'].get('recolored', []): P['themes'].setdefault('recolored', []).append('img/disc.png')
P['name'] = 'Rainbowbee'; P['appId'] = '2890411'; P['savePath'] = new_dir
P['description'] = 'Rainbowbee: a bee-style digital face with two editable complications (steps or sunrise/sunset, calories or temperature)'
json.dump(P, open(os.path.join(scratch, 'honeybee0.wfproj.json'), 'w'))
os.makedirs(os.path.join(scratch, 'hb0'), exist_ok=True)
json.dump(P, open(os.path.join(scratch, 'hb0', 'Rainbowbee.wfproj.json'), 'w'))
print('ok', len(els), 'layers', len(P['images']), 'images')
