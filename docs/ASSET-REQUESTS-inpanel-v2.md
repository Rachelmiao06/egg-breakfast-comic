# 格内动画素材需求（第六版，给 ChatGPT 生成）

通用参考图（每次都附上）：
- `p2d-clean-base.png`（干净底图，2184×720）
- `p2d-hand-spatula.png`（木铲＋手，透明）

## 通用规则（每条 prompt 开头都带上）

Use the attached images as exact style and position references. Same hand-drawn warm storybook comic style: soft watercolor-like shading, clean dark-brown outlines about 3px thick, warm colors, mint-green tile background. Output canvas 2184×720 px (aspect 3.03:1), identical framing to the reference, every object in exactly the same place and scale as in the reference. Do not redraw, restyle, move, crop or resize anything that is not listed as changed. No drop shadows, no glow, no text other than what already exists. Transparent layers: PNG with true alpha, hard clean edges (no white or magenta halo, no semi-transparent fringe), and nothing at all outside the described object.

---

## A. p2d 配菜入锅（先做 A1、A3、A4）

### A1 案板上的菜堆（透明层）
Transparent PNG, 2184×720, same position as the reference board. Only the pile of chopped vegetables lying on the tilted wooden cutting board: orange carrot cubes, yellow corn kernels, green scallion rings, loosely heaped, roughly 55 pieces, sitting on the board's upper surface in the middle area, the lower edge of the pile about a hand-width above the board's lower edge. Cubes sharp-cornered with a lighter top face and darker side faces, kernels glossy, scallion rings hollow with visible inner ring. Dark-brown outline on every piece. Everything else fully transparent (no board, no pan, no spatula).

### A2 菜堆被推动（透明层 ×2）
Same as A1, same canvas and same board, but:
- A2a: the pile has slid about 40% down the board toward the lower-left edge, spread out wider and thinner, a few pieces scattered ahead of it, one or two pieces tipping over the board's lower edge.
- A2b: only 5–7 stray pieces remain near the board's lower edge.
Everything else fully transparent.

### A3 掉落的单颗菜（透明，小图，各自单独一张，每张 256×256 透明 PNG）
Nine separate transparent PNGs, each one piece centered, same drawing style and outline as A1, slightly larger than in the board pile (about 1.3×):
- carrot cube ×3 (three different rotations)
- corn kernel ×3 (three different tilts)
- scallion ring ×3 (one flat-ish ring, two tilted rings)
No motion blur, no shadow.

### A4 入锅后的锅内菜面（完整不透明图）
Full opaque 2184×720 image identical to `p2d-clean-base.png` (same board, bubble, tiles, pan, bubble text) except the vegetables inside the pan: they are now clearly more, heaped into a soft mound that fills the pan's lower half, mixed carrot cubes, corn kernels and scallion rings, the pile top reaching about one third up the visible inner pan wall. Pan inner wall stays clean dark grey. Everything outside the vegetables must be pixel-identical to the reference.

### A5 木铲＋手的两个姿态（透明层 ×2）
Same canvas and same hand and wooden spatula as `p2d-hand-spatula.png` (same hand shape, same sleeve-less wrist cut at top edge, same spatula design, wood grain, outline). Only the pose changes:
- A5a 探进菜堆: the spatula head pushed lower and to the right (toward the board), spatula blade almost flat against the board surface, hand slightly lower and further right.
- A5b 推回来: the spatula pulled back to the lower-left, blade tilted up about 10° at the tip, hand slightly higher and further left.
The hand stays attached at the top edge of the canvas (wrist leaves the frame), nothing else drawn.

---

## B. p2b 切菜格（建议，让切的动作自然）

Reference: the current frame `public/assets/comic-v4/frames/p2b-f1.webp` (attach it) and layers `p2b-base.webp`, `p2b-part.webp`.

### B1 干净底图（完整不透明图）
Same image as the reference frame, but remove the knife and the hand holding it (the left hand); keep the sleeve and apron, the other hand holding the carrot, the carrot, the cutting board, the diced carrot pieces, the speech bubble and its text "哒、哒、哒", the motion ticks. Fill the area behind the removed hand and knife with continuous apron and cutting-board texture, no smears.

### B2 握刀的手＋刀，三个姿态（透明层 ×3）
Same canvas and framing as B1, only the hand gripping the small kitchen knife (same hand, sleeve cuff, wooden handle, steel blade, outlines):
- B2a 抬起: knife tip stays on the board at the same point, heel and hand raised about 10° (handle up).
- B2b 中间: raised about 4°.
- B2c 压下: blade pressed down into the carrot, tip at the same point, handle slightly forward and lower.
Transparent background, nothing else.

### B3 胡萝卜逐步被切（完整不透明图 ×3）
Same as B1 but the carrot under the other hand is progressively shorter and the pile of diced pieces on the board grows:
- B3a 整根胡萝卜（和参考一致，丁少）。
- B3b 切掉约一半，丁增多。
- B3c 基本切完，只剩一小截，丁堆成小堆。
The holding hand moves with the carrot (stays pressing on the remaining carrot piece).
