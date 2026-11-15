"""p6e（结尾饭碗格）新分层素材：把 ChatGPT 生成的 PNG 转成网页层（public/assets/comic-v5/p6e/）。
用法：python3 -I tools/prepare_p6e_layers.py <生成图目录>
目录里按修改时间排序的 10 张图依次是：
 base（不透明底图）、faceA（睁眼看正前）、yolkL（最长的流）、yolkS（中）、faceB（眼神略偏）、yolkM（最短）、
 bubble（黑白遮罩：白 = 对白泡）、faceClosed（闭眼）、steam（热气）、text（对白文字层）。
全部同尺寸 1463×1075。输出：base / faceA / faceB / faceClosed / yolk1(短)/yolk2(中)/yolk3(长) / steam / text / bubble(白→alpha) / static（静态终态合成）。
"""
import glob, os, sys
from PIL import Image

src = sys.argv[1]
out = "public/assets/comic-v5/p6e"
os.makedirs(out, exist_ok=True)
fs = sorted(glob.glob(os.path.join(src, "*.png")), key=os.path.getmtime)
names = ["base", "faceA", "yolk3", "yolk2", "faceB", "yolk1", "bubble", "faceClosed", "steam", "text"]
assert len(fs) == len(names), len(fs)
im = {n: Image.open(f) for n, f in zip(names, fs)}
# 流的长度：yolkM 最短、yolkS 中、yolkL 最长（按像素范围确认）
base = im["base"].convert("RGBA")
for n in ["faceA", "yolk3", "steam", "text"]:
    im[n].convert("RGBA").save(f"{out}/{n}.webp", quality=92, method=6)
base.convert("RGB").save(f"{out}/base.webp", quality=92, method=6)
# 泡遮罩：白色 = 泡（含描边、尾巴），转成 alpha，浏览器按普通 alpha 遮罩用
m = im["bubble"].convert("L").resize(base.size)
a = Image.new("RGBA", base.size, (255, 255, 255, 0)); a.putalpha(m)
a.save(f"{out}/bubble.webp", quality=95, method=6)
# 静态终态（减少动态效果）：底图 + 最长的流 + 睁眼 + 对白，无热气
st = base.copy()
for n in ["yolk3", "faceA", "text"]:
    st.alpha_composite(im[n].convert("RGBA"))
st.convert("RGB").save(f"{out}/static.webp", quality=92, method=6)
print("ok", base.size)
