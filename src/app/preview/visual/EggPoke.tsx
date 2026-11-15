"use client";
/**
 * 彩蛋：点那颗活动蛋（后景桌沿 / 锅里 / 空饭桌的碗里）。蛋回一个小跳，同时"啵"一声，每次音高不同（蛋自己的语言）。
 * 只有蛋看得见、没在飞行时才响应；点到别处什么也不发生。鼠标移到蛋上时光标变成手指。
 * 声音走 kitchen:oneshot（rate 是播放速度，音高跟着变），静音 / 未解锁时混音器自己丢弃。
 */
import { useEffect } from "react";
import { EGG_POKE_EVENT } from "@/components/kitchen/Egg";
import { KITCHEN_ONESHOT_EVENT } from "@/components/kitchen/useKitchenAudio";

const RATES = [0.8, 0.9, 1, 1.12, 1.26, 1.4];

function overEgg(x: number, y: number): boolean {
  const w = document.querySelector<HTMLElement>("[data-egg-station]");
  const img = w?.querySelector<HTMLElement>("[data-active-egg]");
  if (!w || !img || parseFloat(getComputedStyle(w).opacity) < 0.6) return false;
  const r = img.getBoundingClientRect();
  const padX = r.width * 0.04, padY = r.height * 0.04;
  return x >= r.left + padX && x <= r.right - padX && y >= r.top + padY && y <= r.bottom;
}

export default function EggPoke() {
  useEffect(() => {
    let last = -1;
    let hand = false;
    const onMove = (e: PointerEvent) => {
      const on = e.pointerType === "mouse" && overEgg(e.clientX, e.clientY);
      if (on !== hand) { hand = on; document.documentElement.style.cursor = on ? "pointer" : ""; }
    };
    const onUp = (e: PointerEvent) => {
      if (!overEgg(e.clientX, e.clientY)) return;
      let i = Math.floor(Math.random() * RATES.length);
      if (i === last) i = (i + 1) % RATES.length;
      last = i;
      window.dispatchEvent(new CustomEvent(KITCHEN_ONESHOT_EVENT, { detail: { sound: "pop", rate: RATES[i], gain: 1.3 } }));
      window.dispatchEvent(new CustomEvent(EGG_POKE_EVENT));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.style.cursor = "";
    };
  }, []);
  return null;
}
