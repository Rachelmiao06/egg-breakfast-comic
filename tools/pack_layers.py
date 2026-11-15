#!/usr/bin/env python3
"""把厨房分层的整画布 PNG（tools/split_scene.py 的输出，source/layers/）打包成页面实际加载的 webp。

每层裁到不透明包围盒外扩 PAD 像素（整画布 1536×1024 里锅沿只占 7%、近景只占 9%），
写到 public/assets/scene/<层>.webp，并把摆放框写进 src/lib/kitchen-layers.json，
KitchenLayers 按这个框把裁切图摆回场景坐标，所以画面位置不变。

压缩：
  far / counter / mid 是整宽的大层，用有损 q95（RGB 平均误差约 1.5/255，alpha 无损）；
  pan-rim / front-right / front-toast 是小的遮挡层，无损。
  --lossless 全部无损（体积约 3 倍）。
最后把 webp 按框重新合成，与 PNG 的合成逐像素比较，打印误差。

Run:  python3 tools/pack_layers.py [--lossless] [--src source/layers]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PAD = 4
W, H = 1536, 1024
# 页面里的叠放顺序（KitchenLayers）；back.png 是旧的合并层，不打包
LAYERS = ["far", "counter", "mid", "pan-rim", "front-toast", "front-right"]
LOSSY = {"far", "counter", "mid"}
QUALITY = 95


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="source/layers", help="整画布 PNG 所在目录")
    ap.add_argument("--lossless", action="store_true", help="全部无损")
    args = ap.parse_args()
    src_dir = ROOT / args.src
    out_dir = ROOT / "public/assets/scene"
    manifest: dict[str, dict] = {}
    pngs: dict[str, np.ndarray] = {}
    webps: dict[str, tuple[np.ndarray, tuple[int, int, int, int]]] = {}

    for name in LAYERS:
        im = Image.open(src_dir / f"{name}.png").convert("RGBA")
        assert im.size == (W, H), f"{name}: {im.size} != {(W, H)}"
        x0, y0, x1, y1 = im.getchannel("A").getbbox()
        box = (max(0, x0 - PAD), max(0, y0 - PAD), min(W, x1 + PAD), min(H, y1 + PAD))
        crop = im.crop(box)
        out = out_dir / f"{name}.webp"
        if name in LOSSY and not args.lossless:
            crop.save(out, "WEBP", quality=QUALITY, method=6)
            mode = f"q{QUALITY}"
        else:
            crop.save(out, "WEBP", lossless=True, quality=100, method=6)
            mode = "lossless"
        kb = out.stat().st_size // 1024
        print(f"{name:12s} box=[{box[0]}, {box[1]}, {box[2]}, {box[3]}] {crop.size[0]}×{crop.size[1]}  {mode:8s} {kb:5d} KB")
        manifest[name] = {"src": f"/assets/scene/{name}.webp", "box": list(box)}
        pngs[name] = np.asarray(im).astype(np.float32)
        webps[name] = (np.asarray(Image.open(out).convert("RGBA")).astype(np.float32), box)

    mpath = ROOT / "src/lib/kitchen-layers.json"
    mpath.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote {mpath.relative_to(ROOT)}")

    # ---- 合成检查：webp 按框摆回整画布，与 PNG 合成比较（front-toast 默认不渲染，这里也叠上）
    def composite(layers: list[np.ndarray]) -> np.ndarray:
        acc = np.zeros((H, W, 3), np.float32)
        for la in layers:
            a = la[..., 3:4] / 255.0
            acc = la[..., :3] * a + acc * (1 - a)
        return acc

    placed = []
    for name in LAYERS:
        arr, (x0, y0, x1, y1) = webps[name]
        full = np.zeros((H, W, 4), np.float32)
        full[y0:y1, x0:x1] = arr
        placed.append(full)
    diff = np.abs(composite(placed) - composite([pngs[n] for n in LAYERS])).max(2)
    print(f"webp recomposite vs png: mean {diff.mean():.3f}, p99.9 {np.percentile(diff, 99.9):.1f}, max {diff.max():.0f}, >8: {(diff > 8).sum()} px")


if __name__ == "__main__":
    main()
