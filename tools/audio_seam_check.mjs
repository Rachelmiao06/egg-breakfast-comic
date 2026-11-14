#!/usr/bin/env node
/**
 * 循环接缝的客观检查（不能代替人耳）。对每个循环文件：解码后把"文件末尾 → 文件开头"的衔接点当作接缝，
 * 报告：接缝两侧相邻采样的跳变（dBFS，越低越好；-40 以下基本无咔哒）、
 *       接缝前后 10 ms / 60 ms 的 RMS 差（dB，电平是否连续）、
 *       整个文件里相邻 10 ms 窗口 RMS 跳变的最大值（作为"文件内部自然起伏"的参照）。
 * 用法：node tools/audio_seam_check.mjs [文件...]（默认四个循环）
 */
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FFMPEG = process.env.FFMPEG ?? join(homedir(), ".local/bin/ffmpeg");
const SR = 44100;
const files = process.argv.slice(2).length ? process.argv.slice(2) : ["sizzle-loop", "room-loop", "chop-loop", "sauce-stir-loop"].map((n) => join(ROOT, "public/assets/audio", n + ".mp3"));

const db = (x) => (x <= 0 ? -Infinity : 20 * Math.log10(x));
const rms = (a, from, to) => { let s = 0; for (let i = from; i < to; i++) s += a[i] * a[i]; return Math.sqrt(s / Math.max(1, to - from)); };

for (const f of files) {
  const buf = execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-i", f, "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"], { maxBuffer: 1 << 30 });
  const a = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const n = a.length;
  const w10 = Math.round(SR * 0.01), w60 = Math.round(SR * 0.06);
  const jump = Math.abs(a[0] - a[n - 1]);
  // 接缝两侧各取 5 个采样的平均斜率跳变，排除单点噪声
  const slopeTail = (a[n - 1] - a[n - 6]) / 5, slopeHead = (a[5] - a[0]) / 5;
  const r10 = db(rms(a, 0, w10)) - db(rms(a, n - w10, n));
  const r60 = db(rms(a, 0, w60)) - db(rms(a, n - w60, n));
  let maxStep = 0, prev = db(rms(a, 0, w10));
  for (let i = w10; i + w10 <= n; i += w10) { const cur = db(rms(a, i, i + w10)); if (isFinite(cur) && isFinite(prev)) maxStep = Math.max(maxStep, Math.abs(cur - prev)); prev = cur; }
  console.log(`${basename(f).padEnd(20)} 时长 ${(n / SR).toFixed(3)} s | 接缝采样跳变 ${db(jump).toFixed(1)} dBFS（斜率差 ${db(Math.abs(slopeHead - slopeTail)).toFixed(1)}）| RMS 差 10ms ${r10.toFixed(1)} dB, 60ms ${r60.toFixed(1)} dB | 文件内相邻 10ms 窗口最大跳变 ${maxStep.toFixed(1)} dB`);
}
