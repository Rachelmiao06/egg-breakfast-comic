#!/usr/bin/env bash
# 把 tools/audio_raw/ 的原始下载处理成 public/assets/audio/ 的成品（可重复执行）。
# 只用 ffmpeg（本机 ~/.local/bin/ffmpeg，没有 ffprobe）。每个文件的处理：
#   1. 裁切（去前导静音 / 取一声）；循环声取一段并做"旋转 + 等功率交叉淡化"接缝：
#      输出 = acrossfade(原[d:], 原[:d])，循环点落在原本连续的音频上，交叉淡化发生在文件中部的
#      原首尾衔接处，所以首尾对接没有波形跳变。
#   2. 响度：先测中间 WAV 的 LUFS 和真峰值，增益 = min(目标 - LUFS, 峰值上限 - 真峰值 + 允许限幅量)，
#      再过 alimiter（上限 -2 dBFS）。持续声允许限幅 6 dB，敲击声 3 dB（避免把瞬态压扁），所以
#      敲击类文件可能达不到 -18 LUFS，实际值见 tools/audio_measure.sh。
#      alimiter 有 5 ms 前瞻：不开延迟补偿时它在文件开头写约 4 ms 数字静音、把最后 5 ms 推出文件，
#      循环回绕时就会掉音（2026-11-14 真实录音测到 room 每次回绕掉 5–9 ms）。所以：
#      - 循环声：把循环首尾相接三份送进限幅器（latency=1 补偿延迟），只取中间一份。中间一份开头的
#        限幅状态来自"上一圈的结尾"，结尾的前瞻看到的是"下一圈的开头"，和网页里循环播放时完全一致。
#      - 单次声：latency=1，开头不再多出 4 ms 静音。
#   3. 编码 mp3（libmp3lame，保留 LAME/Xing gapless 信息让解码器去掉编码延迟），44.1 kHz。
#      所有中间文件先重采样到 44.1 kHz 再旋转/拼接，避免在循环边界上重采样。
#   验收：node tools/audio_seam_check.mjs（1 ms 分辨率看首尾 20 ms、回绕处采样跳变与文件内正常值之比）。
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

# WAV 的采样数（读 data 块大小；中间文件都是 pcm_f32le 双声道）
wav_samples() {
  node -e 'const b=require("fs").readFileSync(process.argv[1]);let o=12;while(o<b.length){const id=b.toString("ascii",o,o+4),sz=b.readUInt32LE(o+4);if(id==="data"){const ch=b.readUInt16LE(22),bits=b.readUInt16LE(34);console.log(sz/(ch*bits/8));process.exit(0)}o+=8+sz+(sz&1)}process.exit(1)' "$1"
}

# 响度 + 限幅 + 编码： finalize <wav> <out.mp3> <allowed_limit_db> <bitrate> [loop]
finalize() {
  local wav=$1 out=$2 allow=$3 br=$4 mode=${5:-oneshot}
  read -r lufs tp < <(measure "$wav")
  local gain
  gain=$(awk -v l="$lufs" -v p="$tp" -v t="$TARGET_LUFS" -v c="$CEIL_DBTP" -v a="$allow" \
    'BEGIN { g1=t-l; g2=c-p+a; g=(g1<g2)?g1:g2; printf "%.2f", g }')
  log "中间 WAV: $lufs LUFS, 真峰值 $tp dBTP → 增益 ${gain} dB（目标 $TARGET_LUFS，限幅上限 $CEIL_DBTP，允许限幅 ${allow} dB）"
  local lim="volume=${gain}dB,alimiter=limit=${LIMIT_LIN}:attack=5:release=60:level=false:latency=1"
  if [ "$mode" = loop ]; then
    local n e
    n=$(wav_samples "$wav"); e=$((2 * n))
    log "循环：三份首尾相接过限幅器，取中间一份（${n} 采样）"
    "$FFMPEG" -hide_banner -loglevel error -y -stream_loop 2 -i "$wav" \
      -af "${lim},atrim=start_sample=${n}:end_sample=${e},asetpts=N/SR/TB" -c:a pcm_f32le "$TMP/limited.wav"
  else
    "$FFMPEG" -hide_banner -loglevel error -y -i "$wav" -af "$lim" -c:a pcm_f32le "$TMP/limited.wav"
  fi
  "$FFMPEG" -hide_banner -loglevel error -y -i "$TMP/limited.wav" -ar 44100 -c:a libmp3lame -b:a "$br" "$out"
}

# 循环接缝： loop_seam <in> <wav_out> <start> <end> <rotate_d> <xfade_c> [pad_end]
# 取原文件 [start,end]（先重采样到 44.1 kHz），末尾可补 pad_end 秒静音（修整敲击节奏），然后旋转 d 秒并把原首尾交叉淡化 c 秒：
#   X = 段[d:]（尾部 c 秒等功率淡出），Y = 段[:d]（头部 c 秒等功率淡入，整体延后 len(X)-c），输出 = X + Y 叠加，长度 = 段长 - c。
#   回绕处 = 原文件里连续的两个采样 段[d-1] → 段[d]；d 由 tools/audio_pick_cut.mjs 在给定值 ±0.1 s 内挑最接近零交叉的位置。
#   全部按采样数计算（atrim / adelay 的 S 单位），不按毫秒取整。
#   （本机 ffmpeg 7.1 的 acrossfade 对这类输入输出为空，所以手工用 afade + adelay + amix 实现。）
loop_seam() {
  local in=$1 out=$2 start=$3 end=$4 d=$5 c=$6 pad=${7:-0}
  local seg="$TMP/seg.wav" sr=44100
  # 不用 -ss 输入寻址：mp3 寻址后第一帧（约 24 ms）解码为静音。从头解码再用 atrim 精确裁切
  "$FFMPEG" -hide_banner -loglevel error -y -i "$in" -af "aresample=$sr,atrim=start=${start}:end=${end},asetpts=N/SR/TB,apad=pad_dur=${pad}" -c:a pcm_f32le "$seg"
  local total ds cs lx
  total=$(wav_samples "$seg")
  d=$(node "$ROOT/tools/audio_pick_cut.mjs" "$seg" "$d" 0.1)
  ds=$(awk -v d="$d" -v r=$sr 'BEGIN{printf "%d", d*r+0.5}')
  cs=$(awk -v c="$c" -v r=$sr 'BEGIN{printf "%d", c*r+0.5}')
  lx=$((total - ds))
  log "接缝：段长 ${total} 采样，旋转点 ${ds} 采样（${d} s），交叉淡化 ${cs} 采样 → 输出 $((total - cs)) 采样"
  "$FFMPEG" -hide_banner -loglevel error -y -i "$seg" -filter_complex \
    "[0:a]asplit=2[a][b];[a]atrim=start_sample=${ds},asetpts=N/SR/TB,afade=t=out:start_sample=$((lx - cs)):nb_samples=${cs}:curve=qsin[x];[b]atrim=end_sample=${ds},asetpts=N/SR/TB,afade=t=in:start_sample=0:nb_samples=${cs}:curve=qsin,adelay=delays=$((lx - cs))S:all=1[y];[x][y]amix=inputs=2:normalize=0:duration=longest" \
    -c:a pcm_f32le "$out"
}

# 单次： oneshot_trim <in> <wav_out> <start> <end> <fade_in> <fade_out> [额外滤镜，如 lowpass=f=4000]
oneshot_trim() {
  local in=$1 out=$2 start=$3 end=$4 fi=$5 fo=$6 extra=${7:-}
  local dur fo_start
  dur=$(awk -v s="$start" -v e="$end" 'BEGIN{printf "%.3f", e-s}')
  fo_start=$(awk -v d="$dur" -v f="$fo" 'BEGIN{printf "%.3f", d-f}')
  "$FFMPEG" -hide_banner -loglevel error -y -i "$in" \
    -af "aresample=44100,atrim=start=${start}:end=${end},asetpts=N/SR/TB${extra:+,$extra},afade=t=in:st=0:d=${fi},afade=t=out:st=${fo_start}:d=${fo}" -c:a pcm_f32le "$out"
}

build() {
  local name=$1
  echo "== $name"
  local raw="$RAW/$name.mp3" wav="$TMP/$name.wav" out="$OUT/$name.mp3"
  case $name in
    sizzle-loop)      # 原档 64.85 s；取前 20.5 s，旋转 1 s、交叉淡化 0.5 s → 20.0 s 循环
      loop_seam "$raw" "$wav" 0 20.5 1.0 0.5;        finalize "$wav" "$out" 6 192k loop ;;
    room-loop)        # 原档 185.7 s、约 -46 LUFS；取前 40.5 s → 40.0 s 循环，大幅提升
      loop_seam "$raw" "$wav" 0 40.5 1.0 0.5;        finalize "$wav" "$out" 6 128k loop ;;
    chop-loop)        # 原档 6.34 s；末尾补 0.29 s 让首尾衔接处的刀声间隔≈其他间隔（约 1.05 s），接缝在静音段内
      loop_seam "$raw" "$wav" 0 6.34 0.5 0.1 0.29;   finalize "$wav" "$out" 3 192k loop ;;
    sauce-stir-loop)  # 原档 18.81 s，前 0.8 s 静音；取 [0.80, 18.70]（两端都在勺声间隙里）→ 17.7 s 循环
      loop_seam "$raw" "$wav" 0.80 18.70 0.6 0.2;    finalize "$wav" "$out" 3 192k loop ;;
    stirfry-in-water) # 旧版下锅声（水滴进热锅的一声爆发，没有食材落锅）：原档 7.9 s，起音 0.88 s；取 [0.86, 2.66]，尾部 0.7 s 淡出 → 1.8 s。
                      # 2026-11-14 起不再加载，保留可重做
      out="$OUT/alt/stirfry-in-water.mp3"; mkdir -p "$OUT/alt"
      oneshot_trim "$raw" "$wav" 0.86 2.66 0.01 0.7; finalize "$wav" "$out" 6 192k ;;
    stirfry-in)       # 配菜落锅 + 短暂滋啦（LG "Stir fry 07"，CC BY 4.0）：原档 17.3 s，0.44 s 前是锅里轻微的油声，
                      # 0.44–0.48 s 食材一下落进锅（低频冲击，-40 → -31 dB），随后滋啦声铺开。取 [0.42, 2.02]，
                      # 尾部 0.6 s 淡出（1.88 s 处一个油爆被淡出压低）→ 1.6 s。由前景 p2d 第一批玉米落锅时派发
      oneshot_trim "$raw" "$wav" 0.42 2.02 0.005 0.6; finalize "$wav" "$out" 6 192k ;;
    stirfry-stir)     # 翻炒（buzkill "Carmelized Onions Large Steel Pan Stirring Wooden Spatula Bubbling"，CC0）：原档 75.8 s，
                      # 前 28 s 是木铲在钢锅里推洋葱、轻微刮锅；5.0 / 11.75 / 14.75 s 有较重的敲锅。取 [6.2, 9.4]（三下均匀的推铲，
                      # 约 1.4 s 一下，最响 -29 dB），0.15 s 淡入、0.7 s 淡出 → 3.2 s 一段。由前景"翻炒开始"事件播放，停止事件 0.2 s 淡出
      oneshot_trim "$raw" "$wav" 6.2 9.4 0.15 0.7; finalize "$wav" "$out" 6 192k ;;
    sauce-stir)       # 调汁搅拌（dynamique "stirring bowl.wav"，CC0；标签：木勺、玻璃碗、液体）：原档 52 s 单声道、很轻（-34 LUFS，
                      # 底噪约 -62 dB）。前 32 s 是规律的轻搅、约 0.65 s 碰一下碗。取 [9.95, 12.55]：0.15 s、0.75 s、1.65 s 三下碰碗
                      # 落在前景两圈（1.9 s）里，2.35 s 那下被淡出压低；先 afftdn 轻度降噪 10 dB，0.08 s 淡入、0.4 s 淡出 → 2.6 s
      oneshot_trim "$raw" "$wav" 9.95 12.55 0.08 0.4 "afftdn=nr=10:nf=-62:tn=1,highpass=f=120"; finalize "$wav" "$out" 3 192k ;;
    pour)             # 淋汁（alexarje "Pouring oil (SoundAction 072)"，CC BY 4.0）：原档 44 s；0.95 s 开始是细细的一股油流（宽带、
                      # 柔和，-36…-47 dB），3.2 s 之后变成一下一下的咕嘟（大流量，不用）。取 [0.85, 2.05]，0.08 s 淡入、0.35 s 淡出、
                      # 高通 150 Hz 去掉手持的低频 → 1.2 s 小流量液体声
      oneshot_trim "$raw" "$wav" 0.85 2.05 0.08 0.35 "highpass=f=150"; finalize "$wav" "$out" 6 192k ;;
    egg-rice)         # 蛋被铲子放到饭上（p4b）：和 catch 同一原档（Pixabay "soft plop"）的第二声 plop（2.04 s 起音），比落铲更闷：
                      # 取 [2.035, 2.45]，2.5 kHz 低通，2 ms 淡入、0.15 s 淡出 → 0.415 s。"碗放到桌上"另用 bowl-down（p4e）
      raw="$RAW/catch.mp3"
      oneshot_trim "$raw" "$wav" 2.035 2.45 0.002 0.15 "lowpass=f=2500"; finalize "$wav" "$out" 3 192k ;;
    egg-hop)          # 开场蛋在锅里跳的落地声（nebulasnails "Wet Splat 2"，CC0）：原档 0.55 s，起音 0.025 s。取 [0.02, 0.20]，
                      # 两次 2 kHz 低通把"啪"压成很软的"噗"，2 ms 淡入、0.08 s 淡出 → 0.18 s。混音器限制间隔并轻微变化
      oneshot_trim "$raw" "$wav" 0.02 0.20 0.002 0.08 "lowpass=f=2000,lowpass=f=2000"; finalize "$wav" "$out" 3 192k ;;
    catch)            # 原档 4.8 s 有三声 plop，第一声起音 0.49 s、峰值 0.52 s；取 [0.47, 1.07]，尾部 0.15 s 淡出 → 0.6 s
      oneshot_trim "$raw" "$wav" 0.47 1.07 0.005 0.15; finalize "$wav" "$out" 3 192k ;;
    footsteps-loop)   # 原档 29.86 s 单声道，地毯上穿拖鞋慢走，约 -42 LUFS；0.17–7.76 s 是 7 步均匀的一段（间隔约 1.27 s）。
                      # 取 [0.80, 8.66]（两端都在步间），交叉淡化 0.3 s → 7.56 s 循环 = 6 步 + 回绕处一个 1.27 s 的步间
      loop_seam "$raw" "$wav" 0.80 8.66 0.4 0.3;      finalize "$wav" "$out" 3 128k loop ;;
    chop-hit)         # 从 chop-loop 原档里取一刀（第二刀最干净：起音 1.1793 s 直接到 -18 dB，没有切菜前奏；+40 ms 刀碰案板峰值；之后无二次撞击）。
                      # 取 [1.177, 1.437]（起音前 2 ms），1 ms 淡入、尾部 0.08 s 淡出 → 0.26 s。供前景动画逐刀触发（kitchen:oneshot 事件）
      raw="$RAW/chop-loop.mp3"
      oneshot_trim "$raw" "$wav" 1.177 1.437 0.001 0.08; finalize "$wav" "$out" 3 192k ;;
    hop-tap-1|hop-tap-2|hop-tap-3)
                      # 接蛋前的声音铺垫（listen）：画外右侧，蛋在桌沿台面上轻跳落下的"嗒"。从 chop-loop 原档里取刀碰木案板的撞击
                      # （木头接触），从峰值前 2 ms 切到峰值后 90 ms，1.5 kHz 低通去掉刀的金属亮度 → 软的小"嗒"。
                      # 1 = 5.850 s 那一下（最轻、前面最安静：峰值前 -35…-46 dB）；2 = 4.683 s；3 = 3.212 s。三下各不相同，避免同一采样重复
      raw="$RAW/chop-loop.mp3"
      local pk; case $name in hop-tap-1) pk=5.850 ;; hop-tap-2) pk=4.683 ;; hop-tap-3) pk=3.212 ;; esac
      oneshot_trim "$raw" "$wav" "$(awk -v p=$pk 'BEGIN{printf "%.3f", p-0.002}')" "$(awk -v p=$pk 'BEGIN{printf "%.3f", p+0.090}')" 0.002 0.05 "lowpass=f=1500,lowpass=f=1500"
      finalize "$wav" "$out" 3 192k ;;
    pop)              # 原档 1.04 s，起音 0.025 s、约 0.17 s 后衰减到底；取 [0.02, 0.30]，2 ms 淡入、尾部 0.1 s 淡出 → 0.28 s
      oneshot_trim "$raw" "$wav" 0.02 0.30 0.002 0.1; finalize "$wav" "$out" 3 192k ;;
    *) echo "未知文件 $name" >&2; exit 1 ;;
  esac
}

names=("$@")
if [ ${#names[@]} -eq 0 ]; then names=(sizzle-loop room-loop chop-loop sauce-stir-loop stirfry-in catch footsteps-loop pop chop-hit hop-tap-1 hop-tap-2 hop-tap-3 stirfry-stir sauce-stir pour egg-hop egg-rice); fi
for n in "${names[@]}"; do build "$n"; done
echo "完成。测量：tools/audio_measure.sh"
