"use client";
/**
 * Kitchen environment layers (kitchen-layers, design v4).
 *
 * Five 1536×1024 layers cut from source/kitchen-clean.png, rendered as siblings inside
 * <SceneStage> so they interleave with the character layers through the shared Z order:
 *   back (Z.back)        wall, tiles, back counter, yellow pot, jars, kettle
 *   mid (Z.mid)          wooden table, green stove, red skillet body + floor
 *   pan-rim (Z.panRim)   front lip + red outer wall of the skillet → hides the egg's feet
 *   front-toast (Z.frontLeft)   toast plate — NOT rendered by default (toast left the story;
 *                               the table behind it is rebuilt in `mid`), `showToast` for checks
 *   front-right (Z.frontRight)  eggshells, gingham cloth (+ their table shadows), all inside
 *                               ANCHORS.momZone; fades out in 0.5 s at activePanel >= 5 for mom
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

export type KitchenLayerName = "far" | "counter" | "mid" | "pan-rim" | "front-toast" | "front-right";

/** activePanel from which mom's spatula occupies momZone (docs/DESIGN.md §1, beat 5) */
const MOM_PANEL = 5;

const SRC = "/assets/scene";
const ORIGIN_X = SCENE_W / 2;
const ORIGIN_Y = FOCUS_Y;
/** [mouse amplitude, reading drift] in scene px */
const MOTION = { far: [1.5, 1], counter: [3, 3], mid: [5, 6], front: [10, 14] } as const;
type Group = keyof typeof MOTION;
/**
 * 景深系数：镜头位移 D（场景像素）时，各层相对主体层的额外位移 = (1 - f) * D。
 * 远景跟得少、近景跟得多，形成纵深；主体层 f = 1（蛋、火苗、油跟它走）。试验值。
 */
const DEPTH: Record<Group, number> = { far: 0.35, counter: 0.65, mid: 1, front: 1.6 };

const LAYERS: { name: KitchenLayerName; z: number; group: Group }[] = [
  { name: "far", z: Z.back, group: "far" },
  { name: "counter", z: Z.back + 1, group: "counter" },
  { name: "mid", z: Z.mid, group: "mid" },
  { name: "pan-rim", z: Z.panRim, group: "mid" },
  { name: "front-toast", z: Z.frontLeft, group: "front" },
  { name: "front-right", z: Z.frontRight, group: "front" },
];

type Props = {
  /** Mouse parallax (ignored on touch devices). */
  mouse?: boolean;
  /** 镜头位移（场景像素），由页面按统一时间轴算出；各层按 DEPTH 系数错速。 */
  depth?: { x: number; y: number };
  /** Render the retired toast plate (only for overlay checks; off in the story). */
  showToast?: boolean;
  /** Dev only: layers to hide. */
  hide?: KitchenLayerName[];
};

export default function KitchenLayers({ mouse = false, showToast = false, hide = [], depth }: Props) {
  const { progress, activePanel, isTouch, reducedMotion } = useScene();
  const useMouse = mouse && !isTouch && !reducedMotion;
  const momOnStage = activePanel >= MOM_PANEL;

  const els = useRef<(HTMLDivElement | null)[]>([]);
  const live = useRef({ progress, useMouse, reducedMotion, depth: depth ?? { x: 0, y: 0 } });
  useEffect(() => {
    live.current = { progress, useMouse, reducedMotion, depth: depth ?? { x: 0, y: 0 } };
  });

  // reveal only when every layer is decoded, so layers never pop in one by one
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set());
  const ready = LAYERS.every(({ name }) => (name === "front-toast" && !showToast) || loaded.has(name));
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
    const dz = { x: live.current.depth.x, y: live.current.depth.y };
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

      // 镜头景深位移也做平滑，避免滚动时一顿一顿
      dz.x += (L.depth.x - dz.x) * (L.reducedMotion ? 1 : ease(6, dt));
      dz.y += (L.depth.y - dz.y) * (L.reducedMotion ? 1 : ease(6, dt));
      const t: Record<Group, string> = { far: "", counter: "", mid: "", front: "" };
      let midVars: [number, number, number] = [0, 0, 1];
      let counterVars: [number, number] = [0, 0];
      for (const g of ["far", "counter", "mid", "front"] as const) {
        const [amp, drift] = MOTION[g];
        const tx = -m.x * amp + (1 - DEPTH[g]) * dz.x;
        const ty = -m.y * amp * 0.6 - drift * shown + (1 - DEPTH[g]) * dz.y;
        // smallest scale around (ORIGIN_X, ORIGIN_Y) that keeps every canvas edge covered
        const s =
          1 +
          Math.max(0, tx / ORIGIN_X, -tx / (SCENE_W - ORIGIN_X), ty / ORIGIN_Y, -ty / (SCENE_H - ORIGIN_Y)) +
          0.0005;
        t[g] = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
        if (g === "mid") midVars = [tx, ty, s];
        if (g === "counter") counterVars = [tx, ty];
      }
      els.current.forEach((el, i) => {
        if (el) el.style.transform = t[LAYERS[i].group];
      });
      const stage = els.current[0]?.parentElement;
      if (stage) {
        stage.style.setProperty("--kl-mid-x", `${midVars[0].toFixed(2)}px`);
        stage.style.setProperty("--kl-mid-y", `${midVars[1].toFixed(2)}px`);
        stage.style.setProperty("--kl-mid-s", midVars[2].toFixed(4));
        stage.style.setProperty("--kl-counter-x", `${counterVars[0].toFixed(2)}px`);
        stage.style.setProperty("--kl-counter-y", `${counterVars[1].toFixed(2)}px`);
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
        if (name === "front-toast" && !showToast) return null;
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
