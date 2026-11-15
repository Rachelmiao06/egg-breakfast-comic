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
import { COMIC_PANEL_EVENT, KITCHEN_ACTION_EVENT, KITCHEN_ONESHOT_EVENT } from "@/components/kitchen/useKitchenAudio";
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
/**
 * 声音事件（kitchen-audio 2026-11-14）：声音跟格内动作走，由混音器 useKitchenAudio 接收。
 * shot = 接触的那一帧（kitchen:oneshot）；action = 一段动作的开始 / 停止（kitchen:action）；panel = 格子进入 / 离开阅读位置（comic:panel）。
 */
const shot = (sound: string) => window.dispatchEvent(new CustomEvent(KITCHEN_ONESHOT_EVENT, { detail: { sound } }));
const action = (name: string, phase: "start" | "stop") => window.dispatchEvent(new CustomEvent(KITCHEN_ACTION_EVENT, { detail: { name, phase } }));
const panelSignal = (key: string, phase: "start" | "stop" | "reset") => window.dispatchEvent(new CustomEvent(COMIC_PANEL_EVENT, { detail: { key, phase } }));

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

/** 切菜动作参数（秒 / 百分比）。抬刀约为格高的 11%（正常桌面大小约 30 屏幕像素） */
const CHOP = { delay: 0.35, cuts: 3, raise: 0.22, pause: 0.06, drop: 0.09, recoil: 0.05, settle: 0.1, gap: 0.12, lift: { rot: -6, x: -4, y: -11 } };
export function ChopPanel({ p, pos, dy, q, stage, animate }: { p: PanelSlot; pos: Place; dy: number; q: number; stage: Stage; animate: boolean }) {
  const arm = useRef<HTMLImageElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  /** 硬复位：卸载、回滚到进入前、关掉表演 */
  const reset = () => { tl.current?.kill(); tl.current = null; if (arm.current) gsap.set(arm.current, { rotation: 0, xPercent: 0, yPercent: 0 }); flag(false); };
  /** 格子开始离开：停掉后续刀数，刀若在半空就 0.15 秒缓落回原位（不发声），不瞬移 */
  const stop = () => {
    if (!tl.current) return;
    tl.current.kill();
    tl.current = null;
    if (arm.current) gsap.to(arm.current, { rotation: 0, xPercent: 0, yPercent: 0, duration: 0.15, ease: "power1.out", overwrite: true });
    flag(false);
  };
  const play = () => {
    const el = arm.current;
    reset();
    const contact = () => window.dispatchEvent(new CustomEvent(KITCHEN_ONESHOT_EVENT, { detail: { sound: "chopHit" } }));
    const C = CHOP;
    const firstContact = C.delay + C.raise + C.pause + C.drop;
    const every = C.raise + C.pause + C.drop + C.recoil + C.settle + C.gap;
    if (!animate || !el) {
      // 静态格（减少动态效果 / ?perf=0）：画面不动，刀声按和动画完全相同的时刻响三下
      const t = gsap.timeline({ delay: firstContact, onComplete: () => { tl.current = null; } });
      t.call(contact).call(contact, [], `+=${every}`).call(contact, [], `+=${every}`);
      tl.current = t;
      return;
    }
    flag(true);
    const t = gsap.timeline({ delay: C.delay, onComplete: () => { tl.current = null; flag(false); } });
    for (let i = 0; i < C.cuts; i++) {
      // 抬刀：以上提为主（刀尖从扶胡萝卜的指节前面抬起），只带一点倾角，正常大小下一眼能看出来
      t.to(el, { rotation: C.lift.rot, xPercent: C.lift.x, yPercent: C.lift.y, duration: C.raise, ease: "power2.out" })
        .to(el, { rotation: 0, xPercent: 0, yPercent: 0, duration: C.drop, ease: "power3.in" }, `+=${C.pause}`) // 停一下再落刀
        .call(contact) // 刀刃落到砧板、切到胡萝卜的那一帧：落刀声
        .to(el, { yPercent: 0.8, rotation: 0.6, duration: C.recoil, ease: "power1.out" }) // 接触的反作用
        .to(el, { yPercent: 0, rotation: 0, duration: C.settle, ease: "power1.inOut" });
      if (i < C.cuts - 1) t.to({}, { duration: C.gap });
    }
    tl.current = t;
  };
  useStage(q, stage, true, play, stop, reset); // 静态格也走同一套越过 / 复位逻辑（只放刀声）
  if (!animate) return <StaticImg src={p.src!} pos={pos} aspect={p.aspect} dy={dy} />;
  return (
    <div className="absolute will-change-transform" style={boxStyle(pos, p.aspect, dy)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${P}p2b-base.webp`} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none" />
      {/* 手臂只在框线内侧活动 */}
      <div className="absolute inset-0" style={{ clipPath: "inset(3.9% 2.6% 3.9% 2.6%)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={arm} src={`${P}p2b-arm.webp`} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none will-change-transform" style={{ transformOrigin: "2.8% 52%" }} />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${P}p2b-bubble.webp`} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none" />
    </div>
  );
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
/** 每粒玉米的"菜堆顶线"（占格高的百分比）：落到这条线以下就被裁掉，看起来是落进菜堆里，而不是半透明地消失 */
const CORNS = [
  { src: "p2d-corn1", pile: 75.6, fall: 17.5 }, // 原位置顶边 59% / 底边 73.4%
  { src: "p2d-corn3", pile: 79.6, fall: 15 }, // 原位置顶边 65.7% / 底边 79.2%
] as const;
/** 下锅格的声音时刻（秒，从时间轴开始算）：第一粒玉米越过菜堆顶线 = 落锅声；第二批落完 = 开始翻炒（木铲推菜） */
const STIRFRY_SND = { delay: 0.25, land: 0.46, stir: 1.25 + 0.12 + 0.46 };
export function StirfryPanel({ p, pos, dy, q, stage, animate }: { p: PanelSlot; pos: Place; dy: number; q: number; stage: Stage; animate: boolean }) {
  const corns = useRef<(HTMLImageElement | null)[]>([]);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const stirring = useRef(false);
  const els = () => corns.current.filter(Boolean) as HTMLImageElement[];
  const stirStart = () => { stirring.current = true; action("stirfry", "start"); };
  const stirStop = () => { if (stirring.current) { stirring.current = false; action("stirfry", "stop"); } };
  /** 硬复位：回到原格（玉米在空中原位置） */
  const reset = () => { tl.current?.kill(); tl.current = null; stirStop(); gsap.set(els(), { yPercent: 0, xPercent: 0, rotation: 0, opacity: 1 }); flag(false); };
  /** 离场：直接落到终态（玉米已入锅、看不见），不再动；翻炒声淡出 */
  const stop = () => { stirStop(); if (!tl.current) return; tl.current.kill(); tl.current = null; gsap.set(els(), { opacity: 0 }); flag(false); };
  const play = () => {
    const list = els();
    if (!animate || !list.length) {
      // 静态格（减少动态效果 / ?perf=0）：画面不动，落锅声和翻炒声按动画相同的时刻响
      tl.current?.kill();
      const s = gsap.timeline({ delay: STIRFRY_SND.delay, onComplete: () => { tl.current = null; } });
      s.call(() => shot("stirfryIn"), [], STIRFRY_SND.land).call(stirStart, [], STIRFRY_SND.stir);
      tl.current = s;
      return;
    }
    reset();
    flag(true);
    const t = gsap.timeline({ delay: STIRFRY_SND.delay, onComplete: () => { tl.current = null; flag(false); stirStart(); } });
    t.call(() => shot("stirfryIn"), [], STIRFRY_SND.land); // 第一粒玉米落进菜堆的那一刻：落锅声 + 短暂滋啦
    const drop = (at: number, from: number) => {
      list.forEach((el, i) => {
        const t0 = at + i * 0.12;
        t.set(el, { yPercent: from, xPercent: 0, rotation: 0, opacity: from < 0 ? 0 : 1 }, t0);
        if (from < 0) t.to(el, { opacity: 1, duration: 0.08 }, t0);
        t.to(el, { yPercent: CORNS[i].fall, xPercent: 0.3, rotation: i ? -22 : 24, duration: 0.46, ease: "power2.in" }, t0); // 落进锅，越过菜堆顶线后被裁掉
        t.set(el, { opacity: 0 }, t0 + 0.46); // 已经完全在菜堆线以下，收起
      });
    };
    drop(0, 0); // 第一批：从原位置落下
    drop(1.25, -6); // 第二批：从铲边稍高处出现
    tl.current = t;
  };
  useStage(q, stage, true, play, stop, reset); // 静态格也走同一套规则（只放声音）
  if (!animate) return <StaticImg src={p.src!} pos={pos} aspect={p.aspect} dy={dy} />;
  return (
    <div className="absolute will-change-transform" style={boxStyle(pos, p.aspect, dy)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${P}p2d-base.webp`} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none" />
      {/* 每粒玉米裁在框线内侧、菜堆顶线以上 */}
      {CORNS.map((c, i) => (
        <div key={c.src} className="absolute inset-0" style={{ clipPath: `inset(3% 1.2% ${100 - c.pile}% 1.2%)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={(el) => { corns.current[i] = el; }} src={`${P}${c.src}.webp`} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none will-change-transform" />
        </div>
      ))}
    </div>
  );
}

/**
 * 调酱汁格 p3a：手臂 + 勺子单独成层；
 * 酱面高光细线单独成层，在椭圆里沿酱面转动（先拉成圆、转、再压回椭圆），裁在酱面遮罩里，不露边。
 * 手和勺子一起画两个约 10px 的圈（底图里手臂背后用周围非描边颜色平滑补过），酱面带着余势再转一点后停稳；不重复。碗、扶碗的手、瓶子不动。
 */
const SAUCE = { cx: 290 / 511, cy: 300 / 448, k: 27 / 88, r: 10 / 511, ry: 4 / 448 };
export function SaucePanel({ p, pos, dy, q, stage, animate }: { p: PanelSlot; pos: Place; dy: number; q: number; stage: Stage; animate: boolean }) {
  const arm = useRef<HTMLImageElement>(null);
  const swirl = useRef<HTMLImageElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const st = useRef({ a: 0, rot: 0 });
  const apply = () => {
    const { a, rot } = st.current;
    if (arm.current) arm.current.style.transform = `translate(${(Math.cos(a) - 1) * SAUCE.r * 100}%, ${Math.sin(a) * SAUCE.ry * 100}%)`;
    if (swirl.current) swirl.current.style.transform = `scale(1, ${SAUCE.k}) rotate(${rot}deg) scale(1, ${1 / SAUCE.k})`;
  };
  const stirring = useRef(false);
  const stirStart = () => { stirring.current = true; action("sauceStir", "start"); };
  const stirStop = () => { if (stirring.current) { stirring.current = false; action("sauceStir", "stop"); } };
  const reset = () => { tl.current?.kill(); tl.current = null; stirStop(); st.current = { a: 0, rot: 0 }; apply(); flag(false); };
  /** 离场：停在当前酱面角度，手回到原位（0.15 秒）；搅拌声淡出 */
  const stop = () => {
    stirStop();
    if (!tl.current) return;
    tl.current.kill(); tl.current = null;
    gsap.to(st.current, { a: Math.ceil(st.current.a / (2 * Math.PI)) * 2 * Math.PI, duration: 0.15, ease: "power1.out", onUpdate: apply });
    flag(false);
  };
  const play = () => {
    if (!animate) {
      // 静态格：画面不动，搅拌声按动画相同的时刻开始、两圈结束时收住
      tl.current?.kill();
      tl.current = gsap.timeline({ delay: 0.3, onComplete: () => { tl.current = null; } }).call(stirStart, [], 0).call(stirStop, [], 1.9);
      return;
    }
    reset();
    flag(true);
    const o = st.current;
    const turn = 2 * Math.PI;
    const t = gsap.timeline({ delay: 0.3, onUpdate: apply, onComplete: () => { tl.current = null; flag(false); } });
    t.call(stirStart, [], 0).call(stirStop, [], 1.9); // 声音 = 两圈搅拌：开始转就响，两圈转完收住（余势时安静）
    t.to(o, { a: 2 * turn, duration: 1.9, ease: "sine.inOut" }) // 握勺的手和勺子一起在碗里搅两圈（勺头一直在碗里）
      .to(o, { rot: 140, duration: 1.9, ease: "sine.inOut" }, "<") // 酱面跟着转
      .to(o, { rot: 156, duration: 0.7, ease: "power2.out" }); // 余势，然后停稳
    tl.current = t;
  };
  useStage(q, stage, true, play, stop, reset); // 静态格也走同一套规则（只放声音）
  if (!animate) return <StaticImg src={p.src!} pos={pos} aspect={p.aspect} dy={dy} />;
  const origin = `${SAUCE.cx * 100}% ${SAUCE.cy * 100}%`;
  return (
    <div className="absolute will-change-transform" style={boxStyle(pos, p.aspect, dy)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${P}p3a-base.webp`} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none" />
      <div className="absolute inset-0" style={{ maskImage: `url(${P}p3a-saucemask.webp)`, WebkitMaskImage: `url(${P}p3a-saucemask.webp)`, maskSize: "100% 100%", WebkitMaskSize: "100% 100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={swirl} src={`${P}p3a-swirl.webp`} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none will-change-transform" style={{ transformOrigin: origin }} />
      </div>
      {/* 手臂只在框线内侧活动 */}
      <div className="absolute inset-0" style={{ clipPath: "inset(2.2% 2% 2.2% 2%)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={arm} src={`${P}p3a-arm.webp`} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none will-change-transform" />
      </div>
    </div>
  );
}

/**
 * 静态格的声音信号：和格内表演同一套 useStage 规则，进入阅读位置派发 comic:panel start，离开派发 stop（只发一次），复位派发 reset。
 * 混音器只给 audio-map cues.panel 里登记的格子出声（淋汁 p4c、放碗 p4b），其余格子收到也不响。
 */
export function PanelCue({ panelKey, q, stage }: { panelKey: string; q: number; stage: Stage }) {
  const on = useRef(false);
  const play = () => { on.current = true; panelSignal(panelKey, "start"); };
  const stop = () => { if (on.current) { on.current = false; panelSignal(panelKey, "stop"); } };
  const reset = () => { on.current = false; panelSignal(panelKey, "reset"); };
  useStage(q, stage, true, play, stop, reset);
  return null;
}

function StaticImg({ src, pos, aspect, dy }: { src: string; pos: Place; aspect: number; dy: number }) {
  return (
    <div className="absolute will-change-transform" style={boxStyle(pos, aspect, dy)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} className="block h-full w-full select-none object-contain" />
    </div>
  );
}
