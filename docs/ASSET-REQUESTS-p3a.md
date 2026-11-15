# p3a 调酱汁格 新图需求（给 ChatGPT）

## 为什么要新图
现在是把"整条手臂（袖子+手+勺）"当一张贴图绕肩膀转着平移，所以手臂是刚体，勺子在酱汁里的位置对不上、酱汁表面也不动，看着像贴纸在晃。
自然的搅拌需要：勺子在碗里**一圈不同位置的真姿态**、酱汁表面**随勺子转的漩涡**，以及不动的干净底图。

## 参考图（每次都附上）
1. 原格第 1 帧（构图基准，967×961）：
`/Users/mac/dev/egg-breakfast-comic/.claude/worktrees/grid-animation-fixes-951c87/source/comic-v4-frames/C-sauce/frame-01.png`
2. 原格第 2、3 帧（勺子在碗里的另外两个位置，参考搅动的幅度）：
`.../source/comic-v4-frames/C-sauce/frame-02.png`、`frame-03.png`（同目录）
3. 现有拆层：干净底图 `public/assets/comic-v4/layers/p3a-base.webp`，运动部件 `p3a-part.webp`，遮挡层 `p3a-front.webp`（同仓库绝对路径前缀）
4. 画风参考：你已生成的 p2b 底图
`/Users/mac/Documents/Codex/2026-11-14/new-chat-2/mom-egg-rice-comic/animation-assets/inpanel-v2/B-p2b/B3a-carrot-whole.png`

## 通用规则（每条 prompt 开头带上）
Use the attached images as exact style and position references. Same hand-drawn warm storybook comic style: soft watercolor-like shading, clean dark-brown outlines about 3px, warm colors, mint-green tile background. Output canvas 2012×2000 px (aspect 1.006:1), identical framing, scale and object positions to frame-01 (the bowl, bottles, apron, table and the hand holding the bowl all in exactly the same place). IMPORTANT: no outer frame, no dark border line, no rounded-corner frame, no margin: the artwork runs fully to all four canvas edges. Do not redraw, restyle, move or resize anything that is not listed as changed. No drop shadows or glow, no new text. Transparent layers: PNG with real alpha, hard clean edges, no white or magenta halo, nothing outside the described object.

## 一、干净底图（不透明，1 张）
Same as frame-01 but with the stirring arm completely removed: no sleeve, no stirring hand, no wooden spoon. Keep the apron, the other hand holding the bowl rim, the bowl, both bottles, the table and the tiled wall. The area where the arm and sleeve were is filled with continuous apron and wall, no smears. The sauce surface in the bowl is calm: a smooth dark-brown glossy surface with a faint small swirl in the middle, no spoon.

## 二、搅拌手臂 + 木勺的姿态（透明层，6 张）
Only the stirring arm (puffy cream sleeve, hand gripping the wooden spoon handle, the spoon going down into the bowl), everything else transparent. The spoon's tip is under the sauce surface and the spoon enters the sauce at a point that moves around a circle in the bowl, clockwise seen from above (in the picture: left → back-left → back-right → right → front-right → front-left). The shoulder stays fixed at the top edge; the elbow, hand and wrist shift naturally so the arm never just slides: the hand moves in a small oval, the wrist bends a bit, the spoon tilts to follow.
- S1: spoon at the LEFT of the bowl (same as frame-01).
- S2: spoon at the BACK-LEFT.
- S3: spoon at the BACK-RIGHT (spoon nearly upright).
- S4: spoon at the RIGHT (same as frame-03).
- S5: spoon at the FRONT-RIGHT.
- S6: spoon at the FRONT-LEFT.
Keep the sleeve folds, hand shape, outline and colors identical across the six poses.

## 三、酱汁表面漩涡（只画碗里的酱汁，透明层，4 张）
Only the sauce surface inside the bowl (the dark-brown glossy liquid with highlights), shaped exactly like the sauce area in frame-01, everything else transparent. No spoon, no hand. A gentle spiral swirl pattern whose center moves around slightly and whose spiral rotates: swirl frames at 0°, 90°, 180° and 270° of rotation, with a tiny ripple ring near where the spoon enters. Same colors and highlights as the original sauce.

## 四、勺子入酱汁处的遮挡（透明层，1 张，可选）
Only the front wall of the bowl (the cream-colored front rim and body with the green leaf pattern) as an opaque layer at its exact original place, everything else transparent. This is drawn above the spoon so the spoon always goes behind the bowl's front rim.

## 交付
文件名按 `p3a-base.png`、`p3a-S1.png` … `p3a-S6.png`、`p3a-swirl-0.png`、`-90.png`、`-180.png`、`-270.png`、`p3a-bowl-front.png`，发我目录路径就行。

---

# p6e 结尾饭碗格：让蛋黄"流动"（2026-11-15，给 ChatGPT）

用户决定：蛋保持**原来的样子**（`p6e` 原图里的蛋、蛋脸、蛋黄），只让蛋黄流出来的那一段**流动**。上一版生成的蛋黄层画风不对（又厚又灰、盖住了蛋），已移除。
动法：只需要"没有流出部分的底图"+"流出部分单独一层"，代码里让流出部分沿流向从蛋身慢慢"长"出去（遮罩推进，边缘带一点波动），不需要多张叠加，所以**不会重影**。

## 参考图（必附）
1. 原图（含旧字，画风、蛋黄的画法以它为准）：`/Users/mac/dev/egg-breakfast-comic/.claude/worktrees/grid-animation-fixes-951c87/source/comic-v3-edits/p6e-original.webp`（506×372）
2. 已清掉泡内文字的底图：`.../public/assets/comic-v3/p6e-clean.webp`
3. 整页原稿（保证和上下文画风一致）：`.../source/comic-v3/06-recognition-and-punchline.png`

## 要生成的 2 张（同尺寸、同位置）
通用：画布 **1450×1060**（和原图比例 1.393 一致，把原图的构图整体放大，不要外框、不要黑边，铺满四边）；碗、米饭、配菜、蛋白、蛋脸、气泡（泡内为空）、背景都和参考图完全一样的位置和画法，**不要重画蛋脸、不要改蛋的形状和颜色**。

**A. 底图（不透明）**：原图，但蛋黄**还没有流出来**：蛋黄是完整的一颗圆顶（带蛋脸和两个红脸蛋），蛋白边缘完整，右下方流出的那一段蛋黄、以及它压住的米饭和配菜，全部补成"没有被流过"的米饭和配菜（和周围一样的画法，不要糊）。气泡里没有字。

**B. 流出的蛋黄（透明层）**：只画原图里从蛋黄右下破口流出来、淌到米饭和配菜上的那一整段蛋黄（和原图一样的颜色、高光、轮廓、流到的最远位置），其余全透明。起点贴着蛋黄圆顶的破口处。边缘干净，不要白边。

另外如果可以，再给 **C. 蛋黄圆顶的破口版**（不透明，蛋黄圆顶右下角有一个小的破口缺口，里面是深一点的蛋黄色，其余同 A），这样动画一开始蛋黄是"鼓着的"，然后从破口淌出来。

## 交付
`p6e-A-base.png`、`p6e-B-flow.png`（、`p6e-C-base-cracked.png`），发目录路径。
