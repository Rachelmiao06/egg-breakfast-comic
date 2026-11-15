# p2b 切菜格 握刀姿态重画需求（第三版，给 ChatGPT）

## 为什么重画
2026-11-15 用户试过上一批（`inpanel-v2/B-p2b`）：左手比右手小一圈、袖口悬在画面边缘、没有从围裙/身体一侧伸出来，看着手臂是断的。已撤回，现在用的是原图（`A-chopping` 第 1 帧）拆出来的手和刀，动作是刀尖留在案板上、刀跟连手抬起再压下。
这一版要的是：**以原图为底，只改握刀的手的姿态**，手的大小、袖子、袖口到身体的连接都不变。

## 参考图（每次都附上）
1. **构图基准（原图第 1 帧，1542×1020）**：
`/Users/mac/dev/egg-breakfast-comic/.claude/worktrees/grid-animation-fixes-951c87/source/comic-v4-frames/A-chopping/frame-01.png`
2. 原图第 2、3 帧（手和刀在切的过程中的另外两个位置）：同目录 `frame-02.png`、`frame-03.png`
3. 现有拆层（运动层 = 握刀的手+袖口+刀，其余是底图）：
`/Users/mac/dev/egg-breakfast-comic/.claude/worktrees/grid-animation-fixes-951c87/public/assets/comic-v4/layers/p2b-base.webp`（去掉握刀手后的底图）、`p2b-part.webp`（握刀的手+刀，透明）、`p2b-front.webp`（盖在手上面的对白泡、扶菜的手等）

## 通用规则（每条 prompt 开头带上）
Use the attached frame-01 as the exact reference for composition, scale, style, colors and every object's position. Same hand-drawn warm storybook comic style, soft watercolor shading, clean dark-brown outlines about 3px. Output canvas 1542×1020 px, identical framing to frame-01. No outer frame, no dark border line, no rounded corners, no margin: the artwork runs fully to all four edges. Do not redraw, restyle, move or resize anything that is not listed as changed.

HARD CONSTRAINTS about the knife hand (these were wrong last time):
- The knife hand must stay exactly the same size and shape as in frame-01 (same size as the other hand). Do not make it smaller or younger-looking.
- The arm must keep its connection to the body: the same puffy cream sleeve, entering from the same place at the left edge and coming from behind/out of the olive apron area exactly as in frame-01. No floating cuff, no detached forearm.
- The tip of the knife stays on the cutting board at the same point as in frame-01 (touching the carrot's top edge just left of the guide hand's fingers). Only the heel (handle end) and the hand move up and down.

## 要生成的图

### 一、握刀手的 4 个姿态（透明层，每张只画：袖子+握刀的手+刀，其余全透明）
画布同上。姿态由低到高，刀尖位置不变：
- K0：和 frame-01 完全一样（刀压下，刀刃和案板夹角约 20°）。
- K1：刀跟抬高一点（夹角约 28°），手随之抬高约 2% 画面高。
- K2：再抬（夹角约 36°），手抬高约 4%。
- K3：最高（夹角约 45°），手抬高约 6%，手腕略弯，袖口褶皱随之微动。
四张的袖口褶皱、手形、描边颜色一致。

### 二、对应的"去掉握刀手"的底图（不透明，1 张）
和 frame-01 一样，但去掉握刀的手、袖口和刀，被遮住的位置补上延续的围裙、背景，不要糊。保留扶菜的手、胡萝卜、案板、对白泡和"哒、哒、哒"、案板上的菜丁和动感线。

### 三、胡萝卜被切的 3 个状态（可选，不透明整格，3 张）
和二一样的底图（无握刀手），仅胡萝卜和案板上的菜丁不同：
- C0：整根胡萝卜（同 frame-01），案板上只有三颗丁。
- C1：左端被切掉约三分之一，案板上丁增多到 12 颗左右。
- C2：只剩约一半，丁堆成小堆（约 25 颗）。
**注意**：扶菜的手和袖子**不要移动**，位置和 frame-01 完全一样；胡萝卜只从左端被切短（切口贴着扶菜手指的左边，因为切菜就是贴着指节下刀）。这样握刀手不用跟着重新对位。

## 交付
`p2b-K0.png` … `p2b-K3.png`、`p2b-base-nohand.png`、`p2b-C0.png`…`p2b-C2.png`（可选），发目录路径。
