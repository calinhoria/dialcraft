#!/usr/bin/env python3
"""Run a face's own userCode in the editor's stand-in on a virtual clock and write a GIF of it.

    python3 capture.py <saved project folder> <out.gif> [seconds=9] [fps=12] [start_second=0]

The clock starts at 2026-10-24 10:09:<start_second>, which is the reference time of the previews. Timers and Date are
virtual, so a minute of the face's life takes a few seconds; use start_second=50 to see a minute rollover.
Errors thrown by the code are reported (a clean run prints `errors []`). Needs PIL.
"""
import json, os, sys, subprocess, glob, shutil, tempfile, time
from PIL import Image, ImageDraw
H = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(H, '..', '..', '..', '..', '..'))
CAP = r"""
await loadAllImages();
const secs = %(secs)s, fps = %(fps)s, start = %(start)s;
const T0 = new Date(2026, 9, 24, 10, 9, 0).getTime() + start * 1000;
const RD = Date; let vt = T0;
class VD extends RD { constructor(...a) { if (a.length) super(...a); else super(vt); } static now() { return vt; } }
window.Date = VD;
let q = []; let nid = 0; const rs = window.setTimeout, ri = window.setInterval, rc = window.clearTimeout, rci = window.clearInterval;
window.setTimeout = (f, ms) => { const id = ++nid; q.push({ id, f, at: vt + (ms || 0) }); return id; };
window.setInterval = (f, ms) => { const id = ++nid; q.push({ id, f, at: vt + ms, rep: ms }); return id; };
window.clearTimeout = window.clearInterval = (id) => { q = q.filter((t) => t.id !== id); };
const errs = [];
try {
  startCodeRun();
  const N = Math.round(secs * fps), dt = 1000 / fps;
  for (let i = 0; i < N; i++) {
    const target = T0 + i * dt;
    for (;;) { q.sort((a, b) => a.at - b.at); const n = q[0]; if (!n || n.at > target) break; vt = n.at; if (n.rep) n.at += n.rep; else q.shift(); try { n.f(); } catch (e) { errs.push(String(e && e.message || e)); } }
    vt = target;
    const b64 = await composePreviewB64();
    project.images.push({ name: 'cap/' + String(i).padStart(3, '0') + '.png', width: dev().w, height: dev().h, url: 'data:image/png;base64,' + b64 });
  }
  stopCodeRun();
} finally { window.Date = RD; window.setTimeout = rs; window.setInterval = ri; window.clearTimeout = rc; window.clearInterval = rci; }
project.description = JSON.stringify({ errs: errs.slice(0, 5) });
return errs.length;
"""
def main(proj, out, secs=9, fps=12, start=0):
    tmp = tempfile.mkdtemp(); cap = os.path.join(tmp, 'cap')
    rec = {"name": "cap", "open": os.path.abspath(proj), "steps": [{"script": CAP % dict(secs=secs, fps=fps, start=start)}], "save": cap}
    json.dump(rec, open(os.path.join(tmp, 'r.json'), 'w'))
    t0 = time.time()
    r = subprocess.run(['env', '-u', 'ELECTRON_RUN_AS_NODE', 'node_modules/.bin/electron', 'tools/face-cli.js', os.path.join(tmp, 'r.json')], cwd=ROOT, capture_output=True, text=True)
    d = json.loads(r.stdout.strip().splitlines()[-1])
    bad = [l for l in d['log'] if 'fail' in l]
    if bad or not d.get('ok'): print('FAILED', d.get('error'), bad); return 1
    info = json.loads(json.load(open(glob.glob(cap + '/*.wfproj.json')[0]))['description'])
    fr = sorted(glob.glob(cap + '/images/cap/*.png'))
    mask = Image.new('L', (390, 450), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, 389, 449], radius=86, fill=255)   # the Bip 6 corners
    frames = []
    for f in fr:
        im = Image.open(f).convert('RGB'); b = Image.new('RGB', im.size, (20, 20, 24)); b.paste(im, (0, 0), mask if im.size == (390, 450) else None); frames.append(b.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=int(1000 / fps), loop=0, optimize=True, disposal=1)
    shutil.rmtree(tmp, ignore_errors=True)
    print('frames', len(fr), 'errors', info['errs'], 'gif', os.path.getsize(out), 'bytes', round(time.time() - t0, 1), 's'); return 0
if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) < 2: sys.exit(__doc__)
    sys.exit(main(a[0], a[1], float(a[2]) if len(a) > 2 else 9, int(a[3]) if len(a) > 3 else 12, float(a[4]) if len(a) > 4 else 0))
