"use client";
/**
 * 全站共享状态（集成会话维护；各分支只读或只调用对应 setter）。
 * - soundOn:     用户是否打开了声音（kitchen-scene 读写）
 * - progress:    0 = 厨房开场完整可见，1 = 已完全进入漫画阅读（comic-scroll 写，kitchen 读）
 * - activePanel: 当前故事节拍（见 docs/DESIGN.md §1）：0 开场，1 切配菜，2 炒配菜，3 调汁，4 发现后景跳蛋，
 *                5 伸锅铲，6 飞向锅铲，7 放进饭碗端出，8 结尾近景（comic-scroll 写）
 * - flight:      null = 蛋在锅里循环跳；0–1 = 从锅里飞到妈妈锅铲上，1 = 已在锅铲上（comic-scroll 写）
 * - serve:       null = 还没放进碗；0–1 = 从锅铲移到饭碗中央，1 = 已在饭上（comic-scroll 写）
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
  flight: number | null;
  setFlight: (v: number | null) => void;
  serve: number | null;
  setServe: (v: number | null) => void;
  reducedMotion: boolean;
  isTouch: boolean;
};

const Ctx = createContext<SceneState | null>(null);

export function SceneProvider({ children }: { children: ReactNode }) {
  const [soundOn, setSoundOn] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activePanel, setActivePanel] = useState(0);
  const [flight, setFlight] = useState<number | null>(null);
  const [serve, setServe] = useState<number | null>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const isTouch = useMediaQuery("(hover: none)");

  const value = useMemo(
    () => ({ soundOn, setSoundOn, progress, setProgress, activePanel, setActivePanel, flight, setFlight, serve, setServe, reducedMotion, isTouch }),
    [soundOn, progress, activePanel, flight, serve, reducedMotion, isTouch],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useScene() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useScene must be used inside <SceneProvider>");
  return v;
}
