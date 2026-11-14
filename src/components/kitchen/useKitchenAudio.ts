"use client";
/**
 * 厨房声音导演（docs/DESIGN.md §7）。素材库录音，不合成。
 * - 环境声 room-loop：打开声音后一直连续。
 * - 局部循环：按 activePanel 选一条，0.6 s 交叉淡化（切菜哒哒 / 翻炒 / 搅汁 / 煎蛋滋滋）。
 * - 单次音效：进入炒菜段"下锅滋啦"；flight 到 1"接蛋轻响"；serve 到 1"饭碗落桌"；进入结尾"淋汁"。
 *   回滚不重播，除非重新越过触发点。
 * - 文件还没提供（404 / 解码失败）就保持静音；available 表示至少有一条能播。
 * - 浏览器拦截自动播放时，等下一次用户点击再试，不弹窗。
 */
import { useEffect, useRef, useState } from "react";
import { useScene } from "@/lib/scene-context";

const DIR = "/assets/audio/";
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
type LoopName = keyof typeof LOOPS;
type ShotName = keyof typeof ONESHOTS;

/** 每个节拍的局部循环 */
function localLoopFor(panel: number): LoopName | null {
  if (panel === 1) return "chop";
  if (panel === 2) return "stirfry";
  if (panel === 3) return "sauce";
  if (panel === 0 || (panel >= 4 && panel <= 6)) return "sizzle";
  return null; // 7、8：只留环境声和单次音效
}

const FADE_PER_SEC = 1 / 0.6;

export function useKitchenAudio() {
  const { soundOn, activePanel, flight, serve } = useScene();
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

  // 目标音量：环境声 + 当前节拍的局部循环
  useEffect(() => {
    const local = localLoopFor(activePanel);
    for (const name of Object.keys(LOOPS) as LoopName[]) {
      const on = soundOn && (name === "room" || name === local);
      targets.current[name] = on ? LOOPS[name].volume : 0;
    }
  }, [soundOn, activePanel]);

  // 统一的淡入淡出循环；目标为 0 且音量到 0 时暂停
  useEffect(() => {
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const step = ((now - last) / 1000) * FADE_PER_SEC;
      last = now;
      for (const name of Object.keys(LOOPS) as LoopName[]) {
        const a = loops.current[name];
        if (!a || !ok.current.has(LOOPS[name].file)) continue;
        const target = targets.current[name] ?? 0;
        if (target > 0 && a.paused) {
          a.play().then(() => { unlocked.current = true; }).catch(() => {});
        }
        const v = a.volume + Math.sign(target - a.volume) * Math.min(Math.abs(target - a.volume), step * LOOPS[name].volume);
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

  // 单次音效：越过触发点时播一次
  const prev = useRef({ panel: activePanel, flight, serve });
  useEffect(() => {
    const play = (name: ShotName) => {
      const { file, volume } = ONESHOTS[name];
      if (!soundOn || !ok.current.has(file)) return;
      const a = new Audio(DIR + file);
      a.volume = volume;
      a.play().catch(() => {});
    };
    const p = prev.current;
    if (activePanel === 2 && p.panel < 2) play("stirfryIn");
    if (activePanel === 8 && p.panel < 8) play("pour");
    if ((flight ?? 0) >= 1 && (p.flight ?? 0) < 1) play("catch");
    if ((serve ?? 0) >= 1 && (p.serve ?? 0) < 1) play("bowlDown");
    prev.current = { panel: activePanel, flight, serve };
  }, [activePanel, flight, serve, soundOn]);

  return { available };
}
