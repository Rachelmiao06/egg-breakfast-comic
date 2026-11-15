"""漫画单格副本：把深色手绘框外面的纸白（裁切留白、圆角外的纸）清成透明。

- 只处理 public/ 下的副本；source/ 原图和桌面原件不动。裁切范围与 manifest.json 完全相同（交接格对齐依赖它）。
- 框外 = 从裁切边缘出发、经过“接近纸色”的像素做泛洪，碰到深色框线就停；所以框内的纸白和对白气泡不会被抠掉。
- 框线外缘的抗锯齿像素：按亮度换算成半透明墨色（去掉白色混合），缩放后不出现浅色光圈。
用法：python3 tools/panel_alpha.py [源页目录] [输出目录] [key…]
  默认从 source/comic-v3 按 manifest 重新裁切并写回 public/assets/comic-v3/<key>.webp。
"""
import json
import sys
from collections import deque

import numpy as np
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else "source/comic-v3"
OUT = sys.argv[2] if len(sys.argv) > 2 else "public/assets/comic-v3"
ONLY = set(sys.argv[3:])
MAN = json.load(open("public/assets/comic-v3/manifest.json"))

PAPER_T = 34  # 与纸色的 RGB 距离和小于它算“纸”
EDGE = 3      # 框外缘半透明处理的宽度（像素）


def outside_mask(rgb: np.ndarray, paper: np.ndarray) -> np.ndarray:
    near = np.abs(rgb - paper).sum(2) < PAPER_T
    h, w = near.shape
    out = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not out[y, x]: out[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not out[y, x]: out[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True; q.append((ny, nx))
    return out


def dilate(m: np.ndarray, r: int) -> np.ndarray:
    o = m.copy()
    for _ in range(r):
        p = np.pad(o, 1)
        o = p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    return o


def process(page: Image.Image, box) -> Image.Image:
    rgb = np.asarray(page.crop(box).convert("RGB")).astype(float)
    border = np.concatenate([rgb[:3].reshape(-1, 3), rgb[-3:].reshape(-1, 3), rgb[:, :3].reshape(-1, 3), rgb[:, -3:].reshape(-1, 3)])
    paper = np.median(border, axis=0)
    out = outside_mask(rgb, paper)
    lum = rgb.mean(2)
    ink_px = rgb[(lum < 60) & dilate(out, EDGE + 3) & ~out]
    ink = np.median(ink_px, axis=0) if len(ink_px) > 20 else np.array([34.0, 24.0, 18.0])
    alpha = np.ones(lum.shape)
    alpha[out] = 0
    # 框外缘：靠近框外、又不是纯墨色的像素 → 半透明墨色
    rim = dilate(out, EDGE) & ~out
    pl, il = paper.mean(), ink.mean()
    a_rim = np.clip((pl - lum) / max(1.0, pl - il), 0, 1)
    alpha[rim] = np.minimum(alpha[rim], a_rim[rim])
    rgb[rim] = ink
    rgba = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
    return trim_frame(Image.fromarray(rgba, "RGBA"))  # (图, 框)


def trim_frame(im: Image.Image, extra: int = 2):
    """把手绘黑框整圈裁掉，画面直接到边（页面再统一画纸边，见 docs/PAPER-WORLD.md）。
    每条边从不透明区域边缘往里数，连续的深色像素就是框线（含外缘毛边）；再多切 extra 像素吃掉内侧暗晕。
    返回 (裁好的图, 裁切框)；裁切框相对未裁的单格，叠在格子上的补丁图要用同一个框裁（tools/trim_patches.py）。"""
    a = np.asarray(im).astype(int)
    opaque = a[..., 3] > 128
    ys, xs = np.where(opaque)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    dark = a[..., :3].mean(2) < 95
    def run(line_dark):
        n = 0
        while n < len(line_dark) and line_dark[n]: n += 1
        return n
    ty = np.linspace(y0 + (y1 - y0) // 3, y1 - (y1 - y0) // 3, 9).astype(int)
    tx = np.linspace(x0 + (x1 - x0) // 3, x1 - (x1 - x0) // 3, 9).astype(int)
    l = int(np.median([run(dark[y, x0:x1]) for y in ty]))
    r = int(np.median([run(dark[y, x0:x1][::-1]) for y in ty]))
    t = int(np.median([run(dark[y0:y1, x]) for x in tx]))
    b = int(np.median([run(dark[y0:y1, x][::-1]) for x in tx]))
    box = (int(x0 + l + extra), int(y0 + t + extra), int(x1 - r - extra), int(y1 - b - extra))
    out = im.crop(box)
    arr = np.asarray(out).copy(); arr[..., 3] = 255   # 裁完后整格不透明
    return Image.fromarray(arr, "RGBA"), box


if __name__ == "__main__":
    pages = {}
    TRIM = {}
    for key, v in MAN.items():
        if ONLY and key not in ONLY: continue
        page = pages.setdefault(v["page"], Image.open(f"{SRC}/{v['page']}").convert("RGB"))
        im, tbox = process(page, tuple(v["box"]))
        TRIM[key] = {"old_size": v["size"], "box": tbox}
        im.save(f"{OUT}/{key}.webp", lossless=False, quality=92, alpha_quality=100, method=6)
        a = np.asarray(im)[..., 3]
        print(key, im.size, "transparent %.1f%%" % ((a == 0).mean() * 100))
    json.dump(TRIM, open("tools/panel_trim.json", "w"), indent=1)
