"use client";
/** 锅里的油：原画抽出的 oil.webp（已裁到包围盒，按 ANCHORS.oilSprite 摆回原位），轻微的明暗呼吸，像热油在微微晃。 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ANCHORS, boxStyle, Z } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";
import FollowMid from "./FollowMid";

export default function PanOil() {
  const ref = useRef<HTMLImageElement>(null);
  const { reducedMotion } = useScene();
  useEffect(() => {
    if (!ref.current || reducedMotion) return;
    // 必须显式给起点：从 "none" 插值时 GSAP 会把起点当成 brightness(0)
    const t = gsap.fromTo(
      ref.current,
      { filter: "brightness(1)" },
      { filter: "brightness(1.08)", duration: 1.6, repeat: -1, yoyo: true, ease: "sine.inOut" },
    );
    return () => {
      t.kill();
    };
  }, [reducedMotion]);
  return (
    <FollowMid zIndex={Z.fx}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      ref={ref}
      src="/assets/scene/oil.webp"
      alt=""
      draggable={false}
      className="pointer-events-none select-none"
      style={boxStyle(ANCHORS.oilSprite)}
    />
    </FollowMid>
  );
}
