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

## 需要集成会话改：
（在这里追加）
