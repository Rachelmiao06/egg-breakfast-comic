"use client";
/**
 * 速度余韵：在 gsap.ticker 里读 getScrollVelocity()（唯一的 ScrollDriver 写入），
 * 换成最多 ±1° 的轻微倾斜，写到 CSS 变量 --sm-tilt（单位：度，无单位数字）。
 * 只有画格 / 说明卡 / 结尾卡读这个变量；妈妈、蛋、厨房不读。停止滚动后约 0.6–0.9 秒平稳回正。
 * 不放进 React state，避免每帧重渲染。
 */
import gsap from "gsap";
import { useEffect } from "react";
import { getScrollVelocity } from "@/lib/scroll-velocity";
import { useScene } from "@/lib/scene-context";

/** 1° 对应的滚动速度（vh/s）。平常快速滚动约 100–250 vh/s */
const VH_PER_DEG = 160;
const MAX_DEG = 1;
/** 跟随速度（1/s）：越大越跟手；配合 ScrollDriver 的速度衰减，停下后约 0.6–0.9 s 回正 */
const FOLLOW = 7;

let tilt = 0;
/** 给读数面板用 */
export const getTilt = () => tilt;

export default function VelocityTilt() {
  const { reducedMotion } = useScene();
  useEffect(() => {
    const root = document.documentElement;
    let prev = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      // ScrollDriver 挂载时若 innerHeight 为 0，速度会一直是 NaN（已写进"需要集成会话改"），这里兜底
      const raw = getScrollVelocity();
      const v = reducedMotion || !Number.isFinite(raw) ? 0 : raw;
      const target = Math.max(-MAX_DEG, Math.min(MAX_DEG, v / VH_PER_DEG));
      tilt += (target - tilt) * (1 - Math.exp(-FOLLOW * dt));
      if (Math.abs(tilt) < 0.005 && target === 0) tilt = 0;
      root.style.setProperty("--sm-tilt", tilt.toFixed(3));
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      tilt = 0;
      root.style.removeProperty("--sm-tilt");
    };
  }, [reducedMotion]);
  return null;
}

/** 读倾斜变量的 style 片段（独立 rotate 属性，不和 transform 打架） */
export const tiltStyle = (factor = 1) => ({ rotate: `calc(var(--sm-tilt, 0) * ${factor}deg)` });
