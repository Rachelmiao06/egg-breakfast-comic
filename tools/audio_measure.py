"""客观测量 public/assets/audio/ 里的成品（不能代替人耳试听）。

    python3 -I tools/audio_measure.py [文件...]      # 默认测量全部 *.mp3 和 alt/*.mp3

每个文件：时长、积分响度 I（LUFS）、响度范围 LRA、真峰值 TP（dBTP）、底噪（50 ms RMS 的 10% 分位，dBFS）。
循环声（文件名含 -loop）另外测接缝：
  - wrap_jump：首尾采样差 / 正文相邻采样差的 99.9% 分位。≤ 1 说明接缝处的跳变不比正文里任何一处大。
  - click：接缝 ±32 采样内二阶差分最大值 / 正文二阶差分 99.9% 分位。≤ 1.5 视为无咔哒。
  - step_db：最后 100 ms 与最前 100 ms 的 RMS 差。|值| ≤ 3 dB 视为无电平跳变。
  - prime_ms：不做 gapless 修剪时（-flags2 +skip_manual）开头近零采样的时长 = 不认 LAME 头的解码器会多出的空隙，
    useKitchenAudio 会在解码后裁掉首尾近零采样。
"""
from __future__ import annotations

import glob
import os
import re
import shutil
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, "public", "assets", "audio")
FFMPEG = shutil.which("ffmpeg") or os.path.expanduser("~/.local/bin/ffmpeg")
SR = 44100


def decode(path: str, gapless=True) -> np.ndarray:
    pre = [] if gapless else ["-flags2", "+skip_manual"]
    raw = subprocess.run([FFMPEG, "-v", "error", *pre, "-i", path, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2)


def loud(path: str) -> dict:
    err = subprocess.run([FFMPEG, "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, check=True).stderr.decode()
    s = err[err.rfind("Summary:"):]
    g = lambda k: float(re.search(rf"{k}:\s+(-?[\d.]+)", s).group(1))
    return {"I": g("I"), "LRA": g("LRA"), "TP": g("Peak")}


def measure(path: str) -> dict:
    x = decode(path)
    m = {"file": os.path.relpath(path, AUDIO), "dur": round(len(x) / SR, 2), **loud(path)}
    w = int(0.05 * SR)
    rms = np.sqrt(np.mean(x[: len(x) // w * w].reshape(-1, w, 2) ** 2, axis=(1, 2)) + 1e-12)
    m["floor"] = round(float(20 * np.log10(np.percentile(rms, 10))), 1)
    if "-loop" in os.path.basename(path):
        d1 = np.abs(np.diff(x, axis=0))
        m["wrap_jump"] = round(float(np.max(np.abs(x[0] - x[-1])) / np.percentile(d1, 99.9)), 2)
        k = 64
        ring = np.concatenate([x[-k:], x[:k]])
        d2 = np.abs(np.diff(ring, n=2, axis=0))
        body = np.abs(np.diff(x, n=2, axis=0))
        m["click"] = round(float(d2[k - 32:k + 32].max() / np.percentile(body, 99.9)), 2)
        t = int(0.1 * SR)
        r = lambda s: 20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-12)
        m["step_db"] = round(float(r(x[-t:]) - r(x[:t])), 1)
        raw = decode(path, gapless=False)
        lead = int(np.argmax(np.max(np.abs(raw), axis=1) > 1e-4))
        m["prime_ms"] = round(lead / SR * 1000, 1)
    return m


def main() -> None:
    files = sys.argv[1:] or sorted(glob.glob(os.path.join(AUDIO, "*.mp3")) + glob.glob(os.path.join(AUDIO, "alt", "*.mp3")))
    cols = ["file", "dur", "I", "LRA", "TP", "floor", "wrap_jump", "click", "step_db", "prime_ms"]
    print("| " + " | ".join(cols) + " |")
    print("|" + "---|" * len(cols))
    for f in files:
        m = measure(f)
        print("| " + " | ".join(str(m.get(c, "—")) for c in cols) + " |")


if __name__ == "__main__":
    main()
