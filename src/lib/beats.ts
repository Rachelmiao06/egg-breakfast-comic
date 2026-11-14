/**
 * 统一场景节拍表的运行时（集成会话维护）。数据在 beats.json，这里只做查表和推导。
 *
 * 一切节奏都从同一份时间轴推导：滚动位置 → 当前段 + 段内局部进度 p + 阶段（进入/动作/停留/退出）+ 阶段内进度。
 * 前景、背景、角色、声音都只读这份时间轴（通过 useScene()），不要各自另算节奏或另开 ScrollTrigger。
 */
import data from "./beats.json";

export const PHASES = ["enter", "action", "hold", "exit"] as const;
export type Phase = (typeof PHASES)[number];
export type LoopSound = "room" | "sizzle" | "chop" | "stirfry" | "sauce" | "steps";
export type OneShotSound = "stirfryIn" | "catch" | "bowlDown" | "pour" | "momCall" | "eggCall" | "pop" | "eggSmall";
/** gone = 后景这颗蛋已交给漫画（漫画里画着蛋），后景隐藏，避免出现两颗蛋 */
/**
 * 蛋在每段的状态（同一颗活动蛋）：
 * loop 锅里自主跳（真实时间）· toTable 进入阶段收住跳跃、动作阶段由滚动从锅落到桌沿 · table 桌沿等待（真实时间轻跳）
 * ready 桌沿准备起跳（环境段，真实时间蓄力）· flight 进入阶段收住、动作阶段由滚动飞到锅铲 · serve 锅铲→碗（滚动）· bowl 在碗里
 * inBowl 环境段：空饭桌上碗里的蛋试着呼喊（后景可见，漫画里不同时出现蛋）· gone 已交给漫画（隐藏）
 */
export type EggMode = "loop" | "toTable" | "table" | "ready" | "flight" | "serve" | "bowl" | "inBowl" | "gone";
/** 停留组：同组连续段落期间画面停住（sticky / pin），组结束后释放；null = 正常流动段 */
export type PinGroup = "prep" | "catch" | "bowl" | "search" | "reunion";

export type Beat = {
  id: string;
  n: number;
  title: string;
  lengthVh: number;
  pin: PinGroup | null;
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
  /** 段内命名事件（0–1）：画面（拟声字等）和声音（audio-map 写 "@名字"）读同一个值，例如 quiet 段的 tap1 / eggCall */
  events?: Record<string, number>;
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
export const LOOP_SOUNDS: LoopSound[] = ["room", "sizzle", "chop", "stirfry", "sauce", "steps"];

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

/**
 * 共享事件：蛋落到某一站的段内位置。视觉（Egg 的飞行/落点）和声音（audio-map.json 里写 "@eggOnSpatula"）
 * 都从这里读同一个值，不在两边各写一个数字。落点 = 该段动作阶段的结束处，所以只需在节拍表里调 phases。
 */
export type EggEvent = "eggOnTable" | "eggOnSpatula" | "eggInBowl";
export const EGG_EVENTS: Record<EggEvent, EggMode> = { eggOnTable: "toTable", eggOnSpatula: "flight", eggInBowl: "serve" };
export function eventAt(b: Beat, ev: string): number | null {
  if (b.events && ev in b.events) return b.events[ev];
  const mode = (EGG_EVENTS as Record<string, EggMode | undefined>)[ev];
  if (!mode || b.egg !== mode) return null;
  return phaseEdges(b)[2];
}
/** 本段的蛋事件（没有则 null）：段内起飞点、落点 */
export function eggTravel(b: Beat): { ev: EggEvent; start: number; land: number } | null {
  const ev = (Object.keys(EGG_EVENTS) as EggEvent[]).find((k) => EGG_EVENTS[k] === b.egg);
  if (!ev) return null;
  const [, start, land] = phaseEdges(b);
  return { ev, start, land };
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
  const flight = b.egg === "loop" || b.egg === "toTable" || b.egg === "table" || b.egg === "ready" || b.egg === "inBowl" ? null : b.egg === "flight" ? (t.phase === "enter" ? null : action) : 1;
  // gone：flight 仍为 1（蛋停在铲面位置），由 Egg 组件负责淡出隐藏
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

/**
 * 停留 / 流动状态（sticky 叙事用）。
 * - 停留组内：pinned = true，groupP = 整组进度 0–1（组内所有段落按长度连起来），内容由 timeline 推动，位置不随滚动移动。
 * - 流动段：pinned = false，flowVh = 本段已经滚过的距离（vh），内容应随滚动 1:1 上移（translateY = -flowVh vh），像普通文档流。
 * releaseVh：刚离开上一个停留组多少 vh（流动段里用来让上一组的内容自然被"推走"）；不在流动段时为 0。
 */
export type PinState = {
  group: PinGroup | null;
  pinned: boolean;
  groupP: number;
  flowVh: number;
  releaseVh: number;
};

export function pinState(t: Timeline, beats: Beat[] = BEATS): PinState {
  const b = t.beat;
  if (b.pin) {
    let total = 0, before = 0;
    let i = t.index;
    while (i > 0 && beats[i - 1].pin === b.pin) i--;
    for (let j = i; j < beats.length && beats[j].pin === b.pin; j++) {
      if (j < t.index) before += beats[j].lengthVh;
      total += beats[j].lengthVh;
    }
    return { group: b.pin, pinned: true, groupP: clamp01((before + t.p * b.lengthVh) / total), flowVh: 0, releaseVh: 0 };
  }
  const flowVh = t.p * b.lengthVh;
  const prevPinned = t.index > 0 && !!beats[t.index - 1].pin;
  return { group: null, pinned: false, groupP: 0, flowVh, releaseVh: prevPinned ? flowVh : 0 };
}
