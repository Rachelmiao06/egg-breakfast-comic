"""对白分层样板的素材（p6e "没事，是我拉肚子了。"）。

- 底图：public/assets/comic-v3/p6e-clean.webp（tools/replace_bubble_text.py --clean-only：原图 p6e-original 只清掉泡内旧字）。
- 泡遮罩：public/assets/comic-v3/p6e-bubble.webp —— 对白泡本身（纸面 + 描边 + 尾巴）的精确形状，白色不透明、其余透明。
  网页里用它做 CSS mask：泡以外的画面降饱和、降对比，泡里保持原样（奶油白、清楚）。泡的形状来自原图，不重画、不移除。
- 文字参数：按 replace_bubble_text.py 排字的结果（Lantinghei SC Heavy，字高 29 px，字距 −0.6 px，墨色），换算成画布百分比打印出来，
  PanelPerf 的 DialoguePanel 照着摆网页文字。
用法：python3 tools/dialogue_layers.py
"""
import json

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = "source/comic-v3-edits/p6e-original.webp"
OUT = "public/assets/comic-v3/p6e-bubble.webp"
SEED = (110, 70)  # 泡里的纸面（原文字左边）


def main():
    im = Image.open(SRC).convert("RGBA")
    a = np.asarray(im)
    rgb = a[..., :3].astype(int)
    H, W = rgb.shape[:2]
    paper = (rgb.min(2) > 200) & ((rgb.max(2) - rgb.min(2)) < 40)
    lab, _ = ndimage.label(paper)
    core = ndimage.binary_fill_holes(lab == lab[SEED[1], SEED[0]])  # 泡的纸面（文字是洞，一起填上）
    # 带上泡自己的描边：从纸面往外，只吃深色描边像素
    dark = rgb.max(2) < 120
    m = core.copy()
    for _ in range(7):
        m |= ndimage.binary_dilation(m) & dark
    m = ndimage.binary_dilation(m, iterations=1)  # 描边外缘的抗锯齿
    alpha = ndimage.gaussian_filter(m.astype(float), 0.6)
    out = np.zeros((H, W, 4), np.uint8)
    out[..., :3] = 255
    out[..., 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(OUT, lossless=True)
    ys, xs = np.where(m)
    print(json.dumps({"bubbleBoxPct": [round(xs.min() / W * 100, 2), round(ys.min() / H * 100, 2), round(xs.max() / W * 100, 2), round(ys.max() / H * 100, 2)],
                      "size": [W, H], "bubblePx": int(m.sum())}))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
