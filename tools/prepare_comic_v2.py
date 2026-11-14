"""用户最终选定的漫画素材 → 网页用图（feat/visual-direction，可重跑）。
- page1：按格间纸白自动切出四格，保留图内框线、对白和一圈纸白（PAD）。
- 三个头部姿态：按透明列切开。
- 切菜近景、红锅宽条：原图无框，只缩放导出，框线由网页加。
"""
import json
import numpy as np
from PIL import Image

SRC, OUT = "source/comic-v2", "public/assets/comic-v2"
PAD = 6
report = {}

def gutters(mask_1d, min_len):
    """返回 False 连续段（内容区）的 [start,end)"""
    runs, start = [], None
    for i, v in enumerate(mask_1d):
        if v and start is None: start = i
        if not v and start is not None:
            if i - start >= min_len: runs.append((start, i))
            start = None
    if start is not None and len(mask_1d) - start >= min_len: runs.append((start, len(mask_1d)))
    return runs

def panels(path):
    im = Image.open(path).convert("RGB"); a = np.asarray(im).astype(int)
    paper = np.median(a[2:10, 2:10].reshape(-1, 3), axis=0)
    ink = np.abs(a - paper).sum(2) > 40              # 非纸白
    rows = gutters(ink.mean(1) > 0.02, 60)
    out = []
    for (y0, y1) in rows:
        cols = gutters(ink[y0:y1].mean(0) > 0.02, 60)
        for (x0, x1) in cols:
            out.append((max(0, x0 - PAD), max(0, y0 - PAD), min(im.width, x1 + PAD), min(im.height, y1 + PAD)))
    return im, out, paper.tolist()

im, boxes, paper = panels(f"{SRC}/page1-choose-prep.png")
names = ["p1a-fridge-think", "p1b-hand-egg", "p1c-face-idea", "p1d-chop-medium"]
assert len(boxes) == 4, boxes
report["paper"] = paper
for n, b in zip(names, boxes):
    c = im.crop(b); c.save(f"{OUT}/{n}.webp", quality=92, method=6)
    report[n] = {"box": b, "size": c.size}

# 三个头部姿态
sp = Image.open(f"{SRC}/mom-heads-3pose.png").convert("RGBA"); al = np.asarray(sp)[:, :, 3]
cols = gutters(al.max(0) > 20, 80)
heads = ["head-down-smile", "head-up-surprised", "head-up-smile"]
assert len(cols) == 3, cols
for n, (x0, x1) in zip(heads, cols):
    ys = np.where(al[:, x0:x1].max(1) > 20)[0]
    b = (max(0, x0 - 8), max(0, ys.min() - 8), min(sp.width, x1 + 8), min(sp.height, ys.max() + 9))
    c = sp.crop(b); c.save(f"{OUT}/{n}.webp", quality=92, method=6)
    report[n] = {"box": b, "size": c.size}

for n, f, w in [("closeup-chop", "chop-hands-closeup.png", 1536), ("notice-pan-strip", "notice-pan-strip.png", 2172)]:
    c = Image.open(f"{SRC}/{f}").convert("RGB"); c.save(f"{OUT}/{n}.webp", quality=90, method=6)
    report[n] = {"size": c.size}

json.dump(report, open(f"{OUT}/manifest.json", "w"), indent=1, default=int)
print(json.dumps(report, indent=1, default=int))

# ---- 头像杂边清理：低 alpha 柔边收紧 + 去掉底边彩色碎点 ----
import cv2
for n in heads:
    p = f"{OUT}/{n}.webp"
    a = np.asarray(Image.open(p).convert("RGBA")).astype(np.float32)
    al = a[:, :, 3]
    na = np.clip((al - 40) / (220 - 40), 0, 1)
    bin_ = (na > 0.5).astype(np.uint8)
    k, lab, st, _ = cv2.connectedComponentsWithStats(bin_, 8)
    keep = np.zeros(k, bool); keep[1:] = st[1:, cv2.CC_STAT_AREA] >= 2000
    near = cv2.dilate(keep[lab].astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    na = np.where(near, na, 0)
    a[:, :, 3] = na * 255
    Image.fromarray(a.astype(np.uint8), "RGBA").save(p, quality=92, method=6)

# 切菜近景的手刀分层：合并插画抠不干净（刀身缺块、补洞发糊），不硬做；列入缺图清单，等分层素材。
