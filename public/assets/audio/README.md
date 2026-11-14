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

## 文件 ↔ 场景编号 ↔ 方式 ↔ 状态（2026-11-14，对应 18 段新故事）

场景 → 声音的对应表在 `src/components/kitchen/audio-map.json`（按场景编号覆盖节拍数据的 audio 字段，表里没有的场景沿用节拍数据原值；场景编号与 `src/app/preview/visual/beats.visual.json` 一致）。
音量是相对电平（0–1），素材本身已按 `tools/audio_build.sh` 处理（原档在 `tools/audio_raw/`，测量用 `tools/audio_measure.sh`；`tools/audio_render_demo.mjs` 可把整个故事离线混成一条音频 + mp4 供试听）。
**空位 = 还没有音源，接口里已登记、保持静音；不要用不相关的声音填补。**

| 声音 id | 文件 | 方式 | 场景编号（音量 / 触发点） | 状态 |
|---|---|---|---|---|
| room | room-loop.mp3（40 s 循环） | 循环，全程 | opening/chop/stirfry/sauce/handoff/bowl/yolk/call/return/recognize/punchline 0.2；bag/idea/missing 0.25；hear/catch 0.18；eggcall 0.08；search 0.06 | 已接入 |
| sizzle | sizzle-loop.mp3（20 s 循环） | 循环，主要动作声 | opening 0.45；bag 0.12；idea 0.1；chop 0.06；**stirfry 0.45（承担翻炒底声，待试听）**；sauce 0.08；missing 0.2；hear 动作阶段 0.2→0.6；catch 动作阶段 0.35→0.06；handoff 进入阶段 0.06→0 | 已接入 |
| chop | chop-loop.mp3（6.5 s 循环） | 循环，主要动作声 | chop 0.5 | 已接入 |
| stirfryIn | stirfry-in.mp3（1.8 s） | 单次 | stirfry @ p=0.22（下锅"滋啦"） | 已接入 |
| stirfry | stirfry-loop.mp3 | 循环 | 暂不使用：炒菜段由 sizzle 承担底声 | **空位**（不强加） |
| sauce | sauce-stir-loop.mp3（17.7 s 循环） | 循环，主要动作声 | sauce 0.4（调汁、盛饭） | 已接入 |
| pop | pop.mp3 | 单次 | hear @ p=0.35（"啵！"） | **空位** |
| catch | catch.mp3（0.6 s） | 单次 | catch @ p=0.78（蛋落到空锅铲） | 已接入 |
| bowlDown | bowl-down.mp3（1.1 s） | 单次 | bowl @ p=0.25（碗落桌） | 已接入 |
| pour | pour.mp3 | 单次 | bowl @ p=0.55（淋汁） | **空位** |
| momCall | mom-call.mp3 | 单次 | call @ p=0.25（"宝宝，来吃饭啦！"） | **空位** |
| eggSmall | egg-small.mp3 | 单次 | call @ p=0.55（"我在这儿……"） | **空位** |
| steps | footsteps-loop.mp3 | 循环，主要动作声 | search 0.5；return 进入阶段 0.4→0 | **空位** |
| eggCall | egg-call.mp3 | 单次 | eggcall @ p=0.25（"妈！这里！"） | **空位** |

旧版 9 段节拍表（`/`、`/dev/beats`）里与新故事同名的场景（opening/chop/stirfry/sauce/catch）也会套用上表的值；其余旧场景 notice/spatula/serve/ending 沿用 beats.json 原值。
