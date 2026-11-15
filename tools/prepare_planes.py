#!/usr/bin/env python3
"""阅读段厨房（kitchen-friends-base.webp，1672×941）拆成远、近两个平面，加一张远景软化版，给页面做纵深。

  远景平面 kitchen-friends-far.webp   图片 y 0–FAR_BOTTOM：墙、瓷砖、窗、层板、菜篮和站在台面后沿的一切，
                                     下沿留到台面中段（比近景平面的不透明起点低 FAR_BOTTOM−NEAR_OPAQUE 像素），
                                     远景相对主体层上下错位时不露底。
  近景平面 kitchen-friends-near.webp  图片 y NEAR_TOP–941：台面前半（蛋站的地方），上沿 NEAR_TOP→NEAR_OPAQUE 羽化接到远景的台面上。
  远景软化 kitchen-friends-far-soft.webp  远景平面的模糊、低饱和、略亮版，画格在场时叠化进来（预烘，不用每帧跑滤镜）。

切缝放在台面中段的平木纹上：台面后沿（图片 y 668）站着层板和菜篮，直线切会切断它们，所以它们整个归远景。
羽化带里远近两份木纹最多错开十几像素，只在镜头移动时出现。
只裁切、羽化和整体调色，不重画。打印的数值填 backgrounds.json reading.planes。

Run:  python3 tools/prepare_planes.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public/assets/bg/kitchen-friends-base.webp"
OUT = ROOT / "public/assets/bg"
FAR_BOTTOM, NEAR_TOP, NEAR_OPAQUE = 826, 754, 790
SOFT = dict(blur=1.3, color=0.88, brightness=1.04, contrast=0.93)


def main() -> None:
    im = Image.open(SRC).convert("RGB")
    W, H = im.size
    far = im.crop((0, 0, W, FAR_BOTTOM))
    far.save(OUT / "kitchen-friends-far.webp", "WEBP", quality=92, method=6)

    near = np.asarray(im.crop((0, NEAR_TOP, W, H)).convert("RGBA")).copy()
    n = NEAR_OPAQUE - NEAR_TOP
    r = np.linspace(0, 1, n, dtype=np.float32)
    ramp = r * r * (3 - 2 * r)
    near[:n, :, 3] = np.round(ramp * 255).astype(np.uint8)[:, None]
    Image.fromarray(near).save(OUT / "kitchen-friends-near.webp", "WEBP", quality=92, method=6)

    soft = far.filter(ImageFilter.GaussianBlur(SOFT["blur"]))
    soft = ImageEnhance.Color(soft).enhance(SOFT["color"])
    soft = ImageEnhance.Brightness(soft).enhance(SOFT["brightness"])
    soft = ImageEnhance.Contrast(soft).enhance(SOFT["contrast"])
    soft.save(OUT / "kitchen-friends-far-soft.webp", "WEBP", quality=85, method=6)

    for f in ("kitchen-friends-far", "kitchen-friends-near", "kitchen-friends-far-soft"):
        print(f"{f}.webp  {(OUT / f'{f}.webp').stat().st_size // 1024} KB")
    print(f'far.img  = [0, 0, {W}, {FAR_BOTTOM}]')
    print(f'near.img = [0, {NEAR_TOP}, {W}, {H - NEAR_TOP}]')


if __name__ == "__main__":
    main()
