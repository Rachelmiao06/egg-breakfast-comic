#!/usr/bin/env bash
# 客观测量 public/assets/audio 里的音频（不需要 ffprobe，只用 ffmpeg）。
# 每个文件打印：时长、采样率、声道、整体响度 (LUFS)、响度范围 (LU)、真峰值 (dBTP)、
# 首 / 尾 60 ms 的 RMS 电平（循环接缝处的电平差），以及前导静音长度。
# 用法：tools/audio_measure.sh [文件...]   （不给参数则测目录里全部 mp3）
set -euo pipefail
FFMPEG="${FFMPEG:-$HOME/.local/bin/ffmpeg}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/public/assets/audio"
SEAM_MS=60

files=("$@")
if [ ${#files[@]} -eq 0 ]; then files=("$DIR"/*.mp3); fi

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
dur_of() { # 秒（小数）：先解码成 WAV 再读时长，避免 mp3 头的估算误差影响尾部定位
  "$FFMPEG" -hide_banner -i "$1" -f null - 2>&1 | awk -F'[ ,]+' '/Duration/ {split($3,t,":"); printf "%.3f", t[1]*3600+t[2]*60+t[3]}'
}
rms_of() { # 文件 起始秒 时长秒 → RMS dBFS（整体）
  "$FFMPEG" -hide_banner -ss "$2" -t "$3" -i "$1" -af "astats=measure_perchannel=none:measure_overall=RMS_level" -f null - 2>&1 \
    | awk '/Overall/ {o=1} o && /RMS level dB/ {print $NF; exit}'
}

printf "%-22s %8s %6s %3s %8s %6s %8s %9s %9s %7s %8s\n" file dur_s rate ch LUFS LRA dBTP head_dB tail_dB seam_dB lead_sil
for f in "${files[@]}"; do
  base=$(basename "$f")
  info=$("$FFMPEG" -hide_banner -i "$f" -f null - 2>&1 | grep -m1 "Stream #0:0")
  src="$f"
  "$FFMPEG" -hide_banner -loglevel error -y -i "$f" -c:a pcm_f32le "$TMP/dec.wav"
  f="$TMP/dec.wav"
  rate=$(echo "$info" | grep -oE '[0-9]+ Hz' | cut -d' ' -f1)
  ch=$(echo "$info" | grep -qE 'stereo' && echo 2 || echo 1)
  dur=$(dur_of "$f")
  ebu=$("$FFMPEG" -hide_banner -nostats -i "$f" -af "ebur128=peak=true" -f null - 2>&1 | awk '/Summary/ {s=1} s')
  lufs=$(echo "$ebu" | awk '/I:/ {print $2; exit}')
  lra=$(echo "$ebu" | awk '/LRA:/ {print $2; exit}')
  tpk=$(echo "$ebu" | awk '/Peak:/ {print $2; exit}')
  seam=$(awk -v d="$dur" -v ms="$SEAM_MS" 'BEGIN{printf "%.3f", ms/1000}')
  tail_start=$(awk -v d="$dur" -v s="$seam" 'BEGIN{printf "%.3f", d-s}')
  head=$(rms_of "$f" 0 "$seam")
  tail=$(rms_of "$f" "$tail_start" "$seam")
  diff=$(awk -v a="$head" -v b="$tail" 'BEGIN{ if (a=="-inf"||b=="-inf") print "inf"; else printf "%.1f", (a-b<0?b-a:a-b)}')
  f="$src"
  lead=$("$FFMPEG" -hide_banner -nostats -i "$f" -af "silencedetect=n=-50dB:d=0.05" -f null - 2>&1 \
    | awk '/silence_start: 0(\.0+)?$/ {s=1} s && /silence_end/ {for(i=1;i<=NF;i++) if($i=="silence_end:") {print $(i+1); exit}}')
  printf "%-22s %8s %6s %3s %8s %6s %8s %9s %9s %7s %8s\n" "$base" "$dur" "$rate" "$ch" "$lufs" "$lra" "$tpk" "$head" "$tail" "$diff" "${lead:-0}"
done
