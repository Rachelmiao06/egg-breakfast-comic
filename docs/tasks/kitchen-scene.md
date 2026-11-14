# 任务：feat/kitchen-scene — 蛋、影子、火苗、油、油泡、蒸汽、声音（本会话）

- 蛋：`public/assets/scene/egg.webp`（用户提供），显示 388×388 场景像素，脚底落在 `ANCHORS.eggRest`。循环跳；`flight` 非 null 时停止循环，沿弧线从 eggRest 飞到 `toastLand`，1 时落地压扁回弹后静止。
- 火苗、油：从原画 `source/kitchen-main.png` 抽出（与干净底图对齐），`tools/extract_fx.py` 生成 `public/assets/scene/{flame,oil}.png`。
- 油泡、蒸汽：Canvas 粒子，小、淡。
- 声音：素材库录音，文件未提供前静音预览；按钮照常显示。
