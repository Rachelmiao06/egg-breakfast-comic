#!/usr/bin/env python3
"""2026-11-15 把用户送来的 kitchen-sliced-delivery 接进来：
- 每张透明图按 alphaBounds 裁到可见边界，存成 webp（public/assets/bg-v4/<id>.webp，原生分辨率不放大）；
- 两张纯墙底图存成 wall-landscape.webp / wall-portrait.webp；
- 台面前沿（listen 推近用）从检查图的底部裁出，上沿羽化；
- 生成 src/app/preview/visual/kitchen-v4.json（横 / 竖版每层 src + 场景图片像素矩形 + 深度 z + 所属平面，以及落点）。
用法：python3 tools/prepare_kitchen_v4.py <delivery 目录>"""
import json, sys, os
from PIL import Image

D = sys.argv[1] if len(sys.argv) > 1 else "/Users/mac/Documents/Codex/2026-11-15/this-comes-from-your-vault-and-2/kitchen-sliced-delivery"
OUT = "public/assets/bg-v4"
os.makedirs(OUT, exist_ok=True)
L = json.load(open(f"{D}/layout-and-anchors.json"))

def save(im, name, q=88):
    im.save(f"{OUT}/{name}.webp", quality=q, method=6)

# 层 → 平面：wall 最远，far = 吊柜 / 窗，shelf = 左边层板上的东西（比台面略远），near = 台面 + 篮子 + 蔬菜，front = 篮子前壁 / 格纹布 / 葱身子（盖在蛋上面）
PLANE = {"wall-cabinet": "far", "window": "far", "empty-shelf": "shelf", "potted-plant": "shelf", "sugar-jar": "shelf", "white-bean-jar": "shelf", "pepper-jar": "shelf", "oil-bottle": "shelf", "soy-bottle": "shelf",
         "basket-front": "front", "gingham-cloth": "front", "scallion-body": "front"}
for name, a in L["assets"].items():
    if name in ("wall-landscape", "wall-portrait", "egg-reference"):
        continue
    im = Image.open(f"{D}/{a['file']}").convert("RGBA")
    l, t, r, b = a["alphaBounds"]
    save(im.crop((l, t, r, b)), name)
for v in ("landscape", "portrait"):
    wall = Image.open(f"{D}/assets/wall-{v}.png").convert("RGB")
    size = L["layouts"][v]["size"]
    if wall.size != tuple(size):
        wall = wall.resize(tuple(size), Image.LANCZOS)  # 仅 1847 → 1846 一行
    save(wall, f"wall-{v}", 90)

# 台面前沿（listen 推近的近景条）：从检查图底部裁，上沿 24px 羽化
def strip(scene, box, name):
    im = Image.open(f"{D}/{scene}").convert("RGBA").crop(box)
    a = im.getchannel("A")
    h = im.height
    px = a.load()
    for y in range(min(24, h)):
        for x in range(im.width):
            px[x, y] = int(255 * y / 24)
    im.putalpha(a)
    save(im, name)
strip("landscape-scene.png", (0, 828, 1672, 941), "counter-front-landscape")
strip("portrait-scene.png", (0, 1742, 852, 1846), "counter-front-portrait")

out = {"version": 1, "source": "kitchen-sliced-delivery（tools/prepare_kitchen_v4.py 生成，别手改；改落点在 backgrounds.json）", "anchors": L["anchors"]}
for v in ("landscape", "portrait"):
    lay = L["layouts"][v]
    items = []
    for id_, (x, y, w, h, z) in lay["items"].items():
        items.append({"id": id_, "src": f"/assets/bg-v4/{id_}.webp", "rect": [x, y, w, h], "z": z, "plane": PLANE.get(id_, "near")})
    items.sort(key=lambda i: i["z"])
    out[v] = {"size": lay["size"], "wall": f"/assets/bg-v4/wall-{v}.webp", "items": items}
json.dump(out, open("src/app/preview/visual/kitchen-v4.json", "w"), ensure_ascii=False, indent=1)
print("ok", len(out["landscape"]["items"]), "layers")
