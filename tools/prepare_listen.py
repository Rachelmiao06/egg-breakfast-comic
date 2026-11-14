"""listen（接蛋前的声音停顿）近景层：阅读厨房台面的前沿一条，横版、竖版各一张。
只裁切加遮罩（上沿 14 像素羽化），不改像素。listen 段里这一条比墙面多放大一点（以底边中点为原点），像离镜头更近；
它只往外长、盖住台面，不露底。输出 public/assets/bg/friends-counter-front*.png，打印外接框（图片像素）。
用法：python3 tools/prepare_listen.py
"""
import json
import numpy as np
from PIL import Image

out = {}
for name, src, y0 in [("landscape", "source/bg-v3/BG-kitchen-secret-friends.png", 828), ("portrait", "source/bg-v3/kitchen-friends-portrait.png", 1742)]:
    im = Image.open(src).convert("RGBA")
    W, H = im.size
    strip = im.crop((0, y0, W, H))
    a = np.full((H - y0, W), 255, np.uint8)
    F = 14
    for i in range(F):
        a[i, :] = int(255 * (i + 1) / (F + 1))
    strip.putalpha(Image.fromarray(a))
    fn = "friends-counter-front.png" if name == "landscape" else "friends-counter-front-portrait.png"
    strip.save(f"public/assets/bg/{fn}")
    out[name] = {"src": f"/assets/bg/{fn}", "img": [0, y0, W, H - y0]}
print(json.dumps(out))
