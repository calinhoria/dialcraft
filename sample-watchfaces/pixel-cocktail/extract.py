#!/usr/bin/env python3
"""tv-dlna's whiskey_clock.py (cocktail_notext.py = the same with the clock text removed) -> data.json: the still scene and the cells that change per frame."""
import json, collections, cocktail_notext as R
F = [[[ '%02x%02x%02x' % R.frame(k, '00:00', 0, 'AAA', 0).getpixel((c, r)) for c in range(32)] for r in range(32)] for k in range(R.FRAMES)]
scene = [[collections.Counter(F[k][r][c] for k in range(R.FRAMES)).most_common(1)[0][0] for c in range(32)] for r in range(32)]
frames = [[[None if F[k][r][c] == scene[r][c] else F[k][r][c] for c in range(32)] for r in range(32)] for k in range(R.FRAMES)]
dyn = {(r, c) for k in range(R.FRAMES) for r in range(32) for c in range(32) if frames[k][r][c]}
json.dump({'scene': scene, 'frames': frames, 'bg': '%02x%02x%02x' % R.BG, 'grid': '%02x%02x%02x' % R.BG}, open('data.json', 'w'))
print(len(dyn), 'dynamic cells; rows', min(r for r, c in dyn), max(r for r, c in dyn), 'cols', min(c for r, c in dyn), max(c for r, c in dyn))
