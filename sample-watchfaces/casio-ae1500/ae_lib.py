import numpy as np
from PIL import Image
from collections import deque
import os
PHOTO=os.path.join(os.path.dirname(os.path.abspath(__file__)),'ref','casio-ae1500-green.png')
RGB=np.array(Image.open(PHOTO).convert('RGB')).astype(float); L=RGB.mean(axis=2)
def label(mask):
    h,w=mask.shape; lab=np.zeros((h,w),int); n=0; comps=[]
    ys,xs=np.nonzero(mask)
    for y,x in zip(ys,xs):
        if lab[y,x]: continue
        n+=1; q=deque([(y,x)]); lab[y,x]=n; pts=[]
        while q:
            cy,cx=q.popleft(); pts.append((cy,cx))
            for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
                ny,nx=cy+dy,cx+dx
                if 0<=ny<h and 0<=nx<w and mask[ny,nx] and not lab[ny,nx]: lab[ny,nx]=n; q.append((ny,nx))
        p=np.array(pts); comps.append((len(p),p[:,1].min(),p[:,0].min(),p[:,1].max(),p[:,0].max()))
    return lab,comps
