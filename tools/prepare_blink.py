#!/usr/bin/env python3
"""
眨眼补丁：给妈妈的脸格各生成一张"闭眼"层（和原格同尺寸的透明 PNG/WebP，只有双眼附近有像素）。

做法（不重画整张脸，只处理眼睛）：
1. 在手工给定的包围盒里，从睁眼的巩膜点出发，取"巩膜 + 深色（睫毛、虹膜、瞳孔）"的连通区域 = 整只睁开的眼睛。
2. 把这块区域（外扩 2 像素，羽化边缘）填成周围皮肤色。
3. 沿眼睛的主轴画一条下弯的粗细渐变线 = 闭合的上睫毛线，颜色取原睫毛的深褐色。
网页里在妈妈"静止读格"时每隔几秒把这层盖上约 0.12 秒，再移开。结尾特写 p6f 也有补丁，但网页在三个点出现之前不放它：那一格"眼神僵住"，不眨眼就是笑点的一部分，三个点之后才眨第一下。

用法：python3 tools/prepare_blink.py [--preview DIR]    输出 public/assets/comic-v3/perf/<格>-blink.webp
预览（--preview）把睁眼 / 闭眼并排放大，便于人眼检查；补丁质量以肉眼为准，没有自动判定。
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/assets/comic-v3"
OUT = SRC / "perf"

# 每格每只眼：seed = 巩膜上一点（原图像素），box = 限制范围（x0, y0, x1, y1），防止连到头发 / 眉毛
EYES = {
    "p1c": [dict(seed=(195, 200), box=(178, 166, 250, 236)), dict(seed=(130, 222), box=(100, 192, 165, 250), cut=[("half", -1, 1, 117)])],
    "p3c": [dict(seed=(385, 140), box=(360, 112, 414, 170)), dict(seed=(322, 175), box=(288, 150, 348, 200), cut=[("half", -0.92, 1, -102)])],
    "p4e": [dict(seed=(365, 100), box=(336, 78, 400, 128)), dict(seed=(300, 125), box=(272, 102, 322, 146), cut=[("rect", 270, 122, 285, 150)])],
    "p5b": [dict(seed=(285, 165), box=(262, 144, 308, 198), cut=[("rect", 297, 142, 312, 168)]), dict(seed=(222, 193), box=(196, 172, 246, 220))],
    "p6f": [dict(seed=(285, 168), box=(262, 134, 330, 202)), dict(seed=(190, 170), box=(158, 134, 230, 202), cut=[("rect", 150, 130, 172, 215)])],
    "p6b": [dict(seed=(305, 165), box=(277, 126, 324, 215)), dict(seed=(205, 195), box=(140, 154, 238, 232))],
}
LASH = (36, 20, 10)  # 原睫毛的深褐色（取样 (35,18,8) / (29,19,11) 的均值附近）
SS = 4  # 抗锯齿超采样


def non_skin(rgb: np.ndarray) -> np.ndarray:
    r, g, b = [rgb[..., i].astype(int) for i in range(3)]
    lum = (r * 299 + g * 587 + b * 114) // 1000
    return (lum < 95) | (b > 190)


def skin_like(rgb: np.ndarray) -> np.ndarray:
    r, g, b = [rgb[..., i].astype(int) for i in range(3)]
    return (r > 235) & (g > 180) & (g < 228) & (b > 135) & (b < 192)


def eye_region(rgb: np.ndarray, seed, box, cut=()):
    """cut：这些地方不算眼睛（脸的外轮廓、头发碰到睫毛的地方）。("half", a, b, c) 排除 a*x+b*y >= c；("rect", x0, y0, x1, y1) 排除矩形。"""
    x0, y0, x1, y1 = box
    m = np.zeros(rgb.shape[:2], np.uint8)
    m[y0:y1, x0:x1] = non_skin(rgb[y0:y1, x0:x1]).astype(np.uint8)
    yy, xx = np.mgrid[0:rgb.shape[0], 0:rgb.shape[1]]
    for c in cut:
        if c[0] == "half":
            m[(c[1] * xx + c[2] * yy) >= c[3]] = 0
        else:
            m[c[2]:c[4], c[1]:c[3]] = 0
    n, lab = cv2.connectedComponents(m, connectivity=8)
    k = lab[seed[1], seed[0]]
    if k == 0:
        raise SystemExit(f"seed {seed} 不在眼睛区域里")
    comp = (lab == k).astype(np.uint8)
    # 补洞（虹膜高光等）
    cnts, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    filled = np.zeros_like(comp)
    cv2.drawContours(filled, cnts, -1, 1, thickness=cv2.FILLED)
    return filled


def make_patch(name: str):
    im = Image.open(SRC / f"{name}.webp").convert("RGBA")
    rgb = np.array(im.convert("RGB"))
    h, w = rgb.shape[:2]
    patch = np.zeros((h, w, 4), np.uint8)
    for e in EYES[name]:
        comp = eye_region(rgb, e["seed"], e["box"], e.get("cut", ()))
        grown = cv2.dilate(comp, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
        ring = cv2.dilate(grown, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))) - grown
        # 填皮肤：只用附近的皮肤色像素做归一化高斯加权平均，保留腮红 / 明暗的渐变；边缘羽化 1 像素
        S = (skin_like(rgb) & (grown == 0)).astype(np.float32)
        if S[ring > 0].sum() < 20:
            raise SystemExit(f"{name}: 眼睛周围找不到皮肤色")
        def smooth(sig):
            d = cv2.GaussianBlur(S, (0, 0), sig)
            n = np.stack([cv2.GaussianBlur(rgb[..., c].astype(np.float32) * S, (0, 0), sig) for c in range(3)], -1)
            return n / np.maximum(d, 1e-6)[..., None], d
        # 多尺度：近处皮肤够多就用小尺度（保留渐变），区域中心够不到就退到大尺度，再不行用环上的中位数
        med = np.median(rgb[(ring > 0) & skin_like(rgb)], axis=0)
        fill, den = smooth(6)
        for sig in (14, 30):
            f2, d2 = smooth(sig)
            weak = den < 0.12
            fill = np.where(weak[..., None], f2, fill)
            den = np.where(weak, d2, den)
        fill = np.where((den < 0.05)[..., None], med, fill)
        a = cv2.GaussianBlur(grown.astype(np.float32), (0, 0), 1.1)
        a = np.clip(a * 1.15, 0, 1)
        for c in range(3):
            patch[..., c] = np.where(a > 0, np.clip(fill[..., c], 0, 255).astype(np.uint8), patch[..., c])
        patch[..., 3] = np.maximum(patch[..., 3], (a * 255).astype(np.uint8))
        # 主轴（PCA）
        ys, xs = np.nonzero(comp)
        pts = np.stack([xs, ys], 1).astype(np.float64)
        mu = pts.mean(0)
        # 主轴 = 睁眼区域上轮廓（上睫毛线）的拟合直线方向；e.get("angle") 可手工覆盖（度，顺时针为正）
        cols = np.unique(xs)
        lo, hi = np.percentile(cols, 12), np.percentile(cols, 88)
        top = np.array([(x, ys[xs == x].min()) for x in cols if lo <= x <= hi], dtype=np.float64)
        slope = np.polyfit(top[:, 0], top[:, 1], 1)[0] if len(top) > 3 else 0.0
        ang = np.arctan(slope) if "angle" not in e else np.deg2rad(e["angle"])
        u = np.array([np.cos(ang), np.sin(ang)])
        v = np.array([-u[1], u[0]])
        pu, pv = (pts - mu) @ u, (pts - mu) @ v
        # 取 2% / 98% 分位，免得被睫毛尖拉长
        u0, u1 = np.percentile(pu, 1.5), np.percentile(pu, 98.5)
        v_top, v_bot = np.percentile(pv, 3), np.percentile(pv, 97)
        height = v_bot - v_top
        length = u1 - u0
        # 闭眼线：两端落在原睁眼区域上 40% 处，中间再下垂（上睫毛线向下合拢）
        v_end = v_top + 0.42 * height
        bow = 0.13 * length
        thick_mid = max(3.2, 0.085 * length)
        # 超采样画渐变粗细曲线
        canvas = np.zeros((h * SS, w * SS), np.uint8)
        t = np.linspace(0, 1, 60)
        # 二次 Bezier：端点 p0 / p1，控制点在中点下方 2*bow（曲线中点下垂 bow）
        P0 = mu + u * u0 + v * v_end
        P1 = mu + u * u1 + v * v_end
        PC = (P0 + P1) / 2 + v * 2 * bow
        curve = ((1 - t)[:, None] ** 2) * P0 + (2 * (1 - t) * t)[:, None] * PC + (t[:, None] ** 2) * P1
        taper = 0.35 + 0.65 * np.sin(np.pi * t) ** 0.7  # 两端细、中间粗
        for (px, py), tw in zip(curve, taper):
            cv2.circle(canvas, (int(round(px * SS)), int(round(py * SS))), max(1, int(round(thick_mid * tw * SS / 2))), 255, -1, cv2.LINE_AA)
        line = cv2.resize(canvas, (w, h), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
        for c in range(3):
            patch[..., c] = np.where(line > 0, (LASH[c] * line + patch[..., c] * (1 - line)).astype(np.uint8), patch[..., c])
        patch[..., 3] = np.maximum(patch[..., 3], (line * 255).astype(np.uint8))
    return im, Image.fromarray(patch, "RGBA")


def main():
    preview = None
    if "--preview" in sys.argv:
        preview = Path(sys.argv[sys.argv.index("--preview") + 1])
        preview.mkdir(parents=True, exist_ok=True)
    for name in EYES:
        base, patch = make_patch(name)
        patch.save(OUT / f"{name}-blink.webp", lossless=True, quality=100, method=6)
        print(name, "→", OUT / f"{name}-blink.webp")
        if preview:
            closed = base.copy()
            closed.alpha_composite(patch)
            w, h = base.size
            sheet = Image.new("RGBA", (w * 2, h), (255, 255, 255, 255))
            sheet.paste(base, (0, 0))
            sheet.paste(closed, (w, 0))
            sheet.convert("RGB").save(preview / f"{name}-open-closed.png")


if __name__ == "__main__":
    main()
