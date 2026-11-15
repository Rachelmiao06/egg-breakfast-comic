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
 *   table    桌沿轻跳（真实时间）；下一段要起飞时，本段退出阶段收住
 *   flight   进入阶段收住 → 动作阶段滚动控制：上一站（锅或桌沿）→ 锅铲 → 落铲压扁回弹（一次性事件）
 *   serve    滚动控制：锅铲 → 碗；bowl 停在碗里
 *   gone     已交给画着蛋的漫画：与交接格同步淡出
 * direct = true（新版）：滚动控制的位移直接设置，不再每帧重启补间；只有站点之间的离散跳变（快速拖动）用很短的补间接上。
 */
import { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { beatById, eggTravel, type Beat, type Timeline } from "@/lib/beats";
import { ANCHORS, Z } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";
import FollowMid from "./FollowMid";
import { KITCHEN_ONESHOT_EVENT } from "./useKitchenAudio";

const { eggRest: REST, eggSize: SIZE } = ANCHORS;

export type Pt = { x: number; y: number };
/** 可调的定位点（场景像素，脚底中心）。不传时用 src/lib/scene.ts 的默认值。 */
export type EggAnchors = {
  panLaunch: Pt;
  tableWait: Pt;
  spatulaLand: Pt;
  bowlLand: Pt;
  eggAtTable: number;
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
  /**
   * 可选：某一段里（如 hear）与前景表演同一时刻触发的“抬头一跳”（真实时间，在原地站点上向上跳到前景格的右上方再落回）。
   * 段内进度 q 越过 start 触发一次，q < reset 复位，q > leave 时尽快落回。最高点按触发时屏幕上前景格（panelSelector）的位置算：
   * 蛋在格子右侧时，蛋心升到格子上沿往下 gazeFy × 格高处（妈妈抬眼的视线范围）；蛋和格子横向重叠时，升到格子上沿之上；
   * 最高点的蛋始终完整在屏幕内（margin 像素）。rise / hang / fall 为秒。
   */
  peek?: { event: string; panelSelector: string; gazeFy: number; margin: number; rise: number; hang: number; fall: number };
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

type Station = "pan" | "table" | "spatula" | "bowl";
type Pose = { x: number; y: number; scale: number; rotation: number };
type Plan = {
  pose: Pose;
  station: Station | null; // null = 在路上（滚动控制）
  idle: "pan" | "table" | "ready" | "call" | null;
  settle: boolean;
  z: number;
  opacity: number;
  landing: Station | null; // 刚到达的站点（用于一次性落地回弹）
};

const b_isFlight = (b: Beat) => b.egg === "flight";
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const bez = (a: number, b: number, c: number, t: number) => (1 - t) ** 2 * a + 2 * (1 - t) * t * b + t ** 2 * c;
const smooth = (t: number) => t * t * (3 - 2 * t);

function stationPose(st: Station, a: EggAnchors): Pose {
  const p = st === "pan" ? a.panLaunch : st === "table" ? a.tableWait : st === "spatula" ? a.spatulaLand : a.bowlLand;
  const scale = st === "pan" ? 1 : st === "table" ? a.eggAtTable : st === "spatula" ? a.eggOnSpatula : a.eggInBowl;
  return { x: p.x - REST.x, y: p.y - REST.y, scale, rotation: st === "spatula" ? (a.spatulaTilt ?? 0) : 0 };
}

/** 弧线：起点、终点、最高点抬升 lift；缩放线性插值，中途略放大表示靠近镜头 */
function arc(from: Station, to: Station, t: number, a: EggAnchors, lift: number, spin: number): Pose {
  const A = stationPose(from, a), B = stationPose(to, a);
  const k = clamp01(t);
  const cx = (A.x + B.x) / 2, cy = Math.min(A.y, B.y) - lift;
  return {
    x: bez(A.x, cx, B.x, k),
    y: bez(A.y, cy, B.y, k),
    // 中途略放大（靠近镜头）：按起落两站中较小的缩放取相对量，窄屏缩小的蛋不会在半空突然变大一半
    scale: A.scale + (B.scale - A.scale) * k + 0.24 * Math.min(A.scale, B.scale) * Math.sin(Math.PI * k),
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

/** 本段之前，蛋最后停在哪一站（决定 flight 从哪起飞） */
function lastStationBefore(beats: Beat[], index: number): Station {
  for (let i = index - 1; i >= 0; i--) {
    const e = beats[i].egg;
    if (e === "toTable" || e === "table" || e === "ready") return "table";
    if (e === "flight") return "spatula";
    if (e === "loop") return "pan";
  }
  return "pan";
}

function plan(t: Timeline, beats: Beat[], a: EggAnchors): Plan {
  const b = t.beat;
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
      if (before) return { ...base("pan", "pan", Z.eggInPan), settle: true };
      if (travelling) return { pose: arc("pan", "table", smooth(actionP), a, 260, 12), station: null, idle: null, settle: false, z: Z.eggOnTable, opacity: 1, landing: null };
      const P = base("table", "table", Z.eggOnTable);
      P.landing = "table";
      P.settle = !!next && next.egg === "flight" && exiting;
      return P;
    }
    case "table": {
      const P = base("table", "table", Z.eggOnTable);
      P.settle = !!next && next.egg === "flight" && exiting;
      return P;
    }
    case "ready": {
      // 环境段：桌沿蓄力（真实时间：压低、左右扭、准备跳），离开前收住
      const P = base("table", "ready", Z.eggOnTable);
      P.settle = exiting;
      return P;
    }
    case "inBowl": {
      // 环境段：空饭桌上碗里的蛋（后景）。进入阶段等漫画格离开后才淡入，退出阶段在下一段漫画（画着碗里的蛋）进来前淡出
      const P = base("bowl", "call", Z.eggOnTable);
      P.opacity = t.phase === "enter" ? clamp01((t.phaseP - 0.4) / 0.5) : t.phase === "exit" ? 1 - clamp01(t.phaseP / 0.6) : 1;
      return P;
    }
    case "flight": {
      const from = lastStationBefore(beats, t.index);
      if (before) return { ...base(from, from === "pan" ? "pan" : "table", from === "pan" ? Z.eggInPan : Z.eggOnTable), settle: true };
      if (travelling) {
        const pose = arc(from, "spatula", actionP, a, 380, -18);
        if (a.flightApexY !== undefined) {
          const f = flightPoint(from === "pan" ? a.panLaunch : a.tableWait, a.spatulaLand, a.flightApexY, actionP, 0.6, !!a.flightEaseX);
          pose.x = f.x - REST.x;
          pose.y = f.y - REST.y;
        }
        if (a.spatulaTilt !== undefined) {
          // 身体逐渐倒向妈妈，中途多前倾一点，落到铲面时正好是铲面上的倾角（与停稳姿态无缝衔接）
          pose.rotation = a.spatulaTilt * smooth(actionP) + (a.flightLean ?? 0) * Math.sin(Math.PI * actionP);
        }
        return { pose, station: null, idle: null, settle: false, z: Z.eggFlying, opacity: 1, landing: null };
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

export default function Egg({ src = "/assets/scene/egg.webp", anchors, direct = false, faces }: { src?: string; anchors?: Partial<EggAnchors>; direct?: boolean; faces?: EggFaces }) {
  const wrapRef = useRef<HTMLDivElement>(null);
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
    if (flying) { restArmed.current = false; setFace("fly"); }
    // 在铲面上：落铲事件切到 rest 之后保持；直接跳进交接段（没有经过落地，P.landing 为空）也直接用 rest
    else if (onSpatula) { if (restArmed.current || reducedMotion || P.landing === null) setFace("rest"); }
    else { restArmed.current = false; setFace("base"); }
  });

  // ---- 外层：位置（滚动控制或站点） ----
  const lastStation = useRef<Station | null>(null);
  const lastLanding = useRef<Station | null>(null);
  useEffect(() => {
    const w = wrapRef.current;
    if (!w) return;
    const discrete = P.station !== null && lastStation.current !== P.station; // 换站（含快速拖过整段）
    const vars = { x: P.pose.x, y: P.pose.y, scale: P.pose.scale, rotation: P.pose.rotation, transformOrigin: "50% 100%" };
    if (reducedMotion) gsap.set(w, vars);
    else if (direct && P.station === null) gsap.set(w, { ...vars, overwrite: true }); // 滚动主运动：直接映射
    else if (direct) gsap.to(w, { ...vars, duration: discrete ? 0.22 : 0.0, ease: "power2.out", overwrite: true });
    else gsap.to(w, { ...vars, duration: 0.3, ease: "power2.out", overwrite: true });
    lastStation.current = P.station;
    // 一次性落地回弹：第一次到达桌沿 / 锅铲 / 碗
    if (P.landing && lastLanding.current !== P.landing && !reducedMotion && eggRef.current) {
      const s = eggRef.current;
      if (P.landing === "spatula" && a.spatulaTilt !== undefined) {
        // 落铲：一次轻微压缩 → 小回弹 → 停稳（不连续弹跳，压缩量小，五官不变形）
        gsap.timeline()
          .to(s, { scaleX: 1.08, scaleY: 0.9, duration: LAND_SQUASH_S * 0.13, ease: "power2.out", transformOrigin: "50% 100%", overwrite: "auto" })
          // 压缩到底的那一刻换成安心表情（同一次落地事件，真实时间；若此时已经被滚回飞行中就不换）
          .call(() => { if (lastStation.current === "spatula") { restArmed.current = true; setFace("rest"); } })
          .to(s, { scaleX: 0.98, scaleY: 1.03, duration: LAND_SQUASH_S * 0.2, ease: "sine.out" })
          .to(s, { scaleX: 1, scaleY: 1, duration: LAND_SQUASH_S * 0.3, ease: "sine.inOut" });
      } else
        gsap.timeline()
          .to(s, { scaleX: 1.18, scaleY: 0.8, duration: LAND_SQUASH_S * 0.15, ease: "power1.out", transformOrigin: "50% 100%" })
          .to(s, { scaleX: 1, scaleY: 1, duration: LAND_SQUASH_S * 0.85, ease: "elastic.out(1, 0.45)" });
    }
    // 停在同一站上（如接蛋停留 → 交接段）不算离开，来回滚动不会重播落地回弹；真正离开（飞起、换站）才重新计
    if (P.landing || P.station !== lastLanding.current) lastLanding.current = P.landing;
  });

  // ---- 抬头一跳（peek，真实时间）：听前景表演发出的事件（a.peek.event），和妈妈抬眼是同一个开始时刻 ----
  // detail.phase：start = 起跳（本次进入只跳一次）；stop = 格子开始离开，尽快落回；reset = 格子退出视野，下次进入可再跳
  const peekRef = useRef<{ played: boolean; tl: gsap.core.Timeline | null }>({ played: false, tl: null });
  const peekingRef = useRef(false);
  const resumeIdleRef = useRef<(() => void) | null>(null); // 抬头一跳结束后恢复站点小跳（跳之前被打断的那一下不会再回调）
  const peekKey = JSON.stringify(a.peek ?? null);
  useEffect(() => {
    const pk = a.peek;
    if (!pk) return;
    const st = peekRef.current;
    const land = (d: number) => {
      const egg = eggRef.current, shadow = shadowRef.current;
      st.tl?.kill(); st.tl = null;
      if (!egg || !shadow) return;
      gsap.to(egg, { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: d, ease: "power2.in", overwrite: true, onComplete: () => { peekingRef.current = false; resumeIdleRef.current?.(); } });
      gsap.to(shadow, { scale: 1, opacity: 0.45, duration: d, overwrite: true });
    };
    const onCue = (e: Event) => {
      const phase = (e as CustomEvent<{ phase?: string }>).detail?.phase;
      const egg = eggRef.current, shadow = shadowRef.current, wrap = wrapRef.current;
      if (!egg || !shadow || !wrap) return;
      if (phase === "reset") { st.played = false; if (st.tl) land(0.15); return; }
      if (phase === "stop") { if (st.tl) land(0.2); return; }
      if (phase !== "start" || st.played || reducedMotion) return;
      st.played = true;
      // 最高点：按此刻屏幕上的站点框和前景格算（屏幕像素），再换算成蛋布局框里的位移
      const r = wrap.getBoundingClientRect();
      const panelEl = document.querySelector(pk.panelSelector);
      const pr = panelEl ? (panelEl.parentElement ?? panelEl).getBoundingClientRect() : null;
      const body = { x0: r.left + r.width * 0.06, x1: r.right - r.width * 0.06, y0: r.top + r.height * 0.04, y1: r.bottom };
      const bh = body.y1 - body.y0, cy = (body.y0 + body.y1) / 2;
      let target = cy - r.height * 1.1; // 没有前景格时：向上约一个蛋高
      if (pr) {
        const overlap = body.x0 < pr.right + 8 && body.x1 > pr.left - 8;
        target = overlap ? pr.top - 10 - bh / 2 : pr.top + pk.gazeFy * pr.height;
      }
      target = Math.min(cy, Math.max(target, pk.margin + bh / 2));
      const dx = Math.min(0, window.innerWidth - pk.margin - body.x1) + Math.max(0, pk.margin - body.x0);
      const k = SIZE.w / Math.max(1, r.width); // 屏幕像素 → 布局框像素
      const Y = (target - cy) * k, X = dx * k;
      peekingRef.current = true;
      gsap.killTweensOf([egg, shadow]);
      st.tl = gsap.timeline({ onComplete: () => { st.tl = null; peekingRef.current = false; resumeIdleRef.current?.(); } })
        .to(egg, { scaleX: 1.1, scaleY: 0.88, duration: 0.12, ease: "power2.out", transformOrigin: "50% 100%" })      // 蓄力（与“啵”同时）
        .to(shadow, { scale: 1.06, opacity: 0.5, duration: 0.12 }, "<")
        .to(egg, { x: X, y: Y, scaleX: 0.97, scaleY: 1.05, duration: pk.rise, ease: "power2.out" })                     // 上升：妈妈在上升途中抬眼
        .to(shadow, { scale: 0.5, opacity: 0.12, duration: pk.rise, ease: "power2.out" }, "<")
        .to(egg, { y: Y * 0.97, scaleX: 1, scaleY: 1, duration: pk.hang, ease: "sine.inOut" })                          // 最高点停一下（在她的视线里；只往下回一点，不越出屏幕）
        .to(egg, { x: 0, y: 0, scaleX: 0.97, scaleY: 1.05, duration: pk.fall, ease: "power2.in" })                       // 落回桌沿
        .to(shadow, { scale: 1, opacity: 0.45, duration: pk.fall, ease: "power2.in" }, "<")
        .to(egg, { scaleX: 1.12, scaleY: 0.86, duration: 0.09, ease: "power1.out" })
        .to(egg, { scaleX: 1, scaleY: 1, duration: 0.3, ease: "power2.out" });
    };
    window.addEventListener(pk.event, onCue);
    return () => window.removeEventListener(pk.event, onCue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peekKey, reducedMotion]);

  // ---- 内层：站点上的自主小跳（真实时间） ----
  const settleRef = useRef(P.settle);
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
    const H = idle === "pan" ? PAN_JUMP : idle === "call" ? 24 : TABLE_HOP;
    let busy = false;
    const ctx = gsap.context(() => {
      if (idle === "ready" || idle === "call") {
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
        if (document.documentElement.dataset.comicPerf || peekingRef.current) { gsap.delayedCall(0.5, jump); return; }
        busy = true;
        const k = idle === "pan" ? 1 : 0.8;
        gsap
          .timeline({ onComplete: () => { busy = false; gsap.delayedCall(idle === "pan" ? 0.6 + Math.random() * 0.8 : 1.4 + Math.random() * 1.6, jump); } })
          .to(egg, { scaleX: 1.1, scaleY: 0.88, duration: 0.2 * k, ease: "power2.out", transformOrigin: "50% 100%" })
          .to(shadow, { scale: 1.06, opacity: 0.5, duration: 0.2 * k }, "<")
          .to(egg, { scaleX: 0.92, scaleY: 1.12, y: -H * 0.22, duration: 0.12 * k, ease: "power2.in" })
          .to(egg, { y: -H, scaleX: 1, scaleY: 1.03, duration: 0.4 * k, ease: "power2.out" })
          .to(shadow, { scale: 0.6, opacity: 0.16, duration: 0.52 * k, ease: "power2.out" }, "<-0.12")
          .to(egg, { y: 0, scaleX: 0.96, scaleY: 1.08, duration: 0.34 * k, ease: "power2.in" })
          // 落回锅面 / 桌面的那一帧：接触声事件（混音器只在 surface === "pan" 时出声，间隔和变化由混音器控制）
          .call(() => window.dispatchEvent(new CustomEvent(KITCHEN_ONESHOT_EVENT, { detail: { sound: "eggHop", surface: idle } })))
          .to(shadow, { scale: 1, opacity: 0.45, duration: 0.34 * k, ease: "power2.in" }, "<")
          .to(egg, { scaleX: 1.18, scaleY: 0.8, duration: 0.1, ease: "power1.out" })
          .to(shadow, { scale: 1.12, opacity: 0.55, duration: 0.1 }, "<")
          .to(egg, { scaleX: 1, scaleY: 1, duration: 0.55, ease: "elastic.out(1, 0.45)" })
          .to(shadow, { scale: 1, opacity: 0.45, duration: 0.3 }, "<");
      };
      kickRef.current = () => { if (!busy) { gsap.killTweensOf(jump); jump(); } };
      resumeIdleRef.current = () => { busy = false; gsap.killTweensOf(jump); gsap.delayedCall(1 + Math.random() * 1.2, jump); };
      gsap.delayedCall(0.3 + Math.random() * 0.3, jump);
    });
    return () => {
      kickRef.current = null;
      resumeIdleRef.current = null;
      ctx.kill(); // 不 revert：离开站点时保持当前姿态，由外层平滑接上
      gsap.to(egg, { y: 0, scaleX: 1, scaleY: 1, rotation: 0, duration: 0.15, ease: "power1.out" });
    };
  }, [idle, reducedMotion]);

  const showShadow = P.station === "pan" || P.station === "table";
  return (
    <FollowMid zIndex={P.z}>
      <div
        ref={wrapRef}
        data-egg-station
        className="pointer-events-none absolute will-change-transform"
        style={{ left: REST.x - SIZE.w / 2, top: REST.y - SIZE.h, width: SIZE.w, height: SIZE.h, opacity: P.opacity }}
      >
        <div
          ref={shadowRef}
          aria-hidden
          className="absolute"
          style={{
            left: SIZE.w / 2 - 125,
            bottom: P.station === "pan" ? 0 : -16,
            width: 250,
            height: 46,
            borderRadius: "50%",
            background: "radial-gradient(ellipse at center, rgba(70,42,18,0.5) 0%, rgba(70,42,18,0.22) 45%, rgba(70,42,18,0) 72%)",
            opacity: showShadow ? 0.45 : 0,
            transform: P.station === "pan" ? "translateY(-23px)" : undefined,
            // 出现时短暂淡入；离开桌沿（起跳）时立即消失，后景不残留影子
            transition: showShadow ? "opacity 0.2s" : "none",
          }}
        />
        <div ref={eggRef} className="absolute inset-0 will-change-transform">
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
