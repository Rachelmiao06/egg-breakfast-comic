"use client";
/**
 * 荷包蛋。环境动画按真实时间推进，不依赖滚动；滚动只负责叙事交接。
 * - 循环模式（开场、备菜、发现跳蛋、伸锅铲）：每一跳是独立的一段动画，落地后随机停顿再排下一跳。
 *   用户停止滚动时蛋照样在跳。
 * - 待命（进入接蛋段、还没起飞）：当前这一跳落地后不再起跳，稳稳停在锅里等滚动接管，避免位置突变。
 * - 接蛋（flight 0–1，comic-scroll 随滚动写入）：停止循环，沿弧线从锅里（panLaunch）飞到前景妈妈的锅铲上
 *   （spatulaLand），缩到 eggOnSpatula；到 1 时落在铲面压扁回弹。
 * - 放进饭碗（serve 0–1）：从铲面轻轻一跳移到饭碗中央（bowlLand），缩到 eggInBowl；到 1 时轻落在饭上。
 * 在锅里时 z = Z.eggInPan（被锅沿挡脚），起飞后 z = Z.eggFlying。始终是同一个元素、同一颗蛋。
 * 图片脚底对齐 ANCHORS.eggRest，transform-origin 在脚底。
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { beatById } from "@/lib/beats";
import { ANCHORS, Z } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";
import EggShadow from "./EggShadow";
import FollowMid from "./FollowMid";

const { eggRest: REST, eggSize: SIZE, panLaunch: START, spatulaLand: LAND, bowlLand: BOWL, eggOnSpatula: S_SPAT, eggInBowl: S_BOWL } = ANCHORS;
const JUMP_HEIGHT = 135;
/** 接蛋弧线的控制点（二次贝塞尔）：先高高跳起，再落向前景铲面 */
const CTRL = { x: 610, y: 260 };
/** 触发后按秒播放的小动作时长，来自统一节拍表（先调滚动长度，再调这里） */
const LAND_SQUASH_S = beatById("catch").seconds.landSquash ?? 0.7;
const BOWL_SETTLE_S = beatById("serve").seconds.bowlSettle ?? 0.6;
/** 放进饭碗时的小跳高度 */
const SERVE_HOP = 110;

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const bezier = (a: number, b: number, c: number, t: number) => (1 - t) ** 2 * a + 2 * (1 - t) * t * b + t ** 2 * c;

function flightPose(f: number) {
  const t = clamp01(f);
  return {
    x: bezier(START.x, CTRL.x, LAND.x, t) - REST.x,
    y: bezier(START.y, CTRL.y, LAND.y, t) - REST.y,
    rotation: -18 * Math.sin(Math.PI * t), // 空中转一下身，落地回正
    // 先略微变大（腾空靠近镜头），再缩到铲面尺寸
    scale: 1 + 0.15 * Math.sin(Math.PI * t) + (S_SPAT - 1) * t * t,
  };
}

function servePose(v: number) {
  const t = clamp01(v);
  const midY = Math.min(LAND.y, BOWL.y) - SERVE_HOP;
  return {
    x: LAND.x + (BOWL.x - LAND.x) * t - REST.x,
    y: bezier(LAND.y, midY, BOWL.y, t) - REST.y,
    rotation: 8 * Math.sin(Math.PI * t),
    scale: S_SPAT + (S_BOWL - S_SPAT) * t,
  };
}

export default function Egg({ src = "/assets/scene/egg.webp" }: { src?: string }) {
  const eggRef = useRef<HTMLImageElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const landedRef = useRef(false);
  const servedRef = useRef(false);
  const { reducedMotion, flight, serve, timeline, beats } = useScene();
  const flying = flight !== null;
  const zIndex = flight !== null && flight > 0.02 ? Z.eggFlying : Z.eggInPan;

  // 待命：下一段就要起飞（本段停留/退出阶段），或已进入接蛋段但还没起飞 → 落地后不再起跳，等滚动接管
  const nextBeat = beats[timeline.index + 1];
  const settle =
    (timeline.beat.egg === "flight" && flight === null) ||
    (nextBeat?.egg === "flight" && timeline.phase === "exit"); // 只在上一段退出阶段待命，"听见跳蛋"阅读时蛋仍在跳
  const settleRef = useRef(settle);
  const kickRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    settleRef.current = settle;
    if (!settle) kickRef.current?.(); // 回到循环段：如果正在待命就重新开始跳
  }, [settle]);

  // 循环跳跃：每一跳独立，onComplete 后随机停顿再排下一跳（不要在无限时间线的回调里改 repeatDelay，会卡住）
  useEffect(() => {
    const egg = eggRef.current;
    const shadow = shadowRef.current;
    if (!egg || !shadow || flying) return;
    let idle = true; // 当前没有在跳
    const ctx = gsap.context(() => {
      // 从任何姿态（比如刚从飞行回滚）平滑回到锅里
      gsap.to(egg, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, duration: 0.3, ease: "power2.out", transformOrigin: "50% 100%", overwrite: true });
      gsap.to(shadow, { scale: 1, opacity: 0.45, duration: 0.3, overwrite: true });
      if (reducedMotion) return;
      const jump = () => {
        if (settleRef.current) {
          idle = true;
          return;
        }
        idle = false;
        gsap
          .timeline({ onComplete: () => { idle = true; gsap.delayedCall(0.6 + Math.random() * 0.8, jump); } })
          .to(egg, { scaleX: 1.1, scaleY: 0.88, duration: 0.2, ease: "power2.out" })
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
      };
      kickRef.current = () => { if (idle) { gsap.killTweensOf(jump); jump(); } };
      gsap.delayedCall(0.35 + Math.random() * 0.3, jump);
    });
    return () => {
      kickRef.current = null;
      // 交给飞行时不要 revert（会让蛋瞬间跳回原位）：只停掉循环，由飞行 effect 从当前姿态平滑接上
      ctx.kill();
    };
  }, [flying, reducedMotion]);

  // 接蛋：随 flight 更新位置；首次进入时用短缓动接上当前姿态。serve 开始后由下一个 effect 接管
  useEffect(() => {
    const egg = eggRef.current;
    const shadow = shadowRef.current;
    if (!egg || !shadow || flight === null) {
      landedRef.current = false;
      return;
    }
    if (serve !== null) return;
    const p = flightPose(flight);
    gsap.to(egg, { ...p, scaleX: p.scale, scaleY: p.scale, duration: reducedMotion ? 0 : 0.3, ease: "power2.out", overwrite: true, transformOrigin: "50% 100%" });
    gsap.to(shadow, { opacity: 0.45 * Math.max(0, 1 - flight * 4), scale: 1 - flight, duration: 0.25, overwrite: "auto" });
    if (flight >= 1 && !landedRef.current && !reducedMotion) {
      landedRef.current = true;
      gsap.timeline({ delay: 0.2 })
        .to(egg, { scaleX: S_SPAT * 1.18, scaleY: S_SPAT * 0.8, duration: LAND_SQUASH_S * 0.15, ease: "power1.out" })
        .to(egg, { scaleX: S_SPAT, scaleY: S_SPAT, duration: LAND_SQUASH_S * 0.85, ease: "elastic.out(1, 0.45)" });
    } else if (flight < 0.98) {
      landedRef.current = false;
    }
  }, [flight, serve, reducedMotion]);

  // 放进饭碗
  useEffect(() => {
    const egg = eggRef.current;
    if (!egg || serve === null) {
      servedRef.current = false;
      return;
    }
    const sp = servePose(serve);
    gsap.to(egg, { ...sp, scaleX: sp.scale, scaleY: sp.scale, duration: reducedMotion ? 0 : 0.3, ease: "power2.out", overwrite: true, transformOrigin: "50% 100%" });
    if (serve >= 1 && !servedRef.current && !reducedMotion) {
      servedRef.current = true;
      gsap.timeline({ delay: 0.2 })
        .to(egg, { scaleX: S_BOWL * 1.12, scaleY: S_BOWL * 0.86, duration: BOWL_SETTLE_S * 0.17, ease: "power1.out" })
        .to(egg, { scaleX: S_BOWL, scaleY: S_BOWL, duration: BOWL_SETTLE_S * 0.83, ease: "elastic.out(1, 0.5)" });
    } else if (serve < 0.98) {
      servedRef.current = false;
    }
  }, [serve, reducedMotion]);

  return (
    <>
      <FollowMid zIndex={Z.eggInPan}>
        <EggShadow ref={shadowRef} />
      </FollowMid>
      <FollowMid zIndex={zIndex}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={eggRef}
        src={src}
        alt=""
        draggable={false}
        className="pointer-events-none absolute select-none will-change-transform"
        style={{ left: REST.x - SIZE.w / 2, top: REST.y - SIZE.h, width: SIZE.w, height: SIZE.h }}
      />
      </FollowMid>
    </>
  );
}
