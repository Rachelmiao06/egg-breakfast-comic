"use client";
/**
 * 眨眼：妈妈的脸格在"静止读格"时偶尔眨一下，让静态漫画里的人是活的。
 * 补丁是和原格同尺寸的透明层（tools/prepare_blink.py 生成：双眼填回皮肤色 + 一条闭合的睫毛线），硬切盖上约 0.12 秒再移开，
 * 不做淡入淡出，也不动整张脸（和 p3d 抬眼格的换眉眼同一个规矩）。
 *
 * - 只在格子真的"在读"时眨：入场结束、没有开始离场、可见 ≥ 90%（和格内表演的开始条件一致）。不满足就立刻睁眼、停表。
 * - 间隔随机：第一次在稳定后约 1.6–3.2 秒，之后每隔 3.4–6.8 秒；五分之一是连眨两下。
 * - 结尾特写 p6f 不走这套：那一格"眼神僵住"，三个点出现之前一直不眨，三个点之后才眨第一下（见 ClosingBlink）。
 * - 减少动态效果或 ?perf=0：整层不渲染。
 */
import { useEffect, useRef } from "react";

export const BLINK_PANELS = new Set(["p1c", "p3c", "p4e", "p5b", "p6b"]);
const P = "/assets/comic-v3/perf/";
const patch = (key: string) => `${P}${key}-blink.webp`;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function BlinkLayer({ panelKey, active }: { panelKey: string; active: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = (on: boolean) => { el.style.opacity = on ? "1" : "0"; };
    if (!active) { show(false); return; }
    const ids: number[] = [];
    const later = (fn: () => void, ms: number) => { ids.push(window.setTimeout(fn, ms)); };
    const blinkOnce = (done: () => void) => {
      show(true);
      later(() => { show(false); done(); }, 120);
    };
    const schedule = (ms: number) => later(() => {
      blinkOnce(() => {
        if (Math.random() < 0.2) later(() => blinkOnce(() => schedule(rand(3400, 6800))), 110); // 连眨两下
        else schedule(rand(3400, 6800));
      });
    }, ms);
    schedule(rand(1600, 3200));
    return () => { ids.forEach((id) => window.clearTimeout(id)); show(false); };
  }, [active]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src={patch(panelKey)} alt="" draggable={false} aria-hidden className="pointer-events-none absolute inset-0 block h-full w-full select-none" style={{ opacity: 0 }} />
  );
}

/**
 * 结尾特写的第一次眨眼：三个点出现之前她一直睁着眼不动，最后一个点之后过 afterMs 眨一次（略慢），然后不再眨。
 * stable 变 false（回滚离开）时取消；再次稳定会重新计时，和三个点一起重播。
 */
export function ClosingBlink({ stable, afterMs, enabled }: { stable: boolean; afterMs: number; enabled: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || !stable) return;
    const ids: number[] = [];
    ids.push(window.setTimeout(() => { el.style.opacity = "1"; }, afterMs));
    ids.push(window.setTimeout(() => { el.style.opacity = "0"; }, afterMs + 170));
    return () => { ids.forEach((id) => window.clearTimeout(id)); el.style.opacity = "0"; };
  }, [stable, afterMs, enabled]);
  if (!enabled) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src={patch("p6f")} alt="" draggable={false} aria-hidden className="pointer-events-none absolute inset-0 block h-full w-full select-none" style={{ opacity: 0 }} />
  );
}
