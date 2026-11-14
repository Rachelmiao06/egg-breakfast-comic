"""B3 饭桌上的碗：复用第 3 页漫画 p3b 格里的配菜饭碗（碗里没有蛋），只读原图、输出副本，不重画。

来源：source/comic-v3/03-something-is-missing.png（只读），裁切框 CROP（页面像素）。
做法（全部是裁切和遮罩，不改任何像素颜色）：
  1. 墨线 = 亮度 < INK 的像素；从裁切框边缘往里做泛洪（墨线是墙），没被淹到的就是碗身（碗身轮廓线在碗沿以下是闭合的）。
  2. 碗沿以上用椭圆截断：只保留碗口外椭圆以内的部分，碗沿外的锅铲、正在落下的配菜和右上角的锅都去掉。
  3. 前沿遮挡层 = 碗身里、碗口内沿前弧（米饭的前边缘）以下的部分：挡住碗里蛋的下部。
输出：public/assets/scene/bowl-body.png、bowl-front.png（RGBA，同尺寸，像素对齐），并打印 backgrounds.json bowl 块要填的数值。
用法：python3 tools/prepare_bowl.py
"""
import json
from collections import deque

from PIL import Image, ImageFilter

SRC = "source/comic-v3/03-something-is-missing.png"
CROP = (548, 140, 992, 441)        # 页面像素：x0, y0, x1, y1（下沿停在格框黑线之上）
INK = 110                         # 墨线亮度阈值
ELL_K = 1.0                       # 碗沿以上的椭圆截断系数（1 = 拟合出的碗口外椭圆）
GROW = 2                          # 泛洪时把墨线加粗的像素（封住墨线上的小缺口），之后遮罩按同样半径收回
OUT = "public/assets/scene"
BG = json.load(open("src/app/preview/visual/backgrounds.json"))

page = Image.open(SRC).convert("RGB")
im = page.crop(CROP)
W, H = im.size
px = im.load()
lum = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
L = im.convert("L").filter(ImageFilter.MinFilter(2 * GROW + 1)).load()   # 暗线向外扩 GROW
ink = [[L[x, y] < INK for x in range(W)] for y in range(H)]

# ---- 1. 泛洪找背景 ----
bgm = [[False] * W for _ in range(H)]
q = deque()
for x in range(W):   # 只从上沿和左右两边进水：下沿贴着格框黑线，碗的圈足挨着它
    for y in (0,):
        if not ink[y][x]: bgm[y][x] = True; q.append((x, y))
for y in range(H):
    for x in (0, W - 1):
        if not ink[y][x] and not bgm[y][x]: bgm[y][x] = True; q.append((x, y))
while q:
    x, y = q.popleft()
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < W and 0 <= ny < H and not bgm[ny][nx] and not ink[ny][nx]:
            bgm[ny][nx] = True; q.append((nx, ny))

# ---- 2. 测碗口外椭圆：碗身轮廓（碗沿以下闭合）每行最左 / 最右的非背景像素，最宽那行 = 椭圆中心行 ----
def row_extent(y):
    xs = [x for x in range(W) if not bgm[y][x]]
    return (xs[0], xs[-1]) if xs else None
rows = {y: row_extent(y) for y in range(H)}
# 只在下半部分找（上半部分会被锅铲、配菜、锅连到外面）
cand = {y: e for y, e in rows.items() if e and y > H * 0.25}
cy = max(cand, key=lambda y: cand[y][1] - cand[y][0])
x0, x1 = cand[cy]
cx, rx = (x0 + x1) / 2, (x1 - x0) / 2
# 碗沿顶：中线上从上往下第一条墨线（碗口外椭圆的后缘）
col = int(cx)
top = next(y for y in range(H) if ink[y][col])
ry = cy - top
# 碗底：最下面一行仍有碗身像素
bottom = max(y for y, e in rows.items() if e and y > cy)

# ---- 3. 遮罩 ----
def in_ellipse(x, y, k=1.0):
    return ((x - cx) / (rx * k)) ** 2 + ((y - cy) / (ry * k)) ** 2 <= 1
body = Image.new("L", (W, H), 0); bp = body.load()
for y in range(H):
    for x in range(W):
        # 碗沿以下：泛洪结果（碗身轮廓闭合）；碗沿以上：碗口外椭圆以内全部保留（正在落下的配菜画在后沿上，算作碗里的菜）
        inside = (not bgm[y][x]) if y >= cy else in_ellipse(x, y, ELL_K)
        if inside: bp[x, y] = 255
# 碗口内沿前弧（米饭的前边缘）：外椭圆按碗沿厚度收一点
RIM_T = 0.06
irx, iry = rx * (1 - RIM_T), ry * (1 - RIM_T * 2.2)
front_y = lambda x: cy + iry * max(0.0, 1 - ((x - cx) / irx) ** 2) ** 0.5 if abs(x - cx) < irx else cy
front = Image.new("L", (W, H), 0); fp = front.load()
for y in range(H):
    for x in range(W):
        if bp[x, y] and y >= front_y(x): fp[x, y] = 255

# 泛洪时墨线加粗了 GROW，遮罩外缘因此多出一圈背景色：按同样半径收回（保留原墨线）
body = body.filter(ImageFilter.MinFilter(2 * GROW - 1)); bp = body.load()
for y in range(H):
    for x in range(W):
        if not bp[x, y]: fp[x, y] = 0

def save(mask, name):
    out = im.copy().convert("RGBA"); out.putalpha(mask)
    bb = body.getbbox()
    out.crop(bb).save(f"{OUT}/{name}")
    return bb
bb = save(body, "bowl-body.png")
save(front, "bowl-front.png")

# ---- 4. 放到场景里：碗口宽 = 2 × bowl.rim.rx（场景像素）；蛋脚底 = 碗口内沿前弧中点以下 HIDE 场景像素 ----
target_rx = BG["bowl"]["rim"]["rx"]
k = target_rx / rx                                  # 场景像素 / 图片像素
HIDE = 25                                           # 蛋脚下被前沿挡住的场景像素
foot_img = (cx, front_y(cx) + HIDE / k)             # 图片坐标（裁切框内）
bx0, by0, bx1, by1 = bb
box = [round((bx0 - foot_img[0]) * k), round((by0 - foot_img[1]) * k), round((bx1 - bx0) * k), round((by1 - by0) * k)]
res = {
    "crop_page_px": CROP, "bbox_in_crop_px": bb, "image_px": [bx1 - bx0, by1 - by0],
    "rim_ellipse_crop_px": {"cx": round(cx, 1), "cy": cy, "rx": round(rx, 1), "ry": ry}, "bottom_crop_px": bottom,
    "scene_per_image_px": round(k, 4),
    "bowl.box": box,
    "bowl.rim": {"dy": round((cy - foot_img[1]) * k), "rx": target_rx, "ry": round(ry * k)},
    "bowl.rimFrontDy": round((front_y(cx) - foot_img[1]) * k),
    "bowl.baseDy": round((bottom - foot_img[1]) * k),
}
print(json.dumps(res, ensure_ascii=False, indent=1))
