/**
 * 接蛋路径（后景会话，2026-11-14 用户要求）：蛋必须从妈妈的右侧、铲面的右上方接近，沿短弧线落到铲面。
 *
 * 依据接蛋格 p3e 的画面（格内比例，见 backgrounds.json eggPath）：
 *   妈妈在左侧、面朝右，眼睛约 (0.23, 0.25)；“哎？慢点！”气泡 x 0.30–0.555、y 0.05–0.30；
 *   锅铲向右伸，铲面 x 0.69–0.865、y 0.39–0.56，落点 (0.775, 0.49)。
 * 所以：
 *   - 桌沿等待点 = 起跳点放在铲面落点的右侧（x = 落点 + gapEggW × 蛋宽），并夹在接蛋镜头的可见范围内，
 *     进入接蛋段之前方向就已经一致（等待、蓄力、起跳都在铲面右侧）；y 仍是桌面高度（横版 965 / 窄版 990）。
 *   - 窄布局（接蛋格被缩小）桌沿上的蛋按同样比例缩小（不放大），手机上才放得进铲面右侧。
 *   - 飞行最高点 = 格上框以下 apexFromBoxTop × 格高（比铲面高、低于格上框）：短弧线，从右侧越过格框，再从右上方落到铲面；
 *     整段飞行蛋身都在格内 x ≥ keepRightOf 的范围，不经过气泡、手和妈妈的视线左侧。
 * 坐标都是场景像素，脚底中心。只读布局（slots + fitSlotsV2 的结果），不改漫画格。
 */
import { BG } from "./motion.v2";
import { landPoint, PANELS, type SlotConfig } from "./slots";

type Pt = { x: number; y: number; d?: number };
const EGG = 388;
const BASE_BOX_W = 900; // slots.json 里接蛋格的设计宽度（横版不缩放）

/** 桌沿上蛋的缩放：窄布局按接蛋格缩小比例缩小，不放大 */
export function eggAtTableFor(cfg: SlotConfig) {
  const k = Math.min(1, cfg.scene.catch.box[2] / BASE_BOX_W);
  return BG.anchors.eggAtTable * k;
}

/** 桌沿等待点 = 起跳点：铲面落点右侧，夹在接蛋镜头可见范围内 */
export function tableWaitFor(cfg: SlotConfig): Pt {
  const P = BG.eggPath;
  const land = landPoint(cfg.scene.catch);
  const w = EGG * eggAtTableFor(cfg);
  const y = cfg.narrow ? BG.anchors.portraitTableWait.y : BG.anchors.tableWait.y;
  const box = cfg.scene.catch.box;
  if (belowMode(cfg)) {
    // 窄屏“格子下方偏右”：蛋在格子下方、铲尖右侧起跳（上升时连同半空放大也不压铲面），可以伸出屏幕右缘最多 maxOverhang 个蛋宽
    const tip = box[0] + box[2] * P.panel.blade[1];
    const wMax = w * (1 + 0.24 * 0.5); // 半空最大放大约 +12%（Egg.arc：0.24 × 较小缩放 × sin，半宽按 0.4 计）
    const want = Math.max(land.x + P.gapEggW * w, tip + wMax * 0.4 + w * 0.1 + P.tipGap);
    const maxX = cfg.view!.x1 - w / 2 + P.maxOverhang * w;
    return { x: Math.round(Math.min(want, maxX)), y };
  }
  // 铲面落点右侧 gapEggW 个蛋宽，而且在接蛋格右缘之外
  const want = Math.max(land.x + P.gapEggW * w, box[0] + box[2] + w / 2 + P.boxMargin);
  const maxX = cfg.view ? cfg.view.x1 - w / 2 - P.viewMargin : want;
  return { x: Math.round(Math.max(land.x + w * 0.3, Math.min(want, maxX))), y };
}

/** 窄屏格子放不下右侧蛋位、且配置选了 narrowSlot = "below" 时，蛋改在格子下方偏右等待（格子 z 62 在桌沿蛋之下，升起时不盖住蛋） */
function belowMode(cfg: SlotConfig) {
  const P = BG.eggPath;
  if (P.narrowSlot !== "below" || !cfg.narrow || !cfg.view) return false;
  const box = cfg.scene.catch.box;
  const w = EGG * eggAtTableFor(cfg);
  return box[0] + box[2] + w + P.boxMargin + P.viewMargin > cfg.view.x1;
}

/**
 * below 模式需要的飞行形状：横向 ease-in（x = A.x + (B.x − A.x)·k²），先近乎竖直上升、后段再向左落到铲面，不往右鼓。
 * 要 Egg.flightPoint 支持（集成会话维护）：返回 true 时按 ease-in 计算 x。
 */
export function flightEaseXFor(cfg: SlotConfig) {
  return belowMode(cfg);
}

/** 飞行最高点（脚底 y）：格上框以下 apexFromBoxTop × 格高 */
export function flightApexYFor(cfg: SlotConfig) {
  const box = cfg.scene.catch.box;
  return Math.round(box[1] + box[3] * BG.eggPath.apexFromBoxTop);
}

/**
 * 接蛋格布局（新版）：在接蛋镜头的可见范围 view 内放接蛋格，并在格子右侧留出蛋的位置。
 * 接蛋格在 catch 进入阶段就从下方升起（z 70，高于桌沿的蛋），所以桌沿等待点 = 起跳点必须在格子右缘之外，否则蛋会被格子盖住。
 * 横版：格子保持 slots.json 的设计位置（镜头已右移，右侧有空）；放不下时缩小格子、靠左放，右侧留 蛋宽 + 边距。
 * 窄布局时铲面上的蛋按格子比例缩小（与原 fitCatchTo 相同）。
 */
export function fitCatchForEgg(cfg: SlotConfig, view: { x0: number; x1: number; y0: number; y1: number }): SlotConfig {
  const c = cfg.scene.catch;
  const m = BG.eggPath.boxMargin;
  const eggW = (w: number) => EGG * BG.anchors.eggAtTable * Math.min(1, w / BASE_BOX_W);
  const room = (w: number) => eggW(w) + 2 * m + BG.eggPath.viewMargin;
  const [x, , w0] = c.box;
  if (x >= view.x0 + m && x + w0 + room(w0) <= view.x1) return { ...cfg, view };
  const V = view.x1 - view.x0;
  const P = BG.eggPath;
  if (P.narrowSlot === "below") {
    // 格子保持正常适配宽度（可见宽度的 94%，不超过设计宽度），靠左。放得下右侧蛋位就照旧放右侧；
    // 放不下时蛋改在格子下方偏右（tableWaitFor），格子下缘在蛋头顶之上 boxMargin；蛋伸出右缘超过 maxOverhang 才把格子缩到刚好满足
    const tipF = P.panel.blade[1], ef = (EGG * BG.anchors.eggAtTable) / BASE_BOX_W;
    let wf = Math.min(w0, Math.round(V * 0.94));
    const fitsRight = m + wf + eggW(wf) + m + P.viewMargin <= V;
    // 蛋右缘 = 格左 + tipF·w + 0.4·1.12·eggW + 0.1·eggW + tipGap + 0.5·eggW ≤ 视口右缘 + maxOverhang·eggW
    if (!fitsRight) wf = Math.min(wf, Math.floor((V - m - P.tipGap) / (tipF + ef * (0.448 + 0.6 - P.maxOverhang))));
    const hf = Math.round((wf * c.box[3]) / c.box[2]);
    const kf = wf / c.box[2];
    const eggTop = BG.anchors.portraitTableWait.y - eggW(wf) - 46 * BG.anchors.eggAtTable * Math.min(1, wf / BASE_BOX_W);
    const yf = fitsRight ? Math.round(Math.max(640 - hf * 0.35, BG.table.topY - P.boxAboveTable - hf)) : Math.round(Math.min(640 - hf * 0.35, eggTop - m - hf));
    return {
      ...cfg,
      view,
      narrow: true,
      egg: { ...cfg.egg, onSpatulaScale: cfg.egg.onSpatulaScale * kf },
      scene: { ...cfg.scene, catch: { ...c, box: [Math.round(view.x0 + m), yf, wf, hf] } },
    };
  }
  // 解 w + eggW(w) + 3m + viewMargin = V（eggW 随 w 线性），不超过设计宽度
  let w = Math.min(w0, (V - 3 * m - BG.eggPath.viewMargin) / (1 + (EGG * BG.anchors.eggAtTable) / BASE_BOX_W));
  if (w >= w0) w = Math.min(w0, V - 3 * m - BG.eggPath.viewMargin - eggW(w0));
  w = Math.round(w);
  const h = Math.round((w * c.box[3]) / c.box[2]);
  const k = w / c.box[2];
  return {
    ...cfg,
    view,
    narrow: true,
    egg: { ...cfg.egg, onSpatulaScale: cfg.egg.onSpatulaScale * k },
    // 竖直方向：格子下缘贴近桌面上沿（boxAboveTable），起跳点就在格子旁边，弧线短；不高于原来的位置
    scene: { ...cfg.scene, catch: { ...c, box: [Math.round(view.x0 + m), Math.round(Math.max(640 - h * 0.35, BG.table.topY - BG.eggPath.boxAboveTable - h)), w, h] } },
  };
}

type View = { x0: number; x1: number; y0: number; y1: number };
const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * 备菜段桌面游走的三个站点（左 / 中 / 右，脚底中心，场景像素）。期望 x 在 backgrounds.json anchors.wander，
 * 夹在阅读镜头（view）可见的桌面里：避开左侧架子（minX）和右侧葱、篮子（maxX），离画面边缘 margin；中点夹在左右之间。
 */
export function wanderPointsFor(cfg: SlotConfig, view: View & { s?: number }): Pt[] {
  const Wd = BG.anchors.wander;
  const w = EGG * eggAtTableFor(cfg);
  // 纵深：台面后沿（backY）到前沿（frontY）之间，每个站点给一个深度 depth ∈ [0,1]（0 = 桌沿、1 = 台面后沿），
  // y 在桌沿高度和台面后沿之间插值，蛋随之缩小（depthScale），之字形走：不再总贴着桌沿
  const front = cfg.narrow ? BG.anchors.portraitTableWait.y : BG.anchors.tableWait.y;
  const R0 = BG.reading;
  const portrait = (view.x1 - view.x0) / (view.y1 - view.y0) < R0.portraitBelow;
  const back = (portrait ? R0.counterPortrait.backY : R0.counter.backY) + Wd.backInset;
  // 右下角留给声音按钮（屏幕像素 → 场景像素）：右侧的点不压到按钮
  const reserve = view.s ? Wd.rightReservePx / view.s : 0;
  const lo = Math.max(view.x0 + Wd.margin + w / 2, Wd.minX), hi = Math.min(view.x1 - Wd.margin - reserve - w / 2, Wd.maxX);
  const L = clampN(Wd.x[0], lo, hi), R = clampN(Wd.x[2], lo, hi);
  const M = clampN(Wd.x[1], L + (R - L) * 0.3, R - (R - L) * 0.3);
  const pts: Pt[] = [L, M, R].map((x, i) => {
    const depth = Wd.depth[i];
    return { x: Math.round(x), y: Math.round(front + (back - front) * depth), d: +(1 - (1 - Wd.backScale) * depth).toFixed(3) };
  });
  // 第三站：能放进镜头就换成菜篮边沿上的支点（横版拆层才有道具切片），否则留在台面上
  const Pc = Wd.perch;
  // 边沿在半空，不挡右下角声音按钮，所以不留 reserve；蛋心离镜头右缘留 10 + 0.35 个蛋宽就行（半个蛋探出一点也是站在边沿上）
  const perchHi = view.x1 - 10 - w * 0.35;
  if (!portrait && perchHi >= Pc.minX) pts[2] = { x: Math.round(Math.min(Pc.x, perchHi, Pc.maxX)), y: Pc.y, d: Pc.d };
  return pts;
}
/** 每段的桌面站点（段 id → 脚底点），给 Egg 的 tableAt */
export function wanderTableFor(cfg: SlotConfig, view: View & { s?: number }): Record<string, Pt> {
  const pts = wanderPointsFor(cfg, view);
  return Object.fromEntries(Object.entries(BG.anchors.wander.at as Record<string, number>).map(([id, i]) => [id, pts[i]]));
}
/** 高跳之后的空中站点：画面上缘之外（整颗蛋在画布上沿之上）、铲面右上方，并在接蛋镜头（catchView）横向范围内，接蛋时从上缘入画 */
export function airPointFor(cfg: SlotConfig, catchView: View): Pt {
  const Wd = BG.anchors.wander;
  const w = EGG * eggAtTableFor(cfg);
  const land = landPoint(cfg.scene.catch);
  const x = Math.max(land.x, Math.min(land.x + Wd.airDxEggW * w, catchView.x1 - 0.6 * w));
  return { x: Math.round(x), y: Math.round(-w - Wd.airAbove) };
}

/**
 * 高跳轨迹（docs/EGG-JUMP.md）：一条参数曲线 P(s)，s：L 0 → M sM → E sE → R sR → C 1。坐标都是场景像素、脚底中心。
 *   L 起点 = 最后一个游走站点（右侧桌面）。
 *   M 视线相遇点：hear 格（p3d，左下）右上方、她抬眼的视线方向上；格子位置按 ComicLayer 的排版算出（单格：横屏按 fitPlaces，
 *     竖屏用 portraitPlace），再用 hear 停留时的镜头换成场景坐标。蛋心在格子右缘外 0.62 个蛋宽、格子上沿再往上 10% 格高之上，
 *     整颗在画面内（margin），不压格子和对白。
 *   E / R：M → C 那条连续弧线（三次贝塞尔）的两个控制点：E 在 M 正上方、画布上沿之外（起势竖直向上，和 L → M 的末端速度方向连续），
 *     R 在 catch 取景上缘之外、铲面右上方（末段从右上方斜着落到铲面，不经过对白泡）。弧线整条连续，不再有“飞出画外、画外平移、再掉下来”的折线。
 *   C 铲面接触点 = landPoint。
 */
export type Traj = { L: Pt; M: Pt; E: Pt; R: Pt; C: Pt; sM: number; sE: number; sR: number; scaleL: number; scaleC: number; tiltC: number; camSM: number; camSC: number };
type Cam = { s: number; tx: number; ty: number }; // 场景 → 屏幕：X = x * s + tx

/** hear 格在屏幕上的位置（像素），与 ComicLayer 对单格的排版一致 */
export function hearPanelRect(vw: number, vh: number, portrait: boolean) {
  const p = PANELS.find((k) => k.key === "p3d");
  if (!p) return null;
  let x: number, y: number, w: number;
  if (portrait && p.portraitPlace) ({ x, y, w } = p.portraitPlace);
  else {
    const k = Math.min(1.6, Math.max(1, 1.6 / (vw / vh)));
    const bx = 50 + (p.x + p.w / 2 - 50) * k - (p.w * k) / 2, bw = p.w * k, by = p.y;
    const hv = ((bw * vw) / 100 / p.aspect / vh) * 100;
    const sc = Math.min(1, (96 - by) / Math.max(1, hv), 96 / Math.max(1, bw));
    const cx = bx + bw / 2, lx = cx + (bx - cx) * sc, rx = cx + (bx + bw - cx) * sc;
    x = cx + (bx - cx) * sc + Math.max(0, 2 - lx) - Math.max(0, rx - 98); y = by; w = bw * sc;
  }
  const x0 = (x * vw) / 100, y0 = (y * vh) / 100, wp = (w * vw) / 100;
  return { x0, y0, x1: x0 + wp, y1: y0 + wp / p.aspect };
}

export function trajectoryFor(cfg: SlotConfig, vp: { w: number; h: number; portrait: boolean }, hear: Cam, catchV: View, L: Pt): Traj {
  const scaleL = eggAtTableFor(cfg) * (L.d ?? 1);
  const h = EGG * scaleL; // 蛋高（场景像素），布局框近似正方形
  const eggS = h * hear.s; // hear 镜头下蛋在屏幕上的大小
  const margin = 14;
  const rect = hearPanelRect(vp.w, vp.h, vp.portrait);
  let cx: number, cy: number;
  if (rect) {
    cx = rect.x1 + 0.62 * eggS;
    cy = rect.y0 - 0.1 * (rect.y1 - rect.y0) - eggS / 2;
  } else { cx = vp.w * 0.5; cy = vp.h * 0.3; }
  cx = Math.min(Math.max(cx, margin + eggS / 2), vp.w - margin - eggS / 2);
  cy = Math.max(cy, margin + eggS / 2);
  const M = { x: Math.round((cx - hear.tx) / hear.s), y: Math.round((cy - hear.ty) / hear.s + h / 2) };
  const land = landPoint(cfg.scene.catch);
  const Wd = BG.anchors.wander;
  const rx = Math.max(land.x, Math.min(land.x + Wd.airDxEggW * h, catchV.x1 - 0.6 * h));
  const R = { x: Math.round(rx), y: Math.round(catchV.y0 - 0.55 * h) };
  const E = { x: M.x, y: Math.round(-h - Wd.airAbove) };
  // camSM / camSC：起跳点（hear 镜头）和落铲点（catch 镜头）的屏幕缩放（屏幕像素 / 场景像素），让蛋在屏幕上的大小平滑过渡
  const camSC = vp.w / (catchV.x1 - catchV.x0);
  return { L, M, E, R, C: land, sM: 0.3, sE: 0.5, sR: 0.7, scaleL, scaleC: cfg.egg.onSpatulaScale, tiltC: cfg.egg.onSpatulaTilt ?? 0, camSM: hear.s, camSC };
}
