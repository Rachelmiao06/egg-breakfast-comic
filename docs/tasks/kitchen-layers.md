# 任务：kitchen-layers — 厨房分层、锅沿遮挡、为前景妈妈留位、鼠标视差（第三版）

开工前：`git fetch origin && git merge origin/main`。先读 `docs/DESIGN.md`（第三版，§1、§2 的 Z 顺序最重要）、`src/lib/scene.ts`。只改 DESIGN.md §6 分给本分支的文件。

用户已提供干净底图 `source/kitchen-clean.png`（无蛋、无火苗、无油、无动作线，与原画逐像素对齐）。本分支不抠蛋、不抽火苗，只把干净底图拆层。厨房在漫画阶段**不退场**，弱化由 KitchenScene 统一做。

## 产出

1. `tools/split_scene.py`（PIL / numpy / cv2，可重跑）：从 `source/kitchen-clean.png` 生成 `public/assets/scene/` 下五张 1536×1024 透明 PNG：
   - `back.png`：墙、瓷砖、后台面、黄锅、瓶罐、水壶。补红锅、锅柄、灶台身后的瓷砖和台面（约 x 340–1480, y 500–770），瓷砖按行周期克隆、砖缝对齐。
   - `mid.png`：木桌、绿色灶台、红锅锅身和锅柄、锅内底。补吐司盘、蛋壳、格纹布身后的木纹。
   - `pan-rim.png`：**红锅的前沿**（从锅内底前缘到锅身外侧的那一圈前唇，大约锅内深色区域下沿往下到红色外壁上沿），用来挡住锅里蛋的脚，产生"蛋在锅里"的遮挡关系。
   - `front-left.png`：吐司盘（含吐司）。
   - `front-right.png`：蛋壳、格纹布。节拍 4 起妈妈的手臂和锅铲从右下伸入（`ANCHORS.momZone`），这一层要能独立淡出让位。
   - 叠合检查图 `tools/check_overlay.png`：五层叠回去与 kitchen-clean 做差，应几乎为零。
2. 实测锅内起跳点：在 `docs/tasks/kitchen-layers.md` 末尾写出锅底中心、锅前沿在 x=720 处的 y 值和建议的 `panLaunch`，由集成会话更新 `src/lib/scene.ts`（不要自己改 lib）。
3. `src/components/kitchen/KitchenLayers.tsx`：五层用场景像素 `position:absolute; inset:0` 叠放，各层 `zIndex` 用 `Z.back / Z.mid / Z.panRim / Z.frontLeft / Z.frontRight`；
   - 鼠标视差：frontLeft/frontRight ±10 px、mid/panRim ±5 px、back ±2 px，缓动跟随，`isTouch` 时关闭。panRim 必须和 mid 同步移动（同一视差值），否则锅沿会和锅身错开；
   - 随 `progress` 轻微景深漂移（front 约 14 px、mid/panRim 6 px、back 2 px，场景像素），不整体移出、不调暗；
   - `activePanel >= 4` 时 frontRight 在 0.5 s 内淡出，回到 < 4 时淡回。
4. `src/app/dev/layers/page.tsx`：预览页 `<KitchenScene base={<KitchenLayers mouse />} />`，加临时滑块驱动 progress 和 activePanel，并在 `ANCHORS.momZone` 画一个半透明虚线框标出妈妈预留区域，确认它和你的分层不冲突。

## 验收

- 五层叠合与 kitchen-clean 一致，100% 显示看不出补痕。
- 在预览页放一张 `public/assets/scene/egg.webp` 到 `eggRest`、z=40，确认锅沿能挡住它的脚底，且视差时锅沿和锅身不脱节。
- 鼠标移动前景明显、背景轻微；progress 拖到 1 时只有轻微漂移；activePanel 拖到 4 时蛋壳和格纹布淡出。
- `npm run lint` 和 `npm run build` 通过。每个阶段 commit 到本分支并 push，不合并 main。
- 最终报告贴五层缩略图、差图、预览截图（含妈妈预留框）和剩余问题。

## 需要集成会话改：
（在这里追加）
