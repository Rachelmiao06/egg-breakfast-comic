#!/usr/bin/env node
// 后景 / 蛋路径坐标约束检查（纯计算，不开浏览器）。
// 复刻 motion.v2.ts 的 cameraV2（含环境段跟随）+ SceneStage 的 cover/clamp + preview 页的 fitSlotsV2（窄布局接蛋格）
// + eggPath.ts（桌沿等待点 = 起跳点、桌沿蛋缩放、飞行最高点）+ Egg.flightPoint。对每个视口检查：
//   等待段：锅 (720,670) 在开场画面里；蛋在桌沿时脚底在 B1 桌面上、整只蛋在画面里（沿镜头路径逐点）
//   接蛋飞行：起跳点在铲面落点右侧；整段飞行 x 不增（不往左越过落点再折返）；最后 30% 从右上方下落；
//            蛋身不碰气泡、始终在格内 keepRightOf 以右（不经过手和妈妈视线左侧）；起跳、越框、下降、落铲四个阶段蛋都在画面里
//   tablecall：碗 + 蛋在画面里
// usage: node tools/bg_constraints.mjs [WxH,...]   （--json 输出明细）
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const bg = JSON.parse(readFileSync(process.env.BG_JSON ?? `${root}src/app/preview/visual/backgrounds.json`, "utf8"));
const beats = JSON.parse(readFileSync(`${root}src/app/preview/visual/beats.visual-v2.json`, "utf8")).beats;
const slots = JSON.parse(readFileSync(`${root}src/app/preview/visual/slots.json`, "utf8"));
const W = 1536, H = 1024, EGG = 388;

const idx = (id) => beats.findIndex((b) => b.id === id);
const gOf = (id, p) => idx(id) + p;
const smooth = (t) => { const k = Math.min(1, Math.max(0, t)); return k * k * (3 - 2 * k); };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function curve(keys, g) {
  const pts = keys.map(([id, p, v]) => [gOf(id, p), v]);
  if (g <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (g <= pts[i][0]) { const [g0, v0] = pts[i - 1], [g1, v1] = pts[i]; return v0 + (v1 - v0) * smooth((g - g0) / (g1 - g0)); }
  return pts.at(-1)[1];
}
function phaseOf(b, p) {
  const ph = { enter: 0.25, action: 0, hold: 0.6, exit: 0.15, ...(b.phases ?? {}) };
  let acc = 0;
  for (const k of ["enter", "action", "hold", "exit"]) { if (ph[k] > 0 && p < acc + ph[k]) return [k, (p - acc) / ph[k]]; acc += ph[k]; }
  return ["exit", 1];
}
function view(vw, vh, c) {
  const s = Math.max(vw / W, vh / H) * c.zoom;
  const x = clamp(vw * c.ax - c.x * s, vw - W * s, 0);
  const y = clamp(vh * c.ay - c.y * s, vh - H * s, 0);
  return { s, x0: -x / s, x1: (vw - x) / s, y0: -y / s, y1: (vh - y) / s };
}
// Egg.flightPoint（逐字复刻）：二次贝塞尔，最高点 = min(apexY, min(A.y,B.y) − 40)，最高点的 x 在全程 apexAt 处
function flightPoint(A, B, apexY, t, apexAt = 0.6, easeX = false) {
  const k = clamp(t, 0, 1);
  const bez = (a, b, c, t) => (1 - t) ** 2 * a + 2 * (1 - t) * t * b + t ** 2 * c;
  const Hh = Math.min(apexY, Math.min(A.y, B.y) - 40);
  const cy = Hh - Math.sqrt((A.y - Hh) * (B.y - Hh));
  const ts = (A.y - cy) / (A.y + B.y - 2 * cy);
  const X = A.x + apexAt * (B.x - A.x);
  const cx = (X - (1 - ts) ** 2 * A.x - ts ** 2 * B.x) / (2 * (1 - ts) * ts);
  // 试算（XEASE=1）：横向改成 ease-in（x = A.x + (B.x − A.x)·k²），先近乎竖直上升、后段再向左落到铲面；不往右鼓
  // easeX（below 模式，Egg.flightPoint 第 6 个参数）：横向 ease-in
  if (easeX || process.env.XEASE) return { x: A.x + (B.x - A.x) * k * k, y: bez(A.y, cy, B.y, k) };
  return { x: bez(A.x, cx, B.x, k), y: bez(A.y, cy, B.y, k) };
}

// ---- 布局（与 preview 页 fitSlotsV2 / fitCatchTo 相同） ----
function layout(vw, vh) {
  const k = bg.camera.keys.find((k) => k[0] === "catch" && k[1] >= 0.8);
  const v = view(vw, vh, { x: k[2], y: k[3], zoom: k[4], ax: k[5], ay: k[6] });
  const c = slots.scene.catch, P = bg.eggPath, m = P.boxMargin;
  const eggW = (w) => EGG * bg.anchors.eggAtTable * Math.min(1, w / 900);
  let box = c.box, narrow = false, spat = slots.egg.onSpatulaScale;
  // eggPath.ts fitCatchForEgg：格子右侧留出蛋的位置
  let below = false;
  if (!(box[0] >= v.x0 + m && box[0] + box[2] + eggW(box[2]) + 2 * m + P.viewMargin <= v.x1) && P.narrowSlot === "below") {
    // eggPath.ts fitCatchForEgg 的 below 模式
    const V = v.x1 - v.x0, ef = (EGG * bg.anchors.eggAtTable) / 900, tipF = P.panel.blade[1];
    let w = Math.min(box[2], Math.round(V * 0.94));
    const fitsRight = m + w + eggW(w) + m + P.viewMargin <= V;
    if (!fitsRight) w = Math.min(w, Math.floor((V - m - P.tipGap) / (tipF + ef * (0.448 + 0.6 - P.maxOverhang))));
    if (!fitsRight && process.env.BELOW_W) w = Math.min(w, +process.env.BELOW_W); // 试算：指定格子宽度
    const h = Math.round((w * box[3]) / box[2]);
    const eggTop = bg.anchors.portraitTableWait.y - eggW(w) - 46 * bg.anchors.eggAtTable * Math.min(1, w / 900);
    const yy = fitsRight ? Math.round(Math.max(640 - h * 0.35, bg.table.topY - P.boxAboveTable - h)) : Math.round(Math.min(640 - h * 0.35, eggTop - m - h));
    spat *= w / box[2];
    box = [Math.round(v.x0 + m), yy, w, h];
    narrow = true; below = !fitsRight;
  } else if (!(box[0] >= v.x0 + m && box[0] + box[2] + eggW(box[2]) + 2 * m + P.viewMargin <= v.x1)) {
    const V = v.x1 - v.x0;
    let w = Math.min(box[2], (V - 3 * m - P.viewMargin) / (1 + (EGG * bg.anchors.eggAtTable) / 900));
    if (w >= box[2]) w = Math.min(box[2], V - 3 * m - P.viewMargin - eggW(box[2]));
    w = Math.round(w);
    const h = Math.round((w * box[3]) / box[2]);
    spat *= w / box[2];
    box = [Math.round(v.x0 + m), Math.round(Math.max(640 - h * 0.35, bg.table.topY - P.boxAboveTable - h)), w, h];
    narrow = true;
  }
  const land = { x: Math.round(box[0] + c.land.fx * box[2]), y: Math.round(box[1] + c.land.fy * box[3]) };
  const eggAtTable = bg.anchors.eggAtTable * Math.min(1, box[2] / 900);
  const ew = EGG * eggAtTable;
  const y = narrow ? bg.anchors.portraitTableWait.y : bg.anchors.tableWait.y;
  let wait;
  if (below) {
    const tip = box[0] + box[2] * P.panel.blade[1];
    wait = { x: Math.round(Math.min(Math.max(land.x + P.gapEggW * ew, tip + ew * 1.12 * 0.4 + ew * 0.1 + P.tipGap), v.x1 - ew / 2 + P.maxOverhang * ew)), y };
  } else {
    const want = Math.max(land.x + P.gapEggW * ew, box[0] + box[2] + ew / 2 + m);
    wait = { x: Math.round(Math.max(land.x + ew * 0.3, Math.min(want, v.x1 - ew / 2 - P.viewMargin))), y };
  }
  const apexY = Math.round(box[1] + box[3] * P.apexFromBoxTop);
  const apexAt = below ? (P.apexAtBelow ?? 0.6) : 0.6;
  return { v, box, narrow, below, land, wait, apexY, apexAt, eggAtTable, spat };
}
const cam = (g, wait) => {
  const K = bg.camera.keys; const ch = (j) => curve(K.map((k) => [k[0], k[1], k[j]]), g);
  const c = { x: ch(2), y: ch(3), zoom: ch(4), ax: ch(5), ay: ch(6) };
  const i = Math.min(beats.length - 1, Math.floor(g)), b = beats[i];
  const env = b.egg === "ready" ? wait : b.egg === "inBowl" ? bg.anchors.tableBowl : null;
  if (env) {
    const [ph, pp] = phaseOf(b, g - i);
    const w = ph === "enter" ? pp : ph === "exit" ? 1 - pp : 1;
    const f = 0.85 * smooth(w);
    c.x += (env.x - c.x) * f; c.y += (env.y - 120 - c.y) * f;
  }
  return c;
};

const sizes = (process.argv.find((a) => /^\d+x\d+/.test(a)) ?? "1600x900,1440x900,1024x768,860x1000,390x844").split(",").map((s) => s.split("x").map(Number));
const A = bg.anchors, T = bg.table, PM = bg.eggPath.panel;
const catchB = beats[idx("catch")];
const ph = { enter: 0.25, action: 0, hold: 0.6, exit: 0.15, ...catchB.phases };
const flightStart = ph.enter, flightEnd = ph.enter + ph.action; // 动作阶段 = 飞行
// ---- --views（只输出视野表）：各节拍下每个视口看到的场景范围（场景像素），给出图 brief 定“画面边缘”用 ----
if (process.argv.includes("--views")) {
  const BEATS = [["opening", 0.5], ["drop", 0.9], ["bag", 0.5], ["missing", 0.5], ["prejump", 0.6], ["hear", 0.5], ["catch", 0.5], ["handoff", 0.6], ["bowl", 0.5], ["call", 0.5], ["tablecall", 0.6], ["search", 0.5], ["eggcall", 0.5], ["return", 0.5], ["punchline", 0.5]];
  const out = { beats: {}, landscapeAll: null, all: null };
  let LA = [-1e9, -1e9, 1e9, 1e9], AL = [-1e9, -1e9, 1e9, 1e9];
  for (const [id, p] of BEATS) {
    const row = {};
    for (const [vw, vh] of sizes) {
      const L = layout(vw, vh);
      const v = view(vw, vh, cam(gOf(id, p), L.wait));
      const r = [Math.round(v.x0), Math.round(v.y0), Math.round(v.x1), Math.round(v.y1)];
      row[`${vw}×${vh}`] = r;
      const isLand = vw / vh >= 1.5;
      if (isLand) LA = [Math.max(LA[0], r[0]), Math.max(LA[1], r[1]), Math.min(LA[2], r[2]), Math.min(LA[3], r[3])];
      AL = [Math.max(AL[0], r[0]), Math.max(AL[1], r[1]), Math.min(AL[2], r[2]), Math.min(AL[3], r[3])];
    }
    out.beats[`${id} ${p}`] = row;
  }
  out.landscapeAll = LA; out.all = AL;
  // 接蛋飞行走廊：所有视口蛋身（80% 宽、85% 高）沿路径的并集
  let C = [1e9, 1e9, -1e9, -1e9];
  for (const [vw, vh] of sizes) {
    const L = layout(vw, vh);
    for (let i = 0; i <= 100; i++) {
      const t = i / 100, p = flightPoint(L.wait, L.land, L.apexY, t, L.apexAt, L.below), w = EGG * (L.eggAtTable + (L.spat - L.eggAtTable) * t + 0.24 * Math.min(L.eggAtTable, L.spat) * Math.sin(Math.PI * t));
      C = [Math.min(C[0], p.x - w * 0.4), Math.min(C[1], p.y - w * 0.85), Math.max(C[2], p.x + w * 0.4), Math.max(C[3], p.y)];
    }
  }
  out.flightCorridor = C.map(Math.round);
  if (process.argv.includes("--json")) console.log(JSON.stringify(out, null, 1));
  else {
    const vps = sizes.map(([w, h]) => `${w}×${h}`);
    console.log("| 节拍 | " + vps.join(" | ") + " |");
    console.log("|---|" + vps.map(() => "---|").join(""));
    for (const [b, row] of Object.entries(out.beats)) console.log(`| ${b} | ` + vps.map((k) => `x ${row[k][0]}–${row[k][2]}, y ${row[k][1]}–${row[k][3]}`).join(" | ") + " |");
    console.log(`\n横版（宽高比 ≥ 1.5）所有节拍都看得到：x ${LA[0]}–${LA[2]}, y ${LA[1]}–${LA[3]}`);
    console.log(`五个视口所有节拍都看得到：x ${AL[0]}–${AL[2]}, y ${AL[1]}–${AL[3]}`);
    console.log(`接蛋飞行走廊（五个视口蛋身并集）：x ${out.flightCorridor[0]}–${out.flightCorridor[2]}, y ${out.flightCorridor[1]}–${out.flightCorridor[3]}`);
  }
  process.exit(0);
}

const rows = [];
for (const [vw, vh] of sizes) {
  const L = layout(vw, vh);
  const ew = EGG * L.eggAtTable;
  const vOpen = view(vw, vh, cam(gOf("opening", 0.5), L.wait));
  const panOk = A.panLaunch.x > vOpen.x0 && A.panLaunch.x < vOpen.x1 && A.panLaunch.y > vOpen.y0 && A.panLaunch.y < vOpen.y1;
  // 等待段（drop 落桌 → catch 起跳）
  let wm = Infinity, wmAt = "";
  for (let g = gOf("drop", 0.75); g <= gOf("catch", flightStart); g += 0.01) {
    const v = view(vw, vh, cam(g, L.wait));
    const allowW = L.below && g >= gOf("catch", 0) ? Math.max(0, bg.eggPath.maxOverhang) * ew : 0;
    const m = Math.min((L.wait.x - ew / 2 - v.x0) * v.s, (v.x1 + allowW - (L.wait.x + ew / 2)) * v.s, (L.wait.y - ew - v.y0) * v.s, (v.y1 - L.wait.y) * v.s - 8);
    if (m < wm) { wm = m; wmAt = `${beats[Math.floor(g)].id} ${(g % 1).toFixed(2)}`; }
  }
  const onTop = L.wait.y >= T.topY && L.wait.y <= T.edgeY;
  // 接蛋飞行
  const box = L.box, fx = (x) => (x - box[0]) / box[2];
  const bubble = { x0: box[0] + PM.bubble[0] * box[2], x1: box[0] + PM.bubble[1] * box[2], y0: box[1] + PM.bubble[2] * box[3], y1: box[1] + PM.bubble[3] * box[3] };
  const path = [];
  let prev = null, monotonic = true, fromUpperRight = true, bubbleHit = false, minFx = Infinity, vis = Infinity;
  const stages = {};
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    const p = flightPoint(L.wait, L.land, L.apexY, t, L.apexAt, L.below);
    const sc = L.eggAtTable + (L.spat - L.eggAtTable) * t + 0.24 * Math.min(L.eggAtTable, L.spat) * Math.sin(Math.PI * t); // 与 Egg.arc 的缩放相同
    const w = EGG * sc;
    const r = { x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y - w, y1: p.y };
    if (prev && p.x > prev.x + 0.01) monotonic = false;
    // 只在格内时检查（格从 flight 0.22 起出现）
    const insideBox = r.x1 > box[0] && r.x0 < box[0] + box[2] && r.y1 > box[1] && r.y0 < box[1] + box[3];
    if (t >= 0.2 && insideBox) {
      // 蛋的实际轮廓比外接框小（白边、手脚），按 80% 宽度检查
      const ix0 = p.x - w * 0.4, ix1 = p.x + w * 0.4, iy0 = p.y - w * 0.85;
      if (ix1 > bubble.x0 && ix0 < bubble.x1 && p.y > bubble.y0 && iy0 < bubble.y1) bubbleHit = true;
      minFx = Math.min(minFx, fx(ix0));
    }
    const g = gOf("catch", flightStart + (flightEnd - flightStart) * t);
    const v = view(vw, vh, cam(g, L.wait)); // 跟随权重 0.06 忽略
    const allowR = L.below ? Math.max(0, bg.eggPath.maxOverhang) * w : 0; // below 模式允许起跳时伸出右缘最多 maxOverhang 个蛋宽
    const m = Math.min((r.x0 - v.x0) * v.s, (v.x1 + allowR - r.x1) * v.s, (r.y0 - v.y0) * v.s, (v.y1 - r.y1) * v.s);
    vis = Math.min(vis, m);
    if ([0, 0.3, 0.6, 0.85, 1].includes(t)) stages[t] = `${Math.round(p.x)},${Math.round(p.y)}`;
    path.push(p);
    prev = p;
  }
  // 最高点之后（下降段）：每一步都向下且不向右；整体下降方向来自右上方（横向 / 纵向 ≥ minSlope）
  const ia = path.reduce((m, p, i) => (p.y < path[m].y ? i : m), 0);
  for (let i = ia + 1; i < path.length; i++) if (path[i].y < path[i - 1].y - 0.01 || path[i].x > path[i - 1].x + 0.01) fromUpperRight = false;
  const slope = (path[ia].x - L.land.x) / Math.max(1, L.land.y - path[ia].y);
  if (slope < bg.eggPath.minSlope) fromUpperRight = false;
  // tablecall
  const TB = A.tableBowl, BB = bg.bowl.box;
  let bowlWorst = Infinity;
  for (let g = gOf("tablecall", 0.12); g <= gOf("tablecall", 0.9); g += 0.02) {
    const v = view(vw, vh, cam(g, L.wait));
    const eggTop = TB.y - EGG * A.eggInTableBowl;
    bowlWorst = Math.min(bowlWorst, (TB.x + BB[0] - v.x0) * v.s, (v.x1 - (TB.x + BB[0] + BB[2])) * v.s, (Math.min(eggTop, TB.y + BB[1]) - v.y0) * v.s, (v.y1 - (TB.y + BB[1] + BB[3])) * v.s);
  }
  const rightOfBlade = L.wait.x > L.land.x;
  // 起跳前蛋不能在接蛋格（最终位置，及从下方升起的路径）后面：蛋身左缘在格子右缘之外
  // below 模式：接蛋格 z 62 在桌沿蛋 63 之下（Z.catchPanel），升起时不会盖住蛋；蛋也不和格子最终位置重叠
  const clearOfPanel = L.below ? L.wait.y - ew - 46 * L.eggAtTable >= box[1] + box[3] : L.wait.x - ew / 2 >= box[0] + box[2];
  const overhang = Math.max(0, Math.round(L.wait.x + ew / 2 - L.v.x1));
  // 上升段（最高点之前）蛋身不压过铲面
  const bl = { x0: box[0] + PM.blade[0] * box[2], x1: box[0] + PM.blade[1] * box[2], y0: box[1] + PM.blade[2] * box[3], y1: box[1] + PM.blade[3] * box[3] };
  let ascentHitsBlade = false;
  const iaa = path.reduce((mm, p, i) => (p.y < path[mm].y ? i : mm), 0);
  for (let i = 0; i < iaa; i++) {
    const p = path[i], t = i / 100, w = EGG * (L.eggAtTable + (L.spat - L.eggAtTable) * t + 0.24 * Math.min(L.eggAtTable, L.spat) * Math.sin(Math.PI * t));
    if (p.x + w * 0.4 > bl.x0 && p.x - w * 0.4 < bl.x1 && p.y > bl.y0 && p.y - w * 0.85 < bl.y1) ascentHitsBlade = true;
  }
  const ok = panOk && onTop && wm >= 0 && rightOfBlade && clearOfPanel && !ascentHitsBlade && monotonic && fromUpperRight && !bubbleHit && minFx >= PM.keepRightOf && vis >= 0 && bowlWorst >= 0;
  rows.push({ vp: `${vw}×${vh}`, narrow: L.narrow, box: box.join(","), land: `${L.land.x},${L.land.y}`, wait: `${L.wait.x},${L.wait.y}`, eggAtTable: +L.eggAtTable.toFixed(3), apexY: L.apexY, panOk, onTop, wm: Math.round(wm), wmAt, rightOfBlade, clearOfPanel, overhang, below: L.below, ascentHitsBlade, monotonic, fromUpperRight, bubbleHit, minFx: +minFx.toFixed(3), vis: Math.round(vis), bowl: Math.round(bowlWorst), slope: +slope.toFixed(2), stages, ok });
}
if (process.argv.includes("--json")) { console.log(JSON.stringify(rows, null, 1)); process.exit(rows.every((r) => r.ok) ? 0 : 1); }
const y = (b) => (b ? "是" : "否");
console.log("| 视口 | 窄布局 | 接蛋格 box | 铲面落点 | 桌沿等待 = 起跳点 | 桌沿蛋缩放 | 最高点 y | 起跳在落点右侧 | 起跳前不被格子盖住 | 上升时压过铲面 | 下方模式（伸出右缘，场景像素） | 飞行不往回折 | 下降段从右上方落下（横/纵） | 碰气泡 | 格内蛋身最左 fx（≥ " + PM.keepRightOf + "） | 四阶段 起跳 / 越框 / 下降 / 落铲 | 飞行时离屏幕边最小距离 (px) | 等待段蛋离屏幕边 (px) | 脚底在桌面上 | 锅在开场画面 | tablecall 碗 + 蛋离屏幕边 (px) | 结果 |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const r of rows) console.log(`| ${r.vp} | ${y(r.narrow)} | ${r.box} | ${r.land} | ${r.wait} | ${r.eggAtTable} | ${r.apexY} | ${y(r.rightOfBlade)} | ${y(r.clearOfPanel)} | ${y(r.ascentHitsBlade)} | ${r.below ? `是（${r.overhang}）` : "否"} | ${y(r.monotonic)} | ${y(r.fromUpperRight)}（${r.slope}） | ${y(r.bubbleHit)} | ${r.minFx} | ${r.stages[0]} / ${r.stages[0.3]} / ${r.stages[0.85]} / ${r.stages[1]} | ${r.vis} | ${r.wm}（${r.wmAt}） | ${y(r.onTop)} | ${y(r.panOk)} | ${r.bowl} | ${r.ok ? "✓" : "✗"} |`);
if (rows.some((r) => !r.ok)) process.exitCode = 1;

