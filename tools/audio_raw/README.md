# 原始下载（未处理）

`public/assets/audio/` 里对应文件的处理前原档，来源和许可见 `public/assets/audio/LICENSES.md`。
`tools/audio_build.sh` 从这里读入、处理后写到 `public/assets/audio/`，可重复执行。
bowl-down.mp3 不在此处：它只做过 WAV→mp3 转码，直接放在 `public/assets/audio/`。
