#!/usr/bin/env node
// 后景坐标约束检查（纯计算，不开浏览器）。
// 复刻 motion.v2.ts 的 cameraV2 + SceneStage 的 cover/clamp + preview 页的 fitSlotsV2（窄布局判定），
// 对每个视口沿镜头路径采样，检查：锅 (720,670)、桌沿等待点、起跳点、桌沿前缘是否都在画面里、
// 蛋身（eggAtTable 缩放后的包围盒）是否完整可见。输出 Markdown 表，贴进 docs/BACKGROUND-SPEC.md。
// usage: node tools/bg_constraints.mjs [WxH,...]
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const bg = JSON.parse(readFileSync(`${root}src/app/preview/visual/backgrounds.json`, "utf8"));
const beats = JSON.parse(readFileSync(`${root}src/app/preview/visual/beats.visual-v2.json`, "utf8")).beats;
const slots = JSON.parse(readFileSync(`${root}src/app/preview/visual/slots.json`, "utf8"));
const W = 1536, H = 1024, EGG = 388;

const idx = (id) => beats.findIndex((b) => b.id === id);
const gOf = (id, p) => idx(id) + p;
const smooth = (t) => { const k = Math.min(1, Math.max(0, t)); return k * k * (3 - 2 * k); };
function curve(keys, g) {
  const pts = keys.map(([id, p, v]) => [gOf(id, p), v]);
  if (g <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (g <= pts[i][0]) { const [g0, v0] = pts[i - 1], [g1, v1] = pts[i]; return v0 + (v1 - v0) * smooth((g - g0) / (g1 - g0)); }
  return pts.at(-1)[1];
}
const cam = (g) => { const K = bg.camera.keys; const ch = (j) => curve(K.map((k) => [k[0], k[1], k[j]]), g); return { x: ch(2), y: ch(3), zoom: ch(4), ax: ch(5), ay: ch(6) }; };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function view(vw, vh, c) {
  const s = Math.max(vw / W, vh / H) * c.zoom;
  const x = clamp(vw * c.ax - c.x * s, vw - W * s, 0);
  const y = clamp(vh * c.ay - c.y * s, vh - H * s, 0);
  return { s, x0: -x / s, x1: (vw - x) / s, y0: -y / s, y1: (vh - y) / s };
}
function narrowAt(vw, vh) {
  const k = bg.camera.keys.find((k) => k[0] === "catch" && k[1] >= 0.8);
  const v = view(vw, vh, { x: k[2], y: k[3], zoom: k[4], ax: k[5], ay: k[6] });
  const [x, , w] = slots.scene.catch.box;
  return !(x >= v.x0 + 12 && x + w <= v.x1 - 12);
}

const sizes = (process.argv[2] ?? "1600x900,1440x900,1024x768,860x1000,390x844").split(",").map((s) => s.split("x").map(Number));
const A = bg.anchors, T = bg.table;
const eggW = EGG * A.eggAtTable;
// 蛋在桌沿的时段：drop 动作结束（落桌）→ catch 动作开始（起跳）
const waitFrom = gOf("drop", 0.75), waitTo = gOf("catch", 0.22);
const rows = [];
for (const [vw, vh] of sizes) {
  const narrow = narrowAt(vw, vh);
  const wait = narrow ? A.portraitTableWait : A.tableWait;
  // 锅：开场全程
  const vOpen = view(vw, vh, cam(gOf("opening", 0.5)));
  const panOk = A.panLaunch.x > vOpen.x0 && A.panLaunch.x < vOpen.x1 && A.panLaunch.y > vOpen.y0 && A.panLaunch.y < vOpen.y1;
  // 桌沿等待：沿镜头路径采样最差情况
  let worst = { left: Infinity, right: Infinity, top: Infinity, bottom: Infinity, edge: Infinity };
  for (let g = waitFrom; g <= waitTo; g += 0.02) {
    const v = view(vw, vh, cam(g));
    worst.left = Math.min(worst.left, (wait.x - eggW / 2 - v.x0) * v.s);
    worst.right = Math.min(worst.right, (v.x1 - (wait.x + eggW / 2)) * v.s);
    worst.top = Math.min(worst.top, (wait.y - eggW - v.y0) * v.s);
    worst.bottom = Math.min(worst.bottom, (v.y1 - wait.y) * v.s);
    worst.edge = Math.min(worst.edge, (v.y1 - T.edgeY) * v.s);
  }
  const onTop = wait.y >= T.topY && wait.y <= T.edgeY;
  const vDrop = view(vw, vh, cam(gOf("hear", 0.5)));
  rows.push({
    vp: `${vw}×${vh}`, ratio: (vw / vh).toFixed(2), narrow, wait: `${wait.x},${wait.y}`,
    panOk, onTop,
    view: `x ${Math.round(vDrop.x0)}…${Math.round(vDrop.x1)}, y ${Math.round(vDrop.y0)}…${Math.round(vDrop.y1)}`,
    margins: `${Math.round(worst.left)} / ${Math.round(worst.right)} / ${Math.round(worst.top)} / ${Math.round(worst.bottom)}`,
    edge: Math.round(worst.edge),
    ok: panOk && onTop && worst.left >= 0 && worst.right >= 0 && worst.top >= 0 && worst.bottom >= 8 && worst.edge >= 0,
  });
}
console.log("| 视口 | 宽高比 | 窄布局 | 桌沿等待点 | 锅在画面内 | 脚底在桌面上 (920–995) | hear 时可见场景 | 蛋身离屏幕边最小距离 左/右/上/下 (屏幕 px) | 前缘线离屏幕下沿 (px) | 结果 |");
console.log("|---|---|---|---|---|---|---|---|---|---|");
for (const r of rows) console.log(`| ${r.vp} | ${r.ratio} | ${r.narrow ? "是" : "否"} | ${r.wait} | ${r.panOk ? "是" : "否"} | ${r.onTop ? "是" : "否"} | ${r.view} | ${r.margins} | ${r.edge} | ${r.ok ? "✓" : "✗"} |`);
if (rows.some((r) => !r.ok)) process.exitCode = 1;
