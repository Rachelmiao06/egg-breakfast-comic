"use client";
/**
 * 鼠标碰到画格时那一格的小动作（做法同 EggPoke：整页只挂一个 pointermove，用位置判断；画格层 pointer-events: none，
 * 所以不会挡住滚动和其他交互）：浮起一点、朝鼠标方向轻轻倾斜、投影加深、高光跟着指针走；移开后带一点回弹落回去。
 * 只作用于鼠标（触屏没有悬停），减少动态效果时不动。
 * 运动全部走 CSS 的独立属性 translate / scale / rotate（globals.css .panel-frame[data-hover]），
 * 不碰元素原有的 inline transform（进场、阅读位移还在用它）。
 */
import { useEffect } from "react";

const MAX_TILT = 4.5; // 度
const STICKY = 8; // 已悬停的格子，边缘外多少像素内仍算在上面（抬起后矩形会变，防止边缘抖动）

export default function PanelHover() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cur: HTMLElement | null = null;

    const release = (el: HTMLElement | null) => {
      if (!el) return;
      el.removeAttribute("data-hover");
      for (const k of ["--ph-rx", "--ph-ry", "--ph-rm", "--sheen"]) el.style.removeProperty(k);
    };
    const hit = (x: number, y: number, pad: number, el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad && parseFloat(getComputedStyle(el).opacity) > 0.6;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      let next: HTMLElement | null = cur && hit(e.clientX, e.clientY, STICKY, cur) ? cur : null;
      if (!next) {
        const all = document.querySelectorAll<HTMLElement>(".panel-frame");
        for (let i = all.length - 1; i >= 0; i--) if (hit(e.clientX, e.clientY, 0, all[i])) { next = all[i]; break; }
      }
      if (next !== cur) { release(cur); cur = next; }
      if (!cur) return;
      const r = cur.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      const ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      const a = -ny * MAX_TILT, b = nx * MAX_TILT; // rotateX / rotateY（度）→ 合成一个轴角
      cur.setAttribute("data-hover", "");
      cur.style.setProperty("--ph-rx", a.toFixed(3));
      cur.style.setProperty("--ph-ry", b.toFixed(3));
      cur.style.setProperty("--ph-rm", Math.hypot(a, b).toFixed(3));
      cur.style.setProperty("--sheen", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    };
    const onLeave = () => { release(cur); cur = null; };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      release(cur);
    };
  }, []);
  return null;
}
