"""前景格拆层（scroll-motion-demo，2026-11-15）：稳定底图 + 透明运动层 + 遮挡层，同一画布、同一尺寸、同一位置。

源：source/comic-v4-frames/<组>/frame-0{1,2,3}.png（桌面 new pics 原件的副本，原件不动）。
产物：public/assets/comic-v4/layers/<key>-<层>.webp + layers.json（画布尺寸、每层的旋转支点、动作关键姿态）。

每组做法：
1. 三帧对齐（SIFT + RANSAC 相似变换，结果≈恒等；同 prepare_frames.py）。
2. 运动部件的轮廓：在第 1 帧（静止姿态）和最远姿态帧上用 GrabCut 抠（给一个宽松多边形 + 一个肯定在部件内的核心多边形），
   再把贴着的深色描边并进来，填洞。
3. 运动层 = 第 1 帧里的部件像素。被对白泡等稳定前景挡住、动起来会露出的部分，用最远姿态帧的同一部件按相似变换搬回第 1 帧姿态补上。
   运动层可以伸进框线底下（框线在遮挡层里），小幅移动时框边不露缝。
4. 底图 = 第 1 帧去掉运动部件：先用其他帧里在同一位置露出的真实背景（部件已经移开的地方，做颜色校正），
   剩下的用归一化卷积从周围背景补，不留残手、残工具或空洞。
5. 遮挡层 = 底图里应该画在运动部件之上的稳定部分（对白泡、框线、扶菜的手、食材、锅前沿、碗前沿……），像素与底图完全一致。
6. 动作关键姿态：第 1 帧 → 最远姿态帧的相似变换（平移、旋转、缩放），以及自然支点（画布像素和百分比）。
检查图：tools/split_layers.py --check 生成"原位叠合"（三层叠回去 vs 第 1 帧，含差异图）和"小幅移动后"（运动层按关键姿态移动 35% / 100%）。
用法（仓库根目录）：PYTHONPATH=tools python3 tools/split_layers.py [组 …] [--check 输出目录]
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

from panel_alpha import process  # noqa: E402

SRC = "source/comic-v4-frames"
OUT = "public/assets/comic-v4/layers"


def P(s):
    return [tuple(map(int, p.split(","))) for p in s.split()]


def Pd(s, k):
    """按显示坐标写的多边形 × k 换算回原图像素"""
    return [(round(x * k), round(y * k)) for x, y in P(s)]


KB = 2172 / 2000  # B 组网格图是按 2000 宽显示的

# 多边形都是对应帧的原图像素坐标。outer = 宽松外框（外面一定不是部件），core = 一定是部件的核心。
GROUPS = {
    "A-chopping": {
        "key": "p2b", "width": 1100, "far": 3,
        "part": {
            1: {"outer": P("14,170 100,170 140,300 470,300 480,400 560,440 870,630 870,700 790,690 420,610 330,610 150,590 60,555 14,540"),
                "core": P("60,330 330,330 360,520 600,520 820,650 600,560 420,560 180,540 60,450")},
            3: {"outer": P("14,220 100,220 180,320 280,400 450,420 470,560 860,690 860,720 830,860 600,800 420,780 200,760 60,720 14,720"),
                "core": P("20,290 90,320 130,420 330,450 370,720 600,690 780,760 420,750 180,720 60,660 20,660")},
        },
        "pivot": [105, 430],
        # 墙面（案板后沿以上）；其余是案板。案板后沿那条线在刀下面的一段补画回来
        "zones": [P("0,0 1542,0 1542,608 1350,622 760,664 560,680 250,701 100,719 0,729")],
        "lines": [{"pts": P("0,733 100,723 250,705 560,684 760,668 1350,626 1542,612"), "width": 7, "color": [96, 62, 14], "alpha": 0.8}],  # 袖口与手腕交界：切菜以平移为主，旋转点缀绕这里
        # 稳定前景：对白泡、扶菜的手和右臂、胡萝卜和丁、框线
        "front": [
            {"rule": "bubble", "seed": [300, 200]},
            {"rule": "grabcut", "outer": P("820,0 1480,0 1480,560 1330,700 1300,790 1220,800 1100,780 900,790 820,740 830,560 990,420 1050,300 1000,150"),
             "core": P("1080,40 1400,40 1400,500 1250,640 1000,700 900,690 900,560 1100,440 1080,250")},
            {"rule": "orange", "box": [300, 690, 1300, 960]},
            {"rule": "border"},
        ],
    },
    "B-pouring": {
        "key": "p2d", "width": 1600, "far": 3, "food": True, "known_min": 58, "add_hidden": False, "copy_zones": [2], "est_tol": 150,
        # 第 3 帧的案板摆得不一样（左角更靠右上）：只在两帧都是案板面的地方借第 3 帧的木纹
        "copy_poly": P("1215,40 2150,40 1735,500 925,300"),
        # 掉落的菜在锅底有一圈淡影：底图里一起补掉（影子不跟着菜走）
        "extra_halo": {"drop": 14},
        # 案板前侧面（厚度那一条）在木铲下面的一段：用露出的一段的截面顺着边线补
        "sweeps": [{"curve": [(799, 349), (1180, 403), (1640, 468)], "up": 12, "down": 50, "ref": [1300, 1330], "x": [799, 1180]}], "tex": {"1": (6, 70), "0": (4, 20)},
        # 案板左上沿在木铲下面的一段（第 3 帧露出来过，按它的位置补线）
        "lines": [{"pts": P("799,388 1205,24"), "width": 6, "color": [70, 35, 12], "alpha": 0.9}],
        "part": {
            1: {"outer": Pd("205,12 615,12 725,85 915,125 1025,185 1085,255 1085,400 1010,425 900,375 760,325 650,205 560,155 500,170 400,155 300,105 205,45", KB),
                "core": Pd("300,25 560,25 700,100 880,165 1000,230 1010,330 950,375 900,350 780,280 680,175 560,120 470,125 330,70", KB),
                "force": P("868,356 940,380 1002,402 1014,422 996,428 930,404 866,380")},  # 铲头底面的浅色厚度边
            2: {"outer": Pd("240,12 650,12 750,150 900,200 1060,240 1200,300 1220,470 1100,470 950,400 800,300 650,250 560,250 450,200 330,120 240,40", KB),
                "core": Pd("330,25 620,25 700,160 900,215 1050,260 1100,330 1060,360 900,330 750,250 600,230 470,180 380,100", KB)},
            3: {"outer": Pd("185,12 610,12 690,200 830,255 960,265 1110,320 1160,400 1150,460 1030,460 890,425 780,380 650,320 560,305 470,280 370,225 280,135 185,45", KB),
                "core": Pd("300,25 560,25 620,170 640,250 900,295 1060,350 1060,400 990,415 850,390 700,325 560,285 470,245 380,190 310,100", KB)},
        },
        "motion": {"part": [0, 0, -5.0], "pile": [-7, 3, 0], "drop": [0, 170, 0]},
        # 铲头尖被菜堆盖着：菜推下锅后会露出来，按露出的上沿和右下沿把铲头补完整
        "part_fill": [{"poly": P("1000,215 1060,235 1100,252 1115,262 1124,290 1126,330 1122,365 1112,425 1040,447 1000,432 990,330"),
                       "outline": P("1110,257 1120,276 1125,305 1125,336 1120,368"), "width": 8, "color": [52, 28, 10]}],
        "pivot": [456, 16],  # 手腕在框上沿：推菜的木铲绕这里摆，手的上沿始终贴着框
        # 案板上的菜（在木铲前面，被推着往下沿挪）和三颗正在掉的菜（各自一层）
        "extras": [
            {"name": "pile", "rule": "food", "halo": 14, "poly": Pd("925,95 1110,18 1992,18 1600,480 1080,405 975,405 895,300", KB)},
            {"name": "drop", "rule": "food_each", "poly": Pd("860,402 1160,402 1160,510 860,510", KB)},
        ],
        "front": [
            {"rule": "bubble", "seed": [150, 300]},
            {"rule": "red", "seed": [0, 540], "grow": 8},
            {"rule": "border"},
        ],
        # 锅（后沿、锅里、锅身），案板压在锅上方；其余是墙
        "zones": [Pd("330,520 380,440 500,390 700,345 900,330 1100,335 1300,360 1500,400 1640,460 1665,660 330,660", KB),
                  P("1205,20 2160,20 1750,526 798,390")],  # 第 1 帧的案板（含前侧面；左角在木铲下面）
    },
    "C-sauce": {
        "key": "p3a", "width": 1000, "far": 3, "add_hidden": False, "known_min": 110,
        "part": {
            1: {"outer": P("55,250 150,150 250,95 340,40 625,38 625,320 560,335 450,335 425,370 448,470 445,560 425,610 480,700 605,840 605,885 555,885 470,820 395,700 330,645 265,625 195,565 172,475 120,455 68,405 52,330"),
                "core": P("150,285 250,185 350,95 560,72 580,280 450,300 385,335 420,450 405,560 360,600 300,600 240,560 200,480 135,400"),
                "core2": P("350,612 372,602 572,838 558,852")},
            3: {"outer": P("188,300 228,200 300,118 380,40 665,38 665,330 600,340 560,360 602,480 622,560 602,640 562,680 645,820 722,882 690,905 600,892 520,722 470,692 420,642 358,560 338,510 298,482 238,472 198,420"),
                "core": P("262,300 332,182 402,82 600,62 600,300 522,332 562,450 582,560 542,640 472,640 402,580 382,520 342,462 282,422"),
                "core2": P("525,690 545,680 655,868 640,878")},
        },
        "pivot": [480, 40],  # 肩膀在框上沿：整条手臂（袖子 + 手 + 勺）绕这里摆，平移为主
        "motion": {"part": [60, 15, 5.0]},
        "front": [
            # 碗前壁和近处碗沿（酱面以下），勺子在它后面
            {"rule": "poly_not_sauce", "poly": P("380,770 392,860 430,902 520,914 650,918 800,908 900,884 948,842 950,900 905,1012 800,1085 560,1095 470,1035 400,935 372,850")},
            # 围裙和身体：手臂往右摆时袖子收进围裙后面
            {"rule": "grabcut", "outer": P("590,38 1222,38 1222,430 1100,450 1050,600 920,645 650,655 630,560 610,420 585,330 580,200"),
             "core": P("680,45 1215,45 1215,400 1060,440 1000,600 900,620 680,620 670,450 640,330 630,200")},
            {"rule": "border"},
        ],
        # 墙、碗、酱面（后面的覆盖前面的）
        "zones": [P("380,640 950,640 960,900 900,1020 800,1090 560,1100 460,1040 395,940 370,820"),
                  P("405,800 450,745 560,722 700,718 840,728 920,760 930,820 880,880 760,905 600,908 470,895 415,860")],
    },
}


# ---------- 基础工具 ----------
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
        M, _ = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=2, maxIters=8000, confidence=0.999)
        out.append(cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE))
    return out


def poly_mask(shape, pts):
    m = Image.new("L", (shape[1], shape[0]), 0)
    ImageDraw.Draw(m).polygon(pts, fill=1)
    return np.asarray(m).astype(bool)


def grabcut(img, outer, core, forbid=None, core2=None):
    H, W = img.shape[:2]
    mask = np.where(poly_mask((H, W), outer), cv2.GC_PR_FGD, cv2.GC_BGD).astype(np.uint8)
    cm = poly_mask((H, W), core)
    if core2:
        cm |= poly_mask((H, W), core2)
    mask[cm] = cv2.GC_FGD
    if forbid is not None:
        mask[forbid] = cv2.GC_BGD
    bgd, fgd = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(cv2.cvtColor(img, cv2.COLOR_RGB2BGR), mask, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
    fg = (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)
    lab, n = ndimage.label(fg)
    if n > 1:  # 只留最大的块和碰到核心的块
        keep = set(np.unique(lab[cm & fg])) - {0}
        fg = np.isin(lab, list(keep))
    return fg


def with_outline(mask, img, r=12, dark=120):
    """把贴着的深色描边并进来（描边是深褐色：三个通道都暗；橄榄绿墙面 R 高，不算），填洞，去掉毛刺"""
    m = mask | (ndimage.binary_dilation(mask, iterations=r) & (img.max(2) < dark))
    m = ndimage.binary_closing(m, iterations=2)
    return ndimage.binary_fill_holes(m)


def feather(mask, r):
    return np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(float) / 255


def nconv_fill(img, known, todo):
    """归一化卷积：从 known 像素向 todo 区域逐级（σ 由小到大）扩散颜色"""
    out = img.astype(float).copy()
    left = todo.copy()
    k = known.astype(float)
    for sigma in (3, 6, 12, 24, 48, 96, 192, 384, 768):
        if not left.any():
            break
        w = ndimage.gaussian_filter(k, sigma)
        ok = left & (w > 0.08)
        for c in range(3):
            num = ndimage.gaussian_filter(img[..., c].astype(float) * k, sigma)
            out[..., c][ok] = (num / np.maximum(w, 1e-6))[ok]
        left &= ~ok
    if left.any() and known.any():  # 还够不着的：取最近的已知像素
        idx = ndimage.distance_transform_edt(~known, return_distances=False, return_indices=True)
        out[left] = img[idx[0][left], idx[1][left]]
    return out


def sim_transform(f_a, m_a, f_b, m_b, angles=np.arange(-12, 12.1, 1.0)):
    """部件在帧 a → 帧 b 的位姿（2×3，旋转 + 平移，绕部件包围盒中心）：带遮罩的模板匹配，逐个角度试。
    手绘的几帧细节不完全一样，特征点配对太少不稳，模板匹配更稳。"""
    ga = cv2.GaussianBlur(f_a, (0, 0), 1.5).astype(np.float32)
    gb = cv2.GaussianBlur(f_b, (0, 0), 1.5).astype(np.float32)
    ys, xs = np.where(m_a)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    pad = 40
    X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(f_a.shape[1], x1 + pad), min(f_a.shape[0], y1 + pad)
    tpl0 = ga[Y0:Y1, X0:X1]
    msk0 = m_a[Y0:Y1, X0:X1].astype(np.float32)
    c = ((X1 - X0) / 2, (Y1 - Y0) / 2)
    best = None
    for ang in angles:
        R = cv2.getRotationMatrix2D(c, -ang, 1.0)  # 图像坐标里正角 = 顺时针
        tpl = cv2.warpAffine(tpl0, R, (X1 - X0, Y1 - Y0), flags=cv2.INTER_LINEAR)
        msk = (cv2.warpAffine(msk0, R, (X1 - X0, Y1 - Y0), flags=cv2.INTER_NEAREST) > 0.5).astype(np.float32)
        msk3 = np.dstack([msk] * 3)
        r = cv2.matchTemplate(gb, tpl, cv2.TM_SQDIFF, mask=msk3)
        mn, _, loc, _ = cv2.minMaxLoc(r)
        score = mn / max(1.0, msk.sum())
        if best is None or score < best[0]:
            best = (score, ang, loc, R)
    score, ang, loc, R = best
    # 帧 a 坐标 → 帧 b 坐标：先移到模板原点，旋转，再放到匹配位置
    T1 = np.array([[1, 0, -X0], [0, 1, -Y0], [0, 0, 1]], float)
    R3 = np.vstack([R, [0, 0, 1]])
    T2 = np.array([[1, 0, loc[0]], [0, 1, loc[1]], [0, 0, 1]], float)
    M = (T2 @ R3 @ T1)[:2]
    return M, round(float(score), 1), int(m_a.sum())


BUBBLE_CORE = []
SRCMAP = []
SOLID_CORE = []  # 扶手、食材等稳定前景的本体（不含描边）：和运动部件挨着时，描边归前景


def food_colour(img):
    R, G, B = (img[..., i].astype(int) for i in range(3))
    # 案板木色约 (250,185,105)：G 160–190、R−B 140–160，不能落进下面任何一类
    # 浅绿墙砖约 (204,228,191)：G−B 只有 ~37，绿色菜要 G−B > 50
    orange = (R > 170) & (G < 165) & (R - B > 0.8 * R) & (R - G > 88)  # 饱和度 > 0.8；木纹深色线约 0.76
    yellow = (R > 190) & (G > 150) & (R - B > 185)
    green = (G > R + 12) & (G > 80) & (G - B > 50)
    pale = (G > R + 6) & (G > 205) & (G - B > 40)  # 浅色葱圈
    lime = (R > 175) & (G > 175) & (B < 120) & (np.abs(R - G) < 30)  # 黄绿葱圈（木色 R−G ≈ 65，不算）
    return orange | yellow | green | pale | lime


def food_weak(img):
    """宽松的菜色（胡萝卜受光面等）：只在和确定的菜连着时才算"""
    R, G, B = (img[..., i].astype(int) for i in range(3))
    return (R > 238) & (G < 165) & (R - B > 0.72 * R) & (R - G > 92)


def food_mask(img, region, min_px=250):
    strong = food_colour(img) & region
    weak = food_weak(img) & region
    lab, n = ndimage.label(weak | strong)
    keep = set(np.unique(lab[ndimage.binary_dilation(strong, iterations=1)])) - {0}
    f = strong | (np.isin(lab, list(keep)) & weak)
    f = ndimage.binary_opening(f, iterations=2)  # 去掉木铲高光那种细条
    f = ndimage.binary_closing(f, iterations=3)
    holes = ndimage.binary_fill_holes(f) & ~f  # 只补小洞（葱圈中间、高光），菜块之间露出的木铲不算
    lab, n = ndimage.label(holes)
    if n:
        sz = ndimage.sum(holes, lab, range(1, n + 1))
        f |= np.isin(lab, [i + 1 for i in range(n) if sz[i] < 900])
    lab, n = ndimage.label(f)
    if n:
        sz = ndimage.sum(f, lab, range(1, n + 1))
        f = np.isin(lab, [i + 1 for i in range(n) if sz[i] > min_px])
    return f


def front_mask(spec, f0, inside, ring, part_any):
    H, W = f0.shape[:2]
    lum = f0.mean(2)
    if spec["rule"] == "bubble":
        x, y = spec["seed"]
        white = (f0.min(2) > 205) & ((f0.max(2).astype(int) - f0.min(2)) < 28)  # 纸白：亮且不带颜色（浅绿墙砖不算）
        lab, _ = ndimage.label(white)
        m = ndimage.binary_fill_holes(lab == lab[y, x])
        print(f"   bubble px {int(m.sum())}")
        BUBBLE_CORE.append(m)
        return ndimage.binary_dilation(m, iterations=14)
    if spec["rule"] == "border":
        return ring
    if spec["rule"] == "grabcut":
        core = grabcut(f0, spec["outer"], spec["core"], forbid=part_any, core2=spec.get("core2"))
        SOLID_CORE.append(core)
        return with_outline(core, f0)
    if spec["rule"] == "poly_not_sauce":  # 碗前沿：多边形里去掉酱色
        R, G, B = (f0[..., i].astype(int) for i in range(3))
        sauce = (R < 205) & (R - G > 45) & (B < 80) & (G < 120)
        m = poly_mask((H, W), spec["poly"]) & ~ndimage.binary_opening(sauce, iterations=2)
        m = ndimage.binary_opening(m, iterations=2)
        SOLID_CORE.append(m)
        return m
    if spec["rule"] == "red":  # 锅身：深红（G 低），碰到画面下沿附近，质心在种子 y 以下
        x, y = spec["seed"]
        R, G, B = (f0[..., i].astype(int) for i in range(3))
        red = (R > 150) & (G < 85) & (B < 90) & (R - G > 100)
        lab, n = ndimage.label(red)
        cy = ndimage.center_of_mass(red, lab, range(1, n + 1))
        sz = ndimage.sum(red, lab, range(1, n + 1))
        ymax = ndimage.maximum(np.indices(red.shape)[0], lab, range(1, n + 1))
        keep = [i + 1 for i in range(n) if cy[i][0] > y and sz[i] > 1500 and ymax[i] > H - 60]
        m = np.isin(lab, keep)
        SOLID_CORE.append(m)
        return ndimage.binary_dilation(ndimage.binary_closing(m, iterations=3), iterations=spec.get("grow", 6))
    if spec["rule"] == "orange":
        x0, y0, x1, y1 = spec["box"]
        R, G, B = (f0[..., i].astype(int) for i in range(3))
        o = (R > 190) & (G > 70) & (G < 175) & (B < 90) & (R - B > 130)
        box = np.zeros((H, W), bool); box[y0:y1, x0:x1] = True
        o &= box
        o = ndimage.binary_opening(o, iterations=2)
        lab, n = ndimage.label(o)
        sz = ndimage.sum(o, lab, range(1, n + 1))
        o = ndimage.binary_closing(np.isin(lab, [i + 1 for i in range(n) if sz[i] > 600]), iterations=4)
        SOLID_CORE.append(o)
        return with_outline(o, f0, r=9)
    raise ValueError(spec["rule"])


# ---------- 每组 ----------
def build(group):
    cfg = GROUPS[group]
    key, far = cfg["key"], cfg["far"]
    print(group)
    frames = align([load(group, i) for i in (1, 2, 3)])
    f0 = frames[0]
    H, W = f0.shape[:2]
    base_rgba = np.asarray(process(Image.fromarray(f0), (0, 0, W, H)))
    inside = base_rgba[..., 3] > 0
    # 框线环：框内、离框外缘不到 bw 像素
    dist = ndimage.distance_transform_edt(inside)
    lum = f0.mean(2)
    bw = int(np.median([np.argmax(lum[H // 2, int(np.argmax(inside[H // 2])):] > 90), np.argmax(lum[int(np.argmax(inside[:, W // 2])):, W // 2] > 90)])) + 3
    ring = inside & (dist <= bw)
    interior = inside & ~ring

    # 运动部件：静止帧和最远帧
    parts = {}
    for i, pc in cfg["part"].items():
        g = grabcut(frames[i - 1], pc["outer"], pc["core"], core2=pc.get("core2"))
        fr = frames[i - 1].astype(int)
        wallish = (fr[..., 1] > fr[..., 0] + 10) & (fr[..., 1] > 195) & (fr[..., 2] > 150)  # 浅绿墙砖：不会是手或工具
        g &= ~ndimage.binary_opening(wallish, iterations=2)
        if pc.get("force"):  # 抠图漏掉、但确定属于部件的一小块（例如铲头底面那条浅色厚度边）
            g |= poly_mask((H, W), pc["force"])
        parts[i] = with_outline(g, frames[i - 1])
    # 稳定前景
    front = np.zeros((H, W), bool)
    fronts = {}
    for spec in cfg["front"]:
        fm = front_mask(spec, f0, inside, ring, parts[1] if spec["rule"] == "grabcut" else None)
        fronts[spec["rule"] + str(len(fronts))] = fm
        front |= fm
    front &= inside
    # 另外的运动层（案板上的菜、掉落的菜）：第 1 帧里的本体 + 描边，从底图里去掉
    extras = []  # (name, mask)
    for ex in cfg.get("extras", []):
        region = poly_mask((H, W), ex["poly"]) & interior & (dist > bw + 16)  # 离框线远一点，框线的描边不能跟着菜走
        fm = food_mask(f0, region)
        if ex["rule"] == "food":
            SOLID_CORE.append(fm)
            halo = ndimage.binary_dilation(fm, iterations=ex.get("halo", 0)) & ~ndimage.binary_dilation(parts[1] & ~fm, iterations=3)
            extras.append((ex["name"], (with_outline(fm, f0, r=8) | halo) & region))
        else:  # food_each：每个连通块一层
            lab, n = ndimage.label(fm)
            cents = ndimage.center_of_mass(fm, lab, range(1, n + 1))
            order = np.argsort([c[1] for c in cents])
            for j, i in enumerate(order, 1):
                one = lab == i + 1
                SOLID_CORE.append(one)
                extras.append((f"{ex['name']}{j}", with_outline(one, f0, r=8)))
    extra_any = np.zeros((H, W), bool)
    for _, m in extras:
        extra_any |= m
    solid = np.zeros((H, W), bool)
    for c in SOLID_CORE:
        solid |= c
    SOLID_CORE.clear()
    parts[1] &= ~ndimage.binary_dilation(solid, iterations=2)
    # 对白泡外扩带里其实是手/袖子的浅色像素：归运动层，不归遮挡层（否则遮挡层会带着残袖）
    full1 = parts[1]
    bcore = np.zeros((H, W), bool)
    for c in BUBBLE_CORE:
        bcore |= c
    BUBBLE_CORE.clear()
    band_arm = ndimage.binary_dilation(full1, iterations=4) & front & ~ndimage.binary_dilation(bcore, iterations=1) & (lum > 120) & interior
    band_arm &= ndimage.binary_dilation(full1, iterations=1) | ~ndimage.binary_dilation(bcore, iterations=6)
    front &= ~band_arm
    # 运动部件在第 1 帧的可见部分：不含稳定前景（对白泡描边等不能跟着手走）
    m1 = (full1 | (band_arm & ndimage.binary_dilation(full1, iterations=4))) & ~front
    parts[1] = m1
    if os.environ.get("SPLIT_DEBUG"):
        for i, m in parts.items():
            vis = frames[i - 1].astype(float); vis[~m] = vis[~m] * 0.3 + np.array([255, 0, 255]) * 0.3
            Image.fromarray(vis.astype(np.uint8)).save(f"{os.environ['SPLIT_DEBUG']}/{key}-part{i}.jpg", quality=80)
        vis = f0.astype(float); vis[~front] = vis[~front] * 0.3 + np.array([0, 200, 255]) * 0.3
        Image.fromarray(vis.astype(np.uint8)).save(f"{os.environ['SPLIT_DEBUG']}/{key}-front.jpg", quality=80)
    # 部件在最远帧的姿态：相似变换
    M, ninl, ngood = sim_transform(f0, m1, frames[far - 1], parts[far])
    A = M[:, :2]
    s = float(np.hypot(A[0, 0], A[1, 0])); th = float(np.degrees(np.arctan2(A[1, 0], A[0, 0])))
    print(f"  pose 1→{far}: match err {ninl} over {ngood} px, scale {s:.3f} rot {th:.2f}° t ({M[0, 2]:.1f}, {M[1, 2]:.1f})")

    # 运动层：第 1 帧可见部分 + 被稳定前景挡住的部分（从最远帧搬回）
    Minv = cv2.invertAffineTransform(M)
    farw = cv2.warpAffine(frames[far - 1], Minv, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    farm = cv2.warpAffine(parts[far].astype(np.uint8), Minv, (W, H), flags=cv2.INTER_NEAREST).astype(bool)
    hidden = (front | extra_any) & ~m1  # 第 1 帧里被前景或别的运动层挡住的地方
    add = farm & hidden if cfg.get("add_hidden", True) else np.zeros((H, W), bool)
    # 只要和第 1 帧可见部分连在一起的补块
    lab, n = ndimage.label(add | m1)
    keep = set(np.unique(lab[m1])) - {0}
    add &= np.isin(lab, list(keep))
    part_mask = m1 | add
    part_rgb = np.where(m1[..., None], f0, farw)
    # 部件被前景挡住、动起来会露出的一块（例如铲头尖被菜堆盖着）：按轮廓补一块，木色从部件本身扩散 + 借部件自己的纹理，补画轮廓线
    for pf in cfg.get("part_fill", []):
        reg = poly_mask((H, W), pf["poly"]) & ~part_mask
        src_ok = part_mask & (part_rgb.mean(2) > 120) & ~ndimage.binary_dilation(~part_mask, iterations=4)
        filled_ = nconv_fill(part_rgb.astype(float), src_ok, reg)
        hpp = np.clip(part_rgb.astype(float) - np.dstack([ndimage.gaussian_filter(part_rgb[..., c].astype(float), 3) for c in range(3)]), -25, 25)
        dx, dy = pf.get("tex_shift", (-140, -20))
        tex_ = np.roll(hpp, (-dy, -dx), (0, 1))
        okt = np.roll(src_ok, (-dy, -dx), (0, 1))
        filled_ = filled_ + np.where(okt[..., None], tex_, 0)
        part_rgb = np.where(reg[..., None], np.clip(filled_, 0, 255), part_rgb).astype(part_rgb.dtype)
        part_mask = part_mask | reg
        if pf.get("outline"):
            lm = Image.new("L", (W * 2, H * 2), 0)
            ImageDraw.Draw(lm).line([(x * 2, y * 2) for x, y in pf["outline"]], fill=255, width=pf["width"] * 2, joint="curve")
            la = np.asarray(lm.resize((W, H), Image.LANCZOS)).astype(float) / 255
            part_rgb = (part_rgb * (1 - la[..., None]) + np.array(pf["color"], float) * la[..., None]).astype(part_rgb.dtype)
            part_mask = part_mask | (la > 0.3)
        holes = ndimage.binary_fill_holes(part_mask) & ~part_mask
        if holes.any():
            hf = nconv_fill(part_rgb.astype(float), part_mask & ~ndimage.binary_dilation(holes, iterations=1), holes)
            part_rgb = np.where(holes[..., None], np.clip(hf, 0, 255), part_rgb).astype(part_rgb.dtype)
            part_mask = part_mask | holes
        print(f"  part fill: {int(reg.sum())} px, holes {int(holes.sum())}")
    # 伸进框线下：靠框边的部件像素沿最近方向延伸到画布边缘（框线在遮挡层里，平时看不到）
    edge_touch = part_mask & (dist <= bw + 6) & inside
    if edge_touch.any():
        ext = ndimage.binary_dilation(edge_touch, iterations=bw + 40) & ~interior
        src = part_mask & interior
        idx = ndimage.distance_transform_edt(~src, return_distances=False, return_indices=True)
        part_rgb = np.where((ext & ~part_mask)[..., None], part_rgb[idx[0], idx[1]], part_rgb)
        part_mask = part_mask | ext
    # 框线所在的像素不能来自部件本身的描边：框线环内一律用延伸色
    if edge_touch.any():
        part_rgb = np.where((ring & part_mask)[..., None], part_rgb[idx[0], idx[1]], part_rgb)

    # 底图：去掉部件，先用其他帧露出的真实背景，再归一化卷积 + 借邻近墙面的纹理
    todo = ndimage.binary_dilation(m1 | extra_any, iterations=4) & interior
    for name, m in extras:
        r = cfg.get("extra_halo", {}).get(name.rstrip("0123456789"), 0)
        if r:
            todo |= ndimage.binary_dilation(m, iterations=r) & interior & ~front & ~m1
    todo &= ~(front & (f0.max(2) < 120))  # 稳定前景的描边（扶菜手指的轮廓）保持原样
    known = interior & ~todo & ~ndimage.binary_dilation(front, iterations=6) & (f0.max(2) > cfg.get("known_min", 120))
    if cfg.get("food"):  # 锅里的菜不能当背景来源（不然纹理会带出菜块的轮廓）
        known &= ~ndimage.binary_dilation(food_colour(f0), iterations=3)
    known = ndimage.binary_erosion(known, iterations=2)
    f0f = f0.astype(float)
    # 分区：墙面、案板等不同表面各自从本区的已知像素补（不让案板的浅色漫进墙面）
    zone = np.zeros((H, W), np.int16)
    for zi, zp in enumerate(cfg.get("zones", []), 1):
        zone[poly_mask((H, W), zp)] = zi
    est = f0f.copy()
    for z in np.unique(zone[todo]):
        if os.environ.get("SPLIT_PROBE"):
            print("   zone", z, "todo", int((todo & (zone == z)).sum()), "known", int((known & (zone == z)).sum()))
        e = nconv_fill(f0f, known & (zone == z), todo & (zone == z))
        est[todo & (zone == z)] = e[todo & (zone == z)]
    # 纹理：高频分量从附近已知背景平移借来（几个候选位移，先到先得；横向优先，明暗变化小）
    # 每个分区可以单独给纹理尺度和强度（锅底纹理粗而深，墙面淡）
    texcfg = cfg.get("tex", {})
    tex = np.zeros_like(f0f)
    ktex = known
    if cfg.get("food"):  # 纹理来源离菜远一点（菜之间的深色缝隙不能当锅底纹理）
        ktex = known & ~ndimage.binary_dilation(food_colour(f0), iterations=26)
    for z in np.unique(zone[todo]):
        sig, clip = texcfg.get(str(int(z)), (3, 14))
        hp = np.clip(f0f - np.dstack([ndimage.gaussian_filter(f0f[..., c], sig) for c in range(3)]), -clip, clip)
        need = todo & (zone == z)
        src_ok = ktex & (zone == z)
        for r in (60, 120, 200, 300, 420, 560, 760):
            for dx, dy in ((r, 0), (-r, 0), (r, -r // 4), (-r, -r // 4), (r, r // 4), (-r, r // 4), (0, -r), (0, r)):
                if not need.any():
                    break
                if abs(dy) >= H or abs(dx) >= W:
                    continue
                ok = np.zeros((H, W), bool)
                sy0, sy1 = max(0, -dy), min(H, H - dy); sx0, sx1 = max(0, -dx), min(W, W - dx)
                ok[sy0:sy1, sx0:sx1] = src_ok[sy0 + dy:sy1 + dy, sx0 + dx:sx1 + dx]
                ok &= need
                if ok.any():
                    tex[ok] = np.roll(hp, (-dy, -dx), (0, 1))[ok]
                    need &= ~ok
    est = est + tex
    base = f0f.copy()
    base[todo] = est[todo]
    wsum = np.zeros((H, W))
    cands = []  # (k, 颜色校正后的帧 k, 帧 k 在这里不是部件/前景/菜)
    for k in sorted(cfg["part"], key=lambda i: -abs(i - 1)):
        if k == 1:
            continue
        fk = frames[k - 1].astype(float)
        valid = ~ndimage.binary_dilation(parts[k], iterations=14) & ~front & interior
        if cfg.get("food"):  # 帧 k 在这里有菜（掉落中或案板上），不能当背景
            valid &= ~ndimage.binary_dilation(food_colour(fk), iterations=10)
        ringk = ndimage.binary_dilation(todo, iterations=25) & known & valid
        if ringk.sum() < 200:
            continue
        off = np.median((f0f - fk)[ringk], axis=0)
        cands.append((k, np.clip(fk + off, 0, 255), valid, off))

    def put(use, rgb, label):
        nonlocal base, wsum
        use = ndimage.binary_opening(use, iterations=3) & todo & (wsum < 0.5)
        lab, n = ndimage.label(use)
        if n:
            sz = ndimage.sum(np.ones((H, W)), lab, range(1, n + 1))
            use &= np.isin(lab, [i + 1 for i in range(n) if sz[i] > 400])
        w = feather(use, 3.0) * use
        base = np.where(use[..., None], rgb * w[..., None] + base * (1 - w[..., None]), base)
        wsum = np.maximum(wsum, w)
        SRCMAP.append((label, use))
        print(f"  base fill {label}: {int(use.sum())} px")

    # 1) 两帧都不是部件、而且两帧在这里一致 → 就是背景（锅沿、墙砖缝这类有线条的地方也靠这个补）
    if len(cands) >= 2:
        (ka, fa_, va, _), (kb, fb_, vb, _) = cands[:2]
        agree = va & vb & (np.abs(fa_ - fb_).sum(2) < 45)
        if "copy_zones" in cfg:
            agree &= np.isin(zone, cfg["copy_zones"])
        if "copy_poly" in cfg:
            agree &= ndimage.binary_erosion(poly_mask((H, W), cfg["copy_poly"]), iterations=30)
        put(agree, (fa_ + fb_) / 2, f"from frames {ka}+{kb} (agree)")
    # 2) 只有一帧露出背景：必须像背景（和扩散估计接近），不像就是没抠干净的部件或菜的描边
    for k, fkc, valid, off in cands:
        v = valid & ~ndimage.binary_dilation(fkc.max(2) < 60, iterations=6)
        if "copy_zones" in cfg:
            v &= np.isin(zone, cfg["copy_zones"])
        if "copy_poly" in cfg:
            v &= ndimage.binary_erosion(poly_mask((H, W), cfg["copy_poly"]), iterations=30)
        v &= np.abs(fkc - est).sum(2) < cfg.get("est_tol", 80)
        put(v, fkc, f"from frame {k} (offset {off.round(1)})")
    if os.environ.get("SPLIT_PROBE"):
        px_, py_ = map(int, os.environ["SPLIT_PROBE"].split(","))
        print("   probe", (px_, py_), "f0", f0[py_, px_], "todo", todo[py_, px_], "known", known[py_, px_], "zone", zone[py_, px_], "est", est[py_, px_].round(), "base", base[py_, px_].round(), "wsum", wsum[py_, px_])
    if os.environ.get("SPLIT_DEBUG"):
        cols = [(255, 0, 0), (0, 160, 255), (0, 200, 0), (255, 200, 0)]
        vis = np.where(todo[..., None], 255, f0f * 0.4 + 150)
        for (lbl, u), c in zip(SRCMAP, cols):
            vis[u] = c
        Image.fromarray(vis.astype(np.uint8)).save(f"{os.environ['SPLIT_DEBUG']}/{key}-srcmap.jpg", quality=80)
        print("   srcmap colours:", [l for l, _ in SRCMAP], "white = diffused")
    SRCMAP.clear()
    # 沿曲线平移的截面补画：锅沿这种"一条带子"被挡住的一段，用露出的一段的竖向截面顺着曲线补回去
    for sw in cfg.get("sweeps", []):
        xs_c, ys_c = zip(*sw["curve"])
        c = lambda x: np.interp(x, xs_c, ys_c)
        up, down = sw.get("up", sw.get("half")), sw.get("down", sw.get("half"))
        rx0, rx1 = sw["ref"]
        prof = np.mean([f0f[int(round(c(x))) - up:int(round(c(x))) + down + 1, x] for x in range(rx0, rx1)], axis=0)
        for x in range(sw["x"][0], sw["x"][1]):
            cy = int(round(c(x)))
            for dy in range(-up, down + 1):
                y = cy + dy
                if 0 <= y < H and todo[y, x] and not front[y, x]:
                    w = min(1.0, (min(dy + up, down - dy) + 1) / 6.0)
                    base[y, x] = prof[dy + up] * w + base[y, x] * (1 - w)
    for ln in cfg.get("lines", []):
        lm = Image.new("L", (W * 2, H * 2), 0)
        ImageDraw.Draw(lm).line([(x * 2, y * 2) for x, y in ln["pts"]], fill=255, width=ln["width"] * 2, joint="curve")
        la = np.asarray(lm.resize((W, H), Image.LANCZOS)).astype(float) / 255 * ln["alpha"]
        la = ndimage.gaussian_filter(la, 0.8) * (todo & ~front)
        base = base * (1 - la[..., None]) + np.array(ln["color"], float) * la[..., None]
    print(f"  base: removed {int(todo.sum())} px, from other frames {int((wsum > 0.5).sum())}, diffused+texture {int((todo & (wsum <= 0.5)).sum())}")

    # ---------- 输出 ----------
    ys, xs = np.where(inside)
    bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    scale = cfg["width"] / (bx1 - bx0)
    size = (cfg["width"], round((by1 - by0) * scale))
    os.makedirs(OUT, exist_ok=True)

    def save(rgb, alpha, name):
        im = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), np.clip(alpha, 0, 1) * 255]).astype(np.uint8), "RGBA")
        im = im.crop((bx0, by0, bx1, by1)).resize(size, Image.LANCZOS)
        im.save(f"{OUT}/{key}-{name}.webp", quality=90, alpha_quality=100, method=6)
        return im

    base_alpha = base_rgba[..., 3] / 255.0
    base_rgb = np.where(inside[..., None], base, base_rgba[..., :3])
    save(base_rgb, base_alpha, "base")
    save(part_rgb, feather(part_mask, 1.0), "part")
    save(base_rgb, feather(front, 1.0) * base_alpha, "front")
    extra_meta = {}
    for name, m in extras:
        save(f0, feather(m, 1.0), name)
        ys_, xs_ = np.where(m)
        extra_meta[name] = {"centerPct": [round((xs_.mean() - bx0) / (bx1 - bx0) * 100, 2), round((ys_.mean() - by0) / (by1 - by0) * 100, 2)],
                            "boxPct": [round((xs_.min() - bx0) / (bx1 - bx0) * 100, 2), round((ys_.min() - by0) / (by1 - by0) * 100, 2),
                                       round((xs_.max() - bx0) / (bx1 - bx0) * 100, 2), round((ys_.max() - by0) / (by1 - by0) * 100, 2)]}

    def tocanvas(x, y):
        return [round((x - bx0) * scale, 1), round((y - by0) * scale, 1)]

    px, py = cfg["pivot"]
    meta = {
        "group": group, "key": key, "canvas": list(size), "aspect": round(size[0] / size[1], 4),
        "layers": ["base", "part"] + [n for n, _ in extras] + ["front"],
        "extras": extra_meta,
        "pivot": tocanvas(px, py), "pivotPct": [round((px - bx0) / (bx1 - bx0) * 100, 2), round((py - by0) / (by1 - by0) * 100, 2)],
        "farPose": {"frame": far, "dxPct": round(float(M[0, 2] + (A[0] @ [px, py]) - px) / (bx1 - bx0) * 100, 2),
                    "dyPct": round(float(M[1, 2] + (A[1] @ [px, py]) - py) / (by1 - by0) * 100, 2),
                    "rotDeg": round(th, 2), "scale": round(s, 3)},
    }
    print("  ", meta)
    return meta, dict(extras=extras, f0=f0, base=base_rgb, part_rgb=part_rgb, part=part_mask, front=front, inside=inside, M=M, box=(bx0, by0, bx1, by1), pivot=(px, py), far=frames[far - 1])


def check(group, d, outdir):
    """原位叠合 vs 第 1 帧（含差异），以及运动层移动 35% / 100% 后的样子"""
    f0, base, part_rgb, part, front, inside = d["f0"], d["base"], d["part_rgb"], d["part"], d["front"], d["inside"]
    H, W = f0.shape[:2]
    M = d["M"]; px, py = d["pivot"]
    pa, fa = feather(part, 1.0), feather(front, 1.0)

    cfg = GROUPS[group]
    motion = cfg.get("motion")  # 动画里实际用的最大位移：{层: [dx, dy, 旋转°]}（原图像素，旋转绕支点）；没写就用最远帧位姿
    extras = d["extras"]

    def xform(dx, dy, rot, k, pv):
        th = np.radians(rot) * k
        R = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]])
        t = pv + np.array([dx, dy]) * k - R @ pv
        return np.hstack([R, t[:, None]])

    def comp(k):
        pv = np.array([px, py], float)
        if motion:
            T = xform(*motion["part"], k, pv)
        else:
            A = M[:, :2]
            th = np.arctan2(A[1, 0], A[0, 0]) * k
            sc = 1 + (np.hypot(A[0, 0], A[1, 0]) - 1) * k
            dst = A @ pv + M[:, 2]
            R = sc * np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]])
            t = pv + (dst - pv) * k - R @ pv
            T = np.hstack([R, t[:, None]])
        out = base.copy()
        layers = [(part_rgb, pa, T)]
        for name, m in extras:
            mv = (motion or {}).get(name, (motion or {}).get(name.rstrip("0123456789"), [0, 0, 0]))
            ys_, xs_ = np.where(m)
            layers.append((f0.astype(float), feather(m, 1.0), xform(*mv, k, np.array([xs_.mean(), ys_.mean()]))))
        for rgb0, a0, T in layers:
            rgb = cv2.warpAffine(rgb0.astype(np.uint8), T, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE).astype(float)
            a = cv2.warpAffine(a0, T, (W, H), flags=cv2.INTER_LINEAR)[..., None]
            out = out * (1 - a) + rgb * a
        out = out * (1 - fa[..., None]) + base * fa[..., None]
        return np.where(inside[..., None], out, 255)

    x0, y0, x1, y1 = d["box"]
    def crop(a):
        return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).crop((x0, y0, x1, y1))

    inplace = comp(0)
    diff = np.abs(inplace - np.where(inside[..., None], f0, 255)).sum(2)
    print(f"  in-place vs frame 1: mean {diff[inside].mean():.2f}, p99 {np.percentile(diff[inside], 99):.0f} (of 765)")
    heat = np.dstack([np.clip(diff * 3, 0, 255)] * 3) * np.array([1, 0.2, 0.2]) + 255 * 0.6 * (1 - np.clip(diff * 3, 0, 255)[..., None] / 255)
    checker = (((np.indices((H, W)).sum(0) // 24) % 2) * 40 + 200)[..., None].repeat(3, 2).astype(float)
    tiles = [
        ("底图", np.where(inside[..., None], base, 255)),
        ("运动层" + ("（手+工具，另有 " + "、".join(n for n, _ in extras) + "）" if extras else ""), checker * (1 - pa[..., None]) + part_rgb * pa[..., None]),
        ("遮挡层", checker * (1 - fa[..., None]) + base * fa[..., None]),
        ("原位叠合", inplace),
        ("与第1帧差异×3", heat),
        ("移动35%", comp(0.35)),
        ("移动100%" + ("（动画最大位移）" if motion else "（最远姿态）"), comp(1.0)),
        ("最远帧原图（对照）", np.where(inside[..., None], d["far"], 255)),
    ]
    tw = 720
    th_ = round((y1 - y0) * tw / (x1 - x0))
    sheet = Image.new("RGB", (tw * 2 + 30, (th_ + 34) * 4 + 10), "white")
    dr = ImageDraw.Draw(sheet)
    try:
        from PIL import ImageFont
        font = ImageFont.truetype("/System/Library/Fonts/Hiragino Sans GB.ttc", 22)
    except Exception:
        font = None
    for i, (name, arr) in enumerate(tiles):
        cx, cy = 10 + (i % 2) * (tw + 10), 10 + (i // 2) * (th_ + 34)
        sheet.paste(crop(arr).resize((tw, th_), Image.LANCZOS), (cx, cy + 30))
        dr.text((cx, cy), name, fill=(20, 20, 20), font=font)
    os.makedirs(outdir, exist_ok=True)
    sheet.save(f"{outdir}/{GROUPS[group]['key']}-check.jpg", quality=88)
    crop(comp(0)).save(f"{outdir}/{GROUPS[group]['key']}-inplace.png")
    crop(comp(0.35)).save(f"{outdir}/{GROUPS[group]['key']}-moved35.png")
    crop(comp(1.0)).save(f"{outdir}/{GROUPS[group]['key']}-moved100.png")


if __name__ == "__main__":
    args = sys.argv[1:]
    outdir = None
    if "--check" in args:
        i = args.index("--check"); outdir = args[i + 1]; args = args[:i] + args[i + 2:]
    groups = args or list(GROUPS)
    path = f"{OUT}/layers.json"
    old = json.load(open(path)) if os.path.exists(path) else {}
    for g in groups:
        meta, d = build(g)
        old[meta["key"]] = meta
        if outdir:
            check(g, d, outdir)
    os.makedirs(OUT, exist_ok=True)
    json.dump(old, open(path, "w"), indent=1, ensure_ascii=False)
