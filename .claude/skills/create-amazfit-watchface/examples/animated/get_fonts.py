#!/usr/bin/env python3
"""Fetch free (OFL) fonts from Fontsource and merge their `latin` and `latin-ext` subsets into one TTF each.

    python3 get_fonts.py figtree:700 jetbrains-mono:700 instrument-serif:400   # -> fonts/<id>-<weight>.ttf

Fontsource splits every family into unicode-range subsets; `latin` alone has no ă ș ț, so Romanian (and Polish, Czech,
Turkish ...) letters would be borrowed from a system font. The merged file carries them. The script reports what is still
missing, because some families have no latin-ext or lack ș/ț even in it (Righteous, Fredoka, Audiowide ...): pick another.
Needs fontTools (pip install fonttools).
"""
import json, os, sys, tempfile, urllib.request
from fontTools.merge import Merger
from fontTools.ttLib import TTFont
H = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(H, 'fonts'); os.makedirs(OUT, exist_ok=True)
NEED = 'ăâîșțĂÂÎȘȚ0123456789:.%°'
def get(u): return urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'dialcraft/get-fonts'}), timeout=60)
for arg in sys.argv[1:]:
    fid, w = arg.split(':'); meta = json.load(get('https://api.fontsource.org/v1/fonts/' + fid)); v = meta['variants'].get(w, {}).get('normal')
    if not v: print(arg, 'no such weight; has', sorted(meta['variants'])[:8]); continue
    with tempfile.TemporaryDirectory() as tmp:
        parts = []
        for sub in ('latin', 'latin-ext'):
            if sub in v:
                d = os.path.join(tmp, sub + '.ttf'); open(d, 'wb').write(get(v[sub]['url']['ttf']).read()); parts.append(d)
        font = Merger().merge(parts) if len(parts) > 1 else TTFont(parts[0]); out = os.path.join(OUT, f'{fid}-{w}.ttf'); font.save(out)
    cm = TTFont(out).getBestCmap(); miss = ''.join(c for c in NEED if ord(c) not in cm)
    print(f'{arg:28} {os.path.getsize(out):>7} B  ->  {out}   ' + ('covers Romanian and digits' if not miss else 'MISSING ' + miss))
