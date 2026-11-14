"use client";
import { useEffect, useRef, useState } from "react";
import KitchenScene from "@/components/kitchen/KitchenScene";
import KitchenLayers, { type KitchenLayerName } from "@/components/kitchen/KitchenLayers";
import { ANCHORS, SCENE_H, SCENE_W, Z, boxStyle } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";

const LAYERS: KitchenLayerName[] = ["back", "mid", "pan-rim", "front-toast", "front-right"];
/** measured by tools/split_scene.py: cooking-surface ellipse; its lower arc is the rim line */
const PAN_FLOOR = { cx: 743, cy: 579, rx: 398, ry: 77 };
/** suggested ANCHORS.panLaunch (see docs/tasks/kitchen-layers.md) */
const SUGGESTED_LAUNCH_Y = 670;

/** egg.webp standing in the skillet, moving with the mid layer via the published CSS vars */
function TestEgg({ y, hop, flying }: { y: number; hop: boolean; flying: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      const t = ((performance.now() - t0) / 1000) % 1.4;
      const h = hop ? Math.max(0, Math.sin((t / 1.4) * Math.PI * 2)) * 170 : 0;
      if (ref.current) ref.current.style.translate = `0 ${-h}px`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [hop]);
  const { w, h } = ANCHORS.eggSize;
  return (
    <div
      className="pointer-events-none absolute left-0 top-0"
      style={{
        zIndex: flying ? Z.eggFlying : Z.eggInPan,
        width: SCENE_W,
        height: SCENE_H,
        transform: "translate(var(--kl-mid-x, 0px), var(--kl-mid-y, 0px))",
      }}
    >
      <div ref={ref} className="absolute" style={{ left: ANCHORS.panLaunch.x - w / 2, top: y - h, width: w, height: h }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/scene/egg.webp" alt="" width={w} height={h} className="h-full w-full" />
      </div>
    </div>
  );
}

function MomZone() {
  return (
    <div className="pointer-events-none absolute" style={{ ...boxStyle(ANCHORS.momZone), zIndex: Z.mom }}>
      <div className="h-full w-full rounded-tl-[40px] border-4 border-dashed border-rose-500 bg-rose-300/25" />
      <span className="absolute left-4 top-3 rounded bg-rose-500 px-2 py-1 text-[22px] font-semibold text-white">
        占位：前景妈妈 + 锅铲（momZone）
      </span>
      <div
        className="absolute h-5 w-5 rounded-full border-4 border-rose-600 bg-white"
        style={{ left: ANCHORS.spatulaLand.x - ANCHORS.momZone[0] - 10, top: ANCHORS.spatulaLand.y - ANCHORS.momZone[1] - 10 }}
      />
    </div>
  );
}

function RimGuide({ launchY }: { launchY: number }) {
  const { cx, cy, rx, ry } = PAN_FLOOR;
  const pts = Array.from({ length: 41 }, (_, i) => {
    const x = cx - rx + (2 * rx * i) / 40;
    return `${x},${cy + ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2))}`;
  }).join(" ");
  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      width={SCENE_W}
      height={SCENE_H}
      style={{ zIndex: Z.eggFlying, transform: "translate(var(--kl-mid-x, 0px), var(--kl-mid-y, 0px))" }}
    >
      <polyline points={pts} fill="none" stroke="#dc2626" strokeWidth={3} strokeDasharray="10 6" />
      <circle cx={cx} cy={cy} r={7} fill="#2563eb" />
      <text x={cx + 12} y={cy - 8} fill="#2563eb" fontSize={18} fontWeight={700}>pan floor centre ({cx}, {cy})</text>
      <circle cx={ANCHORS.panLaunch.x} cy={launchY} r={7} fill="#16a34a" />
      <text x={ANCHORS.panLaunch.x + 12} y={launchY + 24} fill="#16a34a" fontSize={18} fontWeight={700}>
        launch ({ANCHORS.panLaunch.x}, {launchY})
      </text>
    </svg>
  );
}

export default function LayersPreview() {
  const { progress, setProgress, activePanel, setActivePanel } = useScene();
  const [launchY, setLaunchY] = useState(SUGGESTED_LAUNCH_Y);
  const [egg, setEgg] = useState(true);
  const [hop, setHop] = useState(false);
  const [flying, setFlying] = useState(false);
  const [toast, setToast] = useState(false);
  const [guides, setGuides] = useState(true);
  const [mom, setMom] = useState(true);
  const [hide, setHide] = useState<KitchenLayerName[]>([]);
  const toggle = (n: KitchenLayerName) => setHide((h) => (h.includes(n) ? h.filter((x) => x !== n) : [...h, n]));

  return (
    <div className="fixed inset-0 bg-[#2b2622]">
      <KitchenScene base={<KitchenLayers mouse showToast={toast} hide={hide} />} foreground={mom ? <MomZone /> : null}>
        {egg && <TestEgg y={launchY} hop={hop} flying={flying} />}
        {guides && <RimGuide launchY={launchY} />}
      </KitchenScene>

      <div className="absolute bottom-3 left-3 z-20 w-[310px] space-y-2 rounded-lg bg-white/90 p-3 text-[12px] text-stone-800 shadow-lg backdrop-blur">
        <div className="font-semibold">Kitchen layers v4 · dev</div>
        {(
          [
            ["progress", progress, setProgress, 0, 1, 0.01],
            ["activePanel", activePanel, setActivePanel, 0, 8, 1],
            ["launch y", launchY, setLaunchY, 600, 700, 1],
          ] as const
        ).map(([label, v, set, min, max, step]) => (
          <label key={label} className="flex items-center gap-2">
            <span className="w-20 shrink-0">{label}</span>
            <input aria-label={label} type="range" min={min} max={max} step={step} value={v}
              onChange={(e) => set(Number(e.target.value))} className="flex-1" />
            <span className="w-10 text-right tabular-nums">{step < 1 ? Number(v).toFixed(2) : v}</span>
          </label>
        ))}
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {(
            [
              ["egg", egg, setEgg],
              ["hop", hop, setHop],
              ["egg z=80", flying, setFlying],
              ["toast (retired)", toast, setToast],
              ["guides", guides, setGuides],
              ["mom zone", mom, setMom],
            ] as const
          ).map(([label, v, set]) => (
            <label key={label} className="flex items-center gap-1">
              <input type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-stone-300 pt-2">
          {LAYERS.map((n) => (
            <label key={n} className="flex items-center gap-1">
              <input type="checkbox" checked={!hide.includes(n)} onChange={() => toggle(n)} />
              {n}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
