# 后景出图规格与连续后景（按现有动画定稿）

数据来源：镜头关键帧、换场曲线、占位色和图片槽位都在 `src/app/preview/visual/backgrounds.json`；节拍在 `beats.visual-v2.json`；漫画格位置在 `slots.json`。**正式图到位后只改 `backgrounds.json`（`src` / `srcPortrait`），不改代码。**

坐标约定：**场景坐标** = 原厨房画布 1536×1024 的像素；蛋的锚点是**脚底中心**。版位图在 `docs/bg-templates/`。

预览：`/preview/background`（`?guides=1` 参考线，`?fg=0` 只看后景 + 蛋，`?debug=1` 占位说明，`?clean=1` 录屏）。检查：`node tools/bg_constraints.mjs`（纯计算）、`node tools/bg_check.mjs`（无头 Chrome 实测）。

## 1. 缺图清单（真正要出的只有三张）

| 背景 | 用在哪些段 | 现状 | 是否要出图 |
|---|---|---|---|
| 厨房分层（远景、中景台面、主体、锅沿遮挡、近景） | opening、drop | 现有，从 kitchen-clean 拆出 | **复用，不出图** |
| 纸面（暖米白 #f7eedd） | drop 之后到 punchline（search / eggcall 除外） | 平涂 | **不出图**，保持干净纯色，不加纸纹 |
| **B1 桌沿带** | 同上；纸面下沿露出的桌面，蛋在这里等待和起跳；蛋交给漫画后整体上移 32 像素当饭桌 | **占位**：平涂色块（桌面 #ead5b2、前侧面 #dcc29a、下方 #ecdcc3），已经盖住厨房 y≥860，灶台脚不再露出 | **缺，必须出图**（1 张） |
| **B2 寻找段外围**（浅色墙面 + 局部门框 + 纸白） | search、eggcall | **占位**：平涂 #f6eee2 | **缺，必须出图**（横版、竖版各 1 张） |
| 女儿房间 | — | 由漫画格 p5c（空房间）承担 | **不出图**；外围不铺完整房间 |
| 收尾背景 | closeup | 平涂 #f6eee2，盖住一切（含 B1） | **不出图** |

所有占位都只用平涂色块，没有纹理；说明文字只在 `?debug=1` 显示。

## 2. 连续后景：每一段是什么、怎么换

全部由同一条时间轴 `g = 段号 + 段内进度` 驱动（`motion.v2.ts` 的 `curve()` / `gNow()`），曲线是 smoothstep 插值，只有不透明度和位移。

| 段落 | 后景 | 换场（`backgrounds.json` 曲线） |
|---|---|---|
| opening | 厨房全景，蛋在锅里 (720,670) 跳 | — |
| drop | 厨房 → **桌沿 + 纸面** | 镜头向左下跟到桌沿（焦点 768,560 → 420,860，放大 1.00 → 1.14）。`paper` 和 `table` 都从 drop 70% 淡入到 bag 30%：纸面盖住灶台、锅、墙，B1 盖住厨房桌面和灶台脚。蛋在 drop 75% 落到桌面上，此时 B1 已开始出现 |
| bag … hear | 桌沿 + 纸面，蛋在桌沿等待 | 纸面和 B1 是一个整体，跟随主体层视差（`--kl-mid-x/y`，和蛋同一组变量），所以蛋和桌沿始终锁在一起；整体随阅读轻微漂移 |
| catch | 桌沿 + 纸面 | 镜头移到 640,790、放大 1.08；蛋从桌沿等待点起跳飞进接蛋格 |
| handoff → bowl | 桌沿 → **饭桌** | `dinner`：handoff 45% → bowl 60%，纸面 + B1 整体上移 0 → −32 场景像素（露出更多桌面）。蛋在 handoff 36% 之前已完全淡出，上移时场景里没有蛋 |
| yolk、call | 饭桌 | 不变 |
| search、eggcall | **B2 外围**，盖住全屏 | `hallway`：call 85% → search 25% 淡入，eggcall 70% → return 20% 淡出。`hallwayDrift`：同一时段外围从右往左持续漂移 +2.5vw → −2.5vw（像镜头转到家里另一处、再转回来） |
| return … punchline | 饭桌（B2 淡出后露回） | — |
| closeup | **收尾平涂**，盖住全屏 | `ending`：punchline 72% → closeup 40% 淡入，之后安静停住 |

层级：厨房分层 10–61 → **纸面组 62**（组内 B1 在下、纸面在上）→ 桌沿蛋 63 → 前景妈妈 70 → 飞行蛋 80（以上都在场景舞台里）→ **B2 外围 / 收尾**（页面层 fixed z-5，盖住整个场景舞台）→ 漫画层（fixed z-10）。

## 3. 唯一的蛋：坐标约束

只有一个蛋元素（`img[src*="egg.webp"]`），由 `Egg.tsx` 状态机移动；后景从不卸载或复制它，也不画第二个锅或蛋。

| 点 | 场景坐标（脚底） | 说明 |
|---|---|---|
| 锅内起跳 `panLaunch` | **(720, 670)** | 锅沿遮挡线下 13px，被 pan-rim 层挡住脚 |
| 桌沿等待 `tableWait`（横版） | **(120, 965)** | 显示 0.5 倍 = 194×194：蛋身 x 23…217、y 771…965；轻跳最高再高 23；接触阴影约 x 58…182、y 950…973 |
| 桌沿等待 `portraitTableWait`（窄布局） | **(520, 990)** | 蛋身 x 423…617、y 796…990；接触阴影 y 975…998 |
| 起跳点（飞向接蛋格） | = 当前桌沿等待点 | 飞行最高点 = 接蛋格上框 − 12% 格高（`flightApexY`） |
| B1 桌面 | 上沿 **y 920**，前缘 **y 995**，前侧面到 1060 | 两个等待点的脚底都在桌面上（横版在 60% 处，窄版在 93% 处） |

“窄布局”= 接蛋格在接蛋镜头下放不下（与 `preview/visual/page.tsx` 的 `fitSlotsV2` 同一判定），不是简单的竖屏；4:3 也是窄布局。

沿镜头路径（drop 75% → catch 22%）逐点计算的结果（`node tools/bg_constraints.mjs`）：

| 视口 | 宽高比 | 窄布局 | 桌沿等待点 | 锅在画面内 | 脚底在桌面上 (920–995) | hear 时可见场景 | 蛋身离屏幕边最小距离 左/右/上/下 (屏幕 px) | 前缘线离屏幕下沿 (px) | 结果 |
|---|---|---|---|---|---|---|---|---|---|
| 1600×900 | 1.78 | 否 | 120,965 | 是 | 是 | x 0…1302, y 292…1024 | 26 / 1333 / 589 / 66 | 33 | ✓ |
| 1440×900 | 1.60 | 否 | 120,965 | 是 | 是 | x 0…1302, y 210…1024 | 23 / 1200 / 620 / 60 | 29 | ✓ |
| 1024×768 | 1.33 | 是 | 520,990 | 是 | 是 | x 0…1157, y 156…1024 | 343 / 478 / 566 / 28 | 23 | ✓ |
| 860×1000 | 0.86 | 是 | 520,990 | 是 | 是 | x 121…868, y 156…1024 | 243 / 279 / 737 / 36 | 31 | ✓ |
| 390×844 | 0.46 | 是 | 520,990 | 是 | 是 | x 260…661, y 156…1024 | 37 / 41 / 622 / 30 | 26 | ✓ |

无头实测（`node tools/bg_check.mjs`，每 5vh 采样一次，结果见 `notes/background-scenes/check.md`）：五个视口全程蛋元素都是 1 个；交接之后蛋不再出现；蛋在桌沿的每个采样点，脚底都在 B1 的上沿和前缘之间，整只蛋在视口内。

**改这些值要注意**：`tableWait` 往右移会进入横版 bag / idea 漫画格下方；往下移超过 ~1000 会在 4:3 和手机上贴到屏幕下沿（下沿余量只有 23–30 屏幕像素）。`anchors` 和 `camera` 由集成会话维护，要改先提请求。

## 4. B1 桌沿带

- **画布**：交付 **4000×800**（2 像素 = 1 场景像素），对应场景 **x −232…1768，y 860…1260**（`table.showBox = [-232, 860, 2000, 400]`），比例 5:1。左右和下方超出厨房画布的部分是给视差和饭桌上移留的余量。
- **视角**：与现有厨房同一视角，平视略俯；桌面是一条水平台面，透视线水平，不要斜。
- **桌沿高度**（画布像素 = (场景 y − 860) × 2）：
  - 0–120（场景 860–920）：米白纸色，会被纸面盖住；
  - 120–210（场景 920–965）：桌面后部，纸面在这里羽化过来，要能被纸色渐隐盖住而不突兀；
  - 120–270（场景 920–995）：**桌面**，蛋站在这里；
  - **270（场景 995，±10）：桌沿前缘线**，一条清晰的水平线；
  - 270–400（场景 995–1060）：桌子前侧面；
  - 400–800（场景 1060–1260）：柔和的暖色阴影，到底部接近米白。
- **蛋的落点和必须留空的区域**（场景坐标；画布 x = (场景 x + 232) × 2）：
  - 横版蛋 (120, 965)，蛋身 x 23…217；窄版蛋 (520, 990)，蛋身 x 423…617；
  - 留空：**x −150…330** 和 **x 400…640** 的整个桌面（画布 x 164…1124 和 1264…1744），不放任何物件；其余部分也建议全空。不要锅柄、灶台脚、桌腿、碗、抹布伸进这条带。
- **安全裁切**：横版各视口可见 x 0…1302（加视差余量 −150…1536）；窄布局 860×1000 看到 x 121…868，手机 390×844 看到 x 260…661。重点放在 x 0…1302；两端只做延续。
- **遮挡关系**：B1 不透明，在纸面组里（z 62），压在厨房所有层之上、纸面之下、蛋之下；完整盖住厨房 y≥860 的部分（包括灶台脚）。蛋站在桌面上，不需要遮挡层；接触阴影由代码画。

## 5. B2 寻找段外围（浅色墙面 + 局部门框 + 纸白）

漫画里已经有走廊、门口探头和空房间三个镜头，外围只负责“在家里另一处”的空间感，不铺完整房间。

- **横版 2400×1500（16:10）**：视口宽高比 ≥ 1.0 时用。显示层比视口左右各宽 2.5%（漂移余量），object-fit cover：16:9 上下各裁掉约 110 像素，16:10 上下各约 35，4:3 左右各约 200；漂移再让左右各有约 115 像素时有时无。**重点放在中间 2000×1250 以内**。
- **竖版 1200×2600**：视口宽高比 < 1.0 时用（手机、860×1000 窄窗口）。手机 390×844 几乎整张可见；860×1000 只看到中间约 1330 高（y 635…1965）。**重点放在中间 1080×1300 以内**，上下只做延续。
- **视角**：平视，正对墙面，几乎没有透视。
- **画什么**：浅暖色墙面（与漫画走廊的米白/浅黄墙一致）；左侧一段**局部门框**，放在画面宽度约 **11%–18%**（横版 x 265…430，竖版 x 130…215），不要贴边，否则漂移和 4:3 裁切会把它切掉；门框只露木框和一点门洞阴影，不画门内房间；下方一条细踢脚线（横版约 88% 高，竖版约 90%，窄窗口下可能被裁掉，不承担信息）；其余是干净纸白。
- **必须留空**：漫画格覆盖的区域（版位图红框 = 寻找段 p5a、p5b、p5c；蓝框 = 蛋喊段 p5d、p5e）保持墙面平涂，不画细节；门框被 p5a / p5d 部分压住是正常的。不要人物、文字、家具、植物、相框、灯。
- **遮挡关系**：页面层（fixed z-5），整张不透明，盖住厨房、纸面和 B1；在漫画层（z-10）之下。

## 6. 交给图像会话的提示词

风格基准：与现有厨房图 `source/kitchen-clean.png` 和六页漫画同一画风——温暖的手绘水彩上色、细墨线、柔和米白与浅木色、低饱和、干净，不要纸纹、颗粒或装饰图案。

### B1 桌沿带（4000×800，PNG，不透明）

中文：

> 一条横向的木质餐桌桌沿，温暖手绘水彩加细墨线的绘本风格，与附图厨房同一画风和色调（浅暖木色、米白背景）。平视略俯，桌面是水平的一条台面，透视线完全水平。画布 4000×800，从上到下：最上方 0–120 像素是干净的米白纸色；120–270 像素是浅木色桌面，上部 120–210 像素要淡、能自然地被米白渐隐盖住；270 像素处是一条清晰的水平桌沿前缘线；270–400 像素是桌子前侧面，颜色略深；400 像素以下是柔和的暖色阴影，到最底部接近米白。整条桌面完全空着，没有锅、碗、餐具、桌腿、灶台、抹布、人物和文字，尤其左边 164–1124 像素和 1264–1744 像素这两段要绝对干净（角色会站在这里）。左右两端无缝延续。不要纸纹、颗粒、图案。

English:

> A long horizontal wooden table edge in a warm hand-painted watercolor storybook style with thin ink lines, matching the attached kitchen illustration (soft light wood, cream background). Eye level, looking very slightly down; the tabletop is a level horizontal band with perfectly horizontal perspective. Canvas 4000×800, top to bottom: rows 0–120 px plain cream paper; rows 120–270 px light wood tabletop, with the upper part (120–210 px) pale so it can fade smoothly into cream; at row 270 px one clean horizontal front edge of the table; rows 270–400 px the slightly darker front face of the table; below 400 px a soft warm shadow fading to cream at the bottom. The table is completely empty: no pans, bowls, utensils, table legs, stove, cloth, people or text; the stretches x 164–1124 px and x 1264–1744 px must be perfectly clean because a character stands there. Both ends continue seamlessly. No paper texture, grain or patterns.

附图：`source/kitchen-clean.png`、`docs/bg-templates/B1-table-band-template.png`。

### B2 寻找段外围，横版（2400×1500）与竖版（1200×2600），PNG，不透明

中文：

> 家里一面浅暖色的墙，与附图漫画同一画风：温暖手绘水彩加细墨线的绘本风格。正对墙面、平视、几乎没有透视。画面左侧、离左边缘约 11% 到 18% 的位置，有一段竖直的浅木色门框（只画门框和门洞边缘一点阴影，不画门内房间，不要贴着画面边缘）。下方一条细细的木质踢脚线（横版在高度约 88%，竖版约 90%）。其余大面积是干净平整的米白墙面，用来叠放漫画格，所以中间不要任何细节。不要人物、家具、植物、相框、灯、文字，不要纸纹、颗粒或装饰图案。输出两个文件：2400×1500 横版（重点在中间 2000×1250 内）和 1200×2600 竖版（重点在中间 1080×1300 内，上下只做墙面延续），两版的门框都在左侧同样的相对位置。

English:

> A plain, light warm-colored wall inside a home, in the same warm hand-painted watercolor storybook style with thin ink lines as the attached comic pages. Straight-on, eye level, almost no perspective. On the left side, about 11% to 18% of the width from the left edge (not touching the edge), a vertical light-wood door frame: just the frame and a hint of shadow at the doorway, do not show the room beyond. A thin wooden skirting board near the bottom (about 88% of the height in landscape, 90% in portrait). Everything else is clean, flat cream wall because comic panels will sit on top, so no detail in the middle. No people, furniture, plants, picture frames, lamps or text; no paper texture, grain or decorative patterns. Deliver two files: 2400×1500 landscape (keep everything important inside the central 2000×1250) and 1200×2600 portrait (important content inside the central 1080×1300; top and bottom are just more wall), with the door frame at the same relative position on the left in both.

附图：`source/comic-v3/05-looking-for-baby.png`、`docs/bg-templates/B2-hallway-landscape-template.png`。

## 7. 接入方式（图到位后，只改 backgrounds.json）

1. 文件放进 `public/assets/scene/`（B1，例如 `table-band.webp`）和 `public/assets/bg/`（B2，例如 `hallway-landscape.webp`、`hallway-portrait.webp`）。
2. `backgrounds.json`：
   - `table.src` 填 B1 路径（`showBox` 已是 `[-232, 860, 2000, 400]`，图按它拉伸铺满；`topY` / `edgeY` 只在图的桌面高度和规格不同时改）；
   - `hallway.src` 填 B2 横版，`hallway.srcPortrait` 填竖版；门框位置不同可调 `hallway.focus`（object-position，0–1）。
3. 不改镜头、蛋的锚点和漫画格。接入后跑 `node tools/bg_check.mjs`，再在 `/preview/background?guides=1` 截图复核落点和留空区。
