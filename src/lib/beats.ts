/**
 * 统一场景节拍表的运行时（集成会话维护）。数据在 beats.json，这里只做查表和推导。
 *
 * 一切节奏都从同一份时间轴推导：滚动位置 → 当前段 + 段内局部进度 p + 阶段（进入/动作/停留/退出）+ 阶段内进度。
 * 前景、背景、角色、声音都只读这份时间轴（通过 useScene()），不要各自另算节奏或另开 ScrollTrigger。
 */
import data from "./beats.json";

export const PHASES = ["enter", "action", "hold", "exit"] as const;
export type Phase = (typeof PHASES)[number];
export type LoopSound = "room" | "sizzle" | "chop" | "stirfry" | "sauce";
export type OneShotSound = "stirfryIn" | "catch" | "bowlDown" | "pour";
export type EggMode = "loop" | "flight" | "serve" | "bowl";

export type Beat = {
  id: string;
  n: number;
  title: string;
  lengthVh: number;
  phases: Record<Phase, number>;
  kitchenDim: [number, number, number];
  foreground: string;
  egg: EggMode;
  audio: {
    loops: Partial<Record<LoopSound, number>>;
    fades: { sound: LoopSound; from: number; to: number; phase: Phase }[];
    oneshots: { sound: OneShotSound; at: number }[];
  };
  seconds: Record<string, number>;
};

/** 读入并校验节拍表：阶段比例和为 1、弱化三元组、长度为正。写错时在开发期直接报错。 */
function validate(beats: Beat[]) {
  beats.forEach((b, i) => {
    const sum = b.phases.enter + b.phases.action + b.phases.hold + b.phases.exit;
    if (Math.abs(sum - 1) > 1e-6) throw new Error(`beats.json: ${b.id} 的 phases 之和是 ${sum}，应为 1`);
    if (b.kitchenDim.length !== 3) throw new Error(`beats.json: ${b.id} 的 kitchenDim 必须是 3 个数`);
    if (!(b.lengthVh > 0)) throw new Error(`beats.json: ${b.id} 的 lengthVh 必须为正`);
    if (b.n !== i) throw new Error(`beats.json: ${b.id} 的 n 应为 ${i}`); // 只校验完整故事表；路由子集不经过 validate
  });
  return beats;
}

export const BEATS = validate(data.beats as unknown as Beat[]);
export const LOOP_SOUNDS: LoopSound[] = ["room", "sizzle", "chop", "stirfry", "sauce"];

export const beatById = (id: string, beats: Beat[] = BEATS) => beats.find((b) => b.id === id)!;
export const totalVh = (beats: Beat[] = BEATS) => beats.reduce((s, b) => s + b.lengthVh, 0);

/** 时间轴快照：全站唯一的节奏来源 */
export type Timeline = {
  /** 当前段下标（0 起） */
  index: number;
  beat: Beat;
  /** 段内局部进度 0–1 */
  p: number;
  phase: Phase;
  /** 阶段内进度 0–1 */
  phaseP: number;
  /** 页面总进度 0–1 */
  overall: number;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 阶段边界：[进入开始, 动作开始, 停留开始, 退出开始, 结束] */
export function phaseEdges(b: Beat) {
  const e = b.phases.enter, a = b.phases.action, h = b.phases.hold;
  return [0, e, e + a, e + a + h, 1] as const;
}

export function phaseAt(b: Beat, p: number): { phase: Phase; phaseP: number } {
  const edges = phaseEdges(b);
  for (let i = 0; i < 4; i++) {
    const lo = edges[i], hi = edges[i + 1];
    if (p < hi || i === 3) {
      if (hi - lo <= 0) continue;
      return { phase: PHASES[i], phaseP: clamp01((p - lo) / (hi - lo)) };
    }
  }
  return { phase: "hold", phaseP: 1 };
}

/** 滚动距离（以视口高度的百分比计）→ 时间轴 */
export function locate(scrollVh: number, beats: Beat[] = BEATS): Timeline {
  const total = totalVh(beats);
  let acc = 0;
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    if (scrollVh < acc + b.lengthVh || i === beats.length - 1) {
      const p = clamp01((scrollVh - acc) / b.lengthVh);
      return { index: i, beat: b, p, ...phaseAt(b, p), overall: clamp01(scrollVh / total) };
    }
    acc += b.lengthVh;
  }
  return { index: 0, beat: beats[0], p: 0, phase: "hold", phaseP: 0, overall: 0 };
}

/** 某个阶段在当前段里的进度：之前 0，之中 0–1，之后 1 */
export function phaseProgress(t: Timeline, phase: Phase) {
  const order = PHASES.indexOf(phase), cur = PHASES.indexOf(t.phase);
  if (cur < order) return 0;
  if (cur > order) return 1;
  return t.phaseP;
}

/**
 * 某一段的显隐包络（前景画格、妈妈图用）：段之前 0；进入阶段 0→1；动作、停留 1；退出 1→0；段之后 0。
 * 进入/退出为 0 长度时直接跳变。
 */
export function envelope(t: Timeline, id: string) {
  if (t.beat.id !== id) return 0;
  if (t.phase === "enter") return t.phaseP;
  if (t.phase === "exit") return 1 - t.phaseP;
  return 1;
}

/** 推导出的场景状态：所有组件读这些值 */
export type Derived = {
  activePanel: number;
  /** 厨房阅读弱化 0–1 */
  progress: number;
  /** null = 蛋在锅里循环；0–1 接蛋飞行 */
  flight: number | null;
  /** null = 未入碗；0–1 从锅铲移到碗中央 */
  serve: number | null;
};

export function derive(t: Timeline): Derived {
  const b = t.beat;
  const [s, h, e] = b.kitchenDim;
  const progress = t.phase === "enter" ? lerp(s, h, t.phaseP) : t.phase === "exit" ? lerp(h, e, t.phaseP) : h;
  const action = phaseProgress(t, "action");
  // 接蛋段的进入阶段蛋仍在锅里跳（null），动作阶段才起飞
  const flight = b.egg === "loop" ? null : b.egg === "flight" ? (t.phase === "enter" ? null : action) : 1;
  const serve = b.egg === "serve" ? action : b.egg === "bowl" ? 1 : null;
  return { activePanel: b.n, progress, flight, serve };
}

/** 本段某条循环声在当前时刻的音量（含阶段渐变），不含跨段渐变 */
function loopLevelInBeat(b: Beat, t: Timeline | null, sound: LoopSound) {
  const fade = b.audio.fades.find((f) => f.sound === sound);
  if (fade) {
    if (!t) return fade.to;
    return lerp(fade.from, fade.to, phaseProgress(t, fade.phase));
  }
  return b.audio.loops[sound] ?? 0;
}

/** 各循环声的目标音量：进入阶段从上一段的稳定音量渐变到本段 */
export function loopLevels(t: Timeline, beats: Beat[] = BEATS): Record<LoopSound, number> {
  const prev = t.index > 0 ? beats[t.index - 1] : null;
  const out = {} as Record<LoopSound, number>;
  for (const s of LOOP_SOUNDS) {
    const cur = loopLevelInBeat(t.beat, t, s);
    out[s] = t.phase === "enter" && prev ? lerp(loopLevelInBeat(prev, null, s), cur, t.phaseP) : cur;
  }
  return out;
}

/** 从 prev 到 cur 之间越过的单次音效（只在向下滚动时触发） */
export function crossedOneShots(prev: Timeline | null, cur: Timeline, beats: Beat[] = BEATS): OneShotSound[] {
  if (!prev) return [];
  const pos = (t: Timeline) => t.index + t.p;
  if (pos(cur) <= pos(prev)) return [];
  const fired: OneShotSound[] = [];
  for (let i = prev.index; i <= cur.index; i++) {
    const b = beats[i];
    for (const o of b.audio.oneshots) {
      const at = i + o.at;
      if (at > pos(prev) && at <= pos(cur)) fired.push(o.sound);
    }
  }
  return fired;
}
