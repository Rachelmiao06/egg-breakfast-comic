"use client";
/**
 * 页面层的前景漫画（完整静态图 / 占位格）。只读统一时间轴：
 * 进入阶段减速入场（power3.out），停留完全静止，退出加速离场（power2.in）。
 * 第 1 段用接缝遮罩小样（CSS mask），其他格按各自方向滑入，不统一淡入。
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useScene } from "@/lib/scene-context";
import { PANELS, type PanelSpec } from "./panels";

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

function SeamPanel({ spec, progress }: { spec: PanelSpec; progress: number }) {
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
        <Placeholder label={spec.label ?? ""} />
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

export default function ComicLayer() {
  const { timeline: t, beats } = useScene();
  const beat = beats[t.index];
  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {PANELS.filter((p) => p.beat === beat.id).map((p) => {
        let k = 1, opacity = 1;
        if (t.phase === "enter") k = out3(t.phaseP);
        if (t.phase === "exit") { k = 1; opacity = 1 - in2(t.phaseP); }
        const [dx, dy] = p.from === "seam" ? [0, 0] : offsetFor(p.from, k);
        const exitShift = t.phase === "exit" ? -in2(t.phaseP) * 10 : 0; // 退出时向上加速离开
        const style: CSSProperties = {
          left: `${p.x}vw`,
          top: `${p.y}vh`,
          width: `${p.w}vw`,
          aspectRatio: `${p.aspect}`,
          transform: `translate(${dx}vw, calc(${dy}vh + ${exitShift}vh))`,
          opacity: p.from === "seam" ? opacity : opacity * Math.min(1, k * 1.4),
        };
        const seamProgress = t.phase === "enter" ? t.phaseP : 1;
        return (
          <div key={p.key} className="absolute" style={style}>
            {p.kind === "img" && !p.frame && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.src} alt="" draggable={false} className="block h-full w-full select-none object-contain" />
            )}
            {p.kind === "img" && p.frame && (
              <div className="h-full w-full" style={{ background: "#fef4e5", padding: "6px" }}>
                <div className="h-full w-full" style={{ outline: "2.5px solid #2b2118", outlineOffset: "-2.5px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt="" draggable={false} className="block h-full w-full select-none object-cover" style={{ padding: "2.5px" }} />
                </div>
              </div>
            )}
            {p.kind === "head" && (
              <div className="relative h-full w-full overflow-hidden" style={{ background: "#d6eadd", outline: "2.5px solid #2b2118", outlineOffset: "-2.5px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt="" draggable={false} className="absolute bottom-0 left-1/2 h-[96%] w-auto max-w-none -translate-x-1/2 select-none" />
              </div>
            )}
            {p.kind === "ph" && (p.from === "seam" ? <SeamPanel spec={p} progress={seamProgress} /> : <Placeholder label={p.label ?? ""} />)}
          </div>
        );
      })}
    </div>
  );
}
