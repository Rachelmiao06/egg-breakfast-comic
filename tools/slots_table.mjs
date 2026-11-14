// 从预览路由的 slots.json + beats.visual-v2.json 生成 docs/ASSET-SLOTS.md（素材对应表）。用法：node tools/slots_table.mjs
import { readFileSync, writeFileSync } from "node:fs";
const R = "src/app/preview/visual/";
const slots = JSON.parse(readFileSync(R + "slots.json", "utf8"));
const beats = JSON.parse(readFileSync(R + "beats.visual-v2.json", "utf8")).beats; // 默认动效（v2）
const man = JSON.parse(readFileSync("public/assets/comic-v3/manifest.json", "utf8"));
let md = `# 素材对应表（由 \`node tools/slots_table.mjs\` 生成，不要手改）

换图只改 \`src/app/preview/visual/slots.json\`：把 \`src\` 指向新文件即可，**比例在页面里按图片实际尺寸自动读取**，不必重排全页。\`x / y / w\` 是试验版位（vw / vh），\`aspect\` 只是图片加载前的占位比例，不是规格。原图在 \`source/comic-v3/\`（桌面 \`new pics\` 文件夹的副本，原件未动），单格由 \`tools/prepare_comic_v3.py\` 切出，未缩放、未改画面。

## 段落与画格

| # | 场景编号 | 段落 | 画格 | 来源 | 原始尺寸 | 对白在图内 | 版位 x,y,w | 进场 |
|---|---|---|---|---|---|---|---|---|
`;
for (const b of beats) {
  const ps = slots.panels.filter((p) => p.beat === b.id).sort((a, c) => (a.order ?? 0) - (c.order ?? 0));
  if (b.id === "catch") {
    const c = slots.scene.catch; const k = "p3e";
    md += `| ${b.n} | \`${b.id}\` | ${b.title} | ${k}（场景层） | ${c.source} | ${man[k].size.join("×")} | 是 | 场景像素 box ${c.box.join(",")} | 随蛋起飞出现 |\n`;
    continue;
  }
  if (!ps.length) { md += `| ${b.n} | \`${b.id}\` | ${b.title} | — | 只有厨房 | | | | |\n`; continue; }
  ps.forEach((p, i) => {
    const k = p.key; const sz = man[k] ? man[k].size.join("×") : "—";
    md += `| ${i ? "" : b.n} | ${i ? "" : "`" + b.id + "`"} | ${i ? "" : b.title} | ${k} | ${p.source ?? "占位"} | ${sz} | ${p.dialogueInImage === true ? "是" : p.dialogueInImage === false ? "无对白" : "—"} | ${p.x},${p.y},${p.w} | ${p.from} |\n`;
  });
}
const c = slots.scene.catch;
md += `
## 跨景接蛋定位点（可调）

| 项 | 当前值 | 说明 |
|---|---|---|
| 接蛋格 box | ${c.box.join(", ")}（场景像素 x, y, w, h） | 第 3 页 E 格放在厨房场景层，与蛋同一坐标 |
| 铲面落点 land | fx ${c.land.fx}, fy ${c.land.fy}（格内相对位置） | 由 p3e 实测铲头中心（0.81, 0.476）略上移到铲面；落点 = box + land |
| 蛋在铲面的缩放 | ${slots.egg.onSpatulaScale} | 相对后景蛋的显示尺寸 388 |
| 出现时机 appearFlight | ${(c.appearFlight ?? []).join(" → ")} | 蛋先起飞，飞到这一区间时这一格才出现（她惊讶伸铲） |
| 框线层 frameSrc | ${c.frameSrc ?? "无（框线画在图里，蛋压在整格之上越过）"} | |
| 锅铲前沿遮挡 occluderSrc | ${c.occluderSrc ?? "缺（蛋压在铲面上方）"} | 有图时放在蛋之上 |

调试：打开 \`/preview/visual?debug=1\`，右上角可以现场改 box / land / 缩放，"复制 JSON"后贴回 slots.json。
`;
writeFileSync("docs/ASSET-SLOTS.md", md);
console.log("docs/ASSET-SLOTS.md written");
