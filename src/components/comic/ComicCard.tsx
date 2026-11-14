"use client";
/**
 * 前景漫画的三种小零件：纸卡（ComicCard）、对话气泡（SpeechBubble）、占位锅铲（PlaceholderSpatula）。
 * 都是绝对定位在一段的组盒里，坐标是组盒百分比（见 story.ts）。
 * 纸纹和手绘感只用 CSS（圆角不规则 + 噪点叠层），不画任何"画风"图形。
 */
import type { CSSProperties } from "react";
import { EGG_CATCH } from "./catch-point";
import { PLACEHOLDER_DIR, imgSize, type BubbleSpec, type CardSpec } from "./story";

/** 轻微纸纹：feTurbulence 噪点，叠在纸卡上 6% 左右。 */
const PAPER_NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.42 0 0 0 0 0.29 0 0 0 0 0.17 0 0 0 0.35 0'/></filter><rect width='120' height='120' filter='url(%23n)'/></svg>\")";

/** 绝对定位（桌面）/ 流式（窄屏）切换。 */
const POS = "absolute left-(--cx) top-(--cy) w-(--cw) max-sm:static max-sm:mx-auto max-sm:my-2 max-sm:w-[72%]";

/** 手绘感的不规则圆角。 */
const WOBBLY_RADIUS = "14px 10px 16px 9px / 10px 15px 9px 14px";

export function ComicCard({ card }: { card: CardSpec }) {
  const { w, h } = imgSize(card.img);
  // 桌面：组盒百分比绝对定位；窄屏（max-sm）：改成竖向流式排布，宽度固定，见 POS 类名。
  const style = {
    "--cx": `${card.x}%`,
    "--cy": `${card.y}%`,
    "--cw": `${card.w}%`,
    aspectRatio: `${w} / ${h}`,
    transform: `rotate(${card.rotate ?? 0}deg)`,
  } as CSSProperties;
  const imgStyle: CSSProperties = card.flip ? { transform: "scaleX(-1)" } : {};

  if (card.cutout) {
    // 透明底的人物：不垫纸卡，只给一点柔和投影，让它像贴在空气里
    return (
      <div data-comic-card className={`${POS} will-change-transform`} style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${PLACEHOLDER_DIR}${card.img}.png`}
          alt=""
          draggable={false}
          className="block h-full w-full select-none [filter:drop-shadow(0_6px_10px_rgba(107,74,43,0.22))]"
          style={imgStyle}
        />
        {card.label && <PlaceholderTag text={card.label} />}
      </div>
    );
  }

  return (
    <div
      data-comic-card
      className={`${POS} overflow-hidden bg-cream p-[1.2%] shadow-[0_10px_24px_-8px_rgba(107,74,43,0.45),0_2px_4px_rgba(107,74,43,0.12)] ring-2 ring-ink/25 will-change-transform`}
      style={{ ...style, borderRadius: WOBBLY_RADIUS }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${PLACEHOLDER_DIR}${card.img}.png`}
        alt=""
        draggable={false}
        className="block h-full w-full select-none rounded-[8px] object-cover"
        style={imgStyle}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-multiply" style={{ backgroundImage: PAPER_NOISE }} />
      {card.label && <PlaceholderTag text={card.label} />}
    </div>
  );
}

function PlaceholderTag({ text }: { text: string }) {
  return (
    <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] leading-tight text-cream">
      {text}
    </span>
  );
}

export function SpeechBubble({ bubble }: { bubble: BubbleSpec }) {
  const tail = bubble.tail ?? "bl";
  const tailPos: CSSProperties =
    tail === "bl"
      ? { left: "14%", bottom: -9, transform: "rotate(45deg)" }
      : tail === "br"
        ? { right: "14%", bottom: -9, transform: "rotate(45deg)" }
        : tail === "tl"
          ? { left: "14%", top: -9, transform: "rotate(45deg)" }
          : { right: "14%", top: -9, transform: "rotate(45deg)" };
  return (
    <div
      data-comic-bubble
      className="absolute left-(--cx) top-(--cy) w-(--cw) will-change-transform max-sm:static max-sm:mx-auto max-sm:my-3 max-sm:w-[84%]"
      style={{ "--cx": `${bubble.x}%`, "--cy": `${bubble.y}%`, "--cw": `${bubble.w ?? 40}%` } as CSSProperties}
    >
      <div
        className="relative bg-cream px-[1.1em] py-[0.6em] text-[clamp(14px,2.2vw,22px)] font-semibold leading-snug tracking-wide text-ink shadow-[0_6px_16px_-6px_rgba(107,74,43,0.4)] ring-2 ring-ink/70"
        style={{ borderRadius: "22px 18px 24px 16px / 18px 24px 16px 22px", fontFamily: '"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC",system-ui,sans-serif' }}
      >
        {bubble.text}
        <span aria-hidden className="absolute h-4 w-4 bg-cream ring-2 ring-ink/70" style={{ ...tailPos, clipPath: tail.startsWith("b") ? "polygon(0 100%, 100% 100%, 100% 0)" : "polygon(0 0, 100% 0, 0 100%)" }} />
      </div>
    </div>
  );
}

/**
 * 占位锅铲：从妈妈卡片左侧伸出来的一块铲面，铲尖停在接触点。
 * 分两层渲染：铲面（在 catchSlot 之下）和铲面前沿（在 catchSlot 之上，`data-egg-occluder`），
 * 蛋落定后下缘被前沿挡住一点。正式图里会换成画出来的锅铲，分层方式不变。
 */
export function PlaceholderSpatula({ layer }: { layer: "blade" | "lip" }) {
  const { x, y, angle, bladeLength } = EGG_CATCH;
  if (layer === "blade") {
    return (
      <div
        aria-hidden
        className="absolute h-[2.4%] origin-left rounded-[6px_14px_14px_6px] bg-[#8a6a4a] shadow-[0_3px_6px_rgba(60,40,20,0.3)] ring-2 ring-ink/50"
        style={{ left: `${x}%`, top: `${y}%`, width: `${bladeLength}%`, transform: `translateY(-50%) rotate(${angle}deg)` }}
      />
    );
  }
  return (
    <div
      data-egg-occluder
      aria-hidden
      className="absolute h-[3.6%] w-[1.4%] origin-left rounded-full bg-[#a07d57] ring-2 ring-ink/60"
      style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-40%, -60%) rotate(${angle}deg)` }}
    />
  );
}
