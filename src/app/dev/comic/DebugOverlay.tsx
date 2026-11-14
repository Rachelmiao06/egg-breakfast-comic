"use client";
/**
 * 预览页的调试叠层：标出后景蛋的名义位置、第 4 段接触点、两者之间的飞行弧线（随滚动 t 走一个点），
 * 以及第 3 段妈妈视线到蛋的虚线；右上角显示 progress / activePanel / flight t。
 * 只在 /dev/comic 用，不进首页。
 */
import { useEffect, useState } from "react";
import { useScene } from "@/lib/scene-context";
import { ANCHORS, FOCUS_Y, SCENE_H, SCENE_W } from "@/lib/scene";
import { getEggCatch, type EggCatch } from "@/components/comic/catch-point";

/** 和 SceneStage 同一套 cover 换算：场景像素 → 视口像素（名义位置，未计视差/退场）。 */
function sceneToViewport(px: number, py: number) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const s = Math.max(w / SCENE_W, h / SCENE_H);
  const x = (w - SCENE_W * s) / 2;
  const y = Math.min(0, Math.max(h - SCENE_H * s, h * 0.55 - FOCUS_Y * s));
  return { x: x + px * s, y: y + py * s };
}

type Pt = { x: number; y: number };

export default function DebugOverlay({ flight }: { flight: number }) {
  const { progress, activePanel } = useScene();
  const [egg, setEgg] = useState<Pt | null>(null);
  const [catchPt, setCatchPt] = useState<EggCatch | null>(null);
  const [gaze, setGaze] = useState<Pt | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setEgg(sceneToViewport(ANCHORS.eggRest.x, ANCHORS.eggRest.y));
      setCatchPt(getEggCatch());
      const g = document.querySelector<HTMLElement>("[data-gaze-origin]");
      if (g) {
        const r = g.getBoundingClientRect();
        setGaze({ x: r.left, y: r.top });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const vh = typeof window === "undefined" ? 0 : window.innerHeight;
  const catchVisible = catchPt && catchPt.y > -200 && catchPt.y < vh + 200;
  const gazeVisible = gaze && gaze.y > -100 && gaze.y < vh + 100;

  // 飞行弧线：从后景蛋到接触点，控制点抬高一点，蛋沿线放大
  let arc: string | null = null;
  let dot: Pt | null = null;
  if (egg && catchPt && catchVisible) {
    const c = { x: (egg.x + catchPt.x) / 2, y: Math.min(egg.y, catchPt.y) - vh * 0.28 };
    arc = `M ${egg.x} ${egg.y} Q ${c.x} ${c.y} ${catchPt.x} ${catchPt.y}`;
    const t = flight;
    dot = {
      x: (1 - t) ** 2 * egg.x + 2 * (1 - t) * t * c.x + t * t * catchPt.x,
      y: (1 - t) ** 2 * egg.y + 2 * (1 - t) * t * c.y + t * t * catchPt.y,
    };
  }

  return (
    <>
      <svg className="pointer-events-none fixed inset-0 z-50 h-full w-full" aria-hidden>
        {egg && (
          <g>
            <circle cx={egg.x} cy={egg.y} r={14} fill="rgba(217,83,79,0.15)" stroke="#d9534f" strokeWidth={3} />
            <text x={egg.x + 20} y={egg.y + 5} fill="#d9534f" fontSize={15} fontWeight={700} stroke="#fbf3e4" strokeWidth={3} paintOrder="stroke">厨房蛋 eggRest（名义）</text>
          </g>
        )}
        {gazeVisible && egg && gaze && (
          <line x1={gaze.x} y1={gaze.y} x2={egg.x} y2={egg.y} stroke="#6b4a2b" strokeWidth={2.5} strokeDasharray="8 6" />
        )}
        {arc && <path d={arc} fill="none" stroke="#d9534f" strokeWidth={2.5} strokeDasharray="6 7" />}
        {catchVisible && catchPt && (
          <g>
            <line x1={catchPt.x - 14} y1={catchPt.y} x2={catchPt.x + 14} y2={catchPt.y} stroke="#d9534f" strokeWidth={3} />
            <line x1={catchPt.x} y1={catchPt.y - 14} x2={catchPt.x} y2={catchPt.y + 14} stroke="#d9534f" strokeWidth={3} />
            <ellipse cx={catchPt.x + catchPt.eggWidth / 2} cy={catchPt.y - catchPt.eggWidth * 0.3} rx={catchPt.eggWidth / 2} ry={catchPt.eggWidth * 0.3} fill="rgba(217,83,79,0.08)" stroke="#d9534f" strokeWidth={1} strokeDasharray="3 4" />
            <text x={catchPt.x + 18} y={catchPt.y + 30} fill="#d9534f" fontSize={15} fontWeight={700} stroke="#fbf3e4" strokeWidth={3} paintOrder="stroke">接蛋点 {Math.round(catchPt.x)},{Math.round(catchPt.y)}（蛋宽 {Math.round(catchPt.eggWidth)}px）</text>
          </g>
        )}
        {dot && flight > 0 && flight < 1 && <circle cx={dot.x} cy={dot.y} r={10 + 14 * flight} fill="rgba(217,83,79,0.35)" stroke="#d9534f" strokeWidth={2} />}
      </svg>
      <div className="fixed right-3 top-3 z-50 rounded bg-ink/80 px-3 py-2 font-mono text-xs text-cream">
        <div>progress {progress.toFixed(2)}</div>
        <div>activePanel {activePanel}</div>
        <div>flight t {flight.toFixed(2)}</div>
      </div>
    </>
  );
}
