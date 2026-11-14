# DESIGN.md — 共享设计规范与接口约定

三条并行分支都以这份文件为准。改这份文件只能在集成会话（main）上做。

## 1. 体验结构（The Boat 的可爱版）

- 厨房场景是**全程存在的背景**，固定在视口底层（`fixed inset-0 z-0`），从打开到结束一直在动（蛋跳、油泡、火苗、蒸汽、滋滋声）。
- 漫画在前层（`relative z-10`）随滚动推进。进入漫画后厨房变暗变虚一点但不消失，像 The Boat 里海浪一直在格子后面动。
- 第 4 → 第 5 格之间保留一个"破框"大场面：蛋从锅飞向吐司，整屏动画，滚动控制弧线。第一版可以先不做。
- 结尾回到活着的厨房：早餐摆好的桌面，窗光，安静下来。
- 画面风格只来自原画（`source/`），细棕线、水彩、纸纹。不用代码画风格不同的图形。

## 2. 坐标与缩放

- 厨房画布 1536×1024 = "场景像素"。所有厨房元素用场景像素绝对定位，放在 `<SceneStage>` 里，由它做 cover 缩放。常量和锚点在 `src/lib/scene.ts`，拆层后请实测修正锚点并提交。
- 漫画格不用场景像素，按视口宽度自适应（最大宽 960px，居中）。

## 3. 共享状态 `useScene()`（`src/lib/scene-context.tsx`）

| 字段 | 谁写 | 谁读 | 含义 |
|---|---|---|---|
| `soundOn` | kitchen-scene | 全部 | 用户是否打开声音 |
| `progress` 0–1 | comic-scroll | kitchen-* | 0 厨房完整可见，1 完全进入漫画。厨房据此变暗/变虚/视差退场 |
| `activePanel` 0–6 | comic-scroll | kitchen-scene | 当前阅读格；厨房可据此改声音层次 |
| `reducedMotion` / `isTouch` | provider | 全部 | 减少动效时循环动作静止；触屏关闭鼠标视差 |

## 4. 组件接口

- `KitchenScene`（集成会话维护）：组合 `<KitchenLayers/>`（layers 分支）+ 角色 children（scene 分支）。现在是整张原画占位。
- `KitchenLayers`（layers 分支新建 `src/components/kitchen/KitchenLayers.tsx`）：渲染 back/mid/front 三层 + 鼠标视差 + 按 `progress` 做滚动退场。props：`{ mouse?: boolean }`。不包含蛋、影子、火苗。
- 角色组件（scene 分支，`src/components/kitchen/` 下）：`Egg`、`EggShadow`、`Flame`、`Bubbles`、`Steam`、`SoundToggle`、`useKitchenAudio`。各自用 `ANCHORS` 定位，接受 `paused?: boolean`。
- `ComicScroll`（comic 分支）：六格 + 滚动触发 + 局部动作；负责调用 `setProgress`、`setActivePanel`。
- 动画统一用 GSAP 3（已装，`import gsap from "gsap"`；ScrollTrigger 从 `gsap/ScrollTrigger` 注册）。Canvas 粒子用原生 2D。不要再加新的动画库。

## 5. 素材路径

```
source/                      原画（只读）
public/assets/scene/poster.png   整张原画占位（集成会话）
public/assets/scene/{back,mid,front,egg,flame}.png   1536×1024 透明分层（layers 分支产出）
public/assets/scene-draft/   scene 分支的临时抠图，集成时删除
public/assets/comic/p1..p6.png, p{n}-egg.png, p{n}-bg.png   六格（comic 分支产出）
public/assets/audio/         素材库音效 + LICENSES.md（用户提供文件）
tools/                       可重跑的 PIL/cv2 脚本
```

所有分层保持原画布尺寸、原位置、原比例，方便叠回去对比。

## 6. 文件所有权（避免冲突）

| 分支 | 只能改 | 不能改 |
|---|---|---|
| feat/kitchen-scene | `src/components/kitchen/{Egg,EggShadow,Flame,Bubbles,Steam,SoundToggle}.tsx`、`src/components/kitchen/useKitchenAudio.ts`、`src/app/dev/scene/`、`public/assets/scene-draft/`、`public/assets/audio/` | 其余 |
| feat/kitchen-layers | `src/components/kitchen/KitchenLayers.tsx`、`tools/split_scene.py`、`public/assets/scene/`（poster.png 除外）、`src/app/dev/layers/`、`src/lib/scene.ts` 里 ANCHORS 的实测修正 | 其余 |
| feat/comic-scroll | `src/components/comic/**`、`tools/split_comic.py`、`public/assets/comic/`、`src/app/dev/comic/` | 其余 |
| 集成会话（main） | `src/app/page.tsx`、`layout.tsx`、`globals.css`、`KitchenScene.tsx`、`scene-context.tsx`、`SceneStage.tsx`、`package.json`、lockfile、`docs/`、`SPEC.md` | — |

需要共享文件改动时，在自己分支的 `docs/tasks/<branch>.md` 末尾写"需要集成会话改：…"，不要自己改。
不要 `npm install` 任何新包。每做完一个能看的阶段就 commit 到自己的分支并 push，不合并到 main。
