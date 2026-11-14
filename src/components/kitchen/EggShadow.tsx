"use client";
/** 蛋在锅底的软影子（纯展示，由 <Egg> 的时间线驱动缩放和透明度）。 */
import { forwardRef } from "react";
import { ANCHORS } from "@/lib/scene";

const W = 250;
const H = 46;

const EggShadow = forwardRef<HTMLDivElement, { zIndex?: number }>(function EggShadow({ zIndex }, ref) {
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: ANCHORS.eggRest.x - W / 2,
        // 影子落在锅底上：锅沿遮挡线（x=720 处 y≈657）以上，否则会被 pan-rim 层挡住
        top: ANCHORS.eggRest.y - 23 - H / 2,
        width: W,
        height: H,
        borderRadius: "50%",
        background:
          "radial-gradient(ellipse at center, rgba(70,42,18,0.5) 0%, rgba(70,42,18,0.22) 45%, rgba(70,42,18,0) 72%)",
        transformOrigin: "50% 50%",
        opacity: 0.45,
        zIndex,
        translate: "var(--kl-mid-x, 0px) var(--kl-mid-y, 0px)",
      }}
    />
  );
});
export default EggShadow;
