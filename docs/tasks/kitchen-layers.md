# 任务：kitchen-layers — 厨房环境、视差、锅沿遮挡，清除吐司终点（第四版）

开工前：`git fetch origin && git merge origin/main`（冲突时以 main 的 `src/lib/*`、`docs/*` 为准）。先读 `docs/DESIGN.md` 第四版（§1、§2 Z 顺序、§4）、`src/lib/scene.ts`。只改 DESIGN §6 分给本分支的文件。

**变化**：菜品改为"妈妈的荷包蛋拌饭"，吐司结尾撤销。你已经完成的分层（back / mid / main / pan-rim / front / flame）可以保留，按下面调整：

1. **火苗不归本分支**：`flame.png` 由主会话从原画抽取（已在 feat/kitchen-scene），请不要再产出或修改 `public/assets/scene/flame.png`，从你的分支里去掉它。
2. **不要改 `src/lib/scene.ts`**：你实测的锚点（eggRest 742,666、panInner、panRimBox、flameBox、kettleSpout）很有用，请把它们写到本文件末尾"需要集成会话改"，由主会话合并。把你分支里对 `src/lib/scene.ts` 的修改撤回。
3. **吐司盘**：拆成单独一层 `front-toast.png`，`KitchenLayers` 默认**不渲染**它（吐司已不在故事里）。它身后的木纹在 main/mid 层补好，这样去掉吐司后桌面完整。若补不好，在本文件末尾标"待替换"，用户会生成替换图（ASSET-REQUESTS 第四版 K1）。
4. **为前景妈妈让位**：`ANCHORS.momZone` = [420, 324, 1536, 1024]，节拍 5 起妈妈伸锅铲占据这一块。把落在这块里的前景物件（蛋壳、格纹布）放在 `front-right.png`，`activePanel >= 5` 时 0.5s 淡出，回到 < 5 时淡回。
5. **锅沿遮挡**：保留 `pan-rim.png`，z = `Z.panRim`，与锅身同一视差值；请确认它挡住锅里蛋的脚但不挡起跳后的蛋（起跳后蛋 z = 80）。
6. 视差与漂移照旧：front ±10、mid/pan-rim ±5、back ±2 px；`progress` 只带来轻微景深漂移，不退场、不调暗。

> **第五版补充**：`useScene().progress`、`activePanel` 现在由统一节拍表推导（`src/lib/beats.json`、`docs/BEATS.md`），含义不变，你照常读取即可。不要注册自己的滚动监听或 ScrollTrigger。

## 产出

- `tools/split_scene.py` 更新；`public/assets/scene/{back,mid 或 main,pan-rim,front-toast,front-right}.png`；叠合差图。
- `src/components/kitchen/KitchenLayers.tsx`（层名按你的实际文件，z 用 `Z`）。
- `src/app/dev/layers/page.tsx`：预览，滑块驱动 progress 和 activePanel，画出 momZone 虚线框。

## 验收

- 去掉吐司后的桌面看不出补痕；叠合（含吐司层）与 kitchen-clean 一致。
- `activePanel` 拖到 5 时蛋壳、格纹布淡出，momZone 内干净。
- 锅沿挡住 `eggRest` 处蛋的脚，视差时锅沿和锅身不脱节。
- `npm run lint`、`npm run build` 通过；commit 并 push 本分支，不合并 main。报告贴分层缩略图、差图、预览截图（activePanel 0 和 5）。

---

## 交付（第四版，2026-11-13，分支 claude/kitchen-layers-3463cc）

### 图层（`public/assets/scene/`，1536×1024 透明，原位，由 `python3 tools/split_scene.py` 从 `source/kitchen-clean.png` 生成）

| 文件 | Z | 内容 | KitchenLayers |
|---|---|---|---|
| `back.png` | `Z.back` 10 | 墙、瓷砖、后台面、左侧灶、黄锅、瓶罐、水壶（不透明，锅和灶台后的瓷砖与台面已补） | 渲染，视差 ±2 |
| `mid.png` | `Z.mid` 20 | 木桌、绿色灶台、红锅锅身、锅柄、锅底 | 渲染，视差 ±5 |
| `pan-rim.png` | `Z.panRim` 50 | 红锅前唇 + 前半红色外壁 | 渲染，与 mid **同一视差值** |
| `front-toast.png` | `Z.frontLeft` 60 | 吐司盘和吐司 | **默认不渲染**（`showToast` 仅供叠合检查） |
| `front-right.png` | `Z.frontRight` 61 | 蛋壳、格纹布，以及它们投在桌上的影子 | 渲染，视差 ±10；`activePanel >= 5` 时 0.5 秒淡出，回到 < 5 时淡回 |

- 叠合检查 `tools/check_overlay.png`（含吐司层）：与 kitchen-clean 平均差 0.37/255，99% 像素差值 ≤ 8，残差只在 1–2px 的羽化轮廓上。缩略图在 `tools/layers_preview.png`。
- **去掉吐司后的桌面**：吐司盘挡住的不只是木纹，还有灶台的左下角、左脚和灶台下的投影，都已在 `mid.png` 补好。方法是镜像灶台右侧边缘、按行续接灶台正面、镜像左脚可见的一半、续接投影；木纹用相邻可见木纹镜像续接，再逐行匹配颜色。100% 显示看不出明显补痕，所以**不标"待替换"**。仔细看时，灶台左下正面有一条很淡的竖向色差。
- 蛋壳和格纹布在桌上的接触影子放进了 `front-right.png`。妈妈出场时影子和物件一起淡出，桌面上不会留下没有来源的影子。momZone 内淡出后只剩木桌、灶台和后台面。
- 不再产出 `flame.png`、`main.png`、`front.png`、`front-left.png`。
- 视差：front ±10、mid 和 pan-rim ±5、back ±2，触屏和减少动效时关闭。`progress` 只带来向上的轻微漂移（2 / 6 / 14 px），不退场、不调暗。
- 锅里的角色跟锅同步：KitchenLayers 每帧在 stage 元素上写 `--kl-mid-x`、`--kl-mid-y`（另有 `--kl-mid-s`）。main 上的 Egg、EggShadow、Flame、PanOil、Bubbles 已经在用。
- pan-rim 只挡 z < 50 的东西：锅里的蛋（z 40）的脚被挡住；起飞后蛋 z = 80，不受影响。预览页的 "egg z=80" 开关可以验证。
- 预览 `/dev/layers`：`<KitchenScene base={<KitchenLayers mouse />}>`。有测试蛋（egg.webp）、锅沿线和锅底中心、momZone 占位框，以及 progress（0–1）、activePanel（0–8）、launch y 滑块，还有吐司开关和各层开关。

## 需要集成会话改：
实测锚点（场景像素），请合并进 `src/lib/scene.ts`：

| 键 | 现值 | 建议 | 说明 |
|---|---|---|---|
| `panLaunch` | (720, 618) | **(720, 670)** | x=720 处锅沿遮挡线在 y=657。618 时蛋整只在锅沿线以上，脚不会被挡住。670 时左脚约 13px 藏到锅沿后，右脚碰到锅沿。若想用锅底中心的 x，可用 (742, 666)（v1 实测，同样能挡住脚） |
| `eggRest` | (720, 618) | **(720, 670)** | 同上：蛋在锅里循环跳的落点也要在锅沿线以下，才有"在锅里"的遮挡 |
| `panBox` | [370, 505, 1105, 648] | [360, 502, 1109, 661] | 锅底深色区实测外接框 |
| `flameBox` | [600, 735, 830, 790] | [580, 729, 879, 800] | 从原画火苗差异实测 |
| `kettleSpout` | (1200, 330) | (1192, 312) | 壶嘴口 |
| 新增 `panInner` | — | `{ cx: 743, cy: 579, rx: 398, ry: 77 }` | 锅底椭圆。下半弧就是锅沿遮挡线：y = cy + ry·√(1−((x−cx)/rx)²)，x=450→633、600→653、720→657、900→651、1050→630 |
| 新增 `panRimBox` | — | [358, 601, 1119, 747] | pan-rim 层包围盒 |
| `toastBox` | [0, 805, 440, 1024] | [0, 806, 452, 1023] | 实测（吐司已撤销，仅供参考） |

其他：
- `docs/DESIGN.md` §4/§5/§6 的层名请改为 back / mid / pan-rim / front-toast / front-right（现在写的是 front-left）。`KitchenLayers` 多一个可选 prop `showToast`，默认 false。
- `KitchenScene.tsx`：`base={<KitchenLayers mouse />}`。

## 生成需求（可选，不阻塞）
- K1 去掉吐司的桌面：已手工补好，可以不生成。若用户想要完美版，可以生成"同一张厨房，去掉左下角吐司盘"，替换 `mid.png` 左下区域。
- 去掉红色平底锅和前方灶台的同一张厨房：只有需要大幅镜头运动、露出锅后台面时才需要。现在 `back.png` 里锅后台面有重复横纹，静止和轻微视差时都看不到。
