# 任务：comic-scroll — 妈妈荷包蛋拌饭的前景漫画、段落与声音触发位置（第四版）

开工前：`git fetch origin && git merge origin/main`（有冲突时以 main 的 `src/lib/*`、`docs/*` 为准）。先读 `SPEC.md` §15、`docs/DESIGN.md` 第四版（§1 节拍表、§7 声音段落）、`src/lib/scene.ts`（`MOM_PANELS`、`MOM_SPATULA`、`MOM_SERVE`、锚点）、`src/lib/scene-context.tsx`。只改 DESIGN §6 分给本分支的文件。

**作废**：旧六格、吐司结尾、v3 的"妈妈介绍鸡蛋黄油吐司"、以及从土豆汤漫画 / 旧吐司漫画裁的占位图。已写的布局、滚动触发、调试叠层、接蛋点思路可以复用，但占位图换成下面的正式素材。

## 素材（已在 main，集成会话已清理柔边并裁好）

- 节拍 1–3 画格：`MOM_PANELS.chop` / `.stirfry` / `.sauce`（`public/assets/mom/*.webp`，透明背景）。
- 节拍 5–6 场景层：`MOM_SPATULA`（妈妈伸出空锅铲），按 scene.ts 里的 x / y / scale 摆放，铲面落点 = `ANCHORS.spatulaLand`。
- 节拍 7 场景层：`MOM_SERVE`（妈妈端碗，碗中央留空给活动蛋），按 scene.ts 摆放，碗中央 = `ANCHORS.bowlCenter`。
- 节拍 8：用户正在生成一张**结尾近景**（完整荷包蛋在饭中央 → 淋酱汁 → 勺子划开流黄）。它只是视觉参考，**不是分层动画素材**。未到之前放一张明确标记的占位（米白底 + 虚线框 + "占位：结尾近景（淋汁、划开流黄）"），到了就把它当一张静态图放进来。

妈妈图都是合并插画，没有关节层：**不要让整张人物上下晃动冒充切菜/炒菜/搅汁**。允许整格入场离场和整格很轻的漂浮（±3px）。

## 段落（开场一屏之后）

| 节拍 | 滚动区（约） | 做什么 | 写入 |
|---|---|---|---|
| 1 切配菜 | 130vh | chop 画格浮在弱化的厨房上（透明人物图，可加一张很淡的纸卡衬底），上浮 + 淡入 | 前 60vh `progress` 0→1；`activePanel=1` |
| 2 炒配菜 | 130vh | stirfry 画格接替 chop | `activePanel=2` |
| 3 调汁 | 130vh | sauce 画格接替 | `activePanel=3` |
| 4 发现跳蛋 | 110vh | 画格散去，`progress` 回到约 0.1，后景锅里的蛋重新清晰；可以在画面外加一个很小的视线引导或"！" | `activePanel=4` |
| 5 伸锅铲 | 90vh | `MomForeground` 渲染 `MOM_SPATULA`，从右下滑入到摆放位置（scrub） | `activePanel=5` |
| 6 接蛋 | 180vh | scrub `flight` 0→1；回滚倒回，回到节拍 5 之前 `setFlight(null)` | `activePanel=6` |
| 7 放进饭碗 | 150vh | `MOM_SPATULA` 交叉淡化为 `MOM_SERVE`；scrub `serve` 0→1；回滚倒回，回到节拍 6 末尾之前 `setServe(null)` | `activePanel=7`，`flight` 保持 1 |
| 8 结尾近景 | 150vh | 静态结尾近景（或占位）全屏淡入，验证镜头从厨房切到近景；停住后页面结束 | `activePanel=8`，`serve` 保持 1 |

`reducedMotion`：画格只淡入；MomForeground 直接出现；`flight`、`serve` 直接到 1。
**声音**：本分支不播放任何声音。声音由主会话按 `activePanel` / `flight` / `serve` 触发（DESIGN §7），你只要保证这些值在上表的滚动位置准确切换，回滚时正确倒回。

## 产出

- `src/components/comic/ComicScroll.tsx` 及子组件；`src/components/comic/MomForeground.tsx`（场景层，`position:absolute`、`zIndex: Z.mom`，用 `MOM_SPATULA` / `MOM_SERVE` 的摆放，不要自己另定坐标）。
- `src/app/dev/comic/page.tsx`：`<KitchenScene foreground={<MomForeground/>}>` + `<ComicScroll/>`，角落显示 `progress / activePanel / flight / serve`，并在 `spatulaLand`、`bowlLand` 画小十字。
- 你之前的 `catch-point.ts`（视口坐标接蛋点）不再需要：蛋和妈妈都在场景层，落点直接用 scene.ts 的锚点。

## 验收

- 顺序 0→8 连续，无硬切；厨房始终在背景动；三组画格没有整人上下晃。
- 节拍 5 锅铲妈妈的铲面正好压在 `spatulaLand` 十字上；节拍 7 端碗妈妈的碗中央正好在 `bowlCenter`。
- 回滚时 `flight` / `serve` 正确倒回并在对应位置变回 null。
- `npm run lint`、`npm run build` 通过。commit 并 push 到本分支，不合并 main。报告贴节拍 1、5、7、8 截图和剩余问题。

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
