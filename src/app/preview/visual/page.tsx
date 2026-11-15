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
import { trajFoot } from "@/components/kitchen/Egg";
import { SCENE_H, SCENE_W } from "@/lib/scene";
import ScrollHint from "@/components/kitchen/ScrollHint";
import SoundToggle from "@/components/kitchen/SoundToggle";
import { SceneProvider, useScene } from "@/lib/scene-context";
import { cameraAt, depthAt, VISUAL_BEATS } from "./beats.visual";
import { SearchBackdrop, Paper } from "./Backdrops";
import { BG, cameraV2, depthFromCamera, gNow, gOf, V2_BEATS } from "./motion.v2";
import ComicLayer from "./ComicLayer";
import PaperFrameTexture from "./PaperFrameTexture";
import { HEAR_EVENT } from "./PanelPerf";
import { eggAtTableFor, fitCatchForEgg, flightApexYFor, flightEaseXFor, trajectoryFor, wanderTableFor } from "./eggPath";
import ScenePanels from "./ScenePanels";
import EggPoke from "./EggPoke";
import PanelHover from "./PanelHover";
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
  const vp = useViewport();
  // 备菜段桌面游走：左 / 中 / 右三个站点，夹在阅读镜头可见的桌面里（eggPath.ts wanderTableFor）；最后一个点 = hear 的高跳起跳点
  const tableAt = wanderTableFor(cfg, readingView(vp.w, vp.h));
  const anchors = {
    ...eggAnchorsFrom(cfg),
    tableAt,
    tableWait: tableAt.hear,
    eggAtTable: eggAtTableFor(cfg),
    ink: BG.anchors.eggInk, // 深棕黑描边，和背景里胡萝卜、葱的墨线一致
    // 高跳之后的空中站点：画面上缘之外、铲面右上方（接蛋时从这里落到铲面）
    // 高跳轨迹 P(s)：L（右侧桌面）→ M（妈妈视线相遇点）→ E（出画）→ R（铲面右上方、catch 取景上缘外）→ C（铲面接触点）（eggPath.trajectoryFor，docs/EGG-JUMP.md）
    traj: trajectoryFor(cfg, vp, camAt(gOf("hear", 0.6), vp.w, vp.h), catchView(vp.w, vp.h), tableAt.hear),
    // hear：前景表演开始（HEAR_EVENT start，与妈妈抬眼同一时刻）时蓄力 0.25 s，0.35 s 内冲出画面上缘；回到该段 beforeQ 之前才复位
    // 起跳表演：HEAR_EVENT start（与妈妈抬眼同一时刻）下蹲 0.15 s、上升 0.4 s 到 M；显示参数用 ω 18/s 的临界阻尼弹簧跟随；
    // hear 退出 q 0.85 → listen q 0.12 滚动把蛋从 M 带到 E（listen 停留 q 0.2 之前留出余量，快速拖过时弹簧也来得及把蛋带出画）
    // hear q 0.5 → 0.85 滚动把蛋从 L 带到 M（表演先到 M 时不起作用；没触发表演就快速拖过时，蛋提前离开 L）
    jump: { event: HEAR_EVENT, crouch: 0.15, rise: 0.4, omega: 18, mToE: [0.85, 0.12] as [number, number], lToM: 0.5 },
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
  };
  // 接蛋动作阶段：镜头轻微跟随蛋（与蛋读同一条飞行路径）
  let eggPt: { x: number; y: number } | null = null;
  if (t.beat.egg === "flight" && flight !== null && flight < 1) eggPt = trajFoot(anchors.traj, anchors.traj.sR + (1 - anchors.traj.sR) * flight);
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
      <EggPoke />
      <PanelHover />
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
      <EggPoke />
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

/** 备菜段（阅读）镜头下可见的场景范围：用于把游走站点夹在画面内的桌面上（算法同 SceneStage，读 chop 段中点的镜头） */
/** 某时刻（故事位置 g）的镜头：场景 → 屏幕 X = x · s + tx（算法同 SceneStage） */
function camAt(g: number, vw: number, vh: number) {
  const cam = cameraV2(g);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const s = Math.max(vw / SCENE_W, vh / SCENE_H) * cam.zoom;
  return { s, tx: clamp(vw * cam.at.x - cam.x * s, vw - SCENE_W * s, 0), ty: clamp(vh * cam.at.y - cam.y * s, vh - SCENE_H * s, 0) };
}

function readingView(vw: number, vh: number) {
  const cam = cameraV2(gOf("chop", 0.5));
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const s = Math.max(vw / SCENE_W, vh / SCENE_H) * cam.zoom;
  const x = clamp(vw * cam.at.x - cam.x * s, vw - SCENE_W * s, 0);
  const y = clamp(vh * cam.at.y - cam.y * s, vh - SCENE_H * s, 0);
  return { x0: -x / s, x1: (vw - x) / s, y0: -y / s, y1: (vh - y) / s, s };
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
      <PaperFrameTexture />
      <Versioned />
    </SlotContext.Provider>
  );
}
