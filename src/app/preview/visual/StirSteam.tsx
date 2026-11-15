"use client";
/**
 * 炒菜时的满屏热气：翻炒的声音起来时，整个画面（桌面、墙、格子）被一层层慢慢升起、慢慢散开的热气盖过去，声音退下去它也退下去。
 * 强度直接取自声音：loopLevels(timeline).stirfry / 0.5（节拍表里翻炒声的满量程）——声音随滚动怎么渐入渐出，热气就怎么浓淡，
 * 不另设触发。一个全屏 Canvas（半分辨率，本来就是软的），不接收指针；最多 STEAM.max 团，每团柔和的奶白径向渐变。
 * 减少动态效果或 ?perf=0 时不渲染。所有数字都在 STEAM 里。
 */
import gsap from "gsap";
import { useEffect, useRef } from "react";
import { loopLevels } from "@/lib/beats";
import { useScene } from "@/lib/scene-context";
import { usePerfEnabled } from "./PanelPerf";

export const STEAM = {
  /** 强度 = 翻炒声音量 / full（节拍表里翻炒声的满量程 0.5） */
  full: 0.5,
  /** 同时存在的最多团数 */
  max: 46,
  /** 每秒新生几团（乘强度）*/
  rate: 5,
  /** 每团：寿命（秒）、半径（画面短边的比例）、上升速度（画面高 / 秒）、左右飘幅（画面宽比例）、透明度峰值 */
  life: [10, 16] as [number, number],
  radius: [0.16, 0.34] as [number, number],
  rise: [0.045, 0.09] as [number, number],
  sway: 0.06,
  alpha: 0.15,
  /** 起点：画面下方这一带（锅和灶台所在），横向范围（画面宽比例） */
  from: { y: [0.78, 1.0] as [number, number], x: [0.05, 0.8] as [number, number] },
  /** 整屏薄雾：最浓时从底往上淡去的一层奶白（透明度） */
  haze: 0.09,
};

type Puff = { x: number; y: number; r: number; life: number; ttl: number; vy: number; seed: number; k: number };
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export default function StirSteam() {
  const { timeline, beats, reducedMotion } = useScene();
  const perf = usePerfEnabled();
  const cv = useRef<HTMLCanvasElement>(null);
  const intensity = useRef(0);
  const level = Math.min(1, Math.max(0, loopLevels(timeline, beats).stirfry / STEAM.full));
  useEffect(() => { intensity.current = level; }, [level]);

  useEffect(() => {
    const c = cv.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || reducedMotion || !perf) return;
    const fit = () => { c.width = Math.max(2, Math.round(window.innerWidth / 2)); c.height = Math.max(2, Math.round(window.innerHeight / 2)); };
    fit();
    window.addEventListener("resize", fit);
    const puffs: Puff[] = [];
    let acc = 0, haze = 0;
    const tick = () => {
      const dt = Math.min(0.1, gsap.ticker.deltaRatio(60) / 60);
      const t = gsap.ticker.time;
      const W = c.width, H = c.height, I = intensity.current;
      acc += dt * STEAM.rate * I;
      while (acc >= 1 && puffs.length < STEAM.max) {
        acc -= 1;
        puffs.push({ x: rand(...STEAM.from.x) * W, y: rand(...STEAM.from.y) * H, r: rand(...STEAM.radius) * Math.min(W, H), life: 0, ttl: rand(...STEAM.life), vy: rand(...STEAM.rise) * H, seed: Math.random() * 10, k: 0.6 + 0.4 * I });
      }
      if (acc >= 1) acc = 0;
      haze += (I - haze) * Math.min(1, dt * 1.2); // 薄雾跟着强度慢慢浓、慢慢退
      ctx.clearRect(0, 0, W, H);
      if (haze > 0.01) {
        const g = ctx.createLinearGradient(0, H, 0, 0);
        g.addColorStop(0, `rgba(255,250,238,${STEAM.haze * haze})`);
        g.addColorStop(0.7, `rgba(255,250,238,${STEAM.haze * haze * 0.35})`);
        g.addColorStop(1, "rgba(255,250,238,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.life += dt;
        const u = p.life / p.ttl;
        if (u >= 1) { puffs.splice(i, 1); continue; }
        p.y -= p.vy * dt;
        p.r += dt * p.r * 0.05; // 边飘边慢慢散大
        const x = p.x + Math.sin(t * 0.5 + p.seed) * STEAM.sway * W;
        const a = STEAM.alpha * p.k * Math.sin(Math.PI * u) ** 1.3;
        const g = ctx.createRadialGradient(x, p.y, 0, x, p.y, p.r);
        g.addColorStop(0, `rgba(255,252,244,${a})`);
        g.addColorStop(0.45, `rgba(255,250,238,${a * 0.55})`);
        g.addColorStop(1, "rgba(255,250,238,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    gsap.ticker.add(tick);
    return () => { gsap.ticker.remove(tick); window.removeEventListener("resize", fit); ctx.clearRect(0, 0, c.width, c.height); };
  }, [reducedMotion, perf]);

  return <canvas ref={cv} aria-hidden className="pointer-events-none fixed inset-0 z-[12] h-full w-full" />;
}
