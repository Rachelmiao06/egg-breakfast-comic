# 任务：feat/kitchen-layers — 厨房前中后景拆分、补图、鼠标视差（第二版）

先读 `docs/DESIGN.md`（第二版）、`src/lib/scene.ts`。只改 DESIGN.md §6 里分给本分支的文件。开工前 `git merge origin/main`。

**变化**：用户已经提供了干净底图 `source/kitchen-clean.png`（无蛋、无火苗、无油、无动作线，与原画逐像素对齐）和透明蛋 `source/egg.png`。本分支不再需要抠蛋、抽火苗或清动作线，只把干净底图拆成三层。厨房在漫画阶段**不退场**，只在背景里被轻微弱化（弱化由 KitchenScene 统一做，本分支不管调暗）。

## 产出

1. `tools/split_scene.py`（PIL / numpy / cv2，可重跑）：从 `source/kitchen-clean.png` 生成 `public/assets/scene/` 下三张 1536×1024 透明 PNG：
   - `back.png`（不透明到台面前沿，约 y 770 以下透明）：墙、瓷砖、后台面、黄锅、瓶罐、水壶。补红锅与锅柄、灶台身后的瓷砖和台面（约 x 340–1480, y 500–770），瓷砖按行周期克隆、砖缝对齐。
   - `mid.png`：木桌、绿色灶台、红锅（含锅柄）。补吐司盘、蛋壳、格纹布身后的木纹（沿水平纹理克隆）。
   - `front.png`：吐司盘（含吐司）、蛋壳、格纹布。边缘羽化 1–2 px。
   - 叠合检查图 `tools/check_overlay.png`：三层叠回去与 kitchen-clean 做差，应几乎为零。
2. `src/components/kitchen/KitchenLayers.tsx`：三层用场景像素 `position:absolute; inset:0` 叠放；
   - 鼠标视差：front ±10 px、mid ±5 px、back ±2 px，缓动跟随，`useScene().isTouch` 时关闭；
   - 随 `useScene().progress`（0→1）做**轻微**景深漂移：front 上移约 14 px、mid 6 px、back 2 px（场景像素），让读漫画时厨房仍有一点呼吸感。不做整体移出屏幕，不调亮度/模糊。
   - 注意：蛋、影子、火苗、油泡渲染在三层之上（KitchenScene 的 children）。蛋会在锅里和飞向吐司时经过 front 层上方，这是预期的。
3. `src/app/dev/layers/page.tsx`：预览页 `<KitchenScene base={<KitchenLayers mouse />} />`，加一个临时滑块驱动 progress。

## 验收

- 三层叠合与 kitchen-clean 一致，100% 显示看不出补痕。
- 鼠标移动前景明显、背景轻微；progress 拖到 1 时只有轻微漂移，厨房始终完整可见。
- `npm run lint` 和 `npm run build` 通过。每个阶段 commit 到 feat/kitchen-layers 并 push，不合并 main。
- 最终报告贴三层缩略图、差图、预览截图和剩余问题。

## 需要集成会话改：
（在这里追加）
