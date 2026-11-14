"use client";
/**
 * 厨房声音导演。素材库录音，不合成。**不自己定节奏**：所有音量和触发点来自统一节拍表
 * （src/lib/beats.json，见 docs/BEATS.md），按 useScene().timeline 计算。
 * - 循环声：每段 audio.loops 的稳定音量；进入阶段从上一段渐变过来；audio.fades 在指定阶段内渐变。
 *   目标音量交给 GainNode.setTargetAtTime 做很短的平滑（防止拖动滚动条时爆音）。
 * - 单次音效：向下滚动越过 audio.oneshots.at 时播一次；回滚不播。
 * - 文件还没提供（404 / 解码失败）就保持静音；available 表示至少有一条能播。
 *
 * 为什么用 Web Audio 而不是 <audio>：
 * - <audio loop> 播 mp3 在循环点有几十毫秒空隙；AudioBufferSourceNode.loop 是采样级无缝循环。
 *   不认 LAME gapless 头的解码器会在首尾多出编码器填充的近零采样，解码后把它们裁掉（loopStart/loopEnd）。
 * - iOS Safari 忽略 HTMLMediaElement.volume，渐变只能用 GainNode 做。
 * - iOS 只允许在用户手势里启动 AudioContext：SoundToggle 的点击里调用 unlockKitchenAudio()；
 *   之后任何一次点按也会尝试恢复（被来电、切后台打断时）。
 *
 * 加载：打开声音时立刻加载；没打开时在页面空闲后低优先级预载（8 个文件共约 1.6 MB）。
 */
import { useEffect, useRef, useState } from "react";
import { crossedOneShots, loopLevels, type LoopSound, type OneShotSound, type Timeline } from "@/lib/beats";
import { useScene } from "@/lib/scene-context";

const DIR = "/assets/audio/";
/** 循环声文件。音量完全由节拍表 audio.loops / audio.fades 决定 */
const LOOPS: Record<LoopSound, string> = {
  room: "room-loop.mp3",
  sizzle: "sizzle-loop.mp3",
  chop: "chop-loop.mp3",
  stirfry: "stirfry-loop.mp3",
  sauce: "sauce-stir-loop.mp3",
};
/** 单次音效。文件都已统一到约 -18 LUFS，这里的 volume 是各自的播放音量 */
const ONESHOTS: Record<OneShotSound, { file: string; volume: number }> = {
  stirfryIn: { file: "stirfry-in.mp3", volume: 0.6 },
  catch: { file: "catch.mp3", volume: 0.5 },
  bowlDown: { file: "bowl-down.mp3", volume: 0.6 },
  pour: { file: "pour.mp3", volume: 0.5 },
};
const LOOP_NAMES = Object.keys(LOOPS) as LoopSound[];
const ALL_FILES = [...Object.values(LOOPS), ...Object.values(ONESHOTS).map((o) => o.file)];

/** 循环声音量平滑的时间常数（秒）：约 0.25 s 到达 95%，只去掉跳变，节奏由节拍表决定 */
const FADE_TC = 0.08;
/** 开关声音时总音量的时间常数（秒） */
const MASTER_TC = 0.15;
/** 首尾裁剪：绝对值低于这个的采样视为编码器填充，最多裁这么多采样 */
const EDGE_EPS = 1e-4;
const EDGE_MAX = 4096;

type Clip = { buffer: AudioBuffer; start: number; end: number };
type Graph = {
  ctx: AudioContext;
  master: GainNode;
  gains: Record<LoopSound, GainNode>;
  sources: Map<LoopSound, AudioBufferSourceNode>;
  last: Map<LoopSound, number>;
};

let sharedCtx: AudioContext | null = null;

function audioContext(create: boolean): AudioContext | null {
  if (sharedCtx || !create || typeof window === "undefined") return sharedCtx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  sharedCtx = new AC({ latencyHint: "playback" });
  return sharedCtx;
}

/** iOS：用户明确打开声音后按"播放"类会话处理，否则静音开关会让 Web Audio 没声 */
function setAudioSession(type: "playback" | "auto") {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) {
    try { session.type = type; } catch { /* 不支持就算了 */ }
  }
}

/** 必须在用户手势（点击）里同步调用：创建并恢复 AudioContext，播一个静音采样完成 iOS 解锁 */
export function unlockKitchenAudio(): void {
  const ctx = audioContext(true);
  if (!ctx) return;
  setAudioSession("playback");
  if (ctx.state !== "running") void ctx.resume().catch(() => {});
  const src = ctx.createBufferSource();
  src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  src.connect(ctx.destination);
  src.start(0);
}

function edges(buffer: AudioBuffer): { start: number; end: number } {
  let first = Math.min(EDGE_MAX, buffer.length);
  let last = Math.max(buffer.length - 1 - EDGE_MAX, 0);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    let i = 0;
    while (i < first && Math.abs(d[i]) < EDGE_EPS) i++;
    first = Math.min(first, i);
    let j = buffer.length - 1;
    while (j > last && Math.abs(d[j]) < EDGE_EPS) j--;
    last = Math.max(last, j);
  }
  if (last <= first) return { start: 0, end: buffer.duration };
  return { start: first / buffer.sampleRate, end: (last + 1) / buffer.sampleRate };
}

async function loadClip(file: string, signal: AbortSignal): Promise<Clip | null> {
  try {
    const res = await fetch(DIR + file, { signal });
    if (!res.ok) return null;
    const data = await res.arrayBuffer();
    // 用离线上下文解码：不需要用户手势，也不会在控制台留下自动播放警告
    const buffer = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(data);
    return { buffer, ...edges(buffer) };
  } catch {
    return null;
  }
}

export function useKitchenAudio() {
  const { soundOn, timeline, beats } = useScene();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState(0);
  const clips = useRef<Partial<Record<string, Clip>>>({});
  const graph = useRef<Graph | null>(null);
  const levels = useRef<Partial<Record<LoopSound, number>>>({});
  const soundRef = useRef(soundOn);
  const loadRef = useRef<() => void>(() => {});

  // 加载：空闲时预载；打开声音时（见下）立刻加载
  useEffect(() => {
    const ac = new AbortController();
    let state: "idle" | "loading" | "done" = "idle";
    loadRef.current = () => {
      if (state !== "idle") return;
      state = "loading";
      void Promise.all(ALL_FILES.map((f) => loadClip(f, ac.signal))).then((res) => {
        if (ac.signal.aborted) return;
        res.forEach((clip, i) => { if (clip) clips.current[ALL_FILES[i]] = clip; });
        state = "done";
        setAvailable(res.some(Boolean));
        setLoaded((n) => n + 1);
      });
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const idle = w.requestIdleCallback
      ? w.requestIdleCallback(() => loadRef.current(), { timeout: 6000 })
      : window.setTimeout(() => loadRef.current(), 3000);
    return () => {
      ac.abort();
      if (w.cancelIdleCallback) w.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      loadRef.current = () => {};
      const g = graph.current;
      if (g) {
        g.sources.forEach((s) => { try { s.stop(); } catch { /* 已停 */ } });
        g.master.disconnect();
        graph.current = null;
        void g.ctx.suspend().catch(() => {});
      }
    };
  }, []);

  // 开关声音：建图、启动循环、总音量淡入淡出
  useEffect(() => {
    soundRef.current = soundOn;
    if (soundOn) {
      loadRef.current();
      const ctx = audioContext(true);
      if (!ctx) return;
      let g = graph.current;
      if (!g || g.ctx !== ctx) {
        const master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);
        const gains = {} as Record<LoopSound, GainNode>;
        for (const name of LOOP_NAMES) {
          const gain = ctx.createGain();
          gain.gain.value = levels.current[name] ?? 0;
          gain.connect(master);
          gains[name] = gain;
        }
        const last = new Map(LOOP_NAMES.map((n) => [n, levels.current[n] ?? 0] as const));
        g = { ctx, master, gains, sources: new Map(), last };
        graph.current = g;
      }
      for (const name of LOOP_NAMES) {
        const clip = clips.current[LOOPS[name]];
        if (!clip || g.sources.has(name)) continue;
        const src = ctx.createBufferSource();
        src.buffer = clip.buffer;
        src.loop = true;
        src.loopStart = clip.start;
        src.loopEnd = clip.end;
        src.connect(g.gains[name]);
        src.start(0, clip.start);
        g.sources.set(name, src);
      }
      setAudioSession("playback");
      if (ctx.state !== "running") void ctx.resume().catch(() => {});
      g.master.gain.setTargetAtTime(1, ctx.currentTime, MASTER_TC);
      return;
    }
    const g = graph.current;
    if (!g) return;
    g.master.gain.setTargetAtTime(0, g.ctx.currentTime, MASTER_TC);
    setAudioSession("auto");
    const id = window.setTimeout(() => {
      if (!soundRef.current) void g.ctx.suspend().catch(() => {});
    }, 900);
    return () => window.clearTimeout(id);
  }, [soundOn, loaded]);

  // 目标音量：完全由节拍表推导
  useEffect(() => {
    const lv = loopLevels(timeline, beats);
    levels.current = lv;
    const g = graph.current;
    if (!g) return;
    for (const name of LOOP_NAMES) {
      const v = lv[name];
      if (Math.abs((g.last.get(name) ?? -1) - v) < 1e-3) continue;
      g.last.set(name, v);
      g.gains[name].gain.setTargetAtTime(v, g.ctx.currentTime, FADE_TC);
    }
  }, [timeline, beats, soundOn, loaded]);

  // 单次音效：向下滚动越过节拍表里的触发点时播一次
  const prevT = useRef<Timeline | null>(null);
  useEffect(() => {
    const fired = crossedOneShots(prevT.current, timeline, beats);
    prevT.current = timeline;
    const g = graph.current;
    if (!soundOn || !g || g.ctx.state !== "running") return;
    for (const name of fired) {
      const { file, volume } = ONESHOTS[name];
      const clip = clips.current[file];
      if (!clip) continue;
      const src = g.ctx.createBufferSource();
      src.buffer = clip.buffer;
      const gain = g.ctx.createGain();
      gain.gain.value = volume;
      src.connect(gain).connect(g.master);
      src.start(0, clip.start);
    }
  }, [timeline, soundOn, beats]);

  // 切到后台暂停；回来、或被系统打断后的下一次点按时恢复
  useEffect(() => {
    const resume = () => {
      const ctx = graph.current?.ctx;
      if (soundRef.current && ctx && ctx.state !== "running" && !document.hidden) void ctx.resume().catch(() => {});
    };
    const onVisibility = () => {
      const ctx = graph.current?.ctx;
      if (!ctx) return;
      if (document.hidden) void ctx.suspend().catch(() => {});
      else resume();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    };
  }, []);

  return { available };
}
