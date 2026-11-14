/**
 * 场景坐标约定（所有分支共用）。
 * 厨房主图是 1536×1024，页面上所有厨房元素都用这个“场景像素”定位，
 * 由 <SceneStage> 统一做 cover 缩放。不要在组件里自己换算视口尺寸。
 */
export const SCENE_W = 1536;
export const SCENE_H = 1024;
/** cover 裁切时尽量保持在视口约 55% 高度处的那条线（锅和蛋附近）。 */
export const FOCUS_Y = 600;

/**
 * 主图里关键区域（场景像素）。kitchen-clean.png 与原画逐像素对齐（已验证位移 0,0），
 * 所以这些坐标对两张图都成立。2026-11-13 按新底图校准。
 */
export const ANCHORS = {
  /** 荷包蛋在原画中的包围盒 [x0, y0, x1, y1] */
  eggBox: [525, 150, 915, 525] as const,
  /** 蛋静止落在锅底时的脚底中心（锅底中心 y≈590，锅前沿 y≈648） */
  eggRest: { x: 720, y: 618 },
  /** 蛋图（public/assets/scene/egg.webp）在场景里的显示尺寸 */
  eggSize: { w: 388, h: 388 },
  /** 锅内可见锅底区域（内沿椭圆的外接框），油泡和影子在这里 */
  panBox: [370, 505, 1105, 648] as const,
  /** 锅底火苗 */
  flameBox: [600, 735, 830, 790] as const,
  /** 水壶嘴，蒸汽起点 */
  kettleSpout: { x: 1200, y: 330 },
  /** 吐司盘（前层） */
  toastBox: [0, 805, 440, 1024] as const,
  /** 吐司面黄油附近（结尾由妈妈的漫画画面处理，厨房里暂不用） */
  toastLand: { x: 200, y: 905 },
  /** 蛋从锅里起跳的点（脚底中心）。kitchen-layers 实测后可修正 */
  panLaunch: { x: 720, y: 618 },
  /**
   * 前景妈妈锅铲铲面上蛋的落点（脚底中心）。**占位值**：妈妈素材生成后按铲面实测修正。
   * 前景妈妈预留区域见 momZone。
   */
  spatulaLand: { x: 1080, y: 850 },
  /** 前景妈妈（手臂 + 锅铲）预留区域，从右下角伸入。占位值 */
  momZone: [900, 560, 1536, 1024] as const,
} as const;

export type Box = readonly [number, number, number, number];
export const boxStyle = (b: Box) => ({
  position: "absolute" as const,
  left: b[0],
  top: b[1],
  width: b[2] - b[0],
  height: b[3] - b[1],
});

/**
 * 场景内的前后顺序（z-index，越大越靠前）。所有放进 <SceneStage> 的层都必须用这里的值。
 * 蛋在锅里时在锅沿遮挡层后面；起飞后升到最上层，落到妈妈的锅铲上时盖在铲面上。
 */
export const Z = {
  back: 10, // 墙、瓷砖、黄锅、瓶罐、水壶（layers）
  mid: 20, // 木桌、灶台、红锅锅身（layers）
  fx: 30, // 火苗、油、油泡（kitchen-scene）
  steam: 35, // 水壶蒸汽（kitchen-scene）
  eggInPan: 40, // 锅里循环跳的蛋 + 影子（kitchen-scene）
  panRim: 50, // 红锅前沿遮挡层（layers）
  frontLeft: 60, // 吐司盘（layers）
  frontRight: 61, // 蛋壳、格纹布；妈妈出场时可淡出让位（layers）
  mom: 70, // 前景妈妈 + 锅铲（comic-scroll，经 KitchenScene 的 foreground 插槽）
  eggFlying: 80, // 起飞后的蛋（kitchen-scene）
} as const;
