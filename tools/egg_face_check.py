#!/usr/bin/env python3
"""
Check (and optionally install) a face variant of the active egg against the original.

    python3 -I tools/egg_face_check.py <candidate.png> --kind fly|rest [--out DIR] [--install raw|composite]

The variant may change only the face. Each measurement overlays the candidate on the original; nothing is assumed from the prompt:
  - canvas size and transparency (RGBA, same 776x775 canvas)
  - silhouette: alpha masks XOR (outline, arms, feet), max alpha difference
  - foot anchor: bottom-centre of the alpha bounding box (the feet and the right hand touch the canvas edge, so a shift
    is mainly caught by the silhouette XOR)
  - outside-face pixels: share of opaque pixels outside the face zone whose colour moved more than a tolerance
  - yolk: yolk mask IoU and centre offset (the face must sit on the same yolk)
Outputs (in --out): <kind>-overlay.png (onion skin + changed-pixel map + silhouette XOR), <kind>-report.json.

--install raw        copy the candidate as public/assets/scene/egg-<kind>.png and point slots.json egg.faces.<kind> at it
                     (refused unless every check passes)
--install composite  original outside the face zone + candidate inside it (feathered inside the yolk), so the outline is
                     the original pixel for pixel; refused if the yolk moved or the seam in the feather band is visible.
"""
import argparse, json, os, shutil, sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG = os.path.join(ROOT, "public/assets/scene/egg.webp")
SLOTS = os.path.join(ROOT, "src/app/preview/visual/slots.json")

TOL_RGB = 10          # per-channel colour change counted as "changed" (a direct swap shows even small tone shifts)
MAX_OUT_MEAN = 2.0    # mean colour difference outside the face zone
MAX_OUT_CHANGED = 0.01  # at most 1% of opaque pixels outside the face zone may change
MAX_XOR = 0.004       # silhouette XOR / silhouette area
MAX_FOOT_PX = 2
MIN_YOLK_IOU = 0.95
MAX_YOLK_SHIFT = 4
MAX_SEAM = 10.0       # mean RGB difference in the feather band (composite)


def yolk_mask(rgba):
    r, g, b, a = [rgba[..., i].astype(int) for i in range(4)]
    m = (a > 200) & (r > 200) & (g > 120) & (g < 205) & (b < 110) & (r - b > 120)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    if n < 2:
        return np.zeros(m.shape, bool)
    k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    m = (lab == k).astype(np.uint8)
    # fill holes (eyes, mouth, blush sit inside the yolk)
    ff = m.copy(); h, w = ff.shape; mask = np.zeros((h + 2, w + 2), np.uint8); cv2.floodFill(ff, mask, (0, 0), 1)
    return (m | (1 - ff)).astype(bool)


def foot(alpha):
    ys, xs = np.nonzero(alpha > 128)
    return float((xs.min() + xs.max()) / 2), float(ys.max())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("candidate")
    ap.add_argument("--kind", required=True, choices=["fly", "rest"])
    ap.add_argument("--out", default=".")
    ap.add_argument("--install", choices=["raw", "composite"])
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    o = np.asarray(Image.open(ORIG).convert("RGBA"))
    cimg = Image.open(args.candidate)
    rep = {"candidate": os.path.abspath(args.candidate), "kind": args.kind, "mode": cimg.mode, "size": list(cimg.size), "orig_size": [o.shape[1], o.shape[0]]}
    checks = {}
    checks["same_canvas"] = list(cimg.size) == [o.shape[1], o.shape[0]]
    c = np.asarray(cimg.convert("RGBA"))
    checks["has_transparency"] = cimg.mode in ("RGBA", "LA", "P") and int(c[..., 3].min()) < 10
    if not checks["same_canvas"]:
        rep["checks"] = checks; rep["pass"] = False
        print(json.dumps(rep, indent=1)); sys.exit(1)

    oa, ca = o[..., 3] > 128, c[..., 3] > 128
    xor = (oa ^ ca).sum() / oa.sum()
    rep["silhouette_xor"] = round(float(xor), 5)
    rep["alpha_max_diff"] = int(np.abs(o[..., 3].astype(int) - c[..., 3].astype(int)).max())
    checks["silhouette"] = xor <= MAX_XOR
    fo, fc = foot(o[..., 3]), foot(c[..., 3])
    rep["foot_orig"], rep["foot_candidate"] = fo, fc
    checks["foot_anchor"] = abs(fo[0] - fc[0]) <= MAX_FOOT_PX and abs(fo[1] - fc[1]) <= MAX_FOOT_PX

    yo, yc = yolk_mask(o), yolk_mask(c)
    iou = (yo & yc).sum() / max(1, (yo | yc).sum())
    oy, ox = [v.mean() for v in np.nonzero(yo)]
    cy, cx = [v.mean() for v in np.nonzero(yc)] if yc.any() else (0, 0)
    rep["yolk_iou"] = round(float(iou), 4)
    rep["yolk_shift_px"] = [round(float(cx - ox), 2), round(float(cy - oy), 2)]
    checks["yolk_same_place"] = iou >= MIN_YOLK_IOU and abs(cx - ox) <= MAX_YOLK_SHIFT and abs(cy - oy) <= MAX_YOLK_SHIFT

    # face zone = original yolk, slightly grown so the blush and eye strokes near the rim count as "face"
    face = cv2.dilate(yo.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
    diff = np.abs(o[..., :3].astype(int) - c[..., :3].astype(int)).max(axis=2)
    changed = (diff > TOL_RGB) & (oa | ca)
    out_zone = (oa | ca) & ~face
    rep["outside_face_changed"] = round(float((changed & out_zone).sum() / out_zone.sum()), 5)
    rep["inside_face_changed"] = round(float((changed & face).sum() / face.sum()), 4)
    rep["outside_face_mean_diff"] = round(float(diff[out_zone].mean()), 3)
    checks["only_face_changed"] = rep["outside_face_changed"] <= MAX_OUT_CHANGED and rep["outside_face_mean_diff"] <= MAX_OUT_MEAN
    checks["face_changed_at_all"] = rep["inside_face_changed"] > 0.002

    # overlay sheet: original | candidate | onion skin | changed map (red = changed outside face, yellow = inside, blue = silhouette XOR)
    bg = np.full(o.shape[:2] + (3,), 235, np.uint8)
    def on_bg(rgba):
        a = rgba[..., 3:4] / 255.0
        return (rgba[..., :3] * a + bg * (1 - a)).astype(np.uint8)
    po, pc = on_bg(o), on_bg(c)
    onion = (po * 0.5 + pc * 0.5).astype(np.uint8)
    cmap = (po * 0.35 + 165).astype(np.uint8)
    cmap[changed & face] = (240, 200, 0)
    cmap[changed & out_zone] = (230, 30, 30)
    cmap[oa ^ ca] = (30, 60, 230)
    edge = cv2.Canny(face.astype(np.uint8) * 255, 50, 150) > 0
    cmap[edge] = (0, 150, 0)
    sheet = np.concatenate([po, pc, onion, cmap], axis=1)
    Image.fromarray(sheet).resize((sheet.shape[1] // 2, sheet.shape[0] // 2), Image.LANCZOS).save(os.path.join(args.out, f"{args.kind}-overlay.png"))

    rep["checks"] = {k: bool(v) for k, v in checks.items()}
    rep["pass"] = all(checks.values())

    if args.install:
        dst_rel = f"/assets/scene/egg-{args.kind}.png"
        dst = os.path.join(ROOT, "public" + dst_rel)
        if args.install == "raw":
            if not rep["pass"]:
                rep["install"] = "refused: not every check passes (try --install composite if only pixels outside the face moved)"
            else:
                shutil.copyfile(args.candidate, dst); rep["install"] = dst_rel
        else:
            base_ok = checks["same_canvas"] and checks["yolk_same_place"] and checks["face_changed_at_all"]
            # feather inside the yolk: candidate fully inside (yolk eroded 18 px), original outside the yolk
            inner = cv2.erode(yo.astype(np.uint8), np.ones((37, 37), np.uint8)).astype(np.float32)
            w = cv2.GaussianBlur(inner, (0, 0), 5)
            w = np.clip(w * yo, 0, 1)[..., None]
            comp = (c.astype(np.float32) * w + o.astype(np.float32) * (1 - w)).round().astype(np.uint8)
            comp[..., 3] = o[..., 3]  # silhouette is the original, exactly
            band = (w[..., 0] > 0.05) & (w[..., 0] < 0.95)
            seam = float(np.abs(o[..., :3].astype(int) - c[..., :3].astype(int))[band].mean()) if band.any() else 0.0
            rep["composite_seam_mean_rgb"] = round(seam, 2)
            # every face feature of the candidate must be inside the full-weight zone, otherwise it gets cut
            feat = (np.abs(c[..., :3].astype(int) - o[..., :3].astype(int)).max(axis=2) > 40) & yo
            cut = feat & (w[..., 0] < 0.95)
            rep["composite_features_in_feather_px"] = int(cut.sum())
            if not base_ok or seam > MAX_SEAM or cut.sum() > 40:
                rep["install"] = "refused: composite would show a seam or cut a feature (see composite_* fields)"
            else:
                Image.fromarray(comp, "RGBA").save(dst); rep["install"] = dst_rel + " (composite: outline = original)"
                Image.fromarray(np.concatenate([on_bg(o), on_bg(comp)], axis=1)).resize((o.shape[1], o.shape[0] // 2), Image.LANCZOS).save(os.path.join(args.out, f"{args.kind}-composite.png"))
        if rep.get("install", "").startswith("/assets"):
            s = json.load(open(SLOTS))
            s["egg"].setdefault("faces", {})[args.kind] = dst_rel
            with open(SLOTS, "w") as f:
                json.dump(s, f, ensure_ascii=False, indent=1)
                f.write("\n")
    with open(os.path.join(args.out, f"{args.kind}-report.json"), "w") as f:
        json.dump(rep, f, indent=1, default=float)
    print(json.dumps(rep, indent=1, default=float))
    sys.exit(0 if rep["pass"] or str(rep.get("install", "")).startswith("/assets") else 1)


if __name__ == "__main__":
    main()
