"use client";
/**
 * 厨房声音导演。素材库录音，不合成。**不自己定节奏**：所有音量和触发点来自统一节拍表
 * （src/lib/beats.json，见 docs/BEATS.md），按 useScene().timeline 计算。
 *
 * 混音原则（docs/tasks/kitchen-audio.md）：任何时刻只有一条很轻的环境底声（room）+ 一个当前动作声
 * （sizzle / chop / stirfry / sauce 之一）+ 必要的单次音效。节拍表每段的 audio.loops 已体现这一点，
 * 这里保证实现上也成立：目标音量为 0 的循环淡到 0 之后 **pause**，不残留。
 *
 * - 循环声：固定 5 个 <audio loop>，整个生命周期只创建一次。目标音量 = loopLevels(timeline)
 *   （进入阶段从上一段渐变、audio.fades 阶段内渐变），再经很短的平滑（防拖动滚动条爆音）。
 * - 单次音效：固定 4 个 <audio>，向下越过 audio.oneshots.at 时从头播一次；回滚不播；回滚再前进可以再播，
 *   但同一音效永远只有这一个实例（重触发 = 从头重放，不叠加）。
 * - 音量通过 Web Audio 的 GainNode 施加（iOS Safari 忽略 HTMLMediaElement.volume）；没有 AudioContext 时退回 volume。
 * - 跨景由远到近：只给 sizzle 挂一个低通（BiquadFilter），截止频率随 useScene().flight 从约 1.5 kHz 打开到 16 kHz，
 *   flight 为 null（蛋还在锅里）或已到 1 时等于全开。其它声音不滤波；没有 AudioContext 时没有这一步。
 *   每个元素上的 data-level / data-target / data-fired 是给调试和验收读的。
 * - 自动播放解锁：第一次 pointerup / touchend / keydown 时 resume AudioContext，并把每个元素都"预热"一次
 *   （play 后立刻 pause，iOS 要求每个媒体元素各自在手势里 play 过）。
 * - 页面切到后台：全部暂停；回到前台恢复循环；后台期间越过的触发点不补播——后台里 rAF 停了，<ScrollDriver> 不更新
 *   时间轴，回前台后时间轴会一次跳过后台期间滚过的距离，所以在 visibilitychange→visible 时先把"上一次时间轴"
 *   重同步到当前滚动位置（只重同步、不触发），之后只有用户真实滚动产生的越过才会触发。
 * - 只为 audio-map.json 的 available 列表里的声音创建 <audio>（空位不发请求、保持静音，避免 404）；
 *   列表里的文件解码失败也保持静音；available 表示至少有一条能播。
 * - 场景 → 声音的对应表在 audio-map.json（按场景编号 id 覆盖节拍数据的 audio 字段，表里没有的场景沿用原值）。
 *   这样不用改共享的 beats.json；音量、触发点都在声音分支自己的文件里。
 *   触发点可写成阶段符号（"actionEnd" 等，见 resolveAt），按当前节拍表的 phases 换算成段内进度，新旧两版节拍共用一张表。
 * - 越过节拍表触发点的单次音效：同一次时间轴更新越过多个时只播最后一个；一次跨过 40 vh 以上（拖滚动条、跳转）全部跳过；
 *   停在原地不重复，倒滚不播。audio-map 里 oncePerVisit 的段（listen）每进入一次只播一次：段内倒滚再前进不重播，
 *   回到这一段开始之前才重新允许。
 * - audio-map 的扩展：ramps（段内定时的电平斜坡）和 lowpass（段内定时的低通，目前给 steps 由远到近），见 MappedBeat。
 * - 动作声跟前景的真实动作走（2026-11-14 用户要求"滚动让镜头进入，动作和声音随后按真实时间一起播放"）。三种 window 事件：
 *   · "kitchen:oneshot" {sound}：接触的那一帧播一次。chopHit（每刀）、stirfryIn（菜落进锅那一帧）、eggHop（开场蛋落回锅面，
 *     detail.surface 不是 "pan" 的不出声；两次之间至少 HOP_MIN_GAP_MS，每次音高 ±6%、电平 ±1.5 dB 轻微变化）。
 *   · "kitchen:action" {name, phase: "start"|"stop"}：一段动作。start 从头播这一段（同名的上一段先 50 ms 收掉，不叠），
 *     stop 0.2 s 淡出；没收到 stop 就自然播完。name → 声音见 audio-map 的 cues.action（翻炒 stirfry、调汁 sauceStir）。
 *   · "comic:panel" {key, phase: "start"|"stop"|"reset"}：前景格子按同一套 useStage 规则真正进入阅读位置（start）/ 离开（stop）。
 *     cues.panel 里登记的格子在 start 后按 delay 播对应声音（淋汁 p4c、放碗 p4b）；stop / reset 取消还没响的、正在响的 0.25 s 淡出。
 *   这些声音都解码成 AudioBuffer，每次新建 BufferSource；静音、未解锁（AudioContext 未 running）、后台时丢弃不补播。
 *   对应的滚动触发（stirfry @0.22、bowl 的 bowlDown / pour）和整段循环（sauce）已从 audio-map 去掉，避免同一个动作响两遍。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { eventAt, locate, loopLevels, LOOP_SOUNDS, phaseEdges, type Beat, type LoopSound, type OneShotSound, type Timeline } from "@/lib/beats";
import { useScene } from "@/lib/scene-context";
import audioMap from "./audio-map.json";

const DIR = "/assets/audio/";
/** 循环声文件（音量完全由节拍表 audio.loops 决定） */
const LOOP_FILES: Record<LoopSound, string> = {
  room: "room-loop.mp3",
  sizzle: "sizzle-loop.mp3",
  chop: "chop-loop.mp3",
  stirfry: "stirfry-loop.mp3", // 暂无素材（刻意留空），保持静音
  sauce: "sauce-stir-loop.mp3",
  steps: "footsteps-loop.mp3", // 寻找段：地毯上拖鞋慢走
};
/**
 * 由前景动画按帧触发的单次音效（不在节拍表里）：页面派发
 *   window.dispatchEvent(new CustomEvent("kitchen:oneshot", { detail: { sound: "chopHit" } }))
 * 触发时刻完全由动画决定，混音器不做节拍判断。
 */
type EventSound = "chopHit" | "eggHop" | "stirfryStir" | "sauceStir";
/** 只在 audio-map 里用、由滚动越过触发点触发的单次音效（共享的 OneShotSound 类型里没有，运行时照样经节拍表的 oneshots 传递） */
type ShotSound = OneShotSound | EventSound;
const EVENT_SOUNDS: readonly EventSound[] = ["chopHit", "eggHop", "stirfryStir", "sauceStir"];
/** 解码成 AudioBuffer 播放：每次触发新建节点，快速连续触发可以重叠，并可以带声像、可以单独淡出 */
const BUFFER_SOUNDS: readonly ShotSound[] = ["chopHit", "hopTap1", "hopTap2", "hopTap3", "eggHop", "stirfryIn", "stirfryStir", "sauceStir", "pour", "bowlDown"];
export const KITCHEN_ONESHOT_EVENT = "kitchen:oneshot";
/** 前景一段动作的开始 / 停止：detail = { name, phase: "start" | "stop" } */
export const KITCHEN_ACTION_EVENT = "kitchen:action";
/** 前景格子进入 / 离开阅读位置（与格内表演同一套 useStage 规则）：detail = { key, phase: "start" | "stop" | "reset" } */
export const COMIC_PANEL_EVENT = "comic:panel";
/** 开场蛋跳：两次落地声之间至少隔这么久（蛋本身约 2.3–3 s 跳一次，这只是防止连跳时扎堆） */
const HOP_MIN_GAP_MS = 1800;
/** 动作 / 格子停止时的淡出（秒） */
const ACTION_FADE_S = 0.2, PANEL_FADE_S = 0.25;
/** 动作开始后这么短时间内就收到停止（快速滚过格子）：快速收掉 */
const QUICK_STOP_MS = 400;
type Cues = { action: Record<string, string>; panel: Record<string, { sound: string; delay: number }[]> };
const CUES = (audioMap as unknown as { cues?: Cues }).cues ?? { action: {}, panel: {} };
/** 单次音效：文件与播放音量（素材已统一到约 -18 LUFS，这里是相对电平） */
const ONESHOTS: Record<ShotSound, { file: string; volume: number; pan?: number }> = {
  stirfryIn: { file: "stirfry-in.mp3", volume: 0.6 },
  catch: { file: "catch.mp3", volume: 0.6 },
  bowlDown: { file: "bowl-down.mp3", volume: 0.3 }, // 2026-11-14 晚 0.6 → 0.3：真实录音里它比其它动作声响约 9 dB
  // 淋汁：细细一股油流 1.2 s（p4c 勺子淋汁格进入阅读位置后 0.9 s，cues.panel）；小流量，所以电平低
  pour: { file: "pour.mp3", volume: 0.25 },
  momCall: { file: "mom-call.mp3", volume: 0.6 }, // 暂无素材："宝宝，来吃饭啦"
  eggCall: { file: "egg-call.mp3", volume: 0.6 }, // 暂无素材：蛋大声喊"妈！这里！"
  pop: { file: "pop.mp3", volume: 0.5 }, // "啵！"：蛋的轻快小声（峰值瞬时响度与 catch 相当，所以略低）
  eggSmall: { file: "egg-small.mp3", volume: 0.5 }, // 暂无素材：蛋小声"我在这儿……"
  // 切菜格逐刀：从 chop-loop 同一原档切出的一刀，0.26 s；电平 0.5 = 原来 chop 循环里每一刀的电平
  chopHit: { file: "chop-hit.mp3", volume: 0.5 },
  // 开场蛋在锅里跳的落地声：很软的"噗"（湿的小拍击，2 kHz 低通），很轻
  eggHop: { file: "egg-hop.mp3", volume: 0.16 },
  // 翻炒：木铲在钢锅里推菜、轻刮锅，3.2 s 一段（kitchen:action stirfry）
  stirfryStir: { file: "stirfry-stir.mp3", volume: 0.3 },
  // 调汁：木勺在碗里轻搅、碰碗，2.6 s 一段；前景两圈约 1.25 s，转完时的停止事件把它淡出（kitchen:action sauceStir）
  sauceStir: { file: "sauce-stir.mp3", volume: 0.3 },
  // 接蛋前的声音铺垫（listen）：画外右侧，蛋在桌沿台面上轻跳落下的"嗒"。从 chop 原档里刀碰木案板的三下撞击切出、
  // 1.5 kHz 低通成软的小木头接触声；声像偏右（蛋在画外右侧，hear 格里妈妈也看向右上）；很轻
  hopTap1: { file: "hop-tap-1.mp3", volume: 0.2, pan: 0.6 },
  hopTap2: { file: "hop-tap-2.mp3", volume: 0.2, pan: 0.6 },
  hopTap3: { file: "hop-tap-3.mp3", volume: 0.2, pan: 0.6 },
};
/** 可以写进节拍表 / audio-map 的单次音效（事件触发的不在其中） */
const ONESHOT_SOUNDS = (Object.keys(ONESHOTS) as ShotSound[]).filter((n) => !(EVENT_SOUNDS as readonly string[]).includes(n));
const SHOT_NAMES = Object.keys(ONESHOTS) as ShotSound[];

type SceneAudio = Beat["audio"];
/** audio-map.json 里一段的写法：单次音效的 at 可以是数字（段内进度 0–1），也可以是阶段符号 */
type At = number | string;
/**
 * 段内定时的电平斜坡（比按阶段的 fades 更细）：p 在 [start, end] 内从 from 线性到 to，之前保持 from、之后保持 to；
 * 同一声音可写多条（按 start 排序，后面的接管）。start / end 和单次音效的 at 写法一样（数字、阶段符号、@事件）。
 * 有斜坡的声音在这一段里完全由斜坡决定；它在本段的 loops 值自动取最后一条的 to，下一段的进入渐变从这里接上。
 */
type MapRamp = { sound: string; from: number; to: number; start: At; end: At };
/** 段内定时的低通（目前给 steps 由远到近用）：截止频率 fromHz → toHz，规则同 ramps；没写的段 = 全开 */
type MapLowpass = { sound: string; fromHz: number; toHz: number; start: At; end: At };
/**
 * oncePerVisit：这一段的单次音效"每进入一次只播一次"。段内倒滚再前进不重播；只有时间轴回到这一段开始之前
 * （例如回到上一段）之后才重新允许。只给需要的段打开（listen 的画外轻跳）；其它段保持"倒滚后再前进可以再播"。
 */
type MapScene = Omit<SceneAudio, "oneshots"> & { oneshots: { sound: string; at: At }[]; ramps?: MapRamp[]; lowpass?: MapLowpass[]; oncePerVisit?: boolean };
type Ramp = { sound: LoopSound; from: number; to: number; start: number; end: number };
/** 带声音分支扩展字段的节拍（ramps / lowpass 已换算成段内进度） */
export type MappedBeat = Beat & { mapRamps?: Ramp[]; mapLowpass?: Ramp[]; mapOncePerVisit?: boolean };
const SCENE_AUDIO = (audioMap as { scenes: Record<string, MapScene> }).scenes;
/**
 * 触发点符号：enterEnd / actionEnd / holdEnd（= 该段进入 / 动作 / 停留阶段的结束处），可带偏移，如 "actionEnd-0.02"。
 * 由当前节拍表的 phases 算出，所以同一张表同时适用于新旧两版节拍（catch 的落铲在 v1 是 0.78、v2 是 0.80）。
 */
const AT_SYMBOL = /^(enterEnd|actionEnd|holdEnd)([+-]\d*\.?\d+)?$/;
export function resolveAt(b: Beat, at: number | string): number | null {
  if (typeof at === "number") return at;
  // "@eggOnSpatula" 等：共享事件（beats.ts eventAt），与 Egg 的落点读同一个值；可带偏移 "@eggOnSpatula-0.01"
  const ev = /^@(\w+)([+-]\d*\.?\d+)?$/.exec(at.trim());
  if (ev) {
    const p = eventAt(b, ev[1]);
    return p === null ? null : Math.min(1, Math.max(0, p + (ev[2] ? parseFloat(ev[2]) : 0)));
  }
  const m = AT_SYMBOL.exec(at.trim());
  if (!m) return null;
  const [, enterEnd, actionEnd, holdEnd] = phaseEdges(b);
  const base = m[1] === "enterEnd" ? enterEnd : m[1] === "actionEnd" ? actionEnd : holdEnd;
  return Math.min(1, Math.max(0, base + (m[2] ? parseFloat(m[2]) : 0)));
}
/** 真正有文件的声音；其余为空位 */
const AVAILABLE = new Set<string>((audioMap as { available: string[] }).available);
const warned = new Set<string>();
/** 用 audio-map.json 覆盖节拍表每段的 audio；检查声音名是否已登记（没登记的忽略并在开发期提示一次） */
export function withAudioMap(beats: Beat[]): MappedBeat[] {
  return beats.map((b): MappedBeat => {
    const m = SCENE_AUDIO[b.id];
    if (!m) return b;
    const loops: SceneAudio["loops"] = {};
    for (const [k, v] of Object.entries(m.loops)) {
      if ((LOOP_SOUNDS as string[]).includes(k)) loops[k as LoopSound] = v;
      else warnOnce(`audio-map.json: 场景 ${b.id} 的循环声 ${k} 未登记`);
    }
    const fades = m.fades.filter((f) => (LOOP_SOUNDS as string[]).includes(f.sound) || !warnOnce(`audio-map.json: 场景 ${b.id} 的渐变声 ${f.sound} 未登记`));
    const oneshots: SceneAudio["oneshots"] = [];
    for (const o of m.oneshots) {
      if (!(ONESHOT_SOUNDS as string[]).includes(o.sound)) { warnOnce(`audio-map.json: 场景 ${b.id} 的单次音效 ${o.sound} 未登记`); continue; }
      const at = resolveAt(b, o.at);
      if (at === null) { warnOnce(`audio-map.json: 场景 ${b.id} 的触发点 ${String(o.at)} 不认识（数字、enterEnd/actionEnd/holdEnd±偏移，或本段存在的共享事件 @eggOnTable/@eggOnSpatula/@eggInBowl）`); continue; }
      // hopTap1/2/3 已在共享类型 OneShotSound 里，名字原样传给 crossedShots → fire
      oneshots.push({ sound: o.sound as OneShotSound, at });
    }
    const resolveRamps = (list: { sound: string; from: number; to: number; start: At; end: At }[] | undefined, kind: string): Ramp[] => {
      const out: Ramp[] = [];
      for (const r of list ?? []) {
        if (!(LOOP_SOUNDS as string[]).includes(r.sound)) { warnOnce(`audio-map.json: 场景 ${b.id} 的 ${kind} 声音 ${r.sound} 未登记`); continue; }
        const start = resolveAt(b, r.start), end = resolveAt(b, r.end);
        if (start === null || end === null) { warnOnce(`audio-map.json: 场景 ${b.id} 的 ${kind} 区间 ${String(r.start)}–${String(r.end)} 不认识`); continue; }
        out.push({ sound: r.sound as LoopSound, from: r.from, to: r.to, start, end: Math.max(start, end) });
      }
      return out.sort((x, y) => x.start - y.start);
    };
    const mapRamps = resolveRamps(m.ramps, "ramps");
    const mapLowpass = resolveRamps(m.lowpass?.map((l) => ({ sound: l.sound, from: l.fromHz, to: l.toHz, start: l.start, end: l.end })), "lowpass");
    for (const r of mapRamps) loops[r.sound] = r.to; // 排过序：最后一条的 to 留下
    return { ...b, audio: { loops, fades, oneshots }, mapRamps, mapLowpass, mapOncePerVisit: m.oncePerVisit === true };
  });
}
function warnOnce(msg: string) {
  if (!warned.has(msg)) { warned.add(msg); if (process.env.NODE_ENV !== "production") console.warn(msg); }
  return true;
}
/** 某声音在段内进度 p 处的斜坡值；这一段没有它的斜坡 → null */
function rampValue(rs: Ramp[] | undefined, sound: LoopSound, p: number): number | null {
  let v: number | null = null;
  for (const r of rs ?? []) {
    if (r.sound !== sound) continue;
    if (v === null && p < r.start) return r.from;
    if (p < r.start) break;
    v = p >= r.end || r.end === r.start ? r.to : r.from + (r.to - r.from) * ((p - r.start) / (r.end - r.start));
  }
  return v;
}
/** loopLevels 的结果再套上本段的 ramps */
export function mappedLevels(t: Timeline, base: Record<LoopSound, number>): Record<LoopSound, number> {
  const b = t.beat as MappedBeat;
  if (!b.mapRamps?.length) return base;
  const out = { ...base };
  for (const s of LOOP_SOUNDS) { const v = rampValue(b.mapRamps, s, t.p); if (v !== null) out[s] = v; }
  return out;
}
/** 滚动位置（vh），用来判断一次更新跨了多远 */
function posVh(t: Timeline, beats: Beat[]) {
  let acc = 0;
  for (let i = 0; i < t.index && i < beats.length; i++) acc += beats[i].lengthVh;
  return acc + t.p * (beats[t.index]?.lengthVh ?? 0);
}
/**
 * 两次时间轴之间向前越过的单次音效，带"哪一段、第几个"（规则与 beats.ts 的 crossedOneShots 完全相同：
 * 只算向前、触发点落在 (prev, cur]）。需要身份是为了 oncePerVisit 记账。
 */
function crossedShots(prev: Timeline | null, cur: Timeline, beats: Beat[]): { bi: number; oi: number; sound: OneShotSound }[] {
  if (!prev) return [];
  const pos = (t: Timeline) => t.index + t.p;
  if (pos(cur) <= pos(prev)) return [];
  const out: { bi: number; oi: number; sound: OneShotSound }[] = [];
  for (let i = prev.index; i <= cur.index && i < beats.length; i++) {
    beats[i].audio.oneshots.forEach((o, oi) => {
      const at = i + o.at;
      if (at > pos(prev) && at <= pos(cur)) out.push({ bi: i, oi, sound: o.sound });
    });
  }
  return out;
}
/** 一次时间轴更新跨过这么多 vh 以上（拖滚动条、跳转），越过的单次音效全部跳过 */
const MAX_CROSS_VH = 40;

/** 平滑速度：音量每秒最多变化这么多（满量程），只用于去掉跳变，节奏由节拍表决定 */
const SLEW_PER_SEC = 2.5;
const TICK_MS = 50;
/** sizzle 低通：远（flight 0）→ 近（flight 1）；全开 = 不起作用 */
const LOWPASS_FAR = 1500, LOWPASS_NEAR = 16000, LOWPASS_OPEN = 20000;
/** 挂低通的循环声：sizzle（跟随蛋的飞行）、steps（audio-map 的 lowpass 规则，脚步由远到近） */
const LOWPASS_SOUNDS: readonly string[] = ["sizzle", "steps"];

type Channel = {
  name: string;
  el: HTMLAudioElement;
  gain: GainNode | null;
  /** 只有 sizzle 有：由远到近的低通 */
  lowpass: BiquadFilterNode | null;
  /** 文件可播（canplay 到过） */
  ok: boolean;
  /** 当前施加的电平 0–1 */
  level: number;
  /** 节拍表给的目标电平（循环声用） */
  target: number;
  /** 正在"预热"（手势里 play 后等着 pause） */
  priming: boolean;
  /** 单次音效累计触发次数 */
  fired: number;
};

class KitchenMixer {
  private root: HTMLDivElement;
  private ctx: AudioContext | null = null;
  private loops: Partial<Record<LoopSound, Channel>> = {};
  private shots: Partial<Record<ShotSound, Channel>> = {};
  /** 事件触发的声音解码成 AudioBuffer：每次触发新建一个 BufferSource，快速连刀可以重叠，不用等元素重放 */
  private buffers: Partial<Record<ShotSound, AudioBuffer>> = {};
  private voices = new Set<AudioBufferSourceNode>();
  /** 带名字的声部（动作 / 格子的声音），用于收到 stop 时单独淡出 */
  private tagged = new Map<string, { src: AudioBufferSourceNode; g: GainNode }>();
  /** 格子 start 之后还没响的声音 */
  private panelTimers = new Map<string, number[]>();
  private lastHop = -Infinity;
  private actionStart = new Map<string, number>();
  private total = 0;
  private soundOn = false;
  private hidden = false;
  private unlocked = false;
  private timer = 0;
  private lastTick = 0;
  private settled = 0;
  private disposed = false;

  constructor(private onAvailable: (ok: boolean) => void) {
    this.root = document.createElement("div");
    this.root.hidden = true;
    this.root.dataset.kitchenAudio = "";
    document.body.appendChild(this.root);
    const AC = typeof window !== "undefined" ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
    try {
      this.ctx = AC ? new AC() : null;
    } catch {
      this.ctx = null;
    }
    const loopNames = LOOP_SOUNDS.filter((n) => AVAILABLE.has(n));
    const shotNames = SHOT_NAMES.filter((n) => AVAILABLE.has(n));
    this.total = loopNames.length + shotNames.length;
    for (const name of loopNames) this.loops[name] = this.channel(name, "loop", LOOP_FILES[name], true);
    for (const name of shotNames) this.shots[name] = this.channel(name, "oneshot", ONESHOTS[name].file, false);
    for (const name of BUFFER_SOUNDS) if (this.shots[name]) this.loadBuffer(name);
    if (this.total === 0) queueMicrotask(() => onAvailable(false));
    this.hidden = document.visibilityState === "hidden";
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pointerup", this.onGesture, { passive: true });
    window.addEventListener("touchend", this.onGesture, { passive: true });
    window.addEventListener("keydown", this.onGesture, { passive: true });
    window.addEventListener(KITCHEN_ONESHOT_EVENT, this.onShotEvent);
    window.addEventListener(KITCHEN_ACTION_EVENT, this.onActionEvent);
    window.addEventListener(COMIC_PANEL_EVENT, this.onPanelEvent);
    this.lastTick = performance.now();
    this.timer = window.setInterval(this.tick, TICK_MS);
  }

  private channel(name: string, kind: "loop" | "oneshot", file: string, loop: boolean): Channel {
    const el = document.createElement("audio");
    el.preload = "auto";
    el.loop = loop;
    el.dataset.sound = name;
    el.dataset.kind = kind;
    el.dataset.level = "0";
    el.dataset.target = "0";
    el.dataset.fired = "0";
    el.dataset.ok = "pending";
    const ch: Channel = { name, el, gain: null, lowpass: null, ok: false, level: 0, target: 0, priming: false, fired: 0 };
    if (this.ctx) {
      try {
        const src = this.ctx.createMediaElementSource(el);
        ch.gain = this.ctx.createGain();
        ch.gain.gain.value = 0;
        if (LOWPASS_SOUNDS.includes(name) && kind === "loop") {
          ch.lowpass = this.ctx.createBiquadFilter();
          ch.lowpass.type = "lowpass";
          ch.lowpass.Q.value = 0.7;
          ch.lowpass.frequency.value = LOWPASS_OPEN;
          el.dataset.lowpass = String(LOWPASS_OPEN);
          src.connect(ch.gain).connect(ch.lowpass).connect(this.ctx.destination);
        } else {
          src.connect(ch.gain).connect(this.ctx.destination);
        }
        el.volume = 1;
      } catch {
        ch.gain = null;
      }
    }
    if (!ch.gain) el.volume = 0;
    const settle = () => {
      this.settled += 1;
      if (this.settled === this.total && !this.disposed) {
        const any = [...this.all(this.loops), ...this.all(this.shots)].some((c) => c.ok);
        this.onAvailable(any);
      }
    };
    el.addEventListener("canplay", () => { ch.ok = true; el.dataset.ok = "1"; settle(); }, { once: true });
    el.addEventListener("error", () => { ch.ok = false; el.dataset.ok = "0"; settle(); }, { once: true });
    el.src = DIR + file;
    this.root.appendChild(el);
    return ch;
  }

  private all<T extends string>(m: Partial<Record<T, Channel>>): Channel[] {
    return Object.values(m).filter((c): c is Channel => !!c);
  }

  /** 把电平写到 GainNode（或 volume）和 data-level 上 */
  private apply(ch: Channel, level: number) {
    ch.level = level;
    if (ch.gain && this.ctx) ch.gain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.015);
    else ch.el.volume = level;
    ch.el.dataset.level = level.toFixed(3);
  }

  private play(ch: Channel) {
    ch.el.play().then(() => { this.unlocked = true; }).catch(() => { /* 自动播放被拦截：等手势 */ });
  }

  /** 手势里预热：play 后立刻 pause，让 iOS 允许之后由计时器触发的 play() */
  private prime(ch: Channel) {
    if (ch.priming || !ch.el.paused) return;
    ch.priming = true;
    const wasLevel = ch.level;
    this.apply(ch, 0);
    ch.el.play().then(() => {
      this.unlocked = true;
      if (!ch.priming) return; // 期间被正式触发了，不要暂停
      ch.priming = false;
      ch.el.pause();
      ch.el.currentTime = 0;
      this.apply(ch, wasLevel);
    }).catch(() => { ch.priming = false; this.apply(ch, wasLevel); });
  }

  private onGesture = () => {
    if (this.ctx && this.ctx.state !== "running") this.ctx.resume().catch(() => {});
    if (this.unlocked) return;
    for (const ch of this.all(this.loops)) {
      if (ch.target > 0 && this.soundOn && !this.hidden) this.play(ch);
      else this.prime(ch);
    }
    for (const ch of this.all(this.shots)) this.prime(ch);
  };

  private loadBuffer(name: ShotSound) {
    const ctx = this.ctx;
    if (!ctx) return; // 没有 Web Audio：退回 <audio> 元素重放
    fetch(DIR + ONESHOTS[name].file)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((ab) => ctx.decodeAudioData(ab))
      .then((buf) => {
        if (this.disposed) return;
        this.buffers[name] = buf;
        const ch = this.shots[name];
        if (ch) ch.el.dataset.buffer = "1";
      })
      .catch(() => { /* 解码失败：退回元素重放 */ });
  }

  /** 页面事件：前景动画在接触的那一帧派发（落刀、菜落锅、蛋落回锅面） */
  private onShotEvent = (e: Event) => {
    const d = (e as CustomEvent<{ sound?: unknown; surface?: unknown }>).detail;
    const name = d?.sound;
    if (typeof name !== "string" || !(name in ONESHOTS)) {
      warnOnce(`${KITCHEN_ONESHOT_EVENT}: 未登记的声音 ${String(name)}`);
      return;
    }
    if (name === "eggHop") {
      // 只给锅里的跳出声；桌面上的小跳（前景漫画在讲故事时）不出声
      if (d?.surface !== undefined && d.surface !== "pan") return;
      const now = performance.now();
      if (now - this.lastHop < HOP_MIN_GAP_MS) return;
      if (this.fire("eggHop", { rate: 0.94 + Math.random() * 0.12, gain: Math.pow(10, (Math.random() * 3 - 1.5) / 20) })) this.lastHop = now;
      return;
    }
    this.fire(name as ShotSound);
  };

  /** 前景一段动作开始 / 停止（翻炒、调汁） */
  private onActionEvent = (e: Event) => {
    const d = (e as CustomEvent<{ name?: unknown; phase?: unknown }>).detail;
    const sound = typeof d?.name === "string" ? CUES.action[d.name] : undefined;
    if (!sound || !(sound in ONESHOTS)) { warnOnce(`${KITCHEN_ACTION_EVENT}: 未登记的动作 ${String(d?.name)}`); return; }
    const tag = `action:${String(d!.name)}`;
    if (d!.phase === "start") { this.fadeTag(tag, 0.05); if (this.fire(sound as ShotSound, { tag })) this.actionStart.set(tag, performance.now()); }
    // 刚开始就停（快速滚过格子）：60 ms 收掉，不留一小截声音
    else this.fadeTag(tag, performance.now() - (this.actionStart.get(tag) ?? -Infinity) < QUICK_STOP_MS ? 0.06 : ACTION_FADE_S);
  };

  /** 前景格子进入 / 离开阅读位置 */
  private onPanelEvent = (e: Event) => {
    const d = (e as CustomEvent<{ key?: unknown; phase?: unknown }>).detail;
    const key = typeof d?.key === "string" ? d.key : null;
    const cues = key ? CUES.panel[key] : undefined;
    if (!key || !cues) return; // 没登记声音的格子：静默
    const tag = `panel:${key}`;
    (this.panelTimers.get(key) ?? []).forEach((id) => window.clearTimeout(id));
    this.panelTimers.delete(key);
    if (d!.phase !== "start") { this.fadeTag(tag, PANEL_FADE_S); return; }
    this.panelTimers.set(key, cues.map((c) => window.setTimeout(() => {
      if (c.sound in ONESHOTS) this.fire(c.sound as ShotSound, { tag });
      else warnOnce(`audio-map cues.panel ${key}: 未登记的声音 ${c.sound}`);
    }, c.delay * 1000)));
  };

  /** 带名字的声部淡出后停止 */
  private fadeTag(tag: string, fadeS: number) {
    const v = this.tagged.get(tag);
    if (!v || !this.ctx) return;
    this.tagged.delete(tag);
    const now = this.ctx.currentTime;
    v.g.gain.cancelScheduledValues(now);
    v.g.gain.setValueAtTime(v.g.gain.value, now);
    v.g.gain.linearRampToValueAtTime(0, now + fadeS);
    try { v.src.stop(now + fadeS + 0.01); } catch { /* 已结束 */ }
  }

  private stopVoices() {
    for (const v of this.voices) { try { v.stop(); } catch { /* 已结束 */ } }
    this.voices.clear();
    this.tagged.clear();
    this.panelTimers.forEach((ids) => ids.forEach((id) => window.clearTimeout(id)));
    this.panelTimers.clear();
  }

  private onVisibility = () => {
    this.hidden = document.visibilityState === "hidden";
    if (this.hidden) {
      this.stopVoices();
      for (const ch of [...this.all(this.loops), ...this.all(this.shots)]) {
        if (!ch.el.paused) ch.el.pause();
        ch.priming = false;
      }
    }
    // 回到前台：tick 会按目标音量重新 play 循环声；错过的单次音效不补播
  };

  private tick = () => {
    const now = performance.now();
    const step = ((now - this.lastTick) / 1000) * SLEW_PER_SEC;
    this.lastTick = now;
    for (const ch of this.all(this.loops)) {
      const target = this.soundOn && !this.hidden && ch.ok ? ch.target : 0;
      const v = ch.level + Math.sign(target - ch.level) * Math.min(Math.abs(target - ch.level), step);
      const level = Math.min(1, Math.max(0, v));
      if (level !== ch.level) this.apply(ch, level);
      if (target > 0 && ch.el.paused && !ch.priming && (this.unlocked || !this.gestureNeeded)) this.play(ch);
      if (target === 0 && level === 0 && !ch.el.paused && !ch.priming) ch.el.pause();
    }
  };

  /** 还没解锁时每 50 ms 重试 play() 只会刷一堆 NotAllowedError；先试一次，之后等手势 */
  private get gestureNeeded() {
    if (this.unlocked) return false;
    if (this.triedOnce) return true;
    this.triedOnce = true;
    return false;
  }
  private triedOnce = false;

  setSoundOn(on: boolean) {
    this.soundOn = on;
    if (!on) {
      this.stopVoices();
      for (const ch of this.all(this.shots)) {
        if (!ch.el.paused) { ch.el.pause(); ch.el.currentTime = 0; }
      }
    }
  }

  /** 蛋的飞行进度 → sizzle 低通截止频率（null = 全开） */
  setFlight(flight: number | null) {
    this.setLowpass("sizzle", flight === null ? null : LOWPASS_FAR * Math.pow(LOWPASS_NEAR / LOWPASS_FAR, Math.min(1, Math.max(0, flight))));
  }

  /** 循环声的低通截止频率（null = 全开）；只有 LOWPASS_SOUNDS 里的声音有低通 */
  setLowpass(name: LoopSound, hz: number | null) {
    const ch = this.loops[name];
    if (!ch?.lowpass || !this.ctx) return;
    const f = hz === null ? LOWPASS_OPEN : Math.min(LOWPASS_OPEN, Math.max(200, hz));
    if (ch.el.dataset.lowpass === String(Math.round(f))) return;
    ch.lowpass.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
    ch.el.dataset.lowpass = String(Math.round(f));
  }

  setLevels(levels: Record<LoopSound, number>) {
    for (const name of LOOP_SOUNDS) {
      const ch = this.loops[name];
      if (!ch) continue; // 空位
      ch.target = levels[name];
      ch.el.dataset.target = ch.target.toFixed(3);
    }
  }

  /**
   * 单次音效：从头播一次。静音、后台、未解锁时直接丢弃（不排队、不补播）。
   * - 有解码好的 AudioBuffer（事件触发的 chopHit）：每次新建 BufferSource，允许快速连续触发、彼此重叠。
   * - 其它：同一音效只有一个 <audio>，重触发 = 从头重放，不叠加。
   */
  fire(name: ShotSound, opts: { rate?: number; gain?: number; tag?: string } = {}): boolean {
    const ch = this.shots[name];
    if (!ch || !this.soundOn || this.hidden) return false; // 空位或不可播
    const buf = this.buffers[name];
    if (buf && this.ctx) {
      if (this.ctx.state !== "running") return false; // 还没被手势解锁
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      if (opts.rate) src.playbackRate.value = opts.rate;
      const g = this.ctx.createGain();
      g.gain.value = ONESHOTS[name].volume * (opts.gain ?? 1);
      const pan = ONESHOTS[name].pan;
      const panner = pan !== undefined && pan !== 0 && typeof this.ctx.createStereoPanner === "function" ? this.ctx.createStereoPanner() : null;
      if (panner && pan !== undefined) { panner.pan.value = pan; src.connect(g).connect(panner).connect(this.ctx.destination); }
      else src.connect(g).connect(this.ctx.destination);
      src.onended = () => {
        src.disconnect(); g.disconnect(); panner?.disconnect(); this.voices.delete(src);
        if (opts.tag && this.tagged.get(opts.tag)?.src === src) this.tagged.delete(opts.tag);
      };
      this.voices.add(src);
      if (opts.tag) this.tagged.set(opts.tag, { src, g });
      src.start();
      ch.fired += 1;
      ch.el.dataset.fired = String(ch.fired);
      return true;
    }
    if (!ch.ok) return false;
    ch.priming = false;
    ch.fired += 1;
    ch.el.dataset.fired = String(ch.fired);
    ch.el.currentTime = 0;
    this.apply(ch, ONESHOTS[name].volume);
    this.play(ch);
    return true;
  }

  dispose() {
    this.disposed = true;
    window.clearInterval(this.timer);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("pointerup", this.onGesture);
    window.removeEventListener("touchend", this.onGesture);
    window.removeEventListener("keydown", this.onGesture);
    window.removeEventListener(KITCHEN_ONESHOT_EVENT, this.onShotEvent);
    window.removeEventListener(KITCHEN_ACTION_EVENT, this.onActionEvent);
    window.removeEventListener(COMIC_PANEL_EVENT, this.onPanelEvent);
    this.stopVoices();
    for (const ch of [...this.all(this.loops), ...this.all(this.shots)]) {
      ch.el.pause();
      ch.el.removeAttribute("src");
      ch.el.load();
    }
    this.root.remove();
    this.ctx?.close().catch(() => {});
  }
}

export function useKitchenAudio() {
  const { soundOn, timeline: rawTimeline, beats: rawBeats, flight } = useScene();
  // 套上声音分支自己的场景对应表；时间轴里的 beat 也换成带新 audio 的那一份
  const beats = useMemo(() => withAudioMap(rawBeats), [rawBeats]);
  const timeline = useMemo<Timeline>(() => ({ ...rawTimeline, beat: beats[rawTimeline.index] ?? rawTimeline.beat }), [rawTimeline, beats]);
  const mixer = useRef<KitchenMixer | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  // 固定的一组 <audio>，整个生命周期只创建一次
  useEffect(() => {
    const m = new KitchenMixer(setAvailable);
    mixer.current = m;
    return () => { m.dispose(); mixer.current = null; };
  }, []);

  useEffect(() => { mixer.current?.setSoundOn(soundOn); }, [soundOn]);
  useEffect(() => { mixer.current?.setFlight(flight); }, [flight]);

  // 目标音量：完全由节拍表推导
  // 目标音量：节拍表推导（loopLevels）+ 本段 audio-map 的 ramps；steps 的低通按本段 lowpass 规则（没写 = 全开）
  useEffect(() => {
    mixer.current?.setLevels(mappedLevels(timeline, loopLevels(timeline, beats)));
    const b = timeline.beat as MappedBeat;
    const hz = rampValue(b.mapLowpass, "steps", timeline.p);
    mixer.current?.setLowpass("steps", hz);
  }, [timeline, beats]);

  // 单次音效：向下滚动越过节拍表里的触发点时播一次
  const prevT = useRef<Timeline | null>(null);
  /** oncePerVisit 段：本次进入里已经越过（播过或被跳过）的单次音效，键 = 段序号，值 = 第几个 */
  const visit = useRef(new Map<number, Set<number>>());
  useEffect(() => {
    if (document.visibilityState === "hidden") {
      // 后台里时间轴若有变化只重同步，不触发
      prevT.current = timeline;
      return;
    }
    const prev = prevT.current;
    prevT.current = timeline;
    // 时间轴回到某段开始之前：这一段的"本次进入"结束，下次进入重新允许
    for (const bi of [...visit.current.keys()]) if (timeline.index < bi) visit.current.delete(bi);
    const crossed = crossedShots(prev, timeline, beats);
    if (crossed.length === 0) return;
    const once = (bi: number) => (beats[bi] as MappedBeat).mapOncePerVisit === true;
    const fresh = crossed.filter((c) => !(once(c.bi) && visit.current.get(c.bi)?.has(c.oi)));
    // 越过就算这次进入用掉了（包括被"只播最后一个 / 跨太远全部跳过"略掉的），段内来回滚动不再响
    for (const c of crossed) if (once(c.bi)) { const set = visit.current.get(c.bi) ?? new Set<number>(); set.add(c.oi); visit.current.set(c.bi, set); }
    if (!soundOn || fresh.length === 0) return;
    // 一次更新跨得太远（拖滚动条、跳转）：越过的全部跳过；同一次越过多个：只播最后一个，不堆在一起
    if (prev && Math.abs(posVh(timeline, beats) - posVh(prev, beats)) > MAX_CROSS_VH) return;
    mixer.current?.fire(fresh[fresh.length - 1].sound);
  }, [timeline, soundOn, beats]);

  // 回到前台：把"上一次时间轴"重同步到当前滚动位置（后台期间越过的触发点不补播；之后的真实滚动照常触发）
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const vh = (window.scrollY / Math.max(1, window.innerHeight)) * 100;
      prevT.current = locate(vh, rawBeats);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [rawBeats]);

  return { available };
}
