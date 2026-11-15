"""从原画 source/kitchen-main.png 抽出火苗和锅里的油（与 kitchen-clean 逐像素对齐，可直接叠加）。
输出 public/assets/scene/flame.webp、oil.webp：裁到不透明包围盒外扩 4px 的无损 webp（整张 1536×1024 透明画布
里只有 2–3% 是火苗/油，整张 PNG 要 3 MB，裁完不到 50 KB），以及 tools/fx_check.png 检查图。
每张图的场景坐标会打印出来，需要同步到 src/lib/scene.ts 的 ANCHORS.flameSprite / oilSprite。
"""
import cv2
import numpy as np
from PIL import Image

W, H = 1536, 1024
orig = np.array(Image.open("source/kitchen-main.png").convert("RGB"))
clean = np.array(Image.open("source/kitchen-clean.png").convert("RGB"))
hsv = cv2.cvtColor(orig, cv2.COLOR_RGB2HSV)  # H 0-179
h, s, v = hsv[:, :, 0].astype(int), hsv[:, :, 1].astype(int), hsv[:, :, 2].astype(int)

PAD = 4

def save(name, rgb, alpha):
    rgba = Image.fromarray(np.dstack([rgb, alpha.astype(np.uint8)]), "RGBA")
    x0, y0, x1, y1 = rgba.getchannel("A").getbbox()
    box = (max(0, x0 - PAD), max(0, y0 - PAD), min(W, x1 + PAD), min(H, y1 + PAD))
    rgba.crop(box).save(f"public/assets/scene/{name}.webp", "WEBP", lossless=True, quality=100, method=6)
    print(f"{name}Sprite: [{box[0]}, {box[1]}, {box[2]}, {box[3]}]  ({box[2]-box[0]}×{box[3]-box[1]})")

# ---- 火苗：燃烧器区域里的高饱和橙黄色 + 蓝色 ----
fx0, fy0, fx1, fy1 = 580, 715, 880, 805
region = np.zeros((H, W), bool); region[fy0:fy1, fx0:fx1] = True
orange = (h >= 5) & (h <= 38) & (s > 110) & (v > 150)
blue = (h >= 95) & (h <= 130) & (s > 70) & (v > 90)
flame = (orange | blue) & region
flame = cv2.morphologyEx(flame.astype(np.uint8) * 255, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
flame = cv2.dilate(flame, np.ones((3, 3), np.uint8))
flame_a = cv2.GaussianBlur(flame, (5, 5), 0)
save("flame", orig, flame_a)

# ---- 油：锅底椭圆内、与干净底图差异明显的部分（油面 + 画中的油泡），只取锅底下半部 ----
diff = np.abs(orig.astype(int) - clean.astype(int)).sum(2)
yy, xx = np.mgrid[0:H, 0:W]
cx, cy, rx, ry = 728, 618, 330, 46
ell = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
inside = ell < 1.0
# 原画锅底中间画着一块静止的蛋影子（偏暗、低饱和），不能带进来，否则会和会动的影子重复
lum_o = orig.astype(int).mean(2); lum_c = clean.astype(int).mean(2)
painted_shadow = (lum_o < lum_c - 18) & (s < 140)
painted_shadow = cv2.dilate(painted_shadow.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
oil_core = (diff > 38) & inside & ~painted_shadow
oil_core = cv2.morphologyEx(oil_core.astype(np.uint8) * 255, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
oil_core = cv2.dilate(oil_core, np.ones((7, 7), np.uint8))
oil_a = cv2.GaussianBlur(oil_core, (15, 15), 0).astype(float)
# 椭圆外缘再柔化一次，避免硬边
oil_a *= np.clip((1.0 - ell) / 0.25, 0, 1)
save("oil", orig, oil_a)

# ---- 检查图：干净底图 + 火苗 + 油，裁到锅和灶台区域 ----
comp = clean.astype(float)
for a in (oil_a, flame_a.astype(float)):
    al = (a / 255.0)[..., None]
    comp = orig * al + comp * (1 - al)
Image.fromarray(np.hstack([orig[480:820, 340:1120], comp.astype(np.uint8)[480:820, 340:1120]])).save("tools/fx_check.png")
ys, xs = np.where(flame_a > 128); print("flame bbox", xs.min(), ys.min(), xs.max(), ys.max())
ys, xs = np.where(oil_a > 128); print("oil bbox", xs.min(), ys.min(), xs.max(), ys.max())
