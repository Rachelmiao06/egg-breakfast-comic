"""p6e（结尾饭碗格）蛋黄流动：三张完整的新帧 → public/assets/comic-v5/p6e/。
用法：python3 -I tools/prepare_p6e_flow.py <p6e-full-frames 目录>（p6e-frame-01/02/03.png，泡里没有字）
三张都是重新生成的整格：碗、米饭、配菜的边线有细小差异，第 3 帧还缩放 / 微旋转了，整张交叉淡入会出现碗沿、米粒的重影。
所以：SIFT + RANSAC 把第 2、3 帧仿射配准到第 1 帧；只取"蛋黄流出处"的一块椭圆（羽化边缘）叠在第 1 帧上，其余永远是第 1 帧。
输出（1400 宽）：base = 第 1 帧；patch2 / patch3 = 第 2 / 3 帧的椭圆补丁（RGBA）；bubble = 泡形遮罩（alpha，奶油色连通域膨胀到包住描边）；
text = 旧对白字层（comic-v3/p6e-text-c.webp）按新旧泡的外框对应缩放平移；static = 第 3 帧补丁 + 对白（终态，减少动态效果用）。
"""
import sys
import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src = sys.argv[1]
OUT = "public/assets/comic-v5/p6e"
fr = [cv2.imread(f"{src}/p6e-frame-0{i}.png") for i in (1, 2, 3)]
ref = fr[0]
H, W = ref.shape[:2]
sift = cv2.SIFT_create(4000)
k0, d0 = sift.detectAndCompute(cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY), None)
reg = [ref]
for im in fr[1:]:
    k, d = sift.detectAndCompute(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY), None)
    m = cv2.BFMatcher(cv2.NORM_L2).knnMatch(d, d0, k=2)
    good = [a for a, b in m if a.distance < 0.7 * b.distance]
    s = np.float32([k[a.queryIdx].pt for a in good]); t = np.float32([k0[a.trainIdx].pt for a in good])
    M, _ = cv2.estimateAffine2D(s, t, method=cv2.RANSAC, ransacReprojThreshold=2.5)
    reg.append(cv2.warpAffine(im, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE))

OW = 1400
OH = round(OW * H / W)
def pil(a):
    return Image.fromarray(cv2.cvtColor(a, cv2.COLOR_BGR2RGB)).convert("RGBA").resize((OW, OH), Image.LANCZOS)
base, p2, p3 = (pil(a) for a in reg)

# 蛋黄流出处的椭圆（归一化坐标，按第 3 帧里蛋黄流到的最远位置留余量）
cxn, cyn, rx, ry = 0.665, 0.66, 0.215, 0.185
yy, xx = np.mgrid[0:OH, 0:OW]
d = np.sqrt(((xx / OW - cxn) / rx) ** 2 + ((yy / OH - cyn) / ry) ** 2)
alpha = np.clip((1.0 - d) / 0.28, 0, 1)  # 外 28% 羽化
alpha = ndi.gaussian_filter(alpha, 4)
def patch(im):
    im = im.copy(); im.putalpha(Image.fromarray((alpha * 255).astype("uint8"))); return im
P2, P3 = patch(p2), patch(p3)

# 对白泡遮罩
a = np.array(base.convert("RGB")).astype(int)
lum = a.sum(2) / 3
cream = (lum > 215) & ((a[:, :, 0] - a[:, :, 2]) < 60)
lab, _ = ndi.label(cream)
seed = lab[int(OH * 0.10), int(OW * 0.5)]
assert seed != 0
bub = ndi.binary_fill_holes(lab == seed)
bub = ndi.binary_dilation(bub, iterations=int(OW * 0.0075))
ba = ndi.gaussian_filter(bub.astype(float), 1.0)
mask = Image.new("RGBA", (OW, OH), (255, 255, 255, 0)); mask.putalpha(Image.fromarray((np.clip(ba, 0, 1) * 255).astype("uint8")))
nb = np.argwhere(bub)  # (y, x)

# 对白字层：旧字层 → 新泡（只取泡身，不含尾巴：用旧泡遮罩的外框）
old_text = Image.open("public/assets/comic-v3/p6e-text-c.webp").convert("RGBA")
old_bub = np.array(Image.open("public/assets/comic-v3/p6e-bubble.webp").convert("RGBA"))[:, :, 3] > 128
ob = np.argwhere(old_bub)
# 取泡身外框（去掉尾巴：行范围用泡的上 80%）
def body_box(pts):
    y0, y1 = pts[:, 0].min(), pts[:, 0].max(); cut = y0 + (y1 - y0) * 0.78
    body = pts[pts[:, 0] <= cut]
    return body[:, 1].min(), body[:, 0].min(), body[:, 1].max(), body[:, 0].max()
ox0, oy0, ox1, oy1 = body_box(ob); nx0, ny0, nx1, ny1 = body_box(nb)
sx = (nx1 - nx0) / (ox1 - ox0); sy = (ny1 - ny0) / (oy1 - oy0)
tw = Image.new("RGBA", (OW, OH), (0, 0, 0, 0))
resized = old_text.resize((round(old_text.size[0] * sx), round(old_text.size[1] * sy)), Image.LANCZOS)
tw.alpha_composite(resized, (round(nx0 - ox0 * sx), round(ny0 - oy0 * sy)))
print("text scale", round(sx, 3), round(sy, 3))

st = base.copy(); st.alpha_composite(P3); st.alpha_composite(tw)
import os
os.makedirs(OUT, exist_ok=True)
base.convert("RGB").save(f"{OUT}/base.webp", quality=92, method=6)
P2.save(f"{OUT}/patch2.webp", quality=92, method=6)
P3.save(f"{OUT}/patch3.webp", quality=92, method=6)
mask.save(f"{OUT}/bubble.webp", quality=95, method=6)
tw.save(f"{OUT}/text.webp", quality=95, method=6)
st.convert("RGB").save(f"{OUT}/static.webp", quality=92, method=6)
print("ok", (OW, OH), OW / OH)
