# 音效文件约定

来自素材库的现成录音（Pixabay / Mixkit / Freesound CC0 优先），不在代码里合成。
每加一个文件，在 LICENSES.md 记一行：文件名、来源链接、作者、许可、处理。段落衔接见 docs/DESIGN.md §7。

| 文件名 | 用途 | 方式 | 要求 | 现状 |
|---|---|---|---|---|
| room-loop.mp3 | 厨房环境底声，全程连续 | 循环 | 很轻，无明显事件 | 20.0 s，冰箱底声 |
| sizzle-loop.mp3 | 煎蛋滋滋（开场、发现跳蛋、接蛋前） | 循环 | 8–20 s，首尾无缝 | 14.0 s，煎蛋录音 |
| chop-loop.mp3 | 切菜哒哒 | 循环 | 节奏轻快、不刺耳 | 9.16 s |
| stirfry-in.mp3 | 配菜下锅"滋啦" | 单次 | < 2 s | 1.9 s |
| stirfry-loop.mp3 | 翻炒 | 循环 | | 18.47 s，炒锅翻饭 |
| sauce-stir-loop.mp3 | 搅汁轻响（勺碰碗） | 循环 | 很轻 | 26.76 s |
| catch.mp3 | 蛋落到锅铲上的轻响 | 单次 | 柔软，< 1 s | 0.6 s |
| bowl-down.mp3 | 饭碗落桌 | 单次 | < 1 s | 0.85 s |
| pour.mp3（以后） | 淋酱汁 | 单次 | | 未提供（静音） |

统一 mp3（44.1 kHz，VBR）。响度大致统一到 -18 LUFS（实测 -18.0 到 -18.8），真峰值 ≤ -1.3 dBTP；代码里只做淡入淡出，相对音量由节拍表决定。

## 播放方式

`src/components/kitchen/useKitchenAudio.ts` 用 Web Audio 播放：循环声是采样级无缝循环（AudioBufferSourceNode.loop），解码后会裁掉首尾的编码器填充；音量用 GainNode 平滑。所以循环文件**首尾必须本身就能接上**，用 `tools/audio_build.py` 的交叉淡化接缝生成，不要手工剪。

## 制作与测量

```
bash tools/audio_fetch.sh /tmp/某个新的空目录     # 下载原始录音（公开地址，无需登录）
python3 -I tools/audio_build.py /tmp/那个目录      # 生成本目录的成品和 alt/ 备选
python3 -I tools/audio_measure.py                  # 响度、真峰值、底噪、接缝跳变
```

## 试听

开发服务器跑起来后，单独听一条：`http://localhost:<端口>/assets/audio/sizzle-loop.mp3`；
备选在 `alt/` 下（`alt/sizzle-loop-fish.mp3` 等，说明见 LICENSES.md）。
随滚动的整体效果：打开 `/dev/beats`，点右下角声音按钮，慢慢滚动。
