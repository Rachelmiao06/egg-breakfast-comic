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
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { crossedOneShots, locate, loopLevels, LOOP_SOUNDS, phaseEdges, type Beat, type LoopSound, type OneShotSound, type Timeline } from "@/lib/beats";
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
  steps: "footsteps-loop.mp3", // 暂无素材（寻找段的脚步），保持静音
};
/** 单次音效：文件与播放音量（素材已统一到约 -18 LUFS，这里是相对电平） */
const ONESHOTS: Record<OneShotSound, { file: string; volume: number }> = {
  stirfryIn: { file: "stirfry-in.mp3", volume: 0.6 },
  catch: { file: "catch.mp3", volume: 0.6 },
  bowlDown: { file: "bowl-down.mp3", volume: 0.6 },
  pour: { file: "pour.mp3", volume: 0.5 }, // 暂无素材（刻意留空），保持静音
  momCall: { file: "mom-call.mp3", volume: 0.6 }, // 暂无素材："宝宝，来吃饭啦"
  eggCall: { file: "egg-call.mp3", volume: 0.6 }, // 暂无素材：蛋大声喊"妈！这里！"
  pop: { file: "pop.mp3", volume: 0.6 }, // 暂无素材："啵！"（蛋从锅里蹦起的声音）
  eggSmall: { file: "egg-small.mp3", volume: 0.5 }, // 暂无素材：蛋小声"我在这儿……"
};
const ONESHOT_SOUNDS = Object.keys(ONESHOTS) as OneShotSound[];

type SceneAudio = Beat["audio"];
/** audio-map.json 里一段的写法：单次音效的 at 可以是数字（段内进度 0–1），也可以是阶段符号 */
type MapScene = Omit<SceneAudio, "oneshots"> & { oneshots: { sound: string; at: number | string }[] };
const SCENE_AUDIO = (audioMap as { scenes: Record<string, MapScene> }).scenes;
/**
 * 触发点符号：enterEnd / actionEnd / holdEnd（= 该段进入 / 动作 / 停留阶段的结束处），可带偏移，如 "actionEnd-0.02"。
 * 由当前节拍表的 phases 算出，所以同一张表同时适用于新旧两版节拍（catch 的落铲在 v1 是 0.78、v2 是 0.80）。
 */
const AT_SYMBOL = /^(enterEnd|actionEnd|holdEnd)([+-]\d*\.?\d+)?$/;
export function resolveAt(b: Beat, at: number | string): number | null {
  if (typeof at === "number") return at;
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
export function withAudioMap(beats: Beat[]): Beat[] {
  return beats.map((b) => {
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
      if (at === null) { warnOnce(`audio-map.json: 场景 ${b.id} 的触发点 ${String(o.at)} 不认识（数字或 enterEnd/actionEnd/holdEnd±偏移）`); continue; }
      oneshots.push({ sound: o.sound as OneShotSound, at });
    }
    return { ...b, audio: { loops, fades, oneshots } };
  });
}
function warnOnce(msg: string) {
  if (!warned.has(msg)) { warned.add(msg); if (process.env.NODE_ENV !== "production") console.warn(msg); }
  return true;
}

/** 平滑速度：音量每秒最多变化这么多（满量程），只用于去掉跳变，节奏由节拍表决定 */
const SLEW_PER_SEC = 2.5;
const TICK_MS = 50;
/** sizzle 低通：远（flight 0）→ 近（flight 1）；全开 = 不起作用 */
const LOWPASS_FAR = 1500, LOWPASS_NEAR = 16000, LOWPASS_OPEN = 20000;

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
  private shots: Partial<Record<OneShotSound, Channel>> = {};
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
    const shotNames = ONESHOT_SOUNDS.filter((n) => AVAILABLE.has(n));
    this.total = loopNames.length + shotNames.length;
    for (const name of loopNames) this.loops[name] = this.channel(name, "loop", LOOP_FILES[name], true);
    for (const name of shotNames) this.shots[name] = this.channel(name, "oneshot", ONESHOTS[name].file, false);
    if (this.total === 0) queueMicrotask(() => onAvailable(false));
    this.hidden = document.visibilityState === "hidden";
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pointerup", this.onGesture, { passive: true });
    window.addEventListener("touchend", this.onGesture, { passive: true });
    window.addEventListener("keydown", this.onGesture, { passive: true });
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
        if (name === "sizzle" && kind === "loop") {
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

  private onVisibility = () => {
    this.hidden = document.visibilityState === "hidden";
    if (this.hidden) {
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
      for (const ch of this.all(this.shots)) {
        if (!ch.el.paused) { ch.el.pause(); ch.el.currentTime = 0; }
      }
    }
  }

  /** 蛋的飞行进度 → sizzle 低通截止频率（null = 全开） */
  setFlight(flight: number | null) {
    const ch = this.loops.sizzle;
    if (!ch?.lowpass || !this.ctx) return;
    const hz = flight === null ? LOWPASS_OPEN : LOWPASS_FAR * Math.pow(LOWPASS_NEAR / LOWPASS_FAR, Math.min(1, Math.max(0, flight)));
    ch.lowpass.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.05);
    ch.el.dataset.lowpass = String(Math.round(hz));
  }

  setLevels(levels: Record<LoopSound, number>) {
    for (const name of LOOP_SOUNDS) {
      const ch = this.loops[name];
      if (!ch) continue; // 空位
      ch.target = levels[name];
      ch.el.dataset.target = ch.target.toFixed(3);
    }
  }

  /** 单次音效：从头播一次。同一音效只有一个元素，重触发 = 重放，不叠加 */
  fire(name: OneShotSound) {
    const ch = this.shots[name];
    if (!ch || !ch.ok || !this.soundOn || this.hidden) return; // 空位或不可播
    ch.priming = false;
    ch.fired += 1;
    ch.el.dataset.fired = String(ch.fired);
    ch.el.currentTime = 0;
    this.apply(ch, ONESHOTS[name].volume);
    this.play(ch);
  }

  dispose() {
    this.disposed = true;
    window.clearInterval(this.timer);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("pointerup", this.onGesture);
    window.removeEventListener("touchend", this.onGesture);
    window.removeEventListener("keydown", this.onGesture);
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
  useEffect(() => { mixer.current?.setLevels(loopLevels(timeline, beats)); }, [timeline, beats]);

  // 单次音效：向下滚动越过节拍表里的触发点时播一次
  const prevT = useRef<Timeline | null>(null);
  useEffect(() => {
    if (document.visibilityState === "hidden") {
      // 后台里时间轴若有变化只重同步，不触发
      prevT.current = timeline;
      return;
    }
    const fired = crossedOneShots(prevT.current, timeline, beats);
    prevT.current = timeline;
    if (!soundOn) return;
    for (const name of fired) mixer.current?.fire(name);
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
