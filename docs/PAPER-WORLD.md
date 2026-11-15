# 两个次元：格里是纸，格外是活的

一条规则统一所有"让静态有生命"的小动作：**漫画格里的东西是纸，按纸的方式动（硬切、一拍二、很小）；格外的厨房和那颗蛋是活的（顺滑、真实时间）。蛋是唯一能在两边来回的角色。**
全部是微动，设计成"感觉得到、不被注意到"。所有开关、调节处都在下面。未经人耳试听（声音部分），手机竖屏没有看。

| 做法 | 在哪 | 开关 / 调节 |
|---|---|---|
| 眨眼：五个脸格（p1c p3c p4e p5b p6b）静止读格时每隔几秒硬切闭眼约 0.12 秒；结尾特写 p6f 三个点之前不眨，最后一个点之后眨一次 | `src/app/preview/visual/Blink.tsx`；补丁 `public/assets/comic-v3/perf/*-blink.webp` 由 `tools/prepare_blink.py` 生成 | `?perf=0` 关 |
| 隔着画框：room 也过低通，漫画格在场 2500 Hz，寻找 / 蛋喊 4000 Hz，没有漫画格的环境段全开，进入阶段内按对数频率渐变 | `useKitchenAudio.ts` 的 `roomCutoffHz`；数值在 `audio-map.json` 每段的 `roomHz` | 改 / 删 `roomHz` |
| 结尾三个点各配一下嗒（hopTap1/2/3，音高逐个降、电平略降，比点早约 80 ms）；closeup 的 room 退到 0.04 | `ComicLayer.tsx` 的 `Dots`；`kitchen:oneshot` 的 rate / gain | `audio-map.json` closeup |
| 声部：sizzle = 蛋，room = 厨房，脚步 = 妈妈。交接时 sizzle 退场，空桌段 sizzle 以 0.05 回来（蛋还活着，不配音） | `audio-map.json` tablecall | 改电平 |
| 声像跟着格子：切菜每一刀、搅汁循环声按所在格在屏幕上的横向位置偏左右（最多 ±0.7）；厨房声居中 | `PanelPerf.tsx` 的 `panFor`；`kitchen:oneshot` 的 pan、`kitchen:pan` 事件 | — |
| 点火：从关到开（有手势、在开场段）先两下升调"咔哒"，sizzle 用约 3 秒慢慢升起 | `useKitchenAudio.ts` 的 `ignite` | `IGNITE_*` 常量 |
| 画框是实物：蛋落地时近处的格子框朝远离蛋的方向抖约两个像素并轻微倾斜；蛋靠近格子时纸面透出一点暖黄（软光混合，随距离衰减） | `src/app/preview/visual/FrameReact.tsx`；蛋派发 `egg:land` | `?perf=0` 关 |
| 纸世界的帧率：蛋飞向锅铲的最后 20% 和落铲压缩回弹按一拍二（约 12 帧每秒）走，蛋回到空桌的碗里又顺滑 | `Egg.tsx` 的 `STEP_FROM` / `STEP_MS` | `?step=0` 关 |
| 围观群众：切菜每一刀 → 葱，"啵"（点蛋，或 hear 格妈妈抬眼）→ 糖罐、酱油瓶，画外的嗒 / 结尾的嗒 → 酱油瓶，半拍后各"一惊"（脚底为轴放大约 4% 再回落，只放大不位移，不会露出补过的底图） | `Backdrops.tsx` 的 `useFriendReactions` | 减少动态效果时不做 |
| 纵深（2026-11-15）：桌上的蛋有接触影子（脚底正下方一圈深核心 + 外圈软影，起跳时消失）；画格是最近的一层：柔和投影落在厨房上，进场时从 1.035 缩到 1，整层随鼠标做比桌面大的视差；阅读厨房拆成远景层 + 近景层（`tools/prepare_planes.py`）：墙、瓷砖、吊柜、窗在远景层，比主体层少动（鼠标 3.5 / 2.1 px、镜头景深 × 0.08、阅读漂移 5 px）；整条台面和站在台面上的东西（层板架、罐子、盆栽、菜篮、葱，连同小角色）是一块刚体的近景层，跟主体层走、盖在远景层上，台面后沿和物件的轮廓在墙上滑动，台面本身不拉伸，蛋站的地方不动；画格在场时远景叠化成预烘的软化版（模糊、低饱和、略亮），小角色和窗玻璃加 0.6 / 0.8 px 模糊，没有画格的段（prejump、listen）恢复清晰 | `Egg.tsx` 的影子样式；`paper.ts`（投影、进场缩放、视差系数）；`Backdrops.tsx` 的 `ReadingKitchen` planes 分支和 `panelPresence`；系数在 `backgrounds.json` reading.planes；输入变量 `--kl-mouse-* / --kl-depth-* / --kl-drift` 由 `KitchenLayers` 发布在舞台和 `<html>` 上 | 减少动态效果时视差为 0、不软化；删 `reading.planes` 回到单张底图 |
| 点蛋彩蛋：点那颗活动蛋（后景桌沿、锅里、空桌的碗里），蛋回一个小跳，"啵"一声，每次随机一个音高（pop.mp3 变速，不配音）；鼠标移上去变手指 | `src/app/preview/visual/EggPoke.tsx` | 删掉 page.tsx 里的 `<EggPoke />` |

## 刻意没做的

- **格子边线的"线条抖动"**：边框烘焙在漫画图里，没法只抖线不抖画；整格以低帧率抖会让气泡文字发虚，影响阅读。纸世界的帧率只用在蛋的最后一段和落铲回弹上。
- **蛋落地的声音**：没有这种素材，也不想让每次小跳都响；画框的"震"只靠画面。`egg:land` 事件已经留好，有素材可以直接接。

## 合并时的注意

- 音频分支（`claude/kitchen-audio-e1e194`）的混音器里同时在改 `fire()` 的 rate / gain / tag；本分支加了 rate / gain / pan，合并时对一下。
- 眼睛补丁是代码画的一条闭合睫毛线，近看偏素；有手绘的闭眼图时直接替换同名 webp 即可（同尺寸、透明背景、只有眼睛附近有像素）。
