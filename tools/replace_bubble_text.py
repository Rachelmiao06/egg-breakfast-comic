"""局部替换漫画格对白泡里的文字（不重画整格、不叠字）。

p6e（饭碗近景）："没事，是我拉稀了。" → "没事，是我拉肚子了。"（2026-11-14 用户要求）
做法：只在对白泡内部、原文字的范围内找出墨色笔画（亮度 < 150），外扩 2 px 后用 OpenCV inpaint 补成泡内的纸色；
再用接近原字形的粗黑体，按原文字的字高、基线、中心排新字，颜色取原墨色。泡的描边、尾巴和格内其它像素不动。
输入：source/comic-v3-edits/p6e-original.webp（替换前的 p6e.webp 原样备份）。输出：public/assets/comic-v3/p6e.webp
用法：python3 tools/replace_bubble_text.py [--font PATH --index N] [--preview OUT.png]
      python3 tools/replace_bubble_text.py --clean-only   只清掉泡内旧字、不排新字 → public/assets/comic-v3/p6e-clean.webp（对白分层样板用，新字由网页文字显示）
"""
import argparse
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

A = "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/"
FONTS = {
    "pingfang": (A + "86ba2c91f017a3749571a82f2c6d890ac7ffb2fb.asset/AssetData/PingFang.ttc", "PingFang SC", "Semibold"),
    "lantinghei": (A + "f14049099a04e570b893c01d9a4cd71f87c9e8d8.asset/AssetData/Lantinghei.ttc", "Lantinghei SC", "Heavy"),
    "lantinghei-demi": (A + "f14049099a04e570b893c01d9a4cd71f87c9e8d8.asset/AssetData/Lantinghei.ttc", "Lantinghei SC", "Demibold"),
}
SRC = "source/comic-v3-edits/p6e-original.webp"
OUT = "public/assets/comic-v3/p6e.webp"
TEXT = "没事，是我拉肚子了。"
# 原文字范围（p6e 像素）：字形 x 128–413、y 54–88；泡内空白带 y 42–104
OLD = (122, 50, 420, 92)
CJK_H = 31  # 原字的方块字高（"没" "是" 等的墨色高度）；新句多一个字，默认缩到 29 px、字距略收，才能留在泡的内框里
CENTER_X, TOP_Y = 270.5, 55  # 原文字的横向中心、字顶


def font_for(key):
    path, fam, style = FONTS[key]
    for i in range(16):
        try:
            f = ImageFont.truetype(path, 100, index=i)
        except OSError:
            break
        if f.getname() == (fam, style):
            return path, i
    raise SystemExit(f"找不到字体 {fam} {style}")


def clean_text(rgb):
    """泡内原文字范围里所有"不是纸色"的像素（含抗锯齿边）外扩后，整片填成泡里的纸色（泡里的纸几乎是平的：标准差 3–5）；返回 (干净的 rgb, 原墨色)。
    以前用 inpaint + 周围均色，笔画边缘会留下淡灰的影子，网页文字淡入时看起来像脏污。"""
    x0, y0, x1, y1 = OLD
    lum = rgb.astype(float).mean(2)
    box = lum[y0:y1, x0:x1]
    ink = np.median(rgb[y0:y1, x0:x1][box < 70], axis=0)
    paper = np.median(rgb[y0:y1, x0:x1][box > 235], axis=0)
    mask = np.zeros(lum.shape, np.uint8)
    mask[y0:y1, x0:x1] = (box < 232).astype(np.uint8)
    mask = cv2.dilate(mask, np.ones((7, 7), np.uint8))
    a = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 1.2)[..., None]
    out = rgb.astype(np.float32) * (1 - a) + paper[None, None, :].astype(np.float32) * a
    return np.clip(out, 0, 255).astype(np.uint8), ink


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--font", default="lantinghei")
    ap.add_argument("--preview")
    ap.add_argument("--stroke", type=float, default=0.0)
    ap.add_argument("--height", type=float, default=29.0)
    ap.add_argument("--tracking", type=float, default=-0.6, help="字距调整（p6e 像素，负 = 收紧）")
    ap.add_argument("--text-layer", action="store_true", help="只输出新字的透明层（墨色 + 字形透明度，和原格同尺寸）→ public/assets/comic-v3/p6e-text.webp；网页用它淡入，字形和图里其它对白同一套字体")
    ap.add_argument("--clean-only", action="store_true", help="只清掉泡内旧字，不排新字")
    args = ap.parse_args()
    im = Image.open(SRC).convert("RGBA")
    rgba = np.asarray(im).copy()
    rgb = rgba[..., :3].copy()
    clean, ink = clean_text(rgb)
    if args.clean_only:
        rgba[..., :3] = clean
        out = OUT.replace(".webp", "-clean.webp")
        Image.fromarray(rgba, "RGBA").save(out, quality=92, alpha_quality=100, method=6)
        print("wrote", out, "ink", ink.round())
        return
    rgb = clean.copy()
    # 新字：4 倍超采样排版，再缩回
    S = 4
    path, idx = font_for(args.font)
    probe = ImageFont.truetype(path, 100 * S, index=idx)
    bb = probe.getbbox("是")
    size = round(100 * S * args.height * S / (bb[3] - bb[1]))
    f = ImageFont.truetype(path, size, index=idx)
    W, H = im.width * S, im.height * S
    layer = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(layer)
    gb = f.getbbox("是")
    adv = [f.getlength(ch) + args.tracking * S for ch in TEXT]
    tw = sum(adv[:-1]) + f.getbbox(TEXT[-1])[2]
    x = CENTER_X * S - tw / 2
    y = (TOP_Y + (CJK_H - args.height) / 2) * S - gb[1]
    for ch, w in zip(TEXT, adv):
        d.text((x, y), ch, font=f, fill=255, stroke_width=round(args.stroke * S), stroke_fill=255)
        x += w
    a = np.asarray(layer.resize((im.width, im.height), Image.LANCZOS)).astype(float) / 255
    out = rgb.astype(float) * (1 - a[..., None]) + ink[None, None, :] * a[..., None]
    rgba[..., :3] = np.clip(out, 0, 255).astype(np.uint8)
    if args.text_layer:
        tl = np.zeros(rgba.shape, np.uint8)
        tl[..., :3] = ink.astype(np.uint8)
        tl[..., 3] = np.round(a * 255).astype(np.uint8)
        out = OUT.replace(".webp", "-text.webp")
        Image.fromarray(tl, "RGBA").save(out, lossless=True, method=6)
        print("wrote", out)
        return
    res = Image.fromarray(rgba, "RGBA")
    ys, xs = np.where(a > 0.3)
    print(f"font {FONTS[args.font][1]} {FONTS[args.font][2]} size {size / S:.1f}px  new text x {xs.min()}–{xs.max()}  y {ys.min()}–{ys.max()}  ink {ink.round()}")
    if args.preview:
        bg = Image.new("RGBA", res.size, (200, 200, 200, 255))
        bg.alpha_composite(res)
        bg.convert("RGB").resize((res.width * 2, res.height * 2), Image.LANCZOS).save(args.preview)
    else:
        res.save(OUT, quality=92, alpha_quality=100, method=6)
        print("wrote", OUT)


if __name__ == "__main__":
    main()
