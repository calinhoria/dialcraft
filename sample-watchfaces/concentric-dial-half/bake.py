#!/usr/bin/env python3
"""Bakes the Concentric Dial Half pictures into project/images (run from this folder, then face-cli on recipe.json):
right-half tick ring, dim always-on still, 5 seconds strips (one colour per theme), 2 fade masks, 1 transparent tap pad."""
import math,os,json
from PIL import Image,ImageDraw,ImageFont,ImageChops
HERE=os.path.dirname(os.path.abspath(__file__))
FONT=os.environ.get('HALF_FONT','/Volumes/Projects/Projects/dialcraft/.claude/skills/create-amazfit-watchface/examples/animated/fonts/outfit-400.ttf')
SS=4; CX,CY=88,225
WX,WY,WW,WH=182,175,54,100          # seconds window (centre x 209, centre y 225)
ROW=44; NROW=66; FADE=34; FADE_X0,FADE_X1=-32,128
THEMES=[('blue',(138,180,248)),('violet',(176,144,255)),('emerald',(80,222,166)),('amber',(255,184,88)),('rose',(255,120,160))]
IM=HERE+'/project/images/'; os.makedirs(IM+'strip',exist_ok=True)
out={}
def save(name,im,size=None):
    im=im.resize(size,Image.LANCZOS) if size and im.size!=size else im
    im.save(IM+name,optimize=True); out[name]=list(im.size)
def font(sz): return ImageFont.truetype(FONT,int(round(sz*SS)))
def ctext(d,t,x,y,f,fill):
    l,tp,r,b=f.getbbox(t,anchor='ls'); d.text((x*SS-(l+r)/2,y*SS-(tp+b)/2),t,font=f,fill=fill,anchor='ls')
def ticks(col_minor,col_major,bg=None):
    # major ticks (every 5th, the 'spikes') take col_major; the rest stay grey
    im=Image.new('RGBA',(390*SS,450*SS),bg or (0,0,0,0)); d=ImageDraw.Draw(im)
    for j in range(60):                            # the whole ring; it fades out towards the left instead of being cut
        a=math.radians(j*6); major=j%5==0; r1=174 if major else 182; w=3 if major else 2; col=col_major if major else col_minor
        p0=(CX+192*math.sin(a),CY-192*math.cos(a)); p1=(CX+r1*math.sin(a),CY-r1*math.cos(a))
        d.line([(p0[0]*SS,p0[1]*SS),(p1[0]*SS,p1[1]*SS)],fill=col,width=w*SS)
        for p in (p0,p1): d.ellipse([p[0]*SS-w*SS/2,p[1]*SS-w*SS/2,p[0]*SS+w*SS/2,p[1]*SS+w*SS/2],fill=col)
    # horizontal fade: invisible at the left, full from x=150 (smoothstep), so the ring melts away instead of ending on a line
    import numpy as np
    x=np.arange(390*SS,dtype='float32')/SS; t=np.clip((x-FADE_X0)/(FADE_X1-FADE_X0),0,1); k=(t*t*(3-2*t))
    a=np.array(im.getchannel('A')).astype('float32')*k[None,:]
    im.putalpha(Image.fromarray(a.astype('uint8'))); return im
def strip(acc):
    # drawn at 8x with a 2/8 px stroke so the weight matches the editor's own digit pictures (measured: stroke 2 at 8x -> ink mass ratio 1.01)
    S8=8; f8=ImageFont.truetype(FONT,28*S8)
    im=Image.new('RGBA',(WW*S8,NROW*ROW*S8),(0,0,0,0)); d=ImageDraw.Draw(im)
    for r in range(NROW):
        t='%02d'%((62-r)%60); l,tp,rr,bb=f8.getbbox(t,anchor='ls',stroke_width=2)
        d.text((WW*S8/2-(l+rr)/2,(r+.5)*ROW*S8-(tp+bb)/2),t,font=f8,fill=acc+(255,),anchor='ls',stroke_width=2,stroke_fill=acc+(255,))
    return im
def fade(top):
    im=Image.new('RGBA',(WW*SS,FADE*SS),(0,0,0,0)); d=ImageDraw.Draw(im)
    for yy in range(FADE*SS):
        t=(1-yy/(FADE*SS)) if top else yy/(FADE*SS); d.line([(0,yy),(WW*SS,yy)],fill=(0,0,0,int(255*t**1.2)))
    return im
os.makedirs(IM+'ticks',exist_ok=True)
for t,(nm,acc) in enumerate(THEMES): save('ticks/t%d.png'%t,ticks((92,92,92,255),tuple(int(c*0.85) for c in acc)+(255,)),(390,450))
_a=Image.new('RGBA',(390*SS,450*SS),(0,0,0,255)); _a.alpha_composite(ticks((46,46,46,255),(68,68,68,255))); save('dial-aod-half.png',_a,(390,450))
def mono(im,col,size):    # resize only the alpha and keep one exact colour (Lanczos on RGB rings and makes edges lighter than the colour)
    al=im.getchannel('A').resize(size,Image.LANCZOS); out=Image.new('RGBA',size,tuple(col)+(0,)); out.putalpha(al); return out
for t,(nm,acc) in enumerate(THEMES): save('strip/s%d.png'%t,mono(strip(acc),acc,(WW,NROW*ROW)))
save('fade-top.png',fade(True),(WW,FADE)); save('fade-bot.png',fade(False),(WW,FADE))
save('tap.png',Image.new('RGBA',(1,1),(0,0,0,0)))
json.dump(out,open(HERE+'/baked-sizes.json','w')); print(len(out),'pictures')

# ---- complications: a column of round badges on the right, like the Rainbowbee sample (solid disc + white icon + reading under it)
ICOL=(240,242,248,255); D=74; CAN=88; K=34/22
def canvas(w,h): return Image.new('RGBA',(w*SS,h*SS),(0,0,0,0))
def disc(acc):
    im=canvas(CAN,CAN); d=ImageDraw.Draw(im); c=CAN/2*SS; r=D/2*SS
    d.ellipse([c-r,c-r,c+r,c+r],fill=tuple(int(v*0.38) for v in acc)+(255,)); return im
def track(th=6):
    im=canvas(CAN,CAN); d=ImageDraw.Draw(im); c=CAN/2*SS; r=(D/2)*SS
    d.ellipse([c-r,c-r,c+r,c+r],outline=(46,48,56,255),width=th*SS); return im
def sunicon(up):
    im=canvas(34,34); d=ImageDraw.Draw(im); S=SS*K; ox,oy=0,2.6*S; cx,cy=11*S+ox,14*S+oy; lw=int(1.7*S)
    d.line([(2*S+ox,cy),(20*S+ox,cy)],fill=ICOL,width=lw)
    d.pieslice([cx-6*S,cy-6*S,cx+6*S,cy+6*S],180,360,fill=ICOL)
    for a in (-60,-30,0,30,60):
        t=math.radians(a); d.line([(cx+8.2*S*math.sin(t),cy-8.2*S*math.cos(t)),(cx+10.4*S*math.sin(t),cy-10.4*S*math.cos(t))],fill=ICOL,width=lw)
    ax=11*S+ox; y0,y1=(7*S+oy,2*S+oy) if up else (2*S+oy,7*S+oy); d.line([(ax,y0),(ax,y1)],fill=ICOL,width=lw)
    hy=y1+(2.4*S if up else -2.4*S); d.line([(ax-2.4*S,hy),(ax,y1),(ax+2.4*S,hy)],fill=ICOL,width=lw,joint='curve'); return im
def batticon(level):
    im=canvas(34,34); d=ImageDraw.Draw(im); S=SS*K; ox=11-11.65; ox*=S; oy=0           # body+nub span x 1..22.3, y 5..17 -> centre (11.65, 11)
    d.rounded_rectangle([1*S+ox,5*S+oy,19.5*S+ox,17*S+oy],radius=2.4*S,outline=ICOL,width=int(1.8*S)); d.rectangle([20.5*S+ox,8.5*S+oy,22.3*S+ox,13.5*S+oy],fill=ICOL)
    w=int((level+1)/10*(14.5*S)); d.rounded_rectangle([3.6*S+ox,7.6*S+oy,3.6*S+ox+max(w,1.6*S),14.4*S+oy],radius=1*S,fill=ICOL); return im
def bdisc(acc):                       # the battery badge disc: the same fill as the other badges
    im=canvas(CAN,CAN); d=ImageDraw.Draw(im); c=CAN/2*SS; r=(D/2)*SS
    d.ellipse([c-r,c-r,c+r,c+r],fill=tuple(int(v*0.38) for v in acc)+(255,)); return im
save('ctrack.png',track(),(CAN,CAN))
for t,(nm,acc) in enumerate(THEMES): save('cdisc%d.png'%t,disc(acc),(CAN,CAN)); save('bdisc%d.png'%t,bdisc(acc),(CAN,CAN))
save('sunrise.png',sunicon(True),(34,34)); save('sunset.png',sunicon(False),(34,34))
for l in range(10): save('bat%d.png'%l,batticon(l),(34,34))
save('tapzone-b.png',Image.new('RGBA',(92,114),(0,0,0,0)))
json.dump(out,open(HERE+'/baked-sizes.json','w')); print(len(out),'pictures')
