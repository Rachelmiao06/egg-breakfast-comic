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

/** 越过 START 时触发一次；q < RESET 时复位；q > LEAVE 时收住。返回的 ref 记录是否已播过（本次进入） */
function useCrossing(q: number, enabled: boolean, play: () => void, stop: () => void, reset: () => void) {
  const prev = useRef<number | null>(null);
  const played = useRef(false);
  useEffect(() => {
    const pq = prev.current;
    prev.current = q;
    if (!enabled) return;
    if (q < RESET) { if (played.current) { played.current = false; reset(); } return; }
    if (q > LEAVE) { stop(); return; }
    if (pq !== null && pq < START && q >= START && !played.current) { played.current = true; play(); }
  });
  useEffect(() => () => { stop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

export function ChopPanel({ p, pos, dy, q, animate }: { p: PanelSlot; pos: Place; dy: number; q: number; animate: boolean }) {
  const arm = useRef<HTMLImageElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const stop = () => { tl.current?.kill(); tl.current = null; if (arm.current) gsap.set(arm.current, { rotation: 0, yPercent: 0 }); flag(false); };
  const play = () => {
    const el = arm.current;
    if (!el) return;
    stop();
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
  useCrossing(q, animate, play, stop, stop);
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
      window.setTimeout(() => { show(2); flag(false); }, 1300), // 露出疑惑，停住
    ];
  };
  const stop = () => clear(); // 离开时保持当前表情
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

function StaticImg({ src, pos, aspect, dy }: { src: string; pos: Place; aspect: number; dy: number }) {
  return (
    <div className="absolute will-change-transform" style={boxStyle(pos, aspect, dy)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} className="block h-full w-full select-none object-contain" />
    </div>
  );
}
