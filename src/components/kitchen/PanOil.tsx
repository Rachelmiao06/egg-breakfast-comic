"use client";
/** 锅里的油：原画抽出的 oil.png，轻微的明暗呼吸，像热油在微微晃。 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { SCENE_H, SCENE_W, Z } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";

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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src="/assets/scene/oil.png"
      alt=""
      draggable={false}
      className="pointer-events-none absolute inset-0 select-none"
      style={{ width: SCENE_W, height: SCENE_H, zIndex: Z.fx }}
    />
  );
}
