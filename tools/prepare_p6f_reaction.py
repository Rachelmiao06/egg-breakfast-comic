"""p6f（结尾特写，妈妈反应）新素材：p6f-delivery（六张表情 + 两个符号叠加层）→ public/assets/comic-v5/p6f/。
用法：python3 -I tools/prepare_p6f_reaction.py <p6f-delivery 目录> <generated_images 目录>
- 六张表情（wide / down / viewer / half / closed / twitch，966×682）都是同一张底图只换脸部：和 wide 逐像素比对，差异只在 x 279–634、y 156–479，
  所以 wide 当底图（base.webp，整格），其余五张只存脸部框（270,150,645,490）的不透明补丁，硬切盖上，不会重影、没有接缝。
- 符号层（额头黑线 / 汗滴）来自 build_animation.py 用的两张 generated_images（exec-cd51c767 / exec-68b959e5，1492×1054 透明层），
  按它的裁切框取出（黑线 410,145 64×80；汗滴 648,240 70×100，966×682 坐标），保留原始分辨率。
- 时间线（毫秒级）见 src/app/preview/visual/ReactionFace.tsx，取自 p6f-delivery/timeline.txt。
"""
import os, sys
from PIL import Image

src, gen = sys.argv[1], sys.argv[2]
out = "public/assets/comic-v5/p6f"
os.makedirs(out, exist_ok=True)
W, H = 966, 682
Image.open(f"{src}/wide.png").convert("RGB").save(f"{out}/base.webp", quality=92, method=6)
BOX = (270, 150, 645, 490)
for n in ("down", "viewer", "half", "closed", "twitch"):
    Image.open(f"{src}/{n}.png").convert("RGB").crop(BOX).save(f"{out}/{n}.webp", quality=92, method=6)
def overlay(file, box, name):
    im = Image.open(os.path.join(gen, file)).convert("RGBA")
    k = im.size[0] / W
    x, y, w, h = box
    im.crop((round(x * k), round(y * k), round((x + w) * k), round((y + h) * k))).save(f"{out}/{name}.webp", quality=92, method=6)
overlay("exec-cd51c767-68fe-4e80-b7a0-f2978ea7f000.png", (410, 145, 64, 80), "stress")
overlay("exec-68b959e5-b80a-49a8-811c-d41504e6c708.png", (648, 240, 70, 100), "sweat")
print("ok", BOX)
