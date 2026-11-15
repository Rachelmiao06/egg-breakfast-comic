"use client";
/**
 * 漫画格内部的表演。
 *
 * 切菜 p2b、配菜入锅 p2d、调酱汁 p3a：分层动画（tools/split_layers.py 从 new pics 的连续帧拆出来，public/assets/comic-v4/layers/）。
 *   稳定底图（运动部件已去掉并补全）+ 透明运动层（握刀手 / 推菜的手和木铲 / 握勺的手臂，绕记录的自然支点转动、平移）
 *   + 另外的运动层（案板上的菜、三颗掉落的菜，各自一层）+ 遮挡层（对白泡、框线、扶菜的手、胡萝卜、锅身、碗前壁、围裙）。
 *   所有层同一画布、同一位置；动作用 GSAP 时间轴按真实时间播放，声音挂在同一条时间轴上的接触时刻。
 * 听见格 p3d：原格 → 抬眼 → 疑惑，只换眉眼和嘴（与原格逐像素对齐），硬切；停在疑惑。
 * 触发、收住、复位都走 useStage：格子真的在阅读位置（入场结束且可见 ≥ 90%）才播，离场收住，几乎看不见或退回入场前才复位。
 * 表演进行时在 <html data-comic-perf> 上做标记，后景的蛋暂缓小跳，不抢前景。
 * 减少动态效果或 ?perf=0：显示原静态格（new pics 第 1 帧）；声音仍在同样的时刻派发，画面不动。
 */
import gsap from "gsap";
import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from "react";
import { KITCHEN_ONESHOT_EVENT } from "@/components/kitchen/useKitchenAudio";
import type { PanelSlot } from "./slots";
import { PAPER_SHADOW } from "./paper";

type Place = { x: number; y: number; w: number };
/** 声像跟着格子：按格子中心在屏幕上的横向位置给 -0.7…0.7（左边的格声音偏左，右边偏右）；厨房声不受影响 */
const panFor = (pos: Place) => Math.max(-0.7, Math.min(0.7, ((pos.x + pos.w / 2) / 50 - 1) * 0.7));
/** 格子在屏幕上的状态（ComicLayer 按布局算）：可见比例、入场是否结束、是否开始离场 */
export type Stage = { vis: number; entered: boolean; leaving: boolean };
/** 可见 ≥ 90% 且入场结束才开始；可见 < 60% 或开始离场就收住；几乎看不见（< 12%）或退回入场前才复位，下次进入再播 */
const READY_VIS = 0.9, LEAVE_VIS = 0.6, GONE_VIS = 0.12, BEFORE_Q = 0.2;
/**
 * 听见格 p3d 的表演：开始的那一刻派发 HEAR_EVENT（phase "start"），后景的蛋同一时刻起跳（Egg peek）；
 * eyesMs 时妈妈抬眼看向右上（蛋正在上升），蛋随后到达最高点，puzzMs 时露出疑惑（蛋已在下落）。
 * 收住时派发 "stop"（蛋尽快落回），复位时派发 "reset"（下次进入可再跳）。蛋和表情听同一个事件，保证是同一段动作。
 */
export const HEAR_CUE = { eyesMs: 500, puzzMs: 1300, beforeQ: BEFORE_Q } as const;
export const HEAR_EVENT = "comic:hear";
const hearSignal = (phase: "start" | "stop" | "reset") => window.dispatchEvent(new CustomEvent(HEAR_EVENT, { detail: { phase } }));
const P = "/assets/comic-v3/perf/"; // 听见格的表情层

export function usePerfEnabled() {
  return useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("perf") !== "0",
    () => true,
  );
}

function boxStyle(pos: Place, aspect: number, dy: number): CSSProperties {
  return { left: `${pos.x}vw`, top: `${pos.y}vh`, width: `${pos.w}vw`, aspectRatio: `${aspect}`, transform: `translate3d(0, ${dy}vh, 0)`, boxShadow: PAPER_SHADOW };
}
const flag = (on: boolean) => {
  if (on) document.documentElement.dataset.comicPerf = "1";
  else delete document.documentElement.dataset.comicPerf;
};

/**
 * 统一播放规则：滚动只负责格子的进入、停留、离场；格内动作在格子"真的在阅读位置"时按真实时间播一小段，然后停稳。
 * - 开始：入场结束且可见 ≥ 90%（不看段内进度，所以竖屏整列上移、屏幕外都不会提前播）；停止滚动也照样播完。
 * - 收住：开始离场或可见 < 60%，交给各格的 stop()（落到稳定的终态）。
 * - 复位：几乎看不见（< 12%）或退回入场之前；之后再次满足开始条件就再播一次（从前面、从后面重新进入规则一样）。
 *   在边缘来回滚动不会反复触发：播过之后，没有离开到复位线以外就不会再播。
 * - 关掉表演（减少动态效果 / ?perf=0）时立即复位；卸载时复位。
 */
function useStage(q: number, stage: Stage, enabled: boolean, play: () => void, stop: () => void, reset: () => void) {
  const played = useRef(false);
  const wasEnabled = useRef(enabled);
  useEffect(() => {
    if (!enabled) {
      if (wasEnabled.current) { wasEnabled.current = false; played.current = false; reset(); }
      return;
    }
    wasEnabled.current = true;
    if (stage.vis < GONE_VIS || (q < BEFORE_Q && !stage.entered)) { if (played.current) { played.current = false; reset(); } return; }
    if (stage.leaving || stage.vis < LEAVE_VIS) { stop(); return; }
    if (stage.entered && stage.vis >= READY_VIS && !played.current) { played.current = true; play(); }
  });
  // 卸载时复位，并清掉"播过"标记：格子离开视口被卸载、再次进入重新挂载时能再播；
  // 开发模式 StrictMode 的"挂载 → 模拟卸载 → 再挂载"也一样（否则刚开始就被复位，而 played 还是 true，整段不播）
  useEffect(() => () => { played.current = false; reset(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

export function HearPanel({ p, pos, dy, q, stage, animate }: { p: PanelSlot; pos: Place; dy: number; q: number; stage: Stage; animate: boolean }) {
  const eyes = useRef<HTMLImageElement>(null);
  const puzz = useRef<HTMLImageElement>(null);
  const timers = useRef<number[]>([]);
  const show = (n: 0 | 1 | 2) => {
    if (eyes.current) eyes.current.style.opacity = n === 1 ? "1" : "0";
    if (puzz.current) puzz.current.style.opacity = n === 2 ? "1" : "0";
  };
  const clear = () => { timers.current.forEach((id) => window.clearTimeout(id)); timers.current = []; flag(false); };
  const play = () => {
    clear();
    show(0);
    flag(true);
    hearSignal("start");
    timers.current = [
      window.setTimeout(() => show(1), HEAR_CUE.eyesMs), // 蛋起跳后抬眼（蛋正在上升）
      window.setTimeout(() => { show(2); timers.current = []; flag(false); }, HEAR_CUE.puzzMs), // 露出疑惑，停住
    ];
  };
  // 离开时：还没播完就直接落到结尾表情（疑惑），保证这一格的终态始终一致；
  // 否则停在"抬眼"半途，回滚回来也一直是半截表情。已播完时什么都不做。
  const stop = () => { hearSignal("stop"); if (timers.current.length) { clear(); show(2); } };
  const reset = () => { hearSignal("reset"); clear(); show(0); };
  useStage(q, stage, animate, play, stop, reset);
  if (!animate) return <StaticImg src={p.src!} pos={pos} aspect={p.aspect} dy={dy} />;
  return (
    <div className="panel-frame absolute will-change-transform" style={boxStyle(pos, p.aspect, dy)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.src} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={eyes} src={`${P}p3d-eyes.webp`} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none" style={{ opacity: 0 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={puzz} src={`${P}p3d-puzz.webp`} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none" style={{ opacity: 0 }} />
    </div>
  );
}

const L4 = "/assets/comic-v4/layers/";
const F4 = "/assets/comic-v4/frames/";
/** 声音事件（混音器在 kitchen-audio 分支接收；没收到就静音）。时刻都挂在 useStage 的真实时间轴上 */
const oneshot = (sound: string, pan?: number) => window.dispatchEvent(new CustomEvent(KITCHEN_ONESHOT_EVENT, { detail: { sound, pan } }));
const action = (name: string, phase: "start" | "stop", pan?: number) => window.dispatchEvent(new CustomEvent("kitchen:action", { detail: { name, phase, pan } }));

/**
 * 所有漫画格通用的"格子到位"信号：同一套 useStage 规则（到位 start、离场 stop、复位 reset），
 * 派发 window `comic:panel` {key, phase}。声音会话按格子挂声音（例如 p4c 淋汁、p4b 放蛋），不用再改这里。
 */
export function PanelSignal({ k, q, stage }: { k: string; q: number; stage: Stage }) {
  const sent = (phase: "start" | "stop" | "reset") => window.dispatchEvent(new CustomEvent("comic:panel", { detail: { key: k, phase } }));
  const on = useRef(false); // start 之后、stop 之前
  const armed = useRef(false); // start 之后、reset 之前（只有真的开始过才派发 reset，挂载 / 卸载不发空信号）
  useStage(
    q, stage, true,
    () => { on.current = true; armed.current = true; sent("start"); },
    () => { if (on.current) { on.current = false; sent("stop"); } },
    () => { if (on.current) { on.current = false; sent("stop"); } if (armed.current) { armed.current = false; sent("reset"); } },
  );
  return null;
}
/**
 * 分层格内动作（tools/split_layers.py 生成；layers.json 记着画布、支点、关键姿态）。
 * - <key>-base：第 1 帧去掉运动部件后补全的底图；<key>-part：运动部件（手 + 必要的前臂 + 工具），绕 pivot（画布百分比）转动 / 平移；
 *   extras：另外各自运动的层（案板上的菜、掉落的菜）；<key>-front：遮挡层，像素和底图一致，画在所有运动层之上。
 * - 位移用 xPercent / yPercent（相对整张画布），旋转绕 pivot。静止姿态就是第 1 帧，原位叠合与原图一致。
 * - build() 往时间轴上排动作和声音；静态格（减少动态效果）同一个 build 作用在空对象上，声音时刻完全相同，画面不动。
 * - 离场：时间轴停掉、落回静止姿态（= 静态格），持续的动作声由 onHalt 停掉；复位同样。隐藏标签页时 GSAP 随 rAF 暂停，不积累计时器。
 */
type Targets = Record<string, object>;
function LayersPanel({
  p, pos, dy, q, stage, animate, k, extras = [], pivot, delay = 0.3, build, runStatic = false, onHalt, haltAtEnd = false, end, clips = {},
}: {
  p: PanelSlot; pos: Place; dy: number; q: number; stage: Stage; animate: boolean;
  /** 资源名前缀，如 p2b */
  k: string;
  extras?: string[];
  /** 运动部件的自然支点（画布百分比） */
  pivot: [number, number];
  delay?: number;
  /** 排动作：t.part / t[extra] 是要动的对象（静态格时是空对象）；pan 是格子在屏幕上的声像 */
  build: (tl: gsap.core.Timeline, t: Targets, pan: number) => void;
  runStatic?: boolean;
  onHalt?: () => void;
  /** 时间轴播完就算动作结束（调 onHalt），之后离场不再重复调 */
  haltAtEnd?: boolean;
  /** 终态（播完 / 离场时落到这里）；不给就是静止姿态（= 第 1 帧）。复位总是回到静止姿态 */
  end?: (set: (n: string, v: gsap.TweenVars) => void) => void;
  /** 某些层的固定裁切（clip-path，画布坐标；层在裁切框里移动，例如菜过了案板边就看不见） */
  clips?: Record<string, string>;
}) {
  const els = useRef<Record<string, HTMLImageElement | null>>({});
  const tl = useRef<gsap.core.Timeline | null>(null);
  const live = useRef(false);
  const names = ["part", ...extras];
  const rest = () => names.forEach((n) => { const el = els.current[n]; if (el) gsap.set(el, { xPercent: 0, yPercent: 0, rotation: 0, opacity: 1 }); });
  const halt = () => { if (live.current) { live.current = false; onHalt?.(); } };
  const reset = () => { tl.current?.kill(); tl.current = null; rest(); flag(false); halt(); };
  const settle = () => {
    rest();
    end?.((n, v) => { const el = els.current[n]; if (el) gsap.set(el, v); });
  };
  const stop = () => { halt(); if (!tl.current) return; tl.current.kill(); tl.current = null; settle(); flag(false); };
  const play = () => {
    reset();
    live.current = true;
    const targets: Targets = {};
    names.forEach((n) => { targets[n] = (animate && els.current[n]) || {}; });
    if (animate) {
      flag(true);
      const part = els.current.part;
      if (part) gsap.set(part, { transformOrigin: `${pivot[0]}% ${pivot[1]}%` });
    }
    const t = gsap.timeline({ delay, onComplete: () => { tl.current = null; if (animate) { settle(); flag(false); } if (haltAtEnd) halt(); } });
    build(t, targets, panFor(pos));
    tl.current = t;
  };
  useStage(q, stage, animate || runStatic, play, stop, reset);
  if (!animate) return <StaticImg src={`${F4}${k}-f1.webp`} pos={pos} aspect={p.aspect} dy={dy} />;
  const layer = (n: string, src: string, ref: boolean) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={n} ref={ref ? (el) => { els.current[n] = el; } : undefined} src={src} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none" style={ref ? { willChange: "transform" } : undefined} />
  );
  return (
    <div className="panel-frame absolute overflow-hidden will-change-transform" style={boxStyle(pos, p.aspect, dy)}>
      {layer("base", `${L4}${k}-base.webp`, false)}
      {layer("part", `${L4}${k}-part.webp`, true)}
      {extras.map((n) => clips[n]
        ? <div key={n} className="absolute inset-0" style={{ clipPath: clips[n] }}>{layer(n, `${L4}${k}-${n}.webp`, true)}</div>
        : layer(n, `${L4}${k}-${n}.webp`, true))}
      {layer("front", `${L4}${k}-front.webp`, false)}
    </div>
  );
}

/**
 * 切胡萝卜格 p2b：握刀的手（连袖口和刀）整体往下切，绕袖口与手腕交界轻微转动。
 * 最低姿态取自 A-chopping 第 3 帧相对第 1 帧的位姿（下移 18% 画布高、转 1°）；刀尖落进胡萝卜后面（胡萝卜、扶菜的手、对白泡、框线都是遮挡层）。

 * CHOP_STROKES 刀：小抬 → 快落 → 刀刃接触的那一刻派发 chopHit → 短停 → 抬回 → 停顿；三刀后停在抬刀姿态（和静态格一样）。
 * 静态格画面不动，三下刀声照常、时刻相同。
 */
/**
 * 2026-11-15 重做：以前整只手带刀垂直平移 18%（刀尖穿过胡萝卜，像整块贴图在抖）。
 * 真正的切法是刀尖几乎不离开案板，刀跟（连手）抬起再压下：所以支点放在刀尖（ChopPanel pivot），
 * 抬刀 = 绕刀尖顺时针转几度（手随之抬高），落刀 = 转回并略过零点（压进菜里），再带一点往前推的位移。
 * 每刀幅度、节奏略有不同，越切越顺（后面几刀更快更短），不再像节拍器。
 */
const CHOP_STROKES = 8;
function chopScript(tl: gsap.core.Timeline, t: Targets, pan: number) {
  let at = 0;
  for (let i = 0; i < CHOP_STROKES; i++) {
    const k = 1 - 0.35 * (i / (CHOP_STROKES - 1)); // 越切越快、越短
    const lift = (i % 2 ? 7.5 : 9) * (0.8 + 0.2 * k);
    tl.to(t.part, { rotation: lift, yPercent: -1.2, xPercent: -0.4, duration: 0.2 * k + 0.08, ease: "power2.out" }, at); // 抬刀跟：刀尖留在案板上
    at += (i === 0 ? 0.26 : 0.2) * k + 0.08;
    tl.to(t.part, { rotation: -1.6, yPercent: 0.9, xPercent: 0.7, duration: 0.11, ease: "power3.in" }, at); // 压下去，略微往前推
    at += 0.11;
    tl.call(() => oneshot("chopHit", pan), [], at); // 刀刃接触
    at += 0.05;
    tl.to(t.part, { rotation: 0, yPercent: 0, xPercent: 0, duration: 0.16, ease: "power2.out" }, at); // 回到静止
    at += 0.16 + (i === CHOP_STROKES - 1 ? 0 : 0.08 * k);
  }
}
export function ChopPanel(props: { p: PanelSlot; pos: Place; dy: number; q: number; stage: Stage; animate: boolean }) {
  return <LayersPanel {...props} k="p2b" pivot={[56.4, 68.7]} delay={0.35} build={chopScript} runStatic />;
}

/**
 * 配菜入锅格 p2d（2026-11-15 用新图重做，tools/prepare_p2d_layers.py，public/assets/comic-v5/p2d/）。
 * 不再把一张贴图转来转去：木铲、菜堆都是真的"换姿态"（逐帧硬切，0.1 s 快淡入，漫画的动作感），菜一颗颗掉进锅里。
 *   层（自下而上）：base（干净底图：案板上空、锅里只有一层菜）→ panfull（锅里更满的一截，只在第一批菜落下之后硬切进来，不整张慢交叉淡入，避免重影）
 *   → pile1 / pile2 / pile3（案板上的菜堆：满 → 被推着往下沿滑 → 只剩几颗）→ 12 颗掉落的单颗菜 → spatA / spatB（木铲推进菜堆 / 往回拉）。
 * 时间线（从格子到位算起，另有 0.3 s 起手）：0 推进（第 1 帧）→ 0.45 往回拉、菜堆滑开、第一批 6 颗落下 → 1.1 再推进、锅里变满 → 1.5 再拉回、菜堆只剩几颗、第二批 6 颗落下
 *   → 2.05 案板空了 → 2.3 开始持续的翻炒声。
 * 终态（播完、离场）：木铲在拉回位，案板空，锅里更满；复位才回到第 1 帧。静态格（减少动态效果）＝第 1 帧，声音时刻不变。
 * 声音：第一颗菜落进锅里的那一刻 stirfryIn（每次播放一次）；推完开始持续翻炒声 stirfry（混音器里静音），离场 / 复位时停。
 */
const P2D = "/assets/comic-v5/p2d/";
/** 裁边后的坐标换算：生成图原尺寸 2184×720，四周裁掉 24px（tools/prepare_p2d_layers.py） */
const cx = (x: number) => (x * 2184 - 24) / 2136;
const cy = (y: number) => (y * 720 - 24) / 672;
/** 案板下沿（原图归一化坐标）：x 0.42 → 0.76，y 0.47 → 0.71，菜从这条沿上被推出去 */
const edgeY = (x: number) => 0.47 + ((0.71 - 0.47) / (0.76 - 0.42)) * (x - 0.42);
/** 掉落的菜：素材名（d-<s>.webp）、素材宽（px）、从案板沿哪个 x 掉、什么时候掉（秒）。第一批在第一次拉回时，第二批在第二次 */
const DROPS: { s: string; w: number; x: number; at: number }[] = [
  { s: "carrot1", w: 159, x: 0.50, at: 0.45 }, { s: "corn2", w: 175, x: 0.57, at: 0.52 }, { s: "scal1", w: 180, x: 0.54, at: 0.60 },
  { s: "corn1", w: 159, x: 0.63, at: 0.68 }, { s: "carrot2", w: 160, x: 0.60, at: 0.76 }, { s: "scal3", w: 108, x: 0.68, at: 0.84 },
  { s: "corn3", w: 180, x: 0.52, at: 1.55 }, { s: "carrot3", w: 148, x: 0.66, at: 1.62 }, { s: "scal2", w: 175, x: 0.58, at: 1.70 },
  { s: "corn2", w: 175, x: 0.71, at: 1.78 }, { s: "carrot1", w: 159, x: 0.62, at: 1.86 }, { s: "scal1", w: 180, x: 0.55, at: 1.94 },
];
const dropLandY = (i: number) => 0.83 + (i % 3) * 0.035; // 落进锅里的菜面（原图归一化 y）
/** 一颗菜的宽度（占格宽 %）：单颗素材比案板上的略大，按 0.62 缩到和菜堆里的差不多（约 1.15 倍） */
const dropW = (w: number) => (w / 1800) * 100 * 0.62;
const P2D_BACK = ["base", "panfull", "pile1", "pile2", "pile3"];
const P2D_FRONT = ["spatA", "spatB"];
const P2D_INIT: Record<string, number> = { base: 1, panfull: 0, pile1: 1, pile2: 0, pile3: 0, spatA: 1, spatB: 0 };
const P2D_END: Record<string, number> = { base: 1, panfull: 1, pile1: 0, pile2: 0, pile3: 0, spatA: 0, spatB: 1 };

/** 持续的动作声：只有真的 start 过才在收住时发 stop（播放还没走到 start 就离场时不发空的 stop） */
function useActionSound(name: string) {
  const on = useRef(false);
  return {
    start: (pan: number) => { on.current = true; action(name, "start", pan); },
    stop: () => { if (on.current) { on.current = false; action(name, "stop"); } },
  };
}
export function StirfryPanel({ p, pos, dy, q, stage, animate }: { p: PanelSlot; pos: Place; dy: number; q: number; stage: Stage; animate: boolean }) {
  const snd = useActionSound("stirfry");
  const els = useRef<Record<string, HTMLImageElement | null>>({});
  const box = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const live = useRef(false);
  const apply = (v: Record<string, number>) => Object.entries(v).forEach(([n, o]) => { const el = els.current[n]; if (el) gsap.set(el, { opacity: o }); });
  const hideDrops = () => DROPS.forEach((_, i) => { const el = els.current[`drop${i}`]; if (el) gsap.set(el, { opacity: 0, x: 0, y: 0, rotation: 0, xPercent: -50, yPercent: -50 }); });
  const halt = () => { if (live.current) { live.current = false; snd.stop(); } };
  const reset = () => { tl.current?.kill(); tl.current = null; apply(P2D_INIT); hideDrops(); flag(false); halt(); };
  const settle = () => { apply(P2D_END); hideDrops(); flag(false); };
  const stop = () => {
    halt();
    if (!tl.current) return;
    tl.current.kill(); tl.current = null;
    settle();
  };
  const play = () => {
    reset();
    live.current = true;
    const pan = panFor(pos);
    const t = gsap.timeline({ delay: 0.3, onComplete: () => { tl.current = null; if (animate) settle(); } });
    const H = box.current?.clientHeight ?? 300;
    // 静态格：目标是空对象，画面不动，声音时刻不变
    const g = (n: string): gsap.TweenTarget => (animate && els.current[n]) || {};
    // 姿态硬切：0.1 s 快淡入，不是慢交叉淡入（两个木铲位置差得多，慢淡入会重影）
    const swap = (from: string, to: string, at: number) => {
      t.to(g(to), { opacity: 1, duration: 0.1, ease: "none" }, at);
      t.to(g(from), { opacity: 0, duration: 0.1, ease: "none" }, at + 0.06);
    };
    if (animate) flag(true);
    swap("spatA", "spatB", 0.45); swap("pile1", "pile2", 0.45);
    swap("spatB", "spatA", 1.1);
    t.to(g("panfull"), { opacity: 1, duration: 0.15, ease: "none" }, 1.2); // 第一批菜落进锅里之后，锅里变满
    swap("spatA", "spatB", 1.5); swap("pile2", "pile3", 1.5);
    t.to(g("pile3"), { opacity: 0, duration: 0.2, ease: "none" }, 2.05); // 最后几颗也落下去，案板空了
    DROPS.forEach((d, i) => {
      const x0 = cx(d.x), y0 = cy(edgeY(d.x)), y1 = cy(dropLandY(i));
      const fall = (y1 - y0) * H, dur = 0.34 + (i % 3) * 0.03, el = g(`drop${i}`);
      t.set(el, { left: `${x0 * 100}%`, top: `${y0 * 100}%`, opacity: 1, y: 0, rotation: (i % 2 ? -1 : 1) * 15 }, d.at);
      t.to(el, { y: fall, rotation: (i % 2 ? 1 : -1) * (80 + (i % 4) * 25), duration: dur, ease: "power2.in" }, d.at);
      t.to(el, { opacity: 0, duration: 0.06, ease: "none" }, d.at + dur - 0.02);
    });
    t.call(() => oneshot("stirfryIn", pan), [], 0.45 + 0.34); // 第一颗菜落进锅里
    t.call(() => snd.start(pan), [], 2.3);
    tl.current = t;
  };
  useStage(q, stage, true, play, stop, reset);
  if (!animate) return <StaticImg src={`${P2D}static.webp`} pos={pos} aspect={p.aspect} dy={dy} />;
  const img = "absolute inset-0 block h-full w-full select-none pointer-events-none";
  const layer = (n: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={n} ref={(el) => { els.current[n] = el; }} src={`${P2D}${n}.webp`} alt="" draggable={false} className={img} style={{ opacity: P2D_INIT[n] }} />
  );
  return (
    <div ref={box} className="panel-frame absolute overflow-hidden will-change-transform" style={boxStyle(pos, p.aspect, dy)}>
      {P2D_BACK.map(layer)}
      {DROPS.map((d, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`drop${i}`} ref={(el) => { els.current[`drop${i}`] = el; }} src={`${P2D}d-${d.s}.webp`} alt="" draggable={false}
          className="absolute block select-none pointer-events-none" style={{ width: `${dropW(d.w)}%`, height: "auto", opacity: 0, transform: "translate(-50%, -50%)" }} />
      ))}
      {P2D_FRONT.map(layer)}
    </div>
  );
}

/**
 * 调酱汁格 p3a：整条手臂（袖子 + 手 + 勺）绕肩膀（框上沿）转着搅：右下 → 右 → 右上 → 回到左边，两圈后停在静止姿态。
 * 幅度取自 C-sauce 第 3 帧（右移约 5% 画布宽、下移约 1%、转 5°）；袖子往右时收进围裙后面（围裙、碗前壁、框线是遮挡层），勺头在碗里滑。
 * 声音：开始时 sauceStir start，两圈转完 / 离场 / 复位时 stop。静态格同一时刻派发。
 */
const STIR = { x: 4.9, y: 1.2, rot: 5, laps: 2, sec: 2.3 };
function sauceScript(tl: gsap.core.Timeline, t: Targets, start: () => void) {
  const st = { a: 0 };
  tl.call(start, [], 0);
  tl.to(st, {
    a: STIR.laps, duration: STIR.sec, ease: "sine.inOut",
    onUpdate: () => {
      const th = st.a * Math.PI * 2;
      gsap.set(t.part, { xPercent: (STIR.x / 2) * (1 - Math.cos(th)), yPercent: STIR.y * Math.sin(th), rotation: (STIR.rot / 2) * (1 - Math.cos(th)) });
    },
  }, 0);
}
export function SaucePanel(props: { p: PanelSlot; pos: Place; dy: number; q: number; stage: Stage; animate: boolean }) {
  const snd = useActionSound("sauceStir");
  return <LayersPanel {...props} k="p3a" pivot={[37.94, 1.64]} build={(tl, t, pan) => sauceScript(tl, t, () => snd.start(pan))} runStatic haltAtEnd onHalt={snd.stop} />;
}

/**
 * 结尾回答格 p6e "没事，是我拉肚子了。"（只在 punchline 段出现）。分层（tools/prepare_p6e_layers.py，public/assets/comic-v5/p6e/，全部 1463×1075 同尺寸同位置）：
 *   base（空泡、没有蛋脸、没有淌出的蛋黄）＋ yolk3（淌出的蛋黄，固定一个形态）＋ faceA（蛋脸，固定）＋ bubble（泡形遮罩，alpha）＋ text（对白字层）＋ steam（碗口热气）。
 * 2026-11-15 用户反馈：蛋黄和蛋脸都不该动（多层蛋黄淡入叠在一起发脏、重影；脸一动就破坏了"面无表情"的笑点）。
 * 所以只动两样，每样有理由：
 *   1. 对白：停顿 → 气泡以外的画面轻微降饱和、降对比（只作用于底图、蛋黄、蛋脸）；泡本身用泡形遮罩叠一份不加滤镜的底图，所以保持奶油白；
 *      整句约半秒内从浅墨渐浓。进入稳定前泡里是空的。
 *   2. 碗口一缕很淡的热气（常驻轻飘，只改透明度和极小的上移，不改形）。
 * 离场落到终态（降饱和 + 文字全显），复位回到原样。减少动态效果 / ?perf=0：直接显示终态静图（static.webp）。不加发光、投影、抖动。
 */
const P5 = "/assets/comic-v5/p6e/";
const P6E_TEXT = "没事，是我拉肚子了。";
const DIM = { saturate: 0.68, contrast: 0.9, brightness: 1.02 };
export function DialoguePanel({ p, pos, dy, q, stage, animate }: { p: PanelSlot; pos: Place; dy: number; q: number; stage: Stage; animate: boolean }) {
  const art = useRef<HTMLDivElement>(null);
  const els = useRef<Record<string, HTMLImageElement | null>>({});
  const tl = useRef<gsap.core.Timeline | null>(null);
  const steamTw = useRef<gsap.core.Tween | null>(null);
  const look = useRef({ dim: 0, ink: 0, show: 0 });
  const apply = () => {
    const { dim, ink, show } = look.current;
    if (art.current) art.current.style.filter = `saturate(${1 - (1 - DIM.saturate) * dim}) contrast(${1 - (1 - DIM.contrast) * dim}) brightness(${1 + (DIM.brightness - 1) * dim})`;
    const text = els.current.text;
    if (text) text.style.opacity = String(show * (0.22 + 0.78 * ink));
  };
  const setLook = (v: { dim: number; ink: number; show: number }) => { look.current = { ...v }; apply(); };
  const steamAt = (o: number) => { steamTw.current?.kill(); steamTw.current = null; const el = els.current.steam; if (el) gsap.set(el, { opacity: o, yPercent: 0 }); };
  const reset = () => { tl.current?.kill(); tl.current = null; steamAt(0); setLook({ dim: 0, ink: 0, show: 0 }); };
  const stop = () => {
    if (!tl.current) return;
    tl.current.kill(); tl.current = null;
    steamAt(0.45);
    setLook({ dim: 1, ink: 1, show: 1 });
  };
  const play = () => {
    reset();
    const st = look.current;
    const t = gsap.timeline({ delay: 0.35, onUpdate: apply, onComplete: () => { tl.current = null; } });
    t.to(st, { dim: 1, duration: 0.6, ease: "power1.inOut" }, 0); // 泡以外轻微降饱和、降对比
    t.to(st, { show: 1, duration: 0.12, ease: "none" }, 0.3); // 对白出现（浅墨）
    t.to(st, { ink: 1, duration: 0.5, ease: "power1.out" }, 0.3); // 从浅墨渐浓
    const steam = els.current.steam;
    if (steam) {
      t.to(steam, { opacity: 0.45, duration: 1.4, ease: "sine.out" }, 0.8);
      t.call(() => { steamTw.current = gsap.to(steam, { yPercent: -1.6, opacity: 0.8, duration: 3.2, ease: "sine.inOut", yoyo: true, repeat: -1 }); }, [], 2.2);
    }
    tl.current = t;
  };
  useStage(q, stage, animate, play, stop, reset);
  if (!animate) return <StaticImg src={`${P5}static.webp`} pos={pos} aspect={p.aspect} dy={dy} />;
  const img = "absolute inset-0 block h-full w-full select-none";
  const layer = (n: string, o: number) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={n} ref={(el) => { els.current[n] = el; }} src={`${P5}${n}.webp`} alt="" draggable={false} className={`${img} pointer-events-none`} style={{ opacity: o }} />
  );
  return (
    <div className="panel-frame absolute overflow-hidden will-change-transform" style={{ ...boxStyle(pos, p.aspect, dy) }}>
      {/* 会被降饱和的部分：底图、蛋黄、蛋脸（都固定不动） */}
      <div ref={art} className="absolute inset-0">
        {layer("base", 1)}
        {layer("yolk3", 1)}
        {layer("faceA", 1)}
      </div>
      {/* 泡本身：同一张底图、不加滤镜，只露出泡形遮罩里的部分 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${P5}base.webp`} alt="" draggable={false} className={img}
        style={{ maskImage: `url(${P5}bubble.webp)`, WebkitMaskImage: `url(${P5}bubble.webp)`, maskSize: "100% 100%", WebkitMaskSize: "100% 100%", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat" }} />
      {/* 对白字层：字形预先排好，不依赖浏览器字体 */}
      {layer("text", 0)}
      {layer("steam", 0)}
      <span className="sr-only">{P6E_TEXT}</span>
    </div>
  );
}

function StaticImg({ src, pos, aspect, dy }: { src: string; pos: Place; aspect: number; dy: number }) {
  return (
    <div className="panel-frame absolute will-change-transform" style={boxStyle(pos, aspect, dy)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} className="block h-full w-full select-none object-contain" />
    </div>
  );
}
