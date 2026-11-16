#!/usr/bin/env python3
"""找漫画格里对白泡的文字框（2026-11-15：所有字都要像动画一样几个几个出来，字体统一 → 先把图里画死的字盖掉，再用真字体逐字显示）。
对白泡 = 一大块奶油色连通域；字 = 这块连通域填洞后里面的深色像素。输出每行字的框（图片像素）和泡的底色。
用法：python3 tools/find_bubble_text.py <key> <图片>... → 打印 JSON；--debug 另存标注图到 /tmp"""
import sys, json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

def analyse(path):
    im = Image.open(path).convert("RGB")
    a = np.array(im).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    cream = (a.min(axis=2) > 205) & (r - b < 70) & (r > 225)
    lab, n = ndimage.label(cream)
    best = []
    for i in range(1, n + 1):
        m = lab == i
        area = int(m.sum())
        if area < 1500: continue
        ys, xs = np.where(m)
        filled = ndimage.binary_fill_holes(m)
        holes = filled & ~m
        luma = 0.3 * r + 0.59 * g + 0.11 * b
        dark = holes & (luma < 150)
        if dark.sum() < 80: continue
        # 洞里除了深色字，不该有很多别的东西（米饭的洞里是奶油 / 阴影，不是深色字）
        frac = dark.sum() / max(1, holes.sum())
        if frac < 0.12: continue
        dy, dx = np.where(dark)
        best.append((area, (xs.min(), ys.min(), xs.max(), ys.max()), (dx.min(), dy.min(), dx.max(), dy.max()), dark, m))
    best.sort(key=lambda t: -t[0])
    out = []
    for area, bub, tb, dark, m in best[:2]:
        # 行：深色像素的水平投影分行
        rows = np.where(dark.any(axis=1))[0]
        groups, start, prev = [], rows[0], rows[0]
        for y in rows[1:]:
            if y - prev > 6: groups.append((start, prev)); start = y
            prev = y
        groups.append((start, prev))
        lines = []
        for y0, y1 in groups:
            xs_ = np.where(dark[y0:y1 + 1].any(axis=0))[0]
            lines.append([int(xs_.min()), int(y0), int(xs_.max()) + 1, int(y1) + 1])
        col = np.median(np.array(im)[m], axis=0).astype(int).tolist()
        out.append({"bubble": [int(v) for v in bub], "rows": lines, "color": col})
    return im.size, out

if __name__ == "__main__":
    debug = "--debug" in sys.argv
    args = [x for x in sys.argv[1:] if x != "--debug"]
    key, paths = args[0], args[1:]
    for p in paths:
        size, res = analyse(p)
        print(json.dumps({"key": key, "src": p, "size": size, "bubbles": res}, ensure_ascii=False))
        if debug:
            im = Image.open(p).convert("RGB"); d = ImageDraw.Draw(im)
            for bb in res:
                for rr in bb["rows"]: d.rectangle(rr, outline=(255, 0, 0), width=2)
            im.save(f"/tmp/btext_{key}.png")
