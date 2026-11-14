"use client";
/**
 * 滚动流程预览页 /dev/comic/flow（comic-scroll 分支自己维护；/dev/comic 现在是静态漫画页版式预览）：
 * 厨房 fixed 在底层（KitchenScene 自己做弱化和镜头），MomForeground 走它的 foreground 插槽，
 * 前景漫画 fixed 在上面；页面长度和节奏只由 <ScrollDriver> + 节拍表决定。
 * 角落 HUD 显示 timeline（段 / p / 阶段 / 阶段进度）和推导出的 progress / activePanel / flight / serve，
 * 场景层画小十字：spatulaLand（铲面落点）、bowlLand / bowlCenter（碗）、panLaunch（起跳点）。
 * 这里没有蛋本体（主会话的 <Egg>），只验证画格显隐、妈妈摆放和状态值。
 */
import ScrollDriver from "@/components/ScrollDriver";
import ComicScroll from "@/components/comic/ComicScroll";
import MomForeground from "@/components/comic/MomForeground";
import KitchenScene from "@/components/kitchen/KitchenScene";
import { ANCHORS } from "@/lib/scene";
import { SceneProvider, useScene } from "@/lib/scene-context";

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
  const { timeline: t, progress, activePanel, flight, serve } = useScene();
  const fmt = (v: number | null) => (v === null ? "null" : v.toFixed(2));
  return (
    <div data-hud className="fixed right-3 top-3 z-50 rounded bg-ink/85 px-3 py-2 font-mono text-xs leading-5 text-cream">
      <div>
        beat {t.index} {t.beat.id} p {t.p.toFixed(2)}
      </div>
      <div>
        phase {t.phase} {t.phaseP.toFixed(2)}
      </div>
      <div>progress {progress.toFixed(2)}</div>
      <div>activePanel {activePanel}</div>
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
      <ComicScroll />
      <ScrollDriver />
      <Hud />
    </SceneProvider>
  );
}
