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

---

## 交付说明（2026-11-13，按用户新要求调整）

用户中途改了方向，以下以用户最新要求为准，覆盖上面"产出"里的部分条目：
- 底图改用干净版 `Clean watercolor kitchen with red skillet.png`（与原画逐像素对齐），**分层里不含蛋**，蛋由主对话统一控制。
- 不再做"整体上移退场"。厨房随 progress 缓慢横移、轻推近、弱化，始终留在画面里。
- 新增 `pan-rim` 锅沿遮挡层：蛋在锅里时脚被锅沿挡住，跳出后再换到前层。

### 图层（全部 1536×1024 RGBA，同一画布、同一坐标，场景像素）

| 文件 | 内容 | 深度系数 / 鼠标幅度 |
|---|---|---|
| `back.png` | 墙面 + 瓷砖（不透明，物件身后瓷砖按砖缝逐格重建） | 0.25 / ±2 |
| `mid.png` | 黄色花纹锅、瓶罐、水壶、绿色后台面与左侧灶 | 0.5 / ±5 |
| `main.png` | 红色平底锅、前方灶台、木桌面 | 0.75 / ±7 |
| `pan-rim.png` | 锅的前沿 + 红色锅身前半（蛋的遮挡层） | 随 main |
| `front.png` | 吐司盘、蛋壳、格纹布 | 1.0 / ±10 |
| `flame.png` | 从原画提取的火苗（给 scene 分支的 Flame 用） | 随 main |

叠合顺序：back → mid → main → [inPan 插槽：火苗、油泡、影子、锅里的蛋] → pan-rim → front → [aboveFront 插槽]。
`tools/check_overlay.png` 是叠回去与干净底图的对比和差图（差异只在 1–2px 的羽化轮廓上）。`tools/layers_preview.png` 是各层缩略图。`python3 tools/split_scene.py` 可重跑。

### `<KitchenLayers>` 接口

```tsx
<KitchenLayers
  mouse                 // 鼠标视差，触屏自动关闭
  drift={60}            // progress=1 时镜头横移量（场景像素，正值向右看）
  push={0.05}           // progress=1 时最近层的推近量
  dim={1}               // 0–1 弱化强度：1 = 亮度 0.7、饱和 0.8、模糊 2px
  wash={0}              // 0–1 纸色薄雾，给前景漫画更多可读性
  sway                  // 极慢的待机呼吸（reduced-motion 时关闭）
  inPan={<>…</>}        // 画在锅和锅沿之间：蛋在锅里、火苗、油泡、影子
  aboveFront={<>…</>}   // 与 main 同一套位移，画在 front 之上：蛋跳出锅后
/>
```
- 蛋起跳前放在 `inPan`，脚底中心用 `ANCHORS.eggRest`。蛋底部离开锅沿线后，移到 `aboveFront`。两个插槽的位移完全相同，切换不会跳。
- `inPan` 在弱化滤镜里面，`aboveFront` 不受弱化影响。
- 每层都按位移自动放大到刚好不露出画布边缘。

### 锚点（`src/lib/scene.ts`，只改值并新增两个键）
- `eggRest` = (742, 666)：锅内起跳点。比锅沿线低约 8px，蛋脚会被 pan-rim 挡住。
- `panInner` = 中心 (743, 579)，半轴 398 × 78。锅沿遮挡线就是它的下半弧，x=743 处约 y=657，x=450 处约 y=633。
- `panRimBox` = [358, 601, 1119, 747]，`panBox` = [360, 502, 1109, 661]，`flameBox` = [580, 729, 879, 800]，`kettleSpout` = (1192, 312)，`toastBox` = [0, 808, 450, 1024]。

## 需要集成会话改：
1. `KitchenScene.tsx`：把 poster 换成 `<KitchenLayers mouse inPan={<><Flame/><Bubbles/><EggShadow/><Egg/></>} aboveFront={…} />`。蛋跳出锅沿后从 inPan 移到 aboveFront。
2. `docs/DESIGN.md` §4/§5：分层改为 back / mid / main / pan-rim / front / flame；layers 分支不再产出 `egg.png`；记下新 props 和两个插槽；`ANCHORS` 新增 `panInner`、`panRimBox`。
3. 把桌面上的两张源图放进 `source/`：`source/kitchen-clean.png`（干净厨房）和 `source/egg-jump.png`（独立蛋）。脚本会先找 `source/`，找不到才读桌面。
4. 本任务上面写的"front 1.6× / mid 1.0× / back 0.4× 上移退场"已按用户要求作废，由 `drift` / `push` / `dim` / `wash` 代替，数值都可调。
5. 本分支实际名是 `claude/kitchen-layers-3463cc`（不是 feat/kitchen-layers）。

## 希望用户用 ChatGPT 生成的素材
手工补图在叠合和轻微移动时都看不出来，但单独看某些层时仍能看出是拼补的。如需更大幅度的镜头运动，建议生成：
1. **（最需要）去掉红色平底锅和前方小灶台的同一张厨房**，保留黄锅、瓶罐、水壶、绿色台面，同样构图、尺寸 1536×1024、同样画风。用来替换 `mid.png` 锅后面的台面。现在那块是按行拼出来的，有重复的横条纹，左侧灶台的右边缘是镜像出来的。
2. **前景锅铲**（新情节"后景蛋跳到前景锅铲"需要）：同画风的木柄锅铲，透明背景，朝向镜头，约占画面 1/3 高。原画里没有锅铲，无法从原图拆出。
3. （可选）**没有吐司盘、蛋壳、格纹布的同一张桌面**：现在木纹是镜像补的，吐司下方略浅。
4. （可选）**锅内薄油层**，透明背景，与锅内椭圆同位置：干净底图的锅里没有油，原画的油和油星不能直接叠到新锅上。
