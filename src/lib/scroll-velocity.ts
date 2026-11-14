/**
 * 滚动速度（集成会话维护）。只由 <ScrollDriver> 写入，和时间轴同源，不是第二套滚动驱动。
 *
 * 速度单位：视口高度 / 秒（vh/s，向下为正）。已做平滑，停止滚动后按指数衰减回 0。
 * 为避免每帧重渲染整个 React 树，速度不放进 useScene()，而是一个小的外部存储：
 * - 在 rAF / gsap.ticker 循环里直接读 getScrollVelocity()（推荐，用于倾斜等逐帧效果）；
 * - 或用 useScrollVelocity() 订阅（会随速度变化重渲染，只给调试读数用）。
 */
import { useSyncExternalStore } from "react";

let velocity = 0;
const listeners = new Set<() => void>();

export function getScrollVelocity() {
  return velocity;
}

/** 只给 ScrollDriver 调用 */
export function setScrollVelocity(v: number) {
  if (v === velocity) return;
  velocity = v;
  listeners.forEach((l) => l());
}

export function subscribeScrollVelocity(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useScrollVelocity() {
  return useSyncExternalStore(subscribeScrollVelocity, getScrollVelocity, () => 0);
}
