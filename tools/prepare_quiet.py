"""寻找段 → 声音留白段（quiet）的桌角近景层：从门口厨房（new pics/hallway-landscape.png）里裁出左下角的台面一角。
只裁切加遮罩，不改像素。quiet 段镜头推到这个角落时，这一层比墙面多放大一点，形成纵深；它只会往外长、盖住地板，不露底。
输出 public/assets/bg/doorway-corner.png（RGBA，裁到外接框），打印外接框（图片像素）。用法：python3 tools/prepare_quiet.py
"""
import json
import cv2
import numpy as np
from scipy import ndimage

img = cv2.imread("source/bg-v3/hallway-landscape.png", cv2.IMREAD_COLOR)
H, W = img.shape[:2]
lum = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
free = (lum > 110).astype(np.uint8)
x0, y0, x1, y1 = 0, 868, 364, H
lim = np.zeros((H, W), np.uint8); lim[y0:y1, x0:x1] = 1
f = (free & lim) * 255
m = np.zeros((H, W), np.uint8)
for s in [(300, 930), (250, 950), (200, 965), (120, 975), (330, 982), (40, 985)]:
    ff = f.copy(); mask = np.zeros((H + 2, W + 2), np.uint8)
    if not ff[s[1], s[0]]: continue
    cv2.floodFill(ff, mask, s, 128); m |= (ff == 128).astype(np.uint8)
m = cv2.dilate(m, np.ones((5, 5), np.uint8)) & lim
m = ndimage.binary_fill_holes(m).astype(np.uint8)
# 台面后沿（(258,873) → (342,891) 的墨线）以上、圆角外侧（x > 360）是地板，不属于桌角
for x in range(258, W):
    yl = int(873 + (min(x, 342) - 258) * 18 / 84) - 1
    m[:yl, x] = 0
m[:, 361:] = 0
ys, xs = np.nonzero(m)
bx = [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]
rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA); rgba[:, :, 3] = m * 255
cv2.imwrite("public/assets/bg/doorway-corner.png", rgba[bx[1]:bx[1] + bx[3], bx[0]:bx[0] + bx[2]])
print(json.dumps({"corner": {"src": "/assets/bg/doorway-corner.png", "img": bx}}))
