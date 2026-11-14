/**
 * 手绘漫画的小零件（只在 /demo/scroll-motion 用）：抖动的手绘框、对白气泡、不规则留白。
 * 全部是 SVG / CSS，不重画任何素材；抖动用固定种子，保证每次渲染一致（SSR 与客户端一致）。
 */
import type { CSSProperties, ReactNode } from "react";

export const INK = "#6b4a2b";
export const CREAM = "#fbf3e4";

/** 固定种子的伪随机，保证线条每次都一样 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296 - 0.5;
  };
}

/** 一条手绘感的矩形路径：每隔约 48px 一个点，轻微抖动 */
export function wobblyRect(w: number, h: number, seed: number, amp = 1.6) {
  const r = rng(seed);
  const pts: [number, number][] = [];
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 48));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      pts.push([x0 + (x1 - x0) * t + r() * amp, y0 + (y1 - y0) * t + r() * amp]);
    }
  };
  edge(0, 0, w, 0);
  edge(w, 0, w, h);
  edge(w, h, 0, h);
  edge(0, h, 0, 0);
  return `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L")} Z`;
}

/** 细棕色手绘漫画框：里面放画，框线压在画上面 */
export function HandFrame({
  w,
  h,
  seed,
  style,
  children,
  fill = CREAM,
}: {
  w: number;
  h: number;
  seed: number;
  style?: CSSProperties;
  children: ReactNode;
  fill?: string;
}) {
  const d = wobblyRect(w, h, seed);
  const id = `clip-${seed}`;
  return (
    <div className="absolute" style={{ width: w, height: h, ...style }}>
      <svg width={w} height={h} className="absolute inset-0 overflow-visible" aria-hidden>
        <defs>
          <clipPath id={id}>
            <path d={d} />
          </clipPath>
        </defs>
        <path d={d} fill={fill} />
      </svg>
      <div className="absolute inset-0" style={{ clipPath: `url(#${id})` }}>
        {children}
      </div>
      <svg width={w} height={h} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
        <path d={d} fill="none" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
        {/* 第二笔很淡、略偏一点，像铅笔起稿留下的线 */}
        <path d={wobblyRect(w, h, seed + 7, 2.4)} fill="none" stroke={INK} strokeOpacity={0.25} strokeWidth={1.2} />
      </svg>
    </div>
  );
}

/**
 * 对白气泡：手绘椭圆 + 尾巴，尾巴和气泡连在一起（不画接缝）。
 * box = 气泡外接框（画板像素），tail = 尾巴尖的位置（画板像素）。
 */
export function Bubble({
  box,
  tail,
  children,
  seed,
  fontSize = 26,
  className = "",
}: {
  box: { x: number; y: number; w: number; h: number };
  tail: { x: number; y: number };
  children: ReactNode;
  seed: number;
  fontSize?: number;
  className?: string;
}) {
  const r = rng(seed);
  const pad = 40;
  const cx = box.w / 2 + pad;
  const cy = box.h / 2 + pad;
  const rx = box.w / 2;
  const ry = box.h / 2;
  // 手绘椭圆：16 个点，半径轻微起伏，用二次曲线连成闭合
  const n = 16;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + r() * 0.05;
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k] as const;
  });
  const mid = (i: number) => {
    const a = pts[i % n], b = pts[(i + 1) % n];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  };
  let d = `M${mid(0)[0].toFixed(1)},${mid(0)[1].toFixed(1)}`;
  for (let i = 1; i <= n; i++) {
    const c = pts[i % n], m = mid(i);
    d += ` Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${m[0].toFixed(1)},${m[1].toFixed(1)}`;
  }
  d += " Z";
  // 尾巴：从气泡边上两点收到尾巴尖，略带弧度
  const tx = tail.x - box.x + pad;
  const ty = tail.y - box.y + pad;
  const ang = Math.atan2(ty - cy, tx - cx);
  const base = (off: number) => [cx + Math.cos(ang + off) * rx * 0.82, cy + Math.sin(ang + off) * ry * 0.82] as const;
  const b1 = base(-0.22), b2 = base(0.22);
  const tailD = `M${b1[0].toFixed(1)},${b1[1].toFixed(1)} Q${((b1[0] + tx) / 2 + 6).toFixed(1)},${((b1[1] + ty) / 2).toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)} Q${((b2[0] + tx) / 2).toFixed(1)},${((b2[1] + ty) / 2 - 4).toFixed(1)} ${b2[0].toFixed(1)},${b2[1].toFixed(1)} Z`;
  const W = box.w + pad * 2, H = box.h + pad * 2;
  return (
    <div className={`absolute ${className}`} style={{ left: box.x - pad, top: box.y - pad, width: W, height: H }}>
      <svg width={W} height={H} className="absolute inset-0 overflow-visible" aria-hidden>
        <path d={tailD} fill={CREAM} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
        <path d={d} fill={CREAM} stroke={INK} strokeWidth={2.4} />
        {/* 盖住气泡边线和尾巴相接的那一小段，让尾巴和气泡连成一体 */}
        <path d={tailD} fill={CREAM} transform={`translate(${(cx - tx) * 0.03} ${(cy - ty) * 0.03})`} />
      </svg>
      <div
        className="absolute grid place-items-center text-center leading-snug"
        style={{ left: pad, top: pad, width: box.w, height: box.h, fontSize, color: INK, padding: "0 18px" }}
      >
        {children}
      </div>
    </div>
  );
}

/** 不规则的留白纸片（旁白、近景底） */
export function PaperBlob({ w, h, seed, style, opacity = 1 }: { w: number; h: number; seed: number; style?: CSSProperties; opacity?: number }) {
  const r = rng(seed);
  const n = 14;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + r() * 0.12;
    // 圆角矩形式的超椭圆，边更平、角更圆
    const c = Math.cos(a), s = Math.sin(a);
    const e = 0.45;
    const x = Math.sign(c) * Math.abs(c) ** e;
    const y = Math.sign(s) * Math.abs(s) ** e;
    return [w / 2 + x * (w / 2) * k * 0.95, h / 2 + y * (h / 2) * k * 0.95] as const;
  });
  const mid = (i: number) => {
    const a = pts[i % n], b = pts[(i + 1) % n];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  };
  let d = `M${mid(0)[0].toFixed(1)},${mid(0)[1].toFixed(1)}`;
  for (let i = 1; i <= n; i++) {
    const c = pts[i % n], m = mid(i);
    d += ` Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${m[0].toFixed(1)},${m[1].toFixed(1)}`;
  }
  return (
    <svg width={w} height={h} className="absolute overflow-visible" style={style} aria-hidden>
      <path d={d + " Z"} fill={CREAM} fillOpacity={opacity} />
    </svg>
  );
}
