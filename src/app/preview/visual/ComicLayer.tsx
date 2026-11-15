"use client";
/**
 * 页面层的前景漫画（完整静态图 / 占位格）。只读统一时间轴：
 * 进入阶段减速入场（power3.out），停留完全静止，退出加速离场（power2.in）。
 * 第 1 段用接缝遮罩小样（CSS mask），其他格按各自方向滑入，不统一淡入。
 */
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useScene } from "@/lib/scene-context";
import { PANELS, type PanelSlot as PanelSpec } from "./slots";
import { useViewport } from "./viewport";
import { ChopPanel, HearPanel, PanelSignal, SaucePanel, StirfryPanel, usePerfEnabled, type Stage } from "./PanelPerf";
import { BLINK_PANELS, BlinkLayer, ClosingBlink } from "./Blink";
import FrameReact from "./FrameReact";
import { KITCHEN_ONESHOT_EVENT } from "@/components/kitchen/useKitchenAudio";

const out3 = (t: number) => 1 - Math.pow(1 - t, 3);
const in2 = (t: number) => t * t;

function offsetFor(from: PanelSpec["from"], k: number): [number, number] {
  const d = 1 - k; // 1 = 完全在画外方向
  switch (from) {
    case "left": return [-14 * d, 0];
    case "right": return [14 * d, 0];
    case "top": return [0, -16 * d];
    case "bottom": return [0, 18 * d];
    default: return [0, 0];
  }
}

export function Placeholder({ label, align = "center" }: { label: string; align?: "center" | "top" | "bottom" }) {
  const [title, ...rest] = label.split("\n");
  return (
    <div
      className={`flex h-full w-full flex-col items-center gap-1 px-4 text-center ${align === "top" ? "justify-start pt-[6%]" : align === "bottom" ? "justify-end pb-[6%]" : "justify-center"}`}
      style={{
        background: "repeating-linear-gradient(135deg, #fdf6ea 0 12px, #f4ead8 12px 13px)",
        outline: "2.5px solid #2b2118",
        outlineOffset: "-2.5px",
        color: "#5b4632",
        fontSize: "clamp(12px, 1.05vw, 16px)",
        lineHeight: 1.5,
      }}
    >
      <strong style={{ letterSpacing: "0.04em" }}>{title}</strong>
      {rest.map((l, i) => <span key={i}>{l}</span>)}
    </div>
  );
}

function SeamPanel({ children, progress }: { children: ReactNode; progress: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.getBoundingClientRect().width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 遮罩图宽 = 3 倍元素宽；毛边在遮罩 1.5W 处。progress 0 → 视窗在透明区；1 → 视窗在不透明区
  const pos = -(1 - progress) * 1.62 * w;
  const mask: CSSProperties = {
    WebkitMaskImage: "url(/assets/preview/seam-mask.png)",
    maskImage: "url(/assets/preview/seam-mask.png)",
    WebkitMaskSize: "300% 100%",
    maskSize: "300% 100%",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: `${pos}px 0`,
    maskPosition: `${pos}px 0`,
  };
  const showLine = progress > 0.01 && progress < 0.99;
  return (
    <div ref={ref} className="relative h-full w-full">
      <div className="h-full w-full" style={mask}>
        {children}
      </div>
      {showLine && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: "url(/assets/preview/seam-line.png)", backgroundSize: "300% 100%", backgroundRepeat: "no-repeat", backgroundPosition: `${pos}px 0` }}
        />
      )}
    </div>
  );
}

/** 图片的实际宽高比（加载后读取），换图后无需改版位 */
function useNaturalAspect(src: string | undefined, fallback: number) {
  const [ar, setAr] = useState<number | null>(null);
  useEffect(() => {
    if (!src) return;
    let alive = true;
    const img = new Image();
    img.onload = () => { if (alive && img.naturalHeight) setAr(img.naturalWidth / img.naturalHeight); };
    img.src = src;
    return () => { alive = false; };
  }, [src]);
  return ar ?? fallback;
}

type Place = { x: number; y: number; w: number }; // vw / vh / vw

function Panel({ p, k, opacity, exitShift, seamProgress, place }: { p: PanelSpec; k: number; opacity: number; exitShift: number; seamProgress: number; place?: Place }) {
  const aspect = useNaturalAspect(p.src, p.aspect);
  const [dx, dy] = p.from === "seam" ? [0, 0] : offsetFor(p.from, k);
  const pos = place ?? { x: p.x, y: p.y, w: p.w };
  const style: CSSProperties = {
    left: `${pos.x}vw`,
    top: `${pos.y}vh`,
    width: `${pos.w}vw`,
    aspectRatio: `${aspect}`,
    transform: `translate(${dx}vw, calc(${dy}vh + ${exitShift}vh))`,
    opacity: p.from === "seam" ? opacity : opacity * Math.min(1, k * 1.4),
  };
  const content = p.src ? (
    p.kind === "head" ? (
      <div className="relative h-full w-full overflow-hidden" style={{ background: "#d6eadd", outline: "2.5px solid #2b2118", outlineOffset: "-2.5px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.src} alt="" draggable={false} className="absolute bottom-0 left-1/2 h-[96%] w-auto max-w-none -translate-x-1/2 select-none" />
      </div>
    ) : p.frame ? (
      <div className="h-full w-full" style={{ background: "#fef4e5", padding: "6px" }}>
        <div className="h-full w-full" style={{ outline: "2.5px solid #2b2118", outlineOffset: "-2.5px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.src} alt="" draggable={false} className="block h-full w-full select-none object-cover" style={{ padding: "2.5px" }} />
        </div>
      </div>
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={p.src} alt="" draggable={false} className="block h-full w-full select-none object-contain" />
    )
  ) : (
    <Placeholder label={p.label ?? ""} />
  );
  return (
    <div className="absolute" style={style}>
      {p.from === "seam" ? <SeamPanel progress={seamProgress}>{content}</SeamPanel> : content}
    </div>
  );
}

/** 竖屏手机：本段各格按顺序纵向堆叠（保持原比例）；reserveBottom 给桌沿上的蛋留出底部空间 */
function stackPlaces(list: PanelSpec[], vw: number, vh: number, reserveBottom = 0): Record<string, Place> {
  const sorted = [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const gapVh = 1.6;
  let w = 92; // vw
  const heightVh = (ww: number) => sorted.reduce((s, p) => s + ((ww * vw) / 100 / p.aspect / vh) * 100, 0) + gapVh * (sorted.length - 1);
  const maxH = 90 - reserveBottom;
  if (heightVh(w) > maxH) w = w * (maxH / heightVh(w));
  let y = reserveBottom ? 4 : (100 - heightVh(w)) / 2;
  const out: Record<string, Place> = {};
  for (const p of sorted) {
    out[p.key] = { x: (100 - w) / 2, y, w };
    y += ((w * vw) / 100 / p.aspect / vh) * 100 + gapVh;
  }
  return out;
}

const outCubic = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const inQuad = (t: number) => { const k = Math.min(1, Math.max(0, t)); return k * k; };
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const hOf = (p: PanelSpec, w: number, vw: number, vh: number) => ((w * vw) / 100 / p.aspect / vh) * 100;

/**
 * 横屏：按 slots 的 x/y/w（以 16:10 设计）。窗口比 16:10 窄时整组按比例放大（像素宽度不至于缩到读不清），
 * 再整体收进安全区（左右 2–98vw，上沿 minY、下沿 bottom），保留主次比例。
 */
function fitPlaces(list: PanelSpec[], vw: number, vh: number, bottom: number): Record<string, Place> {
  const k = Math.min(1.6, Math.max(1, 1.6 / (vw / vh)));
  const base = list.map((p) => ({ p, x: 50 + (p.x + p.w / 2 - 50) * k - (p.w * k) / 2, y: p.y, w: p.w * k }));
  let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
  for (const b of base) {
    minY = Math.min(minY, b.y); maxY = Math.max(maxY, b.y + hOf(b.p, b.w, vw, vh));
    minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x + b.w);
  }
  const s = Math.min(1, (bottom - minY) / Math.max(1, maxY - minY), 96 / Math.max(1, maxX - minX));
  const cx = (minX + maxX) / 2;
  const lx = cx + (minX - cx) * s, rx = cx + (maxX - cx) * s;
  const shiftX = Math.max(0, 2 - lx) - Math.max(0, rx - 98);
  const out: Record<string, Place> = {};
  for (const b of base) out[b.p.key] = { x: cx + (b.x - cx) * s + shiftX, y: minY + (b.y - minY) * s, w: b.w * s };
  return out;
}

/**
 * 竖屏：不是同宽机械竖排。主镜头 94vw，次要 80vw、过渡小格 66vw，左右交错；文字按原图 0.6 倍以上显示。
 * 整列比可视区高时，返回 pan（vh）：停留阶段整列缓慢上移，像读条漫一样读完。
 */
const PORTRAIT_W: Record<string, number> = { hero: 94, support: 80, insert: 66 };
function columnPlaces(list: PanelSpec[], vw: number, vh: number, top: number, bottom: number): { places: Record<string, Place>; pan: number } {
  const sorted = [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const gap = 2.2;
  const out: Record<string, Place> = {};
  let y = top, side = 0;
  for (const p of sorted) {
    const w = p.aspect > 1.8 ? 94 : PORTRAIT_W[p.role ?? "support"] ?? 80; // 宽格（横幅）在竖屏一律满宽，否则文字太小
    const x = w >= 94 ? 3 : side++ % 2 === 0 ? 3 : 97 - w;
    out[p.key] = { x, y, w };
    y += hOf(p, w, vw, vh) + gap;
  }
  const total = y - gap - top, avail = bottom - top;
  if (total < avail) for (const k in out) out[k].y += (avail - total) / 2; // 放得下就垂直居中
  return { places: out, pan: Math.max(0, total - avail) };
}

/** 背景里的蛋还在桌沿（接蛋之前）时，竖屏底部留给桌沿和蛋 */
const EGG_VISIBLE = new Set(["loop", "toTable", "table", "ready"]);

type Rect = { x: number; y: number; w: number; h: number }; // vw / vh
const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** 背景里活动蛋当前在屏幕上的范围（vw/vh）。只在蛋停在桌沿的段落读取；读不到就返回 null */
function eggRectNow(vw: number, vh: number): Rect | null {
  if (typeof document === "undefined") return null;
  // 读蛋的站点框（不含原地小跳 / 抬头跳），格子不会跟着蛋的跳跃来回移动
  const el = document.querySelector("[data-egg-station]") ?? document.querySelector("img[data-active-egg]");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.bottom < 0 || r.top > vh) return null;
  // 蛋图四周有透明边：取中间 70% 作为蛋身，再留 1.5 的间距
  const m = 0.15;
  return { x: ((r.left + r.width * m) / vw) * 100 - 1.5, y: ((r.top + r.height * m) / vh) * 100 - 1.5, w: ((r.width * (1 - 2 * m)) / vw) * 100 + 3, h: ((r.height * (1 - 2 * m)) / vh) * 100 + 3 };
}
/**
 * 横屏：漫画格不能压在桌沿等待的蛋上（蛋不该从格子下面露出半个）。
 * 依次尝试：移到蛋的右边 → 移到蛋的上方 → 等比缩小到蛋上方；都不和同组其他格重叠才采用。
 */
function avoidEgg(list: PanelSpec[], places: Record<string, Place>, egg: Rect, vw: number, vh: number) {
  const rectOf = (p: PanelSpec, pl: Place): Rect => ({ x: pl.x, y: pl.y, w: pl.w, h: hOf(p, pl.w, vw, vh) });
  for (const p of list) {
    const pl = places[p.key];
    if (!pl || !hit(rectOf(p, pl), egg)) continue;
    const others = list.filter((o) => o.key !== p.key && places[o.key]).map((o) => rectOf(o, places[o.key]));
    const ok = (c: Place) => c.x >= 2 && c.x + c.w <= 98 && c.y >= 2 && c.y + hOf(p, c.w, vw, vh) <= 97 && !hit(rectOf(p, c), egg) && others.every((r) => !hit(rectOf(p, c), r));
    const h = hOf(p, pl.w, vw, vh);
    const cands: Place[] = [
      { ...pl, x: egg.x + egg.w + 1.5 },
      { ...pl, y: egg.y - h - 1.5 },
      { ...pl, x: egg.x + egg.w + 1.5, y: Math.min(pl.y, egg.y - 2) },
    ];
    for (let k = 0.9; k >= 0.6; k -= 0.1) { const w = pl.w * k; cands.push({ x: pl.x, w, y: egg.y - hOf(p, w, vw, vh) - 1.5 }, { x: egg.x + egg.w + 1.5, w, y: pl.y }); }
    const c = cands.find(ok);
    if (c) places[p.key] = c;
  }
}

/** 入场方式（URL ?reveal=flow 切回条漫式整列上移；默认逐格出现） */
function revealMode() {
  if (typeof window === "undefined") return "step";
  return new URLSearchParams(window.location.search).get("reveal") === "flow" ? "flow" : "step";
}

function FlowLayer() {
  const { timeline: t, beats, reducedMotion } = useScene();
  const vp = useViewport();
  const perf = usePerfEnabled() && !reducedMotion; // 格内表演：减少动态效果或 ?perf=0 时用原静态格
  const g = t.index + t.p;
  const index: Record<string, number> = {};
  beats.forEach((b, i) => (index[b.id] = i));
  // 入场方式：默认"逐格出现"（用户 2026-11-14 偏好旧版：每段的格子在原位一张一张出现，停稳阅读，整段一起离开，
  // 下一段的格子不会从屏幕下沿提前露出）；?reveal=flow 是之前的整列随滚动上移（条漫式），留作对比
  const step = revealMode() !== "flow";
  const visible = PANELS.filter((p) => {
    if (p.hideInFlow || index[p.beat] === undefined) return false;
    const q = g - index[p.beat];
    return step ? q >= 0 && q < 1 : q > -0.16 && q < 1.16;
  });
  const groups: Record<string, PanelSpec[]> = {};
  // 提前离场的格（exitAt 早于同段其他格）单独成组排版：它离开后，同段其他格的位置不受影响
  const groupOf = (p: PanelSpec) => (p.exitAt && p.exitAt[1] < 0.7 ? `${p.beat}:solo:${p.key}` : p.beat);
  for (const p of visible) if (p.role !== "closeup") (groups[groupOf(p)] ??= []).push(p);
  // 逐格出现时，独占一段的格子可以有自己的阅读位置（slots.json soloPlace，例如结尾的担心格、回答格），位置换成它再排版
  if (step) for (const [id, list] of Object.entries(groups)) if (list.length === 1 && list[0].soloPlace) groups[id] = [{ ...list[0], ...list[0].soloPlace }];
  const places: Record<string, Place> = {};
  const pans: Record<string, number> = {};
  const egg = EGG_VISIBLE.has(t.beat.egg) || EGG_VISIBLE.has(beats[t.index + 1]?.egg ?? "") ? eggRectNow(vp.w, vp.h) : null;
  for (const [id, list] of Object.entries(groups)) {
    const beatId = id.split(":")[0];
    const eggHere = egg && EGG_VISIBLE.has(beats[index[beatId]].egg) ? egg : null;
    if (vp.portrait && list.length === 1 && list[0].portraitPlace) {
      places[list[0].key] = { ...list[0].portraitPlace };
    } else if (vp.portrait) {
      // 竖屏：整列的下沿停在蛋的上方（蛋在下半屏时），放不下就在停留阶段缓慢上移阅读
      const bottom = eggHere && eggHere.y > 30 ? eggHere.y - 1 : 95;
      const r = columnPlaces(list, vp.w, vp.h, 4, bottom);
      Object.assign(places, r.places);
      for (const p of list) pans[p.key] = r.pan;
    } else {
      Object.assign(places, fitPlaces(list, vp.w, vp.h, 96));
      if (eggHere) avoidEgg(list, places, eggHere, vp.w, vp.h);
    }
  }
  return (
    <div data-comic-flow className="pointer-events-none fixed inset-0 z-10">
      {visible.map((p) => {
        const q = g - index[p.beat];
        if (p.role === "closeup") return <CloseupShot key={p.key} p={p} q={q} portrait={vp.portrait} vw={vp.w} reducedMotion={reducedMotion} seconds={beats[index[p.beat]].seconds} />;
        const i = p.order ?? 0;
        const pos = { ...(places[p.key] ?? { x: p.x, y: p.y, w: p.w }) };
        const hVh = hOf(p, pos.w, vp.w, vp.h);
        const pan = pans[p.key] ?? 0;
        let dy: number, stage: Stage, wrap: CSSProperties | null = null;
        if (step) {
          // 逐格出现：本段进入阶段里按 order 错开，每格从自己的方向（slots.json from）小幅滑入并淡入，停在原位；
          // 退出阶段整段淡出并略向上离开。格子位置仍用新版布局（fitPlaces / columnPlaces）。
          const b = beats[index[p.beat]];
          const ph = b.phases ?? { enter: 0.3, action: 0, hold: 0.45, exit: 0.25 };
          const enterEnd = Math.max(0.05, ph.enter + ph.action * 0.5);
          const exitStart = ph.enter + ph.action + ph.hold;
          const group = groups[groupOf(p)] ?? [p];
          const n = group.length;
          const rank = group.filter((o) => (o.order ?? 0) < i).length;
          const span = n === 1 ? 1 : 0.62;
          const [s0, s1] = p.enterAt ?? (() => { const a = n === 1 ? 0 : (rank * (1 - span)) / (n - 1); return [a * enterEnd, (a + span) * enterEnd]; })();
          const [e0, e1] = p.exitAt ?? [exitStart, 1];
          const k = outCubic(clamp01((q - s0) / Math.max(1e-6, s1 - s0)));
          const x = clamp01((q - e0) / Math.max(1e-6, e1 - e0));
          const [ox, oy] = p.from === "seam" ? [0, 0] : offsetFor(p.from, k);
          const panNow = pan * clamp01((q - s1) / Math.max(1e-6, e0 - s1));
          dy = oy - panNow - 12 * inQuad(x);
          const op = (p.from === "seam" ? k : Math.min(1, k * 1.4)) * (1 - inQuad(x));
          const topVh = pos.y + dy;
          stage = { vis: clamp01((Math.min(100, topVh + hVh) - Math.max(0, topVh)) / hVh) * (op >= 0.95 ? 1 : op), entered: q >= s1 - 0.01, leaving: q > e0 };
          if (ox !== 0) pos.x += ox;
          if (op < 1) wrap = { opacity: op };
        } else {
          const [s0, s1] = p.enterAt ?? [-0.14 + i * 0.05, 0.34];
          const [e0, e1] = p.exitAt ?? [0.7 + i * 0.03, 1.14];
          // 竖屏整列较高时：停留阶段由滚动直接带动缓慢上移（读条漫），离场从上移后的位置继续
          const panNow = pan * clamp01((q - s1) / (e0 - s1));
          const enterOff = 100 - pos.y + 4;
          const exitOff = pos.y - pan + hVh + 4;
          dy = -panNow;
          if (q < s1) dy = enterOff * (1 - outCubic((q - s0) / (s1 - s0)));
          else if (q > e0) dy = -pan - exitOff * inQuad((q - e0) / (e1 - e0));
          // 格内表演的触发看格子在屏幕上的真实状态：入场结束、可见比例、是否开始离场（竖屏整列上移时也成立）
          const topVh = pos.y + dy;
          stage = { vis: clamp01((Math.min(100, topVh + hVh) - Math.max(0, topVh)) / hVh), entered: q >= s1 - 0.02, leaving: q > e0 };
        }
        const reading = perf && stage.entered && !stage.leaving && stage.vis >= 0.9; // 静止读格：妈妈的脸格才会眨眼
        const panel =
          p.key === "p2b" ? <ChopPanel p={p} pos={pos} dy={dy} q={q} stage={stage} animate={perf} />
          : p.key === "p3d" ? <HearPanel p={p} pos={pos} dy={dy} q={q} stage={stage} animate={perf} />
          : p.key === "p2d" ? <StirfryPanel p={p} pos={pos} dy={dy} q={q} stage={stage} animate={perf} />
          : p.key === "p3a" ? <SaucePanel p={p} pos={pos} dy={dy} q={q} stage={stage} animate={perf} />
          : <FlowPanel p={p} pos={pos} dy={dy} blink={perf && BLINK_PANELS.has(p.key) ? reading : null} />;
        // 每一格都派发 comic:panel（到位 / 离场 / 复位），声音会话按格子挂声音
        return <Fragment key={p.key}>{wrap ? <div style={wrap}>{panel}</div> : panel}<PanelSignal k={p.key} q={q} stage={stage} /></Fragment>;
      })}
      {perf && <FrameReact />}
    </div>
  );
}


/**
 * 结尾独立特写：笑点格离开后，妈妈的表情格单独停在画面中央（原图不放大超过 1.4 倍）。
 * 进入阶段由滚动带动轻轻上浮落定；落定后（停留阶段）脸旁依次出现三个手绘感圆点，真实时间、只播一次、停在“…”；回滚到落定前就收起。
 */
function CloseupShot({ p, q, portrait, vw, reducedMotion, seconds }: { p: PanelSpec; q: number; portrait: boolean; vw: number; reducedMotion: boolean; seconds: Record<string, number> }) {
  const aspect = useNaturalAspect(p.src, p.aspect);
  const perfOn = usePerfEnabled();
  const nativeW = 515; // p6f.webp 原始宽度
  // 结尾的妈妈反应是三个大画面之一：最多放大到原图 1.4 倍，避免发虚
  const wPx = portrait ? Math.min(vw * 0.9, nativeW * 1.4) : Math.min(vw * 0.52, nativeW * 1.4);
  const k = outCubic((q + 0.02) / 0.42); // 进入阶段 0.5：0.4 处已落定
  const stable = q >= 0.42;
  if (q < -0.05) return null;
  return (
    <div className="absolute left-1/2 top-1/2" style={{ width: wPx, aspectRatio: `${aspect}`, transform: `translate(-50%, calc(-50% + ${(1 - k) * 7}vh))`, opacity: k }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.src} alt="" draggable={false} className="block h-full w-full select-none object-contain" />
      {/* 眼神僵住：三个点之前不眨眼，最后一个点之后约 1.2 秒才眨第一下 */}
      <ClosingBlink stable={stable} enabled={!reducedMotion && perfOn} afterMs={((seconds.dotDelay ?? 0.5) + 2 * (seconds.dotGap ?? 0.6) + 1.2) * 1000} />
      {stable && <Dots key="dots" instant={reducedMotion} delay={seconds.dotDelay ?? 0.5} gap={seconds.dotGap ?? 0.6} portrait={portrait} />}
    </div>
  );
}

/** 三个点：一个、两个、三个，停在“…”。不循环。墨色取自线稿，形状略不规则（手绘感），每个点出现时只有一次轻微落笔。 */
const DOT_PATHS = [
  "M6.2 1.1C9.3 1.3 11.4 3.6 11.1 6.6 10.8 9.6 8.3 11.4 5.4 11 2.5 10.6 0.7 8.3 1 5.5 1.3 2.8 3.3 0.9 6.2 1.1Z",
  "M5.8 0.9C8.9 0.7 11.2 2.9 11.3 5.9 11.4 9 9.1 11.3 6 11.2 2.9 11.1 0.8 8.8 0.9 5.8 1 3 2.9 1.1 5.8 0.9Z",
  "M6.4 1.3C9.5 1.6 11.3 4 10.9 7 10.5 9.8 8 11.5 5.1 11.1 2.3 10.7 0.6 8.1 1.1 5.3 1.6 2.7 3.6 1 6.4 1.3Z",
];
function Dots({ instant, delay, gap, portrait }: { instant: boolean; delay: number; gap: number; portrait: boolean }) {
  const [n, setN] = useState(instant ? 3 : 0);
  useEffect(() => {
    if (instant) return;
    const ids = [0, 1, 2].map((i) => window.setTimeout(() => setN(i + 1), (delay + i * gap) * 1000));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [instant, delay, gap]);
  // 三个点各配一下"嗒"：和接蛋前画外的三下轻跳是同一组声音，音高逐个降低；声音比点早约 80 ms（先听见，再看见）。
  // 减少动态效果时点一次出齐，但声音仍按同样的节奏响（和切菜格的做法一致）；静音、未解锁、后台时混音器自己丢弃。
  useEffect(() => {
    const TAP = [{ rate: 1, gain: 1 }, { rate: 0.89, gain: 0.85 }, { rate: 0.79, gain: 0.7 }];
    const ids = TAP.map((t, i) => window.setTimeout(
      () => window.dispatchEvent(new CustomEvent(KITCHEN_ONESHOT_EVENT, { detail: { sound: `hopTap${i + 1}`, ...t } })),
      Math.max(0, (delay + i * gap) * 1000 - 80),
    ));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [delay, gap]);
  const size = portrait ? "4vw" : "clamp(14px, 1.35vw, 22px)";
  return (
    <div
      aria-hidden
      className="absolute flex items-center"
      style={portrait ? { right: "4%", top: "calc(100% + 2.2vh)", gap: `calc(${size} * 0.9)` } : { left: "calc(100% + 1.6vw)", top: "40%", gap: `calc(${size} * 0.9)` }}
    >
      {DOT_PATHS.map((d, i) => (
        <svg key={i} viewBox="0 0 12 12" style={{ width: size, height: size, opacity: i < n ? 1 : 0, transform: i < n ? "scale(1)" : "scale(0.55)", transition: instant ? "none" : "opacity 160ms ease-out, transform 220ms cubic-bezier(.3,1.6,.5,1)" }}>
          <path d={d} fill="#3a2418" />
        </svg>
      ))}
      <span className="sr-only">…</span>
    </div>
  );
}

function FlowPanel({ p, pos, dy, blink = null }: { p: PanelSpec; pos: Place; dy: number; blink?: boolean | null }) {
  const aspect = useNaturalAspect(p.src, p.aspect);
  return (
    <div className="absolute will-change-transform" style={{ left: `${pos.x}vw`, top: `${pos.y}vh`, width: `${pos.w}vw`, aspectRatio: `${aspect}`, transform: `translate3d(0, ${dy}vh, 0)` }}>
      {p.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.src} alt="" draggable={false} className="block h-full w-full select-none object-contain" />
      ) : (
        <Placeholder label={p.label ?? ""} />
      )}
      {blink !== null && <BlinkLayer panelKey={p.key} active={blink} />}
    </div>
  );
}

export default function ComicLayer({ flow = false }: { flow?: boolean }) {
  if (flow) return <FlowLayer />;
  return <SlideLayer />;
}

function SlideLayer() {
  const { timeline: t, beats } = useScene();
  const vp = useViewport();
  const beat = beats[t.index];
  const hasCloseup = beats.some((b) => b.id === "closeup");
  const hasWorry = beats.some((b) => b.id === "worry");
  // 旧版节拍表没有 closeup / worry 段：这两段的格子并回 punchline，和以前一样
  const list = PANELS.filter((p) => ((p.beat === "closeup" && !hasCloseup) || (p.beat === "worry" && !hasWorry) ? "punchline" : p.beat) === beat.id);
  const n = Math.max(1, list.length);
  const places = vp.portrait ? stackPlaces(list, vp.w, vp.h) : null;
  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {list.map((p) => {
        // 进入阶段按 order 错开：每格占进入阶段的 1/n + 重叠，减速入场
        const i = p.order ?? 0;
        const span = n === 1 ? 1 : 0.62;
        const start = n === 1 ? 0 : (i * (1 - span)) / (n - 1);
        const local = t.phase === "enter" ? Math.min(1, Math.max(0, (t.phaseP - start) / span)) : 1;
        const k = out3(local);
        const opacity = t.phase === "exit" ? 1 - in2(t.phaseP) : 1;
        const exitShift = t.phase === "exit" ? -in2(t.phaseP) * 12 : 0; // 退出时加速向上离开
        const seamProgress = t.phase === "enter" ? local : 1;
        return <Panel key={p.key} p={p} k={k} opacity={opacity} exitShift={exitShift} seamProgress={seamProgress} place={places?.[p.key]} />;
      })}
    </div>
  );
}
