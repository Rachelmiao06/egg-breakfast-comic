"use client";
/**
 * 可收起的读数面板（右下角）。速度、倾斜在 rAF 里直接写 textContent，不进 React state。
 * 另有"节拍长度：正式 / 建议"切换，用 setBeats 换成路由里的试调副本，仍由同一个 ScrollDriver 驱动。
 */
import { useEffect, useRef, useState } from "react";
import type { PinState, Timeline } from "@/lib/beats";
import { totalVh } from "@/lib/beats";
import { getScrollVelocity } from "@/lib/scroll-velocity";
import { useScene } from "@/lib/scene-context";
import { DEMO_BEATS, TUNED_BEATS } from "./motion";
import { getTilt } from "./VelocityTilt";

const PHASE_ZH = { enter: "进入", action: "动作", hold: "阅读停留", exit: "退出" } as const;
const GROUP_ZH = { prep: "📌 备菜", catch: "📌 跨景接蛋", bowl: "📌 饭碗结尾" } as const;

export default function Hud({ t, pin, zoom }: { t: Timeline; pin: PinState; zoom: number }) {
  const { flight, serve, beats, setBeats } = useScene();
  const [open, setOpen] = useState(true);
  const live = useRef<HTMLSpanElement>(null);
  const tuned = beats === TUNED_BEATS;

  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const loop = () => {
      if (live.current) {
        const sy = (window.scrollY / window.innerHeight) * 100;
        live.current.textContent = `scroll ${sy.toFixed(0)}vh · 速度 ${getScrollVelocity().toFixed(0)}vh/s · 倾斜 ${getTilt().toFixed(2)}°`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="fixed bottom-3 right-3 z-50 rounded-full bg-ink/80 px-3 py-1 font-mono text-[11px] text-cream">
        读数
      </button>
    );
  }
  const f = (v: number | null) => (v === null ? "null" : v.toFixed(2));
  return (
    <div className="fixed bottom-3 right-3 z-50 w-[300px] rounded-xl bg-ink/85 p-3 font-mono text-[11px] leading-5 text-cream shadow-lg">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-bold">停留式叙事小样</span>
        <button onClick={() => setOpen(false)} className="rounded px-1.5 hover:bg-cream/20">收起</button>
      </div>
      <div>
        段 {t.beat.n} · {t.beat.id} · p {t.p.toFixed(2)}
      </div>
      <div>
        阶段 {PHASE_ZH[t.phase]} {t.phaseP.toFixed(2)}
      </div>
      <div>
        {pin.group ? `${GROUP_ZH[pin.group]} · groupP ${pin.groupP.toFixed(2)}` : `流动 · ${pin.flowVh.toFixed(0)}vh${pin.releaseVh ? ` · 释放 ${pin.releaseVh.toFixed(0)}vh` : ""}`}
      </div>
      <div>
        镜头 zoom {zoom.toFixed(3)} · flight {f(flight)} · serve {f(serve)}
      </div>
      <div>
        <span ref={live} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span>节拍长度</span>
        <button onClick={() => setBeats(DEMO_BEATS)} className={`rounded px-1.5 ${!tuned ? "bg-cream text-ink" : "bg-cream/15"}`}>
          正式 {totalVh(DEMO_BEATS) - 100}vh
        </button>
        <button onClick={() => setBeats(TUNED_BEATS)} className={`rounded px-1.5 ${tuned ? "bg-cream text-ink" : "bg-cream/15"}`}>
          建议 {totalVh(TUNED_BEATS) - 100}vh
        </button>
      </div>
      <div className="mt-1 text-cream/60">（另加 100vh 小样释放段）</div>
    </div>
  );
}
