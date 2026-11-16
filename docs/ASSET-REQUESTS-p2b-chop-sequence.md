# p2b 切菜格"整格序列帧"出图需求（给 ChatGPT）

2026-11-15 用户给截图要给切菜格做动画，格式和 p4d / p5e / p6a 一样：一组同画布整帧 + timeline，我这边接成滚动带动的序列。

## 这一格是哪张图
- 格 key：`p2b`，节拍 `chop`（"切菜"）。
- 现在用的图：`public/assets/comic-v4/frames/p2b-f1.webp`，1400×932（比例 1.5024）。
- 原稿：`new pics/A-chopping frame-01`；旧的分层动画图在 `public/assets/comic-v4/layers/p2b-base / part / front.webp`（用户觉得动作不自然，要整帧重画）。
- 对白泡是另一层（`p2b-front`），**出图里不要画对白泡**。

## 每次都要附的参考图
`/Users/mac/dev/egg-breakfast-comic/.claude/worktrees/ponpon-mania-animation-guide-483f0c/public/assets/comic-v4/frames/p2b-f1.webp`
（另一张可附：`p2b-f2.webp`、`p2b-f3.webp`，是之前的备用姿势。）

## Prompt（整段复制，附上参考图）
```
Use the attached image as the exact reference: same mother, same hand-drawn warm storybook comic style, soft watercolor shading, thick dark-brown outlines, same mint-green tiled wall, same wooden counter, wooden cutting board, small corn bowl on the left, rice bowl on the right, same green scallions and the same whole carrot on the board.

Make a SEQUENCE of 8 separate images of the same panel, one per animation frame. Every frame: canvas 1536×1024 px (aspect 1.5:1), identical framing and camera, identical background, identical mother face / hair / earrings / apron / sleeves, identical bowls and cutting board position. The artwork runs fully to all four edges: NO outer frame, NO border, NO rounded corners, NO speech bubble, NO text. Only the elements named below may change from frame to frame; everything else must stay pixel-identical to the reference so the frames can be cross-faded without ghosting.

Action: the mother is chopping the scallions with a kitchen knife in her right hand (the viewer's left), while her left hand (the viewer's right) rests flat on the whole carrot to hold it. Her head stays almost still, eyes looking down at the board, small content smile; only a tiny nod (a few pixels) on each cut. Both hands and both arms must stay the same size and come out of the sleeves naturally from her body (do not shrink one hand, do not leave a sleeve floating, no cut-off arm). The knife tip stays on the board; the knife heel and the hand lift up and press down like a real rocking chop. Show the knife blade clearly in the frames where it is raised.

Frame list (scallion state in brackets):
F1  rest: knife resting on the board beside the scallions, hand just gripping it. [3 whole scallions]
F2  knife raised about 3 cm above the board, blade angled, tip on the board. [3 whole scallions]
F3  knife pressed down, first cut made; the scallion tip end separated into 2–3 small round slices, slices slightly scattered. [slightly shorter scallions + 3 slices]
F4  knife raised again (same as F2) but scallions now clearly shorter; the head nods very slightly down. [shorter scallions + 3 slices]
F5  knife pressed down, second cut; more slices appear. [~6 slices]
F6  knife raised. [~6 slices]
F7  knife pressed down, third cut; a small neat pile of green slices next to the remaining scallion stalks. [~9 slices]
F8  knife lifted slightly and relaxed, mother glances up a little with a gentle smile (eyes still mostly on the board). [neat pile of ~9 slices, remaining scallion stalks, carrot untouched]

The carrot, corn bowl and rice bowl never change. Do not add new objects. Keep the same lighting.
```

## 交付
`frame-01.png` … `frame-08.png`（同一画布、同一尺寸），再附一个 `timeline.txt`（每帧停留秒数，可沿用 p6a-delivery 的格式）。发目录路径即可。

## 我这边怎么接（供出图时对照）
- 滚动带动（SeqPanel）：慢滚一帧一帧走，倒滚倒着走。
- 建议时间线（秒）：F1 0 → F2 0.35 → F3 0.5 → F4 0.8 → F5 0.95 → F6 1.25 → F7 1.4 → F8 1.9，末帧再停 1 s。每一"刀"约 0.45 s（抬 0.3 s + 切 0.15 s）。
- 节拍表里 chop 已有 `readS`，这一段会按动画长度自动留够滚动距离。
- 对白泡仍走原来的 `front` 层，叠在序列上面。
- 配准不上（人物位置、手大小对不齐）我会直接说哪几张不行，不硬接。
