"use client";
/**
 * 场景层的前景妈妈（comic-scroll 分支，第五版：只读统一节拍表）。
 * 放进 <KitchenScene foreground={<MomForeground/>}>，和厨房一起 cover 缩放、被镜头带动，
 * 所以蛋能准确落在铲面（ANCHORS.spatulaLand）和碗中央（ANCHORS.bowlCenter）。
 *
 * 只读 useScene().timeline：
 * - spatula 段：MOM_SPATULA 在进入 + 动作阶段从右下滑入到 scene.ts 的摆放位置，停留阶段保持。
 * - catch 段：保持不动，蛋（主会话的 <Egg>）落到铲面上。
 * - serve 段：进入阶段交叉淡化为 MOM_SERVE；之后（含 ending 段）保持端碗。
 * 坐标全部来自 scene.ts，这里不另定；图是合并插画，不做任何"动作"晃动。
 * reducedMotion：不滑入、不渐变，按段直接切换。
 */
import type { CSSProperties } from "react";
import { phaseProgress } from "@/lib/beats";
import { MOM_SERVE, MOM_SPATULA, Z } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 滑入起点相对摆放位置的偏移（场景像素），右下方画面外 */
const ENTER_DX = 460;
const ENTER_DY = 300;

function placement(p: { x: number; y: number; w: number; h: number; scale: number }): CSSProperties {
  return { position: "absolute", left: p.x, top: p.y, width: p.w * p.scale, height: p.h * p.scale };
}

export default function MomForeground() {
  const { timeline: t, reducedMotion } = useScene();
  const id = t.beat.id;
  const spatulaIndex = 5;

  // 滑入进度：spatula 段的进入 + 动作阶段合起来 0→1（按 beats.json 的阶段比例切分），之后 1
  let enter = 0;
  if (id === "spatula") {
    const { enter: pe, action: pa } = t.beat.phases;
    const split = pe + pa > 0 ? pe / (pe + pa) : 0;
    enter = t.phase === "enter" ? t.phaseP * split : t.phase === "action" ? split + (1 - split) * t.phaseP : 1;
  } else if (t.index > spatulaIndex) {
    enter = 1;
  }
  // 交叉淡化：serve 段进入阶段 0→1，之后 1
  const cross = id === "serve" ? phaseProgress(t, "enter") : id === "ending" ? 1 : 0;

  const e = reducedMotion ? (t.index >= spatulaIndex ? 1 : 0) : clamp01(enter);
  const c = reducedMotion ? (id === "serve" || id === "ending" ? 1 : 0) : clamp01(cross);
  if (e <= 0) return null;

  const k = easeOut(e);
  const slide = `translate(${(1 - k) * ENTER_DX}px, ${(1 - k) * ENTER_DY}px)`;

  return (
    <div data-mom-foreground aria-hidden className="pointer-events-none absolute inset-0" style={{ zIndex: Z.mom }}>
      {c < 1 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          data-mom="spatula"
          src={MOM_SPATULA.src}
          alt=""
          draggable={false}
          className="select-none"
          style={{ ...placement(MOM_SPATULA), transform: slide, opacity: 1 - c, willChange: "transform, opacity" }}
        />
      )}
      {c > 0 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          data-mom="serve"
          src={MOM_SERVE.src}
          alt=""
          draggable={false}
          className="select-none"
          style={{ ...placement(MOM_SERVE), opacity: c, willChange: "opacity" }}
        />
      )}
    </div>
  );
}
