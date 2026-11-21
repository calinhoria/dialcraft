import sys
from PIL import Image
import numpy as np
f=sys.argv[1]
im=np.array(Image.open(f).convert('RGB')).astype(int)
m=(im[:,:,2]>120)&(im[:,:,0]<90)   # blue panel ink
sub=m[:,266:]
rows=np.where(sub.any(axis=1))[0]
runs=[];st=p=rows[0]
for r in rows[1:]:
    if r!=p+1: runs.append((st,p)); st=r
    p=r
runs.append((st,p))
for a,b in runs:
    c=np.where(sub[a:b+1].any(axis=0))[0]+266; print(a,b,'h',b-a+1,'x',c.min(),c.max(),'cx',(c.min()+c.max())/2)
