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

## 交付报告（2026-11-13，feat/kitchen-audio）

**我没法用耳朵听。** 下面所有文件都是"已下载并处理（未经人耳试听）"，用户试听确认后才能改成"已验收"。来源、许可、每一步处理见 `public/assets/audio/LICENSES.md`。

### 文件状态与客观测量

测量工具 `python3 -I tools/audio_measure.py`（解码方式与 Chromium 一致，会认 LAME gapless 头）。
I = 积分响度，TP = 真峰值，floor = 底噪（50 ms RMS 的 10% 分位）。
接缝：wrap_jump = 首尾采样差 / 正文相邻采样差 99.9% 分位（≤ 1 表示接缝处的跳变不比正文里任何一处大）；
click = 接缝 ±32 采样二阶差分 / 正文 99.9% 分位（≤ 1.5 视为无咔哒）。
step_db 是首尾各 100 ms 的电平差，对切菜、勺碰碗这种冲击声没有意义（取决于离接缝最近的那一下敲击），只对连续声参考。

| 文件 | 状态 | 时长 | I (LUFS) | TP (dBTP) | floor (dBFS) | wrap_jump | click | step_db |
|---|---|---|---|---|---|---|---|---|
| sizzle-loop.mp3 | 已下载并处理（未经人耳试听） | 14.00 s | -18.3 | -1.4 | -26.3 | 0.06 | 0.29 | -0.4 |
| room-loop.mp3 | 已下载并处理（未经人耳试听） | 20.00 s | -18.0 | -3.3 | -21.8 | 0.50 | 1.40 | -2.2 |
| chop-loop.mp3 | 已下载并处理（未经人耳试听） | 9.16 s | -18.8 | -1.3 | -37.0 | 0.02 | 0.06 | -1.1 |
| stirfry-loop.mp3 | 已下载并处理（未经人耳试听） | 18.47 s | -18.2 | -1.9 | -28.5 | 0.03 | 0.11 | -0.3 |
| sauce-stir-loop.mp3 | 已下载并处理（未经人耳试听） | 26.76 s | -18.8 | -2.7 | -38.1 | 0.08 | 0.59 | （冲击声） |
| stirfry-in.mp3 | 已下载并处理（未经人耳试听） | 1.90 s | -18.2 | -3.3 | — | — | — | — |
| catch.mp3 | 已下载并处理（未经人耳试听） | 0.60 s | -18.2 | -5.9 | — | — | — | — |
| bowl-down.mp3 | 已下载并处理（未经人耳试听） | 0.85 s | -18.5 | -2.9 | — | — | — | — |
| pour.mp3 | 暂不需要（任务说明） | — | — | — | — | — | — | — |

另有 7 条备选在 `public/assets/audio/alt/`（代码不加载），说明见 LICENSES.md。

浏览器里核对过（Chromium，/dev/beats，端口 3004）：8 个文件都能解码，循环解码后长度与设计一致（如 sizzle 14.000 s、room 20.000 s），首尾没有编码器填充；点声音按钮后 5 条循环以正确的 loopStart/loopEnd 启动；从头滚到尾依次触发 stirfryIn、catch、bowlDown 各一次，回滚不触发；循环音量跟着节拍表变化（例如接蛋段 sizzle 0.55 → 0.2）。控制台除 pour.mp3 的 404 外没有新报错。Safari / iOS 没有条件实测。

### 已知风险（需要人耳判断）

- **sauce-stir-loop**：源录音很轻，增益 +36 dB；已轻度降噪，底噪仍只比响度低约 20 dB，可能听得出"沙沙"声。备选 `alt/sauce-stir-loop-plate.mp3` 底噪低，但更"叮当"、只有 2.95 s。
- **room-loop**：冰箱嗡声，有几条固定音高的低频线。如果觉得"嗡"，备选 `alt/room-loop-roomtone.mp3` 是宽频底噪。
- **sizzle-loop** 用的是煎蛋录音，有偶尔的油爆声；如果想要更平稳的滋滋声，试 `alt/sizzle-loop-fish.mp3`。
- Freesound 的文件来自公开的 HQ 预览 mp3（原文件要登录），再编码了一次；听得出压缩感就按 LICENSES.md "待用户下载"换原文件重跑。

### 代码改动（只在我的文件里）

- `useKitchenAudio.ts` 改用 Web Audio：采样级无缝循环（`<audio loop>` 播 mp3 在循环点有空隙）；GainNode 渐变（iOS 忽略 `audio.volume`）；解码后裁掉首尾近零的编码器填充；空闲时预载、打开声音时立刻加载；切后台暂停。对外接口不变：`useKitchenAudio()` 仍返回 `{ available }`，节拍表的读法不变。新增导出 `unlockKitchenAudio()`。
- `SoundToggle.tsx`：打开声音时在点击手势里调用 `unlockKitchenAudio()`（iOS 只允许手势里启动 AudioContext）。
- 单次音效 catch 的播放音量从 0.6 降到 0.5（它是"轻响"）；这个数在 `useKitchenAudio.ts` 里，不在节拍表。
- 新增 `tools/audio_sources.json`、`tools/audio_fetch.sh`、`tools/audio_build.py`、`tools/audio_measure.py`、`tools/audio_build.log.json`。

## 需要集成会话改：
- （建议，待试听后决定）`room` 循环在每段都是 0.25。room-loop 是连续的冰箱底声，-18 LUFS × 0.25 ≈ -30 LUFS，可能比"很轻"略响；如果试听觉得嗡，改成 0.15 左右。
- 第 8 段（结尾近景）有 `pour` 单次音效 @0.3，但 pour.mp3 按任务说明暂不做，所以那里没声音、浏览器控制台会有一条 404。如果短期内不做淋汁声，可以先把这条 oneshot 去掉。
- 预览配置：worktree 的 `.claude/launch.json`（不归我改）可以加一条端口 3003/3004 的 `next dev` 配置，方便以后直接用预览面板起声音分支。我只在本地临时加过，没有提交。

