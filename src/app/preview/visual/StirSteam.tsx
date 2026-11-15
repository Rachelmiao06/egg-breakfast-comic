"use client";
/**
 * 炒菜时的满屏雾气：翻炒的段落里，整个画面（桌面、墙、格子）渐渐变得雾蒙蒙，声音退下去它也散掉。
 * 看起来是"烟 / 蒸汽"而不是一团团光斑：用一张程序生成的、可平铺的分形噪声（有丝缕、有空隙）当雾的纹理，
 * 叠三层不同大小、不同速度的纹理，各自往上、往旁边慢慢漂；上面比下面稀，再盖一层均匀的薄雾，所以整屏都有雾感。
 * 强度（0–1）= max(位置包络, √翻炒声音量 / full)：位置包络在进入炒菜段之前就开始升（不等声音爬到一半才看得见），
 * 声音包络保证声音在哪里，雾就在哪里；强度本身再被平滑（升得快、退得也快：滚到下一页雾就散），滚动抖动不会让雾闪。
 * 层级（2026-11-15）：雾在漫画格（z-10）下面，只罩厨房；格子是主角，墨线和对白不能被雾盖住。
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
  env: [-0.3, 0.12, 0.55, 0.9] as [number, number, number, number],
  /**
   * 满屏雾的"弥漫"进度（以炒菜段起点为 0，单位：段）：[开始, 弥漫到最大]。
   * 一开始只有锅口那一缕烟；满屏雾随滚动慢慢长，并且只从锅口向外扩散（半径随进度变大），不会一滑进来整页就糊。
   * maxFog：最后弥漫时满屏雾的最大浓度（相对原来的 1）；radius：扩散半径（屏幕长边的倍数）[刚冒烟时, 弥漫到最大时]
   */
  spread: [0.05, 0.55] as [number, number],
  maxFog: 0.55,
  radius: [0.18, 1.25] as [number, number],
  /** 强度平滑：升 / 退的速度（每秒） */
  up: 1.6,
  down: 2.2,
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
   * 明确的源头：从炒菜格 p2e 里那口锅的锅口冒出来的烟（格子在哪、多大，源头就在哪；找不到这一格时从画面下方中部）。
   * 不再用一团团柔光（像棉花）：烟 = 竖向拉长的丝状噪声（一缕缕细丝）几层，以不同速度往上流，
   * 再被一个"出口窄、越高越宽、左右蜿蜒、越高越淡"的形状裁出来；锅口以下一律不画，所以只从锅里冒，不会出现在桌面上。
   */
  plume: {
    panel: "p2e",
    /** 锅口中心在格子里的位置（格内比例） */
    at: [0.33, 0.84] as [number, number],
    /** 丝状噪声成形（比满屏雾更锐，丝缕更分明） */
    shape: [0.1, 0.4] as [number, number],
    /** 烟丝的颜色：略带灰的暖白（纯白在浅色背景上看不出来，要有一点明暗才像烟） */
    color: [228, 221, 208] as [number, number, number],
    /** 几层丝：纹理边长（屏幕长边倍数）、纵向拉长倍数、上升速度（纹理边长 / 秒）、横向漂移、透明度 */
    strands: [
      { size: 0.45, stretch: 3.2, vy: 0.22, vx: 0.01, a: 1 },
      { size: 0.3, stretch: 3.6, vy: 0.34, vx: -0.015, a: 0.85 },
      { size: 0.2, stretch: 4.0, vy: 0.5, vx: 0.02, a: 0.7 },
    ],
    /** 烟柱半宽：出口 → 最高处（屏幕宽的比例）；蜿蜒幅度；最高处（离出口多远，屏幕高的比例）烟散尽 */
    w0: 0.03,
    w1: 0.2,
    wiggle: 0.09,
    /** 几缕烟：各自的最宽半宽（屏幕宽比例）、左右摆幅、一路上的弯数、摆动速度（弯往上走的圈/秒）、相位、浓度。行波：弯是顺着烟往上"传"的，像烟真的在飘 */
    ribbons: [
      { w1: 0.1, amp: 0.15, cycles: 1.3, speed: 0.2, phase: 0, a: 1 },
      { w1: 0.065, amp: 0.1, cycles: 2.1, speed: 0.28, phase: 2.2, a: 0.85 },
      { w1: 0.05, amp: 0.2, cycles: 0.9, speed: 0.15, phase: 4.1, a: 0.7 },
    ],
    reach: 0.9,
    alpha: 1,
  },
};

const TILE = 256;
const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })();
const smooth = (t: number) => t * t * (3 - 2 * t);

/** 可平铺的分形值噪声 → 奶白色、alpha 为成形后的噪声的纹理 */
function makeFog(shape: [number, number] = STEAM.shape, rgb: [number, number, number] = [255, 251, 241]): HTMLCanvasElement {
  const grids = [4, 8, 16, 32].map((g) => Array.from({ length: g * g }, () => rand()));
  const c = document.createElement("canvas");
  c.width = c.height = TILE;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(TILE, TILE);
  const [lo, hi] = shape;
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
      img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = Math.round(a * 255);
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
  const spread = useRef(0);

  const idx = beats.findIndex((b) => b.id === "stirfry");
  const [e0, e1, e2, e3] = STEAM.env;
  const pos = idx < 0 ? -9 : timeline.index + timeline.p - idx;
  const posEnv = ramp(pos, e0, e1) * (1 - ramp(pos, e2, e3));
  const soundEnv = Math.sqrt(Math.min(1, Math.max(0, loopLevels(timeline, beats).stirfry / STEAM.full)));
  // 离开炒菜段就散：声音还没退完也不能让雾留着（滚到下一页应当没有雾，桌面上也不剩）
  const level = Math.min(Math.max(posEnv, soundEnv), 1 - ramp(pos, e2, e3));
  useEffect(() => { target.current = level; }, [level]);
  const spreadV = ramp(pos, STEAM.spread[0], STEAM.spread[1]);
  useEffect(() => { spread.current = spreadV; }, [spreadV]);

  useEffect(() => {
    const c = cv.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || reducedMotion || !perf) return;
    const mk = () => document.createElement("canvas");
    const P = mk(), M = mk(); // P：丝状噪声层；M：烟柱形状的遮罩
    const pctx = P.getContext("2d")!, mctx = M.getContext("2d")!;
    const fit = () => {
      c.width = P.width = M.width = Math.max(2, Math.round(window.innerWidth / 2));
      c.height = P.height = M.height = Math.max(2, Math.round(window.innerHeight / 2));
    };
    fit();
    window.addEventListener("resize", fit);
    const fog = makeFog();
    const pats = STEAM.layers.map(() => ctx.createPattern(fog, "repeat")!);
    const off = STEAM.layers.map((_, i) => [i * 97, i * 53]);
    const PL = STEAM.plume;
    const wisp = makeFog(PL.shape, PL.color);
    const ppats = PL.strands.map(() => pctx.createPattern(wisp, "repeat")!);
    const poff = PL.strands.map((_, i) => [i * 71, i * 113]);
    let I = 0;
    const tick = () => {
      const dt = Math.min(0.1, gsap.ticker.deltaRatio(60) / 60);
      const W = c.width, H = c.height, T = target.current;
      I += (T - I) * Math.min(1, dt * (T > I ? STEAM.up : STEAM.down));
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, H);
      if (I < 0.01) return;
      const L = Math.max(W, H);
      // 锅口（烟的源头）：每帧按炒菜格当前的屏幕位置算；满屏雾也从这里向外扩散
      const el = document.querySelector<HTMLElement>(`[data-panel="${PL.panel}"]`);
      const r = el?.getBoundingClientRect();
      const sx = (r && r.width > 10 ? r.left + r.width * PL.at[0] : window.innerWidth * 0.45) / 2;
      const sy = Math.min(H, (r && r.width > 10 ? r.top + r.height * PL.at[1] : window.innerHeight * 0.85) / 2);
      // 满屏雾：浓度随弥漫进度慢慢长（前期几乎没有），范围从锅口向外扩，最后才弥漫整页
      const S = spread.current;
      const K = STEAM.maxFog * Math.pow(S, 1.6);
      if (K > 0.004) {
        STEAM.layers.forEach((l, i) => {
          const tile = l.size * L;
          off[i][0] += l.vx * tile * dt; off[i][1] += l.vy * tile * dt;
          const k = tile / TILE;
          pats[i].setTransform(new DOMMatrix().translate(off[i][0], off[i][1]).scale(k));
          ctx.globalAlpha = Math.min(1, l.a * STEAM.density * I * K * 1.6);
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
        ctx.fillStyle = `rgba(255,250,238,${STEAM.haze * I * K})`;
        ctx.fillRect(0, 0, W, H);
        // 只保留锅口周围的一圈：半径随弥漫进度变大，边缘柔和渐隐
        const rad = (STEAM.radius[0] + (STEAM.radius[1] - STEAM.radius[0]) * S) * L;
        const rg = ctx.createRadialGradient(sx, sy, rad * 0.15, sx, sy, rad);
        rg.addColorStop(0, "rgba(0,0,0,1)");
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalCompositeOperation = "destination-in";
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.globalAlpha = 1;
      // 烟只从锅口冒：没有这一格（没挂载 / 不在画面里）就不冒——不再退回到"画面下方中部"（那是桌面）；
      // 格子淡入淡出时带着滑动和缩放，位置不准：烟的浓度跟着格子的实际不透明度走，淡入完成（≥ 0.95）才全量，淡出一开始就收
      if (!el || !r || r.width <= 10 || r.bottom < 0 || r.top > window.innerHeight) return;
      const shown = ramp(parseFloat(getComputedStyle(el.parentElement ?? el).opacity), 0.8, 0.98);
      if (shown <= 0.01) return;

      const reach = Math.max(10, Math.min(sy, PL.reach * H));
      const t = gsap.ticker.time;
      // 1) 丝状噪声：竖向拉长，往上流
      pctx.globalCompositeOperation = "source-over";
      pctx.clearRect(0, 0, W, H);
      PL.strands.forEach((l, i) => {
        const tile = l.size * L;
        poff[i][0] += l.vx * tile * dt; poff[i][1] -= l.vy * tile * dt;
        const k = tile / TILE;
        ppats[i].setTransform(new DOMMatrix().translate(poff[i][0], poff[i][1]).scale(k, k * l.stretch));
        pctx.globalAlpha = l.a;
        pctx.fillStyle = ppats[i];
        pctx.fillRect(0, 0, W, sy);
      });
      // 2) 形状遮罩：出口窄、越高越宽、左右蜿蜒、越高越淡；每 2 像素一行
      mctx.clearRect(0, 0, W, H);
      for (const R of PL.ribbons) {
        for (let y = 0; y < sy; y += 2) {
          const u = Math.min(1, (sy - y) / reach);
          if (u >= 1) continue;
          // 行波：弯随时间沿烟往上传；越高摆得越大（出口处几乎不动，像从锅口稳稳冒出来）
          const cx = sx + Math.sin((u * R.cycles - t * R.speed) * 6.283 + R.phase) * R.amp * W * Math.pow(u, 0.8);
          const w = (PL.w0 * 0.6 + (R.w1 - PL.w0 * 0.6) * Math.pow(u, 0.8)) * W * (1 + u * u);
          const a = R.a * Math.min(1, u * 45) * (1 - u) ** 0.9;
          const gr = mctx.createLinearGradient(cx - w, 0, cx + w, 0);
          gr.addColorStop(0, "rgba(0,0,0,0)");
          gr.addColorStop(0.3, `rgba(0,0,0,${a * 0.5})`);
          gr.addColorStop(0.5, `rgba(0,0,0,${a})`);
          gr.addColorStop(0.7, `rgba(0,0,0,${a * 0.5})`);
          gr.addColorStop(1, "rgba(0,0,0,0)");
          mctx.fillStyle = gr;
          mctx.fillRect(Math.max(0, cx - w), y, Math.min(W, cx + w) - Math.max(0, cx - w), 2);
        }
      }
      pctx.globalAlpha = 1;
      pctx.globalCompositeOperation = "destination-in";
      pctx.drawImage(M, 0, 0);
      ctx.globalAlpha = Math.min(1, PL.alpha * Math.min(1, I * 1.4)) * shown;
      ctx.drawImage(P, 0, 0);
      ctx.drawImage(P, 0, 0); // 叠两次，浓一倍（出口处能清楚看到烟）
      ctx.globalAlpha = 1;
    };
    gsap.ticker.add(tick);
    return () => { gsap.ticker.remove(tick); window.removeEventListener("resize", fit); ctx.clearRect(0, 0, c.width, c.height); };
  }, [reducedMotion, perf]);

  return <canvas ref={cv} aria-hidden className="pointer-events-none fixed inset-0 z-[9] h-full w-full" />;
}
