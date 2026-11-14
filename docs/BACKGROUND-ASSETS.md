# 后景素材登记（2026-11-14 新素材：家里厨房的食材和调料偷偷活过来）

- 原件在桌面 `new pics/`，没有改动过。项目只用副本：`source/bg-v3/` 是原样副本，`public/assets/bg/` 是网页用的版本。
- 接入只靠 `src/app/preview/visual/backgrounds.json`，组件是 `src/app/preview/visual/Backdrops.tsx`。

## 1. 来源 → 项目路径 → 使用的组件和配置 → 出现段落

| 源文件（new pics） | 实际内容（逐张打开确认） | 项目路径 | 组件 / 配置 | 出现段落 |
|---|---|---|---|---|
| `BG-kitchen-secret-friends.png` 1672×941 | 厨房台面、墙、窗。左边层板上有糖罐、酱油瓶两个小角色，右边菜篮旁有葱、胡萝卜两个小角色。台面大面积空着 | `source/bg-v3/BG-kitchen-secret-friends.png` → `public/assets/bg/kitchen-friends.webp`；拆层后 `kitchen-friends-base.webp`、`friends-soy.png`、`friends-jar.png`、`friends-scallion-leaves.png`、`friends-oil.png`、`friends-post.png` | `ReadingKitchen`（场景层，在纸面组里，跟随主体层视差，与蛋锁在一起）；`reading.src` / `srcBase` / `actors` / `occluders` / `window` | drop 78% 淡入 → bag … hear、catch、handoff … call、tablecall、return … punchline（寻找段被盖住）。横屏、4:3、860×1000 用它 |
| `hallway-portrait.png` 852×1846 | **不是走廊**：是同一套厨房的竖版（窗、层板、糖罐、酱油瓶、葱、胡萝卜、台面），没有门口 | `public/assets/bg/kitchen-friends-portrait.webp` | `ReadingKitchen` 竖版；`reading.srcPortrait`（视口宽高比 < 0.6，即手机） | 同上，手机 |
| `hallway-landscape.png` 1585×992 | 厨房 + 右边通往另一个房间的门口；小角色担心、“嘘”、思考 | `public/assets/bg/kitchen-doorway.webp` | `SearchSurround`（页面层，漫画之下）；`hallway.src`；竖屏按 `focusPortrait` 0.86 裁到门口一侧 | search、eggcall（tablecall 85% → search 25% 淡入，eggcall 70% → return 20% 淡出） |
| `BG-quiet-ending.png` 1672×941 | 淡出的厨房，小角色缩在两边角落，中间大片留白 | `public/assets/bg/quiet-ending.webp` | `EndingSheet`；`ending.src`，cover，focus (0.5, 0.7) | closeup（punchline 72% → closeup 40% 淡入） |
| `table-band.png` 2172×724 | 一条空木板，有前缘线 | `source/bg-v3/table-band.png`（只存副本） | **未使用** | 阅读厨房自己有台面，再叠一条木板会出现两张桌子 |
| `01–06 *.png`、`01-chopping-clean-plate.png`、`02-knife-arm-overlay-draft.png`、`03-mom-eyes-up.png`、`04-mom-puzzled.png` | 漫画页和格内表演素材 | 与项目里 `source/comic-v3/`、`source/comic-v3-perf/` 逐字节相同 | 前景（不归后景） | — |

**对位**：
- 阅读厨房按原比例缩放：横版 1.05，竖版 0.9（场景像素 / 图片像素），不拉伸。台面前缘对齐桌沿线 y 995：横版图片 y 885，竖版图片 y 1790。台面是蛋站立和放碗的桌面。
- `reading.box`、`boxPortrait` 覆盖五个视口所有节拍的可见范围，不露白边。

**换场**：任何时刻只看得到一张厨房，没有重复厨房。
- drop：先由纸面盖住旧厨房（drop 55% → 78%），再在纸面上淡入新厨房（78% → bag 20%）。
- 寻找段、收尾：前一半铺满纸色，后一半在纸色上淡入图片。

**唯一的蛋**：五张新图都没有画蛋，场景里只有代码画的那一颗。交接后它和它的影子一起退出；只在 tablecall 的碗里出现。

## 2. 动画

| 角色 | 动作 | 怎么做 | 时机（滚动驱动，只在各段进入 / 退出阶段） |
|---|---|---|---|
| 酱油瓶 | 往左躲到油瓶后面，再探出来 | 拆出角色层，油瓶、层板立柱当前景遮挡；绕瓶底转 0 → −3.5° | hear 开头躲（妈妈“嗯？”），catch 开头探出；call 结尾躲，tablecall 探出；return 开头躲，punchline 结尾探出 |
| 糖罐 | 往左歪头张望 | 绕罐底转 0 → −3° | bag 结尾歪头，hear 开头回正；catch 开头歪头，handoff 结尾回正；call 结尾歪头，search 开头回正；recognize 结尾歪头，punchline 结尾回正 |
| 葱 | 叶子往胡萝卜那边偏，像在说悄悄话 | 只拆叶子（叶鞘交界处切开，切口羽化），绕交界处转 0 → 3° | idea 结尾、stirfry 结尾、prejump 中段、tablecall 中段，各一次 |
| 窗外的树 | 远景，比墙面慢 | 每块玻璃裁原图自己的那一块，放大 1.1 倍，横向视差 0.2 | 跟着镜头移动；阅读停留时镜头不动，它也不动 |

- 转动方向都选在只会露出干净背景的一侧：层板侧面、墙面、瓷砖。被遮住的地方用原图周围像素补齐。
- 角度为 0 时，底图加各层与原图一致。
- 没有整张图扭曲，墙、台面、框线都不动。
- 配角不加对白和音效。
- 减少动态效果时三个角色都停在 0°，窗外不做视差。

## 3. 保持静态的部分和需要补生成的素材

| 项目 | 为什么静态 | 要动起来需要补什么 |
|---|---|---|
| 胡萝卜（缩回菜篮） | 它背后是生菜和番茄，没有可用的底图，补不干净 | ①菜篮里**没有胡萝卜**的底图（生菜、玉米、番茄、篮沿完整）；②胡萝卜角色单独一张透明图（含两只扒在篮沿上的手）；③菜篮前沿单独一张透明遮挡层。三张都和 `BG-kitchen-secret-friends.png` 同尺寸、像素对齐 |
| 竖版（手机）里的四个小角色 | 竖版没有拆层 | 同上的拆层，按 `hallway-portrait.png` 的尺寸：无角色的底图 + 每个角色透明层 + 遮挡物透明层 |
| 寻找段（门口厨房）里的小角色 | 寻找段只出现约两屏，而且大部分被漫画格盖住，先不拆 | 需要的话同样补：无角色底图 + 角色透明层 |
| 寻找段的竖版 | **缺图**：没有竖版的门口厨房 | 一张约 1200×2600 的竖版门口厨房（门口在画面中间偏右）。现在竖屏用横版裁切代替 |
| 窗外远景 | 已做视差，但窗户在大部分节拍里只露出窗台 | 不需要补 |

## 4. 需要主会话协调的事

1. 手机上的蛋很小（0.174 倍，约 68 场景像素），竖版厨房里的葱有约 340 场景像素高，比例不协调。原因是窄屏桌沿的蛋随接蛋格一起缩小（接蛋路径的取舍），和之前提的“手机接蛋格太小”是同一个问题，需要一起重新平衡。
2. `anchors.tableBowl`：新厨房的台面从 y 767 到 995，碗现在的位置 (700, 930) 落在台面上，不需要改。之前“改到 (700, 960)”的请求只针对旧厨房（碗会画到灶台上），可以撤销。
