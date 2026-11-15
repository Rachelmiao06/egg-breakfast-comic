"use client";
/**
 * 漫画格内部的表演（只有两格，其余漫画保持静态）。图层由 tools/prepare_perf_layers.py 从用户给的四张配套图生成。
 *
 * 切菜格 p2b：底图（去掉握刀手）+ 握刀手臂层（以袖口为支点）+ 对白泡（叠在手臂上，压住袖口，和原图一样）。
 *   格子稳定进入后（段内 q 越过 0.36）真实时间切三下：抬刀 → 停一下 → 落刀 → 刀刃接触的那一帧派发 kitchen:oneshot chopHit（落刀声）→ 停顿；
 *   三刀后停住不再动。倒滚不重播；回到格子进入之前（q < 0.3）再向前进入才会再播；格子开始离开（q > 0.72）时立即收住。
 * 听见格 p3d：原格 → 抬眼 → 疑惑，只换眉眼和嘴（与原格逐像素对齐），硬切，不做交叉淡化，不晃动整张脸；停在疑惑。
 *   同样在越过 0.36（“啵”之后）开始，先停 0.5 秒再抬眼，1.3 秒时露出疑惑。
 * 两格表演进行时在 <html data-comic-perf> 上做标记，后景的蛋暂缓小跳，不抢前景。
 * 减少动态效果或 ?perf=0：显示原静态格（对比录屏用）；切菜格仍在同一时机按同样节奏放三下刀声，画面不动。
 */
import gsap from "gsap";
import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from "react";
import { KITCHEN_ONESHOT_EVENT } from "@/components/kitchen/useKitchenAudio";
import type { PanelSlot } from "./slots";

type Place = { x: number; y: number; w: number };
/** 格子在屏幕上的状态（ComicLayer 按布局算）：可见比例、入场是否结束、是否开始离场 */
export type Stage = { vis: number; entered: boolean; leaving: boolean };
/** 可见 ≥ 90% 且入场结束才开始；可见 < 60% 或开始离场就收住；几乎看不见（< 12%）或退回入场前才复位，下次进入再播 */
const READY_VIS = 0.9, LEAVE_VIS = 0.6, GONE_VIS = 0.12, BEFORE_Q = 0.2;
/**
 * 听见格 p3d 的表演：开始的那一刻派发 HEAR_EVENT（phase "start"），后景的蛋同一时刻起跳（Egg peek）；
 * eyesMs 时妈妈抬眼看向右上（蛋正在上升），蛋随后到达最高点，puzzMs 时露出疑惑（蛋已在下落）。
 * 收住时派发 "stop"（蛋尽快落回），复位时派发 "reset"（下次进入可再跳）。蛋和表情听同一个事件，保证是同一段动作。
 */
export const HEAR_CUE = { eyesMs: 500, puzzMs: 1300 } as const;
export const HEAR_EVENT = "comic:hear";
const hearSignal = (phase: "start" | "stop" | "reset") => window.dispatchEvent(new CustomEvent(HEAR_EVENT, { detail: { phase } }));
const P = "/assets/comic-v3/perf/";

export function usePerfEnabled() {
  return useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("perf") !== "0",
    () => true,
  );
}

function boxStyle(pos: Place, aspect: number, dy: number): CSSProperties {
  return { left: `${pos.x}vw`, top: `${pos.y}vh`, width: `${pos.w}vw`, aspectRatio: `${aspect}`, transform: `translate3d(0, ${dy}vh, 0)` };
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
  useEffect(() => () => { reset(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
    <div className="absolute will-change-transform" style={boxStyle(pos, p.aspect, dy)}>
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
 * 配菜下锅格 p2d：空中两粒玉米（能和锅底干净分开的只有这两粒）单独成层，底图原位置补了同一锅底的纹理。
 * 格子稳定后两小批：第一批从原位置落进锅里没入菜堆；停一下，第二批从铲边稍高处出现再落下；之后停住（菜已入锅，不再倒）。
 * "滋啦"沿用节拍表里的 stirfryIn（按滚动在段内 0.22 触发），这里不派发声音，避免重复。
 * 木铲推动、砧板倾斜、热气需要新图（见 docs/tasks/scroll-motion-demo-asset-requests.md）。
 */
/**
 * 逐帧格内动作（稳定底图 + 只在动作区域切换的连续帧，tools/prepare_frames.py 生成）。
 * - f1 是整格底图（框线、对白、躯干、环境、静态格都用它）；f2、f3… 只在"手、工具、食物"所在的动作区域有像素，区域外透明。
 * - 换帧是硬切：同一时刻只显示一张动作层，不会叠出两只手、两把勺子；框线和对白始终来自底图，不跟着跳。
 * - 触发、收住、复位走 useStage（格子真的在阅读位置才按真实时间播一遍，停止滚动也播完）；离场时直接落到终帧。
 * - 隐藏标签页时 GSAP 时间轴随 rAF 暂停，回来接着播，不积累计时器。
 */
type FrameStep = { f: number; ms: number };
function FramesPanel({
  p, pos, dy, q, stage, animate, dir, steps, endFrame = 1, delay = 0.3, onStep, front = false, runStatic = false, onEnd, onHalt, haltAtEnd = false,
}: {
  p: PanelSlot; pos: Place; dy: number; q: number; stage: Stage; animate: boolean;
  /** 资源前缀，如 /assets/comic-v4/frames/p3a */
  dir: string;
  /** 播放顺序（帧号从 1 开始）和每帧停留毫秒 */
  steps: FrameStep[];
  /** 播完 / 离场后停住的帧 */
  endFrame?: number;
  delay?: number;
  /** 每切到一帧时的回调（例如落刀接触帧派发声音） */
  onStep?: (f: number, i: number) => void;
  /** 有稳定前景遮挡层（<dir>-front.webp：对白泡、锅沿等，从底图取出，画在动作帧之上） */
  front?: boolean;
  /** 静态格（减少动态效果）时也按同样时刻跑 onStep（只放声音，画面不动） */
  runStatic?: boolean;
  /** 所有帧播完的那一刻（静态格同一时刻） */
  onEnd?: () => void;
  /** 播过之后被收住（离场）或复位时（用来停掉持续的动作声） */
  onHalt?: () => void;
  /** 播完就算结束（动作声随动画结束）：播完时调 onHalt，之后离场不再重复调 */
  haltAtEnd?: boolean;
}) {
  const count = Math.max(...steps.map((s) => s.f), endFrame);
  const layers = useRef<(HTMLImageElement | null)[]>([]);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const show = (f: number) => layers.current.forEach((el, i) => { if (el) el.style.opacity = i + 2 === f ? "1" : "0"; });
  /** 从 play 到 halt 之间为真：只在真的播过时才派发 onHalt */
  const live = useRef(false);
  const halt = () => { if (live.current) { live.current = false; onHalt?.(); } };
  const reset = () => { tl.current?.kill(); tl.current = null; show(1); flag(false); halt(); };
  const stop = () => { halt(); if (!tl.current) return; tl.current.kill(); tl.current = null; show(endFrame); flag(false); };
  const play = () => {
    reset();
    live.current = true;
    if (!animate) {
      // 静态格：画面不动，只在同样的时刻跑 onStep / onEnd（例如三下落刀声）
      const t = gsap.timeline({ delay, onComplete: () => { tl.current = null; } });
      let at = 0;
      steps.forEach((st, i) => { t.call(() => onStep?.(st.f, i), [], at); at += st.ms / 1000; });
      t.call(() => { onEnd?.(); if (haltAtEnd) halt(); }, [], at);
      tl.current = t;
      return;
    }
    flag(true);
    const t = gsap.timeline({ delay, onComplete: () => { tl.current = null; show(endFrame); flag(false); } });
    let at = 0;
    steps.forEach((s, i) => {
      t.call(() => { show(s.f); onStep?.(s.f, i); }, [], at);
      at += s.ms / 1000;
    });
    t.call(() => { show(endFrame); onEnd?.(); if (haltAtEnd) halt(); }, [], at);
    tl.current = t;
  };
  useStage(q, stage, animate || runStatic, play, stop, reset);
  if (!animate) return <StaticImg src={`${dir}-f1.webp`} pos={pos} aspect={p.aspect} dy={dy} />;
  return (
    <div className="absolute will-change-transform" style={boxStyle(pos, p.aspect, dy)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${dir}-f1.webp`} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none" />
      {Array.from({ length: count - 1 }, (_, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} ref={(el) => { layers.current[i] = el; }} src={`${dir}-f${i + 2}.webp`} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none" style={{ opacity: 0 }} />
      ))}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {front && <img src={`${dir}-front.webp`} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none" />}
    </div>
  );
}

const F4 = "/assets/comic-v4/frames/";
/** 声音事件（混音器在 kitchen-audio 分支接收；没收到就静音）。时刻都挂在 useStage 的真实时间轴上 */
const oneshot = (sound: string) => window.dispatchEvent(new CustomEvent(KITCHEN_ONESHOT_EVENT, { detail: { sound } }));
const action = (name: string, phase: "start" | "stop") => window.dispatchEvent(new CustomEvent("kitchen:action", { detail: { name, phase } }));

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
 * 调酱汁格 p3a（new pics/C-sauce 三帧）：勺子在碗里 左 → 后 → 右前 → 左，绕两圈后停在第 1 帧（和静态格一样）。
 * 扶碗的手、碗身、瓶子、框线都在动作区域外，始终是底图。
 */
const SAUCE_STEPS: FrameStep[] = [1, 2, 3, 1, 2, 3].map((f) => ({ f, ms: 210 }));
/** 声音：两圈开始时 sauceStir start，两圈转完 / 离场 / 复位时 stop。静态格同一时刻派发 */
const sauceStep = (_f: number, i: number) => { if (i === 0) action("sauceStir", "start"); };
export function SaucePanel(props: { p: PanelSlot; pos: Place; dy: number; q: number; stage: Stage; animate: boolean }) {
  return <FramesPanel {...props} dir={`${F4}p3a`} steps={SAUCE_STEPS} endFrame={1} runStatic onStep={sauceStep} haltAtEnd onHalt={() => action("sauceStir", "stop")} />;
}

/**
 * 切胡萝卜格 p2b（new pics/A-chopping 三帧：1 抬刀、2 接近、3 落刀）：
 * 抬 → 接近 → 落（落刀帧派发 chopHit）→ 回抬，三刀，最后停在落刀后的稳定帧。对白泡是前景遮挡层，袖子从泡后面经过时泡不跳。
 * 静态格（减少动态效果）画面停在第 1 帧，三下刀声照常、时刻相同。
 */
const CHOP_STEPS: FrameStep[] = [
  ...[0, 1, 2].flatMap((k) => [
    { f: 1, ms: k === 0 ? 160 : 150 },
    { f: 2, ms: 75 },
    { f: 3, ms: k === 2 ? 1 : 280 }, // 落刀：刀刃接触胡萝卜
    ...(k === 2 ? [] : [{ f: 2, ms: 90 }]),
  ]),
];
const chopHit = (f: number) => { if (f === 3) window.dispatchEvent(new CustomEvent(KITCHEN_ONESHOT_EVENT, { detail: { sound: "chopHit" } })); };
export function ChopPanel(props: { p: PanelSlot; pos: Place; dy: number; q: number; stage: Stage; animate: boolean }) {
  return <FramesPanel {...props} dir={`${F4}p2b`} steps={CHOP_STEPS} endFrame={3} delay={0.35} onStep={chopHit} front runStatic />;
}

/**
 * 配菜入锅格 p2d（new pics/B-pouring 三帧：1 开始滑落、2 木铲推动、3 已入锅）：只向前播一次，停在第 3 帧，不倒放。
 * 锅身前沿和对白泡是前景遮挡层，菜落进锅里而不是浮在锅上。"滋啦"沿用节拍表里的 stirfryIn，不另发。
 */
const POUR_STEPS: FrameStep[] = [{ f: 1, ms: 380 }, { f: 2, ms: 520 }, { f: 3, ms: 1 }];
/** 声音：第 2 帧（菜被推下、落进锅里）"滋啦" stirfryIn；第 3 帧（已入锅）开始翻炒声，离场 / 复位时停。静态格同一时刻派发 */
const pourStep = (f: number) => { if (f === 2) oneshot("stirfryIn"); };
export function StirfryPanel(props: { p: PanelSlot; pos: Place; dy: number; q: number; stage: Stage; animate: boolean }) {
  return <FramesPanel {...props} dir={`${F4}p2d`} steps={POUR_STEPS} endFrame={3} front runStatic onStep={pourStep} onEnd={() => action("stirfry", "start")} onHalt={() => action("stirfry", "stop")} />;
}

function StaticImg({ src, pos, aspect, dy }: { src: string; pos: Place; aspect: number; dy: number }) {
  return (
    <div className="absolute will-change-transform" style={boxStyle(pos, aspect, dy)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} className="block h-full w-full select-none object-contain" />
    </div>
  );
}
