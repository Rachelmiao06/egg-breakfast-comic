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
| room | room-loop.mp3（40 s 循环） | 循环，全程 | opening/chop/stirfry/sauce/handoff/bowl/yolk/return 0.2；bag/idea/missing 0.25；hear/catch 0.18；eggcall 0.08；search 0.06；对白留空间：call / recognize 停留阶段 0.2→0.14，punchline 0.2→0.12 | 已接入 |
| sizzle | sizzle-loop.mp3（20 s 循环） | 循环，主要动作声 | opening 0.45；bag 0.12；idea 0.1→停留阶段 0.05；chop 0.06；**stirfry 0.45（承担翻炒底声，待试听）**；sauce 0.08；missing 0.2→停留阶段 0.04（意外前的安静）；hear 进入阶段自动 0.04→0.6、停留阶段 0.6→0.3；catch 动作阶段 0.3→0.38 + 低通随 flight 从 1.5 kHz 开到 16 kHz（由远到近）；handoff 进入阶段 0.38→0 | 已接入 |
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

## 客观测量（2026-11-14，全部**未经人耳试听**）

我没有音频输出通路，下面只有仪器读数和 DOM 状态；接缝是否可闻、响度是否合适、切换是否自然，只能由人耳在 `/preview/visual` 或 `tools/audio_render_demo.mjs` 的渲染稿上判断。

### 成品文件（`tools/audio_measure.sh`，先解码成 WAV 再测）

| 文件 | 时长 | 整体响度 | 真峰值 | 首尾 60 ms RMS 差 | 处理 |
|---|---|---|---|---|---|
| room-loop.mp3 | 40.000 s | -18.4 LUFS | -4.6 dBTP | 0.8 dB | 取前 40.5 s，旋转 1 s + 0.5 s 等功率交叉淡化，+27.2 dB |
| sizzle-loop.mp3 | 20.000 s | -20.2 LUFS | -0.6 dBTP | 5.2 dB | 取前 20.5 s，旋转 1 s + 0.5 s 交叉淡化，+4.4 dB 并限幅 |
| chop-loop.mp3 | 6.530 s | -26.3 LUFS | -2.1 dBTP | 5.1 dB（两端都在静音段） | 末尾补 0.29 s 使刀声间隔均匀，旋转 0.5 s + 0.1 s 交叉淡化，+2.5 dB |
| sauce-stir-loop.mp3 | 17.700 s | -30.3 LUFS | -1.6 dBTP | 4.7 dB | 取 [0.80, 18.70]，旋转 0.6 s + 0.2 s 交叉淡化，+2.0 dB（受峰值限制） |
| stirfry-in.mp3 | 1.800 s | -18.3 LUFS | -4.6 dBTP | — | 取 [0.86, 2.66] 一声，尾部 0.7 s 淡出，+1.7 dB |
| catch.mp3 | 0.600 s | -19.3 LUFS | -2.2 dBTP | — | 取第一声 plop [0.47, 1.07]，尾部 0.15 s 淡出，+6.9 dB |
| bowl-down.mp3 | 1.100 s | -18.2 LUFS | -0.6 dBTP | — | 未动（原 WAV→mp3） |

敲击类（chop、sauce、catch）故意没有拉到 -18 LUFS：限幅器只允许 3 dB，以保留瞬态；它们的音量差靴由对应表里的电平补偿，是否够响以听感为准。

### 循环接缝（`tools/audio_seam_check.mjs`，把"文件末尾→开头"当作接缝）

| 文件 | 接缝两侧相邻采样跳变 | 接缝前后 10 ms RMS 差 | 接缝前后 60 ms RMS 差 | 文件内相邻 10 ms 窗口最大跳变（参照） |
|---|---|---|---|---|
| sizzle-loop | -35.1 dBFS | 12.5 dB | 5.2 dB | 15.4 dB |
| room-loop | -21.0 dBFS | 1.1 dB | 0.1 dB | 8.6 dB |
| chop-loop | -63.0 dBFS | 2.2 dB | 5.1 dB | 123.9 dB（刀声 vs 静音） |
| sauce-stir-loop | -56.7 dBFS | 6.6 dB | 4.6 dB | 41.9 dB |

读法：接缝处的电平变化都小于同一文件内部正常的起伏（sizzle 的油爆、chop 的刀声），接缝落在原本连续的音频上；room 的采样跳变 -21 dBFS 来自底噪本身（白噪声相邻采样差就这么大）。mp3 解码后无尾部补零（room/sizzle 解码长度精确 40.000 / 20.000 s）。浏览器 `<audio loop>` 在循环点是否有可闻缝隙无法用仪器确认。

### 段落切换与整条混音（`tools/audio_render_demo.mjs`，匀速 30 vh/s，93 s）

- 整条混音 -29.0 LUFS，LRA 13.7 LU，峰值 -4.7 dBFS（各段电平 0.06–0.6 × 约 -18 LUFS 的素材，整体偏安静是设计值，是否够响以听感为准）。
- 相邻 100 ms 瞬时响度的跳变：17 处段落交界全部在 ±3.3 dB 以内（最大是 chop→stirfry 的 -3.3 dB，其余 ≤ 1.1 dB）；整条里最大的跳变是单次音效本身（bowlDown +11.1 dB、catch +4.3 dB、stirfryIn +3.9 dB），属于剧情事件。
- 渲染稿不含 catch 段的低通（只有音量），低通只在网页里生效。

### 浏览器行为（Chromium，/preview/visual，DOM 读数）

- 首次手势解锁：清掉记忆后刷新，点声音按钮前 14 个元素全部 paused；点一次按钮后 room 0.2 + sizzle 0.45 播放，`localStorage.kitchen.soundOn = "1"`；再次刷新按钮为"开"状态。
- 场景电平：idea 退出阶段 sizzle 0.05；missing 停留 0.19→0.05；hear 进入中段 0.31、停留开始 0.58、停留末 0.32；catch p=0.1 / 0.5 / 0.9 sizzle 0.31 / 0.35 / 0.38，低通 2032 / 6840 / 16000 Hz；handoff 只剩 room。
- 快速前后滚：在 bowl 触发点两侧 5 次来回（间隔 80 ms），bowlDown 触发计数 +5，始终只有 1 个元素，结束时 paused；元素总数始终 14。倒滚不触发。
- 切后台：全部 paused；后台期间滚过触发点不播；回前台只恢复循环声。
- 未测：iOS 真机、Safari 桌面版。
