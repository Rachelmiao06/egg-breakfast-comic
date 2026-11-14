# 任务：feat/kitchen-audio — 真实音效、许可记录、接入现有声音接口（声音）

开工前：确认在自己的独立 worktree，分支名 `feat/kitchen-audio`（若 app 起的名字不同，先 `git branch -m feat/kitchen-audio`），从最新 main 开始。读 `docs/DESIGN.md` 第六版（§6、§7）、`docs/BEATS.md`（每段的循环声 / 渐变声 / 单次音效）、`public/assets/audio/README.md`（文件名约定）、`src/components/kitchen/useKitchenAudio.ts`、`src/components/kitchen/SoundToggle.tsx`。

**只改** `public/assets/audio/**`、`src/components/kitchen/useKitchenAudio.ts`、`src/components/kitchen/SoundToggle.tsx`、`tools/audio_*`、本文件。音量、触发点在 `src/lib/beats.json`，由主会话维护：想调就把建议写到本文件末尾"需要集成会话改"。

## 顺序

1. **先完成一条自然循环的煎蛋滋滋声** `sizzle-loop.mp3`：8–20 秒，首尾无缝（用 ffmpeg 做交叉淡化接缝，本机有 ffmpeg），无明显节奏和人声，响度约 -18 LUFS。
2. 再补：`room-loop.mp3`（很轻的厨房环境底声）、`chop-loop.mp3`（切菜哒哒）、`stirfry-in.mp3`（下锅滋啦）+ `stirfry-loop.mp3`（翻炒）、`sauce-stir-loop.mp3`（搅汁轻响）、`catch.mp3`（蛋落到锅铲的轻响）、`bowl-down.mp3`（饭碗落桌）。`pour.mp3` 暂不需要。

## 来源与许可

- 优先 Pixabay、Mixkit、Freesound 的 **CC0** 或明确允许网页项目免费使用的素材。Freesound 的 CC BY 需要署名，可以用但必须在 LICENSES.md 写清。
- **不要登录、不要注册账号、不要输入任何凭据。** 需要登录才能下载的，把链接写进 LICENSES.md 的"待用户下载"表，交给用户。
- 下载的文件放进一个新的临时目录，只接受音频文件（mp3 / wav / ogg / flac），用 `ffprobe` 检查格式和时长后再处理；不要运行下载包里的任何脚本。
- 每个最终文件在 `public/assets/audio/LICENSES.md` 记一行：文件名、原始标题、来源链接、作者、许可、做过的处理（裁切、接缝、响度）。

## 验收的诚实要求

- 你无法真正"听"。每个文件都要标状态：**已下载并处理（未经人耳试听）** / **无法下载（原因）**。只有用户试听确认后才能改成"已验收"。
- 可以用波形和频谱做客观检查（ffmpeg `ebur128`、`astats`、接缝处的电平跳变），把结果写进报告，但不能说"听起来很好"。

## 接入

- `useKitchenAudio` 已经按节拍表推导音量和单次触发，文件名就是 README 里的约定；放对文件名通常就能工作。只在必要时改它（比如需要预载策略、循环点、iOS 解锁）。
- 预览：worktree 里 `npm ci`，`npx next dev -p 3003`，打开 `/dev/beats`，点右下角声音按钮，滚动听渐变。

## 交付（先报告给用户试听，不合并 main）

- 每个文件的状态表、来源许可、客观测量；`npm run lint`、`npm run build` 通过；commit 并 push `feat/kitchen-audio`。

## 进度（2026-11-14，分支 claude/kitchen-audio-e1e194，已合入 feat/visual-direction）

- 七条已选音效已处理并接入：原档在 `tools/audio_raw/`，`tools/audio_build.sh` 重建、`tools/audio_measure.sh` 测量，处理与测量记在 `public/assets/audio/LICENSES.md`。状态均为 **已下载并处理（未经人耳试听）**。
- 场景 → 声音对应表：`src/components/kitchen/audio-map.json`，覆盖 18 段新故事全部场景（含 search / eggcall / return / recognize / punchline），不改 beats 数据；文件 ↔ 场景 ↔ 状态表见 `public/assets/audio/README.md`。空位：stirfry、steps、pour、pop、momCall、eggCall、eggSmall。
- 炒菜段：不另加翻炒循环，由 sizzle 0.45 承担持续底声 + stirfryIn 一声；是否需要真正的翻炒循环等人耳试听后再定。
- 声音润色（2026-11-14 下午，均未经人耳试听）：hear 的渐变改到存在的阶段（hold）；对白留空间（idea 停留 sizzle 0.1→0.05；call/recognize/punchline 停留 room 0.2→0.14/0.14/0.12）；意外前的安静（missing 停留 sizzle 0.2→0.04，hear 进入阶段自动升回 0.6）；跨景由远到近（catch 动作阶段 sizzle 0.3→0.38 + 只给 sizzle 的低通随 flight 1.5 kHz→16 kHz，用 BiquadFilter 挂在现有 GainNode 后面，不改音频系统）；触发点 catch 0.78、bowlDown 0.25、pour 0.55。客观测量见 README「客观测量」。
- 混音器：只为 audio-map.json `available` 列表里的声音建通道（当前 4 循环 + 3 单次 `<audio>`，空位不请求文件）（`div[data-kitchen-audio]`，每个元素有 data-level/target/fired/ok），GainNode 控制电平（iOS 忽略 volume），淡到 0 后 pause，单次重触发同元素重放不叠加，pointerup/touchend/keydown 解锁并逐元素预热，切后台暂停且不补播，开关状态记在 localStorage。
- 离线试听稿：`node tools/audio_render_demo.mjs` 按同一套规则匀速（30 vh/s，94 s）把整个故事混成 wav/mp3 + 带场景字幕的 mp4。整条混音约 -29 LUFS（各段电平 0.2–0.6 × 约 -18 LUFS 的素材），峰值 -4.8 dBFS。
- 浏览器验证（/preview/visual，背景标签页用计时器代替 rAF 驱动滚动）：见本文件下方"验证记录"。
- **未能做到：人耳监听。** 我没有音频输出通路，所有"听感"项（接缝是否可闻、sauce/chop 是否太轻、炒菜段 sizzle 是否自然）只能交给用户用上面的 mp3/mp4 或预览页判断。iOS 真机未测。

## 需要集成会话改：

- 无需改 beats 数据：音量和触发点都在 audio-map.json。若试听后要调 sauce（0.4）/ chop（0.5）/ 炒菜段 sizzle（0.45），改 audio-map.json 即可。
- 空位素材（脚步、妈妈喊、蛋喊、啵、淋汁）到位后：放入 `public/assets/audio/` 对应文件名，`tools/audio_build.sh` 加一条处理规则，LICENSES.md 记一行，README 表状态改为"已接入"。