"use client";
/**
 * Kitchen environment layers (feat/kitchen-layers).
 *
 * Stack, back to front, all 1536×1024 scene pixels at the same coordinates:
 *   back     wall + tiles
 *   mid      yellow pot, jars, kettle, green back counter
 *   main     red skillet, front stove, wooden table
 *     └ inPan / children   ← flame, oil, the egg while it is in the pan
 *     └ pan-rim            ← front lip of the skillet, hides the egg's feet
 *   front    toast plate, eggshells, gingham cloth
 *   aboveFront             ← same motion as `main`, drawn above `front`
 *                            (move the egg here once it clears the rim)
 *
 * Motion:
 * - mouse parallax (front ±10, main ±7, mid ±5, back ±2 px), eased; off on touch.
 * - story drift: as useScene().progress goes 0→1 the camera slowly pans sideways and
 *   pushes in a little; nearer layers travel more. The kitchen never leaves the screen.
 * - idle sway: a very slow ±4 px breathing so the room feels alive (off with reduced motion).
 * - every layer is over-scaled just enough that no canvas edge is ever exposed.
 * - background weakening (`dim`) for reading the comic on top: brightness, saturation,
 *   blur and an optional paper wash, all proportional to progress.
 * No egg is drawn here; the integration session supplies it through the slots.
 */
import gsap from "gsap";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FOCUS_Y, SCENE_H, SCENE_W } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";

export type KitchenLayerName = "back" | "mid" | "main" | "pan-rim" | "front";

type Props = {
  /** Mouse parallax (ignored on touch devices). */
  mouse?: boolean;
  /** Horizontal camera travel at progress = 1, scene px. Positive pans the view right. */
  drift?: number;
  /** Extra zoom at progress = 1 for the nearest layer (0.05 = 5 %). */
  push?: number;
  /** 0–1: how much the kitchen is weakened at progress = 1 (1 = brightness 0.7, blur 2px). */
  dim?: number;
  /** 0–1: paper-coloured veil over the kitchen at progress = 1, for comic readability. */
  wash?: number;
  /** Slow idle breathing motion. */
  sway?: boolean;
  /** Override useScene().progress (previews). */
  progress?: number;
  /** Rendered between the skillet and its front rim (egg in the pan, flame, oil). */
  inPan?: ReactNode;
  /** Alias for inPan. */
  children?: ReactNode;
  /** Rendered above the front layer with the skillet's motion (egg after it jumps out). */
  aboveFront?: ReactNode;
  /** Dev only: layers to hide. */
  hide?: KitchenLayerName[];
};

const SRC = "/assets/scene";
/** depth factor (story drift / push) and mouse amplitude per layer, px */
const DEPTH = { back: [0.25, 2], mid: [0.5, 5], main: [0.75, 7], front: [1, 10] } as const;
type Group = keyof typeof DEPTH;
const ORIGIN_X = SCENE_W / 2;
const ORIGIN_Y = FOCUS_Y;

function Img({ name, hidden, onLoad }: { name: string; hidden?: boolean; onLoad?: () => void }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${SRC}/${name}.png`}
      width={SCENE_W}
      height={SCENE_H}
      alt=""
      draggable={false}
      decoding="async"
      onLoad={onLoad}
      ref={(el) => {
        if (el?.complete && el.naturalWidth) onLoad?.();
      }}
      className="pointer-events-none absolute inset-0 select-none"
      style={{ visibility: hidden ? "hidden" : undefined }}
    />
  );
}

const layerStyle = {
  width: SCENE_W,
  height: SCENE_H,
  transformOrigin: `${ORIGIN_X}px ${ORIGIN_Y}px`,
  willChange: "transform",
} as const;

export default function KitchenLayers({
  mouse = false,
  drift = 60,
  push = 0.05,
  dim = 1,
  wash = 0,
  sway = true,
  progress,
  inPan,
  children,
  aboveFront,
  hide = [],
}: Props) {
  const scene = useScene();
  const p = progress ?? scene.progress;
  const useMouse = mouse && !scene.isTouch;
  const still = scene.reducedMotion;

  const backRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const aboveRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const washRef = useRef<HTMLDivElement>(null);
  // live values read by the ticker without re-subscribing
  const live = useRef({ p, drift, push, dim, wash, useMouse, still, sway });
  useEffect(() => {
    live.current = { p, drift, push, dim, wash, useMouse, still, sway };
  });

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

    let shown = live.current.p;
    let lastFilter = "";
    const t0 = performance.now();
    let prev = t0;
    // frame-rate independent easing: fraction of the gap closed after dt seconds
    const ease = (perSecond: number, dt: number) => 1 - Math.exp(-perSecond * dt);

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(1, (now - prev) / 1000);
      prev = now;
      const L = live.current;
      // the story moves slowly behind the comic (~1.2 s to settle)
      shown += (L.p - shown) * (L.still ? 1 : ease(3.5, dt));
      if (Math.abs(L.p - shown) < 1e-4) shown = L.p;
      const tgx = L.useMouse && !L.still ? m.tx : 0;
      const tgy = L.useMouse && !L.still ? m.ty : 0;
      const mk = ease(4.5, dt);
      m.x += (tgx - m.x) * mk;
      m.y += (tgy - m.y) * mk;

      const t = (now - t0) / 1000;
      const sw = L.sway && !L.still ? 1 : 0;
      const sx = sw * 4 * Math.sin((t * 2 * Math.PI) / 17);
      const sy = sw * 2 * Math.sin((t * 2 * Math.PI) / 11 + 1.3);
      const e = shown * shown * (3 - 2 * shown); // smoothstep

      const groups: [HTMLDivElement | null, Group][] = [
        [backRef.current, "back"],
        [midRef.current, "mid"],
        [mainRef.current, "main"],
        [frontRef.current, "front"],
        [aboveRef.current, "main"],
      ];
      for (const [el, g] of groups) {
        if (!el) continue;
        const [f, amp] = DEPTH[g];
        const tx = -L.drift * f * e - m.x * amp + sx * f;
        const ty = -m.y * amp * 0.6 + sy * f;
        const dolly = 1 + L.push * f * e;
        // smallest scale that keeps every canvas edge covered after the shift
        const cover =
          1 +
          Math.max(0, tx / ORIGIN_X, -tx / (SCENE_W - ORIGIN_X), ty / ORIGIN_Y, -ty / (SCENE_H - ORIGIN_Y)) +
          0.001;
        const s = Math.max(dolly, cover);
        el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
      }

      const d = L.dim * e;
      const filter = d > 0.001
        ? `brightness(${(1 - 0.3 * d).toFixed(3)}) saturate(${(1 - 0.2 * d).toFixed(3)}) blur(${(2 * d).toFixed(2)}px)`
        : "none";
      if (filter !== lastFilter && filterRef.current) {
        filterRef.current.style.filter = filter;
        lastFilter = filter;
      }
      if (washRef.current) washRef.current.style.opacity = (L.wash * e).toFixed(3);
    };

    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const hidden = (n: KitchenLayerName) => hide.includes(n);
  // reveal the stack only when every layer is decoded, so layers never pop in one by one
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const ready = loaded.size >= 5;
  const done = (n: string) => () =>
    setLoaded((s) => (s.has(n) ? s : new Set(s).add(n)));

  return (
    <div className="pointer-events-none absolute inset-0" style={{ width: SCENE_W, height: SCENE_H }}>
      <div
        ref={filterRef}
        className="absolute inset-0 transition-opacity duration-500"
        style={{ willChange: "filter", opacity: ready ? 1 : 0 }}
      >
        <div ref={backRef} className="absolute left-0 top-0" style={layerStyle}>
          <Img name="back" hidden={hidden("back")} onLoad={done("back")} />
        </div>
        <div ref={midRef} className="absolute left-0 top-0" style={layerStyle}>
          <Img name="mid" hidden={hidden("mid")} onLoad={done("mid")} />
        </div>
        <div ref={mainRef} className="absolute left-0 top-0" style={layerStyle}>
          <Img name="main" hidden={hidden("main")} onLoad={done("main")} />
          {inPan}
          {children}
          <Img name="pan-rim" hidden={hidden("pan-rim")} onLoad={done("pan-rim")} />
        </div>
        <div ref={frontRef} className="absolute left-0 top-0" style={layerStyle}>
          <Img name="front" hidden={hidden("front")} onLoad={done("front")} />
        </div>
      </div>
      <div ref={washRef} className="absolute inset-0" style={{ background: "#f6ecdc", opacity: 0 }} />
      <div ref={aboveRef} className="absolute left-0 top-0" style={layerStyle}>
        {aboveFront}
      </div>
    </div>
  );
}
