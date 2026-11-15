"""p2b（切菜格）最终素材：ChatGPT 交付的 p2b-finished（唯一的握刀手 K0，绕固定刀尖转）→ public/assets/comic-v4/layers/p2b-*.webp。
用法：python3 -I tools/prepare_p2b_final.py <animation-assets 目录>（含 p2b-v4-approved-grip/ 和 p2b-finished/animation.json）
不用 48 张整帧：网页里直接让 K0 层绕刀尖实时旋转（PanelPerf.tsx ChopPanel），这里只出
  p2b-base（去掉握刀手的底图）、p2b-part（K0：袖口+手+刀，透明）、p2b-front（对白泡，从底图按颜色连通域抠出，盖在袖子上，算法同 build_animation.py）、
  frames/p2b-f1（静态格：底图 + K0 + 泡）。全部 1400 宽，原尺寸 1537×1023。刀尖（旋转支点）见 animation.json 的 pivot。
"""
import json, os, sys
import cv2
import numpy as np
from PIL import Image

root = sys.argv[1]
G = os.path.join(root, "p2b-v4-approved-grip")
anim = json.load(open(os.path.join(root, "p2b-finished", "animation.json")))
base = Image.open(os.path.join(G, "00-clean-base.png")).convert("RGBA")
actor = Image.open(os.path.join(G, "K0-rest.png")).convert("RGBA")
W, H = base.size
assert actor.size == base.size == (anim["width"], anim["height"])
OW = 1400
OH = round(OW * H / W)
def rs(im): return im.resize((OW, OH), Image.LANCZOS)

# 对白泡：和 build_animation.py 同一个算法（左上区域最大的奶油色轮廓，膨胀 15px 包住描边）
b = np.array(base)
region = b[:390, :780, :3].astype(np.int16)
white = ((region[:, :, 0] > 205) & (region[:, :, 1] > 185) & (region[:, :, 2] > 155) & ((region.max(2) - region.min(2)) < 75)).astype(np.uint8) * 255
cnt, _ = cv2.findContours(white, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
mask = np.zeros((H, W), np.uint8)
cv2.drawContours(mask, [max(cnt, key=cv2.contourArea)], -1, 255, -1)
mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
mask = cv2.GaussianBlur(mask, (0, 0), 1.0)
front = base.copy(); front.putalpha(Image.fromarray(mask))

d = "public/assets/comic-v4/layers"
os.makedirs(d, exist_ok=True)
rs(base).convert("RGB").save(f"{d}/p2b-base.webp", quality=92, method=6)
rs(actor).save(f"{d}/p2b-part.webp", quality=92, method=6)
rs(front).save(f"{d}/p2b-front.webp", quality=92, method=6)
st = base.copy(); st.alpha_composite(actor); st.alpha_composite(front)
rs(st).convert("RGB").save("public/assets/comic-v4/frames/p2b-f1.webp", quality=92, method=6)
px, py = anim["pivot"]
print("canvas", (W, H), "aspect", W / H, "pivot %", round(px / W * 100, 2), round(py / H * 100, 2))
