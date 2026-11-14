"use client";
/**
 * 厨房场景的组合入口（集成会话维护）。
 * - 底图：默认 <KitchenLayers mouse />（五层分层 + 锅沿遮挡 + 视差，kitchen-layers 交付）；可用 base 覆盖。
 * - children：feat/kitchen-scene 的角色层（蛋、影子、火苗、油、油泡、蒸汽）。
 * - 阅读弱化：随 progress 统一调暗、去饱和、轻微模糊，并盖一层纸色薄纱。厨房不退场，始终在背景里活动。
 *   飞行节拍（flight 非 null）时弱化退回到很轻，让整屏飞行发生在厨房里；
 *   镜头随飞行进度平移到前景锅铲；放进饭碗时（serve 非 null）对准饭碗中央。
 */
import type { ReactNode } from "react";
import SceneStage from "@/components/SceneStage";
import KitchenLayers from "@/components/kitchen/KitchenLayers";
import { ANCHORS } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";

export default function KitchenScene({ children, base, foreground }: { children?: ReactNode; base?: ReactNode; foreground?: ReactNode }) {
  const { progress, flight, serve } = useScene();
  // 接蛋飞行时弱化退回很轻；放进饭碗（serve）时由 comic-scroll 的 progress 决定，可以重新弱化突出前景
  const dim = flight !== null && serve === null ? Math.min(progress, 0.15) : progress;
  const f = flight ?? 0;
  const ease = (t: number) => t * t * (3 - 2 * t);
  const focus =
    serve !== null
      ? { x: ANCHORS.bowlCenter.x, y: ANCHORS.bowlCenter.y - 80, weight: 1, at: { x: 0.5, y: 0.62 } }
      : { x: ANCHORS.spatulaLand.x, y: ANCHORS.spatulaLand.y - 120, weight: ease(f), at: { x: 0.45, y: 0.62 } };
  return (
    <div
      className="relative h-full w-full transition-[filter] duration-300"
      style={{ filter: `brightness(${1 - 0.18 * dim}) saturate(${1 - 0.15 * dim}) blur(${1.5 * dim}px)` }}
    >
      <SceneStage focus={focus}>
        {base ?? <KitchenLayers mouse />}
        {children}
        {foreground}
      </SceneStage>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-paper" style={{ opacity: 0.35 * dim }} />
    </div>
  );
}
