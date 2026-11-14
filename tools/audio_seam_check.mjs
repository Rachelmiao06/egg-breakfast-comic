#!/usr/bin/env node
/**
 * 循环接缝的客观检查（不能代替人耳）。对每个循环文件解码（ffmpeg 会按 LAME 信息去掉编码延迟），把"文件末尾 → 文件开头"当作回绕点：
 *  - 回绕采样跳变：|首采样 - 尾采样|（所有声道取最大），与文件内相邻采样跳变的中位数和 99 分位比较；
 *    验收：≤ 2 × 中位数，或至少不超过 99 分位（宽带噪声类素材相邻采样本来就跳得厉害）。
 *  - 1 ms 分辨率的首尾各 20 ms 电平（dB，相对满量程），与整段中位 1 ms 电平比较：
 *    验收：首尾 20 ms 内没有低于中位 10 dB 以上、连续 ≥ 2 ms 的凹陷（2026-11-14 前 room 开头有 4 ms 约 -53 dB 的数字静音）。
 *  - 跨回绕的 1 ms 电平跳变：尾 1 ms → 首 1 ms，与文件内相邻 1 ms 跳变的 99 分位比较。
 * 用法：node tools/audio_seam_check.mjs [文件...]（默认四个循环）
 */
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FFMPEG = process.env.FFMPEG ?? join(homedir(), ".local/bin/ffmpeg");
const SR = 44100, CH = 2, W = 44; // 1 ms ≈ 44 采样
const files = process.argv.slice(2).length ? process.argv.slice(2) : ["sizzle-loop", "room-loop", "chop-loop", "sauce-stir-loop"].map((n) => join(ROOT, "public/assets/audio", n + ".mp3"));
const db = (x) => (x <= 1e-6 ? -120 : 20 * Math.log10(x));
const pct = (arr, q) => { const s = Float64Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };

let fail = 0;
for (const f of files) {
  const buf = execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-i", f, "-f", "f32le", "-ac", String(CH), "-ar", String(SR), "-"], { maxBuffer: 1 << 30 });
  const a = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const n = a.length / CH;
  const x = (i, c) => a[(((i % n) + n) % n) * CH + c];
  // 相邻采样跳变分布
  const steps = []; for (let i = 1; i < n; i += 3) { let m = 0; for (let c = 0; c < CH; c++) m = Math.max(m, Math.abs(x(i, c) - x(i - 1, c))); steps.push(m); }
  let jump = 0; for (let c = 0; c < CH; c++) jump = Math.max(jump, Math.abs(x(0, c) - x(n - 1, c)));
  const med = pct(steps, 0.5), p99 = pct(steps, 0.99);
  // 1 ms 电平
  const ms = (i0) => { let s = 0; for (let i = i0; i < i0 + W; i++) for (let c = 0; c < CH; c++) s += x(i, c) ** 2; return db(Math.sqrt(s / (W * CH))); };
  const all = []; for (let i = 0; i + W <= n; i += W) all.push(ms(i));
  const medMs = pct(all, 0.5);
  const dms = []; for (let k = 1; k < all.length; k++) dms.push(Math.abs(all[k] - all[k - 1]));
  const p99ms = pct(dms, 0.99);
  const head = [], tail = []; for (let k = 0; k < 20; k++) { head.push(ms(k * W)); tail.push(ms(n - (20 - k) * W)); }
  const dipRun = (arr) => { let run = 0, best = 0; for (const v of arr) { run = v < medMs - 10 ? run + 1 : 0; best = Math.max(best, run); } return best; };
  const wrapMs = Math.abs(head[0] - tail[19]);
  const okJump = jump <= 2 * med || jump <= p99, okDip = dipRun(head) < 2 && dipRun(tail) < 2;
  if (!okJump || !okDip) fail++;
  console.log(`${basename(f)}  ${(n / SR).toFixed(4)} s  ${okJump && okDip ? "通过" : "**不通过**"}
  回绕采样跳变 ${jump.toFixed(4)} = 中位 ${(jump / med).toFixed(1)}×（中位 ${med.toFixed(4)}，99 分位 ${p99.toFixed(4)}）
  1 ms 电平中位 ${medMs.toFixed(1)} dB；首尾低于中位 10 dB 的最长连续：首 ${dipRun(head)} ms / 尾 ${dipRun(tail)} ms；回绕处 1 ms 电平跳变 ${wrapMs.toFixed(1)} dB（文件内 99 分位 ${p99ms.toFixed(1)} dB）
  首 20 ms: ${head.map((v) => v.toFixed(0)).join(" ")}
  尾 20 ms: ${tail.map((v) => v.toFixed(0)).join(" ")}`);
}
process.exit(fail ? 1 : 0);
