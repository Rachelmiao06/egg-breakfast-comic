#!/usr/bin/env python3
"""新蛋姿势（用户 2026-11-15 交付，pose-set-v2，白底）抠成透明 PNG/WebP，并算出和原蛋对齐的摆放框。

  soar  超人飞行（03-super-flight/variant-02）：画面朝右上，页面里水平镜像后用于篮沿 → 妈妈视线点的抛物线（Egg faces.soar）
  peek  探头（05-peeking/variant-01）：水平裁口，只用上 88%（底部小手被裁掉），在漫画格后面升起（ComicLayer PerchEgg）

抠图：白底（近白且与边界相连）去掉，边缘 5×5 羽化；不重画。
摆放框：和 public/assets/scene/egg.webp 对齐——按“透明度面积”的平方根取缩放（含手脚的整体大小一致），再让两者的质心重合；
打印的数值填 slots.json egg.faces.soar（box 单位 = 蛋布局框像素）。

Run:  python3 tools/prepare_poses.py
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SRC = Path("/Users/mac/Documents/Codex/2026-11-14/new-chat-2/mom-egg-rice-comic/animation-assets/egg-poses/pose-set-v2")
OUT = ROOT / "public/assets/scene"
LAYOUT = (388, 388)  # src/lib/scene.ts ANCHORS.eggSize（蛋布局框）


def cutout(path: Path) -> np.ndarray:
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    white = (rgb[..., 0] > 238) & (rgb[..., 1] > 238) & (rgb[..., 2] > 236)
    lab, _ = ndimage.label(white)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fg = ~np.isin(lab, list(edge))
    fg = ndimage.binary_opening(fg, iterations=1)
    lab2, n = ndimage.label(fg)
    sizes = ndimage.sum(fg, lab2, range(1, n + 1))
    fg = lab2 == (int(np.argmax(sizes)) + 1)
    fg = ndimage.binary_fill_holes(fg) | fg
    a = cv2.GaussianBlur(fg.astype(np.float32), (5, 5), 0)
    return np.dstack([rgb, a * 255]).astype(np.uint8)


def stats(rgba: np.ndarray):
    a = rgba[..., 3].astype(np.float32) / 255
    ys, xs = np.mgrid[0 : a.shape[0], 0 : a.shape[1]]
    area = a.sum()
    return area, (xs * a).sum() / area, (ys * a).sum() / area


def main() -> None:
    # 原蛋
    base = np.asarray(Image.open(OUT / "egg.webp").convert("RGBA"))
    Ab, cxb, cyb = stats(base)
    bh, bw = base.shape[:2]

    soar = cutout(SRC / "03-super-flight/variant-02.png")
    As, cxs, cys = stats(soar)
    k = (LAYOUT[0] / bw) * np.sqrt(Ab / As)  # 蛋布局框像素 / 姿势图像素
    side = soar.shape[1] * k
    box = dict(left=round(LAYOUT[0] * cxb / bw - cxs * k, 1), top=round(LAYOUT[1] * cyb / bh - cys * k, 1), width=round(side, 1), height=round(soar.shape[0] * k, 1))
    pivot = (round(cxs / soar.shape[1] * 100, 2), round(cys / soar.shape[0] * 100, 2))
    Image.fromarray(soar).resize((800, round(800 * soar.shape[0] / soar.shape[1])), Image.LANCZOS).save(OUT / "egg-soar.webp", "WEBP", quality=90, method=6)
    print(f"egg-soar.webp  box={box}  mirror pivot={pivot}% (质心)")

    peek = cutout(SRC / "05-peeking/variant-01.png")
    ys, xs = np.where(peek[..., 3] > 5)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    h = round((y1 - y0) * 0.88)  # 去掉底部小手
    crop = peek[y0 : y0 + h, x0:x1]
    Image.fromarray(crop).resize((900, round(900 * crop.shape[0] / crop.shape[1])), Image.LANCZOS).save(OUT / "egg-peek.webp", "WEBP", quality=92, method=6)
    print(f"egg-peek.webp  aspect={crop.shape[1] / crop.shape[0]:.4f}")


if __name__ == "__main__":
    main()
