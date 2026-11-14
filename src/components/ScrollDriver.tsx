"use client";
/**
 * 全站唯一的滚动驱动（集成会话维护）。
 * 渲染一段总高度 = 节拍表总长 + 一屏 的占位，按滚动位置算出时间轴写进 useScene().timeline。
 * 前景、背景、角色、声音都从这份时间轴推导；其他组件不要再注册自己的滚动监听或 ScrollTrigger。
 */
import { useEffect, useRef } from "react";
import { locate, totalVh } from "@/lib/beats";
import { useScene } from "@/lib/scene-context";

export default function ScrollDriver() {
  const { beats, setTimeline } = useScene();
  const last = useRef({ index: -1, p: -1 });

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = (window.scrollY / window.innerHeight) * 100;
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
    };
  }, [beats, setTimeline]);

  return <div aria-hidden style={{ height: `${totalVh(beats) + 100}vh` }} />;
}
