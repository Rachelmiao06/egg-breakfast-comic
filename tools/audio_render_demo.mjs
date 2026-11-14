#!/usr/bin/env node
/**
 * 离线渲染一次"带声音的完整滚动"：按节拍表 + audio-map.json，用和 useKitchenAudio 相同的规则
 * （loopLevels 的进入阶段渐变、fades、单次音效在向下越过 at 时播一次、音量平滑 2.5/s），
 * 以恒定滚动速度把整个故事混成一条音频，并生成一段显示当前场景的 mp4，供人耳检查接缝、响度、切换和结尾。
 *
 * 不是浏览器录屏：用户实际滚动有快有慢，这里是匀速；但音量规则与网页一致，循环点、文件、触发点都相同。
 *
 * 用法：node tools/audio_render_demo.mjs [--beats src/app/preview/visual/beats.visual.json] [--speed 30] [--out /path/dir]
 *   --speed  滚动速度，vh/s（默认 30，2830vh ≈ 94 s）
 * 需要 ffmpeg（默认 ~/.local/bin/ffmpeg，可用 FFMPEG 环境变量指定）。
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FFMPEG = process.env.FFMPEG ?? join(homedir(), ".local/bin/ffmpeg");
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1]] : [])).filter((x) => x.length));
const BEATS_PATH = resolve(ROOT, args.beats ?? "src/app/preview/visual/beats.visual.json");
const SPEED = Number(args.speed ?? 30); // vh/s
const OUT = resolve(args.out ?? join(ROOT, "tools/audio_render_out"));
const SR = 44100, TICK = 0.05, SLEW = 2.5;
const AUDIO_DIR = join(ROOT, "public/assets/audio");

// ---- 与 src/lib/beats.ts / useKitchenAudio.ts 相同的登记表和规则（手工同步；改了那边记得改这里） ----
const PHASES = ["enter", "action", "hold", "exit"];
const LOOP_SOUNDS = ["room", "sizzle", "chop", "stirfry", "sauce", "steps"];
const LOOP_FILES = { room: "room-loop.mp3", sizzle: "sizzle-loop.mp3", chop: "chop-loop.mp3", stirfry: "stirfry-loop.mp3", sauce: "sauce-stir-loop.mp3", steps: "footsteps-loop.mp3" };
const ONESHOTS = { stirfryIn: ["stirfry-in.mp3", 0.6], catch: ["catch.mp3", 0.6], bowlDown: ["bowl-down.mp3", 0.6], pour: ["pour.mp3", 0.5], momCall: ["mom-call.mp3", 0.6], eggCall: ["egg-call.mp3", 0.6], pop: ["pop.mp3", 0.5], eggSmall: ["egg-small.mp3", 0.5] };
const DEFAULT_PHASES = { enter: 0.25, action: 0, hold: 0.6, exit: 0.15 };

const raw = JSON.parse(readFileSync(BEATS_PATH, "utf8"));
const map = JSON.parse(readFileSync(join(ROOT, "src/components/kitchen/audio-map.json"), "utf8")).scenes;
// 触发点（与 useKitchenAudio.resolveAt / beats.ts eventAt 相同）：数字；"@eggOnTable" / "@eggOnSpatula" / "@eggInBowl"
// 共享事件（该段 egg 模式对上时 = 动作阶段结束）；或 enterEnd / actionEnd / holdEnd。都可带 ± 偏移
const EGG_EVENTS = { eggOnTable: "toTable", eggOnSpatula: "flight", eggInBowl: "serve" };
function resolveAt(phases, at, egg) {
  if (typeof at === "number") return at;
  const ev = /^@(\w+)([+-]\d*\.?\d+)?$/.exec(String(at).trim());
  if (ev) {
    if (!EGG_EVENTS[ev[1]] || EGG_EVENTS[ev[1]] !== egg) throw new Error(`事件 ${at} 与本段蛋模式 ${egg} 对不上`);
    return Math.min(1, Math.max(0, phases.enter + phases.action + (ev[2] ? parseFloat(ev[2]) : 0)));
  }
  const m = /^(enterEnd|actionEnd|holdEnd)([+-]\d*\.?\d+)?$/.exec(String(at).trim());
  if (!m) throw new Error(`不认识的触发点 ${at}`);
  const e = phases.enter, a = e + phases.action, h = a + phases.hold;
  const base = m[1] === "enterEnd" ? e : m[1] === "actionEnd" ? a : h;
  return Math.min(1, Math.max(0, base + (m[2] ? parseFloat(m[2]) : 0)));
}
const beats = (raw.beats ?? raw).map((b) => {
  const phases = b.phases ?? DEFAULT_PHASES;
  const audio = map[b.id] ?? b.audio ?? { loops: {}, fades: [], oneshots: [] };
  return { ...b, phases, audio: { ...audio, oneshots: audio.oneshots.map((o) => ({ sound: o.sound, atSpec: o.at, at: resolveAt(phases, o.at, b.egg) })) } };
});
const totalVh = beats.reduce((s, b) => s + b.lengthVh, 0);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
function phaseAt(b, p) {
  const e = b.phases.enter, a = b.phases.action, h = b.phases.hold;
  const edges = [0, e, e + a, e + a + h, 1];
  for (let i = 0; i < 4; i++) { const lo = edges[i], hi = edges[i + 1]; if (p < hi || i === 3) { if (hi - lo <= 0) continue; return { phase: PHASES[i], phaseP: clamp01((p - lo) / (hi - lo)) }; } }
  return { phase: "hold", phaseP: 1 };
}
function locate(vh) {
  let acc = 0;
  for (let i = 0; i < beats.length; i++) { const b = beats[i]; if (vh < acc + b.lengthVh || i === beats.length - 1) { const p = clamp01((vh - acc) / b.lengthVh); return { index: i, beat: b, p, ...phaseAt(b, p) }; } acc += b.lengthVh; }
}
const phaseProgress = (t, phase) => { const o = PHASES.indexOf(phase), c = PHASES.indexOf(t.phase); return c < o ? 0 : c > o ? 1 : t.phaseP; };
function loopLevelInBeat(b, t, s) { const f = b.audio.fades.find((x) => x.sound === s); if (f) return t ? lerp(f.from, f.to, phaseProgress(t, f.phase)) : f.to; return b.audio.loops[s] ?? 0; }
function loopLevels(t) { const prev = t.index > 0 ? beats[t.index - 1] : null; const out = {}; for (const s of LOOP_SOUNDS) { const cur = loopLevelInBeat(t.beat, t, s); out[s] = t.phase === "enter" && prev ? lerp(loopLevelInBeat(prev, null, s), cur, t.phaseP) : cur; } return out; }
function crossedOneShots(prev, cur) { if (!prev) return []; const pos = (t) => t.index + t.p; if (pos(cur) <= pos(prev)) return []; const f = []; for (let i = prev.index; i <= cur.index; i++) for (const o of beats[i].audio.oneshots) { const at = i + o.at; if (at > pos(prev) && at <= pos(cur)) f.push(o.sound); } return f; }

// ---- 解码素材 ----
function decode(file) {
  const p = join(AUDIO_DIR, file);
  if (!existsSync(p)) return null;
  const buf = execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-i", p, "-f", "f32le", "-ac", "2", "-ar", String(SR), "-"], { maxBuffer: 1 << 30 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}
const loopPcm = Object.fromEntries(LOOP_SOUNDS.map((s) => [s, decode(LOOP_FILES[s])]));
const shotPcm = Object.fromEntries(Object.entries(ONESHOTS).map(([s, [f]]) => [s, decode(f)]));

// ---- 模拟匀速滚动，生成电平曲线和单次触发 ----
const duration = totalVh / SPEED;
const nTicks = Math.ceil(duration / TICK);
const levels = Object.fromEntries(LOOP_SOUNDS.map((s) => [s, new Float32Array(nTicks + 1)]));
const fires = []; // { t, sound }
const sceneTimes = []; // { t0, t1, id, title }
let prevT = null; const cur = Object.fromEntries(LOOP_SOUNDS.map((s) => [s, 0]));
for (let k = 0; k <= nTicks; k++) {
  const time = k * TICK; const t = locate(Math.min(totalVh, time * SPEED));
  if (!sceneTimes.length || sceneTimes.at(-1).id !== t.beat.id) { if (sceneTimes.length) sceneTimes.at(-1).t1 = time; sceneTimes.push({ t0: time, t1: duration, id: t.beat.id, n: t.beat.n, title: t.beat.title }); }
  const target = loopLevels(t);
  for (const s of LOOP_SOUNDS) { const d = target[s] - cur[s]; cur[s] += Math.sign(d) * Math.min(Math.abs(d), SLEW * TICK); levels[s][k] = cur[s]; }
  for (const s of crossedOneShots(prevT, t)) fires.push({ t: time, sound: s, has: !!shotPcm[s] });
  prevT = t;
}

// ---- 混音（增益线性插值于两个 tick 之间；循环声按文件长度无缝循环；单次音效单实例） ----
const total = Math.ceil(duration * SR) + SR;
const mix = new Float32Array(total * 2);
for (const s of LOOP_SOUNDS) {
  const pcm = loopPcm[s]; if (!pcm) continue; const len = pcm.length / 2; const lv = levels[s];
  for (let i = 0; i < total; i++) { const k = (i / SR) / TICK; const k0 = Math.min(nTicks - 1, Math.floor(k)); const g = lv[k0] + (lv[k0 + 1] - lv[k0]) * (k - k0); if (g <= 0) continue; const j = (i % len) * 2; mix[i * 2] += pcm[j] * g; mix[i * 2 + 1] += pcm[j + 1] * g; }
}
for (const f of fires) { const pcm = shotPcm[f.sound]; if (!pcm) continue; const g = ONESHOTS[f.sound][1]; const start = Math.floor(f.t * SR); for (let j = 0; j < pcm.length / 2 && start + j < total; j++) { mix[(start + j) * 2] += pcm[j * 2] * g; mix[(start + j) * 2 + 1] += pcm[j * 2 + 1] * g; } }

mkdirSync(OUT, { recursive: true });
const rawPath = join(OUT, "mix.f32"); writeFileSync(rawPath, Buffer.from(mix.buffer));
const wav = join(OUT, "scroll-demo.wav"), mp3 = join(OUT, "scroll-demo.mp3"), mp4 = join(OUT, "scroll-demo.mp4");
execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-f", "f32le", "-ac", "2", "-ar", String(SR), "-i", rawPath, "-c:a", "pcm_s16le", wav]);
execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", wav, "-c:a", "libmp3lame", "-b:a", "192k", mp3]);

// ---- 视频：场景名 + 进度条 + 各循环电平（文字），与音频同步 ----
const font = process.env.DEMO_FONT ?? "/System/Library/Fonts/Hiragino Sans GB.ttc";
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/'/g, "\u2019").replace(/:/g, "\\:").replace(/,/g, "\\,").replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/;/g, "\\;").replace(/%/g, "\\%");
const fontArg = `fontfile='${font.replace(/'/g, "\\'")}'`;
const draws = sceneTimes.map((s) => {
  const loops = Object.entries(beats[s.n].audio.loops).map(([k, v]) => `${k} ${v}`).join("  ");
  const shots = beats[s.n].audio.oneshots.map((o) => `${o.sound}@${typeof o.atSpec === "string" ? `${o.atSpec}=${o.at.toFixed(2)}` : o.at}${shotPcm[o.sound] ? "" : "(空位)"}`).join("  ");
  const head = esc(`${s.n}  ${s.id}`), title = esc(s.title), info = esc(`循环  ${loops}` + (shots ? `    单次  ${shots}` : ""));
  const en = `enable='between(t,${s.t0.toFixed(3)},${s.t1.toFixed(3)})'`;
  return `drawtext=${fontArg}:text='${head}':fontsize=44:fontcolor=white:x=60:y=110:${en},drawtext=${fontArg}:text='${title}':fontsize=34:fontcolor=white:x=60:y=180:${en},drawtext=${fontArg}:text='${info}':fontsize=22:fontcolor=0xDDDDDD:x=60:y=250:${en}`;
}).join(",");
const fired = fires.filter((f) => f.has).map((f) => `drawtext=${fontArg}:text='${esc("♪ " + f.sound)}':fontsize=30:fontcolor=0xFFD27A:x=60:y=320:enable='between(t,${f.t.toFixed(3)},${(f.t + 1.2).toFixed(3)})'`).join(",");
const bar = `drawbox=x=60:y=400:w='(1160*t/${duration.toFixed(3)})':h=10:color=0xFFD27A@0.9:t=fill,drawtext=${fontArg}:text='%{pts\\:hms}':fontsize=22:fontcolor=0xAAAAAA:x=60:y=425`;
const vf = `${draws},${fired ? fired + "," : ""}${bar}`;
execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `color=c=0x2b2420:s=1280x480:r=30:d=${duration.toFixed(3)}`, "-i", wav, "-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-c:a", "aac", "-b:a", "192k", "-shortest", mp4]);

// ---- 报告 ----
const stats = spawnSync(FFMPEG, ["-hide_banner", "-nostats", "-i", wav, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" }).stderr.split("Summary").pop();
// 相邻 100 ms 瞬时响度（M）的跳变：最大值及最大的几处（带所在场景），用来看段落切换处有没有电平突跳
const mSeries = spawnSync(FFMPEG, ["-hide_banner", "-nostats", "-i", wav, "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8" }).stderr
  .split("\n").map((l) => l.match(/t:\s*([0-9.]+).*?M:\s*(-?[0-9.]+)/)).filter(Boolean).map((m) => ({ t: +m[1], M: +m[2] })).filter((x) => x.M > -60);
const steps = [];
for (let i = 1; i < mSeries.length; i++) { const d = mSeries[i].M - mSeries[i - 1].M; const sc = sceneTimes.find((s) => mSeries[i].t >= s.t0 && mSeries[i].t < s.t1); steps.push({ t: mSeries[i].t, dM: +d.toFixed(1), scene: sc?.id }); }
const transitions = sceneTimes.slice(1).map((s) => { const near = steps.filter((x) => Math.abs(x.t - s.t0) <= 0.6); const worst = near.reduce((a, b) => (Math.abs(b.dM) > Math.abs(a.dM) ? b : a), { dM: 0 }); return { into: s.id, at: +s.t0.toFixed(1), maxStepDb: worst.dM }; });
const biggest = [...steps].sort((a, b) => Math.abs(b.dM) - Math.abs(a.dM)).slice(0, 6);
const report = {
  momentaryStep100ms: { maxAbsDb: biggest[0]?.dM ?? 0, biggest, atTransitions: transitions },
  beats: BEATS_PATH.replace(ROOT + "/", ""), speedVhPerS: SPEED, totalVh, durationS: +duration.toFixed(1),
  scenes: sceneTimes.map((s) => ({ n: s.n, id: s.id, from: +s.t0.toFixed(1), to: +s.t1.toFixed(1), loops: beats[s.n].audio.loops })),
  oneshots: fires.map((f) => ({ t: +f.t.toFixed(2), sound: f.sound, played: f.has })),
  missingLoops: LOOP_SOUNDS.filter((s) => !loopPcm[s]),
  mixLoudness: stats.trim().split("\n").map((l) => l.trim()).filter((l) => /^(I|LRA|Peak):/.test(l)),
  outputs: { wav, mp3, mp4 },
};
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
