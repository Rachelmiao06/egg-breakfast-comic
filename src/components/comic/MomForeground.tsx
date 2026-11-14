"use client";
/**
 * 场景层的前景妈妈（comic-scroll 分支）。放进 <KitchenScene foreground={<MomForeground/>}>，
 * 和厨房一起 cover 缩放、被镜头带动，所以蛋能准确落在铲面（ANCHORS.spatulaLand）和碗中央（ANCHORS.bowlCenter）。
 *
 * - 节拍 5：MOM_SPATULA 从右下滑入到 scene.ts 的摆放位置（进度 enter 来自 mom-store，由 ComicScroll scrub）。
 * - 节拍 6：停在摆放位置，蛋（主会话的 <Egg>）落到铲面上。
 * - 节拍 7：交叉淡化为 MOM_SERVE（进度 cross）。
 * - 节拍 8：保持端碗。
 * 坐标全部来自 scene.ts，这里不另定；图是合并插画，不做任何"动作"晃动。
 * reducedMotion：不滑入、不渐变，按 activePanel 直接切换。
 */
import type { CSSProperties } from "react";
import { MOM_SERVE, MOM_SPATULA, Z } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";
import { useMomState } from "./mom-store";

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/** 滑入起点相对摆放位置的偏移（场景像素），右下方画面外 */
const ENTER_DX = 460;
const ENTER_DY = 300;

function placement(p: { x: number; y: number; w: number; h: number; scale: number }): CSSProperties {
  return { position: "absolute", left: p.x, top: p.y, width: p.w * p.scale, height: p.h * p.scale };
}

export default function MomForeground() {
  const { activePanel, reducedMotion } = useScene();
  const { enter, cross } = useMomState();

  const e = reducedMotion ? (activePanel >= 5 ? 1 : 0) : enter;
  const c = reducedMotion ? (activePanel >= 7 ? 1 : 0) : cross;
  if (e <= 0) return null;

  const k = easeOut(e);
  const slide = `translate(${(1 - k) * ENTER_DX}px, ${(1 - k) * ENTER_DY}px)`;

  return (
    <div data-mom-foreground aria-hidden className="pointer-events-none absolute inset-0" style={{ zIndex: Z.mom }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        data-mom="spatula"
        src={MOM_SPATULA.src}
        alt=""
        draggable={false}
        className="select-none"
        style={{ ...placement(MOM_SPATULA), transform: slide, opacity: 1 - c, willChange: "transform, opacity" }}
      />
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
