"""把原始录音处理成 public/assets/audio/ 里的成品（可重复运行）。

    python3 -I tools/audio_build.py <下载目录> [--only sizzle-loop,...]

下载目录由 tools/audio_fetch.sh 生成（文件名 = audio_sources.json 的键）。
每个成品的处理顺序：
  1. 截取源片段，高通去掉低频隆隆声（可选低通让声音更柔；个别很轻的源先轻度降噪 afftdn）。
  2. 按目标响度算增益，接一个前视限幅器（-2 dBFS），先做电平、后做接缝，接缝处不会被限幅器破坏。
  3. 循环声：等功率交叉淡化接缝 —— 输出第 i 个采样 (i < X) = 源[a+i]·sin + 源[b+i]·cos，其余 = 源[a+i]；
     于是成品最后一个采样 = 源[b-1]，第一个采样 ≈ 源[b]，首尾在源录音里本来就相邻。
     冲击类声音（切菜、勺碰碗）把接缝点放在两次敲击之间最安静的地方，只用很短的交叉淡化。
  4. 单次音效：截取、5 ms 淡入、尾部淡出。
  5. 编码 mp3（libmp3lame VBR），实测响度偏离目标 > 0.5 LU 就修正增益重做。
数值只用 numpy 和 ffmpeg，不合成任何声音。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "assets", "audio")
FFMPEG = shutil.which("ffmpeg") or os.path.expanduser("~/.local/bin/ffmpeg")
SR = 44100
TARGET_LUFS = -18.0
LIMIT = 0.71  # -3 dBFS，给 mp3 编码留出真峰值余量

# a / n / x 单位秒。search>0 表示在 ±search 内把接缝点挪到最安静处（冲击类声音）。
RECIPES: list[dict] = [
    # --- 循环 ---
    dict(out="sizzle-loop.mp3", src="fs-543801", kind="loop", a=1.5, n=14.0, x=1.5, hp=90),
    dict(out="room-loop.mp3", src="fs-455826", kind="loop", a=8.0, n=20.0, x=2.5, hp=60, mono=True),
    dict(out="chop-loop.mp3", src="fs-459398", kind="loop", a=5.2, n=9.4, x=0.04, search=0.35, hp=120),
    dict(out="stirfry-loop.mp3", src="fs-679946", kind="loop", a=2.5, n=18.0, x=0.8, search=1.0, hp=90, limit=0.56),
    dict(out="sauce-stir-loop.mp3", src="fs-554557", kind="loop", a=2.3, n=27.0, x=0.04, search=0.3, hp=150, mono=True,
         pre=["afftdn=nr=10:nf=-62:tn=1"]),  # 源录音很轻，增益 +37 dB 会抬起底噪，先轻度降噪
    # --- 单次 ---
    dict(out="stirfry-in.mp3", src="fs-417995", kind="oneshot", a=1.45, n=1.9, fade_out=0.7, hp=90),
    dict(out="catch.mp3", src="fs-546452", kind="oneshot", a=2.62, n=0.6, fade_out=0.35, hp=120, lp=5000),
    dict(out="bowl-down.mp3", src="mk-1799", kind="oneshot", a=0.03, n=0.85, fade_out=0.3, hp=60),
    # --- 备选（不被代码加载，给人耳 A/B 用；试听地址见 README） ---
    dict(out="alt/sizzle-loop-fish.mp3", src="mk-123", kind="loop", a=2.0, n=14.0, x=1.5, hp=90),
    dict(out="alt/room-loop-roomtone.mp3", src="fs-205165", kind="loop", a=5.0, n=20.0, x=2.5, hp=60, mono=True),
    dict(out="alt/chop-loop-table.mp3", src="mk-134", kind="loop", a=0.1, n=4.5, x=0.03, search=0.15, hp=120, limit=0.56),
    dict(out="alt/stirfry-loop-onions.mp3", src="fs-741620", kind="loop", a=1.0, n=16.0, x=1.5, hp=90),
    dict(out="alt/sauce-stir-loop-plate.mp3", src="mk-2835", kind="loop", a=0.05, n=2.95, x=0.03, search=0.1, hp=150),
    dict(out="alt/catch-egg-plop.mp3", src="fs-119083", kind="oneshot", a=0.85, n=0.8, fade_out=0.4, hp=120),
    dict(out="alt/bowl-down-2.mp3", src="mk-2934", kind="oneshot", a=0.0, n=0.9, fade_out=0.3, hp=60),
]


def ff(*args: str, capture=True) -> subprocess.CompletedProcess:
    return subprocess.run([FFMPEG, "-hide_banner", "-nostats", *args], capture_output=capture, check=True)


def load(path: str, mono=False, af: str | None = None) -> np.ndarray:
    filt = ["-af", af] if af else []
    ch = "1" if mono else "2"
    raw = ff("-v", "error", "-i", path, *filt, "-ac", ch, "-ar", str(SR), "-f", "f32le", "-").stdout
    return np.frombuffer(raw, np.float32).reshape(-1, int(ch)).copy()


def write_wav(path: str, x: np.ndarray) -> None:
    ch = x.shape[1]
    subprocess.run([FFMPEG, "-hide_banner", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", str(ch),
                    "-i", "-", "-c:a", "pcm_f32le", path], input=x.astype(np.float32).tobytes(), check=True)


def loudness(path: str) -> dict:
    err = ff("-i", path, "-af", "ebur128=peak=true", "-f", "null", "-").stderr.decode()
    summ = err[err.rfind("Summary:"):]
    get = lambda k: float(re.search(rf"{k}:\s+(-?[\d.]+|-inf)", summ).group(1).replace("-inf", "-120"))
    return {"I": get("I"), "LRA": get("LRA"), "TP": get("Peak")}


def env_db(x: np.ndarray, win=0.02) -> np.ndarray:
    m = x.mean(axis=1)
    w = int(SR * win)
    pad = np.pad(m ** 2, (w // 2, w - w // 2 - 1), mode="edge")
    c = np.convolve(pad, np.ones(w) / w, mode="valid")
    return 10 * np.log10(c + 1e-12)


def pick_quiet(env: np.ndarray, t: float, search: float) -> int:
    lo, hi = max(0, int((t - search) * SR)), min(len(env) - 1, int((t + search) * SR))
    return lo + int(np.argmin(env[lo:hi]))


def make_loop(x: np.ndarray, r: dict) -> tuple[np.ndarray, dict]:
    a, b, X = int(r["a"] * SR), int((r["a"] + r["n"]) * SR), int(r["x"] * SR)
    if r.get("search"):
        env = env_db(x)
        a = pick_quiet(env, r["a"], r["search"])
        b = pick_quiet(env, r["a"] + r["n"], r["search"])
    if b + X > len(x):
        raise SystemExit(f"{r['out']}: 源录音不够长（需要到 {(b + X) / SR:.2f}s）")
    t = (np.arange(X) + 0.5) / X
    fin, fout = np.sin(t * np.pi / 2)[:, None], np.cos(t * np.pi / 2)[:, None]
    y = x[a:b].copy()
    y[:X] = x[a:a + X] * fin + x[b:b + X] * fout
    return y, {"a": a / SR, "b": b / SR, "xfade": X / SR}


def make_oneshot(x: np.ndarray, r: dict) -> tuple[np.ndarray, dict]:
    a, n = int(r["a"] * SR), int(r["n"] * SR)
    y = x[a:a + n].copy()
    fi = int(0.005 * SR)
    y[:fi] *= np.linspace(0, 1, fi)[:, None]
    fo = int(r["fade_out"] * SR)
    y[-fo:] *= (np.cos(np.linspace(0, np.pi / 2, fo)) ** 2)[:, None]
    return y, {"a": a / SR, "len": n / SR}


def build(r: dict, src_dir: str, tmp: str) -> dict:
    src = next(os.path.join(src_dir, f) for f in os.listdir(src_dir) if f.rsplit(".", 1)[0] == r["src"])
    pre = r.get("pre", []) + [f"highpass=f={r['hp']}:p=2"] + ([f"lowpass=f={r['lp']}"] if r.get("lp") else [])
    out = os.path.join(OUT, r["out"])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    seg_end = r["a"] + r["n"] + r.get("x", 0) + r.get("search", 0) + 0.2
    # 先测源片段响度，算出初始增益
    probe = os.path.join(tmp, "probe.wav")
    raw = load(src, r.get("mono", False), ",".join(pre))
    write_wav(probe, raw[int(r["a"] * SR):int(seg_end * SR)])
    gain = TARGET_LUFS - loudness(probe)["I"]
    for _ in range(4):
        chain = ",".join(pre + [f"volume={gain:.2f}dB",
                                f"alimiter=limit={r.get('limit', LIMIT)}:attack=4:release=60:level=false:latency=true"])
        x = load(src, r.get("mono", False), chain)
        y, info = (make_loop if r["kind"] == "loop" else make_oneshot)(x, r)
        wav = os.path.join(tmp, "y.wav")
        write_wav(wav, y)
        ff("-v", "error", "-y", "-i", wav, "-c:a", "libmp3lame", "-q:a", "3", "-ar", str(SR), out)
        m = loudness(out)
        if abs(m["I"] - TARGET_LUFS) <= 0.5:
            break
        gain += TARGET_LUFS - m["I"]
    return {"file": r["out"], "src": r["src"], "gain_db": round(gain, 1), **info, **m}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src_dir")
    ap.add_argument("--only", default="")
    args = ap.parse_args()
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    results = []
    with tempfile.TemporaryDirectory() as tmp:
        for r in RECIPES:
            name = os.path.basename(r["out"]).rsplit(".", 1)[0]
            if only and name not in only and r["out"] not in only:
                continue
            res = build(r, args.src_dir, tmp)
            results.append(res)
            print(json.dumps(res, ensure_ascii=False))
    log = os.path.join(ROOT, "tools", "audio_build.log.json")
    prev = {}
    if os.path.exists(log):
        prev = {d["file"]: d for d in json.load(open(log))}
    prev.update({d["file"]: d for d in results})
    json.dump(sorted(prev.values(), key=lambda d: d["file"]), open(log, "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    sys.exit(main())
