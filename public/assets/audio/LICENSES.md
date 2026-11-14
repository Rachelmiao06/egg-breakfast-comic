# 音效许可记录

所有文件都是素材库里的真实录音，代码里不合成声音。处理流程可重复：`bash tools/audio_fetch.sh <空目录>` 下载原始录音，`python3 -I tools/audio_build.py <该目录>` 生成成品，`python3 -I tools/audio_measure.py` 测量。参数见 `tools/audio_build.py` 的 RECIPES，来源清单见 `tools/audio_sources.json`，每次实际用到的增益和接缝点记在 `tools/audio_build.log.json`。

**状态说明**：处理我做了，但我没法用耳朵听。所以下面每个文件的状态都是"已下载并处理（未经人耳试听）"，用户试听确认后才能改成"已验收"。

## 许可

- **CC0 1.0**（Freesound）：公共领域，可商用，不需要署名。下面照样写了作者，方便追溯。<https://creativecommons.org/publicdomain/zero/1.0/>
- **Mixkit Sound Effects Free License**：可以免费用在商业和非商业项目里，包括网页，不需要署名；**不能把素材文件单独再分发**（比如当素材包、模板或源文件发出去）。本项目把它们作为网页的一部分播放，符合许可。仓库目前是私有的；如果以后公开仓库，`public/assets/audio/` 里的 Mixkit 文件可能会被看作单独再分发，到时候请改成从 Mixkit 重新下载，或者换成 CC0 的备选。<https://mixkit.co/license/#sfxFree>

## 成品（代码会加载）

| 文件 | 状态 | 原始标题 | 来源 | 作者 | 许可 | 处理 |
|---|---|---|---|---|---|---|
| sizzle-loop.mp3 | 已下载并处理（未经人耳试听） | eggs frying 2017.wav | [freesound 543801](https://freesound.org/people/bennrush/sounds/543801/) | bennrush | CC0 1.0 | 用的是 HQ 预览 mp3。高通 90 Hz；+10.4 dB，限幅 -3 dBFS；取 1.5–15.5 s，和 15.5–17.0 s 做 1.5 s 等功率交叉淡化接缝 → 14.0 s 循环；编码 mp3 VBR q3，单声道/立体声保持原样 |
| room-loop.mp3 | 已下载并处理（未经人耳试听） | room tone medium or small kitchen fridge light drips.flac | [freesound 455826](https://freesound.org/people/kyles/sounds/455826/) | kyles | CC0 1.0 | HQ 预览。混成单声道，高通 60 Hz；+22.6 dB，限幅；取 8–28 s，2.5 s 交叉淡化接缝 → 20.0 s 循环 |
| chop-loop.mp3 | 已下载并处理（未经人耳试听） | VEGETABLES CUTTING | [freesound 459398](https://freesound.org/people/SamuelGremaud/sounds/459398/) | SamuelGremaud | CC0 1.0 | HQ 预览。高通 120 Hz；+21.7 dB，限幅；接缝点自动放在两刀之间最安静处（5.26 s / 14.42 s），40 ms 交叉淡化 → 9.16 s 循环 |
| stirfry-in.mp3 | 已下载并处理（未经人耳试听） | Food in a frying pan | [freesound 417995](https://freesound.org/people/derjuli/sounds/417995/) | derjuli | CC0 1.0 | HQ 预览。高通 90 Hz；+5.2 dB，限幅；取 1.45–3.35 s（下锅那一下的起音和最响段），5 ms 淡入、0.7 s 淡出 → 1.9 s |
| stirfry-loop.mp3 | 已下载并处理（未经人耳试听） | frying rice on a wok.wav | [freesound 679946](https://freesound.org/people/soundofsong/sounds/679946/) | soundofsong | CC0 1.0 | HQ 预览。高通 90 Hz；+2.2 dB，限幅 -5 dBFS（源录音本身有削波，-3 dBFS 编码后真峰值仍到 0 dBTP）；接缝点放在两次翻锅之间较安静处（2.95 s / 21.42 s），0.8 s 交叉淡化 → 18.47 s 循环 |
| sauce-stir-loop.mp3 | 已下载并处理（未经人耳试听） | stirring bowl.wav | [freesound 554557](https://freesound.org/people/dynamique/sounds/554557/) | dynamique | CC0 1.0 | HQ 预览（单声道）。源录音很轻：先轻度降噪 afftdn 10 dB，高通 150 Hz；+36.2 dB，限幅；只取前半段规律的勺碰碗（2.36–29.12 s），接缝点在两次轻碰之间，40 ms 交叉淡化 → 26.76 s 循环 |
| catch.mp3 | 已下载并处理（未经人耳试听） | Plastic Spatula on Non Stick pan.wav | [freesound 546452](https://freesound.org/people/miwilson/sounds/546452/) | miwilson | CC0 1.0 | HQ 预览。取较轻的一下（2.62 s 起 0.6 s），高通 120 Hz、低通 5 kHz 让它更软；+13 dB，限幅；5 ms 淡入、0.35 s 淡出 |
| bowl-down.mp3 | 已下载并处理（未经人耳试听） | Bowl placed on table | [mixkit 1799](https://mixkit.co/free-sound-effects/cooking/) | Mixkit | Mixkit Sound Effects Free License | 下载 wav。高通 60 Hz；+1.1 dB，限幅；取 0.03–0.88 s，5 ms 淡入、0.3 s 淡出 → 0.85 s |
| pour.mp3 | 暂不需要 | — | — | — | — | 任务说明里写明以后再做；代码请求它会得到 404，保持静音 |

## 备选（`alt/`，代码不加载，留给试听时对比）

觉得哪条更好，把它复制成上表对应的文件名即可，或者告诉我改 `tools/audio_build.py` 的配方。

| 文件 | 状态 | 原始标题 | 来源 | 作者 | 许可 | 和主选相比 |
|---|---|---|---|---|---|---|
| alt/sizzle-loop-fish.mp3 | 已下载并处理（未经人耳试听） | Frying fish on a hot pan | [mixkit 123](https://mixkit.co/free-sound-effects/food/) | Mixkit | Mixkit Sound Effects Free License | 无损源。更密、更均匀的滋滋声（LRA 0.5），没有煎蛋录音里偶尔的油爆声；2.0–16.0 s，1.5 s 接缝 |
| alt/room-loop-roomtone.mp3 | 已下载并处理（未经人耳试听） | KITCHEN_AMBIENCE_ROOMTONE_01.wav | [freesound 205165](https://freesound.org/people/justingregoire/sounds/205165/) | justingregoire | CC0 1.0 | 没有冰箱嗡声的宽频底噪；源录音很轻（+40 dB），可能听得出编码噪声 |
| alt/chop-loop-table.mp3 | 已下载并处理（未经人耳试听） | Chopping food on the table | [mixkit 134](https://mixkit.co/free-sound-effects/food/) | Mixkit | Mixkit Sound Effects Free License | 每 0.5 s 一刀、更整齐的切菜；只有 4.58 s，重复感可能更明显 |
| alt/stirfry-loop-onions.mp3 | 已下载并处理（未经人耳试听） | Cooking - Frying onions - sizzling - stirring | [freesound 741620](https://freesound.org/people/GoatsheadCastle/sounds/741620/) | GoatsheadCastle | CC0 1.0 | 更平稳、更轻的炒洋葱（LRA 1.4），没有明显翻锅起伏 |
| alt/sauce-stir-loop-plate.mp3 | 已下载并处理（未经人耳试听） | Stirring cutlery in ceramic plate | [mixkit 2835](https://mixkit.co/free-sound-effects/kitchen/) | Mixkit | Mixkit Sound Effects Free License | 无损、底噪很低（-57 dBFS），但更"叮当"，而且只有 2.95 s |
| alt/catch-egg-plop.mp3 | 已下载并处理（未经人耳试听） | Egg; dumped onto frying pan_1-2.aif | [freesound 119083](https://freesound.org/people/domrodrig/sounds/119083/) | domrodrig | CC0 1.0 | 真正的蛋落锅声，更湿更软；但源录音很轻（+35 dB），底噪 -36 dBFS |
| alt/bowl-down-2.mp3 | 已下载并处理（未经人耳试听） | Bowl put in table | [mixkit 2934](https://mixkit.co/free-sound-effects/food/) | Mixkit | Mixkit Sound Effects Free License | 另一种碗落桌，稍轻（-20.7 LUFS） |

## 待用户下载

Freesound 的原始文件（wav / flac / aif）要登录才能下载，我没有登录，用的是公开的 HQ 预览 mp3（约 150–230 kb/s）。目前听起来如果没问题就不用管；如果觉得某条有压缩感，登录后下载原始文件，放进 `tools/audio_fetch.sh` 用的目录（文件名用 `audio_sources.json` 里的键，比如 `fs-543801.wav`），再跑一次 `audio_build.py` 即可。

| 用在 | 原始文件页面（需登录下载原文件） |
|---|---|
| sizzle-loop.mp3 | https://freesound.org/people/bennrush/sounds/543801/ |
| room-loop.mp3 | https://freesound.org/people/kyles/sounds/455826/ |
| chop-loop.mp3 | https://freesound.org/people/SamuelGremaud/sounds/459398/ |
| stirfry-in.mp3 | https://freesound.org/people/derjuli/sounds/417995/ |
| stirfry-loop.mp3 | https://freesound.org/people/soundofsong/sounds/679946/ |
| sauce-stir-loop.mp3 | https://freesound.org/people/dynamique/sounds/554557/ |
| catch.mp3 | https://freesound.org/people/miwilson/sounds/546452/ |

Pixabay 的音效页面对脚本访问返回 403（机器人防护），这次没有用 Pixabay 的素材。
