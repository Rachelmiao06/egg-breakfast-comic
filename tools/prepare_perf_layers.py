"""漫画格内表演的图层（只读 source/comic-v3-perf 里的副本；桌面原件不动）。

切菜格 p2b（第 2 页“哒、哒、哒”）：
- p2b-base.webp   去掉握刀手的底图（与原格同一裁切框；框外纸白透明，同 panel_alpha）
- p2b-arm.webp    握刀手臂层：按测得的变换校准到原图手的位置（旋转 7°、缩放 0.92、平移 6,-17，绕袖口支点），
                  裁到框线内侧，不压住手绘框线
- p2b-bubble.webp 对白泡（从底图取出，叠在手臂之上，像原图一样把袖口压在泡后面）
听见格 p3d（第 3 页“嗯？啵！”）：
- p3d-eyes.webp / p3d-puzz.webp  只含五官变化的区域（眉、眼、嘴），羽化边缘；头部与原格逐像素对齐（测得位移 0,0），
                  叠在原格上切换，其余像素始终是原格，框线、对白、头发都不动。
用法：python3 tools/prepare_perf_layers.py
"""
import json

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

from panel_alpha import dilate, outside_mask, process  # noqa: E402  (同目录工具)

S = "source/comic-v3-perf"
O = "public/assets/comic-v3/perf"
MAN = json.load(open("public/assets/comic-v3/manifest.json"))
save = lambda im, name: im.save(f"{O}/{name}.webp", quality=92, alpha_quality=100, method=6)

# ---------- 切菜格 ----------
box = tuple(MAN["p2b"]["box"])
clean_page = Image.open(f"{S}/01-chopping-clean-plate.png").convert("RGB")
base = process(clean_page, box)
save(base, "p2b-base")
W, H = base.size

FIT = {"ang": 7.0, "sc": 0.92, "dx": 6, "dy": -17, "pivot": (20, 150)}
# 先按裁切框外扩 PAD 再变换，最后才裁回格子：草图的刀尖在页面 y≈820，框底是 810，
# 旧做法先裁后转，刀尖被平切掉（scroll-motion-demo 2026-11-14 修）。
# 变换在预乘 alpha（RGBa）下做，避免透明黑边渗进柔边；贴到空画布时不再用自身 alpha 当蒙版（旧做法让 alpha 变成 a²，袖口半透明）。
PAD = 120
px, py = FIT["pivot"]
arm = Image.open(f"{S}/02-knife-arm-overlay-draft.png").convert("RGBA").crop((box[0] - PAD, box[1] - PAD, box[2] + PAD, box[3] + PAD))
arm = arm.convert("RGBa")
r = arm.rotate(FIT["ang"], resample=Image.BICUBIC, center=(px + PAD, py + PAD), translate=(FIT["dx"], FIT["dy"]))
w2, h2 = round((W + 2 * PAD) * FIT["sc"]), round((H + 2 * PAD) * FIT["sc"])
r2 = r.resize((w2, h2), Image.BICUBIC).convert("RGBA")
armc = Image.new("RGBA", (W, H))
ox, oy = round(px - (px + PAD) * FIT["sc"]), round(py - (py + PAD) * FIT["sc"])
armc.paste(r2, (ox, oy))  # 画布是空的，直接贴（不带蒙版）
# 手臂内部（离边缘 3px 以上）一律不透明，柔边保留
_a = np.asarray(armc).copy()
_solid = ndimage.binary_erosion(ndimage.binary_fill_holes(_a[..., 3] > 128), iterations=3)
_a[..., 3] = np.where(_solid, 255, _a[..., 3])
armc = Image.fromarray(_a, "RGBA")
# 框线内侧：底图里框外透明 + 框线（深色）区域都不让手臂覆盖
ba = np.asarray(base)
rgb = ba[..., :3].astype(float)
outside = ba[..., 3] < 10
frame = dilate(outside, 13)  # 框线约 5–8px，留出余量
a = np.asarray(armc).copy()
a[..., 3] = np.where(frame, 0, a[..., 3])
save(Image.fromarray(a, "RGBA"), "p2b-arm")

# 对白泡：从泡内一点出发泛洪“接近白”的像素 → 填洞（文字）→ 外扩到描边外缘
lum = rgb.mean(2)
seed = (70, 130)  # (y, x) 泡内空白处
near = lum > 215
from collections import deque
inside = np.zeros_like(near)
q = deque([seed]); inside[seed] = True
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < H and 0 <= nx < W and near[ny, nx] and not inside[ny, nx]:
            inside[ny, nx] = True; q.append((ny, nx))
from scipy import ndimage
inside = ndimage.binary_fill_holes(inside)
ring = dilate(inside, 7) & ~inside
outline = inside | (ring & (lum < 150))
outline = ndimage.binary_fill_holes(dilate(outline, 1))
alpha = np.asarray(Image.fromarray((outline * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))).astype(float)
bub = np.dstack([rgb, alpha]).astype(np.uint8)
save(Image.fromarray(bub, "RGBA"), "p2b-bubble")
ys, xs = np.where(outline)
print("p2b bubble bbox", xs.min(), ys.min(), xs.max(), ys.max())

# ---------- 听见格 ----------
box = tuple(MAN["p3d"]["box"])
orig = np.asarray(Image.open("source/comic-v3/03-something-is-missing.png").convert("RGB").crop(box)).astype(float)
for name, f in (("p3d-eyes", "03-mom-eyes-up.png"), ("p3d-puzz", "04-mom-puzzled.png")):
    v = np.asarray(Image.open(f"{S}/{f}").convert("RGB").crop(box)).astype(float)
    d = np.abs(v - orig).sum(2) > 70
    roi = np.zeros_like(d); roi[120:300, 110:310] = True  # 眉、眼、嘴所在的脸部区域
    m = ndimage.binary_opening(d & roi, iterations=1)
    m = dilate(m, 9)
    m = ndimage.binary_fill_holes(m)
    alpha = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4))).astype(float)
    alpha[~roi] = 0
    save(Image.fromarray(np.dstack([v, alpha]).astype(np.uint8), "RGBA"), name)
    ys, xs = np.where(alpha > 10)
    print(name, "changed region", xs.min(), ys.min(), xs.max(), ys.max())
print("arm fit", FIT)
