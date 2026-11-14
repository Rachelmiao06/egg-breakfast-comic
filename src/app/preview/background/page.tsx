"use client";
/**
 * 后景预览（background-scenes 会话）：/preview/background
 * 和 /preview/visual 的新版（v2）同一套舞台：同一条时间轴、唯一的 <ScrollDriver smooth>、同一份镜头和蛋锚点，
 * 只是额外显示后景读数和参考线，方便单独检查后景的连续性。
 *   ?fg=0      隐藏前景漫画（ComicLayer + 场景内漫画格），只看后景 + 蛋
 *   ?guides=1  场景坐标参考线：锅 (720,670)、横 / 竖版桌沿等待点、桌面上沿 / 前缘线、铲面落点
 *   ?clean=1   隐藏读数（录屏用）
 *   ?debug=1   占位说明文字（Backdrops 自己读）
 * 不改任何前景、角色、声音或节拍文件；接蛋格的窄布局判定与 preview/visual/page.tsx 的 fitSlotsV2 相同（那里没导出，这里复刻）。
 */
import { useState, useSyncExternalStore } from "react";
import ScrollDriver from "@/components/ScrollDriver";
import KitchenCharacters from "@/components/kitchen/KitchenCharacters";
import KitchenScene from "@/components/kitchen/KitchenScene";
import { flightPoint } from "@/components/kitchen/Egg";
import { SCENE_H, SCENE_W } from "@/lib/scene";
import { SceneProvider, useScene } from "@/lib/scene-context";
import { backgroundState, HallwayBackdrop, Paper } from "../visual/Backdrops";
import ComicLayer from "../visual/ComicLayer";
import { BG, cameraV2, depthFromCamera, gNow, V2_BEATS } from "../visual/motion.v2";
import ScenePanels from "../visual/ScenePanels";
import { DEFAULT_SLOTS, eggAnchorsFrom, landPoint, SlotContext, useSlots, type SlotConfig } from "../visual/slots";
import { useViewport } from "../visual/viewport";

function useParam(name: string) {
  return useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
}

type Pt = { x: number; y: number };

function Guides({ wait }: { wait: Pt }) {
  const { cfg } = useSlots();
  const T = BG.table;
  const A = BG.anchors;
  const cross = (p: Pt, color: string, label: string, active = true) => (
    <div key={label} className="absolute" style={{ left: p.x, top: p.y, opacity: active ? 1 : 0.45 }}>
      <div className="absolute -left-5 top-0 h-[3px] w-10 -translate-y-1/2" style={{ background: color }} />
      <div className="absolute -top-5 left-0 h-10 w-[3px] -translate-x-1/2" style={{ background: color }} />
      <span className="absolute left-3 top-2 whitespace-nowrap font-mono text-[16px]" style={{ color }}>{label}</span>
    </div>
  );
  return (
    <div className="pointer-events-none absolute left-0 top-0 h-full w-full" style={{ zIndex: 95 }}>
      <div className="absolute" style={{ left: -232, width: 2000, top: T.topY, borderTop: "2px dashed #2a7fd4" }} />
      <div className="absolute" style={{ left: -232, width: 2000, top: T.edgeY, borderTop: "2px dashed #c0392b" }} />
      <span className="absolute font-mono text-[16px] text-[#2a7fd4]" style={{ left: 600, top: T.topY - 24 }}>桌面上沿 y {T.topY}</span>
      <span className="absolute font-mono text-[16px] text-[#c0392b]" style={{ left: 600, top: T.edgeY + 4 }}>桌沿前缘 y {T.edgeY}</span>
      {cross(A.panLaunch, "#8e44ad", `锅 ${A.panLaunch.x},${A.panLaunch.y}`)}
      {cross(A.tableWait, "#c0392b", `横版等待 / 起跳 ${A.tableWait.x},${A.tableWait.y}`, wait === A.tableWait)}
      {cross(A.portraitTableWait, "#d35400", `窄版等待 / 起跳 ${A.portraitTableWait.x},${A.portraitTableWait.y}`, wait === A.portraitTableWait)}
      {cross(landPoint(cfg.scene.catch), "#16a085", "铲面落点")}
    </div>
  );
}

function Hud({ narrow }: { narrow: boolean }) {
  const { timeline: t, flight } = useScene();
  const g = gNow(t);
  const s = backgroundState(g);
  const f = (n: number) => n.toFixed(2);
  return (
    <div data-hud className="fixed right-3 top-3 z-50 rounded bg-black/70 px-2 py-1 font-mono text-[11px] leading-4 text-white">
      <div>
        {t.beat.n} {t.beat.id} · p {f(t.p)} · g {f(g)} · egg {t.beat.egg} · flight {flight === null ? "–" : f(flight)} · {narrow ? "窄布局" : "横版"}
      </div>
      <div>
        后景 <b>{s.name}</b> · 纸面 {f(s.paper)} · 桌沿 {f(s.table)} · 饭桌上移 {s.lift.toFixed(0)} · 外围 {f(s.hallway)} 漂移 {s.drift.toFixed(2)}vw · 收尾 {f(s.ending)}
      </div>
    </div>
  );
}

function Stage() {
  const { timeline: t, flight } = useScene();
  const { cfg } = useSlots();
  const fg = useParam("fg") !== "0";
  const guides = useParam("guides") !== null;
  const clean = useParam("clean") !== null;
  const debug = useParam("debug") !== null;
  const g = gNow(t);
  const box = cfg.scene.catch.box;
  const wait = cfg.narrow ? BG.anchors.portraitTableWait : BG.anchors.tableWait;
  const anchors = {
    ...eggAnchorsFrom(cfg),
    tableWait: wait,
    eggAtTable: BG.anchors.eggAtTable,
    flightApexY: Math.round(box[1] - box[3] * 0.12),
  };
  let eggPt: Pt | null = null;
  if (t.beat.egg === "flight" && flight !== null && flight < 1) eggPt = flightPoint(anchors.tableWait, anchors.spatulaLand!, anchors.flightApexY, flight);
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
              {fg && <ScenePanels debug={debug} flow />}
              {guides && <Guides wait={wait} />}
            </>
          }
        >
          <KitchenCharacters eggAnchors={anchors} direct />
        </KitchenScene>
      </div>
      <HallwayBackdrop />
      {fg && <ComicLayer flow />}
      <ScrollDriver smooth />
      {!clean && <Hud narrow={!!cfg.narrow} />}
    </>
  );
}

/** 与 preview/visual/page.tsx 相同：接蛋落定镜头下的可见场景范围 */
function catchView(vw: number, vh: number) {
  const key = (BG.camera.keys as [string, number, number, number, number, number, number][]).find((k) => k[0] === "catch" && k[1] >= 0.8)!;
  const [, , fx, fy, zoom, ax, ay] = key;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const s = Math.max(vw / SCENE_W, vh / SCENE_H) * zoom;
  const x = clamp(vw * ax - fx * s, vw - SCENE_W * s, 0);
  const y = clamp(vh * ay - fy * s, vh - SCENE_H * s, 0);
  return { x0: -x / s, x1: (vw - x) / s, y0: -y / s, y1: (vh - y) / s };
}

function fitCatchTo(cfg: SlotConfig, centerX: number, visW: number): SlotConfig {
  const c = cfg.scene.catch;
  const w = Math.round(visW * 0.94);
  const h = Math.round((w * c.box[3]) / c.box[2]);
  const k = w / c.box[2];
  return { ...cfg, narrow: true, egg: { ...cfg.egg, onSpatulaScale: cfg.egg.onSpatulaScale * k }, scene: { ...cfg.scene, catch: { ...c, box: [Math.round(centerX - w / 2), Math.round(640 - h * 0.35), w, h] } } };
}

/** 与 preview/visual/page.tsx 的 fitSlotsV2 相同 */
function fitSlotsV2(cfg: SlotConfig, vw: number, vh: number): SlotConfig {
  const v = catchView(vw, vh);
  const [x, , w] = cfg.scene.catch.box;
  const margin = 12;
  const fitted = x >= v.x0 + margin && x + w <= v.x1 - margin ? cfg : fitCatchTo(cfg, (v.x0 + v.x1) / 2, v.x1 - v.x0);
  return { ...fitted, view: v };
}

export default function BackgroundPreviewPage() {
  const [base, setCfg] = useState<SlotConfig>(DEFAULT_SLOTS);
  const vp = useViewport();
  const cfg = fitSlotsV2(base, vp.w, vp.h);
  return (
    <SlotContext.Provider value={{ cfg, setCfg }}>
      <SceneProvider initialBeats={V2_BEATS}>
        <Stage />
      </SceneProvider>
    </SlotContext.Provider>
  );
}
