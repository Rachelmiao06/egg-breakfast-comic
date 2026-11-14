"""接缝转场 CSS 遮罩小样用的两张图（自己生成，未复制 SeamTransitions 代码）：
- seam-mask.png：左侧不透明、中间一条分层噪声毛边、右侧透明，宽 3 倍于高度比例，配合 mask-position 推进。
- seam-line.png：同一条毛边上的墨线（2–4px），叠在前沿。
"""
import numpy as np
from PIL import Image

W, H = 3000, 1000
rng = np.random.default_rng(7)

def fbm(n, octaves):
    out = np.zeros(n)
    for scale, amp in octaves:
        k = max(2, n // scale)
        pts = rng.uniform(-1, 1, k + 1)
        out += amp * np.interp(np.arange(n), np.linspace(0, n - 1, k + 1), pts)
    return out

edge = 1500 + fbm(H, [(300, 120), (90, 40), (24, 12)])
xs = np.arange(W)[None, :]
d = xs - edge[:, None]                       # <0 左侧（显示），>0 右侧（隐藏）
alpha = np.clip(0.5 - d / 3.0, 0, 1)          # 3px 羽化
Image.fromarray((alpha * 255).astype(np.uint8), "L").save("public/assets/preview/seam-mask.png", optimize=True)
width = 2.2 + 1.2 * (fbm(H, [(60, 1.0)]) + 1) / 2
ink = np.clip(1 - np.abs(d) / width[:, None], 0, 1)
rgba = np.zeros((H, W, 4), np.uint8); rgba[..., :3] = (43, 33, 24); rgba[..., 3] = (ink * 235).astype(np.uint8)
Image.fromarray(rgba, "RGBA").save("public/assets/preview/seam-line.png", optimize=True)
print("seam mask + line written")
