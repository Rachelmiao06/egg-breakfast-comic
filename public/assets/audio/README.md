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
