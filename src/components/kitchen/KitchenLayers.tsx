"use client";
/**
 * Kitchen environment layers (kitchen-layers, design v3).
 *
 * Five 1536×1024 layers cut from source/kitchen-clean.png, rendered as siblings inside
 * <SceneStage> so they interleave with the character layers through the shared Z order:
 *   back (Z.back)        wall, tiles, back counter, yellow pot, jars, kettle
 *   mid (Z.mid)          wooden table, green stove, red skillet body + floor
 *   pan-rim (Z.panRim)   front lip + red outer wall of the skillet → hides the egg's feet
 *   front-left (Z.frontLeft)    toast plate
 *   front-right (Z.frontRight)  eggshells, gingham cloth; fades out at activePanel >= 4 for mom
 *
 * Motion (scene px, eased, frame-rate independent):
 * - mouse parallax: front ±10, mid + pan-rim ±5 (identical values), back ±2; off on touch.
 * - reading drift with useScene().progress: front 14, mid + pan-rim 6, back 2 px upward.
 *   The kitchen never leaves and is never dimmed here (KitchenScene does the dimming).
 * - each layer is over-scaled just enough that no canvas edge is ever exposed.
 *
 * Characters that sit in the skillet (egg, shadow, oil, bubbles, flame) should move with
 * the skillet. The live mid-layer offset is published on the stage element as CSS vars:
 *   transform: translate(var(--kl-mid-x, 0px), var(--kl-mid-y, 0px))
 * (--kl-mid-s carries the tiny edge-cover scale around (768, 600) if exactness matters).
 */
import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { FOCUS_Y, SCENE_H, SCENE_W, Z } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";

export type KitchenLayerName = "back" | "mid" | "pan-rim" | "front-left" | "front-right";

const SRC = "/assets/scene";
const ORIGIN_X = SCENE_W / 2;
const ORIGIN_Y = FOCUS_Y;
/** [mouse amplitude, reading drift] in scene px */
const MOTION = { back: [2, 2], mid: [5, 6], front: [10, 14] } as const;
type Group = keyof typeof MOTION;

const LAYERS: { name: KitchenLayerName; z: number; group: Group }[] = [
  { name: "back", z: Z.back, group: "back" },
  { name: "mid", z: Z.mid, group: "mid" },
  { name: "pan-rim", z: Z.panRim, group: "mid" },
  { name: "front-left", z: Z.frontLeft, group: "front" },
  { name: "front-right", z: Z.frontRight, group: "front" },
];

type Props = {
  /** Mouse parallax (ignored on touch devices). */
  mouse?: boolean;
  /** Dev only: layers to hide. */
  hide?: KitchenLayerName[];
};

export default function KitchenLayers({ mouse = false, hide = [] }: Props) {
  const { progress, activePanel, isTouch, reducedMotion } = useScene();
  const useMouse = mouse && !isTouch && !reducedMotion;
  const momOnStage = activePanel >= 4;

  const els = useRef<(HTMLDivElement | null)[]>([]);
  const live = useRef({ progress, useMouse, reducedMotion });
  useEffect(() => {
    live.current = { progress, useMouse, reducedMotion };
  });

  // reveal only when every layer is decoded, so layers never pop in one by one
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set());
  const ready = loaded.size >= LAYERS.length;
  const markLoaded = (name: string) => setLoaded((s) => (s.has(name) ? s : new Set(s).add(name)));

  useEffect(() => {
    const m = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      m.tx = (e.clientX / window.innerWidth) * 2 - 1;
      m.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onLeave = () => {
      m.tx = 0;
      m.ty = 0;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    let shown = live.current.progress;
    let prev = performance.now();
    const ease = (perSecond: number, dt: number) => 1 - Math.exp(-perSecond * dt);

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(1, (now - prev) / 1000);
      prev = now;
      const L = live.current;
      shown += (L.progress - shown) * (L.reducedMotion ? 1 : ease(4, dt));
      const k = ease(4.5, dt);
      m.x += ((L.useMouse ? m.tx : 0) - m.x) * k;
      m.y += ((L.useMouse ? m.ty : 0) - m.y) * k;

      const t: Record<Group, string> = { back: "", mid: "", front: "" };
      let midVars: [number, number, number] = [0, 0, 1];
      for (const g of ["back", "mid", "front"] as const) {
        const [amp, drift] = MOTION[g];
        const tx = -m.x * amp;
        const ty = -m.y * amp * 0.6 - drift * shown;
        // smallest scale around (ORIGIN_X, ORIGIN_Y) that keeps every canvas edge covered
        const s =
          1 +
          Math.max(0, tx / ORIGIN_X, -tx / (SCENE_W - ORIGIN_X), ty / ORIGIN_Y, -ty / (SCENE_H - ORIGIN_Y)) +
          0.0005;
        t[g] = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
        if (g === "mid") midVars = [tx, ty, s];
      }
      els.current.forEach((el, i) => {
        if (el) el.style.transform = t[LAYERS[i].group];
      });
      const stage = els.current[0]?.parentElement;
      if (stage) {
        stage.style.setProperty("--kl-mid-x", `${midVars[0].toFixed(2)}px`);
        stage.style.setProperty("--kl-mid-y", `${midVars[1].toFixed(2)}px`);
        stage.style.setProperty("--kl-mid-s", midVars[2].toFixed(4));
      }
    };

    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <>
      {LAYERS.map(({ name, z }, i) => {
        const fadeForMom = name === "front-right" && momOnStage;
        return (
          <div
            key={name}
            ref={(el) => {
              els.current[i] = el;
            }}
            className="pointer-events-none absolute left-0 top-0"
            style={{
              width: SCENE_W,
              height: SCENE_H,
              zIndex: z,
              transformOrigin: `${ORIGIN_X}px ${ORIGIN_Y}px`,
              willChange: "transform, opacity",
              opacity: !ready || hide.includes(name) || fadeForMom ? 0 : 1,
              transition: `opacity ${ready && name === "front-right" ? 0.5 : 0.4}s ease`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${SRC}/${name}.png`}
              width={SCENE_W}
              height={SCENE_H}
              alt=""
              draggable={false}
              decoding="async"
              onLoad={() => markLoaded(name)}
              ref={(img) => {
                // already decoded before hydration: onLoad will not fire
                if (img?.complete && img.naturalWidth) markLoaded(name);
              }}
              className="absolute inset-0 select-none"
            />
          </div>
        );
      })}
    </>
  );
}
