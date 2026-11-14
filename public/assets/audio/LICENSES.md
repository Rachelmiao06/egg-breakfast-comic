# 音效许可记录

均无需署名；记录仅作内部溯源。来源页面的许可已逐条在站内核对（2026-11-13）。
处理栏：由 `tools/audio_build.sh` 从 `tools/audio_raw/`（原始下载）生成，可重复执行；测量用 `tools/audio_measure.sh`（2026-11-13，未经人耳试听）。响度规则：目标 -18 LUFS，但真峰值限幅不超过 -1 dBTP + 允许量（持续声 6 dB、敲击声 3 dB），所以敲击类达不到 -18。

| 文件 | 原始标题 | 来源 | 作者 | 许可 | 处理 |
|---|---|---|---|---|---|
| room-loop.mp3 | Kitchen room tone day | https://pixabay.com/sound-effects/film-special-effects-kitchen-room-tone-day-61809/ | freesound_community | Pixabay Content License | 取前 40.5 s（重采样 44.1 kHz），在 1 s 附近挑零交叉点旋转（0.984 s）+ 0.5 s 等功率交叉淡化接缝 → 40.0 s 循环；+27.2 dB，限幅器按循环处理（三份相接取中间）；128 kbps。成品 -18.4 LUFS，-4.6 dBTP；回绕采样跳变 0.8× 中位，首尾 20 ms 无凹陷 |
| sizzle-loop.mp3 | Frying Pan Hot Sizzle Loop 1 | https://pixabay.com/sound-effects/film-special-effects-frying-pan-hot-sizzle-loop-1-200912/ | floraphonic | Pixabay Content License | 取前 20.5 s，零交叉旋转（0.980 s）+ 0.5 s 交叉淡化接缝 → 20.0 s 循环；+4.4 dB 并按循环限幅。成品 -20.2 LUFS，-0.5 dBTP；回绕采样跳变 0.3× 中位 |
| chop-loop.mp3 | Knife Cut Veggies Foley 4 | https://pixabay.com/sound-effects/household-knife-cut-veggies-foley-4-211705/ | floraphonic | Pixabay Content License | 末尾补 0.29 s 静音使首尾刀声间隔≈1.05 s，零交叉旋转（0.593 s）+ 0.1 s 交叉淡化（接缝在静音段内）→ 6.526 s 循环；+2.5 dB，按循环限幅。成品 -26.3 LUFS，-2.2 dBTP；首尾 20 ms 无凹陷 |
| stirfry-in.mp3 | sizzle4-water-into-hot-pan | https://pixabay.com/sound-effects/film-special-effects-sizzle4-water-into-hot-pan-42578/ | freesound_community | Pixabay Content License | 取 [0.86, 2.66]（起音 0.88 s，之前为静音）一声爆发，尾部 0.7 s 淡出 → 1.8 s；+1.7 dB（限幅器开延迟补偿）。成品 -18.3 LUFS，-4.7 dBTP |
| sauce-stir-loop.mp3 | Spoon Stir in Bowl | https://pixabay.com/sound-effects/household-spoon-stir-in-bowl-437705/ | u_xg7ssi08yr | Pixabay Content License | 取 [0.80, 18.70]（两端都在勺声间隙），零交叉旋转（0.620 s）+ 0.2 s 交叉淡化 → 17.7 s 循环；+2.0 dB（受峰值限制），按循环限幅。成品 -30.2 LUFS，-1.6 dBTP；回绕采样跳变 0.6× 中位 |
| catch.mp3 | soft plop | https://pixabay.com/sound-effects/film-special-effects-soft-plop-97691/ | freesound_community | Pixabay Content License | 取第一声 plop [0.47, 1.07]（起音 0.49 s、峰值 0.52 s），尾部 0.15 s 淡出 → 0.6 s；+6.9 dB（限幅器开延迟补偿，开头不再多出约 4 ms 静音）。成品 -19.6 LUFS，-2.2 dBTP |
| bowl-down.mp3 | Bowl placed on table（Mixkit 条目 1799） | https://mixkit.co/free-sound-effects/kitchen/ | Mixkit | Mixkit Sound Effects Free License | 原档 WAV 16-bit 44.1 kHz，用 ffmpeg 转成 mp3 192 kbps（1.1 s） |
| footsteps-loop.mp3 | 01-24 Footsteps, Rug, Slippers, Slow Pace | https://pixabay.com/sound-effects/film-special-effects-01-24-footsteps-rug-slippers-slow-pace-73912/ | SpliceSound（Freesound）/ freesound_community | Pixabay Content License | 2026-11-14 用户批准下载（非商用项目）。原档 29.86 s 单声道 48 kHz，约 -42 LUFS。取 [0.80, 8.66]（两端在步间），零交叉旋转（0.328 s）+ 0.3 s 交叉淡化 → 7.56 s 循环（6 步 + 回绕处一个步间，跨回绕的步距与文件内一致，约 0.63 s）；+19.1 dB（受峰值限制），按循环限幅；128 kbps。成品 -24.2 LUFS，-2.4 dBTP；回绕采样跳变 0.2× 中位，首尾 20 ms 无凹陷 |
| chop-hit.mp3 | Knife Cut Veggies Foley 4（与 chop-loop 同一原档） | https://pixabay.com/sound-effects/household-knife-cut-veggies-foley-4-211705/ | floraphonic | Pixabay Content License | 取第二刀 [1.177, 1.437]（起音 1.1793 s，没有切菜前奏，之后无二次撞击），1 ms 淡入、尾部 0.08 s 淡出 → 0.26 s；+2.5 dB（与 chop-loop 同增益）。成品 -2.3 dBTP，起音在文件第 2 ms |
| hop-tap-1.mp3 | Knife Cut Veggies Foley 4（与 chop-loop 同一原档） | https://pixabay.com/sound-effects/household-knife-cut-veggies-foley-4-211705/ | floraphonic | Pixabay Content License | 接蛋前的声音铺垫（listen）：画外右侧蛋在木台面上轻跳落下的"嗒"。取刀碰木案板最轻、前面最安静的一下（峰值 5.850 s，峰值前 -35…-46 dB），[峰值 −2 ms, +90 ms]，1.5 kHz 两级低通去掉刀的金属亮度，2 ms 淡入、0.05 s 淡出 → 0.092 s；+28.7 dB（受峰值限制）。成品 -2.3 dBTP，瞬时响度最大 -22.9 LUFS，起音在第 2 ms |
| hop-tap-2.mp3 | Knife Cut Veggies Foley 4（同上） | https://pixabay.com/sound-effects/household-knife-cut-veggies-foley-4-211705/ | floraphonic | Pixabay Content License | 同上，取峰值 4.683 s 那一下 → 0.092 s；+12.3 dB。成品 -2.3 dBTP，瞬时响度最大 -23.5 LUFS |
| hop-tap-3.mp3 | Knife Cut Veggies Foley 4（同上） | https://pixabay.com/sound-effects/household-knife-cut-veggies-foley-4-211705/ | floraphonic | Pixabay Content License | 同上，取峰值 3.212 s 那一下 → 0.092 s；+9.7 dB。成品 -2.3 dBTP，瞬时响度最大 -24.4 LUFS |
| pop.mp3 | Happy Pop 1 | https://pixabay.com/sound-effects/film-special-effects-happy-pop-1-185286/ | floraphonic | Pixabay Content License | 2026-11-14 用户批准下载（非商用项目）。原档 1.04 s，起音 0.025 s，约 0.17 s 衰减到底。取 [0.02, 0.30]，2 ms 淡入、尾部 0.1 s 淡出 → 0.28 s；+2.9 dB（受峰值限制）。成品 -2.3 dBTP，瞬时响度最大 -17.9 LUFS（与 catch 的 -17.4 相当；文件短于 0.4 s，积分响度无意义） |

## 尚无素材

| 文件 | 说明 |
|---|---|
| stirfry-loop.mp3 | 翻炒循环：本轮只选了下锅单次声，没有选翻炒循环。候选仍在搜集目录 `03-veg-sizzle/`（如 Frying vegetables 60865，66 s，带锅铲翻动）。 |
| pour.mp3 | 淋酱汁：素材库里没找到合格录音，按约定留空。 |

## 待用户下载

无。本轮未使用需要登录的站点。
