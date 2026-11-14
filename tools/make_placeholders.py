#!/usr/bin/env python3
"""
占位图生成（feat/comic-scroll，可重跑）。

正式的妈妈漫画稍后由 ChatGPT 重画；在那之前，用两张现成图里裁出来的小块
搭前景五段的布局、滚动顺序和接蛋位置。所有产出都是临时的，替换时整目录删掉即可。

  python3 tools/make_placeholders.py [--mom "/path/to/Chinese Mom’s Potato Leek Soup Comic.png"]

输出：public/assets/comic/placeholder/*.png 和 src/components/comic/placeholder-manifest.json
（每张图的像素尺寸，组件用它算宽高比）。
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public/assets/comic/placeholder")
MANIFEST = os.path.join(ROOT, "src/components/comic/placeholder-manifest.json")
DEFAULT_MOM = os.path.expanduser("~/Desktop/Chinese Mom’s Potato Leek Soup Comic.png")

# 参考图（1191×1321）里的妈妈姿势：只借人物和笔触，正式图会重画。
MOM_CROPS = {
    "mom-point":     (290, 215, 560, 450),   # 指着食材介绍
    "mom-wink":      (265, 470, 440, 690),   # 捂嘴偷笑：放黄油、打蛋
    "mom-surprised": (235, 1125, 470, 1300), # 睁大眼睛：发现蛋在跳
    "mom-board":     (130, 895, 425, 1085),  # 双手端着板子 → 锅铲的站位
    "mom-rest":      (740, 1000, 930, 1160), # 托腮：端出早餐
}
# 厨房主图（1536×1024）和漫画页 2 里的道具。
PROP_CROPS = {
    "prop-toast":     ("source/kitchen-main.png", (0, 815, 445, 1024)),
    "prop-butter":    ("source/kitchen-main.png", (105, 850, 235, 960)),
    "prop-eggshell":  ("source/kitchen-main.png", (1125, 830, 1455, 1000)),
    "prop-pan":       ("source/kitchen-main.png", (340, 480, 1235, 770)),
    "prop-breakfast": ("source/comic-page-2.png", (650, 255, 1020, 480)),
}


def knockout_white(im: Image.Image, thresh=236, feather=1.5) -> Image.Image:
    """把参考图的纯白底变透明（人物保留），只用于占位。"""
    a = np.asarray(im.convert("RGB")).astype(int)
    white = a.min(axis=2) > thresh
    # 只去掉和边缘连通的白底，人物里的白（眼白、牙）保留
    lab, n = ndi.label(white)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    border.discard(0)
    bg = np.isin(lab, list(border))
    alpha = (~bg).astype(float)
    alpha = ndi.gaussian_filter(alpha, feather)
    rgba = np.dstack([a, (alpha * 255).clip(0, 255)]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mom", default=DEFAULT_MOM)
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    manifest = {}

    if os.path.exists(args.mom):
        mom = Image.open(args.mom).convert("RGB")
        for name, box in MOM_CROPS.items():
            im = knockout_white(mom.crop(box))
            im.save(os.path.join(OUT, name + ".png"))
            manifest[name] = {"w": im.width, "h": im.height}
    else:
        print(f"参考图不存在，跳过妈妈占位：{args.mom}", file=sys.stderr)

    for name, (src, box) in PROP_CROPS.items():
        im = Image.open(os.path.join(ROOT, src)).convert("RGB").crop(box)
        im.save(os.path.join(OUT, name + ".png"))
        manifest[name] = {"w": im.width, "h": im.height}

    with open(MANIFEST, "w") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("wrote", len(manifest), "placeholders →", OUT)


if __name__ == "__main__":
    main()
