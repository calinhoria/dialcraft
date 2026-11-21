from PIL import Image, ImageFilter
import numpy as np
s=np.array(Image.open('images/1.png').convert('RGB')).astype(float)
w=(s.min(axis=2)>170)
m=np.zeros_like(w); H,W=w.shape
for y,x in [(0,0),(0,W-1),(H-1,0),(H-1,W-1)]: m[y,x]=True
while True:
    d=m.copy(); d[1:]|=m[:-1]; d[:-1]|=m[1:]; d[:,1:]|=m[:,:-1]; d[:,:-1]|=m[:,1:]
    d&=w
    if (d==m).all(): break
    m=d
print('corner px',m.sum())
mi=Image.fromarray((m*255).astype('uint8')).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(1.5))
a=np.array(mi)/255.
s=s*(1-a[...,None])
im=Image.fromarray(s.clip(0,255).astype('uint8')).resize((390,450),Image.LANCZOS)
im.save('scratchpad/robo/scene.png')
