// 从 src/lib/beats.json 生成 docs/BEATS.md（节拍表的可读版本）。用法：node tools/beats_table.mjs
import { readFileSync, writeFileSync } from "node:fs";

const { beats } = JSON.parse(readFileSync(new URL("../src/lib/beats.json", import.meta.url), "utf8"));
const pct = (v) => `${Math.round(v * 100)}%`;
const total = beats.reduce((s, b) => s + b.lengthVh, 0);
const PH = { enter: "进入", action: "动作", hold: "停留", exit: "退出" };
const EGG = { loop: "锅里循环跳", flight: "飞向锅铲（= 动作阶段进度）", serve: "铲面 → 碗中央（= 动作阶段进度）", bowl: "停在饭上" };

let md = `# 统一场景节拍表

> 由 \`node tools/beats_table.mjs\` 从 \`src/lib/beats.json\` 生成，**不要手改本文件**。改节奏只改 beats.json。
> 实时调节：打开 \`/dev/beats\`，滚动观看，右侧面板拖动每段长度，"复制长度 JSON"后贴回 beats.json。

## 规则

- 全站只有一个节奏来源：滚动位置 → 当前段 + 段内局部进度 p（0–1）+ 阶段 + 阶段内进度。由 \`<ScrollDriver>\` 计算，写进 \`useScene().timeline\`。
- 每段分四个阶段：**进入 → 动作 → 阅读停留 → 退出**，比例写在 phases 里，和为 1。
- 前景（画格、妈妈）、背景（厨房弱化、镜头）、角色（蛋）、声音都只读这份时间轴，用 \`envelope()\`、\`phaseProgress()\`、\`derive()\`、\`loopLevels()\` 推导。**不要另开 ScrollTrigger、不要自己计时决定节奏。**
- 先调每段的**滚动长度**，再调被触发后按秒播放的小动作（seconds）。
- 声音：**循环声**是该段稳定音量，进入阶段从上一段渐变过来；**渐变声**在指定阶段内从 from 到 to；**单次音效**在向下滚过段内进度 at 时播一次，回滚不播。

总长 **${total}vh**（约 ${(total / 100).toFixed(1)} 屏）。

## 段落总览

| # | 段 | 长度 | 进入 / 动作 / 停留 / 退出 | 厨房弱化 起→停→止 | 蛋 |
|---|---|---|---|---|---|
`;
for (const b of beats) {
  md += `| ${b.n} | ${b.title} | ${b.lengthVh}vh | ${["enter", "action", "hold", "exit"].map((k) => pct(b.phases[k])).join(" / ")} | ${b.kitchenDim.join(" → ")} | ${EGG[b.egg]} |\n`;
}
md += `\n## 每段明细\n`;
for (const b of beats) {
  const loops = Object.entries(b.audio.loops).map(([k, v]) => `${k} ${v}`).join("、") || "—";
  const fades = b.audio.fades.map((f) => `${f.sound} ${f.from}→${f.to}（${PH[f.phase]}阶段）`).join("、") || "—";
  const shots = b.audio.oneshots.map((o) => `${o.sound} @ p=${o.at}`).join("、") || "—";
  const secs = Object.entries(b.seconds).map(([k, v]) => `${k} ${v}s`).join("、") || "—";
  let acc = 0;
  const edges = ["enter", "action", "hold", "exit"].map((k) => { const s = acc; acc += b.phases[k]; return [k, s, acc]; }).filter(([, s, e]) => e > s);
  md += `
### ${b.n} · ${b.title}（\`${b.id}\`，${b.lengthVh}vh）

- 阶段：${edges.map(([k, s, e]) => `${PH[k]} p ${s.toFixed(2)}–${e.toFixed(2)}`).join("；")}
- 前景：${b.foreground}
- 背景：厨房弱化 ${b.kitchenDim[0]} → ${b.kitchenDim[1]} → ${b.kitchenDim[2]}
- 角色：${EGG[b.egg]}
- 循环声：${loops}
- 渐变声：${fades}
- 单次音效：${shots}
- 小动作秒数：${secs}
`;
}
writeFileSync(new URL("../docs/BEATS.md", import.meta.url), md);
console.log(`docs/BEATS.md written: ${beats.length} beats, ${total}vh`);
