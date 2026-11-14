# DESIGN.md — 共享设计规范与接口约定（第四版）

三条并行分支都以这份文件为准。改这份文件只能在集成会话（main）上做。
修订记录：v1 初稿 → v2 浮动漫画 → v3 妈妈前景 + 锅铲接蛋 → **v4（2026-11-13）菜品改为"妈妈的荷包蛋拌饭"，吐司结尾撤销，妈妈新素材到位**。

## 1. 故事节拍（固定）

> 妈妈备菜、炒菜、调汁 → 发现后景跳蛋 → 用前景锅铲接住同一颗蛋 → 放到饭中央 → 淋酱汁、划开流黄。

| 节拍 `activePanel` | 内容 | 画面素材 | 谁负责 |
|---|---|---|---|
| 0 开场 | 全屏活着的厨房，无文字 | 厨房分层 + 角色 | kitchen-scene + kitchen-layers |
| 1 切配菜 | 前景画格：妈妈切胡萝卜和葱花 | `MOM_PANELS.chop` | comic-scroll |
| 2 炒配菜 | 前景画格：妈妈炒配菜 | `MOM_PANELS.stirfry` | comic-scroll |
| 3 调汁 | 前景画格：妈妈调酱汁 | `MOM_PANELS.sauce` | comic-scroll |
| 4 发现跳蛋 | 画格散去，厨房弱化退去，后景锅里一直在跳的蛋重新清晰 | 厨房 | comic-scroll 写 progress |
| 5 伸锅铲 | 前景妈妈伸出空锅铲，从右下滑入厨房画面 | `MOM_SPATULA`（场景层） | comic-scroll 的 `MomForeground` |
| 6 接蛋 | 滚动控制同一颗蛋从后景锅里飞到前景铲面，镜头跟随，落下压扁回弹 | 厨房里的 `<Egg>` | comic-scroll 写 `flight`，主会话的 `<Egg>` 执行 |
| 7 放进饭碗 | 锅铲妈妈交叉淡化为端碗妈妈；蛋从铲面移到饭碗中央，镜头对准饭碗 | `MOM_SERVE`（场景层）+ `<Egg>` | comic-scroll 写 `serve` 并切换图，主会话的 `<Egg>` 执行 |
| 8 结尾近景 | 淋酱汁、划开流黄。**第一版只放一张静态结尾近景图验证镜头切换**，不做流体动画 | 用户正在生成的结尾近景（仅视觉参考，非分层素材）；未到时用标明的占位 | comic-scroll |

- **厨房全程是背景，从不退场。** 读前景画格时只做弱化，蛋、火苗、油泡继续动。
- **吐司已撤销**：厨房前景里的吐司盘标为"待替换"，不作为任何终点；任何代码都不再使用吐司坐标。
- **妈妈图是合并插画，没有关节层。** 不要让整张人物上下晃动来冒充切菜、炒菜、搅汁动作。允许：画格整体的入场/离场、很轻的纸面漂浮（整格一起，±3px 以内）、画格外的小符号或声音。真正的手臂动作等关节层（ASSET-REQUESTS 第四版 7–9）。
- 只用用户提供的素材（ChatGPT 生成）。占位图必须一眼看出是占位并写明内容。旧吐司漫画、旧六格、土豆汤漫画**停用**，连占位也不要再用它们。
- 声音只用素材库录音，按 §7 的段落衔接；文件未提供前静音预览。

## 2. 坐标、缩放与遮挡

- 厨房画布 1536×1024 = "场景像素"。`source/kitchen-clean.png` 与原画 `source/kitchen-main.png` 逐像素对齐，坐标通用。
- 所有厨房元素（包括前景妈妈和锅铲）用场景像素绝对定位，放在 `<SceneStage>` 里，由它做 cover 缩放和镜头平移。锚点在 `src/lib/scene.ts`：`eggRest`、`eggSize`、`panBox`、`flameBox`、`kettleSpout`、`panLaunch`、`spatulaLand`、`eggOnSpatula`、`bowlCenter`、`bowlLand`、`eggInBowl`、`momZone`。妈妈两张场景层图的摆放在 `MOM_SPATULA`、`MOM_SERVE`，锅铲和饭碗的落点由摆放 + 素材实测算出（`tools/prepare_mom.py`），改摆放必须同步锚点。
- **前后顺序统一用 `src/lib/scene.ts` 的 `Z`**：back 10 → mid 20 → fx 30 → steam 35 → 锅里的蛋 40 → 锅沿遮挡 50 → 吐司盘 60 → 蛋壳/格纹布 61 → 前景妈妈 70 → 飞行中的蛋 80。蛋在锅里时被锅沿挡住脚；起飞后在最上层，落在铲面上盖住铲面。
- 前景漫画画格（节拍 1、2、3、8）不用场景像素，按视口自适应，浮在厨房之上（页面层 z-10）。节拍 5–7 的妈妈在场景层（z = `Z.mom`），和厨房一起缩放、被镜头带动，这样同一颗蛋能准确落在铲面和碗中央。

## 3. 共享状态 `useScene()`（`src/lib/scene-context.tsx`）

| 字段 | 谁写 | 谁读 | 含义 |
|---|---|---|---|
| `soundOn` | kitchen-scene | 全部 | 用户是否打开声音 |
| `progress` 0–1 | comic-scroll | KitchenScene | 阅读弱化程度。0 = 厨房完整清晰，1 = 读前景漫画时的弱化 |
| `activePanel` 0–8 | comic-scroll | 全部 | 当前节拍（§1），声音按它切换段落 |
| `flight` null / 0–1 | comic-scroll | kitchen-scene、KitchenScene | null = 蛋在锅里循环跳；0→1 = 从锅里飞到锅铲上；1 = 已在锅铲上（触发接蛋轻响）。镜头随进度平移到锅铲 |
| `serve` null / 0–1 | comic-scroll | kitchen-scene、KitchenScene | null = 还没放进碗；0→1 = 从铲面移到饭碗中央；1 = 已在饭上（触发饭碗落桌）。镜头对准饭碗 |
| `reducedMotion` / `isTouch` | provider | 全部 | 减少动效时循环静止、飞行改淡入淡出；触屏关闭鼠标视差 |

## 4. 组件接口

- `KitchenScene`（集成会话）：props `base?`（layers 交付后传 `<KitchenLayers/>`）、`children`（角色）、`foreground?`（前景妈妈）。负责阅读弱化和镜头。
- `KitchenLayers`（layers 分支）：渲染 back / mid / panRim / frontLeft / frontRight 层（各用对应 `Z`），鼠标视差，随 `progress` 轻微景深漂移；吐司盘层默认隐藏（待替换）；`activePanel >= 5` 时 `momZone` 内的前景物件淡出给妈妈让位。不负责调暗。props：`{ mouse?: boolean }`。
- 角色（kitchen-scene 分支，主会话）：`Egg`（循环跳 → 按 `flight` 从 `panLaunch` 飞到 `spatulaLand` 并缩到 `eggOnSpatula` → 按 `serve` 移到 `bowlLand` 并缩到 `eggInBowl`；z 从 40 切到 80）、`EggShadow`、`Flame`、`PanOil`、`Bubbles`、`Steam`、`SoundToggle`、`ScrollHint`、`useKitchenAudio`。
- 漫画（comic-scroll 分支）：`ComicScroll`（页面层的滚动区和前景画格，写 `progress` / `activePanel` / `flight` / `serve`）+ `MomForeground`（场景层，z = 70：节拍 5–6 按 `MOM_SPATULA` 摆放锅铲妈妈，节拍 7 交叉淡化到 `MOM_SERVE` 端碗妈妈）。**不**渲染蛋本体，也不播放声音。
- 动画统一 GSAP 3（`import gsap from "gsap"`，ScrollTrigger 从 `gsap/ScrollTrigger` 注册）。Canvas 粒子用原生 2D。不加新库。

## 5. 素材

```
source/kitchen-main.png      原始厨房主图（带蛋、火苗、油）——只读
source/kitchen-clean.png     无蛋、无火苗、无油泡、无动作线的厨房底图 ——只读
source/egg.png               透明背景的跳跃荷包蛋 ——只读
source/mom-four-scenes.png   妈妈四组合并插画：左上切菜、右上炒配菜、左下调汁、右下端碗（碗中央留给蛋）——只读
source/mom-spatula.png       妈妈伸出空锅铲 ——只读
source/storyboard-v2.png、comic-page-{1,2}.png  旧素材，停用

public/assets/scene/kitchen-clean.webp, egg.webp           集成会话（tools/prepare_assets.py）
public/assets/mom/{chop,stirfry,sauce,serve,spatula}.webp  集成会话（tools/prepare_mom.py：柔边收紧、去色污染、按组裁切）
public/assets/scene/{back,mid,pan-rim,front-left,front-right}.png   layers 分支（由 kitchen-clean 拆出，1536×1024 透明）
public/assets/scene/{flame,oil}.png                        kitchen-scene 分支（从原图抽出）
public/assets/comic/                                       comic 分支（结尾占位等）
public/assets/audio/                                       用户提供的录音 + LICENSES.md
```

## 6. 文件所有权（避免冲突）

| 分支 | 只能改 | 不能改 |
|---|---|---|
| feat/kitchen-scene（主会话） | `src/components/kitchen/` 下除 `KitchenScene.tsx`、`KitchenLayers.tsx` 外的组件和 hook（含全部声音）、`src/app/dev/scene/`、`public/assets/scene/{flame,oil}.png`、`tools/extract_fx.py` | 其余 |
| kitchen-layers 分支 | `src/components/kitchen/KitchenLayers.tsx`、`tools/split_scene.py`、`public/assets/scene/{back,mid,pan-rim,front-left,front-right}.png`、`src/app/dev/layers/` | 其余 |
| comic-scroll 分支 | `src/components/comic/**`（含 `MomForeground.tsx`）、`tools/split_comic.py`、`public/assets/comic/`、`src/app/dev/comic/` | 其余 |
| 集成会话（main） | `src/app/page.tsx`、`layout.tsx`、`globals.css`、`KitchenScene.tsx`、`SceneStage.tsx`、`src/lib/*`、`package.json`、lockfile、`docs/`、`SPEC.md`、`source/`、`tools/prepare_assets.py`、`tools/prepare_mom.py`、`public/assets/scene/{kitchen-clean,egg}.webp`、`public/assets/mom/` | — |

需要共享文件改动时，在自己分支的 `docs/tasks/<任务>.md` 末尾写"需要集成会话改：…"，不要自己改。
不要 `npm install` 任何新包。每做完一个能看的阶段就 commit 到自己的分支并 push，不合并到 main。
**开工前先 `git fetch origin && git merge origin/main`**，确保拿到这一版规范。

## 7. 声音段落（主会话实现，comic-scroll 只负责在正确的滚动位置切换 `activePanel` / `flight` / `serve`）

背景环境声 `room-loop` 从用户打开声音起一直连续。局部音效随段落交叉淡化（0.6 s）：

| 节拍 | 局部声音 | 文件 | 方式 |
|---|---|---|---|
| 0 开场 | 煎蛋滋滋（底声） | `sizzle-loop.mp3` | 循环 |
| 1 切配菜 | 切菜哒哒 | `chop-loop.mp3` | 循环 |
| 2 炒配菜 | 下锅滋啦 → 翻炒 | `stirfry-in.mp3` → `stirfry-loop.mp3` | 进入时单次 + 循环 |
| 3 调汁 | 搅汁轻响 | `sauce-stir-loop.mp3` | 循环 |
| 4–6 | 煎蛋滋滋回来 | `sizzle-loop.mp3` | 循环 |
| 6 落在锅铲 | 接蛋轻响 | `catch.mp3` | `flight` 到 1 时单次 |
| 7 放进碗 | 饭碗落桌 | `bowl-down.mp3` | `serve` 到 1 时单次 |
| 8 结尾 | 淋汁（以后） | `pour.mp3` | 进入时单次（文件到了再接） |

回滚时不重播单次音效，除非重新越过触发点。
