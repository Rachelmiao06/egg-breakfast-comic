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
 * 减少动态效果或 ?perf=0：显示原静态格（对比录屏用）。
 */
import gsap from "gsap";
import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from "react";
import { KITCHEN_ONESHOT_EVENT } from "@/components/kitchen/useKitchenAudio";
import type { PanelSlot } from "./slots";

type Place = { x: number; y: number; w: number };
const START = 0.36, RESET = 0.3, LEAVE = 0.72;
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
 * 越过 START 时触发一次；q < RESET 时复位；q > LEAVE 时收住。
 * - 首次挂载时若格子已经稳定在 [START, LEAVE)（刷新或快速跳到中段）也播一次；
 * - 关掉表演（减少动态效果 / ?perf=0）时立即收住，避免分离的时间轴继续派发落刀声；
 * - 卸载时收住（离场、回滚出可见范围），重新进入是新实例，重新判断。
 */
function useCrossing(q: number, enabled: boolean, play: () => void, stop: () => void, reset: () => void) {
  const prev = useRef<number | null>(null);
  const played = useRef(false);
  const wasEnabled = useRef(enabled);
  useEffect(() => {
    const pq = prev.current;
    prev.current = q;
    if (!enabled) {
      if (wasEnabled.current) { wasEnabled.current = false; played.current = false; reset(); }
      return;
    }
    wasEnabled.current = true;
    if (q < RESET) { if (played.current) { played.current = false; reset(); } return; }
    if (q > LEAVE) { stop(); return; }
    const crossed = pq !== null && pq < START && q >= START;
    const landedInside = pq === null && q >= START;
    if ((crossed || landedInside) && !played.current) { played.current = true; play(); }
  });
  useEffect(() => () => { reset(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

export function ChopPanel({ p, pos, dy, q, animate }: { p: PanelSlot; pos: Place; dy: number; q: number; animate: boolean }) {
  const arm = useRef<HTMLImageElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  /** 硬复位：卸载、回滚到进入前、关掉表演 */
  const reset = () => { tl.current?.kill(); tl.current = null; if (arm.current) gsap.set(arm.current, { rotation: 0, yPercent: 0 }); flag(false); };
  /** 格子开始离开：停掉后续刀数，刀若在半空就 0.15 秒缓落回原位（不发声），不瞬移 */
  const stop = () => {
    if (!tl.current) return;
    tl.current.kill();
    tl.current = null;
    if (arm.current) gsap.to(arm.current, { rotation: 0, yPercent: 0, duration: 0.15, ease: "power1.out", overwrite: true });
    flag(false);
  };
  const play = () => {
    const el = arm.current;
    if (!el) return;
    reset();
    flag(true);
    const contact = () => window.dispatchEvent(new CustomEvent(KITCHEN_ONESHOT_EVENT, { detail: { sound: "chopHit" } }));
    const t = gsap.timeline({ delay: 0.3, onComplete: () => { tl.current = null; flag(false); } });
    for (let i = 0; i < 3; i++) {
      t.to(el, { rotation: -9, yPercent: -3, duration: 0.17, ease: "power2.out" }) // 抬刀（绕袖口）
        .to(el, { rotation: 0, yPercent: 0, duration: 0.075, ease: "power3.in" }, "+=0.05") // 停一下再落刀
        .call(contact) // 刀刃接触食材：落刀声
        .to(el, { rotation: 0.8, duration: 0.035, ease: "power1.out" }) // 接触的反作用
        .to(el, { rotation: 0, duration: 0.09, ease: "power1.inOut" });
      if (i < 2) t.to({}, { duration: 0.16 });
    }
    tl.current = t;
  };
  useCrossing(q, animate, play, stop, reset);
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

export function HearPanel({ p, pos, dy, q, animate }: { p: PanelSlot; pos: Place; dy: number; q: number; animate: boolean }) {
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
    timers.current = [
      window.setTimeout(() => show(1), 500), // 先停住，再抬眼
      window.setTimeout(() => { show(2); timers.current = []; flag(false); }, 1300), // 露出疑惑，停住
    ];
  };
  // 离开时：还没播完就直接落到结尾表情（疑惑），保证这一格的终态始终一致；
  // 否则停在"抬眼"半途，回滚回来也一直是半截表情。已播完时什么都不做。
  const stop = () => { if (timers.current.length) { clear(); show(2); } };
  const reset = () => { clear(); show(0); };
  useCrossing(q, animate, play, stop, reset);
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
export function StirfryPanel({ p, pos, dy, q, animate }: { p: PanelSlot; pos: Place; dy: number; q: number; animate: boolean }) {
  const corns = useRef<(HTMLImageElement | null)[]>([]);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const els = () => corns.current.filter(Boolean) as HTMLImageElement[];
  /** 硬复位：回到原格（玉米在空中原位置） */
  const reset = () => { tl.current?.kill(); tl.current = null; gsap.set(els(), { yPercent: 0, xPercent: 0, rotation: 0, opacity: 1 }); flag(false); };
  /** 离场：直接落到终态（玉米已入锅、看不见），不再动 */
  const stop = () => { if (!tl.current) return; tl.current.kill(); tl.current = null; gsap.set(els(), { opacity: 0 }); flag(false); };
  const play = () => {
    const list = els();
    if (!list.length) return;
    reset();
    flag(true);
    const t = gsap.timeline({ delay: 0.25, onComplete: () => { tl.current = null; flag(false); } });
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
  useCrossing(q, animate, play, stop, reset);
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
 * 调酱汁格 p3a：手臂 + 勺子单独成层，画三个约 3px 的小圈（底图在手臂边缘向内补了手臂外的颜色，只会露出约 3px 的一条）；
 * 酱面高光细线单独成层，在椭圆里沿酱面转动（先拉成圆、转、再压回椭圆），裁在酱面遮罩里，不露边。
 * 搅三圈后酱面带着余势再转一点停住；停 4.5 秒后若还在这一格，再搅两圈（只重复一次）。碗、扶碗的手、瓶子不动。
 */
const SAUCE = { cx: 290 / 511, cy: 300 / 448, k: 27 / 88, r: 3 / 511, ry: 1.2 / 448 };
export function SaucePanel({ p, pos, dy, q, animate }: { p: PanelSlot; pos: Place; dy: number; q: number; animate: boolean }) {
  const arm = useRef<HTMLImageElement>(null);
  const swirl = useRef<HTMLImageElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const st = useRef({ a: 0, rot: 0 });
  const apply = () => {
    const { a, rot } = st.current;
    if (arm.current) arm.current.style.transform = `translate(${(Math.cos(a) - 1) * SAUCE.r * 100}%, ${Math.sin(a) * SAUCE.ry * 100}%)`;
    if (swirl.current) swirl.current.style.transform = `scale(1, ${SAUCE.k}) rotate(${rot}deg) scale(1, ${1 / SAUCE.k})`;
  };
  const reset = () => { tl.current?.kill(); tl.current = null; st.current = { a: 0, rot: 0 }; apply(); flag(false); };
  /** 离场：停在当前酱面角度，手回到原位（0.15 秒） */
  const stop = () => {
    if (!tl.current) return;
    tl.current.kill(); tl.current = null;
    gsap.to(st.current, { a: Math.ceil(st.current.a / (2 * Math.PI)) * 2 * Math.PI, duration: 0.15, ease: "power1.out", onUpdate: apply });
    flag(false);
  };
  const play = () => {
    reset();
    flag(true);
    const o = st.current;
    const turn = 2 * Math.PI;
    const t = gsap.timeline({ delay: 0.3, onUpdate: apply, onComplete: () => { tl.current = null; flag(false); } });
    t.to(o, { a: 3 * turn, duration: 2.1, ease: "sine.inOut" }) // 搅三圈
      .to(o, { rot: 100, duration: 2.1, ease: "sine.inOut" }, "<") // 酱面跟着转
      .to(o, { rot: 118, duration: 0.7, ease: "power2.out" }) // 余势
      .call(() => flag(false))
      .to(o, { a: 5 * turn, duration: 1.4, ease: "sine.inOut", onStart: () => flag(true) }, "+=4.5") // 停一下，再搅两圈（只这一次）
      .to(o, { rot: 190, duration: 1.4, ease: "sine.inOut" }, "<")
      .to(o, { rot: 202, duration: 0.6, ease: "power2.out" });
    tl.current = t;
  };
  useCrossing(q, animate, play, stop, reset);
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

function StaticImg({ src, pos, aspect, dy }: { src: string; pos: Place; aspect: number; dy: number }) {
  return (
    <div className="absolute will-change-transform" style={boxStyle(pos, aspect, dy)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} className="block h-full w-full select-none object-contain" />
    </div>
  );
}
