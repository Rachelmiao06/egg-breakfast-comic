# 分支状态（集成会话维护）

更新于 2026-11-14，main c4fbf3c 之后。

## 已集成进 main 的正式成果
| 分支 | 末端提交 | 内容 |
|---|---|---|
| claude/kitchen-audio-e1e194 | 7e472ee | 已选音效（Pixabay / Freesound，见 public/assets/audio/LICENSES.md）、前景动作驱动的混音器、音效致谢按钮 |
| feat/scroll-motion-demo | 323f0bd | 切菜 / 入锅 / 调汁逐帧表演、前景声音事件、素材需求文档（p4c 淋汁、p4d 蛋黄缺素材） |
| feat/background-scenes | f0ca338 | 后景场景、圆形展开、listen 桌角取景、寻找段后景 |
| claude/catch-landing-fix-0fea1a | 1c2a0aa | 接蛋落点、交接格遮罩 |
| claude/blink-callback | 969abc1 | 眨眼、隔着画框的房间声、结尾三下嗒、点火、声像、画框反应、点蛋 |
| claude/comic-scroll-d12d36 | 76adca0 | 旧首页 / 和 /dev/comic 的漫画页模板 |
| claude/kitchen-layers-3463cc | cc18936 | 厨房分层 |
| feat/visual-direction | — | 集成线，与 main 同步 |

## 保留但未采用
| 分支 | 提交 | 原因 |
|---|---|---|
| feat/kitchen-audio | d39584b（2026-11-13） | 第一版音效尝试：Freesound / Mixkit 录音和较早的混音器。第二天被用户批准的 Pixabay 音效和现在的混音器取代。按用户决定，不合并、也不做空合并；分支保留不动，并打了标签 `unused/kitchen-audio-d39584b` |
