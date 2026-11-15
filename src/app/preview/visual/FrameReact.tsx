"use client";
/**
 * 画框是实物：格外的活东西（那颗蛋）和格里的纸互相知道对方存在。
 * - 蛋落地（egg:land，真实时间的小跳落回桌面 / 锅里的那一下）时，离它近的格子框被"震"一下：朝远离蛋的方向抖约两个像素再回来，
 *   带一点点倾斜，距离越近越明显。用 Web Animations 的 translate / rotate 单独属性，不碰格子本身 transform（那是滚动在控制）。
 * - 蛋靠近格子时，纸面透出一点暖黄的光（软光混合的径向渐变，圆心跟着蛋的屏幕位置，强度随距离衰减）；蛋在漫画格后面时最强。
 *   光层是每格一个叠在格子上的不接收指针的 div，每帧读蛋和格子的屏幕位置更新，只改 opacity 和背景圆心。
 * 减少动态效果或 ?perf=0 时不挂载。蛋不可见（交接后、飞行中被镜头藏起）时光层全灭。
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { EGG_LAND_EVENT } from "@/components/kitchen/Egg";

const RANGE_VW = 0.22; // 影响范围：视口宽的 22%
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function eggNow(): { cx: number; cy: number } | null {
  const w = document.querySelector<HTMLElement>("[data-egg-station]");
  const img = w?.querySelector<HTMLElement>("[data-active-egg]");
  if (!w || !img) return null;
  if (parseFloat(getComputedStyle(w).opacity) < 0.4) return null;
  const r = img.getBoundingClientRect();
  if (r.width < 2) return null;
  return { cx: r.left + r.width / 2, cy: r.top + r.height * 0.55 };
}

/** 蛋中心到格子矩形的距离（在矩形里面 = 0） */
function gap(pr: DOMRect, cx: number, cy: number) {
  const dx = Math.max(pr.left - cx, 0, cx - pr.right), dy = Math.max(pr.top - cy, 0, cy - pr.bottom);
  return Math.hypot(dx, dy);
}

export default function FrameReact() {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const layer = box.current;
    const root = layer?.parentElement;
    if (!layer || !root) return;
    const panels = () => [...root.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el.classList.contains("will-change-transform"));
    const glows = new Map<HTMLElement, HTMLDivElement>();

    const tick = () => {
      const egg = eggNow();
      const list = panels();
      const range = Math.max(160, window.innerWidth * RANGE_VW);
      for (const el of list) {
        let g = glows.get(el);
        if (!g) {
          g = document.createElement("div");
          g.setAttribute("aria-hidden", "true");
          g.style.cssText = "position:absolute;pointer-events:none;mix-blend-mode:soft-light;opacity:0;border-radius:6px";
          layer.appendChild(g);
          glows.set(el, g);
        }
        const pr = el.getBoundingClientRect();
        if (!egg || pr.width < 40) { g.style.opacity = "0"; continue; }
        const s = Math.pow(clamp01(1 - gap(pr, egg.cx, egg.cy) / range), 1.6);
        if (s < 0.015) { g.style.opacity = "0"; continue; }
        const inset = Math.max(4, pr.width * 0.025);
        g.style.left = `${pr.left + inset}px`;
        g.style.top = `${pr.top + inset}px`;
        g.style.width = `${pr.width - inset * 2}px`;
        g.style.height = `${pr.height - inset * 2}px`;
        g.style.background = `radial-gradient(circle ${Math.round(range * 1.5)}px at ${Math.round(egg.cx - pr.left - inset)}px ${Math.round(egg.cy - pr.top - inset)}px, rgba(255,186,52,0.95), rgba(255,186,52,0) 72%)`;
        g.style.opacity = String(Math.min(0.85, s * 1.1).toFixed(3));
      }
      for (const [el, g] of glows) if (!list.includes(el)) { g.remove(); glows.delete(el); }
    };
    gsap.ticker.add(tick);

    const onLand = () => {
      const egg = eggNow();
      if (!egg) return;
      const range = Math.max(160, window.innerWidth * RANGE_VW) * 1.25;
      for (const el of panels()) {
        const pr = el.getBoundingClientRect();
        const d = gap(pr, egg.cx, egg.cy);
        if (d > range || pr.width < 40) continue;
        const s = Math.pow(clamp01(1 - d / range), 1.2);
        const ux = (pr.left + pr.width / 2 - egg.cx), uy = (pr.top + pr.height / 2 - egg.cy);
        const len = Math.hypot(ux, uy) || 1;
        const amp = 2.4 * s; // 像素
        const tilt = (ux >= 0 ? 1 : -1) * 0.14 * s; // 度
        el.animate(
          [
            { translate: "0px 0px", rotate: "0deg" },
            { translate: `${(ux / len) * amp}px ${(uy / len) * amp}px`, rotate: `${tilt}deg`, offset: 0.3 },
            { translate: `${(-ux / len) * amp * 0.35}px ${(-uy / len) * amp * 0.35}px`, rotate: `${-tilt * 0.4}deg`, offset: 0.65 },
            { translate: "0px 0px", rotate: "0deg" },
          ],
          { duration: 180, easing: "ease-out" },
        );
      }
    };
    window.addEventListener(EGG_LAND_EVENT, onLand);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener(EGG_LAND_EVENT, onLand);
      for (const g of glows.values()) g.remove();
      glows.clear();
    };
  }, []);
  return <div ref={box} aria-hidden className="pointer-events-none absolute inset-0" />;
}
