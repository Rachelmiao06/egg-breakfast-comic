"use client";
/** 右缘一根细线显示整段故事的进度。只读 scrollY，用 GSAP ticker 做指数跟随，直接写 DOM，不触发重渲染。 */
import { useEffect, useRef } from "react";
import gsap from "gsap";

export default function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let shown = 0;
    const tick = (_t: number, dt: number) => {
      const el = bar.current;
      if (!el) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      shown += (target - shown) * Math.min(1, (dt / 1000) * 10);
      el.style.transform = `scaleY(${shown.toFixed(4)})`;
      el.parentElement!.style.opacity = target > 0.002 ? "1" : "0";
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);
  return (
    <div aria-hidden className="pointer-events-none fixed right-3 top-1/2 z-40 h-[28vh] w-[3px] -translate-y-1/2 rounded-full bg-ink/10 opacity-0 transition-opacity duration-500">
      <div ref={bar} className="h-full w-full origin-top rounded-full bg-ink/45" style={{ transform: "scaleY(0)" }} />
    </div>
  );
}
