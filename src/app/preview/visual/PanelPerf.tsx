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
import { useEffect, useId, useRef, useSyncExternalStore, type CSSProperties } from "react";
import { BubbleText, BUBBLES, BUBBLE_FONT } from "./BubbleText";
import { KITCHEN_ONESHOT_EVENT } from "@/components/kitchen/useKitchenAudio";
import type { PanelSlot } from "./slots";
import { PAPER_SHADOW } from "./paper";
import { holdScroll, releaseScroll, requestTurn } from "@/lib/scroll-gate";

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

/** 开发模式下把各格的时间线挂到 window.__perf，方便在浏览器里按时间点定位（隐藏窗格里 GSAP 不走帧时也能逐帧检查）；生产构建不挂 */
declare global { interface Window { __perf?: Record<string, gsap.core.Timeline> } }
const debugTl = (k: string, t: gsap.core.Timeline) => { if (process.env.NODE_ENV !== "production") (window.__perf ??= {})[k] = t; };

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
function useStage(q: number, stage: Stage, enabled: boolean, playRaw: () => void, stopRaw: () => void, resetRaw: () => void, gateS = 0, seq = 0) {
  const played = useRef(false);
  const gateId = useId();
  const retry = useRef(0);
  const tryPlayRef = useRef<() => void>(() => {});
  // gateS > 0：开始表演时拦住滚动（src/lib/scroll-gate.ts），表演收住 / 复位 / 卸载时放开
  const wrap = (f: () => void, hold: boolean) => () => { if (!hold && retry.current) { window.clearTimeout(retry.current); retry.current = 0; } if (gateS > 0) { if (hold) holdScroll(gateId, gateS); else releaseScroll(gateId); } f(); };
  const play = wrap(playRaw, true), stop = wrap(stopRaw, false), reset = wrap(resetRaw, false);
  const wasEnabled = useRef(enabled);
  // 排队（src/lib/scroll-gate.ts requestTurn）：别的格子的表演还在播、或同段里序号更小的格子还在等时，这一格先等，每 120 ms 再问一次。
  // 每次渲染后更新"尝试开始"函数，让重试的定时器总能读到最新的格子状态。
  useEffect(() => {
    tryPlayRef.current = () => {
      retry.current = 0;
      if (!enabled || played.current) return;
      if (!(stage.entered && stage.vis >= READY_VIS && !stage.leaving)) return;
      if (gateS > 0 && !requestTurn(gateId, seq)) { retry.current = window.setTimeout(() => tryPlayRef.current(), 120); return; }
      played.current = true;
      play();
    };
  });
  useEffect(() => {
    if (!enabled) {
      if (wasEnabled.current) { wasEnabled.current = false; played.current = false; reset(); }
      return;
    }
    wasEnabled.current = true;
    if (stage.vis < GONE_VIS || (q < BEFORE_Q && !stage.entered)) { if (played.current) { played.current = false; reset(); } return; }
    if (stage.leaving || stage.vis < LEAVE_VIS) { stop(); return; }
    if (stage.entered && stage.vis >= READY_VIS && !played.current && !retry.current) tryPlayRef.current();
  });
  // 卸载时复位，并清掉"播过"标记：格子离开视口被卸载、再次进入重新挂载时能再播；
  // 开发模式 StrictMode 的"挂载 → 模拟卸载 → 再挂载"也一样（否则刚开始就被复位，而 played 还是 true，整段不播）
  useEffect(() => () => { window.clearTimeout(retry.current); played.current = false; reset(); releaseScroll(gateId); }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
  useStage(q, stage, animate, play, stop, reset, 2.4, p.order ?? 0);
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

/**
 * p5e"回头"（用户 2026-11-15 送来的 9 张姿势图，public/assets/comic-v6/p5e/，472×502，整格不透明、同画布）：
 * 背对 → 碗里的蛋招手（01/02 交替）→ 身体慢慢转（03/04/05）→ 回头惊讶（06/07）→ 落在 08（头旁三条惊讶线），停住。
 * 时间线取自用户给的 timeline.txt（共 2.4 s，之后停在 08）。真实时间只播一次；离场收住直接落到终态 08；回滚到进入前复位到 00。
 * 整格是同画布的姿势图，硬切（图与图之间是同一背景，不会重影）。
 */
const TURN_DIR = "/assets/comic-v6/p5e/";
// 2026-11-15 换成"绿色卧室走廊"版（p5e-green-bedroom-delivery，timeline.txt：背影 → 回头 → 惊讶 → 出现惊叹线，末帧停 1.8 s）
const TURN_FRAMES: [number, number][] = [[0, 0], [1, 0.4], [2, 0.9], [3, 1.4], [4, 1.6], [5, 1.9], [6, 2.2], [7, 2.28], [8, 2.4], [8, 3.4]];
export function TurnPanel({ p, pos, dy, scrub, animate }: { p: PanelSlot; pos: Place; dy: number; scrub: number; animate: boolean }) {
  const els = useRef<(HTMLImageElement | null)[]>([]);
  // 动画进度由滚动直接带动（scrub 0–1 = 这一段"停留"阶段的滚动进度）：慢滚一帧一帧走，回滚倒着走，没有"播过去"的问题
  useEffect(() => {
    const t = scrub * TURN_FRAMES[TURN_FRAMES.length - 1][1];
    let n = 0;
    for (const [i, at] of TURN_FRAMES) if (at <= t + 1e-6) n = i;
    els.current.forEach((el, i) => { if (el) el.style.opacity = i === n ? "1" : "0"; });
  });
  if (!animate) return <StaticImg src={`${TURN_DIR}pose-08.webp`} pos={pos} aspect={p.aspect} dy={dy} />;
  return (
    <div className="panel-frame absolute will-change-transform" style={boxStyle(pos, p.aspect, dy)}>
      {Array.from({ length: 9 }, (_, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} ref={(el) => { els.current[i] = el; }} src={`${TURN_DIR}pose-0${i}.webp`} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none" style={{ opacity: i === 0 ? 1 : 0 }} />
      ))}
    </div>
  );
}

/**
 * 通用"姿势序列"格（用户 2026-11-15 送来的 p4d 勺子戳蛋黄、p6d 妈妈反应）：一组同画布整格图，按时间线硬切，停在最后一张。
 * schedule：[图序号, 开始秒]；text（可选）：对白字层（透明，字是从原格里减出来的）按行逐字打出，行框 / 字数在 text.json。
 * 规则同 TurnPanel：读格到位才播一次、离场落到终态（最后一张 + 字全显）、回滚到进入前复位、走读格门（gateS）。减少动态效果时显示 staticSrc。
 */
export type SeqText = { size: [number, number]; rows: { str: string; x0: number; x1: number; y0: number; y1: number }[]; plan: { row: number; at: number; per: number }[] };
/** 对白用真字体渲染（2026-11-15 用户：从图里减出来的字层又糊又锯齿、字体也不一致）：黑体粗字，墨色，逐字显示；字号按原格里每个字的宽度（cqw = 格宽的 1%） */
const SEQ_FONT = BUBBLE_FONT;
export function SeqPanel({ p, pos, dy, scrub, animate, frames, schedule, text, staticSrc, loop, hits, scrubLoop, blend, loopOn = true }: {
  p: PanelSlot; pos: Place; dy: number; scrub: number; animate: boolean;
  frames: string[]; schedule: [number, number][]; text?: SeqText; staticSrc: string;
  /** 循环周期（秒）：给了就按真实时间不停循环（炒菜这类一直在做的动作），不再由滚动带动 */
  loop?: number;
  /** 循环模式的开关：false 时停在第一帧，true 才开始循环 */
  loopOn?: boolean;
  /** 循环模式下，每圈里这些时刻（秒）各响一声刀刃落案板 */
  hits?: number[];
  /** 滚动循环：滚动进度 0–1 走 cycles 圈（每圈 period 秒的帧表），帧由滚动带动；hitFrames 里的帧每次切入时响一声刀刃落案板 */
  scrubLoop?: { period: number; cycles: number; hitFrames?: number[] };
  /** 相邻两帧按滚动进度交叉淡化（帧数少、动作大的格子用：硬切会一顿一顿，淡化后是连续的） */
  blend?: boolean;
}) {
  const els = useRef<(HTMLImageElement | null)[]>([]);
  const rowEls = useRef<(HTMLDivElement | null)[]>([]);
  const lastN = useRef(0);
  // 总时长 = 最后一次换图 / 最后一个字出现的时刻；滚动进度 × 总时长 = 当前"动画时间"，帧和字都由它决定（滚动直接带动，可倒放）
  const total = Math.max(schedule[schedule.length - 1][1], ...(text?.plan.map((pl) => pl.at + [...(text.rows[pl.row].str)].length * pl.per) ?? [0]));
  useEffect(() => {
    if (!loop || !animate) return;
    if (!loopOn) { els.current.forEach((el, i) => { if (el) el.style.opacity = i === 0 ? "1" : "0"; }); return; }
    const t0 = performance.now();
    let prev = 0;
    const tick = () => {
      const t = ((performance.now() - t0) / 1000) % loop;
      for (const h of hits ?? []) if ((prev < h && h <= t) || (t < prev && (h > prev || h <= t))) oneshot("chopHit", 0);
      prev = t;
      let n = 0;
      for (const [i, at] of schedule) if (at <= t + 1e-6) n = i;
      els.current.forEach((el, i) => { if (el) el.style.opacity = i === n ? "1" : "0"; });
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [loop, loopOn, animate, schedule, hits]);
  useEffect(() => {
    if (loop) return;
    const t = scrubLoop ? (scrub * scrubLoop.cycles * scrubLoop.period) % scrubLoop.period : scrub * total;
    let n = 0;
    for (const [i, at] of schedule) if (at <= t + 1e-6) n = i;
    if (scrubLoop?.hitFrames) {
      if (n !== lastN.current && scrubLoop.hitFrames.includes(n) && scrub > 0 && scrub < 1) oneshot("chopHit", 0);
      lastN.current = n;
    }
    if (blend) {
      // 交叉淡化：当前帧全不透明垫底，下一帧按到下一个时刻的进度（smoothstep）淡入盖上去
      let k = 0;
      for (let j = 0; j < schedule.length; j++) if (schedule[j][1] <= t + 1e-6) k = j;
      const cur = schedule[k], nxt = schedule[Math.min(k + 1, schedule.length - 1)];
      const span = nxt[1] - cur[1];
      const u = span > 1e-6 ? Math.min(1, Math.max(0, (t - cur[1]) / span)) : 0;
      const fr = u * u * (3 - 2 * u);
      els.current.forEach((el, i) => { if (el) el.style.opacity = i === cur[0] ? "1" : i === nxt[0] ? fr.toFixed(3) : "0"; });
    } else els.current.forEach((el, i) => { if (el) el.style.opacity = i === n ? "1" : "0"; });
    text?.rows.forEach((row, r) => {
      const plan = text.plan.find((pl) => pl.row === r);
      const k = plan ? Math.max(0, Math.min([...row.str].length, Math.floor((t - plan.at) / plan.per) + 1)) : 0;
      const el = rowEls.current[r];
      if (el) Array.from(el.children).forEach((c, i) => { (c as HTMLElement).style.opacity = i < k ? "1" : "0"; });
    });
  });
  if (!animate) return <StaticImg src={staticSrc} pos={pos} aspect={p.aspect} dy={dy} />;
  return (
    <div className="panel-frame absolute will-change-transform" style={{ ...boxStyle(pos, p.aspect, dy), containerType: "inline-size" }}>
      {frames.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} ref={(el) => { els.current[i] = el; }} src={src} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none" style={{ opacity: i === 0 ? 1 : 0 }} />
      ))}
      {text?.rows.map((row, r) => {
        const chars = [...row.str];
        const fs = ((row.x1 - row.x0) / chars.length / text.size[0]) * 100; // cqw
        return (
          <div key={r} ref={(el) => { rowEls.current[r] = el; }} aria-hidden className="pointer-events-none absolute whitespace-nowrap"
            style={{ left: `${(row.x0 / text.size[0]) * 100}%`, top: `${(row.y0 / text.size[1]) * 100}%`, height: `${((row.y1 - row.y0) / text.size[1]) * 100}%`, display: "flex", alignItems: "center", fontFamily: SEQ_FONT, fontWeight: 600, fontSize: `${fs.toFixed(3)}cqw`, lineHeight: 1, color: "#2b2118", textRendering: "geometricPrecision", WebkitFontSmoothing: "antialiased" }}>
            {chars.map((c, i) => <span key={i} style={{ opacity: 0 }}>{c}</span>)}
          </div>
        );
      })}
      {!text && BUBBLES[p.key] && <BubbleText k={p.key} progress={Math.min(1, scrub * 2.2)} />}
      <span className="sr-only">{text?.rows.map((r) => r.str).join("")}</span>
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
    debugTl(k, t);
  };
  useStage(q, stage, animate || runStatic, play, stop, reset, animate ? 2.6 : 0, p.order ?? 0);
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
 * 切胡萝卜格 p2b（2026-11-15 用 ChatGPT 的 p2b-finished 素材，tools/prepare_p2b_final.py → comic-v4/layers/p2b-*）。
 * 唯一的一只握刀手（K0：袖口 + 手 + 刀，一个刚体）绕固定的刀尖旋转：刀尖始终贴在胡萝卜左端，刀跟连手抬起（最多约 12°）再压下，
 * 手的大小和右手一致，袖子从画面外连进来（被对白泡盖住连接处），解剖不会变形。几次试过的别的做法（逐姿态硬切、整只手平移 18%、
 * 拿生成的不同姿态拼）都因为手型跳变、手臂断开或刀尖落在空处撤掉了。
 *   层：p2b-base（去掉握刀手的底图）→ p2b-part（K0，支点 = 刀尖）→ p2b-front（对白泡，盖在袖子上面）。
 * 每刀：抬刀跟（刀尖不动）→ 停一小会 → 快压下去（接触那一刻派发 chopHit）→ 短停。匀速、幅度略有不同，不像节拍器。共 5 刀，约 5 s（2026-11-15 放慢）。
 * 不含胡萝卜被切短 / 菜丁变多（素材里没有）。静态格（减少动态效果）＝静止姿态，三下刀声照常、时刻相同。
 */
const CHOP_STROKES = 5; // 2026-11-15 用户：切得太快，要慢慢切：8 刀越切越快 → 5 刀匀速、整体放慢（见 chopScript 末尾 timeScale）
const CHOP_AMP = [11, 12, 10, 12, 9]; // 每刀抬刀跟的角度（度）：绕刀尖顺时针 = 刀跟抬起
function chopScript(tl: gsap.core.Timeline, t: Targets, pan: number) {
  let at = 0;
  for (let i = 0; i < CHOP_STROKES; i++) {
    const k = 1; // 匀速，不再越切越快
    const rise = 0.3 * k + 0.1;
    tl.to(t.part, { rotation: CHOP_AMP[i], duration: rise, ease: "sine.out" }, at); // 抬刀跟：刀尖留在菜上
    at += rise + 0.05 * k;
    tl.to(t.part, { rotation: 0, duration: 0.12, ease: "power3.in" }, at); // 快压下去
    at += 0.12;
    tl.call(() => oneshot("chopHit", pan), [], at); // 刀刃接触
    at += 0.12 + (i === CHOP_STROKES - 1 ? 0 : 0.14 * k);
  }
  tl.timeScale(0.8); // 整体放慢：每刀约 1 s（刀声挂在同一条时间轴上，跟着一起慢）
}
export function ChopPanel(props: { p: PanelSlot; pos: Place; dy: number; q: number; stage: Stage; animate: boolean }) {
  return <LayersPanel {...props} k="p2b" pivot={[56.73, 82.5]} delay={0.35} build={chopScript} runStatic />;
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
const P2D_SPEED = 0.8; // 倒菜动画的时间倍率（<1 = 慢）；读格门（gateS = 3.2 / 倍率 ≈ 4 s）拦到它演完，之后继续滚（用户 2026-11-15：格内动画一定在滚两下内播完，然后可以继续滚） // 倒菜动画的时间倍率（<1 = 慢）；读格门（gateS）按它同比拉长
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
export function StirfryPanel({ p, pos, dy, q, stage, animate, textP }: { p: PanelSlot; pos: Place; dy: number; q: number; stage: Stage; animate: boolean; textP?: number }) {
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
    t.timeScale(P2D_SPEED); // 2026-11-15 用户：上面倒菜这格太快 → 整条时间轴放慢（声音时刻跟着慢）
    tl.current = t;
    debugTl("p2d", t);
  };
  useStage(q, stage, true, play, stop, reset, animate ? 3.2 / P2D_SPEED : 0, p.order ?? 0);
  if (!animate) return <StaticImg src={`${P2D}static.webp`} pos={pos} aspect={p.aspect} dy={dy} />;
  const img = "absolute inset-0 block h-full w-full select-none pointer-events-none";
  const layer = (n: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={n} ref={(el) => { els.current[n] = el; }} src={`${P2D}${n}.webp`} alt="" draggable={false} className={img} style={{ opacity: P2D_INIT[n] }} />
  );
  return (
    <div ref={box} className="panel-frame absolute overflow-hidden will-change-transform" style={{ ...boxStyle(pos, p.aspect, dy), containerType: "inline-size" }}>
      {P2D_BACK.map(layer)}
      {DROPS.map((d, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`drop${i}`} ref={(el) => { els.current[`drop${i}`] = el; }} src={`${P2D}d-${d.s}.webp`} alt="" draggable={false}
          className="absolute block select-none pointer-events-none" style={{ width: `${dropW(d.w)}%`, height: "auto", opacity: 0, transform: "translate(-50%, -50%)" }} />
      ))}
      {textP !== undefined && <BubbleText k={p.key} progress={textP} />}
      {P2D_FRONT.map(layer)}
    </div>
  );
}

/**
 * 调酱汁格 p3a（2026-11-15 用 ChatGPT 交付的 p3a-stir.webp，public/assets/comic-v5/p3a/stir.webp）。
 * 以前是把整条手臂当一张贴图绕肩转，手臂是刚体、酱汁不动；现在是 6 张手绘的搅拌姿态（勺子在碗里一圈的位置，手腕、袖子、酱汁漩涡随之变化）
 * 补成的 42 帧、25 fps、1.64 s 一圈的首尾相接循环动画图（508×508）。
 * 格子到位后才挂上动画图（每次从第 1 帧开始，所以和静态格首帧完全一致），搅 3 圈（约 4.9 s，声音 sauceStir 同时开始）后停回静态的第 1 帧（首尾相接，不跳）。
 * 离场 / 复位：卸掉动画图，回到静态首帧，声音停。减少动态效果：静态首帧，声音时刻不变。
 * 注意：动画图自己循环，离场收住时可能停在圈中间（立即落回首帧，一帧的跳变，离场时发生，看不到）。
 */
const P3A = "/assets/comic-v5/p3a/";
const STIR_LOOP_MS = 1640;
const STIR_LAPS = 3;
export function SaucePanel({ p, pos, dy, q, stage, animate }: { p: PanelSlot; pos: Place; dy: number; q: number; stage: Stage; animate: boolean }) {
  const snd = useActionSound("sauceStir");
  const anim = useRef<HTMLImageElement>(null);
  const timer = useRef(0);
  const live = useRef(false);
  const clear = () => {
    window.clearTimeout(timer.current);
    const el = anim.current;
    if (el) { el.onload = null; el.style.opacity = "0"; el.removeAttribute("src"); }
  };
  const halt = () => { if (live.current) { live.current = false; snd.stop(); } };
  const reset = () => { clear(); halt(); flag(false); };
  const stop = () => { if (!live.current) return; clear(); halt(); flag(false); };
  const play = () => {
    reset();
    live.current = true;
    const pan = panFor(pos);
    snd.start(pan);
    const el = anim.current;
    if (animate && el) {
      flag(true);
      // 换一个带时间戳的地址，动画图每次都从第 1 帧开始；解码好才显示，之前底下是静态首帧
      el.onload = () => { el.style.opacity = "1"; };
      el.src = `${P3A}stir.webp?t=${Date.now()}`;
    }
    timer.current = window.setTimeout(() => { clear(); halt(); flag(false); }, STIR_LOOP_MS * STIR_LAPS);
  };
  useStage(q, stage, true, play, stop, reset, animate ? 2.8 : 0, p.order ?? 0);
  if (!animate) return <StaticImg src={`${P3A}static.webp`} pos={pos} aspect={p.aspect} dy={dy} />;
  const img = "absolute inset-0 block h-full w-full select-none pointer-events-none";
  return (
    <div className="panel-frame absolute overflow-hidden will-change-transform" style={boxStyle(pos, p.aspect, dy)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${P3A}static.webp`} alt="" draggable={false} className={img} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={anim} alt="" draggable={false} aria-hidden className={img} style={{ opacity: 0 }} />
    </div>
  );
}

/**
 * 结尾回答格 p6e "没事，是我拉肚子了。"（只在 punchline 段出现）。2026-11-15 用 ChatGPT 的三张新帧做"蛋黄流动"（tools/prepare_p6e_flow.py，public/assets/comic-v5/p6e/）：
 *   base = 04 帧（起点就是"已经流出来不少"，接得上上一格 p6d，泡里是空的）；patch2 / patch3 = 05（更多）/ 06（流成一滩）帧里"蛋黄流出处"的一块羽化椭圆（已配准到 04），其余画面永远是 04。
 *   为什么不整张交叉淡入：三张是各自重新生成的，碗沿、米粒的线条有细小差异，整张淡入会出现重影；只换流出处的一块，别处纹丝不动。
 *   蛋、蛋脸、碗都不动，只有蛋黄在流：从已经流出来不少，淌到更多（patch2 淡入 1.0 s），再淌成一滩（patch3 淡入 1.2 s），停在最远，不倒回去（用户 2026-11-15：上一格已经流出来不少，只能"更多"，不能先缩回去）。
 * 对白：停顿 → 气泡以外的画面轻微降饱和、降对比（作用于底图和补丁）；泡本身用泡形遮罩（bubble.webp，alpha）叠一份不加滤镜的底图，保持奶油白；
 * 对白字层（text.webp，旧字层按新泡外框缩放）整句约半秒内从浅墨渐浓。进入稳定前泡里是空的。
 * 离场落到终态（降饱和 + 文字全显 + 蛋黄流到最远），复位回到原样。减少动态效果 / ?perf=0：直接显示终态静图（static.webp）。不加发光、投影、抖动。
 */
const P5 = "/assets/comic-v5/p6e/";
const P6E_TEXT = "没事，是我拉肚子了。";
const DIM = { saturate: 0.68, contrast: 0.9, brightness: 1.02 };
/**
 * 对白逐字打出（2026-11-15 用户）：一个字一个字、匀速、一口气打完整句（不是几个字一起出，也不分段），蛋黄从第一个字开始就往下流。
 * text.webp 是整句一张图（1400 宽），按每个字的右边缘做 clip-path 步进裁切；每字的右边缘（原图像素）量自 text.webp 的列投影。
 */
const P6E_EDGES = [300, 400, 485, 530, 655, 740, 824, 908, 994, 1076, 1120]; // [0] = 一个字都没有；之后依次是 没 事 ， 是 我 拉 肚 子 了 。
const P6E_TYPE = { start: 0.1, perChar: 0.15 }; // 开始时刻（时间轴秒）、每字秒数（10 字 ≈ 1.5 s；2026-11-15 提速：用户滚得快，原来 0.35 s 延迟 + 1.9 s 打字看不完）
const typed = (n: number) => `inset(0 ${(((1400 - P6E_EDGES[Math.max(0, Math.min(P6E_EDGES.length - 1, Math.round(n)))]) / 1400) * 100).toFixed(2)}% 0 0)`;

export function DialoguePanel({ p, pos, dy, q, stage, animate }: { p: PanelSlot; pos: Place; dy: number; q: number; stage: Stage; animate: boolean }) {
  const art = useRef<HTMLDivElement>(null);
  const els = useRef<Record<string, HTMLImageElement | null>>({});
  const tl = useRef<gsap.core.Timeline | null>(null);
  const look = useRef({ dim: 0, n: 0, f2: 0, f3: 0 });
  const apply = () => {
    const { dim, n, f2, f3 } = look.current;
    if (art.current) art.current.style.filter = `saturate(${1 - (1 - DIM.saturate) * dim}) contrast(${1 - (1 - DIM.contrast) * dim}) brightness(${1 + (DIM.brightness - 1) * dim})`;
    if (els.current.text) { els.current.text.style.opacity = n >= 0.5 ? "1" : "0"; els.current.text.style.clipPath = typed(n); }
    if (els.current.patch2) els.current.patch2.style.opacity = String(f2);
    if (els.current.patch3) els.current.patch3.style.opacity = String(f3);
  };
  const setLook = (v: { dim: number; n: number; f2: number; f3: number }) => { look.current = { ...v }; apply(); };
  const reset = () => { tl.current?.kill(); tl.current = null; setLook({ dim: 0, n: 0, f2: 0, f3: 0 }); };
  const stop = () => { if (!tl.current) return; tl.current.kill(); tl.current = null; setLook({ dim: 1, n: P6E_TEXT.length, f2: 1, f3: 1 }); };
  const play = () => {
    reset();
    const st = look.current;
    const t = gsap.timeline({ delay: 0.1, onUpdate: apply, onComplete: () => { tl.current = null; } });
    const typeS = P6E_TEXT.length * P6E_TYPE.perChar;
    t.to(st, { dim: 1, duration: 0.6, ease: "power1.inOut" }, 0); // 泡以外轻微降饱和、降对比
    t.to(st, { n: P6E_TEXT.length, duration: typeS, ease: `steps(${P6E_TEXT.length})` }, P6E_TYPE.start); // 逐字打出：一口气、匀速、一次一个字
    t.to(st, { f2: 1, duration: 1.0, ease: "sine.inOut" }, P6E_TYPE.start + 0.05); // 蛋黄随着第一个字就开始往外淌
    t.to(st, { f3: 1, duration: 1.1, ease: "sine.inOut" }, P6E_TYPE.start + 0.6); // 边打边淌成一滩，打完字时已基本流开、随后停住
    tl.current = t;
    debugTl("p6e", t);
  };
  useStage(q, stage, animate, play, stop, reset, 2.2, p.order ?? 0);
  if (!animate) return <StaticImg src={`${P5}static.webp`} pos={pos} aspect={p.aspect} dy={dy} />;
  const img = "absolute inset-0 block h-full w-full select-none pointer-events-none";
  const layer = (n: string, o: number) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={n} ref={(el) => { els.current[n] = el; }} src={`${P5}${n}.webp`} alt="" draggable={false} className={img} style={{ opacity: o }} />
  );
  return (
    <div className="panel-frame absolute overflow-hidden will-change-transform" style={{ ...boxStyle(pos, p.aspect, dy) }}>
      {/* 会被降饱和的部分：底图（04 帧）+ 蛋黄流出处的两块补丁 */}
      <div ref={art} className="absolute inset-0">
        {layer("base", 1)}
        {layer("patch2", 0)}
        {layer("patch3", 0)}
      </div>
      {/* 泡本身：同一张底图、不加滤镜，只露出泡形遮罩里的部分 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${P5}base.webp`} alt="" draggable={false} className={img}
        style={{ maskImage: `url(${P5}bubble.webp)`, WebkitMaskImage: `url(${P5}bubble.webp)`, maskSize: "100% 100%", WebkitMaskSize: "100% 100%", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat" }} />
      {layer("text", 0)}
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
