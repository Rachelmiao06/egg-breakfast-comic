#!/usr/bin/env python3
"""Split the clean kitchen painting into depth layers (feat/kitchen-layers).

Inputs (first existing path wins):
  clean kitchen : source/kitchen-clean.png, ~/Desktop/Clean watercolor kitchen with red skillet.png
  egg character : source/egg-jump.png,     ~/Desktop/Happy jumping fried egg character.png
  original      : source/kitchen-main.png (used to register the egg and lift the flame)

Outputs (all 1536x1024 RGBA, same canvas, same coordinates):
  public/assets/scene/back.png   wall + tiles (opaque, tiles rebuilt behind every object)
  public/assets/scene/mid.png    yellow pot, jars, kettle, green back counter
  public/assets/scene/main.png   red skillet, front stove, wooden table
  public/assets/scene/front.png  toast plate, eggshells, gingham cloth
  public/assets/scene/egg.png    the jumping egg, registered onto the original egg position
  public/assets/scene/flame.png  burner flame lifted from the original painting
  tools/check_overlay.png        layers recomposited vs clean image + diff
  tools/layers_preview.png       contact sheet of every layer

Run:  python3 tools/split_scene.py [--debug DIR]
Everything is deterministic (fixed RNG seed); re-running overwrites the outputs.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/assets/scene"
W, H = 1536, 1024
DESK = Path.home() / "Desktop"
RNG = np.random.default_rng(7)


def first(*paths: Path) -> Path:
    for p in paths:
        if p.exists():
            return p
    raise SystemExit(f"missing input, looked for: {[str(p) for p in paths]}")


def load_rgb(p: Path) -> np.ndarray:
    return np.asarray(Image.open(p).convert("RGB")).astype(np.float32)


# ---------------------------------------------------------------- masks

def poly_mask(points, shape=(H, W)) -> np.ndarray:
    m = Image.new("L", (shape[1], shape[0]), 0)
    ImageDraw.Draw(m).polygon([tuple(map(float, p)) for p in points], fill=255)
    return np.asarray(m) > 0


def grabcut(img: np.ndarray, rect, sure_fg=None, sure_bg=None, iters=6) -> np.ndarray:
    """GrabCut inside rect, optional hard hints. Returns bool mask (full canvas)."""
    x0, y0, x1, y1 = rect
    m = np.full((H, W), cv2.GC_BGD, np.uint8)
    m[y0:y1, x0:x1] = cv2.GC_PR_FGD
    if sure_bg is not None:
        m[sure_bg] = cv2.GC_BGD
    if sure_fg is not None:
        m[sure_fg] = cv2.GC_FGD
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    bgr = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2BGR)
    cv2.grabCut(bgr, m, None, bgd, fgd, iters, cv2.GC_INIT_WITH_MASK)
    return (m == cv2.GC_FGD) | (m == cv2.GC_PR_FGD)


def band_refine(img, poly, band=10, rect_pad=20, extra_fg=None, extra_bg=None, inner=None) -> np.ndarray:
    """Hand polygon -> exact outline: deep inside polygon = FG, outside dilated polygon = BG,
    the band in between is decided by GrabCut so the cut follows the painted outline."""
    pm = poly_mask(poly).astype(np.uint8)
    inner = inner or band * 3
    kf = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * inner + 1, 2 * inner + 1))
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * band + 1, 2 * band + 1))
    fg = cv2.erode(pm, kf) > 0
    bg = cv2.dilate(pm, k) == 0
    if extra_fg is not None:
        fg |= extra_fg
    if extra_bg is not None:  # explicit background (e.g. wall seen through a handle) always wins
        bg |= extra_bg
        fg &= ~extra_bg
    ys, xs = np.nonzero(pm)
    rect = (max(0, xs.min() - rect_pad), max(0, ys.min() - rect_pad),
            min(W, xs.max() + rect_pad), min(H, ys.max() + rect_pad))
    return clean_mask(grabcut(img, rect, fg, bg))


def clean_mask(m: np.ndarray, close=5) -> np.ndarray:
    m = m.astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close, close))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    keep = np.zeros_like(m)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] > 400:
            keep[lab == i] = 1
    return keep > 0


def fill_holes(m: np.ndarray) -> np.ndarray:
    inv = (~m).astype(np.uint8)
    n, lab = cv2.connectedComponents(inv, 4)
    out = m.copy()
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    for i in range(1, n):
        if i not in border:
            out[lab == i] = True
    return out


def soft(m: np.ndarray, grow=1, feather=1.2) -> np.ndarray:
    """Bool mask -> float alpha with a 1-2px feathered edge (outline kept inside)."""
    a = m.astype(np.uint8)
    if grow:
        a = cv2.dilate(a, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * grow + 1, 2 * grow + 1)))
    a = cv2.GaussianBlur(a.astype(np.float32), (0, 0), feather)
    return np.clip(a, 0, 1)


def build_masks(img: np.ndarray) -> dict[str, np.ndarray]:
    M: dict[str, np.ndarray] = {}

    # ---- mid objects (stand in front of the tiles)
    M["pot"] = band_refine(img, [
        (0, 418), (60, 410), (66, 396), (56, 380), (62, 352), (82, 336), (98, 318), (118, 302),
        (150, 293), (172, 300), (195, 302), (215, 318), (240, 326), (258, 345), (265, 358),
        (300, 358), (318, 350), (322, 325), (340, 308), (358, 312), (378, 318), (395, 332),
        (402, 350), (408, 372), (416, 398), (418, 470), (410, 560), (392, 600), (300, 612),
        (140, 612), (75, 595), (68, 470), (20, 470), (0, 470)], band=6, inner=16)
    M["jars"] = band_refine(img, [
        (930, 372), (950, 362), (1010, 362), (1012, 372), (1022, 350), (1092, 350), (1094, 385),
        (1112, 370), (1118, 358), (1152, 358), (1158, 372), (1162, 388), (1200, 400), (1206, 500), (1180, 518), (1100, 518),
        (1060, 506), (1020, 506), (930, 506), (928, 440)], band=8)
    kettle = band_refine(img, [
        (1183, 322), (1187, 313), (1200, 309), (1230, 306), (1258, 322), (1262, 262), (1275, 226), (1298, 206), (1302, 182),
        (1318, 172), (1450, 170), (1466, 184), (1470, 204), (1492, 216), (1504, 250), (1506, 300),
        (1502, 336), (1518, 368), (1530, 405), (1536, 435), (1536, 485), (1530, 512), (1516, 536), (1484, 552), (1250, 548),
        (1238, 520), (1236, 470), (1222, 420), (1205, 370)], band=6, inner=18,
        extra_bg=poly_mask([(1284, 322), (1282, 266), (1293, 238), (1312, 222), (1450, 222),
                            (1466, 234), (1478, 256), (1482, 300), (1476, 316), (1462, 316),
                            (1445, 302), (1426, 294), (1422, 280), (1420, 264), (1408, 254),
                            (1378, 254), (1366, 264), (1364, 286), (1340, 296), (1312, 306),
                            (1297, 320)]))
    # keep only the outer ring of the handle loop, never the wall seen through it
    M["kettle"] = kettle

    # ---- main: skillet, front stove (upper part sticks above the table), table
    M["pan"] = band_refine(img, [
        (352, 580), (380, 530), (470, 508), (700, 500), (950, 505), (1060, 520), (1105, 560),
        (1180, 548), (1230, 520), (1440, 515), (1480, 535), (1478, 575), (1440, 590), (1190, 618),
        (1120, 650), (1060, 690), (900, 742), (700, 750), (500, 735), (400, 700), (360, 640)], band=10)
    M["stove_top"] = band_refine(img, [
        (346, 790), (352, 705), (372, 688), (1085, 688), (1103, 705), (1112, 790)], band=8)
    # table: wood below the counter's bottom edge; detect that edge per column
    M["table"] = table_mask(img)

    # ---- front objects
    M["plate"] = band_refine(img, [
        (0, 828), (60, 812), (160, 806), (260, 812), (360, 830), (420, 870), (452, 940), (455, 1024),
        (0, 1024)], band=10)
    M["shells"] = band_refine(img, [
        (1135, 920), (1150, 870), (1200, 840), (1255, 850), (1290, 880), (1300, 860), (1350, 835),
        (1400, 845), (1435, 880), (1445, 950), (1420, 1000), (1360, 1012), (1300, 995), (1240, 1012),
        (1170, 1000), (1135, 960)], band=9)
    M["cloth"] = band_refine(img, [
        (1236, 795), (1244, 762), (1262, 746), (1330, 730), (1420, 705), (1536, 676), (1536, 940),
        (1500, 912), (1460, 888), (1420, 862), (1380, 850), (1335, 846), (1290, 826), (1250, 810)],
        band=7, inner=18)
    for k in ("plate", "shells", "cloth", "pot", "jars", "kettle"):
        M[k] = dil(M[k], 2)  # keep the whole painted outline with its object
    return M


def table_mask(img: np.ndarray) -> np.ndarray:
    """Per column: first row (720..800) where the wood (orange) starts below the green counter."""
    hsv = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    hue, sat = hsv[..., 0], hsv[..., 1]
    wood = (hue < 22) & (sat > 90)
    edge = np.full(W, 757, np.int32)
    for x in range(W):
        col = wood[720:800, x]
        # first run of 6 wood pixels
        run = np.convolve(col.astype(np.int32), np.ones(6, np.int32), "valid")
        idx = np.nonzero(run >= 6)[0]
        if len(idx):
            edge[x] = 720 + idx[0]
    # columns hidden by stove/cloth/pot: robust smooth line
    good = np.abs(edge - 757) < 8  # red pan / cloth columns would read as wood near y 720
    xs = np.arange(W)
    fit = np.polyfit(xs[good], edge[good], 1)
    line = np.polyval(fit, xs)
    edge = np.where(good, edge, np.round(line)).astype(np.int32)
    edge = cv2.blur(edge.reshape(1, -1).astype(np.float32), (31, 1)).ravel()
    # include the dark bottom edge line of the counter (3px above wood)
    edge = np.round(edge - 3).astype(np.int32)
    yy = np.arange(H)[:, None]
    return yy >= edge[None, :]


# ---------------------------------------------------------------- fills

class Quilter:
    """Fill a hole by copying painted patches from visible pixels of the *same rows*
    (optionally a small vertical shift). Every structure in this painting that we
    rebuild runs horizontally (wall gradient, tile rows, counter bands, wood grain),
    so same-row copies keep the structure; tile rows additionally snap the copy
    offset to the tile period so grout lines stay aligned."""

    def __init__(self, img: np.ndarray, src_ok: np.ndarray):
        self.img = img
        self.ok = src_ok.astype(np.int32)
        self.ii = np.pad(self.ok, ((1, 0), (1, 0))).cumsum(0).cumsum(1)

    def frac_ok(self, x, y, w, h):
        if x < 0 or y < 0 or x + w > W or y + h > H:
            return 0.0
        ii = self.ii
        s = ii[y + h, x + w] - ii[y, x + w] - ii[y + h, x] + ii[y, x]
        return s / float(w * h)

    def fill(self, hole, y0, y1, pw=72, bh=None, overlap=18, period=None, dys=(0,),
             need=0.995, out=None, acc=None):
        img = self.img
        if out is None:
            out = np.zeros_like(img)
            acc = np.zeros((H, W), np.float32)
        bh = bh or (y1 - y0)
        ys = list(range(y0, y1, max(1, bh - overlap))) if bh < (y1 - y0) else [y0]
        cols = np.nonzero(hole[y0:y1].any(0))[0]
        if len(cols) == 0:
            return out, acc
        xa, xb = cols.min() - overlap, cols.max() + overlap
        for by in ys:
            hh = min(bh, y1 - by)
            if hh <= 2:
                continue
            for px in range(xa, xb, pw - overlap):
                ww = pw
                x_lo, x_hi = max(0, px), min(W, px + ww)
                if x_hi - x_lo < 4 or not hole[by:by + hh, x_lo:x_hi].any():
                    continue
                src = self._pick(px, by, ww, hh, period, dys, need)
                if src is None:
                    continue
                sx, sy = src
                # weights: linear ramps on all sides for seamless overlap
                wx = np.minimum(np.arange(ww) + 1, np.arange(ww)[::-1] + 1).astype(np.float32)
                wx = np.clip(wx / overlap, 0.02, 1)
                wy = np.minimum(np.arange(hh) + 1, np.arange(hh)[::-1] + 1).astype(np.float32)
                wy = np.clip(wy / max(1, overlap), 0.02, 1) if len(ys) > 1 else np.ones(hh, np.float32)
                wgt = wy[:, None] * wx[None, :]
                # clip to canvas
                cx0, cx1 = max(0, px), min(W, px + ww)
                ox0 = cx0 - px
                patch = img[sy:sy + hh, sx + ox0:sx + ox0 + (cx1 - cx0)]
                wg = wgt[:, ox0:ox0 + (cx1 - cx0)]
                out[by:by + hh, cx0:cx1] += patch * wg[..., None]
                acc[by:by + hh, cx0:cx1] += wg
        return out, acc

    def _pick(self, px, by, ww, hh, period, dys, need):
        for dy in sorted(dys, key=abs):
            sy = by + dy
            if sy < 0 or sy + hh > H:
                continue
            if period:
                for k in sorted([k for k in range(-12, 13) if k], key=abs):
                    sx = int(round(px + k * period))
                    if self.frac_ok(sx, sy, ww, hh) >= need:
                        return sx, sy
            else:
                cand = [sx for sx in range(0, W - ww, 3)
                        if abs(sx - px) > ww and self.frac_ok(sx, sy, ww, hh) >= need]
                if cand:
                    return int(RNG.choice(cand)), sy
        return None


def pushpull(v: np.ndarray, m: np.ndarray) -> np.ndarray:
    """Smoothly extend values known on mask m to the whole image (pyramid push-pull)."""
    w = m.astype(np.float32)
    vw = v * w[..., None]
    stack = []
    while min(w.shape) > 4:
        stack.append((vw, w))
        h2, w2 = (w.shape[0] + 1) // 2, (w.shape[1] + 1) // 2
        vw = cv2.resize(vw, (w2, h2), interpolation=cv2.INTER_AREA)
        w = cv2.resize(w, (w2, h2), interpolation=cv2.INTER_AREA)
    val = vw / np.maximum(w, 1e-6)[..., None]
    for vw_f, w_f in reversed(stack):
        up = cv2.resize(val, (w_f.shape[1], w_f.shape[0]), interpolation=cv2.INTER_LINEAR)
        a = np.clip(w_f * 2, 0, 1)[..., None]
        val = a * (vw_f / np.maximum(w_f, 1e-6)[..., None]) + (1 - a) * up
    return val


def finish(img, hole, out, acc, ring=4):
    """Write quilted pixels into hole and remove colour drift: the mismatch measured on a
    thin ring just outside the hole is diffused smoothly across it (membrane correction)."""
    res = img.copy()
    have = acc > 1e-3
    q = img.copy()
    q[have] = out[have] / acc[have][:, None]
    rim = dil(hole, ring) & ~hole & have
    d = np.zeros_like(img)
    d[rim] = img[rim] - q[rim]
    corr = pushpull(cv2.GaussianBlur(d, (0, 0), 1.5), rim)
    corr = cv2.GaussianBlur(corr, (0, 0), 6)
    q = q + corr
    miss = hole & ~have
    if miss.any():  # anything the quilter could not reach: plain inpaint (reported)
        print(f"  inpaint fallback for {int(miss.sum())} px")
        q8 = cv2.inpaint(np.clip(q, 0, 255).astype(np.uint8), miss.astype(np.uint8) * 255, 5, cv2.INPAINT_TELEA)
        q[miss] = q8[miss]
    res[hole] = q[hole]
    return res


def dil(m, r):
    return cv2.dilate(m.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))) > 0


def mid_region() -> np.ndarray:
    """Back counter + left hob: everything from the counter's back edge down to just under
    the table edge (the extra rows hide seams when the table layer shifts)."""
    return poly_mask([(8, 800), (8, 660), (14, 630), (26, 600), (45, 582), (75, 576), (120, 575),
                      (120, 501), (1536, 501), (1536, 800)])


def grout_columns(img, ok, y0, y1, x_lo, x_hi):
    """Vertical grout x positions in one tile row, measured where the row is visible."""
    L = img.mean(2)
    band = ok[y0 + 8:y1 - 8, :].all(0)
    prof = L[y0 + 8:y1 - 8].mean(0)
    xs = []
    for x in range(x_lo + 3, x_hi - 3):
        if not band[x - 3:x + 4].all():
            continue
        loc = prof[max(0, x - 40):x + 40]
        if prof[x] == prof[x - 3:x + 4].max() and prof[x] > np.median(loc) + 12:
            if not xs or x - xs[-1] > 60:
                xs.append(x)
    # keep the longest chain of plausible tile widths (stray strokes are not joints)
    best, cur = [], []
    for x in xs:
        if cur and 115 <= x - cur[-1] <= 160:
            cur.append(x)
        else:
            cur = [x]
        if len(cur) > len(best):
            best = list(cur)
    return best


def tile_cells(img, back, hole, ok, y0, y1, grouts):
    """Rebuild one tile row cell by cell: extend the measured grout grid with the mean
    period, then paste whole visible cells (joint to joint, resampled to the target
    width) into hidden cells. Joints therefore always land on the grid."""
    g = list(grouts)
    period = (g[-1] - g[0]) / (len(g) - 1)
    while g[0] > -period:
        g.insert(0, g[0] - period)
    while g[-1] < W + period:
        g.append(g[-1] + period)
    cells = [(int(round(a)) - 3, int(round(b)) - 3) for a, b in zip(g[:-1], g[1:])]
    hh = y1 - y0
    src = [(a, b) for a, b in cells if a >= 0 and b <= W and ok[y0:min(y1, 494), a:b].mean() > 0.985]
    assert src, (y0, y1, cells)
    out = np.zeros_like(img)
    acc = np.zeros((H, W), np.float32)
    last = None
    for a, b in cells:
        ca, cb = max(0, a), min(W, b)
        if cb <= ca or not hole[y0:y1, ca:cb].any():
            continue
        choices = [c for c in src if c != last] or src
        sa, sb = choices[int(RNG.integers(len(choices)))]
        last = (sa, sb)
        cell = cv2.resize(img[y0:y1, sa:sb], (b - a, hh), interpolation=cv2.INTER_LINEAR)
        out[y0:y1, ca:cb] = cell[:, ca - a:cb - a]
        acc[y0:y1, ca:cb] = 1
    return out, acc


def build_back(img, M):
    covered = M["pot"] | M["jars"] | M["kettle"] | M["pan"] | M["stove_top"] | M["table"] \
        | M["plate"] | M["shells"] | M["cloth"] | mid_region()
    hole = dil(covered, 4)
    ok = ~hole
    Y = np.arange(H)[:, None]
    hole_top = hole & (Y < 501)
    back = img.copy()
    # wall above the tiles (kettle top sticks into it)
    Q = Quilter(img, ok)
    out, acc = Q.fill(dil(hole_top, 6) & (Y < 266), 120, 266, pw=90, overlap=24, dys=(0, -10, 10, -20, 20))
    back = finish(back, hole_top & (Y < 266), out, acc)
    # tile rows (y ranges run grout-centre to grout-centre)
    rows = [(266, 354), (354, 440), (440, 501)]
    for y0, y1 in rows:
        g = grout_columns(img, ok, y0, y1, 0, W)
        print(f"  tile row {y0}-{y1}: grouts {g}")
        sel = hole_top & (Y >= y0) & (Y < y1)
        out, acc = tile_cells(img, back, dil(sel, 6) & (Y >= y0) & (Y < y1), ok, y0, y1, g)
        back = finish(back, sel, out, acc)
    # below the counter edge nothing of the back layer is ever visible: repeat the two
    # lower tile rows downward so the layer is complete (and plausible if ever exposed)
    band = back[354:501].copy()
    y = 501
    while y < H:
        h = min(band.shape[0], H - y)
        sel = hole[y:y + h]
        back[y:y + h][sel] = band[:h][sel]
        y += band.shape[0]
    return back


def build_mid(img, M, region):
    objs = M["pot"] | M["jars"] | M["kettle"]
    occl = M["pan"] | M["stove_top"] | M["table"] | M["plate"] | M["shells"] | M["cloth"]
    occl = dil(occl, 3)
    mid = img.copy()

    # 1) pot: its right bottom corner and the grate are hidden by the skillet rim.
    #    The pot is a cylinder: mirror the left half about its axis (x = 240).
    axis = 240
    X = np.arange(W)[None, :]
    Y = np.arange(H)[:, None]
    hidden_pot = occl & (X > axis) & (X < 472) & (Y > 470) & (Y < 700)
    ys, xs = np.nonzero(hidden_pot)
    mx = 2 * axis - xs
    keep = mx >= 0
    mid[ys[keep], xs[keep]] = img[ys[keep], mx[keep]]
    pot_mirror = np.zeros((H, W), bool)
    pot_mirror[ys[keep], xs[keep]] = True
    pot_ext = np.zeros_like(M["pot"])
    pot_ext[:, axis:2 * axis + 1] = M["pot"][:, :axis + 1][:, ::-1]
    pot_full = M["pot"] | (pot_ext & hidden_pot)

    # 2) counter behind skillet / stove / cloth. The counter is a stack of horizontal
    #    bands; each band is rebuilt only from visible pixels of the same band.
    hole = region & occl & ~pot_mirror
    vis = region & ~occl & ~dil(objs, 2)
    vis[:, :10] = False
    zones = [  # (y0, y1, allowed vertical shifts, source x-min)
        (501, 630, tuple(range(-60, 61, 6)), 410),   # top surface
        (628, 648, (0, -2, 2), 410),                 # light front edge
        (646, 757, tuple(range(-50, 51, 5)), 10),    # face (left hob face is the same paint)
    ]
    out = np.zeros_like(img)
    acc = np.zeros((H, W), np.float32)
    hd = dil(hole, 6) & region
    for y0, y1, dys, xmin in zones:
        ok = vis & (Y >= y0) & (Y < y1) & (X > xmin)
        Q = Quilter(mid, ok)
        out, acc = Q.fill(hd, y0, y1, pw=56, bh=min(24, y1 - y0), overlap=14, dys=dys,
                          need=0.98, out=out, acc=acc)
    mid = finish(mid, hole & (Y < 757), out, acc)
    # rows hidden under the table edge: mirror the face upward (never seen at rest)
    for i in range(757, 800):
        r = 2 * 752 - i
        sel = region[i]
        mid[i, sel] = mid[r, sel]

    # 3) kettle bottom hidden by the skillet handle (x 1240-1480, y 515-550): continue the
    #    kettle body downward from the rows just above the handle, column by column.
    kb = occl & (np.arange(H)[:, None] < 552) & (np.arange(H)[:, None] > 505) \
        & (np.arange(W)[None, :] > 1236) & (np.arange(W)[None, :] < 1512)
    kettle_full = M["kettle"] | kb
    for x in np.nonzero(kb.any(0))[0]:
        col = np.nonzero(kb[:, x])[0]
        top = col.min()
        src = mid[max(0, top - 14):top - 2, x]
        if len(src):
            reps = int(np.ceil(len(col) / len(src)))
            mid[col, x] = np.concatenate([src[::-1], src] * reps)[:len(col)]
    alpha_m = region | objs | pot_full | kettle_full
    return mid, alpha_m


def reflect_fill(img, hole, ok, y0, y1, bh=28, overlap=10, min_w=90, max_dy=160):
    """Fill horizontally-grained paint (wood): per row band find a fully visible column
    span (same rows, or the nearest rows above/below) and extend it across the hole by
    mirror tiling, which keeps every grain line continuous at the joins."""
    out = np.zeros_like(img)
    acc = np.zeros((H, W), np.float32)
    cols_all = np.nonzero(hole[y0:y1].any(0))[0]
    if len(cols_all) == 0:
        return out, acc
    for by in range(y0, y1, bh - overlap):
        hh = min(bh, H - by)
        tgt = hole[by:by + hh]
        if hh < 4 or not tgt.any():
            continue
        best = None
        for dy in sorted(range(-max_dy, max_dy + 1, 4), key=abs):
            sy = by + dy
            if sy < 0 or sy + hh > H:
                continue
            colok = ok[sy:sy + hh].all(0)
            # widest run of fully visible columns
            run, start, bw = 0, 0, (0, 0)
            for x in range(W):
                if colok[x]:
                    run += 1
                    if run > bw[1] - bw[0]:
                        bw = (x - run + 1, x + 1)
                else:
                    run = 0
            if bw[1] - bw[0] >= min_w:
                best = (sy, bw)
                break
        if best is None:
            continue
        sy, (sa, sb) = best
        sa, sb = sa + 2, sb - 2
        wspan = sb - sa
        xs = np.arange(W)
        t = np.mod(xs - sa, 2 * wspan)
        sx = sa + np.where(t < wspan, t, 2 * wspan - 1 - t)
        band = img[sy:sy + hh][:, sx]
        wy = np.minimum(np.arange(hh) + 1, np.arange(hh)[::-1] + 1).astype(np.float32)
        wy = np.clip(wy / overlap, 0.02, 1)
        out[by:by + hh] += band * wy[:, None, None]
        acc[by:by + hh] += wy[:, None]
    return out, acc


def build_main(img, M):
    main_m = M["pan"] | M["stove_top"] | M["table"]
    occl = dil(M["plate"] | M["shells"] | M["cloth"], 3)
    hole = M["table"] & occl
    ok = M["table"] & ~occl & ~dil(M["stove_top"] | M["pan"], 2) & ~dil(stove_body_mask(), 3)
    out, acc = reflect_fill(img, dil(hole, 6), ok, 754, H)
    main = finish(img, hole, out, acc)
    return main, main_m


def stove_body_mask():
    return poly_mask([(330, 820), (346, 700), (372, 688), (1085, 688), (1105, 700), (1120, 820),
                      (1120, 945), (1095, 985), (1010, 985), (1000, 950), (530, 950), (520, 985),
                      (445, 985), (430, 948), (335, 945)])


def rgba(rgb, a):
    a8 = np.round(np.clip(a, 0, 1) * 255)
    rgb = np.where((a8 > 0)[..., None], np.clip(rgb, 0, 255), 0)  # empty pixels compress to nothing
    return np.dstack([rgb, a8]).astype(np.uint8)


def debug_masks(img, M, path):
    vis = img.copy()
    colors = {"pot": (255, 0, 0), "jars": (255, 128, 0), "kettle": (255, 0, 255), "pan": (0, 0, 255),
              "stove_top": (0, 255, 255), "table": (0, 255, 0), "plate": (255, 255, 0),
              "shells": (128, 0, 255), "cloth": (0, 128, 128)}
    for k, m in M.items():
        c = np.array(colors.get(k, (255, 255, 255)), np.float32)
        vis[m] = vis[m] * 0.55 + c * 0.45
        cnts, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
        cv2.drawContours(vis, cnts, -1, c.tolist(), 1)
    Image.fromarray(vis.astype(np.uint8)).save(path)


def pan_interior(img, pan):
    """Dark cooking surface inside the skillet -> fitted ellipse (cx, cy, ax, ay, angle)."""
    L = img.mean(2)
    hsv = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2HSV)
    dark = pan & (L < 135) & (hsv[..., 1] < 140) & (np.arange(W)[None, :] < 1110)
    dark = cv2.morphologyEx(dark.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(dark, 8)
    i = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    cnts, _ = cv2.findContours((lab == i).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    return cv2.fitEllipse(max(cnts, key=cv2.contourArea)), lab == i


def build_rim(img, M):
    """Occluder for the egg: the near half of the skillet (front lip + red outer wall).
    Everything of the pan that lies outside the cooking-surface ellipse and below its
    centre line, so an egg drawn between main and rim looks like it sits *in* the pan."""
    (cx, cy), (aw, ah), ang = pan_interior(img, M["pan"])[0]
    inner = np.zeros((H, W), np.uint8)
    cv2.ellipse(inner, ((cx, cy), (aw, ah), ang), 1, -1)
    rim = M["pan"] & (inner == 0) & (np.arange(H)[:, None] > cy) & (np.arange(W)[None, :] < 1120)
    return rim, (cx, cy, aw, ah, ang)


def lift_flame(orig, clean):
    """Flame = pixels where the original painting differs from the clean one around the
    burner; colour from the original, alpha from the difference (soft key)."""
    d = np.abs(orig - clean).max(2)
    box = np.zeros((H, W), bool)
    box[722:800, 580:880] = True
    hsv = cv2.cvtColor(orig.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    hot = ((hsv[..., 0] < 32) | ((hsv[..., 0] > 95) & (hsv[..., 0] < 130))) & (hsv[..., 1] > 70)
    a = np.clip((d - 28) / 60.0, 0, 1) * box * (hot | (d > 90))
    a = cv2.GaussianBlur(a.astype(np.float32), (0, 0), 0.8)
    return rgba(orig, a), a


def sheet(layers: dict[str, np.ndarray], path: Path, cols=3, tw=512):
    th = tw * H // W
    rows = (len(layers) + cols - 1) // cols
    out = Image.new("RGB", (cols * tw + (cols + 1) * 12, rows * (th + 34) + 12), (250, 247, 240))
    d = ImageDraw.Draw(out)
    for i, (name, im) in enumerate(layers.items()):
        r, c = divmod(i, cols)
        x, y = 12 + c * (tw + 12), 12 + r * (th + 34)
        checker = np.indices((th, tw)).sum(0) // 12 % 2
        bg = np.where(checker[..., None], 205, 235).astype(np.uint8).repeat(3, 2)
        t = Image.fromarray(im).resize((tw, th), Image.LANCZOS)
        base = Image.fromarray(bg).convert("RGBA")
        base.alpha_composite(t.convert("RGBA"))
        out.paste(base.convert("RGB"), (x, y))
        d.text((x, y + th + 6), name, fill=(60, 40, 30))
    out.save(path)


def composite(layers):
    acc = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    for im in layers:
        acc.alpha_composite(Image.fromarray(im))
    return np.asarray(acc.convert("RGB")).astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--debug", default=None)
    args = ap.parse_args()
    clean_p = first(ROOT / "source/kitchen-clean.png", DESK / "Clean watercolor kitchen with red skillet.png")
    img = load_rgb(clean_p)
    orig = load_rgb(first(ROOT / "source/kitchen-main.png"))
    assert img.shape[:2] == (H, W), img.shape
    print("masks ...")
    M = build_masks(img)
    if args.debug:
        os.makedirs(args.debug, exist_ok=True)
        debug_masks(img, M, Path(args.debug) / "masks.png")
    print("back ...")
    back = build_back(img, M)
    print("mid ...")
    region = mid_region()
    mid, mid_m = build_mid(img, M, region)
    print("main ...")
    main_rgb, main_m = build_main(img, M)
    rim_m, ell = build_rim(img, M)
    front_m = M["plate"] | M["shells"] | M["cloth"]
    flame, _ = lift_flame(orig, img)

    L = {
        "back": rgba(back, np.ones((H, W), np.float32)),
        "mid": rgba(mid, soft(mid_m)),
        "main": rgba(main_rgb, soft(main_m)),
        "pan-rim": rgba(img, soft(rim_m, grow=0, feather=0.8)),
        "front": rgba(img, soft(front_m)),
        "flame": flame,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    for k, v in L.items():
        Image.fromarray(v).save(OUT / f"{k}.png", optimize=True)
    # stale outputs from the earlier plan
    for stale in ("egg.png",):
        if (OUT / stale).exists():
            (OUT / stale).unlink()

    # ---- checks
    comp = composite([L["back"], L["mid"], L["main"], L["pan-rim"], L["front"]])
    diff = np.abs(comp - img).max(2)
    print(f"recomposite vs clean: mean {diff.mean():.3f}, max {diff.max():.0f}, >8: {(diff > 8).sum()} px")
    with_flame = composite([L["back"], L["mid"], L["main"], L["flame"], L["pan-rim"], L["front"]])
    dv = np.clip(diff * 8, 0, 255).astype(np.uint8)
    tw, th = 768, 512
    chk = Image.new("RGB", (tw * 2 + 36, th * 2 + 80), (250, 247, 240))
    d = ImageDraw.Draw(chk)
    for (i, (name, im)) in enumerate([("clean source", img), ("layers recomposited", comp),
                                      ("|difference| x8 (black = identical)", np.dstack([dv] * 3)),
                                      ("recomposited + flame", with_flame)]):
        r, c = divmod(i, 2)
        chk.paste(Image.fromarray(np.clip(im, 0, 255).astype(np.uint8)).resize((tw, th), Image.LANCZOS),
                  (12 + c * (tw + 12), 12 + r * (th + 28)))
        d.text((12 + c * (tw + 12), 12 + r * (th + 28) + th + 6), name, fill=(60, 40, 30))
    chk.save(ROOT / "tools/check_overlay.png")
    sheet(L, ROOT / "tools/layers_preview.png")
    cx, cy, aw, ah, ang = ell
    print(f"pan cooking surface ellipse: centre ({cx:.0f},{cy:.0f}) axes ({aw:.0f},{ah:.0f}) angle {ang:.1f}")
    ys, xs = np.nonzero(rim_m)
    print(f"pan rim box: [{xs.min()}, {ys.min()}, {xs.max()}, {ys.max()}]")
    for k in ("pan", "stove_top", "plate", "shells", "cloth", "kettle", "pot", "jars"):
        ys, xs = np.nonzero(M[k])
        print(f"  {k:10s} box [{xs.min()}, {ys.min()}, {xs.max()}, {ys.max()}]")
    fy, fx = np.nonzero(L["flame"][..., 3] > 40)
    print(f"  flame      box [{fx.min()}, {fy.min()}, {fx.max()}, {fy.max()}]")


if __name__ == "__main__":
    main()
