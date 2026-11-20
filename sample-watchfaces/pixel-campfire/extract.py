#!/usr/bin/env python3
"""tv-dlna's campfire_clock.py (copied as campfire_ref.py with the text block removed) -> data.json: the still scene and, per frame, the cells that differ from it."""
import json, collections, campfire_ref as R
F = [[[ '%02x%02x%02x' % R.frame(k, '00:00', 0, 'AAA', 0).getpixel((c, r)) for c in range(32)] for r in range(32)] for k in range(R.FRAMES)]
scene = [[collections.Counter(F[k][r][c] for k in range(R.FRAMES)).most_common(1)[0][0] for c in range(32)] for r in range(32)]
frames = [[[None if F[k][r][c] == scene[r][c] else F[k][r][c] for c in range(32)] for r in range(32)] for k in range(R.FRAMES)]
json.dump({'scene': scene, 'frames': frames}, open('data.json', 'w'))
dyn = {(r, c) for k in range(R.FRAMES) for r in range(32) for c in range(32) if frames[k][r][c]}
print(len(dyn), 'dynamic cells, rows', min(r for r, c in dyn), '-', max(r for r, c in dyn))
