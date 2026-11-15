#!/usr/bin/env python3
"""
格内"小循环"分层（Ponpon Mania 做法：先切层，再让极少数层有事做）。

对每一格：
1. 在手工给定的多边形里（原图像素坐标）切出运动部件：<格>-<层>.webp（和原格同尺寸的透明层，只有部件处有像素，边缘羽化）。
2. 把部件（含它身后需要补的地方）用 cv2.inpaint 补掉，得到底图 <格>-base.webp。
   部件在静止姿态下盖回原位 = 和原格逐像素一致；运动时露出的只是边缘一两像素的细缝，由补画的底图接住。
3. 手边三道"挥动线"留在底图里不动：它们压在碗沿的深色线上，抠掉再补会把碗沿线弄断（试过，补出一段缺口）。
4. 手臂这类"从身体里长出来"的部件，靠近支点的一端做渐变透明（fade），转动时和蛋身自然接上，不会露出切口。

用法：python3 tools/prepare_idle_layers.py [--preview DIR]    输出 public/assets/comic-v3/idle/
预览把"静止 / 部件转 +8° / 转 -8°"并排放大，补画质量以肉眼为准。
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/assets/comic-v3"
OUT = SRC / "idle"
SS = 4  # 多边形超采样，边缘抗锯齿

# 每格：part = [(层名, 多边形, 可选 fade=(端点, 朝向点, 渐变长度px), 可选 lines=(bbox, 暗度阈值))]
SPEC = {
    "p4f": dict(parts=[
        dict(id="arm", poly=[(263, 199), (272, 196), (285, 197), (297, 203), (298, 214), (290, 226), (282, 230), (276, 238), (268, 247), (258, 252), (252, 244), (253, 236), (262, 229), (260, 215), (262, 205)],
             fade=((255, 247), (274, 222), 9)),
    ]),
    "p5d": dict(parts=[
        dict(id="arm", poly=[(321, 176), (329, 170), (346, 168), (357, 172), (363, 182), (363, 196), (354, 204), (341, 206), (334, 209), (318, 232), (309, 241), (300, 238), (296, 226), (312, 208), (322, 198), (320, 186)],
             fade=((303, 233), (322, 205), 9)),
    ]),
    "p6c": dict(parts=[
        dict(id="arm", poly=[(308, 130), (316, 124), (330, 122), (343, 126), (348, 136), (346, 148), (338, 153), (327, 157), (318, 172), (308, 187), (300, 192), (291, 184), (290, 174), (305, 155), (309, 146), (308, 138)],
             fade=((296, 184), (312, 160), 9)),
    ]),
    # 担心格：蛋举着的小手（妈妈在喊"蛋黄都流出来了"，蛋不该还在挥手）；网页里手臂缩回蛋身
    "p6d": dict(parts=[
        dict(id="arm", poly=[(488, 231), (497, 229), (504, 233), (505, 241), (500, 246), (496, 250), (491, 257), (485, 259), (481, 254), (482, 249), (489, 244), (487, 237)],
             fade=((483, 255), (493, 245), 5)),
    ]),
    # 植物（第二批；p1a 的植物压在花盆和柜子前面，抠掉后补不出像样的底，没做）：多边形只给大范围，真正的叶子形状由颜色筛出来（叶子饱和、色相偏黄绿；背景奶油色 / 淡绿墙饱和度低；木头和盆沿色相偏橙）
    "p5a": dict(parts=[
        dict(id="vine", color=True, poly=[(98, 10), (130, 8), (170, 30), (172, 110), (168, 232), (100, 232), (98, 130), (90, 100), (98, 70), (92, 40)]),
    ]),
    "p5f": dict(parts=[
        dict(id="vine", color=True, poly=[(62, 15), (95, 5), (125, 35), (135, 75), (138, 206), (75, 206), (80, 130), (72, 95), (68, 60), (60, 40)]),
    ]),
    # 卧室：左右窗帘（上端钉在窗帘杆上，下摆摆）、两盆植物
    "p5c": dict(parts=[
        dict(id="curtainL", poly=[(206, 29), (250, 28), (251, 60), (246, 100), (240, 125), (236, 138), (233, 150), (238, 170), (240, 196), (212, 198), (208, 175), (213, 150), (214, 138), (209, 120), (206, 80)]),
        dict(id="curtainR", poly=[(339, 28), (383, 29), (385, 60), (385, 100), (383, 125), (383, 140), (380, 160), (384, 185), (358, 190), (356, 160), (358, 148), (357, 138), (347, 125), (342, 90), (339, 60)]),
        dict(id="plantL", poly=[(60, 36), (80, 30), (108, 38), (126, 58), (128, 84), (124, 108), (120, 128), (112, 126), (108, 100), (96, 90), (66, 92), (60, 70), (58, 50)]),
        dict(id="plantR", poly=[(384, 106), (400, 108), (420, 112), (426, 130), (420, 150), (406, 158), (392, 166), (385, 150), (384, 128)]),
    ]),
}


def mask_from_poly(shape, poly, feather=0.8):
    h, w = shape[:2]
    big = np.zeros((h * SS, w * SS), np.uint8)
    cv2.fillPoly(big, [np.array(poly, np.int32) * SS], 255)
    m = cv2.resize(big, (w, h), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    return cv2.GaussianBlur(m, (0, 0), feather)


def leaf_mask(rgb):
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    h, sat, v = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    green = (h >= 24) & (h <= 62)
    m = (green & (sat > 105)) | (green & (v < 120) & (sat > 60))
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    m = cv2.dilate(m, np.ones((3, 3), np.uint8), iterations=2)  # 把叶子外圈的浅色描边 / 抗锯齿带上
    return cv2.GaussianBlur(m.astype(np.float32), (0, 0), 0.7)


def lines_mask(rgb, bbox, thr, exclude_mask):
    x0, y0, x1, y1 = bbox
    lum = (rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114)
    m = np.zeros(rgb.shape[:2], np.uint8)
    m[y0:y1, x0:x1] = (lum[y0:y1, x0:x1] < thr).astype(np.uint8)
    m[exclude_mask > 0.02] = 0
    m = cv2.dilate(m, np.ones((3, 3), np.uint8))  # 把笔画边缘的抗锯齿半透明像素一起带上
    m[exclude_mask > 0.02] = 0
    return cv2.GaussianBlur(m.astype(np.float32), (0, 0), 0.6)


def fade_ramp(shape, fade):
    (ex, ey), (tx, ty), length = fade
    d = np.array([tx - ex, ty - ey], np.float32)
    d /= np.linalg.norm(d)
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]].astype(np.float32)
    s = (xx - ex) * d[0] + (yy - ey) * d[1]
    return np.clip(s / length, 0, 1)


def run(key, spec, preview):
    rgb = np.array(Image.open(SRC / f"{key}.webp").convert("RGB"))
    masks = {}
    for p in spec["parts"]:
        if "poly" in p:
            m = mask_from_poly(rgb.shape, p["poly"])
            if p.get("color"):
                m = m * leaf_mask(rgb)
            if "fade" in p:
                m = m * fade_ramp(rgb.shape, p["fade"])
            masks[p["id"]] = m
    hole = np.zeros(rgb.shape[:2], np.uint8)
    for p in spec["parts"]:
        if "lines" in p:
            ex = masks.get(p["exclude"], np.zeros(rgb.shape[:2], np.float32))
            masks[p["id"]] = lines_mask(rgb, p["lines"][0], p["lines"][1], ex)
    for m in masks.values():
        hole |= (m > 0.02).astype(np.uint8)
    # 渐变端（fade）那一端不补得太狠：补画区只取多边形本体，渐变区仍补，但部件盖回去时与它混合
    hole = cv2.dilate(hole, np.ones((5, 5), np.uint8))
    base = cv2.inpaint(rgb, hole * 255, 5, cv2.INPAINT_TELEA)
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(base).save(OUT / f"{key}-base.webp", quality=95, method=6)
    for pid, m in masks.items():
        rgba = np.dstack([rgb, np.round(np.clip(m, 0, 1) * 255).astype(np.uint8)])
        Image.fromarray(rgba, "RGBA").save(OUT / f"{key}-{pid}.webp", lossless=True, method=6)
    print(key, "->", ", ".join(["base"] + list(masks)))
    if preview:
        Path(preview).mkdir(parents=True, exist_ok=True)
        z = 2
        outs = []
        for ang in (0, 8, -8):
            comp = base.astype(np.float32).copy()
            for pid, m in masks.items():
                pivot = next(p for p in spec["parts"] if p["id"] == pid).get("fade", ((rgb.shape[1] / 2, 0), 0, 0))[0]
                if pid == "lines":
                    a = 1.0 if ang else 0.0
                    mm = m * a
                    src = rgb.astype(np.float32)
                else:
                    M = cv2.getRotationMatrix2D(tuple(map(float, pivot)) if "fade" in next(p for p in spec["parts"] if p["id"] == pid) else (rgb.shape[1] / 2, 28), ang, 1)
                    src = cv2.warpAffine(rgb, M, (rgb.shape[1], rgb.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
                    mm = cv2.warpAffine(m, M, (rgb.shape[1], rgb.shape[0]), flags=cv2.INTER_LINEAR)
                comp = comp * (1 - mm[..., None]) + src * mm[..., None]
            outs.append(cv2.resize(comp.clip(0, 255).astype(np.uint8), None, fx=z, fy=z, interpolation=cv2.INTER_CUBIC))
        Image.fromarray(np.concatenate(outs, axis=1)).save(Path(preview) / f"{key}-preview.png")


if __name__ == "__main__":
    pv = sys.argv[sys.argv.index("--preview") + 1] if "--preview" in sys.argv else None
    for k, s in SPEC.items():
        run(k, s, pv)
