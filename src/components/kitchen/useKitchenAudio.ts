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
 *   每个元素上的 data-level / data-target / data-fired 是给调试和验收读的。
 * - 自动播放解锁：第一次 pointerup / touchend / keydown 时 resume AudioContext，并把每个元素都"预热"一次
 *   （play 后立刻 pause，iOS 要求每个媒体元素各自在手势里 play 过）。
 * - 页面切到后台：全部暂停；回到前台恢复循环；后台期间越过的触发点不补播。
 * - 文件还没提供（404 / 解码失败）就保持静音；available 表示至少有一条能播。
 */
import { useEffect, useRef, useState } from "react";
import { crossedOneShots, loopLevels, LOOP_SOUNDS, type LoopSound, type OneShotSound, type Timeline } from "@/lib/beats";
import { useScene } from "@/lib/scene-context";

const DIR = "/assets/audio/";
/** 循环声文件（音量完全由节拍表 audio.loops 决定） */
const LOOP_FILES: Record<LoopSound, string> = {
  room: "room-loop.mp3",
  sizzle: "sizzle-loop.mp3",
  chop: "chop-loop.mp3",
  stirfry: "stirfry-loop.mp3", // 暂无素材（刻意留空），保持静音
  sauce: "sauce-stir-loop.mp3",
};
/** 单次音效：文件与播放音量（素材已统一到约 -18 LUFS，这里是相对电平） */
const ONESHOTS: Record<OneShotSound, { file: string; volume: number }> = {
  stirfryIn: { file: "stirfry-in.mp3", volume: 0.6 },
  catch: { file: "catch.mp3", volume: 0.6 },
  bowlDown: { file: "bowl-down.mp3", volume: 0.6 },
  pour: { file: "pour.mp3", volume: 0.5 }, // 暂无素材（刻意留空），保持静音
};
const ONESHOT_SOUNDS = Object.keys(ONESHOTS) as OneShotSound[];

/** 平滑速度：音量每秒最多变化这么多（满量程），只用于去掉跳变，节奏由节拍表决定 */
const SLEW_PER_SEC = 2.5;
const TICK_MS = 50;

type Channel = {
  name: string;
  el: HTMLAudioElement;
  gain: GainNode | null;
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
  private loops = {} as Record<LoopSound, Channel>;
  private shots = {} as Record<OneShotSound, Channel>;
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
    for (const name of LOOP_SOUNDS) this.loops[name] = this.channel(name, "loop", LOOP_FILES[name], true);
    for (const name of ONESHOT_SOUNDS) this.shots[name] = this.channel(name, "oneshot", ONESHOTS[name].file, false);
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
    const ch: Channel = { name, el, gain: null, ok: false, level: 0, target: 0, priming: false, fired: 0 };
    if (this.ctx) {
      try {
        const src = this.ctx.createMediaElementSource(el);
        ch.gain = this.ctx.createGain();
        ch.gain.gain.value = 0;
        src.connect(ch.gain).connect(this.ctx.destination);
        el.volume = 1;
      } catch {
        ch.gain = null;
      }
    }
    if (!ch.gain) el.volume = 0;
    const total = LOOP_SOUNDS.length + ONESHOT_SOUNDS.length;
    const settle = () => {
      this.settled += 1;
      if (this.settled === total && !this.disposed) {
        const any = [...Object.values(this.loops), ...Object.values(this.shots)].some((c) => c.ok);
        this.onAvailable(any);
      }
    };
    el.addEventListener("canplay", () => { ch.ok = true; el.dataset.ok = "1"; settle(); }, { once: true });
    el.addEventListener("error", () => { ch.ok = false; el.dataset.ok = "0"; settle(); }, { once: true });
    el.src = DIR + file;
    this.root.appendChild(el);
    return ch;
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
    for (const ch of Object.values(this.loops)) {
      if (ch.target > 0 && this.soundOn && !this.hidden) this.play(ch);
      else this.prime(ch);
    }
    for (const ch of Object.values(this.shots)) this.prime(ch);
  };

  private onVisibility = () => {
    this.hidden = document.visibilityState === "hidden";
    if (this.hidden) {
      for (const ch of [...Object.values(this.loops), ...Object.values(this.shots)]) {
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
    for (const ch of Object.values(this.loops)) {
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
      for (const ch of Object.values(this.shots)) {
        if (!ch.el.paused) { ch.el.pause(); ch.el.currentTime = 0; }
      }
    }
  }

  setLevels(levels: Record<LoopSound, number>) {
    for (const name of LOOP_SOUNDS) {
      const ch = this.loops[name];
      ch.target = levels[name];
      ch.el.dataset.target = ch.target.toFixed(3);
    }
  }

  /** 单次音效：从头播一次。同一音效只有一个元素，重触发 = 重放，不叠加 */
  fire(name: OneShotSound) {
    const ch = this.shots[name];
    if (!ch.ok || !this.soundOn || this.hidden) return;
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
    for (const ch of [...Object.values(this.loops), ...Object.values(this.shots)]) {
      ch.el.pause();
      ch.el.removeAttribute("src");
      ch.el.load();
    }
    this.root.remove();
    this.ctx?.close().catch(() => {});
  }
}

export function useKitchenAudio() {
  const { soundOn, timeline, beats } = useScene();
  const mixer = useRef<KitchenMixer | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  // 固定的一组 <audio>，整个生命周期只创建一次
  useEffect(() => {
    const m = new KitchenMixer(setAvailable);
    mixer.current = m;
    return () => { m.dispose(); mixer.current = null; };
  }, []);

  useEffect(() => { mixer.current?.setSoundOn(soundOn); }, [soundOn]);

  // 目标音量：完全由节拍表推导
  useEffect(() => { mixer.current?.setLevels(loopLevels(timeline, beats)); }, [timeline, beats]);

  // 单次音效：向下滚动越过节拍表里的触发点时播一次
  const prevT = useRef<Timeline | null>(null);
  useEffect(() => {
    const fired = crossedOneShots(prevT.current, timeline, beats);
    prevT.current = timeline;
    if (!soundOn) return;
    for (const name of fired) mixer.current?.fire(name);
  }, [timeline, soundOn, beats]);

  return { available };
}
