"use client";
/** 锅底火苗：原画抽出的 flame.webp（已裁到包围盒，按 ANCHORS.flameSprite 摆回原位），两份叠加做轻微纵向伸缩和亮度闪烁。原点在火苗底部。 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ANCHORS, boxStyle, Z } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";
import FollowMid from "./FollowMid";

const [fx0, , fx1, fy1] = ANCHORS.flameBox;
const [sx0, sy0] = ANCHORS.flameSprite;
// 变换原点仍是场景坐标里的火苗底部，换算成相对裁切图左上角
const ORIGIN = `${(fx0 + fx1) / 2 - sx0}px ${fy1 + 6 - sy0}px`;

export default function Flame() {
  const a = useRef<HTMLImageElement>(null);
  const b = useRef<HTMLImageElement>(null);
  const { reducedMotion } = useScene();

  useEffect(() => {
    if (!a.current || !b.current) return;
    const ctx = gsap.context(() => {
      gsap.set([a.current, b.current], { transformOrigin: ORIGIN });
      gsap.set(b.current, { opacity: 0 });
      if (reducedMotion) return;
      const flick = (el: HTMLImageElement, base: number) => {
        const next = () =>
          gsap.to(el, {
            scaleY: base + Math.random() * 0.07,
            scaleX: 1 + (Math.random() - 0.5) * 0.02,
            duration: 0.12 + Math.random() * 0.16,
            ease: "sine.inOut",
            onComplete: next,
          });
        next();
      };
      flick(a.current!, 1);
      flick(b.current!, 1.02);
      gsap.to(b.current, { opacity: 0.55, duration: 0.35, repeat: -1, yoyo: true, ease: "sine.inOut", repeatRefresh: true });
    });
    return () => ctx.revert();
  }, [reducedMotion]);

  const style = boxStyle(ANCHORS.flameSprite);
  return (
    <FollowMid zIndex={Z.fx}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={a} src="/assets/scene/flame.webp" alt="" draggable={false} className="pointer-events-none select-none" style={style} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={b}
        src="/assets/scene/flame.webp"
        alt=""
        draggable={false}
        className="pointer-events-none select-none"
        style={{ ...style, filter: "brightness(1.12) saturate(1.05)" }}
      />
    </FollowMid>
  );
}
