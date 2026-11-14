"use client";
/**
 * 厨房声音导演。素材库录音，不合成。**不自己定节奏**：所有音量和触发点来自统一节拍表
 * （src/lib/beats.json，见 docs/BEATS.md），按 useScene().timeline 计算。
 * - 循环声：每段 audio.loops 的稳定音量；进入阶段从上一段渐变过来；audio.fades 在指定阶段内渐变。
 *   计算出的目标音量再经过一个很短的平滑（防止拖动滚动条时爆音）。
 * - 单次音效：向下滚动越过 audio.oneshots.at 时播一次；回滚不播。
 * - 文件还没提供（404 / 解码失败）就保持静音；available 表示至少有一条能播。
 * - 浏览器拦截自动播放时，等下一次用户点击再试，不弹窗。
 */
import { useEffect, useRef, useState } from "react";
import { crossedOneShots, loopLevels, type LoopSound, type Timeline } from "@/lib/beats";
import { useScene } from "@/lib/scene-context";

const DIR = "/assets/audio/";
/** 循环声文件。音量由节拍表 audio.loops 决定，这里的 volume 只是参考上限 */
const LOOPS = {
  room: { file: "room-loop.mp3", volume: 0.25 },
  sizzle: { file: "sizzle-loop.mp3", volume: 0.55 },
  chop: { file: "chop-loop.mp3", volume: 0.5 },
  stirfry: { file: "stirfry-loop.mp3", volume: 0.5 },
  sauce: { file: "sauce-stir-loop.mp3", volume: 0.4 },
} as const;
const ONESHOTS = {
  stirfryIn: { file: "stirfry-in.mp3", volume: 0.6 },
  catch: { file: "catch.mp3", volume: 0.6 },
  bowlDown: { file: "bowl-down.mp3", volume: 0.6 },
  pour: { file: "pour.mp3", volume: 0.5 },
} as const;
type LoopName = LoopSound;

/** 平滑速度：音量每秒最多变化这么多（满量程），只用于去掉跳变，节奏由节拍表决定 */
const SLEW_PER_SEC = 2.5;

export function useKitchenAudio() {
  const { soundOn, timeline, beats } = useScene();
  const loops = useRef<Partial<Record<LoopName, HTMLAudioElement>>>({});
  const ok = useRef<Set<string>>(new Set());
  const targets = useRef<Partial<Record<LoopName, number>>>({});
  const unlocked = useRef(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  // 预载循环和单次音效，记录哪些文件真的存在
  useEffect(() => {
    const all = [...Object.values(LOOPS), ...Object.values(ONESHOTS)].map((v) => v.file);
    let settled = 0;
    const done = () => {
      settled += 1;
      if (settled === all.length) setAvailable(ok.current.size > 0);
    };
    const probes: HTMLAudioElement[] = [];
    for (const [name, { file }] of Object.entries(LOOPS) as [LoopName, { file: string }][]) {
      const a = new Audio();
      a.loop = true;
      a.preload = "auto";
      a.volume = 0;
      a.addEventListener("canplaythrough", () => { ok.current.add(file); done(); }, { once: true });
      a.addEventListener("error", done, { once: true });
      a.src = DIR + file;
      loops.current[name] = a;
    }
    for (const { file } of Object.values(ONESHOTS)) {
      const a = new Audio();
      a.preload = "auto";
      a.addEventListener("canplaythrough", () => { ok.current.add(file); done(); }, { once: true });
      a.addEventListener("error", done, { once: true });
      a.src = DIR + file;
      probes.push(a);
    }
    const loopEls = loops.current;
    return () => {
      Object.values(loopEls).forEach((a) => { a?.pause(); if (a) a.src = ""; });
      probes.forEach((a) => { a.src = ""; });
    };
  }, []);

  // 目标音量：完全由节拍表推导
  useEffect(() => {
    const levels = loopLevels(timeline, beats);
    for (const name of Object.keys(LOOPS) as LoopName[]) {
      targets.current[name] = soundOn ? levels[name] : 0;
    }
  }, [soundOn, timeline, beats]);

  // 统一的淡入淡出循环；目标为 0 且音量到 0 时暂停
  useEffect(() => {
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const step = ((now - last) / 1000) * SLEW_PER_SEC;
      last = now;
      for (const name of Object.keys(LOOPS) as LoopName[]) {
        const a = loops.current[name];
        if (!a || !ok.current.has(LOOPS[name].file)) continue;
        const target = targets.current[name] ?? 0;
        if (target > 0 && a.paused) {
          a.play().then(() => { unlocked.current = true; }).catch(() => {});
        }
        const v = a.volume + Math.sign(target - a.volume) * Math.min(Math.abs(target - a.volume), step);
        a.volume = Math.min(1, Math.max(0, v));
        if (target === 0 && a.volume === 0 && !a.paused) a.pause();
      }
    }, 50);
    // 自动播放被拦截时，下一次点击重新触发
    const kick = () => {
      if (unlocked.current) return;
      for (const name of Object.keys(LOOPS) as LoopName[]) {
        const a = loops.current[name];
        if (a && (targets.current[name] ?? 0) > 0 && ok.current.has(LOOPS[name].file)) a.play().catch(() => {});
      }
    };
    window.addEventListener("pointerdown", kick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("pointerdown", kick);
    };
  }, []);

  // 单次音效：向下滚动越过节拍表里的触发点时播一次
  const prevT = useRef<Timeline | null>(null);
  useEffect(() => {
    const fired = crossedOneShots(prevT.current, timeline, beats);
    prevT.current = timeline;
    if (!soundOn) return;
    for (const name of fired) {
      const { file, volume } = ONESHOTS[name];
      if (!ok.current.has(file)) continue;
      const a = new Audio(DIR + file);
      a.volume = volume;
      a.play().catch(() => {});
    }
  }, [timeline, soundOn, beats]);

  return { available };
}
