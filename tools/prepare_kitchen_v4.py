#!/usr/bin/env python3
"""2026-11-15 把用户送来的 kitchen-original-layers（原来那张厨房背景拆成 18 层，叠回去和原图逐像素一致）接进来：
- 每层按可见像素裁到边界框，存 webp（public/assets/bg-v4/<id>.webp，原生像素不放大；画布 1672×941 = 原 reading.size）；
- 墙层（bg-wall）只画到台面后沿 y=670，往下镜像补一段墙（被台面盖住），远景层有一点位移时不会在台面后沿露缝；
- 生成 src/app/preview/visual/kitchen-v4.json：每层 src + 场景图片像素矩形 + 深度 z + 所属平面。
只有横版（竖版仍用原来的整张图）。用法：python3 tools/prepare_kitchen_v4.py <layers 目录>"""
import json, sys, os
from PIL import Image

D = sys.argv[1] if len(sys.argv) > 1 else "/Users/mac/Documents/Codex/2026-11-15/new-chat-6/kitchen-original-layers"
OUT = "public/assets/bg-v4"
os.makedirs(OUT, exist_ok=True)
order = json.load(open(f"{D}/layer-order.json"))
# 平面：wall 最远；shelf = 左边层板上的东西（比台面略远）；near = 台面 + 篮子后半 + 蔬菜（蛋站的地方）；front = 篮子前壁 / 格纹布 / 葱身子（盖在蛋上面）
PLANE = {"bg-wall": "wall", "shelf": "shelf", "plant": "shelf", "jar-character": "shelf", "jar-beans": "shelf", "jar-pepper": "shelf", "bottle-soy": "shelf", "bottle-oil": "shelf",
         "basket-front": "front", "gingham": "front", "scallion-body": "front"}
items = []
for z, name in enumerate(order):
    im = Image.open(f"{D}/{name}.png").convert("RGBA")
    if name == "bg-wall":
        w, h = im.size
        rgb = im.convert("RGB")
        full = Image.new("RGB", (w, h))
        full.paste(rgb.crop((0, 0, w, 670)), (0, 0))
        ext = rgb.crop((0, 670 - (h - 670), w, 670)).transpose(Image.FLIP_TOP_BOTTOM)  # 往下镜像补墙
        full.paste(ext, (0, 670))
        full.save(f"{OUT}/{name}.webp", quality=90, method=6)
        items.append({"id": name, "src": f"/assets/bg-v4/{name}.webp", "rect": [0, 0, w, h], "z": z, "plane": "wall"})
        continue
    l, t, r, b = im.getchannel("A").getbbox()
    im.crop((l, t, r, b)).save(f"{OUT}/{name}.webp", quality=90, method=6)
    items.append({"id": name, "src": f"/assets/bg-v4/{name}.webp", "rect": [l, t, r - l, b - t], "z": z, "plane": PLANE.get(name, "near")})
json.dump({"version": 2, "source": "kitchen-original-layers（tools/prepare_kitchen_v4.py 生成，别手改）", "landscape": {"size": [1672, 941], "wall": "/assets/bg-v4/bg-wall.webp", "items": items}},
          open("src/app/preview/visual/kitchen-v4.json", "w"), ensure_ascii=False, indent=1)
print("ok", len(items), "layers")
