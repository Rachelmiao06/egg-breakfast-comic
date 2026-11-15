# p5e 妈妈"回头"表演的出图需求（给 ChatGPT）

## 要的效果（用户 2026-11-15）
p5e（妈妈走在走廊里，回头看到远处饭桌上碗里的蛋）现在是一张静图。想做成三拍：
1. **蛋先招手**：妈妈还背对着、往走廊走，没发现；远处饭桌碗里的蛋先挥手。
2. **身体再回头**：妈妈身体和头转过来（中间有一个半转的过渡姿势）。
3. **额头出现三条符号**：落在现在 p5e 的最终姿势上，头旁边弹出三条"！"惊讶线（现图里已有，要单独成层）。

## 参考图（每次都附上）
- 现有 p5e（最终姿势、画风、人物、构图以它为准）：`public/assets/comic-v3/p5e.webp`
- 上一格 p5d（碗里的蛋在叫）：`public/assets/comic-v3/p5d.webp`
- 整页原稿：`source/comic-v3/05-looking-for-baby.png`

## 通用规则（每条 prompt 开头带上）
Use the attached p5e as the exact reference. Output canvas 1600×1700 px (aspect 0.9421:1), identical framing, camera, hallway, door frame, ceiling lamp, picture frame, plant, table, chair and bowl as in the reference. Same hand-drawn warm storybook comic style, soft watercolor shading, thick dark outlines. IMPORTANT: no outer frame, no dark border, no rounded corners, no margin: the artwork runs fully to all four edges. Only the character pose / the described element may change; everything else must stay pixel-identical to the reference so the images can be blended without ghosting. Do not move or resize the doorway, table, bowl or the mother's feet position.

## 一、整格（不透明，4 张）
- **T0 背对**：妈妈完全背对观众、面朝走廊深处，正在往前走（头朝前，看不到脸，一只脚在前）。碗里的蛋静止、闭眼睡着一样。其余同参考。
- **T1 蛋招手**：和 T0 完全一样的妈妈，只有碗里的蛋举起一只手（小幅）。（也可以只出"碗里的蛋"透明层，见下）
- **T2 半转**：妈妈身体转了一半，头转向肩后，脸只露出侧面（约 3/4 侧），眼睛刚睁大；还没有惊讶线。
- **T3 最终**：就是现在的 p5e，但**不带三条惊讶线**（线单独成层）。

## 二、透明层（和整格同画布同位置，其余全透明，3 张）
- **L1 蛋招手层**：只有碗里那颗蛋举手的样子（两到三个姿势更好：手放下 / 举高 / 略放低），蛋本身位置、大小不变；用来循环挥手。
- **L2 惊讶线**：现在 p5e 头右上方的三条黑线，单独成透明层；再给一张 **L2b**：三条线略长一点、略往外（做"弹出"的一下过冲）。

## 交付
`p5e-T0.png`、`p5e-T1.png`（可选）、`p5e-T2.png`、`p5e-T3.png`、`p5e-L1a.png`、`p5e-L1b.png`、`p5e-L1c.png`、`p5e-L2.png`、`p5e-L2b.png`，发目录路径。

## 我这边怎么接
- 时间线（真实时间，只播一次，回滚到进入前复位；格子在阅读位才开始）：0 s 背对 → 0.4 s 蛋开始招手（L1 循环，约 1.2 s）→ 1.4 s 身体转（T0 → T2 → T3 硬切或短交叉淡化，只取"人物"一块羽化区域，背景永远是 T3）→ 2.2 s L2 弹出（L2b → L2，带一点过冲）→ 停住。
- 触发走现有的 `useStage`（可见 ≥ 90% 才播，离场收住），和 p6e 同一套规则；读格时间在节拍表里写 `readS`（约 3 s），`motion.v2.ts` 会自动把这一段拉到够长。
- 如果配准后人物姿势差别太大、背景对不上，我会直接告诉你哪张不对，不硬接。
