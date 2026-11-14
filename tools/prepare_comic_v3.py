"""六张新漫画页 → 单格副本（feat/visual-direction，可重跑；原图在 source/comic-v3，桌面原件不动）。
按格间纸白自动切格，保留每格的框线、对白和一圈纸白（PAD）。不缩放、不改画面。
输出 public/assets/comic-v3/p{页}{格字母}.webp 和 manifest.json（每格尺寸、来源框）。
"""
import json
import numpy as np
from PIL import Image

SRC, OUT = "source/comic-v3", "public/assets/comic-v3"
PAGES = ["01-groceries-and-an-idea", "02-preparing-the-meal", "03-something-is-missing", "04-catch-and-call", "05-looking-for-baby", "06-recognition-and-punchline"]
PAD = 5

def runs(mask, min_len):
    out, start = [], None
    for i, v in enumerate(mask):
        if v and start is None: start = i
        if not v and start is not None:
            if i - start >= min_len: out.append((start, i))
            start = None
    if start is not None and len(mask) - start >= min_len: out.append((start, len(mask)))
    return out

manifest = {}
for pi, name in enumerate(PAGES, 1):
    im = Image.open(f"{SRC}/{name}.png").convert("RGB"); a = np.asarray(im).astype(int)
    paper = np.median(np.concatenate([a[:6, :, :].reshape(-1, 3), a[:, :6, :].reshape(-1, 3)]), axis=0)
    ink = np.abs(a - paper).sum(2) > 45
    letter = ord("a")
    for (y0, y1) in runs(ink.mean(1) > 0.03, 80):
        for (x0, x1) in runs(ink[y0:y1].mean(0) > 0.03, 80):
            box = (max(0, x0 - PAD), max(0, y0 - PAD), min(im.width, x1 + PAD), min(im.height, y1 + PAD))
            key = f"p{pi}{chr(letter)}"; letter += 1
            c = im.crop(box); c.save(f"{OUT}/{key}.webp", quality=92, method=6)
            manifest[key] = {"page": f"{name}.png", "box": list(map(int, box)), "size": list(c.size)}
json.dump(manifest, open(f"{OUT}/manifest.json", "w"), indent=1)
for k, v in manifest.items(): print(k, v["size"], v["box"])
