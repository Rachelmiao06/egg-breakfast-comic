"""临时抠蛋（feat/kitchen-scene 用）：cv2.grabCut + 羽化。正式版由 split_scene.py 产出。"""
import sys
import cv2
import numpy as np

src = cv2.imread("source/kitchen-main.png")
x0, y0, x1, y1 = 515, 140, 925, 535  # 包含蛋和手脚的矩形（场景像素）
rect = (x0, y0, x1 - x0, y1 - y0)
mask = np.zeros(src.shape[:2], np.uint8)
bgd = np.zeros((1, 65), np.float64)
fgd = np.zeros((1, 65), np.float64)
cv2.grabCut(src, mask, rect, bgd, fgd, 6, cv2.GC_INIT_WITH_RECT)
fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
# 去掉零碎块，只留最大连通域
n, lab, stats, _ = cv2.connectedComponentsWithStats(fg)
if n > 1:
    big = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    fg = np.where(lab == big, 255, 0).astype(np.uint8)
fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
alpha = cv2.GaussianBlur(fg, (3, 3), 0)
rgba = cv2.cvtColor(src, cv2.COLOR_BGR2BGRA)
rgba[:, :, 3] = alpha
crop = rgba[y0:y1, x0:x1]
cv2.imwrite("public/assets/scene-draft/egg.png", crop)
# 检查图：品红底
chk = np.full_like(crop, 255); chk[:, :, 1] = 0
a = crop[:, :, 3:4] / 255.0
chk[:, :, :3] = (crop[:, :, :3] * a + chk[:, :, :3] * (1 - a)).astype(np.uint8)
cv2.imwrite("tools/draft_egg_check.png", chk)
ys, xs = np.where(alpha > 128)
print("crop size", crop.shape[1], crop.shape[0], "| egg bbox in scene px:", x0 + xs.min(), y0 + ys.min(), x0 + xs.max(), y0 + ys.max())

# 临时底图：把画中的蛋和旁边动作线 inpaint 掉（质量一般，只给预览用；正式底图由 layers 分支产出）
hole = cv2.dilate(fg, np.ones((15, 15), np.uint8))
for (ax0, ay0, ax1, ay1) in [(885, 140, 950, 195), (540, 465, 565, 505)]:  # 动作线
    hole[ay0:ay1, ax0:ax1] = 255
noegg = cv2.inpaint(src, hole, 7, cv2.INPAINT_TELEA)
cv2.imwrite("public/assets/scene-draft/poster-noegg.jpg", noegg, [cv2.IMWRITE_JPEG_QUALITY, 88])
print("wrote poster-noegg.jpg")
