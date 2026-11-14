#!/usr/bin/env node
/**
 * 为循环接缝挑一个"安静"的旋转点：在 [t-w, t+w] 秒内找相邻两采样（所有声道）幅度和斜率都最小的位置，
 * 让回绕处的波形跳变落在接近零交叉的地方。打印秒数（6 位小数），供 tools/audio_build.sh 的 loop_seam 用。
 * 用法：node tools/audio_pick_cut.mjs <wav> <t> [w=0.1]   （wav 应已是 44.1 kHz）
 */
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
const FFMPEG = process.env.FFMPEG ?? join(homedir(), ".local/bin/ffmpeg");
const [file, tArg, wArg] = process.argv.slice(2);
const SR = 44100, CH = 2, t = parseFloat(tArg), w = parseFloat(wArg ?? "0.1");
const buf = execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-i", file, "-f", "f32le", "-ac", String(CH), "-ar", String(SR), "-"], { maxBuffer: 1 << 30 });
const a = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
let best = -1, bestScore = Infinity;
for (let i = Math.max(1, Math.round((t - w) * SR)); i <= Math.round((t + w) * SR); i++) {
  let s = 0;
  for (let c = 0; c < CH; c++) { const x0 = a[(i - 1) * CH + c], x1 = a[i * CH + c]; s += Math.abs(x0) + Math.abs(x1) + 2 * Math.abs(x1 - x0); }
  if (s < bestScore) { bestScore = s; best = i; }
}
console.log((best / SR).toFixed(6));
