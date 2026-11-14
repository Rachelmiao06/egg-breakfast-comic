# 任务：feat/scroll-motion-demo — 三段滚动动效小样（运动）

开工前：确认在自己的独立 worktree，分支名 `feat/scroll-motion-demo`（若 app 起的名字不同，先 `git branch -m feat/scroll-motion-demo`），从最新 main 开始。读 `docs/DESIGN.md` 第六版（§6 所有权和共享接口）、`docs/BEATS.md`、`src/lib/beats.ts`、`src/lib/scroll-velocity.ts`、`src/components/ScrollDriver.tsx`、`src/components/SceneStage.tsx`、`src/components/kitchen/KitchenScene.tsx`、`src/components/kitchen/KitchenLayers.tsx`、`src/app/dev/beats/`（集成替身是很好的起点）。

**只改** `src/app/demo/scroll-motion/**`、`public/assets/demo/**`、本文件。其他文件只读；需要共享接口改动写在本文件末尾"需要集成会话改"。**不改**正式首页、`beats.json`、共享组件；**不新增**滚动驱动、滚动监听、ScrollTrigger、Lenis。

## 目标

不改变已确定的荷包蛋拌饭故事，在独立预览路由 `/demo/scroll-motion` 验证三个连续段落的运动，让用户先看**倾斜幅度、镜头衔接、蛋的落点**，再扩展到其他段落。

用同一套滚动方案：`<SceneProvider initialBeats={DEMO_BEATS}>` + 现有 `<ScrollDriver>`。`DEMO_BEATS` 放在路由目录里（比如 `beats.demo.ts`），从 `BEATS` 取 `chop`、`notice`、`catch` 三段复制后调整长度和阶段，**`n` 保持原节拍号**（1、4、6），这样 `derive()` 和声音按原段落工作。如果第 3 段需要"伸锅铲"的内容，把 `spatula`（n=5）放在 `catch` 前面一起用也可以，但对用户仍呈现为一段连续动作。

所有组件只读 `useScene().timeline`（段、段内进度、阶段）和 `getScrollVelocity()`，不自己计时决定节奏。被触发后的小动作秒数写在 `DEMO_BEATS` 的 `seconds` 里。

## 三段

1. **妈妈切菜漫画进入（悬挂感）**：画格像轻轻挂起的插画，悬挂点在上沿。参考 GSAP Velocity Skew（https://demos.gsap.com/demo/velocity-skew/）"滚动速度影响形变"的思路，但**以小幅旋转为主**：旋转角 ∝ 滚动速度，最大约 ±2.5°，带一点阻尼弹簧，停下后平稳回正；skew 最多 ±1° 或不用，**不能明显拉歪妈妈的脸和身体**。阅读停留时速度为 0 就完全静止，**不要持续摇晃**。速度在 gsap.ticker / rAF 里用 `getScrollVelocity()` 读，不要放进 React state。
2. **镜头向灶台推进**：用 `<KitchenScene camera={{ x, y, weight: 1, zoom }}>` 推近灶台（zoom 约 1 → 1.35），前中后景错速：前景推得最多、背景最少。`KitchenLayers` 冻结不能改：在路由内做你自己的分层渲染（复用同样的 `public/assets/scene/*.png`、同样的 `Z`），读舞台上的 `--cam-zoom` 做错速；或在本文件末尾提出需要的共享接口。切菜漫画在推进时要和背景保持空间联系（例如作为最前景平面，随镜头更快地离开画面，而不是突然消失）。
3. **妈妈伸锅铲接蛋（漫画边界打开）**：锅铲妈妈（`MOM_SPATULA`，场景层，按 scene.ts 摆放）先出现在一个漫画画格边框里，随后边框向外打开（clip-path 扩到全屏、边框淡出），妈妈成为前景；同一颗蛋（厨房里的 `<Egg>`，由 `flight` 驱动）从后景锅里飞到铲面 `ANCHORS.spatulaLand`。在 `catch` 段的进入阶段做"边界打开"（这时 `flight` 仍为 null，蛋在锅里继续跳），动作阶段飞行。

缺图一律用明确标记的占位（米白底 + 虚线框 + "占位：…"）。手机适配和最终视觉修整**现在不做**。

## 产出

- `src/app/demo/scroll-motion/page.tsx` 及同目录组件；页面角落有可收起的读数：当前段、阶段、段内进度、滚动速度、当前倾斜角、镜头 zoom、flight。
- 在本地 dev server 上跑（worktree 里先 `npm ci`，然后 `npx next dev -p 3002`），给出预览地址。

## 验收（先报告给用户看，不合并 main）

- 快速滚动和慢速滚动时，切菜画格的倾斜都在 ±2.5° 内，停下后 1 秒内回正且不再晃。
- 推进时前中后景错速清楚，漫画离场和镜头连续。
- 边界打开后蛋落在铲面上；回滚时一切倒回。
- `npm run lint`、`npm run build` 通过；commit 并 push `feat/scroll-motion-demo`。报告贴三段截图、实测最大倾斜角和剩余问题。

## 需要集成会话改：
（在这里追加）
