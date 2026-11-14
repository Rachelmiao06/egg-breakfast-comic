"use client";
/**
 * 视觉方向预览（feat/visual-direction）。不改正式首页；仍用唯一的 <ScrollDriver> 和统一时间轴。
 * 前景：已有完整漫画 + 明确占位；场景层：接蛋格/饭碗格（与蛋同坐标）；后景：厨房分层 + 角色（真实时间循环）。
 * 调试读数默认隐藏，URL 加 ?debug=1 显示。
 */
import { useSyncExternalStore } from "react";
import ScrollDriver from "@/components/ScrollDriver";
import KitchenCharacters from "@/components/kitchen/KitchenCharacters";
import KitchenScene from "@/components/kitchen/KitchenScene";
import ScrollHint from "@/components/kitchen/ScrollHint";
import SoundToggle from "@/components/kitchen/SoundToggle";
import { SceneProvider, useScene } from "@/lib/scene-context";
import { cameraAt, VISUAL_BEATS } from "./beats.visual";
import ComicLayer from "./ComicLayer";
import ScenePanels from "./ScenePanels";

function Debug() {
  const { timeline: t, progress, flight, serve } = useScene();
  return (
    <div className="fixed bottom-3 left-3 z-50 rounded bg-black/70 px-2 py-1 font-mono text-[11px] text-white">
      {t.beat.n} {t.beat.id} · {t.phase} {t.phaseP.toFixed(2)} · p {t.p.toFixed(2)} · dim {progress.toFixed(2)} · flight {flight === null ? "–" : flight.toFixed(2)} · serve {serve === null ? "–" : serve.toFixed(2)}
    </div>
  );
}

function Stage() {
  const { timeline: t } = useScene();
  const cam = cameraAt(t.index, t.phase, t.phaseP);
  const debug = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).has("debug"),
    () => false,
  );
  return (
    <>
      <div className="fixed inset-0 z-0">
        <KitchenScene camera={{ x: cam.x, y: cam.y, weight: 1, zoom: cam.zoom, at: cam.at }} foreground={<ScenePanels />}>
          <KitchenCharacters />
        </KitchenScene>
      </div>
      <ComicLayer />
      <ScrollDriver />
      <SoundToggle />
      <ScrollHint />
      {debug && <Debug />}
    </>
  );
}

export default function VisualPreviewPage() {
  return (
    <SceneProvider initialBeats={VISUAL_BEATS}>
      <Stage />
    </SceneProvider>
  );
}
