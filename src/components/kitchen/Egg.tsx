"use client";
/**
 * 荷包蛋。
 * - 循环模式（flight === null）：压扁蓄力 → 拉长起跳 → 空中 → 下落 → 落地摊平 → 回弹 → 停一会儿再来。
 * - 飞行模式（flight 0–1，由 comic-scroll 随滚动写入）：停止循环，沿弧线从锅里（panLaunch）飞到前景妈妈的
 *   锅铲上（spatulaLand）；到 1 时落在铲面压扁回弹。在锅里时 z = Z.eggInPan（被锅沿挡脚），起飞后 z = Z.eggFlying。
 * 图片脚底对齐 ANCHORS.eggRest，transform-origin 在脚底。
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ANCHORS, Z } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";
import EggShadow from "./EggShadow";

const { eggRest: REST, eggSize: SIZE, panLaunch: START, spatulaLand: LAND } = ANCHORS;
const JUMP_HEIGHT = 135;
/** 飞行弧线的控制点（二次贝塞尔），越高弧越大 */
const CTRL = { x: 930, y: 300 };

function flightPose(f: number) {
  const t = Math.min(Math.max(f, 0), 1);
  const x = (1 - t) ** 2 * START.x + 2 * (1 - t) * t * CTRL.x + t ** 2 * LAND.x;
  const y = (1 - t) ** 2 * START.y + 2 * (1 - t) * t * CTRL.y + t ** 2 * LAND.y;
  return {
    x: x - REST.x,
    y: y - REST.y,
    rotation: 14 * Math.sin(Math.PI * t), // 空中稍微转身，落地回正
    scale: 1 + 0.28 * t, // 从后景飞到前景，越近越大
  };
}

export default function Egg({ src = "/assets/scene/egg.webp" }: { src?: string }) {
  const eggRef = useRef<HTMLImageElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const landedRef = useRef(false);
  const { reducedMotion, flight } = useScene();
  const flying = flight !== null;
  const zIndex = flight !== null && flight > 0.02 ? Z.eggFlying : Z.eggInPan;

  // 循环跳跃
  useEffect(() => {
    const egg = eggRef.current;
    const shadow = shadowRef.current;
    if (!egg || !shadow || flying) return;
    const ctx = gsap.context(() => {
      gsap.set(egg, { x: 0, y: 0, rotation: 0, scale: 1, scaleX: 1, scaleY: 1, transformOrigin: "50% 100%" });
      gsap.set(shadow, { scale: 1, opacity: 0.45 });
      if (reducedMotion) return;
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.9 });
      tl.to(egg, { scaleX: 1.1, scaleY: 0.88, duration: 0.2, ease: "power2.out" })
        .to(shadow, { scale: 1.06, opacity: 0.5, duration: 0.2 }, "<")
        .to(egg, { scaleX: 0.92, scaleY: 1.12, y: -30, duration: 0.12, ease: "power2.in" })
        .to(egg, { y: -JUMP_HEIGHT, scaleX: 1, scaleY: 1.03, duration: 0.4, ease: "power2.out" })
        .to(shadow, { scale: 0.6, opacity: 0.16, duration: 0.52, ease: "power2.out" }, "<-0.12")
        .to(egg, { y: 0, scaleX: 0.96, scaleY: 1.08, duration: 0.34, ease: "power2.in" })
        .to(shadow, { scale: 1, opacity: 0.45, duration: 0.34, ease: "power2.in" }, "<")
        .to(egg, { scaleX: 1.18, scaleY: 0.8, duration: 0.1, ease: "power1.out" })
        .to(shadow, { scale: 1.12, opacity: 0.55, duration: 0.1 }, "<")
        .to(egg, { scaleX: 1, scaleY: 1, duration: 0.55, ease: "elastic.out(1, 0.45)" })
        .to(shadow, { scale: 1, opacity: 0.45, duration: 0.3 }, "<");
      tl.eventCallback("onRepeat", () => {
        tl.repeatDelay(0.6 + Math.random() * 0.8);
      });
    });
    return () => ctx.revert();
  }, [flying, reducedMotion]);

  // 飞行：随 flight 更新位置；首次进入时用短缓动接上当前姿态
  useEffect(() => {
    const egg = eggRef.current;
    const shadow = shadowRef.current;
    if (!egg || !shadow || flight === null) {
      landedRef.current = false;
      return;
    }
    const p = flightPose(flight);
    gsap.to(egg, { ...p, scaleX: 1, scaleY: 1, duration: reducedMotion ? 0 : 0.25, ease: "power2.out", overwrite: "auto", transformOrigin: "50% 100%" });
    gsap.to(shadow, { opacity: 0.45 * Math.max(0, 1 - flight * 4), scale: 1 - flight, duration: 0.25, overwrite: "auto" });
    if (flight >= 1 && !landedRef.current && !reducedMotion) {
      landedRef.current = true;
      gsap.timeline({ delay: 0.2 })
        .to(egg, { scaleX: 1.2, scaleY: 0.78, duration: 0.1, ease: "power1.out" })
        .to(egg, { scaleX: 1, scaleY: 1, duration: 0.6, ease: "elastic.out(1, 0.45)" });
    } else if (flight < 0.98) {
      landedRef.current = false;
    }
  }, [flight, reducedMotion]);

  return (
    <>
      <EggShadow ref={shadowRef} zIndex={Z.eggInPan} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={eggRef}
        src={src}
        alt=""
        draggable={false}
        className="pointer-events-none absolute select-none will-change-transform"
        style={{ left: REST.x - SIZE.w / 2, top: REST.y - SIZE.h, width: SIZE.w, height: SIZE.h, zIndex }}
      />
    </>
  );
}
