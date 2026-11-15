import json, math, numpy as np
import os
src=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'egg_jump_sim.py')).read()
exec(src.split("if __name__")[0]+src.split("run(K0,yA=190); print(render(rows,'cam-current'))")[1])
from scipy.optimize import minimize
K0=json.load(open(ROOT+'src/app/preview/visual/backgrounds.json'))['camera']['keys']
def sLin(vh,sE=0.5,sR=0.7):
    l0=vhAt(hi,0.5); a1=vhAt(ai,0.12); b=beats[ci]['phases']; b1=vhAt(ci,b['enter']); c1=vhAt(ci,b['enter']+b['action'])
    if vh<l0: return 0
    if vh<a1: return sE*(vh-l0)/(a1-l0)
    if vh<b1: return sE+(sR-sE)*(vh-a1)/(b1-a1)
    if vh<c1: return sR+(1-sR)*(vh-b1)/(c1-b1)
    return 1
def sSmooth(vh,half=40,n=10):
    ws=[];vs=[]
    for i in range(-n,n+1):
        w=1-abs(i)/(n+1); ws.append(w); vs.append(sLin(vh+half*i/n))
    return sum(w*v for w,v in zip(ws,vs))/sum(ws)
KEYS=[('hear',0.7),('hear',0.85),('listen',0.2),('listen',0.55),('listen',0.92),('catch',0.2),('catch',0.5)]
base=[k for k in K0 if k[0] not in ('listen',) and not (k[0]=='hear' and k[1]>0.5) and not (k[0]=='catch' and k[1]<0.7)]
def buildK(v):
    K=[list(k) for k in base]
    for i,(b,p) in enumerate(KEYS): K.append([b,p,v[2*i],v[2*i+1],1.075,0.5,0.6])
    K.sort(key=lambda k:gOf(k[0],k[1]))
    return K
v0=vhAt(hi,0.3); v1=vhAt(ci,1.0)
VHS=np.linspace(v0,v1,260)
def simulate(v,yA=200,eggH=60):
    K=buildK(v); P=[];CY=[]
    for vh in VHS:
        g=gAtVh(vh); s=sSmooth(vh); x,y=egg_scene(s,yA)
        c=cam(g,K); sc,tx,ty=xf(c); P.append((x*sc+tx,y*sc+ty,(y-eggH)*sc+ty)); CY.append(c['y'])
    return np.array(P),np.array(CY)
def cost(v):
    P,CY=simulate(v)
    out=np.sum(np.maximum(0,80-P[:,0])**2+np.maximum(0,P[:,0]-(VW-80))**2+np.maximum(0,60-P[:,2])**2+np.maximum(0,P[:,1]-(VH-30))**2)
    acc=np.diff(P[:,:2],2,axis=0); jerk=np.sum(acc**2)
    tilt=max(0,CY.max()-480-0)  # 想让镜头 y 抬到 ≤ 480（clamp 上限）
    cyterm=(max(0,CY.min()-520))**2
    ys=P[:,1]; tv=np.abs(np.diff(ys)).sum(); mn=(ys[0]-ys.min())+(ys[-1]-ys.min()); xs=P[:,0]; tvx=np.abs(np.diff(xs)).sum(); mnx=abs(xs[-1]-xs[0])
    return out*5+jerk*1.0+cyterm*0.05+((tv-mn)**2)*0.5+((tvx-mnx)**2)*0.5
x0=[]
for b,p in KEYS: x0+= [820,700]
bounds=[(500,1150),(430,900)]*7
best=None
rng=np.random.default_rng(1)
for trial in range(6):
    xs=[float(rng.uniform(*b)) for b in bounds] if trial else x0
    r=minimize(cost,xs,method='Powell',bounds=bounds,options=dict(maxiter=3000,xtol=1,ftol=1e-4))
    if best is None or r.fun<best.fun: best=r
res=best
v=res.x; print(res.fun)
for (b,p),i in zip(KEYS,range(7)): print(b,p,round(v[2*i]),round(v[2*i+1]))
P,CY=simulate(v); print('camY range',CY.min(),CY.max(),'egg screen x',P[:,0].min(),P[:,0].max(),'y',P[:,1].min(),P[:,1].max())
json.dump([round(float(a)) for a in v],open(OUT+'opt.json','w'))
# 画图
rows=[]
K=buildK(v)
for vh in np.linspace(v0,v1,900):
    g=gAtVh(vh); s=sSmooth(vh); x,y=egg_scene(s,200); c=cam(g,K); sc,tx,ty=xf(c); rows.append((vh,g,s,x,y,x*sc+tx,y*sc+ty,sc,c))
print(render(rows,'cam-opt'))
