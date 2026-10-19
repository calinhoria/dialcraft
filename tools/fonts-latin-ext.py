#!/usr/bin/env python3
"""Rebuild the bundled fonts with Latin Extended coverage.

The fontsource CDN serves every Google font split into unicode-range subsets.
The original bundle only took `latin`, which has Â and Î but not Ă, Ș or Ț, so
Romanian (and Polish, Czech, Turkish, …) weekday/month names came out with
those letters borrowed from a system font. This script downloads the `latin`
and `latin-ext` subsets of each family at the weight the designer ships and
merges them into the one TTF in assets/fonts/.

Families with no latin-ext upstream (Orbitron, Share Tech Mono) and the ones
that are not on fontsource (DSEG, the variable Handjet) are left alone — the
designer composes missing accented letters from the font's own glyphs.

    python3 tools/fonts-latin-ext.py            # needs fontTools (pip install fonttools)
"""
import json
import shutil
import os
import sys
import tempfile
import urllib.request

from fontTools.merge import Merger
from fontTools.ttLib import TTFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'fonts')

# file in assets/fonts -> (fontsource id, weight)
FONTS = {
    'Rajdhani-SemiBold.ttf': ('rajdhani', 600),
    'Exo2-SemiBold.ttf': ('exo-2', 600),
    'SpaceGrotesk-Medium.ttf': ('space-grotesk', 500),
    'SairaCondensed-SemiBold.ttf': ('saira-condensed', 600),
    'VT323-Regular.ttf': ('vt323', 400),
    'MajorMonoDisplay-Regular.ttf': ('major-mono-display', 400),
    'PressStart2P-Regular.ttf': ('press-start-2p', 400),
    'Silkscreen-Regular.ttf': ('silkscreen', 400),
    'Doto-Black.ttf': ('doto', 900),
    'BebasNeue-Regular.ttf': ('bebas-neue', 400),
    'Oswald-SemiBold.ttf': ('oswald', 600),
    'Anton-Regular.ttf': ('anton', 400),
    'BarlowCondensed-SemiBold.ttf': ('barlow-condensed', 600),
    'Teko-SemiBold.ttf': ('teko', 600),
    'CormorantGaramond-SemiBold.ttf': ('cormorant-garamond', 600),
    'PlayfairDisplay-SemiBold.ttf': ('playfair-display', 600),
    'Cinzel-SemiBold.ttf': ('cinzel', 600),
    'Marcellus-Regular.ttf': ('marcellus', 400),
    'Inter-Bold.ttf': ('inter', 700),
    'Inter-Thin.ttf': ('inter', 100),
    'Montserrat-Bold.ttf': ('montserrat', 700),
    'Montserrat-Thin.ttf': ('montserrat', 100),
    'Poppins-Regular.ttf': ('poppins', 400),
    'JosefinSans-SemiBold.ttf': ('josefin-sans', 600),
    'RobotoCondensed-Bold.ttf': ('roboto-condensed', 700),
    'RobotoMono-Bold.ttf': ('roboto-mono', 700),
    'OpenSans-Bold.ttf': ('open-sans', 700),
    'Lato-Bold.ttf': ('lato', 700),
}
MUST = '0123456789:.%-/°'
ROMANIAN = 'ăâîșțĂÂÎȘȚ'


def get(url):
    # the API answers 403 to urllib's default user agent
    req = urllib.request.Request(url, headers={'User-Agent': 'dialcraft/fonts-latin-ext'})
    return urllib.request.urlopen(req, timeout=60)


def fetch(url, dest):
    with get(url) as r, open(dest, 'wb') as f:
        f.write(r.read())


def main():
    only = set(sys.argv[1:])
    failed = []
    with tempfile.TemporaryDirectory() as tmp:
        for file, (fid, weight) in FONTS.items():
            if only and file not in only:
                continue
            with get(f'https://api.fontsource.org/v1/fonts/{fid}') as r:
                meta = json.load(r)
            variant = meta['variants'][str(weight)]['normal']
            parts = []
            for subset in ('latin', 'latin-ext'):
                if subset not in variant:
                    continue
                dest = os.path.join(tmp, f'{fid}-{weight}-{subset}.ttf')
                fetch(variant[subset]['url']['ttf'], dest)
                parts.append(dest)
            try:
                merged = Merger().merge(parts)
                out = os.path.join(tmp, file)
                merged.save(out)
                cmap = TTFont(out).getBestCmap()
            except Exception as e:  # keep the shipped file when a merge fails
                failed.append(f'{file}: {e}')
                continue
            lost = [c for c in MUST if ord(c) not in cmap and ord(c) in TTFont(parts[0]).getBestCmap()]
            if lost:
                failed.append(f'{file}: merge lost {"".join(lost)}')
                continue
            shutil.copyfile(out, os.path.join(ROOT, file))
            missing = ''.join(c for c in ROMANIAN if ord(c) not in cmap)
            print(f'{file:34} {os.path.getsize(os.path.join(ROOT, file)):>7} B  ro: {"ok" if not missing else "missing " + missing}')
    for f in failed:
        print('FAILED', f)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
