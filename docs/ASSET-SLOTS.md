# 素材对应表（由 `node tools/slots_table.mjs` 生成，不要手改）

换图只改 `src/app/preview/visual/slots.json`：把 `src` 指向新文件即可，**比例在页面里按图片实际尺寸自动读取**，不必重排全页。`x / y / w` 是试验版位（vw / vh），`aspect` 只是图片加载前的占位比例，不是规格。原图在 `source/comic-v3/`（桌面 `new pics` 文件夹的副本，原件未动），单格由 `tools/prepare_comic_v3.py` 切出，未缩放、未改画面。

## 段落与画格

| # | 场景编号 | 段落 | 画格 | 来源 | 原始尺寸 | 对白在图内 | 版位 x,y,w | 进场 |
|---|---|---|---|---|---|---|---|---|
| 0 | `opening` | 开场：活着的厨房 | — | 只有厨房 | | | | |
| 1 | `drop` | 蛋从锅里跳到桌沿（镜头跟随，灶台上移退出） | — | 只有厨房 | | | | |
| 2 | `bag` | 进门放下买菜袋："呼……" | p1a | 01-groceries-and-an-idea.png A 格 | 1007×512 | 无对白 | 4,6,54 | seam |
|  |  |  | p1b | 01-groceries-and-an-idea.png B 格 | 481×468 | 是 | 62,30,28 | right |
| 3 | `idea` | "今天给宝宝做点什么呢？" "先炒个配菜饭吧。" | p1c | 01-groceries-and-an-idea.png C 格 | 529×468 | 是 | 14,4,36 | top |
|  |  |  | p1d | 01-groceries-and-an-idea.png D 格 | 1011×534 | 是 | 55,47,40 | bottom |
| 4 | `chop` | 切菜："哒、哒、哒" | p2a | 02-preparing-the-meal.png A 格 | 1008×468 | 无对白 | 20,4,60 | top |
|  |  |  | p2b | 02-preparing-the-meal.png B 格 | 503×335 | 是 | 22,52,30 | left |
|  |  |  | p2c | 02-preparing-the-meal.png C 格 | 507×335 | 无对白 | 56,55,24 | right |
| 5 | `stirfry` | 下锅："滋啦——"、翻炒 | p2d | 02-preparing-the-meal.png D 格 | 1010×312 | 是 | 15,5,70 | top |
|  |  |  | p2e | 02-preparing-the-meal.png E 格 | 1009×408 | 无对白 | 30,46,52 | bottom |
| 6 | `sauce` | 调汁、盛饭 | p3a | 03-something-is-missing.png A 格 | 511×448 | 无对白 | 20,5,38 | left |
|  |  |  | p3b | 03-something-is-missing.png B 格 | 498×448 | 无对白 | 62,40,26 | right |
| 7 | `missing` | "是不是还少点什么……" | p3c | 03-something-is-missing.png C 格 | 585×499 | 是 | 34,12,40 | left |
| 8 | `hear` | "嗯？" "啵！" | p3d | 03-something-is-missing.png D 格 | 423×499 | 是 | 56,10,30 | right |
| 9 | `catch` | 蛋主动飞向前景；"哎？慢点！" 她惊讶伸出空锅铲接住 | p3e（场景层） | 03-something-is-missing.png E 格 | 1009×574 | 是 | 场景像素 box 380,470,900,512 | 随蛋起飞出现 |
| 10 | `handoff` | "正好，就差你了！"（蛋交给漫画） | — | 只有厨房 | | | | |
| 11 | `bowl` | 放进碗、淋汁 | p4b | 04-catch-and-call.png B 格 | 502×372 | 无对白 | 8,6,42 | left |
|  |  |  | p4c | 04-catch-and-call.png C 格 | 504×372 | 无对白 | 56,42,32 | right |
| 12 | `yolk` | 划开流黄 | p4d | 04-catch-and-call.png D 格 | 1007×306 | 无对白 | 7,22,86 | bottom |
| 13 | `call` | "宝宝，来吃饭啦！" "我在这儿……" | p4e | 04-catch-and-call.png E 格 | 528×487 | 是 | 10,6,38 | left |
|  |  |  | p4f | 04-catch-and-call.png F 格 | 478×487 | 是 | 56,36,28 | right |
| 14 | `search` | 走去女儿房门口："宝宝？"、空房间 | p5a | 05-looking-for-baby.png A 格 | 505×506 | 无对白 | 3,6,22 | left |
|  |  |  | p5b | 05-looking-for-baby.png B 格 | 506×506 | 是 | 27,9,35 | bottom |
|  |  |  | p5c | 05-looking-for-baby.png C 格 | 506×487 | 无对白 | 64,30,33 | right |
| 15 | `eggcall` | "妈！这里！"、回头 | p5d | 05-looking-for-baby.png D 格 | 507×487 | 是 | 8,6,42 | right |
|  |  |  | p5e | 05-looking-for-baby.png E 格 | 504×532 | 无对白 | 56,30,28 | left |
| 16 | `return` | 回到碗前 | p5f | 05-looking-for-baby.png F 格 | 509×532 | 无对白 | 6,6,26 | bottom |
|  |  |  | p6a | 06-recognition-and-punchline.png A 格 | 1020×400 | 无对白 | 30,46,62 | top |
| 17 | `recognize` | "……宝宝？" "嗯！" | p6b | 06-recognition-and-punchline.png B 格 | 511×379 | 是 | 8,6,40 | left |
|  |  |  | p6c | 06-recognition-and-punchline.png C 格 | 511×379 | 是 | 54,40,34 | right |
| 18 | `punchline` | "那刚才把你戳破了怎么办？" "没事，是我拉稀了。" | p6d | 06-recognition-and-punchline.png D 格 | 1020×390 | 是 | 4,4,58 | top |
|  |  |  | p6e | 06-recognition-and-punchline.png E 格 | 506×372 | 是 | 10,46,38 | left |
| 19 | `closeup` | 妈妈表情特写（眼神僵住、嘴一小横），脸旁依次出现三个点，安静结束 | p6f | 06-recognition-and-punchline.png F 格 | 515×372 | 无对白 | 0,0,0 | bottom |

## 跨景接蛋定位点（可调）

| 项 | 当前值 | 说明 |
|---|---|---|
| 接蛋格 box | 380, 470, 900, 512（场景像素 x, y, w, h） | 第 3 页 E 格放在厨房场景层，与蛋同一坐标 |
| 铲面落点 land | fx 0.775, fy 0.49（格内相对位置） | 由 p3e 实测铲头中心（0.81, 0.476）略上移到铲面；落点 = box + land |
| 蛋在铲面的缩放 | 0.4 | 相对后景蛋的显示尺寸 388 |
| 出现时机 appearFlight | 0.22 → 0.45 | 蛋先起飞，飞到这一区间时这一格才出现（她惊讶伸铲） |
| 框线层 frameSrc | 无（框线画在图里，蛋压在整格之上越过） | |
| 锅铲前沿遮挡 occluderSrc | 缺（蛋压在铲面上方） | 有图时放在蛋之上 |

调试：打开 `/preview/visual?debug=1`，右上角可以现场改 box / land / 缩放，"复制 JSON"后贴回 slots.json。
