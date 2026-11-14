"use client";
/**
 * 视觉方向预览（feat/visual-direction）。不改正式首页；仍用唯一的 <ScrollDriver> 和统一时间轴。
 * 前景：已有完整漫画 + 明确占位；场景层：接蛋格/饭碗格（与蛋同坐标）；后景：厨房分层 + 角色（真实时间循环）。
 * 调试读数默认隐藏，URL 加 ?debug=1 显示。
 */
import { useState, useSyncExternalStore } from "react";
import ScrollDriver from "@/components/ScrollDriver";
import KitchenCharacters from "@/components/kitchen/KitchenCharacters";
import KitchenScene from "@/components/kitchen/KitchenScene";
import ScrollHint from "@/components/kitchen/ScrollHint";
import SoundToggle from "@/components/kitchen/SoundToggle";
import { SceneProvider, useScene } from "@/lib/scene-context";
import { cameraAt, VISUAL_BEATS } from "./beats.visual";
import ComicLayer from "./ComicLayer";
import ScenePanels from "./ScenePanels";
import { DEFAULT_SLOTS, eggAnchorsFrom, landPoint, SlotContext, useSlots, type SlotConfig } from "./slots";

function Debug() {
  const { timeline: t, progress, flight, serve } = useScene();
  return (
    <div className="fixed bottom-3 left-3 z-50 rounded bg-black/70 px-2 py-1 font-mono text-[11px] text-white">
      {t.beat.n} {t.beat.id} · {t.phase} {t.phaseP.toFixed(2)} · p {t.p.toFixed(2)} · dim {progress.toFixed(2)} · flight {flight === null ? "–" : flight.toFixed(2)} · serve {serve === null ? "–" : serve.toFixed(2)}
    </div>
  );
}

/** 调试（?debug=1）：现场微调接蛋格位置和铲面落点，复制结果贴回 slots.json */
function AnchorEditor() {
  const { cfg, setCfg } = useSlots();
  const c = cfg.scene.catch;
  const set = (patch: Partial<typeof c>) => setCfg({ ...cfg, scene: { ...cfg.scene, catch: { ...c, ...patch } } });
  const num = (label: string, v: number, on: (n: number) => void, step = 1) => (
    <label className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <input type="number" step={step} value={v} onChange={(e) => on(+e.target.value)} className="w-20 rounded bg-white/90 px-1 text-black" />
    </label>
  );
  const lp = landPoint(c);
  return (
    <div className="fixed right-3 top-3 z-50 w-56 space-y-1 rounded bg-black/75 p-2 font-mono text-[11px] text-white">
      <div>接蛋格 / 铲面落点（场景像素）</div>
      {num("box x", c.box[0], (n) => set({ box: [n, c.box[1], c.box[2], c.box[3]] }))}
      {num("box y", c.box[1], (n) => set({ box: [c.box[0], n, c.box[2], c.box[3]] }))}
      {num("box w", c.box[2], (n) => set({ box: [c.box[0], c.box[1], n, Math.round(n * c.box[3] / c.box[2])] }))}
      {num("land fx", c.land.fx, (n) => set({ land: { ...c.land, fx: n } }), 0.005)}
      {num("land fy", c.land.fy, (n) => set({ land: { ...c.land, fy: n } }), 0.005)}
      {num("蛋缩放", cfg.egg.onSpatulaScale, (n) => setCfg({ ...cfg, egg: { ...cfg.egg, onSpatulaScale: n } }), 0.01)}
      <div>落点 = ({lp.x}, {lp.y})</div>
      <button type="button" className="pointer-events-auto rounded bg-white/20 px-2" onClick={() => navigator.clipboard?.writeText(JSON.stringify({ scene: cfg.scene, egg: cfg.egg }, null, 1))}>复制 JSON</button>
    </div>
  );
}

function Stage() {
  const { timeline: t } = useScene();
  const { cfg } = useSlots();
  const cam = cameraAt(t.index, t.phase, t.phaseP);
  const debug = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).has("debug"),
    () => false,
  );
  return (
    <>
      <div className="fixed inset-0 z-0">
        <KitchenScene camera={{ x: cam.x, y: cam.y, weight: 1, zoom: cam.zoom, at: cam.at }} foreground={<ScenePanels debug={debug} />}>
          <KitchenCharacters eggAnchors={eggAnchorsFrom(cfg)} />
        </KitchenScene>
      </div>
      <ComicLayer />
      <ScrollDriver />
      <SoundToggle />
      <ScrollHint />
      {debug && <Debug />}
      {debug && <AnchorEditor />}
    </>
  );
}

export default function VisualPreviewPage() {
  const [cfg, setCfg] = useState<SlotConfig>(DEFAULT_SLOTS);
  return (
    <SlotContext.Provider value={{ cfg, setCfg }}>
      <SceneProvider initialBeats={VISUAL_BEATS}>
        <Stage />
      </SceneProvider>
    </SlotContext.Provider>
  );
}
