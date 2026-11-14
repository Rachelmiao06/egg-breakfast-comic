"use client";
/**
 * "切菜"一屏的静态漫画版式（feat/scroll-motion-demo，构图确认稿）。
 * 构图确认前：不滚动、不停留、不加滚动动效。厨房照常活着（蛋在锅里跳、火苗、油泡），只是不被滚动驱动。
 *
 * 版式在 1440×900 的画板上按像素摆放，整体等比缩放到视口（16:10 时 1440×900 与 1280×800 构图完全一致）。
 * 厨房仍是全屏 cover，用 <KitchenScene camera> 把锅和跳蛋推到画面左侧，让漫画格落在右侧，二者不叠。
 */
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { ZCOOL_KuaiLe } from "next/font/google";
import KitchenCharacters from "@/components/kitchen/KitchenCharacters";
import KitchenScene from "@/components/kitchen/KitchenScene";
import type { StageFocus } from "@/components/SceneStage";
import { beatById, type Beat } from "@/lib/beats";
import { MOM_PANELS } from "@/lib/scene";
import { SceneProvider } from "@/lib/scene-context";
import { Bubble, HandFrame, INK, PaperBlob } from "./comic-parts";

const hand = ZCOOL_KuaiLe({ weight: "400", subsets: ["latin"], preload: false, display: "swap" });

/** 画板尺寸（设计稿像素） */
const ART_W = 1440;
const ART_H = 900;

/**
 * 只用"切菜"这一段，弱化压到很轻（0.25；main 的 KitchenScene 下 ≈ 调暗 1.5%、模糊 0.1px）。
 * 不挂 ScrollDriver，时间轴停在本段开头：activePanel = 1，蛋按自己的循环跳。
 */
const CHOP_STILL: Beat[] = [{ ...beatById("chop"), kitchenDim: [0.25, 0.25, 0.25] }];

/**
 * 厨房取景：只推近 1.1 倍（为了有横向余量，蛋不至于大过妈妈），横向推到最右（场景右缘贴视口右缘），
 * 锅和跳蛋落在画面左侧约 0.15–0.55 宽度，漫画格在右侧，不叠在妈妈身后。纵向：锅和灶台前沿留在画内。
 */
const CAMERA: StageFocus = { x: 1500, y: 456, weight: 1, at: { x: 0.5, y: 0.5 }, zoom: 1.1 };

/** 占位文案（等正式对白） */
export const PLACEHOLDER_COPY = {
  narration: ["星期天的早上，", "妈妈在给我做荷包蛋拌饭。"],
  momLine: "先把胡萝卜切成小丁～",
  momLine2: "葱花也备好啦！",
  sfx: ["咚", "咚", "咚"],
};

/* ---------- 版式（画板像素） ---------- */
/** 主格：妈妈切菜中景，手绘细框 */
const MAIN = { x: 846, y: 40, w: 524, h: 590 };
const MAIN_IMG_H = 556; // 图高；宽按原始比例 494:555 算
/** 近景：刀与食材（public/assets/demo/chop-closeup.webp，400×168，从 chop.webp 砧板区裁出），放大 1.35 倍 */
const CLOSE = { src: "/assets/demo/chop-closeup.webp", w: 400, h: 168, scale: 1.35, x: 742, y: 652 };

function ComicPage() {
  const m = MOM_PANELS.chop;
  const imgW = (MAIN_IMG_H * m.w) / m.h;
  const cw = CLOSE.w * CLOSE.scale;
  const ch = CLOSE.h * CLOSE.scale;
  return (
    <div className={`${hand.className} absolute left-0 top-0`} style={{ width: ART_W, height: ART_H, color: INK }}>
      {/* 手写旁白：贴在厨房墙面上的一小片不规则留白，不加框 */}
      <div className="absolute" style={{ left: 54, top: 40, width: 390, height: 104, rotate: "-2deg" }}>
        <PaperBlob w={390} h={104} seed={11} opacity={0.94} style={{ left: 0, top: 0 }} />
        <div className="absolute inset-0 grid content-center px-7 text-[25px] leading-[1.45]">
          {PLACEHOLDER_COPY.narration.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
      </div>

      {/* 主格：中景，完整动作和道具；图保持原比例，底边贴近框底（砧板压在框线上方一点） */}
      <HandFrame w={MAIN.w} h={MAIN.h} seed={3} style={{ left: MAIN.x, top: MAIN.y, rotate: "-0.6deg" }}>
        {/* 格子里的背景：很淡的墙面色块，和厨房本体区分开 */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #f9eedd 0%, #fbf3e4 62%, #f3e2c8 100%)" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={m.src}
          alt="妈妈在砧板上切胡萝卜和葱花"
          draggable={false}
          className="absolute select-none"
          style={{ left: (MAIN.w - imgW) / 2, top: MAIN.h - MAIN_IMG_H + 4, width: imgW, height: MAIN_IMG_H }}
        />
      </HandFrame>

      {/* 妈妈的对白：气泡压出主格左边框，伸进厨房那一侧 */}
      <Bubble box={{ x: 690, y: 92, w: 316, h: 112 }} tail={{ x: 1022, y: 248 }} seed={5}>
        {PLACEHOLDER_COPY.momLine}
      </Bubble>

      {/* 近景格：刀与食材。不套框，用不规则留白托底，画面四周柔化融进留白 */}
      <PaperBlob w={cw + 70} h={ch + 44} seed={21} style={{ left: CLOSE.x - 38, top: CLOSE.y - 22, rotate: "1.2deg" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={CLOSE.src}
        alt="近景：刀切胡萝卜丁，旁边是葱花"
        draggable={false}
        className="absolute select-none"
        style={{
          left: CLOSE.x,
          top: CLOSE.y,
          width: cw,
          height: ch,
          rotate: "1.2deg",
          maskImage: "radial-gradient(ellipse 58% 62% at 50% 56%, #000 72%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 58% 62% at 50% 56%, #000 72%, transparent 100%)",
        }}
      />

      {/* 拟声：刀落砧板。压在近景留白的左上角、斜向刀口，奶油色描边保证可读 */}
      <div className="absolute" style={{ left: 712, top: 606, width: 170, height: 120 }}>
        {PLACEHOLDER_COPY.sfx.map((c, i) => (
          <span
            key={i}
            className="absolute font-normal"
            style={
              {
                left: i * 46,
                top: i * 26,
                fontSize: 46 - i * 6,
                rotate: `${-12 + i * 6}deg`,
                color: "#d9534f",
                WebkitTextStroke: "7px #fbf3e4",
                paintOrder: "stroke fill",
              } as CSSProperties
            }
          >
            {c}
          </span>
        ))}
      </div>

      {/* 第二句：小气泡，尾巴指回主格里的妈妈（画外音） */}
      <Bubble box={{ x: 1196, y: 650, w: 196, h: 74 }} tail={{ x: 1178, y: 606 }} seed={9} fontSize={23}>
        {PLACEHOLDER_COPY.momLine2}
      </Bubble>
    </div>
  );
}

/** 画板等比缩放到视口（contain），居中 */
function ArtboardFit({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setK(Math.min(width / ART_W, height / ART_H));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2"
        style={{ width: ART_W, height: ART_H, transform: `translate(-50%, -50%) scale(${k})`, visibility: k ? "visible" : "hidden" }}
      >
        {children}
      </div>
    </div>
  );
}

/** 调试面板：只在 URL 带 ?debug=1 或按 D 键时显示 */
const noop = () => () => {};
const subscribeResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};
function DebugPanel() {
  const urlDebug = useSyncExternalStore(noop, () => new URLSearchParams(window.location.search).get("debug") === "1", () => false);
  const vp = useSyncExternalStore(subscribeResize, () => `${window.innerWidth}×${window.innerHeight}`, () => "");
  const [toggled, setToggled] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "d" || e.key === "D") && !e.metaKey && !e.ctrlKey && !e.altKey) setToggled((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (urlDebug === toggled) return null;
  return (
    <div className="fixed bottom-3 left-3 z-50 w-[320px] rounded-lg bg-ink/85 p-3 font-mono text-[11px] leading-5 text-cream">
      <div className="font-bold">切菜一屏 · 构图稿（按 D 开关）</div>
      <div>视口 {vp} · 画板 1440×900 等比缩放</div>
      <div>
        厨房镜头 zoom {CAMERA.zoom} · 焦点 ({CAMERA.x}, {CAMERA.y}) · 弱化 0.25
      </div>
      <div>主格 {MAIN.w}×{MAIN.h} @ ({MAIN.x}, {MAIN.y}) · 图高 {MAIN_IMG_H}</div>
      <div>
        近景 {CLOSE.w}×{CLOSE.h} ×{CLOSE.scale} @ ({CLOSE.x}, {CLOSE.y})
      </div>
      <div className="mt-1 text-cream/70">占位文案：{[...PLACEHOLDER_COPY.narration, PLACEHOLDER_COPY.momLine, PLACEHOLDER_COPY.momLine2].join(" / ")}</div>
    </div>
  );
}

export default function ChopScreen() {
  return (
    <SceneProvider initialBeats={CHOP_STILL}>
      <div className="fixed inset-0 z-0">
        <KitchenScene camera={CAMERA}>
          <KitchenCharacters />
        </KitchenScene>
      </div>
      <ArtboardFit>
        <ComicPage />
      </ArtboardFit>
      <DebugPanel />
    </SceneProvider>
  );
}
