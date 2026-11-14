# 任务：comic-scroll — 妈妈前景漫画、锅铲接蛋的滚动节拍、端出早餐（第三版）

开工前：`git fetch origin && git merge origin/main`。先读 `SPEC.md` §14、`docs/DESIGN.md`（第三版，§1 节拍表和 §2 遮挡最重要）、`src/lib/scene-context.tsx`、`src/lib/scene.ts`、`src/components/kitchen/KitchenScene.tsx`。只改 DESIGN.md §6 分给本分支的文件。

**旧的"六格逐格滚动"和 v2 的"两个纯荷包蛋浮动漫画、直接飞向吐司"都已作废。** 最终故事：

> 妈妈介绍鸡蛋、黄油、吐司 → 开始煎蛋 → 发现后景的蛋一直跳 → 妈妈在前景伸出锅铲 → 同一颗蛋从后景飞到前景锅铲上 → 妈妈把它放到吐司上，端出早餐。

**妈妈的素材尚未生成。** 本任务先用明确标记的占位图把布局、节奏和接线搭好。占位图规则：米白底 + 棕色虚线边框 + 中间一行小字"占位：<画面内容>"，尺寸和最终素材一致。**不要裁旧六格或拿旧蛋图冒充妈妈或接蛋动作。**

## 结构（开场一屏之后）

| 节拍 | 滚动区（约） | 画面 | 写入共享状态 |
|---|---|---|---|
| 1 介绍食材 | 130vh | 前景画格浮在弱化的厨房上（最大宽约 720px），占位"妈妈介绍鸡蛋、黄油、吐司"。进入：上浮 + 淡入，停留时轻微漂浮 | 用前 60vh 把 `progress` 0→1；`activePanel=1` |
| 2 开始煎蛋 | 130vh | 第二个前景画格，占位"妈妈开始煎蛋"。1 往上飘走，2 从另一侧浮入 | `activePanel=2` |
| 3 发现蛋在跳 | 120vh | 画格散去，`progress` 回到约 0.1，让后景锅里一直在跳的蛋重新清晰；可加一个很小的"！"或视线引导，占位"妈妈回头发现蛋在跳" | `activePanel=3` |
| 4 伸出锅铲 | 100vh | `MomForeground` 从 `ANCHORS.momZone` 右下滑入，铲面停在 `ANCHORS.spatulaLand`（scrub） | `activePanel=4` |
| 5 飞行 | 200vh | scrub：`flight` 0→1（回滚倒回，回到节拍 4 之前 `setFlight(null)`）。蛋本体由厨房里的 `<Egg>` 按 `flight` 飞，镜头由 KitchenScene 跟随锅铲；本分支只写数值，可加很轻的动作线点缀 | `activePanel=5`，`progress` 保持低 |
| 6 端出早餐 | 150vh | 前景结尾画格淡入并占满视口，占位"妈妈把蛋放到吐司上，端出早餐"。停住后页面结束，不加按钮 | `activePanel=6`，`flight` 保持 1 |

`reducedMotion` 时：画格只淡入不漂浮；`MomForeground` 直接出现；飞行节拍直接 `setFlight(1)`。

## 产出

1. `src/components/comic/ComicScroll.tsx` 及子组件（`ComicPanel`、`Placeholder` 等，命名自定）：页面层（z-10）的滚动区和节拍 1、2、3、6 的前景画格，ScrollTrigger 写共享状态。
2. `src/components/comic/MomForeground.tsx`：**场景层组件**，由 KitchenScene 的 `foreground` 插槽渲染，`position:absolute`、`zIndex: Z.mom`、场景像素定位。占位：一张覆盖 `momZone` 的半透明占位图（虚线框 + "占位：妈妈的手臂和锅铲"），并用一个小圆点标出 `spatulaLand`（铲面落点）。`activePanel >= 4` 时滑入，`< 4` 时退出；位移随 scrub。
3. 占位图放 `public/assets/comic/placeholder-*.svg`（或直接用组件渲染），文件名写清内容。
4. `src/app/dev/comic/page.tsx`：预览页 `<KitchenScene foreground={<MomForeground/>}>{角色占位或空}</KitchenScene>` + `<ComicScroll/>`，角落显示 `progress / activePanel / flight` 数值。蛋可以先不放（集成时由 kitchen-scene 的 `<KitchenCharacters/>` 接入）。

## 验收

- 滚动顺序：开场 → 1 → 2 → 3 → 4 → 5 → 6，过渡连续不硬切；厨房始终在背景里动。
- 每个占位一眼能看出是占位，且写明画面内容。
- 回滚时 `flight` 正确倒回，回到节拍 4 之前变回 null；`MomForeground` 跟着退出。
- `npm run lint` 和 `npm run build` 通过。每个阶段 commit 到本分支并 push，不合并 main。
- 最终报告贴四张截图（节拍 1、4、飞行中、6）和剩余问题。

## 需要集成会话改：
（在这里追加）
