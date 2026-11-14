"use client";
import { useEffect, useRef, useState } from "react";
import SceneStage from "@/components/SceneStage";
import KitchenLayers, { type KitchenLayerName } from "@/components/kitchen/KitchenLayers";
import { ANCHORS, SCENE_H, SCENE_W, boxStyle } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";

const LAYERS: KitchenLayerName[] = ["back", "mid", "main", "pan-rim", "front"];

/** Dev-only stand-in for the egg: a dashed outline that hops out of the pan, so the
 *  pan-rim occlusion can be checked without baking an egg into the environment. */
function EggProxy({ hop }: { hop: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      const t = ((performance.now() - t0) / 1000) % 1.6;
      const h = hop ? Math.max(0, Math.sin((t / 1.6) * Math.PI * 2)) * 230 : 0;
      if (ref.current) ref.current.style.transform = `translate(-50%, -100%) translateY(${-h}px)`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [hop]);
  const { x, y } = ANCHORS.eggRest;
  return (
    <div
      ref={ref}
      className="absolute rounded-[48%] border-[3px] border-dashed border-amber-500 bg-amber-200/70"
      style={{ left: x, top: y, width: 220, height: 190 }}
    />
  );
}

function Anchors() {
  const { cx, cy, rx, ry } = ANCHORS.panInner;
  const pts = Array.from({ length: 41 }, (_, i) => {
    const x = cx - rx + (2 * rx * i) / 40;
    const y = cy + ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
    return `${x},${y}`;
  }).join(" ");
  const box = (b: readonly [number, number, number, number], c: string, label: string) => (
    <div key={label} className="absolute border-2 border-dashed" style={{ ...boxStyle(b), borderColor: c }}>
      <span className="absolute -top-5 left-0 whitespace-nowrap text-[13px] font-semibold" style={{ color: c }}>
        {label}
      </span>
    </div>
  );
  return (
    <div className="pointer-events-none absolute inset-0">
      {box(ANCHORS.panBox, "#2563eb", "panBox")}
      {box(ANCHORS.panRimBox, "#dc2626", "panRimBox")}
      {box(ANCHORS.flameBox, "#ea580c", "flameBox")}
      {box(ANCHORS.toastBox, "#7c3aed", "toastBox")}
      <svg className="absolute inset-0" width={SCENE_W} height={SCENE_H}>
        <polyline points={pts} fill="none" stroke="#dc2626" strokeWidth={3} />
        <circle cx={ANCHORS.eggRest.x} cy={ANCHORS.eggRest.y} r={8} fill="#16a34a" />
        <text x={ANCHORS.eggRest.x + 12} y={ANCHORS.eggRest.y + 26} fill="#16a34a" fontSize={16} fontWeight={700}>
          eggRest / launch ({ANCHORS.eggRest.x}, {ANCHORS.eggRest.y})
        </text>
        <circle cx={ANCHORS.kettleSpout.x} cy={ANCHORS.kettleSpout.y} r={7} fill="#0891b2" />
      </svg>
    </div>
  );
}

export default function LayersPreview() {
  const { progress, setProgress } = useScene();
  const [dim, setDim] = useState(1);
  const [wash, setWash] = useState(0);
  const [drift, setDrift] = useState(60);
  const [push, setPush] = useState(0.05);
  const [mouse, setMouse] = useState(true);
  const [sway, setSway] = useState(true);
  const [flame, setFlame] = useState(true);
  const [proxy, setProxy] = useState(false);
  const [anchors, setAnchors] = useState(false);
  const [hide, setHide] = useState<KitchenLayerName[]>([]);

  const toggle = (n: KitchenLayerName) => setHide((h) => (h.includes(n) ? h.filter((x) => x !== n) : [...h, n]));

  return (
    <div className="fixed inset-0 bg-[#2b2622]">
      <SceneStage>
        <KitchenLayers
          mouse={mouse}
          sway={sway}
          dim={dim}
          wash={wash}
          drift={drift}
          push={push}
          hide={hide}
          inPan={
            <>
              {flame && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/assets/scene/flame.png" width={SCENE_W} height={SCENE_H} alt="" className="absolute inset-0" />
              )}
              {proxy && <EggProxy hop />}
            </>
          }
          aboveFront={anchors ? <Anchors /> : null}
        />
      </SceneStage>

      <div className="absolute bottom-3 left-3 z-20 w-[300px] space-y-2 rounded-lg bg-white/90 p-3 text-[12px] text-stone-800 shadow-lg backdrop-blur">
        <div className="font-semibold">Kitchen layers · dev</div>
        {(
          [
            ["progress", progress, setProgress, 0, 1, 0.01],
            ["dim", dim, setDim, 0, 1, 0.05],
            ["wash", wash, setWash, 0, 1, 0.05],
            ["drift px", drift, setDrift, -120, 120, 5],
            ["push", push, setPush, 0, 0.12, 0.01],
          ] as const
        ).map(([label, v, set, min, max, step]) => (
          <label key={label} className="flex items-center gap-2">
            <span className="w-16 shrink-0">{label}</span>
            <input
              aria-label={label}
              type="range"
              min={min}
              max={max}
              step={step}
              value={v}
              onChange={(e) => set(Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-10 text-right tabular-nums">{Number(v).toFixed(2)}</span>
          </label>
        ))}
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {(
            [
              ["mouse", mouse, setMouse],
              ["sway", sway, setSway],
              ["flame", flame, setFlame],
              ["egg proxy", proxy, setProxy],
              ["anchors", anchors, setAnchors],
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
