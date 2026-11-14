/**
 * 预览路由节拍表的加载器（数据在 beats.visual.json，试验值）。仍由唯一的 <ScrollDriver> 驱动。
 */
import type { Beat } from "@/lib/beats";
import data from "./beats.visual.json";

export type Cam = { x: number; y: number; zoom: number; at: { x: number; y: number } };
type Raw = Partial<Beat> & { id: string; n: number; title: string; lengthVh: number; camera: string };

const DEFAULTS = {
  phases: { enter: 0.25, action: 0, hold: 0.6, exit: 0.15 },
  kitchenDim: [0.2, 0.2, 0.2] as [number, number, number],
  foreground: "",
  seconds: {},
};

export const CAMERAS = data.cameras as Record<string, Cam>;
export const VISUAL_BEATS: (Beat & { camera: string })[] = (data.beats as unknown as Raw[]).map((b) => ({
  ...DEFAULTS,
  ...b,
  pin: (b.pin ?? null) as Beat["pin"],
  egg: (b.egg ?? "loop") as Beat["egg"],
  audio: b.audio ?? { loops: {}, fades: [], oneshots: [] },
})) as (Beat & { camera: string })[];

const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
/** 当前镜头：进入阶段从上一段镜头缓入本段（sine.inOut），其余阶段停在本段 */
export function cameraAt(index: number, phase: string, phaseP: number): Cam {
  const cur = CAMERAS[VISUAL_BEATS[index].camera];
  const prev = index > 0 ? CAMERAS[VISUAL_BEATS[index - 1].camera] : cur;
  const k = phase === "enter" ? ease(phaseP) : 1;
  const lerp = (a: number, b: number) => a + (b - a) * k;
  return { x: lerp(prev.x, cur.x), y: lerp(prev.y, cur.y), zoom: lerp(prev.zoom, cur.zoom), at: { x: lerp(prev.at.x, cur.at.x), y: lerp(prev.at.y, cur.at.y) } };
}
