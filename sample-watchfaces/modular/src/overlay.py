"""50 % overlay of the reference weather block (scaled so its column pitch equals ours) on our render. python3 src/overlay.py out.png [temp_cy]"""
from PIL import Image
import numpy as np, sys, os
MOD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ref = Image.open('/private/tmp/claude-501/-Volumes-Projects-Projects-dialcraft/57fefc98-9303-4636-a950-b8857b00419a/images/14.png').convert('RGB')
s = 66 / 48.4                       # reference dividers are 48.4 px apart, ours 66
tcy = float(sys.argv[2]) if len(sys.argv) > 2 else 244   # where our NOW temperature is centred; the reference's is at y 38
r2 = ref.resize((int(ref.width * s), int(ref.height * s)), Image.LANCZOS)
ours = Image.open(MOD + '/preview.png').convert('RGB')
base = Image.new('RGB', ours.size, (0, 0, 0))
ox = int(round(32 - 32 * s)); oy = int(round(tcy - 38 * s))
base.paste(r2, (ox, oy))
a = np.array(ours).astype(float); b = np.array(base).astype(float)
# ours in cyan, the reference in red: where they coincide the pixel turns white
o = np.zeros_like(a); o[:, :, 1] = a.max(2); o[:, :, 2] = a.max(2); o[:, :, 0] = np.maximum(b.max(2), 0)
Image.fromarray(np.clip(o, 0, 255).astype(np.uint8)).crop((0, 180, 390, 345)).resize((780, 330), Image.LANCZOS).save(sys.argv[1])
