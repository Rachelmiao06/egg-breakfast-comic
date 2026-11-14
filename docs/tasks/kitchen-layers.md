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

---

## 交付（第三版，2026-11-13，分支 claude/kitchen-layers-3463cc）

v1 的交付说明（main / front / flame、inPan 插槽、drift / dim 等 props）已作废，代码在 41b5fe6、7d76b0b 里保留。v3 复用了其中的补图方法和视差代码。

### 五层（`public/assets/scene/`，1536×1024 透明，原位，由 `python3 tools/split_scene.py` 生成）

| 文件 | Z | 内容 | 补图 |
|---|---|---|---|
| `back.png` | 10 | 墙、瓷砖、后台面、左侧灶、黄锅、瓶罐、水壶（不透明） | 瓷砖按砖缝逐格复制；红锅、锅柄、灶台后的台面按横向色带从同一色带的可见像素续接；黄锅被锅沿挡住的一角按锅身中轴镜像 |
| `mid.png` | 20 | 木桌、绿色灶台、红锅锅身、锅柄、锅内底 | 吐司盘、蛋壳、格纹布身后的木纹用相邻可见木纹镜像续接（纹理横向连续） |
| `pan-rim.png` | 50 | 红锅前半：前唇 + 红色外壁 | 不需要补 |
| `front-left.png` | 60 | 吐司盘和吐司 | — |
| `front-right.png` | 61 | 蛋壳、格纹布 | — |

- 叠合检查：`tools/check_overlay.png`。五层叠回去与 kitchen-clean 相比，平均差 0.37/255，99% 的像素差值不超过 8，剩余差异只在物件 1–2px 的羽化轮廓上（为了移动时没有硬边）。`tools/layers_preview.png` 是五层缩略图。
- pan-rim 比任务里写的"一圈前唇"多包含了红色外壁。蛋脚只要落到锅内深色区域下沿以下就会被挡住，不会画到外壁上面。它和 mid 用同一套位移，重复的像素不会出现错位。

### 实测锅底与锅前沿（建议值，由集成会话更新 `src/lib/scene.ts`）

| 量 | 值 |
|---|---|
| 锅底（深色煎面）椭圆中心 | (743, 579)，半轴 398 × 77 |
| 锅底可见区域外接框 | [360, 502, 1109, 661] |
| 锅前沿遮挡线（pan-rim 上沿） | x=450: 633，x=600: 653，**x=720: 657**，x=743: 658，x=900: 651，x=1050: 630 |
| pan-rim 包围盒 | [358, 601, 1119, 747] |
| **建议 `panLaunch`**（和 `eggRest`） | **{ x: 720, y: 670 }** |

- 现在 lib 里的 (720, 618) 会让蛋整只站在锅沿线以上，脚完全露出，锅沿挡不到。
- y=670 时，按 `eggSize` 388×388、蛋图底边就是脚底：靠下的左脚约 13px 藏到锅沿后面，右脚刚好碰到锅沿，看起来站在锅里。想藏得更深可以用 676。
- 其他实测框：吐司盘 [0, 806, 452, 1023]，蛋壳 [1132, 834, 1441, 1009]，格纹布 [1236, 680, 1535, 930]。

### `<KitchenLayers mouse />` 行为
- 五个 div 是 SceneStage 里的兄弟元素，各自带 `zIndex = Z.*`，可以和角色层穿插。外面没有包容器，也不建新的层叠上下文。
- 鼠标视差：front ±10、mid 和 pan-rim ±5（同一个值）、back ±2，缓动按时间计算，触屏和减少动效时关闭。
- 随 `progress` 向上漂移：front 14、mid 和 pan-rim 6、back 2（场景像素）。不调暗、不退场。
- `activePanel >= 4` 时 front-right 在 0.5 秒内淡出，回到 4 以下时淡回。
- 每层按当前位移自动放大一点（最多约 1.035），画布边缘永远不露。
- 锅里的角色要跟锅一起动：每帧把 mid 的位移写成 stage 元素上的 CSS 变量 `--kl-mid-x`、`--kl-mid-y`（另有 `--kl-mid-s`，是以 (768, 600) 为中心的放大量，锅附近误差小于 1px）。锅里的蛋、影子、油、油泡、火苗外层加 `transform: translate(var(--kl-mid-x, 0px), var(--kl-mid-y, 0px))` 即可。预览页的测试蛋就是这么做的，视差时和锅沿不脱节。

### 预览
`/dev/layers`：`<KitchenScene base={<KitchenLayers mouse />}>`，测试蛋（egg.webp，z=40）站在建议的起跳点，可切换跳动。另有锅沿线和锅底中心辅助线、momZone 占位虚线框（z=70），以及 progress、activePanel、launch y 滑块和各层开关。

## 需要集成会话改：
1. `src/lib/scene.ts`：`panLaunch` 和 `eggRest` 改为 `{ x: 720, y: 670 }`。`panBox` 可改为 `[360, 502, 1109, 661]`，`flameBox` 实测为 `[580, 729, 879, 800]`。
2. kitchen-scene 分支：锅里的 `Egg`（z=40 阶段）、`EggShadow`、`PanOil`、`Bubbles`、`Flame` 外层加 `translate(var(--kl-mid-x, 0px), var(--kl-mid-y, 0px))`。蛋起飞后（z=80）可以逐渐取消，或保持不变。
3. `KitchenScene.tsx`：`base={<KitchenLayers mouse />}`。
4. 本分支名是 `claude/kitchen-layers-3463cc`。我已删除 v1 的 `main.png`、`front.png`、`flame.png`。按 v3 所有权，`flame.png` 归 kitchen-scene 分支。

## 希望用户用 ChatGPT 生成的素材（可选）
叠合静止时看不出补图，轻微视差也只露出几像素。单独看某一层时能看出拼补的地方：
1. **去掉红色平底锅和前方小灶台的同一张厨房**（保留黄锅、瓶罐、水壶、绿色台面，同构图、1536×1024、同画风）。可以替换 `back.png` 里锅后面的台面：现在那块有重复横条纹，左侧灶台的右边缘是镜像出来的。
2. **没有吐司盘、蛋壳、格纹布的同一张桌面**。front-right 淡出后，蛋壳和格纹布下面的木纹会露出来。现在是镜像补的，可以看，但吐司下方略浅。
