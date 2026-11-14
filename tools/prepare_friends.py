"""阅读段厨房（new pics/BG-kitchen-secret-friends.png）拆层：三个小角色 + 两个遮挡物 + 补好的底图。

只做裁切、遮罩和底图修补，不改角色像素：
  - 角色 / 遮挡物：在墨线围成的区域里从种子点泛洪（墨线是墙），合并后外扩 2 像素把轮廓线包进来，再填满内部小洞。
    遮罩是硬边（0 / 255），所以角度为 0 时“底图 + 各层”与原图逐像素相同。
  - 底图：只在会动的角色（及外扩一圈）位置用 OpenCV inpaint 按周围像素补齐。角色只做几度的转动，露出来的只是边缘细条。
    补齐只用原图自己的周围像素，不重画。
  - 葱只动叶子：叶子在叶鞘交界处切开（cut 以上），转轴在交界处；切口做 3 像素羽化，转动时和下面的葱白接上。
输出：public/assets/bg/kitchen-friends-base.webp 和 friends-<名字>.png（RGBA，裁到外接框），并打印 backgrounds.json reading.actors 要填的数值。
用法：python3 tools/prepare_friends.py [--preview 输出目录]
"""
import json, sys

import cv2
import numpy as np
from scipy import ndimage

SRC = "source/bg-v3/BG-kitchen-secret-friends.png"
OUT = "public/assets/bg"
INK = 105
img = cv2.imread(SRC, cv2.IMREAD_COLOR)  # BGR
H, W = img.shape[:2]
lum = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
free = (lum > INK).astype(np.uint8)  # 非墨线

def region(seeds, box, ymax=None, xmin=None, xmax=None):
    """种子点泛洪（限制在 box 内）→ 外扩 2 像素包住轮廓 → 填洞"""
    x0, y0, x1, y1 = box
    m = np.zeros((H, W), np.uint8)
    lim = np.zeros((H, W), np.uint8); lim[y0:y1, x0:x1] = 1
    if ymax is not None: lim[ymax:, :] = 0
    if xmin is not None: lim[:, :xmin] = 0
    if xmax is not None: lim[:, xmax:] = 0
    f = (free & lim).copy()
    for (sx, sy) in seeds:
        if not f[sy, sx]:
            raise SystemExit(f"种子点 {(sx, sy)} 落在墨线上或框外")
        ff = f.copy() * 255
        mask = np.zeros((H + 2, W + 2), np.uint8)
        cv2.floodFill(ff, mask, (sx, sy), 128)
        m |= (ff == 128).astype(np.uint8)
    m = cv2.dilate(m, np.ones((5, 5), np.uint8)) & lim
    m = ndimage.binary_fill_holes(m).astype(np.uint8) & lim
    return m

# ---- 种子点和范围（图片像素，按原图逐个确认） ----
SPEC = {
    "jar": dict(seeds=[(272, 246), (268, 280), (240, 320), (300, 320), (270, 340), (335, 370)], box=(190, 228, 360, 392)),
    "scallion-leaves": dict(seeds=[(1357, 470), (1384, 450), (1418, 420), (1446, 430), (1366, 412), (1408, 388), (1436, 382), (1340, 505), (1360, 505)], box=(1290, 365, 1478, 523), ymax=522),
}
SOY = dict(dark_seeds=[(330, 640), (315, 560)], light_seeds=[(330, 460), (322, 500), (335, 600), (318, 669), (342, 669)], box=(299, 436, 368, 679))
OCCL = {
    "oil": dict(seeds=[(255, 560), (252, 455), (250, 410), (255, 650)], box=(200, 390, 312, 690)),
    "post": dict(seeds=[(378, 520), (378, 650), (378, 400)], box=(362, 340, 396, 712)),
}
PIVOT = {"soy": (330, 676), "jar": (274, 380), "scallion-leaves": (1335, 522)}

def dark_region(dark_seeds, light_seeds, box, dark=85, open_k=7):
    """深色角色（酱油瓶）：瓶身和墨线一样暗。深色连通块（限制在 box）做开运算去掉相邻物件的细墨线，
    再并上浅色部分（瓶盖、瓶颈、脸、手、脚）的泛洪，填洞，外扩 1 像素"""
    x0, y0, x1, y1 = box
    lim = np.zeros((H, W), np.uint8); lim[y0:y1, x0:x1] = 1
    d = ((lum < dark) & (lim > 0)).astype(np.uint8)
    n, lab = cv2.connectedComponents(d)
    keep = np.zeros((H, W), np.uint8)
    for (sx, sy) in dark_seeds:
        if lab[sy, sx] == 0: raise SystemExit(f"深色种子 {(sx, sy)} 不在深色区域")
        keep |= (lab == lab[sy, sx]).astype(np.uint8)
    keep = cv2.morphologyEx(keep, cv2.MORPH_OPEN, np.ones((open_k, open_k), np.uint8))
    light = region(light_seeds, box)
    m = ndimage.binary_fill_holes(keep | light).astype(np.uint8)
    return cv2.dilate(m, np.ones((3, 3), np.uint8)) & lim

masks = {k: region(**v) for k, v in SPEC.items() if k != "soy"}
masks["soy"] = dark_region(**SOY)
# 酱油瓶是凸的：取凸包补上脸部靠边被切掉的部分（右眼、腮红），右边不越过层板立柱
_cnts, _ = cv2.findContours(masks["soy"], cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
_hull = cv2.convexHull(np.vstack(_cnts))
_m = np.zeros((H, W), np.uint8); cv2.fillPoly(_m, [_hull], 1)
_m[:, SOY["box"][2] - 2:] = 0
masks["soy"] = _m
occ = {k: region(**v) for k, v in OCCL.items()}
# 遮挡物里不能带角色的像素（否则角色转动时那一小条留在原地）
for k in occ:
    for m in masks.values(): occ[k] &= (1 - m)
# 葱叶切口羽化
feather = np.ones((H, W), np.float32)
cy = SPEC["scallion-leaves"]["ymax"]
for d in range(6):
    feather[cy - 1 - d, :] = (d + 1) / 7.0

def save_layer(mask, name, soft=None):
    ys, xs = np.nonzero(mask)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    a = mask.astype(np.float32) * 255
    if soft is not None: a = a * soft
    rgba[:, :, 3] = a.astype(np.uint8)
    cv2.imwrite(f"{OUT}/friends-{name}.png", rgba[y0:y1, x0:x1])
    return [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]

boxes = {k: save_layer(m, k, feather if k == "scallion-leaves" else None) for k, m in masks.items()}
oboxes = {k: save_layer(m, k) for k, m in occ.items()}

# ---- 底图：会动的角色位置按周围像素补齐（外扩 6 像素） ----
hole = np.zeros((H, W), np.uint8)
for m in masks.values(): hole |= m
hole = cv2.dilate(hole, np.ones((13, 13), np.uint8))
# 葱叶切口上方 10 像素保留原图（转轴附近位移不到 1 像素；羽化的切口在角度 0 时和原图完全一致）
hole[SPEC["scallion-leaves"]["ymax"] - 10:SPEC["scallion-leaves"]["ymax"] + 8, 1280:1500] = 0
# 遮挡物本身不补（它们在最上层原样盖着）
for m in occ.values(): hole &= (1 - m)
base = cv2.inpaint(img, hole * 255, 7, cv2.INPAINT_TELEA)
cv2.imwrite(f"{OUT}/kitchen-friends-base.png", base)
from PIL import Image
Image.open(f"{OUT}/kitchen-friends-base.png").save(f"{OUT}/kitchen-friends-base.webp", quality=90, method=6)
import os; os.remove(f"{OUT}/kitchen-friends-base.png")

res = {"actors": {k: {"src": f"/assets/bg/friends-{k}.png", "img": boxes[k], "pivot": PIVOT[k]} for k in masks},
       "occluders": {k: {"src": f"/assets/bg/friends-{k}.png", "img": oboxes[k]} for k in occ}}
print(json.dumps(res, ensure_ascii=False))

if "--preview" in sys.argv:
    out = sys.argv[sys.argv.index("--preview") + 1]
    vis = img.copy()
    for k, m in {**masks, **occ}.items():
        c = (0, 0, 255) if k in masks else (255, 0, 0)
        cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        cv2.drawContours(vis, cnts, -1, c, 2)
    cv2.imwrite(f"{out}/friends-masks.jpg", vis)
    cv2.imwrite(f"{out}/friends-base.jpg", base)
