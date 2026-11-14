#!/usr/bin/env bash
# 把 tools/audio_sources.json 里的原始录音下载到一个新的空目录（只接受音频，下载后用 ffmpeg 检查）。
# 全部是无需登录的公开地址。不运行任何下载来的内容。
#   bash tools/audio_fetch.sh /path/to/empty-dir
set -euo pipefail
OUT="${1:?usage: audio_fetch.sh <new-empty-dir>}"
FFMPEG="${FFMPEG:-$(command -v ffmpeg || echo "$HOME/.local/bin/ffmpeg")}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$OUT"
if [ -n "$(ls -A "$OUT")" ]; then echo "目录不是空的：$OUT" >&2; exit 1; fi
UA="egg-breakfast-comic-audio-fetch/1.0"

python3 -I -c 'import json,sys; [print(k, v["url"]) for k, v in json.load(open(sys.argv[1]))["sources"].items()]' \
  "$ROOT/tools/audio_sources.json" |
while read -r key url; do
  ext="${url##*.}"
  case "$ext" in mp3|wav|ogg|flac) ;; *) echo "跳过非音频地址 $url" >&2; continue ;; esac
  dest="$OUT/$key.$ext"
  ctype=$(curl -sSfL -A "$UA" --max-time 120 -o "$dest" -w '%{content_type}' "$url" </dev/null)
  case "$ctype" in audio/*) ;; *) echo "拒绝 $key：content-type=$ctype" >&2; rm -f "$dest"; continue ;; esac
  info=$("$FFMPEG" -hide_banner -i "$dest" </dev/null 2>&1 | grep -E 'Duration|Audio:' | sed 's/^ *//' | tr '\n' ' ' || true)
  if ! echo "$info" | grep -q 'Audio:'; then echo "拒绝 $key：不是可解码的音频" >&2; rm -f "$dest"; continue; fi
  echo "$key  $info"
done
