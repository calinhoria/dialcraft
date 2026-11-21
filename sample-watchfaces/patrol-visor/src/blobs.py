from PIL import Image
import numpy as np, sys
def key(path):
    s=np.array(Image.open(path).convert('RGB')).astype(float)
    r,g,b=s[...,0],s[...,1],s[...,2]
    K=np.median(s[:12,:12].reshape(-1,3),axis=0)          # the real background colour
    k=0.35                                                 # glow hue: g = k*r
    a1=1-(g-k*r)/K[1]
    a2=b/230.0
    a3=(r-g-25)/30.0
    a=np.clip(np.maximum(np.maximum(a1,a2),a3),0,1)
    a[a<0.04]=0
    F=(s-(1-a)[...,None]*K)/np.maximum(a,1e-3)[...,None]
    key.F=np.clip(F,0,255)
    return np.clip(F,0,255),a
def runs(v,thr,mingap=6):
    on=v>thr; out=[]; i=0; n=len(v)
    while i<n:
        if on[i]:
            j=i
            while j<n and (on[j] or (j+mingap<n and on[j:j+mingap].any())): j+=1
            out.append((i,j)); i=j
        else: i+=1
    return out
if __name__=='__main__':
    for p in sys.argv[1:]:
        s,a=key(p); m=a>0.5
        rows=runs(m.sum(1),2,20); print(p,'rows',rows)
        for y0,y1 in rows:
            print('  ',y0,y1,'cols',runs(m[y0:y1].sum(0),1,15))
