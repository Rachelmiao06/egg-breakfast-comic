"""把用户提供的素材整理成网页用尺寸（集成会话维护，可重跑）。
- source/kitchen-clean.png -> public/assets/scene/kitchen-clean.webp（无蛋、无火苗、无油的厨房底图）
- source/egg.png           -> public/assets/scene/egg.webp（裁到不透明区域，2 倍显示尺寸）
"""
from PIL import Image
import numpy as np

EGG_DISPLAY_W = 388  # 与原画中蛋的宽度一致（场景像素）

clean = Image.open("source/kitchen-clean.png").convert("RGB")
assert clean.size == (1536, 1024), clean.size
clean.save("public/assets/scene/kitchen-clean.webp", quality=90, method=6)

egg = Image.open("source/egg.png").convert("RGBA")
al = np.array(egg)[:, :, 3]
ys, xs = np.where(al > 8)
egg = egg.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
w = EGG_DISPLAY_W * 2
h = round(egg.height * w / egg.width)
egg = egg.resize((w, h), Image.LANCZOS)
egg.save("public/assets/scene/egg.webp", quality=92, method=6)
print("egg.webp", egg.size, "-> display", EGG_DISPLAY_W, round(h / 2))
