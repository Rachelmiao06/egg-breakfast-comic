"use client";
/** 节拍调节面板：时间轴、实时读数、音量条、每段长度调节和导出。改动只在本页生效，复制 JSON 后贴回 src/lib/beats.json。 */
import { useState } from "react";
import { BEATS, PHASES, loopLevels, pinState, totalVh, type Beat } from "@/lib/beats";
import { useScene } from "@/lib/scene-context";

const PHASE_COLOR: Record<string, string> = { enter: "#bfd9c4", action: "#f2c46d", hold: "#e9dcc4", exit: "#d9a59a" };
const PHASE_ZH: Record<string, string> = { enter: "进入", action: "动作", hold: "停留", exit: "退出" };

export default function TuningPanel() {
  const s = useScene();
  const { timeline: t, beats, setBeats } = s;
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const total = totalVh(beats);
  const levels = loopLevels(t, beats);
  const pin = pinState(t, beats);
  const PIN_ZH: Record<string, string> = { prep: "备菜", catch: "跨景接蛋", bowl: "饭碗结尾" };

  const setLen = (i: number, v: number) => setBeats(beats.map((b, j) => (j === i ? { ...b, lengthVh: v } : b)));
  const jumpTo = (i: number) => {
    const vh = beats.slice(0, i).reduce((a, b) => a + b.lengthVh, 0);
    window.scrollTo({ top: (vh / 100) * window.innerHeight + 2, behavior: "auto" });
  };
  const copy = async () => {
    const lengths = Object.fromEntries(beats.map((b) => [b.id, b.lengthVh]));
    const text = JSON.stringify({ lengthVh: lengths, totalVh: total }, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("复制下面的 JSON", text);
    }
  };

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="fixed right-4 top-4 z-50 rounded-full bg-cream/90 px-3 py-1 font-mono text-xs text-ink shadow ring-1 ring-ink/15">
        节拍表
      </button>
    );

  return (
    <aside className="fixed right-3 top-3 z-50 max-h-[calc(100vh-24px)] w-[380px] overflow-y-auto rounded-2xl bg-cream/95 p-3 font-mono text-[11px] text-ink shadow-xl ring-1 ring-ink/15">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-xs">统一节拍表 · 总长 {total}vh</strong>
        <button type="button" onClick={() => setOpen(false)} className="text-ink/50 underline">收起</button>
      </div>

      {/* 时间轴：段宽 ∝ 长度，段内四色 = 进入/动作/停留/退出 */}
      <div className="relative mb-1 flex h-6 w-full overflow-hidden rounded ring-1 ring-ink/20">
        {beats.map((b, i) => (
          <button key={b.id} type="button" title={`${b.n} ${b.title}`} onClick={() => jumpTo(i)} className="flex h-full border-r border-ink/30" style={{ width: `${(b.lengthVh / total) * 100}%` }}>
            {PHASES.map((ph) => (b.phases[ph] > 0 ? <span key={ph} style={{ width: `${b.phases[ph] * 100}%`, background: PHASE_COLOR[ph] }} /> : null))}
          </button>
        ))}
        <span className="pointer-events-none absolute top-0 h-full w-0.5 bg-strawberry" style={{ left: `${t.overall * 100}%` }} />
      </div>
      <div className="mb-1 flex h-1.5 w-full overflow-hidden rounded">
        {beats.map((b) => (
          <span key={b.id} title={b.pin ? `停留：${PIN_ZH[b.pin]}` : "流动"} style={{ width: `${(b.lengthVh / total) * 100}%`, background: b.pin ? "#6b4a2b" : "transparent" }} className="border-r border-cream" />
        ))}
      </div>
      <div className="mb-2 flex gap-2 text-[10px] text-ink/60">
        {PHASES.map((ph) => (
          <span key={ph} className="flex items-center gap-1"><i className="inline-block h-2 w-3 rounded-sm" style={{ background: PHASE_COLOR[ph] }} />{PHASE_ZH[ph]}</span>
        ))}
        <span className="flex items-center gap-1"><i className="inline-block h-1.5 w-3 rounded-sm bg-ink" />停留组</span>
        <span className="ml-auto">点色块跳到该段</span>
      </div>

      {/* 实时读数 */}
      <div className="mb-2 grid grid-cols-2 gap-x-3 gap-y-0.5 rounded-lg bg-paper/70 p-2">
        <span>节拍</span><span>{t.beat.n} · {t.beat.title}</span>
        <span>段内进度 p</span><span>{t.p.toFixed(3)}</span>
        <span>阶段</span><span>{PHASE_ZH[t.phase]} {t.phaseP.toFixed(2)}</span>
        <span>停留 / 流动</span><span>{pin.pinned ? `📌 ${PIN_ZH[pin.group!]} ${pin.groupP.toFixed(2)}` : `流动 ${pin.flowVh.toFixed(0)}vh`}</span>
        <span>厨房弱化</span><span>{s.progress.toFixed(2)}</span>
        <span>flight / serve</span><span>{s.flight === null ? "null" : s.flight.toFixed(2)} / {s.serve === null ? "null" : s.serve.toFixed(2)}</span>
        <span>声音</span><span>{s.soundOn ? "开" : "关（右下角开启）"}</span>
      </div>
      <div className="mb-2 space-y-0.5">
        {Object.entries(levels).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-14">{k}</span>
            <span className="h-1.5 flex-1 rounded bg-ink/10"><span className="block h-full rounded bg-ink/60" style={{ width: `${Math.min(1, v) * 100}%` }} /></span>
            <span className="w-8 text-right">{v.toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* 每段长度 */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-ink/60"><th>#</th><th>段</th><th className="w-[150px]">长度 vh</th><th>阶段比例</th></tr>
        </thead>
        <tbody>
          {beats.map((b: Beat, i) => (
            <tr key={b.id} className={i === t.index ? "bg-mint/40" : ""}>
              <td>{b.n}</td>
              <td className="pr-1">{b.id}</td>
              <td>
                <div className="flex items-center gap-1">
                  <input type="range" min={40} max={400} step={10} value={b.lengthVh} onChange={(e) => setLen(i, +e.target.value)} className="w-[95px]" aria-label={`${b.id} 长度`} />
                  <span className="w-8 text-right">{b.lengthVh}</span>
                </div>
              </td>
              <td className="text-[10px] text-ink/60">{PHASES.map((ph) => Math.round(b.phases[ph] * 100)).join("/")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={copy} className="rounded bg-ink px-2 py-1 text-cream">{copied ? "已复制" : "复制长度 JSON"}</button>
        <button type="button" onClick={() => setBeats(BEATS)} className="rounded px-2 py-1 ring-1 ring-ink/30">重置</button>
      </div>
      <p className="mt-2 text-[10px] leading-snug text-ink/60">先调长度（滚动手感、阅读停留够不够），再调 beats.json 里的 seconds。复制后发给集成会话或贴回 src/lib/beats.json 的 lengthVh。</p>
    </aside>
  );
}
