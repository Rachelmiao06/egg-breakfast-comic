"use client";
/** feat/kitchen-scene 预览页：临时去蛋底图 + 角色层。正式集成时由 KitchenScene 组合。 */
import SceneStage from "@/components/SceneStage";
import Egg from "@/components/kitchen/Egg";
import { SCENE_H, SCENE_W } from "@/lib/scene";
import { SceneProvider } from "@/lib/scene-context";

export default function DevScenePage() {
  return (
    <SceneProvider>
      <div className="fixed inset-0">
        <SceneStage>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/scene-draft/poster-noegg.jpg"
            width={SCENE_W}
            height={SCENE_H}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 select-none"
          />
          <Egg />
        </SceneStage>
      </div>
    </SceneProvider>
  );
}
