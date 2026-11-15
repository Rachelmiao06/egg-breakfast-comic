"use client";
/**
 * 格内小循环的画面与运动（数字全在 idle.ts）。把原格换成：补好的底图 + 若干透明运动层（+ 热气团），
 * 静止时叠起来和原格一致；`active`（格子在阅读位）为真时才有事做，离开就落回静止姿态。
 * - wave：GSAP 时间轴，每轮 sine 来回摆几下，弹簧缓动收回，停一阵再来（间隔随机）；挥动线只在挥的时候淡入。
 * - sway：gsap.ticker 每帧算 常驻正弦 + 滚动速度倾斜 + 鼠标弹簧（只设目标，位置由弹簧追，带摩擦）。
 * - puffs：每团一条无限循环时间轴（周期各不相同），整团另外被鼠标轻推。
 * 不加滚动监听（读 scroll-velocity 的外部存储），不加鼠标监听（读 pointer，由 PanelHover 的那一个写入）。
 */
import gsap from "gsap";
import { useEffect, useRef } from "react";
import { getScrollVelocity } from "@/lib/scroll-velocity";
import { IDLE, SPRING, type Puffs, type Sway, type Wave } from "./idle";
import { pointer } from "./pointer";

const DIR = "/assets/comic-v3/idle/";
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const layerSrc = (k: string, id: string) => `${DIR}${k}-${id}.webp`;
const imgCls = "pointer-events-none absolute inset-0 block h-full w-full select-none";

/** 鼠标对某点的"推力"：-1…1，鼠标在左边为正（要往右让），距离越近越强；没有鼠标为 0 */
function pushFrom(cx: number, cy: number, radius: number) {
  if (!pointer.on) return 0;
  const dx = cx - pointer.x, d = Math.hypot(dx, cy - pointer.y);
  return (1 - clamp(d / radius, 0, 1)) * Math.sign(dx);
}

function runWave(L: Wave, arm: HTMLElement, lines: HTMLElement | null) {
  let call: gsap.core.Tween | null = null;
  let tl: gsap.core.Timeline | null = null;
  const cycle = () => {
    const t = gsap.timeline({ onComplete: () => { call = gsap.delayedCall(rand(...L.rest), cycle); } });
    tl = t;
    if (lines) t.to(lines, { opacity: 1, duration: 0.12 }, 0);
    for (let i = 0; i < L.swings; i++) {
      const a = L.amp * (1 - (i / L.swings) * 0.45) * (i % 2 ? -1 : 1);
      t.to(arm, { rotation: a, duration: L.swing, ease: "sine.inOut" });
    }
    const settle = t.duration();
    t.to(arm, { rotation: 0, duration: 0.7, ease: "elastic.out(1, 0.4)" }); // 弹簧收回
    if (lines) t.to(lines, { opacity: 0, duration: 0.25 }, settle);
  };
  call = gsap.delayedCall(L.first, cycle);
  return () => { call?.kill(); tl?.kill(); };
}

export function IdleStack({ k, src, active }: { k: string; src: string; active: boolean }) {
  const spec = IDLE[k];
  const root = useRef<HTMLDivElement>(null);
  const els = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const host = root.current;    if (!active || !host) return;
    const refs = els.current;
    const [cw, ch] = spec.canvas;
    const origin = (p: [number, number]) => `${((p[0] / cw) * 100).toFixed(3)}% ${((p[1] / ch) * 100).toFixed(3)}%`;
    const stops: (() => void)[] = [];
    const sways: { L: Sway; el: HTMLElement; x: number; v: number }[] = [];
    const heads: { L: Puffs; el: HTMLElement; x: number; v: number }[] = [];
    const touched: HTMLElement[] = [];

    for (const L of spec.layers) {
      const el = refs[L.id];
      if (!el) continue;
      touched.push(el);
      if (L.kind === "wave") {
        gsap.set(el, { transformOrigin: origin(L.pivot) });
        stops.push(runWave(L, el, L.lines ? refs[L.lines] ?? null : null));
      } else if (L.kind === "sway") {
        gsap.set(el, { transformOrigin: origin(L.pivot) });
        sways.push({ L, el, x: 0, v: 0 });
      } else {
        heads.push({ L, el, x: 0, v: 0 });
        const s = host.getBoundingClientRect().width / cw; // 原格像素 → 屏幕像素
        el.querySelectorAll<HTMLElement>("[data-puff]").forEach((p, i) => {
          const c = L.puffs[i];
          gsap.set(p, { xPercent: -50, yPercent: -50, opacity: 0 });
          const t = gsap.timeline({ repeat: -1, delay: c.delay });
          t.fromTo(p, { y: 0, x: 0, scale: 0.55 }, { y: -L.rise * s, x: c.drift * s, scale: 1.5, duration: c.dur, ease: "sine.out" }, 0);
          t.fromTo(p, { opacity: 0 }, { opacity: L.alpha, duration: c.dur * 0.35, ease: "sine.out" }, 0);
          t.to(p, { opacity: 0, duration: c.dur * 0.65, ease: "sine.in" }, c.dur * 0.35);
          stops.push(() => t.kill());
        });
      }
    }

    const tick = () => {
      if (!sways.length && !heads.length) return;
      const hr = host.getBoundingClientRect();
      const s = hr.width / cw;
      const t = gsap.ticker.time;
      const lean = getScrollVelocity();
      for (const w of sways) {
        const { L } = w;
        const base = L.amp * Math.sin((t / L.period) * Math.PI * 2 + L.phase);
        const target = pushFrom(hr.left + L.home[0] * s, hr.top + L.home[1] * s, L.push.radius) * L.push.deg * L.push.dir;
        w.v += (target - w.x) * SPRING.k; w.v *= SPRING.friction; w.x += w.v; // 弹簧：不直接设位置，只设目标
        gsap.set(w.el, { rotation: base + clamp(lean * L.lean, -L.maxLean, L.maxLean) + w.x });
      }
      for (const h of heads) {
        const { L } = h;
        const [x0, y0, x1, y1] = L.box;
        const target = pushFrom(hr.left + ((x0 + x1) / 2) * s, hr.top + ((y0 + y1) / 2) * s, L.push.radius) * L.push.px * s;
        h.v += (target - h.x) * SPRING.k; h.v *= SPRING.friction; h.x += h.v;
        gsap.set(h.el, { x: h.x });
      }
    };
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      stops.forEach((f) => f());
      // 落回静止姿态（= 原格）：热气团直接隐藏，其余缓缓收回
      for (const el of touched) {
        if (el.dataset.kind === "puffs") { el.querySelectorAll("[data-puff]").forEach((p) => gsap.set(p, { opacity: 0 })); gsap.set(el, { x: 0 }); }
        else gsap.to(el, { rotation: 0, duration: 0.35, ease: "power2.out", overwrite: true });
      }
      for (const L of spec.layers) if (L.kind === "wave" && L.lines) { const l = refs[L.lines]; if (l) gsap.set(l, { opacity: 0 }); }
    };
  }, [active, spec, k]);

  const refFor = (id: string) => (el: HTMLElement | null) => { els.current[id] = el; };
  const lineIds = new Set(spec.layers.flatMap((L) => (L.kind === "wave" && L.lines ? [L.lines] : [])));
  const [cw, ch] = spec.canvas;
  return (
    <div ref={root} className="absolute inset-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={spec.base ? layerSrc(k, "base") : src} alt="" draggable={false} className={`${imgCls} object-contain`} />
      {[...lineIds].map((id) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={id} ref={refFor(id)} src={layerSrc(k, id)} alt="" draggable={false} className={imgCls} style={{ opacity: 0 }} />
      ))}
      {spec.layers.map((L) => {
        if (L.kind === "puffs") {
          const [x0, y0, x1, y1] = L.box;
          return (
            <div key={L.id} className="pointer-events-none absolute overflow-hidden" style={{ left: `${(x0 / cw) * 100}%`, top: `${(y0 / ch) * 100}%`, width: `${((x1 - x0) / cw) * 100}%`, height: `${((y1 - y0) / ch) * 100}%` }}>
              <div ref={refFor(L.id)} data-kind="puffs" className="absolute inset-0">
                {L.puffs.map((c, i) => (
                  <span
                    key={i}
                    data-puff
                    className="absolute rounded-full"
                    style={{
                      left: `${(c.x / (x1 - x0)) * 100}%`,
                      top: `${((y1 - y0 - L.fromBottom) / (y1 - y0)) * 100}%`,
                      width: `${(L.size / (x1 - x0)) * 100}%`,
                      aspectRatio: "1",
                      opacity: 0,
                      background: "radial-gradient(circle, rgba(255,252,244,1) 0%, rgba(255,250,238,0.55) 55%, rgba(255,250,238,0) 100%)",
                    }}
                  />
                ))}
              </div>
            </div>
          );
        }
        // eslint-disable-next-line @next/next/no-img-element
        return <img key={L.id} ref={refFor(L.id)} src={layerSrc(k, L.id)} alt="" draggable={false} className={imgCls} style={{ willChange: "transform" }} />;
      })}
    </div>
  );
}
