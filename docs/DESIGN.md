# DESIGN.md — 共享设计规范与接口约定

三条并行分支都以这份文件为准。改这份文件只能在集成会话（main）上做。
最近一次修订：2026-11-13 第二版（新素材 + 新故事结构）。

## 1. 体验结构（The Boat 的可爱版）

视觉参考：`source/storyboard-v2.png`（**只作参考，绝不把它当整张长图滚动展示**）。旧六格 `source/comic-page-*.png` 也只作参考。

| 节拍 | 内容 | 谁负责 |
|---|---|---|
| 0 开场 | 全屏活着的厨房：蛋在锅里循环跳、影子、火苗、油、油泡、蒸汽、（可选）滋滋声。无文字 | kitchen-scene + kitchen-layers |
| 1 浮动漫画 A | 一块不规则水彩边框的"局部漫画"浮在厨房之上：蛋在滋滋油锅里眯眼享受 | comic-scroll |
| 2 浮动漫画 B | 第二块浮动漫画：蛋扒着锅沿，望向黄油吐司（吐司闪一下） | comic-scroll |
| 3 飞行 | 浮动漫画散去，厨房弱化退回很轻；**滚动控制蛋从锅里沿弧线飞向吐司**，滚到底"噗"地落下 | comic-scroll 写 `flight`，kitchen-scene 让 `<Egg>` 按它飞 |
| 4 结尾 | 早餐完成：蛋舒服地躺在吐司上、热饮冒热气、窗光，画面安静下来，页面结束 | comic-scroll |

- **厨房全程是背景，从不退场。** 阅读浮动漫画时只做弱化（调暗、去饱和、轻模糊、纸色薄纱），蛋、火苗、油泡继续动。
- 妈妈和手**暂不出现**。
- 音效只用素材库录音（`public/assets/audio/README.md`）。文件未提供前一律静音预览，声音按钮照常显示。
- 画面风格只来自用户提供的手绘素材。不要用代码画风格不同的图形；粒子（油泡、蒸汽）要小、淡、贴近水彩感。

## 2. 坐标与缩放

- 厨房画布 1536×1024 = "场景像素"。`source/kitchen-clean.png` 与原画 `source/kitchen-main.png` 逐像素对齐（已验证），坐标通用。
- 所有厨房元素用场景像素绝对定位，放在 `<SceneStage>` 里，由它做 cover 缩放。锚点在 `src/lib/scene.ts`：`eggRest`、`eggSize`、`panBox`、`flameBox`、`kettleSpout`、`toastBox`、`toastLand`。
- 浮动漫画不用场景像素，按视口自适应（最大宽约 720px），浮在厨房之上。

## 3. 共享状态 `useScene()`（`src/lib/scene-context.tsx`）

| 字段 | 谁写 | 谁读 | 含义 |
|---|---|---|---|
| `soundOn` | kitchen-scene | 全部 | 用户是否打开声音 |
| `progress` 0–1 | comic-scroll | KitchenScene | 阅读弱化程度。0 = 厨房完整清晰，1 = 读浮动漫画时的弱化 |
| `activePanel` 0–4 | comic-scroll | kitchen-scene | 当前节拍（见 §1 表）。厨房可据此调声音层次 |
| `flight` null / 0–1 | comic-scroll | kitchen-scene | null = 蛋在锅里循环跳；0→1 = 飞向吐司的滚动进度；1 = 已落在吐司上 |
| `reducedMotion` / `isTouch` | provider | 全部 | 减少动效时循环静止、飞行改淡入淡出；触屏关闭鼠标视差 |

## 4. 组件接口

- `KitchenScene`（集成会话）：底图 + 角色 children + 阅读弱化（按 `progress`，`flight` 非 null 时弱化退回很轻）。props：`base?`（layers 交付后传 `<KitchenLayers/>`）。
- `KitchenLayers`（layers 分支，`src/components/kitchen/KitchenLayers.tsx`）：渲染 back/mid/front 三层 + 鼠标视差 + 随 `progress` 的**轻微**景深漂移（最多几 px 到十几 px，前多后少）。**不做整体退场，不负责调暗**（KitchenScene 统一做）。props：`{ mouse?: boolean }`。
- 角色（kitchen-scene 分支，`src/components/kitchen/`）：`Egg`（循环跳 + 按 `flight` 飞向 `toastLand`）、`EggShadow`、`Flame`、`PanOil`、`Bubbles`、`Steam`、`SoundToggle`、`ScrollHint`、`useKitchenAudio`。用 `ANCHORS` 定位。
- 漫画（comic-scroll 分支）：`ComicScroll` 负责节拍 1–4 的滚动区、浮动漫画、结尾画面，以及写 `progress` / `activePanel` / `flight`。它**不**渲染蛋的飞行本体，只写 `flight`。
- 动画统一 GSAP 3（`import gsap from "gsap"`，ScrollTrigger 从 `gsap/ScrollTrigger` 注册）。Canvas 粒子用原生 2D。不加新库。

## 5. 素材

```
source/kitchen-main.png      原始厨房主图（带蛋、火苗、油）——只读
source/kitchen-clean.png     用户生成：无蛋、无火苗、无油泡、无动作线的厨房底图 ——只读
source/egg.png               用户生成：透明背景的跳跃荷包蛋 ——只读
source/storyboard-v2.png     最新体验分镜，仅参考 ——只读
source/comic-page-{1,2}.png  旧六格，仅参考/兜底素材 ——只读

public/assets/scene/kitchen-clean.webp, egg.webp   集成会话由 tools/prepare_assets.py 生成
public/assets/scene/{back,mid,front}.png           layers 分支产出（由 kitchen-clean 拆出，1536×1024 透明）
public/assets/scene/{flame,oil}.png                kitchen-scene 分支产出（从原图抽出，1536×1024 透明）
public/assets/comic/                               comic 分支产出
public/assets/audio/                               用户提供的录音 + LICENSES.md
tools/                                             可重跑脚本
```

## 6. 文件所有权（避免冲突）

| 分支 | 只能改 | 不能改 |
|---|---|---|
| feat/kitchen-scene | `src/components/kitchen/` 下除 `KitchenScene.tsx`、`KitchenLayers.tsx` 外的组件和 hook、`src/app/dev/scene/`、`public/assets/scene/{flame,oil}.png`、`public/assets/scene-draft/`、`tools/extract_fx.py`、`tools/draft_egg.py` | 其余 |
| feat/kitchen-layers | `src/components/kitchen/KitchenLayers.tsx`、`tools/split_scene.py`、`public/assets/scene/{back,mid,front}.png`、`src/app/dev/layers/` | 其余 |
| feat/comic-scroll | `src/components/comic/**`、`tools/split_comic.py`、`public/assets/comic/`、`src/app/dev/comic/` | 其余 |
| 集成会话（main） | `src/app/page.tsx`、`layout.tsx`、`globals.css`、`KitchenScene.tsx`、`SceneStage.tsx`、`src/lib/*`、`package.json`、lockfile、`docs/`、`SPEC.md`、`source/`、`tools/prepare_assets.py`、`public/assets/scene/{kitchen-clean,egg}.webp` | — |

需要共享文件改动时，在自己分支的 `docs/tasks/<branch>.md` 末尾写"需要集成会话改：…"，不要自己改。
不要 `npm install` 任何新包。每做完一个能看的阶段就 commit 到自己的分支并 push，不合并到 main。
开工前先 `git merge origin/main`，确保拿到这一版规范。
