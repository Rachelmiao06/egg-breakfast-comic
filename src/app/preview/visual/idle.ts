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
  /** 热气的出生范围 [x0, y0, x1, y1]（原格像素）；只决定起点，飘出去的部分不裁切 */
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
/** 一次性缩回：进入阅读位 delay 秒后，部件绕支点转一点、缩小、淡出（像蛋把手收回身体里），之后一直保持；离开阅读位才复原 */
export type Tuck = { kind: "tuck"; id: string; pivot: [number, number]; delay: number; duration: number; rotate: number; scale: number };
export type IdleLayer = Wave | Sway | Puffs | Tuck;
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
    layers: [{ kind: "wave", id: "arm", pivot: [257, 245], amp: 18, swings: 3, swing: 0.3, rest: [2.6, 3.8], first: 0.9 }],
  },
  p5d: {
    canvas: [483, 456],
    base: true,
    layers: [{ kind: "wave", id: "arm", pivot: [303, 233], amp: 24, swings: 6, swing: 0.2, rest: [1.4, 2.2], first: 0.6 }],
  },
  p6c: {
    canvas: [479, 349],
    base: true,
    layers: [{ kind: "wave", id: "arm", pivot: [296, 184], amp: 22, swings: 5, swing: 0.22, rest: [1.8, 2.8], first: 0.5 }],
  },
  // 担心格：妈妈喊"蛋黄都流出来了"时，蛋举着的小手慢慢缩回身体里（不再挥手，情绪对得上）
  p6d: {
    canvas: [987, 360],
    base: true,
    layers: [{ kind: "tuck", id: "arm", pivot: [483, 255], delay: 1.1, duration: 0.9, rotate: 35, scale: 0.15 }],
  },
  // 墙上架子的藤蔓：整串叶子绕盆沿的支点轻摆（周期 4.9 / 5.6 秒，和卧室的不同步）
  p5a: {
    canvas: [475, 474],
    base: true,
    layers: [{ kind: "sway", id: "vine", pivot: [115, 50], home: [135, 120], amp: 4, period: 4.9, phase: 0.4, lean: 0.15, maxLean: 4, push: { radius: 320, deg: 6, dir: -1 } }],
  },
  p5f: {
    canvas: [478, 500],
    base: true,
    layers: [{ kind: "sway", id: "vine", pivot: [75, 45], home: [100, 110], amp: 4.2, period: 5.6, phase: 1.9, lean: 0.15, maxLean: 4, push: { radius: 320, deg: 6, dir: -1 } }],
  },
  // 卧室：窗帘轻摆（上端钉在窗帘杆上）、两盆植物更小的摆。周期互不相同（6.3 / 5.2 / 4.4 / 3.7 秒）
  p5c: {
    canvas: [442, 455],
    base: true,
    layers: [
      { kind: "sway", id: "curtainL", pivot: [228, 28], home: [228, 110], amp: 2.2, period: 6.3, phase: 0, lean: 0.12, maxLean: 3, push: { radius: 320, deg: 4.5, dir: -1 } },
      { kind: "sway", id: "curtainR", pivot: [361, 28], home: [361, 110], amp: 2.5, period: 5.2, phase: 1.7, lean: 0.12, maxLean: 3, push: { radius: 320, deg: 4.5, dir: -1 } },
      { kind: "sway", id: "plantL", pivot: [95, 95], home: [92, 70], amp: 3.2, period: 4.4, phase: 0.9, lean: 0.15, maxLean: 4, push: { radius: 300, deg: 6, dir: 1 } },
      { kind: "sway", id: "plantR", pivot: [405, 160], home: [405, 135], amp: 3.6, period: 3.7, phase: 2.4, lean: 0.15, maxLean: 4, push: { radius: 300, deg: 6, dir: 1 } },
    ],
  },
  // 炒菜格：锅里升起的热气。不裁切：一直飘出格子上沿、进到厨房里（溢出画面的感觉）；进格就是稳定状态，不用等
  p2e: {
    canvas: [976, 375],
    base: false,
    layers: [
      {
        kind: "puffs", id: "steam", box: [95, 60, 190, 312], fromBottom: 6, rise: 620, size: 150, alpha: 0.85,
        puffs: [
          { x: 60, dur: 6.2, delay: 0, drift: -40 },
          { x: 25, dur: 7.4, delay: 1.1, drift: 30 },
          { x: 80, dur: 5.6, delay: 2.0, drift: -26 },
          { x: 45, dur: 8.0, delay: 2.9, drift: 44 },
          { x: 10, dur: 6.6, delay: 3.6, drift: -34 },
          { x: 70, dur: 7.0, delay: 4.4, drift: 22 },
          { x: 35, dur: 5.9, delay: 5.1, drift: -18 },
        ],
        push: { radius: 320, px: 22 },
      },
    ],
  },
};
