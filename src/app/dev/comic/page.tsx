"use client";
/**
 * 开发预览页（comic-scroll 分支自己维护）：
 * 厨房 fixed 在底层（KitchenScene 自己做弱化和镜头），MomForeground 走它的 foreground 插槽，
 * 前景漫画在上面滚动。角落 HUD 显示 progress / activePanel / flight / serve，
 * 场景层画小十字：spatulaLand（铲面落点）、bowlLand / bowlCenter（碗）、panLaunch（起跳点）。
 * 这里没有蛋本体（主会话的 <Egg>），只验证节拍、状态值和妈妈摆放。
 */
import ComicScroll from "@/components/comic/ComicScroll";
import MomForeground from "@/components/comic/MomForeground";
import KitchenScene from "@/components/kitchen/KitchenScene";
import { ANCHORS } from "@/lib/scene";
import { SceneProvider, useScene } from "@/lib/scene-context";

const BEAT_NAMES = ["开场", "切配菜", "炒配菜", "调汁", "发现跳蛋", "伸锅铲", "接蛋", "放进饭碗", "结尾近景"];

function Cross({ x, y, label, color }: { x: number; y: number; label: string; color: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute" style={{ left: x, top: y, zIndex: 95 }}>
      <div className="absolute -left-4 -top-[2px] h-1 w-8" style={{ background: color }} />
      <div className="absolute -left-[2px] -top-4 h-8 w-1" style={{ background: color }} />
      <div className="absolute left-3 top-2 whitespace-nowrap rounded bg-black/60 px-1.5 py-0.5 text-[13px] font-bold text-white">
        {label} {x},{y}
      </div>
    </div>
  );
}

function AnchorCrosses() {
  return (
    <>
      <Cross x={ANCHORS.panLaunch.x} y={ANCHORS.panLaunch.y} label="panLaunch" color="#d9534f" />
      <Cross x={ANCHORS.spatulaLand.x} y={ANCHORS.spatulaLand.y} label="spatulaLand" color="#d9534f" />
      <Cross x={ANCHORS.bowlCenter.x} y={ANCHORS.bowlCenter.y} label="bowlCenter" color="#2a7fd4" />
      <Cross x={ANCHORS.bowlLand.x} y={ANCHORS.bowlLand.y} label="bowlLand" color="#2a7fd4" />
    </>
  );
}

function Hud() {
  const { progress, activePanel, flight, serve } = useScene();
  const fmt = (v: number | null) => (v === null ? "null" : v.toFixed(2));
  return (
    <div className="fixed right-3 top-3 z-50 rounded bg-ink/85 px-3 py-2 font-mono text-xs leading-5 text-cream">
      <div>progress {progress.toFixed(2)}</div>
      <div>
        activePanel {activePanel} {BEAT_NAMES[activePanel]}
      </div>
      <div>flight {fmt(flight)}</div>
      <div>serve {fmt(serve)}</div>
    </div>
  );
}

export default function DevPage() {
  return (
    <SceneProvider>
      <div className="fixed inset-0 z-0">
        <KitchenScene
          foreground={
            <>
              <MomForeground />
              <AnchorCrosses />
            </>
          }
        />
      </div>
      <main className="relative z-10">
        <div className="h-screen" aria-hidden />
        <ComicScroll />
      </main>
      <Hud />
    </SceneProvider>
  );
}
