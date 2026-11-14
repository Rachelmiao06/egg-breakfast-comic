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
import { cameraAt, depthAt, VISUAL_BEATS } from "./beats.visual";
import { HallwayBackdrop, Paper } from "./Backdrops";
import { BG, cameraV2, depthFromCamera, gNow, V2_BEATS } from "./motion.v2";
import ComicLayer from "./ComicLayer";
import ScenePanels from "./ScenePanels";
import { DEFAULT_SLOTS, eggAnchorsFrom, landPoint, SlotContext, useSlots, type SlotConfig } from "./slots";
import { useViewport } from "./viewport";

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

/** URL 参数：?motion=v1 旧版，默认新版；?clean=1 隐藏切换按钮（录屏用） */
function useParam(name: string) {
  return useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
}

function MotionToggle({ v2 }: { v2: boolean }) {
  const go = (m: string) => {
    const u = new URL(window.location.href);
    u.searchParams.set("motion", m);
    window.location.href = u.toString(); // 重新加载，从同一滚动起点开始
  };
  return (
    <div className="fixed left-3 top-3 z-50 flex overflow-hidden rounded-full bg-white/80 font-mono text-[11px] text-[#5b4632] shadow ring-1 ring-black/10">
      <button type="button" onClick={() => go("v1")} className={`px-3 py-1 ${!v2 ? "bg-[#5b4632] text-white" : ""}`}>旧版</button>
      <button type="button" onClick={() => go("v2")} className={`px-3 py-1 ${v2 ? "bg-[#5b4632] text-white" : ""}`}>新版</button>
    </div>
  );
}

function StageV2() {
  const { timeline: t, flight } = useScene();
  const { cfg } = useSlots();
  const vp = useViewport();
  const debug = useParam("debug") !== null;
  const clean = useParam("clean") !== null;
  const g = gNow(t);
  const anchors = { ...eggAnchorsFrom(cfg), tableWait: vp.portrait ? BG.anchors.portraitTableWait : BG.anchors.tableWait, eggAtTable: BG.anchors.eggAtTable };
  // 接蛋动作阶段：镜头轻微跟随蛋（蛋位置按同一套锚点估算）
  let eggPt: { x: number; y: number } | null = null;
  if (t.beat.egg === "flight" && flight !== null && flight < 1) {
    const A = anchors.tableWait, B = anchors.spatulaLand!;
    eggPt = { x: A.x + (B.x - A.x) * flight, y: A.y + (B.y - A.y) * flight - 300 * Math.sin(Math.PI * flight) };
  }
  const cam = cameraV2(g, eggPt);
  return (
    <>
      <div className="fixed inset-0 z-0">
        <KitchenScene
          direct
          camera={{ x: cam.x, y: cam.y, weight: 1, zoom: cam.zoom, at: cam.at }}
          depth={depthFromCamera(cam)}
          foreground={
            <>
              <Paper />
              <ScenePanels debug={debug} flow />
            </>
          }
        >
          <KitchenCharacters eggAnchors={anchors} direct />
        </KitchenScene>
      </div>
      <HallwayBackdrop />
      <ComicLayer flow />
      <ScrollDriver smooth />
      <SoundToggle />
      <ScrollHint />
      {!clean && <MotionToggle v2 />}
      {debug && <Debug />}
    </>
  );
}

function Stage() {
  const { timeline: t } = useScene();
  const { cfg } = useSlots();
  const cam = cameraAt(t.index, t.phase, t.phaseP);
  const depth = depthAt(t.index, t.phase, t.phaseP);
  const debug = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).has("debug"),
    () => false,
  );
  return (
    <>
      <div className="fixed inset-0 z-0">
        <KitchenScene camera={{ x: cam.x, y: cam.y, weight: 1, zoom: cam.zoom, at: cam.at }} depth={depth} foreground={<ScenePanels debug={debug} />}>
          <KitchenCharacters eggAnchors={eggAnchorsFrom(cfg)} />
        </KitchenScene>
      </div>
      <ComicLayer />
      <ScrollDriver />
      <SoundToggle />
      <ScrollHint />
      {debug && <Debug />}
      {debug && <AnchorEditor />}
      {useParam("clean") === null && <MotionToggle v2={false} />}
    </>
  );
}

function Versioned() {
  const v1 = useParam("motion") === "v1";
  return v1 ? (
    <SceneProvider key="v1" initialBeats={VISUAL_BEATS}>
      <Stage />
    </SceneProvider>
  ) : (
    <SceneProvider key="v2" initialBeats={V2_BEATS}>
      <StageV2 />
    </SceneProvider>
  );
}

/** 竖屏手机：接蛋格缩到可见宽度内，落点随格子一起算，所以蛋仍落在铲面上 */
function mobileSlots(cfg: SlotConfig, vw: number, vh: number, centerX = 700, zoom = 1): SlotConfig {
  const c = cfg.scene.catch;
  const visW = (1024 * (vw / vh)) / zoom; // 竖屏时舞台按高度铺满，可见的场景宽度
  const w = Math.round(visW * 0.94);
  const h = Math.round((w * c.box[3]) / c.box[2]);
  const k = w / c.box[2]; // 格子缩小多少，铲面上的蛋也按比例缩小（交接格随之对齐）
  return { ...cfg, egg: { ...cfg.egg, onSpatulaScale: cfg.egg.onSpatulaScale * k }, scene: { ...cfg.scene, catch: { ...c, box: [Math.round(centerX - w / 2), Math.round(640 - h * 0.35), w, h] } } };
}

export default function VisualPreviewPage() {
  const [base, setCfg] = useState<SlotConfig>(DEFAULT_SLOTS);
  const vp = useViewport();
  const v1 = useParam("motion") === "v1";
  // 新版接蛋镜头焦点约 x 620、zoom 1.08（backgrounds.json camera.keys）
  const cfg = vp.portrait ? (v1 ? mobileSlots(base, vp.w, vp.h) : mobileSlots(base, vp.w, vp.h, 625, 1.08)) : base;
  return (
    <SlotContext.Provider value={{ cfg, setCfg }}>
      <Versioned />
    </SlotContext.Provider>
  );
}
