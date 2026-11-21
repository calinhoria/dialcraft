import sys
from PIL import Image
import numpy as np
im=np.array(Image.open(sys.argv[1]).convert('RGB')).astype(int)
x1=int(sys.argv[2]) if len(sys.argv)>2 else 140
m=(im.min(axis=2)>150)[:,:x1]
rows=np.where(m.any(axis=1))[0]; runs=[];st=p=rows[0]
for r in rows[1:]:
    if r>p+1: runs.append((st,p)); st=r
    p=r
runs.append((st,p)); prev=None
for a,b in runs:
    c=np.where(m[a:b+1].any(axis=0))[0]; print(a,b,'h',b-a+1,'gap',(a-prev-1) if prev is not None else '-','x',c.min(),c.max(),'cx',(c.min()+c.max())/2); prev=b
