"""厨房主视觉的版位模板（3072×2048 = 场景 1536×1024 的 2 倍），标出第 1 节的硬约束，可以半透明叠在生成图上检查。

数据来源（不手写）：src/lib/scene.ts 的 ANCHORS（锅底椭圆、锅沿外框、起跳点、火苗区、水壶嘴）、
backgrounds.json（碗）、tools/bg_constraints.mjs --views --json（各节拍可见范围、飞行走廊）和 --json（各视口桌沿等待点）。
输出：docs/bg-templates/kitchen-key-template.png（透明底）、docs/bg-templates/kitchen-key-template-on-current.jpg（叠在现有厨房上的预览）。
用法：python3 tools/bg_key_template.py
"""
import json, re, subprocess

from PIL import Image, ImageDraw, ImageFont

K = 2
W, H = 1536 * K, 1024 * K
F = lambda s: ImageFont.truetype("/System/Library/Fonts/STHeiti Medium.ttc", s)
BG = json.load(open("src/app/preview/visual/backgrounds.json"))
src = open("src/lib/scene.ts").read()
num = lambda name: [float(v) for v in re.findall(r"-?\d+(?:\.\d+)?", re.search(name + r"\s*[\[{]([^\]}]*)[\]}]", src).group(1))]
panInner = dict(zip(("cx", "cy", "rx", "ry"), num(r"panInner:")))
panRimBox = num(r"panRimBox:")
flameBox = num(r"flameBox:")
launch = dict(zip(("x", "y"), num(r"panLaunch:")))
spout = dict(zip(("x", "y"), num(r"kettleSpout:")))
views = json.loads(subprocess.run(["node", "tools/bg_constraints.mjs", "--views", "--json"], capture_output=True, text=True).stdout)
rows = json.loads(subprocess.run(["node", "tools/bg_constraints.mjs", "--json"], capture_output=True, text=True).stdout)
A = BG["anchors"]; B = BG["bowl"]

im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
s = lambda *v: [c * K for c in v]
RED, BLUE, GREEN, PURPLE, ORANGE, INK = (215, 35, 35, 255), (25, 95, 205, 255), (0, 140, 60, 255), (140, 40, 165, 255), (230, 120, 0, 255), (40, 30, 20, 255)

def box(b, col, label, fill=None, w=6, dy=8):
    d.rectangle(s(*b), outline=col, width=w, fill=fill)
    d.text((b[0] * K + 10, b[1] * K + dy), label, fill=col, font=F(30))

# 每个节拍都看得到的范围（横版）、手机窗口的移动范围
la = views["landscapeAll"]; box(la, GREEN, f"横版每一段都看得到 x {la[0]}–{la[2]}, y {la[1]}–{la[3]}（场景像素）", w=5)
ph = [r["390×844"] for r in views["beats"].values()]
px0, px1 = min(r[0] for r in ph), max(r[2] for r in ph)
d.rectangle(s(px0, 70, px1, 1020), outline=BLUE, width=4)
d.text((px0 * K + 10, 74 * K), f"手机 390×844 的窄窗在 x {px0}–{px1} 之间移动", fill=BLUE, font=F(28))
# 锅：锅底椭圆、锅沿遮挡外框、起跳点、火苗区、水壶嘴
c = panInner; d.ellipse(s(c["cx"] - c["rx"], c["cy"] - c["ry"], c["cx"] + c["rx"], c["cy"] + c["ry"]), outline=PURPLE, width=6)
d.text(((c["cx"] - c["rx"]) * K + 10, (c["cy"] - c["ry"] - 22) * K), f"锅底椭圆 中心({c['cx']:.0f},{c['cy']:.0f}) 半宽{c['rx']:.0f} 半高{c['ry']:.0f}：油、油泡、蛋画在这里", fill=PURPLE, font=F(28))
box(panRimBox, PURPLE, "锅沿前缘 + 锅身前壁 → 单独一层 pan-rim（挡住锅里蛋的脚）", w=4, dy=-40 + (panRimBox[3] - panRimBox[1]) * K)
box(flameBox, ORANGE, "火苗区（代码画，灶眼在这里）", w=4)
for p, lab in ((launch, "蛋起跳点"), (spout, "水壶嘴（蒸汽）")):
    d.ellipse(s(p["x"] - 7, p["y"] - 7, p["x"] + 7, p["y"] + 7), fill=RED)
    d.text(((p["x"] + 10) * K, (p["y"] - 10) * K), f"{lab} ({p['x']:.0f},{p['y']:.0f})", fill=RED, font=F(28))
# 蛋的活动区、桌沿等待点
ez = [923, 748, 1502, 1006]
for r in rows:
    x, y = map(int, r["wait"].split(",")); w = 388 * r["eggAtTable"]
    ez = [min(ez[0], x - w * 0.58), min(ez[1], y - w - 23), max(ez[2], x + w * 0.58), max(ez[3], y + 16)]
ez = [round(v) for v in ez]
box(ez, RED, f"蛋在桌面上的活动区 x {ez[0]}–{ez[2]}, y {ez[1]}–{ez[3]}：水平桌面、不放任何物件", fill=(215, 35, 35, 40))
for r in rows:
    x, y = map(int, r["wait"].split(","))
    d.ellipse(s(x - 6, y - 6, x + 6, y + 6), fill=RED); d.text(((x - 40) * K, (y + 6) * K), r["vp"], fill=RED, font=F(22))
# 碗
tb = dict(A["tableBowl"]); tb["y"] = 960  # 新方向建议值（brief 第 5 节第 10 项），厨房可见时碗要站在灶脚前面
bb = B["box"]; bw = [tb["x"] + bb[0], min(tb["y"] - 388 * A["eggInTableBowl"], tb["y"] + bb[1]), tb["x"] + bb[0] + bb[2], tb["y"] + bb[1] + bb[3]]
d.line(s(560, 975, 840, 975), fill=ORANGE, width=6); d.text((560 * K, 982 * K), "这里灶台（含灶脚）下沿 ≤ y 975，下面露出空桌面", fill=ORANGE, font=F(24))
box([round(v) for v in bw], RED, f"饭桌上的碗 + 碗里的蛋（tablecall，建议 tableBowl (700,960)）x {round(bw[0])}–{round(bw[2])}, y {round(bw[1])}–{round(bw[3])}：桌面空着", fill=(215, 35, 35, 30), w=4)
# 飞行走廊
fc = views["flightCorridor"]
d.rectangle(s(*fc), outline=ORANGE, width=4)
d.text((fc[0] * K + 10, (fc[1] + 4) * K), f"接蛋飞行走廊 x {fc[0]}–{fc[2]}, y {fc[1]}–{fc[3]}：后面不放抢眼的小角色", fill=ORANGE, font=F(26))
# 图例
d.rectangle((20, 20, W - 20, 150), fill=(255, 252, 245, 230), outline=INK, width=2)
d.text((36, 30), "厨房主视觉版位模板 3072×2048（= 场景 1536×1024 × 2）。坐标都是场景像素；图片像素 = 场景像素 × 2。数据由 tools/bg_key_template.py 从代码算出", fill=INK, font=F(30))
d.text((36, 75), "红 = 必须留空（蛋、碗）；紫 = 固定的锅；橙 = 火苗 / 飞行走廊；绿 = 横版始终可见；蓝 = 手机窗口。小角色躲在厨房物件后面探头，不贴屏幕边", fill=INK, font=F(28))
im.save("docs/bg-templates/kitchen-key-template.png")
base = Image.open("source/kitchen-clean.png").convert("RGBA").resize((W, H))
Image.alpha_composite(base, im).convert("RGB").resize((W // 2, H // 2)).save("docs/bg-templates/kitchen-key-template-on-current.jpg", quality=82)
print("ok", ez, fc)
