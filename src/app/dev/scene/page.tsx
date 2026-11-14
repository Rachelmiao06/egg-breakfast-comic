"use client";
/**
 * feat/kitchen-scene 预览页：干净底图 + 全部角色层 + 声音按钮 + 滚动提示。
 * 左下角的调试滑块只在这个预览页里，用来模拟 comic-scroll 写入的 progress / flight。
 */
import { useState } from "react";
import KitchenCharacters from "@/components/kitchen/KitchenCharacters";
import KitchenScene from "@/components/kitchen/KitchenScene";
import ScrollHint from "@/components/kitchen/ScrollHint";
import SoundToggle from "@/components/kitchen/SoundToggle";
import { ANCHORS, Z } from "@/lib/scene";
import { SceneProvider, useScene } from "@/lib/scene-context";

/** 开发标记：前景妈妈预留区和锅铲落点（真正的 MomForeground 由 comic-scroll 提供）。 */
function SpatulaMarker() {
  const { flight } = useScene();
  const [x0, y0, x1, y1] = ANCHORS.momZone;
  if (flight === null) return null;
  return (
    <div className="pointer-events-none absolute" style={{ left: x0, top: y0, width: x1 - x0, height: y1 - y0, zIndex: Z.mom }}>
      <div className="absolute inset-0 rounded-3xl border-4 border-dashed border-ink/40 bg-cream/40" />
      <span className="absolute right-6 bottom-6 font-mono text-2xl text-ink/60">占位：妈妈的手臂和锅铲</span>
      <div
        className="absolute h-4 w-40 -translate-x-1/2 rounded-full bg-ink/40"
        style={{ left: ANCHORS.spatulaLand.x - x0, top: ANCHORS.spatulaLand.y - y0 }}
      />
    </div>
  );
}

function DebugPanel() {
  const { progress, setProgress, flight, setFlight } = useScene();
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="fixed bottom-5 left-5 z-50 rounded-full bg-cream/70 px-3 py-1 font-mono text-xs text-ink/60 ring-1 ring-ink/10">
        debug
      </button>
    );
  return (
    <div className="fixed bottom-5 left-5 z-50 w-64 space-y-2 rounded-xl bg-cream/90 p-3 font-mono text-xs text-ink shadow ring-1 ring-ink/15">
      <label className="block">
        progress {progress.toFixed(2)}
        <input type="range" min={0} max={1} step={0.01} value={progress} onChange={(e) => setProgress(+e.target.value)} className="w-full" />
      </label>
      <label className="block">
        flight {flight === null ? "null（循环跳）" : flight.toFixed(2)}
        <input type="range" min={-0.05} max={1} step={0.01} value={flight ?? -0.05} onChange={(e) => setFlight(+e.target.value < 0 ? null : +e.target.value)} className="w-full" />
      </label>
      <button type="button" onClick={() => setOpen(false)} className="text-ink/50 underline">
        收起
      </button>
    </div>
  );
}

export default function DevScenePage() {
  return (
    <SceneProvider>
      <div className="fixed inset-0">
        <KitchenScene foreground={<SpatulaMarker />}>
          <KitchenCharacters />
        </KitchenScene>
      </div>
      <SoundToggle />
      <ScrollHint />
      <DebugPanel />
    </SceneProvider>
  );
}
