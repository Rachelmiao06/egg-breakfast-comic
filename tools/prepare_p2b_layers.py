"""p2b（切菜格）新分层素材：ChatGPT 生成的 PNG → public/assets/comic-v5/p2b/。
用法：python3 -I tools/prepare_p2b_layers.py <animation-assets 目录>（含 inpanel-v2/B-p2b/）
- 整格层都拉伸到 B3a 的尺寸（生成图各有 ±0.5% 误差）再缩到 1400 宽；图本身没有烘进去的黑边（已逐边检查，只有胡萝卜底下的阴影），所以不裁。
- base0/base1/base2 = B3a/B3b/B3c（整根 → 切掉一半 → 基本切完；扶菜的手随胡萝卜移动，丁堆越来越多），不透明。
- knifeA/knifeB/knifeC = B2a/B2b/B2c 握刀的手＋刀，透明。按画面实际：A 刀放平压下去、B 中间、C 刀跟抬起（文件名里的"raised/down"和画面相反）。
- front = 对白泡（纸面 + 描边 + 尾巴）从 B3a 里按颜色连通域抠出来的不透明层，盖在握刀手之上：抬刀时袖口会伸到泡下面，泡不被手挡住。
- static = base0 + knifeA + front（静态 / 减少动态效果）。
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

root = sys.argv[1]
B = os.path.join(root, "inpanel-v2", "B-p2b")
out = "public/assets/comic-v5/p2b"
os.makedirs(out, exist_ok=True)
ref = Image.open(os.path.join(B, "B3a-carrot-whole.png")).convert("RGB")
W0, H0 = ref.size
OW = 1400
OH = round(OW * H0 / W0)

def fit(name):
    return Image.open(os.path.join(B, name)).convert("RGBA").resize((OW, OH), Image.LANCZOS)

def save(im, name, rgb=False):
    (im.convert("RGB") if rgb else im).save(f"{out}/{name}.webp", quality=92, method=6)

bases = {"base0": "B3a-carrot-whole.png", "base1": "B3b-carrot-half.png", "base2": "B3c-carrot-short.png"}
L = {}
for k, f in bases.items():
    L[k] = fit(f); save(L[k], k, rgb=True)
for k, f in {"knifeA": "B2a-knife-raised.png", "knifeB": "B2b-knife-middle.png", "knifeC": "B2c-knife-down.png"}.items():
    L[k] = fit(f); save(L[k], k)

# 对白泡：奶油色连通域（含字的洞）膨胀到包住描边
a = np.array(L["base0"].convert("RGB")).astype(int)
lum = a.sum(2) / 3
cream = (lum > 215) & ((a[:, :, 0] - a[:, :, 2]) < 60)
lab, _ = ndi.label(cream)
seed = lab[int(OH * 0.07), int(OW * 0.27)]
assert seed != 0, "seed not in cream"
bub = ndi.binary_fill_holes(lab == seed)
bub = ndi.binary_dilation(bub, iterations=int(OW * 0.0075))
alpha = ndi.gaussian_filter(bub.astype(float), 1.0)
front = L["base0"].copy()
front.putalpha(Image.fromarray((np.clip(alpha, 0, 1) * 255).astype("uint8")))
save(front, "front")
print("bubble px", int(bub.sum()), "bbox", np.argwhere(bub).min(0), np.argwhere(bub).max(0))

st = L["base0"].copy()
for k in ("knifeA",):
    st.alpha_composite(L[k])
st.alpha_composite(front)
save(st, "static", rgb=True)
print("ok", (OW, OH), "aspect", OW / OH)
