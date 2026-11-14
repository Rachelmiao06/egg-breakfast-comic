# 后景出图任务书：家里的厨房 + 偷偷围观的小角色

> 2026-11-14 第二版，替换上一版的“水彩画境”方向。技术数据仍以 `docs/BACKGROUND-TECH.md`、`docs/BACKGROUND-SPEC.md` 为准。
> **更新**：图已经生成，并已接入（阅读厨房、门口厨房、安静的厨房），接入方式和这份任务书第 5 节不同：新图是独立的厨房画面，代替纸面和桌沿带，不是重画锅灶那张厨房。实际接入情况和还缺的素材见 `docs/BACKGROUND-ASSETS.md`。

**新方向**：保留家里的厨房。少量调料瓶、葱、胡萝卜、盐罐在画面边缘偷偷探头围观，妈妈没有发现。不要山景、抽象水彩丘陵或梦境风景。

**工作顺序**：
1. **主视觉**：先出一张完整的厨房主视觉，确定画风、光线和小角色的样子与位置。
2. **拆层**：主视觉通过后，再按需要拆成环境层和小角色层。
3. **接入**：只改配置（第 5 节）。

不沿用 B1、B2 的命名和空墙模板。旧的 B1 桌沿带、B2 外围在新方向下可以不再使用（第 5 节）。

单位：**场景像素** = 厨房画布 1536×1024 的像素。镜头、蛋、锅都用它。主视觉按 **2 倍**出图，**图片像素 = 场景像素 × 2**。

---

## 1. 必须满足的坐标约束（代码依赖，不能改）

这些位置上有代码在动：蛋、油、油泡、火苗、蒸汽、接蛋路径、碗。画面可以重画，但这些几何关系要保持。

### 1.1 画布

| 项目 | 要求 |
|---|---|
| 主视觉画布 | **3072×2048 图片像素（3:2）**，对应场景 x 0–1536、y 0–1024。生成器尺寸受限时可以出 1536×1024 或同比例，坐标按比例换算 |
| 为什么不需要更大 | 镜头永远夹在厨房画布内（任何视口都看不到画布外），视差的边缘由代码轻微放大补上 |
| 参考底图 | `source/kitchen-clean.png`（1536×1024，现有厨房，布局以它为准）、`source/comic-v3/01–06`（画风、人物配色） |

### 1.2 固定物件（位置以 `src/lib/scene.ts` 的 ANCHORS 为准，场景像素）

| 物件 | 场景坐标 | 为什么固定 |
|---|---|---|
| 红色平底锅的锅底椭圆 | 中心 (743, 579)，半宽 398，半高 77 | 油、油泡、蛋在锅里跳都画在这里 |
| 锅沿前缘遮挡线 | y = 579 + 77·√(1 − ((x − 743)/398)²)，x = 720 处约 y 657 | 蛋的脚被锅沿挡住；锅沿前半要能单独拆成遮挡层 |
| 锅沿遮挡层外框 | x 358–1119，y 601–747 | 同上 |
| 蛋在锅里的起跳点 | (720, 670) | drop 段从这里跳向桌面 |
| 火苗区 | x 580–879，y 729–800 | 火苗由代码画；灶眼要在这里 |
| 水壶嘴 | (1192, 312) | 蒸汽从这里冒出 |

锅里不要画蛋、油泡和火苗，这些都由代码画。锅里只留空锅底，或一点点油光。

### 1.3 必须留空的区域

| 区域 | 场景像素 | 要求 |
|---|---|---|
| **蛋在桌面上的活动区** | x 923–1502，y 748–1006 | 蛋的脚底：横版 (1389, 965)，窄屏 (1199 / 1116 / 962, 990)。脚底所在的高度（y 965–990）必须是**水平桌面**，不能是灶台或别的物件。这块桌面上不放任何物件，现有图里的蛋壳和格纹布要移走。蛋身后（x 923–1110）可以是灶台的正面，蛋站在灶台前面的桌上 |
| **饭桌上的碗**（环境段 tablecall） | x 560–840，y 797–1000（按建议的新位置 tableBowl (700, 960)，见第 5 节第 10 项） | 碗由代码放（复用第 3 页 p3b 的碗），碗底在 y 991。在 x 560–840 处，**灶台连同灶脚的下沿不能低于 y 975**，下面 975–1024 要露出空桌面，碗才站在灶台**前面**的桌上。这里桌面空着，颜色和碗的米白不要撞 |
| **接蛋飞行走廊** | x 824–1467，y 408–990 | 蛋从桌面起跳飞向妈妈的锅铲时会经过这里（在最上层）。这块后面不要放会抢眼的小角色和高对比的物件 |

### 1.4 画面边缘在哪里（小角色必须在“它出场的那几段”的可见范围里）

镜头一直在移动，不同节拍、不同视口看到的范围差很多（`node tools/bg_constraints.mjs --views`，场景像素）：

| 节拍 | 16:9 1600×900 | 16:10 1440×900 | 4:3 1024×768 | 860×1000 | 手机 390×844 |
|---|---|---|---|---|---|
| opening 开场 | x 0–1536, y 85–949 | x 0–1536, y 32–992 | x 85–1451, y 0–1024 | x 328–1208, y 0–1024 | x 531–1005, y 0–1024 |
| drop / bag / missing（蛋在桌上等） | x 189–1536, y 266–1024 | x 189–1536, y 182–1024 | x 291–1499, y 126–1024 | x 525–1307, y 126–1024 | x 722–1147, y 126–1024 |
| prejump 蓄力 | x 345–1536, y 354–1024 | x 345–1536, y 280–1024 | x 477–1536, y 230–1024 | x 723–1406, y 230–1024 | x 766–1133, y 230–1024 |
| hear 嗯？啵！ | x 234–1536, y 292–1024 | x 234–1536, y 210–1024 | x 314–1471, y 156–1024 | x 540–1286, y 156–1024 | x 729–1130, y 156–1024 |
| catch / handoff 接蛋 | x 97–1521, y 224–1024 | x 97–1521, y 135–1024 | x 176–1442, y 76–1024 | x 401–1218, y 76–1024 | x 589–1029, y 76–1024 |
| bowl | x 61–1483, y 224–1024 | x 61–1483, y 135–1024 | x 140–1404, y 76–1024 | x 364–1180, y 76–1024 | x 553–991, y 76–1024 |
| tablecall 碗里的蛋喊 | x 70–1330, y 316–1024 | x 70–1330, y 237–1024 | x 140–1260, y 185–1024 | x 339–1061, y 185–1024 | x 506–894, y 185–1024 |
| call、search、eggcall、return、punchline | x 0–1422, y 224–1024 | x 0–1422, y 135–1024 | x 8–1272, y 76–1024 | x 232–1048, y 76–1024 | x 421–859, y 76–1024 |

- 横版每一段都看得到的范围：x **345–1330**，y **354–949**。
- 手机只看得到一扇窄窗，在 x 421–1147 之间移动。
- **因此**，小角色要躲在**厨房里的具体物件后面**探头（锅、罐子、水壶、台面边），不能贴在“屏幕边”上。
- **至少要有一组**放在 x 766–1130 之内（例如后台面的罐子那一带），手机在等待段、蓄力段、听见段和接蛋段才看得到它们。
- 只在某些段出场的小角色，位置要落在那几段的可见范围里。

### 1.5 图层和格式（拆层阶段）

**环境层**：沿用现有五层结构，换图时文件名不变，不改代码（`KitchenLayers.tsx`）。

| 层 | 文件 | 前后顺序（z） | 内容 | 格式 |
|---|---|---|---|---|
| far | `public/assets/scene/far.png` | 10 | 墙、瓷砖、后台面、远处物件 | 1536×1024 不透明 |
| counter | `counter.png` | 11 | 后台面上的罐子、水壶等 | 1536×1024 透明 |
| mid | `mid.png` | 20 | 木桌、灶台、红锅锅身 | 1536×1024 透明 |
| pan-rim | `pan-rim.png` | 50 | **只有**红锅前沿和锅身前壁（挡住锅里蛋的脚） | 1536×1024 透明 |
| front-right | `front-right.png` | 61 | 前景右侧物件 | 1536×1024 透明 |

- front-right 层从第 5 段（下锅）起会淡出（给前景妈妈让位，由代码决定），所以**不要把小角色和重要物件放在这一层**。
- 各层都要和主视觉像素对齐。可以交 2 倍图（3072×2048），接入时缩放。

**小角色层**：每个小角色单独一张透明 PNG，画在同一张场景画布上（3072×2048，或裁成外接框并注明它在场景里的 x、y）。

- 如果它躲在某个物件后面探头，那个物件挡住它的前面那一部分要**单独拆成一张透明遮挡层**，和小角色像素对齐。
- 代码只做**位移和淡入淡出**（从物件后面升起、侧移、缩回去），不做逐帧动画。每个小角色画一个“探头”姿势就够。想要两种表情（偷看、吓一跳缩回），可以多交一张同位置的。

### 1.6 三条硬规则

1. 画面里**不要妈妈**，妈妈由漫画承担。
2. **不要荷包蛋**，唯一的蛋由代码画。
3. **不要文字和标志**。漫画不镜像。

---

## 2. 可调整的美术构图（主视觉阶段决定）

以下是建议，可以按效果调整。只要不违反第 1 节，就不用改代码，只调配置。

- **小角色**：3–5 个，例如酱油瓶、醋瓶、油瓶、一根葱、一根胡萝卜、盐罐、胡椒罐。
  - 小小的脸，好奇、屏住呼吸、互相“嘘”。只露半个身子或眼睛以上，偷偷看向桌面上的蛋和锅那边。
  - 妈妈没有发现：他们的视线朝向蛋。
- **建议躲藏点**（都是现有厨房里就有的东西）：

| 小角色 | 躲在哪里 | 场景位置（约） | 谁看得到 |
|---|---|---|---|
| 胡萝卜、葱 | 左边黄色锅的锅沿后面（锅里本来就插着蔬菜） | x 40–400，y 280–620 | 横版的开场、接蛋到结尾；等待段被画面左缘切掉一部分；手机看不到 |
| 盐罐、胡椒罐 | 后台面的糖罐、瓶子后面 | x 930–1200，y 360–510 | 横版全程；手机在等待到接蛋段 |
| 酱油瓶 | 右边水壶后面 | x 1200–1480，y 200–520 | 横版的开场、等待段、接蛋段；从 call 起被画面右缘切掉 |

- **出场时机**（由配置曲线控制）：
  - bag 到 missing：妈妈忙着做饭，他们探头。
  - hear（“嗯？”）：缩回去。
  - catch：又探出来看蛋飞。
  - tablecall：蛋在碗里喊，他们最激动。
  - search：妈妈走开，他们面面相觑。
  - return 到 punchline：再躲好。
- **画风**：和现有厨房图、六页漫画一致：温暖手绘水彩上色、细墨线、米白、薄荷绿瓷砖、浅木色、低饱和。不要纸纹、颗粒或滤镜叠层。
- **光线和色调**：可以比现有厨房更暖一点，但瓷砖、红锅、绿灶的识别色保留（漫画里也是这套）。

---

## 3. 第一步：厨房主视觉（一张完整图）

**交付**：`kitchen-key.png`，3072×2048（或 1536×1024），不透明。把 `docs/bg-templates/kitchen-key-template.png`（同尺寸、透明底，由 `tools/bg_key_template.py` 从代码生成）半透明叠在上面，检查第 1 节的位置。叠在现有厨房上的效果见 `docs/bg-templates/kitchen-key-template-on-current.jpg`。

**附图**：`source/kitchen-clean.png`（布局底图）、`source/comic-v3/03-something-is-missing.png`（画风、配色）。

**指令（中文）**：

> 一张温暖的家庭厨房插画，3072×2048 像素（3:2），温暖手绘水彩上色加细墨线的绘本风格，和附图厨房、漫画同一画风与配色（米白墙、薄荷绿瓷砖、浅木色桌面、红色平底锅、浅绿小灶台）。**布局和附图厨房完全一致**：红色平底锅在画面中间的浅绿灶台上，锅里是空的，只有一点油光，不要蛋；灶眼在锅下方中间；左边是插着胡萝卜和青菜的黄色小锅；后台面有几个调料罐；右边是带草莓图案的水壶；前景是一张木桌，桌面横贯画面下部。桌面右侧（从画面宽度约 60% 到 98%、高度约 73% 到 98%）要完全空着，不放蛋壳、抹布或任何东西；灶台下沿不低于画面高度约 95%，灶台正下方（宽度约 36% 到 55%、高度约 95% 到 100%）露出一条空桌面。厨房里藏着 3 到 5 个小小的调料和蔬菜角色，有可爱的小脸，偷偷探头围观：一根胡萝卜和一根葱从左边黄色锅的锅沿后面探出眼睛；一个盐罐和一个胡椒罐从后台面的罐子后面露出半个身子；一个酱油瓶从右边水壶后面歪着头看。他们都好奇地望向桌面右侧和锅的方向，屏住呼吸，像怕被发现，只露出一部分身体。画面里没有人，没有荷包蛋，没有文字。不要纸纹或颗粒。

**Prompt (English)**:

> A warm home kitchen illustration, 3072×2048 px (3:2), in a warm hand-painted watercolor storybook style with thin ink lines, matching the attached kitchen and comic pages (cream walls, mint-green tiles, light wood table, red frying pan, pale green stove). **Keep the layout exactly like the attached kitchen**: the red frying pan sits in the middle on the pale green stove, empty with only a little sheen of oil and no egg; the burner is centered under the pan; on the left a small yellow pot holding carrots and leafy greens; a few spice jars on the back counter; on the right a kettle with a strawberry pattern; a wooden table runs across the lower part of the picture in the foreground. Keep the right part of the tabletop completely empty (from about 60% to 98% of the width and 73% to 98% of the height): no eggshells, no cloth, nothing. The stove's bottom edge (including its feet) must be no lower than about 95% of the height, so a strip of empty tabletop shows directly below it (about 36–55% of the width, 95–100% of the height). Hidden around the kitchen are 3 to 5 tiny seasoning and vegetable characters with small cute faces, secretly peeking: a carrot and a scallion peek over the rim of the yellow pot on the left, showing only their eyes; a salt shaker and a pepper shaker lean out halfway from behind the jars on the back counter; a soy sauce bottle tilts its head out from behind the kettle on the right. They all look curiously toward the right side of the table and the pan, holding their breath as if afraid of being noticed, showing only part of their bodies. No people, no fried egg, no text. No paper texture or grain.

（百分比的来源：蛋活动区 x 923–1502 / 1536 = 60–98%，y 748–1006 / 1024 = 73–98%；灶台下沿 975 / 1024 = 95%；碗区 x 560–840 / 1536 = 36–55%。）

---

## 4. 第二步：拆环境和小角色（主视觉通过后）

1. **环境五层**：按 1.5 节，从主视觉拆出 far、counter、mid、pan-rim、front-right，像素对齐。小角色从环境层里去掉，被他们挡住的物件后面要补全。补全只限于主视觉本身的延续，由图片生成会话完成。
2. **小角色**：每个一张透明 PNG。他们躲着的物件前沿（锅沿、罐子、水壶）各拆一张透明遮挡层。
3. **交付清单示例**：`far.png`、`counter.png`、`mid.png`、`pan-rim.png`、`front-right.png`、`peek-carrot.png` + `peek-pot-rim.png`、`peek-scallion.png`、`peek-salt.png` + `peek-jars-front.png`、`peek-soy.png` + `peek-kettle-front.png`。每个小角色注明外接框，即场景里的 x、y、宽、高。

**拆层指令（中文，给图片生成或编辑会话）**：

> 以这张通过的厨房主视觉为准，拆成透明图层，所有图层同尺寸、像素对齐：①远景（墙、瓷砖、后台面，不透明），②后台面上的罐子和水壶，③木桌、灶台和红锅锅身，④只有红锅前沿和锅身前壁，⑤前景右侧物件。每个小角色单独一张透明图，并把它躲着的物件的前面部分（锅沿、罐子、水壶）单独一张透明遮挡层。环境层里去掉小角色，被他们挡住的地方按原画延续补全。不改变画风和颜色，不新增物件。

---

## 5. 背景配置调整清单（图到位后执行，文件 `src/app/preview/visual/backgrounds.json`，除注明外都由后景会话改）

新方向要让厨房在阅读段一直看得见，小角色才有地方围观。所以现在的“纸面盖住厨房，只留桌沿”和“寻找段换成外围画境”都要调。

| # | 配置 | 现在 | 调整为 | 原因 |
|---|---|---|---|---|
| 1 | `curves.paper`（纸面不透明度） | bag 到 punchline 为 1（整片盖住厨房），prejump 降到 0.5 | **最高 0.3 的暖色薄纱**：drop 0.7 → bag 0.3 升到 0.3；prejump 和 tablecall 降到 0；search、eggcall 0.45；return 回到 0.3 | 厨房常驻，漫画仍然可读（KitchenScene 还会按阅读进度轻度弱化厨房） |
| 2 | `curves.table`（B1 桌沿带） | 和纸面同时淡入到 1 | **全程 0**（不再显示）；`table.topY`、`table.edgeY` 改成新厨房桌面在蛋活动区的实测高度 | 蛋直接站在新厨房的木桌上；检查工具仍用 topY / edgeY 判断“脚底在桌面上” |
| 3 | `curves.doorway`、`doorwayDrift`（原名 hallway / hallwayDrift） | search、eggcall 换成外围画境 | **全程 0** | 寻找段留在厨房：妈妈走开，厨房空着，小角色面面相觑；门口和空房间仍由漫画格 p5b、p5c 承担 |
| 4 | `curves.dinner` | 0 | 不变 | — |
| 5 | `bowl`（B3） | 复用 p3b 的碗，tablecall 出现 | 不变；接图后看碗的米白和新桌面是否撞色 | — |
| 6 | 新增 `peekers` 数组 | 无 | 每个小角色一项：`src`、`occluder`（可选）、`box`（场景 x、y、宽、高）、`z`（躲在哪一层后面就在那一层和它的遮挡层之间）、`hide`（缩回时的位移，场景像素）、`curve`（探头量 0–1 的节拍曲线，见第 2 节的出场时机） | 后景会话在 `Backdrops.tsx` 加一个按配置渲染的组件，只做位移和不透明度，跟随所在层的视差；数组为空时什么也不画 |
| 7 | 环境五层的 PNG | 现有厨房分层 | 换成拆好的五层，**文件名和尺寸不变** | 不改代码。`KitchenLayers.tsx` 由 kitchen-layers 会话维护，换图前通知集成会话 |
| 8 | `src/lib/scene.ts` 的 ANCHORS | 不变 | 只有主视觉**移动了**锅、灶、水壶时，才要重测 eggRest、panLaunch、panInner、panRimBox、flameBox、kettleSpout | 由集成会话改；能保持布局就不用动 |
| 9 | `ending` 收尾平涂 | closeup 盖住全屏 | 不变 | — |
| 10 | `anchors.tableBowl`（集成会话维护） | (700, 930)，碗底 y 961 | **(700, 960)**，碗底 y 991 | 厨房在 tablecall 时看得见，碗底 961 比灶脚（约 y 975）高，会画在灶台正面上，前后关系反了。960 时碗站在灶脚前面的桌上；五个视口碗和蛋离屏幕边 27–37 屏幕像素（`BG_JSON=… node tools/bg_constraints.mjs` 已算过）。B3 几何都相对 tableBowl，后景代码不用改 |

**接入后检查**：
- `node tools/bg_constraints.mjs`（坐标和镜头）
- `node tools/bg_check.mjs`（全程一个蛋、脚底在桌面上、碗里的蛋）
- `FLIGHT=1 node tools/bg_check.mjs`（接蛋方向）
- `node tools/bg_constraints.mjs --views`（小角色在出场段的可见范围里）
- 在 `/preview/background?guides=1` 截图复核
