#!/usr/bin/env python3
"""阅读段厨房（kitchen-friends-base.webp，1672×941）拆成远景层 + 台面桥 + 远景软化版，给页面做纵深（不靠羽化接缝）。

  远景层 kitchen-friends-far.webp（RGBA）
      台面后沿（图片 y BACK）以上的一切：墙、瓷砖、窗、吊柜、层板上半；再加上站在台面后沿的物件在台面上的部分
      （层板底座、菜篮、葱、格纹布……）：从台面区域里按墨线轮廓抠出来，整个物件都归远景。下沿留 LAP 像素的台面木纹
      藏在台面桥下面，防止接缝处的亚像素细线。
  台面桥 kitchen-friends-band.webp（不透明）
      图片 y BACK–941：整条台面加前脸。物件底座的位置用同一行的木纹补上（cv2.inpaint），物件在远景层里盖住这里。
      页面上它的后沿跟着远景层位移、前沿跟着近景（主体层），中间按比例拉伸 / 倾斜（matrix），所以远近之间没有缝。
  远景软化 kitchen-friends-far-soft.webp（RGBA，同样的 alpha）
      远景层的模糊、低饱和、略亮版，画格在场时叠化进来（预烘，不每帧跑滤镜）。
  检查图 tools/planes_check.png：远景层叠在品红底上 / 台面桥 / 抠出来的物件遮罩。

只裁切、抠图和按周围像素补齐，不重画。打印的数值填 backgrounds.json reading.planes。

Run:  python3 tools/prepare_planes.py
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public/assets/bg/kitchen-friends-base.webp"
OUT = ROOT / "public/assets/bg"
BACK, FRONT = 668, 885  # 台面后沿 / 前沿（图片 y，backgrounds.json reading.counter.imgBackY / imgFrontY）
OBJ_MAX_Y = 860  # 站在台面上的物件最低到这里；再往下只有台面和前沿线
LAP = 4  # 远景层在后沿以下多留的木纹
INK = 105  # 墨线亮度阈值（与 tools/prepare_friends.py 相同）
SEEDS = [(836, 770), (1000, 820), (600, 850), (1250, 760)]  # 台面上没有物件的点
SOFT = dict(blur=1.3, color=0.88, brightness=1.04, contrast=0.93)


def fill_rows(img: np.ndarray, hole: np.ndarray, feather: int = 6) -> np.ndarray:
    """逐行填洞：每个洞段从同一行相邻的完好木纹（取较长的一侧）镜像铺满，两端与原像素线性过渡。"""
    out = img.copy()
    H, W = hole.shape
    for y in range(H):
        row = hole[y]
        if not row.any():
            continue
        x = 0
        while x < W:
            if not row[x]:
                x += 1
                continue
            a = x
            while x < W and row[x]:
                x += 1
            b = x  # 洞段 [a, b)
            # 左右两侧完好段的长度
            l = a
            while l > 0 and not row[l - 1]:
                l -= 1
            r = b
            while r < W and not row[r]:
                r += 1
            left_len, right_len = a - l, r - b
            if left_len == 0 and right_len == 0:
                continue
            src = img[y, b:r] if right_len >= left_len else img[y, l:a][::-1]  # 从洞边起向外的像素
            need = b - a
            reps = int(np.ceil(need / len(src))) + 1
            tile = np.concatenate([src if i % 2 == 0 else src[::-1] for i in range(reps)])[:need]
            seg = tile[::-1] if right_len >= left_len else tile  # 贴着取样一侧镜像
            out[y, a:b] = seg
            # 两端渐变
            n = min(feather, need // 2)
            if n > 0:
                if left_len:
                    w = np.linspace(0, 1, n + 2)[1:-1, None]
                    out[y, a : a + n] = img[y, a - 1] * (1 - w) + seg[:n] * w
                if right_len:
                    w = np.linspace(1, 0, n + 2)[1:-1, None]
                    out[y, b - n : b] = img[y, b] * (1 - w) + seg[need - n :] * w
    return out


def main() -> None:
    im = Image.open(SRC).convert("RGB")
    W, H = im.size
    rgb = np.asarray(im)
    lum = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    free = (lum > INK).astype(np.uint8)

    # 台面上的空木纹：从种子点在墨线之间泛洪，限制在后沿和前沿之间；没被泛到的（墨线围起来的）就是物件
    lim = np.zeros((H, W), np.uint8)
    lim[BACK:FRONT, :] = 1
    f = (free & lim) * 255
    mask = np.zeros((H + 2, W + 2), np.uint8)
    for sx, sy in SEEDS:
        if f[sy, sx] == 0:
            raise SystemExit(f"种子点 {(sx, sy)} 不在空台面上")
        if f[sy, sx] == 255:  # 128 = 已被前一个种子泛到
            cv2.floodFill(f, mask, (sx, sy), 128)
    counter_free = f == 128
    objects = lim.astype(bool) & ~counter_free
    objects[OBJ_MAX_Y:, :] = False  # 前沿线不算物件
    objects = ndimage.binary_fill_holes(objects)
    # 去掉孤立的小碎片（木纹里偶然的深色点），再外扩 2 像素把轮廓线包进来
    lab, n = ndimage.label(objects)
    sizes = ndimage.sum(objects, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 400])
    objects = ndimage.binary_dilation(keep, iterations=2)
    obj_soft = cv2.GaussianBlur(objects.astype(np.float32), (3, 3), 0)

    # 远景层 alpha：后沿以上 1（加 LAP 行木纹），台面区域里只有物件
    alpha = np.zeros((H, W), np.float32)
    alpha[: BACK + LAP, :] = 1
    alpha = np.maximum(alpha, obj_soft)
    far = np.dstack([rgb, np.round(alpha * 255).astype(np.uint8)])
    Image.fromarray(far).save(OUT / "kitchen-friends-far.webp", "WEBP", quality=92, method=6)

    # 台面桥：后沿到图片底，物件底座处用同一行旁边的木纹镜像填进来（木纹是横向的，整行延续最自然），边缘 6 像素渐变
    band = rgb[BACK:, :].astype(np.float32)
    hole = ndimage.binary_dilation(objects, iterations=3)[BACK:, :]
    band = fill_rows(band, hole)
    Image.fromarray(np.clip(band, 0, 255).astype(np.uint8)).save(OUT / "kitchen-friends-band.webp", "WEBP", quality=92, method=6)

    # 远景软化版
    soft = im.filter(ImageFilter.GaussianBlur(SOFT["blur"]))
    soft = ImageEnhance.Color(soft).enhance(SOFT["color"])
    soft = ImageEnhance.Brightness(soft).enhance(SOFT["brightness"])
    soft = ImageEnhance.Contrast(soft).enhance(SOFT["contrast"])
    soft_rgba = np.dstack([np.asarray(soft), far[..., 3]])
    Image.fromarray(soft_rgba).save(OUT / "kitchen-friends-far-soft.webp", "WEBP", quality=85, method=6)

    # 检查图
    magenta = np.full_like(rgb, (255, 0, 255))
    a = far[..., 3:4] / 255.0
    far_chk = (rgb * a + magenta * (1 - a)).astype(np.uint8)
    obj_chk = np.where(objects[..., None], rgb, (rgb * 0.25).astype(np.uint8))
    band_chk = np.zeros_like(rgb)
    band_chk[BACK:, :] = band
    sheet = np.vstack([far_chk[BACK - 120 : FRONT + 60], band_chk[BACK - 120 : FRONT + 60], obj_chk[BACK - 120 : FRONT + 60]])
    Image.fromarray(sheet).save(ROOT / "tools/planes_check.png")

    for name in ("kitchen-friends-far", "kitchen-friends-band", "kitchen-friends-far-soft"):
        print(f"{name}.webp  {(OUT / f'{name}.webp').stat().st_size // 1024} KB")
    ys, xs = np.nonzero(objects)
    print(f"objects on the counter: {n} components ≥ 400 px kept, rows {ys.min()}–{ys.max()}")
    print(f"far.img  = [0, 0, {W}, {H}]   band.img = [0, {BACK}, {W}, {H - BACK}]   bridge rows = {FRONT - BACK}")


if __name__ == "__main__":
    main()
