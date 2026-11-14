# 任务：feat/kitchen-scene — 蛋、影子、火苗、油、油泡、蒸汽、声音（本会话，第三版）

- 蛋：`public/assets/scene/egg.webp`，显示 388×388 场景像素，脚底落在 `ANCHORS.eggRest`，在锅里时 z = `Z.eggInPan`（被 layers 的锅沿挡脚）。
- 飞行：`flight` 非 null 时停止循环，沿弧线从 `panLaunch` 飞到前景锅铲的 `spatulaLand`（占位），z 切到 `Z.eggFlying`，越近越大；1 时落在铲面压扁回弹后静止。
- 火苗、油：从原画抽出，`tools/extract_fx.py`。油泡、蒸汽：Canvas 粒子，小、淡。
- 声音：素材库录音，文件未提供前静音预览。
