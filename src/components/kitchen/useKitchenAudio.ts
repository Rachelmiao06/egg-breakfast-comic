"use client";
/**
 * 厨房声音：素材库录音（public/assets/audio/），不合成。
 * - soundOn 为 true 时淡入循环播放滋滋声，false 时淡出暂停。
 * - 文件还没提供（404 / 解码失败）时保持静音，available = false，按钮照常可点。
 * - 浏览器拦截自动播放时，等下一次用户点击再试，不弹窗。
 */
import { useEffect, useRef, useState } from "react";
import { useScene } from "@/lib/scene-context";

const LOOPS = [
  { src: "/assets/audio/sizzle-loop.mp3", volume: 0.55 },
  { src: "/assets/audio/boil-loop.mp3", volume: 0.18 },
];

export function useKitchenAudio() {
  const { soundOn } = useScene();
  const els = useRef<HTMLAudioElement[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let ok = 0;
    let settled = 0;
    const settle = () => {
      settled += 1;
      if (settled === LOOPS.length) setAvailable(ok > 0);
    };
    els.current = LOOPS.map(({ src }) => {
      const a = new Audio();
      a.loop = true;
      a.preload = "auto";
      a.volume = 0;
      a.addEventListener("canplaythrough", () => { ok += 1; settle(); }, { once: true });
      a.addEventListener("error", settle, { once: true });
      a.src = src;
      return a;
    });
    return () => {
      els.current.forEach((a) => { a.pause(); a.src = ""; });
      els.current = [];
    };
  }, []);

  useEffect(() => {
    const list = els.current;
    let raf = 0;
    const fade = (target: (i: number) => number, done?: () => void) => {
      const start = performance.now();
      const from = list.map((a) => a.volume);
      const step = (now: number) => {
        const k = Math.min((now - start) / 800, 1);
        list.forEach((a, i) => { a.volume = from[i] + (target(i) - from[i]) * k; });
        if (k < 1) raf = requestAnimationFrame(step);
        else done?.();
      };
      raf = requestAnimationFrame(step);
    };
    if (soundOn) {
      const tryPlay = () =>
        Promise.all(list.filter((a) => a.readyState > 0 || a.networkState !== 3).map((a) => a.play().catch(() => Promise.reject())))
          .then(() => fade((i) => LOOPS[i].volume))
          .catch(() => {
            const retry = () => { window.removeEventListener("pointerdown", retry); tryPlay(); };
            window.addEventListener("pointerdown", retry, { once: true });
          });
      tryPlay();
    } else {
      fade(() => 0, () => list.forEach((a) => a.pause()));
    }
    return () => cancelAnimationFrame(raf);
  }, [soundOn]);

  return { available };
}
