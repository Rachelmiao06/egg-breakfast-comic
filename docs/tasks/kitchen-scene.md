# 任务：feat/kitchen-scene — 同一颗活动蛋的全程运动与全部声音（主会话，第四版）

- 蛋：锅里循环跳（z 40，被锅沿挡脚）→ `flight` 0→1 从 `panLaunch` 飞到 `spatulaLand`，缩到 `eggOnSpatula`（z 80），落下压扁回弹 → `serve` 0→1 从铲面移到 `bowlLand`，缩到 `eggInBowl`，轻落在饭上。
- 火苗、油、油泡、蒸汽：已完成。
- 声音：按 DESIGN §7 段落，环境声连续，局部音效随 `activePanel` 交叉淡化，`flight`/`serve` 到 1 时单次音效；文件未提供前静音。
- 第一版不做蛋黄流动和拌开。
