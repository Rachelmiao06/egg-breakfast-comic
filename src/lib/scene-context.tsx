"use client";
/**
 * 全站共享状态（集成会话维护；各分支只读或只调用对应 setter）。
 * - soundOn:     用户是否打开了声音（kitchen-scene 读写）
 * - progress:    0 = 厨房开场完整可见，1 = 已完全进入漫画阅读（comic-scroll 写，kitchen 读）
 * - activePanel: 当前处于阅读位的漫画格 1–6，0 = 还没进入漫画（comic-scroll 写）
 * - reducedMotion / isTouch: 环境能力
 */
import { createContext, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

/** 订阅一个 media query，SSR 时返回 false。 */
function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

type SceneState = {
  soundOn: boolean;
  setSoundOn: (v: boolean) => void;
  progress: number;
  setProgress: (v: number) => void;
  activePanel: number;
  setActivePanel: (n: number) => void;
  reducedMotion: boolean;
  isTouch: boolean;
};

const Ctx = createContext<SceneState | null>(null);

export function SceneProvider({ children }: { children: ReactNode }) {
  const [soundOn, setSoundOn] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activePanel, setActivePanel] = useState(0);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const isTouch = useMediaQuery("(hover: none)");

  const value = useMemo(
    () => ({ soundOn, setSoundOn, progress, setProgress, activePanel, setActivePanel, reducedMotion, isTouch }),
    [soundOn, progress, activePanel, reducedMotion, isTouch],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useScene() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useScene must be used inside <SceneProvider>");
  return v;
}
