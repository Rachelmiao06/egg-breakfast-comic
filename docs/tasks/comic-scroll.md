# 任务：feat/comic-scroll — 浮动局部漫画、滚动飞行节拍、早餐结尾（第二版）

先读 `docs/DESIGN.md`（第二版，§1 节拍表最重要）、`src/lib/scene-context.tsx`、`src/lib/scene.ts`，再看 `source/storyboard-v2.png`。只改 DESIGN.md §6 里分给本分支的文件。开工前 `git merge origin/main`。

**变化**：旧六格逐格滚动作废，旧六格只作参考和兜底素材。最新结构是：两个浮动局部漫画 → 全屏滚动控制蛋飞向吐司 → 早餐结尾。**不要把 storyboard-v2 当整张长图滚动展示。**

## 结构（页面在开场一屏之后）

1. **浮动漫画 A**（约 120vh 滚动区）：一块不规则水彩边框的局部漫画浮在弱化的厨房上，内容是"蛋在滋滋油锅里眯眼享受"。进入时从下方浮上来 + 淡入，停留时轻轻上下漂浮（±4px）。同时用滚动把 `setProgress` 从 0 推到 1。`setActivePanel(1)`。
2. **浮动漫画 B**（约 120vh）：第二块，"蛋扒着锅沿望向黄油吐司"，吐司闪一下（小光芒）。A 往上飘走淡出，B 从另一侧浮入。`setActivePanel(2)`。
3. **飞行**（约 200vh，ScrollTrigger scrub）：B 散去，`setActivePanel(3)`，`setProgress` 回到约 0.15，`setFlight` 随滚动从 0 推到 1（向上回滚时倒回，回到节拍 2 之前 `setFlight(null)`）。蛋本体由厨房里的 `<Egg>` 按 `flight` 飞，本分支只写数值；可以在这一屏加很轻的动作线或光芒点缀。
4. **结尾**（约 150vh）：`setActivePanel(4)`，`flight` 保持 1。早餐完成画面淡入并占满视口：蛋躺在吐司上、热饮冒热气、窗光。停住后页面结束，不加按钮。

`reducedMotion` 时：浮动漫画只做淡入，不漂浮；飞行节拍直接 `setFlight(1)`。

## 素材（先用兜底，用户可能后补高清图）

- 浮动漫画 A 兜底：从 `source/comic-page-1.png` 第 1 格（锅里蓄力）裁切，装进不规则水彩形状遮罩（SVG mask 或 CSS mask，边缘做纸纹羽化）。
- 浮动漫画 B 兜底：第 3 格（扒锅沿看吐司）同样处理。
- 结尾兜底：`source/comic-page-2.png` 第 6 格（蛋在吐司上、热饮、窗边）。
- 旧格子里画着中文对白，按用户之前的决定**保留图内文字，不再叠加网页文字**。如果后来换成用户生成的无字新图，再在集成时决定是否加网页文字。
- `tools/split_comic.py`（可重跑）负责裁切并输出到 `public/assets/comic/`。

## 产出

- `src/components/comic/ComicScroll.tsx` 及子组件（`FloatingVignette`、`FlightBeat`、`EndingScene` 等，命名自定）。
- `src/app/dev/comic/page.tsx`：预览页，用 `<KitchenScene>` 做背景 + `<ComicScroll/>`，并在角落显示当前 `progress / activePanel / flight` 数值方便验收。

## 验收

- 滚动顺序：开场 → A → B → 飞行 → 结尾，过渡连续不硬切；厨房始终在背景里动。
- 回滚时 `flight` 正确倒回，回到 B 之前变回 null（蛋回锅里继续跳）。
- `npm run lint` 和 `npm run build` 通过。每个阶段 commit 到 feat/comic-scroll 并 push，不合并 main。
- 最终报告贴三张截图（A、飞行中、结尾）和剩余问题。

## 需要集成会话改：
（在这里追加）
