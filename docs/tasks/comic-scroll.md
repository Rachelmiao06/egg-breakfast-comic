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

1. `src/app/page.tsx`：`<KitchenScene foreground={<MomForeground/>}>`（`import MomForeground from "@/components/comic/MomForeground"`），
   否则节拍 5–7 的妈妈不会出现在首页。`<ComicScroll/>` 的位置不变（开场 `h-screen` 之后）。
2. 结尾近景图到了放到 `public/assets/comic/ending.webp`（或告诉我路径），我把 `ComicScroll.tsx` 顶部的 `ENDING_SRC` 指过去即可；
   占位会自动换成静态图。
3. `.claude/launch.json`：本机 3000/3001 被其他会话占用，我本地用 3002 预览（`npm run dev -- -p 3002`），没有改提交的配置。
4. 第四版之前的占位文件（土豆汤/旧吐司裁的 `public/assets/comic/placeholder/`、`catch-point.ts`、`story.ts`、`ComicCard.tsx`、
   `tools/make_placeholders.py`）已在本分支删除；它们在 cfd3d3e 里还能找到。
