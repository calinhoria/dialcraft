from PIL import Image, ImageFilter
import numpy as np, io, base64, json
# (key, final px size, colour) groups; each baked once per (size, colour)
SPEC = {
  'sc':  (['globe', 'runner', 'compass', 'moon'], 30, (218, 221, 226)),
  'ring': (['bolt', 'steps', 'heart', 'flame'], 19, (255, 176, 32)),
  'info': (['sunrise', 'wind'], 28, (255, 176, 32)),
  'wx':  (['cloudy', 'shower', 'snow_shower', 'sunny', 'overcast', 'rain_light', 'snow_light', 'rain_mod', 'snow_mod', 'snow_heavy', 'rain_heavy', 'sandstorm', 'sleet', 'fog', 'haze', 'thundershower', 'snowstorm', 'dust', 'rain_extreme', 'rain_hail', 'thunder_hail', 'rainstorm_heavy', 'sand_blowing', 'sandstorm_strong', 'rainstorm', 'unknown', 'night_cloudy', 'night_rain', 'night_clear'], 34, (244, 244, 244)),
  'fc':  (['cloudy', 'shower', 'snow_shower', 'sunny', 'overcast', 'rain_light', 'snow_light', 'rain_mod', 'snow_mod', 'snow_heavy', 'rain_heavy', 'sandstorm', 'sleet', 'fog', 'haze', 'thundershower', 'snowstorm', 'dust', 'rain_extreme', 'rain_hail', 'thunder_hail', 'rainstorm_heavy', 'sand_blowing', 'sandstorm_strong', 'rainstorm', 'unknown', 'night_cloudy', 'night_rain', 'night_clear'], 20, (244, 244, 244)),
}
def bake(key, size, col):
    m = Image.open(f'icons/{key}.png').split()[3]
    ss = 4; big = m.resize((size * ss, size * ss), Image.LANCZOS)
    stroke = 0.056 * size; d = max(0.0, (2.2 - stroke) / 2)         # make the line at least ~2.2 px at the final size
    r = int(round(d * ss))
    if r > 0: big = big.filter(ImageFilter.MaxFilter(2 * r + 1))
    al = big.resize((size, size), Image.LANCZOS)
    rgba = Image.merge('RGBA', [Image.new('L', (size, size), c) for c in col] + [al])
    b = io.BytesIO(); rgba.save(b, 'PNG', optimize=True); return base64.b64encode(b.getvalue()).decode()
out = {}
for grp, (keys, size, col) in SPEC.items():
    out[grp] = {'size': size, 'icons': {k: bake(k, size, col) for k in keys}}
json.dump(out, open('icons.json', 'w'))
print({g: (v['size'], len(v['icons'])) for g, v in out.items()}, sum(len(x) for v in out.values() for x in v['icons'].values()) // 1024, 'KB base64')
