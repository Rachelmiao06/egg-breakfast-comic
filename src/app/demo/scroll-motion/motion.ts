/**
 * 停留式叙事小样的纯函数工具（只在 /demo/scroll-motion 用）。
 * 全部从统一时间轴推导：timeline + pinState + phaseProgress。这里不读滚动、不计时。
 */
import { BEATS, phaseProgress, type Beat, type Phase, type Timeline } from "@/lib/beats";
import { ANCHORS } from "@/lib/scene";
import type { StageFocus } from "@/components/SceneStage";

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 柔和曲线：像翻食谱、端盘子 */
export const sineInOut = (t: number) => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
export const power2InOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
};

/**
 * 某段某阶段的进度，可以问任何一段（不只当前段）：那段之前 0，之后 1，正在那段时 = phaseProgress。
 */
export function beatPhase(t: Timeline, beats: Beat[], id: string, phase: Phase) {
  const i = beats.findIndex((b) => b.id === id);
  if (i < 0) return 0;
  if (t.index < i) return 0;
  if (t.index > i) return 1;
  return phaseProgress(t, phase);
}

/** 当前是否就在某一段 */
export const isBeat = (t: Timeline, id: string) => t.beat.id === id;

/**
 * 一块"停留版面"的竖直位置（vh，0 = 停在视口顶）。等价于 CSS position: sticky：
 * - 组前紧挨的流动段里，版面顶 = 该段长度 − 已滚距离（从下方 1:1 滚进来，最多 100vh 以下）；
 * - 组内 0（停住）；
 * - 组后紧挨的流动段里 = −releaseVh（1:1 被推走）；
 * - 更早 / 更晚：在屏幕外。
 */
export function sheetY(t: Timeline, beats: Beat[], group: Beat["pin"], flowVh: number, releaseVh: number) {
  const first = beats.findIndex((b) => b.pin === group);
  let last = first;
  while (last + 1 < beats.length && beats[last + 1].pin === group) last++;
  if (t.index >= first && t.index <= last) return 0;
  if (t.index === first - 1 && !beats[first - 1].pin) return Math.min(100, beats[first - 1].lengthVh - flowVh);
  if (t.index === last + 1 && !beats[last + 1].pin) return -releaseVh;
  return t.index < first ? 100 : -100;
}

/**
 * 小样的节拍表：完整故事 0–8 原样保留，只在末尾加一段"释放"流动段（outro），
 * 让最后一个停留组（饭碗结尾）也能自然释放。n = 9，不进入正式表（见任务文件"需要集成会话改"）。
 */
const OUTRO: Beat = {
  id: "outro",
  n: 9,
  title: "释放：完（小样试加）",
  lengthVh: 100,
  pin: null,
  phases: { enter: 0, action: 0, hold: 1, exit: 0 },
  kitchenDim: [0.5, 0.5, 0.5],
  foreground: "结尾卡随滚动上移离开，'完'卡从下方滚入",
  egg: "bowl",
  audio: { loops: { room: 0.15 }, fades: [], oneshots: [] },
  seconds: {},
};

export const DEMO_BEATS: Beat[] = [...BEATS, OUTRO];

/**
 * 建议长度（试调副本）：只缩短停留组里的"阅读停留"空档，其余不动。数值写进任务文件。
 */
const TUNED: Record<string, { lengthVh: number; phases?: Beat["phases"] }> = {
  chop: { lengthVh: 120, phases: { enter: 0.25, action: 0.2, hold: 0.33, exit: 0.22 } },
  stirfry: { lengthVh: 120, phases: { enter: 0.25, action: 0.2, hold: 0.33, exit: 0.22 } },
  sauce: { lengthVh: 115, phases: { enter: 0.25, action: 0.2, hold: 0.31, exit: 0.24 } },
  spatula: { lengthVh: 90, phases: { enter: 0.33, action: 0.45, hold: 0.22, exit: 0 } },
  catch: { lengthVh: 170, phases: { enter: 0, action: 0.88, hold: 0.12, exit: 0 } },
  serve: { lengthVh: 140, phases: { enter: 0.22, action: 0.56, hold: 0.22, exit: 0 } },
  ending: { lengthVh: 100, phases: { enter: 0.45, action: 0, hold: 0.55, exit: 0 } },
};

export const TUNED_BEATS: Beat[] = DEMO_BEATS.map((b) => (TUNED[b.id] ? { ...b, ...TUNED[b.id] } : b));

/** 默认镜头 = SceneStage 不传 focus 时的取景（场景中心横向居中，FOCUS_Y 在视口 55% 高度） */
const DEFAULT_CAM = { x: 768, y: 600, zoom: 1 };
const AT = { x: 0.5, y: 0.55 };

type Cam = { x: number; y: number; zoom: number };
const mix = (a: Cam, b: Cam, k: number): Cam => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), zoom: lerp(a.zoom, b.zoom, k) });

/**
 * 小样镜头：始终 weight 1、固定 at，只插值焦点和 zoom，这样从 zoom 1 起推时不会跳变。
 * 接蛋组：随飞行把镜头带向锅和铲之间，落铲后推近铲面；饭碗组：对准饭中央逐步推近；zoom ≤ 1.3。
 */
export function demoCamera(t: Timeline, beats: Beat[]): StageFocus & { zoom: number } {
  const g = (id: string, ph: Phase) => beatPhase(t, beats, id, ph);
  const between: Cam = { x: 650, y: 590, zoom: 1.06 };
  const onSpatula: Cam = { x: ANCHORS.spatulaLand.x + 40, y: ANCHORS.spatulaLand.y - 90, zoom: 1.15 };
  const bowl: Cam = { x: ANCHORS.bowlCenter.x, y: ANCHORS.bowlCenter.y - 50, zoom: 1.22 };
  const bowlClose: Cam = { x: ANCHORS.bowlCenter.x, y: ANCHORS.bowlCenter.y - 20, zoom: 1.3 };

  let c: Cam = DEFAULT_CAM;
  // 伸锅铲的停留阶段先极轻地推一点点，让停住的画面也在"呼吸"
  c = mix(c, { ...DEFAULT_CAM, zoom: 1.02 }, sineInOut(g("spatula", "hold")));
  c = mix(c, between, sineInOut(g("catch", "action")));
  c = mix(c, onSpatula, sineInOut(g("catch", "hold")));
  c = mix(c, bowl, sineInOut(g("serve", "enter") * 0.6 + g("serve", "action") * 0.4));
  c = mix(c, bowlClose, sineInOut(g("ending", "enter")));
  return { x: c.x, y: c.y, weight: 1, at: AT, zoom: Math.min(1.3, c.zoom) };
}
