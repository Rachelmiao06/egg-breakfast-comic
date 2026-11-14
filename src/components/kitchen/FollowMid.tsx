"use client";
/**
 * 让锅里的东西跟随 KitchenLayers 发布在舞台上的锅身视差（--kl-mid-x/y）。
 * 用外壳承担 translate 和 z-index：GSAP 会清掉被它动画的元素上的 CSS 独立 translate 属性，
 * 所以不能直接写在蛋、火苗这些元素上。外壳铺满场景画布，子元素坐标不变。
 */
import type { ReactNode } from "react";

export default function FollowMid({ zIndex, children }: { zIndex: number; children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 h-full w-full"
      style={{ zIndex, translate: "var(--kl-mid-x, 0px) var(--kl-mid-y, 0px)" }}
    >
      {children}
    </div>
  );
}
