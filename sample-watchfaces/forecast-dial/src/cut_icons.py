from PIL import Image
import numpy as np, os
IM = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sheets') + '/'   # the five generated icon sheets (11-15.png: icons 1-9 and so on, see README.md); the cut-out masters are in icons/
SHEETS = [('11.png', 3, 3, ['globe', 'runner', 'compass', 'moon', 'sunrise', 'wind', 'bolt', 'steps', 'heart']),
          ('12.png', 3, 3, ['flame', 'sunny', 'cloudy', 'overcast', 'rain_light', 'rain_heavy', 'thunder', 'snow', 'sleet']),
          ('13.png', 3, 2, ['fog', 'dust', 'night_clear', 'night_cloudy', 'night_rain', 'unknown']),
          ('14.png', 3, 3, ['shower', 'snow_shower', 'rain_mod', 'snow_light', 'snow_mod', 'snow_heavy', 'thundershower', 'snowstorm', 'rain_hail']),
          ('15.png', 3, 3, ['thunder_hail', 'rainstorm_heavy', 'rainstorm', 'rain_extreme', 'haze', 'sandstorm', 'sand_blowing', 'sandstorm_strong'])]
M = 240
sheet = Image.new('RGB', (M * 6, M * 6), (40, 40, 40)); k = 0
for fn, cols, rows, names in SHEETS:
    a = np.array(Image.open(IM + fn).convert('RGB')).astype(float)
    H, W, _ = a.shape
    gbg = float(np.median(a[:30, :30, 1]))                  # this sheet's own background green level
    alpha = np.clip((a[:, :, 1] - gbg - 12) / (255 - gbg - 40), 0, 1)       # white lines over magenta: green channel is the coverage
    for i, n in enumerate(names):
        if n is None: continue
        r, c = divmod(i, cols)
        x0, x1, y0, y1 = c * W // cols, (c + 1) * W // cols, r * H // rows, (r + 1) * H // rows
        cell = alpha[y0:y1, x0:x1]
        ys, xs = np.where(cell > 0.25)
        bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        crop = cell[by0:by1, bx0:bx1]
        s = max(crop.shape); pad = np.zeros((s, s)); oy, ox = (s - crop.shape[0]) // 2, (s - crop.shape[1]) // 2
        pad[oy:oy + crop.shape[0], ox:ox + crop.shape[1]] = crop
        img = Image.fromarray((pad * 255).astype(np.uint8)).resize((M - 16, M - 16), Image.LANCZOS)
        out = Image.new('RGBA', (M, M), (255, 255, 255, 0)); out.putalpha(Image.new('L', (M, M), 0))
        al = Image.new('L', (M, M), 0); al.paste(img, (8, 8)); rgba = Image.merge('RGBA', [Image.new('L', (M, M), 255)] * 3 + [al])
        rgba.save(f'icons/{n}.png')
        tile = Image.new('RGB', (M, M), (40, 40, 40)); tile.paste(rgba, (0, 0), rgba); sheet.paste(tile, ((k % 6) * M, (k // 6) * M)); k += 1
        print(n, 'bbox in cell', (bx1 - bx0, by1 - by0), 'stroke~', end=' ')
        print()
sheet.save('icons_sheet.png')
