"use client";
/** 在一个场景像素区域里跑 Canvas 动画；标签页隐藏时自动暂停（rAF 本身会停）。 */
import { useEffect, useRef } from "react";

export type Draw = (ctx: CanvasRenderingContext2D, dt: number, t: number) => void;

export function useCanvasLoop(width: number, height: number, draw: Draw, enabled = true, resolution = 2) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });
  useEffect(() => {
    const c = ref.current;
    if (!c || !enabled) return;
    c.width = Math.round(width * resolution);
    c.height = Math.round(height * resolution);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(resolution, resolution);
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, width, height);
      drawRef.current(ctx, dt, now / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [width, height, enabled, resolution]);
  return ref;
}
