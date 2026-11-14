# 任务：kitchen-layers — 厨房环境、视差、锅沿遮挡，清除吐司终点（第四版）

开工前：`git fetch origin && git merge origin/main`（冲突时以 main 的 `src/lib/*`、`docs/*` 为准）。先读 `docs/DESIGN.md` 第四版（§1、§2 Z 顺序、§4）、`src/lib/scene.ts`。只改 DESIGN §6 分给本分支的文件。

**变化**：菜品改为"妈妈的荷包蛋拌饭"，吐司结尾撤销。你已经完成的分层（back / mid / main / pan-rim / front / flame）可以保留，按下面调整：

1. **火苗不归本分支**：`flame.png` 由主会话从原画抽取（已在 feat/kitchen-scene），请不要再产出或修改 `public/assets/scene/flame.png`，从你的分支里去掉它。
2. **不要改 `src/lib/scene.ts`**：你实测的锚点（eggRest 742,666、panInner、panRimBox、flameBox、kettleSpout）很有用，请把它们写到本文件末尾"需要集成会话改"，由主会话合并。把你分支里对 `src/lib/scene.ts` 的修改撤回。
3. **吐司盘**：拆成单独一层 `front-toast.png`，`KitchenLayers` 默认**不渲染**它（吐司已不在故事里）。它身后的木纹在 main/mid 层补好，这样去掉吐司后桌面完整。若补不好，在本文件末尾标"待替换"，用户会生成替换图（ASSET-REQUESTS 第四版 K1）。
4. **为前景妈妈让位**：`ANCHORS.momZone` = [420, 324, 1536, 1024]，节拍 5 起妈妈伸锅铲占据这一块。把落在这块里的前景物件（蛋壳、格纹布）放在 `front-right.png`，`activePanel >= 5` 时 0.5s 淡出，回到 < 5 时淡回。
5. **锅沿遮挡**：保留 `pan-rim.png`，z = `Z.panRim`，与锅身同一视差值；请确认它挡住锅里蛋的脚但不挡起跳后的蛋（起跳后蛋 z = 80）。
6. 视差与漂移照旧：front ±10、mid/pan-rim ±5、back ±2 px；`progress` 只带来轻微景深漂移，不退场、不调暗。

## 产出

- `tools/split_scene.py` 更新；`public/assets/scene/{back,mid 或 main,pan-rim,front-toast,front-right}.png`；叠合差图。
- `src/components/kitchen/KitchenLayers.tsx`（层名按你的实际文件，z 用 `Z`）。
- `src/app/dev/layers/page.tsx`：预览，滑块驱动 progress 和 activePanel，画出 momZone 虚线框。

## 验收

- 去掉吐司后的桌面看不出补痕；叠合（含吐司层）与 kitchen-clean 一致。
- `activePanel` 拖到 5 时蛋壳、格纹布淡出，momZone 内干净。
- 锅沿挡住 `eggRest` 处蛋的脚，视差时锅沿和锅身不脱节。
- `npm run lint`、`npm run build` 通过；commit 并 push 本分支，不合并 main。报告贴分层缩略图、差图、预览截图（activePanel 0 和 5）。

## 需要集成会话改：
（在这里追加实测锚点等）
