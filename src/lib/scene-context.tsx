"use client";
/**
 * 全站共享状态（集成会话维护）。
 *
 * 节奏只有一个来源：timeline（由 <ScrollDriver> 按滚动位置写入，查 src/lib/beats.json 节拍表）。
 * activePanel / progress / flight / serve 都由 derive(timeline) 推导，组件只读，不要自己另算节奏。
 *
 * - soundOn:       用户是否打开声音（SoundToggle 写）
 * - timeline:      当前段、段内进度 p、阶段（enter/action/hold/exit）与阶段内进度
 * - beats:         当前使用的节拍表（默认 beats.json；调节页可临时替换以试长度）
 * - activePanel:   当前节拍 n（0 开场 … 8 结尾近景）
 * - progress:      厨房阅读弱化 0–1
 * - flight:        null = 蛋在锅里循环跳；0–1 = 接蛋飞行；1 = 在锅铲上
 * - serve:         null = 未入碗；0–1 = 锅铲 → 碗中央；1 = 在饭上
 * - setProgress / setActivePanel / setFlight / setServe：**只给开发预览页做手动覆盖**，正式页面不要调用。
 */
import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { BEATS, derive, locate, type Beat, type Derived, type Timeline } from "./beats";

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

type SceneState = Derived & {
  soundOn: boolean;
  setSoundOn: (v: boolean) => void;
  timeline: Timeline;
  setTimeline: (t: Timeline) => void;
  beats: Beat[];
  setBeats: (b: Beat[]) => void;
  /** 开发覆盖 */
  setProgress: (v: number) => void;
  setActivePanel: (n: number) => void;
  setFlight: (v: number | null) => void;
  setServe: (v: number | null) => void;
  clearOverrides: () => void;
  reducedMotion: boolean;
  isTouch: boolean;
};

const Ctx = createContext<SceneState | null>(null);

/**
 * initialBeats：路由级节拍表（如动效小样只用其中几段）。仍由同一个 <ScrollDriver> 驱动，不是第二套节奏。
 * 每段的 n 必须是它在完整故事里的节拍号，这样 derive() 和声音能正确识别段落。
 */
export function SceneProvider({ children, initialBeats = BEATS }: { children: ReactNode; initialBeats?: Beat[] }) {
  const [soundOn, setSoundOn] = useState(false);
  const [beats, setBeats] = useState<Beat[]>(initialBeats);
  const [timeline, setTimeline] = useState<Timeline>(() => locate(0, initialBeats));
  const [overrides, setOverrides] = useState<Partial<Derived>>({});
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const isTouch = useMediaQuery("(hover: none)");

  const setProgress = useCallback((v: number) => setOverrides((o) => ({ ...o, progress: v })), []);
  const setActivePanel = useCallback((v: number) => setOverrides((o) => ({ ...o, activePanel: v })), []);
  const setFlight = useCallback((v: number | null) => setOverrides((o) => ({ ...o, flight: v })), []);
  const setServe = useCallback((v: number | null) => setOverrides((o) => ({ ...o, serve: v })), []);
  const clearOverrides = useCallback(() => setOverrides({}), []);

  const value = useMemo(() => {
    const d = { ...derive(timeline), ...overrides };
    return {
      ...d,
      soundOn, setSoundOn, timeline, setTimeline, beats, setBeats,
      setProgress, setActivePanel, setFlight, setServe, clearOverrides,
      reducedMotion, isTouch,
    };
  }, [soundOn, timeline, beats, overrides, reducedMotion, isTouch, setProgress, setActivePanel, setFlight, setServe, clearOverrides]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useScene() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useScene must be used inside <SceneProvider>");
  return v;
}
