"use client";
/** 水壶嘴慢慢冒出的一点蒸汽（Canvas，柔和的奶白水彩团，最多十来团，很淡）。 */
import { useRef } from "react";
import { ANCHORS, Z } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";
import { useCanvasLoop } from "./useCanvasLoop";

const BOX = { x: 1020, y: 60, w: 300, h: 280 };
const SPOUT = { x: ANCHORS.kettleSpout.x - BOX.x, y: ANCHORS.kettleSpout.y - BOX.y };

type Puff = { x: number; y: number; r: number; life: number; ttl: number; vx: number; seed: number };

export default function Steam() {
  const { reducedMotion } = useScene();
  const puffs = useRef<Puff[]>([]);
  const acc = useRef(0);

  const ref = useCanvasLoop(
    BOX.w,
    BOX.h,
    (ctx, dt, t) => {
      acc.current += dt;
      if (acc.current > 0.55) {
        acc.current = 0;
        puffs.current.push({ x: SPOUT.x, y: SPOUT.y, r: 8, life: 0, ttl: 4 + Math.random() * 1.5, vx: -6 - Math.random() * 6, seed: Math.random() * 10 });
      }
      const ps = puffs.current;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life += dt;
        const k = p.life / p.ttl;
        if (k >= 1) {
          ps.splice(i, 1);
          continue;
        }
        p.y -= dt * 34;
        p.x += dt * (p.vx + Math.sin(t * 1.3 + p.seed) * 9);
        p.r += dt * 9;
        const a = 0.2 * Math.sin(Math.PI * k) ** 1.4;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(255,252,244,${a})`);
        g.addColorStop(0.6, `rgba(255,250,238,${a * 0.5})`);
        g.addColorStop(1, "rgba(255,250,238,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    !reducedMotion,
  );

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute"
      style={{ left: BOX.x, top: BOX.y, width: BOX.w, height: BOX.h, zIndex: Z.steam, translate: "var(--kl-counter-x, 0px) var(--kl-counter-y, 0px)" }}
    />
  );
}
