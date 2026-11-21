import sys
from PIL import Image
import numpy as np
a=np.asarray(Image.open(sys.argv[1] if len(sys.argv)>1 else 'preview.png').convert('RGB')).astype(int)
ink=np.array([120,126,96]); m=np.abs(a-ink).sum(2)<40
m[:30]=False; m[78:]=False; m[:, :140]=False; m[:, 260:]=False
cols=np.where(m.any(0))[0]; runs=[];on=None;prev=None
for c in cols:
    if on is None: on=c
    elif c!=prev+1: runs.append((on,prev)); on=c
    prev=c
runs.append((on,prev))
print([(int(r0),int(r1),int(np.where(m[:,r0:r1+1].any(1))[0].min()), int(np.where(m[:,r0:r1+1].any(1))[0].max())) for r0,r1 in runs])
