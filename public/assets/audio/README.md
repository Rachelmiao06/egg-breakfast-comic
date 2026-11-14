# 音效文件约定

来自素材库的现成录音（Pixabay / Mixkit / Freesound CC0 优先），不在代码里合成。
每加一个文件，在 LICENSES.md 记一行：文件名、来源链接、作者、许可。段落衔接见 docs/DESIGN.md §7。

| 文件名 | 用途 | 方式 | 要求 |
|---|---|---|---|
| room-loop.mp3 | 厨房环境底声，全程连续 | 循环 | 很轻，无明显事件 |
| sizzle-loop.mp3 | 煎蛋滋滋（开场、发现跳蛋、接蛋前） | 循环 | 8–20 s，首尾无缝 |
| chop-loop.mp3 | 切菜哒哒 | 循环 | 节奏轻快、不刺耳 |
| stirfry-in.mp3 | 配菜下锅"滋啦" | 单次 | < 2 s |
| stirfry-loop.mp3 | 翻炒 | 循环 | |
| sauce-stir-loop.mp3 | 搅汁轻响（勺碰碗） | 循环 | 很轻 |
| catch.mp3 | 蛋落到锅铲上的轻响 | 单次 | 柔软，< 1 s |
| bowl-down.mp3 | 饭碗落桌 | 单次 | < 1 s |
| pour.mp3（以后） | 淋酱汁 | 单次 | |

统一 mp3。响度大致统一到 -18 LUFS，代码里只做淡入淡出。

## 文件 ↔ 场景编号 ↔ 方式 ↔ 状态（2026-11-14）

场景 → 声音的对应表在 `src/components/kitchen/audio-map.json`（按场景编号覆盖节拍数据的 audio 字段，表里没有的场景沿用节拍数据原值）。
音量是相对电平（0–1），素材本身已按 `tools/audio_build.sh` 处理（原档在 `tools/audio_raw/`，测量用 `tools/audio_measure.sh`）。
**空位 = 还没有音源，接口里已登记、保持静音；不要用不相关的声音填补。**

| 声音 id | 文件 | 方式 | 场景编号（音量 / 触发点） | 状态 |
|---|---|---|---|---|
| room | room-loop.mp3（40 s 循环） | 循环，全程 | opening/bag/idea/chop/stirfry/sauce/missing/hear/catch/handoff/bowl/return/recognize/punchline 0.25；yolk/call 0.2；eggcall 0.15；search 0.1 | 已接入 |
| sizzle | sizzle-loop.mp3（20 s 循环） | 循环，主要动作声 | opening 0.55；bag/idea 0.35；chop/stirfry/sauce 0.15；missing 0.3；hear 0.55；catch 0.5→0.2（动作阶段渐变）；handoff 0.1；bowl 进入阶段 0.1→0 | 已接入 |
| chop | chop-loop.mp3（6.5 s 循环） | 循环，主要动作声 | chop 0.5 | 已接入 |
| stirfryIn | stirfry-in.mp3（1.8 s） | 单次 | stirfry @ p=0.2 | 已接入 |
| stirfry | stirfry-loop.mp3 | 循环，主要动作声 | stirfry 0.5 | **空位**（翻炒循环无音源） |
| sauce | sauce-stir-loop.mp3（17.7 s 循环） | 循环，主要动作声（调汁、拌饭复用） | sauce 0.45 | 已接入 |
| pop | pop.mp3 | 单次 | hear @ p=0.6（"啵！"） | **空位** |
| catch | catch.mp3（0.6 s） | 单次 | catch @ p=0.85（蛋落到锅铲） | 已接入 |
| bowlDown | bowl-down.mp3（1.1 s） | 单次 | bowl @ p=0.5（碗落桌） | 已接入 |
| pour | pour.mp3 | 单次 | bowl @ p=0.8（淋汁） | **空位** |
| momCall | mom-call.mp3 | 单次 | call @ p=0.3（"宝宝，来吃饭啦！"） | **空位** |
| eggSmall | egg-small.mp3 | 单次 | call @ p=0.75（"我在这儿……"） | **空位** |
| steps | footsteps-loop.mp3 | 循环，主要动作声 | search 0.4（脚步） | **空位** |
| eggCall | egg-call.mp3 | 单次 | eggcall @ p=0.3（"妈！这里！"） | **空位** |

旧场景编号 notice / spatula / serve / ending 不在对应表里，沿用 beats.json 里的原值（它们在新故事中会被替换）。
