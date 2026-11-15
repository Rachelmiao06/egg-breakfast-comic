"""第二批格内表演图层：p2d 配菜下锅、p3a 调酱汁（scroll-motion-demo，2026-11-14）。
只读 source/comic-v3 的页面副本；桌面原件不动。裁切框与 manifest.json 一致，透明框外处理沿用 panel_alpha.process。

能从现有画面可靠分离的才做：
- p2d：空中三粒玉米（完整描边、四周是深色锅底）单独成层；原位置用同一锅底的纹理平移补上。
  木铲和砧板同为木色且互相重叠，无法干净分离，不做（见缺图清单）。
- p3a：搅拌的手臂 + 勺子（有完整描边，颜色和围裙、墙、碗明显不同）单独成层；
  底图里手臂区域用手臂外最近的颜色向内延伸填充——表演时手臂只画 3px 的小圈，露出的只有边缘约 3px 的一条；
  酱汁表面明显比平滑酱面亮的高光细线单独成层（底图只在这些像素处换成平滑酱色，其余酱面保留原样），旋纹层在代码里沿椭圆转动；
  另出一张酱面遮罩，限制旋纹只在酱面里。
用法（仓库根目录）：PYTHONPATH=tools python3 tools/prepare_perf_layers_v2.py
"""
import json

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

from panel_alpha import process  # noqa: E402

O = "public/assets/comic-v3/perf"
MAN = json.load(open("public/assets/comic-v3/manifest.json"))


def save(arr, name):
    Image.fromarray(arr.astype(np.uint8), "RGBA").save(f"{O}/{name}.webp", quality=92, alpha_quality=100, method=6)


def feather(mask, r=0.7):
    a = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(float)
    return np.where(ndimage.binary_erosion(mask, iterations=2), 255, a)


def layer(rgb, mask):
    return np.dstack([rgb, feather(mask)])


# ---------------- p2d 配菜下锅 ----------------
m = MAN["p2d"]
page = Image.open(f"source/comic-v3/{m['page']}")
box = tuple(m["box"])
base = np.asarray(process(page, box)).copy()
O2 = base[..., :3].astype(int)
lum, sat = O2.mean(2), O2.max(2) - O2.min(2)
food = (sat > 60) & (lum > 90)
lab, _ = ndimage.label(food)
X0, Y0 = box[:2]
yellow = (O2[..., 0] > 200) & (O2[..., 1] > 150) & (O2[..., 2] < 120)
corn_seeds = {"p2d-corn1": (460, 1015), "p2d-corn3": (575, 1035)}  # 页面坐标；第二粒（522,1025）被胡萝卜丁等包住，附近没有纯锅底可补，不动
pan = (lum < 118) & (lum > 40) & (sat < 75) & (O2[..., 1] < O2[..., 0]) & ~ndimage.binary_dilation((sat > 45) & (lum > 70), iterations=3)
pieces = {}
for name, (x, y) in corn_seeds.items():
    i = lab[y - Y0, x - X0]
    core = lab == i
    if name == "p2d-corn2":  # 与胡萝卜丁连在一起：只取黄色那粒
        core = core & yellow
        cl, _ = ndimage.label(core)
        core = cl == cl[y - Y0, x - X0]
    core = ndimage.binary_fill_holes(core)
    outline = ndimage.binary_dilation(core, iterations=4) & (lum < 75)
    mm = ndimage.binary_fill_holes(core | outline)
    pieces[name] = mm
    save(layer(O2, mm), name)
# 补洞：整块从附近纯锅底平移复制（只用一个平移，纹理连贯）。锅底 = 暖深灰、低饱和、不是描边、离任何菜都至少 3px。
fill = O2.copy()
for name, mm in pieces.items():
    other = ndimage.binary_dilation(food & ~mm, iterations=1) & ~mm  # 旁边别的菜不动
    hole = ndimage.binary_dilation(mm, iterations=2) & ~other
    ys, xs = np.where(hole)
    best, bestv = None, -1
    for dy in range(-90, 91, 2):
        for dx in range(-120, 121, 2):
            if abs(dx) < 36 and abs(dy) < 36:
                continue
            sy, sx = ys + dy, xs + dx
            if sy.min() < 0 or sx.min() < 0 or sy.max() >= O2.shape[0] or sx.max() >= O2.shape[1]:
                continue
            v = pan[sy, sx].mean() - 0.0005 * (abs(dx) + abs(dy))
            if v > bestv:
                bestv, best = v, (dx, dy)
    dx, dy = best
    print(name, "补洞平移", best, "纯锅底比例", round(float(pan[ys + dy, xs + dx].mean()), 3), "像素", int(hole.sum()))
    assert pan[ys + dy, xs + dx].mean() > 0.97, f"{name}: 附近没有足够干净的锅底"
    fill[ys, xs] = O2[ys + dy, xs + dx]
base[..., :3] = fill
save(base, "p2d-base")

# ---------------- p3a 调酱汁 ----------------
m = MAN["p3a"]
page = Image.open(f"source/comic-v3/{m['page']}")
box = tuple(m["box"])
base = np.asarray(process(page, box)).copy()
O3 = base[..., :3].astype(int)
H, W = O3.shape[:2]
lum = O3.mean(2)
open_ = lum > 80
lab, _ = ndimage.label(open_)
seeds = [(142, 202), (52, 72), (100, 120), (232, 254), (260, 262), (170, 240)]  # 面板坐标 (y, x)：手、袖、勺
arm = np.isin(lab, [lab[y, x] for y, x in seeds if lab[y, x] > 0])
arm = arm | (ndimage.binary_dilation(arm, iterations=7) & ~open_)  # 带上手臂自己的描边（描边约 5–7px，取够，免得留一圈深色在底图里）
arm = ndimage.binary_fill_holes(arm)
save(layer(O3, arm), "p3a-arm")

# 酱面：碗口里的深棕色区域（含旋纹），不含勺子
yy, xx = np.mgrid[0:H, 0:W]
cx, cy, rx, ry = 283, 294, 88, 27  # 面板坐标，按酱面实测
ell = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1
R, G, B = O3[..., 0], O3[..., 1], O3[..., 2]
brown = (R > G) & (G >= B) & (lum < 200) & (R - B > 40)
sauce = ndimage.binary_fill_holes(ndimage.binary_closing(ell & brown, iterations=2)) & ell
sauce_nospoon = sauce & ~ndimage.binary_dilation(arm, iterations=2)
smooth = np.dstack([ndimage.median_filter(O3[..., c].astype(float), size=13) for c in range(3)])
smooth = np.dstack([ndimage.gaussian_filter(smooth[..., c], 2) for c in range(3)])
lift = (lum - smooth.mean(2)).clip(0, None)
# 高光 = 明显比平滑酱面亮的细线；只把这些像素搬到旋纹层，底图其余酱面保留原样（深色纹理不丢）
hi = sauce_nospoon & (lift > 10)
hi = ndimage.binary_opening(hi, iterations=1) | (sauce_nospoon & (lift > 22))
hi_soft = ndimage.binary_dilation(hi, iterations=1)
alpha = np.clip(feather(hi_soft, 0.8), 0, 255) * sauce_nospoon
swirl = np.dstack([O3, alpha])
save(swirl, "p3a-swirl")
mask_img = np.dstack([np.zeros_like(O3), feather(sauce_nospoon, 1.0)])
save(mask_img, "p3a-saucemask")

# 底图：酱面去掉旋纹；手臂区域用外面最近的颜色填
b3 = O3.astype(float).copy()
b3[hi_soft] = smooth[hi_soft]  # 只去掉被搬走的高光，酱面其余保留原样
# 只从"手臂外、而且不是深色描边"的像素取色，用归一化卷积平滑地填（由小到大几个尺度），
# 不用最近邻：最近邻会在围裙和瓷砖上拉出一道道放射状毛刺，搅动时很显眼。
invalid = arm | (~open_ & ndimage.binary_dilation(arm, iterations=12))
valid = (~invalid).astype(float)
filled = np.zeros_like(b3)
todo = arm.copy()
for sigma in (3, 6, 12, 24):
    wsum = ndimage.gaussian_filter(valid, sigma)
    for c in range(3):
        num = ndimage.gaussian_filter(b3[..., c] * valid, sigma)
        filled[..., c] = np.where(todo & (wsum > 0.02), num / np.maximum(wsum, 1e-6), filled[..., c])
    todo = todo & ~(wsum > 0.02)
if todo.any():  # 手臂正中很深的地方（动作再大也露不出来）：最近的已填像素
    ii = ndimage.distance_transform_edt(todo, return_distances=False, return_indices=True)
    filled[todo] = filled[ii[0][todo], ii[1][todo]]
b3[arm] = filled[arm]
base[..., :3] = b3.clip(0, 255)
save(base, "p3a-base")
print("p3a arm px", int(arm.sum()), "sauce px", int(sauce.sum()), "highlight px", int(hi_soft.sum()))
