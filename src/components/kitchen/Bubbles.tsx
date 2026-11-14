"use client";
/**
 * 锅里的小油泡和偶尔跳起的油星（Canvas）。
 * 油泡在油面椭圆里冒出 → 长大 → 破裂成一圈淡环；油星每 3–6 秒从油面跳起再落回。
 * 颜色取自原画的油：金黄填充 + 细棕描边 + 一点高光，尽量小、淡。
 */
import { useRef } from "react";
import { Z } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";
import { useCanvasLoop } from "./useCanvasLoop";

// 油面椭圆（场景像素），与 tools/extract_fx.py 里的油区一致
const BOX = { x: 400, y: 540, w: 660, h: 130 };
const OIL = { cx: 728 - BOX.x, cy: 622 - BOX.y, rx: 270, ry: 30 };
const AVOID = { cx: 720 - BOX.x, rx: 120 }; // 蛋落脚的地方少冒泡，避免被蛋挡住

type Bubble = { x: number; y: number; r: number; max: number; life: number; pop: number };
type Drop = { x: number; y: number; vx: number; vy: number; y0: number };

function spawnPoint() {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    const k = Math.sqrt(Math.random());
    const x = OIL.cx + Math.cos(a) * OIL.rx * k;
    const y = OIL.cy + Math.sin(a) * OIL.ry * k;
    if (Math.abs(x - AVOID.cx) > AVOID.rx || Math.random() < 0.15) return { x, y };
  }
  return { x: OIL.cx - 200, y: OIL.cy };
}

export default function Bubbles() {
  const { reducedMotion } = useScene();
  const bubbles = useRef<Bubble[]>([]);
  const drops = useRef<Drop[]>([]);
  const nextDrop = useRef(2);

  const ref = useCanvasLoop(
    BOX.w,
    BOX.h,
    (ctx, dt) => {
      const bs = bubbles.current;
      if (bs.length < 16 && Math.random() < dt * 9) {
        const p = spawnPoint();
        bs.push({ ...p, r: 0.5, max: 2 + Math.random() * 4.5, life: 0, pop: 0 });
      }
      for (let i = bs.length - 1; i >= 0; i--) {
        const b = bs[i];
        b.life += dt;
        if (b.pop > 0) {
          b.pop += dt;
          const k = b.pop / 0.25;
          if (k >= 1) {
            bs.splice(i, 1);
            continue;
          }
          ctx.strokeStyle = `rgba(255,236,190,${0.6 * (1 - k)})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.ellipse(b.x, b.y, b.max * (1 + k * 1.2), b.max * 0.7 * (1 + k * 1.2), 0, 0, Math.PI * 2);
          ctx.stroke();
          continue;
        }
        b.r = Math.min(b.max, b.r + dt * b.max * 1.6);
        if (b.life > 0.7 + b.max * 0.12 && Math.random() < dt * 3) b.pop = 0.0001;
        ctx.fillStyle = "rgba(246,206,110,0.35)";
        ctx.strokeStyle = "rgba(120,78,30,0.45)";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.r, b.r * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,245,0.8)";
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.3, Math.max(0.6, b.r * 0.25), 0, Math.PI * 2);
        ctx.fill();
      }
      // 油星
      nextDrop.current -= dt;
      if (nextDrop.current <= 0) {
        nextDrop.current = 3 + Math.random() * 3;
        const p = spawnPoint();
        drops.current.push({ x: p.x, y: p.y, y0: p.y, vx: (Math.random() - 0.5) * 50, vy: -150 - Math.random() * 60 });
      }
      const ds = drops.current;
      for (let i = ds.length - 1; i >= 0; i--) {
        const d = ds[i];
        d.vy += 520 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.y > d.y0 && d.vy > 0) {
          ds.splice(i, 1);
          continue;
        }
        const ang = Math.atan2(d.vy, d.vx) + Math.PI / 2;
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(ang);
        ctx.fillStyle = "rgba(240,180,60,0.85)";
        ctx.strokeStyle = "rgba(120,78,30,0.6)";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.ellipse(0, 0, 2.2, 3.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    },
    !reducedMotion,
  );

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute"
      style={{ left: BOX.x, top: BOX.y, width: BOX.w, height: BOX.h, zIndex: Z.fx }}
    />
  );
}
