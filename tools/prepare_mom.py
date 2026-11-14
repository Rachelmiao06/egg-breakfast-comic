"""妈妈素材清理与裁切（集成会话维护，可重跑）。

输入（用户生成，只读）：
  source/mom-four-scenes.png  四组合并插画：左上切菜、右上炒配菜、左下调汁、右下端出拌饭（碗中央留给活动蛋）
  source/mom-spatula.png      妈妈伸出锅铲（接蛋）
问题：人物本体 alpha≈250–254，轮廓外有一圈 alpha 1–240 的柔边，颜色混着深色光晕，贴到米白背景上会出脏边。
处理：
  1. 柔边收紧：alpha 30 以下清零，30–230 线性拉到 0–255，230 以上视为不透明 255；
  2. 去色污染：柔边像素的 RGB 换成向外扩散的内侧颜色（只用 alpha≥230 的像素取色）；
  3. 去掉面积很小的孤立碎块；
  4. 按连通区域的重心分到四个象限，各自裁到包围盒 + 边距。
输出：public/assets/mom/{chop,stirfry,sauce,serve,spatula}.webp（裁切后、2 倍于显示尺寸以内），
      tools/mom_check.png（米白底检查图），并打印每组在原图中的包围盒和关键点。
"""
import json

import cv2
import numpy as np
from PIL import Image

LO, HI = 30, 230
PAD = 12


def clean(path):
    a = np.array(Image.open(path).convert("RGBA")).astype(np.float32)
    rgb, al = a[:, :, :3], a[:, :, 3]
    na = np.clip((al - LO) / (HI - LO), 0, 1)
    core = (al >= HI).astype(np.float32)
    # 去色污染：用内侧颜色向外扩散填充柔边
    fill = rgb * core[..., None]
    w = core.copy()
    acc_rgb, acc_w = fill.copy(), w.copy()
    for k in (3, 7, 15, 31):
        acc_rgb += cv2.GaussianBlur(fill, (k, k), 0)
        acc_w += cv2.GaussianBlur(w, (k, k), 0)
    spread = acc_rgb / np.maximum(acc_w[..., None], 1e-4)
    out_rgb = np.where(core[..., None] > 0, rgb, spread)
    # 去孤立碎块
    bin_ = (na > 0.5).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(bin_, 8)
    keep = np.zeros(n, bool)
    keep[1:] = stats[1:, cv2.CC_STAT_AREA] >= 400
    near = cv2.dilate(keep[lab].astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
    na = np.where(near, na, 0)
    out = np.dstack([np.clip(out_rgb, 0, 255), na * 255]).astype(np.uint8)
    return out, lab, stats, keep


def save_crop(img, box, name, max_w):
    x0, y0, x1, y1 = box
    crop = Image.fromarray(img[y0:y1, x0:x1], "RGBA")
    if crop.width > max_w:
        crop = crop.resize((max_w, round(crop.height * max_w / crop.width)), Image.LANCZOS)
    crop.save(f"public/assets/mom/{name}.webp", quality=92, method=6)
    return crop


report = {}
checks = []

# ---- 四组 ----
img, lab, stats, keep = clean("source/mom-four-scenes.png")
H, W = img.shape[:2]
groups = {"chop": [], "stirfry": [], "sauce": [], "serve": []}
members = {k: [] for k in groups}
for i in np.where(keep)[0]:
    x, y, w, h, area = stats[i]
    cx, cy = x + w / 2, y + h / 2
    key = ("chop" if cx < W / 2 else "stirfry") if cy < H / 2 else ("sauce" if cx < W / 2 else "serve")
    groups[key].append((x, y, x + w, y + h))
    members[key].append(i)
for key, boxes in groups.items():
    # 只保留本组的连通区域（含柔边），避免矩形框把邻组的像素圈进来
    own = cv2.dilate(np.isin(lab, members[key]).astype(np.uint8), np.ones((9, 9), np.uint8))
    grp = img.copy()
    grp[:, :, 3] = (grp[:, :, 3] * own).astype(np.uint8)
    x0 = max(0, min(b[0] for b in boxes) - PAD)
    y0 = max(0, min(b[1] for b in boxes) - PAD)
    x1 = min(W, max(b[2] for b in boxes) + PAD)
    y1 = min(H, max(b[3] for b in boxes) + PAD)
    report[key] = {"box_in_source": [int(x0), int(y0), int(x1), int(y1)], "size": [int(x1 - x0), int(y1 - y0)]}
    checks.append(save_crop(grp, (x0, y0, x1, y1), key, 1400))
    if key == "serve":
        serve_img = grp

# 碗中央米饭（留给活动蛋）：右下组里亮白、低饱和的区域
sx0, sy0, sx1, sy1 = report["serve"]["box_in_source"]
reg = serve_img[sy0:sy1, sx0:sx1]
hsv = cv2.cvtColor(np.ascontiguousarray(reg[:, :, :3]), cv2.COLOR_RGB2HSV)
white = (hsv[:, :, 2] > 225) & (hsv[:, :, 1] < 30) & (reg[:, :, 3] > 200)
n, lab2, st2, cen2 = cv2.connectedComponentsWithStats(white.astype(np.uint8), 8)
big = 1 + int(np.argmax(st2[1:, cv2.CC_STAT_AREA]))
bx, by, bw, bh, _ = st2[big]
report["serve"]["rice_center_in_crop"] = [round(float(cen2[big][0]), 1), round(float(cen2[big][1]), 1)]
report["serve"]["rice_size_in_crop"] = [int(bw), int(bh)]

# ---- 锅铲 ----
img2, lab3, st3, keep3 = clean("source/mom-spatula.png")
ys, xs = np.where(img2[:, :, 3] > 128)
box = (max(0, xs.min() - PAD), max(0, ys.min() - PAD), min(img2.shape[1], xs.max() + PAD), min(img2.shape[0], ys.max() + 1))
report["spatula"] = {"box_in_source": [int(v) for v in box], "size": [int(box[2] - box[0]), int(box[3] - box[1])]}
# 铲面：左侧木色区域（x < 340），取它的包围盒和上沿中心
reg = img2[:, : 340]
hsv = cv2.cvtColor(np.ascontiguousarray(reg[:, :, :3]), cv2.COLOR_RGB2HSV)
wood = (hsv[:, :, 0] >= 8) & (hsv[:, :, 0] <= 25) & (hsv[:, :, 1] > 90) & (reg[:, :, 3] > 200)
wy, wx = np.where(wood)
blade = [int(wx.min()), int(wy.min()), int(wx.max()), int(wy.max())]
report["spatula"]["blade_in_source"] = blade
report["spatula"]["blade_in_crop"] = [int(blade[0] - box[0]), int(blade[1] - box[1]), int(blade[2] - box[0]), int(blade[3] - box[1])]
checks.append(save_crop(img2, box, "spatula", 1480))

# ---- 检查图：米白底 ----
cream = (246, 236, 217)
tiles = []
for c in checks:
    bg = Image.new("RGB", c.size, cream)
    bg.paste(c, (0, 0), c)
    bg.thumbnail((520, 400))
    tiles.append(bg)
sheet = Image.new("RGB", (sum(t.width for t in tiles) + 10 * len(tiles), max(t.height for t in tiles)), (255, 255, 255))
x = 0
for t in tiles:
    sheet.paste(t, (x, 0)); x += t.width + 10
sheet.save("tools/mom_check.png")
json.dump(report, open("tools/mom_report.json", "w"), indent=1, ensure_ascii=False)
print(json.dumps(report, indent=1, ensure_ascii=False))
