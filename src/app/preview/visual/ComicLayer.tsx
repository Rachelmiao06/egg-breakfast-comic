"use client";
/**
 * 页面层的前景漫画（完整静态图 / 占位格）。只读统一时间轴：
 * 进入阶段减速入场（power3.out），停留完全静止，退出加速离场（power2.in）。
 * 第 1 段用接缝遮罩小样（CSS mask），其他格按各自方向滑入，不统一淡入。
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useScene } from "@/lib/scene-context";
import { PANELS, type PanelSlot as PanelSpec } from "./slots";

const out3 = (t: number) => 1 - Math.pow(1 - t, 3);
const in2 = (t: number) => t * t;

function offsetFor(from: PanelSpec["from"], k: number): [number, number] {
  const d = 1 - k; // 1 = 完全在画外方向
  switch (from) {
    case "left": return [-14 * d, 0];
    case "right": return [14 * d, 0];
    case "top": return [0, -16 * d];
    case "bottom": return [0, 18 * d];
    default: return [0, 0];
  }
}

export function Placeholder({ label, align = "center" }: { label: string; align?: "center" | "top" | "bottom" }) {
  const [title, ...rest] = label.split("\n");
  return (
    <div
      className={`flex h-full w-full flex-col items-center gap-1 px-4 text-center ${align === "top" ? "justify-start pt-[6%]" : align === "bottom" ? "justify-end pb-[6%]" : "justify-center"}`}
      style={{
        background: "repeating-linear-gradient(135deg, #fdf6ea 0 12px, #f4ead8 12px 13px)",
        outline: "2.5px solid #2b2118",
        outlineOffset: "-2.5px",
        color: "#5b4632",
        fontSize: "clamp(12px, 1.05vw, 16px)",
        lineHeight: 1.5,
      }}
    >
      <strong style={{ letterSpacing: "0.04em" }}>{title}</strong>
      {rest.map((l, i) => <span key={i}>{l}</span>)}
    </div>
  );
}

function SeamPanel({ children, progress }: { children: ReactNode; progress: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.getBoundingClientRect().width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 遮罩图宽 = 3 倍元素宽；毛边在遮罩 1.5W 处。progress 0 → 视窗在透明区；1 → 视窗在不透明区
  const pos = -(1 - progress) * 1.62 * w;
  const mask: CSSProperties = {
    WebkitMaskImage: "url(/assets/preview/seam-mask.png)",
    maskImage: "url(/assets/preview/seam-mask.png)",
    WebkitMaskSize: "300% 100%",
    maskSize: "300% 100%",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: `${pos}px 0`,
    maskPosition: `${pos}px 0`,
  };
  const showLine = progress > 0.01 && progress < 0.99;
  return (
    <div ref={ref} className="relative h-full w-full">
      <div className="h-full w-full" style={mask}>
        {children}
      </div>
      {showLine && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: "url(/assets/preview/seam-line.png)", backgroundSize: "300% 100%", backgroundRepeat: "no-repeat", backgroundPosition: `${pos}px 0` }}
        />
      )}
    </div>
  );
}

/** 图片的实际宽高比（加载后读取），换图后无需改版位 */
function useNaturalAspect(src: string | undefined, fallback: number) {
  const [ar, setAr] = useState<number | null>(null);
  useEffect(() => {
    if (!src) return;
    let alive = true;
    const img = new Image();
    img.onload = () => { if (alive && img.naturalHeight) setAr(img.naturalWidth / img.naturalHeight); };
    img.src = src;
    return () => { alive = false; };
  }, [src]);
  return ar ?? fallback;
}

function Panel({ p, k, opacity, exitShift, seamProgress }: { p: PanelSpec; k: number; opacity: number; exitShift: number; seamProgress: number }) {
  const aspect = useNaturalAspect(p.src, p.aspect);
  const [dx, dy] = p.from === "seam" ? [0, 0] : offsetFor(p.from, k);
  const style: CSSProperties = {
    left: `${p.x}vw`,
    top: `${p.y}vh`,
    width: `${p.w}vw`,
    aspectRatio: `${aspect}`,
    transform: `translate(${dx}vw, calc(${dy}vh + ${exitShift}vh))`,
    opacity: p.from === "seam" ? opacity : opacity * Math.min(1, k * 1.4),
  };
  const content = p.src ? (
    p.kind === "head" ? (
      <div className="relative h-full w-full overflow-hidden" style={{ background: "#d6eadd", outline: "2.5px solid #2b2118", outlineOffset: "-2.5px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.src} alt="" draggable={false} className="absolute bottom-0 left-1/2 h-[96%] w-auto max-w-none -translate-x-1/2 select-none" />
      </div>
    ) : p.frame ? (
      <div className="h-full w-full" style={{ background: "#fef4e5", padding: "6px" }}>
        <div className="h-full w-full" style={{ outline: "2.5px solid #2b2118", outlineOffset: "-2.5px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.src} alt="" draggable={false} className="block h-full w-full select-none object-cover" style={{ padding: "2.5px" }} />
        </div>
      </div>
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={p.src} alt="" draggable={false} className="block h-full w-full select-none object-contain" />
    )
  ) : (
    <Placeholder label={p.label ?? ""} />
  );
  return (
    <div className="absolute" style={style}>
      {p.from === "seam" ? <SeamPanel progress={seamProgress}>{content}</SeamPanel> : content}
    </div>
  );
}

export default function ComicLayer() {
  const { timeline: t, beats } = useScene();
  const beat = beats[t.index];
  const list = PANELS.filter((p) => p.beat === beat.id);
  const n = Math.max(1, list.length);
  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {list.map((p) => {
        // 进入阶段按 order 错开：每格占进入阶段的 1/n + 重叠，减速入场
        const i = p.order ?? 0;
        const span = n === 1 ? 1 : 0.62;
        const start = n === 1 ? 0 : (i * (1 - span)) / (n - 1);
        const local = t.phase === "enter" ? Math.min(1, Math.max(0, (t.phaseP - start) / span)) : 1;
        const k = out3(local);
        const opacity = t.phase === "exit" ? 1 - in2(t.phaseP) : 1;
        const exitShift = t.phase === "exit" ? -in2(t.phaseP) * 12 : 0; // 退出时加速向上离开
        const seamProgress = t.phase === "enter" ? local : 1;
        return <Panel key={p.key} p={p} k={k} opacity={opacity} exitShift={exitShift} seamProgress={seamProgress} />;
      })}
    </div>
  );
}
