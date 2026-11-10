#!/usr/bin/env python3
"""Cuts the 29 weather icons (Zepp index order) out of weather-sheet.png (a generated sheet: white icons on a magenta panel) into project/images/weather/wNN.png, 34x34, white, alpha from the green channel."""
import os,json
import numpy as np
from PIL import Image
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=HERE+'/project/images/weather/'; os.makedirs(OUT,exist_ok=True)
sheet=Image.open(HERE+'/weather-sheet.png').convert('RGB'); a=np.array(sheet).astype('float32')
COLS,ROWS=7,5; X0,Y0,CW,CH=47,10,133.7,109.6
# reading-order cell index in the sheet for each Zepp weather index 0..28 (cells 4, 12, 19 and 26 of the sheet are alternates that are not used)
CELL=[0,1,2,3,5,6,7,8,9,10,11,13,14,15,16,17,18,20,21,22,23,24,25,27,28,29,30,31,32]
assert len(CELL)==29
def cell_alpha(c):
    r,k=divmod(c,COLS); x0,y0=int(X0+k*CW)+6,int(Y0+r*CH)+6; x1,y1=int(X0+(k+1)*CW)-6,int(Y0+(r+1)*CH)-6
    g=a[y0:y1,x0:x1,1]; al=np.clip((g-40)/180.0,0,1)          # panel is pink/magenta (G~0), the icon white (G~255)
    return al
als=[cell_alpha(c) for c in CELL]
boxes=[]
for al in als:
    ys,xs=np.where(al>0.35); boxes.append((xs.min(),xs.max(),ys.min(),ys.max()))
mx=max(max(b[1]-b[0],b[3]-b[2]) for b in boxes)+1
SC=30.0/mx                                   # one scale for all, so every icon keeps its relative size
names=[]
for i,(al,b) in enumerate(zip(als,boxes)):
    cx,cy=(b[0]+b[1])/2,(b[2]+b[3])/2; R=mx*0.5+3
    crop=np.zeros((int(2*R),int(2*R)),dtype='float32'); 
    x0,y0=int(cx-R),int(cy-R)
    for yy in range(crop.shape[0]):
        for xx in range(crop.shape[1]):
            sy,sx=y0+yy,x0+xx
            if 0<=sy<al.shape[0] and 0<=sx<al.shape[1]: crop[yy,xx]=al[sy,sx]
    img=Image.fromarray((crop*255).astype('uint8'),'L').resize((34,34),Image.LANCZOS)
    rgba=Image.new('RGBA',(34,34),(240,242,248,0)); rgba.putalpha(img)
    n='weather/w%02d.png'%i; rgba.save(HERE+'/project/images/'+n,optimize=True); names.append(n)
json.dump(names,open(HERE+'/weather-names.json','w')); print(len(names),'icons, scale',SC,'max box',mx)
