"use client";
/**
 * 荷包蛋循环跳跃：压扁蓄力 → 拉长起跳 → 空中 → 下落 → 落地摊平 → 回弹 → 停一会儿再来。
 * 一条 GSAP 时间线同时驱动蛋和影子。transform-origin 在脚底。
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ANCHORS } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";
import EggShadow from "./EggShadow";

/** 临时抠图的裁剪框（场景像素）。正式 egg.png 为整幅 1536×1024 时把这里改成 0,0。 */
const CROP = { x: 515, y: 140, w: 410, h: 395 };
/** 原画里蛋脚底 y≈519（悬空）；静止时要落到锅面 eggRest.y。 */
const REST_OFFSET = ANCHORS.eggRest.y - 519;
const JUMP_HEIGHT = 130;

export default function Egg({ paused = false, src = "/assets/scene-draft/egg.png" }: { paused?: boolean; src?: string }) {
  const eggRef = useRef<HTMLImageElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const { reducedMotion } = useScene();

  useEffect(() => {
    const egg = eggRef.current;
    const shadow = shadowRef.current;
    if (!egg || !shadow) return;
    const ctx = gsap.context(() => {
      gsap.set(egg, { y: REST_OFFSET, scaleX: 1, scaleY: 1, transformOrigin: "50% 100%" });
      gsap.set(shadow, { scale: 1, opacity: 0.4 });
      if (reducedMotion) return;

      const tl = gsap.timeline({ repeat: -1, repeatRefresh: true, repeatDelay: 0.9, paused });
      tl
        // 蓄力：压扁
        .to(egg, { scaleX: 1.1, scaleY: 0.88, duration: 0.2, ease: "power2.out" })
        .to(shadow, { scale: 1.06, opacity: 0.46, duration: 0.2 }, "<")
        // 起跳：拉长
        .to(egg, { scaleX: 0.92, scaleY: 1.12, y: REST_OFFSET - 30, duration: 0.12, ease: "power2.in" })
        // 上升到最高点
        .to(egg, { y: REST_OFFSET - JUMP_HEIGHT, scaleX: 1, scaleY: 1.03, duration: 0.4, ease: "power2.out" })
        .to(shadow, { scale: 0.62, opacity: 0.16, duration: 0.52, ease: "power2.out" }, "<-0.12")
        // 下落
        .to(egg, { y: REST_OFFSET, scaleX: 0.96, scaleY: 1.08, duration: 0.34, ease: "power2.in" })
        .to(shadow, { scale: 1, opacity: 0.4, duration: 0.34, ease: "power2.in" }, "<")
        // 落地摊平
        .to(egg, { scaleX: 1.18, scaleY: 0.8, duration: 0.1, ease: "power1.out" })
        .to(shadow, { scale: 1.12, opacity: 0.5, duration: 0.1 }, "<")
        // 回弹
        .to(egg, { scaleX: 1, scaleY: 1, duration: 0.55, ease: "elastic.out(1, 0.45)" })
        .to(shadow, { scale: 1, opacity: 0.4, duration: 0.3 }, "<");
      // 每轮停顿略有随机
      tl.eventCallback("onRepeat", () => {
        tl.repeatDelay(0.6 + Math.random() * 0.8);
      });
    });
    return () => ctx.revert();
  }, [paused, reducedMotion]);

  return (
    <>
      <EggShadow ref={shadowRef} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={eggRef}
        src={src}
        alt=""
        draggable={false}
        className="pointer-events-none absolute select-none will-change-transform"
        style={{ left: CROP.x, top: CROP.y, width: CROP.w, height: CROP.h }}
      />
    </>
  );
}
