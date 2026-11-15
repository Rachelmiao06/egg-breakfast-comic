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
import { backgroundState, SearchBackdrop, Paper } from "../visual/Backdrops";
import ComicLayer from "../visual/ComicLayer";
import { eggAtTableFor, fitCatchForEgg, flightApexYFor, flightEaseXFor, tableWaitFor } from "../visual/eggPath";
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

/** 接蛋路径参考线：飞行路径（四个阶段的点）、气泡、铲面、妈妈眼睛和视线方向（都按当前视口的接蛋格算） */
function FlightGuides({ wait, apexY, easeX }: { wait: Pt; apexY: number; easeX: boolean }) {
  const { cfg } = useSlots();
  const box = cfg.scene.catch.box;
  const P = BG.eggPath.panel;
  const land = landPoint(cfg.scene.catch);
  const pts = Array.from({ length: 41 }, (_, i) => flightPoint(wait, land, apexY, i / 40, 0.6, easeX));
  const at = (f: number, g: number) => ({ x: box[0] + f * box[2], y: box[1] + g * box[3] });
  const eye = at(P.eye[0], P.eye[1]);
  const rect = (r: number[], color: string, label: string) => (
    <g>
      <rect x={box[0] + r[0] * box[2]} y={box[1] + r[2] * box[3]} width={(r[1] - r[0]) * box[2]} height={(r[3] - r[2]) * box[3]} fill="none" stroke={color} strokeWidth={4} strokeDasharray="10 6" />
      <text x={box[0] + r[0] * box[2] + 6} y={box[1] + r[3] * box[3] + 22} fill={color} fontSize={20} fontFamily="monospace">{label}</text>
    </g>
  );
  const stages: [number, string][] = [[0, "起跳"], [0.3, "越框"], [0.85, "下降"], [1, "落铲"]];
  return (
    <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1} style={{ zIndex: 96 }}>
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#c0392b" />
        </marker>
      </defs>
      {rect(P.bubble, "#8e44ad", "气泡（不可经过）")}
      {rect(P.blade, "#16a085", "铲面")}
      <line x1={box[0] + P.keepRightOf * box[2]} y1={box[1]} x2={box[0] + P.keepRightOf * box[2]} y2={box[1] + box[3]} stroke="#e67e22" strokeWidth={3} strokeDasharray="4 6" />
      <circle cx={eye.x} cy={eye.y} r={10} fill="#2c3e50" />
      <line x1={eye.x} y1={eye.y} x2={land.x - 40} y2={land.y - 20} stroke="#2c3e50" strokeWidth={3} strokeDasharray="12 8" markerEnd="url(#arr)" />
      <text x={eye.x + 14} y={eye.y - 14} fill="#2c3e50" fontSize={20} fontFamily="monospace">视线 →</text>
      <polyline points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="none" stroke="#c0392b" strokeWidth={5} markerEnd="url(#arr)" />
      {stages.map(([t, label]) => {
        const p = flightPoint(wait, land, apexY, t, 0.6, easeX);
        return (
          <g key={label}>
            <circle cx={p.x} cy={p.y} r={9} fill="#c0392b" />
            <text x={p.x + 14} y={p.y + 6} fill="#c0392b" fontSize={22} fontFamily="monospace" fontWeight="bold">{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** 镜头取景参考点（backgrounds.json cameraFrames，?frames=1）：备菜站点、L → 眼睛高度 → M → E 的弧线、R → C（铲面落点） */
function CameraFrameGuides() {
  const { cfg } = useSlots();
  const F = cfg.narrow ? BG.cameraFrames.portrait : BG.cameraFrames.landscape;
  const C = landPoint(cfg.scene.catch);
  const [L, M, E, R] = [F.L, F.M, F.E, F.R];
  const q = (a: number[], c: number[], b: number[]) => `M ${a[0]} ${a[1]} Q ${c[0]} ${c[1]} ${b[0]} ${b[1]}`;
  const dot = (p: number[], label: string, color: string) => (
    <g key={label}>
      <circle cx={p[0]} cy={p[1]} r={11} fill={color} />
      <text x={p[0] + 16} y={p[1] + 7} fill={color} fontSize={26} fontFamily="monospace" fontWeight="bold">{label}</text>
    </g>
  );
  return (
    <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1} style={{ zIndex: 97 }}>
      <line x1={0} y1={F.eyeY} x2={1536} y2={F.eyeY} stroke="#8e44ad" strokeWidth={2} strokeDasharray="10 8" />
      <text x={20} y={F.eyeY - 8} fill="#8e44ad" fontSize={20} fontFamily="monospace">妈妈眼睛高度（建议）</text>
      <path d={q(L, [L[0], M[1] - 80], M)} fill="none" stroke="#c0392b" strokeWidth={5} />
      <path d={q(M, [M[0] - 20, M[1] - 200], E)} fill="none" stroke="#c0392b" strokeWidth={5} strokeDasharray="14 8" />
      <path d={q(R, [R[0], C.y - 120], [C.x, C.y])} fill="none" stroke="#16a085" strokeWidth={5} />
      {F.stations.map((p, i) => dot(p, `站点${i + 1}`, "#2a7fd4"))}
      {dot(L, "L", "#c0392b")}
      {dot(M, "M", "#c0392b")}
      {dot(E, "E", "#c0392b")}
      {dot(R, "R", "#16a085")}
      {dot([C.x, C.y], "C", "#16a085")}
    </svg>
  );
}

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
      {cross(wait, "#c0392b", `桌沿等待 = 起跳 ${wait.x},${wait.y}${cfg.narrow ? "（窄布局）" : ""}`)}
      {cross(landPoint(cfg.scene.catch), "#16a085", "铲面落点")}
      {cross(A.tableBowl, "#2c3e50", `饭桌碗 ${A.tableBowl.x},${A.tableBowl.y}`)}
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
        后景 <b>{s.name}</b> · 纸面 {f(s.paper)} · 桌沿 {f(s.table)} · 饭桌下移 {s.lift.toFixed(0)} · 外围 {f(s.doorway)} 漂移 {s.drift.toFixed(2)}vw · 碗 {f(s.bowl)} · 厨房小角色 {f(s.reading)} · 收尾 {f(s.ending)}
      </div>
    </div>
  );
}

function Stage() {
  const { timeline: t, flight } = useScene();
  const { cfg } = useSlots();
  const fg = useParam("fg") !== "0";
  const guides = useParam("guides") !== null;
  const frames = useParam("frames") !== null;
  const clean = useParam("clean") !== null;
  const debug = useParam("debug") !== null;
  const g = gNow(t);
  const wait = tableWaitFor(cfg);
  const anchors = {
    ...eggAnchorsFrom(cfg),
    tableWait: wait,
    eggAtTable: eggAtTableFor(cfg),
    bowlLand: { x: BG.anchors.tableBowl.x, y: BG.anchors.tableBowl.y },
    eggInBowl: BG.anchors.eggInTableBowl,
    flightApexY: flightApexYFor(cfg),
    flightEaseX: flightEaseXFor(cfg), // 与 preview/visual/page.tsx 相同：只在窄屏 narrowSlot = "below" 时为 true
  };
  let eggPt: Pt | null = null;
  if (t.beat.egg === "flight" && flight !== null && flight < 1) eggPt = flightPoint(anchors.tableWait, anchors.spatulaLand!, anchors.flightApexY, flight, 0.6, anchors.flightEaseX);
  // 与 preview/visual/page.tsx 相同：环境段镜头跟随蛋的站点
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
              {fg && <ScenePanels debug={debug} flow />}
              {guides && <Guides wait={wait} />}
              {frames && <CameraFrameGuides />}
              {guides && <FlightGuides wait={wait} apexY={anchors.flightApexY} easeX={anchors.flightEaseX} />}
            </>
          }
        >
          <KitchenCharacters eggAnchors={anchors} direct />
        </KitchenScene>
      </div>
      <SearchBackdrop />
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

/** 与 preview/visual/page.tsx 的 fitSlotsV2 相同（接蛋格右侧留出蛋的位置） */
function fitSlotsV2(cfg: SlotConfig, vw: number, vh: number): SlotConfig {
  // 接蛋格右侧要留出桌沿上蛋的位置（蛋从妈妈右侧、铲面右上方飞来；格子在起跳前就已升起，会盖住格内的蛋）：见 eggPath.ts
  return fitCatchForEgg(cfg, catchView(vw, vh));
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
