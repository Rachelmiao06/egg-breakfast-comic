"use client";
/**
 * 全站唯一的滚动驱动（集成会话维护）。
 * 渲染一段总高度 = 节拍表总长 + 一屏 的占位，按滚动位置算出时间轴写进 useScene().timeline。
 * 前景、背景、角色、声音都从这份时间轴推导；其他组件不要再注册自己的滚动监听或 ScrollTrigger。
 * 同时计算平滑后的滚动速度（vh/s）写进 src/lib/scroll-velocity.ts，停止滚动后衰减到 0。
 */
import { useEffect, useRef } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { locate, phaseEdges, totalVh } from "@/lib/beats";
import { setScrollVelocity } from "@/lib/scroll-velocity";
import { useScene } from "@/lib/scene-context";
import { REPLAY_EVENT } from "@/lib/replay";

/**
 * smooth = true：用 Lenis 作为全站唯一的平滑层（触控板、鼠标滚轮都经过它），
 * 时间轴在 Lenis 的每帧 scroll 回调里更新；此时不再注册 window scroll 监听，保证只有一套。
 * smooth = false：原生滚动（旧版对比用）。
 */
/** 旧首页的阅读段（节拍表 id）。预览页传入自己的（有画格的）段 */
const DEFAULT_READING = ["chop", "stirfry", "sauce", "notice"];
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function ScrollDriver({ smooth = true, readingBeats = DEFAULT_READING }: { smooth?: boolean; readingBeats?: string[] }) {
  const { beats, setTimeline } = useScene();
  const last = useRef({ index: -1, p: -1 });

  useEffect(() => {
    let raf = 0;
    // 速度：对瞬时速度做指数平滑；没有新的滚动事件时继续衰减到 0
    let lastVh = (window.scrollY / window.innerHeight) * 100;
    let lastT = performance.now();
    let v = 0;
    let decayRaf = 0;
    const decay = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastT) / 1000);
      if (now - lastT > 60) {
        v *= Math.exp(-dt * 8);
        if (Math.abs(v) < 0.5) v = 0;
        setScrollVelocity(v);
      }
      decayRaf = v !== 0 ? requestAnimationFrame(decay) : 0;
    };
    const update = () => {
      raf = 0;
      const vh = (window.scrollY / window.innerHeight) * 100;
      const now = performance.now();
      const dt = Math.max(0.001, (now - lastT) / 1000);
      const inst = (vh - lastVh) / dt;
      v += (inst - v) * Math.min(1, dt * 12);
      lastVh = vh;
      lastT = now;
      setScrollVelocity(v);
      if (!decayRaf) decayRaf = requestAnimationFrame(decay);
      const t = locate(vh, beats);
      // 只在有意义的变化时更新（约 1/2000 段），避免无谓的重渲染
      if (t.index !== last.current.index || Math.abs(t.p - last.current.p) > 0.0005) {
        last.current = { index: t.index, p: t.p };
        setTimeline(t);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    let lenis: Lenis | null = null;
    let tick: ((time: number) => void) | null = null;
    let snapCleanup: (() => void) | null = null;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (smooth && !reduce) {
      // 手感：滚轮/触控板经过一层长尾的指数缓动（duration 1.25s，expo-out），停手后慢慢"滑停"，不是线性跟随
      lenis = new Lenis({
        duration: 1.25,
        easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
        wheelMultiplier: 0.8,
        touchMultiplier: 1.4,
        smoothWheel: true,
        syncTouch: false, // 触屏保留系统原生惯性
        anchors: true,
      });
      lenis.on("scroll", () => {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        update();
      });
      // 与 GSAP 共用同一个 ticker：Lenis、速度、画格动效在同一帧里更新，不会各走各的 rAF
      // 阅读点磁吸（滚动、动画、声音连在一起）：格内动画和声音在"格子到位"时按真实时间播，所以读者必须能稳稳停在格子上。
      // 1) 滑停后：落在有画格的段里，就用 Lenis 缓动滑到该段的阅读点（停留阶段中点）；已在停留阶段（格子完整可见）就不动；
      //    顺着滑动方向走：往下滑出停留阶段 → 下一格，往上 → 回到这一格；两段之间不相邻（中间是蛋飞行等自由段）就不抢。
      // 2) 快滑 / 猛滑：这次手势的目标越过了下一格的停留区，就先停在它的阅读点（lock 住惯性约 1 秒），让这一格播完整；之后的手势再往前。
      type Stop = { start: number; holdA: number; read: number; holdB: number; end: number };
      let stops: Stop[] = [];
      const buildStops = () => {
        const vh = window.innerHeight / 100;
        stops = [];
        let acc = 0;
        for (const b of beats) {
          if (readingBeats.includes(b.id)) {
            const e = phaseEdges(b);
            const at = (f: number) => (acc + b.lengthVh * f) * vh;
            stops.push({ start: at(0), holdA: at(e[2]), read: at((e[2] + e[3]) / 2), holdB: at(e[3]), end: at(1) });
          }
          acc += b.lengthVh;
        }
      };
      buildStops();
      window.addEventListener("resize", buildStops);
      let dir = 1;
      let lastY = window.scrollY;
      let touching = false;
      let settling = false;
      let settleCall: gsap.core.Tween | null = null;
      const goTo = (y: number) => {
        if (!lenis) return;
        const dist = Math.abs(y - lenis.scroll) / window.innerHeight;
        settling = true;
        lenis.scrollTo(y, { duration: Math.min(1.3, 0.55 + dist * 0.5), easing: easeInOutCubic, lock: true, onComplete: () => { settling = false; } });
      };
      const adjacent = (a: Stop, b: Stop) => Math.abs(a.end - b.start) < 2;
      const pick = (y: number): number | null => {
        const i = stops.findIndex((st) => y >= st.start - 1 && y <= st.end + 1);
        if (i < 0) return null;
        const st = stops[i];
        if (y >= st.holdA - 1 && y <= st.holdB + 1) return null; // 停留阶段：格子完整可见，不动
        if (y < st.holdA) {
          if (dir >= 0) return st.read;
          const prev = stops[i - 1];
          return prev && adjacent(prev, st) ? prev.read : null;
        }
        if (dir <= 0) return st.read;
        const next = stops[i + 1];
        return next && adjacent(st, next) ? next.read : null;
      };
      const settle = () => {
        if (!lenis || settling || touching) return;
        if (lenis.isScrolling) { settleCall = gsap.delayedCall(0.12, settle); return; }
        const to = pick(lenis.scroll);
        if (to !== null && Math.abs(to - lenis.scroll) > 2) goTo(to);
      };
      const limit = () => {
        if (!lenis || settling) return;
        const y = lenis.scroll, t = lenis.targetScroll, d = Math.sign(t - y);
        if (!d) return;
        // 下一个还没到的阅读点（已经在它的停留区里就不拦）；这次手势的目标越过它的停留区，就先停在它的阅读点
        const next = stops
          .filter((st) => (st.read - y) * d > window.innerHeight * 0.05 && !(y >= st.holdA && y <= st.holdB))
          .sort((p, q) => Math.abs(p.read - y) - Math.abs(q.read - y))[0];
        if (next && (t - (d > 0 ? next.holdB : next.holdA)) * d > 0) goTo(next.read);
      };
      lenis.on("scroll", () => {
        const y = window.scrollY;
        if (Math.abs(y - lastY) > 0.5) { dir = Math.sign(y - lastY); lastY = y; }
        limit();
        settleCall?.kill();
        settleCall = gsap.delayedCall(0.16, settle);
      });
      const onTouch = (on: boolean) => () => { touching = on; if (!on) { settleCall?.kill(); settleCall = gsap.delayedCall(0.2, settle); } };
      const ts = onTouch(true), te = onTouch(false);
      window.addEventListener("touchstart", ts, { passive: true });
      window.addEventListener("touchend", te, { passive: true });
      window.addEventListener("touchcancel", te, { passive: true });
      snapCleanup = () => {
        settleCall?.kill();
        window.removeEventListener("resize", buildStops);
        window.removeEventListener("touchstart", ts);
        window.removeEventListener("touchend", te);
        window.removeEventListener("touchcancel", te);
      };
      tick = (time) => lenis?.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    } else {
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    window.addEventListener("resize", onScroll);
    // “再看一次”：立即回到顶部（不平滑滚过整段故事，避免倒着把每一段都走一遍），时间轴同步到开场
    const onReplay = () => {
      if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
      else window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      v = 0;
      lastVh = 0;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      update();
    };
    window.addEventListener(REPLAY_EVENT, onReplay);
    return () => {
      window.removeEventListener(REPLAY_EVENT, onReplay);
      if (lenis) {
        snapCleanup?.();
        if (tick) gsap.ticker.remove(tick);
        lenis.destroy();
      } else {
        window.removeEventListener("scroll", onScroll);
      }
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      if (decayRaf) cancelAnimationFrame(decayRaf);
      setScrollVelocity(0);
    };
  }, [beats, setTimeline, smooth, readingBeats]);

  // flexShrink: 0：body 是纵向 flex 容器，某些环境下占位会被压缩成一屏导致页面滚不动（kitchen-layers 报告）
  return <div aria-hidden style={{ height: `${totalVh(beats) + 100}vh`, flexShrink: 0 }} />;
}
