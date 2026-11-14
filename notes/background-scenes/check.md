# background-scenes 无头检查结果（2026-11-14，提交 736388c）

命令：`node tools/bg_check.mjs notes/background-scenes http://localhost:3008 <五个视口> 5`（每 5vh 采样一次，全程）和 `FLIGHT=1 node tools/bg_check.mjs …`（接蛋逐帧）。

## 全程

| 视口 | 采样 | 蛋元素数 ≠ 1 | 交接后（tablecall 以外）蛋可见 | tablecall 蛋在碗里 检查 / 失败 | 蛋在桌沿 检查 / 失败 | 脚底在桌面上的位置（0 = 上沿，1 = 前缘） | 后景顺序 |
|---|---|---|---|---|---|---|---|
| 1600x900 | 518 | 0 | 0 | 16 / 0 | 195 / 0 | 0.599–0.601 | kitchen → table-edge+kitchen → table-edge → table-edge+kitchen → table-edge → table-call → search → table-edge → ending |
| 1440x900 | 518 | 0 | 0 | 16 / 0 | 195 / 0 | 0.599–0.601 | kitchen → table-edge+kitchen → table-edge → table-edge+kitchen → table-edge → table-call → search → table-edge → ending |
| 1024x768 | 518 | 0 | 0 | 16 / 0 | 195 / 0 | 0.932–0.935 | kitchen → table-edge+kitchen → table-edge → table-edge+kitchen → table-edge → table-call → search → table-edge → ending |
| 860x1000 | 518 | 0 | 0 | 16 / 0 | 195 / 0 | 0.932–0.934 | kitchen → table-edge+kitchen → table-edge → table-edge+kitchen → table-edge → table-call → search → table-edge → ending |
| 390x844 | 518 | 0 | 0 | 16 / 0 | 195 / 0 | 0.932–0.935 | kitchen → table-edge+kitchen → table-edge → table-edge+kitchen → table-edge → table-call → search → table-edge → ending |

失败项：0

## 接蛋逐帧（场景坐标，按蛋身）

| 视口 | 起跳前被格子盖住 | 起跳在落点右侧 | x 不往回折 | 上升压铲面 | 最高点后从右上方落下（横/纵） | 碰气泡 | 格内蛋身最左 fx | 四阶段都在画面里 | 全程一个蛋 | 结果 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1600x900 | 否 | 是 | 是 | 否 | 是（1.11） | 否 | 0.707 | 是 | 是 | ✓ |
| 1440x900 | 否 | 是 | 是 | 否 | 是（1.11） | 否 | 0.707 | 是 | 是 | ✓ |
| 1024x768 | 否 | 是 | 是 | 否 | 是（1.15） | 否 | 0.707 | 是 | 是 | ✓ |
| 860x1000 | 否 | 是 | 是 | 否 | 是（0.97） | 否 | 0.706 | 是 | 是 | ✓ |
| 390x844 | 否 | 是 | 是 | 否 | 是（1.1） | 否 | 0.707 | 是 | 是 | ✓ |

## 材料（不入库）

- 连续滚动录屏：`background-continuous-1440x900.mp4`（82 秒）、`background-continuous-390x844.mp4`（95 秒）
- 标路径的接蛋截图：`flight-path-<视口>.jpg`（上排 准备 / 起跳 / 越框，下排 最高点 / 下降 / 落铲）
- 各节拍截图：`shots/`
