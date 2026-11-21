import sys; sys.path.insert(0,'scratchpad/robo')
from blobs import key, runs
from PIL import Image
import numpy as np
O='scratchpad/robo/a/'
def rgba(s,a):
    s=s.copy()
    out=np.dstack([s,a*255]).clip(0,255).astype('uint8'); return Image.fromarray(out,'RGBA')
def bbox(a,thr=0.04):
    ys,xs=np.where(a>thr); return xs.min(),ys.min(),xs.max()+1,ys.max()+1
def scale(im,k): return im.resize((max(1,round(im.width*k)),max(1,round(im.height*k))),Image.LANCZOS)
# ---------- digits ----------
S,A=key('images/2.png'); G,GA=key('images/4.png')
mS=A>0.5
cells=[]
for y0,y1 in [(36,324),(365,652),(688,975)]:
    for x0,x1 in runs(mS[y0:y1].sum(0),1,15): cells.append((x0,y0,x1,y1))
assert len(cells)==11
P=14   # pad around ink (glow)
core=lambda s,a: ((s[...,0]>200)&(s[...,1]>140)&(a>0.9)).astype(float)
TH=100/ (324-36+2*P)   # digit image height 100 px
dig=[];gl=[]
for i,(x0,y0,x1,y1) in enumerate(cells):
    X0,Y0,X1,Y1=x0-P,y0-P,x1+P,y1+P
    b=core(S,A)[Y0:Y1,X0:X1]
    best=(1e18,0,0)
    for dy in range(-14,15):
        for dx in range(-14,15):
            g=core(G,GA)[Y0+dy:Y1+dy,X0+dx:X1+dx]
            d=((g-b)**2).sum()
            if d<best[0]: best=(d,dx,dy)
    _,dx,dy=best
    E=26  # extra right room for the cyan offset
    base=rgba(S[Y0:Y1,X0:X1],A[Y0:Y1,X0:X1])
    ga=GA[Y0+dy:Y1+dy,X0+dx:X1+dx+E].copy(); cs=ga.sum(0); bw=X1-X0
    for cx in range(bw-2*P,ga.shape[1]):
        if cs[cx]<0.5: ga[:,cx:]=0; break
    gli=rgba(G[Y0+dy:Y1+dy,X0+dx:X1+dx+E],ga)
    dig.append(base); gl.append(gli); print(i,'shift',dx,dy,'overlap err',round(best[0]))
mw=max(d.width for d in dig[:10])
def padw(im,w,extra=0):
    c=Image.new('RGBA',(w+extra,im.height)); c.paste(im,((w-(im.width-extra))//2,0)); return c
for i in range(10):
    padw(dig[i],mw).pipe if False else None
    scale(padw(dig[i],mw),TH).save(O+f'd{i}.png')
    scale(padw(gl[i],mw,26),TH).save(O+f'g{i}.png')
scale(dig[10],TH).save(O+'colon.png'); scale(gl[10],TH).save(O+'gcolon.png')
print('digit', Image.open(O+'d0.png').size, 'glitch', Image.open(O+'g0.png').size, 'colon',Image.open(O+'colon.png').size)
# ---------- props ----------
S,A=key('images/3.png')
def crop(x0,x1,y0,y1,p=10):
    a=A[y0-p:y1+p,x0-p:x1+p]; s=S[y0-p:y1+p,x0-p:x1+p]
    l,t,r,b=bbox(a); return rgba(s[t:b,l:r],a[t:b,l:r])
ret=[crop(26,281,40,297),crop(339,552,40,297),crop(635,849,40,297)]
RS=150
for i,r in enumerate(ret):
    k=[0.52,0.62,0.66][i]
    im=scale(r,k); c=Image.new('RGBA',(RS,RS)); c.paste(im,((RS-im.width)//2,(RS-im.height)//2)); c.save(O+f'ret{i}.png'); print('ret',i,im.size)
beam=crop(61,834,380,442,8); scale(beam,356/beam.width).save(O+'beam.png'); print('beam',Image.open(O+'beam.png').size)
for i,(x0,x1) in enumerate([(97,201),(384,506),(692,792)]):
    l=crop(x0,x1,532,655); im=scale(l,30/l.width); c=Image.new('RGBA',(32,32)); c.paste(im,((32-im.width)//2,(32-im.height)//2)); c.save(O+f'led{i}.png')
for nm,(x0,x1) in [('heart',(49,248)),('boot',(390,501)),('bat',(633,851))]:
    crop(x0,x1,723,981).save(O+nm+'_full.png')
print('ok')
