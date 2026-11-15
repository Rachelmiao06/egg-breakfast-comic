"""把叠在漫画格上的补丁图、遮罩、分层动画图按同一个裁切框裁掉黑框（一次性迁移；配合 tools/panel_alpha.py）。

- 格子本体由 panel_alpha.py 重新裁切并写 tools/panel_trim.json（每格的 old_size 和 box）。
- 补丁（眨眼 perf/pXx-*.webp、p4a-egg-hole.png、p6e-clean/bubble）原来和未裁的单格同尺寸，这里从 git 里取裁切前的原件，用该格的 box 裁。
- comic-v4 分层动画（frames / layers）每组同尺寸，用各组黑框内缘算出的框整组裁（V4_BOX），保证各层仍然逐像素对齐。
- 原件来自 REV（裁切前的提交）。已经裁过的文件不要重复跑：先 git checkout REV -- <路径>，或直接改 REV 后重跑。
"""
import glob, io, json, os, subprocess
from PIL import Image

REV = "85490c1"
TRIM = json.load(open("tools/panel_trim.json"))
V4_BOX = {"p2b": (12, 9, 1043, 676), "p2d": (15, 14, 1575, 501), "p3a": (17, 17, 984, 978)}


def orig(path: str) -> Image.Image:
    data = subprocess.check_output(["git", "show", f"{REV}:{path}"])
    return Image.open(io.BytesIO(data)).convert("RGBA")


def save(im: Image.Image, path: str):
    if path.endswith(".png"): im.save(path)
    else: im.save(path, quality=92, alpha_quality=100, method=6)


def crop_to(path: str, key: str):
    t = TRIM[key]; im = orig(path)
    assert list(im.size) == t["old_size"], (path, im.size, t["old_size"])
    save(im.crop(tuple(t["box"])), path); print("patch", path, "->", tuple(t["box"]))


if __name__ == "__main__":
    for f in sorted(glob.glob("public/assets/comic-v3/perf/*.webp")):
        crop_to(f, os.path.basename(f).split("-")[0])
    crop_to("public/assets/comic-v3/p4a-egg-hole.png", "p4a")
    crop_to("public/assets/comic-v3/p6e-clean.webp", "p6e")
    crop_to("public/assets/comic-v3/p6e-bubble.webp", "p6e")
    for k, box in V4_BOX.items():
        for f in sorted(glob.glob(f"public/assets/comic-v4/frames/{k}-*.webp") + glob.glob(f"public/assets/comic-v4/layers/{k}-*.webp")):
            save(orig(f).crop(box), f)
        print("v4", k, box, (box[2] - box[0], box[3] - box[1]))
