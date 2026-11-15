"use client";
/**
 * 炒菜时的满屏雾气：翻炒的段落里，整个画面（桌面、墙、格子）渐渐变得雾蒙蒙，声音退下去它也散掉。
 * 看起来是"烟 / 蒸汽"而不是一团团光斑：用一张程序生成的、可平铺的分形噪声（有丝缕、有空隙）当雾的纹理，
 * 叠三层不同大小、不同速度的纹理，各自往上、往旁边慢慢漂；上面比下面稀，再盖一层均匀的薄雾，所以整屏都有雾感。
 * 强度（0–1）= max(位置包络, √翻炒声音量 / full)：位置包络在进入炒菜段之前就开始升（不等声音爬到一半才看得见），
 * 声音包络保证声音在哪里，雾就在哪里；强度本身再被平滑（升得快、退得慢），滚动抖动不会让雾闪。
 * 一个全屏 Canvas（半分辨率，本来就是软的），不接收指针。减少动态效果或 ?perf=0 时不渲染。所有数字都在 STEAM 里。
 */
import gsap from "gsap";
import { useEffect, useRef } from "react";
import { loopLevels } from "@/lib/beats";
import { useScene } from "@/lib/scene-context";
import { usePerfEnabled } from "./PanelPerf";

export const STEAM = {
  /** 翻炒声满量程（节拍表里 0.5） */
  full: 0.5,
  /** 位置包络（以炒菜段起点为 0，单位：段）：[开始升, 升满, 开始退, 退完] */
  env: [-0.3, 0.12, 0.75, 1.15] as [number, number, number, number],
  /** 强度平滑：升 / 退的速度（每秒） */
  up: 1.6,
  down: 0.55,
  /** 三层雾：纹理边长（取屏幕长边的倍数）、漂移速度（纹理边长 / 秒，负 y = 往上）、透明度 */
  layers: [
    { size: 1.7, vx: 0.006, vy: -0.012, a: 0.5 },
    { size: 1.05, vx: -0.009, vy: -0.02, a: 0.42 },
    { size: 0.62, vx: 0.014, vy: -0.032, a: 0.3 },
  ],
  /** 噪声成形：低于 lo 全透明，高于 hi 全浓（越近越有丝缕、空隙越分明） */
  shape: [0.36, 0.78] as [number, number],
  /** 整屏雾的总浓度（最浓时） */
  density: 0.62,
  /** 上稀下浓：画面最上面把雾减掉多少（0–1） */
  topThin: 0.5,
  /** 均匀的薄雾（最浓时的透明度），保证每个角落都有一点雾 */
  haze: 0.12,
  /**
   * 明确的源头：从炒锅口冒出来的一柱烟。源头取炒菜格 p2e 里那口锅（格内比例位置），格子在哪、多大，烟就从哪冒；
   * 找不到这一格时从画面下方中部冒。烟柱 = 很多小团连成的一条：出口细而浓，边升边变宽、变淡、左右蜿蜒，最后散进满屏的雾里。
   */
  plume: {
    panel: "p2e",
    at: [0.3, 0.82] as [number, number],
    max: 260,
    rate: 55,
    life: [3.6, 6] as [number, number],
    r0: 0.012,
    r1: 0.13,
    rise: 0.13,
    wiggle: 0.12,
    alpha: 0.5,
  },
};

const TILE = 256;
const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })();
const smooth = (t: number) => t * t * (3 - 2 * t);

/** 可平铺的分形值噪声 → 奶白色、alpha 为成形后的噪声的纹理 */
function makeFog(): HTMLCanvasElement {
  const grids = [4, 8, 16, 32].map((g) => Array.from({ length: g * g }, () => rand()));
  const c = document.createElement("canvas");
  c.width = c.height = TILE;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(TILE, TILE);
  const [lo, hi] = STEAM.shape;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      let n = 0, amp = 0.5, tot = 0;
      grids.forEach((grid, o) => {
        const g = 4 << o, fx = (x / TILE) * g, fy = (y / TILE) * g;
        const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = smooth(fx - x0), ty = smooth(fy - y0);
        const at = (i: number, j: number) => grid[(j % g) * g + (i % g)];
        const v = at(x0, y0) * (1 - tx) * (1 - ty) + at(x0 + 1, y0) * tx * (1 - ty) + at(x0, y0 + 1) * (1 - tx) * ty + at(x0 + 1, y0 + 1) * tx * ty;
        n += v * amp; tot += amp; amp *= 0.55;
      });
      const a = smooth(Math.min(1, Math.max(0, (n / tot - lo) / (hi - lo))));
      const i = (y * TILE + x) * 4;
      img.data[i] = 255; img.data[i + 1] = 251; img.data[i + 2] = 241; img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const ramp = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)));

export default function StirSteam() {
  const { timeline, beats, reducedMotion } = useScene();
  const perf = usePerfEnabled();
  const cv = useRef<HTMLCanvasElement>(null);
  const target = useRef(0);

  const idx = beats.findIndex((b) => b.id === "stirfry");
  const [e0, e1, e2, e3] = STEAM.env;
  const pos = idx < 0 ? -9 : timeline.index + timeline.p - idx;
  const posEnv = ramp(pos, e0, e1) * (1 - ramp(pos, e2, e3));
  const soundEnv = Math.sqrt(Math.min(1, Math.max(0, loopLevels(timeline, beats).stirfry / STEAM.full)));
  const level = Math.max(posEnv, soundEnv);
  useEffect(() => { target.current = level; }, [level]);

  useEffect(() => {
    const c = cv.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || reducedMotion || !perf) return;
    const fit = () => { c.width = Math.max(2, Math.round(window.innerWidth / 2)); c.height = Math.max(2, Math.round(window.innerHeight / 2)); };
    fit();
    window.addEventListener("resize", fit);
    const fog = makeFog();
    const pats = STEAM.layers.map(() => ctx.createPattern(fog, "repeat")!);
    const off = STEAM.layers.map((_, i) => [i * 97, i * 53]);
    let I = 0, acc = 0;
    type P = { x: number; y: number; age: number; ttl: number; ph: number; vy: number };
    const ps: P[] = [];
    const PL = STEAM.plume;
    const tick = () => {
      const dt = Math.min(0.1, gsap.ticker.deltaRatio(60) / 60);
      const W = c.width, H = c.height, T = target.current;
      I += (T - I) * Math.min(1, dt * (T > I ? STEAM.up : STEAM.down));
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, H);
      if (I < 0.01 && !ps.length) return;
      const L = Math.max(W, H);
      STEAM.layers.forEach((l, i) => {
        const tile = l.size * L;
        off[i][0] += l.vx * tile * dt; off[i][1] += l.vy * tile * dt;
        const k = tile / TILE;
        pats[i].setTransform(new DOMMatrix().translate(off[i][0], off[i][1]).scale(k));
        ctx.globalAlpha = Math.min(1, l.a * STEAM.density * I * 1.6);
        ctx.fillStyle = pats[i];
        ctx.fillRect(0, 0, W, H);
      });
      // 上稀下浓
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "destination-out";
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.7);
      g.addColorStop(0, `rgba(0,0,0,${STEAM.topThin})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // 均匀薄雾
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(255,250,238,${STEAM.haze * I})`;
      ctx.fillRect(0, 0, W, H);
      // 烟柱：源头 = 炒菜格里那口锅（每帧按格子当前的屏幕位置算）
      const el = document.querySelector<HTMLElement>(`[data-panel="${PL.panel}"]`);
      const r = el?.getBoundingClientRect();
      const sx = (r && r.width > 10 ? r.left + r.width * PL.at[0] : window.innerWidth * 0.45) / 2;
      const sy = (r && r.width > 10 ? r.top + r.height * PL.at[1] : window.innerHeight * 0.85) / 2;
      const inView = !r || (r.bottom > 0 && r.top < window.innerHeight);
      acc += dt * PL.rate * I;
      while (acc >= 1 && ps.length < PL.max) { acc -= 1; ps.push({ x: sx, y: sy, age: 0, ttl: rand() * (PL.life[1] - PL.life[0]) + PL.life[0], ph: rand() * 6.28, vy: PL.rise * H * (0.8 + rand() * 0.4) }); }
      if (acc >= 1) acc = 0;
      const S = Math.min(W, H), t = gsap.ticker.time;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.age += dt;
        const u = p.age / p.ttl;
        if (u >= 1) { ps.splice(i, 1); continue; }
        p.y -= p.vy * dt * (1 - 0.35 * u);
        const x = p.x + (Math.sin(t * 0.8 + u * 6.5) * PL.wiggle * W + Math.sin(p.ph) * 0.035 * W) * Math.min(1, u * 2) * (0.35 + u); // 烟柱整体蜿蜒，每团再各自偏一点，边缘不会是笔直的竖条
        const rad = (PL.r0 + (PL.r1 - PL.r0) * Math.sqrt(u)) * S;
        const a = (inView ? 1 : 0) * PL.alpha * Math.min(1, I * 1.4) * Math.min(1, u * 8) * (1 - u) ** 1.2;
        const g = ctx.createRadialGradient(x, p.y, 0, x, p.y, rad);
        g.addColorStop(0, `rgba(255,253,248,${a})`);
        g.addColorStop(0.55, `rgba(246,240,229,${a * 0.55})`);
        g.addColorStop(1, "rgba(236,228,214,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, p.y, rad, 0, Math.PI * 2); ctx.fill();
      }
    };
    gsap.ticker.add(tick);
    return () => { gsap.ticker.remove(tick); window.removeEventListener("resize", fit); ctx.clearRect(0, 0, c.width, c.height); };
  }, [reducedMotion, perf]);

  return <canvas ref={cv} aria-hidden className="pointer-events-none fixed inset-0 z-[12] h-full w-full" />;
}
