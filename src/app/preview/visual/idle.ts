/**
 * 格内"小循环"的全部可调数字（Ponpon Mania 的规矩：每格只动两三样，每样有理由；不同循环取不同周期，重复不容易被看出来）。
 * 图是 tools/prepare_idle_layers.py 切出来的（public/assets/comic-v3/idle/）：<格>-base 是去掉运动部件并补好的底图，
 * <格>-<层> 是和原格同尺寸的透明部件层，静止姿态盖回去和原格逐像素一致。坐标全部用原格像素（canvas），运行时换算成百分比。
 *
 * 三种运动：
 * - wave：挥手。绕支点来回转几下（sine），最后用弹簧缓动弹回；挥动线留在底图里不动；挥完停几秒再来一轮（间隔随机）。
 * - sway：常驻轻摆（窗帘、植物）。正弦摆动 + 滚动速度带来的倾斜（重量感）+ 鼠标靠近时的弹簧（让开，再弹回，带摩擦所以会停）。
 * - puffs：热气团（径向渐变，同厨房蒸汽），往上飘、变大、淡出，每团周期不同；整体也会被鼠标轻轻推开。
 * 触发：全部由"格子在阅读位"（reading）开关，不另起触发；离开阅读位时落回静止姿态。
 */
export type Wave = {
  kind: "wave";
  id: string;
  /** 挥手的部件层，支点（原格像素） */
  pivot: [number, number];
  /** 最大摆角（度） */
  amp: number;
  /** 每轮来回摆几下 */
  swings: number;
  /** 每一下的时长（秒） */
  swing: number;
  /** 两轮之间停多久 [最短, 最长]（秒） */
  rest: [number, number];
  /** 进入阅读位后第一轮的延迟（秒） */
  first: number;
};
export type Sway = {
  kind: "sway";
  id: string;
  pivot: [number, number];
  /** 常驻摆角（度）与周期（秒）、相位（弧度，让两个层不同步） */
  amp: number;
  period: number;
  phase: number;
  /** 滚动速度（视口高/秒）→ 倾斜度数，上限 maxLean */
  lean: number;
  maxLean: number;
  /** 鼠标让开：影响半径（屏幕像素）、最大让开角度；dir -1 = 往下垂的东西（窗帘），1 = 往上长的东西（植物） */
  push: { radius: number; deg: number; dir: 1 | -1 };
  /** 部件的中心（原格像素），用来算和鼠标的距离 */
  home: [number, number];
};
export type Puffs = {
  kind: "puffs";
  id: string;
  /** 热气只出现的范围 [x0, y0, x1, y1]（原格像素，超出裁掉，免得飘到人物前面） */
  box: [number, number, number, number];
  /** 每团：起点 x（原格像素，相对 box 左边）、周期（秒）、起始延迟、左右飘的方向 */
  puffs: { x: number; dur: number; delay: number; drift: number }[];
  /** 起点离 box 底部多远、上升高度、团的直径（原格像素），透明度峰值 */
  fromBottom: number;
  rise: number;
  size: number;
  alpha: number;
  /** 整团被鼠标推开：半径（屏幕像素）、最大位移（原格像素） */
  push: { radius: number; px: number };
};
export type IdleLayer = Wave | Sway | Puffs;
export type IdleSpec = {
  /** 原格像素尺寸 */
  canvas: [number, number];
  /** 有补好的底图（<格>-base.webp）就用它；只有热气这种叠加层的格不换底图 */
  base: boolean;
  /** 运动层，按顺序画在底图之上 */
  layers: IdleLayer[];
};

/** 弹簧：每帧把位置拉向目标；k 越大越紧，friction 越小停得越快（没有摩擦就会一直晃） */
export const SPRING = { k: 0.07, friction: 0.86 };

export const IDLE: Record<string, IdleSpec> = {
  // 蛋在碗里向妈妈挥手。三格情绪不同：p4f 小声"我在这儿……"（慢、小幅），p5d 大喊"妈！这里！"（多下、快），p6c 应一声"嗯！"（中等）
  p4f: {
    canvas: [445, 455],
    base: true,
    layers: [{ kind: "wave", id: "arm", pivot: [257, 245], amp: 9, swings: 3, swing: 0.34, rest: [2.6, 3.8], first: 0.9 }],
  },
  p5d: {
    canvas: [483, 456],
    base: true,
    layers: [{ kind: "wave", id: "arm", pivot: [303, 233], amp: 12, swings: 5, swing: 0.24, rest: [1.4, 2.2], first: 0.6 }],
  },
  p6c: {
    canvas: [479, 349],
    base: true,
    layers: [{ kind: "wave", id: "arm", pivot: [296, 184], amp: 12, swings: 4, swing: 0.27, rest: [1.8, 2.8], first: 0.5 }],
  },
  // 卧室：窗帘轻摆（上端钉在窗帘杆上）、两盆植物更小的摆。周期互不相同（6.3 / 5.2 / 4.4 / 3.7 秒）
  p5c: {
    canvas: [442, 455],
    base: true,
    layers: [
      { kind: "sway", id: "curtainL", pivot: [228, 28], home: [228, 110], amp: 0.7, period: 6.3, phase: 0, lean: 0.03, maxLean: 1.2, push: { radius: 260, deg: 1.6, dir: -1 } },
      { kind: "sway", id: "curtainR", pivot: [361, 28], home: [361, 110], amp: 0.8, period: 5.2, phase: 1.7, lean: 0.03, maxLean: 1.2, push: { radius: 260, deg: 1.6, dir: -1 } },
      { kind: "sway", id: "plantL", pivot: [95, 95], home: [92, 70], amp: 1.1, period: 4.4, phase: 0.9, lean: 0.05, maxLean: 1.8, push: { radius: 220, deg: 2.2, dir: 1 } },
      { kind: "sway", id: "plantR", pivot: [405, 160], home: [405, 135], amp: 1.3, period: 3.7, phase: 2.4, lean: 0.05, maxLean: 1.8, push: { radius: 220, deg: 2.2, dir: 1 } },
    ],
  },
  // 炒菜格：锅里升起的热气，飘在左边的墙上（袖子和锅沿不盖）
  p2e: {
    canvas: [976, 375],
    base: false,
    layers: [
      {
        kind: "puffs", id: "steam", box: [85, 60, 187, 312], fromBottom: 12, rise: 190, size: 64, alpha: 0.26,
        puffs: [
          { x: 70, dur: 4.6, delay: 0, drift: -14 },
          { x: 38, dur: 5.4, delay: 1.1, drift: 12 },
          { x: 82, dur: 4.1, delay: 2.0, drift: -8 },
          { x: 52, dur: 5.9, delay: 2.9, drift: 16 },
          { x: 24, dur: 4.8, delay: 3.6, drift: -10 },
        ],
        push: { radius: 280, px: 7 },
      },
    ],
  },
};
