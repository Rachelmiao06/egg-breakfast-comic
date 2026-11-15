"""逐帧格内动作（scroll-motion-demo，2026-11-14）：稳定底图 + 只在动作区域切换的连续帧。
源：source/comic-v4-frames/<组>/frame-0{1,2,3}.png（桌面 new pics 原件的副本，原件不动），每组三张完整不透明画面。

做法（每组）：
1. 三帧互相对齐（SIFT + RANSAC 相似变换，只允许等比缩放、旋转、平移；已登记的组结果≈恒等）。
2. 底图 = 第 1 帧：框外纸白清成透明（panel_alpha.process），裁到手绘框的外接框。静态格（减少动态效果）也用它，静态和动画一致。
3. 动作区域 = 三帧里"手、工具、食物"所在的连通块的并集（在三帧差异明显的区域内找），外扩并羽化；
   可以再并上指定的形状（例如酱面椭圆）。框线、对白、躯干、碗身、瓶子等在区域外，始终来自底图，不随帧跳。
4. 动作层 = 第 2、3 帧在动作区域内的像素（区域外透明）。第 1 帧就是底图本身，不需要动作层。
用法（仓库根目录）：PYTHONPATH=tools python3 tools/prepare_frames.py <组> [<组> …]
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

from panel_alpha import process  # noqa: E402

SRC = "source/comic-v4-frames"
OUT = "public/assets/comic-v4/frames"
os.makedirs(OUT, exist_ok=True)

# 每组的参数。extra：额外并入动作区域的椭圆（第 1 帧像素坐标，cx, cy, rx, ry）；
# exclude：不允许进入动作区域的矩形（保持静态，例如扶碗的手、对白泡），[x0, y0, x1, y1]
GROUPS = {
    "C-sauce": {"key": "p3a", "width": 1000, "extra": [], "exclude": [], "diff": 90, "grow": 6},
    # front：从底图取出、画在动作帧之上的稳定前景（遮挡层）。bubble = 从种子点泛洪的对白泡；red = 种子点所在的红色锅身（向外扩 grow 像素，带上锅沿）
    "A-chopping": {"key": "p2b", "width": 1100, "extra": [], "exclude": [], "diff": 90, "grow": 6,
                   "front": [{"rule": "bubble", "seed": [300, 200]}]},
    "B-pouring": {"key": "p2d", "width": 1600, "extra": [], "exclude": [], "diff": 90, "grow": 6,
                  "front": [{"rule": "bubble", "seed": [250, 250]}, {"rule": "red", "seed": [0, 540], "grow": 8}]},
}


def load(group, i):
    return np.asarray(Image.open(f"{SRC}/{group}/frame-0{i}.png").convert("RGB"))


def align(frames):
    H, W = frames[0].shape[:2]
    sift = cv2.SIFT_create(6000)
    k0, d0 = sift.detectAndCompute(cv2.cvtColor(frames[0], cv2.COLOR_RGB2GRAY), None)
    out = [frames[0]]
    for f in frames[1:]:
        if f.shape != frames[0].shape:
            f = cv2.resize(f, (W, H), interpolation=cv2.INTER_CUBIC)
        k1, d1 = sift.detectAndCompute(cv2.cvtColor(f, cv2.COLOR_RGB2GRAY), None)
        m = cv2.BFMatcher().knnMatch(d1, d0, k=2)
        good = [a for a, b in m if a.distance < 0.7 * b.distance]
        src = np.float32([k1[a.queryIdx].pt for a in good])
        dst = np.float32([k0[a.trainIdx].pt for a in good])
        M, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=2, maxIters=8000, confidence=0.999)
        s = float(np.hypot(M[0, 0], M[1, 0]))
        print(f"  align: inliers {int(inl.sum())}/{len(good)} scale {s:.4f} t ({M[0, 2]:.2f}, {M[1, 2]:.2f})")
        out.append(cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE))
    return out


def actor_mask(frame, zone):
    """frame 里落在 zone 内的"非深色"连通块（手、工具、食物），带上自己的描边"""
    lum = frame.mean(2)
    lab, n = ndimage.label(lum > 80)
    if n == 0:
        return np.zeros(lum.shape, bool)
    inside = ndimage.sum(zone, lab, range(1, n + 1))
    size = ndimage.sum(np.ones_like(zone), lab, range(1, n + 1))
    keep = np.where((inside / np.maximum(size, 1) > 0.6) & (size > 40))[0] + 1
    m = np.isin(lab, keep)
    m = m | (ndimage.binary_dilation(m, iterations=6) & (lum <= 80))
    return ndimage.binary_fill_holes(m)


def feather(mask, r):
    a = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(float)
    return a


def build(group):
    cfg = GROUPS[group]
    print(group)
    frames = align([load(group, i) for i in (1, 2, 3)])
    H, W = frames[0].shape[:2]
    # 三帧差异明显的区域（动作所在）
    diff = np.zeros((H, W), bool)
    for a in range(3):
        for b in range(a + 1, 3):
            diff |= np.abs(frames[a].astype(int) - frames[b].astype(int)).sum(2) > cfg["diff"]
    diff = ndimage.binary_opening(diff, iterations=2)
    zone = ndimage.binary_dilation(diff, iterations=10)
    region = np.zeros((H, W), bool)
    for f in frames:
        region |= actor_mask(f, zone)
    yy, xx = np.mgrid[0:H, 0:W]
    for cx, cy, rx, ry in cfg["extra"]:
        region |= ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1
    for x0, y0, x1, y1 in cfg["exclude"]:
        region[y0:y1, x0:x1] = False
    region = ndimage.binary_closing(region, iterations=3)
    region = ndimage.binary_dilation(region, iterations=cfg["grow"])

    # 底图：第 1 帧，框外透明，裁到框
    base = np.asarray(process(Image.fromarray(frames[0]), (0, 0, W, H)))
    ys, xs = np.where(base[..., 3] > 0)
    bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    inside_frame = base[..., 3] > 0
    alpha = feather(region, 2.5) * inside_frame
    scale = cfg["width"] / (bx1 - bx0)
    size = (cfg["width"], round((by1 - by0) * scale))

    def save(arr, name):
        im = Image.fromarray(arr.astype(np.uint8), "RGBA").crop((bx0, by0, bx1, by1)).resize(size, Image.LANCZOS)
        im.save(f"{OUT}/{name}.webp", quality=90, alpha_quality=100, method=6)

    key = cfg["key"]
    save(base, f"{key}-f1")
    # 稳定前景（遮挡层）：从底图取，画在动作帧之上；框外透明
    if cfg.get("front"):
        front = np.zeros((H, W), bool)
        f0 = frames[0].astype(int)
        lum0 = f0.mean(2)
        for spec in cfg["front"]:
            x, y = spec["seed"]
            if spec["rule"] == "bubble":
                lab, _ = ndimage.label(lum0 > 215)
                m = ndimage.binary_fill_holes(lab == lab[y, x])
                m = ndimage.binary_dilation(m, iterations=9)  # 带上泡的描边和尾巴边
            else:  # red：锅身被锅里堆高的菜分成几段，取 y 在 seed[1] 以下、面积够大的所有红色块
                R, G, B = f0[..., 0], f0[..., 1], f0[..., 2]
                # 锅身是深红（G 低），胡萝卜丁是橙（G 高），且锅身一定碰到画面下沿附近；这样不会把锅里的胡萝卜丁当成锅身
                red = (R > 150) & (G < 85) & (B < 90) & (R - G > 100)
                lab, n = ndimage.label(red)
                cy = ndimage.center_of_mass(red, lab, range(1, n + 1))
                sz = ndimage.sum(red, lab, range(1, n + 1))
                ymax = ndimage.maximum(np.indices(red.shape)[0], lab, range(1, n + 1))
                keep = [i + 1 for i in range(n) if cy[i][0] > y and sz[i] > 1500 and ymax[i] > H - 60]
                m = np.isin(lab, keep)
                m = ndimage.binary_dilation(ndimage.binary_closing(m, iterations=3), iterations=spec.get("grow", 6))
            print(f"   front {spec['rule']} px {int(m.sum())}")
            front |= m
        save(np.dstack([frames[0], feather(front, 1.2) * inside_frame]), f"{key}-front")
    for i in (2, 3):
        save(np.dstack([frames[i - 1], alpha]), f"{key}-f{i}")
    # 区域遮罩（调试 / 检查用）
    save(np.dstack([np.zeros_like(frames[0]), alpha]), f"{key}-region")
    meta = {"group": group, "key": key, "aspect": round((bx1 - bx0) / (by1 - by0), 4), "size": list(size), "regionPx": int(region.sum()), "framePx": int(inside_frame.sum())}
    print("  ", meta)
    return meta


if __name__ == "__main__":
    metas = {g: build(g) for g in (sys.argv[1:] or GROUPS)}
    path = f"{OUT}/frames.json"
    old = json.load(open(path)) if os.path.exists(path) else {}
    old.update(metas)
    json.dump(old, open(path, "w"), indent=1, ensure_ascii=False)
