#!/usr/bin/env bash
# 把 tools/audio_raw/ 的原始下载处理成 public/assets/audio/ 的成品（可重复执行）。
# 只用 ffmpeg（本机 ~/.local/bin/ffmpeg，没有 ffprobe）。每个文件的处理：
#   1. 裁切（去前导静音 / 取一声）；循环声取一段并做"旋转 + 等功率交叉淡化"接缝：
#      输出 = acrossfade(原[d:], 原[:d])，循环点落在原本连续的音频上，交叉淡化发生在文件中部的
#      原首尾衔接处，所以首尾对接没有波形跳变。
#   2. 响度：先测中间 WAV 的 LUFS 和真峰值，增益 = min(目标 - LUFS, 峰值上限 - 真峰值 + 允许限幅量)，
#      再过 alimiter（上限 -1 dBFS）。持续声允许限幅 6 dB，敲击声 3 dB（避免把瞬态压扁），所以
#      敲击类文件可能达不到 -18 LUFS，实际值见 tools/audio_measure.sh。
#   3. 编码 mp3（libmp3lame，含 LAME gapless 信息），44.1 kHz。
# 用法：tools/audio_build.sh            处理全部
#       tools/audio_build.sh sizzle-loop 只处理一个
set -euo pipefail
FFMPEG="${FFMPEG:-$HOME/.local/bin/ffmpeg}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RAW="$ROOT/tools/audio_raw"
OUT="$ROOT/public/assets/audio"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
TARGET_LUFS=-18
CEIL_DBTP=-1
LIMIT_LIN=0.794   # -2 dBFS 采样峰值；mp3 编码后真峰值约高 1 dB，留出余量使成品 ≤ -1 dBTP

log() { printf '  %s\n' "$*"; }

# 测 LUFS 与真峰值 → 打印 "lufs tp"
measure() {
  "$FFMPEG" -hide_banner -nostats -i "$1" -af "ebur128=peak=true" -f null - 2>&1 \
    | awk '/Summary/ {s=1} s && /I:/ {l=$2} s && /Peak:/ {p=$2} END {print l, p}'
}

# 响度 + 限幅 + 编码： finalize <wav> <out.mp3> <allowed_limit_db> <bitrate>
finalize() {
  local wav=$1 out=$2 allow=$3 br=$4
  read -r lufs tp < <(measure "$wav")
  local gain
  gain=$(awk -v l="$lufs" -v p="$tp" -v t="$TARGET_LUFS" -v c="$CEIL_DBTP" -v a="$allow" \
    'BEGIN { g1=t-l; g2=c-p+a; g=(g1<g2)?g1:g2; printf "%.2f", g }')
  log "中间 WAV: $lufs LUFS, 真峰值 $tp dBTP → 增益 ${gain} dB（目标 $TARGET_LUFS，限幅上限 $CEIL_DBTP，允许限幅 ${allow} dB）"
  "$FFMPEG" -hide_banner -loglevel error -y -i "$wav" \
    -af "volume=${gain}dB,alimiter=limit=${LIMIT_LIN}:attack=5:release=60:level=false" \
    -ar 44100 -c:a libmp3lame -b:a "$br" "$out"
}

# 循环接缝： loop_seam <in> <wav_out> <start> <end> <rotate_d> <xfade_c> [pad_end]
# 取原文件 [start,end]，末尾可补 pad_end 秒静音（修整敲击节奏），然后旋转 d 秒并把原首尾交叉淡化 c 秒：
#   X = 段[d:]（尾部 c 秒等功率淡出），Y = 段[:d]（头部 c 秒等功率淡入，整体延后 len(X)-c 秒），输出 = X + Y 叠加。
#   （本机 ffmpeg 7.1 的 acrossfade 对这类输入输出为空，所以手工用 afade + adelay + amix 实现。）
loop_seam() {
  local in=$1 out=$2 start=$3 end=$4 d=$5 c=$6 pad=${7:-0}
  local seg="$TMP/seg.wav"
  "$FFMPEG" -hide_banner -loglevel error -y -ss "$start" -to "$end" -i "$in" -af "apad=pad_dur=${pad}" -c:a pcm_f32le "$seg"
  local total lx fade_st delay_ms
  total=$(awk -v s="$start" -v e="$end" -v p="$pad" 'BEGIN{printf "%.4f", e-s+p}')
  lx=$(awk -v t="$total" -v d="$d" 'BEGIN{printf "%.4f", t-d}')
  fade_st=$(awk -v l="$lx" -v c="$c" 'BEGIN{printf "%.4f", l-c}')
  delay_ms=$(awk -v f="$fade_st" 'BEGIN{printf "%d", f*1000+0.5}')
  "$FFMPEG" -hide_banner -loglevel error -y -ss "$d" -i "$seg" -t "$d" -i "$seg" -filter_complex \
    "[0:a]afade=t=out:st=${fade_st}:d=${c}:curve=qsin[x];[1:a]afade=t=in:st=0:d=${c}:curve=qsin,adelay=delays=${delay_ms}:all=1[y];[x][y]amix=inputs=2:normalize=0:duration=longest" \
    -c:a pcm_f32le "$out"
}

# 单次： oneshot_trim <in> <wav_out> <start> <end> <fade_in> <fade_out>
oneshot_trim() {
  local in=$1 out=$2 start=$3 end=$4 fi=$5 fo=$6
  local dur fo_start
  dur=$(awk -v s="$start" -v e="$end" 'BEGIN{printf "%.3f", e-s}')
  fo_start=$(awk -v d="$dur" -v f="$fo" 'BEGIN{printf "%.3f", d-f}')
  "$FFMPEG" -hide_banner -loglevel error -y -ss "$start" -to "$end" -i "$in" \
    -af "afade=t=in:st=0:d=${fi},afade=t=out:st=${fo_start}:d=${fo}" -c:a pcm_f32le "$out"
}

build() {
  local name=$1
  echo "== $name"
  local raw="$RAW/$name.mp3" wav="$TMP/$name.wav" out="$OUT/$name.mp3"
  case $name in
    sizzle-loop)      # 原档 64.85 s；取前 20.5 s，旋转 1 s、交叉淡化 0.5 s → 20.0 s 循环
      loop_seam "$raw" "$wav" 0 20.5 1.0 0.5;        finalize "$wav" "$out" 6 192k ;;
    room-loop)        # 原档 185.7 s、约 -46 LUFS；取前 40.5 s → 40.0 s 循环，大幅提升
      loop_seam "$raw" "$wav" 0 40.5 1.0 0.5;        finalize "$wav" "$out" 6 128k ;;
    chop-loop)        # 原档 6.34 s；末尾补 0.29 s 让首尾衔接处的刀声间隔≈其他间隔（约 1.05 s），接缝在静音段内
      loop_seam "$raw" "$wav" 0 6.34 0.5 0.1 0.29;   finalize "$wav" "$out" 3 192k ;;
    sauce-stir-loop)  # 原档 18.81 s，前 0.8 s 静音；取 [0.80, 18.70]（两端都在勺声间隙里）→ 17.7 s 循环
      loop_seam "$raw" "$wav" 0.80 18.70 0.6 0.2;    finalize "$wav" "$out" 3 192k ;;
    stirfry-in)       # 原档 7.9 s，起音在 0.88 s（之前为静音）；取 [0.86, 2.66] 一声爆发，尾部 0.7 s 淡出 → 1.8 s
      oneshot_trim "$raw" "$wav" 0.86 2.66 0.01 0.7; finalize "$wav" "$out" 6 192k ;;
    catch)            # 原档 4.8 s 有三声 plop，第一声起音 0.49 s、峰值 0.52 s；取 [0.47, 1.07]，尾部 0.15 s 淡出 → 0.6 s
      oneshot_trim "$raw" "$wav" 0.47 1.07 0.005 0.15; finalize "$wav" "$out" 3 192k ;;
    *) echo "未知文件 $name" >&2; exit 1 ;;
  esac
}

names=("$@")
if [ ${#names[@]} -eq 0 ]; then names=(sizzle-loop room-loop chop-loop sauce-stir-loop stirfry-in catch); fi
for n in "${names[@]}"; do build "$n"; done
echo "完成。测量：tools/audio_measure.sh"
