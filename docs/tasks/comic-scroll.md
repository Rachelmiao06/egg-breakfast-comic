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

---

## 2026-11-13 改向：前景改成"妈妈做荷包蛋早餐"五段占位布局

用户直接指示（本分支收到的两条消息）：前景主角改为妈妈，旧六格蛋漫画和土豆汤内容不再是最终故事；
先用简单占位图搭五个前景段落，交付段落布局、滚动出现顺序和接蛋位置预览；正式漫画由 ChatGPT 重画后替换占位，
不必继续费力加工旧六格。因此上面"六格裁切 / 抠蛋 / 补底"的产出停在半路（`tools/split_comic.py` 未提交），
`public/assets/comic/` 下只有 `placeholder/`。

### 本分支现在的产出

- `tools/make_placeholders.py`：从 `~/Desktop/Chinese Mom’s Potato Leek Soup Comic.png`（只借人物姿势和笔触）
  和 `source/kitchen-main.png`、`source/comic-page-2.png` 裁占位块 → `public/assets/comic/placeholder/*.png`
  + `src/components/comic/placeholder-manifest.json`（尺寸）。参考图不在仓库里，但产出已提交，不跑脚本也能 build。
- `src/components/comic/story.ts`：五段的卡片/气泡布局（组盒百分比），每段附"厨房应该做什么"的备注。
- `src/components/comic/ComicScroll.tsx`：100vh 导入段 scrub `setProgress` 0→1；五段各一屏，段中心进入视口中部 35% 区域时
  卡片淡入+上浮 12px 错开出现、气泡随后；只播一次，回滚不重放；`setActivePanel(n)`，回滚到上一段 `n-1`；
  第 4 段 scrub `onFlightProgress(t)`（center 70% → center 30%）；结尾 30vh 空白；reducedMotion 只淡入。
- `src/components/comic/catch-point.ts`：接蛋点常量 `EGG_CATCH`（组盒 66%,60%，铲面 -8°，蛋宽 24% 组宽）和
  `getEggCatch()`（读 `[data-egg-catch]` 的视口坐标）。
- `src/components/comic/ComicCard.tsx`：纸卡（CSS 不规则圆角 + 噪点纸纹）、气泡、占位锅铲（铲面 + 前沿两层）。
- `src/app/dev/comic/`：预览页 = 厨房占位图 fixed 在底层（按 progress 变暗）+ 五段 + 调试叠层
  （厨房蛋名义位置、第 3 段视线虚线、第 4 段接蛋点、飞行弧线上随 t 走的点、右上角 HUD）。

### 接蛋位置与遮挡关系（给集成会话）

- 第 4 段组盒里有 `[data-egg-catch]`：左上角 = 蛋落定时脚底中心，`width` = 落定后蛋的宽度（px），高 0。
  `getEggCatch()` 返回 `{x, y, eggWidth, angle}`（视口像素，滚动时每帧可调）。
- 层序（同一个组盒内）：卡片 < 占位铲面(`z-1`) < `catchSlot`(`z-2`, ComicScroll 的 prop，放落定后的蛋) < 铲面前沿 `[data-egg-occluder]`(`z-3`) < 气泡(`z-4`)。
  蛋落在 slot 里时下缘被前沿挡住一点；飞行途中的蛋不在 slot 里，在集成会话自己的层上（建议 fixed、z 在漫画 z-10 之上），
  用 `getEggCatch()` 当终点；落定那一帧再把蛋搬进 `catchSlot`（或继续用 fixed 层但把 occluder 的位置也读出来：它在 slot 左侧 0.4 倍宽处）。
- 飞行进度：`<ComicScroll onFlightProgress={t => ...}/>`，t=0 妈妈刚伸出锅铲（第 4 段中心到视口 70%），t=1 蛋应落定（中心到 30%）。
  第 3 段激活（activePanel=3）时厨房蛋进入「等待起跳」，t>0 停掉自主跳。
- 第 4 段里没有画固定的蛋（"留出接蛋位置"），第 5 段的"蛋在吐司上"目前是占位图（吐司+黄油），正式图应画妈妈端出带蛋的早餐。

## 需要集成会话改：

1. `src/lib/scene-context.tsx`：建议加 `flight: number`（0–1）和 `eggState: "idle"|"waiting"|"flying"|"caught"|"done"`，
   目前 ComicScroll 只能通过 `onFlightProgress` prop 把 t 交出去，由 page.tsx 接到状态机。
2. `src/app/page.tsx`：`<ComicScroll onFlightProgress=... catchSlot={<落定的蛋/>}/>`；首页前面的 `h-screen` 占位保留
   （厨房无文字开场一屏 + ComicScroll 自带的 100vh 导入段 = 第 1 段前共 200vh）。
3. `.claude/launch.json`：本机 3000/3001 被其他会话占用，我本地加了 `dev-comic`（端口 3002）配置，没有提交；
   若想保留请集成会话决定。
4. `docs/DESIGN.md` §3/§4：ComicScroll 接口从"六格"改为"五段 + catchSlot + onFlightProgress"；
   §5 素材路径加 `public/assets/comic/placeholder/`（临时，正式图替换后删）。
5. 正式漫画素材（ChatGPT 重画）需要的规格：每段 1–3 张透明底 PNG（人物不垫纸），对白可画在图里也可以继续用 HTML 气泡；
   第 3 段妈妈视线朝左上（后景蛋在视口约 47% x、55% y）；第 4 段锅铲从右向左伸，铲尖留空，铲面前沿单独出一张小图做遮挡层。
