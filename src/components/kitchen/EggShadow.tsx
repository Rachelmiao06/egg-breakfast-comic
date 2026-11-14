"use client";
/** 蛋在锅面上的软影子（纯展示，由 <Egg> 的时间线驱动缩放和透明度）。 */
import { forwardRef } from "react";
import { ANCHORS } from "@/lib/scene";

const W = 230;
const H = 44;

const EggShadow = forwardRef<HTMLDivElement>(function EggShadow(_, ref) {
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: ANCHORS.eggRest.x - W / 2,
        top: ANCHORS.eggRest.y + 18 - H / 2,
        width: W,
        height: H,
        borderRadius: "50%",
        background: "radial-gradient(ellipse at center, rgba(92,58,20,0.45) 0%, rgba(92,58,20,0.18) 45%, rgba(92,58,20,0) 72%)",
        transformOrigin: "50% 50%",
        opacity: 0.4,
      }}
    />
  );
});
export default EggShadow;
