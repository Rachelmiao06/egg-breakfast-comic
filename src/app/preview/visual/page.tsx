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
import { flightPoint } from "@/components/kitchen/Egg";
import { SCENE_H, SCENE_W } from "@/lib/scene";
import ScrollHint from "@/components/kitchen/ScrollHint";
import SoundToggle from "@/components/kitchen/SoundToggle";
import { SceneProvider, useScene } from "@/lib/scene-context";
import { cameraAt, depthAt, VISUAL_BEATS } from "./beats.visual";
import { SearchBackdrop, Paper } from "./Backdrops";
import { BG, cameraV2, depthFromCamera, gNow, V2_BEATS } from "./motion.v2";
import ComicLayer from "./ComicLayer";
import { HEAR_CUE, usePerfEnabled } from "./PanelPerf";
import { eggAtTableFor, fitCatchForEgg, flightApexYFor, flightEaseXFor, tableWaitFor } from "./eggPath";
import ScenePanels from "./ScenePanels";
import { DEFAULT_SLOTS, eggAnchorsFrom, landPoint, SlotContext, useSlots, type SlotConfig, handoffShrinkFor, eggFacesFor } from "./slots";
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
  const debug = useParam("debug") !== null;
  const clean = useParam("clean") !== null;
  const g = gNow(t);
  const perfOn = usePerfEnabled();
  const anchors = {
    ...eggAnchorsFrom(cfg),
    // 桌沿等待点 = 起跳点：在铲面落点右侧（妈妈面朝右、锅铲向右伸，蛋从她右侧、铲面右上方飞来），按视口布局算（eggPath.ts）
    tableWait: tableWaitFor(cfg),
    eggAtTable: eggAtTableFor(cfg),
    // 环境段 tablecall：饭桌上的碗（后景会话提供碗；这里只给蛋的脚底点和大小）
    bowlLand: { x: BG.anchors.tableBowl.x, y: BG.anchors.tableBowl.y },
    eggInBowl: BG.anchors.eggInTableBowl,
    // 飞行最高点：格上框以下 25% 格高，短弧线从右侧越过格框落到铲面，不经过气泡和妈妈视线左侧（eggPath.ts）
    flightApexY: flightApexYFor(cfg),
    flightEaseX: flightEaseXFor(cfg), // 只在窄屏 narrowSlot = "below" 时为 true，默认 "right" 不变
    // 朝向：身体倒向左侧的妈妈，停在铲面上贴合铲面斜度（slots.json egg.onSpatulaTilt / flightLean）
    spatulaTilt: cfg.egg.onSpatulaTilt,
    flightLean: cfg.egg.flightLean,
    // 交接：回正的同时以脚底为轴缩到画里那颗蛋的外轮廓宽度（slots.json scene.handoff / egg）；交接格按缩小后的蛋黄摆放
    handoffShrink: handoffShrinkFor(cfg),
    // hear：与妈妈抬眼同一时刻触发的抬头一跳（PanelPerf HEAR_CUE）；蛋升到前景格右上方、她的视线里，再落回桌沿。表演关闭时不跳
    ...(perfOn
      ? { peek: { beat: "hear", start: HEAR_CUE.start, reset: HEAR_CUE.reset, leave: HEAR_CUE.leave, panelSelector: 'img[src*="/p3d"]', gazeFy: 0.12, margin: 14, rise: 0.8, hang: 0.22, fall: 0.5 } }
      : {}),
  };
  // 接蛋动作阶段：镜头轻微跟随蛋（与蛋读同一条飞行路径）
  let eggPt: { x: number; y: number } | null = null;
  if (t.beat.egg === "flight" && flight !== null && flight < 1) eggPt = flightPoint(anchors.tableWait, anchors.spatulaLand!, anchors.flightApexY, flight, 0.6, anchors.flightEaseX);
  // 环境段（蛋是主体）：镜头水平方向主要跟着蛋的站点，窄屏、竖屏也不会把蛋切出画面；进入和离开时按段内进度渐变
  let follow: number | undefined;
  const envEgg = t.beat.egg === "ready" ? anchors.tableWait : t.beat.egg === "inBowl" ? anchors.bowlLand : null;
  if (envEgg) {
    const w = t.phase === "enter" ? t.phaseP : t.phase === "exit" ? 1 - t.phaseP : 1;
    eggPt = { x: envEgg.x, y: envEgg.y - 120 };
    follow = 0.85 * (w * w * (3 - 2 * w));
  }
  const cam = cameraV2(g, eggPt, follow);
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
          <KitchenCharacters eggAnchors={anchors} eggFaces={eggFacesFor(cfg)} direct />
        </KitchenScene>
      </div>
      <SearchBackdrop />
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

/** 竖屏手机（旧版 v1）：接蛋格缩到可见宽度内，落点随格子一起算，所以蛋仍落在铲面上 */
function mobileSlots(cfg: SlotConfig, vw: number, vh: number, centerX = 700, zoom = 1): SlotConfig {
  const visW = (1024 * (vw / vh)) / zoom; // 竖屏时舞台按高度铺满，可见的场景宽度
  return fitCatchTo(cfg, centerX, visW);
}

/** 接蛋格缩到给定的可见宽度内并居中；铲面上的蛋按同样比例缩小（交接格随之对齐） */
function fitCatchTo(cfg: SlotConfig, centerX: number, visW: number): SlotConfig {
  const c = cfg.scene.catch;
  const w = Math.round(visW * 0.94);
  const h = Math.round((w * c.box[3]) / c.box[2]);
  const k = w / c.box[2];
  return { ...cfg, narrow: true, egg: { ...cfg.egg, onSpatulaScale: cfg.egg.onSpatulaScale * k }, scene: { ...cfg.scene, catch: { ...c, box: [Math.round(centerX - w / 2), Math.round(640 - h * 0.35), w, h] } } };
}

/**
 * 新版接蛋镜头（backgrounds.json camera.keys 里 catch 落定时的关键帧）下，视口里能看到的场景范围（场景像素）。
 * 算法与 SceneStage 相同：cover 缩放 × zoom，焦点放到 at，再夹住不露出画布外。
 */
function catchView(vw: number, vh: number) {
  const key = (BG.camera.keys as [string, number, number, number, number, number, number][]).find((k) => k[0] === "catch" && k[1] >= 0.8)!;
  const [, , fx, fy, zoom, ax, ay] = key;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const s = Math.max(vw / SCENE_W, vh / SCENE_H) * zoom;
  const x = clamp(vw * ax - fx * s, vw - SCENE_W * s, 0);
  const y = clamp(vh * ay - fy * s, vh - SCENE_H * s, 0);
  return { x0: -x / s, x1: (vw - x) / s, y0: -y / s, y1: (vh - y) / s };
}

/** 新版：接蛋格连同右侧的蛋位放得进接蛋镜头就保持原位，放不下就缩小、靠左、下缘贴桌面（eggPath.ts fitCatchForEgg）。交接格滑动也按这个可见范围 */
function fitSlotsV2(cfg: SlotConfig, vw: number, vh: number): SlotConfig {
  // 接蛋格右侧要留出桌沿上蛋的位置（蛋从妈妈右侧、铲面右上方飞来；格子在起跳前就已升起，会盖住格内的蛋）：见 eggPath.ts
  return fitCatchForEgg(cfg, catchView(vw, vh));
}

export default function VisualPreviewPage() {
  const [base, setCfg] = useState<SlotConfig>(DEFAULT_SLOTS);
  const vp = useViewport();
  const v1 = useParam("motion") === "v1";
  const cfg = v1 ? (vp.portrait ? mobileSlots(base, vp.w, vp.h) : base) : fitSlotsV2(base, vp.w, vp.h);
  return (
    <SlotContext.Provider value={{ cfg, setCfg }}>
      <Versioned />
    </SlotContext.Provider>
  );
}
