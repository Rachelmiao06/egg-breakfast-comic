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
    <div className="absolute overflow-hidden will-change-transform" style={boxStyle(pos, p.aspect, dy)}>
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
 * 三刀：小抬 → 快落 → 刀刃接触的那一刻派发 chopHit → 短停 → 抬回 → 停顿；三刀后停在抬刀姿态（和静态格一样）。
 * 静态格画面不动，三下刀声照常、时刻相同。
 */
const CHOP_DOWN = { yPercent: 18, xPercent: 0, rotation: 1.5 };
function chopScript(tl: gsap.core.Timeline, t: Targets, pan: number) {
  let at = 0;
  for (let i = 0; i < 3; i++) {
    tl.to(t.part, { yPercent: -1.6, rotation: -0.8, duration: 0.1, ease: "power1.out" }, at); // 小抬
    at += i === 0 ? 0.14 : 0.11;
    tl.to(t.part, { ...CHOP_DOWN, duration: 0.1, ease: "power3.in" }, at); // 落刀
    at += 0.1;
    tl.call(() => oneshot("chopHit", pan), [], at); // 刀刃接触
    at += 0.07;
    tl.to(t.part, { yPercent: 0, xPercent: 0, rotation: 0, duration: 0.22, ease: "power2.out" }, at); // 抬回
    at += 0.22 + (i === 2 ? 0 : 0.1);
  }
}
export function ChopPanel(props: { p: PanelSlot; pos: Place; dy: number; q: number; stage: Stage; animate: boolean }) {
  return <LayersPanel {...props} k="p2b" pivot={[6.81, 42.16]} delay={0.35} build={chopScript} runStatic />;
}

/**
 * 配菜入锅格 p2d：只往前播一次，最后菜已入锅、案板上空了，不倒放回案板。
 * 手腕在框上沿，木铲绕手腕摆：先探进菜堆（往右上，铲头钻到菜下面），再往左下推回来——推回来时案板上的菜堆整堆顺着案板往下沿滑，
 * 过了案板下沿就看不见（菜堆层裁在案板面里），同时铲边掉下的菜（三颗各自一层，循环用）落进锅里、在锅里的菜面上淡出。推两下，菜全部下锅。
 * 终态（播完、离场）：木铲回到原位，菜堆和掉落的菜都不在了；复位（再次进入前）才回到第 1 帧的样子。
 * 锅身前沿、对白泡、框线是遮挡层。
 * 声音：第一颗菜落进锅里的那一刻 stirfryIn（每次播放一次）；推完开始持续翻炒声 stirfry（混音器里静音），离场 / 复位时停。静态格同一时刻派发。
 */
const DROP_FALL = 22; // 掉落距离（画布高百分比）：从案板边落到锅里的菜面
/** 菜堆顺着案板往下沿滑的总位移（画布百分比）：最远的葱圈也要越过案板下沿 */
const PILE_SLIDE = { x: -24, y: 64 };
/** 案板上表面（第 1 帧的位置，画布百分比）：菜堆层裁在这里面，滑过下沿就消失 */
const BOARD_CLIP = "polygon(55.5% 0%, 100% 0%, 100% 6%, 80.6% 66.4%, 36.6% 47.4%)";
function stirfryScript(tl: gsap.core.Timeline, t: Targets, pan: number, start: () => void) {
  const stroke = (at: number, k0: number, k1: number) => {
    tl.to(t.part, { rotation: -5, duration: 0.36, ease: "sine.inOut" }, at); // 探进菜堆
    tl.to(t.part, { rotation: 0.8, duration: 0.42, ease: "power2.inOut" }, at + 0.36); // 推回来
    tl.to(t.part, { rotation: 0, duration: 0.2, ease: "sine.out" }, at + 0.78);
    tl.fromTo(t.pile, { xPercent: PILE_SLIDE.x * k0, yPercent: PILE_SLIDE.y * k0 }, { xPercent: PILE_SLIDE.x * k1, yPercent: PILE_SLIDE.y * k1, duration: 0.62, ease: "power1.inOut", immediateRender: false }, at + 0.4);
  };
  const fall = (d: object, at: number) => {
    tl.fromTo(d, { yPercent: -6, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.1, ease: "none", immediateRender: false }, at - 0.1);
    tl.to(d, { yPercent: DROP_FALL, duration: 0.42, ease: "power2.in" }, at);
    tl.to(d, { opacity: 0, duration: 0.12, ease: "none" }, at + 0.32);
  };
  // 第一下：原位的三颗先掉（第 1 帧里它们已经在半空）
  stroke(0, 0, 0.5);
  tl.to(t.drop1, { yPercent: DROP_FALL, duration: 0.42, ease: "power2.in" }, 0.45);
  tl.to(t.drop1, { opacity: 0, duration: 0.12 }, 0.77);
  tl.to(t.drop2, { yPercent: DROP_FALL, duration: 0.42, ease: "power2.in" }, 0.55);
  tl.to(t.drop2, { opacity: 0, duration: 0.12 }, 0.87);
  tl.to(t.drop3, { yPercent: DROP_FALL, duration: 0.42, ease: "power2.in" }, 0.62);
  tl.to(t.drop3, { opacity: 0, duration: 0.12 }, 0.94);
  tl.call(() => oneshot("stirfryIn", pan), [], 0.87); // 第一颗落进锅里
  fall(t.drop1, 1.0);
  // 第二下：剩下的菜推下去
  stroke(1.0, 0.5, 1);
  fall(t.drop2, 1.5);
  fall(t.drop3, 1.62);
  fall(t.drop1, 1.75);
  tl.to(t.pile, { opacity: 0, duration: 0.15, ease: "none" }, 1.9); // 最后几颗贴着案板边的也落下去
  tl.call(start, [], 2.25);
}
const STIRFRY_END = (set: (n: string, v: gsap.TweenVars) => void) => {
  set("pile", { xPercent: PILE_SLIDE.x, yPercent: PILE_SLIDE.y, opacity: 0 });
  ["drop1", "drop2", "drop3"].forEach((n) => set(n, { opacity: 0 }));
};
/** 持续的动作声：只有真的 start 过才在收住时发 stop（播放还没走到 start 就离场时不发空的 stop） */
function useActionSound(name: string) {
  const on = useRef(false);
  return {
    start: (pan: number) => { on.current = true; action(name, "start", pan); },
    stop: () => { if (on.current) { on.current = false; action(name, "stop"); } },
  };
}
export function StirfryPanel(props: { p: PanelSlot; pos: Place; dy: number; q: number; stage: Stage; animate: boolean }) {
  const snd = useActionSound("stirfry");
  return <LayersPanel {...props} k="p2d" pivot={[20.45, 0.42]} extras={["pile", "drop1", "drop2", "drop3"]} clips={{ pile: BOARD_CLIP }} build={(tl, t, pan) => stirfryScript(tl, t, pan, () => snd.start(pan))} end={STIRFRY_END} runStatic onHalt={snd.stop} />;
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
 * 对白分层样板：结尾回答格 p6e "没事，是我拉肚子了。"（只在 punchline 段出现）。
 * 不是打字机：原漫画、气泡轮廓和构图都不动，只把气泡里的旧字清掉（tools/replace_bubble_text.py --clean-only → p6e-clean.webp），
 * 对白换成网页文字，字体、粗细、墨色、字距、位置照原排字（Lantinghei SC Heavy，字高 29 px / 506 px 宽，墨色 rgb(48,19,9)）；
 * 浏览器拿不到 Lantinghei 时回退到苹方 / 冬青黑，用同色描边把笔画加粗到接近原字（不额外下载字体）。
 * 播放（格子进入并稳定后，按真实时间）：
 *   1. 短暂停顿；
 *   2. 气泡以外的画面轻微降饱和、降对比（底图加 CSS filter）；气泡本身用精确的泡形遮罩（tools/dialogue_layers.py → p6e-bubble.webp，
 *      原图里泡的纸面 + 描边 + 尾巴）叠一份不加滤镜的原图，所以泡保持奶油白、不透明、清楚，分界沿着泡原来不规则的纸边；
 *   3. 整句对白在约半秒内从浅墨渐浓，一直清楚可读，不逐字跳出。
 * 进入稳定前气泡里是空的（反转对白不提前露出）。离场落到终态（降饱和 + 文字全显），复位回到原样（文字隐藏）。
 * 减少动态效果 / ?perf=0：直接显示完整原图（p6e.webp，字已排在图里）。不加发光、投影、抖动。
 */
const P3 = "/assets/comic-v3/";
const P6E_TEXT = "没事，是我拉肚子了。";
const INK = "48, 19, 9";
const DIM = { saturate: 0.68, contrast: 0.9, brightness: 1.02 };
export function DialoguePanel({ p, pos, dy, q, stage, animate }: { p: PanelSlot; pos: Place; dy: number; q: number; stage: Stage; animate: boolean }) {
  const base = useRef<HTMLImageElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const look = useRef({ dim: 0, ink: 0, show: 0 });
  const apply = () => {
    const { dim, ink, show } = look.current;
    if (base.current) base.current.style.filter = `saturate(${1 - (1 - DIM.saturate) * dim}) contrast(${1 - (1 - DIM.contrast) * dim}) brightness(${1 + (DIM.brightness - 1) * dim})`;
    if (text.current) { text.current.style.opacity = String(show); text.current.style.color = `rgba(${INK}, ${0.22 + 0.78 * ink})`; }
  };
  const setLook = (v: { dim: number; ink: number; show: number }) => { look.current = { ...v }; apply(); };
  const reset = () => { tl.current?.kill(); tl.current = null; setLook({ dim: 0, ink: 0, show: 0 }); };
  const stop = () => { if (!tl.current) return; tl.current.kill(); tl.current = null; setLook({ dim: 1, ink: 1, show: 1 }); };
  const play = () => {
    reset();
    const st = look.current;
    const t = gsap.timeline({ delay: 0.35, onUpdate: apply, onComplete: () => { tl.current = null; } });
    t.to(st, { dim: 1, duration: 0.6, ease: "power1.inOut" }, 0); // 泡以外轻微降饱和、降对比
    t.to(st, { show: 1, duration: 0.12, ease: "none" }, 0.3); // 对白出现（浅墨）
    t.to(st, { ink: 1, duration: 0.5, ease: "power1.out" }, 0.3); // 从浅墨渐浓
    tl.current = t;
  };
  useStage(q, stage, animate, play, stop, reset);
  if (!animate) return <StaticImg src={p.src!} pos={pos} aspect={p.aspect} dy={dy} />;
  const img = "absolute inset-0 block h-full w-full select-none";
  return (
    <div className="absolute will-change-transform" style={{ ...boxStyle(pos, p.aspect, dy), containerType: "inline-size" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={base} src={`${P3}p6e-clean.webp`} alt="" draggable={false} className={img} />
      {/* 泡本身：同一张图、不加滤镜，只露出泡形遮罩里的部分 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${P3}p6e-clean.webp`} alt="" draggable={false} className={img}
        style={{ maskImage: `url(${P3}p6e-bubble.webp)`, WebkitMaskImage: `url(${P3}p6e-bubble.webp)`, maskSize: "100% 100%", WebkitMaskSize: "100% 100%", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat" }} />
      <div ref={text} aria-label={P6E_TEXT}
        className="pointer-events-none absolute select-none whitespace-nowrap"
        style={{
          left: "53.7%", top: "20.3%", transform: "translate(-50%, -50%)", opacity: 0, color: `rgba(${INK}, 0.22)`,
          fontFamily: '"Lantinghei SC", "PingFang SC", "Hiragino Sans GB", "Heiti SC", "Noto Sans SC", sans-serif',
          fontWeight: 800, fontSize: "6.05cqw", lineHeight: 1, letterSpacing: "-0.119cqw",
          // Lantinghei SC Heavy 不是网页里一定有的字体（系统按需下载的字体浏览器拿不到），回退到苹方 / 冬青黑时用同色描边加粗到接近原来的笔画粗细
          WebkitTextStroke: "0.05em currentColor", paintOrder: "stroke fill",
        }}>
        {P6E_TEXT}
      </div>
    </div>
  );
}

function StaticImg({ src, pos, aspect, dy }: { src: string; pos: Place; aspect: number; dy: number }) {
  return (
    <div className="absolute will-change-transform" style={boxStyle(pos, aspect, dy)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} className="block h-full w-full select-none object-contain" />
    </div>
  );
}
