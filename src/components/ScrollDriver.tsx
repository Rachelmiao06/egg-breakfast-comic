"use client";
/**
 * 全站唯一的滚动驱动（集成会话维护）。
 * 渲染一段总高度 = 节拍表总长 + 一屏 的占位，按滚动位置算出时间轴写进 useScene().timeline。
 * 前景、背景、角色、声音都从这份时间轴推导；其他组件不要再注册自己的滚动监听或 ScrollTrigger。
 * 同时计算平滑后的滚动速度（vh/s）写进 src/lib/scroll-velocity.ts，停止滚动后衰减到 0。
 */
import { useEffect, useRef } from "react";
import { locate, totalVh } from "@/lib/beats";
import { setScrollVelocity } from "@/lib/scroll-velocity";
import { useScene } from "@/lib/scene-context";

export default function ScrollDriver() {
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
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      if (decayRaf) cancelAnimationFrame(decayRaf);
      setScrollVelocity(0);
    };
  }, [beats, setTimeline]);

  // flexShrink: 0：body 是纵向 flex 容器，某些环境下占位会被压缩成一屏导致页面滚不动（kitchen-layers 报告）
  return <div aria-hidden style={{ height: `${totalVh(beats) + 100}vh`, flexShrink: 0 }} />;
}
