# p6f 结尾特写（妈妈）表情重画需求（给 ChatGPT）

## 为什么
p6f 是妈妈听完"没事，是我拉肚子了"之后的反应特写。现在只有"眼神僵住 → 三个点之后眨一下"，太平了；这格的笑点就是她愣住，要演得更 dramatic：瞪大、眼神下瞥看碗、偏向观众、死鱼眼半闭、慢眨眼、嘴角抽动，再加漫画符号（额头黑线、汗滴）。

## 参考图（每次都附上）
1. 现有 p6f（构图、人物、画风以它为准，483×341，分辨率低，新图按下面的尺寸放大重绘）：
`/Users/mac/dev/egg-breakfast-comic/.claude/worktrees/grid-animation-fixes-951c87/public/assets/comic-v3/p6f.webp`
2. 现有眨眼版（闭眼的画法参考）：`.../public/assets/comic-v3/perf/p6f-blink.webp`
3. 整页原稿（保证和上下文画风一致）：`.../source/comic-v3/06-recognition-and-punchline.png`
4. 同一个妈妈在上一格的样子（脸型、发型、耳坠）：`.../public/assets/comic-v3/idle/p6d-base.webp`

## 通用规则（每条 prompt 开头带上）
Use the attached p6f as the exact reference. Output canvas 1700×1200 px (aspect 1.4167:1), identical framing, scale and composition to the reference: the same close-up of the mother's face looking down-front, the same hair, golden teardrop earrings, olive apron straps, cream blouse, green tile wall, plant and chair at the left. Same hand-drawn warm storybook comic style, soft watercolor shading, thick dark outlines. IMPORTANT: no outer frame, no dark border line, no rounded corners, no margin: the artwork runs fully to all four edges. Change ONLY the facial expression described (eyebrows, eyes, mouth, and the added symbols); the face shape, skin color, hair, ears, earrings, clothes, background must stay exactly as in the reference, so the images can be blended with each other without ghosting. Do not move or resize the head.

## 一、表情整格（不透明，6 张，每张只改眉、眼、嘴）
- **F1 瞪大（震惊）**：眉毛高高上扬，眼白明显变大、瞳孔缩小成小点，嘴一条线微张成很小的"o"。
- **F2 眼神下瞥**：眉毛略抬，瞳孔往下看（看向画面下方的碗），眼睛睁大一点，嘴一条线。
- **F3 偏向观众**：瞳孔居中并略偏向画面外（像在看镜头），眉毛一高一低（左低右高），嘴一条线，表情"你听见了吗"。
- **F4 死鱼眼（半闭）**：上眼皮垂下，眼睛只露下面一半，眉毛压平，嘴一条线，完全无语的"……"。
- **F5 全闭眼**：和 p6f-blink 同样的闭眼画法，嘴一条线（用来做慢眨眼）。
- **F6 嘴角抽动**：眼睛同 F4（半闭），嘴一条线，右边嘴角向下撇、微微颤的样子（忍着不说话）。

## 二、符号叠加层（透明，2 张，同画布同位置，其余全透明）
- **O1 额头黑线**：额头上 3 到 4 条细长的竖线，深棕色，漫画里的"无语"黑线，位置在额头中间偏右，不要盖住眉毛。
- **O2 汗滴**：一颗大汗滴在右侧鬓角靠近耳朵上方（浅蓝白色，带高光和深色描边）；再给一张 **O2b**：同一颗汗滴往下滑了约 12% 画面高，位置在脸颊侧面。

## 三、可选
- **F7 张嘴 "啊？"**：一个很小的圆形张嘴，眼睛同 F1，用来做最开始的震惊（可有可无）。
- **F8 整张脸稍暗（无语）**：F4 的脸上加一层浅灰蓝的竖向阴影（额头到眼睛），像漫画里"整个人暗下来"。

## 交付
`p6f-F1.png` … `p6f-F6.png`、`p6f-O1.png`、`p6f-O2.png`、`p6f-O2b.png`（可选 `p6f-F7.png`、`p6f-F8.png`），发目录路径。

## 我这边怎么接（供你判断图对不对）
和 p6e 同样：把每张表情整格配准到参考，只取"脸部（眉、眼、嘴）"一块羽化椭圆叠在底图上，其余永远是原图，所以脸型、头发不会重影；符号层直接叠。如果配准后脸型、发型差得多，我会直接告诉你哪张不对，不硬接。
