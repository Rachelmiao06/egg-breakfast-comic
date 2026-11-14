#!/usr/bin/env python3
"""
Hole mask for the egg drawn in comic panel p4a (does not edit the panel art).

    python3 -I tools/make_egg_hole.py [--preview out.png]

Writes public/assets/comic-v3/p4a-egg-hole.png: same size as p4a.webp, alpha 0 over the drawn egg (body, yolk, arms,
feet, outline), 255 elsewhere, feathered ~1.5 px. ScenePanels applies it as a CSS mask on the handoff panel only while
the active egg is still on screen (before HANDOFF.swap), so the drawn egg never shows next to the active egg; what shows
through the hole is the catch panel underneath (its own blade and wall, aligned with p4a's).
"""
import argparse, os
import numpy as np, cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public/assets/comic-v3/p4a.webp")
DST = os.path.join(ROOT, "public/assets/comic-v3/p4a-egg-hole.png")
BOX = (95, 118, 300, 268)  # x0, y0, x1, y1 around the drawn egg (p4a pixels)

ap = argparse.ArgumentParser(); ap.add_argument("--preview"); args = ap.parse_args()
p = np.asarray(Image.open(SRC).convert("RGB"))
H, W = p.shape[:2]
hsv = cv2.cvtColor(p, cv2.COLOR_RGB2HSV).astype(int)
Hh, Ss, Vv = hsv[..., 0], hsv[..., 1], hsv[..., 2]
R, G, B = [p[..., i].astype(int) for i in range(3)]
inbox = np.zeros((H, W), bool); inbox[BOX[1]:BOX[3], BOX[0]:BOX[2]] = True
white = (Ss < 70) & (Vv > 185) & ~((G > R + 3) & (G > B + 3))          # egg white, hands, feet (not the green wall)
yolk = (Hh >= 19) & (Hh <= 28) & (Ss > 150) & (Vv > 200)                # yolk (the blade wood is hue ~16)
m = ((white | yolk) & inbox).astype(np.uint8)
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(m)
main = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
body = lab == main
near = cv2.dilate(body.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41))).astype(bool)
keep = body.copy()
for i in range(1, n):  # hands and feet: separate white blobs close to the body
    if i != main and st[i, cv2.CC_STAT_AREA] > 25 and near[lab == i].any():
        keep |= lab == i
# fill small enclosed holes (eyes, mouth, blush, limb outlines between blobs)
k = cv2.morphologyEx(keep.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
inv = 1 - k; n2, lab2, st2, _ = cv2.connectedComponentsWithStats(inv)
for i in range(1, n2):
    if st2[i, cv2.CC_STAT_AREA] < 900: k[lab2 == i] = 1
# grow over the drawn ink / gold outline
k = cv2.dilate(k, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
alpha = (1 - k).astype(np.float32)
alpha = cv2.GaussianBlur(alpha, (0, 0), 1.5)
out = np.zeros((H, W, 4), np.uint8); out[..., 3] = (alpha * 255).round().astype(np.uint8)
Image.fromarray(out, "RGBA").save(DST, optimize=True)
ys, xs = np.nonzero(k)
print("hole bbox", int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()), "px", int(k.sum()), "->", os.path.relpath(DST, ROOT))
if args.preview:
    v = p.copy(); edge = cv2.Canny(k * 255, 50, 150) > 0; v[edge] = (255, 0, 0)
    tint = k.astype(bool); v[tint] = (v[tint] * 0.6 + np.array([255, 80, 80]) * 0.4).astype(np.uint8)
    Image.fromarray(v[100:285, 80:320]).resize((720, 555), Image.NEAREST).save(args.preview)
