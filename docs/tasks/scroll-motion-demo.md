# 任务：feat/scroll-motion-demo — 温暖、从容的停留式厨房叙事（运动粗版）

开工前：确认在自己的独立 worktree，分支名 `feat/scroll-motion-demo`（若 app 起的名字不同，先 `git branch -m feat/scroll-motion-demo`），从最新 main 开始。读 `docs/DESIGN.md` 第六版（§6 所有权和共享接口）、`docs/BEATS.md`（含停留组）、`src/lib/beats.ts`（`pinState`、`envelope`、`phaseProgress`、`derive`）、`src/lib/scroll-velocity.ts`、`src/components/ScrollDriver.tsx`、`src/components/SceneStage.tsx`、`src/components/kitchen/KitchenScene.tsx`、`src/app/dev/beats/`（集成替身和调节面板是很好的起点）。

**只改** `src/app/demo/scroll-motion/**`、`public/assets/demo/**`、本文件。其他文件只读；需要共享接口或节拍表改动写在本文件末尾"需要集成会话改"。**不改**正式首页、`beats.json`、共享组件；**不新增**滚动驱动、滚动监听、ScrollTrigger、Lenis（项目里没有平滑滚动库，也不要加）。

## 方向（用户 2026-11-13 定）

**温暖、从容的厨房叙事。** 不要模仿海浪那种持续倾斜和摇晃。重点是**三段停留（sticky / pin）**：

| 停留组 | 包含节拍 | 停留期间滚动推动什么 |
|---|---|---|
| 📌 备菜 `prep` | 切配菜 → 炒配菜 → 调汁 | 三组妈妈画格在同一个停住的版面里依次接替（比如卡片叠放、翻到下一张、或在一条桌面上从左到右推进），厨房在背后弱化但持续活动 |
| 📌 跨景接蛋 `catch` | 伸锅铲 → 接蛋 | 前景妈妈带着锅铲进入，漫画边界打开，同一颗蛋从后景锅里飞到铲面 |
| 📌 饭碗结尾 `bowl` | 放进饭碗 → 结尾近景 | 锅铲妈妈换成端碗妈妈，蛋落到饭中央，镜头靠近饭碗，结尾近景静态图淡入 |

停留期间画面位置不动，滚动只推动内容变化；组结束后**自然释放**（最后一屏随滚动正常上移离开，下一段从下方进入）。其余段落（开场、发现跳蛋）**正常流动**，内容随滚动 1:1 移动。全部用统一节拍表：`pinState(t)` 给出是否停留、整组进度 `groupP`、流动距离 `flowVh`、刚释放的距离 `releaseVh`。

**避免空滚**：停留组里每一段滚动都要有看得见的变化；如果某段读完后还要滚很久才有变化，就是空滚，写进报告并建议缩短长度。

## 动效语气

- 缓动用 sine / power2.inOut 这类柔和曲线，位移小、速度慢，像翻食谱、端盘子，不像弹簧玩具。
- 滚动速度（`getScrollVelocity()`，在 gsap.ticker / rAF 里读，不放进 React state）只用来加一点"跟手"的余韵，例如画格进入时最多约 1° 的轻微倾斜，停下 0.6–1 秒内平稳回正；阅读时完全静止。不要明显拉歪妈妈的脸和身体。
- 镜头：可用 `<KitchenScene camera={{ x, y, weight, zoom }}>` 在接蛋组和饭碗组里轻推近（zoom ≤ 1.3），前中后景错速；`KitchenLayers` 冻结不能改，需要错速就在路由内自己渲染分层（复用 `public/assets/scene/*.png` 和 `Z`），读舞台上的 `--cam-zoom`。
- 妈妈素材是合并插画，没有关节层：只做整格的进入、接替、离开，不做整人晃动冒充动作。

## 找灵感（先做，再动手）

从现有库和案例里找"停留式叙事"的做法，挑适合这个温暖厨房故事节奏的，写在本文件"灵感笔记"里（每条：来源链接、借鉴什么、为什么适合、不借鉴什么）。可以看：GSAP ScrollTrigger 的 pin / scrub 示例与 Velocity Skew demo（https://demos.gsap.com/demo/velocity-skew/，只借速度余韵的思路）、SBS The Boat（https://www.sbs.com.au/theboat/）、The Pudding / NYT 等 scrollytelling 案例、Apple 产品页的分段停留。只借鉴结构和节奏，**不引入新库**，实现仍用我们的时间轴。

## 用现有素材做完整粗版

- 整个故事 0–8 都要能滚完（用完整 `BEATS`，必要时用 `<SceneProvider initialBeats>` 在路由里试调过的副本），三段停留做细，流动段做简。
- 素材：厨房分层与角色（`KitchenScene` + `KitchenCharacters`）、`MOM_PANELS` 三张、`MOM_SPATULA`、`MOM_SERVE`（摆放见 `src/lib/scene.ts`）。缺图（如结尾近景）用明确标记的占位。
- 角落放可收起的读数：当前段、阶段、停留组与 groupP / 流动 vh、滚动速度、倾斜角、镜头 zoom、flight / serve。
- 手机适配和最终视觉修整**现在不做**。
- 本地预览：worktree 里先 `npm ci`，然后 `npx next dev -p 3002`，路由 `/demo/scroll-motion`。

## 验收（先报告给用户看，不合并 main）

- 三段停留都"停得住、推得动、放得开"：停留时位置稳定，滚动带来连续变化，释放自然。
- 列出你测到的空滚位置（哪一段、多少 vh）和建议长度，写到"需要集成会话改"。
- 接蛋落在铲面上、入碗落在饭中央；回滚时一切倒回。
- `npm run lint`、`npm run build` 通过；commit 并 push `feat/scroll-motion-demo`。报告贴每个停留组的截图（进入、中段、释放）和剩余问题。

## 灵感笔记

> 只借结构和节奏；实现全部读统一时间轴（`pinState` / `envelope` / `phaseProgress`），不引入任何库。

1. **GSAP ScrollTrigger 的 pin + scrub**（https://gsap.com/docs/v3/Plugins/ScrollTrigger/）
   - 借：pin 的三段式心智模型：元素顶到视口顶 → 停住一段滚动距离 → 释放后随文档离开；scrub 的意思是"滚动距离 = 动画进度"，回滚就倒放。
   - 为什么适合：备菜三张画格、接蛋飞行、入碗都是"滚多少走多少"的连续过程，回滚要能倒回。
   - 不借：ScrollTrigger 本身、`anticipatePin`、`scrub: 1` 的时间平滑（我们由 `<ScrollDriver>` 唯一驱动；需要的柔和来自缓动曲线和舞台镜头的 0.35s 过渡）。
2. **GSAP Velocity Skew demo**（https://demos.gsap.com/demo/velocity-skew/）
   - 借：读滚动速度 → 夹紧到很小的角度 → 用逐帧插值回正的"余韵"思路。
   - 为什么适合：给画格一点"被手翻动"的跟手感，停下就安静。
   - 不借：它的 skew 幅度和持续变形。我们改成最多 1° 的 `rotate`，只作用在画格 / 说明卡 / 结尾卡上，不碰妈妈、蛋、厨房；停下约 0.6–0.9 秒回正，阅读时为 0。
3. **The Pudding：sticky graphic 模式与 Scrollama**（https://pudding.cool/process/scrollytelling-sticky/ 、https://pudding.cool/process/introducing-scrollama/）
   - 借："图形进入 → 粘住若干步 → 步骤结束后释放"的结构，以及"粘住的那块画面不动、变化来自步骤"的分工；还有一条经验：停留要有清楚的开始和结束，停太久读者会以为页面坏了。
   - 为什么适合：备菜组就是一块粘住的"食谱桌面"，三步依次在上面发生；组结束整块桌面随滚动被推走。
   - 不借：Scrollama 的步骤文本列（我们没有长文），以及 IntersectionObserver 触发（不新增监听）。
4. **SBS The Boat**（https://www.sbs.com.au/theboat/）
   - 借：手绘画格在一块持续存在的场景上依次出现、前后景错速、声音和画面同节奏；"翻页式"的章节感。
   - 为什么适合：我们的厨房也是一直活着的底，妈妈画格浮在上面；接蛋组用"漫画边框先合拢、再被妈妈的锅铲撑开"表达从漫画格跨进场景。
   - 不借：风浪般的持续摇晃和抖动（与"温暖、从容"相反），也不借它的自动滚动。
5. **Apple 产品页的分段停留**（如 AirPods / iPhone 页的 pinned hero）
   - 借：一段停留只讲一件事，镜头慢慢推近同一个物体，文字在停住的画面里淡入淡出；停留结束时画面整体上移让位给下一段。
   - 为什么适合：饭碗结尾组就是"镜头推近饭碗 → 结尾近景淡入"，一件事讲完再释放。
   - 不借：图片序列帧（我们没有序列素材），也不做大幅缩放（zoom ≤ 1.3）。

## 交付（粗版，2026-11-13）

预览：worktree 里 `npx next dev -p 3002`（3002 被占用时 launch 配置会顺延到 3003），路由 `/demo/scroll-motion`。右下角读数可收起；读数里"节拍长度 正式 / 建议"可切换到下面的建议长度试滚（`setBeats`，同一个 ScrollDriver）。

文件（全部在 `src/app/demo/scroll-motion/`）：
- `ScrollMotionDemo.tsx`：组合。固定的活厨房（`KitchenScene camera` + `KitchenCharacters`）做底，页面层叠流动内容和三块停留版面。
- `motion.ts`：`sheetY()`（= sticky：组前流动段 1:1 滚入 → 组内 0 → 组后流动段 −releaseVh）、`beatPhase()`（任一段任一阶段的进度）、`demoCamera()`（weight 恒 1、只插值焦点和 zoom，避免 zoom 刚超过 1 时镜头跳变）、`DEMO_BEATS`（完整 0–8 + 末尾 100vh 小样释放段 outro，n=9）、`TUNED_BEATS`（建议长度）。
- `PrepBoard.tsx` 📌备菜：一块"食谱桌面"。切菜卡随桌面在开场段 1:1 滚入；组内当前卡居中，后两张在各自进入阶段从右侧滑入（sine），动作阶段说明文字从左写出，退出阶段退到左栏缩成别针小卡；顶部组进度线随 groupP 走；组结束整块桌面带着三张小卡在发现跳蛋段被 1:1 推走。
- `MomLayer.tsx`（场景层）：发现跳蛋的"！"（跟着锅里的蛋，不随文档流）；锅铲妈妈在伸锅铲进入 + 动作阶段从右下 sine 滑入；入碗段进入阶段用"翻一页食谱"的纸边从右往左扫过换成端碗妈妈（对半溶解有双影，错开淡化会让蛋悬空，翻页两者都没有）。
- `Sheets.tsx`：开场标题（1:1 上移）、发现跳蛋旁白（1:1 滚过，段末完全离开，不会被接蛋组冻在半路）、📌接蛋组漫画边框（伸锅铲进入阶段合拢成一格，动作阶段被妈妈撑开 = 边界打开）、📌饭碗组结尾近景占位（从饭碗处放大淡入，停留阶段三句依次浮现）、释放段的"完"。
- `VelocityTilt.tsx`：gsap.ticker 里读 `getScrollVelocity()`，160 vh/s ≈ 1°，夹在 ±1°，写 CSS 变量 `--sm-tilt`；只有画格、旁白、标题、结尾卡读它（`rotate` 属性），妈妈 / 蛋 / 厨房不读。退到左栏的小卡不晃。
- `Hud.tsx`：段、阶段、停留组与 groupP / 流动 vh / 释放 vh、镜头 zoom、flight / serve、scroll、速度、倾斜。

实测（无头 Chrome 1440×900，逐位置截图，截图在共享笔记 `scroll-motion-demo/`）：
- 停得住：三组停留期间版面 translate 恒为 0，只有内容变化；流动段内容随滚动 1:1。
- 推得动：备菜组每段的进入 / 动作 / 退出都有连续变化；接蛋组 flight 0→1 连续；饭碗组 serve 0→1、镜头 1.15→1.3 连续。
- 放得开：备菜桌面在发现跳蛋段 1:1 推走；饭碗组在小样释放段 1:1 上移、"完"从下方滚入。接蛋组和饭碗组之间节拍表没有流动段，所以做成组内交接（翻页换人 + 镜头从铲面移到饭碗），不是释放。
- 接蛋：蛋脚落在铲面上（偏铲面左半，约在左 1/3 处）；入碗：落在米饭正中。回滚时全部倒回（全部由 timeline 推导，没有单向状态；Egg 的落地压扁是按秒小动作，回滚时由 Egg 自己处理）。
- 速度余韵：140vh 在 0.7s 内滚过（≈200 vh/s）时峰值 0.99°，停下后 0.72s 回到 <0.02°；静止阅读时为 0。
- `npm run lint`、`npm run build` 通过。

### 空滚测量（正式长度）

"空滚"= 停留组里滚动但画面没有看得见的变化（厨房按秒的活动不算）。

| 段 | 空档位置 | 长度 | 小样里还剩什么在变 | 建议 |
|---|---|---|---|---|
| 1 切配菜 | 阅读停留 p 0.35–0.80 | 67.5vh | 只有组进度线（约走 15%） | 段长 150→120，停留 45%→33%（≈40vh） |
| 2 炒配菜 | 同上 | 67.5vh | 同上 | 150→120，停留 33% |
| 3 调汁 | 阅读停留 p 0.35–0.80 | 63vh | 同上 | 140→115，停留 31%（≈36vh） |
| 5 伸锅铲 | 阅读停留 p 0.70–1.00 | 30vh | 镜头 zoom 1→1.02（几乎看不出） | 100→90，phases 33/45/22/0（停留 ≈20vh） |
| 6 接蛋 | 动作阶段本身 153vh | — | 连续飞行，不算空滚，但一次飞行要滚 1.5 屏偏慢 | 180→170，phases 0/88/12/0 |
| 7 入碗 | 阅读停留 p 0.70–1.00 | 48vh | 无（bowlSettle 是按秒的） | 160→140，phases 22/56/22/0（停留 ≈31vh） |
| 8 结尾近景 | 阅读停留 p 0.30–1.00 | 105vh | 小样里三句字依次浮现，最后约 38vh 不动；换成正式静态图后整段 105vh 都不动 | 150→100，phases 45/0/55/0（停留 55vh） |

建议长度合计 1095vh（正式 1270vh），已放进读数面板"建议"一键试滚。流动段（开场、发现跳蛋）一直在 1:1 移动，不存在空滚。

### 剩余问题

1. 接蛋组和饭碗组首尾相接，中间没有流动段，接蛋组无法"释放"，只能组内交接（见下"需要集成会话改"第 3 条）。
2. 入碗段 kitchenDim 0.1→0.5 会把前景插槽里的端碗妈妈和饭碗一起调暗、轻微模糊（KitchenScene 对整个舞台加 filter）。
3. 翻页换人的最后一小段（纸边扫过铲面之后、蛋起跳之前）蛋会在端碗图上方悬停约 10vh。
4. 备菜桌面视觉还很素（左栏虚线空位很淡、标题小），最终视觉修整按要求没做；手机宽度未看。
5. 只在无头 Chrome 里按位置截图和用脚本模拟滚动测速，没有在真实触控板上感受过手感。

## 需要集成会话改：

1. **`ScrollDriver` 视口高度为 0 时会卡死（重要）**：挂载时若 `innerHeight` 为 0（应用内浏览器面板隐藏时实测出现），`locate(NaN)` 返回最后一段且 `p = NaN`；之后 `Math.abs(t.p - last.p) > 0.0005` 永远为 false，只要段号不变就不再更新（首屏停在最后一段）。同时 `lastVh = NaN` 让速度 `v` 永久变成 NaN（衰减循环也救不回来）。建议：`const h = window.innerHeight || 1`，并在 `update()` 里对 `vh` / `inst` 做 `Number.isFinite` 兜底；`last.current` 比较改成 `!(Math.abs(...) <= 0.0005)`。小样里临时兜底：挂载后派发一次 `resize`，倾斜对非有限速度按 0 处理。
2. **节拍长度**：按上面"空滚测量"表改 `beats.json`（chop/stirfry 120、sauce 115、spatula 90、catch 170、serve 140、ending 100，phases 见表）。
3. **最后一组的释放**：建议在节拍表末尾加一段流动段（小样用 `outro` 100vh，`pin: null`、`egg: "bowl"`），否则饭碗组停到页面底部，无法"放得开"。可以只 60–80vh。是否也在接蛋组和饭碗组之间加一小段流动段（20–40vh）请用户决定；小样的做法是不加、组内翻页交接，我倾向不加。
4. **入碗段的弱化**：`serve.kitchenDim` 0.1→0.5 会连前景妈妈和饭碗一起调暗、模糊。建议改成 0.1→0.15，或 `KitchenScene` 只对底图和角色加 filter、不对 `foreground` 插槽加。
5. **`SceneStage` 镜头**：`zoom > 1` 时 `k` 直接取 1，`zoom` 从 1 变到 1.001 的瞬间镜头会从默认取景跳到焦点取景。小样绕开了（weight 恒 1、默认焦点 = (768, 600) + at (0.5, 0.55)，与默认取景完全一致）。正式首页如果要推近，建议 `SceneStage` 改成按 weight 插值、zoom 只负责缩放。
6. **铲面落点（可选）**：蛋落在铲面左 1/3 处，视觉上可以接受；若要正中，`ANCHORS.spatulaLand.x` 右移约 40 场景像素（需同步 `tools/prepare_mom.py` 的计算）。
7. **换人方式（给 comic-scroll 参考）**：锅铲妈妈 → 端碗妈妈用"翻页纸边"扫过比交叉淡化好（无双影、蛋不悬空），代码在 `src/app/demo/scroll-motion/MomLayer.tsx`，可以搬进 `MomForeground`。
