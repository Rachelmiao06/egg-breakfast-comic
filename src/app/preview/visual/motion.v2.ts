"use client";
/**
 * 新版运动（v2）：所有滚动主运动都由"故事位置 g = 段号 + 段内进度"直接映射，不再按段的进入阶段做平台式插值，
 * 也不叠加缓动（平滑只在滚动源头 Lenis 做一次）。数据在 backgrounds.json 与 beats.visual-v2.json。
 */
import type { Beat, Timeline } from "@/lib/beats";
import bg from "./backgrounds.json";
import type { Cam } from "./beats.visual";
import data from "./beats.visual-v2.json";

type Raw = Partial<Beat> & { id: string; n: number; title: string; lengthVh: number; camera: string; readS?: number };

/**
 * 读格时间下限（2026-11-15 用户：结尾"拉肚子"那格有动画，但滚太快还没看到就滑过去了）。
 * 格内动画按真实时间播，滚动只决定格子"在不在"。所以每个有格内动画的段在节拍表里写 readS（动画从开始到看清所需的秒数），
 * 这里按"从容滚动速度" BRISK_VH_PER_S 反推：格子在屏幕上稳定可读的那一段滚动距离 ≥ readS × BRISK，不够就把本段拉长。
 * 可读窗口 = 入场结束（enter）到开始离场（enter+action+hold 再加格子离场触发点，约 12% 的退出区）。
 * 不吸附、不劫持滚动，只是让该慢的地方滚动距离更长；慢滚、停住、倒滚都不受影响。
 */
export const BRISK_VH_PER_S = 45;
const readableWindow = (ph: Beat["phases"]) => ph.enter + ph.action + ph.hold + 0.12 * ph.exit - ph.enter * 0.9;
export const V2_BEATS: (Beat & { camera: string })[] = (data.beats as unknown as Raw[]).map((b) => ({
  phases: { enter: 0.25, action: 0, hold: 0.6, exit: 0.15 },
  kitchenDim: [0, 0, 0] as [number, number, number],
  foreground: "",
  seconds: {},
  ...b,
  pin: (b.pin ?? null) as Beat["pin"],
  egg: (b.egg ?? "loop") as Beat["egg"],
  audio: b.audio ?? { loops: {}, fades: [], oneshots: [] },
})).map((b) => {
  const r = (b as unknown as Raw).readS;
  if (!r) return b;
  const need = Math.ceil((r * BRISK_VH_PER_S) / readableWindow(b.phases));
  return need > b.lengthVh ? { ...b, lengthVh: need } : b;
}) as (Beat & { camera: string })[];

export const BG = bg;
const idx = (id: string) => V2_BEATS.findIndex((b) => b.id === id);
export const gOf = (id: string, p: number) => idx(id) + p;
export const gNow = (t: Timeline) => t.index + t.p;
const smooth = (t: number) => { const k = Math.min(1, Math.max(0, t)); return k * k * (3 - 2 * k); };

/** 分段曲线：[[beat, p, value], ...]，相邻点之间平滑插值 */
export function curve(keys: [string, number, number][], g: number) {
  const pts = keys.map(([id, p, v]) => [gOf(id, p), v] as const);
  if (g <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (g <= pts[i][0]) { const [g0, v0] = pts[i - 1], [g1, v1] = pts[i]; return v0 + (v1 - v0) * smooth((g - g0) / (g1 - g0)); }
  }
  return pts[pts.length - 1][1];
}

/** 连续镜头：关键帧之间平滑插值；接蛋动作阶段额外轻微跟随蛋 */
/** egg：要跟随的蛋位置；follow：跟随权重（默认 backgrounds.json 的 followEgg；环境段由页面传入较大的值，让蛋在任何视口都在画面里） */
export function cameraV2(g: number, egg?: { x: number; y: number } | null, follow: number = bg.camera.followEgg): Cam {
  const K = bg.camera.keys as [string, number, number, number, number, number, number][];
  const ch = (j: number) => curve(K.map((k) => [k[0], k[1], k[j]] as [string, number, number]), g);
  const cam: Cam = { x: ch(2), y: ch(3), zoom: ch(4), at: { x: ch(5), y: ch(6) } };
  if (egg) { cam.x += (egg.x - cam.x) * follow; cam.y += (egg.y - cam.y) * follow; }
  return cam;
}

/** 景深：由镜头自身的位移推出（相对开场焦点），远景少动、近景多动 */
export function depthFromCamera(cam: Cam) {
  const k0 = bg.camera.keys[0] as [string, number, number, number];
  return { x: (cam.x - k0[2]) * bg.camera.depthGain, y: (cam.y - k0[3]) * bg.camera.depthGain };
}
