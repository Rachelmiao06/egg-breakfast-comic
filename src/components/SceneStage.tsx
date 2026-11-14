"use client";
/**
 * 把 1536×1024 的场景画布按 cover 铺满容器，children 用场景像素绝对定位。
 * 缩放比例暴露为 CSS 变量 --scene-scale，需要按屏幕像素做的效果可以读它。
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { FOCUS_Y, SCENE_H, SCENE_W } from "@/lib/scene";

export default function SceneStage({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ s: 1, x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const { width: w, height: h } = el.getBoundingClientRect();
      const s = Math.max(w / SCENE_W, h / SCENE_H);
      const x = (w - SCENE_W * s) / 2;
      const y = Math.min(0, Math.max(h - SCENE_H * s, h * 0.55 - FOCUS_Y * s));
      setT({ s, x, y });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const outer = { "--scene-scale": t.s } as CSSProperties;
  return (
    <div ref={ref} className={`relative h-full w-full overflow-hidden ${className}`} style={outer}>
      <div
        className="absolute left-0 top-0 will-change-transform"
        style={{ width: SCENE_W, height: SCENE_H, transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})`, transformOrigin: "0 0" }}
      >
        {children}
      </div>
    </div>
  );
}
