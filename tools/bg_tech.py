"""后景素材技术数据 + 模板 PNG（B1、B2 横版、B2 竖版）。只给影响动画、遮挡和裁切的数据，不涉及画风。

数值来源：src/app/preview/visual/backgrounds.json（table / hallway / anchors / camera）、slots.json（漫画格）、
ComicLayer.tsx 的 fitPlaces / columnPlaces（漫画格排版算法，这里按同样公式重算）、Backdrops.tsx（B2 显示方式：
比视口左右各宽 driftPct%，object-fit: cover，object-position = focus）。
输出：docs/bg-templates/tech-*.png（画布原尺寸，像素坐标即图片像素）、docs/bg-templates/tech-data.json。
用法：python3 tools/bg_tech.py
"""
import json

from PIL import Image, ImageDraw, ImageFont

OUT = "docs/bg-templates"
import os
BG = json.load(open(os.environ.get("BG_JSON", "src/app/preview/visual/backgrounds.json")))
SL = json.load(open("src/app/preview/visual/slots.json"))
P = {p["key"]: p for p in SL["panels"]}
F = lambda s: ImageFont.truetype("/System/Library/Fonts/STHeiti Medium.ttc", s)
INK, RED, BLUE, GREEN, BROWN, PURPLE, GREY = (40, 30, 20), (215, 35, 35), (25, 95, 205), (0, 140, 60), (150, 95, 20), (140, 40, 165), (120, 120, 120)
DATA = {}

# ======================= B1 桌沿带 =======================
T = BG["table"]; A = BG["anchors"]
sx0, sy0, sw, sh = T["showBox"]              # 场景像素
IW, IH = T["size"]                           # 图片像素 4000×800
kx, ky = IW / sw, IH / sh                    # 2.0 / 2.0
assert abs(kx - ky) < 1e-9, "B1 横纵比例不一致"
img = lambda x, y: ((x - sx0) * kx, (y - sy0) * ky)   # 场景 → 图片
# 换算自检：四角
assert img(sx0, sy0) == (0, 0) and img(sx0 + sw, sy0 + sh) == (IW, IH)
EGG = 388  # egg.webp 边长（元素像素）
def egg_box(foot, scale):  # 场景像素：蛋身外接框（含轻跳 23、压扁加宽 16%）
    w = EGG * scale; hop = 46 * scale
    return (foot["x"] - w * 0.58, foot["y"] - w - hop, foot["x"] + w * 0.58, foot["y"] + 8 * scale + 23 * scale)
# 桌沿等待点 = 起跳点（feat/background-scenes 的 eggPath.ts，按布局推出：铲面落点右侧 0.8 个蛋宽，夹在接蛋镜头内；
# 窄布局蛋按接蛋格缩小比例缩小）。这里按各视口的接蛋格宽度重算缩放；x 取该会话当前算出的值。
def narrow_scale(vw, vh):
    s = max(vw / 1536, vh / 1024) * 1.08; vis = vw / s
    return 0.5 * min(1, vis * 0.94 / 900)
eggs = {
    "16:9 / 16:10": ({"x": 1233, "y": 965}, 0.5),
    "4:3 1024×768": ({"x": 1122, "y": 990}, narrow_scale(1024, 768)),
    "860×1000": ({"x": 943, "y": 990}, narrow_scale(860, 1000)),
    "390×844": ({"x": 793, "y": 990}, narrow_scale(390, 844)),
}
b1 = {
    "file": "table-band.png（或 .webp），放 public/assets/scene/",
    "canvas_px": [IW, IH], "aspect": f"{IW // 800}:{IH // 800}（5:1）",
    "scale": "1 场景像素 = 2 图片像素",
    "scene_range": {"x": [sx0, sx0 + sw], "y": [sy0, sy0 + sh]},
    "convert": "图片x = (场景x + 232) × 2；图片y = (场景y − 860) × 2",
    "structure_scene_y": {"代码透明渐变（上沿遮罩）": [sy0, sy0 + T["fadeTop"]], "纸面羽化盖住": [BG["paper"]["edgeY"] - BG["paper"]["feather"], BG["paper"]["edgeY"]],
                          "桌面": [T["topY"], T["edgeY"]], "桌沿前缘线": T["edgeY"], "前侧面": [T["edgeY"], T["faceY"]], "下方余量": [T["faceY"], sy0 + sh]},
    "eggs_scene": {k: {"foot": v[0], "scale": v[1], "box": [round(c) for c in egg_box(v[0], v[1])]} for k, v in eggs.items()},
    "egg_zone_scene": None,  # 下面算
    "must_empty_scene_x": [0, 1536],
    "visible_scene_x_all_viewports": [0, 1536],
    "visible_scene_y_usual": [T["topY"], 1024],
}
bx = [v["box"] for v in b1["eggs_scene"].values()]
b1["egg_zone_scene"] = [min(b[0] for b in bx), min(b[1] for b in bx), max(b[2] for b in bx), max(b[3] for b in bx)]
DATA["B1"] = b1

im = Image.new("RGB", (IW, IH), (250, 246, 238)); d = ImageDraw.Draw(im)
def hband(y0, y1, fill, label, col=INK):
    Y0, Y1 = img(0, y0)[1], img(0, y1)[1]
    d.rectangle((0, Y0, IW, Y1), fill=fill); d.text((20, Y0 + 4), label, fill=col, font=F(26))
hband(sy0, sy0 + T["fadeTop"], (243, 238, 228), f"图片 y 0–{int(img(0, sy0 + T['fadeTop'])[1])}｜场景 y {sy0}–{sy0 + T['fadeTop']}：代码做透明渐变（环境段厨房会从这里透出），不要放硬边")
hband(T["topY"], T["edgeY"], (233, 214, 182), f"桌面：图片 y {int(img(0, T['topY'])[1])}–{int(img(0, T['edgeY'])[1])}｜场景 y {T['topY']}–{T['edgeY']}（上部 {T['topY']}–{BG['paper']['edgeY']} 被纸面羽化盖住）")
hband(T["edgeY"], T["faceY"], (219, 194, 156), f"前侧面：图片 y {int(img(0, T['edgeY'])[1])}–{int(img(0, T['faceY'])[1])}｜场景 y {T['edgeY']}–{T['faceY']}")
hband(T["faceY"], sy0 + sh, (240, 230, 214), f"下方余量：图片 y {int(img(0, T['faceY'])[1])}–{IH}｜场景 y {T['faceY']}–{sy0 + sh}（平时不可见，只在视差 / 饭桌位移时短暂露出）", GREY)
Ye = img(0, T["edgeY"])[1]; d.line((0, Ye, IW, Ye), fill=(110, 60, 20), width=6)
d.text((IW - 1150, Ye - 36), f"桌沿前缘线：图片 y {int(Ye)}｜场景 y {T['edgeY']}（±10）", fill=(110, 60, 20), font=F(28))
Yp = img(0, BG["paper"]["edgeY"])[1]; d.line((0, Yp, IW, Yp), fill=GREY, width=2)
d.text((IW - 1150, Yp - 32), f"纸面下沿（羽化终点）：图片 y {int(Yp)}｜场景 y {BG['paper']['edgeY']}", fill=GREY, font=F(24))
# 可见范围：镜头夹在厨房画布 0–1536 内，所有视口可见 x 都在这个范围里；两端只给视差余量
X0, X1 = img(0, 0)[0], img(1536, 0)[0]
d.line((X0, IH - 34, X1, IH - 34), fill=PURPLE, width=8)
d.text((X0 + 8, IH - 70), f"可见范围（所有视口，镜头夹在厨房画布内）：图片 x {int(X0)}–{int(X1)}｜场景 x 0–1536；左右两端只给视差余量", fill=PURPLE, font=F(26))
d.rectangle((X0, img(0, T["topY"])[1], X1, Ye), outline=GREEN, width=5)
d.text((X0 + 8, img(0, T["topY"])[1] + 40), f"必须留空：整条桌面 图片 x {int(X0)}–{int(X1)}, y {int(img(0, T['topY'])[1])}–{int(Ye)}｜场景 x 0–1536, y {T['topY']}–{T['edgeY']}（不放任何物件）", fill=GREEN, font=F(26))
z = b1["egg_zone_scene"]; (ZX0, ZY0), (ZX1, ZY1) = img(z[0], z[1]), img(z[2], z[3])
d.rectangle((ZX0, max(0, ZY0), ZX1, ZY1), outline=RED, width=7)
d.text((ZX0 + 8, ZY1 + 8), f"蛋活动区（四种布局并集，含轻跳和压扁）：图片 x {int(ZX0)}–{int(ZX1)}, y {max(0,int(ZY0))}–{int(ZY1)}｜场景 x {z[0]}–{z[2]}, y {z[1]}–{z[3]}", fill=RED, font=F(24))
for k, v in b1["eggs_scene"].items():
    fx, fy = img(v["foot"]["x"], v["foot"]["y"])
    d.ellipse((fx - 10, fy - 10, fx + 10, fy + 10), fill=RED)
    d.text((fx - 60, fy - 70 - 28 * list(b1["eggs_scene"]).index(k)), f"{k} 脚底 图片({int(fx)},{int(fy)})｜场景({v['foot']['x']},{v['foot']['y']})", fill=RED, font=F(20))
d.text((20, IH - 210), "B1 桌沿带 4000×800（5:1）不透明｜图层：厨房分层之上、纸面之下、蛋之下（纸面组 z 62，跟随主体层视差）", fill=INK, font=F(30))
d.text((20, IH - 170), "坐标：图片像素；括号内为场景像素（厨房画布 1536×1024）。图片x=(场景x+232)×2，图片y=(场景y−860)×2", fill=INK, font=F(24))
im.save(f"{OUT}/tech-B1-table-band.png")

# ======================= B2：漫画格排版（同 ComicLayer 公式） =======================
def hOf(p, w, vw, vh): return (w * vw / 100 / p["aspect"]) / vh * 100
def fit_places(keys, vw, vh, bottom=96):
    k = min(1.6, max(1, 1.6 / (vw / vh)))
    base = []
    for key in keys:
        p = P[key]; base.append((p, 50 + (p["x"] + p["w"] / 2 - 50) * k - p["w"] * k / 2, p["y"], p["w"] * k))
    minY = min(b[2] for b in base); maxY = max(b[2] + hOf(b[0], b[3], vw, vh) for b in base)
    minX = min(b[1] for b in base); maxX = max(b[1] + b[3] for b in base)
    s = min(1, (bottom - minY) / max(1, maxY - minY), 96 / max(1, maxX - minX))
    cx = (minX + maxX) / 2; lx, rx = cx + (minX - cx) * s, cx + (maxX - cx) * s
    shift = max(0, 2 - lx) - max(0, rx - 98)
    out = {}
    for p, x, y, w in base:
        nx, ny, nw = cx + (x - cx) * s + shift, minY + (y - minY) * s, w * s
        out[p["key"]] = (nx, ny, nw, hOf(p, nw, vw, vh))
    return out
def column_places(keys, vw, vh, top=4, bottom=95):
    PW = {"hero": 94, "support": 80, "insert": 66}
    out = {}; y = top; side = 0
    for key in sorted(keys, key=lambda k: P[k].get("order", 0)):
        p = P[key]; w = 94 if p["aspect"] > 1.8 else PW.get(p.get("role", "support"), 80)
        x = 3 if w >= 94 else (3 if side % 2 == 0 else 97 - w)
        if w < 94: side += 1
        h = hOf(p, w, vw, vh); out[key] = [x, y, w, h]; y += h + 2.2
    total = y - 2.2 - top; avail = bottom - top
    if total < avail:
        for v in out.values(): v[1] += (avail - total) / 2
    return out, max(0, total - avail)
H2 = BG["hallway"]; pad = H2["driftPct"]
GROUPS = {"search（寻找）": ["p5a", "p5b", "p5c"], "eggcall（蛋喊）": ["p5d", "p5e"]}

def b2_map(IW, IH, vw, vh):
    """B2 在视口里的显示：容器宽 = 视口 × (1 + 2pad%)，cover，居中（focus 0.5,0.5）。返回 视口(%) → 图片像素 的函数和缩放"""
    cw = vw * (1 + 2 * pad / 100); s = max(cw / IW, vh / IH)
    cx, cy = IW * H2["focus"][0], IH * H2["focus"][1]
    def f(px, py, drift=0.0):  # px/py：视口百分比；drift：漂移（vw）
        return (cx + ((px - drift) / 100 - 0.5) * vw / s, cy + (py / 100 - 0.5) * vh / s)
    return f, s

def draw_b2(name, IW, IH, viewports, layout, title, notes):
    im = Image.new("RGB", (IW, IH), (247, 241, 231)); d = ImageDraw.Draw(im)
    info = {"file": f"{name}，放 public/assets/bg/", "canvas_px": [IW, IH], "viewports": {}}
    always = [0, 0, IW, IH]
    for vn, (vw, vh) in viewports.items():
        f, s = b2_map(IW, IH, vw, vh)
        for drift in (-pad, 0, pad):
            x0, y0 = f(0, 0, drift); x1, y1 = f(100, 100, drift)
            always = [max(always[0], x0), max(always[1], y0), min(always[2], x1), min(always[3], y1)]
        x0, y0 = f(0, 0); x1, y1 = f(100, 100)
        vis = [round(x0), round(y0), round(x1), round(y1)]
        cover = {}
        for g, keys in GROUPS.items():
            if layout == "landscape":
                places = fit_places(keys, vw, vh); pan = 0
            else:
                places, pan = column_places(keys, vw, vh)
            for k, (px, py, pw, ph) in places.items():
                a = f(px, py - pan, 0); b = f(px + pw, py + ph, 0)  # 竖屏：整列在停留阶段上移 pan，覆盖范围取上移前后的并集
                cover[k] = [round(a[0]), round(min(a[1], f(px, py, 0)[1])), round(b[0]), round(b[1])]
        info["viewports"][vn] = {"visible_px_no_drift": vis, "drift_px_each_side": round(pad / 100 * vw / s), "comic_cover_px": cover}
    info["always_visible_px"] = [round(v) for v in always]
    # 绘制：可见框（只画框，数据写进图例）、漫画覆盖、始终可见区、图例
    fs = 26 if IW > 1500 else 24
    cols = [PURPLE, BLUE, BROWN, GREEN]
    legend = []
    for i, (vn, v) in enumerate(info["viewports"].items()):
        x0, y0, x1, y1 = v["visible_px_no_drift"]
        d.rectangle((max(0, x0) + i * 3, max(0, y0) + i * 3, min(IW - 1, x1) - i * 3, min(IH - 1, y1) - i * 3), outline=cols[i % 4], width=4)
        legend.append((cols[i % 4], f"■ {vn} 可见（未漂移）：x {max(0,x0)}–{min(IW,x1)}, y {max(0,y0)}–{min(IH,y1)}；漂移 ±{v['drift_px_each_side']}"))
    union = {}
    for v in info["viewports"].values():
        for k, b in v["comic_cover_px"].items():
            u = union.get(k, b); union[k] = [min(u[0], b[0]), min(u[1], b[1]), max(u[2], b[2]), max(u[3], b[3])]
    clip = lambda b: [max(0, b[0]), max(0, b[1]), min(IW, b[2]), min(IH, b[3])]
    if layout == "landscape":
        for k, b in union.items():
            b = clip(b); c = RED if k in GROUPS["search（寻找）"] else BLUE
            ov = Image.new("RGBA", im.size); od = ImageDraw.Draw(ov)
            od.rectangle(tuple(b), fill=c + (34,), outline=c + (255,), width=5)
            im.paste(Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB")); d = ImageDraw.Draw(im)
            ty = b[1] + 10 if c == RED else b[3] - 70
            d.text((b[0] + 10, ty), f"{k}（{'寻找' if c == RED else '蛋喊'}）漫画覆盖\nx {b[0]}–{b[2]}, y {b[1]}–{b[3]}", fill=c, font=F(fs))
        info["comic_cover_union_px"] = {k: clip(b) for k, b in union.items()}
    else:
        allb = clip([min(b[0] for b in union.values()), min(b[1] for b in union.values()), max(b[2] for b in union.values()), max(b[3] for b in union.values())])
        ov = Image.new("RGBA", im.size); od = ImageDraw.Draw(ov)
        od.rectangle(tuple(allb), fill=RED + (30,), outline=RED + (255,), width=5)
        im.paste(Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB")); d = ImageDraw.Draw(im)
        d.text((allb[0] + 10, IH // 2 - 120), f"漫画列覆盖（两种竖屏视口、五格并集）\nx {allb[0]}–{allb[2]}，几乎全高\n格子随阅读上移，任意时刻只压住其中一部分", fill=RED, font=F(fs))
        info["comic_cover_union_px"] = allb
    a = info["always_visible_px"]; d.rectangle(tuple(a), outline=GREEN, width=7)
    legend.append((GREEN, f"■ 始终可见区（所有列出视口 × 漂移）：x {a[0]}–{a[2]}, y {a[1]}–{a[3]}；门框等关键结构放在这里"))
    lh = fs + 12; bw = IW - 40; bh = lh * (len(legend) + len(notes) + 1) + 20
    by = IH - bh - 16 if layout == "landscape" else 20  # 横版图例放在下方空白处，不挡漫画覆盖标注
    d.rectangle((20, by, 20 + bw, by + bh), fill=(255, 252, 245), outline=INK, width=2)
    y = by + 10
    for line in [title] + notes:
        d.text((34, y), line, fill=INK, font=F(fs)); y += lh
    for c, line in legend:
        d.text((34, y), line, fill=c, font=F(fs)); y += lh
    im.save(f"{OUT}/tech-{name.split('.')[0]}.png")
    return info

DATA["B2_landscape"] = draw_b2("hallway-landscape.png", *H2["size"], {"16:9 1600×900": (1600, 900), "16:10 1440×900": (1440, 900), "4:3 1024×768": (1024, 768)}, "landscape",
    f"B2 横版 {H2['size'][0]}×{H2['size'][1]}（16:10）不透明｜视口宽高比 ≥ {H2['portraitBelow']} 时使用",
    ["坐标：图片像素。显示：容器比视口左右各宽 2.5%，object-fit cover，居中；寻找段从右往左漂移 ±2.5vw",
     "图层：页面层 z-5，盖住整个场景舞台（厨房、纸面、B1），在漫画层 z-10 之下。红/蓝 = 漫画覆盖（三种视口并集）"])
DATA["B2_portrait"] = draw_b2("hallway-portrait.png", *H2["sizePortrait"], {"390×844": (390, 844), "860×1000": (860, 1000)}, "portrait",
    f"B2 竖版 {H2['sizePortrait'][0]}×{H2['sizePortrait'][1]} 不透明｜视口宽高比 < {H2['portraitBelow']} 时使用",
    ["坐标：图片像素。漫画在竖屏排成一列并在停留阶段上移，覆盖范围取上移前后并集",
     "图层：页面层 z-5，在漫画层 z-10 之下"])
json.dump(DATA, open(f"{OUT}/tech-data.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps({k: (v if k != "B1" else {kk: v[kk] for kk in ("canvas_px", "scene_range", "eggs_scene")}) for k, v in DATA.items()}, ensure_ascii=False, indent=1)[:5000])
