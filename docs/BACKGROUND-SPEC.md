# 后景出图规格与连续后景（按现有动画定稿）

数据来源：镜头关键帧、换场曲线、占位色和图片槽位都在 `src/app/preview/visual/backgrounds.json`；节拍在 `beats.visual-v2.json`；漫画格位置在 `slots.json`。**正式图到位后只改 `backgrounds.json`（`table.src`、`hallway.src` / `srcPortrait`、`bowl.src` / `srcFront`），不改代码。**

坐标约定：**场景坐标** = 原厨房画布 1536×1024 的像素；蛋的锚点是**脚底中心**。版位图在 `docs/bg-templates/`。

预览：`/preview/background`（`?guides=1` 参考线，`?fg=0` 只看后景 + 蛋，`?debug=1` 占位说明，`?clean=1` 录屏）。检查：`node tools/bg_constraints.mjs`（纯计算）、`node tools/bg_check.mjs`（无头 Chrome 实测）。

## 1. 缺图清单（真正要出的五个文件）

| 背景 | 用在哪些段 | 现状 | 是否要出图 |
|---|---|---|---|
| 厨房分层（远景、中景台面、主体、锅沿遮挡、近景） | opening、drop | 现有，从 kitchen-clean 拆出 | **复用，不出图** |
| 纸面（暖米白 #f7eedd） | drop 之后到 punchline（search / eggcall 除外） | 平涂 | **不出图**，保持干净纯色，不加纸纹 |
| **B1 桌沿带** | 同上；纸面下沿露出的桌面，蛋在这里等待、蓄力（prejump）和起跳；蛋交给漫画后当饭桌 | **占位**：平涂色块（桌面 #ead5b2、前侧面 #dcc29a、下方 #ecdcc3），已经盖住厨房 y≥860，灶台脚不再露出 | **缺，必须出图**（1 张） |
| **B2 寻找段外围**（浅色墙面 + 局部门框 + 纸白） | search、eggcall | **占位**：平涂 #f6eee2 | **缺，必须出图**（横版、竖版各 1 张） |
| **B3 饭桌上的碗**（含前沿遮挡层，与 tableBowl 对位） | 环境段 tablecall | **占位**：平涂 SVG 碗（碗身 #fbf7ee、碗内 #efe6d4、描线 #b7a07c），碗身在蛋之下、前沿在蛋之上 | **缺，必须出图**（碗身 + 前沿遮挡层，2 个文件） |
| 女儿房间 | — | 由漫画格 p5c（空房间）承担 | **不出图**；外围不铺完整房间 |
| 收尾背景 | closeup | 平涂 #f6eee2，盖住一切（含 B1） | **不出图** |

真正缺的是 **B1、B2（横 + 竖）、B3（碗身 + 前沿）**，共 5 个文件。所有占位都只用平涂色块，没有纹理；说明文字只在 `?debug=1` 显示。

## 2. 连续后景：每一段是什么、怎么换

全部由同一条时间轴 `g = 段号 + 段内进度` 驱动（`motion.v2.ts` 的 `curve()` / `gNow()`），曲线是 smoothstep 插值，只有不透明度和位移。

| 段落 | 后景 | 换场（`backgrounds.json` 曲线） |
|---|---|---|
| opening | 厨房全景，蛋在锅里 (720,670) 跳 | — |
| drop | 厨房 → **桌沿 + 纸面** | 镜头向左下跟到桌沿（焦点 768,560 → 420,860，放大 1.00 → 1.14）。`paper` 和 `table` 都从 drop 70% 淡入到 bag 30%：纸面盖住灶台、锅、墙，B1 盖住厨房桌面和灶台脚。蛋在 drop 75% 落到桌面上，此时 B1 已开始出现 |
| bag … missing | 桌沿 + 纸面，蛋在桌沿等待 | 纸面和 B1 是一个整体，跟随主体层视差（`--kl-mid-x/y`，和蛋同一组变量），所以蛋和桌沿始终锁在一起；整体随阅读轻微漂移 |
| **prejump**（环境段，无漫画格） | **桌沿 + 透出的厨房**：后景是主体 | `paper`：missing 85% → prejump 30% 纸面降到 0.5，prejump 82% → hear 20% 回到 1。活着的厨房（锅、火、黄锅、瓶罐）从桌沿后面透出来，B1 上沿 60 像素做透明渐变（`table.fadeTop`），厨房和桌面之间没有硬边。镜头推到桌沿（放大 1.26 → 1.30）并跟随蛋的站点 |
| hear | 桌沿 + 纸面 | 纸面回到不透明 |
| catch | 桌沿 + 纸面 | 镜头移到 640,790、放大 1.08；蛋从桌沿等待点起跳飞进接蛋格 |
| handoff … call | 饭桌（同一条桌沿） | `dinner` 曲线保留为位移旋钮（当前 0）：B1 正式图到位后如果桌面高度要为饭桌微调，只改这里 |
| **tablecall**（环境段，无漫画格） | **空饭桌 + B3 碗**：后景是主体 | `bowl`：call 90% → tablecall 12% 碗淡入（蛋在 tablecall 进入阶段 40% 后才淡入，碗先在），search 15% → 30% 碗淡出（此时 B2 已盖满）。纸面保持干净，画面只有桌沿、碗和碗里喊话的蛋，突出“空”。镜头推到 700,880、放大 1.22 并跟随碗 |
| search、eggcall | **B2 外围**，盖住全屏 | `hallway`：tablecall 85% → search 25% 淡入，eggcall 70% → return 20% 淡出。`hallwayDrift`：同一时段外围从右往左持续漂移 +2.5vw → −2.5vw（像镜头从饭桌转到家里另一处、再转回来） |
| return … punchline | 饭桌（B2 淡出后露回） | — |
| closeup | **收尾平涂**，盖住全屏 | `ending`：punchline 72% → closeup 40% 淡入，之后安静停住 |

层级：厨房分层 10–61 → **纸面组 62**（组内 B1 在下、纸面在上）→ **B3 碗身 62**（DOM 在纸面组之后）→ 桌沿蛋 / 碗里的蛋 63 → **B3 前沿遮挡层 64**（`Z.bowlFront`）→ 前景妈妈 70 → 飞行蛋 80（以上都在场景舞台里）→ **B2 外围 / 收尾**（页面层 fixed z-5，盖住整个场景舞台）→ 漫画层（fixed z-10）。

## 3. 唯一的蛋：坐标约束与接蛋路径

只有一个蛋元素（`img[data-active-egg]`，`egg.webp`），由 `Egg.tsx` 状态机移动；后景从不卸载或复制它，也不画第二个锅或蛋（B3 占位碗里没有蛋）。

### 3.1 接蛋路径（2026-11-14 用户要求，按人物视线和铲面位置设计）

接蛋格 p3e 的画面（格内比例，`backgrounds.json` 的 `eggPath.panel`）：妈妈在左侧、面朝右，眼睛约 (0.23, 0.25)；“哎？慢点！”气泡 x 0.30–0.555、y 0.05–0.30；锅铲向右伸，铲面 x 0.69–0.865、y 0.39–0.56，落点 (0.775, 0.49)。漫画不镜像。

路径规则（`src/app/preview/visual/eggPath.ts`，所有视口用同一套规则按布局算）：
1. **桌沿等待点 = 起跳点在铲面右侧、接蛋格右缘之外**：x = max(落点 + 0.8 蛋宽, 格子右缘 + 半个蛋宽 + 12)，夹在接蛋镜头可见范围内（离右缘 22）；y 是桌面高度（横版 965、窄布局 990）。接蛋格在 catch 进入阶段就从下方升起（z 70，高于桌沿的蛋 63），所以等待点必须在格子之外，否则起跳前蛋会被盖住。等待、prejump 蓄力和起跳都在这里，进入接蛋段之前方向就已一致。
2. **接蛋格右侧留出蛋的位置**（`fitCatchForEgg`）：横版格子保持设计位置（接蛋镜头右移到 x 810）；放不下时格子缩小、靠左放，下缘贴近桌面上沿（上沿 − 20），起跳点就在格子旁边。窄布局里铲面上的蛋和桌沿上的蛋都按格子比例缩小（只缩不放）。
3. **短弧线**：最高点在格上框以下 25% 格高、横向在全程 60% 处（`Egg.flightPoint`）。蛋从格子右侧外越过右框，最高点在铲面右上方，再向左下落到铲面。
4. 检查项（`tools/bg_constraints.mjs` 纯计算 + `FLIGHT=1 node tools/bg_check.mjs` 浏览器逐帧，场景坐标、按蛋身而不是旋转后的图片外接框）：起跳前不被格子盖住；起跳在落点右侧；整段飞行 x 不增（不往左越过落点再折返）；上升段蛋身不压过铲面；最高点之后每帧向下且不向右，整体下降方向横/纵 ≥ 0.2（从右上方来）；格内蛋身不碰气泡、始终在 fx ≥ 0.6；四个阶段蛋都在画面里。

| 点 | 场景坐标（脚底） | 说明 |
|---|---|---|
| 锅内起跳 `panLaunch` | **(720, 670)** | 锅沿遮挡线下 13px，被 pan-rim 层挡住脚；drop 段从锅向右下跳到桌沿等待点 |
| 桌沿等待 = 起跳点（横版 16:9 / 16:10） | **(1389, 965)** | 由规则 1 算出（`anchors.tableWait.x` 只作记录）。蛋 0.5 倍 = 194×194：蛋身 x 1292…1486、y 771…965，在接蛋格右缘 1280 之外 |
| 桌沿等待 = 起跳点（窄布局） | 4:3 **(1199, 990)**；860×1000 **(1116, 990)**；390×844 **(962, 990)** | 桌沿蛋缩放 0.5 / 0.346 / 0.174 |
| 饭桌碗 `tableBowl` | **(700, 930)** | 碗里蛋缩放 0.42 = 163×163：蛋身 x 619…781、y 767…930；B3 碗沿 y 852…892（前沿最低点 892），碗底座 y 965，圈足到 975，碗宽 x 570…830；蛋脚下 38 像素被前沿挡住 |
| B1 桌面 | 上沿 **y 920**，前缘 **y 995**，前侧面到 1060 | 等待点脚底都在桌面上（横版 60% 处，窄布局 93% 处） |

镜头（`camera.keys`，为了让蛋在右侧等待和起跳）：drop 0.8 / missing 1.0 / hear 0.5 焦点 x ≈ 950（at 0.55）；prejump 两帧 x 1000；catch 0.2、0.8 和 handoff 0.4 x 810（原 600 / 640）。“窄布局”= 接蛋格加右侧蛋位在接蛋镜头下放不下（`fitCatchForEgg`），4:3 也是窄布局。

逐视口计算结果（`node tools/bg_constraints.mjs`）：

| 视口 | 窄布局 | 接蛋格 box | 铲面落点 | 桌沿等待 = 起跳点 | 桌沿蛋缩放 | 最高点 y | 起跳在落点右侧 | 起跳前不被格子盖住 | 上升时压过铲面 | 飞行不往回折 | 下降段从右上方落下（横/纵） | 碰气泡 | 格内蛋身最左 fx（≥ 0.6） | 四阶段 起跳 / 越框 / 下降 / 落铲 | 飞行时离屏幕边最小距离 (px) | 等待段蛋离屏幕边 (px) | 脚底在桌面上 | 锅在开场画面 | tablecall 碗 + 蛋离屏幕边 (px) | 结果 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1600×900 | 否 | 380,470,900,512 | 1078,721 | 1389,965 | 0.5 | 598 | 是 | 是 | 否 | 是 | 是（1.02） | 否 | 0.707 | 1389,965 / 1305,700 / 1130,641 / 1078,721 | 39 | 39（catch 0.20） | 是 | 是 | 42 | ✓ |
| 1440×900 | 否 | 380,470,900,512 | 1078,721 | 1389,965 | 0.5 | 598 | 是 | 是 | 否 | 是 | 是（1.02） | 否 | 0.707 | 1389,965 / 1305,700 / 1130,641 / 1078,721 | 36 | 36（catch 0.20） | 是 | 是 | 38 | ✓ |
| 1024×768 | 是 | 190,461,900,512 | 888,712 | 1199,990 | 0.5 | 589 | 是 | 是 | 否 | 是 | 是（1.02） | 否 | 0.707 | 1199,990 / 1118,703 / 942,630 / 888,712 | 28 | 20（catch 0.20） | 是 | 是 | 30 | ✓ |
| 860×1000 | 是 | 414,546,623,354 | 897,719 | 1116,990 | 0.346 | 635 | 是 | 是 | 否 | 是 | 是（1.05） | 否 | 0.706 | 1116,990 / 1065,744 / 939,660 / 897,719 | 36 | 28（catch 0.20） | 是 | 是 | 39 | ✓ |
| 390×844 | 是 | 603,722,313,178 | 846,809 | 962,990 | 0.174 | 767 | 是 | 是 | 否 | 是 | 是（1.1） | 否 | 0.707 | 962,990 / 938,839 / 870,778 / 846,809 | 30 | 22（catch 0.20） | 是 | 是 | 33 | ✓ |

浏览器逐帧实测（`FLIGHT=1 node tools/bg_check.mjs`，结果 `notes/background-scenes/flight-check.json`，标路径的截图 `notes/background-scenes/flight-path-<视口>.jpg`：上排 准备 / 起跳 / 越框，下排 最高点 / 下降 / 落铲）：五个视口全部通过，下降方向横/纵 0.97–1.15。

无头全程检查（`node tools/bg_check.mjs`，结果见 `notes/background-scenes/check.md`）：全程蛋元素都是 1 个；交接之后蛋只在环境段 tablecall 出现，而且每个采样点都在 B3 碗里；蛋在桌沿的每个采样点（含 prejump），脚底都在 B1 的上沿和前缘之间，整只蛋在视口内。

**代价**：手机上的接蛋格变小（390×844：412 → 313 场景像素宽），为了在格子右侧放下蛋；窄屏上桌沿的蛋也更小。

## 4. B1 桌沿带

- **画布**：交付 **4000×800**（2 像素 = 1 场景像素），对应场景 **x −232…1768，y 860…1260**（`table.showBox = [-232, 860, 2000, 400]`），比例 5:1。左右和下方超出厨房画布的部分是给视差和饭桌位移（`dinner`）留的余量。
- **视角**：与现有厨房同一视角，平视略俯；桌面是一条水平台面，透视线水平，不要斜。
- **桌沿高度**（画布像素 = (场景 y − 860) × 2）：
  - 0–120（场景 860–920）：米白纸色。代码在这一段上方 60 场景像素（画布 0–120）加了透明渐变遮罩：环境段 prejump 纸面变薄时，厨房会从这里透出来，所以这一段不要画任何硬边或物件；
  - 120–210（场景 920–965）：桌面后部，纸面在这里羽化过来，要能被纸色渐隐盖住而不突兀；
  - 120–270（场景 920–995）：**桌面**，蛋站在这里；
  - **270（场景 995，±10）：桌沿前缘线**，一条清晰的水平线；
  - 270–400（场景 995–1060）：桌子前侧面；
  - 400–800（场景 1060–1260）：柔和的暖色阴影，到底部接近米白。
- **蛋的落点和必须留空的区域**（场景坐标；画布 x = (场景 x + 232) × 2）：
  - 蛋在右侧等待和起跳（§3.1）：横版 (1389, 965)，蛋身 x 1292…1486；窄布局 (1199 / 1116 / 962, 990)，蛋身最左 x 928；环境段 tablecall 的 B3 碗在 x 570…830；
  - 留空：**x 540…1560** 的整个桌面（画布 x 1544…3584），不放任何物件；其余部分也建议全空。不要锅柄、灶台脚、桌腿、碗、抹布伸进这条带。
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

## 6. B3 饭桌上的碗（碗身 + 前沿遮挡层，与 tableBowl 对位）

环境段 tablecall：妈妈喊完“宝宝，来吃饭啦！”走开，空饭桌上只有一碗配菜饭，碗里的蛋（就是女儿）在喊“我在这儿……”。蛋是代码里那只唯一的活动蛋，**碗里不要画蛋**。

- **两个文件，同一画布 560×280（2 像素 = 1 场景像素），透明底 PNG**，叠在一起就是完整的碗：
  - `bowl-body.png`（碗身 / 碗内）：整只碗——碗内的米饭和配菜、碗沿后半圈、碗身、圈足、碗下的接触阴影；画在蛋之下（z 62）；
  - `bowl-front.png`（前沿遮挡层）：**只有**碗沿前半圈和碗身前侧（从碗沿前弧往下到底座），其余全透明；画在蛋之上（z 64），挡住蛋的下部。两张图里这一部分必须像素对齐。
- **对位**（画布像素；场景坐标 = tableBowl + (画布 x / 2 − 140, 画布 y / 2 − 82)，tableBowl = 碗里蛋的脚底点）：
  - 碗的中线 x = **280**；碗口椭圆中心 y = **48**，半宽 **260**、半高 **40**（碗沿后缘 y 8，前缘最低点 y **88**）；
  - 蛋的脚底点 tableBowl 在画布 (280, **164**)：碗沿前缘之下 76 画布像素（= 38 场景像素），这一截被前沿挡住，看起来蛋坐在饭里；
  - 碗底座 y **234**，宽 x 156…404；圈足到 y **254**；接触阴影在 y 254–270 之内；
  - 碗外宽 x 20…540，留 20 像素边。
- **视角**：与厨房和 B1 同一视角，平视略俯，能看到碗口的椭圆；不要正侧面，也不要俯拍。
- **碗里**：配菜饭（米饭、胡萝卜丁、青豆、玉米），与漫画第 4 页碗里的饭一致，米饭面平，碗口里 **x 130…430、y 10…90 的米饭面保持简单**（蛋会坐在这里挡住它）（不要画蛋、不要画蛋黄或蛋白）。碗身可以有漫画里那种浅绿藤叶纹（属于碗本身的图案，不是纸纹）。
- **安全裁切**：碗加蛋在 390×844 手机上离屏幕边最少 33 屏幕像素，不能再放大。
- **遮挡关系**：碗身在纸面和 B1 之上、蛋之下；前沿在蛋之上；两张都跟随主体层视差，与蛋锁在一起。碗只在 tablecall 出现，B2 盖满后淡出。

## 7. 交给图像会话的提示词

风格基准：与现有厨房图 `source/kitchen-clean.png` 和六页漫画同一画风——温暖的手绘水彩上色、细墨线、柔和米白与浅木色、低饱和、干净，不要纸纹、颗粒或装饰图案。

### B1 桌沿带（4000×800，PNG，不透明）

中文：

> 一条横向的木质餐桌桌沿，温暖手绘水彩加细墨线的绘本风格，与附图厨房同一画风和色调（浅暖木色、米白背景）。平视略俯，桌面是水平的一条台面，透视线完全水平。画布 4000×800，从上到下：最上方 0–120 像素是干净的米白纸色；120–270 像素是浅木色桌面，上部 120–210 像素要淡、能自然地被米白渐隐盖住；270 像素处是一条清晰的水平桌沿前缘线；270–400 像素是桌子前侧面，颜色略深；400 像素以下是柔和的暖色阴影，到最底部接近米白。整条桌面完全空着，没有锅、碗、餐具、桌腿、灶台、抹布、人物和文字，尤其从 1544 到 3584 像素这一段要绝对干净（角色会站在这里，碗也会放在这里）。左右两端无缝延续。不要纸纹、颗粒、图案。

English:

> A long horizontal wooden table edge in a warm hand-painted watercolor storybook style with thin ink lines, matching the attached kitchen illustration (soft light wood, cream background). Eye level, looking very slightly down; the tabletop is a level horizontal band with perfectly horizontal perspective. Canvas 4000×800, top to bottom: rows 0–120 px plain cream paper; rows 120–270 px light wood tabletop, with the upper part (120–210 px) pale so it can fade smoothly into cream; at row 270 px one clean horizontal front edge of the table; rows 270–400 px the slightly darker front face of the table; below 400 px a soft warm shadow fading to cream at the bottom. The table is completely empty: no pans, bowls, utensils, table legs, stove, cloth, people or text; the stretch from x 1544 to 3584 px must be perfectly clean because a character stands there and a bowl is placed there. Both ends continue seamlessly. No paper texture, grain or patterns.

附图：`source/kitchen-clean.png`、`docs/bg-templates/B1-table-band-template.png`。

### B2 寻找段外围，横版（2400×1500）与竖版（1200×2600），PNG，不透明

中文：

> 家里一面浅暖色的墙，与附图漫画同一画风：温暖手绘水彩加细墨线的绘本风格。正对墙面、平视、几乎没有透视。画面左侧、离左边缘约 11% 到 18% 的位置，有一段竖直的浅木色门框（只画门框和门洞边缘一点阴影，不画门内房间，不要贴着画面边缘）。下方一条细细的木质踢脚线（横版在高度约 88%，竖版约 90%）。其余大面积是干净平整的米白墙面，用来叠放漫画格，所以中间不要任何细节。不要人物、家具、植物、相框、灯、文字，不要纸纹、颗粒或装饰图案。输出两个文件：2400×1500 横版（重点在中间 2000×1250 内）和 1200×2600 竖版（重点在中间 1080×1300 内，上下只做墙面延续），两版的门框都在左侧同样的相对位置。

English:

> A plain, light warm-colored wall inside a home, in the same warm hand-painted watercolor storybook style with thin ink lines as the attached comic pages. Straight-on, eye level, almost no perspective. On the left side, about 11% to 18% of the width from the left edge (not touching the edge), a vertical light-wood door frame: just the frame and a hint of shadow at the doorway, do not show the room beyond. A thin wooden skirting board near the bottom (about 88% of the height in landscape, 90% in portrait). Everything else is clean, flat cream wall because comic panels will sit on top, so no detail in the middle. No people, furniture, plants, picture frames, lamps or text; no paper texture, grain or decorative patterns. Deliver two files: 2400×1500 landscape (keep everything important inside the central 2000×1250) and 1200×2600 portrait (important content inside the central 1080×1300; top and bottom are just more wall), with the door frame at the same relative position on the left in both.

附图：`source/comic-v3/05-looking-for-baby.png`、`docs/bg-templates/B2-hallway-landscape-template.png`。

### B3 饭桌上的碗（碗身 560×280 + 前沿遮挡层 560×280，透明底 PNG）

中文：

> 一只放在木桌上的饭碗，碗里是配菜饭（白米饭、胡萝卜丁、青豆、玉米），与附图漫画第 4 页里的碗同一画风：温暖手绘水彩加细墨线的绘本风格，米白瓷碗，碗身可以有浅绿色藤叶纹。平视略俯，能看到碗口的椭圆。透明背景，画布 560×280：碗的中线在 x 280；碗口椭圆中心 y 48、左右半宽 260、上下半高 40；碗底座在 y 234、宽从 x 156 到 404；圈足到 y 254；碗下一小片柔和的接触阴影，不超过 y 270。米饭面平整、简单，碗口里 x 130–430、y 10–90 不要有突出的东西（之后会有一个角色坐在这里），**不要画荷包蛋、蛋黄、蛋白、勺子、筷子、人物或文字**。不要纸纹、颗粒。
> 同时输出第二张对齐的图层（同样 560×280、透明底）：只保留碗沿前半圈和碗身前侧（从碗口前弧往下到底座和圈足），其余全部透明，两张叠在一起像素对齐。

English:

> A rice bowl standing on a wooden table, filled with vegetable fried rice (white rice, diced carrot, green peas, corn), in the same warm hand-painted watercolor storybook style with thin ink lines as the bowl on page 4 of the attached comic: a cream porcelain bowl, optionally with a light green vine pattern on its side. Eye level, looking slightly down so the oval of the rim is visible. Transparent background, canvas 560×280: bowl centered on x 280; rim ellipse centered at y 48 with half-width 260 and half-height 40; the base at y 234, spanning x 156 to 404; the foot ring down to y 254; a small soft contact shadow under the bowl, not below y 270. Keep the rice surface flat and simple; nothing should stick up in the area x 130–430, y 10–90, because a character will sit there. **Do not draw a fried egg, yolk, egg white, spoon, chopsticks, people or text.** No paper texture or grain.
> Also deliver a second, pixel-aligned layer (same 560×280, transparent): only the front half of the rim and the front of the bowl body (from the front arc of the rim down to the base and foot ring), everything else transparent, so the two stack exactly.

附图：`source/comic-v3/04-catch-and-call.png`（碗）、`source/kitchen-clean.png`（视角和色调）。

## 8. 接入方式（图到位后，只改 backgrounds.json）

1. 文件放进 `public/assets/scene/`（B1 `table-band.webp`、B3 `bowl-body.png`、`bowl-front.png`）和 `public/assets/bg/`（B2 `hallway-landscape.webp`、`hallway-portrait.webp`）。
2. `backgrounds.json`：
   - `table.src` 填 B1 路径（`showBox` 已是 `[-232, 860, 2000, 400]`，图按它拉伸铺满；`topY` / `edgeY` 只在图的桌面高度和规格不同时改）；
   - `hallway.src` 填 B2 横版，`hallway.srcPortrait` 填竖版；门框位置不同可调 `hallway.focus`（object-position，0–1）；视口宽高比低于 `hallway.portraitBelow`（1.0）用竖版；
   - `bowl.src` 填碗身，`bowl.srcFront` 填前沿遮挡层（`bowl.box = [-140, -82, 280, 140]` 已经对应 560×280 画布，相对 tableBowl）。
3. 不改镜头、蛋的锚点和漫画格。接入后跑 `node tools/bg_check.mjs`，再在 `/preview/background?guides=1` 截图复核落点和留空区。
