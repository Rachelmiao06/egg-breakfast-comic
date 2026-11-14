# 后景出图任务书（B1、B2 横版、B2 竖版）：交给图片生成 agent

这份任务书写给图片生成 agent。技术数据以 `docs/BACKGROUND-TECH.md` 和 `docs/bg-templates/tech-*.png` 为准：它们由 `tools/bg_tech.py` 从代码算出，数字和这里一致；如有出入，以重跑后的 TECH 文件为准。`docs/BACKGROUND-SPEC.md` 只写时间轴和蛋的路径，不写美术。B3（饭桌上的碗）已复用第 3 页 p3b 的碗，不用出图。

单位：**图片像素**（该图自己的画布，左上 (0,0)）；**%** = 占该图宽或高的比例；**场景像素** = 厨房画布 1536×1024。

## 0. 美术方向（三张通用）

- **方向**：从温暖的厨房出发，逐渐进入一个和**食物、家庭、想象**有关的水彩画境。后景本身要好看，可以单独欣赏，而不是漫画周围的空白墙纸。
- **不再用**空墙、门框、踢脚线、木板这类构图。
- **风格基准**：和现有厨房图、六页漫画同一套语言：温暖的手绘水彩上色、细墨线、柔和的米白与浅暖色、低饱和、干净。不要加纸纹、颗粒或滤镜式的纹理叠层（水彩笔触本身可以有）。
- **三张都不要**：人物（妈妈由漫画承担）、荷包蛋、蛋黄、蛋白（唯一的蛋由代码绘制）、文字、字母、数字、标志。
- **构图原则**：被漫画格压住的区域只用大面积、低对比的水彩晕染。可以单独欣赏的主体放在“始终可见区”里、漫画格之外（各图下面有具体范围）。
- **镜头**：画面会被平移、推近、左右漂移，所以边缘要能自然延续，不能把重要东西放在边缘。

## 1. B1 桌沿带：蛋站立的“饭桌大地”

| 项目 | 数据 |
|---|---|
| 文件 | `table-band.png`（或 `.webp`），4000×800 图片像素，5:1，**不透明** |
| 参考图 | `source/kitchen-clean.png`（被它替换的厨房桌面、配色和线条）；`source/comic-v3/04-catch-and-call.png`（漫画里饭桌和碗的色调）；`public/assets/scene/bowl-body.png`（会放在这条桌面上的碗）；`docs/bg-templates/tech-B1-table-band.png`（版位模板，可直接叠在生成图上检查） |
| 它在画面里 | 横跨屏幕底部的一条“地面”。蛋在上面等待、蓄力、起跳；之后它就是饭桌，环境段 tablecall 的碗放在上面。平时纸面盖住它的上部，只露出桌面和前缘；环境段 prejump 时纸面变成半透明，厨房从后面透出来 |

**构图范围**（图片像素 / %）：

| 区域 | 位置 | 要求 |
|---|---|---|
| 代码渐变区 | y 0–120（0–15%） | 代码把它渐变成透明，厨房会从这里透出来。不要放硬边或物件，颜色接近米白 |
| **站立面（桌面）** | y 120–270（15–33.75%） | 必须读得出是一个**水平、可以站人的面**，透视水平。其中 y 120–210 会被纸色渐隐盖住，要淡 |
| **前缘线** | y 270（33.75%），±20 | 一条清楚的水平边。蛋站在它上方的面上 |
| 前侧面 | y 270–400（33.75–50%） | 只露出最上面约 60 图片像素（y 270–328）。可以有装饰：花边、刺绣般的蔬菜纹、水彩小丘的边缘 |
| 下方余量 | y 400–800（50–100%） | 平时看不到，只在视差时露一点。自然延续即可 |

**前景遮挡区**：
- **蛋**：活动区为图片 x 2310–3468（58–87%）、y 0–292。蛋身会高出站立面，叠在纸面上。这里的站立面必须干净，不要物件，也不要高对比纹样。
- **碗**：tablecall 时碗放在图片 x 1606–2124、y 0–204 附近。这里同样保持干净。
- **漫画格**：会避开蛋，其他位置可能压在站立面上方，所以站立面不承载需要被看见的信息。
- 综上，**整条站立面 x 464–3536 不放任何物件**（锅、碗、餐具、桌腿、灶台、人物、文字）。可以欣赏的部分放在前缘线和前侧面上，用色彩和笔触，不用物件。

**镜头移动预留区**：
- 所有视口看到的横向范围是图片 x **464–3536**（11.6–88.4%）。
- 左右各 464 像素只给视差和推近，内容自然延续。
- 竖直方向平时看到 y 120–328。推近和视差最多再往下露到约 y 400。

**透明图层**：只要这一张，不透明。蛋和蛋的接触阴影都由代码画，不要分层，也不要画阴影。

**指令（中文）**：

> 一条横向的“饭桌大地”，4000×800 像素，不透明，温暖手绘水彩加细墨线的绘本风格，和附图厨房、漫画同一画风与色调。这是一张饭桌，也像一片被想象成大地的桌面：上方 15%（0–120 像素）是接近米白的淡色，会被代码渐隐成透明，不要放任何硬边或物件；120–270 像素是一个水平的站立面（透视完全水平），像铺着浅暖色桌布、慢慢晕成柔和田垄的地面，上部（120–210 像素）要淡；在 270 像素处有一条清楚的水平前缘线；前缘线以下是前侧面，可以画成带蔬菜刺绣（青豆、胡萝卜丁、玉米粒）的桌布垂边，逐渐化成水彩小丘和饭香的雾气，再往下自然延续。整条站立面在横向 464 到 3536 像素之间完全空着，不放任何物件；可以欣赏的细节放在前缘线和垂边上。左右两端无缝延续。不要人物、荷包蛋、蛋黄、文字，不要纸纹或颗粒。

**Prompt (English)**:

> A long horizontal "dinner-table land", 4000×800 px, opaque, in a warm hand-painted watercolor storybook style with thin ink lines, matching the attached kitchen and comic pages. It is a dinner table that also reads as an imagined landscape. Top 15% (rows 0–120): pale near-cream, no hard edges or objects (code fades it to transparent). Rows 120–270: one level standing surface with perfectly horizontal perspective, like a pale warm tablecloth softly turning into gentle field furrows; keep its upper part (rows 120–210) light. At row 270: one clear horizontal front edge. Below it, the front face: a hanging tablecloth hem with embroidered vegetables (green peas, diced carrot, corn) that dissolves into small watercolor hills and wisps of warm steam, continuing naturally to the bottom. Keep the whole standing surface between x 464 and x 3536 completely empty, with no objects; put the decorative detail on the front edge and the hem. Both ends continue seamlessly. No people, no fried egg or yolk, no text, no paper texture or grain.

## 2. B2 横版：寻找段的水彩画境

| 项目 | 数据 |
|---|---|
| 文件 | `hallway-landscape.png`（或 `.webp`），2400×1500 图片像素，16:10，**不透明** |
| 参考图 | `source/comic-v3/05-looking-for-baby.png`（叠在它上面的漫画格，配色不能和它们打架）；`source/kitchen-clean.png`（转场起点）；`docs/bg-templates/tech-hallway-landscape.png`（版位模板） |
| 它在画面里 | 妈妈去找女儿、蛋喊“妈！这里！”的两段。它整张盖住厨房和桌面，在漫画格下面，从饭桌淡入（tablecall 85% → search 25%），再淡出（eggcall 70% → return 20%）。全程从右往左慢慢漂移 |
| 何时用 | 视口宽高比 ≥ 1.0 |

**构图范围**：
- **始终可见区**（16:9、16:10、4:3 加上漂移都看得到）：图片 x **250–2150**、y **107–1393**，即宽 10.4–89.6%、高 7.1–92.9%。
- 各视口未漂移时看到的范围：16:9 为 x 57–2343、y 107–1393；16:10 为 x 57–2343、y 36–1464；4:3 为 x 200–2200、y 0–1500。

**前景遮挡区（漫画格，三种视口的并集）**：

| 格 | 段落 | 图片像素 | % |
|---|---|---|---|
| p5a | 寻找 | x 240–672，y 120–622 | 宽 10–28%，高 8–41% |
| p5b | 寻找 | x 720–1416，y 150–876 | 宽 30–59%，高 10–58% |
| p5c | 寻找 | x 1451–2160，y 510–1138 | 宽 60–90%，高 34–76% |
| p5d | 蛋喊 | x 336–1063，y 120–869 | 宽 14–44%，高 8–58% |
| p5e | 蛋喊 | x 1337–1872，y 510–1075 | 宽 56–78%，高 34–72% |

**可以放主体的位置**（始终可见，又不被漫画格压住）：
1. **下方一整条**：y 1138–1393（高 76–93%），横跨 x 250–2150。最适合放画境的“地面”：远山、田野、小路。
2. **右上角**：x 1416–2150、y 107–510（宽 59–90%，高 7–34%）。适合一个可以单独欣赏的主体，例如一团像蒸汽的云或一轮暖色的光。
3. 漫画格下面只用大面积、低对比的天空或雾气晕染。

**镜头移动预留区**：
- 显示时容器比视口左右各宽 2.5%，`object-fit: cover` 居中，然后从右往左漂移 ±2.5vw。在图片上，16:9 和 16:10 是左右各约 57 像素，4:3 是约 50 像素。
- 始终可见区以外的边缘只做延续。

**透明图层**：
- 现在的实现是一张不透明图，不需要分层。
- 可选，代码暂未支持：如果想让画境更有纵深，可以另出一张透明的“近景层”（底部 y 1250–1500 的雾气或叶子剪影），以后加上不同的漂移速度。
- 也可以按共享笔记 `seam-transitions-notes.md` 的建议，另出一张手绘水彩边缘遮罩（透明 PNG，黑白），做从饭桌进入画境的“晕开”转场。
- 两者都要另改代码，没有也能用。

**指令（中文）**：

> 一幅横向的水彩画境，2400×1500 像素，不透明，和附图漫画同一画风：温暖手绘水彩加细墨线的绘本风格，柔和米白和浅暖色，低饱和。这是妈妈在家里寻找女儿时、从温暖厨房延伸出去的想象风景，和食物、家庭有关：远处的山丘像一碗碗冒着热气的米饭，田野里有青豆、胡萝卜丁和玉米粒那样的色点，一条像缎带的小路弯向远方，天空里漂着像蒸汽的云，整体温柔、有一点思念。构图：地平线很低，在高度约 76% 处；76–93% 的下方一整条（左右 10–90% 之间）是可以细看的地面和小路；右上角（宽 59–90%、高 7–34%）放一个可以单独欣赏的主体，例如一团蒸汽云或一轮暖光；画面中间和左上大部分区域（宽 10–90%、高 8–76%）会叠放漫画格，只用大面积、低对比的天空晕染，不要细节。左右边缘和最上、最下 7% 只做自然延续。不要人物、荷包蛋、蛋黄、文字，不要墙、门框、踢脚线、木板，不要纸纹或颗粒。

**Prompt (English)**:

> A landscape-format watercolor dreamscape, 2400×1500 px, opaque, in the same warm hand-painted watercolor storybook style with thin ink lines as the attached comic pages, soft cream and pale warm colors, low saturation. It is an imagined landscape that grows out of a warm kitchen while a mother searches her home for her daughter, about food and family: distant hills shaped like steaming bowls of rice, fields dotted with peas, diced carrot and corn, a ribbon-like path winding into the distance, steam-like clouds drifting in the sky; gentle and a little wistful. Composition: a low horizon at about 76% of the height. The band from 76% to 93% of the height (between 10% and 90% of the width) holds the detailed ground and path. Place one standalone focal motif in the upper right (59–90% of the width, 7–34% of the height), such as a steam cloud or a warm glow. Most of the middle and upper left (10–90% width, 8–76% height) will be covered by comic panels, so keep it to broad, low-contrast sky washes with no detail. The outer edges and the top and bottom 7% only continue the scene. No people, no fried egg or yolk, no text; no walls, door frames, skirting boards or wooden planks; no paper texture or grain.

## 3. B2 竖版：寻找段的水彩画境（手机、窄窗口）

| 项目 | 数据 |
|---|---|
| 文件 | `hallway-portrait.png`（或 `.webp`），1200×2600 图片像素，6:13，**不透明** |
| 参考图 | 同横版，另附 `docs/bg-templates/tech-hallway-portrait.png` |
| 何时用 | 视口宽高比 < 1.0（手机 390×844、860×1000 窄窗口） |

**构图范围**：
- **始终可见区**：图片 x **57–1143**、y **636–1964**，即宽 4.8–95.2%、高 24.5–75.5%。860×1000 只看到中间这一段，手机 390×844 几乎整张可见（y 63–2537）。

**前景遮挡区**：
- 竖屏的漫画排成一列，覆盖 x 63–1137（宽 5–95%），几乎全高，并在阅读时上移。
- 任何位置都可能某一时刻被压住，所以竖版**没有固定不被遮住的区域**。

**可以放主体的位置**：
- 可欣赏的主体放在中段 y 636–1964 之内，接受会被格子间歇遮住。
- 尽量用大的色块和形状（远山的轮廓、大朵蒸汽云）表达，不靠小细节。
- 上下两端（y 0–636、1964–2600）只在手机上可见，放天空和地面的延续。

**镜头移动预留区**：左右漂移各约 29 图片像素。左右边缘只做延续。

**透明图层**：同横版。现在一张不透明图；近景层和水彩边缘遮罩是可选项，要另改代码。

**指令（中文）**：

> 一幅竖向的水彩画境，1200×2600 像素，不透明，和横版同一主题和画风（温暖手绘水彩加细墨线，柔和米白和浅暖色，低饱和）：从温暖厨房延伸出去、和食物与家庭有关的想象风景，有像冒热气的米饭的远山、带青豆和胡萝卜丁色点的田野、像缎带的小路、像蒸汽的云。竖向构图：上部（0–25%）是天空，中段（25–75%）用大块、简洁的形状表达主体（一座大的米饭山丘轮廓、一团大蒸汽云、小路在这里转弯），因为漫画格会一格格从这里经过并间歇遮住它，所以不要靠小细节；下部（75–100%）是地面和小路的延续。左右边缘只做延续。不要人物、荷包蛋、蛋黄、文字，不要墙、门框、踢脚线、木板，不要纸纹或颗粒。

**Prompt (English)**:

> A portrait-format watercolor dreamscape, 1200×2600 px, opaque, same theme and style as the landscape version (warm hand-painted watercolor with thin ink lines, soft cream and pale warm colors, low saturation): an imagined landscape about food and family growing out of a warm kitchen, with distant hills like steaming rice, fields dotted with peas and diced carrot, a ribbon-like path and steam-like clouds. Vertical composition: the top (0–25%) is sky. The middle (25–75%) carries the main subject in large, simple shapes (the outline of one big rice-hill, one large steam cloud, the path turning here). Comic panels will pass over this area one by one and cover it intermittently, so do not rely on small details. The bottom (75–100%) continues the ground and path. Side edges only continue the scene. No people, no fried egg or yolk, no text; no walls, door frames, skirting boards or wooden planks; no paper texture or grain.

## 4. 交付和接入

- **交付**：交付文件名和尺寸必须和上表一致。生成后把对应的 `docs/bg-templates/tech-*.png` 半透明叠在图上，检查前缘线、留空和始终可见区。
- **接入**：只改 `src/app/preview/visual/backgrounds.json`：`table.src`、`hallway.src`、`hallway.srcPortrait`。
- **复核**：接入后跑 `node tools/bg_check.mjs`，并在 `/preview/background?guides=1` 截图。
