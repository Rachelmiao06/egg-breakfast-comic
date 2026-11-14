# 任务：feat/comic-scroll — 六格漫画裁切、逐格滚动、局部动作

先读 `docs/DESIGN.md`、`SPEC.md` §2 S3、§5–§8、`src/lib/scene-context.tsx`。只改 DESIGN.md §6 里分给本分支的文件。

## 素材

`source/comic-page-1.png`（第 1–3 格）、`source/comic-page-2.png`（第 4–6 格），各 1086×1448，三格有明显边框。故事顺序和每格动作见 SPEC.md §6。对白保留在图内，不清除。

## 产出

1. `tools/split_comic.py`（可重跑）：检测边框裁出六格 → `public/assets/comic/p1.png … p6.png`；每格再抠出荷包蛋（含手脚）→ `p{n}-egg.png`，并把蛋身后补好 → `p{n}-bg.png`。第 1、5、6 格蛋底部不离开锅/吐司且只会变宽，只需补蛋顶部露出的墙面；第 2、3、4 格补墙面/瓷砖/锅沿。清掉蛋旁的小动作线（第 4 格的虚线弧可以保留）。
2. `src/components/comic/ComicScroll.tsx` 及子组件：
   - 六格纵向排布，每格一屏高的区段，格子最大宽 960px 居中，纸面米白卡片带轻微纸纹阴影；
   - GSAP ScrollTrigger：格子中心进入视口中部 35% 区域时激活：淡入 + 上浮 12px（0.6s），0.3s 后触发一次该格动作；离开不重放，回滚不闪；
   - 动作用 `p{n}-bg.png` + `p{n}-egg.png` 叠加实现，蛋的 transform-origin 在底部，动作定义见 SPEC §6；蛋只在原位附近动；
   - 向上滚进第一格时把 `setProgress` 从 0 平滑推到 1（用第一格之前的 100vh 区段做 scrub），激活第 n 格时 `setActivePanel(n)`；
   - 第六格后留约 30vh 空白，页面结束；
   - `reducedMotion` 时只做淡入。
3. `src/app/dev/comic/page.tsx`：预览页，米白背景 + `<ComicScroll/>`，不需要厨房。

## 验收

- 六格按顺序出现，一屏基本只看一格，每格进入时淡入并做一次小动作，中文对白清晰；回滚不重放。
- 叠合检查：`p{n}-bg + p{n}-egg` 与 `p{n}` 一致。
- `npm run lint` 和 `npm run build` 通过。每个阶段 commit 到 feat/comic-scroll 并 push，不合并 main。

## 需要集成会话改：
（在这里追加）
