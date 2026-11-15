"""p2d（配菜入锅格）新分层素材：ChatGPT 生成的 PNG → public/assets/comic-v5/p2d/。
用法：python3 -I tools/prepare_p2d_layers.py <animation-assets 目录>（含 p2d-clean-v2/ 和 inpanel-v2/A-p2d/）
所有整格层先拉伸到干净底图的尺寸（2184×720；生成图各有 ±0.5% 的尺寸误差），再统一裁掉四周 24px 的深色边框，最后缩到 1800 宽。
panfull = A4（锅内菜更满）只保留锅里那一截（上缘羽化），避免整张交叉淡入时案板、锅沿对不齐的重影。
掉落的单颗菜（A3，九张 1254² 透明图）裁到各自包围盒，最长边 180px。static = 底图 + 菜堆 + 木铲推入（第 1 帧，减少动态效果用）。
"""
import glob, os, sys
import numpy as np
from PIL import Image

root = sys.argv[1]
A = os.path.join(root, "inpanel-v2", "A-p2d")
out = "public/assets/comic-v5/p2d"
os.makedirs(out, exist_ok=True)
base0 = Image.open(os.path.join(root, "p2d-clean-v2", "p2d-clean-base.png")).convert("RGBA")
W0, H0 = base0.size
CROP = 24
OW = 1800
OH = round(OW * (H0 - 2 * CROP) / (W0 - 2 * CROP))

def fit(im):
    im = im.convert("RGBA").resize((W0, H0), Image.LANCZOS)
    return im.crop((CROP, CROP, W0 - CROP, H0 - CROP)).resize((OW, OH), Image.LANCZOS)

def save(im, name, rgb=False):
    (im.convert("RGB") if rgb else im).save(f"{out}/{name}.webp", quality=92, method=6)

base = fit(base0)
save(base, "base", rgb=True)
parts = {"pile1": "A1-pile", "pile2": "A2a-pile-sliding", "pile3": "A2b-pile-remnants", "spatA": "A5a-hand-spatula-push", "spatB": "A5b-hand-spatula-return"}
L = {}
for k, f in parts.items():
    L[k] = fit(Image.open(os.path.join(A, f + ".png")))
    save(L[k], k)
# 锅内菜更满：只留锅里那一截，上缘 0.72H → 0.76H 羽化
a4 = fit(Image.open(os.path.join(A, "A4-pan-full.png")))
ramp = np.clip((np.arange(OH) / OH - 0.72) / 0.04, 0, 1)
alpha = (np.tile(ramp[:, None], (1, OW)) * 255).astype("uint8")
a4.putalpha(Image.fromarray(alpha))
save(a4, "panfull")
# 掉落的单颗菜
for kind, key in [("carrot", "carrot"), ("corn", "corn"), ("scallion", "scal")]:
    for i in (1, 2, 3):
        im = Image.open(os.path.join(A, f"A3-{kind}-0{i}.png")).convert("RGBA")
        im = im.crop(im.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox())
        s = 180 / max(im.size)
        im = im.resize((max(1, round(im.size[0] * s)), max(1, round(im.size[1] * s))), Image.LANCZOS)
        im.save(f"{out}/d-{key}{i}.webp", quality=92, method=6)
        print("sprite", key, i, im.size)
st = base.copy()
for k in ("pile1", "spatA"):
    st.alpha_composite(L[k])
save(st, "static", rgb=True)
print("ok", (OW, OH), "aspect", OW / OH)
