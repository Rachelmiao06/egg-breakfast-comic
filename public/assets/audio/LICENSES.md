# 音效许可记录

除 stirfry-in.mp3、pour.mp3 两条为 **CC BY 4.0（需要署名，见文末"署名"）** 外，均无需署名；记录仅作内部溯源。来源页面的许可已逐条在站内核对（2026-11-13）。
处理栏：由 `tools/audio_build.sh` 从 `tools/audio_raw/`（原始下载）生成，可重复执行；测量用 `tools/audio_measure.sh`（2026-11-13，未经人耳试听）。响度规则：目标 -18 LUFS，但真峰值限幅不超过 -1 dBTP + 允许量（持续声 6 dB、敲击声 3 dB），所以敲击类达不到 -18。

| 文件 | 原始标题 | 来源 | 作者 | 许可 | 处理 |
|---|---|---|---|---|---|
| room-loop.mp3 | Kitchen room tone day | https://pixabay.com/sound-effects/film-special-effects-kitchen-room-tone-day-61809/ | freesound_community | Pixabay Content License | 取前 40.5 s（重采样 44.1 kHz），在 1 s 附近挑零交叉点旋转（0.984 s）+ 0.5 s 等功率交叉淡化接缝 → 40.0 s 循环；+27.2 dB，限幅器按循环处理（三份相接取中间）；128 kbps。成品 -18.4 LUFS，-4.6 dBTP；回绕采样跳变 0.8× 中位，首尾 20 ms 无凹陷 |
| sizzle-loop.mp3 | Frying Pan Hot Sizzle Loop 1 | https://pixabay.com/sound-effects/film-special-effects-frying-pan-hot-sizzle-loop-1-200912/ | floraphonic | Pixabay Content License | 取前 20.5 s，零交叉旋转（0.980 s）+ 0.5 s 交叉淡化接缝 → 20.0 s 循环；+4.4 dB 并按循环限幅。成品 -20.2 LUFS，-0.5 dBTP；回绕采样跳变 0.3× 中位 |
| chop-loop.mp3 | Knife Cut Veggies Foley 4 | https://pixabay.com/sound-effects/household-knife-cut-veggies-foley-4-211705/ | floraphonic | Pixabay Content License | 末尾补 0.29 s 静音使首尾刀声间隔≈1.05 s，零交叉旋转（0.593 s）+ 0.1 s 交叉淡化（接缝在静音段内）→ 6.526 s 循环；+2.5 dB，按循环限幅。成品 -26.3 LUFS，-2.2 dBTP；首尾 20 ms 无凹陷 |
| stirfry-in.mp3 | Stir fry 07.wav | https://freesound.org/people/LG/sounds/77923/ | LG | CC BY 4.0（需署名） | 2026-11-14 替换（旧版"水滴进热锅"没有食材落锅声，移到 `alt/stirfry-in-water.mp3`，不再加载）。Freesound HQ 预览 mp3（原文件需登录）。原档 17.3 s：0.44–0.48 s 食材一下落进锅（低频冲击），随后滋啦声铺开。取 [0.42, 2.02]，5 ms 淡入、0.6 s 淡出 → 1.6 s；+9.0 dB，限幅。成品 -18.4 LUFS，-2.0 dBTP。由前景 p2d 第 2 帧（菜落进锅）触发 |
| sauce-stir-loop.mp3 | Spoon Stir in Bowl | https://pixabay.com/sound-effects/household-spoon-stir-in-bowl-437705/ | u_xg7ssi08yr | Pixabay Content License | 取 [0.80, 18.70]（两端都在勺声间隙），零交叉旋转（0.620 s）+ 0.2 s 交叉淡化 → 17.7 s 循环；+2.0 dB（受峰值限制），按循环限幅。成品 -30.2 LUFS，-1.6 dBTP；回绕采样跳变 0.6× 中位 |
| catch.mp3 | soft plop | https://pixabay.com/sound-effects/film-special-effects-soft-plop-97691/ | freesound_community | Pixabay Content License | 取第一声 plop [0.47, 1.07]（起音 0.49 s、峰值 0.52 s），尾部 0.15 s 淡出 → 0.6 s；+6.9 dB（限幅器开延迟补偿，开头不再多出约 4 ms 静音）。成品 -19.6 LUFS，-2.2 dBTP |
| bowl-down.mp3 | Bowl placed on table（Mixkit 条目 1799） | https://mixkit.co/free-sound-effects/kitchen/ | Mixkit | Mixkit Sound Effects Free License | 原档 WAV 16-bit 44.1 kHz，用 ffmpeg 转成 mp3 192 kbps（1.1 s） |
| footsteps-loop.mp3 | 01-24 Footsteps, Rug, Slippers, Slow Pace | https://pixabay.com/sound-effects/film-special-effects-01-24-footsteps-rug-slippers-slow-pace-73912/ | SpliceSound（Freesound）/ freesound_community | Pixabay Content License | 2026-11-14 用户批准下载（非商用项目）。原档 29.86 s 单声道 48 kHz，约 -42 LUFS。取 [0.80, 8.66]（两端在步间），零交叉旋转（0.328 s）+ 0.3 s 交叉淡化 → 7.56 s 循环（6 步 + 回绕处一个步间，跨回绕的步距与文件内一致，约 0.63 s）；+19.1 dB（受峰值限制），按循环限幅；128 kbps。成品 -24.2 LUFS，-2.4 dBTP；回绕采样跳变 0.2× 中位，首尾 20 ms 无凹陷 |
| chop-hit.mp3 | Knife Cut Veggies Foley 4（与 chop-loop 同一原档） | https://pixabay.com/sound-effects/household-knife-cut-veggies-foley-4-211705/ | floraphonic | Pixabay Content License | 取第二刀 [1.177, 1.437]（起音 1.1793 s，没有切菜前奏，之后无二次撞击），1 ms 淡入、尾部 0.08 s 淡出 → 0.26 s；+2.5 dB（与 chop-loop 同增益）。成品 -2.3 dBTP，起音在文件第 2 ms |
| hop-tap-1.mp3 | Knife Cut Veggies Foley 4（与 chop-loop 同一原档） | https://pixabay.com/sound-effects/household-knife-cut-veggies-foley-4-211705/ | floraphonic | Pixabay Content License | 接蛋前的声音铺垫（listen）：画外右侧蛋在木台面上轻跳落下的"嗒"。取刀碰木案板最轻、前面最安静的一下（峰值 5.850 s，峰值前 -35…-46 dB），[峰值 −2 ms, +90 ms]，1.5 kHz 两级低通去掉刀的金属亮度，2 ms 淡入、0.05 s 淡出 → 0.092 s；+28.7 dB（受峰值限制）。成品 -2.3 dBTP，瞬时响度最大 -22.9 LUFS，起音在第 2 ms |
| hop-tap-2.mp3 | Knife Cut Veggies Foley 4（同上） | https://pixabay.com/sound-effects/household-knife-cut-veggies-foley-4-211705/ | floraphonic | Pixabay Content License | 同上，取峰值 4.683 s 那一下 → 0.092 s；+12.3 dB。成品 -2.3 dBTP，瞬时响度最大 -23.5 LUFS |
| hop-tap-3.mp3 | Knife Cut Veggies Foley 4（同上） | https://pixabay.com/sound-effects/household-knife-cut-veggies-foley-4-211705/ | floraphonic | Pixabay Content License | 同上，取峰值 3.212 s 那一下 → 0.092 s；+9.7 dB。成品 -2.3 dBTP，瞬时响度最大 -24.4 LUFS |
| pop.mp3 | Happy Pop 1 | https://pixabay.com/sound-effects/film-special-effects-happy-pop-1-185286/ | floraphonic | Pixabay Content License | 2026-11-14 用户批准下载（非商用项目）。原档 1.04 s，起音 0.025 s，约 0.17 s 衰减到底。取 [0.02, 0.30]，2 ms 淡入、尾部 0.1 s 淡出 → 0.28 s；+2.9 dB（受峰值限制）。成品 -2.3 dBTP，瞬时响度最大 -17.9 LUFS（与 catch 的 -17.4 相当；文件短于 0.4 s，积分响度无意义） |
| stirfry-stir.mp3 | FOODCook_Carmelized Onions Large Steel Pan Stirring Wooden Spatula Bubbling Medium Heat_001_RambleRecordings | https://freesound.org/people/buzkill/sounds/808520/ | buzkill | CC0 1.0 | 2026-11-14 新增（翻炒）。Freesound HQ 预览 mp3。原档 75.8 s，前 28 s 木铲在钢锅里推洋葱、轻刮锅，5.0 / 11.75 / 14.75 s 有较重敲锅。取 [6.2, 9.4]（三下均匀推铲，最响 -29 dB），0.15 s 淡入、0.7 s 淡出 → 3.2 s；+12.6 dB，限幅。成品 -21.0 LUFS，-2.2 dBTP。由前景 kitchen:action stirfry 开始 / 停止 |
| sauce-stir.mp3 | stirring bowl.wav | https://freesound.org/people/dynamique/sounds/554557/ | dynamique | CC0 1.0 | 2026-11-14 新增（调汁，替代整段循环 sauce-stir-loop）。Freesound HQ 预览 mp3（单声道，标签：木勺、玻璃碗、液体、搅拌）。原档很轻（-34 LUFS，底噪约 -62 dB）。取 [9.95, 12.55]：0.15 / 0.75 / 1.65 s 前两下碰碗落在前景两圈（约 1.25 s）里；afftdn 降噪 10 dB、高通 120 Hz，0.08 s 淡入、0.4 s 淡出 → 2.6 s；+18.3 dB（受峰值限制）。成品 -24.1 LUFS，-2.2 dBTP。由前景 kitchen:action sauceStir 开始 / 停止。液体搅动的成分较弱，以木勺碰碗为主 |
| pour.mp3 | Pouring oil (SoundAction 072) | https://freesound.org/people/alexarje/sounds/721754/ | alexarje（Alexander Refsum Jensenius） | CC BY 4.0（需署名） | 2026-11-14 新增（淋汁）。Freesound HQ 预览 mp3。原档 44 s：0.95 s 起是细细一股油流（宽带、柔和），3.2 s 后变成一下一下的咕嘟（大流量，不用）。取 [0.85, 2.05]，高通 150 Hz，0.08 s 淡入、0.35 s 淡出 → 1.2 s；+23.5 dB，限幅。成品 -18.5 LUFS，-1.8 dBTP，播放电平 0.25。在 p4c（勺子淋汁格）进入阅读位置后 0.9 s 播 |
| egg-hop.mp3 | Wet Splat 2.mp3 | https://freesound.org/people/nebulasnails/sounds/495117/ | nebulasnails | CC0 1.0 | 2026-11-14 新增（开场蛋落回锅面）。Freesound HQ 预览 mp3。原档 0.55 s，起音 0.025 s。取 [0.02, 0.20]，两次 2 kHz 低通把"啪"压成很软的"噗"，2 ms 淡入、0.08 s 淡出 → 0.18 s；按峰值 +5.5 dB。播放电平 0.16，每次音高 ±6%、电平 ±1.5 dB，两次至少隔 1.8 s |
| egg-rice.mp3 | soft plop（与 catch.mp3 同一原档） | https://pixabay.com/sound-effects/film-special-effects-soft-plop-97691/ | freesound_community | Pixabay Content License | 2026-11-14 晚新增（蛋被铲子放到饭上，p4b）。原档第二声 plop（2.04 s 起音）：取 [2.035, 2.45]，2.5 kHz 低通，2 ms 淡入、0.15 s 淡出 → 0.415 s；+5.6 dB，限幅。"碗放到桌上"另用 bowl-down（只在 p4e） |
| bag-rustle.mp3（**未接入**：对应格子是静态图，不加载） | FOLEY_Handling paper bag_1.wav | https://freesound.org/people/WilliamJMeyer/sounds/495911/ | WilliamJMeyer | CC0 1.0 | 2026-11-15 新增（备菜 p1a 俯身拿购物袋）。Freesound HQ 预览 mp3。取 [8.6, 10.2] 纸袋窸窣，高通 100 Hz，0.08 s 淡入、0.5 s 淡出 → 1.6 s；+20.6 dB，限幅 |
| bag-down.mp3（**未接入**：对应格子是静态图，不加载） | Grocery Drop.mp3 | https://freesound.org/people/shelbyshark/sounds/521219/ | shelbyshark | CC0 1.0 | 2026-11-15 新增（备菜 p1b 购物袋落到台面）。Freesound HQ 预览 mp3。取 [1.90, 3.05]（窸窣 + 2.20 s 落台面 + 余响），高通 60 Hz，0.35 s 淡出 → 1.15 s；−4.9 dB，限幅；混音器从 0.2 s 开始播 |
| veg-table.mp3（**未接入**：对应格子是静态图，不加载） | Sound 12_ Cutting on wooden board | https://freesound.org/people/jas88/sounds/754354/ | jas88 | CC0 1.0 | 2026-11-15 新增（备菜 p1d 把菜摆到桌上）。Freesound HQ 预览 mp3。取 [1.05, 1.95] 三下很轻的木头碰触，高通 80 Hz，0.25 s 淡出 → 0.9 s；+15.5 dB |
| veg-board.mp3（**未接入**：对应格子是静态图，不加载） | cutting_board_02.wav | https://freesound.org/people/allanox/sounds/444308/ | allanox | CC0 1.0 | 2026-11-15 新增（备菜 p2a 把菜放到案板上）。Freesound HQ 预览 mp3。取 [6.10, 7.15] 两下"放下 + 轻滑"的木板声，高通 80 Hz，0.15 s 淡出 → 1.05 s；+13.8 dB；混音器从 0.15 s 开始播 |
| board-scrape.mp3（**未接入**：对应格子是静态图，不加载） | cutting board chops scrapes.flac | https://freesound.org/people/TRP/sounds/577779/ | TRP | CC0 1.0 | 2026-11-15 新增（备菜 p2c 刀面推切好的菜）。Freesound HQ 预览 mp3。原档后半段是"刀一碰 + 刀面推菜"的轻刮（底噪约 −80 dB）。取 [37.85, 39.75] 两下推菜，高通 120 Hz，0.3 s 淡出 → 1.9 s；+32.2 dB（源很轻），限幅 |
| veg-bowl.mp3（**未接入**：对应格子是静态图，不加载） | rice falling into a rice bowl.MP3 | https://freesound.org/people/macdaddyno1/sounds/421934/ | macdaddyno1 | CC0 1.0 | 2026-11-15 新增（调汁段 p3b 把菜舀进饭碗）。Freesound HQ 预览 mp3。原档是米粒落进金属碗：取 [1.65, 2.45] 三小下，两次 3 kHz 低通压掉金属碗的振铃，0.25 s 淡出 → 0.8 s；+21.2 dB。之后 1.2 s 由 bowl-down（gain 0.5）接"碗轻放" |

## 尚无素材

| 文件 | 说明 |
|---|---|
| stirfry-loop.mp3 | 翻炒循环：不用循环。翻炒改为一段 3.2 s 的 stirfry-stir.mp3，跟前景动作开始 / 停止。 |

## 待用户下载

Freesound 原文件（wav / flac）需要登录，本轮用的是公开 HQ 预览 mp3（约 150–230 kb/s）。觉得有压缩感时，登录后下载原文件放进 `tools/audio_raw/`（同名，扩展名可改）重跑 `tools/audio_build.sh`：77923、808520、554557、721754、495117（链接见上表）。

## 署名（CC BY 4.0，网页上需要可见的署名）

- "Stir fry 07.wav" by LG — https://freesound.org/people/LG/sounds/77923/ — CC BY 4.0 — 裁切、淡入淡出、响度处理（stirfry-in.mp3）
- "Pouring oil (SoundAction 072)" by alexarje (Alexander Refsum Jensenius) — https://freesound.org/people/alexarje/sounds/721754/ — CC BY 4.0 — 裁切、高通、淡入淡出、响度处理（pour.mp3）

许可原文：https://creativecommons.org/licenses/by/4.0/ 。网页上的署名：声音按钮左边的「音效致谢」按钮，点开列出标题、作者、来源链接、许可链接和"已裁剪并调整响度"（SoundToggle.tsx，2026-11-14 晚）。

## 配乐（music/）

`music/` 下 19 个文件（8 条循环 stem + 11 个 stinger）全部由 `tools/music_build.py` 用 numpy / scipy 原创合成，没有任何第三方采样或旋律，不涉及版权和署名；重新渲染：`python3 tools/music_build.py`。编排说明与场景对应见 `docs/SOUND-DESIGN.md`，运行时规则见 `src/components/kitchen/useKitchenMusic.ts`。未经人耳试听。

## 人声语气词（voice/）

`voice/mom-*.mp3` 由 ElevenLabs（eleven_v4，声音 Yating Lin - Relaxed & Spontaneous，库内声音）生成，用户本人账号（免费额度）；原始文件在 `tools/voice_raw/`。**商用 / 公开发布前请核对 ElevenLabs 对应套餐的使用条款**（免费额度通常要求署名、不含商用授权）。
