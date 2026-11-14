# DESIGN.md — 共享设计规范与接口约定（第三版）

三条并行分支都以这份文件为准。改这份文件只能在集成会话（main）上做。
修订记录：v1 初稿 → v2 新素材 + 浮动漫画 → **v3（2026-11-13）妈妈成为前景主角，蛋飞到妈妈的锅铲上**。v2 的"两个纯荷包蛋浮动漫画、直接飞向吐司"作废。

## 1. 故事节拍（The Boat 的可爱版，空间分两层：后景厨房 + 前景妈妈）

| 节拍 `activePanel` | 内容 | 谁负责 |
|---|---|---|
| 0 开场 | 全屏活着的厨房：蛋在锅里循环跳、影子、火苗、油、油泡、蒸汽、（可选）滋滋声。无文字 | kitchen-scene + kitchen-layers |
| 1 介绍食材 | 前景漫画：妈妈介绍鸡蛋、黄油、吐司 | comic-scroll |
| 2 开始煎蛋 | 前景漫画：妈妈开始煎蛋 | comic-scroll |
| 3 发现蛋在跳 | 厨房弱化退去，后景锅里的蛋一直在跳被"发现"（镜头可以轻微对准锅） | comic-scroll（写 progress），厨房照常跳 |
| 4 伸出锅铲 | 前景妈妈的手臂和锅铲从右下伸入厨房画面，铲面停在 `ANCHORS.spatulaLand` | comic-scroll 的 `MomForeground`（经 KitchenScene `foreground` 插槽） |
| 5 飞行 | 滚动控制**同一颗蛋**从后景锅里（`panLaunch`）沿弧线飞到前景锅铲上（`spatulaLand`），镜头跟随，到 1 时落在铲面压扁回弹 | comic-scroll 写 `flight`，kitchen-scene 的 `<Egg>` 按它飞 |
| 6 端出早餐 | 前景漫画：妈妈把蛋放到吐司上，端出早餐，画面安静下来，页面结束 | comic-scroll |

- **厨房全程是背景，从不退场。** 读前景漫画时只做弱化（调暗、去饱和、轻模糊、纸色薄纱），蛋、火苗、油泡继续动。
- **妈妈是前景主角。** 她的素材**尚未生成**：一律用明确标记的占位图（虚线框 + "占位：…"标签），不要拿旧六格或旧蛋图假装有妈妈或接蛋动作。
- 视觉参考：`source/storyboard-v2.png`（只参考画风和厨房，不参考情节；**绝不当整张长图展示**）。旧六格 `source/comic-page-*.png` 只作画风参考。
- 音效只用素材库录音（`public/assets/audio/README.md`），文件未提供前静音预览，声音按钮照常显示。
- 画面风格只来自用户提供的手绘素材。不要用代码画风格不同的图形；占位图除外（必须一眼看出是占位）。

## 2. 坐标、缩放与遮挡

- 厨房画布 1536×1024 = "场景像素"。`source/kitchen-clean.png` 与原画 `source/kitchen-main.png` 逐像素对齐，坐标通用。
- 所有厨房元素（包括前景妈妈和锅铲）用场景像素绝对定位，放在 `<SceneStage>` 里，由它做 cover 缩放和镜头平移。锚点在 `src/lib/scene.ts`：`eggRest`、`eggSize`、`panBox`、`flameBox`、`kettleSpout`、`toastBox`、`panLaunch`、`spatulaLand`（占位）、`momZone`（占位）。
- **前后顺序统一用 `src/lib/scene.ts` 的 `Z`**：back 10 → mid 20 → fx 30 → steam 35 → 锅里的蛋 40 → 锅沿遮挡 50 → 吐司盘 60 → 蛋壳/格纹布 61 → 前景妈妈 70 → 飞行中的蛋 80。蛋在锅里时被锅沿挡住脚；起飞后在最上层，落在铲面上盖住铲面。
- 前景漫画画格（节拍 1、2、6）不用场景像素，按视口自适应，浮在厨房之上（页面层 z-10）。

## 3. 共享状态 `useScene()`（`src/lib/scene-context.tsx`）

| 字段 | 谁写 | 谁读 | 含义 |
|---|---|---|---|
| `soundOn` | kitchen-scene | 全部 | 用户是否打开声音 |
| `progress` 0–1 | comic-scroll | KitchenScene | 阅读弱化程度。0 = 厨房完整清晰，1 = 读前景漫画时的弱化 |
| `activePanel` 0–6 | comic-scroll | 全部 | 当前节拍（§1） |
| `flight` null / 0–1 | comic-scroll | kitchen-scene、KitchenScene | null = 蛋在锅里循环跳；0→1 = 从锅里飞到锅铲上；1 = 已在锅铲上。非 null 时弱化退回很轻，镜头随进度平移到锅铲 |
| `reducedMotion` / `isTouch` | provider | 全部 | 减少动效时循环静止、飞行改淡入淡出；触屏关闭鼠标视差 |

## 4. 组件接口

- `KitchenScene`（集成会话）：props `base?`（layers 交付后传 `<KitchenLayers/>`）、`children`（角色）、`foreground?`（前景妈妈）。负责阅读弱化和镜头。
- `KitchenLayers`（layers 分支）：渲染 back / mid / panRim / frontLeft / frontRight 五层（各用对应 `Z`），鼠标视差，随 `progress` 轻微景深漂移；`activePanel >= 4` 时 frontRight（蛋壳、格纹布）淡出给妈妈让位。不负责调暗。props：`{ mouse?: boolean }`。
- 角色（kitchen-scene 分支）：`Egg`（循环跳 + 按 `flight` 从 `panLaunch` 飞到 `spatulaLand`，z 从 40 切到 80）、`EggShadow`、`Flame`、`PanOil`、`Bubbles`、`Steam`、`SoundToggle`、`ScrollHint`、`useKitchenAudio`。
- 漫画（comic-scroll 分支）：`ComicScroll`（页面层的滚动区和前景画格，写 `progress` / `activePanel` / `flight`）+ `MomForeground`（场景层，z = 70，从 `momZone` 伸入，铲面对准 `spatulaLand`）。**不**渲染蛋的飞行本体。
- 动画统一 GSAP 3（`import gsap from "gsap"`，ScrollTrigger 从 `gsap/ScrollTrigger` 注册）。Canvas 粒子用原生 2D。不加新库。

## 5. 素材

```
source/kitchen-main.png      原始厨房主图（带蛋、火苗、油）——只读
source/kitchen-clean.png     无蛋、无火苗、无油泡、无动作线的厨房底图 ——只读
source/egg.png               透明背景的跳跃荷包蛋 ——只读
source/storyboard-v2.png     画风参考，不参考情节 ——只读
source/comic-page-{1,2}.png  旧六格，仅画风参考 ——只读
source/mom-*.png             妈妈素材，尚未生成（清单见 docs/ASSET-REQUESTS.md 第三版）

public/assets/scene/kitchen-clean.webp, egg.webp           集成会话（tools/prepare_assets.py）
public/assets/scene/{back,mid,pan-rim,front-left,front-right}.png   layers 分支（由 kitchen-clean 拆出，1536×1024 透明）
public/assets/scene/{flame,oil}.png                        kitchen-scene 分支（从原图抽出）
public/assets/comic/                                       comic 分支（占位图 + 以后的妈妈素材）
public/assets/audio/                                       用户提供的录音 + LICENSES.md
```

## 6. 文件所有权（避免冲突）

| 分支 | 只能改 | 不能改 |
|---|---|---|
| feat/kitchen-scene | `src/components/kitchen/` 下除 `KitchenScene.tsx`、`KitchenLayers.tsx` 外的组件和 hook、`src/app/dev/scene/`、`public/assets/scene/{flame,oil}.png`、`tools/extract_fx.py` | 其余 |
| kitchen-layers 分支 | `src/components/kitchen/KitchenLayers.tsx`、`tools/split_scene.py`、`public/assets/scene/{back,mid,pan-rim,front-left,front-right}.png`、`src/app/dev/layers/` | 其余 |
| comic-scroll 分支 | `src/components/comic/**`（含 `MomForeground.tsx`）、`tools/split_comic.py`、`public/assets/comic/`、`src/app/dev/comic/` | 其余 |
| 集成会话（main） | `src/app/page.tsx`、`layout.tsx`、`globals.css`、`KitchenScene.tsx`、`SceneStage.tsx`、`src/lib/*`、`package.json`、lockfile、`docs/`、`SPEC.md`、`source/`、`tools/prepare_assets.py`、`public/assets/scene/{kitchen-clean,egg}.webp` | — |

需要共享文件改动时，在自己分支的 `docs/tasks/<任务>.md` 末尾写"需要集成会话改：…"，不要自己改。
不要 `npm install` 任何新包。每做完一个能看的阶段就 commit 到自己的分支并 push，不合并到 main。
**开工前先 `git fetch origin && git merge origin/main`**，确保拿到这一版规范。
