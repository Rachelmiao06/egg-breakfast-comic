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
import { landPoint, type SlotConfig } from "./slots";

type Pt = { x: number; y: number };
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
  // 铲面落点右侧 gapEggW 个蛋宽，而且在接蛋格右缘之外（格子在起跳前就已升起，会盖住格内的蛋）
  const box = cfg.scene.catch.box;
  const want = Math.max(land.x + P.gapEggW * w, box[0] + box[2] + w / 2 + P.boxMargin);
  const maxX = cfg.view ? cfg.view.x1 - w / 2 - P.viewMargin : want;
  return { x: Math.round(Math.max(land.x + w * 0.3, Math.min(want, maxX))), y };
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
