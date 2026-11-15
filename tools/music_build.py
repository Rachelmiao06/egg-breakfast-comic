#!/usr/bin/env python3
"""
荷包蛋的早餐：原创配乐渲染器（纯 numpy / scipy 合成，没有任何第三方采样，没有版权问题）。
输出到 public/assets/audio/music/：

  8 条循环 stem（同一速度、同一长度 = 8 小节，可以任意叠加而永远对拍）：
    home-pad / home-pluck / home-bass / home-melody / home-sparkle / tender / curious / empty
  若干短的"音乐事件"（stinger）：idea-ding、missing-q、catch-chord、handoff-bell、yolk-cascade、
    mom-call、egg-small、egg-call、punch-dum、end-hold、egg-bloop

配器就是角色：
  妈妈 = 手指弹的尼龙弦吉他 / 尤克里里 + 卡林巴（暖、软、有人味，主题旋律 = 卡林巴）
  蛋   = 马林巴 + 钟琴（脆、亮、会蹦，三音上行的小动机 = "蛋的跳"）
  厨房 = 低音拨弦 + 持续垫音（家的底）
  空   = 小调垫音 + 很稀的钟声，混响很长（妈妈走了、房间空了）
  疑   = 挂留和弦 + 蹑手蹑脚的短音（"是不是还少点什么"、蛋准备起跳）

循环接缝：每条 stem 的编排重复 3 圈，混响在 3 圈上做完，取中间一圈，所以混响尾巴自然回绕，首尾无缝。
用法：python3 tools/music_build.py [名字…]   （不给名字 = 全部）
需要 ffmpeg（默认 ~/.local/bin/ffmpeg，可用 FFMPEG 环境变量指定）。
"""
import os, subprocess, sys, tempfile, wave
import numpy as np
from scipy import signal

SR = 44100
BPM = 96
BEAT = 60.0 / BPM          # 0.625 s
BAR = 4 * BEAT             # 2.5 s
LOOP_BARS = 8
LOOP = LOOP_BARS * BAR     # 20.0 s 整
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "public/assets/audio/music")
FFMPEG = os.environ.get("FFMPEG", os.path.expanduser("~/.local/bin/ffmpeg"))
RNG = np.random.default_rng(20261115)


# ---------------------------------------------------------------- 基础
def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def tt(d):
    return np.arange(int(d * SR)) / SR


def lowpass(x, f, order=2):
    return signal.sosfilt(signal.butter(order, min(f, SR * 0.45) / (SR / 2), "low", output="sos"), x)


def highpass(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f / (SR / 2), "high", output="sos"), x)


def partials(f, t, parts, nyq=15000):
    y = np.zeros_like(t)
    for ratio, amp, tau in parts:
        if f * ratio > nyq:
            continue
        y += amp * np.sin(2 * np.pi * f * ratio * t + RNG.uniform(0, 2 * np.pi)) * np.exp(-t / tau)
    return y


def attack(y, t, a=0.0015):
    return y * (1 - np.exp(-t / a))


# ---------------------------------------------------------------- 乐器
def kalimba(m, vel=1.0, dur=2.2):
    f = hz(m); t = tt(dur)
    y = partials(f, t, [(1.0, 1.0, 1.15), (2.0, 0.14, 0.5), (5.4, 0.22, 0.07), (9.0, 0.06, 0.04)])
    y = attack(y, t)
    click = lowpass(RNG.standard_normal(len(t)) * np.exp(-t / 0.004), 4500)
    return vel * (y + 0.08 * click)


def marimba(m, vel=1.0, dur=1.2):
    f = hz(m); t = tt(dur)
    s = float(np.clip((440 / f) ** 0.4, 0.4, 1.6))
    y = partials(f, t, [(1.0, 1.0, 0.45 * s), (3.93, 0.32, 0.10 * s), (9.2, 0.10, 0.03)])
    y = attack(y, t, 0.001)
    knock = lowpass(RNG.standard_normal(len(t)) * np.exp(-t / 0.003), 2500)
    return vel * (y + 0.10 * knock)


def glock(m, vel=1.0, dur=2.4):
    f = hz(m); t = tt(dur)
    s = float(np.clip((880 / f) ** 0.5, 0.35, 1.5))
    y = partials(f, t, [(1.0, 1.0, 1.4 * s), (2.76, 0.45, 0.7 * s), (5.40, 0.25, 0.4 * s), (8.93, 0.12, 0.25 * s)])
    return vel * attack(y, t, 0.0008) * 0.8


def nylon(m, vel=1.0, dur=2.0):
    """尼龙弦吉他 / 尤克里里：加法合成的拨弦（比 Karplus-Strong 音准准）"""
    f = hz(m); t = tt(dur)
    s = float(np.clip((220 / f) ** 0.3, 0.6, 1.3))
    y = np.zeros_like(t)
    for k in range(1, 12):
        fk = k * f * np.sqrt(1 + 0.00012 * k * k)
        if fk > 9000:
            break
        a = (1.0 / k ** 1.25) * abs(np.sin(k * np.pi * 0.17)) + 0.02
        tau = 1.5 * s / (1 + 0.75 * (k - 1))
        y += a * np.sin(2 * np.pi * fk * t + RNG.uniform(0, 6.28)) * np.exp(-t / tau)
    y = attack(y, t, 0.0012)
    pick = lowpass(RNG.standard_normal(len(t)) * np.exp(-t / 0.005), 5000)
    return vel * 1.3 * (y + 0.05 * pick)


def soft_nylon(m, vel=1.0, dur=1.0):
    """2026-11-15 用户：乐器声太明显、像钢琴。统一用的圆润柔和的指弹：去掉高频、衰减短，听起来是"垫在下面的暖"而不是"一个乐器在弹" """
    y = nylon(m, vel, dur)
    return lowpass(y, 1700, 2) * 0.8


def shaker(vel=1.0, dur=0.12):
    """轻刷沙锤：没有音高，只给律动一点暖的沙沙声"""
    t = tt(dur)
    n = bandpass(RNG.standard_normal(len(t)), 4500, 9000)
    return vel * n * np.exp(-t / 0.03) * (1 - np.exp(-t / 0.006)) * 0.25


def bandpass(x, lo, hi):
    return signal.sosfilt(signal.butter(2, [lo / (SR / 2), hi / (SR / 2)], "band", output="sos"), x)


def pad_note(m, dur, att=0.45, rel=0.9, vel=1.0):
    f = hz(m); t = tt(dur + rel)
    env = (1 - np.exp(-t / (att / 3.0))) * np.where(t < dur, 1.0, np.exp(-(t - dur) / (rel / 3.0)))
    y = np.zeros_like(t)
    for det in (-0.0035, 0.0, 0.0035):
        for k, a in ((1, 1.0), (2, 0.32), (3, 0.14), (4, 0.06)):
            y += a * np.sin(2 * np.pi * f * (1 + det) * k * t + RNG.uniform(0, 6.28))
    return vel * lowpass(y * env, 1300) * 0.33


def bass_pluck(m, vel=1.0, dur=0.9):
    f = hz(m); t = tt(dur)
    y = partials(f, t, [(1.0, 1.0, 0.30), (2.0, 0.62, 0.20), (3.0, 0.32, 0.12), (4.0, 0.12, 0.08)])
    y = attack(y, t, 0.003)
    return vel * lowpass(y, 1300) * 0.9


def glide(m_from, m_to, dur, tau, vel=1.0):
    """向下滑的闷声（笑点的"噗"）"""
    t = tt(dur)
    f = hz(m_from) * (hz(m_to) / hz(m_from)) ** np.clip(t / (dur * 0.7), 0, 1)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = (np.sin(ph) + 0.25 * np.sin(2 * ph)) * np.exp(-t / tau)
    return vel * attack(lowpass(y, 1500), t, 0.004)


# ---------------------------------------------------------------- 和弦
QUAL = {"M": [0, 4, 7], "m": [0, 3, 7], "M7": [0, 4, 7, 11], "m7": [0, 3, 7, 10], "sus4": [0, 5, 7]}
ROOTS = {"C": 48, "D": 50, "E": 52, "F": 53, "G": 55, "A": 57}


def voicing(name, qual, lift=12, top=71):
    v = [ROOTS[name] + lift + i for i in QUAL[qual]]
    while max(v) > top:
        v = [x - 12 for x in v]
    return v


def bass_root(name):
    r = ROOTS[name]
    return r if r <= 48 else r - 12


HOME = [("C", "M"), ("A", "m"), ("F", "M"), ("G", "M"), ("C", "M"), ("E", "m"), ("F", "M"), ("G", "M")]
CUR = [("F", "M7"), ("E", "m7"), ("D", "m7"), ("G", "sus4"), ("F", "M7"), ("E", "m7"), ("D", "m7"), ("G", "sus4")]
EMPTY = [("A", "m"), ("A", "m"), ("F", "M"), ("F", "M"), ("D", "m"), ("D", "m"), ("E", "sus4"), ("E", "sus4")]


def T(bar, beat=1.0):
    return bar * BAR + (beat - 1.0) * BEAT


# ---------------------------------------------------------------- 轨道（3 圈）
class Track:
    def __init__(self, cycles=3, tail=4.0):
        self.cycles = cycles
        n = int((cycles * LOOP + tail) * SR)
        self.L = np.zeros(n); self.R = np.zeros(n)

    def add(self, sig, t, pan=0.0, gain=1.0):
        l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
        for k in range(self.cycles):
            i = int((t + k * LOOP) * SR)
            if i >= len(self.L):
                continue
            j = min(len(self.L), i + len(sig))
            seg = sig[: j - i] * gain
            self.L[i:j] += seg * l; self.R[i:j] += seg * r

    def add_once(self, sig, t, pan=0.0, gain=1.0):
        l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
        i = int(t * SR)
        if i >= len(self.L):
            return
        j = min(len(self.L), i + len(sig))
        seg = sig[: j - i] * gain
        self.L[i:j] += seg * l; self.R[i:j] += seg * r


def make_ir(rt60=1.7, pre=0.018, damp=4500, seed=1):
    rng = np.random.default_rng(seed)
    n = int((rt60 + pre) * SR)
    t = np.arange(n) / SR
    out = []
    for _ in range(2):
        x = rng.standard_normal(n) * np.exp(-np.maximum(t - pre, 0) / (rt60 / 6.9))
        x[t < pre] = 0
        out.append(lowpass(x, damp, 1))
    ir = np.stack(out)
    return ir / np.sqrt((ir ** 2).sum() / 2)


def reverb(L, R, wet, rt60=1.7, damp=3200):
    ir = make_ir(rt60=rt60, damp=damp)
    wl = signal.fftconvolve(L, ir[0])[: len(L)]
    wr = signal.fftconvolve(R, ir[1])[: len(R)]
    return L * (1 - wet * 0.5) + wl * wet * 0.35, R * (1 - wet * 0.5) + wr * wet * 0.35


# ---------------------------------------------------------------- 输出
def lufs_peak(path):
    r = subprocess.run([FFMPEG, "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    lufs = peak = None
    s = False
    for line in r.stderr.splitlines():
        if "Summary" in line: s = True
        if s and line.strip().startswith("I:"): lufs = float(line.split()[1])
        if s and line.strip().startswith("Peak:"): peak = float(line.split()[1])
    return lufs, peak


def write_wav(path, L, R):
    x = np.stack([L, R], 1)
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


def finish(name, L, R, loop, target_lufs=-20.0, peak_db=-3.0, kbps=112, warm=3000):
    """循环：切中间一圈（长度 = LOOP）；单次：裁掉尾部静音。归一化 → 软限幅 → mp3"""
    if loop:
        a, b = int(LOOP * SR), int(2 * LOOP * SR)
        L, R = L[a:b], R[a:b]
    else:
        env = np.maximum(np.abs(L), np.abs(R))
        idx = np.where(env > 10 ** (-60 / 20) * env.max())[0]
        end = min(len(L), idx[-1] + int(0.05 * SR)) if len(idx) else len(L)
        L, R = L[:end], R[:end]
        f = int(0.04 * SR)
        L = L.copy(); R = R.copy()
        L[-f:] *= np.linspace(1, 0, f); R[-f:] *= np.linspace(1, 0, f)
    if warm:  # 整体变暖：高频收掉（2026-11-15 用户：乐器声太明显）
        L, R = lowpass(L, warm, 2), lowpass(R, warm, 2)
    base = np.abs(np.stack([L, R])).max() + 1e-9
    L, R = L / base * 0.5, R / base * 0.5
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "x.wav")
        write_wav(wav, L, R)
        lufs, peak = lufs_peak(wav)
        g = min(target_lufs - lufs, peak_db - peak) if loop else peak_db - peak   # 循环：响度到目标但峰值不超 peak_db；单次：只按峰值
        gl = 10 ** (g / 20)
        write_wav(wav, L * gl, R * gl)
        os.makedirs(OUT, exist_ok=True)
        out = os.path.join(OUT, name + ".mp3")
        subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", wav, "-ar", "44100", "-c:a", "libmp3lame", "-b:a", f"{kbps}k", out], check=True)
        lufs2, peak2 = lufs_peak(out)
    print(f"  {name:16s} {os.path.getsize(out)/1024:6.0f} KB  {lufs2 if lufs2 is not None else float('nan'):6.1f} LUFS  峰值 {peak2 if peak2 is not None else float('nan'):5.1f} dBTP")


# ---------------------------------------------------------------- 循环 stem 的编排
def stem_home_pad():
    tr = Track()
    for b, (n, q) in enumerate(HOME):
        for m in voicing(n, q, lift=12):
            tr.add(pad_note(m, BAR - 0.1, att=0.5, rel=1.0, vel=0.9), T(b), pan=RNG.uniform(-0.4, 0.4))
    return tr, 0.30


def stem_home_pluck():
    """尤克里里扫弦，反拍：嗒-嗒哒-嗒"""
    tr = Track()
    hits = [(2.0, "d", 0.95), (2.5, "u", 0.45), (3.5, "u", 0.55), (4.0, "d", 0.85)]
    for b, (n, q) in enumerate(HOME):
        v = voicing(n, q, lift=12, top=79)
        for beat, d, vel in hits:
            order = v if d == "d" else v[::-1]
            for i, m in enumerate(order):
                tr.add(soft_nylon(m, vel * RNG.uniform(0.85, 1.0), 1.1), T(b, beat) + i * 0.014, pan=-0.25 + 0.5 * i / max(1, len(v) - 1))
        for k in range(8):  # 轻刷沙锤：八分音符，反拍略重
            tr.add(shaker(0.8 if k % 2 else 0.45), T(b, 1 + k * 0.5), pan=0.2)
    return tr, 0.16


def stem_home_bass():
    tr = Track()
    for b, (n, q) in enumerate(HOME):
        r = bass_root(n)
        for beat, m, vel, d in [(1.0, r, 1.0, 0.9), (2.5, r + 7, 0.7, 0.5), (3.0, r + 12, 0.8, 0.5), (4.5, r + 7, 0.6, 0.4)]:
            tr.add(bass_pluck(m, vel, d + 0.3), T(b, beat), pan=0.0)
    return tr, 0.08


THEME = [  # (小节, 拍, midi, 时值（拍）, 力度)  妈妈的主题（卡林巴）
    (0, 1, 67, 1, .9), (0, 2, 72, 1, .8), (0, 3, 76, 1.5, .95), (0, 4.5, 74, .5, .7),
    (1, 1, 72, 1, .85), (1, 2, 69, 1, .75), (1, 3, 72, 2, .9),
    (2, 1, 69, 1, .85), (2, 2, 72, 1, .8), (2, 3, 77, 1.5, .95), (2, 4.5, 76, .5, .7),
    (3, 1, 74, 3, .9),
    (4, 1, 67, 1, .9), (4, 2, 72, 1, .8), (4, 3, 76, 1.5, .95), (4, 4.5, 79, .5, .75),
    (5, 1, 76, 1, .9), (5, 2, 74, 1, .8), (5, 3, 71, 2, .85),
    (6, 1, 69, 1, .85), (6, 2, 72, 1, .8), (6, 3, 74, 1, .85), (6, 4, 76, 1, .9),
    (7, 1, 74, 1, .9), (7, 2, 71, 1, .8), (7, 3, 67, 2, .85),
]


def stem_home_melody():
    tr = Track()
    for b, beat, m, d, vel in THEME:
        tr.add(soft_nylon(m - 12, vel * 0.9, 1.6), T(b, beat), pan=0.12)
    return tr, 0.30


def stem_home_sparkle():
    """蛋的动机：三个上行的短音，改成圆润的指弹（不再是马林巴 / 钟琴），蹦但不亮"""
    tr = Track()
    for b, (n, q) in enumerate(HOME):
        v = voicing(n, q, lift=12)
        tones = [v[0], v[1], v[2]]
        if b % 2 == 0:
            for i, beat in enumerate((1.0, 1.5, 2.0)):
                tr.add(soft_nylon(tones[i], 0.85, 0.5), T(b, beat), pan=0.3)
        else:
            tr.add(soft_nylon(tones[1], 0.7, 0.5), T(b, 2.5), pan=0.3)
            tr.add(soft_nylon(tones[2], 0.8, 0.5), T(b, 3.0), pan=0.3)
    return tr, 0.18


def stem_tender():
    """指弹分解和弦（八分音符）+ 很轻的钟琴：温柔、近"""
    tr = Track()
    pat = [0, 2, 1, 2, 0, 2, 1, 3]
    for b, (n, q) in enumerate(HOME):
        r = bass_root(n) + 12
        third = 4 if q == "M" else 3
        tones = [r, r + 7, r + 12 + third, r + 19]
        for i, k in enumerate(pat):
            tr.add(soft_nylon(tones[k], (0.85 if i % 2 == 0 else 0.6) * RNG.uniform(0.9, 1.0), 1.4), T(b, 1 + i * 0.5), pan=-0.1)
    for m in voicing("C", "M", lift=12):
        pass
    return tr, 0.22


def stem_curious():
    """挂留和弦的垫音 + 蹑手蹑脚的马林巴短音：悬着、没解决"""
    tr = Track()
    for b, (n, q) in enumerate(CUR):
        for m in voicing(n, q, lift=12):
            tr.add(pad_note(m, BAR - 0.05, att=0.7, rel=1.0, vel=0.55), T(b), pan=RNG.uniform(-0.4, 0.4))
        v = voicing(n, q, lift=24, top=90)
        for i, beat in enumerate((1.0, 2.5, 3.0, 4.5)):
            tr.add(soft_nylon(v[(i * 2) % len(v)] - 12, 0.7 if i % 2 == 0 else 0.5, 0.3), T(b, beat), pan=-0.35 if i % 2 == 0 else 0.35)
        if b in (3, 7):  # 句尾上扬，不落地："嗯？"
            tr.add(soft_nylon(69, 0.6, 0.6), T(b, 3.0), pan=0.3)
            tr.add(soft_nylon(74, 0.7, 1.0), T(b, 4.0), pan=0.35)
    return tr, 0.18


def stem_empty():
    """空房间：低八度的小调垫音（两小节一换）+ 稀疏的钟声 + 妈妈主题的孤零零一小句"""
    tr = Track()
    for c in range(4):
        n, q = EMPTY[c * 2]
        for m in voicing(n, q, lift=0):
            tr.add(pad_note(m, 2 * BAR - 0.05, att=1.2, rel=1.6, vel=0.8), T(c * 2), pan=RNG.uniform(-0.5, 0.5))
    for bar, beat, m, vel in [(0, 1.0, 81, .45), (2, 3.0, 84, .4), (4, 4.0, 81, .35), (6, 2.0, 83, .4)]:
        tr.add(pad_note(m - 12, 1.4, att=0.25, rel=1.2, vel=vel * 1.6), T(bar, beat), pan=RNG.uniform(-0.5, 0.5))
    for beat, m in [(2.0, 67), (3.0, 72), (4.0, 76)]:  # 主题的头三个音，孤零零
        tr.add(soft_nylon(m - 12, 0.5, 1.5), T(5, beat), pan=0.2)
    return tr, 0.40


STEMS = {
    "home-pad": (stem_home_pad, 0.28),
    "home-pluck": (stem_home_pluck, 0.2),
    "home-bass": (stem_home_bass, 0.1),
    "home-melody": (stem_home_melody, 0.3),
    "home-sparkle": (stem_home_sparkle, 0.22),
    "tender": (stem_tender, 0.26),
    "curious": (stem_curious, 0.24),
    "empty": (stem_empty, 0.45),
}


# ---------------------------------------------------------------- 单次 stinger
def render_once(events, wet=0.25, rt60=1.5, length=5.0):
    """events: [(时间秒, 信号, 声像, 增益)]"""
    tr = Track(cycles=1, tail=length)
    for t, sig, pan, g in events:
        tr.add_once(sig, t, pan, g)
    L, R = reverb(tr.L, tr.R, wet, rt60)
    return L, R


def stinger_idea():
    ev = [(i * 0.085, glock(m, 0.9 - i * 0.1, 1.6), 0.2, 1.0) for i, m in enumerate((79, 84, 88, 91))]
    ev.append((0.0, kalimba(72, 0.6, 1.2), -0.2, 1.0))
    return render_once(ev, 0.3, 1.3, 2.0)


def stinger_missing():
    ev = [(0.0, marimba(76, 0.9, 1.0), -0.1, 1.0), (0.3, marimba(81, 0.8, 1.2), 0.1, 1.0), (0.3, glock(93, 0.3, 2.0), 0.3, 1.0)]
    for m in (57, 62, 64):
        ev.append((0.25, pad_note(m + 12, 1.6, att=0.5, rel=1.5, vel=0.5), 0.0, 1.0))
    return render_once(ev, 0.4, 1.8, 3.2)


def stinger_catch():
    ev = [(i * 0.055, glock(m, 0.85, 2.2), 0.1 * (i - 1.5), 1.0) for i, m in enumerate((72, 76, 79, 84))]
    ev += [(0.0, kalimba(60, 0.8, 2.2), -0.2, 1.0), (0.0, kalimba(67, 0.6, 2.2), 0.2, 1.0), (0.14, kalimba(76, 0.7, 2.2), 0.0, 1.0)]
    for m in (60, 64, 67, 72):
        ev.append((0.02, pad_note(m, 1.4, att=0.12, rel=1.6, vel=0.7), 0.0, 1.0))
    return render_once(ev, 0.28, 1.6, 3.6)


def stinger_handoff():
    ev = [(0.0, glock(79, 0.9, 1.4), -0.1, 1.0), (0.17, glock(84, 1.0, 1.8), 0.1, 1.0),
          (0.17, kalimba(72, 0.7, 1.6), 0.0, 1.0), (0.17, kalimba(76, 0.6, 1.6), 0.1, 1.0)]
    return render_once(ev, 0.25, 1.3, 2.4)


def stinger_yolk():
    seq = [96, 91, 88, 84, 79, 76, 72]
    ev = [(i * 0.12, glock(m, 0.75 - i * 0.05, 1.6), 0.4 - 0.13 * i, 1.0) for i, m in enumerate(seq)]
    ev.append((0.8, marimba(60, 0.6, 1.4), 0.0, 1.0))
    for m in (60, 64, 67, 71):
        ev.append((0.3, pad_note(m, 1.8, att=0.6, rel=1.8, vel=0.55), 0.0, 1.0))
    return render_once(ev, 0.35, 1.8, 4.5)


def stinger_mom_call():
    notes = [(0.0, 67, .9), (0.3, 64, .8), (0.85, 67, .85), (1.1, 69, .85), (1.35, 67, .8), (1.7, 64, .9)]
    return render_once([(t, kalimba(m + 0, v, 1.6), -0.1, 1.0) for t, m, v in notes], 0.25, 1.4, 2.6)


def stinger_egg_small():
    ev = [(0.0, glock(88, 0.55, 1.4), 0.3, 1.0), (0.24, glock(86, 0.4, 1.4), 0.3, 1.0)]
    return render_once(ev, 0.3, 1.3, 2.0)


def stinger_egg_call():
    ev = [(0.0, marimba(79, 0.95, 0.8), 0.1, 1.0), (0.2, marimba(84, 1.0, 0.8), 0.15, 1.0),
          (0.34, marimba(88, 1.0, 1.0), 0.2, 1.0), (0.34, glock(100, 0.6, 1.6), 0.3, 1.0), (0.2, glock(96, 0.45, 1.4), 0.25, 1.0)]
    return render_once(ev, 0.25, 1.3, 2.2)


def stinger_punch():
    ev = [(0.0, glide(50, 42, 1.3, 0.35, 1.0), 0.0, 1.0), (0.0, marimba(50, 0.5, 0.6), 0.0, 1.0)]
    return render_once(ev, 0.1, 0.8, 1.8)


def stinger_end():
    ev = []
    for m in (48, 55, 64):
        ev.append((0.0, pad_note(m, 2.4, att=1.4, rel=2.2, vel=0.7), 0.0, 1.0))
    return render_once(ev, 0.35, 2.0, 6.5)


def stinger_cricket():
    """无语的三个点：一声蟋蟀（4 个短脉冲）。尴尬冷场的通用声音，比"嗒"干净、一听就懂"""
    f = 4300.0
    pulse_t = tt(0.024)
    win = np.hanning(len(pulse_t))
    pulse = (np.sin(2 * np.pi * f * pulse_t) + 0.3 * np.sin(2 * np.pi * 2 * f * pulse_t)) * win
    ev = [(i * 0.046, pulse, 0.0, 0.7 + 0.1 * i) for i in range(4)]
    return render_once(ev, 0.12, 0.6, 0.6)


def stinger_bloop():
    return render_once([(0.0, marimba(72, 1.0, 0.9), 0.0, 1.0)], 0.12, 0.7, 1.2)


STINGERS = {
    "idea-ding": stinger_idea, "missing-q": stinger_missing, "catch-chord": stinger_catch, "handoff-bell": stinger_handoff,
    "yolk-cascade": stinger_yolk, "mom-call": stinger_mom_call, "egg-small": stinger_egg_small, "egg-call": stinger_egg_call,
    "punch-dum": stinger_punch, "cricket": stinger_cricket, "end-hold": stinger_end, "egg-bloop": stinger_bloop,
}


def main():
    want = set(sys.argv[1:])
    print("stem（循环，8 小节 = 20.000 s）")
    for name, (fn, wet) in STEMS.items():
        if want and name not in want:
            continue
        tr, _ = fn()
        L, R = reverb(tr.L, tr.R, wet, rt60=1.9 if name == "empty" else 1.5)
        finish(name, L, R, loop=True, target_lufs=-20.0, peak_db=-3.0)
    print("stinger（单次）")
    for name, fn in STINGERS.items():
        if want and name not in want:
            continue
        L, R = fn()
        finish("st-" + name, L, R, loop=False, peak_db=-3.0, kbps=96, warm=None if name == "cricket" else 4200)


if __name__ == "__main__":
    main()
