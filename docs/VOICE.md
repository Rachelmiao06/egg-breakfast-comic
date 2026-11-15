# 妈妈的语气词（人声）

> 状态（2026-11-15）：**已接入 6 条**（mom-sigh / huh / hmm-q / oh / laugh / wow），用 ElevenLabs 的 Yating Lin（普通话、中年女声）生成；还差 mom-hum / aha / gasp / ah / uh 5 条（生成通道繁忙，等重试）。原始生成文件在 `tools/voice_raw/`，成品在 `public/assets/audio/voice/`（裁掉首尾静音、-18 LUFS、单声道）。新增一条：放文件 + 在 `music-map.json` 的 `voiceAvailable` 登记名字。
> 生成时的要求：可爱、轻巧、**不要前面的吸气声**（用户 2026-11-15）。
> 为什么没有：语气词必须是自然、好听的中年女声，不能是电子音。我没有办法合成这种声音（代码合成出来就是电子音），所以需要真人录音或高品质的人声生成工具。

## 要的 11 条（每条 mp3，单声道，44.1 kHz，0.4–1.6 s，开头结尾各留约 50 ms 静音，峰值约 -3 dB，**不要混响**）

| 文件名 | 声音 | 场景 / 触发 | 语气 |
|---|---|---|---|
| mom-sigh.mp3 | "呼……" | bag 放下买菜袋 | 累但放松的一口气，下沉 |
| mom-hum.mp3 | "嗯～" | idea 琢磨今天做什么 | 想事情，上扬再落，鼻音，闭口 |
| mom-aha.mp3 | "哦！" | idea 想到了 | 轻快、短、微微上扬 |
| mom-hmm-q.mp3 | "嗯……？" | missing 觉得少点什么 | 迟疑，尾音上扬不落地 |
| mom-huh.mp3 | "嗯？" | hear 听见动静 | 短，上扬，警觉 |
| mom-oh.mp3 | "哎？" | catch 蛋飞过来 | 惊讶但不尖，柔 |
| mom-laugh.mp3 | "哈～" | handoff 轻轻笑一声 | 宠溺的、气声多的短笑 |
| mom-wow.mp3 | "哇～" | yolk 划开流黄 | 满足、轻轻拖长 |
| mom-gasp.mp3 | "啊？" | recognize 认出来 | 小声吸气带出的疑问 |
| mom-ah.mp3 | "啊！" | worry 担心 | 短促吸气，轻 |
| mom-uh.mp3 | "呃……" | punchline 无语 | 僵住，低，平，尾音拖 |

音色统一：**同一个人**说完这 11 条，成年中年女性，温和、松弛、不夸张，没有播音腔，没有动画配音那种拔高。

## 怎么来（需要你定）

1. **你自己 / 朋友录**：手机在安静房间里贴近录，最自然。我可以做处理（降噪、裁切、统一响度）和登记。
2. **人声生成工具**（例如 ElevenLabs 之类，选"中年女声、温暖"，让它念这些拟声词）：生成后要你来试听挑，因为语气词最容易听出电子味。
3. **素材库**：我可以去 Freesound 等找 CC0 的女声语气词，但中文语气的自然中年女声很难找，而且下载文件需要你先同意。

## 接入步骤（拿到文件后）

1. 把 mp3 放进 `public/assets/audio/voice/`（文件名同上）。
2. 在 `src/components/kitchen/music-map.json` 的 `voiceAvailable` 数组里加文件名（不带 .mp3）。
3. 刷新页面。人声响时配乐会自动退到 0.55 倍，说完再回来。
4. 位置、音量不对：改同一个文件里对应场景的 `stingers`（`at` 是段内进度，`gain` 是音量）。

## 已接好的位置

见 `music-map.json` 里 `mom-*` 的各条：bag 0.4；idea 0.4 / 0.54；missing enterEnd+0.08；hear 0.5；catch 落铲前一点；handoff enterEnd+0.08；yolk enterEnd+0.1；recognize 0.2；worry 0.2；punchline 0.5。
