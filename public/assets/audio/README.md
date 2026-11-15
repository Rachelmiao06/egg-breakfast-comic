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

## 文件 ↔ 场景编号 ↔ 方式 ↔ 状态（2026-11-14，对应新故事：v2 节拍 19 段含 drop；`?motion=v1` 18 段无 drop）

场景 → 声音的对应表在 `src/components/kitchen/audio-map.json`（按场景编号覆盖节拍数据的 audio 字段，表里没有的场景沿用节拍数据原值；场景编号与 `src/app/preview/visual/beats.visual-v2.json` / `beats.visual.json` 一致）。单次音效的触发点可写成阶段符号（`enterEnd` / `actionEnd` / `holdEnd`，可带偏移），由混音器按当前节拍表的 phases 换算，新旧两版节拍共用一张表。
音量是相对电平（0–1），素材本身已按 `tools/audio_build.sh` 处理（原档在 `tools/audio_raw/`，测量用 `tools/audio_measure.sh`；`tools/audio_render_demo.mjs` 可把整个故事离线混成一条音频 + mp4 供试听）。
**空位 = 还没有音源，接口里已登记、保持静音；不要用不相关的声音填补。** 混音器只为 `audio-map.json` 的 `available` 列表里的 9 个声音（chop 循环换成了 chopHit）创建 `<audio>` 并请求文件，空位不发请求（没有 404）。补上文件后：放进本目录、加到 `available`、LICENSES.md 记一行、本表状态改为"已接入"。

| 声音 id | 文件 | 方式 | 场景编号（音量 / 触发点） | 状态 |
|---|---|---|---|---|
| room | room-loop.mp3（40 s 循环） | 循环，全程 | opening/drop/chop/stirfry/sauce/handoff/bowl/yolk/return 0.2；bag/idea/missing 0.25；hear/catch 0.18；eggcall 0.08；search 0.06；对白留空间：call / recognize 停留阶段 0.2→0.14，punchline 0.2→0.12 | 已接入 |
| sizzle | sizzle-loop.mp3（20 s 循环） | 循环，主要动作声 | opening 0.45；drop（仅 v2）动作阶段 0.45→0.2、停留 0.2（蛋跳到桌沿、厨房转为纸面）；bag 0.12；idea 0.1→停留阶段 0.05；chop 0.06；**stirfry 0.45（承担翻炒底声，待试听）**；sauce 0.08；missing 0.2→停留阶段 0.04（意外前的安静）；hear 进入阶段自动 0.04→0.6、停留阶段 0.6→0.3；catch 动作阶段 0.3→0.38 + 低通随 flight 从 1.5 kHz 开到 16 kHz（由远到近）；handoff 进入阶段 0.38→0 | 已接入 |
| chop | chop-loop.mp3（6.5 s 循环） | 循环 | 2026-11-14 起不再使用：切菜格改为逐刀触发 chopHit | 文件保留，不加载 |
| chopHit | chop-hit.mp3（0.26 s） | 单次，**由前景动画逐刀触发**（window 事件 `kitchen:oneshot`，detail.sound = "chopHit"） | chop 段落刀接触的那一帧，每刀一次（前景三刀）；电平 0.5 = 原来循环里每一刀 | 已接入（未试听） |
| stirfryIn | stirfry-in.mp3（1.8 s） | 单次 | stirfry @ p=0.22（下锅"滋啦"） | 已接入 |
| stirfry | stirfry-loop.mp3 | 循环 | 用户决定：翻炒复用 sizzle，不新增文件 | **空位**（永久） |
| sauce | sauce-stir-loop.mp3（17.7 s 循环） | 循环，主要动作声 | sauce 0.4（调汁、盛饭） | 已接入 |
| pop | pop.mp3（0.28 s） | 单次 | hear @ p=0.35（"啵！"，播放电平 0.5） | 已接入（2026-11-14，未试听） |
| catch | catch.mp3（0.6 s） | 单次 | catch @ actionEnd（动作阶段结束 = 蛋落到空锅铲；v1 节拍 p=0.78，v2 p=0.80） | 已接入 |
| bowlDown | bowl-down.mp3（1.1 s） | 单次 | bowl @ p=0.25（碗落桌） | 已接入 |
| pour | pour.mp3 | 单次 | bowl @ p=0.55（淋汁） | **空位**（用户决定保持） |
| momCall | mom-call.mp3 | 单次 | call @ p=0.25（"宝宝，来吃饭啦！"） | **空位**（用户决定：保留漫画文字，不配音） |
| eggSmall | egg-small.mp3 | 单次 | call @ p=0.55、tablecall @ p=0.5（"我在这儿……"） | **空位**（同上） |
| steps | footsteps-loop.mp3（7.56 s 循环） | 循环，主要动作声 | search：离开这一拍接上（@leave−0.08 → @leave，0→0.3），探头格 p5b 落定时（@peek±0.04）停下；eggcall：妈妈转身后由远到近 0→0.15、低通 700→3000 Hz；return：0.15→0.3、低通开到 16 kHz，回到碗前停下（audio-map 的 ramps / lowpass） | 已接入（未试听） |
| hopTap1 / hopTap2 / hopTap3 | hop-tap-1/2/3.mp3（各 0.092 s） | 单次，声像 +0.6（偏右） | listen（接蛋前的声音铺垫，只有 v2）：@tap1 / @tap2 / @tap3，电平 0.2；每进入一次只播一次（oncePerVisit）。从 chop 原档刀碰木案板的三下撞击切出 + 1.5 kHz 低通 | 已接入（未试听） |
| eggCall | egg-call.mp3 | 单次 | eggcall @ p=0.25（"妈！这里！"，画面 p5d） | **空位**（同上） |

旧版 9 段节拍表（`/`、`/dev/beats`）里与新故事同名的场景（opening/chop/stirfry/sauce/catch）也会套用上表的值；其余旧场景 notice/spatula/serve/ending 沿用 beats.json 原值。

## 客观测量（2026-11-14，全部**未经人耳试听**）

我没有音频输出通路，下面只有仪器读数和 DOM 状态；接缝是否可闻、响度是否合适、切换是否自然，只能由人耳在 `/preview/visual` 或 `tools/audio_render_demo.mjs` 的渲染稿上判断。

### 成品文件（`tools/audio_measure.sh`，先解码成 WAV 再测）

| 文件 | 时长 | 整体响度 | 真峰值 | 首尾 60 ms RMS 差 | 处理 |
|---|---|---|---|---|---|
| room-loop.mp3 | 40.000 s | -18.4 LUFS | -4.6 dBTP | 回绕跳变 0.8× 中位，首尾 20 ms 无凹陷 | 取前 40.5 s，零交叉旋转 0.984 s + 0.5 s 等功率交叉淡化，+27.2 dB，循环限幅 |
| sizzle-loop.mp3 | 20.000 s | -20.2 LUFS | -0.5 dBTP | 回绕跳变 0.3× 中位，无凹陷 | 取前 20.5 s，零交叉旋转 0.980 s + 0.5 s 交叉淡化，+4.4 dB，循环限幅 |
| chop-loop.mp3 | 6.526 s | -26.3 LUFS | -2.2 dBTP | 两端都在静音段，无凹陷 | 末尾补 0.29 s 使刀声间隔均匀，零交叉旋转 0.593 s + 0.1 s 交叉淡化，+2.5 dB，循环限幅 |
| sauce-stir-loop.mp3 | 17.700 s | -30.2 LUFS | -1.6 dBTP | 回绕跳变 0.6× 中位，无凹陷 | 取 [0.80, 18.70]，零交叉旋转 0.620 s + 0.2 s 交叉淡化，+2.0 dB（受峰值限制），循环限幅 |
| stirfry-in.mp3 | 1.800 s | -18.3 LUFS | -4.7 dBTP | — | 取 [0.86, 2.66] 一声，尾部 0.7 s 淡出，+1.7 dB |
| catch.mp3 | 0.600 s | -19.6 LUFS | -2.2 dBTP | — | 取第一声 plop [0.47, 1.07]，尾部 0.15 s 淡出，+6.9 dB |
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
- v2 节拍（含 drop，2530 vh，30 vh/s = 84 s）重渲：整条 -28.9 LUFS，LRA 12.2 LU，峰值 -4.6 dBFS；18 处段落交界 100 ms 瞬时响度跳变全部 ≤ 3.9 dB（进入 drop 0.7 dB），catch 在 43.6 s = catch 段 p=0.80（actionEnd）落下；浏览器（v2 默认）：drop p=0.05 / 0.45 / 0.90 sizzle 0.45 / 0.325 / 0.20，bag 进入中段 0.16；catch p=0.79 未触发、p=0.81 触发 1 次；`?motion=v1` 下 catch 在 p=0.78 与 0.80 之间触发（= v1 的 actionEnd 0.78）。

### 循环接缝（2026-11-14 晚修复，1 ms 分辨率）

素材会话的真实浏览器录音测到 room 每次回绕（约 40 s 一次）掉音 5–9 ms。原因：限幅器 alimiter 有 5 ms 前瞻，没开延迟补偿时在文件开头写入约 4 ms 数字静音、把最后 5 ms 推出文件。四个循环都有这个问题；sizzle 足够响、chop 和 sauce 的开头本来在静音段里，所以只有 room 能被测出来。之前"首尾 60 ms 电平差"的窗口太宽，把几毫秒的凹陷平均掉了。

修法（`tools/audio_build.sh`）：循环声三份首尾相接过限幅器（开延迟补偿）、只取中间一份；旋转点由 `tools/audio_pick_cut.mjs` 在给定值 ±0.1 s 内挑零交叉；全部按采样数计算；先重采样到 44.1 kHz 再拼接。单次声的限幅器也开延迟补偿。

验收用 `node tools/audio_seam_check.mjs`：

| 文件 | 回绕采样跳变（修前 → 修后，相对文件内中位） | 首尾 20 ms 低于中位 10 dB 的最长连续（修前 → 修后） | 回绕处 1 ms 电平跳变（修前 → 修后） |
|---|---|---|---|
| room-loop | 6.1× → 0.8× | 首 5 ms → 0 ms | 30.8 → 2.4 dB |
| sizzle-loop | 0.7× → 0.3× | 首 1 ms → 0 ms | 9.5 → 2.7 dB |
| chop-loop | 两端静音段，跳变 0.0005 → 0.0000 | 首 5 ms → 0 ms | 30.3 → 3.4 dB |
| sauce-stir-loop | 2.5× → 0.6× | 首 5 ms → 0 ms | 36.7 → 2.0 dB |

这些都是解码后的文件测量。

真实浏览器复测（素材会话，Chrome 开发预览，AudioContext 实际输出，修复后版本）：文件本身干净，拼接跳变 0.0047，正常值 0.0083。但 room 7 次回绕里有 4 次仍有 3–8 ms、低于中位 10 dB 以上的掉落，位置固定在回绕点后约 61–68 ms；另外 3 次干净，随机对照最长 3 ms。sizzle 5 次、sauce 3 次回绕都干净。文件里没有这个掉落，位置又固定，所以应是 Chrome 用 `<audio loop>` 循环 mp3 时自己时有时无插入的间隙，文件处理改不掉。

是否可闻要人耳判断，不阻塞集成。要根治：循环声改用 `decodeAudioData` + `AudioBufferSourceNode`（loop=true）做采样级循环，单次音效可保留 `<audio>`。这是混音器结构改动，等用户试听后决定。人耳仍未试听。

### 接蛋前的声音铺垫 listen（2026-11-14 晚，用户纠正位置后重做；全部未试听）

- 原先放在寻找段的 quiet 留白和敲碗声（bowl-tap-1/2）已撤回、文件已删。寻找段只保留脚步：search 开始脚步接上、停留开始前后停下；eggcall 妈妈转身后由远到近（低通 700→3000 Hz）；return 回到碗前停下。
- 素材：从 chop 原档里取刀碰木案板的三下撞击（木头接触），1.5 kHz 两级低通压掉刀的金属亮度，做成软的小木头"嗒"，三下各不相同。catch 原档的 plop 偏湿、偏嘴巴音，勺碰碗是瓷器声（此时蛋还没上饭碗），都没用。没有下载新素材。
- 声像 +0.6（偏右），电平 0.2；listen 里 sizzle 在进入阶段从 hear 的 0.3 退到 0.05、room 0.14，catch 进入阶段照旧把 sizzle 带回来。
- 离线渲染（v2，30 vh/s）：三下在 38.95 / 39.40 / 39.70 s；右声道比左声道高 7.4–8.2 dB，比当时右声道的底声高 10.4–13.3 dB（电平 0.3 时是 13.8–16.7 dB，偏响，已降到 0.2）；整条 -29.3 LUFS，进入 listen / catch 的瞬时响度跳变 0.6 / 0.8 dB。
- 浏览器（v2，DOM / 节点读数）：hear p 0.9 room 0.18、sizzle 0.30；listen p 0.12 / 0.5 sizzle 0.18 / 0.05，room 0.161 / 0.14；catch p 0.1 sizzle 0.164。首次慢速经过 3 下、声像都是 +0.6；段内从 0.95 倒回 0.2 再前进到 0.7，0 下；原地反复滚动 0 下；回到 hear 再经过，3 下；重新允许后一次 33 vh 越过三下，1 下；一次跳 161 vh 从 hear 到 catch，0 下；之后从 catch 倒回 listen 再前进（同一次进入），0 下。寻找段脚步复测：search p 0.2 / 0.42 为 0.30 / 0；eggcall p 0.6 为 0.059、低通 1606 Hz；return p 0.25 / 0.42 为 0.284 / 0。

### 切菜逐刀（chopHit，2026-11-14）

- 文件：从 chop-loop 同一原档取第二刀 [1.177, 1.437]，起音在文件第 2 ms（≤ 5 ms），+40 ms 是刀碰案板的峰值，尾部 0.08 s 淡出；-2.3 dBTP。
- 混音器：收到 `kitchen:oneshot` 就把解码好的 AudioBuffer 新建一个节点播放，快速连刀可以重叠。浏览器 DOM / 节点读数：三刀间隔 300 ms 派发，节点启动在 0 / 301 / 601 ms；50 ms 间隔连派 5 次，5 个节点都启动；静音、模拟后台、模拟未解锁（AudioContext 非 running）时都不启动，回前台不补播。离线渲染工具不含逐刀声（触发时刻在动画里）。
- 顺带修正：裁切改为从头解码后 atrim，不再用 mp3 输入寻址（寻址后第一帧约 24 ms 解码为静音）。catch 和 stirfry-in 的开头因此不再被吃掉一帧；所有循环重建后接缝检查仍全部通过，响度变化 ≤ 0.1 LU。

### 浏览器行为（Chromium，/preview/visual，DOM 读数）

- 首次手势解锁：清掉记忆后刷新，点声音按钮前 7 个元素（只为有文件的声音建通道）全部 paused；点一次按钮后 room 0.2 + sizzle 0.45 播放，`localStorage.kitchen.soundOn = "1"`；再次刷新按钮为"开"状态。
- 场景电平：idea 退出阶段 sizzle 0.05；missing 停留 0.19→0.05；hear 进入中段 0.31、停留开始 0.58、停留末 0.32；catch p=0.1 / 0.5 / 0.9 sizzle 0.31 / 0.35 / 0.38，低通 2032 / 6840 / 16000 Hz；handoff 只剩 room。
- 快速前后滚：在 bowl 触发点两侧 5 次来回（间隔 80 ms），bowlDown 触发计数 +5，始终只有 1 个元素，结束时 paused；元素总数始终等于 available 列表长度（7）。倒滚不触发。
- 切后台：全部 paused；后台期间滚过触发点不播；回前台只恢复循环声。
- 后台恢复不补播（素材会话在真实 Chrome 里报的缺陷，已修）：后台里 rAF 停止、时间轴不更新，回前台时时间轴一次跳过后台滚过的距离。现在 visibilitychange→visible 时先把"上一次时间轴"重同步到当前滚动位置再放行。复现脚本（rAF 排队模拟后台，catch p=0.5 → 后台 scrollTo bowl p=0.6 → 恢复）：恢复后 catch / bowlDown 触发计数保持 0，只有 room 播放；之后真实滚动 bowl 0.1→0.5 触发 bowlDown 一次。真实最小化窗口的复测由素材会话的录制脚本做。
- 未测：iOS 真机、Safari 桌面版。


## 隔着画框、声像、点火、结尾三下嗒（2026-11-14，未试听）

见 `docs/PAPER-WORLD.md`。声音相关的数值：`audio-map.json` 每段的 `roomHz`；tablecall 的 sizzle 0.05；closeup 的 room 退到 0.04；
`kitchen:oneshot` 事件的 rate / gain / pan；`kitchen:pan` 事件（搅汁循环声的声像）；点火常量 `IGNITE_RISE_PER_SEC` / `IGNITE_MS`。
