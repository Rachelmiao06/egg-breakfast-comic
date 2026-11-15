#!/usr/bin/env python3
"""阅读段厨房（kitchen-friends-base.webp，1672×941）拆成远景层 + 近景层 + 远景软化版，给页面做纵深。

  近景层 kitchen-friends-near.webp（RGBA）
      整条台面（后沿 BACK 以下的一切，连前脸）加上站在台面上的东西：左边的层板架、架上的罐子、油瓶、盆栽，
      右边的菜篮、菜、格纹布、葱。它们是一块刚体，跟主体层一起动，台面不拉伸、不倾斜。
  远景层 kitchen-friends-far.webp（不透明，只到 BACK + EXT 行）
      墙、瓷砖、吊柜、窗。物件的位置用同一行离物件远一点的墙面镜像补齐（只补物件轮廓外 3 像素，最多只露出几像素）；
      台面后沿以下再补 EXT 行镜像的墙面，远景层相对近景层往上走时不露底。页面上它比主体层少动，近景层盖在它上面：
      台面后沿和物件的轮廓在墙上滑动，这就是纵深。
  远景软化 kitchen-friends-far-soft.webp
      远景层的模糊、低饱和、略亮版，画格在场时叠化进来（预烘，不每帧跑滤镜）。
  检查图 tools/planes_check.png：近景层叠在品红底上 / 远景层 / 分类结果（近景红、远景不变、蓝框是 ZONES）。

物件怎么抠（只在 ZONES 两个区域里，区域外的一切都是墙）：
  墙只有几种颜色——奶油色墙面、淡绿瓷砖（连同它们上面的影子），左区域上部还有吊柜的木头。先按颜色把像素分成"墙色"和
  "非墙色"，墨线（亮度 ≤ INK，加手工补的 BARRIERS）当边界，各自连成色块。碰到区域边（左区域的右边和上边、右区域的左边和
  上边；图片边缘和台面后沿不算）的色块是墙的一部分（墙面、瓷砖、吊柜底板、窗台）；被围在区域里的色块：瓷砖色的是墙，
  非墙色的是物件（木头的架子和篮子、绿叶子、红番茄……），奶油色的是物件（白罐子、盆、葱身子），除非 FAR_SEEDS 点到它；
  小色块（豆子、叶子之间的缝、瓷砖纹理里的斑点）看隔着墨线的邻居，一轮轮跟多数走。

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
# 站在台面上的东西只在这两个区域里找（x0, y0, x1, y1）：左 = 层板架 + 盆栽，右 = 菜篮 + 葱
ZONES = [(0, 95, 420, BACK), (1290, 270, 1672, BACK)]
CABINET_Y = 240  # 左区域里吊柜最低到这一行：这上面木头色的是吊柜（墙），这下面木头色的是架子（物件）
SILL_Y = 310  # 右区域里窗台最低到这一行：这上面木头色的小块是窗台的（看邻居），这下面的是篮子的（物件）
# 手工加的墨线（x0, y0, x1, y1）：葱的叶子是单独的角色层（friends-scallion-leaves.png），底图里那块是模糊补的瓷砖，
# 葱身子和它之间没有轮廓线，在角色层下沿画一条，把身子围起来
BARRIERS = [(1325, 522, 1470, 522)]
# 被围在区域里、但其实是墙的奶油色色块：给一个落在里面的点
FAR_SEEDS: list[tuple[int, int]] = []
# 强制归墙的区域（x0, y0, x1, y1）：葱叶子角色层下面那块模糊补的瓷砖，照旧留在远景层里（角色层盖住它）；补墙时也不拿它当来源
FAR_BOXES = [(1325, 373, 1440, 522)]
NO_SOURCE = [(1325, 373, 1470, 522), (190, 250, 360, 420)]  # 后一块是糖罐角色层下面补的那片木色，不能当墙面来源
SPLIT_X = 1385  # 葱身子和菜篮的分界（图片 x）
SCALLION_Y = 470  # 葱身子的最高一行（图片 y，叶子角色层在它上面）
SMALL = 1500  # 小于这个面积的色块看邻居
RING = 4  # 看邻居时向外看的像素
AVOID = 20  # 补墙的来源离物件至少这么远
SOFT = dict(blur=1.3, color=0.88, brightness=1.04, contrast=0.93)


def fill_rows(img: np.ndarray, hole: np.ndarray, usable: np.ndarray, feather: int = 6) -> np.ndarray:
    """逐行填洞：每个洞段从同一行最近的一段可用像素（取较长的一侧）从洞边起镜像铺满，两端与原像素线性过渡。"""
    out = img.copy()
    H, W = hole.shape
    for y in range(H):
        row = hole[y]
        if not row.any():
            continue
        ok = usable[y]
        x = 0
        while x < W:
            if not row[x]:
                x += 1
                continue
            a = x
            while x < W and row[x]:
                x += 1
            b = x  # 洞段 [a, b)
            l1 = a
            while l1 > 0 and not ok[l1 - 1]:
                l1 -= 1
            l0 = l1
            while l0 > 0 and ok[l0 - 1]:
                l0 -= 1
            r0 = b
            while r0 < W and not ok[r0]:
                r0 += 1
            r1 = r0
            while r1 < W and ok[r1]:
                r1 += 1
            left_len, right_len = l1 - l0, r1 - r0
            if left_len == 0 and right_len == 0:
                continue
            src = img[y, r0:r1] if right_len >= left_len else img[y, l0:l1][::-1]
            need = b - a
            reps = int(np.ceil(need / len(src))) + 1
            tile = np.concatenate([src if i % 2 == 0 else src[::-1] for i in range(reps)])[:need]
            seg = tile[::-1] if right_len >= left_len else tile
            out[y, a:b] = seg
            n = min(feather, need // 2)
            if n > 0:
                if a > 0:
                    w = np.linspace(0, 1, n + 2)[1:-1, None]
                    out[y, a : a + n] = img[y, a - 1] * (1 - w) + seg[:n] * w
                if b < W:
                    w = np.linspace(1, 0, n + 2)[1:-1, None]
                    out[y, b - n : b] = img[y, b] * (1 - w) + seg[need - n :] * w
    return out


# 蛋是金棕色细线描边，胡萝卜和葱原来是深棕黑的粗墨线，不是一个画风（2026-11-15 用户：蛋的边不动；蔬菜的描边要和各自本来的颜色相近、粗细和蛋差不多）。
# 做法：大块的墨线（轮廓，面积 ≥ min_area；眼睛、嘴是小块，保持深色）加粗 1 像素，每个轮廓像素取最近的“非墨线”像素的颜色，
# 压暗、略加饱和；线收细（INK_THIN）——绿叶的轮廓是深绿，白的葱身是暖棕，橙色胡萝卜是深橙。区域是图片像素 (x0, y0, x1, y1)。
INK_BOXES = [
    (1445, 320, 1565, 505),  # 胡萝卜（叶子 + 身子 + 手）
    (1296, 519, 1400, 710),  # 葱身子
]
LEAVES_SRC = ROOT / "source/bg-v3/friends-scallion-leaves.orig.png"  # 葱叶角色层原图（tools/prepare_friends.py 的输出备份）
LEAVES_PNG = ROOT / "public/assets/bg/friends-scallion-leaves.png"
INK_DARKEN, INK_SAT = 0.5, 1.4
INK_THIN = 1  # 线芯比原墨线内缩几像素（越大越细；原线约 3–4 像素宽）


def tinted_ink(rgb: np.ndarray, alpha: np.ndarray | None = None, min_area: int = 800) -> np.ndarray:
    """返回墨线换成“本色深色”后的 rgb（只改大块墨线）。alpha 给了就只看 alpha > 128 的像素（透明背景的角色图）。"""
    lum = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    hue = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)[..., 0] * 2
    greenish = (hue >= 60) & (hue <= 170)
    ink = (lum <= INK) & ~greenish
    if alpha is not None:
        ink &= alpha > 128
    lab, n = ndimage.label(ink)
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, a in enumerate(sizes) if a >= min_area])
    # 区域 R = 墨线外扩 1 像素；线芯 core = 墨线内缩 1 像素（比原线细 2 像素，和蛋利落的细描边接近）。
    # R 里先整体补回旁边的底色（抹掉原来的黑线），再在 core 上画本色的深色线
    region = ndimage.binary_dilation(keep, iterations=1)
    core = ndimage.binary_erosion(keep, iterations=INK_THIN)
    if alpha is not None:
        region &= alpha > 0
        core &= alpha > 0
    iy, ix = ndimage.distance_transform_edt(region, return_distances=False, return_indices=True)
    fill = cv2.GaussianBlur(rgb[iy, ix], (5, 5), 0).astype(np.float32)
    hsv = cv2.cvtColor(fill.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * INK_SAT + 25, 0, 255)
    hsv[..., 2] = hsv[..., 2] * INK_DARKEN
    tint = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB).astype(np.float32)
    wr = cv2.GaussianBlur(region.astype(np.float32), (3, 3), 0)[..., None]
    wc = cv2.GaussianBlur(core.astype(np.float32), (3, 3), 0)[..., None]
    painted = fill * (1 - wc) + tint * wc
    return np.clip(rgb.astype(np.float32) * (1 - wr) + painted * wr, 0, 255).astype(np.uint8)


def soften_ink(rgb: np.ndarray) -> np.ndarray:
    out = rgb.copy()
    for x0, y0, x1, y1 in INK_BOXES:
        out[y0:y1, x0:x1] = tinted_ink(rgb[y0:y1, x0:x1])
    return out


def tint_leaves() -> None:
    a = np.asarray(Image.open(LEAVES_SRC).convert("RGBA"))
    out = tinted_ink(a[..., :3], a[..., 3])
    Image.fromarray(np.dstack([out, a[..., 3]])).save(LEAVES_PNG, optimize=True)


def classify(rgb: np.ndarray) -> tuple[np.ndarray, dict]:
    """返回物件遮罩（台面后沿以上，True = 近景）和统计。"""
    H, W = rgb.shape[:2]
    lum = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    ink = lum <= INK
    for x0, y0, x1, y1 in BARRIERS:
        cv2.line(ink.view(np.uint8), (x0, y0), (x1, y1), 1, 1)
    ink = ndimage.binary_dilation(ink, iterations=1)
    hsv = cv2.cvtColor(cv2.GaussianBlur(rgb, (5, 5), 0), cv2.COLOR_RGB2HSV).astype(np.float32)
    h, s, v = hsv[..., 0] * 2, hsv[..., 1] / 255, hsv[..., 2] / 255
    cream = (s < 0.32) & (v > 0.68) & (h >= 15) & (h <= 65)
    tile = (s < 0.35) & (v > 0.55) & (h >= 60) & (h <= 180)
    wood = (s > 0.35) & (h >= 15) & (h <= 45)
    cabinet = wood.copy()
    cabinet[CABINET_Y:, :] = False
    cabinet[:, ZONES[0][2] :] = False
    wallc = (cream | tile | cabinet) & ~ink
    objc = ~wallc & ~ink
    region = np.ones((H, W), bool)
    region[BACK:, :] = False
    near = np.zeros((H, W), bool)
    far = np.zeros((H, W), bool)
    stats = dict(edge=0, tile=0, cream=0, seed=0, obj=0, small_near=0, small_far=0, lone=0)
    small = []

    def zone_of(sl):
        for z in ZONES:
            zx0, zy0, zx1, zy1 = z
            if sl[1].start >= zx0 and sl[1].stop <= zx1 and sl[0].start >= zy0 and sl[0].stop <= zy1:
                return z
        return None

    for kind, mask in (("wall", wallc & region), ("obj", objc & region)):
        lab, n = ndimage.label(mask)
        sizes = ndimage.sum(mask, lab, range(1, n + 1))
        for i, sl in enumerate(ndimage.find_objects(lab)):
            comp = lab[sl] == i + 1
            z = zone_of(sl)
            # 碰到区域边（图片边缘和台面后沿不算）的是墙的一部分
            touches = z is None or (z[0] > 0 and sl[1].start <= z[0]) or (z[2] < W and sl[1].stop >= z[2]) or sl[0].start <= z[1]
            if touches:
                far[sl] |= comp
                stats["edge"] += 1
                continue
            if sizes[i] < SMALL:
                # 非墙色的小块（叶子、番茄、豆子、篮子的碎片）直接归物件；只有吊柜和窗台那几行的木头色小块、墙色小块才看邻居
                wood_rows = (z is ZONES[0] and sl[0].start < CABINET_Y) or (z is ZONES[1] and sl[0].start < SILL_Y)
                if kind == "obj" and not (wood_rows and wood[sl][comp].mean() > 0.5):
                    near[sl] |= comp
                    stats["obj"] += 1
                else:
                    small.append((i, sl, lab))
                continue
            if kind == "wall":
                is_tile = tile[sl][comp].mean() > 0.5
                seeded = any(sl[0].start <= sy < sl[0].stop and sl[1].start <= sx < sl[1].stop and comp[sy - sl[0].start, sx - sl[1].start] for sx, sy in FAR_SEEDS)
                if is_tile or seeded:
                    far[sl] |= comp
                    stats["tile" if is_tile else "seed"] += 1
                else:
                    near[sl] |= comp
                    stats["cream"] += 1
            else:
                near[sl] |= comp
                stats["obj"] += 1
    # 小色块看隔着墨线的邻居，一轮轮传开
    pending = small
    changed = True
    while pending and changed:
        changed = False
        for item in list(pending):
            i, sl, lab = item
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
            pending.remove(item)
            changed = True
    for i, sl, lab in pending:
        near[sl] |= lab[sl] == i + 1
        stats["lone"] += 1
    # 区域里饱和的绿色一定是叶子（墙上没有饱和绿；窗外的树在区域外，葱叶子下面那块模糊瓷砖由 FAR_BOXES 收回）：
    # 糖罐角色层下面那片补的木色没有轮廓，和它糊在一起的叶子靠这条救回来
    green = (s > 0.4) & (v > 0.3) & (h >= 60) & (h <= 130) & region
    for zx0, zy0, zx1, zy1 in ZONES:
        near[zy0:zy1, zx0:zx1] |= green[zy0:zy1, zx0:zx1]
    # 墨线像素跟最近的非墨线像素走：物件的轮廓、罐子里深色的豆子影子归物件，吊柜的线归墙
    iy, ix = ndimage.distance_transform_edt(ink, return_distances=False, return_indices=True)
    near |= ink & near[iy, ix]
    for x0, y0, x1, y1 in FAR_BOXES:
        near[y0:y1, x0:x1] = False
    return ndimage.binary_dilation(near, iterations=2), stats  # 轮廓外再包 2 像素


def main() -> None:
    im = Image.open(SRC).convert("RGB")
    W, H = im.size
    rgb = np.asarray(im)
    objects, stats = classify(rgb)
    # 道具拆成独立图片（props-*.png，RGBA，裁到包围盒）：蛋要站上去、躲到后面，层序要能单独调。
    # 近景层只剩台面（后沿以下），道具不再在里面，页面上按同样位置另画（Backdrops planes.props）。
    # 切割线：左区域 x < 420 = 层板架（连罐子、盆栽、油瓶）；右区域 x ≥ SPLIT_X 且在葱身子之外 = 菜篮（连菜、格纹布）；
    # 右区域 x < SPLIT_X、y > SCALLION_Y 的是葱角色的身子（叶子是另一个角色层）。
    # 每个像素只属于一张切片（按位置硬分），透明度都来自整体羽化后的同一张 alpha，所以切片之间没有接缝
    # （各自羽化再叠会在分界线上露出底下的墙，是一条亮线）
    rgb = soften_ink(rgb)
    tint_leaves()
    yy, xx = np.mgrid[0:H, 0:W]
    full = cv2.GaussianBlur(objects.astype(np.float32), (3, 3), 0)
    part = full > 0
    left = part & (xx < ZONES[0][2])
    right = part & (xx >= ZONES[1][0])
    scallion = right & (xx < SPLIT_X) & (yy > SCALLION_Y)
    props = {"shelf": left, "scallion": scallion, "basket": right & ~scallion}
    prop_boxes = {}
    for name, m in props.items():
        a = full * m
        ys, xs = np.where(a > 0)
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        rgba = np.dstack([rgb, np.round(a * 255).astype(np.uint8)])[y0:y1, x0:x1]
        Image.fromarray(rgba).save(OUT / f"props-{name}.png", optimize=True)
        prop_boxes[name] = [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]
    near = np.zeros_like(objects)
    near[BACK:, :] = True

    # 近景层：台面 + 物件，边缘 3×3 羽化；裁到最高一行
    alpha = cv2.GaussianBlur(near.astype(np.float32), (3, 3), 0)
    top = int(np.argmax(alpha.max(1) > 0))
    near_rgba = np.dstack([rgb, np.round(alpha * 255).astype(np.uint8)])[top:]
    Image.fromarray(near_rgba).save(OUT / "kitchen-friends-near.webp", "WEBP", quality=92, method=6)

    # 远景层：物件处按同一行离物件远一点的墙面镜像补齐，后沿以下再补 EXT 行镜像的墙
    hole = ndimage.binary_dilation(objects, iterations=3)
    usable = ~ndimage.binary_dilation(objects, iterations=AVOID)
    for x0, y0, x1, y1 in NO_SOURCE:
        usable[y0:y1, x0:x1] = False
    far = fill_rows(rgb[:BACK].astype(np.float32), hole[:BACK], usable[:BACK])
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
    print(f"props.img = {prop_boxes}")
    print(f"near.img = [0, {top}, {W}, {H - top}]   far.img = [0, 0, {W}, {BACK + EXT}]")


if __name__ == "__main__":
    main()
