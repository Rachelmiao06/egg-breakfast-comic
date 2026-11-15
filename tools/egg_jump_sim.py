#!/usr/bin/env python3
"""高跳编排模拟（2026-11-15）：复刻 cameraV2 的镜头曲线和蛋的抛物线（Egg.tsx trajFoot / scrollParam），
算出“蛋在屏幕上的轨迹”，用来调 backgrounds.json 的 camera.keys 和 anchors.jump。
  python3 tools/egg_jump_sim.py          画当前镜头下的屏幕轨迹 tools/cam-current.png（右侧是屏幕速度曲线，左下数字是出画帧数）
  python3 tools/egg_jump_opt.py          在镜头关键帧（hear / listen / catch 的若干个）上做有界优化：
                                         蛋不出画、屏幕轨迹单拱、加速度最小、镜头真的抬起来
注意：模拟里蛋的路径和 Egg.tsx 的 trajFoot 是两份实现，改一边要同步另一边。起跳点 L、落铲点 C 取 1440×810 下 ?trail=1 读出的真实值。
"""
import json, math, sys
import numpy as np
from PIL import Image, ImageDraw
import os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+'/'
OUT=ROOT+'tools/'
bg=json.load(open(ROOT+'src/app/preview/visual/backgrounds.json'))
beats=json.load(open(ROOT+'src/app/preview/visual/beats.visual-v2.json'))['beats']
ids=[b['id'] for b in beats]
VW,VH=1440,810; SW,SH=1536,1024
def smooth(t): t=min(1,max(0,t)); return t*t*(3-2*t)
def gOf(i,p): return ids.index(i)+p
def curve(keys,g):
    pts=[(gOf(k[0],k[1]),k[2]) for k in keys]
    if g<=pts[0][0]: return pts[0][1]
    for i in range(1,len(pts)):
        if g<=pts[i][0]:
            g0,v0=pts[i-1];g1,v1=pts[i]; return v0+(v1-v0)*smooth((g-g0)/(g1-g0))
    return pts[-1][1]
def cam(g,K):
    ch=lambda j:curve([(k[0],k[1],k[j]) for k in K],g)
    return dict(x=ch(2),y=ch(3),zoom=ch(4),ax=ch(5),ay=ch(6))
def xf(c):
    s=max(VW/SW,VH/SH)*c['zoom']
    tx=min(0,max(VW-SW*s,VW*c['ax']-c['x']*s)) if True else 0
    ty=min(0,max(VH-SH*s,VH*c['ay']-c['y']*s))
    return s,tx,ty
# vh 累计
cum=[0]
for b in beats: cum.append(cum[-1]+b['lengthVh'])
def vhAt(i,p): return cum[i]+beats[i]['lengthVh']*p
def gAtVh(vh):
    for i in range(len(beats)):
        if vh<cum[i+1]: return i+(vh-cum[i])/beats[i]['lengthVh']
    return len(beats)
hi=ids.index('hear'); ai=ids.index('listen'); ci=ids.index('catch')
def sMap(vh,sM,sE,sR,lToM=0.5,mToE=(0.85,0.12)):
    b=beats[ci]['phases']; start=b['enter']; land=b['enter']+b['action']
    l0=vhAt(hi,lToM); a0=vhAt(hi,mToE[0]); a1=vhAt(ai,mToE[1]); b1=vhAt(ci,start); c1=vhAt(ci,land)
    if vh<l0: return 0
    if vh<a0: return sM*(vh-l0)/(a0-l0)
    if vh<a1: return sM+(sE-sM)*(vh-a0)/(a1-a0)
    if vh<b1: return sE+(sR-sE)*(vh-a1)/(b1-a1)
    if vh<c1: return sR+(1-sR)*(vh-b1)/(c1-b1)
    return 1

L=(1400,605); C=(1078,721)
def egg_scene(s,yA,sE=0.5,sR=0.7,bob=6):
    X=lambda s:L[0]+(C[0]-L[0])*(0.35*smooth(s)+0.65*s)
    x=X(s)
    if s<=sE:
        u=s/sE; y=L[1]+(yA-L[1])*(1-(1-u)**2)
    elif s<=sR:
        u=(s-sE)/(sR-sE); y=yA+bob*math.sin(2*math.pi*u)
    else:
        u=(s-sR)/(1-sR); y=yA+(C[1]-yA)*u*u
    return x,y
def run(K,yA,label="",sE=0.5,sR=0.7):
    rows=[]
    g0=gOf('hear',0.3); g1=gOf('catch',1.0)
    v0=vhAt(hi,0.3); v1=vhAt(ci,1.0)
    for vh in np.linspace(v0,v1,900):
        g=gAtVh(vh)
        sM=0.3
        # 单段线性：rise 从 l0 到 a1
        l0=vhAt(hi,0.5); a1=vhAt(ai,0.12); b=beats[ci]['phases']; b1=vhAt(ci,b['enter']); c1=vhAt(ci,b['enter']+b['action'])
        if vh<l0: s=0
        elif vh<a1: s=sE*(vh-l0)/(a1-l0)
        elif vh<b1: s=sE+(sR-sE)*(vh-a1)/(b1-a1)
        elif vh<c1: s=sR+(1-sR)*(vh-b1)/(c1-b1)
        else: s=1
        x,y=egg_scene(s,yA,sE,sR)
        c=cam(g,K); sc,tx,ty=xf(c)
        rows.append((vh,g,s,x,y,x*sc+tx,y*sc+ty,sc,c))
    return rows
def render(rows,name,eggscale=(0.26,0.4)):
    W,H=VW,VH
    im=Image.new('RGB',(W+420,H),(235,240,230)); d=ImageDraw.Draw(im)
    d.rectangle([0,0,W,H],outline=(120,120,120))
    prev=None
    for i,r in enumerate(rows):
        px,py=r[5],r[6]
        col=(int(255*r[2]),60,int(255*(1-r[2])))
        d.ellipse([px-2,py-2,px+2,py+2],fill=col)
        if i%90==0: d.text((px+6,py-6),f"g{r[1]:.2f}",fill=(0,0,0))
    # 速度曲线（屏幕像素 / vh）
    sp=[]
    for i in range(1,len(rows)):
        dv=rows[i][0]-rows[i-1][0]; sp.append((math.hypot(rows[i][5]-rows[i-1][5],rows[i][6]-rows[i-1][6])/dv, rows[i][0]))
    mx=max(s for s,_ in sp)
    x0=W+20
    d.text((x0,10),f"{name}  max speed {mx:.1f}px/vh",fill=(0,0,0))
    for k,(s,v) in enumerate(sp):
        X=x0+k*380/len(sp); d.point((X,400-s/mx*350),fill=(200,0,0))
    # 出画检查
    out=[r for r in rows if not(40<r[5]<W-40 and 40<r[6]<H-40)]
    d.text((x0,420),f"frames egg outside safe frame: {len(out)}/{len(rows)}",fill=(0,0,0))
    im.save(OUT+name+'.png')
    return mx,len(out)
if __name__=='__main__':
    K0=json.load(open(ROOT+'src/app/preview/visual/backgrounds.json'))['camera']['keys']
    rows=run(K0,yA=190); print(render(rows,'cam-current'))

def run2(K,yA,W,ramp,sE=0.5,sR=0.7,eggH=60,N=900):
    """镜头跟随蛋：cam = key + (egg - key)·w(g)。w 在 ramp=[(beat,p,w)...] 之间平滑插值"""
    rows=[]
    v0=vhAt(hi,0.3); v1=vhAt(ci,1.0)
    for vh in np.linspace(v0,v1,N):
        g=gAtVh(vh)
        l0=vhAt(hi,0.5); a1=vhAt(ai,0.12); b=beats[ci]['phases']; b1=vhAt(ci,b['enter']); c1=vhAt(ci,b['enter']+b['action'])
        if vh<l0: s=0
        elif vh<a1: s=sE*(vh-l0)/(a1-l0)
        elif vh<b1: s=sE+(sR-sE)*(vh-a1)/(b1-a1)
        elif vh<c1: s=sR+(1-sR)*(vh-b1)/(c1-b1)
        else: s=1
        x,y=egg_scene(s,yA,sE,sR)
        w=curve([(k[0],k[1],k[2]) for k in ramp],g)
        c=cam(g,K)
        c['x']+= (x-c['x'])*w; c['y']+=(y-eggH-c['y'])*w
        sc,tx,ty=xf(c)
        rows.append((vh,g,s,x,y,x*sc+tx,y*sc+ty,sc,c))
    return rows
def score(rows):
    # 出画 + 速度折点（二阶差分）+ 蛋在屏幕上的位移量
    out=sum(1 for r in rows if not(60<r[5]<VW-60 and 100<r[6]<VH-20))
    sp=[]
    for i in range(1,len(rows)):
        dv=rows[i][0]-rows[i-1][0]; sp.append(math.hypot(rows[i][5]-rows[i-1][5],rows[i][6]-rows[i-1][6])/dv)
    sp=np.array(sp); jerk=np.abs(np.diff(sp)).max()
    return out,float(sp.max()),float(jerk)
