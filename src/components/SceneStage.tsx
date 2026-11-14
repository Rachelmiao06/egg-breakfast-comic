"use client";
/**
 * 把 1536×1024 的场景画布按 cover 铺满容器，children 用场景像素绝对定位。
 * 缩放比例暴露为 CSS 变量 --scene-scale，需要按屏幕像素做的效果可以读它。
 *
 * focus（可选）是一个简单的"镜头"：weight 0 = 默认居中裁切，1 = 尽量把场景点 (x, y)
 * 放到视口的 (at.x, at.y) 比例位置，但永远不露出画布外的空白。
 * zoom（可选，≥1）在 cover 缩放之上再推近，围绕 focus 点；当前推近量写到 CSS 变量 --cam-zoom，
 * 分层组件可以据此做前中后景错速（前景推得多、背景推得少）。
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { FOCUS_Y, SCENE_H, SCENE_W } from "@/lib/scene";

export type StageFocus = { x: number; y: number; weight: number; at?: { x: number; y: number }; zoom?: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function SceneStage({ children, className = "", focus }: { children: ReactNode; className?: string; focus?: StageFocus }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const { width: w, height: h } = el.getBoundingClientRect();
      setBox({ w, h });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = box;
  const zoom = Math.max(1, focus?.zoom ?? 1);
  const s = (w && h ? Math.max(w / SCENE_W, h / SCENE_H) : 1) * zoom;
  const minX = w - SCENE_W * s;
  const minY = h - SCENE_H * s;
  let x = minX / 2;
  let y = clamp(h * 0.55 - FOCUS_Y * s, minY, 0);
  if (focus && (focus.weight > 0 || zoom > 1)) {
    const at = focus.at ?? { x: 0.4, y: 0.6 };
    const fx = clamp(w * at.x - focus.x * s, minX, 0);
    const fy = clamp(h * at.y - focus.y * s, minY, 0);
    const k = zoom > 1 ? 1 : clamp(focus.weight, 0, 1);
    x += (fx - x) * k;
    y += (fy - y) * k;
  }

  const outer = { "--scene-scale": s, "--cam-zoom": zoom } as CSSProperties;
  // 只在镜头真的在移动时才做过渡；未量到尺寸前不显示，避免开场先画一帧 1 倍缩放再缩回去
  const moving = !!focus && (focus.weight > 0 || zoom > 1);
  const measured = w > 0 && h > 0;
  return (
    <div ref={ref} className={`relative h-full w-full overflow-hidden ${className}`} style={outer}>
      <div
        className="absolute left-0 top-0 will-change-transform"
        style={{
          width: SCENE_W,
          height: SCENE_H,
          transform: `translate(${x}px, ${y}px) scale(${s})`,
          transformOrigin: "0 0",
          transition: moving ? "transform 0.35s ease-out" : undefined,
          visibility: measured ? "visible" : "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}
