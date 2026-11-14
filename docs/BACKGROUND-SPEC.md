# 后景出图规格（按现有动画定稿）

这份规格直接取自现在的动画数据，不等待额外确认：镜头关键帧和换场曲线在 `src/app/preview/visual/backgrounds.json`，节拍在 `beats.visual-v2.json`，漫画格位置在 `slots.json`。图到位后只改 `backgrounds.json` 的 `src`，不改代码。

坐标约定：**场景坐标** = 原厨房画布 1536×1024 的像素；蛋的锚点是**脚底中心**。版位图在 `docs/bg-templates/`。

## 1. 结论：复用什么，真正缺什么

| 背景 | 用在哪些段 | 状态 | 是否要出图 |
|---|---|---|---|
| 厨房分层（远景、中景台面、主体、锅沿遮挡、近景） | 开场、蛋落桌（drop） | 现有，从 kitchen-clean 拆出 | **复用，不出图** |
| 纸面（暖米白） | 落桌之后到接蛋、上碗、叫吃饭、回来、认出、笑点 | 纯色 #f7eedd | **不出图**，保持干净纯色，不加纸纹 |
| **B1 桌沿带** | 同上，纸面下沿露出的那条桌子；蛋在这里等待 | 现在借用厨房主体层的木桌，灶台脚会从纸面下沿露出 | **缺，必须出图** |
| **B2 寻找段外围**（浅色墙面 + 局部门框 + 纸白） | 寻找、蛋喊“妈！这里！” | 占位：纯色 #f6eee2（斜纹已移除） | **缺，必须出图**（横版、竖版各一张） |
| 女儿房间 | — | 由漫画格 p5c（空房间）承担 | **不出图**；外围不再铺完整房间 |
| 收尾背景 | 妈妈表情特写 + 三个点 | 纯色 #f6eee2，盖住桌腿和木纹横带 | **不出图** |
| 前景漫画六页 | 全程 | 已到位：项目 `source/comic-v3/01–06` 与 Codex 生成目录最新版本逐字节一致 | 不缺 |

真正缺的只有两张（B2 分横竖两个版本，共三个文件）：**B1 桌沿带**、**B2 寻找段外围（横版 + 竖版）**。

## 2. 各段背景与过渡

过渡全部由同一条滚动时间轴驱动，曲线是平滑插值（smoothstep），数值写在 `backgrounds.json` 的 `curves`。

| 段落 | 背景 | 进入方式 |
|---|---|---|
| opening 开场 | 厨房全景，锅里的蛋自己跳 | 无 |
| drop 蛋从锅跳到桌沿 | 厨房 → 纸面 + B1 | 镜头向左下跟到桌沿（焦点 768,560 → 420,860，放大 1.00 → 1.14）；纸面从 drop 70% 到 bag 30% 淡入，盖住灶台和墙面，只留下 B1 |
| bag … hear（买菜到“啵”） | 纸面 + B1，蛋在桌沿左侧等待 | 不变，镜头只做小幅漂移（景深） |
| catch / handoff 接蛋、交给漫画 | 纸面 + B1 | 镜头移到 640,790、放大 1.08；蛋从桌沿跳进接蛋格 |
| bowl … call | 纸面 + B1（蛋已在漫画里） | 不变 |
| search / eggcall | **B2** 盖住全屏 | call 85% → search 25% 淡入；eggcall 70% → return 20% 淡出 |
| return … punchline | 纸面 + B1 | B2 淡出后露回 |
| closeup 收尾特写 | 纯色收尾层盖住全屏（含 B1） | punchline 72% → closeup 40% 淡入，之后安静停住 |

## 3. B1 桌沿带

- **画布**：交付 **4000×800**（2 像素 = 1 场景像素），对应场景 **x −232…1768，y 860…1260**，比例 5:1。不能只画到原厨房画布的边：蛋落桌时镜头会看到左侧 −146、下方 1180。
- **视角**：与现有厨房同一视角，平视略俯，桌面是一条水平的木质台面，透视线水平，不要斜。
- **桌沿高度**：桌面上沿 y≈920 起（920–965 是与纸面羽化衔接区，画面要能被纸色渐隐盖住而不突兀）；**桌沿前缘线 y≈995（±10）**；前缘下方 995–1060 是桌子前侧面，再往下是柔和的暖色阴影，过渡到 1260 时接近纸色。
- **蛋的落点**：横屏 **(120, 965)**，竖屏 **(520, 990)**。蛋显示约 194 场景像素宽高。
- **必须留空**：整条桌面不放任何物件。尤其是 **x −150…330** 和 **x 400…640**（两个红框，蛋身会向上画出这条带，叠在纸面上，所以带内这两段要完全干净）。不要锅柄、灶台脚、桌腿、碗、抹布伸进这条带。
- **遮挡关系**：B1 不透明，叠在厨房之上、纸面之下、蛋之下（层级在纸面 62 与桌沿蛋 63 之间），要完整盖住厨房 y≥920 的部分，包括灶台脚。蛋站在桌面上，不需要遮挡层；接触阴影由代码画。
- **安全范围**：横屏可见 x −150…1536（蓝框）；竖屏只看到 x 246…1005（紫框）。左端 −232…−150 和右端 1536…1768 只做延续，不放重点。

## 4. B2 寻找段外围（浅色墙面 + 局部门框 + 纸白）

漫画里已经有走廊、门口探头和空房间三个镜头，所以外围只负责“在家里另一处”的空间感，不能再铺一整套房间。

- **横版**：交付 **2400×1500（16:10）**。16:9 屏幕上下各裁掉约 75 像素（绿框），4:3 左右各裁掉约 200 像素（棕框），重点放在中间 2000×1350 之内。
- **竖版**：交付 **1200×2600**（手机），重点放在中间 1200×2200。
- **视角**：平视，正对墙面，几乎没有透视。
- **画什么**：浅暖色墙面（与漫画里走廊的米白/浅黄墙一致），左侧边缘一段**局部门框**（只露出木门框和一点门洞的阴影，不画门内房间），下方一条踢脚线（横版约 y 88%，竖版约 y 90%），其余是干净的纸白。
- **必须留空**：漫画格覆盖的区域（版位图红框 = 寻找段 p5a 小格、p5b 探头、p5c 空房间；蓝框 = 蛋喊段 p5d、p5e）不画任何细节，保持墙面平涂。不要人物、文字、家具、植物、相框、灯。
- **遮挡关系**：B2 在漫画层之下，整张不透明，盖住厨房、纸面和 B1。

## 5. 交给图像会话的提示词

风格基准：与现有厨房图 `source/kitchen-clean.png` 和六页漫画同一画风——温暖的手绘水彩上色、细墨线、柔和米白与浅木色、低饱和、干净，不要纸纹、颗粒或装饰图案。

**B1 桌沿带（4000×800）**

> 一条横向的木质餐桌桌沿，画成温暖手绘水彩加细墨线的绘本风格，与附图厨房同一画风和色调（浅暖木色、米白背景）。平视略俯的角度，桌面是水平的一条台面，透视线完全水平。画布 4000×800：上方约 15% 是米白纸色，向下自然过渡到桌面；桌沿前缘是一条清晰的水平线，位于画布高度约 34% 处；前缘下方是桌子前侧面，再往下是柔和的暖色阴影，到最底部接近米白。整条桌面上不放任何物件，没有锅、碗、餐具、桌腿、灶台、人物和文字。左右两端可以无缝延续。不要纸纹、颗粒、图案。

English:

> A long horizontal wooden table edge in a warm hand-painted watercolor storybook style with thin ink lines, matching the attached kitchen illustration (soft light wood, cream background). Eye level, looking very slightly down; the tabletop is a level horizontal band with perfectly horizontal perspective. Canvas 4000×800: the top ~15% is plain cream paper that blends into the tabletop; the front edge of the table is one clean horizontal line at about 34% of the height; below it the front face of the table, then a soft warm shadow fading to cream at the bottom. Absolutely nothing on the table: no pans, bowls, utensils, table legs, stove, people or text. Both ends continue seamlessly. No paper texture, grain or patterns.

**B2 寻找段外围，横版（2400×1500）与竖版（1200×2600）**

> 家里一面浅暖色的墙，画成与附图漫画同一画风的温暖手绘水彩加细墨线绘本风格。正对墙面、平视、几乎没有透视。左侧边缘露出一段浅木色门框（只画门框和门洞边缘一点阴影，不画门内房间），下方一条细细的木质踢脚线（横版在高度约 88%，竖版约 90%）。画面中间大面积是干净平整的米白墙面，用来叠放漫画格，所以中间不要任何细节。不要人物、家具、植物、相框、灯、文字，不要纸纹、颗粒或装饰图案。分别输出 2400×1500 横版和 1200×2600 竖版，竖版门框同样在左侧边缘。

English:

> A plain, light warm-colored wall inside a home, in the same warm hand-painted watercolor storybook style with thin ink lines as the attached comic pages. Straight-on, eye level, almost no perspective. On the far left edge, part of a light wood door frame (just the frame and a hint of shadow at the doorway; do not show the room beyond). A thin wooden skirting board near the bottom (about 88% height in landscape, 90% in portrait). The large central area is clean, flat cream wall because comic panels will sit on top, so no detail in the middle. No people, furniture, plants, frames, lamps or text; no paper texture, grain or decorative patterns. Deliver two files: 2400×1500 landscape and 1200×2600 portrait, door frame on the left edge in both.

附图建议：B1 附 `source/kitchen-clean.png` 和 `docs/bg-templates/B1-table-band-template.png`；B2 附 `source/comic-v3/05-looking-for-baby.png` 和 `docs/bg-templates/B2-hallway-landscape-template.png`。

## 6. 接入方式（图到位后）

1. 文件放进 `public/assets/scene/`（B1）和 `public/assets/bg/`（B2）。
2. `backgrounds.json`：`table.src` 填 B1，`table.showBox` 填 `[-232, 860, 2000, 400]`；`hallway.src` / `hallway.srcPortrait` 填 B2 两个版本。
3. 不改镜头、蛋的锚点和漫画格；接入后按本规格的落点和留空区截图复核。
