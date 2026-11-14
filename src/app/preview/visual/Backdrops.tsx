"use client";
/**
 * 后景换场（新版）：配置在 backgrounds.json。
 * - Paper：场景层里的浅纸面，盖住厨房（灶台、锅、墙），下沿留出连续的桌沿；在近景物件之上、桌沿蛋之下。
 * - Hallway：走廊占位（明确标注，缺图），页面层，在漫画之下。
 * 两者都只改不透明度，不卸载任何角色层。
 */
import { Z } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";
import { BG, curve, gNow } from "./motion.v2";

export function Paper() {
  const { timeline: t } = useScene();
  const a = curve(BG.curves.paper as [string, number, number][], gNow(t));
  if (a <= 0.001) return null;
  const { edgeY, feather, color } = BG.paper;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: -400,
        top: -400,
        width: 1536 + 800,
        height: edgeY + 400,
        zIndex: Z.paper,
        opacity: a,
        background: `linear-gradient(to bottom, ${color} 0, ${color} calc(100% - ${feather}px), rgba(247,238,221,0) 100%)`,
      }}
    />
  );
}

export function HallwayBackdrop() {
  const { timeline: t } = useScene();
  const a = curve(BG.curves.hallway as [string, number, number][], gNow(t));
  if (a <= 0.001) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[5] grid place-items-end justify-items-start p-6"
      style={{ opacity: a, background: "repeating-linear-gradient(135deg, #efe4d0 0 18px, #e8dcc6 18px 19px)" }}
    >
      <span className="rounded bg-white/70 px-2 py-1 font-mono text-[12px] text-[#5b4632]">{BG.hallway.label}（{BG.hallway.status}）</span>
    </div>
  );
}
