# 任务：feat/kitchen-layers — 厨房前中后景拆分、补图、鼠标视差

先读 `docs/DESIGN.md`、`SPEC.md` §2–§4、`src/lib/scene.ts`。只改 DESIGN.md §6 里分给本分支的文件。

## 产出

1. `tools/split_scene.py`（PIL / numpy / cv2 都可用，可重跑）：从 `source/kitchen-main.png` 生成 `public/assets/scene/` 下五张 1536×1024 透明 PNG：
   - `back.png`：墙面、瓷砖、台面、黄锅、瓶罐、水壶。补：蛋身后的墙面与瓷砖（瓷砖按行周期克隆、砖缝对齐）、蛋旁动作线、红锅与手柄身后的瓷砖和台面（约 x 350–1480, y 505–770）。台面前沿以下透明。
   - `mid.png`：木桌、灶台、红锅、锅内油。补：吐司盘、蛋壳、格纹布身后的木纹；锅上方两滴飞溅油星用锅内纹理盖掉；火苗抽走后填暗色炉心。
   - `front.png`：吐司盘、蛋壳、格纹布。
   - `egg.png`：荷包蛋含小手小脚，边缘羽化 1–2 px，不带背景色。（cv2.grabCut + 手工矩形/种子效果不错）
   - `flame.png`：只含火苗，用橙/蓝色相键控。
2. `tools/check_overlay.png`：五层叠回去与原图做差，差异只允许在刻意清除的区域。把差图和各层缩略图贴到最终报告里。
3. `src/components/kitchen/KitchenLayers.tsx`：渲染 back/mid/front（场景像素，`position:absolute; inset:0`），
   - 鼠标视差：front ±10 px、mid ±5 px、back ±2 px，缓动跟随，`useScene().isTouch` 时关闭；
   - 按 `useScene().progress`（0→1）做退场：front 上移 1.6×、mid 1.0×、back 0.4× 视口高度，同时整体亮度降到 0.7、轻微模糊 2px（进入漫画后厨房仍作为背景存在，不消失）。
4. `src/app/dev/layers/page.tsx`：预览页，用 `<KitchenLayers mouse />` 替换占位图，加一个滑块临时驱动 progress 方便验收。
5. 实测后修正 `src/lib/scene.ts` 里的 ANCHORS 数值（只改数值）。

## 验收

- 五层叠合与原图一致，100% 显示看不出补痕；没有重复的蛋/火苗/油星。
- 鼠标移动前景明显、背景轻微；progress 拖到 1 时前景先走、墙面最慢。
- `npm run lint` 和 `npm run build` 通过。每个阶段 commit 到 feat/kitchen-layers 并 push，不合并 main。

## 用户可能会用 ChatGPT 重生成素材
如果手工补图效果不过关，在本文件末尾写清需要生成什么（例如"同一张厨房、没有蛋和火苗的干净版"），集成会话会转给用户。

## 需要集成会话改：
（在这里追加）
