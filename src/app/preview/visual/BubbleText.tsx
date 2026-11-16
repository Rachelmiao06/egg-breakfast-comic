"use client";
/**
 * 对白泡文字：2026-11-15 用户要求所有的字都和动画一样"几个几个一起出来"，并且字体统一。
 * 图里的字是画死的：先用泡的底色盖住原来那一行字（框由 tools/find_bubble_text.py 从图里量出来，字由人工抄进 bubbles.json），
 * 再用同一套真字体（和 p5b / p6d 的逐字对白一致）按进度两个字两个字地显示。
 * 父元素要 position: absolute / relative 并设 containerType: "inline-size"（字号用 cqw = 父元素宽度的 1%）。
 */
import bubbles from "./bubbles.json";

export type BubbleSpec = { size: number[]; color: number[]; rows: { str: string; box: number[] }[] };
export const BUBBLES = bubbles as Record<string, BubbleSpec>;
/** 对白字体（全站统一） */
export const BUBBLE_FONT = '"PingFang SC","Hiragino Sans GB","Noto Sans SC","Microsoft YaHei",system-ui,sans-serif';
const PAD = 5; // 盖字的矩形比字的外框多出的像素，盖住抗锯齿的边

export function BubbleText({ k, progress }: { k: string; progress: number }) {
  const s = BUBBLES[k];
  if (!s) return null;
  const [W, H] = s.size;
  const bg = `rgb(${s.color[0]}, ${s.color[1]}, ${s.color[2]})`;
  const chars = s.rows.map((r) => [...r.str]);
  const total = chars.reduce((n, c) => n + c.length, 0);
  // 两个字一组：进度一过某个阈值就一组一组地出现
  const shown = progress <= 0 ? 0 : Math.min(total, Math.ceil(progress * (total / 2)) * 2);
  // 字号：全泡统一，取各行"每个字占的宽度"的最大值（标点的墨迹窄，不能拿它定字号）
  const fs = Math.max(...s.rows.map((r, i) => (r.box[2] - r.box[0]) / chars[i].length)) / W * 100;
  const starts = chars.map((_, i) => chars.slice(0, i).reduce((n, c) => n + c.length, 0));
  return (
    <>
      {s.rows.map((r, i) => {
        const [x0, y0, x1, y1] = r.box;
        return (
          <div key={`c${i}`} aria-hidden className="pointer-events-none absolute" style={{ left: `${((x0 - PAD) / W) * 100}%`, top: `${((y0 - PAD) / H) * 100}%`, width: `${((x1 - x0 + 2 * PAD) / W) * 100}%`, height: `${((y1 - y0 + 2 * PAD) / H) * 100}%`, background: bg, borderRadius: 6 }} />
        );
      })}
      {s.rows.map((r, i) => {
        const [x0, y0, , y1] = r.box;
        const from = starts[i];
        return (
          <div key={`t${i}`} aria-hidden className="pointer-events-none absolute whitespace-nowrap" style={{ left: `${(x0 / W) * 100}%`, top: `${(y0 / H) * 100}%`, height: `${((y1 - y0) / H) * 100}%`, display: "flex", alignItems: "center", fontFamily: BUBBLE_FONT, fontWeight: 600, fontSize: `${fs.toFixed(3)}cqw`, lineHeight: 1, color: "#2b2118", textRendering: "geometricPrecision" }}>
            {chars[i].map((c, j) => (
              <span key={j} style={{ opacity: from + j < shown ? 1 : 0, transform: from + j < shown ? "none" : "translateY(0.12em)", transition: "opacity .18s ease-out, transform .18s ease-out" }}>{c}</span>
            ))}
          </div>
        );
      })}
      <span className="sr-only">{s.rows.map((r) => r.str).join("")}</span>
    </>
  );
}
