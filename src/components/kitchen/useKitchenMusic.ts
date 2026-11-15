"use client";
/**
 * 配乐。和 useKitchenAudio 共用同一个 AudioContext 和同一个声音开关，但不碰它的混音规则：
 *
 * - 8 条循环 stem（tools/music_build.py 合成，同速同长 20 s）解码成 AudioBuffer，**同一时刻** loop 起播，
 *   之后永远对拍；每条 stem 只有一个 GainNode，电平由 music-map.json 按场景给出（进入阶段从上一段渐变，
 *   规则与 beats.ts loopLevels 相同；段内可写 ramps），再经 setTargetAtTime 平滑，所以配乐跟着滚动换景，没有任何自己的滚动监听。
 * - stinger：向下越过 music-map 里的触发点时播一次（同一次更新越过多个只播最后一个；一次跨 40 vh 以上全部跳过；
 *   回滚不播；后台期间越过的不补播）。与 audio-map 的单次音效是两套，互不挤占。
 * - egg-bloop：开场蛋每落回锅面一次（前景派发 kitchen:oneshot eggHop，surface 为 pan 或未写），马林巴响一个五声音阶的音。
 * - 避让：前景的动作声（kitchen:oneshot / kitchen:action / comic:panel）一响，配乐总线短暂压低约 3 dB 再回来，切菜、落铲、淋汁听得清。
 * - 懒加载：用户第一次打开声音才下载并解码（约 2.2 MB），文件没解码好之前静音。
 * - 整体音量：localStorage kitchen.musicGain 或网址 ?music=（默认 1，0 = 关闭配乐），便于 A/B。
 * - 验收用的 data 属性在 <div data-kitchen-music> 上：data-ready、data-level-<stem>、data-fired、data-last。
 */
import { useEffect, useRef } from "react";
import type { Beat, Timeline } from "@/lib/beats";
import musicMap from "./music-map.json";

const DIR = "/assets/audio/music/";
export const STEM_NAMES = ["home-pad", "home-pluck", "home-bass", "home-melody", "home-sparkle", "tender", "curious", "empty"] as const;
type Stem = (typeof STEM_NAMES)[number];
type At = number | string;
type MusicRamp = { sound: string; from: number; to: number; start: At; end: At };
type MusicStinger = { sound: string; at: At; gain?: number; rate?: number };
type MusicScene = { stems: Partial<Record<Stem, number>>; ramps?: MusicRamp[]; stingers?: MusicStinger[]; bloop?: boolean };
const SCENES = (musicMap as unknown as { scenes: Record<string, MusicScene> }).scenes;
const STINGER_SOUNDS = ["idea-ding", "missing-q", "catch-chord", "handoff-bell", "yolk-cascade", "mom-call", "egg-small", "egg-call", "punch-dum", "end-hold", "egg-bloop", "cricket"] as const;

/** 电平平滑时间常数（秒）：慢一点，换景像混音台推子，不像开关 */
const LEVEL_TC = 0.35;
/** 配乐总线整体电平（相对 stem 的 -20 LUFS；各场景电平再乘它） */
const BUS = 0.6;
/** 音乐事件整体再轻一点（2026-11-15 用户：乐器声太明显） */
const STINGER_TRIM = 0.8;
/** 前景动作声响起时配乐的避让：压到 0.5（约 -6 dB），0.3 s 后以 0.25 s 的时间常数回来 */
const DUCK_TO = 0.5, DUCK_HOLD_S = 0.3, DUCK_RELEASE_TC = 0.25;
/** 蛋的五声音阶（相对 C5 的变速）：C D E G A */
const BLOOP_RATES = [1, 1.122, 1.26, 1.498, 1.682];
const MAX_CROSS_VH = 40;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 整体音乐音量倍数：网址 ?music= 优先，其次 localStorage kitchen.musicGain，默认 1；非法值当 1 */
function userGain(): number {
  const parse = (s: string | null) => { const v = s === null ? NaN : parseFloat(s); return Number.isFinite(v) ? Math.min(2, Math.max(0, v)) : null; };
  try {
    const q = parse(new URLSearchParams(window.location.search).get("music"));
    if (q !== null) return q;
  } catch { /* 忽略 */ }
  try {
    const l = parse(window.localStorage.getItem("kitchen.musicGain"));
    if (l !== null) return l;
  } catch { /* 隐私模式 */ }
  return 1;
}

type ResolveAt = (b: Beat, at: number | string) => number | null;

/** 某场景在段内进度 p 的 stem 电平（基础值 + ramps） */
function sceneLevels(b: Beat | undefined, p: number, resolve: ResolveAt): Record<Stem, number> {
  const out = Object.fromEntries(STEM_NAMES.map((s) => [s, 0])) as Record<Stem, number>;
  const m = b ? SCENES[b.id] : undefined;
  if (!b || !m) return out;
  for (const s of STEM_NAMES) out[s] = m.stems[s] ?? 0;
  const ramps = (m.ramps ?? []).map((r) => ({ ...r, a: resolve(b, r.start), z: resolve(b, r.end) })).filter((r) => r.a !== null && r.z !== null && (STEM_NAMES as readonly string[]).includes(r.sound));
  for (const s of STEM_NAMES) {
    const rs = ramps.filter((r) => r.sound === s).sort((x, y) => (x.a as number) - (y.a as number));
    let v: number | null = null;
    for (const r of rs) {
      const a = r.a as number, z = Math.max(a, r.z as number);
      if (v === null && p < a) { v = r.from; break; }
      if (p < a) break;
      v = p >= z || z === a ? r.to : r.from + (r.to - r.from) * ((p - a) / (z - a));
    }
    if (v !== null) out[s] = v;
  }
  return out;
}

/** 时间轴 → 各 stem 的目标电平（进入阶段从上一段渐变） */
export function musicLevels(t: Timeline, beats: Beat[], resolve: ResolveAt): Record<Stem, number> {
  const cur = sceneLevels(beats[t.index], t.p, resolve);
  if (t.phase !== "enter" || t.index === 0) return cur;
  const prev = sceneLevels(beats[t.index - 1], 1, resolve);
  const out = { ...cur };
  for (const s of STEM_NAMES) out[s] = prev[s] + (cur[s] - prev[s]) * clamp01(t.phaseP);
  return out;
}

function posVh(t: Timeline, beats: Beat[]) {
  let acc = 0;
  for (let i = 0; i < t.index && i < beats.length; i++) acc += beats[i].lengthVh;
  return acc + t.p * (beats[t.index]?.lengthVh ?? 0);
}

/** 两次时间轴之间向前越过的 stinger */
function crossedStingers(prev: Timeline | null, cur: Timeline, beats: Beat[], resolve: ResolveAt): MusicStinger[] {
  if (!prev) return [];
  const pos = (t: Timeline) => t.index + t.p;
  if (pos(cur) <= pos(prev)) return [];
  const out: MusicStinger[] = [];
  for (let i = prev.index; i <= cur.index && i < beats.length; i++) {
    for (const s of SCENES[beats[i].id]?.stingers ?? []) {
      const at = resolve(beats[i], s.at);
      if (at === null) continue;
      if (i + at > pos(prev) && i + at <= pos(cur)) out.push(s);
    }
  }
  return out;
}

class MusicEngine {
  private root: HTMLDivElement;
  private bus: GainNode;      // 避让
  private master: GainNode;   // 开关 / 后台 / 用户音量
  private stems: Partial<Record<Stem, { src: AudioBufferSourceNode; gain: GainNode }>> = {};
  private buffers: Record<string, AudioBuffer> = {};
  private loading: Promise<void> | null = null;
  private started = false;
  private on = false;
  private hidden = false;
  private disposed = false;
  private levels: Record<Stem, number> = Object.fromEntries(STEM_NAMES.map((s) => [s, 0])) as Record<Stem, number>;
  private bloop = false;
  private lastBloop = -Infinity;
  private fired = 0;
  private userGain = 1;
  private duckTimer = 0;

  constructor(private ctx: AudioContext) {
    this.root = document.createElement("div");
    this.root.hidden = true;
    this.root.dataset.kitchenMusic = "";
    this.root.dataset.ready = "0";
    this.root.dataset.fired = "0";
    document.body.appendChild(this.root);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(this.master).connect(ctx.destination);
    this.hidden = document.visibilityState === "hidden";
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("kitchen:oneshot", this.onShot);
    window.addEventListener("kitchen:action", this.onDuck);
    window.addEventListener("comic:panel", this.onDuck);
  }

  private get audible() { return this.on && !this.hidden && this.userGain > 0; }

  private applyMaster() {
    this.master.gain.setTargetAtTime(this.audible ? BUS * this.userGain : 0, this.ctx.currentTime, 0.3);
  }

  private onVisibility = () => { this.hidden = document.visibilityState === "hidden"; this.applyMaster(); };

  /** 用户打开 / 关闭声音。第一次打开才去下载 */
  setOn(on: boolean) {
    this.on = on;
    this.userGain = userGain();
    if (on && !this.loading) this.loading = this.load();
    this.applyMaster();
  }

  private async load() {
    const names = [...STEM_NAMES, ...STINGER_SOUNDS.map((n) => "st-" + n)];
    await Promise.all(names.map(async (n) => {
      try {
        const r = await fetch(DIR + n + ".mp3");
        if (!r.ok) throw new Error(String(r.status));
        const buf = await this.ctx.decodeAudioData(await r.arrayBuffer());
        if (!this.disposed) this.buffers[n] = buf;
      } catch { /* 这一条解码失败：保持静音 */ }
    }));
    if (this.disposed) return;
    this.startStems();
  }

  /** 所有 stem 同一时刻起播（同长度 → 永远对拍） */
  private startStems() {
    if (this.started) return;
    const t0 = this.ctx.currentTime + 0.1;
    for (const s of STEM_NAMES) {
      const buf = this.buffers[s];
      if (!buf) continue;
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain).connect(this.bus);
      src.start(t0);
      this.stems[s] = { src, gain };
    }
    this.started = true;
    this.root.dataset.ready = "1";
    this.setLevels(this.levels, true);
  }

  setLevels(levels: Record<Stem, number>, instant = false) {
    this.levels = levels;
    for (const s of STEM_NAMES) {
      this.root.dataset[`level${s.replace(/(^|-)(\w)/g, (_m, _d, c: string) => c.toUpperCase())}`] = levels[s].toFixed(3);
      const st = this.stems[s];
      if (!st) continue;
      if (instant) st.gain.gain.setValueAtTime(levels[s], this.ctx.currentTime);
      else st.gain.gain.setTargetAtTime(levels[s], this.ctx.currentTime, LEVEL_TC);
    }
  }

  setBloop(on: boolean) { this.bloop = on; }

  stinger(name: string, gain = 0.5, rate = 1) {
    const buf = this.buffers["st-" + name];
    if (!buf || !this.audible || this.ctx.state !== "running") return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = gain * STINGER_TRIM;
    src.connect(g).connect(this.bus);
    src.onended = () => { src.disconnect(); g.disconnect(); };
    src.start();
    this.fired += 1;
    this.root.dataset.fired = String(this.fired);
    this.root.dataset.last = name;
    return true;
  }

  private onShot = (e: Event) => {
    const d = (e as CustomEvent<{ sound?: unknown; surface?: unknown }>).detail;
    if (d?.sound === "eggHop") {
      const now = performance.now();
      if (!this.bloop || (d.surface !== undefined && d.surface !== "pan") || now - this.lastBloop < 1800) return;
      if (this.stinger("egg-bloop", 0.3, BLOOP_RATES[Math.floor(Math.random() * BLOOP_RATES.length)])) this.lastBloop = now;
      return;
    }
    // 结尾三个点（前景派发 hopTap1/2/3）：不再是"嗒"，换成蟋蟀的一声，三个点逐个略降调（2026-11-15 用户：嗒嗒嗒表达无语太局限、不明显）
    if (typeof d?.sound === "string" && /^hopTap[123]$/.test(d.sound)) {
      this.stinger("cricket", 0.55, [1.04, 1, 0.95][Number(d.sound.slice(-1)) - 1]);
      return;
    }
    this.onDuck();
  };

  /** 前景动作声：配乐总线压低一小下 */
  private onDuck = () => {
    if (!this.audible) return;
    const now = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setTargetAtTime(DUCK_TO, now, 0.02);
    window.clearTimeout(this.duckTimer);
    this.duckTimer = window.setTimeout(() => {
      if (!this.disposed) this.bus.gain.setTargetAtTime(1, this.ctx.currentTime, DUCK_RELEASE_TC);
    }, DUCK_HOLD_S * 1000);
  };

  dispose() {
    this.disposed = true;
    window.clearTimeout(this.duckTimer);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("kitchen:oneshot", this.onShot);
    window.removeEventListener("kitchen:action", this.onDuck);
    window.removeEventListener("comic:panel", this.onDuck);
    for (const st of Object.values(this.stems)) { try { st.src.stop(); } catch { /* 已停 */ } }
    this.stems = {};
    try { this.master.disconnect(); this.bus.disconnect(); } catch { /* 忽略 */ }
    this.root.remove();
  }
}

type Args = {
  /** useKitchenAudio 的 AudioContext（同一个，录音 / 调试工具只需要接一个） */
  getCtx: () => AudioContext | null;
  soundOn: boolean;
  timeline: Timeline;
  beats: Beat[];
  /** 触发点解析（useKitchenAudio 的 resolveAt）：数字、enterEnd / actionEnd / holdEnd±偏移、@共享事件 */
  resolveAt: ResolveAt;
};

export function useKitchenMusic({ getCtx, soundOn, timeline, beats, resolveAt }: Args) {
  const engine = useRef<MusicEngine | null>(null);
  const soundOnRef = useRef(soundOn);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);

  useEffect(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const e = new MusicEngine(ctx);
    engine.current = e;
    e.setOn(soundOnRef.current);
    return () => { e.dispose(); engine.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { engine.current?.setOn(soundOn); }, [soundOn]);

  // 电平：完全由节拍表 + music-map 推导
  useEffect(() => {
    engine.current?.setLevels(musicLevels(timeline, beats, resolveAt));
    engine.current?.setBloop(SCENES[timeline.beat.id]?.bloop === true);
  }, [timeline, beats, resolveAt]);

  // stinger：向下越过触发点时播一次
  const prevT = useRef<Timeline | null>(null);
  useEffect(() => {
    if (document.visibilityState === "hidden") { prevT.current = timeline; return; }
    const prev = prevT.current;
    prevT.current = timeline;
    if (!soundOn) return;
    const crossed = crossedStingers(prev, timeline, beats, resolveAt);
    if (crossed.length === 0) return;
    if (prev && Math.abs(posVh(timeline, beats) - posVh(prev, beats)) > MAX_CROSS_VH) return; // 拖滚动条 / 跳转：全部跳过
    const s = crossed[crossed.length - 1];
    engine.current?.stinger(s.sound, s.gain, s.rate);
  }, [timeline, soundOn, beats, resolveAt]);

  // 回到前台：后台期间越过的触发点不补播
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") prevT.current = null; };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
}
