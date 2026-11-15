"use client";
/**
 * 同一颗活动蛋（整页只有这一个实例，挂在厨房场景层，背景切换时不会被卸载）。
 *
 * 结构：外层 wrapper = 所在"站点"或滚动中的路径位置（x / y / 缩放 / 旋转），由统一时间轴直接映射；
 *       内层 img + 影子 = 原地的自主小跳（真实时间循环），只在停在站点时播放。
 * 站点：pan 锅里 · table 桌沿等待区 · spatula 锅铲 · bowl 饭碗。全部是场景坐标，来自 anchors（可调、可替换）。
 *
 * 每段由谁控制（beats 的 egg 字段）：
 *   loop     锅里自主跳（真实时间）；下一段要离开锅时，本段退出阶段收住跳跃
 *   toTable  进入阶段收住 → 动作阶段滚动控制：锅 → 桌沿弧线 → 停留阶段桌沿轻跳（真实时间）
 *   table    桌沿轻跳（真实时间）；站点按段换（anchors.tableAt：备菜段从左往右游走），换站只在进入阶段按滚动走短弧线；
 *            停留阶段小跳更少更小（阅读时收敛）；下一段要起飞时，本段退出阶段收住
 *   leap / air / flight（从空中）：一条连续的高跳轨迹 P(s)（anchors.traj，docs/EGG-JUMP.md）：L → M → E →（画外）→ R → C。
 *            蛋的位置 = P(显示参数)，显示参数用临界阻尼弹簧跟随 max(s_滚动, s_表演)：s_滚动由时间轴算，s_表演在前景表演开始
 *            （HEAR_EVENT start）时按真实时间从 0 到 sM（下蹲后上升，到 M 速度为 0）。位置和速度都连续，不瞬移、不二次起跳
 *   flight   进入阶段收住 → 动作阶段滚动控制：上一站（锅、桌沿或空中）→ 锅铲 → 落铲压扁回弹（一次性事件）；从空中时沿下落弧线从铲面右上方入画
 *   serve    滚动控制：锅铲 → 碗；bowl 停在碗里
 *   gone     已交给画着蛋的漫画：与交接格同步淡出
 * direct = true（新版）：滚动控制的位移直接设置，不再每帧重启补间；只有站点之间的离散跳变（快速拖动）用很短的补间接上。
 */
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import gsap from "gsap";
import { beatById, eggTravel, type Beat, type Timeline } from "@/lib/beats";
import { ANCHORS, Z } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";
import FollowMid from "./FollowMid";
import { KITCHEN_ONESHOT_EVENT } from "./useKitchenAudio";

const { eggRest: REST, eggSize: SIZE } = ANCHORS;

/** d：景深缩放系数（桌面站点才有；1 = 桌沿，越靠后越小），乘在 eggAtTable 上 */
export type Pt = { x: number; y: number; d?: number };

/** 蛋落地（真实时间的小跳落回桌面 / 锅里的那一下）：页面里的画框读它做"被震到"的小抖动。detail: { kind: "pan" | "table" } */
export const EGG_LAND_EVENT = "egg:land";
/** 有人点了蛋：蛋自己回一个小跳（EggPoke 派发） */
export const EGG_POKE_EVENT = "egg:poke";
const eggLand = (kind: "pan" | "table") => window.dispatchEvent(new CustomEvent(EGG_LAND_EVENT, { detail: { kind } }));
/**
 * 纸世界的帧率：蛋飞向锅铲的最后一段（actionP ≥ STEP_FROM）和落铲的压缩回弹按"一拍二"走（每 STEP_MS 才更新一次姿态，
 * 压缩用 steps 缓动），像从顺滑的厨房进入了一格一格的纸面；蛋回到空桌的碗里又恢复顺滑。网址加 ?step=0 关掉做对比。
 */
const STEP_FROM = 0.8, STEP_MS = 83;
const paperStepOn = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("step") !== "0";
/** 可调的定位点（场景像素，脚底中心）。不传时用 src/lib/scene.ts 的默认值。 */
export type EggAnchors = {
  panLaunch: Pt;
  tableWait: Pt;
  spatulaLand: Pt;
  bowlLand: Pt;
  eggAtTable: number;
  /** 可选：深色墨线描边（蛋图自己的轮廓是金色细线，和背景里胡萝卜、葱的深棕黑描边不是一个画风）；px 是蛋图原始像素（随蛋缩放） */
  ink?: { color: string; px: number };
  eggOnSpatula: number;
  eggInBowl: number;
  /** 可选：接蛋飞行的最高点（脚底的场景 y）。给了就越过接蛋格上框再落到铲面；不给用旧的固定抬升 */
  flightApexY?: number;
  /** 可选：飞行横向 ease-in（窄屏格子下方偏右模式，eggPath.flightEaseXFor） */
  flightEaseX?: boolean;
  /**
   * 可选：蛋停在铲面上的倾角（度，负 = 顶部向左倒向接蛋的妈妈）。给了就启用"朝妈妈"的姿态：
   * 飞行中身体逐渐倒向妈妈（再叠加 flightLean 的中途前倾），落到铲面时贴合铲面斜度，落地是一次轻压缩回弹后停稳；
   * 交接段先回正（与下一格画里直立的蛋一致）再短暂淡出。不给则保持旧的飞行自旋和直立落地。
   */
  spatulaTilt?: number;
  flightLean?: number;
  /**
   * 可选：交接段回正的同时把蛋缩到这个比例（相对铲面上的缩放），让外轮廓和下一格画里的蛋一样宽。
   * 以脚底为轴缩放，蛋一直站在接蛋格的铲面上；交接格按缩小后的蛋黄位置摆放（slots.ts handoffBox），交接点前后不跳。
   */
  handoffShrink?: number;
  /** 可选：每段的桌面站点（段 id → 脚底点；eggPath wanderTableFor）。没有的段用 tableWait */
  tableAt?: Record<string, Pt>;
  /** 可选：高跳轨迹 P(s)（eggPath.trajectoryFor）：L 起点 → M 视线相遇点 → E 出画点 → R 重新入画点 → C 铲面接触点 */
  traj?: EggTraj;
  /**
   * 可选：高跳的表演和跟随。event 的 detail.phase：start = 起跳（只在蛋确实在 L、每次进入一次时响应）；reset = 表演参数回 0
   * （蛋按弹簧落回 L）；stop 不处理（离场阶段每帧都会发）。crouch / rise 为秒；omega 为弹簧角频率（1/s）；
   * mToE = [leap 段 q, air 段 q]：滚动把蛋从 M 带到 E 的区间；lToM = leap 段 q：从这里到 mToE[0]，滚动把蛋从 L 带到 M
   * （表演已经把蛋带到 M 时取 max 不起作用；没触发表演就快速拖过时，蛋提前沿曲线离开 L，listen 停留之前已经出画）。
   */
  jump?: { event: string; crouch: number; rise: number; omega: number; mToE: [number, number]; lToM: number };
};

/**
 * 交接段（handoff enter 阶段进度）：先把活动蛋回正（下一格画里的蛋是直立的），交接格在活动蛋下方淡入——
 * 两颗蛋按蛋黄中心对位，活动蛋整颗盖住画里的蛋（slots.json scene.handoff），所以这期间只看得到一颗蛋；
 * 交接格完全不透明后，在 swap 这一点活动蛋瞬时消失（不淡化），画里的蛋接手。ScenePanels 读同一组数。
 */
export const HANDOFF = { straighten: [0, 0.35], panelIn: [0.47, 0.5], swap: 0.5, catchOut: [0.5, 0.68] } as const;

/** 可选的表情图：与 egg.webp 同画布、同轮廓、同脚底锚点，只改脸。没给（null）就一直用原图 */
/**
 * box：表情图在蛋的布局框（eggSize，脚底 = 底边中点）里的位置和大小（场景像素）。表情图的身体姿态和透明边距
 * 与原图不同时用它把图里的接触点放到脚底、外轮廓宽度对齐原图；不给就和原图一样铺满布局框。
 */
export type EggFaces = { fly?: string | null; rest?: string | null; box?: { left: number; top: number; width: number; height: number } };
type Face = "base" | "fly" | "rest";
export type EggTraj = { L: Pt; M: Pt; E: Pt; R: Pt; C: Pt; sM: number; sE: number; sR: number; scaleL: number; scaleC: number; tiltC: number };
const span = (v: number, [a, b]: readonly [number, number]) => clamp01((v - a) / (b - a));
export const DEFAULT_EGG_ANCHORS: EggAnchors = {
  panLaunch: ANCHORS.panLaunch,
  tableWait: { x: 120, y: 965 },
  spatulaLand: ANCHORS.spatulaLand,
  bowlLand: ANCHORS.bowlLand,
  eggAtTable: 0.5,
  eggOnSpatula: ANCHORS.eggOnSpatula,
  eggInBowl: ANCHORS.eggInBowl,
};

const LAND_SQUASH_S = beatById("catch")?.seconds.landSquash ?? 0.7;
const PAN_JUMP = 135;
const TABLE_HOP = 46;

type Station = "pan" | "table" | "spatula" | "bowl" | "air";
type Pose = { x: number; y: number; scale: number; rotation: number };
type Plan = {
  pose: Pose;
  station: Station | null; // null = 在路上（滚动控制）
  idle: "pan" | "table" | "ready" | "call" | null;
  settle: boolean;
  z: number;
  opacity: number;
  landing: Station | null; // 刚到达的站点（用于一次性落地回弹）
  /** 飞行的最后一段：姿态按"一拍二"更新（纸世界的帧率） */
  step?: boolean;
  /** 本段蛋要停下来的站点姿态（给漫画格避让读的站点框；在路上时 = 目的地，不跟着移动）；null = 不在桌面上 */
  rest?: Pose | null;
  /** 阅读停留阶段：站点小跳更少、更小 */
  calm?: boolean;
};
function inkFilter(ink?: { color: string; px: number }) {
  if (!ink) return undefined;
  const { color: c, px: p } = ink;
  return { filter: `drop-shadow(${p}px 0 0 ${c}) drop-shadow(${-p}px 0 0 ${c}) drop-shadow(0 ${p}px 0 ${c}) drop-shadow(0 ${-p}px 0 ${c})` };
}
const TABLE_LIKE = new Set(["toTable", "table", "ready", "leap"]);

const b_isFlight = (b: Beat) => b.egg === "flight";
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const bez = (a: number, b: number, c: number, t: number) => (1 - t) ** 2 * a + 2 * (1 - t) * t * b + t ** 2 * c;
const smooth = (t: number) => t * t * (3 - 2 * t);

function stationPose(st: Station, a: EggAnchors): Pose {
  const air = a.traj?.R ?? { x: a.tableWait.x, y: -400 };
  const p = st === "pan" ? a.panLaunch : st === "table" ? a.tableWait : st === "spatula" ? a.spatulaLand : st === "air" ? air : a.bowlLand;
  const scale = st === "pan" ? 1 : st === "table" ? a.eggAtTable * (a.tableWait.d ?? 1) : st === "air" ? a.eggAtTable : st === "spatula" ? a.eggOnSpatula : a.eggInBowl;
  return { x: p.x - REST.x, y: p.y - REST.y, scale, rotation: st === "spatula" ? (a.spatulaTilt ?? 0) : 0 };
}

/** 弧线：起点、终点、最高点抬升 lift；缩放线性插值，中途略放大表示靠近镜头 */
function arc(from: Station, to: Station, t: number, a: EggAnchors, lift: number, spin: number, drop = false): Pose {
  const A = stationPose(from, a), B = stationPose(to, a);
  const k = clamp01(t);
  const cx = (A.x + B.x) / 2, cy = Math.min(A.y, B.y) - lift;
  return {
    x: bez(A.x, cx, B.x, k),
    y: bez(A.y, cy, B.y, k),
    // 中途略放大（靠近镜头）：按起落两站中较小的缩放取相对量，窄屏缩小的蛋不会在半空突然变大一半
    // drop（锅 → 桌面）：缩得更早（ease-out）、不在半空放大，蛋很快回到桌面该有的大小，不再又大又飘在墙前
    scale: drop
      ? A.scale + (B.scale - A.scale) * (1 - (1 - k) ** 2.6)
      : A.scale + (B.scale - A.scale) * k + 0.24 * Math.min(A.scale, B.scale) * Math.sin(Math.PI * k),
    rotation: spin * Math.sin(Math.PI * k),
  };
}

/**
 * 接蛋飞行路径（脚底中心，场景像素）：二次贝塞尔，最高点正好到 apexY，最高点的 x 落在全程的 apexAt 处，
 * 所以蛋从桌沿起跳后很快升到格子上框之上，再从上方落到铲面，不在妈妈头部和对白泡上方停留。
 * 镜头跟随（page.tsx）读同一条路径。
 */
export function flightPoint(A: Pt, B: Pt, apexY: number, t: number, apexAt = 0.6, easeX = false): Pt {
  const k = clamp01(t);
  const H = Math.min(apexY, Math.min(A.y, B.y) - 40);
  const cy = H - Math.sqrt((A.y - H) * (B.y - H)); // 让曲线最高点 = H
  const ts = (A.y - cy) / (A.y + B.y - 2 * cy); // 最高点所在的 t
  const X = A.x + apexAt * (B.x - A.x);
  const cx = (X - (1 - ts) ** 2 * A.x - ts ** 2 * B.x) / (2 * (1 - ts) * ts);
  // easeX（窄屏“格子下方偏右”）：横向用 ease-in，蛋先近乎竖直上升，后段才向左落到铲面，不往右鼓、不掠过铲尖；纵向不变
  return { x: easeX ? A.x + (B.x - A.x) * k * k : bez(A.x, cx, B.x, k), y: bez(A.y, cy, B.y, k) };
}

/**
 * 桌面上换站（两站之间按滚动走）：贴着桌面连跳几下（每 ~180 场景像素一下，至少两下），抬得低，
 * 不会升进上方漫画格的范围被格子挡住；每一下身体往前进方向轻轻一歪，缩放不变。
 */
function hopBetween(A: Pt, B: Pt, t: number, scaleA: number, scaleB: number, lift: number, spin: number): Pose {
  const k = clamp01(t);
  // 跳上 / 跳下道具（两站纵向差大）：只跳一下，弧顶抬得高（不在空中连跳，也不贴着墙滑过去）
  const climb = Math.abs(B.y - A.y) > 100;
  const n = climb ? 1 : Math.max(2, Math.round(Math.abs(B.x - A.x) / 180));
  if (climb) lift = Math.max(lift, 150);
  const ph = (k * n) % 1, hop = k >= 1 ? 0 : Math.sin(Math.PI * ph);
  return { x: A.x + (B.x - A.x) * k - REST.x, y: A.y + (B.y - A.y) * k - lift * hop - REST.y, scale: scaleA + (scaleB - scaleA) * smooth(k), rotation: spin * hop };
}
/**
 * 高跳轨迹上参数 s 处的脚底点（场景像素）：
 *   L → M：三次贝塞尔，从桌面向上起跳、朝她的视线方向，最后竖直到达 M（与下一段同方向，速度方向连续）；
 *   M → E：竖直向上越过画面上缘；E → R：画布上沿之外的直线（全程在画外）；
 *   R → C：横向匀速、纵向加速（ease-in）落到铲面，从铲面右上方斜着下来。
 */
export function trajFoot(T: EggTraj, s: number): Pt {
  const k = clamp01(s);
  const { L, M, E, R, C } = T;
  if (k <= T.sM) {
    // L → M：抛物线（用户要的就是抛物线，不是平飞）：x 匀速、y 在 L → M 的直线上再叠一个向上的拱（4u(1−u)·H），
    // 身体顺着切线倾斜（见 trajPose）
    const u = k / T.sM;
    return { x: L.x + (M.x - L.x) * u, y: L.y + (M.y - L.y) * u - 4 * u * (1 - u) * flyArch(T) };
  }
  if (k <= T.sE) { const u = (k - T.sM) / (T.sE - T.sM); return { x: M.x + (E.x - M.x) * u, y: M.y + (E.y - M.y) * u }; }
  if (k <= T.sR) { const u = (k - T.sE) / (T.sR - T.sE); return { x: E.x + (R.x - E.x) * u, y: E.y + (R.y - E.y) * u }; }
  const u = (k - T.sR) / (1 - T.sR);
  return { x: R.x + (C.x - R.x) * u, y: R.y + (C.y - R.y) * u * u };
}
/** 平飞段的参数：匀速为主，起步和收尾各缓一点 */
const FLY_F = 0.1;
const flyEase = (u: number) => u * u * (3 - 2 * u) * 0.35 + u * 0.65;
function trajPose(T: EggTraj, s: number): Pose {
  const f = trajFoot(T, s);
  const u = s > T.sR ? (s - T.sR) / (1 - T.sR) : 0;
  // 抛物线（L → M）：身体顺着切线倾斜（上升时头朝前上方、过顶后头朝前下方，最多 80°），起飞瞬间从 0 缓入、到 M 回正
  let lean = 0;
  if (s < T.sM) {
    const v = s / T.sM;
    const tx = T.M.x - T.L.x, ty = T.M.y - T.L.y - 4 * (1 - 2 * v) * flyArch(T);
    const ang = Math.max(-80, Math.min(80, (Math.atan2(tx, -ty) * 180) / Math.PI));
    const sm = (q: number) => { const c = clamp01(q); return c * c * (3 - 2 * c); };
    lean = ang * sm(v / 0.1) * (1 - sm((v - 0.85) / 0.15));
  }
  return { x: f.x - REST.x, y: f.y - REST.y, scale: T.scaleL + (T.scaleC - T.scaleL) * u, rotation: T.tiltC * u + lean };
}

/** 本段之前，蛋最后停在哪一站（决定 flight 从哪起飞） */
function lastStationBefore(beats: Beat[], index: number): Station {
  for (let i = index - 1; i >= 0; i--) {
    const e = beats[i].egg;
    if (e === "air" || e === "leap") return "air";
    if (e === "toTable" || e === "table" || e === "ready") return "table";
    if (e === "flight") return "spatula";
    if (e === "loop") return "pan";
  }
  return "pan";
}

function plan(t: Timeline, beats: Beat[], a0: EggAnchors): Plan {
  const b = t.beat;
  // 本段的桌面站点（游走）：station "table" 读 a.tableWait，这里换成本段的点
  const tableAt = (i: number): Pt => (i >= 0 && beats[i] ? a0.tableAt?.[beats[i].id] : undefined) ?? a0.tableWait;
  const a: EggAnchors = { ...a0, tableWait: tableAt(t.index) };
  const next = beats[t.index + 1];
  const exiting = t.phase === "exit";
  // 行进进度与落点都读共享事件（beats.ts eggTravel / eventAt），声音的落铲触发点读的是同一个值
  const trav = eggTravel(b);
  const actionP = trav ? clamp01((t.p - trav.start) / Math.max(1e-6, trav.land - trav.start)) : t.phase === "action" ? t.phaseP : t.phase === "enter" ? 0 : 1;
  const before = trav ? t.p < trav.start : t.phase === "enter";
  const travelling = trav ? t.p >= trav.start && t.p < trav.land : t.phase === "action";
  const base = (st: Station, idle: Plan["idle"], z: number): Plan => ({ pose: stationPose(st, a), station: st, idle, settle: false, z, opacity: 1, landing: null });
  switch (b.egg) {
    case "loop": {
      const P = base("pan", "pan", Z.eggInPan);
      P.settle = !!next && next.egg !== "loop" && exiting;
      return P;
    }
    case "toTable": {
      if (before) return { ...base("pan", "pan", Z.eggInPan), settle: true, rest: stationPose("table", a) };
      if (travelling) return { pose: arc("pan", "table", smooth(actionP), a, 60, 12, true), station: null, idle: null, settle: false, z: Z.eggOnTable, opacity: 1, landing: null, rest: stationPose("table", a) };
      const P = base("table", "table", Z.eggOnTable);
      P.landing = "table";
      P.rest = P.pose;
      P.settle = !!next && (next.egg === "flight" || next.egg === "leap") && exiting;
      return P;
    }
    case "table":
    case "ready":
    case "leap": {
      // 换站：上一段也在桌面、而且点不同 → 本段进入阶段按滚动沿短弧线跳过去（承接当前位置，不瞬移）
      const prev = beats[t.index - 1];
      const from = prev && TABLE_LIKE.has(prev.egg) ? tableAt(t.index - 1) : null;
      const to = a.tableWait;
      const rest = stationPose("table", a);
      if (from && (from.x !== to.x || from.y !== to.y) && t.phase === "enter") {
        const k = smooth(t.phaseP);
        return { pose: hopBetween(from, to, k, a.eggAtTable * (from.d ?? 1), a.eggAtTable * (to.d ?? 1), 42 * Math.min(from.d ?? 1, to.d ?? 1), to.x > from.x ? 7 : -7), station: null, idle: null, settle: false, z: Z.eggOnTable, opacity: 1, landing: null, rest };
      }
      const P = base("table", b.egg === "ready" ? "ready" : "table", Z.eggOnTable);
      P.rest = rest;
      P.landing = "table"; // 换站后第一次停下：一次落地回弹（同一站上来回滚动不重播）
      if (b.egg === "ready") P.settle = exiting; // 环境段：桌沿蓄力（真实时间：压低、左右扭、准备跳），离开前收住
      else if (b.egg === "leap") P.settle = true; // 等着起跳：不再自己小跳
      else { P.settle = !!next && (next.egg === "flight" || next.egg === "leap") && exiting; P.calm = t.phase === "hold"; }
      return P;
    }
    case "air":
      return { ...base("air", null, Z.eggFlying), rest: null };
    case "inBowl": {
      // 环境段：空饭桌上碗里的蛋（后景）。进入阶段等漫画格离开后才淡入，退出阶段在下一段漫画（画着碗里的蛋）进来前淡出
      const P = base("bowl", "call", Z.eggOnTable);
      P.opacity = t.phase === "enter" ? clamp01((t.phaseP - 0.4) / 0.5) : t.phase === "exit" ? 1 - clamp01(t.phaseP / 0.6) : 1;
      return P;
    }
    case "flight": {
      const from = lastStationBefore(beats, t.index);
      if (before) return { ...base(from, from === "pan" ? "pan" : from === "air" ? null : "table", from === "pan" ? Z.eggInPan : from === "air" ? Z.eggFlying : Z.eggOnTable), settle: true };
      if (travelling) {
        const pose = arc(from, "spatula", actionP, a, 380, -18);
        if (from === "air" && a.traj) {
          // 高跳轨迹的最后一段（R → C）；实际显示由弹簧跟随（见组件），这里给出同一条曲线上的目标姿态
          return { pose: trajPose(a.traj, a.traj.sR + (1 - a.traj.sR) * actionP), station: null, idle: null, settle: false, z: Z.eggFlying, opacity: 1, landing: null, step: actionP >= STEP_FROM };
        } else if (a.flightApexY !== undefined) {
          const f = flightPoint(from === "pan" ? a.panLaunch : a.tableWait, a.spatulaLand, a.flightApexY, actionP, 0.6, !!a.flightEaseX);
          pose.x = f.x - REST.x;
          pose.y = f.y - REST.y;
        }
        if (a.spatulaTilt !== undefined) {
          // 身体逐渐倒向妈妈，中途多前倾一点，落到铲面时正好是铲面上的倾角（与停稳姿态无缝衔接）
          pose.rotation = a.spatulaTilt * smooth(actionP) + (a.flightLean ?? 0) * Math.sin(Math.PI * actionP);
        }
        return { pose, station: null, idle: null, settle: false, z: Z.eggFlying, opacity: 1, landing: null, step: actionP >= STEP_FROM };
      }
      return { ...base("spatula", null, Z.eggFlying), landing: "spatula" };
    }
    case "serve": {
      if (travelling) return { pose: arc("spatula", "bowl", actionP, a, 110, 8), station: null, idle: null, settle: false, z: Z.eggFlying, opacity: 1, landing: null };
      return before ? base("spatula", null, Z.eggFlying) : { ...base("bowl", null, Z.eggFlying), landing: "bowl" };
    }
    case "bowl":
      return base("bowl", null, Z.eggFlying);
    case "gone": {
      const P = base("spatula", null, Z.eggFlying);
      // 只有交接那一段（上一段蛋还在）才淡出；之后的 gone 段始终隐藏，避免蛋在后续各段的进入阶段重新闪现
      const prev = beats[t.index - 1];
      const handingOff = !!prev && prev.egg === "flight"; // 只有接蛋之后的交接段淡出
      if (a.spatulaTilt !== undefined) {
        // 回正并缩小 → 交接格在 swap 点前很短的区间淡入 → swap 点瞬时交接
        const e = t.phase === "enter" ? t.phaseP : 1;
        const k = smooth(span(e, HANDOFF.straighten));
        P.pose.rotation = a.spatulaTilt * (1 - k);
        // 回正的同时以脚底为轴缩到画里那颗蛋的外轮廓宽度（蛋仍站在铲面上）
        if (a.handoffShrink !== undefined) P.pose.scale *= 1 + (a.handoffShrink - 1) * k;
        P.opacity = handingOff && t.phase === "enter" && e < HANDOFF.swap ? 1 : 0;
      } else P.opacity = handingOff && t.phase === "enter" ? 1 - clamp01((t.phaseP - 0.25) / 0.75) : 0;
      return P;
    }
  }
}

type JumpLive = { T?: EggTraj; jump?: EggAnchors["jump"]; reduced: boolean; P: Plan; setFace: (f: Face) => void };
type Ref<T> = { current: T };
type JumpEnv = {
  wrap: Ref<HTMLDivElement | null>; egg: Ref<HTMLDivElement | null>; shadow: Ref<HTMLDivElement | null>; dot: Ref<SVGCircleElement | null>;
  live: Ref<JumpLive>; lastStation: Ref<Station | null>; lastLanding: Ref<Station | null>; restArmed: Ref<boolean>; land: Ref<(s: HTMLDivElement) => void>;
  /** 控制器写：轨迹是否在移动蛋（组件里的表情、站点、小跳逻辑读它） */
  active: Ref<boolean>;
};
type JumpController = ReturnType<typeof createJumpController>;
/**
 * 高跳轨迹控制器（组件挂载时建一次）：显示参数 x 用临界阻尼弹簧跟随目标 max(scroll, perf)，位置和速度都连续。
 * x 离开 0（L）且没有停在 1（C）时，由它在每一帧把蛋放到 P(x)；回到 L 带落桌回弹，到达 C 触发落铲回弹，然后交还给站点逻辑。
 */
function createJumpController(env: JumpEnv) {
  const st = { x: 0, v: 0, perf: 0, scroll: 0, active: false, raf: 0, last: 0, played: false, stepT: 0 };
  let crouch: gsap.core.Timeline | null = null;
  let perfTw: gsap.core.Tween | null = null;
  const perfObj = { v: 0 };
  const dotAt = (x: number, y: number) => { const d = env.dot.current; if (d) { d.setAttribute("cx", String(x)); d.setAttribute("cy", String(y)); } };
  const applyTraj = (x: number, force = false) => {
    const w = env.wrap.current, T = env.live.current.T;
    if (!w || !T) return;
    // 落铲前最后一段按"一拍二"（纸世界的帧率）
    if (!force && x > T.sR + 0.8 * (1 - T.sR) && x < 1 && paperStepOn() && !env.live.current.reduced) {
      const now = performance.now();
      if (now - st.stepT < STEP_MS) return;
      st.stepT = now;
    }
    const p = trajPose(T, x);
    gsap.set(w, { x: p.x, y: p.y, scale: p.scale, rotation: p.rotation, transformOrigin: "50% 100%", overwrite: true });
    dotAt(p.x + REST.x, p.y + REST.y);
  };
  const activate = () => {
    const egg = env.egg.current, shadow = env.shadow.current;
    st.active = true;
    env.active.current = true;
    if (egg && !crouch) gsap.to(egg, { y: 0, scaleX: 1, scaleY: 1, rotation: 0, duration: 0.12, overwrite: true });
    if (shadow) gsap.set(shadow, { opacity: 0 }); // 离开桌面：后景不留影子
    // 起跳表演进行中时，换成飞行图由下蹲后的"转身"那一帧负责（见 cue）；被滚动带离 L 时在这里换
    if (!crouch) env.live.current.setFace("fly");
    env.lastStation.current = null;
    env.lastLanding.current = null;
  };
  const deactivate = (at: "L" | "C") => {
    const w = env.wrap.current, egg = env.egg.current, shadow = env.shadow.current, lv = env.live.current;
    st.active = false;
    env.active.current = false;
    applyTraj(at === "L" ? 0 : 1, true);
    if (at === "C") {
      env.lastStation.current = "spatula";
      env.lastLanding.current = "spatula";
      if (egg && !lv.reduced) env.land.current(egg); else { env.restArmed.current = true; lv.setFace("rest"); }
    } else {
      env.lastStation.current = "table";
      env.lastLanding.current = "table";
      if (shadow) gsap.to(shadow, { opacity: 0.45, scale: 1, duration: 0.2 });
      if (egg && !lv.reduced) {
        eggLand("table");
        // 落回桌面时"转身"回正面：横向一收，收到最窄的那一帧换回原图，再接落桌回弹
        gsap.timeline().to(egg, { scaleX: 0.78, scaleY: 1.05, duration: 0.06, ease: "power2.in", transformOrigin: "50% 100%", overwrite: true })
          .call(() => { if (!st.active) env.live.current.setFace("base"); })
          .to(egg, { scaleX: 1.16, scaleY: 0.82, duration: 0.09, ease: "power1.out" })
          .to(egg, { scaleX: 1, scaleY: 1, duration: 0.4, ease: "elastic.out(1, 0.45)" });
      } else lv.setFace("base");
    }
    // 交还给站点：本段要停的位置若不同（快速倒滚到更早的段、交接段的回正缩小），平滑接过去
    const Pn = lv.P;
    if (w && Pn.station !== null) {
      const gx = gsap.getProperty(w, "x") as number, gy = gsap.getProperty(w, "y") as number, gs = gsap.getProperty(w, "scale") as number;
      if (Math.abs(Pn.pose.x - gx) > 1 || Math.abs(Pn.pose.y - gy) > 1 || Math.abs(Pn.pose.scale - gs) > 0.005)
        gsap.to(w, { x: Pn.pose.x, y: Pn.pose.y, scale: Pn.pose.scale, rotation: Pn.pose.rotation, duration: 0.25, ease: "power2.out", overwrite: true });
    }
  };
  const tick = (now: number) => {
    const lv = env.live.current, T = lv.T;
    st.raf = 0;
    if (!T || !lv.jump) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - st.last) / 1000));
    st.last = now;
    const tgt = Math.max(st.scroll, st.perf);
    if (lv.reduced) { st.x = tgt; st.v = 0; }
    else {
      // 临界阻尼弹簧（精确解）：位置和速度都连续
      // 滚动已经要求蛋出画（目标越过 E）而蛋还没出去：弹簧加快追上（快速拖过时 listen 停留阶段画面里不留蛋），仍然连续
      // 滚动带着走、蛋落后较多时也加快一些（起跳表演自己的上升不加速，免得起跳一下猛冲）
      const w0 = lv.jump.omega * (tgt >= T.sE && st.x < T.sE ? 3.5 : st.scroll - st.x > 0.08 ? 2 : 1), d = st.x - tgt, e = Math.exp(-w0 * dt);
      const nd = (d + (st.v + w0 * d) * dt) * e;
      st.v = (st.v - w0 * (st.v + w0 * d) * dt) * e;
      st.x = tgt + nd;
    }
    const settled = Math.abs(st.x - tgt) < 0.0015 && Math.abs(st.v) < 0.02;
    if (settled && tgt <= 0) { st.x = 0; st.v = 0; if (st.active) deactivate("L"); return; }
    if (settled && tgt >= 1) { st.x = 1; st.v = 0; if (st.active) deactivate("C"); return; }
    if (!st.active) activate();
    applyTraj(st.x);
    if (!settled || perfTw) st.raf = requestAnimationFrame(tick);
    else { st.x = tgt; st.v = 0; applyTraj(st.x, true); } // 停在轨迹中途（在 M 定格、停止滚动）：到下一次目标变化再继续
  };
  const ensureLoop = () => { if (!st.raf) { st.last = performance.now(); st.raf = requestAnimationFrame(tick); } };
  return {
    state: st,
    /** 站点逻辑在做原地小跳 / 被点之前问一下：轨迹或起跳下蹲在进行就别动 */
    busy: () => st.active || !!crouch,
    /** 每次渲染：更新 s_滚动；目标变了就立即接管（同一帧），不留一帧给站点逻辑摆旧姿态 */
    sync(scroll: number | null) {
      if (scroll === null) return;
      st.scroll = scroll;
      const tgt = Math.max(st.scroll, st.perf);
      if (st.active || Math.abs(tgt - st.x) > 0.0005) {
        if (!st.active && ((tgt > 0 && st.x < 1) || (tgt < 1 && st.x > 0))) { activate(); applyTraj(st.x, true); }
        ensureLoop();
      }
    },
    /** 前景表演事件：start 起跳（只在 L、每次进入一次）；reset 表演参数回 0；stop 不处理 */
    cue(phase?: string) {
      const lv = env.live.current, T = lv.T, jp = lv.jump;
      if (!T || !jp) return;
      if (phase === "reset") {
        st.played = false;
        crouch?.kill(); crouch = null;
        perfTw?.kill(); perfTw = null;
        if (st.perf !== 0) { st.perf = 0; perfObj.v = 0; ensureLoop(); }
        return;
      }
      if (phase !== "start" || st.played || lv.reduced) return;
      st.played = true;
      if (st.x > 0.02 || st.scroll > 0 || st.active) return; // 已被滚动带离 L：只接上进度，不起跳、不补放起跳声
      const egg = env.egg.current, shadow = env.shadow.current;
      if (!egg || !shadow) return;
      gsap.killTweensOf(egg);
      crouch = gsap.timeline({ onComplete: () => { crouch = null; } })
        .to(egg, { scaleX: 1.14, scaleY: 0.84, y: 0, rotation: 0, duration: jp.crouch, ease: "power2.out", transformOrigin: "50% 100%" })
        .to(shadow, { scale: 1.1, opacity: 0.55, duration: jp.crouch }, "<")
        .call(() => {
          if (st.x <= 0.02 && !st.active) {
            window.dispatchEvent(new CustomEvent(KITCHEN_ONESHOT_EVENT, { detail: { sound: "hopTap1", gain: 0.6 } }));
            window.setTimeout(() => window.dispatchEvent(new CustomEvent(KITCHEN_ONESHOT_EVENT, { detail: { sound: "pop" } })), 60);
          }
          // 上升：ease-out，到 M 时速度为 0；弹簧跟随，位置和速度连续
          perfObj.v = st.perf;
          perfTw = gsap.to(perfObj, { v: T.sM, duration: jp.rise, ease: "power2.out", onUpdate: () => { st.perf = perfObj.v; ensureLoop(); }, onComplete: () => { perfTw = null; ensureLoop(); } });
          ensureLoop();
        })
        // "转身"：蹬离后身体向上拉长的同时横向一收（像转过身面向妈妈），收到最窄的那一帧换成飞行图，再展开。
        // 原图（正面）和飞行图（朝左下）是两张不同的画，直接换会跳；收窄到 0.76 再展开，换图读成转身动作
        .to(egg, { scaleX: 0.76, scaleY: 1.14, duration: 0.07, ease: "power2.in" })
        .call(() => { if (st.active || st.perf > 0) env.live.current.setFace("fly"); })
        .to(egg, { scaleX: 1.03, scaleY: 1.04, duration: 0.1, ease: "power2.out" })
        .to(egg, { scaleX: 1, scaleY: 1, duration: 0.18, ease: "sine.out" });
    },
    dispose() { cancelAnimationFrame(st.raf); perfTw?.kill(); crouch?.kill(); },
  };
}

/** 某段某进度在整条滚动上的位置（vh） */
function vhAt(beats: Beat[], i: number, q: number) {
  let v = 0;
  for (let k = 0; k < i; k++) v += beats[k].lengthVh;
  return v + beats[i].lengthVh * q;
}
/**
 * 高跳轨迹的滚动参数 s_滚动（纯由时间轴算）：leap 段 lToM 之前为 0 → 到 mToE[0] 从 0 走到 sM → 到 air 段 mToE[1] 从 sM 走到 sE →
 * 到接蛋段动作开始从 sE 走到 sR（画外）→ 动作阶段（共享事件 eggTravel）从 sR 走到 1 → 之后为 1
 */
function scrollParam(t: Timeline, beats: Beat[], T: EggTraj, mToE: [number, number], lToM: number) {
  const hi = beats.findIndex((b) => b.egg === "leap"), ai = beats.findIndex((b) => b.egg === "air");
  const ci = beats.findIndex((b, i) => i > ai && b.egg === "flight");
  if (hi < 0 || ai < 0 || ci < 0) return 0;
  const cur = vhAt(beats, t.index, t.p);
  const l0 = vhAt(beats, hi, lToM), a0 = vhAt(beats, hi, mToE[0]), a1 = vhAt(beats, ai, mToE[1]);
  const tr = eggTravel(beats[ci]);
  const b1 = vhAt(beats, ci, tr?.start ?? 0.22), c1 = vhAt(beats, ci, tr?.land ?? 0.8);
  if (cur < l0) return 0;
  if (cur < a0) return (T.sM * (cur - l0)) / (a0 - l0);
  if (cur < a1) return T.sM + ((T.sE - T.sM) * (cur - a0)) / (a1 - a0);
  if (cur < b1) return T.sE + ((T.sR - T.sE) * (cur - a1)) / (b1 - a1);
  if (cur < c1) return T.sR + ((1 - T.sR) * (cur - b1)) / (c1 - b1);
  return 1;
}
const trailOn = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("trail") === "1";

export default function Egg({ src = "/assets/scene/egg.webp", anchors, direct = false, faces }: { src?: string; anchors?: Partial<EggAnchors>; direct?: boolean; faces?: EggFaces }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stationRef = useRef<HTMLDivElement>(null); // 站点框（不可见）：漫画格避让读它，不跟着蛋的换站、小跳、高跳移动
  const eggRef = useRef<HTMLDivElement>(null); // 压缩回弹、原地小跳都作用在这一层（底图和表情图一起变形）
  const baseImgRef = useRef<HTMLImageElement>(null);
  const flyImgRef = useRef<HTMLImageElement>(null);
  const restImgRef = useRef<HTMLImageElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const { reducedMotion, timeline, beats } = useScene();
  const aKey = JSON.stringify(anchors ?? {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const a: EggAnchors = useMemo(() => ({ ...DEFAULT_EGG_ANCHORS, ...anchors }), [aKey]);
  const P = plan(timeline, beats, a);
  const sScroll = a.traj && a.jump ? scrollParam(timeline, beats, a.traj, a.jump.mToE, a.jump.lToM) : 0;
  const trail = useSyncExternalStore(() => () => {}, trailOn, () => false);

  // ---- 表情：直接切换（不做交叉淡化，任何时刻只显示一张脸） ----
  // fly：接蛋飞行途中（滚动控制）；rest：由落铲那一次真实时间事件在压缩到底时切换，不跟滚动快慢走；其余用原图
  const faceNow = useRef<Face>("base");
  const restArmed = useRef(false); // 本次落铲事件已切到 rest
  const setFace = (f: Face) => {
    const want: Face = f !== "base" && !faces?.[f] ? "base" : f;
    faceNow.current = want;
    const els: [Face, HTMLImageElement | null][] = [["base", baseImgRef.current], ["fly", flyImgRef.current], ["rest", restImgRef.current]];
    for (const [k, el] of els) if (el) el.style.visibility = k === want ? "visible" : "hidden";
  };
  const onSpatula = P.station === "spatula";
  const flying = b_isFlight(timeline.beat) && P.station === null;
  useEffect(() => {
    if (trajActive.current) return; // 高跳轨迹进行中：表情由轨迹控制器管（腾空 = fly）
    if (flying) { restArmed.current = false; setFace("fly"); }
    // 在铲面上：落铲事件切到 rest 之后保持；直接跳进交接段（没有经过落地，P.landing 为空）也直接用 rest
    else if (onSpatula) { if (restArmed.current || reducedMotion || P.landing === null) setFace("rest"); }
    else { restArmed.current = false; setFace("base"); }
  });

  // ---- 外层：位置（滚动控制或站点） ----
  const stepRef = useRef<{ t: number; id: number; vars: gsap.TweenVars | null }>({ t: 0, id: 0, vars: null });
  useEffect(() => () => { window.clearTimeout(stepRef.current.id); }, []);
  const lastStation = useRef<Station | null>(null);
  const lastLanding = useRef<Station | null>(null);
  // ---- 高跳轨迹控制器（createJumpController）：显示参数用临界阻尼弹簧跟随 max(s_滚动, s_表演)；蛋离开 L、还没到 C 时由它移动蛋 ----
  const trailDot = useRef<SVGCircleElement>(null);
  const live = useRef<JumpLive>({ T: a.traj, jump: a.jump, reduced: reducedMotion, P, setFace });
  const ctl = useRef<JumpController | null>(null);
  const trajActive = useRef(false); // 控制器写，组件读
  const landSpatula = (s: HTMLDivElement) => {
    // 落铲：一次轻微压缩 → 小回弹 → 停稳（不连续弹跳，压缩量小，五官不变形）
    const stepped = paperStepOn();
    gsap.timeline()
      .to(s, { scaleX: 1.08, scaleY: 0.9, duration: LAND_SQUASH_S * 0.13, ease: stepped ? "steps(2)" : "power2.out", transformOrigin: "50% 100%", overwrite: "auto" })
      // 压缩到底的那一刻换成安心表情（同一次落地事件，真实时间；若此时已经被滚回飞行中就不换）
      .call(() => { if (lastStation.current === "spatula" && !trajActive.current) { restArmed.current = true; live.current.setFace("rest"); } })
      .to(s, { scaleX: 0.98, scaleY: 1.03, duration: LAND_SQUASH_S * 0.2, ease: stepped ? "steps(2)" : "sine.out" })
      .to(s, { scaleX: 1, scaleY: 1, duration: LAND_SQUASH_S * 0.3, ease: stepped ? "steps(3)" : "sine.inOut" });
  };
  const landRef = useRef(landSpatula);
  useEffect(() => {
    const c = createJumpController({ wrap: wrapRef, egg: eggRef, shadow: shadowRef, dot: trailDot, live, lastStation, lastLanding, restArmed, land: landRef, active: trajActive });
    ctl.current = c;
    return () => { c.dispose(); ctl.current = null; };
  }, []);
  useEffect(() => {
    live.current = { T: a.traj, jump: a.jump, reduced: reducedMotion, P, setFace };
    landRef.current = landSpatula;
    ctl.current?.sync(a.traj && a.jump ? sScroll : null);
  });
  // 起跳表演：只在蛋确实在 L（显示参数接近 0）时响应 start，每次进入一次；reset 只把 s_表演 放回 0；stop 不处理（离场阶段每帧都发）
  const jumpEvent = a.jump && a.traj ? a.jump.event : null;
  useEffect(() => {
    if (!jumpEvent) return;
    const on = (e: Event) => ctl.current?.cue((e as CustomEvent<{ phase?: string }>).detail?.phase);
    window.addEventListener(jumpEvent, on);
    return () => window.removeEventListener(jumpEvent, on);
  }, [jumpEvent]);

  useEffect(() => {
    const w = wrapRef.current;
    if (!w) return;
    // 漫画格避让读的站点框：本段要停下的站点（在路上时是目的地，不跟着蛋移动）；不在桌面上时移到画外
    const sm = stationRef.current;
    if (sm) gsap.set(sm, P.rest ? { x: P.rest.x, y: P.rest.y, scale: P.rest.scale, rotation: 0, transformOrigin: "50% 100%" } : { x: 0, y: -100000 });
    const dot = trailDot.current;
    if (dot) { dot.setAttribute("cx", String(P.pose.x + REST.x)); dot.setAttribute("cy", String(P.pose.y + REST.y)); }
    // 高跳轨迹进行中：位置由轨迹控制器管
    if (trajActive.current) return;
    const discrete = P.station !== null && lastStation.current !== P.station; // 换站（含快速拖过整段）
    const vars = { x: P.pose.x, y: P.pose.y, scale: P.pose.scale, rotation: P.pose.rotation, transformOrigin: "50% 100%" };
    if (reducedMotion) gsap.set(w, vars);
    else if (direct && P.station === null) {
      // 滚动主运动：直接映射；飞行最后一段按"一拍二"（纸世界），停下滚动后由尾部定时器把最终姿态补上
      const st = stepRef.current;
      if (P.step && paperStepOn()) {
        st.vars = vars;
        const now = performance.now();
        if (now - st.t >= STEP_MS) { st.t = now; gsap.set(w, { ...vars, overwrite: true }); }
        else if (!st.id) st.id = window.setTimeout(() => { st.id = 0; st.t = performance.now(); if (st.vars) gsap.set(w, { ...st.vars, overwrite: true }); }, STEP_MS - (now - st.t));
      } else {
        if (st.id) { window.clearTimeout(st.id); st.id = 0; }
        gsap.set(w, { ...vars, overwrite: true });
      }
    }
    else if (direct) gsap.to(w, { ...vars, duration: discrete ? 0.22 : 0.0, ease: "power2.out", overwrite: true });
    else gsap.to(w, { ...vars, duration: 0.3, ease: "power2.out", overwrite: true });
    lastStation.current = P.station;
    // 一次性落地回弹：第一次到达桌沿 / 锅铲 / 碗
    if (P.landing && lastLanding.current !== P.landing && !reducedMotion && eggRef.current) {
      const s = eggRef.current;
      if (P.landing === "spatula" && a.spatulaTilt !== undefined) landSpatula(s);
      else
        gsap.timeline()
          .to(s, { scaleX: 1.18, scaleY: 0.8, duration: LAND_SQUASH_S * 0.15, ease: "power1.out", transformOrigin: "50% 100%" })
          .to(s, { scaleX: 1, scaleY: 1, duration: LAND_SQUASH_S * 0.85, ease: "elastic.out(1, 0.45)" });
    }
    // 停在同一站上（如接蛋停留 → 交接段）不算离开，来回滚动不会重播落地回弹；真正离开（飞起、换站）才重新计
    if (P.landing || P.station !== lastLanding.current) lastLanding.current = P.landing;
  });

  // ---- 被点了一下（彩蛋）：回一个小跳；在路上（滚动控制）或在抬头一跳时不理 ----
  useEffect(() => {
    const onPoke = () => {
      const egg = eggRef.current, shadow = shadowRef.current;
      const st = lastStation.current;
      if (!egg || !shadow || reducedMotion || st === null || st === "air" || ctl.current?.busy()) return;
      const H = st === "pan" ? PAN_JUMP * 0.55 : TABLE_HOP * 1.2;
      gsap.killTweensOf([egg, shadow]);
      gsap.timeline()
        .to(egg, { scaleX: 1.14, scaleY: 0.84, duration: 0.08, ease: "power2.out", transformOrigin: "50% 100%" })
        .to(egg, { y: -H, scaleX: 0.95, scaleY: 1.08, rotation: -5, duration: 0.2, ease: "power2.out" })
        .to(shadow, { scale: 0.65, opacity: 0.2, duration: 0.2 }, "<")
        .to(egg, { y: 0, rotation: 0, scaleX: 0.97, scaleY: 1.05, duration: 0.2, ease: "power2.in" })
        .to(shadow, { scale: 1, opacity: 0.45, duration: 0.2 }, "<")
        .call(() => eggLand(st === "pan" ? "pan" : "table"))
        .to(egg, { scaleX: 1.16, scaleY: 0.82, duration: 0.08, ease: "power1.out" })
        .to(egg, { scaleX: 1, scaleY: 1, duration: 0.4, ease: "elastic.out(1, 0.45)" });
    };
    window.addEventListener(EGG_POKE_EVENT, onPoke);
    return () => window.removeEventListener(EGG_POKE_EVENT, onPoke);
  }, [reducedMotion]);

  // ---- 内层：站点上的自主小跳（真实时间） ----
  const settleRef = useRef(P.settle);
  const calmRef = useRef(!!P.calm);
  useEffect(() => { calmRef.current = !!P.calm; }, [P.calm]);
  const kickRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    settleRef.current = P.settle;
    if (!P.settle) kickRef.current?.();
  }, [P.settle]);
  const idle = P.station !== null ? P.idle : null;
  useEffect(() => {
    const egg = eggRef.current;
    const shadow = shadowRef.current;
    if (!egg || !shadow) return;
    if (!idle || reducedMotion) {
      gsap.to(egg, { y: 0, duration: 0.15, ease: "power1.out", overwrite: "auto" });
      return;
    }
    const H0 = idle === "pan" ? PAN_JUMP : idle === "call" ? 24 : TABLE_HOP;
    let busy = false;
    const ctx = gsap.context(() => {
      if (idle === "ready" || idle === "call") {
        const H = H0;
        // ready：压低蓄力 → 停一下 → 小幅弹起又落回（像在找起跳时机），间隔不规则；call：碗里探身、左右晃着喊，幅度小
        const ready = idle === "ready";
        const act = () => {
          if (settleRef.current) return;
          busy = true;
          const tl = gsap.timeline({ onComplete: () => { busy = false; gsap.delayedCall(ready ? 0.7 + Math.random() * 0.9 : 0.9 + Math.random() * 1.1, act); } });
          if (ready) {
            tl.to(egg, { scaleX: 1.16, scaleY: 0.8, duration: 0.32, ease: "power2.out", transformOrigin: "50% 100%" })
              .to(shadow, { scale: 1.12, opacity: 0.55, duration: 0.32 }, "<")
              .to(egg, { rotation: -5, duration: 0.14, ease: "sine.inOut" })
              .to(egg, { rotation: 5, duration: 0.18, ease: "sine.inOut" })
              .to(egg, { rotation: 0, duration: 0.12, ease: "sine.inOut" })
              .to(egg, { scaleX: 0.94, scaleY: 1.1, y: -H * 0.45, duration: 0.16, ease: "power2.out" })
              .to(egg, { y: 0, scaleX: 1.1, scaleY: 0.88, duration: 0.16, ease: "power2.in" })
              .call(() => eggLand("table"))
              .to(egg, { scaleX: 1, scaleY: 1, duration: 0.45, ease: "elastic.out(1, 0.5)" })
              .to(shadow, { scale: 1, opacity: 0.45, duration: 0.3 }, "<");
          } else {
            tl.to(egg, { scaleY: 1.08, scaleX: 0.95, y: -H, rotation: -6, duration: 0.18, ease: "power2.out", transformOrigin: "50% 100%" })
              .to(egg, { y: 0, scaleY: 1, scaleX: 1, rotation: 0, duration: 0.2, ease: "power2.in" })
              .to(egg, { y: -H * 0.7, rotation: 6, duration: 0.16, ease: "power2.out" })
              .to(egg, { y: 0, rotation: 0, duration: 0.22, ease: "bounce.out" });
          }
        };
        kickRef.current = () => { if (!busy) { gsap.killTweensOf(act); act(); } };
        gsap.delayedCall(0.25, act);
        return;
      }
      const jump = () => {
        if (settleRef.current) return;
        // 前景漫画格在表演（切菜、表情）时，后景的蛋先不跳，避免抢眼
        if (document.documentElement.dataset.comicPerf || ctl.current?.busy()) { gsap.delayedCall(0.5, jump); return; }
        busy = true;
        const k = idle === "pan" ? 1 : 0.8;
        // 阅读停留阶段：桌沿小跳更小、间隔更长，不抢前景
        const calm = idle === "table" && calmRef.current;
        const H = calm ? H0 * 0.55 : H0;
        const gap = calm ? 1.8 : 1;
        gsap
          .timeline({ onComplete: () => { busy = false; gsap.delayedCall(idle === "pan" ? 0.6 + Math.random() * 0.8 : (1.4 + Math.random() * 1.6) * gap, jump); } })
          .to(egg, { scaleX: 1.1, scaleY: 0.88, duration: 0.2 * k, ease: "power2.out", transformOrigin: "50% 100%" })
          .to(shadow, { scale: 1.06, opacity: 0.5, duration: 0.2 * k }, "<")
          .to(egg, { scaleX: 0.92, scaleY: 1.12, y: -H * 0.22, duration: 0.12 * k, ease: "power2.in" })
          .to(egg, { y: -H, scaleX: 1, scaleY: 1.03, duration: 0.4 * k, ease: "power2.out" })
          .to(shadow, { scale: 0.6, opacity: 0.16, duration: 0.52 * k, ease: "power2.out" }, "<-0.12")
          .to(egg, { y: 0, scaleX: 0.96, scaleY: 1.08, duration: 0.34 * k, ease: "power2.in" })
          .to(shadow, { scale: 1, opacity: 0.45, duration: 0.34 * k, ease: "power2.in" }, "<")
          // 落回锅面 / 桌面的那一帧（放在影子这一步之后，不改变影子“<”的对齐）：接触声事件（混音器只在 surface === "pan" 时出声，间隔和变化由混音器控制）
          .call(() => window.dispatchEvent(new CustomEvent(KITCHEN_ONESHOT_EVENT, { detail: { sound: "eggHop", surface: idle } })))
          .call(() => eggLand(idle === "pan" ? "pan" : "table"))
          .to(egg, { scaleX: 1.18, scaleY: 0.8, duration: 0.1, ease: "power1.out" })
          .to(shadow, { scale: 1.12, opacity: 0.55, duration: 0.1 }, "<")
          .to(egg, { scaleX: 1, scaleY: 1, duration: 0.55, ease: "elastic.out(1, 0.45)" })
          .to(shadow, { scale: 1, opacity: 0.45, duration: 0.3 }, "<");
      };
      kickRef.current = () => { if (!busy) { gsap.killTweensOf(jump); jump(); } };
      gsap.delayedCall(0.3 + Math.random() * 0.3, jump);
    });
    return () => {
      kickRef.current = null;
      ctx.kill(); // 不 revert：离开站点时保持当前姿态，由外层平滑接上
      gsap.to(egg, { y: 0, scaleX: 1, scaleY: 1, rotation: 0, duration: 0.15, ease: "power1.out" });
    };
  }, [idle, reducedMotion]);

  const showShadow = P.station === "pan" || P.station === "table";
  return (
    <FollowMid zIndex={P.z}>
      <div
        ref={stationRef}
        data-egg-station
        aria-hidden
        className="pointer-events-none absolute invisible"
        style={{ left: REST.x - SIZE.w / 2, top: REST.y - SIZE.h, width: SIZE.w, height: SIZE.h }}
      />
      {trail && a.traj && <TrailOverlay T={a.traj} dotRef={trailDot} />}
      <div
        ref={wrapRef}
        className="pointer-events-none absolute will-change-transform"
        style={{ left: REST.x - SIZE.w / 2, top: REST.y - SIZE.h, width: SIZE.w, height: SIZE.h, opacity: P.opacity }}
      >
        <div
          ref={shadowRef}
          aria-hidden
          className="absolute"
          style={{
            // 桌面：接触影子（脚底正下方一圈较深的核心 + 略宽于蛋身的外圈软影），蛋才"站"在桌上；锅里：原来的软影，
            // 落在锅底、锅沿遮挡线以上。锅里的抬高用 bottom 而不是 transform：GSAP 会缓存并重写 transform 的 y。
            left: P.station === "table" ? SIZE.w / 2 - 150 : SIZE.w / 2 - 125,
            bottom: P.station === "pan" ? 23 : P.station === "table" ? -38 : -16,
            width: P.station === "table" ? 300 : 250,
            height: P.station === "table" ? 60 : 46,
            borderRadius: "50%",
            background:
              P.station === "table"
                ? "radial-gradient(ellipse 52% 55% at 50% 42%, rgba(58,34,14,0.75) 0%, rgba(58,34,14,0.35) 55%, rgba(58,34,14,0) 100%), radial-gradient(ellipse at center, rgba(70,42,18,0.4) 0%, rgba(70,42,18,0.18) 45%, rgba(70,42,18,0) 72%)"
                : "radial-gradient(ellipse at center, rgba(70,42,18,0.5) 0%, rgba(70,42,18,0.22) 45%, rgba(70,42,18,0) 72%)",
            opacity: showShadow ? 0.45 : 0,
            // 出现时短暂淡入；离开桌沿（起跳）时立即消失，后景不残留影子
            transition: showShadow ? "opacity 0.2s" : "none",
          }}
        />
        <div ref={eggRef} className="absolute inset-0 will-change-transform" style={inkFilter(anchors?.ink)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={baseImgRef} data-active-egg src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" />
          {/* 表情图预先加载、默认隐藏；切换只改 visibility，同一帧内只有一张脸 */}
          {faces?.fly && (
            // eslint-disable-next-line @next/next/no-img-element
            <img ref={flyImgRef} src={faces.fly} alt="" draggable={false} className={`absolute select-none ${faces.box ? "" : "inset-0 h-full w-full"}`} style={{ visibility: "hidden", maxWidth: "none", ...faces.box }} />
          )}
          {faces?.rest && (
            // eslint-disable-next-line @next/next/no-img-element
            <img ref={restImgRef} src={faces.rest} alt="" draggable={false} className={`absolute select-none ${faces.box ? "" : "inset-0 h-full w-full"}`} style={{ visibility: "hidden", maxWidth: "none", ...faces.box }} />
          )}
        </div>
      </div>
    </FollowMid>
  );
}

/** 辅助线（?trail=1）：整条高跳轨迹、L / M / E / R / C 五个关键点和蛋当前的脚底位置（场景坐标，跟蛋在同一层） */
function TrailOverlay({ T, dotRef }: { T: EggTraj; dotRef: React.RefObject<SVGCircleElement | null> }) {
  const pts: string[] = [];
  for (let i = 0; i <= 200; i++) { const f = trajFoot(T, i / 200); pts.push(`${f.x.toFixed(1)},${f.y.toFixed(1)}`); }
  const keys: [string, Pt, string][] = [["L 起点", T.L, "#2a7"], ["M 视线相遇点", T.M, "#e0442a"], ["E 出画点", T.E, "#888"], ["R 重新入画点", T.R, "#36c"], ["C 铲面接触点", T.C, "#a3c"]];
  return (
    <svg aria-hidden className="pointer-events-none absolute left-0 top-0" width={1536} height={1024} style={{ overflow: "visible", zIndex: 5 }}>
      <polyline points={pts.join(" ")} fill="none" stroke="#e0442a" strokeWidth={4} strokeDasharray="14 8" opacity={0.85} />
      {keys.map(([label, p, c]) => (
        <g key={label}>
          <circle cx={p.x} cy={p.y} r={11} fill={c} stroke="#fff" strokeWidth={3} />
          <text x={p.x + 16} y={p.y - 12} fontSize={30} fontWeight={700} fill={c} stroke="#fff" strokeWidth={6} paintOrder="stroke">{label}</text>
        </g>
      ))}
      <circle ref={dotRef} r={14} fill="none" stroke="#111" strokeWidth={5} />
    </svg>
  );
}
