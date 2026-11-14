"use client";
/**
 * 厨房场景的组合入口（集成会话维护）。
 * 现在用整张原画当占位背景；feat/kitchen-layers 完成后换成 <KitchenLayers/>，
 * feat/kitchen-scene 的角色（蛋、影子、火苗、油泡、蒸汽）作为 children 放进来。
 */
import type { ReactNode } from "react";
import SceneStage from "@/components/SceneStage";
import { SCENE_H, SCENE_W } from "@/lib/scene";

export default function KitchenScene({ children }: { children?: ReactNode }) {
  return (
    <SceneStage>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/scene/poster.png"
        width={SCENE_W}
        height={SCENE_H}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 select-none"
      />
      {children}
    </SceneStage>
  );
}
