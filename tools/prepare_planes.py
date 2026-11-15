#!/usr/bin/env python3
"""阅读段厨房（kitchen-friends-base.webp，1672×941）拆成远景层 + 近景层 + 远景软化版，给页面做纵深。

  近景层 kitchen-friends-near.webp（RGBA）
      整条台面（后沿 BACK 以下的一切，连前脸）加上站在台面上的东西：左边的层板架、架上的罐子、油瓶、盆栽，
      右边的菜篮、菜、格纹布、葱。它们是一块刚体，跟主体层一起动，台面不拉伸、不倾斜。
      物件按墨线轮廓从墙前抠出来（只在 ZONES 两个区域里找，区域外的一切都是墙）。
  远景层 kitchen-friends-far.webp（不透明，只到 BACK + EXT 行）
      墙、瓷砖、吊柜、窗。物件的位置（连同物件之间的小缝）用同一行旁边的墙面镜像补齐（最多只露出十几像素）；台面后沿以下再补 EXT 行
      镜像的墙面，远景层相对近景层往上走时不露底。页面上它比主体层少动，近景层盖在它上面：
      台面后沿和物件的轮廓在墙上滑动，这就是纵深。
  远景软化 kitchen-friends-far-soft.webp
      远景层的模糊、低饱和、略亮版，画格在场时叠化进来（预烘，不每帧跑滤镜）。
  检查图 tools/planes_check.png：近景层叠在品红底上 / 远景层 / 分类结果（近景红、远景不变）。

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
BACK = 668  # 台面后沿（图片 y，backgrounds.json reading.counter.imgBackY）
EXT = 48  # 远景层在后沿以下补的墙面行数（近景层相对远景层最多走十几像素）
INK = 105  # 墨线亮度阈值（与 tools/prepare_friends.py 相同）
# 站在台面上的东西只在这两个区域里找（x0, y0, x1, y1）：左 = 层板架 + 盆栽，右 = 菜篮 + 葱。
# 区域里被墨线围起来、整个落在区域内的色块是物件；碰到区域外的（墙、瓷砖、窗台……）都是墙。
ZONES = [(0, 95, 420, BACK), (1290, 270, 1672, BACK)]
# 区域里整个被围起来、但其实是墙 / 吊柜的色块：给一个落在里面的点
FAR_SEEDS = [
    (150, 430),  # 层板架上下两层之间、罐子上方的瓷砖和墙
    (300, 185),  # 吊柜底板（整块在左区域里）
]
# 手工加的墨线（x0, y0, x1, y1）：葱的叶子是单独的角色层（friends-scallion-leaves.png），底图里那块是模糊补的瓷砖，
# 葱身子和墙之间没有轮廓线，在角色层下沿画一条，把身子围起来
BARRIERS = [(1325, 522, 1470, 522)]
# 远景层里额外当作物件补掉的区域（x0, y0, x1, y1）：葱叶子角色层盖住的那块模糊补的瓷砖
HOLE_EXTRA = [(1325, 373, 1470, 522)]
CLOSE = 12  # 物件之间小于 2×CLOSE 像素的缝（叶子之间、葱和篮子之间）一起补掉，补的来源才是干净的墙
SMALL = 4000  # 小于这个面积的围起色块看邻居：周围（隔着墨线）主要是物件就归物件（罐子里的豆子、叶子之间的缝），主要是墙就归墙（吊柜木纹里的小块）
RING = 4  # 看邻居时向外看的像素
SOFT = dict(blur=1.3, color=0.88, brightness=1.04, contrast=0.93)


def fill_rows(img: np.ndarray, hole: np.ndarray, feather: int = 6) -> np.ndarray:
    """逐行填洞：每个洞段从同一行相邻的完好像素（取较长的一侧）镜像铺满，两端与原像素线性过渡。"""
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
            l = a
            while l > 0 and not row[l - 1]:
                l -= 1
            r = b
            while r < W and not row[r]:
                r += 1
            left_len, right_len = a - l, r - b
            if left_len == 0 and right_len == 0:
                continue
            src = img[y, b:r] if right_len >= left_len else img[y, l:a][::-1]
            need = b - a
            reps = int(np.ceil(need / len(src))) + 1
            tile = np.concatenate([src if i % 2 == 0 else src[::-1] for i in range(reps)])[:need]
            seg = tile[::-1] if right_len >= left_len else tile
            out[y, a:b] = seg
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
    ink = lum <= INK
    for x0, y0, x1, y1 in BARRIERS:
        cv2.line(ink.view(np.uint8), (x0, y0), (x1, y1), 1, 1)
    ink = ndimage.binary_dilation(ink, iterations=1)  # 外扩 1 像素，封住轮廓线上的小缺口
    region = ~ink
    region[BACK:, :] = False  # 后沿以下全是近景，不参与分类
    lab, n = ndimage.label(region)
    sizes = ndimage.sum(region, lab, range(1, n + 1))
    slices = ndimage.find_objects(lab)
    in_zone = lambda sl: any(sl[1].start >= zx0 and sl[1].stop <= zx1 and sl[0].start >= zy0 and sl[0].stop <= zy1 for zx0, zy0, zx1, zy1 in ZONES)
    seed_lab = {lab[sy, sx] for sx, sy in FAR_SEEDS}
    if 0 in seed_lab:
        raise SystemExit("FAR_SEEDS 里有点落在墨线上")
    # 第一遍：大色块。整个落在区域里、没被种子点到的是物件；其余（碰到区域外、种子点到的）是墙
    near = np.zeros((H, W), bool)
    far = np.zeros((H, W), bool)
    small = []
    for i, sl in enumerate(slices):
        comp = lab[sl] == i + 1
        if not in_zone(sl) or i + 1 in seed_lab:
            far[sl] |= comp
        elif sizes[i] < SMALL:
            small.append((i, sl))
        else:
            near[sl] |= comp
    # 第二遍：小色块。饱和的绿色是叶子，直接归物件（墙前没有别的饱和绿）；其余看隔着墨线的邻居，已定的邻居多数是谁就跟谁，
    # 一轮轮传开（罐子里的豆子跟着玻璃、篮子缝跟着篮子、吊柜木纹里的小块跟着吊柜）；最后没人挨着的归物件
    stats = dict(near=int(len([1 for i, sl in enumerate(slices) if in_zone(sl) and i + 1 not in seed_lab and sizes[i] >= SMALL])), leaf=0, small_near=0, small_far=0, lone=0)
    def hsv(mean):
        h, s_, v = cv2.cvtColor(np.uint8([[mean]]), cv2.COLOR_RGB2HSV)[0, 0].astype(float)
        return h * 2, s_ / 255, v / 255
    pending = []
    for i, sl in small:
        comp = lab[sl] == i + 1
        h, s_, v = hsv(rgb[sl][comp].mean(0))
        if s_ > 0.35 and 50 <= h <= 125:
            near[sl] |= comp
            stats["leaf"] += 1
        else:
            pending.append((i, sl))
    changed = True
    while pending and changed:
        changed = False
        for i, sl in list(pending):
            y0, y1, x0, x1 = max(sl[0].start - RING, 0), min(sl[0].stop + RING, H), max(sl[1].start - RING, 0), min(sl[1].stop + RING, W)
            box = (slice(y0, y1), slice(x0, x1))
            comp = lab[box] == i + 1
            ring = ndimage.binary_dilation(comp, iterations=RING) & ~comp
            nf, nn = (ring & far[box]).sum(), (ring & near[box]).sum()
            if nf == 0 and nn == 0:
                continue
            if nf > nn:
                far[box] |= comp
                stats["small_far"] += 1
            else:
                near[box] |= comp
                stats["small_near"] += 1
            pending.remove((i, sl))
            changed = True
    for i, sl in pending:
        near[sl] |= lab[sl] == i + 1
        stats["lone"] += 1
    near = ndimage.binary_dilation(near, iterations=2)  # 把轮廓线包进来
    objects = near.copy()
    near[BACK:, :] = True

    # 近景层：台面 + 物件，边缘 3×3 羽化；裁到最高一行
    alpha = cv2.GaussianBlur(near.astype(np.float32), (3, 3), 0)
    top = int(np.argmax(alpha.max(1) > 0))
    near_rgba = np.dstack([rgb, np.round(alpha * 255).astype(np.uint8)])[top:]
    Image.fromarray(near_rgba).save(OUT / "kitchen-friends-near.webp", "WEBP", quality=92, method=6)

    # 远景层：物件处按同一行镜像补墙，后沿以下再补 EXT 行镜像的墙
    hole = ndimage.binary_dilation(objects, iterations=3)
    hole |= ndimage.binary_closing(objects, structure=np.ones((3, 3), bool), iterations=CLOSE)
    for x0, y0, x1, y1 in HOLE_EXTRA:
        hole[y0:y1, x0:x1] = True
    far = fill_rows(rgb[:BACK].astype(np.float32), hole[:BACK])
    far = np.vstack([far, far[BACK - 1 - np.arange(EXT)]])
    far = np.clip(far, 0, 255).astype(np.uint8)
    Image.fromarray(far).save(OUT / "kitchen-friends-far.webp", "WEBP", quality=92, method=6)

    soft = Image.fromarray(far).filter(ImageFilter.GaussianBlur(SOFT["blur"]))
    soft = ImageEnhance.Color(soft).enhance(SOFT["color"])
    soft = ImageEnhance.Brightness(soft).enhance(SOFT["brightness"])
    soft = ImageEnhance.Contrast(soft).enhance(SOFT["contrast"])
    soft.save(OUT / "kitchen-friends-far-soft.webp", "WEBP", quality=85, method=6)

    # 检查图
    magenta = np.full_like(rgb, (255, 0, 255))
    a = alpha[..., None]
    near_chk = (rgb * a + magenta * (1 - a)).astype(np.uint8)
    far_chk = np.full_like(rgb, (255, 0, 255))
    far_chk[: BACK + EXT] = far
    cls = rgb.copy()
    cls[objects] = (rgb[objects] * 0.5 + np.array([255, 0, 0]) * 0.5).astype(np.uint8)
    for zx0, zy0, zx1, zy1 in ZONES:
        cv2.rectangle(cls, (zx0, zy0), (zx1 - 1, zy1 - 1), (0, 0, 255), 2)
    Image.fromarray(np.vstack([near_chk, far_chk, cls])).save(ROOT / "tools/planes_check.png")

    for name in ("kitchen-friends-near", "kitchen-friends-far", "kitchen-friends-far-soft"):
        print(f"{name}.webp  {(OUT / f'{name}.webp').stat().st_size // 1024} KB")
    print(f"components: {stats}")
    print(f"near.img = [0, {top}, {W}, {H - top}]   far.img = [0, 0, {W}, {BACK + EXT}]")


if __name__ == "__main__":
    main()
