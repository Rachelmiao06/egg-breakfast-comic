"use client";
/**
 * 开发预览页（feat/comic-scroll 分支自己维护，可随意改）：
 * 厨房占位图固定在底层（按 progress 变暗，模拟集成后的效果），前景五段占位漫画在上面滚动，
 * 调试叠层标出后景蛋、接蛋点、飞行弧线和妈妈视线。
 */
import { useState } from "react";
import ComicScroll from "@/components/comic/ComicScroll";
import KitchenScene from "@/components/kitchen/KitchenScene";
import { SceneProvider, useScene } from "@/lib/scene-context";
import DebugOverlay from "./DebugOverlay";

function KitchenDim() {
  const { progress } = useScene();
  return <div aria-hidden className="pointer-events-none absolute inset-0 bg-ink" style={{ opacity: progress * 0.35 }} />;
}

export default function DevPage() {
  const [flight, setFlight] = useState(0);
  return (
    <SceneProvider>
      <div className="fixed inset-0 z-0">
        <KitchenScene />
        <KitchenDim />
      </div>
      <main className="relative z-10">
        <div className="h-screen" aria-hidden />
        <ComicScroll onFlightProgress={setFlight} />
      </main>
      <DebugOverlay flight={flight} />
    </SceneProvider>
  );
}
