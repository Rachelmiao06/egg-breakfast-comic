"use client";
/**
 * 厨房场景的组合入口（集成会话维护）。
 * - 底图：kitchen-clean.webp（无蛋、无火苗、无油）。feat/kitchen-layers 交付后换成 <KitchenLayers/>。
 * - children：feat/kitchen-scene 的角色层（蛋、影子、火苗、油、油泡、蒸汽）。
 * - 阅读弱化：随 progress 统一调暗、去饱和、轻微模糊，并盖一层纸色薄纱。厨房不退场，始终在背景里活动。
 *   飞行节拍（flight 非 null）时弱化退回到很轻，让整屏飞行发生在厨房里；
 *   同时镜头随飞行进度平移到前景锅铲，窄屏上锅铲也能完整入镜。
 */
import type { ReactNode } from "react";
import SceneStage from "@/components/SceneStage";
import { ANCHORS, SCENE_H, SCENE_W, Z } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";

export default function KitchenScene({ children, base, foreground }: { children?: ReactNode; base?: ReactNode; foreground?: ReactNode }) {
  const { progress, flight } = useScene();
  const dim = flight !== null ? Math.min(progress, 0.15) : progress;
  const f = flight ?? 0;
  const focus = { x: ANCHORS.spatulaLand.x, y: ANCHORS.spatulaLand.y - 140, weight: f * f * (3 - 2 * f), at: { x: 0.6, y: 0.6 } };
  return (
    <div
      className="relative h-full w-full transition-[filter] duration-300"
      style={{ filter: `brightness(${1 - 0.18 * dim}) saturate(${1 - 0.15 * dim}) blur(${1.5 * dim}px)` }}
    >
      <SceneStage focus={focus}>
        {base ?? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/assets/scene/kitchen-clean.webp"
            width={SCENE_W}
            height={SCENE_H}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 select-none"
            style={{ zIndex: Z.back }}
          />
        )}
        {children}
        {foreground}
      </SceneStage>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-paper" style={{ opacity: 0.35 * dim }} />
    </div>
  );
}
