"use client";
/**
 * 数据驱动的漫画页（comic-scroll 分支）。规格：docs/COMIC-PAGES.md。
 *
 * - 一页一张米白纸面，没有大圆角、没有投影；格与格之间是纸面留白。
 * - 框线是细棕色（--ink）2.2px 的"钢笔线"：四条边分开画，端点略过角、每条边微微弯，抖动由每格 seed 决定，所以每格略不同。
 * - 文字参与构图：旁白框贴格角，对白气泡带尾巴，拟声词手写斜放；字号 ≥ 18px，深棕色。
 * - 格内清楚、稳定：占位是不透明的浅色斜线底纹 + 说明文字；有图时 object-fit: contain，不拉伸、不裁切。
 * - 本组件不读 timeline、不做任何滚动动效（新图到位后再接）。
 */
import type { CSSProperties } from "react";
import type { ComicPage as ComicPageData, Corner, Panel, PanelText } from "./pages";

/** 圆润手写感的中文字体；系统没有圆体时退到黑体 */
export const HAND_FONT = '"Yuanti SC","Yuanti TC","PingFang SC","Hiragino Sans GB",system-ui,sans-serif';

const PAD = 28;
const GAP = 18;
const ROW_GAP = 22;
const INK = "var(--ink)";
const STROKE = 2.2;

/** 可复现的伪随机（mulberry32），同一个 seed 每次渲染得到同样的抖动，SSR 和客户端一致 */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 手绘框线：viewBox 0–1000，preserveAspectRatio none 贴满格子，线宽用 non-scaling-stroke 保持像素粗细。
 * 四条边各自一条二次曲线，起止点略过角 3–9 个单位（≈ 像钢笔画过头），中点向内外弯 2–5 个单位。
 */
export function DrawnFrame({ seed }: { seed: number }) {
  const r = rng(seed);
  const j = (amp: number) => (r() * 2 - 1) * amp;
  const over = () => 3 + r() * 6;
  // 四个角的实际落点（略不对齐）
  const c = {
    tl: { x: 0 + j(4), y: 0 + j(4) },
    tr: { x: 1000 + j(4), y: 0 + j(4) },
    br: { x: 1000 + j(4), y: 1000 + j(4) },
    bl: { x: 0 + j(4), y: 1000 + j(4) },
  };
  const edge = (a: { x: number; y: number }, b: { x: number; y: number }, horizontal: boolean) => {
    const o1 = over(), o2 = over();
    const ax = horizontal ? a.x - Math.sign(b.x - a.x) * o1 : a.x;
    const ay = horizontal ? a.y : a.y - Math.sign(b.y - a.y) * o1;
    const bx = horizontal ? b.x + Math.sign(b.x - a.x) * o2 : b.x;
    const by = horizontal ? b.y : b.y + Math.sign(b.y - a.y) * o2;
    const mx = (ax + bx) / 2 + (horizontal ? 0 : j(5));
    const my = (ay + by) / 2 + (horizontal ? j(5) : 0);
    return `M${ax.toFixed(1)} ${ay.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
  };
  const d = [edge(c.tl, c.tr, true), edge(c.tr, c.br, false), edge(c.br, c.bl, true), edge(c.bl, c.tl, false)].join(" ");
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 1000 1000" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={INK} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Placeholder({ panel }: { panel: Panel }) {
  return (
    <div
      data-placeholder
      className="absolute inset-0 grid place-items-center p-[6%] text-center"
      style={{
        background: "repeating-linear-gradient(135deg, rgba(107,74,43,0.09) 0 2px, transparent 2px 14px), var(--cream)",
        color: "rgba(107,74,43,0.78)",
        fontFamily: HAND_FONT,
      }}
    >
      <div>
        <div className="text-[13px] tracking-[0.08em]">
          占位 · {panel.id} {panel.shot}
        </div>
        <div className="mt-1.5 text-[15px] leading-relaxed">{panel.content}</div>
        <div className="mt-2 text-[13px] tracking-[0.04em] opacity-80">
          {panel.ratio[0]}:{panel.ratio[1]} · 建议出图 {panel.size}
        </div>
      </div>
    </div>
  );
}

const CORNER_STYLE: Record<Corner, CSSProperties> = {
  tl: { left: -6, top: -8, transform: "rotate(-0.8deg)" },
  tr: { right: -6, top: -8, transform: "rotate(0.6deg)" },
  bl: { left: -6, bottom: -8, transform: "rotate(0.7deg)" },
  br: { right: -6, bottom: -8, transform: "rotate(-0.6deg)" },
};

function Text({ t }: { t: PanelText }) {
  if (t.kind === "caption") {
    return (
      <div
        data-caption
        className="absolute z-10 px-3 py-1.5 leading-snug"
        style={{ ...CORNER_STYLE[t.corner], background: "var(--cream)", border: `${STROKE}px solid ${INK}`, color: INK, fontFamily: HAND_FONT, fontSize: 18, maxWidth: "80%" }}
      >
        {t.text}
      </div>
    );
  }
  if (t.kind === "sfx") {
    return (
      <div
        data-sfx
        aria-label={t.text}
        className="absolute z-10 whitespace-nowrap font-bold"
        style={{ left: t.left, top: t.top, transform: `rotate(${t.rotate}deg)`, color: INK, fontFamily: HAND_FONT, fontSize: t.size, letterSpacing: "0.06em" }}
      >
        {[...t.text].map((ch, i) => (
          <span key={i} className="inline-block" style={{ transform: `translateY(${(i % 2) * 3 + Math.floor(i / 2) * 4}px) rotate(${(i % 3) * 3 - 3}deg)` }}>
            {ch}
          </span>
        ))}
      </div>
    );
  }
  // bubble
  return (
    <div data-bubble className="absolute z-10" style={{ left: t.left, top: t.top, maxWidth: t.maxWidth }}>
      <div
        className="relative px-5 py-3 leading-relaxed"
        style={{
          background: "var(--cream)",
          border: `${STROKE}px solid ${INK}`,
          borderRadius: "52% 48% 46% 54% / 58% 44% 56% 42%",
          color: INK,
          fontFamily: HAND_FONT,
          fontSize: 20,
        }}
      >
        {t.text}
      </div>
      {/* 尾巴：从气泡边缘 (x, y) 伸出，朝 angle 方向；根部盖一小块奶油色遮掉气泡边线 */}
      <svg aria-hidden className="absolute overflow-visible" width="26" height="30" viewBox="0 0 26 30" style={{ left: t.tail.x, top: t.tail.y, transform: `translate(-13px, -4px) rotate(${t.tail.angle - 90}deg)`, transformOrigin: "13px 4px" }}>
        <path d="M3 4 Q 10 14 13 29 Q 15 14 23 4" fill="var(--cream)" stroke={INK} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
        <rect x="4" y="0" width="18" height="6" fill="var(--cream)" />
      </svg>
    </div>
  );
}

function PanelView({ panel }: { panel: Panel }) {
  return (
    <figure data-panel-id={panel.id} className="relative m-0 min-w-0" style={{ flex: `${panel.flex} 1 0`, aspectRatio: `${panel.ratio[0]} / ${panel.ratio[1]}` }}>
      {panel.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={panel.src} alt={`${panel.shot}：${panel.content}`} draggable={false} className="absolute inset-0 h-full w-full select-none object-contain" />
      ) : (
        <Placeholder panel={panel} />
      )}
      {panel.frame === "drawn" && <DrawnFrame seed={panel.seed} />}
      {panel.texts.map((t, i) => (
        <Text key={i} t={t} />
      ))}
    </figure>
  );
}

/** 一页纸面。宽度由外面给（style.width），高度随格子比例自然得出。 */
export default function ComicPage({ page, style, className = "" }: { page: ComicPageData; style?: CSSProperties; className?: string }) {
  return (
    <section data-comic-page={page.id} aria-label={page.title} className={`relative ${className}`} style={{ background: "var(--paper)", padding: PAD, ...style }}>
      {page.rows.map((row, i) => (
        <div key={i} className="flex items-start" style={{ gap: GAP, marginTop: i === 0 ? 0 : ROW_GAP }}>
          {row.panels.map((p) => (
            <PanelView key={p.id} panel={p} />
          ))}
        </div>
      ))}
    </section>
  );
}
