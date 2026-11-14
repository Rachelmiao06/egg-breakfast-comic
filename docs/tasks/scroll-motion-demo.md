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
（在这里写）

## 需要集成会话改：
（在这里追加）
