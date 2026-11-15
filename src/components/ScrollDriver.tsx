"use client";
/**
 * 全站唯一的滚动驱动（集成会话维护）。
 * 渲染一段总高度 = 节拍表总长 + 一屏 的占位，按滚动位置算出时间轴写进 useScene().timeline。
 * 前景、背景、角色、声音都从这份时间轴推导；其他组件不要再注册自己的滚动监听或 ScrollTrigger。
 * 同时计算平滑后的滚动速度（vh/s）写进 src/lib/scroll-velocity.ts，停止滚动后衰减到 0。
 */
import { useEffect, useRef } from "react";
import Lenis from "lenis";
import Snap from "lenis/snap";
import gsap from "gsap";
import { locate, phaseEdges, totalVh } from "@/lib/beats";
import { setScrollVelocity } from "@/lib/scroll-velocity";
import { useScene } from "@/lib/scene-context";
import { REPLAY_EVENT } from "@/lib/replay";
import { scrollHeld } from "@/lib/scroll-gate";

/**
 * smooth = true：用 Lenis 作为全站唯一的平滑层（触控板、鼠标滚轮都经过它），
 * 时间轴在 Lenis 的每帧 scroll 回调里更新；此时不再注册 window scroll 监听，保证只有一套。
 * smooth = false：原生滚动（旧版对比用）。
 */
/** 一次甩出去的距离上限（vh）；读带格内动画的格子时用更小的上限 */
const THROW_VH = 100;
const THROW_READING_VH = 45;

/** 读格门的位置：当前段"停留"结束处（px）。格内动画没播完（scrollHeld）时，故事不能越过它 */
function gatePx(beats: { lengthVh: number; phases: { enter: number; action: number; hold: number } }[], scrollPx: number) {
  const vhPx = window.innerHeight / 100;
  let acc = 0;
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i], len = b.lengthVh;
    if (scrollPx / vhPx < acc + len || i === beats.length - 1) return (acc + len * (b.phases.enter + b.phases.action + b.phases.hold)) * vhPx;
    acc += len;
  }
  return Infinity;
}

export default function ScrollDriver({ smooth = true }: { smooth?: boolean }) {
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
        // 单次"甩"出去的距离上限（2026-11-15 用户：随便划两下，格子进得快出得也快，格内动画还没看到就过去了）：
        // 已经排队等着滚的距离超过上限时，同方向的新滚轮增量不再累加（吞掉，同时挡住浏览器原生滚动）。
        // 平时最多一次甩出 THROW_VH；正在读带格内动画的格子（节拍表有 readS，进入/停留阶段）时更紧，只能一小段一小段地走。
        // 这不是吸附也不是劫持：用户随时可以继续滚，只是一次甩不过一整段故事。
        virtualScroll: ({ deltaY, event }) => {
          const l = lenis;
          if (!l || deltaY === 0) return true;
          // 读格门：格内动画还在播，且已经走到这一段"停留"的末尾，不再接受向前的滚动
          if (deltaY > 0 && scrollHeld() && l.animatedScroll >= gatePx(beats, l.animatedScroll) - 3) {
            if (event.cancelable) event.preventDefault();
            return false;
          }
          const vhPx = window.innerHeight / 100;
          const ahead = l.targetScroll - l.animatedScroll;
          if (Math.sign(ahead) !== Math.sign(deltaY)) return true; // 反向永远放行（马上能掉头）
          const cur = locate(l.animatedScroll / vhPx, beats);
          const reading = (cur.beat as { readS?: number }).readS && (cur.phase === "enter" || cur.phase === "hold");
          if (Math.abs(ahead) < (reading ? THROW_READING_VH : THROW_VH) * vhPx) return true;
          if (event.cancelable) event.preventDefault();
          return false;
        },
      });
      lenis.on("scroll", () => {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        update();
      });
      // 与 GSAP 共用同一个 ticker：Lenis、速度、画格动效在同一帧里更新，不会各走各的 rAF
      // 阅读停留处轻微吸附：只有带画格的段，在"停留"阶段中点附近 proximity 吸附（离得近才吸，不抢走用户的滚动）
      const snap = new Snap(lenis, { type: "proximity", distanceThreshold: "9%", debounce: 220, duration: 0.9 });
      const addSnaps = () => {
        removers.forEach((r) => r());
        removers = [];
        let startVh = 0;
        for (const b of beats) {
          if (["chop", "stirfry", "sauce", "notice"].includes(b.id)) {
            const e = phaseEdges(b);
            const mid = (e[2] + e[3]) / 2;
            removers.push(snap.add(((startVh + b.lengthVh * mid) / 100) * window.innerHeight));
          }
          startVh += b.lengthVh;
        }
      };
      let removers: (() => boolean)[] = [];
      addSnaps();
      window.addEventListener("resize", addSnaps);
      snapCleanup = () => {
        window.removeEventListener("resize", addSnaps);
        snap.destroy();
      };
      let pulling = false;
      tick = (time) => {
        // 读格门：已经被甩过了门（惯性 / 触屏原生滚动），温柔地拉回门口，不硬跳
        if (lenis && scrollHeld()) {
          const gate = gatePx(beats, lenis.animatedScroll);
          if (!pulling && lenis.animatedScroll > gate + 6) {
            pulling = true;
            lenis.scrollTo(gate, { duration: 0.6, easing: (t) => 1 - Math.pow(1 - t, 3), force: true, onComplete: () => { pulling = false; } });
          }
        }
        lenis?.raf(time * 1000);
      };
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
  }, [beats, setTimeline, smooth]);

  // flexShrink: 0：body 是纵向 flex 容器，某些环境下占位会被压缩成一屏导致页面滚不动（kitchen-layers 报告）
  return <div aria-hidden style={{ height: `${totalVh(beats) + 100}vh`, flexShrink: 0 }} />;
}
